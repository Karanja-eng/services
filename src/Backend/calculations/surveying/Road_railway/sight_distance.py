# ============================================================================
# backend/route_surveying/geometry/sight_distance.py
# ============================================================================

"""
Sight distance calculations per AASHTO standards
CRITICAL SAFETY CALCULATIONS
"""

import math
from typing import Dict
from .constants import (
    GRAVITY_M_S2,
    FRICTION_COEFFICIENTS,
    DEFAULT_REACTION_TIME_S
)
from .schemas import RoadCondition
from .validation import validate_design_speed
from .utils import kmh_to_ms


def calculate_sight_distance(
    design_speed_kmh: float,
    road_condition: RoadCondition,
    grade_percent: float = 0.0,
    reaction_time_s: float = DEFAULT_REACTION_TIME_S
) -> Dict:
    """
    Calculate stopping and overtaking sight distances.
    
    AASHTO Green Book formulas:
    SSD = v*t + v²/(2*g*(f ± G))
    
    Where:
    - v = design speed (m/s)
    - t = reaction time (s)
    - g = gravity (9.81 m/s²)
    - f = friction coefficient
    - G = grade (decimal, positive = uphill)
    
    Parameters:
        design_speed_kmh: Design speed in km/h
        road_condition: Road surface condition
        grade_percent: Longitudinal grade in percent
        reaction_time_s: Driver reaction time in seconds
    
    Returns:
        Dictionary with SSD, OSD, and all assumptions
    """
    validate_design_speed(design_speed_kmh)
    
    if abs(grade_percent) > 15:
        raise ValueError("Grade exceeds typical limits (±15%)")
    
    if reaction_time_s <= 0 or reaction_time_s > 5:
        raise ValueError("Reaction time must be between 0 and 5 seconds")
    
    # Convert units
    speed_ms = kmh_to_ms(design_speed_kmh)
    grade_decimal = grade_percent / 100.0
    
    # Get friction coefficient
    friction = FRICTION_COEFFICIENTS[road_condition.value]
    
    # Calculate Stopping Sight Distance (SSD)
    # SSD = reaction distance + braking distance
    reaction_distance = speed_ms * reaction_time_s
    
    # Braking distance with grade correction
    denominator = 2 * GRAVITY_M_S2 * (friction + grade_decimal)
    
    if abs(denominator) < 0.001:
        raise ValueError("Invalid combination of friction and grade")
    
    braking_distance = (speed_ms ** 2) / denominator
    ssd = reaction_distance + braking_distance
    
    # Calculate Overtaking Sight Distance (OSD)
    # Simplified formula: OSD ≈ 4.5 * v * t
    osd = 4.5 * speed_ms * reaction_time_s
    
    # Determine compliance (example thresholds)
    min_ssd_required = _get_minimum_ssd(design_speed_kmh)
    compliance = "compliant" if ssd >= min_ssd_required else "non_compliant"
    
    return {
        "stopping_sight_distance_m": round(ssd, 1),
        "overtaking_sight_distance_m": round(osd, 1),
        "design_speed_kmh": design_speed_kmh,
        "road_condition": road_condition,
        "friction_coefficient": friction,
        "assumptions": {
            "gravity_m_s2": GRAVITY_M_S2,
            "reaction_time_s": reaction_time_s,
            "grade_percent": grade_percent,
            "speed_m_s": round(speed_ms, 2),
            "reaction_distance_m": round(reaction_distance, 1),
            "braking_distance_m": round(braking_distance, 1)
        },
        "standard_reference": "AASHTO Green Book",
        "compliance_status": compliance
    }


def _get_minimum_ssd(design_speed_kmh: float) -> float:
    """
    Get minimum required SSD from AASHTO standards.
    Simplified table - production would use complete AASHTO tables.
    """
    ssd_table = {
        30: 35, 40: 50, 50: 65, 60: 85, 70: 105,
        80: 130, 90: 160, 100: 185, 110: 220, 120: 250
    }
    
    # Find closest speed
    closest = min(ssd_table.keys(), key=lambda x: abs(x - design_speed_kmh))
    return ssd_table.get(closest, 250)
