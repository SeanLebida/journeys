import { test, expect } from '@playwright/test';
import { openNativeAndroid } from './nativeAndroid';

const APP_STORE = 'https://apps.apple.com/us/app/journeys-biblical-atlas/id6822033664';
const PLAY = 'https://play.google.com/store/apps/details?id=how.authentic.journeys';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

test.describe('web', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('home shows the store badges and links to the website', async ({ page }) => {
    await page.goto('/');
    const stores = page.getByRole('list', { name: 'Download Journeys' });
    await stores.scrollIntoViewIfNeeded();
    await expect(stores.getByRole('link')).toHaveCount(2);
    await expect(stores.getByRole('link').first()).toHaveAttribute('href', APP_STORE);
    const badge = page.getByRole('img', { name: 'Download on the App Store' });
    await expect(badge).toBeVisible();
    expect(await badge.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const site = page.getByRole('navigation', { name: 'Journeys website' });
    await expect(site.getByRole('link', { name: /About Journeys/ })).toHaveAttribute('href', 'https://journeys.authentic.how/');
    await expect(site.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', 'https://journeys.authentic.how/privacy/');
    for (const link of await page.locator('.get-app a').all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('Android visitors see Google Play first, on About too', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: ANDROID_UA, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('/about');
    const stores = page.getByRole('list', { name: 'Download Journeys' });
    await expect(stores.getByRole('link').first()).toHaveAttribute('href', PLAY);
    await ctx.close();
  });
});

test.describe('native', () => {
  test.use({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });

  test('the app hides the store badges but keeps the website links', async ({ page }) => {
    await openNativeAndroid(page, '/');
    const site = page.getByRole('navigation', { name: 'Journeys website' });
    await expect(site.getByRole('link', { name: 'Privacy policy' })).toBeAttached({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Journeys on the web' })).toBeAttached();
    await expect(page.getByRole('list', { name: 'Download Journeys' })).toHaveCount(0);
    await expect(page.locator('img[src*="badge"]')).toHaveCount(0);
  });
});
