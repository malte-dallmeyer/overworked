import { useMutation, useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  endSessionMutation,
  logoutMutation,
  getCurrentSessionOptions,
  pauseSessionMutation,
  resumeSessionMutation,
  snoozeSessionMutation,
  startSessionMutation,
} from './api/@tanstack/react-query.gen'
import { isUnauthorized } from './apiError'
import { LoginForm } from './LoginForm'
import { Logo } from './Logo'
import { PushToggle } from './PushToggle'
import { RunningSession } from './RunningSession'
import { StartForm } from './StartForm'
import { useLiveUpdates } from './useLiveUpdates'
import { useSessionCache } from './useSessionCache'
import { useSky } from './useSky'

export default function App() {
  const current = useQuery(getCurrentSessionOptions())
  const cache = useSessionCache()
  // Only once logged in; otherwise the stream would be refused and retried over and over.
  useLiveUpdates(current.isSuccess)

  const start = useMutation({ ...startSessionMutation(), onSuccess: cache.show, onError: cache.refetch })
  const pause = useMutation({ ...pauseSessionMutation(), onSuccess: cache.show, onError: cache.refetch })
  const resume = useMutation({ ...resumeSessionMutation(), onSuccess: cache.show, onError: cache.refetch })
  const snooze = useMutation({ ...snoozeSessionMutation(), onSuccess: cache.show, onError: cache.refetch })
  // Afterwards the session request is refused, which shows the login form.
  const logout = useMutation({ ...logoutMutation(), onSettled: cache.refetch })
  const end = useMutation({ ...endSessionMutation(), onSuccess: () => cache.show(null), onError: cache.refetch })

  return (
    <div className="app">
      <header className="brand">
        <Logo size={36} />
        <h1>Overworked</h1>
        {current.isSuccess && (
          <>
            <PushToggle />
            <button
              type="button"
              className="icon-button"
              aria-label="Abmelden"
              title="Abmelden"
              onClick={() => logout.mutate({})}
            >
              <LogOut aria-hidden size={22} />
            </button>
          </>
        )}
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
