# Drive Thru History attribution + archaeology harvest

## What changed
- **Fixed video attribution** in `content/videos.extra.json`:
  - 7 Drive Thru History videos had `channel: "Drive Thru History"`; the real YouTube author name is `Drive Thru History with Dave Stotts`. Corrected.
  - `video-dth-sea-of-galilee` was **misattributed** — its `videoId` `AscvltdB1T4` is "The Holy Land, by Zahi Shaked", not DTH. Replaced with the real DTH "Galilee Boat" video `3N-Xcyst9po` (verified via YouTube oEmbed).
- **Attributed Drive Thru History as a source**: added 83 `cit-dth-*` citations (kind `secondary-scholarly`, licensed "© Drive Thru History — referenced with attribution") and attached them to 30 sites + 11 artifacts (67 site links, 13 artifact links).
- **Two new artifacts** DTH documents that the bundle lacked, grounded in DTH article text:
  - `artifact-jesus-boat` (site-sea-of-galilee) — the 1986 Galilee Boat, Yigal Allon Museum.
  - `artifact-babylonian-chronicle` (site-jerusalem) — Nebuchadnezzar Chronicle ABC 5 (597 BC capture of Jerusalem, BM 21946).
  - Both got freely-licensed Wikimedia images via `scripts/fetch-artifact-images.mjs` (added to its `SOURCES` map).

- **Added 14 more DTH videos** (`content/videos.extra.json`, 13→27) mapped to existing ministry sites — Bethlehem (birthplace, shepherds), Nazareth (Annunciation), the Jordan baptism, Sea of Galilee overview, Caesarea Philippi (Peter's confession), the Jerusalem Temple, Gethsemane, Golgotha location, the Caiaphas trial, Bethany (Lazarus), Jericho, Zacchaeus, and Jacob's Well. Every id/channel/title verified against YouTube oEmbed. All sit on existing sites with coordinates already on the ministry route, so no new sites/coords/routes were needed.

## Why it mattered
The app embeds DTH videos and mirrors DTH's biblical-geography subject matter but cited them **zero** times. This adds the required attribution and links the content owner's articles across the map, plus fills two well-documented archaeological gaps.

## Gotchas / pitfalls
- DTH's WordPress REST API blocks `wp/v2/posts` and `posts/{id}` (Solid Security 401). Only `wp/v2/search` is open — use it (with a browser User-Agent) to enumerate the ~320-post index; scrape article **HTML pages** (curl + browser UA; WebFetch gets 403) for body text and embedded YouTube IDs.
- Most DTH *archaeology* articles are text-only; the videos live on their YouTube channel, not embedded. DTH *Gospel* articles, however, embed their matching video — scrape the article HTML for `youtube.com/embed/<id>` and oEmbed-verify. Pauline-site articles (Ephesus/Athens/Corinth/…) embed none.
- `content/citations.extra.json` uses **1-space** JSON indent; every other content JSON uses 2-space. A blind `json.dump(indent=2)` reformats the whole citations file — reserialize it with `indent=1` to keep diffs additive.
- `scripts/fetch-artifact-images.mjs` rewrites `artifactImages.json` from its `SOURCES` map only; entries not in `SOURCES` are dropped. Keep the map in sync with the artifact set.
- Not all site records live in `sites.json` — `site-patmos` is in `sites.extra.json`. Patch both.

## Verification
- `npm run build:content` → content valid; artifacts 19, citations 315.
- `node scripts/check-videos.mjs` → 13 videos, 0 problems (all channels match YouTube oEmbed).
- `node scripts/fetch-artifact-images.mjs` → 12/12 artifacts have licensed images.
