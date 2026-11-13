import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FALLBACK_VERSIONS,
  languageMatches,
  loadCatalog,
  loadLanguages,
  searchCatalog,
  toLicensedTranslation,
  type CatalogResult,
  type CatalogSource,
  type CatalogStorage,
  type YouVersionLanguage,
  type YouVersionVersion,
} from '../content/youversionCatalog';
import { platformStorage } from './persistAdapter';
import { startLicensedDownload } from './useBibleDownloads';
import { useUiStore } from './useUiStore';

export type { YouVersionLanguage, YouVersionVersion } from '../content/youversionCatalog';

export interface UseYouVersionCatalogOptions {
  /** BCP 47 language range: `en`, `es`, `pt-BR`, or `*` for every language. Defaults to `en`. */
  language?: string;
  /** Free-text filter over abbreviation, titles and publisher. */
  query?: string;
  /** Locale for language names (defaults to the app locale). */
  displayLocale?: string;
  /** Only versions the proxy will serve (default true). */
  readableOnly?: boolean;
}

export interface YouVersionCatalogState {
  /** Versions for `language`, filtered by `query`, best match first. */
  versions: YouVersionVersion[];
  /** Every version loaded for `language`, unfiltered. */
  all: YouVersionVersion[];
  /** Languages that have Bibles on YouVersion, sorted by name. */
  languages: YouVersionLanguage[];
  status: 'loading' | 'ready';
  /** network: fresh from the proxy; cache: from this device; fallback: the built-in NASB pair. */
  source: CatalogSource;
  /** True when showing a cache past its lifetime or the fallback. */
  stale: boolean;
  error: string | null;
  fetchedAt: number | null;
  /** Re-fetch, ignoring a fresh cache. */
  refresh: () => void;
}

const storage: CatalogStorage = {
  getItem: (name) => platformStorage.getItem(name) as Promise<string | null>,
  setItem: (name, value) => platformStorage.setItem(name, value),
};

const initial: CatalogResult = { versions: [], source: 'fallback', fetchedAt: null, stale: true, error: null };

/**
 * The YouVersion catalog for the Translations UI. Loads the list for one
 * language (cached for a day on the device, offline-tolerant, falling back to
 * NASB 1995 and 2020), the language list, and filters by `query` locally.
 */
export function useYouVersionCatalog(options: UseYouVersionCatalogOptions = {}): YouVersionCatalogState {
  const appLocale = useUiStore((s) => s.locale);
  const language = options.language ?? 'en';
  const query = options.query ?? '';
  const displayLocale = options.displayLocale ?? appLocale ?? 'en';
  const readableOnly = options.readableOnly ?? true;

  const [result, setResult] = useState<CatalogResult>(initial);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [languages, setLanguages] = useState<YouVersionLanguage[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setStatus('loading');
    loadCatalog(language, { storage, signal: ctl.signal, force: nonce > 0 })
      .then((r) => {
        if (ctl.signal.aborted) return;
        setResult(r);
        setStatus('ready');
      })
      .catch(() => {
        if (ctl.signal.aborted) return;
        setResult({ versions: FALLBACK_VERSIONS.filter((v) => languageMatches(v.languageTag, language)), source: 'fallback', fetchedAt: null, stale: true, error: 'Bible list failed.' });
        setStatus('ready');
      });
    return () => ctl.abort();
  }, [language, nonce]);

  useEffect(() => {
    const ctl = new AbortController();
    loadLanguages(displayLocale, { storage, signal: ctl.signal, force: nonce > 0 })
      .then((l) => !ctl.signal.aborted && setLanguages(l))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [displayLocale, nonce]);

  const all = useMemo(() => {
    const list = readableOnly ? result.versions.filter((v) => v.capabilities.canRead) : result.versions;
    if (languages.length === 0) return list;
    const byTag = new Map(languages.map((l) => [l.tag, l.rtl]));
    return list.map((v) => {
      const rtl = byTag.get(v.languageTag) ?? byTag.get(v.languageTag.split('-')[0]);
      return rtl === undefined || rtl === v.rtl ? v : { ...v, rtl };
    });
  }, [result.versions, readableOnly, languages]);
  const versions = useMemo(() => searchCatalog(all, query), [all, query]);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    versions,
    all,
    languages,
    status,
    source: result.source,
    stale: result.stale,
    error: result.error,
    fetchedAt: result.fetchedAt,
    refresh,
  };
}

/** Open a stream-only (or not yet downloaded) version in the reader, online. */
export function readYouVersionOnline(v: YouVersionVersion): void {
  if (!v.capabilities.canRead) return;
  const ui = useUiStore.getState();
  ui.addStreamed({
    id: v.id,
    yvId: v.yvId,
    name: v.localizedTitle,
    shortName: v.localizedAbbreviation,
    languageTag: v.languageTag,
    rtl: v.rtl,
    publisher: v.publisher,
    publisherUrl: v.publisherUrl,
    notice: v.notice,
  });
  ui.setTranslation(v.id);
}

/** Start the paced, encrypted download, only for versions the publisher lets us keep. */
export function downloadYouVersion(v: YouVersionVersion): Promise<void> {
  if (!v.capabilities.canDownload) return Promise.resolve();
  return startLicensedDownload(toLicensedTranslation(v));
}
