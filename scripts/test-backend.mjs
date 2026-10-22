#!/usr/bin/env node
// Führt die Backend-Tests aus (pytest).
//
// Aufruf: node scripts/test-backend.mjs [all|unit|integration] [--watch] [-- pytest-Optionen…]
//
//   all          Unit- und Integrationstests (Standard)
//   unit         Domänenlogik, ohne Datenbank (tests/unit)
//   integration  API und Alarm gegen eine echte SQLite-Datei (tests/integration)
//   --watch      bei jeder Änderung an .py-Dateien erneut ausführen
//
// Beispiele:
//   node scripts/test-backend.mjs unit --watch
//   node scripts/test-backend.mjs integration -- -k alarm

import { join } from 'node:path'
import { exec, parseCli, ROOT } from './lib/cli.mjs'

const { suite, watch, passthrough } = parseCli(import.meta.url, {
  flags: ['watch'],
  suites: ['all', 'unit', 'integration'],
})

const testPath = suite === 'all' ? 'tests' : `tests/${suite}`
const runner = watch ? ['ptw', '--now', '--clear', '.'] : ['pytest']

await exec('uv', ['run', ...runner, testPath, ...passthrough], { cwd: join(ROOT, 'backend') })
