# Map borders precision and polygon winding order fix

## What changed
- `src/map/basemap/country-polygons.json`: Re-downloaded 1:10m sovereign country boundaries dataset (incorporating `Palestine` to fill the West Bank/Gaza gaps) and corrected the winding order of all 21 outer rings to counter-clockwise (CCW) according to RFC 7946/MapLibre standards.
- `src/map/basemap/countries.json`: Replaced the legacy coarse 1:110m line segments file with Natural Earth's high-resolution 1:10m Land Boundary Lines dataset (`ne_10m_admin_0_boundary_lines_land.geojson`), filtered to our 17 target countries, and stripped of unneeded metadata.
- `src/map/style.ts`:
  - Reverted the brightened `COUNTRY_COLORS` palette back to its original hex values.
  - Reduced the `country-shading-outline` layer opacity (tapering from 0.12 at low zoom to 0.04 at high zoom) and line width to make internal polygon edges (such as Israel wrapping around the West Bank) near-invisible, while letting the dedicated `country-borders` layer render the actual borders.
- `map_labels_contrast_redesign.md`: Updated the specs and colors documentation.

## Why it mattered
- **Accuracy to the Inch**: Upgrading both the shading boundaries (`country-polygons.json`) and the outline borders (`countries.json`) to the standard 10m Natural Earth dataset ensures the borders are highly accurate to modern standards, removing duplicate line segments and rough approximations.
- **Rendering Artifacts**: Clockwise winding orders of country polygon outer rings were causing MapLibre's `earcut` WebGL triangulator to fail on concave borders, leading to straight diagonal lines cutting across Israel and leaving Jerusalem/east Israel unshaded. Correcting the winding order to standard counter-clockwise (CCW) resolves this rendering glitch.
- **Seamless Contiguous Visuals**: The Israel polygon in Natural Earth wraps around the West Bank. By reducing the outline layer (`country-shading-outline`) opacity and thickness, the internal boundaries where the Israel and Palestine polygons touch no longer draw prominent line markers through the middle of the country, while the dedicated borders layer handles the actual boundaries.

## Gotchas / pitfalls
- **Winding Order Sensitivity**: MapLibre GL JS / earcut requires counter-clockwise winding for outer rings in GeoJSON polygon/multi-polygon features. Check winding order via signed area (Shoelace formula) on any new polygon data.
- **Internal Boundaries**: Since countries like Israel and Palestine share the same purple color in `COUNTRY_COLORS`, overlapping outlines between them will render overlapping boundaries. Rely on the borders line dataset (`countries.json`) rather than the polygon outlines for drawing visible political borders.

## Verification
- Winding order check script verified all 21 outer rings are counter-clockwise.
- Point-in-polygon tests verified that Jerusalem correctly lies inside the Israel polygon and does not fall inside the Palestine polygon.
- Re-ran `npm test` (all 36 unit tests passed).
- Re-ran `npm run build` (production build compiled successfully).
- Verified screenshots to confirm the diagonal line rendering artifact has been resolved.
