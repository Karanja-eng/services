"""
Slab detailing generator (IStructE Chapter 6.2, Model Details MS1–MS8).
Separates engineering model computation from DXF drawing rendering.
Consumes shared BS 8666, cover, and lap calculations.
"""

from dataclasses import dataclass, field
import math
from typing import List, Dict, Optional, Tuple, Any
from ..core.model import Member, MemberType, BarGroup, Rebar, LayerType, Support, SupportType, Zone
from ..core.reinforcement import (
    BarAreaCalculator,
    AnchorageCalculator,
    LapCalculator,
    CoverCalculator,
    TableB1,
    ms2_u_bar_area,
    ms2_top_bar_extension,
    ms2_u_bar_top_extension,
    ms2_u_bar_bottom_leg,
    ms4_cantilever_geometry,
)
from ..drawing.dxf import DXFDocument
from ..drawing.dimensions import DimensionRenderer
from ..drawing.annotations import AnnotationRenderer


@dataclass
class SlabParams:
    """Input parameters for solid slab detailing (Model Detail MS1)."""
    span_clear_mm: float = 4000.0
    support_left_width_mm: float = 215.0
    support_right_width_mm: float = 215.0
    thickness_mm: float = 200.0
    cover_nominal_mm: float = 25.0  # EC2 Table 6.1
    fck_MPa: float = 30.0
    fyk_MPa: float = 500.0
    bottom_bar_dia_mm: int = 16
    bottom_bar_pitch_mm: float = 200.0
    top_bar_dia_mm: int = 12
    top_bar_pitch_mm: float = 200.0
    distribution_bar_dia_mm: int = 10
    distribution_bar_pitch_mm: float = 250.0
    is_continuous_left: bool = False
    is_continuous_right: bool = False
    slab_width_mm: float = 1000.0  # Detailing strip width
    is_end_support: bool = True     # Rule H7: 15% end vs 25% internal top rebar


class SlabEngineeringModel:
    """Computes reinforcement, curtailment, and anchorage, producing a Member model."""

    @staticmethod
    def create_model(params: SlabParams) -> Member:
        p = params
        span_eff = p.span_clear_mm + (p.support_left_width_mm + p.support_right_width_mm) / 2.0
        d_eff = p.thickness_mm - p.cover_nominal_mm - (p.bottom_bar_dia_mm / 2.0)

        # Anchorage / lap calculations
        l_b_rqd = AnchorageCalculator.basic_anchorage_length(p.bottom_bar_dia_mm, fck=p.fck_MPa, fyk=p.fyk_MPa)
        l_bd = AnchorageCalculator.design_anchorage_length(p.bottom_bar_dia_mm, fck=p.fck_MPa, fyk=p.fyk_MPa)
        l_0 = LapCalculator.design_lap_length(p.bottom_bar_dia_mm, fck=p.fck_MPa, fyk=p.fyk_MPa)

        # Rule H5: Direct support reduced anchorage: max(d, 0.3 * lb_rqd, 10d, 100mm)
        end_anchorage = AnchorageCalculator.direct_support_anchorage(d_eff, l_b_rqd, p.bottom_bar_dia_mm)

        # Full bottom bars (100% or 50% through to support)
        bot_bar_length = p.span_clear_mm + (p.support_left_width_mm * 0.7) + (p.support_right_width_mm * 0.7)
        num_bot_bars = int(math.ceil(p.slab_width_mm / p.bottom_bar_pitch_mm))

        bot_rebar = Rebar(
            bar_mark="01",
            shape_code="00",
            bar_size=p.bottom_bar_dia_mm,
            dimensions={"A": bot_bar_length},
            length_mm=bot_bar_length,
            layer=LayerType.B1,
            weight_kg=BarAreaCalculator.total_weight_kg(p.bottom_bar_dia_mm, bot_bar_length)
        )

        bot_group = BarGroup(
            group_id="BG_BOT_MAIN",
            rebar=bot_rebar,
            count=num_bot_bars,
            pitch_mm=p.bottom_bar_pitch_mm,
            layer=LayerType.B1
        )

        # Transverse distribution bars (Layer B2)
        trans_length = p.slab_width_mm - 2 * p.cover_nominal_mm
        num_trans_bars = int(math.ceil(p.span_clear_mm / p.distribution_bar_pitch_mm))
        trans_rebar = Rebar(
            bar_mark="02",
            shape_code="00",
            bar_size=p.distribution_bar_dia_mm,
            dimensions={"A": trans_length},
            length_mm=trans_length,
            layer=LayerType.B2,
            weight_kg=BarAreaCalculator.total_weight_kg(p.distribution_bar_dia_mm, trans_length)
        )
        trans_group = BarGroup(
            group_id="BG_BOT_DIST",
            rebar=trans_rebar,
            count=num_trans_bars,
            pitch_mm=p.distribution_bar_pitch_mm,
            layer=LayerType.B2
        )

        # Top bars at supports if continuous or anti-crack (EC2 Fig 6.3)
        # Top bar extends 0.15*L_eff for nominal / 0.3*L_eff for hogging
        top_groups = []
        if p.is_continuous_left or True:  # Include nominal top U/L bars
            top_ext = 0.25 * span_eff
            top_len = top_ext + p.support_left_width_mm
            num_top = int(math.ceil(p.slab_width_mm / p.top_bar_pitch_mm))
            top_rebar = Rebar(
                bar_mark="03",
                shape_code="11",
                bar_size=p.top_bar_dia_mm,
                dimensions={"A": top_len, "B": p.thickness_mm - 2 * p.cover_nominal_mm},
                length_mm=top_len + (p.thickness_mm - 2 * p.cover_nominal_mm),
                layer=LayerType.T1,
                weight_kg=BarAreaCalculator.total_weight_kg(p.top_bar_dia_mm, top_len)
            )
            top_groups.append(BarGroup(
                group_id="BG_TOP_LEFT",
                rebar=top_rebar,
                count=num_top,
                pitch_mm=p.top_bar_pitch_mm,
                layer=LayerType.T1
            ))

        member = Member(
            member_id="SLAB_01",
            member_type=MemberType.SLAB,
            name="One-Way Solid Slab (MS1)",
            concrete_grade=f"C{int(p.fck_MPa)}/{int(p.fck_MPa*1.25)}",
            cover_nominal_mm=p.cover_nominal_mm,
            dimensions={
                "span_clear": p.span_clear_mm,
                "thickness": p.thickness_mm,
                "support_left": p.support_left_width_mm,
                "support_right": p.support_right_width_mm,
                "width": p.slab_width_mm,
            },
            bar_groups=[bot_group, trans_group] + top_groups,
            supports=[
                Support("SUP_1", SupportType.WALL, 0.0, 0.0, p.support_left_width_mm),
                Support("SUP_2", SupportType.WALL, p.span_clear_mm + p.support_left_width_mm, 0.0, p.support_right_width_mm),
            ],
            zones=[
                Zone("Z_SPAN", "SPAN", 0.0, p.span_clear_mm),
            ],
            metadata={
                "d_eff_mm": d_eff,
                "end_anchorage_mm": end_anchorage,
                "partial_fixity_top_rebar_ratio": 0.15 if p.is_end_support else 0.25,
            }
        )
        return member


class SlabDrawingRenderer:
    """Renders a Slab engineering model to DXF."""

    @staticmethod
    def render_elevation(
        member: Member,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (100.0, 200.0),
        scale: float = 1.0,
    ) -> None:
        dims = member.dimensions
        span = dims["span_clear"]
        th = dims["thickness"]
        sw_l = dims["support_left"]
        sw_r = dims["support_right"]
        c = member.cover_nominal_mm

        ox, oy = origin

        # Concrete outline
        # Support left
        dxf.add_polyline([
            (ox, oy - 200.0), (ox + sw_l, oy - 200.0),
            (ox + sw_l, oy), (ox, oy), (ox, oy - 200.0)
        ], layer="CONCRETE")

        # Slab body
        slab_poly = [
            (ox, oy),
            (ox + sw_l + span + sw_r, oy),
            (ox + sw_l + span + sw_r, oy + th),
            (ox, oy + th),
            (ox, oy)
        ]
        dxf.add_polyline(slab_poly, layer="CONCRETE")

        # Support right
        sx_r = ox + sw_l + span
        dxf.add_polyline([
            (sx_r, oy - 200.0), (sx_r + sw_r, oy - 200.0),
            (sx_r + sw_r, oy), (sx_r, oy), (sx_r, oy - 200.0)
        ], layer="CONCRETE")

        # Bottom reinforcement (B1)
        bx1 = ox + c
        bx2 = ox + sw_l + span + sw_r - c
        by = oy + c
        dxf.add_line((bx1, by), (bx2, by), layer="REBAR_BOT")

        # Top reinforcement (T1) if any
        tx1 = ox + c
        tx2 = ox + sw_l + 0.25 * span
        ty = oy + th - c
        dxf.add_line((tx1, ty), (tx2, ty), layer="REBAR_TOP")
        dxf.add_line((tx1, ty), (tx1, ty - (th - 2 * c)), layer="REBAR_TOP")

        # Dimensions
        DimensionRenderer.add_dimension(
            dxf,
            (ox + sw_l, oy - 50.0),
            (ox + sw_l + span, oy - 50.0),
            offset=-30.0,
            text=f"{int(span)}"
        )
        DimensionRenderer.add_dimension(
            dxf,
            (ox - 30.0, oy),
            (ox - 30.0, oy + th),
            offset=-20.0,
            text=f"{int(th)}"
        )

        # Callouts
        for bg in member.bar_groups:
            if bg.layer == LayerType.B1:
                callout = bg.rebar.formatted_callout(bg.count, bg.pitch_mm)
                AnnotationRenderer.add_rebar_callout(
                    dxf, callout,
                    bar_point=(ox + sw_l + span / 2.0, by),
                    text_pos=(ox + sw_l + span / 2.0 - 50.0, by - 80.0)
                )

        dxf.add_text(f"{member.name} — ELEVATION", (ox, oy + th + 40.0), height=5.0, layer="ANNOTATIONS")


# ---------------------------------------------------------------------------
# Recovered Slab Model Detail Generators: MS2, MS3, MS4
# ---------------------------------------------------------------------------

class MS2ModelGenerator:
    """
    Model Detail MS2 — One and two way slabs, External RESTRAINED supports
    Source: Model Detail MS2, page 67; Rules B1-B5.
    """

    @staticmethod
    def create_model(
        span_mm: float = 6000.0,
        thickness_mm: float = 200.0,
        bottom_As_midspan_mm2_per_m: float = 600.0,
        bar_dia_mm: int = 16,
        cover_nominal_mm: float = 25.0,
        fck_MPa: float = 30.0,
        fyk_MPa: float = 500.0,
        X_available_mm: float = 500.0,
        tension_lap_mm: float = 650.0,
    ) -> Member:
        l_bd = AnchorageCalculator.design_anchorage_length(bar_dia_mm, fck=fck_MPa, fyk=fyk_MPa)
        detail_type = "DETAIL_A" if X_available_mm >= l_bd else "DETAIL_B"

        u_bar_area = ms2_u_bar_area(bottom_As_midspan_mm2_per_m)
        top_ext = ms2_top_bar_extension(span_mm)
        u_top_ext = ms2_u_bar_top_extension(span_mm)
        u_bot_leg = ms2_u_bar_bottom_leg(tension_lap_mm)

        u_bar = Rebar(
            bar_mark="01",
            shape_code="21",
            bar_size=bar_dia_mm,
            dimensions={"A": u_top_ext, "B": thickness_mm - 2 * cover_nominal_mm, "C": u_bot_leg},
            length_mm=u_top_ext + (thickness_mm - 2 * cover_nominal_mm) + u_bot_leg,
            layer=LayerType.B1
        )
        u_group = BarGroup("BG_MS2_UBARS", u_bar, count=int(math.ceil(1000.0 / 200.0)), pitch_mm=200.0, layer=LayerType.B1)

        return Member(
            member_id="MS2_01",
            member_type=MemberType.SLAB,
            name="External Restrained Slab (MS2)",
            concrete_grade=f"C{int(fck_MPa)}/{int(fck_MPa*1.25)}",
            cover_nominal_mm=cover_nominal_mm,
            dimensions={"span": span_mm, "thickness": thickness_mm, "X_available": X_available_mm},
            bar_groups=[u_group],
            metadata={
                "detail_type": detail_type,
                "u_bar_area_mm2_per_m": u_bar_area,
                "top_bar_extension_mm": top_ext,
                "u_bar_top_extension_mm": u_top_ext,
                "u_bar_bottom_leg_mm": u_bot_leg,
                "corner_bars_required": True,
                "50mm_bend_offset_shown": True,
            }
        )


class MS3ModelGenerator:
    """
    Model Detail MS3 — External UNRESTRAINED supports and free edges
    Source: Model Detail MS3, page 68; Rule C1.
    """

    @staticmethod
    def create_model(
        span_mm: float = 4000.0,
        thickness_mm: float = 160.0,
        support_width_mm: float = 215.0,
        bar_dia_mm: int = 12,
        cover_nominal_mm: float = 20.0,
        fck_MPa: float = 30.0,
        fyk_MPa: float = 500.0,
        tension_lap_mm: float = 500.0,
    ) -> Member:
        d_eff = thickness_mm - cover_nominal_mm - (bar_dia_mm / 2.0)
        l_b_rqd = AnchorageCalculator.basic_anchorage_length(bar_dia_mm, fck=fck_MPa, fyk=fyk_MPa)

        if thickness_mm >= 150.0:
            detail_type = "DETAIL_A"
            top_ext = max(0.1 * span_mm, 45.0 * bar_dia_mm)
            bot_ext = max(500.0, tension_lap_mm)
            anchorage_sup = bot_ext
            bobbed_bars = False
        elif support_width_mm < 200.0:
            detail_type = "DETAIL_B"
            top_ext = 0.0
            bot_ext = max(500.0, tension_lap_mm)
            anchorage_sup = AnchorageCalculator.direct_support_anchorage(d_eff, l_b_rqd, bar_dia_mm)
            bobbed_bars = True
        else:
            detail_type = "DETAIL_C"
            top_ext = 0.0
            bot_ext = max(500.0, tension_lap_mm)
            anchorage_sup = AnchorageCalculator.direct_support_anchorage(d_eff, l_b_rqd, bar_dia_mm)
            bobbed_bars = False

        return Member(
            member_id="MS3_01",
            member_type=MemberType.SLAB,
            name="External Unrestrained Slab (MS3)",
            concrete_grade=f"C{int(fck_MPa)}/{int(fck_MPa*1.25)}",
            cover_nominal_mm=cover_nominal_mm,
            dimensions={"span": span_mm, "thickness": thickness_mm, "support_width": support_width_mm},
            metadata={
                "detail_type": detail_type,
                "top_extension_mm": top_ext,
                "bottom_extension_mm": bot_ext,
                "anchorage_at_support_mm": anchorage_sup,
                "bobbed_bars_permitted": bobbed_bars,
            }
        )


class MS4ModelGenerator:
    """
    Model Detail MS4 — Cantilever slabs
    Source: Model Detail MS4, page 69; Rule D1.
    """

    @staticmethod
    def create_model(
        cantilever_length_mm: float = 1500.0,
        thickness_mm: float = 175.0,
        top_As_mm2: float = 800.0,
        bar_dia_mm: int = 16,
        cover_nominal_mm: float = 25.0,
        tension_lap_mm: float = 600.0,
        fck_MPa: float = 30.0,
    ) -> Member:
        geom = ms4_cantilever_geometry(cantilever_length_mm, top_As_mm2, tension_lap_mm)

        return Member(
            member_id="MS4_01",
            member_type=MemberType.SLAB,
            name="Cantilever Slab (MS4)",
            concrete_grade=f"C{int(fck_MPa)}/{int(fck_MPa*1.25)}",
            cover_nominal_mm=cover_nominal_mm,
            dimensions={"cantilever_length": cantilever_length_mm, "thickness": thickness_mm},
            metadata={
                "top_bar_min_length_mm": geom["top_bar_min_length_mm"],
                "support_extension_mm": geom["support_extension_mm"],
                "bottom_bar_extension_mm": geom["bottom_bar_extension_mm"],
                "bottom_bar_lap_mm": geom["bottom_bar_lap_mm"],
                "bottom_bar_min_area_mm2": geom["bottom_bar_min_area_mm2"],
                "end_U_bar_retaining_lever_arm": True,
            }
        )
