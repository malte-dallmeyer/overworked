# Overworked

Feierabend-Wecker (not time tracking). Product scope, release plan and settled decisions:
docs/story-map.md. Talk to the user in German.

## Layout

- `backend/` – FastAPI, SQLAlchemy, SQLite. Package `overworked` under `src/`.
- `frontend/` – React + TypeScript (Vite). Built output is served by FastAPI in production.
- `e2e/` – Playwright end-to-end tests against the full stack (built frontend served by a real backend, fresh SQLite).
- `Dockerfile` / `docker-compose.yml` – single container serving both.

## Commands

All dev commands are documented bash scripts in `scripts/` (`--help` prints the header comment,
which is the documentation, so keep it accurate). `.vscode/tasks.json` only wraps them.

- Everything once: `scripts/test-all.sh`; lint/typecheck: `scripts/lint.sh`
- Backend: `scripts/test-backend.sh [unit|integration] [--watch] [-- pytest args]`
- Frontend: `scripts/test-frontend.sh [unit|component] [--watch] [--ui] [--headed] [-- vitest args]`
- E2E: `scripts/test-e2e.sh [--watch] [--headed] [--ui] [--report] [-- playwright args]`
- Image: `docker compose build`

Scripts must run on bash 3.2 (macOS): no `set -u`, no bash-4 features.

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
- MSW 3: the unhandled-request option is `onUnhandledFrame`, not `onUnhandledRequest`. The worker
  script is served by `msw/vite` in the component test project only, never shipped in the app build.
- Vitest Browser Mode `toHaveTextContent(string)` matches the full text, unlike jest-dom.
- Keep `playwright` in `frontend/` and `@playwright/test` in `e2e/` on the same version (shared browser download).
- Dev container: the venv lives at `$UV_PROJECT_ENVIRONMENT` (outside the workspace). There is no display, so headed runs only work on the host.
