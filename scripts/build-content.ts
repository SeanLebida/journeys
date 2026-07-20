/**
 * Content build + accuracy gate.
 *
 * Validates content/ against the zod schemas, enforces the integrity invariants
 * (the project's mechanical accuracy guarantee), compiles the public-domain
 * Bible text into content.sqlite, and emits the integrity-hashed bundle.json +
 * bundle.schema.json into public/dist-content/.
 *
 * Run: `npm run build:content` (add `--release` to enforce the scholar-review gate).
 *
 * NOTE on "accuracy": these checks prove the content is WELL-FORMED and
 * internally consistent (refs resolve, citations exist, coordinates are sane).
 * They do NOT prove a claim is scholarly-correct — that is the human review gate
 * (reviewStatus), which `--release` enforces.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import initSqlJs from 'sql.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  Artifact,
  Battle,
  Bundle,
  Citation,
  Journey,
  Lesson,
  Miracle,
  Person,
  Quiz,
  RoutePath,
  Site,
  Stop,
  Term,
  Video,
  Witness,
  type TStop,
} from '../src/content/schema';
import { parseScriptureRef } from '../src/content/scriptureRef';
import {
  GENERIC_BACKSTOP_IDS,
  isTertiaryCitation,
  onlyGenericBackstops,
} from '../src/content/accuracy';
import { WORLD_BBOX } from '../src/map/graticule';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const CONTENT = join(ROOT, 'content');
const OUT = join(ROOT, 'public', 'dist-content');
const BIBLE_SRC = join(CONTENT, 'bible-src');
const RELEASE = process.argv.includes('--release');

const TRANSLATIONS = [
  { id: 'KJV', url: 'https://raw.githubusercontent.com/bibleapi/bibleapi-bibles-json/master/kjv.json' },
  { id: 'ASV', url: 'https://raw.githubusercontent.com/bibleapi/bibleapi-bibles-json/master/asv.json' },
];

// Data sources bundled in the app — every one MUST be credited (license gate).
const ATTRIBUTIONS = [
  { id: 'KJV', name: 'King James Version', license: 'Public Domain (UK: Crown copyright)', url: 'https://en.wikipedia.org/wiki/King_James_Version' },
  { id: 'ASV', name: 'American Standard Version (1901)', license: 'Public Domain', url: 'https://en.wikipedia.org/wiki/American_Standard_Version' },
  { id: 'bibleapi', name: 'bibleapi-bibles-json (text source)', license: 'Public Domain texts', url: 'https://github.com/bibleapi/bibleapi-bibles-json' },
  { id: 'MapLibre', name: 'MapLibre GL JS', license: 'BSD-3-Clause', url: 'https://maplibre.org/' },
  { id: 'NaturalEarth', name: 'Natural Earth (coastlines, land, country boundaries, lakes, rivers)', license: 'Public Domain', url: 'https://www.naturalearthdata.com/' },
  { id: 'OpenStreetMap', name: 'OpenStreetMap contributors (planned detailed basemap)', license: 'ODbL', url: 'https://www.openstreetmap.org/copyright' },
  { id: 'Esri', name: 'Esri basemap tiles (shaded relief, World Imagery satellite, World Street Map — optional online layers)', license: '© Esri and its data suppliers; used per Esri basemap terms', url: 'https://www.esri.com/en-us/legal/terms/data-attributions' },
  { id: 'Itinere', name: 'Itiner-e: high-resolution dataset of Roman-empire roads — de Soto, Pažout, Brughmans et al. 2025 (journey route geometry)', license: 'CC BY 4.0', url: 'https://doi.org/10.5281/zenodo.17122148' },
  { id: 'DARE', name: 'Digital Atlas of the Roman Empire — Johan Åhlfeldt, University of Gothenburg (optional online historical basemap)', license: 'CC BY 4.0', url: 'https://dh.gu.se/dare/' },
  { id: 'WikimediaCommons', name: 'Wikimedia Commons photographers (site photos; per-image author and license shown beside each photo)', license: 'Public Domain / CC0 / CC BY / CC BY-SA (per image)', url: 'https://commons.wikimedia.org/' },
  { id: 'Mapillary', name: 'Mapillary contributors (optional click-to-load street-level imagery)', license: 'CC BY-SA 4.0', url: 'https://www.mapillary.com/' },
  { id: 'BibleProject', name: 'BibleProject (optional supplementary overview videos, embedded from YouTube on tap)', license: '© BibleProject; embedded via YouTube, not redistributed', url: 'https://bibleproject.com/' },
  { id: 'Fonts', name: 'Ubuntu and Open Sans typefaces (self-hosted)', license: 'Ubuntu Font Licence 1.0 / SIL Open Font License 1.1', url: 'https://fonts.google.com/' },
];
const REQUIRED_CREDITS = ['KJV', 'ASV', 'MapLibre'];

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

function readJson<T>(name: string, fallback: T): T {
  const p = join(CONTENT, name);
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

function validateArray<S extends z.ZodTypeAny>(label: string, schema: S, items: unknown[]): z.infer<S>[] {
  const ok: z.infer<S>[] = [];
  items.forEach((item, i) => {
    const r = schema.safeParse(item);
    if (r.success) ok.push(r.data);
    else for (const issue of r.error.issues) err(`${label}[${i}] ${issue.path.join('.')}: ${issue.message}`);
  });
  return ok;
}

async function buildBibleDb(): Promise<{ bytes: Uint8Array; verseKeys: Set<string>; counts: Record<string, number> }> {
  mkdirSync(BIBLE_SRC, { recursive: true });
  const SQL = await initSqlJs({ locateFile: (f) => join(ROOT, 'node_modules', 'sql.js', 'dist', f) });
  const db = new SQL.Database();
  db.run(
    'CREATE TABLE verses (translation TEXT, book INTEGER, chapter INTEGER, verse INTEGER, text TEXT);' +
      'CREATE INDEX idx_verses ON verses (translation, book, chapter, verse);',
  );
  const verseKeys = new Set<string>();
  const counts: Record<string, number> = {};

  for (const t of TRANSLATIONS) {
    const cache = join(BIBLE_SRC, `${t.id.toLowerCase()}.json`);
    let json: { field: [number, number, number, number, string] }[];
    if (existsSync(cache)) {
      json = JSON.parse(readFileSync(cache, 'utf8'));
    } else {
      process.stdout.write(`  fetching ${t.id} … `);
      const res = await fetch(t.url);
      if (!res.ok) throw new Error(`failed to fetch ${t.id}: ${res.status}`);
      const data = (await res.json()) as { resultset?: { row?: { field: [number, number, number, number, string] }[] } } | { field: [number, number, number, number, string] }[];
      json = Array.isArray(data) ? data : data.resultset?.row ?? [];
      writeFileSync(cache, JSON.stringify(json));
      process.stdout.write(`${json.length} verses\n`);
    }
    const stmt = db.prepare('INSERT INTO verses VALUES (?,?,?,?,?)');
    db.run('BEGIN');
    for (const row of json) {
      const [, book, chapter, verse, text] = row.field;
      stmt.run([t.id, book, chapter, verse, text]);
      if (t.id === 'KJV') verseKeys.add(`${book}:${chapter}:${verse}`);
    }
    db.run('COMMIT');
    stmt.free();
    counts[t.id] = json.length;
  }
  const bytes = db.export();
  db.close();
  return { bytes, verseKeys, counts };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });

  // 1. Load each entity = generated base + hand-authored `<name>.extra.json`.
  const merged = (name: string) => [
    ...readJson<unknown[]>(`${name}.json`, []),
    ...readJson<unknown[]>(`${name}.extra.json`, []),
  ];
  const citations = merged('citations');
  const sites = merged('sites');
  const journeys = merged('journeys');
  const routes = merged('routes');
  const stops = merged('stops');
  const persons = merged('persons');
  const artifacts = merged('artifacts');
  const witnesses = merged('witnesses');
  const miracles = merged('miracles');
  const battles = merged('battles');
  const videos = merged('videos');
  const terms = merged('terms');
  const lessons = merged('lessons');
  const quizzes = merged('quizzes');

  // 2. Schema validation.
  const vCitations = validateArray('citations', Citation, citations);
  const vSites = validateArray('sites', Site, sites);
  const vJourneys = validateArray('journeys', Journey, journeys);
  const vRoutes = validateArray('routes', RoutePath, routes);
  const vStops = validateArray('stops', Stop, stops);
  const vPersons = validateArray('persons', Person, persons);
  const vArtifacts = validateArray('artifacts', Artifact, artifacts);
  const vWitnesses = validateArray('witnesses', Witness, witnesses);
  const vMiracles = validateArray('miracles', Miracle, miracles);
  const vBattles = validateArray('battles', Battle, battles);
  const vVideos = validateArray('videos', Video, videos);
  const vTerms = validateArray('terms', Term, terms);
  const vLessons = validateArray('lessons', Lesson, lessons);
  const vQuizzes = validateArray('quizzes', Quiz, quizzes);

  // 3. Build lookup sets.
  const citIds = new Set(vCitations.map((c) => c.id));
  const siteIds = new Set(vSites.map((s) => s.id));
  const stopIds = new Set(vStops.map((s) => s.id));
  const journeyIds = new Set(vJourneys.map((j) => j.id));
  const personIds = new Set(vPersons.map((p) => p.id));
  const artifactIds = new Set(vArtifacts.map((a) => a.id));
  const termIds = new Set(vTerms.map((t) => t.id));

  const dupCit = vCitations.length - citIds.size;
  if (dupCit > 0) err(`${dupCit} duplicate citation id(s)`);

  // 4. Citation closure — every referenced id exists.
  const checkCites = (ids: string[] | undefined, where: string) =>
    (ids ?? []).forEach((id) => {
      if (!citIds.has(id)) err(`${where}: dangling citation '${id}'`);
    });
  vSites.forEach((s) => {
    checkCites(s.citations, `site ${s.id}`);
    checkCites(s.coordinates.citations, `site ${s.id}.coordinates`);
    s.candidates?.forEach((c, i) => checkCites(c.citations, `site ${s.id}.candidates[${i}]`));
  });
  vJourneys.forEach((j) => checkCites(j.citations, `journey ${j.id}`));
  vRoutes.forEach((r) => checkCites(r.citations, `route ${r.id}`));
  vStops.forEach((s) => checkCites(s.citations, `stop ${s.id}`));
  vPersons.forEach((p) => checkCites(p.citations, `person ${p.id}`));
  vArtifacts.forEach((a) => checkCites(a.citations, `artifact ${a.id}`));
  vWitnesses.forEach((w) => checkCites(w.citations, `witness ${w.id}`));
  vMiracles.forEach((mi) => checkCites(mi.citations, `miracle ${mi.id}`));
  vBattles.forEach((b) => checkCites(b.citations, `battle ${b.id}`));
  vTerms.forEach((t) => checkCites(t.citations, `term ${t.id}`));
  vLessons.forEach((l) => checkCites(l.citations, `lesson ${l.id}`));
  vQuizzes.forEach((q) => q.questions.forEach((qq) => checkCites(qq.citations, `quiz ${q.id}.${qq.id}`)));

  // 4b. Constitutional sourcing: no claim rests on tertiary sources alone
  // (Wikipedia, popular encyclopedias, study-Bible maps, blogs). Every cited
  // claim needs ≥1 concrete source — primary text, scholarship, excavation,
  // or gazetteer. Uncited claims are not leaning on tertiary, so only
  // non-empty lists are checked here.
  const citById = new Map(vCitations.map((c) => [c.id, c]));
  const requireConcrete = (ids: string[] | undefined, where: string) => {
    const present = (ids ?? []).filter((id) => citIds.has(id));
    if (present.length > 0 && !present.some((id) => !isTertiaryCitation(citById.get(id))))
      err(`${where}: cited only to tertiary/popular sources — needs ≥1 concrete (primary/scholarly/archaeological/gazetteer) source`);
  };
  vSites.forEach((s) => {
    requireConcrete(s.citations, `site ${s.id}`);
    requireConcrete(s.coordinates.citations, `site ${s.id}.coordinates`);
    s.candidates?.forEach((c, i) => requireConcrete(c.citations, `site ${s.id}.candidates[${i}]`));
  });
  vJourneys.forEach((j) => requireConcrete(j.citations, `journey ${j.id}`));
  vRoutes.forEach((r) => requireConcrete(r.citations, `route ${r.id}`));
  vStops.forEach((s) => requireConcrete(s.citations, `stop ${s.id}`));
  vPersons.forEach((p) => requireConcrete(p.citations, `person ${p.id}`));
  vArtifacts.forEach((a) => requireConcrete(a.citations, `artifact ${a.id}`));
  vWitnesses.forEach((w) => requireConcrete(w.citations, `witness ${w.id}`));
  vMiracles.forEach((mi) => requireConcrete(mi.citations, `miracle ${mi.id}`));
  vBattles.forEach((b) => requireConcrete(b.citations, `battle ${b.id}`));
  vTerms.forEach((t) => requireConcrete(t.citations, `term ${t.id}`));
  vLessons.forEach((l) => requireConcrete(l.citations, `lesson ${l.id}`));
  vQuizzes.forEach((q) => q.questions.forEach((qq) => requireConcrete(qq.citations, `quiz ${q.id}.${qq.id}`)));

  // 4c. High coordinates may not rest solely on whole-atlas backstops unless
  // the site carries a place-specific gazetteer id (Pleiades/DARE).
  vSites.forEach((s) => {
    if (s.coordinates.confidence !== 'high') return;
    if (s.pleiadesId || s.dareId) return;
    if (onlyGenericBackstops(s.coordinates.citations, citById))
      err(
        `site ${s.id}.coordinates: high confidence rests only on generic gazetteer/scholarly backstops ` +
          `(${[...GENERIC_BACKSTOP_IDS].filter((id) => s.coordinates.citations.includes(id)).join(', ') || 'generic'}) ` +
          `— add a place-specific cite or pleiadesId/dareId, or downgrade confidence`,
      );
  });

  // 4d. Medium/disputed coordinates must show ambiguity: ≥2 candidates OR a disputes note.
  vSites.forEach((s) => {
    const conf = s.coordinates.confidence;
    if (conf !== 'medium' && conf !== 'disputed') return;
    const nCand = s.candidates?.length ?? 0;
    if (nCand < 2 && !s.coordinates.disputes)
      err(`site ${s.id}.coordinates: ${conf} needs candidates (≥2) or a disputes note`);
  });

  // 4e. Narrative entities with scriptureRefs should cite primary-scripture.
  const requirePrimaryScripture = (refs: string[] | undefined, cites: string[] | undefined, where: string) => {
    if (!refs?.length) return;
    const has = (cites ?? []).some((id) => citById.get(id)?.kind === 'primary-scripture');
    if (!has) err(`${where}: has scriptureRefs but no primary-scripture citation`);
  };
  vStops.forEach((s) => requirePrimaryScripture(s.scriptureRefs, s.citations, `stop ${s.id}`));
  vPersons.forEach((p) => requirePrimaryScripture(p.scriptureRefs, p.citations, `person ${p.id}`));
  vMiracles.forEach((mi) => requirePrimaryScripture(mi.scriptureRefs, mi.citations, `miracle ${mi.id}`));
  vBattles.forEach((b) => requirePrimaryScripture(b.scriptureRefs, b.citations, `battle ${b.id}`));

  // 5. Neutrality invariants — every claim needs ≥1 citation; disputed needs a note.
  const neutralityCheck = (e: { confidence: string; reviewStatus: string; citations: string[]; disputes?: unknown; id: string }, kind: string) => {
    if (e.citations.length < 1) err(`${kind} ${e.id}: every claim needs ≥1 citation`);
    if (e.confidence === 'disputed' && !e.disputes) err(`${kind} ${e.id}: 'disputed' needs a disputes note`);
  };
  vStops.forEach((s) => neutralityCheck(s, 'stop'));
  vArtifacts.forEach((a) => neutralityCheck(a, 'artifact'));
  vWitnesses.forEach((w) => neutralityCheck(w, 'witness'));
  vMiracles.forEach((mi) => neutralityCheck(mi, 'miracle'));
  vBattles.forEach((b) => neutralityCheck(b, 'battle'));

  // 6. Referential integrity.
  vStops.forEach((s) => {
    if (!siteIds.has(s.siteId)) err(`stop ${s.id}: unknown siteId '${s.siteId}'`);
    if (!journeyIds.has(s.journeyId)) err(`stop ${s.id}: unknown journeyId '${s.journeyId}'`);
    s.persons?.forEach((p) => !personIds.has(p) && err(`stop ${s.id}: unknown person '${p}'`));
    s.artifacts?.forEach((a) => !artifactIds.has(a) && err(`stop ${s.id}: unknown artifact '${a}'`));
    s.terms?.forEach((t) => !termIds.has(t) && err(`stop ${s.id}: unknown term '${t}'`));
  });
  vJourneys.forEach((j) => {
    j.stops.forEach((sid) => {
      if (!stopIds.has(sid)) err(`journey ${j.id}: unknown stop '${sid}'`);
      else if (vStops.find((x) => x.id === sid)?.journeyId !== j.id) err(`journey ${j.id}: stop '${sid}' has mismatched journeyId`);
    });
  });
  vLessons.forEach((l) => {
    l.steps.forEach((st, i) => {
      if (st.siteId && !siteIds.has(st.siteId)) err(`lesson ${l.id}.steps[${i}]: unknown siteId '${st.siteId}'`);
      if (st.stopId && !stopIds.has(st.stopId)) err(`lesson ${l.id}.steps[${i}]: unknown stopId '${st.stopId}'`);
    });
  });
  vArtifacts.forEach((a) => {
    if (a.siteId && !siteIds.has(a.siteId)) err(`artifact ${a.id}: unknown siteId '${a.siteId}'`);
  });
  vWitnesses.forEach((w) => {
    w.personIds?.forEach((p) => !personIds.has(p) && err(`witness ${w.id}: unknown person '${p}'`));
    w.siteIds?.forEach((s) => !siteIds.has(s) && err(`witness ${w.id}: unknown site '${s}'`));
  });
  vMiracles.forEach((mi) => {
    if (!siteIds.has(mi.siteId)) err(`miracle ${mi.id}: unknown siteId '${mi.siteId}'`);
    mi.performerIds?.forEach((p) => !personIds.has(p) && err(`miracle ${mi.id}: unknown person '${p}'`));
  });
  vBattles.forEach((b) => {
    if (!siteIds.has(b.siteId)) err(`battle ${b.id}: unknown siteId '${b.siteId}'`);
    b.artifactIds?.forEach((a) => !artifactIds.has(a) && err(`battle ${b.id}: unknown artifact '${a}'`));
  });
  vVideos.forEach((v) => {
    if (v.siteId && !siteIds.has(v.siteId)) err(`video ${v.id}: unknown siteId '${v.siteId}'`);
    if (v.journeyId && !journeyIds.has(v.journeyId)) err(`video ${v.id}: unknown journeyId '${v.journeyId}'`);
    if (v.personId && !personIds.has(v.personId)) err(`video ${v.id}: unknown personId '${v.personId}'`);
    if (v.provider === 'youtube' && !/^[A-Za-z0-9_-]{11}$/.test(v.videoId))
      err(`video ${v.id}: '${v.videoId}' is not a valid 11-char YouTube id`);
  });
  vQuizzes.forEach((q) => {
    if (q.relatedJourneyId && !journeyIds.has(q.relatedJourneyId)) err(`quiz ${q.id}: unknown relatedJourneyId`);
    q.questions.forEach((qq) => {
      if (qq.kind === 'mcq' || qq.kind === 'true-false') {
        if (qq.answerIndex == null || !qq.choices || qq.answerIndex < 0 || qq.answerIndex >= qq.choices.length)
          err(`quiz ${q.id}.${qq.id}: answerIndex out of range`);
      }
      if (qq.kind === 'map-pin') {
        if (!qq.answerSiteId || !siteIds.has(qq.answerSiteId)) err(`quiz ${q.id}.${qq.id}: map-pin needs a valid answerSiteId`);
        if (qq.toleranceKm == null) err(`quiz ${q.id}.${qq.id}: map-pin needs toleranceKm`);
      }
      if (qq.kind === 'order-stops') {
        if (!qq.answerOrder?.length) err(`quiz ${q.id}.${qq.id}: order-stops needs answerOrder`);
        qq.answerOrder?.forEach((sid) => !stopIds.has(sid) && err(`quiz ${q.id}.${qq.id}: unknown stop '${sid}'`));
      }
    });
  });

  // 6b. Route-path integrity: each journey's path must have exactly one leg
  // per stop pair, and every leg must begin/end at (near) its stops — this is
  // what guarantees the animated trace's stop mapping stays truthful.
  const distKm = (a: [number, number], b: [number, number]) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const lineLengthKm = (pts: [number, number][]) => {
    let t = 0;
    for (let i = 1; i < pts.length; i++) t += distKm(pts[i - 1], pts[i]);
    return t;
  };
  const siteById = new Map(vSites.map((x) => [x.id, x]));
  const stopById = new Map(vStops.map((x) => [x.id, x]));
  vRoutes.forEach((r) => {
    const j = vJourneys.find((x) => x.id === r.journeyId);
    if (!j) return err(`route ${r.id}: unknown journeyId '${r.journeyId}'`);
    if (r.legs.length !== j.stops.length - 1)
      return err(`route ${r.id}: ${r.legs.length} legs for ${j.stops.length} stops (need ${j.stops.length - 1})`);
    if (r.legGrades && r.legGrades.length !== r.legs.length)
      err(`route ${r.id}: legGrades length ${r.legGrades.length} != legs length ${r.legs.length}`);
    r.legs.forEach((leg, k) => {
      const sa = siteById.get(stopById.get(j.stops[k])?.siteId ?? '');
      const sb = siteById.get(stopById.get(j.stops[k + 1])?.siteId ?? '');
      if (!sa || !sb) return;
      const a: [number, number] = [sa.coordinates.value.lon, sa.coordinates.value.lat];
      const b: [number, number] = [sb.coordinates.value.lon, sb.coordinates.value.lat];
      // Generators emit EXACT stop coordinates as leg endpoints. The tolerance
      // must scale with the leg: a flat 5 km is meaningless for a 0.9 km walk
      // across Jerusalem, and once let eight Passion-week legs through that
      // were verbatim copies of the Bethany->Jerusalem segment — every one of
      // them "within 5 km" of stops that are themselves ~1 km apart.
      const spanKm = distKm(a, b);
      const tol = Math.max(0.05, Math.min(5, 0.25 * spanKm));
      const startOff = distKm(leg[0] as [number, number], a);
      const endOff = distKm(leg[leg.length - 1] as [number, number], b);
      if (startOff > tol)
        err(`route ${r.id}.legs[${k}]: start is ${startOff.toFixed(2)} km from stop ${j.stops[k]} (tolerance ${tol.toFixed(2)} km on a ${spanKm.toFixed(2)} km leg)`);
      if (endOff > tol)
        err(`route ${r.id}.legs[${k}]: end is ${endOff.toFixed(2)} km from stop ${j.stops[k + 1]} (tolerance ${tol.toFixed(2)} km on a ${spanKm.toFixed(2)} km leg)`);
      // A leg that carries no length while its stops are genuinely apart makes
      // the stop unreachable on the animated timeline — it collapses to the
      // same progress fraction as its neighbour and gets skipped.
      if (spanKm > 0.05 && lineLengthKm(leg as [number, number][]) < 0.5 * spanKm)
        err(`route ${r.id}.legs[${k}]: geometry is ${lineLengthKm(leg as [number, number][]).toFixed(2)} km for a ${spanKm.toFixed(2)} km leg — degenerate, stop would be skipped in playback`);
    });
  });

  // 6c. Soft gazetteer drift warning: when a site has pleiadesId we cannot
  // fetch live coords offline, but we record coverage for the report.
  const withPleiades = vSites.filter((s) => s.pleiadesId).length;
  if (withPleiades < 40) warn(`gazetteer coverage: only ${withPleiades}/ ${vSites.length} sites have pleiadesId (target ≥40 well-attested)`);

  // 7. Geo sanity + date discipline.
  const [w, s, e, n] = WORLD_BBOX;
  vSites.forEach((site) => {
    const { lat, lon } = site.coordinates.value;
    if (lon < w || lon > e || lat < s || lat > n) err(`site ${site.id}: coordinates ${lat},${lon} outside Mediterranean bbox`);
  });
  const dateCheck = (d: { startYear: number; endYear: number; approximate: boolean; display: Record<string, string> }, where: string) => {
    if (!d.display.en) err(`${where}: dateRange missing display.en`);
    if (d.startYear === d.endYear && !d.approximate) warn(`${where}: single-year date not marked approximate (confirm precision)`);
  };
  vRoutes.forEach((r) =>
    r.legs.forEach((leg, k) =>
      leg.forEach(([lon, lat]) => {
        if (lon < w || lon > e || lat < s || lat > n) err(`route ${r.id}.legs[${k}]: point ${lat},${lon} outside world bbox`);
      }),
    ),
  );
  vJourneys.forEach((j) => dateCheck(j.dateRange, `journey ${j.id}`));
  vStops.forEach((st) => dateCheck(st.dateRange, `stop ${st.id}`));
  vBattles.forEach((b) => {
    dateCheck(b.dateRange, `battle ${b.id}`);
    b.area?.forEach(([lon, lat]) => {
      if (lon < w || lon > e || lat < s || lat > n) err(`battle ${b.id}: area point ${lat},${lon} outside world bbox`);
    });
    if (b.area && (b.area[0][0] !== b.area[b.area.length - 1][0] || b.area[0][1] !== b.area[b.area.length - 1][1]))
      err(`battle ${b.id}: area ring is not closed (first point must equal last)`);
  });

  // 8. License completeness.
  const creditIds = new Set(ATTRIBUTIONS.map((a) => a.id));
  REQUIRED_CREDITS.forEach((id) => !creditIds.has(id) && err(`license: required attribution '${id}' missing from credits`));

  // 9. Bible DB + scripture integrity.
  let dbCounts: Record<string, number> = {};
  let verseKeys = new Set<string>();
  try {
    const built = await buildBibleDb();
    writeFileSync(join(OUT, 'content.sqlite'), Buffer.from(built.bytes));
    dbCounts = built.counts;
    verseKeys = built.verseKeys;
  } catch (e2) {
    err(`Bible DB build failed: ${(e2 as Error).message}`);
  }
  const checkRefs = (refs: string[] | undefined, where: string) =>
    (refs ?? []).forEach((raw) => {
      const ref = parseScriptureRef(raw);
      if (!ref) return err(`${where}: unparseable scripture ref '${raw}'`);
      if (verseKeys.size && !verseKeys.has(`${ref.book}:${ref.chapter}:${ref.verseStart}`))
        err(`${where}: scripture ref '${raw}' does not resolve to a verse`);
    });
  vStops.forEach((st: TStop) => checkRefs(st.scriptureRefs, `stop ${st.id}`));
  vPersons.forEach((p) => checkRefs(p.scriptureRefs, `person ${p.id}`));
  vMiracles.forEach((mi) => checkRefs(mi.scriptureRefs, `miracle ${mi.id}`));
  vBattles.forEach((b) => checkRefs(b.scriptureRefs, `battle ${b.id}`));
  vLessons.forEach((l) => l.steps.forEach((st, i) => checkRefs(st.scriptureRefs, `lesson ${l.id}.steps[${i}]`)));

  // 10. Review gate (release only).
  const unreviewed = [
    ...vStops.filter((x) => x.confidence === 'high' && x.reviewStatus !== 'scholar-approved').map((x) => `stop ${x.id}`),
    ...vSites.filter((x) => x.coordinates.confidence === 'high' && x.coordinates.reviewStatus !== 'scholar-approved').map((x) => `site ${x.id}.coordinates`),
    ...vArtifacts.filter((x) => x.confidence === 'high' && x.reviewStatus !== 'scholar-approved').map((x) => `artifact ${x.id}`),
    ...vWitnesses.filter((x) => x.confidence === 'high' && x.reviewStatus !== 'scholar-approved').map((x) => `witness ${x.id}`),
    ...vMiracles.filter((x) => x.confidence === 'high' && x.reviewStatus !== 'scholar-approved').map((x) => `miracle ${x.id}`),
    ...vBattles.filter((x) => x.confidence === 'high' && x.reviewStatus !== 'scholar-approved').map((x) => `battle ${x.id}`),
  ];
  if (unreviewed.length) {
    const msg = `${unreviewed.length} 'high'-confidence claim(s) not yet scholar-approved`;
    if (RELEASE) err(`review gate: ${msg}`);
    else warn(`review gate (non-release): ${msg} — fine for dev, blocks --release`);
  }

  // 11. Assemble bundle + integrity hash, validate, emit.
  const pkgVersion = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;
  const core = {
    version: pkgVersion,
    generatedFrom: 'content/ + research workflow wf_34ddfbb9-26b',
    translations: TRANSLATIONS.map((t) => t.id),
    citations: vCitations,
    sites: vSites,
    journeys: vJourneys,
    routes: vRoutes,
    stops: vStops,
    persons: vPersons,
    artifacts: vArtifacts,
    witnesses: vWitnesses,
    miracles: vMiracles,
    battles: vBattles,
    videos: vVideos,
    terms: vTerms,
    lessons: vLessons,
    quizzes: vQuizzes,
  };
  const integrity = createHash('sha256').update(JSON.stringify(core)).digest('hex').slice(0, 16);
  const bundle = { ...core, integrity, attributions: ATTRIBUTIONS };

  // Sanity: the assembled core must satisfy the Bundle contract.
  const bundleCheck = Bundle.safeParse({ ...core, integrity });
  if (!bundleCheck.success) bundleCheck.error.issues.forEach((i) => err(`bundle: ${i.path.join('.')}: ${i.message}`));

  writeFileSync(join(OUT, 'bundle.json'), JSON.stringify(bundle));
  writeFileSync(join(OUT, 'bundle.schema.json'), JSON.stringify(zodToJsonSchema(Bundle, 'Bundle'), null, 2));

  // OTA manifest: the app fetches this to detect content updates without a store
  // resubmission. `integrity` changes whenever any content changes.
  const manifest = {
    version: core.version,
    integrity,
    generatedAt: new Date().toISOString(),
    translations: core.translations,
    counts: { sites: vSites.length, journeys: vJourneys.length, stops: vStops.length, citations: vCitations.length },
  };
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // 12. Report.
  console.log('\n— Content build —');
  console.log(`  sites ${vSites.length} · journeys ${vJourneys.length} · routes ${vRoutes.length} · stops ${vStops.length} · persons ${vPersons.length} · artifacts ${vArtifacts.length} · witnesses ${vWitnesses.length} · miracles ${vMiracles.length} · battles ${vBattles.length} · videos ${vVideos.length} · terms ${vTerms.length} · lessons ${vLessons.length} · quizzes ${vQuizzes.length}`);
  console.log(`  citations ${vCitations.length} · Bible verses ${Object.entries(dbCounts).map(([k, v]) => `${k}:${v}`).join(' ') || 'none'}`);
  console.log(`  integrity ${integrity}`);
  warnings.forEach((wn) => console.warn(`  ⚠ ${wn}`));
  if (errors.length) {
    console.error(`\n✗ ${errors.length} error(s):`);
    errors.slice(0, 50).forEach((m) => console.error(`  • ${m}`));
    process.exit(1);
  }
  console.log(`\n✓ content valid → public/dist-content/{bundle.json, content.sqlite, bundle.schema.json}`);
}

const invokedDirectly = process.argv[1]?.includes('build-content');
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { main as buildContent };
