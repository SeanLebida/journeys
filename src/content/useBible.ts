import { useEffect, useState } from 'react';
import initSqlJs, { type Database } from 'sql.js';
// Vite resolves the wasm binary to a served URL so sql.js works offline in the
// browser (and via the Capacitor local server on device).
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { loadBibleDbBytes } from '../platform/assets';
import { parseScriptureRef, type ScriptureRef } from './scriptureRef';
import type { Translation } from '../state/useUiStore';

export interface VerseRow {
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

let dbPromise: Promise<Database> | null = null;

async function openDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
      const bytes = await loadBibleDbBytes();
      return new SQL.Database(bytes);
    })();
  }
  return dbPromise;
}

/** Resolve a parsed ref to its verse rows in a translation. */
export async function lookupRef(ref: ScriptureRef, translation: Translation): Promise<VerseRow[]> {
  const db = await openDb();
  const end = ref.verseEnd ?? ref.verseStart;
  const stmt = db.prepare(
    'SELECT book, chapter, verse, text FROM verses WHERE translation=? AND book=? AND chapter=? AND verse BETWEEN ? AND ? ORDER BY verse',
  );
  stmt.bind([translation, ref.book, ref.chapter, ref.verseStart, end]);
  const rows: VerseRow[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as VerseRow);
  stmt.free();
  return rows;
}

/** Every verse of a chapter, in order — what the reader renders. */
export async function lookupChapter(
  book: number,
  chapter: number,
  translation: Translation,
): Promise<VerseRow[]> {
  const db = await openDb();
  const stmt = db.prepare(
    'SELECT book, chapter, verse, text FROM verses WHERE translation=? AND book=? AND chapter=? ORDER BY verse',
  );
  stmt.bind([translation, book, chapter]);
  const rows: VerseRow[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as VerseRow);
  stmt.free();
  return rows;
}

/**
 * Chapter count per book, read from the bundled text itself rather than a
 * hardcoded table — the DB is the authority on what was actually shipped, so a
 * book that ever arrives short cannot produce chapter buttons that go nowhere.
 */
export async function chapterCounts(translation: Translation): Promise<Map<number, number>> {
  const db = await openDb();
  const stmt = db.prepare(
    'SELECT book, MAX(chapter) AS chapters FROM verses WHERE translation=? GROUP BY book ORDER BY book',
  );
  stmt.bind([translation]);
  const counts = new Map<number, number>();
  while (stmt.step()) {
    const row = stmt.getAsObject() as { book: number; chapters: number };
    counts.set(row.book, row.chapters);
  }
  stmt.free();
  return counts;
}

/**
 * Full-text search across the bundled translation. `LIKE` on 31k rows is fast
 * enough in sql.js (tens of milliseconds) and keeps the shipped DB free of an
 * FTS index that would roughly double its 10 MB download.
 */
export async function searchVerses(
  query: string,
  translation: Translation,
  limit = 60,
): Promise<VerseRow[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const db = await openDb();
  const stmt = db.prepare(
    'SELECT book, chapter, verse, text FROM verses WHERE translation=? AND text LIKE ? ' +
      'ORDER BY book, chapter, verse LIMIT ?',
  );
  // Escape the LIKE wildcards so a search for "100%" is a literal search.
  const escaped = trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
  stmt.bind([translation, `%${escaped}%`, limit]);
  const rows: VerseRow[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as VerseRow);
  stmt.free();
  return rows;
}

type ChapterState = { rows: VerseRow[]; loading: boolean; error: Error | null };

/** React hook: the verses of one chapter in the current translation. */
export function useChapter(book: number, chapter: number, translation: Translation): ChapterState {
  const [state, setState] = useState<ChapterState>({ rows: [], loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState({ rows: [], loading: true, error: null });
    lookupChapter(book, chapter, translation)
      .then((rows) => active && setState({ rows, loading: false, error: null }))
      .catch((e: Error) => active && setState({ rows: [], loading: false, error: e }));
    return () => {
      active = false;
    };
  }, [book, chapter, translation]);
  return state;
}

/** React hook: chapter counts for the whole canon, loaded once per translation. */
export function useChapterCounts(translation: Translation): Map<number, number> {
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    let active = true;
    chapterCounts(translation)
      .then((c) => active && setCounts(c))
      .catch(() => active && setCounts(new Map()));
    return () => {
      active = false;
    };
  }, [translation]);
  return counts;
}

type RefState = { rows: VerseRow[]; loading: boolean; error: Error | null };

/** React hook: fetch the verse text for a raw reference string. */
export function useScripture(raw: string, translation: Translation): RefState {
  const [state, setState] = useState<RefState>({ rows: [], loading: true, error: null });
  useEffect(() => {
    let active = true;
    const ref = parseScriptureRef(raw);
    if (!ref) {
      setState({ rows: [], loading: false, error: new Error(`Unparseable reference: ${raw}`) });
      return;
    }
    setState({ rows: [], loading: true, error: null });
    lookupRef(ref, translation)
      .then((rows) => active && setState({ rows, loading: false, error: null }))
      .catch((e: Error) => active && setState({ rows: [], loading: false, error: e }));
    return () => {
      active = false;
    };
  }, [raw, translation]);
  return state;
}
