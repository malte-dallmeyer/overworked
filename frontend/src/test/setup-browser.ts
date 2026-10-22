import { afterAll, afterEach, beforeAll } from 'vitest'
import { worker } from './worker'

beforeAll(async () => {
  await worker.start({
    quiet: true,
    // The worker also sees Vite's module requests; only unmocked API calls are test bugs.
    onUnhandledFrame({ frame, defaults }) {
      const { request } = frame.data as { request?: Request }
      if (request && new URL(request.url).pathname.startsWith('/api/')) defaults.error()
    },
  })
})
afterEach(() => worker.resetHandlers())
afterAll(() => worker.stop())
