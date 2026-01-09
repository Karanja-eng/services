import pandas as pd 
import numpy as np
from typing import Optional, Tuple, List, Dict

# ============================================================================
# BS 8110-1:1997 DATA TABLES
# ============================================================================

# ----------------------------------------------------------------------------
# Table 3.8: Design concrete shear stress vc (N/mm²)
# ----------------------------------------------------------------------------
# Index by: (100As/bd, effective depth d, fcu)
# Simplified lookup table (base values). In practice we use the formula.
table_3_8_vc_base = {
    0.15: {150: 0.45, 175: 0.44, 200: 0.43, 225: 0.41, 250: 0.40, 300: 0.38, 400: 0.35},
    0.25: {150: 0.53, 175: 0.51, 200: 0.50, 225: 0.48, 250: 0.47, 300: 0.44, 400: 0.41},
    0.50: {150: 0.67, 175: 0.65, 200: 0.63, 225: 0.61, 250: 0.59, 300: 0.56, 400: 0.51},
    0.75: {150: 0.77, 175: 0.74, 200: 0.72, 225: 0.69, 250: 0.67, 300: 0.63, 400: 0.58},
    1.00: {150: 0.84, 175: 0.81, 200: 0.79, 225: 0.76, 250: 0.74, 300: 0.69, 400: 0.64},
    1.50: {150: 0.97, 175: 0.93, 200: 0.90, 225: 0.87, 250: 0.84, 300: 0.79, 400: 0.73},
    2.00: {150: 1.06, 175: 1.02, 200: 0.99, 225: 0.96, 250: 0.93, 300: 0.87, 400: 0.80},
    3.00: {150: 1.22, 175: 1.17, 200: 1.13, 225: 1.09, 250: 1.06, 300: 0.99, 400: 0.91},
}

def get_vc_table_3_8(As_bd_percent: float, d: float, fcu: float) -> float:
    """Get design concrete shear stress from Table 3.8 formula"""
    # 1. Clamp input values
    As_bd_percent = max(0.15, min(As_bd_percent, 3.0))
    d_eff = max(1, d) # Prevent division by zero
    fcu_eff = min(fcu, 40) # BS 8110 limits fcu usage for shear
    
    # Formula: 0.79 * (100As/bd)^(1/3) * (400/d)^(1/4) / 1.25 * (fcu/25)^(1/3)
    term1 = (As_bd_percent) ** (1/3)
    
    depth_factor = 1.0
    if d_eff >= 400:
        depth_factor = (400 / d_eff) ** 0.25
        depth_factor = max(0.67, depth_factor) # Clause 3.4.5.4
    else:
        # Code actually implies the factor applies generally, but usually >= 1 for d < 400.
        # "The value of (400/d)^1/4 should not be taken as less than 1" for shear reinforcement? 
        # No, for determining vc: "should not be taken as less than 0.67".
        # Values for d < 400 are increasingly > 1.
        depth_factor = (400 / d_eff) ** 0.25
             
    fcu_factor = (fcu_eff / 25) ** (1/3)
    
    vc_calc = 0.79 * term1 * depth_factor * fcu_factor / 1.25
    
    return float(vc_calc)

# ----------------------------------------------------------------------------
# Table 3.9: Basic span/effective depth ratio
# ----------------------------------------------------------------------------
table_3_9_span_depth = {
    "rectangular": {"cantilever": 7, "simply_supported": 20, "continuous": 26},
    "flanged": {"cantilever": 5.6, "simply_supported": 16.0, "continuous": 20.8}
}

# ----------------------------------------------------------------------------
# Table 3.10: Modification factor for tension reinforcement
# ----------------------------------------------------------------------------
# Formula: 0.55 + (477 - fs)/(120(0.9 + M/bd²)) <= 2.0
def get_tension_modification_factor(M: float, b: float, d: float, fs: float) -> float:
    M_bd2 = M / (b * d * d) if (b * d * d) > 0 else 0
    factor = 0.55 + (477 - fs) / (120 * (0.9 + M_bd2))
    return max(0.55, min(factor, 2.0))

# ----------------------------------------------------------------------------
# Table 3.11: Modification factor for compression reinforcement
# ----------------------------------------------------------------------------
# Formula: 1 + (100As'/bd) / (3 + 100As'/bd) <= 1.5
def get_compression_modification_factor(As_prime: float, b: float, d: float) -> float:
    rho_prime = 100 * As_prime / (b * d) if (b * d) > 0 else 0
    factor = 1 + rho_prime / (3 + rho_prime)
    return min(factor, 1.5)

# ----------------------------------------------------------------------------
# Table 3.25: Minimum reinforcement percentages
# ----------------------------------------------------------------------------
table_3_25_min_reinforcement = {
    "rectangular_tension": {"fy_250": 0.24, "fy_460": 0.13},
    "T_beam_flange_tension": {"fy_250": 0.48, "fy_460": 0.26}, 
    "L_beam_flange_tension": {"fy_250": 0.36, "fy_460": 0.20},
    "flanged_web_tension_bw_b_lt_0.4": {"fy_250": 0.32, "fy_460": 0.18},
    "flanged_web_tension_bw_b_ge_0.4": {"fy_250": 0.24, "fy_460": 0.13},
    "compression": {"fy_250": 0.40, "fy_460": 0.40},
}

# ----------------------------------------------------------------------------
# Table 3.27: Anchorage/lap lengths as multiples of bar diameter
# ----------------------------------------------------------------------------
table_3_27_anchorage = {
    "tension": {
        "grade_250": {"fcu_25": 39, "fcu_30": 36, "fcu_35": 33, "fcu_40": 30}, 
        "grade_460": {"fcu_25": 44, "fcu_30": 41, "fcu_35": 38, "fcu_40": 35}  
    },
    "compression": {
        "grade_250": {"fcu_25": 32, "fcu_30": 29, "fcu_35": 27, "fcu_40": 24},
        "grade_460": {"fcu_25": 35, "fcu_30": 32, "fcu_35": 29, "fcu_40": 27} 
    }
}

# ----------------------------------------------------------------------------
# Table 3.3: Nominal cover for durability
# ----------------------------------------------------------------------------
table_3_3_durability_cover = {
    "Mild": {"C30": 25, "C35": 20, "C40": 20},
    "Moderate": {"C30": 35, "C35": 30, "C40": 25},
    "Severe": {"C30": None, "C35": 40, "C40": 30},
    "Very Severe": {"C30": None, "C35": None, "C40": 50},
    "Extreme": {"C30": None, "C35": None, "C40": 60}
}

# ----------------------------------------------------------------------------
# Table 3.4: Nominal cover for fire resistance
# ----------------------------------------------------------------------------
table_3_4_fire_cover = {
    "beams": {
        "30 mins": {"cover": 20, "min_width": 200},
        "1 hour": {"cover": 20, "min_width": 200},
        "1.5 hours": {"cover": 25, "min_width": 200},
        "2 hours": {"cover": 40, "min_width": 200},
        "3 hours": {"cover": 60, "min_width": 240},
        "4 hours": {"cover": 70, "min_width": 280}
    }
}

# ----------------------------------------------------------------------------
# Table 3.7: Shear reinforcement - Asv/sv values for two-leg links
# ----------------------------------------------------------------------------
# Format: {diameter: [(spacing, Asv/sv value), ...]}
# Asv for 2 legs: T8=100.6, T10=157, T12=226
table_3_7_link_areas = {
    6:  [(75, 0.755), (100, 0.566), (125, 0.453), (150, 0.377), (175, 0.323), (200, 0.283), (250, 0.226), (300, 0.189)],
    8:  [(75, 1.34), (100, 1.01), (125, 0.805), (150, 0.671), (175, 0.575), (200, 0.503), (225, 0.447), (250, 0.402), (300, 0.335)],
    10: [(75, 2.09), (100, 1.57), (125, 1.26), (150, 1.05), (175, 0.898), (200, 0.785), (225, 0.698), (250, 0.628), (300, 0.523)],
    12: [(75, 3.02), (100, 2.26), (125, 1.81), (150, 1.51), (175, 1.29), (200, 1.13), (225, 1.00), (250, 0.905), (300, 0.754)],
}

def get_link_spacing_from_table(diameter: int, Asv_sv_required: float) -> Optional[int]:
    """Get link spacing from Table 3.7 that provides required Asv/sv"""
    if diameter not in table_3_7_link_areas:
        return None
    
    # Sort by spacing descending (widest spacing first)
    options = sorted(table_3_7_link_areas[diameter], key=lambda x: x[0], reverse=True)
    
    for spacing, val in options:
        if val >= Asv_sv_required:
            return spacing
    
    return None # even closest spacing (75mm) not enough

# ----------------------------------------------------------------------------
# Table 3.5: Beam Coefficients
# ----------------------------------------------------------------------------
table_3_5_coefficients = {
    "near_middle_end_span": {"moment": 0.09, "shear": 0.0},
    "outer_support": {"moment": 0.0, "shear": 0.45},
    "first_interior_support": {"moment": -0.11, "shear": 0.6},
    "middle_interior_span": {"moment": 0.07, "shear": 0.0},
    "interior_support": {"moment": -0.08, "shear": 0.55}
}

# ----------------------------------------------------------------------------
# Bar Selection Helper
# ----------------------------------------------------------------------------
# Standard bar areas per number of bars
data_table_3_10 = {
    6:  [(1, 28.3), (2, 56.6), (3, 84.9), (4, 113), (5, 142), (6, 170), (7, 198), (8, 226), (9, 255), (10, 283)],
    8:  [(1, 50.3), (2, 101), (3, 151), (4, 201), (5, 252), (6, 302), (7, 352), (8, 402), (9, 453), (10, 503)],
    10: [(1, 78.5), (2, 157), (3, 236), (4, 314), (5, 393), (6, 471), (7, 550), (8, 628), (9, 707), (10, 785)],
    12: [(1, 113), (2, 226), (3, 339), (4, 452), (5, 565), (6, 678), (7, 791), (8, 904), (9, 1017), (10, 1130)],
    16: [(1, 201), (2, 402), (3, 603), (4, 804), (5, 1010), (6, 1210), (7, 1410), (8, 1610), (9, 1810), (10, 2010)],
    20: [(1, 314), (2, 628), (3, 942), (4, 1260), (5, 1570), (6, 1880), (7, 2200), (8, 2510), (9, 2830), (10, 3140)],
    25: [(1, 491), (2, 982), (3, 1470), (4, 1960), (5, 2450), (6, 2940), (7, 3430), (8, 3920), (9, 4410), (10, 4910)],
    32: [(1, 804), (2, 1610), (3, 2410), (4, 3220), (5, 4020), (6, 4830), (7, 5630), (8, 6430), (9, 7240), (10, 8040)],
    40: [(1, 1260), (2, 2510), (3, 3770), (4, 5030), (5, 6280), (6, 7540), (7, 8800), (8, 10100), (9, 11300), (10, 12600)]
}

def get_number_of_bars(diameter: int, required_area: float, min_bars: int = 2) -> Optional[tuple]:
    """
    Get number of bars for required area with minimum bar count.
    
    Args:
        diameter: Bar diameter in mm
        required_area: Required steel area in mm²
        min_bars: Minimum number of bars (default 2)
    
    Returns:
        Tuple of (num_bars, diameter, area_provided)
    """
    if diameter not in data_table_3_10:
        return None
    
    for num_bars, area in data_table_3_10[diameter]:
        if num_bars >= min_bars and area >= required_area:
            return (num_bars, diameter, area)
    
    return None

def get_spacing(diameter, asv_s):
    # Legacy wrapper for older code if needed
    return get_link_spacing_from_table(diameter, asv_s)
