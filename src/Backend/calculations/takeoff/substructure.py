from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import math


router = APIRouter()


class SubstructureInput(BaseModel):
    # Plan Details
    plan_type: str = Field(..., description="rectangle/semi-circle/complex")
    ext_length: float = Field(..., gt=0, description="External length in meters")
    ext_width: float = Field(..., gt=0, description="External width in meters")

    # Internal Walls
    has_internal_walls: bool = False
    int_wall_len: float = 0.0

    # Columns
    has_columns: bool = False
    num_columns: int = 0
    col_size: float = 0.0
    col_base_size: float = 0.0
    col_excav_depth: float = 0.0

    # Recess/Void
    has_recess: bool = False
    recess_type: str = ""  # corner/center/bay
    recess_len: float = 0.0
    recess_wid: float = 0.0

    # Wall Configuration
    has_cavity_wall: bool = False
    cavity_thick: float = 0.0
    wall_thick: float = Field(..., gt=0)

    # Depths and Thicknesses
    veg_depth: float = Field(..., gt=0)
    trench_depth: float = Field(..., gt=0)
    reduce_level_depth: float = Field(..., gt=0)
    conc_thick_strip: float = Field(..., gt=0)
    hardcore_thick: float = Field(..., gt=0)
    blinding_thick: float = Field(..., gt=0)
    dpm_thick: float = Field(..., gt=0, description="DPM thickness in mm")

    # Additional Features
    anti_termite: bool = False
    has_formwork: bool = False
    has_reinforce: bool = False
    rebar_len: float = 0.0

    # Clearances
    clear_extra: float = Field(..., ge=0)

    # Backfill and Topsoil
    reinstate_width: float = 0.4
    backfill_reuse_factor: float = 0.5


class TakeoffItem(BaseModel):
    item_no: str
    description: str
    quantity: float
    unit: str
    remarks: str = ""


class SubstructureOutput(BaseModel):
    success: bool
    takeoff_items: List[TakeoffItem]
    summary: Dict[str, float]


def calculate_center_line(
    ext_length: float,
    ext_width: float,
    int_wall_len: float,
    wall_thick: float,
    plan_type: str,
    has_recess: bool,
    recess_type: str,
    recess_wid: float,
    recess_len: float,
) -> float:
    """Calculate center line of walls"""
    # External perimeter center line
    if plan_type == "rectangle":
        center_line = 2 * (ext_length + ext_width) - 4 * wall_thick
    elif plan_type == "semi-circle":
        center_line = ext_length + ext_width + (math.pi * ext_width / 2)
    else:  # complex
        center_line = 2 * (ext_length + ext_width)

    # Add internal walls
    center_line += int_wall_len

    # Adjust for recess
    if has_recess:
        if recess_type == "corner":
            center_line -= 2 * recess_wid
        elif recess_type == "center":
            center_line += 2 * recess_len
        elif recess_type == "bay":
            center_line += math.pi * recess_len / 4

    return center_line


@router.post("/api/calculate", response_model=SubstructureOutput)
async def calculate_takeoff(data: SubstructureInput):
    try:
        takeoff_items = []
        item_counter = 1

        # 1. SITE CLEARANCE
        site_clear_area = (data.ext_length + 2 * data.clear_extra) * (
            data.ext_width + 2 * data.clear_extra
        )

        if data.has_recess:
            if data.recess_type == "corner":
                site_clear_area -= data.recess_len * data.recess_wid
            elif data.recess_type == "center":
                site_clear_area -= 0.5 * data.recess_len * data.recess_wid
            elif data.recess_type == "bay":
                site_clear_area += (3 / 14) * math.pi * (data.recess_len / 2) ** 2

        takeoff_items.append(
            TakeoffItem(
                item_no=f"A.{item_counter}",
                description="Site clearance including removal of vegetation, shrubs, and debris",
                quantity=round(site_clear_area, 2),
                unit="m²",
                remarks="Measured over foundation area plus clearance",
            )
        )
        item_counter += 1

        # 2. SETTING OUT
        setting_out_perim = 2 * (data.ext_length + data.ext_width)
        takeoff_items.append(
            TakeoffItem(
                item_no=f"A.{item_counter}",
                description="Setting out foundation using profile boards, string lines, and level instruments",
                quantity=round(setting_out_perim, 2),
                unit="m",
                remarks="Perimeter measurement",
            )
        )
        item_counter += 1

        # 3. EXCAVATION - VEGETABLE SOIL
        veg_vol = site_clear_area * data.veg_depth
        takeoff_items.append(
            TakeoffItem(
                item_no=f"B.{item_counter}",
                description="Excavation of vegetable soil for preservation and re-use",
                quantity=round(veg_vol, 2),
                unit="m³",
                remarks=f"Depth: {data.veg_depth}m",
            )
        )
        item_counter += 1

        # 4. EXCAVATION - TRENCH
        center_line = calculate_center_line(
            data.ext_length,
            data.ext_width,
            data.int_wall_len,
            data.wall_thick,
            data.plan_type,
            data.has_recess,
            data.recess_type,
            data.recess_wid,
            data.recess_len,
        )

        trench_excav_vol = center_line * data.wall_thick * data.trench_depth
        takeoff_items.append(
            TakeoffItem(
                item_no=f"B.{item_counter}",
                description="Excavation of trench foundation to reduce level in ordinary soil",
                quantity=round(trench_excav_vol, 2),
                unit="m³",
                remarks=f"Width: {data.wall_thick}m, Depth: {data.trench_depth}m",
            )
        )
        item_counter += 1

        # 5. EXCAVATION - REDUCE LEVEL
        reduce_level_vol = site_clear_area * data.reduce_level_depth
        takeoff_items.append(
            TakeoffItem(
                item_no=f"B.{item_counter}",
                description="Excavation to reduce level for ground floor slab",
                quantity=round(reduce_level_vol, 2),
                unit="m³",
                remarks=f"Depth: {data.reduce_level_depth}m",
            )
        )
        item_counter += 1

        # 6. COLUMN EXCAVATION (if applicable)
        col_excav_vol = 0
        if data.has_columns and data.num_columns > 0:
            col_excav_vol = (
                data.num_columns * (data.col_base_size**2) * data.col_excav_depth
            )
            takeoff_items.append(
                TakeoffItem(
                    item_no=f"B.{item_counter}",
                    description=f"Excavation for column bases ({data.num_columns} No.)",
                    quantity=round(col_excav_vol, 2),
                    unit="m³",
                    remarks=f"Size: {data.col_base_size}m x {data.col_base_size}m x {data.col_excav_depth}m",
                )
            )
            item_counter += 1

        total_excav = trench_excav_vol + reduce_level_vol + col_excav_vol

        # 7. DISPOSAL - VEGETABLE SOIL
        takeoff_items.append(
            TakeoffItem(
                item_no=f"C.{item_counter}",
                description="Cart away and dispose vegetable soil off-site (temporary stockpile)",
                quantity=round(veg_vol, 2),
                unit="m³",
                remarks="For later re-use",
            )
        )
        item_counter += 1

        # 8. DISPOSAL - EXCAVATED MATERIAL
        disposal_other = total_excav
        takeoff_items.append(
            TakeoffItem(
                item_no=f"C.{item_counter}",
                description="Cart away and dispose surplus excavated material off-site",
                quantity=round(disposal_other, 2),
                unit="m³",
                remarks="Beyond backfill requirements",
            )
        )
        item_counter += 1

        # 9. HARDCORE FILLING
        hardcore_area = site_clear_area
        if data.has_recess:
            hardcore_area -= data.recess_len * data.recess_wid

        hardcore_vol = hardcore_area * data.hardcore_thick
        takeoff_items.append(
            TakeoffItem(
                item_no=f"D.{item_counter}",
                description="Hardcore filling with compacted murram/crushed stone in layers not exceeding 150mm",
                quantity=round(hardcore_vol, 2),
                unit="m³",
                remarks=f"Thickness: {data.hardcore_thick}m, compacted",
            )
        )
        item_counter += 1

        # 10. BLINDING CONCRETE
        blinding_area = hardcore_area
        blinding_vol = blinding_area * data.blinding_thick
        takeoff_items.append(
            TakeoffItem(
                item_no=f"D.{item_counter}",
                description="Blinding concrete (1:3:6) over hardcore base",
                quantity=round(blinding_vol, 2),
                unit="m³",
                remarks=f"Thickness: {data.blinding_thick}m (50mm typical)",
            )
        )
        item_counter += 1

        # 11. DPM (Damp Proof Membrane)
        dpm_area = blinding_area
        takeoff_items.append(
            TakeoffItem(
                item_no=f"D.{item_counter}",
                description=f"Damp proof membrane {data.dpm_thick}mm polythene sheeting with lapped joints",
                quantity=round(dpm_area, 2),
                unit="m²",
                remarks="Including 150mm laps and turning up at edges",
            )
        )
        item_counter += 1

        # 12. ANTI-TERMITE TREATMENT (if applicable)
        if data.anti_termite:
            takeoff_items.append(
                TakeoffItem(
                    item_no=f"D.{item_counter}",
                    description="Anti-termite treatment to soil and DPM surface",
                    quantity=round(dpm_area, 2),
                    unit="m²",
                    remarks="Chemical barrier system",
                )
            )
            item_counter += 1

        # 13. FOUNDATION CONCRETE - STRIP
        conc_strip_vol = center_line * data.wall_thick * data.conc_thick_strip
        takeoff_items.append(
            TakeoffItem(
                item_no=f"E.{item_counter}",
                description="Mass concrete (1:2:4 - 20mm aggregate) in strip foundation",
                quantity=round(conc_strip_vol, 2),
                unit="m³",
                remarks=f"Width: {data.wall_thick}m, Thickness: {data.conc_thick_strip}m",
            )
        )
        item_counter += 1

        # 14. FOUNDATION CONCRETE - COLUMNS (if applicable)
        conc_col_vol = 0
        if data.has_columns and data.num_columns > 0:
            conc_col_vol = (
                data.num_columns * (data.col_base_size**2) * data.conc_thick_strip
            )
            takeoff_items.append(
                TakeoffItem(
                    item_no=f"E.{item_counter}",
                    description=f"Mass concrete (1:2:4) in column bases ({data.num_columns} No.)",
                    quantity=round(conc_col_vol, 2),
                    unit="m³",
                    remarks=f"Base size: {data.col_base_size}m x {data.col_base_size}m",
                )
            )
            item_counter += 1

        total_conc = conc_strip_vol + conc_col_vol

        # 15. FORMWORK (if applicable)
        if data.has_formwork:
            formwork_perim = 2 * (data.ext_length + data.ext_width)
            formwork_area = formwork_perim * data.conc_thick_strip * 2
            takeoff_items.append(
                TakeoffItem(
                    item_no=f"E.{item_counter}",
                    description="Formwork to edges of foundation concrete",
                    quantity=round(formwork_area, 2),
                    unit="m²",
                    remarks="Both sides of strip foundation",
                )
            )
            item_counter += 1

        # 16. FOUNDATION WALLING
        wall_height = data.trench_depth - data.conc_thick_strip
        wall_area = center_line * wall_height

        if data.has_cavity_wall:
            inner_wall_area = wall_area
            outer_wall_area = wall_area

            takeoff_items.append(
                TakeoffItem(
                    item_no=f"F.{item_counter}",
                    description="Foundation walling in cement sand mortar (1:4) - Outer leaf",
                    quantity=round(outer_wall_area, 2),
                    unit="m²",
                    remarks=f"Height: {wall_height}m, Thickness: {data.wall_thick}m",
                )
            )
            item_counter += 1

            takeoff_items.append(
                TakeoffItem(
                    item_no=f"F.{item_counter}",
                    description="Foundation walling in cement sand mortar (1:4) - Inner leaf",
                    quantity=round(inner_wall_area, 2),
                    unit="m²",
                    remarks=f"Height: {wall_height}m, Cavity: {data.cavity_thick}m",
                )
            )
            item_counter += 1
        else:
            takeoff_items.append(
                TakeoffItem(
                    item_no=f"F.{item_counter}",
                    description="Foundation walling in cement sand mortar (1:4)",
                    quantity=round(wall_area, 2),
                    unit="m²",
                    remarks=f"Height: {wall_height}m, Thickness: {data.wall_thick}m",
                )
            )
            item_counter += 1

        # 17. REINFORCEMENT (if applicable)
        if data.has_reinforce and data.rebar_len > 0:
            takeoff_items.append(
                TakeoffItem(
                    item_no=f"E.{item_counter}",
                    description="Reinforcement bars (High Tensile Steel) in foundation",
                    quantity=round(data.rebar_len, 2),
                    unit="m",
                    remarks="Including cutting, bending, and tying",
                )
            )
            item_counter += 1

        # 18. BACKFILLING
        wall_vol = wall_area * data.wall_thick
        if data.has_cavity_wall:
            wall_vol = wall_area * data.wall_thick * 2 - (wall_area * data.cavity_thick)

        backfill_vol = (
            total_excav - total_conc - wall_vol
        ) * data.backfill_reuse_factor
        takeoff_items.append(
            TakeoffItem(
                item_no=f"G.{item_counter}",
                description="Backfilling with selected excavated material in layers, compacted",
                quantity=round(backfill_vol, 2),
                unit="m³",
                remarks="Around foundations",
            )
        )
        item_counter += 1

        # 19. REINSTATING TOPSOIL
        reinstate_perim = 2 * (data.ext_length + data.ext_width)
        if data.has_columns:
            reinstate_perim += 4 * data.col_base_size * data.num_columns

        reinstate_vol = reinstate_perim * data.reinstate_width * data.veg_depth / 2
        takeoff_items.append(
            TakeoffItem(
                item_no=f"G.{item_counter}",
                description="Reinstating preserved vegetable soil around building perimeter",
                quantity=round(reinstate_vol, 2),
                unit="m³",
                remarks=f"Width: {data.reinstate_width}m",
            )
        )
        item_counter += 1

        # 20. COMPACTION
        takeoff_items.append(
            TakeoffItem(
                item_no=f"G.{item_counter}",
                description="Compaction of backfilled areas using mechanical compactor",
                quantity=round(site_clear_area, 2),
                unit="m²",
                remarks="To 95% MDD",
            )
        )

        # Summary calculations
        summary = {
            "site_clearance_m2": round(site_clear_area, 2),
            "total_excavation_m3": round(total_excav + veg_vol, 2),
            "total_concrete_m3": round(total_conc, 2),
            "foundation_wall_m2": round(
                wall_area * (2 if data.has_cavity_wall else 1), 2
            ),
            "hardcore_m3": round(hardcore_vol, 2),
            "backfill_m3": round(backfill_vol, 2),
            "dpm_m2": round(dpm_area, 2),
        }

        return SubstructureOutput(
            success=True, takeoff_items=takeoff_items, summary=summary
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def root():
    return {"message": "Substructure Takeoff API", "version": "1.0", "status": "active"}


@router.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "substructure-takeoff-api"}
