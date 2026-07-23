# Mobile journey trace — calmer pacing + sheet minimizes on continue

## What changed
- **`src/map/useRouteAnimation.ts`** — slowed the route-trace travel animation and
  gentled the camera so it is comprehensible rather than dizzying, with an extra
  discount on compact (mobile) viewports:
  - New `isCompactViewport()` helper (matches `(max-width: 1023px)`, the same
    breakpoint the bottom sheet uses).
  - Leg travel: replaced `min(4500, max(1200, 1200 + distKm*14))` with a base of
    `min(5200, max(1700, 1600 + distKm*18))` scaled ×1.7 on mobile / ×1.15 on
    desktop. Longer floor and cap so the eye can follow the traveller along the
    waypoints.
  - Mid-travel elevation dip `maxZoomDip` lowered from a flat `0.4` to `0.12`
    (mobile) / `0.25` (desktop) — a zoom pulse during a pan is the main source of
    disorientation on a small screen.
  - Co-located ("same place" event) pulse: 450 ms → 650 ms desktop / 900 ms
    mobile, amplitude 0.35 → 0.3 / 0.2.
  - Stationary auto-center `easeTo` duration 600 ms → 900 ms on mobile.
- **`src/components/useSheetDrag.ts`** — the sheet now listens for a
  `window` `sheet:minimize` event and, when it's an active sheet (mobile), settles
  to the `peek` snap. Decoupled from the journey store so the hook stays generic
  (Atlas/Quiz/Lesson also use it and are unaffected — only the trace controls
  dispatch the event).
- **`src/modes/map-trace/TraceMode.tsx`** — `TraceControls` Next/Prev now call a
  small `minimizeSheet()` that dispatches `sheet:minimize` before starting travel,
  so continuing the journey drops the description sheet to peek and the map +
  animation fill the screen.

## Why it mattered
On phones the bottom sheet (half snap) covers most of the map, so when the reader
tapped Next the journey animation played largely behind the sheet, and what was
visible whipped past too fast to read — "dizzying / disorienting." Minimizing the
sheet on continue puts the animation on screen, and the slower, flatter camera
lets the reader actually see the path traced between waypoints.

## Gotchas / pitfalls
- Kept `useSheetDrag` decoupled via a plain window `CustomEvent`/`Event` rather
  than importing the journey store — the hook is shared by all four modes, and
  only trace should trigger the minimize.
- The `sheet:minimize` listener is gated on `isSheet`, so dispatching on desktop
  (where Next/Prev also fire it) is a harmless no-op — no need to branch at the
  call site.
- Viewport is read per-animation (not once at mount) so rotating a device or
  resizing mid-session picks the right pacing on the next leg.

## Verification
```
npm run typecheck   # clean
npm run lint        # clean
npm test            # 61 passed (8 files)
```
Manual reasoning: compact path gives ~2.9 s floor / ~8.8 s cap travel with a
0.12-level zoom dip vs the previous 1.2 s / 4.5 s at 0.4; Next/Prev emit
`sheet:minimize` which collapses the sheet to peek only while a sheet is active.
