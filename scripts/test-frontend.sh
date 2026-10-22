#!/usr/bin/env bash
# Führt die Frontend-Tests aus (Vitest).
#
# Aufruf: scripts/test-frontend.sh [unit|component|all] [--watch] [--ui] [--headed] [-- vitest-Optionen…]
#
#   unit       reine Funktionen, laufen in Node
#   component  React-Komponenten in echtem Chromium (Vitest Browser Mode, MSW)
#   all        beides (Standard)
#   --watch    bei Änderungen erneut ausführen
#   --ui       Live-Report (Vitest UI) im Browser öffnen; aktualisiert sich bei
#              jedem Lauf selbst und zeigt Fehler, Konsole und gerenderte Komponente.
#              Impliziert --watch. Meldet der Browser "requires authentication",
#              einmal die URL mit ?token=… aus dem Terminal öffnen; das Cookie
#              gilt danach ein Jahr.
#              Mit --headed entfällt die UI: Das Browserfenster zeigt dann selbst
#              die Vitest-Oberfläche.
#   --headed   Component-Tests mit sichtbarem Browserfenster
#              (nicht im Dev Container, dort gibt es keinen Bildschirm)
#
# Beispiele:
#   scripts/test-frontend.sh component --ui
#   scripts/test-frontend.sh component --watch --headed
#   scripts/test-frontend.sh -- src/time.test.ts

source "$(dirname "$0")/lib/common.sh"

suite=all
watch=false
ui=false
headed=false
extra=()
while [ $# -gt 0 ]; do
  case "$1" in
    unit | component | all) suite=$1 ;;
    --watch) watch=true ;;
    --ui) ui=true; watch=true ;;
    --headed) headed=true ;;
    -h | --help) usage; exit 0 ;;
    --) shift; extra=("$@"); break ;;
    *) fail_usage "unbekanntes Argument: $1" ;;
  esac
  shift
done

# Explicit --watch: Vitest silently falls back to a single run without a TTY.
if $watch; then args=(--watch); else args=(run); fi
# Headed + UI hangs waiting for the UI page; the headed window already shows Vitest's UI.
$ui && ! $headed && args+=(--ui)
[ "$suite" = all ] || args+=(--project "$suite")
$headed && args+=(--browser.headless=false)

if $ui && ! $headed; then
  echo "Hinweis: Meldet der Browser \"requires authentication\", einmal die URL mit ?token=… unten öffnen."
fi

cd "$ROOT/frontend"
exec npx vitest "${args[@]}" "${extra[@]}"
