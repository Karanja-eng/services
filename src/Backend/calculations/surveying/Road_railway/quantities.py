# ============================================================================
# backend/route_surveying/pavement/quantities.py
# ============================================================================

"""
Pavement layer quantity calculations
"""

from typing import List, Dict, Optional
from .schemas import PavementLayer, LayerQuantity


def compute_pavement_quantities(
    alignment_length_m: float,
    lane_width_m: float,
    number_of_lanes: int,
    layers: List[PavementLayer],
    compaction_factor: float = 1.0,
    wastage_factor: float = 0.0
) -> Dict:
    """
    Compute pavement material quantities by layer.
    
    Accounts for:
    - Multiple lanes
    - Layer thickness in mm
    - Material density for tonnage
    - Compaction factors
    - Wastage allowances
    
    Parameters:
        alignment_length_m: Total alignment length in meters
        lane_width_m: Width per lane in meters
        number_of_lanes: Total number of lanes
        layers: List of pavement layers with specifications
        compaction_factor: Compaction adjustment (default 1.0)
        wastage_factor: Wastage percentage as decimal (e.g., 0.05 = 5%)
    
    Returns:
        Dictionary with quantities per layer and totals
    """
    if alignment_length_m <= 0:
        raise ValueError("Alignment length must be positive")
    
    if lane_width_m <= 0 or number_of_lanes <= 0:
        raise ValueError("Lane parameters must be positive")
    
    if compaction_factor <= 0:
        raise ValueError("Compaction factor must be positive")
    
    if wastage_factor < 0 or wastage_factor > 0.5:
        raise ValueError("Wastage factor must be between 0 and 0.5")
    
    total_width = lane_width_m * number_of_lanes
    layer_quantities = []
    total_volume = 0.0
    total_tonnage = 0.0
    
    for layer in layers:
        # Convert thickness from mm to m
        thickness_m = layer.thickness_mm / 1000.0
        
        # Base volume calculation
        volume = alignment_length_m * total_width * thickness_m
        
        # Apply compaction factor
        compacted_volume = volume * compaction_factor
        
        # Apply wastage
        with_wastage = compacted_volume * (1 + wastage_factor)
        
        # Calculate tonnage if density provided
        tonnage = None
        if layer.density_t_m3 is not None:
            tonnage = with_wastage * layer.density_t_m3
            total_tonnage += tonnage
        
        total_volume += with_wastage
        
        layer_qty = LayerQuantity(
            layer_name=layer.name,
            thickness_mm=layer.thickness_mm,
            width_m=round(total_width, 2),
            volume_m3=round(volume, 2),
            tonnage=round(tonnage, 2) if tonnage else None,
            compacted_volume_m3=round(compacted_volume, 2),
            with_wastage_volume_m3=round(with_wastage, 2)
        )
        
        layer_quantities.append(layer_qty)
    
    return {
        "layers": layer_quantities,
        "total_volume_m3": round(total_volume, 2),
        "total_tonnage": round(total_tonnage, 2) if total_tonnage > 0 else None,
        "assumptions": {
            "alignment_length_m": alignment_length_m,
            "total_pavement_width_m": total_width,
            "number_of_lanes": number_of_lanes,
            "compaction_factor": compaction_factor,
            "wastage_factor": wastage_factor
        }
    }
