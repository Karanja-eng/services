"""
Compaction Analysis - Proctor Tests
Standard and Modified Proctor with curve fitting
"""

import numpy as np
from scipy.optimize import curve_fit
from typing import List, Tuple
from .validation import validate_positive, validate_moisture_content
from .calculations import calculate_zero_air_voids_curve


def parabolic_model(w: np.ndarray, a: float, b: float, c: float) -> np.ndarray:
    """
    Parabolic model for Proctor curve
    γ_d = a + b×w + c×w²
    """
    return a + b * w + c * w**2


def gaussian_model(w: np.ndarray, gamma_max: float, w_opt: float, sigma: float) -> np.ndarray:
    """
    Gaussian model (alternative fit)
    γ_d = γ_max × exp(-((w - w_opt)² / (2σ²)))
    """
    return gamma_max * np.exp(-((w - w_opt)**2) / (2 * sigma**2))


def fit_proctor_curve(
    moisture_contents: List[float],
    dry_densities: List[float],
    model: str = "parabolic"
) -> Tuple[callable, float]:
    """
    Fit Proctor compaction curve to test data
    
    Returns:
        - fitted_function
        - R² value
    """
    w = np.array(moisture_contents)
    gamma_d = np.array(dry_densities)
    
    if len(w) < 4:
        raise ValueError("Need at least 4 data points for curve fitting")
    
    try:
        if model == "parabolic":
            # Fit parabolic model
            popt, _ = curve_fit(parabolic_model, w, gamma_d)
            fitted_func = lambda x: parabolic_model(x, *popt)
        else:
            # Fit Gaussian model
            gamma_max_guess = max(dry_densities)
            w_opt_guess = moisture_contents[np.argmax(dry_densities)]
            sigma_guess = 5.0
            
            popt, _ = curve_fit(
                gaussian_model, 
                w, 
                gamma_d,
                p0=[gamma_max_guess, w_opt_guess, sigma_guess]
            )
            fitted_func = lambda x: gaussian_model(x, *popt)
        
        # Calculate R²
        y_pred = fitted_func(w)
        ss_res = np.sum((gamma_d - y_pred)**2)
        ss_tot = np.sum((gamma_d - np.mean(gamma_d))**2)
        r_squared = 1 - (ss_res / ss_tot)
        
        return fitted_func, r_squared
    
    except Exception as e:
        raise ValueError(f"Curve fitting failed: {str(e)}")


def find_optimum_point(
    fitted_func: callable,
    w_range: Tuple[float, float] = (5, 30),
    num_points: int = 1000
) -> Tuple[float, float]:
    """
    Find optimum moisture content (OMC) and maximum dry density (MDD)
    from fitted curve
    """
    w_values = np.linspace(w_range[0], w_range[1], num_points)
    gamma_d_values = fitted_func(w_values)
    
    max_idx = np.argmax(gamma_d_values)
    
    OMC = w_values[max_idx]
    MDD = gamma_d_values[max_idx]
    
    return OMC, MDD


def analyze_proctor_test(
    data_points: List[dict],
    Gs: float = 2.65,
    test_type: str = "standard"
) -> dict:
    """
    Complete Proctor test analysis
    
    Input data_points: [{"moisture_content": w, "dry_density": γ_d}, ...]
    
    Returns:
        - OMC
        - MDD
        - Fitted curve points
        - ZAV curve
        - R² quality metric
    """
    moisture_contents = [p["moisture_content"] for p in data_points]
    dry_densities = [p["dry_density"] for p in data_points]
    
    # Validate inputs
    for w in moisture_contents:
        validate_moisture_content(w)
    for gamma_d in dry_densities:
        validate_positive(gamma_d, "dry_density")
    
    # Fit curve
    fitted_func, r_squared = fit_proctor_curve(
        moisture_contents, 
        dry_densities,
        model="parabolic"
    )
    
    # Find optimum
    w_min, w_max = min(moisture_contents) - 2, max(moisture_contents) + 2
    OMC, MDD = find_optimum_point(fitted_func, w_range=(w_min, w_max))
    
    # Generate fitted curve points
    w_fitted = np.linspace(w_min, w_max, 50)
    gamma_d_fitted = fitted_func(w_fitted)
    
    fitted_curve = [
        {"moisture_content": w, "dry_density": float(gd)}
        for w, gd in zip(w_fitted, gamma_d_fitted)
    ]
    
    # Generate ZAV curve
    zav_data = calculate_zero_air_voids_curve(Gs, w_min, w_max, num_points=50)
    
    zav_curve = [
        {"moisture_content": w, "dry_density": gd}
        for w, gd in zip(zav_data["moisture_content"], zav_data["dry_density"])
    ]
    
    return {
        "optimum_moisture_content": round(OMC, 1),
        "maximum_dry_density": round(MDD, 2),
        "fitted_curve": fitted_curve,
        "zav_curve": zav_curve,
        "r_squared": round(r_squared, 4),
        "test_type": test_type,
        "curve_quality": "Excellent" if r_squared > 0.95 else "Good" if r_squared > 0.90 else "Fair",
    }


def check_field_compaction(
    field_dry_density: float,
    maximum_dry_density: float,
    min_required_compaction: float = 95.0
) -> dict:
    """
    Check field compaction against specification
    
    Relative Compaction (RC) = (γ_d field / γ_d max) × 100%
    
    Typical requirements:
        - Road subgrade: RC ≥ 95%
        - Road base: RC ≥ 98%
        - Building pads: RC ≥ 90%
    """
    validate_positive(field_dry_density, "field_dry_density")
    validate_positive(maximum_dry_density, "maximum_dry_density")
    
    RC = (field_dry_density / maximum_dry_density) * 100.0
    
    status = "PASS" if RC >= min_required_compaction else "FAIL"
    
    return {
        "relative_compaction": round(RC, 1),
        "field_dry_density": round(field_dry_density, 2),
        "maximum_dry_density": round(maximum_dry_density, 2),
        "min_required": min_required_compaction,
        "status": status,
        "recommendation": (
            "Compaction meets specification" if status == "PASS"
            else f"Recompact to achieve minimum {min_required_compaction}% RC"
        ),
    }


def calculate_required_water(
    soil_mass: float,
    current_moisture: float,
    target_moisture: float
) -> dict:
    """
    Calculate water to add/remove to achieve target moisture content
    
    Water needed = M_dry × (w_target - w_current) / 100
    where M_dry = M_total / (1 + w_current/100)
    """
    validate_positive(soil_mass, "soil_mass")
    validate_moisture_content(current_moisture)
    validate_moisture_content(target_moisture)
    
    M_dry = soil_mass / (1 + current_moisture / 100)
    water_needed = M_dry * (target_moisture - current_moisture) / 100
    
    action = "Add" if water_needed > 0 else "Remove"
    
    return {
        "dry_soil_mass": round(M_dry, 2),
        "water_to_add_or_remove": round(abs(water_needed), 2),
        "action": action,
        "unit": "kg (or liters)",
    }