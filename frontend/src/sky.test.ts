import { describe, expect, it } from 'vitest'
import { dayProgress, skyAt } from './sky'

describe('dayProgress', () => {
  const start = new Date('2026-10-22T06:00:00Z')
  const end = new Date('2026-10-22T14:00:00Z')

  it('goes from 0 at the start to 1 at Feierabend', () => {
    expect(dayProgress(start, end, start)).toBe(0)
    expect(dayProgress(start, end, new Date('2026-10-22T10:00:00Z'))).toBe(0.5)
    expect(dayProgress(start, end, end)).toBe(1)
  })

  it('keeps growing after Feierabend, up to a limit', () => {
    expect(dayProgress(start, end, new Date('2026-10-22T15:00:00Z'))).toBeCloseTo(1.125)
    expect(dayProgress(start, end, new Date('2026-10-23T06:00:00Z'))).toBe(1.25)
  })
})

describe('skyAt', () => {
  it('is a light morning sky with dark text at the start', () => {
    const sky = skyAt(0, 'light')
    expect(sky.text).toBe('dark')
  })

  it('turns into a dusk sky with light text at Feierabend', () => {
    expect(skyAt(1, 'light').text).toBe('light')
  })

  it('blends between neighbouring colours', () => {
    const before = skyAt(0.6, 'light').top
    const after = skyAt(0.7, 'light').top
    expect(before).not.toBe(after)
    expect(after).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('is darker at night in dark mode', () => {
    expect(skyAt(0, 'dark').text).toBe('light')
  })
})
