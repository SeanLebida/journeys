# YouVersion offline check typechecks

## What changed
- `browserIsOffline()` in `src/content/youversionStream.ts` re-reads `navigator.onLine` before a chapter request and again when that request fails.
- The reader-status test casts a downloaded-id stand-in through `unknown`.

## Why it mattered
- Production CI typecheck rejected the 0.3.30 promotion. `navigator.onLine` is readonly, so the first `=== false` narrowed it to `true` and the check inside the fetch `catch` compared `true` with `false`. The device can go offline during the request, so the second check has to read the flag again.

## Gotchas / pitfalls
- Do not compare `navigator.onLine` twice in one function. TypeScript keeps the narrowing. Call a helper instead.
- `DownloadedTranslation` is the full download record. A test that only needs `id` cannot assert `{ id }` directly.

## Verification
- `npm run typecheck` on the promotion branch.
- `npm test` for `youversion-stream` and `reader-status`.
