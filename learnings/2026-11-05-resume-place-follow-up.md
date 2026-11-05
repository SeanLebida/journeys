# Resume place follow-up

## What changed

Three gaps left after the first resume-place pass:

- `LessonPlayer` does not move the map camera until `placeReady` is true, so a saved step is not preceded by a flight to step 1.
- Section tabs use `Link` and set `aria-current="page"` from `tabSelected`, including on the list.
- `QuizRunner` scores saved answers with `answeredFlags` on the hydrated render. The score line no longer waits for an effect.

## Why it mattered

The camera flight made a restored lesson look like it had reset. The tab looked selected on the list while assistive tech did not call it the current page. A restored quiz showed Score: 0 for one paint beside answers that were already filled in.

## Gotchas / pitfalls

`NavLink` sets `aria-current` from its own `to`. A resume href such as `/lessons/carmel` is not active on `/lessons`, so the attribute has to be set on `Link`. Spreading an empty local answer map after `answeredFlags` keeps saved results. A later local answer still overrides that question.

## Verification

`NODE_OPTIONS='--localstorage-file=/tmp/journeys-ls.json' npx vitest run` — 176 passed, 0 failed. Without that flag, the six `ReleaseNotices` tests fail because this Node does not provide `localStorage`.
