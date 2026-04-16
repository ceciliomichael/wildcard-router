package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"wildcard-catcher/internal/api"
	"wildcard-catcher/internal/config"
	"wildcard-catcher/internal/envfile"
	"wildcard-catcher/internal/identity"
	"wildcard-catcher/internal/proxy"
	"wildcard-catcher/internal/registry"
	"wildcard-catcher/internal/server"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	loadEnv()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatalf("connect mongodb: %v", err)
	}
	defer func() {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = client.Disconnect(shutdownCtx)
	}()

	db := client.Database(cfg.MongoDatabase)
	routeStore := registry.NewStore(db)
	identityStore := identity.NewStore(db)

	if err := identityStore.EnsureIndexes(ctx); err != nil {
		log.Fatalf("ensure identity indexes: %v", err)
	}
	if err := routeStore.EnsureIndexes(ctx); err != nil {
		log.Fatalf("ensure route indexes: %v", err)
	}
	if err := identityStore.BackfillUsernames(ctx); err != nil {
		log.Fatalf("backfill usernames: %v", err)
	}
	if err := identityStore.EnsureBootstrapAdmin(
		ctx,
		cfg.BootstrapAdminUsername,
		cfg.BootstrapAdminPassword,
		cfg.BootstrapAdminName,
	); err != nil {
		log.Fatalf("bootstrap admin error: %v", err)
	}

	proxyHandler := proxy.NewHandler(cfg, routeStore, log.Default())
	apiHandler := api.NewHandler(routeStore, identityStore, log.Default(), cfg)
	dispatcher := server.NewDispatcher(apiHandler, proxyHandler)

	httpServer := &http.Server{
		Addr:              cfg.ListenAddress(),
		Handler:           dispatcher,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	log.Printf("wildcard-catcher backend listening on %s", cfg.ListenAddress())
	log.Printf("base domain: %s", cfg.BaseDomain)
	log.Printf("mongodb: %s", sanitizeMongoURI(cfg.MongoURI, cfg.MongoDatabase))

	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
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

func sanitizeMongoURI(rawURI string, database string) string {
	parsed, err := url.Parse(rawURI)
	if err != nil || parsed.Host == "" {
		return database
	}

	return parsed.Host + "/" + database
}
