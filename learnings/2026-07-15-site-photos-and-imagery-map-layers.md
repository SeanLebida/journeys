# Present-day site photos (Wikimedia Commons) + satellite/streets/Roman-Empire map layers

## What changed
- `scripts/fetch-site-images.mjs` — new re-runnable pipeline: a hand-curated
  `SITE_SOURCES` map (all 58 sites → a Wikipedia article whose lead image shows
  the place today, or an explicit Commons `File:` where the lead image was
  unsuitable) is resolved via the Wikipedia `pageimages` + Commons `imageinfo`
  APIs, license-gated (PD / CC0 / CC BY / CC BY-SA only), downloaded as 960px
  thumbs to `public/images/sites/<siteId>.jpg` (~14 MB total), and described in
  `src/content/siteImages.json` (caption, Commons file, author, license,
  description URL).
- `src/components/SitePhoto.tsx` — `SitePhoto` (photo + caption + author/license
  credit, `onError` hides the whole figure) and `SiteViewLinks` (keyless Google
  Maps URLs-API deep links: satellite `map_action=map&basemap=satellite`,
  Street View `map_action=pano`). Rendered in Atlas site detail
  (`AtlasMode.tsx`), the active Trace timeline stop (`TraceMode.tsx`), and
  lesson steps (`LessonMode.tsx`, via new `stepSiteId` helper). CSS in
  `global.css` (`.site-photo`, `.site-view-links`).
- `src/map/style.ts` — three new default-hidden raster layers + sources:
  `satellite` (Esri World_Imagery), `streets` (Esri World_Street_Map),
  `ancientMap` (DARE imperium tiles, `dh.gu.se/tiles/imperium`, CC BY 4.0,
  maxzoom 11). New `IMAGERY_LAYERS` export names them. They sit above the
  stylized land/water layers and below borders/graticule/content, so enabling
  one swaps the visual basemap while overlays stay readable.
- `src/state/useMapLayersStore.ts` — `IMAGERY_LAYERS` default OFF (everything
  else stays ON); `src/map/LayerPanel.tsx` labels them "(online)".
- `scripts/build-content.ts` — `ATTRIBUTIONS` gains Esri, DARE, and Wikimedia
  Commons entries (rendered on the Credits screen from the bundle).
- `vite.config.ts` — workbox `runtimeCaching` (CacheFirst, `site-photos`,
  100 entries) for `/images/sites/`: photos are cached as viewed, not
  precached, keeping PWA install size unchanged.
- `playwright.config.ts` — optional `CHROMIUM_PATH` env var maps to
  `launchOptions.executablePath` for sandboxes/CI that pre-install a system
  Chromium instead of the exact Playwright-pinned build.

## Why it mattered
- User ask: make the app immersive — show what each place looks like in the
  modern day inside the description panels, and add satellite/aerial,
  street, and historical imagery to the map.
- Photos are treated as **illustrative media, not factual claims**, so they
  deliberately live outside the zod content model / citation accuracy gate
  (`siteImages.json` in `src/content/`, not `content/`). Licensing is still
  enforced in the pipeline, and author + license render beside every photo,
  which is what CC BY/CC BY-SA require.
- Bundling images locally (rather than hotlinking Commons) keeps the
  offline-first principle; the online-only tile layers default OFF for the
  same reason, mirroring the existing online `topography` layer pattern.
- DARE is the "ancient basemap" the M1 comment in `style.ts` always planned
  (`AWMC/CAWM`-family); the CAWM mirror (`cawm.lib.uiowa.edu`) was unreachable
  from the build sandbox, and DARE at `dh.gu.se` is the original, actively
  cited source (Åhlfeldt, CC BY 4.0).

## Gotchas / pitfalls
- Wikipedia/Commons APIs 429 a naive per-site request loop almost immediately:
  the script serializes requests, sleeps 500 ms between sites, and honors
  `Retry-After` with exponential backoff.
- Wikipedia lead images are usually right but not always a photo of the place
  — the first pass returned a 19th-c. Kiepert map for Lystra, a *coin* for
  Ancient Corinth, a labeled route map for Via Egnatia, a planthopper genus
  (!) when searching Commons for "Lystra", and a skyscraper for Alexandria.
  Curation reviewed every returned filename and visually spot-checked the
  risky ones; those sites now pin explicit Commons files. Assume any automated
  "give me an image for X" needs a human/agent eye pass.
- MapLibre `Marker` overwrites a custom element's `aria-label` with
  "Map marker", so the Atlas site-label buttons are NOT reachable by their
  `Show details for <name>` label in Playwright — match on `textContent`
  instead. (Pre-existing a11y quirk worth fixing some day.)
- In the CCR sandbox the headless browser cannot reach external tile servers;
  requests hang ~13 s then `ERR_CONNECTION_RESET`, which delays the map
  `load` event (and `route.abort()` makes MapLibre retry-spam). Fulfilling
  tile routes with `status: 204` is the clean way to fake "no tile" and let
  the map reach `load` fast in tests.
- `pkill -f "vite preview"` from a shell whose own command line contains that
  string kills the shell itself. Use a self-excluding pattern (`[v]ite prev`).

## Verification
- `npm run typecheck`, `npm run lint`, `npm test` (32 tests incl. new
  `style.test.ts` case asserting imagery layers are raster, hidden by default,
  and have attributed https tile sources) — all green.
- `npm run build:content && npm run build` — clean; PWA precache unchanged
  (23 entries, ~12.8 MB; site photos intentionally excluded).
- `CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test tests/e2e/` —
  all 7 e2e pass.
- Manual drive of the production build (Playwright script): Atlas → click
  Ephesos → photo renders from `/images/sites/site-ephesus.jpg` with
  "Photo: Benh LIEU SONG · CC BY-SA 3.0 · Wikimedia Commons" credit and
  working Aerial/Street-side links carrying the site's coordinates; toggling
  each imagery checkbox issued tile requests to World_Imagery /
  World_Street_Map / dh.gu.se respectively (28 tiles each) and stopped when
  unchecked; Trace active stop and lesson step each render their site photo
  (screenshots reviewed).
