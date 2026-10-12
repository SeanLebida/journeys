# Lakes/rivers basemap layers + shared, persisted, cross-mode layer toggle panel

## What changed
- `src/map/basemap/lakes.json` (17 features, ~8 KB), `src/map/basemap/rivers.json`
  (49 features, ~24 KB) — new Natural Earth 10m `lakes`/`rivers_lake_centerlines`
  data (public domain), same family as the existing `land.json`/`countries.json`.
  Sourced from the `nvkelso/natural-earth-vector` GeoJSON mirror (avoids a
  shapefile→GeoJSON conversion step), then clipped to `MEDITERRANEAN_BBOX`,
  filtered to `scalerank <= 6`, and simplified 15% via `npx --yes mapshaper`
  (mirrors the M1 land/countries recipe — mapshaper is still not a project
  dependency, used as a one-off conversion tool).
- `src/map/style.ts` — `lakes-fill`/`rivers-line` layers (tone-aware `WATER`
  color), and a new `BASEMAP_LAYERS` export (`{ land, lakes, rivers, coastline,
  borders, graticule }`) naming every independently-toggleable basemap layer.
- `src/state/useMapLayersStore.ts` — new zustand + `persist` store (pattern:
  `useUiStore.ts`), one boolean per `BASEMAP_LAYERS` key (default `true`) plus
  `labelsAlwaysOn` (default `false`).
- `src/map/MapProvider.tsx` — one new `useEffect` subscribed to the store applies
  `setLayerVisible` (the existing generic helper from `layers/atlas.ts`, despite
  living in the atlas module) for every `BASEMAP_LAYERS` entry, and
  `applyLabelVisibility` now ORs `labelsAlwaysOn` with the existing
  `LABEL_ZOOM_THRESHOLD` zoom gate.
- `src/map/LayerPanel.tsx` — new shared checkbox panel wired straight to the
  store; mounted in all four modes (`AtlasMode`, `TraceMode`, `LessonMode`,
  `QuizMode`), not just Atlas.
- `scripts/build-content.ts` — `NaturalEarth` attribution now also credits
  lakes/rivers.

## Why it mattered
- The map shipped zero water (land/coastline/borders/graticule only); user ask
  was "as much detail... as possible" plus a way to choose which layers show.
  Rivers/lakes were the piece of that with a defensible offline, public-domain,
  no-citation-needed source (unlike Roman roads or ancient/sea-level-shifted
  coastlines, which are historical-accuracy claims this app treats as citable
  content, not mechanical basemap data — deliberately deferred, not silently
  dropped).
- Layer toggles existed in exactly one place (Atlas's local `atlas-toggles`
  fieldset) and were lost on navigation — `useState`, not shared or persisted.
  The map itself is a single app-wide persistent instance
  (`src/map/MapProvider.tsx`), so a basemap toggle is inherently cross-mode
  state; moving it into a zustand store persisted via the existing
  `platformStorage` adapter (already used by `useUiStore`/`useDownloadStore`/
  `useQuizStore`) was the natural fit, not a new pattern.
- Centralizing the store→map sync in `MapProvider` (the one place that already
  owns `mapRef`/`ready`) means none of the four mode components talk to
  `mapRef` for basemap toggles — they only read/write the store. Avoids
  duplicating map-effect wiring four times.

## Gotchas / pitfalls
- `LayerSpecification.paint` in `@types/maplibre-gl` is a big discriminated
  union; indexing a specific paint property (e.g. `'fill-color'`) on a layer
  pulled from `style.layers.find(...)` doesn't narrow automatically — TS7053.
  Cast the found layer to a small local shape (`{ paint?: Record<string,
  unknown> }`) in tests rather than fighting the union.
- The git worktree this feature was built in (`worktrees/
  worktree-map-layers`) had no local `node_modules` — `npm run typecheck`/
  `test`/`lint`/`build` all silently succeeded anyway (Node's module resolution
  walks up to the parent repo's `node_modules`), but `scripts/build-content.ts`
  (needed to produce `dist-content/` for Playwright's `npm run preview`) failed
  with an ENOENT on `sql.js/dist/sql-wasm.wasm` because that script builds an
  absolute path assuming a local `node_modules`. Fix: `npm install` inside the
  worktree itself before running content-build or e2e — don't assume a nested
  worktree inherits a working `node_modules` just because typecheck/build pass.
- Natural Earth's `scalerank` is 0 = most important; filtering `<= 6` (not e.g.
  `>= 6`) is what keeps major lakes/rivers and drops minor ones. Confirmed via
  a `python3 -c` scalerank histogram on the raw download before clipping —
  worth doing before picking a threshold rather than guessing.

## Verification
- `npm run typecheck && npm test` (31 tests, incl. new `style.test.ts`) and
  `npm run lint` all green.
- `npm run build` succeeds; new water layers add ~32 KB of GeoJSON to the app
  bundle (in line with existing `land.json`/`countries.json` sizes).
- `npx playwright test tests/e2e/` — new `layers.spec.ts` toggles "Country
  borders" off in Atlas, navigates to `/trace/journey-paul-1` and confirms the
  same checkbox is still unchecked there (proves the shared-store wiring, not
  per-mode local state), then reloads and confirms it's still unchecked
  (proves `platformStorage` persistence).
