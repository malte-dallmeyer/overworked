import { expect, test } from './fixtures'

test('installable as an app', async ({ page, request }) => {
  await page.goto('/')

  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(manifestUrl!)).json()
  expect(manifest).toMatchObject({ name: 'Overworked', start_url: '/', display: 'standalone' })
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src)
    expect(response.headers()['content-type'], icon.src).toBe('image/png')
  }
  const worker = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL)
  expect(worker).toMatch(/\/sw\.js$/)
})
