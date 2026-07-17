# Israel's borders rendered as Israel defines them

## What changed
- `src/map/basemap/countries.json`:
  - Tagged the six line features that form the shared edge between the Israel
    polygon and the West Bank/Gaza polygons (the 1949 armistice "Green Line",
    the Gaza perimeter, and the Jerusalem-area boundary segments) with
    `class: "armistice"` so they can be styled separately from international
    borders. The features were identified programmatically by comparing each
    line's coordinates against the point sets of the Israel and West Bank/Gaza
    polygon rings (all six match both polygons' edges exactly).
  - Removed the stray feature that traced the eastern (Syrian-side, "Bravo")
    limit of the UNDOF zone east of the Golan Heights. It belonged to neither
    the Israel nor the Syria polygon edge and rendered as a phantom second
    border floating inside Syria. Israel's defined boundary — the 1974
    disengagement line, which both the Israel and Syria polygons share — is a
    separate feature and remains.
- `src/map/basemap/country-polygons.json`: Renamed the `Palestine` feature to
  `West Bank & Gaza`, matching the app's editorial stance of showing borders as
  Israel defines them (Israel does not recognize a foreign state in these
  territories; it defines them as disputed).
- `src/map/style.ts`:
  - Renamed the `Palestine` key in `COUNTRY_COLORS` to `West Bank & Gaza`
    (same purple as Israel, cohesive Levant shading).
  - Added `NOT_ARMISTICE` / `IS_ARMISTICE` filters. The solid
    `country-borders`, `country-borders-casing`, and `country-borders-shading`
    layers now exclude armistice-class lines; a new `armistice-line` layer
    renders them dashed (`[3, 3]`), thinner, and at lower opacity.
  - `applyMapTone` and `applyMapBorders` keep the new layer's color in sync
    with theme flips and basemap switches.
- `src/map/MapProvider.tsx`:
  - Synced `armistice-line` visibility with the country-borders toggle.
  - Added a click popup for the dashed armistice line explaining what the 1949
    Green Line is and why it is dashed, and added the layer to the
    pointer-cursor hover set.
  - Rewrote the Israel popup: borders shown as Israel defines them — Golan
    Heights inside Israel (Golan Heights Law, 1981), united Jerusalem
    (Jerusalem Law, 1980), and the armistice lines not defined as
    international borders.
  - Rewrote the former Palestine popup as "West Bank & Gaza" (Judea & Samaria
    and the Gaza Strip, disputed territories bounded by the armistice lines).

## Why it mattered
- The app's editorial focus is the historical and biblical geography of the
  land of Israel, and the requirement is to show Israel's borders where Israel
  defines them, ahead of the UN cartographic position.
- Verification showed the Natural Earth 10m "de facto" polygons already place
  the Israeli-controlled Golan (Katzrin, Majdal Shams) and East Jerusalem
  (Old City, Western Wall) inside the Israel polygon up to the 1974
  disengagement line — so the polygon geometry needed no reshaping. What
  misrepresented Israel's definition was the styling: the Green Line rendered
  identically to full international borders, a phantom UNDOF line floated in
  Syria, and the popups described Israel as bounded by the Green Line.

## Gotchas / pitfalls
- MapLibre `line-dasharray` is not data-driven, so armistice lines cannot be
  dashed via an expression on the existing layer — they need their own layer
  plus a `filter` on the solid layers. `['!=', ['get','class'], 'armistice']`
  evaluates true for features with no `class` property, so untagged borders
  keep rendering without touching the other 69 features.
- Any rewrite of the basemap JSON must preserve outer-ring CCW winding
  (earcut artifact risk — see 2026-07-17-2115 learning). Re-verified 0 CW
  outer rings after the edit.
- The Jerusalem-area segments are tagged `armistice` for styling purposes even
  though the eastern arc is technically the annexed municipal boundary rather
  than the 1949 line itself; the popup text covers both.

## Verification
- Point-in-polygon: Katzrin and Majdal Shams (Golan), Old City and Western
  Wall (East Jerusalem), Tel Aviv → Israel; Ramallah, Gaza City → West Bank &
  Gaza.
- Winding order: all outer rings still CCW after rewrite.
- Coordinate-set check: all 6 armistice-tagged lines lie exactly on the shared
  Israel ↔ West Bank/Gaza polygon edges; the removed UNDOF line lay on neither.
- `npm test`: 36/36 unit tests pass. `npm run build`: production build OK.
