# backend/surveying/utils.py
"""
Core surveying utility functions
All angles in radians internally unless specified
"""
import math
from typing import Tuple
from .constants import DEG_TO_RAD, RAD_TO_DEG, PI, TWO_PI

def normalize_angle(angle_rad: float) -> float:
    """
    Normalize angle to range [0, 2π)
    
    Args:
        angle_rad: Angle in radians
        
    Returns:
        Normalized angle in [0, 2π)
    """
    while angle_rad < 0:
        angle_rad += TWO_PI
    while angle_rad >= TWO_PI:
        angle_rad -= TWO_PI
    return angle_rad

def deg_to_rad(degrees: float) -> float:
    """Convert degrees to radians"""
    return degrees * DEG_TO_RAD

def rad_to_deg(radians: float) -> float:
    """Convert radians to degrees"""
    return radians * RAD_TO_DEG

def bearing_to_azimuth(bearing_deg: float) -> float:
    """
    Convert whole circle bearing (0-360°) to mathematical azimuth
    
    Civil engineering bearing: 0° = North, clockwise positive
    Mathematical azimuth: 0° = East, counter-clockwise positive
    
    Args:
        bearing_deg: Bearing in degrees (0-360)
        
    Returns:
        Azimuth in radians
    """
    # Convert bearing to azimuth: Az = 90° - Bearing
    azimuth_deg = 90.0 - bearing_deg
    return normalize_angle(deg_to_rad(azimuth_deg))

def azimuth_to_bearing(azimuth_rad: float) -> float:
    """
    Convert mathematical azimuth to whole circle bearing
    
    Args:
        azimuth_rad: Azimuth in radians
        
    Returns:
        Bearing in degrees (0-360)
    """
    # Bearing = 90° - Azimuth
    bearing_deg = 90.0 - rad_to_deg(azimuth_rad)
    if bearing_deg < 0:
        bearing_deg += 360.0
    elif bearing_deg >= 360.0:
        bearing_deg -= 360.0
    return bearing_deg

def calculate_bearing(x1: float, y1: float, x2: float, y2: float) -> float:
    """
    Calculate whole circle bearing from point 1 to point 2
    
    Args:
        x1, y1: Coordinates of first point (meters)
        x2, y2: Coordinates of second point (meters)
        
    Returns:
        Bearing in degrees (0-360°), 0° = North
    """
    dx = x2 - x1
    dy = y2 - y1
    
    # Mathematical atan2 gives azimuth from East
    azimuth_rad = math.atan2(dy, dx)
    
    # Convert to bearing
    return azimuth_to_bearing(azimuth_rad)

def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """
    Calculate horizontal distance between two points
    
    Args:
        x1, y1: Coordinates of first point (meters)
        x2, y2: Coordinates of second point (meters)
        
    Returns:
        Distance in meters
    """
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

def calculate_slope_distance(x1: float, y1: float, z1: float,
                             x2: float, y2: float, z2: float) -> float:
    """
    Calculate 3D slope distance between two points
    
    Args:
        x1, y1, z1: Coordinates of first point (meters)
        x2, y2, z2: Coordinates of second point (meters)
        
    Returns:
        Slope distance in meters
    """
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)

def polar_to_cartesian(distance: float, bearing_deg: float,
                       origin_x: float = 0.0, origin_y: float = 0.0) -> Tuple[float, float]:
    """
    Convert polar coordinates (distance, bearing) to Cartesian (x, y)
    
    Args:
        distance: Distance from origin (meters)
        bearing_deg: Whole circle bearing (degrees, 0° = North)
        origin_x, origin_y: Origin coordinates (meters)
        
    Returns:
        (x, y) coordinates in meters
    """
    azimuth_rad = bearing_to_azimuth(bearing_deg)
    
    x = origin_x + distance * math.cos(azimuth_rad)
    y = origin_y + distance * math.sin(azimuth_rad)
    
    return x, y

def cartesian_to_polar(x: float, y: float,
                       origin_x: float = 0.0, origin_y: float = 0.0) -> Tuple[float, float]:
    """
    Convert Cartesian coordinates to polar (distance, bearing)
    
    Args:
        x, y: Point coordinates (meters)
        origin_x, origin_y: Origin coordinates (meters)
        
    Returns:
        (distance, bearing_deg) - distance in meters, bearing in degrees
    """
    dx = x - origin_x
    dy = y - origin_y
    
    distance = math.sqrt(dx**2 + dy**2)
    bearing_deg = calculate_bearing(origin_x, origin_y, x, y)
    
    return distance, bearing_deg

def perpendicular_bearing(bearing_deg: float, right: bool = True) -> float:
    """
    Calculate perpendicular bearing (90° offset)
    
    Args:
        bearing_deg: Original bearing (degrees)
        right: If True, turn right (clockwise); if False, turn left
        
    Returns:
        Perpendicular bearing in degrees (0-360)
    """
    if right:
        perp = bearing_deg + 90.0
    else:
        perp = bearing_deg - 90.0
    
    # Normalize to 0-360
    while perp < 0:
        perp += 360.0
    while perp >= 360.0:
        perp -= 360.0
    
    return perp

def interpolate_chainage(chainage: float, ch_start: float, value_start: float,
                        ch_end: float, value_end: float) -> float:
    """
    Linear interpolation along chainage
    
    Args:
        chainage: Target chainage (meters)
        ch_start: Start chainage (meters)
        value_start: Value at start
        ch_end: End chainage (meters)
        value_end: Value at end
        
    Returns:
        Interpolated value at target chainage
    """
    if ch_end == ch_start:
        return value_start
    
    ratio = (chainage - ch_start) / (ch_end - ch_start)
    return value_start + ratio * (value_end - value_start)