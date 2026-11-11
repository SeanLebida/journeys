/**
 * Flattens a HelloAO Free Use Bible API `complete.json` translation into plain
 * verse rows. Verse content mixes plain strings with styled runs (poetry lines,
 * words of Jesus, superscriptions), footnote markers and line breaks; the reader
 * renders one plain string per verse, so runs join with a space and markers drop.
 */
export type HelloAoContent =
  | string
  | { text: string; poem?: number; wordsOfJesus?: boolean; descriptive?: boolean }
  | { noteId: number }
  | { lineBreak: true; paragraph?: string }
  | { heading: string };

interface HelloAoItem {
  type: string;
  number?: number;
  content?: HelloAoContent[];
}

export interface HelloAoTranslation {
  translation: { id: string; numberOfBooks: number; totalNumberOfVerses: number };
  books: { id: string; order: number; chapters: { chapter: { number: number; content: HelloAoItem[] } }[] }[];
}

export interface PlainVerse {
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

export function verseText(parts: HelloAoContent[]): string {
  return parts
    .map((p) => (typeof p === 'string' ? p : 'text' in p ? p.text : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?’”)])/g, '$1')
    .trim();
}

export function flattenHelloAo(data: HelloAoTranslation): PlainVerse[] {
  const rows: PlainVerse[] = [];
  for (const book of data.books) {
    for (const { chapter } of book.chapters) {
      for (const item of chapter.content) {
        if (item.type !== 'verse' || item.number == null || !item.content) continue;
        const text = verseText(item.content);
        if (text) rows.push({ book: book.order, chapter: chapter.number, verse: item.number, text });
      }
    }
  }
  return rows;
}
