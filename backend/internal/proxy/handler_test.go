package proxy

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"wildcard-catcher/internal/config"
	"wildcard-catcher/internal/registry"
)

type stubRouteStore struct {
	routes map[string]registry.Route
}

func (s stubRouteStore) Lookup(subdomain string) (registry.Route, bool, error) {
	route, ok := s.routes[subdomain]
	return route, ok, nil
}

type capturedRequest struct {
	Host           string
	ForwardedHost  string
	ForwardedProto string
	Method         string
	Path           string
}

func TestHandlerRoutesMultipleSubdomainsConcurrently(t *testing.T) {
	t.Parallel()

	firstCapture := newCaptureServer(t, "first-upstream")
	secondCapture := newCaptureServer(t, "second-upstream")

	handler := NewHandler(
		config.Config{BaseDomain: "echosphere.systems", TrustForwardedHost: true},
		stubRouteStore{routes: map[string]registry.Route{
			"subdomain1": {
				ID:          "route-1",
				Subdomain:   "subdomain1",
				Destination: firstCapture.URL,
				Enabled:     true,
			},
			"subdomain2": {
				ID:          "route-2",
				Subdomain:   "subdomain2",
				Destination: secondCapture.URL,
				Enabled:     true,
			},
		}},
		log.New(io.Discard, "", 0),
	)

	proxyServer := httptest.NewServer(handler)
	t.Cleanup(proxyServer.Close)

	type testCase struct {
		host     string
		wantBody string
		capture  *capturingServer
	}

	testCases := []testCase{
		{
			host:     "subdomain1.echosphere.systems",
			wantBody: "first-upstream",
			capture:  firstCapture,
		},
		{
			host:     "subdomain2.echosphere.systems",
			wantBody: "second-upstream",
			capture:  secondCapture,
		},
	}

	start := make(chan struct{})
	var wg sync.WaitGroup
	errCh := make(chan error, len(testCases))

	for _, testCase := range testCases {
		testCase := testCase
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start

			request, err := http.NewRequest(http.MethodGet, proxyServer.URL+"/dashboard", nil)
			if err != nil {
				errCh <- err
				return
			}

			request.Host = "proxy.internal"
			request.Header.Set("X-Forwarded-Host", testCase.host)
			request.Header.Set("X-Forwarded-Proto", "https")

			response, err := proxyServer.Client().Do(request)
			if err != nil {
				errCh <- err
				return
			}
			defer response.Body.Close()

			body, err := io.ReadAll(response.Body)
			if err != nil {
				errCh <- err
				return
			}

			if response.StatusCode != http.StatusOK {
				errCh <- fmt.Errorf("unexpected status for %s: %d", testCase.host, response.StatusCode)
				return
			}
			if string(body) != testCase.wantBody {
				errCh <- fmt.Errorf("unexpected body for %s: %q", testCase.host, string(body))
				return
			}

			captured, err := testCase.capture.waitForRequest()
			if err != nil {
				errCh <- err
				return
			}
			if captured.Host != testCase.capture.expectedHost() {
				errCh <- fmt.Errorf("unexpected upstream host for %s: %s", testCase.host, captured.Host)
				return
			}
			if captured.ForwardedHost != testCase.host {
				errCh <- fmt.Errorf("unexpected X-Forwarded-Host for %s: %s", testCase.host, captured.ForwardedHost)
				return
			}
			if captured.ForwardedProto != "https" {
				errCh <- fmt.Errorf("unexpected X-Forwarded-Proto for %s: %s", testCase.host, captured.ForwardedProto)
				return
			}
			if captured.Path != "/dashboard" {
				errCh <- fmt.Errorf("unexpected upstream path for %s: %s", testCase.host, captured.Path)
				return
			}
			errCh <- nil
		}()
	}

	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestHandlerRedirectsPlainHTTPSubdomainToHTTPS(t *testing.T) {
	t.Parallel()

	handler := NewHandler(
		config.Config{BaseDomain: "echosphere.systems", TrustForwardedHost: true},
		stubRouteStore{routes: map[string]registry.Route{}},
		log.New(io.Discard, "", 0),
	)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "http://proxy.internal/dashboard?tab=routes", nil)
	request.Host = "proxy.internal"
	request.Header.Set("X-Forwarded-Host", "subdomain1.echosphere.systems")

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMovedPermanently {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}
	if location := recorder.Header().Get("Location"); location != "https://subdomain1.echosphere.systems/dashboard?tab=routes" {
		t.Fatalf("unexpected redirect location: %s", location)
	}
}

func TestHandlerSetsHSTSOnSecureSubdomainRequests(t *testing.T) {
	t.Parallel()

	upstream := newCaptureServer(t, "ok")
	handler := NewHandler(
		config.Config{BaseDomain: "echosphere.systems", TrustForwardedHost: true},
		stubRouteStore{routes: map[string]registry.Route{
			"subdomain1": {
				ID:          "route-1",
				Subdomain:   "subdomain1",
				Destination: upstream.URL,
				Enabled:     true,
			},
		}},
		log.New(io.Discard, "", 0),
	)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "http://proxy.internal/dashboard", nil)
	request.Host = "proxy.internal"
	request.Header.Set("X-Forwarded-Host", "subdomain1.echosphere.systems")
	request.Header.Set("X-Forwarded-Proto", "https")

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}
	if hsts := recorder.Header().Get("Strict-Transport-Security"); hsts != "max-age=31536000; includeSubDomains" {
		t.Fatalf("unexpected hsts header: %s", hsts)
	}
}

type capturingServer struct {
	*httptest.Server
	requestCh chan capturedRequest
	urlHost   string
}

func newCaptureServer(t *testing.T, body string) *capturingServer {
	t.Helper()

	server := &capturingServer{requestCh: make(chan capturedRequest, 1)}
	handler := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		server.requestCh <- capturedRequest{
			Host:           request.Host,
			ForwardedHost:  request.Header.Get("X-Forwarded-Host"),
			ForwardedProto: request.Header.Get("X-Forwarded-Proto"),
			Method:         request.Method,
			Path:           request.URL.Path,
		}
		writer.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(writer, body)
	})

	server.Server = httptest.NewServer(handler)
	server.urlHost = mustURLHost(t, server.URL)
	t.Cleanup(server.Close)
	return server
}

func (s *capturingServer) expectedHost() string {
	return s.urlHost
}

func (s *capturingServer) waitForRequest() (capturedRequest, error) {
	select {
	case request := <-s.requestCh:
		return request, nil
	case <-time.After(2 * time.Second):
		return capturedRequest{}, fmt.Errorf("timed out waiting for upstream request")
	}
}

func mustURLHost(t *testing.T, rawURL string) string {
	t.Helper()

	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}

	return parsed.Host
}
