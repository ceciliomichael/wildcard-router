package api

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"wildcard-catcher/internal/registry"
)

type RoutesHandler struct {
	store  *registry.Store
	logger *log.Logger
	apiKey string
}

func NewRoutesHandler(store *registry.Store, logger *log.Logger, apiKey string) *RoutesHandler {
	return &RoutesHandler{
		store:  store,
		logger: logger,
		apiKey: apiKey,
	}
}

func (h *RoutesHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if !h.authorize(request) {
		h.writeError(writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	switch {
	case request.URL.Path == "/api/routes" || request.URL.Path == "/api/routes/":
		h.handleCollection(writer, request)
		return
	case strings.HasPrefix(request.URL.Path, "/api/routes/"):
		h.handleItem(writer, request)
		return
	default:
		h.writeError(writer, http.StatusNotFound, "not found")
		return
	}
}

func (h *RoutesHandler) handleCollection(writer http.ResponseWriter, request *http.Request) {
	switch request.Method {
	case http.MethodGet:
		routes, err := h.store.List()
		if err != nil {
			h.logger.Printf("list routes failed: %v", err)
			h.writeError(writer, http.StatusInternalServerError, "failed to list routes")
			return
		}
		h.writeJSON(writer, http.StatusOK, map[string]any{
			"routes": routes,
		})
	case http.MethodPost:
		var payload registry.CreateRouteInput
		if err := decodeBody(request, &payload); err != nil {
			h.writeError(writer, http.StatusBadRequest, err.Error())
			return
		}

		route, err := h.store.Create(payload)
		if err != nil {
			status := http.StatusBadRequest
			if strings.Contains(strings.ToLower(err.Error()), "already exists") {
				status = http.StatusConflict
			}
			h.writeError(writer, status, err.Error())
			return
		}

		h.writeJSON(writer, http.StatusCreated, route)
	default:
		h.writeMethodNotAllowed(writer, http.MethodGet, http.MethodPost)
	}
}

func (h *RoutesHandler) handleItem(writer http.ResponseWriter, request *http.Request) {
	id := strings.TrimPrefix(request.URL.Path, "/api/routes/")
	id = strings.TrimSpace(strings.Trim(id, "/"))
	if id == "" || strings.ContainsRune(id, '/') {
		h.writeError(writer, http.StatusNotFound, "not found")
		return
	}

	switch request.Method {
	case http.MethodPut:
		var payload registry.UpdateRouteInput
		if err := decodeBody(request, &payload); err != nil {
			h.writeError(writer, http.StatusBadRequest, err.Error())
			return
		}

		route, err := h.store.Update(id, payload)
		if err != nil {
			switch {
			case strings.Contains(strings.ToLower(err.Error()), "not found"):
				h.writeError(writer, http.StatusNotFound, err.Error())
			case strings.Contains(strings.ToLower(err.Error()), "already exists"):
				h.writeError(writer, http.StatusConflict, err.Error())
			default:
				h.writeError(writer, http.StatusBadRequest, err.Error())
			}
			return
		}

		h.writeJSON(writer, http.StatusOK, route)
	case http.MethodDelete:
		if err := h.store.Delete(id); err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "not found") {
				h.writeError(writer, http.StatusNotFound, err.Error())
				return
			}
			h.writeError(writer, http.StatusBadRequest, err.Error())
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	default:
		h.writeMethodNotAllowed(writer, http.MethodPut, http.MethodDelete)
	}
}

func (h *RoutesHandler) authorize(request *http.Request) bool {
	candidate := strings.TrimSpace(request.Header.Get("X-API-Key"))
	if candidate == "" {
		auth := strings.TrimSpace(request.Header.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
			candidate = strings.TrimSpace(auth[7:])
		}
	}

	if candidate == "" || h.apiKey == "" {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(candidate), []byte(h.apiKey)) == 1
}

func (h *RoutesHandler) writeMethodNotAllowed(writer http.ResponseWriter, allowed ...string) {
	writer.Header().Set("Allow", strings.Join(allowed, ", "))
	h.writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
}

func (h *RoutesHandler) writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(payload)
}

func (h *RoutesHandler) writeError(writer http.ResponseWriter, status int, message string) {
	h.writeJSON(writer, status, map[string]string{
		"error": message,
	})
}

func decodeBody(request *http.Request, target any) error {
	if request.Body == nil {
		return errors.New("request body is required")
	}

	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	if decoder.More() {
		return errors.New("request body must contain a single JSON object")
	}

	return nil
}
