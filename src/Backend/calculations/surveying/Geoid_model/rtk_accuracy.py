# ============================================================================
# FILE: backend/gnss/rtk/accuracy_analysis.py
# ============================================================================
"""
RTK solution quality assessment and accuracy prediction.
Based on industry-standard error budgets and baseline length considerations.
"""

import numpy as np
from .constants import RTK_ACCURACY, PDOP_THRESHOLDS
from .validation import validate_baseline_length, validate_pdop, validate_satellite_count
from typing import List, Tuple

def compute_rtk_accuracy(baseline_length: float, solution_type: str, pdop: float) -> Tuple[float, float]:
    """
    Compute expected RTK accuracy using industry-standard models.
    """
    params = RTK_ACCURACY[solution_type]
    
    # Base accuracy + distance-dependent error
    h_accuracy = params["horizontal_base"] + params["horizontal_ppm"] * (baseline_length / 1000)
    v_accuracy = params["vertical_base"] + params["vertical_ppm"] * (baseline_length / 1000)
    
    # Apply PDOP degradation factor
    pdop_factor = max(1.0, pdop / 2.0)
    h_accuracy *= pdop_factor
    v_accuracy *= pdop_factor
    
    return h_accuracy, v_accuracy

def classify_quality(pdop: float, num_sats: int, solution_type: str, 
                     baseline_length: float) -> str:
    """Determine overall quality classification."""
    if solution_type == "single":
        return "poor"
    
    if solution_type == "float":
        return "fair" if pdop <= 4.0 and num_sats >= 5 else "poor"
    
    # Fixed solution
    if pdop <= 2.0 and num_sats >= 6 and baseline_length <= 10000:
        return "excellent"
    elif pdop <= 3.0 and num_sats >= 5 and baseline_length <= 20000:
        return "good"
    elif pdop <= 4.0 and num_sats >= 5:
        return "moderate"
    elif pdop <= 6.0:
        return "fair"
    else:
        return "poor"

def analyze_rtk_quality(baseline_length: float, solution_type: str, pdop: float,
                        num_satellites: int, hdop: float = None, vdop: float = None,
                        ambiguity_ratio: float = None) -> dict:
    """
    Comprehensive RTK solution quality analysis.
    """
    # Compute accuracy
    h_acc, v_acc = compute_rtk_accuracy(baseline_length, solution_type, pdop)
    
    # Collect all warnings
    warnings = []
    warnings.extend(validate_baseline_length(baseline_length))
    _, pdop_warnings = validate_pdop(pdop)
    warnings.extend(pdop_warnings)
    warnings.extend(validate_satellite_count(num_satellites))
    
    if ambiguity_ratio and ambiguity_ratio < 3.0 and solution_type == "fixed":
        warnings.append(f"Low ambiguity ratio ({ambiguity_ratio:.1f}) - fixed solution may be unreliable")
    
    # Generate recommendations
    recommendations = []
    if pdop > 4.0:
        recommendations.append("Wait for better satellite geometry or reposition base station")
    if num_satellites < 6:
        recommendations.append("Enable additional GNSS constellations (GLONASS, Galileo, BeiDou)")
    if baseline_length > 20000:
        recommendations.append("Use network RTK (NTRIP) or reduce baseline length")
    if solution_type == "float":
        recommendations.append("Check for obstructions, multipath, or radio interference")
    
    # Quality classification
    quality = classify_quality(pdop, num_satellites, solution_type, baseline_length)
    
    # PDOP assessment
    if pdop <= 2.0:
        pdop_assessment = "Excellent satellite geometry"
    elif pdop <= 3.0:
        pdop_assessment = "Good satellite geometry"
    elif pdop <= 4.0:
        pdop_assessment = "Moderate satellite geometry"
    elif pdop <= 6.0:
        pdop_assessment = "Fair satellite geometry - marginal quality"
    else:
        pdop_assessment = "Poor satellite geometry - unreliable"
    
    # Accuracy breakdown
    params = RTK_ACCURACY[solution_type]
    breakdown = {
        "base_horizontal_mm": params["horizontal_base"],
        "distance_dependent_horizontal_mm": params["horizontal_ppm"] * (baseline_length / 1000),
        "base_vertical_mm": params["vertical_base"],
        "distance_dependent_vertical_mm": params["vertical_ppm"] * (baseline_length / 1000),
        "pdop_degradation_factor": max(1.0, pdop / 2.0)
    }
    
    return {
        "horizontal_accuracy_mm": float(h_acc),
        "vertical_accuracy_mm": float(v_acc),
        "quality_classification": quality,
        "pdop_assessment": pdop_assessment,
        "warnings": warnings,
        "recommendations": recommendations,
        "accuracy_breakdown": breakdown
    }
