# backend/route_surveying/router.py
"""
Route, Railway & Road Surveying Module - FastAPI Router
Production-grade alignment analysis and earthworks computation
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from .schemas import (
    CrossSectionRequest, CrossSectionResponse,
    SightDistanceRequest, SightDistanceResponse,
    ChainageInterpolationRequest, ChainageInterpolationResponse,
    EarthworksRequest, EarthworksResponse,
    PavementQuantitiesRequest, PavementQuantitiesResponse
)
from .generation import generate_cross_section
from .area import calculate_section_area
from .sight_distance import calculate_sight_distance
from .interpolation import interpolate_at_chainage
from .alignment_cut_fill import compute_alignment_volumes
from .quantities import compute_pavement_quantities

router = APIRouter(prefix="/route-surveying", tags=["Route & Road Surveying"])


@router.post("/cross-sections/generate", response_model=CrossSectionResponse)
async def generate_cross_section_endpoint(request: CrossSectionRequest):
    """
    Generate cross-section points at specified chainage.
    
    Parameters:
    - chainage: Station location in meters
    - road_width: Carriageway width in meters
    - shoulder_width: Shoulder width each side in meters
    - side_slopes: Cut and fill slope ratios (H:V)
    - camber_config: Camber type and percentage
    - formation_type: 'cut' or 'fill'
    
    Returns: Cross-section coordinates and metadata
    """
    try:
        points = generate_cross_section(
            chainage=request.chainage,
            road_width=request.road_width,
            shoulder_width=request.shoulder_width,
            side_slopes=request.side_slopes,
            camber_config=request.camber_config,
            formation_type=request.formation_type
        )
        
        return CrossSectionResponse(
            chainage=request.chainage,
            points=points,
            total_width=request.road_width + 2 * request.shoulder_width,
            units="meters"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cross-sections/area", response_model=dict)
async def calculate_area_endpoint(request: CrossSectionRequest):
    """
    Calculate cross-section areas (cut, fill, net).
    
    Returns areas in square meters with explicit calculation method.
    """
    try:
        points = generate_cross_section(
            chainage=request.chainage,
            road_width=request.road_width,
            shoulder_width=request.shoulder_width,
            side_slopes=request.side_slopes,
            camber_config=request.camber_config,
            formation_type=request.formation_type
        )
        
        areas = calculate_section_area(points)
        
        return {
            "chainage": request.chainage,
            "cut_area_m2": round(areas["cut"], 3),
            "fill_area_m2": round(areas["fill"], 3),
            "net_area_m2": round(areas["net"], 3),
            "calculation_method": "coordinate_based_trapezoidal",
            "units": "square_meters"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geometry/sight-distance", response_model=SightDistanceResponse)
async def calculate_sight_distance_endpoint(request: SightDistanceRequest):
    """
    Calculate stopping and overtaking sight distances per AASHTO standards.
    
    Critical Safety Calculation - verify all parameters.
    
    Parameters:
    - design_speed_kmh: Design speed in km/h (must be positive)
    - road_condition: 'dry', 'wet', or 'icy'
    - grade_percent: Longitudinal grade in percent (positive = uphill)
    - reaction_time_s: Driver reaction time in seconds (default 2.5s)
    
    Returns: SSD, OSD, and all calculation assumptions
    """
    if request.design_speed_kmh <= 0:
        raise HTTPException(status_code=400, detail="Design speed must be positive")
    
    if abs(request.grade_percent) > 15:
        raise HTTPException(status_code=400, detail="Grade exceeds typical limits (±15%)")
    
    try:
        result = calculate_sight_distance(
            design_speed_kmh=request.design_speed_kmh,
            road_condition=request.road_condition,
            grade_percent=request.grade_percent,
            reaction_time_s=request.reaction_time_s
        )
        
        return SightDistanceResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/chainage/interpolate", response_model=ChainageInterpolationResponse)
async def interpolate_chainage_endpoint(request: ChainageInterpolationRequest):
    """
    Interpolate survey data at target chainage.
    
    Uses linear interpolation between bracketing stations.
    Flags if extrapolation is required (target outside survey range).
    
    Parameters:
    - stations: List of surveyed chainage points
    - target_chainage: Chainage to interpolate at
    
    Returns: Interpolated elevation, offset, and method used
    """
    if len(request.stations) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 stations required")
    
    try:
        result = interpolate_at_chainage(
            stations=request.stations,
            target_chainage=request.target_chainage
        )
        
        return ChainageInterpolationResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/earthworks/alignment", response_model=EarthworksResponse)
async def compute_earthworks_endpoint(request: EarthworksRequest):
    """
    Compute earthwork volumes along alignment using average-end-area method.
    
    Calculates:
    - Cut and fill volumes between stations
    - Cumulative volumes (mass haul)
    - Mass haul balance
    
    Parameters:
    - cross_sections: List of cross-sections with areas at each chainage
    
    Returns: Volume data ready for mass haul diagram
    """
    if len(request.cross_sections) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 cross-sections required")
    
    # Verify chainages are sorted
    chainages = [cs.chainage for cs in request.cross_sections]
    if chainages != sorted(chainages):
        raise HTTPException(status_code=400, detail="Cross-sections must be sorted by chainage")
    
    try:
        result = compute_alignment_volumes(
            cross_sections=request.cross_sections
        )
        
        return EarthworksResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pavement/quantities", response_model=PavementQuantitiesResponse)
async def compute_pavement_quantities_endpoint(request: PavementQuantitiesRequest):
    """
    Compute pavement material quantities by layer.
    
    Calculates volumes and tonnages for each pavement layer.
    Accounts for variable widths along alignment.
    
    Parameters:
    - alignment_length_m: Total alignment length
    - lane_width_m: Width per lane
    - number_of_lanes: Total lanes
    - layers: Pavement layer specifications (thickness, density)
    - compaction_factor: Optional compaction adjustment
    - wastage_factor: Optional material loss percentage
    
    Returns: Quantities per layer in m³ and tonnes
    """
    if request.alignment_length_m <= 0:
        raise HTTPException(status_code=400, detail="Alignment length must be positive")
    
    if request.number_of_lanes <= 0:
        raise HTTPException(status_code=400, detail="Number of lanes must be positive")
    
    try:
        result = compute_pavement_quantities(
            alignment_length_m=request.alignment_length_m,
            lane_width_m=request.lane_width_m,
            number_of_lanes=request.number_of_lanes,
            layers=request.layers,
            compaction_factor=request.compaction_factor,
            wastage_factor=request.wastage_factor
        )
        
        return PavementQuantitiesResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

