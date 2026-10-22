# Overworked

Feierabend-Wecker (not time tracking). Product scope, release plan and settled decisions:
docs/story-map.md. Talk to the user in German.

## Layout

- `backend/` – FastAPI, SQLAlchemy, SQLite. Package `overworked` under `src/`.
- `frontend/` – React + TypeScript (Vite), TanStack Query. Built output is served by FastAPI in production.
- `openapi.json` – API contract, generated from the backend. `frontend/src/api/` is the client
  generated from it by hey-api (types, SDK, TanStack Query options). Both are committed; never edit by hand.
- `e2e/` – Playwright end-to-end tests against the full stack (built frontend served by a real backend, fresh SQLite).
- `Dockerfile` / `docker-compose.yml` – single container serving both.
- `deploy/` – production: Terraform (GCP e2-micro + Cloudflare DNS), `compose.yml` with Caddy for
  HTTPS, `scripts/deploy.mjs <user@host>`. CI (`.github/workflows/ci.yml`) tests every push and
  publishes the image to GHCR from `main`. Setup steps: `deploy/README.md`.

## Commands

All dev commands are Node scripts in `scripts/` (`--help` prints the leading `//` comment block,
which is the documentation, so keep it accurate). Shared helpers (arg parsing via `util.parseArgs`,
`run`/`exec`/`runAll`) live in `scripts/lib/cli.mjs`. `.vscode/tasks.json` only wraps the scripts.

- Everything once: `node scripts/test-all.mjs`; lint/typecheck: `node scripts/lint.mjs`
- Backend: `node scripts/test-backend.mjs [unit|integration] [--watch] [-- pytest args]`
- Frontend: `node scripts/test-frontend.mjs [unit|component] [--watch] [--ui] [--headed] [-- vitest args]`
- E2E: `node scripts/test-e2e.mjs [--watch] [--headed] [--ui] [--report] [-- playwright args]`
- New DB migration after changing models: `node scripts/new-migration.mjs "<message>"`
- After changing the API: `node scripts/generate-api.mjs` (lint fails on drift, so does `test_openapi.py`)
- After changing the logo (`frontend/public/favicon.svg`, mirrored in `Logo.tsx`): `node scripts/generate-icons.mjs`
- Image: `docker compose build`

Scripts must stay cross-platform (Linux, macOS, Windows): no shell syntax, spawn via the helpers.

## Working agreements

- Test-driven (red → green → refactor), in the style of Khorikov / Osherove:
  - Domain logic (e.g. `WorkSession`) is pure and unit-tested without mocks.
  - API tests are integration tests against a real SQLite file via `TestClient`.
  - Only unmanaged out-of-process dependencies are replaced (ntfy → `SpyNotifier`).
  - Component tests run in a real browser (Vitest Browser Mode + `vitest-browser-react`) with MSW as a
    service worker; assert on what the user sees. Pure functions are tested in the Node `unit` project.
  - E2E tests (Playwright) cover only the key user journeys; edge cases belong in the lower layers.
    They share one server and one user, so they run serially and reset state via the API.
  - Time is injected (`clock` in the backend, fake `Date` in Vitest); never read the wall clock in tested code paths.
- Every table carries `user_id`. Authentication lives only in `overworked/auth.py`
  (`get_current_user()`, `login`/`logout`; currently a single user with a password from
  `OVERWORKED_PASSWORD` and an HMAC-signed, Secure, HttpOnly cookie). Without a password the API
  is open (local dev); the Docker image sets `OVERWORKED_REQUIRE_PASSWORD` and refuses to start
  without one. E2E runs with a password: the `login` setup project stores the cookie in
  `e2e/.tmp/auth.json`, every test starts logged in.
- The generated client throws only the response body; `frontend/src/apiError.ts` wraps it in
  `ApiError` with the status. A 401 shows the login form.
- No secrets in the repo. Configuration via `OVERWORKED_*` env vars; document new ones in `.env.example`.
- All timestamps are UTC and set by the server.
- Schema changes go through Alembic (`backend/src/overworked/migrations/`); the app runs
  `upgrade_to_head()` on startup. `test_migrations.py` fails if models and migrations diverge.
  Migrations must not import app code (UTCDateTime is rendered as `sa.DateTime()`).
- Operation IDs are the route function names (readable generated client names), so name route
  functions as verbs (`get_current_session`, `pause_session`).
- Frontend server state lives in TanStack Query: use the generated `*Options`/`*Mutation` helpers;
  on mutation errors invalidate the current session (another device may have changed it).
- The session API returns raw state (`started_at`, `target_minutes`, `required_break_minutes`,
  `pauses`); clients compute end time and countdown (`frontend/src/session.ts`), the backend does
  the same for the alarm (`WorkSession.end_at(now)`). Keep both in sync.
- End time = start + target + pauses (merged, planned included) + legal break not covered yet
  (ArbZG §4: >6 h → 30 min, >9 h → 45 min; only pause parts ≥ 15 min count, a running pause counts
  right away). The thresholds live only in the backend (`LEGAL_BREAKS`). "noch …" in the UI is the
  time until Feierabend (end − now), not remaining work time.
- `pauses` has no `user_id`: it is only reachable through its user-scoped session.
- MSW 3: the unhandled-request option is `onUnhandledFrame`, not `onUnhandledRequest`. The worker
  script is served by `msw/vite` in the component test project only, never shipped in the app build.
- Vitest Browser Mode `toHaveTextContent(string)` matches the full text, unlike jest-dom.
- Keep `playwright` in `frontend/` and `@playwright/test` in `e2e/` on the same version (shared browser download).
- PWA: `frontend/public/manifest.webmanifest` and a minimal `sw.js` (registered in production builds
  only). No offline cache on purpose; the service worker is where web push will arrive.
- Dev container: the venv lives at `$UV_PROJECT_ENVIRONMENT` (outside the workspace). There is no display, so headed runs only work on the host.
