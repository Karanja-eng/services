"""
Nib Detailing Generator (IStructE Section 6.9, Model Details MN1 & MN2).
Supports shallow continuous nibs (depth <= 300mm) and deep nibs with RuleEngine verification.
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
class NibGeometry:
    """Parameters for RC Nib detailing per Section 6.9."""
    h_nib_mm: float = 250.0              # Nib depth (<= 300mm for MN1 shallow nib)
    b_nib_mm: float = 200.0              # Nib horizontal projection
    b_beam_mm: float = 350.0             # Supporting beam width
    h_beam_mm: float = 600.0             # Supporting beam depth
    F_Ed_per_m_kN: float = 80.0          # Line load per metre
    loop_bar_dia_mm: int = 12            # Closed U-link diameter in nib
    loop_pitch_mm: float = 150.0         # Link pitch
    lacer_dia_mm: int = 12               # Longitudinal corner/lacer bar diameter
    n_lacers: int = 3                    # Number of longitudinal bars in nib
    cover_mm: float = 30.0               # Nominal cover


class NibDetailGenerator:
    """Validates constraints and renders MN1 / MN2 to DXF."""

    def __init__(self, geom: NibGeometry, rule_engine: Optional[RuleEngine] = None):
        self.geom = geom
        self.rule_engine = rule_engine or RuleEngine()
        self._register_rules()

    def _register_rules(self) -> None:
        g = self.geom
        # 1. Model Detail applicability
        if g.h_nib_mm <= 300.0:
            # Model Detail MN1 shallow continuous nib
            pass
        else:
            # Heavy nib: MN2
            self.rule_engine.check_recommended(
                "NIB_DEPTH_HEAVY",
                g.h_nib_mm <= 300.0,
                f"Nib depth ({g.h_nib_mm}mm) > 300mm; governed by Model Detail MN2 (heavy nib).",
                "IStructE §6.9 Model Detail MN1/MN2"
            )

        # 2. Longitudinal lacer bars at least 2 in nib nose
        self.rule_engine.check_mandatory(
            "NIB_LACER_COUNT",
            g.n_lacers >= 2,
            f"Nib has {g.n_lacers} longitudinal lacer bars; minimum required is 2.",
            "IStructE §6.9 Model Detail MN1",
            FactType.DIRECTLY_STATED
        )

    def render_dxf(self, dxf: DXFDocument, origin: Tuple[float, float] = (100.0, 200.0)) -> None:
        g = self.geom
        ox, oy = origin

        # Supporting beam profile with continuous projecting nib at bottom right
        poly = [
            (ox, oy),                                       # Beam bottom left
            (ox + g.b_beam_mm + g.b_nib_mm, oy),             # Nib bottom outer tip
            (ox + g.b_beam_mm + g.b_nib_mm, oy + g.h_nib_mm),# Nib top
            (ox + g.b_beam_mm, oy + g.h_nib_mm),             # Re-entrant corner at beam face
            (ox + g.b_beam_mm, oy + g.h_beam_mm),            # Beam top right
            (ox, oy + g.h_beam_mm),                          # Beam top left
            (ox, oy)
        ]
        dxf.add_polyline(poly, layer="CONCRETE")

        c = g.cover_mm

        # Nib U-shaped link (Shape 21 or open loop returned into beam)
        loop_bot_y = oy + c
        loop_top_y = oy + g.h_nib_mm - c
        loop_tip_x = ox + g.b_beam_mm + g.b_nib_mm - c
        loop_root_x = ox + c + 50.0  # Anchored deep into beam core

        dxf.add_polyline([
            (loop_root_x, loop_top_y),
            (loop_tip_x, loop_top_y),
            (loop_tip_x, loop_bot_y),
            (loop_root_x, loop_bot_y),
        ], layer="REBAR_MAIN")

        # Longitudinal lacer bars (dots/circles in corners of nib)
        lr = g.lacer_dia_mm / 2.0
        lacer_pts = [
            (loop_tip_x - lr - 2.0, loop_bot_y + lr + 2.0),
            (loop_tip_x - lr - 2.0, loop_top_y - lr - 2.0),
            (ox + g.b_beam_mm + lr + 5.0, loop_bot_y + lr + 2.0),
        ]
        for lx, ly in lacer_pts[:g.n_lacers]:
            dxf.add_circle((lx, ly), radius=lr, layer="REBAR_LACER")

        # Beam main links
        dxf.add_polyline([
            (ox + c, oy + c),
            (ox + g.b_beam_mm - c, oy + c),
            (ox + g.b_beam_mm - c, oy + g.h_beam_mm - c),
            (ox + c, oy + g.h_beam_mm - c),
            (ox + c, oy + c)
        ], layer="REBAR_LINKS")

        # Dimensions
        DimensionRenderer.add_dimension(dxf, (ox + g.b_beam_mm, oy - 30.0), (ox + g.b_beam_mm + g.b_nib_mm, oy - 30.0), offset=-15.0, text=f"b={int(g.b_nib_mm)}")
        DimensionRenderer.add_dimension(dxf, (ox + g.b_beam_mm + g.b_nib_mm + 25.0, oy), (ox + g.b_beam_mm + g.b_nib_mm + 25.0, oy + g.h_nib_mm), offset=15.0, text=f"h={int(g.h_nib_mm)}")

        # Title
        dxf.add_text("MODEL DETAIL MN1 — CONTINUOUS SHALLOW NIB", (ox, oy + g.h_beam_mm + 30.0), height=5.0, layer="ANNOTATIONS")
