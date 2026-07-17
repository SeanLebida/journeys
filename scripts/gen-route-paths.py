#!/usr/bin/env python3
"""Generate the travelled path of every journey as per-leg polylines that follow
the documented historical routes, replacing straight destination-to-destination
lines. Idempotent; writes content/routes.extra.json (+ citations).

Curation model: every consecutive stop pair gets hand-authored via-points along
the route the travellers are recorded or reasonably reconstructed to have used —
  * Roman roads: Via Egnatia (Acts 17:1 names Amphipolis & Apollonia on it),
    Via Appia (Acts 28:15 names Forum Appii & Three Taverns), Via Sebaste,
    the Cilician Gates, the Anatolian interior highway (Acts 19:1).
  * Sea lanes: coast- and island-hugging courses; Acts' own sailing notices
    ("under the lee of Cyprus/Crete", Cauda, the Adria drift to Malta).
  * Pre-Roman routes: the Fertile Crescent caravan arc (Ur→Haran→Canaan),
    the hill-country ridge road, the traditional Exodus itinerary and the
    King's Highway detour around Edom.
Vias are display-resolution waypoints (±10-20 km), not surveyed geometry; each
route carries citations and an 'illustrative between attested waypoints' note.
Legs without vias fall back to a straight segment (tiny intra-city hops).
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


# ── Via-points per leg, keyed "fromSiteId>toSiteId", authored as (lat, lon) ──
V = {
    # ---- The Ministry of Jesus (hill-country ridge road, Jordan valley) ----
    "site-bethlehem>site-nazareth": [(31.78, 35.22), (31.93, 35.22), (32.21, 35.28), (32.46, 35.30), (32.60, 35.29)],
    "site-nazareth>site-baptism-at-the-jordan": [(32.60, 35.38), (32.50, 35.50), (32.20, 35.55), (31.95, 35.53)],
    "site-baptism-at-the-jordan>site-capernaum": [(32.00, 35.53), (32.35, 35.55), (32.62, 35.56), (32.79, 35.55)],
    "site-capernaum>site-cana-of-galilee": [(32.86, 35.47), (32.83, 35.38)],
    "site-cana-of-galilee>site-sea-of-galilee": [(32.83, 35.42), (32.83, 35.50)],
    "site-sea-of-galilee>site-bethsaida": [(32.87, 35.60)],
    "site-bethsaida>site-chorazin": [(32.92, 35.60)],
    "site-chorazin>site-decapolis": [(32.88, 35.575), (32.86, 35.62)],
    "site-decapolis>site-tyre-and-sidon": [(32.90, 35.60), (32.97, 35.50), (33.08, 35.38), (33.18, 35.25)],
    "site-tyre-and-sidon>site-caesarea-philippi": [(33.25, 35.35), (33.26, 35.55)],
    "site-caesarea-philippi>site-samaria": [(33.00, 35.56), (32.80, 35.50), (32.55, 35.33), (32.44, 35.30)],
    "site-samaria>site-final-journey-jericho": [(32.10, 35.36), (31.95, 35.44)],
    "site-final-journey-jericho>site-bethany-and-bethphage": [(31.82, 35.36)],

    # ---- Paul 1 (Cyprus coastal road, Via Sebaste, and the return) ----
    "site-antioch>site-seleucia-pieria": [(36.15, 36.05)],
    "site-seleucia-pieria>site-salamis": [(36.00, 35.60), (35.60, 34.80), (35.30, 34.20)],
    "site-salamis>site-paphos": [(34.95, 33.70), (34.71, 33.15), (34.66, 32.90), (34.66, 32.65), (34.70, 32.50)],
    "site-paphos>site-perga": [(35.20, 32.20), (36.00, 31.40), (36.60, 30.90), (36.88, 30.70), (36.92, 30.80)],
    "site-perga>site-pisidian-antioch": [(37.20, 30.55), (37.60, 30.40), (38.07, 30.50), (38.25, 30.90)],
    "site-pisidian-antioch>site-iconium": [(38.15, 31.60), (38.00, 32.00), (37.95, 32.30)],
    "site-iconium>site-lystra": [(37.70, 32.40)],
    "site-lystra>site-derbe": [(37.50, 32.70), (37.40, 33.00)],
    # Return retraced Lystra→Iconium→Antioch→Pisidia→Pamphylia (Acts 14:21-25).
    "site-derbe>site-attalia": [(37.55, 32.50), (37.87, 32.47), (38.15, 31.60), (38.30, 31.19), (38.05, 30.50), (37.40, 30.45), (37.00, 30.60)],

    # ---- Paul 2 (Syrian & Cilician Gates, interior to Troas, Via Egnatia) ----
    "site-antioch>site-syria": [(36.50, 36.20), (36.80, 36.10), (36.90, 35.90), (36.95, 35.40)],
    "site-syria>site-lystra": [(37.02, 34.85), (37.28, 34.75), (37.55, 34.55), (37.70, 34.00), (37.80, 33.50), (37.60, 32.90)],
    "site-lystra>site-alexandria-troas": [(37.87, 32.47), (38.31, 31.19), (38.75, 30.55), (39.10, 29.70), (39.35, 28.60), (39.55, 27.50), (39.62, 26.70)],
    "site-alexandria-troas>site-samothrace": [(40.10, 25.90)],
    "site-samothrace>site-neapolis": [(40.70, 24.90), (40.85, 24.55)],
    "site-neapolis>site-philippi": [(40.97, 24.35)],
    # Via Egnatia through Amphipolis and Apollonia (Acts 17:1).
    "site-philippi>site-thessalonica": [(40.92, 24.00), (40.82, 23.85), (40.63, 23.45), (40.60, 23.20), (40.62, 23.05)],
    "site-thessalonica>site-berea": [(40.55, 22.60)],
    # Land route south via Thessaly and Thermopylae (sea passage also argued).
    "site-berea>site-athens": [(39.98, 22.40), (39.64, 22.42), (39.10, 22.45), (38.80, 22.55), (38.44, 23.10), (38.32, 23.32), (38.10, 23.55)],
    "site-athens>site-corinth": [(38.04, 23.54), (37.99, 23.34), (37.97, 23.00)],
    "site-corinth>site-cenchreae": [(37.89, 22.93)],
    "site-cenchreae>site-ephesus": [(37.80, 23.35), (37.60, 24.10), (37.55, 25.00), (37.60, 26.00), (37.80, 26.80), (37.96, 27.05)],
    "site-ephesus>site-caesarea-maritima": [(37.60, 27.15), (36.85, 27.45), (36.30, 28.30), (36.05, 29.90), (35.40, 31.60), (34.55, 32.80), (34.30, 33.90), (33.50, 34.60)],

    # ---- Paul 3 (Gates again, the upper interior road via Laodicea, coastal hops) ----
    "site-antioch-on-the-orontes>site-galatia-and-phrygia": [(36.50, 36.20), (36.95, 35.40), (37.28, 34.75), (37.75, 33.90), (37.87, 32.48), (38.10, 31.70)],
    "site-galatia-and-phrygia>site-ephesus": [(38.15, 30.60), (38.07, 30.17), (37.90, 29.40), (37.84, 29.05), (37.88, 28.30), (37.95, 27.75)],
    "site-ephesus>site-macedonia": [(37.80, 26.90), (38.40, 26.30), (39.10, 26.20), (39.75, 26.10), (40.30, 25.60), (40.80, 24.70), (40.93, 24.40)],
    "site-macedonia>site-troas": [(40.85, 24.60), (40.35, 25.55), (40.00, 25.90)],
    # Assos→Mitylene→Chios→Samos→Miletus (Acts 20:13-15).
    "site-troas>site-miletus": [(39.50, 26.30), (39.10, 26.53), (38.60, 26.30), (38.30, 26.15), (37.90, 26.60), (37.70, 27.00)],
    # Cos→Rhodes→Patara, passing Cyprus on the left (Acts 21:1-3).
    "site-miletus>site-caesarea": [(36.90, 27.30), (36.35, 28.20), (36.25, 29.30), (36.00, 30.50), (35.20, 32.50), (34.40, 33.60), (33.70, 34.80), (33.20, 35.10), (32.80, 34.95)],
    "site-caesarea>site-jerusalem": [(32.10, 34.95), (31.95, 35.05), (31.83, 35.10)],

    # ---- Voyage to Rome (Acts 27-28 sailing notices; Via Appia) ----
    "site-caesarea-imprisonment>site-sidon": [(32.85, 34.95), (33.25, 35.15)],
    # "Under the lee of Cyprus" — north-about, then along Cilicia & Pamphylia.
    "site-sidon>site-myra-of-lycia": [(34.00, 35.30), (34.80, 35.20), (35.60, 34.60), (35.90, 33.50), (36.10, 32.20), (36.15, 31.00)],
    # Off Cnidus, then under the lee of Crete off Salmone to Fair Havens.
    "site-myra-of-lycia>site-cnidus-and-fair-havens": [(36.30, 28.60), (36.55, 27.60), (36.65, 27.30), (35.90, 26.80), (35.30, 26.30), (35.05, 25.70), (34.95, 25.10)],
    "site-cnidus-and-fair-havens>site-phoenix": [(35.02, 24.55)],
    # The storm: under Cauda, then the 14-night drift across Adria to Malta.
    "site-phoenix>site-malta-shipwreck": [(34.90, 24.20), (34.84, 24.05), (34.90, 22.50), (35.10, 20.50), (35.40, 18.00), (35.70, 15.80)],
    "site-malta-shipwreck>site-syracuse-rhegium-puteoli": [(36.30, 14.90), (37.06, 15.28), (37.60, 15.40), (38.11, 15.64), (38.40, 15.60), (39.20, 15.20), (40.00, 14.70), (40.70, 14.20)],
    # Via Appia: Capua, Sinuessa, Formiae, Terracina, Forum Appii, Three Taverns.
    "site-syracuse-rhegium-puteoli>site-rome": [(41.08, 14.20), (41.16, 13.85), (41.26, 13.62), (41.29, 13.28), (41.41, 13.10), (41.55, 12.86), (41.72, 12.68)],

    # ---- Apostolic traditions (customary sail lanes) ----
    "site-antioch>site-rome": [(35.80, 35.40), (34.60, 33.20), (35.30, 30.00), (36.10, 28.30), (35.60, 26.00), (35.00, 24.00), (35.60, 19.00), (36.30, 15.60), (38.15, 15.62), (39.50, 15.00), (40.60, 14.00), (41.55, 12.60), (41.73, 12.35)],
    "site-rome>site-ephesus": [(41.70, 12.30), (40.50, 13.80), (38.20, 15.62), (36.40, 15.80), (35.80, 19.50), (35.20, 23.00), (35.00, 25.50), (35.80, 27.20), (36.60, 27.40), (37.40, 26.90), (37.85, 27.10)],
    "site-ephesus>site-patmos": [(37.70, 26.90)],
    # Sea to Miletus, then the Maeander valley road past Tralles to Laodicea.
    "site-patmos>site-hierapolis": [(37.50, 26.90), (37.53, 27.25), (37.75, 27.60), (37.85, 27.95), (37.85, 28.60), (37.84, 29.10)],
    "site-hierapolis>site-alexandria": [(37.40, 29.20), (36.80, 29.10), (36.40, 29.30), (36.00, 28.90), (34.50, 29.50), (32.50, 29.80)],

    # ---- Abraham (the Fertile Crescent arc — never straight across the desert) ----
    "site-ur>site-haran": [(31.32, 45.64), (32.10, 45.00), (32.54, 44.42), (33.10, 44.20), (33.64, 42.82), (34.20, 41.90), (34.55, 40.90), (35.00, 40.45), (35.33, 40.14), (35.95, 39.05), (36.40, 39.03)],
    "site-haran>site-shechem-ot": [(36.83, 38.02), (36.45, 37.55), (36.20, 37.15), (35.85, 36.85), (35.40, 36.75), (35.13, 36.75), (34.73, 36.72), (34.20, 36.50), (33.51, 36.30), (33.10, 35.85), (32.85, 35.65), (32.60, 35.52), (32.40, 35.42), (32.28, 35.36)],
    "site-shechem-ot>site-bethel": [(32.05, 35.27)],
    "site-bethel>site-hebron-machpelah": [(31.85, 35.22), (31.78, 35.22), (31.70, 35.19), (31.60, 35.15)],
    "site-hebron-machpelah>site-beersheba-ot": [(31.40, 35.00)],

    # ---- Exodus (traditional southern route; King's Highway detour around Edom) ----
    "site-goshen-rameses>site-mount-sinai": [(30.55, 32.10), (30.30, 32.35), (30.02, 32.55), (29.85, 32.65), (29.45, 32.80), (29.10, 33.12), (28.85, 33.25), (28.70, 33.60)],
    "site-mount-sinai>site-kadesh-barnea": [(29.00, 34.05), (29.55, 34.25), (30.10, 34.32), (30.45, 34.38)],
    "site-kadesh-barnea>site-mount-nebo": [(30.40, 34.75), (30.05, 35.05), (29.75, 35.02), (29.58, 35.00), (29.85, 35.35), (30.30, 35.50), (30.73, 35.60), (31.18, 35.70), (31.50, 35.78)],
    "site-mount-nebo>site-final-journey-jericho": [(31.82, 35.62), (31.85, 35.54)],
}

CITES = [
    ("cit-route-orbis", "ORBIS: The Stanford Geospatial Network Model of the Roman World (roads & sea lanes)", "https://orbis.stanford.edu/", "gazetteer"),
    ("cit-route-via-egnatia", "Wikipedia, 'Via Egnatia'", "https://en.wikipedia.org/wiki/Via_Egnatia", "secondary-scholarly"),
    ("cit-route-via-appia", "Wikipedia, 'Appian Way'", "https://en.wikipedia.org/wiki/Appian_Way", "secondary-scholarly"),
    ("cit-route-via-sebaste", "Wikipedia, 'Via Sebaste'", "https://en.wikipedia.org/wiki/Via_Sebaste", "secondary-scholarly"),
    ("cit-route-cilician-gates", "Wikipedia, 'Cilician Gates'", "https://en.wikipedia.org/wiki/Cilician_Gates", "secondary-scholarly"),
    ("cit-route-kings-highway", "Wikipedia, 'King's Highway (ancient)'", "https://en.wikipedia.org/wiki/King%27s_Highway_(ancient)", "secondary-scholarly"),
    ("cit-route-acts-sea", "Wikipedia, 'Acts 27' (the voyage and shipwreck sailing notices)", "https://en.wikipedia.org/wiki/Acts_27", "secondary-scholarly"),
]

ROUTE_META = {
    "journey-ministry": ("Legs follow the hill-country ridge road, the Jordan-valley pilgrim road, and Galilee lake shores.", ["cit-route-orbis"]),
    "journey-paul-1": ("Follows the Cyprus south-coast road and the Via Sebaste through the Taurus; the return retraces Lystra-Iconium-Antioch to Pamphylia (Acts 14:21-25).", ["cit-route-orbis", "cit-route-via-sebaste"]),
    "journey-paul-2": ("Overland through the Syrian and Cilician Gates and the Anatolian interior; the Via Egnatia through Amphipolis and Apollonia (Acts 17:1); Aegean sail lanes between ports.", ["cit-route-orbis", "cit-route-cilician-gates", "cit-route-via-egnatia"]),
    "journey-paul-3": ("The interior highland road to Ephesus (Acts 19:1) via the Lycus valley (Laodicea); the coastal island hops of Acts 20-21 (Assos, Mitylene, Chios, Samos; Cos, Rhodes, Patara, passing Cyprus).", ["cit-route-orbis", "cit-route-cilician-gates"]),
    "journey-rome": ("Follows Acts 27-28's own sailing notices — under the lee of Cyprus, off Cnidus, under Crete by Salmone to Fair Havens, the drift past Cauda across Adria to Malta — then the Via Appia through Forum Appii and Three Taverns.", ["cit-route-orbis", "cit-route-acts-sea", "cit-route-via-appia"]),
    "journey-apostolic-traditions": ("Traditions travel the customary Mediterranean sail lanes and the Maeander valley road; routes are illustrative.", ["cit-route-orbis"]),
    "journey-abraham": ("The Fertile Crescent caravan arc: up the Euphrates by Babylon and Mari to Haran, then south by Aleppo, Hamath and Damascus into Canaan's ridge road — not a straight line across the Arabian desert.", ["cit-route-orbis", "cit-route-kings-highway"]),
    "journey-exodus": ("The traditional southern itinerary (Succoth, the Bitter Lakes crossing region, the west-Sinai coast to Jebel Musa), north to Kadesh, then the detour around Edom to the King's Highway and Mount Nebo. The route is disputed; this is the traditional reconstruction.", ["cit-route-kings-highway", "cit-route-orbis"]),
}

GENERIC_NOTE = " Waypoints are drawn at map resolution along the documented route; the path is illustrative between attested points."


def chaikin(points, keep_ends=True):
    """One corner-cutting pass — softens angles without leaving the corridor."""
    if len(points) < 3:
        return points
    out = [points[0]]
    for a, b in zip(points, points[1:]):
        out.append((a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25))
        out.append((a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75))
    out.append(points[-1])
    return out


def main():
    sites = {s["id"]: s for s in load("sites.json") + load("sites.extra.json")}
    stops = {s["id"]: s for s in load("stops.json") + load("stops.extra.json")}
    journeys = load("journeys.json") + load("journeys.extra.json")

    routes = []
    curated = 0
    total = 0
    for j in journeys:
        seq = [stops[sid] for sid in j["stops"]]
        legs = []
        for a, b in zip(seq, seq[1:]):
            total += 1
            ca = sites[a["siteId"]]["coordinates"]["value"]
            cb = sites[b["siteId"]]["coordinates"]["value"]
            key = f"{a['siteId']}>{b['siteId']}"
            vias = V.get(key)
            pts = [(ca["lat"], ca["lon"])] + (vias or []) + [(cb["lat"], cb["lon"])]
            if vias:
                curated += 1
                pts = chaikin(pts)
            legs.append([[round(lon, 3), round(lat, 3)] for lat, lon in pts])
        note, cites = ROUTE_META[j["id"]]
        routes.append({
            "id": f"route-{j['id']}",
            "journeyId": j["id"],
            "legs": legs,
            "note": en(note + GENERIC_NOTE),
            "citations": cites,
        })

    citations = [{"id": i, "source": en(s), "url": u, "kind": k} for i, s, u, k in CITES]
    write("citations.extra.json", upsert(load("citations.extra.json"), citations))
    write("routes.extra.json", upsert(load("routes.extra.json"), routes))
    pts = sum(len(leg) for r in routes for leg in r["legs"])
    print(f"routes: {len(routes)} journeys · {total} legs ({curated} curated, {total - curated} straight) · {pts} points")


if __name__ == "__main__":
    main()
