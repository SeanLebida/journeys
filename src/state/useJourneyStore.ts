import { create } from 'zustand';

interface JourneyState {
  activeJourneyId: string | null;
  activeStopId: string | null;
  /** Animation progress along the active journey, 0..1. */
  progress: number;
  playing: boolean;
  playbackSpeed: number; // e.g., 0.5, 1, 1.5, 2
  pauseAtStops: boolean;
  setActiveJourney: (journeyId: string | null) => void;
  setActiveStop: (stopId: string | null) => void;
  setProgress: (progress: number) => void;
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
  playing: false,
  playbackSpeed: 1,
  pauseAtStops: false,
  setActiveJourney: (activeJourneyId) => set({ activeJourneyId, progress: 0, playing: false }),
  setActiveStop: (activeStopId) => set({ activeStopId }),
  setProgress: (progress) => set({ progress: Math.min(1, Math.max(0, progress)) }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  reset: () => set({ progress: 0, playing: false, activeStopId: null }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setPauseAtStops: (pauseAtStops) => set({ pauseAtStops }),
}));
