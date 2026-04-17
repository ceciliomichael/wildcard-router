# RouteGate Backend

The backend is the control plane and wildcard proxy for RouteGate.

It provides:

- MongoDB-backed route storage
- account login with session cookies
- admin and owner-scoped route management
- reverse proxying for enabled wildcard subdomains
- optional upstream TLS verification bypass for self-signed HTTPS services like Proxmox

## Why it matters

This project is designed for wildcard tunnel workflows, especially Cloudflare Tunnel.

Instead of creating one tunnel entry per subdomain, the backend lets you point a single wildcard domain at the catcher and then map each subdomain to its own destination.

That is useful when you want to retunnel or change destinations without rebuilding tunnel config for every service.

## Run

```bash
cd backend
go run ./cmd/routegate
```

Default listen port:

- `3067`

## Environment

Create `backend/.env`:

```env
WILDCARD_BASE_DOMAIN=echosphere.systems
PORT=3067
MONGODB_URI=mongodb://wc_root:replace-with-a-strong-password@localhost:27019/?authSource=admin
MONGODB_DATABASE=routegate
BOOTSTRAP_ADMIN_USERNAME=main-admin
BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-strong-password
BOOTSTRAP_ADMIN_NAME=Main Admin
SESSION_COOKIE_NAME=routegate_session
SESSION_TTL_HOURS=168
SESSION_COOKIE_SECURE=false
FRONTEND_ROUTE_SUBDOMAIN=routegate
FRONTEND_ROUTE_DESTINATION=http://frontend:3000
NON_ADMIN_BLOCKED_DESTINATION_HOSTS=localhost,127.0.0.1,::1,192.168.1.28
```

Notes:

- `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` are required on first startup so the initial admin account can be created.
- If MongoDB already contains an admin user, bootstrap credentials may be omitted.
- `SESSION_COOKIE_SECURE` should be `true` when the app is served over HTTPS.
- The backend reserves `FRONTEND_ROUTE_SUBDOMAIN` as an automatic route to the frontend service. By default it points `routegate` at `http://frontend:3000` inside Docker Compose.
- Non-admin users are blocked from saving routes to the reserved local hosts listed in `NON_ADMIN_BLOCKED_DESTINATION_HOSTS`. Admin users can use any destination except the reserved frontend subdomain.
- For local development, the backend usually talks to MongoDB on `localhost:27019`.
- In Docker Compose, the backend connects to `mongo:27019` inside the Docker network.

## Data Model

MongoDB collections:

- `users`
- `sessions`
- `routes`

`routes` are globally unique by subdomain. Admins can view all routes. Standard users can only manage routes they own.

## API

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Users

Admin only:

- `GET /api/users`
- `POST /api/users`

User creation generates a password server-side and returns it once in the response.

### Routes

Authenticated:

- `GET /api/routes`
- `POST /api/routes`
- `PUT /api/routes/{id}`
- `DELETE /api/routes/{id}`

## Proxy behavior

Requests to `<subdomain>.<WILDCARD_BASE_DOMAIN>`:

- redirect to HTTPS when the incoming request is not secure
- look up an enabled route in MongoDB
- proxy traffic to the stored destination
- return a browser-friendly `404` page when no enabled subdomain exists

The proxy forwards `X-Forwarded-Host` and `X-Forwarded-Proto` to upstream apps.
When a route is marked to skip upstream TLS verification, the backend will still proxy to `https://` origins but will not reject self-signed certs.

## Tunnel workflow

Typical setup:

1. Run the backend locally.
2. Expose the catcher once through your tunnel.
3. Point the wildcard tunnel at the catcher.
4. Add routes in the dashboard for each subdomain you want to serve.
5. Point each destination to the local frontend, another local service, or a hosted app.

That allows one wildcard tunnel to retarget many services without creating individual tunnel entries.

## Build and test

```bash
cd backend
go test ./...
go build ./cmd/routegate
```
