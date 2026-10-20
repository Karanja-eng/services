"""
Column detailing generator (IStructE Chapter 6.4, Figures 6.24–6.27).
Returns an engineering Member model first, with decoupled DXF drawing rendering.
Consumes shared BS 8666, cover, spacing, and lap calculations.
"""

import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from ..core.model import Member, MemberType, BarGroup, Rebar, LayerType, Support, SupportType, Zone
from ..core.reinforcement import BarAreaCalculator, AnchorageCalculator, LapCalculator, CoverCalculator, TableB1
from ..drawing.dxf import DXFDocument
from ..drawing.dimensions import DimensionRenderer
from ..drawing.annotations import AnnotationRenderer


@dataclass
class ColumnParams:
    """Parameters for rectangular in-situ RC column detailing."""
    width_mm: float = 400.0
    depth_mm: float = 400.0
    height_mm: float = 3500.0
    cover_nominal_mm: float = 35.0  # EC2 Table 6.3
    fck_MPa: float = 35.0
    fyk_MPa: float = 500.0
    bar_dia_mm: int = 25
    bar_count: int = 4  # Corner bars
    link_dia_mm: int = 10
    link_pitch_standard_mm: float = 200.0
    # EC2 §9.5.3: Link spacing in lap zone reduced by 0.6 factor: s_cl,tmax = min(12*dia, 0.6*b, 240)
    link_pitch_lap_mm: float = 120.0
    lap_length_mm: Optional[float] = None
    crank_slope: float = 0.1  # 1 in 10 crank slope
    # Recovered rules G1-G3 parameters
    intersecting_beam_fck_MPa: float = 30.0   # Rule G3: col fck <= 1.4 * beam/slab fck
    is_tension_bar: bool = False             # Rule G1: max spacing 175mm if in tension
    aggregate_size_dg_mm: float = 20.0        # Rule G2: dg+5mm clear spacing check


class ColumnEngineeringModel:
    """Computes column reinforcement, links, laps, and produces Member model."""

    @staticmethod
    def create_model(params: ColumnParams) -> Member:
        p = params
        ac = p.width_mm * p.depth_mm

        # Minimum reinforcement (EC2 Eq 9.12N): As_min = 0.10 * NEd / fyd >= 0.002 * Ac
        as_min = 0.002 * ac
        as_max = 0.04 * ac  # 0.08 at laps
        as_provided = BarAreaCalculator.group_area(p.bar_dia_mm, p.bar_count)

        # Rule G1: Maximum bar spacing in column
        # Compression max spacing: 300mm (or min(width, depth)); Tension max spacing: 175mm
        max_spacing_allowed = 175.0 if p.is_tension_bar else 300.0
        # For 4 corner bars in rectangular column:
        bar_spacing_x = p.width_mm - 2 * p.cover_nominal_mm - 2 * p.link_dia_mm - p.bar_dia_mm
        bar_spacing_y = p.depth_mm - 2 * p.cover_nominal_mm - 2 * p.link_dia_mm - p.bar_dia_mm
        max_spacing_actual = max(bar_spacing_x, bar_spacing_y)
        tension_spacing_compliant = max_spacing_actual <= max_spacing_allowed if p.is_tension_bar else True

        # Rule G2: Spacing allowance for >= 32mm bars at laps
        # At laps, clear spacing between pairs of lapping bars must be >= max(bar_dia, dg+5mm, 20mm)
        min_clear_spacing_required = max(float(p.bar_dia_mm), p.aggregate_size_dg_mm + 5.0, 20.0)
        lapping_spacing_compliant = True
        if p.bar_dia_mm >= 32:
            # Clear space between corner bars minus one lapped bar diameter
            clear_between_bars = min(bar_spacing_x, bar_spacing_y) - p.bar_dia_mm
            lapping_spacing_compliant = clear_between_bars >= min_clear_spacing_required

        # Rule G3: Concrete grade cap check: col_fck <= 1.4 * beam_fck
        grade_ratio = p.fck_MPa / p.intersecting_beam_fck_MPa
        grade_cap_compliant = grade_ratio <= 1.40 + 1e-3

        # Fire spalling check (Rule A7 / Section 6.4.2)
        fire_spalling_req, fire_spalling_msg = CoverCalculator.fire_spalling_check(
            nominal_cover_outer=p.cover_nominal_mm,
            link_dia=p.link_dia_mm,
            main_bar_dia=p.bar_dia_mm
        )

        # Lap length
        l_0 = p.lap_length_mm if p.lap_length_mm else LapCalculator.design_lap_length(
            p.bar_dia_mm, fck=p.fck_MPa, fyk=p.fyk_MPa, is_compression=True
        )

        # Longitudinal main bars (starter bars + main bars)
        # Total bar length = column height + lap length into upper storey
        total_bar_len = p.height_mm + l_0
        col_rebar = Rebar(
            bar_mark="01",
            shape_code="00",  # Or cranked shape
            bar_size=p.bar_dia_mm,
            dimensions={"A": total_bar_len},
            length_mm=total_bar_len,
            layer=LayerType.INTERNAL,
            weight_kg=BarAreaCalculator.total_weight_kg(p.bar_dia_mm, total_bar_len)
        )
        col_group = BarGroup(
            group_id="BG_COL_MAIN",
            rebar=col_rebar,
            count=p.bar_count,
            layer=LayerType.INTERNAL
        )

        # Links (Shape 51)
        link_A = p.depth_mm - 2 * p.cover_nominal_mm
        link_B = p.width_mm - 2 * p.cover_nominal_mm
        link_rebar = Rebar(
            bar_mark="02",
            shape_code="51",
            bar_size=p.link_dia_mm,
            dimensions={"A": link_A, "B": link_B, "C": 100.0},
            length_mm=2 * link_A + 2 * link_B + 150.0,
            layer=LayerType.LINK,
            weight_kg=BarAreaCalculator.total_weight_kg(p.link_dia_mm, 2 * link_A + 2 * link_B + 150.0)
        )

        # Dense link zones at base and top (EC2 Fig 6.24 & 6.25)
        # Lap zone height = l_0
        n_lap_links = int(math.ceil(l_0 / p.link_pitch_lap_mm))
        mid_h = p.height_mm - l_0
        n_mid_links = int(math.ceil(mid_h / p.link_pitch_standard_mm))

        link_group_lap = BarGroup(
            group_id="BG_COL_LINKS_LAP",
            rebar=link_rebar,
            count=n_lap_links,
            pitch_mm=p.link_pitch_lap_mm,
            layer=LayerType.LINK
        )
        link_group_mid = BarGroup(
            group_id="BG_COL_LINKS_MID",
            rebar=link_rebar,
            count=n_mid_links,
            pitch_mm=p.link_pitch_standard_mm,
            layer=LayerType.LINK
        )

        member = Member(
            member_id="COL_01",
            member_type=MemberType.COLUMN,
            name="In-situ Column",
            concrete_grade=f"C{int(p.fck_MPa)}/{int(p.fck_MPa*1.25)}",
            cover_nominal_mm=p.cover_nominal_mm,
            dimensions={
                "width": p.width_mm,
                "depth": p.depth_mm,
                "height": p.height_mm,
                "lap_length": l_0,
            },
            bar_groups=[col_group, link_group_lap, link_group_mid],
            supports=[
                Support("SUP_FOUNDATION", SupportType.FOUNDATION, 0.0, 0.0, p.width_mm, p.depth_mm)
            ],
            zones=[
                Zone("Z_LAP", "LAP_BURSTING", 0.0, l_0, properties={"pitch": p.link_pitch_lap_mm}),
                Zone("Z_MID", "STANDARD", l_0, p.height_mm, properties={"pitch": p.link_pitch_standard_mm}),
            ],
            metadata={
                "As_min_mm2": as_min,
                "As_provided_mm2": as_provided,
                "As_max_mm2": as_max,
                "tension_spacing_compliant": tension_spacing_compliant,
                "lapping_spacing_compliant": lapping_spacing_compliant,
                "grade_cap_compliant": grade_cap_compliant,
                "grade_ratio": grade_ratio,
                "fire_spalling_mesh_required": fire_spalling_req,
                "fire_spalling_message": fire_spalling_msg,
            }
        )
        return member


class ColumnDrawingRenderer:
    """Renders a Column engineering model to DXF."""

    @staticmethod
    def render_elevation(
        member: Member,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (500.0, 200.0),
    ) -> None:
        dims = member.dimensions
        w = dims["width"]
        h = dims["height"]
        l_0 = dims["lap_length"]
        c = member.cover_nominal_mm
        ox, oy = origin

        # Concrete outline
        dxf.add_polyline([
            (ox, oy), (ox + w, oy), (ox + w, oy + h), (ox, oy + h), (ox, oy)
        ], layer="CONCRETE")

        # Floor slab line at base and top
        dxf.add_line((ox - 150.0, oy), (ox + w + 150.0, oy), layer="CONCRETE")
        dxf.add_line((ox - 150.0, oy + h), (ox + w + 150.0, oy + h), layer="CONCRETE")

        # Longitudinal bars
        bx1 = ox + c + 10.0
        bx2 = ox + w - c - 10.0
        dxf.add_line((bx1, oy - 200.0), (bx1, oy + h + l_0), layer="REBAR_MAIN")
        dxf.add_line((bx2, oy - 200.0), (bx2, oy + h + l_0), layer="REBAR_MAIN")

        # Links in lap zone (base)
        cur_y = oy
        while cur_y <= oy + l_0:
            dxf.add_line((bx1, cur_y), (bx2, cur_y), layer="REBAR_LINKS")
            cur_y += 120.0

        # Links in standard zone
        while cur_y <= oy + h:
            dxf.add_line((bx1, cur_y), (bx2, cur_y), layer="REBAR_LINKS")
            cur_y += 200.0

        # Dimensions
        DimensionRenderer.add_dimension(dxf, (ox, oy - 40.0), (ox + w, oy - 40.0), offset=-20.0, text=f"{int(w)}")
        DimensionRenderer.add_dimension(dxf, (ox - 30.0, oy), (ox - 30.0, oy + h), offset=-30.0, text=f"{int(h)}")

        # Callouts
        main_bg = next((bg for bg in member.bar_groups if bg.group_id == "BG_COL_MAIN"), None)
        if main_bg:
            AnnotationRenderer.add_rebar_callout(
                dxf, main_bg.rebar.formatted_callout(main_bg.count),
                bar_point=(bx1, oy + h / 2.0),
                text_pos=(bx1 - 120.0, oy + h / 2.0)
            )

        dxf.add_text(f"{member.name} — ELEVATION", (ox, oy + h + l_0 + 30.0), height=5.0, layer="ANNOTATIONS")

    @staticmethod
    def render_section(
        member: Member,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (500.0, 50.0),
    ) -> None:
        dims = member.dimensions
        w = dims["width"]
        d = dims["depth"]
        c = member.cover_nominal_mm
        ox, oy = origin

        # Concrete outline
        dxf.add_polyline([(ox, oy), (ox + w, oy), (ox + w, oy + d), (ox, oy + d), (ox, oy)], layer="CONCRETE")

        # Outer link
        lx1 = ox + c
        ly1 = oy + c
        lx2 = ox + w - c
        ly2 = oy + d - c
        dxf.add_polyline([(lx1, ly1), (lx2, ly1), (lx2, ly2), (lx1, ly2), (lx1, ly1)], layer="REBAR_LINKS")

        # Corner bars
        main_bg = next((bg for bg in member.bar_groups if bg.group_id == "BG_COL_MAIN"), None)
        dia = main_bg.rebar.bar_size if main_bg else 25
        r = dia / 2.0
        corners = [
            (lx1 + r, ly1 + r),
            (lx2 - r, ly1 + r),
            (lx2 - r, ly2 - r),
            (lx1 + r, ly2 - r),
        ]
        for cx, cy in corners:
            dxf.add_circle((cx, cy), radius=r, layer="REBAR_MAIN")

        # Dimensions
        DimensionRenderer.add_dimension(dxf, (ox, oy - 20.0), (ox + w, oy - 20.0), offset=-15.0, text=f"{int(w)}")
        DimensionRenderer.add_dimension(dxf, (ox - 20.0, oy), (ox - 20.0, oy + d), offset=-15.0, text=f"{int(d)}")
        dxf.add_text("COLUMN SECTION B-B", (ox, oy + d + 20.0), height=4.0, layer="ANNOTATIONS")
