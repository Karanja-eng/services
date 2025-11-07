"""
Professional Steel Design API - BS 5950:2000
FastAPI Backend for Steel Beam, Column, and Frame Analysis
"""

from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import math
from enum import Enum

router = APIRouter()


# Steel Section Database (BS 5950 - Universal Beams & Columns)
class SteelSection(BaseModel):
    designation: str
    depth: float  # mm
    width: float  # mm
    tw: float  # web thickness, mm
    tf: float  # flange thickness, mm
    r: float  # root radius, mm
    area: float  # cm²
    Ix: float  # cm⁴
    Iy: float  # cm⁴
    Zx: float  # cm³
    Zy: float  # cm³
    rx: float  # mm
    ry: float  # mm


# Universal Beams
UB_SECTIONS = [
    SteelSection(
        designation="914x419x388",
        depth=921.0,
        width=420.5,
        tw=21.4,
        tf=36.6,
        r=24.1,
        area=494.0,
        Ix=504000,
        Iy=47200,
        Zx=11000,
        Zy=2250,
        rx=319,
        ry=97.9,
    ),
    SteelSection(
        designation="914x305x289",
        depth=926.6,
        width=307.7,
        tw=19.5,
        tf=32.0,
        r=19.1,
        area=368.0,
        Ix=404000,
        Iy=20500,
        Zx=8720,
        Zy=1330,
        rx=331,
        ry=74.6,
    ),
    SteelSection(
        designation="838x292x226",
        depth=850.9,
        width=293.8,
        tw=16.1,
        tf=26.8,
        r=17.8,
        area=288.0,
        Ix=285000,
        Iy=16500,
        Zx=6700,
        Zy=1120,
        rx=315,
        ry=75.7,
    ),
    SteelSection(
        designation="762x267x197",
        depth=769.8,
        width=268.0,
        tw=15.6,
        tf=25.4,
        r=16.5,
        area=251.0,
        Ix=204000,
        Iy=12800,
        Zx=5300,
        Zy=953,
        rx=285,
        ry=71.4,
    ),
    SteelSection(
        designation="686x254x170",
        depth=692.9,
        width=255.8,
        tw=14.5,
        tf=23.7,
        r=15.2,
        area=217.0,
        Ix=150000,
        Iy=10200,
        Zx=4330,
        Zy=800,
        rx=263,
        ry=68.5,
    ),
    SteelSection(
        designation="610x305x238",
        depth=633.0,
        width=311.4,
        tw=18.6,
        tf=31.4,
        r=16.5,
        area=303.0,
        Ix=198000,
        Iy=23100,
        Zx=6260,
        Zy=1480,
        rx=256,
        ry=87.4,
    ),
    SteelSection(
        designation="610x229x140",
        depth=617.2,
        width=230.2,
        tw=13.1,
        tf=19.6,
        r=12.7,
        area=179.0,
        Ix=98400,
        Iy=5960,
        Zx=3190,
        Zy=518,
        rx=234,
        ry=57.7,
    ),
    SteelSection(
        designation="533x210x122",
        depth=544.5,
        width=211.9,
        tw=12.7,
        tf=21.3,
        r=12.7,
        area=155.0,
        Ix=73700,
        Iy=5500,
        Zx=2710,
        Zy=519,
        rx=218,
        ry=59.6,
    ),
    SteelSection(
        designation="457x191x98",
        depth=467.2,
        width=192.8,
        tw=11.4,
        tf=19.6,
        r=10.2,
        area=125.0,
        Ix=49500,
        Iy=4050,
        Zx=2120,
        Zy=421,
        rx=199,
        ry=56.9,
    ),
    SteelSection(
        designation="457x152x82",
        depth=465.1,
        width=153.5,
        tw=10.5,
        tf=18.9,
        r=10.2,
        area=105.0,
        Ix=41100,
        Iy=1870,
        Zx=1770,
        Zy=243,
        rx=198,
        ry=42.2,
    ),
    SteelSection(
        designation="406x178x74",
        depth=412.8,
        width=179.5,
        tw=9.5,
        tf=16.0,
        r=10.2,
        area=94.5,
        Ix=30800,
        Iy=2920,
        Zx=1490,
        Zy=326,
        rx=181,
        ry=55.6,
    ),
    SteelSection(
        designation="356x171x67",
        depth=363.4,
        width=173.2,
        tw=9.1,
        tf=15.7,
        r=10.2,
        area=85.5,
        Ix=22200,
        Iy=2490,
        Zx=1220,
        Zy=287,
        rx=161,
        ry=53.9,
    ),
    SteelSection(
        designation="305x165x54",
        depth=310.4,
        width=166.9,
        tw=7.9,
        tf=13.7,
        r=8.9,
        area=68.4,
        Ix=12400,
        Iy=1870,
        Zx=802,
        Zy=224,
        rx=135,
        ry=52.3,
    ),
    SteelSection(
        designation="305x127x48",
        depth=311.0,
        width=125.2,
        tw=9.0,
        tf=14.0,
        r=8.9,
        area=61.0,
        Ix=10900,
        Iy=816,
        Zx=703,
        Zy=130,
        rx=134,
        ry=36.6,
    ),
    SteelSection(
        designation="254x146x43",
        depth=259.6,
        width=147.3,
        tw=7.2,
        tf=12.7,
        r=7.6,
        area=54.8,
        Ix=7840,
        Iy=1450,
        Zx=604,
        Zy=197,
        rx=120,
        ry=51.4,
    ),
    SteelSection(
        designation="254x102x28",
        depth=260.4,
        width=102.2,
        tw=6.3,
        tf=10.0,
        r=7.6,
        area=36.0,
        Ix=4010,
        Iy=358,
        Zx=308,
        Zy=70.1,
        rx=105,
        ry=31.5,
    ),
    SteelSection(
        designation="203x133x30",
        depth=206.8,
        width=133.9,
        tw=6.4,
        tf=9.6,
        r=7.6,
        area=38.2,
        Ix=3070,
        Iy=786,
        Zx=297,
        Zy=117,
        rx=89.6,
        ry=45.4,
    ),
    SteelSection(
        designation="178x102x19",
        depth=177.8,
        width=101.2,
        tw=4.8,
        tf=7.9,
        r=7.6,
        area=24.3,
        Ix=1360,
        Iy=250,
        Zx=153,
        Zy=49.4,
        rx=74.9,
        ry=32.1,
    ),
    SteelSection(
        designation="152x89x16",
        depth=152.4,
        width=88.7,
        tw=4.5,
        tf=7.7,
        r=7.6,
        area=20.3,
        Ix=834,
        Iy=155,
        Zx=109,
        Zy=34.9,
        rx=64.1,
        ry=27.6,
    ),
    SteelSection(
        designation="127x76x13",
        depth=127.0,
        width=76.0,
        tw=4.0,
        tf=7.6,
        r=7.6,
        area=16.5,
        Ix=473,
        Iy=104,
        Zx=74.5,
        Zy=27.3,
        rx=53.6,
        ry=25.1,
    ),
]

# Universal Columns
UC_SECTIONS = [
    SteelSection(
        designation="356x406x634",
        depth=474.6,
        width=424.0,
        tw=47.6,
        tf=77.0,
        r=15.2,
        area=808.0,
        Ix=272000,
        Iy=131000,
        Zx=11500,
        Zy=6180,
        rx=581,
        ry=403,
    ),
    SteelSection(
        designation="356x406x551",
        depth=455.6,
        width=418.5,
        tw=42.1,
        tf=67.5,
        r=15.2,
        area=702.0,
        Ix=228000,
        Iy=111000,
        Zx=10000,
        Zy=5310,
        rx=570,
        ry=397,
    ),
    SteelSection(
        designation="356x368x202",
        depth=374.6,
        width=374.7,
        tw=19.9,
        tf=30.2,
        r=15.2,
        area=257.0,
        Ix=84800,
        Iy=39800,
        Zx=4530,
        Zy=2130,
        rx=575,
        ry=393,
    ),
    SteelSection(
        designation="305x305x283",
        depth=365.3,
        width=321.8,
        tw=26.9,
        tf=44.1,
        r=15.2,
        area=361.0,
        Ix=111000,
        Iy=52100,
        Zx=6070,
        Zy=3240,
        rx=554,
        ry=380,
    ),
    SteelSection(
        designation="305x305x240",
        depth=352.5,
        width=318.4,
        tw=23.0,
        tf=37.7,
        r=15.2,
        area=306.0,
        Ix=92700,
        Iy=43600,
        Zx=5260,
        Zy=2740,
        rx=550,
        ry=377,
    ),
    SteelSection(
        designation="305x305x198",
        depth=339.9,
        width=314.5,
        tw=19.1,
        tf=31.4,
        r=15.2,
        area=252.0,
        Ix=75500,
        Iy=35600,
        Zx=4440,
        Zy=2260,
        rx=547,
        ry=376,
    ),
    SteelSection(
        designation="254x254x167",
        depth=289.1,
        width=265.2,
        tw=19.2,
        tf=31.7,
        r=12.7,
        area=213.0,
        Ix=49100,
        Iy=23200,
        Zx=3400,
        Zy=1750,
        rx=480,
        ry=330,
    ),
    SteelSection(
        designation="254x254x132",
        depth=276.3,
        width=261.3,
        tw=15.3,
        tf=25.3,
        r=12.7,
        area=168.0,
        Ix=38700,
        Iy=18300,
        Zx=2800,
        Zy=1400,
        rx=480,
        ry=330,
    ),
    SteelSection(
        designation="254x254x107",
        depth=266.7,
        width=258.8,
        tw=12.8,
        tf=20.5,
        r=12.7,
        area=137.0,
        Ix=31000,
        Iy=14700,
        Zx=2320,
        Zy=1140,
        rx=476,
        ry=328,
    ),
    SteelSection(
        designation="203x203x86",
        depth=222.2,
        width=209.1,
        tw=12.7,
        tf=20.5,
        r=10.2,
        area=110.0,
        Ix=18300,
        Iy=8640,
        Zx=1650,
        Zy=827,
        rx=408,
        ry=280,
    ),
    SteelSection(
        designation="203x203x71",
        depth=215.8,
        width=206.4,
        tw=10.3,
        tf=17.3,
        r=10.2,
        area=90.8,
        Ix=15100,
        Iy=7150,
        Zx=1400,
        Zy=693,
        rx=408,
        ry=281,
    ),
    SteelSection(
        designation="203x203x60",
        depth=209.6,
        width=205.2,
        tw=9.4,
        tf=14.2,
        r=10.2,
        area=75.8,
        Ix=12400,
        Iy=5880,
        Zx=1180,
        Zy=573,
        rx=404,
        ry=278,
    ),
    SteelSection(
        designation="152x152x37",
        depth=161.8,
        width=154.4,
        tw=8.0,
        tf=11.5,
        r=7.6,
        area=47.4,
        Ix=4880,
        Iy=2320,
        Zx=603,
        Zy=301,
        rx=321,
        ry=221,
    ),
    SteelSection(
        designation="152x152x30",
        depth=157.6,
        width=152.9,
        tw=6.5,
        tf=9.4,
        r=7.6,
        area=38.2,
        Ix=3990,
        Iy=1900,
        Zx=506,
        Zy=248,
        rx=323,
        ry=223,
    ),
    SteelSection(
        designation="152x152x23",
        depth=152.4,
        width=152.2,
        tw=5.8,
        tf=6.8,
        r=7.6,
        area=29.8,
        Ix=2900,
        Iy=1390,
        Zx=381,
        Zy=183,
        rx=312,
        ry=216,
    ),
]

STEEL_SECTIONS = {
    "UB": {s.designation: s for s in UB_SECTIONS},
    "UC": {s.designation: s for s in UC_SECTIONS},
}


# Material Properties (BS 5950)
class SteelGrade(str, Enum):
    S275 = "S275"
    S355 = "S355"
    S450 = "S450"


MATERIAL_PROPERTIES = {
    SteelGrade.S275: {"fy": 275, "fu": 430, "E": 210000},
    SteelGrade.S355: {"fy": 355, "fu": 510, "E": 210000},
    SteelGrade.S450: {"fy": 450, "fu": 550, "E": 210000},
}


# Request/Response Models
class BeamDesignRequest(BaseModel):
    span: float = Field(..., gt=0, description="Span length in meters")
    udl: float = Field(..., ge=0, description="Uniformly distributed load in kN/m")
    point_load: float = Field(default=0, ge=0, description="Point load in kN")
    point_load_position: float = Field(
        default=0, ge=0, description="Point load position from left in meters"
    )
    grade: SteelGrade
    section: str
    section_type: str = Field(..., description="UB or UC")


class ColumnDesignRequest(BaseModel):
    height: float = Field(..., gt=0, description="Column height in meters")
    axial_load: float = Field(..., gt=0, description="Axial load in kN")
    moment_major: float = Field(default=0, ge=0, description="Major axis moment in kNm")
    moment_minor: float = Field(default=0, ge=0, description="Minor axis moment in kNm")
    grade: SteelGrade
    section: str
    section_type: str
    effective_length_major: float = Field(
        default=1.0, gt=0, description="Effective length factor for major axis"
    )
    effective_length_minor: float = Field(
        default=1.0, gt=0, description="Effective length factor for minor axis"
    )


class SpanData(BaseModel):
    length: float
    load: float


class FrameAnalysisRequest(BaseModel):
    method: str = Field(..., description="moment-distribution or slope-deflection")
    spans: List[SpanData]
    supports: List[str]


class BeamDesignResponse(BaseModel):
    section: str
    classification: str
    M_max: float
    V_max: float
    Mc: float
    Mb: float
    Pv: float
    delta_max: float
    delta_limit: float
    bending_ratio: float
    shear_ratio: float
    deflection_ratio: float
    passed: bool
    py: float
    epsilon: float
    lambda_LT: float


class ColumnDesignResponse(BaseModel):
    section: str
    P: float
    Pc: float
    Mx: float
    My: float
    Mcx: float
    Mcy: float
    lambda_: float
    lambda_x: float
    lambda_y: float
    pc: float
    axial_ratio: float
    moment_ratio: float
    interaction: float
    passed: bool


class DiagramPoint(BaseModel):
    x: float
    M: float
    V: float


class SpanDiagram(BaseModel):
    span: int
    points: List[DiagramPoint]


class FrameAnalysisResponse(BaseModel):
    method: str
    diagrams: List[SpanDiagram]
    max_moment: float
    max_shear: float


# Helper Functions
def get_section(section_type: str, designation: str) -> SteelSection:
    """Retrieve steel section properties"""
    if section_type not in STEEL_SECTIONS:
        raise HTTPException(
            status_code=400, detail=f"Invalid section type: {section_type}"
        )

    if designation not in STEEL_SECTIONS[section_type]:
        raise HTTPException(
            status_code=400, detail=f"Section {designation} not found in {section_type}"
        )

    return STEEL_SECTIONS[section_type][designation]


def classify_section(section: SteelSection, py: float) -> str:
    """Classify section according to BS 5950 Table 11"""
    epsilon = math.sqrt(275 / py)

    b_t_flange = (section.width / 2) / section.tf
    d_t_web = (section.depth - 2 * section.tf) / section.tw

    # Simplified classification
    if b_t_flange <= 9 * epsilon and d_t_web <= 80 * epsilon:
        return "Plastic"
    elif b_t_flange <= 10 * epsilon and d_t_web <= 100 * epsilon:
        return "Compact"
    elif b_t_flange <= 15 * epsilon and d_t_web <= 120 * epsilon:
        return "Semi-compact"
    else:
        return "Slender"


# API Endpoints
@router.get("/")
async def root():
    return {
        "message": "Steel Design API - BS 5950:2000",
        "version": "1.0.0",
        "endpoints": {
            "beam_design": "/api/beam-design",
            "column_design": "/api/column-design",
            "frame_analysis": "/api/frame-analysis",
            "sections": "/api/sections",
        },
    }


@router.get("/api/sections/{section_type}")
async def get_sections(section_type: str):
    """Get available steel sections"""
    if section_type not in STEEL_SECTIONS:
        raise HTTPException(
            status_code=400, detail="Invalid section type. Use 'UB' or 'UC'"
        )

    return list(STEEL_SECTIONS[section_type].keys())


@router.post("/api/beam-design", response_model=BeamDesignResponse)
async def design_beam(request: BeamDesignRequest):
    """Design steel beam according to BS 5950"""

    # Get section properties
    section = get_section(request.section_type, request.section)
    material = MATERIAL_PROPERTIES[request.grade]

    # Convert units
    L = request.span * 1000  # mm
    w = request.udl  # kN/m
    P = request.point_load  # kN
    a = request.point_load_position * 1000  # mm

    # Calculate maximum bending moment (BS 5950 Cl 4.2.5)
    M_udl = (w * L**2) / 8000  # kNm
    M_point = (P * a * (L - a)) / (L * 1000) if P > 0 else 0  # kNm
    M_max = M_udl + M_point

    # Calculate maximum shear
    V_udl = (w * L) / 2000  # kN
    V_point = max(P * (L - a) / L, P * a / L) if P > 0 else 0
    V_max = V_udl + V_point

    # Design strength
    py = material["fy"]

    # Section classification
    classification = classify_section(section, py)

    # Moment capacity (BS 5950 Cl 4.2.5)
    Mc = (section.Zx * py) / 1_000_000  # kNm

    # Shear capacity (BS 5950 Cl 4.2.3)
    Av = section.depth * section.tw  # mm²
    Pv = (0.6 * py * Av) / 1000  # kN

    # Lateral torsional buckling (BS 5950 Cl 4.3)
    lambda_LT = (L / section.ry) * math.sqrt(py / 275)
    pb = py / (1 + 0.0005 * lambda_LT**2)  # Simplified
    Mb = (section.Zx * pb) / 1_000_000  # kNm

    # Deflection check (serviceability)
    I = section.Ix * 10000  # mm⁴
    delta_udl = (5 * w * L**4) / (384 * material["E"] * I)
    delta_point = (
        (P * a * (L - a) ** 2 * math.sqrt(3 * a * (L - a)))
        / (27 * material["E"] * I * L)
        if P > 0
        else 0
    )
    delta_max = delta_udl + delta_point
    delta_limit = L / 360

    # Utilization ratios
    bending_ratio = M_max / Mb
    shear_ratio = V_max / Pv
    deflection_ratio = delta_max / delta_limit

    passed = bending_ratio <= 1.0 and shear_ratio <= 1.0 and deflection_ratio <= 1.0

    return BeamDesignResponse(
        section=section.designation,
        classification=classification,
        M_max=round(M_max, 2),
        V_max=round(V_max, 2),
        Mc=round(Mc, 2),
        Mb=round(Mb, 2),
        Pv=round(Pv, 2),
        delta_max=round(delta_max, 2),
        delta_limit=round(delta_limit, 2),
        bending_ratio=round(bending_ratio * 100, 1),
        shear_ratio=round(shear_ratio * 100, 1),
        deflection_ratio=round(deflection_ratio * 100, 1),
        passed=passed,
        py=py,
        epsilon=round(math.sqrt(275 / py), 3),
        lambda_LT=round(lambda_LT, 1),
    )


@router.post("/api/column-design", response_model=ColumnDesignResponse)
async def design_column(request: ColumnDesignRequest):
    """Design steel column according to BS 5950"""

    # Get section properties
    section = get_section(request.section_type, request.section)
    material = MATERIAL_PROPERTIES[request.grade]

    L = request.height * 1000  # mm
    P = request.axial_load  # kN
    Mx = request.moment_major  # kNm
    My = request.moment_minor  # kNm
    py = material["fy"]

    # Effective lengths
    LE_x = L * request.effective_length_major
    LE_y = L * request.effective_length_minor

    # Slenderness ratios (BS 5950 Cl 4.7.3)
    lambda_x = LE_x / section.rx
    lambda_y = LE_y / section.ry
    lambda_ = max(lambda_x, lambda_y)

    # Compression resistance (BS 5950 Cl 4.7.4)
    lambda_0 = math.pi * math.sqrt(material["E"] / py)
    phi = 0.5 * (1 + 0.001 * lambda_ * (lambda_ - lambda_0) + (lambda_ / lambda_0) ** 2)
    chi = min(1.0, 1 / (phi + math.sqrt(phi**2 - (lambda_ / lambda_0) ** 2)))
    pc = chi * py
    Pc = (section.area * 100 * pc) / 1000  # kN

    # Moment capacities
    Mcx = (section.Zx * py) / 1_000_000  # kNm
    Mcy = (section.Zy * py) / 1_000_000  # kNm

    # Interaction check (BS 5950 Cl 4.8.3.3)
    axial_ratio = P / Pc
    moment_ratio = (Mx / Mcx) + (My / Mcy)
    interaction = axial_ratio + moment_ratio

    passed = interaction <= 1.0 and axial_ratio <= 1.0

    return ColumnDesignResponse(
        section=section.designation,
        P=P,
        Pc=round(Pc, 2),
        Mx=Mx,
        My=My,
        Mcx=round(Mcx, 2),
        Mcy=round(Mcy, 2),
        lambda_=round(lambda_, 1),
        lambda_x=round(lambda_x, 1),
        lambda_y=round(lambda_y, 1),
        pc=round(pc, 1),
        axial_ratio=round(axial_ratio * 100, 1),
        moment_ratio=round(moment_ratio * 100, 1),
        interaction=round(interaction * 100, 1),
        passed=passed,
    )


@router.post("/api/frame-analysis", response_model=FrameAnalysisResponse)
async def analyze_frame(request: FrameAnalysisRequest):
    """Analyze continuous beam/frame"""

    diagrams = []
    all_moments = []
    all_shears = []

    for i, span in enumerate(request.spans):
        L = span.length
        w = span.load

        # Generate points along span
        points = []
        num_points = 21

        for j in range(num_points):
            x = (j / (num_points - 1)) * L

            # Calculate moment and shear at position x
            # For simply supported beam with UDL
            M = (w * L * x / 2) - (w * x**2 / 2)
            V = (w * L / 2) - (w * x)

            points.append(DiagramPoint(x=round(x, 2), M=round(M, 2), V=round(V, 2)))

            all_moments.append(abs(M))
            all_shears.append(abs(V))

        diagrams.append(SpanDiagram(span=i + 1, points=points))

    max_moment = round(max(all_moments), 2) if all_moments else 0
    max_shear = round(max(all_shears), 2) if all_shears else 0

    return FrameAnalysisResponse(
        method=request.method,
        diagrams=diagrams,
        max_moment=max_moment,
        max_shear=max_shear,
    )


@router.get("/api/material-properties")
async def get_material_properties():
    """Get steel grade properties"""
    return {grade.value: props for grade, props in MATERIAL_PROPERTIES.items()}


@router.get("/api/section-properties/{section_type}/{designation}")
async def get_section_properties(section_type: str, designation: str):
    """Get detailed section properties"""
    section = get_section(section_type, designation)
    return section.dict()
