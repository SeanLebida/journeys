import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n';
import { DEFAULT_TRANSLATION, isTranslation, type Translation, type TranslationId } from '../content/translations';
import type { DownloadedTranslation } from '../content/downloads';

export type { Translation, TranslationId };

export type Theme = 'system' | 'light' | 'dark';

interface UiState {
  theme: Theme;
  locale: AppLocale;
  translation: TranslationId;
  /** Translations downloaded onto this device; their text lives in bibleStore. */
  downloaded: DownloadedTranslation[];
  /** Last few translations the reader switched to, newest first (the version picker's "Recently used"). */
  recentTranslations: TranslationId[];
  /**
   * The timeline's fold-out chart effect. On by default, and independently
   * overridden by `prefers-reduced-motion` — this is the explicit opt-out for a
   * reader who finds it distracting without having changed an OS setting.
   */
  timelineFold: boolean;
  setTheme: (t: Theme) => void;
  setLocale: (l: AppLocale) => void;
  setTranslation: (t: TranslationId) => void;
  addDownloaded: (t: DownloadedTranslation) => void;
  /** Forget a downloaded translation; the reader falls back to the default if it was showing it. */
  removeDownloaded: (id: TranslationId) => void;
  setTimelineFold: (on: boolean) => void;
}

// UI preferences persist across launches; map instance and transient view state
// do NOT live here (see useJourneyStore / MapProvider ref).
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      downloaded: [],
      recentTranslations: [],
      theme: 'system',
      locale: DEFAULT_LOCALE,
      translation: DEFAULT_TRANSLATION,
      timelineFold: true,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setTranslation: (translation) =>
        set((s) => ({ translation, recentTranslations: [translation, ...s.recentTranslations.filter((t) => t !== translation)].slice(0, 4) })),
      addDownloaded: (t) =>
        set((s) => ({ downloaded: [...s.downloaded.filter((d) => d.id !== t.id), t] })),
      removeDownloaded: (id) =>
        set((s) => ({
          downloaded: s.downloaded.filter((d) => d.id !== id),
          recentTranslations: s.recentTranslations.filter((t) => t !== id),
          translation: s.translation === id ? DEFAULT_TRANSLATION : s.translation,
        })),
      setTimelineFold: (timelineFold) => set({ timelineFold }),
    }),
    {
      name: 'journeys-ui',
      storage: createJSONStorage(() => platformStorage),
      // A saved translation that is neither bundled nor downloaded falls back to
      // the default instead of leaving the reader on a text it cannot load.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<UiState>;
        const downloaded = Array.isArray(saved.downloaded) ? saved.downloaded : [];
        const isKnown = (t: unknown) => isTranslation(t) || downloaded.some((d) => d.id === t);
        const known = isKnown(saved.translation);
        const recentTranslations = Array.isArray(saved.recentTranslations) ? saved.recentTranslations.filter(isKnown) : [];
        return {
          ...current,
          ...saved,
          downloaded,
          recentTranslations,
          translation: known && saved.translation ? saved.translation : current.translation,
        };
      },
    },
  ),
);
