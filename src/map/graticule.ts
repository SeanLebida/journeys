import type { FeatureCollection, LineString } from 'geojson';

/** Geographic bounding box [west, south, east, north]. */
export type BBox = [number, number, number, number];

// The NT Mediterranean — the app's default opening camera (MapProvider).
export const MEDITERRANEAN_BBOX: BBox = [-12, 27, 46, 48];

// The whole biblical stage: Mesopotamia (Ur, Babylon) → the Levant → Egypt and
// Sinai. This is the geo-sanity bbox the content validator checks coordinates
// against, the extent the offline basemap (scripts/clip-basemap.py) is clipped
// to, and the graticule's span — widened from MEDITERRANEAN_BBOX so Old-Testament
// sites (patriarchs, the Exodus) sit on real mapped land, not empty sea.
export const WORLD_BBOX: BBox = [-12, 22, 50, 48];

/**
 * Generate a graticule (meridians + parallels) as GeoJSON for the M1 basemap.
 * Computed geometry, not factual content — safe to live in src/.
 */
export function generateGraticule(stepDeg = 5, bbox: BBox = WORLD_BBOX): FeatureCollection<LineString> {
  const [west, south, east, north] = bbox;
  const features: FeatureCollection<LineString>['features'] = [];

  for (let lon = Math.ceil(west / stepDeg) * stepDeg; lon <= east; lon += stepDeg) {
    const coords: [number, number][] = [];
    for (let lat = south; lat <= north; lat += 1) coords.push([lon, lat]);
    features.push({
      type: 'Feature',
      properties: { kind: 'meridian', deg: lon },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
  for (let lat = Math.ceil(south / stepDeg) * stepDeg; lat <= north; lat += stepDeg) {
    const coords: [number, number][] = [];
    for (let lon = west; lon <= east; lon += 1) coords.push([lon, lat]);
    features.push({
      type: 'Feature',
      properties: { kind: 'parallel', deg: lat },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }

  return { type: 'FeatureCollection', features };
}
