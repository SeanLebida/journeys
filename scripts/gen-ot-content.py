#!/usr/bin/env python3
"""Author the Old-Testament foundation (patriarchs + Exodus) into the
content/*.extra.json files. Idempotent: entries are keyed by id and replaced
in place, so re-running updates rather than duplicates.

Confidence discipline (matches the app's cited-neutral ethos):
  - Real, archaeologically-identified PLACES get solid coordinate confidence.
  - Patriarchal EVENTS are 'legendary' (traditional narrative, no hard
    external evidence), each cited.
  - Exodus route/date are 'disputed' (active scholarly debate), each carrying a
    disputes note AND citations.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "content")


def loadx(name):
    p = os.path.join(C, name)
    return json.load(open(p)) if os.path.exists(p) else []


def upsert(arr, items):
    by_id = {x["id"]: x for x in arr}
    for it in items:
        by_id[it["id"]] = it
    # preserve original order, append new
    seen = set()
    out = []
    for x in arr:
        if x["id"] not in seen:
            out.append(by_id[x["id"]]); seen.add(x["id"])
    for it in items:
        if it["id"] not in seen:
            out.append(it); seen.add(it["id"])
    return out


def en(s):
    return {"en": s}


def dr(a, b, disp, approx=True):
    return {"startYear": a, "endYear": b, "display": en(disp), "approximate": approx}


# ── Citations ───────────────────────────────────────────────────────────────
CITES = [
    ("cit-ot-abraham", "Britannica, 'Abraham'", "https://www.britannica.com/biography/Abraham", "secondary-scholarly"),
    ("cit-ot-patriarchal-dating", "Wikipedia, 'Historicity of the Bible' (patriarchal age & dating debate)", "https://en.wikipedia.org/wiki/Historicity_of_the_Bible", "secondary-scholarly"),
    ("cit-ot-ur", "Wikipedia, 'Ur' (Tell el-Muqayyar)", "https://en.wikipedia.org/wiki/Ur", "gazetteer"),
    ("cit-ot-ur-debate", "Wikipedia, 'Ur Kaśdim' (location debate)", "https://en.wikipedia.org/wiki/Ur_Kasdim", "secondary-scholarly"),
    ("cit-ot-haran", "Wikipedia, 'Harran'", "https://en.wikipedia.org/wiki/Harran", "gazetteer"),
    ("cit-ot-shechem", "Wikipedia, 'Shechem' (Tell Balata)", "https://en.wikipedia.org/wiki/Shechem", "archaeological"),
    ("cit-ot-bethel", "Wikipedia, 'Bethel'", "https://en.wikipedia.org/wiki/Bethel", "gazetteer"),
    ("cit-ot-machpelah", "Wikipedia, 'Cave of the Patriarchs' (Hebron)", "https://en.wikipedia.org/wiki/Cave_of_the_Patriarchs", "archaeological"),
    ("cit-ot-beersheba", "Wikipedia, 'Tel Be'er Sheva'", "https://en.wikipedia.org/wiki/Tel_Be%27er_Sheva", "archaeological"),
    ("cit-ot-isaac", "Britannica, 'Isaac'", "https://www.britannica.com/topic/Isaac", "secondary-scholarly"),
    ("cit-ot-jacob", "Britannica, 'Jacob'", "https://www.britannica.com/topic/Jacob-Hebrew-patriarch", "secondary-scholarly"),
    ("cit-ot-joseph", "Britannica, 'Joseph' (patriarch)", "https://www.britannica.com/biography/Joseph-Hebrew-patriarch", "secondary-scholarly"),
    ("cit-ot-sarah", "Wikipedia, 'Sarah'", "https://en.wikipedia.org/wiki/Sarah", "secondary-scholarly"),
    ("cit-ot-moses", "Britannica, 'Moses' (Hebrew prophet)", "https://www.britannica.com/biography/Moses-Hebrew-prophet", "secondary-scholarly"),
    ("cit-ot-joshua", "Britannica, 'Joshua' (Hebrew Bible figure)", "https://www.britannica.com/biography/Joshua-Hebrew-Bible-figure", "secondary-scholarly"),
    ("cit-ot-exodus", "Wikipedia, 'The Exodus' (scholarship, date & route)", "https://en.wikipedia.org/wiki/The_Exodus", "secondary-scholarly"),
    ("cit-ot-pi-ramesses", "Wikipedia, 'Pi-Ramesses' (Qantir)", "https://en.wikipedia.org/wiki/Pi-Ramesses", "archaeological"),
    ("cit-ot-goshen", "Wikipedia, 'Land of Goshen'", "https://en.wikipedia.org/wiki/Land_of_Goshen", "gazetteer"),
    ("cit-ot-mount-sinai", "Wikipedia, 'Mount Sinai' (candidate identifications)", "https://en.wikipedia.org/wiki/Mount_Sinai", "secondary-scholarly"),
    ("cit-ot-kadesh-barnea", "Wikipedia, 'Kadesh (biblical)' (Tell el-Qudeirat)", "https://en.wikipedia.org/wiki/Kadesh_(biblical)", "gazetteer"),
    ("cit-ot-mount-nebo", "Wikipedia, 'Mount Nebo'", "https://en.wikipedia.org/wiki/Mount_Nebo", "gazetteer"),
    ("cit-ot-jericho", "Wikipedia, 'Tell es-Sultan' (ancient Jericho)", "https://en.wikipedia.org/wiki/Tell_es-Sultan", "archaeological"),
    ("cit-ot-exodus-route", "Wikipedia, 'Stations of the Exodus' (route reconstructions)", "https://en.wikipedia.org/wiki/Stations_of_the_Exodus", "secondary-scholarly"),
]
citations = [{"id": i, "source": en(s), "url": u, "kind": k} for i, s, u, k in CITES]


# ── Persons ─────────────────────────────────────────────────────────────────
persons = [
    {"id": "person-abraham", "name": en("Abraham (Abram)"),
     "role": en("Patriarch; father of Israel and, in tradition, of many nations"),
     "summary": en("The first Hebrew patriarch. Called by God to leave Ur (or Haran) for Canaan under a covenant promise of land and descendants (Genesis 12). Scholars date the patriarchal setting loosely to the Middle Bronze Age (c. 2000-1800 BC) while debating the narratives' historicity and date of composition."),
     "scriptureRefs": ["Genesis 12:1", "Genesis 15:6", "Genesis 17:5"],
     "citations": ["cit-ot-abraham", "cit-ot-patriarchal-dating"]},
    {"id": "person-sarah", "name": en("Sarah (Sarai)"),
     "role": en("Matriarch; wife of Abraham, mother of Isaac"),
     "summary": en("Wife of Abraham and mother of Isaac, buried in the cave of Machpelah at Hebron (Genesis 23)."),
     "scriptureRefs": ["Genesis 17:15", "Genesis 23:2"],
     "citations": ["cit-ot-sarah"]},
    {"id": "person-isaac", "name": en("Isaac"),
     "role": en("Patriarch; son of Abraham, father of Jacob and Esau"),
     "summary": en("The promised son of Abraham and Sarah, through whom the covenant line continued; father of Jacob and Esau."),
     "scriptureRefs": ["Genesis 21:3", "Genesis 26:3"],
     "citations": ["cit-ot-isaac"]},
    {"id": "person-jacob", "name": en("Jacob (Israel)"),
     "role": en("Patriarch; father of the twelve tribes"),
     "summary": en("Son of Isaac, renamed 'Israel' after wrestling at the Jabbok (Genesis 32). His twelve sons are the eponymous ancestors of the tribes of Israel; famine drove his family to Egypt."),
     "scriptureRefs": ["Genesis 28:12", "Genesis 32:28"],
     "citations": ["cit-ot-jacob"]},
    {"id": "person-joseph", "name": en("Joseph"),
     "role": en("Patriarch; vizier of Egypt"),
     "summary": en("Son of Jacob, sold into Egypt and rising to high office, according to Genesis; the narrative frames Israel's settlement in Goshen and sets up the later bondage and Exodus."),
     "scriptureRefs": ["Genesis 37:28", "Genesis 41:41", "Genesis 50:20"],
     "citations": ["cit-ot-joseph"]},
    {"id": "person-moses", "name": en("Moses"),
     "role": en("Prophet and lawgiver; leader of the Exodus"),
     "summary": en("Leader who, in the biblical account, brought Israel out of Egyptian bondage, mediated the covenant and Law at Sinai, and led the people through the wilderness to the edge of Canaan, dying on Mount Nebo. The Exodus's date and historicity are debated."),
     "scriptureRefs": ["Exodus 3:10", "Exodus 20:1", "Deuteronomy 34:5"],
     "citations": ["cit-ot-moses", "cit-ot-exodus"]},
    {"id": "person-joshua", "name": en("Joshua"),
     "role": en("Successor of Moses; led Israel into Canaan"),
     "summary": en("Moses' successor who, in the book bearing his name, led Israel across the Jordan near Jericho into Canaan."),
     "scriptureRefs": ["Numbers 27:18", "Joshua 1:2", "Joshua 3:17"],
     "citations": ["cit-ot-joshua"]},
]


# ── Sites ───────────────────────────────────────────────────────────────────
def coords(lat, lon, conf, cites, disputes=None):
    c = {"value": {"lat": lat, "lon": lon}, "confidence": conf, "reviewStatus": "self-reviewed", "citations": cites}
    if disputes:
        c["disputes"] = en(disputes)
    return c


sites = [
    {"id": "site-ur", "ancientName": en("Ur of the Chaldees (Ur Kaśdim)"),
     "modernName": en("Tell el-Muqayyar"),
     "modernLocation": en("Tell el-Muqayyar, Dhi Qar Governorate, southern Iraq"),
     "coordinates": coords(30.9626, 46.1032, "medium", ["cit-ot-ur", "cit-ot-ur-debate"]),
     "summary": en("A major Sumerian city (excavated by Woolley, with its great ziggurat of Ur-Nammu) named as Abraham's birthplace in Genesis 11:31. A minority of scholars instead locate the biblical 'Ur of the Chaldeans' in the north near Haran; the southern Tell el-Muqayyar remains the traditional identification."),
     "citations": ["cit-ot-ur", "cit-ot-ur-debate"]},
    {"id": "site-haran", "ancientName": en("Haran (Harran)"),
     "modernName": en("Harran"),
     "modernLocation": en("Harran, Şanlıurfa Province, southeastern Turkey"),
     "coordinates": coords(36.8642, 39.0308, "high", ["cit-ot-haran"]),
     "summary": en("An ancient caravan city on the Balikh where, in Genesis, Terah's family settled and Abraham was later called on toward Canaan (Genesis 12:4). Long a cult center of the moon-god Sin."),
     "citations": ["cit-ot-haran"]},
    {"id": "site-shechem-ot", "ancientName": en("Shechem"),
     "modernName": en("Tell Balata (Nablus)"),
     "modernLocation": en("Tell Balata, at the eastern edge of modern Nablus, West Bank"),
     "coordinates": coords(32.2136, 35.2814, "high", ["cit-ot-shechem"]),
     "summary": en("Abraham's first altar site in Canaan (Genesis 12:6-7) and a recurring covenant place through Jacob and Joshua. The excavated Middle-Bronze city at Tell Balata includes a massive fortress-temple."),
     "citations": ["cit-ot-shechem"]},
    {"id": "site-bethel", "ancientName": en("Bethel ('house of God'; Luz)"),
     "modernName": en("Beitin (traditional)"),
     "modernLocation": en("Beitin, West Bank, ~17 km north of Jerusalem (traditional identification)"),
     "coordinates": coords(31.9308, 35.2233, "medium", ["cit-ot-bethel"]),
     "summary": en("Where Abraham built an altar and Jacob dreamed of the ladder to heaven and named the place 'house of God' (Genesis 28). The identification with Beitin is traditional and debated (some prefer el-Bireh)."),
     "citations": ["cit-ot-bethel"]},
    {"id": "site-hebron-machpelah", "ancientName": en("Hebron; the Cave of Machpelah"),
     "modernName": en("Cave of the Patriarchs (al-Ḥaram al-Ibrahimi)"),
     "modernLocation": en("Old city of Hebron, West Bank"),
     "coordinates": coords(31.5247, 35.1108, "high", ["cit-ot-machpelah"]),
     "summary": en("Abraham bought the cave of Machpelah as a burial place for Sarah (Genesis 23); tradition holds Abraham, Isaac, Jacob and their wives are entombed there, beneath the Herodian-era enclosure still standing today."),
     "citations": ["cit-ot-machpelah"]},
    {"id": "site-beersheba-ot", "ancientName": en("Beersheba ('well of the oath')"),
     "modernName": en("Tel Be'er Sheva"),
     "modernLocation": en("Tel Be'er Sheva, Negev, southern Israel (UNESCO World Heritage 'Biblical Tel')"),
     "coordinates": coords(31.2456, 34.8400, "high", ["cit-ot-beersheba"]),
     "summary": en("The southern frontier of the patriarchs, associated with Abraham's and Isaac's wells and covenants (Genesis 21, 26); 'from Dan to Beersheba' marked Israel's extent. The Iron-Age town at Tel Be'er Sheva has a famous horned altar."),
     "citations": ["cit-ot-beersheba"]},
    {"id": "site-goshen-rameses", "ancientName": en("Goshen; Pi-Rameses (Raamses)"),
     "modernName": en("Qantir / Tell el-Dab'a (Avaris)"),
     "modernLocation": en("Qantir, eastern Nile Delta, Egypt"),
     "coordinates": coords(30.8000, 31.8333, "medium", ["cit-ot-pi-ramesses", "cit-ot-goshen"]),
     "summary": en("The eastern-Delta region where Genesis settles Jacob's family and where Exodus 1:11 has the Israelites building the store-city of Raamses. The Ramesside capital Pi-Rameses is firmly located at Qantir, above the earlier Hyksos capital Avaris."),
     "citations": ["cit-ot-pi-ramesses", "cit-ot-goshen"]},
    {"id": "site-mount-sinai", "ancientName": en("Mount Sinai (Horeb)"),
     "modernName": en("Jebel Musa (traditional)"),
     "modernLocation": en("Jebel Musa, southern Sinai Peninsula, Egypt (traditional; other candidates proposed)"),
     "coordinates": coords(28.5395, 33.9749, "disputed", ["cit-ot-mount-sinai"],
                           disputes="The mountain of the Law has no secure identification. The Byzantine tradition (St Catherine's Monastery) fixes it at Jebel Musa in the southern Sinai, but scholars have proposed Jebel Serbal, Har Karkom in the Negev, and sites in NW Arabia (e.g. Jebel al-Lawz); none is archaeologically confirmed."),
     "summary": en("The mountain where, in Exodus, Moses received the Law and Israel entered the covenant. Its location is genuinely uncertain; the traditional Jebel Musa is used here with alternatives noted."),
     "citations": ["cit-ot-mount-sinai"]},
    {"id": "site-kadesh-barnea", "ancientName": en("Kadesh-barnea"),
     "modernName": en("Tell el-Qudeirat (Ein el-Qudeirat)"),
     "modernLocation": en("Tell el-Qudeirat, northeastern Sinai, near the Israel-Egypt border"),
     "coordinates": coords(30.6889, 34.4167, "medium", ["cit-ot-kadesh-barnea"]),
     "summary": en("The wilderness base from which Israel sent spies into Canaan and where they lingered many years (Numbers 13; 20). Widely, though not universally, identified with the spring at Tell el-Qudeirat."),
     "citations": ["cit-ot-kadesh-barnea"]},
    {"id": "site-mount-nebo", "ancientName": en("Mount Nebo (Pisgah)"),
     "modernName": en("Mount Nebo (Siyagha)"),
     "modernLocation": en("Mount Nebo, Madaba Governorate, Jordan"),
     "coordinates": coords(31.7683, 35.7256, "high", ["cit-ot-mount-nebo"]),
     "summary": en("The ridge east of the Jordan from which Moses viewed the promised land and where he died (Deuteronomy 34); a Byzantine memorial church with famous mosaics crowns the summit today."),
     "citations": ["cit-ot-mount-nebo"]},
]


# ── Journeys + stops ────────────────────────────────────────────────────────
def stop(jid, order, sid, leg, a, b, disp, summary, refs, conf, cites, disputes=None):
    s = {"id": f"{jid}-{order}", "journeyId": jid, "order": order, "siteId": sid,
         "legMode": leg, "dateRange": dr(a, b, disp), "eventSummary": en(summary),
         "scriptureRefs": refs, "confidence": conf, "reviewStatus": "self-reviewed",
         "citations": cites}
    if disputes:
        s["disputes"] = en(disputes)
    return s


AB = "journey-abraham"
abr_dr = (-2000, -1800)
abr_stops = [
    stop(AB, 0, "site-ur", "start", *abr_dr, "c. 2000-1800 BC (patriarchal age, debated)",
         "Genesis opens Abraham's story at Ur, from which Terah's family set out for Canaan (Genesis 11:31).", ["Genesis 11:31"], "legendary", ["cit-ot-ur", "cit-ot-abraham"]),
    stop(AB, 1, "site-haran", "land", *abr_dr, "c. 2000-1800 BC",
         "The family settles at Haran; there Abraham receives the call to go to a land God will show him, with the promise of blessing (Genesis 12:1-4).", ["Genesis 12:1", "Genesis 12:4"], "legendary", ["cit-ot-haran", "cit-ot-abraham"]),
    stop(AB, 2, "site-shechem-ot", "land", *abr_dr, "c. 2000-1800 BC",
         "Entering Canaan, Abraham builds his first altar at the oak of Moreh near Shechem, where the land is promised to his offspring (Genesis 12:6-7).", ["Genesis 12:6", "Genesis 12:7"], "legendary", ["cit-ot-shechem", "cit-ot-abraham"]),
    stop(AB, 3, "site-bethel", "land", *abr_dr, "c. 2000-1800 BC",
         "Abraham pitches between Bethel and Ai and builds an altar (Genesis 12:8); Jacob later dreams here of the ladder to heaven (Genesis 28).", ["Genesis 12:8", "Genesis 28:19"], "legendary", ["cit-ot-bethel", "cit-ot-abraham"]),
    stop(AB, 4, "site-hebron-machpelah", "land", *abr_dr, "c. 2000-1800 BC",
         "Abraham settles by the oaks of Mamre at Hebron and buys the cave of Machpelah to bury Sarah — the patriarchs' traditional tomb (Genesis 23).", ["Genesis 13:18", "Genesis 23:19"], "legendary", ["cit-ot-machpelah", "cit-ot-abraham"]),
    stop(AB, 5, "site-beersheba-ot", "land", *abr_dr, "c. 2000-1800 BC",
         "At Beersheba Abraham and Isaac dig wells and swear covenants; it becomes the patriarchs' southern frontier (Genesis 21:31; 26:23-33).", ["Genesis 21:31", "Genesis 26:33"], "legendary", ["cit-ot-beersheba", "cit-ot-abraham"]),
]
journey_abraham = {
    "id": AB, "title": en("Abraham's Migration to Canaan"), "kind": "patriarchal",
    "dateRange": dr(*abr_dr, "c. 2000-1800 BC (Middle Bronze Age; dating debated)"),
    "summary": en("The patriarchal migration from Mesopotamia to the land of promise: Ur and Haran to Shechem, Bethel, Hebron and Beersheba. The route follows the Genesis narrative; its historicity and date are debated by scholars."),
    "chronologyNotes": en("The 'patriarchal age' is conventionally set in the Middle Bronze Age (c. 2000-1800 BC), but many scholars regard the narratives as later literary compositions; treat the chronology as traditional, not fixed."),
    "color": "#8a6d10",
    "stops": [f"{AB}-{i}" for i in range(len(abr_stops))],
    "citations": ["cit-ot-abraham", "cit-ot-patriarchal-dating"],
}

EX = "journey-exodus"
ex_dr = (-1446, -1250)
ex_disp = "c. 1446 BC (early date) or c. 1260 BC (late date) — debated"
ex_route_note = "The Exodus route and its date (early c. 1446 BC vs late c. 1260 BC) are debated, and the wilderness stations cannot be securely mapped; the geography here follows the biblical itinerary, not confirmed archaeology."
ex_stops = [
    stop(EX, 0, "site-goshen-rameses", "start", *ex_dr, ex_disp,
         "Israel departs Egypt from the region of Rameses in Goshen after the plagues and the first Passover (Exodus 12:37).", ["Exodus 1:11", "Exodus 12:37"], "disputed", ["cit-ot-exodus", "cit-ot-pi-ramesses"], disputes=ex_route_note),
    stop(EX, 1, "site-mount-sinai", "land", *ex_dr, ex_disp,
         "At the mountain of God (Sinai/Horeb) Israel receives the Law and enters the covenant (Exodus 19-20). The mountain's location is uncertain.", ["Exodus 19:1", "Exodus 20:1"], "disputed", ["cit-ot-mount-sinai", "cit-ot-exodus"], disputes="Both the Exodus date and the identity of Mount Sinai are disputed; the traditional Jebel Musa is used with alternatives noted on the site."),
    stop(EX, 2, "site-kadesh-barnea", "land", *ex_dr, ex_disp,
         "From Kadesh-barnea Israel sends spies into Canaan and, after the refusal to enter, spends its wilderness years (Numbers 13; 20).", ["Numbers 13:26", "Numbers 20:1"], "disputed", ["cit-ot-kadesh-barnea", "cit-ot-exodus-route"], disputes=ex_route_note),
    stop(EX, 3, "site-mount-nebo", "land", *ex_dr, ex_disp,
         "On Mount Nebo Moses views the promised land he will not enter, and dies (Deuteronomy 34).", ["Deuteronomy 34:1", "Deuteronomy 34:5"], "disputed", ["cit-ot-mount-nebo", "cit-ot-exodus"], disputes=ex_route_note),
    stop(EX, 4, "site-final-journey-jericho", "land", *ex_dr, ex_disp,
         "Under Joshua, Israel crosses the Jordan near Jericho into Canaan (Joshua 3-6). The Late-Bronze destruction of Jericho and its dating are debated.", ["Joshua 3:17", "Joshua 6:20"], "disputed", ["cit-ot-joshua", "cit-ot-jericho"], disputes="The archaeology of Jericho's fall (dating of the destruction at Tell es-Sultan) is much debated and does not cleanly fit either Exodus date."),
]
journey_exodus = {
    "id": EX, "title": en("The Exodus and Wilderness Journey"), "kind": "exodus",
    "dateRange": dr(*ex_dr, ex_disp),
    "summary": en("Israel's journey from Egypt to the edge of Canaan: from Rameses in Goshen to Mount Sinai, Kadesh-barnea, Mount Nebo, and the Jordan crossing near Jericho. Both the date and the route are debated; the itinerary follows the biblical text."),
    "chronologyNotes": en("Scholars divide between an 'early' Exodus (c. 1446 BC, from 1 Kings 6:1) and a 'late' Exodus (c. 1260 BC, Ramesside); the wilderness itinerary cannot be securely mapped."),
    "color": "#8f3a20",
    "stops": [f"{EX}-{i}" for i in range(len(ex_stops))],
    "citations": ["cit-ot-exodus", "cit-ot-exodus-route"],
}


def main():
    citations_out = upsert(loadx("citations.extra.json"), citations)
    persons_out = upsert(loadx("persons.extra.json"), persons)
    sites_out = upsert(loadx("sites.extra.json"), sites)
    journeys_out = upsert(loadx("journeys.extra.json"), [journey_abraham, journey_exodus])
    stops_out = upsert(loadx("stops.extra.json"), abr_stops + ex_stops)

    for name, data in [
        ("citations.extra.json", citations_out),
        ("persons.extra.json", persons_out),
        ("sites.extra.json", sites_out),
        ("journeys.extra.json", journeys_out),
        ("stops.extra.json", stops_out),
    ]:
        with open(os.path.join(C, name), "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{name:26} {len(data)} entries")


if __name__ == "__main__":
    main()
