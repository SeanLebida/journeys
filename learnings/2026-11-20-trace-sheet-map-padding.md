# Opening Trace covered the map with the sheet

## What changed
- `src/map/useMapViewportPadding.ts` — a `MutationObserver` on `.app-main` reapplies map padding when the `.mode-panel` element is replaced, and rebinds the `ResizeObserver` to the new panel.
- `src/map/MapProvider.tsx` — the opening `fitBounds` uses `computeMapPadding()` instead of a fixed 24px inset.
- `src/map/assetUrls.test.ts` — fails if `src/map` source (not tests) contains a root-absolute `/images/`, `/fonts/`, `/data/`, `/dist-content/`, or `/badges/` URL, or `fetch('/...')`.
- `src/map/style.test.ts` — glyph and hillshade URLs are asserted through `resolveAssetUrl`.
- `tests/e2e/trace_map_app.spec.ts` and `playwright.app.config.ts` — phone viewport against `vite build --base /app/` (`npm run test:e2e:app`).
- `package.json` — `test:e2e:app`. `.gitignore` — `dist-app/`.

## Why it mattered
- On a phone, Home is a page card (`computeMapPadding` uses no sheet inset) and the map is fitted to the full canvas. Trace then mounts a half-height sheet over that same canvas. The snap stays `half`, and `.app-main` does not change size, so `useMapViewportPadding` never ran again. Rome sat near y=418 while the sheet started at y=397, so the visible map was dark sea plus a thin strip of the northern coastline. Direct `/trace` looked fine because the map was created with the sheet already in the DOM.
- `setPadding` is what moves the geographic center into the uncovered area. It is MapLibre `jumpTo` and calls `stop()`, so the observer applies it only when the measured padding changes. Edits inside the same panel element do not call it.
- The hillshade URL in the `/app` bundle is the string `"/images/map/hillshade.png"` passed through `withBase("/app/", …)`, which requests `/app/images/map/hillshade.png` (200 on the live site and in the `/app` preview). A root-absolute URL in map source would skip that and hit the WordPress 404 at `/images/...`. The new unit test keeps that from landing in `src/map`.

## Gotchas / pitfalls
- Do not call `setPadding` on every subtree mutation. Journey arrival eases are aborted by it (`2026-11-14-trace-skip-camera.md`). Compare padding, and ignore mutations that keep the same `.mode-panel` node.
- Vite rewrites root-absolute `url('/fonts/...')` in CSS and the font preloads in `index.html` when the build passes `--base /app/`. JS strings are not rewritten. Public assets fetched from map code go through `resolveAssetUrl`.
- `playwright` `page.goto('/trace')` ignores a `baseURL` path. The `/app` spec uses `page.goto('.')`.
- `npm run test:e2e:app` needs `npx vite build --base /app/ --outDir dist-app` first. The default `npm run test:e2e` still previews the base `/` `dist/`.

## Verification
- Reproduced on the pre-fix `/app` build, viewport 412×915, touch, dark: Home → Trace left reference cities at y=418–510 under the sheet. After the fix they sit at y=154–259, above the sheet. No failed asset requests; hillshade is `/app/images/map/hillshade.png`.
- `npx vitest run` — 378 passed.
- `npm run lint` and `npm run typecheck` passed.
- `CHROMIUM_PATH=/usr/bin/google-chrome npx playwright test -c playwright.app.config.ts` — 1 passed.
- `npm run build` (base `/`, native/default). The phone check used `npx vite build --base /app/ --outDir dist-app`.
