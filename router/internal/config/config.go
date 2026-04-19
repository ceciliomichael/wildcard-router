package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                     int
	BaseDomain               string
	MongoURI                 string
	MongoDatabase            string
	FrontendRouteSubdomain   string
	FrontendRouteDestination string
}

func (c Config) ListenAddress() string {
	return fmt.Sprintf(":%d", c.Port)
}

func Load() (Config, error) {
	port, err := parsePort(firstNonEmpty(os.Getenv("ROUTER_PORT"), os.Getenv("PORT")))
	if err != nil {
		return Config{}, err
	}

	baseDomain := normalizeHost(os.Getenv("WILDCARD_BASE_DOMAIN"))
	if baseDomain == "" {
		return Config{}, fmt.Errorf("WILDCARD_BASE_DOMAIN is required")
	}

	mongoURI := strings.TrimSpace(firstNonEmpty(
		os.Getenv("MONGODB_URI"),
		"mongodb://localhost:27017",
	))
	if mongoURI == "" {
		return Config{}, fmt.Errorf("MONGODB_URI is required")
	}

	frontendRouteSubdomain := normalizeHost(firstNonEmpty(os.Getenv("FRONTEND_ROUTE_SUBDOMAIN"), "routegate"))
	frontendRouteDestination, err := normalizeDestination(firstNonEmpty(
		os.Getenv("FRONTEND_ROUTE_DESTINATION"),
		"http://frontend:3000",
	))
	if err != nil {
		return Config{}, fmt.Errorf("FRONTEND_ROUTE_DESTINATION: %w", err)
	}

	return Config{
		Port:                     port,
		BaseDomain:               baseDomain,
		MongoURI:                 mongoURI,
		MongoDatabase:            strings.TrimSpace(firstNonEmpty(os.Getenv("MONGODB_DATABASE"), "routegate")),
		FrontendRouteSubdomain:   frontendRouteSubdomain,
		FrontendRouteDestination: frontendRouteDestination,
	}, nil
}

func parsePort(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return 3068, nil
	}

	port, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("invalid port: %q", raw)
	}

	return port, nil
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

func normalizeDestination(raw string) (string, error) {
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
