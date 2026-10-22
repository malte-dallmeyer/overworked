import { useEffect, useState, type FormEvent } from 'react'
import { endSession, fetchCurrentSession, startSession, type WorkSession } from './api'
import { formatClockTime, formatDuration, formatRemaining, parseDuration } from './time'
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

function RunningSession({ session, onEnd }: { session: WorkSession; onEnd: () => Promise<void> }) {
  const now = useNow()
  const end = new Date(session.end_at)

  return (
    <section>
      <p className="end">Feierabend um {formatClockTime(end)}</p>
      <p className="remaining">noch {formatRemaining(end, now)}</p>
      <button onClick={onEnd}>Feierabend machen</button>
    </section>
  )
}
