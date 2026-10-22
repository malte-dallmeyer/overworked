import { PASSWORD } from '../playwright.config'
import { expect, test } from './fixtures'

test.describe('without login', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('log in with the password', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Passwort').fill(PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
  })
})
