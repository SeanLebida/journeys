# App Store review packet

Paste these into App Store Connect for version 0.3.14, English (U.S.). Asset files in this folder match Apple's sizes as of October 2026.

## Product page

| Field | Value |
|---|---|
| Name | Journeys: Biblical Atlas (24 / 30) |
| Subtitle | Cited offline Bible atlas (25 / 30) |
| Promotional text | Follow cited routes from the patriarchs through the ministry of Jesus and the apostles. Offline maps, a timeline, the Bible, lessons, and quizzes. (146 / 170) |
| Primary category | Education |
| Secondary category | Reference |
| Price | Free |
| Copyright | 2026 Authentic How |
| Support URL | https://github.com/SeanLebida/journeys |
| Marketing URL | https://github.com/SeanLebida/journeys |
| Privacy policy URL | https://github.com/SeanLebida/journeys/blob/development/PRIVACY.md |
| Support email | auth@authentic.how |

Keywords (83 / 100):

```text
bible,atlas,scripture,maps,history,jesus,paul,geography,timeline,archaeology,exodus
```

Full description: the full-description block in `docs/STORE_LISTING.md` (3,827 / 4,000).

What's new: the current section of `CHANGELOG.md`.

## Header and search results

| File | Placement | Pixels |
|---|---|---|
| `header-3840x1646.png` | Product page header | 3840×1646, 21:9, no alpha |
| `search-3840x2560.png` | Search results | 3840×2560, 3:2, no alpha |

Upload these under Product Page Information → Header and Search Results. Do not turn on "Use header asset in search results." The two crops are different.

## Screenshots

iPhone 6.9-inch, 1290×2796, in `iphone-6.9/`. iPad 13-inch, 2064×2752, in `ipad-13/`. Order:

1. `01-home.png` — choose a way to explore
2. `02-route-trace.png` — the ministry of Jesus on the map
3. `03-atlas.png` — sandbox atlas
4. `04-timeline.png` — the life of Jesus on the chronology
5. `05-bible.png` — on-device KJV and ASV
6. `06-lesson.png` — guided lesson
7. `07-quiz.png` — quiz

## App previews

15–30 seconds, H.264, no narration. Phone 886×1920. iPad 1200×1600. In `previews/`:

| File | Workflow |
|---|---|
| `iphone-trace.mp4` / `ipad-trace.mp4` | Home, then the ministry route |
| `iphone-timeline-bible.mp4` / `ipad-timeline-bible.mp4` | Timeline, then the Bible reader |
| `iphone-lesson-quiz.mp4` / `ipad-lesson-quiz.mp4` | A lesson, then answering a quiz |

Put the trace preview first. Its poster frame is the map.

## App Review information

Sign-in required: No.

Contact: `auth@authentic.how`.

Notes:

```text
Journeys is an offline educational atlas. The binary includes a public-domain Bible (KJV and ASV) in an on-device SQLite database, offline map tiles, journey routes, lessons, and quizzes. No account is required. The app collects no data.

Optional network use, only after a tap: satellite and historical map tiles, one Mapillary view, one YouTube video, or a citation opened in the system browser. Nothing is loaded until the reader opts in.

The in-app sourcing note says high-confidence claims are checked by the project and are not yet signed by a specialist historical geographer. That is intentional. Contested locations are shown as rival candidates rather than a single pin.

No sign-in. Please review the bundled content without an account.
```

Age rating: 4+. None for cartoon violence, realistic violence, sexual content, profanity, horror, medical information, substances, gambling, contests, unrestricted web access, messaging, advertising, and user-generated content shared with other people. Notes stay on the device. If the form asks about violent themes, answer Infrequent/Mild. The app names historical battles. It does not depict them.

App Privacy: Data Not Collected. Tracking off. `PrivacyInfo.xcprivacy` declares UserDefaults reason CA92.1 only.

Export compliance: exempt. `ITSAppUsesNonExemptEncryption` is false.

Content rights: KJV and ASV are public domain. MapLibre is BSD-3. Credits are on the in-app Credits screen.

Regenerate after a UI change with the production build already serving on port 4178:

```bash
npm run build && npm run preview -- --port 4178 --host 127.0.0.1
node scripts/capture-app-store-assets.mjs
```
