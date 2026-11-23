/**
 * Integrity checks for rival site candidates and the crossing-to-Sinai
 * `proposedRoutes` that pair them. Shared by `scripts/build-content.ts` and the
 * offline content tests, like `accuracy.ts`, so gate and tests stay in step.
 */

type LngLat = [number, number];
type CandidateLike = { id?: string; lat: number; lon: number; groupId?: string; advocates?: { citationIds: string[] }[] };
type SiteLike = { id: string; candidates?: CandidateLike[] };
type ProposedRouteLike = { id: string; crossingCandidateId: string; sinaiCandidateId: string; citationIds: string[] };
type JourneyLike = { id: string; proposedRoutes?: ProposedRouteLike[] };
type RouteLike = { id: string; journeyId: string; legs: LngLat[][]; proposedRouteId?: string };

/** A proposed-route line must start and end on its candidate pins (generators emit exact pins). */
export const PROPOSED_ROUTE_ENDPOINT_KM = 0.05;

function haversineKm(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Every candidate with an id, keyed by id, with the site it belongs to. */
export function candidateIndex(sites: SiteLike[]): Map<string, { siteId: string; candidate: CandidateLike }> {
  const out = new Map<string, { siteId: string; candidate: CandidateLike }>();
  for (const s of sites) for (const c of s.candidates ?? []) if (c.id && !out.has(c.id)) out.set(c.id, { siteId: s.id, candidate: c });
  return out;
}

/** Candidate ids are unique; each groupId has 2+ members, all on one site. */
export function checkCandidates(sites: SiteLike[], citIds: Set<string>): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  const groups = new Map<string, { siteIds: Set<string>; n: number }>();
  for (const s of sites) {
    (s.candidates ?? []).forEach((c, i) => {
      if (c.id) {
        if (seen.has(c.id)) errs.push(`site ${s.id}.candidates[${i}]: duplicate candidate id '${c.id}'`);
        seen.add(c.id);
      }
      if (c.groupId) {
        const g = groups.get(c.groupId) ?? { siteIds: new Set<string>(), n: 0 };
        g.siteIds.add(s.id);
        g.n += 1;
        groups.set(c.groupId, g);
      }
      c.advocates?.forEach((a, k) =>
        a.citationIds.forEach((id) => {
          if (!citIds.has(id)) errs.push(`site ${s.id}.candidates[${i}].advocates[${k}]: dangling citation '${id}'`);
        }),
      );
    });
  }
  for (const [gid, g] of groups) {
    if (g.n < 2) errs.push(`candidate group '${gid}' has only one member`);
    if (g.siteIds.size > 1) errs.push(`candidate group '${gid}' spans sites ${[...g.siteIds].join(', ')}`);
  }
  return errs;
}

/**
 * Every proposed route resolves both candidate ids, cites real sources, and is
 * drawn by exactly one single-leg RoutePath that runs from the crossing pin to
 * the Sinai pin. Every RoutePath with a `proposedRouteId` points at a real entry.
 */
export function checkProposedRoutes(
  journeys: JourneyLike[],
  sites: SiteLike[],
  routes: RouteLike[],
  citIds: Set<string>,
): string[] {
  const errs: string[] = [];
  const cands = candidateIndex(sites);
  const entries = new Map<string, { journeyId: string; pr: ProposedRouteLike }>();
  for (const j of journeys) {
    (j.proposedRoutes ?? []).forEach((pr) => {
      const where = `journey ${j.id}.proposedRoutes ${pr.id}`;
      if (entries.has(pr.id)) errs.push(`${where}: duplicate proposed route id`);
      entries.set(pr.id, { journeyId: j.id, pr });
      if (!cands.has(pr.crossingCandidateId)) errs.push(`${where}: unknown crossingCandidateId '${pr.crossingCandidateId}'`);
      if (!cands.has(pr.sinaiCandidateId)) errs.push(`${where}: unknown sinaiCandidateId '${pr.sinaiCandidateId}'`);
      const a = cands.get(pr.crossingCandidateId);
      const b = cands.get(pr.sinaiCandidateId);
      if (a && b && a.siteId === b.siteId) errs.push(`${where}: crossing and Sinai candidates are on the same site '${a.siteId}'`);
      pr.citationIds.forEach((id) => {
        if (!citIds.has(id)) errs.push(`${where}: dangling citation '${id}'`);
      });
    });
  }
  const drawn = new Map<string, number>();
  for (const r of routes) {
    if (!r.proposedRouteId) continue;
    const e = entries.get(r.proposedRouteId);
    if (!e) {
      errs.push(`route ${r.id}: unknown proposedRouteId '${r.proposedRouteId}'`);
      continue;
    }
    if (e.journeyId !== r.journeyId) errs.push(`route ${r.id}: journeyId '${r.journeyId}' != proposed route's journey '${e.journeyId}'`);
    drawn.set(r.proposedRouteId, (drawn.get(r.proposedRouteId) ?? 0) + 1);
    if (r.legs.length !== 1) {
      errs.push(`route ${r.id}: a proposed route has exactly one leg, found ${r.legs.length}`);
      continue;
    }
    const leg = r.legs[0];
    const a = cands.get(e.pr.crossingCandidateId)?.candidate;
    const b = cands.get(e.pr.sinaiCandidateId)?.candidate;
    if (a && haversineKm(leg[0], [a.lon, a.lat]) > PROPOSED_ROUTE_ENDPOINT_KM)
      errs.push(`route ${r.id}: start is not on crossing candidate '${e.pr.crossingCandidateId}'`);
    if (b && haversineKm(leg[leg.length - 1], [b.lon, b.lat]) > PROPOSED_ROUTE_ENDPOINT_KM)
      errs.push(`route ${r.id}: end is not on Sinai candidate '${e.pr.sinaiCandidateId}'`);
  }
  for (const id of entries.keys()) {
    const n = drawn.get(id) ?? 0;
    if (n !== 1) errs.push(`proposed route ${id}: drawn by ${n} route paths (need exactly 1)`);
  }
  return errs;
}
