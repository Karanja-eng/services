"""
structural_steel_bim/systems/truss_generator.py

Parametric truss generation for roof trusses, bridge trusses, and space frames.
Implements standard truss configurations per BS 5950.
"""

from dataclasses import dataclass
from typing import List, Tuple, Dict, Any, Optional
from enum import Enum
import numpy as np

from ..core.geometry import Point3D, Line3D
from ..members.member import Member, MemberType, EndCondition
from ..sections.section_properties import SectionProperties, get_section_properties


class TrussType(Enum):
    """Standard truss configurations."""
    PRATT = "Pratt"  # Verticals in compression, diagonals in tension
    HOWE = "Howe"  # Verticals in tension, diagonals in compression
    WARREN = "Warren"  # No verticals, alternating diagonals
    WARREN_WITH_VERTICALS = "Warren with Verticals"
    FINK = "Fink"  # Pitched roof truss
    FAN = "Fan"  # Radiating members from support
    NORTH_LIGHT = "North Light"  # Asymmetric roof truss
    BOWSTRING = "Bowstring"  # Curved top chord
    VIERENDEEL = "Vierendeel"  # No diagonals, moment connections
    K_TRUSS = "K-Truss"  # K-pattern web members
    SPACE_TRUSS = "Space Truss"  # 3D truss system


@dataclass
class TrussParameters:
    """Parametric definition of truss geometry."""
    truss_type: TrussType
    span: float  # mm
    depth: float  # mm - depth at center for parallel chord, at support for pitched
    num_panels: int  # Number of bays
    
    # Pitched roof parameters
    pitch_angle: float = 0.0  # degrees - roof pitch
    is_symmetric: bool = True
    
    # Chord sections
    top_chord_section: str = "150x150x12EA"
    bottom_chord_section: str = "150x150x12EA"
    web_section: str = "90x90x12EA"
    
    # Camber (mm) - upward deflection at center
    camber: float = 0.0
    
    # Support conditions
    left_support_offset: float = 0.0  # mm from end
    right_support_offset: float = 0.0  # mm from end
    
    # Material grade
    grade: str = "S355"
    
    # K-truss specific
    k_point_ratio: float = 0.5  # Height ratio for K-intersection point


class TrussGenerator:
    """Generate parametric truss systems."""
    
    def __init__(self, params: TrussParameters):
        self.params = params
        self.nodes: Dict[str, Point3D] = {}
        self.members: List[Member] = []
        self.member_counter = 0
        
    def generate(self) -> Dict[str, Any]:
        """Generate complete truss system."""
        if self.params.truss_type == TrussType.PRATT:
            self._generate_pratt_truss()
        elif self.params.truss_type == TrussType.HOWE:
            self._generate_howe_truss()
        elif self.params.truss_type == TrussType.WARREN:
            self._generate_warren_truss(include_verticals=False)
        elif self.params.truss_type == TrussType.WARREN_WITH_VERTICALS:
            self._generate_warren_truss(include_verticals=True)
        elif self.params.truss_type == TrussType.FINK:
            self._generate_fink_truss()
        elif self.params.truss_type == TrussType.K_TRUSS:
            self._generate_k_truss()
        elif self.params.truss_type == TrussType.BOWSTRING:
            self._generate_bowstring_truss()
        else:
            raise NotImplementedError(f"Truss type {self.params.truss_type} not yet implemented")
        
        return self._serialize()
    
    def _generate_pratt_truss(self):
        """Generate Pratt truss - verticals in compression, diagonals in tension."""
        panel_length = self.params.span / self.params.num_panels
        
        # Generate nodes
        for i in range(self.params.num_panels + 1):
            x = i * panel_length
            
            # Bottom chord nodes (with camber)
            camber_at_x = self._calculate_camber(x)
            bottom_node = Point3D(x, 0, camber_at_x)
            self.nodes[f"B{i}"] = bottom_node
            
            # Top chord nodes
            if self.params.pitch_angle > 0:
                # Pitched roof
                z_top = self._calculate_pitched_height(x) + camber_at_x
            else:
                # Parallel chord
                z_top = self.params.depth + camber_at_x
            
            top_node = Point3D(x, 0, z_top)
            self.nodes[f"T{i}"] = top_node
        
        # Top chord members
        top_section = get_section_properties(self.params.top_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"T{i}"], self.nodes[f"T{i+1}"]),
                section=top_section,
                member_type=MemberType.CHORD,
                mark=f"TC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        # Bottom chord members
        bottom_section = get_section_properties(self.params.bottom_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"B{i+1}"]),
                section=bottom_section,
                member_type=MemberType.CHORD,
                mark=f"BC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        # Web members
        web_section = get_section_properties(self.params.web_section)
        
        # Verticals
        for i in range(self.params.num_panels + 1):
            if i == 0 or i == self.params.num_panels:
                # End verticals (typically compression)
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"T{i}"]),
                    section=web_section,
                    member_type=MemberType.VERTICAL,
                    mark=f"V{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
            elif i > 0 and i < self.params.num_panels:
                # Internal verticals
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"T{i}"]),
                    section=web_section,
                    member_type=MemberType.VERTICAL,
                    mark=f"V{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
        
        # Diagonals (Pratt pattern: tension diagonals slope toward center)
        for i in range(self.params.num_panels):
            if i < self.params.num_panels // 2:
                # Left half: diagonals slope right-upward
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"T{i+1}"]),
                    section=web_section,
                    member_type=MemberType.DIAGONAL,
                    mark=f"D{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
            else:
                # Right half: diagonals slope left-upward
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i+1}"], self.nodes[f"T{i}"]),
                    section=web_section,
                    member_type=MemberType.DIAGONAL,
                    mark=f"D{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
    
    def _generate_howe_truss(self):
        """Generate Howe truss - verticals in tension, diagonals in compression."""
        panel_length = self.params.span / self.params.num_panels
        
        # Generate nodes (same as Pratt)
        for i in range(self.params.num_panels + 1):
            x = i * panel_length
            camber_at_x = self._calculate_camber(x)
            
            bottom_node = Point3D(x, 0, camber_at_x)
            self.nodes[f"B{i}"] = bottom_node
            
            if self.params.pitch_angle > 0:
                z_top = self._calculate_pitched_height(x) + camber_at_x
            else:
                z_top = self.params.depth + camber_at_x
            
            top_node = Point3D(x, 0, z_top)
            self.nodes[f"T{i}"] = top_node
        
        # Chords (same as Pratt)
        top_section = get_section_properties(self.params.top_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"T{i}"], self.nodes[f"T{i+1}"]),
                section=top_section,
                member_type=MemberType.CHORD,
                mark=f"TC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        bottom_section = get_section_properties(self.params.bottom_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"B{i+1}"]),
                section=bottom_section,
                member_type=MemberType.CHORD,
                mark=f"BC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        web_section = get_section_properties(self.params.web_section)
        
        # Verticals
        for i in range(1, self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"T{i}"]),
                section=web_section,
                member_type=MemberType.VERTICAL,
                mark=f"V{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        # Diagonals (Howe pattern: compression diagonals slope toward center)
        for i in range(self.params.num_panels):
            if i < self.params.num_panels // 2:
                # Left half: diagonals slope left-upward
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i+1}"], self.nodes[f"T{i}"]),
                    section=web_section,
                    member_type=MemberType.DIAGONAL,
                    mark=f"D{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
            else:
                # Right half: diagonals slope right-upward
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"T{i+1}"]),
                    section=web_section,
                    member_type=MemberType.DIAGONAL,
                    mark=f"D{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
    
    def _generate_warren_truss(self, include_verticals: bool = False):
        """Generate Warren truss - alternating diagonal pattern."""
        panel_length = self.params.span / self.params.num_panels
        
        # Generate nodes
        for i in range(self.params.num_panels + 1):
            x = i * panel_length
            camber_at_x = self._calculate_camber(x)
            
            bottom_node = Point3D(x, 0, camber_at_x)
            self.nodes[f"B{i}"] = bottom_node
            
            if self.params.pitch_angle > 0:
                z_top = self._calculate_pitched_height(x) + camber_at_x
            else:
                z_top = self.params.depth + camber_at_x
            
            top_node = Point3D(x, 0, z_top)
            self.nodes[f"T{i}"] = top_node
        
        # Chords
        top_section = get_section_properties(self.params.top_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"T{i}"], self.nodes[f"T{i+1}"]),
                section=top_section,
                member_type=MemberType.CHORD,
                mark=f"TC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        bottom_section = get_section_properties(self.params.bottom_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"B{i+1}"]),
                section=bottom_section,
                member_type=MemberType.CHORD,
                mark=f"BC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        web_section = get_section_properties(self.params.web_section)
        
        # Diagonals - alternating pattern
        for i in range(self.params.num_panels):
            if i % 2 == 0:
                # Upward left-to-right
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"T{i+1}"]),
                    section=web_section,
                    member_type=MemberType.DIAGONAL,
                    mark=f"D{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
            else:
                # Upward right-to-left
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i+1}"], self.nodes[f"T{i}"]),
                    section=web_section,
                    member_type=MemberType.DIAGONAL,
                    mark=f"D{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
        
        # Optional verticals at panel points
        if include_verticals:
            for i in range(1, self.params.num_panels):
                member = Member(
                    centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"T{i}"]),
                    section=web_section,
                    member_type=MemberType.VERTICAL,
                    mark=f"V{i+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
    
    def _generate_fink_truss(self):
        """Generate Fink (W-truss) for pitched roofs."""
        if self.params.pitch_angle == 0:
            raise ValueError("Fink truss requires pitched roof (pitch_angle > 0)")
        
        # Fink truss typically has even number of panels (4, 6, 8)
        if self.params.num_panels % 2 != 0:
            raise ValueError("Fink truss requires even number of panels")
        
        half_panels = self.params.num_panels // 2
        panel_length = self.params.span / self.params.num_panels
        
        # Bottom chord nodes
        for i in range(self.params.num_panels + 1):
            x = i * panel_length
            camber_at_x = self._calculate_camber(x)
            self.nodes[f"B{i}"] = Point3D(x, 0, camber_at_x)
        
        # Top chord nodes (pitched)
        for i in range(self.params.num_panels + 1):
            x = i * panel_length
            camber_at_x = self._calculate_camber(x)
            z_top = self._calculate_pitched_height(x) + camber_at_x
            self.nodes[f"T{i}"] = Point3D(x, 0, z_top)
        
        # Internal web nodes for W-pattern
        # Create intermediate nodes at 1/4, 1/2, 3/4 points vertically
        for i in range(1, self.params.num_panels):
            x = i * panel_length
            camber_at_x = self._calculate_camber(x)
            z_bottom = camber_at_x
            z_top = self._calculate_pitched_height(x) + camber_at_x
            
            # Mid-height node for web intersection
            z_mid = (z_bottom + z_top) / 2
            self.nodes[f"M{i}"] = Point3D(x, 0, z_mid)
        
        # Chords
        top_section = get_section_properties(self.params.top_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"T{i}"], self.nodes[f"T{i+1}"]),
                section=top_section,
                member_type=MemberType.CHORD,
                mark=f"TC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        bottom_section = get_section_properties(self.params.bottom_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"B{i+1}"]),
                section=bottom_section,
                member_type=MemberType.CHORD,
                mark=f"BC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        web_section = get_section_properties(self.params.web_section)
        
        # W-pattern web members
        for i in range(1, self.params.num_panels):
            # From bottom to mid-height
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"M{i}"]),
                section=web_section,
                member_type=MemberType.WEB,
                mark=f"W{i}A",
                grade=self.params.grade
            )
            self.members.append(member)
            
            # From mid-height to top chord
            if i % 2 == 1:
                # Connect to top chord points
                member = Member(
                    centerline=Line3D(self.nodes[f"M{i}"], self.nodes[f"T{i}"]),
                    section=web_section,
                    member_type=MemberType.WEB,
                    mark=f"W{i}B",
                    grade=self.params.grade
                )
                self.members.append(member)
        
        # Apex member if needed
        apex_index = half_panels
        member = Member(
            centerline=Line3D(self.nodes[f"B{apex_index}"], self.nodes[f"T{apex_index}"]),
            section=web_section,
            member_type=MemberType.VERTICAL,
            mark=f"V_APEX",
            grade=self.params.grade
        )
        self.members.append(member)
    
    def _generate_k_truss(self):
        """Generate K-truss with K-pattern web members."""
        panel_length = self.params.span / self.params.num_panels
        
        # Generate chord nodes
        for i in range(self.params.num_panels + 1):
            x = i * panel_length
            camber_at_x = self._calculate_camber(x)
            
            self.nodes[f"B{i}"] = Point3D(x, 0, camber_at_x)
            
            if self.params.pitch_angle > 0:
                z_top = self._calculate_pitched_height(x) + camber_at_x
            else:
                z_top = self.params.depth + camber_at_x
            
            self.nodes[f"T{i}"] = Point3D(x, 0, z_top)
        
        # K-point nodes at mid-panel
        for i in range(self.params.num_panels):
            x = (i + 0.5) * panel_length
            camber_at_x = self._calculate_camber(x)
            
            z_bottom = camber_at_x
            if self.params.pitch_angle > 0:
                z_top = self._calculate_pitched_height(x) + camber_at_x
            else:
                z_top = self.params.depth + camber_at_x
            
            # K-point at specified ratio of height
            z_k = z_bottom + (z_top - z_bottom) * self.params.k_point_ratio
            self.nodes[f"K{i}"] = Point3D(x, 0, z_k)
        
        # Chords
        top_section = get_section_properties(self.params.top_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"T{i}"], self.nodes[f"T{i+1}"]),
                section=top_section,
                member_type=MemberType.CHORD,
                mark=f"TC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        bottom_section = get_section_properties(self.params.bottom_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"B{i+1}"]),
                section=bottom_section,
                member_type=MemberType.CHORD,
                mark=f"BC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        web_section = get_section_properties(self.params.web_section)
        
        # K-pattern web members
        for i in range(self.params.num_panels):
            # Bottom chord to K-point
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"K{i}"]),
                section=web_section,
                member_type=MemberType.WEB,
                mark=f"K{i+1}A",
                grade=self.params.grade
            )
            self.members.append(member)
            
            member = Member(
                centerline=Line3D(self.nodes[f"K{i}"], self.nodes[f"B{i+1}"]),
                section=web_section,
                member_type=MemberType.WEB,
                mark=f"K{i+1}B",
                grade=self.params.grade
            )
            self.members.append(member)
            
            # K-point to top chord
            member = Member(
                centerline=Line3D(self.nodes[f"K{i}"], self.nodes[f"T{i}"]),
                section=web_section,
                member_type=MemberType.WEB,
                mark=f"K{i+1}C",
                grade=self.params.grade
            )
            self.members.append(member)
            
            member = Member(
                centerline=Line3D(self.nodes[f"K{i}"], self.nodes[f"T{i+1}"]),
                section=web_section,
                member_type=MemberType.WEB,
                mark=f"K{i+1}D",
                grade=self.params.grade
            )
            self.members.append(member)
    
    def _generate_bowstring_truss(self):
        """Generate bowstring truss with curved top chord."""
        panel_length = self.params.span / self.params.num_panels
        
        # Bottom chord is straight
        for i in range(self.params.num_panels + 1):
            x = i * panel_length
            camber_at_x = self._calculate_camber(x)
            self.nodes[f"B{i}"] = Point3D(x, 0, camber_at_x)
        
        # Top chord follows parabolic curve
        # Maximum rise at center = depth parameter
        for i in range(self.params.num_panels + 1):
            x = i * panel_length
            camber_at_x = self._calculate_camber(x)
            
            # Parabolic profile: z = 4*depth/span^2 * x * (span - x)
            normalized_x = x - self.params.span / 2
            z_curve = self.params.depth * (1 - (2 * normalized_x / self.params.span) ** 2)
            z_top = z_curve + camber_at_x
            
            self.nodes[f"T{i}"] = Point3D(x, 0, z_top)
        
        # Chords
        top_section = get_section_properties(self.params.top_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"T{i}"], self.nodes[f"T{i+1}"]),
                section=top_section,
                member_type=MemberType.CHORD,
                mark=f"TC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        bottom_section = get_section_properties(self.params.bottom_chord_section)
        for i in range(self.params.num_panels):
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"B{i+1}"]),
                section=bottom_section,
                member_type=MemberType.CHORD,
                mark=f"BC{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
        
        # Vertical web members
        web_section = get_section_properties(self.params.web_section)
        for i in range(self.params.num_panels + 1):
            member = Member(
                centerline=Line3D(self.nodes[f"B{i}"], self.nodes[f"T{i}"]),
                section=web_section,
                member_type=MemberType.VERTICAL,
                mark=f"V{i+1}",
                grade=self.params.grade
            )
            self.members.append(member)
    
    def _calculate_camber(self, x: float) -> float:
        """Calculate camber (upward deflection) at position x."""
        if self.params.camber == 0:
            return 0.0
        
        # Parabolic camber profile
        span = self.params.span
        return self.params.camber * (1 - (2 * (x - span/2) / span) ** 2)
    
    def _calculate_pitched_height(self, x: float) -> float:
        """Calculate height of pitched roof at position x."""
        half_span = self.params.span / 2
        
        if self.params.is_symmetric:
            # Symmetric pitched roof
            distance_from_center = abs(x - half_span)
            return self.params.depth - distance_from_center * np.tan(np.radians(self.params.pitch_angle))
        else:
            # Asymmetric - pitch from one end
            return self.params.depth - x * np.tan(np.radians(self.params.pitch_angle))
    
    def _serialize(self) -> Dict[str, Any]:
        """Serialize truss system to dictionary."""
        return {
            'system_type': 'truss',
            'truss_type': self.params.truss_type.value,
            'parameters': {
                'span': self.params.span,
                'depth': self.params.depth,
                'num_panels': self.params.num_panels,
                'pitch_angle': self.params.pitch_angle,
                'camber': self.params.camber
            },
            'nodes': {node_id: node.to_dict() for node_id, node in self.nodes.items()},
            'members': [member.to_dict() for member in self.members],
            'total_members': len(self.members),
            'total_mass_kg': sum(m.section.mass_per_meter * m.centerline.length() / 1000.0 
                                 for m in self.members)
        }