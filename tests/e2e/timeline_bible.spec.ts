import { expect, test } from '@playwright/test';

test('timeline lays out eras with parallel lanes against one year rail', async ({ page }) => {
  await page.goto('/timeline');
  await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();

  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  await expect(monarchy.getByRole('heading', { name: 'The monarchy' })).toBeVisible();

  // Figures authored in this pass must actually appear on the chart.
  await expect(monarchy.getByRole('button', { name: /Elijah the Tishbite/ })).toBeVisible();
  await expect(monarchy.getByRole('button', { name: /Isaiah son of Amoz/ })).toBeVisible();

  // The lanes share one vertical scale, which only holds if they are laid out
  // side by side rather than wrapped onto separate rows: every lane track must
  // start at the same y as the year rail.
  const axisBox = await monarchy.locator('.tl-axis').boundingBox();
  const trackBoxes = await monarchy.locator('.tl-lane__track').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().top),
  );
  expect(trackBoxes.length).toBeGreaterThan(1);
  for (const top of trackBoxes) expect(Math.abs(top - axisBox!.y)).toBeLessThan(2);
});

test('timeline entry opens a detail card inside its own era band', async ({ page }) => {
  await page.goto('/timeline');
  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  await monarchy.getByRole('button', { name: /Elijah the Tishbite/ }).click();

  const card = monarchy.locator('.tl-detail');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Elijah the Tishbite' })).toBeVisible();
  await expect(card.getByRole('link', { name: /Trace this journey/ })).toBeVisible();
});

test('bible reader opens a deep-linked passage with its atlas cross-references', async ({ page }) => {
  await page.goto('/bible?ref=1%20Kings%2018%3A21');

  // Verse text comes from the bundled SQLite, not from a network call.
  await expect(page.getByText(/How long (go|halt) ye limping|halt ye between two opinions/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // The cross-reference panel is the bridge back to the map.
  const xrefs = page.locator('.bible-xrefs');
  await expect(xrefs.getByText('The contest with the prophets of Baal')).toBeVisible();
  await expect(xrefs.getByRole('link', { name: 'Trace →' }).first()).toBeVisible();
});

test('a verse note survives a reload', async ({ page }) => {
  await page.goto('/bible?ref=Jonah%203%3A4');
  await expect(page.getByText(/Yet forty days/i).first()).toBeVisible({ timeout: 15_000 });

  // Verse 4 is already active from the deep link; open a different one.
  await page.locator('.bible-verse__num').nth(5).click();
  await page.locator('.bible-note__area').fill('Nineveh believed.');
  await page.getByRole('button', { name: 'Save note' }).click();

  await page.reload();
  await page.getByRole('button', { name: /My notes/ }).click();
  await expect(page.getByText('Nineveh believed.')).toBeVisible();
});

test('trace lists the newly authored prophetic and monarchy journeys', async ({ page }) => {
  await page.goto('/trace');
  await expect(page.getByText('Elijah — drought, Carmel, and Horeb')).toBeVisible();
  await expect(page.getByText('Jonah — Joppa, the sea, and Nineveh')).toBeVisible();
  await expect(page.getByText('The exile — Jerusalem to Babylon')).toBeVisible();
  await expect(page.getByText('Peter — Jerusalem to Caesarea, and the road to Rome')).toBeVisible();
});
