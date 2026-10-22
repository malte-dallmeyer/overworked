import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import type { PauseOut, SessionOut } from './api'
import { addPauseMutation, changePauseMutation, removePauseMutation } from './api/@tanstack/react-query.gen'
import { formatClockTime, timeOnOrAfter } from './time'
import { useSessionCache } from './useSessionCache'

const REJECTED = 'Die Pause überschneidet sich mit einer anderen oder liegt vor Arbeitsbeginn.'

/** Lists pauses and lets you add (afterwards or planned ahead), correct and delete them. */
export function PausePanel({ session, now }: { session: SessionOut; now: Date }) {
  const cache = useSessionCache()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [editing, setEditing] = useState<PauseOut | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setFrom('')
    setTo('')
    setEditing(null)
    setError(null)
  }
  const handlers = {
    onSuccess: (updated: SessionOut) => {
      cache.show(updated)
      reset()
    },
    onError: () => {
      setError(REJECTED)
      cache.refetch()
    },
  }
  const add = useMutation({ ...addPauseMutation(), ...handlers })
  const change = useMutation({ ...changePauseMutation(), ...handlers })
  const remove = useMutation({ ...removePauseMutation(), onSuccess: cache.show, onError: cache.refetch })

  function edit(pause: PauseOut) {
    setEditing(pause)
    setFrom(formatClockTime(new Date(pause.started_at)))
    setTo(formatClockTime(new Date(pause.ended_at!)))
    setError(null)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const startedAt = timeOnOrAfter(from, new Date(session.started_at))
    const endedAt = startedAt && timeOnOrAfter(to, startedAt)
    if (!startedAt || !endedAt) {
      setError('Bitte Beginn und Ende der Pause eingeben')
      return
    }
    const body = { started_at: startedAt.toISOString(), ended_at: endedAt.toISOString() }
    if (editing) change.mutate({ path: { pause_id: editing.id }, body })
    else add.mutate({ body })
  }

  return (
    <section className="pauses" aria-labelledby="pauses-heading">
      <h2 id="pauses-heading">Pausen</h2>
      {session.pauses.length > 0 && (
        <ul>
          {session.pauses.map((pause) => {
            const range = pauseRange(pause)
            return (
              <li key={pause.id}>
                <span>
                  {range}
                  {pauseStatus(pause, now)}
                </span>
                {pause.ended_at && (
                  <>
                    <button type="button" className="link" aria-label={`Pause ${range} bearbeiten`} onClick={() => edit(pause)}>
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      className="link"
                      aria-label={`Pause ${range} löschen`}
                      onClick={() => remove.mutate({ path: { pause_id: pause.id } })}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={submit}>
        <div className="pause-times">
          <label>
            Pause von
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Pause bis
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="secondary">
          {editing ? 'Änderung speichern' : 'Pause eintragen'}
        </button>
        {editing && (
          <button type="button" className="link" onClick={reset}>
            Abbrechen
          </button>
        )}
      </form>
    </section>
  )
}

function pauseRange(pause: PauseOut): string {
  const start = formatClockTime(new Date(pause.started_at))
  return pause.ended_at ? `${start}–${formatClockTime(new Date(pause.ended_at))}` : `seit ${start}`
}

function pauseStatus(pause: PauseOut, now: Date): string {
  const start = Date.parse(pause.started_at)
  if (start > now.getTime()) return ' (geplant)'
  if (pause.ended_at === null || now.getTime() < Date.parse(pause.ended_at)) return ' (läuft)'
  return ''
}
