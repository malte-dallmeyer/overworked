#!/usr/bin/env bash
# Prüft Formatierung, Lint-Regeln und Typen in allen Teilprojekten:
# ruff (Backend), oxlint und tsc (Frontend), tsc (E2E).
#
# Aufruf: scripts/lint.sh

source "$(dirname "$0")/lib/common.sh"
[[ "${1:-}" =~ ^(-h|--help)$ ]] && { usage; exit 0; }

(cd "$ROOT/backend" && uv run ruff check . && uv run ruff format --check .)
(cd "$ROOT/frontend" && npm run lint && npm run typecheck)
(cd "$ROOT/e2e" && npm run typecheck)
