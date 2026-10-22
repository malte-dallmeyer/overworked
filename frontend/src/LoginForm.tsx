import { useMutation } from '@tanstack/react-query'
import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { loginMutation } from './api/@tanstack/react-query.gen'
import { isUnauthorized } from './apiError'

type LoginFormProps = { onLoggedIn: () => void }

export function LoginForm({ onLoggedIn }: LoginFormProps) {
  const [password, setPassword] = useState('')
  const login = useMutation({ ...loginMutation(), onSuccess: onLoggedIn })

  function submit(event: FormEvent) {
    event.preventDefault()
    login.mutate({ body: { password } })
  }

  return (
    <form className="login card" onSubmit={submit}>
      <label htmlFor="password" className="label">
        Passwort
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-describedby={login.isError ? 'login-error' : undefined}
      />
      {login.isError && (
        <p id="login-error" role="alert">
          {isUnauthorized(login.error) ? 'Falsches Passwort.' : 'Server nicht erreichbar.'}
        </p>
      )}
      <button type="submit" className="primary" disabled={login.isPending}>
        <LogIn aria-hidden size={20} />
        Anmelden
      </button>
    </form>
  )
}
