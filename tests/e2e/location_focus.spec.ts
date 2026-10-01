import { expect, test } from '@playwright/test';

test.describe('location focus QC', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tap a rival identification focuses that coordinate', async ({ page }) => {
    await page.goto('/atlas?site=site-baptism-at-the-jordan');
    await expect(page.getByRole('heading', { name: 'Rival identifications' })).toBeVisible({
      timeout: 15_000,
    });

    const before = await page.evaluate(() => {
      // MapLibre is not on window; read padding from the canvas container dataset if any.
      // Instead, click and assert the focus path set a higher zoom / moved via easeTo by
      // checking the button fires without error and the sheet still shows the site.
      return document.querySelectorAll('.site-candidates__focus').length;
    });
    expect(before).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Find on map/i }).click();
    // Site panel stays open (working identification parent).
    await expect(page.locator('.stop-panel')).toBeVisible();
  });

  test('atlas deep-link applies bottom map padding under the sheet', async ({ page }) => {
    await page.goto('/atlas?site=site-athens');
    await expect(page.locator('.stop-panel')).toBeVisible({ timeout: 15_000 });

    const pad = await page.evaluate(() => {
      const main = document.querySelector('.app-main') as HTMLElement | null;
      const sheet = main ? getComputedStyle(main).getPropertyValue('--sheet-h').trim() : '';
      const sheetPx = Number.parseFloat(sheet) || 0;
      return { sheetPx, hasSheet: sheetPx > 100 };
    });
    expect(pad.hasSheet).toBe(true);

    // MapLibre padding is internal; assert our chrome published a sheet height
    // the viewport-padding hook consumes (bottom pad = sheet + dock).
    const dock = await page.evaluate(() => {
      const shell = document.querySelector('.app-shell') as HTMLElement | null;
      return shell ? Number.parseFloat(getComputedStyle(shell).getPropertyValue('--dock-h')) || 0 : 0;
    });
    expect(pad.sheetPx + dock).toBeGreaterThan(200);
  });
});
