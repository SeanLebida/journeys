import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Resolve a bundled asset path to a URL the WebView can fetch.
 * On native we go through Capacitor's `convertFileSrc` so the WebView can read
 * files off the device filesystem; on web the relative path is served as-is.
 *
 * Large assets (Bible DB, PMTiles) must be fetched as a Blob via this URL and
 * NEVER passed across the bridge as base64 — base64 of a multi-MB file OOMs the
 * Android WebView. See platform/assets.ts.
 */
export function resolveAssetUrl(relativePath: string): string {
  if (isNative()) {
    return Capacitor.convertFileSrc(relativePath);
  }
  return relativePath;
}

/** Fetch a bundled binary asset as a Blob (bridge-safe; no base64). */
export async function fetchAssetBlob(relativePath: string): Promise<Blob> {
  const res = await fetch(resolveAssetUrl(relativePath));
  if (!res.ok) throw new Error(`Failed to load asset ${relativePath}: ${res.status}`);
  return res.blob();
}
