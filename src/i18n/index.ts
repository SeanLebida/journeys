import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

// v1 ships English only, but the locale dimension is reserved everywhere
// (content LocalizedText fields + this i18n layer) so additional languages are
// a data/resource add, never a schema migration.
export const SUPPORTED_LOCALES = ['en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES as unknown as string[],
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
