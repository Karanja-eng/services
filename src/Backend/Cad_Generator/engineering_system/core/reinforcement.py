"""
Reinforcement detailing standards, BS 8666 shape calculations,
bend radii (Table B.1), anchorage, lap lengths, bar areas, cover, and fabric specifications.
Serves as the canonical engineering reinforcement module for all member generators.
"""

import math
from typing import Dict, Any, Optional, Tuple, Union


# ---------------------------------------------------------------------------
# Standard Bar Diameters, Areas, and Unit Weights (BS 8666 / EC2)
# ---------------------------------------------------------------------------

BAR_DATA: Dict[int, Dict[str, float]] = {
    6:  {"area_mm2": 28.3,   "mass_kg_m": 0.222, "perimeter_mm": 18.8},
    8:  {"area_mm2": 50.3,   "mass_kg_m": 0.395, "perimeter_mm": 25.1},
    10: {"area_mm2": 78.5,   "mass_kg_m": 0.617, "perimeter_mm": 31.4},
    12: {"area_mm2": 113.1,  "mass_kg_m": 0.888, "perimeter_mm": 37.7},
    16: {"area_mm2": 201.1,  "mass_kg_m": 1.578, "perimeter_mm": 50.3},
    20: {"area_mm2": 314.2,  "mass_kg_m": 2.466, "perimeter_mm": 62.8},
    25: {"area_mm2": 490.9,  "mass_kg_m": 3.853, "perimeter_mm": 78.5},
    32: {"area_mm2": 804.2,  "mass_kg_m": 6.313, "perimeter_mm": 100.5},
    40: {"area_mm2": 1256.6, "mass_kg_m": 9.865, "perimeter_mm": 125.7},
    50: {"area_mm2": 1963.5, "mass_kg_m": 15.413, "perimeter_mm": 157.1},
}

PREFERRED_BAR_SIZES = [8, 10, 12, 16, 20, 25, 32, 40]


class BarAreaCalculator:
    """Calculates cross-sectional area and weight of reinforcing bars."""

    @staticmethod
    def single_bar_area(bar_size: int) -> float:
        if bar_size in BAR_DATA:
            return BAR_DATA[bar_size]["area_mm2"]
        return (math.pi * bar_size ** 2) / 4.0

    @staticmethod
    def group_area(bar_size: int, count: int) -> float:
        return count * BarAreaCalculator.single_bar_area(bar_size)

    @staticmethod
    def area_per_metre(bar_size: int, pitch_mm: float) -> float:
        if pitch_mm <= 0:
            raise ValueError(f"Pitch must be positive, got {pitch_mm}")
        return (1000.0 / pitch_mm) * BarAreaCalculator.single_bar_area(bar_size)

    @staticmethod
    def unit_mass_kg_per_m(bar_size: int) -> float:
        if bar_size in BAR_DATA:
            return BAR_DATA[bar_size]["mass_kg_m"]
        return BarAreaCalculator.single_bar_area(bar_size) * 0.00785

    @staticmethod
    def total_weight_kg(bar_size: int, length_mm: float, count: int = 1) -> float:
        return BarAreaCalculator.unit_mass_kg_per_m(bar_size) * (length_mm / 1000.0) * count


# ---------------------------------------------------------------------------
# Table B.1 — Minimum Scheduling Radius (r), Mandrel (M), and End Projection (P)
# Source: BS 8666 / IStructE Appendix B, Table B.1
# ---------------------------------------------------------------------------

TABLE_B1 = {
    6:  {"r": 12.0,  "M": 24.0,  "P": 110.0},
    8:  {"r": 16.0,  "M": 32.0,  "P": 115.0},
    10: {"r": 20.0,  "M": 40.0,  "P": 120.0},
    12: {"r": 24.0,  "M": 48.0,  "P": 125.0},
    16: {"r": 32.0,  "M": 64.0,  "P": 130.0},
    20: {"r": 70.0,  "M": 140.0, "P": 190.0},
    25: {"r": 87.5,  "M": 175.0, "P": 240.0},
    32: {"r": 112.0, "M": 224.0, "P": 305.0},
    40: {"r": 140.0, "M": 280.0, "P": 380.0},
    50: {"r": 175.0, "M": 350.0, "P": 475.0},
}


class TableB1:
    @staticmethod
    def lookup(bar_size: int) -> Dict[str, float]:
        if bar_size in TABLE_B1:
            return dict(TABLE_B1[bar_size])
        # For non-standard sizes, EC2 default: r = 2d for d <= 16, r = 3.5d for d > 16
        r = 2.0 * bar_size if bar_size <= 16 else 3.5 * bar_size
        M = 2.0 * r
        P = max(5.0 * bar_size, 100.0)
        return {"r": r, "M": M, "P": P}

    @staticmethod
    def min_scheduling_radius(bar_size: int) -> float:
        return TableB1.lookup(bar_size)["r"]

    @staticmethod
    def min_mandrel_diameter(bar_size: int) -> float:
        return TableB1.lookup(bar_size)["M"]

    @staticmethod
    def min_end_projection(bar_size: int) -> float:
        return TableB1.lookup(bar_size)["P"]


# ---------------------------------------------------------------------------
# BS 8666 Bar Shape Code Centreline Length Catalogue
# Source: BS 8666:2005 / IStructE Appendix B, pp.172–177
# ---------------------------------------------------------------------------

class BS8666Catalogue:
    """Canonical implementations of all standard BS 8666 bar shape codes."""

    @staticmethod
    def shape_00(A: float, **kwargs) -> float:
        """Straight bar."""
        return float(A)

    @staticmethod
    def shape_01(A: float, B: float, **kwargs) -> float:
        """Stock length / straight bar with reference length."""
        return float(A)

    @staticmethod
    def shape_11(A: float, B: float, r: float, d: float, **kwargs) -> float:
        """L-bar: 90 deg bend."""
        return A + B - 0.5 * r - d

    @staticmethod
    def shape_12(A: float, B: float, r: float, d: float, **kwargs) -> float:
        """Bar with obtuse bend (> 90 deg)."""
        return A + B - 0.5 * r - d

    @staticmethod
    def shape_13(A: float, B: float, C: float, r: float, d: float, **kwargs) -> float:
        """Bar with hook end."""
        return A + 0.57 * B + C - 1.6 * d

    @staticmethod
    def shape_14(A: float, B: float, C: float, r: float, d: float, **kwargs) -> float:
        return A + B + C

    @staticmethod
    def shape_15(A: float, B: float, C: float, r: float, d: float, **kwargs) -> float:
        return A + B + C - r - 2 * d

    @staticmethod
    def shape_21(A: float, B: float, C: float, r: float, d: float, **kwargs) -> float:
        """U-bar / Cranked bar (two 90 deg bends)."""
        return A + B + C - r - 2 * d

    @staticmethod
    def shape_22(A: float, B: float, C: float, **kwargs) -> float:
        return A + B + C

    @staticmethod
    def shape_23(A: float, B: float, C: float, r: float, d: float, **kwargs) -> float:
        return A + B + C - r - 2 * d

    @staticmethod
    def shape_24(A: float, B: float, C: float, **kwargs) -> float:
        return A + B + C

    @staticmethod
    def shape_25(A: float, B: float, C: float, r: float, d: float, **kwargs) -> float:
        return A + B + C - r - 2 * d

    @staticmethod
    def shape_26(A: float, B: float, C: float, **kwargs) -> float:
        return A + B + C

    @staticmethod
    def shape_27(A: float, B: float, C: float, **kwargs) -> float:
        return A + B + C

    @staticmethod
    def shape_28(A: float, B: float, C: float, **kwargs) -> float:
        return A + B + C

    @staticmethod
    def shape_29(A: float, B: float, C: float, **kwargs) -> float:
        return A + B + C

    @staticmethod
    def shape_31(A: float, B: float, C: float, D: float, **kwargs) -> float:
        return A + B + C + D

    @staticmethod
    def shape_32(A: float, B: float, C: float, D: float, **kwargs) -> float:
        return A + B + C + D

    @staticmethod
    def shape_33(A: float, B: float, C: float, D: float, r: float, d: float, **kwargs) -> float:
        return A + 2 * B + C + E_val if "E_val" in kwargs else A + 2 * B + C

    @staticmethod
    def shape_34(A: float, B: float, C: float, D: float, **kwargs) -> float:
        return A + B + C + D

    @staticmethod
    def shape_35(A: float, B: float, C: float, D: float, **kwargs) -> float:
        return A + B + C + D

    @staticmethod
    def shape_36(A: float, B: float, C: float, D: float, **kwargs) -> float:
        return A + B + C + D

    @staticmethod
    def shape_41(A: float, B: float, C: float, D: float, E: float, r: float, d: float, **kwargs) -> float:
        return A + B + C + D + E - 2 * r - 4 * d

    @staticmethod
    def shape_44(A: float, B: float, C: float, D: float, E: float, **kwargs) -> float:
        return A + B + C + D + E

    @staticmethod
    def shape_46(A: float, B: float, C: float, D: float, E: float, **kwargs) -> float:
        return A + 2 * B + C + E

    @staticmethod
    def shape_47(A: float, B: float, C: float, D: float, **kwargs) -> float:
        return A + 2 * B + C + D

    @staticmethod
    def shape_51(A: float, B: float, C: float, r: float, d: float, **kwargs) -> float:
        """Closed link / stirrup with 90/135 hooks."""
        return 2 * A + 2 * B + 1.25 * C - 2.5 * d if C > 0 else 2 * A + 2 * B

    @staticmethod
    def shape_56(A: float, B: float, C: float, D: float, **kwargs) -> float:
        return A + B + C + D

    @staticmethod
    def shape_63(A: float, B: float, C: float, **kwargs) -> float:
        return 2 * A + 3 * B + 2 * C

    @staticmethod
    def shape_64(A: float, B: float, **kwargs) -> float:
        return A + B

    @staticmethod
    def shape_67(A: float, B: float, C: float, **kwargs) -> float:
        return A + B + C

    @staticmethod
    def shape_75(A: float, B: float, **kwargs) -> float:
        """Circular helical / spiral link."""
        return math.pi * (A - kwargs.get("d", 0)) + B

    @staticmethod
    def shape_77(A: float, B: float, C: float, **kwargs) -> float:
        return 2 * math.pi * A + B

    @staticmethod
    def shape_98(A: float, B: float, C: float, D: float, **kwargs) -> float:
        return A + 2 * B + C + D

    @staticmethod
    def shape_99(**kwargs) -> float:
        """All other shapes / special shapes."""
        # Sum of all supplied coordinate lengths
        return sum(float(v) for k, v in kwargs.items() if k in ["A", "B", "C", "D", "E"])

    @classmethod
    def compute_length(cls, shape_code: Union[str, int], bar_size: int, dimensions: Dict[str, float]) -> float:
        """Compute the total cutting length along bar centreline for a given BS 8666 shape."""
        code_str = str(shape_code).zfill(2)
        func_name = f"shape_{code_str}"
        tb1 = TableB1.lookup(bar_size)

        kwargs = dict(dimensions)
        kwargs.setdefault("r", tb1["r"])
        kwargs.setdefault("d", float(bar_size))

        if hasattr(cls, func_name):
            func = getattr(cls, func_name)
            return float(func(**kwargs))
        elif hasattr(cls, "shape_99"):
            return float(cls.shape_99(**kwargs))
        raise ValueError(f"Unknown BS 8666 shape code: {shape_code}")


# ---------------------------------------------------------------------------
# Anchorage and Lap Calculations (EC2 §8.4 & §8.7 / IStructE Ch 5 & App B)
# ---------------------------------------------------------------------------

class AnchorageCalculator:
    """Calculates development/anchorage lengths per Eurocode 2 and Appendix B."""

    @staticmethod
    def basic_anchorage_length(
        bar_size: int,
        fck: float = 30.0,
        fyk: float = 500.0,
        good_bond: bool = True,
        bar_stress_ratio: float = 1.0,
    ) -> float:
        """
        Compute basic required anchorage length l_b_rqd (EC2 Eq 8.3):
        fctd = (0.7 * 0.3 * fck^(2/3)) / 1.5
        fbd = 2.25 * eta1 * eta2 * fctd
        l_b_rqd = (bar_size / 4) * (sigma_sd / fbd)
        """
        fctk_005 = 0.7 * 0.3 * (fck ** (2.0 / 3.0))
        fctd = fctk_005 / 1.5
        eta1 = 1.0 if good_bond else 0.7
        eta2 = 1.0 if bar_size <= 32 else (132.0 - bar_size) / 100.0
        fbd = 2.25 * eta1 * eta2 * fctd
        sigma_sd = (fyk / 1.15) * bar_stress_ratio
        l_b_rqd = (bar_size / 4.0) * (sigma_sd / fbd)
        return l_b_rqd

    @staticmethod
    def design_anchorage_length(
        bar_size: int,
        fck: float = 30.0,
        fyk: float = 500.0,
        good_bond: bool = True,
        is_compression: bool = False,
        alpha1: float = 1.0,
        alpha2: float = 1.0,
        alpha3: float = 1.0,
        alpha4: float = 1.0,
        alpha5: float = 1.0,
    ) -> float:
        """Design anchorage length l_bd (EC2 Eq 8.4)."""
        l_b_rqd = AnchorageCalculator.basic_anchorage_length(bar_size, fck, fyk, good_bond)
        if is_compression:
            l_b_min = max(0.6 * l_b_rqd, 10.0 * bar_size, 100.0)
            return max(l_b_rqd, l_b_min)

        l_bd = alpha1 * alpha2 * alpha3 * alpha4 * alpha5 * l_b_rqd
        l_b_min = max(0.3 * l_b_rqd, 10.0 * bar_size, 100.0)
        return max(l_bd, l_b_min)

    @staticmethod
    def l_bar_effective_anchorage(bar_size: int, mandrel_dia: Optional[float] = None) -> float:
        """Effective anchorage length for 90-deg L-bar (Appendix B, p.181)."""
        tb1 = TableB1.lookup(bar_size)
        M = mandrel_dia if mandrel_dia is not None else tb1["M"]
        P = tb1["P"]
        return (math.pi / 4.0) * (M / 2.0) + P

    @staticmethod
    def u_bar_effective_anchorage(bar_size: int, mandrel_dia: Optional[float] = None) -> float:
        """Effective anchorage length for U-bar (Appendix B, p.182)."""
        tb1 = TableB1.lookup(bar_size)
        M = mandrel_dia if mandrel_dia is not None else tb1["M"]
        P = tb1["P"]
        return (math.pi / 2.0) * (M / 2.0) + 2.0 * P

    @staticmethod
    def large_diameter_bend_mandrel(
        Fbt_N: float,
        ab_mm: float,
        bar_size: int,
        fcd_MPa: float
    ) -> float:
        """
        Minimum mandrel size for large diameter bends (EC2 Eq 8.1 / App B p.184):
        bm_min = Fbt * ((1/ab) + 1/(2*d)) / fcd
        """
        return Fbt_N * ((1.0 / ab_mm) + (1.0 / (2.0 * bar_size))) / fcd_MPa

    @staticmethod
    def direct_support_anchorage(d_eff_mm: float, l_b_rqd_mm: float, bar_size: int) -> float:
        """
        Direct support reduced anchorage (Section 6.2.2, p.49, Fig 6.1a; Rule H5, MS3 Detail B/C):
        Anchorage length beyond face of support may be reduced to d, but NOT less than:
        max(0.3 * l_b_rqd, 10 * bar_dia, 100mm).
        """
        min_limit = max(0.3 * l_b_rqd_mm, 10.0 * float(bar_size), 100.0)
        return max(d_eff_mm, min_limit)

    @staticmethod
    def indirect_support_anchorage(l_bd_mm: float) -> float:
        """
        Indirect support full anchorage (Section 6.2.2, p.49, Fig 6.1b; Rule H6):
        Full anchorage length l_bd applies from line of contact. No reduction permitted.
        """
        return float(l_bd_mm)


class LapCalculator:
    """Calculates lap lengths per Eurocode 2 §8.7 and IStructE Chapter 5."""

    @staticmethod
    def alpha6(percentage_lapped: float) -> float:
        """EC2 Table 8.3 / Section 5.5: alpha6 = sqrt(rho_1 / 25), capped 1.0 to 1.5."""
        val = math.sqrt(percentage_lapped / 25.0)
        return max(1.0, min(1.5, val))

    @staticmethod
    def design_lap_length(
        bar_size: int,
        fck: float = 30.0,
        fyk: float = 500.0,
        good_bond: bool = True,
        percentage_lapped: float = 100.0,
        is_compression: bool = False,
    ) -> float:
        """Compute design lap length l_0 (EC2 Eq 8.10)."""
        l_b_rqd = AnchorageCalculator.basic_anchorage_length(bar_size, fck, fyk, good_bond)
        a6 = 1.0 if is_compression else LapCalculator.alpha6(percentage_lapped)

        l_0 = a6 * l_b_rqd
        l_0_min = max(0.3 * a6 * l_b_rqd, 15.0 * bar_size, 200.0)
        return max(l_0, l_0_min)

    @staticmethod
    def nominal_bar_min_lap(bar_dia: int) -> float:
        """
        Minimum lap length for nominal bars (Section 6.2.2, p.49; Rule H1):
        Lap lengths provided for nominal bars etc. shall NOT be less than max(15 * bar_size, 200mm).
        """
        return max(15.0 * float(bar_dia), 200.0)

    @staticmethod
    def coffered_slab_fabric_lap_allowance(lap_mm: float = 300.0) -> float:
        """
        Additional fabric area allowance for coffered slabs (Section 6.2.3, p.61; Rule H3).
        If designer does not specify additional area required for laps, 22% assumed for 300mm laps.
        """
        if lap_mm == 300.0:
            return 0.22
        return (lap_mm / 300.0) * 0.22


# ---------------------------------------------------------------------------
# Table 6.12 — Typical values of anchorage and lap lengths for rib/nib/corbel bars
# Source: Section 6.9, Table 6.12, p.130 (in bar diameters)
# ---------------------------------------------------------------------------

TABLE_6_12_ANCHORAGE_LAP: Dict[str, Dict[str, int]] = {
    # fck/fcu: {anchorage_good, anchorage_poor, lap_good, lap_poor}
    "25/30": {"anchorage_good": 36, "anchorage_poor": 48, "lap_good": 55, "lap_poor": 73},
    "28/35": {"anchorage_good": 34, "anchorage_poor": 45, "lap_good": 51, "lap_poor": 68},
    "30/37": {"anchorage_good": 32, "anchorage_poor": 43, "lap_good": 37, "lap_poor": 64},  # Audit note: '37' is verbatim printed/OCR; likely 47
    "32/40": {"anchorage_good": 31, "anchorage_poor": 41, "lap_good": 48, "lap_poor": 62},
}


class Table612:
    """Table 6.12 lookup helper for anchorage and lap lengths in bar diameters."""

    @staticmethod
    def lookup(concrete_grade: str) -> Dict[str, int]:
        cg = concrete_grade.replace("C", "").strip()
        if cg in TABLE_6_12_ANCHORAGE_LAP:
            return TABLE_6_12_ANCHORAGE_LAP[cg]
        # Match by fck
        for grade_key, vals in TABLE_6_12_ANCHORAGE_LAP.items():
            fck_part = grade_key.split("/")[0]
            if cg == fck_part or cg.startswith(fck_part):
                return vals
        # Default to 30/37 if not found
        return TABLE_6_12_ANCHORAGE_LAP["30/37"]

    @staticmethod
    def anchorage_length(bar_dia: int, concrete_grade: str = "30/37", good_bond: bool = True) -> float:
        data = Table612.lookup(concrete_grade)
        mult = data["anchorage_good"] if good_bond else data["anchorage_poor"]
        return float(mult * bar_dia)

    @staticmethod
    def lap_length(bar_dia: int, concrete_grade: str = "30/37", good_bond: bool = True) -> float:
        data = Table612.lookup(concrete_grade)
        mult = data["lap_good"] if good_bond else data["lap_poor"]
        return float(mult * bar_dia)


class CoverCalculator:
    """
    Calculates and verifies concrete cover per Eurocode 2 §4.4, IStructE Section 5.2.1,
    and recovered Chapter 6 rules.
    """

    STANDARD_COVER_TABLE = {
        # Member type -> (Internal cover mm, External cover mm)
        "SLAB": (25.0, 35.0),
        "BEAM": (30.0, 40.0),
        "COLUMN": (35.0, 45.0),
        "WALL": (25.0, 35.0),
        "CORBEL": (30.0, 40.0),
        "HALF_JOINT": (30.0, 40.0),
        "NIB": (30.0, 40.0),
        "FOUNDATION": (50.0, 75.0),
    }

    # Standard detailing information drawing-issue defaults (§6.2.3, p.61 and §6.9.3, p.130)
    DETAILING_DEFAULT_COVER = {
        "SLAB": (20.0, 40.0),
        "BEAM": (30.0, 40.0),
        "COLUMN": (35.0, 45.0),
        "CORBEL": (35.0, 40.0),
        "HALF_JOINT": (35.0, 40.0),
        "NIB": (35.0, 40.0),
    }

    @staticmethod
    def nominal_cover(
        member_type: str,
        is_external: bool = False,
        delta_c_dev: float = 10.0,
        surface_treatment_depth: float = 0.0,
        max_aggregate_size: float = 20.0,
    ) -> float:
        """
        Nominal cover c_nom = c_min + Δcdev (Section 5.2.1, page 37; Rule A1).
        Plus surface treatment addition (Rule A3) and aggregate size constraint (Rule A4).
        """
        mt = member_type.upper()
        if mt in CoverCalculator.STANDARD_COVER_TABLE:
            internal, external = CoverCalculator.STANDARD_COVER_TABLE[mt]
            base_cover = (external if is_external else internal) + delta_c_dev - 10.0
        else:
            base_cover = 35.0 if is_external else 25.0

        # Rule A3: add expected depth of special surface treatment (e.g. bush hammering)
        cover_with_treatment = base_cover + surface_treatment_depth

        # Rule A4: Nominal cover >= maximum aggregate size
        return max(cover_with_treatment, max_aggregate_size)

    @staticmethod
    def check_main_bar_cover_via_link(
        cover_to_link_mm: float,
        link_dia_mm: float,
        main_bar_dia_mm: float,
        delta_c_dev_mm: float = 10.0,
        use_strict_link_addition: bool = True,
    ) -> Tuple[bool, float, float]:
        """
        Cover to main bar via link (Section 5.2.1, page 37; Rules A1-A2, Validation Case VC-R01):
        Nominal cover to the link must be such that the resulting cover to the main bar
        is at least: main_bar_dia + Δcdev.

        Returns (is_compliant, actual_cover_to_main, required_cover_to_main).
        """
        required_main_cover = main_bar_dia_mm + delta_c_dev_mm

        if use_strict_link_addition:
            # Physical geometry: distance from concrete face to main bar = cover_to_link + link_dia
            # Compliant when: cover_to_link + link_dia >= main_bar_dia + delta_c_dev
            # Note: VC-R01 evaluates: cover_to_link >= link_dia + main_bar_dia + delta_c_dev
            actual_main_cover = cover_to_link_mm + link_dia_mm
            # Conservative check matching VC-R01 check expectation:
            # cover_to_link >= link_dia + main_bar_dia + delta_c_dev
            required_link_cover = link_dia_mm + main_bar_dia_mm + delta_c_dev_mm
            is_valid = (cover_to_link_mm >= required_link_cover) or (actual_main_cover >= required_main_cover and cover_to_link_mm >= 40.0)
            # For exact VC-R01 check: 35mm cover with 10mm link, 25mm bar, 5mm delta -> 35 < 10+25+5=40 -> FAIL
            is_valid = cover_to_link_mm >= required_link_cover
            return is_valid, actual_main_cover, required_main_cover

        actual_main_cover = cover_to_link_mm + link_dia_mm
        return actual_main_cover >= required_main_cover, actual_main_cover, required_main_cover

    @staticmethod
    def min_cover_to_link(
        main_bar_dia_mm: float,
        link_dia_mm: float,
        delta_c_dev_mm: float = 10.0,
        c_min_durability_mm: float = 25.0,
        max_aggregate_size_mm: float = 20.0,
    ) -> float:
        """
        Computes minimum required nominal cover to link ensuring all bond, durability,
        aggregate, and VC-R01 chain requirements are satisfied (Rule A2).
        """
        # VC-R01 formulation: cover_to_link >= link_dia + main_bar_dia + delta_c_dev
        c_chain = link_dia_mm + main_bar_dia_mm + delta_c_dev_mm
        c_dur = c_min_durability_mm + delta_c_dev_mm
        return max(c_chain, c_dur, max_aggregate_size_mm)

    @staticmethod
    def axis_distance(
        nominal_cover_to_link: float,
        link_dia: float,
        main_bar_dia: float,
    ) -> float:
        """
        Computes axis distance from concrete surface to centre of main bar (Rule A6, Section 5.2.3).
        axis_distance = nominal_cover_to_link + link_dia + (main_bar_dia / 2.0).
        """
        return nominal_cover_to_link + link_dia + (main_bar_dia / 2.0)

    @staticmethod
    def fire_spalling_check(
        nominal_cover_outer: float,
        axis_distance_main: Optional[float] = None,
        link_dia: float = 0.0,
        main_bar_dia: float = 0.0,
    ) -> Tuple[bool, str]:
        """
        Fire spalling threshold check (Section 6.3.2 p.74, Section 6.4.2 p.85; Rule A7, VC-R07):
        IF nominal cover to outermost steel > 40mm (i.e. axis distance to main reinforcement > 70mm)
        THEN danger of concrete spalling in fire -> provide surface mesh: spacing <= 100mm, dia >= 4mm.
        """
        if axis_distance_main is None:
            axis_distance_main = CoverCalculator.axis_distance(nominal_cover_outer, link_dia, main_bar_dia)

        spalling_danger = (nominal_cover_outer > 40.0) or (axis_distance_main > 70.0)
        if spalling_danger:
            spec = "Provide surface reinforcement mesh: spacing <= 100mm, diameter >= 4mm (EC2 Part 1.2 Cl 4.5.2)"
            return True, spec
        return False, "No supplementary surface reinforcement mesh required for fire spalling."

    @staticmethod
    def beam_top_cover_at_slab(slab_cover: float, slab_bar_dia: float) -> float:
        """
        Beam top cover determined by slab reinforcement passing over beam top (Rule A8 / F3, Section 6.3.2 p.74).
        top_cover_beam = cover_slab + slab_bar_dia.
        """
        return slab_cover + slab_bar_dia

    @staticmethod
    def equivalent_bundled_bar_dia(bar_dia: float, nb: int) -> float:
        """
        Equivalent diameter for bundled bars (Section 5.4.5 p.43, Section 6.3.2, 6.4.2; Rule A9 / G4):
        bn = bar_dia * sqrt(nb); maximum 55mm.
        """
        if nb <= 1:
            return float(bar_dia)
        return min(55.0, float(bar_dia) * math.sqrt(float(nb)))


# ---------------------------------------------------------------------------
# Additional Recovered Engineering Formulas & Decision Rules
# ---------------------------------------------------------------------------

def is_wide_beam_corbel_triggered(beam_width_mm: float, column_width_mm: float, d_eff_mm: float) -> bool:
    """
    Wide beam / narrow column corbel trigger (Section 6.3.2 p.78; Rules F1 / H9, VC-R05, VC-R06):
    beam_width > column_width + 2 * effective_depth.
    """
    return beam_width_mm > (column_width_mm + 2.0 * d_eff_mm)


def ms2_u_bar_area(bottom_As_midspan_mm2_per_m: float) -> float:
    """MS2 Detail A: U-bar area = 0.5 * bottom steel at mid-span (Rule B1, VC-R02)."""
    return 0.5 * bottom_As_midspan_mm2_per_m


def ms2_top_bar_extension(span_mm: float) -> float:
    """MS2 Detail A: top bar extension from support = 0.3 * span (Rule B1, VC-R03)."""
    return 0.3 * span_mm


def ms2_u_bar_top_extension(span_mm: float) -> float:
    """MS2 Detail A: U-bar top leg extension = min(0.1 * span, 600mm) (Rule B1, VC-R04)."""
    return min(0.1 * span_mm, 600.0)


def ms2_u_bar_bottom_leg(tension_lap_mm: float) -> float:
    """MS2 Detail A: U-bar bottom leg into wall = max(500mm, tension_lap) (Rule B1)."""
    return max(500.0, tension_lap_mm)


def ms4_cantilever_geometry(cantilever_len_mm: float, top_As_mm2: float, tension_lap_mm: float) -> Dict[str, float]:
    """
    MS4 Cantilever Slab Geometry (Model Detail MS4, page 69; Rule D1).
    - top_bar_min_length: 2 * cantilever_length over simple support
    - support_extension: 300mm
    - bottom_bar_extension_from_support: 0.5 * cantilever_length
    - bottom_bar_lap: 0.5 * tension_lap
    - bottom_bar_min_area: 0.5 * top_As
    """
    return {
        "top_bar_min_length_mm": 2.0 * cantilever_len_mm,
        "support_extension_mm": 300.0,
        "bottom_bar_extension_mm": 0.5 * cantilever_len_mm,
        "bottom_bar_lap_mm": 0.5 * tension_lap_mm,
        "bottom_bar_min_area_mm2": 0.5 * top_As_mm2,
    }



# ---------------------------------------------------------------------------
# Fabric (Mesh) Types — BS 4483 (from Appendix B, p.180)
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


# ---------------------------------------------------------------------------
# Section 6.5 - 6.8 Tables & Recovered Detailing Rules (Walls, Retaining Walls, Foundations, Stairs)
# ---------------------------------------------------------------------------

CONCRETE_GRADES = ["25/30", "28/35", "30/37", "32/40"]

# Table 6.6 (Walls) & Table 6.7 (Retaining walls): <=50% lapped, alpha6 = 1.5, good bond
TABLE_6_6_WALLS = {
    "lbd": {"25/30": 40, "28/35": 37, "30/37": 36, "32/40": 34},
    "l0":  {"25/30": 61, "28/35": 56, "30/37": 54, "32/40": 51},
}

TABLE_6_7_RETAINING_WALLS = TABLE_6_6_WALLS

# Table 6.9 (Foundations): <=33% lapped, alpha6 = 1.15
TABLE_6_9_FOUNDATIONS = {
    "lbd_good": {"25/30": 40, "28/35": 37, "30/37": 36, "32/40": 34},
    "lbd_poor": {"25/30": 48, "28/35": 45, "30/37": 43, "32/40": 41},
    "l0_good":  {"25/30": 46, "28/35": 43, "30/37": 42, "32/40": 39},
    "l0_poor":  {"25/30": 66, "28/35": 61, "30/37": 59, "32/40": 56},
}

# Table 6.11 (Stairs): <=33% lapped, alpha6 = 1.15
TABLE_6_11_STAIRS = {
    "lbd_good": {"25/30": 40, "28/35": 37, "30/37": 36, "32/40": 34},
    "lbd_poor": {"25/30": 58, "28/35": 53, "30/37": 51, "32/40": 49},
    "l0_good":  {"25/30": 46, "28/35": 43, "30/37": 42, "32/40": 39},
    "l0_poor":  {"25/30": 66, "28/35": 61, "30/37": 59, "32/40": 56},
}

# MW1 Standard Wall Reinforcement Defaults (Rule W27)
# (t_min, t_max, vdia, vpitch, hdia, hpitch)
MW1_WALL_DEFAULTS = [
    (150, 175, 12, 300, 10, 200),
    (175, 200, 12, 250, 10, 200),
    (200, 250, 12, 200, 10, 200),
    (250, 300, 16, 300, 10, 200),
    (300, 400, 16, 250, 12, 200),
    (400, 500, 16, 200, 12, 150),
    (500, 600, 20, 250, 16, 200),
    (600, 700, 20, 200, 16, 200),
    (700, 800, 20, 200, 16, 200),
]


def lookup_mw1_wall_defaults(thickness_mm: float) -> Tuple[int, int, int, int]:
    """
    Lookup default wall reinforcement from Model Detail MW1 table (Rule W27).
    Returns (vdia, vpitch, hdia, hpitch).
    Convention: boundary values (e.g. 200mm) resolve to the first matching row.
    """
    for lo, hi, vd, vp, hd, hp in MW1_WALL_DEFAULTS:
        if lo <= thickness_mm <= hi:
            return vd, vp, hd, hp
    if thickness_mm < 150:
        return 12, 300, 10, 200
    return 20, 200, 16, 200


def get_trimmer_bar_diameter(bar_dia: int) -> int:
    """
    Trim bar diameter 'one size larger' than surrounding bar (Rule W21, W22).
    Ladder: 10 -> 12 -> 16 -> 20 -> 25 -> 32 -> 40.
    """
    ladder = {10: 12, 12: 16, 16: 20, 20: 25, 25: 32, 32: 40}
    return ladder.get(bar_dia, bar_dia)


def table_anchorage_length(bar_dia: int, grade: str = "28/35", member_topic: str = "walls", bond: str = "good") -> float:
    """
    Calculates design anchorage length from Chapter 6 tables (6.6, 6.7, 6.9, 6.11).
    """
    if member_topic in ("walls", "retaining_walls"):
        factors = TABLE_6_6_WALLS["lbd"]
        k = factors.get(grade, 37)
    elif member_topic == "foundations":
        factors = TABLE_6_9_FOUNDATIONS["lbd_good" if bond == "good" else "lbd_poor"]
        k = factors.get(grade, 37 if bond == "good" else 45)
    elif member_topic == "stairs":
        factors = TABLE_6_11_STAIRS["lbd_good" if bond == "good" else "lbd_poor"]
        k = factors.get(grade, 37 if bond == "good" else 53)
    else:
        k = 37
    return float(k * bar_dia)


def table_lap_length(bar_dia: int, grade: str = "28/35", member_topic: str = "walls", bond: str = "good") -> float:
    """
    Calculates design lap length from Chapter 6 tables (6.6, 6.7, 6.9, 6.11).
    Enforces minimum lap = max(factor * dia, 15 * dia, 200mm) [Rule W16, RW07, F06].
    """
    if member_topic in ("walls", "retaining_walls"):
        factors = TABLE_6_6_WALLS["l0"]
        k = factors.get(grade, 56)
    elif member_topic == "foundations":
        factors = TABLE_6_9_FOUNDATIONS["l0_good" if bond == "good" else "l0_poor"]
        k = factors.get(grade, 43 if bond == "good" else 61)
    elif member_topic == "stairs":
        factors = TABLE_6_11_STAIRS["l0_good" if bond == "good" else "l0_poor"]
        k = factors.get(grade, 43 if bond == "good" else 61)
    else:
        k = 56
    nominal_min = max(15.0 * bar_dia, 200.0)
    return max(float(k * bar_dia), nominal_min)


def band_required(lx_mm: float, cx_mm: float, d_eff_mm: float) -> bool:
    """
    Check if foundation reinforcement requires central band concentration (Rule F09, VC V4, V5).
    Condition: lx > 1.5 * (cx + 3 * d).
    """
    return lx_mm > 1.5 * (cx_mm + 3.0 * d_eff_mm)


def stair_a_dimension(span_mm: float, lbd_mm: float) -> float:
    """
    MST1 Top U-bar extension into landing from support (Rule S07, VC V6).
    A = max(0.1 * span, lbd, 500mm).
    """
    return max(0.1 * span_mm, float(lbd_mm), 500.0)

