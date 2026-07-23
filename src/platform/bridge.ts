import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Resolve a bundled asset path to a URL the WebView can fetch.
 * Bundled assets ship inside the web directory, which Capacitor serves from the
 * app origin (`https://localhost/...`) on native exactly as a web server does.
 * The absolute path is therefore correct on both platforms.
 *
 * Do NOT run these through `Capacitor.convertFileSrc` — that rewrites to
 * `_capacitor_file_/<path>`, which resolves against the *device filesystem* and
 * 404s for bundled assets ("Unable to open asset URL"). Reserve it for real
 * on-device files (e.g. downloaded content packs) via `resolveFileUrl`.
 *
 * Large assets (Bible DB, PMTiles) must be fetched as a Blob via this URL and
 * NEVER passed across the bridge as base64 — base64 of a multi-MB file OOMs the
 * Android WebView. See platform/assets.ts.
 */
export function resolveAssetUrl(relativePath: string): string {
  return relativePath;
}

/** Resolve an absolute device-filesystem path (not a bundled asset) to a fetchable URL. */
export function resolveFileUrl(absolutePath: string): string {
  return isNative() ? Capacitor.convertFileSrc(absolutePath) : absolutePath;
}

/** Fetch a bundled binary asset as a Blob (bridge-safe; no base64). */
export async function fetchAssetBlob(relativePath: string): Promise<Blob> {
  const res = await fetch(resolveAssetUrl(relativePath));
  if (!res.ok) throw new Error(`Failed to load asset ${relativePath}: ${res.status}`);
  return res.blob();
}
