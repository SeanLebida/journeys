# Traveller judder and mobile sheet clipping

## What changed

**Traveller dot no longer judders during a leg** (`src/map/layers/trace.ts`,
`src/map/useRouteAnimation.ts`, `src/styles/global.css`)

- The traveller is now a `maplibregl.Marker` (`.trace-traveler`), not the
  `trace-traveler-circle` GeoJSON layer.
- `updateTrace` split into `updateTraceStatic` (route outline + stop dots — only
  written when the journey or the reached count changes) and
  `updateTraceProgress` (drawn-so-far line + traveller — the only per-frame work).
- The travel rAF loop now writes the trace geometry itself, in the same frame as
  and immediately before its `map.jumpTo`. The React effect that mirrored
  `progress` onto the map bails out while `targetStopIdx !== null`.
- `setProgress` is throttled to one store write per 80ms during a leg (the store
  drives the sheet's progress bar, not the map); the exact target fraction is
  still written once on arrival.
- Leg zoom dip is 0 on compact viewports (was 0.12), so a phone gets a pure pan.

**Mobile sheet spans the viewport again** (`src/styles/global.css`)

- Dropped `width: calc(100% - 1rem)` from the `@media (max-width: 560px)`
  `.mode-panel` rule.
- `min-width: 0` on `.stop-actions` and `.stop-actions__row`.
- At ≤560px the sheet keeps a top-only radius; `.mode-panel--page` re-declares an
  all-round one. `.mode-panel__footer` gets flat `1rem` inline margin/padding to
  match the panel's own padding at that breakpoint.

**Home/Credits card top is reachable** (`src/styles/global.css`)

- `.mode-panel--page` adds `inset: auto`.

## Why it mattered

The dot judder was not an easing problem — it was a synchronisation one.
`GeoJSONSource.setData` is parsed on MapLibre's worker thread, and the old code
reached it the long way round: rAF → `setProgress` → zustand → React render →
effect → `setData` → worker → paint. The `map.jumpTo` in the same rAF tick landed
immediately. So the camera was always a variable number of frames ahead of the
dot it was centred on, and because the dot sits at the centre of the screen that
lag is visible as pure jitter. A `Marker` is repositioned synchronously inside the
map's own render pass, so it cannot drift from the camera at all. Measured on a
Note 10+: ±0.5px from canvas centre across 400 frames, p99 frame interval 16.9ms.

The 560px `width: calc(100% - 1rem)` predates the bottom-sheet layout — it was
sized for a floating card. Against `left: 0; right: 0` it produced a 16px strip
of bare map down the right side and clipped whatever sat at the right of the
sheet's content. Separately, `.stop-actions__go` is `white-space: nowrap`, and
without `min-width: 0` on its grid/flex ancestors a long "Continue to <place>"
label grew the transport row to 450px inside a 363px box and pushed the restart
button off the edge.

`.mode-panel` sets `bottom: var(--dock-h)` for the absolutely positioned sheet.
`.mode-panel--page` switches to `position: relative` but never reset the offsets,
so that `bottom` became a *relative* shift and dragged the whole card up by the
dock height (measured: `top: -48.8px`). The heading sat above the top of the
viewport with no scroll that could reach it.

## Gotchas / pitfalls

- Anything that must stay glued to a moving camera has to be written in the same
  frame as the camera move. Routing it through React state guarantees it will not
  be. This applies to the progress line too — it is still `setData`, but it is now
  at least issued from the rAF tick rather than a render pass later.
- `position: relative` does not clear the `top/right/bottom/left` an absolute rule
  set — it reinterprets them as offsets. Reset with `inset: auto` when flipping a
  component between the two.
- `min-width: 0` on the flex *item* is not enough when its ancestors are
  themselves grid/flex items: the automatic minimum size has to be zeroed at every
  level between the shrinkable item and the box that bounds it.
- `travelerMarker` in `layers/trace.ts` is module-level singleton state. Fine for
  one map and one journey at a time, which is the app's shape; it is torn down in
  `removeTraceLayers`, before the `hasLiveStyle` guard so it still runs on an
  already-removed map.

## Verification

- `tsc --noEmit` clean; `vitest run` 59 passed / 0 failed.
- Live-probed the running debug build on a networked SM-N975U over the WebView
  devtools socket (`adb forward` + CDP `Runtime.evaluate`):
  - traveller offset from canvas centre across a full leg: max 0.5px x, 0px y.
  - frame intervals over 299 frames: p50 16.7ms, p90 16.8ms, p99 16.9ms, 2 frames
    over 33ms.
  - `.mode-panel` 0 → 411.4 in a 411.4 viewport (was 0 → 395.4).
  - `.stop-actions__row` 16 → 395.4, all three buttons inside (was 16 → 466.3).
  - Home card top now at a positive offset; "Journeys" heading visible.
- Screenshots before/after for home, the full-snap sheet, and mid-travel.
