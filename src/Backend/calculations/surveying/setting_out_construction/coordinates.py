# backend/surveying/setting_out/coordinates.py
"""
Coordinate transformation and setting-out calculations
"""
import math
from typing import List, Tuple
from ..schemas import Point2D, Point3D, TransformationParams
from ..utils import deg_to_rad, polar_to_cartesian, calculate_bearing, calculate_distance

def transform_coordinates(points: List[Point2D],
                         transformation: TransformationParams) -> List[Point2D]:
    """
    Apply 2D coordinate transformation (translation, rotation, scaling)
    
    Transformation order:
    1. Scale
    2. Rotate
    3. Translate
    
    Args:
        points: List of points to transform
        transformation: Transformation parameters
        
    Returns:
        List of transformed points
    """
    transformed = []
    angle_rad = deg_to_rad(transformation.rotation_angle)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    
    for pt in points:
        # Apply scale
        x_scaled = pt.x * transformation.scale_factor
        y_scaled = pt.y * transformation.scale_factor
        
        # Apply rotation around origin
        x_rotated = x_scaled * cos_a - y_scaled * sin_a
        y_rotated = x_scaled * sin_a + y_scaled * cos_a
        
        # Apply translation
        x_final = x_rotated + transformation.translation_x
        y_final = y_rotated + transformation.translation_y
        
        transformed.append(Point2D(x=x_final, y=y_final))
    
    return transformed

def grid_to_site_transform(grid_point: Point2D,
                           grid_origin_site: Point2D,
                           grid_bearing: float) -> Point2D:
    """
    Transform from local grid coordinates to site coordinates
    
    Args:
        grid_point: Point in local grid system
        grid_origin_site: Grid origin in site coordinates
        grid_bearing: Bearing of grid X-axis (degrees from North)
        
    Returns:
        Point in site coordinate system
    """
    # Rotate grid point to align with site coordinates
    angle_rad = deg_to_rad(90.0 - grid_bearing)  # Convert bearing to math angle
    
    x_rot = grid_point.x * math.cos(angle_rad) - grid_point.y * math.sin(angle_rad)
    y_rot = grid_point.x * math.sin(angle_rad) + grid_point.y * math.cos(angle_rad)
    
    # Translate to site origin
    x_site = grid_origin_site.x + x_rot
    y_site = grid_origin_site.y + y_rot
    
    return Point2D(x=x_site, y=y_site)


# backend/surveying/setting_out/offsets.py
"""
Offset calculations for setting-out
"""
import math
from typing import Tuple
from ..schemas import Point2D
from ..utils import (calculate_bearing, calculate_distance, 
                     polar_to_cartesian, perpendicular_bearing)

def calculate_right_angle_offset(baseline_start: Point2D,
                                 baseline_end: Point2D,
                                 chainage: float,
                                 offset_distance: float) -> Tuple[Point2D, float]:
    """
    Calculate right-angle offset from a baseline
    
    Engineering principle:
    - Offset perpendicular to baseline at specified chainage
    - Positive offset = right side (looking forward along baseline)
    - Negative offset = left side
    
    Args:
        baseline_start: Start point of baseline
        baseline_end: End point of baseline
        chainage: Distance along baseline from start (meters)
        offset_distance: Perpendicular offset distance (meters, +ve = right)
        
    Returns:
        (offset_point, bearing_at_point)
    """
    # Calculate baseline bearing
    baseline_bearing = calculate_bearing(
        baseline_start.x, baseline_start.y,
        baseline_end.x, baseline_end.y
    )
    
    # Calculate chainage point on baseline
    chainage_x, chainage_y = polar_to_cartesian(
        chainage, baseline_bearing,
        baseline_start.x, baseline_start.y
    )
    
    # Calculate perpendicular bearing (right = +90°)
    if offset_distance >= 0:
        offset_bearing = perpendicular_bearing(baseline_bearing, right=True)
    else:
        offset_bearing = perpendicular_bearing(baseline_bearing, right=False)
        offset_distance = abs(offset_distance)
    
    # Calculate offset point
    offset_x, offset_y = polar_to_cartesian(
        offset_distance, offset_bearing,
        chainage_x, chainage_y
    )
    
    return Point2D(x=offset_x, y=offset_y), baseline_bearing

def calculate_oblique_offset(baseline_start: Point2D,
                             baseline_end: Point2D,
                             chainage: float,
                             offset_distance: float,
                             offset_angle: float) -> Point2D:
    """
    Calculate oblique offset at specified angle from baseline
    
    Args:
        baseline_start: Start point of baseline
        baseline_end: End point of baseline
        chainage: Distance along baseline (meters)
        offset_distance: Offset distance (meters)
        offset_angle: Angle from baseline (degrees, +ve = right/clockwise)
        
    Returns:
        Offset point coordinates
    """
    # Get baseline bearing
    baseline_bearing = calculate_bearing(
        baseline_start.x, baseline_start.y,
        baseline_end.x, baseline_end.y
    )
    
    # Calculate chainage point
    chainage_x, chainage_y = polar_to_cartesian(
        chainage, baseline_bearing,
        baseline_start.x, baseline_start.y
    )
    
    # Calculate offset bearing (baseline bearing + offset angle)
    offset_bearing = baseline_bearing + offset_angle
    while offset_bearing >= 360.0:
        offset_bearing -= 360.0
    while offset_bearing < 0:
        offset_bearing += 360.0
    
    # Calculate offset point
    offset_x, offset_y = polar_to_cartesian(
        offset_distance, offset_bearing,
        chainage_x, chainage_y
    )
    
    return Point2D(x=offset_x, y=offset_y)

def calculate_arc_offset(centerline_start: Point2D,
                        centerline_end: Point2D,
                        chainage: float,
                        offset_distance: float,
                        radius: float) -> Point2D:
    """
    Calculate offset from curved centerline (arc)
    
    Engineering principle:
    - Offset follows curve geometry
    - Used for road edge setting-out on curves
    
    Args:
        centerline_start: Curve start point
        centerline_end: Curve end point (for tangent calculation)
        chainage: Chainage along centerline (meters)
        offset_distance: Radial offset (meters, +ve = outside curve)
        radius: Curve radius (meters)
        
    Returns:
        Offset point on parallel curve
    """
    # For circular curves, offset creates parallel curve with radius R ± offset
    # Simplified implementation - assumes small offsets relative to radius
    
    point_on_centerline, bearing = calculate_right_angle_offset(
        centerline_start, centerline_end, chainage, 0.0
    )
    
    # Offset perpendicular to tangent
    offset_point, _ = calculate_right_angle_offset(
        centerline_start, centerline_end,
        chainage, offset_distance
    )
    
    return offset_point