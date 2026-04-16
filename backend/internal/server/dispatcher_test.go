package server

import (
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"

	"wildcard-catcher/internal/config"
	"wildcard-catcher/internal/proxy"
	"wildcard-catcher/internal/registry"
)

type apiCaptureHandler struct {
	called bool
}

func (h *apiCaptureHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	h.called = true
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write([]byte("api"))
}

type emptyRouteStore struct{}

func (emptyRouteStore) Lookup(subdomain string) (registry.Route, bool, error) {
	return registry.Route{}, false, nil
}

type routedStore struct {
	routes map[string]registry.Route
}

func (s routedStore) Lookup(subdomain string) (registry.Route, bool, error) {
	route, ok := s.routes[subdomain]
	return route, ok, nil
}

func TestDispatcherProxiesApiPathsForRoutedSubdomains(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(request.URL.Path))
	}))
	t.Cleanup(upstream.Close)

	proxyHandler := proxy.NewHandler(
		config.Config{BaseDomain: "echosphere.systems"},
		routedStore{routes: map[string]registry.Route{
			"supabase-wah4p": {
				ID:          "route-1",
				Subdomain:   "supabase-wah4p",
				Destination: upstream.URL,
				Enabled:     true,
			},
		}},
		log.New(io.Discard, "", 0),
	)
	apiHandler := &apiCaptureHandler{}
	dispatcher := NewDispatcher(apiHandler, proxyHandler)

	server := httptest.NewServer(dispatcher)
	t.Cleanup(server.Close)

	request, err := http.NewRequest(http.MethodGet, server.URL+"/api/platform/profile", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	request.Host = "proxy.internal"
	request.Header.Set("X-Forwarded-Host", "supabase-wah4p.echosphere.systems")
	request.Header.Set("X-Forwarded-Proto", "https")

	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", response.StatusCode)
	}
	if string(body) != "/api/platform/profile" {
		t.Fatalf("unexpected body: %q", string(body))
	}
	if apiHandler.called {
		t.Fatalf("local API should not have handled a routed subdomain request")
	}
}

func TestDispatcherAutomaticallyRoutesFrontendSubdomain(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("frontend"))
	}))
	t.Cleanup(upstream.Close)

	proxyHandler := proxy.NewHandler(
		config.Config{
			BaseDomain:               "echosphere.systems",
			FrontendRouteSubdomain:   "router",
			FrontendRouteDestination: upstream.URL,
		},
		emptyRouteStore{},
		log.New(io.Discard, "", 0),
	)
	apiHandler := &apiCaptureHandler{}
	dispatcher := NewDispatcher(apiHandler, proxyHandler)

	server := httptest.NewServer(dispatcher)
	t.Cleanup(server.Close)

	request, err := http.NewRequest(http.MethodGet, server.URL+"/dashboard", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	request.Host = "backend:3067"
	request.Header.Set("X-Forwarded-Host", "router.echosphere.systems")
	request.Header.Set("X-Forwarded-Proto", "https")

	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", response.StatusCode)
	}
	if string(body) != "frontend" {
		t.Fatalf("unexpected body: %q", string(body))
	}
	if apiHandler.called {
		t.Fatalf("local API should not have handled the automatic frontend route")
	}
}

func TestDispatcherFallsBackToLocalApiForUnroutedRequests(t *testing.T) {
	t.Parallel()

	proxyHandler := proxy.NewHandler(
		config.Config{BaseDomain: "echosphere.systems"},
		emptyRouteStore{},
		log.New(io.Discard, "", 0),
	)
	apiHandler := &apiCaptureHandler{}
	dispatcher := NewDispatcher(apiHandler, proxyHandler)

	server := httptest.NewServer(dispatcher)
	t.Cleanup(server.Close)

	request, err := http.NewRequest(http.MethodGet, server.URL+"/api/auth/me", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	request.Host = "proxy.internal"
	request.Header.Set("X-Forwarded-Proto", "https")

	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", response.StatusCode)
	}
	if string(body) != "api" {
		t.Fatalf("unexpected body: %q", string(body))
	}
	if !apiHandler.called {
		t.Fatalf("local API should have handled the unrouted request")
	}
}
