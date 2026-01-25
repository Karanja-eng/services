# ============================================================================
# FILE: backend/gnss/router.py
# ============================================================================
"""
FastAPI router for GNSS endpoints.
All endpoints follow RESTful conventions and return Pydantic-validated responses.
"""

from fastapi import APIRouter, HTTPException, status
from typing import Dict
from .schemas import (
    BaselineRequest, BaselineResponse,
    UTMConversionRequest, UTMCoordinates,
    GeoidRequest, GeoidResponse,
    RTKQualityRequest, RTKQualityResponse,
    HelmertTransformRequest, HelmertTransformResponse,
    NetworkAdjustmentRequest, NetworkAdjustmentResponse, StationCoordinate, AdjustedStation, NetworkBaseline,
    RINEXParseRequest, RINEXInfo,
    NTRIPConnectionRequest, NTRIPStatus
)
from .baseline_computation import compute_baseline, geodetic_to_ecef
from .latlon_to_utm import latlon_to_utm
from .geoid_undulation import ellipsoidal_to_orthometric
from .rtk_accuracy import analyze_rtk_quality
from .helmert import transform_datum, HELMERT_PARAMS, ecef_to_geodetic
from .baseline_adjustment import NetworkAdjustment, BaselineObservation
from .rinex_parser import RINEXParser
from .ntrip_client import NTRIPClient, NTRIPConfig
from .geoid_model import get_geoid_model
from .validation import (
    validate_latitude, validate_longitude, validate_height,
    GNSSValidationError
)
import numpy as np

router = APIRouter(prefix="/gnss", tags=["GNSS & Modern Surveying"])

# --- BASELINE COMPUTATION ---

@router.post("/baselines/compute", response_model=BaselineResponse, status_code=status.HTTP_200_OK)
async def compute_gnss_baseline(request: BaselineRequest):
    """
    Compute GNSS baseline vector between two stations.
    """
    try:
        validate_latitude(request.station1.lat)
        validate_longitude(request.station1.lon)
        validate_height(request.station1.h)
        validate_latitude(request.station2.lat)
        validate_longitude(request.station2.lon)
        validate_height(request.station2.h)
        
        result = compute_baseline(request.station1, request.station2)
        return BaselineResponse(**result)
    except GNSSValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- UTM CONVERSION ---

@router.post("/utm/latlon-to-utm", response_model=UTMCoordinates, status_code=status.HTTP_200_OK)
async def convert_latlon_to_utm(request: UTMConversionRequest):
    """Convert geographic coordinates (lat/lon) to UTM projection."""
    try:
        validate_latitude(request.lat)
        validate_longitude(request.lon)
        result = latlon_to_utm(request.lat, request.lon, request.force_zone)
        return UTMCoordinates(**result)
    except GNSSValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- GEOID UNDULATION ---

@router.post("/geoid/undulation", response_model=GeoidResponse, status_code=status.HTTP_200_OK)
async def apply_geoid_correction(request: GeoidRequest):
    """Convert ellipsoidal height to orthometric height using simplified or specified model."""
    try:
        validate_latitude(request.lat)
        validate_longitude(request.lon)
        result = ellipsoidal_to_orthometric(
            request.lat, request.lon, request.ellipsoidal_height, request.geoid_model
        )
        return GeoidResponse(**result)
    except GNSSValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/geoid/undulation-egm2008", response_model=GeoidResponse, status_code=status.HTTP_200_OK)
async def apply_geoid_correction_egm2008(request: GeoidRequest):
    """Convert ellipsoidal height to orthometric height using EGM2008 model."""
    try:
        validate_latitude(request.lat)
        validate_longitude(request.lon)
        
        geoid = get_geoid_model()
        undulation = geoid.get_undulation(request.lat, request.lon)
        orthometric_height = request.ellipsoidal_height - undulation
        
        return GeoidResponse(
            undulation=undulation,
            orthometric_height=orthometric_height,
            ellipsoidal_height=request.ellipsoidal_height,
            model_used="EGM2008",
            accuracy_estimate=0.2
        )
    except GNSSValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- RTK ACCURACY ---

@router.post("/rtk/accuracy", response_model=RTKQualityResponse, status_code=status.HTTP_200_OK)
async def assess_rtk_quality(request: RTKQualityRequest):
    """Analyze RTK solution quality."""
    try:
        result = analyze_rtk_quality(
            baseline_length=request.baseline_length,
            solution_type=request.solution_type.value,
            pdop=request.pdop,
            num_satellites=request.num_satellites,
            hdop=request.hdop,
            vdop=request.vdop,
            ambiguity_ratio=request.ambiguity_ratio
        )
        return RTKQualityResponse(**result)
    except GNSSValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- HELMERT TRANSFORMATION ---

@router.post("/transformations/helmert", response_model=HelmertTransformResponse)
async def apply_helmert_transformation(request: HelmertTransformRequest):
    """Apply Helmert 7-parameter datum transformation."""
    try:
        validate_latitude(request.station.lat)
        validate_longitude(request.station.lon)
        validate_height(request.station.h)
        
        transformed = transform_datum(request.station, request.from_datum, request.to_datum)
        
        transform_key = f"{request.from_datum}_to_{request.to_datum}"
        params = HELMERT_PARAMS[transform_key]
        
        params_dict = {
            "tx": params.tx, "ty": params.ty, "tz": params.tz,
            "rx": params.rx, "ry": params.ry, "rz": params.rz,
            "ds": params.ds
        }
        
        return HelmertTransformResponse(
            transformed_station=transformed,
            from_datum=request.from_datum,
            to_datum=request.to_datum,
            parameters=params_dict,
            transformation_accuracy=0.05
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- NETWORK ADJUSTMENT ---

@router.post("/network/adjust", response_model=NetworkAdjustmentResponse)
async def adjust_network(request: NetworkAdjustmentRequest):
    """Perform least squares network adjustment."""
    try:
        network = NetworkAdjustment()
        
        # Add stations
        for station in request.stations:
            x, y, z = geodetic_to_ecef(
                station.coordinate.lat,
                station.coordinate.lon,
                station.coordinate.h
            )
            network.add_station(station.station_id, x, y, z, fixed=station.is_fixed)
        
        # Add baselines
        for baseline in request.baselines:
            obs = BaselineObservation(
                from_station=baseline.from_station,
                to_station=baseline.to_station,
                dx=baseline.dx, dy=baseline.dy, dz=baseline.dz,
                sigma_x=baseline.sigma_x, sigma_y=baseline.sigma_y, sigma_z=baseline.sigma_z
            )
            network.add_baseline(obs)
        
        result = network.adjust(
            max_iterations=request.max_iterations,
            convergence=request.convergence_threshold
        )
        
        # Convert adjusted coordinates back to geodetic
        adjusted_stations = []
        for station_id, ecef_coords in result["adjusted_coordinates"].items():
            lat, lon, h = ecef_to_geodetic(ecef_coords[0], ecef_coords[1], ecef_coords[2])
            std = result["coordinate_std"][station_id]
            
            adjusted_stations.append(AdjustedStation(
                station_id=station_id,
                coordinate=StationCoordinate(lat=lat, lon=lon, h=h),
                std_x=float(std[0]),
                std_y=float(std[1]),
                std_z=float(std[2])
            ))
        
        chi_squared = 0.0
        if "residuals" in result and len(result["residuals"]) > 0:
            chi_squared = float(np.sum(result["residuals"]**2))
        
        residual_norms = {}
        residuals = result["residuals"]
        for i, baseline in enumerate(request.baselines):
            start_idx = i * 3
            if start_idx + 3 <= len(residuals):
                norm = float(np.linalg.norm(residuals[start_idx:start_idx+3]))
                residual_norms[f"{baseline.from_station}-{baseline.to_station}"] = norm
        
        return NetworkAdjustmentResponse(
            adjusted_stations=adjusted_stations,
            sigma_0=float(result["sigma_0"]),
            iterations=result["iterations"],
            degrees_of_freedom=result["degrees_of_freedom"],
            chi_squared=chi_squared,
            residual_norms=residual_norms
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- RINEX PARSING ---

@router.post("/rinex/parse", response_model=RINEXInfo)
async def parse_rinex_file(request: RINEXParseRequest):
    """Parse RINEX observation file."""
    try:
        parser = RINEXParser(request.file_path)
        result = parser.parse()
        
        return RINEXInfo(
            version=result["header"].version,
            marker_name=result["header"].marker_name,
            receiver_type=result["header"].receiver_type,
            antenna_type=result["header"].antenna_type,
            approx_position=result["header"].approx_position,
            observation_types=result["header"].observation_types,
            first_obs=result["header"].first_obs.isoformat(),
            num_epochs=result["num_epochs"],
            duration_seconds=result["duration_seconds"]
        )
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RINEX file not found")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"RINEX parsing failed: {str(e)}")

# --- NTRIP ---

_ntrip_clients: Dict[str, NTRIPClient] = {}

@router.post("/ntrip/connect", response_model=NTRIPStatus)
async def connect_ntrip(request: NTRIPConnectionRequest):
    """Connect to NTRIP caster for real-time corrections."""
    try:
        config = NTRIPConfig(
            host=request.host,
            port=request.port,
            mountpoint=request.mountpoint,
            username=request.username,
            password=request.password
        )
        
        client = NTRIPClient(config)
        
        if not client.connect():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to connect to NTRIP caster"
            )
        
        client_id = f"{request.host}:{request.mountpoint}"
        _ntrip_clients[client_id] = client
        
        def rtcm_callback(data: bytes):
            # Process RTCM message (placeholder)
            pass
        
        client.start_stream(rtcm_callback)
        
        if request.send_gga and request.gga_position:
            # Generate GGA sentence logic here (simplified)
            pass
        
        return NTRIPStatus(
            connected=True,
            streaming=True,
            mountpoint=request.mountpoint,
            bytes_received=0,
            messages_received=0,
            last_message_time=None
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "module": "gnss",
        "version": "1.0.0"
    }
