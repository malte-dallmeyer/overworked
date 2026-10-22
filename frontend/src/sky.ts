// The background follows the work day like the sky follows the sun:
// a light morning at the start, dusk at Feierabend, night after it.

const MAX_PROGRESS = 1.25

/** 0 at the start, 1 at Feierabend, growing on into overtime up to MAX_PROGRESS. */
export function dayProgress(start: Date, end: Date, now: Date): number {
  const total = end.getTime() - start.getTime()
  if (total <= 0) return MAX_PROGRESS
  const progress = (now.getTime() - start.getTime()) / total
  return Math.min(MAX_PROGRESS, Math.max(0, progress))
}

export type Sky = { top: string; bottom: string; text: 'dark' | 'light' }

type Stop = { at: number; top: string; bottom: string; text: Sky['text'] }

const STOPS: Record<'light' | 'dark', Stop[]> = {
  // Neighbouring colours are chosen so their blends stay clean (blue + yellow would turn grey).
  light: [
    { at: 0, top: '#9fd3f7', bottom: '#fdf3e1', text: 'dark' }, // morning
    { at: 0.5, top: '#c3e4f6', bottom: '#fff0d6', text: 'dark' }, // midday
    { at: 0.85, top: '#ffb48a', bottom: '#ffdcc4', text: 'dark' }, // late afternoon
    { at: 1, top: '#6a3f9c', bottom: '#f0738f', text: 'light' }, // dusk: Feierabend
    { at: MAX_PROGRESS, top: '#1b1838', bottom: '#4a2a5e', text: 'light' }, // night: overtime
  ],
  dark: [
    { at: 0, top: '#16243d', bottom: '#1f1d2e', text: 'light' },
    { at: 0.5, top: '#1f2a4a', bottom: '#232033', text: 'light' },
    { at: 0.85, top: '#3e2547', bottom: '#2a1d2c', text: 'light' },
    { at: 1, top: '#3d2363', bottom: '#5a2638', text: 'light' },
    { at: MAX_PROGRESS, top: '#0e0c20', bottom: '#24152f', text: 'light' },
  ],
}

export function skyAt(progress: number, scheme: 'light' | 'dark'): Sky {
  const stops = STOPS[scheme]
  const next = stops.findIndex((stop) => stop.at >= progress)
  if (next <= 0) return pick(stops[next === -1 ? stops.length - 1 : 0])
  const from = stops[next - 1]
  const to = stops[next]
  const t = (progress - from.at) / (to.at - from.at)
  return {
    top: mix(from.top, to.top, t),
    bottom: mix(from.bottom, to.bottom, t),
    text: t < 0.5 ? from.text : to.text,
  }
}

function pick({ top, bottom, text }: Stop): Sky {
  return { top, bottom, text }
}

function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  )
}
