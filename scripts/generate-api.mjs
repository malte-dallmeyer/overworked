#!/usr/bin/env node
// Erzeugt die API-Beschreibung und den Frontend-Client neu:
//   1. openapi.json aus dem Backend (FastAPI)
//   2. frontend/src/api/ daraus (hey-api: Typen, Funktionen, TanStack-Query-Optionen)
// Beides wird committet. Nach jeder Änderung an der Backend-API ausführen.
//
// Aufruf: node scripts/generate-api.mjs [--check]
//
//   --check  nichts überschreiben, nur prüfen, ob openapi.json und der Client
//            zum aktuellen Backend passen (Exit-Code 1, wenn nicht). Läuft in
//            scripts/lint.mjs.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { parseCli, ROOT, runAll } from './lib/cli.mjs'

const { check } = parseCli(import.meta.url, { flags: ['check'] })

const committed = { spec: join(ROOT, 'openapi.json'), client: join(ROOT, 'frontend/src/api') }
const tempDir = check ? mkdtempSync(join(tmpdir(), 'overworked-api-')) : null
const target = check ? { spec: join(tempDir, 'openapi.json'), client: join(tempDir, 'api') } : committed

try {
  await runAll([
    ['uv', ['run', 'python', '-m', 'overworked.openapi', target.spec], { cwd: join(ROOT, 'backend') }],
    ['npx', ['openapi-ts', '--silent', '-i', target.spec, '-o', target.client], { cwd: join(ROOT, 'frontend') }],
  ])
  if (check) {
    const stale = [
      ...(sameContent(target.spec, committed.spec) ? [] : [committed.spec]),
      ...differingFiles(target.client, committed.client),
    ]
    if (stale.length > 0) {
      console.error('Veraltet, bitte `node scripts/generate-api.mjs` ausführen:')
      for (const path of stale) console.error(`  ${relative(ROOT, path)}`)
      process.exitCode = 1
    }
  }
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
}

function sameContent(a, b) {
  const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null)
  return read(a) === read(b)
}

/** Files in `actual` that are missing, extra or different compared to `fresh`. */
function differingFiles(fresh, actual) {
  const filesIn = (dir) =>
    existsSync(dir)
      ? readdirSync(dir, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
      : []
  const names = new Set([...filesIn(fresh), ...filesIn(actual)])
  return [...names]
    .filter((name) => !sameContent(join(fresh, name), join(actual, name)))
    .map((name) => join(actual, name))
}
