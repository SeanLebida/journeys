import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { App } from '@capacitor/app';
import { matchesQuery, type BibleCatalog, type CatalogVersion } from '../../content/bibleCatalog';
import { useBibleCatalog } from '../../content/useBibleCatalog';
import { licensedDownloadNote } from '../../content/licensedNote';
import type { TranslationId } from '../../content/translations';
import { isNative } from '../../platform/bridge';
import { useUiStore } from '../../state/useUiStore';
import '../../styles/version-picker.css';

const PAGE = 60;

const SOURCE_LABEL: Record<CatalogVersion['source'], string> = {
  builtin: 'Built into Journeys',
  helloao: "AO Lab's Free Use Bible API",
  youversion: 'YouVersion, used by permission',
};

const COVERAGE_LABEL = {
  full: 'Full Bible',
  nt: 'New Testament',
  partial: 'Partial',
} as const;

function progressLabel(v: CatalogVersion): string | null {
  const p = v.progress;
  if (!p) return null;
  if (p.phase === 'installing') return 'Installing…';
  if (p.phase === 'downloading') return `Downloading ${(p.receivedBytes / 1_048_576).toFixed(1)} MB…`;
  if (p.total > 0) {
    const waiting = p.waitingUntil && p.waitingUntil > Date.now() ? ' · paused, carries on by itself' : '';
    return `${p.done.toLocaleString()} of ${p.total.toLocaleString()} chapters${waiting}`;
  }
  return 'Starting…';
}

/** One short line under the name: where it stands for this reader. */
function rowMeta(v: CatalogVersion): string {
  const progress = progressLabel(v);
  if (progress) return progress;
  if (v.source === 'builtin') return `Built in · ${v.license}`;
  if (v.installed) return 'On this device';
  const who = v.publisher ?? v.license;
  return v.coverage && v.coverage !== 'full' ? `${who} · ${COVERAGE_LABEL[v.coverage]}` : who;
}

/**
 * The Bible header's version chip and the version sheet it opens: search, a
 * language filter, recently used, and one list across built-in, free and
 * licensed versions. A row's details open in the same sheet, so focus, Escape
 * and Android back all have one place to go.
 */
export function VersionPicker({ current, label, name, onRead }: { current: TranslationId; label: string; name: string; onRead: (id: TranslationId) => void }) {
  const [open, setOpen] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Back to the chip once the sheet has unmounted (focusing earlier is lost with the dialog).
  useEffect(() => {
    if (!open && wasOpen.current) chip.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div className="bible__translation">
      <span aria-hidden="true">Translation</span>
      <button
        ref={chip}
        type="button"
        className="vp-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Translation: ${name}. Change version`}
        onClick={() => setOpen(true)}
      >
        <span className="vp-chip__abbr">{label}</span>
        <span className="vp-chip__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <VersionSheet
            current={current}
            onClose={close}
            onRead={(id) => {
              onRead(id);
              close();
            }}
          />,
          document.body
        )}
    </div>
  );
}

function VersionSheet({ current, onClose, onRead }: { current: TranslationId; onClose: () => void; onRead: (id: TranslationId) => void }) {
  const catalog = useBibleCatalog();
  const recent = useUiStore((s) => s.recentTranslations);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');
  const currentVersion = catalog.versions.find((v) => v.id === current);
  const [language, setLanguage] = useState(currentVersion?.language ?? 'eng');
  const [detailId, setDetailId] = useState<string | null>(null);
  const returnFocus = useRef<string | null>(null);
  const detail = detailId ? catalog.versions.find((v) => v.id === detailId) : undefined;

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  // Escape and Android back both step back one level: details → list → closed.
  const back = useRef(() => {});
  back.current = () => {
    if (detailId) {
      returnFocus.current = detailId;
      setDetailId(null);
    } else onClose();
  };
  useEffect(() => {
    if (!isNative()) return;
    const handle = App.addListener('backButton', () => back.current());
    return () => void handle.then((h) => h.remove());
  }, []);

  // Put focus where the reader was: the row they came from, or the details' Back button.
  useEffect(() => {
    if (detailId) {
      dialog.current?.querySelector<HTMLElement>('.vp__back')?.focus();
    } else if (returnFocus.current) {
      const id = returnFocus.current;
      returnFocus.current = null;
      dialog.current?.querySelector<HTMLElement>(`[data-version="${CSS.escape(id)}"]`)?.focus();
    }
  }, [detailId]);

  return (
    <dialog
      ref={dialog}
      className="vp"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        back.current();
      }}
      onClick={(e) => {
        // A tap on the backdrop (the dialog box itself, outside the panel) closes.
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="vp__panel">
        {detail ? (
          <VersionDetail
            version={detail}
            current={current}
            titleId={titleId}
            catalog={catalog}
            onBack={() => back.current()}
            onClose={onClose}
            onRead={onRead}
          />
        ) : (
          <VersionList
            catalog={catalog}
            current={current}
            recent={recent}
            titleId={titleId}
            query={query}
            setQuery={setQuery}
            language={language}
            setLanguage={setLanguage}
            onClose={onClose}
            onPick={(v) => (v.installed ? onRead(v.id as TranslationId) : setDetailId(v.id))}
            onInfo={(v) => setDetailId(v.id)}
          />
        )}
      </div>
    </dialog>
  );
}

function VersionList({
  catalog,
  current,
  recent,
  titleId,
  query,
  setQuery,
  language,
  setLanguage,
  onClose,
  onPick,
  onInfo,
}: {
  catalog: BibleCatalog;
  current: TranslationId;
  recent: TranslationId[];
  titleId: string;
  query: string;
  setQuery: (q: string) => void;
  language: string;
  setLanguage: (l: string) => void;
  onClose: () => void;
  onPick: (v: CatalogVersion) => void;
  onInfo: (v: CatalogVersion) => void;
}) {
  const searching = query.trim() !== '';
  const byId = useMemo(() => new Map(catalog.versions.map((v) => [v.id, v])), [catalog.versions]);
  const recentRows = recent
    .map((id) => byId.get(id))
    .filter((v): v is CatalogVersion => Boolean(v))
    .slice(0, 3);
  const onDevice = catalog.versions.filter((v) => v.installed || v.progress);
  const more = catalog.versions.filter((v) => (searching ? matchesQuery(v, query) : !v.installed && !v.progress && v.language === language));
  const languageName = catalog.languages.find((l) => l.code === language)?.name ?? 'this language';

  return (
    <>
      <header className="vp__head">
        <h2 id={titleId} className="vp__title">
          Bible versions
        </h2>
        <button type="button" className="vp__icon-btn" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="vp__controls">
        <label className="vp__field vp__field--grow">
          <span className="vp__field-label">Search</span>
          <input type="search" className="vp__input" value={query} placeholder="Name, abbreviation or language" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="vp__field">
          <span className="vp__field-label">Language</span>
          <select className="vp__input" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={searching}>
            {catalog.languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.count})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="vp__scroll">
        {!searching && recentRows.length > 0 && <Section title="Recently used" rows={recentRows} current={current} onPick={onPick} onInfo={onInfo} />}
        {!searching && <Section title="On this device" rows={onDevice} current={current} onPick={onPick} onInfo={onInfo} />}
        <Section
          title={searching ? `Results (${more.length})` : `More in ${languageName}`}
          rows={more.slice(0, PAGE)}
          current={current}
          onPick={onPick}
          onInfo={onInfo}
          empty={catalog.status === 'loading' ? 'Loading versions…' : searching ? 'No versions match.' : 'Everything in this language is on your device.'}
        />
        {more.length > PAGE && (
          <p className="vp__hint">
            Showing {PAGE} of {more.length}. Search to narrow the list.
          </p>
        )}
        {catalog.status === 'error' && (
          <p role="alert" className="vp__hint">
            {catalog.error}{' '}
            <button type="button" className="vp__text-btn" onClick={catalog.retry}>
              Try again
            </button>
          </p>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  rows,
  current,
  onPick,
  onInfo,
  empty,
}: {
  title: string;
  rows: CatalogVersion[];
  current: TranslationId;
  onPick: (v: CatalogVersion) => void;
  onInfo: (v: CatalogVersion) => void;
  empty?: string;
}) {
  const id = useId();
  if (rows.length === 0 && !empty) return null;
  return (
    <section className="vp__section" aria-labelledby={id}>
      <h3 id={id} className="vp__section-title">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="vp__hint">{empty}</p>
      ) : (
        <ul className="vp__list">
          {rows.map((v) => {
            const isCurrent = v.id === current;
            return (
              <li key={v.id} className={`vp-row${isCurrent ? ' vp-row--current' : ''}`}>
                <button
                  type="button"
                  className="vp-row__main"
                  data-version={v.id}
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-label={`${v.name} (${v.abbreviation}). ${rowMeta(v)}${v.access === 'online' ? '. Online only' : ''}${isCurrent ? '. Reading now' : ''}`}
                  onClick={() => onPick(v)}
                >
                  <span className="vp-badge" aria-hidden="true">
                    {v.abbreviation}
                  </span>
                  <span className="vp-row__text" aria-hidden="true">
                    <span className="vp-row__name" dir="auto">
                      {v.name}
                    </span>
                    <span className="vp-row__meta">
                      {v.access === 'online' && <span className="vp-tag">Online only</span>}
                      {rowMeta(v)}
                    </span>
                    {v.progress?.phase === 'chapters' && v.progress.total > 0 && (
                      <progress className="vp-row__progress" max={v.progress.total} value={v.progress.done} />
                    )}
                  </span>
                  {isCurrent && (
                    <span className="vp-row__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
                <button type="button" className="vp__icon-btn vp-row__info" aria-label={`About ${v.name}`} onClick={() => onInfo(v)}>
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function VersionDetail({
  version: v,
  current,
  titleId,
  catalog,
  onBack,
  onClose,
  onRead,
}: {
  version: CatalogVersion;
  current: TranslationId;
  titleId: string;
  catalog: BibleCatalog;
  onBack: () => void;
  onClose: () => void;
  onRead: (id: TranslationId) => void;
}) {
  const progress = progressLabel(v);
  const facts = [v.languageName, v.coverage ? COVERAGE_LABEL[v.coverage] : null].filter(Boolean).join(' · ');
  return (
    <>
      <header className="vp__head">
        <button type="button" className="vp__back" onClick={onBack}>
          <span aria-hidden="true">←</span> Versions
        </button>
        <button type="button" className="vp__icon-btn" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="vp__scroll vp-detail">
        <span className="vp-badge vp-badge--lg">{v.abbreviation}</span>
        <h2 id={titleId} className="vp-detail__title" dir="auto">
          {v.name}
        </h2>
        <p className="vp-detail__facts">
          {facts}
          {v.access === 'online' && <span className="vp-tag">Online only</span>}
        </p>
        <dl className="vp-detail__dl">
          {v.publisher && (
            <>
              <dt>Publisher</dt>
              <dd>
                {v.publisherUrl ? (
                  <a href={v.publisherUrl} target="_blank" rel="noreferrer">
                    {v.publisher}
                  </a>
                ) : (
                  v.publisher
                )}
              </dd>
            </>
          )}
          <dt>License</dt>
          <dd>
            {v.licenseUrl ? (
              <a href={v.licenseUrl} target="_blank" rel="noreferrer">
                {v.license}
              </a>
            ) : (
              v.license
            )}
          </dd>
          <dt>Source</dt>
          <dd>{SOURCE_LABEL[v.source]}</dd>
        </dl>
        {v.copyright && <p className="vp-detail__copyright">{v.copyright}</p>}
        {v.access === 'online' && <p className="vp-note">This version is licensed for reading online only, so it can&apos;t be downloaded.</p>}
        {v.source === 'youversion' && v.access === 'download' && !v.installed && <p className="vp-note">{licensedDownloadNote()}</p>}
        {progress && (
          <div className="vp-detail__progress">
            {v.progress?.phase === 'chapters' && v.progress.total > 0 && (
              <progress className="vp-row__progress" max={v.progress.total} value={v.progress.done} aria-label={`${v.name} download progress`} />
            )}
            <p className="vp__hint" aria-live="polite">
              {progress}
            </p>
          </div>
        )}
        {v.error && (
          <p role="alert" className="vp__error">
            {v.error}
          </p>
        )}
        <div className="vp-detail__actions">
          {v.installed && (
            <button type="button" className="vp-btn vp-btn--primary" onClick={() => onRead(v.id as TranslationId)}>
              {v.id === current ? 'Keep reading' : 'Read'}
            </button>
          )}
          {!v.installed && v.access === 'download' && !v.progress && (
            <button type="button" className="vp-btn vp-btn--primary" onClick={() => catalog.download(v.id)}>
              Download
            </button>
          )}
          {v.progress && v.progress.phase !== 'installing' && (
            <button type="button" className="vp-btn" onClick={() => catalog.cancel(v.id)}>
              Cancel download
            </button>
          )}
          {v.access === 'online' && (
            // Placeholder until the online reader exists (data side owns it).
            <button type="button" className="vp-btn vp-btn--primary" disabled aria-describedby={`${titleId}-soon`}>
              Read online
            </button>
          )}
          {v.installed && v.source !== 'builtin' && (
            <button type="button" className="vp-btn" onClick={() => void catalog.remove(v.id)}>
              Remove from device
            </button>
          )}
        </div>
        {v.access === 'online' && (
          <p id={`${titleId}-soon`} className="vp__hint">
            Reading online is coming in a later update.
          </p>
        )}
      </div>
    </>
  );
}
