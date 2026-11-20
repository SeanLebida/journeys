import { expect, test, type Page } from '@playwright/test';

function trackAssets(page: Page) {
  const failed: string[] = [];
  const rootAssets: string[] = [];
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (res.status() < 400) return;
    if (url.pathname === '/favicon.ico') return;
    failed.push(`${res.status()} ${url.pathname}`);
  });
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.origin !== 'http://127.0.0.1:4179') return;
    if (/^\/(images|fonts|data|dist-content|badges)\//.test(url.pathname)) rootAssets.push(url.pathname);
  });
  return { failed, rootAssets };
}

test('Trace map fills the phone viewport under /app', async ({ page }) => {
  const { failed, rootAssets } = trackAssets(page);
  // Home first, then Trace — the sheet mounts after the map, which is the
  // case that used to leave the Mediterranean under the sheet.
  // Leading-slash goto ignores the /app path on baseURL.
  await page.goto('.');
  await page.getByRole('link', { name: 'Trace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Route tracing' })).toBeVisible();
  const rome = page.locator('.reference-city', { hasText: 'Rome' });
  await expect(rome).toBeVisible();
  await expect
    .poll(async () => {
      const city = await rome.boundingBox();
      const sheet = await page.locator('.mode-panel').boundingBox();
      const canvas = await page.getByTestId('map-canvas').locator('canvas').boundingBox();
      if (!city || !sheet || !canvas) return false;
      return city.y + city.height < sheet.y && canvas.height > sheet.y;
    })
    .toBe(true);

  expect(failed, 'asset requests').toEqual([]);
  expect(rootAssets, 'root-absolute assets').toEqual([]);
});
