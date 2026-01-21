# backend/surveying/alignment/horizontal.py
"""
Horizontal curve geometry calculations

Standard notation:
R = Radius
Δ (Delta) = Intersection angle (deflection angle)
T = Tangent length
L = Curve length
E = External distance
M = Middle ordinate
C = Long chord
"""
import math
from ..constants import DEG_TO_RAD, RAD_TO_DEG, PI
from ..schemas import HorizontalCurveResponse

def calculate_simple_circular_curve(radius: float,
                                    intersection_angle_deg: float,
                                    chainage_ip: float) -> HorizontalCurveResponse:
    """
    Calculate simple circular curve parameters
    
    Engineering formulas:
    - Tangent length: T = R × tan(Δ/2)
    - Curve length: L = R × Δ (Δ in radians)
    - External distance: E = R × [sec(Δ/2) - 1]
    - Middle ordinate: M = R × [1 - cos(Δ/2)]
    - Long chord: C = 2R × sin(Δ/2)
    
    Args:
        radius: Curve radius R (meters)
        intersection_angle_deg: Deflection angle Δ (degrees)
        chainage_ip: Chainage at intersection point (meters)
        
    Returns:
        Complete curve parameters
    """
    # Convert to radians
    delta_rad = abs(intersection_angle_deg) * DEG_TO_RAD
    half_delta = delta_rad / 2.0
    
    # Tangent length: T = R × tan(Δ/2)
    tangent_length = radius * math.tan(half_delta)
    
    # Curve length: L = R × Δ
    curve_length = radius * delta_rad
    
    # External distance: E = R × [sec(Δ/2) - 1]
    # sec(x) = 1/cos(x)
    external_distance = radius * (1.0 / math.cos(half_delta) - 1.0)
    
    # Middle ordinate: M = R × [1 - cos(Δ/2)]
    middle_ordinate = radius * (1.0 - math.cos(half_delta))
    
    # Long chord: C = 2R × sin(Δ/2)
    long_chord = 2.0 * radius * math.sin(half_delta)
    
    # Chainage at tangent to curve (TC)
    chainage_tc = chainage_ip - tangent_length
    
    # Chainage at curve to tangent (CT)
    chainage_ct = chainage_tc + curve_length
    
    return HorizontalCurveResponse(
        radius=radius,
        intersection_angle_deg=abs(intersection_angle_deg),
        tangent_length=tangent_length,
        curve_length=curve_length,
        external_distance=external_distance,
        middle_ordinate=middle_ordinate,
        long_chord=long_chord,
        chainage_tc=chainage_tc,
        chainage_ct=chainage_ct
    )

def calculate_curve_coordinates(radius: float,
                                intersection_angle_deg: float,
                                tangent_bearing_in: float,
                                origin_x: float,
                                origin_y: float,
                                interval: float = 20.0) -> list:
    """
    Calculate coordinates along circular curve at regular intervals
    
    Engineering principle:
    - Uses deflection angle method
    - δ = (l / R) × (180° / π), where l = distance from TC
    
    Args:
        radius: Curve radius (meters)
        intersection_angle_deg: Total deflection angle (degrees)
        tangent_bearing_in: Bearing of tangent at TC (degrees)
        origin_x, origin_y: Coordinates of TC point (meters)
        interval: Calculation interval (meters)
        
    Returns:
        List of (chainage, x, y, deflection_angle) tuples
    """
    from ..utils import deg_to_rad, polar_to_cartesian
    
    delta_rad = abs(intersection_angle_deg) * DEG_TO_RAD
    curve_length = radius * delta_rad
    
    points = []
    chainage = 0.0
    
    while chainage <= curve_length:
        # Deflection angle at this chainage: δ = l / (2R) in radians
        deflection_rad = chainage / (2.0 * radius)
        deflection_deg = deflection_rad * RAD_TO_DEG
        
        # Chord length from TC to current point
        if chainage > 0:
            chord = 2.0 * radius * math.sin(deflection_rad)
        else:
            chord = 0.0
        
        # Bearing to current point = tangent bearing + deflection
        bearing_to_point = tangent_bearing_in + deflection_deg
        
        # Calculate coordinates
        if chord > 0:
            x, y = polar_to_cartesian(chord, bearing_to_point, origin_x, origin_y)
        else:
            x, y = origin_x, origin_y
        
        points.append((chainage, x, y, deflection_deg))
        
        chainage += interval
    
    # Ensure end point is included
    if points[-1][0] < curve_length:
        deflection_rad = curve_length / (2.0 * radius)
        deflection_deg = deflection_rad * RAD_TO_DEG
        chord = 2.0 * radius * math.sin(deflection_rad)
        bearing_to_point = tangent_bearing_in + deflection_deg
        x, y = polar_to_cartesian(chord, bearing_to_point, origin_x, origin_y)
        points.append((curve_length, x, y, deflection_deg))
    
    return points

def calculate_minimum_radius(design_speed_kmh: float,
                             superelevation_rate: float,
                             side_friction_factor: float = 0.15) -> float:
    """
    Calculate minimum curve radius for given design speed
    
    Engineering formula:
    R_min = V² / [127(e + f)]
    
    Where:
    - V = design speed (km/h)
    - e = superelevation rate (decimal)
    - f = side friction factor (decimal)
    - 127 = constant (g × 3.6²)
    
    Args:
        design_speed_kmh: Design speed (km/h)
        superelevation_rate: Superelevation rate (decimal, e.g., 0.06 for 6%)
        side_friction_factor: Side friction factor (typically 0.10-0.17)
        
    Returns:
        Minimum radius in meters
    """
    v_squared = design_speed_kmh ** 2
    denominator = 127.0 * (superelevation_rate + side_friction_factor)
    
    return v_squared / denominator