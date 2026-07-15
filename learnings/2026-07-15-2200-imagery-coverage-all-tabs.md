# Imagery coverage across every tab (Home, Trace, Atlas, Lessons, Quiz)

## What changed
- `src/components/SitePhoto.tsx` — new `SiteThumb` (64px decorative, aria-hidden
  thumbnail of a site's lead photo). Map-dependent components
  (`AerialViewButton`, `StreetLevelViewer`, `SiteViews`, `SiteViewLinks`)
  moved to new `src/components/SiteViews.tsx` so SitePhoto's import graph is
  maplibre-free.
- `HomeView.tsx` — each mode card carries a representative bundled photo
  (trace→Appian Way, atlas→Ephesus, lessons→Sea of Galilee, quiz→Areopagus).
- `TraceMode.tsx` — journey picker cards get first-stop thumbnails; collapsed
  timeline stops render their site photo inside "View details".
- `LessonMode.tsx` — lesson picker thumbnails; steps get full `SiteViews`
  (aerial + street-level) alongside the existing gallery via `LessonStepViews`.
- `QuizMode.tsx` — quiz picker thumbnails (related journey's first stop, falling
  back to the first question's `answerSiteId`); answer explanations render the
  answer site's photo — mounted strictly post-answer, so no spoilers.
- CSS: `.site-thumb`, `.journey-list__item--thumbed`, `.journey-list__body`.

## Why it mattered
- User ask: "all tabs of the application have as much coverage as possible."
  Every tab now shows bundled imagery: Home (mode cards), Trace (picker +
  every stop), Atlas (site detail), Lessons (picker + steps + in-app views),
  Quiz (picker + explanations).

## Gotchas / pitfalls
- Importing anything that transitively touches `maplibre-gl` breaks jsdom
  component tests (`window.URL.createObjectURL is not a function` at module
  load). HomeView.test caught this the moment HomeView imported SitePhoto —
  hence the SitePhoto/SiteViews module split. Keep map-touching imports out
  of components that non-map screens render.
- The only quiz has no `relatedJourneyId`; thumbnails needed the
  `answerSiteId` fallback to appear at all.

## Verification
- `typecheck` · `lint` · 32 unit tests · `build` · 7/7 e2e green.
- Browser drive of the production build: Home 4 thumbs; Trace picker 6;
  Lessons picker 2, step shows photo + 2 in-app view buttons; Quiz picker 1
  thumb, explanations show 0 photos before answering and 1 after.
  Screenshots reviewed.
