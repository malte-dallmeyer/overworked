// Geometry for the progress ring: the work day runs clockwise from the top
// (start) once around to the top again (Feierabend).

/** Angle in degrees (0 = top, clockwise) of `time` on a ring from `start` to `end`. */
export function ringAngle(time: number, start: number, end: number): number {
  if (end <= start) return 360
  return Math.min(360, Math.max(0, ((time - start) / (end - start)) * 360))
}

/** Point on the ring at `angle` degrees (0 = top, clockwise). */
export function ringPoint(cx: number, cy: number, r: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  const round = (n: number) => Math.round(n * 100) / 100
  return { x: round(cx + r * Math.cos(radians)), y: round(cy + r * Math.sin(radians)) }
}

/** SVG path for an arc from `from` to `to` degrees. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  // An arc from a point to itself draws nothing, so a full circle stops just short.
  const end = Math.min(to, from + 359.99)
  const a = ringPoint(cx, cy, r, from)
  const b = ringPoint(cx, cy, r, end)
  const largeArc = end - from > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${largeArc} 1 ${b.x} ${b.y}`
}
