# ============================================================================
# FILE: backend/gnss/utm/latlon_to_utm.py
# ============================================================================
"""
UTM coordinate conversion using Transverse Mercator projection.
Implements standard USGS and NIMA algorithms.
"""

import numpy as np
from .constants import WGS84, UTM_SCALE_FACTOR, UTM_FALSE_EASTING, UTM_FALSE_NORTHING_SOUTH

def get_utm_zone(lon: float) -> int:
    """Determine UTM zone number from longitude."""
    return int((lon + 180) / 6) + 1

def get_central_meridian(zone: int) -> float:
    """Get central meridian for UTM zone (in degrees)."""
    return (zone - 1) * 6 - 180 + 3

def latlon_to_utm(lat: float, lon: float, force_zone: int = None) -> dict:
    """
    Convert geographic coordinates to UTM using Transverse Mercator projection.
    """
    # Determine zone
    zone = force_zone if force_zone else get_utm_zone(lon)
    lambda0 = np.radians(get_central_meridian(zone))
    
    phi = np.radians(lat)
    lambda_ = np.radians(lon)
    
    k0 = UTM_SCALE_FACTOR
    a = WGS84["a"]
    e2 = WGS84["e2"]
    
    # Commonly used terms
    N = a / np.sqrt(1 - e2 * np.sin(phi)**2)
    T = np.tan(phi)**2
    C = (e2 / (1 - e2)) * np.cos(phi)**2
    A = (lambda_ - lambda0) * np.cos(phi)
    
    # Meridional arc
    M = a * ((1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * phi
            - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * np.sin(2*phi)
            + (15*e2**2/256 + 45*e2**3/1024) * np.sin(4*phi)
            - (35*e2**3/3072) * np.sin(6*phi))
    
    # Easting
    easting = (k0 * N * (A + (1 - T + C) * A**3 / 6
               + (5 - 18*T + T**2 + 72*C - 58*(e2/(1-e2))) * A**5 / 120)
               + UTM_FALSE_EASTING)
    
    # Northing
    northing = (k0 * (M + N * np.tan(phi) * (A**2 / 2
                + (5 - T + 9*C + 4*C**2) * A**4 / 24
                + (61 - 58*T + T**2 + 600*C - 330*(e2/(1-e2))) * A**6 / 720)))
    
    # Adjust for southern hemisphere
    hemisphere = "N" if lat >= 0 else "S"
    if hemisphere == "S":
        northing += UTM_FALSE_NORTHING_SOUTH
    
    # Grid convergence
    convergence = np.degrees(np.arctan(np.tan(lambda_ - lambda0) * np.sin(phi)))
    
    # Point scale factor
    scale_factor = k0 * (1 + (1 + C) * A**2 / 2 
                         + (5 - 4*T + 42*C + 13*C**2) * A**4 / 24)
    
    # EPSG code
    epsg_code = 32600 + zone if hemisphere == "N" else 32700 + zone
    
    return {
        "easting": float(easting),
        "northing": float(northing),
        "zone": zone,
        "hemisphere": hemisphere,
        "convergence": float(convergence),
        "scale_factor": float(scale_factor),
        "epsg_code": epsg_code
    }
