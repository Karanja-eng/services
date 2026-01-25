# ============================================================================
# FILE: backend/gnss/geoid/undulation.py
# ============================================================================
"""
Geoid undulation computation for converting ellipsoidal to orthometric heights.
Production systems should use EGM96, EGM2008, or regional geoid models.
"""

import numpy as np

def compute_geoid_undulation_simple(lat: float, lon: float) -> float:
    """
    Simplified geoid undulation model for demonstration.
    """
    phi = np.radians(lat)
    lambda_ = np.radians(lon)
    
    # Simplified spherical harmonic approximation
    N = (30 * np.sin(2 * phi) * np.cos(lambda_)
         + 15 * np.sin(phi) * np.cos(2 * lambda_)
         - 10 * np.cos(3 * phi))
    
    return float(N)

def ellipsoidal_to_orthometric(lat: float, lon: float, h_ellipsoid: float, 
                                geoid_model: str = "EGM96") -> dict:
    """
    Convert ellipsoidal height to orthometric height.
    """
    # Get geoid undulation
    # In a full system, this would key off geoid_model to pick the right function/class
    undulation = compute_geoid_undulation_simple(lat, lon)
    
    # Compute orthometric height
    h_orthometric = h_ellipsoid - undulation
    
    # Estimate accuracy based on model
    accuracy_map = {
        "EGM96": 0.5,
        "EGM2008": 0.2,
        "SIMPLIFIED": 10.0  # Our demo model
    }
    accuracy = accuracy_map.get(geoid_model, 10.0)
    
    return {
        "undulation": float(undulation),
        "orthometric_height": float(h_orthometric),
        "ellipsoidal_height": float(h_ellipsoid),
        "model_used": geoid_model,
        "accuracy_estimate": accuracy
    }
