import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import type { BundleIndex } from '../../content/useBundle';
import { hasLiveStyle } from '../lifecycle';

export const ATLAS_LAYERS = {
  sites: 'atlas-sites-circle',
  candidates: 'atlas-sites-candidates',
  routes: 'atlas-routes-line',
  routesReconstructed: 'atlas-routes-line-reconstructed',
  routesSea: 'atlas-routes-line-sea',
  routesSchematic: 'atlas-routes-line-schematic',
  battles: 'atlas-battles-circle',
  battleAreas: 'atlas-battle-areas-fill',
  battleAreasLine: 'atlas-battle-areas-line',
  battleAreaSelected: 'atlas-battle-area-selected',
} as const;

/**
 * Stroke styling per geometry grade. `line-dasharray` is not data-driven in
 * MapLibre, so each grade gets its own filtered layer: solid = surveyed road,
 * progressively sparser dashes = progressively weaker geometric claim.
 */
export const ROUTE_GRADE_STYLE = [
  { layer: ATLAS_LAYERS.routes, grade: 'surveyed-road', width: 5.0, opacity: 0.7, dash: undefined },
  { layer: ATLAS_LAYERS.routesReconstructed, grade: 'reconstructed-land', width: 4.0, opacity: 0.6, dash: [4, 2] },
  { layer: ATLAS_LAYERS.routesSea, grade: 'sea-lane', width: 3.5, opacity: 0.55, dash: [2, 3] },
  { layer: ATLAS_LAYERS.routesSchematic, grade: 'schematic', width: 3.0, opacity: 0.4, dash: [1, 4] },
] as const;

/** Every route stroke layer, so callers can toggle "journey routes" as one unit. */
export const ROUTE_LAYER_IDS = ROUTE_GRADE_STYLE.map((s) => s.layer);
const SRC = {
  sites: 'atlas-sites',
  candidates: 'atlas-candidates',
  routes: 'atlas-routes',
  battles: 'atlas-battles',
  battleAreas: 'atlas-battle-areas',
};

const CONF_COLOR = ['match', ['get', 'confidence'], 'high', '#2f6f6b', 'medium', '#c9a227', 'legendary', '#6b4a8f', 'disputed', '#c75b39', '#888888'];
// Battles carry one martial crimson across markers and area sweeps, so they
// read as a distinct class from the confidence-coloured site dots.
const BATTLE_COLOR = '#8f1f1f';

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

export interface AtlasCandidateLabel {
  parentId: string;
  name: string;
  lon: number;
  lat: number;
  confidence: string;
  parentConfidence: string;
  ymin: number;
  ymax: number;
}

/**
 * Rival pins for sites that carry `candidates[]`. Filtered by the *parent*
 * site's date span and confidence so a disputed working pin never appears
 * without the hollow rivals that justify the badge.
 */
export function atlasCandidatesFC(bundle: BundleIndex): FeatureCollection {
  const span = computeSiteSpans(bundle);
  const features: Feature[] = [];
  for (const s of bundle.sites) {
    if (!s.candidates?.length) continue;
    const [ymin, ymax] = span.get(s.id) ?? [-10, 70];
    s.candidates.forEach((c, i) => {
      features.push({
        type: 'Feature',
        properties: {
          id: s.id,
          parentId: s.id,
          candidateIndex: i,
          name: c.label.en,
          confidence: c.confidence,
          parentConfidence: s.coordinates.confidence,
          ymin,
          ymax,
        },
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      });
    });
  }
  return { type: 'FeatureCollection', features };
}

/** DOM labels for rival pins — only the selected site's candidates, so the
 * atlas does not sprout 80 extra names at once. */
export function atlasCandidateLabels(bundle: BundleIndex, parentId: string): AtlasCandidateLabel[] {
  const site = bundle.sites.find((s) => s.id === parentId);
  if (!site?.candidates?.length) return [];
  const span = computeSiteSpans(bundle);
  const [ymin, ymax] = span.get(site.id) ?? [-10, 70];
  return site.candidates.map((c) => ({
    parentId: site.id,
    name: c.label.en,
    lon: c.lon,
    lat: c.lat,
    confidence: c.confidence,
    parentConfidence: site.coordinates.confidence,
    ymin,
    ymax,
  }));
}

/** Battle markers: one point per battle at its anchor site, with the battle's
 * own date span (not the site's) so the period slider replays the wars in
 * order. */
export function atlasBattlesFC(bundle: BundleIndex): FeatureCollection {
  const features: Feature[] = (bundle.battles ?? [])
    .map((b) => {
      const s = bundle.site(b.siteId);
      if (!s) return null;
      return {
        type: 'Feature',
        properties: {
          battleId: b.id,
          title: b.title.en,
          kind: b.kind,
          confidence: b.confidence,
          ymin: b.dateRange.startYear,
          ymax: b.dateRange.endYear,
        },
        geometry: { type: 'Point', coordinates: [s.coordinates.value.lon, s.coordinates.value.lat] },
      } as Feature;
    })
    .filter((f): f is Feature => f !== null);
  return { type: 'FeatureCollection', features };
}

/** Area sweeps for battles that carry a highlight polygon (campaigns,
 * annexations, the fall of the kingdoms). */
export function atlasBattleAreasFC(bundle: BundleIndex): FeatureCollection {
  const features: Feature[] = (bundle.battles ?? [])
    .filter((b) => b.area && b.area.length >= 4)
    .map((b) => ({
      type: 'Feature' as const,
      properties: {
        battleId: b.id,
        title: b.title.en,
        confidence: b.confidence,
        ymin: b.dateRange.startYear,
        ymax: b.dateRange.endYear,
      },
      geometry: { type: 'Polygon' as const, coordinates: [b.area as [number, number][]] },
    }));
  return { type: 'FeatureCollection', features };
}

export interface AtlasBattleLabel {
  id: string;
  title: string;
  siteId: string;
  lon: number;
  lat: number;
  confidence: string;
  ymin: number;
  ymax: number;
}

/** Battle records for the DOM ⚔ label markers (same no-glyph constraint as
 * the site labels). */
export function atlasBattleLabels(bundle: BundleIndex): AtlasBattleLabel[] {
  return (bundle.battles ?? [])
    .map((b): AtlasBattleLabel | null => {
      const s = bundle.site(b.siteId);
      if (!s) return null;
      return {
        id: b.id,
        title: b.title.en,
        siteId: b.siteId,
        lon: s.coordinates.value.lon,
        lat: s.coordinates.value.lat,
        confidence: b.confidence,
        ymin: b.dateRange.startYear,
        ymax: b.dateRange.endYear,
      };
    })
    .filter((x): x is AtlasBattleLabel => x !== null);
}

/**
 * One LineString per *leg*, carrying its journey color and geometry grade.
 * Splitting per leg is what lets the map draw a surveyed Roman-road snap
 * differently from a reconstructed corridor or a bare schematic connector —
 * a single merged line per journey would claim uniform survey quality.
 * Journeys without authored legs fall back to one straight `schematic` line.
 */
export function atlasRoutesFC(bundle: BundleIndex): FeatureCollection {
  const features: Feature[] = [];
  for (const j of bundle.journeys) {
    const stopCoords = bundle
      .stopsFor(j.id)
      .map((s) => bundle.site(s.siteId))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => [s.coordinates.value.lon, s.coordinates.value.lat] as [number, number]);
    const color = j.color ?? '#c75b39';
    const base = { journeyId: j.id, color, title: j.title.en };
    const route = bundle.routeForJourney(j.id);

    if (route && route.legs.length === stopCoords.length - 1) {
      route.legs.forEach((leg, i) => {
        if (leg.length < 2) return;
        features.push({
          type: 'Feature',
          properties: { ...base, leg: i, grade: route.legGrades?.[i] ?? 'schematic' },
          geometry: { type: 'LineString', coordinates: leg },
        });
      });
    } else if (stopCoords.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { ...base, leg: 0, grade: 'schematic' },
        geometry: { type: 'LineString', coordinates: stopCoords },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export function ensureAtlasLayers(map: MapLibreMap, bundle: BundleIndex): void {
  if (map.getLayer(ATLAS_LAYERS.sites)) return;
  if (!map.getSource(SRC.routes)) map.addSource(SRC.routes, { type: 'geojson', data: atlasRoutesFC(bundle) });
  if (!map.getSource(SRC.sites)) map.addSource(SRC.sites, { type: 'geojson', data: atlasSitesFC(bundle) });
  if (!map.getSource(SRC.candidates)) map.addSource(SRC.candidates, { type: 'geojson', data: atlasCandidatesFC(bundle) });
  if (!map.getSource(SRC.battles)) map.addSource(SRC.battles, { type: 'geojson', data: atlasBattlesFC(bundle) });
  if (!map.getSource(SRC.battleAreas)) map.addSource(SRC.battleAreas, { type: 'geojson', data: atlasBattleAreasFC(bundle) });
  // Area sweeps go in first so routes/sites/markers draw above them.
  map.addLayer({
    id: ATLAS_LAYERS.battleAreas,
    type: 'fill',
    source: SRC.battleAreas,
    paint: { 'fill-color': BATTLE_COLOR, 'fill-opacity': 0.1 },
  });
  map.addLayer({
    id: ATLAS_LAYERS.battleAreasLine,
    type: 'line',
    source: SRC.battleAreas,
    paint: { 'line-color': BATTLE_COLOR, 'line-width': 1, 'line-opacity': 0.5, 'line-dasharray': [3, 2] },
  });
  // Selected battle's sweep, emphasized; filter set by setSelectedBattleArea.
  map.addLayer({
    id: ATLAS_LAYERS.battleAreaSelected,
    type: 'fill',
    source: SRC.battleAreas,
    filter: ['==', ['get', 'battleId'], ''],
    paint: { 'fill-color': BATTLE_COLOR, 'fill-opacity': 0.28 },
  });
  for (const s of ROUTE_GRADE_STYLE) {
    map.addLayer({
      id: s.layer,
      type: 'line',
      source: SRC.routes,
      filter: ['==', ['get', 'grade'], s.grade],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': s.width,
        'line-opacity': s.opacity,
        ...(s.dash ? { 'line-dasharray': [...s.dash] } : {}),
      },
    });
  }
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
  // Hollow rivals: no fill, confidence-coloured stroke. A candidate that
  // coincides with the working pin becomes a ring around it — that is the
  // honest reading ("this identification is one of several").
  map.addLayer({
    id: ATLAS_LAYERS.candidates,
    type: 'circle',
    source: SRC.candidates,
    paint: {
      'circle-radius': 7,
      'circle-color': CONF_COLOR as never,
      'circle-opacity': 0,
      'circle-stroke-width': 2,
      'circle-stroke-color': CONF_COLOR as never,
      'circle-stroke-opacity': 0.9,
    },
  });
  map.addLayer({
    id: ATLAS_LAYERS.battles,
    type: 'circle',
    source: SRC.battles,
    paint: {
      'circle-radius': 4,
      'circle-color': BATTLE_COLOR,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    },
  });
}

/** Emphasize one battle's area sweep (pass null to clear). */
export function setSelectedBattleArea(map: MapLibreMap, battleId: string | null): void {
  if (!map.getLayer(ATLAS_LAYERS.battleAreaSelected)) return;
  map.setFilter(ATLAS_LAYERS.battleAreaSelected, ['==', ['get', 'battleId'], battleId ?? ''] as never);
}

const RASTER_TARGET_OPACITY: Record<string, number> = {
  'topography-raster': 0.35,
  'satellite-raster': 1.0,
  'streets-raster': 1.0,
  'ancient-map-raster': 1.0,
};

export function setLayerVisible(map: MapLibreMap, layerId: string, visible: boolean): void {
  if (!map.getLayer(layerId)) return;
  const type = map.getLayer(layerId)?.type;

  if (type === 'raster') {
    const targetOpacity = RASTER_TARGET_OPACITY[layerId] ?? 1.0;
    if (visible) {
      map.setLayoutProperty(layerId, 'visibility', 'visible');
      map.setPaintProperty(layerId, 'raster-opacity-transition', { duration: 500 });
      map.setPaintProperty(layerId, 'raster-opacity', targetOpacity);
    } else {
      map.setPaintProperty(layerId, 'raster-opacity-transition', { duration: 500 });
      map.setPaintProperty(layerId, 'raster-opacity', 0);
      setTimeout(() => {
        if (map.getLayer(layerId) && map.getPaintProperty(layerId, 'raster-opacity') === 0) {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      }, 500);
    }
    return;
  }

  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

/** Filter sites + battles to those whose date span overlaps [min,max] and confidence is allowed. */
export function setAtlasFilter(map: MapLibreMap, minYear: number, maxYear: number, confidences: string[]): void {
  const filter = [
    'all',
    ['>=', ['get', 'ymax'], minYear],
    ['<=', ['get', 'ymin'], maxYear],
    ['in', ['get', 'confidence'], ['literal', confidences]],
  ] as never;
  for (const id of [ATLAS_LAYERS.sites, ATLAS_LAYERS.battles, ATLAS_LAYERS.battleAreas, ATLAS_LAYERS.battleAreasLine]) {
    if (map.getLayer(id)) map.setFilter(id, filter);
  }
  // Candidates follow the parent site's visibility, not their own confidence,
  // so hiding "medium" cannot orphan the rivals of a visible disputed pin.
  if (map.getLayer(ATLAS_LAYERS.candidates)) {
    map.setFilter(ATLAS_LAYERS.candidates, [
      'all',
      ['>=', ['get', 'ymax'], minYear],
      ['<=', ['get', 'ymin'], maxYear],
      ['in', ['get', 'parentConfidence'], ['literal', confidences]],
    ] as never);
  }
}

export function removeAtlasLayers(map: MapLibreMap): void {
  if (!hasLiveStyle(map)) return;
  for (const id of Object.values(ATLAS_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
}

export function siteIdFromFeature(f: MapGeoJSONFeature): string | undefined {
  return f.properties?.id as string | undefined;
}
