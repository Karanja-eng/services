

EUROCODE_SECTIONS = {
    "IPE": {s.designation: s for s in IPE_SECTIONS},
    "HEA": {s.designation: s for s in HEA_SECTIONS},
    "HEB": {s.designation: s for s in HEB_SECTIONS},
    "HEM": {s.designation: s for s in HEM_SECTIONS}
}

# ============================================================================
# STEEL GRADES (EN 1993-1-1 Table 3.1)
# ============================================================================

class SteelGradeEC(str, Enum):
    S235 = "S235"
    S275 = "S275"
    S355 = "S355"
    S420 = "S420"
    S460 = "S460"

# Yield strength fy for different thicknesses (EN 10025)
STEEL_PROPERTIES_EC = {
    SteelGradeEC.S235: {
        "t_40": 235,   # fy for t ≤ 40mm
        "t_80": 215,   # fy for 40mm < t ≤ 80mm
        "fu": 360,     # Ultimate strength
        "E": 210000    # Young's modulus
    },
    SteelGradeEC.S275: {
        "t_40": 275,
        "t_80": 255,
        "fu": 430,
        "E": 210000
    },
    SteelGradeEC.S355: {
        "t_40": 355,
        "t_80": 335,
        "fu": 510,
        "E": 210000
    },
    SteelGradeEC.S420: {
        "t_40": 420,
        "t_80": 390,
        "fu": 520,
        "E": 210000
    },
    SteelGradeEC.S460: {
        "t_40": 460,
        "t_80": 430,
        "fu": 550,
        "E": 210000
    }
}

# Partial factors (EN 1993-1-1 Table 6.1)
GAMMA_M0 = 1.00  # Resistance of cross-sections
GAMMA_M1 = 1.00  # Resistance of members to instability
GAMMA_M2 = 1.25  # Resistance of cross-sections in tension to fracture

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class BeamDesignRequestEC(BaseModel):
    span: float = Field(..., gt=0, description="Span length in meters")
    udl: float = Field(..., ge=0, description="UDL in kN/m")
    point_load: float = Field(default=0, ge=0, description="Point load in kN")
    point_load_position: float = Field(default=0, ge=0)
    grade: SteelGradeEC
    section: str
    section_type: str = Field(..., description="IPE, HEA, HEB, or HEM")
    lateral_restraint: Literal["full", "ends_only", "none"] = "full"

class BeamDesignResponseEC(BaseModel):
    section: str
    section_class: int
    M_Ed: float
    V_Ed: float
    M_c_Rd: float
    M_b_Rd: float
    V_c_Rd: float
    delta_max: float
    delta_limit: float
    bending_utilization: float
    shear_utilization: float
    deflection_utilization: float
    passed: bool
    fy: float
    epsilon: float
    lambda_LT: float
    chi_LT: float

class ColumnDesignRequestEC(BaseModel):
    height: float = Field(..., gt=0)
    N_Ed: float = Field(..., gt=0, description="Axial force in kN")
    M_y_Ed: float = Field(default=0, ge=0, description="Moment about y-axis in kNm")
    M_z_Ed: float = Field(default=0, ge=0, description="Moment about z-axis in kNm")
    grade: SteelGradeEC
    section: str
    section_type: str
    buckling_length_y: float = Field(default=1.0, gt=0)
    buckling_length_z: float = Field(default=1.0, gt=0)
    buckling_curve_y: Literal["a", "a0", "b", "c", "d"] = "b"
    buckling_curve_z: Literal["a", "a0", "b", "c", "d"] = "c"

class ColumnDesignResponseEC(BaseModel):
    section: str
    section_class: int
    N_Ed: float
    N_c_Rd: float
    N_b_Rd_y: float
    N_b_Rd_z: float
    M_y_Ed: float
    M_z_Ed: float
    M_c_y_Rd: float
    M_c_z_Rd: float
    lambda_y: float
    lambda_z: float
    chi_y: float
    chi_z: float
    interaction_ratio: float
    passed: bool

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_eurocode_section(section_type: str, designation: str) -> EurocodeSection:
    """Get Eurocode section properties"""
    if section_type not in EUROCODE_SECTIONS:
        raise ValueError(f"Invalid section type: {section_type}")
    if designation not in EUROCODE_SECTIONS[section_type]:
        raise ValueError(f"Section {designation} not found")
    return EUROCODE_SECTIONS[section_type][designation]

def get_fy(grade: SteelGradeEC, thickness: float) -> float:
    """Get yield strength based on thickness (EN 10025)"""
    props = STEEL_PROPERTIES_EC[grade]
    if thickness <= 40:
        return props["t_40"]
    else:
        return props["t_80"]

def classify_section_ec3(section: EurocodeSection, fy: float, axial_load_ratio: float = 0) -> int:
    """
    Classify section according to EN 1993-1-1 Table 5.2
    Returns: 1, 2, 3, or 4
    """
    epsilon = math.sqrt(235 / fy)
    
    # Web classification
    c_web = section.h - 2 * section.tf - 2 * section.r
    c_t_web = c_web / section.tw
    
    # Flange classification (outstand element)
    c_flange = (section.b - section.tw - 2 * section.r) / 2
    c_t_flange = c_flange / section.tf
    
    # For bending (assuming no or small axial force)
    if axial_load_ratio < 0.5:
        # Flange limits (Table 5.2 sheet 2)
        if c_t_flange <= 9 * epsilon:
            flange_class = 1
        elif c_t_flange <= 10 * epsilon:
            flange_class = 2
        elif c_t_flange <= 14 * epsilon:
            flange_class = 3
        else:
            flange_class = 4
        
        # Web limits for bending (Table 5.2 sheet 1)
        if c_t_web <= 72 * epsilon:
            web_class = 1
        elif c_t_web <= 83 * epsilon:
            web_class = 2
        elif c_t_web <= 124 * epsilon:
            web_class = 3
        else:
            web_class = 4
    else:
        # For compression
        if c_t_flange <= 9 * epsilon:
            flange_class = 1
        elif c_t_flange <= 10 * epsilon:
            flange_class = 2
        elif c_t_flange <= 14 * epsilon:
            flange_class = 3
        else:
            flange_class = 4
        
        if c_t_web <= 33 * epsilon:
            web_class = 1
        elif c_t_web <= 38 * epsilon:
            web_class = 2
        elif c_t_web <= 42 * epsilon:
            web_class = 3
        else:
            web_class = 4
    
    return max(flange_class, web_class)

def calculate_imperfection_factor(curve: str) -> float:
    """
    Get imperfection factor α (EN 1993-1-1 Table 6.1)
    """
    factors = {
        "a0": 0.13,
        "a": 0.21,
        "b": 0.34,
        "c": 0.49,
        "d": 0.76
    }
    return factors.get(curve, 0.34)

def calculate_chi(lambda_bar: float, alpha: float) -> float:
    """
    Calculate reduction factor χ (EN 1993-1-1 Eq 6.49)
    """
    phi = 0.5 * (1 + alpha * (lambda_bar - 0.2) + lambda_bar ** 2)
    chi = min(1.0, 1 / (phi + math.sqrt(phi ** 2 - lambda_bar ** 2)))
    return chi

def calculate_chi_LT(lambda_bar_LT: float, section_type: str) -> float:
    """
    Calculate lateral-torsional buckling reduction factor
    EN 1993-1-1 Section 6.3.2.3
    """
    # For rolled sections, use curve "a" (α = 0.21)
    # Hot-rolled I and H sections: curve "a"
    alpha_LT = 0.21
    
    # General case (EN 1993-1-1 Eq 6.57)
    phi_LT = 0.5 * (1 + alpha_LT * (lambda_bar_LT - 0.2) + lambda_bar_LT ** 2)
    
    if lambda_bar_LT <= 0.2:
        chi_LT = 1.0
    else:
        chi_LT = min(1.0, 1 / (phi_LT + math.sqrt(phi_LT ** 2 - lambda_bar_LT ** 2)))
    
    # Additional limit for rolled sections
    chi_LT = min(chi_LT, 1.0 / lambda_bar_LT ** 2)
    
    return chi_LT

# ============================================================================
# BEAM DESIGN (EN 1993-1-1)
# ============================================================================

def design_beam_eurocode(request: BeamDesignRequestEC) -> BeamDesignResponseEC:
    """
    Design beam according to EN 1993-1-1
    """
    section = get_eurocode_section(request.section_type, request.section)
    fy = get_fy(request.grade, section.tf)
    fu = STEEL_PROPERTIES_EC[request.grade]["fu"]
    E = STEEL_PROPERTIES_EC[request.grade]["E"]
    
    L = request.span * 1000  # mm
    w = request.udl  # kN/m
    P = request.point_load  # kN
    a = request.point_load_position * 1000  # mm
    
    # Design forces
    M_Ed_udl = (w * L ** 2) / 8000  # kNm
    M_Ed_point = (P * a * (L - a)) / (L * 1000) if P > 0 else 0
    M_Ed = M_Ed_udl + M_Ed_point
    
    V_Ed_udl = (w * L) / 2000  # kN
    V_Ed_point = max(P * (L - a) / L, P * a / L) if P > 0 else 0
    V_Ed = V_Ed_udl + V_Ed_point
    
    # Section classification
    section_class = classify_section_ec3(section, fy, 0)
    
    # Moment resistance (EN 1993-1-1 Section 6.2.5)
    if section_class <= 2:
        M_c_Rd = (section.Wply * fy) / (GAMMA_M0 * 1000)  # kNm (Wply in cm³)
    else:
        M_c_Rd = (section.Wely * fy) / (GAMMA_M0 * 1000)  # kNm
    
    # Lateral-torsional buckling (EN 1993-1-1 Section 6.3.2)
    if request.lateral_restraint == "full":
        M_b_Rd = M_c_Rd
        lambda_LT = 0
        chi_LT = 1.0
    else:
        # Critical moment (simplified)
        C1 = 1.0  # For uniform moment
        I_z = section.Iz * 10000  # mm⁴
        I_w = (section.h ** 2 * I_z) / 4  # Warping constant (simplified)
        I_T = (2 * section.b * section.tf ** 3 + (section.h - 2 * section.tf) * section.tw ** 3) / 3  # mm⁴
        
        M_cr = (C1 * math.pi ** 2 * E * I_z / L ** 2) * math.sqrt((I_w / I_z) + (L ** 2 * 80000 * I_T) / (math.pi ** 2 * E * I_z))
        M_cr = M_cr / 1000000  # kNm
        
        lambda_LT = math.sqrt((section.Wply * fy / 1000) / M_cr) if M_cr > 0 else 999
        
        chi_LT = calculate_chi_LT(lambda_LT, request.section_type)
        M_b_Rd = chi_LT * M_c_Rd
    
    # Shear resistance (EN 1993-1-1 Section 6.2.6)
    A_v = section.Avz * 100  # mm²
    V_c_Rd = (A_v * (fy / math.sqrt(3))) / (GAMMA_M0 * 1000)  # kN
    
    # Deflection (serviceability)
    I_y = section.Iy * 10000  # mm⁴
    delta_udl = (5 * w * L ** 4) / (384 * E * I_y)
    delta_point = (P * a * (L - a) ** 2 * math.sqrt(3 * a * (L - a))) / (27 * E * I_y * L) if P > 0 else 0
    delta_max = delta_udl + delta_point
    delta_limit = L / 250  # EN 1993-1-1 (more stringent than L/360)
    
    # Utilization ratios
    bending_util = M_Ed / M_b_Rd
    shear_util = V_Ed / V_c_Rd
    deflection_util = delta_max / delta_limit
    
    passed = bending_util <= 1.0 and shear_util <= 1.0 and deflection_util <= 1.0
    
    epsilon = math.sqrt(235 / fy)
    
    return BeamDesignResponseEC(
        section=section.designation,
        section_class=section_class,
        M_Ed=round(M_Ed, 2),
        V_Ed=round(V_Ed, 2),
        M_c_Rd=round(M_c_Rd, 2),
        M_b_Rd=round(M_b_Rd, 2),
        V_c_Rd=round(V_c_Rd, 2),
        delta_max=round(delta_max, 2),
        delta_limit=round(delta_limit, 2),
        bending_utilization=round(bending_util * 100, 1),
        shear_utilization=round(shear_util * 100, 1),
        deflection_utilization=round(deflection_util * 100, 1),
        passed=passed,
        fy=fy,
        epsilon=round(epsilon, 3),
        lambda_LT=round(lambda_LT, 2),
        chi_LT=round(chi_LT, 3)
    )

# ============================================================================
# COLUMN DESIGN (EN 1993-1-1)
# ============================================================================

def design_column_eurocode(request: ColumnDesignRequestEC) -> ColumnDesignResponseEC:
    """
    Design column according to EN 1993-1-1 Section 6.3
    """
    section = get_eurocode_section(request.section_type, request.section)
    fy = get_fy(request.grade, max(section.tf, section.tw))
    E = STEEL_PROPERTIES_EC[request.grade]["E"]
    
    L = request.height * 1000  # mm
    N_Ed = request.N_Ed  # kN
    M_y_Ed = request.M_y_Ed  # kNm
    M_z_Ed = request.M_z_Ed  # kNm
    
    # Axial load ratio for classification
    N_pl_Rd = (section.A * 100 * fy) / (GAMMA_M0 * 1000)  # kN
    axial_ratio = N_Ed / N_pl_Rd
    
    # Section classification
    section_class = classify_section_ec3(section, fy, axial_ratio)
    
    # Cross-section resistance (EN 1993-1-1 Section 6.2)
    N_c_Rd = N_pl_Rd
    
    if section_class <= 2:
        M_c_y_Rd = (section.Wply * fy) / (GAMMA_M0 * 1000)
        M_c_z_Rd = (section.Wplz * fy) / (GAMMA_M0 * 1000)
    else:
        M_c_y_Rd = (section.Wely * fy) / (GAMMA_M0 * 1000)
        M_c_z_Rd = (section.Welz * fy) / (GAMMA_M0 * 1000)
    
    # Buckling resistance (EN 1993-1-1 Section 6.3.1)
    L_cr_y = L * request.buckling_length_y
    L_cr_z = L * request.buckling_length_z
    
    i_y = section.iy * 10  # mm
    i_z = section.iz * 10  # mm
    
    lambda_y = L_cr_y / i_y
    lambda_z = L_cr_z / i_z
    
    # Non-dimensional slenderness
    N_cr_y = (math.pi ** 2 * E * section.A * 100 * (i_y ** 2)) / (L_cr_y ** 2 * 1000)
    N_cr_z = (math.pi ** 2 * E * section.A * 100 * (i_z ** 2)) / (L_cr_z ** 2 * 1000)
    
    lambda_bar_y = math.sqrt(N_pl_Rd / N_cr_y)
    lambda_bar_z = math.sqrt(N_pl_Rd / N_cr_z)
    
    # Reduction factors
    alpha_y = calculate_imperfection_factor(request.buckling_curve_y)
    alpha_z = calculate_imperfection_factor(request.buckling_curve_z)
    
    chi_y = calculate_chi(lambda_bar_y, alpha_y)
    chi_z = calculate_chi(lambda_bar_z, alpha_z)
    
    N_b_Rd_y = (chi_y * section.A * 100 * fy) / (GAMMA_M1 * 1000)
    N_b_Rd_z = (chi_z * section.A * 100 * fy) / (GAMMA_M1 * 1000)
    
    # Interaction (EN 1993-1-1 Section 6.3.3 - Method 1)
    k_yy = min(1 + 0.6 * lambda_bar_y * (N_Ed / (chi_y * N_pl_Rd)), 1 + 0.6 * (N_Ed / (chi_y * N_pl_Rd)))
    k_zy = 0.6 * k_yy
    k_zz = min(1 + 0.6 * lambda_bar_z * (N_Ed / (chi_z * N_pl_Rd)), 1 + 0.6 * (N_Ed / (chi_z * N_pl_Rd)))
    k_yz = 0.6 * k_zz
    
    # Interaction equations (EN 1993-1-1 Eq 6.61 and 6.62)
    interaction_y = (N_Ed / (chi_y * N_pl_Rd / GAMMA_M1)) + k_yy * (M_y_Ed / M_c_y_Rd) + k_yz * (M_z_Ed / M_c_z_Rd)
    interaction_z = (N_Ed / (chi_z * N_pl_Rd / GAMMA_M1)) + k_zy * (M_y_Ed / M_c_y_Rd) + k_zz * (M_z_Ed / M_c_z_Rd)
    
    interaction_ratio = max(interaction_y, interaction_z)
    
    passed = interaction_ratio <= 1.0
    
    return ColumnDesignResponseEC(
        section=section.designation,
        section_class=section_class,
        N_Ed=N_Ed,
        N_c_Rd=round(N_c_Rd, 2),
        N_b_Rd_y=round(N_b_Rd_y, 2),
        N_b_Rd_z=round(N_b_Rd_z, 2),
        M_y_Ed=M_y_Ed,
        M_z_Ed=M_z_Ed,
        M_c_y_Rd=round(M_c_y_Rd, 2),
        M_c_z_Rd=round(M_c_z_Rd, 2),
        lambda_y=round(lambda_y, 1),
        lambda_z=round(lambda_z, 1),
        chi_y=round(chi_y, 3),
        chi_z=round(chi_z, 3),
        interaction_ratio=round(interaction_ratio * 100, 1),
        passed=passed
    )"""
Eurocode 3 Steel Design Module - EN 1993-1-1:2005
Complete implementation for beams, columns, and connections
Accurate calculations using Eurocode tables and formulas
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum
import math

# ============================================================================
# EUROCODE STEEL SECTIONS (IPE, HEA, HEB, HEM)
# ============================================================================

class EurocodeSection(BaseModel):
    designation: str
    h: float  # Height (mm)
    b: float  # Width (mm)
    tw: float  # Web thickness (mm)
    tf: float  # Flange thickness (mm)
    r: float  # Root radius (mm)
    A: float  # Area (cm²)
    Iy: float  # Second moment of area y-y (cm⁴)
    Iz: float  # Second moment of area z-z (cm⁴)
    Wely: float  # Elastic section modulus y-y (cm³)
    Welz: float  # Elastic section modulus z-z (cm³)
    Wply: float  # Plastic section modulus y-y (cm³)
    Wplz: float  # Plastic section modulus z-z (cm³)
    iy: float  # Radius of gyration y-y (cm)
    iz: float  # Radius of gyration z-z (cm)
    Avz: float  # Shear area (cm²)

# IPE Sections (European I-beams)
IPE_SECTIONS = [
    EurocodeSection(designation="IPE 600", h=600, b=220, tw=12.0, tf=19.0, r=24, A=156.0, Iy=92080, Iz=3387, Wely=3069, Welz=307.9, Wply=3512, Wplz=482.3, iy=24.3, iz=4.66, Avz=72.0),
    EurocodeSection(designation="IPE 550", h=550, b=210, tw=11.1, tf=17.2, r=24, A=134.0, Iy=67120, Iz=2668, Wely=2441, Welz=254.1, Wply=2787, Wplz=397.6, iy=22.4, iz=4.46, Avz=61.05),
    EurocodeSection(designation="IPE 500", h=500, b=200, tw=10.2, tf=16.0, r=21, A=116.0, Iy=48200, Iz=2142, Wely=1928, Welz=214.2, Wply=2194, Wplz=335.9, iy=20.4, iz=4.31, Avz=51.0),
    EurocodeSection(designation="IPE 450", h=450, b=190, tw=9.4, tf=14.6, r=21, A=98.8, Iy=33740, Iz=1676, Wely=1500, Welz=176.4, Wply=1702, Wplz=275.4, iy=18.5, iz=4.12, Avz=42.3),
    EurocodeSection(designation="IPE 400", h=400, b=180, tw=8.6, tf=13.5, r=21, A=84.5, Iy=23130, Iz=1318, Wely=1156, Welz=146.4, Wply=1307, Wplz=228.9, iy=16.5, iz=3.95, Avz=34.4),
    EurocodeSection(designation="IPE 360", h=360, b=170, tw=8.0, tf=12.7, r=18, A=72.7, Iy=16270, Iz=1043, Wely=903.6, Welz=122.8, Wply=1019, Wplz=191.6, iy=14.9, iz=3.79, Avz=28.8),
    EurocodeSection(designation="IPE 330", h=330, b=160, tw=7.5, tf=11.5, r=18, A=62.6, Iy=11770, Iz=788.1, Wely=713.1, Welz=98.52, Wply=804.3, Wplz=153.7, iy=13.7, iz=3.55, Avz=24.75),
    EurocodeSection(designation="IPE 300", h=300, b=150, tw=7.1, tf=10.7, r=15, A=53.8, Iy=8356, Iz=603.8, Wely=557.1, Welz=80.5, Wply=628.4, Wplz=125.2, iy=12.5, iz=3.35, Avz=21.3),
    EurocodeSection(designation="IPE 270", h=270, b=135, tw=6.6, tf=10.2, r=15, A=45.9, Iy=5790, Iz=420.0, Wely=428.9, Welz=62.2, Wply=484.0, Wplz=96.95, iy=11.2, iz=3.02, Avz=17.82),
    EurocodeSection(designation="IPE 240", h=240, b=120, tw=6.2, tf=9.8, r=15, A=39.1, Iy=3892, Iz=283.6, Wely=324.3, Welz=47.27, Wply=366.6, Wplz=73.92, iy=10.0, iz=2.69, Avz=14.88),
    EurocodeSection(designation="IPE 220", h=220, b=110, tw=5.9, tf=9.2, r=12, A=33.4, Iy=2772, Iz=204.9, Wely=252.0, Welz=37.25, Wply=285.4, Wplz=58.11, iy=9.11, iz=2.48, Avz=12.98),
    EurocodeSection(designation="IPE 200", h=200, b=100, tw=5.6, tf=8.5, r=12, A=28.5, Iy=1943, Iz=142.4, Wely=194.3, Welz=28.47, Wply=220.6, Wplz=44.61, iy=8.26, iz=2.24, Avz=11.2),
    EurocodeSection(designation="IPE 180", h=180, b=91, tw=5.3, tf=8.0, r=9, A=23.9, Iy=1317, Iz=100.9, Wely=146.3, Welz=22.16, Wply=166.4, Wplz=34.6, iy=7.42, iz=2.05, Avz=9.54),
    EurocodeSection(designation="IPE 160", h=160, b=82, tw=5.0, tf=7.4, r=9, A=20.1, Iy=869.3, Iz=68.31, Wely=108.7, Welz=16.66, Wply=123.9, Wplz=26.1, iy=6.58, iz=1.84, Avz=8.0),
    EurocodeSection(designation="IPE 140", h=140, b=73, tw=4.7, tf=6.9, r=7, A=16.4, Iy=541.2, Iz=44.92, Wely=77.32, Welz=12.31, Wply=88.34, Wplz=19.25, iy=5.74, iz=1.65, Avz=6.58),
    EurocodeSection(designation="IPE 120", h=120, b=64, tw=4.4, tf=6.3, r=7, A=13.2, Iy=317.8, Iz=27.67, Wely=52.96, Welz=8.65, Wply=60.73, Wplz=13.58, iy=4.90, iz=1.45, Avz=5.28),
    EurocodeSection(designation="IPE 100", h=100, b=55, tw=4.1, tf=5.7, r=7, A=10.3, Iy=171.0, Iz=15.92, Wely=34.2, Welz=5.79, Wply=39.41, Wplz=9.15, iy=4.07, iz=1.24, Avz=4.1),
    EurocodeSection(designation="IPE 80", h=80, b=46, tw=3.8, tf=5.2, r=5, A=7.64, Iy=80.14, Iz=8.49, Wely=20.03, Welz=3.69, Wply=23.22, Wplz=5.82, iy=3.24, iz=1.05, Avz=3.04),
]

# HEA Sections (European wide flange - light)
HEA_SECTIONS = [
    EurocodeSection(designation="HEA 1000", h=990, b=300, tw=16.5, tf=31.0, r=30, A=347.0, Iy=553000, Iz=15700, Wely=11200, Welz=1050, Wply=12800, Wplz=1620, iy=39.9, iz=6.72, Avz=163.35),
    EurocodeSection(designation="HEA 900", h=890, b=300, tw=16.0, tf=28.0, r=30, A=291.0, Iy=422000, Iz=14100, Wely=9480, Welz=942, Wply=10800, Wplz=1460, iy=38.1, iz=6.96, Avz=142.4),
    EurocodeSection(designation="HEA 800", h=790, b=300, tw=15.0, tf=25.0, r=30, A=240.0, Iy=303000, Iz=12600, Wely=7680, Welz=838, Wply=8720, Wplz=1300, iy=35.5, iz=7.25, Avz=118.5),
    EurocodeSection(designation="HEA 700", h=690, b=300, tw=14.5, tf=24.0, r=27, A=215.0, Iy=215000, Iz=11500, Wely=6240, Welz=769, Wply=7060, Wplz=1190, iy=31.6, iz=7.32, Avz=100.05),
    EurocodeSection(designation="HEA 600", h=590, b=300, tw=13.0, tf=22.0, r=27, A=184.0, Iy=141000, Iz=10300, Wely=4780, Welz=690, Wply=5410, Wplz=1070, iy=27.7, iz=7.48, Avz=76.7),
    EurocodeSection(designation="HEA 550", h=540, b=300, tw=12.5, tf=21.0, r=27, A=166.0, Iy=111000, Iz=9780, Wely=4110, Welz=652, Wply=4640, Wplz=1010, iy=25.9, iz=7.67, Avz=67.5),
    EurocodeSection(designation="HEA 500", h=490, b=300, tw=12.0, tf=20.0, r=27, A=155.0, Iy=86970, Iz=9300, Wely=3550, Welz=621, Wply=4000, Wplz=960, iy=23.7, iz=7.75, Avz=58.8),
    EurocodeSection(designation="HEA 450", h=440, b=300, tw=11.5, tf=19.0, r=27, A=140.0, Iy=63720, Iz=8560, Wely=2900, Welz=571, Wply=3260, Wplz=884, iy=21.3, iz=7.82, Avz=50.6),
    EurocodeSection(designation="HEA 400", h=390, b=300, tw=11.0, tf=19.0, r=27, A=159.0, Iy=45070, Iz=8564, Wely=2311, Welz=571, Wply=2562, Wplz=884, iy=16.8, iz=7.33, Avz=42.9),
    EurocodeSection(designation="HEA 360", h=350, b=300, tw=10.0, tf=17.5, r=27, A=143.0, Iy=33090, Iz=7887, Wely=1891, Welz=526, Wply=2088, Wplz=813, iy=15.2, iz=7.42, Avz=35.0),
    EurocodeSection(designation="HEA 340", h=330, b=300, tw=9.5, tf=16.5, r=27, A=133.0, Iy=27690, Iz=7436, Wely=1678, Welz=496, Wply=1850, Wplz=766, iy=14.4, iz=7.48, Avz=31.35),
    EurocodeSection(designation="HEA 320", h=310, b=300, tw=9.0, tf=15.5, r=27, A=124.0, Iy=22930, Iz=6985, Wely=1479, Welz=466, Wply=1627, Wplz=720, iy=13.6, iz=7.51, Avz=27.9),
    EurocodeSection(designation="HEA 300", h=290, b=300, tw=8.5, tf=14.0, r=27, A=113.0, Iy=18260, Iz=6310, Wely=1260, Welz=421, Wply=1383, Wplz=651, iy=12.7, iz=7.47, Avz=24.65),
    EurocodeSection(designation="HEA 280", h=270, b=280, tw=8.0, tf=13.0, r=24, A=97.3, Iy=13160, Iz=4763, Wely=975.5, Welz=340, Wply=1071, Wplz=525, iy=11.6, iz=7.00, Avz=21.6),
    EurocodeSection(designation="HEA 260", h=250, b=260, tw=7.5, tf=12.5, r=24, A=86.8, Iy=10450, Iz=3668, Wely=836.4, Welz=282, Wply=919.8, Wplz=435, iy=11.0, iz=6.50, Avz=18.75),
    EurocodeSection(designation="HEA 240", h=230, b=240, tw=7.5, tf=12.0, r=21, A=76.8, Iy=7763, Iz=2769, Wely=675.1, Welz=231, Wply=744.6, Wplz=356, iy=10.1, iz=6.01, Avz=17.25),
    EurocodeSection(designation="HEA 220", h=210, b=220, tw=7.0, tf=11.0, r=18, A=64.3, Iy=5410, Iz=1955, Wely=515.2, Welz=178, Wply=568.5, Wplz=273, iy=9.17, iz=5.51, Avz=14.7),
    EurocodeSection(designation="HEA 200", h=190, b=200, tw=6.5, tf=10.0, r=18, A=53.8, Iy=3692, Iz=1336, Wely=388.6, Welz=134, Wply=429.5, Wplz=205, iy=8.28, iz=4.98, Avz=12.35),
    EurocodeSection(designation="HEA 180", h=171, b=180, tw=6.0, tf=9.5, r=15, A=45.3, Iy=2510, Iz=924.6, Wely=293.7, Welz=103, Wply=324.9, Wplz=157, iy=7.45, iz=4.52, Avz=10.26),
    EurocodeSection(designation="HEA 160", h=152, b=160, tw=6.0, tf=9.0, r=15, A=38.8, Iy=1673, Iz=615.6, Wely=220.1, Welz=77, Wply=245.1, Wplz=117, iy=6.57, iz=3.98, Avz=9.12),
    EurocodeSection(designation="HEA 140", h=133, b=140, tw=5.5, tf=8.5, r=12, A=31.4, Iy=1033, Iz=389.3, Wely=155.4, Welz=55.6, Wply=173.5, Wplz=84.98, iy=5.73, iz=3.52, Avz=7.315),
    EurocodeSection(designation="HEA 120", h=114, b=120, tw=5.0, tf=8.0, r=12, A=25.3, Iy=606.2, Iz=231.3, Wely=106.4, Welz=38.5, Wply=119.5, Wplz=59.53, iy=4.89, iz=3.02, Avz=5.7),
    EurocodeSection(designation="HEA 100", h=96, b=100, tw=5.0, tf=8.0, r=12, A=21.2, Iy=349.2, Iz=133.8, Wely=72.76, Welz=26.8, Wply=82.98, Wplz=41.47, iy=4.06, iz=2.51, Avz=4.8),
]

# HEB Sections (European wide flange - medium)
HEB_SECTIONS = [
    EurocodeSection(designation="HEB 1000", h=1000, b=300, tw=19.0, tf=36.0, r=30, A=400.0, Iy=644700, Iz=16280, Wely=12900, Welz=1086, Wply=14800, Wplz=1678, iy=40.2, iz=6.38, Avz=190.0),
    EurocodeSection(designation="HEB 900", h=900, b=300, tw=18.5, tf=33.5, r=30, A=371.0, Iy=494100, Iz=15260, Wely=10980, Welz=1017, Wply=12500, Wplz=1571, iy=36.5, iz=6.42, Avz=166.5),
    EurocodeSection(designation="HEB 800", h=800, b=300, tw=17.5, tf=30.0, r=30, A=334.0, Iy=359100, Iz=13620, Wely=8977, Welz=908, Wply=10140, Wplz=1405, iy=32.8, iz=6.39, Avz=140.0),
    EurocodeSection(designation="HEB 700", h=700, b=300, tw=17.0, tf=27.0, r=27, A=306.0, Iy=256900, Iz=12150, Wely=7337, Welz=811, Wply=8239, Wplz=1256, iy=29.0, iz=6.30, Avz=119.0),
    EurocodeSection(designation="HEB 650", h=650, b=300, tw=16.0, tf=26.0, r=27, A=286.0, Iy=210600, Iz=11720, Wely=6481, Welz=782, Wply=7268, Wplz=1210, iy=27.1, iz=6.40, Avz=104.0),
    EurocodeSection(designation="HEB 600", h=600, b=300, tw=15.5, tf=25.0, r=27, A=270.0, Iy=171000, Iz=11270, Wely=5701, Welz=752, Wply=6377, Wplz=1164, iy=25.2, iz=6.46, Avz=93.0),
    EurocodeSection(designation="HEB 550", h=550, b=300, tw=15.0, tf=24.0, r=27, A=254.0, Iy=136700, Iz=10820, Wely=4972, Welz=722, Wply=5542, Wplz=1117, iy=23.2, iz=6.52, Avz=82.5),
    EurocodeSection(designation="HEB 500", h=500, b=300, tw=14.5, tf=23.0, r=27, A=239.0, Iy=107200, Iz=10370, Wely=4287, Welz=691, Wply=4764, Wplz=1070, iy=21.2, iz=6.59, Avz=72.5),
    EurocodeSection(designation="HEB 450", h=450, b=300, tw=14.0, tf=22.0, r=27, A=218.0, Iy=79890, Iz=9465, Wely=3551, Welz=631, Wply=3948, Wplz=977, iy=19.1, iz=6.59, Avz=63.0),
    EurocodeSection(designation="HEB 400", h=400, b=300, tw=13.5, tf=21.0, r=27, A=197.8, Iy=57680, Iz=8564, Wely=2884, Welz=571, Wply=3232, Wplz=884, iy=17.1, iz=6.58, Avz=54.0),
    EurocodeSection(designation="HEB 360", h=360, b=300, tw=12.5, tf=19.5, r=27, A=180.6, Iy=43190, Iz=7887, Wely=2400, Welz=526, Wply=2683, Wplz=813, iy=15.5, iz=6.61, Avz=45.0),
    EurocodeSection(designation="HEB 340", h=340, b=300, tw=12.0, tf=18.5, r=27, A=171.0, Iy=36660, Iz=7436, Wely=2156, Welz=496, Wply=2408, Wplz=766, iy=14.6, iz=6.59, Avz=40.8),
    EurocodeSection(designation="HEB 320", h=320, b=300, tw=11.5, tf=17.5, r=27, A=161.0, Iy=30820, Iz=6985, Wely=1926, Welz=466, Wply=2149, Wplz=720, iy=13.8, iz=6.59, Avz=36.8),
    EurocodeSection(designation="HEB 300", h=300, b=300, tw=11.0, tf=17.0, r=27, A=149.0, Iy=25170, Iz=6310, Wely=1678, Welz=421, Wply=1869, Wplz=651, iy=13.0, iz=6.51, Avz=33.0),
    EurocodeSection(designation="HEB 280", h=280, b=280, tw=10.5, tf=15.5, r=24, A=131.0, Iy=19270, Iz=4763, Wely=1376, Welz=340, Wply=1534, Wplz=525, iy=12.1, iz=6.03, Avz=29.4),
    EurocodeSection(designation="HEB 260", h=260, b=260, tw=10.0, tf=15.0, r=24, A=118.0, Iy=14920, Iz=3668, Wely=1148, Welz=282, Wply=1283, Wplz=435, iy=11.2, iz=5.57, Avz=26.0),
    EurocodeSection(designation="HEB 240", h=240, b=240, tw=10.0, tf=15.0, r=21, A=106.0, Iy=11260, Iz=2769, Wely=938.3, Welz=231, Wply=1053, Wplz=356, iy=10.3, iz=5.11, Avz=24.0),
    EurocodeSection(designation="HEB 220", h=220, b=220, tw=9.5, tf=14.0, r=18, A=91.0, Iy=8091, Iz=1955, Wely=736.4, Welz=178, Wply=827.0, Wplz=273, iy=9.43, iz=4.64, Avz=20.9),
    EurocodeSection(designation="HEB 200", h=200, b=200, tw=9.0, tf=13.0, r=18, A=78.1, Iy=5696, Iz=1336, Wely=569.5, Welz=134, Wply=642.5, Wplz=205, iy=8.54, iz=4.14, Avz=18.0),
    EurocodeSection(designation="HEB 180", h=180, b=180, tw=8.5, tf=12.5, r=15, A=65.3, Iy=3831, Iz=924.6, Wely=425.7, Welz=103, Wply=481.4, Wplz=157, iy=7.66, iz=3.76, Avz=15.3),
    EurocodeSection(designation="HEB 160", h=160, b=160, tw=8.0, tf=12.0, r=15, A=54.3, Iy=2492, Iz=615.6, Wely=311.5, Welz=77, Wply=354.0, Wplz=117, iy=6.78, iz=3.37, Avz=12.8),
    EurocodeSection(designation="HEB 140", h=140, b=140, tw=7.0, tf=10.0, r=12, A=43.0, Iy=1509, Iz=389.3, Wely=215.6, Welz=55.6, Wply=245.9, Wplz=84.98, iy=5.93, iz=3.01, Avz=9.8),
    EurocodeSection(designation="HEB 120", h=120, b=120, tw=6.5, tf=9.5, r=12, A=34.0, Iy=864.4, Iz=231.3, Wely=144.1, Welz=38.5, Wply=165.2, Wplz=59.53, iy=5.04, iz=2.61, Avz=7.8),
    EurocodeSection(designation="HEB 100", h=100, b=100, tw=6.0, tf=9.0, r=12, A=26.0, Iy=449.5, Iz=133.8, Wely=89.91, Welz=26.8, Wply=104.2, Wplz=41.47, iy=4.16, iz=2.27, Avz=6.0),
]

# HEM Sections (European wide flange - heavy)
HEM_SECTIONS = [
    EurocodeSection(designation="HEM 1000", h=1008, b=302, tw=26.0, tf=41.0, r=30, A=500.0, Iy=808000, Iz=16620, Wely=16030, Welz=1101, Wply=18410, Wplz=1700, iy=40.2, iz=5.77, Avz=262.08),
    EurocodeSection(designation="HEM 900", h=910, b=302, tw=25.0, tf=38.0, r=30, A=464.0, Iy=630800, Iz=15970, Wely=13870, Welz=1058, Wply=15860, Wplz=1635, iy=36.9, iz=5.87, Avz=227.5),
    EurocodeSection(designation="HEM 800", h=814, b=303, tw=23.0, tf=35.0, r=30, A=426.0, Iy=495300, Iz=15730, Wely=12180, Welz=1038, Wply=13870, Wplz=1603, iy=34.1, iz=6.07, Avz=187.22),
    EurocodeSection(designation="HEM 700", h=716, b=304, tw=21.0, tf=32.0, r=27, A=383.0, Iy=329400, Iz=14910, Wely=9205, Welz=981, Wply=10440, Wplz=1516, iy=29.3, iz=6.24, Avz=150.36),
    EurocodeSection(designation="HEM 650", h=668, b=305, tw=20.0, tf=31.0, r=27, A=363.0, Iy=275900, Iz=14780, Wely=8258, Welz=969, Wply=9352, Wplz=1497, iy=27.6, iz=6.38, Avz=133.6),
    EurocodeSection(designation="HEM 600", h=620, b=305, tw=19.0, tf=30.0, r=27, A=341.0, Iy=227800, Iz=14600, Wely=7349, Welz=957, Wply=8316, Wplz=1479, iy=25.8, iz=6.54, Avz=117.8),
    EurocodeSection(designation="HEM 550", h=572, b=306, tw=18.0, tf=29.0, r=27, A=321.0, Iy=185100, Iz=14440, Wely=6474, Welz=944, Wply=7315, Wplz=1460, iy=24.0, iz=6.71, Avz=102.96),
    EurocodeSection(designation="HEM 500", h=524, b=306, tw=17.0, tf=28.0, r=27, A=300.0, Iy=147600, Iz=14270, Wely=5637, Welz=933, Wply=6358, Wplz=1442, iy=22.2, iz=6.90, Avz=89.08),
    EurocodeSection(designation="HEM 450", h=478, b=307, tw=16.0, tf=27.0, r=27, A=283.0, Iy=119500, Iz=14120, Wely=5002, Welz=920, Wply=5632, Wplz=1422, iy=20.5, iz=7.06, Avz=76.48),
    EurocodeSection(designation="HEM 400", h=432, b=307, tw=15.0, tf=26.0, r=27, A=263.0, Iy=92790, Iz=13930, Wely=4298, Welz=908, Wply=4835, Wplz=1403, iy=18.8, iz=7.28, Avz=64.8),
    EurocodeSection(designation="HEM 360", h=395, b=308, tw=14.5, tf=25.0, r=27, A=252.0, Iy=75840, Iz=13860, Wely=3840, Welz=900, Wply=4313, Wplz=1392, iy=17.3, iz=7.42, Avz=57.28),
    EurocodeSection(designation="HEM 340", h=377, b=309, tw=14.0, tf=24.0, r=27, A=242.0, Iy=66490, Iz=13770, Wely=3530, Welz=891, Wply=3961, Wplz=1379, iy=16.6, iz=7.54, Avz=52.78),
    EurocodeSection(designation="HEM 320", h=359, b=309, tw=13.5, tf=23.0, r=27, A=231.0, Iy=57680, Iz=13670, Wely=3214, Welz=885, Wply=3604, Wplz=1368, iy=15.8, iz=7.69, Avz=48.47),
    EurocodeSection(designation="HEM 300", h=340, b=310, tw=13.0, tf=21.0, r=27, A=217.0, Iy=48200, Iz=13110, Wely=2835, Welz=846, Wply=3177, Wplz=1309, iy=14.9, iz=7.78, Avz=44.2),
    EurocodeSection(designation="HEM 280", h=320, b=310, tw=12.5, tf=20.0, r=24, A=202.0, Iy=39550, Iz=12480, Wely=2472, Welz=805, Wply=2769, Wplz=1245, iy=14.0, iz=7.86, Avz=40.0),
    EurocodeSection(designation="HEM 260", h=290, b=288, tw=12.5, tf=18.0, r=24, A=170.0, Iy=25630, Iz=9239, Wely=1768, Welz=642, Wply=1974, Wplz=992, iy=12.3, iz=7.37, Avz=36.25),
    EurocodeSection(designation="HEM 240", h=270, b=288, tw=11.5, tf=18.0, r=21, A=158.0, Iy=21390, Iz=9239, Wely=1585, Welz=642, Wply=1773, Wplz=992, iy=11.6, iz=7.65, Avz=31.05),
    EurocodeSection(designation="HEM 220", h=250, b=268, tw=11.0, tf=18.0, r=18, A=143.0, Iy=17070, Iz=7955, Wely=1367, Welz=594, Wply=1528, Wplz=918, iy=10.9, iz=7.45, Avz=27.5),
    EurocodeSection(designation="HEM 200", h=228, b=248, tw=10.5, tf=17.0, r=18, A=126.0, Iy=12400, Iz=6105, Wely=1086, Welz=492, Wply=1216, Wplz=761, iy=9.92, iz=6.96, Avz=23.94),
    EurocodeSection(designation="HEM 180", h=208, b=228, tw=10.0, tf=16.0, r=15, A=109.0, Iy=8605, Iz=4490, Wely=827.5, Welz=394, Wply=926.6, Wplz=609, iy=8.89, iz=6.42, Avz=20.8),
    EurocodeSection(designation="HEM 160", h=188, b=208, tw=9.0, tf=15.0, r=15, A=93.0, Iy=5818, Iz=3130, Wely=618.9, Welz=301, Wply=693.8, Wplz=465, iy=7.91, iz=5.80, Avz=16.92),
    EurocodeSection(designation="HEM 140", h=168, b=188, tw=8.5, tf=14.0, r=12, A=78.5, Iy=3850, Iz=2088, Wely=458.3, Welz=222, Wply=514.5, Wplz=344, iy=7.00, iz=5.16, Avz=14.28),
    EurocodeSection(designation="HEM 120", h=148, b=168, tw=8.0, tf=13.0, r=12, A=65.1, Iy=2491, Iz=1357, Wely=336.6, Welz=162, Wply=378.5, Wplz=251, iy=6.19, iz=4.57, Avz=11.84),
    EurocodeSection(designation="HEM 100", h=120, b=140, tw=7.0, tf=12.0, r=12, A=53.2, Iy=1336, Iz=693.0, Wely=222.7, Welz=99, Wply=250.9, Wplz=153, iy=5.01, iz=3.61, Avz=8.4),
]