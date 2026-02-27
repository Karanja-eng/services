"""
timber_api.py
=============
FastAPI REST API wrapping the BS 5268 timber design engine.

Run:
    pip install fastapi uvicorn
    uvicorn timber_api:app --reload --port 8000

All engineering logic lives in bs5268_timber_design.py which must be in the
same directory (or on PYTHONPATH).
"""

from __future__ import annotations

import math
import traceback
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException,APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

from .timber_design import *


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _safe_run(fn, *args, **kwargs):
    """Wrap engineering calls and convert exceptions to 422 HTTPException."""
    try:
        return fn(*args, **kwargs)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")


# ---------------------------------------------------------------------------
# Schemas — requests
# ---------------------------------------------------------------------------

StrengthClass = Literal[
    "C14", "C16", "C18", "C22", "C24", "TR26",
    "C27", "C30", "C35", "C40",
    "D30", "D35", "D40", "D50", "D60", "D70",
]

ServiceClass = Literal[1, 2, 3]

LoadDuration = Literal["long_term", "medium_term", "short_term", "very_short_term"]

NotchType = Literal["none", "top", "bottom"]

LateralSupportKey = Literal[
    "no_lateral_support",
    "ends_held_in_position",
    "ends_held_compression_edge_held_purlins",
    "ends_held_compression_edge_held_direct",
    "ends_held_compression_edge_direct_bridging",
    "ends_held_both_edges_firmly",
]

EndConditionKey = Literal[
    "a_both_ends_position_and_direction",
    "b_both_ends_position_one_end_direction",
    "c_both_ends_position_not_direction",
    "d_one_end_position_direction_other_direction_only",
    "e_one_end_position_direction_other_free",
]


class FlexuralMemberRequest(BaseModel):
    strength_class: StrengthClass = Field("C16", description="Timber strength class")
    service_class: ServiceClass = Field(1, description="Service class (1, 2 or 3)")
    load_duration: LoadDuration = Field("long_term", description="Load duration category")
    load_sharing: bool = Field(False, description="True if ≥4 members at ≤610 mm c/c")

    # Section
    b_mm: float = Field(..., gt=0, description="Breadth of section (mm)")
    h_mm: float = Field(..., gt=0, description="Depth of section (mm)")

    # Loading
    clear_span_mm: float = Field(..., gt=0, description="Clear span (mm)")
    bearing_length_mm: float = Field(..., gt=0, description="Bearing length at each end (mm)")
    W_total_N: float = Field(..., gt=0, description="Total UDL on beam (N)")

    # Lateral restraint
    lateral_support_key: LateralSupportKey = Field(
        "ends_held_compression_edge_held_direct",
        description="Degree of lateral support (Table 6.10)",
    )

    # Notch
    notch_type: NotchType = Field("none")
    h_e_mm: float = Field(0.0, ge=0, description="Effective depth at notch (mm)")
    a_notch_mm: float = Field(0.0, ge=0, description="Horizontal notch extent (mm) — top notch only")

    # Bearing
    wane_prohibited_at_bearing: bool = Field(False)
    is_domestic_floor_joist: bool = Field(False)


class CompressionAxialRequest(BaseModel):
    strength_class: StrengthClass = Field("C16")
    service_class: ServiceClass = Field(1)
    load_duration: LoadDuration = Field("long_term")
    load_sharing: bool = Field(False)

    b_mm: float = Field(..., gt=0, description="Least lateral dimension (mm)")
    d_mm: float = Field(..., gt=0, description="Other lateral dimension (mm)")
    actual_length_mm: float = Field(..., gt=0, description="Actual column height (mm)")
    end_condition_key: EndConditionKey = Field("c_both_ends_position_not_direction")
    F_axial_N: float = Field(..., gt=0, description="Axial compressive load (N)")


class CompressionCombinedRequest(BaseModel):
    strength_class: StrengthClass = Field("C16")
    service_class: ServiceClass = Field(1)
    load_duration: LoadDuration = Field("long_term")
    load_sharing: bool = Field(False)

    b_mm: float = Field(..., gt=0)
    d_mm: float = Field(..., gt=0)
    actual_length_mm: float = Field(..., gt=0)
    end_condition_key: EndConditionKey = Field("c_both_ends_position_not_direction")
    F_axial_N: float = Field(..., gt=0)
    M_bending_Nmm: float = Field(..., gt=0, description="Design bending moment (N·mm)")


class StudWallRequest(BaseModel):
    strength_class: StrengthClass = Field("C22")
    service_class: ServiceClass = Field(1)
    load_duration: LoadDuration = Field("long_term")

    b_stud_mm: float = Field(..., gt=0, description="Stud breadth — lesser dim (mm)")
    d_stud_mm: float = Field(..., gt=0, description="Stud depth — greater dim (mm)")
    stud_height_mm: float = Field(..., gt=0)
    stud_spacing_mm: float = Field(..., gt=0, description="Centre-to-centre stud spacing (mm)")
    nogging_spacing_mm: float = Field(..., gt=0, description="Unbraced length about y-y (mm)")
    end_condition_key_x: EndConditionKey = Field("c_both_ends_position_not_direction")
    end_condition_key_y: EndConditionKey = Field("c_both_ends_position_not_direction")


class K7Request(BaseModel):
    h_mm: float = Field(..., gt=0)


class K5Request(BaseModel):
    notch_type: NotchType
    h_mm: float = Field(..., gt=0)
    h_e_mm: float = Field(..., gt=0)
    a_mm: float = Field(0.0, ge=0, description="Required for top notch only")


class K12Request(BaseModel):
    E_min_Nmm2: float = Field(..., gt=0)
    sigma_c_g_par_Nmm2: float = Field(..., gt=0)
    K3: float = Field(1.0, gt=0)
    lambda_val: float = Field(..., ge=0, alias="lambda")

    class Config:
        populate_by_name = True


class SectionPropertiesRequest(BaseModel):
    b_mm: float = Field(..., gt=0)
    h_mm: float = Field(..., gt=0)


# ---------------------------------------------------------------------------
# Schemas — responses (typed for OpenAPI docs)
# ---------------------------------------------------------------------------

class CheckResult(BaseModel):
    utilisation: float
    adequate: bool


class BendingCheckResult(CheckResult):
    M_R_Nmm: float


class DeflectionCheckResult(CheckResult):
    delta_t_mm: float
    delta_m_mm: float
    delta_v_mm: float
    delta_p_mm: float


class LateralBucklingResult(BaseModel):
    d_over_b: float
    max_d_over_b: int
    adequate: bool


class FlexuralMemberResponse(BaseModel):
    strength_class: str
    section: str
    effective_span_mm: float
    K2_bend: float
    K3: float
    K7: float
    K8: float
    K5: float
    E_used_Nmm2: float
    sigma_m_adm_Nmm2: float
    bending: BendingCheckResult
    deflection: DeflectionCheckResult
    lateral_buckling: LateralBucklingResult
    tau_adm_Nmm2: float
    tau_a_Nmm2: float
    shear: CheckResult
    sigma_c_adm_perp_Nmm2: float
    sigma_c_a_perp_Nmm2: float
    bearing: CheckResult
    overall_adequate: bool
    summary: str


class CompressionAxialResponse(BaseModel):
    strength_class: str
    section: str
    L_e_mm: float
    i_min_mm: float
    lambda_val: float
    K12: float
    sigma_c_par_Nmm2: float
    E_min_sigma_ratio: float
    sigma_c_adm_Nmm2: float
    sigma_c_a_Nmm2: float
    axial_check: CheckResult
    axial_load_capacity_kN: float
    overall_adequate: bool
    summary: str


class CompressionCombinedResponse(BaseModel):
    strength_class: str
    section: str
    L_e_mm: float
    i_min_mm: float
    lambda_val: float
    K12: float
    K7: float
    sigma_c_adm_Nmm2: float
    sigma_m_adm_Nmm2: float
    sigma_e_Nmm2: float
    sigma_c_a_Nmm2: float
    sigma_m_a_Nmm2: float
    interaction_value: float
    amplification_denom: float
    overall_adequate: bool
    summary: str


class StudWallResponse(BaseModel):
    strength_class: str
    stud_section: str
    stud_spacing_mm: float
    load_sharing: bool
    K8: float
    K12: float
    lam_xx: float
    lam_yy: float
    lam_crit: float
    sigma_c_adm_Nmm2: float
    load_capacity_per_stud_kN: float
    load_capacity_per_m_kNm: float
    summary: str


class SectionPropertiesResponse(BaseModel):
    b_mm: float
    h_mm: float
    area_mm2: float
    Z_xx_mm3: float
    Z_yy_mm3: float
    I_xx_mm4: float
    I_yy_mm4: float
    i_xx_mm: float
    i_yy_mm: float


# ---------------------------------------------------------------------------
# Utility endpoints
# ---------------------------------------------------------------------------

@router.get("/", tags=["Info"])
def root():
    return {
        "title": "BS 5268 Timber Design API",
        "standard": "BS 5268: Part 2: 2002",
        "units": "N, mm throughout",
        "endpoints": [
            "/strength-classes",
            "/section-properties",
            "/factors/K7",
            "/factors/K5",
            "/factors/K12",
            "/design/flexural-member",
            "/design/compression-axial",
            "/design/compression-combined",
            "/design/stud-wall",
        ],
    }


@router.get("/strength-classes", tags=["Reference"])
def get_strength_classes():
    """Return all strength class grade stresses and moduli (Table 6.3, BS 5268)."""
    result = {}
    for cls, props in bs.STRENGTH_CLASS_TABLE.items():
        result[cls] = {
            "bending_parallel_Nmm2":              props.sigma_m_g_par,
            "tension_parallel_Nmm2":              props.sigma_t_g_par,
            "compression_parallel_Nmm2":          props.sigma_c_g_par,
            "compression_perpendicular_Nmm2":     props.sigma_c_g_perp,
            "compression_perp_no_wane_Nmm2":      props.sigma_c_g_perp_no_wane,
            "shear_parallel_Nmm2":                props.tau_g,
            "E_mean_Nmm2":                        props.E_mean,
            "E_min_Nmm2":                         props.E_min,
            "characteristic_density_kgm3":        props.rho_k,
            "average_density_kgm3":               props.rho_mean,
        }
    return result


@router.post("/section-properties", response_model=SectionPropertiesResponse, tags=["Reference"])
def section_properties(req: SectionPropertiesRequest):
    """Compute geometric properties of a rectangular timber section."""
    b, h = req.b_mm, req.h_mm
    A = b * h
    Z_xx = bs.section_modulus_xx(b, h)
    Z_yy = bs.section_modulus_xx(h, b)   # swap b/h for y-y
    I_xx = bs.second_moment_of_area_xx(b, h)
    I_yy = bs.second_moment_of_area_yy(b, h)
    i_xx = math.sqrt(I_xx / A)
    i_yy = math.sqrt(I_yy / A)
    return SectionPropertiesResponse(
        b_mm=b, h_mm=h, area_mm2=A,
        Z_xx_mm3=Z_xx, Z_yy_mm3=Z_yy,
        I_xx_mm4=I_xx, I_yy_mm4=I_yy,
        i_xx_mm=i_xx, i_yy_mm=i_yy,
    )


@router.get("/factors/K3", tags=["Factors"])
def get_k3_table():
    """Return all K3 load duration factors (Table 6.5, BS 5268)."""
    return bs.K3_VALUES


@router.get("/factors/lateral-support", tags=["Factors"])
def get_lateral_support_table():
    """Return maximum d/b ratios for each lateral support condition (Table 6.10)."""
    return bs.LATERAL_SUPPORT_MAX_DB


@router.get("/factors/end-conditions", tags=["Factors"])
def get_end_conditions():
    """Return effective length coefficients for compression members (Table 6.11)."""
    return bs.EFFECTIVE_LENGTH_COEFFICIENTS


@router.post("/factors/K7", tags=["Factors"])
def compute_K7(req: K7Request):
    """Compute depth factor K7 for a given section depth (clause 2.10.6, BS 5268)."""
    K7 = _safe_run(bs.compute_K7, req.h_mm)
    return {"h_mm": req.h_mm, "K7": round(K7, 4)}


@router.post("/factors/K5", tags=["Factors"])
def compute_K5(req: K5Request):
    """Compute notched-ends factor K5 (clause 2.10.4, BS 5268 / Eq. 6.1–6.3)."""
    if req.notch_type == "none":
        return {"K5": 1.0, "note": "No notch — K5 = 1.0"}
    elif req.notch_type == "top":
        K5 = _safe_run(bs.compute_K5_top_notch, req.h_mm, req.h_e_mm, req.a_mm)
    else:
        K5 = _safe_run(bs.compute_K5_bottom_notch, req.h_mm, req.h_e_mm)
    return {"notch_type": req.notch_type, "h_mm": req.h_mm,
            "h_e_mm": req.h_e_mm, "K5": round(K5, 4)}


@router.post("/factors/K12", tags=["Factors"])
def compute_K12(req: K12Request):
    """
    Compute compression modification factor K12 by bilinear interpolation of
    Table 6.6 (Table 22, BS 5268).
    """
    sigma_c_par = _safe_run(
        bs.compression_stress_sigma_c_par, req.sigma_c_g_par_Nmm2, req.K3
    )
    K12 = _safe_run(bs.compute_K12, req.E_min_Nmm2, sigma_c_par, req.lambda_val)
    return {
        "E_min_Nmm2":        req.E_min_Nmm2,
        "sigma_c_par_Nmm2":  sigma_c_par,
        "E_sigma_ratio":     round(req.E_min_Nmm2 / sigma_c_par, 2),
        "lambda":            req.lambda_val,
        "K12":               round(K12, 4),
    }


# ---------------------------------------------------------------------------
# Design endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/design/flexural-member",
    response_model=FlexuralMemberResponse,
    tags=["Design"],
)
def design_flexural_member(req: FlexuralMemberRequest):
    """
    Full design check for a simply-supported timber beam/joist to BS 5268.
    Checks: bending, deflection, lateral buckling, shear, bearing.
    """
    eff_span = bs.compute_effective_span(req.clear_span_mm, req.bearing_length_mm)
    M = req.W_total_N * eff_span / 8.0
    F_v = req.W_total_N / 2.0
    F_bearing = req.W_total_N / 2.0

    result = _safe_run(
        bs.design_flexural_member,
        strength_class=req.strength_class,
        service_class=req.service_class,
        load_duration=req.load_duration,
        load_sharing=req.load_sharing,
        M=M,
        F_v=F_v,
        F_bearing=F_bearing,
        span=eff_span,
        W_total=req.W_total_N,
        b=req.b_mm,
        h=req.h_mm,
        bearing_length=req.bearing_length_mm,
        lateral_support_key=req.lateral_support_key,
        is_domestic_floor_joist=req.is_domestic_floor_joist,
        notch_type=req.notch_type,
        h_e=req.h_e_mm,
        a_notch=req.a_notch_mm,
        wane_prohibited_at_bearing=req.wane_prohibited_at_bearing,
    )

    adequate = result["overall_adequate"]
    summary = (
        "✅ Section adequate — all five checks pass."
        if adequate
        else "❌ Section inadequate — review failed checks."
    )

    bend = result["bending"]
    defl = result["deflection"]
    lb   = result["lateral_buckling"]
    shear= result["shear"]
    bear = result["bearing"]

    return FlexuralMemberResponse(
        strength_class=result["strength_class"],
        section=result["section"],
        effective_span_mm=round(eff_span, 1),
        K2_bend=round(result["K2_bend"], 3),
        K3=round(result["K3"], 3),
        K7=round(result["K7"], 4),
        K8=round(result["K8"], 3),
        K5=round(result["K5"], 4),
        E_used_Nmm2=round(result["E_used_Nmm2"], 1),
        sigma_m_adm_Nmm2=round(result["sigma_m_adm_Nmm2"], 4),
        bending=BendingCheckResult(
            M_R_Nmm=round(bend["M_R"], 1),
            utilisation=round(bend["utilisation"], 4),
            adequate=bend["adequate"],
        ),
        deflection=DeflectionCheckResult(
            delta_t_mm=round(result["delta_t_mm"], 3),
            delta_m_mm=round(result["delta_m_mm"], 3),
            delta_v_mm=round(result["delta_v_mm"], 3),
            delta_p_mm=round(result["delta_p_mm"], 3),
            utilisation=round(defl["utilisation"], 4),
            adequate=defl["adequate"],
        ),
        lateral_buckling=LateralBucklingResult(
            d_over_b=round(lb["d_over_b"], 3),
            max_d_over_b=lb["max_d_over_b"],
            adequate=lb["adequate"],
        ),
        tau_adm_Nmm2=round(result["tau_adm_Nmm2"], 4),
        tau_a_Nmm2=round(result["tau_a_Nmm2"], 4),
        shear=CheckResult(
            utilisation=round(shear["utilisation"], 4),
            adequate=shear["adequate"],
        ),
        sigma_c_adm_perp_Nmm2=round(result["sigma_c_adm_perp"], 4),
        sigma_c_a_perp_Nmm2=round(result["sigma_c_a_perp"], 4),
        bearing=CheckResult(
            utilisation=round(bear["utilisation"], 4),
            adequate=bear["adequate"],
        ),
        overall_adequate=adequate,
        summary=summary,
    )


@router.post(
    "/design/compression-axial",
    response_model=CompressionAxialResponse,
    tags=["Design"],
)
def design_compression_axial(req: CompressionAxialRequest):
    """
    Design check for a timber column subject to axial compression only
    (clause 6.8.4.1, BS 5268).
    """
    result = _safe_run(
        bs.design_compression_member_axial_only,
        strength_class=req.strength_class,
        service_class=req.service_class,
        load_duration=req.load_duration,
        load_sharing=req.load_sharing,
        L=req.actual_length_mm,
        end_condition_key=req.end_condition_key,
        b=req.b_mm,
        d=req.d_mm,
        F_axial=req.F_axial_N,
    )
    adequate = result["overall_adequate"]
    axial = result["axial_check"]
    return CompressionAxialResponse(
        strength_class=result["strength_class"],
        section=result["section"],
        L_e_mm=round(result["L_e_mm"], 1),
        i_min_mm=round(result["i_min_mm"], 4),
        lambda_val=round(result["lambda"], 2),
        K12=round(result["K12"], 4),
        sigma_c_par_Nmm2=round(result["sigma_c_par_Nmm2"], 4),
        E_min_sigma_ratio=round(result["E_min_sigma_ratio"], 2),
        sigma_c_adm_Nmm2=round(result["sigma_c_adm_Nmm2"], 4),
        sigma_c_a_Nmm2=round(result["sigma_c_a_Nmm2"], 4),
        axial_check=CheckResult(
            utilisation=round(axial["utilisation"], 4),
            adequate=axial["adequate"],
        ),
        axial_load_capacity_kN=round(result["axial_load_capacity_N"] / 1000.0, 2),
        overall_adequate=adequate,
        summary="✅ Column adequate." if adequate else "❌ Column inadequate.",
    )


@router.post(
    "/design/compression-combined",
    response_model=CompressionCombinedResponse,
    tags=["Design"],
)
def design_compression_combined(req: CompressionCombinedRequest):
    """
    Design check for a timber column subject to combined axial compression and
    bending (clause 6.8.4.2, Eq. 6.28, BS 5268).
    """
    result = _safe_run(
        bs.design_compression_member_combined,
        strength_class=req.strength_class,
        service_class=req.service_class,
        load_duration=req.load_duration,
        load_sharing=req.load_sharing,
        L=req.actual_length_mm,
        end_condition_key=req.end_condition_key,
        b=req.b_mm,
        d=req.d_mm,
        F_axial=req.F_axial_N,
        M_bending=req.M_bending_Nmm,
    )
    inter = result["interaction"]
    adequate = result["overall_adequate"]
    return CompressionCombinedResponse(
        strength_class=result["strength_class"],
        section=result["section"],
        L_e_mm=round(result["L_e_mm"], 1),
        i_min_mm=round(result["i_min_mm"], 4),
        lambda_val=round(result["lambda"], 2),
        K12=round(result["K12"], 4),
        K7=round(result["K7"], 4),
        sigma_c_adm_Nmm2=round(result["sigma_c_adm_Nmm2"], 4),
        sigma_m_adm_Nmm2=round(result["sigma_m_adm_Nmm2"], 4),
        sigma_e_Nmm2=round(result["sigma_e_Nmm2"], 4),
        sigma_c_a_Nmm2=round(result["sigma_c_a_Nmm2"], 4),
        sigma_m_a_Nmm2=round(result["sigma_m_a_Nmm2"], 4),
        interaction_value=round(inter["interaction_value"], 4),
        amplification_denom=round(inter["amplification_denom"], 4),
        overall_adequate=adequate,
        summary=(
            "✅ Column adequate under combined loading."
            if adequate else
            "❌ Column inadequate under combined loading."
        ),
    )


@router.post(
    "/design/stud-wall",
    response_model=StudWallResponse,
    tags=["Design"],
)
def design_stud_wall(req: StudWallRequest):
    """
    Analyse axial load capacity of a timber stud wall panel (clause 6.9, BS 5268).
    Load-sharing (K8 = 1.1) applied automatically when stud spacing ≤ 610 mm.
    """
    result = _safe_run(
        bs.analyse_stud_wall,
        strength_class=req.strength_class,
        service_class=req.service_class,
        load_duration=req.load_duration,
        stud_height=req.stud_height_mm,
        b_stud=req.b_stud_mm,
        d_stud=req.d_stud_mm,
        stud_spacing=req.stud_spacing_mm,
        nogging_spacing=req.nogging_spacing_mm,
        end_condition_key_x=req.end_condition_key_x,
        end_condition_key_y=req.end_condition_key_y,
    )
    return StudWallResponse(
        strength_class=result["strength_class"],
        stud_section=result["stud_section"],
        stud_spacing_mm=result["stud_spacing_mm"],
        load_sharing=result["load_sharing"],
        K8=round(result["K8"], 3),
        K12=round(result["K12"], 4),
        lam_xx=round(result["lam_xx"], 2),
        lam_yy=round(result["lam_yy"], 2),
        lam_crit=round(result["lam_crit"], 2),
        sigma_c_adm_Nmm2=round(result["sigma_c_adm_Nmm2"], 4),
        load_capacity_per_stud_kN=round(result["load_capacity_per_stud_kN"], 3),
        load_capacity_per_m_kNm=round(result["load_capacity_per_m_kNm"], 3),
        summary=(
            f"Stud wall capacity: "
            f"{result['load_capacity_per_stud_kN']:.2f} kN/stud | "
            f"{result['load_capacity_per_m_kNm']:.2f} kN/m run"
        ),
    )