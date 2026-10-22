#!/usr/bin/env bash
# Führt alle Tests einmal aus: Backend (Unit, Integration), Frontend (Unit,
# Component) und E2E. Bricht beim ersten Fehlschlag ab.
#
# Aufruf: scripts/test-all.sh
#
# Für Watch-Modi die einzelnen Skripte nutzen, oder in VS Code den Task
# "Alle Tests (Watch)".

source "$(dirname "$0")/lib/common.sh"
[[ "${1:-}" =~ ^(-h|--help)$ ]] && { usage; exit 0; }

cd "$ROOT"
scripts/test-backend.sh unit
scripts/test-backend.sh integration
scripts/test-frontend.sh
scripts/test-e2e.sh
