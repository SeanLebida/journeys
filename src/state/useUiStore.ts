import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n';

export type Theme = 'system' | 'light' | 'dark';
export type Translation = 'ASV' | 'KJV';

interface UiState {
  theme: Theme;
  locale: AppLocale;
  translation: Translation;
  setTheme: (t: Theme) => void;
  setLocale: (l: AppLocale) => void;
  setTranslation: (t: Translation) => void;
}

// UI preferences persist across launches; map instance and transient view state
// do NOT live here (see useJourneyStore / MapProvider ref).
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      locale: DEFAULT_LOCALE,
      translation: 'ASV',
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setTranslation: (translation) => set({ translation }),
    }),
    {
      name: 'journeys-ui',
      storage: createJSONStorage(() => platformStorage),
    },
  ),
);
