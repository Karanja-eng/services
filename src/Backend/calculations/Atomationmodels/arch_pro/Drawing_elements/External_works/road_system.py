"""
Roads and vehicular infrastructure module
Includes access roads, driveways, service roads with proper layering and drainage
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional
from enum import Enum
import numpy as np
from geometry_utils import Mesh, MeshBuilder, Vector3, Transform
from drainage_system import FlowDirection
import json


class RoadType(Enum):
    ACCESS_ROAD = "access_road"
    FEEDER_ROAD = "feeder_road"
    DRIVEWAY = "driveway"
    SERVICE_ROAD = "service_road"


class SurfaceType(Enum):
    ASPHALT = "asphalt"
    CONCRETE = "concrete"
    CABROS = "cabros"  # Interlocking blocks
    GRAVEL = "gravel"


@dataclass
class RoadLayer:
    """Road construction layer"""
    name: str
    thickness: float  # meters
    material: str
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "thickness": self.thickness,
            "material": self.material
        }


class RoadStructure:
    """Standard road pavement structure"""
    
    @staticmethod
    def get_standard_structure(surface_type: SurfaceType, traffic_load: str = "light") -> List[RoadLayer]:
        """Get standard road construction layers"""
        
        if surface_type == SurfaceType.ASPHALT:
            if traffic_load == "heavy":
                return [
                    RoadLayer("wearing_course", 0.05, "asphalt_concrete"),
                    RoadLayer("binder_course", 0.05, "asphalt_concrete"),
                    RoadLayer("base", 0.15, "crushed_stone"),
                    RoadLayer("sub_base", 0.20, "gravel"),
                ]
            else:  # light
                return [
                    RoadLayer("wearing_course", 0.04, "asphalt_concrete"),
                    RoadLayer("base", 0.10, "crushed_stone"),
                    RoadLayer("sub_base", 0.15, "gravel"),
                ]
        
        elif surface_type == SurfaceType.CONCRETE:
            return [
                RoadLayer("concrete_slab", 0.15, "concrete_c25"),
                RoadLayer("base", 0.10, "crushed_stone"),
                RoadLayer("sub_base", 0.15, "gravel"),
            ]
        
        elif surface_type == SurfaceType.CABROS:
            return [
                RoadLayer("pavers", 0.06, "concrete_blocks"),
                RoadLayer("bedding_sand", 0.05, "sand"),
                RoadLayer("base", 0.10, "crushed_stone"),
                RoadLayer("sub_base", 0.15, "gravel"),
            ]
        
        elif surface_type == SurfaceType.GRAVEL:
            return [
                RoadLayer("gravel_surface", 0.10, "compacted_gravel"),
                RoadLayer("sub_base", 0.15, "gravel"),
            ]
        
        return []


@dataclass
class RoadGeometry:
    """Road geometric parameters"""
    width: float  # meters
    camber_percent: float = 2.5  # Cross-fall for drainage
    longitudinal_slope: float = 0.0  # Percent grade
    
    def validate(self) -> Tuple[bool, List[str]]:
        """Validate road geometry"""
        errors = []
        
        if self.width < 3.0:
            errors.append("Road width below minimum 3.0m")
        
        if self.camber_percent < 1.5 or self.camber_percent > 4.0:
            errors.append(f"Camber {self.camber_percent}% outside acceptable range (1.5-4.0%)")
        
        if abs(self.longitudinal_slope) > 15.0:
            errors.append(f"Longitudinal slope {self.longitudinal_slope}% exceeds maximum 15%")
        
        return len(errors) == 0, errors


class Road:
    """Complete road element with geometry and construction"""
    
    def __init__(self, road_id: str, centerline: List[Vector3], 
                 width: float, surface_type: SurfaceType,
                 camber: float = 2.5, traffic_load: str = "light"):
        
        self.road_id = road_id
        self.centerline = centerline
        self.surface_type = surface_type
        self.geometry = RoadGeometry(width, camber)
        self.layers = RoadStructure.get_standard_structure(surface_type, traffic_load)
        self.road_type = RoadType.ACCESS_ROAD
        
        # Calculate total thickness
        self.total_thickness = sum(layer.thickness for layer in self.layers)
        
        # Validate
        valid, errors = self.geometry.validate()
        if not valid:
            raise ValueError(f"Invalid road geometry: {errors}")
        
        if len(centerline) < 2:
            raise ValueError("Road centerline must have at least 2 points")
    
    def calculate_camber_profile(self, distance_from_center: float) -> float:
        """Calculate camber elevation offset from centerline"""
        # Camber is highest at center, drops to edges
        camber_drop = abs(distance_from_center) * (self.geometry.camber_percent / 100.0)
        return -camber_drop
    
    def generate_mesh(self) -> Mesh:
        """Generate road surface mesh with camber"""
        mesh = Mesh()
        mesh.material_name = self.surface_type.value
        
        # Generate road surface
        segments_length = len(self.centerline) - 1
        segments_width = 6  # Cross-sectional segments for camber
        
        for i in range(len(self.centerline)):
            point = self.centerline[i]
            
            # Calculate direction
            if i == 0:
                direction = (self.centerline[1].to_array() - self.centerline[0].to_array())
            elif i == len(self.centerline) - 1:
                direction = (self.centerline[-1].to_array() - self.centerline[-2].to_array())
            else:
                direction = (self.centerline[i+1].to_array() - self.centerline[i-1].to_array())
            
            direction = direction / np.linalg.norm(direction) if np.linalg.norm(direction) > 0 else np.array([0, 0, 1])
            
            # Perpendicular for width
            up = np.array([0, 1, 0])
            right = np.cross(direction, up)
            right = right / np.linalg.norm(right) if np.linalg.norm(right) > 0 else np.array([1, 0, 0])
            
            # Create cross-section with camber
            for j in range(segments_width + 1):
                t = j / segments_width
                distance_from_center = (t - 0.5) * self.geometry.width
                
                # Apply camber
                camber_offset = self.calculate_camber_profile(distance_from_center)
                
                pos = point.to_array() + right * distance_from_center
                pos[1] += camber_offset
                
                # Normal points up for road surface
                normal = Vector3(0, 1, 0)
                uv = (t, i / segments_length)
                
                mesh.add_vertex(Vector3(*pos), normal, uv)
        
        # Create quads
        for i in range(segments_length):
            for j in range(segments_width):
                i0 = i * (segments_width + 1) + j
                i1 = i0 + 1
                i2 = i0 + segments_width + 1
                i3 = i2 + 1
                mesh.add_quad(i0, i1, i3, i2)
        
        return mesh
    
    def generate_edge_restraints(self) -> List[Mesh]:
        """Generate edge kerbs/restraints"""
        kerbs = []
        
        kerb_height = 0.15
        kerb_width = 0.15
        
        # Left and right edges
        for side in [-1, 1]:
            edge_points = []
            
            for i, point in enumerate(self.centerline):
                # Calculate direction
                if i == 0:
                    direction = (self.centerline[1].to_array() - self.centerline[0].to_array())
                elif i == len(self.centerline) - 1:
                    direction = (self.centerline[-1].to_array() - self.centerline[-2].to_array())
                else:
                    direction = (self.centerline[i+1].to_array() - self.centerline[i-1].to_array())
                
                direction = direction / np.linalg.norm(direction) if np.linalg.norm(direction) > 0 else np.array([0, 0, 1])
                
                up = np.array([0, 1, 0])
                right = np.cross(direction, up)
                right = right / np.linalg.norm(right) if np.linalg.norm(right) > 0 else np.array([1, 0, 0])
                
                offset = point.to_array() + right * side * (self.geometry.width / 2 + kerb_width / 2)
                edge_points.append(Vector3(*offset))
            
            # Create kerb mesh
            kerb_mesh = MeshBuilder.create_path(edge_points, kerb_width, kerb_height)
            kerb_mesh.material_name = "concrete_kerb"
            kerbs.append(kerb_mesh)
        
        return kerbs
    
    def to_json(self) -> Dict:
        """Export road metadata"""
        return {
            "road_id": self.road_id,
            "system": "external_works",
            "subsystem": "road",
            "road_type": self.road_type.value,
            "surface_type": self.surface_type.value,
            "geometry": {
                "width": self.geometry.width,
                "camber_percent": self.geometry.camber_percent,
                "longitudinal_slope": self.geometry.longitudinal_slope,
                "centerline_points": len(self.centerline)
            },
            "construction": {
                "total_thickness": self.total_thickness,
                "layers": [layer.to_dict() for layer in self.layers]
            }
        }


class Driveway(Road):
    """Residential or commercial driveway"""
    
    def __init__(self, driveway_id: str, centerline: List[Vector3],
                 width: float = 3.5, surface_type: SurfaceType = SurfaceType.CONCRETE):
        
        super().__init__(driveway_id, centerline, width, surface_type, camber=2.0, traffic_load="light")
        self.road_type = RoadType.DRIVEWAY
        
        # Driveways typically narrower
        if width < 2.5:
            raise ValueError("Driveway width below minimum 2.5m")


class VehicleTurningCircle:
    """Turning circle / cul-de-sac"""
    
    def __init__(self, circle_id: str, center: Vector3, radius: float,
                 surface_type: SurfaceType = SurfaceType.ASPHALT):
        
        self.circle_id = circle_id
        self.center = center
        self.radius = radius
        self.surface_type = surface_type
        
        # Minimum turning radius check
        if radius < 6.0:
            raise ValueError("Turning circle radius below minimum 6.0m for vehicles")
    
    def generate_mesh(self) -> Mesh:
        """Generate circular turning area"""
        mesh = Mesh()
        mesh.material_name = self.surface_type.value
        
        segments_radial = 16
        segments_circular = 32
        
        # Create concentric circles
        for i in range(segments_radial + 1):
            r = (i / segments_radial) * self.radius
            
            for j in range(segments_circular):
                angle = 2 * np.pi * j / segments_circular
                x = self.center.x + r * np.cos(angle)
                z = self.center.z + r * np.sin(angle)
                
                # Slight camber (highest at center)
                camber_drop = (i / segments_radial) * 0.02  # 2cm drop over radius
                y = self.center.y - camber_drop
                
                uv = (r / self.radius, angle / (2 * np.pi))
                mesh.add_vertex(Vector3(x, y, z), Vector3(0, 1, 0), uv)
        
        # Create quads
        for i in range(segments_radial):
            for j in range(segments_circular):
                next_j = (j + 1) % segments_circular
                
                i0 = i * segments_circular + j
                i1 = i * segments_circular + next_j
                i2 = (i + 1) * segments_circular + j
                i3 = (i + 1) * segments_circular + next_j
                
                mesh.add_quad(i0, i1, i3, i2)
        
        return mesh
    
    def to_json(self) -> Dict:
        return {
            "circle_id": self.circle_id,
            "system": "external_works",
            "subsystem": "turning_circle",
            "center": {"x": self.center.x, "y": self.center.y, "z": self.center.z},
            "radius": self.radius,
            "surface_type": self.surface_type.value
        }


class ExpansionJoint:
    """Concrete expansion joint for thermal movement"""
    
    def __init__(self, start: Vector3, end: Vector3, width: float = 0.02):
        self.start = start
        self.end = end
        self.width = width  # Typically 20mm
        self.spacing_recommended = 6.0  # meters
    
    def generate_mesh(self) -> Mesh:
        """Generate expansion joint marker"""
        mesh = Mesh()
        mesh.material_name = "expansion_joint"
        
        # Create thin strip
        direction = (self.end.to_array() - self.start.to_array())
        length = np.linalg.norm(direction)
        direction = direction / length
        
        up = np.array([0, 1, 0])
        right = np.cross(direction, up)
        right = right / np.linalg.norm(right)
        
        # Four corners
        corners = [
            self.start.to_array() + right * self.width / 2,
            self.start.to_array() - right * self.width / 2,
            self.end.to_array() + right * self.width / 2,
            self.end.to_array() - right * self.width / 2,
        ]
        
        for i, corner in enumerate(corners):
            mesh.add_vertex(Vector3(*corner), Vector3(0, 1, 0))
        
        mesh.add_quad(0, 2, 3, 1)
        
        return mesh


class RoadNetwork:
    """Complete road network manager"""
    
    def __init__(self, site_name: str):
        self.site_name = site_name
        self.roads: List[Road] = []
        self.driveways: List[Driveway] = []
        self.turning_circles: List[VehicleTurningCircle] = []
    
    def add_road(self, road: Road):
        """Add road to network"""
        self.roads.append(road)
    
    def add_driveway(self, driveway: Driveway):
        """Add driveway to network"""
        self.driveways.append(driveway)
    
    def add_turning_circle(self, circle: VehicleTurningCircle):
        """Add turning circle"""
        self.turning_circles.append(circle)
    
    def validate_network(self) -> Tuple[bool, List[str]]:
        """Validate road network connectivity"""
        errors = []
        
        # Check all roads
        for road in self.roads:
            valid, road_errors = road.geometry.validate()
            if not valid:
                errors.extend([f"{road.road_id}: {e}" for e in road_errors])
        
        # Check driveway connections
        for driveway in self.driveways:
            if not self._connects_to_road(driveway):
                errors.append(f"{driveway.road_id}: Driveway not connected to road network")
        
        return len(errors) == 0, errors
    
    def _connects_to_road(self, driveway: Driveway) -> bool:
        """Check if driveway connects to a road (simplified)"""
        # In real implementation, check proximity of endpoints
        return True
    
    def generate_all_meshes(self) -> List[Mesh]:
        """Generate all road meshes"""
        meshes = []
        
        for road in self.roads:
            meshes.append(road.generate_mesh())
            meshes.extend(road.generate_edge_restraints())
        
        for driveway in self.driveways:
            meshes.append(driveway.generate_mesh())
        
        for circle in self.turning_circles:
            meshes.append(circle.generate_mesh())
        
        return meshes
    
    def export_metadata(self, filename: str):
        """Export road network metadata"""
        data = {
            "site_name": self.site_name,
            "system": "road_network",
            "roads": [road.to_json() for road in self.roads],
            "driveways": [dway.to_json() for dway in self.driveways],
            "turning_circles": [tc.to_json() for tc in self.turning_circles]
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filename