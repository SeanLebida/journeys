# Camera ease is not cut by padding or a false grab

## What changed

- `useMapViewportPadding` eases a settled snap with `padding` in the same `easeTo` (280 ms). It no longer `setPadding`s first. A live resize still `setPadding`s and does not ease. A snap during a leg, or while the camera is already moving, does not take the camera. The inset eases once the map is idle. The hook is a layout effect so the first `setPadding` happens before the journey's `easeTo`. A `setPadding` after that ease starts cancels it, and the map stays on the Mediterranean view.
- `useRouteAnimation` sets `isUserInteractingRef` only when the gesture event has `originalEvent`. Starting a leg calls `map.stop()` once when the user is not interacting, so the stationary 600/900 ms ease does not run beside the travel `jumpTo`.

## Why it mattered

Three camera owners overlapped on a leg. `setPadding` and `jumpTo` both call `stop()`, so an in-flight ease was cut and the map snapped. Programmatic ease and jump also fire `zoomstart` / `dragstart` without `originalEvent`, which set the interaction flag, skipped the travel `jumpTo`, then teleported when the flag cleared.

## Gotchas / pitfalls

- A snap during a leg must not be stored as if the padding was applied. The next idle snap still has to ease the inset the leg skipped.
- Do not ease a snap while `map.isMoving()` is true. That ease calls `stop()` and cuts off the arrival recenter. Wait for `moveend`, then ease.

- Do not pass a padding ease while a leg is in flight. The next frame's `jumpTo` cancels it.
- Do not `stop()` on the recenter effect's cleanup, and do not `stop()` while `isUserInteractingRef` is set. The travel loop stays on `jumpTo`. The 600/900 durations and the desktop 0.25 zoom dip are unchanged.
- Pinch and drag still pause the camera because those events carry `originalEvent`.

## Verification

- `npx vitest run src/map/useMapViewportPadding.test.tsx src/map/useRouteAnimation.test.tsx src/map/layers/trace.test.ts`: 18 passed.
