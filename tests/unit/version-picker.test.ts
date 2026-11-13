import { describe, expect, it } from 'vitest';
import { builtinRows, helloAoRow, languageOptions, readableFirst, rowMatches, youVersionRow, yvCoverage } from '../../src/modes/bible/versionRows';
import { licensedDownloadNote } from '../../src/content/licensedNote';
import { translationMeta } from '../../src/content/translationMeta';
import { capabilitiesFor, FALLBACK_VERSIONS } from '../../src/content/youversionCatalog';
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

describe('version picker rows', () => {
  it("built-in rows are on the device and carry each Bible's own license", () => {
    const rows = builtinRows();
    expect(rows.map((r) => r.id)).toEqual(['ASV', 'KJV', 'BSB', 'WEB', 'YLT', 'GNV']);
    expect(rows.every((r) => r.state === 'device')).toBe(true);
    expect(rows.find((r) => r.id === 'KJV')?.license).toBe('Public Domain (UK: Crown copyright)');
    expect(translationMeta('KJV', []).sourcing).toMatch(/^Public Domain \(UK: Crown copyright\), bundled/);
  });

  it('YouVersion rows read online by default; only allow-listed ones offer Download', () => {
    const nasb = youVersionRow(FALLBACK_VERSIONS[0], 'English');
    expect(nasb).toMatchObject({ state: 'online', canDownload: true, source: 'youversion' });
    const streamOnly = youVersionRow({ ...FALLBACK_VERSIONS[0], id: 'yv:3034', yvId: 3034, capabilities: capabilitiesFor(true, false) }, 'English');
    expect(streamOnly).toMatchObject({ state: 'online', canDownload: false });
    const hebrew = youVersionRow({ ...FALLBACK_VERSIONS[0], id: 'yv:9', yvId: 9, languageTag: 'he', rtl: true, capabilities: capabilitiesFor(true, false) }, 'Hebrew');
    expect(hebrew).toMatchObject({ rtl: true, lang: 'he' });
  });

  it("versions the proxy won't serve are shown as unavailable and sorted last", () => {
    const locked = youVersionRow({ ...FALLBACK_VERSIONS[0], id: 'yv:111', yvId: 111, capabilities: capabilitiesFor(false, false) }, 'English');
    expect(locked).toMatchObject({ state: 'unavailable', canDownload: false });
    const nasb = youVersionRow(FALLBACK_VERSIONS[0], 'English');
    expect(readableFirst([locked, nasb]).map((r) => r.id)).toEqual([nasb.id, 'yv:111']);
  });

  it('coverage says New Testament for NT-only versions', () => {
    expect(yvCoverage({ hasOldTestament: false, hasNewTestament: true, bookCount: 27 })).toBe('New Testament');
    expect(yvCoverage({ hasOldTestament: true, hasNewTestament: true, bookCount: 66 })).toBe('Full Bible');
    expect(yvCoverage({ hasOldTestament: false, hasNewTestament: true, bookCount: 4 })).toBe('Partial');
  });

  it('HelloAO joins a YouVersion language by name and keeps its own code otherwise', () => {
    const swahili = { ...lsv, id: 'hao:swh_x' as const, language: 'swh', languageName: 'Swahili' };
    const { options, haoKey } = languageOptions([{ tag: 'en', name: 'English', rtl: false, defaultYvId: 100 }], [lsv, swahili]);
    expect(haoKey(lsv)).toBe('en');
    expect(haoKey(swahili)).toBe('swh');
    expect(options.map((o) => o.key)).toEqual(['en', 'swh']);
    expect(helloAoRow(lsv, 'en')).toMatchObject({ state: 'download', lang: 'en' });
  });

  it('search matches abbreviation, name and publisher', () => {
    const nasb = youVersionRow(FALLBACK_VERSIONS[0], 'English');
    expect(rowMatches(nasb, 'lockman')).toBe(true);
    expect(rowMatches(nasb, 'nasb')).toBe(true);
    expect(rowMatches(nasb, 'kjv')).toBe(false);
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
