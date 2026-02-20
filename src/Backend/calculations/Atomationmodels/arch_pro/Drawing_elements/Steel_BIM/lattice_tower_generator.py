"""
structural_steel_bim/systems/lattice_tower_generator.py

Parametric generation of lattice transmission towers and telecommunications towers.
Implements British Standard and international practice for steel lattice structures.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
from enum import Enum
import numpy as np

from .geometry import Point3D, Line3D
from .member import Member, MemberType
from .section_properties import get_section_properties


class TowerType(Enum):
    """Lattice tower configurations."""
    SQUARE_TOWER = "Square Cross-Section"
    TRIANGULAR_TOWER = "Triangular Cross-Section"
    GUYED_MAST = "Guyed Mast"
    SELF_SUPPORTING = "Self-Supporting Tower"


class BracingPattern(Enum):
    """Web bracing configurations."""
    CROSS_BRACING = "X-Bracing"
    SINGLE_DIAGONAL = "Single Diagonal"
    K_BRACING = "K-Bracing"
    WARREN = "Warren Bracing"


@dataclass
class TowerSegment:
    """Definition of a tower segment with constant taper."""
    height: float  # mm - height of this segment
    base_width: float  # mm - width at bottom of segment
    top_width: float  # mm - width at top of segment
    num_panels: int  # Number of panels in this segment
    leg_section: str  # Section designation for leg members
    bracing_section: str  # Section designation for bracing
    bracing_pattern: BracingPattern


@dataclass
class LatticeTowerParameters:
    """Parametric definition of lattice tower."""
    tower_type: TowerType
    total_height: float  # mm
    segments: List[TowerSegment]
    
    # Number of legs (3 for triangular, 4 for square)
    num_legs: int = 4
    
    # Material grade
    grade: str = "S355"
    
    # Base plate level
    base_elevation: float = 0.0
    
    # Redundant bracing (double bracing in critical zones)
    redundant_bracing: bool = False


class LatticeTowerGenerator:
    """Generate parametric lattice tower systems."""
    
    def __init__(self, params: LatticeTowerParameters):
        self.params = params
        self.nodes: Dict[str, Point3D] = {}
        self.members: List[Member] = []
        
        # Validate
        if self.params.tower_type == TowerType.TRIANGULAR_TOWER and self.params.num_legs != 3:
            raise ValueError("Triangular tower must have 3 legs")
        if self.params.tower_type == TowerType.SQUARE_TOWER and self.params.num_legs != 4:
            raise ValueError("Square tower must have 4 legs")
    
    def generate(self) -> Dict[str, Any]:
        """Generate complete lattice tower system."""
        current_elevation = self.params.base_elevation
        
        for seg_idx, segment in enumerate(self.params.segments):
            self._generate_segment(segment, seg_idx, current_elevation)
            current_elevation += segment.height
        
        return self._serialize()
    
    def _generate_segment(self, segment: TowerSegment, segment_index: int, base_elevation: float):
        """Generate a single tapered segment of the tower."""
        panel_height = segment.height / segment.num_panels
        
        # Calculate width taper per panel
        width_taper = (segment.base_width - segment.top_width) / segment.num_panels
        
        # Generate nodes at each panel level
        for panel in range(segment.num_panels + 1):
            elevation = base_elevation + panel * panel_height
            width_at_level = segment.base_width - panel * width_taper
            
            # Generate leg nodes in plan
            if self.params.num_legs == 4:
                # Square tower - 4 corners
                leg_positions = [
                    (-width_at_level/2, -width_at_level/2),  # SW
                    (width_at_level/2, -width_at_level/2),   # SE
                    (width_at_level/2, width_at_level/2),    # NE
                    (-width_at_level/2, width_at_level/2),   # NW
                ]
            else:
                # Triangular tower - 3 corners at 120° spacing
                radius = width_at_level / np.sqrt(3)
                leg_positions = []
                for i in range(3):
                    angle = i * 2 * np.pi / 3 + np.pi / 6  # Start at 30°
                    x = radius * np.cos(angle)
                    y = radius * np.sin(angle)
                    leg_positions.append((x, y))
            
            # Create nodes
            for leg_idx, (x, y) in enumerate(leg_positions):
                node_id = f"S{segment_index}P{panel}L{leg_idx}"
                self.nodes[node_id] = Point3D(x, y, elevation)
        
        # Generate leg members
        leg_section = get_section_properties(segment.leg_section)
        for leg_idx in range(self.params.num_legs):
            for panel in range(segment.num_panels):
                start_node = f"S{segment_index}P{panel}L{leg_idx}"
                end_node = f"S{segment_index}P{panel+1}L{leg_idx}"
                
                member = Member(
                    centerline=Line3D(self.nodes[start_node], self.nodes[end_node]),
                    section=leg_section,
                    member_type=MemberType.LATTICE_LEG,
                    mark=f"LEG{leg_idx+1}_S{segment_index}P{panel+1}",
                    grade=self.params.grade
                )
                self.members.append(member)
        
        # Generate bracing members
        bracing_section = get_section_properties(segment.bracing_section)
        
        for panel in range(segment.num_panels):
            if segment.bracing_pattern == BracingPattern.CROSS_BRACING:
                self._add_cross_bracing(segment_index, panel, bracing_section)
            elif segment.bracing_pattern == BracingPattern.SINGLE_DIAGONAL:
                self._add_single_diagonal(segment_index, panel, bracing_section)
            elif segment.bracing_pattern == BracingPattern.K_BRACING:
                self._add_k_bracing(segment_index, panel, bracing_section)
            elif segment.bracing_pattern == BracingPattern.WARREN:
                self._add_warren_bracing(segment_index, panel, bracing_section)
    
    def _add_cross_bracing(self, seg_idx: int, panel: int, section):
        """Add X-bracing pattern to panel."""
        # Bracing on each face of the tower
        num_faces = self.params.num_legs
        
        for face in range(num_faces):
            leg_a = face
            leg_b = (face + 1) % self.params.num_legs
            
            # Bottom left to top right
            start_node = f"S{seg_idx}P{panel}L{leg_a}"
            end_node = f"S{seg_idx}P{panel+1}L{leg_b}"
            
            member = Member(
                centerline=Line3D(self.nodes[start_node], self.nodes[end_node]),
                section=section,
                member_type=MemberType.LATTICE_BRACING,
                mark=f"XB{face+1}_S{seg_idx}P{panel+1}A",
                grade=self.params.grade
            )
            self.members.append(member)
            
            # Bottom right to top left
            start_node = f"S{seg_idx}P{panel}L{leg_b}"
            end_node = f"S{seg_idx}P{panel+1}L{leg_a}"
            
            member = Member(
                centerline=Line3D(self.nodes[start_node], self.nodes[end_node]),
                section=section,
                member_type=MemberType.LATTICE_BRACING,
                mark=f"XB{face+1}_S{seg_idx}P{panel+1}B",
                grade=self.params.grade
            )
            self.members.append(member)
    
    def _add_single_diagonal(self, seg_idx: int, panel: int, section):
        """Add single diagonal bracing to panel."""
        num_faces = self.params.num_legs
        
        for face in range(num_faces):
            leg_a = face
            leg_b = (face + 1) % self.params.num_legs
            
            # Alternate direction on adjacent faces
            if face % 2 == 0:
                start_node = f"S{seg_idx}P{panel}L{leg_a}"
                end_node = f"S{seg_idx}P{panel+1}L{leg_b}"
            else:
                start_node = f"S{seg_idx}P{panel}L{leg_b}"
                end_node = f"S{seg_idx}P{panel+1}L{leg_a}"
            
            member = Member(
                centerline=Line3D(self.nodes[start_node], self.nodes[end_node]),
                section=section,
                member_type=MemberType.LATTICE_BRACING,
                mark=f"DB{face+1}_S{seg_idx}P{panel+1}",
                grade=self.params.grade
            )
            self.members.append(member)
    
    def _add_k_bracing(self, seg_idx: int, panel: int, section):
        """Add K-bracing pattern to panel."""
        # Create mid-height nodes on legs
        for leg_idx in range(self.params.num_legs):
            bottom_node = self.nodes[f"S{seg_idx}P{panel}L{leg_idx}"]
            top_node = self.nodes[f"S{seg_idx}P{panel+1}L{leg_idx}"]
            
            mid_point = Point3D(
                (bottom_node.x + top_node.x) / 2,
                (bottom_node.y + top_node.y) / 2,
                (bottom_node.z + top_node.z) / 2
            )
            
            node_id = f"S{seg_idx}P{panel}M{leg_idx}"
            self.nodes[node_id] = mid_point
        
        # Add K-bracing between legs
        num_faces = self.params.num_legs
        for face in range(num_faces):
            leg_a = face
            leg_b = (face + 1) % self.params.num_legs
            
            # Bottom to mid-opposite
            member = Member(
                centerline=Line3D(
                    self.nodes[f"S{seg_idx}P{panel}L{leg_a}"],
                    self.nodes[f"S{seg_idx}P{panel}M{leg_b}"]
                ),
                section=section,
                member_type=MemberType.LATTICE_BRACING,
                mark=f"KB{face+1}_S{seg_idx}P{panel+1}A",
                grade=self.params.grade
            )
            self.members.append(member)
            
            # Mid to top-opposite
            member = Member(
                centerline=Line3D(
                    self.nodes[f"S{seg_idx}P{panel}M{leg_a}"],
                    self.nodes[f"S{seg_idx}P{panel+1}L{leg_b}"]
                ),
                section=section,
                member_type=MemberType.LATTICE_BRACING,
                mark=f"KB{face+1}_S{seg_idx}P{panel+1}B",
                grade=self.params.grade
            )
            self.members.append(member)
    
    def _add_warren_bracing(self, seg_idx: int, panel: int, section):
        """Add Warren pattern bracing (alternating diagonals)."""
        num_faces = self.params.num_legs
        
        for face in range(num_faces):
            leg_a = face
            leg_b = (face + 1) % self.params.num_legs
            
            # Alternate diagonal direction based on panel number
            if (panel + face) % 2 == 0:
                start_node = f"S{seg_idx}P{panel}L{leg_a}"
                end_node = f"S{seg_idx}P{panel+1}L{leg_b}"
            else:
                start_node = f"S{seg_idx}P{panel}L{leg_b}"
                end_node = f"S{seg_idx}P{panel+1}L{leg_a}"
            
            member = Member(
                centerline=Line3D(self.nodes[start_node], self.nodes[end_node]),
                section=section,
                member_type=MemberType.LATTICE_BRACING,
                mark=f"WB{face+1}_S{seg_idx}P{panel+1}",
                grade=self.params.grade
            )
            self.members.append(member)
    
    def _serialize(self) -> Dict[str, Any]:
        """Serialize tower to dictionary."""
        return {
            'system_type': 'lattice_tower',
            'tower_type': self.params.tower_type.value,
            'parameters': {
                'total_height': self.params.total_height,
                'num_legs': self.params.num_legs,
                'num_segments': len(self.params.segments),
                'base_elevation': self.params.base_elevation
            },
            'nodes': {node_id: node.to_dict() for node_id, node in self.nodes.items()},
            'members': [member.to_dict() for member in self.members],
            'total_members': len(self.members),
            'total_mass_kg': sum(m.section.mass_per_meter * m.centerline.length() / 1000.0 
                                 for m in self.members),
            'segments': [
                {
                    'height': seg.height,
                    'base_width': seg.base_width,
                    'top_width': seg.top_width,
                    'num_panels': seg.num_panels,
                    'bracing_pattern': seg.bracing_pattern.value
                }
                for seg in self.params.segments
            ]
        }