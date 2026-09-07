# 2026-09-07 — Google Play Store tester release pipeline

## What changed

- Configured Android release signing in `android/app/build.gradle` via `signingConfigs.release`, wired to environment variables (`RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`).
- Generated 4096-bit RSA upload keystore `~/.android/journeys-upload.keystore` with credentials saved to `~/.android/journeys-keystore-credentials.txt` (outside repo, chmod 600).
- Created `scripts/bump-android-version.mjs` for monotonic `versionCode` (matching `git rev-list --count HEAD` or override) and aligning `versionName` with `package.json`.
- Created `scripts/generate-release-notes.mjs` to auto-extract release notes from `CHANGELOG.md` into `android/release-notes/whatsnew-en-US` within Google Play's 500-char limit.
- Created `CHANGELOG.md` and bumped package version from `0.3.11` to `0.3.12`.
- Added GitHub Actions release workflow `.github/workflows/android-aab.yml` for building, signing, drafting GitHub releases, and deploying directly to Google Play Internal testing track.
- Added comprehensive guide `docs/PLAY_STORE_TESTERS_GUIDE.md` covering Google Play Console setup, Data Safety declaration, Internal Testing track configuration, and tester distribution.

## Why it mattered

Google Play requires signed Android App Bundles (.aab) targeting recent Android API levels with monotonic version codes and upload key verification. Having an automated, reproducible pipeline allows moving builds directly into the hands of testers with zero manual build drift or signature mismatches.

## Gotchas / pitfalls

- Keep keystores and password files out of the repository at all costs; use base64 secrets in GitHub Actions and local environment variables for manual builds.
- Google Play Internal Testing does not require Google review approval, making it the fastest track for iterative tester feedback.
- Release notes for Google Play must stay strictly under 500 characters.
