import { bookNameFromNumber, bookNumberFromName } from './books';

export interface ScriptureRef {
  raw: string;
  book: number; // 1..66 (Protestant canon, see books.ts)
  chapter: number;
  verseStart: number;
  verseEnd?: number; // inclusive
}

// Matches: "John 3:16", "1 Cor 13:4-7", "Acts 13", "Song of Solomon 2:1",
// "2 John 1:5". Hyphen or en-dash verse ranges accepted.
const REF_RE = /^\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z .]*?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/;

/**
 * Parse a human scripture reference into a structured ref, or null if it does
 * not parse or names an unknown book. Used by content authoring AND by the
 * build-content validator to reject typo'd/fabricated references.
 */
export function parseScriptureRef(raw: string): ScriptureRef | null {
  const m = REF_RE.exec(raw);
  if (!m) return null;
  const book = bookNumberFromName(m[1]);
  if (book == null) return null;

  const chapter = Number(m[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;

  // Whole-chapter reference (no verse) is allowed; default to verse 1.
  const verseStart = m[3] != null ? Number(m[3]) : 1;
  if (!Number.isInteger(verseStart) || verseStart < 1) return null;

  const ref: ScriptureRef = { raw: raw.trim(), book, chapter, verseStart };

  if (m[4] != null) {
    const verseEnd = Number(m[4]);
    if (!Number.isInteger(verseEnd) || verseEnd < verseStart) return null;
    ref.verseEnd = verseEnd;
  }
  return ref;
}

/** Render a parsed ref back to canonical display form. */
export function formatScriptureRef(ref: ScriptureRef): string {
  const name = bookNameFromNumber(ref.book) ?? `Book ${ref.book}`;
  const verses = ref.verseEnd != null ? `${ref.verseStart}-${ref.verseEnd}` : `${ref.verseStart}`;
  return `${name} ${ref.chapter}:${verses}`;
}
