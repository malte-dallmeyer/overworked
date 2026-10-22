// Re-runs the e2e suite whenever app or test code changes.
// Headless runs record a trace for every test and serve the HTML report, whose
// "View trace" links open each test in the Playwright trace viewer.
import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { extname, join } from 'node:path'
import { ROOT } from './cli.mjs'

const E2E_DIR = join(ROOT, 'e2e')
const WATCHED = [
  'frontend/src',
  'frontend/index.html',
  'backend/src',
  'e2e/tests',
  'e2e/playwright.config.ts',
].map((path) => join(ROOT, path))
const WATCHED_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.py'])
const REPORT_PORT = '9324'
const shell = process.platform === 'win32'

export function watchE2e({ headed, playwrightArgs }) {
  let running = false
  let rerunRequested = false
  let reportServer = null
  let debounce = null

  function runTests() {
    if (running) {
      rerunRequested = true
      return
    }
    running = true
    const args = ['playwright', 'test', ...(headed ? ['--headed'] : ['--trace', 'on']), ...playwrightArgs]
    spawn('npx', args, { cwd: E2E_DIR, stdio: 'inherit', shell }).on('exit', () => {
      running = false
      if (!headed) showReport()
      if (rerunRequested) {
        rerunRequested = false
        runTests()
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
      cwd: E2E_DIR,
      stdio: 'inherit',
      shell,
      detached: !shell,
    })
  }

  for (const path of WATCHED) {
    watch(path, { recursive: true }, (_event, file) => {
      if (file && !WATCHED_EXTENSIONS.has(extname(file))) return
      clearTimeout(debounce)
      debounce = setTimeout(runTests, 300)
    })
  }

  // SIGHUP: closing the terminal or stopping a VS Code task only signals the foreground group.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      if (reportServer && !shell) process.kill(-reportServer.pid, 'SIGTERM')
      else reportServer?.kill()
      process.exit(0)
    })
  }

  runTests()
}
