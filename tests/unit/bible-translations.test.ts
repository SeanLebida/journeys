import { describe, expect, it } from 'vitest';
import { flattenHelloAo, verseText, type HelloAoTranslation } from '../../src/content/helloao';
import { DEFAULT_TRANSLATION, TRANSLATIONS, isTranslation, translationInfo } from '../../src/content/translations';

describe('bundled translations', () => {
  it('offers each translation once, with a file and a public-domain license', () => {
    const ids = TRANSLATIONS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TRANSLATIONS) {
      expect(t.file).toMatch(/\.sqlite$/);
      expect(t.license).toMatch(/public domain/i);
    }
    expect(ids).toEqual(expect.arrayContaining(['ASV', 'KJV', 'BSB', 'WEB', 'YLT', 'GNV']));
  });

  it('keeps the default and recognises only bundled ids', () => {
    expect(isTranslation(DEFAULT_TRANSLATION)).toBe(true);
    expect(isTranslation('BSB')).toBe(true);
    expect(isTranslation('NIV')).toBe(false);
    expect(isTranslation(undefined)).toBe(false);
    expect(translationInfo('WEB').name).toBe('World English Bible');
  });
});

describe('HelloAO verse flattening', () => {
  it('joins styled runs and drops footnote and line-break markers', () => {
    expect(
      verseText([
        { text: 'So God created man in His own image;', poem: 1 },
        { noteId: 3 },
        { lineBreak: true },
        { text: 'in the image of God He created him', poem: 2 },
        ',',
      ]),
    ).toBe('So God created man in His own image; in the image of God He created him,');
    expect(verseText(['Jesus said,', { text: '“Follow me.”', wordsOfJesus: true }])).toBe('Jesus said, “Follow me.”');
  });

  it('numbers books by canonical order and skips headings', () => {
    const data: HelloAoTranslation = {
      translation: { id: 'X', numberOfBooks: 2, totalNumberOfVerses: 2 },
      books: [
        {
          id: 'JHN',
          order: 43,
          chapters: [
            {
              chapter: {
                number: 11,
                content: [
                  { type: 'heading', content: ['The Death of Lazarus'] },
                  { type: 'verse', number: 35, content: ['Jesus wept.'] },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(flattenHelloAo(data)).toEqual([{ book: 43, chapter: 11, verse: 35, text: 'Jesus wept.' }]);
  });
});
