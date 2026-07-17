#!/usr/bin/env node
/**
 * Fetch one freely-licensed photo per archaeological find from Wikipedia/
 * Wikimedia Commons, bundle it offline, and emit src/content/artifactImages.json
 * with credit + license. Same curation + license-gate model as
 * scripts/fetch-site-images.mjs (see that file for the rationale).
 *
 * Usage: node scripts/fetch-artifact-images.mjs [--force]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'images', 'artifacts');
const OUT_JSON = join(ROOT, 'src', 'content', 'artifactImages.json');
const THUMB_WIDTH = 800;
const FORCE = process.argv.includes('--force');
const UA = 'JourneysAtlas/0.2 (offline biblical-journeys atlas; artifact imagery)';
const FREE = ['public domain', 'pd', 'cc0', 'cc by', 'cc-by', 'attribution', 'no restrictions', 'copyrighted free use'];

// artifactId → Wikipedia article (lead image is the object) or explicit Commons { file }.
const SOURCES = {
  'artifact-pilate-stone': { article: 'Pilate stone' },
  'artifact-pool-of-siloam': { article: 'Pool of Siloam' },
  'artifact-caiaphas-ossuary': { article: 'Caiaphas ossuary' },
  'artifact-tel-dan-stele': { article: 'Tel Dan Stele' },
  'artifact-mesha-stele': { article: 'Mesha Stele' },
  'artifact-merneptah-stele': { article: 'Merneptah Stele' },
  'artifact-pool-of-bethesda': { article: 'Pool of Bethesda' },
  'artifact-hezekiah-siloam-tunnel': { article: 'Siloam inscription' },
  'artifact-sennacherib-prism': { file: 'Taylor Prism-1.jpg' },
  'artifact-cyrus-cylinder': { article: 'Cyrus Cylinder' },
  'artifact-jesus-boat': { file: 'Ancient Boat of Sea of Galilee.jpg' },
  'artifact-babylonian-chronicle': { file: 'ABC 05 Early Years of Nebuchadnezzar chronicle.jpg' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function politeFetch(url) {
  for (let a = 0; ; a++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && a < 5) {
      await sleep(Math.max((Number(res.headers.get('retry-after')) || 0) * 1000, 2000 * 2 ** a));
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
}
const getJson = async (u) => (await politeFetch(u)).json();
const stripHtml = (s) => (s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function pageImageFile(article) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(article)}`;
  const page = (await getJson(u)).query?.pages?.[0];
  if (!page || page.missing || !page.pageimage) throw new Error(`no lead image: ${article}`);
  return page.pageimage;
}
async function imageInfo(file) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&titles=${encodeURIComponent('File:' + file)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${THUMB_WIDTH}`;
  const info = (await getJson(u)).query?.pages?.[0]?.imageinfo?.[0];
  if (!info) throw new Error(`no imageinfo: ${file}`);
  const m = info.extmetadata ?? {};
  return { thumbUrl: info.thumburl ?? info.url, descriptionUrl: info.descriptionurl,
    license: stripHtml(m.LicenseShortName?.value) || 'unknown', author: stripHtml(m.Artist?.value) || 'unknown' };
}
const licenseFree = (l) => FREE.some((f) => l.toLowerCase().startsWith(f));
async function download(url, dest) {
  writeFileSync(dest, Buffer.from(await (await politeFetch(url)).arrayBuffer()));
}

const existing = existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, 'utf8')) : {};
mkdirSync(OUT_DIR, { recursive: true });
const out = {};
const fails = [];
for (const [id, src] of Object.entries(SOURCES)) {
  await sleep(500);
  try {
    const file = src.file ?? (await pageImageFile(src.article));
    const info = await imageInfo(file);
    if (!licenseFree(info.license)) { fails.push(`${id}: non-free '${info.license}' (${file})`); if (existing[id]) out[id] = existing[id]; continue; }
    const ext = (info.thumbUrl.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const filename = `${id}.${ext}`;
    if (FORCE || !existsSync(join(OUT_DIR, filename))) await download(info.thumbUrl, join(OUT_DIR, filename));
    out[id] = { src: `images/artifacts/${filename}`, commonsFile: file, author: info.author, license: info.license, sourceUrl: info.descriptionUrl };
    console.log(`ok  ${id}  ${file}  [${info.license}]`);
  } catch (e) {
    fails.push(`${id}: ${e.message}`);
    if (existing[id]) out[id] = existing[id];
  }
}
writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');
console.log(`\n${Object.keys(out).length}/${Object.keys(SOURCES).length} artifacts have images.`);
if (fails.length) { console.error('\nNeeds attention:'); fails.forEach((f) => console.error('  - ' + f)); }
