# In-app views: photo galleries, in-map aerial mode, click-to-load Mapillary street-level

## What changed
- `scripts/fetch-site-images.mjs` — new `SITE_EXTRAS` map (16 major sites × 1–2
  curated ground-level/interior Commons files); output shape changed from one
  flat entry per site to `{ images: [...] }` arrays (`siteImages.json`, 77
  images total, ~18 MB in `public/images/sites/`).
- `src/components/SitePhoto.tsx` — `SitePhoto` is now a gallery (prev/next +
  "n / m" counter when a site has multiple photos). New `AerialViewButton`
  ("View from above"): saves the camera, enables the satellite basemap via
  `useMapLayersStore`, and `flyTo`s the app's own map to the site at zoom 16;
  a second tap restores both. New `StreetLevelViewer`: strictly click-to-load
  Mapillary keyless embed (`mapillary.com/embed?lat&lng&z&style=photo`) in an
  iframe with attribution bar + Close. `SiteViews` composes them; the external
  links (`SiteViewLinks`) are demoted to a compact "Open externally" row.
  Atlas/Trace render `SiteViews`; lessons keep the gallery only.
- `PRIVACY.md` — network section now names the opt-in online imagery (Esri,
  DARE tiles while enabled; Mapillary only on tap) and states that bundled
  photos need no network. `scripts/build-content.ts` credits Mapillary.
- CSS: `.site-photo__nav`, `.site-views*`, `.street-viewer*` in `global.css`.

## Why it mattered
- User preference: "as much of the views in the application and less linking
  out." Aerial view now happens on the app's own MapLibre map (satellite layer
  + camera move — no external map at all); street-level imagery renders inside
  the panel via Mapillary's keyless embed; galleries put more of the place on
  screen offline. External links remain only as a small fallback.
- Click-to-load is what keeps the embed compatible with the privacy policy's
  "no trackers / nothing loads until you opt in" stance — verified in the
  browser that zero mapillary.com requests fire before the tap.

## Gotchas / pitfalls
- Changing the `siteImages.json` shape breaks typecheck until the fetch script
  regenerates it — the component casts the JSON import, so code and data must
  land in the same commit. Don't push between the component rewrite and the
  regeneration (the stop-hook nagged; resisting it was correct).
- Mapillary embed is keyless (unlike its JS SDK, which needs a token); Google
  Street View's only keyless embed is the legacy `output=svembed` endpoint
  (301s, undocumented) — not something to build on.
- The aerial button persists `satellite: true` via the store while active; if
  the user navigates away mid-aerial the layer stays on (visible in the
  LayerPanel checkbox, easy to turn off) — accepted trade-off for store-driven
  simplicity.

## Verification
- `typecheck` · `lint` · `npm test` (32) · `build:content` · `build` ·
  7/7 Playwright e2e (`CHROMIUM_PATH=/opt/pw-browsers/chromium`).
- Browser drive of the production build (Ephesus): gallery counter "1 / 3" and
  advance to `site-ephesus-2.jpg`; zero Mapillary requests before opt-in,
  requests present after; "View from above" checked the satellite layer and
  issued 48 World_Imagery tile requests at z16, exit unchecked it; external
  row shows the three compact links. Screenshots reviewed.
