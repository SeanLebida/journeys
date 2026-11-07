# Offline map keeps the journey path without a signal

Spec: `docs/superpowers/specs/2026-11-06-offline-map-design.md`. Plan: `docs/superpowers/plans/2026-11-06-offline-map.md`.

## What changed

- `public/images/map/hillshade.png` is a Natural Earth 50m shaded-relief crop of `WORLD_BBOX` (−12, 22, 50, 48). `scripts/clip-hillshade.ts` (`npm run map:hillshade`) builds it. The sea is transparent. Land keeps the grayscale relief. The PNG is committed. The script is not part of `npm run build`.
- `buildBaseStyle` draws topography from that image (`type: 'image'`, `resolveAssetUrl(ASSET_PATHS.hillshade)`). Esri World Shaded Relief is gone. Satellite, streets, and the Roman map stay optional online layers, default off, labeled “(online)”. Topography sits under Geography & Features. The topography maxZoom cap of 13 is gone.
- The web service worker precaches the literal path `images/map/hillshade.png`. It does not precache a general png glob. Site photos stay on the runtime cache.
- `attachJourneyTrace` writes the path, stop dots, and traveller when the style is loaded. `attachJourneyTraceWhenReady` retries on `styledata`. `useRouteAnimation` no longer calls `map.once('load')` and no longer removes the trace when the stop index changes. A travel frame, including the same-place pulse, calls `jumpTo` only after `attachJourneyTrace` returns true. If there is no map, the reader still lands on the stop.

## Why it mattered

On a journey with no data connection the parchment map kept moving and the path, stop dots, and current-location dot did not appear. The path geometry is already in the bundled journey content. The layer effect waited for `load`, which fires once when the style is created and does not fire again on a map that is already open. The travel loop still moved the camera. The default terrain was an Esri tile URL, so the shaded relief also disappeared offline. The bundled image replaces that default. Satellite, streets, and the Roman map still step aside when their tiles cannot load.

## Gotchas / pitfalls

- Do not subscribe to `once('load')` to attach a journey trace. Use `styledata`. `attachJourneyTraceWhenReady` takes a getter and reads it when the event fires, so a replaced args object still draws the current stop.
- Do not call `removeTraceLayers` from an effect that depends on `currentStopIdx`. The path is memoized without that index. Remove the layers when the coordinates change or the hook unmounts.
- `updateTraceProgress` does nothing when the progress source is missing, so a camera move can happen with an empty overlay. Move the camera only when `trace-progress-line` is already on the map, or when `attachJourneyTrace` just placed it.
- `map.isStyleLoaded()` is false while any source has tiles in flight and while a GeoJSON `setData` is on the worker. Do not use it as the per-frame camera gate, and do not `setData` the full route on every animation frame. Layers can be added once `style._loaded` is true. The stationary recenter waits for that same placement, then eases.
- The sea mask is a scanline even-odd fill of `src/map/basemap/land.json`, not a per-pixel ray cast. Land sample: Jerusalem 35.23°E, 31.78°N (alpha > 0). Sea sample: 33.0°E, 34.0°N (alpha 0).
- Precache the one relief file by name. A `*.png` glob would pull site photos into the install precache.
- Do not call `setStyle()`. Do not use `Capacitor.convertFileSrc` for the relief file. The phone reads it from the package. The service worker is web only.
- `npm run map:hillshade` needs the network. A type cast on the fetch body is there so `tsc` accepts the Node web stream.
- `npx vitest run` still fails the six `src/release/ReleaseNotices.test.tsx` cases (`localStorage` / `sessionStorage` undefined). That was the baseline before this work.

## Verification

- `npm run build && npx playwright test tests/e2e/offline_journey.spec.ts tests/e2e/zoom_safe_area.spec.ts` → PASS (2). `dist/images/map/hillshade.png` exists and `dist/sw.js` names `images/map/hillshade.png`.
- `npx vitest run src/map/useRouteAnimation.test.tsx src/map/layers/trace.test.ts src/map/style.test.ts` → 14 passed. `npx tsc --noEmit` → no errors.
- `npx vitest run` → 184 passed, 6 failed, all six in `ReleaseNotices.test.tsx`. Baseline before these tests was 170 passed, 6 failed, same file.
- Review fix: `places the trace when the style can take layers while sources are still loading`, `does not ease to the stop when the trace cannot be placed`, and `follows an attached trace without rewriting the whole route each frame` failed before the gate change and passed after. `npx tsc --noEmit` reports no errors.
