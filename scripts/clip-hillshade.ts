/**
 * Crop Natural Earth 50m shaded relief to WORLD_BBOX and mask the sea with the
 * bundled land polygon. Writes public/images/map/hillshade.png.
 *
 * Not part of `npm run build` — the PNG is committed. Re-run with
 * `npm run map:hillshade` when the basemap extent changes.
 */
import { execFileSync } from 'node:child_process';
import { createWriteStream, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import sharp from 'sharp';
import { WORLD_BBOX } from '../src/map/graticule';
import { SHADED_RELIEF_RASTER, hillshadeCrop } from '../src/map/hillshade';

const SOURCE = 'https://naciscdn.org/naturalearth/50m/raster/SR_50M.zip';
const OUT = 'public/images/map/hillshade.png';
const MAX_BYTES = 2_000_000;

type Ring = [number, number][];

function walkTif(dir: string): string | undefined {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const found = walkTif(path);
      if (found) return found;
    } else if (name.toLowerCase().endsWith('.tif')) return path;
  }
  return undefined;
}

function pixelOf(lon: number, lat: number, width: number, height: number): [number, number] {
  const [west, south, east, north] = WORLD_BBOX;
  const x = ((lon - west) / (east - west)) * (width - 1);
  const y = ((north - lat) / (north - south)) * (height - 1);
  return [x, y];
}

function landAlpha(width: number, height: number): Buffer {
  const land = JSON.parse(readFileSync('src/map/basemap/land.json', 'utf8')) as {
    features: { geometry: { type: string; coordinates: number[][][][] | number[][][] } }[];
  };
  const rings: Ring[] = [];
  for (const feature of land.features) {
    const { type, coordinates } = feature.geometry;
    const polys = (type === 'Polygon' ? [coordinates] : coordinates) as number[][][][];
    for (const poly of polys) for (const ring of poly) rings.push(ring as Ring);
  }

  const edges: [number, number, number, number][] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = pixelOf(ring[i][0], ring[i][1], width, height);
      const [x1, y1] = pixelOf(ring[i + 1][0], ring[i + 1][1], width, height);
      if (y0 !== y1) edges.push([x0, y0, x1, y1]);
    }
  }

  const alpha = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const scan = y + 0.5;
    const xs: number[] = [];
    for (const [x0, y0, x1, y1] of edges) {
      const ymin = y0 < y1 ? y0 : y1;
      const ymax = y0 < y1 ? y1 : y0;
      if (scan < ymin || scan >= ymax) continue;
      const t = (scan - y0) / (y1 - y0);
      xs.push(x0 + t * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      let start = Math.ceil(xs[i]);
      let end = Math.floor(xs[i + 1]);
      if (start < 0) start = 0;
      if (end >= width) end = width - 1;
      for (let x = start; x <= end; x++) alpha[y * width + x] = 255;
    }
  }
  return alpha;
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'journeys-hillshade-'));
  const zipPath = join(dir, 'SR_50M.zip');
  const response = await fetch(SOURCE);
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${SOURCE}`);
  await pipeline(Readable.fromWeb(response.body as unknown as WebReadableStream), createWriteStream(zipPath));
  execFileSync('unzip', ['-o', zipPath, '-d', dir]);
  const tif = walkTif(dir);
  if (!tif) throw new Error('SR_50M.zip has no GeoTIFF');

  const meta = await sharp(tif).metadata();
  if (meta.width !== SHADED_RELIEF_RASTER.width || meta.height !== SHADED_RELIEF_RASTER.height) {
    throw new Error(`Expected ${SHADED_RELIEF_RASTER.width}×${SHADED_RELIEF_RASTER.height}, got ${meta.width}×${meta.height}`);
  }

  const crop = hillshadeCrop();
  const { data, info } = await sharp(tif)
    .extract(crop)
    .toColourspace('b-w')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== crop.width || info.height !== crop.height || info.channels !== 1) {
    throw new Error(`Crop came out ${info.width}×${info.height} channels=${info.channels}`);
  }
  if (data.length !== crop.width * crop.height) {
    throw new Error(`Expected 8-bit grayscale, got ${data.length} bytes`);
  }

  const alpha = landAlpha(crop.width, crop.height);
  await sharp(data, { raw: { width: crop.width, height: crop.height, channels: 1 } })
    .joinChannel(alpha, { raw: { width: crop.width, height: crop.height, channels: 1 } })
    .png()
    .toFile(OUT);

  const size = statSync(OUT).size;
  if (size === 0 || size >= MAX_BYTES) throw new Error(`hillshade.png is ${size} bytes`);
  console.log(`wrote ${OUT} (${size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
