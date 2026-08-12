# Prophets, kings and apostles as content; a linear timeline; a Bible reader with notes

## What changed

**Content model** (`src/content/schema.ts`, `scripts/build-content.ts`)

- `JourneyKind` gained `conquest`, `monarchy`, `prophetic`, `exile`, `return`. The four original kinds
  covered patriarchs → apostles and left the entire Old Testament middle unclassifiable.
- `Person` became a first-class timeline entity: optional `category` (new `PersonCategory` enum),
  `realm`, `books`, `lifeRange`, `ministryRange`, `homeSiteId`, `siteIds`, `journeyIds`,
  `contemporaries`, `datingNote`. Every one is optional — a figure the text places only vaguely gets
  no pin rather than a fabricated one.
- The gate learned the matching checks: person place/journey/contemporary ids must resolve, `books`
  must be canonical book names (validated through `parseScriptureRef`), person date ranges go through
  the same `dateCheck` as journeys and stops, and a new soft warning reports how many persons carry no
  dated span (currently 1/89 — Noah, deliberately).

**Content** (`scripts/gen-figures.py`, `content/*.extra.json`)

New idempotent generator, following the existing `gen-*.py` convention. Adds 22 sites, 67 persons
(patching the 22 existing ones in place rather than rewriting their prose), 9 journeys, 62 stops and
287 citations. Totals went 110→132 sites, 9→18 journeys, 92→154 stops, 22→89 persons.

- Journeys: Samuel, David, Elijah, Elisha, Jonah, Jeremiah, the exile, the return, and Peter.
- Persons: all four major prophets, all twelve of the Twelve (minor prophets), the non-writing
  prophets (Samuel, Nathan, Ahijah, Micaiah, Huldah, Deborah), judges, the kings of Israel and Judah
  that date them, the foreign rulers that anchor the chronology, the post-exilic figures, all twelve
  apostles, and the first generation after them.
- Prophets who do not travel (Isaiah in Jerusalem, Amos at Tekoa) get a home site and a dated bar
  rather than an invented itinerary.

**Eras** (`src/content/eras.ts`) — one shared era spine (primeval → apostolic) with ranges, blurbs and
per-era dating disputes. The trace picker and the timeline both group by it, so they cannot drift.

**Timeline** (`/timeline`) — `src/content/timeline.ts` builds the model; `src/components/timeline/
TimelineParts.tsx` holds the reusable pieces (era header, year axis, lane column, bar, standalone
strip, filters, detail card); `src/modes/timeline/TimelineMode.tsx` composes them.

**Bible reader** (`/bible`) — `src/content/scriptureIndex.ts` (passage → atlas reverse index),
`useBible.ts` gained `useChapter`, `useChapterCounts` and `searchVerses`, `src/state/useNotesStore.ts`
holds highlights/notes/bookmarks, `src/components/bible/BibleParts.tsx` holds the reusable pieces, and
`src/modes/bible/BibleMode.tsx` composes them into read / books / notes / search.

**Cross-linking** — `ScripturePassage` everywhere in the app now carries an "open in the reader" link;
the reader and the timeline link back out with `/trace/:id` and a new `/atlas?site=…` deep link.

## Why it mattered

The atlas could show you Paul's second journey in detail and had nothing to say about Elijah, Isaiah
or Jeremiah — the whole prophetic and monarchic spine of the narrative was missing, and the four
journey kinds had no bucket to put it in. And the app could take you from a place to its passages but
never the other way: there was no way to read a chapter and find out that the atlas maps it.

Three design decisions are worth keeping:

1. **Person as a timeline entity, not a new entity type.** A separate `Prophet` or `Figure` schema was
   the obvious move and the wrong one: the same person is a prophet on one screen and a stop's
   participant on another, and two entities would have meant two ids for Elijah.

2. **Each era gets its own linear scale.** One scale from 3000 BC to AD 100 leaves the entire New
   Testament a few pixels tall. Printed study-Bible charts break scale between periods for exactly this
   reason; the app does the same and *says so* — a "scale changes" notch at every boundary and a
   standing note at the top. Within a band the scale is strictly proportional.

3. **Notes key off `book:chapter:verse`, never off content ids.** A content update that renumbers or
   drops a stop can therefore never orphan a note. They persist through the existing platform seam
   (localStorage on web, Capacitor Preferences on device), never leave the device, and
   `exportNotes()` gets them out as Markdown.

## Gotchas / pitfalls

- **Timeline lanes must never wrap.** The first layout used `flex-wrap: wrap`, which looked tidy and
  was a lie: a lane pushed onto a second row no longer lines up with the year rail on its left, so
  "Kings" and "Prophets" at the same vertical position were showing different centuries. The band is
  now a single non-wrapping row that scrolls sideways (like a fold-out chart) with the year rail
  `position: sticky; left: 0`. An e2e test asserts every lane track shares the rail's top edge.
- **A sticky rail inside a padded scrollport leaves a gutter.** `left: 0` pins to the *padding box*,
  so the container's `padding-left` stayed scrollable and bars slid through it as a visible sliver.
  A negative margin does not fix it (sticky pins the border box regardless). The fix is to take the
  horizontal padding off the scroll container entirely and let the rail and the lane row supply their
  own insets.
- **The year rail must offset itself by the lane heading height.** The rail has no heading, so its 0%
  sat one heading above every track's 0% and every bar was drawn below the tick meant to date it.
  Both sides now read `--lane-head-h`, and the lane heading has a fixed height rather than a content
  one.
- **`ref` is a reserved prop name.** `VerseNoteEditor({ ref: label })` silently receives nothing in
  React 18; it is `refLabel`.
- **`.mode-panel--page` is capped at 420px on desktop.** Home and Credits want that; a seven-lane
  timeline does not. `.mode-panel--wide` overrides the sidebar geometry and raises `--maxw`.
- **Era assignment needs a containment score.** A single-year event inside a band overlaps it by
  *zero* years, so a naive max-overlap search files every point event under whichever era is checked
  first. `eraForSpan` scores containment at 0.5 to break that tie.
- **Unverified gazetteer ids are worse than none.** The generator originally carried Pleiades ids for
  Nineveh, Babylon, Susa and En-gedi that could not be verified offline. Since a `pleiadesId` is one of
  the two things that license a `high` coordinate, a wrong one would have been a fabricated source.
  They were dropped; those sites rest on place-specific excavation reports (Layard, Koldewey, Perrot,
  Mazar) instead, which the gate accepts on the same footing.
- **Sites without an epigraphic identification are `medium`/`disputed` on purpose.** Tishbe, the brook
  Cherith, Gilgal, Tarshish and Tel-abib are genuinely unlocated and say so in a `disputes` note;
  Abel-meholah, Anathoth and Ziklag carry rival candidates instead of a single false pin.

## Verification

```bash
npm run build:content   # 132 sites · 18 journeys · 154 stops · 89 persons · 1164 citations — valid
npm run typecheck       # clean
npm run lint            # clean
npm test                # 11 files, 95 tests (32 new: timeline model, scripture index, notes store)
npm run build           # production build clean
npx playwright test     # 12 passed, 1 pre-existing failure (see below)
```

Also driven in a real browser (Chromium, 1280×900 and 390×844) to check the timeline lane alignment,
the sticky year rail during horizontal scroll, the deep-linked reader (`/bible?ref=1 Kings 18:21`),
the note round-trip and its survival across a reload.

New e2e coverage lives in `tests/e2e/timeline_bible.spec.ts` (5 tests): lane/rail alignment, the
in-band detail card, the deep-linked passage with its cross-references, note persistence across a
reload, and the new journeys appearing in the trace picker.

**Pre-existing failure, not from this change:** `tests/e2e/journey_motion.spec.ts` fails on the base
commit too — it writes screenshots to a hardcoded `/home/vic/.gemini/...` path from another machine
and depends on animation timing. Left alone.
