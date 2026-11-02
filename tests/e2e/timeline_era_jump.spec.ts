import { expect, test } from '@playwright/test';

// The native app routes on the URL hash, so an era chip must not change it:
// a #era link there opened the not-found page.
test('era chips scroll to the era without changing the URL', async ({ page }) => {
  await page.goto('/timeline');
  const before = page.url();
  const jump = page.getByRole('navigation', { name: 'Jump to an era' });
  await jump.getByRole('button', { name: 'The exile' }).click();

  expect(page.url()).toBe(before);
  await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeAttached();
  await expect(page.locator('#era-exile')).toBeFocused();
  await expect(page.locator('#era-exile').getByRole('heading', { name: 'The exile' })).toBeInViewport();
});
