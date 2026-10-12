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

Capacitor 6 project, deployment target **iOS 15** (the oldest target Xcode 26 will build; App Store uploads must use the iOS 26 SDK). `MARKETING_VERSION` **0.3.14** and the committed `CURRENT_PROJECT_VERSION` **113** match `package.json` and the in-repo Android version, not Play closed testing 0.3.15 / versionCode 119. CI (`ios:version:bump`) raises the build number from the git commit count before a signed archive.

Debug keeps `CODE_SIGNING_ALLOWED=NO` for an unsigned simulator compile. Release does not, so an Apple Distribution profile can sign an archive. No camera, location, or photo-library usage strings: the web app does not call those APIs. No tracking SDKs and no push or background modes. `ITSAppUsesNonExemptEncryption` is false. `PrivacyInfo.xcprivacy` declares UserDefaults reason `CA92.1` and no collected data. Paste-ready listing and the secret names are in `docs/APP_STORE.md`.

| Item | Status |
|---|---|
| Capacitor iOS project committed | Done — `ios/` is in git. Pods and the copied web bundle are generated (`pod install` / `cap sync`) |
| `@capacitor/ios` dependency | Done (`^6.2.1`, same line as core and Android) |
| iOS 26 SDK / deployment target 15 | Workflow selects Xcode 26 on `macos-26`. Project and Podfile target 15.0 |
| Privacy manifest + export exemption | Done in the app target |
| Unsigned simulator build | `.github/workflows/ios-appstore.yml` destination `compile-only` |
| Signed archive + TestFlight | Workflow destination `testflight`. Archive and export already succeeded. Upload waits on the App Store Connect app record (`POST /v1/apps` is 403 for this key) |
| App Privacy “Data Not Collected” | Documented. Still has to be confirmed in App Store Connect |
| Screenshots, previews, header, search | Generated in `docs/store-assets/apple/`. Paste order is `LISTING.md`. Play shots stay 1080×1920 and are not for Apple |
| App Review | Listing, review notes, and media are ready locally. Submission waits on the website app record, then a processed TestFlight build attached to 0.3.14 |

## Cross-platform UX gates

| Item | Status |
|---|---|
| Tap rival identification → camera focuses that pin | Done |
| Quiz map-pin peeks sheet so map is tappable | Done |
| POI centered in visible viewport (sheet/rail/sidebar padding) | Done |
| External map links open on native (Cap Browser) | Done |
