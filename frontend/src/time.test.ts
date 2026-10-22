import { describe, expect, it } from 'vitest'
import {
  formatClockTime,
  formatCountdown,
  formatDuration,
  latestPastTime,
  parseDuration,
  timeOnOrAfter,
} from './time'

describe('parseDuration', () => {
  it.each([
    ['8:00', 480],
    ['7:30', 450],
    ['0:45', 45],
    [' 8:05 ', 485],
    ['8', 480],
    // Phone number pads have no colon: comma, dot or just digits work as well.
    ['7,30', 450],
    ['7.30', 450],
    ['730', 450],
    ['0730', 450],
    ['1015', 615],
  ])('reads %j as %i minutes', (input, minutes) => {
    expect(parseDuration(input)).toBe(minutes)
  })

  // "7,5" could mean 7:05 or 7.5 hours, so minutes always take two digits.
  it.each(['', 'abc', '7:60', '0:00', '25:00', '7:5', '7,5', '760', '12345'])('rejects %j', (input) => {
    expect(parseDuration(input)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('formats minutes as h:mm', () => {
    expect(formatDuration(450)).toBe('7:30')
    expect(formatDuration(485)).toBe('8:05')
  })
})

describe('formatCountdown', () => {
  it('shows hours and minutes', () => {
    expect(formatCountdown((2 * 3600 + 24 * 60) * 1000)).toBe('2:24')
  })

  it('rounds up to whole minutes, so it shows 0:00 only at Feierabend', () => {
    expect(formatCountdown((2 * 3600 + 24 * 60 + 1) * 1000)).toBe('2:25')
    expect(formatCountdown(1000)).toBe('0:01')
    expect(formatCountdown(0)).toBe('0:00')
  })
})

describe('formatClockTime', () => {
  it('shows local wall-clock time', () => {
    expect(formatClockTime(new Date('2026-10-22T13:30:00Z'))).toBe('15:30')
  })
})

describe('latestPastTime', () => {
  // 13:00 in Berlin
  const now = new Date('2026-10-22T11:00:00Z')

  it('is today when the time has already passed', () => {
    expect(latestPastTime('07:45', now)).toEqual(new Date('2026-10-22T05:45:00Z'))
  })

  it('is now for the current minute', () => {
    expect(latestPastTime('13:00', now)).toEqual(new Date('2026-10-22T11:00:00Z'))
  })

  it('is yesterday when the time is still ahead, e.g. working past midnight', () => {
    const shortlyAfterMidnight = new Date('2026-10-22T22:30:00Z') // 00:30 in Berlin
    expect(latestPastTime('22:00', shortlyAfterMidnight)).toEqual(new Date('2026-10-22T20:00:00Z'))
  })

  it.each(['', '7', '24:00', '12:60', 'abc'])('rejects %j', (input) => {
    expect(latestPastTime(input, now)).toBeNull()
  })
})

describe('timeOnOrAfter', () => {
  // Work started 08:00 in Berlin.
  const workStart = new Date('2026-10-22T06:00:00Z')

  it('is the same day for a later time', () => {
    expect(timeOnOrAfter('12:30', workStart)).toEqual(new Date('2026-10-22T10:30:00Z'))
  })

  it('is the next day for an earlier time, e.g. a night shift', () => {
    const lateStart = new Date('2026-10-22T18:00:00Z') // 20:00 in Berlin
    expect(timeOnOrAfter('01:00', lateStart)).toEqual(new Date('2026-10-22T23:00:00Z'))
  })

  it('rejects invalid input', () => {
    expect(timeOnOrAfter('', workStart)).toBeNull()
  })
})
