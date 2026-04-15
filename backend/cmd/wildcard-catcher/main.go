package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"wildcard-catcher/internal/api"
	"wildcard-catcher/internal/config"
	"wildcard-catcher/internal/envfile"
	"wildcard-catcher/internal/proxy"
	"wildcard-catcher/internal/registry"
)

func main() {
	loadEnv()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	store := registry.NewStore(cfg.RegistryPath)
	proxyHandler := proxy.NewHandler(cfg, store, log.Default())
	apiHandler := api.NewRoutesHandler(store, log.Default(), cfg.APIKey)

	mux := http.NewServeMux()
	mux.Handle("/api/routes", apiHandler)
	mux.Handle("/api/routes/", apiHandler)
	mux.Handle("/", proxyHandler)

	server := &http.Server{
		Addr:              cfg.ListenAddress(),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	log.Printf("wildcard-catcher backend listening on %s", cfg.ListenAddress())
	log.Printf("base domain: %s", cfg.BaseDomain)
	log.Printf("registry path: %s", cfg.RegistryPath)
	log.Printf("trust x-forwarded-host: %t", cfg.TrustForwardedHost)

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server stopped: %v", err)
	}
}

func loadEnv() {
	cwd, err := os.Getwd()
	if err != nil {
		return
	}

	candidates := []string{
		filepath.Join(cwd, ".env"),
		filepath.Join(cwd, "..", ".env"),
	}

	_ = envfile.Load(candidates...)
}
