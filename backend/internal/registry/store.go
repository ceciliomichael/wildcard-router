package registry

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	subdomainPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$`)

	ErrDuplicateSubdomain = errors.New("subdomain already exists")
	ErrRouteNotFound      = errors.New("route not found")
	ErrRouteForbidden     = errors.New("forbidden")
)

type Route struct {
	ID                    string `json:"id"`
	OwnerID               string `json:"ownerId"`
	OwnerName             string `json:"ownerName"`
	OwnerEmail            string `json:"ownerEmail"`
	Subdomain             string `json:"subdomain"`
	Destination           string `json:"destination"`
	Enabled               bool   `json:"enabled"`
	InsecureSkipTLSVerify bool   `json:"insecureSkipTLSVerify"`
	Note                  string `json:"note"`
	CreatedAt             string `json:"createdAt"`
	UpdatedAt             string `json:"updatedAt"`
}

type CreateRouteInput struct {
	Subdomain             string `json:"subdomain"`
	Destination           string `json:"destination"`
	Enabled               bool   `json:"enabled"`
	InsecureSkipTLSVerify bool   `json:"insecureSkipTLSVerify"`
	Note                  string `json:"note"`
}

type UpdateRouteInput struct {
	Subdomain             string `json:"subdomain"`
	Destination           string `json:"destination"`
	Enabled               bool   `json:"enabled"`
	InsecureSkipTLSVerify bool   `json:"insecureSkipTLSVerify"`
	Note                  string `json:"note"`
}

type AccessScope struct {
	UserID  string
	IsAdmin bool
}

type OwnerInfo struct {
	UserID    string
	UserName  string
	UserEmail string
}

type Store struct {
	collection *mongo.Collection
}

type routeRecord struct {
	ID                    primitive.ObjectID `bson:"_id,omitempty"`
	OwnerID               primitive.ObjectID `bson:"ownerId"`
	OwnerName             string             `bson:"ownerName"`
	OwnerEmail            string             `bson:"ownerEmail"`
	Subdomain             string             `bson:"subdomain"`
	NormalizedSubdomain   string             `bson:"normalizedSubdomain"`
	Destination           string             `bson:"destination"`
	Enabled               bool               `bson:"enabled"`
	InsecureSkipTLSVerify bool               `bson:"insecureSkipTLSVerify"`
	Note                  string             `bson:"note"`
	CreatedAt             time.Time          `bson:"createdAt"`
	UpdatedAt             time.Time          `bson:"updatedAt"`
}

func NewStore(db *mongo.Database) *Store {
	return &Store{collection: db.Collection("routes")}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	_, err := s.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "normalizedSubdomain", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "ownerId", Value: 1}, {Key: "updatedAt", Value: -1}},
		},
	})
	if err != nil {
		return fmt.Errorf("create route indexes: %w", err)
	}
	return nil
}

func (s *Store) Lookup(subdomain string) (Route, bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var record routeRecord
	err := s.collection.FindOne(ctx, bson.M{
		"normalizedSubdomain": normalizeSubdomain(subdomain),
		"enabled":             true,
	}).Decode(&record)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return Route{}, false, nil
		}
		return Route{}, false, fmt.Errorf("lookup route: %w", err)
	}

	if _, err := NormalizeDestination(record.Destination); err != nil {
		return Route{}, false, fmt.Errorf("invalid destination for %q: %w", record.Subdomain, err)
	}

	return record.toPublic(), true, nil
}

func (s *Store) List(ctx context.Context, scope AccessScope) ([]Route, error) {
	filter, err := buildScopeFilter(scope)
	if err != nil {
		return nil, err
	}

	cursor, err := s.collection.Find(ctx, filter, options.Find().SetSort(bson.D{
		{Key: "updatedAt", Value: -1},
		{Key: "normalizedSubdomain", Value: 1},
	}))
	if err != nil {
		return nil, fmt.Errorf("find routes: %w", err)
	}
	defer cursor.Close(ctx)

	routes := make([]Route, 0)
	for cursor.Next(ctx) {
		var record routeRecord
		if err := cursor.Decode(&record); err != nil {
			return nil, fmt.Errorf("decode route: %w", err)
		}
		routes = append(routes, record.toPublic())
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("iterate routes: %w", err)
	}

	return routes, nil
}

func (s *Store) Create(ctx context.Context, owner OwnerInfo, input CreateRouteInput) (Route, error) {
	ownerID, err := primitive.ObjectIDFromHex(strings.TrimSpace(owner.UserID))
	if err != nil {
		return Route{}, fmt.Errorf("invalid owner id: %w", err)
	}

	normalized, err := normalizeAndValidateInput(input.Subdomain, input.Destination, input.Note)
	if err != nil {
		return Route{}, err
	}

	now := time.Now().UTC()
	record := routeRecord{
		OwnerID:               ownerID,
		OwnerName:             strings.TrimSpace(owner.UserName),
		OwnerEmail:            strings.TrimSpace(owner.UserEmail),
		Subdomain:             normalized.subdomain,
		NormalizedSubdomain:   normalized.subdomain,
		Destination:           normalized.destination,
		Enabled:               input.Enabled,
		InsecureSkipTLSVerify: input.InsecureSkipTLSVerify,
		Note:                  normalized.note,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	result, err := s.collection.InsertOne(ctx, record)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return Route{}, fmt.Errorf("%w: %s", ErrDuplicateSubdomain, normalized.subdomain)
		}
		return Route{}, fmt.Errorf("insert route: %w", err)
	}

	insertedID, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		return Route{}, fmt.Errorf("unexpected inserted route id type")
	}
	record.ID = insertedID

	return record.toPublic(), nil
}

func (s *Store) Update(ctx context.Context, scope AccessScope, id string, input UpdateRouteInput) (Route, error) {
	record, err := s.findByID(ctx, id)
	if err != nil {
		return Route{}, err
	}
	if !scope.IsAdmin && record.OwnerID.Hex() != strings.TrimSpace(scope.UserID) {
		return Route{}, ErrRouteForbidden
	}

	normalized, err := normalizeAndValidateInput(input.Subdomain, input.Destination, input.Note)
	if err != nil {
		return Route{}, err
	}

	record.Subdomain = normalized.subdomain
	record.NormalizedSubdomain = normalized.subdomain
	record.Destination = normalized.destination
	record.Enabled = input.Enabled
	record.InsecureSkipTLSVerify = input.InsecureSkipTLSVerify
	record.Note = normalized.note
	record.UpdatedAt = time.Now().UTC()

	_, err = s.collection.ReplaceOne(ctx, bson.M{"_id": record.ID}, record)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return Route{}, fmt.Errorf("%w: %s", ErrDuplicateSubdomain, normalized.subdomain)
		}
		return Route{}, fmt.Errorf("replace route: %w", err)
	}

	return record.toPublic(), nil
}

func (s *Store) Delete(ctx context.Context, scope AccessScope, id string) error {
	record, err := s.findByID(ctx, id)
	if err != nil {
		return err
	}
	if !scope.IsAdmin && record.OwnerID.Hex() != strings.TrimSpace(scope.UserID) {
		return ErrRouteForbidden
	}

	_, err = s.collection.DeleteOne(ctx, bson.M{"_id": record.ID})
	if err != nil {
		return fmt.Errorf("delete route: %w", err)
	}
	return nil
}

func (s *Store) findByID(ctx context.Context, id string) (routeRecord, error) {
	objectID, err := primitive.ObjectIDFromHex(strings.TrimSpace(id))
	if err != nil {
		return routeRecord{}, ErrRouteNotFound
	}

	var record routeRecord
	err = s.collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&record)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return routeRecord{}, ErrRouteNotFound
		}
		return routeRecord{}, fmt.Errorf("find route: %w", err)
	}

	return record, nil
}

func buildScopeFilter(scope AccessScope) (bson.M, error) {
	if scope.IsAdmin {
		return bson.M{}, nil
	}

	userID, err := primitive.ObjectIDFromHex(strings.TrimSpace(scope.UserID))
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}

	return bson.M{"ownerId": userID}, nil
}

func (r routeRecord) toPublic() Route {
	return Route{
		ID:                    r.ID.Hex(),
		OwnerID:               r.OwnerID.Hex(),
		OwnerName:             r.OwnerName,
		OwnerEmail:            r.OwnerEmail,
		Subdomain:             r.Subdomain,
		Destination:           r.Destination,
		Enabled:               r.Enabled,
		InsecureSkipTLSVerify: r.InsecureSkipTLSVerify,
		Note:                  r.Note,
		CreatedAt:             r.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt:             r.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func normalizeSubdomain(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeAndValidateInput(subdomain string, destination string, note string) (normalizedInput, error) {
	normalizedDestination, err := NormalizeDestination(destination)
	if err != nil {
		return normalizedInput{}, fmt.Errorf("invalid destination: %w", err)
	}

	result := normalizedInput{
		subdomain:   normalizeSubdomain(subdomain),
		destination: normalizedDestination,
		note:        strings.TrimSpace(note),
	}

	if result.subdomain == "" {
		return normalizedInput{}, fmt.Errorf("subdomain is required")
	}
	if !subdomainPattern.MatchString(result.subdomain) {
		return normalizedInput{}, fmt.Errorf("subdomain format is invalid")
	}
	if len(result.note) > 240 {
		return normalizedInput{}, fmt.Errorf("note must be 240 characters or less")
	}

	return result, nil
}

func NormalizeDestination(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", fmt.Errorf("destination is required")
	}

	parsedInput := trimmed
	if !strings.Contains(parsedInput, "://") {
		parsedInput = "http://" + parsedInput
	}

	parsed, err := url.Parse(parsedInput)
	if err != nil {
		return "", err
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("scheme must be http or https")
	}
	if parsed.Host == "" {
		return "", fmt.Errorf("host is required")
	}

	return parsed.String(), nil
}

type normalizedInput struct {
	subdomain   string
	destination string
	note        string
}
