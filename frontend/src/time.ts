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

/**
 * The most recent moment (up to now) with the given local wall-clock time "HH:MM":
 * today if it has passed, otherwise yesterday. Null if the input is not a valid time.
 */
export function latestPastTime(input: string, now: Date): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(input)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  const time = new Date(now)
  time.setHours(hours, minutes, 0, 0)
  if (time > now) time.setDate(time.getDate() - 1)
  return time
}
