import { useEffect, useState, type FormEvent } from 'react'
import {
  endSession,
  fetchCurrentSession,
  pauseSession,
  resumeSession,
  startSession,
  type WorkSession,
} from './api'
import { endTime, remainingMs } from './session'
import { formatClockTime, formatCountdown, formatDuration, parseDuration } from './time'
import { useNow } from './useNow'

type State = { status: 'loading' } | { status: 'ready'; session: WorkSession | null }

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    fetchCurrentSession().then((session) => setState({ status: 'ready', session }))
  }, [])

  return (
    <main>
      <h1>Feierabend</h1>
      {state.status === 'loading' ? (
        <p>Lädt…</p>
      ) : state.session ? (
        <RunningSession
          session={state.session}
          onPause={async () => setState({ status: 'ready', session: await pauseSession() })}
          onResume={async () => setState({ status: 'ready', session: await resumeSession() })}
          onEnd={async () => {
            await endSession()
            setState({ status: 'ready', session: null })
          }}
        />
      ) : (
        <StartForm
          onStart={async (minutes) => {
            setState({ status: 'ready', session: await startSession(minutes) })
          }}
        />
      )}
    </main>
  )
}

function StartForm({ onStart }: { onStart: (targetMinutes: number) => Promise<void> }) {
  const [target, setTarget] = useState(formatDuration(8 * 60))
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const minutes = parseDuration(target)
    if (minutes === null) {
      setError('Bitte als h:mm eingeben, z. B. 7:30')
      return
    }
    setError(null)
    await onStart(minutes)
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
  session: WorkSession
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onEnd: () => Promise<void>
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
