# ============================================================================
# backend/route_surveying/cross_sections/area.py
# ============================================================================

"""
Cross-section area calculations
"""

from typing import List, Dict
from .schemas import Point2D


def calculate_section_area(points: List[Point2D]) -> Dict[str, float]:
    """
    Calculate cut and fill areas using coordinate method.
    
    Returns:
        Dictionary with 'cut', 'fill', and 'net' areas in m²
    """
    if len(points) < 3:
        raise ValueError("Minimum 3 points required for area calculation")
    
    cut_area = 0.0
    fill_area = 0.0
    
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        
        # Calculate trapezoidal area between points
        width = abs(p2.offset - p1.offset)
        avg_height = (p1.elevation + p2.elevation) / 2.0
        segment_area = width * abs(avg_height)
        
        if avg_height < 0:
            cut_area += segment_area
        elif avg_height > 0:
            fill_area += segment_area
    
    net_area = fill_area - cut_area
    
    return {
        "cut": round(cut_area, 3),
        "fill": round(fill_area, 3),
        "net": round(net_area, 3)
    }