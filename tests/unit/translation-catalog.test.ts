import { describe, expect, it } from 'vitest';
import { toDownloadable } from '../../src/content/catalog';
import type { HelloAoCatalogEntry } from '../../src/content/helloao';
import { translationMeta } from '../../src/content/translationMeta';
import type { DownloadedTranslation } from '../../src/content/downloads';

const open = { attribution: 'required', commercialUse: 'allowed', derivatives: 'allowed', copyleft: true, publicDomain: false } as const;
const entry = (over: Partial<HelloAoCatalogEntry>): HelloAoCatalogEntry => ({
  id: 'eng_lsv',
  name: 'English LSV',
  shortName: 'LSV',
  language: 'eng',
  languageEnglishName: 'English',
  license: open,
  licenseUrl: 'https://ebible.org/Scriptures/details.php?id=englsv',
  completeTranslationApiLink: '/api/eng_lsv/complete.json',
  totalNumberOfVerses: 31104,
  ...over,
});

describe('downloadable translation catalog', () => {
  it('lists only texts whose license allows commercial use', () => {
    const list = toDownloadable([
      entry({}),
      entry({ id: 'eng_leb', license: { ...open, commercialUse: 'not-allowed', copyleft: false, derivatives: 'not-allowed' } }),
      entry({ id: 'eng_net', license: null }),
    ]);
    expect(list.map((t) => t.sourceId)).toEqual(['eng_lsv']);
  });

  it('skips translations already built into the app and entries with no complete text', () => {
    const list = toDownloadable([
      entry({ id: 'BSB' }),
      entry({ id: 'eng_kjv' }),
      entry({ id: 'eng_asv' }),
      entry({ id: 'eng_partial', completeTranslationApiLink: undefined }),
    ]);
    expect(list).toEqual([]);
  });

  it('namespaces ids, resolves the download URL and labels the license', () => {
    const [lsv] = toDownloadable([entry({})]);
    expect(lsv.id).toBe('hao:eng_lsv');
    expect(lsv.completeUrl).toBe('https://bible.helloao.org/api/eng_lsv/complete.json');
    expect(lsv.licenseLabel).toBe('Free to share (attribution, share-alike)');
    expect(lsv.attributionRequired).toBe(true);
    const [pd] = toDownloadable([entry({ id: 'AAB', license: { ...open, publicDomain: true, copyleft: false } })]);
    expect(pd.licenseLabel).toBe('Public domain');
  });
});

describe('translation meta', () => {
  it('names bundled and downloaded translations with their own sourcing line', () => {
    expect(translationMeta('KJV', []).label).toBe('KJV');
    const [lsv] = toDownloadable([entry({})]);
    const { completeUrl: _u, ...rest } = lsv;
    const d: DownloadedTranslation = { ...rest, sizeBytes: 1, downloadedAt: '2026-11-11T00:00:00Z' };
    const meta = translationMeta('hao:eng_lsv', [d]);
    expect(meta.label).toBe('LSV');
    expect(meta.sourcing).toMatch(/share-alike.*downloaded to this device/);
  });
});
