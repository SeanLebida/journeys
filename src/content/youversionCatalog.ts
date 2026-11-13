import { BIBLE_PROXY_URL, LICENSED_TRANSLATIONS, type LicensedTranslation } from './youversion';

/**
 * The YouVersion catalog: every Bible the Journeys app key can see, fetched
 * through the Journeys Bible proxy (GET /v1/bibles, GET /v1/languages), cached
 * on the device, and falling back to the two NASB editions when the proxy or
 * the network is unavailable.
 *
 * What a reader may do with a version comes from the proxy's flags:
 * - `readable`: the proxy serves its chapters, so it can be read online.
 * - `offline`: Journeys has the publisher's permission to keep a copy.
 * Nothing in YouVersion's own API says whether a version may be stored, so
 * offline is an explicit allow list on the proxy (today NASB 1995 and 2020).
 */

export type YvId = `yv:${number}`;

export interface YouVersionCapabilities {
  /** The proxy serves this version's chapters. */
  canRead: boolean;
  /** May be downloaded, stored encrypted and read offline (publisher permission). */
  canDownload: boolean;
  /** Readable online only, chapter by chapter; nothing is stored beyond this session's memory. */
  streamOnly: boolean;
}

export interface YouVersionVersion {
  id: YvId;
  yvId: number;
  /** e.g. `NASB2020`. */
  abbreviation: string;
  /** English title, e.g. `New American Standard Bible 2020`. */
  title: string;
  /** Title in the Bible's own language when YouVersion has one, else the title. */
  localizedTitle: string;
  localizedAbbreviation: string;
  /** BCP 47 tag, e.g. `en`, `pt-BR`. */
  languageTag: string;
  /** Right-to-left script (Hebrew, Arabic, Persian, Urdu, ...). */
  rtl: boolean;
  publisher: string | null;
  publisherUrl: string | null;
  /** Copyright notice to show with the text (Lockman's for NASB). */
  notice: string | null;
  bookCount: number;
  hasOldTestament: boolean;
  hasNewTestament: boolean;
  deepLink: string | null;
  capabilities: YouVersionCapabilities;
}

export interface YouVersionLanguage {
  /** BCP 47 id, e.g. `en`, `sr-Latn`. */
  tag: string;
  /** Name in the app's UI language when known. */
  name: string;
  rtl: boolean;
  defaultYvId: number | null;
}

export type CatalogSource = 'network' | 'cache' | 'fallback';

export interface CatalogResult {
  versions: YouVersionVersion[];
  source: CatalogSource;
  /** When the list was fetched from the proxy (ms since epoch), if ever. */
  fetchedAt: number | null;
  /** The cached copy is older than the cache lifetime (shown while refreshing or offline). */
  stale: boolean;
  /** The last fetch error, when the result is from cache or fallback. */
  error: string | null;
}

export interface CatalogStorage {
  getItem(name: string): string | null | Promise<string | null>;
  setItem(name: string, value: string): unknown;
}

export interface CatalogOptions {
  base?: string;
  fetchImpl?: typeof fetch;
  storage?: CatalogStorage;
  now?: () => number;
  signal?: AbortSignal;
  /** Skip a fresh cache and go to the network. */
  force?: boolean;
}

export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'journeys-yv-catalog:v1:';
const LANG_CACHE_PREFIX = 'journeys-yv-languages:v1:';
const MAX_PAGES = 40;
const CLIENT_HEADERS = { 'X-Journeys-Client': 'journeys' } as const;
const LANGUAGE = /^(?:\*|[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3})$/;

// ---------------------------------------------------------------- parsing

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Fallback offline list when the proxy predates the `offline` flag. */
const KNOWN_OFFLINE = new Set(LICENSED_TRANSLATIONS.map((t) => t.yvId));

export function capabilitiesFor(readable: boolean, offline: boolean): YouVersionCapabilities {
  const canRead = readable;
  const canDownload = readable && offline;
  return { canRead, canDownload, streamOnly: canRead && !canDownload };
}

/** One item from the proxy's `/v1/bibles` (or YouVersion's raw shape), or null if unusable. */
export function parseCatalogItem(raw: unknown): YouVersionVersion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const yvId = typeof o.id === 'number' && Number.isInteger(o.id) && o.id > 0 ? o.id : null;
  const abbreviation = str(o.abbreviation);
  const title = str(o.title);
  const languageTag = str(o.language_tag);
  if (yvId === null || !abbreviation || !title || !languageTag) return null;
  const books = Array.isArray(o.books) ? o.books.filter((b): b is string => typeof b === 'string') : null;
  // Raw YouVersion items carry no Journeys flags: readable only if listed, offline only for known NASB.
  const readable = typeof o.readable === 'boolean' ? o.readable : false;
  const offline = typeof o.offline === 'boolean' ? o.offline : KNOWN_OFFLINE.has(yvId);
  return {
    id: `yv:${yvId}`,
    yvId,
    abbreviation,
    title,
    localizedTitle: stripLanguagePrefix(str(o.localized_title)) ?? title,
    localizedAbbreviation: str(o.localized_abbreviation) ?? abbreviation,
    languageTag,
    rtl: rtlFromApi(o, languageTag),
    publisher: str(o.publisher_name),
    publisherUrl: httpsOrNull(o.publisher_url),
    notice: str(o.copyright),
    bookCount: typeof o.book_count === 'number' ? o.book_count : (books?.length ?? 0),
    hasOldTestament: typeof o.has_old_testament === 'boolean' ? o.has_old_testament : !!books?.includes('GEN'),
    hasNewTestament: typeof o.has_new_testament === 'boolean' ? o.has_new_testament : !!books?.includes('MAT'),
    deepLink: httpsOrNull(o.youversion_deep_link),
    capabilities: capabilitiesFor(readable, offline),
  };
}

/** YouVersion's localized titles read "English: Berean Standard Bible"; the picker shows the language separately. */
function stripLanguagePrefix(title: string | null): string | null {
  if (!title) return null;
  const m = /^[^:]{1,40}:\s+(.+)$/.exec(title);
  return m ? m[1] : title;
}

function httpsOrNull(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    return new URL(s).protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

export interface CatalogPage {
  versions: YouVersionVersion[];
  nextPageToken: string | null;
  totalSize: number | null;
}

export function parseCatalogPage(body: unknown): CatalogPage {
  const o = (body ?? {}) as { data?: unknown; next_page_token?: unknown; total_size?: unknown };
  const list = Array.isArray(o.data) ? o.data : [];
  return {
    versions: list.map(parseCatalogItem).filter((v): v is YouVersionVersion => v !== null),
    nextPageToken: str(o.next_page_token),
    totalSize: typeof o.total_size === 'number' ? o.total_size : null,
  };
}

export function parseLanguagesPage(body: unknown, displayLocale = 'en'): { languages: YouVersionLanguage[]; nextPageToken: string | null } {
  const o = (body ?? {}) as { data?: unknown; next_page_token?: unknown };
  const list = Array.isArray(o.data) ? o.data : [];
  const languages: YouVersionLanguage[] = [];
  for (const raw of list as Record<string, unknown>[]) {
    const tag = str(raw?.id);
    if (!tag) continue;
    languages.push({
      tag,
      name: str(raw.localized_name) ?? languageName(tag, displayLocale),
      rtl: raw.text_direction === 'rtl',
      defaultYvId: typeof raw.default_bible_id === 'number' ? raw.default_bible_id : null,
    });
  }
  return { languages, nextPageToken: str(o.next_page_token) };
}

const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'hbo', 'ks', 'ku-Arab', 'pa-Arab', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi']);
const RTL_SCRIPTS = new Set(['Arab', 'Hebr', 'Syrc', 'Thaa', 'Nkoo', 'Adlm', 'Rohg']);

/** Prefer the proxy/API `rtl` or `text_direction` field; fall back to the language tag only when the API omits it. */
function rtlFromApi(raw: Record<string, unknown>, languageTag: string): boolean {
  if (typeof raw.rtl === 'boolean') return raw.rtl;
  if (raw.text_direction === 'rtl') return true;
  if (raw.text_direction === 'ltr') return false;
  return isRtlLanguage(languageTag);
}

export function isRtlLanguage(tag: string): boolean {
  const parts = tag.split('-');
  if (parts.some((p) => RTL_SCRIPTS.has(p))) return true;
  if (parts.some((p) => /^[A-Z][a-z]{3}$/.test(p))) return false; // explicit non-RTL script, e.g. sd-Deva
  return RTL_LANGUAGES.has(parts[0].toLowerCase());
}

/** A display name for a BCP 47 tag, via Intl when available. */
export function languageName(tag: string, displayLocale = 'en'): string {
  try {
    return new Intl.DisplayNames([displayLocale], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

// ---------------------------------------------------------------- fallback

/** The two NASB editions, as shipped before the catalog existed. */
export const FALLBACK_VERSIONS: readonly YouVersionVersion[] = LICENSED_TRANSLATIONS.map((t) => ({
  id: t.id as YvId,
  yvId: t.yvId,
  abbreviation: t.shortName,
  title: t.name,
  localizedTitle: t.name,
  localizedAbbreviation: t.shortName,
  languageTag: 'en',
  rtl: false,
  publisher: t.publisher,
  publisherUrl: t.publisherUrl,
  notice: null,
  bookCount: 66,
  hasOldTestament: true,
  hasNewTestament: true,
  deepLink: `https://www.bible.com/versions/${t.yvId}`,
  capabilities: capabilitiesFor(true, true),
}));

function fallbackFor(language: string): YouVersionVersion[] {
  return FALLBACK_VERSIONS.filter((v) => languageMatches(v.languageTag, language));
}

/** RFC 4647 basic filtering: `en` matches `en` and `en-US`; `*` matches all. */
export function languageMatches(tag: string, range: string): boolean {
  if (range === '*') return true;
  const t = tag.toLowerCase();
  const r = range.toLowerCase();
  return t === r || t.startsWith(`${r}-`);
}

// ---------------------------------------------------------------- network + cache

interface CachedCatalog {
  v: 1;
  fetchedAt: number;
  versions: YouVersionVersion[];
}

function defaultStorage(): CatalogStorage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

async function readCache(storage: CatalogStorage | undefined, key: string): Promise<CachedCatalog | null> {
  if (!storage) return null;
  try {
    const raw = await storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedCatalog>;
    if (parsed.v !== 1 || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.versions)) return null;
    // Re-derive capabilities so a cache written by an older build can't grant more than its flags say.
    const versions = parsed.versions.filter(
      (v): v is YouVersionVersion => !!v && typeof v.yvId === 'number' && typeof v.id === 'string' && !!v.capabilities,
    ).map((v) => ({ ...v, capabilities: capabilitiesFor(!!v.capabilities.canRead, !!v.capabilities.canDownload) }));
    return { v: 1, fetchedAt: parsed.fetchedAt, versions };
  } catch {
    return null;
  }
}

async function writeCache(storage: CatalogStorage | undefined, key: string, value: CachedCatalog): Promise<void> {
  try {
    await storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode: the catalog still works, just without a cache.
  }
}

async function getJson(url: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<unknown> {
  const res = await fetchImpl(url, { headers: CLIENT_HEADERS, signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'The Bible service is busy. Try again in a minute.' : `Bible list failed (${res.status}).`);
  return res.json();
}

/** Every page of `/v1/bibles` for one language range (`*` for all). */
export async function fetchCatalog(language: string, opts: CatalogOptions = {}): Promise<YouVersionVersion[]> {
  if (!LANGUAGE.test(language)) throw new Error(`Not a language tag: ${language}`);
  const base = opts.base ?? BIBLE_PROXY_URL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const out: YouVersionVersion[] = [];
  const seen = new Set<number>();
  let token: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams();
    q.append('language_ranges[]', language);
    q.set('page_size', '99');
    if (token) q.set('page_token', token);
    const parsed = parseCatalogPage(await getJson(`${base}/v1/bibles?${q}`, fetchImpl, opts.signal));
    for (const v of parsed.versions) {
      if (seen.has(v.yvId)) continue;
      seen.add(v.yvId);
      out.push(v);
    }
    token = parsed.nextPageToken;
    if (!token) break;
  }
  return out;
}

/**
 * The catalog for one language: a fresh cache if there is one, else the
 * network (cached on success), else a stale cache, else the NASB fallback.
 * Never throws for network trouble; check `source` and `error`.
 */
export async function loadCatalog(language: string, opts: CatalogOptions = {}): Promise<CatalogResult> {
  const storage = opts.storage ?? defaultStorage();
  const now = (opts.now ?? Date.now)();
  const key = CACHE_PREFIX + language.toLowerCase();
  const cached = await readCache(storage, key);
  if (cached && !opts.force && now - cached.fetchedAt < CATALOG_TTL_MS) {
    return { versions: cached.versions, source: 'cache', fetchedAt: cached.fetchedAt, stale: false, error: null };
  }
  try {
    const versions = await fetchCatalog(language, opts);
    await writeCache(storage, key, { v: 1, fetchedAt: now, versions });
    return { versions: withFallbackNasb(versions, language), source: 'network', fetchedAt: now, stale: false, error: null };
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    const error = (e as Error).message || 'Bible list failed.';
    if (cached) return { versions: cached.versions, source: 'cache', fetchedAt: cached.fetchedAt, stale: true, error };
    return { versions: fallbackFor(language), source: 'fallback', fetchedAt: null, stale: true, error };
  }
}

/**
 * A proxy that lists only readable versions will still include NASB; if a
 * response somehow lacks them (e.g. the key's list changed), keep the editions
 * readers may already rely on so downloads and the Lockman notice keep working.
 */
function withFallbackNasb(versions: YouVersionVersion[], language: string): YouVersionVersion[] {
  if (versions.length > 0) return versions;
  return fallbackFor(language);
}

/** Languages that have Bibles on YouVersion, cached like the catalog. */
export async function loadLanguages(displayLocale = 'en', opts: CatalogOptions = {}): Promise<YouVersionLanguage[]> {
  const storage = opts.storage ?? defaultStorage();
  const now = (opts.now ?? Date.now)();
  const key = LANG_CACHE_PREFIX + displayLocale.toLowerCase();
  let cached: { fetchedAt: number; languages: YouVersionLanguage[] } | null = null;
  try {
    const raw = storage ? await storage.getItem(key) : null;
    if (raw) cached = JSON.parse(raw) as { fetchedAt: number; languages: YouVersionLanguage[] };
  } catch {
    cached = null;
  }
  if (cached && Array.isArray(cached.languages) && !opts.force && now - cached.fetchedAt < CATALOG_TTL_MS) return cached.languages;
  const base = opts.base ?? BIBLE_PROXY_URL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const out: YouVersionLanguage[] = [];
    let token: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ page_size: '99' });
      if (token) q.set('page_token', token);
      const res = await fetchImpl(`${base}/v1/languages?${q}`, {
        headers: { ...CLIENT_HEADERS, 'Accept-Language': displayLocale },
        signal: opts.signal,
      });
      if (!res.ok) throw new Error(`Language list failed (${res.status}).`);
      const parsed = parseLanguagesPage(await res.json(), displayLocale);
      out.push(...parsed.languages);
      token = parsed.nextPageToken;
      if (!token) break;
    }
    out.sort((a, b) => a.name.localeCompare(b.name, displayLocale));
    try {
      await storage?.setItem(key, JSON.stringify({ fetchedAt: now, languages: out }));
    } catch {
      // No cache is fine.
    }
    return out;
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    if (cached && Array.isArray(cached.languages)) return cached.languages;
    return [{ tag: 'en', name: languageName('en', displayLocale), rtl: false, defaultYvId: null }];
  }
}

// ---------------------------------------------------------------- search + helpers

function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Filter by a free-text query over abbreviation, titles and publisher. Exact
 * abbreviation matches rank first, then prefix matches, then the rest, each
 * group in title order.
 */
export function searchCatalog(versions: readonly YouVersionVersion[], query: string): YouVersionVersion[] {
  const q = fold(query.trim());
  const sorted = [...versions].sort((a, b) => a.localizedTitle.localeCompare(b.localizedTitle));
  if (!q) return sorted;
  const scored: { v: YouVersionVersion; rank: number }[] = [];
  for (const v of sorted) {
    const abbr = fold(v.abbreviation);
    const labbr = fold(v.localizedAbbreviation);
    const hay = fold(`${v.abbreviation} ${v.localizedAbbreviation} ${v.title} ${v.localizedTitle} ${v.publisher ?? ''}`);
    if (!hay.includes(q)) continue;
    const rank = abbr === q || labbr === q ? 0 : abbr.startsWith(q) || labbr.startsWith(q) ? 1 : 2;
    scored.push({ v, rank });
  }
  return scored.sort((a, b) => a.rank - b.rank).map((s) => s.v);
}

export function parseYvId(id: string): number | null {
  const m = /^yv:(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** The shape the download pipeline (useBibleDownloads / downloadLicensed) takes. */
export function toLicensedTranslation(v: YouVersionVersion): LicensedTranslation {
  return {
    id: v.id,
    yvId: v.yvId,
    name: v.localizedTitle,
    shortName: v.localizedAbbreviation,
    publisher: v.publisher ?? 'the publisher',
    publisherUrl: v.publisherUrl ?? v.deepLink ?? 'https://www.bible.com',
    language: v.languageTag,
    rtl: v.rtl,
  };
}
