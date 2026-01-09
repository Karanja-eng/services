# swimming_pool_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import math

router = APIRouter()

class SwimmingPoolInput(BaseModel):
    int_l: float
    int_w: float
    shallow_depth: float
    deep_depth: float
    veg_soil_depth: float = 0.15
    working_space: float = 0.335
    blinding_thick: float = 0.075
    bed_thick: float = 0.15
    wall_thick: float = 0.1
    tanking_thick: float = 0.02
    trench_width: float = 1.0
    trench_depth: float = 0.2
    wall_height_above: float = 0.3
    num_steps: int = 0
    step_rise: float = 0.3
    step_tread: float = 0.3
    excav_staged: bool = False
    stage_depth: float = 1.5
    reinf_incl: bool = False
    reinf_density: float = 100
    form_incl: bool = True
    backfill_incl: bool = True
    pool_shape: str = "rectangular"  # rectangular, kidney, oval, L-shaped
    include_finishes: bool = True
    include_mep: bool = True
    overflow_system: bool = False
    diving_board: bool = False
    shallow_end_steps: bool = True
    coping_width: float = 0.3

class BOQItem(BaseModel):
    item: int
    description: str
    unit: str
    quantity: str

class CalculationResponse(BaseModel):
    boq: List[BOQItem]
    summary: dict

def calculate_shape_factor(shape: str, int_l: float, int_w: float) -> tuple:
    """Calculate area and perimeter factors for different pool shapes"""
    if shape == "kidney":
        area_factor = 0.85
        perimeter_factor = 1.15
    elif shape == "oval":
        area_factor = 0.785  # π/4
        perimeter_factor = 1.1
    elif shape == "L-shaped":
        area_factor = 0.75
        perimeter_factor = 1.3
    else:  # rectangular
        area_factor = 1.0
        perimeter_factor = 1.0
    
    base_area = int_l * int_w
    base_perimeter = 2 * (int_l + int_w)
    
    return base_area * area_factor, base_perimeter * perimeter_factor

@router.post("/api/calculate-pool", response_model=CalculationResponse)
async def calculate_pool_takeoff(data: SwimmingPoolInput):
    try:
        boq = []
        item_counter = 1
        
        # Calculate dimensions
        ext_add = data.wall_thick + data.tanking_thick + data.working_space
        ext_l = data.int_l + 2 * ext_add
        ext_w = data.int_w + 2 * ext_add
        avg_depth = (data.shallow_depth + data.deep_depth) / 2
        
        # Apply shape factors
        int_area, int_perimeter = calculate_shape_factor(data.pool_shape, data.int_l, data.int_w)
        ext_area, ext_perimeter = calculate_shape_factor(data.pool_shape, ext_l, ext_w)
        
        # === PRELIMINARY WORKS ===
        boq.append(BOQItem(
            item=item_counter,
            description="Site establishment and mobilization (Item)",
            unit="item",
            quantity="1"
        ))
        item_counter += 1
        
        boq.append(BOQItem(
            item=item_counter,
            description="Site survey and setting out including pegs, profiles and lines",
            unit="item",
            quantity="1"
        ))
        item_counter += 1
        
        clearance_area = ext_area * 1.2  # 20% extra for site access
        boq.append(BOQItem(
            item=item_counter,
            description="Site clearance (bush clearing and grubbing)",
            unit="m²",
            quantity=f"{clearance_area:.2f}"
        ))
        item_counter += 1
        
        # === EARTHWORKS ===
        veg_soil_vol = clearance_area * data.veg_soil_depth
        boq.append(BOQItem(
            item=item_counter,
            description="Excavate vegetable soil to stated depth and set aside for reuse",
            unit="m³",
            quantity=f"{veg_soil_vol:.2f}"
        ))
        item_counter += 1
        
        # Main excavation
        net_excav_depth = avg_depth + data.bed_thick + data.blinding_thick + data.trench_depth - data.veg_soil_depth
        excavation_vol = ext_area * net_excav_depth
        
        # Adjust for steps
        if data.num_steps > 0:
            steps_vol_adjust = data.num_steps * data.step_tread * data.int_w * data.step_rise / 2
            excavation_vol -= steps_vol_adjust
        
        # Staged excavation
        if data.excav_staged:
            num_stages = math.ceil(net_excav_depth / data.stage_depth)
            remaining_d = net_excav_depth
            for i in range(num_stages):
                d = min(data.stage_depth, remaining_d)
                vol = ext_area * d
                boq.append(BOQItem(
                    item=item_counter,
                    description=f"Excavation for pool pit - Stage {i+1} (max {data.stage_depth}m depth)",
                    unit="m³",
                    quantity=f"{vol:.2f}"
                ))
                item_counter += 1
                remaining_d -= d
        else:
            boq.append(BOQItem(
                item=item_counter,
                description="Excavation for swimming pool pit to formation level",
                unit="m³",
                quantity=f"{excavation_vol:.2f}"
            ))
            item_counter += 1
        
        # Foundation trench
        mean_girth = int_perimeter + 2 * math.pi * (data.wall_thick / 2)
        trench_vol = mean_girth * data.trench_width * data.trench_depth
        boq.append(BOQItem(
            item=item_counter,
            description="Excavate foundation trench for pool perimeter beam",
            unit="m³",
            quantity=f"{trench_vol:.2f}"
        ))
        item_counter += 1
        
        boq.append(BOQItem(
            item=item_counter,
            description="Disposal of excavated material off-site",
            unit="m³",
            quantity=f"{(excavation_vol + trench_vol) * 0.7:.2f}"
        ))
        item_counter += 1
        
        boq.append(BOQItem(
            item=item_counter,
            description="Planking, strutting and support to excavation",
            unit="item",
            quantity="1"
        ))
        item_counter += 1
        
        # === CONCRETE WORKS ===
        # Foundation
        found_conc_vol = mean_girth * data.trench_width * data.trench_depth
        boq.append(BOQItem(
            item=item_counter,
            description="Concrete in foundation trench grade C20/25",
            unit="m³",
            quantity=f"{found_conc_vol:.2f}"
        ))
        item_counter += 1
        
        # Blinding
        blinding_area = ext_area
        boq.append(BOQItem(
            item=item_counter,
            description="Blinding layer 75mm thick using selected murram well compacted",
            unit="m²",
            quantity=f"{blinding_area:.2f}"
        ))
        item_counter += 1
        
        boq.append(BOQItem(
            item=item_counter,
            description="Damp proof membrane (DPM) 1000 gauge polythene",
            unit="m²",
            quantity=f"{blinding_area:.2f}"
        ))
        item_counter += 1
        
        # Base slab
        slab_vol = int_area * data.bed_thick
        if data.num_steps > 0:
            steps_slab_adjust = data.num_steps * data.step_tread * data.int_w * data.bed_thick
            slab_vol += steps_slab_adjust
        
        boq.append(BOQItem(
            item=item_counter,
            description="Reinforced concrete base slab grade C30/37 waterproof concrete",
            unit="m³",
            quantity=f"{slab_vol:.2f}"
        ))
        item_counter += 1
        
        # Walls
        wall_height = avg_depth + data.wall_height_above
        walls_vol = int_perimeter * wall_height * data.wall_thick
        if data.num_steps > 0:
            steps_wall_adjust = data.num_steps * data.step_tread * data.wall_thick * data.step_rise * 2
            walls_vol += steps_wall_adjust
        
        boq.append(BOQItem(
            item=item_counter,
            description="Reinforced concrete walls grade C30/37 waterproof concrete",
            unit="m³",
            quantity=f"{walls_vol:.2f}"
        ))
        item_counter += 1
        
        # Coping
        coping_vol = int_perimeter * data.coping_width * 0.15
        boq.append(BOQItem(
            item=item_counter,
            description="Pool coping in precast concrete or natural stone",
            unit="m",
            quantity=f"{int_perimeter:.2f}"
        ))
        item_counter += 1
        
        # === REINFORCEMENT ===
        if data.reinf_incl:
            total_conc_vol = found_conc_vol + slab_vol + walls_vol
            reinf_kg = total_conc_vol * data.reinf_density
            
            boq.append(BOQItem(
                item=item_counter,
                description="High tensile steel reinforcement bars to BS 4449 grade 500",
                unit="kg",
                quantity=f"{reinf_kg:.2f}"
            ))
            item_counter += 1
            
            boq.append(BOQItem(
                item=item_counter,
                description="Fabric reinforcement mesh A393 (10mm @ 200mm c/c)",
                unit="m²",
                quantity=f"{int_area:.2f}"
            ))
            item_counter += 1
        
        # === FORMWORK ===
        if data.form_incl:
            form_walls = int_perimeter * wall_height * 2  # Both faces
            form_base = int_area if data.deep_depth != data.shallow_depth else 0
            
            if data.num_steps > 0:
                form_steps = data.num_steps * (2 * data.step_tread * data.step_rise + data.int_w * data.step_rise)
                form_walls += form_steps
            
            total_form_m2 = form_walls + form_base
            
            boq.append(BOQItem(
                item=item_counter,
                description="Formwork to concrete surfaces including soffit, edges and kickers",
                unit="m²",
                quantity=f"{total_form_m2:.2f}"
            ))
            item_counter += 1
        
        # === WATERPROOFING ===
        waterproof_area = 2 * int_perimeter * wall_height + int_area
        boq.append(BOQItem(
            item=item_counter,
            description="Waterproofing/tanking system using approved 3-layer membrane",
            unit="m²",
            quantity=f"{waterproof_area:.2f}"
        ))
        item_counter += 1
        
        boq.append(BOQItem(
            item=item_counter,
            description="Bituminous paint/primer to concrete before tanking",
            unit="m²",
            quantity=f"{waterproof_area:.2f}"
        ))
        item_counter += 1
        
        # === FINISHES ===
        if data.include_finishes:
            boq.append(BOQItem(
                item=item_counter,
                description="Cement sand render (1:4) 15mm thick to pool walls and floor",
                unit="m²",
                quantity=f"{waterproof_area:.2f}"
            ))
            item_counter += 1
            
            tile_area = waterproof_area
            boq.append(BOQItem(
                item=item_counter,
                description="Ceramic mosaic pool tiles 50mm x 50mm in approved color",
                unit="m²",
                quantity=f"{tile_area:.2f}"
            ))
            item_counter += 1
            
            boq.append(BOQItem(
                item=item_counter,
                description="Waterproof tile adhesive and grout",
                unit="m²",
                quantity=f"{tile_area:.2f}"
            ))
            item_counter += 1
            
            deck_area = int_area * 0.5
            boq.append(BOQItem(
                item=item_counter,
                description="Pool deck paving in non-slip tiles or concrete finish",
                unit="m²",
                quantity=f"{deck_area:.2f}"
            ))
            item_counter += 1
        
        # === STEPS ===
        if data.shallow_end_steps:
            boq.append(BOQItem(
                item=item_counter,
                description="Precast concrete pool steps with stainless steel handrails",
                unit="set",
                quantity="1"
            ))
            item_counter += 1
        
        # === MEP WORKS ===
        if data.include_mep:
            boq.append(BOQItem(
                item=item_counter,
                description="Sand filter system complete with pump (Item)",
                unit="item",
                quantity="1"
            ))
            item_counter += 1
            
            boq.append(BOQItem(
                item=item_counter,
                description="Circulation pump 3HP/220V with starter",
                unit="no",
                quantity="2"
            ))
            item_counter += 1
            
            boq.append(BOQItem(
                item=item_counter,
                description="Chemical dosing system (chlorinator) including control panel",
                unit="item",
                quantity="1"
            ))
            item_counter += 1
            
            boq.append(BOQItem(
                item=item_counter,
                description="Underwater LED lighting 12V with transformer",
                unit="no",
                quantity="8"
            ))
            item_counter += 1
            
            num_inlets = max(4, int(int_perimeter / 3))
            boq.append(BOQItem(
                item=item_counter,
                description="Pool inlet fittings with directional jets",
                unit="no",
                quantity=f"{num_inlets}"
            ))
            item_counter += 1
            
            boq.append(BOQItem(
                item=item_counter,
                description="Main drain covers (anti-vortex type) with sumps",
                unit="no",
                quantity="2"
            ))
            item_counter += 1
            
            if data.overflow_system:
                boq.append(BOQItem(
                    item=item_counter,
                    description="Overflow gutter system with grating",
                    unit="m",
                    quantity=f"{int_perimeter:.2f}"
                ))
                item_counter += 1
                
                balance_tank_vol = int_area * 0.1
                boq.append(BOQItem(
                    item=item_counter,
                    description="Balance tank for overflow system",
                    unit="m³",
                    quantity=f"{balance_tank_vol:.2f}"
                ))
                item_counter += 1
            else:
                num_skimmers = max(2, int(int_perimeter / 10))
                boq.append(BOQItem(
                    item=item_counter,
                    description="Skimmer boxes with weirs and baskets",
                    unit="no",
                    quantity=f"{num_skimmers}"
                ))
                item_counter += 1
            
            # Piping
            pipe_length = int_perimeter * 2
            boq.append(BOQItem(
                item=item_counter,
                description="UPVC pressure pipes 63mm diameter for pool circulation",
                unit="m",
                quantity=f"{pipe_length:.2f}"
            ))
            item_counter += 1
            
            boq.append(BOQItem(
                item=item_counter,
                description="PVC fittings, valves, unions and accessories (Item)",
                unit="item",
                quantity="1"
            ))
            item_counter += 1
            
            # Electrical
            boq.append(BOQItem(
                item=item_counter,
                description="Electrical wiring, conduits and control panel for pool equipment",
                unit="item",
                quantity="1"
            ))
            item_counter += 1
        
        # === DIVING BOARD ===
        if data.diving_board:
            boq.append(BOQItem(
                item=item_counter,
                description="Diving board with stand (1m height) including fixing",
                unit="no",
                quantity="1"
            ))
            item_counter += 1
        
        # === BACKFILL ===
        if data.backfill_incl:
            backfill_vol = excavation_vol - (slab_vol + walls_vol + found_conc_vol + data.blinding_thick * blinding_area)
            boq.append(BOQItem(
                item=item_counter,
                description="Backfill and compact excavated material around pool structure in layers",
                unit="m³",
                quantity=f"{max(0, backfill_vol):.2f}"
            ))
            item_counter += 1
        
        # === TESTING & COMMISSIONING ===
        boq.append(BOQItem(
            item=item_counter,
            description="Hydrostatic testing of pool for 7 days",
            unit="item",
            quantity="1"
        ))
        item_counter += 1
        
        boq.append(BOQItem(
            item=item_counter,
            description="Testing and commissioning of all MEP systems",
            unit="item",
            quantity="1"
        ))
        item_counter += 1
        
        # === ACCESSORIES ===
        boq.append(BOQItem(
            item=item_counter,
            description="Pool cleaning equipment (vacuum, brush, leaf net, telescopic pole)",
            unit="set",
            quantity="1"
        ))
        item_counter += 1
        
        boq.append(BOQItem(
            item=item_counter,
            description="Safety equipment (life ring, rescue hook, first aid kit)",
            unit="set",
            quantity="1"
        ))
        item_counter += 1
        
        boq.append(BOQItem(
            item=item_counter,
            description="Water testing kit (pH, chlorine, alkalinity)",
            unit="set",
            quantity="1"
        ))
        item_counter += 1
        
        # Calculate summary
        summary = {
            "pool_type": data.pool_shape,
            "water_volume_m3": round(int_area * avg_depth, 2),
            "water_volume_liters": round(int_area * avg_depth * 1000, 0),
            "total_concrete_m3": round(found_conc_vol + slab_vol + walls_vol, 2),
            "total_excavation_m3": round(excavation_vol + trench_vol, 2),
            "total_formwork_m2": round(form_walls + form_base, 2) if data.form_incl else 0,
            "reinforcement_kg": round(total_conc_vol * data.reinf_density, 2) if data.reinf_incl else 0,
            "tiling_area_m2": round(tile_area, 2) if data.include_finishes else 0,
            "internal_area_m2": round(int_area, 2),
            "internal_perimeter_m": round(int_perimeter, 2),
        }
        
        return CalculationResponse(boq=boq, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def root():
    return {
        "message": "Enhanced Swimming Pool Takeoff API",
        "status": "running",
        "version": "2.0",
        "supported_shapes": ["rectangular", "kidney", "oval", "L-shaped"]
    }