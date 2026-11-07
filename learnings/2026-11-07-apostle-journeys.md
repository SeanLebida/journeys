# Apostle journeys for the Twelve

## What changed

- Eleven journeys now sit beside Peter's: Andrew, James son of Zebedee, John, Philip the apostle, Bartholomew, Thomas, Matthew, James son of Alphaeus, Thaddaeus, Simon the Zealot, and Matthias. Judas Iscariot, Paul, and Mark were not given new journeys.
- `journey-apostolic-traditions` draws only Jerusalem at Pentecost and Peter and John in Samaria. Antioch, Rome, Ephesus, Patmos, Hierapolis, and Alexandria came off that line. Mark and Alexandria stay in the summary.
- `scripts/build-content.ts` loads `*.apostles.json` after the extra files. The integrity test merges the same three layers.
- A stop with no bundled photo uses `PlaceFrame`: a close crop of the bundled relief, a corner locator, and a satellite map in that same box only while `navigator.onLine` is true. The satellite map is a second MapLibre instance and does not move the main map.
- `WORLD_BBOX` is now `[-12, 22, 55, 48]` so Hecatompylos (54.11783°E) validates. `scripts/clip-basemap.py` and `scripts/route-on-itinere.py` use the same box. The relief image was regenerated: 2010×780, 914431 bytes.
- Pontic Olbia has a public-domain photo. Patrae has a CC BY-SA 4.0 photo of the Roman odeon. Hecatompylos has no free site photo, so the slot stays on the relief and satellite.

## Why it mattered

The old traditions line stepped backward in time and joined four different men's later stories as one trip. Each of the Twelve now has his own journey. Biblical stops come first. Later tradition stays legendary or disputed, cited, and off the shared line. The atlas had to grow east or Thomas's Parthia pin could not ship. The photo slot still works with no network because the relief file is in the install and satellite pictures are not saved.

## Gotchas / pitfalls

- A stop has one `journeyId`. A place where two of the Twelve were together is a separate stop row on each journey, sharing `siteId` and citation ids.
- `PlaceFrame`'s `online` prop defaults to false so unit tests do not construct MapLibre. Trace, Lesson, and Atlas pass `navigator.onLine`. The satellite container needs an explicit size. Without it MapLibre collapses the node and the close view never appears.
- Pontic Olbia is a regional stand-in for the Scythia Eusebius allots to Andrew. Eusebius does not name that city. Hecatompylos is the Parthia pin for Thomas. The Digital Atlas marks that identification with a question mark. India, Armenia, Edessa, and Mylapore were left off rather than given an invented coordinate.
- `site-samaria` is the Shechem and Gerizim pin, not Sebaste. Philip the apostle does not carry Acts 8 or Philip the evangelist. James son of Alphaeus does not carry James the brother of the Lord.
- New claims are `self-reviewed`, never `scholar-approved`. An empty `scriptureRefs` list is not `confidence: high`.
- A Playwright offline context against the Vite dev server does not refetch `hillshade.png`, so the slot can look blank there even though the pixel at Hecatompylos is opaque. The installed web app precaches that file. Capacitor serves it from the package.
- Do not commit `public/dist-content`. Do not run `route-on-itinere.py` just because its bbox constant changed.
- Play rejects a second upload of the same versionCode. A push to production publishes that code to `internal` and `alpha` in one edit. `r0adkll/upload-google-play` splits `tracks` on commas and does not trim, so the value is `internal,alpha`. Do not dispatch `android-aab.yml` again for that commit.

## Verification

- `npm run build:content` exited 0. Sites 135, journeys 29, routes 20, stops 176, persons 90. Integrity `2fc16773ca49895f`. The non-release warning about high-confidence claims that are not scholar-approved is expected.
- `npm test -- --silent tests/unit/content-integrity.test.ts tests/unit/apostle-journeys.test.ts src/components/PlaceFrame.test.tsx src/map/placeFrame.test.ts src/map/hillshade.test.ts src/map/style.test.ts` passed after the atlas widen and the loader merge.
- In the worktree app on port 5198, the trace list shows all eleven new journeys. Hecatompylos, which has no photo, shows a close satellite view with the relief locator in the corner while online, and the main map stays a separate relief map. Olbia shows the bundled ruins photo and no relief frame. With `navigator.onLine` false the satellite node is absent and the relief frame remains. The relief PNG alpha at 54.11783°E, 35.95328°N is 255.
- After the 0.3.22 bump, `npm run typecheck && npm run lint && npm test && npm run build` exited 0. 37 files, 213 tests. Integrity `b6dffcc6c94682f3`. The scholar-approval warning stays a warning.
