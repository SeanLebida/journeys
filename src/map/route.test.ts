import { describe, expect, it } from 'vitest';
import {activeStopIndex, haversine, lineLength, lineProgress, type LngLat, expandJourneyPath, stopFractions, activeStopFromFractions } from './route';

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
    expect(activeStopFromFractions(fr, fr[1] - 0.01)).toBe(0);
    expect(activeStopFromFractions(fr, 1)).toBe(2);
  });

  it('falls back to a straight segment when the leg count mismatches', () => {
    const p = expandJourneyPath(stops, [[[0, 0], [1, 0]]]); // 1 leg for 2 gaps
    expect(p.coords).toEqual(stops);
  });
});
