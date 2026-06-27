import { create } from 'zustand';

interface JourneyState {
  activeJourneyId: string | null;
  activeStopId: string | null;
  activeStopIndex: number;
  stopCount: number;
  progress: number;
  playing: boolean;
  transitioning: boolean;
  panelExpanded: boolean;
  setActiveJourney: (journeyId: string | null) => void;
  setActiveStop: (stopId: string | null) => void;
  setActiveStopIndex: (index: number) => void;
  setStopCount: (count: number) => void;
  setProgress: (progress: number) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  goToStop: (index: number) => void;
  nextStop: () => void;
  prevStop: () => void;
  setTransitioning: (v: boolean) => void;
  setPanelExpanded: (v: boolean) => void;
}

export const useJourneyStore = create<JourneyState>((set, get) => ({
  activeJourneyId: null,
  activeStopId: null,
  activeStopIndex: 0,
  stopCount: 0,
  progress: 0,
  playing: false,
  transitioning: false,
  panelExpanded: false,
  setActiveJourney: (activeJourneyId) =>
    set({ activeJourneyId, progress: 0, playing: false, activeStopIndex: 0, activeStopId: null, panelExpanded: false }),
  setActiveStop: (activeStopId) => set({ activeStopId }),
  setActiveStopIndex: (index) => set({ activeStopIndex: index }),
  setStopCount: (count) => set({ stopCount: count }),
  setProgress: (progress) => set({ progress: Math.min(1, Math.max(0, progress)) }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  reset: () => set({ progress: 0, playing: false, activeStopId: null, activeStopIndex: 0, panelExpanded: false }),
  goToStop: (index) => {
    const { stopCount } = get();
    const clamped = Math.max(0, Math.min(stopCount - 1, index));
    set({ activeStopIndex: clamped, transitioning: true });
  },
  nextStop: () => {
    const { activeStopIndex, stopCount } = get();
    if (activeStopIndex < stopCount - 1) {
      set({ activeStopIndex: activeStopIndex + 1, transitioning: true });
    }
  },
  prevStop: () => {
    const { activeStopIndex } = get();
    if (activeStopIndex > 0) {
      set({ activeStopIndex: activeStopIndex - 1, transitioning: true });
    }
  },
  setTransitioning: (transitioning) => set({ transitioning }),
  setPanelExpanded: (panelExpanded) => set({ panelExpanded }),
}));
