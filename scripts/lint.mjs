#!/usr/bin/env node
// Prüft Formatierung, Lint-Regeln und Typen in allen Teilprojekten:
// ruff (Backend), oxlint und tsc (Frontend), tsc (E2E).
//
// Aufruf: node scripts/lint.mjs

import { join } from 'node:path'
import { parseCli, ROOT, runAll } from './lib/cli.mjs'

parseCli(import.meta.url)

const backend = { cwd: join(ROOT, 'backend') }
const frontend = { cwd: join(ROOT, 'frontend') }
await runAll([
  ['uv', ['run', 'ruff', 'check', '.'], backend],
  ['uv', ['run', 'ruff', 'format', '--check', '.'], backend],
  ['npm', ['run', 'lint'], frontend],
  ['npm', ['run', 'typecheck'], frontend],
  ['npm', ['run', 'typecheck'], { cwd: join(ROOT, 'e2e') }],
])
