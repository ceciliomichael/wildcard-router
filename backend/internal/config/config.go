package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                   int
	BaseDomain             string
	MongoURI               string
	MongoDatabase          string
	BootstrapAdminUsername string
	BootstrapAdminPassword string
	BootstrapAdminName     string
	SessionCookieName      string
	SessionHours           int
	SessionCookieSecure    bool
	TrustForwardedHost     bool
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

	mongoURI := strings.TrimSpace(firstNonEmpty(
		os.Getenv("MONGODB_URI"),
		"mongodb://localhost:27017",
	))
	if mongoURI == "" {
		return Config{}, fmt.Errorf("MONGODB_URI is required")
	}

	sessionHours, err := parsePositiveInt(
		firstNonEmpty(os.Getenv("SESSION_TTL_HOURS"), "168"),
		"SESSION_TTL_HOURS",
	)
	if err != nil {
		return Config{}, err
	}

	trustForwardedHost := parseBoolDefaultFalse(os.Getenv("TRUST_X_FORWARDED_HOST"))

	return Config{
		Port:                   port,
		BaseDomain:             baseDomain,
		MongoURI:               mongoURI,
		MongoDatabase:          strings.TrimSpace(firstNonEmpty(os.Getenv("MONGODB_DATABASE"), "wildcard_catcher")),
		BootstrapAdminUsername: strings.TrimSpace(os.Getenv("BOOTSTRAP_ADMIN_USERNAME")),
		BootstrapAdminPassword: os.Getenv("BOOTSTRAP_ADMIN_PASSWORD"),
		BootstrapAdminName:     strings.TrimSpace(firstNonEmpty(os.Getenv("BOOTSTRAP_ADMIN_NAME"), "Main Admin")),
		SessionCookieName:      strings.TrimSpace(firstNonEmpty(os.Getenv("SESSION_COOKIE_NAME"), "wc_session")),
		SessionHours:           sessionHours,
		SessionCookieSecure:    parseBoolDefaultFalse(os.Getenv("SESSION_COOKIE_SECURE")),
		TrustForwardedHost:     trustForwardedHost,
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

func normalizeHost(host string) string {
	value := strings.ToLower(strings.TrimSpace(host))
	value = strings.TrimSuffix(value, ".")
	if colon := strings.IndexByte(value, ':'); colon >= 0 {
		value = value[:colon]
	}
	return value
}

func parsePositiveInt(raw string, label string) (int, error) {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value < 1 {
		return 0, fmt.Errorf("%s must be a positive integer", label)
	}
	return value, nil
}

func (c Config) SessionTTL() time.Duration {
	return time.Duration(c.SessionHours) * time.Hour
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
