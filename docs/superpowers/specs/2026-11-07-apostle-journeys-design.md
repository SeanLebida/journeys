# Journeys of the Twelve

Date: 2026-11-07

Each of the Twelve gets his own journey, in the journey shape the app already walks: ordered stops, a path, years, scripture, history, archaeology, grades, and pictures. The shared Traditions journey stays and explains the group. A stop still makes sense with no signal.

## Why

Peter already has a journey. The other members of the Twelve are people in the app, and their later travels sit inside one shared journey that draws only a few of them. The reader should be able to follow each apostle on his own, including the stretch he walked with others and the stretch that is his alone, and still see why a stop is on the map. The pictures should show the place and, when one exists, the find. Where no free picture exists, the photo slot should show that place from above, close, with the wider area still visible.

## Goals

- Eleven journeys join the one Peter already has. The people are `person-andrew`, `person-james-zebedee`, `person-john-apostle`, `person-philip-apostle`, `person-bartholomew`, `person-thomas`, `person-matthew`, `person-james-alphaeus`, `person-thaddaeus`, `person-simon-zealot`, and `person-matthias`. Peter's journey stays `journey-peter`.
- A stretch several apostles take together uses that group's destination. Each journey that includes it has its own stop row, because a stop belongs to one journey through `journeyId`. Those rows share the site and the citations, and the event says who was there together. A stretch that is his alone follows him and is his own stop.
- Both stretches are on his journey. The walking order is time order. Inside one year, the earlier stop is distinguished from the later one in the timing line.
- Where the New Testament gives the order, that order leads. A history or a find that points elsewhere stays cited beside the biblical stop. The line does not move to it.
- Where the New Testament names no destination, the line follows both the historical account and the archaeological finding. When those two name different places, the line visits both, each cited and explained.
- Every new claim cites at least one Christian biblical scholar and the primary source that scholar is explaining: Scripture, an ancient text, or an excavation report. A popular webpage cannot be the only support. A later account a scholar treats as legend stays `legendary` or `disputed`. New claims are `draft` or `self-reviewed`. They are not `scholar-approved`.
- The photo slot shows a bundled picture of the area when we have one under public domain, CC0, CC BY, or CC BY-SA, with the author and license stored. A bundled picture of the find sits with it when we have one under the same rule. When the area picture is missing, the slot is one frame: a close view centered on the stop's coordinates, and a locator in the corner showing that view's box on the wider atlas.
- With no signal, the journey text, the path, the stops, the current-location dot, the bundled pictures, and the photo slot all still work. The close view then uses the shaded relief that ships in the install. The locator uses that same bundled atlas. The satellite picture is the close view only while it can load, and it is not written into the package. That relief view is enough. A saved satellite picture is not required for the slot to be usable offline.

## Non-goals

- A journey for Judas Iscariot, Paul, or Mark. Paul's four journeys stay as they are. Mark can still be named inside the Traditions journey where a group account includes him. He does not get his own journey.
- Treating Philip the evangelist (`person-philip-evangelist`) or James the brother of Jesus (`person-james-brother-jesus`) as the apostle of the same name. Acts 8 stays on the evangelist's record. The Jerusalem church's leadership stays on the brother's record.
- An offline copy of satellite, streets, or the Roman map.
- A downloadable region pack, or any use of `useDownloadStore`.
- A month, a day, or a season that no source gives.
- Marking a stop specialist-signed because a book was cited.

## Anti-goals

- A photo slot that is empty, spinning, or blocked when the device is offline.
- Saving Esri or other satellite tiles into the install.
- A path that waits on the satellite picture before the stop can be read.
- Drawing a later shrine as if it were the biblical stop, or giving a legendary stretch the grade `high`.
- A together-place whose site or citations differ between the journeys that include it.
- An invented order inside a year when the Bible, the historical account, and the find are all silent about which came first.

## Approaches

**Full set together.** Chosen. All eleven journeys, the Traditions rewrite, the wider offline atlas, and the photo slot land as one body of work. Every apostle is held to the same rules.

**Biblical stretches first.** Rejected. Acts-ordered stops would ship before Thomas, Andrew, Bartholomew, and the other later stretches. The set would be unfinished, and the later line would not be on the map.

A separate dossier screen was not a real option. These are journeys in the existing trace.

## Decisions

- `journey-apostolic-traditions` stays and draws only the places where more than one of the Twelve were together, in time order. Jerusalem after Pentecost is on it, and so are the trips Acts says they took side by side, such as Peter and John to Samaria. Its writing names each man's own journey for where he went afterward. Antioch and Rome go to Peter's journey. Ephesus and Patmos go to John's. Hierapolis goes to Philip the apostle's. The current list is replaced, because it runs backward in time. Mark is named in the writing, Alexandria included. Alexandria is not a stop on this line.
- Peter's biblical stops stay. Add a later stop to his journey only when the rules above require a place that journey does not already visit.
- The walking order is the journey's stop list. Each stop's `dateRange.startYear` is the same as or later than the previous stop's. Inside one year, `dateRange.display` says which stop is earlier and which is later. `approximate` is true when the year is not that tight. `chronologyNotes` records an order that is traditional or still debated.
- When nothing in the Bible, the historical account, or the find says which of two places came first, both places are still stops. The timing line says the order is not known. The list follows the earlier source that names each place, and `chronologyNotes` says that is all the order is. The grade is not `high`.
- The bundled atlas today is `WORLD_BBOX` in `src/map/graticule.ts`: west −12, south 22, east 50, north 48. `scripts/build-content.ts` rejects a site or a route point outside it. Several honest destinations for this set, including the Indian and Ethiopian traditions, sit outside it. Widen that box to the smallest whole-degree rectangle that contains the old box and every new stop and route point. Regenerate the basemap clip and the one Natural Earth 50m relief image for the new box, sea still transparent, still one image, not a closer pyramid. The validator, the graticule, and `scripts/route-on-itinere.py` follow the new box. A leg the old road helper cannot trace still draws as the journey line. The path does not wait on that helper.
- The photo frame does not move the main map's camera and does not call `setStyle()` on it. Offline, its close view is a crop of the bundled relief centered on the coordinate, as close as that image allows. The corner locator is the bundled atlas with a box around the crop. Online, the close view may use the existing satellite layer. If that layer does not load, the relief crop shows at once. No satellite tile is stored.
- Free pictures stay the bundled gallery in `public/images/sites/`, with author, license, and source URL, the way `SitePhoto` already works. A find is another image in that gallery, captioned as the find. Licenses are public domain, CC0, CC BY, and CC BY-SA. NC, ND, and all-rights-reserved files are not used. The phone package contains these files because it contains `public/`. They are not hotlinked.

## Constraints

- Content still validates against `src/content/schema.ts`. Journey kind is `apostolic`. Claims keep `confidence`, `reviewStatus`, and at least one citation. A `disputed` claim still needs a `disputes` note.
- Citation kinds stay the ones the schema already has. The existing rule stands: a tertiary or popular source is not the only concrete support.
- One main map, created in `MapProvider`. Theme changes stay on the existing tone path.
- Asset URLs stay absolute root paths through `resolveAssetUrl`. Do not use `Capacitor.convertFileSrc` for the relief file.
- The relief file stays on the service-worker precache. Native builds copy `public/` and do not use the service worker.
- Visible review copy stays as it is. `self-reviewed` reads as not specialist-signed.

## Left to the builder

- Which places, coordinates, ancient texts, and scholar editions each stop uses, within the rules above.
- The exact new `WORLD_BBOX` after those coordinates are known, and the regenerated relief and basemap.
- Whether the photo frame crops the relief in a canvas or uses a map instance that lives and dies with the figure. It must meet the photo-frame rules above.
- How the new journey records are split across the existing content files if one file would become unwieldy.
- Which Commons files pass the license rule.

## Verification

- `npm run build:content` accepts the new stops, routes, years, and citations, and rejects any coordinate outside the widened box.
- A journey's stop list does not step backward in `startYear`.
- With the network blocked, a new journey still draws its path, stops, and current-location dot, its text is readable, a bundled picture shows, and a stop with no bundled picture shows the relief crop and the locator rather than an empty frame.
- With the network available, that same empty-picture stop shows the close satellite in the frame, and the locator still shows the bundled atlas. Turning the network off returns the frame to the relief crop without moving the journey camera.
