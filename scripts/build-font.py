"""Rebuild skills/penciled/fonts/caveat.woff2 and caveat-metrics.json.

Dev-only; needs `pip install fonttools brotli`. Input is the variable
Caveat[wght].ttf from https://github.com/google/fonts/tree/main/ofl/caveat
Usage: python scripts/build-font.py path/to/Caveat[wght].ttf
"""
import json
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [
    0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2190, 0x2192, 0x2022,
]

font = instantiateVariableFont(TTFont(sys.argv[1]), {"wght": 500})
opts = Options()
opts.flavor = "woff2"
opts.layout_features = ["kern", "liga", "calt"]
sub = Subsetter(opts)
sub.populate(unicodes=UNICODES)
sub.subset(font)
font.flavor = "woff2"
font.save("skills/penciled/fonts/caveat.woff2")

cmap, hmtx = font.getBestCmap(), font["hmtx"]
metrics = {
    "unitsPerEm": font["head"].unitsPerEm,
    "ascender": font["hhea"].ascent,
    "descender": font["hhea"].descent,
    "advance": {str(cp): hmtx[g][0] for cp, g in sorted(cmap.items())},
}
with open("skills/penciled/fonts/caveat-metrics.json", "w") as f:
    json.dump(metrics, f, separators=(",", ":"))
