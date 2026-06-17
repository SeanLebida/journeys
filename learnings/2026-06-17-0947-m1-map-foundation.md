# M1 — MapLibre foundation + a11y baseline

Milestone M1 of the approved plan. Builds the single persistent, offline,
no-API-key map the four modes share.

## What changed
- `src/map/MapProvider.tsx` — rewritten from the M0 stub to instantiate ONE
  `maplibregl.Map` into a ref on mount and `remove()` it on unmount. Registers
  the `pmtiles://` protocol once at module load (drop-in for the future vector
  basemap). Disables rotation/pitch, adds Navigation + Attribution controls,
  honors `prefers-reduced-motion` (`fadeDuration: 0`, non-animated fitBounds),
  fits the Mediterranean bbox, exposes `{ mapRef, ready }` via context. The map
  canvas is `role="img"` with a label; places remain reachable as text in the
  mode panels (the non-visual alternative).
- `src/map/style.ts` — `buildBaseStyle(basemap, dark)` returns a self-contained
  style8 (tinted background + graticule line layer), light/dark aware. No glyphs
  yet (no label layers), so it needs zero network. Documents where the AWMC/CAWM
  raster and Protomaps PMTiles sources slot in.
- `src/map/graticule.ts` (+ test) — `generateGraticule()` computes meridian/
  parallel GeoJSON; `MEDITERRANEAN_BBOX` is exported and reused as the M2 geo-
  sanity bbox.
- `vite.config.ts` — `manualChunks` splits MapLibre+pmtiles into a cached vendor
  chunk; `chunkSizeWarningLimit: 900`.

## Why it mattered
- One map instance in a layout route = the WebGL context survives mode switches
  (recreating it per route leaks contexts and is slow). This is the backbone M3
  (route animation) and M4 (layer toggles) build on.
- Shipping a real but fully-offline style now proves the no-key/offline
  constraint before the heavy tile-asset work, and keeps the dev loop fast.

## Gotchas / pitfalls
- Vitest `toBe` uses `Object.is`, so a meridian at lon -10 (`-10 % 10 === -0`)
  fails `toBe(0)`. Assert `(deg % step === 0)` instead (`-0 === 0` is true).
- MapLibre can't render under jsdom (no WebGL); unit tests must not mount
  `MapProvider`. Real map rendering is verified via `npm run dev` / Playwright (M7).
- `@types/geojson` resolves transitively through `maplibre-gl`; no direct dep needed.

## Verification
- `npm run typecheck && npm run lint && npm test && npm run build` all green
  (15 tests). Build emits a separate `maplibre-*.js` (~823 kB) chunk; app chunk
  ~280 kB. Map renders live via `npm run dev` (background + graticule, pan/zoom,
  attribution); reduced-motion path disables fades.
