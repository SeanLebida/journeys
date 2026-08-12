#!/usr/bin/env python3
"""Prophets (major and minor), judges, kings, the Twelve, and the journeys they
walked — the Old-Testament and apostolic half of the atlas that the first nine
journeys left implicit. Idempotent: upserts into the .extra.json layers.

Three things are authored here.

1. SITES the prophetic and monarchic narratives need and the atlas did not yet
   have — Zarephath, Carmel, Dothan, Shunem, Nineveh, Babylon, Susa, the Chebar
   canal, Anathoth, Tahpanhes, Shiloh, En-gedi, Ziklag and the rest. Sourcing
   follows the house rule: a `high` coordinate carries a PLACE-SPECIFIC
   excavation report (Pritchard at Sarepta, Petrie at Defenneh, Finkelstein at
   Shiloh, Koldewey at Babylon…), and anything short of that is `medium` or
   `disputed` with either rival candidates or an explicit note. Tishbe, Cherith,
   Gilgal, Tarshish and Tel-abib are genuinely unlocated and say so.

2. PERSONS as timeline entities. Every writing prophet — four major, twelve
   minor — plus the non-writing prophets, the judges and kings they confronted,
   the twelve apostles, and the post-exilic figures, each carrying a dated
   ministry span, a home site, and the journeys they walk. The major/minor split
   is the conventional one (length of the book, not importance) and the app says
   so where it shows it. Existing persons are PATCHED, not replaced, so the
   hand-authored prose already in persons.json survives.

3. JOURNEYS + STOPS for the figures who actually travel: Samuel's circuit,
   David's flight and reign, Elijah, Elisha, Jonah, Jeremiah, the deportation to
   Babylon, the return under Zerubbabel/Ezra/Nehemiah, and Peter's journeys.
   Prophets who stay put (Isaiah in Jerusalem, Amos at Tekoa) get a home site
   and a timeline bar rather than an invented itinerary.

Dating follows the project's rule — scholarly ranges, never false single-year
precision — with Thiele's regnal scheme as the base for the divided monarchy and
the Assyrian/Babylonian synchronisms as the fixed pins.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "content")


def load(name):
    p = os.path.join(C, name)
    return json.load(open(p)) if os.path.exists(p) else []


def write(name, data):
    with open(os.path.join(C, name), "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


def en(s):
    return {"en": s}


def dr(a, b, disp):
    return {"startYear": a, "endYear": b, "display": en(disp), "approximate": True}


def upsert(arr, items):
    """Replace by id, preserving original order and appending new ids."""
    by = {x["id"]: x for x in arr}
    for it in items:
        by[it["id"]] = it
    out, seen = [], set()
    for x in arr:
        if x["id"] not in seen:
            out.append(by[x["id"]])
            seen.add(x["id"])
    for it in items:
        if it["id"] not in seen:
            out.append(it)
            seen.add(it["id"])
    return out


def patch(arr, patches):
    """Merge fields into existing entries by id (leaves untouched entries alone)."""
    for x in arr:
        if x["id"] in patches:
            x.update(patches[x["id"]])
    return arr


def scripture_cite_id(raw):
    """Mirrors scriptureCitationId() in src/content/accuracy.ts."""
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in raw)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return "cit-scripture-" + slug.strip("-")[:80]


# ── Concrete sourcing ───────────────────────────────────────────────────────
# Excavation reports and standard scholarship. Place-specific reports are what
# license a `high` coordinate; the survey works below back the dating and the
# prophetic chronology, and count as whole-corpus backstops (see
# src/content/accuracy.ts GENERIC_BACKSTOP_IDS) rather than place evidence.
CITES = [
    {
        "id": "cit-exc-sarepta-pritchard",
        "source": en(
            "James B. Pritchard, 'Sarepta: A Preliminary Report on the Iron Age' "
            "(University Museum, University of Pennsylvania, 1975) — excavation report, Sarafand, Lebanon"
        ),
        "kind": "archaeological",
        "note": en("Excavations at Sarafand identified the Iron Age Phoenician town of Sarepta/Zarephath."),
    },
    {
        "id": "cit-exc-dothan-free",
        "source": en(
            "Joseph P. Free, 'The Excavation of Dothan' and season reports, Bulletin of the American Schools "
            "of Oriental Research 131-160 (1953-1960); Daniel M. Master et al. (eds.), 'Dothan I' (Eisenbrauns, 2005)"
        ),
        "kind": "archaeological",
        "note": en("Nine seasons at Tell Dothan fixed the identification of the biblical town."),
    },
    {
        "id": "cit-exc-nineveh-layard",
        "source": en(
            "Austen Henry Layard, 'Nineveh and Its Remains' (John Murray, 1849) and 'Discoveries in the Ruins "
            "of Nineveh and Babylon' (John Murray, 1853) — Kuyunjik excavations"
        ),
        "kind": "archaeological",
        "note": en(
            "The Kuyunjik and Nebi Yunus mounds opposite Mosul, with Sennacherib's palace and the royal library, "
            "identify Nineveh beyond dispute."
        ),
    },
    {
        "id": "cit-exc-babylon-koldewey",
        "source": en(
            "Robert Koldewey, 'The Excavations at Babylon', trans. Agnes S. Johns (Macmillan, 1914) — "
            "Deutsche Orient-Gesellschaft excavations 1899-1917"
        ),
        "kind": "archaeological",
        "note": en("Eighteen seasons exposed the Ishtar Gate, the processional way and the Neo-Babylonian city walls."),
    },
    {
        "id": "cit-exc-susa-perrot",
        "source": en(
            "Jean Perrot (ed.), 'Le palais de Darius à Suse: une résidence royale sur la route de Persépolis à Babylone' "
            "(Presses de l'université Paris-Sorbonne, 2010)"
        ),
        "kind": "archaeological",
        "note": en("French excavations at Shush (Khuzestan) since 1897 identify Susa and the Achaemenid palace of Esther's setting."),
    },
    {
        "id": "cit-exc-tahpanhes-petrie",
        "source": en(
            "W. M. Flinders Petrie, 'Tanis II: Nebesheh (Am) and Defenneh (Tahpanhes)' "
            "(Egypt Exploration Fund, Fourth Memoir, 1888)"
        ),
        "kind": "archaeological",
        "note": en("Tell Defenneh in the eastern Delta, the Greek Daphnae, is the Tahpanhes of Jeremiah 43-44."),
    },
    {
        "id": "cit-exc-shiloh-finkelstein",
        "source": en(
            "Israel Finkelstein (ed.), 'Shiloh: The Archaeology of a Biblical Site' "
            "(Monograph Series 10, Institute of Archaeology, Tel Aviv University, 1993)"
        ),
        "kind": "archaeological",
        "note": en("Khirbet Seilun's Iron I settlement and its destruction layer anchor the Shiloh of Samuel's childhood."),
    },
    {
        "id": "cit-exc-engedi-mazar",
        "source": en(
            "Benjamin Mazar, Trude Dothan & Immanuel Dunayevsky, 'En-Gedi: The First and Second Seasons of Excavations', "
            "'Atiqot 5 (Israel Antiquities Authority, 1966)"
        ),
        "kind": "archaeological",
        "note": en("The Chalcolithic temple and Iron Age settlement at the En-gedi oasis, David's refuge from Saul."),
    },
    {
        "id": "cit-exc-khirbet-a-rai",
        "source": en(
            "Yosef Garfinkel, Saar Ganor & Kyle H. Keimer, 'Khirbet al-Ra'i in the Judean Shephelah: "
            "The 2015-2019 Excavation Seasons', Jerusalem Journal of Archaeology 1 (2021)"
        ),
        "kind": "archaeological",
        "note": en("The excavators propose Khirbet a-Ra'i as Ziklag; the identification is contested and rival tells remain in play."),
    },
    {
        "id": "cit-src-al-yahudu",
        "source": en(
            "Laurie E. Pearce & Cornelia Wunsch, 'Documents of Judean Exiles and West Semites in Babylonia in the "
            "Collection of David Sofer' (Cornell University Studies in Assyriology and Sumerology 28, CDL Press, 2014)"
        ),
        "kind": "primary-ancient",
        "note": en(
            "Cuneiform tablets from al-Yahudu ('the town of Judah') and Našar record deported Judean families by name "
            "in the Babylonian countryside — the documented context for Ezekiel's community by the Chebar."
        ),
    },
    {
        "id": "cit-ref-zadok-diaspora",
        "source": en(
            "Ran Zadok, 'The Earliest Diaspora: Israelites and Judeans in Pre-Hellenistic Mesopotamia' "
            "(Diaspora Research Institute, Tel Aviv University, 2002)"
        ),
        "kind": "secondary-scholarly",
        "note": en("Locates the Judean deportee settlements in the Nippur region; the Chebar (nāru kabaru) is a canal there."),
    },
    {
        "id": "cit-ref-blenkinsopp-prophecy",
        "source": en("Joseph Blenkinsopp, 'A History of Prophecy in Israel', rev. and enl. ed. (Westminster John Knox, 1996)"),
        "kind": "secondary-scholarly",
        "note": en("Standard survey of the prophetic movement, its chronology, and the composition of the prophetic books."),
    },
    {
        "id": "cit-ref-sweeney-twelve",
        "source": en("Marvin A. Sweeney, 'The Twelve Prophets', 2 vols., Berit Olam (Liturgical Press, 2000)"),
        "kind": "secondary-scholarly",
        "note": en("Commentary on the Book of the Twelve; the basis for the minor prophets' dating and audience here."),
    },
    {
        "id": "cit-ref-petersen-prophetic",
        "source": en("David L. Petersen, 'The Prophetic Literature: An Introduction' (Westminster John Knox, 2002)"),
        "kind": "secondary-scholarly",
        "note": en("Introduction to the prophetic corpus, including the contested dating of Joel and Obadiah."),
    },
    {
        "id": "cit-src-eusebius-he",
        "source": en(
            "Eusebius of Caesarea, 'Ecclesiastical History' (Historia Ecclesiastica), 2 vols., trans. Kirsopp Lake & "
            "J. E. L. Oulton, Loeb Classical Library 153/265 (Harvard University Press)"
        ),
        "kind": "primary-ancient",
        "note": en("Fourth-century collection of the earlier traditions about where each apostle went and died; traditions, not documentation."),
    },
]


# ── Sites ───────────────────────────────────────────────────────────────────
def site(sid, ancient, modern_name, modern_loc, lat, lon, conf, cites, summary,
         disputes=None, candidates=None, pleiades=None, review="self-reviewed"):
    coords = {
        "value": {"lat": lat, "lon": lon},
        "confidence": conf,
        "reviewStatus": review,
        "citations": cites,
    }
    if disputes:
        coords["disputes"] = en(disputes)
    s = {
        "id": sid,
        "ancientName": en(ancient),
        "modernLocation": en(modern_loc),
        "coordinates": coords,
        "summary": en(summary),
        "citations": cites,
    }
    if modern_name:
        s["modernName"] = en(modern_name)
    if candidates:
        s["candidates"] = [
            {"label": en(c[0]), "lat": c[1], "lon": c[2], "confidence": c[3], "citations": c[4]}
            for c in candidates
        ]
    if pleiades:
        s["pleiadesId"] = pleiades
    return s


AH = "cit-ref-aharoni"
SB = "cit-ref-sacred-bridge"
ABD = "cit-ref-abd"
NG = "cit-ref-negev-gibson"
BRIGHT = "cit-ref-bright"

SITES = [
    site("site-tishbe", "Tishbe in Gilead", "Listib (el-Istib), Ajloun", "Ajloun Governorate, Jordan",
         32.3383, 35.7275, "disputed", [AH, SB, ABD],
         "Elijah is introduced as 'Elijah the Tishbite, of the inhabitants of Gilead' (1 Kings 17:1) and the town is "
         "never described again. Listib, above Wadi al-Yabis, preserves the name and is the usual candidate; the "
         "Hebrew can also be read as 'of the sojourners of Gilead', which would leave the prophet's home unnamed "
         "altogether.",
         disputes="Tishbe is unlocated. The name survives at Listib/el-Istib and Byzantine pilgrims placed it there, "
                  "but no excavation confirms it, and one reading of the Hebrew text removes the place name entirely."),
    site("site-brook-cherith", "The brook Cherith", "Wadi al-Yabis", "Ajloun/Irbid, Jordan",
         32.3667, 35.6167, "disputed", [AH, ABD],
         "The ravine 'before Jordan' where ravens fed Elijah through the drought (1 Kings 17:2-7). Wadi al-Yabis, "
         "running down to the Jordan below Tishbe, is the traditional identification.",
         disputes="Unlocated. The text places Cherith east of the Jordan; Wadi al-Yabis fits the description and lies "
                  "beside the traditional Tishbe, but any of several Gileadite wadis would suit equally."),
    site("site-zarephath", "Zarephath (Sarepta)", "Sarafand", "South Governorate, Lebanon",
         33.4536, 35.2953, "high", ["cit-exc-sarepta-pritchard", SB],
         "Phoenician coastal town 'which belongeth to Sidon', where Elijah lodged with a widow through the famine, "
         "her jar of meal and cruse of oil sustaining the household, and where her son was restored to life "
         "(1 Kings 17:8-24). Jesus later cites the episode at Nazareth (Luke 4:26).",
         ),
    site("site-mount-carmel", "Mount Carmel", "el-Muhraqa, Carmel range", "Haifa District, Israel",
         32.7222, 35.0500, "medium", [AH, SB, NG],
         "The wooded headland running north-west to the sea, and the stage for the contest between Elijah and the "
         "prophets of Baal, followed by the rain that broke the three-year drought (1 Kings 18). Elisha later kept a "
         "base here (2 Kings 4:25).",
         disputes="The mountain is certain; the spot is not. El-Muhraqa ('the place of burning') at the south-east "
                  "spur has carried the tradition since the Middle Ages and fits the narrative's line of sight to "
                  "the Kishon and the sea, but the text names no site and no excavation marks it."),
    site("site-abel-meholah", "Abel-meholah", "Tell Abu Sus / Tell el-Maqlub (disputed)", "Jordan Valley",
         32.3167, 35.5333, "medium", [AH, ABD],
         "Elisha's home, where Elijah found him ploughing with twelve yoke of oxen and cast his mantle over him "
         "(1 Kings 19:16-21); earlier, part of the route of Gideon's rout of the Midianites (Judges 7:22).",
         candidates=[
             ("Tell Abu Sus, west bank of the Jordan", 32.3167, 35.5333, "medium", [AH, ABD]),
             ("Tell el-Maqlub, Wadi al-Yabis (east bank)", 32.3892, 35.7108, "medium", [AH, SB]),
         ]),
    site("site-dothan", "Dothan", "Tell Dothan", "Jenin Governorate, West Bank",
         32.4103, 35.2003, "high", ["cit-exc-dothan-free", SB],
         "Pasture town on the caravan road north of Shechem where Joseph's brothers sold him to a Midianite caravan "
         "bound for Egypt (Genesis 37:17-28), and where the Aramean army sent to seize Elisha was struck blind and "
         "led to Samaria (2 Kings 6:13-23)."),
    site("site-shunem", "Shunem", "Sulam", "Northern District, Israel",
         32.6033, 35.3358, "medium", [AH, SB, NG],
         "Village on the south-west slope of the hill of Moreh, on Elisha's circuit, where a wealthy woman built him "
         "a room on the roof and where her son was restored to life (2 Kings 4:8-37). The Philistines camped here "
         "before Saul's last battle (1 Samuel 28:4).",
         disputes="The identification with Sulam rests on the survival of the name and on Eusebius' Onomasticon "
                  "placing Sulem five miles south of Tabor; the site itself is largely built over and unexcavated."),
    site("site-gilgal", "Gilgal", "unlocated, near Jericho", "Jordan Valley, West Bank",
         31.8700, 35.4900, "disputed", [AH, ABD, NG],
         "Israel's first camp west of the Jordan, where the twelve stones were set up and the reproach of Egypt "
         "rolled away (Joshua 4-5); later a sanctuary on Samuel's yearly circuit (1 Samuel 7:16), the place where "
         "Saul was made king (1 Samuel 11:15), and a station of the prophetic guilds under Elisha (2 Kings 4:38).",
         disputes="Unlocated despite a century of searching. Khirbet el-Mafjar, Khirbet en-Nitla and Tell "
                  "el-Jurn have all been proposed near Jericho; the Old Testament also uses 'Gilgal' of more than "
                  "one place, so not every reference need mean the same site."),
    site("site-nineveh", "Nineveh", "Kuyunjik and Nebi Yunus, Mosul", "Nineveh Governorate, Iraq",
         36.3597, 43.1528, "high", ["cit-exc-nineveh-layard", ABD],
         "Capital of the Assyrian empire from Sennacherib onward: the 'exceeding great city' Jonah is sent to, the "
         "city Nahum's oracle sees fall, and the seat of the kings whose campaigns against Israel and Judah the "
         "books of Kings record. It fell to a Median-Babylonian coalition in 612 BC.",
         ),
    site("site-tarshish", "Tarshish", "unidentified — western Mediterranean or Cilicia", "location disputed",
         36.9000, -6.3500, "disputed", [ABD, SB, BRIGHT],
         "The far-west destination Jonah bought passage for at Joppa, 'from the presence of the LORD' (Jonah 1:3) — "
         "in the Hebrew Bible a byword for the edge of the known world, the source of silver, iron, tin and lead "
         "(Ezekiel 27:12).",
         disputes="Three identifications compete and none is decisive: Tartessos in south-west Spain (the classical "
                  "reading, and the one that makes Jonah's flight the longest possible), Tarsus in Cilicia, and a "
                  "Sardinian or wider 'refinery/open sea' sense of the word. The pin is placed at Tartessos as the "
                  "majority reading; treat it as a direction of travel, not a located port.",
         candidates=[
             ("Tartessos, Guadalquivir estuary, south-west Spain", 36.9000, -6.3500, "disputed", [ABD, BRIGHT]),
             ("Tarsus in Cilicia", 36.9177, 34.8917, "disputed", [ABD, "cit-src-strabo-14-5-tarsus"]),
             ("Nora / southern Sardinia", 38.9853, 9.0161, "disputed", [ABD, SB]),
         ]),
    site("site-babylon", "Babylon", "Tell Babil, Hillah", "Babil Governorate, Iraq",
         32.5355, 44.4275, "high", ["cit-exc-babylon-koldewey", ABD],
         "Capital of the Neo-Babylonian empire under Nebuchadnezzar II, destination of the three deportations from "
         "Judah, and the setting of Daniel's court narratives. Its fall to Cyrus in 539 BC opened the return.",
         ),
    site("site-susa", "Shushan (Susa)", "Shush", "Khuzestan Province, Iran",
         32.1897, 48.2568, "high", ["cit-exc-susa-perrot", ABD],
         "Achaemenid royal residence in Elam: the citadel of the book of Esther, the setting of Daniel's vision of "
         "the ram and the goat (Daniel 8:2), and the place where Nehemiah, cupbearer to Artaxerxes, heard of "
         "Jerusalem's broken walls (Nehemiah 1:1).",
         ),
    site("site-chebar-canal", "By the river Chebar (Tel-abib)", "Nippur region canal system", "Al-Qadisiyyah, Iraq",
         32.1264, 45.2331, "disputed", ["cit-ref-zadok-diaspora", "cit-src-al-yahudu"],
         "The Judean deportee settlement where Ezekiel lived and received his visions — 'among the captives by the "
         "river Chebar' (Ezekiel 1:1-3, 3:15). The Chebar is generally identified with the nāru kabaru, a major "
         "canal in the Nippur region named in Babylonian records; the pin sits at that canal system, not at a "
         "located village.",
         disputes="Tel-abib itself is unlocated. What is documented is the setting: cuneiform archives from "
                  "al-Yahudu and Našar record deported Judean families farming crown land in exactly this region, "
                  "which is why the canal, not the village, carries the pin."),
    site("site-anathoth", "Anathoth", "Anata / Ras el-Kharrubeh", "Jerusalem Governorate, West Bank",
         31.8036, 35.2569, "medium", [AH, SB, ABD],
         "Priestly town of Benjamin, three miles north-east of Jerusalem, where Abiathar was banished (1 Kings 2:26) "
         "and where Jeremiah was born and bought a field as a sign that houses and lands would be possessed again "
         "(Jeremiah 1:1, 32:6-15). His own townsmen plotted against him (Jeremiah 11:21).",
         candidates=[
             ("Ras el-Kharrubeh (Iron Age remains, 1 km south of Anata)", 31.8036, 35.2569, "medium", [AH, ABD]),
             ("Anata village (preserves the name)", 31.8106, 35.2617, "medium", [AH, SB]),
         ]),
    site("site-tahpanhes", "Tahpanhes", "Tell Defenneh", "Ismailia Governorate, Egypt",
         30.8664, 32.1650, "high", ["cit-exc-tahpanhes-petrie", ABD],
         "Egyptian frontier fortress in the eastern Delta, the Greek Daphnae. The remnant of Judah fled here after "
         "Gedaliah's murder, carrying Jeremiah with them against his counsel; he buried stones at the entry of "
         "Pharaoh's house here as a sign of Nebuchadnezzar's coming (Jeremiah 43:7-13)."),
    site("site-tekoa", "Tekoa", "Khirbet Tequ'a", "Bethlehem Governorate, West Bank",
         31.6333, 35.2333, "medium", [AH, SB, NG],
         "Village on the edge of the Judean wilderness, six miles south of Bethlehem: home of the wise woman Joab "
         "sent to David (2 Samuel 14:2), fortified by Rehoboam (2 Chronicles 11:6), and home of Amos, 'among the "
         "herdmen of Tekoa' (Amos 1:1), who went north to prophesy at Bethel.",
         disputes="The identification rests on the survival of the name at Khirbet Tequ'a and on Jerome, who lived "
                  "within sight of it; the mound itself has seen only limited excavation."),
    site("site-moresheth-gath", "Moresheth-gath", "Tell ej-Judeideh (Tel Goded)", "Judean Shephelah, Israel",
         31.6394, 34.9139, "medium", [AH, SB, ABD],
         "Shephelah village of Micah the prophet (Micah 1:1, 1:14), close to Lachish and the Philistine plain — the "
         "vantage point of his lament over the towns of the lowlands as Sennacherib's army came up.",
         disputes="Tell ej-Judeideh is the usual candidate on the strength of position and Eusebius' notice placing "
                  "Morasthi near Eleutheropolis; the identification is topographic rather than epigraphic."),
    site("site-riblah", "Riblah", "Ribleh", "Homs Governorate, Syria",
         34.4500, 36.5333, "medium", [AH, ABD, SB],
         "Staging camp on the Orontes in the land of Hamath, from which first Pharaoh Necho and then Nebuchadnezzar "
         "controlled the Levant. Jehoahaz was deposed here (2 Kings 23:33), and here Zedekiah watched his sons "
         "killed before being blinded and taken to Babylon (2 Kings 25:6-7).",
         disputes="The modern village of Ribleh on the Orontes preserves the name and suits every notice in Kings "
                  "and Jeremiah, but the site is unexcavated."),
    site("site-shiloh", "Shiloh", "Khirbet Seilun", "Nablus Governorate, West Bank",
         32.0561, 35.2894, "high", ["cit-exc-shiloh-finkelstein", SB],
         "Israel's central sanctuary through the period of the judges: the tabernacle stood here, Hannah prayed and "
         "Samuel was raised here under Eli (1 Samuel 1-3), and here the ark was taken out to Aphek and lost. "
         "Excavation found an Iron I settlement destroyed by fire in the mid-11th century BC — the disaster Jeremiah "
         "later invokes against the temple (Jeremiah 7:12)."),
    site("site-en-gedi", "En-gedi", "Ein Gedi", "Southern District, Israel",
         31.4614, 35.3925, "high", ["cit-exc-engedi-mazar", SB],
         "Spring-fed oasis on the west shore of the Dead Sea, in 'the strongholds of En-gedi' where David hid from "
         "Saul and cut the skirt of his robe in the cave rather than strike him (1 Samuel 24).",
         ),
    site("site-adullam", "Adullam", "Khirbet esh-Sheikh Madhkur", "Judean Shephelah, Israel",
         31.6494, 34.9803, "medium", [AH, SB, NG],
         "Shephelah town with a cave nearby where David took refuge after fleeing Gath, and where 'every one that "
         "was in distress, and every one that was in debt' gathered to him — the beginning of his band of four "
         "hundred (1 Samuel 22:1-2).",
         disputes="Khirbet esh-Sheikh Madhkur, above the Elah valley, is the standard identification on position and "
                  "name; the traditional 'cave of Adullam' shown to pilgrims is a later devotional site."),
    site("site-ziklag", "Ziklag", "Khirbet a-Ra'i / Tell esh-Sharia (disputed)", "Northern Negev, Israel",
         31.5514, 34.8306, "disputed", ["cit-exc-khirbet-a-rai", AH, ABD],
         "Philistine border town Achish of Gath gave David during his sixteen months as a vassal; it became crown "
         "property of the kings of Judah (1 Samuel 27:6). The Amalekites burned it and carried off the families "
         "while David was away, and he pursued and recovered them (1 Samuel 30).",
         disputes="At least four tells have been proposed. The excavators of Khirbet a-Ra'i argue for it on the "
                  "strength of an 11th-10th century Philistine-to-Judahite sequence; others hold to Tell esh-Sharia "
                  "(Tel Sera') or Tel Halif. No inscription names the town.",
         candidates=[
             ("Khirbet a-Ra'i, Judean Shephelah", 31.5514, 34.8306, "disputed", ["cit-exc-khirbet-a-rai"]),
             ("Tell esh-Sharia (Tel Sera')", 31.3939, 34.6797, "disputed", [AH, ABD]),
             ("Tel Halif (Khirbet Khuweilifeh)", 31.3808, 34.8686, "disputed", [AH, SB]),
         ]),
]

SITE_IDS = {s["id"] for s in SITES}


# ── Persons ─────────────────────────────────────────────────────────────────
# Every figure carries the two things the timeline needs — a dated span and a
# place — or explicitly carries neither. `refs` become primary-scripture
# citations automatically; `cites` adds the scholarship behind the dating.
PROPHECY = ["cit-ref-blenkinsopp-prophecy", "cit-ref-petersen-prophetic"]
TWELVE_REF = ["cit-ref-sweeney-twelve"] + PROPHECY
KINGS = ["cit-thiele-chronology", "cit-ref-bright"]
NT = ["cit-ref-keener-bbcnt"]
TRADITION = ["cit-src-eusebius-he"]


def person(pid, name, role, summary, refs, cites, category=None, realm=None, books=None,
           life=None, ministry=None, home=None, sites=None, journeys=None,
           contemporaries=None, dating=None):
    p = {
        "id": pid,
        "name": en(name),
        "role": en(role),
        "summary": en(summary),
        "scriptureRefs": refs,
        "citations": [scripture_cite_id(r) for r in refs] + cites,
    }
    if category:
        p["category"] = category
    if realm:
        p["realm"] = en(realm)
    if books:
        p["books"] = books
    if life:
        p["lifeRange"] = life
    if ministry:
        p["ministryRange"] = ministry
    if home:
        p["homeSiteId"] = home
    if sites:
        p["siteIds"] = sites
    if journeys:
        p["journeyIds"] = journeys
    if contemporaries:
        p["contemporaries"] = contemporaries
    if dating:
        p["datingNote"] = en(dating)
    return p


PERSONS = [
    # ── Prophets without books of their own ────────────────────────────────
    person("person-samuel", "Samuel", "Last of the judges; prophet who anointed Saul and David",
           "Raised at the sanctuary of Shiloh under Eli, Samuel judged Israel on a yearly circuit between Bethel, "
           "Gilgal, Mizpah and his home at Ramah, anointed Saul as Israel's first king, and later anointed David at "
           "Bethlehem.",
           ["1 Samuel 3:19", "1 Samuel 7:15", "1 Samuel 16:13"], PROPHECY + KINGS,
           category="prophet", realm="All Israel, before the monarchy",
           ministry=dr(-1100, -1010, "c. 1100–1010 BC"), home="site-ramah",
           sites=["site-shiloh", "site-mizpah", "site-gilgal", "site-bethel", "site-bethlehem"],
           journeys=["journey-samuel"]),
    person("person-nathan", "Nathan", "Court prophet to David and Solomon",
           "Delivered the dynastic promise to David, confronted him over Bathsheba and Uriah with the parable of the "
           "ewe lamb, and secured Solomon's succession against Adonijah.",
           ["2 Samuel 7:4", "2 Samuel 12:7", "1 Kings 1:34"], PROPHECY,
           category="prophet", realm="Kingdom of Israel under David and Solomon",
           ministry=dr(-1000, -965, "c. 1000–965 BC"), home="site-jerusalem",
           contemporaries=["person-david"]),
    person("person-ahijah", "Ahijah the Shilonite", "Prophet who announced the division of the kingdom",
           "Tore his new garment into twelve pieces before Jeroboam to signify that ten tribes would be torn from "
           "Solomon's house, and later pronounced judgment on the dynasty he had helped raise.",
           ["1 Kings 11:29", "1 Kings 14:6"], PROPHECY + KINGS,
           category="prophet", realm="Northern Kingdom (Israel)",
           ministry=dr(-935, -910, "c. 935–910 BC"), home="site-shiloh"),
    person("person-elijah", "Elijah the Tishbite", "Prophet of the Northern Kingdom under Ahab and Ahaziah",
           "Confronted Ahab and Jezebel over the worship of Baal through a three-year drought, the contest on Mount "
           "Carmel and the judgment on Naboth's vineyard; fled to Horeb, called Elisha at Abel-meholah, and was taken "
           "up beyond the Jordan.",
           ["1 Kings 17:1", "1 Kings 18:21", "1 Kings 19:12", "2 Kings 2:11"], PROPHECY + KINGS,
           category="prophet", realm="Northern Kingdom (Israel)",
           ministry=dr(-875, -848, "c. 875–848 BC"), home="site-tishbe",
           sites=["site-brook-cherith", "site-zarephath", "site-mount-carmel", "site-jezreel", "site-mount-sinai"],
           journeys=["journey-elijah"], contemporaries=["person-ahab", "person-jezebel", "person-elisha"]),
    person("person-elisha", "Elisha", "Successor of Elijah; prophet through six reigns of Israel",
           "Called from the plough at Abel-meholah, he received a double portion of Elijah's spirit and worked for "
           "half a century across the Northern Kingdom — at Jericho, Shunem, Dothan and Samaria — advising kings, "
           "healing Naaman the Syrian, and setting Jehu's revolution in motion.",
           ["1 Kings 19:19", "2 Kings 2:9", "2 Kings 5:14", "2 Kings 9:1"], PROPHECY + KINGS,
           category="prophet", realm="Northern Kingdom (Israel)",
           ministry=dr(-848, -797, "c. 848–797 BC"), home="site-abel-meholah",
           sites=["site-jericho-ot", "site-shunem", "site-dothan", "site-samaria-city", "site-damascus"],
           journeys=["journey-elisha"], contemporaries=["person-elijah", "person-jehu"]),
    person("person-micaiah", "Micaiah son of Imlah", "Prophet who alone foretold Ahab's death at Ramoth-gilead",
           "Summoned reluctantly before Ahab and Jehoshaphat, he contradicted four hundred court prophets and was "
           "imprisoned for it; Ahab died in the battle exactly as he had said.",
           ["1 Kings 22:17", "1 Kings 22:27"], PROPHECY + KINGS,
           category="prophet", realm="Northern Kingdom (Israel)",
           ministry=dr(-860, -853, "c. 860–853 BC"), sites=["site-samaria-city", "site-ramoth-gilead"],
           contemporaries=["person-ahab"]),
    person("person-huldah", "Huldah", "Prophetess consulted over the book found in the temple",
           "When the book of the law was discovered during Josiah's temple repairs, the king's officials took it to "
           "Huldah in Jerusalem; her authentication of it set the reform in motion.",
           ["2 Kings 22:14", "2 Chronicles 34:22"], PROPHECY + KINGS,
           category="prophet", realm="Kingdom of Judah",
           ministry=dr(-625, -620, "c. 625–620 BC"), home="site-jerusalem",
           contemporaries=["person-josiah", "person-jeremiah"]),
    person("person-deborah", "Deborah", "Judge and prophetess; the only woman to lead Israel in the judges period",
           "Judged Israel from beneath a palm between Ramah and Bethel, summoned Barak to face Sisera's chariots at "
           "the Kishon below Mount Tabor, and sang the victory song that is among the oldest poetry in the Hebrew "
           "Bible.",
           ["Judges 4:4", "Judges 5:7"], PROPHECY + ["cit-ref-provan-history"],
           category="judge", realm="The northern tribes",
           ministry=dr(-1200, -1125, "c. 1200–1125 BC — judges chronology is approximate"),
           sites=["site-mount-tabor", "site-bethel"],
           dating="The judges' terms are given as round numbers and may overlap regionally rather than run "
                  "consecutively, so any absolute date for Deborah is a placement within the period, not a fix."),
    person("person-gideon", "Gideon (Jerubbaal)", "Judge who broke the Midianite raids",
           "Threshing wheat in a winepress to hide it from raiders, he was called to tear down his father's altar of "
           "Baal and then routed the Midianite camp below the hill of Moreh with three hundred men, torches and "
           "trumpets.",
           ["Judges 6:11", "Judges 7:7"], ["cit-ref-provan-history", "cit-ref-bright"],
           category="judge", realm="Manasseh and the northern tribes",
           ministry=dr(-1191, -1144, "c. 1191–1144 BC — judges chronology is approximate"),
           sites=["site-spring-of-harod", "site-abel-meholah"],
           dating="Dated only by the internal sequence of Judges, which gives round figures and may run in parallel "
                  "across regions."),
    person("person-samson", "Samson", "Judge of the Danite border against the Philistines",
           "A Nazirite from birth whose career was a running personal feud along the Philistine frontier, ending at "
           "Gaza when he pulled down the temple of Dagon.",
           ["Judges 13:24", "Judges 16:30"], ["cit-ref-provan-history"],
           category="judge", realm="Dan and the Philistine frontier",
           ministry=dr(-1120, -1100, "c. 1120–1100 BC — judges chronology is approximate"),
           sites=["site-beth-shemesh"],
           dating="Placed late in the judges period by the Philistine setting; the absolute date is not recoverable."),
    person("person-john-the-baptist", "John the Baptist", "Prophet of the wilderness; forerunner of Jesus",
           "Preached repentance and baptized in the Jordan, identified Jesus at his baptism, and was imprisoned and "
           "executed by Herod Antipas — an execution Josephus independently records.",
           ["Matthew 3:1", "Mark 1:4", "Luke 3:3", "John 1:29"], NT + ["cit-wit-josephus-baptist"],
           category="prophet", realm="Judea and Perea",
           life=dr(-6, 30, "c. 6 BC – AD 28/30"), ministry=dr(27, 30, "c. AD 27–29"),
           home="site-baptism-at-the-jordan", contemporaries=["person-jesus"]),

    # ── Major prophets ─────────────────────────────────────────────────────
    person("person-isaiah", "Isaiah son of Amoz", "Major prophet of Jerusalem, through four reigns of Judah",
           "Called in the year King Uzziah died, Isaiah advised Ahaz and Hezekiah through the Syro-Ephraimite war and "
           "Sennacherib's invasion of 701 BC, insisting that Judah's security lay in trust rather than in alliances "
           "with Egypt or Assyria.",
           ["Isaiah 1:1", "Isaiah 6:8", "Isaiah 37:6"], PROPHECY + KINGS,
           category="prophet-major", realm="Kingdom of Judah", books=["Isaiah"],
           ministry=dr(-740, -681, "c. 740–681 BC"), home="site-jerusalem",
           sites=["site-lachish"], contemporaries=["person-hezekiah", "person-micah"],
           dating="Chapters 40–66 address the exile and the return, and most critical scholars assign them to later "
                  "hands in the same tradition; others read the whole book as the 8th-century prophet's. The "
                  "ministry dates here cover the figure of chapters 1–39, whose setting is fixed by the reigns named "
                  "in Isaiah 1:1."),
    person("person-jeremiah", "Jeremiah", "Major prophet of Judah's last forty years",
           "A priest's son from Anathoth, called in Josiah's thirteenth year, who watched the reform fail, the city "
           "besieged twice, and the temple burned. Imprisoned, thrown into a cistern, and finally carried into Egypt "
           "by the fleeing remnant against his own counsel.",
           ["Jeremiah 1:1", "Jeremiah 31:31", "Jeremiah 38:6", "Jeremiah 43:6"], PROPHECY + KINGS,
           category="prophet-major", realm="Kingdom of Judah", books=["Jeremiah", "Lamentations"],
           ministry=dr(-627, -582, "c. 627–582 BC"), home="site-anathoth",
           sites=["site-jerusalem", "site-ramah", "site-mizpah", "site-tahpanhes"],
           journeys=["journey-jeremiah"], contemporaries=["person-josiah", "person-zedekiah", "person-baruch"],
           dating="Lamentations is ascribed to Jeremiah by tradition (and by the Septuagint's superscription); the "
                  "book itself is anonymous."),
    person("person-ezekiel", "Ezekiel", "Major prophet of the exile, by the river Chebar",
           "A priest deported in 597 BC with Jehoiachin, who prophesied to the exile community in Babylonia — first "
           "that Jerusalem would certainly fall, then, once it had, of a valley of dry bones raised and a restored "
           "temple.",
           ["Ezekiel 1:1", "Ezekiel 24:2", "Ezekiel 37:4"], PROPHECY + ["cit-ref-zadok-diaspora"],
           category="prophet-major", realm="The Judean exiles in Babylonia", books=["Ezekiel"],
           ministry=dr(-593, -571, "c. 593–571 BC"), home="site-chebar-canal",
           sites=["site-jerusalem", "site-babylon"], journeys=["journey-exile"],
           contemporaries=["person-jeremiah", "person-daniel"]),
    person("person-daniel", "Daniel", "Exile in the Babylonian and Persian courts; visionary",
           "Taken to Babylon among the young men of the royal seed at the first deportation, he served under "
           "Nebuchadnezzar and into the Persian period, and the book bearing his name pairs court narratives with "
           "apocalyptic visions of successive empires.",
           ["Daniel 1:6", "Daniel 2:28", "Daniel 6:10", "Daniel 8:2"], PROPHECY + ["cit-ref-bright"],
           category="prophet-major", realm="The Babylonian and Persian courts", books=["Daniel"],
           ministry=dr(-605, -536, "c. 605–536 BC"), home="site-babylon", sites=["site-susa"],
           journeys=["journey-exile"],
           dating="The book's own setting is the 6th century. Critical scholarship generally dates its composition, "
                  "or at least chapters 7–12, to the Maccabean crisis of the 160s BC on the basis of its detailed "
                  "Hellenistic references; conservative scholarship holds to a 6th-century composition. The dates "
                  "here are those of the narrative setting."),

    # ── The Twelve (minor prophets) ────────────────────────────────────────
    person("person-hosea", "Hosea son of Beeri", "Minor prophet to the Northern Kingdom in its last generation",
           "Prophesied through the collapse of Israel after Jeroboam II, making his own broken marriage the figure of "
           "a covenant Israel had abandoned — and of a love that would not let go.",
           ["Hosea 1:1", "Hosea 11:8"], TWELVE_REF,
           category="prophet-minor", realm="Northern Kingdom (Israel)", books=["Hosea"],
           ministry=dr(-755, -715, "c. 755–715 BC"), home="site-samaria-city",
           contemporaries=["person-amos", "person-isaiah"]),
    person("person-joel", "Joel son of Pethuel", "Minor prophet of the day of the LORD",
           "Reads a locust plague as a summons to repentance and a foreshadowing of the day of the LORD, with the "
           "promise of the Spirit poured out on all flesh that Peter quotes at Pentecost.",
           ["Joel 1:1", "Joel 2:28"], TWELVE_REF,
           category="prophet-minor", realm="Kingdom of Judah", books=["Joel"],
           ministry=dr(-835, -400, "date disputed: 9th century BC or post-exilic (c. 500–400 BC)"),
           home="site-jerusalem",
           dating="Joel names no king, which is why its date is the most open in the Twelve. A 9th-century setting "
                  "under Joash and a post-exilic setting after the temple's rebuilding are both well argued; the "
                  "span shown covers both rather than choosing."),
    person("person-amos", "Amos of Tekoa", "Herdsman of Judah sent to prophesy against Israel",
           "A sheep-breeder and dresser of sycamore figs from Tekoa in Judah, sent north to the royal sanctuary at "
           "Bethel to indict Israel's prosperity for resting on the ruin of the poor — and told by its priest to go "
           "home.",
           ["Amos 1:1", "Amos 5:24", "Amos 7:14"], TWELVE_REF,
           category="prophet-minor", realm="Northern Kingdom (Israel)", books=["Amos"],
           ministry=dr(-760, -750, "c. 760–750 BC"), home="site-tekoa", sites=["site-bethel", "site-samaria-city"],
           contemporaries=["person-hosea", "person-jeroboam-ii"]),
    person("person-obadiah", "Obadiah", "Minor prophet; the shortest book in the Hebrew Bible",
           "Twenty-one verses against Edom for standing by — and joining in — on the day Jerusalem fell.",
           ["Obadiah 1:1", "Obadiah 1:11"], TWELVE_REF,
           category="prophet-minor", realm="Edom and the survivors of Judah", books=["Obadiah"],
           ministry=dr(-586, -553, "c. 586–553 BC (an earlier 9th-century setting is also argued)"),
           home="site-jerusalem",
           dating="The natural reading ties the oracle to Edom's conduct at Jerusalem's fall in 586 BC; a minority "
                  "reads it against the earlier raid of 2 Chronicles 21 and dates it to the 9th century."),
    person("person-jonah", "Jonah son of Amittai", "Minor prophet sent to Nineveh",
           "The one prophet of the Twelve whose book is a narrative about the prophet rather than a collection of his "
           "oracles: sent to Assyria's capital, he fled by sea for Tarshish, was brought back, preached, and then "
           "resented the mercy that followed. 2 Kings 14:25 places him under Jeroboam II.",
           ["Jonah 1:1", "Jonah 3:4", "Jonah 4:11", "2 Kings 14:25"], TWELVE_REF,
           category="prophet-minor", realm="Northern Kingdom (Israel); sent to Assyria", books=["Jonah"],
           ministry=dr(-785, -760, "c. 785–760 BC (the setting given by 2 Kings 14:25)"),
           home="site-joppa", sites=["site-nineveh", "site-tarshish"], journeys=["journey-jonah"],
           dating="The prophet is dated by 2 Kings 14:25 to Jeroboam II's reign. The book about him is widely dated "
                  "later, on linguistic grounds, and read by many as a didactic narrative; that is a question about "
                  "the book, not about where its events are set."),
    person("person-micah", "Micah of Moresheth", "Minor prophet of the Judean lowlands",
           "A countryman from the Shephelah whose oracles run from the ruin of Samaria and the villages of the "
           "lowlands to the promise of a ruler from Bethlehem — and to the summary the tradition remembers best: to "
           "do justly, love mercy, and walk humbly.",
           ["Micah 1:1", "Micah 5:2", "Micah 6:8"], TWELVE_REF,
           category="prophet-minor", realm="Kingdom of Judah", books=["Micah"],
           ministry=dr(-737, -690, "c. 737–690 BC"), home="site-moresheth-gath",
           sites=["site-jerusalem", "site-lachish"], contemporaries=["person-isaiah", "person-hezekiah"]),
    person("person-nahum", "Nahum the Elkoshite", "Minor prophet of Nineveh's fall",
           "An oracle against Assyria, whose capital fell to a Median-Babylonian coalition in 612 BC — read in Judah "
           "as the end of a century of tribute and terror.",
           ["Nahum 1:1", "Nahum 3:7"], TWELVE_REF,
           category="prophet-minor", realm="Kingdom of Judah; against Assyria", books=["Nahum"],
           ministry=dr(-663, -612, "c. 663–612 BC (between Thebes' fall and Nineveh's)"),
           home="site-jerusalem", sites=["site-nineveh"],
           dating="Bracketed by the book itself: it looks back on the sack of Thebes (663 BC) and forward to "
                  "Nineveh's fall (612 BC). Elkosh, the prophet's town, is unlocated."),
    person("person-habakkuk", "Habakkuk", "Minor prophet who argued with God about justice",
           "Asks why God tolerates violence in Judah, is told the Chaldeans are coming, and asks how that can "
           "possibly be an answer — the book is the argument, ending in a psalm of trust without resolution.",
           ["Habakkuk 1:2", "Habakkuk 2:4", "Habakkuk 3:19"], TWELVE_REF,
           category="prophet-minor", realm="Kingdom of Judah", books=["Habakkuk"],
           ministry=dr(-640, -598, "c. 640–598 BC (Babylon rising, Jerusalem not yet fallen)"),
           home="site-jerusalem"),
    person("person-zephaniah", "Zephaniah", "Minor prophet of Josiah's reign",
           "Announces a day of the LORD against Judah's syncretism and the surrounding nations, in the years of "
           "Josiah's reform.",
           ["Zephaniah 1:1", "Zephaniah 3:17"], TWELVE_REF,
           category="prophet-minor", realm="Kingdom of Judah", books=["Zephaniah"],
           ministry=dr(-640, -609, "c. 640–609 BC"), home="site-jerusalem",
           contemporaries=["person-josiah", "person-jeremiah"]),
    person("person-haggai", "Haggai", "Minor prophet of the temple's rebuilding",
           "In the second year of Darius he told a discouraged community that the half-built temple was the reason "
           "their own affairs went nowhere; the work resumed within a month.",
           ["Haggai 1:1", "Haggai 2:9"], TWELVE_REF,
           category="prophet-minor", realm="The returned community in Judah", books=["Haggai"],
           ministry=dr(-520, -518, "520 BC (dated to the month by the book itself)"),
           home="site-jerusalem", journeys=["journey-return"],
           contemporaries=["person-zerubbabel", "person-zechariah-prophet"]),
    person("person-zechariah-prophet", "Zechariah son of Berechiah", "Minor prophet alongside Haggai",
           "Began two months after Haggai with a series of night visions, urging the same rebuilding and looking "
           "beyond it to a cleansed city and a coming king riding on a donkey.",
           ["Zechariah 1:1", "Zechariah 9:9"], TWELVE_REF,
           category="prophet-minor", realm="The returned community in Judah", books=["Zechariah"],
           ministry=dr(-520, -480, "c. 520–480 BC"), home="site-jerusalem", journeys=["journey-return"],
           contemporaries=["person-haggai", "person-zerubbabel"]),
    person("person-malachi", "Malachi", "Last of the Twelve",
           "A disputation with a settled, disillusioned community about half-hearted offerings, broken marriages and "
           "withheld tithes, closing the Hebrew prophets with the promise of Elijah's return.",
           ["Malachi 1:1", "Malachi 3:1", "Malachi 4:5"], TWELVE_REF,
           category="prophet-minor", realm="The returned community in Judah", books=["Malachi"],
           ministry=dr(-460, -430, "c. 460–430 BC"), home="site-jerusalem",
           dating="'Malachi' means 'my messenger' and may be a title rather than a name; the date rests on the book's "
                  "setting — a functioning temple, a Persian governor, and the abuses Nehemiah also confronts."),

    # ── Kings of Israel and Judah ──────────────────────────────────────────
    person("person-saul", "Saul son of Kish", "First king of Israel",
           "Anointed by Samuel and acclaimed at Gilgal, he broke the Ammonite and Philistine pressure on the hill "
           "country but lost Samuel's backing, pursued David for years, and died with his sons on Mount Gilboa.",
           ["1 Samuel 10:1", "1 Samuel 13:14", "1 Samuel 31:6"], KINGS,
           category="king", realm="United monarchy", ministry=dr(-1050, -1010, "reigned c. 1050–1010 BC"),
           home="site-gibeah", sites=["site-michmash", "site-mount-gilboa"],
           contemporaries=["person-samuel", "person-david"]),
    person("person-david", "David son of Jesse", "King of Judah and then of all Israel",
           "Anointed at Bethlehem while Saul still reigned, he rose through Saul's court, spent years as a fugitive "
           "in the Judean wilderness and a Philistine vassal at Ziklag, was made king at Hebron, took the Jebusite "
           "stronghold of Zion for his capital, and brought the ark there. The Tel Dan stele's reference to the "
           "'house of David' is the earliest extra-biblical mention of the dynasty.",
           ["1 Samuel 16:13", "2 Samuel 5:4", "2 Samuel 7:16", "Psalms 51:1"], KINGS + ["cit-ref-provan-history"],
           category="king", realm="United monarchy", books=["Psalms"],
           life=dr(-1040, -970, "c. 1040–970 BC"), ministry=dr(-1010, -970, "reigned c. 1010–970 BC"),
           home="site-jerusalem",
           sites=["site-bethlehem", "site-valley-of-elah", "site-adullam", "site-en-gedi", "site-ziklag",
                  "site-hebron-machpelah", "site-mahanaim"],
           journeys=["journey-david"], contemporaries=["person-samuel", "person-saul", "person-nathan"],
           dating="Seventy-three psalms carry a Davidic superscription; the superscriptions are ancient but are not "
                  "themselves part of the psalms, and how much of the Psalter goes back to David is debated."),
    person("person-solomon", "Solomon", "King of Israel; builder of the first temple",
           "Succeeded David after Adonijah's failed bid, built the temple and palace complex in Jerusalem, and "
           "presided over the empire's high-water mark — at a cost in forced labour that split the kingdom the "
           "moment he died.",
           ["1 Kings 3:9", "1 Kings 6:1", "1 Kings 11:11"], KINGS,
           category="king", realm="United monarchy", books=["Proverbs", "Ecclesiastes", "Song of Solomon"],
           ministry=dr(-970, -931, "reigned c. 970–931 BC"), home="site-jerusalem",
           sites=["site-megiddo", "site-hazor"],
           dating="Ascription of Proverbs, Ecclesiastes and the Song to Solomon is traditional; each book's own "
                  "composition history is debated."),
    person("person-rehoboam", "Rehoboam", "First king of Judah after the division",
           "His refusal at Shechem to lighten his father's levies split the kingdom; he kept Judah and Benjamin and "
           "lost the other ten tribes in a day.",
           ["1 Kings 12:14", "2 Chronicles 11:5"], KINGS,
           category="king", realm="Kingdom of Judah", ministry=dr(-931, -913, "reigned c. 931–913 BC"),
           home="site-jerusalem", sites=["site-shechem-ot", "site-lachish"]),
    person("person-jeroboam-i", "Jeroboam son of Nebat", "First king of the Northern Kingdom",
           "Solomon's overseer of the forced levy, exiled to Egypt and recalled at the division, he set up golden "
           "calves at Bethel and Dan so the northern tribes would not go up to Jerusalem — the sin every later king "
           "of Israel is measured against.",
           ["1 Kings 12:20", "1 Kings 12:28"], KINGS,
           category="king", realm="Northern Kingdom (Israel)", ministry=dr(-931, -910, "reigned c. 931–910 BC"),
           home="site-shechem-ot", sites=["site-bethel", "site-dan"], contemporaries=["person-ahijah"]),
    person("person-ahab", "Ahab son of Omri", "King of Israel; Elijah's antagonist",
           "Built Samaria into a regional power and married Jezebel of Sidon, whose Baal cult Elijah spent his "
           "ministry opposing. Assyrian records place him at the battle of Qarqar in 853 BC with two thousand "
           "chariots — the earliest firm synchronism for an Israelite king.",
           ["1 Kings 16:30", "1 Kings 21:19", "1 Kings 22:34"], KINGS + ["cit-ref-anet"],
           category="king", realm="Northern Kingdom (Israel)", ministry=dr(-874, -853, "reigned c. 874–853 BC"),
           home="site-samaria-city", sites=["site-jezreel", "site-qarqar", "site-ramoth-gilead"],
           contemporaries=["person-elijah", "person-jezebel"]),
    person("person-jezebel", "Jezebel", "Queen of Israel; daughter of Ethbaal of Sidon",
           "Brought the Tyrian Baal cult into the Israelite court, had the prophets of the LORD killed and Naboth "
           "judicially murdered for his vineyard, and died at Jezreel in Jehu's coup.",
           ["1 Kings 16:31", "1 Kings 21:15", "2 Kings 9:33"], KINGS,
           category="ruler", realm="Northern Kingdom (Israel)", ministry=dr(-874, -841, "c. 874–841 BC"),
           home="site-samaria-city", sites=["site-jezreel", "site-tyre-and-sidon"],
           contemporaries=["person-ahab", "person-elijah", "person-jehu"]),
    person("person-jehu", "Jehu son of Nimshi", "King of Israel; ended the house of Omri",
           "Anointed at Ramoth-gilead by Elisha's messenger, he killed Joram, Ahaziah and Jezebel and destroyed the "
           "Baal temple at Samaria. The Black Obelisk of Shalmaneser III shows him — or his envoy — paying tribute in "
           "841 BC, the only likely contemporary image of an Israelite king.",
           ["2 Kings 9:6", "2 Kings 10:28"], KINGS + ["cit-ref-anet"],
           category="king", realm="Northern Kingdom (Israel)", ministry=dr(-841, -814, "reigned c. 841–814 BC"),
           home="site-samaria-city", sites=["site-jezreel", "site-ramoth-gilead"],
           contemporaries=["person-elisha"]),
    person("person-jeroboam-ii", "Jeroboam II", "King of Israel at its greatest extent",
           "Restored Israel's borders 'from the entering of Hamath unto the sea of the plain' in a long, prosperous "
           "reign — the reign Amos and Hosea address, and the one Jonah is dated to.",
           ["2 Kings 14:23", "2 Kings 14:25"], KINGS,
           category="king", realm="Northern Kingdom (Israel)", ministry=dr(-793, -753, "reigned c. 793–753 BC"),
           home="site-samaria-city", contemporaries=["person-amos", "person-hosea", "person-jonah"]),
    person("person-hezekiah", "Hezekiah", "King of Judah through Sennacherib's invasion",
           "Centralized worship in Jerusalem, cut the Siloam tunnel to secure the city's water, and survived the "
           "Assyrian siege of 701 BC. Sennacherib's own prism boasts of shutting him up 'like a bird in a cage' — and "
           "does not claim to have taken the city.",
           ["2 Kings 18:5", "2 Kings 19:15", "2 Chronicles 32:30"],
           KINGS + ["cit-arch-sennacherib-prism-bm", "cit-arch-hezekiah-bulla-mazar"],
           category="king", realm="Kingdom of Judah", ministry=dr(-715, -686, "reigned c. 715–686 BC"),
           home="site-jerusalem", sites=["site-lachish"], contemporaries=["person-isaiah", "person-micah"]),
    person("person-josiah", "Josiah", "Reforming king of Judah",
           "Came to the throne as a child, purged the high places, and centralized the Passover on Jerusalem after "
           "the book of the law was found during temple repairs. He was killed at Megiddo intercepting Pharaoh Necho "
           "in 609 BC.",
           ["2 Kings 22:2", "2 Kings 23:25", "2 Chronicles 35:22"], KINGS,
           category="king", realm="Kingdom of Judah", ministry=dr(-640, -609, "reigned c. 640–609 BC"),
           home="site-jerusalem", sites=["site-megiddo", "site-bethel"],
           contemporaries=["person-jeremiah", "person-huldah", "person-zephaniah"]),
    person("person-zedekiah", "Zedekiah", "Last king of Judah",
           "Installed by Nebuchadnezzar and pushed by his court into revolt, he watched the siege of 588–586 BC end "
           "in the burning of the temple; captured near Jericho, he was taken to Riblah, saw his sons killed, was "
           "blinded, and was carried to Babylon.",
           ["2 Kings 24:18", "2 Kings 25:7", "Jeremiah 38:19"], KINGS + ["cit-src-livius-abc5"],
           category="king", realm="Kingdom of Judah", ministry=dr(-597, -586, "reigned 597–586 BC"),
           home="site-jerusalem", sites=["site-riblah", "site-babylon"], journeys=["journey-exile"],
           contemporaries=["person-jeremiah", "person-nebuchadnezzar"]),

    # ── Foreign rulers who set the chronology ──────────────────────────────
    person("person-nebuchadnezzar", "Nebuchadnezzar II", "King of Babylon; took Jerusalem",
           "Broke Egyptian power at Carchemish in 605 BC and took Jerusalem three times — 605, 597 and 586 BC. The "
           "Babylonian Chronicle records the capture of 'the city of Judah' in his seventh year to the day, which is "
           "why this stretch of the chronology is the firmest in the Old Testament.",
           ["2 Kings 24:1", "Daniel 2:1", "Jeremiah 39:1"],
           ["cit-src-livius-abc5", "cit-ref-grayson-chronicles", "cit-ref-bright"],
           category="ruler", realm="Neo-Babylonian empire", ministry=dr(-605, -562, "reigned 605–562 BC"),
           home="site-babylon", sites=["site-carchemish", "site-jerusalem", "site-riblah"]),
    person("person-cyrus", "Cyrus II of Persia", "King who ended the exile",
           "Took Babylon in 539 BC and authorized subject peoples to return and rebuild their sanctuaries — the "
           "policy Ezra 1 records for Judah, and the Cyrus Cylinder states in general terms for Babylonia.",
           ["2 Chronicles 36:23", "Ezra 1:2", "Isaiah 45:1"],
           ["cit-arch-cyrus-cylinder-bm", "cit-ref-bright"],
           category="ruler", realm="Achaemenid Persian empire", ministry=dr(-559, -530, "reigned 559–530 BC"),
           home="site-babylon", journeys=["journey-return"]),

    # ── The return ─────────────────────────────────────────────────────────
    person("person-zerubbabel", "Zerubbabel", "Governor who led the first return and rebuilt the temple",
           "Grandson of the exiled king Jehoiachin, he led the first company home under Cyrus' decree, laid the "
           "temple's foundation, and — prodded by Haggai and Zechariah — saw it finished in 516 BC.",
           ["Ezra 3:8", "Haggai 2:23", "Zechariah 4:9"], ["cit-ref-bright", "cit-ref-provan-history"],
           category="ruler", realm="Yehud under Persian rule", ministry=dr(-538, -515, "c. 538–515 BC"),
           home="site-jerusalem", sites=["site-babylon"], journeys=["journey-return"],
           contemporaries=["person-haggai", "person-zechariah-prophet"]),
    person("person-ezra", "Ezra", "Priest and scribe who brought the law back to Jerusalem",
           "Came up from Babylon with a royal commission, a caravan and the law, and read it aloud to the assembled "
           "people at the Water Gate — the beginning of a community defined by a text rather than a monarchy.",
           ["Ezra 7:6", "Ezra 7:10", "Nehemiah 8:3"], ["cit-ref-bright", "cit-ref-provan-history"],
           category="priest", realm="Yehud under Persian rule", books=["Ezra"],
           ministry=dr(-458, -430, "c. 458–430 BC"), home="site-jerusalem", sites=["site-babylon"],
           journeys=["journey-return"],
           dating="Whether Ezra preceded or followed Nehemiah depends on which Artaxerxes his 'seventh year' belongs "
                  "to; the traditional order (Ezra 458, Nehemiah 445) is followed here, with the reversal noted."),
    person("person-nehemiah", "Nehemiah", "Cupbearer to Artaxerxes; rebuilt Jerusalem's walls",
           "Heard in the citadel at Susa that Jerusalem's walls were still broken, obtained a commission as governor, "
           "and rebuilt them in fifty-two days against sustained local opposition.",
           ["Nehemiah 1:1", "Nehemiah 2:5", "Nehemiah 6:15"], ["cit-ref-bright", "cit-ref-provan-history"],
           category="ruler", realm="Yehud under Persian rule", books=["Nehemiah"],
           ministry=dr(-445, -420, "c. 445–420 BC"), home="site-jerusalem", sites=["site-susa"],
           journeys=["journey-return"], contemporaries=["person-ezra"]),
    person("person-esther", "Esther (Hadassah)", "Jewish queen of Persia",
           "A Jewish exile who became queen to Ahasuerus (Xerxes I) and used that position to expose Haman's plot "
           "against her people — the origin of the feast of Purim.",
           ["Esther 2:7", "Esther 4:14", "Esther 9:26"], ["cit-exc-susa-perrot", "cit-ref-bright"],
           category="ruler", realm="The Jewish community of the Persian empire", books=["Esther"],
           ministry=dr(-483, -473, "c. 483–473 BC (the reign of Xerxes I)"), home="site-susa",
           contemporaries=["person-mordecai"]),
    person("person-mordecai", "Mordecai", "Benjaminite of Susa; Esther's guardian",
           "Sat in the king's gate, refused to bow to Haman, uncovered a plot against the king, and rose to be second "
           "in the empire.",
           ["Esther 2:5", "Esther 10:3"], ["cit-exc-susa-perrot"],
           category="other", realm="The Jewish community of the Persian empire",
           ministry=dr(-483, -473, "c. 483–473 BC"), home="site-susa", contemporaries=["person-esther"]),
    person("person-baruch", "Baruch son of Neriah", "Jeremiah's scribe",
           "Wrote Jeremiah's oracles on a scroll and read them in the temple; when the king cut it up and burned it "
           "piece by piece, he wrote it out again with more added. A bulla bearing a 'Berechiah son of Neriah the "
           "scribe' is known, though its provenance is unprovenanced and disputed.",
           ["Jeremiah 36:4", "Jeremiah 36:32", "Jeremiah 45:1"], ["cit-ref-blenkinsopp-prophecy"],
           category="other", realm="Kingdom of Judah", ministry=dr(-605, -582, "c. 605–582 BC"),
           home="site-jerusalem", sites=["site-tahpanhes"], journeys=["journey-jeremiah"],
           contemporaries=["person-jeremiah"]),

    # ── The Twelve ─────────────────────────────────────────────────────────
    # Ministry span = the Gospel years; where a tradition carries an apostle
    # further, `lifeRange` extends to the traditional death and the summary
    # labels it a tradition rather than a record.
    person("person-andrew", "Andrew", "Apostle; brother of Simon Peter",
           "A fisherman of Bethsaida and a disciple of John the Baptist first, he brought his brother Simon to Jesus. "
           "Later tradition sends him to Scythia and the Black Sea coast and has him crucified at Patras.",
           ["Matthew 4:18", "John 1:40", "John 6:8"], NT + TRADITION,
           category="apostle", realm="Galilee, then (by tradition) Scythia and Achaia",
           life=dr(-5, 70, "c. 5 BC – c. AD 60/70 (traditional)"), ministry=dr(27, 60, "c. AD 27–60"),
           home="site-bethsaida", sites=["site-capernaum", "site-jerusalem"],
           journeys=["journey-ministry", "journey-apostolic-traditions"]),
    person("person-james-zebedee", "James son of Zebedee", "Apostle; first of the Twelve to be killed",
           "One of the three admitted to the transfiguration and Gethsemane; Herod Agrippa I had him killed with the "
           "sword around AD 44, the only apostle whose death the New Testament records.",
           ["Matthew 4:21", "Mark 5:37", "Acts 12:2"], NT,
           category="apostle", realm="Galilee and Jerusalem",
           life=dr(-5, 44, "c. 5 BC – c. AD 44"), ministry=dr(27, 44, "c. AD 27–44"),
           home="site-capernaum", sites=["site-sea-of-galilee", "site-jerusalem"],
           journeys=["journey-ministry"]),
    person("person-john-apostle", "John son of Zebedee", "Apostle; the disciple 'whom Jesus loved' in the Fourth Gospel",
           "Brother of James, one of the inner three, and by long tradition the evangelist of the Fourth Gospel, the "
           "three letters, and the Revelation given on Patmos. Tradition places his last years at Ephesus.",
           ["Mark 1:19", "John 19:26", "Revelation 1:9"], NT + TRADITION,
           category="apostle", realm="Galilee, Jerusalem, then (by tradition) Asia Minor",
           books=["John", "1 John", "2 John", "3 John", "Revelation"],
           life=dr(-5, 100, "c. 5 BC – c. AD 100 (traditional)"), ministry=dr(27, 100, "c. AD 27–100"),
           home="site-capernaum", sites=["site-jerusalem", "site-ephesus", "site-patmos"],
           journeys=["journey-ministry", "journey-apostolic-traditions"],
           dating="Authorship of the Johannine books is debated: the Gospel is anonymous, and Revelation names a "
                  "'John' on Patmos without identifying him as the apostle. The ascriptions here are the traditional "
                  "ones, recorded as such."),
    person("person-philip-apostle", "Philip the Apostle", "One of the Twelve; from Bethsaida",
           "Called early and the one who brought Nathanael; tradition sends him to Phrygia and places his death at "
           "Hierapolis, where a first-century tomb and a martyrium have been excavated. Not to be confused with "
           "Philip the Evangelist, one of the Seven.",
           ["John 1:43", "John 6:5", "John 14:8"], NT + TRADITION,
           category="apostle", realm="Galilee, then (by tradition) Phrygia",
           life=dr(-5, 80, "c. 5 BC – c. AD 80 (traditional)"), ministry=dr(27, 80, "c. AD 27–80"),
           home="site-bethsaida", sites=["site-hierapolis"],
           journeys=["journey-ministry", "journey-apostolic-traditions"]),
    person("person-bartholomew", "Bartholomew (Nathanael)", "One of the Twelve",
           "Listed among the Twelve in all three synoptic lists and in Acts; generally identified with the Nathanael "
           "of the Fourth Gospel, called from under the fig tree. Traditions send him to Armenia and India.",
           ["Matthew 10:3", "John 1:47", "Acts 1:13"], NT + TRADITION,
           category="apostle", realm="Galilee, then (by tradition) Armenia",
           ministry=dr(27, 70, "c. AD 27–70"), home="site-cana-of-galilee",
           journeys=["journey-ministry", "journey-apostolic-traditions"]),
    person("person-thomas", "Thomas (Didymus)", "One of the Twelve; 'doubting Thomas'",
           "Willing to go and die with Jesus at Bethany, absent at the first resurrection appearance and unwilling to "
           "believe on report — then the first in the Fourth Gospel to call Jesus God. A strong and early tradition "
           "sends him to India, where the Saint Thomas Christians trace their founding to him.",
           ["John 11:16", "John 20:25", "John 20:28"], NT + TRADITION,
           category="apostle", realm="Galilee, then (by tradition) India",
           ministry=dr(27, 72, "c. AD 27–72 (traditional)"), home="site-capernaum",
           journeys=["journey-ministry", "journey-apostolic-traditions"]),
    person("person-matthew", "Matthew (Levi)", "Apostle; tax collector at Capernaum",
           "Called from the tax booth on the Capernaum road — a customs post on the frontier between Antipas' Galilee "
           "and Philip's territory — and by tradition the author of the first Gospel.",
           ["Matthew 9:9", "Mark 2:14", "Luke 5:27"], NT + TRADITION,
           category="apostle", realm="Galilee", books=["Matthew"],
           ministry=dr(27, 70, "c. AD 27–70"), home="site-capernaum",
           journeys=["journey-ministry"],
           dating="The first Gospel is formally anonymous; the ascription to Matthew is second-century and universal "
                  "in the manuscripts, but it is a tradition rather than a claim the book makes."),
    person("person-james-alphaeus", "James son of Alphaeus", "One of the Twelve",
           "Named in every list of the Twelve and nowhere else in the New Testament; sometimes identified with 'James "
           "the less' of Mark 15:40, though the identification is not certain.",
           ["Matthew 10:3", "Mark 3:18", "Acts 1:13"], NT,
           category="apostle", realm="Galilee and Jerusalem", ministry=dr(27, 62, "c. AD 27–62"),
           journeys=["journey-ministry"]),
    person("person-thaddaeus", "Thaddaeus (Judas son of James)", "One of the Twelve",
           "Called Thaddaeus in Matthew and Mark and 'Judas not Iscariot' in Luke and John, where he asks at the last "
           "supper why Jesus will show himself to the disciples and not to the world.",
           ["Matthew 10:3", "Luke 6:16", "John 14:22"], NT,
           category="apostle", realm="Galilee and Jerusalem", ministry=dr(27, 65, "c. AD 27–65"),
           journeys=["journey-ministry"]),
    person("person-simon-zealot", "Simon the Zealot (the Cananaean)", "One of the Twelve",
           "Distinguished from Simon Peter by an epithet that marks him either as a member of the zealot movement or "
           "simply as zealous for the law — with a tax collector among the same twelve.",
           ["Matthew 10:4", "Luke 6:15", "Acts 1:13"], NT,
           category="apostle", realm="Galilee and Jerusalem", ministry=dr(27, 65, "c. AD 27–65"),
           journeys=["journey-ministry"]),
    person("person-judas-iscariot", "Judas Iscariot", "One of the Twelve; betrayed Jesus",
           "Kept the common purse and handed Jesus over in Gethsemane for thirty pieces of silver. Matthew and Acts "
           "give differing accounts of his death and of the field bought with the money.",
           ["Matthew 26:15", "Matthew 27:5", "Acts 1:18"], NT,
           category="apostle", realm="Judea", ministry=dr(27, 30, "c. AD 27–30"),
           sites=["site-gethsemane", "site-jerusalem"], journeys=["journey-ministry"],
           dating="Matthew 27:5 and Acts 1:18 differ on how Judas died and who bought the field; the app reports both "
                  "rather than harmonizing them."),
    person("person-matthias", "Matthias", "Chosen to replace Judas among the Twelve",
           "Selected by lot from among those who had accompanied Jesus from John's baptism to the ascension, so that "
           "the Twelve were complete before Pentecost.",
           ["Acts 1:23", "Acts 1:26"], NT + TRADITION,
           category="apostle", realm="Jerusalem", ministry=dr(30, 65, "c. AD 30–65"),
           home="site-jerusalem", journeys=["journey-apostolic-traditions"]),

    # ── Other New Testament figures ────────────────────────────────────────
    person("person-mary-mother", "Mary of Nazareth", "Mother of Jesus",
           "Betrothed to Joseph when she conceived, present from Bethlehem to Cana to the cross, and among those "
           "gathered in the upper room after the ascension.",
           ["Luke 1:38", "John 2:5", "Acts 1:14"], NT,
           category="other", realm="Galilee and Judea",
           life=dr(-20, 50, "c. 20 BC – c. AD 50 (traditional)"),
           home="site-nazareth", sites=["site-bethlehem", "site-cana-of-galilee", "site-jerusalem"],
           journeys=["journey-ministry"]),
    person("person-joseph-nazareth", "Joseph of Nazareth", "Carpenter of Nazareth; husband of Mary",
           "A τέκτων — a builder in wood and stone — who took Mary as his wife, brought the family to Egypt and back, "
           "and disappears from the narrative after the Passover visit when Jesus was twelve.",
           ["Matthew 1:24", "Matthew 2:14", "Luke 2:48"], NT,
           category="other", realm="Galilee",
           life=dr(-30, 25, "c. 30 BC – before AD 30"), home="site-nazareth",
           sites=["site-bethlehem", "site-egypt-refuge"], journeys=["journey-ministry"]),
    person("person-mary-magdalene", "Mary Magdalene", "Disciple; first witness of the resurrection",
           "From Magdala on the Sea of Galilee, healed of seven demons, one of the women who supported the ministry "
           "out of their own means, present at the crucifixion, and the first to whom the risen Jesus appeared.",
           ["Luke 8:2", "John 19:25", "John 20:16"], NT,
           category="disciple", realm="Galilee and Judea", ministry=dr(28, 33, "c. AD 28–33"),
           home="site-sea-of-galilee", sites=["site-golgotha-and-the-tomb", "site-jerusalem"],
           journeys=["journey-ministry"]),
    person("person-james-brother-jesus", "James the brother of Jesus", "Leader of the Jerusalem church",
           "Not a follower during the ministry, but named in the earliest resurrection tradition and, by the council "
           "of Acts 15, the presiding voice in Jerusalem. Josephus records his execution by the high priest Ananus in "
           "AD 62.",
           ["Acts 15:13", "1 Corinthians 15:7", "Galatians 1:19"], NT + ["cit-wit-josephus-james"],
           category="disciple", realm="Jerusalem", books=["James"],
           life=dr(-1, 62, "c. 1 BC – AD 62"), ministry=dr(33, 62, "c. AD 33–62"),
           home="site-jerusalem"),
    person("person-cornelius", "Cornelius", "Roman centurion of the Italian band at Caesarea",
           "A God-fearing officer whose household received the Spirit before baptism — the episode that settled, for "
           "Peter and then for Jerusalem, that Gentiles were to be admitted without becoming Jews first.",
           ["Acts 10:1", "Acts 10:44", "Acts 11:18"], NT,
           category="other", realm="Roman Judea", ministry=dr(37, 45, "c. AD 37–45"),
           home="site-caesarea-maritima", journeys=["journey-peter"]),
    person("person-lydia", "Lydia of Thyatira", "Dealer in purple at Philippi; first named convert in Europe",
           "A trader in the expensive purple cloth of her home city, met at the riverside place of prayer outside "
           "Philippi; her household was baptized and her house became the first church in Macedonia.",
           ["Acts 16:14", "Acts 16:15", "Acts 16:40"], NT,
           category="disciple", realm="Macedonia", ministry=dr(49, 60, "c. AD 49–60"),
           home="site-philippi", journeys=["journey-paul-2"]),
    person("person-priscilla-aquila", "Priscilla and Aquila", "Tentmakers; co-workers of Paul",
           "A married couple expelled from Rome under Claudius' edict, who worked at the same trade as Paul in "
           "Corinth, travelled with him to Ephesus, taught Apollos 'the way of God more perfectly', and hosted "
           "churches in their house in three cities.",
           ["Acts 18:2", "Acts 18:26", "Romans 16:3"], NT + ["cit-wit-suetonius"],
           category="disciple", realm="Rome, Corinth and Ephesus", ministry=dr(49, 60, "c. AD 49–60"),
           home="site-corinth", sites=["site-ephesus", "site-rome"], journeys=["journey-paul-2", "journey-paul-3"]),
    person("person-apollos", "Apollos", "Alexandrian Jew; eloquent teacher at Ephesus and Corinth",
           "Knowing only John's baptism, he was instructed by Priscilla and Aquila and became a powerful advocate in "
           "Achaia — and, without wanting it, the name of one of the factions Paul rebukes at Corinth.",
           ["Acts 18:24", "Acts 19:1", "1 Corinthians 3:6"], NT,
           category="evangelist", realm="Alexandria, Ephesus and Achaia", ministry=dr(52, 60, "c. AD 52–60"),
           home="site-alexandria", sites=["site-ephesus", "site-corinth"], journeys=["journey-paul-3"]),
]


# Existing persons predate the timeline fields; patch them in place rather than
# rewriting the hand-authored prose that is already there.
PERSON_PATCHES = {
    "person-jesus": {
        "category": "other", "homeSiteId": "site-nazareth",
        "lifeRange": dr(-6, 33, "c. 6/4 BC – AD 30 (or 33)"),
        "ministryRange": dr(27, 33, "c. AD 27–30 (or to 33)"),
        "journeyIds": ["journey-ministry"],
    },
    "person-paul": {
        "category": "apostle", "homeSiteId": "site-antioch-on-the-orontes",
        "lifeRange": dr(5, 67, "c. AD 5 – c. 62/67"),
        "ministryRange": dr(34, 62, "c. AD 34–62"),
        "journeyIds": ["journey-paul-1", "journey-paul-2", "journey-paul-3", "journey-rome"],
    },
    "person-barnabas": {"category": "apostle", "homeSiteId": "site-salamis",
                        "ministryRange": dr(45, 60, "c. AD 45–60"),
                        "journeyIds": ["journey-paul-1"]},
    "person-john-mark": {"category": "evangelist", "homeSiteId": "site-jerusalem", "books": ["Mark"],
                         "ministryRange": dr(45, 68, "c. AD 45–68"),
                         "journeyIds": ["journey-paul-1"]},
    "person-silas": {"category": "disciple", "homeSiteId": "site-jerusalem",
                     "ministryRange": dr(49, 60, "c. AD 49–60"),
                     "journeyIds": ["journey-paul-2"]},
    "person-timothy": {"category": "disciple", "homeSiteId": "site-lystra",
                       "ministryRange": dr(49, 65, "c. AD 49–65"),
                       "journeyIds": ["journey-paul-2", "journey-paul-3"]},
    "person-luke": {"category": "evangelist", "homeSiteId": "site-antioch-on-the-orontes",
                    "books": ["Luke", "Acts"],
                    "ministryRange": dr(49, 85, "c. AD 49–85"),
                    "journeyIds": ["journey-paul-2", "journey-paul-3", "journey-rome"]},
    "person-peter": {"category": "apostle", "homeSiteId": "site-capernaum", "books": ["1 Peter", "2 Peter"],
                     "lifeRange": dr(-5, 68, "c. 5 BC – c. AD 64/68"),
                     "ministryRange": dr(27, 67, "c. AD 27–64/67"),
                     "journeyIds": ["journey-ministry", "journey-peter", "journey-apostolic-traditions"]},
    "person-stephen": {"category": "disciple", "homeSiteId": "site-jerusalem",
                       "ministryRange": dr(33, 35, "c. AD 33–35")},
    "person-philip-evangelist": {"category": "evangelist", "homeSiteId": "site-caesarea-maritima",
                                 "ministryRange": dr(34, 60, "c. AD 34–60")},
    "person-ananias-of-damascus": {"category": "disciple", "homeSiteId": "site-damascus",
                                   "ministryRange": dr(34, 36, "c. AD 34–36")},
    "person-sergius-paulus": {"category": "ruler", "homeSiteId": "site-paphos",
                              "ministryRange": dr(46, 48, "proconsul c. AD 46–48")},
    "person-gallio": {"category": "ruler", "homeSiteId": "site-corinth",
                      "ministryRange": dr(51, 52, "proconsul of Achaia AD 51–52")},
    "person-pontius-pilate": {"category": "ruler", "homeSiteId": "site-caesarea-maritima",
                              "ministryRange": dr(26, 36, "prefect of Judea AD 26–36")},
    "person-abraham": {"category": "patriarch", "homeSiteId": "site-hebron-machpelah",
                       "lifeRange": dr(-2000, -1800, "c. 2000–1800 BC (Middle Bronze Age; dating debated)"),
                       "journeyIds": ["journey-abraham"]},
    "person-sarah": {"category": "matriarch", "homeSiteId": "site-hebron-machpelah",
                     "lifeRange": dr(-2000, -1800, "c. 2000–1800 BC (dating debated)"),
                     "journeyIds": ["journey-abraham"]},
    "person-isaac": {"category": "patriarch", "homeSiteId": "site-beersheba-ot",
                     "lifeRange": dr(-1950, -1750, "c. 1950–1750 BC (dating debated)")},
    "person-jacob": {"category": "patriarch", "homeSiteId": "site-bethel",
                     "lifeRange": dr(-1900, -1700, "c. 1900–1700 BC (dating debated)")},
    "person-joseph": {"category": "patriarch", "homeSiteId": "site-goshen-rameses",
                      "lifeRange": dr(-1880, -1750, "c. 1880–1750 BC (dating debated)")},
    "person-moses": {"category": "prophet", "homeSiteId": "site-mount-sinai",
                     "lifeRange": dr(-1400, -1200, "c. 1400–1200 BC — depends on the exodus date"),
                     "books": ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
                     "journeyIds": ["journey-exodus"],
                     "datingNote": en(
                         "Moses' dates move with the exodus date — c. 1446 BC on the early reading of 1 Kings 6:1, "
                         "c. 1260 BC on the late reading of Exodus 1:11. The span shown covers both. The ascription "
                         "of the Pentateuch to Moses is traditional; its composition history is debated.")},
    "person-joshua": {"category": "judge", "homeSiteId": "site-shiloh", "books": ["Joshua"],
                      "lifeRange": dr(-1400, -1180, "c. 1400–1180 BC — depends on the exodus date"),
                      "journeyIds": ["journey-exodus"]},
    "person-noah": {"category": "patriarch", "homeSiteId": "site-shuruppak",
                    "journeyIds": ["journey-noah"],
                    "datingNote": en(
                        "Genesis 1–11 carries no external chronological anchor, so no life range is given rather "
                        "than a false one.")},
}


# ── Journeys and stops ──────────────────────────────────────────────────────
def stop(jid, order, sid, title, mode, date, summary, refs, persons=None,
         conf="medium", cites=None, disputes=None):
    s = {
        "id": f"stop-{jid.replace('journey-', '')}-{order}",
        "journeyId": jid,
        "order": order,
        "siteId": sid,
        "title": en(title),
        "legMode": mode,
        "dateRange": date,
        "eventSummary": en(summary),
        "scriptureRefs": refs,
        "confidence": conf,
        "reviewStatus": "self-reviewed",
        "citations": [scripture_cite_id(r) for r in refs] + (cites or []),
    }
    if persons:
        s["persons"] = persons
    if disputes:
        s["disputes"] = en(disputes)
    return s


def journey(jid, title, kind, date, summary, color, stops, cites, chronology=None):
    j = {
        "id": jid,
        "title": en(title),
        "kind": kind,
        "dateRange": date,
        "summary": en(summary),
        "color": color,
        "stops": [s["id"] for s in stops],
        "citations": cites,
    }
    if chronology:
        j["chronologyNotes"] = en(chronology)
    return j


JOURNEYS, STOPS = [], []


def add(jid, title, kind, date, summary, color, cites, rows, chronology=None):
    """rows: (siteId, title, legMode, dateRange, summary, refs, persons, confidence, disputes)"""
    js = []
    for i, r in enumerate(rows):
        js.append(stop(jid, i, r[0], r[1], r[2], r[3], r[4], r[5],
                       persons=r[6], conf=r[7], cites=list(cites), disputes=r[8] if len(r) > 8 else None))
    STOPS.extend(js)
    JOURNEYS.append(journey(jid, title, kind, date, summary, color, js, cites, chronology))


# --- Samuel: the last judge, on circuit -------------------------------------
add("journey-samuel", "Samuel — Shiloh to the anointing of kings", "monarchy",
    dr(-1100, -1010, "c. 1100–1010 BC"),
    "The last of the judges, from the sanctuary at Shiloh where he was raised, around the yearly circuit he judged "
    "from — Bethel, Gilgal, Mizpah and home to Ramah — to the two anointings that ended the period of the judges.",
    "#7d6b3a", ["cit-ref-provan-history", "cit-ref-bright"],
    [
        ("site-shiloh", "Raised at the sanctuary", "start", dr(-1100, -1080, "c. 1100–1080 BC"),
         "Hannah brought the child to Eli at the house of the LORD in Shiloh, and there Samuel received the word that "
         "would end Eli's house.",
         ["1 Samuel 1:24-28", "1 Samuel 3:1-21"], ["person-samuel"], "high", None),
        ("site-aphek-ebenezer", "The ark taken", "land", dr(-1080, -1070, "c. 1080–1070 BC"),
         "Israel took the ark out of Shiloh into battle against the Philistines at Aphek and lost it, with Eli's sons "
         "killed and Eli dead at the news. Shiloh's burnt destruction layer belongs to about this generation.",
         ["1 Samuel 4:1-11"], ["person-samuel"], "medium", None),
        ("site-mizpah", "Israel gathered; the Philistines routed", "land", dr(-1070, -1050, "c. 1070–1050 BC"),
         "Samuel gathered the nation at Mizpah to put away foreign gods, and the Philistine attack on the assembly "
         "broke; he set up the stone he named Ebenezer.",
         ["1 Samuel 7:5-12"], ["person-samuel"], "medium", None),
        ("site-ramah", "The circuit and the demand for a king", "land", dr(-1060, -1040, "c. 1060–1040 BC"),
         "Samuel judged Israel year by year from Bethel to Gilgal to Mizpah and back to Ramah, where his house was — "
         "and where the elders came demanding a king like the nations.",
         ["1 Samuel 7:15-17", "1 Samuel 8:4-9"], ["person-samuel"], "medium", None),
        ("site-gilgal", "Saul made king", "land", dr(-1050, -1045, "c. 1050 BC"),
         "After the relief of Jabesh-gilead the people renewed the kingdom at Gilgal and made Saul king before the "
         "LORD; Samuel gave his farewell address there.",
         ["1 Samuel 11:14-15", "1 Samuel 12:1-25"], ["person-samuel", "person-saul"], "disputed",
         "Gilgal is unlocated — several tells near Jericho have been proposed and none confirmed."),
        ("site-bethlehem", "David anointed", "land", dr(-1025, -1020, "c. 1025 BC"),
         "Sent to Jesse's house with a horn of oil, Samuel passed over seven sons before the youngest was called in "
         "from the sheep and anointed in the midst of his brothers.",
         ["1 Samuel 16:1-13"], ["person-samuel", "person-david"], "high", None),
    ])

# --- David: from Bethlehem to Jerusalem -------------------------------------
add("journey-david", "David — from Bethlehem to Jerusalem", "monarchy",
    dr(-1025, -970, "c. 1025–970 BC"),
    "The rise of the second king: anointed as a shepherd boy, celebrated after the Elah valley, hunted through the "
    "Judean wilderness, a Philistine vassal at Ziklag, crowned at Hebron, and finally master of the Jebusite "
    "stronghold he made his capital.",
    "#8a4300", ["cit-ref-provan-history", "cit-thiele-chronology"],
    [
        ("site-bethlehem", "Anointed among his brothers", "start", dr(-1025, -1020, "c. 1025 BC"),
         "The youngest son of Jesse, keeping sheep, was anointed by Samuel while Saul still reigned.",
         ["1 Samuel 16:1-13"], ["person-david", "person-samuel"], "high", None),
        ("site-valley-of-elah", "The Philistine champion", "land", dr(-1020, -1015, "c. 1020 BC"),
         "The armies faced each other across the Elah valley between Socoh and Azekah, and the shepherd who had come "
         "with provisions for his brothers went out to the champion with a sling.",
         ["1 Samuel 17:1-54"], ["person-david", "person-saul"], "high", None),
        ("site-gibeah", "Saul's court, and flight from it", "land", dr(-1018, -1013, "c. 1018–1013 BC"),
         "Brought into the king's household and given command, David's success turned Saul's favour to suspicion, and "
         "he escaped through a window by night.",
         ["1 Samuel 18:6-16", "1 Samuel 19:9-12"], ["person-david", "person-saul"], "medium", None),
        ("site-adullam", "The cave, and four hundred men", "land", dr(-1013, -1011, "c. 1013 BC"),
         "At the cave of Adullam in the Shephelah his family came down to him, and everyone in distress, in debt or "
         "discontented gathered to him — about four hundred men.",
         ["1 Samuel 22:1-2"], ["person-david"], "medium", None),
        ("site-en-gedi", "Sparing Saul at the strongholds", "land", dr(-1012, -1011, "c. 1012 BC"),
         "In a cave among the strongholds of En-gedi, with Saul within reach, David cut off the skirt of his robe and "
         "would not raise his hand against the anointed king.",
         ["1 Samuel 24:1-22"], ["person-david", "person-saul"], "high", None),
        ("site-ziklag", "Sixteen months as a Philistine vassal", "land", dr(-1011, -1010, "c. 1011–1010 BC"),
         "Achish of Gath gave him Ziklag as a border holding; while he was away with the Philistine muster, "
         "Amalekite raiders burned the town and carried off the families, and he pursued and recovered them all.",
         ["1 Samuel 27:5-7", "1 Samuel 30:1-20"], ["person-david"], "disputed",
         "Ziklag's location is contested — Khirbet a-Ra'i, Tell esh-Sharia and Tel Halif are all argued, and no "
         "inscription names the town."),
        ("site-hebron-machpelah", "King over Judah", "land", dr(-1010, -1003, "c. 1010–1003 BC"),
         "After Saul's death on Gilboa, the men of Judah anointed David king at Hebron, where he reigned seven and a "
         "half years before the northern tribes came to him.",
         ["2 Samuel 2:1-4", "2 Samuel 5:1-5"], ["person-david"], "high", None),
        ("site-jerusalem", "The stronghold of Zion", "land", dr(-1003, -970, "c. 1003–970 BC"),
         "David took the Jebusite stronghold, made it the city of David, and brought the ark up into it — a capital "
         "belonging to neither Judah nor the northern tribes by inheritance.",
         ["2 Samuel 5:6-10", "2 Samuel 6:12-15"], ["person-david", "person-nathan"], "high", None),
        ("site-mahanaim", "Flight from Absalom", "land", dr(-980, -975, "c. 980–975 BC"),
         "Driven out of his own capital by his son's revolt, David crossed the Jordan to Mahanaim in Gilead, where "
         "the decisive battle was fought in the forest of Ephraim.",
         ["2 Samuel 17:24-27", "2 Samuel 18:6-15"], ["person-david"], "medium", None),
    ])

# --- Elijah ------------------------------------------------------------------
add("journey-elijah", "Elijah — drought, Carmel, and Horeb", "prophetic",
    dr(-875, -848, "c. 875–848 BC"),
    "The circuit of the prophet who confronted Ahab and Jezebel: out of Gilead to a hidden wadi, to a Phoenician "
    "widow's house through the famine, back to the contest on Carmel, then south to the desert and Horeb, and finally "
    "beyond the Jordan.",
    "#b35400", ["cit-ref-blenkinsopp-prophecy", "cit-thiele-chronology"],
    [
        ("site-tishbe", "Elijah the Tishbite", "start", dr(-875, -870, "c. 875 BC"),
         "He appears without introduction before Ahab: 'As the LORD God of Israel liveth… there shall not be dew nor "
         "rain these years, but according to my word.'",
         ["1 Kings 17:1"], ["person-elijah", "person-ahab"], "disputed",
         "Tishbe is unlocated; Listib in Gilead preserves the name, and one reading of the Hebrew removes the place "
         "name altogether."),
        ("site-brook-cherith", "Fed by ravens", "land", dr(-874, -872, "c. 874–872 BC"),
         "Hidden by the brook Cherith before Jordan through the first of the drought years, until the brook itself "
         "dried up.",
         ["1 Kings 17:2-7"], ["person-elijah"], "disputed",
         "The wadi is unlocated. Wadi al-Yabis fits the description and lies below the traditional Tishbe, but the "
         "text names no more than 'before Jordan'."),
        ("site-zarephath", "The widow's jar of meal", "land", dr(-872, -869, "c. 872–869 BC"),
         "Sent out of Israel entirely, to a Phoenician town belonging to Sidon — Jezebel's own country — where a "
         "widow's meal and oil did not fail and her son was restored to life.",
         ["1 Kings 17:8-24"], ["person-elijah"], "high", None),
        ("site-samaria-city", "Obadiah, and the meeting with Ahab", "land", dr(-869, -868, "c. 869 BC"),
         "In the third year, sent back to show himself to Ahab. Obadiah, the king's steward hiding a hundred prophets "
         "in caves, brought word, and the king met him with 'Art thou he that troubleth Israel?'",
         ["1 Kings 18:1-19"], ["person-elijah", "person-ahab"], "high", None),
        ("site-mount-carmel", "The contest with the prophets of Baal", "land", dr(-869, -868, "c. 869 BC"),
         "Four hundred and fifty prophets of Baal against one, an altar of twelve stones, water poured into the "
         "trench, and the fire that fell — then the slaughter at the brook Kishon.",
         ["1 Kings 18:20-40"], ["person-elijah"], "medium",
         "The mountain is certain; the spot is not. El-Muhraqa has carried the tradition since the Middle Ages, but "
         "the text names no site."),
        ("site-jezreel", "Rain, and the run before the chariot", "land", dr(-869, -868, "c. 869 BC"),
         "A cloud the size of a man's hand rose out of the sea, the drought broke, and Elijah ran before Ahab's "
         "chariot to the entrance of Jezreel — where Jezebel's message sent him running again.",
         ["1 Kings 18:41-46", "1 Kings 19:1-3"], ["person-elijah", "person-ahab", "person-jezebel"], "high", None),
        ("site-beersheba-ot", "A day's journey into the wilderness", "land", dr(-868, -867, "c. 868 BC"),
         "He left his servant at Beersheba, went a day's journey into the wilderness, sat down under a juniper tree "
         "and asked to die; an angel fed him twice for the road ahead.",
         ["1 Kings 19:3-8"], ["person-elijah"], "medium", None),
        ("site-mount-sinai", "Horeb — the still small voice", "land", dr(-868, -867, "c. 868 BC"),
         "Forty days to the mount of God, and there the wind, the earthquake and the fire, and after them a still "
         "small voice — and the commission to anoint Hazael, Jehu and Elisha.",
         ["1 Kings 19:8-18"], ["person-elijah"], "disputed",
         "Horeb/Sinai's location is itself disputed; the traditional Jebel Musa is a Byzantine identification and "
         "several northern and Midianite candidates are argued."),
        ("site-abel-meholah", "Casting the mantle over Elisha", "land", dr(-867, -866, "c. 867 BC"),
         "He found Elisha ploughing with twelve yoke of oxen, threw his mantle over him in passing, and the young man "
         "burned his plough, boiled the oxen, and followed.",
         ["1 Kings 19:19-21"], ["person-elijah", "person-elisha"], "medium",
         "Abel-meholah is placed by rival candidates on either bank of the Jordan."),
        ("site-jericho-ot", "Taken up beyond Jordan", "land", dr(-852, -848, "c. 852–848 BC"),
         "From Gilgal to Bethel to Jericho and over a parted Jordan, with Elisha refusing to be left behind — then "
         "the chariot of fire, and the mantle that fell.",
         ["2 Kings 2:1-12"], ["person-elijah", "person-elisha"], "medium", None),
    ])

# --- Elisha ------------------------------------------------------------------
add("journey-elisha", "Elisha — half a century in the Northern Kingdom", "prophetic",
    dr(-848, -797, "c. 848–797 BC"),
    "Elijah's successor worked in public for fifty years across Israel — at the prophetic guilds of Jericho, Bethel "
    "and Gilgal, in a Shunammite household, at Dothan with the Aramean army outside, in besieged Samaria, and as far "
    "as Damascus.",
    "#2f6f6b", ["cit-ref-blenkinsopp-prophecy", "cit-thiele-chronology"],
    [
        ("site-abel-meholah", "Called from the plough", "start", dr(-867, -866, "c. 867 BC"),
         "Ploughing his father's land when Elijah's mantle fell on him; he asked leave to kiss his parents goodbye, "
         "then destroyed his own means of going back.",
         ["1 Kings 19:19-21"], ["person-elisha", "person-elijah"], "medium", None),
        ("site-jericho-ot", "The mantle, and the spring healed", "land", dr(-848, -845, "c. 848 BC"),
         "He took up the mantle that fell, parted the Jordan with it, and the prophets at Jericho said the spirit of "
         "Elijah rested on him; he healed the town's bad water with salt.",
         ["2 Kings 2:13-22"], ["person-elisha"], "medium", None),
        ("site-bethel", "The road up to Bethel", "land", dr(-848, -845, "c. 848 BC"),
         "Going up from Jericho to Bethel — a royal sanctuary of the northern kingdom — he was mocked by a crowd of "
         "youths, and two she-bears came out of the wood.",
         ["2 Kings 2:23-25"], ["person-elisha"], "medium", None),
        ("site-mount-carmel", "The prophet's base on Carmel", "land", dr(-845, -840, "c. 845–840 BC"),
         "Carmel, where Elijah's contest had been fought, became a place Elisha kept and where those in trouble knew "
         "to look for him.",
         ["2 Kings 4:25"], ["person-elisha"], "medium", None),
        ("site-shunem", "The Shunammite's son", "land", dr(-845, -840, "c. 845–840 BC"),
         "A well-off woman built a small walled chamber on the roof for the prophet's circuit; the son promised to "
         "her died of sunstroke in the harvest field, and she rode to Carmel to fetch Elisha.",
         ["2 Kings 4:8-37"], ["person-elisha"], "medium", None),
        ("site-gilgal", "Death in the pot", "land", dr(-845, -838, "c. 845–838 BC"),
         "A famine year at the prophetic guild in Gilgal: wild gourds shredded into the stew, and meal thrown in to "
         "make it edible; then twenty barley loaves that fed a hundred with some left.",
         ["2 Kings 4:38-44"], ["person-elisha"], "disputed",
         "Gilgal is unlocated, and the Old Testament uses the name of more than one place."),
        ("site-dothan", "Horses and chariots of fire", "land", dr(-843, -838, "c. 843–838 BC"),
         "The king of Aram sent a force by night to take the prophet whose warnings kept spoiling his raids; the "
         "servant saw the town surrounded, and the army that came for Elisha was struck blind and led into Samaria.",
         ["2 Kings 6:8-23"], ["person-elisha"], "high", None),
        ("site-samaria-city", "The siege lifted", "land", dr(-843, -838, "c. 843–838 BC"),
         "Samaria besieged and starving, with a donkey's head selling for eighty pieces of silver — and four lepers "
         "at the gate who found the Aramean camp abandoned overnight.",
         ["2 Kings 6:24-33", "2 Kings 7:1-20"], ["person-elisha"], "high", None),
        ("site-damascus", "Hazael and the king of Aram", "land", dr(-843, -841, "c. 843–841 BC"),
         "Ben-hadad sent Hazael to ask the Israelite prophet whether he would recover; Elisha wept as he told Hazael "
         "what he would do to Israel, and Hazael went home and took the throne.",
         ["2 Kings 8:7-15"], ["person-elisha"], "high", None),
        ("site-ramoth-gilead", "Jehu anointed", "land", dr(-841, -840, "841 BC"),
         "Elisha sent one of the sons of the prophets with a box of oil to the army camp at Ramoth-gilead; the coup "
         "that followed ended the house of Omri, and Assyrian records date Jehu's tribute to 841 BC.",
         ["2 Kings 9:1-13"], ["person-elisha", "person-jehu"], "medium", None),
    ])

# --- Jonah -------------------------------------------------------------------
add("journey-jonah", "Jonah — Joppa, the sea, and Nineveh", "prophetic",
    dr(-785, -760, "c. 785–760 BC"),
    "The prophet sent east who bought a ticket west. 2 Kings 14:25 places Jonah son of Amittai under Jeroboam II; "
    "the book about him traces a flight toward Tarshish, a return he did not choose, and a preaching mission to "
    "Assyria's capital that succeeded and left him furious.",
    "#1c4b48", ["cit-ref-sweeney-twelve", "cit-ref-blenkinsopp-prophecy"],
    [
        ("site-joppa", "Passage to Tarshish", "start", dr(-785, -760, "c. 785–760 BC"),
         "Sent to Nineveh, he went down to Joppa, found a ship going to Tarshish, paid the fare and went aboard 'from "
         "the presence of the LORD'.",
         ["Jonah 1:1-3"], ["person-jonah"], "high", None),
        ("site-tarshish", "The ship that never arrived", "sea", dr(-785, -760, "c. 785–760 BC"),
         "The intended destination — in the Hebrew Bible the far west, the edge of the known world. The storm, the "
         "lots and the sailors' reluctant decision ended the voyage well short of it.",
         ["Jonah 1:4-16"], ["person-jonah"], "disputed",
         "Tarshish is unidentified: Tartessos in south-west Spain, Tarsus in Cilicia and a Sardinian identification "
         "are all argued. Read the pin as a direction of travel, not a located port."),
        ("site-joppa", "Cast upon the dry land", "turnaround", dr(-785, -760, "c. 785–760 BC"),
         "Three days and nights in the fish, a prayer from inside it, and a return to the Levantine coast — the text "
         "names no landing place, so the pin returns to the port he sailed from.",
         ["Jonah 2:1-10"], ["person-jonah"], "disputed",
         "The place he was put ashore is not named. The stop is anchored back at Joppa for the map's sake, not "
         "because the text locates it there."),
        ("site-nineveh", "Forty days, and a city that repented", "land", dr(-785, -760, "c. 785–760 BC"),
         "A day's walk into the great city with a five-word sermon, and from the king down the city turned — then "
         "Jonah sat east of it under a withering gourd, angry that it had.",
         ["Jonah 3:1-10", "Jonah 4:1-11"], ["person-jonah"], "high", None),
    ],
    chronology="The prophet is dated by 2 Kings 14:25 to Jeroboam II's reign (c. 793–753 BC). The book about him is "
               "commonly dated later on linguistic grounds and read by many scholars as a didactic narrative; that "
               "is a question about the book's composition, not about where its scenes are set.")

# --- Jeremiah ----------------------------------------------------------------
add("journey-jeremiah", "Jeremiah — Anathoth to Egypt", "prophetic",
    dr(-627, -582, "c. 627–582 BC"),
    "Forty-five years spanning the end of Judah: called at Anathoth in Josiah's thirteenth year, preaching in the "
    "temple courts through two sieges, released from the deportation chain-gang at Ramah, left with the governor at "
    "Mizpah, and finally carried into Egypt against his own advice.",
    "#6b4a8f", ["cit-ref-blenkinsopp-prophecy", "cit-src-livius-abc5"],
    [
        ("site-anathoth", "Called at Anathoth", "start", dr(-627, -620, "627 BC"),
         "A priest's son from the Benjaminite town three miles from Jerusalem: 'Before I formed thee in the belly I "
         "knew thee.' His own townsmen later plotted against his life.",
         ["Jeremiah 1:1-10", "Jeremiah 11:21"], ["person-jeremiah"], "medium",
         "Anathoth is placed either at the village of Anata, which preserves the name, or at Ras el-Kharrubeh a "
         "kilometre south, which has the Iron Age remains."),
        ("site-jerusalem", "The temple sermon, and the burned scroll", "land", dr(-609, -586, "c. 609–586 BC"),
         "He stood in the gate of the LORD's house and told Judah that the temple was no charm — Shiloh had been a "
         "sanctuary too. The scroll Baruch wrote was cut up and burned column by column, and rewritten with more "
         "added; Jeremiah himself was let down into a cistern in the court of the guard.",
         ["Jeremiah 7:1-15", "Jeremiah 36:1-32", "Jeremiah 38:1-13"],
         ["person-jeremiah", "person-baruch", "person-zedekiah"], "high", None),
        ("site-ramah", "Released from the chain-gang", "land", dr(-586, -585, "586 BC"),
         "Taken in chains with the deportees as far as Ramah, the staging point for the march to Babylon, and there "
         "singled out by Nebuzaradan and given the choice of going or staying.",
         ["Jeremiah 40:1-6"], ["person-jeremiah"], "medium", None),
        ("site-mizpah", "With Gedaliah at Mizpah", "land", dr(-586, -582, "c. 586–582 BC"),
         "He went to Gedaliah, the governor Babylon installed over the remnant at Mizpah — until Gedaliah was "
         "assassinated at a meal and the survivors panicked.",
         ["Jeremiah 40:6-12", "Jeremiah 41:1-3"], ["person-jeremiah"], "medium", None),
        ("site-tahpanhes", "Carried into Egypt", "land", dr(-582, -580, "c. 582 BC"),
         "Against his explicit counsel the remnant fled to Egypt and took him with them. At Tahpanhes he hid stones "
         "in the clay pavement at the entry of Pharaoh's house, and said Nebuchadnezzar would set his throne on them.",
         ["Jeremiah 43:5-13"], ["person-jeremiah", "person-baruch"], "high", None),
    ])

# --- The exile ---------------------------------------------------------------
add("journey-exile", "The exile — Jerusalem to Babylon", "exile",
    dr(-605, -538, "605–538 BC"),
    "Three deportations, the road north to Riblah and east to Babylonia, and the two prophets of the exile — Ezekiel "
    "among the deportee settlements on the Chebar canal, Daniel in the courts of Babylon and Persia. This stretch of "
    "the chronology is the firmest in the Old Testament: the Babylonian Chronicle dates the capture of Jerusalem in "
    "Nebuchadnezzar's seventh year to the day.",
    "#4a4a6b", ["cit-src-livius-abc5", "cit-ref-grayson-chronicles", "cit-ref-bright"],
    [
        ("site-jerusalem", "Three deportations", "start", dr(-605, -586, "605, 597 and 586 BC"),
         "First the young men of the royal seed in 605, then the king, the craftsmen and the smiths with Ezekiel in "
         "597, and finally the city itself in 586 — walls broken down, the temple burned, and the vessels carried "
         "away.",
         ["Daniel 1:1-7", "2 Kings 24:10-16", "2 Kings 25:8-12"],
         ["person-daniel", "person-ezekiel", "person-zedekiah", "person-nebuchadnezzar"], "high", None),
        ("site-riblah", "Zedekiah before Nebuchadnezzar", "land", dr(-586, -585, "586 BC"),
         "Taken fleeing near Jericho, the last king of Judah was brought to Nebuchadnezzar's headquarters on the "
         "Orontes; his sons were killed in front of him, and that was the last thing he saw.",
         ["2 Kings 25:6-7"], ["person-zedekiah", "person-nebuchadnezzar"], "medium",
         "Ribleh on the Orontes preserves the name and suits every notice in Kings and Jeremiah, but the site is "
         "unexcavated."),
        ("site-babylon", "Daniel in the court", "land", dr(-605, -536, "605–536 BC"),
         "Trained for three years in the language and learning of the Chaldeans, Daniel served through the reigns "
         "from Nebuchadnezzar to Cyrus — the interpreted dreams, the furnace, the writing on the wall, and the lions' "
         "den.",
         ["Daniel 1:3-6", "Daniel 2:46-49", "Daniel 6:10-23"],
         ["person-daniel", "person-nebuchadnezzar"], "high", None),
        ("site-chebar-canal", "Ezekiel among the captives", "land", dr(-593, -571, "593–571 BC"),
         "'As I was among the captives by the river of Chebar, the heavens were opened.' He sat seven days astonished "
         "among them at Tel-abib, and prophesied for twenty-two years — first that the city would fall, then, once "
         "word came that it had, of dry bones and a restored temple.",
         ["Ezekiel 1:1-3", "Ezekiel 3:15", "Ezekiel 37:1-14"], ["person-ezekiel"], "disputed",
         "Tel-abib itself is unlocated. The Chebar is generally identified with the nāru kabaru canal in the Nippur "
         "region, where cuneiform archives from al-Yahudu record deported Judean families by name — so the pin marks "
         "the documented setting, not a located village."),
        ("site-susa", "Daniel's vision at Shushan", "land", dr(-551, -536, "c. 551–536 BC"),
         "'I saw in a vision… I was at Shushan in the palace, which is in the province of Elam' — the ram and the "
         "he-goat, and the empires read off them.",
         ["Daniel 8:1-2"], ["person-daniel"], "high", None),
    ])

# --- The return --------------------------------------------------------------
add("journey-return", "The return — Cyrus' decree to Nehemiah's wall", "return",
    dr(-538, -432, "538–432 BC"),
    "A century of coming back: Cyrus' decree and the first company under Zerubbabel, a temple finished in 516 BC "
    "under Haggai's and Zechariah's prodding, Ezra's caravan with the law, and Nehemiah leaving the Persian court at "
    "Susa to rebuild Jerusalem's walls in fifty-two days.",
    "#8a6d10", ["cit-arch-cyrus-cylinder-bm", "cit-ref-bright", "cit-ref-provan-history"],
    [
        ("site-babylon", "Cyrus' decree; the first company", "start", dr(-538, -537, "538 BC"),
         "In the first year of Cyrus, permission to go up and build — and about fifty thousand went, with the temple "
         "vessels Nebuchadnezzar had taken, under Zerubbabel and Jeshua the priest.",
         ["Ezra 1:1-11", "Ezra 2:64-65"], ["person-cyrus", "person-zerubbabel"], "high", None),
        ("site-jerusalem", "Foundation laid, and a temple finished", "land", dr(-536, -515, "536–516 BC"),
         "The foundation was laid to shouting and to the weeping of those old enough to remember the first house; the "
         "work then stalled for sixteen years until Haggai and Zechariah restarted it, and the temple was finished in "
         "the sixth year of Darius.",
         ["Ezra 3:8-13", "Ezra 6:14-16"],
         ["person-zerubbabel", "person-haggai", "person-zechariah-prophet"], "high", None),
        ("site-babylon", "Ezra's caravan sets out", "turnaround", dr(-458, -457, "458 BC"),
         "A priest and scribe 'ready in the law of Moses' came up with a royal commission, a second company, and "
         "silver and gold for the house — refusing an escort, because he had told the king that God's hand was on "
         "them.",
         ["Ezra 7:6-10", "Ezra 8:31-32"], ["person-ezra"], "medium", None),
        ("site-susa", "Nehemiah hears about the walls", "land", dr(-446, -445, "446–445 BC"),
         "Cupbearer to Artaxerxes in the citadel at Susa, he heard that the survivors were in distress and the wall "
         "broken down, and asked the king for timber and a commission.",
         ["Nehemiah 1:1-11", "Nehemiah 2:1-8"], ["person-nehemiah"], "high", None),
        ("site-jerusalem", "The wall in fifty-two days", "land", dr(-445, -432, "445–432 BC"),
         "A night ride around the ruined circuit, the work parcelled out family by family with a weapon in one hand, "
         "and the wall finished in fifty-two days — then Ezra reading the law aloud at the Water Gate from morning "
         "until midday.",
         ["Nehemiah 6:15-16", "Nehemiah 8:1-8"], ["person-nehemiah", "person-ezra"], "high", None),
    ],
    chronology="Whether Ezra preceded Nehemiah depends on which Artaxerxes his 'seventh year' belongs to. The "
               "traditional order — Ezra in 458, Nehemiah in 445 — is followed here; a substantial minority reverses "
               "them, putting Ezra in 398 under Artaxerxes II.")

# --- Peter -------------------------------------------------------------------
add("journey-peter", "Peter — Jerusalem to Caesarea, and the road to Rome", "apostolic",
    dr(30, 67, "c. AD 30–64/67"),
    "The apostle's own itinerary, distinct from Paul's: Pentecost in Jerusalem, the confirmation of the Samaritan "
    "mission, the coastal circuit through Lydda and Joppa, the household of Cornelius at Caesarea that opened the "
    "door to Gentiles, the council in Jerusalem, a confrontation at Antioch — and, by early and widespread tradition, "
    "a martyrdom at Rome under Nero.",
    "#c9a227", ["cit-ref-keener-bbcnt", "cit-src-eusebius-he"],
    [
        ("site-jerusalem", "Pentecost, and the first preaching", "start", dr(30, 33, "c. AD 30–33"),
         "The fisherman who had denied him stood up with the eleven and preached the first sermon of the church, "
         "quoting Joel on the Spirit poured out on all flesh.",
         ["Acts 2:1-41", "Acts 3:1-10"], ["person-peter", "person-john-apostle"], "high", None),
        ("site-samaria", "Confirming the Samaritan mission", "land", dr(33, 36, "c. AD 33–36"),
         "When Jerusalem heard that Samaria had received the word, Peter and John were sent down — the first "
         "extension of the church past the boundary that mattered most.",
         ["Acts 8:14-25"], ["person-peter", "person-john-apostle"], "high", None),
        ("site-lydda", "Aeneas at Lydda", "land", dr(36, 40, "c. AD 36–40"),
         "On a circuit through the coastal plain he found a man eight years bedridden with palsy, and the towns of "
         "Lydda and Sharon turned to the Lord.",
         ["Acts 9:32-35"], ["person-peter"], "high", None),
        ("site-joppa", "Tabitha, and the vision on the roof", "land", dr(36, 40, "c. AD 36–40"),
         "Tabitha, the disciple full of good works, was raised in the upper room at Joppa; and on the roof of Simon "
         "the tanner's house by the sea Peter saw the sheet let down and was told to call nothing common.",
         ["Acts 9:36-43", "Acts 10:9-23"], ["person-peter"], "high", None),
        ("site-caesarea-maritima", "The household of Cornelius", "land", dr(37, 41, "c. AD 37–41"),
         "A Roman centurion's household received the Spirit before they were baptized, and the argument about "
         "Gentiles was settled by an event rather than a ruling — 'Can any man forbid water?'",
         ["Acts 10:24-48", "Acts 11:1-18"], ["person-peter", "person-cornelius"], "high", None),
        ("site-jerusalem", "Prison, and the council", "turnaround", dr(44, 50, "c. AD 44–50"),
         "Arrested by Herod Agrippa I in the days of unleavened bread and released overnight; and at the council of "
         "Acts 15 he argued that Gentiles should not be burdened with the law.",
         ["Acts 12:1-19", "Acts 15:6-11"], ["person-peter", "person-james-brother-jesus"], "high", None),
        ("site-antioch-on-the-orontes", "Withdrawing from the Gentile table", "land", dr(48, 52, "c. AD 48–52"),
         "Paul's own account: Peter ate with Gentile believers at Antioch until men came from James, then drew back — "
         "and was rebuked to his face for it.",
         ["Galatians 2:11-14"], ["person-peter", "person-paul"], "high", None),
        ("site-rome", "'She that is at Babylon'", "land", dr(60, 67, "c. AD 60–64/67 (tradition)"),
         "1 Peter closes with greetings from 'the church that is at Babylon' — read since antiquity as Rome. Clement, "
         "Ignatius, Irenaeus and Eusebius attest a martyrdom there under Nero, and a first-century memorial under St "
         "Peter's marks where the tradition was already located by the mid-second century.",
         ["1 Peter 5:13"], ["person-peter"], "legendary",
         "That Peter died at Rome is early, widespread and uncontradicted in the ancient sources, but it is "
         "tradition rather than documentation: no first-century text states it outright, and the identification of "
         "the bones found beneath the basilica is disputed."),
    ])


def main():
    refs = set()
    for s in STOPS:
        refs.update(s["scriptureRefs"])
    for p in PERSONS:
        refs.update(p["scriptureRefs"])
    scripture_cites = [
        {
            "id": scripture_cite_id(r),
            "source": en(f"Holy Scripture: {r}"),
            "kind": "primary-scripture",
            "note": en(
                "Public-domain biblical text (KJV/ASV) bundled in-app; primary narrative source for the claim."
            ),
        }
        for r in sorted(refs)
    ]

    write("citations.extra.json", upsert(load("citations.extra.json"), CITES + scripture_cites))
    write("sites.extra.json", upsert(load("sites.extra.json"), SITES))
    write("persons.extra.json", patch(upsert(load("persons.extra.json"), PERSONS), PERSON_PATCHES))
    write("persons.json", patch(load("persons.json"), PERSON_PATCHES))
    write("journeys.extra.json", upsert(load("journeys.extra.json"), JOURNEYS))
    write("stops.extra.json", upsert(load("stops.extra.json"), STOPS))

    print(f"sites +{len(SITES)} · persons +{len(PERSONS)} (patched {len(PERSON_PATCHES)}) · "
          f"journeys +{len(JOURNEYS)} · stops +{len(STOPS)} · citations +{len(CITES) + len(scripture_cites)}")


if __name__ == "__main__":
    main()
