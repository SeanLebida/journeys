# Responsive production pass — mobile bottom sheet

## What changed
Reworked the mode panel from a binary layout (mobile overlay card / desktop
420px sidebar, one breakpoint at 1024) into a proper responsive system where the
map is the hero on small screens.

- **New `src/components/useSheetDrag.ts`** — draggable bottom-sheet hook. Below
  1024px the mode panel anchors to the bottom of the map area (`.app-main` /
  the trace/lesson layout) with three snap points (peek 14% / half 50% / full
  92%). Pointer drag, tap-to-cycle, and arrow-key resize. Publishes the live
  height as `--sheet-h` and the current snap as `data-sheet-snap` on the measured
  offset-parent so siblings can react. Inert at ≥1024 (clears inline height/var).
- **`src/modes/ModePanel.tsx`** — renders a grab handle + wires the hook; sets
  `data-snap` for styling. Used by Trace / Atlas / Quiz / Lesson.
- **`src/styles/global.css`** — mobile `.mode-panel` is now a bottom sheet
  (rounded top, handle, clipped body that scrolls); desktop override resets it to
  the floating sidebar card. Playback pill (`.trace-controls-fixed` /
  `.lesson-progress-fixed`) rides `bottom: calc(var(--sheet-h) + 0.6rem)` and
  fades out at the full snap. Added `.mode-panel--page` (mobile-only) so Home and
  Credits — content screens, not map screens — stay normal scrolling cards.
- **Home / Credits** got the `mode-panel--page` class.
- Fixed a horizontal-overflow bug: `.atlas-toggles` is a `<fieldset>`
  (defaults to `min-width: min-content`) which forced a sideways scrollbar in the
  sheet — added `min-width:0; max-width:100%` and `overflow-x:hidden` on the
  sheet body.

## Why it mattered
On phones the description card covered the map, so the whole point — watching the
animated journey — was hidden. The sheet lets the reader trade map for text with
a drag, keeping the animation visible. This is also the native iOS/Android pattern
(Capacitor build), and the same web build embeds in WordPress.

## Gotchas / pitfalls
- A React `Marker`/element's inline `style.display` (or `height`) beats any
  stylesheet rule — the hook owns the inline height, so CSS only provides the
  pre-JS fallback.
- The sheet's measurement area is the panel's `offsetParent`, which differs by
  mode: `.journey-trace-layout` / `.lesson-player-layout` (they're
  `position:absolute`) for trace/lesson, `.app-main` for the others. Publishing
  `--sheet-h` / `data-sheet-snap` on that element keeps the pill selectors working
  in both cases.
- `<fieldset>` defaults to `min-width:min-content` — a classic source of
  horizontal overflow inside a constrained container.
- Home/Credits render their own `.mode-panel` div (not the `ModePanel`
  component), so they had no handle and became a stuck 50%-height sheet until
  opted out with `--page`.
- Suppress the height CSS transition during drag (`.is-dragging`) or the sheet
  lags the finger.

## Verification
`npx tsc --noEmit` clean. Driven in Chrome at 400px and 1300px across Home /
Trace / Atlas / Quiz: three snaps + drag + tap-cycle work, pill rides/fades,
no horizontal overflow, desktop sidebar unchanged. `vitest run`: 35 pass; the one
failure (`stop-ministry-patmos-john-29 → site-patmos`, content-integrity) is a
pre-existing content-data issue in the uncommitted `content/*.json`, unrelated to
this UI work.

## Follow-up pass (same day) — completed
- **Content bug fixed**: `stop-ministry-patmos-john-29` referenced a missing
  `site-patmos`; added the site to `content/sites.json` (Patmos, Greece, 37.3086 /
  26.5476, cites `cit-patmos`) and reran `npm run build:content` (74 sites). Full
  suite now 36/36.
- **Tab bar label**: added `nav.traceShort` ("Trace") used only by the tab bar
  (the full "Trace a journey" stays in backlinks); labels are single-line with
  ellipsis + 44px tap targets + fluid font.
- **Tablet reading width**: `.mode-panel__body` caps to 44rem centered between
  640–1023px so sheet text isn't over-wide.
- **Production build verified**: `npm run build` green — `dist/` + PWA service
  worker. This is the one artifact for web/WordPress-iframe and the Capacitor wrap.

## Still open (deploy-time, needs native toolchains)
- `npx cap add ios` / `android` to generate the platform folders, then build in
  Xcode / Android Studio on a machine with those SDKs.
- The WordPress page/shortcode that iframes the hosted PWA.
