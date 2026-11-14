import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Resolve a bundled asset path to a URL the WebView can fetch.
 * Bundled assets ship inside the web directory, which Capacitor serves from the
 * app origin (`https://localhost/...`) on native exactly as a web server does.
 * Root-absolute paths stay as-is when Vite base is `/` (native and the default
 * web build). A non-root base such as `/app/` is prefixed so those fetches
 * stay under the deployed path.
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
/** Prefix a root-absolute path with a Vite base that is not `/`. */
export function withBase(base: string, path: string): string {
  if (!path.startsWith('/')) return path;
  if (!base || base === '/') return path;
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${prefix}${path}`;
}

/** React Router basename. `/` and empty stay undefined so the default build is unchanged. */
export function routerBasename(base: string): string | undefined {
  const stripped = base.endsWith('/') ? base.slice(0, -1) : base;
  if (stripped === '' || stripped === '/') return undefined;
  return stripped;
}

export function resolveAssetUrl(relativePath: string): string {
  return withBase(import.meta.env.BASE_URL, relativePath);
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
