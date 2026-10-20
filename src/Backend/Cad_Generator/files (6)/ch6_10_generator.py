"""
IStructE SMDS Chapters 5 & 6 — Slab + Beam Generator (Python + ezdxf)
=======================================================================
Sources:
  - Section 5.2–5.4: Cover, anchorage, lap formulas
  - Section 6.2: Slabs (MS1–MS8 model details)
  - Section 6.3: Beams (MB1–MB3 model details)
  - Section 6.4: Columns (partial)

Philosophy: Engineering parameters → Engineering model → Drawing model → DXF
"""

import ezdxf
from ezdxf import colors
import math
from dataclasses import dataclass, field
from typing import Optional, List, Tuple, Dict


# ─────────────────────────────────────────────────────────────────────────────
# 1.  MATERIAL / ANCHORAGE ENGINE
#     Sources: Sections 5.2–5.4, Tables 6.1, 6.4, 6.5
# ─────────────────────────────────────────────────────────────────────────────

BAR_AREAS = {6:28.3, 8:50.3, 10:78.5, 12:113.1, 16:201.1,
             20:314.2, 25:490.9, 32:804.2, 40:1256.6, 50:1963.5}
BAR_MASS  = {6:0.222, 8:0.395, 10:0.616, 12:0.888, 16:1.579,
             20:2.466, 25:3.854, 32:6.313, 40:9.864, 50:15.413}
PREFERRED_SIZES = [8, 10, 12, 16, 20, 25, 32, 40]

# Table 6.1 — slabs; Table 6.4 — beams; Table 6.5 — columns
# Format: (anchorage_diameters, lap_diameters)
ANCHORAGE_LAP_TABLES = {
    "slab": {
        "good": {"25/30":(40,46), "28/35":(37,43), "30/37":(36,42), "32/40":(34,39)},
        "poor": {"25/30":(58,66), "28/35":(53,61), "30/37":(51,59), "32/40":(49,56)},
    },
    "beam": {
        "good": {"25/30":(36,42), "28/35":(34,39), "30/37":(32,37), "32/40":(31,35)},
        "poor": {"25/30":(48,56), "28/35":(45,52), "30/37":(43,49), "32/40":(41,47)},
    },
    "column": {   # good bond only per Table 6.5 (a6=1.5 assumed)
        "good": {"25/30":(36,54), "28/35":(34,51), "30/37":(32,48), "32/40":(31,46)},
    },
}

def anchorage_lap(bar_dia: int, concrete_grade: str,
                  bond: str = "good", member: str = "beam") -> Tuple[float, float]:
    """
    Return (anchorage_mm, lap_mm) from code tables.
    Source: Tables 6.1 (slab), 6.4 (beam), 6.5 (column).
    """
    try:
        anc_dia, lap_dia = ANCHORAGE_LAP_TABLES[member][bond][concrete_grade]
    except KeyError:
        raise ValueError(f"No table entry for {member}/{bond}/{concrete_grade}")
    return anc_dia * bar_dia, lap_dia * bar_dia


def alpha6(pct_lapped: float) -> float:
    """α6 factor for percentage of lapped bars — Section 5.4.3, Table 5.7."""
    if pct_lapped < 25:   return 1.0
    elif pct_lapped <= 33: return 1.0  + (1.15-1.0)/(33-25)*(pct_lapped-25)
    elif pct_lapped <= 50: return 1.15 + (1.4-1.15)/(50-33)*(pct_lapped-33)
    else:                  return 1.5


def as_min_slab(h_mm: float, fck: float = 30.0, fyk: float = 500.0) -> float:
    """
    As,min per mm width — EC2 Clause 9.3.1.1.
    For C30/37 and fyk=500: As,min = 0.0015 × h × 1000 mm²/m.
    Source: Section 6.2.2.
    """
    if fck == 30 and fyk == 500:
        return 0.0015 * h_mm * 1000
    # General formula (simplified):
    fctm = 0.3 * fck**(2/3)
    return max(0.26 * fctm / fyk, 0.0013) * h_mm * 1000


def as_min_beam_tension(bw: float, d: float) -> float:
    """As,min for beam tension — Section 6.3.2."""
    return 0.0015 * bw * d


# ─────────────────────────────────────────────────────────────────────────────
# 2.  DXF LAYER SETUP  (shared by all generators)
# ─────────────────────────────────────────────────────────────────────────────

LAYERS = {
    "CONCRETE":    (colors.WHITE,   35),
    "REBAR_MAIN":  (colors.YELLOW, 70),
    "REBAR_LINKS": (colors.GREEN,  50),
    "REBAR_DIST":  (colors.CYAN,   35),
    "REBAR_U":     (colors.YELLOW, 70),
    "REBAR_HANGER":(colors.MAGENTA,50),
    "REBAR_SPLICE":(colors.MAGENTA,50),
    "REBAR_SHEAR": (colors.RED,    50),
    "DIMENSIONS":  (colors.RED,    25),
    "ANNOTATIONS": (colors.WHITE,  25),
    "BAR_MARKS":   (colors.WHITE,  25),
    "SECTION_MARKS":(colors.GRAY,  25),
    "HATCHING":    (colors.GRAY,   18),
}

def setup_layers(doc):
    for name, (color, lw) in LAYERS.items():
        if name not in doc.layers:
            lay = doc.layers.add(name)
            lay.color = color
            lay.lineweight = lw


def new_doc():
    doc = ezdxf.new("R2010")
    setup_layers(doc)
    return doc, doc.modelspace()


# ─────────────────────────────────────────────────────────────────────────────
# 3.  SLAB GENERATOR
#     Sources: Sections 6.2.2, Model Details MS1–MS5
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SlabParams:
    slab_type: str = "one_way"       # one_way | two_way | flat | cantilever
    h_mm: float = 200.0
    span_lx_mm: float = 5000.0
    span_ly_mm: float = 6000.0
    cover_mm: float = 20.0           # MS1 note: at least 20 or bar dia
    main_bar_dia_mm: int = 12
    dist_bar_dia_mm: int = 10
    concrete_grade: str = "30/37"
    bond: str = "good"
    num_spans: int = 2
    scale: int = 50                  # drawing scale 1:50


@dataclass
class SlabReinforcement:
    """Computed reinforcement for a slab span — Source: Model Detail MS1."""
    main_bar_dia: int
    dist_bar_dia: int
    anchorage_mm: float
    lap_mm: float
    bottom_bar_length_mm: float   # 0.8×span + 0.5×tension_lap
    top_bar_extension_mm: float   # 0.3×span
    top_bar_end_limit_mm: float   # min(0.1×short_span, 600)
    dist_bar_pitch_mm: float
    as_min_mm2_per_m: float


def compute_slab_reinforcement(p: SlabParams) -> SlabReinforcement:
    """Apply MS1 simplified curtailment rules — Section 6.2.2."""
    anc, lap = anchorage_lap(p.main_bar_dia_mm, p.concrete_grade, p.bond, "slab")
    bottom_len = 0.8 * p.span_lx_mm + 0.5 * lap
    top_ext = 0.3 * p.span_lx_mm
    top_end = min(0.1 * p.span_lx_mm, 600)
    as_min = as_min_slab(p.h_mm)

    # Distribution bar pitch from MS1 table (simplified interpolation)
    # Source: Model Detail MS1, pitch-of-distribution-bars table
    dist_pitch = _ms1_dist_pitch(p.dist_bar_dia_mm, p.h_mm)

    return SlabReinforcement(
        main_bar_dia=p.main_bar_dia_mm,
        dist_bar_dia=p.dist_bar_dia_mm,
        anchorage_mm=anc,
        lap_mm=lap,
        bottom_bar_length_mm=bottom_len,
        top_bar_extension_mm=top_ext,
        top_bar_end_limit_mm=top_end,
        dist_bar_pitch_mm=dist_pitch,
        as_min_mm2_per_m=as_min,
    )


def _ms1_dist_pitch(bar_dia: int, h: float) -> float:
    """
    Distribution bar pitch from Model Detail MS1 table.
    Source: SLABS MS1, page 66. Linear interpolation.
    """
    table = {
        10: {100:350,125:425,150:425,175:350,200:300,225:275,250:225,
             275:200,300:200,325:175,350:150,375:150,400:125},
        12: {150:450,175:450,200:450,225:400,250:350,275:325,300:275,
             325:250,350:250,375:250,400:200},
        16: {200:450,225:450,250:450,275:450,300:450,325:425,350:400,375:375},
    }
    if bar_dia not in table:
        return 300  # fallback
    row = table[bar_dia]
    depths = sorted(row.keys())
    h_clamped = max(depths[0], min(depths[-1], h))
    for i in range(len(depths)-1):
        if depths[i] <= h_clamped <= depths[i+1]:
            t = (h_clamped - depths[i]) / (depths[i+1] - depths[i])
            return row[depths[i]] + t * (row[depths[i+1]] - row[depths[i]])
    return row[depths[-1]]


def draw_slab_elevation(p: SlabParams, r: SlabReinforcement,
                        msp, origin=(0.0, 0.0)):
    """
    Draw single-span slab longitudinal section (elevation).
    Shows: outline, bottom bars, top bars over support, distribution bars.
    Source: Model Detail MS1; Section 6.2.2.
    """
    sc = 1.0 / p.scale  # scale factor: real mm → drawing units
    ox, oy = origin
    L = p.span_lx_mm * sc
    h = p.h_mm * sc
    wall_w = 200 * sc   # nominal support width

    # --- Concrete outline ---
    msp.add_lwpolyline([
        (ox, oy), (ox + L + 2*wall_w, oy),
        (ox + L + 2*wall_w, oy + h), (ox, oy + h), (ox, oy)
    ], dxfattribs={"layer": "CONCRETE"})

    # Supports (walls)
    for x0 in [ox, ox + L + wall_w]:
        msp.add_lwpolyline([
            (x0, oy - h*2), (x0 + wall_w, oy - h*2),
            (x0 + wall_w, oy), (x0, oy), (x0, oy - h*2)
        ], dxfattribs={"layer": "CONCRETE"})

    cover = p.cover_mm * sc

    # --- Bottom bars (B1) — MS1: length = 0.8×span + 0.5×tension_lap ---
    # Two alternating sets, reversed
    bot_y = oy + cover + p.main_bar_dia_mm * sc * 0.5
    bar_len = r.bottom_bar_length_mm * sc
    span_offset = (L - bar_len + wall_w) / 2

    for i, colour_layer in enumerate(["REBAR_MAIN", "REBAR_MAIN"]):
        x_start = ox + wall_w + span_offset + i * (L - bar_len - wall_w) / max(1, p.num_spans)
        msp.add_line(
            (ox + wall_w * 0.5, bot_y - i * p.main_bar_dia_mm * 0.5 * sc),
            (ox + wall_w * 0.5 + bar_len, bot_y - i * p.main_bar_dia_mm * 0.5 * sc),
            dxfattribs={"layer": colour_layer}
        )

    # --- Top bars (T1) — MS1: extend 0.3×span from support face ---
    top_y = oy + h - cover - p.dist_bar_dia_mm * sc - p.main_bar_dia_mm * sc * 0.5
    top_ext = r.top_bar_extension_mm * sc
    end_lim = r.top_bar_end_limit_mm * sc

    # Left support top bar
    msp.add_line(
        (ox + wall_w - end_lim, top_y),
        (ox + wall_w + top_ext, top_y),
        dxfattribs={"layer": "REBAR_MAIN"}
    )
    # Right support top bar (staggered — slightly offset)
    msp.add_line(
        (ox + wall_w * 2 + L - top_ext, top_y - p.main_bar_dia_mm * sc),
        (ox + wall_w * 2 + L + end_lim, top_y - p.main_bar_dia_mm * sc),
        dxfattribs={"layer": "REBAR_MAIN"}
    )

    # --- Distribution bars (T2 / B2) — pitch from MS1 table ---
    dist_pitch = r.dist_bar_pitch_mm * sc
    dist_y_bot = oy + cover + p.dist_bar_dia_mm * sc * 0.5
    dist_y_top = oy + h - cover - p.dist_bar_dia_mm * sc * 0.5
    x_cur = ox + wall_w
    while x_cur < ox + wall_w + L:
        msp.add_line((x_cur, dist_y_bot), (x_cur, dist_y_bot + h * 0.2),
                     dxfattribs={"layer": "REBAR_DIST"})
        msp.add_line((x_cur, dist_y_top - h * 0.1), (x_cur, dist_y_top),
                     dxfattribs={"layer": "REBAR_DIST"})
        x_cur += dist_pitch

    # --- Dimensions ---
    _add_dim(msp, ox + wall_w, oy - h * 0.5, ox + wall_w + L, oy - h * 0.5,
             f"SPAN = {p.span_lx_mm:.0f}", text_h=sc * 15)

    # --- Annotations ---
    msp.add_text(
        f"H={p.h_mm:.0f}  CVR={p.cover_mm:.0f}",
        dxfattribs={"layer": "ANNOTATIONS", "height": sc*15,
                    "insert": (ox + wall_w, oy + h + sc*20)}
    )
    # MS1 bottom bar callout
    bot_pitch = int(p.span_lx_mm * sc / 10 / p.main_bar_dia_mm) * p.main_bar_dia_mm
    msp.add_text(
        f"H{p.main_bar_dia_mm} B1 @ {min(bot_pitch, 200):.0f} — MS1",
        dxfattribs={"layer": "BAR_MARKS", "height": sc*12,
                    "insert": (ox + wall_w + L * 0.3 * sc, bot_y - sc*25)}
    )


def _add_dim(msp, x1, y, x2, y2, text, text_h=3.0, offset=10.0):
    """Simple dimension line helper."""
    msp.add_line((x1, y - offset), (x2, y2 - offset),
                 dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((x1, y), (x1, y - offset), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((x2, y2), (x2, y2 - offset), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_text(text, dxfattribs={"layer": "DIMENSIONS", "height": text_h,
                                   "insert": ((x1+x2)/2, y - offset - text_h*1.5)})


# ─────────────────────────────────────────────────────────────────────────────
# 4.  BEAM GENERATOR
#     Sources: Sections 6.3.2, Model Details MB1–MB3
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class BeamParams:
    bw_mm: float = 300.0
    h_mm: float = 600.0
    L_mm: float = 7000.0
    support_width_mm: float = 300.0
    cover_mm: float = 35.0          # MB1: Normally Internal 35, External 40
    main_bar_dia_mm: int = 25
    main_bar_count: int = 4
    link_dia_mm: int = 10
    num_link_legs: int = 2
    hanger_bar_dia_mm: int = 16
    concrete_grade: str = "30/37"
    bond: str = "good"
    beam_type: str = "continuous"   # simply_supported | continuous | cantilever
    scale: int = 50


@dataclass
class BeamReinforcement:
    d_mm: float
    as_min_mm2: float
    hanger_area_mm2: float
    anchorage_mm: float
    lap_mm: float
    top_bar_min_extension_mm: float   # max(0.15L, 45ø)
    top_bar_default_extension_mm: float  # 0.25L
    bottom_span_continuous_mm: float  # 0.15L from internal support
    bottom_at_support_min_area_fraction: float  # 0.25
    link_max_spacing_mm: float
    link_min_spacing_mm: float
    link_max_lateral_mm: float
    needs_side_bars: bool
    side_bar_pitch_mm: Optional[float]


def compute_beam_reinforcement(p: BeamParams) -> BeamReinforcement:
    """Apply beam reinforcement rules — Section 6.3.2."""
    d = p.h_mm - p.cover_mm - p.link_dia_mm - p.main_bar_dia_mm / 2
    as_min = as_min_beam_tension(p.bw_mm, d)
    anc, lap = anchorage_lap(p.main_bar_dia_mm, p.concrete_grade, p.bond, "beam")

    # Curtailment — Section 6.3.2
    top_min_ext = max(0.15 * p.L_mm, 45 * p.main_bar_dia_mm)
    top_default_ext = 0.25 * p.L_mm
    bot_span_continuous = 0.15 * p.L_mm

    # Hanger bars — Section 6.3.2: at least 20% max support area (simplified as fraction)
    hanger_area = max(0.20 * (p.main_bar_count * BAR_AREAS[p.main_bar_dia_mm]),
                      2 * BAR_AREAS[p.hanger_bar_dia_mm])  # min 2H16 if h>=500

    # Link spacing — Section 6.3.2
    num_legs = p.num_link_legs
    link_min = max(100, 50 + 12.5 * num_legs)
    link_max = min(300, 0.75 * d, 12 * p.main_bar_dia_mm)   # compression bar = main bar simplified
    link_lateral = min(600, 0.75 * d)

    needs_side = p.h_mm >= 1000
    side_pitch = 250.0 if needs_side else None

    return BeamReinforcement(
        d_mm=d,
        as_min_mm2=as_min,
        hanger_area_mm2=hanger_area,
        anchorage_mm=anc,
        lap_mm=lap,
        top_bar_min_extension_mm=top_min_ext,
        top_bar_default_extension_mm=top_default_ext,
        bottom_span_continuous_mm=bot_span_continuous,
        bottom_at_support_min_area_fraction=0.25,
        link_max_spacing_mm=link_max,
        link_min_spacing_mm=link_min,
        link_max_lateral_mm=link_lateral,
        needs_side_bars=needs_side,
        side_bar_pitch_mm=side_pitch,
    )


def draw_beam_elevation(p: BeamParams, r: BeamReinforcement,
                        msp, origin=(0.0, 0.0)):
    """
    Draw beam elevation per Model Detail MB1.
    Shows: outline, top bars, hanger bars, bottom bars, links, U-bars at end.
    """
    sc = 1.0 / p.scale
    ox, oy = origin
    L = p.L_mm * sc
    h = p.h_mm * sc
    bw = p.bw_mm * sc
    sw = p.support_width_mm * sc
    cover = p.cover_mm * sc

    # --- Concrete outline ---
    msp.add_lwpolyline([
        (ox, oy), (ox+L+2*sw, oy),
        (ox+L+2*sw, oy+h), (ox, oy+h), (ox, oy)
    ], dxfattribs={"layer": "CONCRETE"})

    # Column stubs (schematic)
    for x0 in [ox, ox+L+sw]:
        msp.add_lwpolyline([
            (x0, oy-h*0.5), (x0+sw, oy-h*0.5),
            (x0+sw, oy+h*1.5), (x0, oy+h*1.5), (x0, oy-h*0.5)
        ], dxfattribs={"layer": "CONCRETE"})

    link_d = p.link_dia_mm * sc
    main_d = p.main_bar_dia_mm * sc
    hanger_d = p.hanger_bar_dia_mm * sc

    # --- Hanger bars (full length) — MB1 ---
    hanger_y = oy + h - cover - link_d - hanger_d * 0.5
    msp.add_line(
        (ox + sw * 0.1, hanger_y),
        (ox + sw + L + sw * 0.9, hanger_y),
        dxfattribs={"layer": "REBAR_HANGER"}
    )
    msp.add_text(
        f"HANGER {p.hanger_bar_dia_mm}mm",
        dxfattribs={"layer": "BAR_MARKS", "height": sc*12,
                    "insert": (ox + sw + L * 0.2, hanger_y + sc*15)}
    )

    # --- Top support bars — inside hanger bars, curtailed ---
    top_y = hanger_y - main_d * 1.2
    top_ext = r.top_bar_default_extension_mm * sc
    # Left support
    msp.add_line(
        (ox + sw - r.anchorage_mm * sc, top_y),
        (ox + sw + top_ext, top_y),
        dxfattribs={"layer": "REBAR_MAIN"}
    )
    # Right support (staggered)
    msp.add_line(
        (ox + sw + L - top_ext, top_y - main_d * 1.2),
        (ox + sw + L + r.anchorage_mm * sc, top_y - main_d * 1.2),
        dxfattribs={"layer": "REBAR_MAIN"}
    )

    # --- Bottom span bars ---
    bot_y = oy + cover + link_d + main_d * 0.5
    bot_curtail_ext = r.bottom_span_continuous_mm * sc
    # 30% continuous to 25mm from support
    bot_len_long = L + 2 * sw - 2 * 25 * sc
    # Remainder within 0.15L of support
    bot_len_short = L - 2 * bot_curtail_ext

    msp.add_line(
        (ox + 25*sc, bot_y),
        (ox + 25*sc + bot_len_long, bot_y),
        dxfattribs={"layer": "REBAR_MAIN"}
    )
    msp.add_line(
        (ox + sw + bot_curtail_ext, bot_y + main_d * 1.2),
        (ox + sw + L - bot_curtail_ext, bot_y + main_d * 1.2),
        dxfattribs={"layer": "REBAR_MAIN"}
    )

    # --- U-bars at left end (end support) ---
    _draw_u_bar(msp, ox, oy, h, cover, link_d, main_d, sc, p)

    # --- Links (three zones) ---
    zone_end_len = min(sw + h, L * 0.25)   # end zone
    zone_end = zone_end_len * sc
    link_end_sp = r.link_min_spacing_mm * sc
    link_span_sp = r.link_max_spacing_mm * sc

    # Left end zone
    _draw_link_zone(msp, ox+sw, oy, bw, h, cover, link_d, link_end_sp, zone_end, sc)
    # Central zone
    _draw_link_zone(msp, ox+sw+zone_end, oy, bw, h, cover, link_d, link_span_sp,
                    L*sc - 2*zone_end, sc)
    # Right end zone
    _draw_link_zone(msp, ox+sw+L*sc-zone_end, oy, bw, h, cover, link_d, link_end_sp,
                    zone_end, sc)

    # --- Link zone annotations ---
    end_count = max(1, int(zone_end / link_end_sp))
    span_count = max(1, int((L*sc - 2*zone_end) / link_span_sp))
    msp.add_text(
        f"{end_count}/{p.link_dia_mm}@{r.link_min_spacing_mm:.0f}",
        dxfattribs={"layer": "ANNOTATIONS", "height": sc*12,
                    "insert": (ox+sw+zone_end*0.3, oy-sc*25)}
    )
    msp.add_text(
        f"{span_count}/{p.link_dia_mm}@{r.link_max_spacing_mm:.0f}",
        dxfattribs={"layer": "ANNOTATIONS", "height": sc*12,
                    "insert": (ox+sw+L*sc*0.4, oy-sc*25)}
    )

    # --- Side bars (if h >= 1000) ---
    if r.needs_side_bars:
        y_side = oy + cover + link_d + 16*sc*0.5
        while y_side < oy + h - cover - link_d:
            msp.add_line((ox+sw, y_side), (ox+sw+L*sc, y_side),
                         dxfattribs={"layer": "REBAR_DIST"})
            y_side += r.side_bar_pitch_mm * sc

    # --- Dimension ---
    _add_dim(msp, ox+sw, oy-sc*40, ox+sw+L*sc, oy-sc*40,
             f"L = {p.L_mm:.0f}", text_h=sc*15, offset=0)


def _draw_link_zone(msp, x_start, y, bw, h, cover, link_d, spacing, length, sc):
    """Draw links in a beam zone."""
    x = x_start + spacing * 0.5
    while x < x_start + length - spacing * 0.5:
        msp.add_lwpolyline([
            (x, y + cover), (x + bw - 2*cover, y + cover),
            (x + bw - 2*cover, y + h - cover), (x, y + h - cover), (x, y + cover)
        ], dxfattribs={"layer": "REBAR_LINKS", "closed": True})
        x += spacing


def _draw_u_bar(msp, ox, oy, h, cover, link_d, main_d, sc, p: BeamParams):
    """Draw U-bar at end support per MB1."""
    anc, lap = anchorage_lap(p.main_bar_dia_mm, p.concrete_grade)
    leg_len = min(anc + 100*sc, h - 2*cover - link_d - main_d)
    x_u = ox + (cover + link_d + main_d*0.5) * sc
    # Horizontal top leg
    msp.add_line(
        (ox + p.support_width_mm*sc*0.5, oy + h - cover - link_d - main_d*0.5),
        (x_u, oy + h - cover - link_d - main_d*0.5),
        dxfattribs={"layer": "REBAR_U"}
    )
    # Vertical leg
    msp.add_line(
        (x_u, oy + h - cover - link_d - main_d*0.5),
        (x_u, oy + cover + link_d + main_d*0.5),
        dxfattribs={"layer": "REBAR_U"}
    )
    # Horizontal bottom leg
    msp.add_line(
        (x_u, oy + cover + link_d + main_d*0.5),
        (ox + p.support_width_mm*sc*0.5, oy + cover + link_d + main_d*0.5),
        dxfattribs={"layer": "REBAR_U"}
    )
    msp.add_text("UB", dxfattribs={"layer": "BAR_MARKS", "height": sc*10,
                                   "insert": (x_u + sc*5, oy + h*0.5)})


def draw_beam_section(p: BeamParams, r: BeamReinforcement,
                      msp, origin=(0.0, 0.0), label="A-A"):
    """Draw beam cross-section per MB1."""
    sc = 1.0 / p.scale
    ox, oy = origin
    bw = p.bw_mm * sc
    h = p.h_mm * sc
    cover = p.cover_mm * sc
    link_d = p.link_dia_mm * sc
    main_d = p.main_bar_dia_mm * sc
    hanger_d = p.hanger_bar_dia_mm * sc

    # Concrete section
    msp.add_lwpolyline(
        [(ox,oy),(ox+bw,oy),(ox+bw,oy+h),(ox,oy+h),(ox,oy)],
        dxfattribs={"layer": "CONCRETE"}
    )
    # Hatch
    hatch = msp.add_hatch(color=8, dxfattribs={"layer": "HATCHING"})
    hatch.paths.add_polyline_path(
        [(ox,oy),(ox+bw,oy),(ox+bw,oy+h),(ox,oy+h)], is_closed=True
    )
    hatch.set_pattern_fill("ANSI31", scale=0.3)

    # Link
    msp.add_lwpolyline([
        (ox+cover, oy+cover),
        (ox+bw-cover, oy+cover),
        (ox+bw-cover, oy+h-cover),
        (ox+cover, oy+h-cover),
        (ox+cover, oy+cover)
    ], dxfattribs={"layer": "REBAR_LINKS"})

    # Bottom bars (circles)
    n = p.main_bar_count
    bot_y = oy + cover + link_d + main_d * 0.5
    inner_w = bw - 2*cover - 2*link_d
    x_step = inner_w / max(n-1, 1)
    for i in range(n):
        cx = ox + cover + link_d + main_d*0.5 + i * x_step
        msp.add_circle((cx, bot_y), main_d*0.5, dxfattribs={"layer": "REBAR_MAIN"})

    # Hanger bars
    hang_y = oy + h - cover - link_d - hanger_d * 0.5
    for cx in [ox + cover + link_d + hanger_d*0.5,
               ox + bw - cover - link_d - hanger_d*0.5]:
        msp.add_circle((cx, hang_y), hanger_d*0.5, dxfattribs={"layer": "REBAR_HANGER"})

    # Label
    msp.add_text(label, dxfattribs={"layer": "SECTION_MARKS", "height": sc*20,
                                    "insert": (ox, oy - sc*30)})


# ─────────────────────────────────────────────────────────────────────────────
# 5.  MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    doc, msp = new_doc()

    # ── SLAB ──────────────────────────────────────────────────────────────
    sp = SlabParams(h_mm=200, span_lx_mm=5000, cover_mm=25,
                    main_bar_dia_mm=12, dist_bar_dia_mm=10,
                    concrete_grade="30/37", num_spans=2)
    sr = compute_slab_reinforcement(sp)

    print("=== SLAB ===")
    print(f"Anchorage: {sr.anchorage_mm:.0f}mm  Lap: {sr.lap_mm:.0f}mm")
    print(f"Bottom bar length (MS1): {sr.bottom_bar_length_mm:.0f}mm")
    print(f"Top bar extension (MS1): {sr.top_bar_extension_mm:.0f}mm")
    print(f"Distribution bar pitch:  {sr.dist_bar_pitch_mm:.0f}mm")
    print(f"As,min per m: {sr.as_min_mm2_per_m:.0f} mm²/m")

    draw_slab_elevation(sp, sr, msp, origin=(10, 200))

    # ── BEAM ──────────────────────────────────────────────────────────────
    bp = BeamParams(bw_mm=300, h_mm=600, L_mm=7000,
                    cover_mm=35, main_bar_dia_mm=25, main_bar_count=4,
                    link_dia_mm=10, num_link_legs=2,
                    concrete_grade="30/37", beam_type="continuous")
    br = compute_beam_reinforcement(bp)

    print("\n=== BEAM ===")
    print(f"d = {br.d_mm:.0f}mm")
    print(f"As,min = {br.as_min_mm2:.0f} mm²")
    print(f"Anchorage: {br.anchorage_mm:.0f}mm  Lap: {br.lap_mm:.0f}mm")
    print(f"Top bar default extension: {br.top_bar_default_extension_mm:.0f}mm")
    print(f"Top bar minimum extension: {br.top_bar_min_extension_mm:.0f}mm")
    print(f"Link max spacing: {br.link_max_spacing_mm:.0f}mm")
    print(f"Link min spacing: {br.link_min_spacing_mm:.0f}mm")
    print(f"Needs side bars: {br.needs_side_bars}")

    draw_beam_elevation(bp, br, msp, origin=(10, 50))
    draw_beam_section(bp, br, msp, origin=(10, 10), label="1-1")
    draw_beam_section(bp, br, msp, origin=(50, 10), label="2-2")

    # ── ANCHORAGE CALCULATOR ───────────────────────────────────────────────
    print("\n=== ANCHORAGE TABLE CHECK ===")
    for grade in ["25/30", "30/37", "32/40"]:
        anc_s, lap_s = anchorage_lap(16, grade, "good", "slab")
        anc_b, lap_b = anchorage_lap(25, grade, "good", "beam")
        print(f"{grade}: Slab H16 anc={anc_s:.0f}mm lap={lap_s:.0f}mm | "
              f"Beam H25 anc={anc_b:.0f}mm lap={lap_b:.0f}mm")

    out = "/mnt/user-data/outputs/slab_beam_generator.dxf"
    doc.saveas(out)
    print(f"\nDXF saved: {out}")


if __name__ == "__main__":
    main()
