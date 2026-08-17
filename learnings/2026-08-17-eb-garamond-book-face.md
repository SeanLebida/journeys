# EB Garamond as the book face

## What changed

- `--font-serif` is now **EB Garamond** (self-hosted Latin woff2: 400,
  400 italic, 500). Ubuntu stays on chrome (`--font-heading` / `--font-body`).
- Scripture quotations, the Bible reader, search hits, water labels, and
  stop titles that already asked for `--font-serif` get the real book
  face. Citation metadata stays Ubuntu.
- Files live next to Ubuntu under `public/fonts/` with the SIL OFL 1.1.
  Credits lists both faces.

## Why it mattered

CRAP contrast was being faked with Ubuntu italic. A Garamond on the
biblical text and Ubuntu on the atlas chrome is the pairing the product
already described and never shipped.

## Gotchas / pitfalls

- Garamond has a smaller x-height than Ubuntu. Scripture is 1.12rem and
  the reader 1.15rem so a verse does not look smaller than the UI around
  it.
- Do not point MapLibre PBF glyphs at Garamond. Those stay Ubuntu; only
  DOM labels (`--font-serif`) change.
- Offline rule: no Google Fonts / gstatic. The woff2s are in `public/`
  and ride the existing PWA + Capacitor copy.

## Verification

```
npm run typecheck
npm run lint
npm test
npx playwright test tests/e2e/timeline_bible.spec.ts
```

Reader: `/bible?ref=1%20Kings%2018:21` should set the chapter in EB
Garamond. A stop's quoted passage should match. Chrome (tabs, headings,
buttons) stays Ubuntu.
