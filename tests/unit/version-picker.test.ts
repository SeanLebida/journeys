import { describe, expect, it } from 'vitest';
import { buildCatalog, catalogLanguages, matchesQuery } from '../../src/content/bibleCatalog';
import { licensedDownloadNote } from '../../src/content/licensedNote';
import { translationMeta } from '../../src/content/translationMeta';
import { LICENSED_TRANSLATIONS } from '../../src/content/youversion';
import type { DownloadableTranslation } from '../../src/content/catalog';

const lsv: DownloadableTranslation = {
  id: 'hao:eng_lsv',
  sourceId: 'eng_lsv',
  name: 'Literal Standard Version',
  shortName: 'LSV',
  language: 'eng',
  languageName: 'English',
  rtl: false,
  completeUrl: 'https://bible.helloao.org/api/eng_lsv/complete.json',
  licenseLabel: 'Free to share (attribution, share-alike)',
  attributionRequired: true,
  verses: 31_000,
};

describe('version catalog', () => {
  const base = { helloao: [lsv], licensed: LICENSED_TRANSLATIONS, downloaded: [], active: {}, failed: {} };

  it('merges built-in, YouVersion and HelloAO, built-in first and installed', () => {
    const v = buildCatalog(base);
    expect(v.slice(0, 6).map((x) => x.id)).toEqual(['ASV', 'KJV', 'BSB', 'WEB', 'YLT', 'GNV']);
    expect(v.slice(0, 6).every((x) => x.installed && x.source === 'builtin')).toBe(true);
    expect(v.find((x) => x.id === 'yv:100')).toMatchObject({ source: 'youversion', access: 'download', installed: false, publisher: 'The Lockman Foundation' });
    expect(v.find((x) => x.id === 'hao:eng_lsv')).toMatchObject({ source: 'helloao', installed: false, coverage: 'full' });
  });

  it("shows each built-in Bible's own license (KJV carries the UK Crown copyright)", () => {
    const kjv = buildCatalog(base).find((x) => x.id === 'KJV');
    expect(kjv?.license).toBe('Public Domain (UK: Crown copyright)');
    expect(translationMeta('KJV', []).sourcing).toMatch(/^Public Domain \(UK: Crown copyright\), bundled/);
  });

  it('does not list a downloaded version twice and carries progress', () => {
    const { completeUrl: _c, ...rest } = lsv;
    const d = { ...rest, sizeBytes: 1, downloadedAt: '2026-11-13' };
    const v = buildCatalog({ ...base, downloaded: [d], active: { 'yv:2692': { progress: { phase: 'chapters', done: 3, total: 10 } } } });
    expect(v.filter((x) => x.id === 'hao:eng_lsv')).toHaveLength(1);
    expect(v.find((x) => x.id === 'hao:eng_lsv')?.installed).toBe(true);
    expect(v.find((x) => x.id === 'yv:2692')?.progress).toEqual({ phase: 'chapters', done: 3, total: 10 });
  });

  it('counts languages and searches abbreviation, name and publisher', () => {
    const v = buildCatalog(base);
    expect(catalogLanguages(v)).toEqual([{ code: 'eng', name: 'English', count: v.length }]);
    const lockman = v.filter((x) => matchesQuery(x, 'lockman')).map((x) => x.id);
    expect(lockman).toEqual(['yv:100', 'yv:2692']);
    expect(v.filter((x) => matchesQuery(x, 'kjv')).map((x) => x.id)).toEqual(['KJV']);
  });
});

describe('licensed download note', () => {
  it('Android says it keeps going and finishes on reopen', () => {
    expect(licensedDownloadNote('android')).toBe(
      "Downloaded through YouVersion with the publisher's permission. YouVersion allows about 200 chapters an hour, so a full Bible takes around 6 hours. It keeps going if you leave the app, and you'll get a notification when it's ready to read. If it pauses near the end, open Journeys and it will finish. Once it's done, it reads offline and stays on this device.",
    );
  });
  it('iPhone asks to keep Journeys open', () => {
    expect(licensedDownloadNote('ios')).toBe(
      "Downloaded through YouVersion with the publisher's permission. YouVersion allows about 200 chapters an hour, so a full Bible takes around 6 hours. Keep Journeys open while it downloads. If it stops, the chapters you have are saved, and it picks up where it left off when you open the app again. Once it's done, it reads offline and stays on this device.",
    );
  });
  it('web asks to keep the tab open', () => {
    const web = licensedDownloadNote('web');
    expect(web).toContain('Keep this tab open while it downloads.');
    expect(web).toContain('picks up where it left off when you come back.');
  });
});
