# Long legs zoom out first, then travel slower

## What changed

- `legTravelMs` replaces the 5.2s cap (`1600 + distKm * 18`). Time is `1600 + distKm * 36`, capped at 11s before the compact (×1.7) or desktop (×1.15) multiplier.
- `legTravelZoom` eases a pinch-in back out to the leg's target zoom over the first 1800ms. A zoom-in toward the arrival stop still runs across the whole leg. The desktop 0.25 dip is skipped when the camera is zooming out, or when the zoom change is a full level or more.

## Why it mattered

Starting Next after a close zoom lerped that zoom across the entire leg. On a long leg the camera stayed tight while the traveller crossed the route in about six seconds, the same cap as a medium leg, so the path was too fast to follow.

## Gotchas / pitfalls

- Do not put the zoom-out on the position smoothstep. That spreads it across the whole leg again.
- The 1800ms window is `ZOOM_OUT_MS` in `useRouteAnimation.ts`. A shorter leg still uses the full duration because the span is clamped to 1.
- Co-located stops keep their own pulse. This note does not change them.

## Verification

- `npx vitest run src/map/useRouteAnimation.test.tsx`: 10 passed.
- Dev server, Paul's voyage to Rome, zoomed in six steps, then Next. At 2.2s the coast had opened out to a regional view (Lebanon labelled) while the leg was still travelling.
