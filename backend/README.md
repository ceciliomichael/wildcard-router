# Wildcard Catcher Backend (Go)

Lightweight wildcard subdomain router using Go `net/http` + `httputil.ReverseProxy`.

## Current Routes

The server exposes:

- CRUD API: `/api/routes` (API key required)
- Catch-all wildcard proxy for all other paths

Wildcard proxy behavior:

- Any request with host `<subdomain>.<WILDCARD_BASE_DOMAIN>`:
  - looks up `subdomain` in `data/routes.json`
  - if found and enabled, proxies to the route destination
  - if not found, returns `404`
- Requests outside the base domain return `404`
- The proxy forwards `X-Forwarded-Host` and `X-Forwarded-Proto` to upstream apps so they can reconstruct the public hostname and scheme correctly behind tunnels or reverse proxies.
- Plain HTTP requests to wildcard subdomains are redirected to HTTPS, and secure requests receive an HSTS header.

Status behavior (proxy):

- `404` no matching route
- `500` registry or proxy configuration error
- `502` upstream destination unavailable

## Run

```bash
cd backend
go run ./cmd/wildcard-catcher
```

Default port is `3067`.

## Environment

Create `backend/.env` from `backend/.env.example`:

```env
WILDCARD_BASE_DOMAIN=echosphere.systems
PORT=3067
WILDCARD_REGISTRY_PATH=data/routes.json
ROUTES_API_KEY=replace-with-long-random-secret
TRUST_X_FORWARDED_HOST=true
```

Notes:

- `PORT` or `WILDCARD_PORT` can set listen port.
- If `WILDCARD_REGISTRY_PATH` is omitted, backend falls back to `data/routes.json` or `../data/routes.json`.
- `ROUTES_API_KEY` is required to access CRUD endpoints.
- `TRUST_X_FORWARDED_HOST` should be `true` only when behind a trusted proxy/tunnel.
- Env loading order:
  - `backend/.env`
  - `../.env` (repo root)

## API (CRUD)

All endpoints require either:

- `X-API-Key: <ROUTES_API_KEY>`, or
- `Authorization: Bearer <ROUTES_API_KEY>`

### List Routes

`GET /api/routes`

### Create Route

`POST /api/routes`

```json
{
  "subdomain": "portfolio",
  "destination": "http://localhost:3000",
  "enabled": true,
  "note": "optional"
}
```

### Update Route

`PUT /api/routes/{id}`

```json
{
  "subdomain": "portfolio",
  "destination": "http://localhost:3001",
  "enabled": true,
  "note": "updated note"
}
```

### Delete Route

`DELETE /api/routes/{id}`

Response codes:

- `200/201` success
- `204` delete success
- `400` invalid payload
- `401` missing/invalid API key
- `404` route not found
- `409` duplicate subdomain

## Registry File

Path example: `backend/data/routes.json`

```json
{
  "version": 1,
  "updatedAt": "2026-04-15T12:09:45.525Z",
  "routes": [
    {
      "id": "dfa1e8ff-e726-4365-8dd0-a7cf9078e6fc",
      "subdomain": "test",
      "destination": "http://localhost:3000",
      "enabled": true,
      "note": "terminal",
      "createdAt": "2026-04-15T11:15:19.691Z",
      "updatedAt": "2026-04-15T12:09:45.525Z"
    }
  ]
}
```

Validation rules:

- `version` must be `1`
- `destination` must be absolute `http://` or `https://`
- only `enabled: true` routes are eligible

## Cloudflare Tunnel

Point wildcard and admin hostnames to this backend:

- `admin.yourdomain.com` -> `http://localhost:3067`
- `*.yourdomain.com` -> `http://localhost:3067`

## Build

```bash
cd backend
go test ./...
go build ./cmd/wildcard-catcher
```
