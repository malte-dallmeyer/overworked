export type WorkSession = {
  started_at: string
  target_minutes: number
  end_at: string
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(new URL(path, window.location.origin), init)
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status}`)
  return response
}

export async function fetchCurrentSession(): Promise<WorkSession | null> {
  return (await request('/api/session/current')).json()
}

export async function startSession(targetMinutes: number): Promise<WorkSession> {
  const response = await request('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_minutes: targetMinutes }),
  })
  return response.json()
}

export async function endSession(): Promise<void> {
  await request('/api/session/current/end', { method: 'POST' })
}
