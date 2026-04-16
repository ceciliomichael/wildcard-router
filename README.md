# Wildcard Catcher

Wildcard Catcher is a subdomain router and admin dashboard for managing wildcard tunnel targets.

It exists so you can point a single wildcard domain or wildcard tunnel at the catcher, then route many subdomains to different local or remote services without recreating tunnel entries one by one.

## Why this project exists

The main use case is Cloudflare Tunnel with a wildcard setup.

Instead of manually creating a tunnel for every subdomain, you can:

1. Expose the catcher once.
2. Register routes in the dashboard.
3. Let the catcher proxy each subdomain to its destination.

That makes retunneling much easier when you want `*.your-domain.com` to keep working across multiple services, including a frontend running on localhost.

## What it does

- Stores routes in MongoDB
- Authenticates users with sessions
- Supports admin and standard user access
- Proxies enabled wildcard subdomains to their configured destinations
- Keeps the frontend and backend separate so each can be run independently
- Automatically serves the dashboard on the reserved `router` subdomain by default
- Can optionally skip upstream TLS verification for services like Proxmox that use self-signed HTTPS certificates

## Project layout

- `backend/` Go API, auth, route storage, and wildcard proxy
- `frontend/` Next.js dashboard and API bridge
- `docker-compose.yml` local stack for MongoDB, backend, and frontend

## Ports

Default local ports:

- `3000` frontend
- `3067` backend
- `27019` MongoDB when using the provided Compose stack

## Tunnel workflow

Typical flow:

1. Run the backend and frontend locally.
2. Expose the catcher with your tunnel.
3. Set the wildcard base domain in the backend config.
4. Create route records for the subdomains you want to serve.
5. Point each route destination at the local app or hosted service you want proxied.

The important part is that the wildcard tunnel goes to the catcher, not to each subdomain individually.

## Local development

See the component READMEs for the full setup details:

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

If you use Docker Compose, copy `.env.example` to `.env` and adjust the values for your machine.

## Notes

- The frontend uses the backend through its own API routes.
- The backend performs the actual wildcard proxying.
- Routes can be pointed at `https://` upstreams and, when needed, can skip upstream TLS verification for self-signed services.
- The backend reserves `router` for the frontend by default; you can override the subdomain or destination with `FRONTEND_ROUTE_SUBDOMAIN` and `FRONTEND_ROUTE_DESTINATION`.
- The dashboard hides the reserved `router` route and rejects attempts to create or edit it manually.
- For tunnel-based development, the frontend Next config includes dev-origin support for common tunnel hosts and a custom allowlist variable.
