# Oct 7 attack sites, historical Israel border overlays, and the Noah's Ark journey

## What changed
- `src/map/basemap/oct7-attack-sites.json`: Seven point features for the
  October 7, 2023 Hamas-led attack on southern Israel — Nova festival (Re'im),
  Be'eri, Kfar Aza, Nir Oz, Sderot, Nahal Oz, Netiv HaAsara — each with name,
  date, and a per-site casualty summary.
- `src/map/basemap/israel-1949.json` + `mandate-palestine.json`: Generated
  historical-boundary outlines with shapely from the existing country polygons:
  - **Israel 1949–1967 (founding borders)** = current Israel polygon minus the
    Golan (cut along a digitized approximation of the 1949 armistice /
    1923 Mandate line from Metula past Banias to the Yarmouk at El Hamma)
    minus the East Jerusalem bulge (cut along the armistice-tagged Jerusalem
    arc east of lon 35.207, whose closing chord approximates the line that
    divided the city).
  - **Mandate Palestine 1920–1948** = union of (Israel minus Golan) with the
    West Bank & Gaza polygons.
  Both verified by point-in-polygon (Katzrin/Majdal Shams/E. Jerusalem out of
  1949 Israel; W. Jerusalem/Tiberias/Eilat in; Ramallah+Gaza in Mandate,
  Amman out); slivers dropped; simplified at 0.0015°.
- `src/map/style.ts`: Three new `BASEMAP_LAYERS` keys — `borders1949`
  (dashed blue), `mandate` (dashed green), `conflict` (red circles,
  minzoom 6.5) — with sources, layers, theme retoning in `applyMapTone`, and a
  new `DEFAULT_OFF_LAYERS` export (imagery + the two historical overlays).
- `src/state/useMapLayersStore.ts`: Defaults now come from `DEFAULT_OFF_LAYERS`
  so the historical overlays ship OFF (opt-in) while the Oct 7 markers ship ON.
- `src/map/LayerPanel.tsx`: Labels for the three new toggles.
- `src/map/MapProvider.tsx`: Click popups for the Oct 7 markers (per-site
  detail plus the shared context line: ~1,200 killed, ~250 taken hostage,
  start of the Israel–Hamas war) and for each historical overlay; hover cursor
  for all three. Removed the `borders`-store early-returns from the click and
  hover handlers — hidden layers yield no rendered features, so each layer's
  own toggle now gates its own interactivity (this is what lets overlays with
  independent toggles share the handlers).
- `content/*.extra.json`: New **Noah's Ark and the Flood** journey
  (`journey-noah`, kind `patriarchal`, so it lists under "The Patriarchs"):
  - Sites: `site-shuruppak` (Tell Fara, flood-tradition anchor),
    `site-ararat-landing` (primary coordinate Greater Ararat 39.7016/44.2983,
    confidence `disputed` with candidates for Durupınar 39.4406/44.2347 and
    Mount Cudi 37.3639/42.4561), `site-shinar-plain` (Babel/Babylon).
  - Stops 0–2 (build/embark → landing on Ararat → descent to Shinar) with
    scripture refs (Genesis 6:14-16, 7:11-12, 8:4, 8:18-20, 9:12-17, 9:28,
    11:2-4) validated against the KJV verse index.
  - Route with schematic legs (note says so — Scripture records no path for a
    drifting ark) whose endpoints hit the site coordinates exactly.
  - Artifacts: `artifact-durupinar-surveys` (2019 GPR + 2022–2024 soil
    analyses, confidence `disputed` with the geologists' syncline reading in
    the disputes note) and `artifact-shuruppak-flood-layer`.
  - Witness: `witness-gilgamesh-flood` (Tablet XI), with the honest gapNote
    that this witness is *older* than the biblical text's written form.
  - Person `person-noah`; 10 new citations (Wikipedia gazetteer/scholarly
    pages, the Noah's Ark Scans announcements marked not-peer-reviewed, and
    the Collins & Fasold 1996 geology rebuttal).

## Why it mattered
- The user wants the modern conflict context (Oct 7) visible with dates, the
  founding-era boundaries of Israel comparable against today's, and the
  recent Durupınar ark claims in the app as a journey with GPS and scripture
  detail. All three ride the existing systems (layer toggles, popups, the
  content schema's confidence/disputes machinery) rather than new UI.

## Gotchas / pitfalls
- The NE armistice-tagged Jerusalem arc traces the WHOLE Jerusalem salient;
  closing it naively as a polygon swallows West Jerusalem. Clip to points
  east of ~35.207° before closing to isolate the East Jerusalem bulge.
- `content` neutrality gates: `disputed` requires a `disputes` note and ≥1
  citation everywhere (site coordinates claim, stop, artifact); route legs
  must start/end within 5 km of their stops' site coordinates; scripture refs
  must resolve to real KJV verses. Authoring to those constraints up front
  meant the content build passed first try.
- New `BASEMAP_LAYERS` keys are auto-wired for visibility sync (MapProvider
  iterates the map) and for the LayerPanel (iterates keys) — but NOT for
  theme retoning (`applyMapTone`) or default-off state, which need explicit
  entries.
- Persisted layer-store state from existing installs lacks the new keys;
  zustand `persist` merges stored state over defaults, so new keys pick up
  their defaults without a migration.

## Verification
- Point-in-polygon suites for both overlays (all pass; see build script
  output in this change's commit).
- `npm run build:content` valid — 9 journeys, 92 stops, 327 citations, all
  refs resolve. `npm test` 36/36. `npm run build` OK.
