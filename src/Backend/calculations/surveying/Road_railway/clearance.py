# ============================================================================
# backend/route_surveying/geometry/clearance.py
# ============================================================================

"""
Clearance envelope calculations for railways and highways
"""

from typing import Dict, List


def check_vertical_clearance(
    structure_height: float,
    road_elevation: float,
    vehicle_type: str = "highway"
) -> Dict:
    """
    Check vertical clearance compliance.
    
    Minimum clearances:
    - Highway: 5.0m (16.4 ft)
    - Railway: 6.5m (21.3 ft)
    - Urban street: 4.5m (14.8 ft)
    
    Parameters:
        structure_height: Height of overhead structure in meters
        road_elevation: Road surface elevation in meters
        vehicle_type: Type of facility
    
    Returns:
        Clearance analysis and compliance status
    """
    minimums = {
        "highway": 5.0,
        "railway": 6.5,
        "urban": 4.5,
        "pedestrian": 2.5
    }
    
    min_clearance = minimums.get(vehicle_type, 5.0)
    actual_clearance = structure_height - road_elevation
    compliant = actual_clearance >= min_clearance
    
    margin = actual_clearance - min_clearance
    
    return {
        "compliant": compliant,
        "actual_clearance_m": round(actual_clearance, 2),
        "minimum_required_m": min_clearance,
        "margin_m": round(margin, 2),
        "vehicle_type": vehicle_type,
        "status": "adequate" if margin > 0.5 else ("marginal" if compliant else "insufficient")
    }