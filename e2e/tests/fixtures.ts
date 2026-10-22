import { test as base, type APIRequestContext } from '@playwright/test'

export { expect } from '@playwright/test'

export type WorkSession = { started_at: string; target_minutes: number; end_at: string }

export async function currentSession(request: APIRequestContext): Promise<WorkSession | null> {
  return (await request.get('/api/session/current')).json()
}

/** Formats like the app does for a German user in Berlin. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  })
}

export const test = base.extend<{ noRunningSession: void }>({
  noRunningSession: [
    async ({ request }, use) => {
      // 404 just means nothing was running.
      await request.post('/api/session/current/end')
      await use()
    },
    { auto: true },
  ],
})
