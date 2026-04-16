# Wildcard Catcher Frontend

The frontend is the Next.js dashboard for managing routes, users, and authentication.

It is the UI layer for the catcher and talks to the backend through local API routes under `/api/*`.

## Purpose

This frontend exists so you can manage wildcard tunnel routes from a browser instead of editing backend data by hand.

It is especially useful when the backend is exposed once through a wildcard Cloudflare Tunnel and you want to:

- create or edit subdomain routes
- switch destinations without rebuilding tunnel config
- manage users and permissions
- keep the UI available even when the target services behind the routes are local
- mark upstream HTTPS services such as Proxmox to skip certificate verification when needed

## Run

```bash
cd frontend
npm install
npm run dev
```

Default dev port:

- `3000`

## Environment

The frontend expects the backend API to be available through one of these values:

- `BACKEND_API_BASE`
- `NEXT_PUBLIC_API_BASE`
- fallback: `http://localhost:3067`

Example local values:

```env
BACKEND_API_BASE=http://localhost:3067
NEXT_PUBLIC_API_BASE=http://localhost:3067
NEXT_ALLOWED_DEV_ORIGINS=
```

Notes:

- When running outside Docker, point the frontend at the backend on `localhost:3067`.
- When running in Docker Compose, the frontend can use `http://backend:3067` internally.
- For tunnel-based development, set `NEXT_ALLOWED_DEV_ORIGINS` to your tunnel host if needed.
- The frontend config already includes common tunnel domains used in development.
- The route editor includes an option for upstream TLS verification, which is useful for self-signed services.

## How the frontend works

- Page requests render the dashboard.
- Browser requests go to frontend route handlers under `/api/auth`, `/api/routes`, and `/api/users`.
- Those route handlers proxy to the Go backend.
- Auth state is session-based and uses browser cookies.

## Build and check

```bash
cd frontend
npm run lint
npm run build
```
