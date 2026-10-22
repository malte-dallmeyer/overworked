#!/usr/bin/env node
// Bringt die neueste Version auf den Server: kopiert deploy/compose.yml,
// deploy/Caddyfile und deploy/.env (nicht committet, Vorlage: deploy/.env.example)
// nach ~/overworked/ und startet dort das aktuelle Image aus der GitHub Container
// Registry. Das Image baut GitHub Actions bei jedem Push auf main.
//
// Aufruf: node scripts/deploy.mjs <user@host>
//
//   <user@host>  SSH-Ziel: der Host-Eintrag aus ~/.ssh/config (z. B. `overworked`)
//                oder user@ip, siehe `terraform output -raw ssh` in deploy/terraform/
//
// Erstes Einrichten des Servers: deploy/README.md

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseCli, ROOT, runAll } from './lib/cli.mjs'

const { 'user@host': host } = parseCli(import.meta.url, { argument: 'user@host' })

const files = ['compose.yml', 'Caddyfile', '.env'].map((file) => join(ROOT, 'deploy', file))
if (!existsSync(files[2])) {
  console.error('deploy/.env fehlt: aus deploy/.env.example anlegen und ausfüllen.')
  process.exit(1)
}

await runAll([
  ['scp', [...files, `${host}:overworked/`]],
  ['ssh', [host, 'cd overworked && docker compose pull && docker compose up -d && docker image prune -f']],
])
