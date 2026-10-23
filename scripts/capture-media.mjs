#!/usr/bin/env node
// Erzeugt die Screenshots und das Demo-Video für das README in docs/media/:
// baut das Frontend, startet einen Wegwerf-Server (ohne Login, frische Datenbank) und
// klickt sich mit Playwright in Handy-Größe durch die App. Nach Änderungen an der
// Oberfläche ausführen und die Dateien committen.
//
// Aufruf: node scripts/capture-media.mjs
//
// Braucht ffmpeg im PATH (für demo.gif und demo.mp4 aus der Aufnahme).

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseCli, ROOT, runAll } from './lib/cli.mjs'

parseCli(import.meta.url)

if (spawnSync('ffmpeg', ['-version']).status !== 0) {
  console.error('ffmpeg fehlt: installieren und erneut ausführen.')
  process.exit(1)
}

const PORT = 8897
const BASE = `http://localhost:${PORT}`
const OUT = join(ROOT, 'docs', 'media')
const MIN = 60_000
// Playwright lives in e2e/ (the tests), not in the scripts.
const { chromium, devices } = createRequire(join(ROOT, 'e2e', 'package.json'))('@playwright/test')

await runAll([['npm', ['run', 'build'], { cwd: join(ROOT, 'frontend') }]])

// --- Demo clock -------------------------------------------------------------------------
// Server and browser run on a demo clock, so the media show the same times whenever they are
// made: one Wednesday in June, in Berlin. The server reads its offset from a file, so each
// picture can be taken at the time of day it shows; both clocks keep ticking from there.

const work = mkdtempSync(join(tmpdir(), 'overworked-media-'))
const offsetFile = join(work, 'clock-offset-ms')
let offset = 0

/** Moves the demo clock to "HH:MM" Berlin summer time on the demo day. */
function setDemoTime(time) {
  offset = Date.parse(`2026-06-17T${time}:00+02:00`) - Date.now()
  writeFileSync(offsetFile, `${offset}`)
}
const now = () => Date.now() + offset
const iso = (minutesFromNow) => new Date(now() + minutesFromNow * MIN).toISOString()

// The app with that clock, the way the tests inject theirs; production code is untouched.
const launcher = join(work, 'serve.py')
writeFileSync(
  launcher,
  `import os, pathlib, uvicorn
from datetime import UTC, datetime, timedelta
from overworked.main import create_app

offset_file = pathlib.Path(os.environ["DEMO_CLOCK_OFFSET_FILE"])

def demo_clock():
    return datetime.now(UTC) + timedelta(milliseconds=int(offset_file.read_text()))

uvicorn.run(create_app(clock=demo_clock), port=${PORT}, log_level="warning", timeout_graceful_shutdown=1)
`,
)
setDemoTime('11:15')

const server = spawn('uv', ['run', 'python', launcher], {
  cwd: join(ROOT, 'backend'),
  env: {
    ...process.env,
    DEMO_CLOCK_OFFSET_FILE: offsetFile,
    OVERWORKED_STATIC_DIR: '../frontend/dist',
    OVERWORKED_DATABASE_URL: `sqlite:///${join(work, 'media.db')}`,
    OVERWORKED_PASSWORD: '',
  },
  stdio: 'ignore',
  shell: process.platform === 'win32',
})

// Chromium's own controls (time inputs) follow the system language, not the context locale.
const browser = await chromium.launch({ args: ['--lang=de-DE'], env: { ...process.env, LANG: 'de_DE.UTF-8' } })

// --- Helpers ----------------------------------------------------------------------------

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error('Server did not start')
}

async function phone(options = {}) {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    ...options,
  })
  await context.clock.install({ time: now() })
  return context
}

/** A session that began `startedAgo` minutes ago, with pauses as [from, to] minutes from now. */
async function givenSession(request, target, startedAgo, pauses = []) {
  await request.post(`${BASE}/api/session/current/end`)
  await request.post(`${BASE}/api/session`, { data: { target_minutes: target, started_at: iso(-startedAgo) } })
  for (const [from, to] of pauses) {
    await request.post(`${BASE}/api/session/current/pauses`, { data: { started_at: iso(from), ended_at: iso(to) } })
  }
}

async function shot(name, { at, scheme = 'light', setup, act }) {
  setDemoTime(at)
  const context = await phone({ colorScheme: scheme })
  const page = await context.newPage()
  await setup?.(context.request)
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Overworked' }).waitFor()
  await act?.(page)
  await page.waitForTimeout(2500) // the sky fades in
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  await context.close()
  console.log(`docs/media/${name}.png`)
}

// --- Pictures ---------------------------------------------------------------------------

async function screenshots() {
  // Started 08:45 with a coffee break, lunch planned at 12:30.
  const morning = (r) => givenSession(r, 480, 150, [[-90, -75], [75, 105]])
  // Started 08:30, lunch taken: Feierabend just now, 16:30.
  const evening = (r) => givenSession(r, 450, 480, [[-240, -210]])

  await shot('start', { at: '08:40', setup: (r) => r.post(`${BASE}/api/session/current/end`) })
  await shot('running', { at: '11:15', setup: morning })
  await shot('pauses', {
    at: '11:15',
    setup: morning,
    act: (page) => page.getByRole('button', { name: /^Pausen/ }).click(),
  })
  await shot('alarm', { at: '16:30', setup: evening })
  await shot('extend-warning', {
    at: '16:30',
    setup: evening,
    act: async (page) => {
      await page.getByRole('button', { name: 'Restzeit anpassen' }).click()
      await page.getByRole('button', { name: '15 Minuten später' }).click()
    },
  })
  await shot('dark', { at: '14:40', scheme: 'dark', setup: (r) => givenSession(r, 480, 370, [[-180, -150]]) })
}

async function demoVideo() {
  setDemoTime('08:30')
  const videoDir = join(work, 'video')
  const context = await phone({ recordVideo: { dir: videoDir, size: devices['Pixel 7'].viewport } })
  const page = await context.newPage()
  const pause = (ms = 1200) => page.waitForTimeout(ms)
  const clockTime = (minutesFromNow) =>
    new Date(now() + minutesFromNow * MIN).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin',
    })
  await context.request.post(`${BASE}/api/session/current/end`)

  // Morning: start with a quick choice, plan lunch, adjust the day.
  await page.goto(BASE)
  await pause(2000)
  await page.getByRole('button', { name: '7:30 h' }).click()
  await pause()
  await page.getByRole('button', { name: 'Jetzt starten' }).click()
  await pause(2500)

  await page.getByRole('button', { name: /^Pausen/ }).click()
  await pause()
  // fill(): simulated typing does not reach Chromium's time inputs reliably.
  for (const [label, minutes] of [['Pause von', 240], ['Pause bis', 270]]) {
    await page.getByLabel(label).fill(clockTime(minutes))
    await pause(700)
  }
  await pause(600)
  await page.getByRole('button', { name: 'Pause eintragen' }).click()
  await pause(2000)
  await page.getByRole('button', { name: 'Schließen' }).click()
  await pause(2000)

  await page.getByRole('button', { name: 'Restzeit anpassen' }).click()
  await pause()
  await page.getByRole('button', { name: '15 Minuten früher' }).click()
  await pause()
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await pause(2500)

  // Fast forward to the afternoon of the same day: Feierabend. Snooze once, then stop.
  setDemoTime('16:30')
  await page.clock.setSystemTime(now())
  await givenSession(context.request, 450, 480, [[-240, -210]])
  await page.reload()
  await pause(3500)
  await page.getByRole('button', { name: '10 min später' }).click()
  await pause(2500)
  await page.getByRole('button', { name: 'Feierabend machen' }).click()
  await pause(2500)

  await context.close()
  const [recording] = readdirSync(videoDir)
  const source = join(videoDir, recording)
  const gif = 'fps=12,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer'
  const mp4 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-movflags', '+faststart']
  await runAll([
    ['ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-vf', gif, join(OUT, 'demo.gif')]],
    ['ffmpeg', ['-y', '-loglevel', 'error', '-i', source, ...mp4, join(OUT, 'demo.mp4')]],
  ])
  console.log('docs/media/demo.gif\ndocs/media/demo.mp4')
}

try {
  await waitForServer()
  mkdirSync(OUT, { recursive: true })
  await screenshots()
  await demoVideo()
} finally {
  await browser.close()
  server.kill()
  rmSync(work, { recursive: true, force: true })
}
