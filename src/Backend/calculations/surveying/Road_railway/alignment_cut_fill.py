
# ============================================================================
# backend/route_surveying/earthworks/alignment_cut_fill.py
# ============================================================================

"""
Earthwork volume calculations along alignment
Average-end-area method
"""

from typing import List, Dict
from .schemas import CrossSectionArea, VolumeSegment
from .validation import validate_cross_sections


def compute_alignment_volumes(
    cross_sections: List[CrossSectionArea]
) -> Dict:
    """
    Compute earthwork volumes using average-end-area method.
    
    Formula: V = (A1 + A2) / 2 * L
    Where:
    - A1, A2 = areas at adjacent stations
    - L = distance between stations
    
    Parameters:
        cross_sections: List of cross-sections with areas (sorted by chainage)
    
    Returns:
        Dictionary with volume segments and totals
    """
    validate_cross_sections(cross_sections)
    
    segments = []
    cumulative_cut = 0.0
    cumulative_fill = 0.0
    
    for i in range(len(cross_sections) - 1):
        cs1 = cross_sections[i]
        cs2 = cross_sections[i + 1]
        
        # Distance between stations
        distance = cs2.chainage - cs1.chainage
        
        if distance <= 0:
            raise ValueError(f"Invalid chainage sequence at {cs1.chainage}")
        
        # Average-end-area calculation
        avg_cut_area = (cs1.cut_area_m2 + cs2.cut_area_m2) / 2.0
        avg_fill_area = (cs1.fill_area_m2 + cs2.fill_area_m2) / 2.0
        
        cut_volume = avg_cut_area * distance
        fill_volume = avg_fill_area * distance
        net_volume = fill_volume - cut_volume
        
        cumulative_cut += cut_volume
        cumulative_fill += fill_volume
        
        segment = VolumeSegment(
            from_chainage=cs1.chainage,
            to_chainage=cs2.chainage,
            cut_volume_m3=round(cut_volume, 2),
            fill_volume_m3=round(fill_volume, 2),
            net_volume_m3=round(net_volume, 2),
            cumulative_cut_m3=round(cumulative_cut, 2),
            cumulative_fill_m3=round(cumulative_fill, 2),
            mass_haul_balance_m3=round(cumulative_fill - cumulative_cut, 2)
        )
        
        segments.append(segment)
    
    return {
        "segments": segments,
        "total_cut_m3": round(cumulative_cut, 2),
        "total_fill_m3": round(cumulative_fill, 2),
        "total_net_m3": round(cumulative_fill - cumulative_cut, 2),
        "calculation_method": "average_end_area"
    }