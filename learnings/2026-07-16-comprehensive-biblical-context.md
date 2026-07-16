# Comprehensive biblical context: OT foundation, archaeology, corroboration, video, wider world, and authentic.how design

## What changed
A multi-phase expansion turning the NT-only atlas into a whole-Bible one, plus
a brand alignment. Each phase is a separate commit.

- **Wider world basemap** — `scripts/clip-basemap.py` (new, committed,
  dependency-free: Sutherland–Hodgman polygon clip + Cohen–Sutherland line clip
  + Douglas–Peucker simplify) regenerates `src/map/basemap/{land,lakes,rivers,
  countries}.json` from Natural Earth 50m, clipped to a new `WORLD_BBOX`
  `[-12,22,50,48]` (Mesopotamia→Egypt). `graticule.ts` gains `WORLD_BBOX` (used
  by the graticule + the content geo-validator + the test); the opening camera
  keeps `MEDITERRANEAN_BBOX`.
- **Schema/pipeline** (`schema.ts`, `build-content.ts`, `useBundle.ts`) —
  `JourneyKind` += `patriarchal`,`exodus`; `Artifact.siteId`; new `Witness`
  (extra-biblical testimony) and `Video` (geo/timeline-anchored) entities, wired
  through validation (referential + citation closure + neutrality/review gates
  + YouTube-id format), the bundle, and new `BundleIndex` accessors
  (`artifactsForSite`, `witnessesForSite/Person`, `videosForSite/Journey`).
- **Content** authored by committed, idempotent generators:
  `gen-ot-content.py` (2 journeys, 17 stops, 10 OT sites, 7 persons),
  `gen-archaeology.py` (link 7 base finds + 10 new, incl. OT stelae),
  `gen-witnesses.py` (8 testimonia), and `content/videos.extra.json` (5
  validated BibleProject overviews). `scripts/fetch-artifact-images.mjs` pulls
  10 license-gated Commons photos; `scripts/check-videos.mjs` live-validates
  video ids via keyless oEmbed.
- **UI** — `SiteExtras.tsx` (ArtifactCard w/ photo, WitnessCard, click-to-load
  `VideoEmbed` via youtube-nocookie) surfaced on Atlas site detail, Trace active
  stop, and Lesson steps. Trace picker grouped by era; Atlas period slider
  widened to `-2100..100` with era shortcuts.
- **Design cohesion with authentic.how** — self-hosted Ubuntu (headings) +
  Open Sans (body) woff2 in `public/fonts` (`fonts.css`); `tokens.css` retuned
  to the brand's burnt-orange (`--terracotta`→#b35400, `--terracotta-ink`/
  `--link`→#8a4300). woff2 added to the workbox precache glob.

## Why it mattered
- User asked for comprehensive biblical interaction (patriarchs→apostles,
  archaeology, secular corroboration, timeline/geo video) with maps + imagery
  throughout, and for the app to match authentic.how's design.
- **Neutrality was the key design constraint.** The corroboration feature is
  framed as "extra-biblical corroboration of historicity", never "proof of a
  worldview": identified places get solid coordinate confidence while
  patriarchal *events* are `legendary` and Exodus route/date `disputed` with
  notes; the Testimonium Flavianum, Thallus, and Mara bar Serapion are
  `disputed` with interpolation/attribution caveats. This keeps faith with the
  app's existing cited-neutral ethos while serving the request.

## Gotchas / pitfalls
- **Douglas–Peucker degenerates on closed rings**: when a ring's first==last
  vertex the baseline is zero-length and every island collapses to 2 points
  (all Mediterranean islands vanished; only the bbox-opened continent
  survived). Fix: `_dp_ring` splits closed rings at the farthest vertex. A
  bbox-bounding-box "is it covered" check is *useless* for detecting this — a
  single continent polygon's bbox spans the whole region. Verify island
  survival by counting *small* polygons, not bbox coverage.
- Natural Earth 50m `land` is 1420 separate `Polygon` features (not one
  MultiPolygon) — clip per feature.
- BibleProject's own site embeds Mux, not YouTube, so scrape YouTube ids from
  search results and confirm via oEmbed (`author_name`+`title`), never guess.
- Open Sans v44 is a *variable* font: css2 serves one identical woff2 for every
  weight — dedup to one file with `font-weight: 400 700`.
- Widening `MEDITERRANEAN_BBOX` in place would also zoom the opening camera out
  to Mesopotamia; keep a separate `WORLD_BBOX` for extent vs. the camera.
- The Atlas site label's text is the *full* `ancientName` ("Jerusalem; the
  Second Temple…"), so match by prefix in tests, not equality.

## Verification
- `typecheck` · `lint` · 32 unit tests · `build:content` (68 sites, 8 journeys,
  17 artifacts, 8 witnesses, 5 videos) · `build` · 7/7 e2e — all green.
- `check-videos.mjs`: all 5 videos resolve as BibleProject.
- Browser drives (screenshots reviewed): widened world renders with islands +
  Nile/Tigris/Euphrates; Abraham/Exodus journeys trace across Mesopotamia→
  Sinai; Jerusalem shows 8 finds (7 photographed) + 2 witnesses; Trace picker
  groups into 4 eras; the Genesis video makes **0 YouTube requests before play,
  1 after** (privacy contract holds); Ubuntu/Open Sans load offline and the
  burnt-orange accent matches authentic.how.
