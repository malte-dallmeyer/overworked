#!/usr/bin/env bash
# Führt die End-to-End-Tests aus (Playwright). Sie laufen gegen den kompletten
# Stack: Das Frontend wird gebaut und vom echten Backend mit frischer
# SQLite-Datenbank ausgeliefert.
#
# Aufruf: scripts/test-e2e.sh [--watch] [--headed] [--ui] [--report] [-- playwright-Optionen…]
#
#   (ohne)     einmal headless
#   --headed   mit sichtbarem Browserfenster (nicht im Dev Container)
#   --watch    bei Änderungen an Frontend, Backend oder Tests erneut ausführen.
#              Headless wird für jeden Test ein Trace aufgezeichnet und danach
#              der Report auf http://localhost:9324 geöffnet; dort öffnet
#              "View trace" den Trace Viewer. Nach weiteren Läufen: Seite neu laden.
#   --ui       Playwright UI-Modus auf http://localhost:9323 (eigener Watch-Modus)
#   --report   nur den Report des letzten Laufs öffnen
#
# Beispiele:
#   scripts/test-e2e.sh --watch
#   scripts/test-e2e.sh --headed -- --project desktop -g reload

source "$(dirname "$0")/lib/common.sh"

watch=false
headed=false
mode=run
extra=()
while [ $# -gt 0 ]; do
  case "$1" in
    --watch) watch=true ;;
    --headed) headed=true ;;
    --ui) mode=ui ;;
    --report) mode=report ;;
    -h | --help) usage; exit 0 ;;
    --) shift; extra=("$@"); break ;;
    *) fail_usage "unbekanntes Argument: $1" ;;
  esac
  shift
done

cd "$ROOT/e2e"
case "$mode" in
  ui) exec npx playwright test --ui --ui-host=127.0.0.1 --ui-port=9323 "${extra[@]}" ;;
  report) exec npx playwright show-report --port 9324 ;;
esac

headed_flag=()
$headed && headed_flag=(--headed)
if $watch; then
  exec node "$ROOT/scripts/lib/e2e-watch.mjs" "${headed_flag[@]}" "${extra[@]}"
else
  exec npx playwright test "${headed_flag[@]}" "${extra[@]}"
fi
