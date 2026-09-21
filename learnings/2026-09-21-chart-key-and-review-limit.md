# Chart key, sideways scroll, and the review limit

## What changed

- The timeline opens with a measured legend (`ChartKey`): time runs down, each era has its own ruler, lanes sit side by side and continue to the right.
- An overflowing band gets arrows and a scroll meter above the chart. The arrows page the band. The meter is the visible slice of the chart. A fine pointer is told to hold Shift and roll the wheel; a touch screen is told to drag.
- `useScrollOverflow` writes `--tl-pos` and `--tl-thumb` on the era for that meter, and ignores overflow of 40px or less so the lane gutter is not announced as a hidden lane.
- The review mark is no longer a pill. The words are "Not specialist-signed", "Specialist-signed", and "Not yet checked". On a stop or a site header the sentence sits under the phrase. On a card inside that page, only the phrase shows.

## Why it mattered

A desktop wheel scrolls the page, not the chart, and a thin scrollbar does not say that lanes continue. The legend is the picture of the three rules the prose used to carry alone.

"Self-reviewed" was drawn as a seal next to the confidence mark, so it read as outside approval. It is the opposite: this project checked the claim, and a specialist has not signed it.

## Gotchas / pitfalls

- Keep the cue copy containing "scroll sideways". The e2e test matches that phrase, and hides the cue when `data-overflow` has no `x`.
- The meter must not live in React state. A scroll frame would re-render the whole timeline. The positions are CSS variables set from the scroll listener.
- The 40px slop is the right gutter, not a licence to hide a real lane. A phone-width monarchy band overflows by hundreds of pixels and must still set `end`.
- The review gloss is hidden except under `.stop-reader__meta` and `.stop-panel__head`. `display: contents` on `.claim-meta` there lets the review take the next row. Do not put that on every card or a page of miracles repeats the sentence.
- The Shift-scroll line is gated on `(hover: hover) and (pointer: fine)`. A headless desktop viewport still reports a fine pointer, so a narrow Playwright window is not a phone.

## Verification

```
npx tsc --noEmit
npx vitest run
```

Desktop 1280: the legend's three drawings sit above the dating notes. The monarchy band overflows by about 1000px; the right arrow moved it 761px and the year rail stayed put. Patriarchs (26px, the gutter) does not show the cue. A miracle card shows "Not specialist-signed" with no sentence; the stop header and the Capernaum header show the sentence under the phrase, in light and dark. Phone 390: the legend stacks. The sourcing key uses the same three review phrases.
