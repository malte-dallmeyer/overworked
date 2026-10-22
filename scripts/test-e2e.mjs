#!/usr/bin/env node
// Führt die End-to-End-Tests aus (Playwright). Sie laufen gegen den kompletten
// Stack: Das Frontend wird gebaut und vom echten Backend mit frischer
// SQLite-Datenbank ausgeliefert.
//
// Aufruf: node scripts/test-e2e.mjs [--watch] [--headed] [--ui] [--report] [-- playwright-Optionen…]
//
//   (ohne)     einmal headless
//   --headed   mit sichtbarem Browserfenster (nicht im Dev Container)
//   --watch    bei Änderungen an Frontend, Backend oder Tests erneut ausführen.
//              Headless wird für jeden Test ein Trace aufgezeichnet und danach
//              der Report auf http://localhost:9324 geöffnet; dort öffnet
//              "View trace" den Trace Viewer. Nach weiteren Läufen: Seite neu laden.
//   --ui       Playwright UI-Modus auf http://localhost:9323 (eigener Watch-Modus)
//   --report   nur den Report des letzten Laufs öffnen
//
// Beispiele:
//   node scripts/test-e2e.mjs --watch
//   node scripts/test-e2e.mjs --headed -- --project desktop -g reload

import { join } from 'node:path'
import { exec, parseCli, ROOT } from './lib/cli.mjs'
import { watchE2e } from './lib/e2e-watch.mjs'

const { watch, headed, ui, report, passthrough } = parseCli(import.meta.url, {
  flags: ['watch', 'headed', 'ui', 'report'],
})
const cwd = join(ROOT, 'e2e')

if (ui) {
  await exec('npx', ['playwright', 'test', '--ui', '--ui-host=127.0.0.1', '--ui-port=9323', ...passthrough], { cwd })
} else if (report) {
  await exec('npx', ['playwright', 'show-report', '--port', '9324'], { cwd })
} else if (watch) {
  watchE2e({ headed, playwrightArgs: passthrough })
} else {
  await exec('npx', ['playwright', 'test', ...(headed ? ['--headed'] : []), ...passthrough], { cwd })
}
