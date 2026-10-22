import { devices } from '@playwright/test'
import { clockTime, currentSession, expect, test } from './fixtures'

test('start a session and see when work ends', async ({ page, request }) => {
  await page.goto('/')

  await page.getByLabel('Sollzeit').fill('7:30')
  await page.getByRole('button', { name: 'Start' }).click()

  const session = await currentSession(request)
  expect(session?.target_minutes).toBe(450)
  await expect(page.getByText(`Feierabend um ${clockTime(session!.end_at)}`)).toBeVisible()
  await expect(page.getByText(/^noch 7:(29|30):\d\d$/)).toBeVisible()
})

test('a running session survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText(/^Feierabend um /)).toBeVisible()

  await page.reload()

  await expect(page.getByText(/^Feierabend um /)).toBeVisible()
})

test('ending the session offers a new start', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()

  await page.getByRole('button', { name: 'Feierabend machen' }).click()

  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
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
  await laptop.getByRole('button', { name: 'Start' }).click()
  const endTime = laptop.getByText(/^Feierabend um \d\d:\d\d$/)
  await expect(endTime).toBeVisible()

  await phone.goto('/')

  await expect(phone.getByText(await endTime.innerText())).toBeVisible()

  await laptopContext.close()
  await phoneContext.close()
})
