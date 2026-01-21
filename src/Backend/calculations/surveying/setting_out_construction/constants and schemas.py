# backend/surveying/constants.py
"""
Civil Engineering Constants
All units in SI (meters, radians) unless explicitly stated
"""
import math

# Mathematical constants
PI = math.pi
TWO_PI = 2 * PI
HALF_PI = PI / 2

# Conversion factors
DEG_TO_RAD = PI / 180.0
RAD_TO_DEG = 180.0 / PI
GRAD_TO_RAD = PI / 200.0
RAD_TO_GRAD = 200.0 / PI

# Precision thresholds
COORDINATE_PRECISION = 0.001  # 1mm precision
ANGLE_PRECISION = 0.0001  # radians
CHAINAGE_PRECISION = 0.01  # 10mm

# Default values
DEFAULT_CURVE_INTERVAL = 20.0  # meters
DEFAULT_PEG_SPACING = 20.0  # meters
MINIMUM_CURVE_RADIUS = 15.0  # meters (urban design minimum)

# Superelevation rates (dimensionless)
MAX_SUPERELEVATION_RATE = 0.08  # 8% maximum
NORMAL_CROWN_SLOPE = 0.02  # 2% standard crown

# Widening coefficients
MECHANICAL_WIDENING_FACTOR = 1.0  # adjustment factor
PSYCHOLOGICAL_WIDENING_MIN_SPEED = 60.0  # km/h


# backend/surveying/schemas.py
"""
Pydantic schemas for surveying API requests/responses
"""
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal
from enum import Enum

class CurveType(str, Enum):
    SIMPLE = "simple"
    COMPOUND = "compound"
    REVERSE = "reverse"

class VerticalCurveType(str, Enum):
    CREST = "crest"
    SAG = "sag"

# ============ COORDINATE SCHEMAS ============

class Point2D(BaseModel):
    x: float = Field(..., description="X coordinate (meters)")
    y: float = Field(..., description="Y coordinate (meters)")

class Point3D(BaseModel):
    x: float = Field(..., description="X coordinate (meters)")
    y: float = Field(..., description="Y coordinate (meters)")
    z: float = Field(..., description="Z coordinate / RL (meters)")

class TransformationParams(BaseModel):
    translation_x: float = Field(0.0, description="X translation (meters)")
    translation_y: float = Field(0.0, description="Y translation (meters)")
    rotation_angle: float = Field(0.0, description="Rotation angle (degrees)")
    scale_factor: float = Field(1.0, description="Scale factor")

class CoordinateTransformRequest(BaseModel):
    points: List[Point2D]
    transformation: TransformationParams

class CoordinateTransformResponse(BaseModel):
    original_points: List[Point2D]
    transformed_points: List[Point2D]
    transformation: TransformationParams

# ============ OFFSET SCHEMAS ============

class OffsetRequest(BaseModel):
    baseline_start: Point2D
    baseline_end: Point2D
    chainage: float = Field(..., ge=0, description="Chainage along baseline (meters)")
    offset_distance: float = Field(..., description="Offset distance (meters, +ve right)")

class OffsetResponse(BaseModel):
    chainage: float
    offset_distance: float
    offset_point: Point2D
    bearing: float = Field(..., description="Bearing at offset point (degrees)")

# ============ HORIZONTAL CURVE SCHEMAS ============

class HorizontalCurveRequest(BaseModel):
    radius: float = Field(..., gt=0, description="Curve radius (meters)")
    intersection_angle: float = Field(..., description="Deflection angle (degrees)")
    chainage_ip: float = Field(..., ge=0, description="Chainage at intersection point")
    
    @validator('radius')
    def validate_radius(cls, v):
        if v < 15.0:
            raise ValueError("Radius must be >= 15m for safety")
        return v

class HorizontalCurveResponse(BaseModel):
    radius: float
    intersection_angle_deg: float
    tangent_length: float = Field(..., description="Tangent length T (meters)")
    curve_length: float = Field(..., description="Curve length L (meters)")
    external_distance: float = Field(..., description="External distance E (meters)")
    middle_ordinate: float = Field(..., description="Middle ordinate M (meters)")
    long_chord: float = Field(..., description="Long chord C (meters)")
    chainage_tc: float = Field(..., description="Chainage at tangent to curve")
    chainage_ct: float = Field(..., description="Chainage at curve to tangent")

# ============ VERTICAL CURVE SCHEMAS ============

class VerticalCurveRequest(BaseModel):
    grade_in: float = Field(..., description="Incoming grade (percentage)")
    grade_out: float = Field(..., description="Outgoing grade (percentage)")
    curve_length: float = Field(..., gt=0, description="Curve length (meters)")
    chainage_vip: float = Field(..., ge=0, description="Chainage at VIP")
    rl_vip: float = Field(..., description="RL at VIP (meters)")

class VerticalCurveResponse(BaseModel):
    curve_type: VerticalCurveType
    grade_in: float
    grade_out: float
    curve_length: float
    rate_of_change: float = Field(..., description="K value (L/A)")
    chainage_start: float
    chainage_end: float
    rl_start: float
    rl_end: float
    rl_vip: float
    elevation_change: float

class ChainageRLRequest(BaseModel):
    chainage: float = Field(..., ge=0)
    vertical_curve: VerticalCurveRequest

class ChainageRLResponse(BaseModel):
    chainage: float
    rl: float = Field(..., description="Reduced level at chainage (meters)")
    grade_at_point: float = Field(..., description="Grade at point (percentage)")

# ============ DEFLECTION ANGLE SCHEMAS ============

class DeflectionTableRequest(BaseModel):
    radius: float = Field(..., gt=0)
    curve_length: float = Field(..., gt=0)
    peg_interval: float = Field(20.0, gt=0, description="Peg spacing (meters)")
    chainage_tc: float = Field(..., ge=0)

class DeflectionAngle(BaseModel):
    chainage: float
    distance_from_tc: float
    deflection_angle: float = Field(..., description="Deflection angle (degrees)")
    total_deflection: float = Field(..., description="Total deflection (degrees)")
    chord_length: float

class DeflectionTableResponse(BaseModel):
    radius: float
    curve_length: float
    peg_interval: float
    deflections: List[DeflectionAngle]

# ============ SUPERELEVATION SCHEMAS ============

class SuperelevationRequest(BaseModel):
    design_speed: float = Field(..., gt=0, description="Design speed (km/h)")
    radius: float = Field(..., gt=0, description="Curve radius (meters)")
    lane_width: float = Field(3.5, gt=0, description="Lane width (meters)")
    runoff_length: Optional[float] = Field(None, description="Custom runoff length")

class SuperelevationResponse(BaseModel):
    design_speed: float
    radius: float
    superelevation_rate: float = Field(..., description="Superelevation rate (decimal)")
    runoff_length: float = Field(..., description="Runoff length (meters)")
    rotation_axis: Literal["centerline", "inside_edge"] = "centerline"

# ============ WIDENING SCHEMAS ============

class WideningRequest(BaseModel):
    radius: float = Field(..., gt=0)
    design_speed: float = Field(..., gt=0, description="Design speed (km/h)")
    lane_width: float = Field(3.5, gt=0)
    number_of_lanes: int = Field(1, ge=1, le=4)

class WideningResponse(BaseModel):
    mechanical_widening: float = Field(..., description="Mechanical widening (meters)")
    psychological_widening: float = Field(..., description="Psychological widening (meters)")
    total_widening: float = Field(..., description="Total widening (meters)")

# ============ GRID SETTING OUT SCHEMAS ============

class GridRequest(BaseModel):
    origin: Point2D
    grid_spacing_x: float = Field(..., gt=0)
    grid_spacing_y: float = Field(..., gt=0)
    extent_x: float = Field(..., gt=0, description="Grid extent in X (meters)")
    extent_y: float = Field(..., gt=0, description="Grid extent in Y (meters)")
    rotation: float = Field(0.0, description="Grid rotation (degrees)")

class GridPoint(BaseModel):
    grid_id: str = Field(..., description="Grid reference (e.g., A1, B2)")
    point: Point2D

class GridResponse(BaseModel):
    origin: Point2D
    grid_points: List[GridPoint]
    total_points: int