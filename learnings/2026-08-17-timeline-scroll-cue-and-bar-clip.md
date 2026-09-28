# Timeline: year no longer clipped; sideways scroll is signed

## What changed

- Short find bars (`Flood deposit layer at Shuruppak` and the like) were
  clipping their year. The bar was ~35px tall, a two-line title plus padding
  ate the space, and `.tl-bar { overflow: hidden }` hid `c. 2900 BC`.
  `eraBandHeight` floor is now 400px, bar `min-height` is 2.7rem, short bars
  clamp the title to one line, and the date cannot shrink away.
- Year-rail ticks at 0% / 100% lost half a label because `overflow-x: auto`
  on the band also clips overflow-y. Ticks now sit in an inset
  `.tl-axis__scale`.
- Horizontal overflow is no longer a caption under the chart. Each multi-lane
  era has a plate-gutter cue above the band ("Swipe the chart sideways") and
  a sticky right-edge fade labelled `more lanes` while `data-overflow`
  includes `end`. The band is a keyboard-focusable region.

## Why it mattered

On a phone the Finds & witnesses lane lives past the right edge. A reader
who did pan to it then could not read the year on the flood layer, and a
reader who did not pan had no reason to think the chart continued. Both are
the same failure: the chart did not say what it was doing.

## Gotchas / pitfalls

- Setting `overflow-x: auto` forces `overflow-y` to compute to `auto` as
  well. Anything that hangs out of the band vertically (a tick at 0% with
  `translateY(-50%)`) will clip. Inset the scale; do not fight the overflow.
- The right-edge fade is `position: sticky; right: 0` as the last flex child,
  pulled back with a negative margin so it does not add scroll width. Hide it
  when `data-overflow` no longer contains `end` or it covers the last lane.
- Container queries on `.tl-bar` need `container-type: size`. Android 12
  WebView supports them; the 640px breakpoint still forces a one-line title
  as a fallback.

## Verification

```
npm run typecheck
npm run lint
npm test
npx playwright test tests/e2e/timeline_bible.spec.ts
```

Phone (390×844): Primeval → flood bar shows `c. 2900 BC` in full; "more
lanes" fade is visible until the last lane is on screen.
