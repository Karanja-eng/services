"""
structural_steel_bim/connections/gusset_plate.py

Gusset plate design and detailing per BS 5950 and BS EN 1993-1-8.
Handles bolted and welded connections for truss and bracing members.
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
from enum import Enum
import numpy as np
import uuid

from ..core.geometry import Point3D, Vector3D, Line3D
from ..members.member import Member


class ConnectionType(Enum):
    """Connection classification per BS EN 1993-1-8."""
    BOLTED = "Bolted"
    WELDED = "Welded"
    BOLTED_AND_WELDED = "Combined Bolted and Welded"


class BoltGrade(Enum):
    """BS EN 14899 bolt grades."""
    GRADE_4_6 = "4.6"
    GRADE_8_8 = "8.8"
    GRADE_10_9 = "10.9"


class WeldType(Enum):
    """Weld classifications."""
    FILLET = "Fillet Weld"
    FULL_PENETRATION_BUTT = "Full Penetration Butt Weld"
    PARTIAL_PENETRATION_BUTT = "Partial Penetration Butt Weld"


@dataclass
class BoltPattern:
    """Bolted connection pattern per BS EN 1993-1-8."""
    bolt_diameter: float  # mm (M16, M20, M24, M30, M36)
    bolt_grade: BoltGrade
    rows: int  # Number of bolt rows
    columns: int  # Number of bolts per row
    
    # Spacing requirements per BS EN 1993-1-8 Table 3.3
    spacing_parallel: float  # mm - spacing along force direction (≥ 2.2d)
    spacing_perpendicular: float  # mm - spacing perpendicular to force (≥ 2.4d)
    edge_distance_loaded: float  # mm - edge distance on loaded edge (≥ 1.2d)
    edge_distance_unloaded: float  # mm - edge distance on unloaded edge (≥ 1.2d)
    
    # Hole details
    hole_diameter: float = 0.0  # mm - typically diameter + 2mm for clearance
    hole_type: str = "standard"  # standard, oversize, slotted
    
    def __post_init__(self):
        if self.hole_diameter == 0.0:
            # Standard clearance hole per BS EN 1090-2 Table 11
            if self.bolt_diameter <= 24:
                self.hole_diameter = self.bolt_diameter + 2.0
            else:
                self.hole_diameter = self.bolt_diameter + 3.0
    
    def get_bolt_positions(self, reference_point: Point3D, 
                          direction_parallel: Vector3D,
                          direction_perpendicular: Vector3D) -> List[Point3D]:
        """
        Calculate bolt positions in 3D space.
        reference_point: Bottom-left bolt position
        direction_parallel: Direction along force (unit vector)
        direction_perpendicular: Direction perpendicular to force (unit vector)
        """
        positions = []
        
        for row in range(self.rows):
            for col in range(self.columns):
                # Calculate offset from reference
                offset_parallel = col * self.spacing_parallel
                offset_perpendicular = row * self.spacing_perpendicular
                
                # Vector to bolt position
                ref_array = reference_point.to_array()
                parallel_array = direction_parallel.to_array()
                perpendicular_array = direction_perpendicular.to_array()
                
                bolt_pos = (ref_array + 
                           offset_parallel * parallel_array + 
                           offset_perpendicular * perpendicular_array)
                
                positions.append(Point3D(bolt_pos[0], bolt_pos[1], bolt_pos[2]))
        
        return positions
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'bolt_diameter': self.bolt_diameter,
            'bolt_grade': self.bolt_grade.value,
            'rows': self.rows,
            'columns': self.columns,
            'spacing_parallel': self.spacing_parallel,
            'spacing_perpendicular': self.spacing_perpendicular,
            'total_bolts': self.rows * self.columns,
            'hole_diameter': self.hole_diameter
        }


@dataclass
class WeldSpecification:
    """Weld specification per BS EN 1993-1-8."""
    weld_type: WeldType
    leg_length: float  # mm - for fillet welds
    throat_thickness: float  # mm - effective throat
    weld_length: float  # mm - length of weld run
    
    # Weld around member (True) or intermittent (False)
    continuous: bool = True
    
    # For intermittent welds
    weld_run_length: Optional[float] = None  # mm
    spacing: Optional[float] = None  # mm - center-to-center spacing
    
    # Weld classification per BS EN ISO 5817
    quality_level: str = "B"  # A (highest), B (intermediate), C (moderate), D (basic)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'weld_type': self.weld_type.value,
            'leg_length': self.leg_length,
            'throat_thickness': self.throat_thickness,
            'weld_length': self.weld_length,
            'continuous': self.continuous,
            'quality_level': self.quality_level
        }


@dataclass
class GussetPlate:
    """
    Gusset plate for truss/bracing connections.
    Design per BS 5950-1 Section 6.3 and BS EN 1993-1-8.
    """
    
    # Identification
    mark: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    # Geometry
    thickness: float  # mm
    plate_grade: str = "S355"  # S275, S355, S460
    
    # Connection members
    connected_members: List[Member] = field(default_factory=list)
    
    # Connection details
    connection_type: ConnectionType = ConnectionType.BOLTED
    bolt_pattern: Optional[BoltPattern] = None
    weld_spec: Optional[WeldSpecification] = None
    
    # Plate outline (defined by corner points in 3D)
    outline_points: List[Point3D] = field(default_factory=list)
    
    # Free edge stiffening (if required)
    stiffener_required: bool = False
    stiffener_thickness: Optional[float] = None  # mm
    
    # Whitmore effective width calculation (for axial capacity check)
    whitmore_width: Optional[float] = None  # mm
    
    def calculate_whitmore_width(self, bolt_gauge: float) -> float:
        """
        Calculate Whitmore effective width per AISC/CISC practice.
        Whitmore width = bolt_gauge + 2 * edge_distance_parallel * tan(30°)
        This is a simplified approach - actual width depends on bolt layout.
        """
        if self.bolt_pattern:
            # Dispersion at 30° from first bolt row
            dispersion_length = self.bolt_pattern.spacing_parallel * (self.bolt_pattern.rows - 1)
            dispersion_width = 2 * dispersion_length * np.tan(np.radians(30))
            
            self.whitmore_width = bolt_gauge + dispersion_width
            return self.whitmore_width
        return 0.0
    
    def calculate_plate_mass(self) -> float:
        """Calculate plate mass in kg. Requires outline_points to be defined."""
        if len(self.outline_points) < 3:
            return 0.0
        
        # Calculate area using shoelace formula (2D projection)
        area = 0.0
        n = len(self.outline_points)
        for i in range(n):
            j = (i + 1) % n
            area += self.outline_points[i].x * self.outline_points[j].y
            area -= self.outline_points[j].x * self.outline_points[i].y
        area = abs(area) / 2.0
        
        # Volume = area * thickness, mass = volume * density (7850 kg/m³)
        volume_mm3 = area * self.thickness
        mass_kg = volume_mm3 * 7850 / 1e9  # Convert mm³ to m³
        
        return mass_kg
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'mark': self.mark,
            'type': 'gusset_plate',
            'thickness': self.thickness,
            'plate_grade': self.plate_grade,
            'connection_type': self.connection_type.value,
            'num_connected_members': len(self.connected_members),
            'bolt_pattern': self.bolt_pattern.to_dict() if self.bolt_pattern else None,
            'weld_spec': self.weld_spec.to_dict() if self.weld_spec else None,
            'outline_points': [pt.to_dict() for pt in self.outline_points],
            'mass_kg': self.calculate_plate_mass(),
            'whitmore_width': self.whitmore_width
        }


class GussetPlateGenerator:
    """Generate gusset plates for truss and bracing connections."""
    
    @staticmethod
    def generate_triangular_gusset(
        apex_point: Point3D,
        member_1: Member,
        member_2: Member,
        thickness: float,
        bolt_diameter: float = 20.0,
        connection_type: ConnectionType = ConnectionType.BOLTED
    ) -> GussetPlate:
        """
        Generate triangular gusset plate for two-member connection.
        Commonly used in truss joints.
        """
        
        # Calculate member directions
        dir_1 = member_1.centerline.direction_vector()
        dir_2 = member_2.centerline.direction_vector()
        
        # Extension beyond apex for connection length
        # Minimum 2 bolt diameters + edge distance
        extension_length = 150.0  # mm - typical extension
        
        # Calculate gusset outline points
        # Point at apex
        # Points along each member
        point_1 = Point3D(
            apex_point.x + extension_length * dir_1.x,
            apex_point.y + extension_length * dir_1.y,
            apex_point.z + extension_length * dir_1.z
        )
        
        point_2 = Point3D(
            apex_point.x + extension_length * dir_2.x,
            apex_point.y + extension_length * dir_2.y,
            apex_point.z + extension_length * dir_2.z
        )
        
        # Create bolt pattern if bolted connection
        bolt_pattern = None
        if connection_type == ConnectionType.BOLTED:
            # Standard 2 bolt rows for typical truss connection
            bolt_pattern = BoltPattern(
                bolt_diameter=bolt_diameter,
                bolt_grade=BoltGrade.GRADE_8_8,
                rows=2,
                columns=1,
                spacing_parallel=2.5 * bolt_diameter,
                spacing_perpendicular=3.0 * bolt_diameter,
                edge_distance_loaded=1.5 * bolt_diameter,
                edge_distance_unloaded=1.5 * bolt_diameter
            )
        
        # Create weld spec if welded
        weld_spec = None
        if connection_type == ConnectionType.WELDED:
            # Typical fillet weld - leg length based on member thickness
            leg_length = min(8.0, thickness * 0.7)  # mm
            throat = leg_length / np.sqrt(2)
            
            weld_spec = WeldSpecification(
                weld_type=WeldType.FILLET,
                leg_length=leg_length,
                throat_thickness=throat,
                weld_length=extension_length * 2,  # Both sides
                continuous=True
            )
        
        gusset = GussetPlate(
            mark="GP_TRI",
            thickness=thickness,
            connected_members=[member_1, member_2],
            connection_type=connection_type,
            bolt_pattern=bolt_pattern,
            weld_spec=weld_spec,
            outline_points=[apex_point, point_1, point_2]
        )
        
        return gusset
    
    @staticmethod
    def generate_rectangular_gusset(
        connection_point: Point3D,
        width: float,
        height: float,
        thickness: float,
        num_bolt_rows: int = 2,
        num_bolt_columns: int = 2,
        bolt_diameter: float = 20.0
    ) -> GussetPlate:
        """
        Generate rectangular gusset plate.
        Commonly used for simple shear connections and splice plates.
        """
        
        # Define corners (centered on connection point, in XY plane)
        half_width = width / 2
        half_height = height / 2
        
        corners = [
            Point3D(connection_point.x - half_width, connection_point.y - half_height, connection_point.z),
            Point3D(connection_point.x + half_width, connection_point.y - half_height, connection_point.z),
            Point3D(connection_point.x + half_width, connection_point.y + half_height, connection_point.z),
            Point3D(connection_point.x - half_width, connection_point.y + half_height, connection_point.z),
        ]
        
        # Standard bolt pattern
        bolt_pattern = BoltPattern(
            bolt_diameter=bolt_diameter,
            bolt_grade=BoltGrade.GRADE_8_8,
            rows=num_bolt_rows,
            columns=num_bolt_columns,
            spacing_parallel=3.0 * bolt_diameter,
            spacing_perpendicular=3.0 * bolt_diameter,
            edge_distance_loaded=2.0 * bolt_diameter,
            edge_distance_unloaded=1.5 * bolt_diameter
        )
        
        gusset = GussetPlate(
            mark="GP_RECT",
            thickness=thickness,
            connection_type=ConnectionType.BOLTED,
            bolt_pattern=bolt_pattern,
            outline_points=corners
        )
        
        return gusset