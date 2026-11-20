# journeys-web

Serves the Vite web app at `journeys.authentic.how/app` as a Workers static assets project with a path route. The origin (WordPress) keeps the rest of the hostname.

- `wrangler.jsonc` — production Worker `journeys-web` on `journeys.authentic.how/app*`. Do not deploy this until Sean says go.
- `wrangler.staging.jsonc` — `journeys-web-staging` on workers.dev only. No production route, DNS, or custom domain.
- `not_found_handling` is `single-page-application` so `/app` and deep app routes fall back to `index.html`.
- `run_worker_first` is `/app/assets/*` so a missing hashed file returns 404 instead of that HTML shell.
- `retain-previous-assets.mjs` copies the previous build's `dist/assets` files into the new deploy for 24 hours, then the workflow uploads the merged folder.

```bash
npx vite build --base /app/
node cloudflare/journeys-web/retain-previous-assets.mjs --assets-dir dist/assets --retain-dir .web-asset-retain --ttl-hours 24
npx wrangler@4.156.0 deploy -c cloudflare/journeys-web/wrangler.staging.jsonc
```
