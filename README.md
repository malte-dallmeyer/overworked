# Overworked – Feierabend-Wecker

Ein Wecker, der dich penetrant daran erinnert, Feierabend zu machen. **Keine Zeiterfassung:**
keine Historie, keine Statistiken, keine Überstundenkonten.

Du startest den Timer mit deiner Sollzeit, und sobald sie erreicht ist, klingelt dein Handy
über [ntfy](https://ntfy.sh).

> Status: früher Prototyp (Walking Skeleton). Siehe [docs/story-map.md](docs/story-map.md).

## Schnellstart mit Docker Compose

```sh
cp .env.example .env
# OVERWORKED_NTFY_TOPIC in .env auf einen langen, zufälligen Namen setzen
docker compose up -d --build
```

Die App läuft dann auf <http://localhost:8000>.

**Handy einrichten:** Installiere die ntfy-App (Android) und abonniere dort dasselbe Topic.

## Konfiguration

Alle Einstellungen laufen über Umgebungsvariablen mit dem Präfix `OVERWORKED_`, siehe
[.env.example](.env.example).

## Entwicklung

### Mit Dev Container (empfohlen)

In VS Code mit der Extension „Dev Containers“: **„Reopen in Container“**. Python, uv, Node,
alle Abhängigkeiten und der Playwright-Browser werden automatisch eingerichtet; eine `.env`
wird aus `.env.example` angelegt. Die Datenbank ist eine SQLite-Datei und entsteht beim ersten
Start unter `backend/data/`.

Über **Terminal → Run Task…** gibt es Tasks für alles Folgende; „Alle Tests (Watch)“ ist der
Standard-Test-Task.

### Ohne Dev Container

Voraussetzungen: [uv](https://docs.astral.sh/uv/) und Node.js ≥ 22.

```sh
cp .env.example .env
npm run setup
(cd e2e && npx playwright install --with-deps chromium)
```

### Befehle

Alle Befehle laufen im Projektverzeichnis. Zusätzliche Argumente gehen an das Test-Tool,
z. B. `npm run test:backend:unit -- -k alarm`.

| Befehl | Zweck |
|---|---|
| `npm run dev:backend` | Backend mit Auto-Reload auf <http://localhost:8000> |
| `npm run dev:frontend` | Frontend auf <http://localhost:5173> (leitet `/api` ans Backend weiter) |
| `npm test` | Alle Tests einmal |
| `npm run test:backend:unit[:watch]` | Backend Unit-Tests (Domänenlogik) |
| `npm run test:backend:integration[:watch]` | Backend Integrationstests (API + SQLite) |
| `npm run test:frontend:unit[:watch]` | Frontend Unit-Tests (reine Funktionen, Node) |
| `npm run test:frontend:component[:watch]` | React Component-Tests in Chromium (Vitest Browser Mode) |
| `npm run test:frontend:component:watch:headed` | dito mit sichtbarem Browser |
| `npm run test:e2e` / `test:e2e:headed` | End-to-End-Tests (Playwright) headless / sichtbar |
| `npm run test:e2e:ui` | Playwright UI-Modus mit Watch auf <http://localhost:9323> |
| `npm run lint` | Ruff, oxlint und Typecheck |

**Headed im Dev Container:** Der Container hat keinen Bildschirm. Nutze dort für E2E den
UI-Modus (Port 9323 wird weitergeleitet); headed-Läufe funktionieren auf dem Host.

## Lizenz

Noch offen.
