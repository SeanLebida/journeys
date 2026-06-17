import { describe, expect, it } from 'vitest';
import { activeStopIndex, haversine, lineLength, lineProgress, type LngLat } from './route';

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
