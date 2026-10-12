# App Store review packet

## What changed

- Added `scripts/capture-app-store-assets.mjs`. It screenshots the production preview at iPhone 1290×2796 and iPad 2064×2752, records three workflows, and composites the product-page header and search image.
- Wrote the assets under `docs/store-assets/apple/`: seven screenshots per device, six preview videos, `header-3840x1646.png`, `search-3840x2560.png`, and paste-ready copy in `LISTING.md`.
- Aligned promotional text, review notes, and the screenshot table in `docs/APP_STORE.md` and `docs/PLATFORM_CHECKLIST.md` with that packet. The review notes still say high-confidence claims are not specialist-signed.

## Why it mattered

TestFlight can accept a build without screenshots. App Review cannot. The Play phone shots are 1080×1920, which App Store Connect rejects, and the October 2026 product page also asks for a 21:9 header and a 3:2 search image. The previews show the three paths a reviewer is asked to try: a route, the timeline into the Bible, and a lesson into a quiz.

## Gotchas / pitfalls

- Each preview flow is one function. The recorder calls it. It does not iterate the function.
- Lesson title is an `h2` from `ModePanel`. A level-1 wait never resolves. The step control is the button named `Next →`. A `/Next/` match also hits `Next photo`.
- The timeline still has to click "The life of Jesus". Scrolling `#era-jesus` into view lands in the middle of the event list.
- Phone previews are recorded at 430×932 and scaled to 886×1920. iPad previews are recorded at 900×1200 and scaled to 1200×1600. H.264 High level 4.0, 30 fps, yuv420p, with a silent stereo AAC track so a missing audio stream is not the reject reason.
- Do not turn on "Use header asset in search results." The crops are different. The local OpenAPI dump has a search-results asset and no product-page header upload, so the header may still be a website upload.
- This API key still cannot create the App Store Connect app record. Media upload waits on that record.

## Verification

- `node scripts/capture-app-store-assets.mjs` checks every PNG for exact pixels and no alpha, and every MP4 for size, an audio stream, and duration between 15 and 30 seconds.
- Confirmed sizes: iPhone stills 1290×2796, iPad stills 2064×2752, header 3840×1646, search 3840×2560.
- Confirmed clips: phone 886×1920 (18.9s, 17.9s, 17.5s), iPad 1200×1600 (18.9s, 17.9s, 17.9s). Codec is H.264 High level 4.0, yuv420p, AAC LC stereo 48 kHz.
- Spot-checked frames: home, ministry route, atlas, life-of-Jesus chart, John 1, Galilean lesson, quiz score 1/5 after Prefect, header, and search image.
- Promotional text is 146/170. Subtitle 25/30. Name 24/30. Keywords 83/100. Full description 3,827/4,000.
- No Xcode on this host, and no App Store Connect app record, so nothing was uploaded.
