#!/usr/bin/env node
// Installiert alle Abhängigkeiten: Backend (uv), Frontend und E2E (npm) sowie
// Chromium für Playwright. Legt außerdem eine .env aus .env.example an, falls
// noch keine existiert.
//
// Aufruf: node scripts/setup.mjs
//
// Fehlen auf dem Host Systembibliotheken für Chromium, einmalig ausführen:
//   cd e2e && sudo npx playwright install-deps chromium

import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseCli, ROOT, runAll } from './lib/cli.mjs'

parseCli(import.meta.url)

if (!existsSync(join(ROOT, '.env'))) copyFileSync(join(ROOT, '.env.example'), join(ROOT, '.env'))

await runAll([
  ['uv', ['sync'], { cwd: join(ROOT, 'backend') }],
  ['npm', ['ci'], { cwd: join(ROOT, 'frontend') }],
  ['npm', ['ci'], { cwd: join(ROOT, 'e2e') }],
  ['npx', ['playwright', 'install', 'chromium'], { cwd: join(ROOT, 'e2e') }],
])
