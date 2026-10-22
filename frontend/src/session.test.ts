import { describe, expect, it } from 'vitest'
import { endTime, remainingMs } from './session'

const running = {
  started_at: '2026-10-22T06:00:00Z',
  target_minutes: 450,
  paused_seconds: 0,
  paused_since: null,
}

const paused = {
  ...running,
  paused_seconds: 10 * 60,
  paused_since: '2026-10-22T10:00:00Z',
}

const at = (time: string) => new Date(`2026-10-22T${time}Z`)

describe('endTime', () => {
  it('is start plus target for a session without pauses', () => {
    expect(endTime(running, at('11:00:00'))).toEqual(at('13:30:00'))
  })

  it('is shifted by finished pauses', () => {
    expect(endTime({ ...running, paused_seconds: 30 * 60 }, at('11:00:00'))).toEqual(at('14:00:00'))
  })

  it('moves along with time during a pause', () => {
    expect(endTime(paused, at('11:00:00'))).toEqual(at('14:40:00'))
    expect(endTime(paused, at('11:30:00'))).toEqual(at('15:10:00'))
  })
})

describe('remainingMs', () => {
  it('counts down while running', () => {
    expect(remainingMs(running, at('11:00:00'))).toBe(150 * 60_000)
    expect(remainingMs(running, at('11:00:01'))).toBe(150 * 60_000 - 1000)
  })

  it('stands still during a pause', () => {
    expect(remainingMs(paused, at('11:00:00'))).toBe(220 * 60_000)
    expect(remainingMs(paused, at('12:00:00'))).toBe(220 * 60_000)
  })

  it('does not go below zero', () => {
    expect(remainingMs(running, at('20:00:00'))).toBe(0)
  })
})
