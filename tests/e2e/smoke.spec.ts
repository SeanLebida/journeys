import { expect, test } from '@playwright/test';

test('home shows the app and links to all four modes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Journeys' })).toBeVisible();
  for (const path of ['/trace', '/atlas', '/lessons', '/quiz']) {
    await expect(page.locator(`a[href="${path}"]`).first()).toBeVisible();
  }
});

test('trace lists the journeys', async ({ page }) => {
  await page.goto('/trace');
  await expect(page.getByText("Paul's First Missionary Journey")).toBeVisible();
  await expect(page.getByText('The Ministry of Jesus')).toBeVisible();
});

test('lesson renders scripture text from the bundled Bible DB', async ({ page }) => {
  await page.goto('/lessons/lesson-galilean-ministry');
  // ScripturePassage resolves Matthew 4:13 via sql.js -> verse mentions Capernaum.
  await expect(page.getByText(/Capernaum/i).first()).toBeVisible({ timeout: 15_000 });
});

test('quiz scores a multiple-choice answer', async ({ page }) => {
  await page.goto('/quiz/quiz-foundations');
  await expect(page.getByText(/Score:\s*0/)).toBeVisible();
  // Answer the Pilate-title MCQ correctly ("Prefect").
  await page.getByRole('button', { name: 'Prefect', exact: true }).click();
  await expect(page.getByText(/Score:\s*1/)).toBeVisible();
});

test('map canvas mounts (WebGL)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-canvas').locator('canvas')).toBeVisible({ timeout: 15_000 });
});

test('works offline after first load (service worker)', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 15_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Journeys' })).toBeVisible();
  await context.setOffline(false);
});
