#!/usr/bin/env node
// Erzeugt eine neue Datenbank-Migration aus den Änderungen an den Modellen
// (backend/src/overworked/models.py). Dafür wird eine temporäre Datenbank auf
// den aktuellen Stand gebracht und mit den Modellen verglichen.
//
// Aufruf: node scripts/new-migration.mjs "<Beschreibung>"
//   z. B. node scripts/new-migration.mjs "add snooze to sessions"
//
// Die neue Datei unter backend/src/overworked/migrations/versions/ danach
// prüfen: Alembic erkennt z. B. Umbenennungen nicht, sondern sieht sie als
// Löschen und Neuanlegen. Die App spielt Migrationen beim Start selbst ein.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseCli, ROOT, runAll } from './lib/cli.mjs'

const { message } = parseCli(import.meta.url, { argument: 'message' })

const tempDir = mkdtempSync(join(tmpdir(), 'overworked-migration-'))
const options = {
  cwd: join(ROOT, 'backend'),
  env: { OVERWORKED_DATABASE_URL: `sqlite:///${join(tempDir, 'db.sqlite')}` },
}
try {
  await runAll([
    ['uv', ['run', 'alembic', 'upgrade', 'head'], options],
    ['uv', ['run', 'alembic', 'revision', '--autogenerate', '-m', message], options],
  ])
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
