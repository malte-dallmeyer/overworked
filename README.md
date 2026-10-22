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

Über **Terminal → Run Task…** gibt es Tasks für Backend, Frontend und alle Testarten, jeweils
im Watch-Modus; „Alle Tests“ ist der Standard-Test-Task.

### Ohne Dev Container

Voraussetzungen: [uv](https://docs.astral.sh/uv/) und Node.js ≥ 22.

```sh
node scripts/setup.mjs
```

### Skripte

Alles Wiederkehrende liegt in [scripts/](scripts/). Es sind Node-Skripte, sie laufen also unter
Linux, macOS und Windows. Jedes Skript beschreibt sich selbst: `node scripts/<name>.mjs --help`.

| Skript | Zweck |
|---|---|
| `node scripts/setup.mjs` | Alle Abhängigkeiten installieren, `.env` anlegen |
| `node scripts/dev-backend.mjs` | Backend mit Auto-Reload auf <http://localhost:8000> |
| `node scripts/dev-frontend.mjs` | Frontend auf <http://localhost:5173> (leitet `/api` ans Backend weiter) |
| `node scripts/test-backend.mjs [unit\|integration] [--watch]` | Backend-Tests (pytest) |
| `node scripts/test-frontend.mjs [unit\|component] [--watch] [--ui] [--headed]` | Frontend-Tests; Component-Tests laufen in Chromium (Vitest Browser Mode), `--ui` öffnet den Live-Report |
| `node scripts/test-e2e.mjs [--watch] [--headed] [--ui] [--report]` | End-to-End-Tests (Playwright); headless mit `--watch` öffnet danach den Report mit Trace Viewer |
| `node scripts/test-all.mjs` | Alle Tests einmal |
| `node scripts/lint.mjs` | Ruff, oxlint und Typecheck |

Optionen nach `--` gehen an das Test-Tool, z. B. `node scripts/test-backend.mjs unit -- -k alarm`.

**Headed im Dev Container:** Der Container hat keinen Bildschirm. Nutze dort für E2E den
headless-Watch mit Report (Port 9324) oder den UI-Modus (Port 9323); headed-Läufe funktionieren
auf dem Host.

## Lizenz

Noch offen.
