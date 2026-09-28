# CI runs from production on current Actions

## What changed

- `.github/workflows/ci.yml` now runs on a push to `production`, a pull request into `production`, or `workflow_dispatch`. The job uses `ubuntu-24.04`, `actions/checkout@v7`, `actions/setup-node@v7`, and Node `22.x`. The steps are unchanged: `npm ci`, typecheck, lint, test, `build:content`, and `build`.
- `.github/workflows/android-aab.yml` stays `workflow_dispatch` only. It uses `ubuntu-24.04`, checkout v7, setup-node v7 on Node `22.x`, setup-java v6, setup-android v4 (still `platform-tools` only), upload-artifact v7, `r0adkll/upload-google-play@v1.1.5` with `tracks`, and action-gh-release v3. The workflow input is still named `track`.
- `docs/PLAY_STORE_TESTERS_GUIDE.md` says to run the release workflow from `production`.

## Why it mattered

The 2026-09-22 CI run `35769135891` and the signed-bundle run `35769135742` warned that checkout, setup-node, setup-java, upload-artifact, setup-android, and action-gh-release target Node.js 20, and that `ubuntu-latest` moves to Ubuntu 26 on 2026-10-19. The bundle run also warned that Play's `track` input is deprecated and that setup-java v4 should move on. Node 20 left the Actions runners on 2026-09-23.

CI was also starting on every push to `development` and `main`. The quality gate belongs on `production`. Feature branches can still be checked with `workflow_dispatch`.

`development` was 57 commits ahead of `main` and `production` (both trees were `84d8093fc52ebcf972a1e6af34c66ec07aa5cfde`, app `0.2.1`). Each of those branches also had two merge commits that were not in `development`. Merging this line into them is clean, and the result tree matches `development`. The promotion pull requests carry the whole app, including `0.3.13` and the release workflow.

## Gotchas / pitfalls

- A pull request into `development` no longer starts CI. Dispatch the workflow on that branch, or open a pull request into `production`.
- Run `android-aab.yml` from `production` when cutting a Play build. Do not put `changesNotSentForReview` back, and do not install the Android SDK `tools` package. `minSdkVersion` 24 in `android/variables.gradle` stays.
- The old `0.2.1` tree fails `npm run lint` on its own (`react-hooks/exhaustive-deps` is disabled where that rule is not defined, and `displayName` in `MapProvider.tsx` should be `const`). Promotion replaces that tree with `development`, which lints clean. Those two lines were not patched on the old tree.
- The Play upload input is `tracks`. The dispatch form field remains `track`. Setting both action inputs fails. Omitting `tracks` publishes to the Play production track.
- `setup-java` v5 and v6 both run on Node 24. This repo pins v6. The v4 warning text still says "migrate to v5".
- Weekly or other schedules are not part of these workflows. There is no dependency-review job to remove.

## Verification

- On Node v22.23.3, at `a8bdc79`: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` (14 files, 111 tests), `npm run build:content`, and `npm run build` exited 0.
- GitHub Actions run [36434508745](https://github.com/SeanLebida/journeys/actions/runs/36434508745) on `9c99a98` (`workflow_dispatch`, branch `worktree-ci-build-notes`) completed with conclusion success. The check run had no annotations.
