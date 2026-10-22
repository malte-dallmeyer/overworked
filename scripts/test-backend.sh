#!/usr/bin/env bash
# Führt die Backend-Tests aus (pytest).
#
# Aufruf: scripts/test-backend.sh [unit|integration|all] [--watch] [-- pytest-Optionen…]
#
#   unit         Domänenlogik, ohne Datenbank (tests/unit)
#   integration  API und Alarm gegen eine echte SQLite-Datei (tests/integration)
#   all          beides (Standard)
#   --watch      bei jeder Änderung an .py-Dateien erneut ausführen
#
# Beispiele:
#   scripts/test-backend.sh unit --watch
#   scripts/test-backend.sh integration -- -k alarm

source "$(dirname "$0")/lib/common.sh"

suite=all
watch=false
extra=()
while [ $# -gt 0 ]; do
  case "$1" in
    unit | integration | all) suite=$1 ;;
    --watch) watch=true ;;
    -h | --help) usage; exit 0 ;;
    --) shift; extra=("$@"); break ;;
    *) fail_usage "unbekanntes Argument: $1" ;;
  esac
  shift
done

case "$suite" in
  unit) paths=(tests/unit) ;;
  integration) paths=(tests/integration) ;;
  all) paths=(tests) ;;
esac

cd "$ROOT/backend"
if $watch; then
  exec uv run ptw --now --clear . "${paths[@]}" "${extra[@]}"
else
  exec uv run pytest "${paths[@]}" "${extra[@]}"
fi
