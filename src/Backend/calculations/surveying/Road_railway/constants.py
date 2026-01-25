# ============================================================================
# backend/route_surveying/constants.py
# ============================================================================

"""Physical and engineering constants"""

# Physics
GRAVITY_M_S2 = 9.81

# Friction coefficients (AASHTO)
FRICTION_COEFFICIENTS = {
    "dry": 0.35,
    "wet": 0.30,
    "icy": 0.15
}

# Standard design speeds (km/h)
STANDARD_DESIGN_SPEEDS = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130]

# Eye height and object height for sight distance (AASHTO)
EYE_HEIGHT_M = 1.08  # Driver eye height
OBJECT_HEIGHT_SSD_M = 0.60  # Object height for SSD
OBJECT_HEIGHT_OSD_M = 1.08  # Object height for OSD

# Default reaction time
DEFAULT_REACTION_TIME_S = 2.5

# Typical side slopes (H:V)
DEFAULT_CUT_SLOPE = 1.5  # 1.5:1
DEFAULT_FILL_SLOPE = 2.0  # 2:1

# Pavement material densities (typical values, tonnes/m³)
MATERIAL_DENSITIES = {
    "asphalt": 2.4,
    "concrete": 2.4,
    "crushed_stone": 2.2,
    "gravel": 2.0,
    "sand": 1.8
}


