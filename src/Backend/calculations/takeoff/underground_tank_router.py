"""
Underground Tank Takeoff API Router
FastAPI APIRouter for underground water tank quantity calculations
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import math

router = APIRouter()


# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class UndergroundTankInput(BaseModel):
    """Input parameters for underground tank calculation"""

    tank_type: str = "circular"
    veg_soil: float = 0.15
    working_space: float = 0.3
    blinding_thick: float = 0.075
    bed_thick: float = 0.15
    wall_thick: float = 0.2
    slab_thick: float = 0.15
    plaster_thick: float = 0.012
    mastic_thick: float = 0.02
    brick_thick: float = 0.115
    cover_to_slab: float = 0.3
    num_covers: int = 1
    cover_L: float = 0.6
    cover_W: float = 0.6
    int_diam: Optional[float] = None
    int_L: Optional[float] = None
    int_W: Optional[float] = None
    depth_int: float = 2.5


class BOQItem(BaseModel):
    """Bill of Quantities item"""

    item_no: str
    description: str
    unit: str
    quantity: str
    rate: str
    amount: str


class UndergroundTankResponse(BaseModel):
    """Response model for underground tank calculation"""

    summary: Dict[str, float]
    items: List[BOQItem]
    total_amount: float


# ============================================================================
# CALCULATION FUNCTIONS
# ============================================================================


def calculate_quantities(input_data: UndergroundTankInput) -> Dict[str, float]:
    """Calculate tank dimensions and material quantities"""

    # Determine tank dimensions based on type
    if input_data.tank_type == "circular":
        if not input_data.int_diam:
            raise ValueError("Internal diameter required for circular tank")

        int_diam = input_data.int_diam
        int_radius = int_diam / 2

        # Areas
        base_area = math.pi * int_radius**2
        wall_circum = math.pi * int_diam

        # External dimensions
        ext_diam = int_diam + 2 * input_data.wall_thick
        ext_radius = ext_diam / 2

    else:  # rectangular
        if not input_data.int_L or not input_data.int_W:
            raise ValueError("Length and width required for rectangular tank")

        int_L = input_data.int_L
        int_W = input_data.int_W

        # Areas
        base_area = int_L * int_W
        wall_circum = 2 * (int_L + int_W)

        # External dimensions
        ext_L = int_L + 2 * input_data.wall_thick
        ext_W = int_W + 2 * input_data.wall_thick
        ext_area = ext_L * ext_W

    # Excavation volume
    total_depth = (
        input_data.veg_soil
        + input_data.working_space
        + input_data.blinding_thick
        + input_data.bed_thick
        + input_data.depth_int
        + input_data.cover_to_slab
    )

    excav_volume = (
        ext_area * total_depth
        if input_data.tank_type == "rectangular"
        else (math.pi * (ext_radius**2) * total_depth)
    )

    # Concrete volumes
    base_slab_vol = base_area * input_data.bed_thick
    wall_vol = wall_circum * input_data.depth_int * input_data.wall_thick
    top_slab_vol = base_area * input_data.slab_thick

    # Blinding area
    blinding_area = (
        ext_area if input_data.tank_type == "rectangular" else (math.pi * ext_radius**2)
    )

    # Plaster and mastic areas
    int_wall_area = wall_circum * input_data.depth_int
    plaster_area = int_wall_area + base_area  # walls + ceiling
    mastic_area = int_wall_area + ext_area  # external walls + base

    # Formwork area
    formwork_area = wall_circum * input_data.depth_int + base_area + base_area

    # Backfill volume
    backfill_vol = excav_volume - (base_slab_vol + wall_vol + top_slab_vol)

    return {
        "topsoil_m3": blinding_area * input_data.veg_soil,
        "excavation_m3": excav_volume,
        "blinding_m2": blinding_area,
        "bed_m3": base_slab_vol,
        "walls_m3": wall_vol,
        "slab_m3": top_slab_vol,
        "plaster_m2": plaster_area,
        "mastic_m2": mastic_area,
        "formwork_m2": formwork_area,
        "backfill_m3": backfill_vol,
    }


def generate_boq_items(
    input_data: UndergroundTankInput, summary: Dict[str, float]
) -> List[BOQItem]:
    """Generate Bill of Quantities items"""

    items = []

    # Earthworks Section
    items.append(
        BOQItem(
            item_no="1.0",
            description="SITE CLEARANCE AND EARTHWORKS",
            unit="",
            quantity="",
            rate="",
            amount="",
        )
    )

    items.append(
        BOQItem(
            item_no="1.1",
            description=f"Clear site vegetation, grub up roots and remove topsoil average {int(input_data.veg_soil*1000)}mm deep for preservation",
            unit="m³",
            quantity=f"{summary['topsoil_m3']:.2f}",
            rate="180.00",
            amount=f"{summary['topsoil_m3'] * 180:.2f}",
        )
    )

    excav_soft = summary["excavation_m3"] * 0.85
    excav_rock = summary["excavation_m3"] * 0.15

    items.append(
        BOQItem(
            item_no="1.2",
            description="Excavate in soft soil to receive underground water tank including trimming sides and bottoms",
            unit="m³",
            quantity=f"{excav_soft:.2f}",
            rate="420.00",
            amount=f"{excav_soft * 420:.2f}",
        )
    )

    items.append(
        BOQItem(
            item_no="1.3",
            description="Excavate in rock to reduced level by mechanical means",
            unit="m³",
            quantity=f"{excav_rock:.2f}",
            rate="850.00",
            amount=f"{excav_rock * 850:.2f}",
        )
    )

    disposal = summary["excavation_m3"] * 0.55
    items.append(
        BOQItem(
            item_no="1.4",
            description="Dispose excavated material off-site at approved disposal area within 5km radius",
            unit="m³",
            quantity=f"{disposal:.2f}",
            rate="320.00",
            amount=f"{disposal * 320:.2f}",
        )
    )

    items.append(
        BOQItem(item_no="", description="", unit="", quantity="", rate="", amount="")
    )

    # Concrete Work Section
    items.append(
        BOQItem(
            item_no="2.0",
            description="CONCRETE WORK",
            unit="",
            quantity="",
            rate="",
            amount="",
        )
    )

    items.append(
        BOQItem(
            item_no="2.1",
            description=f"{int(input_data.blinding_thick*1000)}mm thick mass concrete (1:4:8) blinding to bottom of excavation",
            unit="m²",
            quantity=f"{summary['blinding_m2']:.2f}",
            rate="650.00",
            amount=f"{summary['blinding_m2'] * 650:.2f}",
        )
    )

    items.append(
        BOQItem(
            item_no="2.2",
            description=f"{int(input_data.bed_thick*1000)}mm thick reinforced concrete (1:2:4) base slab including trowel finish",
            unit="m³",
            quantity=f"{summary['bed_m3']:.2f}",
            rate="12500.00",
            amount=f"{summary['bed_m3'] * 12500:.2f}",
        )
    )

    items.append(
        BOQItem(
            item_no="2.3",
            description=f"{int(input_data.wall_thick*1000)}mm thick reinforced concrete (1:2:4) walls to tank",
            unit="m³",
            quantity=f"{summary['walls_m3']:.2f}",
            rate="13500.00",
            amount=f"{summary['walls_m3'] * 13500:.2f}",
        )
    )

    items.append(
        BOQItem(
            item_no="2.4",
            description=f"{int(input_data.slab_thick*1000)}mm thick reinforced concrete (1:2:4) top slab including access opening",
            unit="m³",
            quantity=f"{summary['slab_m3']:.2f}",
            rate="12500.00",
            amount=f"{summary['slab_m3'] * 12500:.2f}",
        )
    )

    items.append(
        BOQItem(item_no="", description="", unit="", quantity="", rate="", amount="")
    )

    # Reinforcement Section
    items.append(
        BOQItem(
            item_no="3.0",
            description="REINFORCEMENT",
            unit="",
            quantity="",
            rate="",
            amount="",
        )
    )

    total_conc = summary["bed_m3"] + summary["walls_m3"] + summary["slab_m3"]
    reinf_kg = total_conc * 120

    items.append(
        BOQItem(
            item_no="3.1",
            description="High tensile steel reinforcement bars to BS 4449 including cutting, bending, lapping and tying",
            unit="kg",
            quantity=f"{reinf_kg:.2f}",
            rate="185.00",
            amount=f"{reinf_kg * 185:.2f}",
        )
    )

    brc_area = (
        summary["bed_m3"] / input_data.bed_thick
        + summary["slab_m3"] / input_data.slab_thick
    )
    items.append(
        BOQItem(
            item_no="3.2",
            description="BRC fabric reinforcement A142 (2.22kg/m²) to slabs",
            unit="m²",
            quantity=f"{brc_area:.2f}",
            rate="450.00",
            amount=f"{brc_area * 450:.2f}",
        )
    )

    items.append(
        BOQItem(item_no="", description="", unit="", quantity="", rate="", amount="")
    )

    # Formwork Section
    items.append(
        BOQItem(
            item_no="4.0",
            description="FORMWORK",
            unit="",
            quantity="",
            rate="",
            amount="",
        )
    )

    items.append(
        BOQItem(
            item_no="4.1",
            description="Formwork class F3 to sides of base slab",
            unit="m²",
            quantity=f"{summary['formwork_m2'] * 0.05:.2f}",
            rate="1200.00",
            amount=f"{summary['formwork_m2'] * 0.05 * 1200:.2f}",
        )
    )

    items.append(
        BOQItem(
            item_no="4.2",
            description="Formwork class F3 to walls (fair face finish)",
            unit="m²",
            quantity=f"{summary['formwork_m2'] * 0.66:.2f}",
            rate="1350.00",
            amount=f"{summary['formwork_m2'] * 0.66 * 1350:.2f}",
        )
    )

    items.append(
        BOQItem(
            item_no="4.3",
            description="Formwork class F3 to top slab soffit",
            unit="m²",
            quantity=f"{summary['formwork_m2'] * 0.29:.2f}",
            rate="1200.00",
            amount=f"{summary['formwork_m2'] * 0.29 * 1200:.2f}",
        )
    )

    items.append(
        BOQItem(item_no="", description="", unit="", quantity="", rate="", amount="")
    )

    # Waterproofing Section
    items.append(
        BOQItem(
            item_no="5.0",
            description="WATERPROOFING AND FINISHES",
            unit="",
            quantity="",
            rate="",
            amount="",
        )
    )

    items.append(
        BOQItem(
            item_no="5.1",
            description=f"{int(input_data.plaster_thick*1000)}mm thick cement sand plaster (1:4) to internal walls and ceiling",
            unit="m²",
            quantity=f"{summary['plaster_m2']:.2f}",
            rate="650.00",
            amount=f"{summary['plaster_m2'] * 650:.2f}",
        )
    )

    items.append(
        BOQItem(
            item_no="5.2",
            description=f"{int(input_data.mastic_thick*1000)}mm thick mastic asphalt tanking in two coats to external walls",
            unit="m²",
            quantity=f"{summary['mastic_m2']:.2f}",
            rate="1850.00",
            amount=f"{summary['mastic_m2'] * 1850:.2f}",
        )
    )

    paint_area = summary["plaster_m2"]
    items.append(
        BOQItem(
            item_no="5.3",
            description="Bituminous paint (2 coats) to internal surfaces",
            unit="m²",
            quantity=f"{paint_area:.2f}",
            rate="380.00",
            amount=f"{paint_area * 380:.2f}",
        )
    )

    items.append(
        BOQItem(item_no="", description="", unit="", quantity="", rate="", amount="")
    )

    # Backfilling Section
    items.append(
        BOQItem(
            item_no="6.0",
            description="BACKFILLING",
            unit="",
            quantity="",
            rate="",
            amount="",
        )
    )

    items.append(
        BOQItem(
            item_no="6.1",
            description="Selected backfill material around tank in 150mm layers with compaction",
            unit="m³",
            quantity=f"{summary['backfill_m3']:.2f}",
            rate="580.00",
            amount=f"{summary['backfill_m3'] * 580:.2f}",
        )
    )

    items.append(
        BOQItem(
            item_no="6.2",
            description="Reinstate topsoil over completed works",
            unit="m³",
            quantity=f"{summary['topsoil_m3']:.2f}",
            rate="220.00",
            amount=f"{summary['topsoil_m3'] * 220:.2f}",
        )
    )

    items.append(
        BOQItem(item_no="", description="", unit="", quantity="", rate="", amount="")
    )

    # Manholes Section
    items.append(
        BOQItem(
            item_no="7.0",
            description="MANHOLES AND COVERS",
            unit="",
            quantity="",
            rate="",
            amount="",
        )
    )

    items.append(
        BOQItem(
            item_no="7.1",
            description=f"Precast concrete manhole cover and frame ({int(input_data.cover_L*1000)}x{int(input_data.cover_W*1000)}mm) grade A",
            unit="no.",
            quantity=f"{input_data.num_covers}",
            rate="8500.00",
            amount=f"{input_data.num_covers * 8500:.2f}",
        )
    )

    num_steps = int(input_data.depth_int / 0.3)
    items.append(
        BOQItem(
            item_no="7.2",
            description="Step irons built into wall at 300mm vertical spacing",
            unit="no.",
            quantity=f"{num_steps}",
            rate="850.00",
            amount=f"{num_steps * 850:.2f}",
        )
    )

    return items


# ============================================================================
# API ENDPOINTS
# ============================================================================


@router.post(
    "/calculate", response_model=UndergroundTankResponse, tags=["Underground Tank"]
)
async def calculate_underground_tank(
    data: UndergroundTankInput,
) -> UndergroundTankResponse:
    """
    Calculate Bill of Quantities for underground water tank

    Parameters:
    - tank_type: "circular" or "rectangular"
    - For circular: int_diam (internal diameter in meters)
    - For rectangular: int_L and int_W (length and width in meters)
    - depth_int: internal depth in meters
    - All thickness values in meters

    Returns:
    - summary: Dictionary of calculated quantities
    - items: List of BOQ items with descriptions, quantities, rates, and amounts
    - total_amount: Total cost in KES
    """
    try:
        # Calculate quantities
        summary = calculate_quantities(data)

        # Generate BOQ items
        items = generate_boq_items(data, summary)

        # Calculate total amount
        total_amount = sum(
            float(item.amount) for item in items if item.amount and item.amount != ""
        )

        return UndergroundTankResponse(
            summary=summary, items=items, total_amount=total_amount
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.get(
    "/example", response_model=UndergroundTankResponse, tags=["Underground Tank"]
)
async def get_example() -> UndergroundTankResponse:
    """Get example calculation for underground tank"""

    example_input = UndergroundTankInput(
        tank_type="circular", int_diam=3.0, depth_int=2.5, num_covers=1
    )

    summary = calculate_quantities(example_input)
    items = generate_boq_items(example_input, summary)
    total_amount = sum(
        float(item.amount) for item in items if item.amount and item.amount != ""
    )

    return UndergroundTankResponse(
        summary=summary, items=items, total_amount=total_amount
    )
