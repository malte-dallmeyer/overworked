import { defineConfig, devices } from '@playwright/test'

const PORT = 8899
const DB = '.tmp/e2e.db'
export const PASSWORD = 'e2e password'
/** Login cookie the setup project stores; every test starts logged in. */
export const AUTH_STATE = '.tmp/auth.json'

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
    { name: 'login', testMatch: /login\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE }, dependencies: ['login'] },
    { name: 'mobile', use: { ...devices['Pixel 7'], storageState: AUTH_STATE }, dependencies: ['login'] },
  ],
  // Production-like: FastAPI serves the built frontend with login, backed by a fresh SQLite file.
  webServer: {
    command: [
      `rm -f ${DB}`,
      'npm --prefix ../frontend run build',
      `cd ../backend && uv run uvicorn overworked.main:create_app --factory --port ${PORT}`,
    ].join(' && '),
    env: {
      OVERWORKED_STATIC_DIR: '../frontend/dist',
      OVERWORKED_DATABASE_URL: `sqlite:///../e2e/${DB}`,
      OVERWORKED_REQUIRE_PASSWORD: 'true',
      OVERWORKED_PASSWORD: PASSWORD,
      OVERWORKED_SECRET_KEY: 'e2e-secret-key-only-for-tests-0000',
    },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
