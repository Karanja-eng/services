"""
Parametric reinforcement-detail generator for IStructE Standard Method of Detailing,
Chapter 6 (6.5 Walls, 6.6 Retaining walls, 6.7 Foundations, 6.8 Stairs).

Pipeline: parameters -> engineering model (rules) -> drawing model (primitives) -> ezdxf -> DXF
Numeric rules come from the manual (see 03_detailing_rules.json ids in comments).
Anything from the General Detailing chapter (dcdev, bend radii, hook sizes, bar-mark grammar)
is a PARAMETER with a clearly labelled placeholder default, NOT taken from this chapter.
Units: mm, drawing scale 1:1 (model units = mm).
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import ezdxf

# ------------------------------------------------------------------ rules
GRADES = ["25/30", "28/35", "30/37", "32/40"]
ANCH = {  # bar diameters; keys: table -> quantity
    "walls":       {"lbd": [40, 37, 36, 34], "l0": [61, 56, 54, 51]},                      # Tables 6.6/6.7 (<=50% lapped)
    "foundations": {"lbd_good": [40, 37, 36, 34], "lbd_poor": [48, 45, 43, 41],
                    "l0_good": [46, 43, 42, 39], "l0_poor": [66, 61, 59, 56]},             # Table 6.9 (<=33%)
    "stairs":      {"lbd_good": [40, 37, 36, 34], "lbd_poor": [58, 53, 51, 49],
                    "l0_good": [46, 43, 42, 39], "l0_poor": [66, 61, 59, 56]},             # Table 6.11
}
MW1 = [  # (t_min, t_max, vdia, vpitch, hdia, hpitch)   [W27] pairing inferred from column order
    (150, 175, 12, 300, 10, 200), (175, 200, 12, 250, 10, 200), (200, 250, 12, 200, 10, 200),
    (250, 300, 16, 300, 10, 200), (300, 400, 16, 250, 12, 200), (400, 500, 16, 200, 12, 150),
    (500, 600, 20, 250, 16, 200), (600, 700, 20, 200, 16, 200), (700, 800, 20, 200, 16, 200)]


def _gi(grade):
    return GRADES.index(grade)


def anchorage_len(dia, grade="28/35", table="walls", bond="good"):
    a = ANCH[table]
    k = a["lbd"] if table == "walls" else a["lbd_" + bond]
    return k[_gi(grade)] * dia


def lap_len(dia, grade="28/35", table="walls", bond="good"):
    a = ANCH[table]
    k = a["l0"] if table == "walls" else a["l0_" + bond]
    return max(k[_gi(grade)] * dia, 15 * dia, 200)          # [W16]


def wall_defaults(t):
    for lo, hi, vd, vp, hd, hp in MW1:
        if lo <= t <= hi:
            return vd, vp, hd, hp
    raise ValueError("wall thickness outside MW1 table (150-800)")


def band_required(lx, cx, d):
    return lx > 1.5 * (cx + 3 * d)                           # [F09]


def stair_A(span, lbd):
    return max(0.1 * span, lbd, 500)                         # MST1 [S07]


# ------------------------------------------------------------------ engineering model
@dataclass
class BarGroup:
    qty: int
    dia: int
    mark: int
    pitch: Optional[int]
    loc: str = ""            # NF FF T B UB ...
    def label(self):         # 'n H dia mark pitch loc'   (form shown in 6.5.4 etc.)
        p = f" {self.pitch}" if self.pitch else ""
        return f"{self.qty} H{self.dia} {self.mark:02d}{p} {self.loc}".strip()


@dataclass
class Wall:
    t: float; L: float; H: float
    grade: str = "28/35"; exposure: str = "internal"
    dcdev: float = 10          # PLACEHOLDER: General chapter 5.2.1
    vdia: Optional[int] = None; vpitch: Optional[int] = None
    hdia: Optional[int] = None; hpitch: Optional[int] = None
    opening: Optional[Tuple[float, float, float, float]] = None   # x, y, w, h from wall bottom-left
    warnings: List[str] = field(default_factory=list)

    def __post_init__(self):
        if self.t < 150:
            self.warnings.append("t<150: not recommended [W02]")
        d = wall_defaults(min(max(self.t, 150), 800))
        self.vdia = self.vdia or d[0]; self.vpitch = self.vpitch or d[1]
        self.hdia = self.hdia or d[2]; self.hpitch = self.hpitch or d[3]
        self.cover = (max(20, self.hdia) if self.exposure == "internal" else 40)   # standard [W05]
        self.check()

    def check(self):
        Ac = self.t * 1000
        As_v = 2 * math.pi * self.vdia ** 2 / 4 * 1000 / self.vpitch      # both faces per m
        if As_v < 0.002 * Ac: self.warnings.append("vertical steel < 0.002Ac [W06]")
        if As_v > 0.04 * Ac: self.warnings.append("vertical steel > 0.04Ac [W10]")
        As_h = math.pi * self.hdia ** 2 / 4 * 1000 / self.hpitch          # per face per m
        # basis ambiguity: '25% of vertical' taken as 25% of the vertical steel in that face; 0.001Ac taken per face
        if As_h < max(0.25 * As_v / 2, 0.001 * Ac):
            self.warnings.append("horizontal steel < max(25% vertical,0.001Ac) per face [W07] (basis ambiguous)")
        if self.vdia < 12: self.warnings.append("vertical dia < 12 [W06]")
        if self.hdia < self.vdia / 4: self.warnings.append("horizontal dia < 1/4 vertical [W07]")
        for p in (self.vpitch, self.hpitch):
            if p > min(3 * self.t, 400): self.warnings.append("pitch > min(3t,400) [W12]")
        if self.opening and self.t < 175: self.warnings.append("trimmed opening needs t>=175 [W21]")
        if As_v > 0.02 * Ac: self.warnings.append("links required (As_v>0.02Ac) [W13]")


# ------------------------------------------------------------------ drawing model helpers
class Sheet:
    def __init__(self):
        self.doc = ezdxf.new("R2010", setup=True)
        self.doc.units = ezdxf.units.MM
        for name, col in [("CONCRETE", 7), ("BAR", 1), ("BAR_LINK", 3), ("BAR_HIDDEN", 8), ("DIM", 5),
                          ("TEXT", 2), ("SYMBOL", 6), ("CENTRE", 4)]:
            self.doc.layers.add(name, color=col)
        self.doc.styles.add("ARCH", font="arial.ttf") if "ARCH" not in self.doc.styles else None
        self.msp = self.doc.modelspace()
        self.th = 40  # text height

    def rect(self, x, y, w, h, layer="CONCRETE"):
        self.msp.add_lwpolyline([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], close=True, dxfattribs={"layer": layer})

    def line(self, p, q, layer="BAR", lw=None):
        self.msp.add_line(p, q, dxfattribs={"layer": layer, **({"lineweight": lw} if lw else {})})

    def poly(self, pts, layer="BAR", lw=35, close=False):
        self.msp.add_lwpolyline(pts, close=close, dxfattribs={"layer": layer, "lineweight": lw})

    def dot(self, x, y, dia, layer="BAR"):
        self.msp.add_circle((x, y), dia / 2, dxfattribs={"layer": layer})
        self.msp.add_circle((x, y), 0.01, dxfattribs={"layer": layer})

    def text(self, s, p, h=None, rot=0, layer="TEXT"):
        self.msp.add_text(s, height=h or self.th, rotation=rot, dxfattribs={"layer": layer}).set_placement(p)

    def callout(self, group: BarGroup, target, label_pt, note=""):
        """leader line from a bar to a label; label = BarGroup.label()"""
        self.line(target, label_pt, "TEXT")
        self.msp.add_circle(target, 8, dxfattribs={"layer": "TEXT"})
        self.text(group.label() + (f" {note}" if note else ""), (label_pt[0] + 10, label_pt[1] + 8))

    def dim(self, p1, p2, offset, text=None):
        d = self.msp.add_linear_dim(base=(p1[0], p1[1] + offset) if p1[1] == p2[1] else (p1[0] + offset, p1[1]),
                                    p1=p1, p2=p2, angle=0 if p1[1] == p2[1] else 90,
                                    override={"dimtxt": self.th, "dimasz": self.th * .6, "dimclrd": 5}, text=text or "<>",
                                    dxfattribs={"layer": "DIM"})
        d.render()

    def level(self, x, y, label):
        self.msp.add_lwpolyline([(x, y), (x + 120, y), (x + 60, y - 100)], close=True, dxfattribs={"layer": "SYMBOL"})
        self.msp.add_hatch(color=6, dxfattribs={"layer": "SYMBOL"}).paths.add_polyline_path(
            [(x, y), (x + 120, y), (x + 60, y - 100)], is_closed=True)
        self.text(label, (x + 150, y - 60))

    def section_marker(self, x, y, n, direction="up"):
        s = 1 if direction == "up" else -1
        self.msp.add_lwpolyline([(x, y), (x + 100, y + 50 * s), (x + 100, y - 50 * s)], close=True, dxfattribs={"layer": "SYMBOL"})
        self.text(str(n), (x + 130, y - 20))

    def save(self, path):
        self.doc.saveas(path)


# ------------------------------------------------------------------ WALL
def create_wall_section(sh: Sheet, w: Wall, origin=(0, 0), length=1200):
    """Plan section through wall thickness: two mats, horizontals outside verticals [W03]."""
    ox, oy = origin; c = w.cover
    sh.rect(ox, oy, length, w.t)
    hy = [oy + c + w.hdia / 2, oy + w.t - c - w.hdia / 2]                     # horizontals (outside)
    vy = [hy[0] + w.hdia / 2 + w.vdia / 2, hy[1] - w.hdia / 2 - w.vdia / 2]  # verticals inside
    for y in hy:
        sh.line((ox + c, y), (ox + length - c, y), "BAR", 50)
    n = int(length // w.vpitch)
    for face, y in zip(("NF", "FF"), vy):
        for i in range(n + 1):
            x = ox + c + i * w.vpitch
            if x < ox + length - c: sh.dot(x, y, w.vdia)
    sh.dim((ox, oy), (ox, oy + w.t), -150)
    sh.text(f"cover {c} to horizontals", (ox + length + 40, oy + w.t / 2))
    sh.callout(BarGroup(n + 1, w.vdia, 1, w.vpitch, "NF"), (ox + c, vy[0]), (ox - 300, oy - 200))
    sh.callout(BarGroup(n + 1, w.hdia, 3, w.hpitch, "NF"), (ox + length / 2, hy[0]), (ox + length + 40, oy - 120))
    sh.text("SECTION THROUGH WALL (plan)", (ox, oy - 320))


def create_wall_elevation(sh: Sheet, w: Wall, origin=(0, 0), levels=(0.0, None)):
    ox, oy = origin
    sh.rect(ox, oy, w.L, w.H)
    c = w.cover
    nv = int((w.L - 2 * c) // w.vpitch) + 1
    for i in range(nv):                                   # near-face verticals (continuous line)
        x = ox + c + i * w.vpitch
        sh.line((x, oy + 75), (x, oy + w.H - c), "BAR", 35)
    nh = int((w.H - 2 * c) // w.hpitch) + 1
    for j in range(nh):
        y = oy + c + j * w.hpitch
        sh.line((ox + c, y), (ox + w.L - c, y), "BAR_HIDDEN", 18)
    # kicker 75 and starter lap [W26]
    sh.line((ox, oy + 75), (ox + w.L, oy + 75), "CENTRE")
    sh.text("kicker 75", (ox + w.L + 30, oy + 60))
    lap = lap_len(w.vdia, w.grade, "walls")
    sh.text(f"compression lap {lap:.0f} + kicker above floor", (ox + w.L + 30, oy + w.H - 80))
    if w.opening:
        x, y, ow, oh = w.opening
        sh.rect(ox + x, oy + y, ow, oh, "CONCRETE")
        create_opening_trimmers(sh, w, (ox + x, oy + y, ow, oh))
    sh.callout(BarGroup(nv, w.vdia, 1, w.vpitch, "NF"), (ox + c, oy + w.H * .5), (ox - 400, oy + w.H * .5))
    sh.callout(BarGroup(nh, w.hdia, 3, w.hpitch, "NF"), (ox + w.L * .5, oy + c), (ox + w.L + 30, oy - 120))
    sh.dim((ox, oy), (ox + w.L, oy), -250)
    sh.dim((ox, oy), (ox, oy + w.H), -250)
    sh.text("ELEVATION", (ox, oy - 400))


def create_opening_trimmers(sh: Sheet, w: Wall, box):
    """[W21/W22] trimmers one size larger, tension anchorage beyond, U-bars = horizontal size."""
    x, y, ow, oh = box
    if ow < w.vpitch and oh < w.hpitch:
        sh.text("opening < pitch: no trimming [W19]", (x, y + oh + 30)); return
    # 'one size larger' -> PROPOSED preferred-size ladder (not from manual)
    tdia = {10: 12, 12: 16, 16: 20, 20: 25, 25: 32}.get(w.vdia, w.vdia)
    la = anchorage_len(tdia, w.grade, "walls")
    off = 40
    for yy in (y - off, y + oh + off):                       # above & below
        sh.line((x - la, yy), (x + ow + la, yy), "BAR", 70)
    for xx in (x - off, x + ow + off):                       # sides
        sh.line((xx, y - la), (xx, y + oh + la), "BAR", 70)
    sh.text(f"trimmers H{tdia} (one size larger), anchorage {la:.0f} beyond", (x, y + oh + 3 * off))


# ------------------------------------------------------------------ RETAINING WALL (cantilever, MRW1)
def create_cantilever_retaining_wall(sh: Sheet, H=3000, t_stem=300, base_L=2200, toe=600, base_t=400,
                                     vdia_earth=16, vpitch=150, hdia=12, hpitch=200, base_dia=16, base_pitch=150,
                                     cover_earth=50, cover_ext=40, cover_base=75, origin=(0, 0), grade="28/35"):
    ox, oy = origin
    outline = [(ox, oy), (ox + base_L, oy), (ox + base_L, oy + base_t), (ox + toe + t_stem, oy + base_t),
               (ox + toe + t_stem, oy + base_t + H), (ox + toe, oy + base_t + H), (ox + toe, oy + base_t), (ox, oy + base_t)]
    sh.poly(outline, "CONCRETE", 50, True)
    sh.line((ox + toe - 20, oy + base_t + 75), (ox + toe + t_stem + 20, oy + base_t + 75), "CENTRE")
    sh.text("kicker 75 (150 below ground) [F17/RW08]", (ox + toe + t_stem + 40, oy + base_t + 60))
    lb = lap_len(vdia_earth, grade, "walls")
    # earth face (right) vertical bar: continues into base with bend to toe side (L-bar)
    xe = ox + toe + t_stem - cover_earth
    sh.poly([(xe, oy + base_t + H - cover_earth), (xe, oy + base_t - 40), (xe, oy + cover_base + base_dia),
             (xe - 8 * vdia_earth - 200, oy + cover_base + base_dia)], "BAR", 50)
    # exposed face bar
    xf = ox + toe + cover_ext
    sh.poly([(xf, oy + base_t + H - cover_ext), (xf, oy + base_t + 75 + lb)], "BAR", 50)
    sh.poly([(xf, oy + base_t + 75 + lb), (xf, oy + base_t - 40), (xf, oy + cover_base + base_dia),
             (xf + 500, oy + cover_base + base_dia)], "BAR", 30)
    # base bars
    sh.line((ox + cover_ext, oy + cover_base), (ox + base_L - cover_ext, oy + cover_base), "BAR", 50)
    sh.line((ox + cover_ext, oy + base_t - cover_ext), (ox + base_L - cover_ext, oy + base_t - cover_ext), "BAR", 35)
    sh.callout(BarGroup(1, vdia_earth, 1, vpitch, "T"), (xe, oy + base_t + H * .6), (ox + base_L + 200, oy + base_t + H * .6))
    sh.callout(BarGroup(1, hdia, 4, hpitch, "NF"), (xf, oy + base_t + H * .3), (ox - 700, oy + base_t + H * .3))
    sh.callout(BarGroup(1, base_dia, 2, base_pitch, "B"), (ox + base_L * .5, oy + cover_base), (ox + base_L + 200, oy - 150))
    sh.text(f"{cover_earth} buried face / {cover_ext} exposed / {cover_base} base", (ox, oy - 260))
    sh.dim((ox + toe, oy + base_t), (ox + toe + t_stem, oy + base_t), -base_t - 200)
    sh.dim((ox + base_L, oy), (ox + base_L, oy + base_t + H), 200)


# ------------------------------------------------------------------ FOUNDATIONS
def create_pad_footing(sh: Sheet, lx=2500, ly=2500, depth=600, cx=400, cy=400, bar_dia=25, pitch=200,
                       cover=75, grade="28/35", n_starters=4, starter_dia=20, origin=(0, 0), bond="good"):
    ox, oy = origin
    d = depth - cover - bar_dia * 1.5
    sh.rect(ox, oy, lx, ly)
    sh.rect(ox + lx / 2 - cx / 2, oy + ly / 2 - cy / 2, cx, cy)
    bx = band_required(lx, cx, d); by = band_required(ly, cy, d)
    def positions(L, c, band):
        n = int((L - 2 * cover) // pitch) + 1
        if not band:
            return [cover + i * pitch for i in range(n)], n
        bw = c + 3 * d
        n_band = math.ceil(2 / 3 * n); n_out = n - n_band
        inner_p = bw / max(n_band, 1)
        cen = L / 2
        band_pos = [cen - bw / 2 + inner_p * (i + .5) for i in range(n_band)]
        out = [cover + i * (cen - bw / 2 - cover) / max(n_out / 2, 1) for i in range(math.ceil(n_out / 2))]
        out += [L - p for p in out]
        return sorted(band_pos + out), n
    xs, n1 = positions(lx, cx, bx)      # bars parallel to y at these x
    ys, n2 = positions(ly, cy, by)
    for x in xs: sh.line((ox + x, oy + cover), (ox + x, oy + ly - cover), "BAR", 35)
    for y in ys: sh.line((ox + cover, oy + y), (ox + lx - cover, oy + y), "BAR", 50)
    la = anchorage_len(bar_dia, grade, "foundations", bond)
    avail = (lx - cx) / 2 - cover
    tag = "straight" if avail >= la else f"bob ends (avail {avail:.0f} < {la:.0f}) [F08]"
    sh.text(f"anchorage {la:.0f} from column face: {tag}", (ox, oy - 120))
    if bx or by: sh.text(f"banded: width cx+3d = {cx + 3 * d:.0f}, >=2/3 bars in band [F09]", (ox, oy - 190))
    sh.callout(BarGroup(len(ys), bar_dia, 1, pitch, "B1"), (ox + cover, oy + ys[len(ys) // 2]), (ox + lx + 150, oy + ly * .6))
    sh.callout(BarGroup(len(xs), bar_dia, 2, pitch, "B2"), (ox + xs[len(xs) // 2], oy + cover), (ox + lx + 150, oy + ly * .3))
    # section
    sy = oy - 700 - depth
    sh.rect(ox, sy, lx, depth)
    sh.line((ox + cover, sy + cover), (ox + lx - cover, sy + cover), "BAR", 60)
    sh.rect(ox + lx / 2 - cx / 2, sy + depth, cx, 600)
    for k in range(n_starters // 2):                     # starters (elevation: 2 visible)
        xx = ox + lx / 2 - cx / 2 + 60 + k * (cx - 120)
        sh.poly([(xx, sy + depth + 500), (xx, sy + cover + bar_dia), (xx - 450 * (1 if k == 0 else -1), sy + cover + bar_dia)], "BAR", 50)
    sh.text("starters: 450 min horizontal leg [F07]; compression lap + 150 [F17]; kicker 75", (ox, sy - 120))
    sh.text(f"cover {cover}", (ox + 20, sy + 10))
    sh.dim((ox, sy), (ox + lx, sy), -250)
    return {"banding": bx or by, "band_width": cx + 3 * d, "anchorage": la, "d": d}


# ------------------------------------------------------------------ STAIR (end-supported, MST1)
def create_end_supported_stair(sh: Sheet, going=250, rise=175, n_steps=12, waist=200, landing=1000, dia=12, pitch=150,
                               cover=25, grade="30/37", bond="good", origin=(0, 0)):
    ox, oy = origin
    run = going * n_steps; rise_t = rise * n_steps
    slope = math.hypot(run, rise_t)
    span = landing + run + landing
    # soffit line & pitch line
    soff = [(ox, oy), (ox + landing, oy), (ox + landing + run, oy + rise_t), (ox + span, oy + rise_t)]
    top = [(x, y + waist) for x, y in soff]
    sh.poly(soff, "CONCRETE", 50); sh.poly(top[:1] + top[1:], "CONCRETE", 30)
    for i in range(n_steps):                              # treads/risers
        x0 = ox + landing + i * going; y0 = oy + waist + i * rise
        sh.poly([(x0, y0), (x0, y0 + rise), (x0 + going, y0 + rise)], "CONCRETE", 25)
    # main bottom bar following soffit at cover
    bar = [(x, y + cover) for x, y in soff]
    A = stair_A(span, anchorage_len(dia, grade, "stairs", bond))
    sh.poly(bar, "BAR", 60)
    # top U-bars at landings = 50% area, extend A [S07]
    sh.line((ox + landing - 100 - A, oy + waist - cover), (ox + landing - 100, oy + waist - cover), "BAR", 35)
    sh.line((ox + landing + run + 100, oy + rise_t + waist - cover), (ox + landing + run + 100 + A, oy + rise_t + waist - cover), "BAR", 35)
    sh.text(f"'A' = max(0.1 x span, lbd, 500) = {A:.0f}   U-bars = 50% As(bottom) [MST1]", (ox, oy - 250))
    sh.callout(BarGroup(1, dia, 3, pitch, "B"), (ox + landing + run / 2, oy + rise_t / 2 + cover), (ox + landing + run / 2 + 300, oy + rise_t / 2 - 300))
    sh.callout(BarGroup(1, 10, 5, 300, "B"), (ox + 100, oy + cover), (ox + 100, oy - 400))
    sh.dim((ox + landing, oy - 100), (ox + landing + run, oy - 100), -400)
    return {"A": A, "span": span, "slope_len": slope}


# ------------------------------------------------------------------ example driver
if __name__ == "__main__":
    import os
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dxf_samples")
    os.makedirs(outdir, exist_ok=True)

    sh = Sheet(); w = Wall(t=250, L=2400, H=3000, opening=(900, 1000, 600, 800), exposure="internal")
    create_wall_section(sh, w, (0, 0)); create_wall_elevation(sh, w, (0, 700))
    sh.level(-500, 3700, "16.675"); sh.section_marker(-300, 1700, 1)
    sh.save(os.path.join(outdir, "wall.dxf")); print("wall", w.warnings)

    sh = Sheet(); create_cantilever_retaining_wall(sh); sh.save(os.path.join(outdir, "retaining_wall.dxf"))
    sh = Sheet(); print(create_pad_footing(sh, lx=4000, ly=3500, cx=400, cy=400, depth=500)); sh.save(os.path.join(outdir, "pad_footing.dxf"))
    sh = Sheet(); print(create_end_supported_stair(sh)); sh.save(os.path.join(outdir, "stair.dxf"))
