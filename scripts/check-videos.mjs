#!/usr/bin/env node
/**
 * Verify each seed Video resolves via YouTube's keyless oEmbed endpoint and that
 * its channel matches what we recorded. Run manually / in CI — this is a live
 * network check, kept OUT of the offline content build (build-content.ts only
 * does the static 11-char id-format check). Exits non-zero if any video fails.
 *
 * Usage: node scripts/check-videos.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'content');
const read = (n) => (existsSync(join(C, n)) ? JSON.parse(readFileSync(join(C, n), 'utf8')) : []);
const videos = [...read('videos.json'), ...read('videos.extra.json')];

let failed = 0;
for (const v of videos) {
  if (v.provider !== 'youtube') continue;
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v.videoId}&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`oEmbed ${res.status} (video removed/private?)`);
    const data = await res.json();
    const chanOk = data.author_name?.toLowerCase() === v.channel.toLowerCase();
    console.log(`${chanOk ? 'ok ' : 'WARN'} ${v.id}  ${v.videoId}  [${data.author_name}] ${data.title}`);
    if (!chanOk) {
      console.error(`     channel mismatch: recorded '${v.channel}', got '${data.author_name}'`);
      failed++;
    }
  } catch (e) {
    console.error(`FAIL ${v.id}  ${v.videoId}: ${e.message}`);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`\n${videos.length} video(s) checked, ${failed} problem(s).`);
process.exitCode = failed ? 1 : 0;
