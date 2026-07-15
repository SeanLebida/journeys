#!/usr/bin/env node
/**
 * Fetch one representative, freely-licensed present-day photo per site from
 * Wikipedia/Wikimedia Commons, bundle it locally for offline use, and emit
 * `src/content/siteImages.json` with full credit + license metadata.
 *
 * Curation model: every site maps to a hand-picked English Wikipedia article
 * whose lead image ("page image") shows the place as it looks in the modern
 * day — the excavated ruins, the traditional church, or the modern city — or
 * directly to a specific Commons `File:` when an article's lead image is
 * unsuitable (e.g. a locator map). Photos are illustrative media, NOT factual
 * claims, so they live outside the cited-content accuracy gate; licensing is
 * still enforced: only Public Domain / CC0 / CC BY / CC BY-SA files are
 * accepted, and author + license ship with each image and render in the app.
 *
 * Usage:  node scripts/fetch-site-images.mjs [--dry-run]
 * Output: public/images/sites/<siteId>.jpg + src/content/siteImages.json
 *
 * Re-runnable: skips downloads that already exist unless --force is given.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'images', 'sites');
const OUT_JSON = join(ROOT, 'src', 'content', 'siteImages.json');
const THUMB_WIDTH = 960;
const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const UA = 'JourneysAtlas/0.2 (offline biblical-journeys atlas; site imagery pipeline)';

/** Licenses we accept (matched against Commons LicenseShortName, case-insensitive prefix). */
const FREE_LICENSES = ['public domain', 'pd', 'cc0', 'cc by', 'cc-by', 'attribution', 'no restrictions', 'copyrighted free use'];

/**
 * siteId → { article } (use that Wikipedia article's lead image) or
 *          { file }    (use this exact Commons file, no "File:" prefix).
 * `caption` overrides the default caption built from the article title.
 */
const SITE_SOURCES = {
  'site-bethlehem': { article: 'Church of the Nativity', caption: 'The Church of the Nativity, Bethlehem, today' },
  'site-nazareth': { article: 'Basilica of the Annunciation', caption: 'The Basilica of the Annunciation in modern Nazareth' },
  'site-baptism-at-the-jordan': { article: 'Al-Maghtas', caption: 'Al-Maghtas (Bethany beyond the Jordan) on the Jordan River today' },
  'site-capernaum': { article: 'Capernaum', caption: 'The excavated ruins of Capernaum on the Sea of Galilee' },
  'site-cana-of-galilee': { file: 'Wedding Church (Orthodox) Kafr Kanna (1).jpg', caption: 'The Wedding Church at Kafr Kanna, traditional Cana, today' },
  'site-sea-of-galilee': { article: 'Sea of Galilee', caption: 'The Sea of Galilee (Lake Kinneret) today' },
  'site-bethsaida': { file: 'Tel Bethsaida (2).jpg', caption: 'The mound of et-Tell, a leading candidate for Bethsaida' },
  'site-chorazin': { article: 'Chorazin', caption: 'Basalt synagogue ruins at Chorazin (Korazim National Park)' },
  'site-decapolis': { article: 'Kursi, Sea of Galilee', caption: 'Kursi on the eastern shore of the Sea of Galilee, in the Decapolis region' },
  'site-tyre-and-sidon': { article: 'Tyre, Lebanon', caption: 'Tyre (Sur), Lebanon, in the modern day' },
  'site-caesarea-philippi': { article: 'Banias', caption: 'The springs and grotto of Banias (Caesarea Philippi) today' },
  'site-samaria': { article: "Jacob's Well", caption: "Jacob's Well near modern Nablus" },
  'site-final-journey-jericho': { article: 'Jericho', caption: 'Modern Jericho in the Jordan Valley' },
  'site-bethany-and-bethphage': { file: 'Greek Orthodox Church al-Eizariya.jpg', caption: 'Al-Eizariya (Bethany) on the Mount of Olives today' },
  'site-jerusalem': { article: 'Temple Mount', caption: 'The Temple Mount / Haram al-Sharif, Jerusalem, today' },
  'site-last-supper': { article: 'Cenacle', caption: 'The Cenacle on Mount Zion, traditional Upper Room' },
  'site-gethsemane': { article: 'Gethsemane', caption: 'Ancient olive trees in the Garden of Gethsemane today' },
  'site-trial-before-pilate': { article: 'Tower of David', caption: 'The Tower of David citadel, near the site of Herod’s palace' },
  'site-golgotha-and-the-tomb': { article: 'Church of the Holy Sepulchre', caption: 'The Church of the Holy Sepulchre, Jerusalem, today' },
  'site-antioch': { article: 'Antakya', caption: 'Antakya (ancient Antioch), Turkey, in the modern day' },
  'site-seleucia-pieria': { article: 'Vespasianus Titus Tunnel', caption: 'The Titus Tunnel at Seleucia Pieria (Çevlik, Turkey) today' },
  'site-salamis': { article: 'Salamis, Cyprus', caption: 'The ruins of Salamis, Cyprus, today' },
  'site-paphos': { article: 'Paphos Archaeological Park', caption: 'Paphos Archaeological Park, Cyprus, today' },
  'site-perga': { article: 'Perga', caption: 'The colonnaded ruins of Perga, near Antalya, today' },
  'site-pisidian-antioch': { article: 'Antioch of Pisidia', caption: 'Ruins of Pisidian Antioch near Yalvaç, Turkey' },
  'site-iconium': { article: 'Mevlana Museum', caption: 'Konya (ancient Iconium), Turkey, today' },
  'site-lystra': { file: 'Kilistra lystra38.JPG', caption: 'Rock-cut Kilistra (Gökyurt) in the countryside of ancient Lystra' },
  'site-derbe': { article: 'Karaman', caption: 'Karaman, Turkey — the mound of Kerti Höyük (ancient Derbe) lies ~24 km northeast' },
  'site-attalia': { file: 'Antalya kaleiçi 2.jpg', caption: 'The old harbor quarter (Kaleiçi) of Antalya, ancient Attalia' },
  'site-syria': { article: 'Tarsus, Mersin', caption: 'Tarsus, Turkey — chief city of the Syria–Cilicia region' },
  'site-alexandria-troas': { article: 'Alexandria Troas', caption: 'Ruins of Alexandria Troas near Dalyan, Turkey' },
  'site-samothrace': { article: 'Samothrace', caption: 'The island of Samothrace today' },
  'site-neapolis': { article: 'Kavala', caption: 'Kavala (ancient Neapolis), Greece, today' },
  'site-philippi': { article: 'Philippi', caption: 'The ruins of Philippi, Greece, today' },
  'site-thessalonica': { article: 'Thessaloniki', caption: 'Modern Thessaloniki (ancient Thessalonica)' },
  'site-berea': { article: 'Veria', caption: 'Veria (ancient Berea), Greece, today' },
  'site-athens': { article: 'Areopagus', caption: 'The Areopagus rock below the Acropolis, Athens, today' },
  'site-corinth': { file: 'Korinth BW 2017-10-10 10-55-28.jpg', caption: 'The Temple of Apollo at Ancient Corinth today' },
  'site-cenchreae': { article: 'Kechries', caption: 'Kechries (ancient Cenchreae), the eastern port of Corinth, today' },
  'site-ephesus': { article: 'Ephesus', caption: 'The Library of Celsus at Ephesus today' },
  'site-caesarea-maritima': { article: 'Caesarea Maritima', caption: 'The ruins of Caesarea Maritima today' },
  'site-antioch-on-the-orontes': { file: 'Antakya Church of St. Peter exterior ın 2025 05.jpg', caption: 'The cave Church of St Peter at Antakya (Antioch) today' },
  'site-galatia-and-phrygia': { file: 'Aquaduct pisidia antiochia - panoramio.jpg', caption: 'The Roman aqueduct near Yalvaç, on the Anatolian plateau of old Galatia–Phrygia' },
  'site-macedonia': { file: 'Kavala egnatia 1.JPG', caption: 'Remains of the Via Egnatia, the Roman road across Macedonia, at Kavala' },
  'site-troas': { article: 'Alexandria Troas', caption: 'The harbor ruins of Alexandria Troas today' },
  'site-miletus': { article: 'Miletus', caption: 'The great theater of Miletus today' },
  'site-caesarea': { file: 'Caesarea Theatre.jpg', caption: 'The Roman theater at Caesarea Maritima today' },
  'site-caesarea-imprisonment': { file: 'Aqueduct, Caesarea, Israel.JPG', caption: 'The Roman aqueduct at Caesarea, where Paul was held two years' },
  'site-sidon': { article: 'Sidon', caption: 'The Sea Castle at Sidon (Saida), Lebanon, today' },
  'site-myra-of-lycia': { article: 'Myra', caption: 'Rock-cut tombs and theater at Myra (Demre), Turkey' },
  'site-cnidus-and-fair-havens': { article: 'Knidos', caption: 'The ruins and twin harbors of Knidos today' },
  'site-phoenix': { file: 'Loutro (Chania)-01.jpg', caption: 'Loutro on the south coast of Crete, near ancient Phoenix' },
  'site-malta-shipwreck': { article: "Saint Paul's Bay", caption: "Saint Paul's Bay, Malta, today" },
  'site-syracuse-rhegium-puteoli': { article: 'Syracuse, Sicily', caption: 'Syracuse, Sicily, in the modern day' },
  'site-rome': { article: 'Appian Way', caption: 'The Appian Way, the road by which Paul reached Rome' },
  'site-patmos': { article: 'Patmos', caption: 'The island of Patmos today' },
  'site-hierapolis': { article: 'Hierapolis', caption: 'The travertine terraces and ruins of Hierapolis (Pamukkale)' },
  'site-alexandria': { file: 'Citadel of Qaitbay, Alexandria, Egypt.jpg', caption: 'The Citadel of Qaitbay, Alexandria — site of the ancient Pharos lighthouse' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Polite fetch: serialized by the main loop, retries 429/5xx with backoff. */
async function politeFetch(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      await sleep(Math.max(retryAfter * 1000, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
}

async function getJson(url) {
  return (await politeFetch(url)).json();
}

/** Lead image file name (no File: prefix) for a Wikipedia article. */
async function pageImageFile(article) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(article)}`;
  const data = await getJson(u);
  const page = data.query?.pages?.[0];
  if (!page || page.missing) throw new Error(`article not found: ${article}`);
  if (!page.pageimage) throw new Error(`no lead image: ${article}`);
  return page.pageimage;
}

function stripHtml(s) {
  return (s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Thumb URL + license/credit metadata for a Commons file. */
async function imageInfo(file) {
  const title = `File:${file}`;
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${THUMB_WIDTH}`;
  const data = await getJson(u);
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) throw new Error(`no imageinfo: ${title}`);
  const meta = info.extmetadata ?? {};
  return {
    thumbUrl: info.thumburl ?? info.url,
    descriptionUrl: info.descriptionurl,
    license: stripHtml(meta.LicenseShortName?.value) || 'unknown',
    author: stripHtml(meta.Artist?.value) || 'unknown',
  };
}

function licenseIsFree(license) {
  const l = license.toLowerCase();
  return FREE_LICENSES.some((f) => l.startsWith(f));
}

async function download(url, dest) {
  const res = await politeFetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

const existing = existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, 'utf8')) : {};
mkdirSync(OUT_DIR, { recursive: true });
const out = {};
const failures = [];

for (const [siteId, src] of Object.entries(SITE_SOURCES)) {
  await sleep(500); // stay well inside Wikimedia API etiquette
  try {
    const file = src.file ?? (await pageImageFile(src.article));
    const info = await imageInfo(file);
    if (!licenseIsFree(info.license)) {
      failures.push(`${siteId}: non-free license '${info.license}' on ${file} — pick another image`);
      continue;
    }
    // Images are keyed by site id; extension normalized to the thumb's real one.
    const ext = (info.thumbUrl.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const filename = `${siteId}.${ext}`;
    const dest = join(OUT_DIR, filename);
    let bytes = 0;
    if (!DRY && (FORCE || !existsSync(dest))) bytes = await download(info.thumbUrl, dest);
    out[siteId] = {
      src: `images/sites/${filename}`,
      caption: src.caption ?? src.article,
      commonsFile: file,
      author: info.author,
      license: info.license,
      sourceUrl: info.descriptionUrl,
    };
    console.log(`ok  ${siteId}  ${file}  [${info.license}]${bytes ? `  ${(bytes / 1024).toFixed(0)} KB` : ''}`);
  } catch (e) {
    failures.push(`${siteId}: ${e.message}`);
    if (existing[siteId]) out[siteId] = existing[siteId]; // keep last good entry
  }
}

if (!DRY) writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');
console.log(`\n${Object.keys(out).length}/${Object.keys(SITE_SOURCES).length} sites have images.`);
if (failures.length) {
  console.error('\nNeeds attention:');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exitCode = 1;
}
