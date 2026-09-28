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

---

# Follow-up: the height cap cropped instead of scrolling

## What changed

`src/styles/global.css`

- `.map-floating-layers .atlas-toggles-expandable::details-content` is now the
  flex pass-through: `display: flex; flex-direction: column; min-height: 0;
  overflow: hidden`.
- The content pane gains `overscroll-behavior: contain`, `scrollbar-width: thin`,
  `scrollbar-gutter: stable` and `scroll-padding-block: 2.5rem 0.5rem`.
- Category headings are `position: sticky; top: 0` inside the scroll pane, with
  their spacing converted from margin to padding so the background actually
  covers the rows passing under them.

## Why it mattered

The cap added above clamped the `<details>` box correctly — measured 310.6px in
a 387px-tall landscape viewport — but the pane inside it never shrank
(`scrollHeight === clientHeight`, `contentBottom: 599.7` against a panel ending
at 310.6). The overflow was simply clipped by the base rule's `overflow: hidden`,
so on any viewport shorter than the full layer list the options below the fold
were unreachable: no scroll, no indication they existed.

The cause is that **Chrome and Safari do not make a `<details>`'s non-summary
children direct flex items** — they are slotted through the `::details-content`
pseudo-element, which is the box flex layout actually sees. `flex: 1 1 auto;
min-height: 0` on `.atlas-toggles__content` was being applied to a grandchild of
the flex container, where it means nothing.

Scrolling rather than shrinking is the accessible choice here: the alternative
(letting the pane compress) trades reachable content for smaller hit targets and
text, which fails WCAG 2.5.5 and 1.4.4 at the sizes involved. Vertical scrolling
inside a region satisfies 1.4.10 Reflow, and every row is a focusable checkbox so
the region is keyboard-reachable without an added tab stop.

## Gotchas / pitfalls

- `::details-content` is Chrome 131+ / Safari 18.4+. Engines without it slot the
  content as a direct flex child, where the `flex`/`min-height` already on
  `.atlas-toggles__content` does the same job — so keeping *both* declarations
  covers both layouts and avoids hardcoding a summary height into a `calc()`.
- A sticky heading needs its spacing as padding, not margin: margin is
  transparent, so scrolled rows show through the gap under the pinned text.
- `overscroll-behavior: contain` matters more than usual here — without it,
  flicking past the end of the layer list starts panning the map underneath.

## Verification

- Emulated 740 × 360 via CDP `Emulation.setDeviceMetricsOverride`: panel clamps
  to 283.2px (= 360 − 60.8 dock − 16), pane `scrollHeight` 573 vs `clientHeight`
  240, `maxScroll` 333. Last checkbox `bottom: 594.3` (outside) before scrolling,
  `top: 245 / bottom: 261` (inside the 283.2 panel) after.
- Real landscape on the SM-N975U (788 × 387): `maxScroll` 305, last option
  reachable, sticky heading opaque mid-scroll.
- `tsc --noEmit` clean, `vitest run` 59 passed.
