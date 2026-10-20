"""
Beam detailing generator (IStructE Chapter 6.3, Model Details MB1–MB3).
Returns an engineering Member model first, with drawing rendering fully decoupled.
Consumes shared BS 8666, cover, spacing, and lap calculations.
"""

import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from ..core.model import Member, MemberType, BarGroup, Rebar, LayerType, Support, SupportType, Zone
from ..core.reinforcement import (
    BarAreaCalculator,
    AnchorageCalculator,
    LapCalculator,
    CoverCalculator,
    TableB1,
    is_wide_beam_corbel_triggered,
)
from ..drawing.dxf import DXFDocument
from ..drawing.dimensions import DimensionRenderer
from ..drawing.annotations import AnnotationRenderer


@dataclass
class BeamParams:
    """Input parameters for suspended continuous or simple beam (Model Detail MB1)."""
    span_clear_mm: float = 6000.0
    width_mm: float = 300.0
    depth_mm: float = 600.0
    column_width_mm: float = 350.0       # Intersecting column width for corbel trigger check
    support_left_width_mm: float = 350.0
    support_right_width_mm: float = 350.0
    cover_nominal_mm: float = 30.0  # EC2 Table 6.2
    fck_MPa: float = 30.0
    fyk_MPa: float = 500.0
    # Bottom reinforcement
    bot_bar_count: int = 4
    bot_bar_dia_mm: int = 25
    is_end_bay: bool = True              # Rule F8: end bay vs internal bay curtailment
    # Top support reinforcement
    top_support_count: int = 4
    top_support_dia_mm: int = 20
    # Link hanger bars in span (Rule F7: min max(20% As_top, compression As), min 2 H16 for h >= 500)
    hanger_count: int = 2
    hanger_dia_mm: int = 16
    compression_steel_required_mm2: float = 0.0
    # Shear links
    link_dia_mm: int = 10
    link_pitch_support_mm: float = 125.0
    link_pitch_span_mm: float = 225.0
    link_dense_zone_len_mm: float = 1200.0  # ~ 0.2 * span or 2 * d
    # Flanged beam properties (Rule F4)
    is_flanged: bool = False
    flange_depth_mm: float = 0.0
    # Side face bars (crack control)
    side_bar_count: int = 0
    side_bar_dia_mm: int = 12
    # Curtailment parameter (Rule F5: default al = 1.25d)
    curtailment_al_mm: Optional[float] = None
    # Fire spalling check inputs (Rule F2)
    fire_rating_hours: float = 2.0


class BeamEngineeringModel:
    """Computes reinforcement, curtailment zones, links, and produces a Member model."""

    @staticmethod
    def create_model(params: BeamParams) -> Member:
        p = params
        d_eff = p.depth_mm - p.cover_nominal_mm - p.link_dia_mm - (p.bot_bar_dia_mm / 2.0)

        # Minimum tension reinforcement (EC2 Eq 9.1N): As_min = 0.26 * (fctm/fyk) * bt * d >= 0.0013 * bt * d
        fctm = 0.30 * (p.fck_MPa ** (2.0 / 3.0))
        as_min = max(0.26 * (fctm / p.fyk_MPa) * p.width_mm * d_eff, 0.0013 * p.width_mm * d_eff)
        as_provided = BarAreaCalculator.group_area(p.bot_bar_dia_mm, p.bot_bar_count)

        # Rule F1 / H9: Wide shallow beam corbel trigger check
        corbel_action_triggered = is_wide_beam_corbel_triggered(p.width_mm, p.column_width_mm, d_eff)

        # Rule F2 / A7: Fire spalling check
        fire_spalling_req, fire_spalling_msg = CoverCalculator.fire_spalling_check(
            nominal_cover_outer=p.cover_nominal_mm,
            link_dia=p.link_dia_mm,
            main_bar_dia=p.bot_bar_dia_mm
        )

        # Rule F5: Curtailment al default
        al_shift = p.curtailment_al_mm if p.curtailment_al_mm is not None else 1.25 * d_eff

        # Rule F7: Hanger bar calculation complete
        as_top_support = BarAreaCalculator.group_area(p.top_support_dia_mm, p.top_support_count)
        min_hanger_area = max(0.20 * as_top_support, p.compression_steel_required_mm2)
        # For beams h >= 500mm, minimum 2 H16 bars
        hanger_count = p.hanger_count
        hanger_dia = p.hanger_dia_mm
        if p.depth_mm >= 500.0:
            if hanger_dia < 16:
                hanger_dia = 16
            if hanger_count < 2:
                hanger_count = 2
        as_hanger_provided = BarAreaCalculator.group_area(hanger_dia, hanger_count)

        # Rule F4: Flanged beam transverse top flange minimum reinforcement
        as_min_flange_transverse = (
            0.0015 * p.flange_depth_mm * p.span_clear_mm
            if (p.is_flanged and p.flange_depth_mm > 0) else 0.0
        )

        # Auto-compute side face bars if depth > 750mm and not explicitly given
        side_count = p.side_bar_count
        if p.depth_mm > 750.0 and side_count == 0:
            side_count = 2  # At least one pair of side bars

        # Bottom bars: through to supports, anchored with L-bars or straight
        bot_len = p.span_clear_mm + (p.support_left_width_mm * 0.7) + (p.support_right_width_mm * 0.7)
        bot_rebar = Rebar(
            bar_mark="01",
            shape_code="11",
            bar_size=p.bot_bar_dia_mm,
            dimensions={"A": bot_len, "B": 250.0},
            length_mm=bot_len + 250.0,
            layer=LayerType.B1,
            weight_kg=BarAreaCalculator.total_weight_kg(p.bot_bar_dia_mm, bot_len + 250.0)
        )
        bot_group = BarGroup(
            group_id="BG_BEAM_BOT",
            rebar=bot_rebar,
            count=p.bot_bar_count,
            layer=LayerType.B1
        )

        # Top support bars (hogging moment) extending 0.3 * span into span
        top_len = (0.3 * p.span_clear_mm) + p.support_left_width_mm
        top_rebar = Rebar(
            bar_mark="02",
            shape_code="11",
            bar_size=p.top_support_dia_mm,
            dimensions={"A": top_len, "B": p.depth_mm - 2 * p.cover_nominal_mm},
            length_mm=top_len + (p.depth_mm - 2 * p.cover_nominal_mm),
            layer=LayerType.T1,
            weight_kg=BarAreaCalculator.total_weight_kg(p.top_support_dia_mm, top_len)
        )
        top_group_left = BarGroup(
            group_id="BG_TOP_SUP_LEFT",
            rebar=top_rebar,
            count=p.top_support_count,
            layer=LayerType.T1
        )

        # Top hanger bars across midspan
        hanger_len = p.span_clear_mm * 0.6
        hanger_rebar = Rebar(
            bar_mark="03",
            shape_code="00",
            bar_size=p.hanger_dia_mm,
            dimensions={"A": hanger_len},
            length_mm=hanger_len,
            layer=LayerType.T1,
            weight_kg=BarAreaCalculator.total_weight_kg(p.hanger_dia_mm, hanger_len)
        )
        hanger_group = BarGroup(
            group_id="BG_HANGER",
            rebar=hanger_rebar,
            count=p.hanger_count,
            layer=LayerType.T1
        )

        # Link calculation
        # Shape 51 closed link
        link_A = p.depth_mm - 2 * p.cover_nominal_mm
        link_B = p.width_mm - 2 * p.cover_nominal_mm
        link_rebar = Rebar(
            bar_mark="04",
            shape_code="51",
            bar_size=p.link_dia_mm,
            dimensions={"A": link_A, "B": link_B, "C": 100.0},
            length_mm=2 * link_A + 2 * link_B + 150.0,
            layer=LayerType.LINK,
            weight_kg=BarAreaCalculator.total_weight_kg(p.link_dia_mm, 2 * link_A + 2 * link_B + 150.0)
        )

        dense_len = p.link_dense_zone_len_mm
        mid_len = p.span_clear_mm - 2 * dense_len
        n_dense_left = int(math.ceil(dense_len / p.link_pitch_support_mm))
        n_mid = int(math.ceil(mid_len / p.link_pitch_span_mm))
        n_dense_right = n_dense_left

        link_group_left = BarGroup(
            group_id="BG_LINKS_LEFT",
            rebar=link_rebar,
            count=n_dense_left,
            pitch_mm=p.link_pitch_support_mm,
            layer=LayerType.LINK
        )
        link_group_mid = BarGroup(
            group_id="BG_LINKS_MID",
            rebar=link_rebar,
            count=n_mid,
            pitch_mm=p.link_pitch_span_mm,
            layer=LayerType.LINK
        )
        link_group_right = BarGroup(
            group_id="BG_LINKS_RIGHT",
            rebar=link_rebar,
            count=n_dense_right,
            pitch_mm=p.link_pitch_support_mm,
            layer=LayerType.LINK
        )

        all_groups = [bot_group, top_group_left, hanger_group, link_group_left, link_group_mid, link_group_right]

        member = Member(
            member_id="BEAM_01",
            member_type=MemberType.BEAM,
            name="Standard Suspended Beam (MB1)",
            concrete_grade=f"C{int(p.fck_MPa)}/{int(p.fck_MPa*1.25)}",
            cover_nominal_mm=p.cover_nominal_mm,
            dimensions={
                "span_clear": p.span_clear_mm,
                "width": p.width_mm,
                "depth": p.depth_mm,
                "support_left": p.support_left_width_mm,
                "support_right": p.support_right_width_mm,
            },
            bar_groups=all_groups,
            supports=[
                Support("SUP_COL_1", SupportType.COLUMN, 0.0, 0.0, p.support_left_width_mm),
                Support("SUP_COL_2", SupportType.COLUMN, p.span_clear_mm + p.support_left_width_mm, 0.0, p.support_right_width_mm),
            ],
            zones=[
                Zone("Z_LINK_1", "LINK_DENSE", 0.0, dense_len, properties={"pitch": p.link_pitch_support_mm}),
                Zone("Z_LINK_2", "LINK_NORMAL", dense_len, dense_len + mid_len, properties={"pitch": p.link_pitch_span_mm}),
                Zone("Z_LINK_3", "LINK_DENSE", dense_len + mid_len, p.span_clear_mm, properties={"pitch": p.link_pitch_support_mm}),
            ],
            metadata={
                "As_min_mm2": as_min,
                "As_provided_mm2": as_provided,
                "d_eff_mm": d_eff,
                "corbel_action_triggered": corbel_action_triggered,
                "fire_spalling_mesh_required": fire_spalling_req,
                "fire_spalling_message": fire_spalling_msg,
                "curtailment_al_shift_mm": al_shift,
                "hanger_area_min_required_mm2": min_hanger_area,
                "hanger_area_provided_mm2": as_hanger_provided,
                "flange_transverse_rebar_min_mm2": as_min_flange_transverse,
                "is_end_bay": p.is_end_bay,
            }
        )
        return member


class BeamDrawingRenderer:
    """Renders a Beam engineering model (elevation and sections) to DXF."""

    @staticmethod
    def render_elevation(
        member: Member,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (100.0, 400.0),
    ) -> None:
        dims = member.dimensions
        span = dims["span_clear"]
        w = dims["width"]
        d = dims["depth"]
        sw_l = dims["support_left"]
        sw_r = dims["support_right"]
        c = member.cover_nominal_mm

        ox, oy = origin

        # Concrete outline
        # Support left column
        dxf.add_polyline([
            (ox, oy - 300.0), (ox + sw_l, oy - 300.0),
            (ox + sw_l, oy), (ox, oy), (ox, oy - 300.0)
        ], layer="CONCRETE")

        # Beam outline
        total_len = sw_l + span + sw_r
        dxf.add_polyline([
            (ox, oy), (ox + total_len, oy),
            (ox + total_len, oy + d), (ox, oy + d), (ox, oy)
        ], layer="CONCRETE")

        # Support right column
        rx = ox + sw_l + span
        dxf.add_polyline([
            (rx, oy - 300.0), (rx + sw_r, oy - 300.0),
            (rx + sw_r, oy), (rx, oy), (rx, oy - 300.0)
        ], layer="CONCRETE")

        # Bottom bars (Shape 11 with end hooks)
        bx1 = ox + c
        bx2 = ox + total_len - c
        by = oy + c + 10.0  # cover + link dia
        dxf.add_line((bx1, by), (bx2, by), layer="REBAR_MAIN")
        dxf.add_line((bx1, by), (bx1, by + 200.0), layer="REBAR_MAIN")
        dxf.add_line((bx2, by), (bx2, by + 200.0), layer="REBAR_MAIN")

        # Top bars
        tx1 = ox + c
        tx2 = ox + total_len - c
        ty = oy + d - c - 10.0
        dxf.add_line((tx1, ty), (tx2, ty), layer="REBAR_MAIN")

        # Link zones representation
        link_y1 = by
        link_y2 = ty
        zones = member.zones
        for z in zones:
            zx1 = ox + sw_l + z.start_x
            zx2 = ox + sw_l + z.end_x
            pitch = z.properties.get("pitch", 200.0)
            cur_x = zx1
            while cur_x <= zx2:
                dxf.add_line((cur_x, link_y1), (cur_x, link_y2), layer="REBAR_LINKS")
                cur_x += pitch

        # Dimensions
        DimensionRenderer.add_dimension(dxf, (ox + sw_l, oy - 40.0), (ox + sw_l + span, oy - 40.0), offset=-30.0, text=f"{int(span)}")
        DimensionRenderer.add_dimension(dxf, (ox - 30.0, oy), (ox - 30.0, oy + d), offset=-25.0, text=f"{int(d)}")

        # Callouts
        for bg in member.bar_groups:
            if bg.group_id == "BG_BEAM_BOT":
                AnnotationRenderer.add_rebar_callout(
                    dxf, bg.rebar.formatted_callout(bg.count),
                    bar_point=(ox + sw_l + span / 2.0, by),
                    text_pos=(ox + sw_l + span / 2.0 - 50.0, by - 80.0)
                )

        dxf.add_text(f"{member.name} — ELEVATION", (ox, oy + d + 50.0), height=5.0, layer="ANNOTATIONS")

    @staticmethod
    def render_section(
        member: Member,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (100.0, 100.0),
    ) -> None:
        """Draws beam cross-section with link and main bars."""
        dims = member.dimensions
        w = dims["width"]
        d = dims["depth"]
        c = member.cover_nominal_mm
        ox, oy = origin

        # Concrete outline
        dxf.add_polyline([
            (ox, oy), (ox + w, oy), (ox + w, oy + d), (ox, oy + d), (ox, oy)
        ], layer="CONCRETE")

        # Outer link rectangle
        lx1 = ox + c
        ly1 = oy + c
        lx2 = ox + w - c
        ly2 = oy + d - c
        dxf.add_polyline([
            (lx1, ly1), (lx2, ly1), (lx2, ly2), (lx1, ly2), (lx1, ly1)
        ], layer="REBAR_LINKS")

        # Bottom bars as circles
        bot_group = next((bg for bg in member.bar_groups if bg.group_id == "BG_BEAM_BOT"), None)
        if bot_group:
            n = bot_group.count
            dia = bot_group.rebar.bar_size
            r = dia / 2.0
            space = (lx2 - lx1 - dia) / max(1, n - 1)
            for i in range(n):
                cx = lx1 + r + i * space
                cy = ly1 + r
                dxf.add_circle((cx, cy), radius=r, layer="REBAR_MAIN")

        # Top bars
        for cx in [lx1 + 10.0, lx2 - 10.0]:
            dxf.add_circle((cx, ly2 - 10.0), radius=10.0, layer="REBAR_MAIN")

        # Dimensions
        DimensionRenderer.add_dimension(dxf, (ox, oy - 20.0), (ox + w, oy - 20.0), offset=-15.0, text=f"{int(w)}")
        DimensionRenderer.add_dimension(dxf, (ox - 20.0, oy), (ox - 20.0, oy + d), offset=-15.0, text=f"{int(d)}")
        dxf.add_text("BEAM SECTION A-A", (ox, oy + d + 20.0), height=4.0, layer="ANNOTATIONS")
