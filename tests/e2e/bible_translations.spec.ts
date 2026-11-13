import { expect, test } from '@playwright/test';

// Each newly bundled translation must load its own text offline in the reader,
// and the reader's pick must survive a relaunch.
const GENESIS_1_1: Record<string, string> = {
  ASV: 'In the beginning God created the heavens and the earth.',
  KJV: 'In the beginning God created the heaven and the earth.',
  BSB: 'In the beginning God created the heavens and the earth.',
  WEB: 'In the beginning, God created the heavens and the earth.',
  YLT: "In the beginning of God's preparing the heavens and the earth",
  GNV: 'In the beginning God created the heauen and the earth.',
};

test('every bundled translation reads Genesis 1 and the choice persists', async ({ page }) => {
  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.route('https://bible.helloao.org/**', (route) => route.fulfill({ json: { translations: [] } }));
  await page.route('https://bible.authentic.how/**', (route) => route.abort('internetdisconnected'));
  const chip = page.getByRole('button', { name: /^Translation:/ });
  await expect(chip).toBeVisible();
  const sheet = page.getByRole('dialog', { name: 'Bible versions' });
  const pick = async (id: string) => {
    await chip.click();
    const row = sheet.locator(`[data-version="${id}"]`).first();
    if (!(await row.isVisible())) await sheet.getByRole('button', { name: 'Show more' }).click();
    await row.click();
    await expect(sheet).toHaveCount(0);
  };

  await chip.click();
  const onDevice = sheet.getByRole('region', { name: 'On this device' });
  const compact = await onDevice.locator('[data-version]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-version')));
  expect(compact).toEqual(['ASV', 'KJV']);
  await sheet.getByRole('button', { name: 'Show more' }).click();
  const offered = await onDevice.locator('[data-version]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-version')));
  expect(offered.slice(0, 6)).toEqual(Object.keys(GENESIS_1_1));
  await expect(onDevice.getByText('Built in · Public Domain (UK: Crown copyright)')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(chip).toBeFocused();

  const firstVerse = page.locator('#v1');
  for (const [id, text] of Object.entries(GENESIS_1_1)) {
    await pick(id);
    await expect(page.locator('.bible__translation-tag')).toHaveText(`(${id})`);
    await expect(firstVerse).toContainText(text);
    // A full chapter, not one stray verse.
    await expect(page.locator('.bible-verse')).toHaveCount(31);
  }

  await pick('BSB');
  await expect(firstVerse).toContainText(GENESIS_1_1.BSB);
  // Reload at the same passage: the saved translation, not the default, must load.
  await page.reload();
  await expect(page.locator('.vp-chip__abbr')).toHaveText('BSB');
  await expect(page.locator('#v1')).toContainText(GENESIS_1_1.BSB);
});
