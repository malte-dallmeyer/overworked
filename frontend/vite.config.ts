import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { msw } from 'msw/vite'
import { defineConfig } from 'vitest/config'

// Displayed clock times depend on the timezone; pin it so tests are deterministic.
const TIMEZONE = 'Europe/Berlin'
process.env.TZ = TIMEZONE

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        // Serves mockServiceWorker.js to the test browser only; never part of the app build.
        plugins: [msw({ mode: 'worker-only' })],
        // Pre-bundle up front; otherwise Vite re-optimizes mid-run and reloads the tests.
        optimizeDeps: { include: ['react-dom/client', 'vitest-browser-react', 'msw', 'msw/browser'] },
        test: {
          name: 'component',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/test/setup-browser.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              contextOptions: { locale: 'de-DE', timezoneId: TIMEZONE },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
