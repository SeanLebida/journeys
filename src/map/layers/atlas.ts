import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import type { BundleIndex } from '../../content/useBundle';

export const ATLAS_LAYERS = { sites: 'atlas-sites-circle', routes: 'atlas-routes-line' } as const;
const SRC = { sites: 'atlas-sites', routes: 'atlas-routes' };

const CONF_COLOR = ['match', ['get', 'confidence'], 'high', '#2f6f6b', 'medium', '#c9a227', 'legendary', '#6b4a8f', 'disputed', '#c75b39', '#888888'];

/** Each site's date span, widened to cover every stop that visits it. */
function computeSiteSpans(bundle: BundleIndex): Map<string, [number, number]> {
  const span = new Map<string, [number, number]>();
  for (const st of bundle.stops) {
    const cur = span.get(st.siteId);
    const lo = Math.min(cur?.[0] ?? st.dateRange.startYear, st.dateRange.startYear);
    const hi = Math.max(cur?.[1] ?? st.dateRange.endYear, st.dateRange.endYear);
    span.set(st.siteId, [lo, hi]);
  }
  return span;
}

/** Build a points FeatureCollection of all sites, with date span from stops. */
export function atlasSitesFC(bundle: BundleIndex): FeatureCollection {
  const span = computeSiteSpans(bundle);
  const features: Feature[] = bundle.sites.map((s) => {
    const [ymin, ymax] = span.get(s.id) ?? [-10, 70];
    return {
      type: 'Feature',
      properties: { id: s.id, name: s.ancientName.en, confidence: s.coordinates.confidence, ymin, ymax },
      geometry: { type: 'Point', coordinates: [s.coordinates.value.lon, s.coordinates.value.lat] },
    };
  });
  return { type: 'FeatureCollection', features };
}

export interface AtlasSiteLabel {
  id: string;
  name: string;
  lon: number;
  lat: number;
  confidence: string;
  ymin: number;
  ymax: number;
}

/** Same sites as `atlasSitesFC`, as plain records — for the DOM name-label
 * markers (no glyph/font source is shipped, so labels can't be a symbol layer). */
export function atlasSiteLabels(bundle: BundleIndex): AtlasSiteLabel[] {
  const span = computeSiteSpans(bundle);
  return bundle.sites.map((s) => {
    const [ymin, ymax] = span.get(s.id) ?? [-10, 70];
    return {
      id: s.id,
      name: s.ancientName.en,
      lon: s.coordinates.value.lon,
      lat: s.coordinates.value.lat,
      confidence: s.coordinates.confidence,
      ymin,
      ymax,
    };
  });
}

/** One LineString per journey, carrying its route color. */
export function atlasRoutesFC(bundle: BundleIndex): FeatureCollection {
  const features: Feature[] = bundle.journeys.map((j) => {
    const coords = bundle
      .stopsFor(j.id)
      .map((s) => bundle.site(s.siteId))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => [s.coordinates.value.lon, s.coordinates.value.lat]);
    return {
      type: 'Feature',
      properties: { journeyId: j.id, color: j.color ?? '#c75b39', title: j.title.en },
      geometry: { type: 'LineString', coordinates: coords },
    };
  });
  return { type: 'FeatureCollection', features };
}

export function ensureAtlasLayers(map: MapLibreMap, bundle: BundleIndex): void {
  if (map.getLayer(ATLAS_LAYERS.sites)) return;
  if (!map.getSource(SRC.routes)) map.addSource(SRC.routes, { type: 'geojson', data: atlasRoutesFC(bundle) });
  if (!map.getSource(SRC.sites)) map.addSource(SRC.sites, { type: 'geojson', data: atlasSitesFC(bundle) });
  map.addLayer({
    id: ATLAS_LAYERS.routes,
    type: 'line',
    source: SRC.routes,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.6 },
  });
  map.addLayer({
    id: ATLAS_LAYERS.sites,
    type: 'circle',
    source: SRC.sites,
    paint: {
      'circle-radius': 5,
      'circle-color': CONF_COLOR as never,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    },
  });
}

export function setLayerVisible(map: MapLibreMap, layerId: string, visible: boolean): void {
  if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

/** Filter sites to those whose date span overlaps [min,max] and confidence is allowed. */
export function setAtlasFilter(map: MapLibreMap, minYear: number, maxYear: number, confidences: string[]): void {
  if (!map.getLayer(ATLAS_LAYERS.sites)) return;
  map.setFilter(ATLAS_LAYERS.sites, [
    'all',
    ['>=', ['get', 'ymax'], minYear],
    ['<=', ['get', 'ymin'], maxYear],
    ['in', ['get', 'confidence'], ['literal', confidences]],
  ] as never);
}

export function removeAtlasLayers(map: MapLibreMap): void {
  for (const id of Object.values(ATLAS_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
}

export function siteIdFromFeature(f: MapGeoJSONFeature): string | undefined {
  return f.properties?.id as string | undefined;
}
