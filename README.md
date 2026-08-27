# EZScout

Extensible form application — React SPA frontend, Fastify API, Postgres storage, Docker-containerized.

## Quick start

```sh
git clone https://github.com/TheCrackerSnacker/ezscout.git
cd ezscout
cp .env.example .env        # edit secrets before deploying
make install                 # npm ci
make dev                     # foreground, Ctrl-C stops everything
```

Web at `localhost:5173`, API at `localhost:3000`.

## Prerequisites

- **Node 22+**
- **Docker Desktop** (required for database, integration tests, e2e tests)

## Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start full stack in foreground (API + web + Postgres) |
| `make down` | Stop dev stack |
| `make logs` | Tail container logs |
| `make test` | Run all unit tests across workspaces (excludes e2e; use `test:e2e`) |
| `make lint` | Lint all packages (including e2e specs) |
| `make typecheck` | Typecheck all packages (including e2e specs) |
| `make test-integration` | Run API integration tests (requires Docker) |
| `make test-e2e` | Run Playwright e2e tests against test stack |
| `make build` | Build prod Docker images |
| `make deploy` | Build and start prod stack |
| `make db-shell` | Open psql shell on dev database |
| `make studio` | Open Drizzle Studio |

Single-package runs:

```sh
npm test -w @ezscout/web       # or api, shared
npm run lint -w @ezscout/api
```

## Project structure

```
ezscout/
  apps/
    api/          Fastify 5 + Drizzle ORM backend
    web/          React 19 + Vite SPA (PWA-enabled)
    e2e/          Playwright end-to-end tests
  packages/
    shared/       Zod schemas shared between API and web
  docker/         Dockerfiles and nginx config
  docker-compose.yml         Dev stack
  docker-compose.prod.yml    Production stack
  docker-compose.test.yml    E2E test stack (isolated)
```

## Environment variables

Copy `.env.example` to `.env`. All variables have sensible dev defaults.

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Postgres username | `ezscout` |
| `POSTGRES_PASSWORD` | Postgres password | `ezscout` |
| `POSTGRES_DB` | Postgres database name | `ezscout` |
| `HOST_PG_PORT` | Host port mapped to Postgres | `5432` |
| `HOST_API_PORT` | Host port mapped to API | `3000` |
| `HOST_WEB_PORT` | Host port mapped to web dev server | `5173` |
| `HOST_PROD_PORT` | Host port mapped to prod nginx | `8080` |
| `PORT` | API listen port (inside container) | `3000` |
| `DATABASE_URL` | Full Postgres connection string | `postgres://ezscout:change-me@localhost:5432/ezscout` |
| `ADMIN_PASSWORD` | Single admin password for form management | `admin-dev-password` (dev) |
| `SESSION_KEY` | Secret for signed session cookies (min 32 chars) | `dev-session-key-please-change-me-32+` (dev) |
| `COOKIE_SECURE` | Set `true` when the API is served behind TLS | `false` |
| `LOGIN_RATE_LIMIT` | Max admin login attempts per minute per IP | `20` |

## Architecture

### Question types

Each question type is a **zod discriminated union** in `packages/shared` paired with a React component in `apps/web/src/questions/registry.tsx`. The API validates against the shared schemas — the web app renders via the registry. Adding a new type means: new schema, new component, new registry entry, tests.

Supported types: `text`, `textarea`, `number`, `radio`, `checkbox`.

### Immutable form snapshots

When a form is published (`POST /api/forms/:id/publish`), the definition is copied into `form_versions(form_id, version)` with a composite primary key. Responses FK to `(form_id, version)`. Published versions are never edited — republishing creates the next version.

### Offline-first PWA

The web app works offline via a service worker (Workbox), IndexedDB outbox (Dexie), and a sync engine:

1. When offline, submissions queue in IndexedDB
2. A pending count badge appears in the nav
3. On reconnection (or every 5s), the outbox drains to `POST /api/responses`
4. Entries older than 6 hours are dropped; failed entries use exponential backoff (max 10 retries)

### Admin auth

All admin routes are protected by a single `ADMIN_PASSWORD`. The session is a signed cookie (`@fastify/secure-session`). Unset password keeps admin routes fail-closed (503). Login is rate-limited (20 attempts/min). Admin mutations also require a CSRF token (issued at login/session, echoed in the `X-CSRF-Token` header) — defense in depth on top of the cookie's `SameSite=Lax`.

## Testing

### Unit tests

```sh
make test
```

Runs vitest across all workspaces. Web tests use jsdom; API tests use Fastify's `app.inject()`.

### Integration tests

```sh
make test-integration
```

Requires Docker running. Uses Testcontainers to spin up a Postgres container. Tests the full API flow: auth, CRUD, form publishing, response ingestion. **Silently skips if Docker is unavailable** — check output for passing tests, not just a green exit.

### E2E tests

```sh
make test-e2e
```

Spins up an isolated test stack (`docker-compose.test.yml` on port 8081) and runs Playwright against Chromium. Covers: home page, admin auth, admin CRUD, form submission, validation, offline behavior, navigation.

## Ports

| Service | Dev | Prod | E2E Test |
|---------|-----|------|----------|
| Web | 5173 | 8080 | 8081 |
| API | 3000 | 3000 (internal) | 3000 (internal) |
| Postgres | 5432 | 5432 (internal) | 5432 (internal) |
