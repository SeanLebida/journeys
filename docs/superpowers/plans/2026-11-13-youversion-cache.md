# YouVersion cache for offline Bibles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The proxy stores each successful YouVersion response for the lifetime that response's `Cache-Control` allows, so a later download can finish an on-device Bible without spending another request, and a chapter that is not on the device waits in the app's plain voice only while the device is online.

**Architecture:** A pure freshness function in the worker decides store-or-not. The existing worker cache holds a `public, max-age` copy; the app always receives `Cache-Control: no-store`. Reader-facing sentences live in one module. `streamChapter` retries a 429 with the download's `Retry-After` rules and does not pace a successful read. A Bible already in `downloaded` never calls the stream.

**Tech Stack:** Cloudflare Worker (TypeScript, `node --test`), React 18, Vitest, Zustand.

**Spec:** `docs/superpowers/specs/2026-11-13-youversion-cache-design.md`

## Global Constraints

- App key stays a Worker secret. Tests keep using the existing `TEST_APP_KEY`. Do not add a real key.
- Client lock stays: `X-Journeys-Client: journeys` and the current origin check.
- Cache is `caches.default` when present, otherwise `caches.open("journeys-bible-proxy")`. No KV and no Durable Object.
- NASB uses the same freshness function as every other version. Do not special-case Bible id 100 or 2692.
- Ignore `CACHE_TTL_PASSAGE_SECONDS`, `CACHE_TTL_METADATA_SECONDS`, and `CACHE_TTL_CATALOG_SECONDS`. Leave the env vars in place.
- Do not store `no-store`, `private`, `no-cache`, a zero lifetime, a missing lifetime, an already-stale response, or a `Vary` that lists anything other than `Accept-Encoding`.
- Shared lifetime is `s-maxage` when present, else `max-age`, else the seconds until `Expires`. Subtract `Age`.
- The object put in the worker cache is `Cache-Control: public, max-age=<remaining>`. The response to the app is `Cache-Control: no-store` plus `X-Proxy-Cache: HIT` or `MISS`.
- Do not revalidate with `ETag` or `If-None-Match`.
- `MIN_INTERVAL_MS` stays 18_000. Do not edit pull request 110's branch. A successful chapter read does not sleep.
- Busy wait: `Retry-After` seconds, or 10 seconds when that header is missing or not a number. Give up after 144 busy responses. Leaving the chapter aborts the wait.
- Offline limit: a streamed chapter is not written to disk, `localStorage`, or the Cache API. The session LRU in `youversionStream.ts` stays.
- With no connection, the sentence is `You're offline. Your downloaded versions are still here.` Do not say the chapter will open on its own.
- Sentences, exact: waiting `This chapter is taking a little longer. It will open on its own.` Give-up `This chapter didn't load. Try again in a little while.` Unavailable `This translation is not available to read in Journeys.` Download paused `The download paused. Chapters already saved are on this device. Tap Download to continue.` Download failed `The download didn't finish. Chapters already saved are on this device. Tap Download to continue.` Version list `Couldn't load the version list. Try again in a little while.` Language list `Couldn't load the language list. Try again in a little while.`
- Licensed-download note is unchanged. Worker JSON may keep an upstream status. The app does not display those worker sentences.
- Do not deploy the worker and do not open a pull request in this plan. Commits stay on the worktree branch.
- Execution starts from `origin/development` in a worktree. Copy this plan and the spec onto that branch. This checkout is behind `origin/development`.

## File structure

- Create `cloudflare/journeys-bible-proxy/src/freshness.ts` — `sharedFreshness` and `stillFresh`. Nothing else.
- Modify `cloudflare/journeys-bible-proxy/src/worker.ts` — catalog, languages, bible, books, and passage use freshness. Stop calling `cacheTtlSeconds`.
- Delete `cacheTtlSeconds` from `cloudflare/journeys-bible-proxy/src/routes.ts` once `worker.ts` no longer imports it.
- Create `src/content/bibleCopy.ts` — the sentences and `ReaderNotice`.
- Modify `src/content/youversion.ts` — export `retryAfterMs` and `MAX_BUSY_WAITS`; throw the download sentences.
- Modify `src/content/youversionCatalog.ts` — throw the list sentences.
- Modify `src/content/youversionStream.ts` — wait, offline, abort. Keep the in-memory LRU.
- Create `src/modes/bible/readerStatus.ts` — the line the reader shows.
- Modify `src/modes/bible/BibleMode.tsx` — render that line.
- Tests listed on each task. No new Playwright spec.

## Review Focus

These are the inputs most likely to store scripture too long, keep it on the phone, or promise an offline chapter will appear. Each one has a test on the task that owns it.

- Upstream `s-maxage` is shorter than `max-age`. A shared cache must keep the response only for `s-maxage` seconds. Task 1.
- `Age` has already used up `max-age`. The response must not be stored. Task 1.
- A cache hit must still send the app `Cache-Control: no-store`. The phone's HTTP cache must not keep the chapter. Task 2.
- `navigator.onLine === false` and the chapter is not on the device. Show the offline sentence, do not fetch, do not wait. Task 4.
- The translation id is in `downloaded`. `streamedYvId` returns null, so the reader never calls the proxy. Task 5.

---

### Task 1: Freshness decision

**Files:**
- Create: `cloudflare/journeys-bible-proxy/src/freshness.ts`
- Test: `cloudflare/journeys-bible-proxy/tests/freshness.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `sharedFreshness(headers: Headers, nowMs: number): { store: boolean; maxAge: number }` with `maxAge` 0 when `store` is false. `stillFresh(cached: Response, nowMs: number): boolean` reads `Date` and `Cache-Control` max-age on the stored response. Missing `Date`, missing `max-age`, or `nowMs` past `Date + maxAge * 1000` returns false.

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sharedFreshness, stillFresh } from "../src/freshness.ts";

const NOW = Date.parse("2026-11-13T12:00:00Z");

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("sharedFreshness", () => {
  test("max-age is the lifetime when s-maxage is absent", () => {
    assert.deepEqual(sharedFreshness(headers({ "cache-control": "public, max-age=120" }), NOW), { store: true, maxAge: 120 });
  });

  test("s-maxage wins over a longer max-age", () => {
    assert.deepEqual(
      sharedFreshness(headers({ "cache-control": "public, max-age=86400, s-maxage=30" }), NOW),
      { store: true, maxAge: 30 },
    );
  });

  test("Age shortens the life, and a used-up life is not stored", () => {
    assert.deepEqual(sharedFreshness(headers({ "cache-control": "max-age=100", age: "40" }), NOW), { store: true, maxAge: 60 });
    assert.deepEqual(sharedFreshness(headers({ "cache-control": "max-age=100", age: "100" }), NOW), { store: false, maxAge: 0 });
  });

  test("no-store, private, no-cache, and max-age 0 are not stored", () => {
    for (const value of ["no-store, max-age=120", "private, max-age=120", "public, no-cache, max-age=120", "max-age=0"]) {
      assert.equal(sharedFreshness(headers({ "cache-control": value }), NOW).store, false, value);
    }
  });

  test("a missing lifetime is not stored", () => {
    assert.deepEqual(sharedFreshness(headers({}), NOW), { store: false, maxAge: 0 });
  });

  test("Expires is used only when max-age and s-maxage are absent", () => {
    const soon = new Date(NOW + 90_000).toUTCString();
    const past = new Date(NOW - 1000).toUTCString();
    assert.deepEqual(sharedFreshness(headers({ expires: soon }), NOW), { store: true, maxAge: 90 });
    assert.equal(sharedFreshness(headers({ expires: past }), NOW).store, false);
    assert.deepEqual(
      sharedFreshness(headers({ "cache-control": "max-age=10", expires: soon }), NOW),
      { store: true, maxAge: 10 },
    );
  });

  test("Vary other than Accept-Encoding is not stored", () => {
    assert.equal(sharedFreshness(headers({ "cache-control": "max-age=10", vary: "Accept-Encoding" }), NOW).store, true);
    assert.equal(sharedFreshness(headers({ "cache-control": "max-age=10", vary: "Accept-Language" }), NOW).store, false);
    assert.equal(sharedFreshness(headers({ "cache-control": "max-age=10", vary: "Accept-Encoding, Accept-Language" }), NOW).store, false);
  });
});

describe("stillFresh", () => {
  test("a stored response is fresh only inside its max-age from Date", () => {
    const cached = new Response("{}", { headers: { date: new Date(NOW).toUTCString(), "cache-control": "public, max-age=30" } });
    assert.equal(stillFresh(cached, NOW + 29_000), true);
    assert.equal(stillFresh(cached, NOW + 30_000), false);
    assert.equal(stillFresh(new Response("{}", { headers: { "cache-control": "public, max-age=30" } }), NOW), false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run from `cloudflare/journeys-bible-proxy`: `node --experimental-strip-types --test tests/freshness.test.ts`

Expected: FAIL, cannot find `../src/freshness.ts`.

- [ ] **Step 3: Implement `sharedFreshness` and `stillFresh`**

Read `cache-control` with `headers.get` so multiple header lines arrive as one string. Directives are comma-separated, names case-insensitive. `s-maxage` and `max-age` values are integers. A `Vary` of `*` is not stored. `stillFresh` uses `Date.parse` on the `date` header.

- [ ] **Step 4: Run the test and confirm it passes**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/journeys-bible-proxy/src/freshness.ts cloudflare/journeys-bible-proxy/tests/freshness.test.ts
git commit -m "Decide YouVersion cache lifetime from Cache-Control"
```

### Task 2: Worker stores that lifetime and tells the app not to

**Files:**
- Modify: `cloudflare/journeys-bible-proxy/src/worker.ts` (catalog handler around the `ttl` / `cache.match` block, and `proxyYouVersion`)
- Modify: `cloudflare/journeys-bible-proxy/src/routes.ts` (delete `cacheTtlSeconds` after the import is gone)
- Modify: `cloudflare/journeys-bible-proxy/tests/catalog.test.ts` (the test named `passes language and paging through, injects the key, and edge-caches the trimmed list`)
- Test: `cloudflare/journeys-bible-proxy/tests/cache-lifetime.test.ts`

**Interfaces:**
- Consumes: `sharedFreshness`, `stillFresh` from Task 1
- Produces: a 200 from `/v1/bibles`, `/v1/languages`, `/v1/bibles/:id`, `/v1/bibles/:id/books`, and `/v1/bibles/:id/passages/:passage` stores only when `sharedFreshness` says so. A later request for the same cache key serves the stored body, calls upstream once, and sends the app `no-store`. A hit whose `stillFresh` is false is deleted and fetched again.

- [ ] **Step 1: Write the failing test**

Use `installMockFetch`, `jsonRequest`, `testEnv`, `testCtx`, and `handleRequest` from `tests/helpers.ts`. Install a `caches.default` with `match` and `put` backed by a `Map` keyed by request URL. Await `ctx.pending` before the second request.

```ts
test("a passage with s-maxage is served once from the worker cache and the app is told no-store", async () => {
  // upstream Cache-Control: public, max-age=86400, s-maxage=30
  // GET /v1/bibles/100/passages/JHN.3 twice with the usual app headers
  // first response: Cache-Control no-store, X-Proxy-Cache MISS
  // second response: Cache-Control no-store, X-Proxy-Cache HIT, same body
  // upstream fetch count: 1
});

test("the catalog TTL env does not store a response that has no freshness", async () => {
  // testEnv() leaves CACHE_TTL_CATALOG_SECONDS at 86400
  // upstream JSON has no Cache-Control
  // two GETs /v1/bibles?language_ranges[]=es
  // both responses Cache-Control no-store
  // upstream fetch count: 2
});

test("a stale hit is fetched again", async () => {
  // first upstream response: Cache-Control public, max-age=1, and the stored Date is forced an hour old
  // second GET calls upstream again
});
```

The third test may set the stored `Date` through the memory cache after the first `put`. Assert the second response is `X-Proxy-Cache: MISS` and the upstream count is 2.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --experimental-strip-types --test tests/cache-lifetime.test.ts`

Expected: FAIL because the app still receives `public, max-age=86400` or the second request calls upstream.

- [ ] **Step 3: Wire the worker**

On a hit, return it only when `stillFresh` is true; otherwise `cache.delete` if that method exists, or overwrite on the next put, and fall through. On a miss, after a 200 body is ready, call `sharedFreshness(upstream.headers, Date.now())`. When `store` is true, `cache.put` a clone whose `Cache-Control` is `public, max-age=<maxAge>` and whose `Date` is now. The response returned to the app always has `Cache-Control: no-store` and `X-Proxy-Cache`. When `store` is false, do not put. Apply this in both the catalog/languages handler and `proxyYouVersion`. Stop reading the TTL env vars. Delete `cacheTtlSeconds`.

Update the existing catalog test so the upstream response sends `Cache-Control: public, max-age=86400` and the app response asserts `no-store`.

- [ ] **Step 4: Run the worker tests**

Run: `node --experimental-strip-types --test tests/freshness.test.ts tests/cache-lifetime.test.ts tests/catalog.test.ts tests/proxy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/journeys-bible-proxy/src/freshness.ts cloudflare/journeys-bible-proxy/src/worker.ts cloudflare/journeys-bible-proxy/src/routes.ts cloudflare/journeys-bible-proxy/tests/cache-lifetime.test.ts cloudflare/journeys-bible-proxy/tests/catalog.test.ts
git commit -m "Store YouVersion responses for their Cache-Control lifetime"
```

### Task 3: Reader-facing sentences for downloads and lists

**Files:**
- Create: `src/content/bibleCopy.ts`
- Modify: `src/content/youversion.ts` (the three `new Error(...)` sites in `getJson`, and export `retryAfterMs` and `MAX_BUSY_WAITS`)
- Modify: `src/content/youversionCatalog.ts` (`getJson` around the `!res.ok` throw, `loadCatalog`'s `error` string, and the language-list `!res.ok` throw)
- Modify: `src/state/useYouVersionCatalog.ts` (the `error: 'Bible list failed.'` fallback in the catalog `catch`)
- Modify: `tests/unit/youversion.test.ts` (the test `saves and reports nothing when a chapter fails`, which expects `'403'`)
- Test: `tests/unit/bible-copy.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `ReaderNotice extends Error` with `name === 'ReaderNotice'`. Constants `CHAPTER_WAITING`, `CHAPTER_GAVE_UP`, `CHAPTER_UNAVAILABLE`, `CHAPTER_OFFLINE`, `DOWNLOAD_PAUSED`, `DOWNLOAD_FAILED`, `VERSION_LIST_FAILED`, `LANGUAGE_LIST_FAILED` holding the sentences in Global Constraints. `export function retryAfterMs(res: Response): number` and `export const MAX_BUSY_WAITS = 144` from `youversion.ts`. `retryAfterMs` returns the header in milliseconds, or `10_000`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { CHAPTER_OFFLINE, VERSION_LIST_FAILED } from '../../src/content/bibleCopy';
import { fetchCatalog, loadCatalog, loadLanguages } from '../../src/content/youversionCatalog';

it('a failed version list uses the plain sentence and keeps the English language fallback', async () => {
  const fetchImpl = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
  await expect(fetchCatalog('en', { fetchImpl })).rejects.toThrow(VERSION_LIST_FAILED);
  const storage = { getItem: async () => null, setItem: async () => undefined };
  const catalog = await loadCatalog('en', { fetchImpl, storage });
  expect(catalog.error).toBe(VERSION_LIST_FAILED);
  expect(catalog.error).not.toMatch(/\d{3}/);
  const languages = await loadLanguages('en', { fetchImpl, storage });
  expect(languages.map((l) => l.tag)).toEqual(['en']);
});
```

`loadLanguages` still returns the one English row when the fetch fails and nothing is cached. That existing offline fallback stays. The status code leaves the thrown message: `throw new ReaderNotice(LANGUAGE_LIST_FAILED)`. The store's catalog `catch` sets `error` to `VERSION_LIST_FAILED`, not `'Bible list failed.'`.

Add a download assertion beside the existing chapter-failure test:

```ts
await expect(downloadLicensed(/* the existing nasb fixture and noSleep */)).rejects.toThrow(DOWNLOAD_FAILED);
```

And one new download test: `busyTimes: 145` on the existing `proxy()` helper rejects with `DOWNLOAD_PAUSED`.

Also assert `CHAPTER_OFFLINE` equals `You're offline. Your downloaded versions are still here.`

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- tests/unit/bible-copy.test.ts tests/unit/youversion.test.ts tests/unit/youversion-catalog.test.ts`

Expected: FAIL. The chapter-failure test still sees `403`. The new list test sees `Bible service` or a status code.

- [ ] **Step 3: Add the sentences and use them**

`ReaderNotice` sets `this.name = 'ReaderNotice'`. Download `getJson` uses `DOWNLOAD_PAUSED` for the busy give-up and `DOWNLOAD_FAILED` for a 5xx and for every other non-OK status. Catalog `getJson` throws `VERSION_LIST_FAILED` for every `!res.ok`. `loadCatalog` passes that message through as `error`. The language fetch throws `LANGUAGE_LIST_FAILED` for every `!res.ok`, and the `loadLanguages` catch still returns the cached list or the single English row. The catalog `catch` in `useYouVersionCatalog.ts` uses `VERSION_LIST_FAILED`. Export the existing `retryAfterMs` unchanged and export `MAX_BUSY_WAITS`.

- [ ] **Step 4: Run the tests and confirm they pass**

Same command. Expected: PASS. The existing test `waits out many busy answers without giving up` still passes at 15 busy responses.

- [ ] **Step 5: Commit**

```bash
git add src/content/bibleCopy.ts src/content/youversion.ts src/content/youversionCatalog.ts src/state/useYouVersionCatalog.ts tests/unit/bible-copy.test.ts tests/unit/youversion.test.ts
git commit -m "Say download and list failures in the reader's voice"
```

### Task 4: A chapter that is not on the device waits only while online

**Files:**
- Modify: `src/content/youversionStream.ts`
- Modify: `tests/unit/youversion-stream.test.ts`

**Interfaces:**
- Consumes: `ReaderNotice`, `CHAPTER_GAVE_UP`, `CHAPTER_UNAVAILABLE`, `CHAPTER_OFFLINE` from `bibleCopy.ts`. `retryAfterMs` and `MAX_BUSY_WAITS` from `youversion.ts`.
- Produces: `StreamOptions` gains `sleep?: (ms: number, signal?: AbortSignal) => Promise<void>`. `chapterIsWaiting(): boolean` and `subscribeChapterWait(cb: () => void): () => void`. `streamChapter` and `streamChapterCounts` keep their current signatures otherwise. A 200 does not call `sleep`. A 429 calls `sleep(retryAfterMs(res), signal)` and tries again, and `chapterIsWaiting()` is true during that sleep. The loop matches the download: `if (++busy > MAX_BUSY_WAITS) break`, so 144 busy responses are waited out and the 145th rejects with `ReaderNotice` and `CHAPTER_GAVE_UP` without a further sleep. A 403 rejects with `ReaderNotice` and `CHAPTER_UNAVAILABLE`. `navigator.onLine === false` rejects with `ReaderNotice` and `CHAPTER_OFFLINE` and does not call `fetchImpl`. Abort rejects with the abort reason and leaves `chapterIsWaiting()` false. The in-memory chapter map still drops a rejected promise and still caps at 40.

- [ ] **Step 1: Write the failing tests**

Replace the current `a failure is not cached and says why` 429 expectation. It must no longer expect an immediate `/busy/` throw.

```ts
it('a busy chapter waits out Retry-After and then loads', async () => {
  const sleeps: number[] = [];
  let n = 0;
  const fetchImpl = (async () => {
    n += 1;
    if (n === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '7' } });
    return Response.json({ content: CHAPTER });
  }) as unknown as typeof fetch;
  const rows = await streamChapter(1, 1, 1, { fetchImpl, sleep: async (ms) => void sleeps.push(ms) });
  expect(sleeps).toEqual([7000]);
  expect(rows).toHaveLength(2);
  expect(chapterIsWaiting()).toBe(false);
});

it('a missing Retry-After waits 10 seconds', async () => {
  const sleeps: number[] = [];
  // first response 429 with no Retry-After, second 200
  // expect sleeps to equal [10000]
});

it('gives up on the 145th busy response', async () => {
  // fetch always 429, sleep resolves immediately
  // expect reject ReaderNotice with CHAPTER_GAVE_UP
  // expect 145 fetches and 144 sleeps
});

it('does not fetch when the device is offline', async () => {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  const fetchImpl = vi.fn();
  await expect(streamChapter(1, 1, 1, { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(CHAPTER_OFFLINE);
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(chapterIsWaiting()).toBe(false);
});

it('a successful read does not sleep', async () => {
  const sleep = vi.fn(async () => undefined);
  await streamChapter(3034, 43, 3, { base: 'https://p.test', fetchImpl: fetchOk({ content: CHAPTER }), sleep });
  expect(sleep).not.toHaveBeenCalled();
});

it('abort during the wait rejects and clears the waiting flag', async () => {
  // 429, sleep rejects when signal aborts, abort the controller
  // expect the abort reason, chapterIsWaiting() false, and a later call can fetch again
});
```

Keep the existing tests for one parsed chapter, the memory cap, no `localStorage` write, 403 text, and `streamChapterCounts`.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- tests/unit/youversion-stream.test.ts`

Expected: FAIL. A single 429 still throws the old busy sentence, or `chapterIsWaiting` is missing.

- [ ] **Step 3: Implement the wait inside `getJson`**

Check `navigator.onLine === false` before fetch and after a fetch throw. Only a 429 sleeps. Any other non-OK status except 403 rejects with `CHAPTER_GAVE_UP`. A fetch throw while online rejects with `CHAPTER_GAVE_UP`. An aborted signal rethrows. Set the waiting flag true only around the busy sleep, and false in `finally`. Do not import `Pacer` and do not read `MIN_INTERVAL_MS`. Default `sleep` is a `setTimeout` that rejects on abort. `streamChapterCounts` uses the same `getJson`.

- [ ] **Step 4: Run the test and confirm it passes**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/youversionStream.ts tests/unit/youversion-stream.test.ts
git commit -m "Wait out a busy chapter while the device is online"
```

### Task 5: The reader shows that line, and an on-device Bible never waits

**Files:**
- Create: `src/modes/bible/readerStatus.ts`
- Modify: `src/modes/bible/BibleMode.tsx` (the read-tab loading paragraph and the error paragraph)
- Test: `tests/unit/reader-status.test.ts`
- Modify: `package.json`, `CHANGELOG.md`, `learnings/2026-11-13-youversion-cache.md`, `learnings/README.md` (index line only)

**Interfaces:**
- Consumes: `CHAPTER_WAITING`, `ReaderNotice` from `bibleCopy.ts`. `chapterIsWaiting`, `subscribeChapterWait` from `youversionStream.ts`. `streamedYvId` from `useUiStore.ts`.
- Produces: `readerStatusText(input: { loading: boolean; waiting: boolean; error: unknown; chapterLabel: string }): string | null`. Waiting and loading returns `CHAPTER_WAITING`. Loading and not waiting returns `Loading…`. A `ReaderNotice` returns `error.message` with no prefix. Any other `Error` returns `Could not load ${chapterLabel}: ${error.message}`. Otherwise null.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { ReaderNotice, CHAPTER_OFFLINE, CHAPTER_WAITING } from '../../src/content/bibleCopy';
import type { DownloadedTranslation } from '../../src/content/downloads';
import { readerStatusText } from '../../src/modes/bible/readerStatus';
import { streamedYvId, type StreamedTranslation } from '../../src/state/useUiStore';

const streamed: StreamedTranslation = {
  id: 'yv:3034', yvId: 3034, name: 'BSB', shortName: 'BSB', languageTag: 'en', rtl: false,
  publisher: null, publisherUrl: null, notice: null,
};

describe('readerStatusText', () => {
  it('uses the waiting sentence only while a load is waiting', () => {
    expect(readerStatusText({ loading: true, waiting: true, error: null, chapterLabel: 'John 3' })).toBe(CHAPTER_WAITING);
    expect(readerStatusText({ loading: true, waiting: false, error: null, chapterLabel: 'John 3' })).toBe('Loading…');
  });

  it('shows a reader notice by itself and keeps the prefix for other errors', () => {
    expect(readerStatusText({ loading: false, waiting: false, error: new ReaderNotice(CHAPTER_OFFLINE), chapterLabel: 'John 3' })).toBe(CHAPTER_OFFLINE);
    expect(readerStatusText({ loading: false, waiting: false, error: new Error('nope'), chapterLabel: 'John 3' })).toBe('Could not load John 3: nope');
  });
});

it('a downloaded translation is not streamed', () => {
  expect(streamedYvId('yv:100', { downloaded: [{ id: 'yv:100' } as DownloadedTranslation], streamed: [] })).toBeNull();
  expect(streamedYvId('yv:3034', { downloaded: [], streamed: [streamed] })).toBe(3034);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- tests/unit/reader-status.test.ts`

Expected: FAIL, `readerStatus.ts` missing.

- [ ] **Step 3: Implement the helper and use it in BibleMode**

`BibleMode` subscribes with `useSyncExternalStore(subscribeChapterWait, chapterIsWaiting, () => false)`. The loading paragraph and the error paragraph render `readerStatusText`. Do not show both a waiting line and an error. An on-device translation never sets `waiting`, because `lookupChapter` does not call `streamChapter` when `streamedYvId` is null. Leave that gate as it is.

Bump the patch version in `package.json` by one from the version on this branch. Add `## [that version] - 2026-11-13` at the top of `CHANGELOG.md`: the proxy keeps a YouVersion response for the lifetime its Cache-Control allows, and a chapter that is not on the device waits instead of showing a status code. Add `learnings/2026-11-13-youversion-cache.md` with `## What changed`, `## Why it mattered`, `## Gotchas / pitfalls`, and `## Verification`. Link it from `learnings/README.md` without rewriting older entries.

- [ ] **Step 4: Run the unit tests**

Run: `npm test -- tests/unit/reader-status.test.ts tests/unit/youversion-stream.test.ts tests/unit/youversion.test.ts tests/unit/bible-copy.test.ts tests/unit/streamed-translation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modes/bible/readerStatus.ts src/modes/bible/BibleMode.tsx tests/unit/reader-status.test.ts package.json CHANGELOG.md learnings/2026-11-13-youversion-cache.md learnings/README.md
git commit -m "Show a waiting chapter in the reader's voice"
```
