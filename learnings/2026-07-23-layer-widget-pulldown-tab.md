# Map layer widget becomes a top-edge pull-down tab

## What changed

`src/map/LayerPanel.tsx`, `src/styles/global.css`

- The floating layer widget moves from `top: 4.5rem; right: 0.8rem` at a fixed
  320px wide to a tab pinned flush to the top edge (`top: var(--safe-top)`),
  horizontally centred.
- Closed, the container is `width: max-content` — a closed `<details>` does not
  render its content, so the tab is only as wide as its own summary (measured
  243.6 × 42.4 in a 411px viewport, was 320 wide and parked over the map).
- Open, `.map-floating-layers:has(.atlas-toggles-expandable[open])` pins the
  width to `min(340px, 100vw - 1.6rem)` so the checkbox rows do not reflow to
  whatever the longest label happens to be.
- Added a CSS-only chevron (`.atlas-toggles__chevron`) that points down when
  closed and up when open, wrapped with the badge in a new
  `.atlas-toggles__summary-right`.
- The expandable is a flex column with `max-height: calc(100dvh - var(--safe-top)
  - var(--dock-h) - 1rem)` and a scrolling content pane, so a long layer list can
  never run under the dock.

## Why it mattered

The widget was the size of a panel but behaved like a button — a 320px slab
sitting a third of the way into the map, permanently, whether or not anyone
wanted it. What it needed to communicate when closed is only "there is more
here", which is a tab's job, not a panel's.

Top-centre rather than top-right is deliberate: MapLibre's zoom control is
`.maplibregl-ctrl-top-right` at *every* breakpoint, and the old desktop rule
(`top: 1.2rem; right: 1.2rem`, z-index 100) sat straight on top of it.

## Gotchas / pitfalls

- The tab styling is scoped under `.map-floating-layers`. Only TraceMode wraps
  `<LayerPanel />` in that container; Atlas, Quiz and Lesson render it inline in
  the sheet, where it must stay a full-width card with all four corners. Anything
  added to `.atlas-toggles-*` unscoped lands in both places — the chevron is
  intentionally one of those, the geometry is not.
- `.lesson-player-layout[data-sheet-snap='full'] .map-floating-layers` in the
  mobile block is dead: LessonMode renders the panel inside `ModePanel`, not in a
  `.map-floating-layers` wrapper. Left alone, but do not trust it as evidence the
  lesson layout floats the widget.
- `width: max-content` only collapses to the summary because `<details>` drops
  its content from layout when closed. If the content is ever made
  visibility-hidden instead of unrendered, the tab silently goes full width again.

## Verification

- `tsc --noEmit` clean, `vitest run` 59 passed.
- Probed on the networked SM-N975U over the WebView devtools socket: closed tab
  243.6 × 42.4 at `top: 0`, centred (83.9px clear each side of a 411px viewport);
  open 340 × 600.5, inside the 711px height cap.
- Atlas mode's inline copy unchanged: `left: 16`, `width: 379.4`, `border-radius:
  12px` on all corners, not inside `.map-floating-layers`.
- Screenshots of the closed tab, the open drop-down, and Atlas mode.
