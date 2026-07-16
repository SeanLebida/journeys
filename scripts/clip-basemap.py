#!/usr/bin/env python3
"""Regenerate the offline Natural Earth basemap layers, clipped + simplified to
WORLD_BBOX, into src/map/basemap/{land,lakes,rivers,countries}.json.

Reproducible replacement for the earlier one-off `mapshaper` recipe (see
learnings/2026-07-15-map-water-layers-and-shared-layer-panel.md). Pure stdlib —
Sutherland–Hodgman polygon clip + Cohen–Sutherland line clip + Douglas–Peucker
simplify — so it runs anywhere without npm/mapshaper/shapely.

The bbox is widened from the NT Mediterranean to the whole biblical stage
(Mesopotamia → Egypt → Sinai) so Old-Testament sites (Ur, Haran, Babylon,
Sinai, Kadesh) sit on real land, not empty sea.

Usage: python3 scripts/clip-basemap.py
"""
import json
import os
import urllib.request

# Keep in sync with WORLD_BBOX in src/map/graticule.ts.
BBOX = (-12.0, 22.0, 50.0, 48.0)  # west, south, east, north
PRECISION = 3
SIMPLIFY_EPS = 0.015  # degrees; matches the ~small, coarse existing files
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "map", "basemap")
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
# 50m is the detail/size sweet spot for a regional view; filtered to the bbox it
# stays in the tens-of-KB range like the files it replaces.
SOURCES = {
    "land": "ne_50m_land.geojson",
    "lakes": "ne_50m_lakes.geojson",
    "rivers": "ne_50m_rivers_lake_centerlines.geojson",
    "countries": "ne_50m_admin_0_boundary_lines_land.geojson",
}
W, S, E, N = BBOX


def fetch(name):
    url = f"{BASE}/{SOURCES[name]}"
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


# ── Sutherland–Hodgman polygon clip against the bbox rectangle ──────────────
def _clip_edge(pts, inside, intersect):
    out = []
    if not pts:
        return out
    prev = pts[-1]
    prev_in = inside(prev)
    for cur in pts:
        cur_in = inside(cur)
        if cur_in:
            if not prev_in:
                out.append(intersect(prev, cur))
            out.append(cur)
        elif prev_in:
            out.append(intersect(prev, cur))
        prev, prev_in = cur, cur_in
    return out


def clip_ring(ring):
    def isect(a, b, t):
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

    pts = ring
    pts = _clip_edge(pts, lambda p: p[0] >= W, lambda a, b: isect(a, b, (W - a[0]) / (b[0] - a[0])))
    pts = _clip_edge(pts, lambda p: p[0] <= E, lambda a, b: isect(a, b, (E - a[0]) / (b[0] - a[0])))
    pts = _clip_edge(pts, lambda p: p[1] >= S, lambda a, b: isect(a, b, (S - a[1]) / (b[1] - a[1])))
    pts = _clip_edge(pts, lambda p: p[1] <= N, lambda a, b: isect(a, b, (N - a[1]) / (b[1] - a[1])))
    return pts


# ── Cohen–Sutherland segment clip for line features ─────────────────────────
def _code(x, y):
    c = 0
    if x < W:
        c |= 1
    elif x > E:
        c |= 2
    if y < S:
        c |= 4
    elif y > N:
        c |= 8
    return c


def clip_segment(p0, p1):
    x0, y0 = p0
    x1, y1 = p1
    c0, c1 = _code(x0, y0), _code(x1, y1)
    while True:
        if not (c0 | c1):
            return [[x0, y0], [x1, y1]]
        if c0 & c1:
            return None
        c = c0 or c1
        if c & 8:
            x = x0 + (x1 - x0) * (N - y0) / (y1 - y0); y = N
        elif c & 4:
            x = x0 + (x1 - x0) * (S - y0) / (y1 - y0); y = S
        elif c & 2:
            y = y0 + (y1 - y0) * (E - x0) / (x1 - x0); x = E
        else:
            y = y0 + (y1 - y0) * (W - x0) / (x1 - x0); x = W
        if c == c0:
            x0, y0, c0 = x, y, _code(x, y)
        else:
            x1, y1, c1 = x, y, _code(x, y)


def clip_line(coords):
    """Return a list of contiguous polylines after clipping to the bbox."""
    parts, cur = [], []
    for a, b in zip(coords, coords[1:]):
        seg = clip_segment(a, b)
        if seg is None:
            if len(cur) >= 2:
                parts.append(cur)
            cur = []
            continue
        if not cur:
            cur = [seg[0], seg[1]]
        elif cur[-1] == seg[0]:
            cur.append(seg[1])
        else:
            if len(cur) >= 2:
                parts.append(cur)
            cur = [seg[0], seg[1]]
    if len(cur) >= 2:
        parts.append(cur)
    return parts


# ── Douglas–Peucker simplify ────────────────────────────────────────────────
def _dp(pts, eps):
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    denom = (dx * dx + dy * dy) ** 0.5 or 1e-12
    dmax, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dx * (ay - py) - (ax - px) * dy) / denom
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return _dp(pts[: idx + 1], eps)[:-1] + _dp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def _dp_ring(pts, eps):
    """Douglas–Peucker for a CLOSED ring. Plain DP degenerates when the ring's
    first == last vertex (zero-length baseline collapses everything to 2 pts),
    so split the ring at its farthest vertex from pts[0] into two open chains."""
    if len(pts) < 5:
        return pts
    a = pts[0]
    far = max(range(1, len(pts) - 1), key=lambda i: (pts[i][0] - a[0]) ** 2 + (pts[i][1] - a[1]) ** 2)
    return _dp(pts[: far + 1], eps)[:-1] + _dp(pts[far:], eps)


def rnd(pts):
    return [[round(x, PRECISION), round(y, PRECISION)] for x, y in pts]


def process_polygons(gj):
    feats = []
    for f in gj["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        out_polys = []
        for poly in polys:
            rings = []
            for ring in poly:
                clipped = clip_ring(ring)
                if len(clipped) >= 4:
                    # A ring is closed only if clipping left it closed (islands
                    # fully inside the bbox); continents cut by the bbox are open.
                    simp = _dp_ring(clipped, SIMPLIFY_EPS) if clipped[0] == clipped[-1] else _dp(clipped, SIMPLIFY_EPS)
                    rings.append(rnd(simp))
            if rings and len(rings[0]) >= 4:
                out_polys.append(rings)
        if out_polys:
            feats.append({"type": "Feature", "properties": {},
                          "geometry": {"type": "MultiPolygon", "coordinates": out_polys}})
    return {"type": "FeatureCollection", "features": feats}


def process_lines(gj):
    feats = []
    for f in gj["features"]:
        g = f["geometry"]
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for line in lines:
            for part in clip_line(line):
                simplified = rnd(_dp(part, SIMPLIFY_EPS))
                if len(simplified) >= 2:
                    feats.append({"type": "Feature", "properties": {},
                                  "geometry": {"type": "LineString", "coordinates": simplified}})
    return {"type": "FeatureCollection", "features": feats}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, is_poly in [("land", True), ("lakes", True), ("rivers", False), ("countries", False)]:
        gj = fetch(name)
        out = process_polygons(gj) if is_poly else process_lines(gj)
        path = os.path.join(OUT, f"{name}.json")
        with open(path, "w") as fh:
            json.dump(out, fh, separators=(",", ":"))
        print(f"{name:10} {len(out['features']):4} features  {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    main()
