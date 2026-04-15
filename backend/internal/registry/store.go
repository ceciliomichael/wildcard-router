package registry

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
)

var subdomainPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$`)

type Route struct {
	ID          string `json:"id"`
	Subdomain   string `json:"subdomain"`
	Destination string `json:"destination"`
	Enabled     bool   `json:"enabled"`
	Note        string `json:"note"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type CreateRouteInput struct {
	Subdomain   string `json:"subdomain"`
	Destination string `json:"destination"`
	Enabled     bool   `json:"enabled"`
	Note        string `json:"note"`
}

type UpdateRouteInput struct {
	Subdomain   string `json:"subdomain"`
	Destination string `json:"destination"`
	Enabled     bool   `json:"enabled"`
	Note        string `json:"note"`
}

type registryFile struct {
	Version   int     `json:"version"`
	UpdatedAt string  `json:"updatedAt"`
	Routes    []Route `json:"routes"`
}

type Store struct {
	path string
	mu   sync.RWMutex
}

func NewStore(path string) *Store {
	return &Store{path: path}
}

func (s *Store) Lookup(subdomain string) (Route, bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	registry, err := s.read()
	if err != nil {
		return Route{}, false, err
	}

	targetSubdomain := normalizeSubdomain(subdomain)
	for _, route := range registry.Routes {
		if !route.Enabled {
			continue
		}
		if normalizeSubdomain(route.Subdomain) != targetSubdomain {
			continue
		}

		if err := validateDestination(route.Destination); err != nil {
			return Route{}, false, fmt.Errorf("invalid destination for %q: %w", route.Subdomain, err)
		}

		return route, true, nil
	}

	return Route{}, false, nil
}

func (s *Store) List() ([]Route, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	registry, err := s.read()
	if err != nil {
		return nil, err
	}

	routes := slices.Clone(registry.Routes)
	slices.SortFunc(routes, func(a Route, b Route) int {
		return strings.Compare(strings.ToLower(a.Subdomain), strings.ToLower(b.Subdomain))
	})
	return routes, nil
}

func (s *Store) Create(input CreateRouteInput) (Route, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	registry, err := s.read()
	if err != nil {
		return Route{}, err
	}

	normalized, err := normalizeAndValidateInput(input.Subdomain, input.Destination, input.Note)
	if err != nil {
		return Route{}, err
	}

	for _, route := range registry.Routes {
		if normalizeSubdomain(route.Subdomain) == normalized.subdomain {
			return Route{}, fmt.Errorf("subdomain %q already exists", normalized.subdomain)
		}
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	newRoute := Route{
		ID:          newRouteID(),
		Subdomain:   normalized.subdomain,
		Destination: normalized.destination,
		Enabled:     input.Enabled,
		Note:        normalized.note,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	registry.Routes = append(registry.Routes, newRoute)
	registry.UpdatedAt = now
	if err := s.write(registry); err != nil {
		return Route{}, err
	}

	return newRoute, nil
}

func (s *Store) Update(id string, input UpdateRouteInput) (Route, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	routeID := strings.TrimSpace(id)
	if routeID == "" {
		return Route{}, fmt.Errorf("route id is required")
	}

	registry, err := s.read()
	if err != nil {
		return Route{}, err
	}

	normalized, err := normalizeAndValidateInput(input.Subdomain, input.Destination, input.Note)
	if err != nil {
		return Route{}, err
	}

	routeIndex := -1
	for index, route := range registry.Routes {
		if route.ID == routeID {
			routeIndex = index
			continue
		}
		if normalizeSubdomain(route.Subdomain) == normalized.subdomain {
			return Route{}, fmt.Errorf("subdomain %q already exists", normalized.subdomain)
		}
	}

	if routeIndex == -1 {
		return Route{}, fmt.Errorf("route not found")
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	current := registry.Routes[routeIndex]
	current.Subdomain = normalized.subdomain
	current.Destination = normalized.destination
	current.Enabled = input.Enabled
	current.Note = normalized.note
	current.UpdatedAt = now

	registry.Routes[routeIndex] = current
	registry.UpdatedAt = now
	if err := s.write(registry); err != nil {
		return Route{}, err
	}

	return current, nil
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	routeID := strings.TrimSpace(id)
	if routeID == "" {
		return fmt.Errorf("route id is required")
	}

	registry, err := s.read()
	if err != nil {
		return err
	}

	index := -1
	for i, route := range registry.Routes {
		if route.ID == routeID {
			index = i
			break
		}
	}
	if index == -1 {
		return fmt.Errorf("route not found")
	}

	registry.Routes = append(registry.Routes[:index], registry.Routes[index+1:]...)
	registry.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	return s.write(registry)
}

func (s *Store) read() (registryFile, error) {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return registryFile{}, fmt.Errorf("read registry file: %w", err)
	}

	var file registryFile
	if err := json.Unmarshal(raw, &file); err != nil {
		return registryFile{}, fmt.Errorf("parse registry JSON: %w", err)
	}

	if file.Version != 1 {
		return registryFile{}, fmt.Errorf("unsupported registry version: %d", file.Version)
	}
	if file.Routes == nil {
		file.Routes = []Route{}
	}

	return file, nil
}

func (s *Store) write(file registryFile) error {
	dirPath := filepath.Dir(s.path)
	if err := os.MkdirAll(dirPath, 0o755); err != nil {
		return fmt.Errorf("ensure registry directory: %w", err)
	}

	content, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return fmt.Errorf("encode registry JSON: %w", err)
	}
	content = append(content, '\n')

	tempFilePath := s.path + ".tmp"
	if err := os.WriteFile(tempFilePath, content, 0o644); err != nil {
		return fmt.Errorf("write temp registry file: %w", err)
	}
	if err := os.Rename(tempFilePath, s.path); err != nil {
		_ = os.Remove(tempFilePath)
		return fmt.Errorf("replace registry file: %w", err)
	}

	return nil
}

func normalizeSubdomain(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeAndValidateInput(subdomain string, destination string, note string) (normalizedInput, error) {
	result := normalizedInput{
		subdomain:   normalizeSubdomain(subdomain),
		destination: strings.TrimSpace(destination),
		note:        strings.TrimSpace(note),
	}

	if result.subdomain == "" {
		return normalizedInput{}, fmt.Errorf("subdomain is required")
	}
	if !subdomainPattern.MatchString(result.subdomain) {
		return normalizedInput{}, fmt.Errorf("subdomain format is invalid")
	}
	if err := validateDestination(result.destination); err != nil {
		return normalizedInput{}, fmt.Errorf("invalid destination: %w", err)
	}
	if len(result.note) > 240 {
		return normalizedInput{}, fmt.Errorf("note must be 240 characters or less")
	}

	return result, nil
}

func validateDestination(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return err
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("scheme must be http or https")
	}
	if parsed.Host == "" {
		return fmt.Errorf("host is required")
	}

	return nil
}

func newRouteID() string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return fmt.Sprintf("route-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buffer)
}

type normalizedInput struct {
	subdomain   string
	destination string
	note        string
}
