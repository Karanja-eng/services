"""
Slope Stability Analysis
Simplified Bishop Method for Circular Slip Surfaces
"""

import numpy as np
from typing import List, Tuple
from .validation import validate_cohesion, validate_friction_angle, validate_positive


def simplified_bishop_slice(
    W: float,
    c: float,
    phi: float,
    b: float,
    alpha: float,
    u: float = 0.0
) -> Tuple[float, float]:
    """
    Simplified Bishop method for a single slice
    
    Factor of Safety iteration:
    FoS = Σ[c'×b + (W - u×b)×tan(φ')] / [m_α × Σ(W×sin(α))]
    
    where m_α = cos(α) × [1 + tan(α)×tan(φ')/FoS]
    
    Returns: (resisting_moment, driving_moment)
    """
    alpha_rad = np.radians(alpha)
    phi_rad = np.radians(phi)
    
    # Initial FoS guess
    FoS = 1.5
    
    # Iterate to convergence
    for _ in range(20):
        m_alpha = np.cos(alpha_rad) * (1 + np.tan(alpha_rad) * np.tan(phi_rad) / FoS)
        
        if abs(m_alpha) < 1e-6:
            m_alpha = 1.0
        
        # Resisting force
        N_prime = (W - u * b) / m_alpha
        resisting = (c * b + N_prime * np.tan(phi_rad)) / m_alpha
        
        # Driving force
        driving = W * np.sin(alpha_rad)
        
        # New FoS
        FoS_new = resisting / driving if driving > 0 else 10.0
        
        if abs(FoS_new - FoS) < 0.001:
            break
        
        FoS = FoS_new
    
    return resisting, driving


def analyze_slope_stability_bishop(
    slope_height: float,
    slope_angle: float,
    unit_weight: float,
    cohesion: float,
    friction_angle: float,
    num_slices: int = 10,
    water_table_depth: float = None
) -> dict:
    """
    Simplified Bishop method for slope stability
    
    Assumes circular slip surface through toe
    Divides slope into vertical slices
    Calculates FoS by moment equilibrium
    
    FoS = Σ M_resisting / Σ M_driving
    """
    validate_positive(slope_height, "slope_height")
    validate_positive(unit_weight, "unit_weight")
    validate_cohesion(cohesion)
    validate_friction_angle(friction_angle)
    
    if not (0 < slope_angle < 90):
        raise ValueError("Slope angle must be between 0° and 90°")
    
    # Trial circle parameters (simplified)
    # For a typical slope, radius ≈ 1.5 × H
    H = slope_height
    beta = np.radians(slope_angle)
    
    # Critical circle (approximate)
    # Center above toe, radius through toe and crest
    R = 1.5 * H / np.sin(beta)
    
    # Circle center coordinates (toe at origin)
    x_center = 0
    y_center = R
    
    # Slice the potential failure surface
    slice_width = (H / np.tan(beta)) / num_slices
    
    total_resisting = 0
    total_driving = 0
    
    slices_data = []
    
    for i in range(num_slices):
        x = i * slice_width
        
        # Height of slice (from slope surface to arc)
        y_surface = H - x * np.tan(beta)
        
        # Base of slice on circular arc
        y_arc = y_center - np.sqrt(R**2 - (x - x_center)**2)
        
        # Slice height
        h_slice = y_surface - y_arc
        
        if h_slice <= 0:
            continue
        
        # Weight of slice
        W = unit_weight * slice_width * h_slice
        
        # Angle of slice base
        alpha = np.degrees(np.arctan((x - x_center) / (y_center - y_arc)))
        
        # Pore pressure (simplified)
        if water_table_depth and y_arc < (H - water_table_depth):
            u = 9.81 * (H - water_table_depth - y_arc)
        else:
            u = 0
        
        # Bishop slice calculation
        resisting, driving = simplified_bishop_slice(
            W, cohesion, friction_angle, slice_width, alpha, u
        )
        
        total_resisting += resisting
        total_driving += driving
        
        slices_data.append({
            "slice": i + 1,
            "weight": round(W, 2),
            "alpha": round(alpha, 1),
            "resisting": round(resisting, 2),
            "driving": round(driving, 2),
        })
    
    # Factor of Safety
    FoS = total_resisting / total_driving if total_driving > 0 else 10.0
    
    # Stability status
    if FoS >= 1.5:
        status = "STABLE"
        color = "green"
    elif FoS >= 1.3:
        status = "MARGINALLY STABLE"
        color = "yellow"
    else:
        status = "UNSTABLE"
        color = "red"
    
    return {
        "factor_of_safety": round(FoS, 2),
        "critical_circle_center": [round(x_center, 2), round(y_center, 2)],
        "critical_circle_radius": round(R, 2),
        "status": status,
        "status_color": color,
        "slices": slices_data,
        "total_resisting_moment": round(total_resisting, 2),
        "total_driving_moment": round(total_driving, 2),
        "recommendation": get_slope_recommendation(FoS),
    }


def get_slope_recommendation(FoS: float) -> str:
    """Engineering recommendations based on FoS"""
    if FoS >= 2.0:
        return "Factor of safety is excellent. Slope is safe under static loading."
    elif FoS >= 1.5:
        return "Factor of safety meets typical design standards. Slope is stable."
    elif FoS >= 1.3:
        return "Factor of safety is marginal. Consider slope flattening or reinforcement."
    elif FoS >= 1.1:
        return "Factor of safety is low. Slope reinforcement required (geogrid, berms, etc.)."
    else:
        return "Factor of safety is critical. Immediate remediation required. Do not proceed with construction."


def calculate_required_fos_improvement(current_FoS: float, target_FoS: float, c: float, phi: float) -> dict:
    """
    Calculate required improvement in strength parameters
    to achieve target FoS
    
    Simplified: Assume FoS ∝ strength
    """
    if current_FoS >= target_FoS:
        return {
            "improvement_needed": False,
            "message": f"Current FoS ({current_FoS:.2f}) already meets target ({target_FoS:.2f})",
        }
    
    improvement_factor = target_FoS / current_FoS
    
    # Option 1: Increase cohesion
    c_required = c * improvement_factor
    
    # Option 2: Increase friction angle (approximate)
    phi_increase = (improvement_factor - 1) * 5  # Rough estimate
    phi_required = phi + phi_increase
    
    return {
        "improvement_needed": True,
        "current_FoS": current_FoS,
        "target_FoS": target_FoS,
        "improvement_factor": round(improvement_factor, 2),
        "option_1": {
            "method": "Increase cohesion (soil improvement)",
            "current_c": c,
            "required_c": round(c_required, 1),
        },
        "option_2": {
            "method": "Increase friction angle (compaction/drainage)",
            "current_phi": phi,
            "required_phi": round(min(phi_required, 50), 1),
        },
        "option_3": {
            "method": "Flatten slope angle",
            "note": "Reduce slope angle to increase FoS geometrically",
        },
    }