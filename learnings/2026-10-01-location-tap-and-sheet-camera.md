# Location tap + POI visible-viewport camera

## What changed
- Rival identifications gained a **Find on map** control (`SiteCandidates`) so tapping actually focuses that coordinate on Atlas/Trace.
- MapLibre padding now tracks the mobile sheet, landscape rail, and desktop sidebar (`viewportPadding` + `useMapViewportPadding`) so easeTo/flyTo center a POI in the uncovered viewport; snap changes reframe the current center.
- Quiz map-pin arms by peeking the sheet so the map is tappable.
- External aerial/Street View links use `@capacitor/browser` on native.
- PWA metas in `index.html`; `docs/PLATFORM_CHECKLIST.md`.

## Why it mattered
- Rival list looked interactive but had no handler — QC “tap to find location”.
- Camera centered in the full canvas, burying places under the half/full sheet — QC “POI in visible area”.

## Verification
`npm run typecheck && npm run lint && npm test`
