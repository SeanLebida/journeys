import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_TTL_MS,
  FALLBACK_VERSIONS,
  capabilitiesFor,
  fetchCatalog,
  isRtlLanguage,
  languageMatches,
  loadCatalog,
  loadLanguages,
  parseCatalogItem,
  parseCatalogPage,
  parseYvId,
  searchCatalog,
  toLicensedTranslation,
  type CatalogStorage,
} from '../../src/content/youversionCatalog';

function item(id: number, abbreviation: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    abbreviation,
    localized_abbreviation: abbreviation,
    title: `${abbreviation} Bible`,
    localized_title: `English: ${abbreviation} Bible`,
    language_tag: 'en',
    publisher_name: 'Pub',
    publisher_url: 'https://pub.example',
    copyright: `© ${abbreviation}`,
    book_count: 66,
    has_old_testament: true,
    has_new_testament: true,
    youversion_deep_link: `https://www.bible.com/versions/${id}`,
    readable: true,
    offline: false,
    ...extra,
  };
}

function memoryStorage(seed: Record<string, string> = {}): CatalogStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function jsonFetch(pages: unknown[]) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url));
    const body = pages[Math.min(calls.length - 1, pages.length - 1)];
    if (body instanceof Error) throw body;
    if (typeof body === 'number') return new Response('{}', { status: body });
    return Response.json(body);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('capabilities', () => {
  it('download needs both read and offline; stream-only is readable but not storable', () => {
    expect(capabilitiesFor(true, true)).toEqual({ canRead: true, canDownload: true, streamOnly: false });
    expect(capabilitiesFor(true, false)).toEqual({ canRead: true, canDownload: false, streamOnly: true });
    expect(capabilitiesFor(false, true)).toEqual({ canRead: false, canDownload: false, streamOnly: false });
  });
});

describe('parseCatalogItem', () => {
  it('maps proxy fields, strips the language prefix from localized titles, and keeps the notice', () => {
    const v = parseCatalogItem(item(2692, 'NASB2020', { offline: true }))!;
    expect(v.id).toBe('yv:2692');
    expect(v.localizedTitle).toBe('NASB2020 Bible');
    expect(v.notice).toBe('© NASB2020');
    expect(v.capabilities.canDownload).toBe(true);
  });

  it('rejects incomplete items and non-https links', () => {
    expect(parseCatalogItem({ id: 1, abbreviation: 'X' })).toBeNull();
    expect(parseCatalogItem(item(-1, 'X'))).toBeNull();
    expect(parseCatalogItem(item(5, 'X', { publisher_url: 'javascript:alert(1)' }))!.publisherUrl).toBeNull();
  });

  it('raw YouVersion items (no Journeys flags) are not readable, and only known NASB counts as offline', () => {
    const raw = { ...item(3034, 'BSB'), readable: undefined, offline: undefined, book_count: undefined, has_old_testament: undefined, has_new_testament: undefined, books: ['MAT', 'JHN'] };
    const v = parseCatalogItem(raw)!;
    expect(v.capabilities.canRead).toBe(false);
    expect(v.hasNewTestament).toBe(true);
    expect(v.hasOldTestament).toBe(false);
    expect(parseCatalogItem({ ...item(100, 'NASB1995'), offline: undefined })!.capabilities.canDownload).toBe(true);
  });

  it('marks right-to-left languages', () => {
    expect(parseCatalogItem(item(9, 'HEB', { language_tag: 'he' }))!.rtl).toBe(true);
    expect(isRtlLanguage('sr-Latn')).toBe(false);
    expect(isRtlLanguage('pa-Arab')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
  });
});

describe('fetchCatalog', () => {
  it('walks every page with language and page token, de-duplicating ids', async () => {
    const { impl, calls } = jsonFetch([
      { data: [item(1, 'A'), item(2, 'B')], next_page_token: 'p2' },
      { data: [item(2, 'B'), item(3, 'C')] },
    ]);
    const list = await fetchCatalog('es', { base: 'https://proxy.test', fetchImpl: impl });
    expect(list.map((v) => v.yvId)).toEqual([1, 2, 3]);
    expect(calls[0]).toBe('https://proxy.test/v1/bibles?language_ranges%5B%5D=es&page_size=99');
    expect(calls[1]).toContain('page_token=p2');
  });

  it('refuses a malformed language before any request', async () => {
    const { impl } = jsonFetch([{}]);
    await expect(fetchCatalog('en*', { fetchImpl: impl })).rejects.toThrow();
    expect(impl).not.toHaveBeenCalled();
  });

  it('parseCatalogPage tolerates junk', () => {
    expect(parseCatalogPage(null)).toEqual({ versions: [], nextPageToken: null, totalSize: null });
  });
});

describe('loadCatalog caching and fallback', () => {
  const now = 1_800_000_000_000;

  it('fetches, caches, then serves the fresh cache without the network', async () => {
    const storage = memoryStorage();
    const first = jsonFetch([{ data: [item(1, 'A')] }]);
    const a = await loadCatalog('en', { fetchImpl: first.impl, storage, now: () => now });
    expect(a.source).toBe('network');
    const second = jsonFetch([500]);
    const b = await loadCatalog('en', { fetchImpl: second.impl, storage, now: () => now + 1000 });
    expect(b.source).toBe('cache');
    expect(b.stale).toBe(false);
    expect(b.versions.map((v) => v.abbreviation)).toEqual(['A']);
    expect(second.impl).not.toHaveBeenCalled();
  });

  it('after the lifetime it refetches, and offline it falls back to the stale cache', async () => {
    const storage = memoryStorage();
    await loadCatalog('en', { fetchImpl: jsonFetch([{ data: [item(1, 'A')] }]).impl, storage, now: () => now });
    const offline = jsonFetch([new TypeError('Failed to fetch')]);
    const r = await loadCatalog('en', { fetchImpl: offline.impl, storage, now: () => now + CATALOG_TTL_MS + 1 });
    expect(offline.impl).toHaveBeenCalled();
    expect(r.source).toBe('cache');
    expect(r.stale).toBe(true);
    expect(r.error).toMatch(/Failed to fetch/);
  });

  it('with no cache and no proxy route (403 before deploy) it falls back to NASB 1995 and 2020', async () => {
    const r = await loadCatalog('en', { fetchImpl: jsonFetch([403]).impl, storage: memoryStorage(), now: () => now });
    expect(r.source).toBe('fallback');
    expect(r.versions.map((v) => v.id)).toEqual(['yv:100', 'yv:2692']);
    expect(r.versions.every((v) => v.capabilities.canDownload)).toBe(true);
    const es = await loadCatalog('es', { fetchImpl: jsonFetch([403]).impl, storage: memoryStorage(), now: () => now });
    expect(es.versions).toEqual([]);
  });

  it('a tampered cache cannot grant downloads its flags do not have', async () => {
    const storage = memoryStorage({
      'journeys-yv-catalog:v1:en': JSON.stringify({
        v: 1,
        fetchedAt: now,
        versions: [{ ...parseCatalogItem(item(3034, 'BSB'))!, capabilities: { canRead: true, canDownload: false, streamOnly: false } }],
      }),
    });
    const r = await loadCatalog('en', { fetchImpl: jsonFetch([500]).impl, storage, now: () => now });
    expect(r.versions[0].capabilities).toEqual({ canRead: true, canDownload: false, streamOnly: true });
  });

  it('a full storage quota does not break loading', async () => {
    const storage: CatalogStorage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    const r = await loadCatalog('en', { fetchImpl: jsonFetch([{ data: [item(1, 'A')] }]).impl, storage, now: () => now });
    expect(r.source).toBe('network');
  });
});

describe('loadLanguages', () => {
  it('reads localized names and falls back to English when offline', async () => {
    const ok = jsonFetch([{ data: [{ id: 'es', localized_name: 'Spanish', text_direction: 'ltr' }, { id: 'he', localized_name: 'Hebrew', text_direction: 'rtl' }] }]);
    const langs = await loadLanguages('en', { fetchImpl: ok.impl, storage: memoryStorage() });
    expect(langs.map((l) => [l.tag, l.rtl])).toEqual([
      ['he', true],
      ['es', false],
    ]);
    const off = await loadLanguages('en', { fetchImpl: jsonFetch([new TypeError('offline')]).impl, storage: memoryStorage() });
    expect(off.map((l) => l.tag)).toEqual(['en']);
  });
});

describe('search and helpers', () => {
  const list = [item(1, 'NASB2020'), item(2, 'NASB1995'), item(3, 'AMP', { title: 'Amplified Bible', localized_title: 'Amplified Bible' }), item(4, 'NVI', { title: 'Nueva Versión Internacional', localized_title: 'Nueva Versión Internacional' })]
    .map((x) => parseCatalogItem(x)!);

  it('ranks exact abbreviation, then prefix, then text matches, ignoring accents', () => {
    expect(searchCatalog(list, 'nasb1995').map((v) => v.yvId)).toEqual([2]);
    expect(searchCatalog(list, 'nasb').map((v) => v.yvId)).toEqual([2, 1]);
    expect(searchCatalog(list, 'version').map((v) => v.yvId)).toEqual([4]);
    expect(searchCatalog(list, 'amplified').map((v) => v.yvId)).toEqual([3]);
    expect(searchCatalog(list, '').length).toBe(4);
  });

  it('language ranges match like RFC 4647 basic filtering', () => {
    expect(languageMatches('en-US', 'en')).toBe(true);
    expect(languageMatches('eng', 'en')).toBe(false);
    expect(languageMatches('pt-BR', '*')).toBe(true);
  });

  it('converts to the download pipeline shape and parses ids', () => {
    expect(toLicensedTranslation(FALLBACK_VERSIONS[0])).toMatchObject({ id: 'yv:100', yvId: 100, shortName: 'NASB1995', publisher: 'The Lockman Foundation' });
    expect(parseYvId('yv:2692')).toBe(2692);
    expect(parseYvId('hao:eng_lsv')).toBeNull();
  });
});
