import { expect, test } from '@playwright/test';

test('ambiguous site lists rival identifications and self-reviewed status', async ({ page }) => {
  await page.goto('/atlas?site=site-baptism-at-the-jordan');
  await expect(page.getByRole('heading', { name: /Bethany beyond the Jordan/ })).toBeVisible();
  const rivals = page.locator('.site-candidates');
  await expect(page.getByRole('heading', { name: 'Rival identifications' })).toBeVisible();
  await expect(rivals.locator('strong', { hasText: 'Al-Maghtas' })).toBeVisible();
  await expect(rivals.locator('strong', { hasText: 'Qasr el-Yahud' })).toBeVisible();
  await expect(page.getByText('Not specialist-signed').first()).toBeVisible();
});

test('home sourcing disclosure names the self-reviewed limit', async ({ page }) => {
  await page.goto('/');
  await page.locator('.sourcing > summary').click();
  await expect(page.getByText(/not yet signed them off/i).first()).toBeVisible();
  await expect(page.locator('dt.review--self-reviewed')).toBeVisible();
});
