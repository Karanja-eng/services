"""
Special Structures Detailing Models and Rule Backing.
Covers Prestressed Concrete, Precast Practice, Water-Retaining Structures, and Staircase Fragments.
Preserves non-parametric / rule-based knowledge without inventing unsupported geometry.
"""

from typing import Dict, List, Any, Tuple
from ..core.model import Member, MemberType
from ..core.rules import RuleEngine, FactType, ConstraintSeverity
from ..drawing.dxf import DXFDocument


class PrestressedCalculator:
    """Prestressing tendon profile calculations and rules per Chapter 7."""

    @staticmethod
    def parabolic_tendon_profile(
        span_length_mm: float,
        sag_depth_mm: float,
        cover_at_midspan_mm: float,
        end_height_mm: float,
        num_stations: int = 11,
    ) -> List[Tuple[float, float]]:
        """Computes coordinates (x, z) of parabolic post-tensioned tendon along member."""
        stations = []
        for i in range(num_stations):
            x = (i / (num_stations - 1)) * span_length_mm
            # Parabolic sag: z = 4 * sag * (x/L) * (1 - x/L)
            z = end_height_mm - 4.0 * sag_depth_mm * (x / span_length_mm) * (1.0 - (x / span_length_mm))
            stations.append((round(x, 1), round(z, 1)))
        return stations


class PrecastRules:
    """UK Precast transport limits and lifting rules per Chapter 8."""
    UK_MAX_WIDTH_STANDARD_M = 2.90
    UK_MAX_WIDTH_ESCORT_M = 4.30
    UK_MAX_LENGTH_RIGID_M = 18.30
    UK_MAX_GROSS_WEIGHT_TONNES = 44.0

    @classmethod
    def verify_transport_envelope(cls, length_m: float, width_m: float, weight_tonnes: float) -> List[str]:
        notes = []
        if width_m > cls.UK_MAX_WIDTH_STANDARD_M:
            notes.append(f"Width {width_m}m exceeds standard 2.9m limit; requires abnormal load notification/escort.")
        if length_m > cls.UK_MAX_LENGTH_RIGID_M:
            notes.append(f"Length {length_m}m exceeds standard rigid vehicle limit of 18.3m; requires rear-steer trailer.")
        if weight_tonnes > cls.UK_MAX_GROSS_WEIGHT_TONNES:
            notes.append(f"Gross weight {weight_tonnes}t exceeds standard UK 44-tonne maximum.")
        return notes


class WaterRetainingRules:
    """Tightness classes and cover rules per BS EN 1992-3 / Chapter 9."""

    TIGHTNESS_CLASSES = {
        0: {"description": "Some degree of leakage acceptable or negligible retention required", "min_cover_mm": 35.0},
        1: {"description": "Leakage limited to small amount (surface staining / damp patches)", "min_cover_mm": 40.0},
        2: {"description": "Leakage severely restricted (no visible water staining)", "min_cover_mm": 45.0},
        3: {"description": "No leakage permitted whatsoever (special lining or prestressing)", "min_cover_mm": 50.0},
    }

    @classmethod
    def get_nominal_cover(cls, tightness_class: int = 1) -> float:
        if tightness_class in cls.TIGHTNESS_CLASSES:
            return cls.TIGHTNESS_CLASSES[tightness_class]["min_cover_mm"]
        return 40.0
