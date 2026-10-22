const MAX_MINUTES = 24 * 60

/** Parses "h:mm" or "h" into minutes; null if invalid or out of range. */
export function parseDuration(input: string): number | null {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(input.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  const total = hours * 60 + minutes
  if (minutes >= 60 || total < 1 || total > MAX_MINUTES) return null
  return total
}

export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`
}

export function formatCountdown(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const hours = Math.floor(seconds / 3600)
  return `${hours}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`
}

export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Parses a wall-clock time "HH:MM" (as delivered by <input type="time">). */
function parseClockTime(input: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(input)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours > 23 || minutes > 59 ? null : { hours, minutes }
}

function atClockTime(day: Date, time: { hours: number; minutes: number }): Date {
  const result = new Date(day)
  result.setHours(time.hours, time.minutes, 0, 0)
  return result
}

/**
 * The most recent moment (up to now) with the given local wall-clock time "HH:MM":
 * today if it has passed, otherwise yesterday. Null if the input is not a valid time.
 */
export function latestPastTime(input: string, now: Date): Date | null {
  const time = parseClockTime(input)
  if (!time) return null
  const result = atClockTime(now, time)
  if (result > now) result.setDate(result.getDate() - 1)
  return result
}

/**
 * The first moment at or after `reference` with the given local wall-clock time "HH:MM",
 * e.g. a pause time within the work day that began at `reference`.
 */
export function timeOnOrAfter(input: string, reference: Date): Date | null {
  const time = parseClockTime(input)
  if (!time) return null
  const result = atClockTime(reference, time)
  if (result < reference) result.setDate(result.getDate() + 1)
  return result
}
