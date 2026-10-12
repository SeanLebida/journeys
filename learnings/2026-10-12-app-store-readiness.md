# App Store readiness without an Apple credential

## What changed

- Raised the iOS deployment target from 13.0 to 15.0 in `ios/App/Podfile` and every `IPHONEOS_DEPLOYMENT_TARGET` in `ios/App/App.xcodeproj/project.pbxproj`.
- Added `ios/App/App/PrivacyInfo.xcprivacy` to the App target (UserDefaults `CA92.1`, no tracking, no collected data types) and wired it into the Xcode project.
- Removed `CODE_SIGNING_ALLOWED=NO` from the Release configuration only. Debug stays unsigned.
- Added `scripts/bump-ios-version.mjs`, `npm run ios:version:bump`, and `.github/workflows/ios-appstore.yml` (`compile-only` or `testflight` on `macos-26` / Xcode 26).
- Wrote `docs/APP_STORE.md` with the secret list, listing copy, age-rating answers, and review notes. Updated `docs/PLATFORM_CHECKLIST.md` and `docs/STORE.md`.

## Why it mattered

App Store Connect has rejected uploads that were not built with Xcode 26 and the iOS 26 SDK since 2026-04-28. Xcode 26 cannot deploy to iOS 13, which is what `cap add ios` wrote. The unsigned scaffold also could not be archived for distribution, and Capacitor Preferences calls `UserDefaults` with no privacy manifest, which App Store Connect rejects.

The upload itself is not possible from this checkout. GitHub secrets are only the Play upload key and service account. There is no `.p8`, distribution certificate, or provisioning profile on disk.

## Gotchas / pitfalls

- Stay on Capacitor 6 for this change. Capacitor 8 is the supported line for new work and defaults to Swift Package Manager, but it also moves the Android Gradle plugin. The Play pipeline is on Capacitor 6 and was left alone.
- Debug `CODE_SIGNING_ALLOWED=NO` is intentional. A Release archive must not inherit it.
- Play phone screenshots are 1080×1920. App Store Connect wants 1320×2868 (or 1290×2796) for iPhone and 2064×2752 for iPad, because the target is universal.
- The previous attempt to add an iOS workflow was rejected by the GitHub token (`repo` without `workflow`). Pushing `.github/workflows/ios-appstore.yml` needs a token that can update workflows.
- `ios:version:bump` rewrites `project.pbxproj` in the CI checkout. Do not commit that rewritten build number from a runner.
- CocoaPods trunk is scheduled to go read-only on 2026-12-02. This app still uses the Podfile. New plugin versions after that date need Swift Package Manager.

## Verification

- Icon file `AppIcon-512@2x.png` is 1024×1024, PNG color type 2 (RGB), no `tRNS` chunk.
- `node --check scripts/bump-ios-version.mjs`.
- No local `xcodebuild`. The signed archive and TestFlight upload were not run. GitHub has no Apple secrets, so dispatching `testflight` would fail the secret check on purpose.
