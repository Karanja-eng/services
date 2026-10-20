#!/usr/bin/env python3
"""
SECTION X-X — V-drain, invert block, dual channels, half-battered kerb.

Units: millimetres
Origin: top-left of V-drain at left G.L.  X right, Y up.

Printed (from paving5.png):
  2000 / 500 / 1200 chain, drain depth 750, slabs 600x225x75,
  350mm phi invert, 50mm bitumen premix, 200mm hardcore,
  125x100 channel, 125x50 kerb (250 overall, 50 upstand),
  150mm conc 1:3:6, backing 100mm.

Interpreted from the scan + user corrections:
  Invert = 350x350 square with 350 phi semicircle cut in the top.
  In-situ concrete haunch under both slope slabs.
  Channels on BOTH edges of the 1200 pavement.
  Kerb is half-battered: 125 base, 50 top, 250 high, 50 upstand.
  Component labels sit ABOVE the drawing with leader arrows.
"""

from __future__ import annotations

import math
from pathlib import Path

# ---------------------------------------------------------------------------
# Geometry (mm)
# ---------------------------------------------------------------------------
DRAIN_TOP = 2000
GAP = 500
PAVE = 1200
GL = 0
DRAIN_DEPTH = 750
INVERT_DIA = 350
INVERT_R = INVERT_DIA / 2
INVERT_SQ = 350
SLAB_T = 75
HAUNCH = 140

CHAN_W, CHAN_H = 125, 100
KERB_BASE, KERB_TOP, KERB_H = 125, 50, 250
UPSTAND = 50
BACKING = 100
BED_TH, BED_W, BED_STEP = 150, 450, 100
BM, HC, MURRAM = 50, 200, 200
PAVE_STACK = BM + HC + MURRAM  # 450

X_DRAIN_L = 0
X_DRAIN_R = DRAIN_TOP
X_PAVE_L = DRAIN_TOP + GAP  # 2500
X_PAVE_R = X_PAVE_L + PAVE  # 3700
CX = DRAIN_TOP / 2

INV_L = CX - INVERT_SQ / 2  # 825
INV_R = CX + INVERT_SQ / 2  # 1175
INV_B = -DRAIN_DEPTH        # -750
INV_T = INV_B + INVERT_SQ   # -400
INV_INVERT_Y = INV_T - INVERT_R  # -575


def _n_left():
    dx, dy = INV_L - X_DRAIN_L, INV_T - GL
    ln = math.hypot(dx, dy)
    return dy / ln, -dx / ln  # outward (earth)


def _n_right():
    dx, dy = INV_R - X_DRAIN_R, INV_T - GL
    ln = math.hypot(dx, dy)
    return -dy / ln, dx / ln


NLX, NLY = _n_left()
NRX, NRY = _n_right()

LEFT_INNER = [(X_DRAIN_L, GL), (INV_L, INV_T)]
LEFT_OUTER = [(X_DRAIN_L + NLX * SLAB_T, GL), (INV_L + NLX * SLAB_T, INV_T)]
RIGHT_INNER = [(X_DRAIN_R, GL), (INV_R, INV_T)]
RIGHT_OUTER = [(X_DRAIN_R + NRX * SLAB_T, GL), (INV_R + NRX * SLAB_T, INV_T)]

LEFT_SLAB = [LEFT_INNER[0], LEFT_INNER[1], LEFT_OUTER[1], (LEFT_OUTER[0][0], GL)]
RIGHT_SLAB = [RIGHT_INNER[0], RIGHT_INNER[1], RIGHT_OUTER[1], (RIGHT_OUTER[0][0], GL)]

LEFT_HAUNCH = [
    (LEFT_OUTER[0][0], GL),
    (LEFT_OUTER[0][0] + NLX * HAUNCH, GL),
    (INV_L + NLX * (SLAB_T + HAUNCH), INV_T),
    (INV_L, INV_T),
    LEFT_OUTER[1],
]
RIGHT_HAUNCH = [
    (RIGHT_OUTER[0][0], GL),
    (RIGHT_OUTER[0][0] + NRX * HAUNCH, GL),
    (INV_R + NRX * (SLAB_T + HAUNCH), INV_T),
    (INV_R, INV_T),
    RIGHT_OUTER[1],
]
INVERT_SQUARE = [(INV_L, INV_T), (INV_R, INV_T), (INV_R, INV_B), (INV_L, INV_B)]

PAVE_TOP = GL - UPSTAND  # -50
XL_CHAN, XL_CHAN_R = X_PAVE_L, X_PAVE_L + CHAN_W
XR_CHAN = X_PAVE_R - KERB_BASE - CHAN_W
XR_CHAN_R = X_PAVE_R - KERB_BASE
X_KERB, X_KERB_R = XR_CHAN_R, X_PAVE_R
X_BACK_R = X_PAVE_R + BACKING


def channel(x0):
    t, b, dish, dw = PAVE_TOP, PAVE_TOP - CHAN_H, 40, 90
    mid = x0 + CHAN_W / 2
    return [
        (x0, t), (mid - dw / 2, t), (mid, t - dish), (mid + dw / 2, t),
        (x0 + CHAN_W, t), (x0 + CHAN_W, b), (x0, b),
    ]


LEFT_CHAN = channel(XL_CHAN)
RIGHT_CHAN = channel(XR_CHAN)
KERB = [
    (X_KERB, PAVE_TOP),
    (X_KERB, GL - KERB_H),
    (X_KERB_R, GL - KERB_H),
    (X_KERB_R, GL),
    (X_KERB_R - KERB_TOP, GL),
]
BACKING_POLY = [
    (X_KERB_R, GL),
    (X_BACK_R, GL),
    (X_BACK_R, GL - 80),
    (X_KERB_R + BACKING, GL - KERB_H),
    (X_KERB_R, GL - KERB_H),
]
BED_RIGHT = [
    (XR_CHAN - BED_STEP, GL - KERB_H),
    (X_BACK_R, GL - KERB_H),
    (X_BACK_R, GL - KERB_H - BED_TH),
    (XR_CHAN, GL - KERB_H - BED_TH),
    (XR_CHAN - BED_STEP, GL - KERB_H - 40),
]
BED_LEFT = [
    (XL_CHAN - 40, PAVE_TOP - CHAN_H),
    (XL_CHAN_R + 40, PAVE_TOP - CHAN_H),
    (XL_CHAN_R + 40, PAVE_TOP - CHAN_H - BED_TH),
    (XL_CHAN - 40, PAVE_TOP - CHAN_H - BED_TH),
]
BITUMEN = [
    (XL_CHAN_R, PAVE_TOP), (XR_CHAN, PAVE_TOP),
    (XR_CHAN, PAVE_TOP - BM), (XL_CHAN_R, PAVE_TOP - BM),
]
HARDCORE = [
    (XL_CHAN, PAVE_TOP - BM), (X_KERB_R, PAVE_TOP - BM),
    (X_KERB_R, PAVE_TOP - BM - HC), (XL_CHAN, PAVE_TOP - BM - HC),
]
MURRAM_POLY = [
    (XL_CHAN, PAVE_TOP - BM - HC), (X_KERB_R, PAVE_TOP - BM - HC),
    (X_KERB_R, PAVE_TOP - PAVE_STACK), (XL_CHAN, PAVE_TOP - PAVE_STACK),
]

LEADERS = [
    ("PCC slabs size 600x225x75mm", (320, -90), (-40, 780)),
    ("In-situ concrete under slabs", (120, -300), (-40, 640)),
    ("350mm PHI Invert block", (CX, INV_INVERT_Y), (620, 780)),
    ("50mm bitumen premix", ((XL_CHAN_R + XR_CHAN) / 2, PAVE_TOP - BM / 2), (2100, 780)),
    ("125x100mm pcc channel (L)", (XL_CHAN + CHAN_W / 2, PAVE_TOP - 8), (2100, 640)),
    ("125x100mm pcc channel (R)", (XR_CHAN + CHAN_W / 2, PAVE_TOP - 8), (3000, 780)),
    ("125x50 pcc kerb (half-battered)", (X_KERB + 70, -15), (3480, 640)),
    ("concrete backing 100mm thick", (X_KERB_R + 50, -90), (3920, 780)),
]

NOTES = [
    "1. Vegetable soil 150mm to be cart away",
    "2. Site is bushy",
    "3. concrete backing to kerb 100mm thick",
]


# ---------------------------------------------------------------------------
# Minimal DXF writer (no ezdxf required)
# ---------------------------------------------------------------------------
class Dxf:
    def __init__(self):
        self.buf: list[str] = []

    def p(self, code: int, value):
        self.buf.append(f"{code}\n{value}\n")

    def line(self, a, b, layer):
        self.p(0, "LINE"); self.p(8, layer)
        self.p(10, f"{a[0]:.3f}"); self.p(20, f"{a[1]:.3f}"); self.p(30, 0)
        self.p(11, f"{b[0]:.3f}"); self.p(21, f"{b[1]:.3f}"); self.p(31, 0)

    def pline(self, pts, layer, closed=True):
        self.p(0, "LWPOLYLINE"); self.p(8, layer)
        self.p(90, len(pts)); self.p(70, 1 if closed else 0)
        for x, y in pts:
            self.p(10, f"{x:.3f}"); self.p(20, f"{y:.3f}")

    def arc(self, c, r, a0, a1, layer):
        self.p(0, "ARC"); self.p(8, layer)
        self.p(10, f"{c[0]:.3f}"); self.p(20, f"{c[1]:.3f}"); self.p(30, 0)
        self.p(40, f"{r:.3f}"); self.p(50, f"{a0:.3f}"); self.p(51, f"{a1:.3f}")

    def text(self, s, p, h, layer):
        self.p(0, "TEXT"); self.p(8, layer)
        self.p(10, f"{p[0]:.3f}"); self.p(20, f"{p[1]:.3f}"); self.p(30, 0)
        self.p(40, h); self.p(1, s)

    def dim_h(self, x1, x2, y, label):
        self.line((x1, y), (x2, y), "DIMENSIONS")
        self.line((x1, y - 40), (x1, y + 40), "DIMENSIONS")
        self.line((x2, y - 40), (x2, y + 40), "DIMENSIONS")
        self.text(label, ((x1 + x2) / 2 - 50, y - 90), 70, "TEXT")

    def dim_v(self, y1, y2, x, label):
        self.line((x, y1), (x, y2), "DIMENSIONS")
        self.line((x - 40, y1), (x + 40, y1), "DIMENSIONS")
        self.line((x - 40, y2), (x + 40, y2), "DIMENSIONS")
        self.text(label, (x - 170, (y1 + y2) / 2), 70, "TEXT")

    def layer_table(self, layers):
        self.p(0, "TABLE"); self.p(2, "LAYER"); self.p(70, len(layers))
        for name, col in layers:
            self.p(0, "LAYER"); self.p(2, name); self.p(70, 0)
            self.p(62, col); self.p(6, "CONTINUOUS")
        self.p(0, "ENDTAB")


def build() -> str:
    d = Dxf()
    d.p(0, "SECTION"); d.p(2, "HEADER")
    d.p(9, "$INSUNITS"); d.p(70, 4)  # millimetres
    d.p(9, "$ACADVER"); d.p(1, "AC1021")
    d.p(0, "ENDSEC")

    d.p(0, "SECTION"); d.p(2, "TABLES")
    d.layer_table([
        ("SLAB_LINING", 6), ("INVERT_BLOCK", 1), ("CONCRETE", 8),
        ("KERB", 1), ("CHANNEL", 5), ("CONCRETE_BED", 8),
        ("CONCRETE_BACKING", 8), ("BITUMEN", 3), ("HARDCORE", 8),
        ("MURRAM", 8), ("GROUND", 8), ("DIMENSIONS", 1),
        ("TEXT", 7), ("LEADER", 4), ("TITLE", 7),
    ])
    d.p(0, "ENDSEC")

    d.p(0, "SECTION"); d.p(2, "ENTITIES")

    # Ground
    d.line((-400, GL), (0, GL), "GROUND")
    d.line((X_DRAIN_R, GL), (X_PAVE_L, GL), "GROUND")
    d.line((X_BACK_R, GL), (X_BACK_R + 500, GL), "GROUND")
    d.text("G.L.", (-360, 40), 50, "TEXT")
    d.text("G.L.", (X_BACK_R + 180, 40), 50, "TEXT")

    d.pline(LEFT_HAUNCH, "CONCRETE")
    d.pline(RIGHT_HAUNCH, "CONCRETE")
    d.pline(INVERT_SQUARE, "INVERT_BLOCK")
    d.arc((CX, INV_T), INVERT_R, 180, 360, "INVERT_BLOCK")
    d.pline(LEFT_SLAB, "SLAB_LINING")
    d.pline(RIGHT_SLAB, "SLAB_LINING")

    # three-course joints
    for i in (1, 2):
        t = i / 3
        def lerp(a, b, t):
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        d.line(lerp(LEFT_INNER[0], LEFT_INNER[1], t),
               lerp(LEFT_OUTER[0], LEFT_OUTER[1], t), "SLAB_LINING")
        d.line(lerp(RIGHT_INNER[0], RIGHT_INNER[1], t),
               lerp(RIGHT_OUTER[0], RIGHT_OUTER[1], t), "SLAB_LINING")

    d.pline(MURRAM_POLY, "MURRAM")
    d.pline(HARDCORE, "HARDCORE")
    d.pline(BITUMEN, "BITUMEN")
    d.pline(BED_LEFT, "CONCRETE_BED")
    d.pline(BED_RIGHT, "CONCRETE_BED")
    d.pline(LEFT_CHAN, "CHANNEL")
    d.pline(RIGHT_CHAN, "CHANNEL")
    d.pline(KERB, "KERB")
    d.pline(BACKING_POLY, "CONCRETE_BACKING")

    # Leaders — labels above, arrows down to the item
    for label, anchor, text in LEADERS:
        elbow = (text[0], text[1] - 90)
        d.line(text, elbow, "LEADER")
        d.line(elbow, (anchor[0], elbow[1]), "LEADER")
        d.line((anchor[0], elbow[1]), anchor, "LEADER")
        d.text(label, (text[0], text[1] + 20), 55, "TEXT")

    ydim = INV_B - 140
    d.dim_h(0, 2000, ydim, "2000")
    d.dim_h(2000, 2500, ydim, "500")
    d.dim_h(2500, 3700, ydim, "1200")
    d.dim_v(0, -750, -280, "750")
    d.dim_v(INV_T, INV_INVERT_Y, CX + 210, "175")
    d.dim_v(INV_INVERT_Y, INV_B, INV_L - 80, "175")
    d.dim_h(INV_L, INV_R, INV_B - 90, "350")
    d.dim_v(PAVE_TOP, PAVE_TOP - PAVE_STACK, X_PAVE_L - 180, "450")
    d.dim_v(GL, GL - KERB_H, X_BACK_R + 160, "250")
    d.dim_h(X_KERB, X_BACK_R, GL - KERB_H - BED_TH - 80, "500")
    d.dim_h(XR_CHAN - BED_STEP, XR_CHAN, GL - KERB_H + 40, "100")
    d.dim_h(XR_CHAN, XR_CHAN + BED_W, GL - KERB_H - BED_TH - 80, "450")

    d.text("200mm hardcore filling", (2680, PAVE_TOP - BM - 80), 45, "TEXT")
    d.text("Murram filling", (2680, PAVE_TOP - BM - HC - 80), 45, "TEXT")
    d.text("150mm th. conc (1:3:6)", (XR_CHAN, GL - KERB_H - BED_TH - 40), 45, "TEXT")
    d.text("SECTION X-X", (1400, ydim - 320), 110, "TITLE")
    for i, note in enumerate(NOTES):
        d.text(note, (0, ydim - 480 - i * 90), 50, "TEXT")

    d.p(0, "ENDSEC")
    d.p(0, "EOF")
    return "".join(d.buf)


def main():
    out = Path(__file__).resolve().parent / "section_xx_vdrain.dxf"
    out.write_text(build(), encoding="utf-8")
    print(f"DXF written → {out}")
    print(f"  size {out.stat().st_size} bytes")


if __name__ == "__main__":
    main()
