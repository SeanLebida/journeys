/**
 * Seed generator (provenance tool, run once).
 *
 * Transforms the research workflow's domain findings into the authored content
 * JSON under content/ (sites.json, journeys.json, stops.json, citations.json).
 * Coordinates, date ranges, scripture refs and citations are copied from the
 * research output — NOT invented here. Re-running overwrites those four files;
 * hand-authored persons/artifacts/terms/lessons/quizzes are kept separately and
 * are not touched.
 *
 * Usage: node scripts/seed/generate.mjs <path-to-research-output.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const researchPath = process.argv[2];
if (!researchPath) {
  console.error('Usage: node scripts/seed/generate.mjs <research-output.json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(researchPath, 'utf8'));
const data = typeof raw.result === 'string' ? JSON.parse(raw.result) : raw.result;

// Flatten all findings, indexed by a punctuation-normalized name (curly vs
// straight quotes, spacing) for tolerant ordered lookup.
const normName = (s) =>
  s
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const byName = new Map();
for (const slice of data.domain) for (const f of slice.findings || []) byName.set(normName(f.name), f);
const lookup = (name) => byName.get(normName(name));

// ---- helpers ----
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const en = (s) => ({ en: s });

function parseDate(str) {
  if (!str) return { startYear: 0, endYear: 0, display: 'date unknown', approximate: true };
  const isBC = /\bBC\b/i.test(str);
  const nums = (str.match(/\d+/g) || []).map(Number).filter((n) => n < 4000);
  if (nums.length === 0) return { startYear: 0, endYear: 0, display: { en: str }, approximate: true };
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (isBC) {
    // N BC -> -N; earlier year (larger N) is the smaller signed value
    const a = -hi;
    const b = -lo;
    lo = a;
    hi = b;
  }
  return {
    startYear: lo,
    endYear: hi,
    display: { en: str },
    approximate: /c\.|circa|\bor\b|\?|~|roughly|around/i.test(str) || lo !== hi,
  };
}

// Normalize a research scripture ref to a single parseable "Book chap:verse"
// (range start). Cross-chapter and chapter-range refs collapse to their start;
// book-only refs get ":1". Anything still unparseable is dropped.
function normalizeRef(ref) {
  let r = ref.trim();
  // "Acts 21:17-23:30" -> "Acts 21:17"
  r = r.replace(/:(\d+)\s*[-–]\s*\d+:\d+/, ':$1');
  // "Mark 8:27-9:1" handled above; "John 13-17" (chapter range) -> "John 13"
  r = r.replace(/^(.*?\D)(\d+)\s*[-–]\s*\d+$/, '$1$2');
  // book-only "1 Corinthians" -> "1 Corinthians 1:1"
  if (!/\d+\s*:/.test(r) && !/\s\d+\s*$/.test(r)) r = `${r} 1:1`;
  // "Galatians 1-2" already reduced; ensure a verse
  if (/\s\d+$/.test(r)) r = `${r}:1`;
  return r;
}

// Citation registry (deduped by url, else by source text).
const citations = [];
const citIndex = new Map();
const usedCitIds = new Set();
function citationKind(url, source) {
  const u = (url || '').toLowerCase();
  if (/unesco|biblicalarchaeology|biblearchaeologyreport|bibleplaces|dannythedigger/.test(u)) return 'archaeological';
  if (/pleiades|awmc|pelagios/.test(u)) return 'gazetteer';
  if (/wikipedia|britannica|byustudies|biola|bibleinterp|jerusalemperspective|seetheholyland|holylandsite/.test(u))
    return 'secondary-scholarly';
  void source;
  return 'secondary-scholarly';
}
function addCitation(c) {
  const key = c.url || c.source;
  if (citIndex.has(key)) return citIndex.get(key);
  let id = `cit-${slug(c.url ? c.url.replace(/^https?:\/\//, '') : c.source)}`.slice(0, 60);
  // Guarantee id uniqueness even when long URLs truncate to the same slug.
  if (usedCitIds.has(id)) {
    const base = id.slice(0, 57);
    let k = 2;
    while (usedCitIds.has(`${base}-${k}`)) k += 1;
    id = `${base}-${k}`;
  }
  usedCitIds.add(id);
  citations.push({ id, source: en(c.source), ...(c.url ? { url: c.url } : {}), kind: citationKind(c.url, c.source) });
  citIndex.set(key, id);
  return id;
}
function citeIdsFor(finding) {
  return (finding.citations || []).filter((c) => c.source).map((c) => addCitation({ source: c.source, url: c.url }));
}

// ---- journey definitions: ordered finding names + leg modes ----
const JOURNEYS = [
  {
    id: 'journey-ministry',
    kind: 'ministry',
    title: 'The Ministry of Jesus',
    dateStr: 'c. AD 27–30 (or to AD 33)',
    summary:
      'The travels of Jesus from Galilee to Jerusalem — his baptism, Galilean ministry around the Sea of Galilee, northern excursions, and the final journey to Jerusalem, crucifixion and resurrection. The crucifixion year (AD 30 vs AD 33) is genuinely disputed; this atlas uses AD 30 as the mainstream default and flags the dispute.',
    color: '#c75b39',
    stops: [
      ['Bethlehem (birth/origin)', 'start'],
      ['Nazareth (boyhood home; rejection)', 'land'],
      ['Baptism at the Jordan / Judean wilderness (start of ministry)', 'land'],
      ['Capernaum (ministry base, Galilee)', 'land'],
      ['Cana of Galilee (first sign: water to wine)', 'land'],
      ['Sea of Galilee (lake ministry, calling of disciples, storm)', 'sea'],
      ['Bethsaida (home of disciples; healings)', 'land'],
      ['Chorazin (woe-city)', 'land'],
      ['Decapolis - Gerasene/Gadarene demoniac (Kursi / Gergesa)', 'sea'],
      ['Tyre and Sidon (Phoenicia)', 'land'],
      ['Caesarea Philippi (Peter’s confession; Transfiguration vicinity)', 'land'],
      ['Samaria - Sychar / Jacob’s Well', 'land'],
      ['Final journey: Jericho (Bartimaeus, Zacchaeus)', 'land'],
      ['Bethany and Bethphage (Lazarus; staging of entry)', 'land'],
      ['Jerusalem - Temple Mount (teaching, cleansing)', 'land'],
      ['Last Supper - Upper Room (Cenacle, Mount Zion)', 'land'],
      ['Gethsemane (agony and arrest)', 'land'],
      ['Trial before Pilate (Praetorium / Gabbatha)', 'land'],
      ['Golgotha and the Tomb (crucifixion, burial, resurrection)', 'land'],
    ],
  },
  {
    id: 'journey-paul-1',
    kind: 'apostolic',
    title: "Paul's First Missionary Journey",
    dateStr: 'c. AD 46–48',
    summary:
      "Barnabas and Saul (Paul), commissioned at Syrian Antioch, sail to Cyprus and then into the highlands of southern Asia Minor (Galatia), preaching in synagogues, founding churches, and returning the way they came (Acts 13–14).",
    color: '#2f6f6b',
    stops: [
      ['Antioch (Syrian Antioch on the Orontes) - departure point', 'start'],
      ['Seleucia Pieria - embarkation port (Journey 1)', 'land'],
      ['Salamis (Cyprus) - first preaching stop (Journey 1)', 'sea'],
      ['Paphos (Nea Paphos) - Sergius Paulus / Elymas episode (Journey 1)', 'land'],
      ['Perga (in Pamphylia) - John Mark departs (Journey 1)', 'sea'],
      ['Pisidian Antioch (Antioch toward Pisidia) - major sermon (Journey 1)', 'land'],
      ['Iconium - mixed response, plot to stone (Journey 1)', 'land'],
      ['Lystra - healing, mistaken for gods, Paul stoned (Journey 1)', 'land'],
      ['Derbe - easternmost point of Journey 1 (turnaround)', 'turnaround'],
      ['Attalia - return port (Journey 1)', 'land'],
    ],
  },
  {
    id: 'journey-paul-2',
    kind: 'apostolic',
    title: "Paul's Second Missionary Journey",
    dateStr: 'c. AD 49–52',
    summary:
      "After the Jerusalem Council, Paul (with Silas, then Timothy and Luke) revisits the Galatian churches, crosses into Europe after the Macedonian vision, and ministers in Philippi, Thessalonica, Berea, Athens and Corinth — the Corinth stay anchored by the Gallio inscription (Acts 15:36–18:22).",
    color: '#c9a227',
    stops: [
      ['Antioch (Syrian Antioch on the Orontes) - departure point', 'start'],
      ['Syria & Cilicia / Tarsus region - overland start of Journey 2', 'land'],
      ['Lystra - healing, mistaken for gods, Paul stoned (Journey 1)', 'land'],
      ['Alexandria Troas - the Macedonian vision (Journey 2)', 'land'],
      ['Samothrace - overnight sea stop (Journey 2)', 'sea'],
      ['Neapolis - first landing in Europe (Journey 2)', 'sea'],
      ['Philippi - Lydia, the slave girl, prison earthquake (Journey 2)', 'land'],
      ['Thessalonica - synagogue ministry, riot ‘turned the world upside down’ (Journey 2)', 'land'],
      ['Berea (Beroea) - ‘noble’ Bereans examine the Scriptures (Journey 2)', 'land'],
      ['Athens - Areopagus address (Journey 2)', 'land'],
      ['Corinth - 18-month stay; Gallio tribunal (Journey 2 anchor)', 'land'],
      ['Cenchreae - port of departure & Paul’s vow (Journey 2)', 'land'],
      ['Ephesus - brief stop, promise to return (Journey 2)', 'sea'],
      ['Caesarea Maritima & Jerusalem - return; end of Journey 2', 'sea'],
    ],
  },
  {
    id: 'journey-paul-3',
    kind: 'apostolic',
    title: "Paul's Third Missionary Journey",
    dateStr: 'c. AD 52–57',
    summary:
      "Paul settles at Ephesus for about three years, then travels through Macedonia and Greece before sailing back toward Jerusalem, meeting the Ephesian elders at Miletus on the way (Acts 18:23–21:16).",
    color: '#6b4a8f',
    stops: [
      ['Antioch on the Orontes (departure point, Third Journey)', 'start'],
      ['Galatia and Phrygia (revisiting the South Galatian churches)', 'land'],
      ['Ephesus (~3-year ministry; center of the Third Journey)', 'land'],
      ['Macedonia (Philippi, Thessalonica, Berea) and Greece', 'sea'],
      ['Troas (Eutychus raised; week-long stop on return)', 'sea'],
      ['Miletus (farewell to the Ephesian elders)', 'sea'],
      ['Caesarea (Philip the evangelist; Agabus’s prophecy) - end of Third Journey', 'sea'],
      ['Jerusalem (arrest in the Temple; transfer to Antonia)', 'land'],
    ],
  },
  {
    id: 'journey-rome',
    kind: 'apostolic',
    title: "Paul's Voyage to Rome",
    dateStr: 'c. AD 59–62 (or 57–60)',
    summary:
      "After two years' imprisonment at Caesarea and his appeal to Caesar, Paul is shipped to Rome as a prisoner, survives the Euraquilo storm and shipwreck on Malta, and reaches Rome for two years of house arrest (Acts 27–28).",
    color: '#8f3a20',
    stops: [
      ['Caesarea imprisonment (Felix, Festus, Agrippa II; appeal to Caesar)', 'start'],
      ['Sidon (first stop of the voyage to Rome)', 'sea'],
      ['Myra of Lycia (transfer to the Alexandrian grain ship)', 'sea'],
      ['Cnidus and Fair Havens (near Lasea), Crete', 'sea'],
      ['Phoenix (intended winter harbor, never reached) and the Euraquilo storm', 'sea'],
      ['Malta shipwreck (Melite) and the three-month winter', 'sea'],
      ['Syracuse, Rhegium, Puteoli (Italy landfall)', 'sea'],
      ['Rome (Forum of Appius, Three Taverns; two-year house arrest)', 'land'],
    ],
  },
];

// ---- build sites + stops ----
const sites = new Map(); // siteId -> Site
const stops = [];
const journeys = [];

// Clean, stable, readable site id from the place name (before " - " / " (" /
// "&"). Multiple findings for the same place dedupe to one site.
function siteBase(name) {
  return name.split(' - ')[0].split(' (')[0].split('&')[0].split('/')[0].trim();
}
function ensureSite(finding) {
  const id = `site-${slug(siteBase(finding.name))}`;
  if (sites.has(id)) return id;
  const cites = citeIdsFor(finding);
  const conf = finding.confidence === 'legendary' ? 'legendary' : finding.confidence || 'medium';
  const site = {
    id,
    ancientName: en(finding.ancientName || finding.name.split(' - ')[0].split(' (')[0].trim()),
    modernLocation: en(finding.modernLocation || 'see citations'),
    coordinates: {
      value: { lat: finding.coordinates.lat, lon: finding.coordinates.lon },
      confidence: conf,
      reviewStatus: 'self-reviewed',
      citations: cites,
      ...(conf === 'disputed' && finding.disputes ? { disputes: en(finding.disputes) } : {}),
    },
    summary: en((finding.summary || finding.name).slice(0, 700)),
    citations: cites,
  };
  if (finding.disputes && /disputed|debate/i.test(finding.modernLocation || finding.disputes || '')) {
    site.coordinates.confidence = conf === 'high' ? 'medium' : conf;
  }
  sites.set(id, site);
  return id;
}

for (const j of JOURNEYS) {
  const stopIds = [];
  let order = 0;
  const allCites = new Set();
  for (const [name, legMode] of j.stops) {
    const f = lookup(name);
    if (!f || !f.coordinates) {
      console.warn(`! no coordinates for "${name}" — skipped`);
      continue;
    }
    const siteId = ensureSite(f);
    const cites = citeIdsFor(f);
    cites.forEach((c) => allCites.add(c));
    const refs = [...new Set((f.scriptureRefs || []).map(normalizeRef))];
    const conf = f.confidence === 'legendary' ? 'legendary' : f.confidence || 'medium';
    const stopId = `stop-${j.id.replace('journey-', '')}-${slug(siteBase(f.name))}-${order}`;
    stops.push({
      id: stopId,
      journeyId: j.id,
      order,
      siteId,
      legMode,
      dateRange: parseDate(f.dateRange),
      eventSummary: en((f.summary || f.name).slice(0, 600)),
      scriptureRefs: refs,
      confidence: conf,
      reviewStatus: 'self-reviewed',
      ...(conf === 'disputed' && f.disputes ? { disputes: en(f.disputes) } : {}),
      citations: cites,
    });
    stopIds.push(stopId);
    order += 1;
  }
  journeys.push({
    id: j.id,
    title: en(j.title),
    kind: j.kind,
    dateRange: parseDate(j.dateStr),
    summary: en(j.summary),
    color: j.color,
    stops: stopIds,
    citations: [...allCites],
  });
}

const outDir = resolve(process.cwd(), 'content');
const write = (name, obj) => {
  writeFileSync(resolve(outDir, name), JSON.stringify(obj, null, 2) + '\n');
  console.log(`wrote content/${name} (${Array.isArray(obj) ? obj.length : Object.keys(obj).length} items)`);
};
write('citations.json', citations);
write('sites.json', [...sites.values()]);
write('journeys.json', journeys);
write('stops.json', stops);
console.log(`\nTotals: ${sites.size} sites, ${journeys.length} journeys, ${stops.length} stops, ${citations.length} citations`);
