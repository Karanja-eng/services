import math
from typing import List, Optional, Dict, Tuple, Any
from pydantic import BaseModel, Field

class Coordinate(BaseModel):
    easting: float
    northing: float
    height: Optional[float] = None

class ControlPoint(BaseModel):
    id: str
    coords: Coordinate

class TriangulationRequest(BaseModel):
    base_points: List[ControlPoint]  # Minimum 2 points
    measured_angles: List[float]    # Angles in degrees

class TrilaterationRequest(BaseModel):
    base_points: List[ControlPoint]  # Minimum 3 points for 2D unique sol
    measured_distances: List[float]

class ResectionRequest(BaseModel):
    target_id: str
    fixed_points: List[ControlPoint]
    observations: List[float]  # Angles or Distances
    method: str  # "2-point", "3-point", "free-station"

class IntersectionRequest(BaseModel):
    p1: ControlPoint
    p2: ControlPoint
    obs1: float  # Angle or bearing from p1
    obs2: float  # Angle or bearing from p2
    method: str  # "angular", "distance"

class TransformationRequest(BaseModel):
    points: List[Coordinate]
    source_system: str
    target_system: str
    params: Optional[Dict[str, float]] = None

class CalculationResult(BaseModel):
    result: Any
    steps: List[str]
    checks: Dict[str, Any]
    warnings: List[str]

# ==================== UTILITIES ====================

def get_bearing(p1: Coordinate, p2: Coordinate) -> float:
    """Calculate bearing from p1 to p2 in degrees (0-360)"""
    de = p2.easting - p1.easting
    dn = p2.northing - p1.northing
    bearing = math.degrees(math.atan2(de, dn))
    return bearing if bearing >= 0 else bearing + 360

def get_distance(p1: Coordinate, p2: Coordinate) -> float:
    """Calculate 2D distance between p1 and p2"""
    return math.sqrt((p2.easting - p1.easting)**2 + (p2.northing - p1.northing)**2)

def dms_to_dd(degrees: float, minutes: float, seconds: float) -> float:
    """Convert Degrees-Minutes-Seconds to Decimal Degrees"""
    return degrees + minutes/60 + seconds/3600

def dd_to_dms(dd: float) -> Tuple[int, int, float]:
    """Convert Decimal Degrees to Degrees-Minutes-Seconds"""
    deg = int(dd)
    min_float = (dd - deg) * 60
    minutes = int(min_float)
    seconds = (min_float - minutes) * 60
    return deg, minutes, round(seconds, 2)

# ==================== CORE CALCULATIONS ====================

def calculate_angular_intersection(p1: Coordinate, p2: Coordinate, b1: float, b2: float) -> CalculationResult:
    """
    Calculate intersection of two bearings (Azimuths)
    """
    steps = []
    warnings = []
    
    # Bearings in radians
    a1 = math.radians(b1)
    a2 = math.radians(b2)
    
    steps.append(f"Primary Bearing 1: {b1}°, Bearing 2: {b2}°")
    
    # Using the standard intersection formula
    # E = E1 + (E2 - E1) * cot(a2) - (N2 - N1) / (cot(a1) - cot(a2))
    # Wait, simpler logic using tan:
    # N = (E2 - E1 + N1*tan(a1) - N2*tan(a2)) / (tan(a1) - tan(a2))
    
    # Handle vertical/horizontal singularities
    if abs(math.sin(a1 - a2)) < 1e-9:
        return CalculationResult(
            result=None,
            steps=steps,
            checks={},
            warnings=["Parallel or coincident lines detected. No intersection possible."]
        )
        
    s1 = math.sin(a1)
    c1 = math.cos(a1)
    s2 = math.sin(a2)
    c2 = math.cos(a2)
    
    denominator = s1 * c2 - c1 * s2
    
    e_calc = (p1.easting * c1 * s2 - p2.easting * c2 * s1 + (p2.northing - p1.northing) * s1 * s2) / denominator
    n_calc = (p1.northing * s1 * c2 - p2.northing * s2 * c1 + (p2.easting - p1.easting) * c1 * c2) / denominator
    
    res = Coordinate(easting=round(e_calc, 3), northing=round(n_calc, 3))
    steps.append(f"Computed Coordinates: E {res.easting}, N {res.northing}")
    
    # Check
    check_b1 = get_bearing(p1, res)
    check_b2 = get_bearing(p2, res)
    
    checks = {
        "residual_bearing_1": round(abs(check_b1 - b1), 5),
        "residual_bearing_2": round(abs(check_b2 - b2), 5)
    }
    
    if max(checks.values()) > 0.001:
        warnings.append("High residual detected in intersection check.")
        
    return CalculationResult(result=res, steps=steps, checks=checks, warnings=warnings)

def calculate_distance_intersection(p1: Coordinate, p2: Coordinate, r1: float, r2: float) -> CalculationResult:
    """Intersection of two circles (Trilateration-lite)"""
    steps = []
    warnings = []
    
    d = get_distance(p1, p2)
    steps.append(f"Distance between base points: {round(d, 3)}m")
    
    if d > r1 + r2:
        return CalculationResult(result=None, steps=steps, checks={}, warnings=["Circles do not intersect (too far apart)."])
    if d < abs(r1 - r2):
        return CalculationResult(result=None, steps=steps, checks={}, warnings=["Circles do not intersect (one inside another)."])
        
    a = (r1**2 - r2**2 + d**2) / (2 * d)
    h = math.sqrt(max(0, r1**2 - a**2))
    
    x2 = p1.easting + a * (p2.easting - p1.easting) / d
    y2 = p1.northing + a * (p2.northing - p1.northing) / d
    
    # Two possible solutions
    sol1 = Coordinate(
        easting=round(x2 + h * (p2.northing - p1.northing) / d, 3),
        northing=round(y2 - h * (p2.easting - p1.easting) / d, 3)
    )
    sol2 = Coordinate(
        easting=round(x2 - h * (p2.northing - p1.northing) / d, 3),
        northing=round(y2 + h * (p2.easting - p1.easting) / d, 3)
    )
    
    steps.append(f"Two solutions found due to circle intersection symmetry.")
    
    return CalculationResult(
        result={"solution_a": sol1, "solution_b": sol2},
        steps=steps,
        checks={"baseline_distance": round(d, 3)},
        warnings=["Ambiguous solution. External orientation required to choose correct point."]
    )

def calculate_3point_resection(p1: ControlPoint, p2: ControlPoint, p3: ControlPoint, alpha: float, beta: float, gamma: float) -> CalculationResult:
    """
    Tienstra's Formula for 3-point resection.
    alpha, beta, gamma are angles observed at P between (P2,P3), (P3,P1), (P1,P2) respectively.
    Note: alpha + beta + gamma must equal 360 degrees.
    """
    steps = ["Implementing Tienstra's Formula for 3-point resection"]
    warnings = []
    
    # Internal angles of the control triangle
    # A at p1, B at p2, C at p3
    a_dist = get_distance(p2.coords, p3.coords)
    b_dist = get_distance(p1.coords, p3.coords)
    c_dist = get_distance(p1.coords, p2.coords)
    
    # Using law of cosines to find internal angles A, B, C
    angle_A = math.acos((b_dist**2 + c_dist**2 - a_dist**2) / (2 * b_dist * c_dist))
    angle_B = math.acos((a_dist**2 + c_dist**2 - b_dist**2) / (2 * a_dist * c_dist))
    angle_C = math.acos((a_dist**2 + b_dist**2 - c_dist**2) / (2 * a_dist * b_dist))
    
    steps.append(f"Control triangle sides: {round(a_dist,3)}, {round(b_dist,3)}, {round(c_dist,3)}")
    
    # Tienstra's weights
    def get_weight(angle_tri, angle_obs):
        denom = (1/math.tan(angle_tri)) - (1/math.tan(math.radians(angle_obs)))
        return 1/denom

    try:
        w1 = get_weight(angle_A, alpha)
        w2 = get_weight(angle_B, beta)
        w3 = get_weight(angle_C, gamma)
    except ZeroDivisionError:
        return CalculationResult(result=None, steps=steps, checks={}, warnings=["Singularity: Point lies on the danger circle or baseline."])

    sum_w = w1 + w2 + w3
    e_p = (w1 * p1.coords.easting + w2 * p2.coords.easting + w3 * p3.coords.easting) / sum_w
    n_p = (w1 * p1.coords.northing + w2 * p2.coords.northing + w3 * p3.coords.northing) / sum_w
    
    res = Coordinate(easting=round(e_p, 3), northing=round(n_p, 3))
    steps.append(f"Computed Resection Coordinates: E {res.easting}, N {res.northing}")
    
    # Validation: Check angles from P to A, B, C
    b_pa = get_bearing(res, p1.coords)
    b_pb = get_bearing(res, p2.coords)
    b_pc = get_bearing(res, p3.coords)
    
    def diff_bearing(b_end, b_start):
        diff = b_end - b_start
        return diff if diff >= 0 else diff + 360

    calc_alpha = diff_bearing(b_pc, b_pb)
    calc_beta = diff_bearing(b_pa, b_pc)
    calc_gamma = diff_bearing(b_pb, b_pa)
    
    checks = {
        "residual_alpha": round(abs(calc_alpha - alpha), 4),
        "residual_beta": round(abs(calc_beta - beta), 4),
        "residual_gamma": round(abs(calc_gamma - gamma), 4),
        "sum_observed_angles": round(alpha + beta + gamma, 2)
    }
    
    if alpha + beta + gamma < 359.9 or alpha + beta + gamma > 360.1:
        warnings.append("Observed angles do not sum to 360 degrees.")
        
    return CalculationResult(result=res, steps=steps, checks=checks, warnings=warnings)

def transform_local_to_national(points: List[Coordinate], translation_e: float, translation_n: float, rotation_deg: float, scale: float = 1.0) -> List[Coordinate]:
    """
    Standard 2D Helmert transformation (simplified without least squares fit)
    Useful for local grid to national grid conversion
    """
    transformed = []
    theta = math.radians(rotation_deg)
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)
    
    for p in points:
        # Scale and Rotate
        e_new = scale * (p.easting * cos_t - p.northing * sin_t) + translation_e
        n_new = scale * (p.easting * sin_t + p.northing * cos_t) + translation_n
        transformed.append(Coordinate(easting=round(e_new, 3), northing=round(n_new, 3)))
        
    return transformed
