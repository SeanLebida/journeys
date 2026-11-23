# Exodus crossing and Sinai candidates: data layer

## What changed
- `src/content/schema.ts`: `SiteCandidate` gains optional `id`, `note`, `advocates` (`{name, citationIds}`), `pinPrecision` (`summit` | `town` | `region`), `groupId`, and `claimStatus` (display label: `established` | `identification-disputed` | `claimed-not-confirmed`). `Artifact` also gets optional `claimStatus`. `Journey` gets optional `proposedRoutes` (`{id, advocate, crossingCandidateId, sinaiCandidateId, note, citationIds}`). `RoutePath` gets optional `proposedRouteId`.
- New site `site-red-sea-crossing` (7 pins, 6 candidates; Great Bitter Lake and Lake Timsah share `group-crossing-isthmus-lakes`). `site-mount-sinai` grows from 3 to 10 pins (8 candidates; `group-sinai-musa-safsafa`, `group-sinai-lawz-maqla`). The Har Karkom pin moved to the GeoNames summit (30.28616, 34.74478) as the research file recommends.
- 9 `proposedRoutes` on `journey-exodus`, each drawn by one `route-pr-*` path in `routes.extra.json` (one leg, `schematic` grade, exact candidate pins as endpoints).
- `src/content/candidates.ts`: shared gate (`checkCandidates`, `checkProposedRoutes`) used by `scripts/build-content.ts` and `tests/unit/exodus-candidates.test.ts`.
- `useBundle`: `routeForJourney` ignores proposed-route paths; new `routeForProposedRoute`.

## Why it mattered
- Sean asked for every crossing point and Sinai candidate, with both sides drawn from writers who accept the Exodus as history. The map team needs pairing data without the app picking a winner.
- `confidence` stays the only checked grade. `claimStatus` is a label so QC's review packet is not bypassed.
- Coordinates and citations come only from `/workspace/journeys-exodus-research.md` (Senior Copywriter, 2026-11-23). No URLs were added because the research file lists none.

## Gotchas / pitfalls
- A `RoutePath` with `proposedRouteId` shares `journeyId` with the journey's trace. Anything that looks up "the route for a journey" must skip those paths, or the trace will pick up a two-point line. Both the build gate (6b) and the content-integrity leg test skip them.
- Proposed-route lines are straight `schematic` connectors, not the advocate's road.
- Card copy is not here. Notes are one plain line each; Senior Copywriter's cards are still waiting on Sean's decision.

## Verification
- `npm run lint`, `npm run typecheck`, `npx vitest run` (60 files, 396 passed), and `npm run build:content` all passed on 2026-11-23.
