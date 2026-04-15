package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	Port               int
	BaseDomain         string
	RegistryPath       string
	APIKey             string
	TrustForwardedHost bool
}

func (c Config) ListenAddress() string {
	return fmt.Sprintf(":%d", c.Port)
}

func Load() (Config, error) {
	port, err := parsePort(
		firstNonEmpty(
			os.Getenv("PORT"),
			os.Getenv("WILDCARD_PORT"),
		),
	)
	if err != nil {
		return Config{}, err
	}

	baseDomain := normalizeHost(os.Getenv("WILDCARD_BASE_DOMAIN"))
	if baseDomain == "" {
		return Config{}, fmt.Errorf("WILDCARD_BASE_DOMAIN is required")
	}

	registryPath := firstNonEmpty(
		os.Getenv("WILDCARD_REGISTRY_PATH"),
		"default",
	)
	if registryPath == "default" {
		registryPath = discoverDefaultRegistryPath()
	}

	apiKey := strings.TrimSpace(firstNonEmpty(
		os.Getenv("ROUTES_API_KEY"),
		os.Getenv("WILDCARD_API_KEY"),
	))
	if apiKey == "" {
		return Config{}, fmt.Errorf("ROUTES_API_KEY is required")
	}

	trustForwardedHost := parseBoolDefaultFalse(os.Getenv("TRUST_X_FORWARDED_HOST"))

	return Config{
		Port:               port,
		BaseDomain:         baseDomain,
		RegistryPath:       filepath.Clean(registryPath),
		APIKey:             apiKey,
		TrustForwardedHost: trustForwardedHost,
	}, nil
}

func parsePort(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return 3067, nil
	}

	port, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("invalid port: %q", raw)
	}

	return port, nil
}

func discoverDefaultRegistryPath() string {
	candidates := []string{
		filepath.Join("data", "routes.json"),
		filepath.Join("..", "data", "routes.json"),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	return filepath.Join("..", "data", "routes.json")
}

func normalizeHost(host string) string {
	value := strings.ToLower(strings.TrimSpace(host))
	value = strings.TrimSuffix(value, ".")
	if colon := strings.IndexByte(value, ':'); colon >= 0 {
		value = value[:colon]
	}
	return value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func parseBoolDefaultFalse(raw string) bool {
	value := strings.TrimSpace(strings.ToLower(raw))
	return value == "1" || value == "true" || value == "yes" || value == "on"
}
