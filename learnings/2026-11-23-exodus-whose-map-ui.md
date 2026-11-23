# Exodus "Whose map?" comparison UI

## What changed
- `src/map/exodusCompare.ts`: pure rules for the chooser. Route order, selection, fade expressions, cluster split zoom, advocate labels.
- `src/map/layers/exodusCompare.ts`: MapLibre layers for compared candidates. Region pins are soft blurred areas, summit/town pins are hollow rings, groups draw as a double ring until they split, and every pin has a 22px-radius hit disc (44px target).
- `WhoseMapChooser` in the Red Sea crossing and Mount Sinai sheets. `SiteCandidates` shows `claimStatus`, the candidate note and the pin precision.
- Compared sites (`site-red-sea-crossing`, `site-mount-sinai`) no longer draw a filled working dot or a site name tag, and opening one frames all of its candidates instead of centring the working pin.

## Why it mattered
- Sean has not chosen between side by side and a leading view, so nothing is selected by default and no row is marked as recommended.
- Routes are listed in geographic order, south to north by crossing point, then by advocate.

## Gotchas / pitfalls
- MapLibre 4.7.1 `fitBounds` adds `transform.padding` to the padding you pass. Set the live padding first (`computeMapPadding`), then keep the extra margin small.
- `["zoom"]` cannot drive a per-feature filter, so the cluster split is computed in JS on `zoom` and applied with `setFilter` only when the split set changes.
- Chooser rows are never faded: the fade is on the map only, so every row keeps 7:1 text.
- `advocateNames` reads a future `advocates` array on a proposed route when one exists, and otherwise splits the `advocate` string on commas and "and".

## Verification
- `npm run lint`, `npm run typecheck`, `npx vitest run` (62 files, 410 tests). Playwright, dark scheme, at 412x760, 360x640 and desktop.

## Follow-up: collision labels and Trace (fd/exodus-compare-2)
- Candidate names and cluster tags are now MapLibre symbol layers (Ubuntu glyphs), so collision drops a label rather than letting it overlap another. Invisible icon "blockers" on every pin sit above the labels, so a name never covers a pin. `symbol-sort-key` puts the picked route's names first.
- `useExodusCompareMap` holds the map side for both Atlas and Trace. Trace keeps `isStyleLoaded()` false while it rewrites its route, so the hook keeps retrying on `idle` instead of waiting once for `load`.
- The floating layer control is not part of the camera padding, so route framing adds its height to the top padding.

## Follow-up: one label system (fd/exodus-labels)
- Atlas site names are now the `atlas-sites-labels` symbol layer, in the same collision system as the "Whose map?" names. `layers/labelCollision.ts` owns the stacking order: blockers on top, then compare names, then site names. MapLibre places the top layer first, so picked-route names win. The DOM site tags stay for keyboard users, clipped until focused. MapLibre writes an inline opacity on markers, so hiding them with opacity does not work.
- Atlas layer setup used a one-shot `once('load')`. Once the compare hook had added sources first, `isStyleLoaded()` was false and 'load' never fired again, so site dots could go missing. Both now retry on `idle`.
- In Trace, compare names anchor to the left of their pin, and stop badges on compared sites sit 18px out, clear of the 12px cluster ring.
