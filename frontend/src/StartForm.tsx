import { History, Play } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { formatDuration, latestPastTime, parseDuration } from './time'

const QUICK_TARGETS = ['7:30', '8:00']

type StartFormProps = { onStart: (targetMinutes: number, startedAt?: Date) => void }

export function StartForm({ onStart }: StartFormProps) {
  const [target, setTarget] = useState(formatDuration(8 * 60))
  const [startTime, setStartTime] = useState('')
  const [targetError, setTargetError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  function validTarget(): number | null {
    const minutes = parseDuration(target)
    setTargetError(minutes === null ? 'Bitte als h:mm eingeben, z. B. 7:30' : null)
    return minutes
  }

  function startNow(event: FormEvent) {
    event.preventDefault()
    const minutes = validTarget()
    if (minutes !== null) onStart(minutes)
  }

  function startEarlier() {
    const minutes = validTarget()
    const startedAt = latestPastTime(startTime, new Date())
    setStartError(startedAt === null ? 'Bitte eine Uhrzeit eingeben' : null)
    if (minutes !== null && startedAt !== null) onStart(minutes, startedAt)
  }

  return (
    <form className="start card" onSubmit={startNow}>
      <h2>{greeting(new Date())}</h2>
      <p className="muted">Wie lange arbeitest du heute?</p>

      <label htmlFor="target" className="label">
        Sollzeit
      </label>
      <input
        id="target"
        className="target-input"
        // Number pad with a decimal separator; there is no pad with a colon.
        inputMode="decimal"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        onBlur={() => {
          const minutes = parseDuration(target)
          if (minutes !== null) setTarget(formatDuration(minutes))
        }}
        aria-describedby={targetError ? 'target-error' : undefined}
      />
      <div className="chips" role="group" aria-label="Schnellauswahl Sollzeit">
        {QUICK_TARGETS.map((quick) => (
          <button
            key={quick}
            type="button"
            className="chip"
            aria-pressed={target === quick}
            onClick={() => setTarget(quick)}
          >
            {quick} h
          </button>
        ))}
      </div>
      {targetError && (
        <p id="target-error" role="alert">
          {targetError}
        </p>
      )}

      <button type="submit" className="primary">
        <Play aria-hidden size={20} /> Jetzt starten
      </button>

      <details className="earlier">
        <summary>
          <History aria-hidden size={18} /> Schon früher angefangen?
        </summary>
        <label htmlFor="start-time" className="label">
          Angefangen um
        </label>
        <input
          id="start-time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          aria-describedby={startError ? 'start-error' : undefined}
        />
        {startError && (
          <p id="start-error" role="alert">
            {startError}
          </p>
        )}
        <button type="button" className="secondary" onClick={startEarlier}>
          Mit dieser Startzeit starten
        </button>
      </details>
    </form>
  )
}

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 11) return 'Guten Morgen'
  if (hour < 17) return 'Hallo'
  return 'Guten Abend'
}
