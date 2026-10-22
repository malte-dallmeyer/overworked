import { describe, expect, it } from 'vitest'
import { currentPause, endTime, hint, missingBreakMs, remainingMs, targetForEnd, withTarget, workedMs } from './session'

const at = (time: string) => new Date(`2026-10-22T${time}Z`)
const iso = (time: string) => `2026-10-22T${time}Z`

// No legal break here, to keep these tests about pauses; see the legal break tests below.
const running = {
  started_at: iso('06:00:00'),
  target_minutes: 450,
  required_break_minutes: 0,
  pauses: [],
  snoozed_until: null,
  legal_breaks: [
    { after_minutes: 540, break_minutes: 45 },
    { after_minutes: 360, break_minutes: 30 },
  ],
  max_work_minutes: 600,
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

describe('adjusting the target', () => {
  // 7 h + 30 min legal break from 06:00: ends 13:30.
  const sevenHours = { ...running, target_minutes: 420, required_break_minutes: 30 }

  it('previews the end with another target', () => {
    expect(endTime(withTarget(sevenHours, 435), at('09:00:00'))).toEqual(at('13:45:00'))
  })

  it('applies the legal break rules of the new target', () => {
    const sixHours = { ...running, target_minutes: 360 }
    expect(endTime(withTarget(sixHours, 375), at('09:00:00'))).toEqual(at('12:45:00'))
    expect(endTime(withTarget(sevenHours, 545), at('09:00:00'))).toEqual(at('15:50:00'))
  })

  it('finds the target for a wished end', () => {
    expect(targetForEnd(sevenHours, at('14:00:00'), at('09:00:00'))).toBe(450)
  })
})

describe('workedMs', () => {
  it('leaves out pauses taken and planned ones still ahead', () => {
    const withPauses = {
      ...running,
      pauses: [
        { id: 1, started_at: iso('07:00:00'), ended_at: iso('07:30:00') },
        { id: 2, started_at: iso('12:00:00'), ended_at: iso('13:00:00') },
      ],
    }
    expect(workedMs(withPauses, at('12:30:00'))).toBe(5.5 * 3600_000)
  })
})

describe('hint', () => {
  const lunchTaken = { id: 1, started_at: iso('07:00:00'), ended_at: iso('07:30:00') }
  const tenHours = { ...running, target_minutes: 600, required_break_minutes: 45, pauses: [lunchTaken] }

  it('says nothing most of the day', () => {
    expect(hint(running, at('11:00:00'))).toBeNull()
  })

  it('tells that the legal break is due a quarter of an hour ahead', () => {
    expect(hint(running, at('11:44:00'))).toBeNull()
    expect(hint(running, at('11:45:00'))).toBe('Pflichtpause fällig: Nach 6 h Arbeit brauchst du 30 min Pause.')
  })

  it('counts only pauses of at least 15 minutes as legal break', () => {
    const coffee = { ...running, pauses: [{ id: 1, started_at: iso('07:00:00'), ended_at: iso('07:10:00') }] }
    expect(hint(coffee, at('12:00:00'))).toBe('Pflichtpause fällig: Nach 6 h Arbeit brauchst du 30 min Pause.')
    expect(hint({ ...running, pauses: [lunchTaken] }, at('12:15:00'))).toBeNull()
  })

  it('tells about the longer legal break after nine hours', () => {
    expect(hint(tenHours, at('15:15:00'))).toBe('Pflichtpause fällig: Nach 9 h Arbeit brauchst du 45 min Pause.')
  })

  it('announces Feierabend in the last quarter of an hour', () => {
    const day = { ...running, pauses: [lunchTaken] } // ends 14:00
    expect(hint(day, at('13:48:00'))).toBe('Feierabend in 12 min – Zeit, langsam abzuschließen.')
  })

  it('warns before and at ten hours of work, above everything else', () => {
    const longDay = { ...tenHours, pauses: [{ ...lunchTaken, ended_at: iso('07:45:00') }] }
    expect(hint(longDay, at('16:35:00'))).toBe('In 10 min erreichst du die gesetzliche Höchstarbeitszeit von 10 Stunden.')
    expect(hint(longDay, at('16:45:00'))).toBe('10 Stunden erreicht – mehr erlaubt das Arbeitszeitgesetz nicht.')
  })

  it('stays quiet during a pause', () => {
    expect(hint(paused, at('11:50:00'))).toBeNull()
  })
})
