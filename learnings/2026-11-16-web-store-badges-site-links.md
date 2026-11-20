# Web app: store badges and links to the Journeys website

## What changed
- `src/components/GetTheApp.tsx` (new): a "Get the app" block with the official App Store and Google Play badges, the trademark line, and links to `https://journeys.authentic.how/` and `https://journeys.authentic.how/privacy/`. Shown at the bottom of the home panel (`HomeView.tsx`) and on About (`CreditsView.tsx`).
- `src/platform/storeLinks.ts` (new): site, privacy and store URLs, and `storeOrder(userAgent)` (Google Play first on Android, App Store first everywhere else).
- `public/badges/app-store-badge.svg` and `public/badges/google-play-badge.png`: the official badge files, byte-for-byte as downloaded from Apple and Google.
- `docs/APP_STORE.md`, `docs/store-assets/apple/LISTING.md`: privacy, marketing and support URLs now point at journeys.authentic.how instead of github.io.
- Tests: `src/components/GetTheApp.test.tsx`, a new case in `HomeView.test.tsx`, `tests/e2e/site_links.spec.ts`.

## Why it mattered
- Journeys is approved on both stores. People on the web app had no way to find the native app, the website, or the privacy policy.
- The native build is already the app, so it hides the store badges (`isNative()`), keeps the website and privacy links, and opens them with `openExternalUrl` because `<a target="_blank">` does nothing in the Android WebView.
- On the web the app lives at `/app/` on the same host as the WordPress site, so the site links open in place and only store links open a new tab.

## Gotchas / pitfalls
- Do not edit or recolor the badge files; Apple and Google require unaltered artwork. Google's PNG includes its own clear space, so it is drawn at 58px to match the Apple badge's 40px.
- The site has no support page yet. The listings use the privacy page (it has the support email) as the support URL; change it if `/support/` is added.
- The Play link 404s until the production release is published in Play Console.

## Verification
- `npm run typecheck && npm run lint && npm test` (55 files, 360 tests passed).
- `npm run build`, then `CHROMIUM_PATH=/usr/bin/google-chrome npx playwright test tests/e2e/site_links.spec.ts tests/e2e/smoke.spec.ts tests/e2e/native_bible_links.spec.ts`: the new spec and smoke pass. `native_bible_links` "Trace → opens the tapped journey" fails the same way without this change (expects `?play=1&stop=4`, gets `?stop=4`).
- Mutation check: dropping the `!native` guard fails "hides the store badges"; making `storeOrder` ignore Android fails "puts Google Play first on Android" and the `storeOrder` case.
