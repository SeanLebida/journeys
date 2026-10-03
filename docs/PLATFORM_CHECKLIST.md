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

Unsigned scaffold only. `MARKETING_VERSION` **0.3.14** and `CURRENT_PROJECT_VERSION` **113** match `package.json` and `android/app/build.gradle` (`versionName` / `versionCode`) on `development`. That is the in-repo app version, not Play closed testing 0.3.15 / versionCode 119, and not a signed App Store build. The target sets `CODE_SIGNING_ALLOWED=NO`. No camera, location, or photo-library usage strings: the Android manifest requests `INTERNET` only, and the web app does not call device camera, geolocation, or the photo library (bundled site photos and the MapLibre camera are not those permissions). No tracking SDKs and no push/background modes. `ITSAppUsesNonExemptEncryption` is false (standard HTTPS only; see `STORE.md`).

| Item | Status |
|---|---|
| Capacitor iOS project committed | Done — `ios/` is in git. `xcuserdata` and `DerivedData` are ignored by `ios/.gitignore`. Pods and the copied web bundle are generated (`pod install` / `cap sync`) |
| `@capacitor/ios` dependency | Done (`^6.2.1`, lockfile 6.2.1, same line as core/Android) |
| Unsigned simulator build | **Not in `.github/workflows` yet.** Pushing that file was rejected: the box OAuth token has `repo` but not `workflow`. The YAML is in the PR body. Not a device or App Store archive |
| Xcode signing / provisioning | **Blocked** — Apple Developer identity still required before App Review |
| App Privacy “Data Not Collected” | Documented in `STORE.md` / `PRIVACY.md` |
| ATS / HTTPS-only external opens | Browser plugin for external maps |
| TestFlight / App Review | **HOLD** — signing does not exist yet |

## Cross-platform UX gates

| Item | Status |
|---|---|
| Tap rival identification → camera focuses that pin | Done |
| Quiz map-pin peeks sheet so map is tappable | Done |
| POI centered in visible viewport (sheet/rail/sidebar padding) | Done |
| External map links open on native (Cap Browser) | Done |
