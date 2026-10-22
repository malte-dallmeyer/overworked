#!/usr/bin/env node
// Startet den Vite-Dev-Server auf http://localhost:5173.
// Anfragen an /api werden an das Backend (Port 8000) weitergeleitet, das
// separat laufen muss (scripts/dev-backend.mjs).
//
// Aufruf: node scripts/dev-frontend.mjs [-- vite-Optionen…]

import { join } from 'node:path'
import { exec, parseCli, ROOT } from './lib/cli.mjs'

const { passthrough } = parseCli(import.meta.url)

await exec('npx', ['vite', ...passthrough], { cwd: join(ROOT, 'frontend') })
