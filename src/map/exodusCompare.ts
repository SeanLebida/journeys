import type { Feature, FeatureCollection } from 'geojson';
import type { TClaimStatus, TPinPrecision, TProposedRoute, TSiteCandidate } from '../content/schema';
import type { BundleIndex } from '../content/useBundle';

/**
 * "Whose map?" comparison for sites whose rival candidates are paired by
 * `Journey.proposedRoutes` (the Red Sea crossing and Mount Sinai). Pure data
 * and MapLibre expressions only, so selection, fade and cluster rules are unit
 * tested without a map.
 *
 * Neutrality rules (Sean): no route is selected by default, none is marked as
 * recommended, and with nothing picked every candidate draws the same way.
 */

/** Opacity for anything not on the picked route. Faded, never hidden. */
export const FADED_OPACITY = 0.22;
/** Opacity of every proposed line while no route is picked. */
export const LINE_IDLE_OPACITY = 0.5;
/** Grouped pins split once they are at least this far apart on screen. */
export const CLUSTER_SPLIT_PX = 36;

export interface CompareCandidate {
  id: string;
  siteId: string;
  label: string;
  lat: number;
  lon: number;
  confidence: TSiteCandidate['confidence'];
  pinPrecision: TPinPrecision;
  groupId?: string;
  claimStatus?: TClaimStatus;
}

export interface ResolvedRoute {
  route: TProposedRoute;
  crossing: CompareCandidate;
  sinai: CompareCandidate;
}

/** Every candidate drawn by the comparison layers: those with an id and a pin precision. */
export function compareCandidates(bundle: Pick<BundleIndex, 'sites'>): CompareCandidate[] {
  const out: CompareCandidate[] = [];
  for (const s of bundle.sites) {
    for (const c of s.candidates ?? []) {
      if (!c.id || !c.pinPrecision) continue;
      out.push({
        id: c.id,
        siteId: s.id,
        label: c.label.en,
        lat: c.lat,
        lon: c.lon,
        confidence: c.confidence,
        pinPrecision: c.pinPrecision,
        groupId: c.groupId,
        claimStatus: c.claimStatus,
      });
    }
  }
  return out;
}

/** Sites whose candidates use the comparison layers (their single working dot is not drawn). */
export function compareSiteIds(bundle: Pick<BundleIndex, 'sites'>): Set<string> {
  return new Set(compareCandidates(bundle).map((c) => c.siteId));
}

/**
 * Every proposed route with both pins resolved, in a fixed geographic order:
 * crossing point south to north, then advocate A to Z. Nothing is ranked by
 * preference, none is first by default, and none is flagged as recommended.
 */
export function resolvedRoutes(bundle: Pick<BundleIndex, 'sites' | 'journeys'>): ResolvedRoute[] {
  const byId = new Map(compareCandidates(bundle).map((c) => [c.id, c]));
  const out: ResolvedRoute[] = [];
  for (const j of bundle.journeys) {
    for (const r of j.proposedRoutes ?? []) {
      const crossing = byId.get(r.crossingCandidateId);
      const sinai = byId.get(r.sinaiCandidateId);
      if (crossing && sinai) out.push({ route: r, crossing, sinai });
    }
  }
  return out.sort(
    (a, b) =>
      a.crossing.lat - b.crossing.lat ||
      a.route.advocate.localeCompare(b.route.advocate) ||
      a.sinai.lat - b.sinai.lat,
  );
}

/** Routes that touch one of this site's candidates (the chooser for that sheet). */
export function routesForSite(routes: ResolvedRoute[], siteId: string): ResolvedRoute[] {
  return routes.filter((r) => r.crossing.siteId === siteId || r.sinai.siteId === siteId);
}

export type Emphasis = 'equal' | 'highlight' | 'faded';

export interface Selection {
  routeId: string | null;
  candidateIds: string[];
  groupIds: string[];
}

export const NO_SELECTION: Selection = { routeId: null, candidateIds: [], groupIds: [] };

export function selectionFor(routes: ResolvedRoute[], routeId: string | null): Selection {
  const r = routeId ? routes.find((x) => x.route.id === routeId) : undefined;
  if (!r) return NO_SELECTION;
  const pins = [r.crossing, r.sinai];
  return {
    routeId: r.route.id,
    candidateIds: pins.map((p) => p.id),
    groupIds: [...new Set(pins.map((p) => p.groupId).filter((g): g is string => Boolean(g)))],
  };
}

export function candidateEmphasis(sel: Selection, candidateId: string): Emphasis {
  if (!sel.routeId) return 'equal';
  return sel.candidateIds.includes(candidateId) ? 'highlight' : 'faded';
}

/** A cluster is highlighted when any of its members is on the picked route. */
export function groupEmphasis(sel: Selection, groupId: string): Emphasis {
  if (!sel.routeId) return 'equal';
  return sel.groupIds.includes(groupId) ? 'highlight' : 'faded';
}

type Expr = unknown[] | number;

/** Opacity for member pins and areas: `full` for all when idle, else highlight vs fade. */
export function memberOpacity(sel: Selection, full: number): Expr {
  if (!sel.routeId) return full;
  return ['case', ['in', ['get', 'candidateId'], ['literal', sel.candidateIds]], full, full * FADED_OPACITY];
}

export function clusterOpacity(sel: Selection, full: number): Expr {
  if (!sel.routeId) return full;
  return ['case', ['in', ['get', 'groupId'], ['literal', sel.groupIds]], full, full * FADED_OPACITY];
}

export function lineOpacity(sel: Selection): Expr {
  if (!sel.routeId) return LINE_IDLE_OPACITY;
  return ['case', ['==', ['get', 'proposedRouteId'], sel.routeId], 0.95, 0.12];
}

export function lineWidth(sel: Selection): Expr {
  if (!sel.routeId) return 2.5;
  return ['case', ['==', ['get', 'proposedRouteId'], sel.routeId], 4, 2];
}

// ---- Clusters ---------------------------------------------------------------

export interface CandidateGroup {
  groupId: string;
  members: CompareCandidate[];
  lat: number;
  lon: number;
  /** Zoom at which members are CLUSTER_SPLIT_PX apart and draw separately. */
  splitZoom: number;
  pinPrecision: TPinPrecision;
}

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Web-Mercator zoom where two points `meters` apart at `lat` are `px` apart (512px tiles). */
export function zoomForSeparation(meters: number, lat: number, px = CLUSTER_SPLIT_PX): number {
  if (meters <= 0) return 22;
  const metersPerPxAtZ0 = (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / 512;
  return Math.log2((px * metersPerPxAtZ0) / meters);
}

export function candidateGroups(cands: CompareCandidate[]): CandidateGroup[] {
  const by = new Map<string, CompareCandidate[]>();
  for (const c of cands) {
    if (!c.groupId) continue;
    by.set(c.groupId, [...(by.get(c.groupId) ?? []), c]);
  }
  const out: CandidateGroup[] = [];
  for (const [groupId, members] of by) {
    if (members.length < 2) continue;
    const lat = members.reduce((n, m) => n + m.lat, 0) / members.length;
    const lon = members.reduce((n, m) => n + m.lon, 0) / members.length;
    let minM = Infinity;
    for (let i = 0; i < members.length; i++)
      for (let k = i + 1; k < members.length; k++) minM = Math.min(minM, haversineM(members[i], members[k]));
    out.push({
      groupId,
      members,
      lat,
      lon,
      splitZoom: Math.ceil(zoomForSeparation(minM, lat) * 10) / 10,
      pinPrecision: members.every((m) => m.pinPrecision === 'region') ? 'region' : 'summit',
    });
  }
  return out.sort((a, b) => a.groupId.localeCompare(b.groupId));
}

/** Group ids drawn as separate pins at this zoom (the rest draw as one cluster). */
export function splitGroupsAt(groups: CandidateGroup[], zoom: number): string[] {
  return groups.filter((g) => zoom >= g.splitZoom).map((g) => g.groupId);
}

/** Whether a candidate draws as its own pin at the current split state. */
export function memberVisible(c: Pick<CompareCandidate, 'groupId'>, split: string[], groups: CandidateGroup[]): boolean {
  if (!c.groupId) return true;
  if (!groups.some((g) => g.groupId === c.groupId)) return true;
  return split.includes(c.groupId);
}

export function memberFilter(split: string[], groups: CandidateGroup[]): unknown[] {
  const clustered = groups.map((g) => g.groupId).filter((g) => !split.includes(g));
  return ['!', ['in', ['get', 'groupId'], ['literal', clustered]]];
}

export function clusterFilter(split: string[]): unknown[] {
  return ['!', ['in', ['get', 'groupId'], ['literal', split]]];
}

// ---- GeoJSON ----------------------------------------------------------------

export function compareMembersFC(cands: CompareCandidate[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cands.map(
      (c): Feature => ({
        type: 'Feature',
        properties: {
          id: c.siteId,
          candidateId: c.id,
          name: c.label,
          confidence: c.confidence,
          pinPrecision: c.pinPrecision,
          groupId: c.groupId ?? '',
        },
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      }),
    ),
  };
}

export function compareClustersFC(groups: CandidateGroup[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: groups.map(
      (g): Feature => ({
        type: 'Feature',
        properties: {
          id: g.members[0].siteId,
          groupId: g.groupId,
          count: g.members.length,
          pinPrecision: g.pinPrecision,
          splitZoom: g.splitZoom,
          confidence: g.members[0].confidence,
        },
        geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
      }),
    ),
  };
}

export function compareLinesFC(
  routes: ResolvedRoute[],
  lineFor: (proposedRouteId: string) => { legs: [number, number][][] } | undefined,
): FeatureCollection {
  const features: Feature[] = [];
  for (const r of routes) {
    const path = lineFor(r.route.id);
    const coords = path?.legs.flat() ?? [
      [r.crossing.lon, r.crossing.lat],
      [r.sinai.lon, r.sinai.lat],
    ];
    if (coords.length < 2) continue;
    features.push({
      type: 'Feature',
      properties: { proposedRouteId: r.route.id, advocate: r.route.advocate },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Bounds [w, s, e, n] around a route's two pins, for the camera. */
export function routeBounds(r: ResolvedRoute): [number, number, number, number] {
  const lons = [r.crossing.lon, r.sinai.lon];
  const lats = [r.crossing.lat, r.sinai.lat];
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

// ---- Advocates --------------------------------------------------------------

/**
 * Names behind one proposed route. Today `advocate` is one string that may
 * join several people ("Jim Irwin, Bob Cornuke and Larry Williams"); a future
 * `advocates` array is preferred when present. Non-person labels such as
 * "Traditional pilgrim reconstruction" stay whole.
 */
export function advocateNames(route: Pick<TProposedRoute, 'advocate'> & { advocates?: unknown }): string[] {
  const list = route.advocates;
  if (Array.isArray(list)) {
    const names = list
      .map((a) => (typeof a === 'string' ? a : (a as { name?: unknown })?.name))
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      .map((n) => n.trim());
    if (names.length) return names;
  }
  return route.advocate
    .split(/,\s*|\s+and\s+|\s*&\s*/)
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Short chooser label: "A", "A and B", or "A and N others" (detail lists everyone). */
export function advocateSummary(names: string[], othersWord: (n: number) => string, and = 'and'): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} ${and} ${names[1]}`;
  return `${names[0]} ${and} ${othersWord(names.length - 1)}`;
}

/** Full list in plain English: "A", "A and B", "A, B and C". */
export function advocateList(names: string[], and = 'and'): string {
  if (names.length <= 2) return names.join(` ${and} `);
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}
