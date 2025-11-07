"""
Bolted Connection Design Module - BS 5950-1:2000 Section 6.2-6.4
Complete implementation for ordinary bolts, HSFG bolts, and bearing connections
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from enum import Enum
import math

# Bolt Types and Grades
class BoltGrade(str, Enum):
    GRADE_4_6 = "4.6"
    GRADE_8_8 = "8.8"
    GRADE_10_9 = "10.9"
    HSFG_8_8 = "HSFG_8.8"
    HSFG_10_9 = "HSFG_10.9"

class BoltType(str, Enum):
    ORDINARY = "ordinary"
    HSFG = "hsfg"  # High Strength Friction Grip

class ShearPlane(str, Enum):
    SINGLE = "single"
    DOUBLE = "double"

class ThreadCondition(str, Enum):
    IN_SHEAR = "threads_in_shear_plane"
    EXCLUDED = "threads_excluded"

# Bolt Properties (BS 5950 Table 32-35)
BOLT_PROPERTIES = {
    BoltGrade.GRADE_4_6: {
        "fy": 240,  # N/mm²
        "fu": 400,  # N/mm²
        "p_s_threads_in": 160,  # Shear strength with threads in shear
        "p_s_threads_out": 250,  # Shear strength with threads excluded
        "p_t": 195,  # Tension strength
    },
    BoltGrade.GRADE_8_8: {
        "fy": 640,
        "fu": 800,
        "p_s_threads_in": 375,
        "p_s_threads_out": 450,
        "p_t": 450,
    },
    BoltGrade.GRADE_10_9: {
        "fy": 900,
        "fu": 1000,
        "p_s_threads_in": 450,
        "p_s_threads_out": 550,
        "p_t": 560,
    },
    BoltGrade.HSFG_8_8: {
        "fy": 640,
        "fu": 800,
        "p_s_threads_in": 375,
        "p_s_threads_out": 450,
        "p_t": 450,
        "slip_factor": 0.5,  # For HSFG bolts
    },
    BoltGrade.HSFG_10_9: {
        "fy": 900,
        "fu": 1000,
        "p_s_threads_in": 450,
        "p_s_threads_out": 550,
        "p_t": 560,
        "slip_factor": 0.5,
    }
}

# Standard bolt diameters (mm)
STANDARD_BOLT_DIAMETERS = [12, 16, 20, 24, 27, 30, 36]

# Bolt areas (tensile stress area in mm²)
BOLT_AREAS = {
    12: {"gross": 113, "tensile": 84.3, "shear": 113},
    16: {"gross": 201, "tensile": 157, "shear": 201},
    20: {"gross": 314, "tensile": 245, "shear": 314},
    24: {"gross": 452, "tensile": 353, "shear": 452},
    27: {"gross": 573, "tensile": 459, "shear": 573},
    30: {"gross": 707, "tensile": 561, "shear": 707},
    36: {"gross": 1020, "tensile": 817, "shear": 1020},
}

# Request Models
class BoltedConnectionRequest(BaseModel):
    """General bolted connection request"""
    bolt_diameter: int = Field(..., description="Bolt diameter in mm")
    bolt_grade: BoltGrade
    num_bolts: int = Field(..., gt=0, description="Number of bolts")
    shear_plane: ShearPlane
    thread_condition: ThreadCondition
    applied_shear: float = Field(default=0, ge=0, description="Applied shear force (kN)")
    applied_tension: float = Field(default=0, ge=0, description="Applied tension force (kN)")
    plate_thickness: float = Field(..., gt=0, description="Plate thickness (mm)")
    plate_grade: str = Field(..., description="Steel grade (S275, S355, S450)")
    edge_distance: Optional[float] = Field(None, description="Edge distance (mm)")

class HsfgBoltRequest(BaseModel):
    """HSFG bolt connection request"""
    bolt_diameter: int
    bolt_grade: Literal["HSFG_8.8", "HSFG_10.9"]
    num_bolts: int = Field(..., gt=0)
    shear_plane: ShearPlane
    applied_shear: float = Field(..., ge=0)
    plate_thickness: float = Field(..., gt=0)
    surface_condition: Literal["normal", "blast_cleaned", "wire_brushed"] = "normal"

class BoltGroupRequest(BaseModel):
    """Bolt group subjected to eccentric loading"""
    bolt_diameter: int
    bolt_grade: BoltGrade
    bolt_positions: List[tuple] = Field(..., description="List of (x, y) coordinates in mm")
    applied_force: float = Field(..., gt=0, description="Applied force (kN)")
    eccentricity_x: float = Field(default=0, description="Eccentricity in x-direction (mm)")
    eccentricity_y: float = Field(default=0, description="Eccentricity in y-direction (mm)")
    thread_condition: ThreadCondition
    plate_thickness: float
    plate_grade: str

class PryingActionRequest(BaseModel):
    """Bolted connection with prying action"""
    bolt_diameter: int
    bolt_grade: BoltGrade
    num_bolts: int = Field(..., gt=0)
    applied_tension: float = Field(..., gt=0)
    flange_thickness: float = Field(..., gt=0, description="Flange thickness (mm)")
    edge_distance: float = Field(..., gt=0)
    bolt_spacing: float = Field(..., gt=0)

# Response Models
class BoltCapacityResponse(BaseModel):
    """Bolt capacity calculation results"""
    bolt_diameter: int
    bolt_grade: str
    num_bolts: int
    shear_capacity_per_bolt: float
    tension_capacity_per_bolt: float
    bearing_capacity_per_bolt: float
    total_shear_capacity: float
    total_tension_capacity: float
    total_bearing_capacity: float
    applied_shear: float
    applied_tension: float
    shear_utilization: float
    tension_utilization: float
    interaction_ratio: float
    passed: bool

class HsfgBoltResponse(BaseModel):
    """HSFG bolt capacity results"""
    bolt_diameter: int
    num_bolts: int
    slip_resistance_per_bolt: float
    total_slip_resistance: float
    applied_shear: float
    utilization_ratio: float
    passed: bool
    clamping_force: float

class BoltGroupResponse(BaseModel):
    """Bolt group analysis results"""
    num_bolts: int
    centroid_x: float
    centroid_y: float
    moment: float
    max_bolt_force: float
    bolt_capacity: float
    utilization_ratio: float
    passed: bool
    critical_bolt_position: tuple

# Design Functions
def get_bolt_area(diameter: int, area_type: str = "tensile") -> float:
    """Get bolt cross-sectional area"""
    if diameter not in BOLT_AREAS:
        raise ValueError(f"Unsupported bolt diameter: {diameter}mm")
    return BOLT_AREAS[diameter][area_type]

def calculate_shear_capacity(bolt_grade: BoltGrade, diameter: int, 
                            shear_plane: ShearPlane, thread_condition: ThreadCondition) -> float:
    """
    Calculate shear capacity of bolt (BS 5950 Cl 6.3.2)
    P_s = p_s * A_s * n
    where n is number of shear planes
    """
    props = BOLT_PROPERTIES[bolt_grade]
    
    if thread_condition == ThreadCondition.IN_SHEAR:
        p_s = props["p_s_threads_in"]
    else:
        p_s = props["p_s_threads_out"]
    
    A_s = get_bolt_area(diameter, "shear")
    
    # Number of shear planes
    n = 2 if shear_plane == ShearPlane.DOUBLE else 1
    
    P_s = (p_s * A_s * n) / 1000  # kN
    return P_s

def calculate_tension_capacity(bolt_grade: BoltGrade, diameter: int) -> float:
    """
    Calculate tension capacity of bolt (BS 5950 Cl 6.3.3)
    P_t = p_t * A_t
    """
    props = BOLT_PROPERTIES[bolt_grade]
    p_t = props["p_t"]
    A_t = get_bolt_area(diameter, "tensile")
    
    P_t = (p_t * A_t) / 1000  # kN
    return P_t

def calculate_bearing_capacity(diameter: int, plate_thickness: float, 
                               plate_grade: str, edge_distance: Optional[float] = None) -> float:
    """
    Calculate bearing capacity (BS 5950 Cl 6.3.3.3)
    P_bs = d * t * p_bs
    where p_bs = min(py, 0.5 * fu, bearing strength)
    """
    STEEL_PROPERTIES = {
        "S275": {"fy": 275, "fu": 430},
        "S355": {"fy": 355, "fu": 510},
        "S450": {"fy": 450, "fu": 550}
    }
    
    steel = STEEL_PROPERTIES.get(plate_grade, STEEL_PROPERTIES["S275"])
    
    # Bearing strength (BS 5950 Table 32)
    if edge_distance and edge_distance < 2 * diameter:
        # Reduced bearing strength for edge bolts
        p_bs = min(steel["fy"], 0.5 * steel["fu"], (edge_distance / diameter) * steel["fy"])
    else:
        p_bs = min(steel["fy"], 0.5 * steel["fu"])
    
    P_bs = (diameter * plate_thickness * p_bs) / 1000  # kN
    return P_bs

def design_bolted_connection(request: BoltedConnectionRequest) -> BoltCapacityResponse:
    """
    Design bolted connection according to BS 5950
    """
    d = request.bolt_diameter
    n = request.num_bolts
    
    # Shear capacity per bolt
    P_s = calculate_shear_capacity(request.bolt_grade, d, request.shear_plane, request.thread_condition)
    
    # Tension capacity per bolt
    P_t = calculate_tension_capacity(request.bolt_grade, d)
    
    # Bearing capacity per bolt
    P_bs = calculate_bearing_capacity(d, request.plate_thickness, request.plate_grade, request.edge_distance)
    
    # Total capacities
    total_P_s = P_s * n
    total_P_t = P_t * n
    total_P_bs = P_bs * n
    
    # Utilization ratios
    shear_util = request.applied_shear / total_P_s if total_P_s > 0 else 0
    tension_util = request.applied_tension / total_P_t if total_P_t > 0 else 0
    
    # Interaction check (BS 5950 Cl 6.3.3.4)
    # For combined tension and shear: (F_s/P_s)² + (F_t/P_t)² ≤ 1.0
    interaction = math.sqrt(shear_util**2 + tension_util**2)
    
    passed = interaction <= 1.0
    
    return BoltCapacityResponse(
        bolt_diameter=d,
        bolt_grade=request.bolt_grade.value,
        num_bolts=n,
        shear_capacity_per_bolt=round(P_s, 2),
        tension_capacity_per_bolt=round(P_t, 2),
        bearing_capacity_per_bolt=round(P_bs, 2),
        total_shear_capacity=round(total_P_s, 2),
        total_tension_capacity=round(total_P_t, 2),
        total_bearing_capacity=round(total_P_bs, 2),
        applied_shear=request.applied_shear,
        applied_tension=request.applied_tension,
        shear_utilization=round(shear_util * 100, 1),
        tension_utilization=round(tension_util * 100, 1),
        interaction_ratio=round(interaction * 100, 1),
        passed=passed
    )

def design_hsfg_bolt(request: HsfgBoltRequest) -> HsfgBoltResponse:
    """
    Design HSFG (High Strength Friction Grip) bolt connection
    BS 5950 Cl 6.4
    """
    grade_key = BoltGrade.HSFG_8_8 if "8.8" in request.bolt_grade else BoltGrade.HSFG_10_9
    props = BOLT_PROPERTIES[grade_key]
    
    # Clamping force (proof load)
    A_t = get_bolt_area(request.bolt_diameter, "tensile")
    proof_stress = props["fy"] * 0.7  # 70% of yield
    P_0 = (proof_stress * A_t) / 1000  # kN
    
    # Slip resistance (BS 5950 Cl 6.4.2)
    mu = props["slip_factor"]
    
    # Adjust for surface condition
    if request.surface_condition == "blast_cleaned":
        mu = 0.5
    elif request.surface_condition == "wire_brushed":
        mu = 0.4
    else:  # normal
        mu = 0.3
    
    # Number of slip planes
    n_slip = 2 if request.shear_plane == ShearPlane.DOUBLE else 1
    
    # Slip resistance per bolt: P_slip = mu * P_0 * n_slip
    P_slip = mu * P_0 * n_slip
    
    # Total slip resistance
    total_slip = P_slip * request.num_bolts
    
    utilization = request.applied_shear / total_slip if total_slip > 0 else float('inf')
    passed = utilization <= 1.0
    
    return HsfgBoltResponse(
        bolt_diameter=request.bolt_diameter,
        num_bolts=request.num_bolts,
        slip_resistance_per_bolt=round(P_slip, 2),
        total_slip_resistance=round(total_slip, 2),
        applied_shear=request.applied_shear,
        utilization_ratio=round(utilization * 100, 1),
        passed=passed,
        clamping_force=round(P_0, 2)
    )

def analyze_bolt_group(request: BoltGroupRequest) -> BoltGroupResponse:
    """
    Analyze bolt group subjected to eccentric loading
    Using elastic analysis method
    """
    positions = request.bolt_positions
    n = len(positions)
    
    # Calculate centroid
    x_sum = sum(pos[0] for pos in positions)
    y_sum = sum(pos[1] for pos in positions)
    x_c = x_sum / n
    y_c = y_sum / n
    
    # Applied moment
    M = math.sqrt(request.eccentricity_x**2 + request.eccentricity_y**2) * request.applied_force
    
    # Calculate polar moment of inertia
    J = sum((pos[0] - x_c)**2 + (pos[1] - y_c)**2 for pos in positions)
    
    # Find maximum bolt force
    max_force = 0
    critical_pos = (0, 0)
    
    for pos in positions:
        # Distance from centroid
        r = math.sqrt((pos[0] - x_c)**2 + (pos[1] - y_c)**2)
        
        # Force from direct shear
        F_direct = request.applied_force / n
        
        # Force from moment (if present)
        if J > 0 and M > 0:
            F_moment = (M * r) / J
        else:
            F_moment = 0
        
        # Resultant force (conservative - add directly)
        F_total = F_direct + F_moment
        
        if F_total > max_force:
            max_force = F_total
            critical_pos = pos
    
    # Bolt capacity
    bolt_capacity = calculate_shear_capacity(
        request.bolt_grade, 
        request.bolt_diameter, 
        ShearPlane.SINGLE,
        request.thread_condition
    )
    
    utilization = max_force / bolt_capacity if bolt_capacity > 0 else float('inf')
    passed = utilization <= 1.0
    
    return BoltGroupResponse(
        num_bolts=n,
        centroid_x=round(x_c, 2),
        centroid_y=round(y_c, 2),
        moment=round(M, 2),
        max_bolt_force=round(max_force, 2),
        bolt_capacity=round(bolt_capacity, 2),
        utilization_ratio=round(utilization * 100, 1),
        passed=passed,
        critical_bolt_position=critical_pos
    )

# Spacing and edge distance requirements
def minimum_bolt_spacing(diameter: int) -> float:
    """Minimum center-to-center spacing (BS 5950 Cl 6.2.1)"""
    return 2.5 * diameter

def minimum_edge_distance(diameter: int, hole_type: str = "standard") -> float:
    """Minimum edge distance (BS 5950 Cl 6.2.2)"""
    if hole_type == "standard":
        return 1.25 * diameter
    else:  # oversize or slotted
        return 1.5 * diameter

def maximum_bolt_spacing(plate_thickness: float) -> float:
    """Maximum spacing for compression members (BS 5950 Cl 6.2.3)"""
    return min(16 * plate_thickness, 200)  # mm

def maximum_edge_distance(plate_thickness: float) -> float:
    """Maximum edge distance (BS 5950 Cl 6.2.4)"""
    return min(11 * plate_thickness, 150)  # mm