# Web app on Cloudflare at /app

## What changed
- Workers static assets serve the Vite build at `journeys.authentic.how/app*` (`cloudflare/journeys-web/wrangler.jsonc`, path route, no custom domain).
- `.github/workflows/web-cloudflare.yml` runs `npx vite build --base /app/` and deploys that worker. The default Vite `base` stays `/`.
- `withBase` and `routerBasename` follow `import.meta.env.BASE_URL`. `resolveAssetUrl` prefixes root-absolute asset paths. The browser router gets that basename. The PWA `start_url` is `.`.

## Why it mattered
- The site already uses the hostname. A custom domain on the worker would take all of `journeys.authentic.how`. A path route leaves the origin in place and serves the app under `/app`.
- Capacitor native builds still need Vite base `/`. Only the web deploy passes `--base /app/`.
- A production push also runs the existing Android and iOS workflows.
- The path route does not replace the rest of `journeys.authentic.how`. On 2026-11-14 the origin root was serving its maintenance page while `/app` came from the worker.

## Gotchas / pitfalls
- Do not set Vite `base` to `/app/` in `vite.config.ts`. Native fetches would miss `/`.
- Do not add `custom_domain` for `journeys.authentic.how`.
- GitHub secret `CLOUDFLARE_API_TOKEN` is required for the Action (Workers Scripts and Workers Routes edit). The workflow stops before install when that secret is empty. It does not run `npm run build`, which uses base `/`.
- `routerBasename` is not passed to `createHashRouter`.

## Verification
- `npm run typecheck`
- `npx vitest run tests/unit/asset-base.test.ts` (6 passed)
- `npm test` (351 passed)
- `npx vite build --base /app/` writes `/app/assets/...` in `dist/index.html`. The built router basename is `/app`.
- Deployed `journeys-web` (version `0e1c400d-c888-43fa-8993-e6e70691b319`) on route `journeys.authentic.how/app*`.
- Live `https://journeys.authentic.how/app/` is the new shell (`/app/assets/index-CyE7t3JU.js`). `/app` redirects to `/app/`. `/app/trace` returns that shell. `/app/dist-content/bundle.json` is version 0.3.30.
