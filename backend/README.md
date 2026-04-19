# RouteGate Backend

The backend is the RouteGate control plane API.

It provides:

- MongoDB-backed route storage
- account login with session cookies
- admin and owner-scoped route management
- user management and bootstrap admin setup

Wildcard subdomain proxying is now handled by `router/`.

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
NON_ADMIN_BLOCKED_DESTINATION_HOSTS=localhost,127.0.0.1,::1,192.168.1.28
```

Notes:

- `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` are required on first startup so the initial admin account can be created.
- If MongoDB already contains an admin user, bootstrap credentials may be omitted.
- `SESSION_COOKIE_SECURE` should be `true` when the app is served over HTTPS.
- The backend reserves `FRONTEND_ROUTE_SUBDOMAIN` from route CRUD so users cannot overwrite the frontend wildcard entry used by the router.
- Non-admin users are blocked from saving routes to the reserved local hosts listed in `NON_ADMIN_BLOCKED_DESTINATION_HOSTS`.
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
- `GET /api/routes/availability?subdomain={value}`
- `POST /api/routes`
- `PUT /api/routes/{id}`
- `DELETE /api/routes/{id}`

## Build and test

```bash
cd backend
go test ./...
go build ./cmd/routegate
```
