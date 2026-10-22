# Overworked

Feierabend-Wecker (not time tracking). Product scope, release plan and settled decisions:
docs/story-map.md. Talk to the user in German.

## Layout

- `backend/` – FastAPI, SQLAlchemy, SQLite. Package `overworked` under `src/`.
- `frontend/` – React + TypeScript (Vite). Built output is served by FastAPI in production.
- `e2e/` – Playwright end-to-end tests against the full stack (built frontend served by a real backend, fresh SQLite).
- `Dockerfile` / `docker-compose.yml` – single container serving both.

## Commands

All dev commands are npm scripts in the root `package.json` (see README for the full table);
`.vscode/tasks.json` wraps the same scripts. Extra args are forwarded, e.g. `npm run test:backend:unit -- -k alarm`.

- Everything once: `npm test`; lint/typecheck: `npm run lint`
- Backend: `test:backend:unit`, `test:backend:integration` (append `:watch` for pytest-watcher)
- Frontend: `test:frontend:unit` (Node), `test:frontend:component` (Vitest Browser Mode, Chromium)
- E2E: `test:e2e`, `test:e2e:headed`, `test:e2e:ui`
- Image: `docker compose build`

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
