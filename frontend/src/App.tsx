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
import { formatClockTime, formatCountdown, formatDuration, parseDuration } from './time'
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
        <StartForm onStart={(minutes) => start.mutate({ body: { target_minutes: minutes } })} />
      )}
    </main>
  )
}

function StartForm({ onStart }: { onStart: (targetMinutes: number) => void }) {
  const [target, setTarget] = useState(formatDuration(8 * 60))
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const minutes = parseDuration(target)
    if (minutes === null) {
      setError('Bitte als h:mm eingeben, z. B. 7:30')
      return
    }
    setError(null)
    onStart(minutes)
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="target">Sollzeit</label>
      <input
        id="target"
        inputMode="numeric"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-describedby={error ? 'target-error' : undefined}
      />
      {error && (
        <p id="target-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Start</button>
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
