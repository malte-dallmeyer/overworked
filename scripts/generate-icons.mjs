#!/usr/bin/env node
// Erzeugt die App-Icons (PWA, Homescreen, Dock) aus frontend/public/favicon.svg,
// dem Logo als einziger Quelle. Die PNGs liegen in frontend/public/icons/ und werden
// committet. Nach jeder Änderung am Logo ausführen.
//
//   icon-192.png, icon-512.png   das Logo wie es ist (abgerundet, transparente Ecken)
//   maskable-512.png             randlos, Motiv verkleinert: Android schneidet daraus
//                                Kreis, Squircle o. Ä. aus und braucht dafür eine Sicherheitszone
//   apple-touch-icon.png         randlos, 180 px; iOS/macOS runden selbst ab
//
// Aufruf: node scripts/generate-icons.mjs

import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { parseCli, ROOT } from './lib/cli.mjs'

parseCli(import.meta.url, {})

const publicDir = join(ROOT, 'frontend/public')
const outDir = join(publicDir, 'icons')
const logo = readFileSync(join(publicDir, 'favicon.svg'), 'utf8')
// Playwright is a dependency of the frontend (component tests), not of the scripts.
const { chromium } = createRequire(join(ROOT, 'frontend/package.json'))('playwright')

const ROUNDED_BACKGROUND = '<rect width="64" height="64" rx="15" fill="url(#logo-sky)" />'
if (!logo.includes(ROUNDED_BACKGROUND)) {
  throw new Error('favicon.svg: background rect not found, adjust ROUNDED_BACKGROUND')
}

/** Square background up to the edges, with the motif scaled around the centre. */
function fullBleed(scale) {
  return logo
    .replace(
      ROUNDED_BACKGROUND,
      `<rect width="64" height="64" fill="url(#logo-sky)" /><g transform="translate(32 32) scale(${scale}) translate(-32 -32)">`,
    )
    .replace('</svg>', '</g></svg>')
}

const icons = [
  { file: 'icon-192.png', size: 192, svg: logo },
  { file: 'icon-512.png', size: 512, svg: logo },
  // Safe zone: a circle of 80 % of the size must hold everything that matters.
  { file: 'maskable-512.png', size: 512, svg: fullBleed(0.72) },
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed(0.9) },
]

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
try {
  for (const { file, size, svg } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    await page.setContent(`<body style="margin:0"><img src="${src}" width="${size}" height="${size}">`)
    await page.screenshot({ path: join(outDir, file), omitBackground: true })
    await page.close()
    console.log(`frontend/public/icons/${file}`)
  }
} finally {
  await browser.close()
}
