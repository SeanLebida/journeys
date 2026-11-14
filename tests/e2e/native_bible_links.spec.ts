import { test, expect, type Page } from '@playwright/test';
import { openNativeAndroid } from './nativeAndroid';

// Phone, running the bundle the way the Android app does (hash router,
// Preferences storage through the bridge), with a different journey saved.
test.use({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 });

const SAVED = JSON.stringify({
  state: {
    lessons: {},
    currentLessonId: null,
    routes: { 'journey-paul-1': 4 },
    currentJourneyId: 'journey-paul-1',
    timeline: null,
    quizzes: {},
    currentQuizId: null,
  },
  version: 0,
});

async function openBibleChapter(page: Page) {
  await openNativeAndroid(page, '/', { preferences: { 'journeys-place': SAVED }, bridgeDelayMs: 50 });
  expect(await page.evaluate(() => (window as unknown as { Capacitor: { isNativePlatform(): boolean } }).Capacitor.isNativePlatform())).toBe(true);
  // Resume the saved journey first, the way a reader arrives with one in progress.
  await page.locator('.tabbar').getByRole('link', { name: /Trace/ }).tap();
  await expect(page).toHaveURL(/#\/trace\/journey-paul-1$/);
  await expect(page.getByText('Stop 5 of')).toBeVisible({ timeout: 15_000 });
  // In-app navigation to the chapter, as a passage link would do.
  await page.evaluate(() => {
    location.hash = '#/bible?ref=1%20Kings%2018%3A21';
  });
  const row = page.locator('.bible-xrefs__item', { hasText: 'The contest with the prophets of Baal' });
  await expect(row).toBeAttached({ timeout: 15_000 });
  return row;
}

test('native: In the atlas Trace → opens the tapped journey, not the saved one', async ({ page }) => {
  const row = await openBibleChapter(page);
  const link = row.getByRole('link', { name: 'Trace →' });
  await link.scrollIntoViewIfNeeded();
  await expect(link).toHaveAttribute('href', '#/trace/journey-elijah?play=1&stop=4');
  const box = await link.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await link.tap();

  await expect(page).toHaveURL(/#\/trace\/journey-elijah\?play=1&stop=4$/);
  await expect(page.getByRole('link', { name: /Elijah — drought, Carmel, and Horeb/ })).toBeVisible();
  await expect(page.getByText('Stop 5 of 10')).toBeVisible();
  await expect(page.getByText("Paul's First Missionary Journey")).toHaveCount(0);
});

test('native: tapping a verse reference in In the atlas stays on the chapter', async ({ page }) => {
  const row = await openBibleChapter(page);
  const verses = row.locator('.bible-xrefs__verses');
  const target = (await verses.getAttribute('href'))!.slice(1);
  expect(target).toMatch(/^v\d+$/);
  await verses.scrollIntoViewIfNeeded();
  await verses.tap();

  await expect(page).toHaveURL(/#\/bible\?ref=/);
  await expect(page.getByText('404 Not Found')).toHaveCount(0);
  await expect(page.locator(`#${target}`)).toBeInViewport();
});
