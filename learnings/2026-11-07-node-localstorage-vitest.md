# Vitest storage on Node 26

## What changed

- `tests/storage-setup.ts` installs an in-memory `localStorage` and `sessionStorage` when Node's copies have no `clear` or `getItem`. `vite.config.ts` loads that file before `tests/setup.ts`.

## Why it mattered

- Node 26 defines `localStorage` as a getter that is empty unless `--localstorage-file` is set. That hides jsdom's storage, so `src/release/ReleaseNotices.test.tsx` throws on `.clear`. CI runs Node 22, where the suite already passed.

## Gotchas / pitfalls

- The stand-in is for tests only. Do not use it as the app's storage.
- Setup files run in order. This one has to be first, before any test reads `localStorage`.

## Verification

- `npm test` on Node 26: 191 passed.
