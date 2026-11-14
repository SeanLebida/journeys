import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n';
import { DEFAULT_TRANSLATION, isTranslation, type Translation, type TranslationId } from '../content/translations';
import type { DownloadedTranslation } from '../content/downloads';

/**
 * A YouVersion version the reader chose to read online (not stored). Only
 * these labels persist, never its text, so the picker can show it again.
 */
export interface StreamedTranslation {
  id: `yv:${number}`;
  yvId: number;
  name: string;
  shortName: string;
  languageTag: string;
  rtl: boolean;
  publisher: string | null;
  publisherUrl: string | null;
  /** Copyright notice shown with the text. */
  notice: string | null;
}

export type { Translation, TranslationId };

export type Theme = 'system' | 'light' | 'dark';

interface UiState {
  theme: Theme;
  locale: AppLocale;
  translation: TranslationId;
  /** Translations downloaded onto this device; their text lives in bibleStore. */
  downloaded: DownloadedTranslation[];
  /** YouVersion versions picked for reading online; text is never stored. */
  streamed: StreamedTranslation[];
  /** Last few translations the reader switched to, newest first (the version picker's "Recent"). */
  recentTranslations: TranslationId[];
  /** Bible languages the reader picked in the version picker, newest first. */
  recentLanguages: string[];
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
  addStreamed: (t: StreamedTranslation) => void;
  removeStreamed: (id: TranslationId) => void;
  addRecentLanguage: (tag: string) => void;
  setTimelineFold: (on: boolean) => void;
}

// UI preferences persist across launches; map instance and transient view state
// do NOT live here (see useJourneyStore / MapProvider ref).
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      downloaded: [],
      streamed: [],
      recentTranslations: [],
      recentLanguages: [],
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
          recentTranslations: s.streamed.some((x) => x.id === id) ? s.recentTranslations : s.recentTranslations.filter((t) => t !== id),
          translation: s.translation === id ? DEFAULT_TRANSLATION : s.translation,
        })),
      addStreamed: (t) => set((s) => ({ streamed: [...s.streamed.filter((x) => x.id !== t.id), t] })),
      removeStreamed: (id) =>
        set((s) => ({
          streamed: s.streamed.filter((x) => x.id !== id),
          recentTranslations: s.downloaded.some((d) => d.id === id) ? s.recentTranslations : s.recentTranslations.filter((t) => t !== id),
          translation:
            s.translation === id && !s.downloaded.some((d) => d.id === id) ? DEFAULT_TRANSLATION : s.translation,
        })),
      addRecentLanguage: (tag) => set((s) => ({ recentLanguages: [tag, ...s.recentLanguages.filter((t) => t !== tag)].slice(0, 4) })),
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
        const streamed = Array.isArray(saved.streamed) ? saved.streamed : [];
        const isKnown = (t: unknown) => isTranslation(t) || downloaded.some((d) => d.id === t) || streamed.some((d) => d.id === t);
        const known = isKnown(saved.translation);
        const recentTranslations = Array.isArray(saved.recentTranslations) ? saved.recentTranslations.filter(isKnown) : [];
        return {
          ...current,
          ...saved,
          downloaded,
          streamed,
          recentTranslations,
          translation: known && saved.translation ? saved.translation : current.translation,
        };
      },
    },
  ),
);

/** A translation the reader can open right now: bundled, downloaded, or picked to read online. */
export function isOpenableTranslation(id: string, state: Pick<UiState, 'downloaded' | 'streamed'> = useUiStore.getState()): id is TranslationId {
  return isTranslation(id) || state.downloaded.some((d) => d.id === id) || state.streamed.some((d) => d.id === id);
}

/** The YouVersion id to stream for a translation, or null when it is bundled or downloaded. */
export function streamedYvId(id: TranslationId, state: Pick<UiState, 'downloaded' | 'streamed'> = useUiStore.getState()): number | null {
  if (state.downloaded.some((d) => d.id === id)) return null;
  const t = state.streamed.find((d) => d.id === id);
  return t ? t.yvId : null;
}
