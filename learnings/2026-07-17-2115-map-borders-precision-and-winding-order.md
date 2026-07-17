# Map borders precision, polygon winding order, and West Bank barrier overlay

## What changed
- `src/map/basemap/country-polygons.json`: Re-downloaded 1:10m sovereign country boundaries dataset (incorporating `Palestine` to fill the West Bank/Gaza gaps) and corrected the winding order of all 21 outer rings to counter-clockwise (CCW) according to RFC 7946/MapLibre standards.
- `src/map/basemap/countries.json`: Replaced the legacy coarse 1:110m line segments file with Natural Earth's high-resolution 1:10m Land Boundary Lines dataset (`ne_10m_admin_0_boundary_lines_land.geojson`), filtered to our 17 target countries, and stripped of unneeded metadata.
- `src/map/basemap/west-bank-barrier.json`: Added a high-fidelity GeoJSON dataset of the Israeli West Bank Separation Barrier, queried from OpenStreetMap (relation 1410327) and simplified to WGS84 coordinates.
- `src/map/style.ts`:
  - Reverted the brightened `COUNTRY_COLORS` palette back to its original hex values.
  - Reduced the `country-shading-outline` layer opacity (tapering from 0.12 at low zoom to 0.04 at high zoom) and line width to make internal polygon edges (such as Israel wrapping around the West Bank) near-invisible, while letting the dedicated `country-borders` layer render the actual borders.
  - Added source and layer specifications for the West Bank separation barrier, styled as a dashed brown line with a dark casing to visually distinguish it from the solid political borders.
- `src/map/MapProvider.tsx`:
  - Synced the visibility of the West Bank barrier layer and its casing with the modern country borders toggle state.
  - Upgraded map click event listeners to support interactive details for the country shading layer, adding specific boundary details defining the 1949 Green Line and Separation Barrier for both Israel and Palestine (West Bank/Gaza).
  - Added interactive click support directly on the Separation Barrier line layer (`wb-barrier`) to explain construction dates and routing deviations.
  - Replaced the discrete layer mouse enter/leave listeners with a unified, high-responsiveness mousemove listener covering both country shading and separation barrier elements to correctly toggle the pointer cursor.
- `map_labels_contrast_redesign.md`: Updated the specs and colors documentation.

## Why it mattered
- **Accuracy to the Inch**: Upgrading both the shading boundaries (`country-polygons.json`) and the outline borders (`countries.json`) to the standard 10m Natural Earth dataset ensures the borders are highly accurate to modern standards, removing duplicate line segments and rough approximations.
- **Rendering Artifacts**: Clockwise winding orders of country polygon outer rings were causing MapLibre's `earcut` WebGL triangulator to fail on concave borders, leading to straight diagonal lines cutting across Israel and leaving Jerusalem/east Israel unshaded. Correcting the winding order to standard counter-clockwise (CCW) resolves this rendering glitch.
- **Seamless Contiguous Visuals**: The Israel polygon in Natural Earth wraps around the West Bank. By reducing the outline layer (`country-shading-outline`) opacity and thickness, the internal boundaries where the Israel and Palestine polygons touch no longer draw prominent line markers through the middle of the country, while the dedicated borders layer handles the actual boundaries.
- **Physical Completeness**: Adding the separation barrier as a dashed overlay provides a complete representation of modern physical/geographical realities on the ground alongside the historical political Armistice lines (Green Line).
- **Interactive Educational Value**: Providing specific information popups upon clicking the shading/barrier regions defines and clarifies modern border geography for users looking for historical and modern Levant context.

## Gotchas / pitfalls
- **Winding Order Sensitivity**: MapLibre GL JS / earcut requires counter-clockwise winding for outer rings in GeoJSON polygon/multi-polygon features. Check winding order via signed area (Shoelace formula) on any new polygon data.
- **Internal Boundaries**: Since countries like Israel and Palestine share the same purple color in `COUNTRY_COLORS`, overlapping outlines between them will render overlapping boundaries. Rely on the borders line dataset (`countries.json`) rather than the polygon outlines for drawing visible political borders.
- **Barrier Styling**: To avoid confusing the user, the physical barrier is styled with dashes and a distinct brown/tan palette, clearly distinguishing it from political boundary lines.
- **Click Precedence**: The click listener checks the separation barrier (`wb-barrier`) first to allow users to click specifically on the thin line, falling back to the wider country shading regions if missed.

## Verification
- Winding order check script verified all 21 outer rings are counter-clockwise.
- Point-in-polygon tests verified that Jerusalem correctly lies inside the Israel polygon and does not fall inside the Palestine polygon.
- Re-ran `npm test` (all 36 unit tests passed).
- Re-ran `npm run build` (production build compiled successfully).
- Verified click event popups for Israel, Palestine, and the West Bank Separation Barrier.
