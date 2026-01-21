# ==============================================================================
# DEFORMATION & MONITORING SURVEY MODULE - BACKEND
# ==============================================================================
# CRITICAL SAFETY SYSTEM - Legal-grade structural monitoring
# This module may be used to stop construction, trigger claims, or protect lives
# ==============================================================================

# ------------------------------------------------------------------------------
# FILE: backend/monitoring/constants.py
# ------------------------------------------------------------------------------
"""
Physical constants and engineering tolerance standards.
All values are explicitly documented with units and references.
"""

from enum import Enum
from typing import Dict

class StructureType(str, Enum):
    """Standard structure classifications for tolerance criteria"""
    HIGH_RISE = "high_rise"
    BRIDGE = "bridge"
    DAM = "dam"
    EXCAVATION = "excavation"
    TUNNEL = "tunnel"

class ConfidenceLevel(float, Enum):
    """Statistical confidence levels (probability)"""
    CL_90 = 0.90  # k = 1.645
    CL_95 = 0.95  # k = 1.960
    CL_99 = 0.99  # k = 2.576

# Critical values for confidence levels (two-tailed)
CRITICAL_VALUES: Dict[ConfidenceLevel, float] = {
    ConfidenceLevel.CL_90: 1.645,
    ConfidenceLevel.CL_95: 1.960,
    ConfidenceLevel.CL_99: 2.576,
}

# Default engineering tolerances (mm) by structure type
# Reference: ISO 4463, Eurocode standards
DEFAULT_TOLERANCES = {
    StructureType.HIGH_RISE: {"warning": 10.0, "critical": 25.0},
    StructureType.BRIDGE: {"warning": 15.0, "critical": 40.0},
    StructureType.DAM: {"warning": 5.0, "critical": 15.0},
    StructureType.EXCAVATION: {"warning": 20.0, "critical": 50.0},
    StructureType.TUNNEL: {"warning": 10.0, "critical": 30.0},
}

# Unit conversion factors
MM_PER_M = 1000.0
DEG_PER_RAD = 57.29577951308232  # 180/π
RAD_PER_DEG = 0.017453292519943295  # π/180


# ------------------------------------------------------------------------------
# FILE: backend/monitoring/schemas.py
# ------------------------------------------------------------------------------
"""
Pydantic schemas with explicit unit handling and type safety.
All coordinate and measurement schemas enforce unit metadata.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum

class UnitSystem(str, Enum):
    """Supported coordinate unit systems"""
    METERS = "m"
    MILLIMETERS = "mm"

class CoordinatePoint(BaseModel):
    """Single coordinate observation with uncertainty"""
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    z: float = Field(..., description="Z coordinate (elevation)")
    std_dev: float = Field(..., gt=0, description="Standard deviation (same units as coordinates)")
    timestamp: Optional[datetime] = Field(None, description="Observation timestamp")
    units: UnitSystem = Field(UnitSystem.METERS, description="Coordinate units")
    
    @field_validator('std_dev')
    @classmethod
    def validate_positive_error(cls, v):
        if v <= 0:
            raise ValueError("Standard deviation must be positive")
        return v

class EpochData(BaseModel):
    """Complete survey epoch with metadata"""
    epoch_id: str = Field(..., description="Unique epoch identifier")
    timestamp: datetime = Field(..., description="Survey date/time")
    points: List[dict] = Field(..., description="List of point observations")
    datum: str = Field("WGS84", description="Coordinate reference system")
    units: UnitSystem = Field(UnitSystem.METERS)
    surveyor: Optional[str] = None
    instrument_type: Optional[str] = None
    weather_conditions: Optional[str] = None

class SettlementRequest(BaseModel):
    """Request schema for settlement calculation"""
    point_id: str
    reference_z: float = Field(..., description="Reference elevation")
    current_z: float = Field(..., description="Current elevation")
    reference_std_dev: float = Field(..., gt=0)
    current_std_dev: float = Field(..., gt=0)
    time_interval_days: Optional[float] = Field(None, gt=0)
    units: UnitSystem = Field(UnitSystem.METERS)
    confidence_level: ConfidenceLevel = Field(ConfidenceLevel.CL_95)

class SettlementResponse(BaseModel):
    """Response schema for settlement calculation"""
    point_id: str
    settlement_mm: float = Field(..., description="Vertical displacement (negative = settlement)")
    settlement_rate_mm_per_day: Optional[float] = None
    propagated_error_mm: float
    is_significant: bool = Field(..., description="Statistically significant at requested confidence level")
    confidence_level: float
    test_statistic: float = Field(..., description="t-value for hypothesis test")
    minimum_detectable_movement_mm: float

class DisplacementRequest(BaseModel):
    """Request schema for 3D displacement calculation"""
    point_id: str
    reference: CoordinatePoint
    current: CoordinatePoint
    
    @field_validator('current')
    @classmethod
    def validate_same_units(cls, v, info):
        if 'reference' in info.data and v.units != info.data['reference'].units:
            raise ValueError("Reference and current coordinates must have same units")
        return v

class DisplacementResponse(BaseModel):
    """Response schema for 3D displacement"""
    point_id: str
    displacement_3d_mm: float = Field(..., description="Total 3D displacement magnitude")
    horizontal_mm: float = Field(..., description="Horizontal component")
    vertical_mm: float = Field(..., description="Vertical component")
    delta_x_mm: float
    delta_y_mm: float
    delta_z_mm: float
    azimuth_deg: float = Field(..., description="Direction of horizontal movement (0-360)")
    propagated_error_mm: float
    is_significant: bool
    confidence_level: float

class TiltRequest(BaseModel):
    """Request schema for tilt calculation between two points"""
    point_a_id: str
    point_b_id: str
    point_a_z_ref: float
    point_a_z_curr: float
    point_b_z_ref: float
    point_b_z_curr: float
    horizontal_distance_m: float = Field(..., gt=0)
    std_dev_z: float = Field(0.002, gt=0, description="Vertical standard deviation (m)")

class TiltResponse(BaseModel):
    """Response schema for tilt calculation"""
    tilt_radians: float
    tilt_degrees: float
    tilt_direction: str
    differential_settlement_mm: float
    angular_rate_rad_per_m: float


# ------------------------------------------------------------------------------
# FILE: backend/monitoring/statistics/error_propagation.py
# ------------------------------------------------------------------------------
"""
Error propagation calculations following variance-covariance law.
All formulas are documented with mathematical basis.
"""

import math
from typing import Tuple

def propagate_difference_error(std_dev_1: float, std_dev_2: float, 
                               correlation: float = 0.0) -> float:
    """
    Propagate error for difference of two measurements.
    
    Formula: σ_diff = √(σ₁² + σ₂² - 2ρσ₁σ₂)
    
    For uncorrelated measurements (ρ=0): σ_diff = √(σ₁² + σ₂²)
    
    Args:
        std_dev_1: Standard deviation of first measurement
        std_dev_2: Standard deviation of second measurement
        correlation: Correlation coefficient (-1 to 1), default 0 (uncorrelated)
    
    Returns:
        Propagated standard deviation of the difference
    
    Reference: ISO/TS 23165:2021 - Uncertainty of measurement
    """
    if not (-1.0 <= correlation <= 1.0):
        raise ValueError(f"Correlation must be between -1 and 1, got {correlation}")
    
    variance = (std_dev_1**2 + std_dev_2**2 - 
                2 * correlation * std_dev_1 * std_dev_2)
    
    if variance < 0:
        raise ValueError(f"Negative variance computed: {variance}. Check input parameters.")
    
    return math.sqrt(variance)

def propagate_3d_displacement_error(std_dev_x: float, std_dev_y: float, 
                                    std_dev_z: float) -> Tuple[float, float, float]:
    """
    Propagate errors for 3D displacement calculation.
    
    Assumes uncorrelated component errors.
    
    Returns:
        (horizontal_error, vertical_error, total_3d_error)
    
    Formulas:
        σ_horizontal = √(σ_x² + σ_y²)
        σ_vertical = σ_z
        σ_3d = √(σ_x² + σ_y² + σ_z²)
    """
    horizontal_error = math.sqrt(std_dev_x**2 + std_dev_y**2)
    vertical_error = std_dev_z
    total_3d_error = math.sqrt(std_dev_x**2 + std_dev_y**2 + std_dev_z**2)
    
    return horizontal_error, vertical_error, total_3d_error

def minimum_detectable_movement(std_dev: float, confidence_level: ConfidenceLevel) -> float:
    """
    Calculate minimum detectable movement at given confidence level.
    
    MDM = k × σ
    
    where k is the critical value for the confidence level.
    
    Args:
        std_dev: Propagated standard deviation
        confidence_level: Desired confidence level (90%, 95%, or 99%)
    
    Returns:
        Minimum detectable movement at specified confidence
    """
    k = CRITICAL_VALUES[confidence_level]
    return k * std_dev


# ------------------------------------------------------------------------------
# FILE: backend/monitoring/statistics/significance.py
# ------------------------------------------------------------------------------
"""
Statistical hypothesis testing for movement significance.
Implements standard surveying significance tests.
"""

import math
from typing import Tuple

def test_movement_significance(displacement: float, propagated_error: float,
                              confidence_level: ConfidenceLevel) -> Tuple[bool, float]:
    """
    Test if measured displacement is statistically significant.
    
    Null Hypothesis H₀: No movement (Δ = 0)
    Alternative H₁: Significant movement (Δ ≠ 0)
    
    Test statistic: t = |Δ| / σ_Δ
    
    Reject H₀ if t > critical value
    
    Args:
        displacement: Measured displacement (any units)
        propagated_error: Propagated standard deviation (same units)
        confidence_level: Statistical confidence level
    
    Returns:
        (is_significant, test_statistic)
    """
    if propagated_error <= 0:
        raise ValueError(f"Propagated error must be positive, got {propagated_error}")
    
    test_statistic = abs(displacement) / propagated_error
    critical_value = CRITICAL_VALUES[confidence_level]
    
    is_significant = test_statistic > critical_value
    
    return is_significant, test_statistic

def confidence_interval(displacement: float, std_dev: float, 
                       confidence_level: ConfidenceLevel) -> Tuple[float, float]:
    """
    Calculate confidence interval for displacement.
    
    CI = Δ ± k×σ
    
    Returns:
        (lower_bound, upper_bound)
    """
    k = CRITICAL_VALUES[confidence_level]
    margin = k * std_dev
    
    return (displacement - margin, displacement + margin)


# ------------------------------------------------------------------------------
# FILE: backend/monitoring/deformation/settlement.py
# ------------------------------------------------------------------------------
"""
Settlement analysis calculations.
Vertical displacement with time-normalization and rate calculations.
"""

from typing import Optional

def calculate_settlement(reference_z: float, current_z: float, units: UnitSystem) -> float:
    """
    Calculate vertical settlement.
    
    Settlement = Z_current - Z_reference
    
    Convention: Negative values indicate settlement (downward movement)
    
    Args:
        reference_z: Reference elevation
        current_z: Current elevation
        units: Input units (converted to mm for output)
    
    Returns:
        Settlement in millimeters (negative = settlement)
    """
    delta_z = current_z - reference_z
    
    # Convert to mm
    if units == UnitSystem.METERS:
        delta_z_mm = delta_z * MM_PER_M
    else:
        delta_z_mm = delta_z
    
    return delta_z_mm

def calculate_settlement_rate(settlement_mm: float, time_interval_days: float) -> Optional[float]:
    """
    Calculate time-normalized settlement rate.
    
    Rate = Settlement / Time
    
    Args:
        settlement_mm: Total settlement in mm
        time_interval_days: Time between epochs in days
    
    Returns:
        Settlement rate in mm/day, or None if time interval not provided
    """
    if time_interval_days is None or time_interval_days <= 0:
        return None
    
    return settlement_mm / time_interval_days

def differential_settlement(settlement_a_mm: float, settlement_b_mm: float) -> float:
    """
    Calculate differential settlement between two points.
    
    Differential = Settlement_A - Settlement_B
    
    Args:
        settlement_a_mm: Settlement at point A (mm)
        settlement_b_mm: Settlement at point B (mm)
    
    Returns:
        Differential settlement (mm)
    """
    return settlement_a_mm - settlement_b_mm


# ------------------------------------------------------------------------------
# FILE: backend/monitoring/deformation/displacement.py
# ------------------------------------------------------------------------------
"""
3D displacement vector calculations.
Component-wise and resultant displacement with direction analysis.
"""

import math
from typing import Tuple

def calculate_3d_displacement(ref_x: float, ref_y: float, ref_z: float,
                             curr_x: float, curr_y: float, curr_z: float,
                             units: UnitSystem) -> Tuple[float, float, float, float, float, float]:
    """
    Calculate 3D displacement components and resultant.
    
    Returns:
        (delta_x_mm, delta_y_mm, delta_z_mm, horizontal_mm, vertical_mm, total_3d_mm)
    """
    # Calculate deltas
    delta_x = curr_x - ref_x
    delta_y = curr_y - ref_y
    delta_z = curr_z - ref_z
    
    # Convert to mm
    conversion = MM_PER_M if units == UnitSystem.METERS else 1.0
    delta_x_mm = delta_x * conversion
    delta_y_mm = delta_y * conversion
    delta_z_mm = delta_z * conversion
    
    # Calculate components
    horizontal_mm = math.sqrt(delta_x_mm**2 + delta_y_mm**2)
    vertical_mm = delta_z_mm
    total_3d_mm = math.sqrt(delta_x_mm**2 + delta_y_mm**2 + delta_z_mm**2)
    
    return delta_x_mm, delta_y_mm, delta_z_mm, horizontal_mm, vertical_mm, total_3d_mm

def calculate_azimuth(delta_x: float, delta_y: float) -> float:
    """
    Calculate azimuth of horizontal displacement.
    
    Azimuth convention: 0° = North, 90° = East, 180° = South, 270° = West
    
    Args:
        delta_x: X component (Easting)
        delta_y: Y component (Northing)
    
    Returns:
        Azimuth in degrees (0-360)
    """
    azimuth_rad = math.atan2(delta_x, delta_y)  # Note: atan2(x, y) for North=0 convention
    azimuth_deg = azimuth_rad * DEG_PER_RAD
    
    # Normalize to 0-360
    if azimuth_deg < 0:
        azimuth_deg += 360.0
    
    return azimuth_deg

def direction_cosines(delta_x: float, delta_y: float, delta_z: float) -> Tuple[float, float, float]:
    """
    Calculate direction cosines of displacement vector.
    
    Returns:
        (cos_x, cos_y, cos_z) - normalized components
    """
    magnitude = math.sqrt(delta_x**2 + delta_y**2 + delta_z**2)
    
    if magnitude == 0:
        return (0.0, 0.0, 0.0)
    
    return (delta_x/magnitude, delta_y/magnitude, delta_z/magnitude)


# ------------------------------------------------------------------------------
# FILE: backend/monitoring/deformation/tilt.py
# ------------------------------------------------------------------------------
"""
Tilt and angular rotation calculations.
Measures relative rotation between points.
"""

import math

def calculate_tilt(delta_z_m: float, horizontal_distance_m: float) -> Tuple[float, float]:
    """
    Calculate tilt angle from differential settlement.
    
    θ = arctan(ΔZ / d)
    
    Args:
        delta_z_m: Differential elevation change (meters)
        horizontal_distance_m: Horizontal distance between points (meters)
    
    Returns:
        (tilt_radians, tilt_degrees)
    """
    if horizontal_distance_m <= 0:
        raise ValueError(f"Horizontal distance must be positive, got {horizontal_distance_m}")
    
    tilt_rad = math.atan(delta_z_m / horizontal_distance_m)
    tilt_deg = tilt_rad * DEG_PER_RAD
    
    return tilt_rad, tilt_deg

def tilt_rate(tilt_rad: float, distance_m: float) -> float:
    """
    Calculate angular rate (radians per meter).
    
    Useful for comparing tilt across different spans.
    
    Returns:
        Radians per meter
    """
    return tilt_rad / distance_m


# ------------------------------------------------------------------------------
# FILE: backend/monitoring/router.py
# ------------------------------------------------------------------------------
"""
FastAPI router for deformation monitoring endpoints.
All endpoints return deterministic, type-safe results.
"""

from fastapi import APIRouter, HTTPException
from typing import List

# Import all calculation modules - Already defined in this file
# from .schemas import *
# from .constants import *
# from .statistics.error_propagation import *
# from .statistics.significance import *
# from .deformation.settlement import *
# from .deformation.displacement import *
# from .deformation.tilt import *

router = APIRouter(tags=["Deformation & Monitoring"])

@router.post("/settlement", response_model=SettlementResponse)
async def calculate_settlement_endpoint(request: SettlementRequest):
    """
    Calculate vertical settlement between epochs.
    
    Performs:
    - Settlement calculation (ΔZ)
    - Error propagation
    - Statistical significance testing
    - Settlement rate (if time interval provided)
    """
    try:
        # Calculate settlement
        settlement_mm = calculate_settlement(
            request.reference_z,
            request.current_z,
            request.units
        )
        
        # Propagate error
        propagated_error = propagate_difference_error(
            request.reference_std_dev,
            request.current_std_dev
        )
        
        # Convert error to mm
        if request.units == UnitSystem.METERS:
            propagated_error_mm = propagated_error * MM_PER_M
        else:
            propagated_error_mm = propagated_error
        
        # Test significance
        is_significant, test_stat = test_movement_significance(
            settlement_mm,
            propagated_error_mm,
            request.confidence_level
        )
        
        # Calculate MDM
        mdm = minimum_detectable_movement(propagated_error_mm, request.confidence_level)
        
        # Calculate rate if time provided
        rate = None
        if request.time_interval_days is not None:
            rate = calculate_settlement_rate(settlement_mm, request.time_interval_days)
        
        return SettlementResponse(
            point_id=request.point_id,
            settlement_mm=round(settlement_mm, 3),
            settlement_rate_mm_per_day=round(rate, 4) if rate else None,
            propagated_error_mm=round(propagated_error_mm, 3),
            is_significant=is_significant,
            confidence_level=request.confidence_level.value,
            test_statistic=round(test_stat, 2),
            minimum_detectable_movement_mm=round(mdm, 3)
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Settlement calculation failed: {str(e)}")


@router.post("/displacement", response_model=DisplacementResponse)
async def calculate_displacement_endpoint(request: DisplacementRequest):
    """
    Calculate 3D displacement vector between epochs.
    
    Performs:
    - Component displacement (ΔX, ΔY, ΔZ)
    - Resultant magnitude
    - Azimuth calculation
    - Error propagation
    - Significance testing
    """
    try:
        # Calculate 3D displacement
        dx, dy, dz, horiz, vert, total_3d = calculate_3d_displacement(
            request.reference.x, request.reference.y, request.reference.z,
            request.current.x, request.current.y, request.current.z,
            request.reference.units
        )
        
        # Propagate errors
        horiz_err, vert_err, total_err = propagate_3d_displacement_error(
            request.reference.std_dev,
            request.reference.std_dev,  # Assuming isotropic
            request.reference.std_dev
        )
        
        # Convert error to mm
        conversion = MM_PER_M if request.reference.units == UnitSystem.METERS else 1.0
        total_err_mm = total_err * conversion
        
        # Test significance
        is_significant, _ = test_movement_significance(
            total_3d,
            total_err_mm,
            ConfidenceLevel.CL_95
        )
        
        # Calculate azimuth
        azimuth = calculate_azimuth(dx, dy)
        
        return DisplacementResponse(
            point_id=request.point_id,
            displacement_3d_mm=round(total_3d, 2),
            horizontal_mm=round(horiz, 2),
            vertical_mm=round(vert, 2),
            delta_x_mm=round(dx, 2),
            delta_y_mm=round(dy, 2),
            delta_z_mm=round(dz, 2),
            azimuth_deg=round(azimuth, 1),
            propagated_error_mm=round(total_err_mm, 2),
            is_significant=is_significant,
            confidence_level=0.95
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Displacement calculation failed: {str(e)}")


@router.post("/tilt", response_model=TiltResponse)
async def calculate_tilt_endpoint(request: TiltRequest):
    """
    Calculate tilt between two points.
    
    Measures angular rotation from differential settlement.
    """
    try:
        # Calculate differential settlement
        delta_ref = request.point_a_z_ref - request.point_b_z_ref
        delta_curr = request.point_a_z_curr - request.point_b_z_curr
        diff_settlement = delta_curr - delta_ref
        diff_settlement_mm = diff_settlement * MM_PER_M
        
        # Calculate tilt
        tilt_rad, tilt_deg = calculate_tilt(diff_settlement, request.horizontal_distance_m)
        
        # Angular rate
        ang_rate = tilt_rate(tilt_rad, request.horizontal_distance_m)
        
        # Determine direction
        if diff_settlement > 0:
            direction = f"{request.point_a_id} rising relative to {request.point_b_id}"
        elif diff_settlement < 0:
            direction = f"{request.point_a_id} settling relative to {request.point_b_id}"
        else:
            direction = "No differential movement"
        
        return TiltResponse(
            tilt_radians=round(tilt_rad, 6),
            tilt_degrees=round(tilt_deg, 4),
            tilt_direction=direction,
            differential_settlement_mm=round(diff_settlement_mm, 2),
            angular_rate_rad_per_m=round(ang_rate, 6)
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Tilt calculation failed: {str(e)}")


# ==============================================================================
# END OF MONITORING MODULE BACKEND
# ==============================================================================
# 
# Additional endpoints to implement:
# - /epoch/compare - Multi-point epoch comparison
# - /epoch/time-series - Temporal trend analysis
# - /tolerance/check - Engineering tolerance validation
# - /alerts/trends - Acceleration detection
