# Commercial license option and an individual CLA

## What changed
- README license section gained a Commercial use note: using the software without the AGPL obligations requires a commercial license. Contact is `auth@authentic.how`, the address already used on the about and support pages.
- Added `CLA.md`, a short individual contributor agreement. The contributor keeps copyright and grants Sean Lebida a license that includes relicensing, including a commercial license without the AGPL obligations. Content on the `LICENSE-CONTENT` paths stays CC BY-SA 4.0 for the public.
- `CONTRIBUTING.md` no longer says inbound equals outbound. It welcomes map data, scholarly corrections, translations, code, and design feedback, points at the `good first issue` label, and points at `CLA.md`.
- Added `.github/PULL_REQUEST_TEMPLATE.md` with a CLA checkbox. Supersedes the contribution terms in `2026-11-20-split-license.md`.

## Why it mattered
- Sean wants contributions to continue and the app to keep improving. AGPL alone blocks someone who needs to ship without sharing source. A commercial license covers that case. Dual licensing needs a grant from contributors, so the public AGPL and CC BY-SA terms are no longer the only grant.
- CLA Assistant Lite (`cla-assistant/github-action`) is archived, uses `pull_request_target`, and commits a signatures file onto a branch. A pull request checkbox is the check that fits this repository.

## Gotchas / pitfalls
- The checkbox does not block a merge by itself. GitHub only enforces it if branch protection requires the box, which it does not here.
- The CLA link in the template points at `development`. It resolves after this pull request merges.
- The extra grant to Sean is what allows a commercial license. It does not remove the public AGPL grant for code or the public CC BY-SA grant for content.
- Do not copy Seed Bible's trademark wording. Their README was only the model for the short commercial-use note.

## Verification
- README commercial note, `CLA.md`, `CONTRIBUTING.md`, and `.github/PULL_REQUEST_TEMPLATE.md` are on the license pull request branch.
- `package.json` version is unchanged.
