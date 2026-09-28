#!/usr/bin/env python3
"""Generate self-hosted SDF glyph ranges (.pbf) for the MapLibre style into
public/fonts/<Fontstack>/<start>-<end>.pbf.

The app ships Ubuntu as its UI face (public/fonts/ubuntu-*.woff2); this emits the
matching map-label glyphs so symbol layers work with no network and no API key,
which the remote-glyph services all require. Pure stdlib + freetype-py + numpy —
no fontnik/node-gyp native build, matching the other scripts here.

The SDF is TinySDF/fontnik-compatible (size 24, buffer 3, radius 8, cutoff 0.25)
and the protobuf is written by hand against MapLibre's reader, which is the
authority on the wire format (node_modules/maplibre-gl, `readGlyph`):

  message glyph { uint32 id=1; bytes bitmap=2; uint32 width=3; uint32 height=4;
                  sint32 left=5; sint32 top=6; uint32 advance=7; }
  message fontstack { string name=1; string range=2; repeated glyph glyphs=3; }
  message glyphs { repeated fontstack stacks=1; }

`width`/`height` are the ink box WITHOUT the border; `bitmap` is
(width + 2*BORDER) * (height + 2*BORDER) bytes. MapLibre hardcodes BORDER = 3 —
it is not carried on the wire, so it must not be changed here.

Setup:  pip install freetype-py numpy
Usage:  python3 scripts/build-glyphs.py
"""
import os
import sys
import urllib.request

try:
    import freetype
    import numpy as np
except ImportError:  # pragma: no cover - operator-facing guidance
    sys.exit("missing deps: pip install freetype-py numpy")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "fonts")
CACHE = os.path.join(ROOT, "scratch", "fonts-src")

# SDF parameters. FONT_SIZE/BUFFER/RADIUS/CUTOFF are the values every existing
# Mapbox/MapLibre glyph pipeline uses; the shader assumes them, so they are a
# fixed contract rather than tunables.
FONT_SIZE = 24
BORDER = 3
RADIUS = 8.0
CUTOFF = 0.25

# Upstream is the Ubuntu Font Licence 1.0 release in google/fonts, pinned to a
# commit so a rebuild is byte-reproducible. UFL 1.0 permits redistribution of
# the fonts and of derived works such as these glyph atlases.
FONTS_COMMIT = "4c1746968e564f687b4fd72af187597a4a6f11fe"
FONTS_BASE = f"https://raw.githubusercontent.com/google/fonts/{FONTS_COMMIT}/ufl/ubuntu"

# Fontstack name -> source TTF. The names are what a style's `text-font` must
# list, and they mirror the ubuntu-400/500/700 weights the UI already ships.
STACKS = {
    "Ubuntu Regular": "Ubuntu-Regular.ttf",
    "Ubuntu Medium": "Ubuntu-Medium.ttf",
    "Ubuntu Bold": "Ubuntu-Bold.ttf",
}

# Unicode ranges worth emitting: Latin (+ extensions and diacritics), Greek and
# Cyrillic — the scripts Ubuntu actually covers and that Mediterranean/biblical
# place names need. A range file is only written if the face has a glyph in it.
# Hebrew is deliberately absent: Ubuntu has no Hebrew coverage.
RANGE_STARTS = [0, 256, 512, 768, 1024, 1280, 7680, 7936, 8192, 8448]


def fetch(filename):
    """Download a source TTF into scratch/, reusing the cached copy."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, filename)
    if not os.path.exists(path):
        url = f"{FONTS_BASE}/{filename}"
        print(f"fetch {url}")
        with urllib.request.urlopen(url) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


# --- Felzenszwalb exact euclidean distance transform (TinySDF's `edt`) --------
# Operates on squared distances; INF marks "no seed in this row/column".
INF = 1e20


def _edt1d(f):
    """1-D squared EDT of `f` (Felzenszwalb & Huttenlocher 2012), in place."""
    n = len(f)
    v = np.zeros(n, dtype=np.int64)
    z = np.zeros(n + 1, dtype=np.float64)
    d = np.zeros(n, dtype=np.float64)
    k = 0
    v[0] = 0
    z[0] = -INF
    z[1] = INF
    for q in range(1, n):
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
        while s <= z[k]:
            k -= 1
            s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
        k += 1
        v[k] = q
        z[k] = s
        z[k + 1] = INF
    k = 0
    for q in range(n):
        while z[k + 1] < q:
            k += 1
        r = v[k]
        d[q] = f[r] + (q - r) * (q - r)
    return d


def _edt2d(grid):
    """2-D squared EDT: separable, columns then rows."""
    h, w = grid.shape
    for x in range(w):
        grid[:, x] = _edt1d(grid[:, x])
    for y in range(h):
        grid[y, :] = _edt1d(grid[y, :])
    return grid


def make_sdf(alpha):
    """Convert an 8-bit coverage bitmap (already padded by BORDER) to an SDF.

    Mirrors TinySDF: distance is measured from the alpha=0.5 isoline, signed
    positive outside the glyph, then mapped through RADIUS/CUTOFF into a byte
    where 0.75*255 sits on the outline. Anti-aliased edge pixels seed the
    transform at sub-pixel offsets, which is what keeps small text smooth.
    """
    a = alpha.astype(np.float64) / 255.0
    outer = np.where(a == 1.0, 0.0, np.where(a == 0.0, INF, np.maximum(0.0, 0.5 - a) ** 2))
    inner = np.where(a == 1.0, INF, np.where(a == 0.0, 0.0, np.maximum(0.0, a - 0.5) ** 2))
    d = np.sqrt(_edt2d(outer)) - np.sqrt(_edt2d(inner))
    return np.clip(np.round(255.0 - 255.0 * (d / RADIUS + CUTOFF)), 0, 255).astype(np.uint8)


# --- minimal protobuf writer -------------------------------------------------

def _varint(value):
    out = bytearray()
    while True:
        b = value & 0x7F
        value >>= 7
        out.append(b | (0x80 if value else 0))
        if not value:
            return bytes(out)


def _zigzag(value):
    return (value << 1) ^ (value >> 31)


def _tag(field, wire):
    return _varint((field << 3) | wire)


def _uint(field, value):
    return _tag(field, 0) + _varint(value)


def _sint(field, value):
    return _tag(field, 0) + _varint(_zigzag(value))


def _bytes(field, value):
    return _tag(field, 2) + _varint(len(value)) + value


def encode_glyph(codepoint, bitmap, width, height, left, top, advance):
    body = _uint(1, codepoint)
    if bitmap is not None:
        body += _bytes(2, bitmap)
    body += _uint(3, width) + _uint(4, height)
    body += _sint(5, left) + _sint(6, top)
    body += _uint(7, advance)
    return _bytes(3, body)


def encode_fontstack(name, range_label, glyph_blobs):
    body = _bytes(1, name.encode()) + _bytes(2, range_label.encode()) + b"".join(glyph_blobs)
    return _bytes(1, body)


# --- glyph rendering ---------------------------------------------------------

def render_range(face, start, end):
    """Render one 256-codepoint range; returns encoded glyph messages."""
    blobs = []
    for cp in range(start, end + 1):
        if face.get_char_index(cp) == 0:
            continue
        face.load_char(cp, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_NO_HINTING)
        slot = face.glyph
        bmp = slot.bitmap
        advance = round(slot.metrics.horiAdvance / 64.0)
        w, h = bmp.width, bmp.rows
        if w == 0 or h == 0:
            # Whitespace: no raster, but the advance still has to be carried.
            blobs.append(encode_glyph(cp, None, 0, 0, 0, 0, advance))
            continue
        # FreeType rows are `pitch` bytes wide, which may exceed `width`.
        rows = np.frombuffer(bytes(bmp.buffer), dtype=np.uint8).reshape(h, bmp.pitch)
        padded = np.zeros((h + 2 * BORDER, w + 2 * BORDER), dtype=np.uint8)
        padded[BORDER:BORDER + h, BORDER:BORDER + w] = rows[:, :w]
        sdf = make_sdf(padded)
        blobs.append(
            encode_glyph(cp, sdf.tobytes(), w, h, slot.bitmap_left, slot.bitmap_top, advance)
        )
    return blobs


def build_stack(name, ttf_path):
    face = freetype.Face(ttf_path)
    face.set_pixel_sizes(0, FONT_SIZE)
    out_dir = os.path.join(OUT, name)
    os.makedirs(out_dir, exist_ok=True)
    written = 0
    for start in RANGE_STARTS:
        end = start + 255
        blobs = render_range(face, start, end)
        if not blobs:
            continue
        label = f"{start}-{end}"
        payload = encode_fontstack(name, label, blobs)
        with open(os.path.join(out_dir, f"{label}.pbf"), "wb") as f:
            f.write(payload)
        written += 1
        print(f"  {name}/{label}.pbf  ({len(blobs)} glyphs, {len(payload)} bytes)")
    return written


def main():
    total = 0
    for name, filename in STACKS.items():
        print(name)
        total += build_stack(name, fetch(filename))
    print(f"wrote {total} range files under {OUT}")


if __name__ == "__main__":
    main()
