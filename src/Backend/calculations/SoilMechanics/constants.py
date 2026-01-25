"""
Soil Mechanics Module - Physical Constants
SI Units: kN/m³, degrees, mm, %
"""

# Water properties
GAMMA_WATER = 9.81  # kN/m³
RHO_WATER = 1000.0  # kg/m³

# Gravity
G = 9.81  # m/s²

# Typical ranges for validation
SPECIFIC_GRAVITY_RANGE = (2.4, 2.9)  # Typical soil solids
MOISTURE_CONTENT_MAX = 200.0  # % (saturated clays can exceed 100%)
VOID_RATIO_MAX = 3.0  # Very loose/organic soils
POROSITY_MAX = 0.75  # n = 0.75 max practical

# Atterberg Limits (USCS)
PLASTICITY_CHART_A_LINE = 0.73  # PI = 0.73(LL - 20)

# Compaction (Standard Proctor)
PROCTOR_STANDARD_ENERGY = 592.7  # kJ/m³
PROCTOR_STANDARD_LAYERS = 3
PROCTOR_STANDARD_BLOWS = 25

# Compaction (Modified Proctor)
PROCTOR_MODIFIED_ENERGY = 2693.4  # kJ/m³
PROCTOR_MODIFIED_LAYERS = 5
PROCTOR_MODIFIED_BLOWS = 25

# Bearing Capacity Factors (Terzaghi)
# Format: {phi: (Nc, Nq, Ngamma)}
TERZAGHI_FACTORS = {
    0: (5.7, 1.0, 0.0),
    5: (7.3, 1.6, 0.5),
    10: (9.6, 2.7, 1.2),
    15: (12.9, 4.4, 2.5),
    20: (17.7, 7.4, 5.0),
    25: (25.1, 12.7, 9.7),
    30: (37.2, 22.5, 19.7),
    34: (52.6, 36.5, 35.0),
    35: (57.8, 41.4, 42.4),
    40: (95.7, 81.3, 100.4),
    45: (172.3, 173.3, 297.5),
    48: (258.3, 287.9, 780.1),
    50: (347.5, 415.1, 1153.2),
}

# Meyerhof Factors (similar structure)
MEYERHOF_FACTORS = TERZAGHI_FACTORS  # Simplified; actual values differ

# Shape factors (Meyerhof)
def meyerhof_shape_factors(shape: str):
    """Return shape factors (sc, sq, sgamma) for Meyerhof"""
    if shape == "strip":
        return 1.0, 1.0, 1.0
    elif shape == "square":
        return 1.3, 1.2, 0.8
    elif shape == "circular":
        return 1.3, 1.2, 0.6
    else:
        return 1.0, 1.0, 1.0

# Safety factors (typical)
FS_BEARING_CAPACITY_DEFAULT = 3.0
FS_SLOPE_STABILITY_MIN = 1.5

# Consolidation
CV_TYPICAL_RANGE = (1e-8, 1e-6)  # m²/s for clays