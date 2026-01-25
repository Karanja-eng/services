"""
Bearing Capacity & Consolidation Settlement
Terzaghi, Meyerhof, and One-Dimensional Consolidation
"""

import numpy as np
from scipy import interpolate
from .constants import TERZAGHI_FACTORS, MEYERHOF_FACTORS, meyerhof_shape_factors
from .validation import validate_cohesion, validate_friction_angle, validate_positive


# ==================== BEARING CAPACITY ====================

def interpolate_bearing_factors(phi: float, factors_table: dict) -> tuple:
    """
    Interpolate bearing capacity factors for any friction angle
    Returns: (Nc, Nq, Ngamma)
    """
    phi_values = np.array(list(factors_table.keys()))
    Nc_values = np.array([v[0] for v in factors_table.values()])
    Nq_values = np.array([v[1] for v in factors_table.values()])
    Ng_values = np.array([v[2] for v in factors_table.values()])
    
    # Interpolate
    Nc = float(np.interp(phi, phi_values, Nc_values))
    Nq = float(np.interp(phi, phi_values, Nq_values))
    Ng = float(np.interp(phi, phi_values, Ng_values))
    
    return Nc, Nq, Ng


def calculate_terzaghi_bearing_capacity(
    c: float,
    phi: float,
    gamma: float,
    B: float,
    Df: float,
    shape: str = "strip"
) -> dict:
    """
    Terzaghi Bearing Capacity
    
    q_u = c × Nc × sc + q × Nq × sq + 0.5 × γ × B × Nγ × sγ
    
    where:
        q = γ × Df (surcharge from foundation depth)
        sc, sq, sγ = shape factors
    
    Shape factors (Terzaghi):
        Strip: sc=1.0, sq=1.0, sγ=1.0
        Square: sc=1.3, sq=1.0, sγ=0.8
        Circular: sc=1.3, sq=1.0, sγ=0.6
    """
    validate_cohesion(c)
    validate_friction_angle(phi)
    validate_positive(gamma, "unit_weight")
    validate_positive(B, "width")
    
    # Get bearing capacity factors
    Nc, Nq, Ng = interpolate_bearing_factors(phi, TERZAGHI_FACTORS)
    
    # Shape factors (Terzaghi)
    if shape == "strip":
        sc, sq, sg = 1.0, 1.0, 1.0
    elif shape == "square":
        sc, sq, sg = 1.3, 1.0, 0.8
    elif shape == "circular":
        sc, sq, sg = 1.3, 1.0, 0.6
    else:
        sc, sq, sg = 1.0, 1.0, 1.0
    
    # Surcharge
    q = gamma * Df
    
    # Ultimate bearing capacity
    q_ult = (c * Nc * sc) + (q * Nq * sq) + (0.5 * gamma * B * Ng * sg)
    
    return {
        "ultimate_bearing_capacity": round(q_ult, 2),
        "bearing_factors": {"Nc": round(Nc, 2), "Nq": round(Nq, 2), "Ngamma": round(Ng, 2)},
        "shape_factors": {"sc": sc, "sq": sq, "sgamma": sg},
        "surcharge": round(q, 2),
        "method": "Terzaghi",
    }


def calculate_meyerhof_bearing_capacity(
    c: float,
    phi: float,
    gamma: float,
    B: float,
    Df: float,
    shape: str = "strip"
) -> dict:
    """
    Meyerhof Bearing Capacity (with shape and depth factors)
    
    q_u = c × Nc × sc × dc + q × Nq × sq × dq + 0.5 × γ × B × Nγ × sγ × dγ
    
    Depth factors (simplified):
        dc = 1 + 0.4 × (Df / B)  for Df/B ≤ 1
        dq = 1 + 2 × tan(φ) × (1 - sin(φ))² × (Df / B)
        dγ = 1.0
    """
    validate_cohesion(c)
    validate_friction_angle(phi)
    validate_positive(gamma, "unit_weight")
    validate_positive(B, "width")
    
    # Bearing capacity factors (use same as Terzaghi for simplicity)
    Nc, Nq, Ng = interpolate_bearing_factors(phi, MEYERHOF_FACTORS)
    
    # Shape factors (Meyerhof)
    sc, sq, sg = meyerhof_shape_factors(shape)
    
    # Depth factors
    Df_B_ratio = Df / B
    phi_rad = np.radians(phi)
    
    if Df_B_ratio <= 1:
        dc = 1 + 0.4 * Df_B_ratio
        dq = 1 + 2 * np.tan(phi_rad) * (1 - np.sin(phi_rad))**2 * Df_B_ratio
    else:
        dc = 1 + 0.4 * np.arctan(Df / B)
        dq = 1 + 2 * np.tan(phi_rad) * (1 - np.sin(phi_rad))**2 * np.arctan(Df / B)
    
    dg = 1.0
    
    # Surcharge
    q = gamma * Df
    
    # Ultimate bearing capacity
    q_ult = (c * Nc * sc * dc) + (q * Nq * sq * dq) + (0.5 * gamma * B * Ng * sg * dg)
    
    return {
        "ultimate_bearing_capacity": round(q_ult, 2),
        "bearing_factors": {"Nc": round(Nc, 2), "Nq": round(Nq, 2), "Ngamma": round(Ng, 2)},
        "shape_factors": {"sc": round(sc, 2), "sq": round(sq, 2), "sgamma": round(sg, 2)},
        "depth_factors": {"dc": round(dc, 2), "dq": round(dq, 2), "dgamma": dg},
        "surcharge": round(q, 2),
        "method": "Meyerhof",
    }


def calculate_allowable_bearing_capacity(q_ult: float, FS: float = 3.0) -> dict:
    """
    Allowable bearing capacity
    
    q_allow = q_ult / FS
    
    Typical FS:
        - 2.5 to 3.0 for general structures
        - 2.0 for temporary structures
        - 3.5 for important structures
    """
    validate_positive(q_ult, "ultimate_bearing_capacity")
    if FS < 1:
        raise ValueError("Factor of safety must be ≥ 1")
    
    q_allow = q_ult / FS
    
    return {
        "ultimate_bearing_capacity": round(q_ult, 2),
        "allowable_bearing_capacity": round(q_allow, 2),
        "factor_of_safety": FS,
    }


# ==================== CONSOLIDATION & SETTLEMENT ====================

def calculate_compression_index(e_values: list, sigma_values: list) -> dict:
    """
    Determine Cc, Cr, and σ'p from e-log(σ') curve
    
    Cc = Compression index (virgin consolidation)
    Cr = Recompression index
    σ'p = Preconsolidation pressure
    
    Uses Casagrande method for σ'p determination
    """
    if len(e_values) != len(sigma_values) or len(e_values) < 5:
        raise ValueError("Need at least 5 points for consolidation analysis")
    
    e = np.array(e_values)
    sigma = np.array(sigma_values)
    log_sigma = np.log10(sigma)
    
    # Find virgin compression line (steepest slope)
    # Typically after preconsolidation pressure
    
    # Simplified approach: Use last 3-4 points for Cc
    # (In practice, requires graphical Casagrande method)
    
    # Virgin compression line (assume last portion)
    n_virgin = min(4, len(e) // 2)
    slope_Cc, intercept_Cc, _, _, _ = np.polyfit(
        log_sigma[-n_virgin:], e[-n_virgin:], 1, full=True
    )[:2]
    
    Cc = -slope_Cc  # Negative slope (e decreases with log σ')
    
    # Recompression line (assume first portion)
    n_recomp = min(3, len(e) // 2)
    slope_Cr = np.polyfit(log_sigma[:n_recomp], e[:n_recomp], 1)[0]
    Cr = -slope_Cr
    
    # Preconsolidation pressure (simplified)
    # Find intersection or maximum curvature point
    sigma_p = sigma[np.argmax(np.diff(e) / np.diff(log_sigma))]
    
    return {
        "compression_index": round(Cc, 3),
        "recompression_index": round(Cr, 4),
        "preconsolidation_pressure": round(sigma_p, 1),
        "OCR": round(sigma_p / sigma[0], 2) if sigma[0] > 0 else None,
    }


def calculate_primary_settlement(
    H0: float,
    e0: float,
    Cc: float,
    sigma_0: float,
    sigma_f: float,
    Cr: float = None,
    sigma_p: float = None
) -> dict:
    """
    Primary consolidation settlement
    
    Case 1: Normally consolidated (σ'_f > σ'_0, no preconsolidation)
        ΔH = (Cc / (1 + e0)) × H0 × log10(σ'_f / σ'_0)
    
    Case 2: Overconsolidated (σ'_0 < σ'_p < σ'_f)
        ΔH = (Cr / (1 + e0)) × H0 × log10(σ'_p / σ'_0)
             + (Cc / (1 + e0)) × H0 × log10(σ'_f / σ'_p)
    
    Case 3: Overconsolidated, no recompression (σ'_f < σ'_p)
        ΔH = (Cr / (1 + e0)) × H0 × log10(σ'_f / σ'_0)
    """
    validate_positive(H0, "initial_thickness")
    validate_positive(e0, "initial_void_ratio")
    validate_positive(Cc, "compression_index")
    validate_positive(sigma_0, "initial_stress")
    validate_positive(sigma_f, "final_stress")
    
    # Determine consolidation state
    if sigma_p is None or sigma_f > sigma_p:
        # Normally consolidated
        delta_H = (Cc / (1 + e0)) * H0 * np.log10(sigma_f / sigma_0)
        state = "Normally consolidated"
    
    elif sigma_f <= sigma_p and sigma_0 < sigma_p:
        # Overconsolidated, recompression only
        if Cr is None:
            Cr = Cc / 10  # Typical assumption
        delta_H = (Cr / (1 + e0)) * H0 * np.log10(sigma_f / sigma_0)
        state = "Overconsolidated (recompression only)"
    
    else:
        # Overconsolidated with virgin compression
        if Cr is None:
            Cr = Cc / 10
        
        delta_H_recomp = (Cr / (1 + e0)) * H0 * np.log10(sigma_p / sigma_0)
        delta_H_virgin = (Cc / (1 + e0)) * H0 * np.log10(sigma_f / sigma_p)
        delta_H = delta_H_recomp + delta_H_virgin
        state = "Overconsolidated (recompression + virgin)"
    
    # Convert to mm
    delta_H_mm = delta_H * 1000
    
    settlement_ratio = (delta_H / H0) * 100
    
    return {
        "primary_settlement": round(delta_H_mm, 1),
        "settlement_ratio": round(settlement_ratio, 2),
        "consolidation_state": state,
        "unit": "mm",
    }


def calculate_time_rate_of_consolidation(
    Cv: float,
    H_drainage: float,
    time_days: list
) -> dict:
    """
    Time rate of consolidation
    
    Tv = Cv × t / H²
    U = f(Tv)  (degree of consolidation)
    
    For Tv < 0.217: U ≈ √(4×Tv/π) × 100%
    For Tv ≥ 0.217: U ≈ (1 - 10^(-Tv/0.933)) × 100%
    """
    validate_positive(Cv, "coefficient_of_consolidation")
    validate_positive(H_drainage, "drainage_height")
    
    results = []
    
    for t in time_days:
        t_seconds = t * 24 * 3600  # days to seconds
        
        Tv = (Cv * t_seconds) / (H_drainage ** 2)
        
        # Calculate U
        if Tv < 0.217:
            U = np.sqrt(4 * Tv / np.pi) * 100
        else:
            U = (1 - 10**(-Tv / 0.933)) * 100
        
        U = min(100, U)  # Cap at 100%
        
        results.append({
            "time_days": t,
            "time_factor": round(Tv, 4),
            "degree_of_consolidation": round(U, 1),
        })
    
    return {"consolidation_curve": results}