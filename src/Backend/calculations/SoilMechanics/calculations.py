"""
Phase Relationships - Core Calculations
All formulas with full derivations and validation
"""

import numpy as np
from .constants import GAMMA_WATER, G
from .validation import *


def calculate_moisture_content(mass_wet: float, mass_dry: float) -> float:
    """
    Moisture content: w = (M_w / M_s) × 100%
    where M_w = M_wet - M_dry
    """
    validate_positive(mass_wet, "mass_wet")
    validate_positive(mass_dry, "mass_dry")
    
    if mass_wet < mass_dry:
        raise SoilValidationError(
            f"Wet mass ({mass_wet}) cannot be less than dry mass ({mass_dry})"
        )
    
    w = ((mass_wet - mass_dry) / mass_dry) * 100.0
    validate_moisture_content(w)
    return w


def calculate_unit_weights(
    mass_total: float, 
    volume: float, 
    w: float, 
    Gs: float
) -> dict:
    """
    Calculate all unit weights from basic measurements
    
    γ = M_total × g / V
    γ_d = γ / (1 + w/100)
    γ_sat = ((Gs + e) / (1 + e)) × γ_w
    γ' = γ_sat - γ_w
    
    where e is calculated from: e = (Gs × w) / Sr (assuming Sr for saturation)
    """
    validate_positive(mass_total, "mass_total")
    validate_positive(volume, "volume")
    validate_moisture_content(w)
    validate_specific_gravity(Gs)
    
    # Bulk unit weight
    gamma_bulk = (mass_total * G) / volume
    
    # Dry unit weight
    w_decimal = w / 100.0
    gamma_dry = gamma_bulk / (1 + w_decimal)
    
    # Calculate void ratio from dry unit weight
    # γ_d = (Gs × γ_w) / (1 + e)
    # e = (Gs × γ_w / γ_d) - 1
    e = (Gs * GAMMA_WATER / gamma_dry) - 1
    validate_void_ratio(e)
    
    # Saturated unit weight
    gamma_sat = ((Gs + e) / (1 + e)) * GAMMA_WATER
    
    # Submerged unit weight
    gamma_submerged = gamma_sat - GAMMA_WATER
    
    return {
        "gamma_bulk": round(gamma_bulk, 2),
        "gamma_dry": round(gamma_dry, 2),
        "gamma_sat": round(gamma_sat, 2),
        "gamma_submerged": round(gamma_submerged, 2),
        "void_ratio": round(e, 3),
    }


def calculate_void_ratio(Vv: float, Vs: float) -> dict:
    """
    Void ratio: e = V_v / V_s
    Porosity: n = e / (1 + e) = V_v / V_total
    """
    validate_positive(Vs, "solid_volume")
    if Vv < 0:
        raise SoilValidationError("Void volume cannot be negative")
    
    e = Vv / Vs
    validate_void_ratio(e)
    
    n = e / (1 + e)
    validate_porosity(n)
    
    return {
        "void_ratio": round(e, 3),
        "porosity": round(n, 3),
    }


def calculate_porosity_from_e(e: float) -> float:
    """n = e / (1 + e)"""
    validate_void_ratio(e)
    n = e / (1 + e)
    validate_porosity(n)
    return n


def calculate_void_ratio_from_n(n: float) -> float:
    """e = n / (1 - n)"""
    validate_porosity(n)
    if n >= 1:
        raise SoilValidationError("Porosity must be < 1")
    e = n / (1 - n)
    return e


def calculate_saturation(Vw: float, Vv: float) -> float:
    """
    Degree of saturation: Sr = (V_w / V_v) × 100%
    """
    validate_positive(Vv, "void_volume")
    if Vw < 0:
        raise SoilValidationError("Water volume cannot be negative")
    if Vw > Vv:
        raise SoilValidationError(
            f"Water volume ({Vw}) cannot exceed void volume ({Vv})"
        )
    
    Sr = (Vw / Vv) * 100.0
    validate_saturation(Sr)
    return round(Sr, 1)


def calculate_zero_air_voids_curve(
    Gs: float, 
    w_min: float, 
    w_max: float, 
    num_points: int = 50
) -> dict:
    """
    Zero Air Voids (ZAV) curve for compaction analysis
    
    At Sr = 100% (fully saturated, no air):
    e = (Gs × w) / 100
    γ_d = (Gs × γ_w) / (1 + e)
    
    Returns arrays of w, γ_d, and e
    """
    validate_specific_gravity(Gs)
    validate_positive(num_points, "num_points")
    
    w_values = np.linspace(w_min, w_max, num_points)
    gamma_d_values = []
    e_values = []
    
    for w in w_values:
        e = (Gs * w) / 100.0
        gamma_d = (Gs * GAMMA_WATER) / (1 + e)
        
        e_values.append(e)
        gamma_d_values.append(gamma_d)
    
    return {
        "moisture_content": w_values.tolist(),
        "dry_density": gamma_d_values,
        "void_ratio": e_values,
    }


def calculate_phase_diagram_volumes(
    w: float, 
    e: float, 
    Sr: float, 
    Gs: float,
    V_total: float = 1.0
) -> dict:
    """
    Calculate all phase volumes for diagram visualization
    
    Given: w, e, Sr, Gs, and total volume
    Returns: Vs, Vw, Va, Vv with closure check
    """
    validate_moisture_content(w)
    validate_void_ratio(e)
    validate_saturation(Sr)
    validate_specific_gravity(Gs)
    
    # Check consistency: e should equal (Gs × w × Sr) / 100
    check_saturation_consistency(w, e, Sr, Gs)
    
    # Calculate volumes (normalized to V_total)
    Vs = V_total / (1 + e)
    Vv = e * Vs
    Vw = (Sr / 100.0) * Vv
    Va = Vv - Vw
    
    # Closure check
    validate_phase_closure(Vv, Vw, Va, Vs)
    
    return {
        "V_solid": round(Vs, 4),
        "V_water": round(Vw, 4),
        "V_air": round(Va, 4),
        "V_void": round(Vv, 4),
        "V_total": round(V_total, 4),
    }


def calculate_e_w_Sr_relationship(
    Gs: float,
    w_range: tuple = (5, 40),
    Sr_values: list = [25, 50, 75, 100],
    num_points: int = 50
) -> dict:
    """
    Generate e-w-Sr curves for visualization
    
    For each Sr value:
    e = (Gs × w × Sr) / 100
    
    Returns curves for plotting
    """
    validate_specific_gravity(Gs)
    
    w_values = np.linspace(w_range[0], w_range[1], num_points)
    curves = {}
    
    for Sr in Sr_values:
        e_values = [(Gs * w * Sr) / 100.0 for w in w_values]
        curves[f"Sr_{Sr}"] = {
            "w": w_values.tolist(),
            "e": e_values,
            "Sr": Sr
        }
    
    return curves