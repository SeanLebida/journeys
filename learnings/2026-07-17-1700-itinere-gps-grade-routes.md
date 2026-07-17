# GPS-grade land routes: snapping legs to the Itiner-e Roman-road dataset

## What changed
- `scripts/route-on-itinere.py` (new) — routes every land/turnaround leg on
  the Itiner-e network (de Soto, Pažout, Brughmans et al. 2025, Scientific
  Data; CC BY 4.0; Zenodo 10.5281/zenodo.17122148; 14,769 surveyed segments):
  clip to WORLD_BBOX, build a graph (~160 m endpoint-merge grid closes
  digitization gaps; 7,869 nodes / 11,319 edges), A* shortest path between the
  nearest network nodes to each stop (snap ≤ 20 km), accept when detour ≤
  2.8× great-circle. Output keeps EXACT stop coordinates as endpoints and is
  DP-simplified to ~55 m. Run order: gen-route-paths.py (curated baseline) →
  route-on-itinere.py (upgrade).
- Result: 37/44 land legs on real road geometry (~8,200 route points, bundle
  371 KB). The 7 keeps are honest: sea-adjacent island start (Patmos),
  southern Mesopotamia (Ur→Haran predates Rome by two millennia), the Sinai
  wilderness, and two intra-city hops.
- Build gate endpoint tolerance tightened 25 km → 5 km (generators emit exact
  endpoints; tolerance only guards hand-edit drift). Itiner-e added to
  ATTRIBUTIONS (CC BY requires credit) and cited on every route.

## Why it mattered
- User: "be precise to the GPS standards of today" — curated ±10-20 km
  corridors were sketches; Itiner-e is the field's current best surveyed
  geometry, and it's CC BY (unlike DARMC/AWMC roads, which are NC-licensed
  and app-store-risky).

## Gotchas / pitfalls
- **Itiner-e's GeoJSON is EPSG:3395** (World Mercator, meters, with a third
  elevation coordinate) despite being .geojson — routing silently found zero
  matches until reprojected (ellipsoidal inverse Mercator, iterate phi).
  Symptom to recognize: every snap distance returns exactly the max radius.
- The dataset is segment-based but not perfectly noded; merging endpoints on
  a ~160 m grid is what makes the graph routable. Tighter grids fragment the
  network; looser ones distort junctions.
- Keep the 78 MB source out of the repo — the script takes its path as an
  argument (cache: Zenodo download); regeneration is reproducible from the
  DOI.
- Endpoint-exactness is what allowed tightening the gate to 5 km; if a
  generator ever emits network-node endpoints instead of stop coords, the
  gate catches it.

## Verification
- build:content validates all 8 routes at the 5 km gate · typecheck · lint ·
  36 unit tests · build · scrub-to-stop still lands correctly (t=0.5 of
  Paul 2 = Beroea). Visual: Via Egnatia wiggles with real road geometry
  between Philippi-Thessalonica-Beroea; the Ephesus→Caesarea sea lane bends
  past Cyprus. Screenshots reviewed.
