import { describe, expect, it } from 'vitest'
import { currentPause, endTime, remainingMs } from './session'

const at = (time: string) => new Date(`2026-10-22T${time}Z`)
const iso = (time: string) => `2026-10-22T${time}Z`

const running = {
  started_at: iso('06:00:00'),
  target_minutes: 450,
  pauses: [],
}

// An earlier 10-minute pause, and a spontaneous pause running since 10:00.
const paused = {
  ...running,
  pauses: [
    { id: 1, started_at: iso('07:00:00'), ended_at: iso('07:10:00') },
    { id: 2, started_at: iso('10:00:00'), ended_at: null },
  ],
}

// A pause planned for later.
const planned = {
  ...running,
  pauses: [{ id: 1, started_at: iso('12:00:00'), ended_at: iso('12:45:00') }],
}

describe('endTime', () => {
  it('is start plus target for a session without pauses', () => {
    expect(endTime(running, at('11:00:00'))).toEqual(at('13:30:00'))
  })

  it('moves along with time during a running pause', () => {
    expect(endTime(paused, at('11:00:00'))).toEqual(at('14:40:00'))
    expect(endTime(paused, at('11:30:00'))).toEqual(at('15:10:00'))
  })

  it('includes a planned pause right away', () => {
    expect(endTime(planned, at('11:00:00'))).toEqual(at('14:15:00'))
  })

  it('counts overlapping pauses once', () => {
    const overlapping = {
      ...running,
      pauses: [
        { id: 1, started_at: iso('12:00:00'), ended_at: iso('12:45:00') },
        { id: 2, started_at: iso('12:30:00'), ended_at: iso('13:00:00') },
      ],
    }
    expect(endTime(overlapping, at('11:00:00'))).toEqual(at('14:30:00'))
  })
})

describe('remainingMs', () => {
  it('counts down while working', () => {
    expect(remainingMs(running, at('11:00:00'))).toBe(150 * 60_000)
    expect(remainingMs(running, at('11:00:01'))).toBe(150 * 60_000 - 1000)
  })

  it('stands still during a running pause', () => {
    expect(remainingMs(paused, at('11:00:00'))).toBe(220 * 60_000)
    expect(remainingMs(paused, at('12:00:00'))).toBe(220 * 60_000)
  })

  it('does not count a planned pause as work time', () => {
    expect(remainingMs(planned, at('11:00:00'))).toBe(150 * 60_000)
  })

  it('stands still during a planned pause', () => {
    expect(remainingMs(planned, at('12:10:00'))).toBe(90 * 60_000)
    expect(remainingMs(planned, at('12:40:00'))).toBe(90 * 60_000)
  })

  it('does not go below zero', () => {
    expect(remainingMs(running, at('20:00:00'))).toBe(0)
  })
})

describe('currentPause', () => {
  it('is the running spontaneous pause', () => {
    expect(currentPause(paused, at('11:00:00'))?.id).toBe(2)
  })

  it('is a planned pause while it lasts', () => {
    expect(currentPause(planned, at('11:59:59'))).toBeUndefined()
    expect(currentPause(planned, at('12:00:00'))?.id).toBe(1)
    expect(currentPause(planned, at('12:45:00'))).toBeUndefined()
  })
})
