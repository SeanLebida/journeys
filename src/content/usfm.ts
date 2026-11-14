/** USFM book codes in Protestant canon order; index + 1 is the app's book number (see books.ts). */
export const USFM_BOOKS = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH',
  'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON',
  'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL',
  'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN',
  'JUD', 'REV',
] as const;

const NUM_BY_CODE = new Map<string, number>(USFM_BOOKS.map((c, i) => [c, i + 1]));

/** The app's book number for a USFM code, or undefined for books outside the 66-book canon. */
export function bookNumberFromUsfm(code: string): number | undefined {
  return NUM_BY_CODE.get(code.toUpperCase());
}
