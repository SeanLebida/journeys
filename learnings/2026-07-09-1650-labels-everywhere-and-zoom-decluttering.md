# Name labels across every map-bearing tab + zoom-based decluttering

## What changed
- `src/map/route.ts` — added `progressAtIndex(coords, index)`, the inverse of
  `activeStopIndex`: the progress fraction at which a given stop is reached.
- `src/modes/map-trace/TraceMode.tsx` — every stop on the traced route now
  gets a `.site-label` name marker; clicking one pauses playback and scrubs
  `progress` straight to that stop (`progressAtIndex`).
- `src/modes/lesson/LessonMode.tsx` — the numbered step marker now also gets
  a name label (`stepSiteName`, resolves via `step.siteId` or
  `step.stopId → stop.siteId`); both are clickable to jump to that step.
- `src/modes/quiz/QuizMode.tsx` — `MapPinQuestion` now reveals two labeled
  markers once answered: the user's guess (color-coded correct/wrong) and
  the actual target site by name. Never shown before answering — would
  spoil the question.
- `src/map/MapProvider.tsx` — `LABEL_ZOOM_THRESHOLD = 6`; a `zoom` listener
  toggles a `map-labels-visible` class on the map container.
- `src/styles/global.css` — `.site-label` is `display: none` by default,
  shown under `.map-labels-visible`; `.quiz-pin-label` is exempted (always
  visible — only ever 2, never congested).

## Why it mattered
- Follow-up to the Atlas site-label feature: once labels existed everywhere
  a dot did (Atlas *and* Trace *and* Lessons), a full-Mediterranean or
  full-journey view put 20-60 overlapping text labels on screen at once —
  unreadable noise. Direct feedback: "too much information on the map...
  need a way of clicking in further to see the rest of the detail."
- Fix is a zoom threshold, not per-label collision logic: there's no glyph/
  font source shipped (see M1 notes in `style.ts`), so labels are DOM
  markers, not a MapLibre symbol layer with `text-allow-overlap: false`.
  Toggling a single class on `zoom` is O(1) per tick regardless of label
  count, vs. rebuilding N markers or computing per-pair overlap every frame.

## Gotchas / pitfalls
- The quiz answer-reveal markers reuse the `.site-label` class (for shared
  positioning/type styling) but must stay visible regardless of zoom — the
  hide rule had to explicitly exempt `.quiz-pin-label`, not just rely on
  `.map-labels-visible` being present, since a `map-pin` question can be
  answered at any zoom level including the full-Mediterranean default.
- `LABEL_ZOOM_THRESHOLD = 6` was picked empirically: the initial
  full-Mediterranean fit lands at zoom ≈3.9 (hide), Lesson steps fly to
  zoom 8 by default (show). Re-check this constant if `MEDITERRANEAN_BBOX`
  or the default lesson-step zoom ever changes.

## Verification
- Direct measurement (not just visual): `document.querySelectorAll('.site-label')`
  filtered by `getComputedStyle(el).display !== 'none'` — 0/57 visible at
  the initial zoom (~3.9), 57/57 after `map.setZoom(7)`.
- `npm run typecheck && npm test` (28 tests) and
  `npx playwright test tests/e2e/` (6 tests) green.
