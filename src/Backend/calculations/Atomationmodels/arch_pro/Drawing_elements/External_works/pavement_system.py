"""
Pavements and walkways module
Pedestrian infrastructure with accessibility compliance
"""

from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
from enum import Enum
import numpy as np
from geometry_utils import Mesh, MeshBuilder, Vector3, Transform
import json


class PavementType(Enum):
    FOOTPATH = "footpath"
    SIDEWALK = "sidewalk"
    PEDESTRIAN_CROSSING = "pedestrian_crossing"
    PLAZA = "plaza"
    RAMP = "ramp"
    STEPS = "steps"


class PavementSurface(Enum):
    CONCRETE = "concrete"
    CABROS = "cabros"
    STONE_SLABS = "stone_slabs"
    TILES = "tiles"
    TACTILE_PAVING = "tactile_paving"


@dataclass
class AccessibilityStandards:
    """Accessibility requirements for pedestrian infrastructure"""
    max_slope_percent: float = 8.0  # Maximum gradient for ramps
    min_width: float = 1.5  # Minimum walkway width (meters)
    max_cross_fall: float = 2.0  # Maximum cross-slope percent
    step_max_riser: float = 0.18  # Maximum step height (meters)
    step_min_tread: float = 0.28  # Minimum step depth (meters)
    landing_min_length: float = 1.5  # Minimum landing length
    
    def validate_slope(self, slope: float) -> Tuple[bool, str]:
        """Validate if slope meets accessibility requirements"""
        if slope > self.max_slope_percent:
            return False, f"Slope {slope:.1f}% exceeds maximum {self.max_slope_percent}%"
        return True, ""
    
    def validate_width(self, width: float) -> Tuple[bool, str]:
        """Validate walkway width"""
        if width < self.min_width:
            return False, f"Width {width:.2f}m below minimum {self.min_width}m"
        return True, ""


class Pavement:
    """Base pavement / walkway element"""
    
    def __init__(self, pavement_id: str, centerline: List[Vector3],
                 width: float, surface_type: PavementSurface,
                 slope_percent: float = 2.0):
        
        self.pavement_id = pavement_id
        self.centerline = centerline
        self.width = width
        self.surface_type = surface_type
        self.slope_percent = slope_percent  # Longitudinal slope
        self.cross_fall = 2.0  # Cross-slope for drainage
        
        self.accessibility = AccessibilityStandards()
        
        # Expansion joints for concrete
        self.joint_spacing = 3.0  # meters
        
        # Validate
        self._validate()
    
    def _validate(self):
        """Validate pavement design"""
        if len(self.centerline) < 2:
            raise ValueError("Pavement centerline must have at least 2 points")
        
        # Check minimum width
        valid, msg = self.accessibility.validate_width(self.width)
        if not valid:
            raise ValueError(msg)
        
        # Check drainage slope (not zero)
        if abs(self.slope_percent) < 0.5:
            raise ValueError("Pavement slope too flat - minimum 0.5% for drainage")
    
    def generate_mesh(self) -> Mesh:
        """Generate pavement surface mesh"""
        mesh = Mesh()
        mesh.material_name = self.surface_type.value
        
        segments = len(self.centerline) - 1
        
        for i, point in enumerate(self.centerline):
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
            
            # Create cross-section with cross-fall
            for side in [-1, 1]:
                distance_from_center = side * self.width / 2
                cross_fall_offset = abs(distance_from_center) * (self.cross_fall / 100.0)
                
                pos = point.to_array() + right * distance_from_center
                pos[1] -= cross_fall_offset
                
                uv = ((side + 1) / 2, i / segments)
                mesh.add_vertex(Vector3(*pos), Vector3(0, 1, 0), uv)
        
        # Create quads
        for i in range(segments):
            base_idx = i * 2
            mesh.add_quad(base_idx, base_idx+1, base_idx+3, base_idx+2)
        
        return mesh
    
    def generate_expansion_joints(self) -> List[Mesh]:
        """Generate expansion joints for concrete pavements"""
        if self.surface_type != PavementSurface.CONCRETE:
            return []
        
        joints = []
        
        # Calculate total length
        total_length = sum(
            (self.centerline[i+1] - self.centerline[i]).length()
            for i in range(len(self.centerline) - 1)
        )
        
        # Place joints at regular intervals
        num_joints = int(total_length / self.joint_spacing)
        
        for joint_num in range(1, num_joints):
            # Find position along centerline
            target_distance = joint_num * self.joint_spacing
            current_distance = 0
            
            for i in range(len(self.centerline) - 1):
                segment_length = (self.centerline[i+1] - self.centerline[i]).length()
                
                if current_distance + segment_length >= target_distance:
                    # Joint is in this segment
                    t = (target_distance - current_distance) / segment_length
                    pos = self.centerline[i].to_array() * (1-t) + self.centerline[i+1].to_array() * t
                    
                    # Create joint perpendicular to path
                    direction = (self.centerline[i+1].to_array() - self.centerline[i].to_array())
                    direction = direction / np.linalg.norm(direction)
                    
                    up = np.array([0, 1, 0])
                    right = np.cross(direction, up)
                    right = right / np.linalg.norm(right)
                    
                    joint_start = pos + right * self.width / 2
                    joint_end = pos - right * self.width / 2
                    
                    # Create thin joint mesh
                    joint_mesh = MeshBuilder.create_box(self.width, 0.005, 0.02)
                    transform = Transform(
                        position=Vector3(*pos),
                        rotation=Vector3(0, 0, 0),
                        scale=Vector3(1, 1, 1)
                    )
                    joint_mesh.transform(transform)
                    joint_mesh.material_name = "expansion_joint"
                    joints.append(joint_mesh)
                    
                    break
                
                current_distance += segment_length
        
        return joints
    
    def to_json(self) -> Dict:
        """Export pavement metadata"""
        return {
            "pavement_id": self.pavement_id,
            "system": "external_works",
            "subsystem": "pavement",
            "surface_type": self.surface_type.value,
            "geometry": {
                "width": self.width,
                "slope_percent": self.slope_percent,
                "cross_fall_percent": self.cross_fall,
                "centerline_points": len(self.centerline)
            }
        }


class AccessibleRamp(Pavement):
    """Wheelchair-accessible ramp"""
    
    def __init__(self, ramp_id: str, start: Vector3, end: Vector3,
                 width: float = 1.5, surface_type: PavementSurface = PavementSurface.CONCRETE):
        
        # Calculate slope
        horizontal_distance = np.sqrt((end.x - start.x)**2 + (end.z - start.z)**2)
        vertical_rise = end.y - start.y
        
        if horizontal_distance == 0:
            raise ValueError("Ramp has zero horizontal distance")
        
        slope_percent = (vertical_rise / horizontal_distance) * 100
        
        # Check accessibility
        accessibility = AccessibilityStandards()
        valid, msg = accessibility.validate_slope(abs(slope_percent))
        if not valid:
            raise ValueError(f"Ramp slope violation: {msg}")
        
        # Create centerline
        centerline = [start, end]
        
        super().__init__(ramp_id, centerline, width, surface_type, slope_percent)
        
        # Ramp-specific attributes
        self.rise = vertical_rise
        self.run = horizontal_distance
        self.requires_landing = abs(vertical_rise) > 0.75
        
        # Tactile warning paving at top and bottom
        self.has_tactile_paving = True
    
    def generate_mesh(self) -> Mesh:
        """Generate ramp mesh with proper slope"""
        mesh = super().generate_mesh()
        
        # Add side barriers if required
        if self.rise > 0.15:
            barriers = self._generate_side_barriers()
            for barrier in barriers:
                mesh.merge(barrier)
        
        return mesh
    
    def _generate_side_barriers(self) -> List[Mesh]:
        """Generate handrails/barriers for safety"""
        barriers = []
        
        barrier_height = 0.9
        barrier_width = 0.05
        
        start = self.centerline[0]
        end = self.centerline[1]
        
        direction = (end.to_array() - start.to_array())
        direction = direction / np.linalg.norm(direction)
        
        up = np.array([0, 1, 0])
        right = np.cross(direction, up)
        right = right / np.linalg.norm(right)
        
        # Left and right barriers
        for side in [-1, 1]:
            offset = right * side * (self.width / 2 + barrier_width)
            barrier_start = start.to_array() + offset
            barrier_end = end.to_array() + offset
            
            barrier_points = [
                Vector3(*barrier_start),
                Vector3(*barrier_end)
            ]
            
            barrier_mesh = MeshBuilder.create_path(barrier_points, barrier_width, barrier_height)
            barrier_mesh.material_name = "metal_handrail"
            barriers.append(barrier_mesh)
        
        return barriers
    
    def generate_tactile_paving(self) -> List[Mesh]:
        """Generate tactile warning paving"""
        if not self.has_tactile_paving:
            return []
        
        tactile = []
        
        # At top and bottom
        for point in [self.centerline[0], self.centerline[-1]]:
            tactile_mesh = MeshBuilder.create_box(self.width, 0.01, 0.6)
            transform = Transform(
                position=point,
                rotation=Vector3(0, 0, 0),
                scale=Vector3(1, 1, 1)
            )
            tactile_mesh.transform(transform)
            tactile_mesh.material_name = "tactile_paving"
            tactile.append(tactile_mesh)
        
        return tactile


class Steps:
    """Step / stair element"""
    
    def __init__(self, steps_id: str, start: Vector3, end: Vector3,
                 width: float = 1.5, num_steps: int = None):
        
        self.steps_id = steps_id
        self.start = start
        self.end = end
        self.width = width
        
        # Calculate rise and determine steps
        total_rise = end.y - start.y
        horizontal_distance = np.sqrt((end.x - start.x)**2 + (end.z - start.z)**2)
        
        accessibility = AccessibilityStandards()
        
        # Auto-calculate number of steps if not provided
        if num_steps is None:
            num_steps = max(1, int(abs(total_rise) / accessibility.step_max_riser))
        
        self.num_steps = num_steps
        self.riser = total_rise / num_steps
        self.tread = horizontal_distance / num_steps
        
        # Validate
        if abs(self.riser) > accessibility.step_max_riser:
            raise ValueError(f"Step riser {abs(self.riser):.3f}m exceeds maximum {accessibility.step_max_riser}m")
        
        if self.tread < accessibility.step_min_tread:
            raise ValueError(f"Step tread {self.tread:.3f}m below minimum {accessibility.step_min_tread}m")
    
    def generate_mesh(self) -> Mesh:
        """Generate step geometry"""
        mesh = Mesh()
        mesh.material_name = "concrete"
        
        # Direction vector
        direction = (self.end.to_array() - self.start.to_array())
        horizontal_direction = direction.copy()
        horizontal_direction[1] = 0
        horizontal_direction = horizontal_direction / np.linalg.norm(horizontal_direction)
        
        up = np.array([0, 1, 0])
        right = np.cross(horizontal_direction, up)
        right = right / np.linalg.norm(right)
        
        # Generate each step
        for i in range(self.num_steps):
            step_base = self.start.to_array() + horizontal_direction * i * self.tread
            step_base[1] = self.start.y + i * self.riser
            
            # Create step box
            step_mesh = MeshBuilder.create_box(self.width, abs(self.riser), self.tread)
            
            transform = Transform(
                position=Vector3(
                    step_base[0],
                    step_base[1] + abs(self.riser) / 2,
                    step_base[2]
                ),
                rotation=Vector3(0, 0, 0),
                scale=Vector3(1, 1, 1)
            )
            step_mesh.transform(transform)
            mesh.merge(step_mesh)
        
        return mesh
    
    def to_json(self) -> Dict:
        """Export steps metadata"""
        return {
            "steps_id": self.steps_id,
            "system": "external_works",
            "subsystem": "steps",
            "geometry": {
                "width": self.width,
                "num_steps": self.num_steps,
                "riser": self.riser,
                "tread": self.tread
            }
        }


class PedestrianCrossing:
    """Pedestrian crossing / zebra crossing"""
    
    def __init__(self, crossing_id: str, position: Vector3, width: float,
                 road_width: float, has_tactile: bool = True):
        
        self.crossing_id = crossing_id
        self.position = position
        self.width = width  # Crossing width (direction of pedestrian travel)
        self.road_width = road_width
        self.has_tactile = has_tactile
        
        # Standard stripe dimensions
        self.stripe_width = 0.5
        self.stripe_spacing = 0.5
    
    def generate_mesh(self) -> Mesh:
        """Generate crossing markings"""
        mesh = Mesh()
        mesh.material_name = "road_marking"
        
        # Create zebra stripes
        num_stripes = int(self.road_width / (self.stripe_width + self.stripe_spacing))
        
        for i in range(num_stripes):
            offset = i * (self.stripe_width + self.stripe_spacing) - self.road_width / 2
            
            stripe = MeshBuilder.create_box(self.stripe_width, 0.005, self.width)
            transform = Transform(
                position=Vector3(self.position.x + offset, self.position.y, self.position.z),
                rotation=Vector3(0, 0, 0),
                scale=Vector3(1, 1, 1)
            )
            stripe.transform(transform)
            mesh.merge(stripe)
        
        return mesh
    
    def generate_tactile_paving(self) -> List[Mesh]:
        """Generate tactile paving at crossing edges"""
        if not self.has_tactile:
            return []
        
        tactile = []
        
        # Both sides of crossing
        for side in [-1, 1]:
            z_offset = side * self.width / 2
            
            tactile_mesh = MeshBuilder.create_box(self.road_width, 0.01, 0.6)
            transform = Transform(
                position=Vector3(self.position.x, self.position.y, self.position.z + z_offset),
                rotation=Vector3(0, 0, 0),
                scale=Vector3(1, 1, 1)
            )
            tactile_mesh.transform(transform)
            tactile_mesh.material_name = "tactile_paving"
            tactile.append(tactile_mesh)
        
        return tactile


class PavementNetwork:
    """Manager for all pedestrian infrastructure"""
    
    def __init__(self, site_name: str):
        self.site_name = site_name
        self.pavements: List[Pavement] = []
        self.ramps: List[AccessibleRamp] = []
        self.steps: List[Steps] = []
        self.crossings: List[PedestrianCrossing] = []
    
    def add_pavement(self, pavement: Pavement):
        """Add pavement element"""
        self.pavements.append(pavement)
    
    def add_ramp(self, ramp: AccessibleRamp):
        """Add accessible ramp"""
        self.ramps.append(ramp)
    
    def add_steps(self, steps: Steps):
        """Add steps"""
        self.steps.append(steps)
    
    def add_crossing(self, crossing: PedestrianCrossing):
        """Add pedestrian crossing"""
        self.crossings.append(crossing)
    
    def generate_all_meshes(self) -> List[Mesh]:
        """Generate all pavement meshes"""
        meshes = []
        
        for pavement in self.pavements:
            meshes.append(pavement.generate_mesh())
            meshes.extend(pavement.generate_expansion_joints())
        
        for ramp in self.ramps:
            meshes.append(ramp.generate_mesh())
            meshes.extend(ramp.generate_tactile_paving())
        
        for step in self.steps:
            meshes.append(step.generate_mesh())
        
        for crossing in self.crossings:
            meshes.append(crossing.generate_mesh())
            meshes.extend(crossing.generate_tactile_paving())
        
        return meshes
    
    def export_metadata(self, filename: str):
        """Export pavement network metadata"""
        data = {
            "site_name": self.site_name,
            "system": "pavement_network",
            "pavements": [p.to_json() for p in self.pavements],
            "ramps": [r.to_json() for r in self.ramps],
            "steps": [s.to_json() for s in self.steps]
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filename