package proxy

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"

	"routegate/internal/config"
	"routegate/internal/registry"
)

type routeLookupStore interface {
	Lookup(subdomain string) (registry.Route, bool, error)
}

type Handler struct {
	cfg    config.Config
	store  routeLookupStore
	logger *log.Logger

	mu      sync.RWMutex
	proxies map[string]*httputil.ReverseProxy
}

func NewHandler(cfg config.Config, store routeLookupStore, logger *log.Logger) *Handler {
	return &Handler{
		cfg:     cfg,
		store:   store,
		logger:  logger,
		proxies: make(map[string]*httputil.ReverseProxy),
	}
}

func (h *Handler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	handled, _ := h.TryServe(writer, request)
	if !handled {
		http.NotFound(writer, request)
	}
}

func (h *Handler) TryServe(writer http.ResponseWriter, request *http.Request) (bool, error) {
	host, subdomain, ok := h.resolveRouteTarget(request)
	if !ok {
		if normalizeHost(request.Host) == "" {
			http.Error(writer, "host header required", http.StatusBadRequest)
			return true, nil
		}
		return false, nil
	}

	if !isSecureRequest(request) {
		redirectToHTTPS(writer, request, host)
		return true, nil
	}

	setStrictTransportSecurity(writer)
	request.Host = host

	if fallbackRoute, fallbackFound := h.defaultFrontendRoute(subdomain); fallbackFound {
		route := fallbackRoute
		proxy, err := h.proxyFor(route.Destination, route.InsecureSkipTLSVerify)
		if err != nil {
			h.logger.Printf("proxy setup failed for destination=%s: %v", route.Destination, err)
			http.Error(writer, "proxy configuration error", http.StatusInternalServerError)
			return true, err
		}

		h.logger.Printf("%s %s host=%s subdomain=%s -> %s", request.Method, request.URL.Path, host, subdomain, route.Destination)
		proxy.ServeHTTP(writer, request)
		return true, nil
	}

	route, found, err := h.store.Lookup(subdomain)
	if err != nil {
		h.logger.Printf("registry lookup failed for host=%s subdomain=%s: %v", host, subdomain, err)
		http.Error(writer, "registry error", http.StatusInternalServerError)
		return true, err
	}

	if !found {
		h.writeMissingRoutePage(writer, request, host, subdomain)
		return true, nil
	}

	proxy, err := h.proxyFor(route.Destination, route.InsecureSkipTLSVerify)
	if err != nil {
		h.logger.Printf("proxy setup failed for destination=%s: %v", route.Destination, err)
		http.Error(writer, "proxy configuration error", http.StatusInternalServerError)
		return true, err
	}

	h.logger.Printf("%s %s host=%s subdomain=%s -> %s", request.Method, request.URL.Path, host, subdomain, route.Destination)
	proxy.ServeHTTP(writer, request)
	return true, nil
}

func (h *Handler) HasRoute(request *http.Request) (bool, error) {
	_, subdomain, ok := h.resolveRouteTarget(request)
	if !ok {
		return false, nil
	}

	_, found, err := h.store.Lookup(subdomain)
	if err != nil {
		return false, err
	}
	if found {
		return true, nil
	}

	_, fallbackFound := h.defaultFrontendRoute(subdomain)
	return fallbackFound, nil
}

func (h *Handler) resolveRouteTarget(request *http.Request) (string, string, bool) {
	if host := normalizeHost(request.Host); host != "" {
		if subdomain, ok := extractSubdomain(host, h.cfg.BaseDomain); ok {
			return host, subdomain, true
		}
	}

	if forwardedHost := normalizeHost(extractForwardedHost(request)); forwardedHost != "" {
		if subdomain, ok := extractSubdomain(forwardedHost, h.cfg.BaseDomain); ok {
			return forwardedHost, subdomain, true
		}
	}

	return "", "", false
}

func (h *Handler) defaultFrontendRoute(subdomain string) (registry.Route, bool) {
	if strings.TrimSpace(h.cfg.FrontendRouteSubdomain) == "" || strings.TrimSpace(h.cfg.FrontendRouteDestination) == "" {
		return registry.Route{}, false
	}
	if !strings.EqualFold(strings.TrimSpace(subdomain), strings.TrimSpace(h.cfg.FrontendRouteSubdomain)) {
		return registry.Route{}, false
	}

	return registry.Route{
		Subdomain:   strings.TrimSpace(h.cfg.FrontendRouteSubdomain),
		Destination: strings.TrimSpace(h.cfg.FrontendRouteDestination),
		Enabled:     true,
	}, true
}

func extractForwardedHost(request *http.Request) string {
	forwardedHost := request.Header.Get("X-Forwarded-Host")
	if forwardedHost == "" {
		return ""
	}
	firstHost, _, _ := strings.Cut(forwardedHost, ",")
	return firstHost
}

func (h *Handler) proxyFor(destination string, insecureSkipTLSVerify bool) (*httputil.ReverseProxy, error) {
	normalizedDestination, err := registry.NormalizeDestination(destination)
	if err != nil {
		return nil, fmt.Errorf("invalid destination URL: %w", err)
	}
	key := proxyCacheKey(normalizedDestination, insecureSkipTLSVerify)

	h.mu.RLock()
	if existing, ok := h.proxies[key]; ok {
		h.mu.RUnlock()
		return existing, nil
	}
	h.mu.RUnlock()

	target, err := url.Parse(normalizedDestination)
	if err != nil {
		return nil, fmt.Errorf("invalid destination URL: %w", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	if insecureSkipTLSVerify {
		proxy.Transport = insecureSkipVerifyTransport()
	}

	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalHost := request.Host
		originalDirector(request)
		request.Host = target.Host
		request.Header.Set("X-Forwarded-Host", originalHost)
		if forwardedProto := strings.TrimSpace(request.Header.Get("X-Forwarded-Proto")); forwardedProto == "" {
			if request.TLS != nil {
				request.Header.Set("X-Forwarded-Proto", "https")
			} else {
				request.Header.Set("X-Forwarded-Proto", "http")
			}
		}
	}
	proxy.ErrorHandler = func(writer http.ResponseWriter, request *http.Request, err error) {
		h.logger.Printf("upstream error for %s: %v", normalizedDestination, err)
		http.Error(writer, "upstream unavailable", http.StatusBadGateway)
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	h.proxies[key] = proxy
	return proxy, nil
}

func proxyCacheKey(destination string, insecureSkipTLSVerify bool) string {
	return fmt.Sprintf("%s|insecureTLS=%t", strings.TrimSpace(destination), insecureSkipTLSVerify)
}

func insecureSkipVerifyTransport() *http.Transport {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	return transport
}

func normalizeHost(rawHost string) string {
	host := strings.ToLower(strings.TrimSpace(rawHost))
	host = strings.TrimSuffix(host, ".")
	if colon := strings.IndexByte(host, ':'); colon >= 0 {
		host = host[:colon]
	}
	return host
}

func extractSubdomain(host string, baseDomain string) (string, bool) {
	base := normalizeHost(baseDomain)
	if base == "" || host == "" {
		return "", false
	}
	if host == base {
		return "", false
	}

	suffix := "." + base
	if !strings.HasSuffix(host, suffix) {
		return "", false
	}

	subdomain := strings.TrimSuffix(host, suffix)
	if subdomain == "" {
		return "", false
	}

	return subdomain, true
}

func isSecureRequest(request *http.Request) bool {
	if request.TLS != nil {
		return true
	}

	if forwardedProto := strings.TrimSpace(request.Header.Get("X-Forwarded-Proto")); forwardedProto != "" {
		firstProto, _, _ := strings.Cut(forwardedProto, ",")
		if strings.EqualFold(strings.TrimSpace(firstProto), "https") {
			return true
		}
	}

	if strings.EqualFold(strings.TrimSpace(request.Header.Get("X-Forwarded-Ssl")), "on") {
		return true
	}

	if strings.EqualFold(strings.TrimSpace(request.Header.Get("Front-End-Https")), "on") {
		return true
	}

	return false
}

func setStrictTransportSecurity(writer http.ResponseWriter) {
	writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
}

func redirectToHTTPS(writer http.ResponseWriter, request *http.Request, host string) {
	target := &url.URL{
		Scheme:   "https",
		Host:     host,
		Path:     request.URL.Path,
		RawQuery: request.URL.RawQuery,
	}
	http.Redirect(writer, request, target.String(), http.StatusMovedPermanently)
}
