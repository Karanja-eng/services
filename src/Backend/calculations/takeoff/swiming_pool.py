# main.py (add to existing file or create new)
from fastapi import FastAPI, HTTPException,APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import math

router = APIRouter()


class SwimmingPoolInput(BaseModel):
    int_l: float
    int_w: float
    shallow_depth: float
    deep_depth: float
    veg_soil_depth: float
    working_space: float
    blinding_thick: float
    bed_thick: float
    wall_thick: float
    tanking_thick: float
    trench_width: float
    trench_depth: float
    wall_height_above: float
    num_steps: int
    step_rise: float
    step_tread: float
    excav_staged: bool
    stage_depth: float
    reinf_incl: bool
    reinf_density: float
    form_incl: bool
    backfill_incl: bool

class BOQItem(BaseModel):
    item: int
    description: str
    unit: str
    quantity: str

class CalculationResponse(BaseModel):
    boq: List[BOQItem]
    summary: dict

@router.post("/api/calculate-pool", response_model=CalculationResponse)
async def calculate_pool_takeoff(data: SwimmingPoolInput):
    try:
        # External dimensions
        ext_add = data.wall_thick + data.tanking_thick + data.working_space
        ext_l = data.int_l + 2 * ext_add
        ext_w = data.int_w + 2 * ext_add
        
        # Site Clearance
        clearance_area = ext_l * ext_w
        
        # Vegetable Soil Removal
        veg_soil_vol = clearance_area * data.veg_soil_depth
        
        # Excavation for pool pit (sloped bottom)
        avg_depth = (data.shallow_depth + data.deep_depth) / 2
        net_excav_depth = avg_depth + data.bed_thick + data.blinding_thick + data.trench_depth - data.veg_soil_depth
        int_area = data.int_l * data.int_w
        ext_area = ext_l * ext_w
        excavation_vol = ext_area * net_excav_depth
        
        # Adjust for steps
        if data.num_steps > 0:
            steps_vol_adjust = data.num_steps * data.step_tread * data.int_w * data.step_rise / 2
            excavation_vol -= steps_vol_adjust
        
        # Staged excavation
        staged_vol = []
        if data.excav_staged:
            num_stages = math.ceil(net_excav_depth / data.stage_depth)
            remaining_d = net_excav_depth
            for i in range(num_stages):
                d = min(data.stage_depth, remaining_d)
                vol = ext_area * d
                staged_vol.append(vol)
                remaining_d -= d
        else:
            staged_vol = [excavation_vol]
        
        # Trench for foundation
        mean_girth = 2 * (ext_l + ext_w) - 4 * data.trench_width / 2
        trench_vol = mean_girth * data.trench_width * data.trench_depth
        
        # Concrete in foundation trench
        found_conc_vol = mean_girth * data.trench_width * data.trench_depth
        
        # Blinding
        blinding_area = ext_area
        
        # Base slab concrete
        slab_area = ext_l * ext_w
        slab_vol = slab_area * data.bed_thick
        if data.num_steps > 0:
            steps_slab_adjust = data.num_steps * data.step_tread * ext_w * data.bed_thick
            slab_vol += steps_slab_adjust
        
        # Walls concrete
        wall_perim_int = 2 * (data.int_l + data.int_w)
        wall_height = avg_depth + data.wall_height_above
        walls_vol = wall_perim_int * wall_height * data.wall_thick
        if data.num_steps > 0:
            steps_wall_adjust = data.num_steps * data.step_tread * data.wall_thick * data.step_rise * 2
            walls_vol += steps_wall_adjust
        
        # Reinforcement
        reinf_kg = 0
        if data.reinf_incl:
            total_conc_vol = found_conc_vol + slab_vol + walls_vol
            reinf_kg = total_conc_vol * data.reinf_density
        
        # Formwork
        total_form_m2 = 0
        if data.form_incl:
            form_sides = wall_perim_int * wall_height * 2
            form_base = int_area
            form_slope_adjust = 0
            if data.deep_depth != data.shallow_depth:
                form_slope_adjust = (data.deep_depth - data.shallow_depth) / data.int_l * data.int_w * data.wall_thick
            form_steps = 0
            if data.num_steps > 0:
                form_steps = data.num_steps * (2 * data.step_tread * data.step_rise + ext_w * data.step_rise)
            total_form_m2 = form_sides + form_base + form_steps + form_slope_adjust
        
        # Backfill
        backfill_vol = 0
        if data.backfill_incl:
            backfill_vol = excavation_vol - (slab_vol + walls_vol + found_conc_vol + data.blinding_thick * blinding_area)
        
        # Build BOQ
        boq = [
            BOQItem(
                item=1,
                description="Site clearance (bush clearing and grubbing)",
                unit="m²",
                quantity=f"{clearance_area:.2f}"
            ),
            BOQItem(
                item=2,
                description="Excavate vegetable soil to stated depth and set aside for reuse",
                unit="m³",
                quantity=f"{veg_soil_vol:.2f}"
            ),
        ]
        
        # Add staged excavation or single excavation
        if data.excav_staged:
            for i, vol in enumerate(staged_vol, 1):
                boq.append(BOQItem(
                    item=len(boq) + 1,
                    description=f"Excavation for pool pit - Stage {i} (max {data.stage_depth}m depth)",
                    unit="m³",
                    quantity=f"{vol:.2f}"
                ))
        else:
            boq.append(BOQItem(
                item=3,
                description="Excavation for swimming pool pit to formation level",
                unit="m³",
                quantity=f"{excavation_vol:.2f}"
            ))
        
        # Continue with remaining items
        current_item = len(boq) + 1
        
        boq.extend([
            BOQItem(
                item=current_item,
                description="Excavate foundation trench for pool perimeter beam",
                unit="m³",
                quantity=f"{trench_vol:.2f}"
            ),
            BOQItem(
                item=current_item + 1,
                description="Planking and strutting to excavation (Item)",
                unit="item",
                quantity="1"
            ),
            BOQItem(
                item=current_item + 2,
                description="Concrete in foundation trench grade C20/25",
                unit="m³",
                quantity=f"{found_conc_vol:.2f}"
            ),
            BOQItem(
                item=current_item + 3,
                description="Blinding layer 75mm thick using murram",
                unit="m²",
                quantity=f"{blinding_area:.2f}"
            ),
            BOQItem(
                item=current_item + 4,
                description="Reinforced concrete base slab grade C30/37",
                unit="m³",
                quantity=f"{slab_vol:.2f}"
            ),
            BOQItem(
                item=current_item + 5,
                description="Reinforced concrete walls grade C30/37",
                unit="m³",
                quantity=f"{walls_vol:.2f}"
            ),
        ])
        
        current_item += 6
        
        # Add reinforcement if included
        if data.reinf_incl:
            boq.append(BOQItem(
                item=current_item,
                description="High tensile steel reinforcement bars to BS 4449",
                unit="kg",
                quantity=f"{reinf_kg:.2f}"
            ))
            current_item += 1
        
        # Add formwork if included
        if data.form_incl:
            boq.append(BOQItem(
                item=current_item,
                description="Formwork to concrete surfaces including soffit and edges",
                unit="m²",
                quantity=f"{total_form_m2:.2f}"
            ))
            current_item += 1
        
        # Add backfill if included
        if data.backfill_incl:
            boq.append(BOQItem(
                item=current_item,
                description="Backfill and compact excavated material around pool structure",
                unit="m³",
                quantity=f"{backfill_vol:.2f}"
            ))
            current_item += 1
        
        # Add waterproofing
        boq.append(BOQItem(
            item=current_item,
            description="Waterproofing/tanking to pool surfaces using approved membrane",
            unit="m²",
            quantity=f"{(2 * wall_perim_int * wall_height + slab_area):.2f}"
        ))
        
        summary = {
            "total_concrete": round(found_conc_vol + slab_vol + walls_vol, 2),
            "total_excavation": round(excavation_vol + trench_vol, 2),
            "total_formwork": round(total_form_m2, 2) if data.form_incl else 0,
            "reinforcement": round(reinf_kg, 2) if data.reinf_incl else 0,
        }
        
        return CalculationResponse(boq=boq, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def root():
    return {"message": "Swimming Pool Takeoff API", "status": "running"}

