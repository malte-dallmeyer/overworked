import { test as base, type APIRequestContext } from '@playwright/test'

export { expect } from '@playwright/test'

export type WorkSession = {
  started_at: string
  target_minutes: number
  pauses: { id: number; started_at: string; ended_at: string | null }[]
}

export async function currentSession(request: APIRequestContext): Promise<WorkSession | null> {
  return (await request.get('/api/session/current')).json()
}

/** End of a session without pauses. */
export function plannedEnd(session: WorkSession): Date {
  return new Date(Date.parse(session.started_at) + session.target_minutes * 60_000)
}

/** Formats like the app does for a German user in Berlin. */
export function clockTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
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
