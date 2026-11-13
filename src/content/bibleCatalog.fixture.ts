import type { CatalogVersion } from './bibleCatalog';

/**
 * DEV FIXTURE, not real versions. Loaded only by `npm run dev` with
 * `?catalogFixture` in the URL, to lay out states the live data can't show yet
 * (read-online-only licensed versions, a second licensed language). Production
 * builds never include this module.
 */
const base = {
  source: 'youversion',
  access: 'online',
  installed: false,
  rtl: false,
  coverage: 'full',
  license: 'Used by permission (online only)',
  fixture: true,
} as const;

export const CATALOG_FIXTURE: CatalogVersion[] = [
  {
    ...base,
    id: 'yv:fixture-1',
    abbreviation: 'FIX1',
    name: 'Fixture: online-only English version',
    language: 'eng',
    languageName: 'English',
    publisher: 'Fixture Publisher',
    copyright: 'FIXTURE copyright notice.\nNot a real Bible version.',
  },
  {
    ...base,
    id: 'yv:fixture-2',
    abbreviation: 'FIX2',
    name: 'Fixture: a much longer online-only version title that has to wrap at 360px',
    language: 'eng',
    languageName: 'English',
    publisher: 'Fixture Publisher',
  },
  {
    ...base,
    id: 'yv:fixture-3',
    abbreviation: 'FIX-ES',
    name: 'Fixture: versión en línea',
    language: 'spa',
    languageName: 'Spanish',
    publisher: 'Fixture Publisher',
  },
];
