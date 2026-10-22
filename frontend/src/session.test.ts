import { describe, expect, it } from 'vitest'
import { currentPause, endTime, missingBreakMs, remainingMs } from './session'

const at = (time: string) => new Date(`2026-10-22T${time}Z`)
const iso = (time: string) => `2026-10-22T${time}Z`

// No legal break here, to keep these tests about pauses; see the legal break tests below.
const running = {
  started_at: iso('06:00:00'),
  target_minutes: 450,
  required_break_minutes: 0,
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

  it('is the time until Feierabend, planned pauses included', () => {
    expect(remainingMs(planned, at('11:00:00'))).toBe(195 * 60_000)
  })

  it('keeps counting down during a planned pause, since the end is fixed', () => {
    expect(remainingMs(planned, at('12:10:00'))).toBe(125 * 60_000)
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

describe('legal break', () => {
  const eightHours = { ...running, target_minutes: 480, required_break_minutes: 30 }

  it('extends the end as long as it has not been taken', () => {
    expect(endTime(eightHours, at('09:00:00'))).toEqual(at('14:30:00'))
    expect(missingBreakMs(eightHours, at('09:00:00'))).toBe(30 * 60_000)
  })

  it('is covered by a pause of 30 minutes', () => {
    const withLunch = {
      ...eightHours,
      pauses: [{ id: 1, started_at: iso('10:00:00'), ended_at: iso('10:30:00') }],
    }
    expect(endTime(withLunch, at('11:00:00'))).toEqual(at('14:30:00'))
    expect(missingBreakMs(withLunch, at('11:00:00'))).toBe(0)
  })

  it('is not covered by pauses shorter than 15 minutes', () => {
    const withCoffee = {
      ...eightHours,
      pauses: [{ id: 1, started_at: iso('10:00:00'), ended_at: iso('10:10:00') }],
    }
    expect(endTime(withCoffee, at('11:00:00'))).toEqual(at('14:40:00'))
  })

  it('holds the end during a running pause until it is used up', () => {
    const pausing = { ...eightHours, pauses: [{ id: 1, started_at: iso('10:00:00'), ended_at: null }] }
    expect(endTime(pausing, at('10:20:00'))).toEqual(at('14:30:00'))
    expect(endTime(pausing, at('10:45:00'))).toEqual(at('14:45:00'))
  })
})
