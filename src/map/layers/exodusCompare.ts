import type { Map as MapLibreMap } from 'maplibre-gl';
import type { BundleIndex } from '../../content/useBundle';
import { hasLiveStyle } from '../lifecycle';
import { BLOCKER_IMAGE, LABEL_VARIABLE_ANCHORS, ensureBlockerImage, labelTone, orderLabelLayers } from './labelCollision';
import {
  LABEL_FADED_OPACITY,
  type CandidateGroup,
  type ResolvedRoute,
  type Selection,
  clusterFilter,
  clusterOpacity,
  compareCandidates,
  compareClustersFC,
  compareLinesFC,
  compareMembersFC,
  clusterLabelSortKey,
  lineOpacity,
  lineWidth,
  memberFilter,
  memberLabelSortKey,
  memberOpacity,
} from '../exodusCompare';

export const COMPARE_LAYERS = {
  lines: 'compare-proposed-lines',
  areas: 'compare-candidate-areas',
  pins: 'compare-candidate-pins',
  clusterAreas: 'compare-cluster-areas',
  clusterOuter: 'compare-cluster-outer',
  clusterInner: 'compare-cluster-inner',
  /** Invisible 22px-radius hit discs so every pin is a 44x44 tap target. */
  hit: 'compare-candidate-hit',
  clusterHit: 'compare-cluster-hit',
  /** Names as a symbol layer so MapLibre's collision keeps them from overlapping. */
  labels: 'compare-candidate-labels',
  clusterLabels: 'compare-cluster-labels',
  /** Invisible icons on every pin: labels collide with them, so no name covers a pin. */
  pinBlockers: 'compare-pin-blockers',
  clusterBlockers: 'compare-cluster-blockers',
} as const;

const LABEL_FONT = ['Ubuntu Medium'];
const LABEL_MINZOOM = 5;
export { labelTone };

const SRC = { members: 'compare-members', clusters: 'compare-clusters', lines: 'compare-lines' };

// Hollow-pin palette matches atlas.ts confidence colours.
const CONF_COLOR = ['match', ['get', 'confidence'], 'high', '#2f6f6b', 'medium', '#c9a227', 'legendary', '#6b4a8f', 'disputed', '#c75b39', '#888888'];
const LINE_COLOR = '#9fc3e0';
const PIN_OPACITY = 0.95;
const AREA_OPACITY = 0.28;

// Soft area for region-precision pins: grows with zoom so it reads as "around
// here", never as a point. Radius in px.
const AREA_RADIUS = ['interpolate', ['exponential', 1.6], ['zoom'], 3, 14, 6, 24, 9, 70, 12, 260];
const CLUSTER_AREA_RADIUS = ['interpolate', ['exponential', 1.6], ['zoom'], 3, 18, 6, 30, 9, 90, 12, 300];

export interface CompareModel {
  routes: ResolvedRoute[];
  groups: CandidateGroup[];
}

export interface CompareLayerOptions {
  dark: boolean;
  /** Visible text of a cluster's tag, e.g. "2 places". */
  clusterLabel: (g: CandidateGroup) => string;
  /**
   * Label anchor preference, first tried first. Trace passes anchors that put
   * names left of their pin, because its DOM stop badge sits to the right.
   */
  anchors?: string[];
}

export function ensureCompareLayers(
  map: MapLibreMap,
  bundle: BundleIndex,
  model: CompareModel,
  opts: CompareLayerOptions,
  beforeId?: string,
): void {
  if (map.getLayer(COMPARE_LAYERS.pins)) return;
  const cands = compareCandidates(bundle);
  if (!map.getSource(SRC.members)) map.addSource(SRC.members, { type: 'geojson', data: compareMembersFC(cands) });
  if (!map.getSource(SRC.clusters))
    map.addSource(SRC.clusters, { type: 'geojson', data: compareClustersFC(model.groups, opts.clusterLabel) });
  ensureBlockerImage(map);
  if (!map.getSource(SRC.lines))
    map.addSource(SRC.lines, {
      type: 'geojson',
      data: compareLinesFC(model.routes, (id) => bundle.routeForProposedRoute(id) as { legs: [number, number][][] } | undefined),
    });
  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  const isRegion = ['==', ['get', 'pinPrecision'], 'region'];
  const notRegion = ['!=', ['get', 'pinPrecision'], 'region'];
  const add = (layer: Parameters<MapLibreMap['addLayer']>[0]) => map.addLayer(layer, before);

  add({
    id: COMPARE_LAYERS.lines,
    type: 'line',
    source: SRC.lines,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
    paint: { 'line-color': LINE_COLOR, 'line-width': 2.5, 'line-opacity': 0.5, 'line-dasharray': [1, 3] },
  });
  add({
    id: COMPARE_LAYERS.areas,
    type: 'circle',
    source: SRC.members,
    filter: isRegion as never,
    paint: {
      'circle-radius': AREA_RADIUS as never,
      'circle-color': CONF_COLOR as never,
      'circle-opacity': AREA_OPACITY,
      'circle-blur': 0.6,
      'circle-stroke-width': 0,
    },
  });
  add({
    id: COMPARE_LAYERS.clusterAreas,
    type: 'circle',
    source: SRC.clusters,
    filter: isRegion as never,
    paint: {
      'circle-radius': CLUSTER_AREA_RADIUS as never,
      'circle-color': CONF_COLOR as never,
      'circle-opacity': AREA_OPACITY,
      'circle-blur': 0.6,
    },
  });
  add({
    id: COMPARE_LAYERS.pins,
    type: 'circle',
    source: SRC.members,
    filter: notRegion as never,
    paint: {
      'circle-radius': 7,
      'circle-opacity': 0,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': CONF_COLOR as never,
      'circle-stroke-opacity': PIN_OPACITY,
    },
  });
  // A cluster is two nested hollow rings: "more than one place here".
  for (const [id, r] of [
    [COMPARE_LAYERS.clusterOuter, 12],
    [COMPARE_LAYERS.clusterInner, 6],
  ] as const) {
    add({
      id,
      type: 'circle',
      source: SRC.clusters,
      filter: notRegion as never,
      paint: {
        'circle-radius': r,
        'circle-opacity': 0,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': CONF_COLOR as never,
        'circle-stroke-opacity': PIN_OPACITY,
      },
    });
  }
  add({
    id: COMPARE_LAYERS.hit,
    type: 'circle',
    source: SRC.members,
    paint: { 'circle-radius': 22, 'circle-color': '#000000', 'circle-opacity': 0.01 },
  });
  add({
    id: COMPARE_LAYERS.clusterHit,
    type: 'circle',
    source: SRC.clusters,
    paint: { 'circle-radius': 22, 'circle-color': '#000000', 'circle-opacity': 0.01 },
  });
  const tone = labelTone(opts.dark);
  const labelLayout = {
    'text-font': LABEL_FONT,
    'text-size': 12,
    'text-max-width': 9,
    'text-line-height': 1.15,
    'text-variable-anchor': opts.anchors ?? LABEL_VARIABLE_ANCHORS,
    'text-justify': 'auto',
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'text-padding': 3,
  };
  const labelPaint = { 'text-color': tone.color, 'text-halo-color': tone.halo, 'text-halo-width': 1.6 };
  // Collision is placed top layer first, so the order below is deliberate:
  // pin blockers (topmost) claim their spots, then cluster tags, then names.
  add({
    id: COMPARE_LAYERS.labels,
    type: 'symbol',
    source: SRC.members,
    minzoom: LABEL_MINZOOM,
    layout: {
      ...labelLayout,
      'text-field': ['get', 'name'],
      'text-radial-offset': ['case', ['==', ['get', 'pinPrecision'], 'region'], 1.5, 1],
      'symbol-sort-key': 1,
    } as never,
    paint: labelPaint,
  });
  add({
    id: COMPARE_LAYERS.clusterLabels,
    type: 'symbol',
    source: SRC.clusters,
    minzoom: LABEL_MINZOOM,
    layout: {
      ...labelLayout,
      'text-font': ['Ubuntu Bold'],
      'text-field': ['get', 'label'],
      'text-radial-offset': ['case', ['==', ['get', 'pinPrecision'], 'region'], 1.8, 1.4],
      'symbol-sort-key': 1,
    } as never,
    paint: labelPaint,
  });
  for (const [id, source, size] of [
    [COMPARE_LAYERS.clusterBlockers, SRC.clusters, 1.6],
    [COMPARE_LAYERS.pinBlockers, SRC.members, 1],
  ] as const) {
    add({
      id,
      type: 'symbol',
      source,
      layout: {
        'icon-image': BLOCKER_IMAGE,
        'icon-size': size,
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
      },
    });
  }
  orderLabelLayers(map);
}

export function setCompareTone(map: MapLibreMap, dark: boolean): void {
  const tone = labelTone(dark);
  for (const id of [COMPARE_LAYERS.labels, COMPARE_LAYERS.clusterLabels]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, 'text-color', tone.color);
    map.setPaintProperty(id, 'text-halo-color', tone.halo);
  }
}

const MEMBER_LAYERS = [
  COMPARE_LAYERS.areas,
  COMPARE_LAYERS.pins,
  COMPARE_LAYERS.hit,
  COMPARE_LAYERS.labels,
  COMPARE_LAYERS.pinBlockers,
];
const CLUSTER_LAYERS = [
  COMPARE_LAYERS.clusterAreas,
  COMPARE_LAYERS.clusterOuter,
  COMPARE_LAYERS.clusterInner,
  COMPARE_LAYERS.clusterHit,
  COMPARE_LAYERS.clusterLabels,
  COMPARE_LAYERS.clusterBlockers,
];

/** Show grouped pins as one cluster below their split zoom, apart above it. */
export function applyCompareSplit(map: MapLibreMap, split: string[], groups: CandidateGroup[]): void {
  const mf = memberFilter(split, groups);
  const cf = clusterFilter(split);
  const precision = (id: string) =>
    id === COMPARE_LAYERS.areas || id === COMPARE_LAYERS.clusterAreas
      ? ['==', ['get', 'pinPrecision'], 'region']
      : id === COMPARE_LAYERS.pins || id === COMPARE_LAYERS.clusterOuter || id === COMPARE_LAYERS.clusterInner
        ? ['!=', ['get', 'pinPrecision'], 'region']
        : null;
  for (const id of MEMBER_LAYERS) {
    if (!map.getLayer(id)) continue;
    const p = precision(id);
    map.setFilter(id, (p ? ['all', p, mf] : mf) as never);
  }
  for (const id of CLUSTER_LAYERS) {
    if (!map.getLayer(id)) continue;
    const p = precision(id);
    map.setFilter(id, (p ? ['all', p, cf] : cf) as never);
  }
}

/** Highlight the picked route's pins and line; fade (never hide) the rest. */
export function applyCompareSelection(map: MapLibreMap, sel: Selection, showLines: boolean): void {
  if (!map.getLayer(COMPARE_LAYERS.pins)) return;
  map.setPaintProperty(COMPARE_LAYERS.pins, 'circle-stroke-opacity', memberOpacity(sel, PIN_OPACITY) as never);
  map.setPaintProperty(COMPARE_LAYERS.areas, 'circle-opacity', memberOpacity(sel, AREA_OPACITY) as never);
  for (const id of [COMPARE_LAYERS.clusterOuter, COMPARE_LAYERS.clusterInner])
    map.setPaintProperty(id, 'circle-stroke-opacity', clusterOpacity(sel, PIN_OPACITY) as never);
  map.setPaintProperty(COMPARE_LAYERS.clusterAreas, 'circle-opacity', clusterOpacity(sel, AREA_OPACITY) as never);
  map.setPaintProperty(COMPARE_LAYERS.labels, 'text-opacity', memberOpacity(sel, 1, LABEL_FADED_OPACITY) as never);
  map.setPaintProperty(COMPARE_LAYERS.clusterLabels, 'text-opacity', clusterOpacity(sel, 1, LABEL_FADED_OPACITY) as never);
  map.setLayoutProperty(COMPARE_LAYERS.labels, 'symbol-sort-key', memberLabelSortKey(sel) as never);
  map.setLayoutProperty(COMPARE_LAYERS.clusterLabels, 'symbol-sort-key', clusterLabelSortKey(sel) as never);
  map.setPaintProperty(COMPARE_LAYERS.lines, 'line-opacity', lineOpacity(sel) as never);
  map.setPaintProperty(COMPARE_LAYERS.lines, 'line-width', lineWidth(sel) as never);
  map.setLayoutProperty(COMPARE_LAYERS.lines, 'visibility', showLines ? 'visible' : 'none');
}

export function setCompareVisible(map: MapLibreMap, visible: boolean): void {
  for (const id of [...MEMBER_LAYERS, ...CLUSTER_LAYERS])
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export function removeCompareLayers(map: MapLibreMap): void {
  if (!hasLiveStyle(map)) return;
  for (const id of Object.values(COMPARE_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
}
