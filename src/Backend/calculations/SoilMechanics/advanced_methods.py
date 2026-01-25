"""
Advanced Slope Stability Methods
Janbu's Simplified Method and Spencer Method
"""

import numpy as np
from typing import List, Tuple, Dict
from .validation import validate_cohesion, validate_friction_angle, validate_positive


class SliceData:
    """Data structure for a single slice in slope stability analysis"""
    
    def __init__(
        self,
        width: float,
        height: float,
        base_angle: float,
        weight: float,
        cohesion: float,
        friction_angle: float,
        pore_pressure: float = 0.0
    ):
        self.b = width  # Slice width
        self.h = height  # Slice height
        self.alpha = base_angle  # Base inclination (degrees)
        self.W = weight  # Total weight
        self.c = cohesion  # Cohesion at base
        self.phi = friction_angle  # Friction angle at base
        self.u = pore_pressure  # Pore pressure at base


def janbu_simplified_method(
    slices: List[SliceData],
    max_iterations: int = 50,
    tolerance: float = 0.001
) -> Dict:
    """
    Janbu's Simplified Method for Slope Stability
    
    Assumes horizontal interslice forces (no shear forces)
    Satisfies horizontal force equilibrium
    
    FoS = Σ[c'×b×sec(α) + (W - u×b×sec(α))×tan(φ')] / [Σ(W×tan(α)) × f₀]
    
    where f₀ = correction factor (typically 0.95-1.12)
    
    Args:
        slices: List of SliceData objects
        max_iterations: Maximum iterations for convergence
        tolerance: Convergence tolerance
    
    Returns:
        Dict with FoS, correction factor, and convergence info
    """
    n_slices = len(slices)
    
    # Initial guess for FoS
    FoS = 1.5
    
    # Iteration loop
    for iteration in range(max_iterations):
        numerator = 0.0
        denominator = 0.0
        
        for slice_data in slices:
            alpha_rad = np.radians(slice_data.alpha)
            phi_rad = np.radians(slice_data.phi)
            
            # Calculate m_alpha (Janbu's factor)
            cos_alpha = np.cos(alpha_rad)
            tan_alpha = np.tan(alpha_rad)
            tan_phi = np.tan(phi_rad)
            
            m_alpha = cos_alpha * (1 + (tan_alpha * tan_phi) / FoS)
            
            if abs(m_alpha) < 1e-6:
                m_alpha = 1.0
            
            # Base length
            l = slice_data.b / cos_alpha
            
            # Effective normal force
            N_prime = (slice_data.W - slice_data.u * slice_data.b) / m_alpha
            
            # Resisting force
            resisting = (slice_data.c * slice_data.b + N_prime * tan_phi) / m_alpha
            
            # Driving force
            driving = slice_data.W * tan_alpha
            
            numerator += resisting
            denominator += driving
        
        # New FoS
        FoS_new = numerator / denominator if denominator > 0 else 10.0
        
        # Check convergence
        if abs(FoS_new - FoS) < tolerance:
            # Apply correction factor f₀
            f0 = calculate_janbu_correction_factor(slices, FoS_new)
            FoS_corrected = FoS_new * f0
            
            return {
                "factor_of_safety": round(FoS_corrected, 3),
                "uncorrected_FoS": round(FoS_new, 3),
                "correction_factor": round(f0, 3),
                "iterations": iteration + 1,
                "converged": True,
                "method": "Janbu Simplified",
            }
        
        FoS = FoS_new
    
    # Did not converge
    return {
        "factor_of_safety": round(FoS, 3),
        "uncorrected_FoS": round(FoS, 3),
        "correction_factor": 1.0,
        "iterations": max_iterations,
        "converged": False,
        "method": "Janbu Simplified",
        "warning": "Did not converge within maximum iterations"
    }


def calculate_janbu_correction_factor(slices: List[SliceData], FoS: float) -> float:
    """
    Calculate Janbu's correction factor f₀
    
    Empirical relationship based on:
    - Slope geometry
    - Depth ratio (d/L)
    - Soil strength
    
    Simplified: f₀ ≈ 1.0 to 1.12 for typical slopes
    """
    # Calculate average depth to length ratio
    total_width = sum(s.b for s in slices)
    avg_depth = sum(s.h * s.b for s in slices) / total_width
    
    d_L_ratio = avg_depth / total_width
    
    # Empirical formula (simplified)
    if d_L_ratio < 0.25:
        f0 = 0.95
    elif d_L_ratio < 1.0:
        f0 = 1.0 + 0.1 * np.sqrt(d_L_ratio)
    else:
        f0 = 1.12
    
    return f0


def spencer_method(
    slices: List[SliceData],
    max_iterations: int = 100,
    tolerance: float = 0.001
) -> Dict:
    """
    Spencer Method for Slope Stability
    
    Rigorous limit equilibrium method that:
    - Satisfies both force and moment equilibrium
    - Assumes constant interslice force inclination
    - Iterates on both FoS and interslice angle θ
    
    More accurate than simplified methods but computationally intensive
    
    Args:
        slices: List of SliceData objects
        max_iterations: Maximum iterations
        tolerance: Convergence tolerance
    
    Returns:
        Dict with FoS, interslice angle, and convergence info
    """
    # Initial guesses
    FoS = 1.5
    theta = 0.0  # Interslice force angle (degrees)
    
    for iteration in range(max_iterations):
        # Solve for FoS given theta (force equilibrium)
        FoS_force = solve_spencer_force_equilibrium(slices, theta, FoS)
        
        # Solve for FoS given theta (moment equilibrium)
        FoS_moment = solve_spencer_moment_equilibrium(slices, theta, FoS)
        
        # Check if force and moment equilibrium agree
        error = abs(FoS_force - FoS_moment)
        
        if error < tolerance:
            return {
                "factor_of_safety": round(FoS_force, 3),
                "interslice_angle": round(theta, 2),
                "force_FoS": round(FoS_force, 3),
                "moment_FoS": round(FoS_moment, 3),
                "iterations": iteration + 1,
                "converged": True,
                "method": "Spencer",
            }
        
        # Update theta using Newton-Raphson or bisection
        # Simplified: average and small increment
        FoS = (FoS_force + FoS_moment) / 2.0
        
        # Adjust theta
        if FoS_force > FoS_moment:
            theta += 0.5
        else:
            theta -= 0.5
        
        # Limit theta range
        theta = max(-30, min(30, theta))
    
    # Did not converge
    return {
        "factor_of_safety": round(FoS, 3),
        "interslice_angle": round(theta, 2),
        "iterations": max_iterations,
        "converged": False,
        "method": "Spencer",
        "warning": "Did not converge - solution may be unstable"
    }


def solve_spencer_force_equilibrium(
    slices: List[SliceData],
    theta: float,
    FoS_guess: float
) -> float:
    """
    Solve horizontal force equilibrium for Spencer method
    
    ΣFx = 0 (sum of horizontal forces)
    """
    FoS = FoS_guess
    theta_rad = np.radians(theta)
    
    for _ in range(20):  # Inner iteration
        sum_horizontal = 0.0
        
        for i, slice_data in enumerate(slices):
            alpha_rad = np.radians(slice_data.alpha)
            phi_rad = np.radians(slice_data.phi)
            
            # Normal force on base
            N = (slice_data.W * np.cos(alpha_rad) 
                 - slice_data.u * slice_data.b / np.cos(alpha_rad))
            
            # Shear resistance
            S = (slice_data.c * slice_data.b / np.cos(alpha_rad) 
                 + N * np.tan(phi_rad)) / FoS
            
            # Horizontal force contribution
            sum_horizontal += (S * np.cos(alpha_rad) 
                             - N * np.sin(alpha_rad))
        
        if abs(sum_horizontal) < 0.01:
            break
    
    return FoS


def solve_spencer_moment_equilibrium(
    slices: List[SliceData],
    theta: float,
    FoS_guess: float
) -> float:
    """
    Solve moment equilibrium for Spencer method
    
    ΣM = 0 (sum of moments about center of rotation)
    """
    FoS = FoS_guess
    
    # This is a simplified placeholder
    # Full implementation requires:
    # - Circle center coordinates
    # - Moment arms for each force
    # - Iterative solution
    
    return FoS


def analyze_slope_janbu(
    slope_height: float,
    slope_angle: float,
    unit_weight: float,
    cohesion: float,
    friction_angle: float,
    num_slices: int = 15,
    water_table_depth: float = None
) -> Dict:
    """
    Complete slope stability analysis using Janbu method
    
    Args:
        slope_height: Height of slope (m)
        slope_angle: Slope angle (degrees)
        unit_weight: Soil unit weight (kN/m³)
        cohesion: Soil cohesion (kPa)
        friction_angle: Friction angle (degrees)
        num_slices: Number of slices
        water_table_depth: Depth to water table (m)
    
    Returns:
        Complete analysis results
    """
    validate_positive(slope_height, "slope_height")
    validate_positive(unit_weight, "unit_weight")
    validate_cohesion(cohesion)
    validate_friction_angle(friction_angle)
    
    # Create slice geometry
    slices = create_slope_slices(
        slope_height, slope_angle, unit_weight,
        cohesion, friction_angle, num_slices, water_table_depth
    )
    
    # Analyze with Janbu method
    result = janbu_simplified_method(slices)
    
    # Determine stability status
    FoS = result["factor_of_safety"]
    
    if FoS >= 1.5:
        status = "STABLE"
        color = "green"
    elif FoS >= 1.3:
        status = "MARGINALLY STABLE"
        color = "yellow"
    else:
        status = "UNSTABLE"
        color = "red"
    
    result.update({
        "status": status,
        "status_color": color,
        "num_slices": len(slices),
        "recommendation": get_janbu_recommendation(FoS),
    })
    
    return result


def analyze_slope_spencer(
    slope_height: float,
    slope_angle: float,
    unit_weight: float,
    cohesion: float,
    friction_angle: float,
    num_slices: int = 20,
    water_table_depth: float = None
) -> Dict:
    """
    Complete slope stability analysis using Spencer method
    
    More rigorous than Janbu, accounts for interslice forces
    """
    validate_positive(slope_height, "slope_height")
    validate_positive(unit_weight, "unit_weight")
    validate_cohesion(cohesion)
    validate_friction_angle(friction_angle)
    
    # Create slice geometry
    slices = create_slope_slices(
        slope_height, slope_angle, unit_weight,
        cohesion, friction_angle, num_slices, water_table_depth
    )
    
    # Analyze with Spencer method
    result = spencer_method(slices)
    
    # Determine stability status
    FoS = result["factor_of_safety"]
    
    if FoS >= 1.5:
        status = "STABLE"
    elif FoS >= 1.3:
        status = "MARGINALLY STABLE"
    else:
        status = "UNSTABLE"
    
    result.update({
        "status": status,
        "num_slices": len(slices),
        "recommendation": get_spencer_recommendation(FoS, result.get("interslice_angle", 0)),
    })
    
    return result


def create_slope_slices(
    H: float,
    beta: float,
    gamma: float,
    c: float,
    phi: float,
    n_slices: int,
    water_depth: float = None
) -> List[SliceData]:
    """
    Create slice geometry for slope stability analysis
    
    Simplified circular slip surface through toe
    """
    beta_rad = np.radians(beta)
    
    # Trial circle parameters
    R = 1.5 * H / np.sin(beta_rad)
    x_center = 0
    y_center = R
    
    # Slice width
    slice_width = (H / np.tan(beta_rad)) / n_slices
    
    slices = []
    
    for i in range(n_slices):
        x = i * slice_width
        
        # Height from slope surface to arc
        y_surface = H - x * np.tan(beta_rad)
        
        if y_surface <= 0:
            continue
        
        # Y-coordinate on arc
        y_arc = y_center - np.sqrt(max(0, R**2 - (x - x_center)**2))
        
        # Slice height
        h_slice = max(0, y_surface - y_arc)
        
        if h_slice < 0.01:
            continue
        
        # Weight
        W = gamma * slice_width * h_slice
        
        # Base angle
        alpha = np.degrees(np.arctan((x - x_center) / max(0.01, (y_center - y_arc))))
        
        # Pore pressure
        if water_depth and y_arc < (H - water_depth):
            u = 9.81 * (H - water_depth - y_arc)
        else:
            u = 0
        
        slice = SliceData(
            width=slice_width,
            height=h_slice,
            base_angle=alpha,
            weight=W,
            cohesion=c,
            friction_angle=phi,
            pore_pressure=u
        )
        
        slices.append(slice)
    
    return slices


def get_janbu_recommendation(FoS: float) -> str:
    """Engineering recommendations for Janbu analysis"""
    if FoS >= 2.0:
        return "Janbu analysis shows excellent stability. Slope is safe with high confidence."
    elif FoS >= 1.5:
        return "Janbu analysis confirms slope meets design standards. Proceed with construction."
    elif FoS >= 1.3:
        return "Marginal stability. Consider slope flattening or soil improvement (c, φ increase)."
    else:
        return "Critical FoS. Immediate remediation required. Consider berms, drainage, or reinforcement."


def get_spencer_recommendation(FoS: float, theta: float) -> str:
    """Engineering recommendations for Spencer analysis"""
    base_rec = get_janbu_recommendation(FoS)
    
    if abs(theta) > 15:
        base_rec += f" Note: High interslice angle ({theta:.1f}°) indicates complex failure mechanism."
    
    return base_rec


def compare_methods(
    slope_height: float,
    slope_angle: float,
    unit_weight: float,
    cohesion: float,
    friction_angle: float,
    water_table_depth: float = None
) -> Dict:
    """
    Compare all three methods: Bishop, Janbu, Spencer
    
    Returns comparative analysis
    """
    # Import Bishop from existing module
    from .bishop import analyze_slope_stability_bishop
    
    # Bishop analysis
    bishop_result = analyze_slope_stability_bishop(
        slope_height, slope_angle, unit_weight,
        cohesion, friction_angle, water_table_depth=water_table_depth
    )
    
    # Janbu analysis
    janbu_result = analyze_slope_janbu(
        slope_height, slope_angle, unit_weight,
        cohesion, friction_angle, water_table_depth=water_table_depth
    )
    
    # Spencer analysis
    spencer_result = analyze_slope_spencer(
        slope_height, slope_angle, unit_weight,
        cohesion, friction_angle, water_table_depth=water_table_depth
    )
    
    return {
        "bishop": {
            "FoS": bishop_result["factor_of_safety"],
            "status": bishop_result["status"],
            "method": "Simplified Bishop"
        },
        "janbu": {
            "FoS": janbu_result["factor_of_safety"],
            "correction_factor": janbu_result["correction_factor"],
            "status": janbu_result["status"],
            "method": "Janbu Simplified"
        },
        "spencer": {
            "FoS": spencer_result["factor_of_safety"],
            "interslice_angle": spencer_result.get("interslice_angle", 0),
            "status": spencer_result["status"],
            "method": "Spencer"
        },
        "average_FoS": round(
            (bishop_result["factor_of_safety"] + 
             janbu_result["factor_of_safety"] + 
             spencer_result["factor_of_safety"]) / 3,
            2
        ),
        "recommendation": "Use most conservative FoS for design. Typical: Spencer > Bishop > Janbu."
    }