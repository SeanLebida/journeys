import { describe, expect, it } from 'vitest';
import { parseTraceOpen, placeForTraceOpen, traceJourneyHref } from './traceHref';

const fractions = [0, 0.2, 0.4, 0.6, 0.8, 1];

describe('traceJourneyHref', () => {
  it('names the journey and leaves the saved stop alone', () => {
    expect(traceJourneyHref('journey-elijah')).toBe('/trace/journey-elijah');
  });

  it('names a stop when the tap has one', () => {
    expect(traceJourneyHref('journey-elijah', 4)).toBe('/trace/journey-elijah?stop=4');
  });
});

describe('parseTraceOpen', () => {
  it('reads a stop and ignores a leftover play flag', () => {
    expect(parseTraceOpen('')).toEqual({});
    expect(parseTraceOpen('?play=1')).toEqual({});
    expect(parseTraceOpen('play=1&stop=4')).toEqual({ stop: 4 });
    expect(parseTraceOpen('?stop=4')).toEqual({ stop: 4 });
  });

  it('ignores a stop that is not a usable index', () => {
    expect(parseTraceOpen('?stop=-1')).toEqual({});
    expect(parseTraceOpen('?stop=foo')).toEqual({});
  });
});

describe('placeForTraceOpen', () => {
  it('resumes the saved stop when the address names no stop', () => {
    expect(placeForTraceOpen(undefined, 4, 6, fractions)).toEqual({ stop: 4, progress: 0.8 });
  });

  it('starts at the first stop when the journey has never been opened', () => {
    expect(placeForTraceOpen(undefined, undefined, 6, fractions)).toEqual({ stop: 0, progress: 0 });
  });

  it('opens a named stop even when a later resume is saved', () => {
    expect(placeForTraceOpen(2, 5, 6, fractions)).toEqual({ stop: 2, progress: 0.4 });
  });

  it('clamps a stop past the end to the last stop', () => {
    expect(placeForTraceOpen(99, 2, 6, fractions)).toEqual({ stop: 5, progress: 1 });
  });
});
