import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModePanel } from '../ModePanel';
import { useBundle, type BundleIndex } from '../../content/useBundle';
import { useChapter, useChapterCounts, searchVerses, type VerseRow } from '../../content/useBible';
import { bookNameFromNumber } from '../../content/books';
import { parseScriptureRef } from '../../content/scriptureRef';
import {
  buildScriptureIndex,
  markedVerses,
  refsForChapter,
  verseLabel,
} from '../../content/scriptureIndex';
import {
  BookPicker,
  ChapterPicker,
  CrossRefPanel,
  NotesList,
  VerseNoteEditor,
  VerseRowView,
} from '../../components/bible/BibleParts';
import {
  chapterNotes,
  exportNotes,
  useNotesStore,
  type HighlightColor,
} from '../../state/useNotesStore';
import { useUiStore, type Translation } from '../../state/useUiStore';

/**
 * The Bible reader.
 *
 * Three things happen on this screen and they are deliberately one screen, not
 * three: you read a chapter from the bundled public-domain text, you mark it up
 * (highlights and per-verse notes, stored on the device), and you see what the
 * atlas has anchored to the passage — the journey stop, the miracle, the
 * battle, the figure — with a link straight onto the map.
 *
 * Deep-linkable via `?ref=`, so every "read the passage" link elsewhere in the
 * app lands on the right chapter with the right verse scrolled into view.
 */
export default function BibleMode() {
  const { bundle, loading, error } = useBundle();
  const { t } = useTranslation();
  if (loading) return <ModePanel title={t('modes.bible.title')}>{t('common.loading')}</ModePanel>;
  if (error || !bundle)
    return <ModePanel title={t('modes.bible.title')}>Could not load content. {error?.message}</ModePanel>;
  return <Reader bundle={bundle} />;
}

type Tab = 'read' | 'contents' | 'notes' | 'search';

function Reader({ bundle }: { bundle: BundleIndex }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const translation = useUiStore((s) => s.translation);
  const setTranslation = useUiStore((s) => s.setTranslation);

  const notes = useNotesStore((s) => s.notes);
  const bookmarks = useNotesStore((s) => s.bookmarks);
  const lastRead = useNotesStore((s) => s.lastRead);
  const setNote = useNotesStore((s) => s.setNote);
  const setHighlight = useNotesStore((s) => s.setHighlight);
  const removeNote = useNotesStore((s) => s.removeNote);
  const toggleBookmark = useNotesStore((s) => s.toggleBookmark);
  const setLastRead = useNotesStore((s) => s.setLastRead);

  const index = useMemo(() => buildScriptureIndex(bundle), [bundle]);
  const counts = useChapterCounts(translation);

  // `?ref=` wins, then wherever the reader left off, then John 1 as a default
  // that is neither arbitrary nor a spoiler.
  const refParam = params.get('ref');
  const parsed = refParam ? parseScriptureRef(refParam) : null;
  const [book, setBook] = useState(() => parsed?.book ?? lastRead?.book ?? 43);
  const [chapter, setChapter] = useState(() => parsed?.chapter ?? lastRead?.chapter ?? 1);
  const [tab, setTab] = useState<Tab>('read');
  const [activeVerse, setActiveVerse] = useState<number | null>(parsed?.verseStart ?? null);

  // A `?ref=` arriving after mount (an in-app link while the reader is open)
  // has to move the reader; the state initialisers only run once.
  useEffect(() => {
    if (!parsed) return;
    setBook(parsed.book);
    setChapter(parsed.chapter);
    setActiveVerse(parsed.verseStart);
    setTab('read');
    // Deliberately keyed on the parsed primitives: `parsed` is a fresh object
    // every render, so depending on it directly would re-run this on every
    // keystroke and drag the reader back to the linked verse.
  }, [parsed?.book, parsed?.chapter, parsed?.verseStart]);

  useEffect(() => {
    setLastRead(book, chapter);
  }, [book, chapter, setLastRead]);

  const { rows, loading, error } = useChapter(book, chapter, translation);
  const bookName = bookNameFromNumber(book) ?? `Book ${book}`;
  const chapterLabel = `${bookName} ${chapter}`;
  const chapterCount = counts.get(book) ?? 0;

  const crossRefs = useMemo(() => refsForChapter(index, book, chapter), [index, book, chapter]);
  const marked = useMemo(() => markedVerses(crossRefs), [crossRefs]);
  const verseNotes = useMemo(() => chapterNotes(notes, book, chapter), [notes, book, chapter]);
  const bookmarked = Boolean(bookmarks[`${book}:${chapter}`]);

  // Scroll a deep-linked verse into view once its chapter has actually rendered.
  useEffect(() => {
    if (!activeVerse || rows.length === 0) return;
    document.getElementById(`v${activeVerse}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeVerse, rows.length]);

  const go = useCallback(
    (nextBook: number, nextChapter: number) => {
      setBook(nextBook);
      setChapter(nextChapter);
      setActiveVerse(null);
      setTab('read');
      // Drop a stale `?ref=`, or the effect above would yank the reader back to
      // the linked chapter on the next render.
      if (params.has('ref')) {
        params.delete('ref');
        setParams(params, { replace: true });
      }
    },
    [params, setParams],
  );

  const activeNote = activeVerse ? verseNotes.get(activeVerse) : undefined;
  const activeRef = activeVerse ? verseLabel(book, chapter, activeVerse) : '';
  const verseTarget = activeVerse ? { book, chapter, verse: activeVerse, ref: activeRef } : null;

  const prev = chapter > 1 ? { book, chapter: chapter - 1 } : book > 1 ? { book: book - 1, chapter: counts.get(book - 1) ?? 1 } : null;
  const next =
    chapter < chapterCount ? { book, chapter: chapter + 1 } : book < 66 ? { book: book + 1, chapter: 1 } : null;

  return (
    <section className="mode-panel mode-panel--page mode-panel--wide bible" aria-labelledby="bible-title">
      <header className="bible__header">
        <div>
          <h1 id="bible-title" className="home__title">
            {t('modes.bible.title')}
          </h1>
          <p className="home__tagline">{t('modes.bible.tagline')}</p>
        </div>
        <label className="bible__translation">
          Translation
          <select value={translation} onChange={(e) => setTranslation(e.target.value as Translation)}>
            <option value="ASV">American Standard Version (1901)</option>
            <option value="KJV">King James Version</option>
          </select>
        </label>
      </header>

      <nav className="bible__tabs" aria-label="Reader sections">
        {(
          [
            ['read', chapterLabel],
            ['contents', 'Books'],
            ['notes', `My notes (${Object.keys(notes).length})`],
            ['search', 'Search'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`bible__tab${tab === id ? ' bible__tab--active' : ''}`}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'contents' && (
        <>
          <BookPicker current={book} booksWithRefs={index.booksWithRefs} onPick={(b) => go(b, 1)} />
          <ChapterPicker
            bookName={bookName}
            count={chapterCount}
            current={chapter}
            chaptersWithRefs={index.chaptersWithRefs.get(book) ?? new Set()}
            onPick={(c) => go(book, c)}
          />
        </>
      )}

      {tab === 'notes' && (
        <NotesSection
          notes={notes}
          onOpen={(n) => {
            go(n.book, n.chapter);
            setActiveVerse(n.verse);
          }}
          onDelete={removeNote}
        />
      )}

      {tab === 'search' && <SearchSection translation={translation} onOpen={(r) => {
        go(r.book, r.chapter);
        setActiveVerse(r.verse);
      }} />}

      {tab === 'read' && (
        <div className="bible__reader">
          <div className="bible__chapter">
            <div className="bible__chapter-bar">
              <button type="button" className="bible__nav" disabled={!prev} onClick={() => prev && go(prev.book, prev.chapter)}>
                ← Previous
              </button>
              <h2 className="bible__chapter-title">
                {chapterLabel}{' '}
                <span className="bible__translation-tag">({translation})</span>
              </h2>
              <button type="button" className="bible__nav" disabled={!next} onClick={() => next && go(next.book, next.chapter)}>
                Next →
              </button>
            </div>

            <div className="bible__chapter-actions">
              <button
                type="button"
                className={`bible__bookmark${bookmarked ? ' bible__bookmark--on' : ''}`}
                onClick={() => toggleBookmark({ book, chapter, ref: chapterLabel })}
                aria-pressed={bookmarked}
              >
                {bookmarked ? '★ Bookmarked' : '☆ Bookmark this chapter'}
              </button>
              {crossRefs.length > 0 && (
                <span className="bible__mapped-count">◍ {crossRefs.length} mapped in the atlas</span>
              )}
            </div>

            {loading && <p className="mode-panel--loading">{t('common.loading')}</p>}
            {error && <p className="bible__error">Could not load {chapterLabel}: {error.message}</p>}
            {!loading && !error && rows.length === 0 && (
              <p className="bible__error">{chapterLabel} is not in the bundled text.</p>
            )}

            <div className="bible__text">
              {rows.map((row) => (
                <VerseRowView
                  key={row.verse}
                  row={row}
                  note={verseNotes.get(row.verse)}
                  mapped={marked.has(row.verse)}
                  active={activeVerse === row.verse}
                  onActivate={(v) => setActiveVerse(activeVerse === v ? null : v)}
                />
              ))}
            </div>
          </div>

          <aside className="bible__aside">
            {verseTarget && (
              <VerseNoteEditor
                refLabel={activeRef}
                note={activeNote}
                onHighlight={(color: HighlightColor | null) => setHighlight(verseTarget, color)}
                onSave={(text) => setNote(verseTarget, text)}
                onDelete={() => activeNote && removeNote(activeNote.key)}
                onClose={() => setActiveVerse(null)}
              />
            )}
            <CrossRefPanel refs={crossRefs} chapterLabel={chapterLabel} />
          </aside>
        </div>
      )}

      <p className="bible__sourcing">
        Text: {translation === 'KJV' ? 'King James Version' : 'American Standard Version (1901)'} — public domain,
        bundled for offline reading. Notes and highlights are stored on this device only and are never uploaded.
      </p>
    </section>
  );
}

function NotesSection({
  notes,
  onOpen,
  onDelete,
}: {
  notes: Record<string, import('../../state/useNotesStore').VerseNote>;
  onOpen: (n: import('../../state/useNotesStore').VerseNote) => void;
  onDelete: (key: string) => void;
}) {
  const rows = useMemo(
    () => Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );
  const download = () => {
    const blob = new Blob([exportNotes(notes)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'journeys-notes.md';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="bible__notes">
      <div className="bible__notes-head">
        <h3>My notes</h3>
        {rows.length > 0 && (
          <button type="button" className="miracle-card__read" onClick={download}>
            Export as Markdown
          </button>
        )}
      </div>
      <NotesList notes={rows} onOpen={onOpen} onDelete={onDelete} />
    </section>
  );
}

function SearchSection({
  translation,
  onOpen,
}: {
  translation: Translation;
  onOpen: (row: VerseRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<VerseRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [ran, setRan] = useState(false);

  // Debounced so a query is not run against 31k rows on every keystroke.
  useEffect(() => {
    if (query.trim().length < 3) {
      setRows([]);
      setRan(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchVerses(query, translation)
        .then((r) => {
          if (!active) return;
          setRows(r);
          setRan(true);
        })
        .finally(() => active && setSearching(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, translation]);

  return (
    <section className="bible__search">
      <label className="bible__search-label" htmlFor="bible-search">
        Search the {translation} text
      </label>
      <input
        id="bible-search"
        type="search"
        className="bible__search-input"
        value={query}
        placeholder="e.g. still small voice"
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && <p className="mode-panel--loading">Searching…</p>}
      {ran && !searching && (
        <p className="bible__search-count">
          {rows.length === 0 ? 'No matches.' : `${rows.length} match${rows.length === 1 ? '' : 'es'} (first 60).`}
        </p>
      )}
      <ul className="bible__search-list">
        {rows.map((r) => (
          <li key={`${r.book}:${r.chapter}:${r.verse}`}>
            <button type="button" className="backlink" onClick={() => onOpen(r)}>
              {verseLabel(r.book, r.chapter, r.verse)}
            </button>
            <p>{r.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
