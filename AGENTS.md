# AGENTS.md

## Stack & layout

npm-workspaces monorepo. `apps/web` = React 19 + Vite SPA (jsdom-tested). `apps/api` = Fastify 5 + Drizzle ORM on Postgres. `packages/shared` = zod schemas consumed by **both** apps — it ships raw TS source (`main: ./src/index.ts`, no build step); each app's toolchain transpiles it.

Toolchain versions are unusual: **TypeScript 7**, zod 4 (`z.uuid()`, two-arg `z.record()`), ESLint 10 flat config, vitest 4. Don't "fix" imports/configs to older idioms.

## Commands

```sh
make dev          # foreground, Ctrl-C stops the whole stack; use `docker compose up -d --build` for detached
make lint && make typecheck && make test    # full verification order; run all three before finishing work
npm test -w @ezscout/web                    # single-package anything: -w @ezscout/{api,web,shared}
npm run test:integration -w @ezscout/api    # Testcontainers Postgres; needs Docker Desktop RUNNING
```

Ports: web 5173 · api 3000 · prod nginx 8080 · postgres 5432 (dev) / 5433 (integration).

## Testing gotchas

- **Integration tests silently SKIP if the Docker engine is unreachable** — a green run may mean nothing ran. Check output shows tests passing, not skipped. Suite lives in `apps/api/tests/integration/**` with its own `vitest.integration.config.ts` (`fileParallelism: false`).
- Unit scope is `tests/*.test.ts` only (api) / `tests/**` (web, shared) — keep suites in the right config or they won't run.
- `apps/web/vite.config.ts` doubles as the vitest config (dev server + jsdom test env). It must import `defineConfig` from `"vitest/config"` or `tsc --noEmit` fails.

## Architecture rules

- **Question types are a discriminated union + registry pair.** Adding one means: new schema in `packages/shared/src/questions/`, export it from that folder's `index.ts`, add component + entry in `apps/web/src/questions/registry.tsx`, and fixtures/tests. The API validates only what shared validates.
- **Published forms are immutable snapshots.** `POST /forms/:id/publish` copies the definition into `form_versions(form_id, version)` (composite PK); responses FK to `(form_id, version)`. Never edit a published version's row — publish creates the next version instead. Schema changes require regenerating `apps/api/drizzle/` via `npm run db:generate -w @ezscout/api`.
- **Response endpoint contract:** `POST /api/responses` is envelope-only: `{ responses: [...] }` (1–100 items, `BATCH_LIMIT` in shared) → HTTP 200 `{ results: [{ index, id?, status: "accepted" | "duplicate" | "rejected", reason?, issues? }] }`. Per-item problems are `rejected` entries (`invalid_payload`, `unknown_form_version`, `validation_failed`); only malformed envelopes get 400. Idempotency comes from the client-generated UUID primary key + `ON CONFLICT DO NOTHING`; a single submission is just a batch of size 1 (one shared `processSubmissions` core).
- **Admin surface is auth-gated and fail-closed.** All mutations (`POST /api/forms`, `/publish`, `PUT /api/forms/:id/definition`) plus `/api/admin/*` require a signed session cookie minted by `POST /api/admin/login` against the single `ADMIN_PASSWORD` env. Unset password → login 503, mutations 401/503; never weaken this for tests — integration tests inject credentials via `buildApp` options instead.
- Public GET contract is codified as `PublicFormSchema` in shared; API and web must parse through it.

## Environment quirks

- Dev shell is **Windows PowerShell 5.1**: no `&&` (use `;` / `if ($?) { ... }`), and use `Invoke-RestMethod` (not `-WebRequest`) for API smoke calls; POSTs need explicit `-ContentType "application/json"` even with `{}` bodies.
- The dev api container runs `tsx watch`, but it can serve **stale code after a failed reload** (e.g. deleting/renaming modules mid-edit) while `/api/health` still responds — if live behavior contradicts source, `docker compose restart api` before debugging anything else.
- react-hooks plugin v7 errors on synchronous `setState` inside effect bodies — remount children via `key={...}` (see `FormLoader` usage in `App.tsx`) instead of resetting state in an effect.
- The deliberate `any` hub for renderer props is `apps/web/src/questions/types.ts` (eslint override); don't spread `any` elsewhere.
