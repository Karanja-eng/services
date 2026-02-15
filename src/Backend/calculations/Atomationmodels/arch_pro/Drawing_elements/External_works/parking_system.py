"""
Parking areas module
Surface parking with standard bay dimensions, drainage, and accessibility
"""

from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
from enum import Enum
import numpy as np
from geometry_utils import Mesh, MeshBuilder, Vector3, Transform
from road_system import SurfaceType
import json


class ParkingLayout(Enum):
    PARALLEL = "parallel"
    PERPENDICULAR = "perpendicular"
    ANGLED_45 = "angled_45"
    ANGLED_60 = "angled_60"


class BayType(Enum):
    STANDARD = "standard"
    DISABLED = "disabled"
    MOTORCYCLE = "motorcycle"
    LOADING = "loading"


@dataclass
class ParkingBayDimensions:
    """Standard parking bay dimensions"""
    length: float  # meters
    width: float  # meters
    
    @staticmethod
    def get_standard(bay_type: BayType, layout: ParkingLayout) -> 'ParkingBayDimensions':
        """Get standard bay dimensions"""
        
        if bay_type == BayType.STANDARD:
            if layout == ParkingLayout.PARALLEL:
                return ParkingBayDimensions(6.0, 2.4)
            elif layout == ParkingLayout.PERPENDICULAR:
                return ParkingBayDimensions(5.0, 2.4)
            elif layout in [ParkingLayout.ANGLED_45, ParkingLayout.ANGLED_60]:
                return ParkingBayDimensions(5.5, 2.4)
        
        elif bay_type == BayType.DISABLED:
            # Disabled bays are wider
            if layout == ParkingLayout.PERPENDICULAR:
                return ParkingBayDimensions(5.0, 3.6)
            else:
                return ParkingBayDimensions(6.0, 3.6)
        
        elif bay_type == BayType.MOTORCYCLE:
            return ParkingBayDimensions(2.5, 1.2)
        
        elif bay_type == BayType.LOADING:
            return ParkingBayDimensions(10.0, 3.5)
        
        return ParkingBayDimensions(5.0, 2.4)


@dataclass
class AisleWidth:
    """Parking aisle width standards"""
    
    @staticmethod
    def get_standard(layout: ParkingLayout, two_way: bool = False) -> float:
        """Get standard aisle width"""
        
        if layout == ParkingLayout.PARALLEL:
            return 3.5 if not two_way else 6.0
        
        elif layout == ParkingLayout.PERPENDICULAR:
            return 6.0 if not two_way else 7.0
        
        elif layout == ParkingLayout.ANGLED_45:
            return 3.5 if not two_way else 5.5
        
        elif layout == ParkingLayout.ANGLED_60:
            return 4.5 if not two_way else 6.5
        
        return 6.0


class ParkingBay:
    """Individual parking bay"""
    
    def __init__(self, bay_id: str, position: Vector3, rotation: float,
                 bay_type: BayType, layout: ParkingLayout):
        
        self.bay_id = bay_id
        self.position = position
        self.rotation = rotation  # Radians
        self.bay_type = bay_type
        self.layout = layout
        self.dimensions = ParkingBayDimensions.get_standard(bay_type, layout)
        
        # Marking attributes
        self.has_wheel_stop = True
        self.marking_width = 0.1  # meters
    
    def generate_mesh(self, surface_type: SurfaceType) -> Mesh:
        """Generate parking bay surface"""
        mesh = Mesh()
        mesh.material_name = surface_type.value
        
        # Create rectangular bay
        w, l = self.dimensions.width, self.dimensions.length
        
        # Add slight drainage slope (1%)
        slope = 0.01
        
        corners = [
            Vector3(-w/2, 0, -l/2),
            Vector3(w/2, 0, -l/2),
            Vector3(w/2, slope * l, l/2),
            Vector3(-w/2, slope * l, l/2)
        ]
        
        for i, corner in enumerate(corners):
            uv = ((i % 2), (i // 2))
            mesh.add_vertex(corner, Vector3(0, 1, 0), uv)
        
        mesh.add_quad(0, 1, 2, 3)
        
        # Apply rotation and position
        transform = Transform(
            position=self.position,
            rotation=Vector3(0, self.rotation, 0),
            scale=Vector3(1, 1, 1)
        )
        mesh.transform(transform)
        
        return mesh
    
    def generate_markings(self) -> List[Mesh]:
        """Generate parking bay line markings"""
        markings = []
        
        w, l = self.dimensions.width, self.dimensions.length
        mark_width = self.marking_width
        
        # Side lines
        for side in [-1, 1]:
            line_mesh = MeshBuilder.create_box(mark_width, 0.005, l)
            transform = Transform(
                position=Vector3(self.position.x + side * w/2, self.position.y, self.position.z),
                rotation=Vector3(0, self.rotation, 0),
                scale=Vector3(1, 1, 1)
            )
            line_mesh.transform(transform)
            line_mesh.material_name = "road_marking"
            markings.append(line_mesh)
        
        # End line (at front)
        end_line = MeshBuilder.create_box(w, 0.005, mark_width)
        transform = Transform(
            position=Vector3(self.position.x, self.position.y, self.position.z + l/2),
            rotation=Vector3(0, self.rotation, 0),
            scale=Vector3(1, 1, 1)
        )
        end_line.transform(transform)
        end_line.material_name = "road_marking"
        markings.append(end_line)
        
        # Disabled bay symbol if applicable
        if self.bay_type == BayType.DISABLED:
            symbol = self._create_disabled_symbol()
            markings.append(symbol)
        
        return markings
    
    def _create_disabled_symbol(self) -> Mesh:
        """Create wheelchair symbol marking"""
        # Simplified - create a box as placeholder
        mesh = MeshBuilder.create_box(1.0, 0.005, 1.0)
        transform = Transform(
            position=self.position,
            rotation=Vector3(0, self.rotation, 0),
            scale=Vector3(1, 1, 1)
        )
        mesh.transform(transform)
        mesh.material_name = "disabled_marking"
        return mesh
    
    def generate_wheel_stop(self) -> Optional[Mesh]:
        """Generate wheel stop / parking block"""
        if not self.has_wheel_stop:
            return None
        
        w, l = self.dimensions.width, self.dimensions.length
        stop_width = 1.8
        stop_height = 0.15
        stop_depth = 0.15
        
        mesh = MeshBuilder.create_box(stop_width, stop_height, stop_depth)
        
        # Position at front of bay
        transform = Transform(
            position=Vector3(
                self.position.x,
                self.position.y + stop_height/2,
                self.position.z + l/2 - 0.5
            ),
            rotation=Vector3(0, self.rotation, 0),
            scale=Vector3(1, 1, 1)
        )
        mesh.transform(transform)
        mesh.material_name = "concrete"
        
        return mesh
    
    def to_json(self) -> Dict:
        """Export bay metadata"""
        return {
            "bay_id": self.bay_id,
            "position": {"x": self.position.x, "y": self.position.y, "z": self.position.z},
            "rotation_deg": np.degrees(self.rotation),
            "bay_type": self.bay_type.value,
            "layout": self.layout.value,
            "dimensions": {
                "length": self.dimensions.length,
                "width": self.dimensions.width
            }
        }


class ParkingArea:
    """Complete parking area with multiple bays"""
    
    def __init__(self, area_id: str, origin: Vector3, 
                 rows: int, bays_per_row: int,
                 layout: ParkingLayout = ParkingLayout.PERPENDICULAR,
                 surface_type: SurfaceType = SurfaceType.ASPHALT,
                 two_way_aisle: bool = False):
        
        self.area_id = area_id
        self.origin = origin
        self.layout = layout
        self.surface_type = surface_type
        self.rows = rows
        self.bays_per_row = bays_per_row
        self.two_way_aisle = two_way_aisle
        
        self.bays: List[ParkingBay] = []
        self.disabled_bays: List[ParkingBay] = []
        
        # Calculate dimensions
        self.bay_dims = ParkingBayDimensions.get_standard(BayType.STANDARD, layout)
        self.aisle_width = AisleWidth.get_standard(layout, two_way_aisle)
        
        # Drainage slope (1% minimum)
        self.drainage_slope = 0.01
        
        self._generate_bays()
        self._add_disabled_bays()
    
    def _generate_bays(self):
        """Generate all parking bays"""
        bay_spacing = self.bay_dims.width
        
        for row in range(self.rows):
            # Aisle spacing
            row_offset = row * (self.bay_dims.length * 2 + self.aisle_width)
            
            for bay_num in range(self.bays_per_row):
                lateral_offset = bay_num * bay_spacing
                
                # Position on one side of aisle
                pos1 = Vector3(
                    self.origin.x + lateral_offset,
                    self.origin.y,
                    self.origin.z + row_offset
                )
                
                bay_id1 = f"{self.area_id}_R{row}_B{bay_num}A"
                bay1 = ParkingBay(bay_id1, pos1, 0.0, BayType.STANDARD, self.layout)
                self.bays.append(bay1)
                
                # Position on other side of aisle
                pos2 = Vector3(
                    self.origin.x + lateral_offset,
                    self.origin.y,
                    self.origin.z + row_offset + self.bay_dims.length + self.aisle_width
                )
                
                bay_id2 = f"{self.area_id}_R{row}_B{bay_num}B"
                bay2 = ParkingBay(bay_id2, pos2, np.pi, BayType.STANDARD, self.layout)
                self.bays.append(bay2)
    
    def _add_disabled_bays(self):
        """Add required disabled parking bays (minimum 2% of total)"""
        total_bays = len(self.bays)
        required_disabled = max(1, int(total_bays * 0.02))
        
        # Convert first few bays to disabled
        for i in range(min(required_disabled, len(self.bays))):
            bay = self.bays[i]
            disabled_bay = ParkingBay(
                f"{bay.bay_id}_DISABLED",
                bay.position,
                bay.rotation,
                BayType.DISABLED,
                self.layout
            )
            self.disabled_bays.append(disabled_bay)
            self.bays[i] = disabled_bay
    
    def generate_surface_mesh(self) -> Mesh:
        """Generate entire parking area surface"""
        mesh = Mesh()
        mesh.material_name = self.surface_type.value
        
        # Calculate total area dimensions
        total_width = self.bays_per_row * self.bay_dims.width
        total_length = self.rows * (self.bay_dims.length * 2 + self.aisle_width)
        
        # Create sloped surface for drainage
        surface = MeshBuilder.create_sloped_plane(
            total_width,
            total_length,
            slope_x=0.0,
            slope_z=self.drainage_slope,
            segments_w=self.bays_per_row,
            segments_d=self.rows * 2
        )
        
        # Position surface
        transform = Transform(
            position=Vector3(
                self.origin.x + total_width/2,
                self.origin.y,
                self.origin.z + total_length/2
            ),
            rotation=Vector3(0, 0, 0),
            scale=Vector3(1, 1, 1)
        )
        surface.transform(transform)
        
        mesh.merge(surface)
        return mesh
    
    def generate_all_markings(self) -> List[Mesh]:
        """Generate all parking bay markings"""
        markings = []
        for bay in self.bays:
            markings.extend(bay.generate_markings())
        return markings
    
    def generate_all_wheel_stops(self) -> List[Mesh]:
        """Generate all wheel stops"""
        stops = []
        for bay in self.bays:
            stop = bay.generate_wheel_stop()
            if stop:
                stops.append(stop)
        return stops
    
    def validate(self) -> Tuple[bool, List[str]]:
        """Validate parking area design"""
        errors = []
        
        # Check aisle width
        if self.aisle_width < 3.0:
            errors.append("Aisle width below minimum 3.0m")
        
        # Check disabled bay count
        total = len(self.bays)
        disabled_count = len(self.disabled_bays)
        required = max(1, int(total * 0.02))
        
        if disabled_count < required:
            errors.append(f"Insufficient disabled bays: {disabled_count}/{required}")
        
        # Check drainage
        if self.drainage_slope < 0.005:
            errors.append("Drainage slope below minimum 0.5%")
        
        return len(errors) == 0, errors
    
    def to_json(self) -> Dict:
        """Export parking area metadata"""
        return {
            "area_id": self.area_id,
            "system": "external_works",
            "subsystem": "parking",
            "layout": self.layout.value,
            "surface_type": self.surface_type.value,
            "geometry": {
                "rows": self.rows,
                "bays_per_row": self.bays_per_row,
                "total_bays": len(self.bays),
                "disabled_bays": len(self.disabled_bays),
                "aisle_width": self.aisle_width,
                "two_way_aisle": self.two_way_aisle
            },
            "drainage": {
                "slope_percent": self.drainage_slope * 100
            },
            "bays": [bay.to_json() for bay in self.bays[:10]]  # First 10 for brevity
        }


class ParkingNetwork:
    """Manager for all parking areas"""
    
    def __init__(self, site_name: str):
        self.site_name = site_name
        self.parking_areas: List[ParkingArea] = []
    
    def add_parking_area(self, area: ParkingArea):
        """Add parking area"""
        valid, errors = area.validate()
        if not valid:
            raise ValueError(f"Invalid parking area: {errors}")
        self.parking_areas.append(area)
    
    def total_capacity(self) -> int:
        """Get total parking capacity"""
        return sum(len(area.bays) for area in self.parking_areas)
    
    def total_disabled_capacity(self) -> int:
        """Get total disabled bay count"""
        return sum(len(area.disabled_bays) for area in self.parking_areas)
    
    def generate_all_meshes(self) -> List[Mesh]:
        """Generate all parking meshes"""
        meshes = []
        
        for area in self.parking_areas:
            meshes.append(area.generate_surface_mesh())
            meshes.extend(area.generate_all_markings())
            meshes.extend(area.generate_all_wheel_stops())
        
        return meshes
    
    def export_metadata(self, filename: str):
        """Export parking network metadata"""
        data = {
            "site_name": self.site_name,
            "system": "parking_network",
            "total_capacity": self.total_capacity(),
            "total_disabled": self.total_disabled_capacity(),
            "parking_areas": [area.to_json() for area in self.parking_areas]
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filename