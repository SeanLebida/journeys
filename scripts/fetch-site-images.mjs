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

  // --- Old Testament / patriarchal / flood-narrative sites ---
  'site-emmaus': { article: 'Emmaus Nicopolis', caption: 'The Byzantine basilica ruins at Emmaus Nicopolis (Amwas) today' },
  'site-tabgha': { file: 'Tabgha - Church of the Multiplication 1.jpg', caption: 'The Church of the Multiplication at Tabgha today' },
  'site-galilee-mountain': { article: 'Mount of Beatitudes', caption: 'The Mount of Beatitudes ridge above the Sea of Galilee' },
  'site-mount-of-olives-ascension': { article: 'Chapel of the Ascension, Jerusalem', caption: 'The Chapel of the Ascension on the summit of the Mount of Olives' },
  'site-damascus': { article: 'Damascus', caption: 'Damascus, Syria — the Via Recta (Straight Street) of Acts 9 runs through the Old City' },
  'site-ur': { file: 'Ancient ziggurat at Ali Air Base Iraq 2005.jpg', caption: 'The Great Ziggurat of Ur (Tell el-Muqayyar), southern Iraq' },
  'site-haran': { article: 'Harran', caption: 'The beehive houses and ruins of Harran, southeastern Turkey' },
  'site-shechem-ot': { article: 'Shechem', caption: 'The excavated ruins of Tell Balata (Shechem) at modern Nablus' },
  'site-bethel': { file: 'Beitin-3824.jpg', caption: 'The village of Beitin, traditional site of Bethel, in the West Bank hills' },
  'site-hebron-machpelah': { article: 'Cave of the Patriarchs', caption: 'The Herodian enclosure over the Cave of Machpelah in Hebron' },
  'site-beersheba-ot': { article: 'Tel Be\'er Sheva', caption: 'The excavated Iron Age town of Tel Be\'er Sheva' },
  'site-goshen-rameses': { article: 'Pi-Ramesses', caption: 'Remains at Qantir / Pi-Ramesses in the eastern Nile Delta' },
  'site-mount-sinai': { article: 'Mount Sinai', caption: 'Jebel Musa (traditional Mount Sinai), southern Sinai Peninsula' },
  'site-kadesh-barnea': { article: 'Kadesh (Israel)', caption: 'The spring and ruins of Tell el-Qudeirat, candidate for Kadesh-barnea' },
  'site-mount-nebo': { article: 'Mount Nebo', caption: 'The Moses memorial church and outlook on Mount Nebo, Jordan' },
  // site-kadesh-barnea: no free present-day photo of Tell el-Qudeirat on Commons; left imageless (an honest gap) rather than showing a wrong spring.
  'site-egypt-refuge': { file: 'Church of Abu Serga-Cairo.JPG', caption: 'Abu Serga church in Old Cairo, a traditional Holy Family refuge site' },
  'site-shuruppak': { file: 'Large pottery jar. Pear-shaped with 2 handles. Painted near the mouth with geometric motifs. From Tell Fara (Shuruppak), Iraq. 5th millennium BCE. Iraq Museum, Baghdad.jpg', caption: 'Painted pottery jar excavated at Tell Fara (Shuruppak), now in the Iraq Museum' },
  'site-ararat-landing': { article: 'Mount Ararat', caption: 'Greater Mount Ararat, traditional resting place of the ark (Genesis 8:4)' },
  'site-shinar-plain': { article: 'Babylon', caption: 'The reconstructed ruins of Babylon on the plain of Shinar' },
  'site-nain': { article: 'Nein', caption: 'The village of Nein on the slope of the Hill of Moreh, Lower Galilee' },
  'site-lydda': { article: 'Lod', caption: 'The Church of St George at Lod (ancient Lydda), Israel' },
  'site-joppa': { article: 'Jaffa', caption: 'The old harbour of Jaffa (ancient Joppa) on the Tel Aviv coast' },
  'site-valley-of-siddim': { article: 'Dead Sea', caption: 'The southern basin of the Dead Sea, traditional Valley of Siddim' },
  'site-heshbon': { article: 'Tell Hesban', caption: 'The excavated mound of Tell Hisban (Heshbon), Jordan' },
  'site-edrei': { article: 'Daraa', caption: 'Daraa (ancient Edrei), southern Syria' },
  'site-jericho-ot': { file: 'Tell es-Sultan, Jericho, Palestine2.jpg', caption: 'Tell es-Sultan, the mound of Old Testament Jericho' },
  'site-ai': { file: 'Et-Tell (Ai) ruins.jpg', caption: 'The ruins of et-Tell, majority identification for Ai' },
  'site-gibeon': { article: 'Gibeon (ancient city)', caption: 'The village of el-Jib, ancient Gibeon, and its great pool' },
  'site-hazor': { article: 'Tel Hazor', caption: 'The excavations of Tel Hazor, Upper Galilee' },
  'site-mount-tabor': { article: 'Mount Tabor', caption: 'Mount Tabor rising from the Jezreel valley, crowned by the Transfiguration church' },
  'site-spring-of-harod': { article: 'Ma\'ayan Harod National Park', caption: 'The spring of Harod at the foot of Mount Gilboa' },
  'site-gibeah': { article: 'Tell el-Ful', caption: 'The mound of Tell el-Ful, candidate for Gibeah of Saul, north of Jerusalem' },
  'site-mizpah': { article: 'Tell en-Nasbeh', caption: 'The mound of Tell en-Nasbeh (Mizpah of Benjamin)' },
  'site-aphek-ebenezer': { article: 'Antipatris', caption: 'The Ottoman fortress on Tel Afek (Aphek/Antipatris) at the Yarkon springs' },
  'site-michmash': { file: 'Mukhmas 2.jpg', caption: 'The village of Mukhmas (Michmash) above the Wadi Suweinit pass' },
  'site-valley-of-elah': { article: 'Valley of Elah', caption: 'The Valley of Elah, overlooked by Khirbet Qeiyafa' },
  'site-mount-gilboa': { article: 'Mount Gilboa', caption: 'The Gilboa ridge above the Jezreel valley' },
  'site-rabbah-ammon': { article: 'Amman Citadel', caption: 'The Citadel (Jabal al-Qal\'a) of Amman, ancient Rabbah of the Ammonites' },
  'site-mahanaim': { article: 'Tulul adh-Dhahab', caption: 'The twin tells of Tulul adh-Dhahab on the Jabbok, candidate for Mahanaim' },
  // site-ramah: modern er-Ram has no evocative site photo on Commons (only a hospital); left imageless.
  'site-beth-shemesh': { file: 'PikiWiki Israel 64670 beth shemesh - excavations of north wall.jpg', caption: 'The excavated north wall of Tel Beth Shemesh in the Sorek valley' },
  'site-samaria-city': { article: 'Sebastia, Nablus', caption: 'The Roman-era ruins on the acropolis of Samaria (Sebastia)' },
  'site-aphek-golan': { article: 'Ein Gev', caption: 'The eastern shore of the Sea of Galilee below the Golan, near ancient Aphek' },
  'site-qarqar': { article: 'Tell Qarqur', caption: 'The excavation mound of Tell Qarqur in the Orontes valley' },
  // site-ramoth-gilead: identification (Tell er-Rumeith) is uncertain and no representative free photo exists; left imageless.
  'site-jezreel': { article: 'Jezreel (city)', caption: 'Tel Jezreel, royal winter seat of the Omride kings' },
  'site-kir-hareseth': { article: 'Kerak Castle', caption: 'Al-Karak, ancient Kir-hareseth of Moab, beneath its Crusader castle' },
  'site-megiddo': { article: 'Tel Megiddo', caption: 'Tel Megiddo commanding the Aruna pass into the Jezreel valley' },
  'site-carchemish': { file: 'Karkamış. Standbeeld van de God Atarluhas en twee leeuwen Aan de Koninklijke Poort, GD006254.jpg', caption: 'The god Atarluhas and lions from the Royal Gate at Carchemish (Karkamış)' },
  'site-dan': { article: 'Tel Dan', caption: 'The Bronze Age gate and springs of Tel Dan below Mount Hermon' },
  'site-lachish': { article: 'Lachish', caption: 'Tel Lachish in the Shephelah of Judah' },
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

/**
 * Gallery extras for the major sites: 1–2 additional ground-level / interior
 * shots each (explicit Commons files, curated like the SITE_SOURCES file
 * overrides). Sites not listed here keep a single photo.
 */
const SITE_EXTRAS = {
  'site-jerusalem': [
    { file: 'Prayers at the Western Wall 2.jpg', caption: "The Western Wall, surviving retaining wall of Herod's Temple Mount" },
  ],
  'site-golgotha-and-the-tomb': [
    { file: 'Holy Land 2016 P0929 Church of the Holy Sepulchre Aedicule interior.jpg', caption: 'Inside the Aedicule, the shrine over the traditional tomb' },
  ],
  'site-ephesus': [
    { file: 'Great Theatre of Ephesus 2024.jpg', caption: 'The Great Theatre of Ephesus, scene of the riot of Acts 19' },
    { file: 'Curetes Street in Ephesus (1).jpg', caption: 'Curetes Street, a main thoroughfare of Roman Ephesus' },
  ],
  'site-athens': [
    { file: 'Attica 06-13 Athens 50 View from Philopappos - Acropolis Hill.jpg', caption: 'The Acropolis of Athens seen from Philopappos Hill' },
  ],
  'site-corinth': [
    { file: 'Acrocorinth Gateway.jpg', caption: 'Acrocorinth, the fortress mountain above ancient Corinth' },
  ],
  'site-capernaum': [
    { file: 'Kafarnaum BW 20.jpg', caption: 'Inside the limestone synagogue at Capernaum' },
  ],
  'site-sea-of-galilee': [
    { file: '2,000 year-old Galilee Boat (25891250505).jpg', caption: "The 1st-century 'Galilee Boat' recovered from the lakebed" },
  ],
  'site-bethlehem': [
    { file: 'Altar in the Grotto of the Nativity 2010.jpg', caption: 'The Grotto of the Nativity beneath the church' },
  ],
  'site-philippi': [
    { file: 'Ancient theatre - Philippi.jpg', caption: 'The ancient theatre of Philippi' },
  ],
  'site-rome': [
    { file: 'Roman Forum looking East panorama.jpg', caption: 'The Roman Forum today' },
    { file: 'Mamertine Prison.jpg', caption: "The Mamertine Prison, traditional site of Paul's final imprisonment" },
  ],
  'site-paphos': [
    { file: 'Birth of Dionysos - House of Aion - Paphos Archaeological Park.jpg', caption: 'Roman mosaics in the House of Aion, Paphos' },
  ],
  'site-caesarea-maritima': [
    { file: 'Caesarea Maritima Hippodrome 02.jpg', caption: 'The hippodrome of Caesarea Maritima beside the sea' },
  ],
  'site-hierapolis': [
    { file: 'Pamukkale Hierapolis Travertine pools.JPG', caption: 'The travertine terrace pools of Pamukkale below Hierapolis' },
  ],
  'site-patmos': [
    { file: 'Cave of the Apocalypse.jpg', caption: "The Cave of the Apocalypse, traditional site of John's vision" },
  ],
  'site-myra-of-lycia': [
    { file: 'The rock tombs of ancient Myra, carved into the cliffs of Demre, Turkey.jpg', caption: 'Lycian rock tombs above Myra' },
  ],
  'site-thessalonica': [
    { file: 'Thessaloniki Saint George Rotunda from the Arch of Galerius.jpg', caption: 'The Rotunda and Arch of Galerius in Thessaloniki' },
  ],
};

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

/** Resolve, license-gate, and download one image; returns its metadata entry. */
async function fetchOne(siteId, file, caption, index) {
  const info = await imageInfo(file);
  if (!licenseIsFree(info.license)) throw new Error(`non-free license '${info.license}' on ${file} — pick another image`);
  // Files are keyed by site id (+ position for gallery extras); extension
  // normalized to the thumb's real one.
  const ext = (info.thumbUrl.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const filename = index === 0 ? `${siteId}.${ext}` : `${siteId}-${index + 1}.${ext}`;
  const dest = join(OUT_DIR, filename);
  let bytes = 0;
  if (!DRY && (FORCE || !existsSync(dest))) bytes = await download(info.thumbUrl, dest);
  console.log(`ok  ${siteId}${index > 0 ? ` [${index + 1}]` : ''}  ${file}  [${info.license}]${bytes ? `  ${(bytes / 1024).toFixed(0)} KB` : ''}`);
  return {
    src: `images/sites/${filename}`,
    caption,
    commonsFile: file,
    author: info.author,
    license: info.license,
    sourceUrl: info.descriptionUrl,
  };
}

for (const [siteId, src] of Object.entries(SITE_SOURCES)) {
  await sleep(500); // stay well inside Wikimedia API etiquette
  const images = [];
  try {
    const file = src.file ?? (await pageImageFile(src.article));
    images.push(await fetchOne(siteId, file, src.caption ?? src.article, 0));
  } catch (e) {
    failures.push(`${siteId}: ${e.message}`);
  }
  for (const [i, extra] of (SITE_EXTRAS[siteId] ?? []).entries()) {
    await sleep(500);
    try {
      images.push(await fetchOne(siteId, extra.file, extra.caption, i + 1));
    } catch (e) {
      failures.push(`${siteId} extra ${extra.file}: ${e.message}`);
    }
  }
  if (images.length > 0) out[siteId] = { images };
  else if (existing[siteId]?.images) out[siteId] = existing[siteId]; // keep last good entry
}

if (!DRY) writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');
const galleryCount = Object.values(out).filter((v) => v.images.length > 1).length;
console.log(`\n${Object.keys(out).length}/${Object.keys(SITE_SOURCES).length} sites have images (${galleryCount} with galleries).`);
if (failures.length) {
  console.error('\nNeeds attention:');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exitCode = 1;
}
