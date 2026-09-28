# Ararat / Noah's Ark accuracy pass + app-wide site imagery

## What changed

- **`content/sites.extra.json`** (`site-ararat-landing`) — corrected the **Mount
  Cudi** candidate coordinate from `37.3639, 42.4561` to `37.36944, 42.34417`
  (the old longitude was ~10 km off the summit per Wikipedia/Wikidata). Tightened
  the Greater Ararat summit to `39.7019, 44.2983` (both the claim value and the
  candidate). Added "on Mount Tendürek … 29 km south of Ararat" to the Durupınar
  candidate label (the formation is on Tendürek, not Ararat itself).
- **`content/stops.extra.json`** — same coordinate corrections in the flood-
  landing stop's prose (Ararat `39.7019`, Cudi `37.3694 / 42.3442`).
- **Gazetteer cross-check (Pleiades + Wikidata) of all 110 coordinates** —
  fixed **`site-shuruppak`** `45.34861 → 45.50976` lon (Tell Fara was ~15 km too
  far west; the moved point also required updating the Noah-route leg[0] start in
  `content/routes.extra.json`), and tightened **`site-lystra`** to the
  authoritative `37.60194, 32.33833`. Every other coordinate validated <3 km
  against Wikidata P625. Separately, **corrected 54 `pleiadesId` values** in
  `content/sites.{json,extra.json}`: ~40 were pointing at unrelated Pleiades
  places (Ur→"Tigris river", Nazareth→"Nemara", Qarqar→"Palmyra", Joppa held
  Lydda's id) or were dead 404s — replaced/added from Wikidata P1584 and each
  validated against the Pleiades representative point, or stripped when no valid
  id existed. All 63 pleiadesIds now validate <5 km.
- **`content/artifacts.extra.json`** (`artifact-durupinar-surveys`) — rewrote the
  `corroborates`/`disputes` prose with verified specifics: Noah's Ark Scans team
  led by Andrew Jones; 2019-onward GPR shows linear/right-angled reflectors, later
  re-analysis claims angular features ~6 m deep, three "deck" layers, a ~13 m
  central corridor; 22-point soil sampling (2022–2024) reports ~2× organic matter
  inside vs outside with pH/potassium shifts. Disputes now note the 1960 dig found
  only soil/rock and the limonite/magnetite doubly-plunging-syncline geology
  (Collins & Fasold 1996).
- **`content/citations.extra.json`** — added `cit-durupinar-radar` (Jerusalem Post
  2024 report of the radar re-analysis); expanded the `cit-ark-scans` note.
- **`src/content/artifactImages.json`** + `scripts/fetch-artifact-images.mjs` —
  added a bundled photo for `artifact-durupinar-surveys` (the boat-shaped
  formation, CC BY 3.0).
- **`src/content/siteImages.json`** + `scripts/fetch-site-images.mjs` — added
  freely-licensed present-day photos for **48 Old-Testament / flood-narrative
  sites** that previously had none. Site image coverage went **58 → 106 of 110**.
  Remaining 4 (`kadesh-barnea`, `ramah`, `ramoth-gilead`, `mount-zemaraim`) are
  unidentified/disputed sites with no representative free photo — left as honest
  gaps, documented with comments in the script.

## Why it mattered

- The user asked for a well-rounded, accurate, cited treatment of the Durupınar /
  Ararat "Noah's Ark" material, then the same standard app-wide: every site/
  artifact documented, ≥1 image where possible, GPS verified. The Mount Cudi
  longitude was a real ~10 km error that GPS "verification" existed to catch.
- The app's neutrality model (claim + confidence + `disputes` + citations) only
  works if the disputed-claim prose is *precise* about what was measured and by
  whom; vague "soil differences" reads as hand-waving where "2× organic matter at
  22 points, not peer-reviewed" is honest and checkable.

## Gotchas / pitfalls

- **`fetch-site-images.mjs` on the full 110-site set gets rate-limited (429) by
  Wikimedia and crawls** with compounding backoff. For incremental additions,
  fetch only the *new* ids and **merge** into `siteImages.json` (the 58 existing
  entries must stay byte-identical — verify with a drift check). A one-off merge
  script lived in the session scratchpad.
- **`{article}` lead-image lookups silently return wrong/unsuitable images.**
  `Ur` → an inscription (not the ziggurat); `Kadesh (Israel)` → **Petra**;
  `Ai (Canaan)` → a Doré-style engraving; `Carchemish` → a *map*; `Bethel` → a
  museum print; `Tabgha` → a 1903 photo. Always eyeball each `commonsFile` after a
  run and override with an explicit `{ file }`. SitePhoto tags every image
  "Present day", so historical prints/engravings are wrong even when on-topic.
- Sites with only museum artifacts (Shuruppak, Carchemish) legitimately use a
  photo of an object *from* the site — it's still a present-day photo.
- `stops.extra.json` stores non-ASCII as `\uXXXX`; the Edit tool matches on the
  decoded string, so editing with literal `°`/`—` works and re-encodes correctly.
- **Pleiades ids are not all 6–7 digits** — many valid entries have 8–9 digit
  ids (Hazor `779967430`, Šuruppak `326150788`, Mount Ararat `660563243`). A
  naive `^\d{1,7}$` filter wrongly rejects them. Validate a candidate by fetching
  its Pleiades reprPoint and checking distance, not by id length.
- **`content/sites.{json,extra.json}` round-trip byte-identically with
  `json.dumps(indent=1, ensure_ascii=False)`** (verified before writing), so a
  full re-dump yields a clean diff of only the fields you change. **`routes.extra.json`
  does NOT** (it uses `\uXXXX` escapes and no trailing newline) — edit it
  surgically, never via re-dump.
- The bogus `pleiadesId`s came from `scripts/gen-accuracy-pass.py`, which
  auto-assigns them; a wrong id silently satisfies the `build-content.ts` "high
  confidence needs a place-specific cite or pleiadesId" gate. Stripping wrong ids
  from well-attested sites (Hebron, Beersheba, Megiddo…) then trips that gate — so
  each was re-pointed to its correct Pleiades id rather than left empty.

## Verification

- `npm run build:content` ✓ (110 sites, 30 artifacts, 894 citations validate;
  new `cit-durupinar-radar` reference resolves).
- `npm run typecheck` ✓.
- Image integrity script: 106 site + 13 artifact entries, **0 missing files, 0
  orphans, 0 drift** on the original 58, all entries carry author/license/sourceUrl.
- Country bounding-box sweep of all 110 coordinates: no gross out-of-region pins
  (the one flag, `site-cnidus-and-fair-havens`, is a false positive — its coord is
  correctly at Fair Havens, Crete).
- Gazetteer cross-check: all 110 coords within 3 km of Wikidata P625 (the only
  >5 km flags were candidate-splits/centroids — Cana, Samothrace, Syracuse,
  Gilboa-ridge — plus the real Shuruppak fix); all 63 `pleiadesId`s validate
  <5 km against Pleiades reprPoints (final sweep: 0 problems).
- Coordinate sources: Wikipedia infoboxes for Mount Ararat (`39.7019, 44.2983`,
  5,137 m), Mount Judi (`37.36944, 42.34417`, 2,089 m), Durupınar
  (`39.44066, 44.23478`); Collins & Fasold 1996 = *Journal of Geoscience
  Education* 44(4):439–444 (confirmed).
