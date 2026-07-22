import { describe, expect, it } from 'vitest';
import {activeStopIndex, haversine, lineLength, lineProgress, type LngLat, expandJourneyPath, stopFractions, activeStopFromFractions, stopRangeAtFraction } from './route';

const A: LngLat = [0, 0];
const B: LngLat = [0, 1];
const C: LngLat = [0, 2];

describe('route geometry', () => {
  it('haversine ~111 km per degree of latitude', () => {
    expect(haversine(A, B)).toBeGreaterThan(110);
    expect(haversine(A, B)).toBeLessThan(112);
  });

  it('lineLength sums segments', () => {
    expect(lineLength([A, B, C])).toBeCloseTo(haversine(A, B) + haversine(B, C), 3);
  });

  it('lineProgress at 0 and 1 hits endpoints', () => {
    expect(lineProgress([A, B, C], 0).point).toEqual(A);
    expect(lineProgress([A, B, C], 1).point).toEqual(C);
  });

  it('lineProgress at 0.5 reaches the midpoint', () => {
    const p = lineProgress([A, B, C], 0.5).point;
    expect(p[0]).toBeCloseTo(0, 5);
    expect(p[1]).toBeCloseTo(1, 2); // midpoint of the two-degree line
  });

  it('progress line grows monotonically', () => {
    expect(lineProgress([A, B, C], 0.25).line.length).toBeLessThanOrEqual(
      lineProgress([A, B, C], 0.75).line.length,
    );
  });

  it('activeStopIndex advances with progress', () => {
    expect(activeStopIndex([A, B, C], 0)).toBe(0);
    expect(activeStopIndex([A, B, C], 1)).toBe(2);
  });
});

describe('expandJourneyPath', () => {
  const stops: [number, number][] = [
    [0, 0],
    [1, 0],
    [2, 0],
  ];

  it('degrades to the straight-line identity when no legs are given', () => {
    const p = expandJourneyPath(stops);
    expect(p.coords).toEqual(stops);
    expect(p.stopVertex).toEqual([0, 1, 2]);
  });

  it('splices per-leg vias and keeps the stop-vertex mapping truthful', () => {
    const legs: [number, number][][] = [
      [
        [0, 0],
        [0.5, 0.4],
        [1, 0],
      ],
      [
        [1, 0],
        [1.5, -0.4],
        [2, 0],
      ],
    ];
    const p = expandJourneyPath(stops, legs);
    expect(p.coords).toEqual([
      [0, 0],
      [0.5, 0.4],
      [1, 0],
      [1.5, -0.4],
      [2, 0],
    ]);
    expect(p.stopVertex).toEqual([0, 2, 4]);
    // Stops sit at the right fractions of the LONGER detailed path, and the
    // active-stop lookup inverts them exactly.
    const fr = stopFractions(p);
    expect(fr[0]).toBe(0);
    expect(fr[2]).toBe(1);
    expect(fr[1]).toBeGreaterThan(0.4);
    expect(fr[1]).toBeLessThan(0.6);
    expect(activeStopFromFractions(fr, 0)).toBe(0);
    expect(activeStopFromFractions(fr, fr[1])).toBe(1);
    expect(activeStopFromFractions(fr, fr[1] - 1e-8)).toBe(1);
    expect(activeStopFromFractions(fr, fr[1] - 0.01)).toBe(0);
    expect(activeStopFromFractions(fr, 1)).toBe(2);
  });

  it('falls back to a straight segment when the leg count mismatches', () => {
    const p = expandJourneyPath(stops, [[[0, 0], [1, 0]]]); // 1 leg for 2 gaps
    expect(p.coords).toEqual(stops);
  });

  // Consecutive stops can genuinely share a location (Golgotha and the
  // resurrection appearances; the two Upper Room stops), so they land on an
  // identical progress fraction. Playback walks them with a dwell — these
  // guard both failure modes that produced.
  describe('co-located stops', () => {
    //          0     1     2(tied with 1)  3
    const fr = [0, 0.25, 0.25, 1];

    it('activeStopFromFractions alone would skip the first of a tie', () => {
      // Documents *why* stopRangeAtFraction exists: the old resolution jumped
      // straight to stop 2, so stop 1 never became active.
      expect(activeStopFromFractions(fr, 0.25)).toBe(2);
    });

    it('groups the tied stops when sitting exactly on their fraction', () => {
      expect(stopRangeAtFraction(fr, 0.25)).toEqual([1, 2]);
    });

    it('does not re-enter the tie once progress has moved past it', () => {
      // The ping-pong bug: returning [1,2] here sends the walk back to stop 1,
      // which dwells, advances, resets, and repeats forever.
      expect(stopRangeAtFraction(fr, 0.2505)).toEqual([2, 2]);
    });

    it('reports a single stop where there is no tie', () => {
      expect(stopRangeAtFraction(fr, 0)).toEqual([0, 0]);
      expect(stopRangeAtFraction(fr, 1)).toEqual([3, 3]);
    });

    it('never returns an empty or inverted range', () => {
      for (const t of [0, 0.1, 0.25, 0.3, 0.9999, 1]) {
        const [first, last] = stopRangeAtFraction(fr, t);
        expect(first).toBeLessThanOrEqual(last);
        expect(first).toBeGreaterThanOrEqual(0);
        expect(last).toBeLessThan(fr.length);
      }
    });
  });
});
