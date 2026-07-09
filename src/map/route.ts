export type LngLat = [number, number]; // [lon, lat]

const R = 6371; // km

/** Great-circle distance between two [lon,lat] points, in km. */
export function haversine(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(a[0] - b[0]) * -1;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total polyline length (km). */
export function lineLength(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}

export interface RouteProgress {
  line: LngLat[]; // coords from start up to the current position (inclusive)
  point: LngLat; // interpolated current position
}

/**
 * Slice a polyline at fraction `t` (0..1) of its total geodesic length.
 * Returns the partial line and the interpolated head point. Pure + deterministic
 * so it can be unit-tested and driven by the rAF animation loop.
 */
export function lineProgress(coords: LngLat[], t: number): RouteProgress {
  if (coords.length === 0) return { line: [], point: [0, 0] };
  if (coords.length === 1) return { line: [coords[0]], point: coords[0] };
  const clamped = Math.min(1, Math.max(0, t));
  const total = lineLength(coords);
  if (total === 0) return { line: [coords[0]], point: coords[0] };
  const target = clamped * total;

  let acc = 0;
  const line: LngLat[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const segLen = haversine(coords[i - 1], coords[i]);
    if (acc + segLen >= target) {
      const f = segLen === 0 ? 0 : (target - acc) / segLen;
      const point: LngLat = [
        coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f,
        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f,
      ];
      line.push(point);
      return { line, point };
    }
    acc += segLen;
    line.push(coords[i]);
  }
  return { line, point: coords[coords.length - 1] };
}

/** Progress fraction (0..1) at which `coords[index]` is reached — the inverse of `activeStopIndex`. */
export function progressAtIndex(coords: LngLat[], index: number): number {
  if (coords.length <= 1 || index <= 0) return 0;
  const total = lineLength(coords);
  if (total === 0) return 0;
  let acc = 0;
  for (let i = 1; i <= index && i < coords.length; i++) acc += haversine(coords[i - 1], coords[i]);
  return Math.min(1, acc / total);
}

/** Index of the stop most recently reached at fraction `t`. */
export function activeStopIndex(coords: LngLat[], t: number): number {
  if (coords.length <= 1) return 0;
  const total = lineLength(coords);
  if (total === 0) return 0;
  const target = Math.min(1, Math.max(0, t)) * total;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = haversine(coords[i - 1], coords[i]);
    if (acc + seg > target + 1e-9) return i - 1; // still travelling toward stop i
    acc += seg;
  }
  return coords.length - 1;
}
