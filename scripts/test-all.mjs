#!/usr/bin/env node
// Führt alle Tests einmal aus: Backend (Unit, Integration), Frontend (Unit,
// Component) und E2E. Bricht beim ersten Fehlschlag ab.
//
// Aufruf: node scripts/test-all.mjs
//
// Für Watch-Modi die einzelnen Skripte nutzen, oder in VS Code den Task
// "Alle Tests".

import { join } from 'node:path'
import { parseCli, ROOT, runAll } from './lib/cli.mjs'

parseCli(import.meta.url)

const script = (name) => join(ROOT, 'scripts', name)
await runAll([
  ['node', [script('test-backend.mjs'), 'unit']],
  ['node', [script('test-backend.mjs'), 'integration']],
  ['node', [script('test-frontend.mjs')]],
  ['node', [script('test-e2e.mjs')]],
])
