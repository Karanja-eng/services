# main.py
from fastapi import FastAPI, HTTPException,APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import math

router = APIRouter()
# Pydantic Models
class RoomInput(BaseModel):
    length: float = Field(..., gt=0, description="Room length in meters")
    width: float = Field(..., gt=0, description="Room width in meters")
    height: float = Field(..., gt=0, description="Room height in meters")
    doors: int = Field(default=1, ge=0, description="Number of doors")
    door_height: float = Field(default=2.1, gt=0, description="Door height in meters")
    door_width: float = Field(default=0.9, gt=0, description="Door width in meters")
    windows: int = Field(default=0, ge=0, description="Number of windows")
    window_height: float = Field(default=1.2, gt=0, description="Window height in meters")
    window_width: float = Field(default=1.5, gt=0, description="Window width in meters")


class MaterialSpecs(BaseModel):
    plaster_thickness: float = Field(default=15.0, gt=0, description="Plaster thickness in mm")
    screed_thickness: float = Field(default=25.0, gt=0, description="Screed thickness in mm")
    tile_size: float = Field(default=300.0, gt=0, description="Tile size in mm")
    skirting_height: float = Field(default=100.0, gt=0, description="Skirting height in mm")
    paint_coats: int = Field(default=3, gt=0, description="Number of paint coats")
    ceiling_finish: str = Field(default="gypsum", description="Ceiling finish type: gypsum or plaster")
    wall_tiling: str = Field(default="partial", description="Wall tiling: none, partial, or full")


class CalculationRequest(BaseModel):
    rooms: List[RoomInput]
    materials: MaterialSpecs


class BOQItem(BaseModel):
    item_no: str
    description: str
    unit: str
    quantity: str
    rate: str
    amount: str


class SummaryData(BaseModel):
    total_floor_area: float
    total_wall_area: float
    total_ceiling_area: float
    total_perimeter: float
    total_door_area: float
    total_window_area: float


class DetailedQuantities(BaseModel):
    wall_plaster_m2: float
    ceiling_plaster_m2: float
    plaster_volume_m3: float
    screed_area_m2: float
    screed_volume_m3: float
    floor_tiles_count: int
    wall_tiles_count: int
    skirting_length_m: float
    paint_wall_m2: float
    paint_ceiling_m2: float
    paint_doors_m2: float
    paint_windows_m2: float
    total_paint_m2: float


class CalculationResponse(BaseModel):
    summary: SummaryData
    quantities: DetailedQuantities
    items: List[BOQItem]


# Core Calculation Functions
def calculate_room_areas(room: RoomInput) -> dict:
    """Calculate all areas for a single room"""
    floor_area = room.length * room.width
    ceiling_area = floor_area
    wall_gross_area = 2 * (room.length + room.width) * room.height
    door_area = room.doors * room.door_height * room.door_width
    window_area = room.windows * room.window_height * room.window_width
    wall_net_area = wall_gross_area - door_area - window_area
    perimeter = 2 * (room.length + room.width)
    
    return {
        'floor': floor_area,
        'ceiling': ceiling_area,
        'wall_gross': wall_gross_area,
        'wall_net': wall_net_area,
        'door': door_area,
        'window': window_area,
        'perimeter': perimeter
    }


def calculate_materials(total_areas: dict, materials: MaterialSpecs) -> DetailedQuantities:
    """Calculate all material quantities"""
    # Convert mm to meters
    plaster_thick_m = materials.plaster_thickness / 1000
    screed_thick_m = materials.screed_thickness / 1000
    tile_size_m = materials.tile_size / 1000
    skirting_height_m = materials.skirting_height / 1000
    
    # Wall tiling factor
    wall_tiling_factors = {'none': 0.0, 'partial': 0.3, 'full': 1.0}
    wall_tiling_factor = wall_tiling_factors.get(materials.wall_tiling, 0.3)
    
    # Plaster calculations
    wall_plaster_area = total_areas['wall_net']
    ceiling_plaster_area = total_areas['ceiling'] if materials.ceiling_finish == 'plaster' else 0
    total_plaster_area = wall_plaster_area + ceiling_plaster_area
    plaster_volume = total_plaster_area * plaster_thick_m
    
    # Screed calculations
    screed_area = total_areas['floor']
    screed_volume = screed_area * screed_thick_m
    
    # Tile calculations
    tile_area_single = tile_size_m ** 2
    floor_tiles = math.ceil(total_areas['floor'] / tile_area_single)
    wall_tiles = math.ceil((total_areas['wall_net'] * wall_tiling_factor) / tile_area_single)
    
    # Skirting
    skirting_length = total_areas['perimeter']
    
    # Painting calculations
    paint_wall = total_areas['wall_net'] * materials.paint_coats
    paint_ceiling = total_areas['ceiling'] * materials.paint_coats
    paint_doors = total_areas['door'] * 2 * materials.paint_coats  # Both sides
    paint_windows = total_areas['window'] * materials.paint_coats
    total_paint = paint_wall + paint_ceiling + paint_doors + paint_windows
    
    return DetailedQuantities(
        wall_plaster_m2=wall_plaster_area,
        ceiling_plaster_m2=ceiling_plaster_area,
        plaster_volume_m3=plaster_volume,
        screed_area_m2=screed_area,
        screed_volume_m3=screed_volume,
        floor_tiles_count=floor_tiles,
        wall_tiles_count=wall_tiles,
        skirting_length_m=skirting_length,
        paint_wall_m2=paint_wall,
        paint_ceiling_m2=paint_ceiling,
        paint_doors_m2=paint_doors,
        paint_windows_m2=paint_windows,
        total_paint_m2=total_paint
    )


def generate_boq_items(quantities: DetailedQuantities, materials: MaterialSpecs, 
                       total_areas: dict) -> List[BOQItem]:
    """Generate Bill of Quantities items with standard descriptions and rates"""
    
    items = []
    
    # WALL FINISHES SECTION
    items.append(BOQItem(
        item_no="1.0",
        description="WALL FINISHES",
        unit="",
        quantity="",
        rate="",
        amount=""
    ))
    
    items.append(BOQItem(
        item_no="1.1",
        description=f"Cement sand plaster (1:4) {materials.plaster_thickness:.0f}mm thick to internal walls including finishing with steel trowel",
        unit="m²",
        quantity=f"{quantities.wall_plaster_m2:.2f}",
        rate="450.00",
        amount=f"{quantities.wall_plaster_m2 * 450:.2f}"
    ))
    
    if quantities.wall_tiles_count > 0:
        wall_tile_desc = "to bathroom/kitchen areas" if materials.wall_tiling == "partial" else "full height"
        items.append(BOQItem(
            item_no="1.2",
            description=f"{materials.tile_size:.0f}x{materials.tile_size:.0f}mm ceramic wall tiles {wall_tile_desc} including adhesive and grouting",
            unit="no.",
            quantity=f"{quantities.wall_tiles_count}",
            rate="85.00",
            amount=f"{quantities.wall_tiles_count * 85:.2f}"
        ))
    
    items.append(BOQItem(
        item_no="1.3",
        description=f"Emulsion paint ({materials.paint_coats} coats) to internal plastered walls including primer",
        unit="m²",
        quantity=f"{quantities.paint_wall_m2:.2f}",
        rate="180.00",
        amount=f"{quantities.paint_wall_m2 * 180:.2f}"
    ))
    
    # Empty row
    items.append(BOQItem(item_no="", description="", unit="", quantity="", rate="", amount=""))
    
    # CEILING FINISHES SECTION
    items.append(BOQItem(
        item_no="2.0",
        description="CEILING FINISHES",
        unit="",
        quantity="",
        rate="",
        amount=""
    ))
    
    if materials.ceiling_finish == "gypsum":
        items.append(BOQItem(
            item_no="2.1",
            description="12.5mm gypsum board ceiling on galvanized steel framework at 600mm centers including joints treatment and screws",
            unit="m²",
            quantity=f"{total_areas['ceiling']:.2f}",
            rate="1200.00",
            amount=f"{total_areas['ceiling'] * 1200:.2f}"
        ))
    else:
        items.append(BOQItem(
            item_no="2.1",
            description=f"Cement sand plaster (1:4) {materials.plaster_thickness:.0f}mm thick to ceiling including finishing with steel trowel",
            unit="m²",
            quantity=f"{quantities.ceiling_plaster_m2:.2f}",
            rate="450.00",
            amount=f"{quantities.ceiling_plaster_m2 * 450:.2f}"
        ))
    
    items.append(BOQItem(
        item_no="2.2",
        description=f"Emulsion paint ({materials.paint_coats} coats) to ceiling including primer",
        unit="m²",
        quantity=f"{quantities.paint_ceiling_m2:.2f}",
        rate="180.00",
        amount=f"{quantities.paint_ceiling_m2 * 180:.2f}"
    ))
    
    # Empty row
    items.append(BOQItem(item_no="", description="", unit="", quantity="", rate="", amount=""))
    
    # FLOOR FINISHES SECTION
    items.append(BOQItem(
        item_no="3.0",
        description="FLOOR FINISHES",
        unit="",
        quantity="",
        rate="",
        amount=""
    ))
    
    items.append(BOQItem(
        item_no="3.1",
        description=f"Cement sand screed (1:3) {materials.screed_thickness:.0f}mm thick to floors including steel trowel finish",
        unit="m²",
        quantity=f"{quantities.screed_area_m2:.2f}",
        rate="350.00",
        amount=f"{quantities.screed_area_m2 * 350:.2f}"
    ))
    
    items.append(BOQItem(
        item_no="3.2",
        description=f"{materials.tile_size:.0f}x{materials.tile_size:.0f}mm vitrified ceramic floor tiles including adhesive and grouting",
        unit="no.",
        quantity=f"{quantities.floor_tiles_count}",
        rate="95.00",
        amount=f"{quantities.floor_tiles_count * 95:.2f}"
    ))
    
    items.append(BOQItem(
        item_no="3.3",
        description=f"{materials.skirting_height:.0f}mm high timber/PVC skirting board fixed with adhesive",
        unit="m",
        quantity=f"{quantities.skirting_length_m:.2f}",
        rate="280.00",
        amount=f"{quantities.skirting_length_m * 280:.2f}"
    ))
    
    # Empty row
    items.append(BOQItem(item_no="", description="", unit="", quantity="", rate="", amount=""))
    
    # DOORS AND WINDOWS SECTION
    items.append(BOQItem(
        item_no="4.0",
        description="DOORS AND WINDOWS",
        unit="",
        quantity="",
        rate="",
        amount=""
    ))
    
    if quantities.paint_doors_m2 > 0:
        items.append(BOQItem(
            item_no="4.1",
            description=f"Oil paint ({materials.paint_coats} coats) to doors both sides including primer and undercoat",
            unit="m²",
            quantity=f"{quantities.paint_doors_m2:.2f}",
            rate="220.00",
            amount=f"{quantities.paint_doors_m2 * 220:.2f}"
        ))
    
    if quantities.paint_windows_m2 > 0:
        items.append(BOQItem(
            item_no="4.2",
            description=f"Oil paint ({materials.paint_coats} coats) to window frames including primer and undercoat",
            unit="m²",
            quantity=f"{quantities.paint_windows_m2:.2f}",
            rate="220.00",
            amount=f"{quantities.paint_windows_m2 * 220:.2f}"
        ))
    
    # Empty row
    items.append(BOQItem(item_no="", description="", unit="", quantity="", rate="", amount=""))
    
    # ADDITIONAL ITEMS
    items.append(BOQItem(
        item_no="5.0",
        description="MISCELLANEOUS",
        unit="",
        quantity="",
        rate="",
        amount=""
    ))
    
    items.append(BOQItem(
        item_no="5.1",
        description="Silicon sealant to joints between walls and sanitary fittings",
        unit="m",
        quantity=f"{total_areas['perimeter'] * 0.1:.2f}",
        rate="150.00",
        amount=f"{total_areas['perimeter'] * 0.1 * 150:.2f}"
    ))
    
    items.append(BOQItem(
        item_no="5.2",
        description="Architraves around door openings (100mm wide)",
        unit="m",
        quantity=f"{(total_areas['door'] / 2.1) * 5.5:.2f}",  # Approx perimeter per door
        rate="200.00",
        amount=f"{(total_areas['door'] / 2.1) * 5.5 * 200:.2f}"
    ))
    
    return items


@router.get("/")
async def root():
    return {
        "message": "Internal Finishes Takeoff API",
        "version": "1.0.0",
        "endpoints": {
            "calculate": "/api/calculate",
            "health": "/api/health"
        }
    }


@router.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "API is running"}


@router.post("/api/calculate", response_model=CalculationResponse)
async def calculate_quantities(request: CalculationRequest):
    """
    Calculate internal finishes quantities from room dimensions and material specifications.
    Returns a complete Bill of Quantities with itemized costs.
    """
    try:
        # Validate input
        if not request.rooms:
            raise HTTPException(status_code=400, detail="At least one room is required")
        
        # Initialize totals
        total_floor = 0.0
        total_wall_net = 0.0
        total_ceiling = 0.0
        total_perimeter = 0.0
        total_door = 0.0
        total_window = 0.0
        
        # Process each room
        for room in request.rooms:
            areas = calculate_room_areas(room)
            total_floor += areas['floor']
            total_wall_net += areas['wall_net']
            total_ceiling += areas['ceiling']
            total_perimeter += areas['perimeter']
            total_door += areas['door']
            total_window += areas['window']
        
        # Aggregate totals
        total_areas = {
            'floor': total_floor,
            'wall_net': total_wall_net,
            'ceiling': total_ceiling,
            'perimeter': total_perimeter,
            'door': total_door,
            'window': total_window
        }
        
        # Calculate material quantities
        quantities = calculate_materials(total_areas, request.materials)
        
        # Generate BOQ items
        boq_items = generate_boq_items(quantities, request.materials, total_areas)
        
        # Create summary
        summary = SummaryData(
            total_floor_area=total_floor,
            total_wall_area=total_wall_net,
            total_ceiling_area=total_ceiling,
            total_perimeter=total_perimeter,
            total_door_area=total_door,
            total_window_area=total_window
        )
        
        return CalculationResponse(
            summary=summary,
            quantities=quantities,
            items=boq_items
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/api/calculate/detailed")
async def calculate_detailed(request: CalculationRequest):
    """
    Returns detailed breakdown of calculations for each room.
    Useful for debugging and detailed analysis.
    """
    try:
        room_details = []
        
        for idx, room in enumerate(request.rooms, 1):
            areas = calculate_room_areas(room)
            room_details.append({
                'room_number': idx,
                'dimensions': {
                    'length': room.length,
                    'width': room.width,
                    'height': room.height
                },
                'areas': areas,
                'openings': {
                    'doors': room.doors,
                    'windows': room.windows,
                    'door_area': areas['door'],
                    'window_area': areas['window']
                }
            })
        
        return {
            'rooms': room_details,
            'materials': request.materials.dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


