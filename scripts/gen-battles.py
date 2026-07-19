#!/usr/bin/env python3
"""The Old Testament battle & conquest catalogue: the wars of the biblical
narrative from the patriarchs to the fall of Jerusalem — conquest campaigns,
the Judges-era deliverances, the wars of Saul and David, the Israel-vs-Judah
civil wars of the divided kingdom, and the Aramean, Assyrian, and Babylonian
invasions — each anchored to a mapped site, dated as a scholarly range, and
cross-referenced to the archaeological record (stelae, reliefs, ostraca,
siege ramps, burn layers). Idempotent: owns content/battles.json and upserts
the new sites / artifacts / citations into the .extra.json layers.

Framing principles (the app's standing ethos):
- Dates are scholarly ranges, never false precision. The conquest carries the
  early-date (c. 1406 BC) vs late-date (c. 1230-1200 BC) debate as `disputed`;
  divided-kingdom dates follow the Thiele-family chronologies; Assyrian- and
  Babylonian-era events are pinned by cuneiform sources (Qarqar 853, fall of
  Samaria 722, Lachish/Jerusalem 701, Megiddo 609, Carchemish 605, Jerusalem
  2 Adar 597).
- Location honesty: unidentified fields carry `locationNote`; genuinely
  contested identifications (Ai/et-Tell, Ramoth-gilead, Aphek in the Golan,
  Mount Zemaraim) are `disputed` with a disputes note.
- `area` polygons are approximate sweeps for map highlighting, not surveyed
  boundaries — every one is labelled approximate in its note.
- The battle of Qarqar has no scripture reference: it is included because the
  Kurkh Monolith fixes Ahab of Israel to an absolute date, anchoring the whole
  divided-kingdom chronology.
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
    by = {x["id"]: x for x in arr}
    for it in items:
        by[it["id"]] = it
    out, seen = [], set()
    for x in arr:
        if x["id"] not in seen:
            out.append(by[x["id"]]); seen.add(x["id"])
    for it in items:
        if it["id"] not in seen:
            out.append(it); seen.add(it["id"])
    return out


# ---------------------------------------------------------------- citations
CITES = [
    # chronology + campaign articles
    ("cit-thiele-chronology", "Edwin R. Thiele, 'The Mysterious Numbers of the Hebrew Kings' (divided-kingdom chronology)", "https://archive.org/details/mysteriousnumber0000thie", "secondary-scholarly"),
    ("cit-wikipedia-battle-of-jericho", "Wikipedia, 'Battle of Jericho'", "https://en.wikipedia.org/wiki/Battle_of_Jericho", "secondary-scholarly"),
    ("cit-wikipedia-ai-canaan", "Wikipedia, 'Ai (Canaan)' (the et-Tell identification problem)", "https://en.wikipedia.org/wiki/Ai_(Canaan)", "secondary-scholarly"),
    ("cit-wikipedia-battle-of-gibeon", "Wikipedia, 'Battle of Gibeon'", "https://en.wikipedia.org/wiki/Battle_of_Gibeon", "secondary-scholarly"),
    ("cit-wikipedia-waters-of-merom", "Wikipedia, 'Waters of Merom'", "https://en.wikipedia.org/wiki/Waters_of_Merom", "secondary-scholarly"),
    ("cit-wikipedia-battle-mount-tabor", "Wikipedia, 'Battle of Mount Tabor' (Deborah and Barak vs. Sisera)", "https://en.wikipedia.org/wiki/Battle_of_Mount_Tabor", "secondary-scholarly"),
    ("cit-wikipedia-gideon", "Wikipedia, 'Gideon'", "https://en.wikipedia.org/wiki/Gideon", "secondary-scholarly"),
    ("cit-wikipedia-battle-of-gibeah", "Wikipedia, 'Battle of Gibeah' (the Benjamite civil war)", "https://en.wikipedia.org/wiki/Battle_of_Gibeah", "secondary-scholarly"),
    ("cit-wikipedia-battle-of-aphek", "Wikipedia, 'Battle of Aphek' (the ark captured)", "https://en.wikipedia.org/wiki/Battle_of_Aphek", "secondary-scholarly"),
    ("cit-wikipedia-battle-of-michmash", "Wikipedia, 'Battle of Michmash'", "https://en.wikipedia.org/wiki/Battle_of_Michmash", "secondary-scholarly"),
    ("cit-wikipedia-goliath", "Wikipedia, 'Goliath' (the Valley of Elah duel)", "https://en.wikipedia.org/wiki/Goliath", "secondary-scholarly"),
    ("cit-wikipedia-battle-mount-gilboa", "Wikipedia, 'Battle of Mount Gilboa'", "https://en.wikipedia.org/wiki/Battle_of_Mount_Gilboa", "secondary-scholarly"),
    ("cit-wikipedia-mount-zemaraim", "Wikipedia, 'Battle of Mount Zemaraim' (Abijah vs. Jeroboam)", "https://en.wikipedia.org/wiki/Battle_of_Mount_Zemaraim", "secondary-scholarly"),
    ("cit-wikipedia-battle-of-qarqar", "Wikipedia, 'Battle of Qarqar' (853 BC; Ahab in the Kurkh Monolith)", "https://en.wikipedia.org/wiki/Battle_of_Qarqar", "secondary-scholarly"),
    ("cit-wikipedia-ramoth-gilead", "Wikipedia, 'Ramoth-Gilead' (Ahab's last battle)", "https://en.wikipedia.org/wiki/Ramoth-Gilead", "secondary-scholarly"),
    ("cit-wikipedia-jehu", "Wikipedia, 'Jehu' (the 841 BC coup; Black Obelisk tribute)", "https://en.wikipedia.org/wiki/Jehu", "secondary-scholarly"),
    ("cit-wikipedia-mesha-stele", "Wikipedia, 'Mesha Stele' (Moab's rebellion in Moab's own words)", "https://en.wikipedia.org/wiki/Mesha_Stele", "secondary-scholarly"),
    ("cit-wikipedia-syro-ephraimite-war", "Wikipedia, 'Syro-Ephraimite War'", "https://en.wikipedia.org/wiki/Syro-Ephraimite_War", "secondary-scholarly"),
    ("cit-wikipedia-sargon-ii", "Wikipedia, 'Sargon II' (the fall of Samaria in Assyrian annals)", "https://en.wikipedia.org/wiki/Sargon_II", "secondary-scholarly"),
    ("cit-wikipedia-siege-of-lachish", "Wikipedia, 'Siege of Lachish' (701 BC)", "https://en.wikipedia.org/wiki/Siege_of_Lachish", "secondary-scholarly"),
    ("cit-wikipedia-sennacherib-campaign", "Wikipedia, 'Sennacherib's campaign in the Levant' (701 BC)", "https://en.wikipedia.org/wiki/Sennacherib%27s_campaign_in_the_Levant", "secondary-scholarly"),
    ("cit-wikipedia-megiddo-609", "Wikipedia, 'Battle of Megiddo (609 BC)' (death of Josiah)", "https://en.wikipedia.org/wiki/Battle_of_Megiddo_(609_BC)", "secondary-scholarly"),
    ("cit-wikipedia-battle-of-carchemish", "Wikipedia, 'Battle of Carchemish' (605 BC)", "https://en.wikipedia.org/wiki/Battle_of_Carchemish", "secondary-scholarly"),
    ("cit-wikipedia-siege-jerusalem-597", "Wikipedia, 'Siege of Jerusalem (597 BC)' (dated 2 Adar by the Babylonian Chronicle)", "https://en.wikipedia.org/wiki/Siege_of_Jerusalem_(597_BC)", "secondary-scholarly"),
    ("cit-wikipedia-siege-jerusalem-587", "Wikipedia, 'Siege of Jerusalem (587 BC)' (the fall of the kingdom of Judah)", "https://en.wikipedia.org/wiki/Siege_of_Jerusalem_(587_BC)", "secondary-scholarly"),
    ("cit-wikipedia-vale-of-siddim", "Wikipedia, 'Vale of Siddim' (Genesis 14)", "https://en.wikipedia.org/wiki/Vale_of_Siddim", "secondary-scholarly"),
    # site gazetteers
    ("cit-wikipedia-tel-hazor", "Wikipedia, 'Tel Hazor'", "https://en.wikipedia.org/wiki/Tel_Hazor", "gazetteer"),
    ("cit-wikipedia-tel-megiddo", "Wikipedia, 'Tel Megiddo'", "https://en.wikipedia.org/wiki/Tel_Megiddo", "gazetteer"),
    ("cit-wikipedia-lachish", "Wikipedia, 'Lachish' (Tell ed-Duweir)", "https://en.wikipedia.org/wiki/Lachish", "gazetteer"),
    ("cit-wikipedia-gibeon", "Wikipedia, 'Gibeon (ancient city)' (el-Jib)", "https://en.wikipedia.org/wiki/Gibeon_(ancient_city)", "gazetteer"),
    ("cit-wikipedia-gibeah", "Wikipedia, 'Gibeah' (Tell el-Ful)", "https://en.wikipedia.org/wiki/Gibeah", "gazetteer"),
    ("cit-wikipedia-michmash", "Wikipedia, 'Michmash' (Mukhmas)", "https://en.wikipedia.org/wiki/Michmash", "gazetteer"),
    ("cit-wikipedia-tell-en-nasbeh", "Wikipedia, 'Tell en-Nasbeh' (Mizpah of Benjamin)", "https://en.wikipedia.org/wiki/Tell_en-Nasbeh", "gazetteer"),
    ("cit-wikipedia-antipatris", "Wikipedia, 'Antipatris' (Tel Afek / biblical Aphek)", "https://en.wikipedia.org/wiki/Antipatris", "gazetteer"),
    ("cit-wikipedia-valley-of-elah", "Wikipedia, 'Valley of Elah'", "https://en.wikipedia.org/wiki/Valley_of_Elah", "gazetteer"),
    ("cit-wikipedia-mount-gilboa", "Wikipedia, 'Mount Gilboa'", "https://en.wikipedia.org/wiki/Mount_Gilboa", "gazetteer"),
    ("cit-wikipedia-amman-citadel", "Wikipedia, 'Amman Citadel' (Rabbah of Ammon)", "https://en.wikipedia.org/wiki/Amman_Citadel", "gazetteer"),
    ("cit-wikipedia-mahanaim", "Wikipedia, 'Mahanaim'", "https://en.wikipedia.org/wiki/Mahanaim", "gazetteer"),
    ("cit-wikipedia-ramah-benjamin", "Wikipedia, 'Ramah in Benjamin' (er-Ram)", "https://en.wikipedia.org/wiki/Ramah_in_Benjamin", "gazetteer"),
    ("cit-wikipedia-beth-shemesh", "Wikipedia, 'Beth Shemesh' (Tel Beit Shemesh)", "https://en.wikipedia.org/wiki/Beth_Shemesh", "gazetteer"),
    ("cit-wikipedia-samaria-city", "Wikipedia, 'Samaria (ancient city)' (Sebastia)", "https://en.wikipedia.org/wiki/Samaria_(ancient_city)", "gazetteer"),
    ("cit-wikipedia-tel-jezreel", "Wikipedia, 'Tel Jezreel'", "https://en.wikipedia.org/wiki/Tel_Jezreel", "gazetteer"),
    ("cit-wikipedia-kir-of-moab", "Wikipedia, 'Kir of Moab' (Kir-hareseth / al-Karak)", "https://en.wikipedia.org/wiki/Kir_of_Moab", "gazetteer"),
    ("cit-wikipedia-tell-qarqur", "Wikipedia, 'Tell Qarqur' (Qarqar on the Orontes)", "https://en.wikipedia.org/wiki/Tell_Qarqur", "gazetteer"),
    ("cit-wikipedia-carchemish", "Wikipedia, 'Carchemish'", "https://en.wikipedia.org/wiki/Carchemish", "gazetteer"),
    ("cit-wikipedia-tel-dan", "Wikipedia, 'Tel Dan' (Laish/Dan)", "https://en.wikipedia.org/wiki/Tel_Dan", "gazetteer"),
    ("cit-wikipedia-heshbon", "Wikipedia, 'Heshbon' (Tell Hisban)", "https://en.wikipedia.org/wiki/Heshbon", "gazetteer"),
    ("cit-wikipedia-daraa-edrei", "Wikipedia, 'Daraa' (biblical Edrei)", "https://en.wikipedia.org/wiki/Daraa", "gazetteer"),
    ("cit-wikipedia-mount-tabor", "Wikipedia, 'Mount Tabor'", "https://en.wikipedia.org/wiki/Mount_Tabor", "gazetteer"),
    ("cit-wikipedia-maayan-harod", "Wikipedia, 'Ma'ayan Harod' (the spring of Harod)", "https://en.wikipedia.org/wiki/Ma%27ayan_Harod", "gazetteer"),
    ("cit-wikipedia-ramoth-gilead-site", "Wikipedia, 'Ramoth-Gilead' (Tell er-Rumeith candidate)", "https://en.wikipedia.org/wiki/Ramoth-Gilead", "gazetteer"),
    # artifacts
    ("cit-wikipedia-lachish-reliefs", "Wikipedia, 'Lachish reliefs' (British Museum)", "https://en.wikipedia.org/wiki/Lachish_reliefs", "archaeological"),
    ("cit-wikipedia-lachish-letters", "Wikipedia, 'Lachish letters' (ostraca)", "https://en.wikipedia.org/wiki/Lachish_letters", "archaeological"),
    ("cit-wikipedia-kurkh-monoliths", "Wikipedia, 'Kurkh Monoliths' (Shalmaneser III; 'Ahab the Israelite')", "https://en.wikipedia.org/wiki/Kurkh_Monoliths", "archaeological"),
    ("cit-wikipedia-black-obelisk", "Wikipedia, 'Black Obelisk of Shalmaneser III' ('Jehu son of Omri')", "https://en.wikipedia.org/wiki/Black_Obelisk_of_Shalmaneser_III", "archaeological"),
    ("cit-wikipedia-khirbet-qeiyafa", "Wikipedia, 'Khirbet Qeiyafa' (Elah fortress and ostracon)", "https://en.wikipedia.org/wiki/Khirbet_Qeiyafa", "archaeological"),
    ("cit-wikipedia-jehoiachin-tablets", "Wikipedia, 'Jehoiachin's rations tablets' (Babylon)", "https://en.wikipedia.org/wiki/Jehoiachin%27s_rations_tablets", "archaeological"),
    ("cit-wikipedia-samaria-ostraca", "Wikipedia, 'Samaria ostraca'", "https://en.wikipedia.org/wiki/Samaria_ostraca", "archaeological"),
    ("cit-abr-jericho-walls", "Bryant G. Wood / Associates for Biblical Research, 'Did the Israelites Conquer Jericho?' (the Tell es-Sultan dating debate)", "https://biblearchaeology.org/research/conquest-of-canaan/2310-did-the-israelites-conquer-jericho-a-new-look-at-the-archaeological-evidence", "archaeological"),
]

# ------------------------------------------------------------------- sites
def site(id, ancient, modern_name, modern_loc, lat, lon, conf, coord_cites, summary, cites=None, coord_disputes=None):
    coords = {
        "value": {"lat": lat, "lon": lon},
        "confidence": conf,
        "reviewStatus": "self-reviewed",
        "citations": coord_cites,
    }
    if conf == "disputed":
        coords["disputes"] = en(coord_disputes or "The identification of this site is debated; coordinates mark the leading candidate described in the summary.")
    return {
        "id": id,
        "ancientName": en(ancient),
        **({"modernName": en(modern_name)} if modern_name else {}),
        "modernLocation": en(modern_loc),
        "coordinates": coords,
        "summary": en(summary),
        "citations": cites if cites is not None else coord_cites,
    }


SITES = [
    site("site-valley-of-siddim", "Valley of Siddim (the Salt Sea basin)", None,
         "Southern basin of the Dead Sea (traditional); exact field unknown", 31.30, 35.47, "disputed",
         ["cit-wikipedia-vale-of-siddim"],
         "The 'vale of Siddim, which is the salt sea' (Genesis 14:3), full of bitumen pits, where the four Mesopotamian kings under Chedorlaomer defeated the five cities of the plain and carried off Lot — prompting Abram's night pursuit and rescue. The traditional location is the shallow southern basin of the Dead Sea; no site has been identified."),
    site("site-heshbon", "Heshbon (city of Sihon the Amorite)", "Tell Hisban",
         "Tell Hisban, Jordan, ~20 km southwest of Amman", 31.8017, 35.8092, "medium",
         ["cit-wikipedia-heshbon"],
         "Capital of Sihon king of the Amorites, taken by Israel on the march up the King's Highway when Sihon refused passage and gave battle at Jahaz (Numbers 21:21-31). Tell Hisban preserves the name; its excavated Iron Age remains post-date the conquest debate, one strand of the wider dating question."),
    site("site-edrei", "Edrei (city of Og of Bashan)", "Daraa",
         "Daraa, southern Syria, on the Yarmouk tributaries", 32.6189, 36.1058, "medium",
         ["cit-wikipedia-daraa-edrei"],
         "Where 'Og the king of Bashan went out against them... to battle at Edrei' (Numbers 21:33) and was defeated, giving Israel the Bashan plateau. The name survives continuously in modern Daraa."),
    site("site-jericho-ot", "Jericho (Old Testament city)", "Tell es-Sultan",
         "Tell es-Sultan, beside modern Jericho, West Bank — the world's oldest walled town", 31.8711, 35.4442, "high",
         ["cit-ot-jericho"],
         "The fortified oasis city whose walls fell to Joshua after seven days of circuits (Joshua 6) — the opening act of the conquest. Tell es-Sultan shows collapsed mudbrick ramparts and a burn layer; whether that destruction dates to c. 1400 BC (Garstang, Wood) or c. 1550 BC (Kenyon) is the classic conquest-archaeology debate."),
    site("site-ai", "Ai (Ha-Ai, 'the ruin')", "et-Tell (disputed)",
         "et-Tell near Deir Dibwan, West Bank (majority identification; Khirbet el-Maqatir is the main rival)", 31.9169, 35.2618, "disputed",
         ["cit-wikipedia-ai-canaan"],
         "The second city of the conquest: Israel's initial repulse (Achan's sin), then its capture by ambush (Joshua 7-8). The majority site, et-Tell, was unoccupied in the Late Bronze Age — the sharpest identification problem in conquest archaeology; Khirbet el-Maqatir has been proposed as an alternative."),
    site("site-gibeon", "Gibeon", "el-Jib",
         "el-Jib, West Bank, ~9 km northwest of Jerusalem", 31.8497, 35.1856, "high",
         ["cit-wikipedia-gibeon"],
         "The Hivite city that made peace with Joshua by ruse and was then defended by him against the five Amorite kings — the day of hailstones and the sun standing still (Joshua 10). Jar handles stamped 'gb'n' from el-Jib's great rock-cut pool confirmed the identification; the pool itself figures in 2 Samuel 2:13."),
    site("site-hazor", "Hazor, 'the head of all those kingdoms'", "Tel Hazor",
         "Tel Hazor, Upper Galilee, Israel, ~14 km north of the Sea of Galilee", 33.0175, 35.5683, "high",
         ["cit-wikipedia-tel-hazor"],
         "The largest Canaanite city of the land (~80 ha), seat of Jabin, head of the northern coalition crushed at the waters of Merom — 'and he burnt Hazor with fire' (Joshua 11:11-13). The tell's Late Bronze destruction layer, with burned palace and mutilated cult statues, is central to the conquest debate; the city rose again under Solomon (1 Kings 9:15) and fell to Tiglath-pileser III in 732 BC (2 Kings 15:29)."),
    site("site-mount-tabor", "Mount Tabor", "Har Tavor",
         "Mount Tabor, Lower Galilee, Israel, rising from the Jezreel valley", 32.6870, 35.3906, "high",
         ["cit-wikipedia-mount-tabor"],
         "The dome-shaped mountain where Barak mustered ten thousand of Naphtali and Zebulun at Deborah's word, descending on Sisera's nine hundred iron chariots as the Kishon swept them away (Judges 4-5)."),
    site("site-spring-of-harod", "Spring of Harod (En-harod)", "Ma'ayan Harod",
         "Ma'ayan Harod at the foot of Mount Gilboa, Jezreel valley, Israel", 32.5503, 35.3567, "high",
         ["cit-wikipedia-maayan-harod"],
         "The spring where Gideon's army was sifted to three hundred by the manner of their drinking, before the night attack with torches and trumpets on the Midianite camp by the hill of Moreh (Judges 7)."),
    site("site-gibeah", "Gibeah of Benjamin (Gibeah of Saul)", "Tell el-Ful (disputed)",
         "Tell el-Ful, northern outskirts of Jerusalem (identification debated)", 31.8236, 35.2311, "disputed",
         ["cit-wikipedia-gibeah"],
         "Benjamite town whose outrage against the Levite's concubine ignited Israel's first civil war — all the tribes against Benjamin, and Benjamin nearly annihilated (Judges 19-21). Later Saul's seat. Albright's identification with Tell el-Ful, though standard, remains debated."),
    site("site-mizpah", "Mizpah of Benjamin", "Tell en-Nasbeh",
         "Tell en-Nasbeh, ~12 km north of Jerusalem, West Bank", 31.8853, 35.2161, "medium",
         ["cit-wikipedia-tell-en-nasbeh"],
         "Samuel's mustering point, where thunder routed the Philistines and the stone Ebenezer — 'hitherto hath the LORD helped us' — was raised (1 Samuel 7:5-14). Later fortified by Asa against Israel with the stones of dismantled Ramah (1 Kings 15:22)."),
    site("site-aphek-ebenezer", "Aphek (by Ebenezer)", "Tel Afek (Antipatris)",
         "Tel Afek, Rosh Ha'ayin, Israel, at the Yarkon springs", 32.1047, 34.9303, "high",
         ["cit-wikipedia-antipatris"],
         "The Philistine camp opposite Israel's at Ebenezer where the ark of the covenant was captured, Hophni and Phinehas killed, and Eli's line judged — 'the glory is departed from Israel' (1 Samuel 4). The same tell became Herod's Antipatris, where Paul spent a night under Roman escort (Acts 23:31)."),
    site("site-michmash", "Michmash", "Mukhmas",
         "Mukhmas, West Bank, above the Wadi Suweinit pass ~11 km northeast of Jerusalem", 31.8697, 35.2736, "high",
         ["cit-wikipedia-michmash"],
         "Philistine forward camp between the crags Bozez and Seneh, where Jonathan and his armour-bearer scaled the pass and started the panic that Saul's muster turned into a rout (1 Samuel 13-14)."),
    site("site-valley-of-elah", "Valley of Elah (between Socoh and Azekah)", "Wadi es-Sunt",
         "The Elah valley, Israel, overlooked by Khirbet Qeiyafa; the brook of the five smooth stones runs its floor", 31.6906, 34.9575, "high",
         ["cit-wikipedia-valley-of-elah"],
         "Where the armies faced off 'between Socoh and Azekah' and David met Goliath of Gath with a sling and a shepherd's staff (1 Samuel 17). The fortified early-10th-century site of Khirbet Qeiyafa above the valley bears directly on the debate over the kingdom David actually ruled."),
    site("site-mount-gilboa", "Mount Gilboa", "Har Gilboa",
         "Mount Gilboa ridge above the Jezreel valley, Israel", 32.5333, 35.4167, "high",
         ["cit-wikipedia-mount-gilboa"],
         "Where Israel broke before the Philistines massed at Shunem: Saul's three sons fell, and the wounded king died on his own sword; the bodies were hung on the wall of Beth-shan (1 Samuel 31). David's lament: 'Ye mountains of Gilboa, let there be no dew' (2 Samuel 1:21)."),
    site("site-rabbah-ammon", "Rabbah of the Ammonites (Rabbath-ammon)", "Amman Citadel",
         "The Citadel (Jabal al-Qal'a), Amman, Jordan", 31.9544, 35.9344, "high",
         ["cit-wikipedia-amman-citadel"],
         "Capital of Ammon, besieged by Joab while David remained in Jerusalem — the siege in which Uriah the Hittite was deliberately abandoned at the wall (2 Samuel 11); David later took 'the city of waters' and its crown (2 Samuel 12:26-31)."),
    site("site-mahanaim", "Mahanaim", "Tulul adh-Dhahab (candidate)",
         "Tulul adh-Dhahab twin tells on the Jabbok (Zarqa) river, Jordan (leading candidate; identification uncertain)", 32.1833, 35.6900, "disputed",
         ["cit-wikipedia-mahanaim"],
         "Jacob's 'two camps' on the Jabbok, Ish-bosheth's Transjordan capital, and David's refuge during Absalom's revolt — the battle of the forest of Ephraim was fought nearby, 'and the wood devoured more people that day than the sword' (2 Samuel 18)."),
    site("site-mount-zemaraim", "Mount Zemaraim (in the hills of Ephraim)", None,
         "Unidentified rise near the Bethel plateau, West Bank (Ras et-Tahuneh and others proposed)", 31.9333, 35.2333, "disputed",
         ["cit-wikipedia-mount-zemaraim"],
         "Where Abijah of Judah, outnumbered two to one, addressed Jeroboam's Israel from the mountainside and then broke the double envelopment — Judah took Bethel, Jeshanah, and Ephron (2 Chronicles 13). The mountain itself has not been securely identified."),
    site("site-ramah", "Ramah of Benjamin", "er-Ram",
         "er-Ram, West Bank, ~8 km north of Jerusalem astride the north road", 31.8500, 35.2333, "high",
         ["cit-wikipedia-ramah-benjamin"],
         "The border town Baasha of Israel fortified 'that he might not suffer any to go out or come in to Asa king of Judah' — the chokepoint of the Israel-Judah border war, dismantled when Asa's silver turned Ben-hadad of Damascus against the north (1 Kings 15:16-22)."),
    site("site-beth-shemesh", "Beth-shemesh", "Tel Beit Shemesh",
         "Tel Beit Shemesh, Israel, in the Sorek valley ~30 km west of Jerusalem", 31.7522, 34.9767, "high",
         ["cit-wikipedia-beth-shemesh"],
         "Judahite border town where the ark returned from Philistia on a cart (1 Samuel 6) — and where, generations later, Jehoash of Israel captured Amaziah of Judah in the bluntest Israel-vs-Judah defeat, then broke down Jerusalem's wall and emptied the temple treasuries (2 Kings 14:11-14)."),
    site("site-samaria-city", "Samaria (city of Omri and Ahab)", "Sebastia",
         "Sebastia, West Bank — the acropolis of Omri's hill", 32.2764, 35.1900, "high",
         ["cit-wikipedia-samaria-city"],
         "Capital of the northern kingdom from Omri onward: Ahab's ivory house, Ben-hadad's failed siege (1 Kings 20), Elisha's famine siege lifted overnight (2 Kings 6-7), and at last the three-year Assyrian siege that ended the kingdom of Israel in 722 BC (2 Kings 17). Excavated palace quarter, ivories, and the Samaria ostraca survive."),
    site("site-aphek-golan", "Aphek (east of the Sea of Galilee)", "Fiq/'Afiq area (candidate)",
         "Golan Heights near modern 'Afiq, above En Gev (identification uncertain)", 32.7789, 35.7000, "disputed",
         ["cit-wikipedia-antipatris"],
         "The Aphek of the Aramean wars, 'where a wall fell upon twenty and seven thousand of the men that were left' after Israel's victory over Ben-hadad (1 Kings 20:26-30), and where Elisha told Joash he would smite Aram (2 Kings 13:17). Distinct from the coastal Aphek; the eastern site is not securely identified."),
    site("site-qarqar", "Qarqar on the Orontes", "Tell Qarqur",
         "Tell Qarqur, Orontes valley, northwest Syria", 35.7439, 36.3339, "medium",
         ["cit-wikipedia-tell-qarqur"],
         "Where Shalmaneser III's Assyrian army met a twelve-king coalition in 853 BC — including 'Ahab the Israelite' with 2,000 chariots and 10,000 soldiers, per the Kurkh Monolith. Unmentioned in Scripture, the battle is the linchpin synchronism that fixes the divided-kingdom chronology to absolute dates."),
    site("site-ramoth-gilead", "Ramoth-gilead", "Tell er-Rumeith (candidate)",
         "Tell er-Rumeith, northern Jordan (leading candidate; identification uncertain)", 32.5644, 36.0106, "disputed",
         ["cit-wikipedia-ramoth-gilead-site"],
         "Levitical refuge city and perennial Israel-Aram flashpoint: Ahab fell here disguised in his chariot despite Micaiah's warning (1 Kings 22), and Joram's wounds from its later siege set the stage for Jehu's anointing in this same camp (2 Kings 8-9)."),
    site("site-jezreel", "Jezreel (royal winter seat)", "Tel Jezreel",
         "Tel Jezreel, Jezreel valley, Israel", 32.5583, 35.3278, "high",
         ["cit-wikipedia-tel-jezreel"],
         "The Omride military enclosure and winter seat beside Naboth's vineyard — where Jehu's furious chariot drive ended with Joram dead in Naboth's field, Ahaziah of Judah mortally wounded, and Jezebel thrown from the window (2 Kings 9). The excavated Iron II casemate enclosure matches the dynasty's scale."),
    site("site-kir-hareseth", "Kir-hareseth (Kir of Moab)", "al-Karak",
         "al-Karak, Jordan, beneath the Crusader castle", 31.1811, 35.7047, "high",
         ["cit-wikipedia-kir-of-moab"],
         "Moab's fortress capital, the last hold-out in the allied campaign of Israel, Judah, and Edom against Mesha's rebellion — the siege broken off after the king of Moab offered his heir on the wall (2 Kings 3:25-27). Mesha's own account of the war survives on the Mesha Stele."),
    site("site-megiddo", "Megiddo", "Tel Megiddo",
         "Tel Megiddo, Israel, commanding the Aruna pass into the Jezreel valley", 32.5850, 35.1839, "high",
         ["cit-wikipedia-tel-megiddo"],
         "The chariot city guarding the great trunk road — fortified by Solomon (1 Kings 9:15), and the field where Josiah, intercepting Pharaoh Necho II's march to the Euphrates in 609 BC, was mortally wounded (2 Kings 23:29). Its twenty-plus superimposed cities made 'Har Megiddo' — Armageddon — a byword for battle."),
    site("site-carchemish", "Carchemish", "Jerablus/Karkamış",
         "On the Euphrates at the Syria-Turkey border, near Jerablus", 36.8300, 38.0150, "high",
         ["cit-wikipedia-carchemish"],
         "The Euphrates fortress where Nebuchadnezzar crushed the Egyptian and Assyrian remnant in 605 BC — 'concerning the army of Pharaoh-necho... which was by the river Euphrates in Carchemish' (Jeremiah 46:2) — opening the Levant to Babylon and setting Judah's final act in motion."),
    site("site-dan", "Dan (Laish)", "Tel Dan",
         "Tel Dan nature reserve at the foot of Mount Hermon, Israel", 33.2486, 35.6522, "high",
         ["cit-wikipedia-tel-dan"],
         "Northernmost city of the land — 'from Dan even to Beersheba'. The Danites took Laish by the sword (Judges 18); Jeroboam I set one of the two golden calves here; and the Tel Dan Stele, found in its gate complex, carries an Aramean king's boast over the 'house of David'."),
    site("site-lachish", "Lachish", "Tell ed-Duweir",
         "Tel Lachish, Shephelah of Judah, Israel", 31.5650, 34.8489, "high",
         ["cit-wikipedia-lachish"],
         "Judah's second city. Joshua took it in the southern campaign (Joshua 10:31-32); Sennacherib besieged and stormed it in 701 BC — carving the assault in stone for his palace at Nineveh, while his siege ramp still lies against the tell; and its gate-room yielded the Lachish letters, written as Nebuchadnezzar's army closed in c. 588 BC (Jeremiah 34:7)."),
]

# --------------------------------------------------------------- artifacts
def artifact(id, name, site_id, modern_loc, corroborates, a, b, disp, conf, cites, disputes=None):
    d = {
        "id": id,
        "name": en(name),
        "siteId": site_id,
        "modernLocation": en(modern_loc),
        "corroborates": en(corroborates),
        "dateRange": dr(a, b, disp),
        "confidence": conf,
        "reviewStatus": "self-reviewed",
        "citations": cites,
    }
    if disputes:
        d["disputes"] = en(disputes)
    return d


ARTIFACTS = [
    artifact("artifact-lachish-reliefs", "The Lachish Reliefs", "site-lachish",
             "British Museum, London (from Sennacherib's 'Palace Without Rival', Nineveh)",
             "Sennacherib's own wall-carvings of the 701 BC storming of Lachish — siege ramp, battering rams, archers, impaled defenders, and files of Judean deportees — matching 2 Kings 18:13-14 ('Sennacherib... came up against all the fenced cities of Judah, and took them') and the ramp, arrowheads, and burn layer excavated at the tell itself. The fullest visual record of any event named in the Bible.",
             -700, -681, "carved c. 700-681 BC", "high",
             ["cit-wikipedia-lachish-reliefs", "cit-wikipedia-siege-of-lachish"]),
    artifact("artifact-lachish-letters", "The Lachish Letters (ostraca)", "site-lachish",
             "British Museum, London, and the Israel Museum, Jerusalem",
             "Eighteen ink-on-sherd military dispatches found in the burned gate-room of Lachish, written as Nebuchadnezzar's army reduced Judah c. 589-588 BC. Letter IV reports 'we are watching for the signals of Lachish... for we cannot see Azekah' — the same last-two-fortresses moment as Jeremiah 34:7.",
             -590, -586, "c. 589-586 BC", "high",
             ["cit-wikipedia-lachish-letters"]),
    artifact("artifact-kurkh-monolith", "The Kurkh Monolith of Shalmaneser III", "site-qarqar",
             "British Museum, London (found at Kurkh, upper Tigris)",
             "Assyrian victory stele naming 'Ahab the Israelite' (A-ha-ab-bu mat Sir-'i-la-a-a) fielding 2,000 chariots and 10,000 soldiers in the coalition that met Shalmaneser III at Qarqar in 853 BC — the earliest securely dated extra-biblical mention of a king of Israel, and the synchronism that anchors the divided-kingdom chronology.",
             -853, -845, "c. 853-845 BC", "high",
             ["cit-wikipedia-kurkh-monoliths", "cit-wikipedia-battle-of-qarqar"]),
    artifact("artifact-black-obelisk", "The Black Obelisk of Shalmaneser III", "site-samaria-city",
             "British Museum, London (found at Nimrud/Kalhu)",
             "Four-sided basalt obelisk whose second register shows 'Jehu son of Omri' (Ia-u-a mar Hu-um-ri) bowing to the ground before Shalmaneser III and rendering tribute in 841 BC — the only surviving ancient depiction of an Israelite king, within months of the coup of 2 Kings 9-10.",
             -827, -824, "c. 827-824 BC", "high",
             ["cit-wikipedia-black-obelisk", "cit-wikipedia-jehu"]),
    artifact("artifact-khirbet-qeiyafa", "Khirbet Qeiyafa — the Elah fortress and ostracon", "site-valley-of-elah",
             "Khirbet Qeiyafa, above the Valley of Elah; ostracon in the Israel Museum",
             "A massively fortified, single-period city overlooking the Elah valley, radiocarbon-dated to c. 1020-980 BC, with a casemate wall, two gates (suggesting biblical Shaaraim, 1 Samuel 17:52), an absence of pig bones, and the earliest known Hebrew-language ostracon. Bears directly on whether a centralized kingdom existed in Judah in David's generation — the very valley of the Goliath duel.",
             -1020, -980, "c. 1020-980 BC (radiocarbon)", "disputed",
             ["cit-wikipedia-khirbet-qeiyafa"],
             disputes="Identification and ethnicity are argued: Garfinkel reads a Judahite fortress of David's kingdom; others propose a northern-Israelite, Philistine, or Canaanite town, and the 'Shaaraim' reading of the two gates is contested. The radiocarbon dating window itself is broadly accepted."),
    artifact("artifact-jehoiachin-tablets", "Jehoiachin's Rations Tablets", "site-jerusalem",
             "Pergamon Museum, Berlin (from the South Palace archive, Babylon)",
             "Babylonian administrative tablets (c. 592 BC) listing oil rations for 'Ya'u-kinu, king of the land of Yahudu' and his five sons — the exiled Jehoiachin of 2 Kings 24:15, held in Babylon exactly as 2 Kings 25:27-30 describes his maintenance at the royal table.",
             -595, -570, "c. 595-570 BC", "high",
             ["cit-wikipedia-jehoiachin-tablets"]),
    artifact("artifact-samaria-ostraca", "The Samaria Ostraca", "site-samaria-city",
             "Found in the palace treasury quarter of Samaria; Istanbul Archaeology Museums",
             "Over a hundred eighth-century BC ink-inscribed sherds recording wine and oil shipments to the capital, written in the northern Hebrew dialect. Their clan and district names — Abiezer, Helek, Shechem, Shemida — match the Manassite clan lists of Joshua 17, fixing the tribal geography in the kingdom of Israel's own administration.",
             -790, -750, "c. 790-750 BC", "medium",
             ["cit-wikipedia-samaria-ostraca"]),
    artifact("artifact-jericho-fallen-walls", "The fallen walls of Jericho (Tell es-Sultan)", "site-jericho-ot",
             "Tell es-Sultan, Jericho — excavated ramparts in situ",
             "Collapsed mudbrick city walls lying at the base of the stone revetment — in places forming a ready ramp up into the city — with a thick destruction-burn layer and jars still full of charred grain from a short siege in spring, matching the sequence of Joshua 6 (walls fallen flat, city burned, harvest-time, plunder banned).",
             -1550, -1400, "destruction c. 1550 BC (Kenyon) or c. 1400 BC (Garstang/Wood)", "disputed",
             ["cit-abr-jericho-walls", "cit-ot-jericho"],
             disputes="Kenyon dated the fallen City IV walls to c. 1550 BC (too early for any conquest chronology); Garstang and later Wood re-date the same destruction to c. 1400 BC on pottery and scarab grounds, matching the early conquest date. Bienkowski, Sharon and others defend Kenyon. The debate is unresolved and turns on Cypriot pottery and radiocarbon calibration."),
    artifact("artifact-hazor-burn-layer", "The Late Bronze destruction of Hazor", "site-hazor",
             "Tel Hazor — excavated palace destruction in situ",
             "A violent, city-wide destruction ending Late Bronze Hazor (stratum XIII/1A, 13th century BC): the ceremonial palace burned at temperatures over 1,000 °C, and the heads and hands of Canaanite cult statues were deliberately severed — matching 'he burnt Hazor with fire' and the iconoclasm of Joshua 11:11-13. Who set the fire is argued; that the greatest city of Canaan fell exactly as only this one city is said to have been burned is the point of contact.",
             -1300, -1200, "13th century BC", "medium",
             ["cit-wikipedia-tel-hazor"]),
]

# ---------------------------------------------------------------- battles
CONQUEST_DATE = dr(-1406, -1200, "c. 1406 BC (early date) or c. 1230-1200 BC (late date)")
CONQUEST_DISPUTE = (
    "The date of the conquest is a standing scholarly dispute: the 'early' chronology (1 Kings 6:1 taken at face value) "
    "places it c. 1406 BC; the 'late' chronology (Ramesside-era destructions, the Merneptah Stele's terminus) c. 1230-1200 BC; "
    "and minimalist reconstructions read the accounts as later composition. The entry reports the narrative with both anchor dates."
)


def battle(id, title, kind, combatants, outcome, site, a, b, disp, summary, refs,
           location_note=None, artifacts=None, area=None, conf="medium", cites=None,
           disputes=None, date=None, approx=True):
    e = {
        "id": id,
        "title": en(title),
        "kind": kind,
        "combatants": en(combatants),
        "outcome": en(outcome),
        "siteId": site,
        "dateRange": date if date else {"startYear": a, "endYear": b, "display": en(disp), "approximate": approx},
        "summary": en(summary),
        "scriptureRefs": refs,
        "confidence": conf,
        "reviewStatus": "self-reviewed",
        "citations": cites or ["cit-thiele-chronology"],
    }
    if location_note:
        e["locationNote"] = en(location_note)
    if artifacts:
        e["artifactIds"] = artifacts
    if area:
        e["area"] = area
    if disputes:
        e["disputes"] = en(disputes)
    return e


BATTLES = [
    # ---- Patriarchs and the wilderness ----
    battle("battle-vale-of-siddim", "The battle of the Vale of Siddim and Abram's rescue of Lot", "battle",
           "Four Mesopotamian kings under Chedorlaomer of Elam vs. the five cities of the plain; then Abram's 318 men vs. the withdrawing coalition",
           "The cities of the plain fell and Lot was carried off; Abram pursued to Dan and Hobah by night, routed the column, and recovered Lot, the people, and the goods",
           "site-valley-of-siddim", -2000, -1750, "c. 2000-1750 BC (patriarchal era)",
           "The Bible's first recorded battle: the eastern coalition crushed the rebellion of Sodom and its neighbours among the bitumen pits of Siddim, taking Lot captive. Abram armed his household, fell on the camp by night divisions, and chased the survivors north of Damascus — returning to meet Melchizedek of Salem with the spoil.",
           ["Genesis 14:1-16", "Genesis 14:17-20"],
           conf="legendary",
           cites=["cit-wikipedia-vale-of-siddim"],
           location_note="The vale is placed by the text at the Salt Sea; the pursuit ran the length of the land to Dan and beyond Damascus."),
    battle("battle-rephidim", "Amalek attacks Israel at Rephidim", "battle",
           "Amalek vs. Israel under Joshua's first command",
           "Amalek was defeated 'with the edge of the sword' while Moses' hands were held up on the hill; Amalek's ambush of the stragglers was never forgotten (Deuteronomy 25:17-19)",
           "site-mount-sinai", -1446, -1210, "c. 1446 BC or c. 1260-1210 BC (exodus-date debate)",
           "Israel's first battle as a people: Amalek fell on the rear of the column at Rephidim, near the mountain of God. Joshua led the chosen men in the valley while Moses, flanked by Aaron and Hur, kept the staff of God raised until sunset — 'and Joshua discomfited Amalek'.",
           ["Exodus 17:8-16"],
           conf="disputed",
           disputes="Both the site of Rephidim and the date of the exodus are unresolved: the early chronology places the battle c. 1446 BC, the late chronology c. 1260-1210 BC, and Rephidim's location depends on which Sinai route is accepted.",
           location_note="Rephidim lay one stage before Sinai (Exodus 19:2); anchored to the traditional Mount Sinai, with the site itself unidentified.",
           cites=["cit-thiele-chronology"]),
    battle("battle-jahaz-sihon", "The defeat of Sihon king of the Amorites", "battle",
           "Israel under Moses vs. Sihon king of Heshbon",
           "Sihon fell at Jahaz; Israel took his land 'from Arnon unto Jabbok' and occupied Heshbon and her towns",
           "site-heshbon", -1406, -1200, "conquest era (see date debate)",
           "Refused passage on the King's Highway, Sihon marched out and gave battle at Jahaz — and lost his whole Transjordan kingdom, the first territory Israel held. The victory became a fixed refrain of Israel's memory (Deuteronomy 2, Psalm 135, Psalm 136).",
           ["Numbers 21:21-31", "Deuteronomy 2:24-36"],
           conf="disputed", disputes=CONQUEST_DISPUTE,
           location_note="Jahaz itself is unidentified (candidates on the Moabite plateau); anchored at Sihon's capital, Heshbon.",
           cites=["cit-wikipedia-heshbon"]),
    battle("battle-edrei-og", "The defeat of Og king of Bashan at Edrei", "battle",
           "Israel under Moses vs. Og king of Bashan, 'of the remnant of the giants'",
           "Og was defeated 'until there was none left him remaining'; sixty fortified cities of Argob fell to Israel",
           "site-edrei", -1406, -1200, "conquest era (see date debate)",
           "Turning north up the King's Highway, Israel met Og of Bashan — whose iron bedstead, nine cubits long, was still pointed out in Rabbah (Deuteronomy 3:11) — at Edrei, and took the whole basalt plateau of Bashan with its walled cities.",
           ["Numbers 21:33-35", "Deuteronomy 3:1-11"],
           conf="disputed", disputes=CONQUEST_DISPUTE,
           cites=["cit-wikipedia-daraa-edrei"]),
    # ---- The conquest of Canaan ----
    battle("battle-jericho", "The fall of Jericho", "siege",
           "Israel under Joshua vs. the walled city of Jericho",
           "After seven days of circuits the wall 'fell down flat'; the city was burned and put under the ban, Rahab's household alone spared",
           "site-jericho-ot", -1406, -1200, "conquest era (see date debate)",
           "The opening act of the conquest west of the Jordan: no assault, but seven days of processions with the ark and seven trumpets of rams' horns, then the shout — and the collapse. Tell es-Sultan's fallen mudbrick ramparts, burn layer, and jars of charred spring grain are the debate's centrepiece: the sequence matches Joshua 6 strikingly, but whether it dates to c. 1400 or c. 1550 BC divides the field.",
           ["Joshua 6:1-21", "Joshua 6:24-25"],
           artifacts=["artifact-jericho-fallen-walls"],
           conf="disputed", disputes=CONQUEST_DISPUTE,
           cites=["cit-wikipedia-battle-of-jericho", "cit-abr-jericho-walls"]),
    battle("battle-ai", "The taking of Ai", "battle",
           "Israel under Joshua vs. the men of Ai and Bethel",
           "After the repulse caused by Achan's sin, Ai fell to a feigned-retreat ambush; the city was burned and left 'an heap for ever'",
           "site-ai", -1406, -1200, "conquest era (see date debate)",
           "The conquest's hard lesson: three thousand men were routed at first ('the hearts of the people melted'), the sin of Achan was exposed by lot, and then Joshua drew the defenders out with a feigned flight while thirty thousand lay in ambush behind the city — the classic double envelopment of ancient literature.",
           ["Joshua 7:2-5", "Joshua 8:1-28"],
           conf="disputed",
           disputes="Beyond the conquest-date debate, Ai's very site is contested: et-Tell, the majority identification, was unoccupied in the Late Bronze Age; Khirbet el-Maqatir is the principal proposed alternative. The entry anchors to et-Tell as the standard identification.",
           cites=["cit-wikipedia-ai-canaan"]),
    battle("battle-gibeon-southern-campaign", "The battle of Gibeon and the southern campaign", "campaign",
           "Israel under Joshua vs. the five Amorite kings (Jerusalem, Hebron, Jarmuth, Lachish, Eglon)",
           "The coalition broke at Gibeon and was destroyed down the Beth-horon descent; the campaign then swept the Shephelah — Makkedah, Libnah, Lachish, Eglon, Hebron, Debir",
           "site-gibeon", -1406, -1200, "conquest era (see date debate)",
           "The five kings marched to punish Gibeon for its treaty with Israel; Joshua force-marched all night from Gilgal and fell on them at dawn. Great hailstones did more execution than the sword down the pass, and the day of the long light — 'Sun, stand thou still upon Gibeon' — became Israel's byword for a day unlike any other. The southern hill country and Shephelah fell in the sweep that followed.",
           ["Joshua 10:1-15", "Joshua 10:28-43"],
           area=[[35.19, 31.85], [35.30, 31.70], [35.25, 31.45], [35.05, 31.35], [34.80, 31.45], [34.85, 31.70], [35.00, 31.85], [35.19, 31.85]],
           location_note="Area highlight is an approximate sweep of the Joshua 10 campaign (Gibeon and the Aijalon descent through the Shephelah cities to Hebron and Debir), not a surveyed boundary.",
           conf="disputed", disputes=CONQUEST_DISPUTE,
           artifacts=["artifact-merneptah-stele"],
           cites=["cit-wikipedia-battle-of-gibeon"]),
    battle("battle-waters-of-merom", "The waters of Merom and the burning of Hazor", "campaign",
           "Israel under Joshua vs. the northern coalition under Jabin king of Hazor",
           "The coalition of the northern kings, 'as the sand that is upon the sea shore', was surprised and routed at the waters of Merom; their horses hamstrung, their chariots burned — and Hazor, 'the head of all those kingdoms', burned with fire",
           "site-hazor", -1406, -1200, "conquest era (see date debate)",
           "The largest muster of the conquest: the kings of the north massed with horses and chariots at the waters of Merom, and Joshua fell upon them suddenly. Hazor alone of the northern cities was burned — and Tel Hazor's Late Bronze stratum shows precisely that: a palace burned beyond 1,000 °C and its cult images deliberately mutilated. The date and agent of that destruction remain argued.",
           ["Joshua 11:1-15"],
           area=[[35.30, 32.85], [35.65, 32.80], [35.75, 33.05], [35.60, 33.25], [35.30, 33.10], [35.20, 32.95], [35.30, 32.85]],
           location_note="The waters of Merom are usually placed in the upland basin west of Hazor; area highlight approximates the Joshua 11 northern sweep.",
           artifacts=["artifact-hazor-burn-layer"],
           conf="disputed", disputes=CONQUEST_DISPUTE,
           cites=["cit-wikipedia-waters-of-merom", "cit-wikipedia-tel-hazor"]),
    # ---- Judges ----
    battle("battle-kishon-deborah", "Deborah and Barak against Sisera at the Kishon", "deliverance",
           "Israel (Naphtali and Zebulun under Barak, at Deborah's word) vs. the chariot army of Sisera, commander for Jabin of Canaan",
           "Sisera's nine hundred iron chariots were routed as the Kishon flooded — 'the river of Kishon swept them away'; Sisera fled afoot and died by Jael's tent peg",
           "site-mount-tabor", -1200, -1125, "c. 1200-1125 BC (Judges era)",
           "From the slopes of Tabor, Barak's ten thousand charged into the plain as a storm turned the Kishon into a torrent and mired the iron chariots — commemorated in the Song of Deborah (Judges 5), by common consent among the oldest Hebrew poetry preserved: 'the stars in their courses fought against Sisera'.",
           ["Judges 4:4-16", "Judges 5:19-21"],
           area=[[35.05, 32.70], [35.35, 32.55], [35.50, 32.55], [35.45, 32.70], [35.20, 32.80], [35.05, 32.70]],
           location_note="Fought in the Jezreel valley between Tabor and 'Taanach by the waters of Megiddo' (Judges 5:19); area highlight approximates the battle plain.",
           cites=["cit-wikipedia-battle-mount-tabor"]),
    battle("battle-harod-gideon", "Gideon's three hundred against Midian", "deliverance",
           "Gideon's three hundred vs. the Midianite-Amalekite camp 'like grasshoppers for multitude'",
           "The camp panicked at the torches and trumpets and turned every man's sword against his fellow; the rout was pursued across the Jordan and the princes Oreb and Zeeb taken",
           "site-spring-of-harod", -1180, -1100, "c. 1180-1100 BC (Judges era)",
           "Sifted from thirty-two thousand to three hundred at the spring of Harod 'lest Israel vaunt themselves', Gideon's men ringed the Midianite camp below the hill of Moreh at the middle watch with trumpets, empty jars, and hidden torches — and the host broke itself.",
           ["Judges 7:1-8", "Judges 7:16-25"],
           cites=["cit-wikipedia-gideon", "cit-wikipedia-maayan-harod"]),
    battle("battle-gibeah-civil-war", "The Benjamite war at Gibeah — Israel's first civil war", "civil-war",
           "The united tribes of Israel vs. the tribe of Benjamin",
           "After two bloody repulses, Benjamin was drawn from the city by feigned flight and nearly annihilated — six hundred men surviving at the rock of Rimmon; the tribe was rebuilt by the provision of wives at Shiloh",
           "site-gibeah", -1150, -1050, "c. 1150-1050 BC (late Judges era)",
           "The atrocity against the Levite's concubine at Gibeah summoned all Israel 'as one man' against Benjamin, who would not give up the guilty city. Four hundred thousand mustered; twice the tribes were repulsed with slaughter before the ambush stratagem — an internal war so dark the book closes over it: 'In those days there was no king in Israel.'",
           ["Judges 19:22-30", "Judges 20:1-48", "Judges 21:1-23"],
           cites=["cit-wikipedia-battle-of-gibeah", "cit-wikipedia-gibeah"]),
    # ---- Samuel and Saul ----
    battle("battle-ebenezer-ark-lost", "The battle of Aphek-Ebenezer — the ark captured", "battle",
           "The Philistine lords vs. Israel under Eli's sons",
           "Israel lost four thousand, then thirty thousand; the ark of the covenant was captured, Hophni and Phinehas killed, and Eli died at the news — 'The glory is departed from Israel'",
           "site-aphek-ebenezer", -1080, -1050, "c. 1080-1050 BC",
           "Israel's darkest field of the Philistine wars: after the first defeat the elders fetched the ark itself to the camp as a talisman, and lost it. The ark's captivity among the Philistine cities (Ashdod, Gath, Ekron) and its return by cart to Beth-shemesh fill the sequel.",
           ["1 Samuel 4:1-18", "1 Samuel 5:1-2", "1 Samuel 6:10-15"],
           cites=["cit-wikipedia-battle-of-aphek", "cit-wikipedia-antipatris"]),
    battle("battle-mizpah-ebenezer-raised", "The rout from Mizpah — Ebenezer raised", "deliverance",
           "The Philistine lords vs. Israel gathered under Samuel",
           "A great thunder threw the Philistine line into confusion; Israel pursued from Mizpah to below Beth-car, and the lost cities were restored",
           "site-mizpah", -1070, -1040, "c. 1070-1040 BC",
           "As Samuel offered the burnt offering at the national assembly of repentance, the Philistines attacked — and broke. Samuel set the memorial stone between Mizpah and Shen: Ebenezer, 'hitherto hath the LORD helped us', answering the field where the ark had been lost.",
           ["1 Samuel 7:5-14"],
           cites=["cit-wikipedia-tell-en-nasbeh"]),
    battle("battle-michmash", "Jonathan at the pass of Michmash", "battle",
           "Israel under Saul and Jonathan vs. the Philistine garrison and camp",
           "Jonathan and his armour-bearer's assault on the outpost set off an earthquake-panic in the camp; Saul's six hundred and the returning Hebrews turned it into a general rout 'beyond Beth-aven'",
           "site-michmash", -1025, -1010, "c. 1025-1010 BC",
           "With Israel disarmed ('no smith found throughout all the land') and hiding in caves, Jonathan climbed the crag between Bozez and Seneh with one companion — 'there is no restraint to the LORD to save by many or by few' — and the Philistine grip on the central ridge broke in a day.",
           ["1 Samuel 13:16-23", "1 Samuel 14:1-23"],
           cites=["cit-wikipedia-battle-of-michmash", "cit-wikipedia-michmash"]),
    battle("battle-valley-of-elah", "David and Goliath in the Valley of Elah", "battle",
           "Israel under Saul vs. the Philistines; decided by single combat — David of Bethlehem vs. Goliath of Gath",
           "The champion fell to a sling stone; the Philistines broke and were pursued to the gates of Ekron 'by the way to Shaaraim'",
           "site-valley-of-elah", -1025, -1005, "c. 1025-1005 BC",
           "Forty days the armies faced each other across the brook while the six-cubit champion of Gath defied 'the armies of the living God'. The duel that answered him — a shepherd's sling against spear and shield, 'that all the earth may know that there is a God in Israel' — is the Bible's defining battle narrative. Khirbet Qeiyafa, the fortified two-gated city above this valley, dates to exactly the following generation and anchors the debate over David's kingdom.",
           ["1 Samuel 17:1-11", "1 Samuel 17:38-53"],
           artifacts=["artifact-khirbet-qeiyafa"],
           cites=["cit-wikipedia-goliath", "cit-wikipedia-valley-of-elah", "cit-wikipedia-khirbet-qeiyafa"]),
    battle("battle-mount-gilboa", "The battle of Mount Gilboa — the death of Saul", "battle",
           "The massed Philistine lords (camped at Shunem) vs. Israel under Saul (camped at Gilboa)",
           "Israel broke and fell on the mountain; Jonathan, Abinadab, and Malchishua died, and Saul fell on his own sword; the bodies were hung on the wall of Beth-shan",
           "site-mount-gilboa", -1012, -1008, "c. 1010 BC",
           "The end of Israel's first king, foretold at Endor the night before. The Philistines took the valley cities and cut the kingdom in two; the men of Jabesh-gilead, remembering Saul's first rescue, crossed by night to recover the bodies. David's lament over Saul and Jonathan — 'how are the mighty fallen' — opens his reign.",
           ["1 Samuel 28:4-19", "1 Samuel 31:1-13", "2 Samuel 1:17-27"],
           cites=["cit-wikipedia-battle-mount-gilboa", "cit-wikipedia-mount-gilboa"]),
    # ---- David ----
    battle("battle-jebus-jerusalem", "David takes the stronghold of Zion (Jebus)", "siege",
           "David and his men vs. the Jebusite city",
           "The 'stronghold of Zion' fell — by the water shaft, in the standard reading of 2 Samuel 5:8 — and became the city of David, capital of the united kingdom",
           "site-jerusalem", -1005, -1000, "c. 1003 BC",
           "The Jebusites taunted from walls that had never fallen — 'the blind and the lame shall keep thee out'. David took the ridge fortress between Judah and Benjamin and made it his neutral capital; Warren's Shaft and the Gihon spring-works excavated on the Ophel ridge frame the debate over how.",
           ["2 Samuel 5:6-10", "1 Chronicles 11:4-9"],
           artifacts=["artifact-tel-dan-stele"],
           cites=["cit-thiele-chronology"]),
    battle("battle-rephaim-baal-perazim", "The Philistine thrusts in the Valley of Rephaim", "battle",
           "The Philistines vs. David's new kingdom",
           "Two invasions broke — at Baal-perazim ('the LORD hath broken forth upon mine enemies'), then by the encircling march at the mulberry trees; the Philistines were driven 'from Geba until thou come to Gazer'",
           "site-jerusalem", -1003, -995, "c. 1003-995 BC",
           "Twice the Philistines pushed up the Rephaim valley to strangle the new capital, and twice were thrown back — the second time by David's rear encirclement at the balsam trees, waiting for 'the sound of a going in the tops of the mulberry trees'. The victories ended Philistine power in the hill country.",
           ["2 Samuel 5:17-25"],
           location_note="The Valley of Rephaim runs southwest from Jerusalem toward Bethlehem; Baal-perazim itself is unidentified.",
           cites=["cit-thiele-chronology"]),
    battle("battle-rabbah", "The siege of Rabbah of the Ammonites", "siege",
           "Israel under Joab (and David) vs. Ammon and its Aramean mercenaries",
           "The Ammonite-Aramean coalition was beaten in the field, Rabbah invested, the 'city of waters' taken by Joab, and the citadel stormed under David — but the siege is remembered for Uriah",
           "site-rabbah-ammon", -995, -985, "c. 995-985 BC",
           "The war that frames the Bathsheba narrative: 'at the time when kings go forth to battle... David tarried still at Jerusalem'. Uriah the Hittite was set 'in the forefront of the hottest battle' at the wall of Rabbah and abandoned; the city fell in the following season, and Nathan's parable had already fallen on the king.",
           ["2 Samuel 10:6-14", "2 Samuel 11:1", "2 Samuel 11:14-17", "2 Samuel 12:26-31"],
           cites=["cit-wikipedia-amman-citadel"]),
    battle("battle-forest-of-ephraim", "The forest of Ephraim — Absalom's revolt broken", "civil-war",
           "David's field army under Joab, Abishai, and Ittai vs. all Israel under Absalom",
           "Twenty thousand fell in the broken woodland where 'the wood devoured more people that day than the sword'; Absalom, caught by his head in the oak, was killed by Joab against orders",
           "site-mahanaim", -980, -972, "c. 980-972 BC",
           "The dynasty's civil war: David, driven across the Jordan to Mahanaim, sent his companies out with the charge every soldier heard — 'Deal gently for my sake with the young man, even with Absalom.' The victory dissolved in the king's grief: 'O my son Absalom... would God I had died for thee.'",
           ["2 Samuel 17:24-26", "2 Samuel 18:1-17", "2 Samuel 18:33"],
           location_note="The 'wood of Ephraim' lay in Gilead near Mahanaim, east of the Jordan; the forest itself is unidentified.",
           cites=["cit-wikipedia-mahanaim"]),
    # ---- The divided kingdom: Israel vs. Judah ----
    battle("battle-mount-zemaraim", "The battle of Mount Zemaraim — Judah against Jeroboam", "civil-war",
           "Judah under Abijah (400,000) vs. Israel under Jeroboam I (800,000)",
           "Jeroboam's double envelopment failed; the Chronicler counts 500,000 of Israel fallen, and Judah took Bethel, Jeshanah, and Ephron with their villages",
           "site-mount-zemaraim", -915, -910, "c. 913 BC",
           "The bloodiest recorded clash of the brother kingdoms, a generation after the schism. Abijah's speech from the mountain claimed the Davidic covenant and the Aaronic priesthood against the golden calves; ambushed front and rear, Judah 'cried unto the LORD' and broke both wings. The numbers are the Chronicler's characteristic large figures; the campaign's Bethel gains were real but brief.",
           ["2 Chronicles 13:3-20", "1 Kings 15:6-7"],
           conf="medium",
           cites=["cit-wikipedia-mount-zemaraim", "cit-thiele-chronology"]),
    battle("battle-ramah-asa-baasha", "The Ramah border war — Asa against Baasha", "civil-war",
           "Judah under Asa vs. Israel under Baasha (with Ben-hadad I of Damascus bought in against Israel)",
           "Baasha fortified Ramah to seal Judah's border; Asa stripped temple and palace treasuries to turn Ben-hadad against the north, and when Baasha withdrew, Judah carried off Ramah's stones and timber to fortify Geba and Mizpah",
           "site-ramah", -900, -885, "c. 895-885 BC",
           "'And there was war between Asa and Baasha king of Israel all their days.' The war of the fortified border: Ramah sat astride the north road five miles from Jerusalem, close enough to choke the capital. Asa's Aramean bribe worked — Ben-hadad ravaged Ijon, Dan, and the Naphtali storelands — but the seer Hanani condemned the reliance on Damascus, and the precedent haunted both kingdoms.",
           ["1 Kings 15:16-22", "2 Chronicles 16:1-10"],
           cites=["cit-wikipedia-ramah-benjamin", "cit-thiele-chronology"]),
    battle("battle-beth-shemesh", "The battle of Beth-shemesh — Israel humbles Judah", "civil-war",
           "Israel under Jehoash vs. Judah under Amaziah",
           "Judah was routed 'every man to their tents'; Amaziah was captured, four hundred cubits of Jerusalem's wall broken down from the Ephraim gate to the corner gate, and the temple and palace treasuries emptied to Samaria with hostages",
           "site-beth-shemesh", -792, -786, "c. 790 BC",
           "Flushed with victory over Edom, Amaziah challenged the north: 'Come, let us look one another in the face.' Jehoash's thistle-and-cedar parable warned him off — 'glory of this, and tarry at home' — and the field at Beth-shemesh proved the parable. The one recorded sack of Jerusalem by the sister kingdom.",
           ["2 Kings 14:8-14", "2 Chronicles 25:17-24"],
           cites=["cit-wikipedia-beth-shemesh", "cit-thiele-chronology"]),
    battle("battle-syro-ephraimite-war", "The Syro-Ephraimite war — Israel and Aram against Judah", "civil-war",
           "Israel under Pekah with Aram under Rezin vs. Judah under Ahaz",
           "Jerusalem withstood the siege but Judah was mauled (the Chronicler counts 120,000 fallen and mass captives, returned at the prophet Oded's word); Ahaz bought Assyria's intervention — Damascus fell and Rezin died, and Judah became Tiglath-pileser's tributary",
           "site-jerusalem", -735, -732, "735-732 BC",
           "The coalition sought to depose the Davidic king and install 'the son of Tabeal'. Into the panic — 'his heart was moved... as the trees of the wood are moved with the wind' — Isaiah brought the sign of Immanuel (Isaiah 7:14). Ahaz appealed instead to Assyria, mortgaging the kingdom's independence: the pivotal wrong turn of Judah's foreign policy, in the prophets' verdict.",
           ["2 Kings 16:5-9", "Isaiah 7:1-16", "2 Chronicles 28:5-15"],
           conf="high",
           cites=["cit-wikipedia-syro-ephraimite-war", "cit-thiele-chronology"]),
    # ---- The northern kingdom's foreign wars ----
    battle("battle-samaria-ben-hadad", "Ben-hadad's siege of Samaria repelled", "siege",
           "Aram-Damascus under Ben-hadad with thirty-two kings vs. Israel under Ahab",
           "The drunken siege camp was surprised at noon by the 232 young men of the provincial governors; Aram broke, 'and Israel slew the Syrians with a great slaughter'",
           "site-samaria-city", -860, -855, "c. 860-855 BC",
           "Ben-hadad's demand escalated from tribute to open plunder, and the elders counselled defiance. At a prophet's word Ahab led the sortie himself while the Aramean king drank in the pavilions — the first round of the Aphek campaign the following spring.",
           ["1 Kings 20:1-21"],
           cites=["cit-wikipedia-samaria-city"]),
    battle("battle-aphek-ben-hadad", "The battle of Aphek — 'God of the hills' refuted", "battle",
           "Aram-Damascus under Ben-hadad ('their gods are gods of the hills') vs. Israel under Ahab",
           "Aram fell 'an hundred thousand footmen in one day'; the wall of Aphek fell on the remnant, Ben-hadad surrendered, and Ahab's lenient treaty was prophetically condemned",
           "site-aphek-golan", -857, -854, "c. 856 BC",
           "Aram re-mustered in the plain east of the lake, reasoning Israel's God could not fight on level ground. The seven-day face-off ended in a rout that the narrative expressly frames as the refutation: 'thus shall ye know that I am the LORD.' Ahab spared Ben-hadad for trade concessions in Damascus — and was told he had traded his life for it.",
           ["1 Kings 20:22-34", "1 Kings 20:35-43"],
           location_note="The eastern Aphek is not securely identified; anchored near 'Afiq in the Golan above En Gev.",
           conf="medium",
           cites=["cit-wikipedia-samaria-city"]),
    battle("battle-qarqar", "The battle of Qarqar (extra-biblical anchor)", "battle",
           "Assyria under Shalmaneser III vs. a twelve-king coalition — Hadadezer of Damascus, Irhuleni of Hamath, and 'Ahab the Israelite' with 2,000 chariots and 10,000 soldiers",
           "Shalmaneser claimed a crushing victory, but the Assyrian advance stalled for years — the coalition held; Assyria returned repeatedly in the following decade",
           "site-qarqar", -854, -853, "853 BC",
           "Unmentioned in Scripture, indispensable to its chronology: the Kurkh Monolith's report of Qarqar is the earliest securely dated appearance of any Israelite king in the extra-biblical record, and — with the Black Obelisk's Jehu — the synchronism from which the entire divided-kingdom timeline is calculated. Ahab's chariot corps as listed was among the coalition's largest, matching the stables archaeology at Megiddo long attributed to the Omrides.",
           [],
           artifacts=["artifact-kurkh-monolith"],
           conf="high",
           cites=["cit-wikipedia-battle-of-qarqar", "cit-wikipedia-kurkh-monoliths"]),
    battle("battle-ramoth-gilead-ahab", "Ramoth-gilead — the death of Ahab", "battle",
           "Israel under Ahab with Judah under Jehoshaphat vs. Aram-Damascus under Ben-hadad",
           "Israel failed to retake the city; Ahab, disguised in the ranks while Jehoshaphat wore the robes, was mortally wounded 'between the joints of the harness' by a bow drawn at a venture, and died at even, propped in his chariot",
           "site-ramoth-gilead", -853, -852, "c. 853-852 BC",
           "The campaign opened with four hundred court prophets promising victory and one — Micaiah ben Imlah — foretelling Israel scattered 'as sheep that have not a shepherd'. Ahab's theatrical precaution against the prophecy is the narrative's irony: the random arrow found him anyway. The dogs licked up the blood at the pool of Samaria, as Elijah had said over Naboth's vineyard.",
           ["1 Kings 22:1-38", "2 Chronicles 18:28-34"],
           conf="medium",
           cites=["cit-wikipedia-ramoth-gilead"]),
    battle("battle-moab-rebellion", "The Moabite war — Mesha's rebellion", "campaign",
           "Israel under Jehoram, Judah under Jehoshaphat, and Edom vs. Moab under Mesha",
           "The allies, saved from thirst by Elisha's word, ravaged Moab to Kir-hareseth; the siege broke off in horror when Mesha offered his firstborn on the wall — and Moab remained independent, as Mesha's own stele boasts",
           "site-kir-hareseth", -850, -840, "c. 850-840 BC",
           "The one war narrated from both sides: 2 Kings 3 from Israel's camp, and the Mesha Stele from Moab's — Mesha 'king of Moab, the Dibonite' recording that 'Omri had oppressed Moab many days' and that he threw off 'the house of Omri', took Nebo and Ataroth, and built cisterns with Israelite captives. The two accounts disagree in outcome-framing and agree in substance: the rebellion succeeded.",
           ["2 Kings 1:1", "2 Kings 3:4-27"],
           artifacts=["artifact-mesha-stele"],
           conf="high",
           cites=["cit-wikipedia-mesha-stele", "cit-wikipedia-kir-of-moab"]),
    battle("battle-jehu-coup", "Jehu's coup at Jezreel", "coup",
           "Jehu, anointed at Ramoth-gilead, vs. the house of Ahab (Joram of Israel and his ally Ahaziah of Judah)",
           "Joram was shot through the heart in Naboth's field; Ahaziah of Judah died of his wounds at Megiddo; Jezebel was thrown from the window; Ahab's seventy sons followed — the Omride dynasty was annihilated, and Jehu paid tribute to Assyria within the year",
           "site-jezreel", -842, -841, "841 BC",
           "Anointed in secret in the siege camp, Jehu drove 'furiously' to Jezreel before word could travel. The purge fulfilled Elijah's oracle over Naboth's vineyard to the letter — and the Tel Dan Stele complicates it fascinatingly: an Aramean king (almost certainly Hazael) claims *he* killed both kings, naming the 'king of Israel' and the king of the 'house of David'. On the Black Obelisk, within months, Jehu bows to Shalmaneser III — the only Israelite king ever depicted.",
           ["2 Kings 9:1-13", "2 Kings 9:14-37", "2 Kings 10:1-11"],
           artifacts=["artifact-tel-dan-stele", "artifact-black-obelisk"],
           conf="high",
           disputes="The Tel Dan Stele's author (Hazael) claims to have killed Joram and Ahaziah, where 2 Kings credits Jehu; harmonizations (Jehu acting as Hazael's de facto instrument, or royal boast-convention) are debated. The coup's date, 841 BC, is fixed by the Black Obelisk synchronism.",
           cites=["cit-wikipedia-jehu", "cit-wikipedia-tel-jezreel"]),
    # ---- Assyria and Babylon ----
    battle("battle-galilee-tiglath-pileser", "Tiglath-pileser III takes Galilee and Gilead", "conquest",
           "Assyria under Tiglath-pileser III vs. Israel under Pekah",
           "Ijon, Abel-beth-maachah, Janoah, Kedesh, Hazor, Gilead, and Galilee — 'all the land of Naphtali' — were taken and their people deported to Assyria: the first stage of Israel's end",
           "site-hazor", -734, -732, "733-732 BC",
           "The price of the Syro-Ephraimite adventure: called in by Ahaz, Assyria detached Israel's whole north into provinces. Hazor's stratum V shows the destruction; the deportations begin the Israelite diaspora. Isaiah's oracle turns the darkness inside out: 'the land of Zebulun and the land of Naphtali... the people that walked in darkness have seen a great light' (Isaiah 9:1-2) — the very region of Jesus' Galilean ministry.",
           ["2 Kings 15:29", "1 Chronicles 5:26", "Isaiah 9:1-2"],
           area=[[35.10, 32.85], [35.70, 32.70], [36.00, 32.90], [35.90, 33.30], [35.55, 33.30], [35.15, 33.05], [35.10, 32.85]],
           location_note="Area highlight approximates the annexed Galilee-Naphtali region; Gilead across the Jordan was taken in the same campaigns.",
           conf="high",
           cites=["cit-wikipedia-syro-ephraimite-war", "cit-wikipedia-tel-hazor"]),
    battle("battle-fall-of-samaria", "The fall of Samaria — the end of the kingdom of Israel", "siege",
           "Assyria under Shalmaneser V (completed/claimed by Sargon II) vs. Israel under Hoshea",
           "After a three-year siege Samaria fell (722/721 BC); 27,290 captives by Sargon's count were deported to Halah, Habor, and the cities of the Medes, and foreign settlers were planted in the land — the ten tribes' exile",
           "site-samaria-city", -725, -721, "725-722/721 BC",
           "Hoshea's withheld tribute and Egyptian intrigue brought the final siege. 2 Kings 17 reads the catastrophe theologically — covenant broken, prophets ignored — while Sargon II's annals count the deportees and the fifty chariots impressed into the Assyrian army. The resettled mixed population becomes the Samaritans of the later narrative.",
           ["2 Kings 17:1-6", "2 Kings 17:22-24", "2 Kings 18:9-12"],
           area=[[34.95, 32.05], [35.40, 31.95], [35.55, 32.20], [35.55, 32.60], [35.20, 32.75], [34.95, 32.55], [34.95, 32.05]],
           location_note="Area highlight approximates the northern kingdom's Samarian heartland annexed as the Assyrian province of Samerina.",
           artifacts=["artifact-samaria-ostraca"],
           conf="high",
           cites=["cit-wikipedia-sargon-ii", "cit-wikipedia-samaria-city"]),
    battle("battle-lachish-701", "Sennacherib storms Lachish", "siege",
           "Assyria under Sennacherib vs. the fortified cities of Judah under Hezekiah",
           "Lachish fell by ramp and battering ram; 'all the fenced cities of Judah' — forty-six by Sennacherib's count — were taken, and 200,150 people by his figure deported, while Hezekiah was shut up in Jerusalem",
           "site-lachish", -702, -701, "701 BC",
           "The best-documented battle of the biblical world: 2 Kings 18:13-14 names the siege in one verse; Sennacherib carved it across a whole palace room at Nineveh (the Lachish Reliefs); and the tell preserves the only fully excavated Assyrian siege ramp, with sling stones, arrowheads, the counter-ramp, and a mass burial. Text, image, and ground agree to an extraordinary degree.",
           ["2 Kings 18:13-17", "2 Chronicles 32:9", "Micah 1:13"],
           area=[[34.75, 31.40], [35.10, 31.35], [35.25, 31.55], [35.20, 31.80], [34.95, 31.85], [34.75, 31.65], [34.75, 31.40]],
           location_note="Area highlight approximates the Shephelah swath of Sennacherib's 701 BC campaign against Judah's fortified cities.",
           artifacts=["artifact-lachish-reliefs", "artifact-sennacherib-prism"],
           conf="high",
           cites=["cit-wikipedia-siege-of-lachish", "cit-wikipedia-sennacherib-campaign"]),
    battle("battle-jerusalem-701", "Sennacherib before Jerusalem — the city spared", "deliverance",
           "Assyria under Sennacherib (the Rabshakeh's embassy and army) vs. Jerusalem under Hezekiah and Isaiah",
           "The siege never closed: the biblical account reports the angel of the LORD striking the camp and Sennacherib withdrawing to Nineveh (where he was later murdered by his sons); Sennacherib's own prism boasts of shutting Hezekiah up 'like a caged bird' — and conspicuously claims no capture",
           "site-jerusalem", -702, -701, "701 BC",
           "The Rabshakeh's speech at the conduit of the upper pool — in Hebrew, to the men on the wall — is one of the Bible's great set-pieces of psychological warfare. Hezekiah had prepared: the Siloam tunnel brought the Gihon's water inside the walls (its workmen's inscription survives), and the Broad Wall sheltered the swollen city. The deliverance of 701 became the touchstone of Zion theology — and Sennacherib's silence about Jerusalem's fate in his own annals is its most argued corroboration.",
           ["2 Kings 18:17-37", "2 Kings 19:32-37", "Isaiah 37:33-38", "2 Chronicles 32:1-23"],
           artifacts=["artifact-sennacherib-prism", "artifact-hezekiah-siloam-tunnel", "artifact-hezekiah-bulla"],
           conf="high",
           disputes="The mechanism and scale of the Assyrian withdrawal are debated (plague, Egyptian pressure, tribute-satisfied withdrawal, or a two-campaign reconstruction); that Sennacherib devastated Judah, that Jerusalem did not fall, and that Hezekiah paid heavy tribute are common ground between the sources.",
           cites=["cit-wikipedia-sennacherib-campaign"]),
    battle("battle-megiddo-609", "The battle of Megiddo — the death of Josiah", "battle",
           "Egypt under Pharaoh Necho II (marching to the Euphrates) vs. Judah under Josiah",
           "Josiah, intercepting the Egyptian march despite Necho's warning, was mortally wounded by archers at Megiddo and died at (or en route to) Jerusalem; Judah became Egypt's vassal, and the reforming king's death shook the kingdom's theology",
           "site-megiddo", -610, -609, "609 BC",
           "Necho was hurrying north to prop up the last Assyrian remnant at Harran against Babylon; Josiah — the Deuteronomic reformer — blocked the Aruna pass and died for it. 'And all Judah and Jerusalem mourned for Josiah'; Jeremiah lamented him, and Zechariah 12:11 still remembers 'the mourning of Hadadrimmon in the valley of Megiddon'. Within four years the world he tried to hold back arrived at Carchemish.",
           ["2 Kings 23:29-30", "2 Chronicles 35:20-27"],
           conf="high",
           cites=["cit-wikipedia-megiddo-609", "cit-wikipedia-tel-megiddo"]),
    battle("battle-carchemish", "The battle of Carchemish", "battle",
           "Babylon under crown prince Nebuchadnezzar vs. Egypt under Necho II with the Assyrian remnant",
           "The Egyptian army was shattered and pursued to Hamath 'so that not a man escaped to his own country' (Babylonian Chronicle); Assyria ended, and 'the king of Egypt came not again any more out of his land' (2 Kings 24:7)",
           "site-carchemish", -606, -605, "605 BC",
           "The hinge of the age, dated precisely by the Babylonian Chronicle to 605 BC: Jeremiah 46 turns the battle into an oracle — 'the mighty man hath stumbled... by the river Euphrates'. Within months Nebuchadnezzar took Syria-Palestine's submission and Daniel's generation went to Babylon in the first deportation (Daniel 1:1-4).",
           ["Jeremiah 46:1-12", "2 Kings 24:7", "Daniel 1:1-4"],
           artifacts=["artifact-babylonian-chronicle"],
           conf="high",
           cites=["cit-wikipedia-battle-of-carchemish", "cit-wikipedia-carchemish"]),
    battle("battle-jerusalem-597", "Nebuchadnezzar takes Jerusalem — the first deportation of the house of David", "siege",
           "Babylon under Nebuchadnezzar II vs. Judah under Jehoiachin",
           "Jerusalem surrendered on 2 Adar (15/16 March) 597 BC — a date fixed to the day by the Babylonian Chronicle; Jehoiachin, the queen mother, the elite, the craftsmen, and the temple treasures went to Babylon, and Zedekiah was installed as vassal",
           "site-jerusalem", -598, -597, "597 BC (2 Adar: 15/16 March)",
           "The rare event dated to a calendar day by an independent source: the Chronicle records that Nebuchadnezzar 'encamped against the city of Judah and on the second day of Adar took the city and captured its king'. Among the ten thousand deported was the young priest Ezekiel, whose visions by the Chebar canal are dated from 'king Jehoiachin's captivity' — and the Babylonian ration tablets later list the exiled king's oil allowance by name.",
           ["2 Kings 24:10-17", "2 Chronicles 36:9-10", "Ezekiel 1:1-3"],
           artifacts=["artifact-babylonian-chronicle", "artifact-jehoiachin-tablets"],
           conf="high", approx=False,
           cites=["cit-wikipedia-siege-jerusalem-597"]),
    battle("battle-fall-of-jerusalem-586", "The fall of Jerusalem and the end of the kingdom of Judah", "siege",
           "Babylon under Nebuchadnezzar II vs. Judah under Zedekiah",
           "After an eighteen-month siege (with one pause for Egypt's relief attempt) the wall was breached, Zedekiah was caught near Jericho, his sons killed before his blinding, and in the fifth month the temple, palace, and city were burned; Judah went into exile",
           "site-jerusalem", -589, -586, "588-586 BC",
           "The catastrophe toward which Kings and Jeremiah drive: famine 'sore in the city', the night flight through the gate between the two walls, Riblah's judgment, and the burning of the house of the LORD on the seventh/tenth of the fifth month — mourned ever after on Tisha B'Av, and lamented verse by verse in Lamentations. Archaeology preserves the moment across the City of David: burnt rooms, Scythian-type arrowheads, and the bullae of officials named in Jeremiah; at Lachish, the last ostraca watch Azekah's signal fire go out (Jeremiah 34:7).",
           ["2 Kings 25:1-21", "Jeremiah 39:1-10", "Jeremiah 52:4-27", "Lamentations 2:1-9"],
           area=[[34.90, 31.90], [35.55, 31.80], [35.55, 31.15], [35.35, 30.95], [34.90, 30.90], [34.75, 31.25], [34.85, 31.65], [34.90, 31.90]],
           location_note="Area highlight approximates the kingdom of Judah extinguished in the 588-586 BC campaign.",
           artifacts=["artifact-lachish-letters", "artifact-babylonian-chronicle"],
           conf="high",
           cites=["cit-wikipedia-siege-jerusalem-587"]),
]


def main():
    write("battles.json", BATTLES)

    cites = [{"id": i, "source": en(s), "url": u, "kind": k} for (i, s, u, k) in CITES]
    write("citations.extra.json", upsert(load("citations.extra.json"), cites))
    write("sites.extra.json", upsert(load("sites.extra.json"), SITES))
    write("artifacts.extra.json", upsert(load("artifacts.extra.json"), ARTIFACTS))

    kinds = {}
    for b in BATTLES:
        kinds[b["kind"]] = kinds.get(b["kind"], 0) + 1
    print(f"battles.json: {len(BATTLES)} entries — {kinds}")
    print(f"upserted {len(SITES)} sites, {len(ARTIFACTS)} artifacts, {len(cites)} citations")
    areas = sum(1 for b in BATTLES if "area" in b)
    print(f"{areas} battles carry area-highlight polygons")


if __name__ == "__main__":
    main()
