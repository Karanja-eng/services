"""
Shear Strength Analysis
Direct Shear and Triaxial Tests
Mohr-Coulomb Failure Envelope
"""

import numpy as np
from scipy import stats
from typing import List, Tuple, Optional
from .validation import validate_cohesion, validate_friction_angle


def analyze_direct_shear(
    normal_stresses: List[float],
    shear_stresses: List[float]
) -> dict:
    """
    Direct Shear Test Analysis
    
    Mohr-Coulomb: τ = c + σ_n × tan(φ)
    
    Linear regression to find:
        - Cohesion (c) = intercept
        - Friction angle (φ) = arctan(slope)
    
    Returns: c, φ, R²
    """
    if len(normal_stresses) != len(shear_stresses):
        raise ValueError("Normal and shear stress arrays must have same length")
    
    if len(normal_stresses) < 3:
        raise ValueError("Need at least 3 test points for reliable analysis")
    
    sigma_n = np.array(normal_stresses)
    tau = np.array(shear_stresses)
    
    # Linear regression: τ = c + σ_n × tan(φ)
    slope, intercept, r_value, _, _ = stats.linregress(sigma_n, tau)
    
    # Extract parameters
    c = max(0, intercept)  # Cohesion (kPa)
    phi = np.degrees(np.arctan(slope))  # Friction angle (degrees)
    r_squared = r_value ** 2
    
    # Validate
    validate_cohesion(c)
    validate_friction_angle(phi)
    
    # Generate envelope points for plotting
    sigma_min = min(normal_stresses)
    sigma_max = max(normal_stresses) * 1.2
    sigma_range = np.linspace(sigma_min, sigma_max, 50)
    tau_range = c + sigma_range * np.tan(np.radians(phi))
    
    envelope_points = [
        {"sigma": float(s), "tau": float(t)}
        for s, t in zip(sigma_range, tau_range)
    ]
    
    return {
        "cohesion": round(c, 2),
        "friction_angle": round(phi, 1),
        "r_squared": round(r_squared, 4),
        "envelope_points": envelope_points,
        "test_points": [
            {"sigma": float(s), "tau": float(t)}
            for s, t in zip(sigma_n, tau)
        ],
        "soil_type_estimate": estimate_soil_type(c, phi),
    }


def analyze_triaxial_test(
    confining_pressures: List[float],
    deviator_stresses: List[float],
    pore_pressures: Optional[List[float]] = None,
    test_type: str = "CD"
) -> dict:
    """
    Triaxial Test Analysis (UU, CU, CD)
    
    Principal stresses:
        σ₁ = σ₃ + Δσ (major)
        σ₃ = confining pressure (minor)
    
    Effective stress (for CU, CD):
        σ'₁ = σ₁ - u
        σ'₃ = σ₃ - u
    
    Mohr circles and envelope to find c', φ'
    """
    if len(confining_pressures) != len(deviator_stresses):
        raise ValueError("Confining and deviator stress arrays must match")
    
    if len(confining_pressures) < 3:
        raise ValueError("Need at least 3 triaxial tests")
    
    sigma_3 = np.array(confining_pressures)
    delta_sigma = np.array(deviator_stresses)
    sigma_1 = sigma_3 + delta_sigma
    
    # Effective stress analysis
    use_effective_stress = test_type in ["CU", "CD"]
    
    if use_effective_stress and pore_pressures is not None:
        u = np.array(pore_pressures)
        sigma_1_eff = sigma_1 - u
        sigma_3_eff = sigma_3 - u
    else:
        sigma_1_eff = sigma_1
        sigma_3_eff = sigma_3
    
    # Calculate Mohr circle parameters for each test
    # Center: p = (σ₁ + σ₃) / 2
    # Radius: q = (σ₁ - σ₃) / 2
    
    p_values = (sigma_1_eff + sigma_3_eff) / 2
    q_values = (sigma_1_eff - sigma_3_eff) / 2
    
    # For Mohr-Coulomb envelope:
    # sin(φ) = slope of (q vs p) regression
    # c' × cos(φ) = intercept
    
    # Alternative: use peak stress points
    # τ = c + σ × tan(φ)
    # At failure: τ = (σ₁ - σ₃) / 2
    #             σ = (σ₁ + σ₃) / 2
    
    # Linear regression on (p, q)
    slope, intercept, r_value, _, _ = stats.linregress(p_values, q_values)
    
    # Extract parameters
    phi = np.degrees(np.arcsin(slope))
    c = intercept / np.cos(np.radians(phi))
    
    c = max(0, c)
    r_squared = r_value ** 2
    
    # Validate
    validate_cohesion(c)
    validate_friction_angle(phi)
    
    # Generate Mohr circles
    mohr_circles = []
    for i in range(len(sigma_1_eff)):
        center = p_values[i]
        radius = q_values[i]
        
        # Generate circle points
        theta = np.linspace(0, np.pi, 50)
        sigma_circle = center + radius * np.cos(theta)
        tau_circle = radius * np.sin(theta)
        
        mohr_circles.append({
            "test_number": i + 1,
            "sigma_3": float(sigma_3_eff[i]),
            "sigma_1": float(sigma_1_eff[i]),
            "center": float(center),
            "radius": float(radius),
            "circle_points": [
                {"sigma": float(s), "tau": float(t)}
                for s, t in zip(sigma_circle, tau_circle)
            ]
        })
    
    # Failure envelope
    sigma_range = np.linspace(0, max(sigma_1_eff) * 1.1, 100)
    tau_range = c + sigma_range * np.tan(np.radians(phi))
    
    envelope_points = [
        {"sigma": float(s), "tau": float(t)}
        for s, t in zip(sigma_range, tau_range)
    ]
    
    return {
        "cohesion": round(c, 2),
        "friction_angle": round(phi, 1),
        "r_squared": round(r_squared, 4),
        "test_type": test_type,
        "effective_stress": use_effective_stress,
        "mohr_circles": mohr_circles,
        "envelope_points": envelope_points,
        "interpretation": interpret_strength_parameters(c, phi, test_type),
    }


def estimate_soil_type(c: float, phi: float) -> str:
    """
    Estimate soil type from strength parameters
    """
    if c < 5 and phi > 30:
        return "Clean sand (SM, SP)"
    elif c < 20 and phi > 25:
        return "Silty sand or sandy silt (SM, ML)"
    elif c > 20 and phi < 20:
        return "Clay (CL, CH)"
    elif c > 10 and 20 <= phi <= 30:
        return "Silty clay or clayey silt (CL, ML)"
    else:
        return "Mixed soil (SC, CL-ML)"


def interpret_strength_parameters(c: float, phi: float, test_type: str) -> dict:
    """
    Interpret strength parameters in engineering context
    """
    drainage = {
        "UU": "Undrained (total stress)",
        "CU": "Consolidated undrained (effective stress)",
        "CD": "Consolidated drained (effective stress)",
    }
    
    if test_type == "UU":
        strength_description = (
            f"Undrained shear strength Su = {c:.1f} kPa. "
            f"Applicable for short-term (end-of-construction) stability."
        )
    else:
        strength_description = (
            f"Effective cohesion c' = {c:.1f} kPa, "
            f"Effective friction angle φ' = {phi:.1f}°. "
            f"Applicable for long-term (drained) stability."
        )
    
    return {
        "drainage_condition": drainage.get(test_type, "Unknown"),
        "description": strength_description,
        "typical_applications": get_typical_applications(test_type),
    }


def get_typical_applications(test_type: str) -> str:
    """Return typical applications for each test type"""
    apps = {
        "UU": "Rapid loading, saturated clay, end-of-construction",
        "CU": "Embankments, foundations with partial drainage",
        "CD": "Long-term slopes, drained foundations, retaining walls",
    }
    return apps.get(test_type, "General")


def calculate_shear_strength(
    c: float, 
    phi: float, 
    normal_stress: float,
    pore_pressure: float = 0.0
) -> float:
    """
    Calculate shear strength at given normal stress
    
    τ_f = c' + (σ - u) × tan(φ')
    """
    validate_cohesion(c)
    validate_friction_angle(phi)
    
    sigma_effective = normal_stress - pore_pressure
    tau = c + sigma_effective * np.tan(np.radians(phi))
    
    return round(tau, 2)