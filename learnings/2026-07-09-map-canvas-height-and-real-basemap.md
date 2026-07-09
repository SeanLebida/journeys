# Map canvas zero-height fix + real coastline/border basemap

## What changed
- `src/map/MapProvider.tsx` — MapLibre's `Map` constructor sets an inline
  `position: relative` on the container element it's given. That inline style
  overrode `.map-canvas`'s CSS `position: absolute; inset: 0`, and with no
  explicit height the container collapsed to `0px` tall — the map (graticule,
  routes, site dots, everything) was rendering into a zero-size canvas app-wide.
  Fix: MapLibre now gets its own plain, unstyled inner `div` nested inside the
  CSS-positioned `.map-canvas` wrapper (which keeps its `data-testid` and a11y
  attrs), so MapLibre's inline styling no longer fights the layout.
- `src/map/style.ts` — added real geography: `land-fill`, `coastline`, and
  `country-borders` layers (Natural Earth 50m land + admin-0 countries,
  clipped to `MEDITERRANEAN_BBOX`, simplified via `mapshaper`), under the
  existing graticule. Previously the base style was only a sea-color tint +
  coordinate grid with no actual land shapes — routes/site dots had nothing
  real to align against.
- `src/map/basemap/land.json`, `src/map/basemap/countries.json` — the clipped/
  simplified GeoJSON (public domain, Natural Earth), imported directly as JS
  modules (small: ~14 KB + ~27 KB) rather than fetched at runtime or built into
  a `.pmtiles` binary — no tippecanoe/tile-server step needed for this level
  of detail.
- `src/map/reference-cities.ts` + `MapProvider.tsx` — a handful of modern-day
  anchor labels (Rome, Athens, Istanbul, Jerusalem, Alexandria, Damascus,
  Cairo) rendered as `maplibregl.Marker` DOM elements, not a symbol layer —
  MapLibre symbol/text layers require a glyph (PBF font) source that this app
  doesn't ship yet, but `Marker` uses the browser's own font rendering so no
  glyph infra is needed for simple labels.
- `scripts/build-content.ts` — added Natural Earth to `ATTRIBUTIONS`.

## Why it mattered
- The zero-height bug was invisible in code review (CSS looked correct) and
  only showed up as "nothing renders" in the actual app — worth the explicit
  callout since MapLibre mutating the container's inline style is
  non-obvious and easy to reintroduce if a future refactor passes a styled
  div straight into `new maplibregl.Map({ container })` again.
- User feedback after the height fix: seeing only a graticule grid with no
  land/coastline/borders read as "not fully baked" — there was no reference
  layer to visually confirm routes and sites sit in the right real-world
  place. Natural Earth data (public domain, no API key, ~40 KB total) fixes
  this without breaking the app's offline/no-key principle.

## Gotchas / pitfalls
- Don't pass a CSS-styled element directly as a MapLibre `container` — it
  will get `position: relative` forced onto it inline. Always give MapLibre
  its own nested, unstyled div.
- `mapshaper` isn't a project dependency; used via `npx --yes mapshaper` as a
  one-off conversion tool (shapefile → clipped/simplified GeoJSON), not
  installed into `package.json`.
- Symbol/text layers need glyphs; `Marker` (DOM-based) sidesteps that for a
  small, static label set. Don't reach for a symbol layer here until a glyph
  source ships.

## Verification
- `npm run typecheck && npm test` green (28 unit tests).
- `npx playwright test tests/e2e/smoke.spec.ts` — 6/6 pass, incl. WebGL canvas
  mount and offline reload.
- `npm run build && npm run preview` — visually confirmed via Playwright
  screenshots (light + dark) that land/coastline/borders/reference labels
  render on Home and Atlas, and that the map canvas now measures the full
  container size (was `0px` tall, now matches viewport).
