# Map tap detail: dismiss + stacking (2026-10-01)

## Symptom
Tapping the map opened a country/feature detail popup that stayed overlaid on other UI, with no clear way to dismiss when moving on.

## Fix
- Drop `.country-border-popup` z-index from 1000 → 8 (below mode sheet / tab bar / layer widget).
- `closeOnMove: true`, `closeOnClick: true`, `closeButton: true` on the MapLibre Popup.
- Empty-map tap calls `popup.remove()` so a leftover detail cannot linger.

## Gate
Open detail → pan or tap elsewhere → detail gone; chrome (sheet, layers) stays above the popup.
