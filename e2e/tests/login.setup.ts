import { test as setup } from '@playwright/test'
import { AUTH_STATE, PASSWORD } from '../playwright.config'

setup('log in', async ({ request }) => {
  const response = await request.post('/api/login', { data: { password: PASSWORD } })
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`)
  await request.storageState({ path: AUTH_STATE })
})
