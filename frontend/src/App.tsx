import { useMutation, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  endSessionMutation,
  getCurrentSessionOptions,
  pauseSessionMutation,
  resumeSessionMutation,
  snoozeSessionMutation,
  startSessionMutation,
} from './api/@tanstack/react-query.gen'
import { isUnauthorized } from './apiError'
import { LoginForm } from './LoginForm'
import { Logo } from './Logo'
import { RunningSession } from './RunningSession'
import { StartForm } from './StartForm'
import { useSessionCache } from './useSessionCache'
import { useSky } from './useSky'

export default function App() {
  const current = useQuery(getCurrentSessionOptions())
  const cache = useSessionCache()

  const start = useMutation({ ...startSessionMutation(), onSuccess: cache.show, onError: cache.refetch })
  const pause = useMutation({ ...pauseSessionMutation(), onSuccess: cache.show, onError: cache.refetch })
  const resume = useMutation({ ...resumeSessionMutation(), onSuccess: cache.show, onError: cache.refetch })
  const snooze = useMutation({ ...snoozeSessionMutation(), onSuccess: cache.show, onError: cache.refetch })
  const end = useMutation({ ...endSessionMutation(), onSuccess: () => cache.show(null), onError: cache.refetch })

  return (
    <div className="app">
      <header className="brand">
        <Logo size={36} />
        <h1>Overworked</h1>
      </header>
      <main>
        {current.isPending ? (
          <Morning>
            <p className="muted">Lädt…</p>
          </Morning>
        ) : current.isError && isUnauthorized(current.error) ? (
          <Morning>
            <LoginForm onLoggedIn={cache.refetch} />
          </Morning>
        ) : current.isError ? (
          <Morning>
            <p role="alert" className="card">
              Server nicht erreichbar.
            </p>
          </Morning>
        ) : current.data ? (
          <RunningSession
            session={current.data}
            onPause={() => pause.mutate({})}
            onResume={() => resume.mutate({})}
            onEnd={() => end.mutate({})}
            onSnooze={() => snooze.mutate({})}
          />
        ) : (
          <Morning>
            <StartForm
              onStart={(minutes, startedAt) =>
                start.mutate({
                  body: { target_minutes: minutes, ...(startedAt && { started_at: startedAt.toISOString() }) },
                })
              }
            />
          </Morning>
        )}
      </main>
    </div>
  )
}

/** Before the work day: a morning sky. */
function Morning({ children }: { children: ReactNode }) {
  useSky(0)
  return <>{children}</>
}
