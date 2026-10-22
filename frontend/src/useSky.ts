import { useEffect, useState } from 'react'
import { skyAt } from './sky'

function usePrefersDark(): boolean {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return dark
}

/** Paints the page background as the sky for the given day progress (see sky.ts). */
export function useSky(progress: number) {
  const scheme = usePrefersDark() ? 'dark' : 'light'
  // Rounded so the styles change every few minutes, not every second.
  const step = Math.round(progress * 200) / 200

  useEffect(() => {
    const sky = skyAt(step, scheme)
    const root = document.documentElement
    root.style.setProperty('--sky-top', sky.top)
    root.style.setProperty('--sky-bottom', sky.bottom)
    root.dataset.text = sky.text
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sky.top)
  }, [step, scheme])
}
