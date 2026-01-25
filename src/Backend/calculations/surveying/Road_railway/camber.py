# ============================================================================
# backend/route_surveying/geometry/camber.py
# ============================================================================

"""
Camber and superelevation calculations
"""

from typing import Dict


def calculate_camber_offset(
    offset_from_centerline: float,
    camber_percent: float,
    camber_type: str = "two-way"
) -> float:
    """
    Calculate vertical offset due to camber at given transverse position.
    
    Parameters:
        offset_from_centerline: Distance from centerline (negative = left)
        camber_percent: Camber/crossfall percentage
        camber_type: "two-way" or "one-way"
    
    Returns:
        Vertical offset in meters
    """
    if camber_type == "two-way":
        # Slopes both ways from center
        return abs(offset_from_centerline) * (camber_percent / 100.0)
    else:
        # One-way slope
        if offset_from_centerline >= 0:
            return offset_from_centerline * (camber_percent / 100.0)
        else:
            return 0.0


def check_drainage_compliance(
    camber_percent: float,
    road_type: str = "highway"
) -> Dict:
    """
    Check if camber meets minimum drainage requirements.
    
    Typical minimums:
    - Highways: 2.0-2.5%
    - Urban roads: 1.5-2.0%
    - Parking areas: 1.0-2.0%
    
    Parameters:
        camber_percent: Proposed camber percentage
        road_type: Type of road facility
    
    Returns:
        Compliance status and recommendations
    """
    minimums = {
        "highway": 2.0,
        "urban": 1.5,
        "parking": 1.0
    }
    
    min_required = minimums.get(road_type, 2.0)
    compliant = camber_percent >= min_required
    
    return {
        "compliant": compliant,
        "actual_camber_percent": camber_percent,
        "minimum_required_percent": min_required,
        "road_type": road_type,
        "recommendation": "Adequate drainage" if compliant else "Increase camber for proper drainage"
    }