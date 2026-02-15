"""
Drainage system module for civil engineering BIM
Implements gravity-driven drainage with proper slopes and hydraulics
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional
from enum import Enum
import numpy as np
from geometry_utils import Mesh, MeshBuilder, Vector3, Transform
import json


class DrainageType(Enum):
    OPEN_CHANNEL = "open_channel"
    COVERED_DRAIN = "covered_drain"
    SIDE_DRAIN = "side_drain"
    CATCH_PIT = "catch_pit"
    INSPECTION_CHAMBER = "inspection_chamber"
    GRATING = "grating"
    CULVERT = "culvert"
    SOAK_PIT = "soak_pit"
    STORMWATER_PIPE = "stormwater_pipe"


class CoverType(Enum):
    NONE = "none"
    GRATING = "grating"
    SOLID_COVER = "solid_cover"
    MANHOLE_COVER = "manhole_cover"


class FlowDirection(Enum):
    NORTH = "north"
    SOUTH = "south"
    EAST = "east"
    WEST = "west"
    NORTHEAST = "northeast"
    NORTHWEST = "northwest"
    SOUTHEAST = "southeast"
    SOUTHWEST = "southwest"


@dataclass
class InvertLevel:
    """Drainage invert levels"""
    inlet: float  # Elevation at inlet (m)
    outlet: float  # Elevation at outlet (m)
    
    def slope(self, length: float) -> float:
        """Calculate slope percentage"""
        if length == 0:
            raise ValueError("Cannot calculate slope with zero length")
        return abs((self.outlet - self.inlet) / length) * 100
    
    def validate_gravity_flow(self, min_slope: float = 0.5) -> bool:
        """Ensure gravity drainage (outlet lower than inlet)"""
        if self.outlet >= self.inlet:
            return False
        slope = abs((self.outlet - self.inlet) / 1.0) * 100
        return slope >= min_slope


@dataclass
class HydraulicProperties:
    """Hydraulic characteristics of drainage element"""
    width: float  # meters
    depth: float  # meters
    roughness: float = 0.013  # Manning's n (concrete default)
    
    def flow_area(self) -> float:
        """Calculate cross-sectional area"""
        return self.width * self.depth
    
    def wetted_perimeter(self) -> float:
        """Calculate wetted perimeter for open channel"""
        return self.width + 2 * self.depth
    
    def hydraulic_radius(self) -> float:
        """Calculate hydraulic radius"""
        return self.flow_area() / self.wetted_perimeter()


@dataclass
class DrainageElement:
    """Base class for all drainage elements"""
    element_id: str
    drainage_type: DrainageType
    position: Vector3
    invert_levels: InvertLevel
    flow_direction: FlowDirection
    hydraulic: HydraulicProperties
    cover_type: CoverType = CoverType.NONE
    material: str = "concrete"
    contributing_area: float = 0.0  # m² for sizing
    
    def validate(self) -> Tuple[bool, List[str]]:
        """Validate drainage element engineering rules"""
        errors = []
        
        # Check gravity flow
        if not self.invert_levels.validate_gravity_flow():
            errors.append(f"{self.element_id}: Invalid gravity flow - outlet must be lower than inlet")
        
        # Check minimum depth
        if self.hydraulic.depth < 0.15:
            errors.append(f"{self.element_id}: Drainage depth too shallow (min 0.15m)")
        
        # Check minimum width
        if self.hydraulic.width < 0.15:
            errors.append(f"{self.element_id}: Drainage width too narrow (min 0.15m)")
        
        return len(errors) == 0, errors
    
    def to_json(self) -> Dict:
        """Export to JSON metadata"""
        return {
            "element_id": self.element_id,
            "system": "external_works",
            "subsystem": "drainage",
            "drainage_type": self.drainage_type.value,
            "position": {"x": self.position.x, "y": self.position.y, "z": self.position.z},
            "invert_levels": {
                "inlet": self.invert_levels.inlet,
                "outlet": self.invert_levels.outlet,
                "slope_percent": self.invert_levels.slope(1.0) if self.position else 0
            },
            "flow_direction": self.flow_direction.value,
            "hydraulic": {
                "width": self.hydraulic.width,
                "depth": self.hydraulic.depth,
                "area": self.hydraulic.flow_area(),
                "roughness": self.hydraulic.roughness
            },
            "cover_type": self.cover_type.value,
            "material": self.material,
            "contributing_area": self.contributing_area
        }


class OpenChannel(DrainageElement):
    """Open drainage channel"""
    
    def __init__(self, element_id: str, start: Vector3, end: Vector3,
                 width: float, depth: float, start_invert: float, end_invert: float):
        
        length = (end - start).length()
        invert = InvertLevel(start_invert, end_invert)
        
        # Determine flow direction
        dx = end.x - start.x
        dz = end.z - start.z
        flow_dir = self._calculate_flow_direction(dx, dz)
        
        hydraulic = HydraulicProperties(width, depth)
        
        super().__init__(
            element_id=element_id,
            drainage_type=DrainageType.OPEN_CHANNEL,
            position=start,
            invert_levels=invert,
            flow_direction=flow_dir,
            hydraulic=hydraulic,
            cover_type=CoverType.NONE
        )
        
        self.start = start
        self.end = end
        self.length = length
        
        # Validate minimum slope
        slope = invert.slope(length)
        if slope < 0.5:
            raise ValueError(f"Open channel slope {slope:.2f}% is below minimum 0.5%")
    
    def _calculate_flow_direction(self, dx: float, dz: float) -> FlowDirection:
        """Determine cardinal flow direction"""
        angle = np.arctan2(dz, dx)
        angle_deg = np.degrees(angle)
        
        if -22.5 <= angle_deg < 22.5:
            return FlowDirection.EAST
        elif 22.5 <= angle_deg < 67.5:
            return FlowDirection.NORTHEAST
        elif 67.5 <= angle_deg < 112.5:
            return FlowDirection.NORTH
        elif 112.5 <= angle_deg < 157.5:
            return FlowDirection.NORTHWEST
        elif angle_deg >= 157.5 or angle_deg < -157.5:
            return FlowDirection.WEST
        elif -157.5 <= angle_deg < -112.5:
            return FlowDirection.SOUTHWEST
        elif -112.5 <= angle_deg < -67.5:
            return FlowDirection.SOUTH
        else:
            return FlowDirection.SOUTHEAST
    
    def generate_mesh(self) -> Mesh:
        """Generate 3D mesh for open channel"""
        mesh = Mesh()
        mesh.material_name = self.material
        
        # Direction vector
        direction = (self.end.to_array() - self.start.to_array())
        length = np.linalg.norm(direction)
        direction = direction / length
        
        # Perpendicular for width
        up = np.array([0, 1, 0])
        right = np.cross(direction, up)
        right = right / np.linalg.norm(right)
        
        # Create rectangular channel profile
        segments = max(int(length / 0.5), 2)
        
        for i in range(segments + 1):
            t = i / segments
            pos = self.start.to_array() + direction * length * t
            
            # Interpolate invert level
            invert_y = self.invert_levels.inlet + (self.invert_levels.outlet - self.invert_levels.inlet) * t
            
            # Channel bottom vertices
            left_bottom = pos + right * self.hydraulic.width / 2
            right_bottom = pos - right * self.hydraulic.width / 2
            left_bottom[1] = invert_y
            right_bottom[1] = invert_y
            
            # Channel top vertices
            left_top = left_bottom.copy()
            right_top = right_bottom.copy()
            left_top[1] += self.hydraulic.depth
            right_top[1] += self.hydraulic.depth
            
            # Add vertices
            base_idx = len(mesh.vertices)
            mesh.add_vertex(Vector3(*left_bottom), Vector3(0, -1, 0))
            mesh.add_vertex(Vector3(*right_bottom), Vector3(0, -1, 0))
            mesh.add_vertex(Vector3(*left_top), Vector3(-right[0], 0, -right[2]))
            mesh.add_vertex(Vector3(*right_top), Vector3(right[0], 0, right[2]))
            
            # Connect to previous segment
            if i > 0:
                prev_base = base_idx - 4
                
                # Bottom
                mesh.add_quad(prev_base, prev_base+1, base_idx+1, base_idx)
                
                # Left wall
                mesh.add_quad(prev_base, base_idx, base_idx+2, prev_base+2)
                
                # Right wall
                mesh.add_quad(prev_base+1, prev_base+3, base_idx+3, base_idx+1)
        
        return mesh


class CatchPit(DrainageElement):
    """Catch pit / gully trap for collecting surface water"""
    
    def __init__(self, element_id: str, position: Vector3, invert_level: float,
                 size: float = 0.6, depth: float = 0.9, has_grating: bool = True):
        
        hydraulic = HydraulicProperties(size, depth)
        invert = InvertLevel(position.y, invert_level)
        
        super().__init__(
            element_id=element_id,
            drainage_type=DrainageType.CATCH_PIT,
            position=position,
            invert_levels=invert,
            flow_direction=FlowDirection.SOUTH,  # Default, connects to pipe
            hydraulic=hydraulic,
            cover_type=CoverType.GRATING if has_grating else CoverType.SOLID_COVER
        )
        
        self.size = size
        self.depth_total = depth
        self.has_grating = has_grating
    
    def generate_mesh(self) -> Mesh:
        """Generate catch pit mesh"""
        mesh = Mesh()
        mesh.material_name = self.material
        
        # Main pit box
        pit_mesh = MeshBuilder.create_box(self.size, self.depth_total, self.size)
        pit_transform = Transform(
            position=Vector3(self.position.x, self.position.y - self.depth_total/2, self.position.z),
            rotation=Vector3(0, 0, 0),
            scale=Vector3(1, 1, 1)
        )
        pit_mesh.transform(pit_transform)
        mesh.merge(pit_mesh)
        
        # Grating if present
        if self.has_grating:
            grating_mesh = self._create_grating()
            mesh.merge(grating_mesh)
        
        return mesh
    
    def _create_grating(self) -> Mesh:
        """Create grating cover"""
        mesh = Mesh()
        
        # Frame
        frame_thickness = 0.05
        frame = MeshBuilder.create_box(self.size, frame_thickness, self.size)
        frame_transform = Transform(
            position=Vector3(self.position.x, self.position.y + frame_thickness/2, self.position.z),
            rotation=Vector3(0, 0, 0),
            scale=Vector3(1, 1, 1)
        )
        frame.transform(frame_transform)
        mesh.merge(frame)
        
        # Bars
        bar_count = 8
        bar_width = 0.02
        for i in range(bar_count):
            offset = (i - bar_count/2 + 0.5) * (self.size / bar_count)
            bar = MeshBuilder.create_box(bar_width, frame_thickness, self.size * 0.9)
            bar_transform = Transform(
                position=Vector3(self.position.x + offset, self.position.y + frame_thickness/2, self.position.z),
                rotation=Vector3(0, 0, 0),
                scale=Vector3(1, 1, 1)
            )
            bar.transform(bar_transform)
            mesh.merge(bar)
        
        return mesh


class InspectionChamber(DrainageElement):
    """Manhole / inspection chamber for pipe access"""
    
    def __init__(self, element_id: str, position: Vector3, invert_level: float,
                 diameter: float = 1.2, depth: float = 2.0):
        
        hydraulic = HydraulicProperties(diameter, depth)
        invert = InvertLevel(position.y, invert_level)
        
        super().__init__(
            element_id=element_id,
            drainage_type=DrainageType.INSPECTION_CHAMBER,
            position=position,
            invert_levels=invert,
            flow_direction=FlowDirection.SOUTH,
            hydraulic=hydraulic,
            cover_type=CoverType.MANHOLE_COVER
        )
        
        self.diameter = diameter
        self.depth_total = depth
    
    def generate_mesh(self) -> Mesh:
        """Generate inspection chamber mesh"""
        mesh = Mesh()
        mesh.material_name = self.material
        
        # Cylindrical chamber
        chamber = MeshBuilder.create_cylinder(self.diameter/2, self.depth_total, 16)
        chamber_transform = Transform(
            position=Vector3(self.position.x, self.position.y - self.depth_total, self.position.z),
            rotation=Vector3(0, 0, 0),
            scale=Vector3(1, 1, 1)
        )
        chamber.transform(chamber_transform)
        mesh.merge(chamber)
        
        # Manhole cover
        cover = MeshBuilder.create_cylinder(self.diameter/2 + 0.1, 0.1, 16)
        cover_transform = Transform(
            position=Vector3(self.position.x, self.position.y, self.position.z),
            rotation=Vector3(0, 0, 0),
            scale=Vector3(1, 1, 1)
        )
        cover.transform(cover_transform)
        mesh.merge(cover)
        
        return mesh


class StormwaterPipe(DrainageElement):
    """Underground stormwater pipe"""
    
    def __init__(self, element_id: str, start: Vector3, end: Vector3,
                 diameter: float, start_invert: float, end_invert: float):
        
        length = (end - start).length()
        invert = InvertLevel(start_invert, end_invert)
        
        dx = end.x - start.x
        dz = end.z - start.z
        flow_dir = FlowDirection.SOUTH  # Simplified
        
        hydraulic = HydraulicProperties(diameter, diameter)
        
        super().__init__(
            element_id=element_id,
            drainage_type=DrainageType.STORMWATER_PIPE,
            position=start,
            invert_levels=invert,
            flow_direction=flow_dir,
            hydraulic=hydraulic,
            cover_type=CoverType.NONE
        )
        
        self.start = start
        self.end = end
        self.length = length
        self.diameter = diameter
        
        # Validate minimum slope for pipes
        slope = invert.slope(length)
        if slope < 0.5:
            raise ValueError(f"Pipe slope {slope:.2f}% is below minimum 0.5%")
    
    def generate_mesh(self) -> Mesh:
        """Generate pipe mesh"""
        mesh = Mesh()
        mesh.material_name = self.material
        
        # Direction vector
        direction = (self.end.to_array() - self.start.to_array())
        length = np.linalg.norm(direction)
        direction = direction / length
        
        segments = max(int(length / 1.0), 2)
        
        for i in range(segments + 1):
            t = i / segments
            pos = self.start.to_array() + direction * length * t
            
            # Interpolate invert level
            invert_y = self.invert_levels.inlet + (self.invert_levels.outlet - self.invert_levels.inlet) * t
            pos[1] = invert_y + self.diameter / 2
            
            # Create circular cross-section
            ring_segments = 12
            base_idx = len(mesh.vertices)
            
            for j in range(ring_segments):
                angle = 2 * np.pi * j / ring_segments
                
                # Local coordinate system
                up = np.array([0, 1, 0])
                right = np.cross(direction, up)
                if np.linalg.norm(right) > 0:
                    right = right / np.linalg.norm(right)
                else:
                    right = np.array([1, 0, 0])
                
                actual_up = np.cross(right, direction)
                
                offset = (np.cos(angle) * right + np.sin(angle) * actual_up) * self.diameter / 2
                vertex_pos = pos + offset
                normal = offset / np.linalg.norm(offset)
                
                mesh.add_vertex(Vector3(*vertex_pos), Vector3(*normal))
            
            # Connect to previous ring
            if i > 0:
                for j in range(ring_segments):
                    next_j = (j + 1) % ring_segments
                    i0 = base_idx - ring_segments + j
                    i1 = base_idx - ring_segments + next_j
                    i2 = base_idx + j
                    i3 = base_idx + next_j
                    mesh.add_quad(i0, i1, i3, i2)
        
        return mesh


class DrainageNetwork:
    """Complete drainage network manager"""
    
    def __init__(self, site_name: str):
        self.site_name = site_name
        self.elements: List[DrainageElement] = []
        self.outfall_level: float = 0.0
    
    def add_element(self, element: DrainageElement):
        """Add drainage element to network"""
        valid, errors = element.validate()
        if not valid:
            raise ValueError(f"Invalid drainage element: {errors}")
        self.elements.append(element)
    
    def validate_network(self) -> Tuple[bool, List[str]]:
        """Validate entire drainage network"""
        errors = []
        
        # Check all elements
        for element in self.elements:
            valid, elem_errors = element.validate()
            if not valid:
                errors.extend(elem_errors)
        
        # Check for outfall
        if not self._has_outfall():
            errors.append("Network has no outfall connection")
        
        # Check for isolated low points
        if self._has_isolated_low_points():
            errors.append("Network contains isolated low points (water traps)")
        
        return len(errors) == 0, errors
    
    def _has_outfall(self) -> bool:
        """Check if network connects to an outfall"""
        return any(e.drainage_type == DrainageType.STORMWATER_PIPE for e in self.elements)
    
    def _has_isolated_low_points(self) -> bool:
        """Check for water traps (simplified check)"""
        # In a real implementation, this would use graph analysis
        return False
    
    def generate_all_meshes(self) -> List[Mesh]:
        """Generate meshes for all drainage elements"""
        meshes = []
        for element in self.elements:
            if hasattr(element, 'generate_mesh'):
                meshes.append(element.generate_mesh())
        return meshes
    
    def export_metadata(self, filename: str):
        """Export drainage network metadata"""
        data = {
            "site_name": self.site_name,
            "system": "drainage_network",
            "outfall_level": self.outfall_level,
            "elements": [elem.to_json() for elem in self.elements]
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filename