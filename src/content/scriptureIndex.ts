import { parseScriptureRef } from './scriptureRef';
import { bookNameFromNumber } from './books';
import type { BundleIndex } from './useBundle';

/**
 * The reverse index: passage → everything in the atlas anchored to it.
 *
 * The rest of the app runs one way — a place or a journey shows you its
 * passages. The Bible reader needs the other direction: open 1 Kings 18 and be
 * told that Elijah's journey stops here, that the contest on Carmel is mapped,
 * and that tapping through puts you on the mountain. That link is what makes
 * the reader part of the atlas instead of a second app bolted onto it.
 *
 * Built once per bundle and keyed by `book:chapter`, because a chapter is what
 * the reader displays. Verse ranges are kept so the reader can mark exactly
 * which verses carry a cross-reference.
 */

export type CrossRefKind = 'stop' | 'miracle' | 'battle' | 'person' | 'lesson';

export interface CrossRef {
  kind: CrossRefKind;
  id: string;
  label: string;
  detail?: string;
  /** The raw reference as authored, e.g. "1 Kings 18:20-40". */
  raw: string;
  verseStart: number;
  verseEnd: number;
  journeyId?: string;
  siteId?: string;
  personId?: string;
  lessonId?: string;
  stopOrder?: number;
}

export interface ScriptureIndex {
  /** All cross-references in a chapter, key `book:chapter`. */
  byChapter: Map<string, CrossRef[]>;
  /** Chapters that carry at least one reference, key `book` → sorted chapters. */
  chaptersWithRefs: Map<number, Set<number>>;
  /** Books that carry at least one reference, for the book picker's badges. */
  booksWithRefs: Set<number>;
}

export const chapterKey = (book: number, chapter: number): string => `${book}:${chapter}`;

/** Deep-link into the reader for a raw reference, e.g. "/bible?ref=John%203%3A16". */
export function bibleHref(raw: string): string {
  return `/bible?ref=${encodeURIComponent(raw)}`;
}

function push(index: ScriptureIndex, raw: string, base: Omit<CrossRef, 'raw' | 'verseStart' | 'verseEnd'>) {
  const ref = parseScriptureRef(raw);
  if (!ref) return; // build-content already rejects unparseable refs; ignore defensively
  const key = chapterKey(ref.book, ref.chapter);
  const entry: CrossRef = {
    ...base,
    raw,
    verseStart: ref.verseStart,
    verseEnd: ref.verseEnd ?? ref.verseStart,
  };
  const list = index.byChapter.get(key);
  if (list) list.push(entry);
  else index.byChapter.set(key, [entry]);

  const chapters = index.chaptersWithRefs.get(ref.book);
  if (chapters) chapters.add(ref.chapter);
  else index.chaptersWithRefs.set(ref.book, new Set([ref.chapter]));
  index.booksWithRefs.add(ref.book);
}

export function buildScriptureIndex(bundle: BundleIndex): ScriptureIndex {
  const index: ScriptureIndex = {
    byChapter: new Map(),
    chaptersWithRefs: new Map(),
    booksWithRefs: new Set(),
  };

  for (const stop of bundle.stops) {
    const journey = bundle.journey(stop.journeyId);
    const site = bundle.site(stop.siteId);
    const label = stop.title?.en ?? site?.ancientName.en ?? stop.siteId;
    for (const raw of stop.scriptureRefs) {
      push(index, raw, {
        kind: 'stop',
        id: stop.id,
        label,
        detail: journey ? `${journey.title.en} · ${stop.dateRange.display.en}` : stop.dateRange.display.en,
        journeyId: stop.journeyId,
        siteId: stop.siteId,
        stopOrder: stop.order,
      });
    }
  }

  for (const m of bundle.miracles ?? []) {
    for (const raw of m.scriptureRefs) {
      push(index, raw, {
        kind: 'miracle',
        id: m.id,
        label: m.title.en,
        detail: `${m.performerLabel.en} · ${bundle.site(m.siteId)?.ancientName.en ?? m.siteId}`,
        siteId: m.siteId,
        personId: m.performerIds?.[0],
      });
    }
  }

  for (const b of bundle.battles ?? []) {
    for (const raw of b.scriptureRefs) {
      push(index, raw, {
        kind: 'battle',
        id: b.id,
        label: b.title.en,
        detail: `${b.combatants.en} · ${b.dateRange.display.en}`,
        siteId: b.siteId,
      });
    }
  }

  for (const p of bundle.persons) {
    for (const raw of p.scriptureRefs) {
      push(index, raw, {
        kind: 'person',
        id: p.id,
        label: p.name.en,
        detail: p.role.en,
        personId: p.id,
        siteId: p.homeSiteId,
        journeyId: p.journeyIds?.[0],
      });
    }
  }

  for (const l of bundle.lessons) {
    l.steps.forEach((step, i) => {
      for (const raw of step.scriptureRefs ?? []) {
        push(index, raw, {
          kind: 'lesson',
          id: `${l.id}:${i}`,
          label: l.title.en,
          detail: `Step ${i + 1}`,
          lessonId: l.id,
          siteId: step.siteId,
        });
      }
    });
  }

  return index;
}

/** Cross-references in a chapter, most specific first (narrowest span wins). */
export function refsForChapter(index: ScriptureIndex, book: number, chapter: number): CrossRef[] {
  const list = index.byChapter.get(chapterKey(book, chapter)) ?? [];
  return [...list].sort(
    (a, b) => a.verseStart - b.verseStart || a.verseEnd - a.verseStart - (b.verseEnd - b.verseStart),
  );
}

/** Verse numbers in a chapter that carry at least one cross-reference. */
export function markedVerses(refs: CrossRef[]): Set<number> {
  const marked = new Set<number>();
  for (const r of refs) for (let v = r.verseStart; v <= r.verseEnd; v++) marked.add(v);
  return marked;
}

/** Canonical "Book chapter:verse" label for a stored note or highlight. */
export function verseLabel(book: number, chapter: number, verse: number): string {
  return `${bookNameFromNumber(book) ?? `Book ${book}`} ${chapter}:${verse}`;
}
