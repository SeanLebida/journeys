# Journey lines follow historical routes (roads, caravan arcs, sail lanes)

## What changed
- `RoutePath` content entity (`schema.ts`): per-journey `legs[][]` — one
  [lon,lat] polyline per stop pair, including both endpoints. Validated in
  `build-content.ts`: journey exists, leg count === stops-1, each leg's
  endpoints within 25 km of its stops, every point inside WORLD_BBOX,
  citation closure. Bundled as `routes`.
- `scripts/gen-route-paths.py` — 63 of 68 legs hand-curated with via-points
  along the documented route (5 tiny intra-city hops stay straight):
  Via Egnatia (Amphipolis/Apollonia, Acts 17:1), Via Appia (Forum Appii/Three
  Taverns, Acts 28:15), Via Sebaste, Syrian + Cilician Gates, the interior
  road to Ephesus via the Lycus (Acts 19:1), Acts 20-21/27-28 sailing notices
  (Assos-Mitylene-Chios-Samos; Cos-Rhodes-Patara; lee of Cyprus; Cnidus;
  Salmone-Fair Havens; Cauda and the Adria drift), the Fertile Crescent
  caravan arc for Abraham, the traditional Exodus itinerary + King's Highway
  detour around Edom, and the Judean ridge road. One Chaikin pass softens
  corners; ~830 points total. Each route carries citations + an
  'illustrative between attested waypoints' note.
- `route.ts` — `expandJourneyPath(stopCoords, legs)` returns `{coords,
  stopVertex}` (identity fallback when no route data); `stopFractions` +
  `activeStopFromFractions` replace the coords[i]===stop-i assumption.
- `useRouteAnimation` now takes a `JourneyPath`; active-stop detection and the
  auto-center camera use stop fractions/vertices; playback duration scales by
  STOP count, not vertex count (a detailed path has ~12x vertices).
- `TraceMode` expands the path and passes fractions to the stop labels'
  scrub-to-stop clicks; `atlasRoutesFC` draws the detailed geometry with a
  straight fallback.

## Why it mattered
- User: connecting lines "should follow the actual historical road routes and
  should not be straight lines." Straight chords across the Arabian desert
  (Ur→Haran) or across open water for land legs actively contradicted the
  app's accuracy promise. Routes are historical claims here, so they live in
  content with citations — exactly per the M-water-layers learning that road
  data is citable content, not mechanical basemap.

## Gotchas / pitfalls
- Everything downstream assumed `coords[i]` IS stop i (animation active-stop,
  camera, label scrubbing, playback duration). Splicing detailed legs breaks
  all four at once; the `stopVertex`/`stopFractions` mapping is the seam that
  keeps them truthful, and the build gate's endpoint-proximity check (25 km)
  is what makes the mapping trustworthy from content alone.
- Curated via-points are (lat,lon) in the generator for readability but
  GeoJSON is [lon,lat] — flip exactly once, at output.
- Playback duration scaled by `coords.length` silently became ~12x slower
  with detailed paths; scale by stops.
- Keep leg polylines endpoint-inclusive in content (self-describing,
  validatable) and drop the duplicate first point when flattening.

## Verification
- Gate: typecheck · lint · 36 unit tests (new expandJourneyPath/fractions
  suite) · build:content (8 routes / 68 legs validated) · build · 7/7 e2e.
- Visual drive: Abraham sweeps the Fertile Crescent arc (no desert chord);
  the Rome voyage hugs Crete, drifts to Malta, coasts up Italy and bends
  inland on the Via Appia; Paul 2 threads the Cilician Gates and Via Egnatia;
  scrubbing to t=0.5 lands on Beroea (correct mid-journey stop, proving the
  fraction mapping); Atlas overview shows all 8 curved routes. Screenshots
  reviewed.
