import type { FeatureCollection, LineString } from 'geojson';

/** Geographic bounding box [west, south, east, north]. */
export type BBox = [number, number, number, number];

// The biblical Mediterranean world — also the geo-sanity bbox the M2 content
// validator checks coordinates against.
export const MEDITERRANEAN_BBOX: BBox = [-12, 27, 46, 48];

/**
 * Generate a graticule (meridians + parallels) as GeoJSON for the M1 basemap.
 * Computed geometry, not factual content — safe to live in src/.
 */
export function generateGraticule(stepDeg = 5, bbox: BBox = MEDITERRANEAN_BBOX): FeatureCollection<LineString> {
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
