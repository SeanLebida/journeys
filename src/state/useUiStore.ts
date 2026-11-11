import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n';
import { DEFAULT_TRANSLATION, isTranslation, type Translation } from '../content/translations';

export type { Translation };

export type Theme = 'system' | 'light' | 'dark';

interface UiState {
  theme: Theme;
  locale: AppLocale;
  translation: Translation;
  /**
   * The timeline's fold-out chart effect. On by default, and independently
   * overridden by `prefers-reduced-motion` — this is the explicit opt-out for a
   * reader who finds it distracting without having changed an OS setting.
   */
  timelineFold: boolean;
  setTheme: (t: Theme) => void;
  setLocale: (l: AppLocale) => void;
  setTranslation: (t: Translation) => void;
  setTimelineFold: (on: boolean) => void;
}

// UI preferences persist across launches; map instance and transient view state
// do NOT live here (see useJourneyStore / MapProvider ref).
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      locale: DEFAULT_LOCALE,
      translation: DEFAULT_TRANSLATION,
      timelineFold: true,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setTranslation: (translation) => set({ translation }),
      setTimelineFold: (timelineFold) => set({ timelineFold }),
    }),
    {
      name: 'journeys-ui',
      storage: createJSONStorage(() => platformStorage),
      // A saved translation that is no longer bundled falls back to the default
      // instead of leaving the reader on a text it cannot load.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<UiState>;
        return {
          ...current,
          ...saved,
          translation: isTranslation(saved.translation) ? saved.translation : current.translation,
        };
      },
    },
  ),
);
