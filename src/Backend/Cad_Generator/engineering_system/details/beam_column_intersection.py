"""
Beam/Column Intersection Detail Generator.
Implements Figure 4.4 and Section 4.5 detailing rules for internal and external beam-column junctions.
Consumes shared DXFDocument, drawing standards, and BS 8666 reinforcement models.
"""

from dataclasses import dataclass
from typing import Tuple, Optional
from ..core.model import Member, MemberType, DrawingSheet, DrawingPanel
from ..core.reinforcement import CoverCalculator, TableB1
from ..core.relationships import MemberConnectivity
from ..drawing.dxf import DXFDocument
from ..drawing.dimensions import DimensionRenderer
from ..drawing.annotations import AnnotationRenderer


@dataclass
class BeamColumnIntersectionParams:
    """Parameters for Beam-Column Intersection detailing."""
    col_width_mm: float = 400.0
    col_depth_mm: float = 400.0
    beam_width_mm: float = 300.0
    beam_depth_mm: float = 600.0
    span_left_mm: float = 2000.0
    span_right_mm: float = 2000.0
    col_height_above_mm: float = 1200.0
    col_height_below_mm: float = 1200.0
    cover_mm: float = 30.0
    main_bar_dia_mm: int = 25
    link_dia_mm: int = 10
    col_bar_dia_mm: int = 32
    col_bar_count: int = 4
    # Rule H8: moment connection corner bar check
    is_edge_column: bool = False
    corner_bar_dia_mm: Optional[int] = 25


class BeamColumnIntersectionGenerator:
    """Generates 2D elevation and plan CAD drawings of internal/external beam-column intersections."""

    def __init__(self, params: BeamColumnIntersectionParams):
        self.params = params
        self.corner_bar_check: Optional[Tuple[bool, str]] = None
        if self.params.is_edge_column and self.params.corner_bar_dia_mm is not None:
            self.corner_bar_check = MemberConnectivity.check_moment_connection_corner_bar(
                float(self.params.corner_bar_dia_mm), float(self.params.main_bar_dia_mm)
            )

    def render_elevation(self, dxf: DXFDocument, origin: Tuple[float, float] = (100.0, 300.0)) -> None:
        p = self.params
        ox, oy = origin

        # Column outline (passing through junction)
        col_x = ox + p.span_left_mm
        col_bot_y = oy - p.col_height_below_mm
        col_top_y = oy + p.beam_depth_mm + p.col_height_above_mm

        # Draw lower column
        dxf.add_polyline([
            (col_x, col_bot_y), (col_x + p.col_width_mm, col_bot_y),
            (col_x + p.col_width_mm, oy), (col_x, oy), (col_x, col_bot_y)
        ], layer="CONCRETE")

        # Draw upper column
        dxf.add_polyline([
            (col_x, oy + p.beam_depth_mm), (col_x + p.col_width_mm, oy + p.beam_depth_mm),
            (col_x + p.col_width_mm, col_top_y), (col_x, col_top_y), (col_x, oy + p.beam_depth_mm)
        ], layer="CONCRETE")

        # Beam outline (left and right)
        dxf.add_polyline([
            (ox, oy), (col_x, oy), (col_x, oy + p.beam_depth_mm), (ox, oy + p.beam_depth_mm), (ox, oy)
        ], layer="CONCRETE")

        rx = col_x + p.col_width_mm
        dxf.add_polyline([
            (rx, oy), (rx + p.span_right_mm, oy),
            (rx + p.span_right_mm, oy + p.beam_depth_mm), (rx, oy + p.beam_depth_mm), (rx, oy)
        ], layer="CONCRETE")

        # Column vertical bars (continuous through junction — Clause 4.5.1)
        c = p.cover_mm
        cb_x1 = col_x + c + 10.0
        cb_x2 = col_x + p.col_width_mm - c - 10.0
        dxf.add_line((cb_x1, col_bot_y), (cb_x1, col_top_y), layer="REBAR_MAIN")
        dxf.add_line((cb_x2, col_bot_y), (cb_x2, col_top_y), layer="REBAR_MAIN")

        # Beam top bars (pass through column core)
        tb_y = oy + p.beam_depth_mm - c - 10.0
        dxf.add_line((ox + 50.0, tb_y), (rx + p.span_right_mm - 50.0, tb_y), layer="REBAR_MAIN")

        # Beam bottom bars (anchored into column or continuous)
        bb_y = oy + c + 10.0
        dxf.add_line((ox + 50.0, bb_y), (rx + p.span_right_mm - 50.0, bb_y), layer="REBAR_MAIN")

        # Containment column links within beam depth (Clause 4.5.2)
        # At least one containment link within junction
        dxf.add_line((cb_x1, oy + p.beam_depth_mm * 0.5), (cb_x2, oy + p.beam_depth_mm * 0.5), layer="REBAR_LINKS")

        # Beam shear links
        cur_x = col_x - 100.0
        while cur_x >= ox + 100.0:
            dxf.add_line((cur_x, bb_y), (cur_x, tb_y), layer="REBAR_LINKS")
            cur_x -= 150.0

        cur_x = rx + 100.0
        while cur_x <= rx + p.span_right_mm - 100.0:
            dxf.add_line((cur_x, bb_y), (cur_x, tb_y), layer="REBAR_LINKS")
            cur_x += 150.0

        # Annotations & Titles
        dxf.add_text("BEAM/COLUMN INTERSECTION — ELEVATION", (ox, col_top_y + 40.0), height=5.0, layer="ANNOTATIONS")
        AnnotationRenderer.add_rebar_callout(
            dxf, "Column bars continuous through junction",
            bar_point=(cb_x1, oy + p.beam_depth_mm * 0.7),
            text_pos=(cb_x1 - 250.0, oy + p.beam_depth_mm * 0.7 + 30.0)
        )

    def render_plan(self, dxf: DXFDocument, origin: Tuple[float, float] = (100.0, 100.0)) -> None:
        p = self.params
        ox, oy = origin
        col_x = ox + p.span_left_mm

        # Column outline in plan
        col_rect = [
            (col_x, oy),
            (col_x + p.col_width_mm, oy),
            (col_x + p.col_width_mm, oy + p.col_depth_mm),
            (col_x, oy + p.col_depth_mm),
            (col_x, oy)
        ]
        dxf.add_polyline(col_rect, layer="CONCRETE")

        # Hatch column section
        dxf.add_hatch(col_rect[:-1], pattern="ANSI31", scale=0.5, layer="HATCH")

        # Beams entering column
        beam_bot_y = oy + (p.col_depth_mm - p.beam_width_mm) / 2.0
        beam_top_y = beam_bot_y + p.beam_width_mm

        # Left beam
        dxf.add_line((ox, beam_bot_y), (col_x, beam_bot_y), layer="CONCRETE")
        dxf.add_line((ox, beam_top_y), (col_x, beam_top_y), layer="CONCRETE")

        # Right beam
        rx = col_x + p.col_width_mm
        dxf.add_line((rx, beam_bot_y), (rx + p.span_right_mm, beam_bot_y), layer="CONCRETE")
        dxf.add_line((rx, beam_top_y), (rx + p.span_right_mm, beam_top_y), layer="CONCRETE")

        # Column corner bars as circles
        c = p.cover_mm
        r = p.col_bar_dia_mm / 2.0
        corners = [
            (col_x + c + r, oy + c + r),
            (col_x + p.col_width_mm - c - r, oy + c + r),
            (col_x + p.col_width_mm - c - r, oy + p.col_depth_mm - c - r),
            (col_x + c + r, oy + p.col_depth_mm - c - r),
        ]
        for cx, cy in corners:
            dxf.add_circle((cx, cy), radius=r, layer="REBAR_MAIN")
            dxf.add_circle((cx, cy), radius=r * 0.4, layer="REBAR_MAIN")  # Dot for bar from below

        dxf.add_text("BEAM/COLUMN INTERSECTION — PLAN AT BEAM LEVEL", (ox, oy + p.col_depth_mm + 40.0), height=4.0, layer="ANNOTATIONS")
