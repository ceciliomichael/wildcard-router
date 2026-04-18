package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrDuplicateUser      = errors.New("user already exists")
	ErrUserNotFound       = errors.New("user not found")
	ErrUserProtected      = errors.New("user is protected")
	ErrInvalidPassword    = errors.New("invalid password")
)

type Role string

type User struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Username    string `json:"username"`
	Role        Role   `json:"role"`
	IsBootstrap bool   `json:"isBootstrap"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

func (u User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

type CreateUserInput struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Role     Role   `json:"role"`
}

type UpdateUserInput struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Role     Role   `json:"role"`
}

type Store struct {
	users    *mongo.Collection
	sessions *mongo.Collection
}

type userRecord struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty"`
	Name               string             `bson:"name"`
	Username           string             `bson:"username"`
	NormalizedUsername string             `bson:"normalizedUsername"`
	Role               Role               `bson:"role"`
	PasswordHash       []byte             `bson:"passwordHash"`
	IsBootstrap        bool               `bson:"isBootstrap,omitempty"`
	CreatedAt          time.Time          `bson:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt"`
}

type sessionRecord struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	TokenHash string             `bson:"tokenHash"`
	UserID    primitive.ObjectID `bson:"userId"`
	ExpiresAt time.Time          `bson:"expiresAt"`
	CreatedAt time.Time          `bson:"createdAt"`
}

func NewStore(db *mongo.Database) *Store {
	return &Store{
		users:    db.Collection("users"),
		sessions: db.Collection("sessions"),
	}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	if err := s.dropLegacyUserIndex(ctx, "normalizedEmail_1"); err != nil {
		return err
	}

	_, err := s.users.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "normalizedUsername", Value: 1}},
			Options: options.Index().
				SetUnique(true).
				SetPartialFilterExpression(bson.M{"normalizedUsername": bson.M{"$type": "string"}}),
		},
		{Keys: bson.D{{Key: "role", Value: 1}}},
	})
	if err != nil {
		return fmt.Errorf("create user indexes: %w", err)
	}

	_, err = s.sessions.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "tokenHash", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "expiresAt", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(0),
		},
	})
	if err != nil {
		return fmt.Errorf("create session indexes: %w", err)
	}

	return nil
}

func (s *Store) BackfillUsernames(ctx context.Context) error {
	cursor, err := s.users.Find(ctx, bson.M{
		"isBootstrap": bson.M{"$ne": true},
		"$or": []bson.M{
			{"normalizedUsername": bson.M{"$exists": false}},
			{"normalizedUsername": ""},
			{"username": bson.M{"$exists": false}},
			{"username": ""},
		},
	})
	if err != nil {
		return fmt.Errorf("find users to backfill usernames: %w", err)
	}
	defer cursor.Close(ctx)

	now := time.Now().UTC()
	for cursor.Next(ctx) {
		var record userRecord
		if err := cursor.Decode(&record); err != nil {
			return fmt.Errorf("decode user for backfill: %w", err)
		}

		baseUsername := strings.TrimSpace(record.Username)
		if baseUsername == "" {
			baseUsername = strings.TrimSpace(record.Name)
		}
		if baseUsername == "" {
			baseUsername = fmt.Sprintf("user-%s", record.ID.Hex()[:8])
		}

		uniqueUsername, err := s.ensureUniqueUsername(ctx, baseUsername, record.ID)
		if err != nil {
			return err
		}

		_, err = s.users.UpdateOne(
			ctx,
			bson.M{"_id": record.ID},
			bson.M{
				"$set": bson.M{
					"username":           uniqueUsername,
					"normalizedUsername": normalizeUsername(uniqueUsername),
					"updatedAt":          now,
				},
			},
		)
		if err != nil {
			return fmt.Errorf("backfill username: %w", err)
		}
	}
	if err := cursor.Err(); err != nil {
		return fmt.Errorf("iterate users to backfill usernames: %w", err)
	}

	return nil
}

func (s *Store) EnsureBootstrapAdmin(
	ctx context.Context,
	username string,
	password string,
	name string,
) error {
	normalizedUsername := normalizeUsername(username)
	if normalizedUsername == "" {
		count, err := s.users.CountDocuments(ctx, bson.M{"role": RoleAdmin})
		if err != nil {
			return fmt.Errorf("count admin users: %w", err)
		}
		if count == 0 {
			return fmt.Errorf("BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD are required when no admin account exists")
		}
		return nil
	}

	trimmedPassword := strings.TrimSpace(password)
	if trimmedPassword == "" {
		return fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD is required")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(trimmedPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash bootstrap admin password: %w", err)
	}

	now := time.Now().UTC()
	_, err = s.users.UpdateOne(
		ctx,
		bson.M{"isBootstrap": true},
		bson.M{
			"$set": bson.M{
				"name":               nameOrDefault(name),
				"username":           normalizedUsername,
				"normalizedUsername": normalizedUsername,
				"role":               RoleAdmin,
				"isBootstrap":        true,
				"updatedAt":          now,
			},
			"$setOnInsert": bson.M{
				"passwordHash": passwordHash,
				"createdAt":    now,
			},
		},
		options.Update().SetUpsert(true),
	)
	if err != nil {
		return fmt.Errorf("upsert bootstrap admin: %w", err)
	}

	return nil
}

func (s *Store) Authenticate(ctx context.Context, identifier string, password string) (User, error) {
	record, err := s.findUserByUsername(ctx, identifier)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return User{}, ErrInvalidCredentials
		}
		return User{}, err
	}

	if bcrypt.CompareHashAndPassword(record.PasswordHash, []byte(password)) != nil {
		return User{}, ErrInvalidCredentials
	}

	return record.toPublic(), nil
}

func (s *Store) CreateSession(ctx context.Context, userID string, ttl time.Duration) (string, time.Time, error) {
	parsedUserID, err := primitive.ObjectIDFromHex(strings.TrimSpace(userID))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("invalid user id: %w", err)
	}

	token, err := newSessionToken()
	if err != nil {
		return "", time.Time{}, err
	}

	now := time.Now().UTC()
	expiresAt := now.Add(ttl)
	record := sessionRecord{
		TokenHash: hashToken(token),
		UserID:    parsedUserID,
		ExpiresAt: expiresAt,
		CreatedAt: now,
	}
	if _, err := s.sessions.InsertOne(ctx, record); err != nil {
		return "", time.Time{}, fmt.Errorf("insert session: %w", err)
	}

	return token, expiresAt, nil
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" {
		return nil
	}
	_, err := s.sessions.DeleteOne(ctx, bson.M{"tokenHash": hashToken(token)})
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (s *Store) GetUserBySessionToken(ctx context.Context, token string) (User, bool, error) {
	var session sessionRecord
	err := s.sessions.FindOne(ctx, bson.M{"tokenHash": hashToken(token)}).Decode(&session)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return User{}, false, nil
		}
		return User{}, false, fmt.Errorf("find session: %w", err)
	}

	if session.ExpiresAt.Before(time.Now().UTC()) {
		_, _ = s.sessions.DeleteOne(ctx, bson.M{"_id": session.ID})
		return User{}, false, nil
	}

	var user userRecord
	err = s.users.FindOne(ctx, bson.M{"_id": session.UserID}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return User{}, false, nil
		}
		return User{}, false, fmt.Errorf("find user by session: %w", err)
	}

	return user.toPublic(), true, nil
}

func (s *Store) ListUsers(ctx context.Context) ([]User, error) {
	cursor, err := s.users.Find(ctx, bson.M{
		"isBootstrap": bson.M{"$ne": true},
	}, options.Find().SetSort(bson.D{
		{Key: "role", Value: 1},
		{Key: "normalizedUsername", Value: 1},
	}))
	if err != nil {
		return nil, fmt.Errorf("find users: %w", err)
	}
	defer cursor.Close(ctx)

	users := make([]User, 0)
	for cursor.Next(ctx) {
		var record userRecord
		if err := cursor.Decode(&record); err != nil {
			return nil, fmt.Errorf("decode user: %w", err)
		}
		users = append(users, record.toPublic())
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

func (s *Store) CreateUser(ctx context.Context, input CreateUserInput) (User, string, error) {
	username := strings.TrimSpace(input.Username)
	if username == "" {
		return User{}, "", fmt.Errorf("username is required")
	}

	normalizedUsername := normalizeUsername(username)
	if normalizedUsername == "" {
		return User{}, "", fmt.Errorf("username is required")
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return User{}, "", fmt.Errorf("name is required")
	}

	role := input.Role
	if role == "" {
		role = RoleUser
	}
	if role != RoleAdmin && role != RoleUser {
		return User{}, "", fmt.Errorf("role must be admin or user")
	}

	password, err := generatePassword(18)
	if err != nil {
		return User{}, "", err
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, "", fmt.Errorf("hash password: %w", err)
	}

	now := time.Now().UTC()
	record := userRecord{
		Name:               name,
		Username:           username,
		NormalizedUsername: normalizedUsername,
		Role:               role,
		PasswordHash:       passwordHash,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	result, err := s.users.InsertOne(ctx, record)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return User{}, "", ErrDuplicateUser
		}
		return User{}, "", fmt.Errorf("insert user: %w", err)
	}

	insertedID, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		return User{}, "", fmt.Errorf("unexpected inserted user id type")
	}
	record.ID = insertedID

	return record.toPublic(), password, nil
}

func (s *Store) UpdateUser(ctx context.Context, targetID string, input UpdateUserInput) (User, error) {
	normalizedTargetID := strings.TrimSpace(targetID)
	if normalizedTargetID == "" {
		return User{}, fmt.Errorf("user id is required")
	}

	targetObjectID, err := primitive.ObjectIDFromHex(normalizedTargetID)
	if err != nil {
		return User{}, fmt.Errorf("invalid user id: %w", err)
	}

	var target userRecord
	if err := s.users.FindOne(ctx, bson.M{"_id": targetObjectID}).Decode(&target); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return User{}, ErrUserNotFound
		}
		return User{}, fmt.Errorf("find target user: %w", err)
	}

	if target.IsBootstrap {
		return User{}, ErrUserProtected
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return User{}, fmt.Errorf("name is required")
	}
	if len(name) > 120 {
		return User{}, fmt.Errorf("name is too long")
	}

	username := strings.TrimSpace(input.Username)
	if username == "" {
		return User{}, fmt.Errorf("username is required")
	}
	normalizedUsername := normalizeUsername(username)
	if normalizedUsername == "" {
		return User{}, fmt.Errorf("username is required")
	}

	role := input.Role
	if role == "" {
		return User{}, fmt.Errorf("role is required")
	}
	if role != RoleAdmin && role != RoleUser {
		return User{}, fmt.Errorf("role must be admin or user")
	}
	if target.Role == RoleAdmin && role != RoleAdmin {
		adminCount, err := s.users.CountDocuments(ctx, bson.M{"role": RoleAdmin})
		if err != nil {
			return User{}, fmt.Errorf("count admin users: %w", err)
		}
		if adminCount <= 1 {
			return User{}, ErrUserProtected
		}
	}

	now := time.Now().UTC()
	update := bson.M{
		"name":               name,
		"username":           username,
		"normalizedUsername": normalizedUsername,
		"role":               role,
		"updatedAt":          now,
	}

	_, err = s.users.UpdateOne(
		ctx,
		bson.M{"_id": targetObjectID},
		bson.M{"$set": update},
	)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return User{}, ErrDuplicateUser
		}
		return User{}, fmt.Errorf("update user: %w", err)
	}

	target.Name = name
	target.Username = username
	target.NormalizedUsername = normalizedUsername
	target.Role = role
	target.UpdatedAt = now

	return target.toPublic(), nil
}

func (s *Store) DeleteUser(ctx context.Context, targetID string) error {
	normalizedTargetID := strings.TrimSpace(targetID)
	if normalizedTargetID == "" {
		return fmt.Errorf("user id is required")
	}

	targetObjectID, err := primitive.ObjectIDFromHex(normalizedTargetID)
	if err != nil {
		return fmt.Errorf("invalid user id: %w", err)
	}

	var target userRecord
	if err := s.users.FindOne(ctx, bson.M{"_id": targetObjectID}).Decode(&target); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return ErrUserNotFound
		}
		return fmt.Errorf("find target user: %w", err)
	}

	if target.Role == RoleAdmin {
		if target.IsBootstrap {
			return ErrUserProtected
		}
		adminCount, err := s.users.CountDocuments(ctx, bson.M{"role": RoleAdmin})
		if err != nil {
			return fmt.Errorf("count admin users: %w", err)
		}
		if adminCount <= 1 {
			return ErrUserProtected
		}
	}

	if _, err := s.users.DeleteOne(ctx, bson.M{"_id": targetObjectID}); err != nil {
		return fmt.Errorf("delete user: %w", err)
	}

	if err := s.deleteSessionsByUserID(ctx, targetObjectID); err != nil {
		return err
	}

	return nil
}

func (s *Store) RegeneratePassword(ctx context.Context, targetID string) (User, string, error) {
	normalizedTargetID := strings.TrimSpace(targetID)
	if normalizedTargetID == "" {
		return User{}, "", fmt.Errorf("user id is required")
	}

	targetObjectID, err := primitive.ObjectIDFromHex(normalizedTargetID)
	if err != nil {
		return User{}, "", fmt.Errorf("invalid user id: %w", err)
	}

	var target userRecord
	if err := s.users.FindOne(ctx, bson.M{"_id": targetObjectID}).Decode(&target); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return User{}, "", ErrUserNotFound
		}
		return User{}, "", fmt.Errorf("find target user: %w", err)
	}

	if target.IsBootstrap {
		return User{}, "", ErrUserProtected
	}

	password, err := generatePassword(18)
	if err != nil {
		return User{}, "", err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, "", fmt.Errorf("hash password: %w", err)
	}

	now := time.Now().UTC()
	_, err = s.users.UpdateOne(
		ctx,
		bson.M{"_id": targetObjectID},
		bson.M{
			"$set": bson.M{
				"passwordHash": passwordHash,
				"updatedAt":    now,
			},
		},
	)
	if err != nil {
		return User{}, "", fmt.Errorf("update password: %w", err)
	}

	if err := s.deleteSessionsByUserID(ctx, targetObjectID); err != nil {
		return User{}, "", err
	}

	target.PasswordHash = passwordHash
	target.UpdatedAt = now

	return target.toPublic(), password, nil
}

func (s *Store) UpdateCurrentUserName(ctx context.Context, userID string, name string) (User, error) {
	parsedUserID, err := primitive.ObjectIDFromHex(strings.TrimSpace(userID))
	if err != nil {
		return User{}, fmt.Errorf("invalid user id: %w", err)
	}

	var target userRecord
	if err := s.users.FindOne(ctx, bson.M{"_id": parsedUserID}).Decode(&target); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return User{}, ErrUserNotFound
		}
		return User{}, fmt.Errorf("find user: %w", err)
	}

	if target.IsBootstrap {
		return User{}, ErrUserProtected
	}

	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return User{}, fmt.Errorf("name is required")
	}
	if len(trimmedName) > 120 {
		return User{}, fmt.Errorf("name is too long")
	}

	now := time.Now().UTC()
	_, err = s.users.UpdateOne(
		ctx,
		bson.M{"_id": parsedUserID},
		bson.M{
			"$set": bson.M{
				"name":      trimmedName,
				"updatedAt": now,
			},
		},
	)
	if err != nil {
		return User{}, fmt.Errorf("update user profile: %w", err)
	}

	target.Name = trimmedName
	target.UpdatedAt = now
	return target.toPublic(), nil
}

func (s *Store) ChangeCurrentUserPassword(
	ctx context.Context,
	userID string,
	currentPassword string,
	newPassword string,
) (User, error) {
	parsedUserID, err := primitive.ObjectIDFromHex(strings.TrimSpace(userID))
	if err != nil {
		return User{}, fmt.Errorf("invalid user id: %w", err)
	}

	var target userRecord
	if err := s.users.FindOne(ctx, bson.M{"_id": parsedUserID}).Decode(&target); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return User{}, ErrUserNotFound
		}
		return User{}, fmt.Errorf("find user: %w", err)
	}

	if target.IsBootstrap {
		return User{}, ErrUserProtected
	}

	if bcrypt.CompareHashAndPassword(target.PasswordHash, []byte(currentPassword)) != nil {
		return User{}, ErrInvalidPassword
	}

	if len(strings.TrimSpace(newPassword)) == 0 {
		return User{}, fmt.Errorf("new password is required")
	}
	if len(newPassword) < 8 {
		return User{}, fmt.Errorf("new password must be at least 8 characters")
	}
	if len(newPassword) > 128 {
		return User{}, fmt.Errorf("new password is too long")
	}

	newPasswordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return User{}, fmt.Errorf("hash new password: %w", err)
	}

	now := time.Now().UTC()
	_, err = s.users.UpdateOne(
		ctx,
		bson.M{"_id": parsedUserID},
		bson.M{
			"$set": bson.M{
				"passwordHash": newPasswordHash,
				"updatedAt":    now,
			},
		},
	)
	if err != nil {
		return User{}, fmt.Errorf("update user password: %w", err)
	}

	if err := s.deleteSessionsByUserID(ctx, parsedUserID); err != nil {
		return User{}, err
	}

	target.PasswordHash = newPasswordHash
	target.UpdatedAt = now
	return target.toPublic(), nil
}

func (s *Store) findUserByUsername(ctx context.Context, username string) (userRecord, error) {
	var record userRecord
	err := s.users.FindOne(ctx, bson.M{
		"normalizedUsername": normalizeUsername(username),
	}).Decode(&record)
	if err != nil {
		return userRecord{}, err
	}
	return record, nil
}

func (s *Store) ensureUniqueUsername(ctx context.Context, base string, ignoreID primitive.ObjectID) (string, error) {
	normalizedBase := normalizeUsername(base)
	if normalizedBase == "" {
		normalizedBase = "user"
	}

	candidate := normalizedBase
	for attempt := 0; attempt < 100; attempt++ {
		var record userRecord
		err := s.users.FindOne(ctx, bson.M{
			"normalizedUsername": candidate,
			"_id":                bson.M{"$ne": ignoreID},
		}).Decode(&record)
		if errors.Is(err, mongo.ErrNoDocuments) {
			return candidate, nil
		}
		if err != nil {
			return "", fmt.Errorf("check username uniqueness: %w", err)
		}

		candidate = fmt.Sprintf("%s-%d", normalizedBase, attempt+2)
	}

	return "", fmt.Errorf("could not assign a unique username")
}

func (s *Store) deleteSessionsByUserID(ctx context.Context, userID primitive.ObjectID) error {
	_, err := s.sessions.DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		return fmt.Errorf("delete sessions for user: %w", err)
	}
	return nil
}

func (u userRecord) toPublic() User {
	return User{
		ID:          u.ID.Hex(),
		Name:        u.Name,
		Username:    usernameOrFallback(u.Username, u.Name, u.ID),
		Role:        u.Role,
		IsBootstrap: u.IsBootstrap,
		CreatedAt:   u.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt:   u.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func normalizeUsername(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}


func usernameOrFallback(username string, name string, id primitive.ObjectID) string {
	trimmed := strings.TrimSpace(username)
	if trimmed != "" {
		return trimmed
	}
	trimmedName := strings.TrimSpace(name)
	if trimmedName != "" {
		return trimmedName
	}
	if id != (primitive.ObjectID{}) {
		return fmt.Sprintf("user-%s", id.Hex()[:8])
	}
	return "user"
}

func (s *Store) dropLegacyUserIndex(ctx context.Context, indexName string) error {
	cursor, err := s.users.Indexes().List(ctx)
	if err != nil {
		return fmt.Errorf("list user indexes: %w", err)
	}
	defer cursor.Close(ctx)

	for cursor.Next(ctx) {
		var indexDoc struct {
			Name string `bson:"name"`
		}
		if err := cursor.Decode(&indexDoc); err != nil {
			return fmt.Errorf("decode user index: %w", err)
		}
		if indexDoc.Name == indexName {
			if _, err := s.users.Indexes().DropOne(ctx, indexName); err != nil {
				return fmt.Errorf("drop legacy user index %s: %w", indexName, err)
			}
			break
		}
	}

	if err := cursor.Err(); err != nil {
		return fmt.Errorf("iterate user indexes: %w", err)
	}

	return nil
}

func nameOrDefault(value string) string {
	name := strings.TrimSpace(value)
	if name == "" {
		return "Main Admin"
	}
	return name
}

func newSessionToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate session token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func hashToken(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func generatePassword(length int) (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_"

	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate password: %w", err)
	}

	buffer := make([]byte, length)
	for index := range buffer {
		buffer[index] = alphabet[int(bytes[index])%len(alphabet)]
	}

	return string(buffer), nil
}
