import { test, expect } from '@playwright/test';

/**
 * Steps the Ministry of Jesus journey through its first stops.
 *
 * Two things this test used to get wrong, both worth not repeating:
 *
 * 1. It wrote screenshots to an absolute path from one developer's machine, so
 *    it could only ever pass there. Artifacts now go through `testInfo.attach`,
 *    which puts them in the run's own output directory and into the HTML report.
 * 2. It asserted the transport was enabled immediately after a fixed 1 s wait.
 *    "Next" is deliberately disabled while a leg is in flight, and a leg takes
 *    longer than a second on a slow machine — so the test raced the animation
 *    and lost. It now waits for the control to re-enable, which is the app's own
 *    signal that the traveller has arrived.
 */
test('navigate through Ministry of Jesus journey stops', async ({ page }, testInfo) => {
  await page.goto('/trace/journey-ministry');

  const nextBtn = page.getByRole('button', { name: 'Next stop' });
  const status = page.locator('.trace-status-badge');

  // The badge reads "📍 <stop title> (n of N)" at rest and is the arrival signal.
  await expect(status).toContainText('(1 of', { timeout: 20_000 });
  await testInfo.attach('stop-1.png', { body: await page.screenshot(), contentType: 'image/png' });

  for (let i = 2; i <= 6; i++) {
    // Enabled == not travelling. Give a leg room to finish on a slow machine.
    await expect(nextBtn).toBeEnabled({ timeout: 20_000 });
    await nextBtn.click();
    await expect(status).toContainText(`(${i} of`, { timeout: 20_000 });
    await testInfo.attach(`stop-${i}.png`, { body: await page.screenshot(), contentType: 'image/png' });
  }

  // Arrived, and the panel is showing the sixth stop rather than a stale one.
  await expect(nextBtn).toBeEnabled({ timeout: 20_000 });
  await expect(status).toContainText('(6 of');
});
