import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Confidence, Journey, ProposedRoute, Site, SiteCandidate, type TBundle, type TJourney, type TRoutePath, type TSite } from '../../src/content/schema';
import { candidateIndex, checkCandidates, checkProposedRoutes } from '../../src/content/candidates';
import { index } from '../../src/content/useBundle';

const CONTENT = join(process.cwd(), 'content');
const read = (n: string): unknown[] =>
  existsSync(join(CONTENT, n)) ? (JSON.parse(readFileSync(join(CONTENT, n), 'utf8')) as unknown[]) : [];
const merge = (name: string) => [...read(`${name}.json`), ...read(`${name}.extra.json`), ...read(`${name}.apostles.json`)];

const sites = merge('sites') as TSite[];
const journeys = merge('journeys') as TJourney[];
const routes = merge('routes') as TRoutePath[];
const citIds = new Set((merge('citations') as { id: string }[]).map((c) => c.id));
const exodus = journeys.find((j) => j.id === 'journey-exodus')!;
const crossing = sites.find((s) => s.id === 'site-red-sea-crossing')!;
const sinai = sites.find((s) => s.id === 'site-mount-sinai')!;

const baseCandidate = { label: { en: 'Somewhere' }, lat: 29, lon: 33, confidence: 'disputed', citations: ['cit-x'] };

describe('candidate and proposed-route schema', () => {
  it('still accepts a candidate with none of the new fields', () => {
    expect(SiteCandidate.safeParse(baseCandidate).success).toBe(true);
  });

  it('accepts id, note, body, advocates, pinPrecision, groupId and claimStatus', () => {
    const r = SiteCandidate.safeParse({
      ...baseCandidate,
      id: 'cand-a',
      note: { en: 'A note.' },
      body: { en: 'In short. A note.\n\nWhat was found. A detail.' },
      advocates: [{ name: 'A. Scholar', citationIds: ['cit-x'] }],
      pinPrecision: 'region',
      groupId: 'group-a',
      claimStatus: 'claimed-not-confirmed',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown pinPrecision, an advocate with no source, and an unknown claimStatus', () => {
    expect(SiteCandidate.safeParse({ ...baseCandidate, pinPrecision: 'exact' }).success).toBe(false);
    expect(SiteCandidate.safeParse({ ...baseCandidate, advocates: [{ name: 'A', citationIds: [] }] }).success).toBe(false);
    expect(SiteCandidate.safeParse({ ...baseCandidate, claimStatus: 'proven' }).success).toBe(false);
  });

  it('adds no new confidence grade', () => {
    expect(Confidence.options).toEqual(['high', 'medium', 'legendary', 'disputed']);
  });

  it('requires both candidate ids and a source on a proposed route', () => {
    const ok = { id: 'pr', advocate: 'A', crossingCandidateId: 'a', sinaiCandidateId: 'b', note: { en: 'n' }, citationIds: ['c'] };
    expect(ProposedRoute.safeParse(ok).success).toBe(true);
    expect('leading' in ProposedRoute.shape).toBe(false);
    expect(ProposedRoute.safeParse({ ...ok, sinaiCandidateId: undefined }).success).toBe(false);
    expect(ProposedRoute.safeParse({ ...ok, citationIds: [] }).success).toBe(false);
  });

  it('validates the committed crossing site, Sinai site and Exodus journey', () => {
    expect(Site.safeParse(crossing).success).toBe(true);
    expect(Site.safeParse(sinai).success).toBe(true);
    expect(Journey.safeParse(exodus).success).toBe(true);
  });
});

describe('Exodus crossing and Sinai candidates (committed content)', () => {
  it('has six crossing candidates and eight Sinai candidates (as pins grouped by groupId)', () => {
    const clusters = (s: TSite) => new Set(s.candidates!.map((c) => c.groupId ?? c.id)).size;
    expect(clusters(crossing)).toBe(6);
    expect(clusters(sinai)).toBe(8);
    for (const c of [...crossing.candidates!, ...sinai.candidates!]) {
      expect(c.id).toBeTruthy();
      expect(c.pinPrecision).toBeTruthy();
      expect(c.note?.en).toBeTruthy();
    }
  });

  it('marks every crossing pin as a region', () => {
    expect(crossing.candidates!.every((c) => c.pinPrecision === 'region')).toBe(true);
  });

  it('every proposedRoutes candidate id resolves, crossing on the crossing site and Sinai on the Sinai site', () => {
    const idx = candidateIndex(sites);
    expect(exodus.proposedRoutes?.length).toBeGreaterThan(0);
    for (const pr of exodus.proposedRoutes!) {
      expect(idx.get(pr.crossingCandidateId)?.siteId, pr.id).toBe('site-red-sea-crossing');
      expect(idx.get(pr.sinaiCandidateId)?.siteId, pr.id).toBe('site-mount-sinai');
    }
  });

  it('passes the shared candidate and proposed-route gate', () => {
    expect(checkCandidates(sites, citIds)).toEqual([]);
    expect(checkProposedRoutes(journeys, sites, routes, citIds)).toEqual([]);
  });

  it('groups al-Lawz with Maqla and Musa with Safsafa, and nothing else in those groups', () => {
    const members = (g: string) => sinai.candidates!.filter((c) => c.groupId === g).map((c) => c.id).sort();
    expect(members('group-sinai-lawz-maqla')).toEqual(['cand-sinai-jabal-maqla', 'cand-sinai-jebel-al-lawz']);
    expect(members('group-sinai-musa-safsafa')).toEqual(['cand-sinai-jebel-musa', 'cand-sinai-ras-safsafa']);
  });

  it('keeps unconfirmed Gulf of Aqaba and al-Lawz claims disputed, never a finding', () => {
    const ids = ['cand-crossing-nuweiba', 'cand-crossing-strait-of-tiran', 'cand-sinai-jebel-al-lawz', 'cand-sinai-jabal-maqla'];
    const idx = candidateIndex(sites);
    for (const id of ids) expect((idx.get(id)?.candidate as { confidence?: string }).confidence, id).toBe('disputed');
  });

  it('draws one schematic line per proposed route, never the journey trace', () => {
    const lines = routes.filter((r) => r.proposedRouteId);
    expect(lines.map((r) => r.proposedRouteId).sort()).toEqual(exodus.proposedRoutes!.map((p) => p.id).sort());
    expect(lines.every((r) => r.legGrades?.every((g) => g === 'schematic'))).toBe(true);
    const b = index({ sites, journeys, routes, stops: [], citations: [], persons: [], artifacts: [], witnesses: [], miracles: [], battles: [], videos: [], terms: [], lessons: [], quizzes: [] } as unknown as TBundle);
    expect(b.routeForJourney('journey-exodus')?.id).toBe('route-journey-exodus');
    expect(b.routeForProposedRoute('pr-wood-ballah-tarif')?.id).toBe('route-pr-wood-ballah-tarif');
  });
});

describe('candidate gate catches mistakes', () => {
  const site = (id: string, cands: object[]) => ({ id, candidates: cands }) as unknown as TSite;
  const pin = (id: string, lat: number, lon: number, groupId?: string) => ({ id, lat, lon, groupId });

  it('flags a proposed route whose candidate id does not resolve', () => {
    const s = [site('sea', [pin('x', 30, 32)]), site('mt', [pin('y', 28, 34)])];
    const j = [{ id: 'j', proposedRoutes: [{ id: 'p', crossingCandidateId: 'x', sinaiCandidateId: 'missing', citationIds: ['c'] }] }];
    const errs = checkProposedRoutes(j, s, [{ id: 'r', journeyId: 'j', legs: [[[32, 30], [34, 28]]], proposedRouteId: 'p' }], new Set(['c']));
    expect(errs.some((e) => /unknown sinaiCandidateId 'missing'/.test(e))).toBe(true);
  });

  it('flags a proposed route with no line, and a line off its pin', () => {
    const s = [site('sea', [pin('x', 30, 32)]), site('mt', [pin('y', 28, 34)])];
    const j = [{ id: 'j', proposedRoutes: [{ id: 'p', crossingCandidateId: 'x', sinaiCandidateId: 'y', citationIds: ['c'] }] }];
    expect(checkProposedRoutes(j, s, [], new Set(['c'])).some((e) => /drawn by 0/.test(e))).toBe(true);
    const off = checkProposedRoutes(j, s, [{ id: 'r', journeyId: 'j', legs: [[[32.5, 30], [34, 28]]], proposedRouteId: 'p' }], new Set(['c']));
    expect(off.some((e) => /start is not on crossing candidate/.test(e))).toBe(true);
  });

  it('flags a one-member group, a group split across sites, and a duplicate id', () => {
    const errs = checkCandidates(
      [site('a', [pin('p1', 1, 1, 'g1'), pin('p2', 1, 1, 'g2')]), site('b', [pin('p2', 2, 2, 'g2'), pin('p3', 2, 2, 'g3')])] as never,
      new Set(),
    );
    expect(errs.some((e) => /'g1' has only one member/.test(e))).toBe(true);
    expect(errs.some((e) => /'g2' spans sites/.test(e))).toBe(true);
    expect(errs.some((e) => /duplicate candidate id 'p2'/.test(e))).toBe(true);
  });
});

describe('Exodus crossing and Sinai cards', () => {
  const EM_DASH = '\u2014';
  const fields = (): string[] => {
    const out: string[] = [crossing.summary.en, crossing.coordinates.disputes?.en ?? ''];
    for (const c of [...crossing.candidates!, ...sinai.candidates!]) {
      if (c.note?.en) out.push(c.note.en);
      if (c.body?.en) out.push(c.body.en);
    }
    const drews = (merge('citations') as { id: string; source?: { en?: string }; note?: { en?: string } }[])
      .find((c) => c.id === 'cit-drews-han-2010');
    if (drews?.source?.en) out.push(drews.source.en);
    if (drews?.note?.en) out.push(drews.note.en);
    return out;
  };

  it('puts the crossing In short in summary and the rest in disputes, including how the water part', () => {
    expect(crossing.summary.en.startsWith('The Bible says God opened Yam Suph')).toBe(true);
    expect(crossing.summary.en).not.toMatch(/^In short\./);
    const rest = crossing.coordinates.disputes!.en;
    expect(rest).toContain('What was found.');
    expect(rest).toContain('What it might mean.');
    expect(rest).toContain("What's still uncertain.");
    expect(rest).toContain('How did the water part?');
    expect(rest).toContain('The Bible presents this as God\'s miracle.');
    expect(rest).toContain('not the leading view here');
    expect(rest).toContain('Drews and Han, 2010');
    expect(rest).toContain('an ancient lagoon near Tanis');
    expect(rest).toContain('Sources.');
  });

  it('gives every crossing and Sinai candidate an In short note and a full body', () => {
    const ids = [...crossing.candidates!, ...sinai.candidates!].map((c) => c.id);
    expect(ids.sort()).toEqual([
      'cand-crossing-ballah',
      'cand-crossing-great-bitter-lake',
      'cand-crossing-gulf-of-suez',
      'cand-crossing-head-of-aqaba',
      'cand-crossing-lake-timsah',
      'cand-crossing-nuweiba',
      'cand-crossing-strait-of-tiran',
      'cand-sinai-hala-l-badr',
      'cand-sinai-har-karkom',
      'cand-sinai-hashem-el-tarif',
      'cand-sinai-jabal-maqla',
      'cand-sinai-jebel-al-lawz',
      'cand-sinai-jebel-baghir',
      'cand-sinai-jebel-musa',
      'cand-sinai-jebel-serbal',
      'cand-sinai-jebel-sin-bishar',
      'cand-sinai-ras-safsafa',
    ]);
    for (const c of [...crossing.candidates!, ...sinai.candidates!]) {
      expect(c.note?.en, c.id).toBeTruthy();
      expect(c.note!.en, c.id).not.toMatch(/^In short\./);
      expect(c.body?.en, c.id).toMatch(/^In short\./);
      expect(c.body!.en, c.id).toContain(c.note!.en);
      expect(c.body!.en, c.id).toContain('What was found.');
      expect(c.body!.en, c.id).toContain('Sources.');
    }
  });

  it('does not put an em-dash in the new card strings', () => {
    const hits = fields().filter((s) => s.includes(EM_DASH));
    expect(hits, hits.map((s) => s.slice(0, 80)).join('\n')).toEqual([]);
  });

  it('cites Drews and Han only on the crossing site, tied to the Tanis lagoon', () => {
    expect(crossing.citations).toContain('cit-drews-han-2010');
    expect(crossing.coordinates.citations).not.toContain('cit-drews-han-2010');
    for (const c of [...crossing.candidates!, ...sinai.candidates!]) {
      expect(c.citations, c.id).not.toContain('cit-drews-han-2010');
    }
    const rest = crossing.coordinates.disputes!.en;
    expect(rest).toContain('Tanis');
    for (const c of [...crossing.candidates!, ...sinai.candidates!]) {
      expect(c.body!.en, c.id).not.toContain('Drews and Han');
    }
  });

  it('keeps the Nuweiba wheel and remains cards off the candidate body and out of artifacts', () => {
    const nuweiba = crossing.candidates!.find((c) => c.id === 'cand-crossing-nuweiba')!;
    expect(nuweiba.body!.en).toContain('claims about chariot parts, are treated in a separate card');
    expect(nuweiba.body!.en).not.toMatch(/coral-covered/i);
    expect(nuweiba.body!.en).not.toMatch(/human remains/i);
    const artifacts = merge('artifacts') as { id: string }[];
    expect(artifacts.some((a) => /wheel|remains|nuweiba/i.test(a.id))).toBe(false);
  });

  it('does not mark any proposed route as leading', () => {
    for (const pr of exodus.proposedRoutes!) {
      expect(pr, pr.id).not.toHaveProperty('leading');
    }
  });
});
