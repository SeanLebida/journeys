import { create } from 'zustand';

interface JourneyState {
  activeJourneyId: string | null;
  activeStopId: string | null;
  /** Animation progress along the active journey, 0..1. */
  progress: number;
  /**
   * How many co-located stops have been consumed at the current `progress`.
   * Consecutive stops at the same place share a progress fraction exactly, so
   * progress alone cannot tell them apart; this is what walks through them.
   * Resets whenever progress actually moves.
   */
  tieOffset: number;
  playing: boolean;
  playbackSpeed: number; // e.g., 0.5, 1, 1.5, 2
  pauseAtStops: boolean;
  setActiveJourney: (journeyId: string | null) => void;
  setActiveStop: (stopId: string | null) => void;
  setProgress: (progress: number) => void;
  advanceTie: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setPauseAtStops: (pauseAtStops: boolean) => void;
}

// Transient route-tracing state (not persisted). Lives outside React render so
// the rAF animation loop in useRouteAnimation can read/write without re-render
// churn; components subscribe to the slices they need.
export const useJourneyStore = create<JourneyState>((set) => ({
  activeJourneyId: null,
  activeStopId: null,
  progress: 0,
  tieOffset: 0,
  playing: false,
  playbackSpeed: 1,
  // Default ON: the guided trace pauses at each stop so the reader can absorb it
  // before moving on. Users can uncheck it for a continuous fly-through.
  pauseAtStops: true,
  setActiveJourney: (activeJourneyId) => set({ activeJourneyId, progress: 0, tieOffset: 0, playing: false }),
  setActiveStop: (activeStopId) => set({ activeStopId }),
  // Moving the traveler invalidates any tie walk in progress; holding position
  // (a clamped frame at a stop) must NOT, or the walk restarts every frame.
  setProgress: (progress) =>
    set((s) => {
      const p = Math.min(1, Math.max(0, progress));
      return p === s.progress ? { progress: p } : { progress: p, tieOffset: 0 };
    }),
  advanceTie: () => set((s) => ({ tieOffset: s.tieOffset + 1 })),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  reset: () => set({ progress: 0, tieOffset: 0, playing: false, activeStopId: null }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setPauseAtStops: (pauseAtStops) => set({ pauseAtStops }),
}));
