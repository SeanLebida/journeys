import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * One collision system for map names. MapLibre places symbol layers top
 * layer first, so the stacking order here is the priority order: pin
 * blockers (invisible icons, so no name covers a pin), then "Whose map?"
 * cluster tags and candidate names, then the older site name tags. A name
 * that would overlap one placed earlier is dropped; pins are never hidden.
 */
export const BLOCKER_IMAGE = 'label-pin-blocker';

/** Bottom to top. Ids that are not on the map are skipped. */
export const LABEL_STACK = [
  'atlas-sites-labels',
  'compare-candidate-labels',
  'compare-cluster-labels',
  'atlas-sites-blockers',
  'compare-cluster-blockers',
  'compare-pin-blockers',
] as const;

export function ensureBlockerImage(map: MapLibreMap): void {
  if (!map.hasImage(BLOCKER_IMAGE)) map.addImage(BLOCKER_IMAGE, { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) });
}

/** The ids in LABEL_STACK that exist, bottom to top. Pure, for tests. */
export function labelStackOrder(has: (id: string) => boolean): string[] {
  return LABEL_STACK.filter((id) => has(id));
}

/** Lift every label and blocker layer to the top in LABEL_STACK order. */
export function orderLabelLayers(map: MapLibreMap): void {
  for (const id of labelStackOrder((x) => Boolean(map.getLayer(x)))) map.moveLayer(id);
}

export function labelTone(dark: boolean): { color: string; halo: string } {
  return dark
    ? { color: '#f3ecd9', halo: 'rgba(13, 15, 18, 0.95)' }
    : { color: '#221a10', halo: 'rgba(255, 255, 255, 0.95)' };
}

export const LABEL_VARIABLE_ANCHORS = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

/**
 * Trace draws each stop's numbered badge as a DOM tag to the right of the
 * stop, which MapLibre cannot see. Names there go to the left of their pin.
 */
export const TRACE_LABEL_ANCHORS = ['right', 'bottom-right', 'top-right'];
