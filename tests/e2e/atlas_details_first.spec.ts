import { expect, test } from '@playwright/test';

// Markers are DOM overlays on a WebGL map; software GL lets headless Chromium draw it.
test.use({
  viewport: { width: 390, height: 844 },
  launchOptions: {
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  },
});

test.describe('atlas: tapping a place shows its details at once', () => {

  test('battle marker tap puts details above layers, in view, and close restores scroll', async ({ page }) => {
    await page.goto('/atlas');
    const body = page.locator('.mode-panel__body');
    await expect(body).toBeVisible({ timeout: 15_000 });
    await body.evaluate((el) => el.scrollTo({ top: 120 }));
    const before = await body.evaluate((el) => el.scrollTop);

    const marker = page.locator('.battle-label').first();
    await expect(marker).toBeVisible({ timeout: 15_000 });
    const label = (await marker.getAttribute('aria-label')) ?? '';
    expect(label).toMatch(/^Show battle: /);
    const mbox = await marker.boundingBox();
    expect(mbox!.width).toBeGreaterThanOrEqual(44);
    expect(mbox!.height).toBeGreaterThanOrEqual(44);
    await marker.click({ force: true });

    const panel = page.locator('.stop-panel').first();
    await expect(panel).toBeVisible();
    // Details come before the layer controls in the panel, not after them.
    const order = await page.evaluate(() => {
      const d = document.querySelector('.stop-panel');
      const l = document.querySelector('.mode-panel__body fieldset, .layer-panel');
      return d && l ? d.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
    });
    expect(order).toBeTruthy();
    // Readable without scrolling: the heading is inside the viewport.
    await expect(panel.getByRole('heading').first()).toBeInViewport();
    expect(await body.evaluate((el) => el.scrollTop)).toBe(0);

    const close = panel.getByRole('button', { name: /^Close details for / });
    const box = await close.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(page.locator('.stop-panel')).toHaveCount(0);
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBe(before);
  });
});
