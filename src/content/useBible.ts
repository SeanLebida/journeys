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
