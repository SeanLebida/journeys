# TestFlight upload fails after the IPA is accepted

## What changed

- Removed `uses-non-exempt-encryption` from the TestFlight step in `.github/workflows/ios-appstore.yml`.
- Build 144, from `8316ae7`, is the build that carries the Journeys compass. It uploaded, reached `VALID`, and is attached to iOS version 0.3.14. The GitHub job still ended red.

## Why it mattered

`Info.plist` already sets `ITSAppUsesNonExemptEncryption` to false. The upload action then PATCHes `usesNonExemptEncryption` on the processed build. Apple returns 409 `ENTITY_ERROR.ATTRIBUTE.INVALID`: "You cannot update when the value is already set." The action treats that as a failed step even though altool reported `UPLOAD SUCCEEDED`.

## Gotchas / pitfalls

- A red `ios-appstore` run can still mean the IPA is in TestFlight. Check the build in App Store Connect before dispatching again. A second dispatch from a newer commit gets a new build number and does not replace the uploaded one.
- Build 140 is the Capacitor icon. Build 144 is the compass. Do not attach 140 back onto version 0.3.14.
- `wait-for-processing` is what makes the encryption PATCH run. Leaving the plist key in place is enough for export compliance.

## Verification

- Run `38290964720` on `8316ae7`: altool delivery `24704da9-4ae3-4c66-b5cd-ffa33f030fd6`, `cfBundleVersion` 144, then the 409 above.
- `GET /v1/builds?filter[version]=144` returned that id, `processingState` VALID, `usesNonExemptEncryption` false, `expired` false.
- `GET /v1/appStoreVersions/484270fa-f1c5-42b1-8ac7-1a18b4e7a097/build` returns build 144.
