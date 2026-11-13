import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { biblePolicy } from "../src/allowlist.ts";
import { parseCatalogQuery, sanitizeCatalog } from "../src/catalog.ts";
import { handleRequest } from "../src/worker.ts";
import {
  MemoryDownloadStats,
  TEST_APP_KEY,
  TEST_ADMIN_TOKEN,
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

const APP = { Origin: "https://localhost", "X-Journeys-Client": "journeys" };

function upstreamBible(id: number, abbreviation: string, language = "en", extra: Record<string, unknown> = {}) {
  return {
    id,
    abbreviation,
    localized_abbreviation: abbreviation,
    title: `${abbreviation} title`,
    localized_title: `English: ${abbreviation}`,
    language_tag: language,
    copyright: `© ${abbreviation}`,
    promotional_content: "long promo that the app does not need",
    publisher_name: "Publisher",
    publisher_url: "https://publisher.example",
    info: null,
    books: ["GEN", "EXO", "MAT", "JHN", "REV"],
    youversion_deep_link: `https://www.bible.com/versions/${id}`,
    organization_id: "00000000-0000-0000-0000-000000000000",
    ...extra,
  };
}

describe("bible policy", () => {
  test("explicit allow list, star, block list and offline subset", () => {
    const nasb = biblePolicy({ ALLOWED_BIBLE_IDS: "100,2692" });
    assert.equal(nasb.canRead(100), true);
    assert.equal(nasb.canRead(111), false);
    assert.equal(nasb.canStore(2692), true);

    const all = biblePolicy({ ALLOWED_BIBLE_IDS: "*", BLOCKED_BIBLE_IDS: "111", OFFLINE_BIBLE_IDS: "100,2692,111" });
    assert.equal(all.canRead(3034), true);
    assert.equal(all.canRead(111), false);
    assert.equal(all.canStore(3034), false);
    assert.equal(all.canStore(111), false, "a blocked id can never be stored");
    assert.equal(all.canStore(100), true);
    assert.notEqual(all.fingerprint, nasb.fingerprint);
  });

  test("offline ids must also be readable", () => {
    const p = biblePolicy({ ALLOWED_BIBLE_IDS: "100", OFFLINE_BIBLE_IDS: "100,2692" });
    assert.equal(p.canStore(2692), false);
  });
});

describe("catalog query", () => {
  test("defaults to all languages and the largest page", () => {
    assert.deepEqual(parseCatalogQuery(new URLSearchParams()), { languageRanges: ["*"], pageSize: 99, pageToken: null });
  });

  test("accepts bracket, plain and comma forms, dedupes", () => {
    const q = parseCatalogQuery(new URLSearchParams("language_ranges[]=en&language_ranges=es,en&page_size=20&page_token=eyJ9"));
    assert.deepEqual(q, { languageRanges: ["en", "es"], pageSize: 20, pageToken: "eyJ9" });
  });

  test("rejects prefix wildcards, bad sizes and junk tokens", () => {
    assert.equal(parseCatalogQuery(new URLSearchParams("language_ranges[]=en*")), null);
    assert.equal(parseCatalogQuery(new URLSearchParams("page_size=100")), null);
    assert.equal(parseCatalogQuery(new URLSearchParams("page_size=0")), null);
    assert.equal(parseCatalogQuery(new URLSearchParams("page_token=<script>")), null);
    assert.equal(parseCatalogQuery(new URLSearchParams("language_ranges=en,es,fr,de,it,pt")), null);
  });
});

describe("sanitizeCatalog", () => {
  test("keeps only app fields and adds capability flags", () => {
    const policy = biblePolicy({ ALLOWED_BIBLE_IDS: "*", BLOCKED_BIBLE_IDS: "111" });
    const page = sanitizeCatalog(
      {
        data: [
          upstreamBible(100, "NASB1995"),
          upstreamBible(3034, "BSB", "en", { books: ["MAT", "MRK"], publisher_url: "javascript:alert(1)" }),
          upstreamBible(111, "NIV"),
          { id: "bad" },
        ],
        next_page_token: "abc",
        total_size: 4,
      },
      policy,
    );
    assert.deepEqual(page.data.map((b) => b.id), [100, 3034]);
    const [nasb, bsb] = page.data;
    assert.equal(nasb.offline, true);
    assert.equal(nasb.readable, true);
    assert.equal(bsb.offline, false);
    assert.equal(bsb.readable, true);
    assert.equal(bsb.has_old_testament, false);
    assert.equal(bsb.has_new_testament, true);
    assert.equal(bsb.publisher_url, null);
    assert.equal("promotional_content" in nasb, false);
    assert.equal("books" in nasb, false);
    assert.equal(page.next_page_token, "abc");
  });
});

describe("GET /v1/bibles", () => {
  test("passes language and paging through, injects the key, and edge-caches the trimmed list", async () => {
    mock = installMockFetch((request) => {
      const url = new URL(request.url);
      assert.equal(url.pathname, "/v1/bibles");
      assert.deepEqual(url.searchParams.getAll("language_ranges[]"), ["es"]);
      assert.equal(url.searchParams.get("page_size"), "50");
      assert.equal(url.searchParams.get("page_token"), "tok");
      assert.equal(url.searchParams.get("all_available"), null, "never asks for unlicensed Bibles");
      assert.equal(headerOf(request, "X-YVP-App-Key"), TEST_APP_KEY);
      return Response.json({ data: [upstreamBible(128, "NVI", "es")], next_page_token: "n2", total_size: 51 });
    });
    const ctx = testCtx();
    const res = await handleRequest(
      jsonRequest("/v1/bibles?language_ranges[]=es&page_size=50&page_token=tok", {
        headers: { ...APP, "X-YVP-App-Key": "client-key" },
      }),
      testEnv({ requireClient: true, allowedIds: "*" }),
      ctx,
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=86400");
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://localhost");
    const body = await res.json();
    assert.equal(body.data[0].abbreviation, "NVI");
    assert.equal(body.data[0].readable, true);
    assert.equal(body.data[0].offline, false);
    assert.equal(body.next_page_token, "n2");
    assert.equal(body.total_size, 51);
    assert.equal(JSON.stringify(body).includes(TEST_APP_KEY), false);
  });

  test("marks versions outside the read allow list as not readable", async () => {
    mock = installMockFetch(() => Response.json({ data: [upstreamBible(100, "NASB1995"), upstreamBible(3034, "BSB")] }));
    const res = await handleRequest(jsonRequest("/v1/bibles?language_ranges[]=en", { headers: APP }), testEnv(), testCtx());
    const body = await res.json();
    assert.deepEqual(
      body.data.map((b: { id: number; readable: boolean; offline: boolean }) => [b.id, b.readable, b.offline]),
      [
        [100, true, true],
        [3034, false, false],
      ],
    );
  });

  test("rejects invalid queries without calling YouVersion", async () => {
    mock = installMockFetch(() => Response.json({}));
    const res = await handleRequest(jsonRequest("/v1/bibles?page_size=500", { headers: APP }), testEnv(), testCtx());
    assert.equal(res.status, 400);
    assert.equal(mock.calls.length, 0);
  });

  test("still requires the app client headers", async () => {
    mock = installMockFetch(() => Response.json({}));
    const res = await handleRequest(jsonRequest("/v1/bibles"), testEnv({ requireClient: true }), testCtx());
    assert.equal(res.status, 403);
    assert.equal(mock.calls.length, 0);
  });

  test("passes a 429 through with Retry-After and never caches errors", async () => {
    mock = installMockFetch(() => new Response("{}", { status: 429, headers: { "Retry-After": "30" } }));
    const res = await handleRequest(jsonRequest("/v1/bibles", { headers: APP }), testEnv(), testCtx());
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "30");
    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });

  test("204 from YouVersion becomes an empty page", async () => {
    mock = installMockFetch(() => new Response(null, { status: 204 }));
    const res = await handleRequest(jsonRequest("/v1/bibles?language_ranges[]=tlh", { headers: APP }), testEnv(), testCtx());
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).data, []);
  });
});

describe("GET /v1/languages", () => {
  test("asks only for languages with Bibles, small fields, and forwards one Accept-Language", async () => {
    mock = installMockFetch((request) => {
      const url = new URL(request.url);
      assert.equal(url.pathname, "/v1/languages");
      assert.equal(url.searchParams.get("bibles_available"), "true");
      assert.equal(url.searchParams.getAll("fields[]").includes("display_names"), false);
      assert.equal(headerOf(request, "Accept-Language"), "es");
      return Response.json({
        data: [{ id: "en", language: "en", localized_name: "inglés", text_direction: "ltr", default_bible_id: 3034, display_names: { huge: "x" } }],
        total_size: 1,
      });
    });
    const res = await handleRequest(
      jsonRequest("/v1/languages", { headers: { ...APP, "Accept-Language": "es;q=1, en;q=0.5" } }),
      testEnv(),
      testCtx(),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data[0], { id: "en", language: "en", script: null, localized_name: "inglés", text_direction: "ltr", default_bible_id: 3034 });
  });
});

describe("reading and storing under the wider policy", () => {
  test("with ALLOWED_BIBLE_IDS=*, any licensed version streams but only offline ids count downloads", async () => {
    mock = installMockFetch(() => Response.json({ id: "JHN.3", content: "<p>text</p>" }));
    const stats = new MemoryDownloadStats();
    const env = testEnv({ allowedIds: "*", blockedIds: "111", stats });
    const stream = await handleRequest(jsonRequest("/v1/bibles/3034/passages/JHN.3", { headers: APP }), env, testCtx());
    assert.equal(stream.status, 200);
    const blocked = await handleRequest(jsonRequest("/v1/bibles/111/passages/JHN.3", { headers: APP }), env, testCtx());
    assert.equal(blocked.status, 403);
    const store = await handleRequest(
      jsonRequest("/v1/bibles/3034/downloads", { method: "POST", headers: { ...APP, "X-Journeys-Download": "complete" } }),
      env,
      testCtx(),
    );
    assert.equal(store.status, 403);
    const nasb = await handleRequest(
      jsonRequest("/v1/bibles/100/downloads", { method: "POST", headers: { ...APP, "X-Journeys-Download": "complete" } }),
      env,
      testCtx(),
    );
    assert.equal(nasb.status, 200);
    const admin = await handleRequest(
      jsonRequest("/admin/stats?year=" + new Date().getUTCFullYear(), { headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` } }),
      env,
      testCtx(),
    );
    const report = await admin.json();
    assert.deepEqual(report.versions.map((v: { version_id: number }) => v.version_id), [100, 2692]);
  });
});
