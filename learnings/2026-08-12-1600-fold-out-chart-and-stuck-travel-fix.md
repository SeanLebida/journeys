# Fold-out chart effect for the timeline; fixing travel that could never arrive

Follows `2026-08-12-prophets-timeline-and-bible-reader.md`.

## What changed

**`src/map/useRouteAnimation.ts` — travel no longer dead-ends.** The leg-travel effect bailed out with
`if (!map || !ready) return;` *before* it had a way to complete the transition. `targetStopIdx` stayed
set forever, so the status badge froze on "🚶 Travelling to …" and Prev/Next stayed disabled — a
dead end with no way out but a reload. It now lands the reader at the destination stop
(`setProgress` / `setCurrentStopIdx` / `setTargetStopIdx(null)`) when there is no map to fly with.
They lose the animation, not the journey.

**`tests/e2e/journey_motion.spec.ts` — repaired.** It wrote screenshots to
`/home/vic/.gemini/antigravity-cli/brain/<uuid>/scratch/` and could only ever pass on one machine;
artifacts now go through `testInfo.attach`. It also asserted the transport was enabled after a fixed
1 s wait, racing an animation that legitimately takes longer — it now waits on the app's own arrival
signal (the transport re-enabling, and the status badge's "(n of N)").

**Fold-out chart effect** — `src/components/timeline/useFoldOut.ts` (new), plus the `.tl-lane`
3-D rules in `global.css`, a `timelineFold` preference in `useUiStore`, and an opt-out in the
timeline's new "Presentation" fieldset. Era bands already scrolled sideways like a fold-out chart;
now they *look* like one, with each lane a panel that hinges away as it passes an edge.

## Why it mattered

The travel bug is the interesting one. It only shows up when the map never fires `load` — WebGL
unavailable, a style that fails, or (as here) a sandbox with no network for the basemap. In all three
the *content* is fine and fully readable; only the fly-over is impossible. Coupling stop navigation to
the map's readiness meant a cosmetic dependency could brick the primary reading flow. Arrival is the
app's job; the fly-over is the map's.

For the fold, the requirement was explicitly "looks like a folded map, but the animation must not
interfere with accessibility". Four properties do that work, and they are design constraints rather
than mitigations:

1. **Only panels crossing an edge fold.** `--fold` is 0 for any lane fully inside the band, so it gets
   no transform at all. Whatever the reader is looking at is square and pixel-crisp; the effect lives
   entirely on content already half out of view.
2. **The paper texture is painted behind the bars** (`z-index: 0` on the crease/shading pseudo-elements
   against `1` on the lane heading and track). The effect cannot cost text a single point of contrast.
3. **Nothing moves at rest.** The angle is a pure function of scroll position — no transition, no
   idle animation, no autoplay. It stops the instant scrolling does.
4. **Two independent off switches.** `prefers-reduced-motion: reduce` disables it, and a persisted
   toggle disables it for a reader who has not changed an OS setting. The static crease texture stays
   in both cases: that is the *look*, and it costs nothing.

Keyboard use is safe by construction — focusing a bar in a folded panel scrolls it into view, which by
definition returns its fold to 0 — and `scroll-margin-inline` keeps that landing clear of the sticky
year rail.

## Gotchas / pitfalls

- **Never measure with `getBoundingClientRect` in a scroll-driven transform loop.** A rect reflects
  the rotation the function is about to set, so frame N's output becomes frame N+1's input and the
  panels oscillate. `useFoldOut` sums `offsetLeft` through the offset chain instead: layout geometry
  is immune to transforms, so the input stays the honest pre-fold layout.
- **`offsetLeft` is relative to the nearest *positioned* ancestor, not the scroll container.** The
  first version measured against `.mode-panel--page` and folded the wrong lanes at rest.
  `.tl-era__body` is now `position: relative` and the helper walks the chain up to it.
- **A flat lane computes `matrix(1, 0, 0, 1, 0, 0)`, not `none`.** `rotateY(calc(0 * 16deg))` still
  resolves to a transform. Tests assert flatness against both.
- **The sticky year rail is offset down by one lane heading, which left the top-left strip
  uncovered** — a panel scrolling under the rail showed its heading through the gap. `.tl-axis::before`
  is the masthead that closes it.
- **Watch what a CSS insertion swallows.** Splitting the `.tl-axis` rule to add that pseudo-element
  left `height: var(--band-h)` and `border-right` inside `::before`; the rail lost its height and every
  tick collapsed to the top. Caught on screen, not by any test — worth re-reading a whole rule after
  editing into the middle of one.
- **`perspective` belongs on the lane row, not the band.** On the band it would drag the sticky year
  rail into the 3-D scene and skew the one thing that must stay flat.
- **The lane-alignment e2e test had to move to layout offsets.** It compared painted rects, which the
  fold legitimately changes; the invariant it protects is a *layout* one.

## Verification

```bash
npm run typecheck       # clean
npm run lint            # clean
npm test                # 11 files, 95 tests
npm run build           # production build clean
npx playwright test     # 15 passed — including journey_motion, red before this change
```

Three new e2e tests cover the fold: panels in view stay flat while edge panels hinge, the opt-out
squares everything back up, and a `reducedMotion: 'reduce'` context gets no transforms while the chart
itself stays fully usable.

Checked on screen at 1280×900 and 390×844, at rest and mid-scroll, with the per-lane `--fold` values
read back from the DOM to confirm the ramp (0 in view, ±1 fully off-edge).
