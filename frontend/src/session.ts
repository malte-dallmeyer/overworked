import type { PauseOut, SessionOut } from './api'

// Mirrors WorkSession in the backend (models.py); keep both in sync.

/** ArbZG §4: only break parts of at least 15 minutes count towards the legal break. */
const MIN_LEGAL_BREAK_PART_MS = 15 * 60_000

type Span = { start: number; end: number; running: boolean }

/** Pause spans in ms, merged so overlapping pauses count once. A running pause lasts until `now`. */
function pauseSpans(session: SessionOut, now: Date): Span[] {
  const spans = session.pauses
    .map((p) => ({
      start: Date.parse(p.started_at),
      end: p.ended_at ? Date.parse(p.ended_at) : now.getTime(),
      running: p.ended_at === null,
    }))
    .sort((a, b) => a.start - b.start)
  const merged: Span[] = []
  for (const span of spans) {
    const last = merged.at(-1)
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end)
      last.running ||= span.running
    } else {
      merged.push({ ...span })
    }
  }
  return merged
}

/**
 * Legal break not covered by pauses yet. A running pause counts right away;
 * otherwise the end would first move and then jump back once it reaches 15 minutes.
 */
export function missingBreakMs(session: SessionOut, now: Date): number {
  const counted = pauseSpans(session, now)
    .filter((s) => s.running || s.end - s.start >= MIN_LEGAL_BREAK_PART_MS)
    .reduce((sum, s) => sum + s.end - s.start, 0)
  return Math.max(0, session.required_break_minutes * 60_000 - counted)
}

/**
 * When work is done: target plus pauses (planned ones included) plus the legal break
 * not taken yet. During a running pause beyond the legal break this moves along with `now`.
 */
export function endTime(session: SessionOut, now: Date): Date {
  const pausedMs = pauseSpans(session, now).reduce((sum, s) => sum + s.end - s.start, 0)
  return new Date(
    Date.parse(session.started_at) +
      session.target_minutes * 60_000 +
      pausedMs +
      missingBreakMs(session, now),
  )
}

/** Time until Feierabend. */
export function remainingMs(session: SessionOut, now: Date): number {
  return Math.max(0, endTime(session, now).getTime() - now.getTime())
}

/** The pause going on at `now`, spontaneous or planned. */
export function currentPause(session: SessionOut, now: Date): PauseOut | undefined {
  const nowMs = now.getTime()
  return session.pauses.find(
    (p) => Date.parse(p.started_at) <= nowMs && (p.ended_at === null || nowMs < Date.parse(p.ended_at)),
  )
}

/** The session with another target, its legal break taken from the backend's rules. */
export function withTarget(session: SessionOut, targetMinutes: number): SessionOut {
  const rule = session.legal_breaks.find((r) => targetMinutes > r.after_minutes)
  return { ...session, target_minutes: targetMinutes, required_break_minutes: rule?.break_minutes ?? 0 }
}

/** The target that moves Feierabend to `end`, if no legal break threshold is crossed. */
export function targetForEnd(session: SessionOut, end: Date, now: Date): number {
  return session.target_minutes + Math.round((end.getTime() - endTime(session, now).getTime()) / 60_000)
}
