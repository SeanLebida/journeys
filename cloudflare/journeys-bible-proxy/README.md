# journeys-bible-proxy

Cloudflare Worker that proxies the [YouVersion Platform API](https://developers.youversion.com/quick-reference) for the Journeys app so the YouVersion app key never ships in the client.

This package lives at `cloudflare/journeys-bible-proxy` in [SeanLebida/journeys](https://github.com/SeanLebida/journeys). Staging is `https://bible-staging.authentic.how` (`journeys-bible-proxy-staging`). Production is `https://bible.authentic.how` (`journeys-bible-proxy`).

## YouVersion API (verified)

- Base URL: `https://api.youversion.com/v1`
- Auth: every upstream request sends `X-YVP-App-Key` ([Authentication](https://developers.youversion.com/authentication), [Quick Reference](https://developers.youversion.com/quick-reference), [API Usage](https://developers.youversion.com/api-usage), [Bibles reference](https://developers.youversion.com/api/bibles))
- Confirmed with Sean's app key (value never stored in this repo):

| YouVersion id | Abbreviation | Title | Publisher |
| --- | --- | --- | --- |
| `100` | NASB1995 | New American Standard Bible 1995 | The Lockman Foundation |
| `2692` | NASB2020 | New American Standard Bible 2020 | The Lockman Foundation |
| `111` (blocked) | NIV / NIV11 | New International Version 2011 | Biblica, Inc. |

Text comes from `GET /v1/bibles/{id}/passages/{passage}` (USFM ids such as `JHN.3.16` or `JHN.3`). The books collection returns metadata only, including chapter and verse ids the app can use to walk a download. There is no official “download the whole Bible in one call.”

## Request shape for the app

Call this Worker the same way you would call YouVersion, under `/v1/...`. Do **not** send `X-YVP-App-Key`. The Worker injects the secret and strips any client-supplied copy.

Production host: `https://bible.authentic.how`. Staging: `https://bible-staging.authentic.how`.

CORS allowlist: `https://localhost`, `capacitor://localhost`, `https://journeys.authentic.how`. Capacitor Android’s `http://localhost` is **not** included; say if that origin is needed.

When `REQUIRE_APP_CLIENT=true`, every `/v1/bibles/*` request (GET and the download POST) must send both of these, or the Worker returns 403:

```
Origin: https://localhost
X-Journeys-Client: journeys
```

`Origin` must be one of the CORS allowlist values (`https://localhost`, `capacitor://localhost`, or `https://journeys.authentic.how`). OPTIONS preflight and `/admin/stats` are unchanged. Both staging and production set `REQUIRE_APP_CLIENT=true`.

### List / identify a licensed version

```
GET /v1/bibles/100
GET /v1/bibles/2692
```

Passes through the YouVersion Bible resource (id, abbreviation, title, copyright, book ids, and so on).

### Catalog: every version the app key can see

```
GET /v1/bibles?language_ranges[]=en&page_size=99
GET /v1/bibles?language_ranges[]=*&page_token=<next_page_token>
GET /v1/languages?page_size=99            (Accept-Language picks localized_name)
```

`/v1/bibles` lists the Bibles the app key's accepted YouVersion licenses cover (the proxy never sends `all_available=true`). Query: `language_ranges[]` (or `language_ranges=en,es`; tags or `*`, at most 5; YouVersion returns the first range that has Bibles), `page_size` 1-99 (default 99), `page_token`. Each item is trimmed to `id, abbreviation, localized_abbreviation, title, localized_title, language_tag, publisher_name, publisher_url, copyright, info, book_count, has_old_testament, has_new_testament, youversion_deep_link`, plus two Journeys flags:

- `readable`: this proxy serves the version's books and passages (read online, chapter by chapter).
- `offline`: Journeys has permission to keep a copy on the device (download + Lockman-style count).

`/v1/languages` forces `bibles_available=true` and returns `id, language, script, localized_name, text_direction, default_bible_id`.

Both lists are metadata only and are edge-cached for `CACHE_TTL_CATALOG_SECONDS` (default 86400). The cache key includes the policy below, so changing the vars never serves stale flags. Upstream errors are never cached; a 429 keeps its `Retry-After`.

### Policy vars

| Var | Meaning |
| --- | --- |
| `ALLOWED_BIBLE_IDS` | Versions the proxy reads. A comma list, or `*` for every version the key is licensed for (YouVersion enforces the license). |
| `BLOCKED_BIBLE_IDS` | Never served or listed, even under `*`. |
| `OFFLINE_BIBLE_IDS` | Versions the app may store; must also be readable. `POST /downloads` is 403 for anything else. Defaults to `100,2692`. |

Staging and production keep `ALLOWED_BIBLE_IDS=100,2692` until Sean approves reading more versions; the catalog still lists every version the key can see.

### Book and chapter map for a download

```
GET /v1/bibles/100/books
GET /v1/bibles/100/books?canon=old_testament
```

Allowed query: `canon=old_testament|new_testament|deuterocanon`. Each book includes `chapters[].passage_id` values such as `GEN.1`. Deeper routes (`/books/GEN`, chapters, verses) are not proxied; use those `passage_id`s with the passages endpoint.

### Download passage text

```
GET /v1/bibles/100/passages/JHN.3.16
GET /v1/bibles/100/passages/JHN.3?format=text
GET /v1/bibles/2692/passages/GEN.1?format=html&include_headings=true&include_notes=true
```

Allowed query: `format=text|html`, `include_headings=true|false`, `include_notes=true|false`. Upstream returns `{ "id", "content", "reference" }`. Headings and notes are only present when `format=html`.

A successful GET may be served from the edge cache (`X-Proxy-Cache: HIT|MISS`) when the TTL vars are greater than 0. Caching does not increment download counts. Both environments currently set the TTLs to `0` until Sean confirms the Lockman/YouVersion license allows caching.

### Download-complete signal (required for Lockman counts)

After the app has finished storing one version on device, send **exactly one**:

```
POST /v1/bibles/100/downloads
X-Journeys-Download: complete
X-Journeys-Client: journeys
```

The body may be empty. A `200` looks like:

```json
{
  "ok": true,
  "version_id": 100,
  "abbreviation": "NASB1995",
  "year": 2026,
  "month": 11,
  "month_count": 1,
  "year_total": 1
}
```

One successful POST counts as one completed download for that version in the current **UTC** calendar month. Year totals are the sum of those months (the February Lockman report should use `/admin/stats?year=YYYY`). The Worker does not dedupe by user or device; the app must send this once per finished download, not once per chapter.

### Errors the app should handle

| Status | When |
| --- | --- |
| 400 | Download POST missing `X-Journeys-Download: complete`, or admin `year` missing/invalid |
| 401 | Admin stats without a valid token |
| 403 | A version outside `ALLOWED_BIBLE_IDS` (or in `BLOCKED_BIBLE_IDS`), a download POST for a version not in `OFFLINE_BIBLE_IDS`, a path that is not proxied, or (when `REQUIRE_APP_CLIENT` is true) a request missing the journeys client header or an allowed Origin |
| 404 | Unknown path |
| 429 | Per-IP rate limit; honor `Retry-After` |
| 502 | YouVersion upstream failure |

## Admin stats

```
GET /admin/stats?year=2026
Authorization: Bearer <ADMIN_TOKEN>
```

`X-Admin-Token: <ADMIN_TOKEN>` is also accepted. Response includes each allowlisted version’s `year_total` and per-month counts (`"1"`…`"12"`).

## Rate limit

180 requests per 60 seconds per client (Durable Object, SQLite, strict across locations). The limiter names its Durable Object by a keyed HMAC-SHA256 of the client IP (`RATE_LIMIT_SALT`), not the raw address, and an alarm deletes the stored window when it expires. That is enough for a short burst of chapter fetches but a full 1,189-chapter walk takes several minutes; the app should back off on 429. This uses a free-tier Durable Object rather than the Workers Rate Limiting binding (that binding is backed by WAF rate-limiting infrastructure; treat it as potentially billable and leave it off).

## Storage

Download counters live in a SQLite Durable Object (`DownloadStats`, one instance named `downloads`) so they last well beyond Workers Logs retention. Increments are atomic (`INSERT … ON CONFLICT DO UPDATE`). Rate-limit windows use a second SQLite DO class, one instance per IP.

## Caching and license

YouVersion’s public docs say to [cache responses when possible](https://developers.youversion.com/quick-reference). Edge cache TTLs (`CACHE_TTL_METADATA_SECONDS`, `CACHE_TTL_PASSAGE_SECONDS`) are set to `0` on staging and production until Sean confirms the Lockman/YouVersion license allows caching. The license text lives in the YouVersion portal, not in the public docs. If it does, metadata can be cached for 7 days and passages for 1 day.

## Secrets and deploy

```sh
cp .dev.vars.example .dev.vars   # local only; gitignored
# printf '%s' "$YOUVERSION_APP_KEY" | wrangler secret put YOUVERSION_APP_KEY --env staging
# printf '%s' "$ADMIN_TOKEN" | wrangler secret put ADMIN_TOKEN --env staging
# wrangler deploy --env staging
# wrangler deploy
```

Do not commit `.dev.vars`. Do not print the app key or admin tokens. Use separate `ADMIN_TOKEN` values for staging and production.

Hostnames (Workers custom domains in `wrangler.jsonc`):

- Production: `bible.authentic.how`
- Staging: `bible-staging.authentic.how`

## Free-tier notes

SQLite Durable Objects and the Cache API are available on Workers Free, subject to [Durable Objects free limits](https://developers.cloudflare.com/durable-objects/platform/pricing/) and Workers request/CPU caps. Workers Logs / traces are enabled for observability; volume above the free log allotment can be billable. D1 was not used. The Rate Limiting binding was not used.

## Scripts

```sh
npm test
npm run lint
npx wrangler@4.156.0 deploy --dry-run
npx wrangler@4.156.0 deploy --dry-run --env staging
```
