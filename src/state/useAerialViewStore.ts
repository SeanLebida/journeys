import { create } from 'zustand';

// Transient (not persisted): tracks whether an in-app aerial "view from above"
// is active and which site it centers on, so MapProvider can overlay a
// present-day marker on the map surface while it runs. AerialViewButton owns
// the actual camera/satellite toggling; this only mirrors the active site name.
interface AerialViewState {
  /** Name of the site currently shown in aerial view, or null when inactive. */
  activeSite: string | null;
  setActiveSite: (name: string | null) => void;
}

export const useAerialViewStore = create<AerialViewState>((set) => ({
  activeSite: null,
  setActiveSite: (activeSite) => set({ activeSite }),
}));
