import maplibregl, { type Map as MapLibreMap, type GeoJSONSource, type Marker } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import type { LngLat, RouteProgress } from '../route';
import { hasLiveStyle } from '../lifecycle';

const SRC = { full: 'trace-full', progress: 'trace-progress', stops: 'trace-stops' };
const LYR = {
  full: 'trace-full-line',
  progress: 'trace-progress-line',
  stops: 'trace-stops-circle',
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
    paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.35, 'line-dasharray': [2, 2] },
  });
  map.addLayer({
    id: LYR.progress,
    type: 'line',
    source: SRC.progress,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': 8, 'line-opacity': 0.95 },
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
}

const line = (coords: LngLat[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: coords.length >= 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [],
});

/**
 * The parts of the trace that only change when the journey (or which stops are
 * reached) does — kept out of the per-frame path so the animation loop isn't
 * re-serializing the whole route and every stop 60 times a second.
 */
export function updateTraceStatic(map: MapLibreMap, full: LngLat[], stops: TraceStop[]): void {
  src(map, SRC.full)?.setData(line(full));
  const stopFeatures: Feature[] = stops.map((s) => ({
    type: 'Feature',
    properties: { confidence: s.confidence, reached: s.reached, order: s.order },
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
  }));
  src(map, SRC.stops)?.setData({ type: 'FeatureCollection', features: stopFeatures });
}

/** The drawn-so-far line and the traveller dot — the only things that move per frame. */
export function updateTraceProgress(map: MapLibreMap, progress: RouteProgress): void {
  src(map, SRC.progress)?.setData(line(progress.line));
  travelerMarker?.setLngLat(progress.point);
}

// The traveller is a DOM Marker rather than a circle layer on purpose. A
// GeoJSON `setData` is parsed on MapLibre's worker thread, so the dot landed on
// screen one or more frames after the `jumpTo` that moved the camera to the very
// same point — and because the camera follows the dot, that lag read as the dot
// juddering around the centre of the screen. A Marker is repositioned
// synchronously inside the map's own render pass, so it is always exactly where
// the camera thinks it is.
let travelerMarker: Marker | null = null;

export function ensureTravelerMarker(map: MapLibreMap, color: string, at: LngLat): void {
  if (!travelerMarker) {
    const el = document.createElement('div');
    el.className = 'trace-traveler';
    travelerMarker = new maplibregl.Marker({ element: el, pitchAlignment: 'map' });
  }
  (travelerMarker.getElement() as HTMLElement).style.setProperty('--traveler-color', color);
  travelerMarker.setLngLat(at).addTo(map);
}

export function removeTravelerMarker(): void {
  travelerMarker?.remove();
  travelerMarker = null;
}

export function removeTraceLayers(map: MapLibreMap): void {
  removeTravelerMarker();
  if (!hasLiveStyle(map)) return;
  for (const id of Object.values(LYR)) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
}
