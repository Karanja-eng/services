from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import math
from .Eurocode_Beam import BeamCalculator # Corrected import assuming same directory or package structure

router = APIRouter()


class LoadInput(BaseModel):
    type: Literal["point", "udl"]
    magnitude: float = Field(..., gt=0, description="Load magnitude in kN or kN/m")
    position: Optional[float] = Field(None, ge=0, description="Position from left support (for point loads)")
    start: Optional[float] = Field(None, ge=0, description="Start position (for UDL)")
    end: Optional[float] = Field(None, ge=0, description="End position (for UDL)")

class BeamInput(BaseModel):
    # Geometry
    span: float = Field(..., gt=0, le=30, description="Beam span in meters")
    width: float = Field(..., gt=0, le=2000, description="Beam width in mm")
    depth: float = Field(..., gt=0, le=2000, description="Beam depth in mm")
    cover: float = Field(30, ge=20, le=100, description="Concrete cover in mm")
    
    # Materials
    fck: float = Field(..., gt=0, le=90, description="Concrete strength in MPa")
    fyk: float = Field(500, gt=0, le=600, description="Steel yield strength in MPa")
    
    # Loading
    loads: List[LoadInput]
    load_factors: dict = {"dead": 1.35, "live": 1.5}
    
    # Beam type
    beam_type: Literal["rectangular", "T-beam", "L-beam"] = "rectangular"
    flange_width: Optional[float] = Field(None, ge=0, description="Flange width for T/L beams in mm")
    flange_thickness: Optional[float] = Field(None, ge=0, description="Flange thickness in mm")
    
    # Support conditions
    support_type: Literal["simply_supported", "continuous", "cantilever"] = "simply_supported"
    
    # Exposure class
    exposure_class: Literal["XC1", "XC2", "XC3", "XC4", "XD1", "XD2", "XS1", "XS2", "XS3"] = "XC1"

@router.post("/design")
async def design_beam(input_data: BeamInput):
    try:
        calculator = BeamCalculator(input_data.dict())
        
        # Perform all calculations
        analysis_results = calculator.analyze_beam()
        flexural_design = calculator.design_flexure()
        shear_design = calculator.design_shear()
        deflection_check = calculator.check_deflection()
        crack_control = calculator.check_cracking()
        detailing = calculator.generate_detailing()
        
        return {
            "success": True,
            "analysis": analysis_results,
            "flexural_design": flexural_design,
            "shear_design": shear_design,
            "deflection": deflection_check,
            "cracking": crack_control,
            "detailing": detailing,
            "warnings": calculator.warnings,
            "recommendations": calculator.recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/material-properties/{fck}")
async def get_material_properties(fck: float):
    """Get material properties for given concrete strength"""
    try:
        calculator = BeamCalculator({"fck": fck, "span": 1, "width": 300, "depth": 500, "fyk": 500, "loads": []})
        props = calculator.get_material_properties()
        return {"success": True, "properties": props}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/bar-sizes")
async def get_bar_sizes():
    """Get available reinforcement bar sizes"""
    return {
        "success": True,
        "bar_sizes": [8, 10, 12, 16, 20, 25, 32, 40],
        "preferred_sizes": [8, 10, 12, 16, 20, 25, 32]
    }

