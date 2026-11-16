# App Store Connect listing URL update workflow

## What changed
- Added `scripts/asc-update-urls.py` and a manual workflow `.github/workflows/ios-update-listing-urls.yml`. Both reuse the existing App Store Connect API key env (`APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID`, `APPSTORE_PRIVATE_KEY`) already used by `scripts/asc-submit-review.py`.
- `mode=check` reads and reports current privacy, marketing, and support URLs. `mode=update` patches records that are not already correct, then reads them back.
- Privacy policy is written on every `appInfoLocalizations` locale (`privacyPolicyUrl`). Marketing and support are written on `appStoreVersionLocalizations` (`marketingUrl`, `supportUrl`) only when the version is editable (`PREPARE_FOR_SUBMISSION`, `DEVELOPER_REJECTED`, `REJECTED`, `METADATA_REJECTED`). Non-editable versions, including a live listing, are reported and left alone.
- Target URLs: privacy and support `https://journeys.authentic.how/privacy/`, marketing `https://journeys.authentic.how/`. Update mode exits without writing if those URLs do not return HTTP 200, unless `IGNORE_URL_CHECK=1`.
- Documented the workflow in `docs/APP_STORE.md`.

## Why it mattered
- The Journeys website moved off `seanlebida.github.io` to `journeys.authentic.how`, but the App Store listing still pointed at the old host. There is no Journeys App Store Connect API key on the shared box, and `ios-submit-review.yml` leaves listing fields as they are, so a dedicated `workflow_dispatch` workflow is the sanctioned way to change them with the repo secrets.
- The default branch is `development`. `workflow_dispatch` only runs from a workflow file that is already on that branch, so the workflow has to land on `development` before it can be dispatched. It should not be merged to `production` or `main` just to run it.

## Gotchas / pitfalls
- Do not use the `AuthKey_*.p8` that sits with ToGet provisioning profiles in `~/Downloads`. That is not the Journeys key. Never print key contents, and never read `/workspace/toget-firebase/secrets/`.
- Canonical `https://journeys.authentic.how/` and `/privacy/` can return a cached Cloudflare/WordPress HTTP 503 ("Journeys is being prepared") even after the pages themselves are live. A cache-busting query string has returned 200 in that situation. Purge or wait out that cache before running `mode=update`, or the preflight check will refuse to write.
- A privacy policy change on an editable app info can appear at the app level sooner than marketing/support, which wait for the next released version if the live version is not editable.
- `www.journeys.authentic.how` is not the listing URL and has failed TLS from this box; do not point the listing at it.

## Verification
- `python3 -m py_compile scripts/asc-update-urls.py` passed.
- The three target URLs were curled before this change: the bare paths returned HTTP 503 from a cached maintenance page; the same paths with a cache-busting query string returned HTTP 200 and contained Privacy/Support content.
- The App Store Connect write itself was not run from this change. The workflow has to be on `development` first, then dispatched: Actions → **iOS Update Listing URLs**, `mode=check`, then `mode=update`.
