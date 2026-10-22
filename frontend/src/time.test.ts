import { describe, expect, it } from 'vitest'
import { formatClockTime, formatCountdown, formatDuration, parseDuration } from './time'

describe('parseDuration', () => {
  it.each([
    ['8:00', 480],
    ['7:30', 450],
    ['0:45', 45],
    [' 8:05 ', 485],
    ['8', 480],
  ])('reads %j as %i minutes', (input, minutes) => {
    expect(parseDuration(input)).toBe(minutes)
  })

  it.each(['', 'abc', '7:60', '0:00', '25:00', '7:5'])('rejects %j', (input) => {
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
  it('shows hours, minutes and seconds', () => {
    expect(formatCountdown((2 * 3600 + 24 * 60 + 30) * 1000)).toBe('2:24:30')
  })

  it('drops partial seconds', () => {
    expect(formatCountdown(1999)).toBe('0:00:01')
  })
})

describe('formatClockTime', () => {
  it('shows local wall-clock time', () => {
    expect(formatClockTime(new Date('2026-10-22T13:30:00Z'))).toBe('15:30')
  })
})
