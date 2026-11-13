import type { DownloadableTranslation } from './catalog';
import type { DownloadedTranslation, DownloadProgress } from './downloads';
import { TRANSLATIONS } from './translations';
import type { LicensedTranslation } from './youversion';

/**
 * One list of every Bible version the reader can pick, from all three sources:
 * built in (public domain, ships in the app), HelloAO (free to download) and
 * YouVersion (licensed, through the Journeys Bible proxy).
 *
 * This is the interface the version picker is drawn against. The data side
 * (a proxy listing route and the full YouVersion catalog) is owned separately;
 * whatever replaces the internals of useBibleCatalog should keep this shape.
 */
export type VersionSource = 'builtin' | 'helloao' | 'youversion';
/** `download`: can be stored for offline reading. `online`: licensed to read online only. */
export type VersionAccess = 'download' | 'online';
export type VersionCoverage = 'full' | 'nt' | 'partial';

export interface CatalogVersion {
  /** Reader id: `ASV`, `hao:eng_lsv` or `yv:100`. */
  id: string;
  abbreviation: string;
  name: string;
  /** Grouping key, ISO 639-3 like HelloAO (`eng`). YouVersion's BCP 47 tags (`en`) are mapped to it. */
  language: string;
  languageName: string;
  publisher?: string;
  publisherUrl?: string;
  /** Short license line, e.g. `Public Domain (UK: Crown copyright)` or `Used by permission`. */
  license: string;
  licenseUrl?: string;
  /** Publisher's copyright notice (YouVersion `copyright`); may span lines. */
  copyright?: string;
  coverage?: VersionCoverage;
  rtl: boolean;
  source: VersionSource;
  access: VersionAccess;
  /** Readable offline right now (built in, or finished downloading). */
  installed: boolean;
  progress?: DownloadProgress;
  error?: string;
  /** Dev-only sample data. Never present in a production build. */
  fixture?: true;
}

export interface CatalogLanguage {
  code: string;
  name: string;
  count: number;
}

export interface BibleCatalog {
  /** Built-in and installed versions are always present; `status` is about the remote lists. */
  status: 'loading' | 'ready' | 'error';
  error?: string;
  languages: CatalogLanguage[];
  versions: CatalogVersion[];
  retry: () => void;
  download: (id: string) => void;
  cancel: (id: string) => void;
  remove: (id: string) => Promise<void>;
}

const FULL_BIBLE_VERSES = 30_000;

function coverage(verses: number): VersionCoverage {
  if (verses >= FULL_BIBLE_VERSES) return 'full';
  if (verses >= 7_900 && verses < 8_100) return 'nt';
  return 'partial';
}

interface Inputs {
  helloao: DownloadableTranslation[];
  licensed: readonly LicensedTranslation[];
  downloaded: DownloadedTranslation[];
  active: Record<string, { progress: DownloadProgress } | undefined>;
  failed: Record<string, string | undefined>;
  extra?: CatalogVersion[];
}

/** Merge the three sources into one de-duplicated list (pure, for tests). */
export function buildCatalog({ helloao, licensed, downloaded, active, failed, extra = [] }: Inputs): CatalogVersion[] {
  const out: CatalogVersion[] = [];
  const seen = new Set<string>();
  const push = (v: CatalogVersion) => {
    if (seen.has(v.id)) return;
    seen.add(v.id);
    out.push({ ...v, progress: active[v.id]?.progress, error: failed[v.id] });
  };
  for (const t of TRANSLATIONS) {
    push({
      id: t.id,
      abbreviation: t.id,
      name: t.name,
      language: 'eng',
      languageName: 'English',
      license: t.license,
      licenseUrl: t.infoUrl,
      coverage: 'full',
      rtl: false,
      source: 'builtin',
      access: 'download',
      installed: true,
    });
  }
  const installed = new Map(downloaded.map((d) => [d.id, d]));
  for (const t of licensed) {
    const d = installed.get(t.id);
    push({
      id: t.id,
      abbreviation: t.shortName,
      name: t.name,
      language: 'eng',
      languageName: 'English',
      publisher: t.publisher,
      publisherUrl: t.publisherUrl,
      license: 'Used by permission',
      licenseUrl: t.publisherUrl,
      copyright: d?.notice,
      coverage: 'full',
      rtl: false,
      source: 'youversion',
      access: 'download',
      installed: Boolean(d),
    });
  }
  for (const d of downloaded) {
    if (d.id.startsWith('yv:')) continue;
    push({
      id: d.id,
      abbreviation: d.shortName,
      name: d.name,
      language: d.language,
      languageName: d.languageName,
      license: d.licenseLabel,
      licenseUrl: d.licenseUrl,
      coverage: coverage(d.verses),
      rtl: d.rtl,
      source: 'helloao',
      access: 'download',
      installed: true,
    });
  }
  for (const t of helloao) {
    push({
      id: t.id,
      abbreviation: t.shortName,
      name: t.name,
      language: t.language,
      languageName: t.languageName,
      license: t.licenseLabel,
      licenseUrl: t.licenseUrl,
      coverage: coverage(t.verses),
      rtl: t.rtl,
      source: 'helloao',
      access: 'download',
      installed: false,
    });
  }
  for (const v of extra) push(v);
  return out;
}

export function catalogLanguages(versions: CatalogVersion[]): CatalogLanguage[] {
  const by = new Map<string, CatalogLanguage>();
  for (const v of versions) {
    const l = by.get(v.language) ?? {
      code: v.language,
      name: v.languageName,
      count: 0,
    };
    l.count++;
    by.set(v.language, l);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive match on abbreviation, name, language or publisher. */
export function matchesQuery(v: CatalogVersion, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${v.abbreviation} ${v.name} ${v.languageName} ${v.publisher ?? ''}`.toLowerCase().includes(q);
}

