from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import math

router = APIRouter()
class BasementInputs(BaseModel):
    """Input parameters for basement takeoff calculation"""
    ext_L: float = Field(default=3.91, description="External length in meters")
    ext_W: float = Field(default=3.41, description="External width in meters")
    int_L: float = Field(default=3.0, description="Internal length in meters")
    int_W: float = Field(default=2.5, description="Internal width in meters")
    depth_below_gl: float = Field(default=2.5, description="Depth below ground level in meters")
    veg_soil_depth: float = Field(default=0.15, description="Vegetable soil removal depth in meters")
    working_space: float = Field(default=0.3, description="Working space each side in meters")
    blinding_thick: float = Field(default=0.075, description="Blinding thickness in meters")
    bed_thick: float = Field(default=0.1, description="Concrete bed thickness in meters")
    found_L: float = Field(default=0.9, description="Foundation length per side in meters")
    found_thick: float = Field(default=0.3, description="Foundation thickness in meters")
    wall_thick: float = Field(default=0.225, description="Brick wall thickness in meters")
    rc_wall_thick: float = Field(default=0.15, description="RC wall thickness in meters")
    horiz_tanking_thick: float = Field(default=0.03, description="Horizontal tanking thickness in meters")
    vert_tanking_thick: float = Field(default=0.025, description="Vertical tanking thickness in meters")
    projection: float = Field(default=0.1, description="Projection in meters")
    slab_thick: float = Field(default=0.15, description="Ground floor slab thickness in meters")
    excav_staged: bool = Field(default=False, description="Excavate in stages")
    stage_depth: float = Field(default=1.5, description="Excavation stage depth in meters")
    reinf_incl: bool = Field(default=True, description="Include reinforcement")
    reinf_density: float = Field(default=120, description="Reinforcement density in kg/m³")
    form_incl: bool = Field(default=True, description="Include formwork")
    backfill_incl: bool = Field(default=True, description="Include backfill")
    disposal_incl: bool = Field(default=True, description="Include disposal")


class BasementResults(BaseModel):
    """Calculated quantities for basement takeoff"""
    clearance_m2: float
    veg_soil_m3: float
    excavation_m3: float
    disposal_m3: float
    blinding_m2: float
    found_conc_m3: float
    bed_m3: float
    horiz_tanking_m2: float
    rc_walls_m3: float
    vert_tanking_m2: float
    ext_wall_m2: float
    int_wall_m2: float
    slab_m3: float
    reinf_kg: float
    formwork_m2: float
    backfill_m3: float
    staged_volumes: Optional[list] = None


def calculate_basement_quantities(inputs: BasementInputs) -> BasementResults:
    """
    Main calculation function for basement quantity takeoff
    """
    
    # Excavation dimensions
    excav_L = inputs.ext_L + 2 * inputs.working_space
    excav_W = inputs.ext_W + 2 * inputs.working_space
    excav_area = excav_L * excav_W
    
    # Net excavation depth
    net_excav_depth = (
        inputs.depth_below_gl + 
        inputs.bed_thick + 
        inputs.blinding_thick + 
        inputs.horiz_tanking_thick + 
        inputs.found_thick - 
        inputs.veg_soil_depth
    )
    
    # Total excavation volume
    excavation_vol = excav_area * net_excav_depth
    
    # Staged excavation (if applicable)
    staged_volumes = None
    if inputs.excav_staged:
        num_stages = math.ceil(net_excav_depth / inputs.stage_depth)
        staged_volumes = []
        remaining_depth = net_excav_depth
        for _ in range(num_stages):
            stage_d = min(inputs.stage_depth, remaining_depth)
            stage_vol = excav_area * stage_d
            staged_volumes.append(round(stage_vol, 2))
            remaining_depth -= stage_d
    
    # Site clearance area
    clearance_area = excav_area
    
    # Vegetable soil removal
    veg_soil_vol = clearance_area * inputs.veg_soil_depth
    
    # Disposal volume
    disposal_vol = 0
    if inputs.disposal_incl:
        disposal_vol = excavation_vol + veg_soil_vol
    
    # Blinding area
    blinding_area = inputs.ext_L * inputs.ext_W
    
    # Foundation concrete (strip footing approximation)
    found_perim = 2 * (inputs.ext_L + inputs.ext_W)
    found_vol = found_perim * inputs.found_L * inputs.found_thick / 2
    
    # Concrete bed
    bed_area = inputs.ext_L * inputs.ext_W
    bed_vol = bed_area * inputs.bed_thick
    
    # Horizontal tanking (asphalt)
    horiz_tanking_area = bed_area
    
    # RC walls
    rc_wall_perim = 2 * (inputs.int_L + inputs.int_W)
    rc_wall_height = inputs.depth_below_gl
    rc_walls_vol = rc_wall_perim * rc_wall_height * inputs.rc_wall_thick
    
    # Vertical tanking
    vert_tanking_area = rc_wall_perim * rc_wall_height
    
    # External brick walls
    ext_wall_perim = 2 * (inputs.ext_L + inputs.ext_W) - 4 * inputs.wall_thick
    ext_wall_height = inputs.depth_below_gl
    ext_wall_area = ext_wall_perim * ext_wall_height
    
    # Internal brick walls
    int_wall_perim = 2 * (inputs.int_L + inputs.int_W)
    int_wall_height = inputs.depth_below_gl
    int_wall_area = int_wall_perim * int_wall_height
    
    # Ground floor slab
    slab_area = inputs.ext_L * inputs.ext_W
    slab_vol = slab_area * inputs.slab_thick
    
    # Reinforcement
    reinf_kg = 0
    if inputs.reinf_incl:
        total_conc_vol = found_vol + bed_vol + rc_walls_vol + slab_vol
        reinf_kg = total_conc_vol * inputs.reinf_density
    
    # Formwork
    total_form_m2 = 0
    if inputs.form_incl:
        form_soffit = inputs.int_L * inputs.int_W
        form_walls = rc_wall_perim * rc_wall_height * 2  # Both sides
        form_slab_edges = 2 * (inputs.ext_L + inputs.ext_W) * inputs.slab_thick
        form_found = found_perim * inputs.found_thick * 2
        total_form_m2 = form_soffit + form_walls + form_slab_edges + form_found
    
    # Backfill
    backfill_vol = 0
    if inputs.backfill_incl:
        occupied_volume = (
            bed_vol + 
            rc_walls_vol + 
            slab_vol + 
            found_vol + 
            inputs.blinding_thick * blinding_area + 
            inputs.horiz_tanking_thick * horiz_tanking_area
        )
        backfill_vol = excavation_vol - occupied_volume
        # Ensure non-negative
        backfill_vol = max(0, backfill_vol)
    
    return BasementResults(
        clearance_m2=round(clearance_area, 2),
        veg_soil_m3=round(veg_soil_vol, 2),
        excavation_m3=round(excavation_vol, 2),
        disposal_m3=round(disposal_vol, 2),
        blinding_m2=round(blinding_area, 2),
        found_conc_m3=round(found_vol, 2),
        bed_m3=round(bed_vol, 2),
        horiz_tanking_m2=round(horiz_tanking_area, 2),
        rc_walls_m3=round(rc_walls_vol, 2),
        vert_tanking_m2=round(vert_tanking_area, 2),
        ext_wall_m2=round(ext_wall_area, 2),
        int_wall_m2=round(int_wall_area, 2),
        slab_m3=round(slab_vol, 2),
        reinf_kg=round(reinf_kg, 2),
        formwork_m2=round(total_form_m2, 2),
        backfill_m3=round(backfill_vol, 2),
        staged_volumes=staged_volumes
    )


@router.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "Basement Takeoff Calculator API",
        "version": "1.0.0",
        "endpoints": {
            "calculate": "/api/calculate",
            "health": "/health"
        }
    }


@router.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@router.post("/api/calculate", response_model=BasementResults)
def calculate_takeoff(inputs: BasementInputs):
    """
    Calculate basement quantity takeoff
    
    Args:
        inputs: BasementInputs model with all required parameters
        
    Returns:
        BasementResults model with calculated quantities
    """
    try:
        results = calculate_basement_quantities(inputs)
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")


@router.get("/api/default-inputs", response_model=BasementInputs)
def get_default_inputs():
    """Get default input values"""
    return BasementInputs()


