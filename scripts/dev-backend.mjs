#!/usr/bin/env node
// Startet das Backend mit Auto-Reload auf http://localhost:8000.
// Liest die Konfiguration aus .env im Projektverzeichnis (falls vorhanden).
// Die SQLite-Datenbank entsteht beim ersten Start unter backend/data/.
//
// Aufruf: node scripts/dev-backend.mjs [-- uvicorn-Optionen…]
//   z. B. node scripts/dev-backend.mjs -- --port 8001

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { exec, parseCli, ROOT } from './lib/cli.mjs'

const { passthrough } = parseCli(import.meta.url)

const envFile = existsSync(join(ROOT, '.env')) ? ['--env-file', '../.env'] : []
await exec(
  'uv',
  ['run', ...envFile, 'uvicorn', 'overworked.main:create_app', '--factory', '--reload', ...passthrough],
  { cwd: join(ROOT, 'backend') },
)
