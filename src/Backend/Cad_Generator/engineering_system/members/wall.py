"""
Wall & Retaining Wall Detailing Generator.
Implements IStructE Standard Method of Detailing Section 6.5 (Walls: MW1–MW4)
and Section 6.6 (Retaining Walls: MRW1–MRW3).
Consumes canonical reinforcement calculations and drawing primitives.
"""

from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any

from ..core.model import Member, MemberType, BarGroup, Rebar, LayerType
from ..core.reinforcement import (
    lookup_mw1_wall_defaults,
    table_anchorage_length,
    table_lap_length,
    get_trimmer_bar_diameter,
    BarAreaCalculator,
)
from ..core.relationships import MemberConnectivity
from ..drawing.dxf import DXFDocument
from ..drawing.annotations import AnnotationRenderer
from ..drawing.dimensions import DimensionRenderer


@dataclass
class WallParams:
    """Input parameters for in-situ reinforced concrete wall (MW1)."""
    thickness_mm: float = 250.0
    length_mm: float = 2400.0
    height_mm: float = 3000.0
    concrete_grade: str = "28/35"
    exposure: str = "internal"  # "internal" (XC1) or "external" (XC3)
    dcdev_mm: float = 10.0
    vertical_dia_mm: Optional[int] = None
    vertical_pitch_mm: Optional[int] = None
    horizontal_dia_mm: Optional[int] = None
    horizontal_pitch_mm: Optional[int] = None
    opening: Optional[Tuple[float, float, float, float]] = None  # (x, y, w, h) from bottom-left
    kicker_height_mm: float = 75.0


@dataclass
class WallEngineeringModel:
    """Engineering check and sizing results for RC wall."""
    params: WallParams
    vdia: int
    vpitch: int
    hdia: int
    hpitch: int
    cover_mm: float
    As_v_mm2_per_m: float
    As_h_mm2_per_m: float
    compression_lap_mm: float
    warnings: List[str] = field(default_factory=list)
    trimmer_dia: Optional[int] = None
    trimmer_anchorage_mm: Optional[float] = None

    @classmethod
    def create_model(cls, p: WallParams) -> WallEngineeringModel:
        warnings = []
        # Thickness check (Rule W02, VC V3)
        valid_t, t_msg = MemberConnectivity.check_wall_thickness(p.thickness_mm)
        if not valid_t:
            warnings.append(t_msg)

        # MW1 defaults lookup if not explicitly specified (Rule W27, VC V1, V2)
        d_vd, d_vp, d_hd, d_hp = lookup_mw1_wall_defaults(p.thickness_mm)
        vdia = p.vertical_dia_mm or d_vd
        vpitch = p.vertical_pitch_mm or d_vp
        hdia = p.horizontal_dia_mm or d_hd
        hpitch = p.horizontal_pitch_mm or d_hp

        # Cover (Rule W04, W05)
        if p.exposure == "internal":
            cover = max(20.0, float(hdia))
        else:
            cover = 40.0

        # Steel areas per metre
        Ac = p.thickness_mm * 1000.0
        single_v = math.pi * (vdia ** 2) / 4.0
        As_v = 2.0 * single_v * (1000.0 / vpitch)  # both faces per m

        single_h = math.pi * (hdia ** 2) / 4.0
        As_h = single_h * (1000.0 / hpitch)  # per face per m

        # Checks
        if As_v < 0.002 * Ac:
            warnings.append(f"Vertical steel As_v ({As_v:.1f}mm2/m) < 0.002Ac ({0.002 * Ac:.1f}mm2/m) [Rule W06].")
        if As_v > 0.04 * Ac:
            warnings.append(f"Vertical steel As_v ({As_v:.1f}mm2/m) > 0.04Ac ({0.04 * Ac:.1f}mm2/m) [Rule W10].")
        if vdia < 12:
            warnings.append(f"Vertical bar diameter {vdia}mm < 12mm minimum for robust cage [Rule W06].")
        if hdia < vdia / 4.0:
            warnings.append(f"Horizontal bar diameter {hdia}mm < 1/4 vertical bar diameter ({vdia / 4.0}mm) [Rule W07].")
        
        # Horizontal steel: max(25% of vertical steel in that face, 0.001Ac)
        min_h_req = max(0.25 * (As_v / 2.0), 0.001 * Ac)
        if As_h < min_h_req:
            warnings.append(f"Horizontal steel As_h ({As_h:.1f}mm2/m) < min required ({min_h_req:.1f}mm2/m) [Rule W07].")

        # Spacing limits (Rule W12)
        max_p = min(3.0 * p.thickness_mm, 400.0)
        if vpitch > max_p:
            warnings.append(f"Vertical pitch {vpitch}mm > max permitted {max_p}mm [Rule W12].")
        if hpitch > max_p:
            warnings.append(f"Horizontal pitch {hpitch}mm > max permitted {max_p}mm [Rule W12].")

        # Links requirement check (Rule W13)
        if As_v > 0.02 * Ac:
            warnings.append(f"Transverse containment links required: As_v > 0.02Ac [Rule W13].")

        # Opening check (Rule W19, W21, W22)
        trimmer_dia = None
        trimmer_anchorage = None
        if p.opening:
            ox, oy, ow, oh = p.opening
            trim_res = MemberConnectivity.check_wall_trimmer_opening(
                p.thickness_mm, ow, oh, vpitch, hpitch
            )
            if trim_res["trimming_required"]:
                if not trim_res["min_wall_thickness_met"]:
                    warnings.append(trim_res["message"])
                trimmer_dia = get_trimmer_bar_diameter(vdia)
                trimmer_anchorage = table_anchorage_length(trimmer_dia, p.concrete_grade, "walls")

        # Compression lap length (Rule W15, W16)
        comp_lap = table_lap_length(vdia, p.concrete_grade, "walls")

        return cls(
            params=p,
            vdia=vdia,
            vpitch=vpitch,
            hdia=hdia,
            hpitch=hpitch,
            cover_mm=cover,
            As_v_mm2_per_m=As_v,
            As_h_mm2_per_m=As_h,
            compression_lap_mm=comp_lap,
            warnings=warnings,
            trimmer_dia=trimmer_dia,
            trimmer_anchorage_mm=trimmer_anchorage,
        )


class WallDrawingRenderer:
    """Renders CAD detailing views for RC Wall (MW1)."""

    @staticmethod
    def render_plan_section(
        model: WallEngineeringModel,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (50.0, 50.0),
        length_mm: float = 1200.0,
    ) -> None:
        ox, oy = origin
        t = model.params.thickness_mm
        c = model.cover_mm

        # Concrete outline
        dxf.add_polyline(
            [(ox, oy), (ox + length_mm, oy), (ox + length_mm, oy + t), (ox, oy + t)],
            layer="CONCRETE",
            is_closed=True,
        )

        # Horizontal bars (outside verticals, Rule W03)
        hy_nf = oy + c + model.hdia / 2.0
        hy_ff = oy + t - c - model.hdia / 2.0
        dxf.add_line((ox + c, hy_nf), (ox + length_mm - c, hy_nf), layer="REBAR_MAIN")
        dxf.add_line((ox + c, hy_ff), (ox + length_mm - c, hy_ff), layer="REBAR_MAIN")

        # Vertical bars (dots inside horizontals)
        vy_nf = hy_nf + model.hdia / 2.0 + model.vdia / 2.0
        vy_ff = hy_ff - model.hdia / 2.0 - model.vdia / 2.0
        n_bars = int(length_mm // model.vpitch)
        for i in range(n_bars + 1):
            x = ox + c + i * model.vpitch
            if x < ox + length_mm - c:
                dxf.add_circle((x, vy_nf), model.vdia / 2.0, layer="REBAR_MAIN")
                dxf.add_circle((x, vy_ff), model.vdia / 2.0, layer="REBAR_MAIN")

        # Dimensions & Annotations
        DimensionRenderer.render_aligned_dimension(dxf, (ox, oy), (ox, oy + t), offset=-80.0, text=f"{t:.0f}")
        dxf.add_text(f"SECTION 1-1 (PLAN THROUGH WALL)", (ox, oy - 120.0), height=3.5, layer="ANNOTATIONS")
        dxf.add_text(f"Cover {c:.0f}mm to horizontals [Rule W03]", (ox + length_mm + 20.0, oy + t / 2.0), height=2.5, layer="ANNOTATIONS")
        dxf.add_text(f"Near Face (NF): H{model.vdia}@{model.vpitch} vert, H{model.hdia}@{model.hpitch} horiz", (ox, oy + t + 30.0), height=2.5, layer="ANNOTATIONS")

    @staticmethod
    def render_elevation(
        model: WallEngineeringModel,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (50.0, 250.0),
    ) -> None:
        ox, oy = origin
        L = model.params.length_mm
        H = model.params.height_mm
        c = model.cover_mm

        # Concrete outline
        dxf.add_polyline(
            [(ox, oy), (ox + L, oy), (ox + L, oy + H), (ox, oy + H)],
            layer="CONCRETE",
            is_closed=True,
        )

        # Kicker line (Rule W26: 75mm above slab)
        k_y = oy + model.params.kicker_height_mm
        dxf.add_line((ox, k_y), (ox + L, k_y), layer="CENTRELINES")
        dxf.add_text(f"kicker {model.params.kicker_height_mm:.0f}mm", (ox + L + 20.0, k_y - 5.0), height=2.5, layer="ANNOTATIONS")

        # Vertical bars (near face)
        nv = int((L - 2.0 * c) // model.vpitch) + 1
        for i in range(nv):
            x = ox + c + i * model.vpitch
            dxf.add_line((x, k_y), (x, oy + H - c), layer="REBAR_MAIN")

        # Horizontal bars
        nh = int((H - 2.0 * c) // model.hpitch) + 1
        for j in range(nh):
            y = oy + c + j * model.hpitch
            dxf.add_line((ox + c, y), (ox + L - c, y), layer="HIDDEN")

        # Starter lap text at top (Rule W26)
        dxf.add_text(
            f"Compression lap {model.compression_lap_mm:.0f}mm + kicker above floor [Rule W26]",
            (ox + 20.0, oy + H + 25.0),
            height=2.5,
            layer="ANNOTATIONS",
        )

        # Opening & Trimmers (Rule W21, W22)
        if model.params.opening and model.trimmer_dia:
            x, y, ow, oh = model.params.opening
            bx, by = ox + x, oy + y
            # Opening cutout
            dxf.add_polyline(
                [(bx, by), (bx + ow, by), (bx + ow, by + oh), (bx, by + oh)],
                layer="CONCRETE",
                is_closed=True,
            )
            # Trimmer bars
            la = model.trimmer_anchorage_mm or 400.0
            off = 30.0
            # Horizontal trimmers top & bottom
            dxf.add_line((bx - la, by - off), (bx + ow + la, by - off), layer="REBAR_MAIN")
            dxf.add_line((bx - la, by + oh + off), (bx + ow + la, by + oh + off), layer="REBAR_MAIN")
            # Vertical trimmers left & right
            dxf.add_line((bx - off, by - la), (bx - off, by + oh + la), layer="REBAR_MAIN")
            dxf.add_line((bx + ow + off, by - la), (bx + ow + off, by + oh + la), layer="REBAR_MAIN")
            dxf.add_text(
                f"Trimmers 2H{model.trimmer_dia} each side, anchorage {la:.0f}mm beyond [Rule W21]",
                (bx - la, by + oh + off + 15.0),
                height=2.2,
                layer="ANNOTATIONS",
            )

        # Dimensions
        DimensionRenderer.render_linear_dimension_h(dxf, (ox, oy), (ox + L, oy), offset=-120.0, text=f"{L:.0f}")
        DimensionRenderer.render_aligned_dimension(dxf, (ox, oy), (ox, oy + H), offset=-120.0, text=f"{H:.0f}")
        dxf.add_text(f"WALL ELEVATION", (ox + L / 2.0 - 80.0, oy - 180.0), height=3.5, layer="ANNOTATIONS")


@dataclass
class CantileverRetainingWallParams:
    """Input parameters for free-standing cantilever retaining wall (Model Detail MRW1)."""
    stem_height_mm: float = 3000.0
    stem_thickness_mm: float = 300.0
    base_length_mm: float = 2200.0
    toe_length_mm: float = 600.0
    base_thickness_mm: float = 400.0
    vdia_earth_mm: int = 16
    vpitch_earth_mm: float = 150.0
    hdia_mm: int = 12
    hpitch_mm: float = 200.0
    base_dia_mm: int = 16
    base_pitch_mm: float = 150.0
    cover_earth_mm: float = 50.0
    cover_ext_mm: float = 40.0
    cover_base_mm: float = 75.0
    concrete_grade: str = "28/35"


class RetainingWallDrawingRenderer:
    """Renders CAD detail for cantilever retaining wall (MRW1)."""

    @staticmethod
    def render_section(
        params: CantileverRetainingWallParams,
        dxf: DXFDocument,
        origin: Tuple[float, float] = (100.0, 100.0),
    ) -> None:
        ox, oy = origin
        H = params.stem_height_mm
        t_stem = params.stem_thickness_mm
        b_L = params.base_length_mm
        toe = params.toe_length_mm
        b_t = params.base_thickness_mm

        # Concrete outline
        outline = [
            (ox, oy),
            (ox + b_L, oy),
            (ox + b_L, oy + b_t),
            (ox + toe + t_stem, oy + b_t),
            (ox + toe + t_stem, oy + b_t + H),
            (ox + toe, oy + b_t + H),
            (ox + toe, oy + b_t),
            (ox, oy + b_t),
        ]
        dxf.add_polyline(outline, layer="CONCRETE", is_closed=True)

        # Kicker (Rule RW08: 150 below ground / 75 above base)
        k_y = oy + b_t + 75.0
        dxf.add_line((ox + toe - 30.0, k_y), (ox + toe + t_stem + 30.0, k_y), layer="CENTRELINES")
        dxf.add_text("kicker 75 [Rule RW08/RW13]", (ox + toe + t_stem + 40.0, k_y - 5.0), height=2.5, layer="ANNOTATIONS")

        # Earth face vertical bar: continues into base with bend to toe side (L-bar)
        lb = table_lap_length(params.vdia_earth_mm, params.concrete_grade, "retaining_walls")
        xe = ox + toe + t_stem - params.cover_earth_mm
        rebar_earth = [
            (xe, oy + b_t + H - params.cover_earth_mm),
            (xe, oy + params.cover_base_mm + params.base_dia_mm),
            (xe - 8.0 * params.vdia_earth_mm - 200.0, oy + params.cover_base_mm + params.base_dia_mm),
        ]
        dxf.add_polyline(rebar_earth, layer="REBAR_MAIN")

        # Exposed face bar & lap at base
        xf = ox + toe + params.cover_ext_mm
        dxf.add_line((xf, oy + b_t + H - params.cover_ext_mm), (xf, oy + b_t + 75.0 + lb), layer="REBAR_MAIN")
        dxf.add_polyline(
            [
                (xf, oy + b_t + 75.0 + lb),
                (xf, oy + params.cover_base_mm + params.base_dia_mm),
                (xf + 500.0, oy + params.cover_base_mm + params.base_dia_mm),
            ],
            layer="REBAR_MAIN",
        )

        # Base bars
        dxf.add_line((ox + params.cover_ext_mm, oy + params.cover_base_mm), (ox + b_L - params.cover_ext_mm, oy + params.cover_base_mm), layer="REBAR_BOT")
        dxf.add_line((ox + params.cover_ext_mm, oy + b_t - params.cover_ext_mm), (ox + b_L - params.cover_ext_mm, oy + b_t - params.cover_ext_mm), layer="REBAR_TOP")

        # Callouts & Dimensions
        dxf.add_text(f"Earth Face: H{params.vdia_earth_mm}@{params.vpitch_earth_mm:.0f} (T)", (xe + 20.0, oy + b_t + H * 0.6), height=2.5, layer="ANNOTATIONS")
        dxf.add_text(f"Exposed Face: H{params.hdia_mm}@{params.hpitch_mm:.0f} (NF)", (xf - 240.0, oy + b_t + H * 0.3), height=2.5, layer="ANNOTATIONS")
        dxf.add_text(f"Base: H{params.base_dia_mm}@{params.base_pitch_mm:.0f} (B)", (ox + b_L * 0.4, oy + params.cover_base_mm - 30.0), height=2.5, layer="ANNOTATIONS")
        dxf.add_text(f"Cover: {params.cover_earth_mm:.0f} buried / {params.cover_ext_mm:.0f} exposed / {params.cover_base_mm:.0f} base [Rule RW03]", (ox, oy - 80.0), height=2.5, layer="ANNOTATIONS")

        DimensionRenderer.render_linear_dimension_h(dxf, (ox, oy), (ox + b_L, oy), offset=-140.0, text=f"{b_L:.0f}")
        DimensionRenderer.render_aligned_dimension(dxf, (ox + b_L, oy), (ox + b_L, oy + b_t + H), offset=100.0, text=f"{b_t + H:.0f}")
        dxf.add_text(f"CANTILEVER RETAINING WALL (MRW1)", (ox + b_L / 2.0 - 150.0, oy - 200.0), height=3.5, layer="ANNOTATIONS")
