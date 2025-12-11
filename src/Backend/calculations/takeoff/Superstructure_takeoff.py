"""
FastAPI Backend for Superstructure Quantity Takeoff
File: backend/main.py
"""

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import math

router = APIRouter()


# ========================
# PYDANTIC MODELS
# ========================


class ProjectInfo(BaseModel):
    project_name: str = Field(..., description="Name of the project")
    project_location: str = Field(..., description="Project location")
    date: str = Field(..., description="Date in YYYY-MM-DD format")


class WallData(BaseModel):
    external_length: float = Field(..., gt=0, description="External length in meters")
    external_width: float = Field(..., gt=0, description="External width in meters")
    wall_height: float = Field(..., gt=0, description="Wall height in meters")
    wall_thickness: float = Field(..., gt=0, description="Wall thickness in meters")
    internal_wall_length: float = Field(
        0, ge=0, description="Total internal wall length"
    )
    num_doors: int = Field(0, ge=0, description="Number of doors")
    door_width: float = Field(0, ge=0, description="Average door width")
    door_height: float = Field(0, ge=0, description="Average door height")
    num_windows: int = Field(0, ge=0, description="Number of windows")
    window_width: float = Field(0, ge=0, description="Average window width")
    window_height: float = Field(0, ge=0, description="Average window height")
    mortar_ratio: str = Field("1:4", description="Mortar ratio")
    block_type: str = Field("6 inch", description="Block type")


class ColumnInput(BaseModel):
    width: float = Field(..., gt=0, description="Column width in meters")
    depth: float = Field(..., gt=0, description="Column depth in meters")
    height: float = Field(..., gt=0, description="Column height in meters")
    count: int = Field(..., gt=0, description="Number of columns")


class BeamInput(BaseModel):
    length: float = Field(..., gt=0, description="Beam length in meters")
    width: float = Field(..., gt=0, description="Beam width in meters")
    depth: float = Field(..., gt=0, description="Beam depth in meters")
    count: int = Field(..., gt=0, description="Number of beams")


class SlabInput(BaseModel):
    area: float = Field(..., gt=0, description="Slab area in square meters")
    thickness: float = Field(..., gt=0, description="Slab thickness in meters")


class ParapetData(BaseModel):
    has_parapet: bool = Field(False, description="Whether parapet exists")
    girth: float = Field(0, ge=0, description="Parapet girth in meters")
    height: float = Field(0, ge=0, description="Parapet height in meters")
    thickness: float = Field(0, ge=0, description="Parapet thickness in meters")
    has_coping: bool = Field(False, description="Whether coping exists")
    coping_width: float = Field(0, ge=0, description="Coping width in meters")
    coping_thickness: float = Field(0, ge=0, description="Coping thickness in meters")


class RainwaterData(BaseModel):
    has_rainwater: bool = Field(False, description="Whether rainwater goods exist")
    downpipe_length: float = Field(0, ge=0, description="Single downpipe length")
    num_downpipes: int = Field(0, ge=0, description="Number of downpipes")
    diameter: str = Field("100", description="Pipe diameter in mm")
    has_shoe: bool = Field(False, description="Whether shoes exist")
    shoe_length: float = Field(0, ge=0, description="Shoe length in meters")


class CommonData(BaseModel):
    concrete_grade: str = Field("C25 (1:1.5:3)", description="Concrete grade")
    reinf_density: float = Field(
        120, gt=0, description="Reinforcement density in kg/m³"
    )
    formwork_type: str = Field("F3 - Smooth finish", description="Formwork type")
    wastage: float = Field(5, ge=0, le=100, description="Wastage percentage")


class TakeoffRequest(BaseModel):
    project_info: ProjectInfo
    wall_data: WallData
    columns: List[ColumnInput] = []
    beams: List[BeamInput] = []
    slabs: List[SlabInput] = []
    parapet: ParapetData
    rainwater: RainwaterData
    common_data: CommonData


class BOQItem(BaseModel):
    item: str
    description: str
    unit: str
    quantity: str


class TakeoffResponse(BaseModel):
    success: bool
    project_info: ProjectInfo
    boq_items: List[BOQItem]
    summary: dict


# ========================
# CALCULATION FUNCTIONS
# ========================


def calculate_walls(wall_data: WallData) -> List[BOQItem]:
    """Calculate wall quantities with opening deductions"""
    items = []

    # External perimeter
    ext_perim = 2 * (wall_data.external_length + wall_data.external_width)

    # Centerline adjustment (subtract 4 corners)
    centerline_wall = (
        ext_perim - (4 * wall_data.wall_thickness) + wall_data.internal_wall_length
    )

    # Gross wall area
    gross_wall_area = centerline_wall * wall_data.wall_height

    # Calculate openings
    door_area = wall_data.num_doors * wall_data.door_width * wall_data.door_height
    window_area = (
        wall_data.num_windows * wall_data.window_width * wall_data.window_height
    )
    total_openings = door_area + window_area

    # Net wall area
    net_wall_area = gross_wall_area - total_openings

    if net_wall_area > 0:
        items.append(
            BOQItem(
                item="A",
                description=f"Walling in {wall_data.block_type} concrete blocks in cement mortar {wall_data.mortar_ratio}",
                unit="m²",
                quantity=f"{net_wall_area:.2f}",
            )
        )

    return items


def calculate_columns(
    columns: List[ColumnInput], common_data: CommonData
) -> List[BOQItem]:
    """Calculate column concrete, formwork, and reinforcement"""
    items = []

    if not columns:
        return items

    total_concrete = 0
    total_formwork = 0

    for col in columns:
        # Concrete volume = width × depth × height × count
        volume = col.width * col.depth * col.height * col.count
        total_concrete += volume

        # Formwork area = perimeter × height × count
        formwork = 2 * (col.width + col.depth) * col.height * col.count
        total_formwork += formwork

    # Total reinforcement
    total_reinf = total_concrete * common_data.reinf_density

    # Apply wastage
    wastage_factor = 1 + (common_data.wastage / 100)
    total_concrete *= wastage_factor

    if total_concrete > 0:
        items.append(
            BOQItem(
                item="B.1",
                description=f"Reinforced concrete in columns grade {common_data.concrete_grade}",
                unit="m³",
                quantity=f"{total_concrete:.3f}",
            )
        )

        items.append(
            BOQItem(
                item="B.2",
                description=f"Formwork to columns type {common_data.formwork_type}",
                unit="m²",
                quantity=f"{total_formwork:.2f}",
            )
        )

        items.append(
            BOQItem(
                item="B.3",
                description="High tensile steel reinforcement bars to columns",
                unit="kg",
                quantity=f"{total_reinf:.1f}",
            )
        )

    return items


def calculate_beams(beams: List[BeamInput], common_data: CommonData) -> List[BOQItem]:
    """Calculate beam concrete, formwork, and reinforcement"""
    items = []

    if not beams:
        return items

    total_concrete = 0
    total_formwork = 0

    for beam in beams:
        # Concrete volume = length × width × depth × count
        volume = beam.length * beam.width * beam.depth * beam.count
        total_concrete += volume

        # Formwork = (2 sides + bottom) × length × count
        formwork = (2 * beam.depth + beam.width) * beam.length * beam.count
        total_formwork += formwork

    # Total reinforcement
    total_reinf = total_concrete * common_data.reinf_density

    # Apply wastage
    wastage_factor = 1 + (common_data.wastage / 100)
    total_concrete *= wastage_factor

    if total_concrete > 0:
        items.append(
            BOQItem(
                item="C.1",
                description=f"Reinforced concrete in beams grade {common_data.concrete_grade}",
                unit="m³",
                quantity=f"{total_concrete:.3f}",
            )
        )

        items.append(
            BOQItem(
                item="C.2",
                description=f"Formwork to beams type {common_data.formwork_type}",
                unit="m²",
                quantity=f"{total_formwork:.2f}",
            )
        )

        items.append(
            BOQItem(
                item="C.3",
                description="High tensile steel reinforcement bars to beams",
                unit="kg",
                quantity=f"{total_reinf:.1f}",
            )
        )

    return items


def calculate_slabs(slabs: List[SlabInput], common_data: CommonData) -> List[BOQItem]:
    """Calculate slab concrete, formwork, and reinforcement"""
    items = []

    if not slabs:
        return items

    total_concrete = 0
    total_formwork = 0

    for slab in slabs:
        # Concrete volume = area × thickness
        volume = slab.area * slab.thickness
        total_concrete += volume

        # Formwork (soffit) = area
        total_formwork += slab.area

    # Total reinforcement
    total_reinf = total_concrete * common_data.reinf_density

    # Apply wastage
    wastage_factor = 1 + (common_data.wastage / 100)
    total_concrete *= wastage_factor

    if total_concrete > 0:
        items.append(
            BOQItem(
                item="D.1",
                description=f"Reinforced concrete in slabs grade {common_data.concrete_grade}",
                unit="m³",
                quantity=f"{total_concrete:.3f}",
            )
        )

        items.append(
            BOQItem(
                item="D.2",
                description=f"Formwork to slab soffit type {common_data.formwork_type}",
                unit="m²",
                quantity=f"{total_formwork:.2f}",
            )
        )

        items.append(
            BOQItem(
                item="D.3",
                description="High tensile steel reinforcement bars to slabs",
                unit="kg",
                quantity=f"{total_reinf:.1f}",
            )
        )

    return items


def calculate_parapet(parapet: ParapetData) -> List[BOQItem]:
    """Calculate parapet wall and coping quantities"""
    items = []

    if not parapet.has_parapet:
        return items

    if parapet.girth > 0 and parapet.height > 0:
        parapet_area = parapet.girth * parapet.height

        items.append(
            BOQItem(
                item="E.1",
                description=f"Parapet wall in concrete blocks thickness {parapet.thickness}m",
                unit="m²",
                quantity=f"{parapet_area:.2f}",
            )
        )

    if parapet.has_coping and parapet.coping_width > 0 and parapet.coping_thickness > 0:
        coping_volume = parapet.girth * parapet.coping_width * parapet.coping_thickness

        items.append(
            BOQItem(
                item="E.2",
                description="Precast concrete coping to parapet",
                unit="m³",
                quantity=f"{coping_volume:.3f}",
            )
        )

    return items


def calculate_rainwater(rainwater: RainwaterData) -> List[BOQItem]:
    """Calculate rainwater goods quantities"""
    items = []

    if not rainwater.has_rainwater:
        return items

    if rainwater.downpipe_length > 0 and rainwater.num_downpipes > 0:
        total_pipe_length = rainwater.downpipe_length * rainwater.num_downpipes

        items.append(
            BOQItem(
                item="F.1",
                description=f"PVC downpipes diameter {rainwater.diameter}mm",
                unit="m",
                quantity=f"{total_pipe_length:.2f}",
            )
        )

        items.append(
            BOQItem(
                item="F.2",
                description=f"Rainwater outlets diameter {rainwater.diameter}mm",
                unit="No",
                quantity=str(rainwater.num_downpipes),
            )
        )

        if rainwater.has_shoe:
            items.append(
                BOQItem(
                    item="F.3",
                    description="Shoes to downpipes",
                    unit="No",
                    quantity=str(rainwater.num_downpipes),
                )
            )

    return items


def generate_summary(boq_items: List[BOQItem]) -> dict:
    """Generate summary statistics"""
    summary = {
        "total_concrete_m3": 0.0,
        "total_formwork_m2": 0.0,
        "total_reinforcement_kg": 0.0,
        "total_wall_area_m2": 0.0,
        "total_items": len(boq_items),
    }

    for item in boq_items:
        try:
            qty = float(item.quantity)
            if item.unit == "m³" and "concrete" in item.description.lower():
                summary["total_concrete_m3"] += qty
            elif item.unit == "m²" and "formwork" in item.description.lower():
                summary["total_formwork_m2"] += qty
            elif item.unit == "kg":
                summary["total_reinforcement_kg"] += qty
            elif item.unit == "m²" and "wall" in item.description.lower():
                summary["total_wall_area_m2"] += qty
        except ValueError:
            continue

    return summary


# ========================
# API ENDPOINTS
# ========================


@router.get("/")
def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Superstructure Takeoff API",
        "version": "1.0.0",
    }


@router.post("/api/calculate", response_model=TakeoffResponse)
def calculate_takeoff(request: TakeoffRequest):
    """
    Main calculation endpoint

    Calculates quantities for:
    - Walls (with openings)
    - Columns (concrete, formwork, reinforcement)
    - Beams (concrete, formwork, reinforcement)
    - Slabs (concrete, formwork, reinforcement)
    - Parapet walls and coping
    - Rainwater goods
    """
    try:
        boq_items = []

        # Calculate all components
        boq_items.extend(calculate_walls(request.wall_data))
        boq_items.extend(calculate_columns(request.columns, request.common_data))
        boq_items.extend(calculate_beams(request.beams, request.common_data))
        boq_items.extend(calculate_slabs(request.slabs, request.common_data))
        boq_items.extend(calculate_parapet(request.parapet))
        boq_items.extend(calculate_rainwater(request.rainwater))

        # Generate summary
        summary = generate_summary(boq_items)

        return TakeoffResponse(
            success=True,
            project_info=request.project_info,
            boq_items=boq_items,
            summary=summary,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.get("/api/standards")
def get_standards():
    """Get available material standards and specifications"""
    return {
        "concrete_grades": [
            "C20 (1:2:4)",
            "C25 (1:1.5:3)",
            "C30 (1:1:2)",
            "C35",
            "C40",
        ],
        "formwork_types": [
            "F1 - Basic finish",
            "F2 - Fair finish",
            "F3 - Smooth finish",
            "F4 - Architectural finish",
            "F5 - Special finish",
        ],
        "block_types": ["4 inch", "6 inch", "9 inch"],
        "mortar_ratios": ["1:3", "1:4", "1:5", "1:6"],
        "reinforcement_densities": {"light": 80, "medium": 120, "heavy": 150},
    }


@router.get("/api/health")
def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "endpoints": {
            "calculate": "/api/calculate",
            "standards": "/api/standards",
            "health": "/api/health",
        },
    }
