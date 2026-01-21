"""
Civil Engineering Surveying Application - FastAPI Backend
Complete backend with all surveying calculations and image processing
"""

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple
import numpy as np
import cv2
import math
from io import BytesIO
from PIL import Image
import base64
from .control_survey import (
    TriangulationRequest, TrilaterationRequest, ResectionRequest, 
    IntersectionRequest, TransformationRequest, CalculationResult,
    Coordinate,
    calculate_angular_intersection, calculate_distance_intersection, 
    calculate_3point_resection, transform_local_to_national
)
from .corrections import (
    CorrectionResult, apply_slope_correction, apply_chained_corrections
)

router = APIRouter()
# ==================== PYDANTIC MODELS ====================


class LevellingRow(BaseModel):
    station: str
    bs: Optional[float] = None
    is_reading: Optional[float] = Field(None, alias="is")
    fs: Optional[float] = None
    rise: Optional[float] = None
    fall: Optional[float] = None
    rl: Optional[float] = None
    remarks: Optional[str] = ""


class LevellingRequest(BaseModel):
    method: str  # "rise-fall" or "hoc"
    benchmark_rl: float
    rows: List[LevellingRow]


class LevellingResponse(BaseModel):
    rows: List[LevellingRow]
    arithmetic_checks: Dict[str, float]
    is_valid: bool


class TraverseStation(BaseModel):
    station: str
    bearing: float  # in degrees
    distance: float
    latitude: Optional[float] = None
    departure: Optional[float] = None
    corr_lat: Optional[float] = None
    corr_dep: Optional[float] = None
    easting: Optional[float] = None
    northing: Optional[float] = None


class TraverseRequest(BaseModel):
    start_easting: float
    start_northing: float
    stations: List[TraverseStation]


class TraverseResponse(BaseModel):
    stations: List[TraverseStation]
    closure_error: float
    relative_accuracy: str


class TacheometryRequest(BaseModel):
    upper_stadia: float
    lower_stadia: float
    central_hair: float
    vertical_angle: float  # in degrees
    k: float = 100.0
    c: float = 0.0
    instrument_height: Optional[float] = 1.5


class TacheometryResponse(BaseModel):
    staff_intercept: float
    horizontal_distance: float
    vertical_distance: float
    slope_distance: float
    reduced_level_diff: float


class ManholeData(BaseModel):
    id: str
    ground_level: float
    invert_level: Optional[float] = None
    depth: Optional[float] = None
    distance: Optional[float] = None
    gradient: Optional[float] = None
    remarks: Optional[str] = ""


class SewerDesignRequest(BaseModel):
    manholes: List[ManholeData]
    pipe_diameter: Optional[float] = 150.0  # mm
    roughness_coeff: Optional[float] = 0.013  # Manning's n


class SewerDesignResponse(BaseModel):
    manholes: List[ManholeData]
    design_checks: List[str]
    flow_capacity: Optional[float] = None




# ==================== LEVELLING CALCULATIONS ====================


@router.post("/api/levelling/calculate", response_model=LevellingResponse)
async def calculate_levelling(request: LevellingRequest):
    """
    Calculate levelling using Rise & Fall or Height of Collimation method
    """
    try:
        rows = request.rows
        benchmark_rl = request.benchmark_rl
        method = request.method

        if method == "rise-fall":
            calculated_rows = calculate_rise_fall_method(rows, benchmark_rl)
        else:
            calculated_rows = calculate_hoc_method(rows, benchmark_rl)

        # Arithmetic checks
        checks = calculate_arithmetic_checks(calculated_rows, benchmark_rl)

        return LevellingResponse(
            rows=calculated_rows, arithmetic_checks=checks, is_valid=checks["is_valid"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def calculate_rise_fall_method(
    rows: List[LevellingRow], benchmark_rl: float
) -> List[LevellingRow]:
    """Rise and Fall Method calculations"""
    calculated = []
    previous_rl = benchmark_rl

    for i, row in enumerate(rows):
        new_row = row.model_copy()

        if i == 0:
            new_row.rl = round(benchmark_rl, 3)
            new_row.remarks = "RL of Benchmark"
        else:
            bs = row.bs or 0
            fs = row.fs or 0
            is_reading = row.is_reading or 0

            if bs > 0 and fs == 0:
                # Change point
                rise = bs
                new_row.rise = round(rise, 3)
                new_row.fall = None
                new_row.rl = round(previous_rl + rise, 3)
                new_row.remarks = "Change Point"
            elif fs > 0:
                # Calculate rise or fall
                prev_sight = calculated[i - 1].bs or calculated[i - 1].is_reading or 0
                diff = prev_sight - fs
                if diff > 0:
                    new_row.rise = round(diff, 3)
                    new_row.fall = None
                else:
                    new_row.fall = round(abs(diff), 3)
                    new_row.rise = None
                new_row.rl = round(previous_rl + diff, 3)
            elif is_reading > 0:
                # Intermediate sight
                prev_sight = calculated[i - 1].bs or 0
                diff = prev_sight - is_reading
                if diff > 0:
                    new_row.rise = round(diff, 3)
                    new_row.fall = None
                else:
                    new_row.fall = round(abs(diff), 3)
                    new_row.rise = None
                new_row.rl = round(previous_rl + diff, 3)
                new_row.remarks = "Intermediate Point"

            previous_rl = new_row.rl

        calculated.append(new_row)

    return calculated


def calculate_hoc_method(
    rows: List[LevellingRow], benchmark_rl: float
) -> List[LevellingRow]:
    """Height of Collimation Method calculations"""
    calculated = []

    # Calculate first HOC
    hoc = benchmark_rl + (rows[0].bs or 0)

    for i, row in enumerate(rows):
        new_row = row.model_copy()

        if i == 0:
            new_row.rl = round(benchmark_rl, 3)
            new_row.remarks = f"RL of Benchmark, HOC = {round(hoc, 3)}"
        else:
            bs = row.bs or 0
            fs = row.fs or 0
            is_reading = row.is_reading or 0

            if bs > 0:
                # Change point - new HOC
                new_row.rl = round(hoc - fs, 3) if fs > 0 else round(hoc, 3)
                hoc = new_row.rl + bs
                new_row.remarks = f"Change Point, HOC = {round(hoc, 3)}"
            elif is_reading > 0:
                new_row.rl = round(hoc - is_reading, 3)
                new_row.remarks = "Intermediate Point"
            elif fs > 0:
                new_row.rl = round(hoc - fs, 3)

        calculated.append(new_row)

    return calculated


def calculate_arithmetic_checks(rows: List[LevellingRow], benchmark_rl: float) -> Dict:
    """Calculate arithmetic checks for levelling"""
    sum_bs = sum(row.bs or 0 for row in rows)
    sum_fs = sum(row.fs or 0 for row in rows)
    sum_rise = sum(row.rise or 0 for row in rows)
    sum_fall = sum(row.fall or 0 for row in rows)

    first_rl = rows[0].rl or benchmark_rl
    last_rl = rows[-1].rl or benchmark_rl

    check1 = round(sum_bs - sum_fs, 3)
    check2 = round(sum_rise - sum_fall, 3)
    check3 = round(last_rl - first_rl, 3)

    is_valid = abs(check1 - check2) < 0.01 and abs(check2 - check3) < 0.01

    return {
        "sum_bs": round(sum_bs, 3),
        "sum_fs": round(sum_fs, 3),
        "sum_rise": round(sum_rise, 3),
        "sum_fall": round(sum_fall, 3),
        "check1": check1,
        "check2": check2,
        "check3": check3,
        "is_valid": is_valid,
    }


# ==================== TRAVERSE CALCULATIONS ====================


@router.post("/api/traverse/calculate", response_model=TraverseResponse)
async def calculate_traverse(request: TraverseRequest):
    """
    Calculate traverse using Bowditch method for adjustment
    """
    try:
        stations = request.stations
        start_e = request.start_easting
        start_n = request.start_northing

        # Calculate latitudes and departures
        calculated_stations = []
        sum_lat = 0
        sum_dep = 0
        sum_dist = 0

        for station in stations:
            new_station = station.model_copy()
            bearing_rad = math.radians(station.bearing)

            # Calculate latitude and departure
            lat = station.distance * math.cos(bearing_rad)
            dep = station.distance * math.sin(bearing_rad)

            new_station.latitude = round(lat, 3)
            new_station.departure = round(dep, 3)

            sum_lat += lat
            sum_dep += dep
            sum_dist += station.distance

            calculated_stations.append(new_station)

        # Bowditch adjustment
        if sum_dist > 0:
            corr_lat_per_unit = -sum_lat / sum_dist
            corr_dep_per_unit = -sum_dep / sum_dist

            current_e = start_e
            current_n = start_n

            for i, station in enumerate(calculated_stations):
                # Apply corrections
                corr_lat = corr_lat_per_unit * station.distance
                corr_dep = corr_dep_per_unit * station.distance

                calculated_stations[i].corr_lat = round(corr_lat, 3)
                calculated_stations[i].corr_dep = round(corr_dep, 3)

                # Calculate adjusted coordinates
                adj_lat = station.latitude + corr_lat
                adj_dep = station.departure + corr_dep

                current_n += adj_lat
                current_e += adj_dep

                calculated_stations[i].northing = round(current_n, 3)
                calculated_stations[i].easting = round(current_e, 3)

        # Calculate closure error
        closure_error = math.sqrt(sum_lat**2 + sum_dep**2)
        relative_accuracy = (
            f"1:{int(sum_dist / closure_error)}"
            if closure_error > 0
            else "Perfect closure"
        )

        return TraverseResponse(
            stations=calculated_stations,
            closure_error=round(closure_error, 3),
            relative_accuracy=relative_accuracy,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== TACHEOMETRY CALCULATIONS ====================


@router.post("/api/tacheometry/calculate", response_model=TacheometryResponse)
async def calculate_tacheometry(request: TacheometryRequest):
    """
    Calculate tacheometric distances and elevations
    """
    try:
        # Staff intercept
        s = request.upper_stadia - request.lower_stadia

        # Convert angle to radians
        theta = math.radians(request.vertical_angle)

        # Calculate distances
        k = request.k
        c = request.c

        horizontal_dist = k * s * math.cos(theta) ** 2 + c * math.cos(theta)
        vertical_dist = k * s * math.cos(theta) * math.sin(theta) + c * math.sin(theta)
        slope_dist = k * s + c

        # RL difference (from instrument to staff point)
        rl_diff = vertical_dist + (request.instrument_height - request.central_hair)

        return TacheometryResponse(
            staff_intercept=round(s, 4),
            horizontal_distance=round(horizontal_dist, 3),
            vertical_distance=round(vertical_dist, 3),
            slope_distance=round(slope_dist, 3),
            reduced_level_diff=round(rl_diff, 3),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== SEWER DESIGN CALCULATIONS ====================


@router.post("/api/sewer/calculate", response_model=SewerDesignResponse)
async def calculate_sewer_design(request: SewerDesignRequest):
    """
    Calculate sewer invert levels, depths, and gradients
    """
    try:
        manholes = request.manholes
        calculated_manholes = []
        design_checks = []

        for i, mh in enumerate(manholes):
            new_mh = mh.model_copy()

            # Calculate depth
            if mh.ground_level and mh.invert_level:
                new_mh.depth = round(mh.ground_level - mh.invert_level, 3)

                # Check minimum cover
                if new_mh.depth < 0.6:
                    design_checks.append(
                        f"{mh.id}: Insufficient cover ({new_mh.depth}m < 0.6m minimum)"
                    )

            # Calculate gradient
            if i > 0 and mh.distance and mh.distance > 0:
                prev_il = calculated_manholes[i - 1].invert_level
                curr_il = mh.invert_level

                if prev_il and curr_il:
                    gradient = ((prev_il - curr_il) / mh.distance) * 100
                    new_mh.gradient = round(gradient, 4)

                    # Check gradient
                    if gradient < 0:
                        new_mh.remarks = "WARNING: Upward slope!"
                        design_checks.append(f"{mh.id}: Upward slope detected")
                    elif gradient < 1.0:
                        new_mh.remarks = (
                            "Warning: Gradient below recommended minimum (1%)"
                        )
                        design_checks.append(
                            f"{mh.id}: Gradient {gradient}% < 1% minimum"
                        )
                    else:
                        new_mh.remarks = "OK"

            calculated_manholes.append(new_mh)

        # Calculate flow capacity using Manning's equation (simplified)
        # Q = (1/n) * A * R^(2/3) * S^(1/2)
        diameter = request.pipe_diameter / 1000  # Convert mm to m
        area = math.pi * (diameter / 2) ** 2
        perimeter = math.pi * diameter
        hydraulic_radius = area / perimeter

        # Use average gradient for flow capacity
        gradients = [
            mh.gradient for mh in calculated_manholes if mh.gradient and mh.gradient > 0
        ]
        if gradients:
            avg_gradient = sum(gradients) / len(gradients) / 100  # Convert % to decimal
            flow_capacity = (
                (1 / request.roughness_coeff)
                * area
                * (hydraulic_radius ** (2 / 3))
                * (avg_gradient**0.5)
            )
            flow_capacity = round(flow_capacity * 1000, 2)  # Convert to L/s
        else:
            flow_capacity = None

        if not design_checks:
            design_checks.append("All design checks passed")

        return SewerDesignResponse(
            manholes=calculated_manholes,
            design_checks=design_checks,
            flow_capacity=flow_capacity,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))






# ==================== CONTROL SURVEY CALCULATIONS ====================

@router.post("/api/control/intersection/angular", response_model=CalculationResult)
async def api_angular_intersection(request: IntersectionRequest):
    """Calculate intersection of two bearings"""
    try:
        return calculate_angular_intersection(request.p1.coords, request.p2.coords, request.obs1, request.obs2)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/control/intersection/distance", response_model=CalculationResult)
async def api_distance_intersection(request: IntersectionRequest):
    """Calculate intersection of two distances (circles)"""
    try:
        return calculate_distance_intersection(request.p1.coords, request.p2.coords, request.obs1, request.obs2)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/control/resection/3point", response_model=CalculationResult)
async def api_3point_resection(request: ResectionRequest):
    """Calculate resection for 3 fixed points"""
    try:
        if len(request.fixed_points) < 3 or len(request.observations) < 3:
            raise ValueError("Exactly 3 points and 3 angles required for this resection method.")
        return calculate_3point_resection(
            request.fixed_points[0], request.fixed_points[1], request.fixed_points[2],
            request.observations[0], request.observations[1], request.observations[2]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/control/transformation/helmer", response_model=List[Coordinate])
async def api_helmer_transformation(request: TransformationRequest):
    """Apply 2D Helmert transformation"""
    try:
        params = request.params or {}
        return transform_local_to_national(
            request.points, 
            params.get("tx", 0), params.get("ty", 0), 
            params.get("rotation", 0), params.get("scale", 1.0)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== CORRECTIONS ====================

@router.post("/api/corrections/slope", response_model=CorrectionResult)
async def api_slope_correction_endpoint(distance: float, angle: Optional[float] = 0, h_diff: Optional[float] = 0):
    """Calculate slope correction"""
    try:
        return apply_slope_correction(distance, vertical_angle_deg=angle, h_diff=h_diff)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/corrections/chained", response_model=CorrectionResult)
async def api_chained_corrections_endpoint(distance: float, corrections: List[Dict]):
    """Apply multiple corrections sequentially"""
    try:
        return apply_chained_corrections(distance, corrections)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== UTILITY ENDPOINTS ====================


@router.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Civil Engineering Surveying API",
        "version": "1.0.0",
        "endpoints": {
            "levelling": "/api/levelling/calculate",
            "traverse": "/api/traverse/calculate",
            "tacheometry": "/api/tacheometry/calculate",
            "sewer": "/api/sewer/calculate",
            "control_intersection_angular": "/api/control/intersection/angular",
            "control_intersection_distance": "/api/control/intersection/distance",
            "control_resection_3point": "/api/control/resection/3point",
            "control_transformation_helmer": "/api/control/transformation/helmer",
            "corrections_slope": "/api/corrections/slope",
            "corrections_chained": "/api/corrections/chained",
        },
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "surveying-api"}
