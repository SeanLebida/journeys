# Atlas site name labels

## What changed
- `src/map/layers/atlas.ts` — extracted `computeSiteSpans` (shared by
  `atlasSitesFC`) and added `atlasSiteLabels(bundle)`, a plain-array version
  of the same per-site data for DOM markers.
- `src/modes/sandbox/AtlasMode.tsx` — every visible site dot now gets a
  clickable name label next to it (`maplibregl.Marker`, since no glyph/font
  source is shipped for a symbol layer). The label list is filtered by the
  exact same year/confidence logic as the circle layer, so labels never show
  for a dot that's currently hidden. Clicking a label selects the site, same
  as clicking its dot.
- `src/styles/global.css` — `.site-label`.

## Why it mattered
- Dots alone (color-coded by confidence only) gave no way to know which site
  was which without clicking every one. Direct ask: "each dot should have a
  name or location."

## Gotchas / pitfalls
- No collision/decluttering — at full zoom-out with 57 sites the labels
  overlap and read as noise; this clears up once the user zooms in (normal
  map behavior, not fixed here). A proper fix would need a real symbol layer
  with `text-allow-overlap: false`, which needs a glyph source — out of scope
  until that ships.

## Verification
- `npm run typecheck && npm test` (28 tests) green.
- `npx playwright test tests/e2e/` (6 tests) green.
- Playwright screenshot: 57 `.site-label` elements present on Atlas with all
  confidence filters on (58 sites minus any without a stop-derived span
  falling outside the default AD 70 cutoff).
