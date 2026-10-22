// Re-runs the e2e suite whenever app or test code changes. Run from e2e/ via
// scripts/test-e2e.sh --watch; extra arguments are passed on to `playwright test`.
// Headless runs record a trace for every test and serve the HTML report, whose
// "View trace" links open each test in the Playwright trace viewer.
import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { extname } from 'node:path'

const headed = process.argv.includes('--headed')
const playwrightArgs = process.argv.slice(2).filter((arg) => arg !== '--headed')
const WATCHED_DIRS = ['../frontend/src', '../frontend/index.html', '../backend/src', 'tests', 'playwright.config.ts']
const WATCHED_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.py'])
const REPORT_PORT = '9324'

let running = false
let rerunRequested = false
let reportServer = null
let debounce = null

function run() {
  if (running) {
    rerunRequested = true
    return
  }
  running = true
  const args = ['playwright', 'test', ...(headed ? ['--headed'] : ['--trace', 'on']), ...playwrightArgs]
  spawn('npx', args, { stdio: 'inherit' }).on('exit', () => {
    running = false
    if (!headed) showReport()
    if (rerunRequested) {
      rerunRequested = false
      run()
    } else {
      console.log('\nWarte auf Änderungen …')
    }
  })
}

function showReport() {
  if (reportServer) {
    console.log(`\nReport mit Traces aktualisiert: http://localhost:${REPORT_PORT} (Seite neu laden)`)
    return
  }
  // Opens the browser once; it serves from disk, so later runs only need a reload.
  // Own process group, so stopping the watcher can take down npx and everything below it.
  reportServer = spawn('npx', ['playwright', 'show-report', '--port', REPORT_PORT], {
    stdio: 'inherit',
    detached: true,
  })
}

for (const path of WATCHED_DIRS) {
  watch(path, { recursive: true }, (_event, file) => {
    if (file && !WATCHED_EXTENSIONS.has(extname(file))) return
    clearTimeout(debounce)
    debounce = setTimeout(run, 300)
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (reportServer) process.kill(-reportServer.pid, 'SIGTERM')
    process.exit(0)
  })
}

run()
