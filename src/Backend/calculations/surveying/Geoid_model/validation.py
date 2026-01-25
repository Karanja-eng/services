# ============================================================================
# FILE: backend/gnss/validation.py
# ============================================================================
"""
Input validation and sanity checks for GNSS computations.
Ensures data integrity before processing.
"""

from typing import Tuple, List

class GNSSValidationError(Exception):
    """Custom exception for GNSS validation failures."""
    pass

def validate_latitude(lat: float) -> None:
    """Validate latitude is within valid range."""
    if not -90 <= lat <= 90:
        raise GNSSValidationError(f"Latitude {lat} out of range [-90, 90]")

def validate_longitude(lon: float) -> None:
    """Validate longitude is within valid range."""
    if not -180 <= lon <= 180:
        raise GNSSValidationError(f"Longitude {lon} out of range [-180, 180]")

def validate_height(h: float, min_h: float = -500, max_h: float = 10000) -> None:
    """Validate ellipsoidal height is reasonable."""
    if not min_h <= h <= max_h:
        raise GNSSValidationError(f"Height {h} out of reasonable range [{min_h}, {max_h}]")

def validate_utm_zone(zone: int) -> None:
    """Validate UTM zone number."""
    if not 1 <= zone <= 60:
        raise GNSSValidationError(f"UTM zone {zone} out of range [1, 60]")

def validate_baseline_length(length: float, max_length: float = 100000) -> List[str]:
    """Check baseline length and return warnings if necessary."""
    warnings = []
    if length > max_length:
        warnings.append(f"Baseline length {length:.0f}m exceeds recommended maximum {max_length}m")
    if length > 50000:
        warnings.append("Long baseline: RTK accuracy significantly degraded")
    if length > 20000:
        warnings.append("Consider using network RTK or VRS for improved accuracy")
    return warnings

def validate_pdop(pdop: float) -> Tuple[str, List[str]]:
    """Assess PDOP quality and return classification and warnings."""
    warnings = []
    
    if pdop <= 2.0:
        classification = "excellent"
    elif pdop <= 3.0:
        classification = "good"
    elif pdop <= 4.0:
        classification = "moderate"
    elif pdop <= 6.0:
        classification = "fair"
        warnings.append("PDOP indicates marginal satellite geometry")
    else:
        classification = "poor"
        warnings.append("PDOP indicates poor satellite geometry - results unreliable")
    
    return classification, warnings

def validate_satellite_count(num_sats: int) -> List[str]:
    """Check satellite count and return warnings."""
    warnings = []
    if num_sats < 5:
        warnings.append(f"Only {num_sats} satellites - minimum 5 recommended for reliable RTK")
    if num_sats < 4:
        warnings.append("Insufficient satellites for valid 3D positioning")
    return warnings
