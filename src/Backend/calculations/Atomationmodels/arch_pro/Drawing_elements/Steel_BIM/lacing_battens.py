"""
structural_steel_bim/connections/lacing_battens.py

Lacing and batten systems for built-up compression members per BS 5950.
Used in lattice columns, built-up struts, and crane girder construction.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
import numpy as np

from ..core.geometry import Point3D, Line3D, Vector3D
from ..members.member import Member, MemberType
from ..sections.section_properties import SectionProperties, get_section_properties


class BuildUpType(Enum):
    """Built-up member configurations."""
    LACED = "Laced"
    BATTENED = "Battened"
    LACED_AND_BATTENED = "Laced and Battened"


@dataclass
class LacingParameters:
    """Lacing system parameters per BS 5950-1 Section 4.7.10."""
    
    # Lacing bar section
    lacing_section: str  # Typically flat bar or angle
    
    # Geometry
    inclination_angle: float  # degrees - typically 40° to 70° to member axis
    spacing: float  # mm - longitudinal spacing between lacing intersections
    
    # Pattern
    single_lacing: bool = True  # False for double lacing (Warren pattern)
    
    # Connection to main members
    connection_type: str = "welded"  # or "bolted"
    end_connection_length: float = 0.0  # mm - length of connection at ends
    
    # Slenderness requirements per BS 5950
    # Lacing slenderness λ ≤ 145 (for S275) or 135 (for S355)
    max_slenderness: float = 140.0
    
    def calculate_lacing_length(self, chord_spacing: float) -> float:
        """Calculate length of single lacing bar."""
        angle_rad = np.radians(self.inclination_angle)
        return chord_spacing / np.sin(angle_rad)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'lacing_section': self.lacing_section,
            'inclination_angle': self.inclination_angle,
            'spacing': self.spacing,
            'pattern': 'single' if self.single_lacing else 'double',
            'connection_type': self.connection_type
        }


@dataclass
class BattenParameters:
    """Batten system parameters per BS 5950-1 Section 4.7.9."""
    
    # Batten plate dimensions
    thickness: float  # mm
    depth: float  # mm - perpendicular to main member axis
    width: float  # mm - across main members
    
    # Spacing
    longitudinal_spacing: float  # mm - spacing along member axis
    
    # End battens
    end_batten_spacing: float  # mm - spacing at member ends (typically closer)
    
    # Connection
    connection_type: str = "welded"
    bolt_diameter: Optional[float] = None  # mm - if bolted
    num_bolts_per_chord: int = 2  # Minimum 2 per chord
    
    # Stiffening (if required for wide/thin battens)
    stiffener_required: bool = False
    stiffener_thickness: Optional[float] = None
    
    def calculate_batten_mass(self) -> float:
        """Calculate mass of single batten plate in kg."""
        area_mm2 = self.depth * self.width
        volume_mm3 = area_mm2 * self.thickness
        mass_kg = volume_mm3 * 7850 / 1e9
        return mass_kg
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'thickness': self.thickness,
            'depth': self.depth,
            'width': self.width,
            'longitudinal_spacing': self.longitudinal_spacing,
            'connection_type': self.connection_type,
            'mass_per_batten_kg': self.calculate_batten_mass()
        }


class BuiltUpMemberGenerator:
    """Generate built-up compression members with lacing or battens."""
    
    @staticmethod
    def generate_laced_column(
        height: float,
        chord_section: str,
        chord_spacing: float,
        num_chords: int,
        lacing_params: LacingParameters,
        base_elevation: float = 0.0
    ) -> Dict[str, Any]:
        """
        Generate laced compression member (column or strut).
        
        Args:
            height: Total height of member (mm)
            chord_section: Section designation for main chords
            chord_spacing: Clear distance between chord faces (mm)
            num_chords: 2 for single-plane lacing, 3 or 4 for box columns
            lacing_params: Lacing system parameters
        """
        
        nodes: Dict[str, Point3D] = {}
        members: List[Member] = []
        
        # Calculate number of lacing panels
        num_panels = int(height / lacing_params.spacing)
        actual_spacing = height / num_panels
        
        # Generate chord nodes
        if num_chords == 2:
            # Two chords in vertical plane
            chord_positions = [
                (-chord_spacing/2, 0),
                (chord_spacing/2, 0)
            ]
        elif num_chords == 4:
            # Four chords in box arrangement
            chord_positions = [
                (-chord_spacing/2, -chord_spacing/2),
                (chord_spacing/2, -chord_spacing/2),
                (chord_spacing/2, chord_spacing/2),
                (-chord_spacing/2, chord_spacing/2)
            ]
        else:
            raise ValueError("num_chords must be 2 or 4")
        
        # Create nodes at each panel point
        for panel in range(num_panels + 1):
            z = base_elevation + panel * actual_spacing
            
            for chord_idx, (x, y) in enumerate(chord_positions):
                node_id = f"P{panel}C{chord_idx}"
                nodes[node_id] = Point3D(x, y, z)
        
        # Generate chord members
        chord_section_props = get_section_properties(chord_section)
        for chord_idx in range(num_chords):
            for panel in range(num_panels):
                member = Member(
                    centerline=Line3D(
                        nodes[f"P{panel}C{chord_idx}"],
                        nodes[f"P{panel+1}C{chord_idx}"]
                    ),
                    section=chord_section_props,
                    member_type=MemberType.COLUMN,
                    mark=f"CHORD{chord_idx+1}_P{panel+1}"
                )
                members.append(member)
        
        # Generate lacing bars
        lacing_section_props = get_section_properties(lacing_params.lacing_section)
        
        if num_chords == 2:
            # Single plane lacing between two chords
            for panel in range(num_panels):
                if lacing_params.single_lacing:
                    # Alternating single diagonals
                    if panel % 2 == 0:
                        start_chord, end_chord = 0, 1
                    else:
                        start_chord, end_chord = 1, 0
                    
                    member = Member(
                        centerline=Line3D(
                            nodes[f"P{panel}C{start_chord}"],
                            nodes[f"P{panel+1}C{end_chord}"]
                        ),
                        section=lacing_section_props,
                        member_type=MemberType.BRACE,
                        mark=f"LAC_P{panel+1}"
                    )
                    members.append(member)
                else:
                    # Double lacing (X-pattern)
                    member1 = Member(
                        centerline=Line3D(
                            nodes[f"P{panel}C0"],
                            nodes[f"P{panel+1}C1"]
                        ),
                        section=lacing_section_props,
                        member_type=MemberType.BRACE,
                        mark=f"LAC_P{panel+1}A"
                    )
                    members.append(member1)
                    
                    member2 = Member(
                        centerline=Line3D(
                            nodes[f"P{panel}C1"],
                            nodes[f"P{panel+1}C0"]
                        ),
                        section=lacing_section_props,
                        member_type=MemberType.BRACE,
                        mark=f"LAC_P{panel+1}B"
                    )
                    members.append(member2)
        
        elif num_chords == 4:
            # Box lacing on all four faces
            for panel in range(num_panels):
                for face in range(4):
                    chord_a = face
                    chord_b = (face + 1) % 4
                    
                    if lacing_params.single_lacing:
                        if (panel + face) % 2 == 0:
                            start_chord, end_chord = chord_a, chord_b
                        else:
                            start_chord, end_chord = chord_b, chord_a
                        
                        member = Member(
                            centerline=Line3D(
                                nodes[f"P{panel}C{start_chord}"],
                                nodes[f"P{panel+1}C{end_chord}"]
                            ),
                            section=lacing_section_props,
                            member_type=MemberType.BRACE,
                            mark=f"LAC_F{face+1}_P{panel+1}"
                        )
                        members.append(member)
        
        return {
            'system_type': 'built_up_member',
            'build_up_type': 'laced',
            'parameters': {
                'height': height,
                'chord_section': chord_section,
                'chord_spacing': chord_spacing,
                'num_chords': num_chords,
                'num_panels': num_panels,
                'lacing': lacing_params.to_dict()
            },
            'nodes': {node_id: node.to_dict() for node_id, node in nodes.items()},
            'members': [member.to_dict() for member in members],
            'total_members': len(members),
            'total_mass_kg': sum(m.section.mass_per_meter * m.centerline.length() / 1000.0 
                                 for m in members)
        }
    
    @staticmethod
    def generate_battened_column(
        height: float,
        chord_section: str,
        chord_spacing: float,
        num_chords: int,
        batten_params: BattenParameters,
        base_elevation: float = 0.0
    ) -> Dict[str, Any]:
        """Generate battened compression member per BS 5950."""
        
        nodes: Dict[str, Point3D] = {}
        members: List[Member] = []
        batten_plates: List[Dict[str, Any]] = []
        
        # Calculate number of intermediate battens
        # End battens have closer spacing
        intermediate_length = height - 2 * batten_params.end_batten_spacing
        num_intermediate = int(intermediate_length / batten_params.longitudinal_spacing)
        
        # Chord positions
        if num_chords == 2:
            chord_positions = [
                (-chord_spacing/2, 0),
                (chord_spacing/2, 0)
            ]
        elif num_chords == 4:
            chord_positions = [
                (-chord_spacing/2, -chord_spacing/2),
                (chord_spacing/2, -chord_spacing/2),
                (chord_spacing/2, chord_spacing/2),
                (-chord_spacing/2, chord_spacing/2)
            ]
        else:
            raise ValueError("num_chords must be 2 or 4")
        
        # Batten elevations
        batten_elevations = [base_elevation]  # Base batten
        batten_elevations.append(base_elevation + batten_params.end_batten_spacing)  # First intermediate
        
        # Intermediate battens
        for i in range(1, num_intermediate):
            z = (base_elevation + batten_params.end_batten_spacing + 
                 i * batten_params.longitudinal_spacing)
            batten_elevations.append(z)
        
        # Top end batten
        batten_elevations.append(height - batten_params.end_batten_spacing)
        batten_elevations.append(height)  # Top batten
        
        # Generate nodes at batten locations
        for bat_idx, z in enumerate(batten_elevations):
            for chord_idx, (x, y) in enumerate(chord_positions):
                node_id = f"B{bat_idx}C{chord_idx}"
                nodes[node_id] = Point3D(x, y, z)
        
        # Generate chord members
        chord_section_props = get_section_properties(chord_section)
        num_battens = len(batten_elevations)
        
        for chord_idx in range(num_chords):
            for bat_idx in range(num_battens - 1):
                member = Member(
                    centerline=Line3D(
                        nodes[f"B{bat_idx}C{chord_idx}"],
                        nodes[f"B{bat_idx+1}C{chord_idx}"]
                    ),
                    section=chord_section_props,
                    member_type=MemberType.COLUMN,
                    mark=f"CHORD{chord_idx+1}_B{bat_idx+1}"
                )
                members.append(member)
        
        # Generate batten plates at each elevation
        for bat_idx, z in enumerate(batten_elevations):
            # Batten connects all chords at this level
            batten_corners = [nodes[f"B{bat_idx}C{i}"] for i in range(num_chords)]
            
            batten_plates.append({
                'batten_id': f"BATTEN_{bat_idx+1}",
                'elevation': z,
                'thickness': batten_params.thickness,
                'depth': batten_params.depth,
                'width': batten_params.width,
                'corner_nodes': [pt.to_dict() for pt in batten_corners],
                'mass_kg': batten_params.calculate_batten_mass()
            })
        
        return {
            'system_type': 'built_up_member',
            'build_up_type': 'battened',
            'parameters': {
                'height': height,
                'chord_section': chord_section,
                'chord_spacing': chord_spacing,
                'num_chords': num_chords,
                'num_battens': len(batten_elevations),
                'batten': batten_params.to_dict()
            },
            'nodes': {node_id: node.to_dict() for node_id, node in nodes.items()},
            'members': [member.to_dict() for member in members],
            'batten_plates': batten_plates,
            'total_members': len(members),
            'total_chord_mass_kg': sum(m.section.mass_per_meter * m.centerline.length() / 1000.0 
                                       for m in members),
            'total_batten_mass_kg': sum(b['mass_kg'] for b in batten_plates)
        }