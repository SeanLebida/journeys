// Canonical Protestant 66-book ordering and numbering (v1 canon decision).
// Deuterocanon is deferred; numbers 67+ are reserved so a future Sirach ref
// does not orphan refs authored under the 66-book setting.
export interface BookDef {
  num: number;
  name: string;
  abbrevs: string[];
}

export const BOOKS: readonly BookDef[] = [
  { num: 1, name: 'Genesis', abbrevs: ['gen', 'ge', 'gn'] },
  { num: 2, name: 'Exodus', abbrevs: ['exo', 'ex', 'exod'] },
  { num: 3, name: 'Leviticus', abbrevs: ['lev', 'le', 'lv'] },
  { num: 4, name: 'Numbers', abbrevs: ['num', 'nu', 'nm', 'nb'] },
  { num: 5, name: 'Deuteronomy', abbrevs: ['deut', 'dt', 'de'] },
  { num: 6, name: 'Joshua', abbrevs: ['josh', 'jos', 'jsh'] },
  { num: 7, name: 'Judges', abbrevs: ['judg', 'jdg', 'jg', 'jdgs'] },
  { num: 8, name: 'Ruth', abbrevs: ['ruth', 'rth', 'ru'] },
  { num: 9, name: '1 Samuel', abbrevs: ['1sam', '1sa', '1s', '1 sm'] },
  { num: 10, name: '2 Samuel', abbrevs: ['2sam', '2sa', '2s', '2 sm'] },
  { num: 11, name: '1 Kings', abbrevs: ['1kings', '1ki', '1kgs', '1k'] },
  { num: 12, name: '2 Kings', abbrevs: ['2kings', '2ki', '2kgs', '2k'] },
  { num: 13, name: '1 Chronicles', abbrevs: ['1chron', '1chr', '1ch'] },
  { num: 14, name: '2 Chronicles', abbrevs: ['2chron', '2chr', '2ch'] },
  { num: 15, name: 'Ezra', abbrevs: ['ezra', 'ezr', 'ez'] },
  { num: 16, name: 'Nehemiah', abbrevs: ['neh', 'ne'] },
  { num: 17, name: 'Esther', abbrevs: ['est', 'esth', 'es'] },
  { num: 18, name: 'Job', abbrevs: ['job', 'jb'] },
  { num: 19, name: 'Psalms', abbrevs: ['ps', 'psa', 'psalm', 'pss'] },
  { num: 20, name: 'Proverbs', abbrevs: ['prov', 'pro', 'prv', 'pr'] },
  { num: 21, name: 'Ecclesiastes', abbrevs: ['eccl', 'ecc', 'eccles', 'qoh'] },
  { num: 22, name: 'Song of Solomon', abbrevs: ['song', 'sos', 'sng', 'so', 'song of songs', 'canticles'] },
  { num: 23, name: 'Isaiah', abbrevs: ['isa', 'is'] },
  { num: 24, name: 'Jeremiah', abbrevs: ['jer', 'je', 'jr'] },
  { num: 25, name: 'Lamentations', abbrevs: ['lam', 'la'] },
  { num: 26, name: 'Ezekiel', abbrevs: ['ezek', 'eze', 'ezk'] },
  { num: 27, name: 'Daniel', abbrevs: ['dan', 'da', 'dn'] },
  { num: 28, name: 'Hosea', abbrevs: ['hos', 'ho'] },
  { num: 29, name: 'Joel', abbrevs: ['joel', 'joe', 'jl'] },
  { num: 30, name: 'Amos', abbrevs: ['amos', 'am'] },
  { num: 31, name: 'Obadiah', abbrevs: ['obad', 'oba', 'ob'] },
  { num: 32, name: 'Jonah', abbrevs: ['jonah', 'jon', 'jnh'] },
  { num: 33, name: 'Micah', abbrevs: ['mic', 'mc'] },
  { num: 34, name: 'Nahum', abbrevs: ['nah', 'na'] },
  { num: 35, name: 'Habakkuk', abbrevs: ['hab', 'hb'] },
  { num: 36, name: 'Zephaniah', abbrevs: ['zeph', 'zep', 'zp'] },
  { num: 37, name: 'Haggai', abbrevs: ['hag', 'hg'] },
  { num: 38, name: 'Zechariah', abbrevs: ['zech', 'zec', 'zc'] },
  { num: 39, name: 'Malachi', abbrevs: ['mal', 'ml'] },
  { num: 40, name: 'Matthew', abbrevs: ['matt', 'mat', 'mt'] },
  { num: 41, name: 'Mark', abbrevs: ['mark', 'mrk', 'mk', 'mr'] },
  { num: 42, name: 'Luke', abbrevs: ['luke', 'luk', 'lk'] },
  { num: 43, name: 'John', abbrevs: ['john', 'jhn', 'jn'] },
  { num: 44, name: 'Acts', abbrevs: ['acts', 'act', 'ac'] },
  { num: 45, name: 'Romans', abbrevs: ['rom', 'ro', 'rm'] },
  { num: 46, name: '1 Corinthians', abbrevs: ['1cor', '1co', '1 c'] },
  { num: 47, name: '2 Corinthians', abbrevs: ['2cor', '2co', '2 c'] },
  { num: 48, name: 'Galatians', abbrevs: ['gal', 'ga'] },
  { num: 49, name: 'Ephesians', abbrevs: ['eph', 'ephes'] },
  { num: 50, name: 'Philippians', abbrevs: ['phil', 'php', 'pp'] },
  { num: 51, name: 'Colossians', abbrevs: ['col', 'co'] },
  { num: 52, name: '1 Thessalonians', abbrevs: ['1thess', '1thes', '1th'] },
  { num: 53, name: '2 Thessalonians', abbrevs: ['2thess', '2thes', '2th'] },
  { num: 54, name: '1 Timothy', abbrevs: ['1tim', '1ti', '1tm'] },
  { num: 55, name: '2 Timothy', abbrevs: ['2tim', '2ti', '2tm'] },
  { num: 56, name: 'Titus', abbrevs: ['titus', 'tit', 'ti'] },
  { num: 57, name: 'Philemon', abbrevs: ['philem', 'phlm', 'phm', 'pm'] },
  { num: 58, name: 'Hebrews', abbrevs: ['heb', 'hb'] },
  { num: 59, name: 'James', abbrevs: ['james', 'jas', 'jm'] },
  { num: 60, name: '1 Peter', abbrevs: ['1pet', '1pe', '1pt', '1p'] },
  { num: 61, name: '2 Peter', abbrevs: ['2pet', '2pe', '2pt', '2p'] },
  { num: 62, name: '1 John', abbrevs: ['1john', '1jn', '1jo', '1j'] },
  { num: 63, name: '2 John', abbrevs: ['2john', '2jn', '2jo', '2j'] },
  { num: 64, name: '3 John', abbrevs: ['3john', '3jn', '3jo', '3j'] },
  { num: 65, name: 'Jude', abbrevs: ['jude', 'jud', 'jd'] },
  { num: 66, name: 'Revelation', abbrevs: ['rev', 're', 'rv', 'apocalypse'] },
] as const;

/** Normalize a book token: lowercase, collapse whitespace, strip periods. */
function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const BOOK_LOOKUP: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const b of BOOKS) {
    m.set(normalizeKey(b.name), b.num);
    m.set(normalizeKey(b.name).replace(/\s+/g, ''), b.num);
    for (const a of b.abbrevs) {
      m.set(normalizeKey(a), b.num);
      m.set(normalizeKey(a).replace(/\s+/g, ''), b.num);
    }
  }
  return m;
})();

export function bookNumberFromName(name: string): number | null {
  const key = normalizeKey(name);
  return BOOK_LOOKUP.get(key) ?? BOOK_LOOKUP.get(key.replace(/\s+/g, '')) ?? null;
}

export function bookNameFromNumber(num: number): string | null {
  return BOOKS.find((b) => b.num === num)?.name ?? null;
}
