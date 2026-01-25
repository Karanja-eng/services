from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np

# Import from local module
# Note: Since geoid_model.py is in the same directory, we use .geoid_model
from .geoid_model import get_geoid_model
from .helmert import transform_datum
from .baseline_adjustment import NetworkAdjustment, BaselineObservation

router = APIRouter(prefix="/geoid", tags=["Geoid & GNSS"])

# --- Schemas ---
class StationCoordinate(BaseModel):
    lat: float
    lon: float
    h: float

class UndulationRequest(BaseModel):
    lat: float
    lon: float

class TransformRequest(BaseModel):
    station: StationCoordinate
    from_datum: str
    to_datum: str

class BaselineData(BaseModel):
    from_station: str
    to_station: str
    dx: float
    dy: float
    dz: float
    sigma_x: float = 0.01
    sigma_y: float = 0.01
    sigma_z: float = 0.01

class NetworkRequest(BaseModel):
    stations: Dict[str, List[float]] # id -> [x, y, z] ECEF
    baselines: List[BaselineData]
    fixed_stations: List[str]

# --- Endpoints ---

@router.post("/undulation")
def calculate_undulation(req: UndulationRequest):
    """Get geoid undulation (N) for a given location."""
    try:
        model = get_geoid_model()
        u = model.get_undulation(req.lat, req.lon)
        return {"undulation": u}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transform")
def transform_coordinates(req: TransformRequest):
    """Transform coordinates between datums (e.g., WGS84 to NAD83)."""
    try:
        # We need to construct a StationCoordinate object expected by the logic
        # But wait, logic expects the one from schemas. 
        # Since python is dynamic and pydantic models are similar, it might work if attributes match.
        # But transform_datum type hint expects schemas.StationCoordinate.
        # Let's hope duck typing works or the import in geoid_model.py matches this structure.
        
        # Actually, let's look at geoid_model.py's transform_datum again.
        # It accesses station.lat, station.lon, station.h.
        # This Pydantic model has those fields. It should work.
        
        station_obj = req.station
        new_station = transform_datum(station_obj, req.from_datum, req.to_datum)
        return new_station
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/network-adjustment")
def adjust_network(req: NetworkRequest):
    """Perform least squares network adjustment."""
    try:
        net = NetworkAdjustment()
        for sid, coords in req.stations.items():
            if len(coords) < 3:
                continue
        
        # Fixed imports here too.
        # .baseline_adjustment.NetworkAdjustment.add_station expects: station_id, x, y, z, fixed
        
            net.add_station(sid, coords[0], coords[1], coords[2], fixed=(sid in req.fixed_stations))
        
        for b in req.baselines:
            obs = BaselineObservation(
                from_station=b.from_station, 
                to_station=b.to_station, 
                dx=b.dx, dy=b.dy, dz=b.dz, 
                sigma_x=b.sigma_x, sigma_y=b.sigma_y, sigma_z=b.sigma_z
            )
            net.add_baseline(obs)
            
        result = net.adjust()
        
        # Convert numpy types to native python types for JSON
        serializable_result = {
            "adjusted_coordinates": {k: v.tolist() for k, v in result["adjusted_coordinates"].items()},
            "coordinate_std": {k: v.tolist() if hasattr(v, 'tolist') else v for k, v in result["coordinate_std"].items()}, # std might be float or array
            "residuals": result["residuals"].tolist(),
            "sigma_0": float(result["sigma_0"]),
            "iterations": int(result["iterations"]),
            "degrees_of_freedom": int(result["degrees_of_freedom"])
        }
        return serializable_result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
