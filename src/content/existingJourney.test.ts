import { describe, expect, it } from 'vitest';
import { existingJourneyId, firstExistingJourneyId } from './existingJourney';

const bundle = {
  journey: (id: string) => (id === 'journey-real' || id === 'journey-other' ? { id } : undefined),
};

describe('existingJourneyId', () => {
  it('returns the id when the bundle has that journey', () => {
    expect(existingJourneyId(bundle, 'journey-real')).toBe('journey-real');
  });

  it('returns undefined when the id is missing or unknown', () => {
    expect(existingJourneyId(bundle, undefined)).toBeUndefined();
    expect(existingJourneyId(bundle, 'journey-gone')).toBeUndefined();
  });
});

describe('firstExistingJourneyId', () => {
  it('skips unknown ids and returns the first real journey', () => {
    expect(firstExistingJourneyId(bundle, ['journey-gone', 'journey-other'])).toBe('journey-other');
  });

  it('returns undefined when none of the ids exist', () => {
    expect(firstExistingJourneyId(bundle, ['journey-gone'])).toBeUndefined();
    expect(firstExistingJourneyId(bundle, undefined)).toBeUndefined();
  });
});
