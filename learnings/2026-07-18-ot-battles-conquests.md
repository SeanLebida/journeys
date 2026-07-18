# OT battles & conquests: dated, artifact-cross-referenced, and highlighted on the map

## What changed
- **Schema/pipeline** (`schema.ts`, `build-content.ts`, `useBundle.ts`) — new
  `Battle` entity: kind (battle/siege/conquest/campaign/civil-war/coup/
  deliverance), `combatants` + `outcome`, required `siteId` anchor +
  `locationNote`, a `dateRange` (scholarly ranges), `scriptureRefs` (may be
  empty ONLY for extra-biblical chronology anchors like Qarqar),
  `artifactIds` cross-refs into the Artifact record, and an optional `area`
  polygon ring for map highlighting. Gates: citation closure, neutrality,
  site/artifact referential integrity, scripture resolution, bbox + ring-
  closure checks on areas, dateRange discipline, review gate. New
  `battle`/`battlesForSite` BundleIndex accessors.
- **Content** — committed idempotent `scripts/gen-battles.py` owns
  `content/battles.json`: **38 battles** from the Vale of Siddim to the fall
  of Jerusalem — conquest campaigns (Jericho, Ai, Gibeon/southern sweep,
  Merom/Hazor), Judges deliverances (Deborah, Gideon, the Gibeah civil war),
  Saul/David (Ebenezer, Michmash, Elah, Gilboa, Jebus, Rabbah, Absalom),
  **6 Israel-vs-Judah civil-war entries** (Zemaraim, Ramah, Beth-shemesh,
  Syro-Ephraimite, Gibeah, Absalom), the Aramean wars, Jehu's coup, and the
  Assyrian/Babylonian conquests (Galilee 732, Samaria 722, Lachish +
  Jerusalem 701, Megiddo 609, Carchemish 605, Jerusalem 597 — dated to
  2 Adar by the Babylonian Chronicle — and 586). Upserts **30 new sites**
  (Hazor, Lachish, Megiddo, Gibeon, Elah, Gilboa, Samaria-city, Jezreel,
  Qarqar, Carchemish, Dan, …), **9 new artifacts** (Lachish Reliefs +
  Letters, Kurkh Monolith, Black Obelisk, Khirbet Qeiyafa, Jehoiachin
  tablets, Samaria ostraca, Jericho fallen walls, Hazor burn layer), and
  59 citations. 7 battles carry approximate `area` sweep polygons.
- **Map** — divided-kingdom era overlays: `basemap/kingdoms-iron-ii.json`
  (approximate heartlands, Israel c. 930-722 / Judah c. 930-586 BC) as
  toggleable fills in `style.ts` + LayerPanel + tone theming + MapProvider
  click popups. Atlas: `atlas-battles` circle layer + always-visible ⚔ DOM
  markers (offset left of the site dot), `atlas-battle-areas` faint fill +
  dashed outline, and an emphasized `atlas-battle-area-selected` filter
  layer; battles obey the period slider + confidence filter via their OWN
  date spans (the slider replays the wars in order). Clicking ⚔ opens a
  battle panel (BattleCard + "About this place" hand-off to the site panel).
- **UI** — `BattleCard` in SiteExtras: kind · date · refs meta, combatants,
  outcome, click-to-load passages (shared `ScriptureToggle`, refactored out
  of MiracleCard), 📍 location caveats, and expandable **Corroborating
  finds** rendering full ArtifactCards even when the find is anchored
  elsewhere. Site panels get a chronological "Battles & conquests here"
  section.
- **Tests** — content-integrity validates battles end-to-end (incl. area
  ring closure/bbox and ≥35 battles / ≥4 civil-war floors); component tests
  cover Lachish (finds cross-refs), Beth-shemesh (civil-war meta), and
  Qarqar (no-scripture entry).

## Why it mattered
- Request: OT conquests and battle locations, with scripture, timing,
  artifacts, the Israel-vs-Judah wars, and visual highlighting — "as much of
  those deep real details comprehensively". The design keys:
  - **Chronology honesty**: the conquest is `disputed` with the early/late
    date debate spelled out on every conquest entry; monarchy dates follow
    Thiele; the Assyrian/Babylonian era rides the cuneiform synchronisms
    (Qarqar 853 is included precisely BECAUSE it is extra-biblical — the
    Kurkh Monolith is what fixes Ahab, and the schema lets scriptureRefs be
    empty only for that class of anchor).
  - **Both-sides sourcing** where it exists: Mesha Stele vs 2 Kings 3; Tel
    Dan Stele's Hazael claim vs Jehu's coup (a real tension, carried in a
    disputes note); Sennacherib's prism vs 2 Kings 19.
  - **Highlighting**: per-battle `area` sweeps (campaigns/annexations) +
    the two kingdom-era fills, all labelled approximate.

## Gotchas / pitfalls
- `claimOf`'s zod superRefine requires a `disputes` note on ANY `disputed`
  claim — including site *coordinates*. Seven disputed-identification sites
  failed schema silently in the first run, then cascaded into "unknown
  siteId" errors on their battles. Read the first error block, not the last.
- Headless-drive limitation (this container): the MapLibre map never fires
  'load' under software GL even on unmodified HEAD (0 markers app-wide), so
  DOM-marker features can't be screenshot-verified here. Component tests +
  the field-proven marker pattern are the verification; don't chase it.
- `getByText(/853 BC/)` matched two nodes (meta line + summary); assert on
  the composed meta line ("Pitched battle · 853 BC") instead.
- Battle markers share coordinates with site dots: anchor the ⚔ marker
  'right' with offset [-7,0] (site labels sit anchored 'left' at [7,0]) so
  both stay clickable.
- The `battleAreaSelected` layer must be EXCLUDED from `setAtlasFilter`'s
  loop — its filter IS the selection; the shared year/conf filter would
  clobber it.

## Verification
- `typecheck` · 45 unit/component tests (7 files) · `build:content`
  (110 sites · 38 battles · 30 artifacts · 397 citations; scripture refs
  resolve against the bundled KJV; area rings closed + in bbox) ·
  production `build` · 7/7 Playwright e2e. Generator idempotent.
- `lint`: the same 2 pre-existing errors in untouched files as the previous
  change (useSheetDrag react-hooks rule resolution, MapProvider
  prefer-const) — not introduced here.
