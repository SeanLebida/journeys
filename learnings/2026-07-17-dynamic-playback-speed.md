# Dynamic playback speed for route animation

## What changed
`src/map/useRouteAnimation.ts` — replaced the single linear playback `duration`
with a per-leg dynamic timeline:
- New `timeline` memo computes a time budget per leg = `2500 + 1800*log10(1+distKm)`,
  clamped to `[2500, 9000]` ms. Floor keeps short hops perceptible; log curve
  keeps long hauls from dragging.
- rAF `tick` now advances `progress` in path-length space at a per-leg speed
  (`span/dur`) warped by an ease-in/out velocity `velScale = 0.3 + 0.7*(6x(1-x))`
  (derivative of smoothstep, mean 1, floor 0.3) so the traveler visibly settles
  into and departs each stop.
- Camera follow lerp made adaptive: `min(0.14, 0.04 + progressDelta*90)` so the
  camera keeps pace on compressed long legs instead of lagging off-screen.
- `playbackSpeed` store value now multiplies the dynamic base (global speed slider
  still works).

## Why it mattered
`progress` is normalized *path-length* [0,1]; advancing it linearly = constant
real-world km/s, so short legs flashed by (unreadable) and long legs crawled. User
wanted short and long distances both comprehensible.

## Gotchas / pitfalls
- Speed was almost double-applied: `dur` divided by `playbackSpeed` AND the delta
  multiplied by it. Apply `playbackSpeed` once (on the delta), keep `dur` raw.
- Guard zero-length legs (duplicate stop coords): `span<=0` jump straight to the
  next stop fraction, else `span/dur` is NaN.
- Everything stays in normalized path-length space, so `lineProgress`, `updateTrace`,
  and `activeStopFromFractions` need no changes.
- Resume-safe: leg + local fraction are derived from `progress` each frame (no
  elapsed-time ref to reconcile on pause/resume).

## Trace UI responsiveness (same session)
Driven the app in-browser and fixed what showed up:
- `getTargetZoomForLeg` intercept `13.5→14.5`, cap `11→14` — short legs (<~10 km)
  were saturating the old 11 cap so never zoomed closer. MapLibre re-clamps to the
  active layer's real `maxZoom`, so no placeholder-tile risk.
- `.trace-stop-label` (`src/styles/global.css`) had `white-space:nowrap` + no
  `max-width`, anchored `left` — long ancient names ran off the right edge and
  across the fixed controls. Now: capped width + ellipsis for reached labels;
  active label gets more room and a 2-line `-webkit-line-clamp`. Full name still
  lives in the left "Stops Reached" list.
- The label display is set inline in JS (`TraceMode.tsx` `useStopLabels`), which
  overrode the CSS `display` — set the inline value to match intent
  (`-webkit-box` for active so the clamp applies, else `inline-block`/`none`).
- Fixed control bar was `width:auto` on desktop, so the `flex:1 1 auto` scrub
  slider (no basis) collapsed to its thumb and the count jammed the edge. Gave the
  bar `width: min(600px, calc(100% - 420px - 6rem))` and the scrub `min-width:140px`.
- Bumped control-bar backdrop opacity `90%→97%` so a label passing behind reads clean.

## Gotchas / pitfalls (UI)
- MapLibre `Marker` inline `el.style.display` beats any stylesheet `display` rule —
  if CSS needs a specific display mode (line-clamp needs `-webkit-box`), set it from
  the JS that owns the inline style, not just in CSS.
- A `flex:1 1 auto` child with no width basis shrinks to min-content when its
  container is `width:auto`; give the container a real width or the child a
  `min-width`, else it collapses.

## Verification
`npx tsc --noEmit` → No errors found. Driven in-browser (Ministry of Jesus journey):
confirmed slow ease-in/out at stops + fast long legs, tight zoom on the ~2 km Galilee
lakeshore hops, labels contained (no edge run-off / control-bar overlap), and the
scrub slider + count laid out cleanly across the full-width bar.
