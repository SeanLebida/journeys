# GitHub Pages redirects to journeys.authentic.how

## What changed
- Replaced the public HTML under `docs/` (`index.html`, `about.html`, `about/index.html`, `privacy.html`, `privacy/index.html`, `support.html`, `support/index.html`) with a noindex refresh page that also runs `location.replace`, keeping any `#hash`.
- Added the same redirect as `docs/research/index.html`, `docs/review/index.html`, `docs/store-assets/index.html`, `docs/superpowers/index.html`, and `docs/404.html`. Those directories had no HTML (GitHub Pages returned 404). Markdown, images, and `docs/.nojekyll` are unchanged.
- About pages go to `https://journeys.authentic.how/about/` and support pages to `https://journeys.authentic.how/support/`. Home, privacy, and the paths with no matching public page go to `https://journeys.authentic.how/` or `https://journeys.authentic.how/privacy/`.
- No user-facing `seanlebida.github.io` links remained in the README, `src/`, store docs, or scripts. The only mentions are historical notes in `learnings/`, left as written. `LICENSE` has no Pages URL.

## Why it mattered
- `https://seanlebida.github.io/journeys/` was still a full second website (home, about, privacy, support) beside `https://journeys.authentic.how/`.
- About and support are the matching paths on the main site even though WordPress was still returning 404 for them on 2026-11-20. Privacy and the homepage were already live.

## Gotchas / pitfalls
- Plain `curl` from this environment gets Cloudflare `cf-mitigated: challenge` (HTTP 403) for every `journeys.authentic.how` URL. Origin status had to be read with a Chrome-fingerprint libcurl client (`curl_cffi`), following redirects: `/` 200, `/privacy/` 200 (and `/privacy` 301 to `/privacy/`), `/about/` 404, `/support/` 404, `/routes/` `/timeline/` `/lessons/` 200.
- The GitHub home page is one document. It redirects to the main homepage, not split across `/routes/`, `/timeline/`, and `/lessons/`.
- Research notes, the review packet, store-asset files, and superpowers specs stay at their exact file URLs. Only HTML redirects. `docs/404.html` covers directory URLs that still have no index, such as `store-assets/apple/` and `superpowers/plans/`.
- Do not delete `docs/.nojekyll`. With Jekyll off, Markdown is not turned into extra HTML pages.

## Verification
- Chrome-fingerprint GET, redirects followed, on 2026-11-20: homepage 200, `/privacy/` 200 (`/privacy` is 301), `/about/` 404, `/support/` 404, `/routes/` `/timeline/` `/lessons/` 200. Plain `curl -L` from this environment is HTTP 403 (`cf-mitigated: challenge`) for all of those URLs.
- Served `docs/` locally. `curl` of `/about/` returned the redirect document. Headless Chrome followed the meta refresh from `/support.html` to `journeys.authentic.how/support/`.
- `npm ci`, then `npm run lint`, `npm run typecheck`, `npm test` (57 files, 375 passed), and `npm run build` all succeeded.
