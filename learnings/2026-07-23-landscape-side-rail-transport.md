# Trace navigation redesign: landscape side rail, one-row transport

## What changed

- **`src/components/useSheetDrag.ts`** — the bottom sheet is now portrait-only.
  The activation query went from `(max-width: 1023px)` to
  `(max-width: 1023px) and (orientation: portrait)`. In landscape the hook writes
  no inline height, no `--sheet-h`, and no `data-sheet-snap`, so CSS owns the
  panel geometry there.
- **`src/styles/global.css`** — new
  `@media (max-width: 1023px) and (orientation: landscape)` block docks
  `.mode-panel:not(.mode-panel--page)` as a full-height left rail
  (`--rail-w: min(54vw, 360px)`), hides the drag handle, tightens body leading to
  1.6, and re-centers the travel strip / layer tab / lesson pill in the map that
  is *left* of the rail. Landscape also flattens the travel HUD to a single row
  (meter becomes the strip's bottom edge) and the tab dock to a 38px row of
  glyph-beside-label tabs.
- **`src/modes/map-trace/TraceMode.tsx`** — `StopActions` lost its 32px pip rail;
  progress is now a segmented hairline that *is* the footer's top edge
  (`.stop-actions__meter`), so the transport is one 44px row. `JourneySoFar`
  lists **all** stops (past / current / upcoming, upcoming dashed + muted)
  instead of only the reached ones, which is where arbitrary-stop jumping went.
- **`src/modes/ModePanel.tsx`** — new optional `scrollKey`; when it changes the
  body scrolls back to the top. Trace passes the active stop id.

## Why it mattered

On a landscape phone the map area is ~360px tall. The sheet at `half` was 180px
of that, and the footer transport (pip rail 32 + row 44 + padding) ate ~95px of
the 180 — three lines of the stop's text survived. The chrome that exists to move
between stops was crowding out the stops themselves. Landscape has width to
spare, so the panel now takes the left edge at full height and the transport
costs one row instead of two.

## Gotchas / pitfalls

- **Source order decides, not intent.** Three overrides silently lost because
  their base rules appear *later* in `global.css` at equal specificity:
  `.map-floating-layers` (line ~1676) and `.tabbar` / `.tabbar__item` (~1966).
  Both needed their own landscape blocks placed after those definitions. The
  landscape `.tabbar` height and `--dock-h` in the side-rail block must stay in
  lockstep — a mismatch parked the Continue button underneath the dock, because
  the rail's `bottom` is positioned off the variable while the dock paints its
  own height.
- `.mode-panel--page` (Home, Credits) must be excluded from the rail rules —
  those are centered reading cards with no map behind them, and a bare
  `.mode-panel` landscape rule wins over `.mode-panel--page` on source order.
- `data-phase='travelling'` hides `.mode-panel__body` and `.mode-panel__footer`
  on mobile because the *sheet* drops to `peek` under them. The rail doesn't
  move, so landscape has to undo both or it blanks a column that is still up.
- Removing the pips is only neutral because the stop list gained the upcoming
  stops. Pips were the sole way to jump *forward*; "Journey so far" stopped at
  the current stop.
- Long `dateRange.display` values ("boyhood pre-ministry; rejection episode
  early-mid ministry c. AD 28-30") wrapped list rows to three lines — the date
  line needed the same one-line ellipsis the name already had.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` — clean, 59 unit tests pass.
- Playwright screenshots against `vite dev` at 844×390 (landscape) and 390×844
  (portrait), DPR 2, mobile emulation: arrived, "All stops" open, mid-leg
  travelling, and post-arrival. Confirmed the rail clears the dock, the travel
  HUD centers in the remaining map, the footer is one row in both orientations,
  and stop rows are uniform height.
- E2E specs are unaffected — they run at Playwright's default 1280×720, where the
  desktop playback pill (not the sheet footer) is the transport.
