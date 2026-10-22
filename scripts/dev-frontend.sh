#!/usr/bin/env bash
# Startet den Vite-Dev-Server auf http://localhost:5173.
# Anfragen an /api werden an das Backend (Port 8000) weitergeleitet, das
# separat laufen muss (scripts/dev-backend.sh).
#
# Aufruf: scripts/dev-frontend.sh [vite-Optionen…]

source "$(dirname "$0")/lib/common.sh"
[[ "${1:-}" =~ ^(-h|--help)$ ]] && { usage; exit 0; }

cd "$ROOT/frontend"
exec npx vite "$@"
