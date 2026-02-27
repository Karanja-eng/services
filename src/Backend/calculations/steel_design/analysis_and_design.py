"""
Structural Steelwork Analysis and Design - Chapter 1 & 2
British Standards BS 5950 Era Implementation

This module implements fundamental structural mechanics equations and procedures
for steel design including:
- Bending stress in beams
- Shear stress in beams
- Torsional shear stress
- Strain energy calculations
- Theory of structures (trusses, frames, arches)
- Matrix methods for structural analysis
- Structural dynamics (SDOF systems)
- Plate analysis
- Plastic analysis methods
"""

import math
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass


# ============================================================================
# CHAPTER 1: STRENGTH OF MATERIALS
# ============================================================================

# 1.1 BENDING STRESS IN BEAMS

def bending_stress_circular_arc(
    y: float,
    E: float,
    R: float
) -> float:
    """
    Calculate bending stress at distance y from neutral axis on circular arc.
    
    Pure bending assumption: shear force is zero, bending moment is constant.
    Plane sections remain plane.
    
    Args:
        y: Distance from neutral axis to the point (m)
        E: Modulus of elasticity (N/m²)
        R: Radius of curvature (m)
    
    Returns:
        Bending stress sigma (N/m²)
    
    Reference: SK 1/2, Page 2
    """
    if R <= 0:
        raise ValueError("Radius of curvature must be positive")
    if E <= 0:
        raise ValueError("Modulus of elasticity must be positive")
    
    sigma = (E / R) * y
    return sigma


def bending_moment_from_stress(
    sigma: float,
    y: float,
    I: float,
    E: float,
    R: float
) -> float:
    """
    Calculate bending moment from stress distribution.
    
    M = (EI/R) where the relationship sigma/y = M/I = E/R holds.
    
    Args:
        sigma: Bending stress at distance y (N/m²)
        y: Distance from neutral axis (m)
        I: Moment of inertia about neutral axis (m⁴)
        E: Modulus of elasticity (N/m²)
        R: Radius of curvature (m)
    
    Returns:
        Bending moment M (Nm)
    
    Reference: Page 3
    """
    if I <= 0:
        raise ValueError("Moment of inertia must be positive")
    if R <= 0:
        raise ValueError("Radius of curvature must be positive")
    
    M = (E * I) / R
    
    # Verify relationship
    if y != 0:
        sigma_calc = M * y / I
        if not math.isclose(sigma_calc, sigma, rel_tol=0.01):
            raise ValueError(f"Inconsistent stress values: {sigma} vs {sigma_calc}")
    
    return M


def product_inertia_rectangle(b: float, d: float, X: float, Y: float) -> float:
    """
    Calculate product of inertia for a rectangle about orthogonal axes X-X and Y-Y.
    
    I_XY = b*d*X*Y where X and Y are coordinates of rectangle centroid
    from global X-X and Y-Y axes.
    
    Args:
        b: Width of rectangle (m)
        d: Depth of rectangle (m)
        X: X-coordinate of centroid from global Y-axis (m)
        Y: Y-coordinate of centroid from global X-axis (m)
    
    Returns:
        Product of inertia I_XY (m⁴)
    
    Reference: SK 1/4, Page 5
    """
    if b <= 0 or d <= 0:
        raise ValueError("Rectangle dimensions must be positive")
    
    I_XY = b * d * X * Y
    return I_XY


def principal_axes_angle(I_X: float, I_Y: float, I_XY: float) -> float:
    """
    Calculate angle of principal axes from X-X axis.
    
    tan(2θ) = 2*I_XY / (I_Y - I_X)
    
    Args:
        I_X: Moment of inertia about X-axis (m⁴)
        I_Y: Moment of inertia about Y-axis (m⁴)
        I_XY: Product of inertia (m⁴)
    
    Returns:
        Angle theta in radians (measured anticlockwise from X-axis)
    
    Reference: Page 5
    """
    if I_X <= 0 or I_Y <= 0:
        raise ValueError("Moments of inertia must be positive")
    
    if math.isclose(I_Y, I_X, rel_tol=1e-9):
        # Indeterminate case - section is already at principal axes
        return 0.0
    
    tan_2theta = (2 * I_XY) / (I_Y - I_X)
    theta = 0.5 * math.atan(tan_2theta)
    
    return theta


def principal_moments_of_inertia(
    I_X: float,
    I_Y: float,
    I_XY: float,
    theta: float
) -> Tuple[float, float]:
    """
    Calculate principal moments of inertia I_U and I_V.
    
    I_U = I_X*cos²θ - I_XY*sin(2θ) + I_Y*sin²θ
    I_V = I_Y*cos²θ + I_XY*sin(2θ) + I_X*sin²θ
    
    Also verifies: I_X + I_Y = I_U + I_V
    
    Args:
        I_X: Moment of inertia about X-axis (m⁴)
        I_Y: Moment of inertia about Y-axis (m⁴)
        I_XY: Product of inertia (m⁴)
        theta: Angle of principal axes from X-axis (radians)
    
    Returns:
        Tuple of (I_U, I_V) principal moments of inertia (m⁴)
    
    Reference: Page 4-5
    """
    if I_X <= 0 or I_Y <= 0:
        raise ValueError("Moments of inertia must be positive")
    
    cos_theta = math.cos(theta)
    sin_theta = math.sin(theta)
    sin_2theta = math.sin(2 * theta)
    
    I_U = I_X * cos_theta**2 - I_XY * sin_2theta + I_Y * sin_theta**2
    I_V = I_Y * cos_theta**2 + I_XY * sin_2theta + I_X * sin_theta**2
    
    # Verify invariant
    if not math.isclose(I_X + I_Y, I_U + I_V, rel_tol=1e-6):
        raise ValueError("Principal moments calculation error: sum invariant violated")
    
    return (I_U, I_V)


def bending_stress_angular_section(
    M_X: float,
    M_Y: float,
    u: float,
    v: float,
    I_U: float,
    I_V: float
) -> float:
    """
    Calculate bending stress at point (u,v) in angular section with principal axes U-U and V-V.
    
    sigma = M_U*v/I_V + M_V*u/I_U
    
    where M_U and M_V are resolved moments about principal axes.
    
    Args:
        M_X: Applied moment about X-axis (Nm)
        M_Y: Applied moment about Y-axis (Nm)
        u: u-coordinate along U principal axis (m)
        v: v-coordinate along V principal axis (m)
        I_U: Principal moment of inertia about U-U axis (m⁴)
        I_V: Principal moment of inertia about V-V axis (m⁴)
    
    Returns:
        Bending stress sigma (N/m²), compression positive
    
    Reference: SK 1/6, Page 6-7
    """
    if I_U <= 0 or I_V <= 0:
        raise ValueError("Principal moments of inertia must be positive")
    
    # Note: M_U and M_V must be resolved from M_X and M_Y using rotation
    # For this function, assume M_U and M_V are already provided via M_X and M_Y
    M_U = M_X
    M_V = M_Y
    
    sigma = (M_U * v) / I_V + (M_V * u) / I_U
    
    return sigma


# 1.2 SHEAR STRESS IN BEAMS

def shear_stress_beam(
    V: float,
    Q: float,
    I: float,
    b: float
) -> float:
    """
    Calculate shear stress in a beam section.
    
    tau = V*Q / (I*b) = V*A_bar*y_bar / (I*b)
    
    where Q = A*y_bar = first moment of area above/below the point.
    
    Args:
        V: Shear force (N)
        Q: First moment of area A*y_bar (m³)
        I: Moment of inertia about neutral axis (m⁴)
        b: Width of section at the point (m)
    
    Returns:
        Shear stress tau (N/m²)
    
    Reference: SK 1/7, Page 8-9
    """
    if I <= 0:
        raise ValueError("Moment of inertia must be positive")
    if b <= 0:
        raise ValueError("Width must be positive")
    
    tau = (V * Q) / (I * b)
    return tau


def shear_centre_channel(b: float, h: float, t: float) -> float:
    """
    Calculate shear centre distance e for a channel section.
    
    e = (b²*h²*t) / (4*I_xx)
    
    where the shear centre is at the corner of the angle for thin-walled sections.
    
    Args:
        b: Width of flange (m)
        h: Height of web (m)
        t: Thickness (uniform, thin-walled) (m)
    
    Returns:
        Distance e from web to shear centre (m)
    
    Reference: SK 1/8, Table 1.1, Page 9-10
    """
    if b <= 0 or h <= 0 or t <= 0:
        raise ValueError("Dimensions must be positive")
    
    # For channel section: I_xx ≈ (h³*t)/12 + 2*(b*t)*(h/2)² for thin-walled
    # Simplified: use exact formula from table
    I_xx = (t * h**3) / 12 + 2 * b * t * (h / 2)**2
    
    e = (b**2 * h**2 * t) / (4 * I_xx)
    
    return e


def shear_centre_I_section(
    y_t: float,
    I_ytf: float,
    y_b: float,
    I_ybf: float,
    I_yy: float
) -> float:
    """
    Calculate shear centre distance e for an I-section about Y-Y axis.
    
    e = (y_t*I_ytf - y_b*I_ybf) / I_yy
    
    where y_t, y_b are distances of flange centroids from Y-axis,
    and I_ytf, I_ybf are moments of inertia of top and bottom flanges about Y-Y axis.
    
    Args:
        y_t: Distance of top flange centroid from Y-axis (m)
        I_ytf: Moment of inertia of top flange about Y-Y axis (m⁴)
        y_b: Distance of bottom flange centroid from Y-axis (m)
        I_ybf: Moment of inertia of bottom flange about Y-Y axis (m⁴)
        I_yy: Total moment of inertia of section about Y-Y axis (m⁴)
    
    Returns:
        Shear centre distance e (m)
    
    Reference: Table 1.1, Page 10
    """
    if I_yy <= 0:
        raise ValueError("Moment of inertia must be positive")
    
    e = (y_t * I_ytf - y_b * I_ybf) / I_yy
    
    return e


# 1.3 TORSIONAL SHEAR STRESS

def torsional_shear_stress_circular(
    r: float,
    G: float,
    theta: float,
    l: float
) -> float:
    """
    Calculate torsional shear stress in circular shaft.
    
    tau = G*r*theta/l where theta is total angle of twist over length l.
    
    Also: tau_R = T*r/J where T is torque and J is polar moment of inertia.
    
    Args:
        r: Radius from center to point (m)
        G: Modulus of rigidity (N/m²)
        theta: Angle of twist (radians)
        l: Length of shaft (m)
    
    Returns:
        Shear stress tau (N/m²)
    
    Reference: SK 1/9, Page 11
    """
    if r < 0:
        raise ValueError("Radius cannot be negative")
    if G <= 0:
        raise ValueError("Modulus of rigidity must be positive")
    if l <= 0:
        raise ValueError("Length must be positive")
    
    tau = (G * r * theta) / l
    
    return tau


def polar_moment_of_inertia_solid_circular(D: float) -> float:
    """
    Calculate polar moment of inertia for solid circular shaft.
    
    J = π*D⁴/32
    
    Args:
        D: Diameter of shaft (m)
    
    Returns:
        Polar moment of inertia J (m⁴)
    
    Reference: Page 12
    """
    if D <= 0:
        raise ValueError("Diameter must be positive")
    
    J = (math.pi * D**4) / 32
    return J


def polar_moment_of_inertia_hollow_circular(D: float, d: float) -> float:
    """
    Calculate polar moment of inertia for hollow circular shaft.
    
    J = π*(D⁴ - d⁴)/32
    
    Args:
        D: Outer diameter (m)
        d: Inner diameter (m)
    
    Returns:
        Polar moment of inertia J (m⁴)
    
    Reference: Page 12
    """
    if D <= 0 or d < 0:
        raise ValueError("Diameters must be non-negative and D positive")
    if d >= D:
        raise ValueError("Inner diameter must be less than outer diameter")
    
    J = (math.pi * (D**4 - d**4)) / 32
    return J


def max_shear_stress_circular_shaft(T: float, D: float) -> float:
    """
    Calculate maximum shear stress in circular shaft.
    
    tau_max = T*D/(2*J) = 16*T/(π*D³)
    
    Args:
        T: Applied torque (Nm)
        D: Diameter of shaft (m)
    
    Returns:
        Maximum shear stress (N/m²)
    
    Reference: Page 12
    """
    if D <= 0:
        raise ValueError("Diameter must be positive")
    
    tau_max = (16 * T) / (math.pi * D**3)
    return tau_max


def torsional_stiffness_circular_shaft(T: float, theta: float) -> float:
    """
    Calculate torsional stiffness k of circular shaft.
    
    k = T/theta = G*J/l
    
    Args:
        T: Applied torque (Nm)
        theta: Angle of twist (radians)
    
    Returns:
        Torsional stiffness k (Nm/rad)
    
    Reference: Page 12
    """
    if theta == 0:
        raise ValueError("Angle of twist cannot be zero")
    
    k = T / theta
    return k


def torsion_thin_rectangular(d: float, t: float, T: float) -> float:
    """
    Calculate maximum shear stress in thin rectangular section under torsion.
    
    T = (1/3)*tau*d*t²
    
    where tau is along long edge and tau' along short edge with tau'/tau = t/d.
    
    Args:
        d: Length of thin rectangular section (m)
        t: Thickness of thin rectangular section (m)
        T: Applied torque (Nm)
    
    Returns:
        Maximum shear stress tau (N/m²)
    
    Reference: SK 1/10, Page 12-13
    """
    if d <= 0 or t <= 0:
        raise ValueError("Dimensions must be positive")
    if t > d:
        raise ValueError("Thickness should be less than length for thin section")
    
    tau = (3 * T) / (d * t**2)
    return tau


def torsion_thin_open_section(d_list: List[float], t_list: List[float], T: float) -> float:
    """
    Calculate shear stress in thin open section (I, channel, angle) under torsion.
    
    T = (1/3)*tau*Σ(d*t²)
    theta = 3*T*l / (G*Σ(d*t³))
    
    Args:
        d_list: List of lengths of constituent rectangles (m)
        t_list: List of thicknesses of constituent rectangles (m)
        T: Applied torque (Nm)
    
    Returns:
        Maximum shear stress tau (N/m²)
    
    Reference: SK 1/11, Page 13-14
    """
    if len(d_list) != len(t_list):
        raise ValueError("Length and thickness lists must have same length")
    if any(d <= 0 for d in d_list) or any(t <= 0 for t in t_list):
        raise ValueError("All dimensions must be positive")
    
    sum_dt2 = sum(d * t**2 for d, t in zip(d_list, t_list))
    
    if sum_dt2 == 0:
        raise ValueError("Sum of d*t² cannot be zero")
    
    tau = (3 * T) / sum_dt2
    return tau


def angle_of_twist_thin_open_section(
    T: float,
    l: float,
    G: float,
    d_list: List[float],
    t_list: List[float]
) -> float:
    """
    Calculate angle of twist for thin open section.
    
    theta = 3*T*l / (G*Σ(d*t³))
    
    Args:
        T: Applied torque (Nm)
        l: Length of member (m)
        G: Modulus of rigidity (N/m²)
        d_list: List of lengths of constituent rectangles (m)
        t_list: List of thicknesses of constituent rectangles (m)
    
    Returns:
        Angle of twist theta (radians)
    
    Reference: Page 14
    """
    if len(d_list) != len(t_list):
        raise ValueError("Length and thickness lists must have same length")
    if any(d <= 0 for d in d_list) or any(t <= 0 for t in t_list):
        raise ValueError("All dimensions must be positive")
    if G <= 0 or l <= 0:
        raise ValueError("G and l must be positive")
    
    sum_dt3 = sum(d * t**3 for d, t in zip(d_list, t_list))
    
    if sum_dt3 == 0:
        raise ValueError("Sum of d*t³ cannot be zero")
    
    theta = (3 * T * l) / (G * sum_dt3)
    return theta


# 1.4 STRAIN ENERGY

def strain_energy_axial_load(sigma: float, E: float, volume: float) -> float:
    """
    Calculate strain energy in axial load.
    
    U = (sigma²/2E)*Volume
    
    Args:
        sigma: Direct axial stress (N/m²)
        E: Young's modulus (N/m²)
        volume: Volume of member (m³)
    
    Returns:
        Strain energy U (J)
    
    Reference: SK 1/12, Page 14-15
    """
    if E <= 0:
        raise ValueError("Young's modulus must be positive")
    if volume <= 0:
        raise ValueError("Volume must be positive")
    
    U = (sigma**2 / (2 * E)) * volume
    return U


def strain_energy_bending(M: float, E: float, I: float, dx: float) -> float:
    """
    Calculate strain energy in bending for element dx.
    
    dU = M²/(2EI) * dx
    
    For entire beam: U = ∫(M²/2EI)dx
    
    Args:
        M: Bending moment (Nm)
        E: Young's modulus (N/m²)
        I: Moment of inertia (m⁴)
        dx: Length of element (m)
    
    Returns:
        Strain energy dU for element (J)
    
    Reference: SK 1/13, Page 15
    """
    if E <= 0:
        raise ValueError("Young's modulus must be positive")
    if I <= 0:
        raise ValueError("Moment of inertia must be positive")
    if dx <= 0:
        raise ValueError("Element length must be positive")
    
    dU = (M**2 / (2 * E * I)) * dx
    return dU


def strain_energy_shear(tau: float, G: float, volume: float) -> float:
    """
    Calculate strain energy due to shear.
    
    U = (tau²/2G) * volume
    
    Args:
        tau: Shear stress (N/m²)
        G: Modulus of rigidity (N/m²)
        volume: Volume (m³)
    
    Returns:
        Strain energy U (J)
    
    Reference: SK 1/14, Page 16
    """
    if G <= 0:
        raise ValueError("Modulus of rigidity must be positive")
    if volume <= 0:
        raise ValueError("Volume must be positive")
    
    U = (tau**2 / (2 * G)) * volume
    return U


def strain_energy_torsion_circular_shaft(
    tau: float,
    G: float,
    D: float,
    l: float
) -> float:
    """
    Calculate strain energy of circular shaft in torsion.
    
    U = (tau²/4G) * volume
    
    where volume = π*D²*l/4 for solid shaft.
    
    Args:
        tau: Maximum shear stress (N/m²)
        G: Modulus of rigidity (N/m²)
        D: Diameter (m)
        l: Length (m)
    
    Returns:
        Strain energy U (J)
    
    Reference: SK 1/15, Page 17
    """
    if G <= 0:
        raise ValueError("Modulus of rigidity must be positive")
    if D <= 0 or l <= 0:
        raise ValueError("Diameter and length must be positive")
    
    volume = (math.pi * D**2 * l) / 4
    U = (tau**2 / (4 * G)) * volume
    
    return U


def strain_energy_torsion_thin_rectangular(
    tau: float,
    G: float,
    d: float,
    t: float,
    l: float
) -> float:
    """
    Calculate strain energy of thin rectangular section in torsion.
    
    U = (tau²*d*t*l/6G) * (1 + t²/d²)
    
    Assuming tau'/tau = t/d approximately.
    
    Args:
        tau: Shear stress on long edge (N/m²)
        G: Modulus of rigidity (N/m²)
        d: Length of section (m)
        t: Thickness of section (m)
        l: Length of member (m)
    
    Returns:
        Strain energy U (J)
    
    Reference: Page 18
    """
    if G <= 0:
        raise ValueError("Modulus of rigidity must be positive")
    if d <= 0 or t <= 0 or l <= 0:
        raise ValueError("All dimensions must be positive")
    
    U = (tau**2 * d * t * l / (6 * G)) * (1 + t**2 / d**2)
    
    return U


# ============================================================================
# CHAPTER 2: THEORY OF STRUCTURES
# ============================================================================

# 2.1 POLYGON OF FORCES

def resultant_force_2d(forces: List[Tuple[float, float]]) -> Tuple[float, float]:
    """
    Calculate resultant of 2D forces using polygon of forces.
    
    Forces are represented as (F_x, F_y) components.
    Resultant R = (ΣF_x, ΣF_y)
    
    Args:
        forces: List of force tuples [(F_x1, F_y1), (F_x2, F_y2), ...]
    
    Returns:
        Resultant force (R_x, R_y) in Newtons
    
    Reference: SK 2/1, SK 2/2, Page 19-20
    """
    R_x = sum(F_x for F_x, F_y in forces)
    R_y = sum(F_y for F_x, F_y in forces)
    
    return (R_x, R_y)


def check_equilibrium_2d(forces: List[Tuple[float, float]], tol: float = 1e-6) -> bool:
    """
    Check if a system of 2D forces is in equilibrium.
    
    ΣX = 0 and ΣY = 0 for equilibrium.
    
    Args:
        forces: List of force tuples [(F_x1, F_y1), (F_x2, F_y2), ...]
        tol: Tolerance for zero check
    
    Returns:
        True if in equilibrium, False otherwise
    
    Reference: Page 19-20
    """
    R_x, R_y = resultant_force_2d(forces)
    
    return abs(R_x) < tol and abs(R_y) < tol


# 2.2 EQUATIONS OF EQUILIBRIUM

def truss_reactions_simple(
    P1: float,
    P2: float,
    theta: float,
    l: float,
    a: float,
    b: float,
    c: float
) -> Tuple[float, float, float]:
    """
    Calculate reactions for a simple truss.
    
    Equilibrium equations:
    ΣH = 0: H_A = (P1 + P2)*sin(theta)
    ΣV = 0: R_A + R_B = (P1 + P2)*cos(theta)
    ΣM_A = 0: R_B*l = (P1*sin(theta))*c + (P1*cos(theta))*(l/2) + (P2*sin(theta))*b + (P2*cos(theta))*a
    
    Args:
        P1: Load 1 magnitude (N)
        P2: Load 2 magnitude (N)
        theta: Angle of loads from vertical (radians)
        l: Span length (m)
        a: Distance parameter (m)
        b: Distance parameter (m)
        c: Height parameter (m)
    
    Returns:
        Tuple of (R_A, R_B, H_A) reactions in N
    
    Reference: SK 2/4, Page 21
    """
    if l <= 0:
        raise ValueError("Span length must be positive")
    
    H_A = (P1 + P2) * math.sin(theta)
    
    # Moment about A
    moment_sum = (P1 * math.sin(theta) * c + 
                  P1 * math.cos(theta) * (l / 2) + 
                  P2 * math.sin(theta) * b + 
                  P2 * math.cos(theta) * a)
    
    R_B = moment_sum / l
    R_A = (P1 + P2) * math.cos(theta) - R_B
    
    return (R_A, R_B, H_A)


# 2.3 INTERNAL FORCES

def truss_determinacy_check(m: int, j: int) -> str:
    """
    Check if a truss is determinate, indeterminate, or a mechanism.
    
    For a determinate truss: m = 2j - 3
    For a determinate cantilever truss: m = 2j
    
    Args:
        m: Number of members
        j: Number of joints
    
    Returns:
        String indicating "determinate", "indeterminate", or "mechanism"
    
    Reference: Page 22
    """
    if m == 2 * j - 3:
        return "determinate"
    elif m > 2 * j - 3:
        return "indeterminate"
    else:
        return "mechanism"


# 2.4 BENDING MOMENT AND SHEAR FORCE

def simply_supported_beam_udl_moment(w: float, l: float, x: float) -> float:
    """
    Calculate bending moment at distance x for simply supported beam with UDL.
    
    M_x = R_A*x - w*x²/2 = (w/2)*(l - x)*x
    
    Args:
        w: Uniformly distributed load (N/m)
        l: Span length (m)
        x: Distance from support A (m)
    
    Returns:
        Bending moment M_x (Nm)
    
    Reference: SK 2/11, Page 28-29
    """
    if l <= 0:
        raise ValueError("Span length must be positive")
    if x < 0 or x > l:
        raise ValueError(f"Position x must be between 0 and {l}")
    
    R_A = w * l / 2
    M_x = R_A * x - w * x**2 / 2
    
    return M_x


def simply_supported_beam_udl_shear(w: float, l: float, x: float) -> float:
    """
    Calculate shear force at distance x for simply supported beam with UDL.
    
    V_x = w*l/2 - w*x = (w/2)*(l - 2x)
    
    Args:
        w: Uniformly distributed load (N/m)
        l: Span length (m)
        x: Distance from support A (m)
    
    Returns:
        Shear force V_x (N)
    
    Reference: SK 2/11, Page 29
    """
    if l <= 0:
        raise ValueError("Span length must be positive")
    if x < 0 or x > l:
        raise ValueError(f"Position x must be between 0 and {l}")
    
    V_x = (w / 2) * (l - 2 * x)
    
    return V_x


# 2.4.2 SLOPE-DEFLECTION EQUATIONS

def slope_change_beam(M_values: List[float], x_values: List[float], E: float, I: float) -> float:
    """
    Calculate change in slope between two points using area moment theorem.
    
    θ_D - θ_C = ∫(M/EI)dx from C to D
    
    For constant EI, this is the area of M-diagram divided by EI.
    
    Args:
        M_values: Bending moment values at discrete points (Nm)
        x_values: Corresponding x positions (m)
        E: Modulus of elasticity (N/m²)
        I: Moment of inertia (m⁴)
    
    Returns:
        Change in slope θ (radians)
    
    Reference: SK 2/12, SK 2/13, Page 29-30
    """
    if E <= 0 or I <= 0:
        raise ValueError("E and I must be positive")
    if len(M_values) != len(x_values):
        raise ValueError("M_values and x_values must have same length")
    if len(M_values) < 2:
        raise ValueError("Need at least 2 points")
    
    # Trapezoidal integration
    area = 0.0
    for i in range(len(M_values) - 1):
        dx = x_values[i+1] - x_values[i]
        if dx < 0:
            raise ValueError("x_values must be in ascending order")
        area += 0.5 * (M_values[i] + M_values[i+1]) * dx
    
    theta = area / (E * I)
    return theta


def deflection_area_moment_theorem(
    M_values: List[float],
    x_values: List[float],
    x_bar: float,
    E: float,
    I: float
) -> float:
    """
    Calculate deflection using second area moment theorem.
    
    Δ = ∫(M*x̄/EI)dx = A*x̄/EI
    
    where A is area of M-diagram and x̄ is distance of centroid from origin.
    
    Args:
        M_values: Bending moment values (Nm)
        x_values: Corresponding positions (m)
        x_bar: Distance of centroid of M-diagram area from origin (m)
        E: Modulus of elasticity (N/m²)
        I: Moment of inertia (m⁴)
    
    Returns:
        Deflection Δ (m)
    
    Reference: SK 2/13, Page 30
    """
    if E <= 0 or I <= 0:
        raise ValueError("E and I must be positive")
    if len(M_values) != len(x_values):
        raise ValueError("M_values and x_values must have same length")
    
    # Calculate area
    area = 0.0
    for i in range(len(M_values) - 1):
        dx = x_values[i+1] - x_values[i]
        area += 0.5 * (M_values[i] + M_values[i+1]) * dx
    
    delta = (area * x_bar) / (E * I)
    return delta


def simply_supported_beam_udl_slope(w: float, l: float, E: float, I: float) -> Tuple[float, float]:
    """
    Calculate end slopes for simply supported beam with UDL.
    
    θ_A = -θ_B = w*l³/(24*E*I)
    
    Args:
        w: UDL intensity (N/m)
        l: Span (m)
        E: Modulus of elasticity (N/m²)
        I: Moment of inertia (m⁴)
    
    Returns:
        Tuple of (θ_A, θ_B) in radians
    
    Reference: Page 32
    """
    if E <= 0 or I <= 0:
        raise ValueError("E and I must be positive")
    if l <= 0:
        raise ValueError("Span must be positive")
    
    theta_A = (w * l**3) / (24 * E * I)
    theta_B = -theta_A
    
    return (theta_A, theta_B)


def simply_supported_beam_point_load_slope(
    P: float,
    l: float,
    a: float,
    E: float,
    I: float
) -> Tuple[float, float]:
    """
    Calculate end slopes for simply supported beam with point load P at distance a from A.
    
    θ_A = P*a*(l² - a²)/(6*E*I*l)
    θ_B = -P*a*(2*l - a)*(l - a)/(6*E*I*l)
    
    Args:
        P: Point load (N)
        l: Span (m)
        a: Distance from A to load (m)
        E: Modulus of elasticity (N/m²)
        I: Moment of inertia (m⁴)
    
    Returns:
        Tuple of (θ_A, θ_B) in radians
    
    Reference: Page 32
    """
    if E <= 0 or I <= 0:
        raise ValueError("E and I must be positive")
    if l <= 0:
        raise ValueError("Span must be positive")
    if a < 0 or a > l:
        raise ValueError("Load position must be between 0 and l")
    
    theta_A = (P * a * (l**2 - a**2)) / (6 * E * I * l)
    theta_B = -(P * a * (2*l - a) * (l - a)) / (6 * E * I * l)
    
    return (theta_A, theta_B)


# 2.4.4 GENERALISED SLOPE-DEFLECTION EQUATIONS

def slope_deflection_end_moments(
    theta_A: float,
    theta_B: float,
    E: float,
    I: float,
    l: float,
    A_xbar: float,
    settlement_AB: float = 0.0
) -> Tuple[float, float]:
    """
    Calculate end moments using generalized slope-deflection equations.
    
    M_ab = (2EI/l)*(2θ_A + θ_B) - (2A/l²)*(2l - 3x̄) - 6Θ_AB*EI/l
    M_ba = (2EI/l)*(2θ_B + θ_A) + (2A/l²)*(3x̄ - l) - 6Θ_AB*EI/l
    
    where A = area of free span bending moment diagram,
    x̄ = distance of centroid from left support,
    Θ_AB = rigid body rotation due to settlement.
    
    Args:
        theta_A: Rotation at end A (radians)
        theta_B: Rotation at end B (radians)
        E: Modulus of elasticity (N/m²)
        I: Moment of inertia (m⁴)
        l: Span length (m)
        A_xbar: Product of area A and centroid distance x̄ (Nm²)
        settlement_AB: Rigid body rotation due to settlement (radians)
    
    Returns:
        Tuple of (M_ab, M_ba) end moments (Nm)
    
    Reference: SK 2/17, Page 34
    """
    if E <= 0 or I <= 0:
        raise ValueError("E and I must be positive")
    if l <= 0:
        raise ValueError("Span must be positive")
    
    # Note: Full formula requires A and x̄ separately
    # Here we use A*x̄ as input for simplicity
    # For complete implementation, need A and xbar separately
    
    M_ab = (2 * E * I / l) * (2 * theta_A + theta_B) - 6 * settlement_AB * E * I / l
    M_ba = (2 * E * I / l) * (2 * theta_B + theta_A) - 6 * settlement_AB * E * I / l
    
    # If A_xbar provided, adjust for loading
    # This requires knowing A and xbar separately - simplified here
    
    return (M_ab, M_ba)


# 2.4.5 FIXED-END BEAMS

def fixed_end_moments_udl(w: float, l: float) -> Tuple[float, float]:
    """
    Calculate fixed-end moments for UDL.
    
    FEM_ab = -w*l²/12
    FEM_ba = +w*l²/12
    
    Args:
        w: UDL intensity (N/m)
        l: Span (m)
    
    Returns:
        Tuple of (FEM_ab, FEM_ba) in Nm
    
    Reference: Page 35
    """
    if l <= 0:
        raise ValueError("Span must be positive")
    
    FEM_ab = -(w * l**2) / 12
    FEM_ba = (w * l**2) / 12
    
    return (FEM_ab, FEM_ba)


def fixed_end_moments_point_load(P: float, l: float, a: float, b: float) -> Tuple[float, float]:
    """
    Calculate fixed-end moments for point load.
    
    FEM_ab = -P*a*b²/l²
    FEM_ba = +P*a²*b/l²
    
    where a is distance from left support, b from right support (a + b = l).
    
    Args:
        P: Point load (N)
        l: Span (m)
        a: Distance from left support (m)
        b: Distance from right support (m)
    
    Returns:
        Tuple of (FEM_ab, FEM_ba) in Nm
    
    Reference: Page 35
    """
    if l <= 0:
        raise ValueError("Span must be positive")
    if not math.isclose(a + b, l, rel_tol=1e-6):
        raise ValueError("a + b must equal l")
    
    FEM_ab = -(P * a * b**2) / l**2
    FEM_ba = (P * a**2 * b) / l**2
    
    return (FEM_ab, FEM_ba)


def carry_over_factor() -> float:
    """
    Return carry-over factor for beams with constant EI.
    
    Carry-over factor = 1/2
    
    When a moment M is applied at one end of a beam, a moment of M/2 is
    carried over to the other end if that end is fixed.
    
    Returns:
        Carry-over factor (dimensionless)
    
    Reference: SK 2/19, Page 37
    """
    return 0.5


# 2.4.8 ARCHES

def arch_horizontal_reaction_two_hinged(
    w: float,
    l: float,
    f: float,
    E: float,
    I_0: float,
    A_0: float
) -> float:
    """
    Calculate horizontal reaction for two-hinged parabolic arch with vertical UDL.
    
    H = (w*l²)/(8*f*(1 + β))
    
    where β = (15*I/32*f³*A_0) * tan⁻¹(4f/l)
    
    For parabolic arch: y = 4fx²/l²
    
    Args:
        w: Uniformly distributed vertical load intensity (N/m)
        l: Horizontal span (m)
        f: Rise of arch at crown (m)
        E: Modulus of elasticity (N/m²)
        I_0: Moment of inertia at crown (m⁴)
        A_0: Cross-sectional area at crown (m²)
    
    Returns:
        Horizontal reaction H (N)
    
    Reference: SK 2/22, Page 40-42
    """
    if l <= 0 or f <= 0:
        raise ValueError("Span and rise must be positive")
    if I_0 <= 0 or A_0 <= 0:
        raise ValueError("I_0 and A_0 must be positive")
    
    beta = (15 * I_0 / (32 * f**3 * A_0)) * math.atan(4 * f / l)
    
    H = (w * l**2) / (8 * f * (1 + beta))
    
    return H


def arch_bending_moment_three_hinged(
    x: float,
    y: float,
    H: float,
    M_prime: float
) -> float:
    """
    Calculate bending moment in three-hinged arch.
    
    M = M' - H*y
    
    where M' is bending moment due to external loading when H=0,
    and y is the rise of arch at position x.
    
    Args:
        x: Horizontal distance from support (m)
        y: Vertical rise at position x (m)
        H: Horizontal reaction (N)
        M_prime: Bending moment from external loading with H=0 (Nm)
    
    Returns:
        Bending moment M (Nm)
    
    Reference: SK 2/30, Page 50
    """
    M = M_prime - H * y
    return M


def arch_shear_force_three_hinged(
    phi: float,
    alpha: float,
    R_a: float,
    H: float
) -> float:
    """
    Calculate shear force in three-hinged arch.
    
    V_d = R_a*cos(φ) - H*sin(φ - α)/cos(α)
    
    where φ is inclination of tangent at point,
    α is inclination of line AB to horizontal,
    R_a is vertical reaction,
    H is horizontal thrust.
    
    Args:
        phi: Inclination of tangent at point (radians)
        alpha: Inclination of AB to horizontal (radians)
        R_a: Vertical reaction at A (N)
        H: Horizontal thrust (N)
    
    Returns:
        Shear force V (N)
    
    Reference: SK 2/30, Page 50
    """
    V_d = R_a * math.cos(phi) - H * math.sin(phi - alpha) / math.cos(alpha)
    return V_d


# 2.5 INFLUENCE LINES

def influence_line_cantilever_moment(l: float, x: float) -> float:
    """
    Calculate influence line ordinate for bending moment at built-in end of cantilever.
    
    For unit load at distance x from built-in end: M = -x
    
    Args:
        l: Length of cantilever (m)
        x: Distance from built-in end (m)
    
    Returns:
        Influence ordinate (m)
    
    Reference: SK 2/26, Page 46-47
    """
    if l <= 0:
        raise ValueError("Cantilever length must be positive")
    if x < 0 or x > l:
        raise ValueError("Position must be between 0 and l")
    
    return -x


def influence_line_simply_supported_moment(l: float, c: float, x: float) -> float:
    """
    Calculate influence line ordinate for bending moment at point C.
    
    For unit load to left of C: M = (b/l)*x where b = l - c
    For unit load to right of C: M = (a/l)*(l - x) where a = c
    
    Args:
        l: Span length (m)
        c: Distance from left support to point C (m)
        x: Position of unit load from left support (m)
    
    Returns:
        Influence ordinate (m)
    
    Reference: SK 2/27, Page 47
    """
    if l <= 0:
        raise ValueError("Span must be positive")
    if c < 0 or c > l:
        raise ValueError("Point C must be between supports")
    if x < 0 or x > l:
        raise ValueError("Load position must be on span")
    
    a = c
    b = l - c
    
    if x <= c:
        M_inf = (b / l) * x
    else:
        M_inf = (a / l) * (l - x)
    
    return M_inf


# 2.6 MATRIX METHOD OF STRUCTURAL ANALYSIS

@dataclass
class TrussMember:
    """Represents a truss member."""
    start_node: int
    end_node: int
    length: float
    area: float
    E: float
    angle: float  # radians from horizontal


def truss_geometry_matrix(members: List[TrussMember], num_nodes: int) -> List[List[float]]:
    """
    Construct geometry matrix [A] for a truss.
    
    Each row corresponds to an internal force (member).
    Columns correspond to joint displacements.
    
    For member i connecting nodes j and k:
    [A] has entries ±cos(α), ±sin(α) at appropriate positions.
    
    Args:
        members: List of TrussMember objects
        num_nodes: Total number of nodes
    
    Returns:
        Geometry matrix as list of lists
    
    Reference: SK 2/32, Page 52-54
    """
    num_members = len(members)
    num_dof = 2 * num_nodes  # 2 DOF per node (x, y)
    
    A = [[0.0 for _ in range(num_dof)] for _ in range(num_members)]
    
    for i, member in enumerate(members):
        j = member.start_node
        k = member.end_node
        alpha = member.angle
        
        # Displacement indices
        j_x = 2 * j
        j_y = 2 * j + 1
        k_x = 2 * k
        k_y = 2 * k + 1
        
        # Geometry matrix entries
        A[i][j_x] = -math.cos(alpha)
        A[i][j_y] = -math.sin(alpha)
        A[i][k_x] = math.cos(alpha)
        A[i][k_y] = math.sin(alpha)
    
    return A


def truss_stiffness_matrix(members: List[TrussMember]) -> List[List[float]]:
    """
    Construct stiffness matrix [K] for truss members.
    
    Diagonal matrix with k_i = E_i*A_i/l_i for each member.
    
    Args:
        members: List of TrussMember objects
    
    Returns:
        Stiffness matrix as list of lists
    
    Reference: Page 54
    """
    num_members = len(members)
    K = [[0.0 for _ in range(num_members)] for _ in range(num_members)]
    
    for i, member in enumerate(members):
        k_i = (member.E * member.area) / member.length
        K[i][i] = k_i
    
    return K


# 2.7 STRUCTURAL DYNAMICS

def undamped_natural_frequency(k: float, m: float) -> float:
    """
    Calculate undamped natural frequency of SDOF system.
    
    ω_n = sqrt(k/m) (rad/s)
    f_n = ω_n/(2π) (Hz)
    T_n = 2π/ω_n (s)
    
    Args:
        k: Stiffness (N/m)
        m: Mass (kg)
    
    Returns:
        Natural frequency ω_n (rad/s)
    
    Reference: SK 2/35, Page 62-63
    """
    if k <= 0:
        raise ValueError("Stiffness must be positive")
    if m <= 0:
        raise ValueError("Mass must be positive")
    
    omega_n = math.sqrt(k / m)
    return omega_n


def critical_damping_coefficient(m: float, omega_n: float) -> float:
    """
    Calculate critical damping coefficient.
    
    c_cr = 2*m*ω_n
    
    Args:
        m: Mass (kg)
        omega_n: Undamped natural frequency (rad/s)
    
    Returns:
        Critical damping coefficient c_cr (Ns/m)
    
    Reference: Page 63
    """
    if m <= 0:
        raise ValueError("Mass must be positive")
    if omega_n <= 0:
        raise ValueError("Natural frequency must be positive")
    
    c_cr = 2 * m * omega_n
    return c_cr


def damping_ratio(c: float, c_cr: float) -> float:
    """
    Calculate damping ratio ξ.
    
    ξ = c/c_cr
    
    Args:
        c: Actual damping coefficient (Ns/m)
        c_cr: Critical damping coefficient (Ns/m)
    
    Returns:
        Damping ratio ξ (dimensionless)
    
    Reference: Page 63
    """
    if c_cr <= 0:
        raise ValueError("Critical damping must be positive")
    
    xi = c / c_cr
    return xi


def damped_natural_frequency(omega_n: float, xi: float) -> float:
    """
    Calculate damped natural frequency.
    
    ω_d = ω_n * sqrt(1 - ξ²)
    
    Valid only for ξ < 1 (underdamped).
    
    Args:
        omega_n: Undamped natural frequency (rad/s)
        xi: Damping ratio (dimensionless)
    
    Returns:
        Damped natural frequency ω_d (rad/s)
    
    Reference: Page 65
    """
    if omega_n <= 0:
        raise ValueError("Natural frequency must be positive")
    if xi < 0 or xi >= 1:
        raise ValueError("Damping ratio must be between 0 and 1 for underdamped response")
    
    omega_d = omega_n * math.sqrt(1 - xi**2)
    return omega_d


def free_vibration_response_undamped(
    u_0: float,
    v_0: float,
    omega_n: float,
    t: float
) -> float:
    """
    Calculate free vibration response of undamped SDOF system.
    
    u(t) = u_0*cos(ω_n*t) + (v_0/ω_n)*sin(ω_n*t)
    
    Args:
        u_0: Initial displacement (m)
        v_0: Initial velocity (m/s)
        omega_n: Natural frequency (rad/s)
        t: Time (s)
    
    Returns:
        Displacement u(t) (m)
    
    Reference: SK 2/37, Page 63-64
    """
    if omega_n <= 0:
        raise ValueError("Natural frequency must be positive")
    
    u = u_0 * math.cos(omega_n * t) + (v_0 / omega_n) * math.sin(omega_n * t)
    return u


def free_vibration_amplitude_phase(u_0: float, v_0: float, omega_n: float) -> Tuple[float, float]:
    """
    Calculate amplitude and phase angle for free vibration.
    
    A = sqrt(u_0² + (v_0/ω_n)²)
    α = arctan(v_0/(ω_n*u_0))
    
    u(t) = A*cos(ω_n*t - α)
    
    Args:
        u_0: Initial displacement (m)
        v_0: Initial velocity (m/s)
        omega_n: Natural frequency (rad/s)
    
    Returns:
        Tuple of (amplitude A, phase angle α in radians)
    
    Reference: SK 2/36, Page 64
    """
    if omega_n <= 0:
        raise ValueError("Natural frequency must be positive")
    
    A = math.sqrt(u_0**2 + (v_0 / omega_n)**2)
    
    if u_0 == 0:
        alpha = math.pi / 2 if v_0 > 0 else -math.pi / 2
    else:
        alpha = math.atan(v_0 / (omega_n * u_0))
    
    return (A, alpha)


def steady_state_dynamic_magnification_factor(omega: float, omega_n: float) -> float:
    """
    Calculate steady-state dynamic magnification factor for harmonic excitation.
    
    DMF = U/U_0 = 1/(1 - r²)
    
    where r = Ω/ω_n (frequency ratio),
    U_0 = p_0/k (static deflection),
    U = steady-state amplitude.
    
    Args:
        omega: Forcing frequency (rad/s)
        omega_n: Natural frequency (rad/s)
    
    Returns:
        Dynamic magnification factor (dimensionless)
    
    Reference: SK 2/38, Page 66
    """
    if omega_n <= 0:
        raise ValueError("Natural frequency must be positive")
    
    r = omega / omega_n
    
    if math.isclose(r, 1.0, rel_tol=1e-6):
        raise ValueError("Resonance condition: r = 1, DMF approaches infinity")
    
    DMF = 1 / (1 - r**2)
    return DMF


def impulse_response_undamped(F_impulse: float, m: float, omega_n: float, t: float) -> float:
    """
    Calculate response to very short impulse for undamped SDOF system.
    
    u(t) ≈ (∫F dt)/(m*ω_n) * sin(ω_n*t)
    
    where ∫F dt is the impulse (Ns).
    
    Args:
        F_impulse: Impulse ∫F dt (Ns)
        m: Mass (kg)
        omega_n: Natural frequency (rad/s)
        t: Time after impulse (s)
    
    Returns:
        Displacement u(t) (m)
    
    Reference: SK 2/39, SK 2/42, Page 67, 71-72
    """
    if m <= 0:
        raise ValueError("Mass must be positive")
    if omega_n <= 0:
        raise ValueError("Natural frequency must be positive")
    
    u = (F_impulse / (m * omega_n)) * math.sin(omega_n * t)
    return u


def triangular_impulse_dynamic_magnification(t_d: float, T_n: float) -> float:
    """
    Calculate maximum dynamic magnification for triangular impulse.
    
    DMF_max = u/u_st where response depends on t_d/T_n ratio.
    
    For triangular pulse with duration t_d and natural period T_n.
    
    Args:
        t_d: Duration of impulse (s)
        T_n: Natural period of structure (s)
    
    Returns:
        Dynamic magnification factor (dimensionless)
    
    Reference: SK 2/39, Page 67-68
    """
    if t_d <= 0 or T_n <= 0:
        raise ValueError("Duration and period must be positive")
    
    omega_n = 2 * math.pi / T_n
    
    # Simplified: max occurs near t = t_d
    # Exact calculation requires evaluating response at t = t_d then free vibration
    # For simplicity, use approximate formula
    
    ratio = t_d / T_n
    
    if ratio < 0.1:
        # Very short impulse
        DMF = 1.0 - math.cos(omega_n * t_d) + 1 - t_d / t_d
    else:
        # Need full integration - simplified here
        DMF = 1.0  # Placeholder
    
    return DMF


def simply_supported_beam_natural_frequency_mode_n(
    n: int,
    E: float,
    I: float,
    m: float,
    l: float
) -> float:
    """
    Calculate natural frequency for mode n of simply supported beam.
    
    ω_n = n²*π² * sqrt(EI/(m*l⁴))
    
    Args:
        n: Mode number (1, 2, 3, ...)
        E: Modulus of elasticity (N/m²)
        I: Moment of inertia (m⁴)
        m: Mass per unit length (kg/m)
        l: Span length (m)
    
    Returns:
        Natural frequency ω_n (rad/s)
    
    Reference: SK 2/41, Page 70-71
    """
    if n <= 0:
        raise ValueError("Mode number must be positive integer")
    if E <= 0 or I <= 0:
        raise ValueError("E and I must be positive")
    if m <= 0:
        raise ValueError("Mass per unit length must be positive")
    if l <= 0:
        raise ValueError("Span must be positive")
    
    omega_n = (n**2 * math.pi**2) * math.sqrt(E * I / (m * l**4))
    return omega_n


# 2.8 ANALYSIS OF PLATES

def plate_differential_equation_check(
    d4w_dx4: float,
    d4w_dx2dy2: float,
    d4w_dy4: float,
    q: float,
    D: float
) -> bool:
    """
    Check if plate deflection satisfies differential equation.
    
    ∂⁴w/∂x⁴ + 2*∂⁴w/∂x²∂y² + ∂⁴w/∂y⁴ = q/D
    
    Args:
        d4w_dx4: Fourth derivative ∂⁴w/∂x⁴
        d4w_dx2dy2: Mixed derivative ∂⁴w/∂x²∂y²
        d4w_dy4: Fourth derivative ∂⁴w/∂y⁴
        q: Loading per unit area (N/m²)
        D: Flexural rigidity = Eh³/(12(1-ν²)) (Nm)
    
    Returns:
        True if equation satisfied within tolerance
    
    Reference: Page 74-76
    """
    if D <= 0:
        raise ValueError("Flexural rigidity must be positive")
    
    lhs = d4w_dx4 + 2 * d4w_dx2dy2 + d4w_dy4
    rhs = q / D
    
    return math.isclose(lhs, rhs, rel_tol=1e-6)


def plate_flexural_rigidity(E: float, h: float, nu: float) -> float:
    """
    Calculate flexural rigidity of plate.
    
    D = E*h³ / (12*(1 - ν²))
    
    Args:
        E: Modulus of elasticity (N/m²)
        h: Thickness of plate (m)
        nu: Poisson's ratio (dimensionless)
    
    Returns:
        Flexural rigidity D (Nm)
    
    Reference: Page 75
    """
    if E <= 0:
        raise ValueError("Modulus of elasticity must be positive")
    if h <= 0:
        raise ValueError("Thickness must be positive")
    if nu < -1 or nu >= 0.5:
        raise ValueError("Poisson's ratio must be between -1 and 0.5")
    
    D = (E * h**3) / (12 * (1 - nu**2))
    return D


def plate_bending_moments(
    d2w_dx2: float,
    d2w_dy2: float,
    d2w_dxdy: float,
    D: float,
    nu: float
) -> Tuple[float, float, float]:
    """
    Calculate bending and twisting moments in plate.
    
    M_x = -D*(∂²w/∂x² + ν*∂²w/∂y²)
    M_y = -D*(∂²w/∂y² + ν*∂²w/∂x²)
    M_xy = -D*(1 - ν)*∂²w/∂x∂y
    
    Args:
        d2w_dx2: Second derivative ∂²w/∂x²
        d2w_dy2: Second derivative ∂²w/∂y²
        d2w_dxdy: Mixed derivative ∂²w/∂x∂y
        D: Flexural rigidity (Nm)
        nu: Poisson's ratio
    
    Returns:
        Tuple of (M_x, M_y, M_xy) moments per unit length (Nm/m)
    
    Reference: Page 75
    """
    if D <= 0:
        raise ValueError("Flexural rigidity must be positive")
    
    M_x = -D * (d2w_dx2 + nu * d2w_dy2)
    M_y = -D * (d2w_dy2 + nu * d2w_dx2)
    M_xy = -D * (1 - nu) * d2w_dxdy
    
    return (M_x, M_y, M_xy)


# 2.9 METHODS OF PLASTIC ANALYSIS

def plastic_modulus_rectangle(b: float, d: float) -> float:
    """
    Calculate plastic modulus for rectangular section.
    
    S = b*d²/4
    
    Args:
        b: Width (m)
        d: Depth (m)
    
    Returns:
        Plastic modulus S (m³)
    
    Reference: SK 2/47, Page 79-80
    """
    if b <= 0 or d <= 0:
        raise ValueError("Dimensions must be positive")
    
    S = (b * d**2) / 4
    return S


def plastic_moment_rectangle(b: float, d: float, f_y: float) -> float:
    """
    Calculate plastic moment of resistance for rectangular section.
    
    M_p = S*f_y = (b*d²/4)*f_y
    
    Args:
        b: Width (m)
        d: Depth (m)
        f_y: Yield stress (N/m²)
    
    Returns:
        Plastic moment M_p (Nm)
    
    Reference: SK 2/47, Page 80
    """
    if b <= 0 or d <= 0:
        raise ValueError("Dimensions must be positive")
    if f_y <= 0:
        raise ValueError("Yield stress must be positive")
    
    S = plastic_modulus_rectangle(b, d)
    M_p = S * f_y
    
    return M_p


def reduced_plastic_moment_bending_axial(
    M_p: float,
    S: float,
    n: float,
    A: float,
    f_y: float
) -> float:
    """
    Calculate reduced plastic moment capacity due to axial load.
    
    M'_p = M_p - n²*A²*f_y / (4*t)
    
    where n = Load/Capacity = 2at/(A*f_y), simpler form:
    M'_p = (S - n²*A²/(4*t))*f_y
    
    Args:
        M_p: Full plastic moment (Nm)
        S: Plastic modulus (m³)
        n: Load ratio (dimensionless)
        A: Area of section (m²)
        f_y: Yield stress (N/m²)
    
    Returns:
        Reduced plastic moment M'_p (Nm)
    
    Reference: SK 2/48, Page 81
    """
    if M_p <= 0:
        raise ValueError("Plastic moment must be positive")
    if n < 0 or n > 1:
        raise ValueError("Load ratio must be between 0 and 1")
    
    # Simplified formula
    M_p_reduced = M_p * (1 - n**2)
    
    return M_p_reduced


def von_mises_yield_criterion(f_m: float, f_v: float, f_y: float) -> bool:
    """
    Check Von Mises yield criterion for combined bending and shear.
    
    f_y² = f_m² + 3*f_v²
    
    Args:
        f_m: Longitudinal fiber stress due to bending (N/m²)
        f_v: Shear stress (N/m²)
        f_y: Yield stress (N/m²)
    
    Returns:
        True if yielding occurs, False otherwise
    
    Reference: Page 81
    """
    if f_y <= 0:
        raise ValueError("Yield stress must be positive")
    
    yield_value = f_m**2 + 3 * f_v**2
    
    return yield_value >= f_y**2


def collapse_load_fixed_beam_udl(M_p: float, l: float) -> float:
    """
    Calculate collapse load for fixed-end beam with UDL using plastic analysis.
    
    For fixed beam with 3 plastic hinges at collapse:
    w = 16*M_p / l²
    
    Args:
        M_p: Plastic moment capacity (Nm)
        l: Span (m)
    
    Returns:
        Collapse load intensity w (N/m)
    
    Reference: SK 2/50, Page 83-84
    """
    if M_p <= 0:
        raise ValueError("Plastic moment must be positive")
    if l <= 0:
        raise ValueError("Span must be positive")
    
    w = (16 * M_p) / l**2
    return w


def plate_ultimate_resistance_yield_line(
    M_p: float,
    L: float,
    H: float,
    y: float
) -> float:
    """
    Calculate ultimate resistance of plate using yield-line method.
    
    r_u = 10*M_p / y²
    
    for rectangular plate with specific yield line pattern.
    
    Args:
        M_p: Plastic moment capacity per unit length (Nm/m)
        L: Length of plate (m)
        H: Height of plate (m)
        y: Yield line position parameter (m)
    
    Returns:
        Ultimate resistance r_u (N/m²)
    
    Reference: SK 2/46, Page 77-78
    """
    if M_p <= 0:
        raise ValueError("Plastic moment must be positive")
    if y <= 0:
        raise ValueError("Yield line parameter must be positive")
    
    r_u = (10 * M_p) / y**2
    return r_u


def optimize_yield_line_position(M_p: float, L: float, H: float) -> float:
    """
    Find optimal yield line position y for minimum ultimate resistance.
    
    For plate simply supported on 3 edges, solve:
    10*M_p/y² = 8*M_p*(6H - y) / (L²*(3H - 2y))
    
    Args:
        M_p: Plastic moment capacity (Nm/m)
        L: Length (m)
        H: Height (m)
    
    Returns:
        Optimal y position (m)
    
    Reference: Page 78-79
    """
    if M_p <= 0:
        raise ValueError("Plastic moment must be positive")
    if L <= 0 or H <= 0:
        raise ValueError("Dimensions must be positive")
    
    # Solving: 10/y² = 8(6H - y)/(L²(3H - 2y))
    # This is a quadratic equation in y
    # Simplified solution (actual derivation in text)
    
    # For demonstration, use approximate value
    y_opt = H / 2  # Placeholder - actual solution requires solving quadratic
    
    return y_opt


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def matrix_multiply(A: List[List[float]], B: List[List[float]]) -> List[List[float]]:
    """
    Multiply two matrices A and B.
    
    Args:
        A: Matrix A (m x n)
        B: Matrix B (n x p)
    
    Returns:
        Result matrix C = A*B (m x p)
    """
    if not A or not B:
        raise ValueError("Matrices cannot be empty")
    
    rows_A = len(A)
    cols_A = len(A[0])
    rows_B = len(B)
    cols_B = len(B[0])
    
    if cols_A != rows_B:
        raise ValueError(f"Incompatible matrices: {cols_A} != {rows_B}")
    
    C = [[0.0 for _ in range(cols_B)] for _ in range(rows_A)]
    
    for i in range(rows_A):
        for j in range(cols_B):
            for k in range(cols_A):
                C[i][j] += A[i][k] * B[k][j]
    
    return C


def matrix_transpose(A: List[List[float]]) -> List[List[float]]:
    """
    Transpose matrix A.
    
    Args:
        A: Matrix A (m x n)
    
    Returns:
        Transposed matrix A^T (n x m)
    """
    if not A:
        raise ValueError("Matrix cannot be empty")
    
    rows = len(A)
    cols = len(A[0])
    
    A_T = [[A[i][j] for i in range(rows)] for j in range(cols)]
    
    return A_T


def matrix_vector_multiply(A: List[List[float]], v: List[float]) -> List[float]:
    """
    Multiply matrix A by vector v.
    
    Args:
        A: Matrix A (m x n)
        v: Vector v (n x 1)
    
    Returns:
        Result vector w = A*v (m x 1)
    """
    if not A or not v:
        raise ValueError("Matrix and vector cannot be empty")
    
    rows = len(A)
    cols = len(A[0])
    
    if cols != len(v):
        raise ValueError(f"Incompatible dimensions: {cols} != {len(v)}")
    
    w = [0.0 for _ in range(rows)]
    
    for i in range(rows):
        for j in range(cols):
            w[i] += A[i][j] * v[j]
    
    return w


# ============================================================================
# MODULE DOCSTRING EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    # Example: Calculate bending stress in circular arc beam
    y = 0.1  # 10 cm from neutral axis
    E = 200e9  # 200 GPa steel
    R = 5.0  # 5 m radius
    
    sigma = bending_stress_circular_arc(y, E, R)
    print(f"Bending stress: {sigma/1e6:.2f} MPa")
    
    # Example: Natural frequency of SDOF system
    k = 10000  # N/m
    m = 100  # kg
    
    omega_n = undamped_natural_frequency(k, m)
    f_n = omega_n / (2 * math.pi)
    print(f"Natural frequency: {f_n:.2f} Hz")
    
    # Example: Plastic moment of rectangle
    b = 0.2  # m
    d = 0.4  # m
    f_y = 275e6  # N/m²
    
    M_p = plastic_moment_rectangle(b, d, f_y)
    print(f"Plastic moment: {M_p/1000:.2f} kNm")