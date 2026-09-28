# CI runs from production on current Actions

## What changed

- `.github/workflows/ci.yml` now runs on a push to `production`, a pull request into `production`, or `workflow_dispatch`. The job uses `ubuntu-24.04`, `actions/checkout@v7`, `actions/setup-node@v7`, and Node `22.x`. The steps are unchanged: `npm ci`, typecheck, lint, test, `build:content`, and `build`.
- `.github/workflows/android-aab.yml` stays `workflow_dispatch` only. It uses `ubuntu-24.04`, checkout v7, setup-node v7 on Node `22.x`, setup-java v6, setup-android v4 (still `platform-tools` only), upload-artifact v7, `r0adkll/upload-google-play@v1.1.5` with `tracks`, and action-gh-release v3. The workflow input is still named `track`.
- `docs/PLAY_STORE_TESTERS_GUIDE.md` says to run the release workflow from `development`.

## Why it mattered

The 2026-09-22 CI run `35769135891` and the signed-bundle run `35769135742` warned that checkout, setup-node, setup-java, upload-artifact, setup-android, and action-gh-release target Node.js 20, and that `ubuntu-latest` moves to Ubuntu 26 on 2026-10-19. The bundle run also warned that Play's `track` input is deprecated and that setup-java v4 should move on. Node 20 left the Actions runners on 2026-09-23.

CI was also starting on every push to `development` and `main`. The quality gate belongs on `production`. Feature branches can still be checked with `workflow_dispatch`.

`development` is 57 commits ahead of `main` and `production` (both trees are `84d8093fc52ebcf972a1e6af34c66ec07aa5cfde`, app `0.2.1`). Follow-up pull requests onto those branches copy only `ci.yml`. They do not promote the app. The release workflow stays on `development`, which is `0.3.13` and has `android:version:bump` and `android:release:notes`.

## Gotchas / pitfalls

- A pull request into `development` no longer starts CI. Dispatch the workflow on that branch, or open a pull request into `production`.
- Do not dispatch `android-aab.yml` from `main` or `production`. The file is not there, and those branches lack the release scripts. Do not put `changesNotSentForReview` back, and do not install the Android SDK `tools` package. `minSdkVersion` 24 in `android/variables.gradle` stays.
- The Play upload input is `tracks`. The dispatch form field remains `track`. Setting both action inputs fails. Omitting `tracks` publishes to the Play production track.
- `setup-java` v5 and v6 both run on Node 24. This repo pins v6. The v4 warning text still says "migrate to v5".
- Weekly or other schedules are not part of these workflows. There is no dependency-review job to remove.

## Verification

- On Node v22.23.3, at `a8bdc79`: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` (14 files, 111 tests), `npm run build:content`, and `npm run build` exited 0.
- GitHub Actions confirmation is added when the production-line run finishes.
