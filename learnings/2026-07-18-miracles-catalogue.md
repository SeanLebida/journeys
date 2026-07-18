# Miracle catalogue: all of Jesus' miracles + the disciples' miracles, anchored to the map

## What changed
- **Schema/pipeline** (`schema.ts`, `build-content.ts`, `useBundle.ts`) — new
  `Miracle` entity: `performedBy: 'jesus' | 'disciple'` (the two sections),
  `performerLabel` + optional `performerIds` (person links), a `kind` enum
  (healing/exorcism/resurrection/nature/provision/judgment/deliverance/sign),
  required `siteId` anchor, optional `locationNote`, `scriptureRefs` (min 1),
  and the standard confidence/reviewStatus/disputes/citations claim fields.
  Wired through every gate: schema validation, citation closure, neutrality
  invariants, referential integrity (site + persons), scripture-ref resolution
  against the KJV verse keys, the `--release` review gate, the bundle, and new
  `miraclesForSite`/`miraclesForPerson` BundleIndex accessors.
- **Content** — committed idempotent generator `scripts/gen-miracles.py` owns
  `content/miracles.json`: **60 entries — the classic 37 recorded miracles of
  Jesus** (incl. the Gennesaret and Nazareth healing summaries) **and 23
  miracles worked by the disciples** (the Twelve's and Seventy's missions,
  Peter on the water, Acts: Beautiful Gate, Ananias & Sapphira, Peter's
  shadow, prison deliverances, Stephen, Philip in Samaria, Ananias of
  Damascus, Aeneas at Lydda, Tabitha at Joppa, Elymas, Iconium, Lystra,
  Philippi ×2, Ephesus, Eutychus, Malta ×2). The generator also upserts 3 new
  sites (**Nain, Lydda, Joppa**), 3 new persons (**Stephen, Philip the
  Evangelist, Ananias of Damascus**) and 11 citations into the `.extra.json`
  layers.
- **UI** (`SiteExtras.tsx` + css) — `MiracleCard` (performer · kind ·
  refs meta line, account summary, 📍 location caveat, click-to-load
  `ScripturePassage`s, dispute note, citations) rendered in two site-panel
  sections: **"Miracles of Jesus here"** and **"Miracles of the disciples
  here"** — surfaced wherever SiteExtras already appears (Atlas site detail,
  Trace active stop, Lesson steps).
- **Tests** — content-integrity now validates miracles (schema, dangling
  citations, scripture parse, site anchors, ≥37 Jesus + ≥20 disciple
  coverage) and merges `persons.extra.json` (previously missed); new
  `SiteExtras.test.tsx` renders the sections against the real catalogue.

## Why it mattered
- Request: "include all of Jesus's miracles and locations… also the miracles
  done by disciples of Jesus in the applicable section." Location honesty was
  the design constraint: every miracle must anchor to a *mapped* site, but the
  text often leaves the spot unnamed — hence `locationNote` for approximate
  anchors (unnamed Galilean towns → Capernaum as ministry hub; Tabgha as the
  Byzantine commemoration of the loaves) and `disputed` confidence + disputes
  notes where the anchor itself is contested (Gerasa/Gadara/Gergesa; the
  travel-narrative synagogue healings anchored to the Samaria–Perea corridor).

## Gotchas / pitfalls
- The content JSON files use **indent=1** (not 2). A generator writing
  indent=2 rewrites every line of the `.extra.json` layers it upserts into —
  a 3,700-line phantom diff. Match the existing indent.
- `content-integrity.test.ts` read only `persons.json`, silently skipping
  `persons.extra.json` — new persons validated in the build gate but not the
  offline test until the merge was fixed.
- jsdom tests must not mount `ScripturePassage` (sql.js wasm load rejects
  unhandled); assert the collapsed "Read the passage" state instead and leave
  passage text to the e2e lesson test.
- Playwright in this container: pinned @playwright/test wanted
  chromium(-headless-shell)-1228 but /opt/pw-browsers ships 1194 with the
  *old* directory layout (`chrome-linux/headless_shell` vs
  `chrome-headless-shell-linux64/chrome-headless-shell`) — symlink the binary
  path, not the directory.
- Atlas site-label buttons are MapLibre DOM markers that only exist once the
  WebGL map is ready; they're not reachable in a quick headless drive at
  initial zoom. Component-test SiteExtras directly instead.

## Verification
- `typecheck` · 41 unit/component tests (7 files) · `build:content` (80 sites
  · 9 journeys · 92 stops · 60 miracles · 338 citations; every scripture ref
  resolves against the bundled KJV) · production `build` + PWA precache ·
  7/7 Playwright e2e. Generator re-run is byte-identical (idempotent).
- `lint` has 2 pre-existing errors in untouched files (`useSheetDrag.ts`
  react-hooks rule resolution, `MapProvider.tsx` prefer-const) — present
  before this change; not introduced here.
