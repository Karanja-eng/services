# ============================================================================
# FILE: backend/gnss/schemas.py
# ============================================================================


from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict
from enum import Enum

class CoordinateUnits(str, Enum):
    DEGREES = "degrees"
    RADIANS = "radians"
    METERS = "meters"

class SolutionType(str, Enum):
    FIXED = "fixed"
    FLOAT = "float"
    SINGLE = "single"

# ===== BASELINE COMPUTATION =====

class StationCoordinate(BaseModel):
    """Geographic coordinate of a GNSS station."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    lon: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")
    h: float = Field(..., description="Ellipsoidal height in meters")
    
    class Config:
        json_schema_extra = {
            "example": {
                "lat": 37.7749,
                "lon": -122.4194,
                "h": 10.0
            }
        }

class BaselineRequest(BaseModel):
    """Request for computing GNSS baseline between two stations."""
    station1: StationCoordinate = Field(..., description="Base station coordinates")
    station2: StationCoordinate = Field(..., description="Rover station coordinates")
    output_units: CoordinateUnits = Field(default=CoordinateUnits.METERS)

class ECEFComponents(BaseModel):
    """Baseline components in Earth-Centered Earth-Fixed frame."""
    dx: float = Field(..., description="X component (meters)")
    dy: float = Field(..., description="Y component (meters)")
    dz: float = Field(..., description="Z component (meters)")

class ENUComponents(BaseModel):
    """Baseline components in East-North-Up local frame."""
    dE: float = Field(..., description="East component (meters)")
    dN: float = Field(..., description="North component (meters)")
    dU: float = Field(..., description="Up component (meters)")

class BaselineResponse(BaseModel):
    """Computed baseline results."""
    length: float = Field(..., description="Total baseline length (meters)")
    horizontal_distance: float = Field(..., description="Horizontal component (meters)")
    vertical_distance: float = Field(..., description="Vertical component (meters)")
    azimuth: float = Field(..., ge=0, lt=360, description="Azimuth from station1 to station2 (degrees)")
    ecef: ECEFComponents
    enu: ENUComponents
    units: str = Field(default="meters")

# ===== UTM CONVERSION =====

class UTMConversionRequest(BaseModel):
    """Request for converting geographic coordinates to UTM."""
    lat: float = Field(..., ge=-80, le=84, description="Latitude in decimal degrees")
    lon: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")
    force_zone: Optional[int] = Field(None, ge=1, le=60, description="Force specific UTM zone")

class UTMCoordinates(BaseModel):
    """UTM coordinate results."""
    easting: float = Field(..., description="UTM easting (meters)")
    northing: float = Field(..., description="UTM northing (meters)")
    zone: int = Field(..., ge=1, le=60, description="UTM zone number")
    hemisphere: Literal["N", "S"] = Field(..., description="Northern or Southern hemisphere")
    convergence: float = Field(..., description="Grid convergence (degrees)")
    scale_factor: float = Field(..., description="Point scale factor")
    epsg_code: int = Field(..., description="EPSG code for this UTM zone")

# ===== GEOID UNDULATION =====

class GeoidRequest(BaseModel):
    """Request for geoid undulation correction."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    lon: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")
    ellipsoidal_height: float = Field(..., description="Height above ellipsoid (meters)")
    geoid_model: str = Field(default="EGM96", description="Geoid model to use")

class GeoidResponse(BaseModel):
    """Geoid undulation and corrected height."""
    undulation: float = Field(..., description="Geoid undulation N (meters)")
    orthometric_height: float = Field(..., description="Height above mean sea level (meters)")
    ellipsoidal_height: float = Field(..., description="Input ellipsoidal height (meters)")
    model_used: str = Field(..., description="Geoid model applied")
    accuracy_estimate: float = Field(..., description="Estimated accuracy (meters)")

# ===== RTK QUALITY ANALYSIS =====

class RTKQualityRequest(BaseModel):
    """Request for RTK solution quality analysis."""
    baseline_length: float = Field(..., gt=0, description="Baseline length (meters)")
    solution_type: SolutionType
    pdop: float = Field(..., gt=0, description="Position Dilution of Precision")
    hdop: Optional[float] = Field(None, gt=0, description="Horizontal DOP")
    vdop: Optional[float] = Field(None, gt=0, description="Vertical DOP")
    num_satellites: int = Field(..., ge=4, description="Number of satellites used")
    ambiguity_ratio: Optional[float] = Field(None, ge=1, description="Ambiguity resolution ratio")

class RTKQualityResponse(BaseModel):
    """RTK quality assessment results."""
    horizontal_accuracy_mm: float = Field(..., description="Expected horizontal accuracy (mm, 95% confidence)")
    vertical_accuracy_mm: float = Field(..., description="Expected vertical accuracy (mm, 95% confidence)")
    quality_classification: Literal["excellent", "good", "moderate", "fair", "poor"]
    pdop_assessment: str
    warnings: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    accuracy_breakdown: dict = Field(..., description="Component breakdown of accuracy")

# ===== HELMERT TRANSFORMATION =====

class HelmertTransformRequest(BaseModel):
    """Request for Helmert datum transformation."""
    station: StationCoordinate
    from_datum: str = Field(..., description="Source datum (e.g., 'WGS84')")
    to_datum: str = Field(..., description="Target datum (e.g., 'NAD83')")

class HelmertTransformResponse(BaseModel):
    """Transformed coordinates and parameters used."""
    transformed_station: StationCoordinate
    from_datum: str
    to_datum: str
    parameters: Dict[str, float]
    transformation_accuracy: float = Field(..., description="Estimated accuracy (meters)")

# ===== NETWORK ADJUSTMENT =====

class NetworkStation(BaseModel):
    """Station for network adjustment."""
    station_id: str
    coordinate: StationCoordinate
    is_fixed: bool = Field(default=False, description="Fixed control point")

class NetworkBaseline(BaseModel):
    """Baseline observation for network adjustment."""
    from_station: str
    to_station: str
    dx: float = Field(..., description="ECEF X component (meters)")
    dy: float = Field(..., description="ECEF Y component (meters)")
    dz: float = Field(..., description="ECEF Z component (meters)")
    sigma_x: float = Field(default=0.010, description="Standard deviation X (meters)")
    sigma_y: float = Field(default=0.010, description="Standard deviation Y (meters)")
    sigma_z: float = Field(default=0.015, description="Standard deviation Z (meters)")

class NetworkAdjustmentRequest(BaseModel):
    """Request for network adjustment."""
    stations: List[NetworkStation]
    baselines: List[NetworkBaseline]
    max_iterations: int = Field(default=10, ge=1, le=50)
    convergence_threshold: float = Field(default=0.001, description="Convergence threshold (meters)")

class AdjustedStation(BaseModel):
    """Adjusted station coordinates with statistics."""
    station_id: str
    coordinate: StationCoordinate
    std_x: float = Field(..., description="Standard deviation X (meters)")
    std_y: float = Field(..., description="Standard deviation Y (meters)")
    std_z: float = Field(..., description="Standard deviation Z (meters)")

class NetworkAdjustmentResponse(BaseModel):
    """Results of network adjustment."""
    adjusted_stations: List[AdjustedStation]
    sigma_0: float = Field(..., description="Standard deviation of unit weight")
    iterations: int
    degrees_of_freedom: int
    chi_squared: float = Field(..., description="Chi-squared statistic")
    residual_norms: Dict[str, float] = Field(..., description="Residual norms per baseline")

# ===== RINEX =====

class RINEXParseRequest(BaseModel):
    """Request to parse RINEX file."""
    file_path: str = Field(..., description="Path to RINEX file")
    extract_satellites: Optional[List[str]] = Field(None, description="Filter specific satellites (e.g., ['G01', 'G02'])")
    start_time: Optional[str] = Field(None, description="Start time filter (ISO format)")
    end_time: Optional[str] = Field(None, description="End time filter (ISO format)")

class RINEXInfo(BaseModel):
    """RINEX file information."""
    version: float
    marker_name: str
    receiver_type: str
    antenna_type: str
    approx_position: tuple
    observation_types: List[str]
    first_obs: str
    num_epochs: int
    duration_seconds: float

# ===== NTRIP =====

class NTRIPConnectionRequest(BaseModel):
    """Request to connect to NTRIP caster."""
    host: str = Field(..., description="NTRIP caster hostname")
    port: int = Field(default=2101, ge=1, le=65535)
    mountpoint: str = Field(..., description="Mountpoint name")
    username: str
    password: str
    send_gga: bool = Field(default=False, description="Send GGA for VRS")
    gga_position: Optional[StationCoordinate] = Field(None, description="Position for GGA")

class NTRIPStatus(BaseModel):
    """NTRIP connection status."""
    connected: bool
    streaming: bool
    mountpoint: str
    bytes_received: int
    messages_received: int
    last_message_time: Optional[str]
