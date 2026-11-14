# Trace Skip leaves the camera on the stop the text shows

## What changed

- `useRouteAnimation` leg-effect cleanups (co-located pulse and distance loop), after `cancelAnimationFrame`, `jumpTo` the stop when Skip has already cleared `targetStopIdx` and set `currentStopIdx` to that leg's `toIdx`, the map exists, the user is not interacting, and the stop coordinate exists.
- TravelStrip Skip, the stationary `easeTo`, and `useMapViewportPadding` are unchanged.

## Why it mattered

Skip cancels the leg `jumpTo`. The reader text follows `currentStopIdx`, so it is already on the destination, but the only camera writer for the leg was the cancelled loop. The stationary effect then `easeTo`s the stop. Portrait arrival raises the sheet, `ResizeObserver` calls `useMapViewportPadding` `apply(false)`, and `map.setPadding` is MapLibre `jumpTo` → `stop()`, which aborts that ease at the mid-leg center. The later padding ease uses `map.getCenter()`, not the stop, so the map stays mid-leg. Landing with `jumpTo` in the cleanup puts the camera on the stop before that padding `stop()`.

## Gotchas / pitfalls

- Do not `jumpTo` when `isUserInteractingRef` is set, when `targetStopIdx` is still set, or when `currentStopIdx` is not this leg's `toIdx`. A scrub off this leg, initial mount, `openAtStop`, and a stationary scrub that never started the leg must not snap.
- Do not call `map.stop()` from the stationary effect, do not gate this on `isStyleLoaded`, and do not rewrite the full route. `setPadding` already calls `stop()`; another `stop()` is what cuts the arrival.

## Verification

- Before the production change, `npx vitest run src/map/useRouteAnimation.test.tsx -t "skip lands"` failed: `skip lands the camera on the stop the text already shows` expected `jumpTo` with center `[36, 33]` and got 0 calls.
- After the change, `npx vitest run src/map/useRouteAnimation.test.tsx src/map/useMapViewportPadding.test.tsx` passed.
