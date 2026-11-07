# Offline Map And Journey Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A journey draws its path, stop dots, and current-location dot on an already-open map with no signal, and the default terrain is a Natural Earth shaded-relief image shipped in the install.

**Architecture:** One committed PNG, cropped from Natural Earth 50m shaded relief to `WORLD_BBOX` and masked by the existing land polygon, replaces the Esri shaded-relief tile source. Journey overlay attachment writes the path in the same call that adds the layers, listens for `styledata` instead of a one-shot `load`, and does not remove those layers when the stop index changes. The travel loop attaches before it moves the camera.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright, MapLibre GL 4, sharp (already a devDependency), Workbox via vite-plugin-pwa.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-06-offline-map-design.md`.
- Do not call `setStyle()`. Do not use `Capacitor.convertFileSrc` for the relief file.
- Do not add a second terrain layer, a tile pyramid, or a region downloader. Leave `useDownloadStore` untouched.
- Satellite, streets, and the Roman map keep their current URLs and stay default-off.
- The relief PNG stays under 2 MB. Sea pixels are transparent. Land pixels are not.
- `tests/e2e/zoom_safe_area.spec.ts` stays green.
- No AI attribution in commit messages.

## File structure

- `src/map/hillshade.ts` — crop math for the 10800×5400 Natural Earth raster. Shared by the generator and the tests.
- `scripts/clip-hillshade.ts` — downloads the raster, crops it, masks the sea, writes `public/images/map/hillshade.png`. Not part of `npm run build`.
- `public/images/map/hillshade.png` — the committed image.
- `src/platform/assets.ts` — `ASSET_PATHS.hillshade`.
- `src/map/style.ts` — topography source becomes an `image` source.
- `src/map/MapProvider.tsx` — topography no longer caps `maxZoom` at 13.
- `src/map/LayerPanel.tsx` — topography moves into Geography & Features.
- `scripts/build-content.ts` — Natural Earth and Esri credit lines.
- `vite.config.ts` — precache the one PNG.
- `src/map/layers/trace.ts` — `attachJourneyTrace` and `attachJourneyTraceWhenReady`.
- `src/map/useRouteAnimation.ts` — call those helpers. Stop changes do not remove layers.
- Tests: `src/map/hillshade.test.ts`, additions to `src/map/style.test.ts` and `src/map/MapLayerControl.test.tsx`, `src/map/layers/trace.test.ts`, `src/map/useRouteAnimation.test.tsx`, `tests/e2e/offline_journey.spec.ts`.
- `learnings/2026-11-06-offline-map.md` — written with the last code commit.

---

### Task 1: Crop math and the committed relief image

**Files:**
- Create: `src/map/hillshade.ts`
- Create: `src/map/hillshade.test.ts`
- Create: `scripts/clip-hillshade.ts`
- Create: `public/images/map/hillshade.png`
- Modify: `package.json` (script only)

**Interfaces:**
- Consumes: `WORLD_BBOX` from `src/map/graticule.ts` (`[west, south, east, north]`).
- Produces:

```ts
export const SHADED_RELIEF_RASTER = { width: 10800, height: 5400 } as const;

export function hillshadeCrop(
  bbox?: BBox,
): { left: number; top: number; width: number; height: number };

export function lonLatToCropPixel(
  lon: number,
  lat: number,
  crop?: { width: number; height: number },
): { x: number; y: number };
```

`hillshadeCrop()` maps longitude −180..180 and latitude 90..−90 onto the 10800×5400 raster, north at the top:

- `left = round(((west + 180) / 360) * 10800)`
- `right = round(((east + 180) / 360) * 10800)`
- `top = round(((90 - north) / 180) * 5400)`
- `bottom = round(((90 - south) / 180) * 5400)`
- size is `right - left` by `bottom - top`

For `WORLD_BBOX` that is left 5040, top 1260, width 1860, height 780.

`lonLatToCropPixel` maps a coordinate into that crop, clamped to the pixel grid. Jerusalem (35.23, 31.78) lands on an interior pixel. The eastern Mediterranean sample (33.0, 34.0) lands on a different interior pixel.

- [ ] **Step 1: Write the failing crop test**

`src/map/hillshade.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hillshadeCrop, lonLatToCropPixel } from './hillshade';

describe('hillshadeCrop', () => {
  it('crops the 50m world raster to WORLD_BBOX', () => {
    expect(hillshadeCrop()).toEqual({ left: 5040, top: 1260, width: 1860, height: 780 });
  });

  it('maps Jerusalem and the eastern Mediterranean onto different interior pixels', () => {
    const land = lonLatToCropPixel(35.23, 31.78);
    const sea = lonLatToCropPixel(33.0, 34.0);
    const { width, height } = hillshadeCrop();
    for (const p of [land, sea]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(width - 1);
      expect(p.y).toBeLessThan(height - 1);
    }
    expect(land).not.toEqual(sea);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/map/hillshade.test.ts`

Expected: FAIL, cannot find `./hillshade`.

- [ ] **Step 3: Implement the crop helpers**

Create `src/map/hillshade.ts` with the formulas above. Default `bbox` is `WORLD_BBOX`. Clamp `lonLatToCropPixel` to `[0, width - 1]` and `[0, height - 1]`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/map/hillshade.test.ts`

Expected: PASS.

- [ ] **Step 5: Generate the PNG**

`scripts/clip-hillshade.ts`, run with `tsx`:

1. Download `https://naciscdn.org/naturalearth/50m/raster/SR_50M.zip` into a temp directory. Unzip. Read the GeoTIFF whose name ends in `.tif`. If sharp reports a width other than 10800 or a height other than 5400, throw.
2. `sharp.extract(hillshadeCrop())` to a raw grayscale buffer.
3. Load `src/map/basemap/land.json`. Even-odd ray cast in longitude/latitude. A pixel is land when its center (the inverse of `lonLatToCropPixel`) is inside the land multipolygon.
4. Join that mask as the alpha channel. Land keeps the grayscale sample. Sea alpha is 0.
5. Write `public/images/map/hillshade.png`. Throw if the file is missing or is 2_000_000 bytes or larger.

Add `"map:hillshade": "tsx scripts/clip-hillshade.ts"` to `package.json`. Run it once. Commit the PNG. Do not commit the zip.

- [ ] **Step 6: Assert the PNG**

Add to `src/map/hillshade.test.ts`. Use sharp to read `public/images/map/hillshade.png`:

- width 1860, height 780, file size under 2_000_000
- alpha at `lonLatToCropPixel(35.23, 31.78)` is greater than 0
- alpha at `lonLatToCropPixel(33.0, 34.0)` is 0

Run: `npx vitest run src/map/hillshade.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/map/hillshade.ts src/map/hillshade.test.ts scripts/clip-hillshade.ts public/images/map/hillshade.png package.json
git commit -m "$(cat <<'EOF'
Ship a bundled shaded-relief crop of the biblical map.

EOF
)"
```

---

### Task 2: Use the image as the topography layer

**Files:**
- Modify: `src/platform/assets.ts`
- Modify: `src/map/style.ts`
- Modify: `src/map/style.test.ts`
- Modify: `src/map/MapProvider.tsx`
- Modify: `src/map/LayerPanel.tsx`
- Modify: `src/map/MapLayerControl.test.tsx`
- Modify: `scripts/build-content.ts`

**Interfaces:**
- Consumes: `ASSET_PATHS.hillshade` = `'/images/map/hillshade.png'`, `resolveAssetUrl`, `WORLD_BBOX`.
- Produces: `buildBaseStyle` source `topography` of type `'image'`. Layer id stays `topography-raster`. Opacities stay 0.35 light and 0.22 dark.

Image-source corners, northwest then northeast then southeast then southwest:

```ts
const [west, south, east, north] = WORLD_BBOX;
coordinates: [[west, north], [east, north], [east, south], [west, south]]
```

- [ ] **Step 1: Write the failing style test**

Add to `src/map/style.test.ts`:

```ts
it('uses the bundled hillshade for topography and keeps the online picture URLs', () => {
  const style = buildBaseStyle('ancient', false);
  const topography = style.sources.topography;
  expect(topography).toMatchObject({
    type: 'image',
    url: '/images/map/hillshade.png',
    coordinates: [[-12, 48], [50, 48], [50, 22], [-12, 22]],
  });
  const json = JSON.stringify(style);
  expect(json).not.toContain('World_Shaded_Relief');
  expect(json).toContain('World_Imagery');
  expect(json).toContain('World_Street_Map');
  expect(json).toContain('dh.gu.se/tiles/imperium');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/map/style.test.ts`

Expected: FAIL, topography is still a raster tile source.

- [ ] **Step 3: Switch the source and the surrounding copy**

- `assets.ts`: add `hillshade: '/images/map/hillshade.png'` to `ASSET_PATHS`.
- `style.ts`: import `WORLD_BBOX`. Set `url: resolveAssetUrl(ASSET_PATHS.hillshade)`. Delete the Esri shaded-relief `tiles`, `tileSize`, `attribution`, and `maxzoom`.
- `MapProvider.tsx`: delete the `else if (layers.topography) maxZoom = 13` branch. When neither the Roman map nor satellite nor streets is on, `maxZoom` is 19. Roman map stays 11. Satellite and streets stay 19.
- `LayerPanel.tsx`: remove `'topography'` from the Imagery keys. Add it as the first key of Geography & Features. Leave the label `Topography (terrain)`.
- `scripts/build-content.ts`: Natural Earth name becomes `Natural Earth (coastlines, land, country boundaries, lakes, rivers, shaded relief)`. Esri name becomes `Esri basemap tiles (World Imagery satellite, World Street Map — optional online layers)`.

- [ ] **Step 4: Extend the layer-control test**

In `MapLayerControl.test.tsx`, inside the existing render test, add:

```ts
const geography = screen.getByRole('heading', { name: 'Geography & Features' }).parentElement!;
const imagery = screen.getByRole('heading', { name: 'Imagery & Historical Maps' }).parentElement!;
expect(geography.querySelector('input[type="checkbox"]')?.closest('label')?.textContent).toContain('Topography (terrain)');
expect(imagery.textContent).not.toContain('Topography (terrain)');
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/map/style.test.ts src/map/MapLayerControl.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/assets.ts src/map/style.ts src/map/style.test.ts src/map/MapProvider.tsx src/map/LayerPanel.tsx src/map/MapLayerControl.test.tsx scripts/build-content.ts
git commit -m "$(cat <<'EOF'
Draw default terrain from the bundled relief image.

EOF
)"
```

---

### Task 3: Precache the relief on the web

**Files:**
- Modify: `vite.config.ts`
- Test: `src/map/hillshade.test.ts`

**Interfaces:**
- Consumes: the PNG path from Task 1.
- Produces: a Workbox `globPatterns` entry that matches only `images/map/hillshade.png`. Do not add a general `png` glob. Leave the site-photo runtime cache as it is.

- [ ] **Step 1: Write the failing assertion**

Add to `src/map/hillshade.test.ts`:

```ts
it('precaches the hillshade file and not every png', () => {
  const config = readFileSync('vite.config.ts', 'utf8');
  expect(config).toContain("'images/map/hillshade.png'");
  expect(config).not.toContain('*.png');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/map/hillshade.test.ts`

Expected: FAIL on the missing path string.

- [ ] **Step 3: Add the glob**

In `vite.config.ts` `workbox.globPatterns`, add the string `images/map/hillshade.png`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/map/hillshade.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/map/hillshade.test.ts
git commit -m "$(cat <<'EOF'
Precache the bundled relief image for offline web.

EOF
)"
```

---

### Task 4: Attach the journey trace in one call

**Files:**
- Modify: `src/map/layers/trace.ts`
- Create: `src/map/layers/trace.test.ts`

**Interfaces:**
- Consumes: `ensureTraceLayers`, `updateTraceStatic`, `ensureTravelerMarker`, `hasLiveStyle`.
- Produces:

```ts
export interface TraceAttachArgs {
  color: string;
  full: LngLat[];
  stops: TraceStop[];
  at: LngLat;
}

export function attachJourneyTrace(map: MapLibreMap, args: TraceAttachArgs): boolean;

export function attachJourneyTraceWhenReady(map: MapLibreMap, args: TraceAttachArgs): () => void;
```

`attachJourneyTrace` returns false, and does not add layers, when `hasLiveStyle(map)` is false or `map.isStyleLoaded()` is false. Otherwise it adds the layers, writes `args.full` and `args.stops`, places the marker at `args.at`, and returns true. A second call writes again and does not add a second layer.

`attachJourneyTraceWhenReady` calls `attachJourneyTrace` immediately. When that returns true, it returns a no-op unsubscribe. When the map has no live style, it returns a no-op and does not subscribe. Otherwise it subscribes to `styledata`, and on each event tries again and unsubscribes after the first success. It never uses `once('load')`.

- [ ] **Step 1: Write the failing tests**

`src/map/layers/trace.test.ts`. Mock `maplibre-gl` before importing the module:

```ts
vi.mock('maplibre-gl', () => ({
  default: {
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      getElement: () => document.createElement('div'),
      remove: vi.fn(),
    })),
  },
}));
```

Fake map: a `style` object so `hasLiveStyle` is true, `isStyleLoaded` starting false, `getLayer` / `addLayer` / `getSource` / `addSource`, and `on` / `off` for `styledata`. `addSource` stores `{ setData }` so the test can read the written GeoJSON.

Cases:

1. Style not loaded: `attachJourneyTrace` returns false and `addLayer` is not called.
2. Style loaded: one call adds `trace-full-line` once, `setData` on `trace-full` contains the two-point line, and `Marker` is constructed.
3. Second call with the style loaded does not call `addLayer` again, and `setData` receives the new line.
4. `attachJourneyTraceWhenReady` while unloaded does not write. Emitting `styledata` after flipping `isStyleLoaded` to true writes the line. Emitting `load` is not required. A second `styledata` does not subscribe twice: `off` was called.

Use a two-point line `[[0, 0], [1, 1]]`, one stop `{ lng: 0, lat: 0, confidence: 'high', reached: false, order: 0 }`, `at: [0, 0]`, color `#c75b39`.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/map/layers/trace.test.ts`

Expected: FAIL, `attachJourneyTrace` is not exported.

- [ ] **Step 3: Implement the two functions in `trace.ts`**

Keep `ensureTraceLayers`, `updateTraceStatic`, `ensureTravelerMarker`, and `removeTraceLayers` as they are. The new functions call them.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/map/layers/trace.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map/layers/trace.ts src/map/layers/trace.test.ts
git commit -m "$(cat <<'EOF'
Attach a journey trace when the map style is already loaded.

EOF
)"
```

---

### Task 5: Stop tearing the trace down on each stop

**Files:**
- Modify: `src/map/useRouteAnimation.ts`
- Create: `src/map/useRouteAnimation.test.tsx`

**Interfaces:**
- Consumes: `attachJourneyTrace`, `attachJourneyTraceWhenReady`, `removeTraceLayers`, `updateTraceProgress` from `src/map/layers/trace.ts`.
- Produces: no new export. `useRouteAnimation` keeps its current signature.

Behavior:

- A ref holds the latest `{ color, full: coords, stops, at }`. `stops` is the existing map of `stops` with `reached: i <= currentStopIdx`. `at` is `coords[path.stopVertex[currentStopIdx]]` when that vertex exists.
- One effect depends on `mapRef`, `ready`, `coords`, `color`, and `path`. It does not depend on `currentStopIdx`. It calls `attachJourneyTraceWhenReady` and its cleanup only unsubscribes. It does not call `removeTraceLayers`.
- A second effect depends on `coords`. Its cleanup calls `removeTraceLayers`. Unmount and a new coordinate array remove the layers. A stop change does not, because `path` is memoized in `JourneyTrace` without `currentStopIdx`.
- The existing static-update effect stays, so a stop change still rewrites the reached dots when the layer is already present. The styledata callback reads the ref, so a late attach writes the current stop rather than the first render.
- In the travel `tick`, call `attachJourneyTrace(map, argsRef.current)` before `updateTraceProgress` and before `jumpTo`. If it returns false, skip `jumpTo` for that frame and keep the animation frame scheduled. The branch that lands the reader when `map` is missing or `ready` is false stays as it is.

- [ ] **Step 1: Write a failing hook test**

Create `src/map/useRouteAnimation.test.tsx`. Mock `./MapProvider` so `useMap` returns `{ mapRef, ready: true }` with a fake map whose `isStyleLoaded` returns true and whose `style` is `{}`. Mock `./layers/trace` and record calls to `removeTraceLayers`, `attachJourneyTrace`, and `attachJourneyTraceWhenReady`. `attachJourneyTrace` returns true. `attachJourneyTraceWhenReady` returns a vi.fn unsubscribe.

Render the hook with `renderHook` from `@testing-library/react`. Pass a `JourneyPath` whose `coords` is a stable array `[[35, 32], [36, 33]]` and whose `stopVertex` is `[0, 1]`. Pass two stops and two stop ids. Use `useJourneyStore.getState().setCurrentStopIdx` between two `rerender` calls with the same path.

Expected: `removeTraceLayers` is not called after the stop-index change. `removeTraceLayers` is called after `unmount`. `attachJourneyTraceWhenReady` was called. The source of `useRouteAnimation.ts` does not contain `once('load'`.

Run: `npx vitest run src/map/useRouteAnimation.test.tsx`

Expected: FAIL, because the current effect still removes the layers when `currentStopIdx` changes.

- [ ] **Step 2: Change the hook as specified**

Do not change durations, zoom, or the co-located pulse. The co-located pulse may `jumpTo` only after `attachJourneyTrace` returns true. If it returns false, skip that frame's camera write.

- [ ] **Step 3: Run the trace unit tests and the typecheck**

Run: `npx vitest run src/map/useRouteAnimation.test.tsx src/map/layers/trace.test.ts src/map/style.test.ts && npx tsc --noEmit`

Expected: PASS, and `tsc` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add src/map/useRouteAnimation.ts src/map/useRouteAnimation.test.tsx
git commit -m "$(cat <<'EOF'
Keep the journey path on the map across stop changes.

EOF
)"
```

---

### Task 6: Offline journey check, and the learning note

**Files:**
- Create: `tests/e2e/offline_journey.spec.ts`
- Create: `learnings/2026-11-06-offline-map.md`
- Modify: `learnings/README.md` only if a new index line is required by the existing index format. Read it first. Keep its existing entries.

**Interfaces:**
- Consumes: route `/trace/journey-paul-1`, marker class `trace-traveler`, the production service worker from `vite preview`.

- [ ] **Step 1: Write the e2e**

```ts
import { expect, test } from '@playwright/test';

test('a journey shows the traveller after the connection drops', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, { timeout: 15_000 });
  await context.setOffline(true);
  await page.goto('/trace/journey-paul-1');
  await expect(page.locator('.trace-traveler')).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 2: Run it**

The preview server must be serving a build that includes this branch. Run:

`npm run build && npx playwright test tests/e2e/offline_journey.spec.ts tests/e2e/zoom_safe_area.spec.ts`

Expected: both PASS. `build` runs `build:content` and `tsc`. If the service worker does not claim the page in 15 seconds, confirm `images/map/hillshade.png` is in `dist/` and that the precache manifest inside `dist/sw.js` names it, then fix the glob rather than lengthening the timeout.

- [ ] **Step 3: Write the learning note**

`learnings/2026-11-06-offline-map.md` with the sections `## What changed`, `## Why it mattered`, `## Gotchas / pitfalls`, `## Verification`. Record the missed `load` event, the Esri relief URL leaving the default style, the transparent-sea mask, and the commands from Step 2.

- [ ] **Step 4: Run the unit suite**

Run: `npx vitest run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/offline_journey.spec.ts learnings/2026-11-06-offline-map.md learnings/README.md
git commit -m "$(cat <<'EOF'
Show the journey traveller when the device is offline.

EOF
)"
```

Include `learnings/README.md` only if Step 3 changed it.
