# ============================================================================
# backend/route_surveying/validation.py
# ============================================================================

"""Input validation functions"""

from typing import List
from .schemas import Station, CrossSectionArea


def validate_chainage_sequence(chainages: List[float]) -> None:
    """Ensure chainages are positive and ascending"""
    if not chainages:
        raise ValueError("Chainage list cannot be empty")
    
    if any(ch < 0 for ch in chainages):
        raise ValueError("Chainages must be non-negative")
    
    if chainages != sorted(chainages):
        raise ValueError("Chainages must be in ascending order")


def validate_stations(stations: List[Station]) -> None:
    """Validate survey station data"""
    if len(stations) < 2:
        raise ValueError("Minimum 2 stations required")
    
    chainages = [s.chainage for s in stations]
    validate_chainage_sequence(chainages)
    
    # Check for duplicate chainages
    if len(chainages) != len(set(chainages)):
        raise ValueError("Duplicate chainages detected")


def validate_cross_sections(sections: List[CrossSectionArea]) -> None:
    """Validate cross-section data for earthworks"""
    if len(sections) < 2:
        raise ValueError("Minimum 2 cross-sections required for volume calculation")
    
    chainages = [cs.chainage for cs in sections]
    validate_chainage_sequence(chainages)
    
    # Check for negative areas
    for cs in sections:
        if cs.cut_area_m2 < 0 or cs.fill_area_m2 < 0:
            raise ValueError(f"Negative area detected at chainage {cs.chainage}")


def validate_design_speed(speed_kmh: float) -> None:
    """Validate design speed is within reasonable bounds"""
    if speed_kmh <= 0:
        raise ValueError("Design speed must be positive")
    
    if speed_kmh > 150:
        raise ValueError("Design speed exceeds typical highway limits")


def validate_geometric_parameters(road_width: float, shoulder_width: float) -> None:
    """Validate road geometry parameters"""
    if road_width <= 0:
        raise ValueError("Road width must be positive")
    
    if shoulder_width < 0:
        raise ValueError("Shoulder width cannot be negative")
    
    if road_width < 3.0:
        raise ValueError("Road width below minimum standard (3.0m)")
    
    if road_width > 20.0:
        raise ValueError("Road width exceeds typical limits (20.0m)")


