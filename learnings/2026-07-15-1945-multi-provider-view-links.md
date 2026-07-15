# Multi-provider "See it today" links: add Apple Maps aerial + Mapillary street-side

## What changed
- `src/components/SitePhoto.tsx` — `SiteViewLinks` now renders two link groups:
  Aerial (Google satellite, Apple Maps `?t=k`) and Street-side (Google Street
  View, Mapillary web viewer), all keyless deep links. Minor CSS
  (`.site-view-links__group`, nowrap) in `global.css`.

## Why it mattered
- User asked about Apple Maps street view ("Look Around") and other sources.
  Look Around has no keyless deep link (MapKit JS needs a signed key) and no
  coverage in this atlas's regions (Levant, Anatolia, Greece, Egypt), so it was
  deliberately NOT added; a plain `maps.apple.com` link is keyless, works in
  any browser, and opens the native Maps app on iOS (where this app ships via
  Capacitor), so Apple got the aerial slot instead. Bing Streetside was
  evaluated and skipped for the same coverage reason. Mapillary (open,
  crowdsourced) has real street-level coverage at many of these sites and
  needs no key.

## Gotchas / pitfalls
- Apple Maps URL params: `ll=lat,lon&t=k&z=15` — `t=k` is satellite. There is
  no documented URL param that opens Look Around directly; don't burn time
  looking for one.

## Verification
- `typecheck`, `lint`, `npm test` (32) green; production build + Playwright
  drive of `/atlas` (Ephesos): all four links render with the site's
  coordinates in their hrefs.
