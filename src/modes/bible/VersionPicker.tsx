import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { App } from '@capacitor/app';
import { fetchCatalog, type DownloadableTranslation } from '../../content/catalog';
import { licensedDownloadNote } from '../../content/licensedNote';
import { closeDownloadedDb } from '../../content/useBible';
import type { TranslationId } from '../../content/translations';
import { deleteBibleBytes } from '../../platform/bibleStore';
import { isNative } from '../../platform/bridge';
import { cancelDownload, startFreeDownload, useBibleDownloads } from '../../state/useBibleDownloads';
import { useUiStore } from '../../state/useUiStore';
import { downloadYouVersion, readYouVersionOnline, useYouVersionCatalog } from '../../state/useYouVersionCatalog';
import { useVersionNotice } from './useVersionNotice';
import { builtinRows, catalogMatchesLanguage, downloadedRow, exactLanguageName, helloAoRow, languageOptions, matchingLanguages, orderedDeviceRows, rowMatches, readableFirst, streamedRow, youVersionRow, type LanguageOption, type VersionRow } from './versionRows';
import '../../styles/version-picker.css';

const PAGE = 60;
const LANGUAGE_PAGE = 100;
/** Built-ins are collapsed to this many rows so the online list reaches the first phone screen. */
const DEVICE_PREVIEW = 2;
const LANGUAGE_BUTTON = '\u0000language';

const SOURCE_LABEL: Record<VersionRow['source'], string> = {
  builtin: 'Built into Journeys',
  helloao: "AO Lab's Free Use Bible API",
  youversion: 'YouVersion, used by permission',
};

/** `Downloading… 42%`; a free download has no known size, so it shows no percentage. */
function progressLabel(r: VersionRow): string | null {
  const p = r.progress;
  if (!p) return null;
  if (p.phase === 'installing') return 'Downloading… 100%';
  if (p.phase === 'downloading') return 'Downloading…';
  return `Downloading… ${p.total > 0 ? Math.floor((p.done / p.total) * 100) : 0}%`;
}

const ALL_LANGUAGES = '*';
const NO_MATCH = 'No versions match. Try another name or language.';

/** One short line under the name. Reading online is the normal case, so it says least. */
function rowMeta(r: VersionRow, offline: boolean): string {
  const progress = progressLabel(r);
  if (progress) return progress;
  if (r.source === 'builtin') return `Built in · ${r.license}`;
  if (r.state === 'device') return 'On this device';
  if (r.state === 'download') return r.license ?? '';
  if (r.state === 'unavailable') return r.publisher ?? '';
  const who = r.publisher ?? '';
  return offline ? [who, 'Needs a connection'].filter(Boolean).join(' · ') : who;
}

/** Row badges, in reading order: how you get it, then what it covers. */
function badges(r: VersionRow): string[] {
  const out: string[] = [];
  if (r.state === 'unavailable') out.push('Not available yet');
  else if (!r.progress && (r.state === 'download' || (r.state === 'online' && r.canDownload))) out.push('Download');
  else if (r.state === 'online') out.push('Read online');
  if (r.coverage === 'New Testament') out.push('New Testament only');
  return out;
}

// HelloAO's list is ~1 MB; fetch it once per session.
let helloaoPromise: Promise<DownloadableTranslation[]> | null = null;

/** Language hits in the version search, excluding the language already in use. */
function searchingLanguages(options: LanguageOption[], query: string, current: string): LanguageOption[] {
  if (!query.trim()) return [];
  return matchingLanguages(options, query).filter((o) => o.key !== current && o.key !== ALL_LANGUAGES).slice(0, 7);
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
  const downloaded = useUiStore((s) => s.downloaded);
  const streamed = useUiStore((s) => s.streamed);
  const recent = useUiStore((s) => s.recentTranslations);
  const active = useBibleDownloads((s) => s.active);
  const failed = useBibleDownloads((s) => s.failed);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');
  const currentStreamed = streamed.find((s) => s.id === current);
  const [language, setLanguage] = useState(currentStreamed?.languageTag ?? 'en');
  // Languages from the previous render: a search can match a name on the same keystroke.
  const langsRef = useRef<LanguageOption[]>([]);
  const exactLang = exactLanguageName(langsRef.current, query);
  const activeLanguage = exactLang?.key ?? language;
  const yv = useYouVersionCatalog({ language: activeLanguage, query: exactLang ? '' : query, readableOnly: false });
  const [hao, setHao] = useState<{ items: DownloadableTranslation[]; error: string | null }>({ items: [], error: null });
  const [haoAttempt, setHaoAttempt] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [choosingLanguage, setChoosingLanguage] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [deviceExpanded, setDeviceExpanded] = useState(false);
  const recentLanguages = useUiStore((s) => s.recentLanguages);
  const chooseLanguage = (tag: string) => {
    setLanguage(tag);
    setLimit(PAGE);
    useUiStore.getState().addRecentLanguage(tag);
    returnFocus.current = LANGUAGE_BUTTON;
    setChoosingLanguage(false);
  };
  const returnFocus = useRef<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine !== false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    let live = true;
    helloaoPromise ??= fetchCatalog();
    helloaoPromise
      .then((items) => live && setHao({ items, error: null }))
      .catch((e: Error) => {
        helloaoPromise = null;
        if (live) setHao({ items: [], error: e.message });
      });
    return () => {
      live = false;
    };
  }, [haoAttempt]);

  const { options: languages, haoKey } = useMemo(() => languageOptions(yv.languages, hao.items), [yv.languages, hao.items]);
  langsRef.current = languages;
  const languageHits = searchingLanguages(languages, query, activeLanguage);
  const languageName = activeLanguage === ALL_LANGUAGES ? 'All languages' : (languages.find((l) => l.key === activeLanguage)?.name ?? activeLanguage);

  useEffect(() => {
    const hit = exactLanguageName(languages, query);
    if (!hit || hit.key === language) return;
    setLanguage(hit.key);
    setLimit(PAGE);
    useUiStore.getState().addRecentLanguage(hit.key);
  }, [languages, query, language]);

  const withStatus = (r: VersionRow): VersionRow => ({ ...r, progress: active[r.id]?.progress, error: failed[r.id] });
  const onDevice = useMemo(() => {
    const rows = [...builtinRows(), ...downloaded.map(downloadedRow)];
    const ids = new Set(rows.map((r) => r.id));
    // Downloads in progress sit with what's on this device.
    for (const id of Object.keys(active)) {
      if (!active[id] || ids.has(id)) continue;
      const v = yv.all.find((x) => x.id === id);
      const t = hao.items.find((x) => x.id === id);
      if (v) rows.push(youVersionRow(v, languageName));
      else if (t) rows.push(helloAoRow(t, haoKey(t)));
    }
    return rows.map(withStatus);
  }, [downloaded, active, failed, yv.all, hao.items]);
  const deviceIds = new Set(onDevice.map((r) => r.id));
  const byId = new Map<string, VersionRow>([...streamed.map(streamedRow), ...onDevice].map((r) => [r.id, r]));
  const recentRows = recent.map((id) => byId.get(id)).filter((r): r is VersionRow => Boolean(r)).slice(0, 3);
  const listStale = yv.status === 'loading' && yv.versions.length > 0 && !catalogMatchesLanguage(yv.versions, activeLanguage);
  const youVersion = listStale
    ? []
    : readableFirst(yv.versions.filter((v) => !deviceIds.has(v.id)).map((v) => withStatus(youVersionRow(v, languageName))));
  const catalogLoading = yv.status === 'loading' && (listStale || youVersion.length === 0);
  const free = hao.items.filter((t) => !deviceIds.has(t.id) && (activeLanguage === ALL_LANGUAGES || haoKey(t) === activeLanguage)).map((t) => withStatus(helloAoRow(t, activeLanguage))).filter((r) => rowMatches(r, exactLang ? '' : query));
  const searching = query.trim() !== '';
  const deviceOrdered = orderedDeviceRows(searching ? onDevice.filter((r) => rowMatches(r, query)) : onDevice, current, recent);
  const deviceShown = searching || deviceExpanded || deviceOrdered.length <= DEVICE_PREVIEW ? deviceOrdered : deviceOrdered.slice(0, DEVICE_PREVIEW);
  const all = [...onDevice, ...youVersion, ...free, ...streamed.map(streamedRow)];
  const detail = detailId ? all.find((r) => r.id === detailId) : undefined;

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
    } else if (choosingLanguage) {
      returnFocus.current = LANGUAGE_BUTTON;
      setChoosingLanguage(false);
    } else onClose();
  };
  useEffect(() => {
    if (!isNative()) return;
    const handle = App.addListener('backButton', () => back.current());
    return () => void handle.then((h) => h.remove());
  }, []);

  // Put focus where the reader was: the row they came from, or the details' Back button.
  useEffect(() => {
    if (choosingLanguage) {
      dialog.current?.querySelector<HTMLElement>('.vp-lang__search')?.focus();
    } else if (detailId) {
      dialog.current?.querySelector<HTMLElement>('.vp__back')?.focus();
    } else if (returnFocus.current) {
      const id = returnFocus.current;
      returnFocus.current = null;
      const selector = id === LANGUAGE_BUTTON ? '.vp-lang-btn' : `[data-version="${CSS.escape(id)}"]`;
      dialog.current?.querySelector<HTMLElement>(selector)?.focus();
    }
  }, [detailId, choosingLanguage]);

  const read = (r: VersionRow) => {
    if (r.state === 'online' && r.yv) readYouVersionOnline(r.yv);
    onRead(r.id as TranslationId);
  };
  const pick = (r: VersionRow) => ((r.state === 'download' && !r.progress) || r.state === 'unavailable' ? setDetailId(r.id) : read(r));
  const actions: Actions = {
    read,
    download: (r) => {
      if (r.yv) void downloadYouVersion(r.yv);
      else if (r.hao) void startFreeDownload(r.hao);
    },
    cancel: (r) => cancelDownload(r.id),
    remove: async (r) => {
      useUiStore.getState().removeDownloaded(r.id as TranslationId);
      await closeDownloadedDb(r.id as TranslationId);
      await deleteBibleBytes(r.id).catch(() => undefined);
    },
  };

  let banner: ReactNode = null;
  if (!online) banner = <p className="vp-banner" role="status">You&apos;re offline. Your downloaded versions are still here.</p>;
  else if (yv.source === 'fallback' && yv.status === 'ready')
    banner = (
      <p className="vp-banner" role="status">
        Couldn&apos;t load the full YouVersion list, so only a few versions show.{' '}
        <button type="button" className="vp__text-btn" onClick={yv.refresh}>Try again</button>
      </p>
    );
  else if (yv.stale && yv.source === 'cache')
    banner = (
      <p className="vp-banner" role="status">
        Showing the list saved on this device{yv.fetchedAt ? ` (${new Date(yv.fetchedAt).toLocaleDateString()})` : ''}.{' '}
        <button type="button" className="vp__text-btn" onClick={yv.refresh}>Refresh</button>
      </p>
    );

  return (
    <dialog
      ref={dialog}
      className="vp"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        // Handle Escape here rather than in `cancel`: Chrome stops letting a
        // dialog cancel `cancel` twice without a click in between.
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        back.current();
      }}
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
        {choosingLanguage && !detail ? (
          <LanguageList
            options={languages}
            current={language}
            recent={recentLanguages}
            deviceTag={typeof navigator !== 'undefined' ? navigator.language : 'en'}
            onPick={chooseLanguage}
            onBack={() => back.current()}
            onClose={onClose}
          />
        ) : detail ? (
          <VersionDetail row={detail} titleId={titleId} offline={!online} actions={actions} onBack={() => back.current()} onClose={onClose} />
        ) : (
          <>
            <header className="vp__head">
              <h2 id={titleId} className="vp__title">Bible versions</h2>
              <button type="button" className="vp__icon-btn" aria-label="Close" onClick={onClose}>
                ✕
              </button>
            </header>
            <div className="vp__controls">
              <label className="vp__field vp__field--grow">
                <span className="vp__field-label">Search</span>
                <input type="search" className="vp__input" value={query} placeholder="Search versions or languages" onChange={(e) => setQuery(e.target.value)} />
              </label>
              <div className="vp__field">
                <span className="vp__field-label" id={`${titleId}-lang`}>
                  Language
                </span>
                <button type="button" className="vp__input vp-lang-btn" aria-labelledby={`${titleId}-lang ${titleId}-lang-value`} onClick={() => setChoosingLanguage(true)}>
                  <span id={`${titleId}-lang-value`} dir="auto">
                    {languageName}
                  </span>
                  <span aria-hidden="true">▾</span>
                </button>
              </div>
            </div>
            <div className="vp__scroll">
              {banner}
              {searching && !catalogLoading && deviceShown.length + youVersion.length + free.length === 0 && languageHits.length === 0 && (
                <p className="vp__empty" role="status">
                  {NO_MATCH}
                </p>
              )}
              {searching && languageHits.length > 0 && (
                <section className="vp__section" aria-label="Suggested languages">
                  <h3 className="vp__section-title">Suggested</h3>
                  <ul className="vp__list">
                    {languageHits.map((o) => (
                      <li key={o.key}>
                        <button type="button" className="vp-lang" onClick={() => { chooseLanguage(o.key); setQuery(''); }}>
                          <span className="vp-lang__name" dir={o.rtl ? 'rtl' : 'auto'} lang={o.key}>
                            {o.name}
                          </span>
                          <span className="vp-lang__tag">{o.key}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!searching && recentRows.length > 0 && <Section title="Recent" rows={recentRows} current={current} offline={!online} onPick={pick} onInfo={(r) => setDetailId(r.id)} />}
              <Section title="On this device" rows={deviceShown} current={current} offline={!online} onPick={pick} onInfo={(r) => setDetailId(r.id)} empty={undefined} />
              {!searching && !deviceExpanded && deviceOrdered.length > DEVICE_PREVIEW && (
                <p className="vp__hint">
                  Showing {DEVICE_PREVIEW} of {deviceOrdered.length}.{' '}
                  <button type="button" className="vp__text-btn" onClick={() => setDeviceExpanded(true)}>
                    Show more
                  </button>
                </p>
              )}
              <Section
                title={`${languageName} · Read online`}
                note="From YouVersion. Chapters load as you read."
                rows={youVersion.slice(0, limit)}
                current={current}
                offline={!online}
                onPick={pick}
                onInfo={(r) => setDetailId(r.id)}
                loading={catalogLoading}
                empty={searching || catalogLoading ? undefined : 'YouVersion has no versions in this language for Journeys yet.'}
              />
              {youVersion.length > limit && (
                <p className="vp__hint">
                  Showing {limit} of {youVersion.length}.{' '}
                  <button type="button" className="vp__text-btn" onClick={() => setLimit((n) => n + PAGE)}>
                    Show more
                  </button>
                </p>
              )}
              {(free.length > 0 || hao.error) && (
                <Section
                  title={`${languageName} · Free to download`}
                  note="From AO Lab's Free Use Bible API. Download once, then read offline."
                  rows={free.slice(0, PAGE)}
                  current={current}
                  offline={!online}
                  onPick={pick}
                  onInfo={(r) => setDetailId(r.id)}
                  empty={hao.error ? ' ' : undefined}
                />
              )}
              {hao.error && (
                <p role="alert" className="vp__hint">
                  {online ? hao.error : 'Connect to the internet to see free downloads.'}{' '}
                  <button type="button" className="vp__text-btn" onClick={() => setHaoAttempt((n) => n + 1)}>
                    Try again
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

interface Actions {
  read: (r: VersionRow) => void;
  download: (r: VersionRow) => void;
  cancel: (r: VersionRow) => void;
  remove: (r: VersionRow) => Promise<void>;
}

function Section({
  title,
  note,
  rows,
  current,
  offline,
  onPick,
  onInfo,
  empty,
  loading,
}: {
  title: string;
  note?: string;
  rows: VersionRow[];
  current: TranslationId;
  offline: boolean;
  onPick: (r: VersionRow) => void;
  onInfo: (r: VersionRow) => void;
  empty?: string;
  loading?: boolean;
}) {
  const id = useId();
  if (rows.length === 0 && !empty && !loading) return null;
  return (
    <section className="vp__section" aria-labelledby={id} aria-busy={loading ? 'true' : undefined}>
      <h3 id={id} className="vp__section-title">
        {title}
      </h3>
      {note && <p className="vp__hint vp__section-note">{note}</p>}
      {loading ? (
        <>
          <p className="vp__hint" role="status">
            Loading versions…
          </p>
          <ul className="vp__list" aria-hidden="true">
            {['a', 'b', 'c'].map((k) => (
              <li key={k} className="vp-skel">
                <span className="vp-skel__badge" />
                <span className="vp-skel__lines">
                  <span className="vp-skel__line" />
                  <span className="vp-skel__line vp-skel__line--short" />
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : rows.length === 0 ? (
        empty?.trim() && <p className="vp__hint">{empty}</p>
      ) : (
        <ul className="vp__list">
          {rows.map((r) => {
            const isCurrent = r.id === current;
            const meta = rowMeta(r, offline);
            return (
              <li key={r.id} className={`vp-row vp-row--${r.state}${isCurrent ? ' vp-row--current' : ''}`}>
                <button
                  type="button"
                  className="vp-row__main"
                  data-version={r.id}
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-label={`${r.abbreviation} · ${r.name}. ${badges(r).join('. ')}${badges(r).length ? '. ' : ''}${meta}${isCurrent ? '. Reading now' : ''}`}
                  onClick={() => onPick(r)}
                >
                  <span className="vp-row__text" aria-hidden="true">
                    <span className="vp-row__name">
                      <span className="vp-row__code">{r.abbreviation}</span> ·{' '}
                      <span lang={r.lang} dir={r.rtl ? 'rtl' : 'auto'}>
                        {r.name}
                      </span>
                    </span>
                    {(badges(r).length > 0 || meta) && (
                      <span className="vp-row__meta">
                        {badges(r).map((b) => (
                          <span key={b} className={`vp-tag${b === 'Read online' || b === 'Download' ? '' : ' vp-tag--plain'}`}>
                            {b}
                          </span>
                        ))}
                        {meta}
                      </span>
                    )}
                    {r.progress?.phase === 'chapters' && r.progress.total > 0 && <progress className="vp-row__progress" max={r.progress.total} value={r.progress.done} />}
                  </span>
                  {isCurrent && (
                    <span className="vp-row__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
                <button type="button" className="vp__icon-btn vp-row__info" aria-label={`About ${r.name}`} onClick={() => onInfo(r)}>
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
  row: r,
  titleId,
  offline,
  actions,
  onBack,
  onClose,
}: {
  row: VersionRow;
  titleId: string;
  offline: boolean;
  actions: Actions;
  onBack: () => void;
  onClose: () => void;
}) {
  const progress = progressLabel(r);
  const facts = [r.languageName, r.coverage].filter(Boolean).join(' · ');
  const notice = useVersionNotice(r.yv && !r.notice ? r.yv.yvId : null);
  const installed = r.state === 'device';
  const downloadable = r.state !== 'unavailable' && !installed && !r.progress && (r.state === 'download' || r.canDownload);
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
        <span className="vp-badge vp-badge--lg">{r.abbreviation}</span>
        <h2 id={titleId} className="vp-detail__title" lang={r.lang} dir={r.rtl ? 'rtl' : 'auto'}>
          {r.name}
        </h2>
        <p className="vp-detail__facts">
          {facts}
          {r.state === 'online' && !r.progress && <span className="vp-tag">{r.canDownload ? 'Download' : 'Read online'}</span>}
          {r.state === 'unavailable' && <span className="vp-tag vp-tag--plain">Not available yet</span>}
        </p>
        <dl className="vp-detail__dl">
          {r.publisher && (
            <>
              <dt>Publisher</dt>
              <dd>
                {r.publisherUrl ? (
                  <a href={r.publisherUrl} target="_blank" rel="noreferrer">
                    {r.publisher}
                  </a>
                ) : (
                  r.publisher
                )}
              </dd>
            </>
          )}
          {r.license && (
            <>
              <dt>License</dt>
              <dd>
                {r.licenseUrl ? (
                  <a href={r.licenseUrl} target="_blank" rel="noreferrer">
                    {r.license}
                  </a>
                ) : (
                  r.license
                )}
              </dd>
            </>
          )}
          <dt>Source</dt>
          <dd>{SOURCE_LABEL[r.source]}</dd>
        </dl>
        {r.notice ? (
          <p className="vp-detail__copyright">{r.notice}</p>
        ) : notice.status === 'loading' ? (
          <p className="vp-detail__copyright vp-detail__copyright--loading" aria-busy="true">
            Loading the publisher&apos;s copyright notice…
          </p>
        ) : notice.status === 'ready' && notice.text ? (
          <p className="vp-detail__copyright">{notice.text}</p>
        ) : notice.status === 'error' ? (
          <p className="vp-detail__copyright">
            Couldn&apos;t load the copyright notice.{' '}
            <button type="button" className="vp__text-btn" onClick={notice.retry}>
              Try again
            </button>
          </p>
        ) : null}
        {r.state === 'online' && !r.canDownload && (
          <p className="vp-note vp-note--quiet">This version can be read online but not downloaded.</p>
        )}
        {r.state === 'unavailable' && (
          <p className="vp-note vp-note--quiet">You can&apos;t read this version in Journeys yet. We&apos;re working with YouVersion to open up more versions.</p>
        )}
        {r.source === 'youversion' && r.canDownload && !installed && <p className="vp-note">{licensedDownloadNote()}</p>}
        {progress && (
          <div className="vp-detail__progress">
            {r.progress?.phase === 'chapters' && r.progress.total > 0 && (
              <progress className="vp-row__progress" max={r.progress.total} value={r.progress.done} aria-label={`${r.name} download progress`} />
            )}
          </div>
        )}
        {r.error && (
          <p role="alert" className="vp__error">
            {r.error}
          </p>
        )}
        <div className="vp-detail__actions">
          {(installed || r.state === 'online') && (
            <button type="button" className="vp-btn vp-btn--primary" disabled={r.state === 'online' && offline} onClick={() => actions.read(r)}>
              Read
            </button>
          )}
          {downloadable && (
            <button type="button" className={`vp-btn${r.state === 'download' ? ' vp-btn--primary' : ''}`} disabled={offline} onClick={() => actions.download(r)}>
              Download
            </button>
          )}
          {progress && (
            <button type="button" className="vp-btn vp-btn--primary vp-btn--progress" disabled aria-live="polite">
              {progress}
            </button>
          )}
          {r.progress && r.progress.phase !== 'installing' && (
            <button type="button" className="vp-btn" onClick={() => actions.cancel(r)}>
              Cancel
            </button>
          )}
          {installed && r.source !== 'builtin' && (
            <button type="button" className="vp-btn" onClick={() => void actions.remove(r)}>
              Remove download
            </button>
          )}
        </div>
        {offline && !installed && r.state !== 'unavailable' && <p className="vp__hint">Connect to the internet to {r.state === 'online' ? 'read or download' : 'download'} this version.</p>}
      </div>
    </>
  );
}

function LanguageList({
  options,
  current,
  recent,
  deviceTag,
  onPick,
  onBack,
  onClose,
}: {
  options: LanguageOption[];
  current: string;
  recent: string[];
  deviceTag: string;
  onPick: (tag: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(LANGUAGE_PAGE);
  const titleId = useId();
  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);
  const device = byKey.get(deviceTag) ?? byKey.get(deviceTag.split('-')[0]);
  const pinned = [device, ...recent.map((k) => byKey.get(k))].filter((o, i, all): o is LanguageOption => Boolean(o) && all.findIndex((x) => x?.key === o?.key) === i);
  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => `${o.name} ${o.key}`.toLowerCase().includes(q)) : options;
  const row = (o: LanguageOption, note?: string) => (
    <li key={`${note ?? ''}${o.key}`}>
      <button type="button" className={`vp-lang${o.key === current ? ' vp-lang--current' : ''}`} aria-current={o.key === current ? 'true' : undefined} onClick={() => onPick(o.key)}>
        <span className="vp-lang__name" dir={o.rtl ? 'rtl' : 'auto'} lang={o.key === ALL_LANGUAGES ? undefined : o.key}>
          {o.name}
        </span>
        <span className="vp-lang__tag">{note ?? o.key}</span>
        {o.key === current && (
          <span className="vp-row__check" aria-hidden="true">
            ✓
          </span>
        )}
      </button>
    </li>
  );
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
      <div className="vp__controls">
        <label className="vp__field vp__field--grow">
          <span className="vp__field-label" id={titleId}>
            Find a language ({options.length.toLocaleString()})
          </span>
          <input
            type="search"
            className="vp__input vp-lang__search"
            value={query}
            placeholder="Language name or code"
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(LANGUAGE_PAGE);
            }}
          />
        </label>
      </div>
      <div className="vp__scroll">
        {!q && (
          <ul className="vp__list" aria-label="All languages option">
            {row({ key: ALL_LANGUAGES, name: 'All languages', rtl: false }, ' ')}
          </ul>
        )}
        {!q && pinned.length > 0 && (
          <section className="vp__section" aria-label="Suggested languages">
            <h3 className="vp__section-title">Suggested</h3>
            <ul className="vp__list">{pinned.map((o) => row(o, o === device ? 'This device' : 'Recent'))}</ul>
          </section>
        )}
        <section className="vp__section" aria-label={q ? 'Matching languages' : 'All languages'}>
          <h3 className="vp__section-title">{q ? `Matches (${matches.length.toLocaleString()})` : 'All languages'}</h3>
          {matches.length === 0 ? <p className="vp__hint">No languages match.</p> : <ul className="vp__list">{matches.slice(0, limit).map((o) => row(o))}</ul>}
          {matches.length > limit && (
            <p className="vp__hint">
              Showing {limit.toLocaleString()} of {matches.length.toLocaleString()}.{' '}
              <button type="button" className="vp__text-btn" onClick={() => setLimit((n) => n + LANGUAGE_PAGE)}>
                Show more
              </button>
            </p>
          )}
        </section>
      </div>
    </>
  );
}
