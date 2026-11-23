# Exodus "Whose map?" comparison UI

## What changed
- `src/map/exodusCompare.ts`: pure rules for the chooser. Route order, selection, fade expressions, cluster split zoom, advocate labels.
- `src/map/layers/exodusCompare.ts`: MapLibre layers for compared candidates. Region pins are soft blurred areas, summit/town pins are hollow rings, groups draw as a double ring until they split, and every pin has a 22px-radius hit disc (44px target).
- `WhoseMapChooser` in the Red Sea crossing and Mount Sinai sheets. `SiteCandidates` shows `claimStatus`, the candidate note and the pin precision.
- Compared sites (`site-red-sea-crossing`, `site-mount-sinai`) no longer draw a filled working dot or a site name tag, and opening one frames all of its candidates instead of centring the working pin.

## Why it mattered
- Sean has not chosen between side by side and a leading view, so nothing is selected by default and no row is marked as recommended.
- Routes are listed south to north by crossing point, then by advocate. The isthmus-lake (east-wind) crossings therefore sit after the gulf ones, as Sean asked.

## Gotchas / pitfalls
- MapLibre 4.7.1 `fitBounds` adds `transform.padding` to the padding you pass. Set the live padding first (`computeMapPadding`), then keep the extra margin small.
- `["zoom"]` cannot drive a per-feature filter, so the cluster split is computed in JS on `zoom` and applied with `setFilter` only when the split set changes.
- Chooser rows are never faded: the fade is on the map only, so every row keeps 7:1 text.
- `advocateNames` reads a future `advocates` array on a proposed route when one exists, and otherwise splits the `advocate` string on commas and "and".

## Verification
- `npm run lint`, `npm run typecheck`, `npx vitest run` (62 files, 410 tests). Playwright, dark scheme, at 412x760, 360x640 and desktop.
