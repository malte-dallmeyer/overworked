import { describe, expect, it } from 'vitest'
import { arcPath, ringAngle, ringPoint } from './ring'

describe('ringAngle', () => {
  const start = 0
  const end = 1000

  it('runs clockwise from the top: start at 0°, end at 360°', () => {
    expect(ringAngle(start, start, end)).toBe(0)
    expect(ringAngle(250, start, end)).toBe(90)
    expect(ringAngle(end, start, end)).toBe(360)
  })

  it('stays within the ring', () => {
    expect(ringAngle(-100, start, end)).toBe(0)
    expect(ringAngle(2000, start, end)).toBe(360)
  })
})

describe('arcPath', () => {
  it('draws a quarter circle from the top to the right', () => {
    expect(arcPath(100, 100, 50, 0, 90)).toBe('M 100 50 A 50 50 0 0 1 150 100')
  })

  it('uses the large arc flag for more than half a circle', () => {
    expect(arcPath(100, 100, 50, 0, 270)).toContain(' 0 1 1 ')
  })

  it('stops just short of a full circle, which SVG cannot draw as one arc', () => {
    expect(arcPath(100, 100, 50, 0, 360)).not.toBe(arcPath(100, 100, 50, 0, 0))
  })
})

describe('ringPoint', () => {
  it('starts at the top and runs clockwise', () => {
    expect(ringPoint(100, 100, 50, 0)).toEqual({ x: 100, y: 50 })
    expect(ringPoint(100, 100, 50, 90)).toEqual({ x: 150, y: 100 })
  })
})
