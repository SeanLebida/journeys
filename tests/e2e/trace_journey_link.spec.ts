import { test, expect, type Page } from '@playwright/test';

const RESUME = {
  state: {
    lessons: {},
    currentLessonId: null,
    routes: { 'journey-paul-1': 4, 'journey-elijah': 7 },
    currentJourneyId: 'journey-paul-1',
    timeline: null,
    quizzes: {},
    currentQuizId: null,
  },
  version: 0,
};

async function seedResume(page: Page) {
  await page.addInitScript((payload) => {
    localStorage.setItem('journeys-place', payload);
  }, JSON.stringify(RESUME));
}

test('timeline Trace this journey opens that journey, not a saved resume', async ({ page }) => {
  await seedResume(page);
  await page.goto('/timeline');

  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  await monarchy.getByRole('button', { name: /Elijah the Tishbite/ }).click();

  const card = monarchy.locator('.tl-detail');
  const link = card.getByRole('link', { name: /Trace this journey/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /\/trace\/journey-elijah\?play=1/);
  await link.click();

  await expect(page).toHaveURL(/\/trace\/journey-elijah/);
  await expect(page.getByRole('link', { name: /Elijah — drought, Carmel, and Horeb/ })).toBeVisible();
  await expect(page.getByText('Stop 1 of 10')).toBeVisible();
  await expect(page.getByText("Paul's First Missionary Journey")).toHaveCount(0);
});

test('bible Trace link opens that journey at the cited stop, not a saved resume', async ({ page }) => {
  await seedResume(page);
  await page.goto('/bible?ref=1%20Kings%2018%3A21');

  const xrefs = page.locator('.bible-xrefs');
  const row = xrefs.locator('.bible-xrefs__item', { hasText: 'The contest with the prophets of Baal' });
  await expect(row).toBeVisible({ timeout: 15_000 });
  const link = row.getByRole('link', { name: 'Trace →' });
  await expect(link).toHaveAttribute('href', /\/trace\/journey-elijah\?play=1&stop=4/);
  await link.click();

  await expect(page).toHaveURL(/\/trace\/journey-elijah/);
  await expect(page.getByRole('link', { name: /Elijah — drought, Carmel, and Horeb/ })).toBeVisible();
  await expect(page.getByText('The contest with the prophets of Baal').first()).toBeVisible();
  await expect(page.getByText('Stop 5 of 10')).toBeVisible();
  await expect(page.getByText("Paul's First Missionary Journey")).toHaveCount(0);
});

test('atlas place detail traces the stop’s journey, not a saved resume', async ({ page }) => {
  await seedResume(page);
  await page.goto('/atlas?site=site-tishbe');

  const visit = page.locator('.stop-visit', { hasText: 'Elijah — drought, Carmel, and Horeb' });
  const link = visit.getByRole('link', { name: /Trace this journey/ });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await link.click();

  await expect(page).toHaveURL(/\/trace\/journey-elijah/);
  await expect(page.getByText('Stop 1 of 10')).toBeVisible();
  await expect(page.getByText("Paul's First Missionary Journey")).toHaveCount(0);
});

test('an item with no journey does not show a Trace this journey link', async ({ page }) => {
  await page.goto('/timeline');
  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  await monarchy.getByRole('button', { name: /Ramoth-gilead/ }).click();

  const card = monarchy.locator('.tl-detail');
  await expect(card.getByRole('heading', { name: /Ramoth-gilead/ })).toBeVisible();
  await expect(card.getByRole('link', { name: /Trace this journey/ })).toHaveCount(0);
  await expect(card.getByRole('link', { name: 'Trace →' })).toHaveCount(0);
});

async function expectTapTarget(locator: import('@playwright/test').Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'expected a bounding box').toBeTruthy();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
}

test("a person's Also link opens that journey", async ({ page }) => {
  await page.goto('/timeline');
  const era = page.locator('#era-apostolic');
  await era.scrollIntoViewIfNeeded();
  const paul = era.getByRole('button', { name: /Paul the Apostle/ });
  await paul.scrollIntoViewIfNeeded();
  await paul.click();

  const card = era.locator('.tl-detail');
  await expect(card.getByRole('heading', { name: /Paul the Apostle/ })).toBeVisible();
  const also = card.getByRole('link', { name: /Also: Paul's Second Missionary Journey/ });
  await expect(also).toBeVisible();
  await also.click();

  await expect(page).toHaveURL(/\/trace\/journey-paul-2/);
  await expect(page.getByRole('link', { name: /Paul's Second Missionary Journey/ })).toBeVisible();
  await expect(page.getByText('Stop 1 of')).toBeVisible();
});

test('journey links have a 44px tap target at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });

  await page.goto('/timeline');
  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  await monarchy.getByRole('button', { name: /Elijah the Tishbite/ }).click();
  const elijah = monarchy.locator('.tl-detail');
  await expectTapTarget(elijah.getByRole('link', { name: /Trace this journey/ }));
  await expectTapTarget(elijah.getByRole('link', { name: /on the atlas/ }));
  await expectTapTarget(elijah.getByRole('link', { name: /Read 1 Kings/ }));

  const era = page.locator('#era-apostolic');
  await era.scrollIntoViewIfNeeded();
  const paul = era.getByRole('button', { name: /Paul the Apostle/ });
  await paul.scrollIntoViewIfNeeded();
  await paul.click();
  const card = era.locator('.tl-detail');
  await expectTapTarget(card.getByRole('link', { name: /Trace this journey/ }));
  await expectTapTarget(card.getByRole('link', { name: /Also: Paul's Second Missionary Journey/ }));

  await page.goto('/bible?ref=1%20Kings%2018%3A21');
  const row = page.locator('.bible-xrefs__item', { hasText: 'The contest with the prophets of Baal' });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expectTapTarget(row.getByRole('link', { name: 'Trace →' }));
  await expectTapTarget(row.getByRole('link', { name: 'Map →' }));

  await page.goto('/atlas?site=site-tishbe');
  const visit = page.locator('.stop-visit', { hasText: 'Elijah — drought, Carmel, and Horeb' });
  await expectTapTarget(visit.getByRole('link', { name: /Trace this journey/ }));
});
