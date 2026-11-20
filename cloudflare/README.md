# Cloudflare Workers

- [`journeys-web`](./journeys-web/README.md) — Vite web app at `journeys.authentic.how/app`. Path route only; the rest of the hostname stays on the origin.
- [`journeys-bible-proxy`](./journeys-bible-proxy/README.md) — YouVersion Platform API proxy for the Bibles the app may read or download. The app key stays in a Worker secret.
