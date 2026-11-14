# Bible proxy web origin

## What changed

Added `https://journeys.authentic.how` to the Bible proxy CORS allowlist in `cloudflare/journeys-bible-proxy`. `https://localhost` and `capacitor://localhost` stay. The full-set test now covers three origins.

## Why it mattered

The web app at `https://journeys.authentic.how/app` calls `https://bible.authentic.how` with `X-Journeys-Client: journeys`. Without this origin, `requireClientHeader` returns 403 and `withCors` omits `Access-Control-Allow-Origin`, so Firefox reports `TypeError: NetworkError when attempting to fetch resource`. Copyright and the version sheet both fail.

## Gotchas / pitfalls

Native origins stay. Do not widen CORS to `*` or reflect arbitrary origins. Capacitor Android’s `http://localhost` is still not included. The worker must be deployed for the live proxy to change. CI does not deploy it.

## Verification

From `cloudflare/journeys-bible-proxy`: `node --experimental-strip-types --test tests/*.test.ts` (43 passed).

Deployed `journeys-bible-proxy` version `45fec1bc-f221-4e30-b635-6780eab0808c` to `bible.authentic.how`. OPTIONS and `GET /v1/bibles/100` with `Origin: https://journeys.authentic.how` and `X-Journeys-Client: journeys` return `Access-Control-Allow-Origin: https://journeys.authentic.how`. The metadata response is NASB1995 and includes the Lockman copyright. `Origin: https://evil.example` is still 403 with no allow-origin header.
