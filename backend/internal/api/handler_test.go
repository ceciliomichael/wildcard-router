package api

import (
	"testing"

	"wildcard-catcher/internal/config"
)

func TestIsReservedRouteSubdomain(t *testing.T) {
	t.Parallel()

	handler := &Handler{
		cfg: config.Config{FrontendRouteSubdomain: "router"},
	}

	if !handler.isReservedRouteSubdomain("router") {
		t.Fatalf("expected router to be reserved")
	}
	if handler.isReservedRouteSubdomain("docs") {
		t.Fatalf("expected docs not to be reserved")
	}
}
