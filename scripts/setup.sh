#!/usr/bin/env bash
# Installiert alle Abhängigkeiten: Backend (uv), Frontend und E2E (npm) sowie
# Chromium für Playwright. Legt außerdem eine .env aus .env.example an, falls
# noch keine existiert.
#
# Aufruf: scripts/setup.sh
#
# Fehlen auf dem Host Systembibliotheken für Chromium, einmalig ausführen:
#   (cd e2e && sudo npx playwright install-deps chromium)

source "$(dirname "$0")/lib/common.sh"
[[ "${1:-}" =~ ^(-h|--help)$ ]] && { usage; exit 0; }

cd "$ROOT"
[ -f .env ] || cp .env.example .env
(cd backend && uv sync)
(cd frontend && npm ci)
(cd e2e && npm ci && npx playwright install chromium)
