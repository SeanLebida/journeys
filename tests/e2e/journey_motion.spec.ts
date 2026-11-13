import { test, expect } from '@playwright/test';

/**
 * Steps the Ministry of Jesus journey through its first stops.
 *
 * Things this test used to get wrong, worth not repeating:
 *
 * 1. It wrote screenshots to an absolute path from one developer's machine, so
 *    it could only ever pass there. Artifacts now go through `testInfo.attach`,
 *    which puts them in the run's own output directory and into the HTML report.
 * 2. It asserted the transport was enabled immediately after a fixed 1 s wait.
 *    "Next" is deliberately disabled while a leg is in flight, and a leg takes
 *    longer than a second on a slow machine — so the test raced the animation
 *    and lost. It now waits for the control to re-enable, which is the app's own
 *    signal that the traveller has arrived.
 * 3. The default 30 s test timeout is no longer enough. After long legs were
 *    given more time (up to ~12.6 s on desktop, ~18.7 s on a compact screen),
 *    the first five Ministry legs — Bethlehem to Egypt to Nazareth, then on
 *    to the Temple — take about 38 s of travel alone, plus load. The
 *    assertions were still right; the run just died mid-leg on the way to
 *    stop 4. 120 s is the same kind of budget journey_camera.spec.ts already
 *    uses (90 s for fewer hops), with room for the extra legs.
 */
test('navigate through Ministry of Jesus journey stops', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
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
