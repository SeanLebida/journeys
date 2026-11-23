import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FADED_OPACITY,
  LINE_IDLE_OPACITY,
  NO_SELECTION,
  advocateList,
  advocateNames,
  advocateSummary,
  candidateEmphasis,
  candidateGroups,
  clusterFilter,
  clusterOpacity,
  compareCandidates,
  compareSiteIds,
  groupEmphasis,
  lineOpacity,
  memberFilter,
  memberOpacity,
  memberVisible,
  resolvedRoutes,
  routesForSite,
  selectionFor,
  splitGroupsAt,
  zoomForSeparation,
} from './exodusCompare';
import type { TJourney, TSite } from '../content/schema';

const CONTENT = join(process.cwd(), 'content');
const read = (n: string): unknown[] =>
  existsSync(join(CONTENT, n)) ? (JSON.parse(readFileSync(join(CONTENT, n), 'utf8')) as unknown[]) : [];
const sites = [...read('sites.json'), ...read('sites.extra.json')] as TSite[];
const journeys = [...read('journeys.json'), ...read('journeys.extra.json')] as TJourney[];
const bundle = { sites, journeys };

const routes = resolvedRoutes(bundle);
const cands = compareCandidates(bundle);
const groups = candidateGroups(cands);

describe('Whose map? routes', () => {
  it('resolves every proposed route to two compared pins', () => {
    const authored = journeys.flatMap((j) => j.proposedRoutes ?? []);
    expect(authored.length).toBeGreaterThanOrEqual(9);
    expect(routes).toHaveLength(authored.length);
    for (const r of routes) {
      expect(r.crossing.siteId).toBe('site-red-sea-crossing');
      expect(r.sinai.siteId).toBe('site-mount-sinai');
    }
  });

  it('orders routes geographically, south to north by crossing point', () => {
    const lats = routes.map((r) => r.crossing.lat);
    expect([...lats].sort((a, b) => a - b)).toEqual(lats);
    const lake = (id: string) => /ballah|bitter-lake|timsah/.test(id);
    const firstLake = routes.findIndex((r) => lake(r.crossing.id));
    const lastNonLake = routes.map((r) => lake(r.crossing.id)).lastIndexOf(false);
    expect(firstLake).toBeGreaterThan(lastNonLake);
    expect(lake(routes[0].crossing.id)).toBe(false);
  });

  it('lists every route in both the crossing and the Sinai sheet', () => {
    expect(routesForSite(routes, 'site-red-sea-crossing')).toHaveLength(routes.length);
    expect(routesForSite(routes, 'site-mount-sinai')).toHaveLength(routes.length);
    expect(routesForSite(routes, 'site-capernaum')).toEqual([]);
  });

  it('only marks the two compared sites as having no working dot', () => {
    expect([...compareSiteIds(bundle)].sort()).toEqual(['site-mount-sinai', 'site-red-sea-crossing']);
  });

});

describe('selection and fade', () => {
  it('draws every candidate and line equally when nothing is picked', () => {
    expect(selectionFor(routes, null)).toEqual(NO_SELECTION);
    expect(selectionFor(routes, 'no-such-route')).toEqual(NO_SELECTION);
    for (const c of cands) expect(candidateEmphasis(NO_SELECTION, c.id)).toBe('equal');
    for (const g of groups) expect(groupEmphasis(NO_SELECTION, g.groupId)).toBe('equal');
    expect(memberOpacity(NO_SELECTION, 0.9)).toBe(0.9);
    expect(clusterOpacity(NO_SELECTION, 0.9)).toBe(0.9);
    expect(lineOpacity(NO_SELECTION)).toBe(LINE_IDLE_OPACITY);
  });

  it('highlights only the picked pairing and fades the rest, never hiding it', () => {
    const sel = selectionFor(routes, 'pr-wyatt-nuweiba-lawz');
    expect(sel.candidateIds.sort()).toEqual(['cand-crossing-nuweiba', 'cand-sinai-jebel-al-lawz']);
    expect(sel.groupIds).toEqual(['group-sinai-lawz-maqla']);
    expect(candidateEmphasis(sel, 'cand-crossing-nuweiba')).toBe('highlight');
    expect(candidateEmphasis(sel, 'cand-sinai-jebel-musa')).toBe('faded');
    // Maqla is not on this route, but its cluster holds al-Lawz, so the cluster stays bright.
    expect(candidateEmphasis(sel, 'cand-sinai-jabal-maqla')).toBe('faded');
    expect(groupEmphasis(sel, 'group-sinai-lawz-maqla')).toBe('highlight');
    expect(groupEmphasis(sel, 'group-sinai-musa-safsafa')).toBe('faded');
    expect(memberOpacity(sel, 1)).toEqual([
      'case',
      ['in', ['get', 'candidateId'], ['literal', sel.candidateIds]],
      1,
      FADED_OPACITY,
    ]);
    expect(FADED_OPACITY).toBeGreaterThan(0);
    const line = lineOpacity(sel) as unknown[];
    expect(line[1]).toEqual(['==', ['get', 'proposedRouteId'], 'pr-wyatt-nuweiba-lawz']);
    expect(line[3]).toBeGreaterThan(0);
  });
});

describe('clusters', () => {
  it('groups Lawz with Maqla, Musa with Safsafa, and the two isthmus lakes', () => {
    const ids = Object.fromEntries(groups.map((g) => [g.groupId, g.members.map((m) => m.id).sort()]));
    expect(ids['group-sinai-lawz-maqla']).toEqual(['cand-sinai-jabal-maqla', 'cand-sinai-jebel-al-lawz']);
    expect(ids['group-sinai-musa-safsafa']).toEqual(['cand-sinai-jebel-musa', 'cand-sinai-ras-safsafa']);
    expect(groups.find((g) => g.groupId === 'group-crossing-isthmus-lakes')?.pinPrecision).toBe('region');
  });

  it('splits closer pairs at higher zoom', () => {
    const z = (id: string) => groups.find((g) => g.groupId === id)!.splitZoom;
    expect(z('group-sinai-musa-safsafa')).toBeGreaterThan(z('group-sinai-lawz-maqla'));
    expect(zoomForSeparation(1000, 30) - zoomForSeparation(2000, 30)).toBeCloseTo(1, 5);
  });

  it('shows one cluster at low zoom and each member once zoomed in', () => {
    const low = splitGroupsAt(groups, 4);
    expect(low).toEqual([]);
    const lawz = cands.find((c) => c.id === 'cand-sinai-jebel-al-lawz')!;
    const serbal = cands.find((c) => c.id === 'cand-sinai-jebel-serbal')!;
    expect(memberVisible(lawz, low, groups)).toBe(false);
    expect(memberVisible(serbal, low, groups)).toBe(true);
    const high = splitGroupsAt(groups, 16);
    expect(high.sort()).toEqual(groups.map((g) => g.groupId).sort());
    expect(memberVisible(lawz, high, groups)).toBe(true);
    expect(memberFilter(high, groups)).toEqual(['!', ['in', ['get', 'groupId'], ['literal', []]]]);
    expect(clusterFilter(high)).toEqual(['!', ['in', ['get', 'groupId'], ['literal', high]]]);
  });
});

describe('advocate labels', () => {
  const others = (n: number) => `${n} other${n === 1 ? '' : 's'}`;
  it('handles one, two and many names', () => {
    expect(advocateNames({ advocate: 'Colin Humphreys' })).toEqual(['Colin Humphreys']);
    expect(advocateNames({ advocate: 'Traditional pilgrim reconstruction' })).toEqual([
      'Traditional pilgrim reconstruction',
    ]);
    const trio = advocateNames({ advocate: 'Jim Irwin, Bob Cornuke and Larry Williams' });
    expect(trio).toEqual(['Jim Irwin', 'Bob Cornuke', 'Larry Williams']);
    expect(advocateSummary(['Ron Wyatt', 'Lennart Moller'], others)).toBe('Ron Wyatt and Lennart Moller');
    expect(advocateSummary(trio, others)).toBe('Jim Irwin and 2 others');
    expect(advocateList(trio)).toBe('Jim Irwin, Bob Cornuke and Larry Williams');
  });

  it('prefers an advocates array when the data carries one', () => {
    const names = advocateNames({
      advocate: 'Menashe Har-El',
      advocates: [{ name: 'Menashe Har-El' }, { name: 'Gordon Franz' }, 'David Faiman', { name: 'Carl Rasmussen' }],
    });
    expect(advocateSummary(names, others)).toBe('Menashe Har-El and 3 others');
  });
});
