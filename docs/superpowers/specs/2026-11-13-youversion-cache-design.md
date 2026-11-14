# YouVersion cache for offline Bibles

Date: 2026-11-13

Journeys is an offline app. As far as a publisher allows, a Bible lives on the device, and reading it does not need a connection. The proxy cache exists so a chapter fetched once can finish the next on-device copy without spending another request on the shared app key. A chapter that is not on the device yet, and only while the device is online, keeps trying on its own and says so in the same plain voice as the rest of the app.

## Why

YouVersion's support (Philip, 2026-11-13) set this app key at 200 requests an hour until the app is on the live tier, and at 10,000 an hour after that. The allowance is shared by everyone using the key. YouVersion does not report how much of the hour is left. A busy response is the only signal, and it carries `Retry-After`.

The same note says each API response includes `Cache-Control`, and that honoring that header per RFC 7234 is the whole caching rule. There is no separate YouVersion caching spec. Lockman's permission for NASB does not allow a server copy kept longer than that header. Sean decided NASB uses the same lifetime as every other version.

A full NASB is 1,189 chapter requests. The first download costs that many requests. The proxy cache does nothing for a phone that already has no signal: the worker is on the network. It matters while a download is running. A later download of a stored chapter costs no YouVersion request, so more devices can finish an offline NASB inside the same hour. Today the proxy can store responses, and production stores no chapter text: `CACHE_TTL_PASSAGE_SECONDS` and `CACHE_TTL_METADATA_SECONDS` are `0`. Where storage is on, the worker discards YouVersion's header and writes its own `max-age`. The version list is stored for a fixed day (`CACHE_TTL_CATALOG_SECONDS` is `86400`).

What already reads with no connection stays that way. Bundled KJV and ASV, a finished HelloAO download, and a finished encrypted NASB download open from the device. `lookupChapter` calls YouVersion only for a streamed id. Opening one of those online chapters does not wait: `streamChapter` throws "The Bible service is busy right now. Try this chapter again in a minute." A download already waits out a busy response and continues, up to `MAX_BUSY_WAITS` (144), using `Retry-After` or 10 seconds when the header is missing.

## Goals

- A Bible already on the device opens with no connection. This work does not fetch it, does not show a waiting line, and does not replace the encrypted NASB file or the bundled text.
- A download's chapter request is the same passage route the proxy caches. A fresh stored chapter completes that part of the on-device copy without calling YouVersion. NASB uses the same lifetime as every other version.
- A successful YouVersion response is stored in the proxy's existing cache for the freshness lifetime that response allows, then dropped. The version list, the language list, book lists, and chapters follow that rule.
- The response the app receives is not cacheable by the browser. The on-device Bible remains the encrypted download, the HelloAO file, or the bundled text, not an HTTP cache entry.
- While the device is online and the chapter is not on the device, a busy response keeps the loading place up and changes the line from "Loading…" to "This chapter is taking a little longer. It will open on its own." The chapter keeps trying until it loads, the reader leaves, or the download's existing safety valve trips.
- With no connection, a chapter that is not on the device shows "You're offline. Your downloaded versions are still here." It does not say the chapter will open on its own.
- If the online wait gives up, the reader shows "This chapter didn't load. Try again in a little while."
- The other reader-facing Bible lines that name "the Bible service" or show a status code use this same voice. The sentences are listed below.
- A healthy online chapter request still returns as soon as YouVersion answers. Turning a page does not wait 18 seconds.

## Non-goals

- Opening NIV, NLT, or any version beyond the worker's current allowlist. Offline storage stays the explicit NASB list.
- Changing `MIN_INTERVAL_MS`, the licensed-download note, or pull request 110. That review stays on its own branch.
- A counter of requests remaining, a queue in front of the key, or any new store (no KV, no Durable Object).
- Conditional revalidation (`ETag`, `If-None-Match`, `304`). A revalidation still spends a request.
- A second on-device copy of a chapter that was only streamed, in the service worker, the browser HTTP cache, or a new store. Offline text stays the full Bible the publisher allowed.
- Changing the app's saved version list ("Showing the list saved on this device").
- One combined Bible list in the picker. That is a later piece.

## Anti-goals

- Keeping a response longer than YouVersion's header, including the catalog's fixed one-day lifetime.
- Storing a response marked `no-store`, `private`, or `no-cache`, or one that is already stale.
- Showing "Bible service", a status code, or "try again in a minute" for this wait.
- Stopping the chapter on the first busy response and making the reader tap to retry.
- Spacing every successful chapter turn by the download interval.
- Fetching a chapter the device already has, or telling an offline reader that a missing chapter will open on its own.

## Constraints

- The app key stays a Worker secret. It is not in the repo, the web bundle, or this document.
- The client lock stays: `X-Journeys-Client: journeys` and the existing origin check. A plain request still gets 403.
- The cache is the worker's existing cache (`caches.default` in production, the named cache in tests). Cache keys stay on the upstream path and the allowed query. Catalog keys keep the policy fingerprint and `Accept-Language` they already use, so a policy change cannot serve stale flags.
- RFC 7234 §5.2 is the rule for what may be stored and for how long. YouVersion asked for §5.2.2 specifically. The shared-cache rules in §5.2.1 apply because this cache serves every reader.
- Lockman: no server copy of NASB past the header. The same function handles every version, so NASB cannot drift longer than the others.
- Sean, 2026-11-13: the offline limit is publisher permission. A version Journeys is not allowed to keep stays online. This work does not save a streamed chapter onto the device.
- Reader copy matches the app: a short sentence that says what happened and what happens next, as in "You're offline. Your downloaded versions are still here."
- Shipping the implementation follows the repo's usual release: a patch bump in `package.json`, a matching `## [version]` section in `CHANGELOG.md`, and a learnings note. Those belong to the implementation commit, not to this design.
- The worker and the app can ship in either order. Until the worker stores chapters, an online wait still helps the person reading a chapter that is not on the device. Until the app waits, a stored chapter still saves the next download.

## Approaches

1. **The proxy honors `Cache-Control`; an online chapter that is not on the device uses the download's wait. Chosen.** One shared cache, so later downloads reuse a fresh chapter. Production stops substituting its own lifetime. A Bible already on the device never enters this path. The copy pass is in the same work.
2. **A cache on the phone for a streamed chapter's `Cache-Control` lifetime.** Rejected. It would not be the offline Bible the app is built around: it expires, it is not the encrypted NASB file, and a version without storage permission would sit on the device anyway. Other phones would still spend a request.
3. **A worker that counts the hour and queues callers.** Rejected. YouVersion does not say how much of the hour is left, and the app already treats a busy response as the signal.

## What the proxy stores

For each successful upstream GET the worker already makes (a Bible record, its books, a passage, a catalog page, a languages page):

- Read the upstream `Cache-Control` and `Expires` and `Age`. Do not use `CACHE_TTL_PASSAGE_SECONDS`, `CACHE_TTL_METADATA_SECONDS`, or `CACHE_TTL_CATALOG_SECONDS` as the lifetime. Those variables may stay in the Worker env so a deploy does not have to delete them, but the lifetime code ignores them.
- Do not store the response when any of these is true: `no-store`, `private`, `no-cache`, a freshness lifetime of zero, or no freshness lifetime at all (`max-age` and `s-maxage` absent, and `Expires` absent or already past).
- For a shared cache, `s-maxage` is the lifetime when it is present. Otherwise `max-age`. Otherwise the delta until `Expires`. Subtract `Age` when that header is present. A result of zero or less is not stored.
- If `Vary` lists a request header other than `Accept-Encoding`, do not store. The catalog key already accounts for `Accept-Language` and the policy fingerprint. Do not add a general `Vary` implementation.
- Store only a 200 response whose body the worker is already willing to return. A 204, a 429, a 5xx, and a rewritten error stay `no-store`, as they are today.
- The object in the worker cache carries `public` and a `max-age` of the remaining lifetime, so the cache expires on its own. The response returned to the app carries `Cache-Control: no-store` and the existing `X-Proxy-Cache` value (`HIT` or `MISS`). The app, the browser, and the service worker then do not keep the body.
- A hit is served only while that remaining lifetime says it is fresh. The worker does not serve a stale entry and it does not revalidate in the background.

The catalog body is still the sanitized page the worker builds today. Only the lifetime changes: it comes from the upstream headers of that fetch, not from a fixed day.

## What the reader does on a busy chapter

A translation that is bundled or already downloaded never calls `streamChapter`. No connection changes nothing about that read.

`streamChapter` and `streamChapterCounts` run only for a chapter that is not on the device. They wait on a 429 the way `getJson` does, and only while the device is online. With no connection they fail immediately with the offline sentence. They do not wait for a network that is not there.

- `Retry-After` is a number of seconds. When it is missing or not a number, wait 10 seconds, the download's existing default.
- Busy waits do not count as failures. The safety valve stays `MAX_BUSY_WAITS` (144). Past that, the call fails with the give-up sentence.
- Leaving the chapter, switching translation, or leaving the Bible screen aborts the wait. No request continues for a chapter the reader has left.
- The first attempt shows the existing "Loading…". The waiting sentence replaces it only after a busy response, in the same loading place, not as an alert. How the screen learns that the wait has started is the builder's choice (a callback or a small bit of state). The sentence does not show for a request that succeeds on the first try.
- The give-up sentence is the whole error text. The reader does not put "Could not load {chapter}: " in front of it.
- A 403 stays "This translation is not available to read in Journeys."
- Any other failed chapter status uses the give-up sentence, with no status code.
- A successful read does not pass through the download pacer and does not sleep for `MIN_INTERVAL_MS`.

## Sentences

These replace the current reader-facing strings. Nothing else in the Bible copy changes.

| Moment | Sentence |
| --- | --- |
| Device is offline and this chapter is not on it | You're offline. Your downloaded versions are still here. |
| Chapter is waiting after a busy response, device online | This chapter is taking a little longer. It will open on its own. |
| Chapter gave up, or failed for a reason other than 403 | This chapter didn't load. Try again in a little while. |
| Chapter is not available (403) | This translation is not available to read in Journeys. |
| Download gave up after a busy response | The download paused. Chapters already saved are on this device. Tap Download to continue. |
| Download failed for any other reason | The download didn't finish. Chapters already saved are on this device. Tap Download to continue. |
| Version list failed, including a busy response | Couldn't load the version list. Try again in a little while. |
| Language list failed | Couldn't load the language list. Try again in a little while. |

The licensed-download note is unchanged. Worker JSON that logs an upstream status can keep that status. The app does not display those worker sentences.

## Left to the builder

- The shape of the `Cache-Control` parser, as long as the store and skip rules above hold.
- Whether the waiting sentence reaches the screen through a callback or through state, as long as a first-try success still shows "Loading…" and a busy wait shows the waiting sentence until the chapter arrives or the wait ends.
- Which existing tests to extend. The worker catalog test that expects `public, max-age=86400`, and the unit tests that expect the old "Bible service" sentences, have to change with the behavior. Add coverage for: stored and served within `s-maxage` or `max-age`, skipped for `no-store`, `private`, `no-cache`, and a missing lifetime, `Age` shortening the life, the app response being `no-store`, a download chapter served from that cache, a chapter retry that then succeeds, abort when the reader leaves, the give-up sentence after the safety valve, an on-device Bible opening with no network and no proxy call, and the offline sentence when the chapter is not on the device.

## Calls made here

- The app is told `no-store` even when the worker cache holds the body. This keeps chapter text out of the phone's HTTP cache.
- The fixed TTL env vars are ignored rather than removed, so a worker deploy does not depend on deleting configuration.
- No conditional revalidation in this work.
- An unrecognized `Vary` means do not store.
- The chapter wait reuses the download's 10-second default and the 144-wait valve.
- Healthy chapter turns are not paced.
- The offline line reuses the picker's existing sentence. A missing chapter with no connection does not promise to open on its own.
