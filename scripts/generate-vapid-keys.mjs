#!/usr/bin/env node
// Erzeugt ein Schlüsselpaar für Web-Push (VAPID, P-256) und gibt es als Zeilen für
// deploy/.env bzw. .env aus. Ohne diese Schlüssel bleibt Web-Push aus; der Alarm kommt
// dann nur über ntfy.
//
// Aufruf: node scripts/generate-vapid-keys.mjs
//
// Neue Schlüssel melden alle Browser ab: Dort die Glocke einmal neu einschalten.

import { generateKeyPairSync } from 'node:crypto'
import { parseCli } from './lib/cli.mjs'

parseCli(import.meta.url)

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = privateKey.export({ format: 'jwk' })
const base64url = (bytes) => Buffer.from(bytes).toString('base64url')
// Public key as browsers expect it: the uncompressed point 0x04 || x || y.
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url'),
])

console.log(`OVERWORKED_VAPID_PUBLIC_KEY=${base64url(publicKey)}`)
console.log(`OVERWORKED_VAPID_PRIVATE_KEY=${jwk.d}`)
