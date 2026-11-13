import { describe, expect, it } from 'vitest';
import { parseTracePlay, placeForTraceOpen, traceJourneyHref } from './traceHref';

describe('traceJourneyHref', () => {
  it('builds a play link for the given journey', () => {
    expect(traceJourneyHref('journey-elijah')).toBe('/trace/journey-elijah?play=1');
  });

  it('includes a stop index when one is given', () => {
    expect(traceJourneyHref('journey-elijah', 4)).toBe('/trace/journey-elijah?play=1&stop=4');
  });
});

describe('parseTracePlay', () => {
  it('reads a play request and optional stop', () => {
    expect(parseTracePlay('?play=1')).toEqual({ play: true });
    expect(parseTracePlay('play=1&stop=4')).toEqual({ play: true, stop: 4 });
  });

  it('ignores a stop when play is not set, so tab resume still works', () => {
    expect(parseTracePlay('?stop=4')).toEqual({ play: false });
    expect(parseTracePlay('')).toEqual({ play: false });
  });
});

describe('placeForTraceOpen', () => {
  const fractions = [0, 0.2, 0.4, 0.6, 0.8, 1];

  it('ignores a saved resume when play is set and starts at the first stop', () => {
    expect(placeForTraceOpen(true, undefined, 4, 6, fractions)).toEqual({ stop: 0, progress: 0 });
  });

  it('opens at a requested stop even when a later resume is saved', () => {
    expect(placeForTraceOpen(true, 2, 5, 6, fractions)).toEqual({ stop: 2, progress: 0.4 });
  });

  it('still restores a saved stop when the URL is not a play link', () => {
    expect(placeForTraceOpen(false, undefined, 4, 6, fractions)).toEqual({ stop: 4, progress: 0.8 });
  });
});
