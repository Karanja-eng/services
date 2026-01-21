import math
from typing import List, Optional, Dict, Tuple, Any
from pydantic import BaseModel

class CorrectionComponent(BaseModel):
    name: str
    value: float
    description: str

class CorrectionResult(BaseModel):
    original_value: float
    corrected_value: float
    components: List[CorrectionComponent]
    unit: str

# ==================== DISTANCE CORRECTIONS ====================

def apply_slope_correction(measured_distance: float, vertical_angle_deg: float = 0, h_diff: float = 0) -> CorrectionResult:
    """
    Reduces slope distance to horizontal distance.
    Can be calculated using vertical angle or height difference.
    """
    if vertical_angle_deg != 0:
        angle_rad = math.radians(vertical_angle_deg)
        corrected = measured_distance * math.cos(angle_rad)
        corr_val = corrected - measured_distance
        description = f"Based on vertical angle of {vertical_angle_deg}°"
    else:
        # Using height difference: Dh = L - sqrt(L^2 - h^2) approx h^2 / 2L
        corrected = math.sqrt(max(0, measured_distance**2 - h_diff**2))
        corr_val = corrected - measured_distance
        description = f"Based on height difference of {h_diff}m"
        
    return CorrectionResult(
        original_value=measured_distance,
        corrected_value=round(corrected, 4),
        components=[CorrectionComponent(name="Slope Correction", value=round(corr_val, 4), description=description)],
        unit="m"
    )

def apply_temperature_correction(distance: float, temp: float, standard_temp: float = 20.0, alpha: float = 0.0000116) -> CorrectionComponent:
    """Ct = alpha * L * (T - Ts)"""
    corr = alpha * distance * (temp - standard_temp)
    return CorrectionComponent(
        name="Temperature Correction",
        value=round(corr, 5),
        description=f"Alpha={alpha}, Temp={temp}°C, Standard={standard_temp}°C"
    )

def apply_tension_correction(distance: float, tension: float, standard_tension: float, cross_section: float, E: float = 2.0e11) -> CorrectionComponent:
    """Cp = (P - Ps) * L / (A * E)"""
    corr = (tension - standard_tension) * distance / (cross_section * E)
    return CorrectionComponent(
        name="Tension Correction",
        value=round(corr, 5),
        description=f"Tension={tension}N, Std={standard_tension}N, Area={cross_section}m2, E={E}Pa"
    )

def apply_sag_correction(distance: float, weight_per_m: float, tension: float, spans: int = 1) -> CorrectionComponent:
    """Cs = - (w^2 * L^3) / (24 * P^2) where L is distance per span"""
    l_span = distance / spans
    corr_per_span = -( (weight_per_m**2 * l_span**3) / (24 * tension**2) )
    total_corr = corr_per_span * spans
    return CorrectionComponent(
        name="Sag Correction",
        value=round(total_corr, 5),
        description=f"Weight={weight_per_m}N/m, Tension={tension}N, Spans={spans}"
    )

def apply_sea_level_correction(distance: float, altitude: float, R: float = 6371000) -> CorrectionComponent:
    """Csl = - L * h / R"""
    corr = -(distance * altitude / R)
    return CorrectionComponent(
        name="Sea Level Correction",
        value=round(corr, 5),
        description=f"Altitude={altitude}m, Earth Radius={R}m"
    )

# ==================== ANGLE & LEVEL CORRECTIONS ====================

def apply_curvature_refraction(distance: float, k: float = 0.07, R: float = 6371000) -> CorrectionComponent:
    """Combine curvature and refraction for levelling: C = (1-k) * D^2 / 2R"""
    # Combined correction for RL
    # Curvature (subtract from RL) = D^2 / 2R
    # Refraction (add to RL) = k * D^2 / 2R
    # Resulting effect on staff reading: Reading = Reading - (D^2/2R) + (kD^2/2R) ? 
    # Usually: h_corr = D^2 / (2R) * (1 - 2k)
    # Standard combined correction for survey: C = 0.0673 * D_km^2
    d_km = distance / 1000
    corr = 0.0673 * (d_km**2)
    return CorrectionComponent(
        name="Curvature & Refraction",
        value=round(corr, 4),
        description=f"Distance={distance}m, k={k}"
    )

# ==================== COMPOSITE APPLICATION ====================

def apply_chained_corrections(distance: float, corrections: List[Dict]) -> CorrectionResult:
    """Apply multiple corrections sequentially"""
    current_val = distance
    components = []
    
    for c in corrections:
        name = c.get("name")
        if name == "temperature":
            comp = apply_temperature_correction(distance, c["temp"], c.get("std_temp", 20))
        elif name == "tension":
            comp = apply_tension_correction(distance, c["tension"], c["std_tension"], c["area"])
        elif name == "sag":
            comp = apply_sag_correction(distance, c["weight"], c["tension"], c.get("spans", 1))
        elif name == "sea_level":
            comp = apply_sea_level_correction(distance, c["altitude"])
        else:
            continue
            
        components.append(comp)
        current_val += comp.value
        
    return CorrectionResult(
        original_value=distance,
        corrected_value=round(current_val, 5),
        components=components,
        unit="m"
    )
