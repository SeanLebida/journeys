/**
 * Runs first for /app/assets/* only. Existing hashed files are served from
 * the assets binding. A miss must not use the SPA index.html fallback, which
 * made stale dynamic imports parse as HTML after a deploy.
 */
export type AssetEnv = { ASSETS: Fetcher };

export function isSpaFallback(response: Response): boolean {
  if (response.status === 404) return false;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("text/html");
}

export function missingAssetResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function fetchAsset(request: Request, env: AssetEnv): Promise<Response> {
  const asset = await env.ASSETS.fetch(request);
  if (asset.status === 404 || isSpaFallback(asset)) {
    return missingAssetResponse();
  }
  return asset;
}

export default {
  fetch(request: Request, env: AssetEnv): Promise<Response> {
    return fetchAsset(request, env);
  },
};
