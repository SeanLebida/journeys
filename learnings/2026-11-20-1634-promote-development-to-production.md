# Promote development onto production

## What changed
- Merge commit `6562335` (`merge: record production history on the development line`) joins `origin/production` (`96538f0`) into `promote/development-to-production`, which started at `origin/development` (`f15a184`). The merge tree matches `development`. Parents are both kept; the merge was not rebased or squashed.
- Seven files conflicted. Each one already contained the production fix on `development`, plus a later `development` change, so the `development` text was kept:
  - `.github/workflows/web-cloudflare.yml` — `development` adds the one-day hashed-asset retain step. The `push` to `production` trigger is unchanged.
  - `CHANGELOG.md` — `development` wraps the same 0.3.30 paragraph in `### Store notes` and `### Details`.
  - `cloudflare/journeys-web/wrangler.jsonc` — `development` keeps the `/app*` route and adds the Worker that 404s a missing `/app/assets/*` file.
  - `learnings/README.md` — `development` adds the later index lines above the shared 2026-11-13 and 2026-11-14 entries.
  - `package-lock.json` — the only conflict was `"license"` (`SEE LICENSE IN LICENSE` vs `MIT`).
  - `src/routes.tsx` — `development` keeps `routerBasename` and adds the stale-chunk error screen around the lazy routes.
  - `tests/e2e/native_bible_links.spec.ts` — `development` expects `#/trace/journey-elijah?stop=4`. Production's side still expected `?play=1&stop=4`, which `traceHref` on both branches no longer emits.
- `.github/workflows/android-aab.yml` and `.github/workflows/ios-appstore.yml` no longer start on `push` to `production`. `workflow_dispatch` and its inputs are unchanged. The first step of each job exits 1 unless `github.ref` is `refs/heads/production`. `ci.yml` and `web-cloudflare.yml` triggers are unchanged.

## Why it mattered
- Store builds are supposed to come from `production` only, by hand. `production` had diverged through direct-to-production pull requests #114, #117, #118, #123, and #126. Those fixes were already on `development` (same patch id, except the waiting-chapter commit below). A merge commit records that history without dropping `development`'s later copy of each fix.
- A push to `production` was also publishing Play and TestFlight. Removing that trigger means merging this branch does not ship a store build.

## Gotchas / pitfalls
- `git cherry` marked `3967cc8` ("Show a waiting chapter in the reader's voice") as not equivalent. Later `development` edits touched `CHANGELOG.md`, `package.json`, and `learnings/README.md` in that same commit, so the patch id changed. `src/modes/bible/readerStatus.ts` and the reader subscription in `BibleMode.tsx` match `production`. The waiting-chapter behavior was not reverted.
- `production` has no file that `development` lacks. Nothing on `production` was a fix that `development` had deleted.
- A Play push used to upload one build to `internal,alpha`. A manual dispatch sends only the selected track (default `internal`). The workflow still falls back to `internal,alpha` when `track` is empty, but `workflow_dispatch` always sets `track`, so that fallback does not run.
- `web-cloudflare.yml` still says not to run it until Sean says go for the assets 404 change. Its `push` trigger was left in place, so merging into `production` deploys the web worker, including that 404 behavior.

## Verification
- `npm ci`
- `npm run typecheck` (exit 0)
- `npm run lint` (exit 0)
- `npm test` — 57 files, 375 tests passed
- `npm run build` — content build, `tsc --noEmit`, and the Vite production build exited 0
