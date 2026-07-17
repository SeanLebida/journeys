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

## Verification
`npx tsc --noEmit` → No errors found.
