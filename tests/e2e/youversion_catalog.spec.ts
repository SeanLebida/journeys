import { expect, test } from '@playwright/test';

// The Licensed list comes from the proxy's YouVersion catalog. A version the
// publisher lets us keep shows Download; a stream-only one shows Read online
// and is read chapter by chapter without being stored. Synthetic data only.
const PROXY = 'https://bible.authentic.how';

function bible(id: number, abbreviation: string, title: string, readable: boolean, offline: boolean) {
  return {
    id,
    abbreviation,
    localized_abbreviation: abbreviation,
    title,
    localized_title: `English: ${title}`,
    language_tag: 'en',
    publisher_name: 'Test Publisher',
    publisher_url: 'https://publisher.example',
    copyright: `${abbreviation} TEST NOTICE`,
    info: null,
    book_count: 66,
    has_old_testament: true,
    has_new_testament: true,
    youversion_deep_link: `https://www.bible.com/versions/${id}`,
    readable,
    offline,
  };
}

test('catalog lists downloadable and stream-only versions; stream-only reads online without storing text', async ({ page }) => {
  const passageGets: string[] = [];
  await page.route(`${PROXY}/**`, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/v1/bibles') {
      return route.fulfill({
        json: {
          data: [
            bible(100, 'NASB1995', 'New American Standard Bible 1995', true, true),
            bible(3034, 'TSB', 'Test Stream Bible', true, false),
            bible(111, 'LOCKED', 'Locked Bible', false, false),
          ],
          next_page_token: null,
          total_size: 3,
        },
      });
    }
    if (url.pathname === '/v1/languages') return route.fulfill({ json: { data: [{ id: 'en', localized_name: 'English', text_direction: 'ltr' }] } });
    if (url.pathname === '/v1/bibles/3034/books') {
      return route.fulfill({ json: { data: [{ id: 'GEN', chapters: [{ passage_id: 'GEN.1' }, { passage_id: 'GEN.2' }] }] } });
    }
    const m = /^\/v1\/bibles\/3034\/passages\/([A-Z0-9]{3})\.(\d+)$/.exec(url.pathname);
    if (m) {
      passageGets.push(url.pathname);
      const verses = [1, 2, 3].map((v) => `<span class="yv-v" v="${v}"></span><span class="yv-vlbl">${v}</span>streamed ${m[1]} ${m[2]} verse ${v}. `).join('');
      return route.fulfill({ json: { id: `${m[1]}.${m[2]}`, content: `<div><div class="p">${verses}</div></div>` } });
    }
    return route.fulfill({ status: 404 });
  });
  await page.route('https://bible.helloao.org/**', (route) => route.fulfill({ json: { translations: [] } }));

  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: 'Translations' }).click();
  const licensed = page.getByRole('list', { name: 'Licensed Bibles to download' });
  await expect(licensed.getByRole('button', { name: 'Download New American Standard Bible 1995' })).toBeVisible();
  await expect(licensed.getByRole('button', { name: 'Read Test Stream Bible online' })).toBeVisible();
  await expect(licensed.getByText('Locked Bible')).toHaveCount(0);
  await expect(licensed.getByRole('button', { name: 'Download Test Stream Bible' })).toHaveCount(0);

  await licensed.getByRole('button', { name: 'Read Test Stream Bible online' }).click();
  await page.getByRole('navigation', { name: 'Reader sections' }).getByRole('button').first().click();
  await expect(page.locator('.bible__translation-tag')).toHaveText('(TSB)');
  await expect(page.locator('#v1')).toContainText('streamed GEN 1 verse 1.');
  await expect(page.getByTestId('bible-notice')).toContainText('TSB TEST NOTICE');
  expect(passageGets).toContain('/v1/bibles/3034/passages/GEN.1');

  // Nothing of the text is stored: no IndexedDB copy, and only labels in localStorage.
  const stored = await page.evaluate(
    () =>
      new Promise<{ idb: boolean; local: string }>((resolve) => {
        const local = Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '').join('\n');
        const req = indexedDB.open('journeys-bibles');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('dbs')) return resolve({ idb: false, local });
          const get = db.transaction('dbs').objectStore('dbs').get('yv:3034');
          get.onsuccess = () => resolve({ idb: get.result !== undefined, local });
          get.onerror = () => resolve({ idb: false, local });
        };
        req.onerror = () => resolve({ idb: false, local });
      }),
  );
  expect(stored.idb).toBe(false);
  expect(stored.local).not.toContain('streamed GEN');
});
