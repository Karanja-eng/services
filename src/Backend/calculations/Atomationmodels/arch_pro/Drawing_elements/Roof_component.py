import math
import json
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import numpy as np


class RoofCoveringType(Enum):
    ASPHALT_SHINGLES = "asphalt_shingles"
    CLAY_TILES = "clay_tiles"
    METAL_STANDING_SEAM = "metal_standing_seam"
    CONCRETE_TILES = "concrete_tiles"
    SLATE = "slate"
    WOOD_SHAKES = "wood_shakes"
    MEMBRANE = "membrane"
    GREEN_ROOF = "green_roof"


class RafterType(Enum):
    COMMON = "common"
    HIP = "hip"
    VALLEY = "valley"
    JACK = "jack"
    RIDGE = "ridge"


@dataclass
class Point3D:
    x: float
    y: float
    z: float

    def to_list(self) -> List[float]:
        return [self.x, self.y, self.z]

    def distance_to(self, other: 'Point3D') -> float:
        return math.sqrt(
            (self.x - other.x) ** 2 +
            (self.y - other.y) ** 2 +
            (self.z - other.z) ** 2
        )


@dataclass
class Vector3D:
    x: float
    y: float
    z: float

    def normalize(self) -> 'Vector3D':
        length = math.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)
        if length == 0:
            return Vector3D(0, 0, 0)
        return Vector3D(self.x / length, self.y / length, self.z / length)

    def cross(self, other: 'Vector3D') -> 'Vector3D':
        return Vector3D(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x
        )

    def dot(self, other: 'Vector3D') -> float:
        return self.x * other.x + self.y * other.y + self.z * other.z


@dataclass
class RoofPlane:
    vertices: List[Point3D]
    normal: Vector3D
    slope_degrees: float
    area: float


@dataclass
class RafterElement:
    start: Point3D
    end: Point3D
    rafter_type: RafterType
    width: float
    depth: float
    length: float

    def to_dict(self) -> Dict:
        return {
            "start": self.start.to_list(),
            "end": self.end.to_list(),
            "type": self.rafter_type.value,
            "width": self.width,
            "depth": self.depth,
            "length": self.length
        }


@dataclass
class PurlinElement:
    start: Point3D
    end: Point3D
    width: float
    depth: float

    def to_dict(self) -> Dict:
        return {
            "start": self.start.to_list(),
            "end": self.end.to_list(),
            "width": self.width,
            "depth": self.depth
        }


@dataclass
class RoofCovering:
    covering_type: RoofCoveringType
    thickness: float
    color: str
    texture_scale: float

    def to_dict(self) -> Dict:
        return {
            "type": self.covering_type.value,
            "thickness": self.thickness,
            "color": self.color,
            "texture_scale": self.texture_scale
        }


@dataclass
class Chimney:
    position: Point3D
    width: float
    depth: float
    height: float

    def to_dict(self) -> Dict:
        return {
            "position": self.position.to_list(),
            "width": self.width,
            "depth": self.depth,
            "height": self.height
        }


@dataclass
class Skylight:
    position: Point3D
    width: float
    depth: float
    angle: float

    def to_dict(self) -> Dict:
        return {
            "position": self.position.to_list(),
            "width": self.width,
            "depth": self.depth,
            "angle": self.angle
        }


class BaseRoof:
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        base_elevation: float = 0.0,
        rafter_width: float = 0.05,
        rafter_depth: float = 0.20,
        rafter_spacing: float = 0.6,
        purlin_width: float = 0.05,
        purlin_depth: float = 0.10,
        purlin_spacing: float = 1.2,
        sheathing_thickness: float = 0.02,
        covering_type: RoofCoveringType = RoofCoveringType.ASPHALT_SHINGLES
    ):
        self.footprint = footprint
        self.base_elevation = base_elevation
        self.rafter_width = rafter_width
        self.rafter_depth = rafter_depth
        self.rafter_spacing = rafter_spacing
        self.purlin_width = purlin_width
        self.purlin_depth = purlin_depth
        self.purlin_spacing = purlin_spacing
        self.sheathing_thickness = sheathing_thickness
        self.covering_type = covering_type
        
        self.rafters: List[RafterElement] = []
        self.purlins: List[PurlinElement] = []
        self.roof_planes: List[RoofPlane] = []
        self.chimneys: List[Chimney] = []
        self.skylights: List[Skylight] = []

    def calculate_slope_rise(self, run: float, slope_degrees: float) -> float:
        return run * math.tan(math.radians(slope_degrees))

    def get_footprint_bounds(self) -> Tuple[float, float, float, float]:
        xs = [p[0] for p in self.footprint]
        ys = [p[1] for p in self.footprint]
        return min(xs), max(xs), min(ys), max(ys)

    def add_chimney(self, x: float, y: float, width: float = 0.8, depth: float = 0.8, height: float = 2.0):
        z = self.get_elevation_at_point(x, y)
        self.chimneys.append(Chimney(Point3D(x, y, z), width, depth, height))

    def add_skylight(self, x: float, y: float, width: float = 1.0, depth: float = 1.0):
        z = self.get_elevation_at_point(x, y)
        self.skylights.append(Skylight(Point3D(x, y, z), width, depth, 0))

    def get_elevation_at_point(self, x: float, y: float) -> float:
        return self.base_elevation

    def generate_gltf_geometry(self) -> Dict:
        vertices = []
        indices = []
        normals = []
        uvs = []
        
        for plane in self.roof_planes:
            start_idx = len(vertices) // 3
            for vertex in plane.vertices:
                vertices.extend([vertex.x, vertex.y, vertex.z])
                normals.extend([plane.normal.x, plane.normal.y, plane.normal.z])
                uvs.extend([vertex.x, vertex.y])
            
            n = len(plane.vertices)
            for i in range(1, n - 1):
                indices.extend([start_idx, start_idx + i, start_idx + i + 1])
        
        return {
            "vertices": vertices,
            "indices": indices,
            "normals": normals,
            "uvs": uvs
        }

    def generate(self) -> Dict:
        raise NotImplementedError("Subclasses must implement generate()")


class GableRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        ridge_height: float = 3.0,
        slope_degrees: float = 30.0,
        overhang: float = 0.5,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.ridge_height = ridge_height
        self.slope_degrees = slope_degrees
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        # Extend footprint with overhang
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        # Ridge runs along the center parallel to longest dimension
        width = max_x - min_x
        length = max_y - min_y
        
        ridge_start = Point3D(min_x, (min_y + max_y) / 2, self.base_elevation + self.ridge_height)
        ridge_end = Point3D(max_x, (min_y + max_y) / 2, self.base_elevation + self.ridge_height)
        
        # Ridge board
        self.rafters.append(RafterElement(
            ridge_start, ridge_end,
            RafterType.RIDGE,
            self.rafter_width * 1.5,
            self.rafter_depth * 1.5,
            ridge_start.distance_to(ridge_end)
        ))
        
        # Generate common rafters
        num_rafters = int(width / self.rafter_spacing) + 1
        for i in range(num_rafters):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos > max_x:
                x_pos = max_x
            
            # South slope
            bottom_south = Point3D(x_pos, min_y, self.base_elevation)
            top = Point3D(x_pos, (min_y + max_y) / 2, self.base_elevation + self.ridge_height)
            self.rafters.append(RafterElement(
                bottom_south, top,
                RafterType.COMMON,
                self.rafter_width,
                self.rafter_depth,
                bottom_south.distance_to(top)
            ))
            
            # North slope
            bottom_north = Point3D(x_pos, max_y, self.base_elevation)
            self.rafters.append(RafterElement(
                bottom_north, top,
                RafterType.COMMON,
                self.rafter_width,
                self.rafter_depth,
                bottom_north.distance_to(top)
            ))
        
        # Generate purlins
        num_purlins = int(width / self.purlin_spacing) + 1
        for i in range(1, num_purlins):
            x_pos = min_x + i * self.purlin_spacing
            if x_pos > max_x:
                break
            
            # South slope purlin
            y_mid = (min_y + max_y) / 2
            ratio = i / num_purlins
            y_south = min_y + ratio * (y_mid - min_y)
            z_south = self.base_elevation + ratio * self.ridge_height
            
            purlin_start = Point3D(min_x, y_south, z_south)
            purlin_end = Point3D(max_x, y_south, z_south)
            self.purlins.append(PurlinElement(purlin_start, purlin_end, self.purlin_width, self.purlin_depth))
            
            # North slope purlin
            y_north = max_y - ratio * (max_y - y_mid)
            z_north = self.base_elevation + ratio * self.ridge_height
            
            purlin_start_n = Point3D(min_x, y_north, z_north)
            purlin_end_n = Point3D(max_x, y_north, z_north)
            self.purlins.append(PurlinElement(purlin_start_n, purlin_end_n, self.purlin_width, self.purlin_depth))
        
        # Create roof planes
        # South plane
        south_vertices = [
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(max_x, min_y, self.base_elevation),
            Point3D(max_x, (min_y + max_y) / 2, self.base_elevation + self.ridge_height),
            Point3D(min_x, (min_y + max_y) / 2, self.base_elevation + self.ridge_height)
        ]
        south_normal = Vector3D(0, -math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(south_vertices, south_normal, self.slope_degrees, width * length / 2))
        
        # North plane
        north_vertices = [
            Point3D(min_x, max_y, self.base_elevation),
            Point3D(min_x, (min_y + max_y) / 2, self.base_elevation + self.ridge_height),
            Point3D(max_x, (min_y + max_y) / 2, self.base_elevation + self.ridge_height),
            Point3D(max_x, max_y, self.base_elevation)
        ]
        north_normal = Vector3D(0, math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(north_vertices, north_normal, self.slope_degrees, width * length / 2))
        
        # Gable end triangles
        east_gable = [
            Point3D(max_x, min_y, self.base_elevation),
            Point3D(max_x, max_y, self.base_elevation),
            Point3D(max_x, (min_y + max_y) / 2, self.base_elevation + self.ridge_height)
        ]
        self.roof_planes.append(RoofPlane(east_gable, Vector3D(1, 0, 0), 90, length * self.ridge_height / 2))
        
        west_gable = [
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(min_x, (min_y + max_y) / 2, self.base_elevation + self.ridge_height),
            Point3D(min_x, max_y, self.base_elevation)
        ]
        self.roof_planes.append(RoofPlane(west_gable, Vector3D(-1, 0, 0), 90, length * self.ridge_height / 2))
        
        return self.to_json()

    def get_elevation_at_point(self, x: float, y: float) -> float:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        y_mid = (min_y + max_y) / 2
        
        if y <= y_mid:
            ratio = (y - min_y) / (y_mid - min_y) if y_mid != min_y else 0
        else:
            ratio = (max_y - y) / (max_y - y_mid) if max_y != y_mid else 0
        
        return self.base_elevation + ratio * self.ridge_height

    def to_json(self) -> Dict:
        return {
            "type": "gable",
            "parameters": {
                "ridge_height": self.ridge_height,
                "slope_degrees": self.slope_degrees,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.01 if self.covering_type == RoofCoveringType.ASPHALT_SHINGLES else 0.02,
                "#8B4513" if self.covering_type == RoofCoveringType.CLAY_TILES else "#333333",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class HipRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        ridge_height: float = 3.0,
        slope_degrees: float = 30.0,
        overhang: float = 0.5,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.ridge_height = ridge_height
        self.slope_degrees = slope_degrees
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        width = max_x - min_x
        length = max_y - min_y
        
        # Ridge is shorter than building, hips fill the ends
        ridge_offset = min(width, length) / 2 * math.tan(math.radians(90 - self.slope_degrees))
        
        ridge_start = Point3D(min_x + ridge_offset, (min_y + max_y) / 2, self.base_elevation + self.ridge_height)
        ridge_end = Point3D(max_x - ridge_offset, (min_y + max_y) / 2, self.base_elevation + self.ridge_height)
        
        # Ridge board
        if ridge_start.x < ridge_end.x:
            self.rafters.append(RafterElement(
                ridge_start, ridge_end,
                RafterType.RIDGE,
                self.rafter_width * 1.5,
                self.rafter_depth * 1.5,
                ridge_start.distance_to(ridge_end)
            ))
        
        # Hip rafters
        corners = [
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(max_x, min_y, self.base_elevation),
            Point3D(max_x, max_y, self.base_elevation),
            Point3D(min_x, max_y, self.base_elevation)
        ]
        
        ridge_points = [ridge_start, ridge_end, ridge_end, ridge_start]
        
        for i, corner in enumerate(corners):
            hip_top = ridge_points[i]
            self.rafters.append(RafterElement(
                corner, hip_top,
                RafterType.HIP,
                self.rafter_width * 1.2,
                self.rafter_depth * 1.2,
                corner.distance_to(hip_top)
            ))
        
        # Common rafters on main roof planes
        num_rafters = int(width / self.rafter_spacing) + 1
        for i in range(num_rafters):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos < min_x + ridge_offset or x_pos > max_x - ridge_offset:
                continue
            
            # South slope
            bottom_south = Point3D(x_pos, min_y, self.base_elevation)
            top = Point3D(x_pos, (min_y + max_y) / 2, self.base_elevation + self.ridge_height)
            self.rafters.append(RafterElement(
                bottom_south, top,
                RafterType.COMMON,
                self.rafter_width,
                self.rafter_depth,
                bottom_south.distance_to(top)
            ))
            
            # North slope
            bottom_north = Point3D(x_pos, max_y, self.base_elevation)
            self.rafters.append(RafterElement(
                bottom_north, top,
                RafterType.COMMON,
                self.rafter_width,
                self.rafter_depth,
                bottom_north.distance_to(top)
            ))
        
        # Jack rafters on hip ends
        num_jacks = int(ridge_offset / self.rafter_spacing)
        for i in range(1, num_jacks + 1):
            # West hip
            x_west = min_x + i * self.rafter_spacing
            if x_west < ridge_start.x:
                ratio = (x_west - min_x) / ridge_offset
                z_height = self.base_elevation + ratio * self.ridge_height
                
                jack_south = Point3D(x_west, min_y, self.base_elevation)
                jack_ridge = Point3D(x_west, (min_y + max_y) / 2 - ratio * length / 2, z_height)
                self.rafters.append(RafterElement(jack_south, jack_ridge, RafterType.JACK, self.rafter_width, self.rafter_depth, jack_south.distance_to(jack_ridge)))
                
                jack_north = Point3D(x_west, max_y, self.base_elevation)
                jack_ridge_n = Point3D(x_west, (min_y + max_y) / 2 + ratio * length / 2, z_height)
                self.rafters.append(RafterElement(jack_north, jack_ridge_n, RafterType.JACK, self.rafter_width, self.rafter_depth, jack_north.distance_to(jack_ridge_n)))
            
            # East hip
            x_east = max_x - i * self.rafter_spacing
            if x_east > ridge_end.x:
                ratio = (max_x - x_east) / ridge_offset
                z_height = self.base_elevation + ratio * self.ridge_height
                
                jack_south = Point3D(x_east, min_y, self.base_elevation)
                jack_ridge = Point3D(x_east, (min_y + max_y) / 2 - ratio * length / 2, z_height)
                self.rafters.append(RafterElement(jack_south, jack_ridge, RafterType.JACK, self.rafter_width, self.rafter_depth, jack_south.distance_to(jack_ridge)))
                
                jack_north = Point3D(x_east, max_y, self.base_elevation)
                jack_ridge_n = Point3D(x_east, (min_y + max_y) / 2 + ratio * length / 2, z_height)
                self.rafters.append(RafterElement(jack_north, jack_ridge_n, RafterType.JACK, self.rafter_width, self.rafter_depth, jack_north.distance_to(jack_ridge_n)))
        
        # Purlins
        num_purlins = int(width / self.purlin_spacing) + 1
        for i in range(1, num_purlins):
            ratio = i / num_purlins
            y_south = min_y + ratio * ((min_y + max_y) / 2 - min_y)
            z_south = self.base_elevation + ratio * self.ridge_height
            
            purlin_start = Point3D(min_x + ridge_offset, y_south, z_south)
            purlin_end = Point3D(max_x - ridge_offset, y_south, z_south)
            self.purlins.append(PurlinElement(purlin_start, purlin_end, self.purlin_width, self.purlin_depth))
            
            y_north = max_y - ratio * (max_y - (min_y + max_y) / 2)
            z_north = self.base_elevation + ratio * self.ridge_height
            
            purlin_start_n = Point3D(min_x + ridge_offset, y_north, z_north)
            purlin_end_n = Point3D(max_x - ridge_offset, y_north, z_north)
            self.purlins.append(PurlinElement(purlin_start_n, purlin_end_n, self.purlin_width, self.purlin_depth))
        
        # Create roof planes
        y_mid = (min_y + max_y) / 2
        
        # South plane
        south_vertices = [
            Point3D(min_x + ridge_offset, min_y, self.base_elevation),
            Point3D(max_x - ridge_offset, min_y, self.base_elevation),
            ridge_end,
            ridge_start
        ]
        south_normal = Vector3D(0, -math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(south_vertices, south_normal, self.slope_degrees, 0))
        
        # North plane
        north_vertices = [
            Point3D(min_x + ridge_offset, max_y, self.base_elevation),
            ridge_start,
            ridge_end,
            Point3D(max_x - ridge_offset, max_y, self.base_elevation)
        ]
        north_normal = Vector3D(0, math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(north_vertices, north_normal, self.slope_degrees, 0))
        
        # West hip
        west_vertices = [
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(min_x + ridge_offset, min_y, self.base_elevation),
            ridge_start,
            Point3D(min_x + ridge_offset, max_y, self.base_elevation),
            Point3D(min_x, max_y, self.base_elevation)
        ]
        west_normal = Vector3D(-math.sin(math.radians(self.slope_degrees)), 0, math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(west_vertices, west_normal, self.slope_degrees, 0))
        
        # East hip
        east_vertices = [
            Point3D(max_x, min_y, self.base_elevation),
            Point3D(max_x, max_y, self.base_elevation),
            Point3D(max_x - ridge_offset, max_y, self.base_elevation),
            ridge_end,
            Point3D(max_x - ridge_offset, min_y, self.base_elevation)
        ]
        east_normal = Vector3D(math.sin(math.radians(self.slope_degrees)), 0, math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(east_vertices, east_normal, self.slope_degrees, 0))
        
        return self.to_json()

    def get_elevation_at_point(self, x: float, y: float) -> float:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        ridge_offset = min(max_x - min_x, max_y - min_y) / 2 * math.tan(math.radians(90 - self.slope_degrees))
        y_mid = (min_y + max_y) / 2
        
        if min_x + ridge_offset <= x <= max_x - ridge_offset:
            if y <= y_mid:
                ratio = (y - min_y) / (y_mid - min_y) if y_mid != min_y else 0
            else:
                ratio = (max_y - y) / (max_y - y_mid) if max_y != y_mid else 0
            return self.base_elevation + ratio * self.ridge_height
        else:
            if x < min_x + ridge_offset:
                x_ratio = (x - min_x) / ridge_offset if ridge_offset > 0 else 0
            else:
                x_ratio = (max_x - x) / ridge_offset if ridge_offset > 0 else 0
            
            if y <= y_mid:
                y_ratio = (y - min_y) / (y_mid - min_y) if y_mid != min_y else 0
            else:
                y_ratio = (max_y - y) / (max_y - y_mid) if max_y != y_mid else 0
            
            ratio = min(x_ratio, y_ratio)
            return self.base_elevation + ratio * self.ridge_height

    def to_json(self) -> Dict:
        return {
            "type": "hip",
            "parameters": {
                "ridge_height": self.ridge_height,
                "slope_degrees": self.slope_degrees,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.015 if self.covering_type == RoofCoveringType.CONCRETE_TILES else 0.01,
                "#B8860B" if self.covering_type == RoofCoveringType.CONCRETE_TILES else "#2F4F4F",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class MansardRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        lower_slope_degrees: float = 70.0,
        upper_slope_degrees: float = 30.0,
        lower_height: float = 2.0,
        upper_height: float = 1.5,
        overhang: float = 0.3,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.lower_slope_degrees = lower_slope_degrees
        self.upper_slope_degrees = upper_slope_degrees
        self.lower_height = lower_height
        self.upper_height = upper_height
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        outer_min_x = min_x - self.overhang
        outer_max_x = max_x + self.overhang
        outer_min_y = min_y - self.overhang
        outer_max_y = max_y + self.overhang
        
        # Calculate transition point
        lower_run = self.lower_height / math.tan(math.radians(self.lower_slope_degrees))
        
        inner_min_x = outer_min_x + lower_run
        inner_max_x = outer_max_x - lower_run
        inner_min_y = outer_min_y + lower_run
        inner_max_y = outer_max_y - lower_run
        
        lower_z = self.base_elevation + self.lower_height
        upper_z = lower_z + self.upper_height
        
        # Lower slope rafters (steep)
        width = outer_max_x - outer_min_x
        num_rafters = int(width / self.rafter_spacing) + 1
        
        for i in range(num_rafters):
            x_pos = outer_min_x + i * self.rafter_spacing
            if x_pos > outer_max_x:
                x_pos = outer_max_x
            
            # South lower
            bottom = Point3D(x_pos, outer_min_y, self.base_elevation)
            top = Point3D(x_pos, inner_min_y, lower_z)
            self.rafters.append(RafterElement(bottom, top, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom.distance_to(top)))
            
            # North lower
            bottom_n = Point3D(x_pos, outer_max_y, self.base_elevation)
            top_n = Point3D(x_pos, inner_max_y, lower_z)
            self.rafters.append(RafterElement(bottom_n, top_n, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_n.distance_to(top_n)))
        
        length = outer_max_y - outer_min_y
        num_rafters_y = int(length / self.rafter_spacing) + 1
        
        for i in range(num_rafters_y):
            y_pos = outer_min_y + i * self.rafter_spacing
            if y_pos > outer_max_y:
                y_pos = outer_max_y
            
            # West lower
            bottom_w = Point3D(outer_min_x, y_pos, self.base_elevation)
            top_w = Point3D(inner_min_x, y_pos, lower_z)
            self.rafters.append(RafterElement(bottom_w, top_w, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_w.distance_to(top_w)))
            
            # East lower
            bottom_e = Point3D(outer_max_x, y_pos, self.base_elevation)
            top_e = Point3D(inner_max_x, y_pos, lower_z)
            self.rafters.append(RafterElement(bottom_e, top_e, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_e.distance_to(top_e)))
        
        # Upper slope rafters (gentle)
        inner_width = inner_max_x - inner_min_x
        num_upper_rafters = int(inner_width / self.rafter_spacing) + 1
        
        ridge_y = (inner_min_y + inner_max_y) / 2
        
        for i in range(num_upper_rafters):
            x_pos = inner_min_x + i * self.rafter_spacing
            if x_pos > inner_max_x:
                x_pos = inner_max_x
            
            # South upper
            bottom_u = Point3D(x_pos, inner_min_y, lower_z)
            top_u = Point3D(x_pos, ridge_y, upper_z)
            self.rafters.append(RafterElement(bottom_u, top_u, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_u.distance_to(top_u)))
            
            # North upper
            bottom_un = Point3D(x_pos, inner_max_y, lower_z)
            top_un = Point3D(x_pos, ridge_y, upper_z)
            self.rafters.append(RafterElement(bottom_un, top_un, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_un.distance_to(top_un)))
        
        # Ridge
        ridge_start = Point3D(inner_min_x, ridge_y, upper_z)
        ridge_end = Point3D(inner_max_x, ridge_y, upper_z)
        self.rafters.append(RafterElement(ridge_start, ridge_end, RafterType.RIDGE, self.rafter_width * 1.5, self.rafter_depth * 1.5, ridge_start.distance_to(ridge_end)))
        
        # Roof planes
        # Lower south
        self.roof_planes.append(RoofPlane([
            Point3D(outer_min_x, outer_min_y, self.base_elevation),
            Point3D(outer_max_x, outer_min_y, self.base_elevation),
            Point3D(inner_max_x, inner_min_y, lower_z),
            Point3D(inner_min_x, inner_min_y, lower_z)
        ], Vector3D(0, -math.sin(math.radians(self.lower_slope_degrees)), math.cos(math.radians(self.lower_slope_degrees))), self.lower_slope_degrees, 0))
        
        # Lower north
        self.roof_planes.append(RoofPlane([
            Point3D(outer_min_x, outer_max_y, self.base_elevation),
            Point3D(inner_min_x, inner_max_y, lower_z),
            Point3D(inner_max_x, inner_max_y, lower_z),
            Point3D(outer_max_x, outer_max_y, self.base_elevation)
        ], Vector3D(0, math.sin(math.radians(self.lower_slope_degrees)), math.cos(math.radians(self.lower_slope_degrees))), self.lower_slope_degrees, 0))
        
        # Lower west
        self.roof_planes.append(RoofPlane([
            Point3D(outer_min_x, outer_min_y, self.base_elevation),
            Point3D(inner_min_x, inner_min_y, lower_z),
            Point3D(inner_min_x, inner_max_y, lower_z),
            Point3D(outer_min_x, outer_max_y, self.base_elevation)
        ], Vector3D(-math.sin(math.radians(self.lower_slope_degrees)), 0, math.cos(math.radians(self.lower_slope_degrees))), self.lower_slope_degrees, 0))
        
        # Lower east
        self.roof_planes.append(RoofPlane([
            Point3D(outer_max_x, outer_min_y, self.base_elevation),
            Point3D(outer_max_x, outer_max_y, self.base_elevation),
            Point3D(inner_max_x, inner_max_y, lower_z),
            Point3D(inner_max_x, inner_min_y, lower_z)
        ], Vector3D(math.sin(math.radians(self.lower_slope_degrees)), 0, math.cos(math.radians(self.lower_slope_degrees))), self.lower_slope_degrees, 0))
        
        # Upper south
        self.roof_planes.append(RoofPlane([
            Point3D(inner_min_x, inner_min_y, lower_z),
            Point3D(inner_max_x, inner_min_y, lower_z),
            Point3D(inner_max_x, ridge_y, upper_z),
            Point3D(inner_min_x, ridge_y, upper_z)
        ], Vector3D(0, -math.sin(math.radians(self.upper_slope_degrees)), math.cos(math.radians(self.upper_slope_degrees))), self.upper_slope_degrees, 0))
        
        # Upper north
        self.roof_planes.append(RoofPlane([
            Point3D(inner_min_x, inner_max_y, lower_z),
            Point3D(inner_min_x, ridge_y, upper_z),
            Point3D(inner_max_x, ridge_y, upper_z),
            Point3D(inner_max_x, inner_max_y, lower_z)
        ], Vector3D(0, math.sin(math.radians(self.upper_slope_degrees)), math.cos(math.radians(self.upper_slope_degrees))), self.upper_slope_degrees, 0))
        
        return self.to_json()

    def to_json(self) -> Dict:
        return {
            "type": "mansard",
            "parameters": {
                "lower_slope_degrees": self.lower_slope_degrees,
                "upper_slope_degrees": self.upper_slope_degrees,
                "lower_height": self.lower_height,
                "upper_height": self.upper_height,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.005 if self.covering_type == RoofCoveringType.SLATE else 0.02,
                "#708090" if self.covering_type == RoofCoveringType.SLATE else "#8B4513",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class GambrelRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        lower_slope_degrees: float = 60.0,
        upper_slope_degrees: float = 30.0,
        lower_height: float = 2.5,
        upper_height: float = 2.0,
        overhang: float = 0.5,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.lower_slope_degrees = lower_slope_degrees
        self.upper_slope_degrees = upper_slope_degrees
        self.lower_height = lower_height
        self.upper_height = upper_height
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        width = max_x - min_x
        length = max_y - min_y
        
        # Calculate transition points
        lower_run = self.lower_height / math.tan(math.radians(self.lower_slope_degrees))
        
        y_mid = (min_y + max_y) / 2
        y_lower_south = min_y + lower_run
        y_lower_north = max_y - lower_run
        
        lower_z = self.base_elevation + self.lower_height
        ridge_z = lower_z + self.upper_height
        
        # Lower slope rafters
        num_rafters = int(width / self.rafter_spacing) + 1
        
        for i in range(num_rafters):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos > max_x:
                x_pos = max_x
            
            # South lower
            bottom_s = Point3D(x_pos, min_y, self.base_elevation)
            top_s = Point3D(x_pos, y_lower_south, lower_z)
            self.rafters.append(RafterElement(bottom_s, top_s, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_s.distance_to(top_s)))
            
            # North lower
            bottom_n = Point3D(x_pos, max_y, self.base_elevation)
            top_n = Point3D(x_pos, y_lower_north, lower_z)
            self.rafters.append(RafterElement(bottom_n, top_n, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_n.distance_to(top_n)))
            
            # South upper
            upper_s_bot = Point3D(x_pos, y_lower_south, lower_z)
            upper_s_top = Point3D(x_pos, y_mid, ridge_z)
            self.rafters.append(RafterElement(upper_s_bot, upper_s_top, RafterType.COMMON, self.rafter_width, self.rafter_depth, upper_s_bot.distance_to(upper_s_top)))
            
            # North upper
            upper_n_bot = Point3D(x_pos, y_lower_north, lower_z)
            upper_n_top = Point3D(x_pos, y_mid, ridge_z)
            self.rafters.append(RafterElement(upper_n_bot, upper_n_top, RafterType.COMMON, self.rafter_width, self.rafter_depth, upper_n_bot.distance_to(upper_n_top)))
        
        # Ridge
        ridge_start = Point3D(min_x, y_mid, ridge_z)
        ridge_end = Point3D(max_x, y_mid, ridge_z)
        self.rafters.append(RafterElement(ridge_start, ridge_end, RafterType.RIDGE, self.rafter_width * 1.5, self.rafter_depth * 1.5, ridge_start.distance_to(ridge_end)))
        
        # Purlins at transition
        purlin_s_start = Point3D(min_x, y_lower_south, lower_z)
        purlin_s_end = Point3D(max_x, y_lower_south, lower_z)
        self.purlins.append(PurlinElement(purlin_s_start, purlin_s_end, self.purlin_width, self.purlin_depth))
        
        purlin_n_start = Point3D(min_x, y_lower_north, lower_z)
        purlin_n_end = Point3D(max_x, y_lower_north, lower_z)
        self.purlins.append(PurlinElement(purlin_n_start, purlin_n_end, self.purlin_width, self.purlin_depth))
        
        # Roof planes
        # South lower
        self.roof_planes.append(RoofPlane([
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(max_x, min_y, self.base_elevation),
            Point3D(max_x, y_lower_south, lower_z),
            Point3D(min_x, y_lower_south, lower_z)
        ], Vector3D(0, -math.sin(math.radians(self.lower_slope_degrees)), math.cos(math.radians(self.lower_slope_degrees))), self.lower_slope_degrees, 0))
        
        # South upper
        self.roof_planes.append(RoofPlane([
            Point3D(min_x, y_lower_south, lower_z),
            Point3D(max_x, y_lower_south, lower_z),
            Point3D(max_x, y_mid, ridge_z),
            Point3D(min_x, y_mid, ridge_z)
        ], Vector3D(0, -math.sin(math.radians(self.upper_slope_degrees)), math.cos(math.radians(self.upper_slope_degrees))), self.upper_slope_degrees, 0))
        
        # North lower
        self.roof_planes.append(RoofPlane([
            Point3D(min_x, max_y, self.base_elevation),
            Point3D(min_x, y_lower_north, lower_z),
            Point3D(max_x, y_lower_north, lower_z),
            Point3D(max_x, max_y, self.base_elevation)
        ], Vector3D(0, math.sin(math.radians(self.lower_slope_degrees)), math.cos(math.radians(self.lower_slope_degrees))), self.lower_slope_degrees, 0))
        
        # North upper
        self.roof_planes.append(RoofPlane([
            Point3D(min_x, y_lower_north, lower_z),
            Point3D(min_x, y_mid, ridge_z),
            Point3D(max_x, y_mid, ridge_z),
            Point3D(max_x, y_lower_north, lower_z)
        ], Vector3D(0, math.sin(math.radians(self.upper_slope_degrees)), math.cos(math.radians(self.upper_slope_degrees))), self.upper_slope_degrees, 0))
        
        # Gable ends
        west_gable = [
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(min_x, y_lower_south, lower_z),
            Point3D(min_x, y_mid, ridge_z),
            Point3D(min_x, y_lower_north, lower_z),
            Point3D(min_x, max_y, self.base_elevation)
        ]
        self.roof_planes.append(RoofPlane(west_gable, Vector3D(-1, 0, 0), 90, 0))
        
        east_gable = [
            Point3D(max_x, min_y, self.base_elevation),
            Point3D(max_x, max_y, self.base_elevation),
            Point3D(max_x, y_lower_north, lower_z),
            Point3D(max_x, y_mid, ridge_z),
            Point3D(max_x, y_lower_south, lower_z)
        ]
        self.roof_planes.append(RoofPlane(east_gable, Vector3D(1, 0, 0), 90, 0))
        
        return self.to_json()

    def to_json(self) -> Dict:
        return {
            "type": "gambrel",
            "parameters": {
                "lower_slope_degrees": self.lower_slope_degrees,
                "upper_slope_degrees": self.upper_slope_degrees,
                "lower_height": self.lower_height,
                "upper_height": self.upper_height,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.015 if self.covering_type == RoofCoveringType.WOOD_SHAKES else 0.01,
                "#8B7355" if self.covering_type == RoofCoveringType.WOOD_SHAKES else "#696969",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class ShedRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        high_side_height: float = 4.0,
        slope_degrees: float = 15.0,
        overhang: float = 0.4,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.high_side_height = high_side_height
        self.slope_degrees = slope_degrees
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        width = max_x - min_x
        length = max_y - min_y
        
        high_z = self.base_elevation + self.high_side_height
        run = length
        rise = run * math.tan(math.radians(self.slope_degrees))
        low_z = high_z - rise
        
        # Common rafters
        num_rafters = int(width / self.rafter_spacing) + 1
        
        for i in range(num_rafters):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos > max_x:
                x_pos = max_x
            
            high_point = Point3D(x_pos, max_y, high_z)
            low_point = Point3D(x_pos, min_y, low_z)
            
            self.rafters.append(RafterElement(low_point, high_point, RafterType.COMMON, self.rafter_width, self.rafter_depth, low_point.distance_to(high_point)))
        
        # Purlins
        num_purlins = int(width / self.purlin_spacing) + 1
        
        for i in range(1, num_purlins):
            ratio = i / num_purlins
            y_pos = min_y + ratio * length
            z_pos = low_z + ratio * rise
            
            purlin_start = Point3D(min_x, y_pos, z_pos)
            purlin_end = Point3D(max_x, y_pos, z_pos)
            self.purlins.append(PurlinElement(purlin_start, purlin_end, self.purlin_width, self.purlin_depth))
        
        # Roof plane
        vertices = [
            Point3D(min_x, min_y, low_z),
            Point3D(max_x, min_y, low_z),
            Point3D(max_x, max_y, high_z),
            Point3D(min_x, max_y, high_z)
        ]
        
        normal = Vector3D(0, -math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(vertices, normal, self.slope_degrees, width * length / math.cos(math.radians(self.slope_degrees))))
        
        return self.to_json()

    def get_elevation_at_point(self, x: float, y: float) -> float:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        length = max_y - min_y
        high_z = self.base_elevation + self.high_side_height
        rise = length * math.tan(math.radians(self.slope_degrees))
        low_z = high_z - rise
        
        ratio = (y - min_y) / length if length > 0 else 0
        return low_z + ratio * rise

    def to_json(self) -> Dict:
        return {
            "type": "shed",
            "parameters": {
                "high_side_height": self.high_side_height,
                "slope_degrees": self.slope_degrees,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.002 if self.covering_type == RoofCoveringType.METAL_STANDING_SEAM else 0.01,
                "#A9A9A9" if self.covering_type == RoofCoveringType.METAL_STANDING_SEAM else "#556B2F",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class FlatRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        height: float = 3.0,
        slope_degrees: float = 2.0,
        overhang: float = 0.3,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.height = height
        self.slope_degrees = slope_degrees
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        width = max_x - min_x
        length = max_y - min_y
        
        # Minimal slope for drainage
        rise = length * math.tan(math.radians(self.slope_degrees))
        
        high_z = self.base_elevation + self.height
        low_z = high_z - rise
        
        # Joists (acting as rafters)
        num_joists = int(width / self.rafter_spacing) + 1
        
        for i in range(num_joists):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos > max_x:
                x_pos = max_x
            
            low_point = Point3D(x_pos, min_y, low_z)
            high_point = Point3D(x_pos, max_y, high_z)
            
            self.rafters.append(RafterElement(low_point, high_point, RafterType.COMMON, self.rafter_width * 1.5, self.rafter_depth * 1.5, low_point.distance_to(high_point)))
        
        # Roof plane
        vertices = [
            Point3D(min_x, min_y, low_z),
            Point3D(max_x, min_y, low_z),
            Point3D(max_x, max_y, high_z),
            Point3D(min_x, max_y, high_z)
        ]
        
        normal = Vector3D(0, -math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(vertices, normal, self.slope_degrees, width * length))
        
        return self.to_json()

    def to_json(self) -> Dict:
        return {
            "type": "flat",
            "parameters": {
                "height": self.height,
                "slope_degrees": self.slope_degrees,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.005 if self.covering_type == RoofCoveringType.MEMBRANE else 0.01,
                "#FFFFFF" if self.covering_type == RoofCoveringType.MEMBRANE else "#228B22",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class ButterflyRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        valley_depth: float = 1.0,
        edge_height: float = 3.0,
        slope_degrees: float = 20.0,
        overhang: float = 0.5,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.valley_depth = valley_depth
        self.edge_height = edge_height
        self.slope_degrees = slope_degrees
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        width = max_x - min_x
        length = max_y - min_y
        
        y_mid = (min_y + max_y) / 2
        
        edge_z = self.base_elevation + self.edge_height
        valley_z = edge_z - self.valley_depth
        
        # Valley rafter
        valley_start = Point3D(min_x, y_mid, valley_z)
        valley_end = Point3D(max_x, y_mid, valley_z)
        self.rafters.append(RafterElement(valley_start, valley_end, RafterType.VALLEY, self.rafter_width * 1.5, self.rafter_depth * 1.5, valley_start.distance_to(valley_end)))
        
        # Common rafters
        num_rafters = int(width / self.rafter_spacing) + 1
        
        for i in range(num_rafters):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos > max_x:
                x_pos = max_x
            
            # South slope (rises from valley to edge)
            valley_point = Point3D(x_pos, y_mid, valley_z)
            edge_south = Point3D(x_pos, min_y, edge_z)
            self.rafters.append(RafterElement(valley_point, edge_south, RafterType.COMMON, self.rafter_width, self.rafter_depth, valley_point.distance_to(edge_south)))
            
            # North slope
            edge_north = Point3D(x_pos, max_y, edge_z)
            self.rafters.append(RafterElement(valley_point, edge_north, RafterType.COMMON, self.rafter_width, self.rafter_depth, valley_point.distance_to(edge_north)))
        
        # Purlins
        num_purlins = int(width / self.purlin_spacing) + 1
        
        for i in range(1, num_purlins):
            ratio = i / num_purlins
            
            # South slope
            y_south = y_mid - ratio * (y_mid - min_y)
            z_south = valley_z + ratio * self.valley_depth
            purlin_s_start = Point3D(min_x, y_south, z_south)
            purlin_s_end = Point3D(max_x, y_south, z_south)
            self.purlins.append(PurlinElement(purlin_s_start, purlin_s_end, self.purlin_width, self.purlin_depth))
            
            # North slope
            y_north = y_mid + ratio * (max_y - y_mid)
            z_north = valley_z + ratio * self.valley_depth
            purlin_n_start = Point3D(min_x, y_north, z_north)
            purlin_n_end = Point3D(max_x, y_north, z_north)
            self.purlins.append(PurlinElement(purlin_n_start, purlin_n_end, self.purlin_width, self.purlin_depth))
        
        # Roof planes
        # South slope
        south_vertices = [
            Point3D(min_x, min_y, edge_z),
            Point3D(max_x, min_y, edge_z),
            Point3D(max_x, y_mid, valley_z),
            Point3D(min_x, y_mid, valley_z)
        ]
        south_normal = Vector3D(0, math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(south_vertices, south_normal, self.slope_degrees, 0))
        
        # North slope
        north_vertices = [
            Point3D(min_x, y_mid, valley_z),
            Point3D(max_x, y_mid, valley_z),
            Point3D(max_x, max_y, edge_z),
            Point3D(min_x, max_y, edge_z)
        ]
        north_normal = Vector3D(0, -math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees)))
        self.roof_planes.append(RoofPlane(north_vertices, north_normal, self.slope_degrees, 0))
        
        return self.to_json()

    def to_json(self) -> Dict:
        return {
            "type": "butterfly",
            "parameters": {
                "valley_depth": self.valley_depth,
                "edge_height": self.edge_height,
                "slope_degrees": self.slope_degrees,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.002 if self.covering_type == RoofCoveringType.METAL_STANDING_SEAM else 0.01,
                "#C0C0C0" if self.covering_type == RoofCoveringType.METAL_STANDING_SEAM else "#2F4F4F",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class SaltboxRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        ridge_height: float = 3.5,
        front_slope_degrees: float = 35.0,
        back_slope_degrees: float = 50.0,
        overhang: float = 0.5,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.ridge_height = ridge_height
        self.front_slope_degrees = front_slope_degrees
        self.back_slope_degrees = back_slope_degrees
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        width = max_x - min_x
        length = max_y - min_y
        
        # Ridge offset from center due to asymmetric slopes
        front_run = self.ridge_height / math.tan(math.radians(self.front_slope_degrees))
        back_run = self.ridge_height / math.tan(math.radians(self.back_slope_degrees))
        
        ridge_y = min_y + front_run
        
        ridge_z = self.base_elevation + self.ridge_height
        
        # Ridge
        ridge_start = Point3D(min_x, ridge_y, ridge_z)
        ridge_end = Point3D(max_x, ridge_y, ridge_z)
        self.rafters.append(RafterElement(ridge_start, ridge_end, RafterType.RIDGE, self.rafter_width * 1.5, self.rafter_depth * 1.5, ridge_start.distance_to(ridge_end)))
        
        # Common rafters
        num_rafters = int(width / self.rafter_spacing) + 1
        
        for i in range(num_rafters):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos > max_x:
                x_pos = max_x
            
            # Front slope (shorter, less steep)
            front_bottom = Point3D(x_pos, min_y, self.base_elevation)
            ridge_point = Point3D(x_pos, ridge_y, ridge_z)
            self.rafters.append(RafterElement(front_bottom, ridge_point, RafterType.COMMON, self.rafter_width, self.rafter_depth, front_bottom.distance_to(ridge_point)))
            
            # Back slope (longer, steeper)
            back_bottom = Point3D(x_pos, max_y, self.base_elevation)
            self.rafters.append(RafterElement(back_bottom, ridge_point, RafterType.COMMON, self.rafter_width, self.rafter_depth, back_bottom.distance_to(ridge_point)))
        
        # Purlins
        num_purlins = int(width / self.purlin_spacing) + 1
        
        for i in range(1, num_purlins):
            ratio = i / num_purlins
            
            # Front slope
            y_front = min_y + ratio * front_run
            z_front = self.base_elevation + ratio * self.ridge_height
            purlin_f_start = Point3D(min_x, y_front, z_front)
            purlin_f_end = Point3D(max_x, y_front, z_front)
            self.purlins.append(PurlinElement(purlin_f_start, purlin_f_end, self.purlin_width, self.purlin_depth))
            
            # Back slope
            y_back = ridge_y + ratio * (max_y - ridge_y)
            z_back = ridge_z - ratio * self.ridge_height
            purlin_b_start = Point3D(min_x, y_back, z_back)
            purlin_b_end = Point3D(max_x, y_back, z_back)
            self.purlins.append(PurlinElement(purlin_b_start, purlin_b_end, self.purlin_width, self.purlin_depth))
        
        # Roof planes
        # Front slope
        front_vertices = [
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(max_x, min_y, self.base_elevation),
            Point3D(max_x, ridge_y, ridge_z),
            Point3D(min_x, ridge_y, ridge_z)
        ]
        front_normal = Vector3D(0, -math.sin(math.radians(self.front_slope_degrees)), math.cos(math.radians(self.front_slope_degrees)))
        self.roof_planes.append(RoofPlane(front_vertices, front_normal, self.front_slope_degrees, 0))
        
        # Back slope
        back_vertices = [
            Point3D(min_x, ridge_y, ridge_z),
            Point3D(max_x, ridge_y, ridge_z),
            Point3D(max_x, max_y, self.base_elevation),
            Point3D(min_x, max_y, self.base_elevation)
        ]
        back_normal = Vector3D(0, math.sin(math.radians(self.back_slope_degrees)), math.cos(math.radians(self.back_slope_degrees)))
        self.roof_planes.append(RoofPlane(back_vertices, back_normal, self.back_slope_degrees, 0))
        
        # Gable ends
        west_gable = [
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(min_x, ridge_y, ridge_z),
            Point3D(min_x, max_y, self.base_elevation)
        ]
        self.roof_planes.append(RoofPlane(west_gable, Vector3D(-1, 0, 0), 90, 0))
        
        east_gable = [
            Point3D(max_x, min_y, self.base_elevation),
            Point3D(max_x, max_y, self.base_elevation),
            Point3D(max_x, ridge_y, ridge_z)
        ]
        self.roof_planes.append(RoofPlane(east_gable, Vector3D(1, 0, 0), 90, 0))
        
        return self.to_json()

    def to_json(self) -> Dict:
        return {
            "type": "saltbox",
            "parameters": {
                "ridge_height": self.ridge_height,
                "front_slope_degrees": self.front_slope_degrees,
                "back_slope_degrees": self.back_slope_degrees,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.015 if self.covering_type == RoofCoveringType.WOOD_SHAKES else 0.01,
                "#654321" if self.covering_type == RoofCoveringType.WOOD_SHAKES else "#8B4513",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class CombinationRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        ridge_height: float = 3.5,
        slope_degrees: float = 35.0,
        overhang: float = 0.5,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.ridge_height = ridge_height
        self.slope_degrees = slope_degrees
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        # Create L-shaped footprint combination
        # Main rectangle
        main_width = (max_x - min_x) * 0.7
        main_length = max_y - min_y
        
        # Wing rectangle
        wing_width = (max_x - min_x) * 0.4
        wing_length = (max_y - min_y) * 0.6
        
        # Main ridge
        main_ridge_y = (min_y + max_y) / 2
        main_ridge_start = Point3D(min_x, main_ridge_y, self.base_elevation + self.ridge_height)
        main_ridge_end = Point3D(min_x + main_width, main_ridge_y, self.base_elevation + self.ridge_height)
        
        self.rafters.append(RafterElement(main_ridge_start, main_ridge_end, RafterType.RIDGE, self.rafter_width * 1.5, self.rafter_depth * 1.5, main_ridge_start.distance_to(main_ridge_end)))
        
        # Wing ridge
        wing_ridge_x = min_x + main_width * 0.5
        wing_ridge_start = Point3D(wing_ridge_x, min_y, self.base_elevation + self.ridge_height)
        wing_ridge_end = Point3D(wing_ridge_x, min_y + wing_length, self.base_elevation + self.ridge_height)
        
        self.rafters.append(RafterElement(wing_ridge_start, wing_ridge_end, RafterType.RIDGE, self.rafter_width * 1.5, self.rafter_depth * 1.5, wing_ridge_start.distance_to(wing_ridge_end)))
        
        # Valley rafter where main and wing meet
        valley_start = Point3D(wing_ridge_x, min_y + wing_length, self.base_elevation)
        valley_end = Point3D(wing_ridge_x, main_ridge_y, self.base_elevation + self.ridge_height)
        
        self.rafters.append(RafterElement(valley_start, valley_end, RafterType.VALLEY, self.rafter_width * 1.3, self.rafter_depth * 1.3, valley_start.distance_to(valley_end)))
        
        # Main roof common rafters
        num_main_rafters = int(main_width / self.rafter_spacing) + 1
        
        for i in range(num_main_rafters):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos > min_x + main_width:
                x_pos = min_x + main_width
            
            # South slope
            bottom_s = Point3D(x_pos, min_y, self.base_elevation)
            top = Point3D(x_pos, main_ridge_y, self.base_elevation + self.ridge_height)
            self.rafters.append(RafterElement(bottom_s, top, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_s.distance_to(top)))
            
            # North slope
            bottom_n = Point3D(x_pos, max_y, self.base_elevation)
            self.rafters.append(RafterElement(bottom_n, top, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_n.distance_to(top)))
        
        # Wing common rafters
        num_wing_rafters = int(wing_length / self.rafter_spacing) + 1
        
        for i in range(num_wing_rafters):
            y_pos = min_y + i * self.rafter_spacing
            if y_pos > min_y + wing_length:
                y_pos = min_y + wing_length
            
            # West slope
            bottom_w = Point3D(min_x + main_width, y_pos, self.base_elevation)
            top_w = Point3D(wing_ridge_x, y_pos, self.base_elevation + self.ridge_height)
            self.rafters.append(RafterElement(bottom_w, top_w, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_w.distance_to(top_w)))
            
            # East slope
            bottom_e = Point3D(max_x, y_pos, self.base_elevation)
            self.rafters.append(RafterElement(bottom_e, top_w, RafterType.COMMON, self.rafter_width, self.rafter_depth, bottom_e.distance_to(top_w)))
        
        # Hip rafters for wing end
        corner_sw = Point3D(min_x + main_width, min_y, self.base_elevation)
        corner_se = Point3D(max_x, min_y, self.base_elevation)
        
        self.rafters.append(RafterElement(corner_sw, wing_ridge_start, RafterType.HIP, self.rafter_width * 1.2, self.rafter_depth * 1.2, corner_sw.distance_to(wing_ridge_start)))
        self.rafters.append(RafterElement(corner_se, wing_ridge_start, RafterType.HIP, self.rafter_width * 1.2, self.rafter_depth * 1.2, corner_se.distance_to(wing_ridge_start)))
        
        # Roof planes (simplified)
        # Main south plane
        self.roof_planes.append(RoofPlane([
            Point3D(min_x, min_y, self.base_elevation),
            Point3D(min_x + main_width, min_y, self.base_elevation),
            main_ridge_end,
            main_ridge_start
        ], Vector3D(0, -math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees))), self.slope_degrees, 0))
        
        # Main north plane
        self.roof_planes.append(RoofPlane([
            Point3D(min_x, max_y, self.base_elevation),
            main_ridge_start,
            main_ridge_end,
            Point3D(min_x + main_width, max_y, self.base_elevation)
        ], Vector3D(0, math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees))), self.slope_degrees, 0))
        
        # Wing planes
        self.roof_planes.append(RoofPlane([
            Point3D(min_x + main_width, min_y, self.base_elevation),
            Point3D(max_x, min_y, self.base_elevation),
            wing_ridge_start
        ], Vector3D(0, -math.sin(math.radians(self.slope_degrees)), math.cos(math.radians(self.slope_degrees))), self.slope_degrees, 0))
        
        self.roof_planes.append(RoofPlane([
            wing_ridge_start,
            wing_ridge_end,
            Point3D(max_x, min_y + wing_length, self.base_elevation),
            Point3D(min_x + main_width, min_y + wing_length, self.base_elevation)
        ], Vector3D(math.sin(math.radians(self.slope_degrees)), 0, math.cos(math.radians(self.slope_degrees))), self.slope_degrees, 0))
        
        return self.to_json()

    def to_json(self) -> Dict:
        return {
            "type": "combination",
            "parameters": {
                "ridge_height": self.ridge_height,
                "slope_degrees": self.slope_degrees,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.02 if self.covering_type == RoofCoveringType.CLAY_TILES else 0.01,
                "#CD853F" if self.covering_type == RoofCoveringType.CLAY_TILES else "#696969",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class BarrelRoof(BaseRoof):
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        radius: float = 4.0,
        segments: int = 16,
        overhang: float = 0.3,
        **kwargs
    ):
        super().__init__(footprint, **kwargs)
        self.radius = radius
        self.segments = segments
        self.overhang = overhang

    def generate(self) -> Dict:
        min_x, max_x, min_y, max_y = self.get_footprint_bounds()
        
        min_x -= self.overhang
        max_x += self.overhang
        min_y -= self.overhang
        max_y += self.overhang
        
        width = max_x - min_x
        length = max_y - min_y
        
        y_center = (min_y + max_y) / 2
        
        # Generate curved ribs (acting as rafters)
        num_ribs = int(width / self.rafter_spacing) + 1
        
        for i in range(num_ribs):
            x_pos = min_x + i * self.rafter_spacing
            if x_pos > max_x:
                x_pos = max_x
            
            # Generate curved path
            for seg in range(self.segments):
                angle_start = -math.pi / 2 + (seg / self.segments) * math.pi
                angle_end = -math.pi / 2 + ((seg + 1) / self.segments) * math.pi
                
                y_start = y_center + self.radius * math.cos(angle_start)
                z_start = self.base_elevation + self.radius * (1 + math.sin(angle_start))
                
                y_end = y_center + self.radius * math.cos(angle_end)
                z_end = self.base_elevation + self.radius * (1 + math.sin(angle_end))
                
                point_start = Point3D(x_pos, y_start, z_start)
                point_end = Point3D(x_pos, y_end, z_end)
                
                self.rafters.append(RafterElement(point_start, point_end, RafterType.COMMON, self.rafter_width, self.rafter_depth, point_start.distance_to(point_end)))
        
        # Purlins along the barrel
        num_purlins = self.segments + 1
        
        for seg in range(num_purlins):
            angle = -math.pi / 2 + (seg / self.segments) * math.pi
            y_pos = y_center + self.radius * math.cos(angle)
            z_pos = self.base_elevation + self.radius * (1 + math.sin(angle))
            
            purlin_start = Point3D(min_x, y_pos, z_pos)
            purlin_end = Point3D(max_x, y_pos, z_pos)
            self.purlins.append(PurlinElement(purlin_start, purlin_end, self.purlin_width, self.purlin_depth))
        
        # Generate roof surface as triangulated mesh
        for i in range(num_ribs - 1):
            x1 = min_x + i * self.rafter_spacing
            x2 = min_x + (i + 1) * self.rafter_spacing
            if x2 > max_x:
                x2 = max_x
            
            for seg in range(self.segments):
                angle1 = -math.pi / 2 + (seg / self.segments) * math.pi
                angle2 = -math.pi / 2 + ((seg + 1) / self.segments) * math.pi
                
                y1 = y_center + self.radius * math.cos(angle1)
                z1 = self.base_elevation + self.radius * (1 + math.sin(angle1))
                
                y2 = y_center + self.radius * math.cos(angle2)
                z2 = self.base_elevation + self.radius * (1 + math.sin(angle2))
                
                vertices = [
                    Point3D(x1, y1, z1),
                    Point3D(x2, y1, z1),
                    Point3D(x2, y2, z2),
                    Point3D(x1, y2, z2)
                ]
                
                # Approximate normal for curved surface
                normal = Vector3D(0, math.cos(angle1 + (angle2 - angle1) / 2), math.sin(angle1 + (angle2 - angle1) / 2))
                self.roof_planes.append(RoofPlane(vertices, normal, 0, 0))
        
        # End caps (semi-circles)
        # West end
        west_vertices = []
        for seg in range(self.segments + 1):
            angle = -math.pi / 2 + (seg / self.segments) * math.pi
            y = y_center + self.radius * math.cos(angle)
            z = self.base_elevation + self.radius * (1 + math.sin(angle))
            west_vertices.append(Point3D(min_x, y, z))
        
        self.roof_planes.append(RoofPlane(west_vertices, Vector3D(-1, 0, 0), 90, 0))
        
        # East end
        east_vertices = []
        for seg in range(self.segments + 1):
            angle = -math.pi / 2 + (seg / self.segments) * math.pi
            y = y_center + self.radius * math.cos(angle)
            z = self.base_elevation + self.radius * (1 + math.sin(angle))
            east_vertices.append(Point3D(max_x, y, z))
        
        self.roof_planes.append(RoofPlane(east_vertices, Vector3D(1, 0, 0), 90, 0))
        
        return self.to_json()

    def to_json(self) -> Dict:
        return {
            "type": "barrel",
            "parameters": {
                "radius": self.radius,
                "segments": self.segments,
                "overhang": self.overhang,
                "base_elevation": self.base_elevation
            },
            "rafters": [r.to_dict() for r in self.rafters],
            "purlins": [p.to_dict() for p in self.purlins],
            "roof_planes": len(self.roof_planes),
            "covering": RoofCovering(
                self.covering_type,
                0.002 if self.covering_type == RoofCoveringType.METAL_STANDING_SEAM else 0.01,
                "#B0C4DE" if self.covering_type == RoofCoveringType.METAL_STANDING_SEAM else "#778899",
                1.0
            ).to_dict(),
            "chimneys": [c.to_dict() for c in self.chimneys],
            "skylights": [s.to_dict() for s in self.skylights],
            "gltf_geometry": self.generate_gltf_geometry()
        }


class RoofFactory:
    @staticmethod
    def create_roof(roof_type: str, footprint: List[Tuple[float, float]], **kwargs) -> BaseRoof:
        roof_types = {
            "gable": GableRoof,
            "hip": HipRoof,
            "mansard": MansardRoof,
            "gambrel": GambrelRoof,
            "shed": ShedRoof,
            "flat": FlatRoof,
            "butterfly": ButterflyRoof,
            "saltbox": SaltboxRoof,
            "combination": CombinationRoof,
            "barrel": BarrelRoof
        }
        
        if roof_type.lower() not in roof_types:
            raise ValueError(f"Unknown roof type: {roof_type}")
        
        return roof_types[roof_type.lower()](footprint, **kwargs)


# Example usage
if __name__ == "__main__":
    # Define building footprint (rectangular)
    building_footprint = [
        (0, 0),
        (10, 0),
        (10, 8),
        (0, 8)
    ]
    
    # Example 1: Gable roof with asphalt shingles
    gable_roof = RoofFactory.create_roof(
        "gable",
        building_footprint,
        ridge_height=3.5,
        slope_degrees=35.0,
        overhang=0.6,
        base_elevation=3.0,
        covering_type=RoofCoveringType.ASPHALT_SHINGLES
    )
    gable_roof.add_chimney(5, 2, width=0.8, depth=0.8, height=2.5)
    gable_roof.add_skylight(7, 3, width=1.2, depth=1.0)
    gable_json = gable_roof.generate()
    
    print("Gable Roof JSON:")
    print(json.dumps(gable_json, indent=2))
    
    # Example 2: Hip roof with clay tiles
    hip_roof = RoofFactory.create_roof(
        "hip",
        building_footprint,
        ridge_height=3.0,
        slope_degrees=30.0,
        overhang=0.5,
        base_elevation=3.0,
        covering_type=RoofCoveringType.CLAY_TILES
    )
    hip_json = hip_roof.generate()
    
    # Example 3: Mansard roof with slate
    mansard_roof = RoofFactory.create_roof(
        "mansard",
        building_footprint,
        lower_slope_degrees=70.0,
        upper_slope_degrees=30.0,
        lower_height=2.0,
        upper_height=1.5,
        overhang=0.3,
        base_elevation=3.0,
        covering_type=RoofCoveringType.SLATE
    )
    mansard_json = mansard_roof.generate()
    
    # Example 4: Gambrel roof with wood shakes
    gambrel_roof = RoofFactory.create_roof(
        "gambrel",
        building_footprint,
        lower_slope_degrees=60.0,
        upper_slope_degrees=30.0,
        lower_height=2.5,
        upper_height=2.0,
        base_elevation=3.0,
        covering_type=RoofCoveringType.WOOD_SHAKES
    )
    gambrel_json = gambrel_roof.generate()
    
    # Example 5: Shed roof with metal
    shed_roof = RoofFactory.create_roof(
        "shed",
        building_footprint,
        high_side_height=4.0,
        slope_degrees=15.0,
        base_elevation=3.0,
        covering_type=RoofCoveringType.METAL_STANDING_SEAM
    )
    shed_json = shed_roof.generate()
    
    # Example 6: Flat roof with membrane
    flat_roof = RoofFactory.create_roof(
        "flat",
        building_footprint,
        height=3.0,
        slope_degrees=2.0,
        base_elevation=3.0,
        covering_type=RoofCoveringType.MEMBRANE
    )
    flat_json = flat_roof.generate()
    
    # Example 7: Butterfly roof
    butterfly_roof = RoofFactory.create_roof(
        "butterfly",
        building_footprint,
        valley_depth=1.0,
        edge_height=3.5,
        slope_degrees=20.0,
        base_elevation=3.0,
        covering_type=RoofCoveringType.METAL_STANDING_SEAM
    )
    butterfly_json = butterfly_roof.generate()
    
    # Example 8: Saltbox roof
    saltbox_roof = RoofFactory.create_roof(
        "saltbox",
        building_footprint,
        ridge_height=3.5,
        front_slope_degrees=35.0,
        back_slope_degrees=50.0,
        base_elevation=3.0,
        covering_type=RoofCoveringType.WOOD_SHAKES
    )
    saltbox_json = saltbox_roof.generate()
    
    # Example 9: Combination roof (L-shaped)
    combination_roof = RoofFactory.create_roof(
        "combination",
        building_footprint,
        ridge_height=3.5,
        slope_degrees=35.0,
        base_elevation=3.0,
        covering_type=RoofCoveringType.CLAY_TILES
    )
    combination_json = combination_roof.generate()
    
    # Example 10: Barrel/Curved roof
    barrel_roof = RoofFactory.create_roof(
        "barrel",
        building_footprint,
        radius=4.0,
        segments=20,
        base_elevation=3.0,
        covering_type=RoofCoveringType.METAL_STANDING_SEAM
    )
    barrel_json = barrel_roof.generate()
    
    # Example: Dynamic roof swapping
    def swap_roof_type(building_footprint, old_type: str, new_type: str, **params):
        """
        Swap roof type on a building footprint
        """
        new_roof = RoofFactory.create_roof(new_type, building_footprint, **params)
        return new_roof.generate()
    
    # Swap from gable to hip
    swapped_roof = swap_roof_type(
        building_footprint,
        "gable",
        "hip",
        ridge_height=3.0,
        slope_degrees=30.0,
        base_elevation=3.0
    )
    
    print("\nSwapped Roof (Gable -> Hip):")
    print(json.dumps(swapped_roof, indent=2))
    
    # Example: Integration with building pipeline
    def attach_roof_to_building(building_data: Dict, roof_type: str, **roof_params) -> Dict:
        """
        Attach a roof to an existing building structure
        """
        # Extract footprint from building walls
        footprint = building_data.get("footprint", [])
        wall_height = building_data.get("wall_height", 3.0)
        
        # Create roof at wall height
        roof = RoofFactory.create_roof(
            roof_type,
            footprint,
            base_elevation=wall_height,
            **roof_params
        )
        
        roof_data = roof.generate()
        
        # Merge building and roof data
        complete_building = {
            **building_data,
            "roof": roof_data
        }
        
        return complete_building
    
    # Example building data
    example_building = {
        "footprint": building_footprint,
        "wall_height": 3.0,
        "walls": [],
        "doors": [],
        "windows": []
    }
    
    # Attach hip roof to building
    complete_building = attach_roof_to_building(
        example_building,
        "hip",
        ridge_height=3.5,
        slope_degrees=35.0,
        covering_type=RoofCoveringType.CONCRETE_TILES
    )
    
    print("\nComplete Building with Roof:")
    print(json.dumps(complete_building, indent=2))