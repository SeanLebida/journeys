import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  Artifact,
  Battle,
  Citation,
  Journey,
  Lesson,
  Miracle,
  Person,
  Quiz,
  Site,
  Stop,
  Term,
  Video,
  Witness,
} from '../../src/content/schema';
import { parseScriptureRef } from '../../src/content/scriptureRef';
import { WORLD_BBOX } from '../../src/map/graticule';
import { haversine, type LngLat } from '../../src/map/route';
import { isTertiaryCitation, onlyGenericBackstops, type CiteLike } from '../../src/content/accuracy';

/** Generators emit exact stop coordinates as leg endpoints; 5 km guards drift. */
const ENDPOINT_TOLERANCE_KM = 5;

type SiteLike = {
  id: string;
  pleiadesId?: string;
  dareId?: string;
  citations: string[];
  candidates?: { citations: string[] }[];
  coordinates: {
    value: { lat: number; lon: number };
    confidence: string;
    citations: string[];
    disputes?: unknown;
  };
};

const CONTENT = join(process.cwd(), 'content');
const read = (n: string): unknown[] =>
  existsSync(join(CONTENT, n)) ? (JSON.parse(readFileSync(join(CONTENT, n), 'utf8')) as unknown[]) : [];

const citations = [...read('citations.json'), ...read('citations.extra.json')];
// Merge hand-authored `.extra.json` layers exactly as the build does, so the
// test validates the same content set that ships (base-only reads missed sites
// and stops authored in the extra files).
const sites = [...read('sites.json'), ...read('sites.extra.json')];
const journeys = [...read('journeys.json'), ...read('journeys.extra.json')];
const stops = [...read('stops.json'), ...read('stops.extra.json')];
const persons = [...read('persons.json'), ...read('persons.extra.json')];
const artifacts = [...read('artifacts.json'), ...read('artifacts.extra.json')];
const witnesses = [...read('witnesses.json'), ...read('witnesses.extra.json')];
const miracles = [...read('miracles.json'), ...read('miracles.extra.json')];
const battles = [...read('battles.json'), ...read('battles.extra.json')];
const routes = [...read('routes.json'), ...read('routes.extra.json')];
const videos = [...read('videos.json'), ...read('videos.extra.json')];
const terms = read('terms.json');
const lessons = read('lessons.json');
const quizzes = read('quizzes.json');

// Offline subset of the build-content accuracy gate (no Bible DB / no network).
describe('content integrity (committed source)', () => {
  it('every entity passes its schema', () => {
    const check = (label: string, schema: { safeParse: (x: unknown) => { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } }, items: unknown[]) => {
      const problems: string[] = [];
      items.forEach((it2, i) => {
        const r = schema.safeParse(it2);
        if (!r.success) r.error!.issues.forEach((iss) => problems.push(`${label}[${i}] ${iss.path.join('.')}: ${iss.message}`));
      });
      expect(problems, problems.slice(0, 10).join('\n')).toHaveLength(0);
    };
    check('citations', Citation, citations);
    check('sites', Site, sites);
    check('journeys', Journey, journeys);
    check('stops', Stop, stops);
    check('persons', Person, persons);
    check('artifacts', Artifact, artifacts);
    check('witnesses', Witness, witnesses);
    check('miracles', Miracle, miracles);
    check('battles', Battle, battles);
    check('videos', Video, videos);
    check('terms', Term, terms);
    check('lessons', Lesson, lessons);
    check('quizzes', Quiz, quizzes);
  });

  const citIds = new Set((citations as { id: string }[]).map((c) => c.id));
  const siteIds = new Set((sites as { id: string }[]).map((s) => s.id));
  const stopIds = new Set((stops as { id: string }[]).map((s) => s.id));

  it('has no dangling citation references', () => {
    const dangling: string[] = [];
    const scan = (ids: string[] | undefined, where: string) =>
      (ids ?? []).forEach((id) => !citIds.has(id) && dangling.push(`${where}: ${id}`));
    (sites as { id: string; citations: string[]; coordinates: { citations: string[] } }[]).forEach((s) => {
      scan(s.citations, s.id);
      scan(s.coordinates.citations, `${s.id}.coords`);
    });
    (stops as { id: string; citations: string[] }[]).forEach((s) => scan(s.citations, s.id));
    (miracles as { id: string; citations: string[] }[]).forEach((m) => scan(m.citations, m.id));
    (battles as { id: string; citations: string[] }[]).forEach((b) => scan(b.citations, b.id));
    expect(dangling, dangling.slice(0, 10).join('\n')).toHaveLength(0);
  });

  // Same helpers the build gate uses, so test and gate cannot drift apart.
  const citById = new Map((citations as CiteLike[]).map((c) => [c.id, c]));

  it('no claim rests on tertiary sources alone (constitutional sourcing)', () => {
    // Wikipedia, popular encyclopedias, study-Bible maps and devotional sites
    // are orienting links, never the sole authority: every cited claim must
    // also carry a concrete source (primary text, scholarship, excavation
    // report, or gazetteer). Uncited claims are not checked here.
    const isTertiary = (id: string) => isTertiaryCitation(citById.get(id));
    const bad: string[] = [];
    const req = (ids: string[] | undefined, where: string) => {
      const present = (ids ?? []).filter((id) => citById.has(id));
      if (present.length > 0 && !present.some((id) => !isTertiary(id))) bad.push(where);
    };
    (sites as { id: string; citations: string[]; coordinates: { citations: string[] }; candidates?: { citations: string[] }[] }[]).forEach((s) => {
      req(s.citations, `site ${s.id}`);
      req(s.coordinates.citations, `site ${s.id}.coords`);
      s.candidates?.forEach((c, i) => req(c.citations, `site ${s.id}.cand[${i}]`));
    });
    const each = (arr: unknown[], label: string) =>
      (arr as { id: string; citations?: string[] }[]).forEach((x) => req(x.citations, `${label} ${x.id}`));
    each(journeys, 'journey');
    each(routes, 'route');
    each(stops, 'stop');
    each(persons, 'person');
    each(artifacts, 'artifact');
    each(witnesses, 'witness');
    each(miracles, 'miracle');
    each(battles, 'battle');
    each(terms, 'term');
    each(lessons, 'lesson');
    (quizzes as { id: string; questions: { id: string; citations: string[] }[] }[]).forEach((q) =>
      q.questions.forEach((qq) => req(qq.citations, `quiz ${q.id}.${qq.id}`)),
    );
    expect(bad, `${bad.length} claim(s) cited only to tertiary sources:\n${bad.slice(0, 15).join('\n')}`).toHaveLength(0);
  });

  it('every claim carries at least one citation', () => {
    // `high` confidence is not a free pass — an unsourced assertion is the one
    // failure mode a confidence badge cannot express honestly.
    const bad: string[] = [];
    const req = (ids: string[] | undefined, where: string) => !ids?.length && bad.push(where);
    (sites as SiteLike[]).forEach((s) => {
      req(s.citations, `site ${s.id}`);
      req(s.coordinates.citations, `site ${s.id}.coords`);
    });
    const each = (arr: unknown[], label: string) =>
      (arr as { id: string; citations?: string[] }[]).forEach((x) => req(x.citations, `${label} ${x.id}`));
    each(journeys, 'journey');
    each(stops, 'stop');
    each(persons, 'person');
    each(miracles, 'miracle');
    each(battles, 'battle');
    each(artifacts, 'artifact');
    expect(bad, `${bad.length} uncited claim(s):\n${bad.slice(0, 15).join('\n')}`).toHaveLength(0);
  });

  it('high coordinates never rest on whole-atlas backstops alone', () => {
    // A `high` pin claims a *specific* place; a citation covering the whole
    // atlas cannot support it. A gazetteer id is the accepted alternative.
    const bad = (sites as SiteLike[])
      .filter(
        (s) =>
          s.coordinates.confidence === 'high' &&
          !s.pleiadesId &&
          !s.dareId &&
          onlyGenericBackstops(s.coordinates.citations, citById),
      )
      .map((s) => s.id);
    expect(bad, `${bad.length} site(s):\n${bad.slice(0, 15).join('\n')}`).toHaveLength(0);
  });

  it('ambiguous coordinates show their rivals', () => {
    // medium/disputed must not render as a single confident pin.
    const bad = (sites as SiteLike[])
      .filter((s) => s.coordinates.confidence === 'medium' || s.coordinates.confidence === 'disputed')
      .filter((s) => (s.candidates?.length ?? 0) < 2 && !s.coordinates.disputes)
      .map((s) => `${s.id} (${s.coordinates.confidence})`);
    expect(bad, `${bad.length} site(s) hiding ambiguity:\n${bad.slice(0, 15).join('\n')}`).toHaveLength(0);
  });

  it('narrative claims with scripture cite scripture as a primary source', () => {
    const bad: string[] = [];
    const req = (refs: string[] | undefined, cites: string[] | undefined, where: string) => {
      if (!refs?.length) return;
      if (!(cites ?? []).some((id) => citById.get(id)?.kind === 'primary-scripture')) bad.push(where);
    };
    const each = (arr: unknown[], label: string) =>
      (arr as { id: string; scriptureRefs?: string[]; citations?: string[] }[]).forEach((x) =>
        req(x.scriptureRefs, x.citations, `${label} ${x.id}`),
      );
    each(stops, 'stop');
    each(persons, 'person');
    each(miracles, 'miracle');
    each(battles, 'battle');
    expect(bad, `${bad.length} claim(s):\n${bad.slice(0, 15).join('\n')}`).toHaveLength(0);
  });

  it('route leg grades line up with route legs', () => {
    const bad = (routes as { id: string; legs: unknown[]; legGrades?: unknown[] }[])
      .filter((r) => r.legGrades && r.legGrades.length !== r.legs.length)
      .map((r) => `${r.id}: ${r.legGrades!.length} grades vs ${r.legs.length} legs`);
    expect(bad, bad.join('\n')).toHaveLength(0);
  });

  it('route legs start and end near the stops they connect', () => {
    // A leg that lands far from its stop is drawing a road nobody travelled.
    const siteById = new Map((sites as SiteLike[]).map((s) => [s.id, s]));
    const stopById = new Map((stops as { id: string; siteId: string }[]).map((s) => [s.id, s]));
    const journeyById = new Map((journeys as { id: string; stops: string[] }[]).map((j) => [j.id, j]));
    const coordOf = (stopId: string | undefined): LngLat | undefined => {
      const site = siteById.get(stopById.get(stopId ?? '')?.siteId ?? '');
      return site ? [site.coordinates.value.lon, site.coordinates.value.lat] : undefined;
    };
    const bad: string[] = [];
    (routes as { id: string; journeyId: string; legs: LngLat[][] }[]).forEach((r) => {
      const j = journeyById.get(r.journeyId);
      if (!j || r.legs.length !== j.stops.length - 1) return;
      r.legs.forEach((leg, k) => {
        const a = coordOf(j.stops[k]);
        const b = coordOf(j.stops[k + 1]);
        if (a && haversine(a, leg[0]) > ENDPOINT_TOLERANCE_KM) bad.push(`${r.id} leg ${k}: start off by >${ENDPOINT_TOLERANCE_KM}km`);
        if (b && haversine(b, leg[leg.length - 1]) > ENDPOINT_TOLERANCE_KM) bad.push(`${r.id} leg ${k}: end off by >${ENDPOINT_TOLERANCE_KM}km`);
      });
    });
    expect(bad, bad.slice(0, 10).join('\n')).toHaveLength(0);
  });

  it('every stop references a known site and journey', () => {
    const bad: string[] = [];
    (stops as { id: string; siteId: string }[]).forEach((s) => !siteIds.has(s.siteId) && bad.push(`${s.id}->${s.siteId}`));
    expect(bad, bad.join('\n')).toHaveLength(0);
  });

  it('every journey lists only its own stops', () => {
    const bad: string[] = [];
    (journeys as { id: string; stops: string[] }[]).forEach((j) =>
      j.stops.forEach((sid) => !stopIds.has(sid) && bad.push(`${j.id}->${sid}`)),
    );
    expect(bad, bad.join('\n')).toHaveLength(0);
  });

  it('all site coordinates are inside the world bbox', () => {
    const [w, s, e, n] = WORLD_BBOX;
    const bad: string[] = [];
    (sites as { id: string; coordinates: { value: { lat: number; lon: number } } }[]).forEach((site) => {
      const { lat, lon } = site.coordinates.value;
      if (lon < w || lon > e || lat < s || lat > n) bad.push(`${site.id} ${lat},${lon}`);
    });
    expect(bad, bad.join('\n')).toHaveLength(0);
  });

  it('every scripture reference parses', () => {
    const bad: string[] = [];
    (stops as { id: string; scriptureRefs: string[] }[]).forEach((s) =>
      s.scriptureRefs.forEach((r) => !parseScriptureRef(r) && bad.push(`${s.id}: ${r}`)),
    );
    (miracles as { id: string; scriptureRefs: string[] }[]).forEach((m) =>
      m.scriptureRefs.forEach((r) => !parseScriptureRef(r) && bad.push(`${m.id}: ${r}`)),
    );
    (battles as { id: string; scriptureRefs: string[] }[]).forEach((b) =>
      b.scriptureRefs.forEach((r) => !parseScriptureRef(r) && bad.push(`${b.id}: ${r}`)),
    );
    expect(bad, bad.slice(0, 10).join('\n')).toHaveLength(0);
  });

  it('every battle anchors to a known site with resolvable artifact cross-refs and sane areas', () => {
    const [w, s, e, n] = WORLD_BBOX;
    const artifactIds = new Set((artifacts as { id: string }[]).map((a) => a.id));
    const bad: string[] = [];
    (battles as { id: string; siteId: string; artifactIds?: string[]; area?: [number, number][] }[]).forEach((b) => {
      if (!siteIds.has(b.siteId)) bad.push(`${b.id}->${b.siteId}`);
      b.artifactIds?.forEach((a) => !artifactIds.has(a) && bad.push(`${b.id}->artifact:${a}`));
      if (b.area) {
        const first = b.area[0];
        const last = b.area[b.area.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) bad.push(`${b.id}: area ring not closed`);
        b.area.forEach(([lon, lat]) => {
          if (lon < w || lon > e || lat < s || lat > n) bad.push(`${b.id}: area point ${lat},${lon} out of bbox`);
        });
      }
    });
    expect(bad, bad.join('\n')).toHaveLength(0);
    // Coverage floor: patriarchs -> fall of Jerusalem, incl. the
    // Israel-vs-Judah civil wars.
    expect(battles.length).toBeGreaterThanOrEqual(35);
    expect((battles as { kind: string }[]).filter((b) => b.kind === 'civil-war').length).toBeGreaterThanOrEqual(4);
  });

  it('every miracle is anchored to a known site, with both sections covered', () => {
    const bad: string[] = [];
    const ms = miracles as { id: string; siteId: string; performedBy: string }[];
    ms.forEach((m) => !siteIds.has(m.siteId) && bad.push(`${m.id}->${m.siteId}`));
    expect(bad, bad.join('\n')).toHaveLength(0);
    // The catalogue covers the 37 recorded miracles of Jesus and the
    // disciples' miracles of the Gospels and Acts.
    expect(ms.filter((m) => m.performedBy === 'jesus').length).toBeGreaterThanOrEqual(37);
    expect(ms.filter((m) => m.performedBy === 'disciple').length).toBeGreaterThanOrEqual(20);
  });

  it('contains the expected seed coverage', () => {
    expect(journeys.length).toBeGreaterThanOrEqual(5);
    expect(stops.length).toBeGreaterThanOrEqual(40);
    expect(sites.length).toBeGreaterThanOrEqual(40);
  });
});
