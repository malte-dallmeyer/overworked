import type { PauseOut, SessionOut } from './api'

type Span = { start: number; end: number }

/** Pause spans in ms, merged so overlapping pauses count once. A running pause lasts until `now`. */
function pauseSpans(session: SessionOut, now: Date): Span[] {
  const spans = session.pauses
    .map((p) => ({ start: Date.parse(p.started_at), end: p.ended_at ? Date.parse(p.ended_at) : now.getTime() }))
    .sort((a, b) => a.start - b.start)
  const merged: Span[] = []
  for (const span of spans) {
    const last = merged.at(-1)
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end)
    else merged.push({ ...span })
  }
  return merged
}

/** When work is done, planned pauses included. During a running pause this moves along with `now`. */
export function endTime(session: SessionOut, now: Date): Date {
  const pausedMs = pauseSpans(session, now).reduce((sum, s) => sum + s.end - s.start, 0)
  return new Date(Date.parse(session.started_at) + session.target_minutes * 60_000 + pausedMs)
}

/** Work time left; stands still during any pause. */
export function remainingMs(session: SessionOut, now: Date): number {
  const nowMs = now.getTime()
  const pauseAheadMs = pauseSpans(session, now).reduce(
    (sum, s) => sum + Math.max(0, s.end - Math.max(s.start, nowMs)),
    0,
  )
  return Math.max(0, endTime(session, now).getTime() - nowMs - pauseAheadMs)
}

/** The pause going on at `now`, spontaneous or planned. */
export function currentPause(session: SessionOut, now: Date): PauseOut | undefined {
  const nowMs = now.getTime()
  return session.pauses.find(
    (p) => Date.parse(p.started_at) <= nowMs && (p.ended_at === null || nowMs < Date.parse(p.ended_at)),
  )
}
