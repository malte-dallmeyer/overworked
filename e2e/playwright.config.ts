import { defineConfig, devices } from '@playwright/test'

const PORT = 8899
const DB = '.tmp/e2e.db'

export default defineConfig({
  testDir: './tests',
  // All tests share one server and one (single) user, so they must not run concurrently.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    [process.env.CI ? 'github' : 'list'],
    // Contains a trace viewer per test; `npm run test:e2e:report` serves the latest one.
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Production-like: FastAPI serves the built frontend, backed by a fresh SQLite file.
  webServer: {
    command: [
      `rm -f ${DB}`,
      'npm --prefix ../frontend run build',
      `cd ../backend && OVERWORKED_STATIC_DIR=../frontend/dist OVERWORKED_DATABASE_URL=sqlite:///../e2e/${DB} uv run uvicorn overworked.main:create_app --factory --port ${PORT}`,
    ].join(' && '),
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
