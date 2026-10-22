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
  (`get_current_user()`, currently a fixed single user).
- No secrets in the repo. Configuration via `OVERWORKED_*` env vars; document new ones in `.env.example`.
- All timestamps are UTC and set by the server.
- Schema changes go through Alembic (`backend/src/overworked/migrations/`); the app runs
  `upgrade_to_head()` on startup. `test_migrations.py` fails if models and migrations diverge.
  Migrations must not import app code (UTCDateTime is rendered as `sa.DateTime()`).
- Operation IDs are the route function names (readable generated client names), so name route
  functions as verbs (`get_current_session`, `pause_session`).
- Frontend server state lives in TanStack Query: use the generated `*Options`/`*Mutation` helpers;
  on mutation errors invalidate the current session (another device may have changed it).
- The session API returns raw state (`started_at`, `target_minutes`, `paused_seconds`,
  `paused_since`); clients compute end time and countdown (`frontend/src/session.ts`), the
  backend does the same for the alarm (`WorkSession.end_at(now)`). Keep both in sync.
- `pauses` has no `user_id`: it is only reachable through its user-scoped session.
- MSW 3: the unhandled-request option is `onUnhandledFrame`, not `onUnhandledRequest`. The worker
  script is served by `msw/vite` in the component test project only, never shipped in the app build.
- Vitest Browser Mode `toHaveTextContent(string)` matches the full text, unlike jest-dom.
- Keep `playwright` in `frontend/` and `@playwright/test` in `e2e/` on the same version (shared browser download).
- Dev container: the venv lives at `$UV_PROJECT_ENVIRONMENT` (outside the workspace). There is no display, so headed runs only work on the host.
