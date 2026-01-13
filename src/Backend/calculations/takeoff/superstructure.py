from fastapi import FastAPI, HTTPException,APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Union
import math

router = APIRouter()

class Column(BaseModel):
    """Column element definition"""
    id: Union[str, int]
    width: float = Field(description="Column width in meters")
    depth: float = Field(description="Column depth in meters")
    height: float = Field(description="Column height in meters")
    mark: str = Field(default="C1", description="Column reference mark")


class Beam(BaseModel):
    """Beam element definition"""
    id: Union[str, int]
    length: float = Field(description="Beam length in meters")
    width: float = Field(description="Beam width in meters")
    depth: float = Field(description="Beam depth in meters")
    mark: str = Field(default="B1", description="Beam reference mark")


class Slab(BaseModel):
    """Slab element definition"""
    id: Union[str, int]
    area: float = Field(description="Slab area in square meters")
    thickness: float = Field(description="Slab thickness in meters")
    mark: str = Field(default="S1", description="Slab reference mark")


class Settings(BaseModel):
    """Calculation settings"""
    conc_grade: str = Field(default="1:1.5:3", description="Concrete mix ratio")
    conc_grade_name: str = Field(default="C25", description="Concrete grade name")
    reinf_density: float = Field(default=120, description="Reinforcement density in kg/m³")
    form_type: str = Field(default="F3", description="Formwork type (F1-F5)")
    include_wastage: bool = Field(default=True, description="Include material wastage")
    conc_wastage: float = Field(default=5.0, description="Concrete wastage percentage")
    reinf_wastage: float = Field(default=2.5, description="Reinforcement wastage percentage")
    cover: float = Field(default=25, description="Concrete cover in mm")
    bar_spacing: float = Field(default=150, description="Reinforcement bar spacing in mm")


class SuperstructureInput(BaseModel):
    """Complete input for superstructure calculation"""
    columns: List[Column]
    beams: List[Beam]
    slabs: List[Slab]
    settings: Settings


class ElementResults(BaseModel):
    """Results for individual element type"""
    concrete_m3: float
    concrete_with_wastage_m3: float
    reinforcement_kg: float
    formwork_m2: float


class SuperstructureResults(BaseModel):
    """Complete calculation results"""
    # Column results
    col_conc_m3: float
    col_conc_with_wastage: float
    col_reinf_kg: float
    col_form_m2: float
    
    # Beam results
    beam_conc_m3: float
    beam_conc_with_wastage: float
    beam_reinf_kg: float
    beam_form_m2: float
    
    # Slab results
    slab_conc_m3: float
    slab_conc_with_wastage: float
    slab_reinf_kg: float
    slab_form_m2: float
    
    # Totals
    total_conc_m3: float
    total_conc_with_wastage: float
    total_reinf_kg: float
    total_form_m2: float
    shuttering_tons: float
    
    # Additional metrics
    conc_cement_bags: Optional[float] = None
    conc_sand_m3: Optional[float] = None
    conc_aggregate_m3: Optional[float] = None
    avg_reinf_ratio: Optional[float] = None


def calculate_concrete_materials(volume: float, mix_ratio: str = "1:1.5:3"):
    """
    Calculate cement, sand, and aggregate quantities for concrete
    Based on standard mix ratios
    """
    # Parse mix ratio (cement:sand:aggregate)
    try:
        parts = [float(x) for x in mix_ratio.split(':')]
        cement_ratio = parts[0]
        sand_ratio = parts[1] if len(parts) > 1 else 2
        aggregate_ratio = parts[2] if len(parts) > 2 else 4
    except:
        cement_ratio, sand_ratio, aggregate_ratio = 1, 1.5, 3
    
    total_ratio = cement_ratio + sand_ratio + aggregate_ratio
    
    # Add 52% for dry volume (standard practice)
    dry_volume = volume * 1.52
    
    # Calculate quantities
    cement_volume = (cement_ratio / total_ratio) * dry_volume
    sand_volume = (sand_ratio / total_ratio) * dry_volume
    aggregate_volume = (aggregate_ratio / total_ratio) * dry_volume
    
    # Convert cement to bags (1 bag = 0.035 m³)
    cement_bags = cement_volume / 0.035
    
    return {
        'cement_bags': cement_bags,
        'sand_m3': sand_volume,
        'aggregate_m3': aggregate_volume
    }


def calculate_superstructure(data: SuperstructureInput) -> SuperstructureResults:
    """
    Main calculation function for RCC superstructure
    """
    
    # Column calculations
    col_conc_vol = sum(c.width * c.depth * c.height for c in data.columns)
    col_form = sum(2 * (c.width + c.depth) * c.height for c in data.columns)
    
    # Beam calculations
    beam_conc_vol = sum(b.length * b.width * b.depth for b in data.beams)
    beam_form_sides = sum(2 * b.length * b.depth for b in data.beams)
    beam_form_bottom = sum(b.length * b.width for b in data.beams)
    beam_form = beam_form_sides + beam_form_bottom
    
    # Slab calculations
    slab_conc_vol = sum(s.area * s.thickness for s in data.slabs)
    slab_form_soffit = sum(s.area for s in data.slabs)
    # Approximate edge formwork (assuming square slabs for perimeter calculation)
    slab_form_edges = sum(2 * (math.sqrt(s.area) * 4) * s.thickness for s in data.slabs)
    slab_form = slab_form_soffit + slab_form_edges
    
    # Total concrete volumes
    total_conc_vol = col_conc_vol + beam_conc_vol + slab_conc_vol
    total_form = col_form + beam_form + slab_form
    
    # Apply wastage factors
    wastage_factor = 1 + (data.settings.conc_wastage / 100) if data.settings.include_wastage else 1
    reinf_wastage_factor = 1 + (data.settings.reinf_wastage / 100) if data.settings.include_wastage else 1
    
    col_conc_with_wastage = col_conc_vol * wastage_factor
    beam_conc_with_wastage = beam_conc_vol * wastage_factor
    slab_conc_with_wastage = slab_conc_vol * wastage_factor
    total_conc_with_wastage = total_conc_vol * wastage_factor
    
    # Reinforcement calculations
    col_reinf = col_conc_vol * data.settings.reinf_density * reinf_wastage_factor
    beam_reinf = beam_conc_vol * data.settings.reinf_density * reinf_wastage_factor
    slab_reinf = slab_conc_vol * data.settings.reinf_density * reinf_wastage_factor
    total_reinf = col_reinf + beam_reinf + slab_reinf
    
    # Shuttering weight estimation (approximately 25 kg per m²)
    shuttering_tons = total_form * 0.025
    
    # Calculate material quantities
    materials = calculate_concrete_materials(total_conc_with_wastage, data.settings.conc_grade)
    
    # Calculate average reinforcement ratio
    avg_reinf_ratio = (total_reinf / (total_conc_vol * 7850)) * 100 if total_conc_vol > 0 else 0
    # Note: 7850 kg/m³ is density of steel
    
    return SuperstructureResults(
        col_conc_m3=round(col_conc_vol, 3),
        col_conc_with_wastage=round(col_conc_with_wastage, 3),
        col_reinf_kg=round(col_reinf, 2),
        col_form_m2=round(col_form, 2),
        
        beam_conc_m3=round(beam_conc_vol, 3),
        beam_conc_with_wastage=round(beam_conc_with_wastage, 3),
        beam_reinf_kg=round(beam_reinf, 2),
        beam_form_m2=round(beam_form, 2),
        
        slab_conc_m3=round(slab_conc_vol, 3),
        slab_conc_with_wastage=round(slab_conc_with_wastage, 3),
        slab_reinf_kg=round(slab_reinf, 2),
        slab_form_m2=round(slab_form, 2),
        
        total_conc_m3=round(total_conc_vol, 3),
        total_conc_with_wastage=round(total_conc_with_wastage, 3),
        total_reinf_kg=round(total_reinf, 2),
        total_form_m2=round(total_form, 2),
        shuttering_tons=round(shuttering_tons, 3),
        
        conc_cement_bags=round(materials['cement_bags'], 1),
        conc_sand_m3=round(materials['sand_m3'], 2),
        conc_aggregate_m3=round(materials['aggregate_m3'], 2),
        avg_reinf_ratio=round(avg_reinf_ratio, 2)
    )


@router.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "RCC Superstructure Takeoff API",
        "version": "1.0.0",
        "endpoints": {
            "calculate": "/api/calculate-superstructure",
            "health": "/health"
        }
    }


@router.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@router.post("/api/calculate-superstructure", response_model=SuperstructureResults)
def calculate_takeoff(data: SuperstructureInput):
    """
    Calculate RCC superstructure quantity takeoff
    
    Args:
        data: Complete input including columns, beams, slabs, and settings
        
    Returns:
        Detailed calculation results with material quantities
    """
    try:
        if not data.columns and not data.beams and not data.slabs:
            raise ValueError("At least one structural element must be provided")
        
        results = calculate_superstructure(data)
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")


@router.get("/api/formwork-types")
def get_formwork_types():
    """Get available formwork types and descriptions"""
    return {
        "F1": "Basic timber formwork - rough finish",
        "F2": "Standard plywood formwork - normal finish",
        "F3": "Fair-faced plywood formwork - smooth finish",
        "F4": "Premium steel formwork - architectural finish",
        "F5": "Specialist formwork - exposed concrete"
    }


@router.get("/api/concrete-grades")
def get_concrete_grades():
    """Get standard concrete grades and mix ratios"""
    return {
        "C15": "1:3:6",
        "C20": "1:2:4",
        "C25": "1:1.5:3",
        "C30": "1:1:2",
        "C35": "1:1:1.5",
        "C40": "Design mix"
    }
