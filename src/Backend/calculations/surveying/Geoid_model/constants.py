# ============================================================================
# FILE: backend/gnss/constants.py
# ============================================================================
"""
Geodetic constants and ellipsoid parameters.
All values are from authoritative sources (IERS, NIMA, NGS).
"""

from typing import Dict

# WGS84 Ellipsoid Parameters (EPSG:4326)
WGS84 = {
    "a": 6378137.0,              # Semi-major axis (m)
    "f": 1 / 298.257223563,      # Flattening
    "b": 6356752.314245,         # Semi-minor axis (m)
    "e2": 0.00669437999014,      # First eccentricity squared
    "e_prime2": 0.00673949674228, # Second eccentricity squared
    "GM": 3.986004418e14,        # Earth's gravitational constant (m³/s²)
    "omega": 7.292115e-5,        # Earth's angular velocity (rad/s)
}

# UTM Projection Parameters
UTM_SCALE_FACTOR = 0.9996      # Central meridian scale factor
UTM_FALSE_EASTING = 500000.0   # False easting (m)
UTM_FALSE_NORTHING_SOUTH = 10000000.0  # False northing for southern hemisphere (m)

# RTK Accuracy Models (mm + ppm)
RTK_ACCURACY = {
    "fixed": {
        "horizontal_base": 8.0,   # mm
        "horizontal_ppm": 1.0,    # ppm
        "vertical_base": 15.0,    # mm
        "vertical_ppm": 1.0,      # ppm
    },
    "float": {
        "horizontal_base": 50.0,
        "horizontal_ppm": 5.0,
        "vertical_base": 100.0,
        "vertical_ppm": 10.0,
    },
    "single": {
        "horizontal_base": 2000.0,
        "horizontal_ppm": 0.0,
        "vertical_base": 3000.0,
        "vertical_ppm": 0.0,
    }
}

# PDOP Quality Thresholds
PDOP_THRESHOLDS = {
    "excellent": 2.0,
    "good": 3.0,
    "moderate": 4.0,
    "fair": 6.0,
}

# Supported Datums (for future expansion)
DATUM_DEFINITIONS = {
    "WGS84": {"epsg": 4326, "ellipsoid": "WGS84"},
    "NAD83": {"epsg": 4269, "ellipsoid": "GRS80"},
    "ETRS89": {"epsg": 4258, "ellipsoid": "GRS80"},
}
