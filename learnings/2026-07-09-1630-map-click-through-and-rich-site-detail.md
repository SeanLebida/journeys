# Map was never clickable (pointer-events) + rich per-site detail + lesson map pins

## What changed
- `src/styles/global.css` — `.app-main` gets `pointer-events: none`, `.mode-panel`
  gets `pointer-events: auto`. Root-cause fix: `.app-main` (a plain
  `position: relative` div, later in DOM than `.map-surface`, both at
  `z-index: auto`) hit-tested across its **entire box** even where it painted
  nothing — a plain positioned element always wins hit-testing over an
  earlier same-level sibling for the full rectangle it occupies, not just
  where its own content exists. Every pointer event over "blank" map (i.e.
  anywhere not covered by a floating `.mode-panel` card) was being swallowed
  by `.app-main` instead of reaching the MapLibre canvas underneath.
- `src/modes/sandbox/AtlasMode.tsx` — site click panel now also renders every
  `Stop` at that site (via new `bundle.stopsForSite`): per-visit journey +
  date, `eventSummary`, `scriptureRefs` (`ScripturePassage`), `persons`,
  `artifacts` (with `DisputeNote`), `terms`, and stop-level citations/disputes.
  Previously the panel only showed site-level fields (name/summary/citations)
  even though the compiled bundle already carried much richer, cited,
  stop-level content that was simply never read.
- `src/content/useBundle.ts` — added `stopsForSite(siteId)` alongside the
  existing `stopsFor(journeyId)`.
- `src/modes/lesson/LessonMode.tsx` — each lesson step's site now gets a
  numbered, clickable `maplibregl.Marker` on the persistent map (current step
  highlighted); clicking one jumps `i` to that step. Lessons previously only
  moved the camera on step change with no visual/interactive location cue.
- `src/styles/global.css` — `.lesson-step-marker` / `--active` styling.

## Why it mattered
- This was **the** blocker for the day's actual ask ("click a dot on the map
  for more info"): the click handler in `AtlasMode` was always correctly
  wired (`map.on('click', ATLAS_LAYERS.sites, ...)`), but no click ever
  reached the map to fire it. Confirmed by directly calling `map.getCenter()`
  before/after a drag gesture — completely unchanged. This also silently
  broke the quiz's `map-pin` question kind (`MapPinQuestion` in
  `QuizMode.tsx`), which requires clicking anywhere on the map to place a
  pin — that whole quiz mechanic has never worked since it was built.
- Confirmed against real MapLibre CSS: `.maplibregl-ctrl-top-right` ships
  `z-index: 2`, which is *why* the zoom +/− control worked while nothing
  else did — an explicit z-index promotes an element to its own stacking
  context that competes above `.app-main` (auto); everything without an
  explicit z-index (canvas, site-dot layer, `maplibregl.Marker` elements) had
  no such escape hatch.
- The Atlas panel enrichment surfaces content (`persons`, `artifacts`,
  `terms`, per-visit `eventSummary`/`scriptureRefs`/`disputes`) that was
  already authored and validated by `build-content.ts` but invisible in the
  app — the "not fully baked" feedback was partly this gap, not missing data.

## Gotchas / pitfalls
- A `position: relative`/`absolute` element with `z-index: auto` still
  hit-tests across its **full geometric box**, even at pixels where it paints
  nothing — this is easy to miss in review because the bug is invisible
  visually (nothing looks wrong) and only shows up as "clicks don't do
  anything." Diagnose with `document.elementFromPoint(x, y)` in a real
  browser/Playwright, not by reading CSS.
- Don't chase this by adding z-index to individual map children (markers,
  canvas) — fix it once at the overlay-wrapper level
  (`pointer-events: none` + re-enable on the one interactive descendant).
  That also fixes every current and future map-click feature (quiz map-pin,
  lesson markers) in one place instead of one-off patches per mode.
- `bundle.stopsForSite` can return >1 stop for a site visited on multiple
  journeys (e.g. `site-antioch`, `site-jerusalem`) — the Atlas panel renders
  one `<section class="stop-visit">` per visit, not one per site.

## Verification
- Direct map-API test (bypassing DOM click flakiness): `map.getCenter()`
  unchanged after a drag gesture before the fix, changed after.
- `document.elementFromPoint` grid-scanned across the viewport before/after:
  every "blank" point returned `.app-main` before, `CANVAS.maplibregl-canvas`
  after.
- Playwright: clicked a real site-dot pixel (via `map.project()` on a
  queried feature) — `.stop-panel` and `.stop-visit` both appear post-fix
  (were absent pre-fix even when the exact feature pixel was targeted).
- Clicked a non-active `.lesson-step-marker` — step index advances
  ("Step 1 / 3" → "Step 2 / 3").
- `npm run typecheck && npm test` (28 tests) and
  `npx playwright test tests/e2e/` (6 tests, incl. WebGL canvas + offline
  reload) all green after the change.
