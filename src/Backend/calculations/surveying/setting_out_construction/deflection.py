# backend/surveying/alignment/deflection.py
"""
Deflection angle calculations for curve setting-out

Deflection angle method is standard practice for setting out curves with theodolite
"""
import math
from typing import List
from ..constants import RAD_TO_DEG, DEG_TO_RAD
from ..schemas import DeflectionTableResponse, DeflectionAngle

def calculate_deflection_table(radius: float,
                               curve_length: float,
                               peg_interval: float,
                               chainage_tc: float) -> DeflectionTableResponse:
    """
    Calculate deflection angle table for curve setting-out
    
    Engineering method:
    - Deflection angle δ = (arc length / 2R) × (180°/π)
    - Chord length c = 2R × sin(δ)
    - Used with theodolite set up at TC
    
    Args:
        radius: Curve radius (meters)
        curve_length: Total curve length (meters)
        peg_interval: Spacing between pegs (meters)
        chainage_tc: Chainage at tangent to curve point (meters)
        
    Returns:
        Complete deflection angle table
    """
    deflections = []
    distance_from_tc = 0.0
    total_deflection_rad = 0.0
    
    while distance_from_tc <= curve_length:
        chainage = chainage_tc + distance_from_tc
        
        # Deflection angle for this segment
        # δ = l / (2R) radians, where l is arc length from TC
        deflection_rad = distance_from_tc / (2.0 * radius)
        deflection_deg = deflection_rad * RAD_TO_DEG
        
        # Chord length from TC to this point
        # c = 2R sin(δ)
        if distance_from_tc > 0:
            chord = 2.0 * radius * math.sin(deflection_rad)
        else:
            chord = 0.0
        
        # Total deflection (cumulative)
        total_deflection_deg = deflection_deg
        
        deflections.append(DeflectionAngle(
            chainage=chainage,
            distance_from_tc=distance_from_tc,
            deflection_angle=deflection_deg,
            total_deflection=total_deflection_deg,
            chord_length=chord
        ))
        
        distance_from_tc += peg_interval
    
    # Ensure curve end is included
    if deflections[-1].distance_from_tc < curve_length:
        deflection_rad = curve_length / (2.0 * radius)
        deflection_deg = deflection_rad * RAD_TO_DEG
        chord = 2.0 * radius * math.sin(deflection_rad)
        
        deflections.append(DeflectionAngle(
            chainage=chainage_tc + curve_length,
            distance_from_tc=curve_length,
            deflection_angle=deflection_deg,
            total_deflection=deflection_deg,
            chord_length=chord
        ))
    
    return DeflectionTableResponse(
        radius=radius,
        curve_length=curve_length,
        peg_interval=peg_interval,
        deflections=deflections
    )

def calculate_incremental_deflections(radius: float,
                                      curve_length: float,
                                      peg_interval: float) -> List[float]:
    """
    Calculate incremental deflection angles between consecutive pegs
    
    Used when setting out from previous peg rather than from TC
    
    Args:
        radius: Curve radius (meters)
        curve_length: Total curve length (meters)
        peg_interval: Spacing between pegs (meters)
        
    Returns:
        List of incremental deflection angles (degrees)
    """
    incremental = []
    distance = peg_interval
    
    while distance <= curve_length:
        # Deflection for standard interval
        delta_rad = peg_interval / (2.0 * radius)
        delta_deg = delta_rad * RAD_TO_DEG
        incremental.append(delta_deg)
        distance += peg_interval
    
    # Last interval might be shorter
    remaining = curve_length % peg_interval
    if remaining > 0.01:  # If significant remainder
        delta_rad = remaining / (2.0 * radius)
        delta_deg = delta_rad * RAD_TO_DEG
        incremental.append(delta_deg)
    
    return incremental


# backend/surveying/alignment/superelevation.py
"""
Superelevation (banking) calculations for horizontal curves
"""
import math
from ..constants import MAX_SUPERELEVATION_RATE, NORMAL_CROWN_SLOPE
from ..schemas import SuperelevationResponse

def calculate_superelevation(design_speed_kmh: float,
                             radius: float,
                             lane_width: float = 3.5,
                             max_rate: float = MAX_SUPERELEVATION_RATE) -> SuperelevationResponse:
    """
    Calculate required superelevation rate for curve
    
    Engineering formula:
    e = (V²/127R) - f
    
    But typically use simplified design tables or:
    e = V² / (127R) for preliminary design
    
    Where:
    - V = design speed (km/h)
    - R = curve radius (meters)
    - e = superelevation rate (decimal)
    - f = side friction (typically assumed 0)
    
    Args:
        design_speed_kmh: Design speed (km/h)
        radius: Curve radius (meters)
        lane_width: Width of lane (meters)
        max_rate: Maximum allowable superelevation rate
        
    Returns:
        Superelevation parameters
    """
    # Calculate required superelevation
    v_squared = design_speed_kmh ** 2
    e_required = v_squared / (127.0 * radius)
    
    # Limit to maximum rate
    if e_required > max_rate:
        e_rate = max_rate
    elif e_required < 0.02:  # Minimum 2% for drainage
        e_rate = 0.02
    else:
        e_rate = e_required
    
    # Calculate runoff length (transition length)
    # L = (e × w) / rate_of_rotation
    # Typical rate: 0.5% per 20m station
    # Simplified: L = 150 × e × w (for high-speed roads)
    runoff_length = 150.0 * e_rate * lane_width
    
    # Minimum runoff based on speed
    min_runoff = design_speed_kmh * 2.0  # Rule of thumb: 2m per km/h
    if runoff_length < min_runoff:
        runoff_length = min_runoff
    
    return SuperelevationResponse(
        design_speed=design_speed_kmh,
        radius=radius,
        superelevation_rate=e_rate,
        runoff_length=runoff_length,
        rotation_axis="centerline"
    )


# backend/surveying/alignment/widening.py
"""
Curve widening calculations
"""
import math
from ..schemas import WideningResponse

def calculate_curve_widening(radius: float,
                            design_speed_kmh: float,
                            lane_width: float = 3.5,
                            num_lanes: int = 1) -> WideningResponse:
    """
    Calculate required widening on horizontal curves
    
    Two components:
    1. Mechanical widening: Due to vehicle offtracking
    2. Psychological widening: Driver comfort
    
    Engineering formulas:
    - Mechanical: Wm = n(R - √(R² - L²)) / R
      where L = vehicle wheelbase (typically 6.0-7.0m for design vehicle)
    - Psychological: Wp = V / (10√R)
      where V = design speed (km/h)
    
    Args:
        radius: Curve radius (meters)
        design_speed_kmh: Design speed (km/h)
        lane_width: Lane width (meters)
        num_lanes: Number of lanes
        
    Returns:
        Widening components and total
    """
    # Mechanical widening
    # Using design vehicle wheelbase = 7.0m (semi-trailer)
    wheelbase = 7.0
    
    if radius > wheelbase:
        r_squared = radius ** 2
        l_squared = wheelbase ** 2
        mechanical = num_lanes * (radius - math.sqrt(r_squared - l_squared)) / radius
    else:
        mechanical = lane_width * 0.5  # Large widening for very sharp curves
    
    # Psychological widening
    # Only applies at higher speeds (> 60 km/h typically)
    if design_speed_kmh > 60:
        psychological = design_speed_kmh / (10.0 * math.sqrt(radius))
    else:
        psychological = 0.0
    
    # Total widening
    total_widening = mechanical + psychological
    
    # Practical limits
    if total_widening > lane_width * 0.5:
        total_widening = lane_width * 0.5
    elif total_widening < 0.1:
        total_widening = 0.0  # Negligible widening
    
    return WideningResponse(
        mechanical_widening=mechanical,
        psychological_widening=psychological,
        total_widening=total_widening
    )