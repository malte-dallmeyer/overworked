import { http, HttpResponse, sse } from 'msw'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import App from './App'
import { renderWithQueryClient as render } from './test/render'
import { worker } from './test/worker'

// "Now" is 11:00Z = 13:00 in Berlin. Ends 13:30Z = 15:30 Berlin.
// Without legal break, so the times stay easy to follow; see the legal break tests at the end.
const running = {
  started_at: '2026-10-22T06:00:00Z',
  target_minutes: 450,
  required_break_minutes: 0,
  pauses: [],
  snoozed_until: null,
  legal_breaks: [
    { after_minutes: 540, break_minutes: 45 },
    { after_minutes: 360, break_minutes: 30 },
  ],
}

const earlierPause = { id: 1, started_at: '2026-10-22T07:00:00Z', ended_at: '2026-10-22T07:10:00Z' }

// Paused at 10:00Z after an earlier 10-minute pause: 3:50 h worked, 3:40 h left.
const paused = {
  ...running,
  pauses: [earlierPause, { id: 2, started_at: '2026-10-22T10:00:00Z', ended_at: null }],
}

// Lunch planned 14:00–14:45 Berlin: ends 16:15 Berlin.
const lunch = { id: 3, started_at: '2026-10-22T12:00:00Z', ended_at: '2026-10-22T12:45:00Z' }
const withPlannedLunch = { ...running, pauses: [lunch] }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T11:00:00Z'))
})
afterEach(() => vi.useRealTimers())

function givenCurrentSession(session: object | null) {
  worker.use(http.get('/api/session/current', () => HttpResponse.json(session)))
}

type Screen = Awaited<ReturnType<typeof render>>

async function startedEarlier(screen: Screen) {
  await userEvent.click(screen.getByText('Schon früher angefangen?'))
}

async function openPauses(screen: Screen) {
  await userEvent.click(screen.getByRole('button', { name: /^Pausen/ }))
}

it('offers to start with a default target of 8 hours', async () => {
  givenCurrentSession(null)
  const screen = await render(<App />)

  await expect.element(screen.getByLabelText('Sollzeit')).toHaveValue('8:00')
  await expect.element(screen.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
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
  await userEvent.click(screen.getByRole('button', { name: 'Jetzt starten' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  expect(requested).toEqual({ target_minutes: 450 })
})

it('shows the app name', async () => {
  givenCurrentSession(null)
  const screen = await render(<App />)

  await expect.element(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Overworked')
})

it('picks a target from the quick choices', async () => {
  givenCurrentSession(null)
  let requested: unknown
  worker.use(
    http.post('/api/session', async ({ request }) => {
      requested = await request.json()
      return HttpResponse.json(running, { status: 201 })
    }),
  )
  const screen = await render(<App />)

  await userEvent.click(screen.getByRole('button', { name: '7:30 h' }))
  await expect.element(screen.getByLabelText('Sollzeit')).toHaveValue('7:30')
  await userEvent.click(screen.getByRole('button', { name: 'Jetzt starten' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  expect(requested).toEqual({ target_minutes: 450 })
})

it('takes the target with a comma, as phone number pads have no colon', async () => {
  givenCurrentSession(null)
  let requested: unknown
  worker.use(
    http.post('/api/session', async ({ request }) => {
      requested = await request.json()
      return HttpResponse.json(running, { status: 201 })
    }),
  )
  const screen = await render(<App />)

  await userEvent.fill(screen.getByLabelText('Sollzeit'), '7,30')
  await userEvent.tab()
  await expect.element(screen.getByLabelText('Sollzeit')).toHaveValue('7:30')
  await userEvent.click(screen.getByRole('button', { name: 'Jetzt starten' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  expect(requested).toEqual({ target_minutes: 450 })
})

it('does not start with an invalid target', async () => {
  givenCurrentSession(null)
  const screen = await render(<App />)

  await userEvent.fill(screen.getByLabelText('Sollzeit'), 'viel')
  await userEvent.click(screen.getByRole('button', { name: 'Jetzt starten' }))

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Bitte als h:mm eingeben, z. B. 7:30')
})

it('shows end time and time left of a running session', async () => {
  givenCurrentSession(running)
  const screen = await render(<App />)

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  await expect.element(screen.getByText('2:30', { exact: true })).toBeVisible()
})

it('ends the session and offers to start a new one', async () => {
  givenCurrentSession(running)
  worker.use(http.post('/api/session/current/end', () => new HttpResponse(null, { status: 204 })))
  const screen = await render(<App />)

  await userEvent.click(screen.getByRole('button', { name: 'Feierabend machen' }))

  await expect.element(screen.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
})

it('pauses a running session', async () => {
  givenCurrentSession(running)
  worker.use(http.post('/api/session/current/pause', () => HttpResponse.json(paused)))
  const screen = await render(<App />)

  await userEvent.click(screen.getByRole('button', { name: 'Pause' }))

  await expect.element(screen.getByText('Pausiert seit 12:00')).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Weiter' })).toBeVisible()
})

it('shows the time left of a paused session', async () => {
  givenCurrentSession(paused)
  const screen = await render(<App />)

  await expect.element(screen.getByText('3:40', { exact: true })).toBeVisible()
})

it('resumes a paused session', async () => {
  givenCurrentSession(paused)
  worker.use(
    http.post('/api/session/current/resume', () =>
      HttpResponse.json({
        ...running,
        pauses: [earlierPause, { id: 2, started_at: '2026-10-22T10:00:00Z', ended_at: '2026-10-22T11:00:00Z' }],
      }),
    ),
  )
  const screen = await render(<App />)

  await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))

  await expect.element(screen.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.element(screen.getByText('Feierabend um 16:40')).toBeVisible()
})

it('shows the session another device started in the meantime', async () => {
  givenCurrentSession(null)
  worker.use(
    http.post('/api/session', () => {
      givenCurrentSession(running)
      return HttpResponse.json({ detail: 'A session is already running' }, { status: 409 })
    }),
  )
  const screen = await render(<App />)

  await userEvent.click(screen.getByRole('button', { name: 'Jetzt starten' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
})

it('tells when the server cannot be reached', async () => {
  worker.use(http.get('/api/session/current', () => HttpResponse.error()))
  const screen = await render(<App />)

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Server nicht erreichbar.')
})

it('starts now without sending a start time', async () => {
  givenCurrentSession(null)
  let requested: unknown
  worker.use(
    http.post('/api/session', async ({ request }) => {
      requested = await request.json()
      return HttpResponse.json(running, { status: 201 })
    }),
  )
  const screen = await render(<App />)

  await userEvent.click(screen.getByRole('button', { name: 'Jetzt starten' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  expect(requested).toEqual({ target_minutes: 480 })
})

it('starts with the time work actually began', async () => {
  givenCurrentSession(null)
  let requested: unknown
  worker.use(
    http.post('/api/session', async ({ request }) => {
      requested = await request.json()
      return HttpResponse.json(running, { status: 201 })
    }),
  )
  const screen = await render(<App />)

  await startedEarlier(screen)
  await userEvent.fill(screen.getByLabelText('Angefangen um'), '07:45')
  await userEvent.click(screen.getByRole('button', { name: 'Mit dieser Startzeit starten' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  expect(requested).toEqual({ target_minutes: 480, started_at: '2026-10-22T05:45:00.000Z' })
})

it('asks for a start time before starting with it', async () => {
  givenCurrentSession(null)
  const screen = await render(<App />)

  await startedEarlier(screen)
  await userEvent.click(screen.getByRole('button', { name: 'Mit dieser Startzeit starten' }))

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Bitte eine Uhrzeit eingeben')
})

// --- Pause form ---

function capture(method: 'post' | 'put' | 'delete', path: string, response: object) {
  const calls: { body: unknown; url: string }[] = []
  worker.use(
    http[method](path, async ({ request }) => {
      calls.push({ url: request.url, body: method === 'delete' ? null : await request.json() })
      return HttpResponse.json(response, { status: method === 'post' ? 201 : 200 })
    }),
  )
  return calls
}

it('lists planned pauses and includes them in the end time', async () => {
  givenCurrentSession(withPlannedLunch)
  const screen = await render(<App />)
  await openPauses(screen)

  await expect.element(screen.getByText('14:00–14:45 (geplant)')).toBeVisible()
  await expect.element(screen.getByText('Feierabend um 16:15')).toBeVisible()
})

it('plans a pause ahead', async () => {
  givenCurrentSession(running)
  const calls = capture('post', '/api/session/current/pauses', withPlannedLunch)
  const screen = await render(<App />)
  await openPauses(screen)

  await userEvent.fill(screen.getByLabelText('Pause von'), '14:00')
  await userEvent.fill(screen.getByLabelText('Pause bis'), '14:45')
  await userEvent.click(screen.getByRole('button', { name: 'Pause eintragen' }))

  await expect.element(screen.getByText('Feierabend um 16:15')).toBeVisible()
  expect(calls[0].body).toEqual({
    started_at: '2026-10-22T12:00:00.000Z',
    ended_at: '2026-10-22T12:45:00.000Z',
  })
})

it('corrects a pause', async () => {
  givenCurrentSession(withPlannedLunch)
  const longerLunch = { ...lunch, ended_at: '2026-10-22T13:00:00Z' }
  const calls = capture('put', '/api/session/current/pauses/:id', { ...running, pauses: [longerLunch] })
  const screen = await render(<App />)
  await openPauses(screen)

  await userEvent.click(screen.getByRole('button', { name: 'Pause 14:00–14:45 bearbeiten' }))
  await expect.element(screen.getByLabelText('Pause von')).toHaveValue('14:00')
  await userEvent.fill(screen.getByLabelText('Pause bis'), '15:00')
  await userEvent.click(screen.getByRole('button', { name: 'Änderung speichern' }))

  await expect.element(screen.getByText('14:00–15:00 (geplant)')).toBeVisible()
  expect(calls[0].url).toMatch(/\/pauses\/3$/)
  expect(calls[0].body).toEqual({
    started_at: '2026-10-22T12:00:00.000Z',
    ended_at: '2026-10-22T13:00:00.000Z',
  })
})

it('opens a pause tapped in the ring for editing', async () => {
  givenCurrentSession(withPlannedLunch)
  const screen = await render(<App />)

  await userEvent.click(screen.getByTestId('ring-pause-3'))

  await expect.element(screen.getByLabelText('Pause von')).toHaveValue('14:00')
  await expect.element(screen.getByLabelText('Pause bis')).toHaveValue('14:45')
  await expect.element(screen.getByRole('button', { name: 'Änderung speichern' })).toBeVisible()
})

it('closes the pause list', async () => {
  givenCurrentSession(running)
  const screen = await render(<App />)
  await openPauses(screen)

  await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))

  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
})

it('deletes a pause', async () => {
  givenCurrentSession(withPlannedLunch)
  const calls = capture('delete', '/api/session/current/pauses/:id', running)
  const screen = await render(<App />)
  await openPauses(screen)

  await userEvent.click(screen.getByRole('button', { name: 'Pause 14:00–14:45 löschen' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  expect(calls[0].url).toMatch(/\/pauses\/3$/)
})

it('explains a rejected pause', async () => {
  givenCurrentSession(withPlannedLunch)
  worker.use(
    http.post('/api/session/current/pauses', () =>
      HttpResponse.json({ detail: 'pause overlaps another pause' }, { status: 422 }),
    ),
  )
  const screen = await render(<App />)
  await openPauses(screen)

  await userEvent.fill(screen.getByLabelText('Pause von'), '14:30')
  await userEvent.fill(screen.getByLabelText('Pause bis'), '15:00')
  await userEvent.click(screen.getByRole('button', { name: 'Pause eintragen' }))

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Die Pause überschneidet sich mit einer anderen oder liegt vor Arbeitsbeginn.')
})

it('asks for both times of a pause', async () => {
  givenCurrentSession(running)
  const screen = await render(<App />)
  await openPauses(screen)

  await userEvent.fill(screen.getByLabelText('Pause von'), '14:00')
  await userEvent.click(screen.getByRole('button', { name: 'Pause eintragen' }))

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Bitte Beginn und Ende der Pause eingeben')
})

// --- Legal break ---

it('includes the legal break in the end time and says so', async () => {
  givenCurrentSession({ ...running, required_break_minutes: 30 })
  const screen = await render(<App />)

  await expect.element(screen.getByText('Feierabend um 16:00')).toBeVisible()
  await expect.element(screen.getByText('inkl. 30 min Pflichtpause')).toBeVisible()
})

it('drops the hint once the legal break is taken', async () => {
  const longEnough = { id: 1, started_at: '2026-10-22T09:00:00Z', ended_at: '2026-10-22T09:30:00Z' }
  givenCurrentSession({ ...running, required_break_minutes: 30, pauses: [longEnough] })
  const screen = await render(<App />)

  await expect.element(screen.getByText('Feierabend um 16:00')).toBeVisible()
  await expect.element(screen.getByText(/Pflichtpause/)).not.toBeInTheDocument()
})

// --- Login ---

function givenLoggedOut() {
  worker.use(
    http.get('/api/session/current', () => HttpResponse.json({ detail: 'Not logged in' }, { status: 401 })),
  )
}

it('asks for the password when not logged in', async () => {
  givenLoggedOut()
  const screen = await render(<App />)

  await expect.element(screen.getByLabelText('Passwort')).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Anmelden' })).toBeVisible()
})

it('logs in and shows the running session', async () => {
  givenLoggedOut()
  let sent: unknown
  worker.use(
    http.post('/api/login', async ({ request }) => {
      sent = await request.json()
      givenCurrentSession(running)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const screen = await render(<App />)

  await userEvent.fill(screen.getByLabelText('Passwort'), 'geheim')
  await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  expect(sent).toEqual({ password: 'geheim' })
})

it('tells when the password is wrong', async () => {
  givenLoggedOut()
  worker.use(http.post('/api/login', () => HttpResponse.json({ detail: 'Wrong password' }, { status: 401 })))
  const screen = await render(<App />)

  await userEvent.fill(screen.getByLabelText('Passwort'), 'falsch')
  await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Falsches Passwort.')
})

it('asks for the password again once the login has expired', async () => {
  givenCurrentSession(running)
  worker.use(
    http.post('/api/session/current/pause', () => {
      givenLoggedOut()
      return HttpResponse.json({ detail: 'Not logged in' }, { status: 401 })
    }),
  )
  const screen = await render(<App />)

  await userEvent.click(screen.getByRole('button', { name: 'Pause' }))

  await expect.element(screen.getByLabelText('Passwort')).toBeVisible()
})

// --- Alarm: one snooze ---

// 5 h from 06:00Z: Feierabend is now (11:00Z).
const due = { ...running, target_minutes: 300 }

it('offers to snooze once Feierabend is reached', async () => {
  givenCurrentSession(due)
  worker.use(
    http.post('/api/session/current/snooze', () =>
      HttpResponse.json({ ...due, snoozed_until: '2026-10-22T11:10:00Z' }),
    ),
  )
  const screen = await render(<App />)
  await expect.element(screen.getByText('Feierabend!')).toBeVisible()

  await userEvent.click(screen.getByRole('button', { name: '10 min später' }))

  await expect.element(screen.getByText('Snooze', { exact: true })).toBeVisible()
  await expect.element(screen.getByText('0:10', { exact: true })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: '10 min später' })).not.toBeInTheDocument()
})

it('offers no snooze before Feierabend', async () => {
  givenCurrentSession(running)
  const screen = await render(<App />)

  await expect.element(screen.getByText('Feierabend um 15:30')).toBeVisible()
  await expect.element(screen.getByRole('button', { name: '10 min später' })).not.toBeInTheDocument()
})

it('offers no second snooze', async () => {
  givenCurrentSession({ ...due, snoozed_until: '2026-10-22T10:50:00Z' })
  const screen = await render(<App />)

  await expect.element(screen.getByText('Feierabend!')).toBeVisible()
  await expect.element(screen.getByRole('button', { name: '10 min später' })).not.toBeInTheDocument()
})

// --- Live updates from other devices ---

it('shows what another device changed, without reloading', async () => {
  givenCurrentSession(running)
  worker.use(
    sse('/api/session/events', ({ client }) => {
      client.send({ data: JSON.stringify(running) })
      setTimeout(() => client.send({ data: JSON.stringify(paused) }), 50)
    }),
  )
  const screen = await render(<App />)

  await expect.element(screen.getByText('Pausiert seit 12:00')).toBeVisible()
})

it('shows the start screen once another device ended the session', async () => {
  givenCurrentSession(running)
  worker.use(sse('/api/session/events', ({ client }) => client.send({ data: 'null' })))
  const screen = await render(<App />)

  await expect.element(screen.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
})

// --- Adjusting the remaining time ---

// 7:30 h + 30 min legal break from 08:00 Berlin: Feierabend 16:00.
const adjustable = { ...running, required_break_minutes: 30 }

async function openAdjust(screen: Screen) {
  await userEvent.click(screen.getByRole('button', { name: 'Restzeit anpassen' }))
}

it('adjusts the remaining time in steps and previews the new Feierabend', async () => {
  givenCurrentSession(adjustable)
  const calls = capture('put', '/api/session/current/target', { ...adjustable, target_minutes: 465 })
  const screen = await render(<App />)
  await openAdjust(screen)

  await userEvent.click(screen.getByRole('button', { name: '15 Minuten später' }))
  await expect.element(screen.getByText('Neuer Feierabend um 16:15')).toBeVisible()
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))

  await expect.element(screen.getByText('Feierabend um 16:15')).toBeVisible()
  expect(calls[0].body).toEqual({ target_minutes: 465 })
})

it('sets Feierabend to a time', async () => {
  givenCurrentSession(adjustable)
  const calls = capture('put', '/api/session/current/target', { ...adjustable, target_minutes: 510 })
  const screen = await render(<App />)
  await openAdjust(screen)

  await userEvent.fill(screen.getByLabelText('Neue Uhrzeit'), '17:00')
  await expect.element(screen.getByText('Neuer Feierabend um 17:00')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))

  await expect.element(screen.getByText('Feierabend um 17:00')).toBeVisible()
  expect(calls[0].body).toEqual({ target_minutes: 510 })
})

it('urges Feierabend before extending after the alarm', async () => {
  givenCurrentSession(due)
  const calls = capture('put', '/api/session/current/target', { ...due, target_minutes: 305 })
  const screen = await render(<App />)
  await openAdjust(screen)

  await userEvent.click(screen.getByRole('button', { name: '5 Minuten später' }))

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Deine Sollzeit ist erreicht. Mach lieber Feierabend – die Arbeit ist morgen auch noch da.')
  await expect.element(screen.getByRole('button', { name: 'Lieber Feierabend machen' })).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Trotzdem verlängern' }))
  await expect.poll(() => calls.length).toBe(1)
  expect(calls[0].body).toEqual({ target_minutes: 305 })
})

it('ends the session from the warning', async () => {
  givenCurrentSession(due)
  worker.use(http.post('/api/session/current/end', () => new HttpResponse(null, { status: 204 })))
  const screen = await render(<App />)
  await openAdjust(screen)
  await userEvent.click(screen.getByRole('button', { name: '5 Minuten später' }))

  await userEvent.click(screen.getByRole('button', { name: 'Lieber Feierabend machen' }))

  await expect.element(screen.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
})
