import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';

/**
 * Reader's notes: highlights, verse notes and bookmarks.
 *
 * This is the one store holding content the *user* made, so it is treated
 * differently from the rest of the app's state:
 *
 * - It persists through the same platform seam as every other preference
 *   (localStorage on web, Capacitor Preferences on device) — no network, no
 *   account, nothing leaves the device. The privacy policy's "we collect
 *   nothing" claim depends on that staying true.
 * - Notes key off `book:chapter:verse`, not off content ids, so a content
 *   update that renumbers or drops a stop can never orphan a note.
 * - `exportNotes()` exists because notes the user cannot get out of the app are
 *   notes the app has taken hostage; the reader offers it as a plain-text
 *   download.
 */

export type HighlightColor = 'gold' | 'sea' | 'terracotta' | 'violet';

export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string }[] = [
  { id: 'gold', label: 'Gold' },
  { id: 'sea', label: 'Teal' },
  { id: 'terracotta', label: 'Terracotta' },
  { id: 'violet', label: 'Violet' },
];

export interface VerseNote {
  /** `book:chapter:verse` — canonical, translation-independent. */
  key: string;
  book: number;
  chapter: number;
  verse: number;
  /** Display reference at the time of writing, e.g. "1 Kings 18:21". */
  ref: string;
  text?: string;
  color?: HighlightColor;
  /** Epoch millis; used for the "recent notes" ordering. */
  updatedAt: number;
}

export interface Bookmark {
  key: string; // `book:chapter`
  book: number;
  chapter: number;
  ref: string;
  createdAt: number;
}

interface NotesState {
  notes: Record<string, VerseNote>;
  bookmarks: Record<string, Bookmark>;
  /** Last place the reader was, so the reader reopens where it was left. */
  lastRead: { book: number; chapter: number } | null;
  setNote: (v: { book: number; chapter: number; verse: number; ref: string }, text: string) => void;
  setHighlight: (
    v: { book: number; chapter: number; verse: number; ref: string },
    color: HighlightColor | null,
  ) => void;
  removeNote: (key: string) => void;
  toggleBookmark: (v: { book: number; chapter: number; ref: string }) => void;
  setLastRead: (book: number, chapter: number) => void;
  clearAll: () => void;
}

export const verseKey = (book: number, chapter: number, verse: number): string =>
  `${book}:${chapter}:${verse}`;

/**
 * Merge an edit into a note, dropping the note entirely once it carries neither
 * text nor a highlight — otherwise clearing a highlight would leave an empty
 * record behind and the notes list would fill with blanks.
 */
function applyEdit(
  notes: Record<string, VerseNote>,
  v: { book: number; chapter: number; verse: number; ref: string },
  edit: Partial<Pick<VerseNote, 'text' | 'color'>>,
): Record<string, VerseNote> {
  const key = verseKey(v.book, v.chapter, v.verse);
  const next: VerseNote = {
    ...(notes[key] ?? { key, ...v, updatedAt: 0 }),
    ...edit,
    key,
    book: v.book,
    chapter: v.chapter,
    verse: v.verse,
    ref: v.ref,
    updatedAt: Date.now(),
  };
  const rest = { ...notes };
  if (!next.text?.trim() && !next.color) {
    delete rest[key];
    return rest;
  }
  return { ...rest, [key]: { ...next, text: next.text?.trim() ? next.text : undefined } };
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: {},
      bookmarks: {},
      lastRead: null,
      setNote: (v, text) => set((s) => ({ notes: applyEdit(s.notes, v, { text }) })),
      setHighlight: (v, color) => set((s) => ({ notes: applyEdit(s.notes, v, { color: color ?? undefined }) })),
      removeNote: (key) =>
        set((s) => {
          const notes = { ...s.notes };
          delete notes[key];
          return { notes };
        }),
      toggleBookmark: (v) =>
        set((s) => {
          const key = `${v.book}:${v.chapter}`;
          const bookmarks = { ...s.bookmarks };
          if (bookmarks[key]) delete bookmarks[key];
          else bookmarks[key] = { key, book: v.book, chapter: v.chapter, ref: v.ref, createdAt: Date.now() };
          return { bookmarks };
        }),
      setLastRead: (book, chapter) => set({ lastRead: { book, chapter } }),
      clearAll: () => set({ notes: {}, bookmarks: {} }),
    }),
    {
      name: 'journeys-notes',
      storage: createJSONStorage(() => platformStorage),
    },
  ),
);

/** Notes for one chapter, keyed by verse — the shape the reader renders from. */
export function chapterNotes(
  notes: Record<string, VerseNote>,
  book: number,
  chapter: number,
): Map<number, VerseNote> {
  const map = new Map<number, VerseNote>();
  for (const n of Object.values(notes)) {
    if (n.book === book && n.chapter === chapter) map.set(n.verse, n);
  }
  return map;
}

/** Plain-text export of every note, newest first. */
export function exportNotes(notes: Record<string, VerseNote>): string {
  const rows = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt);
  const lines = ['# Journeys — my notes', ''];
  for (const n of rows) {
    lines.push(`## ${n.ref}`);
    if (n.color) lines.push(`Highlight: ${n.color}`);
    if (n.text) lines.push('', n.text);
    lines.push('');
  }
  return lines.join('\n');
}
