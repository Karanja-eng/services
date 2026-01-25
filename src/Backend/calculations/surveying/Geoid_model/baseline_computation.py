# ============================================================================
# FILE: backend/gnss/baselines/baseline_computation.py
# ============================================================================
"""
GNSS baseline computation using rigorous geodetic transformations.
Converts between geodetic and Cartesian coordinate systems.
"""

import numpy as np
from .constants import WGS84
from .schemas import StationCoordinate, ECEFComponents, ENUComponents

def geodetic_to_ecef(lat: float, lon: float, h: float) -> np.ndarray:
    """
    Convert geodetic coordinates to Earth-Centered Earth-Fixed (ECEF).
    """
    phi = np.radians(lat)
    lambda_ = np.radians(lon)
    
    # Radius of curvature in prime vertical
    N = WGS84["a"] / np.sqrt(1 - WGS84["e2"] * np.sin(phi)**2)
    
    X = (N + h) * np.cos(phi) * np.cos(lambda_)
    Y = (N + h) * np.cos(phi) * np.sin(lambda_)
    Z = (N * (1 - WGS84["e2"]) + h) * np.sin(phi)
    
    return np.array([X, Y, Z])

def ecef_to_enu(ecef_vector: np.ndarray, ref_lat: float, ref_lon: float) -> np.ndarray:
    """
    Convert ECEF vector to local East-North-Up (ENU) frame.
    """
    phi = np.radians(ref_lat)
    lambda_ = np.radians(ref_lon)
    
    # Rotation matrix from ECEF to ENU
    R = np.array([
        [-np.sin(lambda_), np.cos(lambda_), 0],
        [-np.sin(phi) * np.cos(lambda_), -np.sin(phi) * np.sin(lambda_), np.cos(phi)],
        [np.cos(phi) * np.cos(lambda_), np.cos(phi) * np.sin(lambda_), np.sin(phi)]
    ])
    
    enu = R @ ecef_vector
    return enu

def compute_baseline(station1: StationCoordinate, station2: StationCoordinate) -> dict:
    """
    Compute complete baseline vector between two GNSS stations.
    """
    # Convert to ECEF
    ecef1 = geodetic_to_ecef(station1.lat, station1.lon, station1.h)
    ecef2 = geodetic_to_ecef(station2.lat, station2.lon, station2.h)
    
    # Baseline vector in ECEF
    d_ecef = ecef2 - ecef1
    
    # Convert to ENU at station 1
    d_enu = ecef_to_enu(d_ecef, station1.lat, station1.lon)
    
    # Compute metrics
    length = np.linalg.norm(d_ecef)
    horizontal_dist = np.sqrt(d_enu[0]**2 + d_enu[1]**2)
    azimuth = (np.degrees(np.arctan2(d_enu[0], d_enu[1])) + 360) % 360
    
    return {
        "length": float(length),
        "horizontal_distance": float(horizontal_dist),
        "vertical_distance": float(d_enu[2]),
        "azimuth": float(azimuth),
        "ecef": ECEFComponents(dx=float(d_ecef[0]), dy=float(d_ecef[1]), dz=float(d_ecef[2])),
        "enu": ENUComponents(dE=float(d_enu[0]), dN=float(d_enu[1]), dU=float(d_enu[2])),
        "units": "meters"
    }
