import type { SessionOut } from './api'

/** When work is done. During a pause this moves along with `now`. */
export function endTime(session: SessionOut, now: Date): Date {
  const runningPauseMs = session.paused_since ? now.getTime() - Date.parse(session.paused_since) : 0
  return new Date(
    Date.parse(session.started_at) +
      session.target_minutes * 60_000 +
      session.paused_seconds * 1000 +
      runningPauseMs,
  )
}

/** Work time left; stands still during a pause. */
export function remainingMs(session: SessionOut, now: Date): number {
  return Math.max(0, endTime(session, now).getTime() - now.getTime())
}
