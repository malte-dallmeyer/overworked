#!/usr/bin/env node
// Führt die Frontend-Tests aus (Vitest).
//
// Aufruf: node scripts/test-frontend.mjs [all|unit|component] [--watch] [--ui] [--headed] [-- vitest-Optionen…]
//
//   all        Unit- und Component-Tests (Standard)
//   unit       reine Funktionen, laufen in Node
//   component  React-Komponenten in echtem Chromium (Vitest Browser Mode, MSW)
//   --watch    bei Änderungen erneut ausführen
//   --ui       Live-Report (Vitest UI) im Browser öffnen; aktualisiert sich bei
//              jedem Lauf selbst und zeigt Fehler, Konsole und gerenderte Komponente.
//              Impliziert --watch. Meldet der Browser "requires authentication",
//              einmal die URL mit ?token=… aus dem Terminal öffnen; das Cookie
//              gilt danach ein Jahr.
//   --headed   Component-Tests mit sichtbarem Browserfenster, das selbst die
//              Vitest-Oberfläche zeigt (--ui entfällt dann). Nicht im Dev Container,
//              dort gibt es keinen Bildschirm.
//
// Beispiele:
//   node scripts/test-frontend.mjs component --ui
//   node scripts/test-frontend.mjs component --watch --headed
//   node scripts/test-frontend.mjs -- src/time.test.ts

import { join } from 'node:path'
import { exec, parseCli, ROOT } from './lib/cli.mjs'

const { suite, watch, ui, headed, passthrough } = parseCli(import.meta.url, {
  flags: ['watch', 'ui', 'headed'],
  suites: ['all', 'unit', 'component'],
})

// Headed + UI hangs waiting for the UI page; the headed window already shows Vitest's UI.
const showUi = ui && !headed
const args = [
  // Explicit --watch: Vitest silently falls back to a single run without a TTY.
  watch || ui ? '--watch' : 'run',
  ...(suite === 'all' ? [] : ['--project', suite]),
  ...(showUi ? ['--ui'] : []),
  ...(headed ? ['--browser.headless=false'] : []),
  ...passthrough,
]

if (showUi) {
  console.log('Hinweis: Meldet der Browser "requires authentication", einmal die URL mit ?token=… unten öffnen.')
}
await exec('npx', ['vitest', ...args], { cwd: join(ROOT, 'frontend') })
