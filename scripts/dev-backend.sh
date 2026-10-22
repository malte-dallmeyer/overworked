#!/usr/bin/env bash
# Startet das Backend mit Auto-Reload auf http://localhost:8000.
# Liest die Konfiguration aus .env im Projektverzeichnis (falls vorhanden).
# Die SQLite-Datenbank entsteht beim ersten Start unter backend/data/.
#
# Aufruf: scripts/dev-backend.sh [uvicorn-Optionen…]
#   z. B. scripts/dev-backend.sh --port 8001

source "$(dirname "$0")/lib/common.sh"
[[ "${1:-}" =~ ^(-h|--help)$ ]] && { usage; exit 0; }

cd "$ROOT/backend"
env_file=()
[ -f ../.env ] && env_file=(--env-file ../.env)
exec uv run "${env_file[@]}" uvicorn overworked.main:create_app --factory --reload "$@"
