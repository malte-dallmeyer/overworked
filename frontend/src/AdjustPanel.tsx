import { useMutation } from '@tanstack/react-query'
import { Moon } from 'lucide-react'
import { useState } from 'react'
import type { SessionOut } from './api'
import { changeTargetMutation } from './api/@tanstack/react-query.gen'
import { endTime, remainingMs, targetForEnd, withTarget } from './session'
import { formatClockTime, formatDuration, timeOnOrAfter } from './time'
import { useSessionCache } from './useSessionCache'

const STEPS = [-15, -5, 5, 15]

type AdjustPanelProps = {
  session: SessionOut
  now: Date
  onDone: () => void
  onEnd: () => void
}

/** Moves Feierabend by changing the target; after the alarm, extending needs a second thought. */
export function AdjustPanel({ session, now, onDone, onEnd }: AdjustPanelProps) {
  const cache = useSessionCache()
  const [target, setTarget] = useState(session.target_minutes)
  const [capped, setCapped] = useState(false)
  const max = session.max_work_minutes
  const save = useMutation({
    ...changeTargetMutation(),
    onSuccess: (updated) => {
      cache.show(updated)
      onDone()
    },
    onError: cache.refetch,
  })

  const preview = withTarget(session, target)
  const newEnd = endTime(preview, now)
  const alarmWentOff = remainingMs(session, now) === 0 || session.snoozed_until !== null
  const warn = alarmWentOff && target > session.target_minutes

  /** Within 1 minute and the 10-hour limit; says so when it had to cut. */
  function change(minutes: number) {
    setCapped(minutes > max)
    setTarget(Math.min(max, Math.max(1, minutes)))
  }

  function setEnd(input: string) {
    const end = timeOnOrAfter(input, new Date(session.started_at))
    if (end) change(targetForEnd(session, end, now))
  }

  return (
    <section className="adjust">
      <h2 id="adjust-heading">Restzeit anpassen</h2>
      <p className="preview">Neuer Feierabend um {formatClockTime(newEnd)}</p>
      <p className="muted">
        Sollzeit {formatDuration(target)} h
        {preview.required_break_minutes > 0 && `, inkl. ${preview.required_break_minutes} min Pflichtpause`}
      </p>

      <div className="steps" role="group" aria-label="Feierabend verschieben">
        {STEPS.map((step) => (
          <button
            key={step}
            type="button"
            className="chip"
            aria-label={`${Math.abs(step)} Minuten ${step < 0 ? 'früher' : 'später'}`}
            disabled={target + step < 1 || target + step > max}
            onClick={() => change(target + step)}
          >
            {step < 0 ? '−' : '+'}
            {Math.abs(step)} min
          </button>
        ))}
      </div>

      <label htmlFor="new-end" className="label">
        Neue Uhrzeit
      </label>
      <input
        id="new-end"
        type="time"
        value={formatClockTime(newEnd)}
        onChange={(e) => setEnd(e.target.value)}
      />

      {(capped || target === max) && (
        <p className="muted">Mehr als 10 Stunden erlaubt das Arbeitszeitgesetz nicht.</p>
      )}

      {warn ? (
        <>
          <p role="alert" className="warning">
            Deine Sollzeit ist erreicht. Mach lieber Feierabend – die Arbeit ist morgen auch noch da.
          </p>
          <button type="button" className="primary" onClick={onEnd}>
            <Moon aria-hidden size={20} /> Lieber Feierabend machen
          </button>
          <button
            type="button"
            className="link"
            onClick={() => save.mutate({ body: { target_minutes: target } })}
          >
            Trotzdem verlängern
          </button>
        </>
      ) : (
        <button
          type="button"
          className="primary"
          disabled={target === session.target_minutes || save.isPending}
          onClick={() => save.mutate({ body: { target_minutes: target } })}
        >
          Übernehmen
        </button>
      )}
    </section>
  )
}
