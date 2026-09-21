# Google Play Console Store Listing Metadata & Asset Guide

Complete, copy-paste-ready information and asset specifications for publishing **Journeys** to Google Play Console.

---

## 1. Main Store Listing Details

### App Name (Title)
> Google Play strictly enforces a **30-character limit**.

- **Option 1 (Recommended):** `Journeys: Atlas of Apostles` *(28 characters)*
- **Option 2:** `Journeys - Atlas of Apostles` *(29 characters)*
- **Option 3:** `Journeys - Biblical Atlas` *(25 characters)*
- **Option 4:** `Journeys: Bible Atlas` *(21 characters)*

---

### Short Description
> Google Play strictly enforces an **80-character limit**.

```text
Accurate, cited, offline interactive atlas of the journeys of Jesus & apostles.
```
*(79 characters)*

---

### Full Description
> Google Play limit: **4,000 characters**. Formatted with clean headings and bullets for maximum store conversion.

```text
Journeys is an accurate, cited, offline interactive atlas of the missionary journeys of Jesus and the apostles — biblically, geographically, historically, and archaeologically grounded, with a denominationally neutral stance.

Whether you are studying the New Testament, teaching a class, or exploring ancient history, Journeys transforms biblical geography from flat paper maps into an interactive, cited, living exploration.

◆ SIX WAYS TO EXPLORE

1. ROUTE TRACING
Follow animated missionary journeys on the ancient map. Trace the footsteps of Paul (First, Second, Third Missionary Journeys, Journey to Rome) and the ministry routes of Jesus across Galilee and Judea. View terrain elevations, travel legs, and stop-by-stop historical accounts.

2. SANDBOX ATLAS
Freely explore the ancient Mediterranean with toggleable historical layers. Inspect Roman roads, trade lanes, province borders, and ancient settlements with rich topographical context.

3. BIBLICAL TIMELINE
Explore biblical history along an intuitive linear timeline, from Creation through the Roman Imperial period. View parallel lanes for major figures, empires, prophetic books, and archaeology.

4. EMBEDDED BIBLE READER
Read Scripture alongside the map. Journeys bundles complete public-domain texts (King James Version and American Standard Version) in a fast, on-device SQLite database. Tap place names in Scripture to jump straight to their location on the map.

5. GUIDED LESSONS
Take step-by-step historical and geographical deep dives into biblical events, examining cultural context, topography, and archaeological artifacts.

6. INTERACTIVE QUIZZES
Test and deepen your knowledge of ancient geography, apostolic travels, and historical backgrounds.

◆ GROUNDED IN ARCHAEOLOGY & PRIMARY SOURCES

• Cited Claims: Every site and route stop is anchored to primary historical texts (Scripture, Josephus, Tacitus, Roman itineraries) and excavation records.
• Transparent Confidence: Clear ratings (high, medium, disputed, legendary) distinguish between consensus identifications and contested traditions.
• Rival Candidates Shown: When scholars disagree on a biblical site's exact location, Journeys displays the rival candidates on the map rather than guessing.
• Rigorous Sources: Grounded in standard scholarly gazetteers including Pleiades, DARE, and archaeological reports.

◆ 100% OFFLINE BY DESIGN

Journeys works anywhere — in church, in the classroom, on flights, or in the field:
• Complete 10 MB on-device SQLite Scripture database included.
• Offline vector map tiles bundled directly inside the app.
• No internet connection required after install.
• No account creation, no sign-in, and zero cloud dependencies.

◆ PRIVACY FIRST
• No data collected.
• No data shared.
• No tracking or third-party ad networks.
• Completely free of advertisements.

Discover the ancient world as it was traveled. Explore Journeys today!
```

---

## 2. Store Categorization & Tags

| Setting | Selection |
|---|---|
| **App or Game** | App |
| **Category** | **Education** *(or Books & Reference)* |
| **Tags** | Education, Books & reference, History, Geography, Religion |

---

## 3. Store Contact Details

| Field | Value |
|---|---|
| **Developer Name** | Authentic How |
| **Support Email** | `auth@authentic.how` |
| **Website (Optional)** | `https://github.com/SeanLebida/journeys` |
| **Privacy Policy URL** | `https://raw.githubusercontent.com/SeanLebida/journeys/development/PRIVACY.md` |

---

## 4. Policy & App Content Declarations

Navigate to **Policy > App content** in Google Play Console and complete each section:

### Privacy Policy
- URL: `https://raw.githubusercontent.com/SeanLebida/journeys/development/PRIVACY.md`

### App Access
- Select: **All functionality is available without special access**
- *(No login, credentials, or membership required).*

### Ads
- Select: **No, my app does not contain ads**

### Content Ratings (IARC Questionnaire)
- **Category:** Reference / News / Educational
- **Violence:** No
- **Sexuality / Nudity:** No
- **Language / Profanity:** No
- **Controlled Substances:** No
- **Promotion of products / age-restricted goods:** No
- **User Interactions / Sharing:** No (no chat, social features, or location sharing)
- **Purchases:** No digital goods or subscriptions
- **Result:** Rated **Everyone / PEGI 3 / USK 0**

### Target Audience and Content
- **Target Age Groups:** 13–15, 16–17, 18 and over
- **Appeal to Children:** "No" (neutral educational reference for general audience)

### Data Safety Questionnaire
> Journeys is 100% offline. Answer **NO** to all data collection questions:

1. **Does your app collect or share any of the required user data types?** &rarr; **No**
2. **Is all of the user data collected by your app encrypted in transit?** &rarr; *(N/A - no data collected)*
3. **Do you provide a way for users to request that their data be deleted?** &rarr; *(N/A - no data stored)*

### Financial Features
- Select: **My app doesn't provide any financial features**

### Government Apps
- Select: **No**

---

## 5. Visual Store Assets Summary

All visual assets are pre-generated and stored in [`docs/store-assets/`](file:///home/vic/DesignShare/Github/Apps/Journeys/docs/store-assets/):

| Asset | File Name | Dimensions | Specs |
|---|---|---|---|
| **App Icon** | `icon-512x512.png` | 512 &times; 512 px | 32-bit PNG, &le;1 MB, no alpha |
| **Feature Graphic** | `feature-graphic-1024x500.png` | 1024 &times; 500 px | PNG, &le;15 MB, no alpha |
| **Screenshot 1** | `screenshot-1-home-atlas.png` | 1080 &times; 1920 px | Home interactive map & mode selector |
| **Screenshot 2** | `screenshot-2-route-trace.png` | 1080 &times; 1920 px | Paul's First Missionary Journey animated trace |
| **Screenshot 3** | `screenshot-3-timeline.png` | 1080 &times; 1920 px | Linear biblical chronology & parallel lanes |
| **Screenshot 4** | `screenshot-4-bible-reader.png` | 1080 &times; 1920 px | Bundled Bible reader cross-referenced to map |
| **Screenshot 5** | `screenshot-5-lesson-mode.png` | 1080 &times; 1920 px | Guided lesson with historical & scripture context |
| **Screenshot 6** | `screenshot-6-quiz-mode.png` | 1080 &times; 1920 px | Interactive archaeology and geography quiz |
| **Screenshot 7** | `screenshot-7-sandbox-atlas.png` | 1080 &times; 1920 px | Sandbox atlas with layer overlays |

---

## 6. How to Upload in Google Play Console

1. In Google Play Console, open your app.
2. Go to **Grow users > Store presence > Main store listing**.
3. Paste the **App name**, **Short description**, and **Full description**.
4. In the **Graphics** section:
   - Upload `docs/store-assets/icon-512x512.png` under **App icon**.
   - Upload `docs/store-assets/feature-graphic-1024x500.png` under **Feature graphic**.
   - Upload all `screenshot-*.png` files under **Phone screenshots**.
5. Click **Save**.
