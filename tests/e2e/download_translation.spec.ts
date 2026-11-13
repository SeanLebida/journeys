import { expect, test } from '@playwright/test';

// A reader can download a free translation, read it offline after a relaunch,
// and remove it. HelloAO is mocked with a small fake translation so the test is
// fast and doesn't depend on the network.
const CATALOG = {
  translations: [
    {
      id: 'eng_tst',
      name: 'Test Literal Bible',
      englishName: 'Test Literal Bible',
      shortName: 'TLB',
      language: 'eng',
      languageEnglishName: 'English',
      licenseUrl: 'https://example.org/license',
      license: { attribution: 'required', commercialUse: 'allowed', derivatives: 'allowed', copyleft: true, publicDomain: false },
      completeTranslationApiLink: '/api/eng_tst/complete.json',
      totalNumberOfVerses: 31,
    },
    {
      id: 'eng_nc',
      name: 'Noncommercial Bible',
      shortName: 'NCB',
      language: 'eng',
      license: { attribution: 'required', commercialUse: 'not-allowed', derivatives: 'not-allowed', copyleft: false, publicDomain: false },
      completeTranslationApiLink: '/api/eng_nc/complete.json',
      totalNumberOfVerses: 31102,
    },
  ],
};

const COMPLETE = {
  translation: { id: 'eng_tst', numberOfBooks: 1, totalNumberOfVerses: 31 },
  books: [
    {
      id: 'GEN',
      order: 1,
      chapters: [
        {
          chapter: {
            number: 1,
            content: Array.from({ length: 31 }, (_, i) => ({
              type: 'verse',
              number: i + 1,
              content: i === 0 ? ['In a beginning God made', { noteId: 1 }, { text: 'the skies and the land.', poem: 1 }] : [`Test verse ${i + 1}.`],
            })),
          },
        },
      ],
    },
  ],
};

test('download a translation, read it offline after reload, then remove it', async ({ page }) => {
  let online = true;
  await page.route('https://bible.helloao.org/**', (route) => {
    if (!online) return route.abort('internetdisconnected');
    const url = route.request().url();
    if (url.endsWith('/available_translations.json')) return route.fulfill({ json: CATALOG });
    if (url.endsWith('/eng_tst/complete.json')) return route.fulfill({ json: COMPLETE });
    return route.fulfill({ status: 404 });
  });

  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: 'Translations' }).click();

  const toDownload = page.getByRole('list', { name: 'Translations to download' });
  await expect(toDownload.getByText('Test Literal Bible')).toBeVisible();
  // Noncommercial licenses are never offered.
  await expect(page.getByText('Noncommercial Bible')).toHaveCount(0);

  await page.getByRole('button', { name: 'Download Test Literal Bible' }).click();
  const installed = page.locator('.bible__library-item', { hasText: 'Test Literal Bible' });
  await expect(installed.getByRole('button', { name: 'Remove Test Literal Bible' })).toBeVisible();
  await installed.getByRole('button', { name: 'Read' }).click();

  await expect(page.locator('.bible__translation-tag')).toHaveText('(TLB)');
  await expect(page.locator('#v1')).toContainText('In a beginning God made the skies and the land.');
  await expect(page.locator('.bible-verse')).toHaveCount(31);
  await expect(page.getByRole('button', { name: /^Translation: Test Literal Bible/ })).toBeVisible();

  // Relaunch with HelloAO unreachable: the text must come from this device.
  online = false;
  await page.reload();
  await expect(page.getByRole('button', { name: /^Translation: Test Literal Bible/ })).toBeVisible();
  await expect(page.locator('#v1')).toContainText('In a beginning God made');

  // A book this translation doesn't have says so instead of breaking.
  await page.goto('/bible?ref=John%201%3A1');
  await expect(page.getByText("John 1 isn't in this translation.")).toBeVisible();

  await page.getByRole('button', { name: 'Translations' }).click();
  await page.getByRole('button', { name: 'Remove Test Literal Bible' }).click();
  const chip = page.getByRole('button', { name: /^Translation: American Standard Version/ });
  await expect(chip).toBeVisible();
  await chip.click();
  const deviceSheet = page.getByRole('dialog');
  const more = deviceSheet.getByRole('button', { name: 'Show more' });
  if (await more.count()) await more.click();
  await expect(deviceSheet.getByRole('region', { name: 'On this device' }).locator('[data-version="hao:eng_tst"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Offline, the library explains why it can't list more.
  await expect(page.getByRole('alert')).toBeVisible();
});
