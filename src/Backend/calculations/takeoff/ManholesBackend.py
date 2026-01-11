"""
Drainage Takeoff API - FastAPI Backend
Complete backend for calculating drainage quantities including manholes and pipes
"""

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import math
from datetime import datetime

router = APIRouter()
# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class ManholeInput(BaseModel):
    """Input model for a single manhole"""

    id: str = Field(..., description="Unique identifier for the manhole")
    type: str = Field(..., description="Type: 'rect', 'square', or 'circ'")
    internal_length: Optional[float] = Field(
        None, description="Internal length in meters (for rect/square)"
    )
    internal_width: Optional[float] = Field(
        None, description="Internal width in meters (for rect/square)"
    )
    internal_diameter: Optional[float] = Field(
        None, description="Internal diameter in meters (for circular)"
    )
    invert_level: float = Field(..., description="Invert level in meters")
    ground_level: float = Field(..., description="Ground level in meters")
    bed_thickness: float = Field(0.15, description="Bed thickness in meters")
    wall_thickness: float = Field(0.15, description="Wall thickness in meters")
    wall_material: str = Field(
        "concrete", description="Wall material: 'concrete', 'stone', or 'precast'"
    )
    projection_thickness: float = Field(
        0.10, description="Projection thickness beyond wall"
    )
    slab_thickness: float = Field(0.10, description="Top slab thickness in meters")
    benching_avg_height: float = Field(
        0.20, description="Average benching height in meters"
    )
    has_benching: bool = Field(True, description="Whether benching is required")
    plaster_thickness: float = Field(
        0.012, description="Plaster thickness in meters (12mm)"
    )
    has_plaster: bool = Field(True, description="Whether plastering is required")
    cover_length: float = Field(0.60, description="Manhole cover length in meters")
    cover_width: float = Field(0.60, description="Manhole cover width in meters")
    cover_type: str = Field(
        "heavy_duty",
        description="Cover type: 'heavy_duty', 'medium_duty', 'light_duty'",
    )
    has_channel: bool = Field(True, description="Whether channel is required")
    channel_length: float = Field(
        0, description="Channel length in meters (0 = use internal length)"
    )
    has_step_irons: bool = Field(True, description="Whether step irons are required")
    quantity: int = Field(1, ge=1, description="Number of this type of manhole")
    position_x: float = Field(0, description="X position for 3D visualization")
    position_y: float = Field(0, description="Y position for 3D visualization")


class PipeRun(BaseModel):
    """Input model for a pipe run"""

    id: str = Field(..., description="Unique identifier for the pipe run")
    from_point: str = Field(..., description="Starting point (manhole ID or 'House')")
    to_point: str = Field(..., description="Ending point (manhole ID)")
    length: float = Field(..., gt=0, description="Pipe length in meters")
    diameter_mm: float = Field(..., description="Pipe diameter in millimeters")
    pipe_material: str = Field(
        ..., description="Pipe material: 'upvc', 'pvc', or 'pcc'"
    )
    trench_depth_start: float = Field(
        ..., description="Trench depth at start in meters"
    )
    trench_depth_end: float = Field(..., description="Trench depth at end in meters")
    trench_width: float = Field(..., description="Trench width in meters")
    bedding_type: str = Field(
        ...,
        description="Bedding type: 'granular', 'sand', 'concrete_bed', 'concrete_surround'",
    )
    surround_thickness: float = Field(
        0.15, description="Bedding/surround thickness in meters"
    )
    gradient: float = Field(..., description="Pipe gradient in percentage")
    quantity: int = Field(1, ge=1, description="Number of this pipe run")


class ProjectInput(BaseModel):
    """Input model for the entire project"""

    project_name: str = Field(..., description="Name of the project")
    veg_depth: float = Field(0.15, description="Vegetable soil depth in meters")
    has_rock: bool = Field(False, description="Whether rock excavation is required")
    rock_start_depth: float = Field(
        0, description="Depth where rock starts from ground level"
    )
    has_planking: bool = Field(
        False, description="Whether planking/strutting is required"
    )
    ground_is_level: bool = Field(True, description="Whether ground is level")
    site_clearance_area: float = Field(0, description="Site clearance area in m²")
    manholes: List[ManholeInput] = Field(..., description="List of manholes")
    pipes: List[PipeRun] = Field(default_factory=list, description="List of pipe runs")
    boundary_area: float = Field(0, description="Boundary area in m²")
    road_reinstatement_area: float = Field(
        0, description="Road reinstatement area in m²"
    )
    pavement_reinstatement_area: float = Field(
        0, description="Pavement reinstatement area in m²"
    )


# ============================================================================
# CALCULATION FUNCTIONS
# ============================================================================


def calculate_manhole_quantities(
    mh: ManholeInput, has_rock: bool, rock_start_depth: float, veg_depth: float
) -> Dict[str, Any]:
    """
    Calculate all quantities for a single manhole

    Returns a dictionary with all calculated quantities
    """

    # Determine internal dimensions
    if mh.type == "circ":
        int_l = int_w = int_diam = mh.internal_diameter
        ext_diam = int_diam + 2 * (mh.wall_thickness + mh.projection_thickness)
        excav_area = math.pi * (ext_diam / 2) ** 2
        int_perim = math.pi * int_diam
        ext_perim = math.pi * ext_diam
    else:  # rect or square
        int_l = mh.internal_length
        int_w = mh.internal_width
        int_diam = 0
        ext_l = int_l + 2 * (mh.wall_thickness + mh.projection_thickness)
        ext_w = int_w + 2 * (mh.wall_thickness + mh.projection_thickness)
        excav_area = ext_l * ext_w
        int_perim = 2 * (int_l + int_w)
        ext_perim = 2 * (ext_l + ext_w)

    # Depth calculations
    depth_to_invert = mh.ground_level - mh.invert_level
    pit_depth = depth_to_invert + mh.bed_thickness + 0.05  # Extra 50mm
    wall_height = depth_to_invert - mh.slab_thickness + 0.05

    # ========== EXCAVATION ==========
    veg_excav_m2 = excav_area * mh.quantity
    excav_pit_m3 = excav_area * pit_depth * mh.quantity

    # Stage excavation (split at 1.5m depth)
    excav_stage1_m3 = 0
    excav_stage2_m3 = 0
    if pit_depth > 1.5:
        excav_stage1_m3 = excav_area * 1.5 * mh.quantity
        excav_stage2_m3 = excav_area * (pit_depth - 1.5) * mh.quantity
    else:
        excav_stage1_m3 = excav_pit_m3

    # Rock excavation
    rock_m3 = 0
    if has_rock and pit_depth > rock_start_depth:
        rock_depth = pit_depth - rock_start_depth
        rock_m3 = excav_area * rock_depth * mh.quantity

    # ========== CONCRETE WORK ==========
    # Blinding layer (50mm)
    blinding_m3 = excav_area * 0.05 * mh.quantity

    # Concrete bed
    conc_bed_m3 = excav_area * mh.bed_thickness * mh.quantity

    # Walls - calculate based on material type
    if mh.wall_material == "precast":
        precast_rings_m = wall_height * mh.quantity
        wall_conc_m2 = 0
        wall_stone_m2 = 0
        formwork_walls_m2 = 0
    elif mh.wall_material == "stone":
        precast_rings_m = 0
        wall_conc_m2 = 0
        # Stone measured on mean girth
        mean_girth = int_perim + mh.wall_thickness  # Approximation of centerline
        wall_stone_m2 = mean_girth * wall_height * mh.quantity
        formwork_walls_m2 = 0
    else:  # concrete
        precast_rings_m = 0
        wall_stone_m2 = 0
        # Concrete measured on mean girth
        mean_girth = int_perim + 2 * mh.wall_thickness  # As per measurement conventions
        wall_conc_m2 = mean_girth * wall_height * mh.quantity
        # Formwork to both faces
        formwork_walls_m2 = 2 * int_perim * wall_height * mh.quantity

    # Benching
    bench_nos = 0
    bench_conc_m3 = 0
    if mh.has_benching:
        if mh.type == "circ":
            bench_area = math.pi * (int_diam / 2) ** 2
        else:
            bench_area = int_l * int_w
        bench_conc_m3 = bench_area * mh.benching_avg_height * mh.quantity
        bench_nos = mh.quantity

    # Channel
    channel_m = 0
    if mh.has_channel:
        if mh.channel_length > 0:
            channel_m = mh.channel_length * mh.quantity
        else:
            # Use internal length as default
            channel_m = int_l * mh.quantity

    # Top slab
    if mh.type == "circ":
        slab_area = math.pi * (ext_diam / 2) ** 2 - (mh.cover_length * mh.cover_width)
    else:
        if "ext_l" in locals() and "ext_w" in locals():
            slab_area = (ext_l * ext_w) - (mh.cover_length * mh.cover_width)
        else:
            slab_area = excav_area - (mh.cover_length * mh.cover_width)

    slab_m3 = slab_area * mh.slab_thickness * mh.quantity

    # ========== FORMWORK ==========
    # Formwork soffit (underside of slab)
    if mh.type == "circ":
        form_soffit_m2 = math.pi * (int_diam / 2) ** 2 * mh.quantity
    else:
        form_soffit_m2 = int_l * int_w * mh.quantity

    # Formwork edges (perimeter of slab minus cover opening)
    if mh.type == "circ":
        edge_perim = math.pi * ext_diam
    else:
        edge_perim = 2 * (ext_l + ext_w) if "ext_l" in locals() else ext_perim

    # Deduct cover opening perimeter
    cover_perim = 2 * (mh.cover_length + mh.cover_width)
    form_edge_m = (edge_perim - cover_perim) * mh.quantity
    form_edge_m = max(0, form_edge_m)  # Ensure non-negative

    # ========== FINISHES ==========
    plaster_m2 = 0
    if mh.has_plaster:
        # Plaster to internal walls
        plaster_wall_m2 = int_perim * wall_height * mh.quantity
        # Plaster to benching (if present)
        plaster_bench_m2 = 0
        if mh.has_benching:
            if mh.type == "circ":
                plaster_bench_m2 = math.pi * (int_diam / 2) ** 2 * mh.quantity
            else:
                plaster_bench_m2 = int_l * int_w * mh.quantity
        plaster_m2 = plaster_wall_m2 + plaster_bench_m2

    # ========== FITTINGS ==========
    # Step irons (for depths > 1m, spaced at 300mm vertical centers)
    step_irons_nos = 0
    if mh.has_step_irons and depth_to_invert > 1.0:
        # First step at 450mm below cover, then every 300mm
        num_steps = math.ceil((depth_to_invert - 0.45) / 0.3)
        step_irons_nos = num_steps * mh.quantity

    # Covers and frames
    covers_nos = mh.quantity

    # ========== BACKFILL ==========
    # Total concrete volume
    total_conc_vol = (
        conc_bed_m3
        + slab_m3
        + (wall_conc_m2 * mh.wall_thickness)  # Approximate wall volume
        + (wall_stone_m2 * mh.wall_thickness if wall_stone_m2 > 0 else 0)
        + bench_conc_m3
    )
    backfill_m3 = excav_pit_m3 - total_conc_vol
    backfill_m3 = max(0, backfill_m3)  # Ensure non-negative

    # Dimensions for takeoff sheet
    dimensions = {
        "veg_excav": [{"number": mh.quantity, "length": ext_l if mh.type != "circ" else ext_diam, "width": ext_w if mh.type != "circ" else None, "height": veg_depth, "description": f"Excav veg soil {mh.id}"}],
        "excav_stage1": [{"number": mh.quantity, "length": ext_l if mh.type != "circ" else ext_diam, "width": ext_w if mh.type != "circ" else None, "height": 1.5 if pit_depth > 1.5 else pit_depth, "description": f"Excav pit {mh.id} (stage 1)"}],
        "excav_stage2": [{"number": mh.quantity, "length": ext_l if mh.type != "circ" else ext_diam, "width": ext_w if mh.type != "circ" else None, "height": pit_depth - 1.5, "description": f"Excav pit {mh.id} (stage 2)"}] if pit_depth > 1.5 else [],
        "rock": [{"number": mh.quantity, "length": ext_l if mh.type != "circ" else ext_diam, "width": ext_w if mh.type != "circ" else None, "height": pit_depth - rock_start_depth, "description": f"Rock excav {mh.id}"}] if rock_m3 > 0 else [],
        "blinding": [{"number": mh.quantity, "length": ext_l if mh.type != "circ" else ext_diam, "width": ext_w if mh.type != "circ" else None, "height": 0.05, "description": f"Blinding {mh.id}"}],
        "conc_bed": [{"number": mh.quantity, "length": ext_l if mh.type != "circ" else ext_diam, "width": ext_w if mh.type != "circ" else None, "height": mh.bed_thickness, "description": f"Conc bed {mh.id}"}],
        "wall_conc": [{"number": mh.quantity, "length": mean_girth, "width": wall_height, "height": None, "description": f"Conc walls {mh.id}"}] if wall_conc_m2 > 0 else [],
        "wall_stone": [{"number": mh.quantity, "length": mean_girth, "width": wall_height, "height": None, "description": f"Stone walls {mh.id}"}] if wall_stone_m2 > 0 else [],
        "precast_rings": [{"number": mh.quantity, "length": wall_height, "width": None, "height": None, "description": f"Precast rings {mh.id}"}] if precast_rings_m > 0 else [],
        "formwork_walls": [{"number": mh.quantity * 2, "length": int_perim, "width": wall_height, "height": None, "description": f"Formwork walls {mh.id}"}] if formwork_walls_m2 > 0 else [],
        "bench": [{"number": mh.quantity, "length": None, "width": None, "height": None, "description": f"Benching {mh.id}"}] if bench_nos > 0 else [],
        "channel": [{"number": mh.quantity, "length": int_l if mh.type != "circ" else int_diam, "width": None, "height": None, "description": f"Channel {mh.id}"}] if channel_m > 0 else [],
        "slab": [{"number": mh.quantity, "length": ext_l if mh.type != "circ" else ext_diam, "width": ext_w if mh.type != "circ" else None, "height": mh.slab_thickness, "description": f"Top slab {mh.id}"}],
        "form_soffit": [{"number": mh.quantity, "length": int_l if mh.type != "circ" else int_diam, "width": int_w if mh.type != "circ" else None, "height": None, "description": f"Formwork soffit {mh.id}"}],
        "form_edge": [{"number": mh.quantity, "length": edge_perim - cover_perim, "width": None, "height": None, "description": f"Formwork edges {mh.id}"}] if form_edge_m > 0 else [],
        "plaster": [{"number": mh.quantity, "length": int_perim, "width": wall_height, "height": None, "description": f"Plaster walls {mh.id}"}] if plaster_m2 > 0 else [],
        "step_irons": [{"number": step_irons_nos, "length": None, "width": None, "height": None, "description": f"Step irons {mh.id}"}] if step_irons_nos > 0 else [],
        "covers": [{"number": mh.quantity, "length": mh.cover_length, "width": mh.cover_width, "height": None, "description": f"Cover & frame {mh.id}"}],
        "backfill": [{"number": mh.quantity, "length": excav_area, "width": pit_depth, "height": None, "description": f"Backfill {mh.id}"}],
    }

    return {
        "id": mh.id,
        "type": mh.type,
        "depth": depth_to_invert,
        "veg_excav_m2": round(veg_excav_m2, 3),
        "excav_stage1_m3": round(excav_stage1_m3, 3),
        "excav_stage2_m3": round(excav_stage2_m3, 3),
        "rock_m3": round(rock_m3, 3),
        "blinding_m3": round(blinding_m3, 3),
        "conc_bed_m3": round(conc_bed_m3, 3),
        "wall_conc_m2": round(wall_conc_m2, 3),
        "wall_stone_m2": round(wall_stone_m2, 3),
        "precast_rings_m": round(precast_rings_m, 3),
        "formwork_walls_m2": round(formwork_walls_m2, 3),
        "bench_nos": int(bench_nos),
        "bench_conc_m3": round(bench_conc_m3, 3),
        "channel_m": round(channel_m, 3),
        "slab_m3": round(slab_m3, 3),
        "form_soffit_m2": round(form_soffit_m2, 3),
        "form_edge_m": round(form_edge_m, 3),
        "plaster_m2": round(plaster_m2, 3),
        "step_irons_nos": int(step_irons_nos),
        "covers_nos": int(covers_nos),
        "backfill_m3": round(backfill_m3, 3),
        "position_x": mh.position_x,
        "position_y": mh.position_y,
        "ground_level": mh.ground_level,
        "invert_level": mh.invert_level,
        "internal_length": mh.internal_length,
        "internal_width": mh.internal_width,
        "internal_diameter": mh.internal_diameter,
        "wall_thickness": mh.wall_thickness,
        "bed_thickness": mh.bed_thickness,
        "slab_thickness": mh.slab_thickness,
        "benching_avg_height": mh.benching_avg_height,
        "has_benching": mh.has_benching,
        "has_channel": mh.has_channel,
        "channel_length": mh.channel_length,
        "has_step_irons": mh.has_step_irons,
        "projection_thickness": mh.projection_thickness,
        "cover_length": mh.cover_length,
        "cover_width": mh.cover_width,
        "dimensions": dimensions,
    }


def calculate_pipe_quantities(
    pipe: PipeRun, has_rock: bool, rock_start_depth: float
) -> Dict[str, Any]:
    """
    Calculate all quantities for a pipe run

    Returns a dictionary with all calculated quantities
    """

    avg_depth = (pipe.trench_depth_start + pipe.trench_depth_end) / 2
    diam = pipe.diameter_mm / 1000  # Convert to meters

    # ========== TRENCH EXCAVATION ==========
    trench_vol = pipe.length * pipe.trench_width * avg_depth * pipe.quantity

    # Stage excavation (split at 1.5m depth)
    trench_stage1_m3 = 0
    trench_stage2_m3 = 0
    if avg_depth > 1.5:
        trench_stage1_m3 = pipe.length * pipe.trench_width * 1.5 * pipe.quantity
        trench_stage2_m3 = (
            pipe.length * pipe.trench_width * (avg_depth - 1.5) * pipe.quantity
        )
    else:
        trench_stage1_m3 = trench_vol

    # Rock excavation
    rock_m3 = 0
    if has_rock and avg_depth > rock_start_depth:
        rock_depth = avg_depth - rock_start_depth
        rock_m3 = pipe.length * pipe.trench_width * rock_depth * pipe.quantity

    # ========== BEDDING/SURROUND ==========
    bedding_m3 = 0

    if pipe.bedding_type in ["granular", "sand"]:
        # 100mm below pipe, 150mm above pipe crown
        bed_height = 0.1 + diam + 0.15
        # Approximate volume (simplified calculation)
        bedding_m3 = pipe.length * pipe.trench_width * bed_height * pipe.quantity * 0.45

    elif pipe.bedding_type == "concrete_bed":
        # Concrete bed 150mm thick below pipe
        bedding_m3 = pipe.length * pipe.trench_width * 0.15 * pipe.quantity

    elif pipe.bedding_type == "concrete_surround":
        # Complete concrete surround (150mm all around)
        outer_width = diam + 2 * 0.15
        outer_height = diam + 2 * 0.15
        # Calculate as rectangular section minus pipe volume
        pipe_vol = pipe.length * math.pi * (diam / 2) ** 2 * pipe.quantity
        total_vol = pipe.length * outer_width * outer_height * pipe.quantity
        bedding_m3 = total_vol - pipe_vol

    # ========== PIPE LENGTH ==========
    pipe_length = pipe.length * pipe.quantity

    # ========== BACKFILL ==========
    # Calculate pipe volume
    pipe_vol = pipe.length * math.pi * (diam / 2) ** 2 * pipe.quantity
    backfill_m3 = trench_vol - bedding_m3 - pipe_vol
    backfill_m3 = max(0, backfill_m3)  # Ensure non-negative

    # Dimensions for takeoff sheet
    dimensions = {
        "trench_stage1": [{"number": pipe.quantity, "length": pipe.length, "width": pipe.trench_width, "height": 1.5 if avg_depth > 1.5 else avg_depth, "description": f"Trench {pipe.id} (stage 1)"}],
        "trench_stage2": [{"number": pipe.quantity, "length": pipe.length, "width": pipe.trench_width, "height": avg_depth - 1.5, "description": f"Trench {pipe.id} (stage 2)"}] if avg_depth > 1.5 else [],
        "rock": [{"number": pipe.quantity, "length": pipe.length, "width": pipe.trench_width, "height": avg_depth - rock_start_depth, "description": f"Rock trench {pipe.id}"}] if rock_m3 > 0 else [],
        "bedding": [{"number": pipe.quantity, "length": pipe.length, "width": pipe.trench_width, "height": 0.1 + diam + 0.15, "description": f"Bedding {pipe.id}"}] if bedding_m3 > 0 else [],
        "pipe_length": [{"number": pipe.quantity, "length": pipe.length, "width": None, "height": None, "description": f"Pipe {pipe.id}"}],
        "backfill": [{"number": pipe.quantity, "length": pipe.length, "width": pipe.trench_width, "height": avg_depth, "description": f"Backfill trench {pipe.id}"}],
    }

    return {
        "id": pipe.id,
        "from_point": pipe.from_point,
        "to_point": pipe.to_point,
        "diameter_mm": pipe.diameter_mm,
        "pipe_material": pipe.pipe_material,
        "trench_stage1_m3": round(trench_stage1_m3, 3),
        "trench_stage2_m3": round(trench_stage2_m3, 3),
        "rock_m3": round(rock_m3, 3),
        "bedding_type": pipe.bedding_type,
        "bedding_m3": round(bedding_m3, 3),
        "pipe_length_m": round(pipe_length, 3),
        "backfill_m3": round(backfill_m3, 3),
        "gradient": pipe.gradient,
        "length": pipe.length,
        "trench_width": pipe.trench_width,
        "trench_depth_start": pipe.trench_depth_start,
        "trench_depth_end": pipe.trench_depth_end,
        "avg_depth": round(avg_depth, 3),
        "dimensions": dimensions,
    }


def compile_boq_items(
    manhole_results: List[Dict], pipe_results: List[Dict], project: ProjectInput
) -> List[Dict[str, Any]]:
    """
    Compile Bill of Quantities items from calculated results with dimensions
    """
    boq_items = []

    def add_item(code, description, unit, quantity, dims):
        if quantity > 0:
            boq_items.append({
                "code": code,
                "name": code,
                "description": description,
                "unit": unit,
                "quantity": round(quantity, 2),
                "dimensions": dims
            })

    # ========== SITE CLEARANCE ==========
    if project.site_clearance_area > 0:
        add_item("A.1", "Site clearance including removal of vegetation", "m²", project.site_clearance_area, 
                 [{"number": 1, "length": project.site_clearance_area, "width": None, "height": None, "description": "Site clearance"}])

    # ========== MANHOLES ==========
    mh_categories = [
        ("B.1.1", "Excavation veg soil (manholes)", "m²", "veg_excav_m2", "veg_excav"),
        ("B.1.2", "Excavation pits ≤1.5m depth", "m³", "excav_stage1_m3", "excav_stage1"),
        ("B.1.3", "Extra over excavation >1.5m depth", "m³", "excav_stage2_m3", "excav_stage2"),
        ("B.1.4", "Extra over rock excavation (manholes)", "m³", "rock_m3", "rock"),
        ("D.1.1", "Plain concrete blinding 50mm thick", "m³", "blinding_m3", "blinding"),
        ("D.1.2", "Reinforced concrete bed to manholes", "m³", "conc_bed_m3", "conc_bed"),
        ("D.1.3", "Mass concrete walls to manholes", "m²", "wall_conc_m2", "wall_conc"),
        ("D.1.3A", "Stone masonry walls to manholes", "m²", "wall_stone_m2", "wall_stone"),
        ("D.1.3B", "Precast concrete manhole rings", "m", "precast_rings_m", "precast_rings"),
        ("D.1.4", "Half-round channel in concrete", "m", "channel_m", "channel"),
        ("D.1.5", "Benching to manholes", "No.", "bench_nos", "bench"),
        ("D.1.6", "Reinforced concrete slab to manholes", "m³", "slab_m3", "slab"),
        ("D.2.1", "Formwork to soffit of slabs", "m²", "form_soffit_m2", "form_soffit"),
        ("D.2.2", "Formwork to edges of slabs", "m", "form_edge_m", "form_edge"),
        ("D.2.3", "Formwork to faces of walls", "m²", "formwork_walls_m2", "formwork_walls"),
        ("E.1", "Cement sand plaster 12mm thick", "m²", "plaster_m2", "plaster"),
        ("F.1.1", "Manhole covers and frames", "No.", "covers_nos", "covers"),
        ("F.2", "Step irons to manholes", "No.", "step_irons_nos", "step_irons"),
    ]

    for code, desc, unit, key, dim_key in mh_categories:
        total_q = sum(mh.get(key, 0) for mh in manhole_results)
        all_dims = []
        for mh in manhole_results:
            all_dims.extend(mh.get("dimensions", {}).get(dim_key, []))
        add_item(code, desc, unit, total_q, all_dims)

    # ========== PIPES ==========
    pipe_categories = [
        ("B.2.1", "Trench excavation ≤1.5m depth", "m³", "trench_stage1_m3", "trench_stage1"),
        ("B.2.2", "Extra over trench excavation >1.5m", "m³", "trench_stage2_m3", "trench_stage2"),
        ("B.2.3", "Extra over rock excavation (trenches)", "m³", "rock_m3", "rock"),
    ]

    for code, desc, unit, key, dim_key in pipe_categories:
        total_q = sum(p.get(key, 0) for p in pipe_results)
        all_dims = []
        for p in pipe_results:
            all_dims.extend(p.get("dimensions", {}).get(dim_key, []))
        add_item(code, desc, unit, total_q, all_dims)

    # Bedding by type
    granular_q = sum(p["bedding_m3"] for p in pipe_results if p["bedding_type"] == "granular")
    granular_dims = []
    for p in [pr for pr in pipe_results if pr["bedding_type"] == "granular"]:
        granular_dims.extend(p.get("dimensions", {}).get("bedding", []))
    add_item("G.2.1", "Granular bedding and surround to pipes", "m³", granular_q, granular_dims)

    sand_q = sum(p["bedding_m3"] for p in pipe_results if p["bedding_type"] == "sand")
    sand_dims = []
    for p in [pr for pr in pipe_results if pr["bedding_type"] == "sand"]:
        sand_dims.extend(p.get("dimensions", {}).get("bedding", []))
    add_item("G.2.2", "Sand bedding to pipes", "m³", sand_q, sand_dims)

    concrete_q = sum(p["bedding_m3"] for p in pipe_results if p["bedding_type"] not in ["granular", "sand"])
    concrete_dims = []
    for p in [pr for pr in pipe_results if pr["bedding_type"] not in ["granular", "sand"]]:
        concrete_dims.extend(p.get("dimensions", {}).get("bedding", []))
    add_item("G.2.3", "Concrete bedding/surround to pipes", "m³", concrete_q, concrete_dims)

    # Pipes by material
    upvc_q = sum(p["pipe_length_m"] for p in pipe_results if "upvc" in p["pipe_material"].lower())
    upvc_dims = []
    for p in [pr for pr in pipe_results if "upvc" in pr["pipe_material"].lower()]:
        upvc_dims.extend(p.get("dimensions", {}).get("pipe_length", []))
    add_item("G.1.1", "uPVC pipes including joints and testing", "m", upvc_q, upvc_dims)

    pcc_q = sum(p["pipe_length_m"] for p in pipe_results if "upvc" not in p["pipe_material"].lower() and "pvc" not in p["pipe_material"].lower())
    pcc_dims = []
    for p in [pr for pr in pipe_results if "upvc" not in pr["pipe_material"].lower() and "pvc" not in pr["pipe_material"].lower()]:
        pcc_dims.extend(p.get("dimensions", {}).get("pipe_length", []))
    add_item("G.1.4", "Precast concrete pipes including joints", "m", pcc_q, pcc_dims)

    # ========== BACKFILLING ==========
    total_backfill = sum(mh.get("backfill_m3", 0) for mh in manhole_results) + sum(p.get("backfill_m3", 0) for p in pipe_results)
    backfill_dims = []
    for mh in manhole_results:
        backfill_dims.extend(mh.get("dimensions", {}).get("backfill", []))
    for p in pipe_results:
        backfill_dims.extend(p.get("dimensions", {}).get("backfill", []))
    add_item("H.1", "Backfilling to excavations with selected material", "m³", total_backfill, backfill_dims)

    # ========== ANCILLARY WORKS ==========
    if project.road_reinstatement_area > 0:
        add_item("K.1.1", "Reinstatement of tarmac carriageway", "m²", project.road_reinstatement_area, 
                 [{"number": 1, "length": project.road_reinstatement_area, "width": None, "height": None, "description": "Road reinstatement"}])

    if project.pavement_reinstatement_area > 0:
        add_item("K.1.4", "Reinstatement of paved footway", "m²", project.pavement_reinstatement_area, 
                 [{"number": 1, "length": project.pavement_reinstatement_area, "width": None, "height": None, "description": "Pavement reinstatement"}])

    if project.boundary_area > 0:
        add_item("K.2.1", "Boundary fence reinstatement", "m", project.boundary_area, 
                 [{"number": 1, "length": project.boundary_area, "width": None, "height": None, "description": "Boundary reinstatement"}])

    # ========== PROVISIONAL ITEMS ==========
    if project.has_planking:
        add_item("C.1", "Planking, strutting and timbering", "Item", 1, [{"number": 1, "length": None, "width": None, "height": None, "description": "Provisional"}])

    # ========== TESTING ==========
    add_item("I.1", "Testing and commissioning of drainage system", "Item", 1, [{"number": 1, "length": None, "width": None, "height": None, "description": "Lump sum"}])

    return boq_items


# ============================================================================
# API ENDPOINTS
# ============================================================================


@router.get("/")
def read_root():
    """Root endpoint with API information"""
    return {
        "message": "Drainage Takeoff API",
        "version": "1.0.0",
        "endpoints": {
            "calculate": "/calculate - POST - Calculate drainage quantities",
            "health": "/health - GET - Health check",
        },
    }


@router.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@router.post("/calculate")
def calculate_takeoff(project: ProjectInput):
    """
    Calculate all quantities for the drainage project

    This endpoint takes a complete project specification and returns:
    - Individual manhole quantities
    - Individual pipe quantities
    - Total quantities
    - Bill of Quantities items
    """

    try:
        # Validate input
        if not project.manholes:
            raise HTTPException(
                status_code=400, detail="At least one manhole is required"
            )

        # Initialize results
        manhole_results = []
        total_mh_quantities = {
            "veg_excav_m2": 0,
            "excav_stage1_m3": 0,
            "excav_stage2_m3": 0,
            "rock_m3": 0,
            "blinding_m3": 0,
            "conc_bed_m3": 0,
            "wall_conc_m2": 0,
            "wall_stone_m2": 0,
            "precast_rings_m": 0,
            "formwork_walls_m2": 0,
            "bench_nos": 0,
            "bench_conc_m3": 0,
            "channel_m": 0,
            "slab_m3": 0,
            "form_soffit_m2": 0,
            "form_edge_m": 0,
            "plaster_m2": 0,
            "step_irons_nos": 0,
            "covers_nos": 0,
            "backfill_m3": 0,
        }

        # Calculate manhole quantities
        for mh in project.manholes:
            result = calculate_manhole_quantities(
                mh, project.has_rock, project.rock_start_depth, project.veg_depth
            )
            manhole_results.append(result)

            # Sum totals
            for key in total_mh_quantities:
                if key in result:
                    total_mh_quantities[key] += result[key]

        # Calculate pipe quantities
        pipe_results = []
        total_pipe_quantities = {
            "trench_stage1_m3": 0,
            "trench_stage2_m3": 0,
            "rock_m3": 0,
            "bedding_granular_m3": 0,
            "bedding_sand_m3": 0,
            "bedding_concrete_m3": 0,
            "pipe_upvc_m": 0,
            "pipe_pvc_m": 0,
            "pipe_pcc_m": 0,
            "backfill_m3": 0,
        }

        for pipe in project.pipes:
            result = calculate_pipe_quantities(
                pipe, project.has_rock, project.rock_start_depth
            )
            pipe_results.append(result)

            # Sum totals
            total_pipe_quantities["trench_stage1_m3"] += result["trench_stage1_m3"]
            total_pipe_quantities["trench_stage2_m3"] += result["trench_stage2_m3"]
            total_pipe_quantities["rock_m3"] += result["rock_m3"]
            total_pipe_quantities["backfill_m3"] += result["backfill_m3"]

            # Bedding by type
            if result["bedding_type"] == "granular":
                total_pipe_quantities["bedding_granular_m3"] += result["bedding_m3"]
            elif result["bedding_type"] == "sand":
                total_pipe_quantities["bedding_sand_m3"] += result["bedding_m3"]
            else:
                total_pipe_quantities["bedding_concrete_m3"] += result["bedding_m3"]

            # Pipes by material
            material = result["pipe_material"].lower()
            if "upvc" in material:
                total_pipe_quantities["pipe_upvc_m"] += result["pipe_length_m"]
            elif "pvc" in material:
                total_pipe_quantities["pipe_pvc_m"] += result["pipe_length_m"]
            else:
                total_pipe_quantities["pipe_pcc_m"] += result["pipe_length_m"]

        # Compile BOQ items
        boq_items = compile_boq_items(
            manhole_results, pipe_results, project
        )

        # Return complete results
        return {
            "success": True,
            "project_name": project.project_name,
            "calculation_date": datetime.now().isoformat(),
            "manholes": manhole_results,
            "pipes": pipe_results,
            "totals": {"manholes": total_mh_quantities, "pipes": total_pipe_quantities},
            "boq_items": boq_items,
            "summary": {
                "total_manholes": len(project.manholes),
                "total_pipe_runs": len(project.pipes),
                "total_excavation_m3": (
                    total_mh_quantities["excav_stage1_m3"]
                    + total_mh_quantities["excav_stage2_m3"]
                    + total_pipe_quantities["trench_stage1_m3"]
                    + total_pipe_quantities["trench_stage2_m3"]
                ),
                "total_concrete_m3": (
                    total_mh_quantities["conc_bed_m3"]
                    + total_mh_quantities["slab_m3"]
                    + total_mh_quantities["bench_conc_m3"]
                ),
                "total_pipe_length_m": (
                    total_pipe_quantities["pipe_upvc_m"]
                    + total_pipe_quantities["pipe_pvc_m"]
                    + total_pipe_quantities["pipe_pcc_m"]
                ),
                "total_boq_items": len(boq_items),
            },
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/validate")
def validate_project(project: ProjectInput):
    """
    Validate project input without performing calculations
    """
    errors = []
    warnings = []

    # Validate manholes
    for mh in project.manholes:
        if mh.type not in ["rect", "square", "circ"]:
            errors.append(f"Manhole {mh.id}: Invalid type '{mh.type}'")

        if mh.type == "circ" and not mh.internal_diameter:
            errors.append(f"Manhole {mh.id}: Diameter required for circular type")

        if mh.type in ["rect", "square"] and (
            not mh.internal_length or not mh.internal_width
        ):
            errors.append(
                f"Manhole {mh.id}: Length and width required for rectangular type"
            )

        if mh.ground_level <= mh.invert_level:
            errors.append(f"Manhole {mh.id}: Ground level must be above invert level")

        depth = mh.ground_level - mh.invert_level
        if depth > 6.0:
            warnings.append(
                f"Manhole {mh.id}: Depth {depth:.2f}m exceeds typical maximum of 6m"
            )

    # Validate pipes
    for pipe in project.pipes:
        if pipe.diameter_mm < 100 or pipe.diameter_mm > 600:
            warnings.append(
                f"Pipe {pipe.id}: Diameter {pipe.diameter_mm}mm outside typical range"
            )

        if pipe.gradient < 0.5 or pipe.gradient > 10:
            warnings.append(
                f"Pipe {pipe.id}: Gradient {pipe.gradient}% outside typical range (0.5-10%)"
            )

        if pipe.trench_depth_start > 5 or pipe.trench_depth_end > 5:
            warnings.append(
                f"Pipe {pipe.id}: Trench depth exceeds 5m - consider deeper excavation rates"
            )

    if errors:
        return {"valid": False, "errors": errors, "warnings": warnings}

    return {"valid": True, "errors": [], "warnings": warnings}


@router.get("/api/info")
def api_info():
    """Get API information and documentation"""
    return {
        "api_name": "Drainage Takeoff Calculator API",
        "version": "1.0.0",
        "description": "Calculate quantities for drainage works including manholes and pipes",
        "features": [
            "Manhole quantity calculation (rectangular, square, circular)",
            "Pipe run calculations with varying depths",
            "Staged excavation (≤1.5m and >1.5m)",
            "Rock excavation calculations",
            "Multiple wall materials (concrete, stone, precast)",
            "Bedding types (granular, sand, concrete)",
            "Step iron calculations",
            "BOQ generation in standard format",
            "Support for multiple manholes and pipe runs",
        ],
        "endpoints": {
            "/": "API information",
            "/health": "Health check",
            "/calculate": "POST - Calculate project quantities",
            "/validate": "POST - Validate project input",
            "/api/info": "API documentation",
        },
    }
