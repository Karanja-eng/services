from fastapi import FastAPI, HTTPException,APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import math

router= APIRouter()

class DoorInput(BaseModel):
    """Input model for door calculations"""
    # Common fields
    opening_W: float = Field(..., description="Opening width in meters", gt=0)
    opening_H: float = Field(..., description="Opening height in meters", gt=0)
    wall_thick: float = Field(0.2, description="Wall thickness in meters", gt=0)
    frame_W: float = Field(100, description="Frame width in mm", gt=0)
    frame_thick: float = Field(50, description="Frame thickness in mm", gt=0)
    horn_L: float = Field(150, description="Horn length in mm", ge=0)
    architrave_W: float = Field(38, description="Architrave width in mm", gt=0)
    architrave_thick: float = Field(14, description="Architrave thickness in mm", gt=0)
    quadrant_size: float = Field(25, description="Quadrant size in mm", gt=0)
    lintel_bearing: float = Field(0.2, description="Lintel bearing each side in m", gt=0)
    lintel_H: float = Field(0.2, description="Lintel height in m", gt=0)
    reinf_bar_diam: float = Field(12, description="Reinforcement bar diameter in mm", gt=0)
    num_reinf_bars: int = Field(4, description="Number of reinforcement bars", gt=0)
    cover: float = Field(25, description="Concrete cover in mm", gt=0)
    reinf_extra: float = Field(0.05, description="Extra reinforcement length in m", ge=0)
    form_type: str = Field("timber", description="Formwork type")
    
    # Door specific fields
    leaf_thick: float = Field(45, description="Door leaf thickness in mm", gt=0)
    leaf_material: str = Field("flush with plywood", description="Leaf material")
    leaping_size: float = Field(10, description="Leaping/edging size in mm", gt=0)
    num_doors: int = Field(1, description="Number of doors", gt=0)
    num_locks: int = Field(1, description="Number of locks", ge=0)
    num_stoppers: int = Field(1, description="Number of stoppers", ge=0)
    num_bolts: int = Field(2, description="Number of bolts", ge=0)
    num_clamps: int = Field(5, description="Number of clamps", ge=0)
    num_hinges: int = Field(3, description="Number of hinges", ge=0)


class WindowInput(BaseModel):
    """Input model for window calculations"""
    # Common fields (same as door)
    opening_W: float = Field(..., description="Opening width in meters", gt=0)
    opening_H: float = Field(..., description="Opening height in meters", gt=0)
    wall_thick: float = Field(0.2, description="Wall thickness in meters", gt=0)
    frame_W: float = Field(100, description="Frame width in mm", gt=0)
    frame_thick: float = Field(50, description="Frame thickness in mm", gt=0)
    horn_L: float = Field(150, description="Horn length in mm", ge=0)
    architrave_W: float = Field(38, description="Architrave width in mm", gt=0)
    architrave_thick: float = Field(14, description="Architrave thickness in mm", gt=0)
    quadrant_size: float = Field(25, description="Quadrant size in mm", gt=0)
    lintel_bearing: float = Field(0.2, description="Lintel bearing each side in m", gt=0)
    lintel_H: float = Field(0.2, description="Lintel height in m", gt=0)
    reinf_bar_diam: float = Field(12, description="Reinforcement bar diameter in mm", gt=0)
    num_reinf_bars: int = Field(4, description="Number of reinforcement bars", gt=0)
    cover: float = Field(25, description="Concrete cover in mm", gt=0)
    reinf_extra: float = Field(0.05, description="Extra reinforcement length in m", ge=0)
    form_type: str = Field("timber", description="Formwork type")
    
    # Window specific fields
    glazing_thick: float = Field(5, description="Glazing thickness in mm", gt=0)
    num_panes: int = Field(2, description="Number of panes", gt=0)
    has_mullions: bool = Field(False, description="Has mullions")
    mullion_L: Optional[float] = Field(None, description="Mullion length in m")
    mullion_size: Optional[float] = Field(None, description="Mullion size in m")
    num_windows: int = Field(1, description="Number of windows", gt=0)
    has_grills: bool = Field(False, description="Has window grills")
    has_mesh: bool = Field(False, description="Has mosquito mesh")


class TakeoffItem(BaseModel):
    """Single item in the bill of quantities"""
    item: str
    description: str
    dimensions: str
    quantity: str
    unit: str


class TakeoffResponse(BaseModel):
    """Response model for takeoff calculations"""
    items: List[TakeoffItem]
    summary: Dict[str, float]


def calculate_common_items(
    opening_W: float,
    opening_H: float,
    wall_thick: float,
    frame_W: float,
    frame_thick: float,
    horn_L: float,
    architrave_W: float,
    architrave_thick: float,
    quadrant_size: float,
    lintel_bearing: float,
    lintel_H: float,
    reinf_bar_diam: float,
    num_reinf_bars: int,
    cover: float,
    reinf_extra: float,
    form_type: str
) -> tuple:
    """Calculate common quantities for both doors and windows"""
    
    # Convert mm to meters
    frame_W_m = frame_W / 1000
    frame_thick_m = frame_thick / 1000
    horn_L_m = horn_L / 1000
    architrave_W_m = architrave_W / 1000
    architrave_thick_m = architrave_thick / 1000
    quadrant_size_m = quadrant_size / 1000
    reinf_bar_diam_m = reinf_bar_diam / 1000
    cover_m = cover / 1000
    
    # Frame calculations
    frame_H = opening_H + 2 * horn_L_m
    frame_total_L = 2 * frame_H + opening_W
    
    # Architrave calculations
    architrave_H = opening_H - 2 * (architrave_W_m / 2)
    architrave_total_L = 2 * architrave_H + opening_W
    
    # Quadrant calculations
    quadrant_qty = architrave_total_L
    
    # Lintel calculations
    lintel_W = wall_thick
    lintel_L = opening_W + 2 * lintel_bearing
    lintel_vol = lintel_L * lintel_W * lintel_H
    
    # Reinforcement calculations
    reinf_L_each = lintel_L - 2 * cover_m + 2 * lintel_bearing + reinf_extra
    reinf_total_L = num_reinf_bars * reinf_L_each
    
    # Formwork calculations
    form_soffit = lintel_L * lintel_W
    form_sides = 2 * lintel_L * lintel_H
    total_form = form_soffit + form_sides
    
    # Deductions
    opening_area = opening_W * opening_H
    deduct_wall = opening_area * wall_thick
    deduct_plaster_both = opening_area * 2 * 0.015  # 15mm plaster both sides
    
    return (
        frame_total_L, frame_H, frame_W_m, frame_thick_m,
        architrave_total_L, architrave_H, architrave_W_m, architrave_thick_m,
        quadrant_qty, quadrant_size_m,
        lintel_vol, lintel_L, lintel_W, lintel_H,
        reinf_total_L, reinf_L_each, reinf_bar_diam_m,
        total_form, form_soffit, form_sides,
        deduct_wall, deduct_plaster_both
    )


@router.post("/api/calculate/door", response_model=TakeoffResponse)
async def calculate_door_takeoff(data: DoorInput):
    """
    Calculate door takeoff quantities
    All calculation logic in Python
    """
    try:
        # Get common calculations
        (frame_total_L, frame_H, frame_W_m, frame_thick_m,
         architrave_total_L, architrave_H, architrave_W_m, architrave_thick_m,
         quadrant_qty, quadrant_size_m,
         lintel_vol, lintel_L, lintel_W, lintel_H,
         reinf_total_L, reinf_L_each, reinf_bar_diam_m,
         total_form, form_soffit, form_sides,
         deduct_wall, deduct_plaster_both) = calculate_common_items(
            data.opening_W, data.opening_H, data.wall_thick,
            data.frame_W, data.frame_thick, data.horn_L,
            data.architrave_W, data.architrave_thick, data.quadrant_size,
            data.lintel_bearing, data.lintel_H,
            data.reinf_bar_diam, data.num_reinf_bars,
            data.cover, data.reinf_extra, data.form_type
        )
        
        # Door specific calculations
        leaf_thick_m = data.leaf_thick / 1000
        leaping_size_m = data.leaping_size / 1000
        
        leaf_W = data.opening_W - 2 * frame_thick_m
        leaf_H = data.opening_H - frame_thick_m
        leaf_area = leaf_W * leaf_H
        total_leaf_area = leaf_area * data.num_doors
        
        leaping_perim = 2 * (leaf_W + leaf_H)
        leaping_qty = leaping_perim * data.num_doors
        
        # Build items list
        items = [
            TakeoffItem(
                item="Hardwood door frame",
                description=f"{int(data.frame_W)}mm x {int(data.frame_thick)}mm",
                dimensions=f"2/{frame_H:.2f}/1/{data.opening_W:.2f}",
                quantity=f"{frame_total_L:.2f}",
                unit="m"
            ),
            TakeoffItem(
                item="Door leaf",
                description=f"{data.leaf_material}, {int(data.leaf_thick)}mm thick",
                dimensions=f"{data.num_doors}/{leaf_H:.2f}/{leaf_W:.2f}",
                quantity=f"{total_leaf_area:.2f}",
                unit="m²"
            ),
            TakeoffItem(
                item="Door leaping/edging",
                description=f"{int(data.leaping_size)}mm hardwood edging",
                dimensions=f"{data.num_doors}/{leaping_perim:.2f}",
                quantity=f"{leaping_qty:.2f}",
                unit="m"
            ),
            TakeoffItem(
                item="Hardwood architrave",
                description=f"{int(data.architrave_W)}mm x {int(data.architrave_thick)}mm",
                dimensions=f"2/{architrave_H:.2f}/1/{data.opening_W:.2f}",
                quantity=f"{architrave_total_L:.2f}",
                unit="m"
            ),
            TakeoffItem(
                item="Quadrant mould",
                description=f"{int(data.quadrant_size)}mm quadrant beading",
                dimensions=f"2/{architrave_H:.2f}/1/{data.opening_W:.2f}",
                quantity=f"{quadrant_qty:.2f}",
                unit="m"
            )
        ]
        
        # Add ironmongery
        if data.num_locks > 0:
            items.append(TakeoffItem(
                item="Door lock",
                description="Mortice lock complete with keys",
                dimensions="",
                quantity=str(data.num_locks * data.num_doors),
                unit="No."
            ))
        
        if data.num_hinges > 0:
            items.append(TakeoffItem(
                item="Door hinges",
                description="100mm brass butt hinges",
                dimensions="",
                quantity=str(data.num_hinges * data.num_doors),
                unit="No."
            ))
        
        if data.num_stoppers > 0:
            items.append(TakeoffItem(
                item="Door stopper",
                description="Door stopper/buffer",
                dimensions="",
                quantity=str(data.num_stoppers * data.num_doors),
                unit="No."
            ))
        
        if data.num_bolts > 0:
            items.append(TakeoffItem(
                item="Tower bolts",
                description="150mm tower bolts",
                dimensions="",
                quantity=str(data.num_bolts * data.num_doors),
                unit="No."
            ))
        
        if data.num_clamps > 0:
            items.append(TakeoffItem(
                item="Door clamps",
                description="Aldrop/door clamps",
                dimensions="",
                quantity=str(data.num_clamps * data.num_doors),
                unit="No."
            ))
        
        # Add common structural items
        items.extend([
            TakeoffItem(
                item="RC lintel",
                description=f"Concrete lintel {lintel_H:.2f}m x {lintel_W:.2f}m",
                dimensions=f"1/{lintel_H:.2f}/{lintel_W:.2f}/{lintel_L:.2f}",
                quantity=f"{lintel_vol:.3f}",
                unit="m³"
            ),
            TakeoffItem(
                item="Reinforcement bars",
                description=f"Y{int(data.reinf_bar_diam)} bars",
                dimensions=f"{data.num_reinf_bars}/{reinf_L_each:.2f}",
                quantity=f"{reinf_total_L:.2f}",
                unit="m"
            ),
            TakeoffItem(
                item="Formwork to lintel",
                description=f"{data.form_type} formwork",
                dimensions=f"1/{lintel_L:.2f}/{lintel_W:.2f}/2/{lintel_L:.2f}/{lintel_H:.2f}",
                quantity=f"{total_form:.2f}",
                unit="m²"
            ),
            TakeoffItem(
                item="Deduct blockwork",
                description="Opening in wall",
                dimensions=f"1/{data.opening_H:.2f}/{data.opening_W:.2f}/{data.wall_thick:.2f}",
                quantity=f"{deduct_wall:.3f}",
                unit="m³"
            ),
            TakeoffItem(
                item="Deduct plaster",
                description="Both sides of opening",
                dimensions=f"2/{data.opening_H:.2f}/{data.opening_W:.2f}",
                quantity=f"{deduct_plaster_both:.2f}",
                unit="m²"
            )
        ])
        
        # Summary
        summary = {
            "total_frame_length": frame_total_L,
            "total_leaf_area": total_leaf_area,
            "lintel_volume": lintel_vol,
            "reinforcement_length": reinf_total_L,
            "formwork_area": total_form
        }
        
        return TakeoffResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")


@router.post("/api/calculate/window", response_model=TakeoffResponse)
async def calculate_window_takeoff(data: WindowInput):
    """
    Calculate window takeoff quantities
    All calculation logic in Python
    """
    try:
        # Get common calculations
        (frame_total_L, frame_H, frame_W_m, frame_thick_m,
         architrave_total_L, architrave_H, architrave_W_m, architrave_thick_m,
         quadrant_qty, quadrant_size_m,
         lintel_vol, lintel_L, lintel_W, lintel_H,
         reinf_total_L, reinf_L_each, reinf_bar_diam_m,
         total_form, form_soffit, form_sides,
         deduct_wall, deduct_plaster_both) = calculate_common_items(
            data.opening_W, data.opening_H, data.wall_thick,
            data.frame_W, data.frame_thick, data.horn_L,
            data.architrave_W, data.architrave_thick, data.quadrant_size,
            data.lintel_bearing, data.lintel_H,
            data.reinf_bar_diam, data.num_reinf_bars,
            data.cover, data.reinf_extra, data.form_type
        )
        
        # Window specific calculations
        glazing_thick_m = data.glazing_thick / 1000
        
        pane_W = data.opening_W / data.num_panes
        pane_area = pane_W * data.opening_H
        total_glazing = pane_area * data.num_panes * data.num_windows
        
        # Glazing beads calculation
        bead_length_per_pane = 2 * (data.opening_H + pane_W)
        total_bead_length = bead_length_per_pane * data.num_panes * data.num_windows
        
        # Build items list
        items = [
            TakeoffItem(
                item="Hardwood window frame",
                description=f"{int(data.frame_W)}mm x {int(data.frame_thick)}mm",
                dimensions=f"2/{frame_H:.2f}/1/{data.opening_W:.2f}",
                quantity=f"{frame_total_L:.2f}",
                unit="m"
            ),
            TakeoffItem(
                item="Glass panes",
                description=f"{int(data.glazing_thick)}mm clear float glass",
                dimensions=f"{data.num_windows * data.num_panes}/{data.opening_H:.2f}/{pane_W:.2f}",
                quantity=f"{total_glazing:.2f}",
                unit="m²"
            ),
            TakeoffItem(
                item="Glazing beads",
                description="12mm x 12mm glazing beads",
                dimensions=f"{data.num_windows * data.num_panes * 2}/{data.opening_H:.2f}/{data.num_windows * data.num_panes * 2}/{pane_W:.2f}",
                quantity=f"{total_bead_length:.2f}",
                unit="m"
            ),
            TakeoffItem(
                item="Hardwood architrave",
                description=f"{int(data.architrave_W)}mm x {int(data.architrave_thick)}mm",
                dimensions=f"2/{architrave_H:.2f}/1/{data.opening_W:.2f}",
                quantity=f"{architrave_total_L:.2f}",
                unit="m"
            ),
            TakeoffItem(
                item="Window stays",
                description="200mm casement stays",
                dimensions="",
                quantity=str(data.num_windows * data.num_panes),
                unit="No."
            ),
            TakeoffItem(
                item="Window fasteners",
                description="Casement fasteners",
                dimensions="",
                quantity=str(data.num_windows * data.num_panes),
                unit="No."
            )
        ]
        
        # Add mullions if required
        if data.has_mullions and data.mullion_L and data.mullion_size:
            mullion_count = data.num_panes - 1
            total_mullion_length = mullion_count * data.mullion_L * data.num_windows
            
            items.append(TakeoffItem(
                item="Vertical mullions",
                description=f"{int(data.mullion_size * 1000)}mm x {int(data.mullion_size * 1000)}mm hardwood",
                dimensions=f"{mullion_count}/{data.mullion_L:.2f}",
                quantity=f"{total_mullion_length:.2f}",
                unit="m"
            ))
        
        # Add window grills if required
        if data.has_grills:
            grill_area = data.opening_H * data.opening_W * data.num_windows
            items.append(TakeoffItem(
                item="Window grills",
                description="12mm dia. MS bars @ 150mm c/c",
                dimensions=f"{data.num_windows}/{data.opening_H:.2f}/{data.opening_W:.2f}",
                quantity=f"{grill_area:.2f}",
                unit="m²"
            ))
        
        # Add mosquito mesh if required
        if data.has_mesh:
            mesh_area = data.opening_H * data.opening_W * data.num_windows
            items.append(TakeoffItem(
                item="Mosquito mesh",
                description="Aluminium wire mesh",
                dimensions=f"{data.num_windows}/{data.opening_H:.2f}/{data.opening_W:.2f}",
                quantity=f"{mesh_area:.2f}",
                unit="m²"
            ))
        
        # Add common structural items
        items.extend([
            TakeoffItem(
                item="RC lintel",
                description=f"Concrete lintel {lintel_H:.2f}m x {lintel_W:.2f}m",
                dimensions=f"1/{lintel_H:.2f}/{lintel_W:.2f}/{lintel_L:.2f}",
                quantity=f"{lintel_vol:.3f}",
                unit="m³"
            ),
            TakeoffItem(
                item="Reinforcement bars",
                description=f"Y{int(data.reinf_bar_diam)} bars",
                dimensions=f"{data.num_reinf_bars}/{reinf_L_each:.2f}",
                quantity=f"{reinf_total_L:.2f}",
                unit="m"
            ),
            TakeoffItem(
                item="Formwork to lintel",
                description=f"{data.form_type} formwork",
                dimensions=f"1/{lintel_L:.2f}/{lintel_W:.2f}/2/{lintel_L:.2f}/{lintel_H:.2f}",
                quantity=f"{total_form:.2f}",
                unit="m²"
            ),
            TakeoffItem(
                item="Deduct blockwork",
                description="Opening in wall",
                dimensions=f"1/{data.opening_H:.2f}/{data.opening_W:.2f}/{data.wall_thick:.2f}",
                quantity=f"{deduct_wall:.3f}",
                unit="m³"
            ),
            TakeoffItem(
                item="Deduct plaster",
                description="Both sides of opening",
                dimensions=f"2/{data.opening_H:.2f}/{data.opening_W:.2f}",
                quantity=f"{deduct_plaster_both:.2f}",
                unit="m²"
            )
        ])
        
        # Summary
        summary = {
            "total_frame_length": frame_total_L,
            "total_glazing_area": total_glazing,
            "lintel_volume": lintel_vol,
            "reinforcement_length": reinf_total_L,
            "formwork_area": total_form
        }
        
        return TakeoffResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")


@router.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Door & Window Takeoff API",
        "version": "1.0.0",
        "endpoints": {
            "door_calculation": "/api/calculate/door",
            "window_calculation": "/api/calculate/window",
            "documentation": "/docs"
        }
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

