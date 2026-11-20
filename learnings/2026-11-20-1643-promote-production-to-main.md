# Promote production onto main

## What changed
- Merge commit `3c16dad` (`merge: catch main up to production`) joins `origin/main` (`a407ef18`) into `promote/production-to-main`, which started at `origin/production` (`fa7ca4ac`, pull request #134). Parents are both kept. The merge was not rebased, squashed, or force-pushed.
- `git rev-list --left-right --count origin/main...origin/production` was `30 545`. `git merge-base --all` returned two bases: `37c633b` and `35faf2a`.
- The resolved tree of `3c16dad` matches `fa7ca4ac` (`git diff fa7ca4ac 3c16dad` is empty). `git diff --diff-filter=A origin/production origin/main` listed no file that exists only on main. The thirty main-only commits stay reachable as the second parent.
- Thirteen files conflicted. Each one kept production (the first parent):
  - `.github/workflows/android-aab.yml` — production's `workflow_dispatch`-only comment. The recursive merge had also put main's `push: branches: [production]` and a second `concurrency` block back; both went away with production's file.
  - `.github/workflows/web-cloudflare.yml` — production's "do not run until Sean says go" comment and the one-day hashed-asset retain step. The `push` to `production` trigger is on both sides.
  - `.gitignore` — production's `.web-asset-retain/` ignore.
  - `CHANGELOG.md` — production's `### Store notes` and `### Details` around the same 0.3.30 paragraph.
  - `cloudflare/README.md` — production lists `journeys-web` and the current Bible proxy. Main still described a NASB-only dry run and had no web app worker.
  - `cloudflare/journeys-web/wrangler.jsonc` — production's Worker (`main`, `ASSETS` binding, `run_worker_first` for `/app/assets/*`).
  - `docs/APP_STORE.md` — production's What's New text, which reads `### Store notes` (or `docs/appstore-whatsnew.txt` when present).
  - `learnings/README.md` — production's 2026-11-16 and 2026-11-20 index lines. The shared 2026-11-13 and 2026-11-14 lines below the conflict stayed.
  - `package-lock.json` — production's `"license": "SEE LICENSE IN LICENSE"`. Main still said `MIT`.
  - `scripts/asc-submit-review.py` — production's `changelog_note()`, which returns the `### Store notes` subsection.
  - `src/components/CreditsView.tsx` — production. Main's hunk repeated the "Works anywhere, private by design" list that already follows the conflict, ahead of `GetTheApp`.
  - `src/routes.tsx` — production's stale-chunk loader (`RouteErrorScreen`, `loadLazyRoute`, `lazyMode`).
  - `tests/e2e/native_bible_links.spec.ts` — production expects `#/trace/journey-elijah?stop=4`. Main still expected `?play=1&stop=4`.
- `.github/workflows/ios-appstore.yml` did not conflict, but the same recursive merge re-added `push: branches: [production]` and a second `concurrency` block. Restored production's file: `workflow_dispatch` only, one concurrency group, and the step that exits 1 unless `github.ref` is `refs/heads/production`.

## Why it mattered
- `main` had diverged. A merge commit is what keeps those thirty commits when `main` later takes this branch. Rebase or squash would drop that history. Production's tree is the one that should ship: it already contains the development line plus the store-build gates from #134.

## Gotchas / pitfalls
- Two merge bases made Git replay main's old `push` trigger into `android-aab.yml` and `ios-appstore.yml` without a conflict marker on the iOS file. Compare those workflows to production after any future merge of `main`; a clean auto-merge can still put the store `push` trigger back.
- `CreditsView.tsx` looked like main had a unique "Works anywhere" section. That section is already in production after the conflict, so taking main's hunk would have duplicated it.
- This learning commit is the only change after `3c16dad`. The merge commit itself is an identical tree to production.

## Verification
- `npm ci`
- `npm run typecheck` (exit 0)
- `npm run lint` (exit 0)
- `npm test` — 57 files, 375 tests passed
- `npm run build` — content build, `tsc --noEmit`, and the Vite production build exited 0
