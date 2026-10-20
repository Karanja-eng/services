"""
Staircase Detailing Generator.
Implements IStructE Standard Method of Detailing Section 6.8 (Stairs: MST1, MST2).
Covers:
  - End-supported flights with landings (MST1, Model Detail, p.127)
  - Cantilever flights from wall/edge beam (MST2, p.128)
  - Landing-recess alternative (Fig 6.33, p.124)

Rules sourced from: files (10)/03_detailing_rules.json S01–S11.
Provenance preserved per source rule ids.
Units: mm throughout. Drawing scale 1:1 model space (mm).
"""

from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any

from ..core.model import Member, MemberType, BarGroup, Rebar, LayerType
from ..core.reinforcement import (
    table_anchorage_length,
    table_lap_length,
    stair_a_dimension,
    BarAreaCalculator,
)
from ..drawing.dxf import DXFDocument
from ..drawing.annotations import AnnotationRenderer
from ..drawing.dimensions import DimensionRenderer


# ---------------------------------------------------------------------------
# Engineering Model — End-Supported Stair (MST1)
# ---------------------------------------------------------------------------

@dataclass
class StairParams:
    """
    Input parameters for an in-situ RC staircase flight.
    Supports both MST1 (end-supported) and MST2 (cantilever) types.
    Rule S01: scope = suspended in-situ RC flights and half landings.
    """
    stair_type: str = "MST1"           # "MST1" or "MST2"

    # Geometry
    going_mm: float = 250.0            # Tread going dimension
    rise_mm: float = 175.0             # Riser height
    n_steps: int = 12                  # Number of steps in flight
    waist_mm: float = 200.0            # Structural throat thickness (perpendicular to soffit)
    landing_length_mm: float = 1000.0  # Length of each landing

    # Materials
    concrete_grade: str = "30/37"      # Rule S01: normally 30/37
    exposure: str = "internal"         # "internal" or "external"
    dcdev_mm: float = 10.0             # From §5.2.1 (General chapter)

    # Main bottom reinforcement
    main_dia_mm: int = 12
    main_pitch_mm: float = 150.0

    # Distribution bars
    distribution_dia_mm: int = 10
    distribution_pitch_mm: float = 300.0

    # MST2-specific (cantilever)
    link_dia_mm: int = 8               # H8 cantilever links (Rule S09)
    link_pitch_mm: float = 300.0       # Rule S09: H8@300 unless specified

    bond: str = "good"

    # Optional override
    cover_mm: Optional[float] = None


@dataclass
class StairEngineeringModel:
    """Engineering sizing and detailing results for RC staircase."""

    params: StairParams
    member_type: MemberType
    cover_mm: float
    run_mm: float                  # Horizontal plan run of flight
    rise_total_mm: float           # Total vertical rise of flight
    slope_length_mm: float         # Inclined length of slab along soffit
    span_mm: float                 # Effective design span (landing to landing)
    anchorage_length_mm: float     # lbd for main bar (good or poor bond)
    A_extension_mm: float          # MST1: max(0.1*span, lbd, 500) per Rule S07
    As_min_mm2_per_m: float        # As,min per Rule S04
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create_model(cls, p: StairParams) -> "StairEngineeringModel":
        warnings: List[str] = []
        meta: Dict[str, Any] = {}

        # Cover (Rule S02 / S03)
        if p.cover_mm is not None:
            cover = p.cover_mm
        elif p.exposure == "internal":
            cover = max(20.0, float(p.main_dia_mm))   # Rule S03: min 20 or bar size
        else:
            cover = 40.0   # Rule S03: standard 40 external

        # Geometry
        run = float(p.going_mm * p.n_steps)
        rise_total = float(p.rise_mm * p.n_steps)
        slope_len = math.hypot(run, rise_total)

        if p.stair_type == "MST1":
            span = p.landing_length_mm + run + p.landing_length_mm
        else:  # MST2 cantilever: effective span = run only
            span = run

        # Anchorage length (Table 6.11, Rule S06)
        lbd = table_anchorage_length(p.main_dia_mm, p.concrete_grade, "stairs", p.bond)

        # MST1: 'A' extension (Rule S07, VC V6)
        A = stair_a_dimension(span, lbd) if p.stair_type == "MST1" else 0.0

        # As,min per Rule S04: max(0.26*bt*d*fctm/fyk, 0.0013*bt*d)
        # For 30/37, fyk=500: 0.0015 * bt * d (Rule S04 statement)
        d_eff = p.waist_mm - cover - p.main_dia_mm / 2.0
        As_min = 0.0015 * 1000.0 * d_eff   # per m, 30/37 fyk 500

        # Pitch checks (Rule S05)
        h = p.waist_mm
        max_pitch_main = min(3.0 * h, 400.0)
        if p.main_pitch_mm > max_pitch_main:
            warnings.append(
                f"Main bar pitch {p.main_pitch_mm}mm > max(3h=3*{h}, 400) = {max_pitch_main}mm [Rule S05]."
            )
        max_pitch_distrib = min(3.5 * h, 450.0)
        if p.distribution_pitch_mm > max_pitch_distrib:
            warnings.append(
                f"Distribution bar pitch {p.distribution_pitch_mm}mm > max(3.5h, 450) = {max_pitch_distrib}mm [Rule S05]."
            )

        # Minimum pitch check (Rule S05)
        if p.main_pitch_mm < 75.0:
            warnings.append(f"Main bar pitch {p.main_pitch_mm}mm < 75mm minimum [Rule S05].")

        # U-bar area = 50% main bottom steel at landing (Rule S07)
        As_main = BarAreaCalculator.area_per_metre(p.main_dia_mm, p.main_pitch_mm)
        u_bar_area_per_m = 0.5 * As_main

        meta["cover_mm"] = cover
        meta["run_mm"] = run
        meta["rise_total_mm"] = rise_total
        meta["slope_length_mm"] = slope_len
        meta["span_mm"] = span
        meta["lbd_mm"] = lbd
        meta["A_extension_mm"] = A
        meta["As_min_mm2_per_m"] = As_min
        meta["As_main_mm2_per_m"] = As_main
        meta["u_bar_area_per_m_mm2"] = u_bar_area_per_m
        meta["d_eff_mm"] = d_eff

        return cls(
            params=p,
            member_type=MemberType.STAIR if hasattr(MemberType, "STAIR") else MemberType.SLAB,
            cover_mm=cover,
            run_mm=run,
            rise_total_mm=rise_total,
            slope_length_mm=slope_len,
            span_mm=span,
            anchorage_length_mm=lbd,
            A_extension_mm=A,
            As_min_mm2_per_m=As_min,
            warnings=warnings,
            metadata=meta,
        )


# ---------------------------------------------------------------------------
# Drawing Renderer — End-Supported Stair (MST1)
# ---------------------------------------------------------------------------

class StairDrawingRenderer:
    """Renders CAD detail for stair flights (MST1 end-supported and MST2 cantilever)."""

    @staticmethod
    def render_mst1_section(
        model: StairEngineeringModel,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (50.0, 100.0),
    ) -> None:
        """
        Longitudinal section of end-supported staircase flight (MST1, p.127).
        Draws soffit line, stepped upper surface, main bottom bars, landing U-bars,
        and annotates 'A' extension and compression lap at landing.
        Rule S07: U-bars = 50% As(bottom); A = max(0.1*span, lbd, 500).
        Rule S09 / S04: distribution bars.
        """
        p = model.params
        ox, oy = origin
        c = model.cover_mm
        going = p.going_mm
        rise = p.rise_mm
        n = p.n_steps
        waist = p.waist_mm
        run = model.run_mm
        rise_t = model.rise_total_mm
        landing = p.landing_length_mm
        A = model.A_extension_mm

        # Soffit outline points (soffit at bottom, top surface above waist)
        # Soffit: flat landing -> inclined flight -> flat landing
        soff_pts = [
            (ox, oy),
            (ox + landing, oy),
            (ox + landing + run, oy + rise_t),
            (ox + landing + run + landing, oy + rise_t),
        ]
        # Top surface (parallel to soffit + waist thickness)
        top_pts = [(x, y + waist) for x, y in soff_pts]

        dxf.add_polyline(soff_pts, layer="CONCRETE")
        dxf.add_polyline(top_pts, layer="CONCRETE")

        # Steps (treads and risers)
        for i in range(n):
            x0 = ox + landing + i * going
            y0 = oy + waist + i * rise
            dxf.add_polyline(
                [(x0, y0), (x0, y0 + rise), (x0 + going, y0 + rise)],
                layer="CONCRETE",
            )

        # Main bottom bars (following soffit at cover depth)
        bar_soff = [(x, y + c) for x, y in soff_pts]
        dxf.add_polyline(bar_soff, layer="REBAR_BOT")

        # Landing U-bars at top, extending A into span (Rule S07)
        # Left landing U-bar: from span start - A
        u_y_left = oy + waist - c
        dxf.add_line(
            (ox + landing - A - c, u_y_left),
            (ox + landing - c, u_y_left),
            layer="REBAR_TOP",
        )
        # Right landing U-bar
        u_y_right = oy + rise_t + waist - c
        dxf.add_line(
            (ox + landing + run + c, u_y_right),
            (ox + landing + run + A + c, u_y_right),
            layer="REBAR_TOP",
        )

        # Distribution bars (transverse): shown as dashed dots
        n_distrib = int(model.slope_length_mm // p.distribution_pitch_mm)
        for i in range(n_distrib):
            t_frac = (i + 0.5) / max(n_distrib, 1)
            x_d = ox + landing + t_frac * run
            y_d = oy + t_frac * rise_t + c
            dxf.add_circle((x_d, y_d), p.distribution_dia_mm / 2.0, layer="HIDDEN")

        # Annotations
        dxf.add_text(
            f"'A' = max(0.1×span, lbd, 500) = {A:.0f}mm [Rule S07]",
            (ox + landing + run / 2.0 + 80.0, oy + rise_t / 2.0 + 50.0),
            height=2.5,
            layer="ANNOTATIONS",
        )
        dxf.add_text(
            f"U-bars = 50% As(bottom) at landings [Rule S07]",
            (ox + landing + run / 2.0 + 80.0, oy + rise_t / 2.0 + 20.0),
            height=2.5,
            layer="ANNOTATIONS",
        )
        dxf.add_text(
            f"Main: H{p.main_dia_mm}@{p.main_pitch_mm:.0f}mm B; Distribution: H{p.distribution_dia_mm}@{p.distribution_pitch_mm:.0f}mm [Rule S04/S05]",
            (ox, oy - 60.0),
            height=2.5,
            layer="ANNOTATIONS",
        )
        dxf.add_text(
            f"Cover {c:.0f}mm [Rule S03]; Waist {waist:.0f}mm",
            (ox, oy - 90.0),
            height=2.5,
            layer="ANNOTATIONS",
        )
        dxf.add_text(
            f"Grade {p.concrete_grade}; lbd = {model.anchorage_length_mm:.0f}mm [Table 6.11, Rule S06]",
            (ox, oy - 120.0),
            height=2.5,
            layer="ANNOTATIONS",
        )

        # Dimensions
        DimensionRenderer.render_linear_dimension_h(
            dxf, (ox + landing, oy), (ox + landing + run, oy), offset=-180.0, text=f"{run:.0f}"
        )
        DimensionRenderer.render_linear_dimension_h(
            dxf, (ox, oy), (ox + landing, oy), offset=-140.0, text=f"{landing:.0f}"
        )
        DimensionRenderer.render_aligned_dimension(
            dxf, (ox + landing + run + landing, oy), (ox + landing + run + landing, oy + rise_t),
            offset=100.0, text=f"{rise_t:.0f}",
        )

        dxf.add_text("STAIR LONGITUDINAL SECTION (MST1)", (ox + landing / 2.0, oy - 200.0), height=3.5, layer="ANNOTATIONS")

    @staticmethod
    def render_mst2_section(
        model: StairEngineeringModel,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (50.0, 100.0),
    ) -> None:
        """
        Section A-A of cantilever stair flight from spine wall/edge beam (MST2, p.128).
        Rule S09: H8@300 linking bars, H10@300 distribution, tension anchorage into wall.
        """
        p = model.params
        ox, oy = origin
        c = model.cover_mm
        going = p.going_mm
        rise = p.rise_mm
        n = p.n_steps
        waist = p.waist_mm
        run = model.run_mm
        rise_t = model.rise_total_mm

        # Spine wall (shown schematically on left)
        wall_w = 200.0
        dxf.add_polyline(
            [(ox - wall_w, oy - 100.0), (ox, oy - 100.0), (ox, oy + rise_t + waist + 200.0), (ox - wall_w, oy + rise_t + waist + 200.0)],
            layer="CONCRETE",
            is_closed=True,
        )
        dxf.add_text("SPINE WALL", (ox - wall_w - 80.0, oy + rise_t / 2.0), height=2.5, layer="ANNOTATIONS")

        # Soffit of flight (cantilever from wall)
        soff_pts = [(ox, oy), (ox + run, oy + rise_t)]
        top_pts = [(x, y + waist) for x, y in soff_pts]
        dxf.add_polyline(soff_pts, layer="CONCRETE")
        dxf.add_polyline(top_pts, layer="CONCRETE")

        # Steps
        for i in range(n):
            x0 = ox + i * going
            y0 = oy + waist + i * rise
            dxf.add_polyline(
                [(x0, y0), (x0, y0 + rise), (x0 + going, y0 + rise)],
                layer="CONCRETE",
            )

        # Main cantilever bars (top, anchored into wall)
        bar_y = oy + waist - c
        anch = model.anchorage_length_mm
        dxf.add_line((ox - anch, bar_y), (ox + run - c, bar_y), layer="REBAR_TOP")
        dxf.add_text(
            f"Tension anchorage {anch:.0f}mm into wall [Rule S09]",
            (ox - anch + 10.0, bar_y + 15.0),
            height=2.5,
            layer="ANNOTATIONS",
        )

        # Linking bars (H8@300 Rule S09)
        n_links = int(run // p.link_pitch_mm)
        for i in range(n_links):
            x_l = ox + (i + 0.5) * p.link_pitch_mm
            y_l0 = ox  # use ox as incline fraction proxy
            t = (i + 0.5) * p.link_pitch_mm / run if run > 0 else 0
            y_l_bot = oy + t * rise_t + c
            y_l_top = oy + t * rise_t + waist - c
            dxf.add_line((x_l, y_l_bot), (x_l, y_l_top), layer="REBAR_LINKS")

        # Distribution bars H10@300
        n_d = int(run // p.distribution_pitch_mm)
        for i in range(n_d):
            t = (i + 0.5) / max(n_d, 1)
            x_d = ox + t * run
            y_d = oy + t * rise_t + c
            dxf.add_circle((x_d, y_d), p.distribution_dia_mm / 2.0, layer="HIDDEN")

        # Annotations
        dxf.add_text(
            f"Links: H{p.link_dia_mm}@{p.link_pitch_mm:.0f} per tread [Rule S09]",
            (ox + run + 40.0, oy + rise_t / 2.0 + 30.0),
            height=2.5,
            layer="ANNOTATIONS",
        )
        dxf.add_text(
            f"Distribution: H{p.distribution_dia_mm}@{p.distribution_pitch_mm:.0f} [Rule S09]",
            (ox + run + 40.0, oy + rise_t / 2.0),
            height=2.5,
            layer="ANNOTATIONS",
        )
        dxf.add_text(
            f"Cover {c:.0f}mm [Rule S03]",
            (ox, oy - 60.0),
            height=2.5,
            layer="ANNOTATIONS",
        )

        DimensionRenderer.render_linear_dimension_h(
            dxf, (ox, oy - 50.0), (ox + run, oy - 50.0), offset=-100.0, text=f"{run:.0f}"
        )
        DimensionRenderer.render_aligned_dimension(
            dxf, (ox + run, oy), (ox + run, oy + rise_t), offset=100.0, text=f"{rise_t:.0f}"
        )

        dxf.add_text("CANTILEVER STAIR SECTION A-A (MST2)", (ox, oy - 200.0), height=3.5, layer="ANNOTATIONS")
