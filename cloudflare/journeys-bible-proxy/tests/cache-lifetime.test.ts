import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { handleRequest } from "../src/worker.ts";
import {
  installMockFetch,
  jsonRequest,
  restoreFetch,
  testCtx,
  testEnv,
  type MockUpstream,
} from "./helpers.ts";

const APP = { Origin: "https://localhost", "X-Journeys-Client": "journeys" };

let mock: (MockUpstream & { restore?: () => void }) | null = null;
let previousCaches: typeof globalThis.caches | undefined;
let installedCache = false;
const memory = new Map<string, Response>();

function requestUrl(request: RequestInfo | URL): string {
  if (request instanceof Request) return request.url;
  return String(request);
}

function installMemoryCache(): Map<string, Response> {
  memory.clear();
  previousCaches = globalThis.caches;
  installedCache = true;
  const cache = {
    async match(request: RequestInfo | URL): Promise<Response | undefined> {
      const hit = memory.get(requestUrl(request));
      return hit ? hit.clone() : undefined;
    },
    async put(request: RequestInfo | URL, response: Response): Promise<void> {
      memory.set(requestUrl(request), response.clone());
    },
    async delete(request: RequestInfo | URL): Promise<boolean> {
      return memory.delete(requestUrl(request));
    },
  };
  globalThis.caches = { default: cache } as unknown as typeof globalThis.caches;
  return memory;
}

afterEach(() => {
  if (mock) {
    restoreFetch(mock);
    mock = null;
  }
  if (installedCache) {
    if (previousCaches) globalThis.caches = previousCaches;
    else delete globalThis.caches;
    installedCache = false;
    previousCaches = undefined;
  }
  memory.clear();
});

describe("worker cache lifetime", () => {
  test("a passage with s-maxage is served once from the worker cache and the app is told no-store", async () => {
    const body = { id: "JHN.3", content: "<p>For God so loved</p>" };
    mock = installMockFetch(() =>
      Response.json(body, {
        headers: { "Cache-Control": "public, max-age=86400, s-maxage=30" },
      }),
    );
    installMemoryCache();
    const env = testEnv();
    const ctx = testCtx();
    const path = "/v1/bibles/100/passages/JHN.3";
    const first = await handleRequest(jsonRequest(path, { headers: APP }), env, ctx);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("Cache-Control"), "no-store");
    assert.equal(first.headers.get("X-Proxy-Cache"), "MISS");
    const firstBody = await first.json();
    await Promise.all(ctx.pending);

    const second = await handleRequest(jsonRequest(path, { headers: APP }), env, ctx);
    assert.equal(second.headers.get("Cache-Control"), "no-store");
    assert.equal(second.headers.get("X-Proxy-Cache"), "HIT");
    assert.deepEqual(await second.json(), firstBody);
    assert.equal(mock.calls.length, 1);
  });

  test("the catalog TTL env does not store a response that has no freshness", async () => {
    mock = installMockFetch(() => Response.json({ data: [], next_page_token: null, total_size: 0 }));
    installMemoryCache();
    const env = testEnv();
    assert.equal(env.CACHE_TTL_CATALOG_SECONDS, "86400");
    const path = "/v1/bibles?language_ranges[]=es";
    const ctx = testCtx();
    const first = await handleRequest(jsonRequest(path, { headers: APP }), env, ctx);
    assert.equal(first.headers.get("Cache-Control"), "no-store");
    await Promise.all(ctx.pending);

    const second = await handleRequest(jsonRequest(path, { headers: APP }), env, ctx);
    assert.equal(second.headers.get("Cache-Control"), "no-store");
    assert.equal(mock.calls.length, 2);
  });

  test("a stale hit is fetched again", async () => {
    let calls = 0;
    mock = installMockFetch(() => {
      calls += 1;
      return Response.json(
        { id: "JHN.3", content: `body-${calls}` },
        { headers: { "Cache-Control": "public, max-age=1" } },
      );
    });
    const store = installMemoryCache();
    const env = testEnv();
    const ctx = testCtx();
    const path = "/v1/bibles/100/passages/JHN.3";
    const first = await handleRequest(jsonRequest(path, { headers: APP }), env, ctx);
    assert.equal(first.headers.get("X-Proxy-Cache"), "MISS");
    await Promise.all(ctx.pending);

    assert.equal(store.size, 1);
    const stored = store.values().next().value;
    assert.ok(stored);
    stored.headers.set("Date", new Date(Date.now() - 60 * 60 * 1000).toUTCString());

    const second = await handleRequest(jsonRequest(path, { headers: APP }), env, ctx);
    assert.equal(second.headers.get("X-Proxy-Cache"), "MISS");
    assert.equal(second.headers.get("Cache-Control"), "no-store");
    assert.equal(mock.calls.length, 2);
  });
});
