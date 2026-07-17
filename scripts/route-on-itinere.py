#!/usr/bin/env python3
"""Snap every LAND leg of every journey to the Itiner-e road network — the
high-resolution open dataset of Roman-empire roads (de Soto, Pažout, Brughmans
et al. 2025, Scientific Data; CC BY 4.0; DOI 10.5281/zenodo.17122148) — via
shortest-path routing, upgrading the curated map-resolution corridors to
surveyed road geometry.

Run AFTER gen-route-paths.py (which writes the curated baseline):

    python3 scripts/gen-route-paths.py
    python3 scripts/route-on-itinere.py /path/to/itinere_roads.geojson

For each land/turnaround leg: find the nearest network nodes to the two stops,
A* the shortest path, and accept it when the network genuinely serves the leg
(both stops within SNAP_KM of the network and path length sane vs. the
great-circle). Accepted legs get [stopA] + road geometry + [stopB] — endpoints
stay EXACT stop coordinates. Legs the network cannot serve (sea lanes,
pre-Roman Mesopotamia, the Sinai wilderness) keep their curated corridor.
Output geometry is Douglas-Peucker-simplified to ~50 m — GPS-scale display
precision — and the whole run reports exactly which legs were upgraded.
"""
import heapq
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "content")
BBOX = (-12.0, 22.0, 50.0, 48.0)  # keep in sync with WORLD_BBOX
SNAP_KM = 20.0        # a stop must be this close to the network to route (tells sit off the line)
NODE_GRID = 0.0015    # ~160 m endpoint-merge grid: closes digitization gaps at junctions
SIMPLIFY_EPS = 0.0005  # ~55 m output simplification
MAX_DETOUR = 2.8      # reject paths longer than this × great-circle (+ slack)


def load(name):
    p = os.path.join(C, name)
    return json.load(open(p)) if os.path.exists(p) else []


def hav(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def dp(pts, eps):
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    denom = math.hypot(dx, dy) or 1e-12
    dmax, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dx * (ay - py) - (ax - px) * dy) / denom
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return dp(pts[: idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [pts[0], pts[-1]]


# Itiner-e ships in EPSG:3395 (World Mercator on the WGS84 ellipsoid, meters,
# with an elevation third coordinate). Inverse-project to lon/lat.
_A = 6378137.0
_E = 0.0818191908426215


def merc_inv(x, y):
    lon = math.degrees(x / _A)
    t = math.exp(-y / _A)
    phi = math.pi / 2 - 2 * math.atan(t)
    for _ in range(6):
        es = _E * math.sin(phi)
        phi = math.pi / 2 - 2 * math.atan(t * ((1 - es) / (1 + es)) ** (_E / 2))
    return lon, math.degrees(phi)


def build_graph(geojson_path):
    print("loading network …", flush=True)
    data = json.load(open(geojson_path))
    W, S, E, N = BBOX
    nid = {}          # grid key -> node id
    npos = []         # node id -> (lon, lat)
    adj = {}          # node id -> list[(other, km, edge_geom_forward)]

    def node(pt):
        key = (round(pt[0] / NODE_GRID), round(pt[1] / NODE_GRID))
        i = nid.get(key)
        if i is None:
            i = len(npos)
            nid[key] = i
            npos.append((pt[0], pt[1]))
        return i

    edges = 0
    for f in data["features"]:
        g = f["geometry"]
        parts = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for part in parts:
            pts = [merc_inv(p[0], p[1]) for p in part]
            if not any(W <= p[0] <= E and S <= p[1] <= N for p in pts):
                continue
            pts = dp(pts, 0.0002)  # trim redundant vertices, keep ~20 m fidelity
            if len(pts) < 2:
                continue
            a, b = node(pts[0]), node(pts[-1])
            if a == b:
                continue
            km = sum(hav(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
            adj.setdefault(a, []).append((b, km, pts))
            adj.setdefault(b, []).append((a, km, pts[::-1]))
            edges += 1
    print(f"network: {len(npos)} nodes · {edges} edges (clipped to bbox)")
    return npos, adj


def nearest_node(npos, pt, max_km):
    best, bestd = None, max_km
    for i, p in enumerate(npos):
        # cheap prefilter, then exact
        if abs(p[0] - pt[0]) > 0.35 or abs(p[1] - pt[1]) > 0.25:
            continue
        d = hav(p, pt)
        if d < bestd:
            best, bestd = i, d
    return best, bestd


def astar(npos, adj, start, goal):
    open_q = [(0.0, start)]
    gscore = {start: 0.0}
    came = {}
    while open_q:
        _, cur = heapq.heappop(open_q)
        if cur == goal:
            # reconstruct edge geometry
            path = []
            while cur in came:
                prev, geom = came[cur]
                path = geom + path[1:] if not path else geom[:-1] + path
                cur = prev
            return path, gscore[goal]
        for nxt, km, geom in adj.get(cur, ()):  # noqa: B905
            ng = gscore[cur] + km
            if ng < gscore.get(nxt, float("inf")):
                gscore[nxt] = ng
                came[nxt] = (cur, geom)
                heapq.heappush(open_q, (ng + hav(npos[nxt], npos[goal]), nxt))
    return None, None


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: route-on-itinere.py /path/to/itinere_roads.geojson")
    npos, adj = build_graph(sys.argv[1])

    sites = {s["id"]: s for s in load("sites.json") + load("sites.extra.json")}
    stops = {s["id"]: s for s in load("stops.json") + load("stops.extra.json")}
    journeys = {j["id"]: j for j in load("journeys.json") + load("journeys.extra.json")}
    routes = load("routes.extra.json")

    upgraded, kept = 0, 0
    for r in routes:
        j = journeys[r["journeyId"]]
        seq = [stops[sid] for sid in j["stops"]]
        for k, (a, b) in enumerate(zip(seq, seq[1:])):
            if b.get("legMode") == "sea":
                kept += 1
                continue
            ca = sites[a["siteId"]]["coordinates"]["value"]
            cb = sites[b["siteId"]]["coordinates"]["value"]
            pa, pb = (ca["lon"], ca["lat"]), (cb["lon"], cb["lat"])
            gc = hav(pa, pb)
            if gc < 2.0:
                kept += 1
                continue  # intra-city hops: straight is already exact enough
            na, da = nearest_node(npos, pa, SNAP_KM)
            nb, db = nearest_node(npos, pb, SNAP_KM)
            if na is None or nb is None or na == nb:
                kept += 1
                print(f"  keep (off-network): {a['siteId']} -> {b['siteId']} (snap {da if da else '∞'}/{db if db else '∞'} km)")
                continue
            geom, km = astar(npos, adj, na, nb)
            if geom is None or km > gc * MAX_DETOUR + 60:
                kept += 1
                print(f"  keep ({'no path' if geom is None else f'detour {km:.0f} vs gc {gc:.0f} km'}): {a['siteId']} -> {b['siteId']}")
                continue
            leg = [pa] + geom + [pb]
            leg = dp(leg, SIMPLIFY_EPS)
            r["legs"][k] = [[round(x, 4), round(y, 4)] for x, y in leg]
            upgraded += 1
        # Mark the upgrade in the route's note + citations.
        if "cit-route-itinere" not in r["citations"]:
            r["citations"].append("cit-route-itinere")
        base = r["note"]["en"].split(" Land legs snapped")[0]
        r["note"]["en"] = base + " Land legs snapped to the Itiner-e digital road network of the Roman Empire where covered; sea lanes and pre-Roman stretches remain reconstructions."

    cits = load("citations.extra.json")
    if not any(c["id"] == "cit-route-itinere" for c in cits):
        cits.append({
            "id": "cit-route-itinere",
            "source": {"en": "Itiner-e: A high-resolution dataset of roads of the Roman Empire (de Soto, Pažout, Brughmans et al., Scientific Data 2025; CC BY 4.0)"},
            "url": "https://doi.org/10.5281/zenodo.17122148",
            "kind": "gazetteer",
        })
        with open(os.path.join(C, "citations.extra.json"), "w") as f:
            json.dump(cits, f, ensure_ascii=False, indent=2)
            f.write("\n")

    with open(os.path.join(C, "routes.extra.json"), "w") as f:
        json.dump(routes, f, ensure_ascii=False, indent=1)
        f.write("\n")
    pts = sum(len(leg) for r in routes for leg in r["legs"])
    print(f"\nupgraded {upgraded} land legs to Itiner-e geometry · {kept} kept (sea/curated/off-network) · {pts} total points")


if __name__ == "__main__":
    main()
