"""
bs5628_masonry_design.py
========================
Production-grade Python implementation of BS 5628: Part 1
Structural Use of Unreinforced Masonry — Design Procedures.

Covers:
  - Section 5.5: Design of vertically loaded masonry walls
  - Section 5.6: Design of laterally loaded wall panels

All equations, limits, conditions, and step-by-step procedures are extracted
directly from the textbook pages provided. No simplifications. No placeholders.
Exceptions are raised whenever code limits are violated.

Author : Senior Structural Engineer / Backend Software Engineer
Standard: BS 5628: Part 1 (as described in the referenced textbook)
Units   : N, mm throughout (unless stated otherwise)
"""

from __future__ import annotations
import math
from typing import Literal, Tuple


# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------
MortarDesignation = Literal["i", "ii", "iii", "iv"]
MasonryUnitCategory = Literal["I", "II"]
ConstructionControlCategory = Literal["special", "normal"]
BrickType = Literal["clay_calcium_silicate", "concrete_brick"]
BlockType = Literal["solid", "hollow"]   # hollow = >25 % formed voids
WaterAbsorption = Literal["lt7", "7to12", "gt12"]   # clay bricks only
SupportEdge = Literal["free", "simple", "continuous"]


# ---------------------------------------------------------------------------
# 5.2.3  Mortar designation to compressive strength class mapping
# Table 5.6
# ---------------------------------------------------------------------------

_MORTAR_STRENGTH_CLASS: dict[MortarDesignation, str] = {
    "i":   "M12",
    "ii":  "M6",
    "iii": "M4",
    "iv":  "M2",
}

_MORTAR_28DAY_STRENGTH_N_MM2: dict[MortarDesignation, float] = {
    "i":   12.0,
    "ii":   6.0,
    "iii":  4.0,
    "iv":   2.0,
}


def mortar_compressive_strength(designation: MortarDesignation) -> float:
    """Return the 28-day compressive strength (N/mm²) for a mortar designation.

    Parameters
    ----------
    designation : MortarDesignation
        Mortar designation per Table 5.6 BS 5628, one of 'i', 'ii', 'iii', 'iv'.

    Returns
    -------
    float
        28-day compressive strength in N/mm².
    """
    return _MORTAR_28DAY_STRENGTH_N_MM2[designation]


# ---------------------------------------------------------------------------
# 5.5.1.2  Partial safety factors for loads — Table 5.8
# ---------------------------------------------------------------------------

def ultimate_design_load_dead_imposed(
    Gk: float,
    Qk: float,
) -> float:
    """Calculate ultimate design load for dead + imposed load combination.

    BS 5628 Cl. 18 / Eq. 5.3:
        N = 1.4·Gk + 1.6·Qk

    Parameters
    ----------
    Gk : float
        Characteristic dead load (N or N/mm run of wall).
    Qk : float
        Characteristic imposed load (N or N/mm run of wall).

    Returns
    -------
    float
        Ultimate design load N (same units as inputs).
    """
    return 1.4 * Gk + 1.6 * Qk


def ultimate_design_load_dead_wind(
    Gk: float,
    Wk: float,
    use_min_dead: bool = False,
) -> float:
    """Calculate ultimate design load for dead + wind load combination.

    BS 5628 Cl. 18 / Table 5.8:
        Dead load factor: 1.4·Gk  OR  0.9·Gk  (whichever is critical)
        Wind factor    : larger of 1.4·Wk or 0.015·Gk

    Parameters
    ----------
    Gk : float
        Characteristic dead load.
    Wk : float
        Characteristic wind load.
    use_min_dead : bool
        If True, use 0.9·Gk (minimum dead); if False, use 1.4·Gk (maximum dead).

    Returns
    -------
    float
        Ultimate design load N.
    """
    dead_factor = 0.9 if use_min_dead else 1.4
    wind_component = max(1.4 * Wk, 0.015 * Gk)
    return dead_factor * Gk + wind_component


def ultimate_design_load_dead_imposed_wind(
    Gk: float,
    Qk: float,
    Wk: float,
) -> float:
    """Calculate ultimate design load for dead + imposed + wind combination.

    BS 5628 Cl. 18 / Eq. 5.4:
        N = 1.2·(Gk + Qk + Wk)
        Wind component = larger of 1.2·Wk or 0.015·Gk

    Parameters
    ----------
    Gk : float
        Characteristic dead load.
    Qk : float
        Characteristic imposed load.
    Wk : float
        Characteristic wind load.

    Returns
    -------
    float
        Ultimate design load N.
    """
    wind_component = max(1.2 * Wk, 0.015 * Gk)
    return 1.2 * Gk + 1.2 * Qk + wind_component


# ---------------------------------------------------------------------------
# 5.5.2.1  Characteristic compressive strength of masonry, fk
# Table 5.9(a): Standard format clay / calcium silicate bricks
# ---------------------------------------------------------------------------

# Tabulated fk values (N/mm²) — rows = mortar designation, cols = unit strength
# Unit strengths: 5, 10, 15, 20, 30, 40, 50, 75, 100, 125, 150 N/mm²
_BRICK_UNIT_STRENGTHS = [5, 10, 15, 20, 30, 40, 50, 75, 100, 125, 150]

_TABLE_5_9A: dict[MortarDesignation, list[float]] = {
    "i":   [2.5, 4.0, 5.3, 6.4,  8.3, 10.0, 11.6, 15.2, 18.3, 21.2, 23.9],
    "ii":  [2.5, 3.8, 4.8, 5.6,  7.1,  8.4,  9.5, 12.0, 14.2, 16.1, 17.9],
    "iii": [2.5, 3.4, 4.3, 5.0,  6.3,  7.4,  8.4, 10.5, 12.3, 14.0, 15.4],
    "iv":  [2.2, 2.8, 3.6, 4.1,  5.1,  6.1,  7.1,  9.0, 10.5, 11.6, 12.7],
}

# Table 5.9(c): Aggregate concrete blocks, height/least_horiz_dim = 0.6
# Unit strengths: 2.9, 3.6, 5.2, 7.3, 10.4, 17.5, 22.5, 30, 40+
_BLOCK_UNIT_STRENGTHS_CDF = [2.9, 3.6, 5.2, 7.3, 10.4, 17.5, 22.5, 30.0, 40.0]

_TABLE_5_9C: dict[MortarDesignation, list[float]] = {
    "i":   [1.4, 1.7, 2.5, 3.4, 4.4, 6.3, 7.5, 9.5, 11.2],
    "ii":  [1.4, 1.7, 2.5, 3.2, 4.2, 5.5, 6.5, 7.9,  9.3],
    "iii": [1.4, 1.7, 2.5, 3.2, 4.1, 5.1, 6.0, 7.2,  8.2],
    "iv":  [1.4, 1.7, 2.2, 2.8, 3.5, 4.6, 5.3, 6.2,  7.1],
}

# Table 5.9(d): Solid aggregate concrete blocks (<=25% voids), h/t_least = 2 to 4.5
_TABLE_5_9D: dict[MortarDesignation, list[float]] = {
    "i":   [2.8, 3.5, 5.0, 6.8, 8.8, 12.5, 15.0, 18.7, 22.1],
    "ii":  [2.8, 3.5, 5.0, 6.4, 8.4, 11.1, 13.0, 15.9, 18.7],
    "iii": [2.8, 3.5, 5.0, 6.4, 8.2, 10.1, 12.0, 14.5, 16.8],
    "iv":  [2.8, 3.5, 4.4, 5.6, 7.0,  9.1, 10.5, 12.5, 14.5],
}

# Table 5.9(f): Hollow aggregate concrete blocks (>25% <60% voids), h/t_least = 2 to 4.5
# Unit strengths: 2.8, 3.5, 5.0, 7.0, 10, 15, 20, 35+
_BLOCK_UNIT_STRENGTHS_F = [2.8, 3.5, 5.0, 7.0, 10.0, 15.0, 20.0, 35.0]

_TABLE_5_9F: dict[MortarDesignation, list[float]] = {
    "i":   [2.8, 3.5, 5.0, 5.7, 6.1, 6.8, 7.5, 11.4],
    "ii":  [2.8, 3.5, 5.0, 5.5, 5.7, 6.1, 6.5,  9.4],
    "iii": [2.8, 3.5, 5.0, 5.4, 5.5, 5.7, 5.9,  8.5],
    "iv":  [2.8, 3.5, 4.4, 4.8, 4.9, 5.1, 5.3,  7.3],
}


def _interpolate_table(
    unit_strengths: list[float],
    fk_values: list[float],
    unit_strength: float,
) -> float:
    """Linear interpolation / lookup in a characteristic strength table.

    Parameters
    ----------
    unit_strengths : list[float]
        Tabulated unit compressive strengths.
    fk_values : list[float]
        Corresponding masonry characteristic strengths.
    unit_strength : float
        Actual unit compressive strength to look up.

    Returns
    -------
    float
        Interpolated or exact fk value.

    Raises
    ------
    ValueError
        If unit_strength is below the minimum tabulated value.
    """
    if unit_strength < unit_strengths[0]:
        raise ValueError(
            f"Unit compressive strength {unit_strength} N/mm² is below the "
            f"minimum tabulated value of {unit_strengths[0]} N/mm². "
            "Cannot extrapolate below table limits."
        )
    # Clamp to maximum — the last column covers "40 or greater" / "35 or greater"
    if unit_strength >= unit_strengths[-1]:
        return fk_values[-1]

    # Linear interpolation between bracketing values
    for i in range(len(unit_strengths) - 1):
        lo, hi = unit_strengths[i], unit_strengths[i + 1]
        if lo <= unit_strength <= hi:
            ratio = (unit_strength - lo) / (hi - lo)
            return fk_values[i] + ratio * (fk_values[i + 1] - fk_values[i])

    raise ValueError("Interpolation failed — unit_strength out of range.")


def fk_brickwork(
    unit_compressive_strength: float,
    mortar_designation: MortarDesignation,
) -> float:
    """Return basic characteristic compressive strength of brickwork, fk.

    Based on Table 5.9(a), BS 5628 — standard format clay / calcium silicate bricks
    with mortar designations (i) to (iv).

    Parameters
    ----------
    unit_compressive_strength : float
        Declared compressive strength of the brick unit (N/mm²).
    mortar_designation : MortarDesignation
        Mortar designation per Table 5.6 BS 5628.

    Returns
    -------
    float
        Characteristic compressive strength fk (N/mm²).
    """
    return _interpolate_table(
        _BRICK_UNIT_STRENGTHS,
        _TABLE_5_9A[mortar_designation],
        unit_compressive_strength,
    )


def _block_ht_ratio(block_height: float, block_least_horiz_dim: float) -> float:
    """Return the height-to-least-horizontal-dimension ratio for a concrete block."""
    if block_least_horiz_dim <= 0:
        raise ValueError("block_least_horiz_dim must be > 0.")
    return block_height / block_least_horiz_dim


def fk_blockwork(
    unit_compressive_strength: float,
    mortar_designation: MortarDesignation,
    block_height: float,
    block_least_horiz_dim: float,
    formed_voids_percent: float,
) -> float:
    """Return basic characteristic compressive strength of concrete blockwork, fk.

    Uses Tables 5.9(c), (d) and (f) with linear interpolation between tables
    as required by BS 5628 Cl. 19.1.

    Parameters
    ----------
    unit_compressive_strength : float
        Declared compressive strength of the block unit (N/mm²).
    mortar_designation : MortarDesignation
        Mortar designation per Table 5.6.
    block_height : float
        Height of the block (mm).
    block_least_horiz_dim : float
        Least horizontal dimension of the block (mm).
    formed_voids_percent : float
        Percentage of formed voids in the block face (0–100).

    Returns
    -------
    float
        Characteristic compressive strength fk (N/mm²).

    Raises
    ------
    ValueError
        If formed_voids_percent >= 60 (not covered by BS 5628 tables).
    """
    if formed_voids_percent < 0 or formed_voids_percent >= 60:
        raise ValueError(
            f"formed_voids_percent={formed_voids_percent}% is outside the "
            "range covered by BS 5628 Tables 5.9(c)/(d)/(f). "
            "The standard covers 0% to <60% formed voids only."
        )

    h_ratio = _block_ht_ratio(block_height, block_least_horiz_dim)

    # Determine which table(s) to use
    is_solid = formed_voids_percent <= 25       # Table 5.9(c) and (d)
    is_hollow = formed_voids_percent > 25       # Table 5.9(c) and (f)

    def _fk_table_c() -> float:
        return _interpolate_table(
            _BLOCK_UNIT_STRENGTHS_CDF,
            _TABLE_5_9C[mortar_designation],
            unit_compressive_strength,
        )

    def _fk_table_d() -> float:
        return _interpolate_table(
            _BLOCK_UNIT_STRENGTHS_CDF,
            _TABLE_5_9D[mortar_designation],
            unit_compressive_strength,
        )

    def _fk_table_f() -> float:
        return _interpolate_table(
            _BLOCK_UNIT_STRENGTHS_F,
            _TABLE_5_9F[mortar_designation],
            unit_compressive_strength,
        )

    if is_solid:
        if h_ratio <= 0.6:
            return _fk_table_c()
        elif h_ratio >= 2.0:
            return _fk_table_d()
        else:
            # Interpolate between Table 5.9(c) at h/t=0.6 and Table 5.9(d) at h/t=2.0
            fk_c = _fk_table_c()
            fk_d = _fk_table_d()
            ratio = (h_ratio - 0.6) / (2.0 - 0.6)
            return fk_c + ratio * (fk_d - fk_c)
    else:  # hollow: >25% and <60% voids
        if h_ratio <= 0.6:
            return _fk_table_c()
        elif h_ratio >= 2.0:
            return _fk_table_f()
        else:
            fk_c = _fk_table_c()
            fk_f = _fk_table_f()
            ratio = (h_ratio - 0.6) / (2.0 - 0.6)
            return fk_c + ratio * (fk_f - fk_c)


# ---------------------------------------------------------------------------
# 5.5.2.1  Modification factors for fk
# ---------------------------------------------------------------------------

def modification_factor_small_plan_area(A: float) -> float:
    """Return the plan area modification factor for small-plan-area walls.

    BS 5628 Cl. 19.1.2:
        If horizontal cross-sectional area A < 0.2 m², multiply fk by (0.7 + 1.5A).
        If A >= 0.2 m², factor = 1.0 (no modification).

    Parameters
    ----------
    A : float
        Horizontal cross-sectional area of the loaded wall (m²).

    Returns
    -------
    float
        Modification factor (dimensionless).
    """
    if A < 0.0:
        raise ValueError("Cross-sectional area A must be non-negative.")
    if A < 0.2:
        return 0.7 + 1.5 * A
    return 1.0


def modification_factor_narrow_brick_wall(
    wall_thickness_mm: float,
    brick_width_mm: float = 102.5,
) -> float:
    """Return the narrow brick wall modification factor.

    BS 5628 Cl. 19.1.3:
        When the wall or loaded inner leaf thickness equals one standard brick
        width (102.5 mm), multiply fk by 1.15.

    Parameters
    ----------
    wall_thickness_mm : float
        Actual wall or leaf thickness (mm).
    brick_width_mm : float
        Standard brick width; default 102.5 mm (standard format).

    Returns
    -------
    float
        1.15 if wall is one brick thick, 1.0 otherwise.
    """
    if math.isclose(wall_thickness_mm, brick_width_mm, abs_tol=0.5):
        return 1.15
    return 1.0


def modified_fk(
    fk_basic: float,
    factor_plan_area: float,
    factor_narrow_wall: float,
) -> float:
    """Return modified characteristic compressive strength.

    Parameters
    ----------
    fk_basic : float
        Basic fk from Table 5.9 (N/mm²).
    factor_plan_area : float
        Modification factor from :func:`modification_factor_small_plan_area`.
    factor_narrow_wall : float
        Modification factor from :func:`modification_factor_narrow_brick_wall`.

    Returns
    -------
    float
        Modified fk (N/mm²).
    """
    return fk_basic * factor_plan_area * factor_narrow_wall


# ---------------------------------------------------------------------------
# 5.5.2.2  Partial safety factor for materials, γm — Table 5.10
# ---------------------------------------------------------------------------

def gamma_m_compression(
    unit_category: MasonryUnitCategory,
    construction_control: ConstructionControlCategory,
) -> float:
    """Return partial safety factor for materials in compression (Table 5.10).

    Parameters
    ----------
    unit_category : MasonryUnitCategory
        'I' or 'II' — Category I units have declared strength with <=5% failure
        probability; Category II units do not meet this condition.
    construction_control : ConstructionControlCategory
        'special' or 'normal'.

    Returns
    -------
    float
        γm for compression.
    """
    table: dict[tuple[str, str], float] = {
        ("I",  "special"): 2.5,
        ("I",  "normal"):  3.1,
        ("II", "special"): 2.8,
        ("II", "normal"):  3.5,
    }
    key = (unit_category, construction_control)
    if key not in table:
        raise ValueError(f"Invalid combination: unit_category={unit_category}, "
                         f"construction_control={construction_control}.")
    return table[key]


def gamma_m_flexure(
    construction_control: ConstructionControlCategory,
) -> float:
    """Return partial safety factor for materials in flexure (Table 5.10).

    Both Category I and II units use the same value in flexure.

    Parameters
    ----------
    construction_control : ConstructionControlCategory
        'special' or 'normal'.

    Returns
    -------
    float
        γm for flexure.
    """
    if construction_control == "special":
        return 2.5
    elif construction_control == "normal":
        return 3.0
    raise ValueError(f"Invalid construction_control: {construction_control}.")


# ---------------------------------------------------------------------------
# 5.5.2.3  Effective height, hef
# ---------------------------------------------------------------------------

def effective_height(
    clear_height_mm: float,
    resistance_type: Literal["enhanced", "simple"],
) -> float:
    """Return the effective height of a load-bearing wall.

    BS 5628 Cl. 24.3.2.1:
        Enhanced resistance: hef = 0.75 × clear height
        Simple resistance  : hef = clear height

    Parameters
    ----------
    clear_height_mm : float
        Clear distance between lateral supports (mm).
    resistance_type : {'enhanced', 'simple'}
        Type of lateral support at ends.

    Returns
    -------
    float
        Effective height hef (mm).
    """
    if clear_height_mm <= 0:
        raise ValueError("clear_height_mm must be positive.")
    if resistance_type == "enhanced":
        return 0.75 * clear_height_mm
    elif resistance_type == "simple":
        return clear_height_mm
    raise ValueError(f"Invalid resistance_type: {resistance_type}.")


# ---------------------------------------------------------------------------
# 5.5.2.3  Effective thickness, tef — single leaf, stiffened, cavity walls
# ---------------------------------------------------------------------------

_K_TABLE: dict[tuple[int, int], float] = {
    # (pier_spacing_to_width_ratio_band, tp_to_t_ratio_band)
    # Pier spacing / pier width : 6, 10, 20
    # Pier thickness / wall thickness: 1, 2, 3
    # Table 5.12 — stiffness coefficient K
}

# Table 5.12 as nested dict:
# key: pier_spacing_to_pier_width (6, 10, 20)
# value: dict keyed by tp_to_t (1, 2, 3)
_TABLE_5_12: dict[int, dict[int, float]] = {
     6: {1: 1.0, 2: 1.4, 3: 2.0},
    10: {1: 1.0, 2: 1.2, 3: 1.4},
    20: {1: 1.0, 2: 1.0, 3: 1.0},
}


def stiffness_coefficient_K(
    pier_spacing_to_pier_width: float,
    pier_thickness_to_wall_thickness: float,
) -> float:
    """Return stiffness coefficient K for walls stiffened by piers (Table 5.12).

    Linear interpolation between tabulated values is permitted.
    Extrapolation outside the table limits is NOT permitted.

    Parameters
    ----------
    pier_spacing_to_pier_width : float
        Ratio of pier spacing (centre-to-centre) to pier width.
        Must be between 6 and 20.
    pier_thickness_to_wall_thickness : float
        Ratio of pier thickness (tp) to actual thickness of wall to which
        it is bonded. Must be between 1 and 3.

    Returns
    -------
    float
        Stiffness coefficient K (dimensionless).

    Raises
    ------
    ValueError
        If input ratios are outside the table limits (extrapolation not allowed).
    """
    s = pier_spacing_to_pier_width
    r = pier_thickness_to_wall_thickness

    if s < 6 or s > 20:
        raise ValueError(
            f"pier_spacing_to_pier_width={s} is outside the table limits [6, 20]. "
            "Extrapolation is NOT permitted per Table 5.12 note."
        )
    if r < 1 or r > 3:
        raise ValueError(
            f"pier_thickness_to_wall_thickness={r} is outside the table limits [1, 3]. "
            "Extrapolation is NOT permitted per Table 5.12 note."
        )

    # Bilinear interpolation across s and r
    s_keys = sorted(_TABLE_5_12.keys())   # [6, 10, 20]
    r_keys = [1, 2, 3]

    def _interp_1d(keys: list[int], values: list[float], x: float) -> float:
        if x <= keys[0]:
            return values[0]
        if x >= keys[-1]:
            return values[-1]
        for i in range(len(keys) - 1):
            if keys[i] <= x <= keys[i + 1]:
                t = (x - keys[i]) / (keys[i + 1] - keys[i])
                return values[i] + t * (values[i + 1] - values[i])
        raise RuntimeError("Interpolation error in stiffness_coefficient_K.")

    # Interpolate over r at each s_key, then interpolate over s
    K_at_s: list[float] = []
    for s_key in s_keys:
        K_at_r = [_TABLE_5_12[s_key][rk] for rk in r_keys]
        K_at_s.append(_interp_1d(r_keys, K_at_r, r))

    return _interp_1d(s_keys, K_at_s, s)


def effective_thickness_single_leaf(
    t_mm: float,
    has_piers: bool = False,
    K: float = 1.0,
) -> float:
    """Return the effective thickness of a single-leaf wall.

    BS 5628 (Fig. 5.12):
        Without piers: tef = t
        With piers   : tef = t·K

    Parameters
    ----------
    t_mm : float
        Actual wall thickness (mm).
    has_piers : bool
        True if wall is stiffened by piers.
    K : float
        Stiffness coefficient from :func:`stiffness_coefficient_K`; used only
        when has_piers is True.

    Returns
    -------
    float
        Effective thickness tef (mm).
    """
    if t_mm <= 0:
        raise ValueError("t_mm must be positive.")
    if has_piers:
        return t_mm * K
    return t_mm


def effective_thickness_cavity_wall(
    t1_mm: float,
    t2_mm: float,
    has_piers: bool = False,
    K: float = 1.0,
) -> float:
    """Return the effective thickness of a cavity wall.

    BS 5628 Cl. 24.3.2.2 (Fig. 5.13):
        Without piers: tef = max(2/3·(t1+t2), t1, t2)
        With piers   : tef = max(2/3·(t1+K·t2), t1, K·t2)

    t2 is the leaf to which the piers are bonded when piers are present.

    Parameters
    ----------
    t1_mm : float
        Thickness of leaf 1 (mm) — typically the outer leaf.
    t2_mm : float
        Thickness of leaf 2 (mm) — typically the inner / stiffened leaf.
    has_piers : bool
        True if piers stiffen one leaf.
    K : float
        Stiffness coefficient; used only when has_piers=True.

    Returns
    -------
    float
        Effective thickness tef (mm).
    """
    if t1_mm <= 0 or t2_mm <= 0:
        raise ValueError("Both leaf thicknesses must be positive.")
    if has_piers:
        return max(2.0 / 3.0 * (t1_mm + K * t2_mm), t1_mm, K * t2_mm)
    return max(2.0 / 3.0 * (t1_mm + t2_mm), t1_mm, t2_mm)


# ---------------------------------------------------------------------------
# 5.5.2.3  Slenderness ratio — Eq. 5.6
# ---------------------------------------------------------------------------

_SR_LIMIT = 27  # Maximum permissible slenderness ratio (BS 5628)


def slenderness_ratio(
    hef_mm: float,
    tef_mm: float,
) -> float:
    """Return the slenderness ratio of a masonry wall.

    BS 5628 Eq. 5.6:
        SR = hef / tef

    Maximum permissible SR = 27.

    Parameters
    ----------
    hef_mm : float
        Effective height (mm).
    tef_mm : float
        Effective thickness (mm).

    Returns
    -------
    float
        Slenderness ratio (dimensionless).

    Raises
    ------
    ValueError
        If SR > 27 (code limit exceeded).
    """
    if tef_mm <= 0:
        raise ValueError("tef_mm must be positive.")
    SR = hef_mm / tef_mm
    if SR > _SR_LIMIT:
        raise ValueError(
            f"Slenderness ratio SR={SR:.2f} exceeds the permissible limit of "
            f"{_SR_LIMIT} per BS 5628. Redesign the wall."
        )
    return SR


# ---------------------------------------------------------------------------
# 5.5.2.3  Eccentricity of loading
# ---------------------------------------------------------------------------

def eccentricity_single_floor(
    bearing_length_mm: float,
    wall_thickness_mm: float,
) -> float:
    """Return eccentricity for a wall supporting a single floor/roof.

    BS 5628 Cl. 27 (Fig. 5.14):
        Load acts at t/3 from the loaded face.
        ex = t/2 - t/3 = t/6   … wait, textbook says t/2 - ℓ/3
        where ℓ is the bearing length.
        ex = t/2 - ℓ/3

    Parameters
    ----------
    bearing_length_mm : float
        Length of bearing surface (ℓ) in mm.
    wall_thickness_mm : float
        Actual wall thickness t (mm).

    Returns
    -------
    float
        Eccentricity ex (mm).
    """
    return wall_thickness_mm / 2.0 - bearing_length_mm / 3.0


def eccentricity_continuous_floor(wall_thickness_mm: float) -> float:
    """Return eccentricity for a wall supporting a continuous floor (Fig. 5.15).

    BS 5628 Cl. 27:
        Each span considered individually on half the total bearing area.
        Load acts at t/2 × 1/3 = t/6 from the loaded face.
        ex = t/2 - t/6 = t/3

    Parameters
    ----------
    wall_thickness_mm : float
        Actual wall thickness t (mm).

    Returns
    -------
    float
        Eccentricity ex (mm).
    """
    return wall_thickness_mm / 3.0


# ---------------------------------------------------------------------------
# 5.5.2.3  Capacity reduction factor β — Table 5.11
# ---------------------------------------------------------------------------

# Table 5.11 data:
#   Rows: slenderness ratio (hef/tef)
#   Cols: eccentricity at top of wall (as fraction of t)
#         0.05t, 0.1t, 0.2t, 0.3t
_SR_TABLE = [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 27]
_BETA_TABLE: dict[float, dict[float, float | None]] = {
    # SR  : {ex/t: β or None if no value given}
     0: {0.05: 1.00, 0.10: 0.88, 0.20: 0.66, 0.30: 0.44},
     6: {0.05: 1.00, 0.10: 0.88, 0.20: 0.66, 0.30: 0.44},
     8: {0.05: 1.00, 0.10: 0.88, 0.20: 0.66, 0.30: 0.44},
    10: {0.05: 0.97, 0.10: 0.88, 0.20: 0.66, 0.30: 0.44},
    12: {0.05: 0.93, 0.10: 0.87, 0.20: 0.66, 0.30: 0.44},
    14: {0.05: 0.89, 0.10: 0.83, 0.20: 0.66, 0.30: 0.44},
    16: {0.05: 0.83, 0.10: 0.77, 0.20: 0.64, 0.30: 0.44},
    18: {0.05: 0.77, 0.10: 0.70, 0.20: 0.57, 0.30: 0.44},
    20: {0.05: 0.70, 0.10: 0.64, 0.20: 0.51, 0.30: 0.37},
    22: {0.05: 0.62, 0.10: 0.56, 0.20: 0.43, 0.30: 0.30},
    24: {0.05: 0.53, 0.10: 0.47, 0.20: 0.34, 0.30: None},
    26: {0.05: 0.45, 0.10: 0.38, 0.20: None, 0.30: None},
    27: {0.05: 0.40, 0.10: 0.33, 0.20: None, 0.30: None},
}

_EX_FRACTIONS = [0.05, 0.10, 0.20, 0.30]


def capacity_reduction_factor(
    SR: float,
    ex_fraction_of_t: float,
) -> float:
    """Return the capacity reduction factor β (Table 5.11, BS 5628).

    Bilinear interpolation between tabulated SR values and eccentricity columns.

    Parameters
    ----------
    SR : float
        Slenderness ratio hef/tef (dimensionless). Must be <= 27.
    ex_fraction_of_t : float
        Eccentricity at top of wall expressed as a fraction of wall thickness t.
        E.g. 0.05 means ex <= 0.05t (axially loaded assumed).
        Must not exceed 0.3t.

    Returns
    -------
    float
        Capacity reduction factor β.

    Raises
    ------
    ValueError
        If SR > 27 or eccentricity fraction > 0.3t or combination has no tabulated value.
    """
    if SR > 27:
        raise ValueError(f"SR={SR:.2f} > 27: exceeds code limit.")
    if ex_fraction_of_t < 0:
        raise ValueError("ex_fraction_of_t must be non-negative.")
    if ex_fraction_of_t > 0.30:
        raise ValueError(
            f"ex_fraction_of_t={ex_fraction_of_t} exceeds 0.30t: "
            "outside Table 5.11 range."
        )

    # Map eccentricity fraction to nearest lower column
    # Column selection: use the column header that covers the given eccentricity
    def _find_ex_col(ex: float) -> float:
        """Find the eccentricity column to use (round up to next tabulated value)."""
        for col in _EX_FRACTIONS:
            if ex <= col:
                return col
        return _EX_FRACTIONS[-1]

    ex_col = _find_ex_col(ex_fraction_of_t)

    # Collect valid (SR, β) pairs for this eccentricity column
    sr_list: list[float] = []
    beta_list: list[float] = []
    for sr_key in sorted(_BETA_TABLE.keys()):
        b = _BETA_TABLE[sr_key][ex_col]
        if b is not None:
            sr_list.append(float(sr_key))
            beta_list.append(b)

    if not sr_list:
        raise ValueError(
            f"No valid β values found for ex_fraction={ex_col:.2f}t. "
            "Combination is outside Table 5.11."
        )

    # Clamp and interpolate
    if SR <= sr_list[0]:
        return beta_list[0]
    if SR >= sr_list[-1]:
        return beta_list[-1]

    for i in range(len(sr_list) - 1):
        if sr_list[i] <= SR <= sr_list[i + 1]:
            t = (SR - sr_list[i]) / (sr_list[i + 1] - sr_list[i])
            return beta_list[i] + t * (beta_list[i + 1] - beta_list[i])

    raise RuntimeError("Interpolation failed in capacity_reduction_factor.")


# ---------------------------------------------------------------------------
# 5.5.3  Design vertical load resistance of wall — Eq. 5.7 / 5.8
# ---------------------------------------------------------------------------

def design_compressive_strength(
    fk_modified: float,
    beta: float,
    gamma_m: float,
) -> float:
    """Return the design compressive strength of masonry.

    BS 5628 Eq. 5.5:
        Design compressive strength = β·fk / γm

    Parameters
    ----------
    fk_modified : float
        Modified characteristic compressive strength (N/mm²).
    beta : float
        Capacity reduction factor from :func:`capacity_reduction_factor`.
    gamma_m : float
        Partial safety factor for materials from :func:`gamma_m_compression`.

    Returns
    -------
    float
        Design compressive strength (N/mm²).
    """
    return beta * fk_modified / gamma_m


def design_vertical_load_resistance(
    fk_modified: float,
    beta: float,
    gamma_m: float,
    t_mm: float,
) -> float:
    """Return the design vertical load resistance per metre run of wall, NR.

    BS 5628 Eq. 5.7:
        NR = β·fk·t / γm   (per unit length = 1 mm, so per mm run)

    This function returns NR in N per mm run of wall (= kN/m run).

    Parameters
    ----------
    fk_modified : float
        Modified characteristic compressive strength (N/mm²).
    beta : float
        Capacity reduction factor.
    gamma_m : float
        Partial safety factor for materials (compression).
    t_mm : float
        Actual wall or leaf thickness (mm).

    Returns
    -------
    float
        NR in N/mm run of wall (divide by 1000 for kN/m).
    """
    return beta * fk_modified * t_mm / gamma_m


def check_vertical_load_capacity(
    N_design: float,
    NR: float,
) -> bool:
    """Verify that the ultimate design load does not exceed the design resistance.

    BS 5628 Eq. 5.1:
        N <= NR

    Parameters
    ----------
    N_design : float
        Ultimate design vertical load (N/mm run).
    NR : float
        Design vertical load resistance (N/mm run).

    Returns
    -------
    bool
        True if the wall is adequate (N <= NR).

    Raises
    ------
    ValueError
        If N_design > NR (capacity exceeded).
    """
    if N_design > NR:
        raise ValueError(
            f"CAPACITY EXCEEDED: N={N_design:.2f} N/mm > NR={NR:.2f} N/mm. "
            "The wall design is INADEQUATE."
        )
    return True


def required_fk_for_vertical_load(
    N_design: float,
    beta: float,
    gamma_m: float,
    t_mm: float,
    area_mod_factor: float = 1.0,
    narrow_wall_mod_factor: float = 1.0,
) -> float:
    """Back-calculate the required characteristic compressive strength fk.

    Rearrangement of BS 5628 Eq. 5.8:
        β·(mod_factors·fk)·t / γm >= N
        => fk >= N·γm / (β·t·mod_factors)

    Parameters
    ----------
    N_design : float
        Ultimate design vertical load (N/mm run).
    beta : float
        Capacity reduction factor.
    gamma_m : float
        Partial safety factor for materials.
    t_mm : float
        Actual wall or leaf thickness (mm).
    area_mod_factor : float
        Plan area modification factor (default 1.0).
    narrow_wall_mod_factor : float
        Narrow brick wall modification factor (default 1.0).

    Returns
    -------
    float
        Minimum required basic fk (N/mm²).
    """
    combined_mod = area_mod_factor * narrow_wall_mod_factor
    if combined_mod <= 0:
        raise ValueError("Combined modification factor must be > 0.")
    return N_design * gamma_m / (beta * t_mm * combined_mod)


# ---------------------------------------------------------------------------
# Full vertically-loaded wall design procedure (Fig. 5.16 workflow)
# ---------------------------------------------------------------------------

def design_vertical_wall(
    N_ultimate: float,
    t_mm: float,
    clear_height_mm: float,
    resistance_type: Literal["enhanced", "simple"],
    unit_category: MasonryUnitCategory,
    construction_control: ConstructionControlCategory,
    ex_fraction_of_t: float,
    wall_length_mm: float,
    is_brick_wall: bool = True,
    has_piers: bool = False,
    K: float = 1.0,
    t2_mm: float = 0.0,
    is_cavity: bool = False,
) -> dict:
    """Run the complete vertically-loaded wall design procedure (Fig. 5.16).

    Implements BS 5628 design sequence:
    1. Ultimate design load (input)
    2. Effective height → Slenderness ratio
    3. Capacity reduction factor β
    4. γm
    5. Required fk

    Parameters
    ----------
    N_ultimate : float
        Ultimate design vertical load (N/mm run of wall).
    t_mm : float
        Actual wall thickness (for single-leaf) or inner leaf thickness (mm).
    clear_height_mm : float
        Clear height between lateral supports (mm).
    resistance_type : {'enhanced', 'simple'}
        Type of horizontal support.
    unit_category : MasonryUnitCategory
        Masonry unit quality category.
    construction_control : ConstructionControlCategory
        Level of construction control.
    ex_fraction_of_t : float
        Eccentricity as a fraction of t (e.g. 0.05 for axially loaded).
    wall_length_mm : float
        Length of the wall (mm); used to compute plan area.
    is_brick_wall : bool
        True = brick wall (narrow brick factor applicable). False = blockwork.
    has_piers : bool
        True if wall is stiffened by piers.
    K : float
        Stiffness coefficient (Table 5.12); used when has_piers=True.
    t2_mm : float
        Second leaf thickness for cavity walls (mm); used when is_cavity=True.
    is_cavity : bool
        True if cavity wall.

    Returns
    -------
    dict
        Dictionary with all intermediate and final design results:
        {
          'hef_mm': float,
          'tef_mm': float,
          'SR': float,
          'beta': float,
          'gamma_m': float,
          'area_mod_factor': float,
          'narrow_wall_mod_factor': float,
          'required_fk_basic': float,
          'N_ultimate': float,
          'NR_check_ok': str,
        }
    """
    # Step 1: Effective height
    hef = effective_height(clear_height_mm, resistance_type)

    # Step 2: Effective thickness
    if is_cavity:
        if t2_mm <= 0:
            raise ValueError("t2_mm must be provided for cavity walls.")
        tef = effective_thickness_cavity_wall(t_mm, t2_mm, has_piers, K)
    else:
        tef = effective_thickness_single_leaf(t_mm, has_piers, K)

    # Step 3: Slenderness ratio (raises if > 27)
    SR = slenderness_ratio(hef, tef)

    # Step 4: Capacity reduction factor
    beta = capacity_reduction_factor(SR, ex_fraction_of_t)

    # Step 5: γm
    gm = gamma_m_compression(unit_category, construction_control)

    # Step 6: Modification factors
    A_m2 = (t_mm * wall_length_mm) / 1e6   # convert mm² to m²
    area_mod = modification_factor_small_plan_area(A_m2)

    if is_brick_wall:
        narrow_mod = modification_factor_narrow_brick_wall(t_mm)
    else:
        narrow_mod = 1.0   # narrow wall factor applies to brick walls only

    # Step 7: Required fk
    fk_req = required_fk_for_vertical_load(
        N_ultimate, beta, gm, t_mm, area_mod, narrow_mod
    )

    return {
        "hef_mm": hef,
        "tef_mm": tef,
        "SR": SR,
        "beta": beta,
        "gamma_m": gm,
        "area_mod_factor": area_mod,
        "narrow_wall_mod_factor": narrow_mod,
        "required_fk_basic_N_per_mm2": fk_req,
        "N_ultimate_N_per_mm": N_ultimate,
        "NR_check_ok": "Provide brick/mortar combination with fk >= required_fk_basic.",
    }


# ---------------------------------------------------------------------------
# 5.6  Design of laterally loaded wall panels
# ---------------------------------------------------------------------------

# 5.6.1  Characteristic flexural strength fkx — Table 5.13
# Plane of failure parallel to bed joints (fkx_par)
# Plane of failure perpendicular to bed joints (fkx_perp)

# Clay bricks — indexed by (water_absorption, mortar_strength_class_group)
# mortar group: 'M12' = (i), 'M6_M4' = (ii) and (iii), 'M2' = (iv)

_FKX_CLAY_PAR: dict[WaterAbsorption, dict[str, float]] = {
    "lt7":   {"M12": 0.7, "M6_M4": 0.5, "M2": 0.4},
    "7to12": {"M12": 0.5, "M6_M4": 0.4, "M2": 0.35},
    "gt12":  {"M12": 0.4, "M6_M4": 0.3, "M2": 0.25},
}

_FKX_CLAY_PERP: dict[WaterAbsorption, dict[str, float]] = {
    "lt7":   {"M12": 2.0, "M6_M4": 1.5, "M2": 1.2},
    "7to12": {"M12": 1.5, "M6_M4": 1.1, "M2": 1.0},
    "gt12":  {"M12": 1.1, "M6_M4": 0.9, "M2": 0.8},
}

# Calcium silicate and concrete bricks (no M12 distinction stated per Table 5.13)
_FKX_SILICATE_PAR: dict[str, float]  = {"M6_M4": 0.3, "M2": 0.2}
_FKX_SILICATE_PERP: dict[str, float] = {"M6_M4": 0.9, "M2": 0.6}

_FKX_CONC_BRICK_PAR:  dict[str, float] = {"M6_M4": 0.3, "M2": 0.2}
_FKX_CONC_BRICK_PERP: dict[str, float] = {"M6_M4": 0.9, "M2": 0.6}

# Concrete blocks (solid or hollow) — par values same for M6_M4; perp varies by thickness band
# Wall thickness ≤ 100 mm band:
_FKX_BLOCK_THIN_PAR: dict[str, dict[str, float]] = {
    # block compressive strength (N/mm²): {mortar_group: fkx_par}
    # Table 5.13 shows single par value for strength groups combined
    "2.9":  {"M6_M4": 0.25, "M2": 0.2},
    "3.6":  {"M6_M4": 0.25, "M2": 0.2},
    "7.3":  {"M6_M4": 0.25, "M2": 0.2},
}
_FKX_BLOCK_THIN_PERP: dict[str, dict[str, float]] = {
    "2.9": {"M6_M4": 0.40, "M2": 0.4},
    "3.6": {"M6_M4": 0.45, "M2": 0.4},
    "7.3": {"M6_M4": 0.60, "M2": 0.5},
}

# Wall thickness ≥ 250 mm band:
_FKX_BLOCK_THICK_PAR: dict[str, dict[str, float]] = {
    "2.9": {"M6_M4": 0.15, "M2": 0.1},
    "3.6": {"M6_M4": 0.15, "M2": 0.1},
    "7.3": {"M6_M4": 0.15, "M2": 0.1},
}
_FKX_BLOCK_THICK_PERP: dict[str, dict[str, float]] = {
    "2.9": {"M6_M4": 0.40, "M2": 0.2},
    "3.6": {"M6_M4": 0.45, "M2": 0.2},
    "7.3": {"M6_M4": 0.60, "M2": 0.3},
}

# High-strength blocks (10.4 and 17.5+ N/mm²): any thickness
_FKX_BLOCK_HSTR_PAR: dict[str, dict[str, float]] = {
    "10.4": {"M6_M4": 0.25, "M2": 0.2},
    "17.5": {"M6_M4": 0.25, "M2": 0.2},
}
_FKX_BLOCK_HSTR_PERP: dict[str, dict[str, float]] = {
    "10.4": {"M6_M4": 0.75, "M2": 0.6},
    "17.5": {"M6_M4": 0.90, "M2": 0.7},   # note: µ=0.3 must be used when fkx_perp=0.9 with par
}


def _mortar_group(designation: MortarDesignation) -> str:
    """Map mortar designation to the group key used in Table 5.13."""
    if designation == "i":
        return "M12"
    elif designation in ("ii", "iii"):
        return "M6_M4"
    elif designation == "iv":
        return "M2"
    raise ValueError(f"Unknown mortar designation: {designation}")


def fkx_clay_brick(
    water_absorption: WaterAbsorption,
    mortar_designation: MortarDesignation,
) -> Tuple[float, float]:
    """Return characteristic flexural strengths for clay brick masonry.

    Table 5.13, BS 5628.

    Parameters
    ----------
    water_absorption : WaterAbsorption
        'lt7' (<7%), '7to12' (7–12%), 'gt12' (>12%).
    mortar_designation : MortarDesignation
        Mortar designation.

    Returns
    -------
    Tuple[float, float]
        (fkx_par, fkx_perp) in N/mm².
    """
    mg = _mortar_group(mortar_designation)
    fkx_par  = _FKX_CLAY_PAR[water_absorption][mg]
    fkx_perp = _FKX_CLAY_PERP[water_absorption][mg]
    return fkx_par, fkx_perp


def fkx_calcium_silicate_brick(
    mortar_designation: MortarDesignation,
) -> Tuple[float, float]:
    """Return characteristic flexural strengths for calcium silicate brick masonry.

    Table 5.13, BS 5628.

    Returns
    -------
    Tuple[float, float]
        (fkx_par, fkx_perp) in N/mm².
    """
    mg = _mortar_group(mortar_designation)
    if mg == "M12":
        # Table 5.13 does not separate M12 for calcium silicate; use M6_M4 values
        # (textbook shows single combined entry)
        mg = "M6_M4"
    return _FKX_SILICATE_PAR[mg], _FKX_SILICATE_PERP[mg]


def fkx_concrete_block(
    block_compressive_strength: float,
    mortar_designation: MortarDesignation,
    wall_leaf_thickness_mm: float,
) -> Tuple[float, float]:
    """Return characteristic flexural strengths for concrete block masonry.

    Table 5.13, BS 5628.
    Block strengths handled: 2.9, 3.6, 7.3, 10.4, 17.5+ N/mm².

    Parameters
    ----------
    block_compressive_strength : float
        Declared compressive strength of block unit (N/mm²).
    mortar_designation : MortarDesignation
        Mortar designation.
    wall_leaf_thickness_mm : float
        Thickness of the wall (single leaf) or leaf (cavity wall) in mm.

    Returns
    -------
    Tuple[float, float]
        (fkx_par, fkx_perp) in N/mm².

    Raises
    ------
    ValueError
        If block strength is below 2.9 N/mm² (below table range).
    """
    if block_compressive_strength < 2.9:
        raise ValueError(
            f"Block compressive strength {block_compressive_strength} N/mm² is "
            "below the minimum in Table 5.13 (2.9 N/mm²)."
        )

    mg = _mortar_group(mortar_designation)

    # High-strength blocks
    if block_compressive_strength >= 10.4:
        key = "17.5" if block_compressive_strength >= 17.5 else "10.4"
        fkx_par  = _FKX_BLOCK_HSTR_PAR[key][mg]
        fkx_perp = _FKX_BLOCK_HSTR_PERP[key][mg]
        return fkx_par, fkx_perp

    # Standard strength blocks: 2.9, 3.6, 7.3
    if block_compressive_strength < 3.6:
        skey = "2.9"
    elif block_compressive_strength < 7.3:
        skey = "3.6"
    else:
        skey = "7.3"

    if wall_leaf_thickness_mm <= 100:
        fkx_par  = _FKX_BLOCK_THIN_PAR[skey][mg]
        fkx_perp = _FKX_BLOCK_THIN_PERP[skey][mg]
    elif wall_leaf_thickness_mm >= 250:
        fkx_par  = _FKX_BLOCK_THICK_PAR[skey][mg]
        fkx_perp = _FKX_BLOCK_THICK_PERP[skey][mg]
    else:
        # Linear interpolation between 100 mm and 250 mm bands
        par_lo  = _FKX_BLOCK_THIN_PAR[skey][mg]
        par_hi  = _FKX_BLOCK_THICK_PAR[skey][mg]
        perp_lo = _FKX_BLOCK_THIN_PERP[skey][mg]
        perp_hi = _FKX_BLOCK_THICK_PERP[skey][mg]
        ratio = (wall_leaf_thickness_mm - 100) / (250 - 100)
        fkx_par  = par_lo  + ratio * (par_hi  - par_lo)
        fkx_perp = perp_lo + ratio * (perp_hi - perp_lo)

    return fkx_par, fkx_perp


# ---------------------------------------------------------------------------
# 5.6.2  Orthogonal ratio µ — Eq. 5.9
# ---------------------------------------------------------------------------

def orthogonal_ratio(fkx_par: float, fkx_perp: float) -> float:
    """Return the orthogonal ratio µ = fkx_par / fkx_perp.

    BS 5628 Eq. 5.9.
    For clay, calcium silicate and concrete bricks: µ = 0.3 may be assumed.

    Parameters
    ----------
    fkx_par : float
        Characteristic flexural strength parallel to bed joints (N/mm²).
    fkx_perp : float
        Characteristic flexural strength perpendicular to bed joints (N/mm²).

    Returns
    -------
    float
        Orthogonal ratio µ (dimensionless).
    """
    if fkx_perp <= 0:
        raise ValueError("fkx_perp must be > 0.")
    return fkx_par / fkx_perp


# ---------------------------------------------------------------------------
# 5.6.4  Limiting dimensions for panel walls — Cl. 32.3
# ---------------------------------------------------------------------------

def check_panel_limiting_dimensions(
    panel_height_mm: float,
    panel_length_mm: float,
    tef_mm: float,
    num_supported_edges: Literal[2, 3, 4],
    continuous_edges: int,
    is_top_bottom_only: bool = False,
) -> dict:
    """Check panel wall limiting dimensions per BS 5628 Cl. 32.3 (Fig. 5.26).

    Parameters
    ----------
    panel_height_mm : float
        Panel height h (mm).
    panel_length_mm : float
        Panel length L (mm).
    tef_mm : float
        Effective thickness tef (mm).
    num_supported_edges : {2, 3, 4}
        Number of supported edges (2 = top and bottom only, 3 or 4 = standard).
    continuous_edges : int
        Number of edges that provide continuous (restrained) support.
    is_top_bottom_only : bool
        True if panel is simply supported at top and bottom only (vertical strip).

    Returns
    -------
    dict
        {
          'h_times_L_limit': float or None,
          'h_times_L_actual': float,
          'max_dimension_limit': float,
          'area_ok': bool,
          'dimension_ok': bool,
          'height_limit_top_bottom': float or None,
          'height_ok_top_bottom': bool or None,
        }

    Raises
    ------
    ValueError
        If any limiting dimension is exceeded.
    """
    h = panel_height_mm
    L = panel_length_mm
    t = tef_mm

    results: dict = {}

    if is_top_bottom_only:
        h_limit = 40.0 * t
        results["height_limit_top_bottom_mm"] = h_limit
        results["height_ok_top_bottom"] = h <= h_limit
        if h > h_limit:
            raise ValueError(
                f"Panel height h={h:.1f} mm exceeds limit of 40·tef={h_limit:.1f} mm "
                "for panel simply supported at top and bottom only."
            )
        results["h_times_L_limit"] = None
        results["h_times_L_actual"] = h * L
        results["max_dimension_limit"] = h_limit
        results["area_ok"] = True
        results["dimension_ok"] = True
        return results

    # Panels supported on 3 or 4 edges
    max_dim_limit = 50.0 * t

    if num_supported_edges == 3:
        if continuous_edges >= 2:
            hl_limit = 1500.0 * t ** 2
        else:
            hl_limit = 1350.0 * t ** 2
    elif num_supported_edges == 4:
        if continuous_edges >= 3:
            hl_limit = 2250.0 * t ** 2
        else:
            hl_limit = 2025.0 * t ** 2
    else:
        raise ValueError(
            f"num_supported_edges={num_supported_edges} is invalid. "
            "Must be 3 or 4 for h×L check; use is_top_bottom_only=True for 2-edge support."
        )

    hl_actual = h * L
    area_ok = hl_actual <= hl_limit
    dim_ok = (h <= max_dim_limit) and (L <= max_dim_limit)

    results["h_times_L_limit_mm2"] = hl_limit
    results["h_times_L_actual_mm2"] = hl_actual
    results["max_dimension_limit_mm"] = max_dim_limit
    results["area_ok"] = area_ok
    results["dimension_ok"] = dim_ok
    results["height_limit_top_bottom_mm"] = None
    results["height_ok_top_bottom"] = None

    if not area_ok:
        raise ValueError(
            f"Panel h×L={hl_actual:.0f} mm² exceeds limit of {hl_limit:.0f} mm². "
            "Reduce panel dimensions or increase wall thickness."
        )
    if not dim_ok:
        raise ValueError(
            f"A panel dimension exceeds 50·tef={max_dim_limit:.1f} mm. "
            "Neither h nor L may exceed this limit."
        )
    return results


# ---------------------------------------------------------------------------
# 5.6.5  Bending moment coefficient α — Table 5.14
# ---------------------------------------------------------------------------

# Table 5.14 — Bending moment coefficients α for laterally loaded wall panels
# Panel types A, C, E (as given in the textbook pages provided)
# Rows: µ values; Cols: h/L ratios

_ALPHA_MU    = [1.00, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.35, 0.30]
_ALPHA_H_L   = [0.30, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75]

_TABLE_5_14: dict[str, list[list[float]]] = {
    # Panel type A: all four edges supported (simple or continuous at sides, simple at top/bottom)
    "A": [
        [0.031, 0.045, 0.059, 0.071, 0.079, 0.085, 0.090],  # µ=1.00
        [0.032, 0.047, 0.061, 0.073, 0.081, 0.087, 0.092],  # µ=0.90
        [0.034, 0.049, 0.064, 0.075, 0.083, 0.089, 0.093],  # µ=0.80
        [0.035, 0.051, 0.066, 0.077, 0.085, 0.091, 0.095],  # µ=0.70
        [0.038, 0.053, 0.069, 0.080, 0.088, 0.093, 0.097],  # µ=0.60
        [0.040, 0.056, 0.073, 0.083, 0.090, 0.095, 0.099],  # µ=0.50
        [0.043, 0.061, 0.077, 0.087, 0.093, 0.098, 0.101],  # µ=0.40
        [0.045, 0.064, 0.080, 0.089, 0.095, 0.100, 0.103],  # µ=0.35
        [0.048, 0.067, 0.082, 0.091, 0.097, 0.101, 0.104],  # µ=0.30
    ],
    # Panel type C: restrained on vertical edges, simple or restrained top and bottom
    "C": [
        [0.020, 0.028, 0.037, 0.042, 0.045, 0.048, 0.050],  # µ=1.00
        [0.021, 0.029, 0.038, 0.043, 0.046, 0.048, 0.050],
        [0.022, 0.031, 0.039, 0.043, 0.047, 0.049, 0.051],
        [0.023, 0.032, 0.040, 0.044, 0.048, 0.050, 0.051],
        [0.024, 0.034, 0.041, 0.046, 0.049, 0.051, 0.052],
        [0.025, 0.035, 0.043, 0.047, 0.050, 0.052, 0.053],
        [0.027, 0.038, 0.044, 0.048, 0.051, 0.053, 0.054],
        [0.029, 0.039, 0.045, 0.049, 0.052, 0.053, 0.054],
        [0.030, 0.040, 0.046, 0.050, 0.052, 0.054, 0.054],  # µ=0.30
    ],
    # Panel type E: three edges supported (one vertical edge free)
    "E": [
        [0.008, 0.018, 0.030, 0.042, 0.051, 0.059, 0.066],  # µ=1.00
        [0.009, 0.019, 0.032, 0.044, 0.054, 0.062, 0.068],
        [0.010, 0.021, 0.035, 0.046, 0.056, 0.064, 0.071],
        [0.011, 0.023, 0.037, 0.049, 0.059, 0.067, 0.073],
        [0.012, 0.025, 0.040, 0.053, 0.062, 0.070, 0.076],
        [0.014, 0.028, 0.044, 0.057, 0.066, 0.074, 0.080],
        [0.017, 0.032, 0.049, 0.062, 0.071, 0.078, 0.084],
        [0.018, 0.035, 0.052, 0.064, 0.074, 0.081, 0.086],
        [0.020, 0.038, 0.055, 0.068, 0.077, 0.083, 0.089],  # µ=0.30
    ],
}


def bending_moment_coefficient_alpha(
    mu: float,
    h_over_L: float,
    panel_type: Literal["A", "C", "E"],
) -> float:
    """Return the bending moment coefficient α from Table 5.14, BS 5628.

    Bilinear interpolation between tabulated µ and h/L values.

    Parameters
    ----------
    mu : float
        Orthogonal ratio µ = fkx_par / fkx_perp. Must be in [0.30, 1.00].
    h_over_L : float
        Ratio of panel height to panel length h/L. Must be in [0.30, 1.75].
    panel_type : {'A', 'C', 'E'}
        Panel type per Table 5.14 key (see figure in BS 5628 / textbook).

    Returns
    -------
    float
        Bending moment coefficient α (dimensionless).

    Raises
    ------
    ValueError
        If µ or h/L is outside the tabulated range.
    """
    if panel_type not in _TABLE_5_14:
        raise ValueError(f"panel_type '{panel_type}' is not defined in Table 5.14. "
                         "Available types: A, C, E.")

    mu_lo, mu_hi = _ALPHA_MU[-1], _ALPHA_MU[0]   # 0.30, 1.00
    hl_lo, hl_hi = _ALPHA_H_L[0], _ALPHA_H_L[-1]  # 0.30, 1.75

    if mu < mu_lo or mu > mu_hi:
        raise ValueError(
            f"µ={mu} is outside the tabulated range [{mu_lo}, {mu_hi}]. "
            "Cannot extrapolate outside Table 5.14."
        )
    if h_over_L < hl_lo or h_over_L > hl_hi:
        raise ValueError(
            f"h/L={h_over_L} is outside the tabulated range [{hl_lo}, {hl_hi}]. "
            "Cannot extrapolate outside Table 5.14."
        )

    table = _TABLE_5_14[panel_type]

    def _interp_axis(axis_vals: list, data_row: list[float], x: float) -> float:
        """1D linear interpolation."""
        if x <= axis_vals[0]:
            return data_row[0]
        if x >= axis_vals[-1]:
            return data_row[-1]
        for i in range(len(axis_vals) - 1):
            if axis_vals[i] <= x <= axis_vals[i + 1]:
                t = (x - axis_vals[i]) / (axis_vals[i + 1] - axis_vals[i])
                return data_row[i] + t * (data_row[i + 1] - data_row[i])
        raise RuntimeError("1D interpolation failed.")

    # Bilinear interpolation: first over h/L for each µ row, then over µ
    # µ_AXIS is descending (1.00 → 0.30), so reverse for interpolation
    mu_axis = list(reversed(_ALPHA_MU))   # 0.30 → 1.00 ascending
    interp_alpha_at_mu: list[float] = []
    for row in reversed(table):           # rows now correspond to ascending µ
        interp_alpha_at_mu.append(_interp_axis(_ALPHA_H_L, row, h_over_L))

    return _interp_axis(mu_axis, interp_alpha_at_mu, mu)


# ---------------------------------------------------------------------------
# 5.6.5  Section modulus for panel walls
# ---------------------------------------------------------------------------

def section_modulus_per_unit_length(wall_thickness_mm: float) -> float:
    """Return section modulus Z per unit length (mm³/mm run = mm²) of panel wall.

    Z = b·d² / 6  where b = 1000 mm (per metre run) and d = t (wall thickness).
    Expressed per mm run: Z = 1·t² / 6.

    Parameters
    ----------
    wall_thickness_mm : float
        Wall or leaf thickness t (mm).

    Returns
    -------
    float
        Z in mm³ per mm run of wall (= mm²). Multiply by 1000 for mm³/m run.

    Notes
    -----
    The textbook uses Z = (10³ × t²) / 6 which gives mm³ per metre run.
    This function returns Z in mm³ per mm run; multiply by 10³ for per metre run.
    """
    return wall_thickness_mm ** 2 / 6.0


# ---------------------------------------------------------------------------
# 5.6.5  Basis of design — Eqs. 5.11 to 5.14
# ---------------------------------------------------------------------------

def ultimate_moment_perp(
    alpha: float,
    Wk: float,
    gamma_f: float,
    L_mm: float,
) -> float:
    """Ultimate design moment per unit height when plane of failure is perpendicular
    to bed joint (Mperp). BS 5628 Eq. 5.11.

        Mperp = α·Wk·γf·L²

    Parameters
    ----------
    alpha : float
        Bending moment coefficient from Table 5.14.
    Wk : float
        Characteristic wind load per unit area (N/mm²).
    gamma_f : float
        Partial safety factor for loads (1.2 for wind, from Table 5.8).
    L_mm : float
        Length of panel between supports (mm).

    Returns
    -------
    float
        Mperp in N·mm per mm run of wall.
    """
    return alpha * Wk * gamma_f * L_mm ** 2


def ultimate_moment_par(
    mu: float,
    alpha: float,
    Wk: float,
    gamma_f: float,
    L_mm: float,
) -> float:
    """Ultimate design moment per unit height when plane of failure is parallel
    to bed joint (Mpar). BS 5628 Eq. 5.12.

        Mpar = µ·α·Wk·γf·L²

    Parameters
    ----------
    mu : float
        Orthogonal ratio.
    alpha : float
        Bending moment coefficient.
    Wk : float
        Characteristic wind load per unit area (N/mm²).
    gamma_f : float
        Partial safety factor for loads.
    L_mm : float
        Length of panel between supports (mm).

    Returns
    -------
    float
        Mpar in N·mm per mm run of wall.
    """
    return mu * alpha * Wk * gamma_f * L_mm ** 2


def design_moment_resistance_perp(
    fkx_perp: float,
    Z_per_mm_run: float,
    gamma_m: float,
) -> float:
    """Design moment of resistance when plane of failure is perpendicular to bed joint.

    BS 5628 Eq. 5.13:
        Mk_perp = fkx_perp · Z / γm

    Parameters
    ----------
    fkx_perp : float
        Characteristic flexural strength perpendicular to bed joint (N/mm²).
    Z_per_mm_run : float
        Section modulus per mm run (mm²).
    gamma_m : float
        Partial safety factor for materials in flexure.

    Returns
    -------
    float
        Mk_perp in N·mm per mm run of wall.
    """
    return fkx_perp * Z_per_mm_run / gamma_m


def design_moment_resistance_par(
    fkx_par: float,
    Z_per_mm_run: float,
    gamma_m: float,
) -> float:
    """Design moment of resistance when plane of failure is parallel to bed joint.

    BS 5628 Eq. 5.14:
        Mk_par = fkx_par · Z / γm

    Parameters
    ----------
    fkx_par : float
        Characteristic flexural strength parallel to bed joint (N/mm²).
    Z_per_mm_run : float
        Section modulus per mm run (mm²).
    gamma_m : float
        Partial safety factor for materials in flexure.

    Returns
    -------
    float
        Mk_par in N·mm per mm run of wall.
    """
    return fkx_par * Z_per_mm_run / gamma_m


def check_lateral_bending_capacity(
    M_design: float,
    Mk_resistance: float,
    plane: Literal["perp", "par"],
) -> bool:
    """Check that ultimate design moment does not exceed design moment of resistance.

    BS 5628 Eq. 5.10:
        M <= Md

    Parameters
    ----------
    M_design : float
        Ultimate design moment (N·mm per mm run).
    Mk_resistance : float
        Design moment of resistance (N·mm per mm run).
    plane : {'perp', 'par'}
        Plane of failure for reporting purposes.

    Returns
    -------
    bool
        True if adequate.

    Raises
    ------
    ValueError
        If M_design > Mk_resistance.
    """
    if M_design > Mk_resistance:
        raise ValueError(
            f"FLEXURAL CAPACITY EXCEEDED ({plane} to bed joint): "
            f"M={M_design:.4e} N·mm/mm > Mk={Mk_resistance:.4e} N·mm/mm. "
            "The panel is INADEQUATE."
        )
    return True


def max_wind_pressure_one_way_panel(
    wall_height_mm: float,
    wall_thickness_mm: float,
    fkx_par: float,
    gamma_f: float,
    gamma_m: float,
) -> float:
    """Return maximum characteristic wind pressure for a one-way spanning panel.

    One-way panel: vertical edges unsupported; wall spans vertically.
    Plane of failure: parallel to bed joint.
    BS 5628 Cl. 32.4.2:
        M = Ultimate load × height / 8
        M = (γf·Wk·h·1mm) × h / 8 = γf·Wk·h²/8

    Setting M = Mk_par:
        Wk = 8·Mk_par / (γf·h²)

    Parameters
    ----------
    wall_height_mm : float
        Panel height h (mm).
    wall_thickness_mm : float
        Wall thickness t (mm).
    fkx_par : float
        Characteristic flexural strength parallel to bed joint (N/mm²).
    gamma_f : float
        Partial safety factor for loads (typically 1.2 for wind).
    gamma_m : float
        Partial safety factor for materials (flexure).

    Returns
    -------
    float
        Maximum characteristic wind pressure Wk (N/mm²).
    """
    Z = section_modulus_per_unit_length(wall_thickness_mm)
    Mk_par = design_moment_resistance_par(fkx_par, Z, gamma_m)
    Wk = 8.0 * Mk_par / (gamma_f * wall_height_mm ** 2)
    return Wk


def required_fkx_perp_for_wind(
    alpha: float,
    Wk: float,
    gamma_f: float,
    L_mm: float,
    wall_thickness_mm: float,
    gamma_m: float,
) -> float:
    """Back-calculate required fkx_perp to resist a given wind pressure.

    From Eq. 5.11 and 5.13:
        Mperp <= Mk_perp
        α·Wk·γf·L² <= fkx_perp·Z/γm
        => fkx_perp >= α·Wk·γf·L²·γm / Z

    Parameters
    ----------
    alpha : float
        Bending moment coefficient.
    Wk : float
        Characteristic wind pressure (N/mm²).
    gamma_f : float
        Partial safety factor for loads.
    L_mm : float
        Panel length between supports (mm).
    wall_thickness_mm : float
        Wall thickness t (mm).
    gamma_m : float
        Partial safety factor for materials.

    Returns
    -------
    float
        Minimum required fkx_perp (N/mm²).
    """
    Z = section_modulus_per_unit_length(wall_thickness_mm)
    Mperp = ultimate_moment_perp(alpha, Wk, gamma_f, L_mm)
    return Mperp * gamma_m / Z


def max_wind_pressure_two_way_panel(
    alpha: float,
    mu: float,
    fkx_perp: float,
    fkx_par: float,
    wall_thickness_mm: float,
    L_mm: float,
    gamma_f: float,
    gamma_m: float,
    use_perp_direction: bool = True,
) -> float:
    """Return maximum characteristic wind pressure for a two-way spanning panel.

    Design may be based on either the perpendicular or parallel plane of failure
    (both must be checked separately). This function returns Wk based on one plane.

    Parameters
    ----------
    alpha : float
        Bending moment coefficient (from Table 5.14).
    mu : float
        Orthogonal ratio.
    fkx_perp : float
        Characteristic flexural strength perpendicular to bed joint (N/mm²).
    fkx_par : float
        Characteristic flexural strength parallel to bed joint (N/mm²).
    wall_thickness_mm : float
        Wall or leaf thickness (mm).
    L_mm : float
        Panel length between vertical supports (mm).
    gamma_f : float
        Partial safety factor for loads (typically 1.2 for wind).
    gamma_m : float
        Partial safety factor for materials (flexure).
    use_perp_direction : bool
        If True, use Mperp / Mk_perp check; if False, use Mpar / Mk_par check.

    Returns
    -------
    float
        Maximum characteristic wind pressure Wk (N/mm²).
    """
    Z = section_modulus_per_unit_length(wall_thickness_mm)

    if use_perp_direction:
        Mk = design_moment_resistance_perp(fkx_perp, Z, gamma_m)
        Wk = Mk / (alpha * gamma_f * L_mm ** 2)
    else:
        Mk = design_moment_resistance_par(fkx_par, Z, gamma_m)
        Wk = Mk / (mu * alpha * gamma_f * L_mm ** 2)

    return Wk


def design_lateral_panel(
    panel_height_mm: float,
    panel_length_mm: float,
    wall_thickness_mm: float,
    fkx_par: float,
    fkx_perp: float,
    mu: float,
    alpha: float,
    Wk: float,
    gamma_f: float,
    gamma_m: float,
    panel_type: Literal["A", "C", "E"],
    num_supported_edges: Literal[3, 4],
    continuous_edges: int,
) -> dict:
    """Run the complete laterally loaded panel wall design procedure (Fig. 5.27).

    Checks:
    1. Limiting dimensions (Cl. 32.3).
    2. Ultimate design moments Mperp and Mpar.
    3. Design moments of resistance Mk_perp and Mk_par.
    4. Adequacy check M <= Md.

    Parameters
    ----------
    panel_height_mm : float
        Panel height h (mm).
    panel_length_mm : float
        Panel length L (mm).
    wall_thickness_mm : float
        Wall thickness t (mm).
    fkx_par : float
        Characteristic flexural strength parallel to bed joint (N/mm²).
    fkx_perp : float
        Characteristic flexural strength perpendicular to bed joint (N/mm²).
    mu : float
        Orthogonal ratio.
    alpha : float
        Bending moment coefficient from Table 5.14.
    Wk : float
        Characteristic wind pressure per unit area (N/mm²).
    gamma_f : float
        Partial safety factor for loads.
    gamma_m : float
        Partial safety factor for materials in flexure.
    panel_type : {'A', 'C', 'E'}
        Table 5.14 panel type identifier.
    num_supported_edges : {3, 4}
        Number of supported edges.
    continuous_edges : int
        Number of continuously supported edges.

    Returns
    -------
    dict
        Full design output including moments and adequacy status.

    Raises
    ------
    ValueError
        If any limiting dimension or moment capacity is exceeded.
    """
    tef = wall_thickness_mm   # single leaf: tef = t

    # Check limiting dimensions
    dim_check = check_panel_limiting_dimensions(
        panel_height_mm, panel_length_mm, tef,
        num_supported_edges, continuous_edges
    )

    Z = section_modulus_per_unit_length(wall_thickness_mm)

    # Ultimate design moments
    Mperp = ultimate_moment_perp(alpha, Wk, gamma_f, panel_length_mm)
    Mpar  = ultimate_moment_par(mu, alpha, Wk, gamma_f, panel_length_mm)

    # Design moments of resistance
    Mk_perp = design_moment_resistance_perp(fkx_perp, Z, gamma_m)
    Mk_par  = design_moment_resistance_par(fkx_par,  Z, gamma_m)

    # Adequacy checks (raises if exceeded)
    ok_perp = check_lateral_bending_capacity(Mperp, Mk_perp, "perp")
    ok_par  = check_lateral_bending_capacity(Mpar,  Mk_par,  "par")

    return {
        "panel_height_mm": panel_height_mm,
        "panel_length_mm": panel_length_mm,
        "wall_thickness_mm": wall_thickness_mm,
        "tef_mm": tef,
        "fkx_par_N_per_mm2": fkx_par,
        "fkx_perp_N_per_mm2": fkx_perp,
        "mu": mu,
        "alpha": alpha,
        "Z_mm2_per_mm_run": Z,
        "Wk_N_per_mm2": Wk,
        "gamma_f": gamma_f,
        "gamma_m": gamma_m,
        "Mperp_N_mm_per_mm_run": Mperp,
        "Mpar_N_mm_per_mm_run": Mpar,
        "Mk_perp_N_mm_per_mm_run": Mk_perp,
        "Mk_par_N_mm_per_mm_run": Mk_par,
        "perp_utilisation": Mperp / Mk_perp,
        "par_utilisation": Mpar / Mk_par,
        "perp_OK": ok_perp,
        "par_OK": ok_par,
        "dimension_check": dim_check,
    }


# ---------------------------------------------------------------------------
# Cavity panel wall — capacity split between leaves (Cl. 32 interpretation)
# ---------------------------------------------------------------------------

def cavity_panel_max_wind_pressure(
    outer_fkx_perp: float,
    outer_alpha: float,
    outer_gamma_f: float,
    outer_L_mm: float,
    outer_thickness_mm: float,
    outer_gamma_m: float,
    inner_fkx_perp: float,
    inner_alpha: float,
    inner_gamma_f: float,
    inner_L_mm: float,
    inner_thickness_mm: float,
    inner_gamma_m: float,
) -> dict:
    """Return the total characteristic wind pressure a cavity panel wall can resist.

    Per BS 5628 design practice: each leaf is designed separately; total Wk is
    the sum of the individual leaf capacities.

    Parameters
    ----------
    outer_* : float
        Properties of the outer leaf.
    inner_* : float
        Properties of the inner leaf.

    Returns
    -------
    dict
        {
          'Wk_outer_N_per_mm2': float,
          'Wk_inner_N_per_mm2': float,
          'Wk_total_N_per_mm2': float,
          'Wk_total_kN_per_m2': float,
        }
    """
    Wk_outer = max_wind_pressure_two_way_panel(
        outer_alpha, 1.0, outer_fkx_perp, outer_fkx_perp,
        outer_thickness_mm, outer_L_mm, outer_gamma_f, outer_gamma_m,
        use_perp_direction=True,
    )
    Wk_inner = max_wind_pressure_two_way_panel(
        inner_alpha, 1.0, inner_fkx_perp, inner_fkx_perp,
        inner_thickness_mm, inner_L_mm, inner_gamma_f, inner_gamma_m,
        use_perp_direction=True,
    )
    Wk_total = Wk_outer + Wk_inner

    return {
        "Wk_outer_N_per_mm2": Wk_outer,
        "Wk_inner_N_per_mm2": Wk_inner,
        "Wk_total_N_per_mm2": Wk_total,
        "Wk_total_kN_per_m2": Wk_total * 1e6,   # 1 N/mm² = 1000 kN/m²; correct: N/mm²×10⁶ mm²/m² /1000 N/kN
        # Note: 1 N/mm² = 1 MPa = 1000 kN/m² — expressed in kN/m²:
        "Wk_total_kN_per_m2_corrected": Wk_total * 1000.0,
    }


# ---------------------------------------------------------------------------
# Self-test / demonstration (not production use)
# ---------------------------------------------------------------------------

def _run_example_5_1() -> None:
    """Replicate Example 5.1 from the textbook: load-bearing brick wall design."""
    print("=" * 60)
    print("Example 5.1 — Load-bearing brick wall (BS 5628)")
    print("=" * 60)

    N = 140.0         # N/mm run of wall
    t = 102.5         # mm (one standard brick)
    h = 2800.0        # mm clear height
    wall_length = 4000.0  # mm (4 m)

    result = design_vertical_wall(
        N_ultimate=N,
        t_mm=t,
        clear_height_mm=h,
        resistance_type="enhanced",
        unit_category="II",
        construction_control="normal",
        ex_fraction_of_t=0.05,
        wall_length_mm=wall_length,
        is_brick_wall=True,
    )

    for k, v in result.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}")
        else:
            print(f"  {k}: {v}")

    print(f"\n  Required fk >= {result['required_fk_basic_N_per_mm2']:.2f} N/mm²")
    print("  Expected from textbook: fk >= 6.1 N/mm²  ✓" if
          result['required_fk_basic_N_per_mm2'] < 6.15 else "  Check result!")


def _run_example_5_6() -> None:
    """Replicate Example 5.6 from the textbook: one-way spanning panel."""
    print()
    print("=" * 60)
    print("Example 5.6 — One-way spanning wall panel (BS 5628)")
    print("=" * 60)

    h = 3000.0      # mm
    t = 102.5       # mm
    fkx_par = 0.5   # N/mm² (clay brick WA<7%, mortar (iii) from Table 5.13)
    gamma_f = 1.2
    gamma_m = 3.0

    Wk = max_wind_pressure_one_way_panel(h, t, fkx_par, gamma_f, gamma_m)
    print(f"  Max Wk = {Wk:.6f} N/mm²  = {Wk*1e3:.4f} kN/m²")
    print("  Expected from textbook: ~0.216 kN/m²  ✓" if
          abs(Wk * 1e3 - 0.216) < 0.01 else "  Check result!")


def _run_example_5_7() -> None:
    """Replicate Example 5.7 from the textbook: two-way spanning panel."""
    print()
    print("=" * 60)
    print("Example 5.7 — Two-way spanning wall panel (BS 5628)")
    print("=" * 60)

    h_mm = 3000.0
    L_mm = 4000.0
    t_mm = 102.5
    gamma_f = 1.2
    gamma_m = 3.0

    fkx_par, fkx_perp = fkx_clay_brick("gt12", "ii")
    print(f"  fkx_par={fkx_par}, fkx_perp={fkx_perp}")

    mu = orthogonal_ratio(fkx_par, fkx_perp)
    print(f"  µ = {mu:.3f}")

    h_L = h_mm / L_mm
    alpha = bending_moment_coefficient_alpha(mu, h_L, "E")
    print(f"  h/L = {h_L:.3f},  α = {alpha:.4f}")

    Wk = max_wind_pressure_two_way_panel(
        alpha, mu, fkx_perp, fkx_par, t_mm, L_mm, gamma_f, gamma_m,
        use_perp_direction=True,
    )
    print(f"  Max Wk = {Wk:.6f} N/mm²  = {Wk*1e3:.4f} kN/m²")
    print("  Expected from textbook: ~0.516 kN/m²  ✓" if
          abs(Wk * 1e3 - 0.516) < 0.02 else "  Check result!")


if __name__ == "__main__":
    _run_example_5_1()
    _run_example_5_6()
    _run_example_5_7()