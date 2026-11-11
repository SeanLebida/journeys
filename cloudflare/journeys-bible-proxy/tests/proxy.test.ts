import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { handleRequest } from "../src/worker.ts";
import {
  MemoryDownloadStats,
  MemoryRateLimiter,
  TEST_ADMIN_TOKEN,
  TEST_APP_KEY,
  headerOf,
  installMockFetch,
  jsonRequest,
  restoreFetch,
  testCtx,
  testEnv,
  type MockUpstream,
} from "./helpers.ts";

let mock: (MockUpstream & { restore?: () => void }) | null = null;

afterEach(() => {
  if (mock) {
    restoreFetch(mock);
    mock = null;
  }
});

function bibleJson(id: number, abbreviation: string) {
  return { id, abbreviation, title: abbreviation, publisher_name: "The Lockman Foundation" };
}

describe("allowlist and proxy", () => {
  test("proxies NASB 1995 bible metadata and injects the server app key", async () => {
    mock = installMockFetch((request) => {
      assert.equal(request.url, "https://api.youversion.com/v1/bibles/100");
      assert.equal(headerOf(request, "X-YVP-App-Key"), TEST_APP_KEY);
      return Response.json(bibleJson(100, "NASB1995"));
    });
    const response = await handleRequest(
      jsonRequest("/v1/bibles/100", {
        headers: { "X-YVP-App-Key": "client-supplied-key", Origin: "https://localhost" },
      }),
      testEnv(),
      testCtx(),
    );
    assert.equal(response.status, 200);
    assert.equal(mock.calls.length, 1);
    assert.equal(headerOf(mock.calls[0], "X-YVP-App-Key"), TEST_APP_KEY);
    assert.notEqual(headerOf(mock.calls[0], "X-YVP-App-Key"), "client-supplied-key");
    const body = await response.json();
    assert.equal(body.id, 100);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://localhost");
  });

  test("proxies NASB 2020 books and passages with allowed query params only", async () => {
    mock = installMockFetch((request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/books")) {
        assert.equal(url.searchParams.get("canon"), "old_testament");
        assert.equal(url.searchParams.get("debug"), null);
        return Response.json({ data: [{ id: "GEN", title: "Genesis" }] });
      }
      assert.equal(
        url.href,
        "https://api.youversion.com/v1/bibles/2692/passages/JHN.3.16?format=text",
      );
      return Response.json({
        id: "JHN.3.16",
        content: "For God so loved the world...",
        reference: "John 3:16",
      });
    });
    const env = testEnv();
    const ctx = testCtx();
    const books = await handleRequest(
      jsonRequest("/v1/bibles/2692/books?canon=old_testament&debug=1"),
      env,
      ctx,
    );
    assert.equal(books.status, 200);
    const passage = await handleRequest(
      jsonRequest("/v1/bibles/2692/passages/JHN.3.16?format=text"),
      env,
      ctx,
    );
    assert.equal(passage.status, 200);
    const body = await passage.json();
    assert.equal(body.reference, "John 3:16");
  });

  test("rejects NIV and every other non-allowlisted version with 403 and does not call upstream", async () => {
    mock = installMockFetch(() => {
      throw new Error("upstream should not be called");
    });
    const env = testEnv();
    const ctx = testCtx();
    const niv = await handleRequest(jsonRequest("/v1/bibles/111"), env, ctx);
    assert.equal(niv.status, 403);
    const nivPassage = await handleRequest(
      jsonRequest("/v1/bibles/111/passages/JHN.3.16"),
      env,
      ctx,
    );
    assert.equal(nivPassage.status, 403);
    const amp = await handleRequest(jsonRequest("/v1/bibles/1588"), env, ctx);
    assert.equal(amp.status, 403);
    const list = await handleRequest(jsonRequest("/v1/bibles"), env, ctx);
    assert.equal(list.status, 403);
    const book = await handleRequest(jsonRequest("/v1/bibles/100/books/GEN"), env, ctx);
    assert.equal(book.status, 403);
    assert.equal(mock.calls.length, 0);
  });
});

describe("download counting and admin stats", () => {
  test("counts a completed download per version per UTC month and rolls up the year", async () => {
    mock = installMockFetch(() => new Response("nope", { status: 500 }));
    const stats = new MemoryDownloadStats();
    const env = testEnv({ stats });
    const ctx = testCtx();

    const missingHeader = await handleRequest(
      jsonRequest("/v1/bibles/100/downloads", { method: "POST" }),
      env,
      ctx,
    );
    assert.equal(missingHeader.status, 400);

    const first = await handleRequest(
      jsonRequest("/v1/bibles/100/downloads", {
        method: "POST",
        headers: { "X-Journeys-Download": "complete" },
      }),
      env,
      ctx,
    );
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.ok, true);
    assert.equal(firstBody.version_id, 100);
    assert.equal(firstBody.month_count, 1);
    assert.equal(firstBody.year_total, 1);

    const second = await handleRequest(
      jsonRequest("/v1/bibles/100/downloads", {
        method: "POST",
        headers: { "X-Journeys-Download": "complete" },
      }),
      env,
      ctx,
    );
    const secondBody = await second.json();
    assert.equal(secondBody.month_count, 2);
    assert.equal(secondBody.year_total, 2);

    await handleRequest(
      jsonRequest("/v1/bibles/2692/downloads", {
        method: "POST",
        headers: { "X-Journeys-Download": "complete" },
      }),
      env,
      ctx,
    );

    const year = new Date().getUTCFullYear();
    const unauthorized = await handleRequest(
      jsonRequest(`/admin/stats?year=${year}`),
      env,
      ctx,
    );
    assert.equal(unauthorized.status, 401);

    const wrong = await handleRequest(
      jsonRequest(`/admin/stats?year=${year}`, {
        headers: { Authorization: "Bearer wrong-token" },
      }),
      env,
      ctx,
    );
    assert.equal(wrong.status, 401);

    const statsResponse = await handleRequest(
      jsonRequest(`/admin/stats?year=${year}`, {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }),
      env,
      ctx,
    );
    assert.equal(statsResponse.status, 200);
    const body = await statsResponse.json();
    assert.equal(body.year, year);
    const nasb1995 = body.versions.find((row: { version_id: number }) => row.version_id === 100);
    const nasb2020 = body.versions.find((row: { version_id: number }) => row.version_id === 2692);
    assert.equal(nasb1995.year_total, 2);
    assert.equal(nasb2020.year_total, 1);
    assert.equal(nasb1995.months[String(new Date().getUTCMonth() + 1)], 2);
    assert.equal(mock.calls.length, 0);
  });

  test("accepts X-Admin-Token as well as a Bearer token", async () => {
    const env = testEnv();
    const response = await handleRequest(
      jsonRequest("/admin/stats?year=2026", {
        headers: { "X-Admin-Token": TEST_ADMIN_TOKEN },
      }),
      env,
      testCtx(),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.versions[0].year_total, 0);
  });
});

describe("rate limit and client header", () => {
  test("returns 429 after the per-IP limit is exceeded", async () => {
    mock = installMockFetch(() => Response.json(bibleJson(100, "NASB1995")));
    const env = testEnv({
      limiter: new MemoryRateLimiter(2),
      rateLimitMax: "2",
    });
    const ctx = testCtx();
    const headers = { "CF-Connecting-IP": "203.0.113.10" };
    assert.equal((await handleRequest(jsonRequest("/v1/bibles/100", { headers }), env, ctx)).status, 200);
    assert.equal((await handleRequest(jsonRequest("/v1/bibles/100", { headers }), env, ctx)).status, 200);
    const limited = await handleRequest(jsonRequest("/v1/bibles/100", { headers }), env, ctx);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("Retry-After"), "60");
    assert.equal(mock.calls.length, 2);
  });

  test("can require the journeys client header", async () => {
    mock = installMockFetch(() => Response.json(bibleJson(100, "NASB1995")));
    const env = testEnv({ requireClient: true });
    const missing = await handleRequest(jsonRequest("/v1/bibles/100"), env, testCtx());
    assert.equal(missing.status, 403);
    const ok = await handleRequest(
      jsonRequest("/v1/bibles/100", { headers: { "X-Journeys-Client": "journeys" } }),
      env,
      testCtx(),
    );
    assert.equal(ok.status, 200);
  });
});
