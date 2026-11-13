import type { DownloadableTranslation } from '../../content/catalog';
import type { DownloadedTranslation, DownloadProgress } from '../../content/downloads';
import { TRANSLATIONS } from '../../content/translations';
import type { YouVersionLanguage, YouVersionVersion } from '../../content/youversionCatalog';
import type { StreamedTranslation } from '../../state/useUiStore';

/**
 * View rows for the version picker. Not a data contract: the data comes from
 * TRANSLATIONS (built in), useUiStore (downloaded / streamed), HelloAO's
 * catalog and useYouVersionCatalog; this only shapes it for one list.
 */
export type RowState =
  /** Built in or downloaded: reads offline. */
  | 'device'
  /** YouVersion, read chapter by chapter online. The normal state for licensed versions. */
  | 'online'
  /** HelloAO free text that has to be downloaded before it can be read. */
  | 'download'
  /** YouVersion lists it but the proxy won't serve it (canRead false): shown, not openable. */
  | 'unavailable';

export interface VersionRow {
  id: string;
  abbreviation: string;
  name: string;
  /** BCP 47 tag when known (YouVersion), else HelloAO's ISO 639-3 code. */
  lang: string;
  languageName: string;
  rtl: boolean;
  source: 'builtin' | 'helloao' | 'youversion';
  state: RowState;
  /** YouVersion only: the publisher lets Journeys keep an offline copy. */
  canDownload: boolean;
  publisher?: string | null;
  publisherUrl?: string | null;
  license?: string;
  licenseUrl?: string;
  notice?: string | null;
  /** `Full Bible`, `New Testament`, `Old Testament` or `Partial`. */
  coverage?: string;
  progress?: DownloadProgress;
  error?: string;
  yv?: YouVersionVersion;
  hao?: DownloadableTranslation;
}

export function builtinRows(): VersionRow[] {
  return TRANSLATIONS.map((t) => ({
    id: t.id,
    abbreviation: t.id,
    name: t.name,
    lang: 'en',
    languageName: 'English',
    rtl: false,
    source: 'builtin',
    state: 'device',
    canDownload: false,
    license: t.license,
    licenseUrl: t.infoUrl,
    coverage: 'Full Bible',
  }));
}

export function downloadedRow(d: DownloadedTranslation): VersionRow {
  const yv = d.id.startsWith('yv:');
  return {
    id: d.id,
    abbreviation: d.shortName,
    name: d.name,
    lang: d.language,
    languageName: d.languageName,
    rtl: d.rtl,
    source: yv ? 'youversion' : 'helloao',
    state: 'device',
    canDownload: yv,
    license: yv ? 'Used by permission' : d.licenseLabel,
    licenseUrl: d.licenseUrl,
    notice: d.notice,
  };
}

export function streamedRow(s: StreamedTranslation): VersionRow {
  return {
    id: s.id,
    abbreviation: s.shortName,
    name: s.name,
    lang: s.languageTag,
    languageName: s.languageTag,
    rtl: s.rtl,
    source: 'youversion',
    state: 'online',
    canDownload: false,
    publisher: s.publisher,
    publisherUrl: s.publisherUrl,
    license: 'Used by permission',
    notice: s.notice,
  };
}

/** Most YouVersion versions are New Testament only (1,023 of 1,484 on staging), so rows say which. */
export function yvCoverage(v: Pick<YouVersionVersion, 'hasOldTestament' | 'hasNewTestament' | 'bookCount'>): string {
  if (v.hasOldTestament && v.hasNewTestament) return v.bookCount >= 66 ? 'Full Bible' : 'Partial';
  if (v.hasNewTestament) return v.bookCount >= 27 ? 'New Testament' : 'Partial';
  if (v.hasOldTestament) return 'Old Testament';
  return 'Partial';
}

export function youVersionRow(v: YouVersionVersion, languageName: string): VersionRow {
  return {
    id: v.id,
    abbreviation: v.localizedAbbreviation || v.abbreviation,
    name: v.localizedTitle || v.title,
    lang: v.languageTag,
    languageName,
    rtl: v.rtl,
    source: 'youversion',
    state: v.capabilities.canRead ? 'online' : 'unavailable',
    canDownload: v.capabilities.canRead && v.capabilities.canDownload,
    publisher: v.publisher,
    publisherUrl: v.publisherUrl ?? v.deepLink,
    license: 'Used by permission',
    licenseUrl: v.deepLink ?? undefined,
    notice: v.notice,
    coverage: yvCoverage(v),
    yv: v,
  };
}

export function helloAoRow(t: DownloadableTranslation, lang: string): VersionRow {
  return {
    id: t.id,
    abbreviation: t.shortName,
    name: t.name,
    lang,
    languageName: t.languageName,
    rtl: t.rtl,
    source: 'helloao',
    state: 'download',
    canDownload: true,
    license: t.licenseLabel,
    licenseUrl: t.licenseUrl,
    coverage: t.verses >= 30_000 ? 'Full Bible' : t.verses >= 7_900 && t.verses < 8_100 ? 'New Testament' : 'Partial',
    hao: t,
  };
}

export interface LanguageOption {
  key: string;
  name: string;
  rtl: boolean;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/**
 * One language list: YouVersion's languages (BCP 47), plus any HelloAO-only
 * language under its ISO 639-3 code. HelloAO entries join a YouVersion
 * language by English name, since the two use different code systems.
 */
export function languageOptions(yv: YouVersionLanguage[], hao: DownloadableTranslation[]): { options: LanguageOption[]; haoKey: (t: DownloadableTranslation) => string } {
  const byName = new Map(yv.map((l) => [fold(l.name), l.tag]));
  const haoKey = (t: DownloadableTranslation) => byName.get(fold(t.languageName)) ?? t.language;
  const options = new Map<string, LanguageOption>(yv.map((l) => [l.tag, { key: l.tag, name: l.name, rtl: l.rtl }]));
  if (!options.has('en')) options.set('en', { key: 'en', name: 'English', rtl: false });
  for (const t of hao) {
    const key = haoKey(t);
    if (!options.has(key)) options.set(key, { key, name: t.languageName, rtl: t.rtl });
  }
  return { options: [...options.values()].sort((a, b) => a.name.localeCompare(b.name)), haoKey };
}

export function rowMatches(r: VersionRow, query: string): boolean {
  const q = fold(query);
  return !q || fold(`${r.abbreviation} ${r.name} ${r.languageName} ${r.publisher ?? ''}`).includes(q);
}

/** Readable versions first; ones Journeys can't open yet sink to the bottom (order otherwise kept). */
export function readableFirst(rows: VersionRow[]): VersionRow[] {
  return [...rows.filter((r) => r.state !== 'unavailable'), ...rows.filter((r) => r.state === 'unavailable')];
}

/** Languages whose name or tag matches a version-sheet search (name contains, tag exact or prefix). */
export function matchingLanguages(options: LanguageOption[], query: string): LanguageOption[] {
  const q = fold(query);
  if (!q) return [];
  return options.filter((o) => fold(o.name).includes(q) || fold(o.key) === q || fold(o.key).startsWith(`${q}-`));
}

/** A unique exact name match, used to load that language's versions from the search box. Tags are ignored so a version code like ESV is not treated as a language. */
export function exactLanguageName(options: LanguageOption[], query: string): LanguageOption | undefined {
  const q = fold(query);
  if (!q) return undefined;
  const hits = options.filter((o) => fold(o.name) === q);
  return hits.length === 1 ? hits[0] : undefined;
}

/** On-device rows with the current version, then recent, then the rest, for a compact first screen. */
export function orderedDeviceRows(rows: VersionRow[], current: string, recent: string[]): VersionRow[] {
  const seen = new Set<string>();
  const out: VersionRow[] = [];
  const take = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (r && !seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  };
  take(current);
  for (const id of recent) take(id);
  for (const r of rows) take(r.id);
  return out;
}

/** True when every version already belongs to `language` (so a refresh can keep showing them). */
export function catalogMatchesLanguage(versions: { languageTag: string }[], language: string): boolean {
  if (language === '*') return true;
  const r = language.toLowerCase();
  return versions.every((v) => {
    const t = v.languageTag.toLowerCase();
    return t === r || t.startsWith(`${r}-`);
  });
}

/** Label for the On this device built-ins fold only. `count` is the total number of built-in Bibles. */
export function builtinFoldLabel(expanded: boolean, count: number): string {
  return expanded ? 'Show fewer' : `Show ${count} built-in Bibles`;
}

/**
 * On this device rows for the first screen: when collapsed, hide extra built-ins
 * and anything already shown in Recent, so Read online stays in view at phone
 * width. Pass preview 0 when Recent already lists the active Bible.
 */
export function visibleDeviceRows(
  ordered: VersionRow[],
  recentIds: readonly string[],
  preview: number,
  opts: { expanded: boolean; searching: boolean },
): VersionRow[] {
  if (opts.searching || opts.expanded) return ordered;
  const builtins = ordered.filter((r) => r.source === 'builtin');
  const hide = new Set<string>(opts.searching ? [] : recentIds);
  if (builtins.length > preview) {
    for (const r of builtins.slice(preview)) hide.add(r.id);
  }
  return ordered.filter((r) => !hide.has(r.id));
}

/** Hebrew, Arabic, Syriac, Thaana, NKo, and Arabic/Hebrew presentation forms. */
const RTL_SCRIPT = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * `dir` for a version title. A language can be RTL while the title is still
 * Latin or Devanagari (ur-Deva, English glosses). Forcing `rtl` then mirrors
 * punctuation; `auto` follows the title's first strong character. Titles that
 * are themselves in an RTL script keep `rtl`.
 */
export function versionTitleDir(title: string, languageRtl: boolean): 'rtl' | 'auto' {
  if (languageRtl && RTL_SCRIPT.test(title)) return 'rtl';
  return 'auto';
}
