import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKS } from '../../content/books';
import type { VerseRow } from '../../content/useBible';
import type { CrossRef } from '../../content/scriptureIndex';
import { bibleHref } from '../../content/scriptureIndex';
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
  type VerseNote,
} from '../../state/useNotesStore';

/**
 * The reader's reusable parts.
 *
 * Same rule as the timeline's: presentational, plain-data props, no bundle and
 * no router state reached for from in here. The reader screen composes them;
 * anything else that needs a book grid or a verse row can too.
 */

const OLD_TESTAMENT = BOOKS.filter((b) => b.num <= 39);
const NEW_TESTAMENT = BOOKS.filter((b) => b.num >= 40);

/** Book grid, split by testament, with a dot on books the atlas maps. */
export function BookPicker({
  current,
  booksWithRefs,
  onPick,
}: {
  current: number;
  booksWithRefs: Set<number>;
  onPick: (book: number) => void;
}) {
  return (
    <div className="bible-books">
      {[
        { label: 'Old Testament', books: OLD_TESTAMENT },
        { label: 'New Testament', books: NEW_TESTAMENT },
      ].map((group) => (
        <section key={group.label}>
          <h4 className="bible-books__title">{group.label}</h4>
          <ul className="bible-books__grid">
            {group.books.map((b) => (
              <li key={b.num}>
                <button
                  type="button"
                  className={`bible-books__item${b.num === current ? ' bible-books__item--active' : ''}`}
                  onClick={() => onPick(b.num)}
                  aria-current={b.num === current ? 'true' : undefined}
                >
                  {b.name}
                  {booksWithRefs.has(b.num) && (
                    <span className="bible-books__dot" title="This book is mapped in the atlas" aria-label="mapped">
                      ●
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Chapter grid for the open book; chapters the atlas touches are marked. */
export function ChapterPicker({
  bookName,
  count,
  current,
  chaptersWithRefs,
  onPick,
}: {
  bookName: string;
  count: number;
  current: number;
  chaptersWithRefs: Set<number>;
  onPick: (chapter: number) => void;
}) {
  if (count === 0) return null;
  return (
    <div className="bible-chapters">
      <h4 className="bible-books__title">{bookName} — chapters</h4>
      <ul className="bible-chapters__grid">
        {Array.from({ length: count }, (_, i) => i + 1).map((c) => (
          <li key={c}>
            <button
              type="button"
              className={
                `bible-chapters__item${c === current ? ' bible-chapters__item--active' : ''}` +
                `${chaptersWithRefs.has(c) ? ' bible-chapters__item--mapped' : ''}`
              }
              onClick={() => onPick(c)}
              aria-current={c === current ? 'true' : undefined}
              title={chaptersWithRefs.has(c) ? 'Mapped in the atlas' : undefined}
            >
              {c}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One verse. Tapping the number opens the note/highlight controls for it —
 * the number, not the text, so a reader can still select and copy prose
 * normally. Highlight colour is carried as a data attribute rather than an
 * inline style so both themes can tune it in CSS.
 */
export function VerseRowView({
  row,
  note,
  mapped,
  active,
  onActivate,
}: {
  row: VerseRow;
  note?: VerseNote;
  mapped: boolean;
  active: boolean;
  onActivate: (verse: number) => void;
}) {
  return (
    <p
      className={`bible-verse${active ? ' bible-verse--active' : ''}`}
      data-highlight={note?.color ?? undefined}
      id={`v${row.verse}`}
    >
      <button
        type="button"
        className="bible-verse__num"
        onClick={() => onActivate(row.verse)}
        aria-expanded={active}
        aria-label={`Verse ${row.verse} — notes and highlight`}
      >
        {row.verse}
      </button>
      <span className="bible-verse__text">
        {row.text}
        {note?.text && (
          <span className="bible-verse__flag" title={note.text} aria-label="has a note">
            ✎
          </span>
        )}
        {mapped && (
          <span className="bible-verse__flag bible-verse__flag--map" aria-label="mapped in the atlas" title="Mapped in the atlas">
            ◍
          </span>
        )}
      </span>
    </p>
  );
}

/** Highlight swatches + note textarea for the verse the reader tapped. */
export function VerseNoteEditor({
  refLabel,
  note,
  onHighlight,
  onSave,
  onDelete,
  onClose,
}: {
  /** Display reference for the verse, e.g. "1 Kings 18:21". Not named `ref` —
      React reserves that prop name and would swallow it. */
  refLabel: string;
  note?: VerseNote;
  onHighlight: (color: HighlightColor | null) => void;
  onSave: (text: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(note?.text ?? '');
  const area = useRef<HTMLTextAreaElement>(null);

  // Re-seed when the reader moves to a different verse without closing the
  // editor: without this the previous verse's draft would follow them.
  useEffect(() => {
    setDraft(note?.text ?? '');
  }, [note?.key, note?.text]);

  useEffect(() => {
    area.current?.focus();
  }, []);

  return (
    <section className="bible-note" aria-label={`Notes for ${refLabel}`}>
      <header className="bible-note__head">
        <h4>{refLabel}</h4>
        <button type="button" className="bible-note__close" onClick={onClose} aria-label="Close notes">
          ✕
        </button>
      </header>

      <div className="bible-note__colors" role="group" aria-label="Highlight colour">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`bible-note__swatch bible-note__swatch--${c.id}${note?.color === c.id ? ' bible-note__swatch--on' : ''}`}
            onClick={() => onHighlight(note?.color === c.id ? null : c.id)}
            aria-pressed={note?.color === c.id}
            aria-label={`${c.label} highlight`}
            title={c.label}
          />
        ))}
        {note?.color && (
          <button type="button" className="bible-note__clear" onClick={() => onHighlight(null)}>
            Clear highlight
          </button>
        )}
      </div>

      <label className="bible-note__label" htmlFor="verse-note">
        Note
      </label>
      <textarea
        id="verse-note"
        ref={area}
        className="bible-note__area"
        value={draft}
        rows={4}
        placeholder="Your note on this verse — stored on this device only."
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="bible-note__actions">
        <button type="button" className="bible-note__save" onClick={() => onSave(draft)}>
          Save note
        </button>
        {note && (
          <button type="button" className="bible-note__delete" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </section>
  );
}

const CROSSREF_LABEL: Record<CrossRef['kind'], string> = {
  stop: 'Journey stop',
  miracle: 'Miracle account',
  battle: 'Battle',
  person: 'Figure',
  lesson: 'Lesson',
};

/**
 * What the atlas has for the open chapter — the bridge between reading and the
 * map. Every row links somewhere: a stop into the animated trace, a site onto
 * the atlas, a lesson into the guided walk-through.
 */
export function CrossRefPanel({ refs, chapterLabel }: { refs: CrossRef[]; chapterLabel: string }) {
  if (refs.length === 0) {
    return (
      <section className="bible-xrefs">
        <h4 className="bible-xrefs__title">In the atlas</h4>
        <p className="bible-xrefs__empty">
          Nothing in the atlas is anchored to {chapterLabel} yet. Chapters that are mapped carry a ◍ in the chapter
          grid.
        </p>
      </section>
    );
  }
  return (
    <section className="bible-xrefs">
      <h4 className="bible-xrefs__title">In the atlas — {refs.length} for {chapterLabel}</h4>
      <ul className="bible-xrefs__list">
        {refs.map((r) => (
          <li key={`${r.kind}:${r.id}:${r.raw}`} className={`bible-xrefs__item bible-xrefs__item--${r.kind}`}>
            <p className="bible-xrefs__head">
              <span className="bible-xrefs__kind">{CROSSREF_LABEL[r.kind]}</span>
              <a className="bible-xrefs__verses" href={`#v${r.verseStart}`}>
                {r.raw}
              </a>
            </p>
            <p className="bible-xrefs__claim">{r.label}</p>
            {r.detail && <p className="bible-xrefs__detail">{r.detail}</p>}
            <span className="bible-xrefs__links">
              {r.journeyId && <Link to={`/trace/${r.journeyId}`}>Trace →</Link>}
              {r.siteId && <Link to={`/atlas?site=${r.siteId}`}>Map →</Link>}
              {r.lessonId && <Link to={`/lessons/${r.lessonId}`}>Lesson →</Link>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Saved notes, newest first, each linking back to its verse. */
export function NotesList({
  notes,
  onOpen,
  onDelete,
}: {
  notes: VerseNote[];
  onOpen: (n: VerseNote) => void;
  onDelete: (key: string) => void;
}) {
  if (notes.length === 0) {
    return <p className="bible-xrefs__empty">No notes yet. Tap a verse number while reading to add one.</p>;
  }
  return (
    <ul className="bible-notes-list">
      {notes.map((n) => (
        <li key={n.key} data-highlight={n.color ?? undefined}>
          <p className="bible-notes-list__ref">
            <button type="button" className="backlink" onClick={() => onOpen(n)}>
              {n.ref}
            </button>
            <Link className="bible-notes-list__jump" to={bibleHref(n.ref)}>
              open →
            </Link>
          </p>
          {n.text && <p className="bible-notes-list__text">{n.text}</p>}
          <button type="button" className="bible-note__delete" onClick={() => onDelete(n.key)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
