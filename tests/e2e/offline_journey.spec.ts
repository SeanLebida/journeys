import { expect, test } from '@playwright/test';

test('a journey shows the traveller after the connection drops', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, { timeout: 15_000 });
  await context.setOffline(true);
  await page.goto('/trace/journey-paul-1');
  await expect(page.locator('.trace-traveler')).toBeVisible({ timeout: 15_000 });
});
