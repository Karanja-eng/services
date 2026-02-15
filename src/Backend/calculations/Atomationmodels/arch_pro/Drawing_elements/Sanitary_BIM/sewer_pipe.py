"""
Manholes and inspection chambers for sewer systems.
Includes benching, drop manholes, and junction chambers.
"""

import json
import math
from typing import List, Dict, Optional, Tuple
from sanitary_core import (
    Point3D, Level, MaterialType, MaintenanceAccess,
    DESIGN_CODE, SanitaryEngineeringError
)
from geometry_builder import MeshBuilder, generate_cylinder_mesh, mesh_to_gltf


class ManholeType:
    """Manhole classifications"""
    INSPECTION = "inspection_chamber"
    STANDARD = "standard_manhole"
    DROP = "drop_manhole"
    JUNCTION = "junction_chamber"


class Manhole:
    """
    Concrete manhole with benching and pipe connections.
    
    Attributes:
        manhole_id: Unique identifier
        location: Center point at base
        manhole_type: Type classification
        depth: Total depth from cover to invert
        diameter: Internal diameter
    """
    
    def __init__(self,
                 manhole_id: str,
                 location: Point3D,
                 depth: float,
                 manhole_type: str = ManholeType.STANDARD,
                 diameter: float = 1.2,
                 material: MaterialType = MaterialType.REINFORCED_CONCRETE):
        
        self.manhole_id = manhole_id
        self.location = location
        self.depth = depth
        self.manhole_type = manhole_type
        self.material = material
        
        # Validate and set diameter
        self._set_diameter(diameter, depth)
        
        # Design manhole
        self._design_manhole()
        
        # Validate design
        self._validate_design()
    
    def _set_diameter(self, diameter: float, depth: float):
        """Set appropriate diameter based on depth and access requirements"""
        
        # Minimum diameters based on depth
        if depth <= 0.9:
            min_dia = 0.9  # Inspection chamber
        elif depth <= 2.7:
            min_dia = 1.2  # Standard manhole
        else:
            min_dia = 1.5  # Deep manhole
        
        # Step irons require minimum 1.2m
        if depth > 0.9:
            min_dia = max(min_dia, 1.2)
        
        self.diameter = max(diameter, min_dia)
        
        # Round to standard sizes
        standard_sizes = [0.9, 1.05, 1.2, 1.5, 1.8, 2.0]
        for size in standard_sizes:
            if self.diameter <= size:
                self.diameter = size
                break
    
    def _design_manhole(self):
        """Design manhole components"""
        
        # Wall thickness based on depth
        if self.depth <= 1.5:
            self.wall_thickness = 0.15
        elif self.depth <= 3.0:
            self.wall_thickness = 0.20
        else:
            self.wall_thickness = 0.25
        
        # Base slab
        self.base_thickness = 0.20
        
        # Cover slab
        self.cover_thickness = 0.15
        
        # Total height
        self.total_height = self.depth + self.base_thickness + self.cover_thickness
        
        # Calculate levels
        ground_level = self.location.z  # Assuming location is at grade
        cover_level = ground_level
        invert_level = cover_level - self.depth
        base_level = invert_level - self.base_thickness
        
        self.levels = Level(
            invert=invert_level,
            cover=cover_level,
            ground=ground_level
        )
        
        # Benching parameters
        # Benching slopes from walls to channel at 1:2 (50%)
        self.benching_slope_ratio = 0.5
        
        # Channel width (typically pipe diameter + 300mm)
        # Will be set when pipes are connected
        self.channel_width = 0.3  # Default
        self.channel_invert = invert_level
        
        # Access requirements
        if self.depth <= 0.9:
            # Inspection chamber - removable cover only
            access_dia = 0.6
            self.has_step_irons = False
        else:
            # Manhole - step irons or ladder
            access_dia = 0.6
            self.has_step_irons = True
            self.step_iron_spacing = 0.3  # 300mm vertical spacing
            num_steps = int(self.depth / self.step_iron_spacing) + 1
            self.num_step_irons = num_steps
        
        # Access cover
        # Load rating based on location
        if ground_level == cover_level:  # Surface level
            load_rating = "D400"  # Heavy duty (roads)
        else:
            load_rating = "B125"  # Medium duty
        
        self.access = MaintenanceAccess(
            access_type="manhole" if self.depth > 0.9 else "inspection_cover",
            location=Point3D(self.location.x, self.location.y, cover_level),
            clear_opening_diameter=access_dia,
            load_rating=load_rating
        )
        
        # Pipe connections (to be added)
        self.inlet_pipes: List[Dict] = []
        self.outlet_pipes: List[Dict] = []
        
        # Drop pipe parameters (for drop manholes)
        self.drop_height = 0.0
        self.has_drop_pipe = False
        
        # Junction parameters
        self.is_junction = False
        self.junction_angle = 0.0
    
    def add_inlet_pipe(self, pipe_id: str, invert: float, 
                      diameter: float, angle: float = 180.0):
        """
        Add inlet pipe connection.
        
        Args:
            pipe_id: Pipe identifier
            invert: Pipe invert level at manhole
            diameter: Pipe diameter in meters
            angle: Entry angle in degrees (0° = North, clockwise)
        """
        
        # Calculate position on manhole wall
        angle_rad = math.radians(angle)
        offset_x = (self.diameter / 2) * math.sin(angle_rad)
        offset_y = (self.diameter / 2) * math.cos(angle_rad)
        
        connection = {
            "pipe_id": pipe_id,
            "invert": invert,
            "diameter": diameter,
            "angle": angle,
            "position": Point3D(
                self.location.x + offset_x,
                self.location.y + offset_y,
                invert
            ).to_dict(),
            "type": "inlet"
        }
        
        self.inlet_pipes.append(connection)
        
        # Update channel width if needed
        self.channel_width = max(self.channel_width, diameter + 0.3)
    
    def add_outlet_pipe(self, pipe_id: str, invert: float,
                       diameter: float, angle: float = 0.0):
        """Add outlet pipe connection"""
        
        angle_rad = math.radians(angle)
        offset_x = (self.diameter / 2) * math.sin(angle_rad)
        offset_y = (self.diameter / 2) * math.cos(angle_rad)
        
        connection = {
            "pipe_id": pipe_id,
            "invert": invert,
            "diameter": diameter,
            "angle": angle,
            "position": Point3D(
                self.location.x + offset_x,
                self.location.y + offset_y,
                invert
            ).to_dict(),
            "type": "outlet"
        }
        
        self.outlet_pipes.append(connection)
        
        # Set channel invert to outlet invert
        self.channel_invert = invert
        self.channel_width = max(self.channel_width, diameter + 0.3)
    
    def set_as_drop_manhole(self, drop_height: float):
        """
        Configure as drop manhole.
        
        Args:
            drop_height: Vertical drop in meters
        """
        
        if drop_height < 0.5:
            raise ValueError(f"Drop height {drop_height}m too small (min 0.5m)")
        
        self.manhole_type = ManholeType.DROP
        self.drop_height = drop_height
        self.has_drop_pipe = True
        
        # Drop pipe diameter (typically 150mm for drop pipe)
        self.drop_pipe_diameter = 0.15
        
        # Drop pipe extends from inlet to channel
        # Inlet at higher level, drops to channel level
    
    def set_as_junction(self, branch_angle: float):
        """
        Configure as junction chamber.
        
        Args:
            branch_angle: Angle between main and branch pipes (degrees)
        """
        
        self.manhole_type = ManholeType.JUNCTION
        self.is_junction = True
        self.junction_angle = branch_angle
        
        # Junction chambers need larger diameter
        if self.diameter < 1.2:
            self.diameter = 1.2
    
    def _validate_design(self):
        """Validate manhole design"""
        
        # Check minimum depth
        if self.depth < 0.6:
            raise SanitaryEngineeringError(
                f"Manhole depth {self.depth}m too shallow (min 0.6m)"
            )
        
        # Check maximum depth for standard construction
        if self.depth > 6.0:
            raise SanitaryEngineeringError(
                f"Manhole depth {self.depth}m exceeds standard limit (6.0m). "
                "Consider shaft manhole design."
            )
        
        # Check diameter vs depth
        if self.depth > 2.7 and self.diameter < 1.2:
            raise SanitaryEngineeringError(
                f"Diameter {self.diameter}m insufficient for depth {self.depth}m"
            )
    
    def validate_hydraulics(self):
        """Validate hydraulic relationships"""
        
        if not self.outlet_pipes:
            return  # No outlets yet
        
        # Get outlet invert
        outlet_invert = self.outlet_pipes[0]["invert"]
        
        # Check all inlets are above outlet
        for inlet in self.inlet_pipes:
            if inlet["invert"] < outlet_invert:
                raise SanitaryEngineeringError(
                    f"Inlet pipe {inlet['pipe_id']} invert {inlet['invert']:.3f}m "
                    f"below outlet {outlet_invert:.3f}m - creates hydraulic trap"
                )
            
            # Check for excessive drops (should use drop manhole)
            drop = inlet["invert"] - outlet_invert
            if drop > 0.6 and not self.has_drop_pipe:
                print(f"WARNING: Large drop {drop:.2f}m in manhole {self.manhole_id}. "
                      f"Consider drop manhole design.")
    
    def generate_geometry(self) -> MeshBuilder:
        """Generate 3D manhole geometry"""
        
        # Main cylindrical shaft
        mesh = generate_cylinder_mesh(
            center=Point3D(
                self.location.x,
                self.location.y,
                self.levels.invert - self.base_thickness
            ),
            radius=self.diameter / 2,
            height=self.total_height,
            segments=24,
            wall_thickness=self.wall_thickness
        )
        
        # TODO: Add benching geometry (sloped floor)
        # TODO: Add step irons if applicable
        # TODO: Add drop pipe if drop manhole
        
        return mesh
    
    def to_gltf(self) -> Dict:
        """Export as GLTF"""
        mesh = self.generate_geometry()
        return mesh_to_gltf(mesh, name=f"manhole_{self.manhole_id}")
    
    def to_json(self) -> Dict:
        """Export metadata"""
        return {
            "id": self.manhole_id,
            "system": "sanitation",
            "subsystem": "manhole",
            "type": self.manhole_type,
            "location": self.location.to_dict(),
            "dimensions": {
                "diameter": self.diameter,
                "depth": self.depth,
                "total_height": self.total_height,
                "wall_thickness": self.wall_thickness,
                "base_thickness": self.base_thickness,
                "cover_thickness": self.cover_thickness
            },
            "levels": {
                "invert": self.levels.invert,
                "cover": self.levels.cover,
                "ground": self.levels.ground,
                "channel_invert": self.channel_invert
            },
            "access": {
                "type": self.access.access_type,
                "location": self.access.location.to_dict(),
                "diameter": self.access.clear_opening_diameter,
                "load_rating": self.access.load_rating,
                "has_step_irons": self.has_step_irons
            },
            "connections": {
                "inlets": self.inlet_pipes,
                "outlets": self.outlet_pipes,
                "num_inlets": len(self.inlet_pipes),
                "num_outlets": len(self.outlet_pipes)
            },
            "benching": {
                "channel_width": self.channel_width,
                "slope_ratio": self.benching_slope_ratio
            },
            "material": self.material.value
        }
        
        if self.has_drop_pipe:
            return {
                **self.to_json(),
                "drop_manhole": {
                    "drop_height": self.drop_height,
                    "drop_pipe_diameter": self.drop_pipe_diameter
                }
            }
        
        return self.to_json()


def create_standard_manhole(manhole_id: str,
                           location: Point3D,
                           depth: float) -> Manhole:
    """Create standard manhole"""
    return Manhole(
        manhole_id=manhole_id,
        location=location,
        depth=depth,
        manhole_type=ManholeType.STANDARD
    )


def create_inspection_chamber(chamber_id: str,
                              location: Point3D,
                              depth: float) -> Manhole:
    """Create shallow inspection chamber"""
    if depth > 0.9:
        raise ValueError(f"Inspection chamber depth {depth}m exceeds limit (0.9m)")
    
    return Manhole(
        manhole_id=chamber_id,
        location=location,
        depth=depth,
        manhole_type=ManholeType.INSPECTION,
        diameter=0.9
    )


def create_drop_manhole(manhole_id: str,
                       location: Point3D,
                       depth: float,
                       drop_height: float) -> Manhole:
    """Create drop manhole for changes in level"""
    
    mh = Manhole(
        manhole_id=manhole_id,
        location=location,
        depth=depth,
        manhole_type=ManholeType.DROP
    )
    
    mh.set_as_drop_manhole(drop_height)
    
    return mh


def create_junction_chamber(chamber_id: str,
                            location: Point3D,
                            depth: float,
                            junction_angle: float = 45.0) -> Manhole:
    """Create junction chamber for pipe intersections"""
    
    mh = Manhole(
        manhole_id=chamber_id,
        location=location,
        depth=depth,
        manhole_type=ManholeType.JUNCTION,
        diameter=1.2  # Minimum for junctions
    )
    
    mh.set_as_junction(junction_angle)
    
    return mh