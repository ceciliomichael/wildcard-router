package proxy

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	"routegate-router/internal/config"
	"routegate-router/internal/registry"
)

type routeLookupStore interface {
	Lookup(subdomain string) (registry.Route, bool, error)
	List(ctx context.Context) ([]registry.Route, error)
}

type Handler struct {
	cfg    config.Config
	store  routeLookupStore
	logger *log.Logger
	cache  *routeCache

	mu      sync.RWMutex
	proxies map[string]*httputil.ReverseProxy
}

func NewHandler(cfg config.Config, store routeLookupStore, logger *log.Logger) *Handler {
	if logger == nil {
		logger = log.Default()
	}

	return &Handler{
		cfg:     cfg,
		store:   store,
		logger:  logger,
		cache:   newRouteCache(),
		proxies: make(map[string]*httputil.ReverseProxy),
	}
}

func (h *Handler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	host, subdomain, ok := h.resolveRouteTarget(request)
	if !ok {
		if normalizeHost(request.Host) == "" {
			http.Error(writer, "host header required", http.StatusBadRequest)
			return
		}
		http.NotFound(writer, request)
		return
	}

	if !isSecureRequest(request) {
		redirectToHTTPS(writer, request, host)
		return
	}

	setStrictTransportSecurity(writer)
	request.Host = host

	if fallbackRoute, fallbackFound := h.defaultFrontendRoute(subdomain); fallbackFound {
		h.serveRoute(writer, request, host, subdomain, fallbackRoute)
		return
	}

	route, found, err := h.store.Lookup(subdomain)
	if err != nil {
		h.logger.Printf("registry lookup failed for host=%s subdomain=%s: %v", host, subdomain, err)
		if cachedRoute, cachedFound := h.cache.lookup(subdomain); cachedFound {
			h.logger.Printf("serving cached route for host=%s subdomain=%s", host, subdomain)
			h.serveRoute(writer, request, host, subdomain, cachedRoute)
			return
		}
		http.Error(writer, "registry error", http.StatusInternalServerError)
		return
	}

	if !found {
		h.writeMissingRoutePage(writer, request, host, subdomain)
		return
	}

	h.serveRoute(writer, request, host, subdomain, route)
}

func (h *Handler) RefreshCache(ctx context.Context) error {
	if h.store == nil {
		return nil
	}

	routes, err := h.store.List(ctx)
	if err != nil {
		return err
	}

	h.cache.replace(routes)
	return nil
}

func (h *Handler) StartCacheRefresher(ctx context.Context, interval time.Duration) {
	if h.store == nil || interval <= 0 {
		return
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				refreshCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
				if err := h.RefreshCache(refreshCtx); err != nil {
					h.logger.Printf("route cache refresh failed: %v", err)
				}
				cancel()
			}
		}
	}()
}

func (h *Handler) serveRoute(
	writer http.ResponseWriter,
	request *http.Request,
	host string,
	subdomain string,
	route registry.Route,
) {
	proxy, err := h.proxyFor(route.Destination, route.InsecureSkipTLSVerify)
	if err != nil {
		h.logger.Printf("proxy setup failed for destination=%s: %v", route.Destination, err)
		http.Error(writer, "proxy configuration error", http.StatusInternalServerError)
		return
	}

	h.logger.Printf("%s %s host=%s subdomain=%s -> %s", request.Method, request.URL.Path, host, subdomain, route.Destination)
	proxy.ServeHTTP(writer, request)
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
	proxy.Transport = newUpstreamTransport(insecureSkipTLSVerify)

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
		displayHost := normalizeHost(extractForwardedHost(request))
		if displayHost == "" {
			displayHost = normalizeHost(request.Host)
		}
		h.writeMaintenancePage(writer, displayHost)
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	h.proxies[key] = proxy
	return proxy, nil
}

func proxyCacheKey(destination string, insecureSkipTLSVerify bool) string {
	return fmt.Sprintf("%s|insecureTLS=%t", strings.TrimSpace(destination), insecureSkipTLSVerify)
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
