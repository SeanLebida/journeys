# Mobile trace UI — two phases: travelling and arrived

## What changed
Trace mode on mobile is now a state machine with two deliberate layouts instead
of one static one. `data-phase` on `.journey-trace-layout` is the switch, derived
from `targetStopIdx !== null`.

**Travelling (cinematic).** Tab dock stows, sheet drops to `peek`, layer widget
fades, an edge vignette comes up, MapLibre's zoom control slides clear, and a
`TravelStrip` HUD appears at the top: `From → To`, a leg-progress meter, leg mode
+ counter, and Skip. The sheet body fades so `peek` shows only handle + heading
rather than a clipped sliver of the stop just departed.

**Arrived (reading).** Sheet rises to `full`, and the panel is stop-first: the
title is the *stop*, the journey name becomes an eyebrow/backlink. The body is
that one stop's detail. Previous stops moved into a `Journey so far` disclosure
and journey chrome (summary, chronology, route geometry, videos) into
`About this journey`.

- **New `src/state/useSheetStore.ts`** — snap request/publish channel so a mode
  can drive the sheet without prop-drilling. `request: {snap, seq}`; the seq
  token is what `useSheetDrag` keys on, so a repeat request still moves a sheet
  the reader dragged in the meantime.
- **`src/components/useSheetDrag.ts`** — obeys requests, mirrors resting snap back.
- **`src/modes/ModePanel.tsx`** — new optional `eyebrow` and `footer` slots.
  `footer` is outside the scrolling body, so the primary action never scrolls away.
- **`src/modes/map-trace/TraceMode.tsx`** — `ActiveStopPanel` (accumulating
  timeline) replaced by `StopReader` + `JourneySoFar` + `TravelStrip` +
  `StopActions` (pip rail, Prev, `Continue to <next stop>`, Restart).
- **`src/App.tsx` / `TabBar.tsx`** — dock stows via `data-dock` on `.app-shell`.
- Desktop is unchanged: it keeps the floating playback pill and hides the mobile
  transport entirely.

## Why it mattered
The sheet defaulted to `half` and never moved, so the animated journey — the
whole point of trace mode — played out in the top half of the screen while the
bottom half showed a stop list. And the active stop's detail sat *below* every
stop already reached, so arriving at stop 7 meant scrolling past six cards to
read where you'd just landed. Now the phase you're in decides what the screen
is for.

## Gotchas / pitfalls
- **The tab bar had to stop being a flex row.** Collapsing a flex child's height
  reflows `.app-main`, which resizes the MapLibre container (`trackResize` is on
  by default) — mid-camera-animation. Making the dock a `position: absolute`
  overlay means stowing it is a pure transform: no reflow, no resize churn. The
  map is now always full-shell, and `--dock-h` is what every bottom-anchored
  overlay offsets by (sheet, pills, page cards). `--dock-h: 0px` when stowed.
- `.app-shell` gained `position: relative`, which re-parents `.map-surface`'s
  `inset: 0`. Same geometry, but the map now paints behind the dock — intended.
- **Source order beats intent with equal specificity.** The
  `@media (min-width: 1024px) { .stop-actions { display: none } }` rule was
  written *before* `.stop-actions { display: grid }`, so desktop showed the
  mobile transport anyway. Desktop overrides have to come after the definitions.
- `.tabbar__theme` set `font-size: inherit`, which resolved to the nav's 1rem and,
  being later in the sheet, beat `.tabbar__item`'s clamp — the theme toggle
  rendered a size larger than every tab beside it. Fixed by deleting the
  declaration and adding `font: inherit` to `.tabbar__item` (a `<button>` does not
  inherit font-family from an ancestor).
- Pinning `.tabbar` to a fixed height (needed so `--dock-h` matches) clips the
  labels if the number is too tight — 44px tap target + padding needs a 48px
  content box, not 44px.
- `text-transform: capitalize` on the whole strip footer turned the counter into
  "2 Of 6"; scope it to the leg-mode span only.
- `.map-floating-layers` is `position: fixed; z-index: 100`, so at the `full`
  snap it floated over the *text*. Retired at that snap, same as the pill.
- Co-located stops share a path fraction — guard the leg-progress divide by zero.
- `eslint-disable-next-line react-hooks/exhaustive-deps` is an **error** in this
  repo: the rule isn't registered, so the directive itself fails lint. Use a ref
  to keep the dep array honest instead.

## Verification
`tsc --noEmit` clean, `eslint` clean, `vitest run` 63/63.
Playwright: 7/7 excluding `layers.spec.ts`, which fails identically with these
changes stashed — pre-existing, from the uncommitted LayerPanel label work
(`'Country borders & names'` vs. the spec's `'Country borders'`).
Driven in Chromium at 390×844 and 1400×900 across Home / Trace / Atlas / Lessons /
Quiz: sheet bottom lands exactly on the dock top in every mode, no horizontal
overflow, desktop sidebar + pill unchanged.
Built and installed on-device (`adb`, 1080×2280, dark theme): walked
picker → stop 1 → Continue → travelling → arrival at stop 2. Dock stows and
returns, strip meter animates, pips advance, CTA retargets.
