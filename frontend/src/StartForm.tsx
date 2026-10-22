import { useQuery } from '@tanstack/react-query'
import { History, Play } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { QuickTargetsOut } from './api'
import { getQuickTargetsOptions } from './api/@tanstack/react-query.gen'
import { formatDuration, latestPastTime, parseDuration } from './time'

// If the server cannot tell: what a fresh instance would offer.
const FALLBACK: QuickTargetsOut = { last: 480, choices: [450, 480], max_minutes: 600 }

type StartFormProps = { onStart: (targetMinutes: number, startedAt?: Date) => void }

/** Waits for the recently used targets, so the form starts with the right value. */
export function StartForm({ onStart }: StartFormProps) {
  const targets = useQuery(getQuickTargetsOptions())
  if (targets.isPending) return <p className="muted">Lädt…</p>
  return <StartFormFields targets={targets.data ?? FALLBACK} onStart={onStart} />
}

function StartFormFields({ targets, onStart }: StartFormProps & { targets: QuickTargetsOut }) {
  const quickTargets = targets.choices.map(formatDuration)
  const [target, setTarget] = useState(formatDuration(targets.last))
  // Once, when the start screen appears; no need to follow the clock.
  const [hello] = useState(() => greeting(new Date()))
  const [startTime, setStartTime] = useState('')
  const [targetError, setTargetError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  function validTarget(): number | null {
    const minutes = parseDuration(target)
    if (minutes !== null && minutes > targets.max_minutes) {
      setTargetError('Mehr als 10 Stunden erlaubt das Arbeitszeitgesetz nicht.')
      return null
    }
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
      <h2>{hello}</h2>
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
        {quickTargets.map((quick) => (
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
