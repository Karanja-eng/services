"""
Corbel Detailing Generator (IStructE Section 6.9, Model Details MCB1 & MCB2).
Preserves RuleEngine logic, source-derived constraints, and decoupled DXF rendering.
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
class CorbelGeometry:
    """Parameters for RC Corbel detailing per Section 6.9."""
    b_c_mm: float = 400.0            # Corbel & column width
    h_c_mm: float = 600.0            # Root depth at column face
    h_tip_mm: float = 300.0          # Tip depth (shall be >= 0.5 * h_c)
    a_c_mm: float = 250.0            # Distance from column face to resultant load
    l_corbel_mm: float = 400.0       # Projection length from column face
    F_Ed_kN: float = 400.0           # Design vertical load
    H_Ed_kN: float = 80.0            # Design horizontal load (>= 0.2 * F_Ed per EC2 §6.5.3)
    bar_dia_main_mm: int = 16        # Main tension tie bar diameter
    n_main_bars: int = 4             # Number of main tension bars
    stirrup_dia_mm: int = 10         # Horizontal closed link diameter
    n_stirrup_layers: int = 4        # Number of closed stirrup layers in top 2/3 depth
    cover_mm: float = 30.0           # Nominal cover
    anchor_type: str = "WELDED_CROSS_BAR"  # 'WELDED_CROSS_BAR' (MCB1) or 'HORIZONTAL_LOOP' (MCB2)
    bearing_pad_width_mm: float = 200.0
    bearing_pad_thickness_mm: float = 20.0
    col_width_mm: float = 400.0
    col_height_mm: float = 1200.0


class CorbelDetailGenerator:
    """Validates constraints via RuleEngine and renders MCB1 / MCB2 to DXF."""

    def __init__(self, geom: CorbelGeometry, rule_engine: Optional[RuleEngine] = None):
        self.geom = geom
        self.rule_engine = rule_engine or RuleEngine()
        self._register_rules()

    def _register_rules(self) -> None:
        g = self.geom
        # 1. Geometry ratio a_c / h_c <= 1.0 (Corbel behavior definition)
        self.rule_engine.check_mandatory(
            "CORBEL_RATIO",
            (g.a_c_mm / g.h_c_mm) <= 1.0,
            f"a_c/h_c = {g.a_c_mm/g.h_c_mm:.2f} > 1.0; element acts as a cantilever beam, not a corbel.",
            "EC2 §6.5.3 / IStructE §6.9",
            FactType.DIRECTLY_STATED
        )

        # 2. Tip depth h_tip >= 0.5 * h_c
        self.rule_engine.check_mandatory(
            "CORBEL_TIP_DEPTH",
            g.h_tip_mm >= 0.5 * g.h_c_mm,
            f"h_tip ({g.h_tip_mm}mm) < 0.5 * h_c ({0.5*g.h_c_mm}mm).",
            "IStructE §6.9 Model Detail MCB1",
            FactType.DIRECTLY_STATED
        )

        # 3. Horizontal force H_Ed >= 0.2 * F_Ed
        self.rule_engine.check_mandatory(
            "CORBEL_HORIZONTAL_FORCE",
            g.H_Ed_kN >= 0.2 * g.F_Ed_kN - 1e-3,
            f"H_Ed ({g.H_Ed_kN}kN) < 0.2 * F_Ed ({0.2*g.F_Ed_kN}kN). EC2 requires minimum 20% horizontal force.",
            "EC2 §6.5.3(3)",
            FactType.DIRECTLY_STATED
        )

        # 4. Closed horizontal links total area >= 0.5 * As_main
        as_main = BarAreaCalculator.group_area(g.bar_dia_main_mm, g.n_main_bars)
        as_links = BarAreaCalculator.group_area(g.stirrup_dia_mm, g.n_stirrup_layers * 2)  # 2 legs per layer
        self.rule_engine.check_mandatory(
            "CORBEL_LINK_AREA",
            as_links >= 0.5 * as_main,
            f"Total link area ({as_links:.0f}mm²) < 0.5 * As_main ({0.5*as_main:.0f}mm²).",
            "EC2 §6.5.3 / Model Detail MCB1",
            FactType.DIRECTLY_STATED
        )

        # 5. Bearing pad front clearance >= 15mm
        pad_front_clearance = g.l_corbel_mm - (g.a_c_mm + g.bearing_pad_width_mm / 2.0)
        self.rule_engine.check_mandatory(
            "CORBEL_PAD_CLEARANCE",
            pad_front_clearance >= 15.0,
            f"Bearing pad front clearance ({pad_front_clearance:.1f}mm) is less than required 15mm.",
            "IStructE §6.9 Note 3",
            FactType.DIRECTLY_STATED
        )

    def render_dxf(self, dxf: DXFDocument, origin: Tuple[float, float] = (100.0, 200.0)) -> None:
        g = self.geom
        ox, oy = origin

        # Column profile
        col_x = ox
        col_w = g.col_width_mm
        col_h = g.col_height_mm
        dxf.add_line((col_x, oy - col_h / 2.0), (col_x, oy + col_h / 2.0), layer="CONCRETE")
        dxf.add_line((col_x - col_w, oy - col_h / 2.0), (col_x - col_w, oy + col_h / 2.0), layer="CONCRETE")

        # Corbel outline
        corbel_pts = [
            (col_x, oy + g.h_c_mm),
            (col_x + g.l_corbel_mm, oy + g.h_c_mm),
            (col_x + g.l_corbel_mm, oy + g.h_c_mm - g.h_tip_mm),
            (col_x, oy),
        ]
        dxf.add_polyline(corbel_pts, layer="CONCRETE")

        # Bearing pad
        pad_x = col_x + g.a_c_mm - g.bearing_pad_width_mm / 2.0
        pad_y = oy + g.h_c_mm
        pad_pts = [
            (pad_x, pad_y),
            (pad_x + g.bearing_pad_width_mm, pad_y),
            (pad_x + g.bearing_pad_width_mm, pad_y + g.bearing_pad_thickness_mm),
            (pad_x, pad_y + g.bearing_pad_thickness_mm),
            (pad_x, pad_y)
        ]
        dxf.add_polyline(pad_pts, layer="CONCRETE")
        dxf.add_hatch(pad_pts[:-1], pattern="ANSI31", scale=0.3, layer="HATCH")

        # Main tension bars (top of corbel, anchored into column)
        c = g.cover_mm
        main_bar_y = oy + g.h_c_mm - c - g.bar_dia_main_mm / 2.0
        bar_start_x = col_x - col_w + c
        bar_end_x = col_x + g.l_corbel_mm - c
        dxf.add_line((bar_start_x, main_bar_y), (bar_end_x, main_bar_y), layer="REBAR_MAIN")

        if g.anchor_type == "WELDED_CROSS_BAR":
            # MCB1: Welded transverse bar at front edge
            dxf.add_circle((bar_end_x, main_bar_y), radius=g.bar_dia_main_mm / 2.0, layer="REBAR_MAIN")
            dxf.add_text("Welded cross bar", (bar_end_x + 15.0, main_bar_y - 5.0), height=3.0, layer="ANNOTATIONS")
        else:
            # MCB2: Horizontal loop return
            loop_return_y = main_bar_y - 60.0
            dxf.add_line((bar_end_x, main_bar_y), (bar_end_x, loop_return_y), layer="REBAR_MAIN")
            dxf.add_line((bar_end_x, loop_return_y), (col_x + 50.0, loop_return_y), layer="REBAR_MAIN")

        # Horizontal closed stirrups in upper 2/3 of effective depth
        d_eff = g.h_c_mm - c - g.bar_dia_main_mm / 2.0
        upper_2_3 = (2.0 / 3.0) * d_eff
        stirrup_spacing = upper_2_3 / (g.n_stirrup_layers + 1)

        for i in range(1, g.n_stirrup_layers + 1):
            sy = main_bar_y - i * stirrup_spacing
            # Stirrups extend around corbel face
            st_x2 = col_x + g.l_corbel_mm - c
            dxf.add_line((bar_start_x + 50.0, sy), (st_x2, sy), layer="REBAR_LINKS")

        # Dimensions
        DimensionRenderer.add_dimension(dxf, (col_x, oy + g.h_c_mm + 40.0), (col_x + g.a_c_mm, oy + g.h_c_mm + 40.0), offset=15.0, text=f"ac={int(g.a_c_mm)}")
        DimensionRenderer.add_dimension(dxf, (col_x, oy + g.h_c_mm + 70.0), (col_x + g.l_corbel_mm, oy + g.h_c_mm + 70.0), offset=15.0, text=f"L={int(g.l_corbel_mm)}")
        DimensionRenderer.add_dimension(dxf, (col_x - 30.0, oy), (col_x - 30.0, oy + g.h_c_mm), offset=-20.0, text=f"hc={int(g.h_c_mm)}")

        # Title
        dxf.add_text(f"MODEL DETAIL MCB1 — CORBEL ({g.anchor_type})", (col_x - 50.0, oy + g.h_c_mm + 120.0), height=5.0, layer="ANNOTATIONS")
