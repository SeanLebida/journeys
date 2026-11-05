import { describe, expect, it } from 'vitest';
import { useJourneyStore } from './useJourneyStore';

describe('openAtStop', () => {
  it('opens a route at the saved stop', () => {
    useJourneyStore.getState().openAtStop('paul', 3);
    expect(useJourneyStore.getState().activeJourneyId).toBe('paul');
    expect(useJourneyStore.getState().currentStopIdx).toBe(3);
    expect(useJourneyStore.getState().targetStopIdx).toBeNull();
    expect(useJourneyStore.getState().progress).toBe(0);
  });

  it('does not zero a stop the way setActiveJourney does', () => {
    useJourneyStore.getState().openAtStop('paul', 3);
    useJourneyStore.getState().setActiveJourney('paul');
    expect(useJourneyStore.getState().currentStopIdx).toBe(0);
    useJourneyStore.getState().openAtStop('paul', 3);
    expect(useJourneyStore.getState().currentStopIdx).toBe(3);
  });
});
