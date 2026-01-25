# backend/route_surveying/cross_sections/generation.py
"""
Cross-section generation for roads and railways
"""

from typing import List, Dict
from .schemas import Point2D, SideSlopes, CamberConfig, FormationType
from .validation import validate_geometric_parameters


def generate_cross_section(
    chainage: float,
    road_width: float,
    shoulder_width: float,
    side_slopes: SideSlopes,
    camber_config: CamberConfig,
    formation_type: FormationType
) -> List[Point2D]:
    """
    Generate cross-section points at specified chainage.
    
    Returns list of Point2D from left to right across section.
    Elevation is relative to design centerline.
    """
    validate_geometric_parameters(road_width, shoulder_width)
    
    points = []
    
    half_road = road_width / 2.0
    total_half_width = (road_width + 2 * shoulder_width) / 2.0
    
    # Calculate camber offsets
    if camber_config.type == "two-way":
        left_camber = half_road * (camber_config.percentage / 100.0)
        right_camber = half_road * (camber_config.percentage / 100.0)
    else:  # one-way
        left_camber = 0.0
        right_camber = road_width * (camber_config.percentage / 100.0)
    
    # Determine formation heights (simplified - would use actual design in production)
    if formation_type == "cut":
        cut_height = 3.0  # meters
        fill_depth = 0.0
    else:  # fill
        cut_height = 0.0
        fill_depth = 2.5  # meters
    
    # Left side slope
    if cut_height > 0:
        left_slope_offset = -total_half_width - (cut_height * side_slopes.cut)
        points.append(Point2D(offset=left_slope_offset, elevation=-cut_height))
    elif fill_depth > 0:
        left_slope_offset = -total_half_width - (fill_depth * side_slopes.fill)
        points.append(Point2D(offset=left_slope_offset, elevation=fill_depth))
    
    # Left shoulder edge
    points.append(Point2D(offset=-total_half_width, elevation=left_camber))
    
    # Left road edge
    points.append(Point2D(offset=-half_road, elevation=left_camber))
    
    # Centerline
    points.append(Point2D(offset=0.0, elevation=0.0))
    
    # Right road edge
    points.append(Point2D(offset=half_road, elevation=right_camber))
    
    # Right shoulder edge
    points.append(Point2D(offset=total_half_width, elevation=right_camber))
    
    # Right side slope
    if cut_height > 0:
        right_slope_offset = total_half_width + (cut_height * side_slopes.cut)
        points.append(Point2D(offset=right_slope_offset, elevation=-cut_height))
    elif fill_depth > 0:
        right_slope_offset = total_half_width + (fill_depth * side_slopes.fill)
        points.append(Point2D(offset=right_slope_offset, elevation=fill_depth))
    
    return points
















