import { create } from 'zustand';

interface JourneyState {
  activeJourneyId: string | null;
  activeStopId: string | null;
  /** Current stop index (0-based) within the active journey. */
  currentStopIdx: number;
  /** Target stop index being traveled to, or null when stationary. */
  targetStopIdx: number | null;
  /** Animation progress along the active journey, 0..1 (drives the trace line). */
  progress: number;
  setActiveJourney: (journeyId: string | null) => void;
  setActiveStop: (stopId: string | null) => void;
  setCurrentStopIdx: (idx: number) => void;
  setTargetStopIdx: (idx: number | null) => void;
  setProgress: (progress: number) => void;
  reset: () => void;
}

export const useJourneyStore = create<JourneyState>((set) => ({
  activeJourneyId: null,
  activeStopId: null,
  currentStopIdx: 0,
  targetStopIdx: null,
  progress: 0,
  setActiveJourney: (activeJourneyId) =>
    set({ activeJourneyId, currentStopIdx: 0, targetStopIdx: null, progress: 0 }),
  setActiveStop: (activeStopId) => set({ activeStopId }),
  setCurrentStopIdx: (currentStopIdx) => set({ currentStopIdx }),
  setTargetStopIdx: (targetStopIdx) => set({ targetStopIdx }),
  setProgress: (progress) =>
    set(() => {
      const p = Math.min(1, Math.max(0, progress));
      return { progress: p };
    }),
  reset: () =>
    set({ currentStopIdx: 0, targetStopIdx: null, progress: 0, activeStopId: null }),
}));
