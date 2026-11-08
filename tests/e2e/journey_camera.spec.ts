import { writeFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

async function cameraPosition(page: Page) {
  return page.evaluate(() => {
    const dot = document.querySelector('.trace-traveler')?.getBoundingClientRect();
    const panel = document.querySelector('.mode-panel')?.getBoundingClientRect();
    const map = document.querySelector('.maplibregl-canvas')?.getBoundingClientRect();
    if (!dot || !panel || !map) return null;
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    const left = landscape ? panel.right : map.left;
    const dock = document.querySelector('.tabbar')?.getBoundingClientRect();
    const bottom = landscape
      ? window.innerWidth >= 1024 ? map.bottom : Math.min(map.bottom, dock?.top ?? map.bottom)
      : panel.top;
    return { x: dot.x + dot.width / 2, y: dot.y + dot.height / 2,
      left, right: map.right, top: map.top, bottom,
      dx: dot.x + dot.width / 2 - (left + map.right) / 2,
      dy: dot.y + dot.height / 2 - (map.top + bottom) / 2 };
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
  test(`journey stays in the uncovered map ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await page.goto('/trace/journey-ministry');
    await expect(page.locator('.trace-traveler')).toBeAttached({ timeout: 20000 });
    const next = page.getByRole('button', { name: viewport.width < 1024 ? /^Continue to/ : 'Next stop' });
    const status = page.locator('.trace-status-badge');
    for (let stop = 1; stop <= 3; stop++) {
      await expect(status).toContainText(`(${stop} of`, { timeout: 25000 });
      await expect.poll(async () => {
        const pos = await cameraPosition(page);
        return pos ? pos.bottom - pos.top >= 120 && Math.abs(pos.dx) < 12 && Math.abs(pos.dy) < 12 : false;
      }, { timeout: 5000, message: 'traveller centered in the uncovered map' }).toBe(true).catch(async (error) => {
        const position = await cameraPosition(page);
        await writeFile(testInfo.outputPath(`failure-${stop}.json`), JSON.stringify(position));
        await page.screenshot({ path: testInfo.outputPath(`failure-${stop}.png`) });
        throw error;
      });
      await testInfo.attach(`stop-${stop}.json`, { body: JSON.stringify(await cameraPosition(page)), contentType: 'application/json' });
      if (stop < 3) {
        await next.click();
        await expect(page.locator('.journey-trace-layout')).toHaveAttribute('data-phase', 'travelling');
        await expect.poll(async () => {
          const pos = await cameraPosition(page);
          return pos ? Math.abs(pos.dx) < 12 && Math.abs(pos.dy) < 12 : false;
        }, { timeout: 5000, message: 'camera follows progress in the visible map during travel' }).toBe(true);
      }
    }
  });
}
