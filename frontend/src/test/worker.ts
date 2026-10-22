import { sse } from 'msw'
import { setupWorker } from 'msw/browser'

// By default no other device changes anything: the live-update stream stays silent.
export const worker = setupWorker(sse('/api/session/events', () => {}))
