package registry

import "testing"

func TestNormalizeDestinationAddsHTTPForBareHostPort(t *testing.T) {
	t.Parallel()

	normalized, err := NormalizeDestination("localhost:3068")
	if err != nil {
		t.Fatalf("normalize destination: %v", err)
	}

	if normalized != "http://localhost:3068" {
		t.Fatalf("unexpected normalized destination: %s", normalized)
	}
}

func TestNormalizeDestinationPreservesExplicitHTTPS(t *testing.T) {
	t.Parallel()

	normalized, err := NormalizeDestination("https://example.com:8443")
	if err != nil {
		t.Fatalf("normalize destination: %v", err)
	}

	if normalized != "https://example.com:8443" {
		t.Fatalf("unexpected normalized destination: %s", normalized)
	}
}
