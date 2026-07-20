#!/usr/bin/env python3
"""Accuracy pass implementing the 2026-07-20 findings recommendations.

Idempotent content mutations:
  1. Register primary-scripture citations from every scriptureRefs[] and attach them.
  2. Re-kind popular tertiary sources as tertiary-popular.
  3. Attach curated Pleiades ids to well-attested sites.
  4. Author candidates (or disputes notes) for medium/disputed coordinates.
  5. Downgrade high coordinates that rest only on generic whole-atlas backstops
     and lack a gazetteer id.
  6. Tag route legGrades from stop legMode + journey kind.
  7. Emit docs/review/high-claims-packet.json for human scholar review.

Run after other generators; before (or with) build:content.
"""
from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "content")
DOCS = os.path.join(ROOT, "docs", "review")

GENERIC_BACKSTOP = {
    "cit-ref-anet", "cit-ref-cos", "cit-ref-grayson-chronicles",
    "cit-src-livius-abc5", "cit-src-livius-abc4", "cit-ref-abd", "cit-ref-bright",
    "cit-ref-kitchen", "cit-ref-provan-history", "cit-ref-keener-bbcnt",
    "cit-ref-blomberg-gospels", "cit-ref-vanvoorst", "cit-ref-aharoni",
    "cit-ref-sacred-bridge", "cit-ref-negev-gibson",
}

TERTIARY_HOST = [
    "wikipedia.org", "britannica.com", "gotquestions.org", "enduringword.com",
    "blueletterbible.org", "biblehub.com", "biblegateway.com", "crosswalk.com",
    "esv.org/resources", "biola.edu/blogs", "holylandsite.com",
]
TERTIARY_SOURCE = [
    "gotquestions", "enduring word", "blue letter bible", "britannica",
    "esv global study bible",
]


def load(name):
    p = os.path.join(C, name)
    return json.load(open(p)) if os.path.exists(p) else []


def write(name, data):
    with open(os.path.join(C, name), "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


def en(s):
    return {"en": s}


def scripture_cit_id(raw: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")[:80]
    return f"cit-scripture-{slug}"


def is_tertiary(c):
    if c.get("kind") == "tertiary-popular":
        return True
    url = (c.get("url") or "").lower()
    if any(h in url for h in TERTIARY_HOST):
        return True
    src = (c.get("source", {}).get("en") or "").lower()
    if any(h in src for h in TERTIARY_SOURCE):
        return True
    return False


# Curated Pleiades place ids — omit rather than guess.
PLEIADES = {
    "site-jerusalem": "687928",
    "site-bethlehem": "687921",
    "site-nazareth": "678306",
    "site-capernaum": "678106",
    "site-caesarea-maritima": "678406",
    "site-caesarea": "678406",
    "site-caesarea-imprisonment": "678406",
    "site-caesarea-philippi": "678094",
    "site-tyre-and-sidon": "678400",
    "site-sidon": "678386",
    "site-damascus": "678110",
    "site-antioch-on-the-orontes": "658381",
    "site-antioch": "658381",
    "site-seleucia-pieria": "658554",
    "site-iconium": "648715",
    "site-lystra": "648749",
    "site-derbe": "648661",
    "site-perga": "639047",
    "site-pisidian-antioch": "648621",
    "site-attalia": "638753",
    "site-paphos": "707586",
    "site-salamis": "707609",
    "site-ephesus": "599612",
    "site-miletus": "599788",
    "site-troas": "501635",
    "site-alexandria-troas": "501416",
    "site-philippi": "501482",
    "site-thessalonica": "491741",
    "site-berea": "491557",
    "site-athens": "579885",
    "site-corinth": "570182",
    "site-cenchreae": "570183",
    "site-rome": "423025",
    "site-malta-shipwreck": "462231",
    "site-alexandria": "727070",
    "site-patmos": "599866",
    "site-hierapolis": "638866",
    "site-myra-of-lycia": "638922",
    "site-samaria-city": "687961",
    "site-joppa": "687953",
    "site-lydda": "687954",
    "site-megiddo": "678270",
    "site-hazor": "678184",
    "site-lachish": "687955",
    "site-dan": "678114",
    "site-hebron-machpelah": "687941",
    "site-beersheba-ot": "687918",
    "site-jericho-ot": "687949",
    "site-final-journey-jericho": "687949",
    "site-ur": "912964",
    "site-haran": "658457",
    "site-carchemish": "658415",
    "site-qarqar": "668331",
}

CANDIDATES = {
    "site-emmaus": [
        ("Emmaus-Nicopolis (Amwas/Latrun) — strongest ancient attestation (Eusebius); ~160 stadia", 31.8389, 34.9889, "medium"),
        ("el-Qubeibeh — Franciscan tradition; ~60-stadia reading", 31.8400, 35.1360, "legendary"),
        ("Motza / Colonia — Josephus 'Ammaus'; ~60 stadia W of Jerusalem", 31.7936, 35.1631, "disputed"),
    ],
    "site-cana-of-galilee": [
        ("Kafr Kanna — traditional pilgrim site", 32.7467, 35.3389, "medium"),
        ("Khirbet Qana — preferred by many modern archaeologists", 32.7556, 35.2992, "medium"),
    ],
    "site-bethsaida": [
        ("et-Tell — longstanding identification as Bethsaida-Julias", 32.9097, 35.6306, "medium"),
        ("el-Araj — lakeshore dig; strong recent case for NT Bethsaida", 32.8892, 35.6203, "medium"),
    ],
    "site-baptism-at-the-jordan": [
        ("Al-Maghtas (Bethany beyond the Jordan, Jordan) — UNESCO; early Christian remains", 31.8372, 35.5506, "medium"),
        ("Qasr el-Yahud (West Bank) — traditional western bank baptistery", 31.8383, 35.5394, "medium"),
    ],
    "site-mount-sinai": [
        ("Jebel Musa / St Catherine — traditional southern Sinai", 28.5394, 33.9750, "legendary"),
        ("Jebel al-Lawz (NW Arabia) — minority proposal", 28.6542, 35.3058, "disputed"),
        ("Har Karkom (Negev) — Anati proposal", 30.3110, 34.7430, "disputed"),
    ],
    "site-ai": [
        ("et-Tell — classical identification (Albright et al.)", 31.9167, 35.2611, "disputed"),
        ("Khirbet el-Maqatir — alternative excavation claim", 31.9150, 35.2500, "disputed"),
    ],
    "site-trial-before-pilate": [
        ("Herod's Palace (western hill) — majority current view for the praetorium", 31.7760, 35.2285, "medium"),
        ("Antonia Fortress (NW Temple Mount) — traditional Via Dolorosa start", 31.7803, 35.2345, "legendary"),
    ],
    "site-decapolis": [
        ("Kursi / Gergesa — traditional lakeshore site of the swine miracle", 32.8258, 35.6503, "medium"),
        ("Gadara (Umm Qais) — Decapolis city named in some MSS", 32.6564, 35.6778, "medium"),
        ("Gerasa (Jerash) — Decapolis city; farther inland", 32.2806, 35.8914, "disputed"),
    ],
    "site-golgotha-and-the-tomb": [
        ("Church of the Holy Sepulchre — continuous Christian tradition from 4th c.", 31.7784, 35.2294, "medium"),
        ("Garden Tomb (Gordon's Calvary) — 19th-c. Protestant alternative", 31.7838, 35.2300, "legendary"),
    ],
    "site-ur": [
        ("Tell el-Muqayyar (southern Ur) — standard archaeological identification", 30.9626, 46.1031, "medium"),
        ("Urfa / Şanlıurfa region — northern 'Ur of the Chaldees' proposals", 37.1674, 38.7955, "disputed"),
    ],
    "site-kadesh-barnea": [
        ("Tell el-Qudeirat — leading archaeological candidate", 30.6422, 34.4117, "medium"),
        ("Ain Qedeis — older traditional identification", 30.5800, 34.4800, "legendary"),
    ],
    "site-ramoth-gilead": [
        ("Tell er-Rumeith — common scholarly proposal", 32.3667, 35.9333, "disputed"),
        ("er-Ramtha region — alternate Gilead proposals", 32.5592, 36.0069, "disputed"),
    ],
    "site-gibeah": [
        ("Tell el-Ful — traditional Saul's Gibeah", 31.8236, 35.2311, "disputed"),
        ("Jeba' / Geba region alternatives", 31.8550, 35.2600, "disputed"),
    ],
    "site-galilee-mountain": [
        ("Mount Tabor — traditional association", 32.6863, 35.3903, "legendary"),
        ("Mount Arbel / Horns of Hattin region — alternate proposals", 32.8230, 35.5010, "disputed"),
        ("Unspecified highland above the lake — text leaves the mountain unnamed", 32.8500, 35.5000, "disputed"),
    ],
    "site-egypt-refuge": [
        ("Nile Delta / Goshen region — typical flight-to-Egypt setting", 30.8500, 31.5000, "disputed"),
        ("Upper Egypt proposals in some traditions", 25.7000, 32.6500, "legendary"),
    ],
    "site-valley-of-siddim": [
        ("Southern Dead Sea basin — majority geographic reading", 31.1500, 35.4500, "disputed"),
        ("Eastern Ghor alternatives in minority reconstructions", 31.3000, 35.5500, "disputed"),
    ],
    "site-mahanaim": [
        ("Tell edh-Dhahab region proposals", 32.1833, 35.6833, "disputed"),
        ("Penuel / Jabbok ford area alternatives", 32.1830, 35.7000, "disputed"),
    ],
    "site-mount-zemaraim": [
        ("Hill country of Ephraim — region only; peak unnamed", 31.9500, 35.2500, "disputed"),
        ("Near Bethel / Ramah highland proposals", 31.9300, 35.2200, "disputed"),
    ],
    "site-aphek-golan": [
        ("Fiq / En-Gev region E of the Sea of Galilee", 32.7833, 35.7000, "disputed"),
        ("Hippos / Sussita area alternatives", 32.7786, 35.6597, "disputed"),
    ],
    "site-last-supper": [
        ("Traditional Cenacle on Mount Zion", 31.7717, 35.2290, "medium"),
        ("Essene Quarter / other upper-city proposals", 31.7730, 35.2280, "disputed"),
    ],
    "site-gethsemane": [
        ("Church of All Nations olive grove (traditional)", 31.7794, 35.2396, "medium"),
        ("Broader Kidron / lower Olivet slope (region)", 31.7780, 35.2405, "medium"),
    ],
    "site-samaria": [
        ("Jacob's Well at Nablus / Askar (Sychar tradition)", 32.2097, 35.2853, "medium"),
        ("Broader Shechem / Mount Gerizim approaches", 32.2130, 35.2810, "medium"),
    ],
    "site-bethany-and-bethphage": [
        ("el-Azariyeh (traditional Bethany of Lazarus)", 31.7700, 35.2610, "medium"),
        ("Bethphage ridge approaches to the Mount of Olives", 31.7770, 35.2500, "medium"),
    ],
    "site-bethel": [
        ("Beitin — standard identification", 31.9270, 35.2400, "medium"),
        ("el-Bireh / alternate Benjamin-highland proposals", 31.9100, 35.2150, "disputed"),
    ],
    "site-goshen-rameses": [
        ("Pi-Ramesses / Qantir region (Delta)", 30.8000, 31.8330, "medium"),
        ("Broader eastern Delta / Wadi Tumilat corridor", 30.6000, 31.9000, "medium"),
    ],
    "site-heshbon": [
        ("Tell Hisban — standard identification", 31.7167, 35.8000, "medium"),
        ("Jalul / alternate Madaba-plateau proposals", 31.7200, 35.8500, "disputed"),
    ],
    "site-edrei": [
        ("Daraa / Derʿā region — common identification", 32.6189, 36.1021, "medium"),
        ("Broader Bashan plateau alternatives", 32.7000, 36.2000, "disputed"),
    ],
    "site-qarqar": [
        ("Tell Qarqur on the Orontes — leading identification", 35.7410, 36.3300, "medium"),
        ("Orontes valley alternatives near Jisr es-Shughur", 35.8000, 36.3200, "disputed"),
    ],
    "site-shuruppak": [
        ("Fara (Tell Fara) — standard Sumerian Shuruppak", 31.7770, 45.5100, "medium"),
        ("Broader Euphrates flood-tradition basin (schematic)", 31.7000, 45.6000, "legendary"),
    ],
    "site-shinar-plain": [
        ("Babylon / central Mesopotamian alluvium", 32.5364, 44.4208, "medium"),
        ("Broader lower Mesopotamia (plain of Shinar)", 32.0000, 45.0000, "medium"),
    ],
    "site-mizpah": [
        ("Tell en-Nasbeh — leading Mizpah of Benjamin", 31.8850, 35.2160, "medium"),
        ("Nabi Samwil — traditional alternative", 31.8328, 35.1803, "legendary"),
    ],
}

DISPUTES_FALLBACK = {
    "site-bethlehem": "Church of the Nativity marks the traditional grotto; the exact 1st-century house site is not archaeologically fixed.",
}


def rekind_tertiary(citations):
    n = 0
    for c in citations:
        if c.get("kind") == "tertiary-popular":
            continue
        if is_tertiary(c) and c.get("kind") != "primary-scripture":
            c["kind"] = "tertiary-popular"
            n += 1
    return n


def ensure_scripture_cites(citations, entity_lists):
    by_id = {c["id"]: c for c in citations}
    created = attached = 0
    for entities in entity_lists:
        for ent in entities:
            refs = ent.get("scriptureRefs") or []
            cites = list(ent.get("citations") or [])
            for raw in refs:
                cid = scripture_cit_id(raw)
                if cid not in by_id:
                    by_id[cid] = {
                        "id": cid,
                        "source": en(f"Holy Scripture: {raw}"),
                        "kind": "primary-scripture",
                        "note": en(
                            "Public-domain biblical text (KJV/ASV) bundled in-app; "
                            "primary narrative source for the claim."
                        ),
                    }
                    created += 1
                if cid not in cites:
                    cites.append(cid)
                    attached += 1
            if refs:
                ent["citations"] = cites
    out, seen = [], set()
    for c in citations:
        if c["id"] not in seen:
            out.append(by_id.get(c["id"], c))
            seen.add(c["id"])
    for cid, c in by_id.items():
        if cid not in seen:
            out.append(c)
            seen.add(cid)
    return out, created, attached


def apply_pleiades(sites):
    n = 0
    for s in sites:
        pid = PLEIADES.get(s["id"])
        if pid and s.get("pleiadesId") != pid:
            s["pleiadesId"] = pid
            n += 1
    return n


def apply_candidates(sites):
    n_cand = n_disp = 0
    for s in sites:
        conf = s["coordinates"]["confidence"]
        if conf not in ("medium", "disputed"):
            continue
        if s.get("candidates") and len(s["candidates"]) >= 2:
            # still ensure disputed has disputes
            if conf == "disputed" and not s["coordinates"].get("disputes"):
                s["coordinates"]["disputes"] = en(
                    "Multiple candidate locations are shown; the primary pin is a working identification."
                )
                n_disp += 1
            continue
        if s["id"] in CANDIDATES:
            cits = list(s["coordinates"].get("citations") or s.get("citations") or [])[:4]
            s["candidates"] = [
                {
                    "label": en(label),
                    "lat": lat,
                    "lon": lon,
                    "confidence": cconf,
                    "citations": cits,
                }
                for label, lat, lon, cconf in CANDIDATES[s["id"]]
            ]
            n_cand += 1
            if conf == "disputed" and not s["coordinates"].get("disputes"):
                labels = "; ".join(x[0].split("—")[0].strip() for x in CANDIDATES[s["id"]])
                s["coordinates"]["disputes"] = en(
                    f"Location is contested among: {labels}. "
                    "The map pin is a working identification, not a settled fact."
                )
                n_disp += 1
        elif conf == "disputed" and not s["coordinates"].get("disputes"):
            s["coordinates"]["disputes"] = en(
                DISPUTES_FALLBACK.get(
                    s["id"],
                    "Scholars disagree on the precise location; the pin is approximate.",
                )
            )
            n_disp += 1
        elif conf == "medium" and not s.get("candidates") and not s["coordinates"].get("disputes"):
            note = DISPUTES_FALLBACK.get(
                s["id"],
                "Traditional or topographically apt identification; alternate sites exist in the literature. "
                "Treat the pin as a working locus, not a surveyed property boundary.",
            )
            s["coordinates"]["disputes"] = en(note)
            n_disp += 1
    return n_cand, n_disp


def downgrade_generic_high(sites, cit_by_id):
    n = 0
    for s in sites:
        coords = s["coordinates"]
        if coords.get("confidence") != "high":
            continue
        if s.get("pleiadesId") or s.get("dareId"):
            continue
        ids = coords.get("citations") or []
        concrete = [i for i in ids if i in cit_by_id and not is_tertiary(cit_by_id[i])]
        if not concrete:
            continue
        if all(i in GENERIC_BACKSTOP for i in concrete):
            coords["confidence"] = "medium"
            if not coords.get("disputes"):
                coords["disputes"] = en(
                    "Downgraded from high: coordinate currently rests on a whole-atlas gazetteer "
                    "backstop without a place-specific gazetteer id or excavation locus. "
                    "Pin remains useful but not survey-grade."
                )
            n += 1
    return n


def grade_for(journey_kind, leg_mode, journey_id):
    if journey_id in ("journey-noah", "journey-apostolic-traditions"):
        return "schematic"
    if leg_mode == "sea":
        return "sea-lane"
    if journey_kind in ("patriarchal", "exodus"):
        return "reconstructed-land"
    if journey_id == "journey-ministry":
        return "reconstructed-land"
    if leg_mode in ("land", "turnaround", "start"):
        return "surveyed-road"
    return "reconstructed-land"


def apply_leg_grades(routes, journeys, stops):
    j_by = {j["id"]: j for j in journeys}
    s_by = {s["id"]: s for s in stops}
    n = 0
    for r in routes:
        j = j_by.get(r["journeyId"])
        if not j:
            continue
        grades = []
        for k in range(len(r["legs"])):
            stop_id = j["stops"][k + 1] if k + 1 < len(j["stops"]) else j["stops"][-1]
            st = s_by.get(stop_id)
            mode = (st or {}).get("legMode", "land")
            grades.append(grade_for(j.get("kind", "apostolic"), mode, j["id"]))
        if r.get("legGrades") != grades:
            r["legGrades"] = grades
            n += 1
    return n


def write_review_packet(sites, stops, artifacts, witnesses, battles, miracles):
    os.makedirs(DOCS, exist_ok=True)
    claims = []

    def add(kind, id_, conf, review, summary, citations, extra=None):
        if conf != "high" or review == "scholar-approved":
            return
        row = {
            "kind": kind,
            "id": id_,
            "confidence": conf,
            "reviewStatus": review,
            "summary": summary,
            "citations": citations,
            "decision": None,
            "reviewerNote": None,
        }
        if extra:
            row.update(extra)
        claims.append(row)

    for s in sites:
        c = s["coordinates"]
        add(
            "site.coordinates", s["id"], c["confidence"], c["reviewStatus"],
            s.get("ancientName", {}).get("en", s["id"]), c.get("citations") or [],
            {
                "lat": c["value"]["lat"], "lon": c["value"]["lon"],
                "pleiadesId": s.get("pleiadesId"),
                "candidates": len(s.get("candidates") or []),
            },
        )
    for s in stops:
        add("stop", s["id"], s["confidence"], s["reviewStatus"],
            s.get("eventSummary", {}).get("en", ""), s.get("citations") or [])
    for a in artifacts:
        add("artifact", a["id"], a["confidence"], a["reviewStatus"],
            a.get("name", {}).get("en", ""), a.get("citations") or [])
    for w in witnesses:
        add("witness", w["id"], w["confidence"], w["reviewStatus"],
            w.get("title", {}).get("en", ""), w.get("citations") or [])
    for b in battles:
        add("battle", b["id"], b["confidence"], b["reviewStatus"],
            b.get("title", {}).get("en", ""), b.get("citations") or [])
    for m in miracles:
        add("miracle", m["id"], m["confidence"], m["reviewStatus"],
            m.get("title", {}).get("en", ""), m.get("citations") or [])

    packet = {
        "title": "Journeys high-claim scholar review packet",
        "instructions": (
            "For each claim set decision to approve | downgrade | dispute. "
            "approve → reviewStatus scholar-approved; downgrade → lower confidence; "
            "dispute → confidence disputed + disputes note. Do not rubber-stamp."
        ),
        "generatedFrom": "scripts/gen-accuracy-pass.py",
        "count": len(claims),
        "claims": claims,
    }
    path = os.path.join(DOCS, "high-claims-packet.json")
    with open(path, "w") as f:
        json.dump(packet, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(os.path.join(DOCS, "README.md"), "w") as f:
        f.write(
            "# Scholar review packets\n\n"
            "`high-claims-packet.json` lists every `high`-confidence claim that is not yet "
            "`scholar-approved`. Reviewers fill `decision` + `reviewerNote` per row.\n\n"
            "Apply decisions in content JSON (or a future import script); never bulk-set "
            "`scholar-approved` without a human decision.\n"
        )
    return len(claims), path


def split_cites(all_cites, base_ids):
    new_base, new_extra, seen = [], [], set()
    for c in all_cites:
        if c["id"] in seen:
            continue
        seen.add(c["id"])
        if c["id"] in base_ids and not c["id"].startswith("cit-scripture-"):
            new_base.append(c)
        else:
            new_extra.append(c)
    return new_base, new_extra


def main():
    citations = load("citations.json")
    citations_extra = load("citations.extra.json")
    sites = load("sites.json")
    sites_extra = load("sites.extra.json")
    stops = load("stops.json")
    stops_extra = load("stops.extra.json")
    persons = load("persons.json")
    persons_extra = load("persons.extra.json")
    miracles = load("miracles.json")
    battles = load("battles.json")
    artifacts = load("artifacts.json")
    artifacts_extra = load("artifacts.extra.json")
    witnesses = load("witnesses.extra.json") or load("witnesses.json")
    journeys = load("journeys.json") + load("journeys.extra.json")
    routes = load("routes.extra.json") or load("routes.json")

    all_cites = citations + citations_extra
    n_kind = rekind_tertiary(all_cites)

    all_cites, n_created, n_attached = ensure_scripture_cites(
        all_cites,
        [stops, stops_extra, persons, persons_extra, miracles, battles],
    )
    base_ids = {c["id"] for c in citations}
    new_base, new_extra = split_cites(all_cites, base_ids)

    all_sites = sites + sites_extra
    n_pleiades = apply_pleiades(all_sites)
    n_cand, n_disp = apply_candidates(all_sites)
    cit_by = {c["id"]: c for c in all_cites}
    n_down = downgrade_generic_high(all_sites, cit_by)

    site_base_ids = {s["id"] for s in load("sites.json")}
    sites_out = [s for s in all_sites if s["id"] in site_base_ids]
    sites_extra_out = [s for s in all_sites if s["id"] not in site_base_ids]

    n_grades = apply_leg_grades(routes, journeys, stops + stops_extra)

    write("citations.json", new_base)
    write("citations.extra.json", new_extra)
    write("sites.json", sites_out)
    write("sites.extra.json", sites_extra_out)
    write("stops.json", stops)
    write("stops.extra.json", stops_extra)
    write("persons.json", persons)
    write("persons.extra.json", persons_extra)
    write("miracles.json", miracles)
    write("battles.json", battles)
    write("routes.extra.json", routes)

    n_packet, packet_path = write_review_packet(
        sites_out + sites_extra_out,
        stops + stops_extra,
        artifacts + artifacts_extra,
        witnesses,
        battles,
        miracles,
    )

    print("— accuracy pass —")
    print(f"  re-kind tertiary-popular: {n_kind}")
    print(f"  primary-scripture created: {n_created}, attachments: {n_attached}")
    print(f"  pleiades ids set: {n_pleiades}")
    print(f"  candidate sets added: {n_cand}, disputes notes: {n_disp}")
    print(f"  high→medium generic-only coords: {n_down}")
    print(f"  routes legGrades updated: {n_grades}")
    print(f"  review packet: {n_packet} claims → {packet_path}")


if __name__ == "__main__":
    main()
