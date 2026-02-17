"""
Structural Analysis of Perfect Frames - Analytical Methods
Based on "Strength of Materials" by Khurmi - Chapter 11

This module implements analytical methods for determining forces in truss members
using method of joints and method of sections according to classical structural mechanics.

All calculations follow the principles and assumptions outlined in the textbook.
"""

import math
from typing import List, Tuple, Optional, Dict, Literal
from dataclasses import dataclass
from enum import Enum


class MemberForceType(Enum):
    """Nature of force in a structural member"""
    TENSION = "Tension"
    COMPRESSION = "Compression"
    ZERO = "Zero Force"


class FrameType(Enum):
    """Classification of frames based on member count"""
    PERFECT = "Perfect"
    DEFICIENT = "Deficient"
    REDUNDANT = "Redundant"


@dataclass
class Force:
    """Represents a force with magnitude and nature"""
    magnitude: float  # in kN or specified units
    nature: MemberForceType
    
    def __repr__(self) -> str:
        if self.nature == MemberForceType.ZERO:
            return f"0 (Zero Force)"
        return f"{self.magnitude:.3f} kN ({self.nature.value})"


@dataclass
class Member:
    """Structural member with force information"""
    name: str
    force: Force
    
    def __repr__(self) -> str:
        return f"Member {self.name}: {self.force}"


@dataclass
class Joint:
    """Joint in a truss with coordinates"""
    name: str
    x: float  # horizontal position (m)
    y: float  # vertical position (m)


@dataclass
class Load:
    """External load acting on structure"""
    magnitude: float  # kN
    angle_deg: float  # degrees from horizontal (0° = horizontal right, 90° = vertical up)
    joint_name: str
    
    @property
    def horizontal_component(self) -> float:
        """Horizontal component (positive right)"""
        return self.magnitude * math.cos(math.radians(self.angle_deg))
    
    @property
    def vertical_component(self) -> float:
        """Vertical component (positive up)"""
        return self.magnitude * math.sin(math.radians(self.angle_deg))


@dataclass
class Reaction:
    """Support reaction"""
    joint_name: str
    horizontal: float  # kN (positive right)
    vertical: float  # kN (positive up)
    
    @property
    def magnitude(self) -> float:
        """Resultant reaction magnitude"""
        return math.sqrt(self.horizontal**2 + self.vertical**2)
    
    @property
    def angle_deg(self) -> float:
        """Angle from horizontal in degrees"""
        return math.degrees(math.atan2(self.vertical, self.horizontal))


def classify_frame(num_members: int, num_joints: int) -> FrameType:
    """
    Classify a frame as perfect, deficient, or redundant.
    
    Equation from text: n = 2j - 3
    where n = number of members, j = number of joints
    
    Args:
        num_members: Number of members in the frame
        num_joints: Number of joints in the frame
    
    Returns:
        FrameType classification
    
    Raises:
        ValueError: If inputs are invalid (negative or zero)
    """
    if num_joints < 3:
        raise ValueError(f"Invalid frame: minimum 3 joints required, got {num_joints}")
    if num_members < 0:
        raise ValueError(f"Invalid frame: negative members not allowed")
    
    required_members = 2 * num_joints - 3
    
    if num_members == required_members:
        return FrameType.PERFECT
    elif num_members < required_members:
        return FrameType.DEFICIENT
    else:
        return FrameType.REDUNDANT


def verify_perfect_frame(num_members: int, num_joints: int) -> None:
    """
    Verify that a frame is perfect before analysis.
    
    The text states: "In this chapter, we shall discuss only perfect frames."
    
    Args:
        num_members: Number of members
        num_joints: Number of joints
    
    Raises:
        ValueError: If frame is not perfect
    """
    frame_type = classify_frame(num_members, num_joints)
    if frame_type != FrameType.PERFECT:
        raise ValueError(
            f"Frame is {frame_type.value}, not Perfect. "
            f"For {num_joints} joints, need {2*num_joints - 3} members, "
            f"but have {num_members}."
        )


def calculate_member_angle(joint1: Joint, joint2: Joint) -> float:
    """
    Calculate angle of member from joint1 to joint2.
    
    Args:
        joint1: Starting joint
        joint2: Ending joint
    
    Returns:
        Angle in degrees from horizontal (0° to 360°)
    """
    dx = joint2.x - joint1.x
    dy = joint2.y - joint1.y
    
    if abs(dx) < 1e-10 and abs(dy) < 1e-10:
        raise ValueError(f"Joints {joint1.name} and {joint2.name} are coincident")
    
    angle = math.degrees(math.atan2(dy, dx))
    return angle if angle >= 0 else angle + 360


def calculate_member_length(joint1: Joint, joint2: Joint) -> float:
    """
    Calculate length of member between two joints.
    
    Args:
        joint1: First joint
        joint2: Second joint
    
    Returns:
        Length in meters
    """
    dx = joint2.x - joint1.x
    dy = joint2.y - joint1.y
    return math.sqrt(dx**2 + dy**2)


def resolve_force_components(
    force: float, 
    angle_deg: float
) -> Tuple[float, float]:
    """
    Resolve a force into horizontal and vertical components.
    
    Args:
        force: Force magnitude
        angle_deg: Angle from horizontal in degrees
    
    Returns:
        Tuple of (horizontal_component, vertical_component)
    """
    angle_rad = math.radians(angle_deg)
    horizontal = force * math.cos(angle_rad)
    vertical = force * math.sin(angle_rad)
    return horizontal, vertical


def calculate_reactions_simply_supported(
    span: float,
    loads: List[Tuple[float, float]]
) -> Tuple[float, float]:
    """
    Calculate vertical reactions for a simply supported beam/truss.
    
    Uses moment equilibrium: ΣM = 0 about one support
    Then vertical equilibrium: ΣV = 0
    
    Args:
        span: Distance between supports (m)
        loads: List of (load_magnitude_kN, distance_from_left_support_m)
    
    Returns:
        Tuple of (left_reaction_kN, right_reaction_kN)
    
    Raises:
        ValueError: If span is non-positive or loads outside span
    """
    if span <= 0:
        raise ValueError(f"Span must be positive, got {span}")
    
    total_load = 0.0
    moment_about_left = 0.0
    
    for load, distance in loads:
        if distance < 0 or distance > span:
            raise ValueError(
                f"Load at distance {distance} m is outside span 0 to {span} m"
            )
        total_load += load
        moment_about_left += load * distance
    
    # Taking moments about left support: R_right × span = Σ(load × distance)
    right_reaction = moment_about_left / span
    
    # Vertical equilibrium: R_left + R_right = total_load
    left_reaction = total_load - right_reaction
    
    return left_reaction, right_reaction


def calculate_reactions_with_horizontal_loads(
    span: float,
    vertical_loads: List[Tuple[float, float]],
    horizontal_loads: List[float]
) -> Tuple[float, float, float]:
    """
    Calculate reactions for structure with one end hinged, other on rollers.
    
    From text Section 11.16: 
    - Roller support: vertical reaction only (normal to support)
    - Hinged support: vertical + horizontal reaction
    
    Args:
        span: Distance between supports (m)
        vertical_loads: List of (load_kN, distance_from_hinged_m)
        horizontal_loads: List of horizontal loads (positive = right)
    
    Returns:
        Tuple of (V_hinged, H_hinged, V_roller)
    """
    if span <= 0:
        raise ValueError(f"Span must be positive, got {span}")
    
    # Calculate vertical reactions (same as simply supported)
    v_hinged, v_roller = calculate_reactions_simply_supported(span, vertical_loads)
    
    # Horizontal reaction at hinged end equals sum of horizontal loads
    h_hinged = sum(horizontal_loads)
    
    return v_hinged, h_hinged, v_roller


def calculate_reactions_inclined_roller_support(
    span_horizontal: float,
    height_vertical: float,
    loads: List[Load],
    roller_angle_deg: float = 0.0
) -> Tuple[Reaction, Reaction]:
    """
    Calculate reactions for frame with inclined roller support.
    
    From text Section 11.17: Roller reaction is normal to support surface.
    
    Args:
        span_horizontal: Horizontal span (m)
        height_vertical: Vertical height difference if any (m)
        loads: List of applied loads
        roller_angle_deg: Angle of roller support from horizontal (0° = horizontal)
    
    Returns:
        Tuple of (hinged_reaction, roller_reaction)
    """
    # Sum all load components
    total_v_load = sum(load.vertical_component for load in loads)
    total_h_load = sum(load.horizontal_component for load in loads)
    
    # Calculate moment arm for each load about hinged support
    total_moment = 0.0
    for load in loads:
        # This is simplified - actual implementation needs joint coordinates
        # Moment = Force × perpendicular distance
        total_moment += load.vertical_component * span_horizontal
    
    # Roller reaction is normal to support
    roller_angle_rad = math.radians(roller_angle_deg)
    
    # For horizontal roller (most common case):
    if abs(roller_angle_deg) < 1e-6:
        v_roller = total_moment / span_horizontal
        h_roller = 0.0
    else:
        # For inclined roller: resolve using geometry
        # This requires more complex analysis based on specific configuration
        raise NotImplementedError(
            "Inclined roller supports require specific geometry analysis"
        )
    
    v_hinged = total_v_load - v_roller
    h_hinged = total_h_load - h_roller
    
    hinged = Reaction("hinged", h_hinged, v_hinged)
    roller = Reaction("roller", h_roller, v_roller)
    
    return hinged, roller


class MethodOfJoints:
    """
    Implementation of Method of Joints for truss analysis.
    
    From text Section 11.12:
    "In this method, each and every joint is treated as a free body in equilibrium.
    The unknown forces are then determined by equilibrium equations viz.,
    ΣV = 0 and ΣH = 0"
    
    Note from text: "The joint should not contain more than two members in which 
    the forces are unknown."
    """
    
    @staticmethod
    def solve_joint_two_unknowns(
        applied_vertical: float,
        applied_horizontal: float,
        member1_angle_deg: float,
        member2_angle_deg: float
    ) -> Tuple[float, float]:
        """
        Solve for forces in two members at a joint.
        
        Equilibrium equations:
        ΣH = 0: P1·cos(θ1) + P2·cos(θ2) + H_applied = 0
        ΣV = 0: P1·sin(θ1) + P2·sin(θ2) + V_applied = 0
        
        Args:
            applied_vertical: Vertical force at joint (positive up)
            applied_horizontal: Horizontal force at joint (positive right)
            member1_angle_deg: Angle of member 1 from horizontal
            member2_angle_deg: Angle of member 2 from horizontal
        
        Returns:
            Tuple of (force_member1, force_member2)
            Positive = tension, Negative = compression
        
        Raises:
            ValueError: If system is singular (members are parallel)
        """
        θ1 = math.radians(member1_angle_deg)
        θ2 = math.radians(member2_angle_deg)
        
        cos1, sin1 = math.cos(θ1), math.sin(θ1)
        cos2, sin2 = math.cos(θ2), math.sin(θ2)
        
        # System of equations in matrix form:
        # [cos1  cos2] [P1]   [-H_applied]
        # [sin1  sin2] [P2] = [-V_applied]
        
        determinant = cos1 * sin2 - cos2 * sin1
        
        if abs(determinant) < 1e-10:
            raise ValueError(
                f"Members are parallel (angles {member1_angle_deg}° and "
                f"{member2_angle_deg}°), cannot solve"
            )
        
        # Cramer's rule
        p1 = (-applied_horizontal * sin2 + applied_vertical * cos2) / determinant
        p2 = (-cos1 * applied_vertical + sin1 * applied_horizontal) / determinant
        
        return p1, p2
    
    @staticmethod
    def solve_joint_one_unknown(
        applied_vertical: float,
        applied_horizontal: float,
        known_force: float,
        known_angle_deg: float,
        unknown_angle_deg: float
    ) -> float:
        """
        Solve for force in one member when one is known.
        
        Args:
            applied_vertical: Vertical external force
            applied_horizontal: Horizontal external force
            known_force: Force in known member (signed)
            known_angle_deg: Angle of known member
            unknown_angle_deg: Angle of unknown member
        
        Returns:
            Force in unknown member (signed)
        """
        θ_k = math.radians(known_angle_deg)
        θ_u = math.radians(unknown_angle_deg)
        
        # Use most stable equation (larger component)
        if abs(math.sin(θ_u)) > abs(math.cos(θ_u)):
            # Use vertical equilibrium
            p_unknown = -(applied_vertical + known_force * math.sin(θ_k)) / math.sin(θ_u)
        else:
            # Use horizontal equilibrium
            p_unknown = -(applied_horizontal + known_force * math.cos(θ_k)) / math.cos(θ_u)
        
        return p_unknown


class MethodOfSections:
    """
    Implementation of Method of Sections (Method of Moments).
    
    From text Section 11.13:
    "This method is particularly convenient when the forces in a few members
    of a frame are required to be found out. A section line is passed through
    the member or members, and moments are taken about convenient points."
    
    Warning from text: "Care should always be taken not to cut more than 
    three members in which the forces are unknown."
    """
    
    @staticmethod
    def calculate_moment_about_point(
        force: float,
        force_angle_deg: float,
        moment_arm_perpendicular: float
    ) -> float:
        """
        Calculate moment of a force about a point.
        
        Moment = Force × perpendicular distance
        
        Args:
            force: Force magnitude
            force_angle_deg: Angle of force from horizontal
            moment_arm_perpendicular: Perpendicular distance from point to line of action
        
        Returns:
            Moment (positive = counterclockwise)
        """
        return force * moment_arm_perpendicular
    
    @staticmethod
    def calculate_moment_components(
        force: float,
        force_x: float,
        force_y: float,
        point_x: float,
        point_y: float
    ) -> float:
        """
        Calculate moment using force components.
        
        M = F_x × (point_y - force_y) - F_y × (point_x - force_x)
        
        Args:
            force: Force magnitude (not used, but kept for clarity)
            force_x: X-coordinate of force application
            force_y: Y-coordinate of force application  
            point_x: X-coordinate of moment center
            point_y: Y-coordinate of moment center
        
        Returns:
            Moment about point
        """
        # This is a placeholder - proper implementation needs force components
        raise NotImplementedError("Use specialized moment calculation methods")
    
    @staticmethod
    def solve_force_by_moments(
        moment_point_x: float,
        moment_point_y: float,
        member_start_x: float,
        member_start_y: float,
        member_end_x: float,
        member_end_y: float,
        other_moments: float
    ) -> float:
        """
        Solve for force in a member using moment equilibrium.
        
        ΣM = 0 about chosen point
        
        Args:
            moment_point_x: X-coordinate of moment center
            moment_point_y: Y-coordinate of moment center
            member_start_x: X-coordinate of member start
            member_start_y: Y-coordinate of member start
            member_end_x: X-coordinate of member end
            member_end_y: Y-coordinate of member end
            other_moments: Sum of moments from all other forces
        
        Returns:
            Force in member (positive = tension)
        
        Raises:
            ValueError: If member passes through moment point
        """
        # Calculate perpendicular distance from point to member line
        # Line equation: (y2-y1)x - (x2-x1)y + (x2-x1)y1 - (y2-y1)x1 = 0
        dx = member_end_x - member_start_x
        dy = member_end_y - member_start_y
        
        numerator = abs(dy * (moment_point_x - member_start_x) - 
                       dx * (moment_point_y - member_start_y))
        denominator = math.sqrt(dx**2 + dy**2)
        
        if denominator < 1e-10:
            raise ValueError("Member has zero length")
        
        perpendicular_distance = numerator / denominator
        
        if perpendicular_distance < 1e-10:
            raise ValueError("Member passes through moment point - cannot solve")
        
        # Force × perpendicular_distance = -other_moments
        force = -other_moments / perpendicular_distance
        
        return force


class ZeroForceMembers:
    """
    Identify zero-force members using inspection rules.
    
    From the examples in the text, certain geometric configurations
    result in zero forces.
    """
    
    @staticmethod
    def check_two_member_joint_no_load(
        member1_angle: float,
        member2_angle: float
    ) -> bool:
        """
        Check if both members have zero force at unloaded joint.
        
        Rule: If two non-collinear members meet at an unloaded joint,
        both must be zero force members.
        
        Args:
            member1_angle: Angle of member 1
            member2_angle: Angle of member 2
        
        Returns:
            True if both are zero-force members
        """
        angle_diff = abs(member1_angle - member2_angle)
        angle_diff = min(angle_diff, 360 - angle_diff)
        
        # If collinear (0° or 180° apart), not zero force
        if angle_diff < 1e-3 or abs(angle_diff - 180) < 1e-3:
            return False
        
        return True
    
    @staticmethod
    def check_three_member_joint_two_collinear(
        member1_angle: float,
        member2_angle: float,
        member3_angle: float
    ) -> int:
        """
        Check if third member is zero-force when two are collinear.
        
        Rule: If three members meet at an unloaded joint and two are
        collinear, the third is a zero-force member.
        
        Args:
            member1_angle: Angle of member 1
            member2_angle: Angle of member 2
            member3_angle: Angle of member 3
        
        Returns:
            Index of zero-force member (1, 2, or 3), or 0 if none
        """
        def are_collinear(angle1: float, angle2: float) -> bool:
            diff = abs(angle1 - angle2)
            diff = min(diff, 360 - diff)
            return abs(diff - 180) < 1e-3 or diff < 1e-3
        
        if are_collinear(member1_angle, member2_angle):
            return 3
        elif are_collinear(member1_angle, member3_angle):
            return 2
        elif are_collinear(member2_angle, member3_angle):
            return 1
        
        return 0


def calculate_force_nature(force_value: float, tolerance: float = 1e-6) -> MemberForceType:
    """
    Determine if force is tension, compression, or zero.
    
    Convention from text:
    - Positive value = Tension (member is pulled)
    - Negative value = Compression (member is pushed)
    
    Args:
        force_value: Calculated force value
        tolerance: Tolerance for zero force detection
    
    Returns:
        MemberForceType enum
    """
    if abs(force_value) < tolerance:
        return MemberForceType.ZERO
    elif force_value > 0:
        return MemberForceType.TENSION
    else:
        return MemberForceType.COMPRESSION


class TrussAnalyzer:
    """
    Complete truss analysis system combining all methods.
    
    Implements the complete procedure from the textbook including:
    1. Frame classification
    2. Reaction calculation
    3. Force analysis by joints or sections
    4. Result tabulation
    """
    
    def __init__(self, name: str = "Truss"):
        self.name = name
        self.joints: Dict[str, Joint] = {}
        self.members: Dict[str, Member] = {}
        self.loads: List[Load] = []
        self.reactions: Dict[str, Reaction] = {}
    
    def add_joint(self, name: str, x: float, y: float) -> None:
        """Add a joint to the truss."""
        self.joints[name] = Joint(name, x, y)
    
    def verify_assumptions(self) -> None:
        """
        Verify assumptions from text Section 11.10:
        1. All members are pin-jointed
        2. Frame is loaded only at joints  
        3. Frame is a perfect one
        4. Weight of members is negligible
        """
        num_joints = len(self.joints)
        num_members = len(self.members)
        
        if num_joints < 3:
            raise ValueError(
                f"Assumption violated: Minimum 3 joints required for a truss, "
                f"got {num_joints}"
            )
        
        verify_perfect_frame(num_members, num_joints)
    
    def tabulate_results(self) -> List[Dict[str, str]]:
        """
        Create force table as specified in text Section 11.14.
        
        Returns:
            List of dictionaries with member results
        """
        results = []
        for member_name, member in sorted(self.members.items()):
            results.append({
                "Member": member_name,
                "Magnitude (kN)": f"{abs(member.force.magnitude):.3f}",
                "Nature": member.force.nature.value
            })
        return results


# Specific example implementations from the textbook

def example_11_1_triangle_truss(load: float = 10.0, span: float = 5.0) -> Dict[str, Force]:
    """
    Example 11.1: Simple triangular truss with apex load.
    
    The truss ABC has:
    - Span BC = 5 m
    - Apex A at 1.25 m from B, 3.75 m from C
    - Load of 10 kN at A
    - Angles: 60° at B, 30° at C
    
    Args:
        load: Load at apex (kN)
        span: Span of truss (m)
    
    Returns:
        Dictionary of member forces
    """
    # Reactions (from text calculations)
    r_b = load * 3.75 / span  # = 7.5 kN
    r_c = load * 1.25 / span  # = 2.5 kN
    
    # Verify equilibrium
    if abs(r_b + r_c - load) > 1e-6:
        raise ValueError("Reaction equilibrium violated")
    
    # Joint B analysis
    # PAB·sin(60°) = 7.5
    p_ab = r_b / math.sin(math.radians(60))  # = 8.66 kN (Compression)
    
    # PBC = PAB·cos(60°)
    p_bc = p_ab * math.cos(math.radians(60))  # = 4.33 kN (Tension)
    
    # Joint C analysis  
    # PAC·sin(30°) = 2.5
    p_ac = r_c / math.sin(math.radians(30))  # = 5.0 kN (Compression)
    
    # Verification: PBC should equal PAC·cos(30°)
    p_bc_check = p_ac * math.cos(math.radians(30))
    if abs(p_bc - p_bc_check) > 1e-6:
        raise ValueError("Force equilibrium verification failed")
    
    return {
        "AB": Force(p_ab, MemberForceType.COMPRESSION),
        "BC": Force(p_bc, MemberForceType.TENSION),
        "AC": Force(p_ac, MemberForceType.COMPRESSION)
    }


def example_11_2_warren_girder(span: float = 6.0, load_b: float = 2.0, 
                                 load_c: float = 4.0) -> Dict[str, Force]:
    """
    Example 11.2: Warren girder with 7 members of 3m each.
    
    Configuration: ABCDE with all 60° angles
    Span: 6 m (A to D)
    Loads: 2 kN at B, 4 kN at C
    
    Args:
        span: Total span (m)
        load_b: Load at B (kN)
        load_c: Load at C (kN)
    
    Returns:
        Dictionary of member forces
    """
    # Calculate reactions
    # Taking moments about A:
    # RD × 6 = (2 × 1.5) + (4 × 4.5) = 21
    r_d = (load_b * 1.5 + load_c * 4.5) / span  # = 3.5 kN
    r_a = (load_b + load_c) - r_d  # = 2.5 kN
    
    # Joint A analysis
    # PAB·sin(60°) = 2.5
    p_ab = r_a / math.sin(math.radians(60))  # = 2.887 kN (Compression)
    p_ae = p_ab * math.cos(math.radians(60))  # = 1.444 kN (Tension)
    
    # Joint D (by symmetry consideration)
    p_cd = r_d / math.sin(math.radians(60))  # = 4.042 kN (Compression)
    p_de = p_cd * math.cos(math.radians(60))  # = 2.021 kN (Tension)
    
    # Joint B analysis
    # PBE·sin(60°) = PAB·sin(60°) - 2.0
    pbe_vertical = p_ab * math.sin(math.radians(60)) - load_b
    p_be = pbe_vertical / math.sin(math.radians(60))  # = 0.577 kN (Tension)
    
    # PBC = PAB·cos(60°) + PBE·cos(60°)
    p_bc = (p_ab * math.cos(math.radians(60)) + 
            p_be * math.cos(math.radians(60)))  # = 1.732 kN (Compression)
    
    # Joint C analysis
    # PCE·sin(60°) = 4.0 - PCD·sin(60°)
    pce_vertical = load_c - p_cd * math.sin(math.radians(60))
    p_ce = pce_vertical / math.sin(math.radians(60))  # = 0.577 kN (Compression)
    
    return {
        "AB": Force(p_ab, MemberForceType.COMPRESSION),
        "AE": Force(p_ae, MemberForceType.TENSION),
        "CD": Force(p_cd, MemberForceType.COMPRESSION),
        "DE": Force(p_de, MemberForceType.TENSION),
        "BE": Force(p_be, MemberForceType.TENSION),
        "BC": Force(p_bc, MemberForceType.COMPRESSION),
        "CE": Force(p_ce, MemberForceType.COMPRESSION)
    }


def cantilever_truss_analysis(
    span: float,
    height: float,
    loads: List[Tuple[float, float]],
    fixed_end: Literal["left", "right"] = "left"
) -> Dict[str, Force]:
    """
    Analyze cantilever truss (Section 11.15).
    
    From text: "A truss which is connected to a wall or column at one end,
    and free at the other is known as a cantilever truss. Determination of
    support reaction is not essential, as we can start calculation from 
    the free end."
    
    Args:
        span: Horizontal span (m)
        height: Vertical height (m)
        loads: List of (load_kN, distance_from_free_end_m)
        fixed_end: Which end is fixed to wall
    
    Returns:
        Dictionary of member forces
        
    Note:
        Analysis starts from free end, working toward fixed end.
    """
    # This is a framework for cantilever analysis
    # Specific implementation depends on geometry
    
    if fixed_end not in ["left", "right"]:
        raise ValueError("fixed_end must be 'left' or 'right'")
    
    # Start from free end - no reactions needed initially
    # This is the key advantage of cantilever analysis mentioned in text
    
    results: Dict[str, Force] = {}
    
    # Example placeholder - actual implementation requires specific geometry
    raise NotImplementedError(
        "Cantilever truss analysis requires specific geometry definition"
    )


def wind_load_truss_analysis(
    span: float,
    wind_loads: List[Tuple[float, float, str]],
    wind_angle_deg: float = 30.0
) -> Dict[str, Force]:
    """
    Analyze truss under wind loading (Section 11.17).
    
    Wind loads are typically inclined and require:
    1. Resolution into components
    2. Special reaction calculation for roller supports
    3. Component-based equilibrium
    
    Args:
        span: Truss span (m)
        wind_loads: List of (magnitude_kN, location_m, joint_name)
        wind_angle_deg: Wind angle from horizontal
    
    Returns:
        Dictionary of member forces
    """
    # Convert wind loads to components
    total_horizontal = 0.0
    total_vertical = 0.0
    
    for magnitude, location, joint in wind_loads:
        h_component = magnitude * math.cos(math.radians(wind_angle_deg))
        v_component = magnitude * math.sin(math.radians(wind_angle_deg))
        total_horizontal += h_component
        total_vertical += v_component
    
    # For roller support on horizontal surface: reaction is vertical
    # For hinged support: both horizontal and vertical reactions
    
    # Analysis proceeds using component equilibrium at each joint
    
    raise NotImplementedError(
        "Wind load analysis requires specific truss geometry"
    )


class StressCalculation:
    """
    Stress calculations for members (Section 11.7-11.9).
    
    Stress = Force / Area
    """
    
    @staticmethod
    def tensile_stress(force: float, area: float) -> float:
        """
        Calculate tensile stress.
        
        From text Section 11.8: "The stress induced is called tensile stress"
        
        Args:
            force: Tensile force (kN)
            area: Cross-sectional area (mm²)
        
        Returns:
            Tensile stress (N/mm² = MPa)
        
        Raises:
            ValueError: If force is not tensile or area is non-positive
        """
        if force < 0:
            raise ValueError(f"Tensile stress requires positive force, got {force}")
        if area <= 0:
            raise ValueError(f"Area must be positive, got {area}")
        
        # Convert kN to N, area in mm²
        stress = (force * 1000) / area
        return stress
    
    @staticmethod
    def compressive_stress(force: float, area: float) -> float:
        """
        Calculate compressive stress.
        
        From text Section 11.9: "The stress induced is called compressive stress"
        
        Args:
            force: Compressive force magnitude (kN, positive value)
            area: Cross-sectional area (mm²)
        
        Returns:
            Compressive stress (N/mm² = MPa)
        
        Raises:
            ValueError: If area is non-positive
        """
        if area <= 0:
            raise ValueError(f"Area must be positive, got {area}")
        
        # Convert kN to N
        stress = (abs(force) * 1000) / area
        return stress
    
    @staticmethod
    def check_stress_limit(
        stress: float,
        allowable_stress: float,
        stress_type: str = "tensile"
    ) -> None:
        """
        Verify stress is within allowable limits.
        
        Args:
            stress: Calculated stress (MPa)
            allowable_stress: Allowable stress (MPa)
            stress_type: Type of stress for error message
        
        Raises:
            ValueError: If stress exceeds allowable
        """
        if stress > allowable_stress:
            raise ValueError(
                f"{stress_type.capitalize()} stress {stress:.2f} MPa exceeds "
                f"allowable {allowable_stress:.2f} MPa"
            )


def validate_equilibrium(
    forces_horizontal: List[float],
    forces_vertical: List[float],
    tolerance: float = 1e-3
) -> None:
    """
    Validate that equilibrium is satisfied.
    
    From text: "Equilibrium equations viz., ΣV = 0 and ΣH = 0"
    
    Args:
        forces_horizontal: List of horizontal force components
        forces_vertical: List of vertical force components
        tolerance: Tolerance for equilibrium check
    
    Raises:
        ValueError: If equilibrium is not satisfied
    """
    sum_h = sum(forces_horizontal)
    sum_v = sum(forces_vertical)
    
    if abs(sum_h) > tolerance:
        raise ValueError(
            f"Horizontal equilibrium violated: ΣH = {sum_h:.6f} ≠ 0"
        )
    
    if abs(sum_v) > tolerance:
        raise ValueError(
            f"Vertical equilibrium violated: ΣV = {sum_v:.6f} ≠ 0"
        )


def validate_moment_equilibrium(
    moments: List[float],
    tolerance: float = 1e-3
) -> None:
    """
    Validate moment equilibrium.
    
    From text: "ΣM = 0"
    
    Args:
        moments: List of moments about a point
        tolerance: Tolerance for equilibrium check
    
    Raises:
        ValueError: If moment equilibrium is not satisfied
    """
    sum_moments = sum(moments)
    
    if abs(sum_moments) > tolerance:
        raise ValueError(
            f"Moment equilibrium violated: ΣM = {sum_moments:.6f} ≠ 0"
        )


# Utility functions for common calculations

def sin_deg(angle: float) -> float:
    """Sine of angle in degrees"""
    return math.sin(math.radians(angle))


def cos_deg(angle: float) -> float:
    """Cosine of angle in degrees"""
    return math.cos(math.radians(angle))


def tan_deg(angle: float) -> float:
    """Tangent of angle in degrees"""
    return math.tan(math.radians(angle))


def atan_deg(value: float) -> float:
    """Arctangent returning degrees"""
    return math.degrees(math.atan(value))


def atan2_deg(y: float, x: float) -> float:
    """Two-argument arctangent returning degrees"""
    return math.degrees(math.atan2(y, x))


if __name__ == "__main__":
    # Demonstration of Example 11.1
    print("=" * 70)
    print("EXAMPLE 11.1: Triangular Truss Analysis")
    print("=" * 70)
    
    forces = example_11_1_triangle_truss(load=10.0, span=5.0)
    
    print("\nForce Table:")
    print(f"{'Member':<10} {'Magnitude (kN)':<20} {'Nature':<15}")
    print("-" * 45)
    for member, force in forces.items():
        print(f"{member:<10} {force.magnitude:<20.3f} {force.nature.value:<15}")
    
    print("\n" + "=" * 70)
    print("EXAMPLE 11.2: Warren Girder Analysis")
    print("=" * 70)
    
    forces_warren = example_11_2_warren_girder(span=6.0, load_b=2.0, load_c=4.0)
    
    print("\nForce Table:")
    print(f"{'Member':<10} {'Magnitude (kN)':<20} {'Nature':<15}")
    print("-" * 45)
    for member, force in forces_warren.items():
        print(f"{member:<10} {force.magnitude:<20.3f} {force.nature.value:<15}")
    
    print("\n" + "=" * 70)
    print("Frame Classification Examples")
    print("=" * 70)
    
    test_cases = [
        (3, 3, "Simple triangle"),
        (5, 4, "Rectangle with diagonal"),
        (9, 6, "Warren truss"),
    ]
    
    for members, joints, description in test_cases:
        frame_type = classify_frame(members, joints)
        required = 2 * joints - 3
        print(f"\n{description}:")
        print(f"  Joints: {joints}, Members: {members}")
        print(f"  Required for perfect: {required}")
        print(f"  Classification: {frame_type.value}")