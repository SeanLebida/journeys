#!/usr/bin/env python3
"""Archaeology expansion: link existing artifacts to their sites and add major
new finds (NT + OT). Idempotent.

- Edits content/artifacts.json to add `siteId` to the 7 base finds so they
  surface on the relevant site's detail panel.
- Writes new finds to content/artifacts.extra.json.
- Appends citations to content/citations.extra.json.
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
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def en(s):
    return {"en": s}


def dr(a, b, disp):
    return {"startYear": a, "endYear": b, "display": en(disp), "approximate": True}


def upsert(arr, items, key="id"):
    by = {x[key]: x for x in arr}
    for it in items:
        by[it[key]] = it
    out, seen = [], set()
    for x in arr:
        if x[key] not in seen:
            out.append(by[x[key]]); seen.add(x[key])
    for it in items:
        if it[key] not in seen:
            out.append(it); seen.add(it[key])
    return out


# 1. Link base artifacts to sites (where the find is surfaced).
BASE_SITE = {
    "artifact-pilate-stone": "site-trial-before-pilate",
    "artifact-gallio-inscription": "site-corinth",
    "artifact-erastus-inscription": "site-corinth",
    "artifact-politarch-inscription": "site-thessalonica",
    "artifact-pool-of-siloam": "site-jerusalem",
    "artifact-caiaphas-ossuary": "site-jerusalem",
    "artifact-nazareth-house": "site-nazareth",
}
base = load("artifacts.json")
for a in base:
    if a["id"] in BASE_SITE:
        a["siteId"] = BASE_SITE[a["id"]]
write("artifacts.json", base)


# 2. New citations.
CITES = [
    ("cit-arch-tel-dan", "Wikipedia, 'Tel Dan Stele' (House of David inscription)", "https://en.wikipedia.org/wiki/Tel_Dan_Stele", "archaeological"),
    ("cit-arch-merneptah", "Wikipedia, 'Merneptah Stele' (earliest mention of Israel)", "https://en.wikipedia.org/wiki/Merneptah_Stele", "archaeological"),
    ("cit-arch-mesha", "Wikipedia, 'Mesha Stele' (Moabite Stone)", "https://en.wikipedia.org/wiki/Mesha_Stele", "archaeological"),
    ("cit-arch-bethesda", "Wikipedia, 'Pool of Bethesda'", "https://en.wikipedia.org/wiki/Pool_of_Bethesda", "archaeological"),
    ("cit-arch-capernaum-house", "Wikipedia, 'Capernaum' (House of St Peter / insula sacra)", "https://en.wikipedia.org/wiki/Capernaum", "archaeological"),
    ("cit-arch-siloam-tunnel", "Wikipedia, 'Siloam inscription' (Hezekiah's Tunnel)", "https://en.wikipedia.org/wiki/Siloam_inscription", "archaeological"),
    ("cit-arch-cyrus-cylinder", "Wikipedia, 'Cyrus Cylinder'", "https://en.wikipedia.org/wiki/Cyrus_Cylinder", "archaeological"),
    ("cit-arch-sergius-paulus", "Wikipedia, 'Sergius Paulus'", "https://en.wikipedia.org/wiki/Sergius_Paulus", "archaeological"),
    ("cit-arch-sennacherib-prism", "Wikipedia, 'Sennacherib's Annals' (Taylor / Sennacherib Prism)", "https://en.wikipedia.org/wiki/Sennacherib%27s_Annals", "archaeological"),
    ("cit-arch-hezekiah-bulla", "Wikipedia, 'Hezekiah' (royal seal impression / bulla)", "https://en.wikipedia.org/wiki/Hezekiah", "archaeological"),
]
citations = [{"id": i, "source": en(s), "url": u, "kind": k} for i, s, u, k in CITES]
write("citations.extra.json", upsert(load("citations.extra.json"), citations))


# 3. New artifacts.
def art(id, name, site, loc, corrob, a, b, disp, conf, cites, disputes=None):
    o = {"id": id, "name": en(name), "siteId": site, "modernLocation": en(loc),
         "corroborates": en(corrob), "dateRange": dr(a, b, disp),
         "confidence": conf, "reviewStatus": "self-reviewed", "citations": cites}
    if disputes:
        o["disputes"] = en(disputes)
    return o


artifacts = [
    art("artifact-tel-dan-stele", "The Tel Dan Stele ('House of David')", "site-jerusalem",
        "Israel Museum, Jerusalem (found at Tel Dan, 1993-94)",
        "An Aramaic victory stele whose 'BYTDWD' is read by most scholars as 'House of David' — the earliest extra-biblical reference to the Davidic dynasty, c. 9th c. BC. A minority contest the reading.",
        -841, -841, "c. 841 BC", "high", ["cit-arch-tel-dan"]),
    art("artifact-mesha-stele", "The Mesha Stele (Moabite Stone)", "site-mount-nebo",
        "Louvre, Paris (found at Dhiban, Jordan, 1868)",
        "King Mesha of Moab's inscription (c. 840 BC) recounting revolt against Israel; it names Omri king of Israel, YHWH, and the town of Nebo — paralleling 2 Kings 3. Some read a damaged line as 'House of David'.",
        -840, -840, "c. 840 BC", "high", ["cit-arch-mesha"]),
    art("artifact-merneptah-stele", "The Merneptah Stele ('Israel')", "site-goshen-rameses",
        "Egyptian Museum, Cairo (found at Thebes, 1896)",
        "Pharaoh Merneptah's victory stele (c. 1208 BC) carries the earliest known mention of 'Israel' as a people in Canaan — a fixed point for Israel's presence in the land by the late 13th c. BC.",
        -1208, -1208, "c. 1208 BC", "high", ["cit-arch-merneptah"]),
    art("artifact-pool-of-bethesda", "The Pool of Bethesda", "site-jerusalem",
        "Excavated near the Church of St Anne, Old City of Jerusalem",
        "A twin-pool complex with five porticoes matching John 5:2 — long doubted until excavation confirmed its form, a case where topographical detail in John was archaeologically vindicated.",
        -100, 100, "Second Temple period", "high", ["cit-arch-bethesda"]),
    art("artifact-capernaum-house-peter", "The House of St Peter, Capernaum", "site-capernaum",
        "Capernaum, on the Sea of Galilee (beneath the modern memorial church)",
        "A 1st-c. house singled out very early for veneration (graffiti, later octagonal church) and identified by tradition as Peter's house, where Jesus stayed and healed (Mark 1:29-31). The identification is traditional.",
        -50, 400, "1st c. AD onward", "medium", ["cit-arch-capernaum-house"]),
    art("artifact-hezekiah-siloam-tunnel", "Hezekiah's Tunnel and the Siloam Inscription", "site-jerusalem",
        "Tunnel in the City of David; inscription in the Istanbul Archaeology Museums",
        "An 8th-c. BC water tunnel and its paleo-Hebrew inscription recording the diggers' meeting — matching Hezekiah's works before Sennacherib's siege (2 Kings 20:20; 2 Chronicles 32:30).",
        -701, -701, "c. 701 BC", "high", ["cit-arch-siloam-tunnel"]),
    art("artifact-sennacherib-prism", "Sennacherib's Prism (Annals)", "site-jerusalem",
        "Copies in the British Museum, Oriental Institute (Chicago), and Israel Museum",
        "Sennacherib's own account of his 701 BC campaign says he shut up Hezekiah 'like a bird in a cage' in Jerusalem — corroborating the siege of 2 Kings 18-19 while, tellingly, never claiming to take the city.",
        -691, -691, "c. 691 BC", "high", ["cit-arch-sennacherib-prism"]),
    art("artifact-hezekiah-bulla", "The Bulla of King Hezekiah", "site-jerusalem",
        "Found in the Ophel excavations, City of David, Jerusalem (2015)",
        "A clay seal impression reading 'Belonging to Hezekiah [son of] Ahaz, king of Judah' — a royal artifact naming a biblical king of Judah, from controlled excavation.",
        -700, -700, "late 8th c. BC", "high", ["cit-arch-hezekiah-bulla"]),
    art("artifact-cyrus-cylinder", "The Cyrus Cylinder", "site-jerusalem",
        "British Museum, London (found at Babylon, 1879)",
        "Cyrus the Great's proclamation (c. 539 BC) of restoring displaced peoples and their sanctuaries — the imperial policy behind the return from exile and the temple's rebuilding (Ezra 1; 6). Its direct bearing on Judah is inferred, not named.",
        -539, -539, "c. 539 BC", "medium", ["cit-arch-cyrus-cylinder"]),
    art("artifact-sergius-paulus", "Inscriptions of the Sergii Pauli", "site-paphos",
        "Inscriptions from Cyprus, Pisidian Antioch, and Rome",
        "Several inscriptions attest the aristocratic Sergii Pauli family, consistent with the proconsul Sergius Paulus whom Paul met on Cyprus (Acts 13:7); which individual Luke names is debated.",
        1, 100, "1st c. AD", "medium", ["cit-arch-sergius-paulus"],
        disputes="Inscriptions confirm the family and its standing, but securely matching a specific attested Sergius Paulus to Luke's Cypriot proconsul is not possible; the identification is probable, not certain."),
]
write("artifacts.extra.json", upsert(load("artifacts.extra.json"), artifacts))

print(f"base artifacts linked: {len(BASE_SITE)}")
print(f"new artifacts: {len(artifacts)}")
print(f"new citations: {len(citations)}")


if __name__ == "__main__":
    pass
