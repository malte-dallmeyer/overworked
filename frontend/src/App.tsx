import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import type { SessionOut } from './api'
import {
  endSessionMutation,
  getCurrentSessionOptions,
  getCurrentSessionQueryKey,
  pauseSessionMutation,
  resumeSessionMutation,
  startSessionMutation,
} from './api/@tanstack/react-query.gen'
import { endTime, remainingMs } from './session'
import { formatClockTime, formatCountdown, formatDuration, latestPastTime, parseDuration } from './time'
import { useNow } from './useNow'

export default function App() {
  const queryClient = useQueryClient()
  const current = useQuery(getCurrentSessionOptions())

  const sessionKey = getCurrentSessionQueryKey()
  const showSession = (session: SessionOut | null) => queryClient.setQueryData(sessionKey, session)
  // E.g. another device changed the session in the meantime: show what is true now.
  const refetch = () => queryClient.invalidateQueries({ queryKey: sessionKey })

  const start = useMutation({ ...startSessionMutation(), onSuccess: showSession, onError: refetch })
  const pause = useMutation({ ...pauseSessionMutation(), onSuccess: showSession, onError: refetch })
  const resume = useMutation({ ...resumeSessionMutation(), onSuccess: showSession, onError: refetch })
  const end = useMutation({ ...endSessionMutation(), onSuccess: () => showSession(null), onError: refetch })

  return (
    <main>
      <h1>Feierabend</h1>
      {current.isPending ? (
        <p>Lädt…</p>
      ) : current.isError ? (
        <p role="alert">Server nicht erreichbar.</p>
      ) : current.data ? (
        <RunningSession
          session={current.data}
          onPause={() => pause.mutate({})}
          onResume={() => resume.mutate({})}
          onEnd={() => end.mutate({})}
        />
      ) : (
        <StartForm
          onStart={(minutes, startedAt) =>
            start.mutate({
              body: { target_minutes: minutes, ...(startedAt && { started_at: startedAt.toISOString() }) },
            })
          }
        />
      )}
    </main>
  )
}

type StartFormProps = { onStart: (targetMinutes: number, startedAt?: Date) => void }

function StartForm({ onStart }: StartFormProps) {
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
    <form onSubmit={startNow}>
      <label htmlFor="target">Sollzeit</label>
      <input
        id="target"
        inputMode="numeric"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-describedby={targetError ? 'target-error' : undefined}
      />
      {targetError && (
        <p id="target-error" role="alert">
          {targetError}
        </p>
      )}
      <button type="submit">Jetzt starten</button>

      <fieldset>
        <legend>Schon früher angefangen?</legend>
        <label htmlFor="start-time">Angefangen um</label>
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
      </fieldset>
    </form>
  )
}

type RunningSessionProps = {
  session: SessionOut
  onPause: () => void
  onResume: () => void
  onEnd: () => void
}

function RunningSession({ session, onPause, onResume, onEnd }: RunningSessionProps) {
  const now = useNow()

  return (
    <section>
      {session.paused_since && (
        <p className="paused">Pausiert seit {formatClockTime(new Date(session.paused_since))}</p>
      )}
      <p className="end">Feierabend um {formatClockTime(endTime(session, now))}</p>
      <p className="remaining">noch {formatCountdown(remainingMs(session, now))}</p>
      {session.paused_since ? (
        <button onClick={onResume}>Weiter</button>
      ) : (
        <button className="secondary" onClick={onPause}>
          Pause
        </button>
      )}
      <button onClick={onEnd}>Feierabend machen</button>
    </section>
  )
}
