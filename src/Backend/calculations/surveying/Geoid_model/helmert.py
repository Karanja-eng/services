# ============================================================================
# FILE: backend/gnss/transformations/helmert.py
# ============================================================================
"""
Helmert 7-parameter datum transformation (similarity transformation).
Used for converting between different geodetic datums (e.g., WGS84 ↔ NAD83).
"""

import numpy as np
from typing import Dict, Tuple
from .schemas import StationCoordinate
from .constants import WGS84

class HelmertParameters:
    """
    Helmert 7-parameter transformation parameters.
    
    Parameters:
    - tx, ty, tz: Translation in meters
    - rx, ry, rz: Rotation in arc-seconds
    - ds: Scale change in ppm (parts per million)
    """
    
    def __init__(self, tx: float, ty: float, tz: float,
                 rx: float, ry: float, rz: float, ds: float):
        self.tx = tx  # meters
        self.ty = ty
        self.tz = tz
        self.rx = rx  # arc-seconds
        self.ry = ry
        self.rz = rz
        self.ds = ds  # ppm

# Standard datum transformation parameters
HELMERT_PARAMS = {
    "WGS84_to_NAD83": HelmertParameters(
        tx=0.9956, ty=-1.9013, tz=-0.5215,
        rx=0.025915, ry=0.009426, rz=0.011599,
        ds=0.00062
    ),
    "WGS84_to_ETRS89": HelmertParameters(
        tx=0.0, ty=0.0, tz=0.0,
        rx=0.0, ry=0.0, rz=0.0,
        ds=0.0  # ETRS89 aligned with WGS84 at epoch 1989.0
    ),
    # Add more datum pairs as needed
}

def helmert_transform_ecef(x: float, y: float, z: float, 
                           params: HelmertParameters,
                           inverse: bool = False) -> Tuple[float, float, float]:
    """
    Apply Helmert 7-parameter transformation to ECEF coordinates.
    """
    # Convert rotations from arc-seconds to radians
    rx_rad = np.radians(params.rx / 3600.0)
    ry_rad = np.radians(params.ry / 3600.0)
    rz_rad = np.radians(params.rz / 3600.0)
    
    # Scale factor (1 + ds in ppm)
    scale = 1.0 + params.ds / 1e6
    
    if inverse:
        # Invert parameters
        tx, ty, tz = -params.tx, -params.ty, -params.tz
        rx_rad, ry_rad, rz_rad = -rx_rad, -ry_rad, -rz_rad
        scale = 1.0 / scale
    else:
        tx, ty, tz = params.tx, params.ty, params.tz
    
    # Rotation matrix (small angles approximation)
    R = np.array([
        [1.0,       -rz_rad,   ry_rad],
        [rz_rad,     1.0,      -rx_rad],
        [-ry_rad,    rx_rad,    1.0]
    ])
    
    # Apply transformation
    xyz = np.array([x, y, z])
    xyz_transformed = np.array([tx, ty, tz]) + scale * (R @ xyz)
    
    return tuple(xyz_transformed)

def ecef_to_geodetic(x: float, y: float, z: float) -> Tuple[float, float, float]:
    """
    Convert ECEF to geodetic coordinates (Bowring's method).
    
    Returns:
        (latitude, longitude, height) in degrees and meters
    """
    a = WGS84["a"]
    e2 = WGS84["e2"]
    b = WGS84["b"]
    
    # Longitude
    lon = np.arctan2(y, x)
    
    # Iterative computation for latitude and height
    p = np.sqrt(x**2 + y**2)
    lat = np.arctan2(z, p * (1 - e2))
    
    h = 0.0 # initialize
    
    for _ in range(5):  # Usually converges in 3-4 iterations
        N = a / np.sqrt(1 - e2 * np.sin(lat)**2)
        h = p / np.cos(lat) - N
        lat = np.arctan2(z, p * (1 - e2 * N / (N + h)))
    
    return np.degrees(lat), np.degrees(lon), h

def transform_datum(station: StationCoordinate, 
                   from_datum: str, 
                   to_datum: str) -> StationCoordinate:
    """
    Transform station coordinates between datums.
    """
    # Get transformation parameters
    transform_key = f"{from_datum}_to_{to_datum}"
    if transform_key not in HELMERT_PARAMS:
        raise ValueError(f"No Helmert parameters defined for {transform_key}")
    
    params = HELMERT_PARAMS[transform_key]
    
    # Convert to ECEF
    from ..baseline_computation import geodetic_to_ecef
    x, y, z = geodetic_to_ecef(station.lat, station.lon, station.h)
    
    # Apply Helmert transformation
    x_new, y_new, z_new = helmert_transform_ecef(x, y, z, params)
    
    # Convert back to geodetic
    lat_new, lon_new, h_new = ecef_to_geodetic(x_new, y_new, z_new)
    
    return StationCoordinate(lat=lat_new, lon=lon_new, h=h_new)
