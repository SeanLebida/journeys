import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { hmacSha256Hex } from "../src/crypto.ts";
import { handleRequest } from "../src/worker.ts";
import {
  MemoryDownloadStats,
  MemoryRateLimiter,
  TEST_ADMIN_TOKEN,
  TEST_APP_KEY,
  TEST_RATE_LIMIT_SALT,
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
  test("proxies passages for books whose code starts with a digit (1SA, 2KI, 1JN)", async () => {
    for (const id of ["1SA.1", "2KI.25", "1JN.5"]) {
      mock = installMockFetch((request) => {
        assert.equal(new URL(request.url).pathname, `/v1/bibles/100/passages/${id}`);
        return Response.json({ id, content: "<p>text</p>" });
      });
      const response = await handleRequest(
        jsonRequest(`/v1/bibles/100/passages/${id}`, { headers: { Origin: "https://localhost" } }),
        testEnv(),
        testCtx(),
      );
      assert.equal(response.status, 200, id);
      restoreFetch(mock);
      mock = null;
    }
  });

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
    const limiterNames: string[] = [];
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((value) => String(value)).join(" "));
    };
    try {
      const env = testEnv({
        limiter: new MemoryRateLimiter(2),
        rateLimitMax: "2",
        limiterNames,
      });
      const ctx = testCtx();
      const ip = "203.0.113.10";
      const headers = { "CF-Connecting-IP": ip };
      assert.equal((await handleRequest(jsonRequest("/v1/bibles/100", { headers }), env, ctx)).status, 200);
      assert.equal((await handleRequest(jsonRequest("/v1/bibles/100", { headers }), env, ctx)).status, 200);
      const limited = await handleRequest(jsonRequest("/v1/bibles/100", { headers }), env, ctx);
      assert.equal(limited.status, 429);
      assert.equal(limited.headers.get("Retry-After"), "60");
      assert.equal(mock.calls.length, 2);
      const expectedName = `ip:${await hmacSha256Hex(TEST_RATE_LIMIT_SALT, ip)}`;
      assert.deepEqual(limiterNames, [expectedName, expectedName, expectedName]);
      assert.equal(limiterNames.some((name) => name.includes(ip)), false);
      assert.equal(logs.some((line) => line.includes(ip)), false);
      const rateLimited = logs
        .map((line) => JSON.parse(line) as { event?: string; ip_hash?: string })
        .find((line) => line.event === "rate_limited");
      assert.equal(rateLimited?.ip_hash, expectedName.slice("ip:".length));
    } finally {
      console.log = originalLog;
    }
  });

  test("fails open when the rate-limit salt is missing, without naming a raw IP", async () => {
    mock = installMockFetch(() => Response.json(bibleJson(100, "NASB1995")));
    const limiterNames: string[] = [];
    const env = testEnv({
      limiter: new MemoryRateLimiter(1),
      rateLimitMax: "1",
      rateLimitSalt: "",
      limiterNames,
    });
    const ctx = testCtx();
    const headers = { "CF-Connecting-IP": "198.51.100.20" };
    assert.equal((await handleRequest(jsonRequest("/v1/bibles/100", { headers }), env, ctx)).status, 200);
    assert.equal((await handleRequest(jsonRequest("/v1/bibles/100", { headers }), env, ctx)).status, 200);
    assert.deepEqual(limiterNames, []);
  });

  test("can require the journeys client header", async () => {
    mock = installMockFetch(() => Response.json(bibleJson(100, "NASB1995")));
    const env = testEnv({ requireClient: true });
    const missing = await handleRequest(jsonRequest("/v1/bibles/100"), env, testCtx());
    assert.equal(missing.status, 403);
    const ok = await handleRequest(
      jsonRequest("/v1/bibles/100", {
        headers: { Origin: "https://localhost", "X-Journeys-Client": "journeys" },
      }),
      env,
      testCtx(),
    );
    assert.equal(ok.status, 200);
  });
});

describe("app client gate", () => {
  const allowedPair = {
    Origin: "https://localhost",
    "X-Journeys-Client": "journeys",
  };

  test("when the flag is off, a request with no Origin or client header is allowed", async () => {
    mock = installMockFetch(() => Response.json(bibleJson(100, "NASB1995")));
    const response = await handleRequest(jsonRequest("/v1/bibles/100"), testEnv(), testCtx());
    assert.equal(response.status, 200);
    assert.equal(mock.calls.length, 1);
  });

  test("when the flag is on, a missing X-Journeys-Client header is 403 even with an allowed Origin", async () => {
    mock = installMockFetch(() => {
      throw new Error("upstream should not be called");
    });
    const response = await handleRequest(
      jsonRequest("/v1/bibles/100", { headers: { Origin: "https://localhost" } }),
      testEnv({ requireClient: true }),
      testCtx(),
    );
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Forbidden");
    assert.equal(mock.calls.length, 0);
  });

  test("when the flag is on, a missing Origin is 403 even with the client header", async () => {
    mock = installMockFetch(() => {
      throw new Error("upstream should not be called");
    });
    const response = await handleRequest(
      jsonRequest("/v1/bibles/100", { headers: { "X-Journeys-Client": "journeys" } }),
      testEnv({ requireClient: true }),
      testCtx(),
    );
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Forbidden");
    assert.equal(mock.calls.length, 0);
  });

  test("when the flag is on, a wrong Origin is 403 even with the client header", async () => {
    mock = installMockFetch(() => {
      throw new Error("upstream should not be called");
    });
    const response = await handleRequest(
      jsonRequest("/v1/bibles/100", {
        headers: { Origin: "https://evil.example", "X-Journeys-Client": "journeys" },
      }),
      testEnv({ requireClient: true }),
      testCtx(),
    );
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Forbidden");
    assert.equal(mock.calls.length, 0);
  });

  test("when the flag is on, an allowed Origin and the client header succeed", async () => {
    mock = installMockFetch(() => Response.json(bibleJson(100, "NASB1995")));
    const env = testEnv({ requireClient: true });
    const ctx = testCtx();
    for (const origin of ["https://localhost", "capacitor://localhost"]) {
      const response = await handleRequest(
        jsonRequest("/v1/bibles/100", {
          headers: { Origin: origin, "X-Journeys-Client": "journeys" },
        }),
        env,
        ctx,
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    }
    assert.equal(mock.calls.length, 2);
  });

  test("when the flag is on, POST /downloads also requires the allowed pair", async () => {
    const env = testEnv({ requireClient: true });
    const ctx = testCtx();
    const denied = await handleRequest(
      jsonRequest("/v1/bibles/100/downloads", {
        method: "POST",
        headers: { "X-Journeys-Download": "complete" },
      }),
      env,
      ctx,
    );
    assert.equal(denied.status, 403);

    const ok = await handleRequest(
      jsonRequest("/v1/bibles/100/downloads", {
        method: "POST",
        headers: { ...allowedPair, "X-Journeys-Download": "complete" },
      }),
      env,
      ctx,
    );
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.ok, true);
    assert.equal(body.month_count, 1);
  });

  test("when the flag is on, OPTIONS preflight and admin stats are unchanged", async () => {
    mock = installMockFetch(() => {
      throw new Error("upstream should not be called");
    });
    const env = testEnv({ requireClient: true });
    const ctx = testCtx();
    const preflight = await handleRequest(
      jsonRequest("/v1/bibles/100/passages/JHN.3", {
        method: "OPTIONS",
        headers: {
          Origin: "capacitor://localhost",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "X-Journeys-Client",
        },
      }),
      env,
      ctx,
    );
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");

    const unauthorized = await handleRequest(jsonRequest("/admin/stats?year=2026"), env, ctx);
    assert.equal(unauthorized.status, 401);

    const stats = await handleRequest(
      jsonRequest("/admin/stats?year=2026", {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }),
      env,
      ctx,
    );
    assert.equal(stats.status, 200);
    assert.equal(mock.calls.length, 0);
  });
});
