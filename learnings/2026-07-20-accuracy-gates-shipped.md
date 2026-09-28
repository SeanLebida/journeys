# Accuracy improvements shipped (gates, sourcing, graded geometry)

Implements the plan in [2026-07-20-accuracy-improvement-findings.md](2026-07-20-accuracy-improvement-findings.md).
That entry measured the gaps; this one records what was built.

## What changed

**Schema (`src/content/schema.ts`)**

- `claimOf` now requires `citations.min(1)` on every claim. Previously `high`
  confidence exempted a claim from citing anything — the one failure mode a
  confidence badge cannot express honestly.
- New `CitationKind` member `tertiary-popular` (popular encyclopedias,
  study-Bible maps, devotional sites) so tertiary sources are typed, not
  guessed at from URLs alone.
- New `GeometryGrade` enum — `surveyed-road` | `reconstructed-land` |
  `sea-lane` | `schematic` — plus optional `RoutePath.legGrades`.
- New optional `Site.dareId` alongside `pleiadesId`.

**Shared invariants (`src/content/accuracy.ts`, new)**

Single module holding `isTertiaryCitation`, `onlyGenericBackstops`,
`GENERIC_BACKSTOP_IDS`, `TERTIARY_HOST_FRAGMENTS`, `scriptureCitationId`.
Imported by both `scripts/build-content.ts` and the integrity test, so the
build gate and the test cannot drift apart.

**Build gates (`scripts/build-content.ts`)**

| Gate | Rule |
|---|---|
| 4b (widened) | No claim may rest on tertiary sources alone — was Wikipedia-only |
| 4c (new) | A `high` coordinate needs a place-specific cite or a `pleiadesId`/`dareId`; a whole-atlas backstop alone fails |
| 4d (new) | `medium`/`disputed` coordinates need ≥2 `candidates` or a disputes note |
| 4e (new) | Anything with `scriptureRefs` must cite `primary-scripture` |
| 5 (tightened) | Every claim needs ≥1 citation, `high` included |
| 6b (new) | `legGrades.length` must equal `legs.length` |
| 6c (new) | Soft warning below 40 sites with `pleiadesId` |

**Content (`scripts/gen-accuracy-pass.py` + JSON)**

- 477 `primary-scripture` citations minted and wired to the stops, persons,
  miracles and battles that quote them — scripture is now *in* the citation
  graph, not merely displayed beside it.
- 53/110 sites carry a `pleiadesId`; 31 sites now carry rival `candidates`.
- All 9 routes carry `legGrades` across all 83 legs.
- Hand-fixed the last 5 gate failures: `site-syria` (Tarsus/Cilicia) gained
  Strabo *Geography* 14.5 + Acts 15:41/21:39; `site-antioch-on-the-orontes`
  gained Pleiades 658381 (reprPoint verified against the live JSON API);
  `journey-abraham` gained Genesis 11:31 / 12:1 + Kitchen.

**UI honesty**

- `atlasRoutesFC` now emits **one feature per leg** carrying its `grade`,
  instead of one merged LineString per journey. Four filtered line layers
  (`ROUTE_GRADE_STYLE`) draw solid for surveyed road and progressively sparser
  dashes down to schematic.
- New `RouteGeometryNote` in the trace panel names every grade the drawn path
  uses, with swatches mirroring the map strokes.
- `sourcing.body` and README principles rewritten: tertiary (not just
  Wikipedia), the coordinate and ambiguity rules, and the Bible-text fix.

## Why it mattered

The mechanical stack was already strong; the residual risk was **false
precision**. A `high` pin sourced only to a whole-atlas reference, an ambiguous
site rendered as one confident dot, and a reconstructed corridor drawn with the
same stroke as a surveyed Roman road all *look* like knowledge the project does
not have. These gates make that class of claim unrepresentable rather than
merely discouraged.

## Gotchas / pitfalls

- **`line-dasharray` is not data-driven in MapLibre.** Grade styling has to be
  four filtered layers over one source, not one layer with a `match`
  expression. `ROUTE_LAYER_IDS` exists so callers toggle them as a unit —
  `AtlasMode`'s "Journey routes" checkbox would otherwise hide only one grade.
- `removeAtlasLayers` iterates `Object.values(ATLAS_LAYERS)`, so new layers are
  torn down automatically — but only because they were added to that object.
- The generic-backstop gate is keyed on **citation ids**, not source titles.
  Adding a new whole-atlas reference means adding its id to
  `GENERIC_BACKSTOP_IDS`, or the gate silently accepts it.
- Pleiades' `/search` endpoint sits behind Anubis anti-scraping; the
  `/places/<id>/json` endpoint fetches fine. Verify ids that way.
- **152 `high` claims remain `self-reviewed`, not `scholar-approved`** —
  `build:content -- --release` still fails by design. `docs/review/high-claims-packet.json`
  is the reviewer worklist. Do not bulk-approve it.

## Verification

```
npm run build:content   # ✓ content valid; 893 citations; 0 errors
                        # ⚠ 152 high claims not scholar-approved (expected, blocks --release)
npm run typecheck       # ok
npm test                # 52 passed (content-integrity 10 → 16 tests)
npm run build           # ✓ built
npm run lint            # 2 pre-existing errors, both in untouched files
                        # (useSheetDrag.ts, MapProvider.tsx)
```

New integrity tests were checked for non-vacuity — they inspect 63 high
coordinates, 47 medium/disputed coordinates, 211 entities carrying
`scriptureRefs`, and all 83 route legs.
