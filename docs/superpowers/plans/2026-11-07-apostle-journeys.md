# Journeys of the Twelve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of the Twelve his own journey, keep the shared journey to the places they were together, and make every stop readable with no signal.

**Architecture:** New journey records live in `content/*.apostles.json`, loaded beside the existing base and `.extra.json` files. A stop still belongs to one journey through `journeyId`. The photo slot stays `SitePhoto` when a bundled picture exists; otherwise it crops the bundled relief around the stop and draws a locator, and uses the existing satellite layer in that close view only while the layer can load.

**Tech Stack:** TypeScript, React, Vitest, Zod content build, MapLibre, the bundled Natural Earth relief.

**Spec:** `docs/superpowers/specs/2026-11-07-apostle-journeys-design.md`

## Global Constraints

- Eleven new journeys for `person-andrew`, `person-james-zebedee`, `person-john-apostle`, `person-philip-apostle`, `person-bartholomew`, `person-thomas`, `person-matthew`, `person-james-alphaeus`, `person-thaddaeus`, `person-simon-zealot`, and `person-matthias`. Peter's journey stays `journey-peter`.
- No journey for Judas Iscariot, Paul, or Mark. Paul's journeys stay untouched.
- `person-philip-evangelist` and `person-james-brother-jesus` are not the apostles of those names. Acts 8 stays off `journey-philip-apostle`.
- `journey-apostolic-traditions` draws only places where more than one of the Twelve were together. Required stops: `site-jerusalem` (the group after Pentecost) and `site-samaria` (Peter and John, Acts 8:14). It does not draw `site-antioch`, `site-rome`, `site-ephesus`, `site-patmos`, `site-hierapolis`, or `site-alexandria`. Mark and Alexandria are named in its summary only.
- A together-place is a separate stop row on each journey that includes it. Those rows share `siteId` and the same citation ids. The event names who was there.
- Walking order is non-decreasing `dateRange.startYear`. Inside one year, `display.en` says which stop is earlier and which is later.
- Where the New Testament orders the stretch, that order leads. Where it names no destination and a history and a find name different places, the line visits both.
- If nothing orders two places, `chronologyNotes` says the order is unknown, and `confidence` is not `high`.
- Every new claim cites a Christian biblical scholar and the primary source that scholar explains. `reviewStatus` is `draft` or `self-reviewed`, never `scholar-approved`. Later tradition a scholar treats as legend is `legendary` or `disputed`.
- Picture licenses are public domain, CC0, CC BY, or CC BY-SA only. No satellite tile is written into the package. The relief view is enough offline.
- Do not call `setStyle()` on the main map. The photo frame must not move the main map's camera.
- Asset URLs go through `resolveAssetUrl`. Do not use `Capacitor.convertFileSrc` for the relief file.

## Review Focus

- A stop with no bundled photo, opened with the network blocked, still shows a relief close view and a locator. Test in Task 2.
- The traditions journey no longer chains Antioch, Rome, Ephesus, Patmos, Hierapolis, and Alexandria. Test in Task 4.
- A legendary stop is not graded `high`, and no new stop is `scholar-approved`. Test in Task 4.
- Philip the apostle's journey does not cite Acts 8 as his itinerary, and James son of Alphaeus's journey does not use `person-james-brother-jesus`. Test in Task 5.
- A stop outside the old box (−12, 22, 50, 48) still validates, and its route point lies inside the widened `WORLD_BBOX`. Test in Task 6.

---

### Task 1: Load `*.apostles.json`

**Files:**
- Modify: `scripts/build-content.ts` (the `merged` helper)
- Test: `tests/unit/apostles-loader.test.ts`

**Interfaces:**
- Consumes: `readJson` already in `scripts/build-content.ts`
- Produces: `merged(name)` returns `name.json` + `name.extra.json` + `name.apostles.json`, missing files empty

- [x] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('apostles content files', () => {
  it('build-content merges a *.apostles.json array after the extra file', () => {
    const src = readFileSync('scripts/build-content.ts', 'utf8');
    expect(src).toContain('.apostles.json');
  });
});
```

- [x] **Step 2: Run the test**

Run: `npm test -- --silent tests/unit/apostles-loader.test.ts`
Expected: FAIL because the loader does not mention `.apostles.json`

- [x] **Step 3: Extend `merged`**

In `scripts/build-content.ts`, change `merged` so it spreads `readJson(\`${name}.apostles.json\`, [])` after the extra file.

- [x] **Step 4: Run the test**

Run: `npm test -- --silent tests/unit/apostles-loader.test.ts`
Expected: PASS

### Task 2: Relief close view and locator

**Files:**
- Create: `src/map/placeFrame.ts`
- Create: `src/components/PlaceFrame.tsx`
- Modify: `src/modes/map-trace/TraceMode.tsx` (the `SitePhoto` in the stop reader)
- Modify: `src/modes/lesson/LessonMode.tsx` (the step `SitePhoto`)
- Modify: `src/modes/sandbox/AtlasMode.tsx` (the site `SitePhoto`)
- Test: `src/map/placeFrame.test.ts`
- Test: `src/components/PlaceFrame.test.tsx`

**Interfaces:**
- Consumes: `lonLatToCropPixel` and `hillshadeCrop` from `src/map/hillshade.ts`; `hasSitePhoto` from `src/components/SitePhoto.tsx`; `ASSET_PATHS.hillshade` and `resolveAssetUrl`
- Produces:
  - `reliefCloseCrop(lon: number, lat: number, spanPx?: number): { sx: number; sy: number; sw: number; sh: number }` in source pixels of the cropped relief PNG. Default span 96. The rect stays inside the image.
  - `reliefLocatorBox(lon: number, lat: number, spanPx?: number): { x: number; y: number; w: number; h: number }` fractions of the full relief, each between 0 and 1, describing that same rect.
  - `PlaceFrame({ siteId, lat, lon, name, online }: { siteId: string; lat: number; lon: number; name: string; online?: boolean })`. When `hasSitePhoto(siteId)` it renders `SitePhoto`. Otherwise it renders a figure `[data-place-frame="relief"]` with a close canvas and a locator canvas `[data-place-locator]`. `online` defaults to `navigator.onLine`. When `online` is false the figure contains no element whose source or class requests satellite. When `online` is true the close view may add a map node `[data-place-satellite]` that uses the existing satellite raster source and is removed on unmount. That node must not call `setStyle` or `easeTo`/`jumpTo`/`flyTo` on the main map.

- [x] **Step 1: Write failing geometry tests**

Jerusalem 35.2E, 31.78N is inside the relief. Assert `reliefCloseCrop` returns positive `sw` and `sh`, and `sx`/`sy` keep the rect inside `hillshadeCrop()`. Assert `reliefLocatorBox` fractions sit inside 0..1 and the box center is nearer that coordinate than the image corner.

- [x] **Step 2: Run the geometry test and confirm it fails**

Run: `npm test -- --silent src/map/placeFrame.test.ts`

- [x] **Step 3: Implement `placeFrame.ts` and `PlaceFrame.tsx`**

The relief image is `resolveAssetUrl(ASSET_PATHS.hillshade)`. Draw the close crop with `drawImage`. Draw the locator as the full image with a stroke rect from `reliefLocatorBox`. If the image fails to load, the figure still renders and shows the place name. The satellite node, when `online` is true, is a second MapLibre map whose container is only the close frame, created with the app's existing satellite source, destroyed on unmount.

- [x] **Step 4: Write the component test**

Render `PlaceFrame` with a site id that has no photo, `online={false}`, and a coordinate. Expect `[data-place-frame="relief"]` and `[data-place-locator]`. Expect the document HTML not to contain `arcgisonline` or `satellite-raster`. Render again with a site id that has a photo and expect no `[data-place-frame="relief"]`.

- [x] **Step 5: Use `PlaceFrame` in the three call sites**

Pass the site's `coordinates.value.lat` and `lon`, and `ancientName.en`. Leave `QuizMode` on `SitePhoto`.

- [x] **Step 6: Run the tests**

Run: `npm test -- --silent src/map/placeFrame.test.ts src/components/PlaceFrame.test.tsx`
Expected: PASS

### Task 3: Shared journey draws only the together-places

**Files:**
- Modify: `content/journeys.extra.json` (`journey-apostolic-traditions` only)
- Modify: `content/stops.extra.json` (remove the six `stop-apostolic-*` rows)
- Create: `content/stops.apostles.json`
- Create: `content/journeys.apostles.json` only if the traditions journey record itself must move; prefer editing the existing record in `journeys.extra.json`
- Test: `tests/unit/apostle-journeys.test.ts`

**Interfaces:**
- Consumes: Task 1 loader; existing sites `site-jerusalem`, `site-samaria`
- Produces: traditions stops `stop-together-jerusalem` and `stop-together-samaria`

- [x] **Step 1: Write the failing test**

Load `content/journeys.extra.json`, `content/stops.extra.json`, and `content/stops.apostles.json`. Assert `journey-apostolic-traditions` lists only `stop-together-jerusalem` and `stop-together-samaria`, in that order. Assert neither stop uses `site-antioch`, `site-rome`, `site-ephesus`, `site-patmos`, `site-hierapolis`, or `site-alexandria`. Assert Jerusalem's `startYear` is less than or equal to Samaria's. Assert the summary names Mark and Alexandria and names that the later places are on each apostle's own journey. Assert both stops' `reviewStatus` is not `scholar-approved`, both have `scriptureRefs` including `Acts 2:1` and `Acts 8:14` respectively, and both `persons` arrays include `person-peter` and `person-john-apostle`.

- [x] **Step 2: Run the test and confirm it fails**

Run: `npm test -- --silent tests/unit/apostle-journeys.test.ts`

- [x] **Step 3: Replace the traditions stops**

Delete `stop-apostolic-antioch-peter-0`, `stop-apostolic-rome-peter-1`, `stop-apostolic-ephesus-john-2`, `stop-apostolic-patmos-john-3`, `stop-apostolic-hierapolis-philip-4`, and `stop-apostolic-alexandria-mark-5`. Add the two together-stops on `journey-apostolic-traditions` with `legMode` `start` then `land`. Date Jerusalem about AD 30 and Samaria after it, both `approximate: true`. Confidence `high` for these two Acts stops only if the citations include a scripture citation and one secondary-scholarly citation already in the repo (`cit-ref-keener-bbcnt` qualifies). Rewrite the journey summary as the group guide. Keep `kind: "apostolic"`.

- [x] **Step 4: Run the test**

Run: `npm test -- --silent tests/unit/apostle-journeys.test.ts`
Expected: PASS

### Task 4: The eleven journeys

**Files:**
- Create: `content/journeys.apostles.json`
- Create: `content/stops.apostles.json` (append; Task 3 may already have created it)
- Create: `content/sites.apostles.json`
- Create: `content/routes.apostles.json`
- Create: `content/citations.apostles.json`
- Modify: `content/persons.extra.json` (`journeyIds` for the eleven, plus `person-peter` if a new journey id is added; do not add a journey for Judas, Paul, or Mark)
- Modify: `content/journeys.extra.json` (`journey-peter` stop list only if a required later place is missing)
- Test: `tests/unit/apostle-journeys.test.ts`

**Interfaces:**
- Consumes: Task 1 loader; Task 3 together-stops as the pattern for a stop row
- Produces: journey ids `journey-andrew`, `journey-james-zebedee`, `journey-john`, `journey-philip-apostle`, `journey-bartholomew`, `journey-thomas`, `journey-matthew`, `journey-james-alphaeus`, `journey-thaddaeus`, `journey-simon-zealot`, `journey-matthias`

- [x] **Step 1: Extend the test**

Assert all eleven ids exist, each `kind` is `apostolic`, each has at least one stop, and each stop list is non-decreasing in `startYear`. Assert no stop on these journeys has `reviewStatus` `scholar-approved`. Assert a stop with an empty `scriptureRefs` array does not have `confidence` `high`. Assert `journey-philip-apostle` stops do not include `person-philip-evangelist` and their `scriptureRefs` do not include `Acts 8:5`, `Acts 8:26`, or `Acts 8:40`. Assert `journey-james-alphaeus` stops do not include `person-james-brother-jesus`. Assert `journey-john` includes `site-ephesus` and `site-patmos` after a Jerusalem or Samaria stop. Assert `journey-philip-apostle` includes `site-hierapolis`. Assert `journey-peter`'s stops, if Rome is present, place `site-rome` at the end of his `startYear` order.

- [x] **Step 2: Run the test and confirm it fails**

Run: `npm test -- --silent tests/unit/apostle-journeys.test.ts`

- [x] **Step 3: Author the journeys**

Follow the spec's order rules. Biblical stretches first on each journey. Later stretches after them. Where the Bible names no destination and the historical account and the find name different places, add both stops. Reuse a site id that already exists. Add a site only in `sites.apostles.json`, with `coordinates.value` as a cited claim. Every new citation needs `kind`, `source`, and `url` that you opened. Do not invent a URL. A popular page is not the only citation on a stop. Copy the stop field shape from `stop-apostolic` rows that Task 3 removed: `journeyId`, `order`, `siteId`, `legMode`, `dateRange`, `eventSummary`, `scriptureRefs`, `persons`, `confidence`, `reviewStatus`, `citations`. Add a `RoutePath` per journey whose legs include both endpoints. `legGrades` may be `schematic` where the road is not surveyed. Set each person's `journeyIds` to include his journey.

- [x] **Step 4: Run content validation and the test**

Run: `npm run build:content`
Expected: the command exits 0, or the only failures are coordinates outside `WORLD_BBOX`. Those failures are Task 6's input. Fix every other error before leaving this task.

Run: `npm test -- --silent tests/unit/apostle-journeys.test.ts`
Expected: PASS

### Task 5: Photos for the new sites

**Files:**
- Modify: `src/content/siteImages.json` (generated; do not hand-edit if the fetch script owns it)
- Modify: `scripts/fetch-site-images.mjs` only if a new site needs an allow-list entry the script already uses
- Create: files under `public/images/sites/` that the existing fetch script writes

**Interfaces:**
- Consumes: the site ids from Task 4
- Produces: zero or more gallery entries. A site with no free photo is valid. `PlaceFrame` covers it.

- [x] **Step 1: Run the existing image fetch for new site ids that have a Commons file under public domain, CC0, CC BY, or CC BY-SA**

Do not download NC, ND, or all-rights-reserved files. A find photo is a second image in that site's gallery, captioned as the find. If no free file exists, leave the site without an image.

- [x] **Step 2: Confirm `SitePhoto` resolves any site you added and ignores the rest**

Run: `npm test -- --silent src/components/PlaceFrame.test.tsx`
Expected: PASS

### Task 6: Widen the offline atlas to the new stops

**Files:**
- Modify: `src/map/graticule.ts` (`WORLD_BBOX`)
- Modify: `scripts/clip-basemap.py` and `scripts/route-on-itinere.py` (the box kept in sync with `WORLD_BBOX`)
- Modify: `public/images/map/hillshade.png` via `npm run map:hillshade`
- Test: `src/map/hillshade.test.ts` and `npm run build:content`

**Interfaces:**
- Consumes: every site and route coordinate from Task 4
- Produces: `WORLD_BBOX` as the smallest whole-degree rectangle that contains the previous box (−12, 22, 50, 48) and every new coordinate. `hillshadeCrop()` follows it. Sea stays transparent. One image, not a closer pyramid.

- [x] **Step 1: Set `WORLD_BBOX` from the authored coordinates**

Whole degrees, outward. Do not shrink the old box.

- [x] **Step 2: Regenerate the basemap and the relief**

Run the repo's existing clip and `npm run map:hillshade`. Update the duplicate boxes in `scripts/clip-basemap.py` and `scripts/route-on-itinere.py`.

- [x] **Step 3: Validate**

Run: `npm run build:content`
Expected: exit 0, including every new coordinate.

Run: `npm test -- --silent src/map/hillshade.test.ts src/map/placeFrame.test.ts tests/unit/apostle-journeys.test.ts`
Expected: PASS

### Task 7: Learning note

**Files:**
- Create: `learnings/2026-11-07-apostle-journeys.md`

- [x] **Step 1: Write the note**

Sections: What changed, Why it mattered, Gotchas / pitfalls, Verification. Record that the traditions line no longer joins the later solo destinations, that the atlas box grew to fit the new stops, and that the photo slot uses the relief when a free picture and the satellite layer are both absent.

## Self-review

- Spec coverage: eleven journeys (Task 4), traditions together-places (Task 3), time order and grades (Tasks 3–4), citations (Task 4), photos and relief slot (Tasks 2 and 5), offline atlas (Task 6), Peter kept (Task 4), Mark off the line (Task 3).
- The photo frame's satellite node is specified as a second map that does not touch the main map. The relief path does not wait on it.
- `merged` is the only loader name. Journey ids match across tasks.
- Review Focus items each have a test in Tasks 2, 4, 5, and 6.
