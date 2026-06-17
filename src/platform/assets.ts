import { fetchAssetBlob, isNative, resolveAssetUrl } from './bridge';

// Single point of web-vs-native divergence. Bundled content lives under
// /dist-content (emitted by scripts/build-content.ts into public/). Both web and
// the Capacitor local server serve these from the app root via absolute paths.

export const ASSET_PATHS = {
  contentBundle: '/dist-content/bundle.json',
  contentManifest: '/dist-content/manifest.json',
  bibleDb: '/dist-content/content.sqlite',
  modernPmtiles: '/tiles/mediterranean.pmtiles',
  ancientTiles: '/tiles/ancient/{z}/{x}/{y}.png',
  glyphs: '/fonts/{fontstack}/{range}.pbf',
  sprite: '/sprites/sprite',
} as const;

export function getPmtilesUrl(): string {
  // `pmtiles://` protocol prefix is added by the MapLibre protocol handler.
  return `pmtiles://${resolveAssetUrl(ASSET_PATHS.modernPmtiles)}`;
}

export function getAncientTileUrl(): string {
  return resolveAssetUrl(ASSET_PATHS.ancientTiles);
}

export function getGlyphsUrl(): string {
  return resolveAssetUrl(ASSET_PATHS.glyphs);
}

export function getSpriteUrl(): string {
  return resolveAssetUrl(ASSET_PATHS.sprite);
}

/** Load the compiled content bundle (journeys/sites/etc.). */
export async function loadBundle(): Promise<unknown> {
  const res = await fetch(resolveAssetUrl(ASSET_PATHS.contentBundle));
  if (!res.ok) throw new Error(`Failed to load content bundle: ${res.status}`);
  return res.json();
}

/** Load the local (bundled) content manifest. */
export async function loadManifest(): Promise<ContentManifest> {
  const res = await fetch(resolveAssetUrl(ASSET_PATHS.contentManifest));
  if (!res.ok) throw new Error(`Failed to load content manifest: ${res.status}`);
  return res.json();
}

export interface ContentManifest {
  version: string;
  integrity: string;
  generatedAt: string;
  translations: string[];
  counts: Record<string, number>;
}

/** Fetch the Bible SQLite database as bytes for the platform SQLite engine. */
export async function loadBibleDbBytes(): Promise<Uint8Array> {
  const blob = await fetchAssetBlob(ASSET_PATHS.bibleDb);
  return new Uint8Array(await blob.arrayBuffer());
}

export { isNative };
