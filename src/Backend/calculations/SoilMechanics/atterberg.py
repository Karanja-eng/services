"""
Atterberg Limits & Soil Classification (USCS)
"""

from .validation import validate_atterberg_limits
from .constants import PLASTICITY_CHART_A_LINE


def calculate_plasticity_index(LL: float, PL: float) -> float:
    """
    Plasticity Index: PI = LL - PL
    """
    validate_atterberg_limits(LL, PL)
    return LL - PL


def classify_soil_uscs(LL: float, PL: float) -> dict:
    """
    USCS Classification based on Atterberg Limits
    
    Fine-grained soils (>50% passing #200 sieve):
    - Plasticity Chart (Casagrande)
    - A-line: PI = 0.73(LL - 20)
    
    Classification:
    - CL: Inorganic clay of low plasticity (LL < 50, above A-line)
    - ML: Inorganic silt (LL < 50, below A-line)
    - CH: Inorganic clay of high plasticity (LL ≥ 50, above A-line)
    - MH: Inorganic silt of high plasticity (LL ≥ 50, below A-line)
    - OL: Organic silt/clay (LL < 50, below A-line with organic content)
    - OH: Organic clay (LL ≥ 50, below A-line with organic content)
    """
    validate_atterberg_limits(LL, PL)
    
    PI = calculate_plasticity_index(LL, PL)
    
    # A-line equation: PI = 0.73(LL - 20)
    PI_A_line = PLASTICITY_CHART_A_LINE * (LL - 20)
    
    # Position relative to A-line
    above_A_line = PI > PI_A_line
    
    # Classification logic
    if LL < 50:
        # Low liquid limit
        if above_A_line:
            uscs_symbol = "CL"
            description = "Inorganic clay of low to medium plasticity"
        else:
            if PI < 4:
                uscs_symbol = "ML-CL"
                description = "Silty clay with low plasticity"
            else:
                uscs_symbol = "ML"
                description = "Inorganic silt of low plasticity"
    else:
        # High liquid limit (LL ≥ 50)
        if above_A_line:
            uscs_symbol = "CH"
            description = "Inorganic clay of high plasticity"
        else:
            uscs_symbol = "MH"
            description = "Inorganic silt of high plasticity"
    
    # Additional checks
    if PI < 4 and LL < 50:
        description += " (borderline CL-ML)"
    
    return {
        "liquid_limit": LL,
        "plastic_limit": PL,
        "plasticity_index": round(PI, 1),
        "uscs_symbol": uscs_symbol,
        "description": description,
        "above_A_line": above_A_line,
        "PI_A_line": round(PI_A_line, 1),
    }


def generate_plasticity_chart_data():
    """
    Generate A-line and U-line for Casagrande plasticity chart
    
    A-line: PI = 0.73(LL - 20)
    U-line: PI = 0.9(LL - 8)  (upper boundary)
    """
    LL_values = list(range(0, 121, 5))
    
    A_line = []
    U_line = []
    
    for LL in LL_values:
        PI_A = PLASTICITY_CHART_A_LINE * (LL - 20)
        PI_U = 0.9 * (LL - 8)
        
        A_line.append({"LL": LL, "PI": max(0, PI_A)})
        U_line.append({"LL": LL, "PI": max(0, PI_U)})
    
    return {
        "A_line": A_line,
        "U_line": U_line,
        "LL_50_line": {"LL": 50, "PI_range": [0, 60]},
        "PI_4_line": {"PI": 4, "LL_range": [0, 120]},
    }


def interpret_plasticity(PI: float) -> str:
    """
    Interpret plasticity characteristics
    """
    if PI < 7:
        return "Non-plastic to low plasticity"
    elif PI < 15:
        return "Medium plasticity"
    elif PI < 30:
        return "High plasticity"
    else:
        return "Very high plasticity"


def calculate_liquidity_index(w: float, PL: float, LL: float) -> dict:
    """
    Liquidity Index: LI = (w - PL) / PI
    
    LI < 0: Soil is in semi-solid state
    LI = 0: Soil is at plastic limit
    LI = 1: Soil is at liquid limit
    LI > 1: Soil is in liquid state
    """
    validate_atterberg_limits(LL, PL)
    
    PI = LL - PL
    
    if PI == 0:
        return {
            "liquidity_index": None,
            "consistency_index": None,
            "state": "Non-plastic soil",
        }
    
    LI = (w - PL) / PI
    CI = (LL - w) / PI  # Consistency index
    
    if LI < 0:
        state = "Semi-solid state"
    elif LI < 0.25:
        state = "Plastic state (stiff)"
    elif LI < 0.75:
        state = "Plastic state (soft)"
    elif LI < 1.0:
        state = "Plastic state (very soft)"
    else:
        state = "Liquid state"
    
    return {
        "liquidity_index": round(LI, 2),
        "consistency_index": round(CI, 2),
        "state": state,
        "plasticity_index": PI,
    }