"""
Foundations Detailing Generator.
Implements IStructE Standard Method of Detailing Section 6.7 (Foundations: MF1–MF5).
Consumes canonical reinforcement calculations and drawing primitives.
"""

from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any

from ..core.model import Member, MemberType, BarGroup, Rebar, LayerType
from ..core.reinforcement import (
    table_anchorage_length,
    table_lap_length,
    band_required,
    BarAreaCalculator,
)
from ..core.relationships import MemberConnectivity
from ..drawing.dxf import DXFDocument
from ..drawing.annotations import AnnotationRenderer
from ..drawing.dimensions import DimensionRenderer


@dataclass
class PadFootingParams:
    """Input parameters for rectangular reinforced concrete pad footing (Model Detail MF1)."""
    lx_mm: float = 2500.0
    ly_mm: float = 2500.0
    depth_mm: float = 600.0
    cx_mm: float = 400.0  # column width x
    cy_mm: float = 400.0  # column width y
    bar_dia_mm: int = 25
    pitch_mm: float = 200.0
    cover_mm: float = 75.0  # Rule F02: 75mm for foundations
    concrete_grade: str = "28/35"
    bond: str = "good"
    n_starters: int = 4
    starter_dia_mm: int = 20
    starter_leg_mm: float = 450.0  # Rule F07: 450mm min leg


@dataclass
class PadFootingEngineeringModel:
    """Engineering sizing, banding, and anchorage analysis for Pad Footing."""
    params: PadFootingParams
    d_eff_mm: float
    band_x_required: bool
    band_y_required: bool
    band_width_x_mm: float
    band_width_y_mm: float
    anchorage_length_mm: float
    available_anchorage_x_mm: float
    bob_ends_required: bool
    starter_lap_mm: float
    warnings: List[str] = field(default_factory=list)

    @classmethod
    def create_model(cls, p: PadFootingParams) -> PadFootingEngineeringModel:
        warnings = []
        d_eff = p.depth_mm - p.cover_mm - 1.5 * p.bar_dia_mm

        # Bar size check (Rule F03: dia < 16 not used except lacers)
        if p.bar_dia_mm < 16:
            warnings.append(f"Main bar diameter {p.bar_dia_mm}mm < 16mm minimum for foundations [Rule F03].")

        # Banding check (Rule F09, VC V4, V5)
        bx = band_required(p.lx_mm, p.cx_mm, d_eff)
        by = band_required(p.ly_mm, p.cy_mm, d_eff)
        bw_x = p.cx_mm + 3.0 * d_eff
        bw_y = p.cy_mm + 3.0 * d_eff

        # Anchorage check (Rule F08)
        la = table_anchorage_length(p.bar_dia_mm, p.concrete_grade, "foundations", p.bond)
        avail_x = (p.lx_mm - p.cx_mm) / 2.0 - p.cover_mm
        bob_required = avail_x < la

        # Starters check (Rule F07, F17)
        if p.starter_leg_mm < 450.0:
            warnings.append(f"Starter horizontal leg {p.starter_leg_mm}mm < 450mm minimum [Rule F07].")
        starter_lap = table_lap_length(p.starter_dia_mm, p.concrete_grade, "walls") + 150.0  # +150 level tolerance

        return cls(
            params=p,
            d_eff_mm=d_eff,
            band_x_required=bx,
            band_y_required=by,
            band_width_x_mm=bw_x,
            band_width_y_mm=bw_y,
            anchorage_length_mm=la,
            available_anchorage_x_mm=avail_x,
            bob_ends_required=bob_required,
            starter_lap_mm=starter_lap,
            warnings=warnings,
        )


class PadFootingDrawingRenderer:
    """Renders CAD detail drawings for RC Pad Footing (MF1)."""

    @staticmethod
    def _compute_bar_positions(
        total_len: float, col_len: float, d_eff: float, pitch: float, cover: float, is_banded: bool
    ) -> List[float]:
        n_nominal = int((total_len - 2.0 * cover) // pitch) + 1
        if not is_banded:
            return [cover + i * pitch for i in range(n_nominal)]

        # Concentration in central band (Rule F09: >= 2/3 of bars in band cx + 3d)
        bw = col_len + 3.0 * d_eff
        n_band = math.ceil(2.0 / 3.0 * n_nominal)
        n_out = max(n_nominal - n_band, 2)
        inner_pitch = bw / max(n_band, 1)
        cen = total_len / 2.0

        band_positions = [cen - bw / 2.0 + inner_pitch * (i + 0.5) for i in range(n_band)]
        outer_half_cnt = math.ceil(n_out / 2.0)
        outer_pitch = (cen - bw / 2.0 - cover) / max(outer_half_cnt, 1)
        out_positions = [cover + i * outer_pitch for i in range(outer_half_cnt)]
        out_positions_right = [total_len - p for p in out_positions]

        all_pos = sorted(band_positions + out_positions + out_positions_right)
        return all_pos

    @classmethod
    def render_plan(
        cls,
        model: PadFootingEngineeringModel,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (50.0, 50.0),
    ) -> None:
        ox, oy = origin
        p = model.params
        lx, ly = p.lx_mm, p.ly_mm
        cx, cy = p.cx_mm, p.cy_mm
        c = p.cover_mm

        # Pad footing concrete outline
        dxf.add_polyline(
            [(ox, oy), (ox + lx, oy), (ox + lx, oy + ly), (ox, oy + ly)],
            layer="CONCRETE",
            is_closed=True,
        )

        # Column footprint at centre
        col_x = ox + (lx - cx) / 2.0
        col_y = oy + (ly - cy) / 2.0
        dxf.add_polyline(
            [(col_x, col_y), (col_x + cx, col_y), (col_x + cx, col_y + cy), (col_x, col_y + cy)],
            layer="CONCRETE",
            is_closed=True,
        )

        # Bottom bars parallel to Y (at X positions)
        xs = cls._compute_bar_positions(lx, cx, model.d_eff_mm, p.pitch_mm, c, model.band_x_required)
        for x in xs:
            dxf.add_line((ox + x, oy + c), (ox + x, oy + ly - c), layer="REBAR_BOT")

        # Bottom bars parallel to X (at Y positions)
        ys = cls._compute_bar_positions(ly, cy, model.d_eff_mm, p.pitch_mm, c, model.band_y_required)
        for y in ys:
            dxf.add_line((ox + c, oy + y), (ox + lx - c, oy + y), layer="REBAR_BOT")

        # Annotations
        tag = "Straight bars" if not model.bob_ends_required else f"Bob ends (avail {model.available_anchorage_x_mm:.0f}mm < {model.anchorage_length_mm:.0f}mm) [Rule F08]"
        dxf.add_text(f"Anchorage from col face: {model.anchorage_length_mm:.0f}mm ({tag})", (ox, oy - 70.0), height=2.5, layer="ANNOTATIONS")

        if model.band_x_required or model.band_y_required:
            dxf.add_text(
                f"BANDED: width cx+3d = {model.band_width_x_mm:.0f}mm (>=2/3 bars concentrated in band) [Rule F09]",
                (ox, oy - 110.0),
                height=2.5,
                layer="ANNOTATIONS",
            )

        dxf.add_text(f"{len(ys)} H{p.bar_dia_mm} B1 (bottom layer 1)", (ox + lx + 30.0, oy + ly * 0.6), height=2.5, layer="ANNOTATIONS")
        dxf.add_text(f"{len(xs)} H{p.bar_dia_mm} B2 (bottom layer 2)", (ox + lx + 30.0, oy + ly * 0.4), height=2.5, layer="ANNOTATIONS")

        # Dimensions
        DimensionRenderer.render_linear_dimension_h(dxf, (ox, oy), (ox + lx, oy), offset=-150.0, text=f"{lx:.0f}")
        DimensionRenderer.render_aligned_dimension(dxf, (ox, oy), (ox, oy + ly), offset=-150.0, text=f"{ly:.0f}")
        dxf.add_text("PAD FOOTING PLAN (MF1)", (ox + lx / 2.0 - 100.0, oy - 200.0), height=3.5, layer="ANNOTATIONS")

    @classmethod
    def render_section(
        cls,
        model: PadFootingEngineeringModel,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (50.0, 450.0),
    ) -> None:
        ox, oy = origin
        p = model.params
        lx = p.lx_mm
        cx = p.cx_mm
        depth = p.depth_mm
        c = p.cover_mm

        # Concrete outline of base
        dxf.add_polyline(
            [(ox, oy), (ox + lx, oy), (ox + lx, oy + depth), (ox, oy + depth)],
            layer="CONCRETE",
            is_closed=True,
        )

        # Column stub
        col_x = ox + (lx - cx) / 2.0
        stub_h = 500.0
        dxf.add_polyline(
            [(col_x, oy + depth), (col_x + cx, oy + depth), (col_x + cx, oy + depth + stub_h), (col_x, oy + depth + stub_h)],
            layer="CONCRETE",
            is_closed=False,
        )

        # Bottom bars line
        dxf.add_line((ox + c, oy + c), (ox + lx - c, oy + c), layer="REBAR_BOT")

        # Starter bars (Rule F07, F17: 450mm leg, lap + 150mm)
        for k in range(max(p.n_starters // 2, 2)):
            sign = 1 if k == 0 else -1
            xx = col_x + 50.0 + k * (cx - 100.0)
            starter_pts = [
                (xx, oy + depth + model.starter_lap_mm),
                (xx, oy + c + p.bar_dia_mm),
                (xx - sign * p.starter_leg_mm, oy + c + p.bar_dia_mm),
            ]
            dxf.add_polyline(starter_pts, layer="REBAR_MAIN")

        # Kicker line (Rule F17)
        k_y = oy + depth + 75.0
        dxf.add_line((col_x - 20.0, k_y), (col_x + cx + 20.0, k_y), layer="CENTRELINES")
        dxf.add_text("kicker 75 [Rule F17]", (col_x + cx + 30.0, k_y - 5.0), height=2.5, layer="ANNOTATIONS")

        # Annotations & Dimensions
        dxf.add_text(
            f"Starters: {p.starter_leg_mm:.0f}mm min leg [Rule F07]; lap {model.starter_lap_mm:.0f}mm (incl 150mm tolerance) [Rule F17]",
            (ox, oy - 70.0),
            height=2.5,
            layer="ANNOTATIONS",
        )
        dxf.add_text(f"Cover {c:.0f}mm bottom & sides [Rule F02]", (ox + 20.0, oy + depth / 2.0), height=2.5, layer="ANNOTATIONS")

        DimensionRenderer.render_aligned_dimension(dxf, (ox, oy), (ox, oy + depth), offset=-100.0, text=f"{depth:.0f}")
        DimensionRenderer.render_linear_dimension_h(dxf, (ox, oy), (ox + lx, oy), offset=-120.0, text=f"{lx:.0f}")
        dxf.add_text("PAD FOOTING SECTION 1-1", (ox + lx / 2.0 - 100.0, oy - 170.0), height=3.5, layer="ANNOTATIONS")
