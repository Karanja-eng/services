# backend/surveying/alignment/vertical.py
"""
Vertical curve calculations

Vertical curves use parabolic equation:
y = ax² + bx + c

Where:
- a = rate of change of grade / 2
- x = distance from curve start
"""
import math
from ..schemas import (VerticalCurveResponse, VerticalCurveType, 
                       ChainageRLResponse, VerticalCurveRequest)

def calculate_vertical_curve(grade_in: float,
                             grade_out: float,
                             curve_length: float,
                             chainage_vip: float,
                             rl_vip: float) -> VerticalCurveResponse:
    """
    Calculate vertical curve parameters
    
    Engineering principles:
    - Crest curve: grade_in > grade_out (summit)
    - Sag curve: grade_in < grade_out (valley)
    - Grade in percentage (e.g., 3.5 = 3.5% = 0.035 rise/run)
    
    Args:
        grade_in: Incoming grade (percentage)
        grade_out: Outgoing grade (percentage)
        curve_length: Length of vertical curve L (meters)
        chainage_vip: Chainage at vertical intersection point (meters)
        rl_vip: Reduced level at VIP (meters)
        
    Returns:
        Complete vertical curve parameters
    """
    # Determine curve type
    if grade_in > grade_out:
        curve_type = VerticalCurveType.CREST
    else:
        curve_type = VerticalCurveType.SAG
    
    # Algebraic difference in grades
    # A = g1 - g2 (positive for crest, negative for sag)
    grade_change = grade_in - grade_out
    
    # Rate of change of grade (K value)
    # K = L / A (curve length per percent grade change)
    if abs(grade_change) > 0.001:
        rate_of_change = curve_length / abs(grade_change)
    else:
        rate_of_change = float('inf')
    
    # Chainage at start of curve (BVC - beginning of vertical curve)
    chainage_start = chainage_vip - curve_length / 2.0
    
    # Chainage at end of curve (EVC - end of vertical curve)
    chainage_end = chainage_vip + curve_length / 2.0
    
    # RL at start of curve
    # Work back from VIP along incoming grade
    grade_in_decimal = grade_in / 100.0
    rl_start = rl_vip - (curve_length / 2.0) * grade_in_decimal
    
    # RL at end of curve
    # Work forward from VIP along outgoing grade
    grade_out_decimal = grade_out / 100.0
    rl_end = rl_vip + (curve_length / 2.0) * grade_out_decimal
    
    # Total elevation change
    elevation_change = rl_end - rl_start
    
    return VerticalCurveResponse(
        curve_type=curve_type,
        grade_in=grade_in,
        grade_out=grade_out,
        curve_length=curve_length,
        rate_of_change=rate_of_change,
        chainage_start=chainage_start,
        chainage_end=chainage_end,
        rl_start=rl_start,
        rl_end=rl_end,
        rl_vip=rl_vip,
        elevation_change=elevation_change
    )

def calculate_rl_at_chainage(chainage: float,
                             vertical_curve: VerticalCurveRequest) -> ChainageRLResponse:
    """
    Calculate reduced level at any chainage on vertical curve
    
    Parabolic equation:
    y = y₀ + g₁x + (A/2L)x²
    
    Where:
    - y = elevation at distance x from BVC
    - y₀ = elevation at BVC
    - g₁ = incoming grade (decimal)
    - A = g₁ - g₂ (algebraic grade difference)
    - L = curve length
    - x = distance from BVC
    
    Args:
        chainage: Target chainage (meters)
        vertical_curve: Vertical curve parameters
        
    Returns:
        RL and grade at specified chainage
    """
    curve_params = calculate_vertical_curve(
        vertical_curve.grade_in,
        vertical_curve.grade_out,
        vertical_curve.curve_length,
        vertical_curve.chainage_vip,
        vertical_curve.rl_vip
    )
    
    # Check if chainage is on the curve
    if chainage < curve_params.chainage_start:
        # Before curve - use incoming grade
        distance = chainage - curve_params.chainage_start
        grade_decimal = vertical_curve.grade_in / 100.0
        rl = curve_params.rl_start + distance * grade_decimal
        grade_at_point = vertical_curve.grade_in
        
    elif chainage > curve_params.chainage_end:
        # After curve - use outgoing grade
        distance = chainage - curve_params.chainage_end
        grade_decimal = vertical_curve.grade_out / 100.0
        rl = curve_params.rl_end + distance * grade_decimal
        grade_at_point = vertical_curve.grade_out
        
    else:
        # On curve - use parabolic equation
        x = chainage - curve_params.chainage_start
        g1_decimal = vertical_curve.grade_in / 100.0
        A_decimal = (vertical_curve.grade_in - vertical_curve.grade_out) / 100.0
        L = vertical_curve.curve_length
        
        # y = y₀ + g₁x + (A/2L)x²
        rl = curve_params.rl_start + g1_decimal * x + (A_decimal / (2.0 * L)) * x**2
        
        # Grade at point: dy/dx = g₁ + (A/L)x
        grade_at_point_decimal = g1_decimal + (A_decimal / L) * x
        grade_at_point = grade_at_point_decimal * 100.0
    
    return ChainageRLResponse(
        chainage=chainage,
        rl=rl,
        grade_at_point=grade_at_point
    )

def calculate_highest_lowest_point(vertical_curve: VerticalCurveRequest) -> tuple:
    """
    Calculate chainage and RL of highest/lowest point on vertical curve
    
    For parabola y = ax² + bx + c:
    Maximum/minimum occurs at x = -b/(2a)
    
    Args:
        vertical_curve: Vertical curve parameters
        
    Returns:
        (chainage, rl) of extreme point
    """
    curve_params = calculate_vertical_curve(
        vertical_curve.grade_in,
        vertical_curve.grade_out,
        vertical_curve.curve_length,
        vertical_curve.chainage_vip,
        vertical_curve.rl_vip
    )
    
    g1_decimal = vertical_curve.grade_in / 100.0
    A_decimal = (vertical_curve.grade_in - vertical_curve.grade_out) / 100.0
    L = vertical_curve.curve_length
    
    # For y = y₀ + g₁x + (A/2L)x²
    # dy/dx = g₁ + (A/L)x = 0
    # x = -g₁L/A
    
    if abs(A_decimal) > 0.001:
        x_extreme = -g1_decimal * L / A_decimal
    else:
        # No extreme point (flat curve)
        x_extreme = L / 2.0
    
    # Check if extreme point is within curve
    if 0 <= x_extreme <= L:
        chainage_extreme = curve_params.chainage_start + x_extreme
        
        # Calculate RL at extreme point
        rl_extreme = (curve_params.rl_start + 
                     g1_decimal * x_extreme + 
                     (A_decimal / (2.0 * L)) * x_extreme**2)
        
        return chainage_extreme, rl_extreme
    else:
        # Extreme point outside curve - return VIP
        return vertical_curve.chainage_vip, vertical_curve.rl_vip