import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import App from './App'
import { worker } from './test/worker'

const running = {
  started_at: '2026-10-22T06:00:00Z',
  target_minutes: 450,
  end_at: '2026-10-22T13:30:00Z',
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T11:00:00Z'))
})
afterEach(() => vi.useRealTimers())

function givenCurrentSession(session: object | null) {
  worker.use(http.get('/api/session/current', () => HttpResponse.json(session)))
}

it('offers to start with a default target of 8 hours', async () => {
  givenCurrentSession(null)
  const screen = await render(<App />)

  await expect.element(screen.getByLabelText('Sollzeit')).toHaveValue('8:00')
  await expect.element(screen.getByRole('button', { name: 'Start' })).toBeVisible()
})

it('starts a session with the entered target and shows when work ends', async () => {
  givenCurrentSession(null)
  let requested: unknown
  worker.use(
    http.post('/api/session', async ({ request }) => {
      requested = await request.json()
      return HttpResponse.json(running, { status: 201 })
    }),
  )
  const screen = await render(<App />)

  await userEvent.fill(screen.getByLabelText('Sollzeit'), '7:30')
  await userEvent.click(screen.getByRole('button', { name: 'Start' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  expect(requested).toEqual({ target_minutes: 450 })
})

it('does not start with an invalid target', async () => {
  givenCurrentSession(null)
  const screen = await render(<App />)

  await userEvent.fill(screen.getByLabelText('Sollzeit'), 'viel')
  await userEvent.click(screen.getByRole('button', { name: 'Start' }))

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Bitte als h:mm eingeben, z. B. 7:30')
})

it('shows end time and time left of a running session', async () => {
  givenCurrentSession(running)
  const screen = await render(<App />)

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  await expect.element(screen.getByText('noch 2:30:00')).toBeVisible()
})

it('ends the session and offers to start a new one', async () => {
  givenCurrentSession(running)
  worker.use(http.post('/api/session/current/end', () => new HttpResponse(null, { status: 204 })))
  const screen = await render(<App />)

  await userEvent.click(screen.getByRole('button', { name: 'Feierabend machen' }))

  await expect.element(screen.getByRole('button', { name: 'Start' })).toBeVisible()
})
