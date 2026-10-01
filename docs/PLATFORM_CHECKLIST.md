# Platform checklist — Journeys (web / Android / iOS)

Shared web UI (Vite + React) with thin Capacitor overlays. Check items that can be completed in-repo without interactive Apple Developer secret pasting.

## PWA / web

| Item | Status |
|---|---|
| `vite-plugin-pwa` precache (app shell + Bible DB + glyphs) | Done |
| Web manifest (`name`, icons, `display: standalone`, theme) | Done |
| Service worker auto-update | Done |
| Offline reload E2E | Done |
| `theme-color` + Apple web-app meta + apple-touch-icon | Done (index.html) |
| HTTPS host for installability | Ops — deploy host |
| Privacy policy URL reachable for stores | Ops — host `PRIVACY.md` |

## Android

| Item | Status |
|---|---|
| Capacitor Android project (`android/`) | Done |
| `minSdk` 24+, target/compile for Play | Done (see `variables.gradle`) |
| INTERNET permission only (no tracking SDKs) | Done |
| R8 / ProGuard release | Done |
| Signed AAB via GH Actions (`android-aab.yml`) | Done when secrets present |
| Play Data safety / privacy declarations | Console (docs in `STORE.md`) |
| Internal / alpha track upload | Workflow + Play Console |
| App icon / splash via `@capacitor/assets` | Partial — `public/icon.svg` source |

## iOS

| Item | Status |
|---|---|
| Capacitor iOS project committed | **Blocked** — no `ios/` in repo; needs macOS + `npx cap add ios` |
| `@capacitor/ios` dependency | Add with iOS project |
| Xcode signing / provisioning | **Blocked** — Apple Developer interactive secrets |
| App Privacy “Data Not Collected” | Documented in `STORE.md` / `PRIVACY.md` |
| ATS / HTTPS-only external opens | Browser plugin for external maps |
| TestFlight upload | **Blocked** — signing |

## Cross-platform UX gates

| Item | Status |
|---|---|
| Tap rival identification → camera focuses that pin | Done |
| Quiz map-pin peeks sheet so map is tappable | Done |
| POI centered in visible viewport (sheet/rail/sidebar padding) | Done |
| External map links open on native (Cap Browser) | Done |
