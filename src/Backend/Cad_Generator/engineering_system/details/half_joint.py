"""
Half-Joint Detailing Generator (IStructE Section 6.9, Model Detail MHJ).
Preserves RuleEngine logic, diagonal strut-and-tie reinforcement, and decoupled DXF rendering.
"""

import math
from dataclasses import dataclass
from typing import Tuple, List, Optional
from ..core.rules import RuleEngine, FactType, ConstraintSeverity
from ..core.reinforcement import TableB1, BarAreaCalculator
from ..drawing.dxf import DXFDocument
from ..drawing.dimensions import DimensionRenderer
from ..drawing.annotations import AnnotationRenderer


@dataclass
class HalfJointGeometry:
    """Parameters for RC Half-Joint detailing per Model Detail MHJ."""
    b_w_mm: float = 400.0                # Beam width
    h_beam_mm: float = 900.0             # Full beam depth
    h_nib_mm: float = 450.0              # Half-joint nib depth (>= 0.5 * h_beam)
    l_recess_mm: float = 350.0           # Recess length
    a_v_mm: float = 200.0                # Distance from inside re-entrant face to load center
    F_Ed_kN: float = 350.0               # Design vertical reaction
    H_Ed_kN: float = 70.0                # Design horizontal force (>= 0.2 * F_Ed)
    bar_dia_main_mm: int = 20            # Horizontal tension tie in nib
    n_main_bars: int = 4
    inclined_bar_dia_mm: int = 20        # 45-degree diagonal strut/tie bars
    n_inclined_bars: int = 2
    stirrup_dia_mm: int = 10             # Vertical suspension stirrups behind re-entrant corner
    n_suspension_links: int = 4
    cover_mm: float = 30.0               # Nominal cover
    bearing_pad_width_mm: float = 150.0
    bearing_pad_thickness_mm: float = 20.0


class HalfJointDetailGenerator:
    """Validates constraints via RuleEngine and renders MHJ to DXF."""

    def __init__(self, geom: HalfJointGeometry, rule_engine: Optional[RuleEngine] = None):
        self.geom = geom
        self.rule_engine = rule_engine or RuleEngine()
        self._register_rules()

    def _register_rules(self) -> None:
        g = self.geom
        # 1. Nib depth >= 0.5 * full beam depth
        self.rule_engine.check_mandatory(
            "HALF_JOINT_DEPTH",
            g.h_nib_mm >= 0.5 * g.h_beam_mm - 1e-3,
            f"Nib depth ({g.h_nib_mm}mm) < 0.5 * beam depth ({0.5*g.h_beam_mm}mm).",
            "IStructE §6.9 Model Detail MHJ",
            FactType.DIRECTLY_STATED
        )

        # 2. Horizontal force H_Ed >= 0.2 * F_Ed
        self.rule_engine.check_mandatory(
            "HALF_JOINT_HORIZONTAL_FORCE",
            g.H_Ed_kN >= 0.2 * g.F_Ed_kN - 1e-3,
            f"H_Ed ({g.H_Ed_kN}kN) < 0.2 * F_Ed ({0.2*g.F_Ed_kN}kN).",
            "EC2 §6.5 / IStructE §6.9",
            FactType.DIRECTLY_STATED
        )

        # 3. Bearing pad front clearance >= 15mm
        pad_front_clearance = g.l_recess_mm - (g.a_v_mm + g.bearing_pad_width_mm / 2.0)
        self.rule_engine.check_mandatory(
            "HALF_JOINT_PAD_CLEARANCE",
            pad_front_clearance >= 15.0,
            f"Bearing pad front clearance ({pad_front_clearance:.1f}mm) is less than 15mm.",
            "IStructE §6.9 Note 3",
            FactType.DIRECTLY_STATED
        )

    def render_dxf(self, dxf: DXFDocument, origin: Tuple[float, float] = (100.0, 200.0)) -> None:
        g = self.geom
        ox, oy = origin

        # Beam and nib concrete outline (stepped profile)
        beam_ext = 800.0
        poly = [
            (ox, oy),                                       # Soffit of nib
            (ox + g.l_recess_mm, oy),                       # Re-entrant corner at bottom
            (ox + g.l_recess_mm, oy - (g.h_beam_mm - g.h_nib_mm)), # Drop to full beam soffit
            (ox + g.l_recess_mm + beam_ext, oy - (g.h_beam_mm - g.h_nib_mm)),
            (ox + g.l_recess_mm + beam_ext, oy + g.h_nib_mm), # Top of beam
            (ox, oy + g.h_nib_mm),                          # Top of nib
            (ox, oy)
        ]
        dxf.add_polyline(poly, layer="CONCRETE")

        # Bearing pad under nib soffit
        pad_x = ox + g.l_recess_mm - g.a_v_mm - g.bearing_pad_width_mm / 2.0
        pad_y = oy - g.bearing_pad_thickness_mm
        pad_rect = [
            (pad_x, pad_y),
            (pad_x + g.bearing_pad_width_mm, pad_y),
            (pad_x + g.bearing_pad_width_mm, oy),
            (pad_x, oy),
            (pad_x, pad_y)
        ]
        dxf.add_polyline(pad_rect, layer="CONCRETE")
        dxf.add_hatch(pad_rect[:-1], pattern="ANSI31", scale=0.3, layer="HATCH")

        c = g.cover_mm

        # Nib bottom tension tie (horizontal loop or U-bar)
        nb_y = oy + c
        nb_x1 = ox + c
        nb_x2 = ox + g.l_recess_mm + 400.0
        dxf.add_line((nb_x1, nb_y), (nb_x2, nb_y), layer="REBAR_MAIN")
        dxf.add_line((nb_x1, nb_y), (nb_x1, nb_y + g.h_nib_mm - 2 * c), layer="REBAR_MAIN")

        # 45-degree inclined diagonal bars across re-entrant corner
        diag_start = (ox + g.l_recess_mm - 50.0, oy + c)
        diag_end = (ox + g.l_recess_mm + (g.h_beam_mm - g.h_nib_mm) * 0.8, oy + g.h_nib_mm - c)
        dxf.add_line(diag_start, diag_end, layer="REBAR_MAIN")

        # Vertical suspension links behind re-entrant corner
        susp_x1 = ox + g.l_recess_mm + 50.0
        for i in range(g.n_suspension_links):
            sx = susp_x1 + i * 75.0
            dxf.add_line((sx, oy - (g.h_beam_mm - g.h_nib_mm) + c), (sx, oy + g.h_nib_mm - c), layer="REBAR_LINKS")

        # Dimensions
        DimensionRenderer.add_dimension(dxf, (ox, oy - 80.0), (ox + g.l_recess_mm, oy - 80.0), offset=-20.0, text=f"recess={int(g.l_recess_mm)}")
        DimensionRenderer.add_dimension(dxf, (ox - 30.0, oy), (ox - 30.0, oy + g.h_nib_mm), offset=-20.0, text=f"h_nib={int(g.h_nib_mm)}")
        DimensionRenderer.add_dimension(dxf, (ox + g.l_recess_mm + beam_ext + 30.0, oy - (g.h_beam_mm - g.h_nib_mm)),
                                        (ox + g.l_recess_mm + beam_ext + 30.0, oy + g.h_nib_mm), offset=20.0, text=f"h_beam={int(g.h_beam_mm)}")

        # Title
        dxf.add_text("MODEL DETAIL MHJ — HALF-JOINT WITH DIAGONAL STRUT", (ox, oy + g.h_nib_mm + 40.0), height=5.0, layer="ANNOTATIONS")
