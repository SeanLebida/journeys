# Resume place

## What changed

Place is stored in `usePlaceStore` under the persist name `journeys-place`, through `platformStorage` (localStorage on the web, Capacitor Preferences on the phone). Each lesson, route, and quiz keeps its own place, plus a current pointer. Tabs reopen the latest item. `/lessons`, `/trace`, and `/quiz` still show the lists and do not clear the saved place. Cold start still opens Home. The Home tab href stays `/`. There is no launch redirect.

A passage link highlights the inclusive verse band (1 Kings 18:20–40 is verses 20 through 40), focuses the first verse, and does not open the note field. A verse-number tap still opens the note. `Acts 13` paints no band because `passageBand` requires a verse numeral in the raw ref (`parseScriptureRef` defaults chapter-only refs to verseStart 1). Writes wait for `usePlaceHydrated()` because storage reads are async. Zoom +/- safe-area from `102eed9` was not changed.

Spec: [docs/superpowers/specs/2026-11-05-resume-place-design.md](../docs/superpowers/specs/2026-11-05-resume-place-design.md).

## Why it mattered

Leaving a lesson, route, or quiz used to drop the reader at the list with no way back to the step they had open. Saving a place per item, and a current pointer the tabs follow, puts them back without turning Home into a redirect. Passage links need the whole inclusive range focused, not a note editor, and a chapter-only ref must not invent a one-verse band.

## Gotchas / pitfalls

Storage reads are async. Screens that write before `usePlaceHydrated()` is true overwrite the restored place with empty defaults. `parseScriptureRef` fills verseStart 1 when the raw ref has no verse numeral, so `passageBand` must refuse those refs or `Acts 13` highlights verse 1. `vite preview` serves `dist/`; without a production build, `/atlas` is HTTP 404 and the zoom control is never mounted. That 404 is a missing build, not a safe-area regression. The rule from `102eed9` (`.app-shell .maplibregl-ctrl-top-right` at `top: var(--safe-top); right: var(--safe-right)`) was left as it was.

## Verification

`npx vitest run`: 159 passed, 6 failed. The only failures are `src/release/ReleaseNotices.test.tsx` because `localStorage` is undefined. Pre-existing. Out of scope.

`npx playwright test tests/e2e/zoom_safe_area.spec.ts` against `vite preview` failed because there is no `dist/` or `dist-content/`. `curl http://localhost:4178/atlas` was HTTP 404. The zoom button was never mounted. CSS was not edited to force a pass. The same spec passed when this worktree was served with `npx vite --port 4178`.
