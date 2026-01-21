# backend/surveying/router.py
"""
FastAPI router for surveying module
"""
from fastapi import APIRouter, HTTPException
from typing import List

from .schemas import (
    CoordinateTransformRequest, CoordinateTransformResponse,
    OffsetRequest, OffsetResponse,
    HorizontalCurveRequest, HorizontalCurveResponse,
    VerticalCurveRequest, VerticalCurveResponse,
    ChainageRLRequest, ChainageRLResponse,
    DeflectionTableRequest, DeflectionTableResponse,
    SuperelevationRequest, SuperelevationResponse,
    WideningRequest, WideningResponse,
    GridRequest, GridResponse,
    Point2D, Point3D
)

from .setting_out.coordinates import transform_coordinates, grid_to_site_transform
from .setting_out.offsets import calculate_right_angle_offset, calculate_oblique_offset
from .setting_out.grids import generate_rectangular_grid, generate_radial_grid
from .setting_out.profiles import calculate_profile_board, calculate_batter_board

from .alignment.horizontal import (
    calculate_simple_circular_curve,
    calculate_minimum_radius,
    calculate_curve_coordinates
)
from .alignment.vertical import (
    calculate_vertical_curve,
    calculate_rl_at_chainage,
    calculate_highest_lowest_point
)
from .alignment.deflection import calculate_deflection_table, calculate_incremental_deflections
from .alignment.superelevation import calculate_superelevation
from .alignment.widening import calculate_curve_widening

# Create router
router = APIRouter(prefix="/surveying", tags=["Surveying"])

# ==================== COORDINATE TRANSFORMATION ====================

@router.post("/transform/coordinates", response_model=CoordinateTransformResponse)
def transform_coordinate_system(request: CoordinateTransformRequest):
    """
    Transform coordinates between coordinate systems
    
    Apply translation, rotation, and scaling transformations
    """
    try:
        transformed = transform_coordinates(request.points, request.transformation)
        
        return CoordinateTransformResponse(
            original_points=request.points,
            transformed_points=transformed,
            transformation=request.transformation
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/transform/grid-to-site")
def transform_grid_to_site(grid_point: Point2D, 
                           grid_origin: Point2D,
                           grid_bearing: float):
    """
    Transform local grid coordinates to site coordinates
    
    Args:
        grid_point: Point in local grid system
        grid_origin: Grid origin in site coordinates
        grid_bearing: Bearing of grid X-axis (degrees)
    """
    try:
        site_point = grid_to_site_transform(grid_point, grid_origin, grid_bearing)
        return {"site_coordinates": site_point}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== OFFSET CALCULATIONS ====================

@router.post("/setting-out/offset", response_model=OffsetResponse)
def calculate_offset(request: OffsetRequest):
    """
    Calculate right-angle offset from baseline
    
    Returns offset point coordinates and bearing
    """
    try:
        offset_point, bearing = calculate_right_angle_offset(
            request.baseline_start,
            request.baseline_end,
            request.chainage,
            request.offset_distance
        )
        
        return OffsetResponse(
            chainage=request.chainage,
            offset_distance=request.offset_distance,
            offset_point=offset_point,
            bearing=bearing
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/setting-out/oblique-offset")
def calculate_oblique_offset_endpoint(baseline_start: Point2D,
                                       baseline_end: Point2D,
                                       chainage: float,
                                       offset_distance: float,
                                       offset_angle: float):
    """
    Calculate oblique offset at specified angle
    
    Args:
        offset_angle: Angle from baseline (degrees, +ve = right)
    """
    try:
        offset_point = calculate_oblique_offset(
            baseline_start, baseline_end,
            chainage, offset_distance, offset_angle
        )
        return {"offset_point": offset_point}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== GRID GENERATION ====================

@router.post("/setting-out/grid", response_model=GridResponse)
def generate_grid(request: GridRequest):
    """
    Generate rectangular setting-out grid
    
    Used for building columns, piling, foundations
    """
    try:
        grid = generate_rectangular_grid(
            request.origin,
            request.grid_spacing_x,
            request.grid_spacing_y,
            request.extent_x,
            request.extent_y,
            request.rotation
        )
        return grid
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/setting-out/radial-grid")
def generate_radial_grid_endpoint(center: Point2D,
                                  num_radials: int,
                                  radial_spacing: float,
                                  max_radius: float):
    """
    Generate radial grid for circular structures
    """
    try:
        grid_points = generate_radial_grid(
            center, num_radials, radial_spacing, max_radius
        )
        return {"grid_points": grid_points}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== PROFILE BOARDS ====================

@router.post("/setting-out/profile-board")
def create_profile_board(design_rl: float,
                        existing_rl: float,
                        board_height: float = 1.0,
                        offset_distance: float = 2.0):
    """
    Calculate profile board for excavation/filling
    """
    try:
        board = calculate_profile_board(
            design_rl, existing_rl, board_height, offset_distance
        )
        return board
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/setting-out/batter-board")
def create_batter_board(footing_level: float,
                       ground_level: float,
                       footing_width: float,
                       batter_slope: float = 0.25):
    """
    Calculate batter board for sloped excavation
    """
    try:
        board = calculate_batter_board(
            footing_level, ground_level, footing_width, batter_slope
        )
        return board
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== HORIZONTAL CURVES ====================

@router.post("/alignment/horizontal-curve", response_model=HorizontalCurveResponse)
def calculate_horizontal_curve(request: HorizontalCurveRequest):
    """
    Calculate simple circular curve parameters
    
    Returns complete curve geometry including:
    - Tangent length, curve length, external distance
    - Chainage at TC and CT points
    """
    try:
        curve = calculate_simple_circular_curve(
            request.radius,
            request.intersection_angle,
            request.chainage_ip
        )
        return curve
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/alignment/minimum-radius")
def get_minimum_radius(design_speed: float,
                      superelevation_rate: float = 0.06,
                      friction_factor: float = 0.15):
    """
    Calculate minimum curve radius for design speed
    
    Args:
        design_speed: Design speed (km/h)
        superelevation_rate: Super-elevation rate (decimal, e.g., 0.06)
        friction_factor: Side friction factor (typically 0.10-0.17)
    """
    try:
        min_r = calculate_minimum_radius(
            design_speed, superelevation_rate, friction_factor
        )
        return {
            "design_speed_kmh": design_speed,
            "minimum_radius": min_r,
            "superelevation_rate": superelevation_rate
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/alignment/curve-coordinates")
def get_curve_coordinates(radius: float,
                         intersection_angle: float,
                         tangent_bearing: float,
                         origin_x: float,
                         origin_y: float,
                         interval: float = 20.0):
    """
    Calculate coordinates along horizontal curve
    
    Args:
        tangent_bearing: Bearing of tangent at TC (degrees from North)
        origin_x, origin_y: Coordinates of TC point
        interval: Calculation interval (meters)
    """
    try:
        coords = calculate_curve_coordinates(
            radius, intersection_angle, tangent_bearing,
            origin_x, origin_y, interval
        )
        return {"curve_points": coords}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== VERTICAL CURVES ====================

@router.post("/alignment/vertical-curve", response_model=VerticalCurveResponse)
def calculate_vertical_curve_params(request: VerticalCurveRequest):
    """
    Calculate vertical curve parameters
    
    Returns complete vertical curve geometry including:
    - Curve type (crest/sag), rate of change
    - RL at start, VIP, and end points
    """
    try:
        curve = calculate_vertical_curve(
            request.grade_in,
            request.grade_out,
            request.curve_length,
            request.chainage_vip,
            request.rl_vip
        )
        return curve
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/alignment/chainage-rl", response_model=ChainageRLResponse)
def get_rl_at_chainage(request: ChainageRLRequest):
    """
    Calculate reduced level at specific chainage on vertical curve
    """
    try:
        rl_data = calculate_rl_at_chainage(
            request.chainage,
            request.vertical_curve
        )
        return rl_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/alignment/extreme-point")
def get_extreme_point(vertical_curve: VerticalCurveRequest):
    """
    Calculate highest/lowest point on vertical curve
    """
    try:
        chainage, rl = calculate_highest_lowest_point(vertical_curve)
        return {
            "chainage": chainage,
            "rl": rl,
            "point_type": "highest" if vertical_curve.grade_in > vertical_curve.grade_out else "lowest"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== DEFLECTION ANGLES ====================

@router.post("/alignment/deflection-table", response_model=DeflectionTableResponse)
def get_deflection_table(request: DeflectionTableRequest):
    """
    Generate deflection angle table for curve setting-out
    
    Used with theodolite for curve pegging
    """
    try:
        table = calculate_deflection_table(
            request.radius,
            request.curve_length,
            request.peg_interval,
            request.chainage_tc
        )
        return table
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/alignment/incremental-deflections")
def get_incremental_deflections(radius: float,
                               curve_length: float,
                               peg_interval: float = 20.0):
    """
    Calculate incremental deflection angles between pegs
    """
    try:
        deflections = calculate_incremental_deflections(
            radius, curve_length, peg_interval
        )
        return {"incremental_deflections": deflections}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== SUPERELEVATION ====================

@router.post("/alignment/superelevation", response_model=SuperelevationResponse)
def get_superelevation(request: SuperelevationRequest):
    """
    Calculate required superelevation for curve
    
    Returns superelevation rate and runoff length
    """
    try:
        super_e = calculate_superelevation(
            request.design_speed,
            request.radius,
            request.lane_width
        )
        return super_e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== WIDENING ====================

@router.post("/alignment/widening", response_model=WideningResponse)
def get_curve_widening(request: WideningRequest):
    """
    Calculate curve widening (mechanical + psychological)
    """
    try:
        widening = calculate_curve_widening(
            request.radius,
            request.design_speed,
            request.lane_width,
            request.number_of_lanes
        )
        return widening
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))