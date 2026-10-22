import { http, HttpResponse, sse } from 'msw'
import { setupWorker } from 'msw/browser'

// Defaults every test can rely on and override: the quick choices of a fresh instance,
// and a silent live-update stream (no other device changes anything).
export const worker = setupWorker(
  http.get('/api/targets', () => HttpResponse.json({ last: 480, choices: [450, 480], max_minutes: 600 })),
  sse('/api/session/events', () => {}),
)
