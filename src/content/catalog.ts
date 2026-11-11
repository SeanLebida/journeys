import type { HelloAoCatalogEntry } from './helloao';
import { fetchOrExplain } from './net';
import { TRANSLATIONS, type DownloadedId } from './translations';

export const HELLOAO_ORIGIN = 'https://bible.helloao.org';
export const HELLOAO_CATALOG_URL = `${HELLOAO_ORIGIN}/api/available_translations.json`;

/** Downloaded translations are namespaced so they can never collide with a bundled id. */
export const DOWNLOAD_PREFIX = 'hao:' as const;

/** A translation a reader can download, already checked against our license rule. */
export interface DownloadableTranslation {
  /** Reader id, e.g. `hao:eng_lsv`. */
  id: DownloadedId;
  /** HelloAO id, e.g. `eng_lsv`. */
  sourceId: string;
  name: string;
  shortName: string;
  language: string;
  languageName: string;
  rtl: boolean;
  completeUrl: string;
  licenseLabel: string;
  licenseUrl?: string;
  attributionRequired: boolean;
  verses: number;
}

/** HelloAO ids already shipped inside the app (or the same text under another id). */
const BUNDLED_SOURCE_IDS = new Set<string>([
  ...TRANSLATIONS.flatMap((t) => (t.source.kind === 'helloao' ? [t.source.url.split('/api/')[1].split('/')[0]] : [])),
  // ASV and KJV are bundled from bibleapi; HelloAO carries the same texts.
  'eng_asv',
  'eng_kjv',
]);

function licenseLabel(l: NonNullable<HelloAoCatalogEntry['license']>): string {
  if (l.publicDomain) return 'Public domain';
  if (l.copyleft) return 'Free to share (attribution, share-alike)';
  if (l.derivatives === 'not-allowed') return 'Free to share (attribution, no changes)';
  return 'Free to share (attribution)';
}

/**
 * The download rule: only texts whose license allows commercial use, so the app
 * stays within every translation's terms whether or not it is ever paid. Partial
 * Bibles are offered too (many languages only have a New Testament), but entries
 * without a complete-text link are skipped.
 */
export function toDownloadable(entries: HelloAoCatalogEntry[]): DownloadableTranslation[] {
  return entries
    .filter((e) => e.license?.commercialUse === 'allowed' && e.completeTranslationApiLink && !BUNDLED_SOURCE_IDS.has(e.id))
    .map((e): DownloadableTranslation => {
      const license = e.license!;
      return {
        id: `${DOWNLOAD_PREFIX}${e.id}` as const,
        sourceId: e.id,
        name: e.englishName || e.name,
        shortName: e.shortName || e.id,
        language: e.language,
        languageName: e.languageEnglishName || e.languageName || e.language,
        rtl: e.textDirection === 'rtl',
        completeUrl: new URL(e.completeTranslationApiLink!, HELLOAO_ORIGIN).toString(),
        licenseLabel: licenseLabel(license),
        licenseUrl: e.licenseUrl || e.website,
        attributionRequired: license.attribution === 'required',
        verses: e.totalNumberOfVerses ?? 0,
      };
    })
    .sort((a, b) => a.languageName.localeCompare(b.languageName) || b.verses - a.verses || a.name.localeCompare(b.name));
}

export async function fetchCatalog(signal?: AbortSignal): Promise<DownloadableTranslation[]> {
  const res = await fetchOrExplain(HELLOAO_CATALOG_URL, { signal });
  if (!res.ok) throw new Error(`Couldn't load the translation list (${res.status}).`);
  const body = (await res.json()) as { translations: HelloAoCatalogEntry[] };
  return toDownloadable(body.translations);
}
