import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function box(page: Page, sel: string) {
  const el = page.locator(sel).first();
  await expect(el).toBeVisible();
  const b = await el.boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return b;
}

test('zoom +/- sits below the status-bar inset', async ({ page }) => {
  await page.goto('/atlas');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-top', '48px');
  });
  const zoomBtn = await box(page, '.maplibregl-ctrl-top-right .maplibregl-ctrl-zoom-in');
  expect(zoomBtn.y).toBeGreaterThanOrEqual(48);
});
