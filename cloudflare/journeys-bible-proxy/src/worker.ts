import { biblePolicy, VERSION_LABELS, type BiblePolicy } from "./allowlist.ts";
import {
  catalogUpstreamSearch,
  languagesUpstreamSearch,
  parseCatalogQuery,
  parseLanguagesQuery,
  sanitizeCatalog,
  sanitizeLanguages,
} from "./catalog.ts";
import { allowedOrigin, withCors, preflightResponse } from "./cors.ts";
import { hmacSha256Hex, secretsEqual } from "./crypto.ts";
import { sharedFreshness, stillFresh } from "./freshness.ts";
import { jsonResponse } from "./json.ts";
import { logEvent } from "./log.ts";
import { allowedSearch, parseRoute } from "./routes.ts";
import type { WorkerContext, WorkerEnv } from "./types.ts";

const DOWNLOAD_HEADER = "x-journeys-download";
const DOWNLOAD_VALUE = "complete";
const CLIENT_HEADER = "x-journeys-client";
const CLIENT_VALUE = "journeys";
const STATS_OBJECT_NAME = "downloads";

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  ctx: WorkerContext,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return preflightResponse(request);
  }

  const url = new URL(request.url);
  const policy = biblePolicy(env);
  const route = parseRoute(url.pathname, url.searchParams, policy.canRead);

  const limited = await applyRateLimit(request, env);
  if (limited) {
    return withCors(limited, request);
  }

  if (route.kind === "admin-stats") {
    return withCors(await handleAdminStats(request, env, route.year), request);
  }

  const clientGate = requireClientHeader(request, env);
  if (clientGate) {
    return withCors(clientGate, request);
  }

  if (route.kind === "forbidden-version") {
    logEvent("proxy_deny", {
      reason: "version_not_allowed",
      version_id: route.versionId,
      path: url.pathname,
    });
    return withCors(
      jsonResponse(403, {
        error: "Forbidden",
        message: "This Bible version is not available through Journeys.",
      }),
      request,
    );
  }

  if (route.kind === "forbidden-path") {
    logEvent("proxy_deny", { reason: "path_not_allowed", path: url.pathname });
    return withCors(
      jsonResponse(403, {
        error: "Forbidden",
        message: "This endpoint is not available through Journeys.",
      }),
      request,
    );
  }

  if (route.kind === "not-found") {
    return withCors(
      jsonResponse(404, { error: "Not Found", message: "Unknown path." }),
      request,
    );
  }

  if (route.kind === "download") {
    if (!policy.canStore(route.versionId)) {
      logEvent("proxy_deny", { reason: "download_not_allowed", version_id: route.versionId });
      return withCors(
        jsonResponse(403, {
          error: "Forbidden",
          message: "This Bible version can be read online but not downloaded.",
        }),
        request,
      );
    }
    return withCors(await handleDownload(request, env, route.versionId), request);
  }

  if (request.method !== "GET") {
    return withCors(
      jsonResponse(405, { error: "Method Not Allowed", message: "Use GET." }),
      request,
    );
  }

  if (route.kind === "catalog" || route.kind === "languages") {
    return withCors(await handleList(request, env, ctx, url, route.kind, policy), request);
  }

  return withCors(
    await proxyYouVersion(env, ctx, url, route),
    request,
  );
}

async function applyRateLimit(
  request: Request,
  env: WorkerEnv,
): Promise<Response | null> {
  const limit = parsePositiveInt(env.RATE_LIMIT_MAX, 180);
  const windowSeconds = parsePositiveInt(env.RATE_LIMIT_WINDOW_SECONDS, 60);
  const salt = env.RATE_LIMIT_SALT ?? "";
  if (salt.length === 0) {
    logEvent("rate_limit_error", { reason: "missing_salt" });
    // Fail open rather than name a Durable Object by the raw IP.
    return null;
  }
  let ipHash: string;
  try {
    ipHash = await hmacSha256Hex(salt, clientIp(request));
  } catch (error) {
    logEvent("rate_limit_error", { message: errorMessage(error) });
    return null;
  }
  try {
    const result = await env.RATE_LIMITER.getByName(`ip:${ipHash}`).take(
      limit,
      windowSeconds,
    );
    if (result.allowed) {
      return null;
    }
    logEvent("rate_limited", { ip_hash: ipHash });
    return jsonResponse(
      429,
      { error: "Too Many Requests", message: "Rate limit exceeded." },
      { "Retry-After": String(result.retryAfterSeconds) },
    );
  } catch (error) {
    logEvent("rate_limit_error", { message: errorMessage(error) });
    // Fail open on limiter faults so a DO outage does not block Scripture reads.
    return null;
  }
}

function requireClientHeader(request: Request, env: WorkerEnv): Response | null {
  if (env.REQUIRE_APP_CLIENT !== "true") {
    return null;
  }
  const value = request.headers.get(CLIENT_HEADER);
  const origin = allowedOrigin(request);
  if (value === CLIENT_VALUE && origin) {
    return null;
  }
  logEvent("proxy_deny", { reason: "missing_app_client" });
  return jsonResponse(403, {
    error: "Forbidden",
    message: "Missing or invalid Origin or X-Journeys-Client header.",
  });
}

async function handleDownload(
  request: Request,
  env: WorkerEnv,
  versionId: number,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(405, {
      error: "Method Not Allowed",
      message: "Send POST with X-Journeys-Download: complete after a finished download.",
    });
  }
  const signal = request.headers.get(DOWNLOAD_HEADER);
  if (signal?.trim().toLowerCase() !== DOWNLOAD_VALUE) {
    return jsonResponse(400, {
      error: "Bad Request",
      message: "Send header X-Journeys-Download: complete when a version download finishes.",
    });
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const result = await env.DOWNLOAD_STATS.getByName(STATS_OBJECT_NAME).increment(
    versionId,
    year,
    month,
  );
  logEvent("download_counted", {
    version_id: versionId,
    year,
    month,
    month_count: result.monthCount,
    year_total: result.yearTotal,
  });
  return jsonResponse(200, {
    ok: true,
    version_id: versionId,
    abbreviation: VERSION_LABELS[versionId] ?? String(versionId),
    year,
    month,
    month_count: result.monthCount,
    year_total: result.yearTotal,
  });
}

async function handleAdminStats(
  request: Request,
  env: WorkerEnv,
  year: number | null,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse(405, {
      error: "Method Not Allowed",
      message: "Use GET.",
    });
  }
  const token = adminTokenFrom(request);
  const ok = await secretsEqual(token, env.ADMIN_TOKEN ?? "");
  if (!ok) {
    logEvent("admin_unauthorized", {});
    return jsonResponse(401, {
      error: "Unauthorized",
      message: "Valid admin token required.",
    });
  }
  if (year === null) {
    return jsonResponse(400, {
      error: "Bad Request",
      message: "Query parameter year=YYYY is required.",
    });
  }

  const rows = await env.DOWNLOAD_STATS.getByName(STATS_OBJECT_NAME).statsForYear(
    year,
  );
  const policy = biblePolicy(env);
  const ids = new Set<number>([...policy.offline, ...rows.map((row) => row.version_id)]);
  const versions = [...ids].sort((a, b) => a - b).map((versionId) => {
    const months: Record<string, number> = {};
    for (let month = 1; month <= 12; month++) {
      months[String(month)] = 0;
    }
    let yearTotal = 0;
    for (const row of rows) {
      if (row.version_id !== versionId) {
        continue;
      }
      months[String(row.month)] = row.count;
      yearTotal += row.count;
    }
    return {
      version_id: versionId,
      abbreviation: VERSION_LABELS[versionId] ?? String(versionId),
      year_total: yearTotal,
      months,
    };
  });

  logEvent("admin_stats", { year });
  return jsonResponse(200, { year, versions });
}

/**
 * GET /v1/bibles and GET /v1/languages. A 200 is stored only for the upstream
 * Cache-Control lifetime. The response to the app is no-store.
 */
async function handleList(
  request: Request,
  env: WorkerEnv,
  ctx: WorkerContext,
  url: URL,
  kind: "catalog" | "languages",
  policy: BiblePolicy,
): Promise<Response> {
  const key = env.YOUVERSION_APP_KEY;
  if (!key) {
    logEvent("upstream_error", { reason: "missing_app_key" });
    return jsonResponse(500, {
      error: "Server Error",
      message: "Bible service is not configured.",
    });
  }

  let upstreamPath: string;
  let search: URLSearchParams;
  let acceptLanguage: string | null = null;
  if (kind === "catalog") {
    const q = parseCatalogQuery(url.searchParams);
    if (!q) {
      return jsonResponse(400, {
        error: "Bad Request",
        message: "Use language_ranges[] (language tags or *), page_size 1-99 and page_token.",
      });
    }
    upstreamPath = "/bibles";
    search = catalogUpstreamSearch(q);
  } else {
    const q = parseLanguagesQuery(url.searchParams, request.headers.get("Accept-Language"));
    if (!q) {
      return jsonResponse(400, {
        error: "Bad Request",
        message: "Use page_size 1-99, page_token and an optional two-letter country.",
      });
    }
    upstreamPath = "/languages";
    search = languagesUpstreamSearch(q);
    acceptLanguage = q.acceptLanguage;
  }

  const keyParams = new URLSearchParams(search);
  keyParams.set("_policy", policy.fingerprint);
  if (acceptLanguage) keyParams.set("_lang", acceptLanguage);
  const cacheKey = new Request(cacheKeyUrl(upstreamPath, keyParams), { method: "GET" });
  const cache = await getCache();
  if (cache) {
    const hit = await freshHit(cache, cacheKey);
    if (hit) {
      logEvent("proxy_ok", { source: "cache", path: url.pathname });
      return hit;
    }
  }

  const upstreamUrl = new URL(
    `${trimSlash(env.UPSTREAM_BASE || "https://api.youversion.com/v1")}${upstreamPath}`,
  );
  search.forEach((value, name) => upstreamUrl.searchParams.append(name, value));
  const headers: Record<string, string> = { Accept: "application/json", "X-YVP-App-Key": key };
  if (acceptLanguage) headers["Accept-Language"] = acceptLanguage;
  const upstream = await fetch(upstreamUrl, { method: "GET", headers, redirect: "manual" }).catch(
    (error: unknown) => {
      logEvent("upstream_error", { message: errorMessage(error) });
      return null;
    },
  );
  if (!upstream) {
    return jsonResponse(502, { error: "Bad Gateway", message: "The Bible service is unavailable." });
  }
  if (upstream.status === 204) {
    const empty = { data: [], next_page_token: null, total_size: 0 };
    return jsonResponse(200, empty, { "Cache-Control": "no-store" });
  }
  if (!upstream.ok) {
    logEvent("upstream_error", { status: upstream.status, path: url.pathname });
    const passthrough: Record<string, string> = { "Cache-Control": "no-store" };
    const retryAfter = upstream.headers.get("Retry-After");
    if (retryAfter) passthrough["Retry-After"] = retryAfter;
    const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : upstream.status;
    return jsonResponse(status, { error: "Upstream Error", message: `The Bible service answered ${upstream.status}.` }, passthrough);
  }

  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    return jsonResponse(502, { error: "Bad Gateway", message: "The Bible service sent an unreadable list." });
  }
  const page = kind === "catalog" ? sanitizeCatalog(body, policy) : sanitizeLanguages(body);
  const response = jsonResponse(200, { ...page });
  logEvent("proxy_ok", { source: "origin", status: 200, path: url.pathname, items: page.data.length });
  return storeForApp(cache, ctx, cacheKey, upstream.headers, response);
}

async function proxyYouVersion(
  env: WorkerEnv,
  ctx: WorkerContext,
  url: URL,
  route:
    | { kind: "bible"; versionId: number }
    | { kind: "books"; versionId: number }
    | { kind: "passage"; versionId: number; passageId: string },
): Promise<Response> {
  const key = env.YOUVERSION_APP_KEY;
  if (!key) {
    logEvent("upstream_error", { reason: "missing_app_key" });
    return jsonResponse(500, {
      error: "Server Error",
      message: "Bible service is not configured.",
    });
  }

  const query = allowedSearch(route.kind, url.searchParams);
  let upstreamPath: string;
  if (route.kind === "bible") {
    upstreamPath = `/bibles/${route.versionId}`;
  } else if (route.kind === "books") {
    upstreamPath = `/bibles/${route.versionId}/books`;
  } else {
    upstreamPath = `/bibles/${route.versionId}/passages/${route.passageId}`;
  }
  const upstreamUrl = new URL(
    `${trimSlash(env.UPSTREAM_BASE || "https://api.youversion.com/v1")}${upstreamPath}`,
  );
  query.forEach((value, name) => {
    upstreamUrl.searchParams.set(name, value);
  });

  const cacheKey = new Request(cacheKeyUrl(upstreamPath, query), {
    method: "GET",
  });
  const cache = await getCache();
  if (cache) {
    const hit = await freshHit(cache, cacheKey);
    if (hit) {
      logEvent("proxy_ok", {
        source: "cache",
        version_id: route.versionId,
        path: url.pathname,
      });
      return hit;
    }
  }

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-YVP-App-Key": key,
    },
    redirect: "manual",
  }).catch((error: unknown) => {
    logEvent("upstream_error", { message: errorMessage(error) });
    return null;
  });

  if (!upstream) {
    return jsonResponse(502, {
      error: "Bad Gateway",
      message: "The Bible service is unavailable.",
    });
  }

  const response = sanitizeUpstream(upstream);
  const delivered =
    upstream.status === 200
      ? storeForApp(cache, ctx, cacheKey, upstream.headers, response)
      : response;

  logEvent("proxy_ok", {
    source: "origin",
    status: upstream.status,
    version_id: route.versionId,
    path: url.pathname,
  });
  return delivered;
}

function sanitizeUpstream(upstream: Response): Response {
  const headers = new Headers();
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  const retryAfter = upstream.headers.get("Retry-After");
  if (retryAfter) {
    headers.set("Retry-After", retryAfter);
  }
  headers.set("Cache-Control", "no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function freshHit(cache: Cache, cacheKey: Request): Promise<Response | null> {
  const hit = await cache.match(cacheKey);
  if (!hit) return null;
  if (stillFresh(hit, Date.now())) return toAppResponse(hit, "HIT");
  void hit.body?.cancel();
  if (typeof cache.delete === "function") {
    await cache.delete(cacheKey);
  }
  return null;
}

function storeForApp(
  cache: Cache | null,
  ctx: WorkerContext,
  cacheKey: Request,
  upstreamHeaders: Headers,
  response: Response,
): Response {
  const app = toAppResponse(response, "MISS");
  if (!cache || response.status !== 200) return app;
  const now = Date.now();
  const freshness = sharedFreshness(upstreamHeaders, now);
  if (!freshness.store) return app;
  const stored = app.clone();
  stored.headers.set("Cache-Control", `public, max-age=${freshness.maxAge}`);
  stored.headers.set("Date", new Date(now).toUTCString());
  ctx.waitUntil(cache.put(cacheKey, stored));
  return app;
}

function toAppResponse(source: Response, state: "HIT" | "MISS"): Response {
  const headers = new Headers(source.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Proxy-Cache", state);
  return new Response(source.body, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
}

function cacheKeyUrl(upstreamPath: string, query: URLSearchParams): string {
  const search = query.toString();
  return `https://bible-cache.journeys.internal/v1${upstreamPath}${search ? `?${search}` : ""}`;
}

async function getCache(): Promise<Cache | null> {
  try {
    if (typeof caches === "undefined") {
      return null;
    }
    if ("default" in caches && caches.default) {
      return caches.default;
    }
    return await caches.open("journeys-bible-proxy");
  } catch {
    return null;
  }
}

function adminTokenFrom(request: Request): string {
  const header = request.headers.get("X-Admin-Token");
  if (header) {
    return header.trim();
  }
  const authorization = request.headers.get("Authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return "";
}

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}


