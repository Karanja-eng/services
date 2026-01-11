# external_works_api.py
"""
Professional External Works Quantity Takeoff API
Based on CESMM4 Standards
Handles all external work calculations including demolition, earthworks, roads, drainage, and landscaping
"""

from fastapi import FastAPI, HTTPException,APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import math
from datetime import datetime

router = APIRouter()
# ======================= MODELS =======================

class ProjectInfo(BaseModel):
    project_name: str
    location: str
    drawing_number: str
    date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    taken_by: Optional[str] = ""
    checked_by: Optional[str] = ""
    scale: str = "1:100"

class SiteData(BaseModel):
    """Site dimensions and basic information"""
    site_length: float = Field(..., gt=0, description="Site length in meters")
    site_width: float = Field(..., gt=0, description="Site width in meters")
    
class DemolitionData(BaseModel):
    """Demolition and site clearance quantities (Class D - CESMM)"""
    house_length: float = 0
    house_width: float = 0
    building_demolition_volume: float = 0
    trees_small: int = 0  # Girth 0.5-2m
    trees_large: int = 0  # Girth >2m
    stumps: int = 0  # <1m diameter
    pipeline_removal_length: float = 0
    pipeline_diameter: int = 225  # mm
    vegetable_soil_depth: float = 0.15

class RoadConfiguration(BaseModel):
    """Road and pavement configuration"""
    road_length: float = Field(..., gt=0)
    road_width: float = Field(..., gt=0)
    road_type: str = "bitumen"  # bitumen, cabro, concrete
    
    driveway_length: float = Field(..., gt=0)
    driveway_width: float = Field(..., gt=0)
    driveway_type: str = "bitumen"
    
    parking_length: float = Field(..., gt=0)
    parking_width: float = Field(..., gt=0)
    parking_type: str = "cabro"
    
    bellmouth_radius_1: float = Field(..., gt=0)
    bellmouth_radius_2: float = Field(..., gt=0)

class PavementLayers(BaseModel):
    """Pavement layer thicknesses (Class R - CESMM)"""
    bitumen_thickness: float = 0.05
    bitumen_macadam_base: float = 0.15
    murram_depth: float = 0.20
    hardcore_thickness: float = 0.20
    sand_bed_thickness: float = 0.15
    excavation_depth_after_veg: float = 0.50
    backing_allowance: float = 0.10
    concrete_backing_thickness: float = 0.10

class KerbsChannels(BaseModel):
    """Kerbs and channels configuration"""
    kerb_type: str = "pcc"  # pcc, precast
    kerb_straight_length: float = 0
    kerb_curved_length: float = 0
    channel_straight_length: float = 0
    channel_curved_length: float = 0
    
class DrainageData(BaseModel):
    """Drainage components"""
    invert_block_count: int = 0
    invert_block_size: float = 0.35  # m
    pcc_slab_length: float = 0
    pcc_slab_width: float = 0.50
    pcc_slab_thickness: float = 0.05
    drainage_channel_length: float = 0

class LandscapingData(BaseModel):
    """Landscaping and planting (Class E - CESMM)"""
    grass_seeding_area: float = 0
    imported_topsoil_thickness: float = 0.15
    mahogany_trees: int = 0  # 1m high
    ornamental_trees: int = 0  # 10m c/c
    euphorbia_hedge_length: float = 0  # 0.5m high

class FencingData(BaseModel):
    """Fencing and gates (Class X - CESMM)"""
    timber_post_wire_fence: float = 0  # 2100mm high
    fence_type_1_length: float = 0  # 2-2.5m height
    fence_type_2_length: float = 0  # 1.5-2m height
    metal_gates: int = 0  # >5m span
    normal_gates: int = 0

class TakeoffInput(BaseModel):
    """Complete takeoff input data"""
    project_info: ProjectInfo
    site_data: SiteData
    demolition: DemolitionData
    road_config: RoadConfiguration
    pavement_layers: PavementLayers
    kerbs_channels: KerbsChannels
    drainage: DrainageData
    landscaping: LandscapingData
    fencing: FencingData

class TakeoffItem(BaseModel):
    """Single takeoff item in English Method format"""
    bill_no: str
    item_no: str
    description: str
    dimensions: List[Dict]
    quantity: float
    unit: str
    rate: Optional[float] = None
    amount: Optional[float] = None
    is_header: bool = False

class TakeoffOutput(BaseModel):
    """Complete takeoff output"""
    project_info: ProjectInfo
    items: List[TakeoffItem]
    summary: Dict[str, float]
    totals: Dict[str, float]

# ======================= CALCULATIONS =======================

def calculate_site_clearance(site_data: SiteData, demolition: DemolitionData) -> Dict:
    """Calculate site clearance area and vegetable soil"""
    total_area = site_data.site_length * site_data.site_width
    house_area = demolition.house_length * demolition.house_width
    clear_area = total_area - house_area
    veg_soil_volume = clear_area * demolition.vegetable_soil_depth
    
    return {
        'clear_area_m2': round(clear_area, 2),
        'veg_soil_volume_m3': round(veg_soil_volume, 2),
        'house_area_m2': round(house_area, 2)
    }

def calculate_bellmouth_area(r1: float, r2: float) -> float:
    """Calculate bellmouth area using sector approximation"""
    # Bellmouth is approximately 3/14 of circle area for quarter circle
    area_1 = (3/14) * math.pi * (r1 ** 2)
    area_2 = (3/14) * math.pi * (r2 ** 2)
    return area_1 + area_2

def calculate_excavation(road_config: RoadConfiguration, pavement: PavementLayers) -> Dict:
    """Calculate excavation volumes (Class E - CESMM)"""
    backing = pavement.backing_allowance
    depth = pavement.excavation_depth_after_veg
    
    # Road area
    road_length_adj = road_config.road_length + (2 * backing)
    road_width_adj = road_config.road_width + (2 * backing)
    road_area = road_length_adj * road_width_adj
    road_volume = road_area * depth
    
    # Parking area
    park_length_adj = road_config.parking_length + (2 * backing)
    park_width_adj = road_config.parking_width + (2 * backing)
    park_area = park_length_adj * park_width_adj
    park_volume = park_area * depth
    
    # Driveway area
    drive_length_adj = road_config.driveway_length + (2 * backing)
    drive_width_adj = road_config.driveway_width + (2 * backing)
    drive_area = drive_length_adj * drive_width_adj
    drive_volume = drive_area * depth
    
    # Bellmouth area
    bell_area = calculate_bellmouth_area(
        road_config.bellmouth_radius_1,
        road_config.bellmouth_radius_2
    )
    bell_volume = bell_area * depth
    
    total_area = road_area + park_area + drive_area + bell_area
    total_volume = road_volume + park_volume + drive_volume + bell_volume
    
    return {
        'road_area_m2': round(road_area, 2),
        'road_volume_m3': round(road_volume, 2),
        'parking_area_m2': round(park_area, 2),
        'parking_volume_m3': round(park_volume, 2),
        'driveway_area_m2': round(drive_area, 2),
        'driveway_volume_m3': round(drive_volume, 2),
        'bellmouth_area_m2': round(bell_area, 2),
        'bellmouth_volume_m3': round(bell_volume, 2),
        'total_excavation_area_m2': round(total_area, 2),
        'total_excavation_volume_m3': round(total_volume, 2)
    }

def calculate_filling(excavation_data: Dict, pavement: PavementLayers) -> Dict:
    """Calculate filling volumes for murram, hardcore, etc."""
    total_area = excavation_data['total_excavation_area_m2']
    
    murram_volume = total_area * pavement.murram_depth
    hardcore_volume = total_area * pavement.hardcore_thickness
    sand_bed_volume = total_area * pavement.sand_bed_thickness
    
    return {
        'murram_filling_m3': round(murram_volume, 2),
        'hardcore_filling_m3': round(hardcore_volume, 2),
        'hardcore_area_m2': round(total_area, 2),
        'sand_bed_m3': round(sand_bed_volume, 2)
    }

def calculate_pavement_layers(excavation_data: Dict, pavement: PavementLayers, 
                              road_config: RoadConfiguration) -> Dict:
    """Calculate pavement layer volumes (Class R - CESMM)"""
    # Use actual road width (without backing for surface layers)
    road_area = road_config.road_length * road_config.road_width
    drive_area = road_config.driveway_length * road_config.driveway_width
    park_area = road_config.parking_length * road_config.parking_width
    bell_area = calculate_bellmouth_area(
        road_config.bellmouth_radius_1,
        road_config.bellmouth_radius_2
    )
    
    total_paved_area = road_area + drive_area + park_area + bell_area
    
    bitumen_volume = total_paved_area * pavement.bitumen_thickness
    base_course_volume = total_paved_area * pavement.bitumen_macadam_base
    
    return {
        'total_paved_area_m2': round(total_paved_area, 2),
        'bitumen_premix_m2': round(total_paved_area, 2),
        'bitumen_premix_m3': round(bitumen_volume, 3),
        'bitumen_macadam_base_m2': round(total_paved_area, 2),
        'bitumen_macadam_base_m3': round(base_course_volume, 3)
    }

def calculate_kerbs_channels(kerbs: KerbsChannels, road_config: RoadConfiguration, 
                             pavement: PavementLayers) -> Dict:
    """Calculate kerb and channel quantities"""
    # If not provided, calculate from road dimensions
    if kerbs.kerb_straight_length == 0:
        kerbs.kerb_straight_length = 2 * road_config.road_length
    
    if kerbs.channel_straight_length == 0:
        kerbs.channel_straight_length = 2 * road_config.road_length
    
    # Calculate curved lengths from bellmouth
    if kerbs.kerb_curved_length == 0:
        kerbs.kerb_curved_length = (math.pi * 
            (road_config.bellmouth_radius_1 + road_config.bellmouth_radius_2)) / 4
    
    # Calculate concrete backing volume
    total_kerb_length = kerbs.kerb_straight_length + kerbs.kerb_curved_length
    backing_width = 0.20  # Standard 200mm backing
    backing_volume = (total_kerb_length * backing_width * 
                     pavement.concrete_backing_thickness)
    
    return {
        'kerb_straight_m': round(kerbs.kerb_straight_length, 2),
        'kerb_curved_m': round(kerbs.kerb_curved_length, 2),
        'channel_straight_m': round(kerbs.channel_straight_length, 2),
        'channel_curved_m': round(kerbs.channel_curved_length, 2),
        'concrete_backing_m3': round(backing_volume, 3),
        'total_kerb_length_m': round(total_kerb_length, 2)
    }

def calculate_drainage(drainage: DrainageData) -> Dict:
    """Calculate drainage component quantities"""
    invert_block_volume = (drainage.invert_block_count * 
                          (drainage.invert_block_size ** 3))
    
    pcc_slab_area = drainage.pcc_slab_length * drainage.pcc_slab_width
    pcc_slab_volume = pcc_slab_area * drainage.pcc_slab_thickness
    
    return {
        'invert_blocks_no': drainage.invert_block_count,
        'invert_block_volume_m3': round(invert_block_volume, 3),
        'pcc_slab_area_m2': round(pcc_slab_area, 2),
        'pcc_slab_volume_m3': round(pcc_slab_volume, 3),
        'drainage_channel_m': drainage.drainage_channel_length
    }

def calculate_landscaping(landscaping: LandscapingData, site_data: SiteData,
                         road_config: RoadConfiguration) -> Dict:
    """Calculate landscaping quantities (Class E - CESMM)"""
    # If grass area not provided, estimate
    if landscaping.grass_seeding_area == 0:
        total_site = site_data.site_length * site_data.site_width
        paved_area = ((road_config.road_length * road_config.road_width) +
                     (road_config.parking_length * road_config.parking_width) +
                     (road_config.driveway_length * road_config.driveway_width))
        landscaping.grass_seeding_area = max(0, total_site - paved_area - 100)
    
    topsoil_volume = (landscaping.grass_seeding_area * 
                     landscaping.imported_topsoil_thickness)
    
    return {
        'grass_seeding_m2': round(landscaping.grass_seeding_area, 2),
        'imported_topsoil_m3': round(topsoil_volume, 2),
        'mahogany_trees_no': landscaping.mahogany_trees,
        'ornamental_trees_no': landscaping.ornamental_trees,
        'euphorbia_hedge_m': round(landscaping.euphorbia_hedge_length, 2)
    }

def generate_takeoff_items(input_data: TakeoffInput, calculations: Dict) -> List[TakeoffItem]:
    """Generate takeoff items in English Method format"""
    items = []
    
    # CLASS D: DEMOLITION & SITE CLEARANCE
    items.append(TakeoffItem(
        bill_no="A",
        item_no="1",
        description="DEMOLITION & SITE CLEARANCE (Class D - CESMM4)",
        dimensions=[],
        quantity=0,
        unit="",
        is_header=True
    ))
    
    # Site clearance
    items.append(TakeoffItem(
        bill_no="A",
        item_no="1.1",
        description="Site clearance, general",
        dimensions=[
            {
                "number": "1",
                "length": f"{input_data.site_data.site_length:.2f}",
                "width": f"{input_data.site_data.site_width:.2f}",
                "height": "",
                "deduction": False
            },
            {
                "number": "1",
                "length": f"{input_data.demolition.house_length:.2f}",
                "width": f"{input_data.demolition.house_width:.2f}",
                "height": "",
                "deduction": True
            }
        ],
        quantity=calculations['clearance']['clear_area_m2'],
        unit="m²",
        rate=150.00,
        amount=calculations['clearance']['clear_area_m2'] * 150.00
    ))
    
    # Trees
    if input_data.demolition.trees_small > 0:
        items.append(TakeoffItem(
            bill_no="A",
            item_no="1.2",
            description="Remove trees, girth 0.5-2m",
            dimensions=[{
                "number": str(input_data.demolition.trees_small),
                "length": "",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=float(input_data.demolition.trees_small),
            unit="no",
            rate=5000.00,
            amount=input_data.demolition.trees_small * 5000.00
        ))
    
    if input_data.demolition.trees_large > 0:
        items.append(TakeoffItem(
            bill_no="A",
            item_no="1.3",
            description="Remove trees, girth >2m",
            dimensions=[{
                "number": str(input_data.demolition.trees_large),
                "length": "",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=float(input_data.demolition.trees_large),
            unit="no",
            rate=8000.00,
            amount=input_data.demolition.trees_large * 8000.00
        ))
    
    # Stumps
    if input_data.demolition.stumps > 0:
        items.append(TakeoffItem(
            bill_no="A",
            item_no="1.4",
            description="Remove stumps, diameter <1m",
            dimensions=[{
                "number": str(input_data.demolition.stumps),
                "length": "",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=float(input_data.demolition.stumps),
            unit="no",
            rate=3000.00,
            amount=input_data.demolition.stumps * 3000.00
        ))
    
    # Building demolition
    if input_data.demolition.building_demolition_volume > 0:
        items.append(TakeoffItem(
            bill_no="A",
            item_no="1.5",
            description="Demolish building, include disposal",
            dimensions=[{
                "number": "1",
                "length": f"{input_data.demolition.building_demolition_volume:.2f}",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=input_data.demolition.building_demolition_volume,
            unit="m³",
            rate=2500.00,
            amount=input_data.demolition.building_demolition_volume * 2500.00
        ))
    
    # Pipeline removal
    if input_data.demolition.pipeline_removal_length > 0:
        items.append(TakeoffItem(
            bill_no="A",
            item_no="1.6",
            description=f"Remove pipeline, {input_data.demolition.pipeline_diameter}mm diameter",
            dimensions=[{
                "number": "1",
                "length": f"{input_data.demolition.pipeline_removal_length:.2f}",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=input_data.demolition.pipeline_removal_length,
            unit="m",
            rate=1500.00,
            amount=input_data.demolition.pipeline_removal_length * 1500.00
        ))
    
    # CLASS E: EARTHWORKS
    items.append(TakeoffItem(
        bill_no="B",
        item_no="2",
        description="EARTHWORKS (Class E - CESMM4)",
        dimensions=[],
        quantity=0,
        unit="",
        is_header=True
    ))
    
    # Vegetable soil excavation
    items.append(TakeoffItem(
        bill_no="B",
        item_no="2.1",
        description=f"Excavate vegetable soil for preservation, average depth {input_data.demolition.vegetable_soil_depth*1000:.0f}mm",
        dimensions=[{
            "number": "1",
            "length": f"{input_data.site_data.site_length:.2f}",
            "width": f"{input_data.site_data.site_width:.2f}",
            "height": f"{input_data.demolition.vegetable_soil_depth:.2f}",
            "deduction": False
        }],
        quantity=calculations['clearance']['veg_soil_volume_m3'],
        unit="m³",
        rate=250.00,
        amount=calculations['clearance']['veg_soil_volume_m3'] * 250.00
    ))
    
    # Mass excavation
    items.append(TakeoffItem(
        bill_no="B",
        item_no="2.2",
        description=f"Mass excavation, maximum depth {input_data.pavement_layers.excavation_depth_after_veg*1000:.0f}mm",
        dimensions=[
            {
                "number": "1",
                "length": f"{input_data.road_config.road_length + 2*input_data.pavement_layers.backing_allowance:.2f}",
                "width": f"{input_data.road_config.road_width + 2*input_data.pavement_layers.backing_allowance:.2f}",
                "height": f"{input_data.pavement_layers.excavation_depth_after_veg:.2f}",
                "deduction": False,
                "note": "Road area"
            },
            {
                "number": "1",
                "length": f"{input_data.road_config.parking_length + 2*input_data.pavement_layers.backing_allowance:.2f}",
                "width": f"{input_data.road_config.parking_width + 2*input_data.pavement_layers.backing_allowance:.2f}",
                "height": f"{input_data.pavement_layers.excavation_depth_after_veg:.2f}",
                "deduction": False,
                "note": "Parking area"
            },
            {
                "number": "1",
                "length": f"{input_data.road_config.driveway_length + 2*input_data.pavement_layers.backing_allowance:.2f}",
                "width": f"{input_data.road_config.driveway_width + 2*input_data.pavement_layers.backing_allowance:.2f}",
                "height": f"{input_data.pavement_layers.excavation_depth_after_veg:.2f}",
                "deduction": False,
                "note": "Driveway"
            }
        ],
        quantity=calculations['excavation']['total_excavation_volume_m3'],
        unit="m³",
        rate=350.00,
        amount=calculations['excavation']['total_excavation_volume_m3'] * 350.00
    ))
    
    # Disposal
    total_disposal = (calculations['clearance']['veg_soil_volume_m3'] + 
                     calculations['excavation']['total_excavation_volume_m3'])
    items.append(TakeoffItem(
        bill_no="B",
        item_no="2.3",
        description="Disposal of excavated material, off-site",
        dimensions=[{
            "number": "1",
            "length": f"{total_disposal:.2f}",
            "width": "",
            "height": "",
            "deduction": False
        }],
        quantity=total_disposal,
        unit="m³",
        rate=200.00,
        amount=total_disposal * 200.00
    ))
    
    # Preparation of surfaces
    items.append(TakeoffItem(
        bill_no="B",
        item_no="2.4",
        description="Prepare and compact excavated surfaces",
        dimensions=[{
            "number": "1",
            "length": f"{calculations['excavation']['total_excavation_area_m2']:.2f}",
            "width": "",
            "height": "",
            "deduction": False
        }],
        quantity=calculations['excavation']['total_excavation_area_m2'],
        unit="m²",
        rate=80.00,
        amount=calculations['excavation']['total_excavation_area_m2'] * 80.00
    ))
    
    # Murram filling
    items.append(TakeoffItem(
        bill_no="B",
        item_no="2.5",
        description=f"Filling, imported murram, compacted in {input_data.pavement_layers.murram_depth*1000:.0f}mm layers",
        dimensions=[{
            "number": "1",
            "length": f"{calculations['excavation']['total_excavation_area_m2']:.2f}",
            "width": f"{input_data.pavement_layers.murram_depth:.2f}",
            "height": "",
            "deduction": False
        }],
        quantity=calculations['filling']['murram_filling_m3'],
        unit="m³",
        rate=800.00,
        amount=calculations['filling']['murram_filling_m3'] * 800.00
    ))
    
    # CLASS R: ROADS & PAVINGS
    items.append(TakeoffItem(
        bill_no="C",
        item_no="3",
        description="ROADS & PAVINGS (Class R - CESMM4)",
        dimensions=[],
        quantity=0,
        unit="",
        is_header=True
    ))
    
    # Hardcore
    items.append(TakeoffItem(
        bill_no="C",
        item_no="3.1",
        description=f"Hardcore filling, {input_data.pavement_layers.hardcore_thickness*1000:.0f}mm thick, compacted",
        dimensions=[{
            "number": "1",
            "length": f"{calculations['filling']['hardcore_area_m2']:.2f}",
            "width": "",
            "height": "",
            "deduction": False
        }],
        quantity=calculations['filling']['hardcore_area_m2'],
        unit="m²",
        rate=650.00,
        amount=calculations['filling']['hardcore_area_m2'] * 650.00
    ))
    
    # Bitumen macadam base
    items.append(TakeoffItem(
        bill_no="C",
        item_no="3.2",
        description=f"Bitumen bound macadam base course, {input_data.pavement_layers.bitumen_macadam_base*1000:.0f}mm thick",
        dimensions=[{
            "number": "1",
            "length": f"{calculations['pavement']['bitumen_macadam_base_m2']:.2f}",
            "width": "",
            "height": "",
            "deduction": False
        }],
        quantity=calculations['pavement']['bitumen_macadam_base_m2'],
        unit="m²",
        rate=1200.00,
        amount=calculations['pavement']['bitumen_macadam_base_m2'] * 1200.00
    ))
    
    # Bitumen premix wearing course
    items.append(TakeoffItem(
        bill_no="C",
        item_no="3.3",
        description=f"Bitumen premix wearing course, {input_data.pavement_layers.bitumen_thickness*1000:.0f}mm thick",
        dimensions=[{
            "number": "1",
            "length": f"{calculations['pavement']['bitumen_premix_m2']:.2f}",
            "width": "",
            "height": "",
            "deduction": False
        }],
        quantity=calculations['pavement']['bitumen_premix_m2'],
        unit="m²",
        rate=850.00,
        amount=calculations['pavement']['bitumen_premix_m2'] * 850.00
    ))
    
    # Kerbs
    kerb_size = "125x250mm" if input_data.kerbs_channels.kerb_type == "pcc" else "standard"
    items.append(TakeoffItem(
        bill_no="C",
        item_no="3.4",
        description=f"PCC kerb, {kerb_size}, straight",
        dimensions=[{
            "number": "1",
            "length": f"{calculations['kerbs']['kerb_straight_m']:.2f}",
            "width": "",
            "height": "",
            "deduction": False
        }],
        quantity=calculations['kerbs']['kerb_straight_m'],
        unit="m",
        rate=1500.00,
        amount=calculations['kerbs']['kerb_straight_m'] * 1500.00
    ))
    
    if calculations['kerbs']['kerb_curved_m'] > 0:
        items.append(TakeoffItem(
            bill_no="C",
            item_no="3.5",
            description=f"PCC kerb, {kerb_size}, curved",
            dimensions=[{
                "number": "1",
                "length": f"{calculations['kerbs']['kerb_curved_m']:.2f}",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=calculations['kerbs']['kerb_curved_m'],
            unit="m",
            rate=1800.00,
            amount=calculations['kerbs']['kerb_curved_m'] * 1800.00
        ))
    
    # Channels
    items.append(TakeoffItem(
        bill_no="C",
        item_no="3.6",
        description="PCC channel, 125x100mm, straight",
        dimensions=[{
            "number": "1",
            "length": f"{calculations['kerbs']['channel_straight_m']:.2f}",
            "width": "",
            "height": "",
            "deduction": False
        }],
        quantity=calculations['kerbs']['channel_straight_m'],
        unit="m",
        rate=1200.00,
        amount=calculations['kerbs']['channel_straight_m'] * 1200.00
    ))
    
    # Concrete backing
    if calculations['kerbs']['concrete_backing_m3'] > 0:
        items.append(TakeoffItem(
            bill_no="C",
            item_no="3.7",
            description=f"Concrete backing to kerb, {input_data.pavement_layers.concrete_backing_thickness*1000:.0f}mm thick",
            dimensions=[{
                "number": "1",
                "length": f"{calculations['kerbs']['total_kerb_length_m']:.2f}",
                "width": "0.20",
                "height": f"{input_data.pavement_layers.concrete_backing_thickness:.2f}",
                "deduction": False
            }],
            quantity=calculations['kerbs']['concrete_backing_m3'],
            unit="m³",
            rate=12000.00,
            amount=calculations['kerbs']['concrete_backing_m3'] * 12000.00
        ))
    
    # DRAINAGE
    if input_data.drainage.invert_block_count > 0:
        items.append(TakeoffItem(
            bill_no="C",
            item_no="3.8",
            description=f"Invert blocks, {input_data.drainage.invert_block_size*1000:.0f}mm size",
            dimensions=[{
                "number": str(input_data.drainage.invert_block_count),
                "length": "",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=float(input_data.drainage.invert_block_count),
            unit="no",
            rate=2500.00,
            amount=input_data.drainage.invert_block_count * 2500.00
        ))
    
    if calculations['drainage']['pcc_slab_area_m2'] > 0:
        items.append(TakeoffItem(
            bill_no="C",
            item_no="3.9",
            description=f"PCC slabs on sand bed, {input_data.drainage.pcc_slab_thickness*1000:.0f}mm thick",
            dimensions=[{
                "number": "1",
                "length": f"{input_data.drainage.pcc_slab_length:.2f}",
                "width": f"{input_data.drainage.pcc_slab_width:.2f}",
                "height": "",
                "deduction": False
            }],
            quantity=calculations['drainage']['pcc_slab_area_m2'],
            unit="m²",
            rate=1800.00,
            amount=calculations['drainage']['pcc_slab_area_m2'] * 1800.00
        ))
    
    # LANDSCAPING
    items.append(TakeoffItem(
        bill_no="D",
        item_no="4",
        description="LANDSCAPING (Class E - CESMM4)",
        dimensions=[],
        quantity=0,
        unit="",
        is_header=True
    ))
    
    # Imported topsoil
    if calculations['landscaping']['imported_topsoil_m3'] > 0:
        items.append(TakeoffItem(
            bill_no="D",
            item_no="4.1",
            description=f"Imported topsoil, {input_data.landscaping.imported_topsoil_thickness*1000:.0f}mm thick",
            dimensions=[{
                "number": "1",
                "length": f"{calculations['landscaping']['grass_seeding_m2']:.2f}",
                "width": f"{input_data.landscaping.imported_topsoil_thickness:.2f}",
                "height": "",
                "deduction": False
            }],
            quantity=calculations['landscaping']['imported_topsoil_m3'],
            unit="m³",
            rate=1500.00,
            amount=calculations['landscaping']['imported_topsoil_m3'] * 1500.00
        ))
    
    # Grass seeding
    if calculations['landscaping']['grass_seeding_m2'] > 0:
        items.append(TakeoffItem(
            bill_no="D",
            item_no="4.2",
            description="Grass seeding to prepared surfaces",
            dimensions=[{
                "number": "1",
                "length": f"{calculations['landscaping']['grass_seeding_m2']:.2f}",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=calculations['landscaping']['grass_seeding_m2'],
            unit="m²",
            rate=300.00,
            amount=calculations['landscaping']['grass_seeding_m2'] * 300.00
        ))
    
    # Trees
    if input_data.landscaping.mahogany_trees > 0:
        items.append(TakeoffItem(
            bill_no="D",
            item_no="4.3",
            description="Mahogany trees, 1m high",
            dimensions=[{
                "number": str(input_data.landscaping.mahogany_trees),
                "length": "",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=float(input_data.landscaping.mahogany_trees),
            unit="no",
            rate=5000.00,
            amount=input_data.landscaping.mahogany_trees * 5000.00
        ))
    
    if input_data.landscaping.ornamental_trees > 0:
        items.append(TakeoffItem(
            bill_no="D",
            item_no="4.4",
            description="Ornamental trees, 10m c/c",
            dimensions=[{
                "number": str(input_data.landscaping.ornamental_trees),
                "length": "",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=float(input_data.landscaping.ornamental_trees),
            unit="no",
            rate=3000.00,
            amount=input_data.landscaping.ornamental_trees * 3000.00
        ))
    
    # Hedge
    if input_data.landscaping.euphorbia_hedge_length > 0:
        items.append(TakeoffItem(
            bill_no="D",
            item_no="4.5",
            description="Euphorbia hedge, 0.5m high",
            dimensions=[{
                "number": "1",
                "length": f"{input_data.landscaping.euphorbia_hedge_length:.2f}",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=input_data.landscaping.euphorbia_hedge_length,
            unit="m",
            rate=800.00,
            amount=input_data.landscaping.euphorbia_hedge_length * 800.00
        ))
    
    # FENCING
    items.append(TakeoffItem(
        bill_no="E",
        item_no="5",
        description="FENCING & GATES (Class X - CESMM4)",
        dimensions=[],
        quantity=0,
        unit="",
        is_header=True
    ))
    
    # Timber post and wire fence
    if input_data.fencing.timber_post_wire_fence > 0:
        items.append(TakeoffItem(
            bill_no="E",
            item_no="5.1",
            description="Timber posts and wire fencing, 2100mm high",
            dimensions=[{
                "number": "1",
                "length": f"{input_data.fencing.timber_post_wire_fence:.2f}",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=input_data.fencing.timber_post_wire_fence,
            unit="m",
            rate=2500.00,
            amount=input_data.fencing.timber_post_wire_fence * 2500.00
        ))
    
    # Fence type 1
    if input_data.fencing.fence_type_1_length > 0:
        items.append(TakeoffItem(
            bill_no="E",
            item_no="5.2",
            description="Fence type 1, 2-2.5m height",
            dimensions=[{
                "number": "1",
                "length": f"{input_data.fencing.fence_type_1_length:.2f}",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=input_data.fencing.fence_type_1_length,
            unit="m",
            rate=3500.00,
            amount=input_data.fencing.fence_type_1_length * 3500.00
        ))
    
    # Fence type 2
    if input_data.fencing.fence_type_2_length > 0:
        items.append(TakeoffItem(
            bill_no="E",
            item_no="5.3",
            description="Fence type 2, 1.5-2m height",
            dimensions=[{
                "number": "1",
                "length": f"{input_data.fencing.fence_type_2_length:.2f}",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=input_data.fencing.fence_type_2_length,
            unit="m",
            rate=2800.00,
            amount=input_data.fencing.fence_type_2_length * 2800.00
        ))
    
    # Gates
    if input_data.fencing.metal_gates > 0:
        items.append(TakeoffItem(
            bill_no="E",
            item_no="5.4",
            description="Metal gates, >5m span",
            dimensions=[{
                "number": str(input_data.fencing.metal_gates),
                "length": "",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=float(input_data.fencing.metal_gates),
            unit="no",
            rate=75000.00,
            amount=input_data.fencing.metal_gates * 75000.00
        ))
    
    if input_data.fencing.normal_gates > 0:
        items.append(TakeoffItem(
            bill_no="E",
            item_no="5.5",
            description="Normal gates",
            dimensions=[{
                "number": str(input_data.fencing.normal_gates),
                "length": "",
                "width": "",
                "height": "",
                "deduction": False
            }],
            quantity=float(input_data.fencing.normal_gates),
            unit="no",
            rate=35000.00,
            amount=input_data.fencing.normal_gates * 35000.00
        ))
    
    return items

# ======================= API ENDPOINTS =======================

@router.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "External Works Takeoff API",
        "version": "1.0.0",
        "documentation": "/docs"
    }

@router.post("/calculate", response_model=TakeoffOutput)
async def calculate_takeoff(input_data: TakeoffInput):
    """
    Main calculation endpoint
    Processes all input data and returns complete takeoff with English Method formatting
    """
    try:
        # Perform all calculations
        clearance = calculate_site_clearance(input_data.site_data, input_data.demolition)
        excavation = calculate_excavation(input_data.road_config, input_data.pavement_layers)
        filling = calculate_filling(excavation, input_data.pavement_layers)
        pavement = calculate_pavement_layers(excavation, input_data.pavement_layers, 
                                             input_data.road_config)
        kerbs = calculate_kerbs_channels(input_data.kerbs_channels, input_data.road_config,
                                        input_data.pavement_layers)
        drainage = calculate_drainage(input_data.drainage)
        landscaping = calculate_landscaping(input_data.landscaping, input_data.site_data,
                                            input_data.road_config)
        
        # Combine all calculations
        calculations = {
            'clearance': clearance,
            'excavation': excavation,
            'filling': filling,
            'pavement': pavement,
            'kerbs': kerbs,
            'drainage': drainage,
            'landscaping': landscaping
        }
        
        # Generate takeoff items
        items = generate_takeoff_items(input_data, calculations)
        
        # Calculate totals
        grand_total = sum(item.amount for item in items if item.amount is not None)
        
        # Create summary by bill
        summary = {}
        for bill_letter in ['A', 'B', 'C', 'D', 'E']:
            bill_total = sum(item.amount for item in items 
                           if item.bill_no == bill_letter and item.amount is not None)
            if bill_total > 0:
                summary[f"Bill_{bill_letter}"] = bill_total
        
        totals = {
            'grand_total': grand_total,
            **clearance,
            **excavation,
            **filling,
            **pavement,
            **kerbs,
            **drainage,
            **landscaping
        }
        
        return TakeoffOutput(
            project_info=input_data.project_info,
            items=items,
            summary=summary,
            totals=totals
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")

@router.post("/calculate-simple")
async def calculate_simple(input_data: TakeoffInput):
    """
    Simplified calculation endpoint returning just quantities without formatting
    """
    try:
        clearance = calculate_site_clearance(input_data.site_data, input_data.demolition)
        excavation = calculate_excavation(input_data.road_config, input_data.pavement_layers)
        filling = calculate_filling(excavation, input_data.pavement_layers)
        pavement = calculate_pavement_layers(excavation, input_data.pavement_layers,
                                             input_data.road_config)
        kerbs = calculate_kerbs_channels(input_data.kerbs_channels, input_data.road_config,
                                        input_data.pavement_layers)
        drainage = calculate_drainage(input_data.drainage)
        landscaping = calculate_landscaping(input_data.landscaping, input_data.site_data,
                                            input_data.road_config)
        
        return {
            'status': 'success',
            'project': input_data.project_info.project_name,
            'quantities': {
                'site_clearance': clearance,
                'excavation': excavation,
                'filling': filling,
                'pavement': pavement,
                'kerbs_channels': kerbs,
                'drainage': drainage,
                'landscaping': landscaping
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")

@router.post("/export/csv")
async def export_csv(input_data: TakeoffInput):
    """
    Export takeoff to CSV format
    """
    try:
        # Calculate and get items
        result = await calculate_takeoff(input_data)
        
        # Generate CSV content
        csv_content = "Bill,Item,Description,Quantity,Unit,Rate,Amount\n"
        for item in result.items:
            if not item.is_header:
                csv_content += f"{item.bill_no},{item.item_no},{item.description},"
                csv_content += f"{item.quantity},{item.unit},{item.rate or 0},{item.amount or 0}\n"
        
        return {
            'status': 'success',
            'content': csv_content,
            'filename': f"takeoff_{input_data.project_info.drawing_number}.csv"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    }

# ======================= UTILITY ENDPOINTS =======================

@router.post("/validate")
async def validate_input(input_data: TakeoffInput):
    """
    Validate input data without performing calculations
    """
    try:
        # Check for negative values
        if input_data.site_data.site_length <= 0 or input_data.site_data.site_width <= 0:
            return {'valid': False, 'error': 'Site dimensions must be positive'}
        
        if input_data.road_config.road_length <= 0 or input_data.road_config.road_width <= 0:
            return {'valid': False, 'error': 'Road dimensions must be positive'}
        
        # Check for reasonable values
        if input_data.pavement_layers.excavation_depth_after_veg > 2.0:
            return {'valid': False, 'warning': 'Excavation depth seems unusually large'}
        
        return {
            'valid': True,
            'message': 'Input data is valid',
            'warnings': []
        }
    except Exception as e:
        return {'valid': False, 'error': str(e)}

@router.get("/rates")
async def get_standard_rates():
    """
    Get standard rates for various items
    """
    return {
        'demolition': {
            'site_clearance': 150.00,
            'tree_removal_small': 5000.00,
            'tree_removal_large': 8000.00,
            'stump_removal': 3000.00,
            'building_demolition': 2500.00,
            'pipeline_removal': 1500.00
        },
        'earthworks': {
            'veg_soil_excavation': 250.00,
            'mass_excavation': 350.00,
            'disposal': 200.00,
            'surface_preparation': 80.00,
            'murram_filling': 800.00
        },
        'pavement': {
            'hardcore': 650.00,
            'bitumen_base': 1200.00,
            'bitumen_wearing': 850.00,
            'concrete_backing': 12000.00
        },
        'kerbs_channels': {
            'kerb_straight': 1500.00,
            'kerb_curved': 1800.00,
            'channel': 1200.00
        },
        'drainage': {
            'invert_block': 2500.00,
            'pcc_slab': 1800.00
        },
        'landscaping': {
            'topsoil': 1500.00,
            'grass_seeding': 300.00,
            'mahogany_tree': 5000.00,
            'ornamental_tree': 3000.00,
            'hedge': 800.00
        },
        'fencing': {
            'timber_wire_fence': 2500.00,
            'fence_type_1': 3500.00,
            'fence_type_2': 2800.00,
            'metal_gate': 75000.00,
            'normal_gate': 35000.00
        }
    }
