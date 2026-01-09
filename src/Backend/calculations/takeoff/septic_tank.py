# main.py
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import math

router = APIRouter()

class SepticTankInput(BaseModel):
    # Septic Tank
    tank_int_l: float
    tank_int_w: float
    tank_depth_int: float
    wall_thick: float
    bed_thick_tank: float
    slab_thick: float
    floor_slope: float = 0  # degrees, 0 for flat floor
    
    # Manhole / Inspection Chamber
    manhole_int_l: float
    manhole_int_w: float
    manhole_depth_int: float
    bed_thick_manhole: float
    cover_l: float
    cover_w: float
    num_covers: int
    
    # Soakpit / Soakaway
    soakpit_shape: str = 'circular'  # 'circular' or 'rectangular'
    soakpit_diameter: float  # diameter for circular, size for rectangular
    soakpit_depth: float
    soakpit_wall_thick: float
    
    # Baffles
    num_baffles: int
    baffle_l: float
    baffle_thick: float
    baffle_heights: List[float]
    
    # Pipes
    inlet_pipe_l: float
    outlet_pipe_l: float
    pipe_diameter: float = 0.15
    
    # Site Works
    blinding_thick: float
    veg_soil: float
    working_space: float
    cover_soil_depth: float
    
    # Connections
    connect_septic_to_manhole: bool = True
    connect_manhole_to_soakpit: bool = True

class BOQItem(BaseModel):
    item: int
    description: str
    unit: str
    quantity: str
    rate: float = 0
    amount: float = 0

class CalculationResponse(BaseModel):
    boq: List[BOQItem]
    summary: dict
    details: dict

def calculate_septic_tank_quantities(data: SepticTankInput):
    """Calculate quantities for septic tank"""
    st = data
    
    # External dimensions
    ext_tank_l = st.tank_int_l + 2 * st.wall_thick
    ext_tank_w = st.tank_int_w + 2 * st.wall_thick
    
    # Excavation dimensions
    excav_tank_l = ext_tank_l + 2 * st.working_space
    excav_tank_w = ext_tank_w + 2 * st.working_space
    excav_area_tank = excav_tank_l * excav_tank_w
    
    # Total depth for excavation
    total_depth_tank = (st.tank_depth_int + st.bed_thick_tank + 
                       st.blinding_thick + st.slab_thick + st.cover_soil_depth)
    net_excav_depth_tank = total_depth_tank - st.veg_soil
    
    # Excavation volume
    excavation_tank = excav_area_tank * net_excav_depth_tank
    
    # Blinding
    blinding_area_tank = excav_area_tank
    
    # Concrete bed
    bed_tank_vol = ext_tank_l * ext_tank_w * st.bed_thick_tank
    
    # Account for floor slope if present
    if st.floor_slope > 0:
        slope_rad = math.radians(st.floor_slope)
        slope_height = st.tank_int_l * math.tan(slope_rad)
        # Add triangular prism volume for sloped floor
        bed_tank_vol += (slope_height * st.tank_int_w * st.tank_int_l) / 2
    
    # Walls
    tank_wall_perim = 2 * (st.tank_int_l + st.tank_int_w)
    tank_wall_vol = tank_wall_perim * st.tank_depth_int * st.wall_thick
    
    # Baffle walls
    baffle_vol = sum(st.baffle_l * h * st.baffle_thick for h in st.baffle_heights)
    
    # Slab
    slab_area_tank = ext_tank_l * ext_tank_w
    openings_area_tank = st.num_covers * st.cover_l * st.cover_w
    slab_net_area_tank = slab_area_tank - openings_area_tank
    slab_vol_tank = slab_net_area_tank * st.slab_thick
    
    # Formwork for tank
    form_soffit_tank = st.tank_int_l * st.tank_int_w
    form_edges_slab_tank = 2 * (ext_tank_l + ext_tank_w) * st.slab_thick
    form_openings_tank = st.num_covers * 2 * (st.cover_l + st.cover_w) * st.slab_thick
    form_walls_tank = tank_wall_perim * st.tank_depth_int * 2
    form_baffles = sum(2 * st.baffle_l * h for h in st.baffle_heights)
    total_formwork_tank = (form_soffit_tank + form_edges_slab_tank + 
                          form_openings_tank + form_walls_tank + form_baffles)
    
    # Backfill for tank
    backfill_depth_tank = st.tank_depth_int - st.slab_thick
    backfill_tank = tank_wall_perim * backfill_depth_tank * st.wall_thick / 2
    backfill_baffles = sum(st.baffle_l * h * st.baffle_thick / 2 for h in st.baffle_heights)
    
    return {
        'excavation': excavation_tank,
        'blinding_area': blinding_area_tank,
        'bed_vol': bed_tank_vol,
        'wall_vol': tank_wall_vol,
        'baffle_vol': baffle_vol,
        'slab_vol': slab_vol_tank,
        'formwork': total_formwork_tank,
        'backfill': backfill_tank + backfill_baffles,
        'excav_area': excav_area_tank,
    }

def calculate_manhole_quantities(data: SepticTankInput):
    """Calculate quantities for manhole/inspection chamber"""
    mh = data
    
    # External dimensions
    ext_manhole_l = mh.manhole_int_l + 2 * mh.wall_thick
    ext_manhole_w = mh.manhole_int_w + 2 * mh.wall_thick
    
    # Excavation
    excav_manhole_l = ext_manhole_l + 2 * mh.working_space
    excav_manhole_w = ext_manhole_w + 2 * mh.working_space
    excav_area_manhole = excav_manhole_l * excav_manhole_w
    
    total_depth_manhole = (mh.manhole_depth_int + mh.bed_thick_manhole + 
                          mh.blinding_thick + mh.slab_thick + mh.cover_soil_depth)
    net_excav_depth_manhole = total_depth_manhole - mh.veg_soil
    excavation_manhole = excav_area_manhole * net_excav_depth_manhole
    
    # Blinding
    blinding_area_manhole = excav_area_manhole
    
    # Bed
    bed_manhole_vol = ext_manhole_l * ext_manhole_w * mh.bed_thick_manhole
    
    # Walls
    manhole_wall_perim = 2 * (mh.manhole_int_l + mh.manhole_int_w) - mh.wall_thick
    manhole_wall_vol = manhole_wall_perim * mh.manhole_depth_int * mh.wall_thick
    
    # Slab
    slab_area_manhole = ext_manhole_l * ext_manhole_w
    # Manhole typically has one main cover opening
    openings_area_manhole = mh.cover_l * mh.cover_w
    slab_net_area_manhole = slab_area_manhole - openings_area_manhole
    slab_vol_manhole = slab_net_area_manhole * mh.slab_thick
    
    # Formwork
    form_soffit_manhole = mh.manhole_int_l * mh.manhole_int_w
    form_edges_slab_manhole = 2 * (ext_manhole_l + ext_manhole_w) * mh.slab_thick
    form_openings_manhole = 2 * (mh.cover_l + mh.cover_w) * mh.slab_thick
    form_walls_manhole = manhole_wall_perim * mh.manhole_depth_int * 2
    total_formwork_manhole = (form_soffit_manhole + form_edges_slab_manhole + 
                             form_openings_manhole + form_walls_manhole)
    
    # Backfill
    backfill_depth_manhole = mh.manhole_depth_int - mh.slab_thick
    backfill_manhole = manhole_wall_perim * backfill_depth_manhole * mh.wall_thick / 2
    
    return {
        'excavation': excavation_manhole,
        'blinding_area': blinding_area_manhole,
        'bed_vol': bed_manhole_vol,
        'wall_vol': manhole_wall_vol,
        'slab_vol': slab_vol_manhole,
        'formwork': total_formwork_manhole,
        'backfill': backfill_manhole,
        'excav_area': excav_area_manhole,
    }

def calculate_soakpit_quantities(data: SepticTankInput):
    """Calculate quantities for soakpit/soakaway"""
    sp = data
    
    if sp.soakpit_shape == 'circular':
        # Circular soakpit
        radius = sp.soakpit_diameter / 2
        ext_radius = radius + sp.soakpit_wall_thick
        
        # Excavation
        excav_radius = ext_radius + sp.working_space
        excav_area_soakpit = math.pi * excav_radius ** 2
        
        total_depth_soakpit = sp.soakpit_depth + sp.blinding_thick + 0.2  # 0.2m cover slab
        net_excav_depth_soakpit = total_depth_soakpit - sp.veg_soil
        excavation_soakpit = excav_area_soakpit * net_excav_depth_soakpit
        
        # Blinding
        blinding_area_soakpit = excav_area_soakpit
        
        # Base (often gravel-filled, but concrete base for stability)
        base_area = math.pi * ext_radius ** 2
        base_vol = base_area * 0.15  # 150mm base
        
        # Perforated walls (concrete with holes)
        wall_area = 2 * math.pi * (radius + sp.soakpit_wall_thick / 2) * sp.soakpit_depth
        wall_vol = math.pi * (ext_radius ** 2 - radius ** 2) * sp.soakpit_depth
        # Reduce by 30% for perforations
        wall_vol_net = wall_vol * 0.7
        
        # Cover slab
        slab_vol_soakpit = math.pi * ext_radius ** 2 * 0.2
        
        # Formwork (cylindrical)
        formwork_soakpit = 2 * math.pi * ext_radius * sp.soakpit_depth + \
                          2 * math.pi * radius * sp.soakpit_depth
        
        # Fill material (gravel/aggregate)
        fill_vol = math.pi * radius ** 2 * sp.soakpit_depth
        
    else:
        # Rectangular soakpit
        size = sp.soakpit_diameter  # Using diameter field as size
        ext_size = size + 2 * sp.soakpit_wall_thick
        
        # Excavation
        excav_size = ext_size + 2 * sp.working_space
        excav_area_soakpit = excav_size ** 2
        
        total_depth_soakpit = sp.soakpit_depth + sp.blinding_thick + 0.2
        net_excav_depth_soakpit = total_depth_soakpit - sp.veg_soil
        excavation_soakpit = excav_area_soakpit * net_excav_depth_soakpit
        
        # Blinding
        blinding_area_soakpit = excav_area_soakpit
        
        # Base
        base_vol = ext_size ** 2 * 0.15
        
        # Walls (perforated)
        wall_perim = 4 * size
        wall_vol = wall_perim * sp.soakpit_depth * sp.soakpit_wall_thick
        wall_vol_net = wall_vol * 0.7  # 30% perforations
        
        # Cover slab
        slab_vol_soakpit = ext_size ** 2 * 0.2
        
        # Formwork
        formwork_soakpit = 4 * ext_size * sp.soakpit_depth + 4 * size * sp.soakpit_depth
        
        # Fill material
        fill_vol = size ** 2 * sp.soakpit_depth
    
    # Backfill
    backfill_soakpit = excavation_soakpit - wall_vol_net - base_vol - slab_vol_soakpit - \
                       (blinding_area_soakpit * sp.blinding_thick)
    
    return {
        'excavation': excavation_soakpit,
        'blinding_area': blinding_area_soakpit,
        'base_vol': base_vol,
        'wall_vol': wall_vol_net,
        'slab_vol': slab_vol_soakpit,
        'formwork': formwork_soakpit,
        'fill_material': fill_vol,
        'backfill': backfill_soakpit,
        'excav_area': excav_area_soakpit,
    }

def calculate_connecting_pipes(data: SepticTankInput):
    """Calculate pipe lengths and quantities"""
    pipes_total = data.inlet_pipe_l + data.outlet_pipe_l
    
    # Connection pipes
    if data.connect_septic_to_manhole:
        # Assume 2m distance between septic and manhole
        pipes_total += 2.0
    
    if data.connect_manhole_to_soakpit:
        # Assume 3m distance between manhole and soakpit
        pipes_total += 3.0
    
    # Pipe bedding (sand bedding beneath pipes)
    pipe_bedding_vol = pipes_total * 0.3 * 0.15  # 300mm wide x 150mm deep
    
    return {
        'total_length': pipes_total,
        'bedding_vol': pipe_bedding_vol,
    }

@router.post("/api/calculate", response_model=CalculationResponse)
async def calculate_takeoff(data: SepticTankInput):
    try:
        # Calculate all components
        septic_qty = calculate_septic_tank_quantities(data)
        manhole_qty = calculate_manhole_quantities(data)
        soakpit_qty = calculate_soakpit_quantities(data)
        pipes_qty = calculate_connecting_pipes(data)
        
        # Total areas and volumes
        total_excav_area = septic_qty['excav_area'] + manhole_qty['excav_area'] + soakpit_qty['excav_area']
        total_blinding_area = septic_qty['blinding_area'] + manhole_qty['blinding_area'] + soakpit_qty['blinding_area']
        
        # Vegetable soil
        veg_soil_vol = total_excav_area * data.veg_soil
        
        # Total excavation
        total_excavation = septic_qty['excavation'] + manhole_qty['excavation'] + soakpit_qty['excavation']
        
        # Total concrete
        total_bed = septic_qty['bed_vol'] + manhole_qty['bed_vol'] + soakpit_qty['base_vol']
        total_walls = septic_qty['wall_vol'] + septic_qty['baffle_vol'] + \
                     manhole_qty['wall_vol'] + soakpit_qty['wall_vol']
        total_slab = septic_qty['slab_vol'] + manhole_qty['slab_vol'] + soakpit_qty['slab_vol']
        total_concrete = total_bed + total_walls + total_slab
        
        # Total formwork
        total_formwork = septic_qty['formwork'] + manhole_qty['formwork'] + soakpit_qty['formwork']
        
        # Total backfill
        total_backfill = septic_qty['backfill'] + manhole_qty['backfill'] + soakpit_qty['backfill']
        
        # Build BOQ
        boq_items = []
        item_no = 1
        
        # Site clearance
        boq_items.append(BOQItem(
            item=item_no,
            description="Site clearance including bush clearing and grubbing",
            unit="m²",
            quantity=f"{total_excav_area:.2f}"
        ))
        item_no += 1
        
        # Vegetable soil
        boq_items.append(BOQItem(
            item=item_no,
            description=f"Excavate vegetable soil to average depth of {data.veg_soil:.2f}m and set aside for reuse",
            unit="m³",
            quantity=f"{veg_soil_vol:.2f}"
        ))
        item_no += 1
        
        # Excavation
        boq_items.append(BOQItem(
            item=item_no,
            description="Excavate to reduce levels for septic tank, inspection chamber and soakpit in all types of soil",
            unit="m³",
            quantity=f"{total_excavation:.2f}"
        ))
        item_no += 1
        
        # Blinding
        boq_items.append(BOQItem(
            item=item_no,
            description=f"Blinding layer {int(data.blinding_thick * 1000)}mm thick using compacted murram",
            unit="m²",
            quantity=f"{total_blinding_area:.2f}"
        ))
        item_no += 1
        
        # Concrete bed
        boq_items.append(BOQItem(
            item=item_no,
            description="Plain concrete bed grade C20/25 (1:2:4) with 20mm aggregate",
            unit="m³",
            quantity=f"{total_bed:.2f}"
        ))
        item_no += 1
        
        # Concrete walls
        boq_items.append(BOQItem(
            item=item_no,
            description="Reinforced concrete walls and baffle walls grade C25/30 with Y12 reinforcement at 200mm c/c both ways",
            unit="m³",
            quantity=f"{total_walls:.2f}"
        ))
        item_no += 1
        
        # Concrete slabs
        boq_items.append(BOQItem(
            item=item_no,
            description="Reinforced concrete top slab grade C25/30 with Y12 reinforcement at 200mm c/c both ways",
            unit="m³",
            quantity=f"{total_slab:.2f}"
        ))
        item_no += 1
        
        # Reinforcement (estimated)
        total_reinforcement = total_concrete * 100  # Approximate 100 kg per m³
        boq_items.append(BOQItem(
            item=item_no,
            description="High tensile steel reinforcement bars to BS 4449 including cutting, bending, fixing and tying wire",
            unit="kg",
            quantity=f"{total_reinforcement:.2f}"
        ))
        item_no += 1
        
        # Formwork
        boq_items.append(BOQItem(
            item=item_no,
            description="Formwork to concrete surfaces including soffits, edges, walls and openings",
            unit="m²",
            quantity=f"{total_formwork:.2f}"
        ))
        item_no += 1
        
        # Waterproofing
        waterproof_area = (septic_qty['excav_area'] + manhole_qty['excav_area']) * 2.5  # Walls and base
        boq_items.append(BOQItem(
            item=item_no,
            description="Waterproofing to concrete surfaces using 3 coats of bituminous paint",
            unit="m²",
            quantity=f"{waterproof_area:.2f}"
        ))
        item_no += 1
        
        # Pipes
        pipe_size_mm = int(data.pipe_diameter * 1000)
        boq_items.append(BOQItem(
            item=item_no,
            description=f"Provide and lay uPVC pipes {pipe_size_mm}mm diameter class E for sewerage including joints",
            unit="m",
            quantity=f"{pipes_qty['total_length']:.2f}"
        ))
        item_no += 1
        
        # Pipe bedding
        boq_items.append(BOQItem(
            item=item_no,
            description="Selected granular material for pipe bedding 150mm thick",
            unit="m³",
            quantity=f"{pipes_qty['bedding_vol']:.2f}"
        ))
        item_no += 1
        
        # Soakpit fill
        boq_items.append(BOQItem(
            item=item_no,
            description="Soakpit filling with approved gravel/aggregate size 20-40mm",
            unit="m³",
            quantity=f"{soakpit_qty['fill_material']:.2f}"
        ))
        item_no += 1
        
        # Backfill
        boq_items.append(BOQItem(
            item=item_no,
            description="Backfill and compact excavated material in layers not exceeding 150mm around structures",
            unit="m³",
            quantity=f"{total_backfill:.2f}"
        ))
        item_no += 1
        
        # Manhole covers
        boq_items.append(BOQItem(
            item=item_no,
            description=f"Precast reinforced concrete manhole covers {int(data.cover_l*1000)}mm x {int(data.cover_w*1000)}mm with galvanized steel frames",
            unit="no.",
            quantity=str(data.num_covers)
        ))
        item_no += 1
        
        # Step irons
        step_irons = max(3, int(data.manhole_depth_int / 0.3))  # One every 300mm
        boq_items.append(BOQItem(
            item=item_no,
            description="Cast iron step irons 150mm projection built into walls",
            unit="no.",
            quantity=str(step_irons)
        ))
        item_no += 1
        
        # Ventilation pipes
        boq_items.append(BOQItem(
            item=item_no,
            description="100mm diameter uPVC vent pipes with cowl extending 600mm above ground level",
            unit="no.",
            quantity="2"
        ))
        item_no += 1
        
        # Testing
        boq_items.append(BOQItem(
            item=item_no,
            description="Water test for septic tank and manholes to prove watertightness",
            unit="no.",
            quantity="1"
        ))
        item_no += 1
        
        # Summary
        summary = {
            "total_concrete": round(total_concrete, 2),
            "total_excavation": round(total_excavation, 2),
            "total_formwork": round(total_formwork, 2),
            "total_backfill": round(total_backfill, 2),
            "total_pipes": round(pipes_qty['total_length'], 2),
        }
        
        # Detailed breakdown
        details = {
            "septic_tank": {
                "excavation": round(septic_qty['excavation'], 2),
                "concrete": round(septic_qty['bed_vol'] + septic_qty['wall_vol'] + 
                                septic_qty['baffle_vol'] + septic_qty['slab_vol'], 2),
                "formwork": round(septic_qty['formwork'], 2),
            },
            "manhole": {
                "excavation": round(manhole_qty['excavation'], 2),
                "concrete": round(manhole_qty['bed_vol'] + manhole_qty['wall_vol'] + 
                                manhole_qty['slab_vol'], 2),
                "formwork": round(manhole_qty['formwork'], 2),
            },
            "soakpit": {
                "excavation": round(soakpit_qty['excavation'], 2),
                "concrete": round(soakpit_qty['base_vol'] + soakpit_qty['wall_vol'] + 
                                soakpit_qty['slab_vol'], 2),
                "fill_material": round(soakpit_qty['fill_material'], 2),
            }
        }
        
        return CalculationResponse(boq=boq_items, summary=summary, details=details)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def root():
    return {
        "message": "Enhanced Septic Tank System Takeoff API",
        "status": "running",
        "version": "2.0",
        "features": [
            "Septic tank calculations",
            "Manhole/inspection chamber calculations",
            "Soakpit calculations (circular and rectangular)",
            "Connecting pipes",
            "Complete BOQ generation",
            "Detailed quantity breakdown"
        ]
    }

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "septic_takeoff_api"}

# Main app setup (if running this file directly)
