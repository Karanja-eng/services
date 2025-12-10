# main.py
from fastapi import FastAPI, HTTPException,APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import math

router = APIRouter()

class SepticTankInput(BaseModel):
    tank_int_l: float
    tank_int_w: float
    tank_depth_int: float
    manhole_int_l: float
    manhole_int_w: float
    manhole_depth_int: float
    wall_thick: float
    bed_thick_tank: float
    bed_thick_manhole: float
    blinding_thick: float
    slab_thick: float
    veg_soil: float
    working_space: float
    cover_l: float
    cover_w: float
    num_covers: int
    num_baffles: int
    baffle_l: float
    baffle_thick: float
    baffle_heights: List[float]
    inlet_pipe_l: float
    outlet_pipe_l: float
    cover_soil_depth: float

class BOQItem(BaseModel):
    item: int
    description: str
    unit: str
    quantity: str

class CalculationResponse(BaseModel):
    boq: List[BOQItem]
    summary: dict

@router.post("/api/calculate", response_model=CalculationResponse)
async def calculate_takeoff(data: SepticTankInput):
    try:
        # External dimensions
        ext_tank_l = data.tank_int_l + 2 * data.wall_thick
        ext_tank_w = data.tank_int_w + 2 * data.wall_thick
        ext_manhole_l = data.manhole_int_l + 2 * data.wall_thick
        ext_manhole_w = data.manhole_int_w + 2 * data.wall_thick

        # Excavation dimensions
        excav_tank_l = ext_tank_l + 2 * data.working_space
        excav_tank_w = ext_tank_w + 2 * data.working_space
        excav_manhole_l = ext_manhole_l + 2 * data.working_space
        excav_manhole_w = ext_manhole_w + 2 * data.working_space

        excav_area_tank = excav_tank_l * excav_tank_w
        excav_area_manhole = excav_manhole_l * excav_manhole_w
        total_excav_area = excav_area_tank + excav_area_manhole

        # Depths
        total_depth_tank = (data.tank_depth_int + data.bed_thick_tank + 
                           data.blinding_thick + data.slab_thick + data.cover_soil_depth)
        net_excav_depth_tank = total_depth_tank - data.veg_soil
        
        total_depth_manhole = (data.manhole_depth_int + data.bed_thick_manhole + 
                              data.blinding_thick + data.slab_thick + data.cover_soil_depth)
        net_excav_depth_manhole = total_depth_manhole - data.veg_soil

        # Site Clearance
        clearance = total_excav_area

        # Vegetable Soil Removal
        veg_soil_vol = total_excav_area * data.veg_soil

        # Excavation
        excavation_tank = excav_area_tank * net_excav_depth_tank
        excavation_manhole = excav_area_manhole * net_excav_depth_manhole
        total_excavation = excavation_tank + excavation_manhole

        # Blinding
        blinding_area = total_excav_area

        # Concrete Bed
        bed_tank_vol = ext_tank_l * ext_tank_w * data.bed_thick_tank
        bed_manhole_vol = ext_manhole_l * ext_manhole_w * data.bed_thick_manhole
        total_bed_vol = bed_tank_vol + bed_manhole_vol

        # Walls
        tank_wall_perim = 2 * (data.tank_int_l + data.tank_int_w)
        tank_wall_vol = tank_wall_perim * data.tank_depth_int * data.wall_thick
        
        manhole_wall_perim = 2 * (data.manhole_int_l + data.manhole_int_w) - data.wall_thick
        manhole_wall_vol = manhole_wall_perim * data.manhole_depth_int * data.wall_thick

        # Baffle walls
        baffle_vol = sum(data.baffle_l * h * data.baffle_thick for h in data.baffle_heights)
        
        total_walls_vol = tank_wall_vol + manhole_wall_vol + baffle_vol

        # Slab
        slab_area_tank = ext_tank_l * ext_tank_w
        slab_area_manhole = ext_manhole_l * ext_manhole_w
        openings_area = data.num_covers * data.cover_l * data.cover_w
        slab_net_area = slab_area_tank + slab_area_manhole - openings_area
        slab_vol = slab_net_area * data.slab_thick

        # Formwork
        form_soffit_tank = data.tank_int_l * data.tank_int_w
        form_soffit_manhole = data.manhole_int_l * data.manhole_int_w
        form_edges_slab = 2 * (ext_tank_l + ext_tank_w + ext_manhole_l + ext_manhole_w) * data.slab_thick
        form_openings = data.num_covers * 2 * (data.cover_l + data.cover_w) * data.slab_thick
        form_walls_tank = tank_wall_perim * data.tank_depth_int * 2
        form_walls_manhole = manhole_wall_perim * data.manhole_depth_int * 2
        form_baffles = sum(2 * data.baffle_l * h for h in data.baffle_heights)
        total_formwork = (form_soffit_tank + form_soffit_manhole + form_edges_slab + 
                         form_openings + form_walls_tank + form_walls_manhole + form_baffles)

        # Backfill
        backfill_depth_tank = data.tank_depth_int - data.slab_thick
        backfill_depth_manhole = data.manhole_depth_int - data.slab_thick
        backfill_tank = tank_wall_perim * backfill_depth_tank * data.wall_thick / 2
        backfill_manhole = manhole_wall_perim * backfill_depth_manhole * data.wall_thick / 2
        backfill_baffles = sum(data.baffle_l * h * data.baffle_thick / 2 for h in data.baffle_heights)
        total_backfill = (backfill_tank + backfill_manhole + backfill_baffles + 
                         (total_excavation - total_bed_vol - total_walls_vol - slab_vol - 
                          data.blinding_thick * blinding_area))

        # Pipes
        pipes_total = data.inlet_pipe_l + data.outlet_pipe_l

        # Build BOQ
        boq = [
            BOQItem(
                item=1,
                description="Site Clearance (bush clearing and grubbing)",
                unit="m²",
                quantity=f"{clearance:.2f}"
            ),
            BOQItem(
                item=2,
                description="Excavate vegetable soil to stated depth and set aside for reuse",
                unit="m³",
                quantity=f"{veg_soil_vol:.2f}"
            ),
            BOQItem(
                item=3,
                description="Excavate to reduce levels for septic tank and inspection chamber",
                unit="m³",
                quantity=f"{total_excavation:.2f}"
            ),
            BOQItem(
                item=4,
                description="Blinding layer 75mm thick using murram",
                unit="m²",
                quantity=f"{blinding_area:.2f}"
            ),
            BOQItem(
                item=5,
                description="Concrete bed grade C20/25",
                unit="m³",
                quantity=f"{total_bed_vol:.2f}"
            ),
            BOQItem(
                item=6,
                description="Concrete walls and baffles grade C25/30",
                unit="m³",
                quantity=f"{total_walls_vol:.2f}"
            ),
            BOQItem(
                item=7,
                description="Reinforced concrete slab grade C25/30",
                unit="m³",
                quantity=f"{slab_vol:.2f}"
            ),
            BOQItem(
                item=8,
                description="Formwork to concrete surfaces including soffit and edges",
                unit="m²",
                quantity=f"{total_formwork:.2f}"
            ),
            BOQItem(
                item=9,
                description="Backfill and compact excavated material around structures",
                unit="m³",
                quantity=f"{total_backfill:.2f}"
            ),
            BOQItem(
                item=10,
                description="PVC pipes 100mm diameter for inlet and outlet",
                unit="m",
                quantity=f"{pipes_total:.2f}"
            ),
            BOQItem(
                item=11,
                description="Precast concrete covers with frames",
                unit="no.",
                quantity=str(data.num_covers)
            ),
        ]

        summary = {
            "total_concrete": round(total_bed_vol + total_walls_vol + slab_vol, 2),
            "total_excavation": round(total_excavation, 2),
            "total_formwork": round(total_formwork, 2),
        }

        return CalculationResponse(boq=boq, summary=summary)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def root():
    return {"message": "Septic Tank Takeoff API", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)