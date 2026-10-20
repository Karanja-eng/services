"""
General Detailing Information — reference generator module
Source: IStructE/Concrete Society, Standard Method of Detailing Structural Concrete,
        Appendix A (pp.168-171) and Appendix B (pp.172-188)

This module implements the CROSS-CUTTING reference rules (bar shape codes, minimum
bend radii, anchorage lengths, bar areas, fabric types, material-grade symbols) that
every structural-member generator (columns, walls, foundations, staircases, beams,
slabs) should call into, rather than re-deriving.

It does NOT draw a member. It provides:
  - BarGeometry computation (length, segment list) for any of the 36 shape codes
  - Table B.1 lookups (minimum radius / former diameter / end projection)
  - Effective anchorage length for L-bars and U-bars
  - Minimum U-bar end depth (hook / trombone styles)
  - Large-diameter-bend minimum mandrel size (from the governing formula)
  - Bar area / weight lookups
  - Fabric (mesh) type lookup
  - Material-grade symbol lookup by historical period

Downstream DXF generation: BarGeometry.segments is an ordered list of
("line", length_mm) / ("arc", radius_mm, sweep_deg) tuples that a renderer can walk
to emit ezdxf LINE/ARC primitives along a local bar-centreline path.
"""

from dataclasses import dataclass, field
from typing import Optional
import math

# ---------------------------------------------------------------------------
# Table B.1 — minimum scheduling radius / former diameter / end projection
# Source: Appendix B, Table B.1, p.178
# ---------------------------------------------------------------------------

TABLE_B1 = {
    6:  {"r": 12,  "M": 24,  "P_general": 110, "P_link_lt150": 110},
    8:  {"r": 16,  "M": 32,  "P_general": 115, "P_link_lt150": 115},
    10: {"r": 20,  "M": 40,  "P_general": 120, "P_link_lt150": 130},
    12: {"r": 24,  "M": 48,  "P_general": 125, "P_link_lt150": 160},
    16: {"r": 32,  "M": 64,  "P_general": 130, "P_link_lt150": 210},
    20: {"r": 70,  "M": 140, "P_general": 190, "P_link_lt150": 290},
    25: {"r": 87,  "M": 175, "P_general": 240, "P_link_lt150": 365},
    32: {"r": 112, "M": 224, "P_general": 305, "P_link_lt150": 465},
    40: {"r": 140, "M": 280, "P_general": 380, "P_link_lt150": 580},
    50: {"r": 175, "M": 350, "P_general": 475, "P_link_lt150": 725},
}


def table_b1_lookup(bar_size_mm: int, link_bend_lt_150deg: bool = False) -> dict:
    """Return {r, M, P} minimum scheduling radius/former dia/end projection.

    bar_size_mm must be one of the standard sizes in TABLE_B1.
    link_bend_lt_150deg: use the stricter link end-projection (min 10d straight)
        rather than the general case (min 5d straight).
    """
    if bar_size_mm not in TABLE_B1:
        raise ValueError(f"Bar size {bar_size_mm}mm not in Table B.1 (source only "
                          f"tabulates {sorted(TABLE_B1)})")
    row = TABLE_B1[bar_size_mm]
    P = row["P_link_lt150"] if link_bend_lt_150deg else row["P_general"]
    return {"r": row["r"], "M": row["M"], "P": P}


# ---------------------------------------------------------------------------
# Bar shape codes — length formulas
# Each function takes the dimensions relevant to that shape (mm) plus bar
# diameter d and internal radius r (normally from table_b1_lookup), and
# returns total centreline length L (mm).
# Source: Appendix B, pp.172-177
# ---------------------------------------------------------------------------

def shape_00(A):
    return A

def shape_01(A):
    """Stock length — A is indicative only (Note 4)."""
    return A

def shape_11(A, B, r, d):
    return A + B - 0.5 * r - d

def shape_12(A, B, R, d):
    return A + B - 0.43 * R - 1.2 * d

def shape_13(A, B, C, d):
    return A + 0.57 * B + C - 1.6 * d

def shape_14(A, C, d):
    return A + C - 4 * d

def shape_15(A, C):
    return A + C

def shape_21(A, B, C, r, d):
    return A + B + C - r - 2 * d

def shape_22(A, B, C, D, r, d):
    return A + B + C + D - 1.5 * r - 3 * d

def shape_23(A, B, C, r, d):
    return A + B + C - r - 2 * d

def shape_24(A, B, C):
    return A + B + C

def shape_25(A, B, E):
    return A + B + E

def shape_26(A, B, C):
    return A + B + C

def shape_27(A, B, C, r, d):
    return A + B + C - 0.5 * r - d

def shape_28(A, B, C, r, d):
    return A + B + C - 0.5 * r - d

def shape_29(A, B, C, r, d):
    return A + B + C - r - 2 * d

def shape_31(A, B, C, D, r, d):
    return A + B + C + D - 1.5 * r - 3 * d

def shape_32(A, B, C, D, r, d):
    return A + B + C + D - 1.5 * r - 3 * d

def shape_33(A, B, C, d):
    return 2 * A + 1.7 * B + 2 * C - 4 * d

def shape_34(A, B, C, E, r, d):
    return A + B + C + E - 0.5 * r - d

def shape_35(A, B, C, E, r, d):
    return A + B + C + E - 0.5 * r - d

def shape_36(A, B, C, D, r, d):
    return A + B + C + D - r - 2 * d

def shape_41(A, B, C, D, E, r, d):
    return A + B + C + D + E - 2 * r - 4 * d

def shape_44(A, B, C, D, E, r, d):
    return A + B + C + D + E - 2 * r - 4 * d

def shape_46(A, B, C, E):
    return A + 2 * B + C + E

def shape_47(A, B, C, r=None, d=None, minimized=False):
    if minimized:
        return 2 * A + B + max(21 * d, 240)
    return 2 * A + B + 2 * C + 1.5 * r - 3 * d

def shape_51(A, B, C, r=None, d=None, minimized=False):
    if minimized:
        return 2 * A + 2 * B + max(16 * d, 160)
    return 2 * (A + B + C) - 2.5 * r - 5 * d

def shape_56(A, B, C, D, E, r, d):
    return A + B + C + D + 2 * E - 2.5 * r - 5 * d

def shape_63(A, B, C, r=None, d=None, minimized=False):
    if minimized:
        return 2 * A + 3 * B + max(14 * d, 150)
    return 2 * A + 3 * B + 2 * C - 3 * r - 6 * d

def shape_64(A, B, C, D, E, F, r, d):
    return A + B + C + 2 * D + E + F - 3 * r - 6 * d

def shape_75(A, B, d):
    """A = ring diameter, B = lap length."""
    return math.pi * (A - d) + B

def shape_77(A, B, C, d):
    """A = helix diameter, B = axial pitch-related dim, C = number of turns."""
    turn_len = math.pi * (A - d)
    if B > A / 5:
        return C * math.sqrt(turn_len ** 2 + B ** 2)
    return C * turn_len

def shape_98(A, B, C, D, r, d):
    return A + 2 * B + C + D - 2 * r - 4 * d

# shape_99 has no formula — requires a bespoke dimensioned sketch (source rule).

SHAPE_CODE_DISPATCH = {
    "00": shape_00, "01": shape_01, "11": shape_11, "12": shape_12, "13": shape_13,
    "14": shape_14, "15": shape_15, "21": shape_21, "22": shape_22, "23": shape_23,
    "24": shape_24, "25": shape_25, "26": shape_26, "27": shape_27, "28": shape_28,
    "29": shape_29, "31": shape_31, "32": shape_32, "33": shape_33, "34": shape_34,
    "35": shape_35, "36": shape_36, "41": shape_41, "44": shape_44, "46": shape_46,
    "47": shape_47, "51": shape_51, "56": shape_56, "63": shape_63, "64": shape_64,
    "75": shape_75, "77": shape_77, "98": shape_98,
}


def shape_length(shape_code: str, **kwargs) -> float:
    """Dispatch to the correct shape-code length formula.

    Example:
        shape_length("11", A=800, B=300, r=table_b1_lookup(16)["r"], d=16)
    """
    if shape_code == "99":
        raise ValueError("Shape 99 has no standard formula — requires a bespoke "
                          "dimensioned sketch per the manual's rule; compute length "
                          "directly from the drawn geometry instead.")
    if shape_code == "67":
        raise NotImplementedError("Shape 67 defers to BS8666 Clause 10, which is "
                                   "not reproduced in this source extract.")
    fn = SHAPE_CODE_DISPATCH.get(shape_code)
    if fn is None:
        raise ValueError(f"Unknown/unsupported shape code: {shape_code}")
    return fn(**kwargs)


# ---------------------------------------------------------------------------
# Bar areas / weights (computed, not looked up — see 03_detailing_rules.json
# note on these being DERIVED from single-bar area x count/pitch)
# ---------------------------------------------------------------------------

STEEL_DENSITY_KG_PER_M3 = 7850  # standard assumption; not explicitly restated
                                  # in this appendix extract for area formulas,
                                  # but consistent with the printed weight table.

def single_bar_area_mm2(bar_size_mm: float) -> float:
    return math.pi * (bar_size_mm / 2) ** 2

def group_area_mm2(bar_size_mm: float, number_of_bars: int) -> float:
    return number_of_bars * single_bar_area_mm2(bar_size_mm)

def area_per_metre_mm2(bar_size_mm: float, pitch_mm: float) -> float:
    return (1000.0 / pitch_mm) * single_bar_area_mm2(bar_size_mm)

def bar_weight_kg_per_m(bar_size_mm: float) -> float:
    area_m2 = single_bar_area_mm2(bar_size_mm) * 1e-6
    return area_m2 * STEEL_DENSITY_KG_PER_M3


# ---------------------------------------------------------------------------
# Effective anchorage length — L-bars and U-bars
# Source: Appendix B, p.181
# ---------------------------------------------------------------------------

def l_bar_anchorage_length(bar_size_mm: float, mandrel_dia_mm: float) -> float:
    """Effective anchorage length (mm) from start of bend, for an L-bar (90deg hook)."""
    b = bar_size_mm
    return (math.pi * (mandrel_dia_mm + b) / 4 + 5 * b) / 0.7

def u_bar_anchorage_length(bar_size_mm: float, mandrel_dia_mm: float) -> float:
    """Effective anchorage length (mm) from start of bend, for a U-bar (180deg hook)."""
    b = bar_size_mm
    return (math.pi * (mandrel_dia_mm + b) / 2 + 5 * b) / 0.7


# ---------------------------------------------------------------------------
# Minimum overall depth (B) for U-bar end shapes: "Hook" and "Trombone"
# Source: Appendix B, p.182 (fy = 500 MPa)
# ---------------------------------------------------------------------------

_MIN_B_HOOK = {6: 40, 8: 50, 10: 60, 12: 75, 16: 100, 20: 180, 25: 225, 32: 290, 40: 360}
_MIN_B_TROMBONE = {6: 60, 8: 80, 10: 100, 12: 120, 16: 160, 20: 260, 25: 325, 32: 420, 40: 520}

def u_bar_end_mandrel_diameter(bar_size_mm: float) -> float:
    """4b for bar size <=16mm, 7b for bar size >16mm (fy=500 MPa rule)."""
    return 4 * bar_size_mm if bar_size_mm <= 16 else 7 * bar_size_mm

def u_bar_min_overall_depth(bar_size_mm: int, style: str) -> int:
    table = {"hook": _MIN_B_HOOK, "trombone": _MIN_B_TROMBONE}.get(style)
    if table is None:
        raise ValueError("style must be 'hook' or 'trombone'")
    if bar_size_mm not in table:
        raise ValueError(f"Bar size {bar_size_mm}mm not tabulated for style={style}")
    return table[bar_size_mm]


# ---------------------------------------------------------------------------
# Large-diameter bends — minimum mandrel size from first principles
# Source: Appendix B, pp.183-188. bm_min = Fbt * ((1/ab) + 1/(2b)) / fcd
# fcd = acc * fck / gamma_c  (acc, gamma_c not restated in this extract — see
# General Detailing / Eurocode dependency note in 12_unresolved_questions.md)
# ---------------------------------------------------------------------------

def large_diameter_bend_mandrel(Fbt_N: float, ab_mm: float, bar_size_mm: float,
                                 fcd_MPa: float) -> float:
    """Minimum internal bend diameter (mm) so bearing stress inside the bend
    does not exceed the concrete's design strength, per Appendix B formula.

    fcd_MPa must be supplied by the caller (acc*fck/gamma_c is a general
    Eurocode concrete-design value, not redefined in this appendix — see
    DEPENDENCIES in 12_unresolved_questions.md).
    """
    b = bar_size_mm
    bm_min = Fbt_N * ((1 / ab_mm) + 1 / (2 * b)) / fcd_MPa
    return bm_min

def governing_bend_mandrel(bar_size_mm: float, Fbt_N: Optional[float] = None,
                            ab_mm: Optional[float] = None,
                            fcd_MPa: Optional[float] = None) -> float:
    """Larger of: the standard bend rule (4d for <20mm, 7d for >=20mm) and,
    if load data is supplied, the large-diameter-bend formula result.
    """
    standard = 4 * bar_size_mm if bar_size_mm < 20 else 7 * bar_size_mm
    if Fbt_N is None or ab_mm is None or fcd_MPa is None:
        return standard
    calculated = large_diameter_bend_mandrel(Fbt_N, ab_mm, bar_size_mm, fcd_MPa)
    return max(standard, calculated)


# ---------------------------------------------------------------------------
# Fabric (mesh) types — BS4483
# Source: Appendix B, p.180
# ---------------------------------------------------------------------------

FABRIC_TYPES = {
    "A393": {"long_wire": 10, "long_pitch": 200, "cross_wire": 10, "cross_pitch": 200, "mass_kg_m2": 6.16},
    "A252": {"long_wire": 8,  "long_pitch": 200, "cross_wire": 8,  "cross_pitch": 200, "mass_kg_m2": 3.95},
    "A193": {"long_wire": 7,  "long_pitch": 200, "cross_wire": 7,  "cross_pitch": 200, "mass_kg_m2": 3.02},
    "A142": {"long_wire": 6,  "long_pitch": 200, "cross_wire": 6,  "cross_pitch": 200, "mass_kg_m2": 2.22},
    "A98":  {"long_wire": 5,  "long_pitch": 200, "cross_wire": 5,  "cross_pitch": 200, "mass_kg_m2": 1.54},
    "B1131": {"long_wire": 12, "long_pitch": 100, "cross_wire": 8, "cross_pitch": 200, "mass_kg_m2": 10.9},
    "B785":  {"long_wire": 10, "long_pitch": 100, "cross_wire": 8, "cross_pitch": 200, "mass_kg_m2": 8.14},
    "B503":  {"long_wire": 8,  "long_pitch": 100, "cross_wire": 8, "cross_pitch": 200, "mass_kg_m2": 5.93},
    "B385":  {"long_wire": 7,  "long_pitch": 100, "cross_wire": 7, "cross_pitch": 200, "mass_kg_m2": 4.53},
    "B283":  {"long_wire": 6,  "long_pitch": 100, "cross_wire": 7, "cross_pitch": 200, "mass_kg_m2": 3.73},
    "B196":  {"long_wire": 5,  "long_pitch": 100, "cross_wire": 7, "cross_pitch": 200, "mass_kg_m2": 3.05},
    "C785":  {"long_wire": 10, "long_pitch": 100, "cross_wire": 6, "cross_pitch": 400, "mass_kg_m2": 6.72},
    "C636":  {"long_wire": 9,  "long_pitch": 100, "cross_wire": 6, "cross_pitch": 400, "mass_kg_m2": 5.55},
    "C503":  {"long_wire": 8,  "long_pitch": 100, "cross_wire": 5, "cross_pitch": 400, "mass_kg_m2": 4.34},
    "C385":  {"long_wire": 7,  "long_pitch": 100, "cross_wire": 5, "cross_pitch": 400, "mass_kg_m2": 3.41},
    "C283":  {"long_wire": 6,  "long_pitch": 100, "cross_wire": 5, "cross_pitch": 400, "mass_kg_m2": 2.61},
    "D98":   {"long_wire": 5,   "long_pitch": 200, "cross_wire": 5,   "cross_pitch": 200, "mass_kg_m2": 1.54},
    "D49":   {"long_wire": 2.5, "long_pitch": 100, "cross_wire": 2.5, "cross_pitch": 100, "mass_kg_m2": 0.77},
}

def fabric_lookup(reference: str) -> dict:
    if reference not in FABRIC_TYPES:
        raise ValueError(f"Unknown fabric reference: {reference}")
    return FABRIC_TYPES[reference]


# ---------------------------------------------------------------------------
# Material-grade symbol lookup by era (see 02_engineering_knowledge.json for
# full detail / caveats about ambiguous OCR alignment in the final period)
# ---------------------------------------------------------------------------

MATERIAL_ERAS = {
    "1972-1980": {"R": None, "T": None},  # CP110 pre-symbol-table era (hot rolled/cold worked only)
    "1980-1983": {"R": "grade 250", "T": "grade 460/425 Type 2 deformed", "X": "not covered by R/T"},
    "1983-1985": {"R": "grade 250 (implied continuity)", "T": "grade 460"},
    "1985-2004": {"R": 250, "T": 460, "S": "stainless", "W": 460, "D": None, "X": None},
    "post-2000-BS8666": {"R": 250, "F": 460, "D": 460, "W": 460, "T": 460, "B": "stainless (BS6744)", "S": None, "X": None},
}

def material_symbol_lookup(era: str, symbol: str):
    if era not in MATERIAL_ERAS:
        raise ValueError(f"Unknown era: {era}. Options: {list(MATERIAL_ERAS)}")
    return MATERIAL_ERAS[era].get(symbol, "symbol not defined for this era")


# ---------------------------------------------------------------------------
# BarGeometry — engineering object proposed for downstream DXF rendering
# ---------------------------------------------------------------------------

@dataclass
class BarGeometry:
    bar_mark: str
    shape_code: str
    bar_size_mm: float
    dimensions: dict          # e.g. {"A": 800, "B": 300}
    bar_type_symbol: str
    total_length_mm: float = field(init=False)

    def __post_init__(self):
        tb1 = table_b1_lookup(self.bar_size_mm)
        kwargs = dict(self.dimensions)
        kwargs.setdefault("r", tb1["r"])
        kwargs.setdefault("d", self.bar_size_mm)
        self.total_length_mm = shape_length(self.shape_code, **kwargs)


if __name__ == "__main__":
    # Minimal smoke tests — see 11_validation_cases.json for the full set
    # matching worked figures directly from the source where available.
    tb1 = table_b1_lookup(16)
    print("Table B.1, 16mm bar:", tb1)

    L = shape_length("11", A=800, B=300, r=tb1["r"], d=16)
    print("Shape 11 length (A=800,B=300,d=16):", round(L, 1), "mm")

    anch_L = l_bar_anchorage_length(bar_size_mm=16, mandrel_dia_mm=4 * 16)
    print("L-bar anchorage (16mm, mandrel=4d):", round(anch_L, 1), "mm  "
          "(source table value at ratio=4, bar=16: 204mm)")

    anch_U = u_bar_anchorage_length(bar_size_mm=16, mandrel_dia_mm=4 * 16)
    print("U-bar anchorage (16mm, mandrel=4d):", round(anch_U, 1), "mm  "
          "(source table value at ratio=4, bar=16: 294mm)")

    print("Hook min depth, 20mm bar:", u_bar_min_overall_depth(20, "hook"), "mm")
    print("Governing bend mandrel, 25mm bar (no load data):",
          governing_bend_mandrel(25), "mm")
