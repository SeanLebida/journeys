# Full-fidelity route geometry: ~1 m quantization, dataset-limited accuracy

## What changed
- `scripts/route-on-itinere.py`: output simplification `SIMPLIFY_EPS`
  0.0005 (~55 m) → 0.00001 (~1 m, dedup only); network edge-trim DP
  0.0002 (~20 m) → 0.00001; coordinate rounding 4 → 5 decimals (~1.1 m
  grid); `sys.setrecursionlimit(100000)` for the recursive DP at ~1 m eps.
- `scripts/gen-route-paths.py`: curated-leg rounding 3 → 5 decimals — the
  old 3-decimal grid (~110 m) stair-stepped even the hand-curated corridors.
- Regenerated `content/routes.extra.json`: 8,170 → 20,905 points across the
  same 8 journeys / 68 legs (37 Itiner-e land legs, sea lanes + pre-Roman
  corridors curated, 5 intra-city hops straight). Routes file 322 KB →
  857 KB; full content bundle 624 KB raw / 190 KB gzipped.

## Why it mattered
- Goal: waypoint lines "GPS accurate … down to five feet or as accurate as
  possible", everywhere lines are drawn. Measured against the new geometry,
  55% of the surveyed road vertices previously sat >5 m off the drawn line
  (mean 13 m, worst 650 m — whole switchbacks cut off by the 55 m DP pass).
  Now quantization (~1 m DP + ~1.1 m rounding) is below the Itiner-e
  dataset's own digitization accuracy, so the drawn line is as accurate as
  the source allows. Remaining accuracy limit is the dataset itself, not
  our pipeline.
- Coverage audit: trace mode and atlas mode are the only two places the app
  draws lines between waypoints, and both consume the route geometry (with
  straight fallback only for missing data). Quiz and Lesson modes place
  markers only — no lines to fix.

## Gotchas / pitfalls
- Long vertex gaps (max ~6 km) in the output are genuinely straight road
  stretches — DP at 1 m keeps collinear runs as two points, losslessly.
  Don't "fix" spacing by resampling; it adds points, not accuracy.
- Leg endpoints stay 4-decimal — they are the exact site coordinates from
  sites.json, which ship at 4 decimals. The 5-decimal rounding applies to
  route vertices; endpoint-exactness is what the 5 km build gate checks.
- The recursive `dp()` needs a raised recursion limit at ~1 m eps
  (near-collinear runs split deep); default 1000 was fine at 55 m.
- Itiner-e source (78 MB GeoJSON) is not in the repo; re-download from
  Zenodo 10.5281/zenodo.17122148 (`~/.cache/itinere/itinere_roads.geojson`).
  Run order still gen-route-paths.py → route-on-itinere.py.
- MapLibre's geojson source applies its own sub-pixel display simplification
  (default tolerance 0.375 px) — screen-space, zoom-dependent, and lossless
  for the shipped data; no need to touch it.

## Verification
- build:content (8 routes / 68 legs at the 5 km endpoint gate) · typecheck ·
  lint · 36 unit tests · full build · 7/7 Playwright e2e.
- Quantitative: every old vertex lies within 7.4 m of the new line (same
  source, less simplification); 11,363 of 20,483 new vertices recover detail
  the old line missed by >5 m.
- Visual drive (vite preview + Playwright): Paul 2 trace shows the Via
  Egnatia winding through Macedonia (Troas–Samothrake–Neapolis–Philippi–
  Thessalonica–Beroea all bend with the coast and roads); atlas overview
  draws all 8 journeys curved — Rome voyage bends past Crete/Malta, Exodus
  loops the Sinai with the King's Highway detour. No straight chords.
  Screenshots reviewed.
