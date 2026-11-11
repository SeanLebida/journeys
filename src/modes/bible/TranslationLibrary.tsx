import { useEffect, useMemo, useState } from 'react';
import { fetchCatalog, type DownloadableTranslation } from '../../content/catalog';
import { downloadTranslation, type DownloadProgress } from '../../content/downloads';
import { closeDownloadedDb } from '../../content/useBible';
import { TRANSLATIONS, type TranslationId } from '../../content/translations';
import { deleteBibleBytes } from '../../platform/bibleStore';
import { useUiStore } from '../../state/useUiStore';

const PAGE = 40;
const FULL_BIBLE_VERSES = 30_000;

type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: DownloadableTranslation[] };

function mb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function coverage(verses: number): string {
  if (verses >= FULL_BIBLE_VERSES) return 'Full Bible';
  if (verses >= 7_900 && verses < 8_100) return 'New Testament';
  return 'Partial';
}

/**
 * The translation library: what's on this device, and free-to-use translations
 * a reader can download for offline reading. Only texts whose license allows
 * commercial use are listed (see content/catalog.ts).
 */
export function TranslationLibrary({ onRead }: { onRead: (id: TranslationId) => void }) {
  const downloaded = useUiStore((s) => s.downloaded);
  const addDownloaded = useUiStore((s) => s.addDownloaded);
  const removeDownloaded = useUiStore((s) => s.removeDownloaded);

  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('eng');
  const [busy, setBusy] = useState<Record<string, DownloadProgress | undefined>>({});
  const [failed, setFailed] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const ctrl = new AbortController();
    setCatalog({ status: 'loading' });
    fetchCatalog(ctrl.signal)
      .then((items) => setCatalog({ status: 'ready', items }))
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return;
        setCatalog({
          status: 'error',
          message: navigator.onLine === false ? 'Connect to the internet to see more translations.' : e.message,
        });
      });
    return () => ctrl.abort();
  }, [attempt]);

  const languages = useMemo(() => {
    if (catalog.status !== 'ready') return [];
    const seen = new Map<string, string>();
    for (const t of catalog.items) if (!seen.has(t.language)) seen.set(t.language, t.languageName);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [catalog]);

  const installed = useMemo(() => new Set(downloaded.map((d) => d.id)), [downloaded]);

  const matches = useMemo(() => {
    if (catalog.status !== 'ready') return [];
    const q = query.trim().toLowerCase();
    return catalog.items.filter(
      (t) =>
        !installed.has(t.id) &&
        (q ? `${t.name} ${t.shortName} ${t.languageName}`.toLowerCase().includes(q) : t.language === language),
    );
  }, [catalog, query, language, installed]);

  async function download(t: DownloadableTranslation) {
    setFailed((f) => ({ ...f, [t.id]: undefined }));
    setBusy((b) => ({ ...b, [t.id]: { phase: 'downloading', receivedBytes: 0 } }));
    try {
      const done = await downloadTranslation(t, (p) => setBusy((b) => ({ ...b, [t.id]: p })));
      addDownloaded(done);
    } catch (e) {
      setFailed((f) => ({ ...f, [t.id]: (e as Error).message || 'Download failed.' }));
    } finally {
      setBusy((b) => ({ ...b, [t.id]: undefined }));
    }
  }

  async function remove(id: TranslationId) {
    removeDownloaded(id);
    await closeDownloadedDb(id);
    await deleteBibleBytes(id).catch(() => undefined);
  }

  return (
    <section className="bible__library" aria-labelledby="bible-library-title">
      <h2 id="bible-library-title" className="bible__library-heading">On this device</h2>
      <ul className="bible__library-list">
        {TRANSLATIONS.map((t) => (
          <li key={t.id} className="bible__library-item">
            <div>
              <strong>{t.name}</strong> <span className="bible__translation-tag">({t.id})</span>
              <p className="bible__library-meta">Built in · Public domain</p>
            </div>
            <button type="button" className="bible__library-btn" onClick={() => onRead(t.id)}>
              Read
            </button>
          </li>
        ))}
        {downloaded.map((d) => (
          <li key={d.id} className="bible__library-item">
            <div>
              <strong>{d.name}</strong> <span className="bible__translation-tag">({d.shortName})</span>
              <p className="bible__library-meta">
                Downloaded · {d.languageName} · {mb(d.sizeBytes)} ·{' '}
                {d.licenseUrl ? <a href={d.licenseUrl} target="_blank" rel="noreferrer">{d.licenseLabel}</a> : d.licenseLabel}
              </p>
            </div>
            <span className="bible__library-actions">
              <button type="button" className="bible__library-btn" onClick={() => onRead(d.id)}>
                Read
              </button>
              <button
                type="button"
                className="bible__library-btn bible__library-btn--quiet"
                aria-label={`Remove ${d.name}`}
                onClick={() => void remove(d.id)}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="bible__library-heading">Download more</h2>
      <p className="bible__library-meta">
        Free-to-use translations from AO Lab&apos;s Free Use Bible API. Each one downloads once and then
        reads offline. Copyrighted translations such as the NASB, ESV and NIV need a publisher license and
        aren&apos;t listed.
      </p>

      {catalog.status === 'loading' && <p className="mode-panel--loading">Loading translations…</p>}
      {catalog.status === 'error' && (
        <p role="alert" className="bible__library-error">
          {catalog.message}{' '}
          <button type="button" className="backlink" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}
      {catalog.status === 'ready' && (
        <>
          <div className="bible__library-filters">
            <label className="bible__translation">
              Language
              <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={query.trim() !== ''}>
                {languages.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="bible__translation bible__library-search">
              Search
              <input
                type="search"
                className="bible__search-input"
                value={query}
                placeholder="Name or language"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          {matches.length === 0 && <p className="bible__library-meta">No translations match.</p>}
          <ul className="bible__library-list" aria-label="Translations to download">
            {matches.slice(0, PAGE).map((t) => {
              const progress = busy[t.id];
              return (
                <li key={t.id} className="bible__library-item">
                  <div>
                    <strong>{t.name}</strong> <span className="bible__translation-tag">({t.shortName})</span>
                    <p className="bible__library-meta">
                      {t.languageName} · {coverage(t.verses)} ·{' '}
                      {t.licenseUrl ? <a href={t.licenseUrl} target="_blank" rel="noreferrer">{t.licenseLabel}</a> : t.licenseLabel}
                    </p>
                    {failed[t.id] && <p role="alert" className="bible__library-error">{failed[t.id]}</p>}
                  </div>
                  <button
                    type="button"
                    className="bible__library-btn"
                    disabled={Boolean(progress)}
                    aria-label={progress ? `Downloading ${t.name}` : `Download ${t.name}`}
                    onClick={() => void download(t)}
                  >
                    {!progress
                      ? 'Download'
                      : progress.phase === 'installing'
                        ? 'Installing…'
                        : `${mb(progress.receivedBytes)}…`}
                  </button>
                </li>
              );
            })}
          </ul>
          {matches.length > PAGE && (
            <p className="bible__library-meta">
              Showing {PAGE} of {matches.length}. Search to narrow the list.
            </p>
          )}
        </>
      )}
    </section>
  );
}
