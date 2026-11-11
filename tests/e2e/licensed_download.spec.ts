import { expect, test } from '@playwright/test';

// NASB comes through the Journeys Bible proxy chapter by chapter, is stored
// encrypted, carries Lockman's notice, and is reported exactly once. The proxy
// is mocked with synthetic text; no licensed text lives in the repo.
const PROXY = 'https://bible.authentic.how';
const NOTICE = 'TEST BIBLE®\nCopyright © Test Foundation\nhttp://www.lockman.org';

function chapterHtml(book: string, ch: number, verses: number): string {
  const v = Array.from(
    { length: verses },
    (_, i) => `<span class="yv-v" v="${i + 1}"></span><span class="yv-vlbl">${i + 1}</span>${book} ${ch} licensed verse ${i + 1}, the L<span class="sc">ord</span>. `,
  ).join('');
  return `<div><div class="p">${v}</div></div>`;
}

test('download NASB 1995, read it offline with the notice, reported once', async ({ page }) => {
  const posts: { url: string; headers: Record<string, string> }[] = [];
  const gets: Record<string, string>[] = [];
  let online = true;
  await page.route(`${PROXY}/**`, (route) => {
    if (!online) return route.abort('internetdisconnected');
    const req = route.request();
    const url = req.url();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (req.method() === 'POST') {
      posts.push({ url, headers: req.headers() });
      return route.fulfill({ json: { ok: true } });
    }
    gets.push(req.headers());
    if (url.endsWith('/v1/bibles/100')) return route.fulfill({ json: { id: 100, abbreviation: 'NASB1995', copyright: NOTICE } });
    if (url.endsWith('/v1/bibles/100/books')) {
      return route.fulfill({
        json: {
          data: [
            { id: 'GEN', chapters: [{ passage_id: 'GEN.INTRO' }, { passage_id: 'GEN.1' }, { passage_id: 'GEN.2' }] },
            { id: 'JHN', chapters: [{ passage_id: 'JHN.1' }] },
          ],
        },
      });
    }
    const m = /\/passages\/([A-Z0-9]{3})\.(\d+)\?/.exec(url);
    if (m) return route.fulfill({ json: { id: `${m[1]}.${m[2]}`, content: chapterHtml(m[1], Number(m[2]), 5), reference: '' } });
    return route.fulfill({ status: 404 });
  });
  await page.route('https://bible.helloao.org/**', (route) => route.fulfill({ json: { translations: [] } }));

  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: 'Translations' }).click();
  const licensed = page.getByRole('list', { name: 'Licensed Bibles to download' });
  await expect(licensed.getByText('New American Standard Bible (2020)')).toBeVisible();
  await expect(page.getByText(/Biblica|NIV/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Download New American Standard Bible (1995)' }).click();
  const installed = page.locator('.bible__library-item', { hasText: 'New American Standard Bible (1995)' });
  await expect(installed.getByRole('button', { name: 'Remove New American Standard Bible (1995)' })).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0].url).toBe(`${PROXY}/v1/bibles/100/downloads`);
  expect(posts[0].headers['x-journeys-download']).toBe('complete');
  expect(gets.every((h) => h['x-journeys-client'] === 'journeys')).toBe(true);
  expect(gets.some((h) => Object.keys(h).some((k) => k.includes('key')))).toBe(false);

  // Encrypted at rest: the stored value is ciphertext, not a SQLite file.
  const stored = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const req = indexedDB.open('journeys-bibles');
        req.onsuccess = () => {
          const get = req.result.transaction('dbs').objectStore('dbs').get('yv:100');
          get.onsuccess = () => {
            const v = new Uint8Array(get.result as Uint8Array);
            const head = new TextDecoder().decode(v.slice(0, 15));
            resolve(head.startsWith('JSB1') && !head.startsWith('SQLite') ? 'sealed' : 'plain');
          };
        };
      }),
  );
  expect(stored).toBe('sealed');

  await installed.getByRole('button', { name: 'Read' }).click();
  await expect(page.locator('.bible__translation-tag')).toHaveText('(NASB1995)');
  await expect(page.locator('#v1')).toContainText('GEN 1 licensed verse 1, the LORD.');
  await expect(page.getByTestId('bible-notice')).toContainText('Copyright © Test Foundation');

  // Offline after a relaunch it still reads, decrypted on this device, and isn't reported again.
  online = false;
  await page.reload();
  await expect(page.locator('.bible__translation-tag')).toHaveText('(NASB1995)');
  await expect(page.locator('#v3')).toContainText('GEN 1 licensed verse 3');
  await expect(page.getByTestId('bible-notice')).toBeVisible();
  expect(posts).toHaveLength(1);
});

test('a licensed Bible whose key was lost offers Download again', async ({ page }) => {
  await page.route(`${PROXY}/**`, (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === 'POST') return route.fulfill({ json: { ok: true } });
    if (url.endsWith('/v1/bibles/100')) return route.fulfill({ json: { id: 100, copyright: NOTICE } });
    if (url.endsWith('/v1/bibles/100/books')) return route.fulfill({ json: { data: [{ id: 'GEN', chapters: [{ passage_id: 'GEN.1' }] }] } });
    const m = /\/passages\/([A-Z0-9]{3})\.(\d+)\?/.exec(url);
    if (m) return route.fulfill({ json: { id: `${m[1]}.${m[2]}`, content: chapterHtml(m[1], Number(m[2]), 3), reference: '' } });
    return route.fulfill({ status: 404 });
  });
  await page.route('https://bible.helloao.org/**', (route) => route.fulfill({ json: { translations: [] } }));

  await page.goto('/bible?ref=Genesis%201%3A1');
  await page.getByRole('button', { name: 'Translations' }).click();
  await page.getByRole('button', { name: 'Download New American Standard Bible (1995)' }).click();
  const installed = page.locator('.bible__library-item', { hasText: 'New American Standard Bible (1995)' });
  await installed.getByRole('button', { name: 'Read' }).click();
  await expect(page.locator('#v1')).toContainText('GEN 1 licensed verse 1');

  // Lose the encryption key, as if the WebView's storage had been cleared.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('journeys-bibles');
        req.onsuccess = () => {
          const tx = req.result.transaction('dbs', 'readwrite');
          tx.objectStore('dbs').delete('__journeys_licensed_key__');
          tx.oncomplete = () => resolve();
        };
      }),
  );
  await page.reload();
  const alert = page.getByRole('alert').filter({ hasText: "can't be opened on this device anymore" });
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Download again' }).click();

  await expect(page.getByRole('button', { name: 'Download New American Standard Bible (1995)' })).toBeVisible();
  await page.getByRole('button', { name: 'Download New American Standard Bible (1995)' }).click();
  await installed.getByRole('button', { name: 'Read' }).click();
  await expect(page.locator('#v1')).toContainText('GEN 1 licensed verse 1');
});
