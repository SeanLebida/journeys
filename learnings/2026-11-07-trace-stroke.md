# Full route stroke is solid at the opening zoom

## What changed

- `src/map/layers/trace.ts` `trace-full-line` paint is now `{ 'line-color': color, 'line-width': 5, 'line-opacity': 0.8 }` with no `line-dasharray`. The progress line, stop circles, and traveller are unchanged.
- `src/map/layers/trace.test.ts` asserts that paint on the layer `attachJourneyTrace` adds.

## Why it mattered

At the Mediterranean opening fit a short journey is only a few dozen pixels. The old dash (`[2, 2]`) at opacity 0.35 left gaps, so the path looked missing until `easeTo` finished. `trace-progress-line` has zero length at progress 0, so the full-route layer is the one that has to be readable immediately.

## Gotchas / pitfalls

- Do not put the dash back on `trace-full-line`. Width 8 and opacity 0.95 stay on `trace-progress-line` only.
- Country and atlas dashes in `style.ts` and `atlas.ts` are a different layer. This note does not change them.

## Verification

- `npx vitest run src/map/layers/trace.test.ts`: 6 passed.
- `npm test`: 32 files, 191 passed.
