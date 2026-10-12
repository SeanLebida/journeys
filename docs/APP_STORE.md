# App Store submission — Journeys

Bundle ID `how.authentic.journeys`. Marketing version is `package.json` (`0.3.14` today). The build number is `CURRENT_PROJECT_VERSION`, bumped in CI by `npm run ios:version:bump` (git commit count, same rule as Android).

Signing uses the Apple team already enrolled for ToGet. The distribution certificate on that team is named **iPhone Distribution**. The ToGet provisioning profile cannot sign this app. Journeys has its own App Store profile, `Journeys App Store`, for `how.authentic.journeys`.

This API key can register bundle ids, certificates, and profiles. It cannot create the App Store Connect app record (`POST /v1/apps` returns 403). Create that record once in the website before TestFlight will accept a build.

## What the project already satisfies

| Requirement | Where |
|---|---|
| Built with the iOS 26 SDK | `.github/workflows/ios-appstore.yml` on `macos-26`, Xcode 26 |
| Deployment target iOS 15 | `ios/App/Podfile` and `project.pbxproj` (Xcode 26 cannot target iOS 13) |
| Encryption exemption | `ITSAppUsesNonExemptEncryption` = false in `ios/App/App/Info.plist` |
| Privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy` — no tracking, no collected data, UserDefaults reason `CA92.1` (Capacitor Preferences) |
| 1024 icon, no alpha | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` |
| Release signing allowed | Release config no longer sets `CODE_SIGNING_ALLOWED=NO`. Debug stays unsigned so `compile-only` still builds |
| Offline value for Guideline 4.2 | Review notes below |

## One-time Apple setup

1. Enroll the Apple Developer Program for the Authentic How team ($99/year) if it is not already active.
2. App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys. Create a key with **Admin** (or App Manager plus access to Certificates). Download the `.p8` once. Record the Issuer ID and Key ID.
3. Certificates, Identifiers & Profiles:
   - Identifier: explicit App ID `how.authentic.journeys` (no capabilities beyond the defaults; no Push, no Sign in with Apple).
   - Certificate: **Apple Distribution**.
   - Profile: **App Store** distribution profile for that App ID. Name it `Journeys App Store`.
4. App Store Connect → Apps → New App. Platform iOS. Name `Journeys: Biblical Atlas`. Bundle ID `how.authentic.journeys`. SKU `how.authentic.journeys`. User access: full.

Encode the certificate and profile (the `.p8` is pasted as text, not base64):

```bash
base64 -w0 distribution.p12
base64 -w0 Journeys_App_Store.mobileprovision
```

GitHub → SeanLebida/journeys → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | base64 of the `.p12` |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | password for that `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | base64 of the `.mobileprovision` |
| `APPSTORE_ISSUER_ID` | issuer UUID |
| `APPSTORE_KEY_ID` | key id (10 characters) |
| `APPSTORE_PRIVATE_KEY` | full `.p8` file, including the BEGIN/END lines |

`APPLE_TEAM_ID` is not required. The workflow reads the team from the profile.

## Ship the binary

After this workflow file is on `production` (or dispatch it from the branch that contains it):

Actions → **iOS App Store** → Run workflow.

- `compile-only` — unsigned simulator build on the iOS 26 SDK. No Apple secrets.
- `testflight` — signed IPA, artifact, and TestFlight upload. Waits until Apple finishes processing.

The first TestFlight build needs the app record from the step above. Export compliance is already in the Info.plist, and the upload sets `usesNonExemptEncryption=false`.

## Paste into App Store Connect

**Name:** `Journeys: Biblical Atlas`

**Subtitle:** `Cited offline Bible atlas`

**Primary category:** Education. **Secondary:** Reference.

**Price:** Free. No in-app purchases.

**Age rating:** 4+. Answer None for cartoon violence, realistic violence, sexual content, profanity, horror, medical, substances, gambling, contests, and unrestricted web access. The app names historical battles and conquests in educational text and does not depict them. If the form asks about violent themes separately, answer Infrequent/Mild. No user-generated content shared with other users (notes stay on device). No ads, no messaging, no loot boxes, no parental controls, no age assurance.

**App Privacy:** Data Not Collected. Tracking: No. The privacy policy matches `PRIVACY.md`.

**Privacy policy URL:** `https://github.com/SeanLebida/journeys/blob/development/PRIVACY.md`

**Support URL:** `https://github.com/SeanLebida/journeys`

**Support email:** `auth@authentic.how`

**Copyright:** `2026 Authentic How`

**Keywords:**

```text
bible,atlas,scripture,maps,history,jesus,paul,geography,timeline,archaeology,exodus
```

**Promotional text:**

```text
Offline atlas of the biblical historical record, from the patriarchs and Old Testament battles through the birth and ministry of Jesus and the apostles.
```

**Description:** use the full description in `docs/STORE_LISTING.md`.

**What's new:** the current section of `CHANGELOG.md`.

**Review notes** (Guideline 4.2 — not a thin website wrapper):

```text
Journeys is an offline educational atlas. The binary includes a public-domain Bible (KJV and ASV) in an on-device SQLite database, offline map tiles, journey routes, lessons, and quizzes. No account is required. The app collects no data.

Optional network use, only after a tap: satellite and historical map tiles, one Mapillary view, one YouTube video, or a citation opened in the system browser. Nothing is loaded until the reader opts in.

Sign-in is not required. Please review the bundled content without an account.
```

**Sign-in information:** leave blank. All functionality is available without an account.

**Screenshots.** The Play assets under `docs/store-assets/phone/` are 1080×1920. App Store Connect rejects that size. This target is universal (`TARGETED_DEVICE_FAMILY` 1,2), so both sets are required:

| Device | Accepted portrait size |
|---|---|
| iPhone 6.9-inch | 1320×2868 or 1290×2796 |
| iPad 13-inch | 2064×2752 |

Capture at least three: home, route trace, timeline. Bible, lessons, and the sandbox atlas match the Play set. Upload those in the App Store Connect media manager before you submit. TestFlight itself does not need them.

## Submit for review

1. Wait until the TestFlight build shows **Ready to Submit** (the workflow waits for processing).
2. Attach that build to version `0.3.14` (or whatever `MARKETING_VERSION` the workflow printed).
3. Complete the screenshot slots, age rating, and App Privacy if the form still shows them empty.
4. Add for Review. Release manually after approval. Do not use phased release for a first version.

Content rights: KJV and ASV are public domain. MapLibre is BSD-3. Attribution is on the in-app Credits screen. Details are in `docs/STORE.md`.
