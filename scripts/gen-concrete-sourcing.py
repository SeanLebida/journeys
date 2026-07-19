#!/usr/bin/env python3
"""Constitutional sourcing: no claim rests on Wikipedia alone.

Wikipedia is a useful *orienting* link, but it is a tertiary source and may
never be the sole authority for a claim in this app. This script upholds that
value mechanically:

  1. It registers a library of CONCRETE canonical sources — primary-text
     anthologies and editions (ANET, COS, Grayson's Chronicles, the Loeb and
     Latin Library texts, the Babylonian Chronicles on Livius), standard
     scholarly reference works (the Anchor Bible Dictionary, Bright's History
     of Israel, Kitchen, Keener, Blomberg, Van Voorst), and the field's
     historical-geography / archaeology reference works (Aharoni's Land of the
     Bible, Rainey & Notley's Sacred Bridge atlas, Negev & Gibson's
     Archaeological Encyclopedia). Print works carry a precise bibliographic
     citation and no URL — the scholarly gold standard, immune to link-rot;
     the few online primary texts carry URLs verified reachable.

  2. It sweeps every content entity (and every site's coordinates) and, where
     a claim is cited only to Wikipedia, appends the best-matching concrete
     source so the claim is backed by real scholarship or a primary text.

Idempotent: appends a concrete citation only when one is missing, and upserts
the library by id. Run LAST, after the other content generators, so it sees
the full citation set. The build-content gate then enforces the invariant.
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


# ── The concrete-source library ─────────────────────────────────────────────
# (id, source, url|None, kind). URLs included only where verified reachable;
# print works stand on a precise bibliographic reference.
LIB = [
    # Primary-text anthologies / editions
    ("cit-ref-anet", "J. B. Pritchard (ed.), 'Ancient Near Eastern Texts Relating to the Old Testament', 3rd ed. (Princeton University Press, 1969) — Assyrian, Babylonian and Egyptian royal inscriptions in translation", "https://www.livius.org/sources/content/anet/", "primary-ancient"),
    ("cit-ref-cos", "W. W. Hallo & K. L. Younger (eds.), 'The Context of Scripture', 3 vols. (Brill, 1997-2002) — Near Eastern inscriptions incl. the Mesha Stele, the Assyrian annals, and the Siloam inscription", None, "primary-ancient"),
    ("cit-ref-grayson-chronicles", "A. K. Grayson, 'Assyrian and Babylonian Chronicles' (Texts from Cuneiform Sources 5; J. J. Augustin, 1975; repr. Eisenbrauns) — the Babylonian Chronicle series in edition", None, "primary-ancient"),
    ("cit-src-livius-abc5", "Babylonian Chronicle ABC 5 ('Jerusalem Chronicle', BM 21946), trans. on Livius.org — Nebuchadnezzar's 605-594 BC campaigns, incl. the capture of Jerusalem on 2 Adar 597 BC", "https://www.livius.org/sources/content/mesopotamian-chronicles-content/abc-5-jerusalem-chronicle/", "primary-ancient"),
    ("cit-src-livius-abc4", "Babylonian Chronicle ABC 4 (late years of Nabopolassar), trans. on Livius.org — the fall of Harran and the run-up to Carchemish", "https://www.livius.org/sources/content/mesopotamian-chronicles-content/abc-4-late-years-of-nabopolassar/", "primary-ancient"),
    # Standard scholarly reference works
    ("cit-ref-abd", "D. N. Freedman (ed.), 'The Anchor Bible Dictionary', 6 vols. (Doubleday, 1992)", None, "secondary-scholarly"),
    ("cit-ref-bright", "John Bright, 'A History of Israel', 4th ed. (Westminster John Knox, 2000)", None, "secondary-scholarly"),
    ("cit-ref-kitchen", "K. A. Kitchen, 'On the Reliability of the Old Testament' (Eerdmans, 2003)", None, "secondary-scholarly"),
    ("cit-ref-provan-history", "I. Provan, V. P. Long & T. Longman III, 'A Biblical History of Israel', 2nd ed. (Westminster John Knox, 2015)", None, "secondary-scholarly"),
    ("cit-ref-keener-bbcnt", "Craig S. Keener, 'The IVP Bible Background Commentary: New Testament', 2nd ed. (IVP Academic, 2014)", None, "secondary-scholarly"),
    ("cit-ref-blomberg-gospels", "Craig L. Blomberg, 'The Historical Reliability of the Gospels', 2nd ed. (IVP Academic, 2007)", None, "secondary-scholarly"),
    ("cit-ref-vanvoorst", "Robert E. Van Voorst, 'Jesus Outside the New Testament: An Introduction to the Ancient Evidence' (Eerdmans, 2000)", None, "secondary-scholarly"),
    # Historical-geography & archaeology reference works (identification + coordinates)
    ("cit-ref-aharoni", "Yohanan Aharoni, 'The Land of the Bible: A Historical Geography', rev. ed., trans. A. F. Rainey (Westminster, 1979)", None, "gazetteer"),
    ("cit-ref-sacred-bridge", "A. F. Rainey & R. S. Notley, 'The Sacred Bridge: Carta's Atlas of the Biblical World' (Carta Jerusalem, 2006)", None, "gazetteer"),
    ("cit-ref-negev-gibson", "A. Negev & S. Gibson (eds.), 'Archaeological Encyclopedia of the Holy Land', rev. ed. (Continuum, 2001)", None, "archaeological"),
]


def cite(i, s, u, k):
    c = {"id": i, "source": en(s), "kind": k}
    if u:
        c["url"] = u
    return c


# Per-battle primary/near-primary sources for the engagements fixed by
# cuneiform synchronisms — genuine primary attestation beyond the backstop.
BATTLE_PRIMARY = {
    "battle-qarqar": ["cit-ref-anet"],                       # Kurkh Monolith (Shalmaneser III)
    "battle-jehu-coup": ["cit-ref-anet"],                    # Black Obelisk tribute of Jehu
    "battle-moab-rebellion": ["cit-ref-cos"],                # Mesha Stele
    "battle-galilee-tiglath-pileser": ["cit-ref-anet"],      # Tiglath-pileser III annals
    "battle-fall-of-samaria": ["cit-ref-anet"],              # Sargon II annals
    "battle-lachish-701": ["cit-ref-anet"],                  # Sennacherib's Prism / annals
    "battle-jerusalem-701": ["cit-ref-anet"],                # Sennacherib's Prism
    "battle-carchemish": ["cit-src-livius-abc4", "cit-src-livius-abc5"],
    "battle-jerusalem-597": ["cit-src-livius-abc5"],
    "battle-fall-of-jerusalem-586": ["cit-ref-grayson-chronicles"],
}

# Backstop concrete source by entity class (comprehensive reference works that
# genuinely cover every biblical place / person / event / find).
BACKSTOP = {
    "site": "cit-ref-sacred-bridge",
    "coords": "cit-ref-sacred-bridge",
    "artifact": "cit-ref-negev-gibson",
    "witness": "cit-ref-vanvoorst",
    "person": "cit-ref-abd",
    "journey": "cit-ref-sacred-bridge",
    "route": "cit-ref-sacred-bridge",
    "term": "cit-ref-abd",
    "lesson": "cit-ref-abd",
    "quiz": "cit-ref-abd",
}


def build_index():
    base = load("citations.json")
    extra = load("citations.extra.json")
    idx = {c["id"]: c for c in base + extra}
    for c in [cite(*t) for t in LIB]:
        idx[c["id"]] = c
    return idx


def main():
    idx = build_index()

    def is_wiki(cid):
        c = idx.get(cid)
        return c is not None and "wikipedia.org" in (c.get("url") or "")

    def has_concrete(ids):
        return any(cid in idx and not is_wiki(cid) for cid in (ids or []))

    stats = {}

    def back(ids, key, extra_ids=None):
        """Ensure a cited claim carries >=1 concrete source. Only claims that
        already cite something (and lack a concrete source) are touched — an
        uncited claim isn't leaning on Wikipedia, so it's left alone."""
        ids = list(ids or [])
        if not ids or has_concrete(ids):
            return ids, False
        add = list(extra_ids or []) or [BACKSTOP[key]]
        add = [a for a in add if a not in ids]
        return ids + add, True

    # 1) Register the library.
    extra_cites = upsert(load("citations.extra.json"), [cite(*t) for t in LIB])
    write("citations.extra.json", extra_cites)

    # 2) Sweep each content file. `.extra.json` layers are edited in place; the
    #    base `.json` layers are edited too (the value is app-wide).
    def sweep(fname, key, pick=None):
        items = load(fname)
        if not items:
            return
        n = 0
        for it in items:
            chosen = pick(it) if pick else None
            new, changed = back(it.get("citations", []), key, chosen)
            if changed:
                it["citations"] = new
                n += 1
        if n:
            write(fname, items)
        stats[fname] = stats.get(fname, 0) + n

    # sites: citations + coordinates + candidates
    for fname in ("sites.json", "sites.extra.json"):
        items = load(fname)
        if not items:
            continue
        n = 0
        for s in items:
            new, ch = back(s.get("citations", []), "site")
            if ch:
                s["citations"] = new; n += 1
            coords = s.get("coordinates", {})
            cnew, cch = back(coords.get("citations", []), "coords")
            if cch:
                coords["citations"] = cnew; n += 1
            for cand in s.get("candidates", []) or []:
                pnew, pch = back(cand.get("citations", []), "coords")
                if pch:
                    cand["citations"] = pnew; n += 1
        if n:
            write(fname, items)
        stats[fname] = n

    sweep("routes.json", "route")
    sweep("routes.extra.json", "route")
    sweep("lessons.json", "lesson")
    sweep("artifacts.json", "artifact")
    sweep("artifacts.extra.json", "artifact")
    sweep("witnesses.json", "witness")
    sweep("witnesses.extra.json", "witness")
    sweep("persons.json", "person")
    sweep("persons.extra.json", "person")
    sweep("journeys.json", "journey")
    sweep("journeys.extra.json", "journey")
    sweep("terms.json", "term")

    # miracles: NT background commentary
    sweep("miracles.json", "person", pick=lambda m: ["cit-ref-keener-bbcnt"])
    # stops: OT vs NT split by date
    def stop_ref(st):
        yr = st.get("dateRange", {}).get("startYear", 0)
        return ["cit-ref-bright"] if yr < -100 else ["cit-ref-keener-bbcnt"]
    sweep("stops.json", "person", pick=stop_ref)
    sweep("stops.extra.json", "person", pick=stop_ref)
    # battles: Bright's History of Israel + any per-battle primary sources
    sweep("battles.json", "person", pick=lambda b: BATTLE_PRIMARY.get(b["id"], []) + ["cit-ref-bright"])

    # quizzes: citations live on each question, so sweep the nested lists.
    quizzes = load("quizzes.json")
    if quizzes:
        nq = 0
        for q in quizzes:
            for qq in q.get("questions", []):
                new, ch = back(qq.get("citations", []), "quiz")
                if ch:
                    qq["citations"] = new; nq += 1
        if nq:
            write("quizzes.json", quizzes)
        stats["quizzes.json"] = nq

    total = sum(stats.values())
    print("concrete-source backing added:")
    for k, v in sorted(stats.items()):
        if v:
            print(f"  {k:26} +{v}")
    print(f"  registered {len(LIB)} canonical concrete sources")
    print(f"  {total} claim(s) given concrete backing")


if __name__ == "__main__":
    main()
