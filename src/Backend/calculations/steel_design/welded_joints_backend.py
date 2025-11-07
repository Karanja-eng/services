"""
Welded Joint Design Module - BS 5950-1:2000 Section 6.9
Complete implementation for fillet welds, butt welds, and partial penetration welds
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from enum import Enum
import math

# Weld Types
class WeldType(str, Enum):
    FILLET = "fillet"
    BUTT_FULL = "butt_full_penetration"
    BUTT_PARTIAL = "butt_partial_penetration"

class WeldPosition(str, Enum):
    LONGITUDINAL = "longitudinal"
    TRANSVERSE = "transverse"
    SIDE = "side"
    END = "end"

class ElectrodeGrade(str, Enum):
    E35 = "E35"  # 350 N/mm²
    E42 = "E42"  # 420 N/mm²
    E51 = "E51"  # 510 N/mm²

# Request Models
class FilletWeldRequest(BaseModel):
    """Fillet weld design request"""
    throat_size: float = Field(..., gt=0, description="Effective throat thickness (mm)")
    weld_length: float = Field(..., gt=0, description="Effective weld length (mm)")
    longitudinal_force: float = Field(default=0, description="Longitudinal force (kN)")
    transverse_force: float = Field(default=0, description="Transverse force (kN)")
    electrode_grade: ElectrodeGrade
    parent_steel_grade: str = Field(..., description="S275, S355, or S450")
    position: WeldPosition = WeldPosition.LONGITUDINAL
    
class ButtWeldRequest(BaseModel):
    """Butt weld design request"""
    weld_type: Literal["butt_full_penetration", "butt_partial_penetration"]
    throat_size: float = Field(..., gt=0, description="Throat thickness (mm)")
    weld_length: float = Field(..., gt=0, description="Weld length (mm)")
    applied_force: float = Field(..., gt=0, description="Applied force (kN)")
    parent_steel_grade: str
    electrode_grade: ElectrodeGrade
    stress_type: Literal["tension", "compression", "shear"] = "tension"

class LapJointRequest(BaseModel):
    """Lap joint with double fillet welds"""
    throat_size: float = Field(..., gt=0, description="Throat size (mm)")
    weld_length: float = Field(..., gt=0, description="Length of each weld (mm)")
    applied_load: float = Field(..., gt=0, description="Applied load (kN)")
    eccentricity: float = Field(default=0, ge=0, description="Load eccentricity (mm)")
    electrode_grade: ElectrodeGrade
    parent_steel_grade: str

class TeeJointRequest(BaseModel):
    """T-joint or cruciform joint"""
    throat_size: float = Field(..., gt=0)
    weld_length: float = Field(..., gt=0)
    vertical_load: float = Field(default=0)
    horizontal_load: float = Field(default=0)
    moment: float = Field(default=0, description="Applied moment (kNm)")
    electrode_grade: ElectrodeGrade
    parent_steel_grade: str

# Response Models
class WeldDesignResponse(BaseModel):
    """Weld design calculation results"""
    weld_type: str
    throat_size: float
    weld_length: float
    design_strength_pw: float
    longitudinal_capacity: float
    transverse_capacity: float
    applied_stress: float
    utilization_ratio: float
    passed: bool
    design_capacity: float
    safety_factor: float
    
class LapJointResponse(BaseModel):
    """Lap joint design results"""
    throat_size: float
    total_weld_length: float
    design_strength: float
    direct_shear_stress: float
    moment_induced_stress: float
    total_stress: float
    capacity: float
    utilization_ratio: float
    passed: bool

class TeeJointResponse(BaseModel):
    """T-joint design results"""
    throat_size: float
    weld_length: float
    resultant_force: float
    resultant_stress: float
    design_strength: float
    capacity: float
    utilization_ratio: float
    passed: bool

# Material Properties
ELECTRODE_STRENGTHS = {
    ElectrodeGrade.E35: 350,
    ElectrodeGrade.E42: 420,
    ElectrodeGrade.E51: 510
}

STEEL_GRADES = {
    "S275": 275,
    "S355": 355,
    "S450": 450
}

# Design Functions
def calculate_design_strength_pw(electrode_grade: ElectrodeGrade, parent_grade: str) -> float:
    """
    Calculate design strength pw for weld (BS 5950-1:2000 Cl 6.9.2)
    pw = min(electrode strength / 1.5, 0.5 * parent steel py)
    """
    electrode_strength = ELECTRODE_STRENGTHS[electrode_grade]
    parent_py = STEEL_GRADES.get(parent_grade, 275)
    
    # BS 5950 Cl 6.9.2: pw = min(uw / 1.5, 0.5 * py)
    # where uw is the ultimate tensile strength of the weld
    pw_electrode = electrode_strength / 1.5
    pw_parent = 0.5 * parent_py
    
    return min(pw_electrode, pw_parent)

def design_fillet_weld(request: FilletWeldRequest) -> WeldDesignResponse:
    """
    Design fillet weld according to BS 5950-1:2000 Cl 6.9
    
    For fillet welds:
    - Longitudinal capacity: Pw = pw * a * Lw
    - Transverse capacity: Pw = pw * a * Lw * 1.25 (25% increase)
    where a = throat size, Lw = effective length
    """
    a = request.throat_size  # mm
    Lw = request.weld_length  # mm
    Fl = request.longitudinal_force  # kN
    Ft = request.transverse_force  # kN
    
    # Design strength
    pw = calculate_design_strength_pw(request.electrode_grade, request.parent_steel_grade)
    
    # Effective area
    Aw = a * Lw  # mm²
    
    # Capacities (BS 5950 Cl 6.9.2)
    # Longitudinal: Pw = pw * a * Lw / 1000
    longitudinal_capacity = (pw * a * Lw) / 1000  # kN
    
    # Transverse: 1.25 times longitudinal (BS 5950 allows 25% increase)
    transverse_capacity = longitudinal_capacity * 1.25  # kN
    
    # Calculate resultant stress
    if request.position == WeldPosition.LONGITUDINAL:
        applied_force = math.sqrt(Fl**2 + Ft**2)
        design_capacity = longitudinal_capacity
    else:  # Transverse
        applied_force = math.sqrt(Fl**2 + Ft**2)
        design_capacity = transverse_capacity
    
    applied_stress = (applied_force * 1000) / Aw if Aw > 0 else 0  # N/mm²
    
    # Utilization ratio
    utilization_ratio = applied_force / design_capacity if design_capacity > 0 else float('inf')
    passed = utilization_ratio <= 1.0
    
    # Safety factor
    safety_factor = design_capacity / applied_force if applied_force > 0 else float('inf')
    
    return WeldDesignResponse(
        weld_type="Fillet Weld",
        throat_size=a,
        weld_length=Lw,
        design_strength_pw=round(pw, 2),
        longitudinal_capacity=round(longitudinal_capacity, 2),
        transverse_capacity=round(transverse_capacity, 2),
        applied_stress=round(applied_stress, 2),
        utilization_ratio=round(utilization_ratio * 100, 1),
        passed=passed,
        design_capacity=round(design_capacity, 2),
        safety_factor=round(safety_factor, 2)
    )

def design_butt_weld(request: ButtWeldRequest) -> WeldDesignResponse:
    """
    Design butt weld according to BS 5950-1:2000 Cl 6.9.4
    
    Full penetration butt welds: Designed as parent material
    Partial penetration: Use throat thickness
    """
    a = request.throat_size  # mm
    Lw = request.weld_length  # mm
    P = request.applied_force  # kN
    
    parent_py = STEEL_GRADES.get(request.parent_steel_grade, 275)
    
    if request.weld_type == "butt_full_penetration":
        # Full penetration - use parent material strength
        design_strength = parent_py
        effective_area = a * Lw
    else:
        # Partial penetration - use pw
        design_strength = calculate_design_strength_pw(request.electrode_grade, request.parent_steel_grade)
        effective_area = a * Lw
    
    # Capacity
    if request.stress_type == "tension":
        capacity = (design_strength * effective_area) / 1000  # kN
    elif request.stress_type == "compression":
        capacity = (design_strength * effective_area) / 1000  # kN
    else:  # shear
        capacity = (0.6 * design_strength * effective_area) / 1000  # kN
    
    applied_stress = (P * 1000) / effective_area if effective_area > 0 else 0
    utilization_ratio = P / capacity if capacity > 0 else float('inf')
    passed = utilization_ratio <= 1.0
    safety_factor = capacity / P if P > 0 else float('inf')
    
    return WeldDesignResponse(
        weld_type="Butt Weld - " + request.weld_type.replace("_", " ").title(),
        throat_size=a,
        weld_length=Lw,
        design_strength_pw=round(design_strength, 2),
        longitudinal_capacity=round(capacity, 2),
        transverse_capacity=round(capacity, 2),
        applied_stress=round(applied_stress, 2),
        utilization_ratio=round(utilization_ratio * 100, 1),
        passed=passed,
        design_capacity=round(capacity, 2),
        safety_factor=round(safety_factor, 2)
    )

def design_lap_joint(request: LapJointRequest) -> LapJointResponse:
    """
    Design lap joint with double fillet welds
    Considers direct shear and moment from eccentricity
    """
    a = request.throat_size
    L = request.weld_length
    P = request.applied_load
    e = request.eccentricity
    
    pw = calculate_design_strength_pw(request.electrode_grade, request.parent_steel_grade)
    
    # Total weld length (both sides)
    total_length = 2 * L
    
    # Effective area
    Aw = a * total_length
    
    # Direct shear stress
    tau_direct = (P * 1000) / Aw  # N/mm²
    
    # Moment induced stress (if eccentric)
    M = P * e  # kN.mm
    if e > 0:
        # Section modulus of weld group
        Zw = (2 * a * L**2) / 6  # mm³
        tau_moment = (M * 1000) / Zw  # N/mm²
    else:
        tau_moment = 0
    
    # Total stress
    total_stress = tau_direct + tau_moment
    
    # Capacity
    capacity = (pw * Aw) / 1000  # kN
    
    utilization_ratio = total_stress / pw if pw > 0 else float('inf')
    passed = utilization_ratio <= 1.0
    
    return LapJointResponse(
        throat_size=a,
        total_weld_length=total_length,
        design_strength=round(pw, 2),
        direct_shear_stress=round(tau_direct, 2),
        moment_induced_stress=round(tau_moment, 2),
        total_stress=round(total_stress, 2),
        capacity=round(capacity, 2),
        utilization_ratio=round(utilization_ratio * 100, 1),
        passed=passed
    )

def design_tee_joint(request: TeeJointRequest) -> TeeJointResponse:
    """
    Design T-joint or cruciform joint with fillet welds
    """
    a = request.throat_size
    L = request.weld_length
    Fv = request.vertical_load
    Fh = request.horizontal_load
    M = request.moment * 1000  # Convert to kN.mm
    
    pw = calculate_design_strength_pw(request.electrode_grade, request.parent_steel_grade)
    
    # Resultant force
    F_resultant = math.sqrt(Fv**2 + Fh**2)
    
    # Add moment effect if present
    if M > 0:
        # Approximate stress from moment
        Z_weld = (a * L**2) / 6
        moment_force = M / (L / 2)  # Approximate
        F_resultant = math.sqrt(F_resultant**2 + moment_force**2)
    
    # Effective area
    Aw = a * L * 2  # Two welds
    
    # Stress
    stress = (F_resultant * 1000) / Aw if Aw > 0 else 0
    
    # Capacity
    capacity = (pw * Aw) / 1000
    
    utilization_ratio = stress / pw if pw > 0 else float('inf')
    passed = utilization_ratio <= 1.0
    
    return TeeJointResponse(
        throat_size=a,
        weld_length=L,
        resultant_force=round(F_resultant, 2),
        resultant_stress=round(stress, 2),
        design_strength=round(pw, 2),
        capacity=round(capacity, 2),
        utilization_ratio=round(utilization_ratio * 100, 1),
        passed=passed
    )

# Minimum weld size recommendations (BS 5950)
def minimum_fillet_weld_size(plate_thickness: float) -> float:
    """
    Minimum fillet weld size based on plate thickness
    BS 5950 Table 37
    """
    if plate_thickness <= 10:
        return 3
    elif plate_thickness <= 20:
        return 5
    elif plate_thickness <= 30:
        return 6
    elif plate_thickness <= 50:
        return 8
    else:
        return 10

def maximum_fillet_weld_size(plate_thickness: float) -> float:
    """
    Maximum fillet weld size for edge of plate
    Generally t - 1.5 mm where t is plate thickness
    """
    return max(plate_thickness - 1.5, 3)
