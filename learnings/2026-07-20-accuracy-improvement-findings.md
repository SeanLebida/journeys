# Accuracy improvement findings

Audit of Journeys against its own principles: *cited, confidence-labeled, offline
atlas — mechanically consistent, not yet scholar-approved*. Scope: content model,
build gate, geographic precision, sourcing quality, UI honesty, and review
pipeline. No code changes in this entry — findings only.

Measured corpus (merged base + `.extra.json`): **110 sites · 9 journeys · 92
stops · 9 routes · 60 miracles · 38 battles · 30 artifacts · 9 witnesses · 412
citations · 2 lessons · 1 quiz**. Review status: **100% self-reviewed, 0%
scholar-approved**.

---

## Executive summary

The app already has an unusually strong *mechanical* accuracy stack (zod
schemas, citation closure, Wikipedia-alone ban, route endpoint gates, scripture
parse + verse resolution, release-time scholar gate). The biggest accuracy gaps
are no longer structural — they are **source quality depth**, **geographic
ambiguity presentation**, **human review**, and a few **honesty / meta** holes.

| Priority | Theme | Impact |
|---|---|---|
| P0 | Scholar review of 167 `high` claims | Blocks honest store release; every high pin is currently self-asserted |
| P0 | Generic backstop sourcing | 49 sites / 56 coord claims lean on Sacred Bridge/Aharoni alone as the "concrete" cite |
| P1 | Ambiguous sites lack `candidates` | 31/32 medium+disputed sites show one pin with no alternate |
| P1 | Tertiary non-Wiki still treated as scholarly | GotQuestions, Enduring Word, Britannica, BLB counted as concrete |
| P1 | Zero `primary-scripture` citations | Scripture is displayed but never entered as a citable primary source kind |
| P2 | Gazetteer IDs unused | `pleiadesId` exists on schema; 0/110 sites set |
| P2 | Route honesty for pre-Roman / sea | Itiner-e is Roman; patriarchal/exodus/sea legs need stronger UI caveats |
| P2 | Offline integrity tests lag the build gate | Route 5 km gate + verse resolution only in `build:content` |
| P3 | Thin pedagogical surface | 2 lessons, 1 quiz vs rich atlas content |
| P3 | Meta drift | README claims "World English Bible"; shipped texts are KJV + ASV |

---

## What already works (do not regress)

These are load-bearing accuracy assets. Improvements should *extend* them.

1. **Claim wrapper** (`schema.ts` `claimOf`) — confidence + reviewStatus +
   citations + required `disputes` when `disputed`.
2. **`build:content` accuracy gate** — schema, citation closure, Wikipedia-alone
   ban, referential integrity, route leg↔stop endpoint ≤5 km, WORLD_BBOX geo
   sanity, date display discipline, scripture verse resolution against bundled
   KJV keys, license credits, `--release` scholar-approval gate.
3. **Constitutional sourcing** (2026-07-19) — tertiary-by-URL Wikipedia check;
   233 concrete citations registered.
4. **Itiner-e land routes** (2026-07-17) — Roman-road network snap for covered
   land legs; honest note that sea/pre-Roman remain reconstructions.
5. **UI confidence surface** — `ConfidenceBadge`, `DisputeNote`, collapsible
   `Citations` on stops, sites, artifacts, witnesses, miracles, battles;
   `SourcingDisclosure` explains levels.
6. **Date discipline** — 0/92 stops use single-year exact dates without
   `approximate`; all ranges marked approximate (good).

---

## P0 — Unblock truthful "high" claims

### 1. Scholar review is still zero

| Entity | `high` and not `scholar-approved` |
|---|---|
| Site coordinates | 78 |
| Stops | 54 |
| Artifacts | 19 |
| Battles | 12 |
| Witnesses | 4 |
| **Total** | **167** |

`npm run build:content -- --release` correctly blocks shipping. Until a
qualified reviewer (historical geography / NT archaeology / ANE) signs off
batches of `high` claims, the product promise "accurate" is self-certified only.

**Ship path**
- Define a review packet format: claim id, value, current citations, suggested
  page/locus, reviewer decision (`approve` / `downgrade` / `dispute` + note).
- Batch by domain: (A) NT coastal cities with Pleiades/DARE IDs, (B) artifacts
  with museum accession, (C) cuneiform-fixed battles, (D) contested sites last.
- Prefer *downgrading false high* over rubber-stamping; accuracy improves when
  confidence matches evidence, not when every pin is green.

### 2. Generic gazetteer backstops pass the gate without proving the pin

After the Wikipedia-alone sweep, **Sacred Bridge** is attached **105 times**;
**49 site summaries** and **56 coordinate claims** have *only* a generic
gazetteer/secondary backstop (Sacred Bridge / Aharoni / ABD / Bright / …) as
their non-Wiki concrete source.

That satisfies the *mechanical* rule ("not Wikipedia alone") but does **not**
prove the specific lat/lon. A coordinate claim needs either:

- a **gazetteer record id** (Pleiades, DARE, OpenBible.info place page) with
  matching coordinates, or
- an **excavation / IAA / museum** locus, or
- an explicit **candidate set** when the identification is multi-site.

**Ship path**
- Raise the gate: coordinate claims with `confidence: high` must cite ≥1 of
  `gazetteer` | `archaeological` | `primary-ancient` **with a place-specific
  note or external id** — not only a whole-atlas backstop id reused 100×.
- Track "specificity": citation may carry optional `locus` / `page` / `pleiadesId`
  so Sacred Bridge is acceptable *when a map plate or page is named*.

---

## P1 — Geographic honesty where scholars disagree

### 3. `candidates[]` is almost unused

Schema supports alternate pins with their own confidence + citations.
**Only 1/110 sites** uses it (`site-ararat-landing`, 3 candidates).
**31 of 32** medium/disputed coordinate sites show a single pin and no
alternates — including Emmaus, Cana, Bethsaida, Mount Sinai, Ai, Golgotha-area
praetorium, baptism site, Gerasene region.

**Ship path**
- For every `coordinates.confidence ∈ {medium, disputed}`, require either
  `candidates.length ≥ 2` **or** a `disputes` note that names the rival
  identifications in prose (gate-enforce one of the two).
- Render candidates on the map as secondary markers (hollow / dashed) and list
  them in the site panel; never imply a single pin when the field does not.

### 4. Contested sites that should be multi-pin first

Priority candidate sets (well-documented scholarly splits):

| Site | Rival identifications (illustrative) |
|---|---|
| Emmaus | Nicopolis / Motza / Qubeiba / Abu Ghosh |
| Cana | Kafr Kanna / Khirbet Qana |
| Bethsaida | et-Tell / el-Araj |
| Baptism / Bethany beyond Jordan | Al-Maghtas (Jordan) / Qasr el-Yahud (West Bank) |
| Mount Sinai | Jebel Musa / Jebel al-Lawz / Har Karkom / others |
| Ai | et-Tell / Khirbet el-Maqatir |
| Praetorium / Gabbatha | Herod's Palace vs Antonia |
| Gerasene/Gadarene | Kursi / Gadara / Gerasa region |
| Ur of the Chaldees | Tell el-Muqayyar vs northern "Urfa" proposals |

### 5. `pleiadesId` (and peers) never populated

Schema field exists; **0 sites** set it. Pleiades citation appears only ~10
times as a generic source. Linking stable gazetteer IDs is the cheapest path to
*verifiable* coordinates and to automated drift checks.

**Ship path**
- Add optional `dareId` / `openBibleId` beside `pleiadesId`.
- Script: match modernName/ancientName → Pleiades search; human-confirm;
  store id + snapshot lat/lon; gate warns when high-confidence coords drift
  >N km from the gazetteer point.

---

## P1 — Source quality, not just source presence

### 6. Wikipedia-alone gate is URL-shaped, not quality-shaped

`isTertiary` = `url includes "wikipedia.org"`. That misses popular/tertiary
sources already in the corpus (**~18** and growing), labeled
`secondary-scholarly`:

- GotQuestions, Enduring Word commentary, Blue Letter Bible miracle list
- ESV Global Study Bible *maps* (orientation, not research)
- Britannica encyclopedia articles
- Biola blog posts

**49 claims** have *only* such popular/tertiary sources as their non-Wiki
concrete cite (Abraham stops, several Paul stops, early miracle entries, etc.).

**Ship path**
- Expand tertiary detection: host allow/deny lists + citation `kind` honesty
  (move BLB/GotQuestions/Enduring Word to a new kind `tertiary-popular` or
  re-kind and exclude them from `requireConcrete`).
- Require ≥1 of: `primary-scripture` | `primary-ancient` | `archaeological` |
  `gazetteer` | named monograph/reference (`secondary-scholarly` with print
  locus) for any `high` or coordinate claim.

### 7. Zero `primary-scripture` citation records

Citation kinds include `primary-scripture`, but **0/412** citations use it.
Stops/miracles/battles *display* `scriptureRefs` (good — and the Bible DB
resolves them), yet the citation list never treats the biblical text as a
primary source of the claim. That understates the actual evidential base for
narrative claims and overstates dependence on modern commentary.

**Ship path**
- Auto-derive or author `cit-scripture-<ref>` entries (kind
  `primary-scripture`) from each entity's `scriptureRefs`, and include them in
  `citations[]` for narrative stops/miracles/battles.
- Keep display passage UI as-is; the citation list should show the same refs
  as citable primaries.

### 8. Citation kind mix is secondary-heavy

| Kind | Count |
|---|---|
| secondary-scholarly | 264 |
| archaeological | 69 |
| gazetteer | 50 |
| primary-ancient | 29 |
| primary-scripture | **0** |

Aim: raise primary-ancient + archaeological + gazetteer-with-id share on
`high` coordinate and artifact claims; keep secondary for synthesis/dates.

### 9. Miracle catalogue sourcing is thin

All 60 miracles are `medium` or `disputed` (good epistemic humility for
location), but many lean on BLB harmonized lists + Keener background commentary
rather than per-pericope scholarly locus notes (e.g. disputed Gerasene site,
Bethsaida vs Capernaum traditions, John vs Synoptic chronology).

**Ship path**
- Per miracle: primary-scripture cite + one location discussion (Keener Acts /
  ABD entry / Sacred Bridge plate) + `locationNote` when the text is vague
  ("a mountain", "a village").

---

## P2 — Routes, chronology, and map layers

### 10. Route geometry grades are uneven — surface that

| Journey | Route points | Notes |
|---|---|---|
| Paul 2 | ~7.3k | Strong Itiner-e coverage (Via Egnatia etc.) |
| Paul 1 | ~5.0k | Cyprus + Via Sebaste |
| Paul 3 | ~3.2k | Interior + coastal hops |
| Exodus | ~1.4k | Traditional southern itinerary (debated) |
| Ministry | ~1.0k | Ridge / pilgrim roads |
| Abraham | ~0.7k | Fertile Crescent reconstruction (pre-Roman) |
| Rome | ~0.6k | Acts 27–28 sail notices |
| Apostolic traditions | ~94 | Explicitly traditional |
| Noah | ~19 | Schematic only (correctly noted) |

Land legs on the Roman network are GPS-grade relative to Itiner-e; **sea lanes
and pre-Roman corridors are not**. The route `note` says so, but the UI does
not grade legs (land-itinere / land-reconstructed / sea / traditional).

**Ship path**
- Tag each leg with `geometryGrade: 'surveyed-road' | 'reconstructed-land' |
  'sea-lane' | 'schematic'` at generate time; style the map stroke differently
  and expose the grade in the trace panel.
- Never snap patriarchal/exodus legs to Roman roads without an explicit
  "anachronistic network used as corridor proxy" disclaimer (Itiner-e notes
  already partially do this — make it per-leg and visible).

### 11. Endpoint gate is 5 km — fine for drift, not for precision

Generators emit exact stop coordinates as endpoints (good). The 5 km tolerance
only catches hand-edit drift. It does **not** validate that intermediate
vertices follow a real corridor. Consider optional max-detour checks (already
in `route-on-itinere.py` at 2.8× great-circle) re-run as a CI warning when the
Itiner-e source is available in CI cache.

### 12. Historical basemap layers need the same confidence treatment

Kingdom overlays, mandate borders, Oct 7 sites, barrier geometry, etc. are
visual claims. Several learnings document border precision work; they should
carry the same citation + confidence pattern as sites (layer-level metadata in
bundle or sidecar), so the Layer panel can show "source / approximate / era".

---

## P2 — Gates and tests

### 13. Offline unit tests lag the full accuracy gate

`tests/unit/content-integrity.test.ts` mirrors schema, dangling cites,
Wikipedia-alone, stop→site, journey stops, bbox, scripture *parse*, battle
areas, miracle coverage floors.

**Missing vs `build-content.ts`**
- Route leg count and 5 km endpoint snap
- Scripture *verse resolution* (needs Bible DB or a committed verse-key set)
- Person/artifact/term refs on stops; witness person/site refs
- Video YouTube id shape
- Quiz answerIndex / map-pin / order-stops integrity
- Neutrality checks on witnesses/miracles/battles (partially via schema)
- Duplicate citation ids

**Ship path** — promote every pure (no network) build invariant into the unit
file so `npm test` fails without running the full content build.

### 14. High-confidence loophole

Schema: non-`high` claims need ≥1 citation; **`high` may have empty
citations** (currently none do — good — but the rule allows it). Flip the
invariant: **every claim needs ≥1 citation; `high` needs ≥1 concrete
non-tertiary source with specificity**.

### 15. Generator / gate coverage lockstep

Prior pitfall (learnings 2026-07-19): sweep scripts and gate entity maps can
drift. Add a single shared entity walk list (or generate both from schema
keys) so new entity types cannot ship Wikipedia-only by omission.

---

## P3 — Product surfaces that affect perceived accuracy

### 16. Candidates, review status, and route grade under-rendered

- `reviewStatus` is never shown in UI (users cannot see self-reviewed vs
  scholar-approved).
- `candidates` have no map/panel renderer (only Ararat data exists).
- Route notes are buried; geometry grade not visual.

Showing these increases trust more than adding more `high` badges.

### 17. Lessons and quizzes are sparse

2 lessons · 1 quiz vs 9 journeys / 110 sites. Wrong quiz answers or thin
lessons hurt educational accuracy. Expand only with the same citation rules as
atlas content (quiz questions already have citations — keep the gate).

### 18. Meta / docs accuracy

- README Principles: "Bible text is **public domain** (World English Bible,
  King James Version)" — shipped translations are **KJV + ASV**, not WEB.
- Status line "412 citations (233 concrete)" is consistent with measurement;
  keep it updated when gates change.
- "Cited and reviewed — not definitive" is correct; consider elevating
  "self-reviewed, not scholar-approved" on the in-app sourcing panel until the
  release gate passes.

### 19. Photo / imagery accuracy

Site photos are Wikimedia-sourced; ensure each image's caption cannot be read
as "this is the biblical place" when the photo is a modern town or traditional
shrine. Prefer ruins/excavation photos for contested sites; keep per-image
license attribution (already credited).

---

## Recommended implementation order

1. **Review pipeline + packet** for the 167 high claims (process, not code).
2. **Tighten concrete-source gate** for coordinates: ban generic-only backstops
   on `high`; expand tertiary host list; introduce `primary-scripture` cites.
3. **Candidates pass** for the 31 medium/disputed sites; render on map + panel.
4. **Populate Pleiades/DARE ids** + drift warning script.
5. **Per-leg geometryGrade** on routes + UI styling.
6. **Promote full pure invariants** into `content-integrity.test.ts`.
7. **UI honesty**: show `reviewStatus`, stronger route caveats, fix README WEB→ASV.
8. **Deepen miracle/battle primary loci** beyond BLB/Keener/Bright backstops.
9. Expand lessons/quizzes only after 1–4 so pedagogy inherits better pins.

---

## Metrics to track after each accuracy PR

| Metric | Current | Target (near-term) |
|---|---|---|
| `scholar-approved` share of `high` claims | 0 / 167 | ≥30% of high coords + artifacts |
| Coordinate claims with place-specific gazetteer/arch cite | low (56 generic-only) | 0 generic-only on `high` |
| Medium/disputed sites with `candidates` or explicit rival note | 1 / 32 | 32 / 32 |
| Sites with `pleiadesId` (or peer) | 0 / 110 | ≥60 well-attested NT/Roman sites |
| `primary-scripture` citations | 0 | ≥1 per narrative stop/miracle/battle with refs |
| Tertiary-popular counted as sole concrete | ~49 claims | 0 |
| Integrity unit tests covering route + quiz + video gates | partial | parity with pure build checks |
| README / sourcing copy vs shipped Bible texts | WEB claimed | KJV + ASV |

---

## What changed

- Authored this findings document from a full-corpus measurement of content,
  `build-content.ts` gates, schema capabilities, citation reuse, candidate
  coverage, route density, and UI surfaces.

## Why it mattered

- Accuracy is the product's constitutional value. The mechanical gate is strong;
  remaining risk is **false precision** (single pins, generic backstops, high
  badges without external review) rather than missing schemas.

## Gotchas / pitfalls

- Do not "fix" Wikipedia-alone by attaching Sacred Bridge to everything —
  that already happened once; the next gate must demand **specificity**.
- Do not mark patriarchal routes as surveyed Roman roads without anachronism
  labels.
- Do not inflate `scholar-approved` without a real reviewer — the release gate
  is only valuable if the status is earned.
- `url`-optional citations: omit the key, never send `null` (zod).
- Keep generator sweeps and build-gate entity lists in lockstep.

## Verification

- Corpus stats computed from merged `content/*.json` + `content/*.extra.json`
  (same merge rule as `build-content.ts`).
- Spot-checked: 0 pleiadesIds; 1 site with candidates; 0 primary-scripture
  kinds; 167 high unreviewed; Sacred Bridge reuse 105; route point counts per
  journey; integrity test file vs build steps 4–10.
- No production code or content mutated in this findings pass.
