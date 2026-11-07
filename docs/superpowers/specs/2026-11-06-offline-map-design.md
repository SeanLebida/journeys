# Offline map and journey overlay

Date: 2026-11-06

A journey keeps its path, its stops, and its current-location dot on the map when the device has no signal. The shaded relief the map shows by default is in the install, covering the same biblical stage as the coasts. Satellite, modern streets, the Roman map, video, and the street-level viewer still need a connection, and when they cannot load they leave the bundled map visible.

## Why

On a journey with no data connection, the baseline map was on screen and the view kept moving, while the path and the current location were missing. The app already tells readers that install is enough: the credits say the map is bundled and no connection is required after that. The path and the stops are already in the package. They were never drawn. The terrain shading on by default is a live Esri tile service, so a dead radio also strips the relief off an otherwise offline atlas.

## Goals

- Opening a journey, or travelling between its stops, draws the full path, the stop dots, and the current-location dot on a map that is already open. The camera does not move along the route until that dot is on the map.
- The default terrain layer is a shaded-relief image shipped in the app, for the same extent as the offline basemap (`WORLD_BBOX` in `src/map/graticule.ts`: west −12, south 22, east 50, north 48). It needs no network on the phone or, after the site has loaded once, on the web.
- Terrain stays on by default. The existing topography toggle still shows and hides it.
- Satellite, modern streets, and the Roman map stay optional and online. A failed or unfinished tile request leaves the bundled land, water, and relief visible. It does not block the journey overlay and it does not cover it.
- The Bible, quizzes, journey text, and site photos stay as they are: already in the package.

## Non-goals

- Offline satellite, modern streets, or the Roman Empire map. Those stay online pictures.
- A downloadable region pack, and any use of `useDownloadStore`. Nothing writes that store today, and this work does not start to.
- Scraping or redistributing Esri or DARE tiles.
- A closer relief than the coasts we already ship. Zooming into a city stays soft.
- Offline video or Mapillary. A stop's text still shows when those embeds cannot load.
- Replacing the parchment land, rivers, lakes, or borders with the relief image.

## Anti-goals

- The camera gliding from stop to stop with no path and no current-location dot.
- A one-shot "map has loaded" wait that never runs because the map was already loaded.
- The default map requesting `server.arcgisonline.com` for shaded relief.
- An online picture painting an opaque lid over the path, or a tile error that makes the journey wait.
- Tearing the path down and putting it back on every stop change.

## Constraints

- One map instance, created in `MapProvider`. Do not call `setStyle()`. A full style replace drops the journey layers. Theme changes stay on `applyMapTone`.
- Asset URLs are absolute root paths, passed through `resolveAssetUrl`. Do not use `Capacitor.convertFileSrc` for this file. The phone serves the package from the app origin, the same way it serves glyphs and the content bundle.
- The web service worker precaches `**/*.{js,css,html,wasm,woff2,pbf}` and the content bundle. It does not precache `public/images`. The relief file has to be added to that precache on purpose. Native builds copy `public/` into the app package and do not use the service worker.
- Workbox will not precache a file over 16 MB (`maximumFileSizeToCacheInBytes`). The relief file stays under 2 MB.
- Esri's basemap terms cover the live satellite and street tiles. They are not a license to ship those tiles. Natural Earth is public domain.
- The map zoom +/− controls stay below the status bar (`tests/e2e/zoom_safe_area.spec.ts`).

## Approaches

1. **Fix the overlay only.** Attach the path and the dot whenever a journey is open, and let a failed Esri relief request go transparent. Nothing new ships. The shaded look still needs a signal, so the default map is not the offline atlas the credits describe.
2. **Ship the shaded relief. Chosen.** The same overlay fix, plus a public-domain relief image for the biblical extent, from the same Natural Earth source as the coasts. Satellite, streets, and the Roman map stay online and step aside. This is as far as the install can go offline without a tile license or a multi-hundred-megabyte pyramid.
3. **Download live Esri and DARE tiles for a region.** Rejected. Those services do not grant the right to store their tiles in the app, close zoom makes them huge, and they only help after a download made while online. The promise is that install is enough.

## What shipped relief is

- Source raster: Natural Earth 50m shaded relief, public domain, the same scale family as `scripts/clip-basemap.py` (`ne_50m_*`). Not the 10m raster.
- A generator script next to `clip-basemap.py` downloads that raster, crops it to `WORLD_BBOX`, and writes `public/images/map/hillshade.png`.
- The sea is fully transparent. Land carries grayscale relief. The mask is the same land polygon the basemap already draws, so the relief's coastline matches the parchment. A white or blue ocean in the source must not survive into the PNG. The parchment land color and the existing water colors stay in charge.
- The style source `topography` becomes a MapLibre `image` source. URL from `ASSET_PATHS` via `resolveAssetUrl`, path `/images/map/hillshade.png`. Corner coordinates come from `WORLD_BBOX`, in MapLibre order: northwest, northeast, southeast, southwest. No second copy of the numbers.
- The layer id stays `topography-raster`. Paint stays the opacities `applyMapTone` already sets: 0.35 in light, 0.22 in dark. It remains above the land fill and below the lakes, where the Esri raster sits today.
- The Esri World Shaded Relief tile URL leaves the style. Satellite and streets keep their Esri URLs. The Roman map keeps its DARE URL.
- `MapProvider` today sets `maxZoom` to 13 when topography is on, because that tile service ends at 13. Bundled relief does not. Topography no longer changes `maxZoom`. The Roman map still caps at 11. Satellite and streets still cap at 19.
- The layer control label stays "Topography (terrain)" and does not say "online". It moves from the Imagery category into Geography & Features.
- Credits: the Natural Earth line in `scripts/build-content.ts` gains shaded relief. The Esri line drops shaded relief and keeps satellite and streets.

## What the journey overlay does

The bug is in `src/map/useRouteAnimation.ts`. The effect that calls `ensureTraceLayers` also depends on `currentStopIdx`, and its cleanup calls `removeTraceLayers`. If `map.isStyleLoaded()` is false for a moment, the effect subscribes to `map.once('load')`. That event fires once, when the style is first created. On a map that is already open it does not fire again. The sources stay empty, or the layers are removed and never return. The travel loop still calls `jumpTo` from the in-memory coordinates (`updateTraceProgress` in `src/map/layers/trace.ts` no-ops when the source is missing). The baseline map moves with no path and no dot.

Required behavior:

- One attach function adds the trace sources and layers, writes the full path and the stop dots, and places the traveller marker. `ensureTraceLayers` already refuses to add a second copy. The write always runs, including when the layers were added earlier.
- Attach runs when the journey's coordinates are ready and the style is ready. If the style is not ready yet, listen for `styledata` and attach on the first event where `isStyleLoaded()` is true, then unsubscribe. Do not use `once('load')` as the only signal.
- A change of stop updates the path data and the marker. It does not remove the layers or the marker.
- Layers and the marker are removed when the journey view unmounts, or when the coordinate set is replaced by another journey. Not on each stop.
- The travel loop calls attach before `updateTraceProgress` and before `jumpTo`. A frame with no marker does not move the camera. The existing escape stays: if there is no map at all, the reader still lands on the destination stop instead of sitting on "Travelling…".

The path is added at the top of the style, above terrain and above the online pictures. The traveller is the existing DOM marker (`.trace-traveler`), which sits above the canvas. Failed picture tiles stay transparent. No new overlay is added on top of the path.

## Online pictures

Satellite, streets, and the Roman map stay default-off, labeled "(online)", and still request their current tile URLs when the reader turns them on. Missing tiles are the transparent holes MapLibre already draws. Do not add an error tile, a solid fill, or a modal. Do not turn the toggle off when the request fails, so a reader who enabled satellite comes back to it when the signal returns. Journey attach does not wait on these sources.

## Tests

- `buildBaseStyle` topography source is an `image` source whose URL is `/images/map/hillshade.png` and whose corners equal `WORLD_BBOX`. The style JSON contains no `World_Shaded_Relief` URL. Satellite, streets, and the Roman map URLs are unchanged.
- `public/images/map/hillshade.png` exists, is non-empty, and is under 2 MB. A pixel sample in the sea is transparent, and a pixel sample on land is not. The generator's land mask is what makes the sea transparent. Sample land at Jerusalem (35.23°E, 31.78°N) and sea in the eastern Mediterranean (33.0°E, 34.0°N). Fail if the sea pixel is opaque or the land pixel is transparent.
- Attach: with `isStyleLoaded()` true, one call writes the path and adds the marker. With `isStyleLoaded()` false, a later `styledata` that finds the style loaded writes the path. A `load` event that never fires does not leave the path empty once the style is loaded.
- Stop index changes do not call `removeLayer` on `trace-full-line`. Unmount does.
- Playwright, against `vite preview`: load the app, open a journey, then `context.setOffline(true)`, and expect `.trace-traveler` to be visible. The service worker precache list for the production build includes `images/map/hillshade.png`.
- `tests/e2e/zoom_safe_area.spec.ts` stays green.

## Left to the builder

- The exact Natural Earth file name and the download URL inside the generator, as long as it is the public-domain 50m shaded relief.
- How the land polygon becomes the PNG alpha, as long as the sea is transparent and the coast matches the basemap.
- PNG encoding settings, as long as the file stays under 2 MB and the alpha test passes.
- Where the attach function lives, as long as `useRouteAnimation` and the tests share it.

## Calls made here

- 50m relief, one image, not a tile pyramid and not 10m.
- Replace the Esri relief source. Do not keep a second, online terrain layer.
- Keep today's relief opacity. Do not retint the parchment.
- Transparent sea, so the overlay cannot haze the water.
- Drop the zoom cap of 13 that existed for the Esri tiles.
- Precache the one PNG. Leave the site-photo runtime cache alone.
