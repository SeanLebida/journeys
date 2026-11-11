/**
 * The Bible translations bundled in the app: one list shared by the content
 * build (what gets compiled) and the reader (what can be picked), so a
 * translation can never be offered without its text shipping, or ship without
 * being offered.
 *
 * Every entry must be public domain: the text is redistributed inside the app.
 * KJV and ASV keep their original shared database; the rest each get their own
 * file so the reader only loads the text it is showing.
 */
export const TRANSLATIONS = [
  {
    id: 'ASV',
    name: 'American Standard Version (1901)',
    file: 'content.sqlite',
    source: { kind: 'bibleapi', url: 'https://raw.githubusercontent.com/bibleapi/bibleapi-bibles-json/master/asv.json' },
    license: 'Public Domain',
    infoUrl: 'https://en.wikipedia.org/wiki/American_Standard_Version',
  },
  {
    id: 'KJV',
    name: 'King James Version',
    file: 'content.sqlite',
    source: { kind: 'bibleapi', url: 'https://raw.githubusercontent.com/bibleapi/bibleapi-bibles-json/master/kjv.json' },
    license: 'Public Domain (UK: Crown copyright)',
    infoUrl: 'https://en.wikipedia.org/wiki/King_James_Version',
  },
  {
    id: 'BSB',
    name: 'Berean Standard Bible',
    file: 'bible-bsb.sqlite',
    source: { kind: 'helloao', url: 'https://bible.helloao.org/api/BSB/complete.json' },
    license: 'Public Domain (dedicated 2023)',
    infoUrl: 'https://berean.bible/',
  },
  {
    id: 'WEB',
    name: 'World English Bible',
    file: 'bible-web.sqlite',
    source: { kind: 'helloao', url: 'https://bible.helloao.org/api/ENGWEBP/complete.json' },
    license: 'Public Domain',
    infoUrl: 'https://ebible.org/Scriptures/details.php?id=engwebp',
  },
  {
    id: 'YLT',
    name: "Young's Literal Translation",
    file: 'bible-ylt.sqlite',
    source: { kind: 'helloao', url: 'https://bible.helloao.org/api/eng_ylt/complete.json' },
    license: 'Public Domain',
    infoUrl: 'https://ebible.org/Scriptures/details.php?id=engylt',
  },
  {
    id: 'GNV',
    name: 'Geneva Bible (1599)',
    file: 'bible-gnv.sqlite',
    source: { kind: 'helloao', url: 'https://bible.helloao.org/api/eng_gnv/complete.json' },
    license: 'Public Domain',
    infoUrl: 'https://ebible.org/Scriptures/details.php?id=enggnv',
  },
] as const;

export type TranslationInfo = (typeof TRANSLATIONS)[number];
export type Translation = TranslationInfo['id'];

export const DEFAULT_TRANSLATION: Translation = 'ASV';

const BY_ID = new Map<string, TranslationInfo>(TRANSLATIONS.map((t) => [t.id, t]));

export function isTranslation(value: unknown): value is Translation {
  return typeof value === 'string' && BY_ID.has(value);
}

export function translationInfo(id: Translation): TranslationInfo {
  // Safe: `Translation` is derived from TRANSLATIONS, so every id is present.
  return BY_ID.get(id)!;
}
