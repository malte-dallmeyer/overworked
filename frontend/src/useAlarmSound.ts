import { useEffect } from 'react'

const REPEAT_MS = 2 * 60_000 // like the alarm on the phone

/** A soft chime, made in the browser: two falling notes. */
function chime() {
  try {
    const audio = new AudioContext()
    // Browsers allow sound only after the page was clicked; then the context starts suspended.
    if (audio.state === 'suspended') {
      void audio.close()
      return
    }
    ;[880, 660].forEach((frequency, i) => {
      const start = audio.currentTime + i * 0.35
      const tone = audio.createOscillator()
      const volume = audio.createGain()
      tone.frequency.value = frequency
      volume.gain.setValueAtTime(0.0001, start)
      volume.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 1.2)
      tone.connect(volume).connect(audio.destination)
      tone.start(start)
      tone.stop(start + 1.2)
    })
    setTimeout(() => void audio.close(), 2000)
  } catch {
    // No audio here: the notifications still come.
  }
}

/** In the open tab: a chime now and every two minutes while the alarm rings. */
export function useAlarmSound(ringing: boolean) {
  useEffect(() => {
    if (!ringing) return
    chime()
    const timer = setInterval(chime, REPEAT_MS)
    return () => clearInterval(timer)
  }, [ringing])
}
