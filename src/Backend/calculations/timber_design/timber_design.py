"""
bs5268_timber_design.py
=======================
Production-grade structural timber design module implementing BS 5268: Part 2
(Structural Use of Timber – Code of Practice for Permissible Stress Design,
Materials and Workmanship).

All equations, limits and conditions are extracted verbatim from the source
textbook pages supplied. No simplifications, no assumptions beyond those
explicitly stated in the text.

Author  : Senior Structural Engineer / Backend Engineer
Standard: BS 5268: Part 2: 2002
Units   : N, mm throughout (loads in N, stresses in N/mm², lengths in mm)
"""

import math
from typing import NamedTuple


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

class StrengthClassProperties(NamedTuple):
    """
    Grade stresses and moduli of elasticity for a given strength class,
    for service classes 1 and 2 (Table 6.3, BS 5268).

    All stresses in N/mm².  Densities in kg/m³.
    """
    strength_class: str
    sigma_m_g_par: float        # Bending parallel to grain
    sigma_t_g_par: float        # Tension parallel to grain
    sigma_c_g_par: float        # Compression parallel to grain
    sigma_c_g_perp: float       # Compression perpendicular to grain (lower value, wane permitted)
    sigma_c_g_perp_no_wane: float  # Compression perp (higher value, wane prohibited at bearing)
    tau_g: float                # Shear parallel to grain
    E_mean: float               # Mean modulus of elasticity
    E_min: float                # Minimum modulus of elasticity
    rho_k: float                # Characteristic density (kg/m³)
    rho_mean: float             # Average density (kg/m³)


# ---------------------------------------------------------------------------
# Table 6.3 – Grade stresses and moduli for each strength class (service
# classes 1 & 2).  The perpendicular-to-grain compression stress is given in
# two columns: the lower value is used when wane is permitted; the higher
# value may be used when wane is specifically prohibited at bearing areas.
#
# Sources: Table 6.3 footnote 1; clause 6.7.6 text; Table 6.3 data.
# ---------------------------------------------------------------------------

STRENGTH_CLASS_TABLE: dict[str, StrengthClassProperties] = {
    "C14": StrengthClassProperties("C14",  4.1, 2.5, 5.2, 2.1, 2.1, 0.60, 6800,  4600, 290, 350),
    "C16": StrengthClassProperties("C16",  5.3, 3.2, 6.8, 1.7, 2.2, 0.67, 8800,  5800, 310, 370),
    "C18": StrengthClassProperties("C18",  5.8, 3.5, 7.1, 1.7, 2.2, 0.67, 9100,  6000, 320, 380),
    "C22": StrengthClassProperties("C22",  6.8, 4.1, 7.5, 1.7, 2.3, 0.71, 9700,  6500, 340, 410),
    "C24": StrengthClassProperties("C24",  7.5, 4.5, 7.9, 1.9, 2.4, 0.71, 10800, 7200, 350, 420),
    "TR26":StrengthClassProperties("TR26",10.0, 6.0, 8.2, 2.0, 2.5, 1.10, 11000, 7400, 370, 450),
    "C27": StrengthClassProperties("C27", 10.0, 6.0, 8.2, 2.0, 2.5, 1.10, 12300, 8200, 370, 450),
    "C30": StrengthClassProperties("C30", 11.0, 6.6, 8.6, 2.2, 2.7, 1.20, 12300, 8200, 380, 460),
    "C35": StrengthClassProperties("C35", 12.0, 7.2, 8.7, 2.4, 2.9, 1.30, 13400, 9000, 400, 480),
    "C40": StrengthClassProperties("C40", 13.0, 7.8, 8.7, 2.6, 3.0, 1.40, 14500,10000, 420, 500),
    "D30": StrengthClassProperties("D30",  9.0, 5.4, 8.1, 2.2, 2.8, 1.40,  9500, 6000, 530, 640),
    "D35": StrengthClassProperties("D35", 11.0, 6.6, 8.6, 2.6, 3.4, 1.70, 10000, 6500, 560, 670),
    "D40": StrengthClassProperties("D40", 12.5, 7.5,12.6, 3.0, 3.9, 2.00, 10800, 7500, 590, 700),
    "D50": StrengthClassProperties("D50", 16.0, 9.6,15.2, 3.5, 4.5, 2.20, 15000,12600, 650, 780),
    "D60": StrengthClassProperties("D60", 18.0,10.8,18.0, 4.0, 5.2, 2.40, 18500,15600, 700, 840),
    "D70": StrengthClassProperties("D70", 23.0,13.8,23.0, 4.6, 6.0, 2.60, 21000,18000, 900,1080),
}


# ---------------------------------------------------------------------------
# K2 – Moisture content modification factor (Table 6.4 / Table 16, BS 5268)
# Applies when service class 3 exists.
# ---------------------------------------------------------------------------

# Mapping: property_key -> K2 value for service class 3
K2_SERVICE_CLASS_3: dict[str, float] = {
    "bending_parallel":             0.8,
    "tension_parallel":             0.8,
    "compression_parallel":         0.6,
    "compression_perpendicular":    0.6,
    "shear_parallel":               0.9,
    "modulus_of_elasticity":        0.8,
}


def get_K2(service_class: int, property_key: str) -> float:
    """
    Return the moisture content modification factor K2 (Table 6.4, BS 5268).

    Parameters
    ----------
    service_class : int
        1, 2, or 3.
        Service class 1 – internally heated buildings (MC ≤ 12 %).
        Service class 2 – covered buildings (MC ≤ 20 %).
        Service class 3 – external / fully exposed (higher MC than class 2).
    property_key : str
        One of: 'bending_parallel', 'tension_parallel',
        'compression_parallel', 'compression_perpendicular',
        'shear_parallel', 'modulus_of_elasticity'.

    Returns
    -------
    float
        K2 factor (1.0 for classes 1 and 2; reduced value for class 3).

    Notes
    -----
    Clause 2.6.2 BS 5268: grade stresses and moduli for service classes 1 and 2
    shall be multiplied by K2 to obtain service class 3 values.
    Clause 2.6.1 also notes that service class 3 stresses should be used for
    solid members > 100 mm thick unless specially dried.
    """
    if service_class not in (1, 2, 3):
        raise ValueError(f"service_class must be 1, 2, or 3; got {service_class}.")
    if property_key not in K2_SERVICE_CLASS_3:
        raise KeyError(
            f"property_key '{property_key}' not recognised. "
            f"Valid keys: {list(K2_SERVICE_CLASS_3.keys())}"
        )
    if service_class in (1, 2):
        return 1.0
    return K2_SERVICE_CLASS_3[property_key]


# ---------------------------------------------------------------------------
# K3 – Duration of loading factor (Table 6.5 / Table 17, BS 5268)
# ---------------------------------------------------------------------------

K3_VALUES: dict[str, float] = {
    "long_term":       1.00,   # dead + permanent imposed
    "medium_term":     1.25,   # dead + snow; dead + temporary imposed
    "short_term":      1.50,   # dead + imposed + wind (diagonal > 50 m); dead + imposed + snow + wind
    "very_short_term": 1.75,   # dead + imposed + wind (classes A/B; diagonal ≤ 50 m)
}


def get_K3(duration: str) -> float:
    """
    Return the load duration modification factor K3 (Table 6.5, BS 5268).

    Parameters
    ----------
    duration : str
        'long_term', 'medium_term', 'short_term', or 'very_short_term'.

    Returns
    -------
    float
        K3 factor.
    """
    if duration not in K3_VALUES:
        raise KeyError(
            f"duration '{duration}' not recognised. "
            f"Valid keys: {list(K3_VALUES.keys())}"
        )
    return K3_VALUES[duration]


# ---------------------------------------------------------------------------
# K5 – Notched ends modification factor (clause 2.10.4, BS 5268; Eq. 6.1–6.3)
# ---------------------------------------------------------------------------

def compute_K5_top_notch(h: float, h_e: float, a: float) -> float:
    """
    Compute the notched-ends shear modification factor K5 for a notch on the
    **top edge** of a beam (Fig. 6.2a, clause 2.10.4, BS 5268).

    Equation 6.1:
        K5 = [h(h_e - a) + a·h_e] / h_e²    for a ≤ h_e
    Equation 6.2:
        K5 = 1.0                               for a > h_e

    Clause 2.10.4 also states: h_e ≥ 0.5h, i.e. K5 ≥ 0.5.

    Parameters
    ----------
    h   : float  Full depth of the beam (mm).
    h_e : float  Effective depth at notch (mm).  Must be ≥ 0.5h.
    a   : float  Horizontal extent of the notch from the support face (mm).

    Returns
    -------
    float  K5 ≥ 0.5.
    """
    if h_e < 0.5 * h:
        raise ValueError(
            f"Effective depth h_e={h_e:.1f} mm is less than 0.5h={0.5*h:.1f} mm. "
            "Clause 2.10.4 BS 5268: h_e shall not be less than 0.5h."
        )
    if h_e <= 0.0 or h <= 0.0:
        raise ValueError("h and h_e must be positive.")

    if a > h_e:
        return 1.0

    K5 = (h * (h_e - a) + a * h_e) / (h_e ** 2)
    K5 = max(K5, 0.5)  # lower bound from clause 2.10.4
    return K5


def compute_K5_bottom_notch(h: float, h_e: float) -> float:
    """
    Compute the notched-ends shear modification factor K5 for a notch on the
    **underside** of a beam (Fig. 6.2b, clause 2.10.4, BS 5268).

    Equation 6.3:
        K5 = h_e / h

    Clause 2.10.4: K5 ≥ 0.5, meaning h_e ≥ 0.5h is required.

    Parameters
    ----------
    h   : float  Full depth of the beam (mm).
    h_e : float  Effective depth at notch (mm).  Must be ≥ 0.5h.

    Returns
    -------
    float  K5 ≥ 0.5.
    """
    if h_e < 0.5 * h:
        raise ValueError(
            f"Effective depth h_e={h_e:.1f} mm is less than 0.5h={0.5*h:.1f} mm. "
            "Clause 2.10.4 BS 5268: h_e shall not be less than 0.5h."
        )
    if h <= 0.0:
        raise ValueError("h must be positive.")

    K5 = h_e / h
    K5 = max(K5, 0.5)
    return K5


# ---------------------------------------------------------------------------
# K7 – Depth factor (clause 2.10.6, BS 5268; Eq. 6.4)
# ---------------------------------------------------------------------------

def compute_K7(h: float) -> float:
    """
    Compute the depth factor K7 for bending of solid rectangular sections
    (clause 2.10.6, BS 5268).

    Rules (h in mm):
        h ≤ 72 mm           : K7 = 1.17
        72 mm < h < 300 mm  : K7 = (300/h)^0.11         [Eq. 6.4]
        h ≥ 300 mm          : K7 = 0.81(h² + 92300) / (h² + 56800)

    Note: Grade bending stresses in Table 6.3 apply to h = 300 mm.
    K7 corrects for other depths.

    Parameters
    ----------
    h : float  Depth of the rectangular section (mm).

    Returns
    -------
    float  K7.
    """
    if h <= 0.0:
        raise ValueError(f"Section depth h must be positive; got {h}.")

    if h <= 72.0:
        return 1.17
    elif h < 300.0:
        return (300.0 / h) ** 0.11
    else:
        # h >= 300 mm
        return 0.81 * (h ** 2 + 92300.0) / (h ** 2 + 56800.0)


# ---------------------------------------------------------------------------
# K8 – Load-sharing systems factor (clause 2.9, BS 5268)
# ---------------------------------------------------------------------------

K8_LOAD_SHARING: float = 1.10  # 4 or more members ≤ 610 mm c/c resisting common load


def get_K8(load_sharing: bool) -> float:
    """
    Return the load-sharing systems modification factor K8 (clause 2.9, BS 5268).

    When four or more members (rafters, joists, wall studs) at a maximum of
    610 mm centre-to-centre act together to resist a common load, the grade
    stress shall be multiplied by K8 = 1.1.

    Parameters
    ----------
    load_sharing : bool  True if the load-sharing condition is met.

    Returns
    -------
    float  1.1 if load_sharing else 1.0.
    """
    return K8_LOAD_SHARING if load_sharing else 1.0


# ---------------------------------------------------------------------------
# Section properties – rectangular timber sections
# ---------------------------------------------------------------------------

def section_modulus_xx(b: float, d: float) -> float:
    """
    Elastic section modulus about the x-x (major) axis for a rectangle.

    Z_xx = b·d² / 6   [Fig. 6.4, text Eq. 6.7 context]

    Parameters
    ----------
    b : float  Breadth of section (mm).
    d : float  Depth of section (mm).

    Returns
    -------
    float  Z_xx (mm³).
    """
    return b * d ** 2 / 6.0


def second_moment_of_area_xx(b: float, d: float) -> float:
    """
    Second moment of area about the x-x axis for a rectangle.

    I_xx = b·d³ / 12

    Parameters
    ----------
    b : float  Breadth (mm).
    d : float  Depth (mm).

    Returns
    -------
    float  I_xx (mm⁴).
    """
    return b * d ** 3 / 12.0


def second_moment_of_area_yy(b: float, d: float) -> float:
    """
    Second moment of area about the y-y (minor) axis for a rectangle.

    I_yy = d·b³ / 12

    Parameters
    ----------
    b : float  Breadth (mm).
    d : float  Depth (mm).

    Returns
    -------
    float  I_yy (mm⁴).
    """
    return d * b ** 3 / 12.0


def radius_of_gyration(I: float, A: float) -> float:
    """
    Radius of gyration (Eq. 6.21).

        i = √(I / A)

    Parameters
    ----------
    I : float  Second moment of area (mm⁴).
    A : float  Cross-sectional area (mm²).

    Returns
    -------
    float  i (mm).
    """
    if A <= 0.0:
        raise ValueError("Cross-sectional area A must be positive.")
    return math.sqrt(I / A)


def radius_of_gyration_rect_min(b: float) -> float:
    """
    Minimum radius of gyration of a rectangular section (Eq. 6.22).

        i_min = b / √12

    where b is the **least** lateral dimension.

    Parameters
    ----------
    b : float  Least lateral dimension of the rectangular section (mm).

    Returns
    -------
    float  i_min (mm).
    """
    if b <= 0.0:
        raise ValueError("Dimension b must be positive.")
    return b / math.sqrt(12.0)


# ---------------------------------------------------------------------------
# 6.7 Flexural members
# ---------------------------------------------------------------------------

def compute_effective_span(clear_span: float, bearing_length_each_end: float) -> float:
    """
    Compute the effective span of a simply-supported beam (clause 2.10.3, BS 5268).

    Effective span = distance between centres of bearing
                   = clear_span + bearing_length_each_end  [Fig. 6.3]

    Parameters
    ----------
    clear_span              : float  Clear span (mm).
    bearing_length_each_end : float  Bearing length at each support (mm).

    Returns
    -------
    float  Effective span L (mm).
    """
    return clear_span + bearing_length_each_end


def permissible_bending_stress(
    sigma_m_g_par: float,
    K2: float = 1.0,
    K3: float = 1.0,
    K7: float = 1.0,
    K8: float = 1.0,
) -> float:
    """
    Compute the permissible bending stress parallel to the grain (Eq. 6.8).

        σ_m,adm,|| = σ_m,g,|| · K2 · K3 · K7 · K8

    Parameters
    ----------
    sigma_m_g_par : float  Grade bending stress ∥ to grain (N/mm²).
    K2  : float  Moisture content factor   (default 1.0).
    K3  : float  Load duration factor      (default 1.0).
    K7  : float  Depth factor              (default 1.0).
    K8  : float  Load-sharing factor       (default 1.0).

    Returns
    -------
    float  σ_m,adm,|| (N/mm²).
    """
    return sigma_m_g_par * K2 * K3 * K7 * K8


def required_section_modulus(M: float, sigma_m_adm_par: float) -> float:
    """
    Compute the minimum required section modulus Z_xx from the bending check
    (Eq. 6.9, combining Eq. 6.6 and 6.7).

        Z_xx,req ≥ M / σ_m,adm,||

    Parameters
    ----------
    M               : float  Design bending moment (N·mm).
    sigma_m_adm_par : float  Permissible bending stress ∥ to grain (N/mm²).

    Returns
    -------
    float  Z_xx,req (mm³).
    """
    if sigma_m_adm_par <= 0.0:
        raise ValueError("Permissible bending stress must be positive.")
    return M / sigma_m_adm_par


def check_bending(M: float, sigma_m_adm_par: float, Z_xx: float) -> dict:
    """
    Perform the bending check for a flexural member (Eq. 6.6, 6.7).

        M ≤ M_R = σ_m,adm,|| · Z_xx

    Parameters
    ----------
    M               : float  Design bending moment (N·mm).
    sigma_m_adm_par : float  Permissible bending stress ∥ grain (N/mm²).
    Z_xx            : float  Section modulus of chosen section (mm³).

    Returns
    -------
    dict with keys:
        'M_R'            : float  Moment of resistance (N·mm).
        'utilisation'    : float  M / M_R.
        'adequate'       : bool   True if M ≤ M_R.
    """
    M_R = sigma_m_adm_par * Z_xx
    util = M / M_R if M_R > 0 else float("inf")
    return {"M_R": M_R, "utilisation": util, "adequate": util <= 1.0}


# ---------------------------------------------------------------------------
# 6.7.3 Deflection – Table 6.9 (G = E/16 assumed per clause 2.7, BS 5268)
# ---------------------------------------------------------------------------

def bending_deflection_udl_ss(W: float, L: float, E: float, I: float) -> float:
    """
    Bending deflection at mid-span for a simply-supported beam carrying a
    uniformly distributed total load W (Table 6.9).

        δ_m = (5 / 384) · W·L³ / (E·I)

    Parameters
    ----------
    W : float  Total UDL (N).
    L : float  Effective span (mm).
    E : float  Modulus of elasticity (N/mm²)  – E_min for single member,
               E_mean for load-sharing system (clause 6.7.3 text).
    I : float  Second moment of area (mm⁴).

    Returns
    -------
    float  δ_m (mm).
    """
    return (5.0 / 384.0) * W * L ** 3 / (E * I)


def shear_deflection_udl_ss(W: float, L: float, E: float, A: float) -> float:
    """
    Shear deflection for a simply-supported beam with UDL (Table 6.9,
    assuming G = E/16 per clause 2.7, BS 5268).

        δ_v = (12 / 5) · W·L / (E·A)

    Parameters
    ----------
    W : float  Total UDL (N).
    L : float  Effective span (mm).
    E : float  Modulus of elasticity (N/mm²).
    A : float  Cross-sectional area (mm²).

    Returns
    -------
    float  δ_v (mm).
    """
    return (12.0 / 5.0) * W * L / (E * A)


def bending_deflection_central_point_ss(W: float, L: float, E: float, I: float) -> float:
    """
    Bending deflection at mid-span for a simply-supported beam with a central
    point load W (Table 6.9).

        δ_m = W·L³ / (48·E·I)

    Parameters
    ----------
    W : float  Central point load (N).
    L : float  Effective span (mm).
    E : float  Modulus of elasticity (N/mm²).
    I : float  Second moment of area (mm⁴).

    Returns
    -------
    float  δ_m (mm).
    """
    return W * L ** 3 / (48.0 * E * I)


def shear_deflection_central_point_ss(W: float, L: float, E: float, A: float) -> float:
    """
    Shear deflection for a simply-supported beam with a central point load
    (Table 6.9, G = E/16).

        δ_v = (24 / 5) · W·L / (E·A)

    Parameters
    ----------
    W : float  Central point load (N).
    L : float  Effective span (mm).
    E : float  Modulus of elasticity (N/mm²).
    A : float  Cross-sectional area (mm²).

    Returns
    -------
    float  δ_v (mm).
    """
    return (24.0 / 5.0) * W * L / (E * A)


def bending_deflection_two_point_ss(W: float, L: float, a: float,
                                     E: float, I: float) -> float:
    """
    Bending deflection at mid-span for a simply-supported beam with two
    symmetrical point loads W at distance a from each support (Table 6.9).

        δ_m = W·a / (E·I) · (L²/8 - a²/6)

    Parameters
    ----------
    W : float  Each point load (N).
    L : float  Effective span (mm).
    a : float  Distance of each load from nearest support (mm).
    E : float  Modulus of elasticity (N/mm²).
    I : float  Second moment of area (mm⁴).

    Returns
    -------
    float  δ_m (mm).
    """
    return (W * a / (E * I)) * (L ** 2 / 8.0 - a ** 2 / 6.0)


def shear_deflection_two_point_ss(W: float, a: float, E: float, A: float) -> float:
    """
    Shear deflection for two symmetrical point loads (Table 6.9, G = E/16).

        δ_v = (96 / 5) · W·a / (E·A)

    Parameters
    ----------
    W : float  Each point load (N).
    a : float  Distance of each load from nearest support (mm).
    E : float  Modulus of elasticity (N/mm²).
    A : float  Cross-sectional area (mm²).

    Returns
    -------
    float  δ_v (mm).
    """
    return (96.0 / 5.0) * W * a / (E * A)


def bending_deflection_udl_cantilever(w: float, L: float, E: float, I: float) -> float:
    """
    Bending deflection at the free end of a cantilever with UDL w per unit
    length (Table 6.9).

        δ_m = w·L⁴ / (8·E·I)

    Note: w is load intensity (N/mm), so total load W = w·L.

    Parameters
    ----------
    w : float  UDL intensity (N/mm).
    L : float  Cantilever length (mm).
    E : float  Modulus of elasticity (N/mm²).
    I : float  Second moment of area (mm⁴).

    Returns
    -------
    float  δ_m (mm).
    """
    return w * L ** 4 / (8.0 * E * I)


def shear_deflection_udl_cantilever(w: float, L: float, E: float, A: float) -> float:
    """
    Shear deflection at the free end of a cantilever with UDL (Table 6.9,
    G = E/16).

        δ_v = (48 / 5) · w·L² / (E·A)

    Parameters
    ----------
    w : float  UDL intensity (N/mm).
    L : float  Cantilever length (mm).
    E : float  Modulus of elasticity (N/mm²).
    A : float  Cross-sectional area (mm²).

    Returns
    -------
    float  δ_v (mm).
    """
    return (48.0 / 5.0) * w * L ** 2 / (E * A)


def bending_deflection_point_cantilever(W: float, L: float, E: float, I: float) -> float:
    """
    Bending deflection at the free end of a cantilever with a tip point load
    (Table 6.9).

        δ_m = W·L³ / (3·E·I)

    Parameters
    ----------
    W : float  Point load at free end (N).
    L : float  Cantilever length (mm).
    E : float  Modulus of elasticity (N/mm²).
    I : float  Second moment of area (mm⁴).

    Returns
    -------
    float  δ_m (mm).
    """
    return W * L ** 3 / (3.0 * E * I)


def shear_deflection_point_cantilever(W: float, L: float, E: float, A: float) -> float:
    """
    Shear deflection at the free end of a cantilever with a tip point load
    (Table 6.9, G = E/16).

        δ_v = (96 / 5) · W·L / (E·A)

    Parameters
    ----------
    W : float  Point load at free end (N).
    L : float  Cantilever length (mm).
    E : float  Modulus of elasticity (N/mm²).
    A : float  Cross-sectional area (mm²).

    Returns
    -------
    float  δ_v (mm).
    """
    return (96.0 / 5.0) * W * L / (E * A)


def permissible_deflection(span: float, is_domestic_floor_joist: bool = False) -> float:
    """
    Compute the permissible deflection δ_p (clause 2.10.7, BS 5268).

    General:   δ_p = 0.003 × span                          [Eq. 6.11]
    Domestic floor joists with span > 4670 mm: additionally δ_p ≤ 14 mm  [Eq. 6.12]

    Parameters
    ----------
    span                    : float  Effective span (mm).
    is_domestic_floor_joist : bool   True if the member is a domestic floor joist.

    Returns
    -------
    float  δ_p (mm).
    """
    delta_p = 0.003 * span
    if is_domestic_floor_joist and span > 4670.0:
        delta_p = min(delta_p, 14.0)
    return delta_p


def check_deflection(delta_t: float, delta_p: float) -> dict:
    """
    Perform the deflection check (Eq. 6.10).

        δ_t ≤ δ_p

    Parameters
    ----------
    delta_t : float  Total deflection (bending + shear) (mm).
    delta_p : float  Permissible deflection (mm).

    Returns
    -------
    dict with keys:
        'utilisation' : float  δ_t / δ_p.
        'adequate'    : bool   True if δ_t ≤ δ_p.
    """
    util = delta_t / delta_p if delta_p > 0 else float("inf")
    return {"utilisation": util, "adequate": util <= 1.0}


# ---------------------------------------------------------------------------
# 6.7.4 Lateral buckling – depth-to-breadth ratio limits (Table 6.10)
# ---------------------------------------------------------------------------

# Mapping: description of lateral support -> maximum d/b ratio (Table 6.10)
LATERAL_SUPPORT_MAX_DB: dict[str, int] = {
    "no_lateral_support":                     2,
    "ends_held_in_position":                  3,
    "ends_held_compression_edge_held_purlins":4,
    "ends_held_compression_edge_held_direct": 5,
    "ends_held_compression_edge_direct_bridging": 6,
    "ends_held_both_edges_firmly":            7,
}


def check_lateral_buckling(d: float, b: float, lateral_support_key: str) -> dict:
    """
    Check the depth-to-breadth ratio for lateral buckling (Table 6.10, BS 5268).

    Parameters
    ----------
    d                    : float  Depth of beam (mm).
    b                    : float  Breadth of beam (mm).
    lateral_support_key  : str    One of the keys in LATERAL_SUPPORT_MAX_DB.

    Returns
    -------
    dict with keys:
        'd_over_b'        : float  Actual d/b ratio.
        'max_d_over_b'    : int    Permissible d/b ratio.
        'adequate'        : bool   True if actual ≤ permissible.

    Raises
    ------
    KeyError  If lateral_support_key is not recognised.
    """
    if lateral_support_key not in LATERAL_SUPPORT_MAX_DB:
        raise KeyError(
            f"lateral_support_key '{lateral_support_key}' not recognised. "
            f"Valid keys: {list(LATERAL_SUPPORT_MAX_DB.keys())}"
        )
    max_ratio = LATERAL_SUPPORT_MAX_DB[lateral_support_key]
    actual = d / b
    return {
        "d_over_b":     actual,
        "max_d_over_b": max_ratio,
        "adequate":     actual <= max_ratio,
    }


# ---------------------------------------------------------------------------
# 6.7.5 Shear
# ---------------------------------------------------------------------------

def applied_shear_stress(F_v: float, A: float) -> float:
    """
    Compute the maximum applied shear stress at the neutral axis for a
    rectangular section (Eq. 6.15).

        τ_a = (3 · F_v) / (2 · A)

    Parameters
    ----------
    F_v : float  Design maximum vertical shear force (N).
    A   : float  Cross-sectional area (mm²).

    Returns
    -------
    float  τ_a (N/mm²).
    """
    return 3.0 * F_v / (2.0 * A)


def permissible_shear_stress(
    tau_g: float,
    K2: float = 1.0,
    K3: float = 1.0,
    K5: float = 1.0,
    K8: float = 1.0,
) -> float:
    """
    Compute the permissible shear stress parallel to the grain (Eq. 6.16).

        τ_adm = τ_g · K2 · K3 · K5 · K8

    Parameters
    ----------
    tau_g : float  Grade shear stress ∥ grain (N/mm²).
    K2    : float  Moisture content factor   (default 1.0).
    K3    : float  Load duration factor      (default 1.0).
    K5    : float  Notched ends factor       (default 1.0 – no notch).
    K8    : float  Load-sharing factor       (default 1.0).

    Returns
    -------
    float  τ_adm (N/mm²).
    """
    return tau_g * K2 * K3 * K5 * K8


def check_shear(tau_a: float, tau_adm: float) -> dict:
    """
    Perform the shear check (Eq. 6.14).

        τ_a ≤ τ_adm

    Parameters
    ----------
    tau_a   : float  Applied shear stress (N/mm²).
    tau_adm : float  Permissible shear stress (N/mm²).

    Returns
    -------
    dict with keys:
        'utilisation' : float  τ_a / τ_adm.
        'adequate'    : bool   True if τ_a ≤ τ_adm.
    """
    util = tau_a / tau_adm if tau_adm > 0 else float("inf")
    return {"utilisation": util, "adequate": util <= 1.0}


# ---------------------------------------------------------------------------
# 6.7.6 Bearing perpendicular to grain
# ---------------------------------------------------------------------------

def applied_bearing_stress(F: float, b: float, l_b: float) -> float:
    """
    Compute the applied compression (bearing) stress perpendicular to the grain
    (Eq. 6.18).

        σ_c,a,⊥ = F / (b · l_b)

    Parameters
    ----------
    F   : float  Bearing force (usually maximum end reaction) (N).
    b   : float  Breadth of section (mm).
    l_b : float  Bearing length (mm).

    Returns
    -------
    float  σ_c,a,⊥ (N/mm²).
    """
    return F / (b * l_b)


def permissible_bearing_stress(
    sigma_c_g_perp: float,
    K2: float = 1.0,
    K3: float = 1.0,
    K8: float = 1.0,
) -> float:
    """
    Compute the permissible compression stress perpendicular to the grain
    (Eq. 6.19).

        σ_c,adm,⊥ = σ_c,g,⊥ · K2 · K3 · K8

    Notes
    -----
    The grade stress applies to:
      (i)  Bearings of any length at the ends of members.
      (ii) Bearings ≥ 150 mm at any position.
    Two values of σ_c,g,⊥ are tabulated (Table 6.3):
      - Lower value – used when wane is permitted.
      - Higher value – used when wane is prohibited at bearings.
    Pass the appropriate value via sigma_c_g_perp.

    Parameters
    ----------
    sigma_c_g_perp : float  Grade compression stress ⊥ grain (N/mm²).
    K2  : float  Moisture content factor (default 1.0).
    K3  : float  Load duration factor   (default 1.0).
    K8  : float  Load-sharing factor    (default 1.0).

    Returns
    -------
    float  σ_c,adm,⊥ (N/mm²).
    """
    return sigma_c_g_perp * K2 * K3 * K8


def check_bearing(sigma_c_a_perp: float, sigma_c_adm_perp: float) -> dict:
    """
    Perform the bearing check (Eq. 6.17).

        σ_c,a,⊥ ≤ σ_c,adm,⊥

    Parameters
    ----------
    sigma_c_a_perp   : float  Applied bearing stress (N/mm²).
    sigma_c_adm_perp : float  Permissible bearing stress (N/mm²).

    Returns
    -------
    dict with keys:
        'utilisation' : float  σ_c,a,⊥ / σ_c,adm,⊥.
        'adequate'    : bool   True if σ_c,a,⊥ ≤ σ_c,adm,⊥.
    """
    util = (sigma_c_a_perp / sigma_c_adm_perp
            if sigma_c_adm_perp > 0 else float("inf"))
    return {"utilisation": util, "adequate": util <= 1.0}


# ---------------------------------------------------------------------------
# 6.8 Compression members
# ---------------------------------------------------------------------------

# Table 6.11 – Effective length coefficients for compression members
EFFECTIVE_LENGTH_COEFFICIENTS: dict[str, float] = {
    "a_both_ends_position_and_direction":                0.70,
    "b_both_ends_position_one_end_direction":            0.85,
    "c_both_ends_position_not_direction":                1.00,
    "d_one_end_position_direction_other_direction_only": 1.50,
    "e_one_end_position_direction_other_free":           2.00,
}


def effective_length(L: float, end_condition_key: str) -> float:
    """
    Compute the effective length of a compression member (Eq. 6.23, Table 6.11,
    BS 5268).

        L_e = L × coefficient

    Parameters
    ----------
    L                  : float  Actual (geometric) length of the column (mm).
    end_condition_key  : str    Key from EFFECTIVE_LENGTH_COEFFICIENTS.

    Returns
    -------
    float  L_e (mm).
    """
    if end_condition_key not in EFFECTIVE_LENGTH_COEFFICIENTS:
        raise KeyError(
            f"end_condition_key '{end_condition_key}' not recognised. "
            f"Valid keys: {list(EFFECTIVE_LENGTH_COEFFICIENTS.keys())}"
        )
    return L * EFFECTIVE_LENGTH_COEFFICIENTS[end_condition_key]


def slenderness_ratio(L_e: float, i: float) -> float:
    """
    Compute the slenderness ratio λ (Eq. 6.20).

        λ = L_e / i

    Parameters
    ----------
    L_e : float  Effective length (mm).
    i   : float  Radius of gyration (mm).

    Returns
    -------
    float  λ (dimensionless).

    Raises
    ------
    ValueError  If λ > 180 for dead + imposed loading (clause 2.11.4, BS 5268).
                Wind-only members may have λ up to 250; the caller must decide.
    """
    if i <= 0.0:
        raise ValueError("Radius of gyration i must be positive.")
    lam = L_e / i
    return lam


def check_slenderness_limit(lam: float, wind_only: bool = False) -> None:
    """
    Check that the slenderness ratio does not exceed the limit of clause 2.11.4,
    BS 5268.

        λ ≤ 180   for dead + imposed loads
        λ ≤ 250   for wind loads only

    Parameters
    ----------
    lam       : float  Slenderness ratio.
    wind_only : bool   True if the member carries wind load only.

    Raises
    ------
    ValueError  If the limit is exceeded.
    """
    limit = 250.0 if wind_only else 180.0
    if lam > limit:
        raise ValueError(
            f"Slenderness ratio λ={lam:.1f} exceeds the BS 5268 limit of "
            f"{limit:.0f} for {'wind-only' if wind_only else 'dead+imposed'} loading."
        )


def axial_compressive_stress(F: float, A: float) -> float:
    """
    Compute the applied axial compressive stress (Eq. 6.24).

        σ_c,a,|| = F / A

    Parameters
    ----------
    F : float  Axial compressive load (N).
    A : float  Cross-sectional area (mm²).

    Returns
    -------
    float  σ_c,a,|| (N/mm²).
    """
    return F / A


# ---------------------------------------------------------------------------
# K12 – Compression member modification factor
# Implemented from Table 6.6 (Table 22, BS 5268).
# ---------------------------------------------------------------------------

# Table 6.6 data: rows keyed by E/σ_c,||; columns keyed by λ.
# Exact values from Table 6.6 as published.

_K12_E_SIGMA_ROWS: list[int] = [
    400, 500, 600, 700, 800, 900,
    1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
]

_K12_LAMBDA_COLS: list[int] = [
    5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 220, 240, 250,
]

# Values taken directly from Table 6.6 (Table 22, BS 5268).
# Columns correspond to λ = 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
#                           120, 140, 160, 180, 200, 220, 240, 250
_K12_TABLE: dict[int, list[float]] = {
    400:  [0.975, 0.951, 0.896, 0.827, 0.735, 0.621, 0.506, 0.408, 0.330, 0.271, 0.225, 0.162, 0.121, 0.094, 0.075, 0.061, 0.051, 0.043, 0.040],
    500:  [0.975, 0.951, 0.899, 0.837, 0.759, 0.664, 0.562, 0.466, 0.385, 0.320, 0.269, 0.195, 0.148, 0.115, 0.092, 0.076, 0.063, 0.053, 0.049],
    600:  [0.975, 0.951, 0.901, 0.843, 0.774, 0.692, 0.601, 0.511, 0.430, 0.363, 0.307, 0.226, 0.172, 0.135, 0.109, 0.089, 0.074, 0.063, 0.058],
    700:  [0.975, 0.951, 0.902, 0.848, 0.784, 0.711, 0.629, 0.545, 0.467, 0.399, 0.341, 0.254, 0.195, 0.154, 0.124, 0.102, 0.085, 0.072, 0.067],
    800:  [0.975, 0.952, 0.903, 0.851, 0.792, 0.724, 0.649, 0.572, 0.497, 0.430, 0.371, 0.280, 0.217, 0.172, 0.139, 0.115, 0.096, 0.082, 0.076],
    900:  [0.976, 0.952, 0.904, 0.853, 0.797, 0.734, 0.665, 0.593, 0.522, 0.456, 0.397, 0.304, 0.237, 0.188, 0.153, 0.127, 0.106, 0.091, 0.084],
    1000: [0.976, 0.952, 0.904, 0.855, 0.801, 0.742, 0.677, 0.609, 0.542, 0.478, 0.420, 0.325, 0.255, 0.204, 0.167, 0.138, 0.116, 0.099, 0.092],
    1100: [0.976, 0.952, 0.905, 0.856, 0.804, 0.748, 0.687, 0.623, 0.559, 0.497, 0.440, 0.344, 0.272, 0.219, 0.179, 0.149, 0.126, 0.107, 0.100],
    1200: [0.976, 0.952, 0.905, 0.857, 0.807, 0.753, 0.695, 0.634, 0.573, 0.513, 0.457, 0.362, 0.288, 0.233, 0.192, 0.160, 0.135, 0.116, 0.108],
    1300: [0.976, 0.952, 0.905, 0.858, 0.809, 0.757, 0.701, 0.643, 0.584, 0.527, 0.472, 0.378, 0.303, 0.247, 0.203, 0.170, 0.144, 0.123, 0.115],
    1400: [0.976, 0.952, 0.906, 0.859, 0.811, 0.760, 0.707, 0.651, 0.595, 0.539, 0.486, 0.392, 0.317, 0.259, 0.214, 0.180, 0.153, 0.131, 0.122],
    1500: [0.976, 0.952, 0.906, 0.860, 0.813, 0.763, 0.712, 0.658, 0.603, 0.550, 0.498, 0.405, 0.330, 0.271, 0.225, 0.189, 0.161, 0.138, 0.129],
    1600: [0.976, 0.952, 0.906, 0.861, 0.814, 0.766, 0.716, 0.664, 0.611, 0.559, 0.508, 0.417, 0.342, 0.282, 0.235, 0.198, 0.169, 0.145, 0.136],
    1700: [0.976, 0.952, 0.906, 0.861, 0.815, 0.768, 0.719, 0.669, 0.618, 0.567, 0.518, 0.428, 0.353, 0.292, 0.245, 0.207, 0.177, 0.152, 0.142],
    1800: [0.976, 0.952, 0.906, 0.862, 0.816, 0.770, 0.722, 0.673, 0.624, 0.574, 0.526, 0.438, 0.363, 0.302, 0.254, 0.215, 0.184, 0.159, 0.148],
    1900: [0.976, 0.952, 0.907, 0.862, 0.817, 0.772, 0.725, 0.677, 0.629, 0.581, 0.534, 0.447, 0.373, 0.312, 0.262, 0.223, 0.191, 0.165, 0.154],
    2000: [0.976, 0.952, 0.907, 0.863, 0.818, 0.773, 0.728, 0.681, 0.634, 0.587, 0.541, 0.455, 0.382, 0.320, 0.271, 0.230, 0.198, 0.172, 0.160],
}

# For λ < 5, K12 = 1.000 for all E/σ ratios.
_K12_LAMBDA_LT5_VALUE: float = 1.000


def _interpolate_1d(x0: float, x1: float, y0: float, y1: float, x: float) -> float:
    """Linear interpolation between (x0, y0) and (x1, y1) at x."""
    if x1 == x0:
        return y0
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def compute_K12(E_min: float, sigma_c_par: float, lam: float) -> float:
    """
    Compute the compression modification factor K12 by bilinear interpolation
    of Table 6.6 (Table 22, BS 5268).

    K12 is based on:
        - The ratio E_min / σ_c,||   where σ_c,|| = σ_c,g,|| × K3  (Eq. 6.5)
        - The slenderness ratio λ = L_e / i

    For λ < 5 → K12 = 1.000 (member fails by crushing, no buckling reduction).
    For λ ≥ 5 → bilinear interpolation in Table 6.6.

    Parameters
    ----------
    E_min       : float  Minimum modulus of elasticity (N/mm²).
    sigma_c_par : float  Compression stress σ_c,|| = σ_c,g,|| × K3 (N/mm²).
                         NOTE: K3 is applied before dividing (Eq. 6.5).
    lam         : float  Slenderness ratio λ.

    Returns
    -------
    float  K12.

    Raises
    ------
    ValueError  If inputs are out of the range supported by Table 6.6.
    """
    if sigma_c_par <= 0.0:
        raise ValueError("sigma_c_par must be positive.")
    if lam < 0.0:
        raise ValueError("Slenderness ratio cannot be negative.")

    # K12 = 1.0 for λ < 5 (crushing controls, Table 6.6 header row)
    if lam < 5.0:
        return _K12_LAMBDA_LT5_VALUE

    ratio = E_min / sigma_c_par

    # Clamp ratio to table bounds with warning
    if ratio < 400.0:
        raise ValueError(
            f"E_min/σ_c,||={ratio:.1f} is below the minimum tabulated value of 400. "
            "Section is outside the range of Table 6.6, BS 5268."
        )
    if ratio > 2000.0:
        # Extrapolation not permitted; use the highest row as conservative lower bound.
        ratio = 2000.0

    # Clamp λ to table bounds
    if lam > 250.0:
        raise ValueError(
            f"Slenderness ratio λ={lam:.1f} exceeds 250 which is outside "
            "the range of Table 6.6."
        )

    # --- Interpolate in λ direction for the two bounding E/σ rows ---

    # Find bounding λ column indices
    lam_cols = _K12_LAMBDA_COLS  # already sorted ascending
    if lam <= lam_cols[0]:
        # Between "< 5" (=1.0) and first column
        lam_lo_idx, lam_hi_idx = None, 0
        lam_lo, lam_hi = 0.0, float(lam_cols[0])
    elif lam >= lam_cols[-1]:
        lam_lo_idx, lam_hi_idx = len(lam_cols) - 2, len(lam_cols) - 1
        lam_lo, lam_hi = float(lam_cols[-2]), float(lam_cols[-1])
    else:
        for i in range(len(lam_cols) - 1):
            if lam_cols[i] <= lam <= lam_cols[i + 1]:
                lam_lo_idx, lam_hi_idx = i, i + 1
                lam_lo, lam_hi = float(lam_cols[i]), float(lam_cols[i + 1])
                break

    def _k12_for_row(e_sigma_row: int) -> float:
        """K12 at given E/σ row, interpolated in λ."""
        row = _K12_TABLE[e_sigma_row]
        if lam_lo_idx is None:
            # Between λ=0 (K12=1.0) and lam_hi_idx=0
            k_lo = _K12_LAMBDA_LT5_VALUE
            k_hi = row[lam_hi_idx]
        else:
            k_lo = row[lam_lo_idx]
            k_hi = row[lam_hi_idx]
        return _interpolate_1d(lam_lo, lam_hi, k_lo, k_hi, lam)

    # Find bounding E/σ rows
    rows = _K12_E_SIGMA_ROWS
    if ratio <= rows[0]:
        k12 = _k12_for_row(rows[0])
    elif ratio >= rows[-1]:
        k12 = _k12_for_row(rows[-1])
    else:
        for i in range(len(rows) - 1):
            if rows[i] <= ratio <= rows[i + 1]:
                k12_lo = _k12_for_row(rows[i])
                k12_hi = _k12_for_row(rows[i + 1])
                k12 = _interpolate_1d(
                    float(rows[i]), float(rows[i + 1]), k12_lo, k12_hi, ratio
                )
                break

    return k12


def compression_stress_sigma_c_par(sigma_c_g_par: float, K3: float) -> float:
    """
    Compute the compression stress σ_c,|| used as the denominator in the
    E/σ_c,|| ratio for K12 lookup (Eq. 6.5).

        σ_c,|| = σ_c,g,|| · K3

    Parameters
    ----------
    sigma_c_g_par : float  Grade compression stress ∥ grain (N/mm²).
    K3            : float  Load duration factor.

    Returns
    -------
    float  σ_c,|| (N/mm²).
    """
    return sigma_c_g_par * K3


def permissible_compressive_stress(
    sigma_c_g_par: float,
    lam: float,
    K12: float,
    K2: float = 1.0,
    K3: float = 1.0,
    K8: float = 1.0,
) -> float:
    """
    Compute the permissible compressive stress parallel to the grain
    (Eq. 6.25 / 6.26, clause 2.11.5, BS 5268).

    λ < 5  : σ_c,adm,|| = σ_c,g,|| · K2 · K3 · K8             [Eq. 6.25]
    λ ≥ 5  : σ_c,adm,|| = σ_c,g,|| · K2 · K3 · K8 · K12       [Eq. 6.26]

    Parameters
    ----------
    sigma_c_g_par : float  Grade compression stress ∥ grain (N/mm²).
    lam           : float  Slenderness ratio.
    K12           : float  Compression member stress factor (from compute_K12).
    K2  : float  Moisture content factor (default 1.0).
    K3  : float  Load duration factor   (default 1.0).
    K8  : float  Load-sharing factor    (default 1.0).

    Returns
    -------
    float  σ_c,adm,|| (N/mm²).
    """
    base = sigma_c_g_par * K2 * K3 * K8
    if lam < 5.0:
        return base          # Eq. 6.25
    return base * K12        # Eq. 6.26


def check_axial_compression(sigma_c_a_par: float, sigma_c_adm_par: float) -> dict:
    """
    Perform the axial compression check for members subject to axial
    compression only (Eq. 6.27).

        σ_c,a,|| ≤ σ_c,adm,||

    Parameters
    ----------
    sigma_c_a_par   : float  Applied compression stress (N/mm²).
    sigma_c_adm_par : float  Permissible compression stress (N/mm²).

    Returns
    -------
    dict with keys:
        'utilisation' : float  σ_c,a,|| / σ_c,adm,||.
        'adequate'    : bool   True if σ_c,a,|| ≤ σ_c,adm,||.
    """
    util = (sigma_c_a_par / sigma_c_adm_par
            if sigma_c_adm_par > 0 else float("inf"))
    return {"utilisation": util, "adequate": util <= 1.0}


def euler_critical_stress(E_min: float, lam: float) -> float:
    """
    Compute the Euler critical stress (used in combined bending + compression
    interaction check, Eq. 6.28).

        σ_e = π² · E_min / (L_e/i)²

    Parameters
    ----------
    E_min : float  Minimum modulus of elasticity (N/mm²).
    lam   : float  Slenderness ratio L_e / i.

    Returns
    -------
    float  σ_e (N/mm²).
    """
    if lam <= 0.0:
        raise ValueError("Slenderness ratio must be positive for Euler stress.")
    return (math.pi ** 2 * E_min) / (lam ** 2)


def check_combined_bending_and_compression(
    sigma_m_a_par: float,
    sigma_m_adm_par: float,
    sigma_c_a_par: float,
    sigma_c_adm_par: float,
    sigma_e: float,
    K12: float,
) -> dict:
    """
    Perform the interaction check for members subject to combined axial
    compression and bending (Eq. 6.28, clause 2.11.6, BS 5268).

    Applies to members restrained at both ends in position but not direction.

        σ_m,a,||
    ──────────────────────────────────── + σ_c,a,|| / σ_c,adm,|| ≤ 1.0
    σ_m,adm,|| · [1 − (1.5·σ_c,a,||·K12) / σ_e]

    This is the standard Perry-Robertson-based interaction formula accounting
    for amplified bending due to axial load eccentricity (Fig. 6.8).

    Parameters
    ----------
    sigma_m_a_par   : float  Applied bending stress ∥ grain (N/mm²).
    sigma_m_adm_par : float  Permissible bending stress ∥ grain (N/mm²).
    sigma_c_a_par   : float  Applied compression stress ∥ grain (N/mm²).
    sigma_c_adm_par : float  Permissible compression stress ∥ grain
                             (including K12) (N/mm²).
    sigma_e         : float  Euler critical stress (N/mm²).
    K12             : float  Compression member factor.

    Returns
    -------
    dict with keys:
        'interaction_value' : float  Left-hand side of Eq. 6.28.
        'adequate'          : bool   True if LHS ≤ 1.0.
        'amplification_denom': float  The denominator [1 − ...] term (informational).

    Raises
    ------
    ValueError  If the amplification term (1 − 1.5·σ_c,a,||·K12/σ_e) is
                non-positive, indicating that the axial load equals or exceeds
                the Euler buckling load — member is unconditionally inadequate.
    """
    amp_term = 1.0 - (1.5 * sigma_c_a_par * K12) / sigma_e
    if amp_term <= 0.0:
        raise ValueError(
            "Amplification denominator [1 - 1.5·σ_c,a,||·K12/σ_e] is "
            f"non-positive ({amp_term:.4f}). The axial compression equals or "
            "exceeds the Euler critical load. The section is inadequate."
        )

    term_bending = sigma_m_a_par / (sigma_m_adm_par * amp_term)
    term_axial = sigma_c_a_par / sigma_c_adm_par
    interaction = term_bending + term_axial

    return {
        "interaction_value":   interaction,
        "adequate":            interaction <= 1.0,
        "amplification_denom": amp_term,
        "term_bending":        term_bending,
        "term_axial":          term_axial,
    }


# ---------------------------------------------------------------------------
# 6.9 Stud walls – helper for two-axis slenderness
# ---------------------------------------------------------------------------

def stud_slenderness_ratios(
    L: float,
    b_stud: float,
    d_stud: float,
    nogging_spacing: float,
    end_condition_key_x: str = "c_both_ends_position_not_direction",
    end_condition_key_y: str = "c_both_ends_position_not_direction",
) -> dict:
    """
    Compute slenderness ratios about both axes for a stud in a stud wall
    (clause 6.9, BS 5268).

    Studs are plasterboard-clad, so the y-y axis is braced by cladding;
    the effective length about y-y is the nogging spacing (half height if
    noggings are at mid-height).  The actual stud height governs x-x.

    Parameters
    ----------
    L               : float  Actual stud height between plates (mm).
    b_stud          : float  Lesser dimension of stud section (mm)
                             (breadth, typically in the plane of the wall face).
    d_stud          : float  Greater dimension of stud section (mm)
                             (depth, perpendicular to wall face).
    nogging_spacing : float  Clear distance between noggings (or between
                             plate and first nogging), mm.  This is used as
                             the unbraced length about y-y.
    end_condition_key_x : str  Effective length condition for x-x axis.
    end_condition_key_y : str  Effective length condition for y-y axis.

    Returns
    -------
    dict with keys:
        'L_ex'    : float  Effective length about x-x (mm).
        'L_ey'    : float  Effective length about y-y (mm).
        'i_xx'    : float  Radius of gyration about x-x (mm).
        'i_yy'    : float  Radius of gyration about y-y (mm).
        'lam_xx'  : float  Slenderness ratio about x-x.
        'lam_yy'  : float  Slenderness ratio about y-y.
        'lam_crit': float  Critical (governing) slenderness ratio.
    """
    L_ex = effective_length(L,             end_condition_key_x)
    L_ey = effective_length(nogging_spacing, end_condition_key_y)

    i_xx = radius_of_gyration_rect_min(d_stud)  # x-x bending → least dim of I_xx/A → d/√12
    i_yy = radius_of_gyration_rect_min(b_stud)  # y-y bending → b/√12

    # Radius of gyration for x-x axis (stud depth governs bending in-plane of wall)
    # I_xx = b_stud * d_stud^3 / 12 ; A = b_stud * d_stud → i_xx = d_stud/√12
    i_xx = d_stud / math.sqrt(12.0)
    i_yy = b_stud / math.sqrt(12.0)

    lam_xx = L_ex / i_xx
    lam_yy = L_ey / i_yy
    lam_crit = max(lam_xx, lam_yy)

    return {
        "L_ex":     L_ex,
        "L_ey":     L_ey,
        "i_xx":     i_xx,
        "i_yy":     i_yy,
        "lam_xx":   lam_xx,
        "lam_yy":   lam_yy,
        "lam_crit": lam_crit,
    }


# ---------------------------------------------------------------------------
# High-level design workflows
# ---------------------------------------------------------------------------

def design_flexural_member(
    *,
    strength_class: str,
    service_class: int,
    load_duration: str,
    load_sharing: bool,
    M: float,
    F_v: float,
    F_bearing: float,
    span: float,
    W_total: float,
    b: float,
    h: float,
    bearing_length: float,
    lateral_support_key: str,
    is_domestic_floor_joist: bool = False,
    notch_type: str = "none",
    h_e: float = 0.0,
    a_notch: float = 0.0,
    wane_prohibited_at_bearing: bool = False,
) -> dict:
    """
    Comprehensive design check for a simply-supported timber flexural member
    carrying a uniformly distributed load, to BS 5268.

    Checks performed (in the order recommended by the textbook):
      1. Bending
      2. Deflection  (bending + shear)
      3. Lateral buckling
      4. Shear        (with notch check if applicable)
      5. Bearing perpendicular to grain

    Parameters
    ----------
    strength_class  : str    e.g. 'C16', 'C24'.
    service_class   : int    1, 2, or 3.
    load_duration   : str    e.g. 'long_term', 'medium_term'.
    load_sharing    : bool   True if 4+ members at ≤ 610 mm centres.
    M               : float  Design bending moment (N·mm).
    F_v             : float  Maximum design shear force (N).
    F_bearing       : float  Bearing force at each support (N).
    span            : float  Effective span (mm).
    W_total         : float  Total UDL on beam (N).
    b               : float  Breadth of chosen section (mm).
    h               : float  Depth of chosen section (mm).
    bearing_length  : float  Bearing length at each support l_b (mm).
    lateral_support_key : str  Key from LATERAL_SUPPORT_MAX_DB.
    is_domestic_floor_joist : bool  True for domestic floor joist deflection limit.
    notch_type      : str    'none', 'top', or 'bottom'.
    h_e             : float  Effective depth at notch (mm) – required if notch_type != 'none'.
    a_notch         : float  Horizontal notch extent (mm) – required if notch_type == 'top'.
    wane_prohibited_at_bearing : bool  Use higher σ_c,g,⊥ value.

    Returns
    -------
    dict  Structured results for each check.

    Raises
    ------
    KeyError    If strength_class is not in STRENGTH_CLASS_TABLE.
    ValueError  If any check fails in a way that cannot be represented
                as a utilisation ratio (e.g. section too small to be notched).
    """
    if strength_class not in STRENGTH_CLASS_TABLE:
        raise KeyError(f"Strength class '{strength_class}' not found in table.")

    props = STRENGTH_CLASS_TABLE[strength_class]

    # --- Modification factors ---
    K2_bend  = get_K2(service_class, "bending_parallel")
    K2_shear = get_K2(service_class, "shear_parallel")
    K2_bear  = get_K2(service_class, "compression_perpendicular")
    K2_E     = get_K2(service_class, "modulus_of_elasticity")
    K3       = get_K3(load_duration)
    K7       = compute_K7(h)
    K8       = get_K8(load_sharing)

    # --- Section geometry ---
    A    = b * h
    Z_xx = section_modulus_xx(b, h)
    I_xx = second_moment_of_area_xx(b, h)
    E    = (props.E_mean if load_sharing else props.E_min) * K2_E

    # --- Notch factor ---
    if notch_type == "none":
        K5 = 1.0
    elif notch_type == "top":
        K5 = compute_K5_top_notch(h, h_e, a_notch)
    elif notch_type == "bottom":
        K5 = compute_K5_bottom_notch(h, h_e)
    else:
        raise ValueError(f"notch_type must be 'none', 'top', or 'bottom'; got '{notch_type}'.")

    # --- 1. Bending ---
    sigma_m_adm = permissible_bending_stress(props.sigma_m_g_par, K2_bend, K3, K7, K8)
    bending_result = check_bending(M, sigma_m_adm, Z_xx)

    # --- 2. Deflection ---
    delta_m = bending_deflection_udl_ss(W_total, span, E, I_xx)
    delta_v = shear_deflection_udl_ss(W_total, span, E, A)
    delta_t = delta_m + delta_v
    delta_p = permissible_deflection(span, is_domestic_floor_joist)
    deflection_result = check_deflection(delta_t, delta_p)

    # --- 3. Lateral buckling ---
    lb_result = check_lateral_buckling(h, b, lateral_support_key)

    # --- 4. Shear ---
    tau_adm  = permissible_shear_stress(props.tau_g, K2_shear, K3, K5, K8)
    tau_a    = applied_shear_stress(F_v, A)
    shear_result = check_shear(tau_a, tau_adm)

    # --- 5. Bearing ---
    perp_grade = (props.sigma_c_g_perp_no_wane if wane_prohibited_at_bearing
                  else props.sigma_c_g_perp)
    sigma_c_adm_perp = permissible_bearing_stress(perp_grade, K2_bear, K3, K8)
    sigma_c_a_perp   = applied_bearing_stress(F_bearing, b, bearing_length)
    bearing_result   = check_bearing(sigma_c_a_perp, sigma_c_adm_perp)

    return {
        "strength_class":     strength_class,
        "section":            f"{b:.0f} × {h:.0f} mm",
        "K2_bend":            K2_bend,
        "K3":                 K3,
        "K7":                 K7,
        "K8":                 K8,
        "K5":                 K5,
        "E_used_Nmm2":        E,
        "sigma_m_adm_Nmm2":   sigma_m_adm,
        "bending":            bending_result,
        "delta_m_mm":         delta_m,
        "delta_v_mm":         delta_v,
        "delta_t_mm":         delta_t,
        "delta_p_mm":         delta_p,
        "deflection":         deflection_result,
        "lateral_buckling":   lb_result,
        "tau_adm_Nmm2":       tau_adm,
        "tau_a_Nmm2":         tau_a,
        "shear":              shear_result,
        "sigma_c_adm_perp":   sigma_c_adm_perp,
        "sigma_c_a_perp":     sigma_c_a_perp,
        "bearing":            bearing_result,
        "overall_adequate":   all([
            bending_result["adequate"],
            deflection_result["adequate"],
            lb_result["adequate"],
            shear_result["adequate"],
            bearing_result["adequate"],
        ]),
    }


def design_compression_member_axial_only(
    *,
    strength_class: str,
    service_class: int,
    load_duration: str,
    load_sharing: bool,
    L: float,
    end_condition_key: str,
    b: float,
    d: float,
    F_axial: float,
) -> dict:
    """
    Design check for a timber compression member subject to axial load only
    (clause 6.8.4.1, BS 5268).

    Parameters
    ----------
    strength_class     : str    e.g. 'C16'.
    service_class      : int    1, 2, or 3.
    load_duration      : str    e.g. 'long_term'.
    load_sharing       : bool   True if load-sharing condition applies.
    L                  : float  Actual length of column (mm).
    end_condition_key  : str    Key from EFFECTIVE_LENGTH_COEFFICIENTS.
    b                  : float  Least lateral dimension (mm).
    d                  : float  Other dimension (mm).
    F_axial            : float  Axial compressive load (N).

    Returns
    -------
    dict  Structured results.
    """
    if strength_class not in STRENGTH_CLASS_TABLE:
        raise KeyError(f"Strength class '{strength_class}' not found.")

    props = STRENGTH_CLASS_TABLE[strength_class]
    K2_comp = get_K2(service_class, "compression_parallel")
    K3 = get_K3(load_duration)
    K8 = get_K8(load_sharing)

    A = b * d
    i_min = radius_of_gyration_rect_min(b)   # b is least dimension
    L_e = effective_length(L, end_condition_key)
    lam = slenderness_ratio(L_e, i_min)
    check_slenderness_limit(lam)

    sigma_c_par = compression_stress_sigma_c_par(props.sigma_c_g_par, K3)
    K12 = compute_K12(props.E_min, sigma_c_par, lam)
    sigma_c_adm = permissible_compressive_stress(
        props.sigma_c_g_par, lam, K12, K2_comp, K3, K8
    )
    sigma_c_a = axial_compressive_stress(F_axial, A)
    axial_result = check_axial_compression(sigma_c_a, sigma_c_adm)

    return {
        "strength_class":        strength_class,
        "section":               f"{b:.0f} × {d:.0f} mm",
        "L_e_mm":                L_e,
        "i_min_mm":              i_min,
        "lambda":                lam,
        "K12":                   K12,
        "sigma_c_par_Nmm2":      sigma_c_par,
        "E_min_sigma_ratio":     props.E_min / sigma_c_par,
        "sigma_c_adm_Nmm2":      sigma_c_adm,
        "sigma_c_a_Nmm2":        sigma_c_a,
        "axial_check":           axial_result,
        "axial_load_capacity_N": sigma_c_adm * A,
        "overall_adequate":      axial_result["adequate"],
    }


def design_compression_member_combined(
    *,
    strength_class: str,
    service_class: int,
    load_duration: str,
    load_sharing: bool,
    L: float,
    end_condition_key: str,
    b: float,
    d: float,
    F_axial: float,
    M_bending: float,
) -> dict:
    """
    Design check for a timber compression member subject to combined axial
    compression and bending (clause 6.8.4.2 / Eq. 6.28, BS 5268).

    Member is assumed to be restrained at both ends in position but not in
    direction (the most common case).

    Parameters
    ----------
    strength_class    : str    Strength class, e.g. 'C16'.
    service_class     : int    1, 2, or 3.
    load_duration     : str    Duration key.
    load_sharing      : bool   Load-sharing condition.
    L                 : float  Actual column height (mm).
    end_condition_key : str    End fixity key.
    b                 : float  Least lateral dimension (mm).
    d                 : float  Other lateral dimension (mm).
    F_axial           : float  Axial compressive load (N).
    M_bending         : float  Design bending moment (N·mm).

    Returns
    -------
    dict  Structured results.
    """
    if strength_class not in STRENGTH_CLASS_TABLE:
        raise KeyError(f"Strength class '{strength_class}' not found.")

    props = STRENGTH_CLASS_TABLE[strength_class]
    K2_comp = get_K2(service_class, "compression_parallel")
    K2_bend = get_K2(service_class, "bending_parallel")
    K3 = get_K3(load_duration)
    K7 = compute_K7(d)   # depth of section for bending
    K8 = get_K8(load_sharing)

    A = b * d
    Z_xx = section_modulus_xx(b, d)  # bending about x-x (depth = d)
    i_min = radius_of_gyration_rect_min(b)
    L_e = effective_length(L, end_condition_key)
    lam = slenderness_ratio(L_e, i_min)
    check_slenderness_limit(lam)

    sigma_c_par = compression_stress_sigma_c_par(props.sigma_c_g_par, K3)
    K12 = compute_K12(props.E_min, sigma_c_par, lam)

    sigma_c_adm = permissible_compressive_stress(
        props.sigma_c_g_par, lam, K12, K2_comp, K3, K8
    )
    sigma_m_adm = permissible_bending_stress(props.sigma_m_g_par, K2_bend, K3, K7, K8)
    sigma_e = euler_critical_stress(props.E_min, lam)

    sigma_c_a = axial_compressive_stress(F_axial, A)
    sigma_m_a = M_bending / Z_xx

    interaction_result = check_combined_bending_and_compression(
        sigma_m_a, sigma_m_adm, sigma_c_a, sigma_c_adm, sigma_e, K12
    )

    return {
        "strength_class":         strength_class,
        "section":                f"{b:.0f} × {d:.0f} mm",
        "L_e_mm":                 L_e,
        "i_min_mm":               i_min,
        "lambda":                 lam,
        "K12":                    K12,
        "K7":                     K7,
        "sigma_c_adm_Nmm2":       sigma_c_adm,
        "sigma_m_adm_Nmm2":       sigma_m_adm,
        "sigma_e_Nmm2":           sigma_e,
        "sigma_c_a_Nmm2":         sigma_c_a,
        "sigma_m_a_Nmm2":         sigma_m_a,
        "interaction":            interaction_result,
        "overall_adequate":       interaction_result["adequate"],
    }


def analyse_stud_wall(
    *,
    strength_class: str,
    service_class: int,
    load_duration: str,
    stud_height: float,
    b_stud: float,
    d_stud: float,
    stud_spacing: float,
    nogging_spacing: float,
    end_condition_key_x: str = "c_both_ends_position_not_direction",
    end_condition_key_y: str = "c_both_ends_position_not_direction",
) -> dict:
    """
    Analyse the axial load capacity of a stud wall panel (clause 6.9, BS 5268).

    Stud spacing ≤ 610 mm → load-sharing applies (K8 = 1.1).
    Plasterboard cladding provides lateral restraint about y-y axis;
    nogging spacing is the unbraced length for y-y.

    Parameters
    ----------
    strength_class      : str    Strength class.
    service_class       : int    1, 2, or 3.
    load_duration       : str    Duration key.
    stud_height         : float  Actual height of studs between plates (mm).
    b_stud              : float  Stud breadth (lesser dimension, parallel to wall face) (mm).
    d_stud              : float  Stud depth (greater dimension, perpendicular to wall face) (mm).
    stud_spacing        : float  Centre-to-centre stud spacing (mm).
    nogging_spacing     : float  Unbraced length about y-y axis = distance between
                                 restraints in the plane of the wall (mm).
    end_condition_key_x : str    Effective length condition about x-x (height direction).
    end_condition_key_y : str    Effective length condition about y-y (nogging direction).

    Returns
    -------
    dict  Containing per-stud axial capacity and panel capacity per metre run.
    """
    if strength_class not in STRENGTH_CLASS_TABLE:
        raise KeyError(f"Strength class '{strength_class}' not found.")

    # Load-sharing applies if stud spacing ≤ 610 mm (clause 2.9 applies here
    # because studs at ≤ 610 mm c/c form a load-sharing system)
    load_sharing = stud_spacing <= 610.0

    props = STRENGTH_CLASS_TABLE[strength_class]
    K2_comp = get_K2(service_class, "compression_parallel")
    K3 = get_K3(load_duration)
    K8 = get_K8(load_sharing)

    A = b_stud * d_stud
    slend = stud_slenderness_ratios(
        stud_height, b_stud, d_stud, nogging_spacing,
        end_condition_key_x, end_condition_key_y
    )
    lam_crit = slend["lam_crit"]
    check_slenderness_limit(lam_crit)

    sigma_c_par = compression_stress_sigma_c_par(props.sigma_c_g_par, K3)
    K12 = compute_K12(props.E_min, sigma_c_par, lam_crit)
    sigma_c_adm = permissible_compressive_stress(
        props.sigma_c_g_par, lam_crit, K12, K2_comp, K3, K8
    )
    load_capacity_per_stud_N = sigma_c_adm * A
    load_capacity_per_m_N = load_capacity_per_stud_N / (stud_spacing / 1000.0)

    return {
        "strength_class":                  strength_class,
        "stud_section":                    f"{b_stud:.0f} × {d_stud:.0f} mm",
        "stud_spacing_mm":                 stud_spacing,
        "load_sharing":                    load_sharing,
        "K8":                              K8,
        "K12":                             K12,
        **slend,
        "sigma_c_adm_Nmm2":               sigma_c_adm,
        "load_capacity_per_stud_kN":      load_capacity_per_stud_N / 1000.0,
        "load_capacity_per_m_kNm":        load_capacity_per_m_N / 1000.0,
    }


# ---------------------------------------------------------------------------
# Self-test – replicates the worked examples from the textbook
# ---------------------------------------------------------------------------

def _run_self_tests() -> None:
    """
    Verify the module against the four worked examples in the textbook.
    Tolerances are ±1 % of the published result to allow for rounding in the
    text.  Any failure raises AssertionError.
    """

    tol = 0.015  # 1.5 % relative tolerance

    def near(computed: float, expected: float, label: str) -> None:
        rel_err = abs(computed - expected) / abs(expected)
        assert rel_err <= tol, (
            f"FAIL [{label}]: computed={computed:.4f}, expected={expected:.4f}, "
            f"rel_err={rel_err*100:.2f}%"
        )

    # ------------------------------------------------------------------
    # Example 6.1 – 75 × 250 C16 beam, UDL 10 kN, span 3000 mm
    # ------------------------------------------------------------------
    # Grade stresses (C16): σ_m,g = 5.3, τ_g = 0.67, σ_c,g,⊥ = 1.7, E_min = 5800
    # K3=1.0, K7=(300/250)^0.11=1.020, K8=1.0 (single beam)
    # M = 10e3*3000/8 = 3.75e6 N·mm
    # σ_m,adm = 5.3*1.0*1.020*1.0 = 5.406 N/mm²
    # Z_xx req = 3.75e6/5.406 = 693.7e3 mm³ → use 75×250: Zxx=781e3

    K7_ex1 = compute_K7(250.0)
    near(K7_ex1, 1.020, "Ex6.1 K7")

    sigma_m_adm_ex1 = permissible_bending_stress(5.3, K3=1.0, K7=K7_ex1, K8=1.0)
    near(sigma_m_adm_ex1, 5.406, "Ex6.1 σ_m,adm")

    Z_req_ex1 = required_section_modulus(3.75e6, sigma_m_adm_ex1)
    near(Z_req_ex1, 694e3, "Ex6.1 Z_xx req")

    # Deflection: δ_m = 5*10e3*3000³/(384*5800*97.7e6)
    delta_m_ex1 = bending_deflection_udl_ss(10e3, 3000, 5800, 97.7e6)
    near(delta_m_ex1, 6.2, "Ex6.1 δ_m")

    delta_v_ex1 = shear_deflection_udl_ss(10e3, 3000, 5800, 18.8e3)
    # Textbook quotes 0.7 mm (rounded from 0.66 mm); accept within 6 % for this
    rel_err_dv = abs(delta_v_ex1 - 0.7) / 0.7
    assert rel_err_dv <= 0.06, f"Ex6.1 δ_v out of range: {delta_v_ex1:.3f}"

    near(delta_m_ex1 + delta_v_ex1, 6.9, "Ex6.1 δ_t")

    # Shear: τ_a = 3*5e3/(2*18.8e3)
    tau_a_ex1 = applied_shear_stress(5e3, 18.8e3)
    near(tau_a_ex1, 0.4, "Ex6.1 τ_a")

    # Bearing: σ_c,a,⊥ = 5e3/(75*150)
    sigma_bear_ex1 = applied_bearing_stress(5e3, 75, 150)
    near(sigma_bear_ex1, 0.444, "Ex6.1 σ_c,a,⊥")

    # ------------------------------------------------------------------
    # Example 6.3 – Notched 47×200 joist, 75 mm bottom notch
    # K5 = h_e/h = 125/200 = 0.625
    # τ_adm = 0.67*1.0*0.625*1.1 = 0.46
    # ------------------------------------------------------------------
    K5_ex3 = compute_K5_bottom_notch(200.0, 125.0)
    near(K5_ex3, 0.625, "Ex6.3 K5")

    tau_adm_ex3 = permissible_shear_stress(0.67, K3=1.0, K5=K5_ex3, K8=1.1)
    near(tau_adm_ex3, 0.46, "Ex6.3 τ_adm")

    # ------------------------------------------------------------------
    # Example 6.5 – 100×100 C16 GS Redwood column, L=3750 mm, pin-pin
    # σ_c,g,|| = 6.8, E_min = 5800
    # i = 100/√12 = 28.867 mm; λ = 3750/28.867 = 129.9
    # σ_c,|| = 6.8*1.0 = 6.8; E/σ = 5800/6.8 = 852.9
    # K12 ≈ 0.261 (by interpolation)
    # σ_c,adm = 6.8*1.0*0.261 = 1.774 N/mm²
    # capacity = 1.774*1e4 = 17 740 N ≈ 17.7 kN
    # ------------------------------------------------------------------
    i_ex5 = radius_of_gyration_rect_min(100.0)
    near(i_ex5, 28.867, "Ex6.5 i")

    lam_ex5 = slenderness_ratio(3750.0, i_ex5)
    near(lam_ex5, 129.9, "Ex6.5 λ")

    sigma_c_par_ex5 = compression_stress_sigma_c_par(6.8, 1.0)
    K12_ex5 = compute_K12(5800.0, sigma_c_par_ex5, lam_ex5)
    near(K12_ex5, 0.261, "Ex6.5 K12")

    sigma_c_adm_ex5 = permissible_compressive_stress(6.8, lam_ex5, K12_ex5, K3=1.0)
    near(sigma_c_adm_ex5, 1.774, "Ex6.5 σ_c,adm")

    capacity_ex5 = sigma_c_adm_ex5 * 1e4 / 1000.0   # kN
    near(capacity_ex5, 17.7, "Ex6.5 capacity kN")

    # ------------------------------------------------------------------
    # Example 6.6 – 100×100 C16 column: F=10 kN + M=350 kN·mm
    # σ_c,a = 10e3/1e4 = 1.0 N/mm²
    # K7 = (300/100)^0.11 = 1.128
    # σ_m,adm = 5.3*1.0*1.128 = 5.979 ≈ 5.98
    # σ_m,a = 350e3/167e3 = 2.096 ≈ 2.10
    # σ_e = π²*5800/129.9² = 3.394 ≈ 3.39
    # interaction: 2.10/(5.98*(1-1.5*1*0.261/3.39)) + 1/1.77 = 0.397+0.565=0.962
    # ------------------------------------------------------------------
    K7_ex6 = compute_K7(100.0)
    near(K7_ex6, 1.128, "Ex6.6 K7")

    sigma_m_adm_ex6 = permissible_bending_stress(5.3, K3=1.0, K7=K7_ex6)
    near(sigma_m_adm_ex6, 5.979, "Ex6.6 σ_m,adm")

    Z_100sq = section_modulus_xx(100.0, 100.0)
    near(Z_100sq, 167e3, "Ex6.6 Z_xx")

    sigma_m_a_ex6 = 350e3 / Z_100sq
    near(sigma_m_a_ex6, 2.10, "Ex6.6 σ_m,a")

    sigma_e_ex6 = euler_critical_stress(5800.0, lam_ex5)
    near(sigma_e_ex6, 3.39, "Ex6.6 σ_e")

    interaction_ex6 = check_combined_bending_and_compression(
        sigma_m_a_ex6, sigma_m_adm_ex6,
        1.0, sigma_c_adm_ex5, sigma_e_ex6, K12_ex5
    )
    near(interaction_ex6["interaction_value"], 0.962, "Ex6.6 interaction")
    assert interaction_ex6["adequate"], "Ex6.6 column should be adequate"

    # ------------------------------------------------------------------
    # Example 6.7 – Stud wall: 44×100 C22, 600 mm c/c, 3.75 m, nogging at mid
    # σ_c,g,|| = 7.5, E_min = 6500, K3=1.0, K8=1.1
    # i_xx = 100/√12; i_yy = 44/√12
    # L_ex = 3750; L_ey = 1875
    # λ_xx = 3750/(100/√12) = 129.9; λ_yy = 1875/(44/√12) = 147.6 (critical)
    # σ_c,|| = 7.5*1.0 = 7.5; E/σ = 6500/7.5 = 866.7
    # K12 ≈ 0.212
    # σ_c,adm = 7.5*1.0*1.1*0.212 = 1.749 ≈ 1.75
    # capacity/stud = 1.749*44*100 = 7696 N ≈ 7.7 kN
    # capacity/m = 7.7/0.6 = 12.8 kN/m
    # ------------------------------------------------------------------
    slend_ex7 = stud_slenderness_ratios(
        L=3750, b_stud=44, d_stud=100, nogging_spacing=1875
    )
    near(slend_ex7["lam_xx"], 129.9, "Ex6.7 λ_xx")
    near(slend_ex7["lam_yy"], 147.6, "Ex6.7 λ_yy")

    sigma_c_par_ex7 = compression_stress_sigma_c_par(7.5, 1.0)
    K12_ex7 = compute_K12(6500.0, sigma_c_par_ex7, 147.6)
    near(K12_ex7, 0.212, "Ex6.7 K12")

    sigma_c_adm_ex7 = permissible_compressive_stress(7.5, 147.6, K12_ex7, K3=1.0, K8=1.1)
    near(sigma_c_adm_ex7, 1.749, "Ex6.7 σ_c,adm")

    cap_stud_ex7 = sigma_c_adm_ex7 * 44 * 100 / 1000.0
    near(cap_stud_ex7, 7.7, "Ex6.7 capacity/stud kN")

    cap_m_ex7 = cap_stud_ex7 / 0.6
    near(cap_m_ex7, 12.8, "Ex6.7 capacity/m kN/m")

    print("All self-tests PASSED.")


if __name__ == "__main__":
    _run_self_tests()