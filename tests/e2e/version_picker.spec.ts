import { expect, test } from '@playwright/test';

// The header chip opens the version sheet. YouVersion versions read online by
// default; only the publisher-allowed ones (NASB) offer Download. Synthetic data only.
const PROXY = 'https://bible.authentic.how';

function bible(id: number, abbreviation: string, title: string, language: string, offline: boolean, readable = true) {
  return {
    id,
    abbreviation,
    localized_abbreviation: abbreviation,
    title,
    localized_title: title,
    language_tag: language,
    publisher_name: 'Test Publisher',
    publisher_url: 'https://publisher.example',
    copyright: null,
    info: null,
    book_count: 66,
    has_old_testament: true,
    has_new_testament: true,
    youversion_deep_link: `https://www.bible.com/versions/${id}`,
    readable,
    offline,
  };
}

test('version sheet: read online by default, Download only where allowed, RTL language, Escape steps back', async ({ page }) => {
  await page.route(`${PROXY}/**`, (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/v1/bibles') {
      const lang = url.searchParams.get('language_ranges[]');
      const data = lang === 'he' ? [{ ...bible(4001, 'THE', 'Test Hebrew Bible', 'he', false), book_count: 27, has_old_testament: false }] : [bible(111, 'AAA', 'A Locked Bible', 'en', false, false), bible(100, 'NASB1995', 'New American Standard Bible 1995', 'en', true), bible(3034, 'TSB', 'Test Stream Bible', 'en', false)];
      return route.fulfill({ json: { data, next_page_token: null, total_size: data.length } });
    }
    if (url.pathname === '/v1/bibles/100') return route.fulfill({ json: { id: 100, copyright: 'NASB1995 FULL NOTICE' } });
    if (url.pathname === '/v1/languages') {
      return route.fulfill({ json: { data: [{ id: 'en', localized_name: 'English', text_direction: 'ltr' }, { id: 'he', localized_name: 'Hebrew', text_direction: 'rtl' }] } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route('https://bible.helloao.org/**', (route) => route.fulfill({ json: { translations: [] } }));

  await page.goto('/bible?ref=Genesis%201%3A1');
  const chip = page.getByRole('button', { name: /^Translation: American Standard Version/ });
  await chip.click();
  // The dialog is named by its current view's heading (list, then details).
  await expect(page.getByRole('dialog', { name: 'Bible versions' })).toBeVisible();
  const sheet = page.getByRole('dialog');
  const online = sheet.getByRole('region', { name: /Read online/ });
  await expect(online.locator('[data-version="yv:3034"]')).toBeVisible();
  // Short code first; badges say how you get it.
  await expect(online.locator('[data-version="yv:100"]')).toContainText('NASB1995 · New American Standard Bible 1995');
  await expect(online.locator('[data-version="yv:100"]')).toContainText('Download');
  await expect(online.locator('[data-version="yv:3034"]')).toContainText('Read online');
  await expect(online.locator('[data-version="yv:3034"]')).not.toContainText('Download');
  await expect(sheet.getByPlaceholder('Search versions or languages')).toBeVisible();

  // A version Journeys can't open yet sorts last, says so, and offers no Read or Download.
  const ids = await online.locator('[data-version]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-version')));
  expect(ids.at(-1)).toBe('yv:111');
  await expect(online.locator('[data-version="yv:111"]')).toContainText('Not available yet');
  await online.locator('[data-version="yv:111"]').click();
  await expect(sheet.getByText("You can't read this version in Journeys yet. We're working with YouVersion to open up more versions.")).toBeVisible();
  await expect(sheet.getByRole('button', { name: /^(Read|Read online|Download)$/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Details of a stream-only version: Read online, no Download. Escape returns to the list, then closes.
  await sheet.getByRole('button', { name: 'About Test Stream Bible' }).click();
  await expect(sheet.getByRole('heading', { name: 'Test Stream Bible' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Read', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Download' })).toHaveCount(0);
  await expect(sheet.getByText('This version can be read online but not downloaded.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(online).toBeVisible();
  await sheet.getByRole('button', { name: 'About New American Standard Bible 1995' }).click();
  await expect(sheet.getByRole('button', { name: 'Download' })).toBeVisible();
  // The listing has no notice; details fetch it for that one version.
  await expect(sheet.getByText('NASB1995 FULL NOTICE')).toBeVisible();
  await expect(sheet.getByText(/200 chapters an hour/)).toBeVisible();
  await page.keyboard.press('Escape');

  // A search with no hits says so once.
  await sheet.getByPlaceholder('Search versions or languages').fill('zzzz');
  await expect(sheet.getByText('No versions match. Try another name or language.')).toBeVisible();
  await sheet.getByPlaceholder('Search versions or languages').fill('');

  // An RTL language lays its names out right to left.
  // Languages are a searchable list, not a <select>; Escape steps back to the versions.
  await sheet.getByRole('button', { name: /^Language English/ }).click();
  await expect(sheet.getByPlaceholder('Language name or code')).toBeFocused();
  await expect(sheet.getByRole('button', { name: /^All languages/ })).toBeVisible();
  await page.keyboard.type('hebr');
  await sheet.getByRole('button', { name: /^Hebrew/ }).click();
  await expect(sheet.locator('[data-version="yv:4001"] .vp-row__name [dir]')).toHaveAttribute('dir', 'rtl');
  await expect(sheet.locator('[data-version="yv:4001"]')).toContainText('New Testament only');
  await expect(sheet.getByRole('button', { name: /^Language Hebrew/ })).toBeFocused();
  await sheet.getByRole('button', { name: /^Language Hebrew/ }).click();
  await expect(sheet.getByRole('region', { name: 'Suggested languages' }).getByRole('button', { name: /^Hebrew/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await sheet.getByRole('button', { name: /^Language Hebrew/ }).click();
  await sheet.getByRole('region', { name: 'Suggested languages' }).getByRole('button', { name: /^English/ }).click();

  // Tapping a stream-only row reads it online and closes the sheet.
  await sheet.locator('[data-version="yv:3034"]').click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Translation: Test Stream Bible/ })).toBeFocused();
});


const LANGUAGES = [
  { id: 'en', localized_name: 'English', text_direction: 'ltr' },
  { id: 'es', localized_name: 'Spanish', text_direction: 'ltr' },
  { id: 'he', localized_name: 'Hebrew', text_direction: 'rtl' },
];

function catalogPage(data: ReturnType<typeof bible>[]) {
  return { json: { data, next_page_token: null, total_size: data.length } };
}

async function mockCatalog(
  page: import('@playwright/test').Page,
  versions: (lang: string | null) => ReturnType<typeof bible>[],
  opts?: { delayLang?: string; delay?: Promise<void> },
) {
  await page.route(`${PROXY}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/v1/bibles') {
      const lang = url.searchParams.get('language_ranges[]');
      if (opts?.delayLang && lang === opts.delayLang && opts.delay) await opts.delay;
      const data = versions(lang);
      return route.fulfill(catalogPage(data));
    }
    if (url.pathname === '/v1/bibles/100') return route.fulfill({ json: { id: 100, copyright: 'NASB1995 FULL NOTICE' } });
    if (url.pathname === '/v1/languages') return route.fulfill({ json: { data: LANGUAGES } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route('https://bible.helloao.org/**', (route) => route.fulfill({ json: { translations: [] } }));
}

function versionsFor(lang: string | null) {
  if (lang === 'he') return [{ ...bible(4001, 'THE', 'Test Hebrew Bible', 'he', false), book_count: 27, has_old_testament: false }];
  if (lang === 'es') return [bible(128, 'NVI-S', 'Nueva Versión Internacional - Español', 'es', false)];
  return [bible(111, 'AAA', 'A Locked Bible', 'en', false, false), bible(100, 'NASB1995', 'New American Standard Bible 1995', 'en', true), bible(3034, 'TSB', 'Test Stream Bible', 'en', false)];
}

test('switching language clears the previous list and shows a loading state', async ({ page }) => {
  let release: () => void = () => {};
  const delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockCatalog(page, versionsFor, { delayLang: 'he', delay });
  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: /^Translation: American Standard Version/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('[data-version="yv:3034"]')).toBeVisible();
  await sheet.getByRole('button', { name: /^Language English/ }).click();
  await page.keyboard.type('hebr');
  await sheet.getByRole('button', { name: /^Hebrew/ }).click();
  await expect(sheet.locator('[data-version="yv:3034"]')).toHaveCount(0);
  await expect(sheet.getByText('Loading versions…')).toBeVisible();
  await expect(sheet.locator('.vp-skel')).toHaveCount(3);
  release();
  await expect(sheet.locator('[data-version="yv:4001"]')).toBeVisible();
  await expect(sheet.getByText('Loading versions…')).toHaveCount(0);
});

test('at 360px, built-in versions stay compact so online versions are on the first screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockCatalog(page, versionsFor);
  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: /^Translation: American Standard Version/ }).click();
  const sheet = page.getByRole('dialog');
  const onDevice = sheet.getByRole('region', { name: 'On this device' });
  await expect(onDevice.locator('[data-version]')).toHaveCount(2);
  await expect(onDevice.locator('[data-version="ASV"]')).toBeVisible();
  await expect(onDevice.locator('[data-version="GNV"]')).toHaveCount(0);
  const online = sheet.getByRole('region', { name: /Read online/ });
  await expect(online.locator('[data-version="yv:100"]')).toBeInViewport();
  const fold = sheet.getByRole('button', { name: /Show \d+ built-in Bibles/ });
  const collapsed = await fold.textContent();
  await expect(fold).toBeVisible();
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  const controls = await fold.getAttribute('aria-controls');
  expect(controls).toBeTruthy();
  await expect(onDevice).toHaveAttribute('id', controls!);
  await expect(sheet.getByRole('button', { name: 'Show more' })).toHaveCount(0);
  await fold.click();
  await expect(sheet.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  await expect(sheet.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-controls', controls!);
  await expect(sheet.getByRole('button', { name: 'Show fewer' })).toBeVisible();
  await expect(onDevice.locator('[data-version="GNV"]')).toBeVisible();
  const builtinCount = await onDevice.locator('[data-version]').count();
  expect(collapsed).toBe(`Show ${builtinCount} built-in Bibles`);
  await sheet.getByRole('button', { name: 'Show fewer' }).click();
  await expect(sheet.getByRole('button', { name: `Show ${builtinCount} built-in Bibles` })).toBeVisible();
  await expect(onDevice.locator('[data-version]')).toHaveCount(2);
});

test('searching a language name surfaces that language and its versions', async ({ page }) => {
  await mockCatalog(page, versionsFor);
  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: /^Translation: American Standard Version/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('[data-version="yv:3034"]')).toBeVisible();
  const search = sheet.getByPlaceholder('Search versions or languages');
  await search.fill('span');
  await expect(sheet.getByRole('region', { name: 'Suggested languages' }).getByRole('button', { name: /^Spanish/ })).toBeVisible();
  await expect(sheet.getByText('No versions match. Try another name or language.')).toHaveCount(0);
  await search.fill('Spanish');
  await expect(sheet.locator('[data-version="yv:128"]')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /^Language Spanish/ })).toBeVisible();
  await expect(sheet.getByText('No versions match. Try another name or language.')).toHaveCount(0);
});

test('after reading a built-in, Recent is not repeated in On this device, and Read online stays on the first screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockCatalog(page, versionsFor);
  await page.goto('/bible?ref=Genesis%201%3A1');
  const chip = page.getByRole('button', { name: /^Translation: American Standard Version/ });
  await chip.click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('[data-version="KJV"]').click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole('button', { name: /^Translation: King James Version/ }).click();
  const again = page.getByRole('dialog');
  const recent = again.getByRole('region', { name: 'Recent' });
  const onDevice = again.getByRole('region', { name: 'On this device' });
  await expect(recent.locator('[data-version="KJV"]')).toBeVisible();
  await expect(onDevice.locator('[data-version="KJV"]')).toHaveCount(0);
  await expect(again.getByRole('region', { name: /Read online/ }).locator('[data-version="yv:100"]')).toBeInViewport();
});

test('clearing a language-name search restores the previous language; a Language list pick stays', async ({ page }) => {
  await mockCatalog(page, versionsFor);
  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: /^Translation: American Standard Version/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('[data-version="yv:3034"]')).toBeVisible();
  const search = sheet.getByPlaceholder('Search versions or languages');
  await search.fill('Spanish');
  await expect(sheet.locator('[data-version="yv:128"]')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /^Language Spanish/ })).toBeVisible();
  await search.fill('');
  await expect(sheet.getByRole('button', { name: /^Language English/ })).toBeVisible();
  await expect(sheet.locator('[data-version="yv:3034"]')).toBeVisible();
  await sheet.getByRole('button', { name: /^Language English/ }).click();
  await sheet.getByRole('region', { name: 'All languages' }).getByRole('button', { name: /^Spanish/ }).click();
  await expect(sheet.getByRole('button', { name: /^Language Spanish/ })).toBeVisible();
  await expect(sheet.locator('[data-version="yv:128"]')).toBeVisible();
  await search.fill('zzzz');
  await expect(sheet.getByText('No versions match. Try another name or language.')).toBeVisible();
  await search.fill('');
  await expect(sheet.getByRole('button', { name: /^Language Spanish/ })).toBeVisible();
  await expect(sheet.locator('[data-version="yv:128"]')).toBeVisible();
});

test('at 360px, version detail keeps Read and Download on screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockCatalog(page, versionsFor);
  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: /^Translation: American Standard Version/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'About New American Standard Bible 1995' }).click();
  await expect(sheet.getByRole('button', { name: 'Read', exact: true })).toBeInViewport();
  await expect(sheet.getByRole('button', { name: 'Download' })).toBeInViewport();
});
