"""
structural_steel_bim/members/member.py

Structural member definition with section, orientation, and end conditions.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum
import uuid

from ..core.geometry import Point3D, Line3D, Vector3D, CoordinateSystem
from ..sections.section_properties import SectionProperties


class MemberType(Enum):
    """Classification of structural members."""
    CHORD = "Truss Chord"
    WEB = "Truss Web Member"
    DIAGONAL = "Truss Diagonal"
    VERTICAL = "Truss Vertical"
    COLUMN = "Column"
    BEAM = "Beam"
    RAFTER = "Rafter"
    PURLIN = "Purlin"
    BRACE = "Bracing"
    STRUT = "Strut"
    TIE = "Tie"
    GIRT = "Girt"
    LATTICE_LEG = "Lattice Tower Leg"
    LATTICE_BRACING = "Lattice Tower Bracing"
    CRANE_GIRDER = "Crane Girder"
    STRINGER = "Stringer"


class EndCondition(Enum):
    """Member end connection conditions per BS 5950."""
    PINNED = "pinned"
    FIXED = "fixed"
    SEMI_RIGID = "semi_rigid"


@dataclass
class Member:
    """Structural steel member with full engineering definition."""
    
    # Geometry
    centerline: Line3D
    section: SectionProperties
    member_type: MemberType
    
    # Identification
    mark: str  # Drawing mark (e.g., "C1", "B3", "D12")
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    # Orientation
    rotation_angle: float = 0.0  # Rotation about member axis (degrees)
    
    # End conditions
    start_condition: EndCondition = EndCondition.PINNED
    end_condition: EndCondition = EndCondition.PINNED
    
    # Effective lengths for buckling (mm)
    effective_length_yy: Optional[float] = None  # Major axis
    effective_length_zz: Optional[float] = None  # Minor axis
    effective_length_lt: Optional[float] = None  # Lateral-torsional
    
    # Material (default S355)
    grade: str = "S355"
    
    # Fabrication notes
    notes: Optional[str] = None
    
    def __post_init__(self):
        """Calculate default effective lengths if not specified."""
        actual_length = self.centerline.length()
        
        if self.effective_length_yy is None:
            if self.start_condition == EndCondition.FIXED and self.end_condition == EndCondition.FIXED:
                self.effective_length_yy = 0.5 * actual_length
            elif self.start_condition == EndCondition.PINNED and self.end_condition == EndCondition.PINNED:
                self.effective_length_yy = 1.0 * actual_length
            else:
                self.effective_length_yy = 0.85 * actual_length  # Semi-rigid default
        
        if self.effective_length_zz is None:
            self.effective_length_zz = self.effective_length_yy
        
        if self.effective_length_lt is None:
            self.effective_length_lt = actual_length
    
    def get_local_coordinate_system(self) -> CoordinateSystem:
        """
        Establish local coordinate system per BS EN 1993-1-1.
        x-axis: along member centerline
        y-axis: major principal axis
        z-axis: minor principal axis
        """
        # x-axis along member
        x_axis = self.centerline.direction_vector()
        
        # Default y-axis (major axis) pointing up/vertical unless rotated
        global_up = Vector3D(0, 0, 1)
        
        # If member is vertical, use different reference
        if abs(x_axis.dot(global_up)) > 0.99:
            global_up = Vector3D(0, 1, 0)
        
        # Initial y-axis perpendicular to member
        z_temp = x_axis.cross(global_up).normalize()
        y_initial = z_temp.cross(x_axis).normalize()
        
        # Apply rotation angle about x-axis
        angle_rad = np.radians(self.rotation_angle)
        cos_a = np.cos(angle_rad)
        sin_a = np.sin(angle_rad)
        
        y_arr = y_initial.to_array()
        z_arr = z_temp.to_array()
        
        y_rotated = cos_a * y_arr + sin_a * z_arr
        z_rotated = -sin_a * y_arr + cos_a * z_arr
        
        y_axis = Vector3D(y_rotated[0], y_rotated[1], y_rotated[2])
        z_axis = Vector3D(z_rotated[0], z_rotated[1], z_rotated[2])
        
        return CoordinateSystem(self.centerline.start, x_axis, y_axis)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize member for JSON output."""
        return {
            'id': self.id,
            'mark': self.mark,
            'type': self.member_type.value,
            'section': self.section.to_dict(),
            'centerline': self.centerline.to_dict(),
            'rotation_angle': self.rotation_angle,
            'start_condition': self.start_condition.value,
            'end_condition': self.end_condition.value,
            'effective_length_yy': self.effective_length_yy,
            'effective_length_zz': self.effective_length_zz,
            'effective_length_lt': self.effective_length_lt,
            'grade': self.grade,
            'length': self.centerline.length(),
            'mass': self.section.mass_per_meter * self.centerline.length() / 1000.0,  # kg
            'notes': self.notes
        }