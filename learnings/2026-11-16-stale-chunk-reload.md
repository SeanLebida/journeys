# Reload once when a stale web shell points at a missing chunk

## What changed
- `src/platform/staleChunk.ts` detects Vite/browser/router errors for failed dynamic imports, allows one auto-reload guarded by a sessionStorage timestamp, and asks a waiting service worker to `SKIP_WAITING` before reloading.
- Lazy routes in `src/routes.tsx` go through `loadLazyRoute`. `src/main.tsx` listens for Vite's `vite:preloadError` on web only. The route `errorElement` is `RouteErrorScreen` / `StaleChunkScreen` ("Updating Journeys…", then a Reload button if the auto-reload already ran).
- `vite.config.ts` PWA: explicit `skipWaiting` + `clientsClaim` with the existing `registerType: 'autoUpdate'`, and `navigateFallbackDenylist` so missing `/assets/*` and static files are not served as precached `index.html`. Native still does not register the service worker.
- Unit tests cover the reload guard, a failed dynamic import, and the on-brand screen.

## Why it mattered
- After a web deploy, a cached `index.html` (PWA service worker at `/app/sw.js`, or the HTTP cache) can still name hashed chunks from the previous build, such as `BibleMode-DozS4v9R.js`. The host then serves `index.html` (`text/html`) for that URL, and React Router shows "Unexpected Application Error! error loading dynamically imported module".
- Auto-reload has to be once-only: a broken build plus an unguarded `location.reload()` loops. The timestamp guard blocks a second auto-reload for 15s; the user can still tap Reload.
- Navigations must keep using the precached shell so the web app still works offline. The denylist only stops asset requests from being treated as SPA fallbacks. Do not switch HTML navigations to NetworkFirst.

## Gotchas / pitfalls
- A reload started on this page must not be treated as "already tried" or the screen would show the Reload button while the reload is still in flight. `autoReloadAlreadyTried` ignores an in-memory reload started on the current page.
- Native Capacitor builds ship a fixed bundle and never register the service worker (`if (!isNative())` in `main.tsx`). Leave that gate alone.
- Client-side recovery is not enough on its own. The `/app` host (`cloudflare/journeys-web/wrangler.jsonc`, `not_found_handling: "single-page-application"`) should 404 missing `/assets/*` instead of the SPA fallback, and should keep previous-build assets for about 24h after a deploy.

## Verification
- `npm run lint`
- `npm run typecheck`
- `npx vitest run src/platform/staleChunk.test.ts src/components/StaleChunkScreen.test.tsx` plus the full unit suite
- `npm run build`
