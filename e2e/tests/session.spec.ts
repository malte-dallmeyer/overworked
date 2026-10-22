import { devices } from '@playwright/test'
import { clockTime, currentSession, expect, plannedEnd, test } from './fixtures'

test('start a session and see when work ends', async ({ page, request }) => {
  await page.goto('/')

  await page.getByLabel('Sollzeit').fill('7:30')
  await page.getByRole('button', { name: 'Jetzt starten' }).click()

  const session = await currentSession(request)
  expect(session?.target_minutes).toBe(450)
  await expect(page.getByText(`Feierabend um ${clockTime(plannedEnd(session!))}`)).toBeVisible()
  await expect(page.getByText(/^noch 7:(29|30):\d\d$/)).toBeVisible()
})

test('a running session survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jetzt starten' }).click()
  await expect(page.getByText(/^Feierabend um /)).toBeVisible()

  await page.reload()

  await expect(page.getByText(/^Feierabend um /)).toBeVisible()
})

test('ending the session offers a new start', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jetzt starten' }).click()

  await page.getByRole('button', { name: 'Feierabend machen' }).click()

  await expect(page.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
  expect(await currentSession(request)).toBeNull()
})

test('a session started on the laptop shows up on the phone', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'brings its own devices, one run is enough')
  const laptopContext = await browser.newContext({ ...devices['Desktop Chrome'] })
  const phoneContext = await browser.newContext({ ...devices['Pixel 7'] })
  const laptop = await laptopContext.newPage()
  const phone = await phoneContext.newPage()

  await laptop.goto('/')
  await laptop.getByLabel('Sollzeit').fill('8:00')
  await laptop.getByRole('button', { name: 'Jetzt starten' }).click()
  const endTime = laptop.getByText(/^Feierabend um \d\d:\d\d$/)
  await expect(endTime).toBeVisible()

  await phone.goto('/')

  await expect(phone.getByText(await endTime.innerText())).toBeVisible()

  await laptopContext.close()
  await phoneContext.close()
})

test('pause and resume', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jetzt starten' }).click()

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByText(/^Pausiert seit \d\d:\d\d$/)).toBeVisible()

  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(page.getByText(/^Pausiert/)).toBeHidden()
})

test('paused on the phone, the laptop shows the same time left', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'brings its own devices, one run is enough')
  const laptopContext = await browser.newContext({ ...devices['Desktop Chrome'] })
  const phoneContext = await browser.newContext({ ...devices['Pixel 7'] })
  const laptop = await laptopContext.newPage()
  const phone = await phoneContext.newPage()

  await laptop.goto('/')
  await laptop.getByRole('button', { name: 'Jetzt starten' }).click()
  await phone.goto('/')
  await phone.getByRole('button', { name: 'Pause', exact: true }).click()
  // Time left stands still during a pause, so both devices must show exactly the same value.
  const phoneRemaining = phone.getByText(/^noch \d+:\d\d:\d\d$/)
  await expect(phone.getByText(/^Pausiert seit/)).toBeVisible()

  await laptop.reload()

  await expect(laptop.getByText(/^Pausiert seit/)).toBeVisible()
  await expect(laptop.getByText(await phoneRemaining.innerText())).toBeVisible()

  await laptopContext.close()
  await phoneContext.close()
})

test('forgot to start: start with the time work actually began', async ({ page }) => {
  const anHourAgo = new Date(Date.now() - 60 * 60_000).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  })
  await page.goto('/')

  await page.getByLabel('Angefangen um').fill(anHourAgo)
  await page.getByRole('button', { name: 'Mit dieser Startzeit starten' }).click()

  // 8 h target, started 60–61 minutes ago (the start time has minute precision).
  await expect(page.getByText(/^noch (6:5\d|7:00):\d\d$/)).toBeVisible()
})

test('plan a pause: the end time moves right away', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jetzt starten' }).click()
  const session = (await currentSession(request))!
  const pauseStart = new Date(Date.parse(session.started_at) + 2 * 60 * 60_000)
  const pauseEnd = new Date(pauseStart.getTime() + 30 * 60_000)

  await page.getByLabel('Pause von').fill(clockTime(pauseStart))
  await page.getByLabel('Pause bis').fill(clockTime(pauseEnd))
  await page.getByRole('button', { name: 'Pause eintragen' }).click()

  await expect(page.getByText(`${clockTime(pauseStart)}–${clockTime(pauseEnd)} (geplant)`)).toBeVisible()
  const endWithPause = new Date(plannedEnd(session).getTime() + 30 * 60_000)
  await expect(page.getByText(`Feierabend um ${clockTime(endWithPause)}`)).toBeVisible()
})
