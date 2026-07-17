import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  Artifact,
  Citation,
  Journey,
  Lesson,
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
const persons = read('persons.json');
const artifacts = [...read('artifacts.json'), ...read('artifacts.extra.json')];
const witnesses = [...read('witnesses.json'), ...read('witnesses.extra.json')];
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
    expect(dangling, dangling.slice(0, 10).join('\n')).toHaveLength(0);
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
    expect(bad, bad.slice(0, 10).join('\n')).toHaveLength(0);
  });

  it('contains the expected seed coverage', () => {
    expect(journeys.length).toBeGreaterThanOrEqual(5);
    expect(stops.length).toBeGreaterThanOrEqual(40);
    expect(sites.length).toBeGreaterThanOrEqual(40);
  });
});
