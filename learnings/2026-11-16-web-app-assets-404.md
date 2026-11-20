# Missing /app/assets should 404, and previous hashed files should last a day

## What changed
- `journeys-web` stays a Workers static assets project on the path route `journeys.authentic.how/app*`. It is not Pages and not WordPress.
- A small Worker (`cloudflare/journeys-web/src/index.ts`) runs first for `/app/assets/*`. A miss returns 404 instead of the SPA `index.html`. Other `/app` routes still use `not_found_handling: single-page-application`.
- `retain-previous-assets.mjs` merges the previous Vite `dist/assets` into the new deploy for 24 hours after a file last appeared in a build. The web workflow restores that folder from Actions cache.
- Staging is `wrangler.staging.jsonc` (`journeys-web-staging`, workers.dev only). It does not use the production path route.

## Why it mattered
- After a deploy, a tab still holding the old shell asked for `BibleMode-DozS4v9R.js`. The new version no longer had that file, and the SPA fallback returned HTML with a 200, so the import failed.
- Cloudflare does not copy previous versions' asset paths into a new manifest. The new version has to include the files older pages still request.

## Gotchas / pitfalls
- Do not deploy `wrangler.jsonc` (production) without Sean's go.
- Do not put the production route on the staging config. `routes` is inheritable, so staging is a separate file with no `routes` key.
- Do not set a custom domain on `journeys.authentic.how`.
- Vite `base` stays `/` in `vite.config.ts`. Only the web deploy passes `--base /app/`.
- Only retain `dist/assets` (hashed files). Never reuse a previous `index.html`.

## Verification
- `npm test --prefix cloudflare/journeys-web` (9 tests)
- Staging Worker `journeys-web-staging` version `18a726ca-0e24-4258-945a-6a52e066051f` at https://journeys-web-staging.lebidabunch.workers.dev
  - `/app/` and `/app/trace` return 200 `text/html`
  - `/app/assets/nope.js` returns 404 `text/plain`
  - A previous hashed file merged into the new deploy, `/app/assets/BibleMode-DozS4v9R.js`, returns 200 `text/javascript`
- Production `https://journeys.authentic.how/app/` was not changed.
