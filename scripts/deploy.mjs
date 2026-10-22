#!/usr/bin/env node
// Bringt die neueste Version auf den Server: kopiert deploy/compose.yml und
// deploy/Caddyfile nach ~/overworked/ und startet dort das Image. Die Konfiguration
// (Passwort, Schlüssel, …) geht als Umgebungsvariablen über die SSH-Verbindung an
// `docker compose`; auf dem Server liegt sie in keiner Datei.
//
// Aufruf: node scripts/deploy.mjs <user@host>
//
//   <user@host>  SSH-Ziel: der Host-Eintrag aus ~/.ssh/config (z. B. `overworked`)
//                oder user@ip, siehe `terraform output -raw ssh` in deploy/terraform/
//
// Die Werte kommen aus der Umgebung (so in GitHub Actions) und, für Lücken, aus
// deploy/.env (nur lokal, nicht committet; Vorlage: deploy/.env.example).
// Erstes Einrichten des Servers: deploy/README.md

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { parseCli, ROOT, runAll } from './lib/cli.mjs'

const { 'user@host': host } = parseCli(import.meta.url, { argument: 'user@host' })

const REQUIRED = ['OVERWORKED_IMAGE', 'OVERWORKED_DOMAIN', 'OVERWORKED_PASSWORD', 'OVERWORKED_SECRET_KEY']

const envFile = join(ROOT, 'deploy', '.env')
const fromFile = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}
const settings = Object.fromEntries(
  Object.entries({ ...fromFile, ...process.env }).filter(([name, value]) => name.startsWith('OVERWORKED_') && value),
)
const missing = REQUIRED.filter((name) => !settings[name])
if (missing.length > 0) {
  console.error(`Es fehlt: ${missing.join(', ')} (als Umgebungsvariable oder in deploy/.env).`)
  process.exit(1)
}

/** Single quotes keep the shell on the server from interpreting anything in the value. */
const quote = (value) => `'${value.replaceAll("'", `'\\''`)}'`
const exports = Object.entries(settings)
  .map(([name, value]) => `export ${name}=${quote(value)}`)
  .join('\n')

const files = ['compose.yml', 'Caddyfile'].map((file) => join(ROOT, 'deploy', file))
await runAll([
  ['ssh', [host, 'mkdir -p overworked && rm -f overworked/.env']],
  ['scp', [...files, `${host}:overworked/`]],
  [
    'ssh',
    [host, 'cd overworked && . /dev/stdin && docker compose pull && docker compose up -d && docker image prune -f'],
    { input: `${exports}\n` },
  ],
])
