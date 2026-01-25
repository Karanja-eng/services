# ============================================================================
# backend/route_surveying/chainage/interpolation.py
# ============================================================================

"""
Chainage-based interpolation for survey data
"""

from typing import List, Dict, Optional
from .schemas import Station
from .validation import validate_stations
from .utils import linear_interpolate


def interpolate_at_chainage(
    stations: List[Station],
    target_chainage: float
) -> Dict:
    """
    Interpolate survey data at target chainage.
    
    Uses linear interpolation between bracketing stations.
    Flags if extrapolation is required.
    
    Parameters:
        stations: List of surveyed stations (must be sorted by chainage)
        target_chainage: Target chainage for interpolation
    
    Returns:
        Dictionary with interpolated values and metadata
    """
    validate_stations(stations)
    
    # Sort by chainage (should already be sorted, but ensure)
    sorted_stations = sorted(stations, key=lambda s: s.chainage)
    
    # Check if exact match exists
    for station in sorted_stations:
        if abs(station.chainage - target_chainage) < 0.001:
            return {
                "chainage": target_chainage,
                "elevation": station.elevation,
                "offset": station.offset,
                "interpolated": False,
                "method": "exact_match",
                "extrapolated": False
            }
    
    # Find bracketing stations
    before_station: Optional[Station] = None
    after_station: Optional[Station] = None
    
    for station in sorted_stations:
        if station.chainage <= target_chainage:
            before_station = station
        if station.chainage >= target_chainage and after_station is None:
            after_station = station
            break
    
    # Check for extrapolation
    extrapolated = False
    if before_station is None:
        # Target before first station - extrapolate
        before_station = sorted_stations[0]
        after_station = sorted_stations[1]
        extrapolated = True
    elif after_station is None:
        # Target after last station - extrapolate
        after_station = sorted_stations[-1]
        before_station = sorted_stations[-2]
        extrapolated = True
    
    # Linear interpolation
    elevation = linear_interpolate(
        before_station.chainage, before_station.elevation,
        after_station.chainage, after_station.elevation,
        target_chainage
    )
    
    offset = linear_interpolate(
        before_station.chainage, before_station.offset,
        after_station.chainage, after_station.offset,
        target_chainage
    )
    
    return {
        "chainage": target_chainage,
        "elevation": round(elevation, 3),
        "offset": round(offset, 3),
        "interpolated": True,
        "method": "linear",
        "extrapolated": extrapolated,
        "bracketing_stations": {
            "before": before_station.chainage,
            "after": after_station.chainage
        }
    }
