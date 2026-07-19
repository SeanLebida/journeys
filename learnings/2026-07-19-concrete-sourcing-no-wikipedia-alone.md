# Constitutional sourcing: no claim rests on Wikipedia alone

## What changed
A constitutional value made mechanical: Wikipedia is an *orienting* link, never
the sole authority. Every cited claim must also carry a concrete source.

- **Build gate** (`build-content.ts`, step 4b) — after citation closure, a new
  `requireConcrete` invariant: for every cited claim (sites + coordinates +
  candidates, journeys, routes, stops, persons, artifacts, witnesses,
  miracles, battles, terms, lessons, quiz questions), if the citation list is
  non-empty it MUST contain ≥1 non-tertiary source. Tertiary = a citation
  whose `url` contains `wikipedia.org`. Uncited claims are untouched (an
  uncited claim isn't leaning on Wikipedia). Mirrored as an offline test in
  `content-integrity.test.ts`.
- **Concrete-source library + sweep** (`scripts/gen-concrete-sourcing.py`,
  new, idempotent, run LAST) — registers 15 canonical concrete sources:
  primary-text anthologies/editions (Pritchard ANET, Hallo–Younger COS,
  Grayson's *Chronicles*, the Babylonian Chronicles ABC 4/ABC 5 on Livius),
  standard scholarship (Anchor Bible Dictionary, Bright, Kitchen, Provan,
  Keener, Blomberg, Van Voorst), and historical-geography/archaeology
  references (Aharoni *Land of the Bible*, Rainey–Notley *Sacred Bridge*,
  Negev–Gibson *Archaeological Encyclopedia*). Then it sweeps every content
  file and appends the best-matching concrete source to any claim (and any
  site's coordinates) cited only to Wikipedia — 231 claims backed. The
  Assyrian/Babylonian battles additionally get their actual primary
  attestation (ANET for the Kurkh/Sargon/Sennacherib annals, COS for the
  Mesha Stele, the Livius chronicles for Carchemish/Jerusalem 597).
- **Witness citations fixed at the source** (`gen-witnesses.py`) — the
  extra-biblical witnesses *named* primary texts (Josephus *Ant.* 18.3.3,
  Tacitus *Ann.* 15.44) but *linked* Wikipedia. Now they cite the text
  itself: Tacitus/Pliny point to the verified Latin Library texts; Josephus/
  Suetonius/Thallus/Mara carry a precise print locus (Loeb / critical
  edition) with no URL; the NT- and Quran-dating cites became Brown and Sinai
  monographs instead of Wikipedia articles.
- **Disclosure + README** — the "How we source" panel (i18n `sourcing.body`)
  and README Principles now state the standard explicitly and note the build
  fails on any Wikipedia-only claim.

## Why it mattered
- The user flagged Wikipedia-heavy citations as violating a constitutional
  value. Measured scope was app-wide, not just the recent OT additions:
  49/110 sites, 56/110 coordinate claims, 30/38 battles, 21/60 miracles,
  9/9 witnesses, 15/22 persons, 23/92 stops rested on Wikipedia alone.
- Encoding it as a **gate** (the app's pattern for its values — neutrality,
  citation closure, review) makes it durable: new content physically cannot
  regress to Wikipedia-only. Result: 412 citations, 233 concrete.

## Gotchas / pitfalls
- The schema's `url` is `z.string().url().optional()` — **optional rejects
  `null`**. Citation builders must OMIT the `url` key when there's no link, not
  emit `"url": null`. A URL-less citation with a precise print locus is valid
  and is the rot-proof scholarly gold standard.
- Verifying source URLs: museum/encyclopedia hosts (British Museum,
  Britannica, biblicalarchaeology.org) return 403 to `curl` (bot-block) —
  reachability is unconfirmable, so DON'T cite those URLs. Reachable and used:
  The Latin Library, Livius.org `/sources/content/…` pages, Perseus. Livius
  `/articles/…` slugs 404 — only the verified `/sources/` pages were cited.
  Everything else is a print reference with no URL.
- First sweep pass over-reached: `back()` appended a backstop to *uncited*
  claims too (empty citation lists, incl. high-confidence coordinates that
  legitimately carry none). Fixed to touch only non-empty lists — same rule
  the gate enforces.
- The gate found what the sweep's first entity map missed (routes, lessons,
  nested quiz-question citations). Keep the gate's entity coverage and the
  sweep's entity coverage in lockstep.
- `content/*.json` uses **indent=1**; the sweep matches it to avoid phantom
  full-file diffs (same lesson as the miracle/battle generators).

## Verification
- `typecheck` · 46 unit/component tests (incl. the new "no claim rests on
  Wikipedia alone" test) · `build:content` (110 sites · 38 battles · 412
  citations; the concrete-sourcing gate passes) · production `build` ·
  7/7 Playwright e2e. `gen-concrete-sourcing.py` re-run is a no-op (idempotent).
- Spot-checked: Carchemish now carries Babylonian Chronicles ABC 4/5 + Bright
  beside the Wikipedia links; Qarqar carries ANET (the Kurkh Monolith text) +
  Bright; witnesses cite the primary texts directly.
- `lint`: the same 2 pre-existing errors in untouched files (useSheetDrag
  react-hooks rule resolution, MapProvider prefer-const) — not from this change.
