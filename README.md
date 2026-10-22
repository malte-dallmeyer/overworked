# Overworked – Feierabend-Wecker

Ein Wecker, der dich penetrant daran erinnert, Feierabend zu machen. **Keine Zeiterfassung:**
keine Historie, keine Statistiken, keine Überstundenkonten.

Du startest den Timer mit deiner Sollzeit, und sobald sie erreicht ist, klingelt dein Handy
über [ntfy](https://ntfy.sh). Und zwar so lange, bis du Feierabend machst.

- **Starten:** Sollzeit eingeben oder aus den zuletzt genutzten wählen, auf Wunsch rückwirkend
  („Schon früher angefangen?“).
- **Pausen:** spontan per Knopf, vergessene nachtragen, geplante vorab eintragen. Die
  gesetzliche Pause (ArbZG §4) ist immer eingerechnet.
- **Alarm:** wiederholt sich alle 2 Minuten bis zur Bestätigung, direkt aus der Benachrichtigung
  heraus. Einmal Snooze (10 min). Ohne Reaktion endet die Session nach 20 Minuten von selbst.
- **Grenzen:** Hinweise, wenn die Pflichtpause fällig ist oder Feierabend naht; Warnung und
  harte Grenze bei 10 Stunden Arbeit (ArbZG §3). Verlängern nach dem Alarm geht nur gegen eine
  deutliche Aufforderung, doch lieber Feierabend zu machen.
- **Überall:** als App installierbar (PWA), Handy und Laptop zeigen live denselben Stand,
  Desktop-Browser bekommen den Alarm als Benachrichtigung.
- **Privat:** selbst gehostet, ein Container, SQLite. Gespeichert werden nur die letzten fünf
  Sessions.

Was als Nächstes kommt und warum etwas so ist, wie es ist: [docs/story-map.md](docs/story-map.md).

## Schnellstart mit Docker Compose

```sh
cp .env.example .env
# In .env setzen:
#   OVERWORKED_PASSWORD     dein Login-Passwort
#   OVERWORKED_SECRET_KEY   z. B. Ausgabe von `openssl rand -hex 32`
#   OVERWORKED_NTFY_TOPIC   ein langer, zufälliger Name
docker compose up -d --build
```

Die App läuft dann auf <http://localhost:8000>. Ohne Passwort startet das Image nicht, damit
keine Instanz versehentlich ungeschützt im Netz steht. Das Login-Cookie gilt ein Jahr; ein neues
Passwort oder ein neuer Secret Key meldet alle Geräte ab.

**Handy einrichten:** Installiere die ntfy-App (Android) und abonniere dort dasselbe Topic.

**Öffentlich betreiben** (HTTPS, eigene Domain, Updates aus GitHub): siehe
[deploy/README.md](deploy/README.md).

## Konfiguration

Alle Einstellungen laufen über Umgebungsvariablen mit dem Präfix `OVERWORKED_`, siehe
[.env.example](.env.example).

## Entwicklung

### Mit Dev Container (empfohlen)

In VS Code mit der Extension „Dev Containers“: **„Reopen in Container“**. Python, uv, Node,
alle Abhängigkeiten und der Playwright-Browser werden automatisch eingerichtet; eine `.env`
wird aus `.env.example` angelegt. Die Datenbank ist eine SQLite-Datei und entsteht beim ersten
Start unter `backend/data/`. Lokal ist der Login aus, solange `OVERWORKED_PASSWORD` leer ist.

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
| `node scripts/new-migration.mjs "<Beschreibung>"` | Datenbank-Migration aus geänderten Modellen erzeugen |
| `node scripts/generate-api.mjs [--check]` | `openapi.json` und den Frontend-API-Client nach API-Änderungen neu erzeugen |
| `node scripts/deploy.mjs <user@host>` | Neueste Version auf den Server bringen, siehe [deploy/README.md](deploy/README.md) |
| `node scripts/generate-vapid-keys.mjs` | Schlüssel für Web-Push (Desktop-Benachrichtigungen) erzeugen |
| `node scripts/generate-icons.mjs` | App-Icons (PWA, Homescreen) aus dem Logo `frontend/public/favicon.svg` erzeugen |

Optionen nach `--` gehen an das Test-Tool, z. B. `node scripts/test-backend.mjs unit -- -k alarm`.

**Headed im Dev Container:** Der Container hat keinen Bildschirm. Nutze dort für E2E den
headless-Watch mit Report (Port 9324) oder den UI-Modus (Port 9323); headed-Läufe funktionieren
auf dem Host.

## Lizenz

[MIT](LICENSE).
