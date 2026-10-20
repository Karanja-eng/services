"""
Structural Relationships and Layer Hierarchy Model.
Manages spatial priority, bar layering rules (B1, B2, T1, T2, etc.),
and connection topologies across members.
"""

from typing import Dict, List, Optional, Tuple, Any
from .model import LayerType, MemberType


class LayerHierarchy:
    """
    Standard IStructE Reinforcement Layering Order.
    In slabs:
      - Bottom: B1 is outer (bottom-most), B2 is second layer above B1.
      - Top: T1 is outer (top-most), T2 is second layer below T1.
    In walls:
      - Near face: N1 outer, N2 second.
      - Far face: F1 outer, F2 second.
    At beam/beam intersections:
      - Primary beam top bars pass above secondary beam top bars (or vice versa as specified).
    """

    @staticmethod
    def get_slab_layer_priority(span_direction: str = "X", is_shorter_span: bool = True) -> Dict[str, LayerType]:
        """
        In two-way slabs, the shorter span bars are placed in the outer layer (B1 at bottom, T1 at top).
        """
        if is_shorter_span:
            return {"bottom": LayerType.B1, "top": LayerType.T1}
        return {"bottom": LayerType.B2, "top": LayerType.T2}

    @staticmethod
    def layer_depth_offset(layer: LayerType, cover_mm: float, bar_dia_outer_mm: float) -> float:
        """Computes distance from concrete face to bar centreline."""
        if layer in (LayerType.B1, LayerType.T1, LayerType.N1, LayerType.F1):
            return cover_mm + (bar_dia_outer_mm / 2.0)
        elif layer in (LayerType.B2, LayerType.T2, LayerType.N2, LayerType.F2):
            return cover_mm + bar_dia_outer_mm + (bar_dia_outer_mm / 2.0)
        return cover_mm


class MemberConnectivity:
    """Maintains connection topological relationships between members."""

    @staticmethod
    def check_connection_validity(primary_type: MemberType, secondary_type: MemberType) -> bool:
        valid_pairs = {
            (MemberType.COLUMN, MemberType.BEAM),
            (MemberType.COLUMN, MemberType.CORBEL),
            (MemberType.BEAM, MemberType.BEAM),
            (MemberType.BEAM, MemberType.SLAB),
            (MemberType.BEAM, MemberType.NIB),
            (MemberType.BEAM, MemberType.HALF_JOINT),
            (MemberType.WALL, MemberType.SLAB),
            (MemberType.WALL, MemberType.FOUNDATION),
            (MemberType.WALL, MemberType.STAIR),
            (MemberType.FOUNDATION, MemberType.COLUMN),
            (MemberType.FOUNDATION, MemberType.WALL),
            (MemberType.STAIR, MemberType.SLAB),
            (MemberType.STAIR, MemberType.WALL),
        }
        return (primary_type, secondary_type) in valid_pairs or (secondary_type, primary_type) in valid_pairs

    @staticmethod
    def check_wall_thickness(thickness_mm: float) -> Tuple[bool, str]:
        """Rule W02: Walls thinner than 150mm not recommended."""
        if thickness_mm < 150.0:
            return False, f"Wall thickness {thickness_mm}mm: thickness < 150 not recommended [Rule W02]."
        return True, f"Wall thickness {thickness_mm}mm >= 150mm acceptable."

    @staticmethod
    def check_wall_trimmer_opening(
        thickness_mm: float,
        opening_w_mm: float,
        opening_h_mm: float,
        pitch_v_mm: float,
        pitch_h_mm: float
    ) -> Dict[str, Any]:
        """
        Rules W19, W21:
        - Opening smaller than pitch: no trimming required.
        - Trimming required: min wall thickness increases to 175mm.
        """
        if opening_w_mm < pitch_v_mm and opening_h_mm < pitch_h_mm:
            return {"trimming_required": False, "reason": "Opening smaller than bar pitch [Rule W19]."}
        
        valid_thickness = thickness_mm >= 175.0
        msg = "Trimming required [Rule W21]."
        if not valid_thickness:
            msg += f" WARNING: Trimmed opening requires wall thickness >= 175mm (current {thickness_mm}mm)."
        return {
            "trimming_required": True,
            "min_wall_thickness_met": valid_thickness,
            "message": msg
        }

    @staticmethod
    def check_foundation_banding(
        lx_mm: float, ly_mm: float, cx_mm: float, cy_mm: float, d_eff_mm: float
    ) -> Dict[str, Any]:
        """Rule F09: Pad footing banding check."""
        band_x = lx_mm > 1.5 * (cx_mm + 3.0 * d_eff_mm)
        band_y = ly_mm > 1.5 * (cy_mm + 3.0 * d_eff_mm)
        bw_x = cx_mm + 3.0 * d_eff_mm
        bw_y = cy_mm + 3.0 * d_eff_mm
        return {
            "band_x_required": band_x,
            "band_y_required": band_y,
            "band_width_x_mm": bw_x,
            "band_width_y_mm": bw_y,
            "concentrated_steel_fraction": 2.0 / 3.0 if (band_x or band_y) else 0.0
        }

    @staticmethod
    def check_moment_connection_corner_bar(corner_bar_dia_mm: float, main_bar_dia_mm: float) -> Tuple[bool, str]:
        """
        Moment connection corner bar rule (Section 6.4.2, page 87; Rule H8):
        For L-bar beam-to-edge-column connection: a standard bend radius may normally be used
        PROVIDED a bar of the same size OR GREATER is placed inside the corner, normal to it.
        If no corner bar is present, a non-standard bend may be required.
        """
        if corner_bar_dia_mm >= main_bar_dia_mm:
            return True, f"Standard bend radius permitted: corner bar ({corner_bar_dia_mm}mm) >= main bar ({main_bar_dia_mm}mm)."
        return False, f"Corner bar ({corner_bar_dia_mm}mm) < main bar ({main_bar_dia_mm}mm); non-standard bend radius may be required."

    @staticmethod
    def secondary_beam_lever_arm_check(primary_cover_mm: float, secondary_bar_dia_mm: float) -> Dict[str, Any]:
        """
        Secondary beam lever arm check flag (Section 4.2.2 note 3 & Section 5.15; Rule E1):
        Where secondary beam reinforcement increases top cover, check that resulting reduction
        in lever arm is satisfactory: z = d - x/2.
        """
        increased_cover = primary_cover_mm + secondary_bar_dia_mm
        return {
            "status": "UNRESOLVED_IN_PDF",
            "increased_cover_mm": increased_cover,
            "rule": "Verify reduced effective depth d_eff = h - increased_cover provides adequate lever arm z.",
            "source": "Section 4.2.2 note 3, referencing Section 5.15"
        }


