import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import type { LngLat, RouteProgress } from '../route';

const SRC = { full: 'trace-full', progress: 'trace-progress', traveler: 'trace-traveler', stops: 'trace-stops' };
const LYR = {
  full: 'trace-full-line',
  progress: 'trace-progress-line',
  stops: 'trace-stops-circle',
  traveler: 'trace-traveler-circle',
};

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
const src = (m: MapLibreMap, id: string) => m.getSource(id) as GeoJSONSource | undefined;

export interface TraceStop {
  lng: number;
  lat: number;
  confidence: string;
  reached: boolean;
  order: number;
}

/** Idempotently add the trace sources + layers to the map. */
export function ensureTraceLayers(map: MapLibreMap, color: string): void {
  if (map.getLayer(LYR.full)) return;
  for (const id of Object.values(SRC)) if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty });

  map.addLayer({
    id: LYR.full,
    type: 'line',
    source: SRC.full,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': 2, 'line-opacity': 0.35, 'line-dasharray': [2, 2] },
  });
  map.addLayer({
    id: LYR.progress,
    type: 'line',
    source: SRC.progress,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.95 },
  });
  map.addLayer({
    id: LYR.stops,
    type: 'circle',
    source: SRC.stops,
    paint: {
      'circle-radius': 5,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-color': [
        'match',
        ['get', 'confidence'],
        'high', '#2f6f6b',
        'medium', '#c9a227',
        'legendary', '#6b4a8f',
        'disputed', '#c75b39',
        '#888888',
      ],
      'circle-opacity': ['case', ['get', 'reached'], 1, 0.5],
    },
  });
  map.addLayer({
    id: LYR.traveler,
    type: 'circle',
    source: SRC.traveler,
    paint: { 'circle-radius': 7, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
  });
}

export function updateTrace(map: MapLibreMap, full: LngLat[], progress: RouteProgress, stops: TraceStop[]): void {
  const line = (coords: LngLat[]): FeatureCollection => ({
    type: 'FeatureCollection',
    features: coords.length >= 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [],
  });
  src(map, SRC.full)?.setData(line(full));
  src(map, SRC.progress)?.setData(line(progress.line));
  src(map, SRC.traveler)?.setData({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: progress.point } }],
  });
  const stopFeatures: Feature[] = stops.map((s) => ({
    type: 'Feature',
    properties: { confidence: s.confidence, reached: s.reached, order: s.order },
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
  }));
  src(map, SRC.stops)?.setData({ type: 'FeatureCollection', features: stopFeatures });
}

export function removeTraceLayers(map: MapLibreMap): void {
  for (const id of Object.values(LYR)) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
}
