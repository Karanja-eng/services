"""
Parametric Roof Finishes and Details Module
Architectural components for roof coverings, rainwater systems, eaves, and flashing
"""

import numpy as np
import json
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional, Any
from enum import Enum
import math


# ============================================================================
# UTILITY CLASSES AND ENUMS
# ============================================================================

class MaterialType(Enum):
    ASPHALT = "asphalt"
    CLAY = "clay"
    CONCRETE = "concrete"
    METAL = "metal"
    SLATE = "slate"
    WOOD = "wood"
    MEMBRANE = "membrane"
    VEGETATION = "vegetation"
    SOLAR = "solar"
    ALUMINUM = "aluminum"
    COPPER = "copper"
    STEEL = "steel"
    PVC = "pvc"


@dataclass
class MaterialProperties:
    """Material visual and physical properties"""
    diffuse_color: Tuple[float, float, float] = (0.5, 0.5, 0.5)
    roughness: float = 0.5
    metalness: float = 0.0
    specular: float = 0.5
    texture_scale: float = 1.0
    bump_strength: float = 0.0


@dataclass
class MeshData:
    """Container for mesh geometry and metadata"""
    vertices: np.ndarray
    faces: np.ndarray
    normals: np.ndarray
    uvs: np.ndarray
    material: MaterialProperties
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        """Export mesh data as dictionary"""
        return {
            'vertices': self.vertices.tolist(),
            'faces': self.faces.tolist(),
            'normals': self.normals.tolist(),
            'uvs': self.uvs.tolist(),
            'material': {
                'diffuse': list(self.material.diffuse_color),
                'roughness': self.material.roughness,
                'metalness': self.material.metalness,
                'specular': self.material.specular,
                'textureScale': self.material.texture_scale,
                'bumpStrength': self.material.bump_strength
            },
            'metadata': self.metadata
        }


@dataclass
class RoofPlane:
    """Represents a roof plane for component attachment"""
    vertices: np.ndarray  # (N, 3) array of vertices
    normal: np.ndarray    # Normal vector
    pitch_degrees: float  # Roof pitch in degrees
    eave_edge: np.ndarray  # (M, 3) array defining eave edge
    rake_edges: List[np.ndarray] = field(default_factory=list)
    ridge_edge: Optional[np.ndarray] = None
    valley_edges: List[np.ndarray] = field(default_factory=list)


def compute_normal(v1: np.ndarray, v2: np.ndarray, v3: np.ndarray) -> np.ndarray:
    """Compute normal vector from three vertices"""
    edge1 = v2 - v1
    edge2 = v3 - v1
    normal = np.cross(edge1, edge2)
    norm = np.linalg.norm(normal)
    return normal / norm if norm > 0 else np.array([0, 0, 1])


def extrude_profile(path: np.ndarray, profile: np.ndarray, 
                    up_vector: np.ndarray = np.array([0, 0, 1])) -> Tuple[np.ndarray, np.ndarray]:
    """Extrude a 2D profile along a 3D path"""
    vertices = []
    faces = []
    
    for i, point in enumerate(path):
        if i == 0:
            direction = path[1] - path[0]
        elif i == len(path) - 1:
            direction = path[-1] - path[-2]
        else:
            direction = path[i+1] - path[i-1]
        
        direction = direction / np.linalg.norm(direction)
        right = np.cross(direction, up_vector)
        right = right / np.linalg.norm(right)
        up = np.cross(right, direction)
        
        for profile_point in profile:
            vertex = point + profile_point[0] * right + profile_point[1] * up
            vertices.append(vertex)
    
    vertices = np.array(vertices)
    n_profile = len(profile)
    
    for i in range(len(path) - 1):
        for j in range(n_profile - 1):
            v1 = i * n_profile + j
            v2 = i * n_profile + j + 1
            v3 = (i + 1) * n_profile + j
            v4 = (i + 1) * n_profile + j + 1
            
            faces.append([v1, v2, v4])
            faces.append([v1, v4, v3])
    
    return vertices, np.array(faces)


# ============================================================================
# ROOF COVERING SYSTEMS
# ============================================================================

class RoofCovering:
    """Base class for roof covering systems"""
    
    def __init__(self, roof_plane: RoofPlane, material: MaterialProperties):
        self.roof_plane = roof_plane
        self.material = material
    
    def generate(self) -> MeshData:
        """Generate mesh for roof covering"""
        raise NotImplementedError


class AsphaltShingles(RoofCovering):
    """Asphalt composition shingles with tab pattern"""
    
    def __init__(self, roof_plane: RoofPlane, 
                 color: Tuple[float, float, float] = (0.3, 0.3, 0.35),
                 exposure: float = 0.14,  # 5.5 inches in meters
                 shingle_width: float = 0.914,  # 36 inches
                 tab_width: float = 0.305,  # 12 inches per tab
                 overlap: float = 0.127,  # 5 inch overlap
                 pattern_offset: float = 0.5):  # Offset ratio for staggering
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.8,
            metalness=0.0,
            bump_strength=0.002
        )
        super().__init__(roof_plane, material)
        
        self.exposure = exposure
        self.shingle_width = shingle_width
        self.tab_width = tab_width
        self.overlap = overlap
        self.pattern_offset = pattern_offset
        self.shingle_height = exposure + overlap
    
    def generate(self) -> MeshData:
        """Generate asphalt shingle mesh with 3-tab pattern"""
        vertices = []
        faces = []
        uvs = []
        
        # Project roof plane to 2D for tiling
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        height_2d = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        # Calculate number of rows
        n_rows = int(np.ceil(height_2d / self.exposure)) + 2
        n_cols = int(np.ceil(width / self.shingle_width)) + 1
        
        v_index = 0
        for row in range(n_rows):
            y_offset = row * self.exposure
            row_offset = (row % 2) * self.pattern_offset * self.shingle_width
            
            for col in range(n_cols):
                x_offset = col * self.shingle_width + row_offset
                
                # Create shingle quad with slight z variation for texture
                z_var = np.random.uniform(-0.001, 0.001)
                
                corners = [
                    [x_offset, y_offset, z_var],
                    [x_offset + self.shingle_width, y_offset, z_var],
                    [x_offset + self.shingle_width, y_offset + self.shingle_height, z_var],
                    [x_offset, y_offset + self.shingle_height, z_var]
                ]
                
                # Transform to roof plane
                for corner in corners:
                    pt = min_pt + np.array([corner[0], corner[1], corner[2]])
                    vertices.append(pt)
                    uvs.append([corner[0] / self.shingle_width, corner[1] / self.exposure])
                
                # Create faces
                base = v_index * 4
                faces.append([base, base + 1, base + 2])
                faces.append([base, base + 2, base + 3])
                v_index += 1
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        
        # Compute normals
        normals = np.tile(self.roof_plane.normal, (len(vertices), 1))
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'asphalt_shingles', 'exposure': self.exposure}
        )


class ClayTiles(RoofCovering):
    """Clay barrel or S-tile roofing"""
    
    def __init__(self, roof_plane: RoofPlane,
                 color: Tuple[float, float, float] = (0.7, 0.35, 0.2),
                 tile_width: float = 0.254,  # 10 inches
                 tile_length: float = 0.406,  # 16 inches
                 exposure: float = 0.330,  # 13 inches
                 barrel_profile: bool = True,
                 profile_height: float = 0.05):
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.4,
            metalness=0.0,
            bump_strength=0.01,
            specular=0.3
        )
        super().__init__(roof_plane, material)
        
        self.tile_width = tile_width
        self.tile_length = tile_length
        self.exposure = exposure
        self.barrel_profile = barrel_profile
        self.profile_height = profile_height
    
    def generate(self) -> MeshData:
        """Generate clay tile mesh with barrel profile"""
        vertices = []
        faces = []
        uvs = []
        
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        length = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        n_rows = int(np.ceil(length / self.exposure)) + 1
        n_cols = int(np.ceil(width / self.tile_width)) + 1
        
        # Create barrel profile curve
        n_segments = 12
        profile_points = []
        for i in range(n_segments + 1):
            t = i / n_segments
            if self.barrel_profile:
                z = self.profile_height * np.sin(t * np.pi)
            else:  # S-tile
                z = self.profile_height * np.sin(t * 2 * np.pi)
            profile_points.append(z)
        
        v_index = 0
        for row in range(n_rows):
            y_offset = row * self.exposure
            
            for col in range(n_cols):
                x_offset = col * self.tile_width
                
                # Create tile with profile
                for i in range(n_segments):
                    for j in range(2):
                        y = y_offset + j * self.tile_length
                        x = x_offset + (i / n_segments) * self.tile_width
                        z = profile_points[i + (j * (n_segments))] if j == 0 else profile_points[i + 1]
                        
                        pt = min_pt + np.array([x, y, z])
                        vertices.append(pt)
                        uvs.append([x / self.tile_width, y / self.exposure])
                
                # Create faces for tile
                base = v_index * (n_segments * 2)
                for i in range(n_segments - 1):
                    b = base + i * 2
                    faces.append([b, b + 2, b + 3])
                    faces.append([b, b + 3, b + 1])
                
                v_index += 1
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        normals = np.tile(self.roof_plane.normal, (len(vertices), 1))
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'clay_tiles', 'barrel_profile': self.barrel_profile}
        )


class MetalStandingSeam(RoofCovering):
    """Metal standing seam roofing system"""
    
    def __init__(self, roof_plane: RoofPlane,
                 color: Tuple[float, float, float] = (0.6, 0.6, 0.65),
                 panel_width: float = 0.406,  # 16 inches
                 seam_height: float = 0.038,  # 1.5 inches
                 seam_width: float = 0.032,  # 1.25 inches
                 finish: str = 'galvalume'):  # galvalume, painted, copper
        
        metalness = 0.9 if finish == 'galvalume' else 0.7
        roughness = 0.2 if finish == 'galvalume' else 0.3
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=roughness,
            metalness=metalness,
            specular=0.8
        )
        super().__init__(roof_plane, material)
        
        self.panel_width = panel_width
        self.seam_height = seam_height
        self.seam_width = seam_width
        self.finish = finish
    
    def generate(self) -> MeshData:
        """Generate standing seam metal roof mesh"""
        vertices = []
        faces = []
        uvs = []
        
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        length = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        n_panels = int(np.ceil(width / self.panel_width))
        
        for panel in range(n_panels + 1):
            x_offset = panel * self.panel_width
            
            # Create panel flat section
            flat_width = self.panel_width - self.seam_width
            
            # Left seam
            seam_profile = [
                [0, 0],
                [self.seam_width * 0.5, self.seam_height],
                [self.seam_width, 0]
            ]
            
            path = np.array([
                min_pt + np.array([x_offset, 0, 0]),
                min_pt + np.array([x_offset, length, 0])
            ])
            
            # Create seam vertices
            for i, pt in enumerate(path):
                for profile_pt in seam_profile:
                    vertex = pt + np.array([profile_pt[0], 0, profile_pt[1]])
                    vertices.append(vertex)
                    uvs.append([x_offset / self.panel_width, i])
            
            # Create seam faces
            base = len(vertices) - 6
            for i in range(2):
                b = base + i * 3
                faces.append([b, b + 3, b + 4])
                faces.append([b, b + 4, b + 1])
                faces.append([b + 1, b + 4, b + 5])
                faces.append([b + 1, b + 5, b + 2])
            
            # Flat panel section
            if panel < n_panels:
                panel_verts = [
                    min_pt + np.array([x_offset + self.seam_width, 0, 0]),
                    min_pt + np.array([x_offset + self.panel_width, 0, 0]),
                    min_pt + np.array([x_offset + self.panel_width, length, 0]),
                    min_pt + np.array([x_offset + self.seam_width, length, 0])
                ]
                
                base = len(vertices)
                for v in panel_verts:
                    vertices.append(v)
                    uvs.append([(v[0] - min_pt[0]) / self.panel_width, (v[1] - min_pt[1]) / length])
                
                faces.append([base, base + 1, base + 2])
                faces.append([base, base + 2, base + 3])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        normals = np.tile(self.roof_plane.normal, (len(vertices), 1))
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'standing_seam', 'finish': self.finish}
        )


class CorrugatedMetal(RoofCovering):
    """Corrugated metal roofing panels"""
    
    def __init__(self, roof_plane: RoofPlane,
                 color: Tuple[float, float, float] = (0.5, 0.5, 0.55),
                 panel_width: float = 0.66,  # 26 inches
                 corrugation_pitch: float = 0.076,  # 3 inches
                 corrugation_depth: float = 0.019,  # 0.75 inches
                 gauge: int = 29):
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=0.8,
            specular=0.7
        )
        super().__init__(roof_plane, material)
        
        self.panel_width = panel_width
        self.corrugation_pitch = corrugation_pitch
        self.corrugation_depth = corrugation_depth
        self.gauge = gauge
    
    def generate(self) -> MeshData:
        """Generate corrugated metal panel mesh"""
        vertices = []
        faces = []
        uvs = []
        
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        length = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        n_panels = int(np.ceil(width / self.panel_width))
        n_corrugations = int(self.panel_width / self.corrugation_pitch)
        n_length_segments = max(20, int(length / 0.1))
        
        for panel in range(n_panels):
            x_start = panel * self.panel_width
            
            for i in range(n_length_segments + 1):
                y = (i / n_length_segments) * length
                
                for j in range(n_corrugations + 1):
                    x = x_start + j * self.corrugation_pitch
                    z = self.corrugation_depth * np.sin((j / n_corrugations) * 2 * np.pi)
                    
                    pt = min_pt + np.array([x, y, z])
                    vertices.append(pt)
                    uvs.append([x / self.panel_width, y / length])
            
            # Create faces
            base_offset = panel * (n_length_segments + 1) * (n_corrugations + 1)
            for i in range(n_length_segments):
                for j in range(n_corrugations):
                    v1 = base_offset + i * (n_corrugations + 1) + j
                    v2 = v1 + 1
                    v3 = v1 + (n_corrugations + 1)
                    v4 = v3 + 1
                    
                    faces.append([v1, v2, v4])
                    faces.append([v1, v4, v3])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        
        # Compute normals per vertex based on corrugation
        normals = []
        for i, v in enumerate(vertices):
            idx = i % (n_corrugations + 1)
            angle = (idx / n_corrugations) * 2 * np.pi
            normal_offset = np.array([0, 0, np.cos(angle)])
            normal = self.roof_plane.normal + normal_offset * 0.3
            normal = normal / np.linalg.norm(normal)
            normals.append(normal)
        normals = np.array(normals)
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'corrugated_metal', 'gauge': self.gauge}
        )


class SlateTiles(RoofCovering):
    """Natural slate tile roofing"""
    
    def __init__(self, roof_plane: RoofPlane,
                 color: Tuple[float, float, float] = (0.3, 0.35, 0.4),
                 tile_width: float = 0.254,  # 10 inches
                 tile_length: float = 0.508,  # 20 inches
                 exposure: float = 0.229,  # 9 inches
                 pattern: str = 'standard',  # standard, staggered, graduated
                 thickness_variation: float = 0.003):
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.6,
            metalness=0.0,
            bump_strength=0.005,
            specular=0.2
        )
        super().__init__(roof_plane, material)
        
        self.tile_width = tile_width
        self.tile_length = tile_length
        self.exposure = exposure
        self.pattern = pattern
        self.thickness_variation = thickness_variation
    
    def generate(self) -> MeshData:
        """Generate slate tile mesh with natural variation"""
        vertices = []
        faces = []
        uvs = []
        
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        length = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        n_rows = int(np.ceil(length / self.exposure)) + 2
        n_cols = int(np.ceil(width / self.tile_width)) + 1
        
        v_index = 0
        for row in range(n_rows):
            y_offset = row * self.exposure
            
            # Staggered pattern offset
            row_offset = 0
            if self.pattern == 'staggered':
                row_offset = (row % 2) * (self.tile_width * 0.5)
            
            for col in range(n_cols):
                x_offset = col * self.tile_width + row_offset
                
                # Random thickness variation for natural look
                z_var = np.random.uniform(-self.thickness_variation, self.thickness_variation)
                
                # Slight width/length variation
                width_var = np.random.uniform(0.98, 1.02)
                length_var = np.random.uniform(0.98, 1.02)
                
                tile_w = self.tile_width * width_var
                tile_l = self.tile_length * length_var
                
                corners = [
                    [x_offset, y_offset, z_var],
                    [x_offset + tile_w, y_offset, z_var],
                    [x_offset + tile_w, y_offset + tile_l, z_var],
                    [x_offset, y_offset + tile_l, z_var]
                ]
                
                for corner in corners:
                    pt = min_pt + np.array(corner)
                    vertices.append(pt)
                    uvs.append([corner[0] / self.tile_width, corner[1] / self.exposure])
                
                base = v_index * 4
                faces.append([base, base + 1, base + 2])
                faces.append([base, base + 2, base + 3])
                v_index += 1
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        normals = np.tile(self.roof_plane.normal, (len(vertices), 1))
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'slate_tiles', 'pattern': self.pattern}
        )


class WoodShingles(RoofCovering):
    """Wood shingles or shakes"""
    
    def __init__(self, roof_plane: RoofPlane,
                 color: Tuple[float, float, float] = (0.45, 0.35, 0.25),
                 shingle_width: float = 0.127,  # 5 inches average
                 exposure: float = 0.127,  # 5 inches
                 shingle_type: str = 'shingle',  # shingle or shake
                 weathering: float = 0.3):
        
        # Weathered wood is grayer
        if weathering > 0:
            gray_factor = weathering * 0.5
            color = tuple(c * (1 - gray_factor) + gray_factor * 0.5 for c in color)
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.9,
            metalness=0.0,
            bump_strength=0.008 if shingle_type == 'shake' else 0.004
        )
        super().__init__(roof_plane, material)
        
        self.shingle_width = shingle_width
        self.exposure = exposure
        self.shingle_type = shingle_type
        self.weathering = weathering
    
    def generate(self) -> MeshData:
        """Generate wood shingle/shake mesh with irregular pattern"""
        vertices = []
        faces = []
        uvs = []
        
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        length = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        n_rows = int(np.ceil(length / self.exposure)) + 2
        
        v_index = 0
        for row in range(n_rows):
            y_offset = row * self.exposure
            x_current = 0
            
            while x_current < width + self.shingle_width:
                # Random width variation for natural look
                width_var = np.random.uniform(0.7, 1.3)
                shingle_w = self.shingle_width * width_var
                
                # Shakes have more height variation
                if self.shingle_type == 'shake':
                    z_var = np.random.uniform(-0.003, 0.003)
                else:
                    z_var = np.random.uniform(-0.001, 0.001)
                
                # Random length variation
                length_var = np.random.uniform(0.95, 1.05)
                shingle_l = self.exposure * 3 * length_var  # Typical shingle length
                
                corners = [
                    [x_current, y_offset, z_var],
                    [x_current + shingle_w, y_offset, z_var],
                    [x_current + shingle_w, y_offset + shingle_l, z_var],
                    [x_current, y_offset + shingle_l, z_var]
                ]
                
                for corner in corners:
                    pt = min_pt + np.array(corner)
                    vertices.append(pt)
                    uvs.append([corner[0] / self.shingle_width, corner[1] / self.exposure])
                
                base = v_index * 4
                faces.append([base, base + 1, base + 2])
                faces.append([base, base + 2, base + 3])
                v_index += 1
                
                x_current += shingle_w
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        normals = np.tile(self.roof_plane.normal, (len(vertices), 1))
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'wood_shingles', 'shingle_type': self.shingle_type}
        )


class GreenRoof(RoofCovering):
    """Vegetated green roof system"""
    
    def __init__(self, roof_plane: RoofPlane,
                 vegetation_type: str = 'sedum',  # sedum, grass, mixed
                 coverage: float = 0.85,
                 growth_height: float = 0.05,
                 substrate_depth: float = 0.10):
        
        # Base colors for different vegetation
        veg_colors = {
            'sedum': (0.3, 0.5, 0.3),
            'grass': (0.25, 0.55, 0.25),
            'mixed': (0.35, 0.5, 0.3)
        }
        
        material = MaterialProperties(
            diffuse_color=veg_colors.get(vegetation_type, (0.3, 0.5, 0.3)),
            roughness=0.95,
            metalness=0.0,
            bump_strength=0.015
        )
        super().__init__(roof_plane, material)
        
        self.vegetation_type = vegetation_type
        self.coverage = coverage
        self.growth_height = growth_height
        self.substrate_depth = substrate_depth
    
    def generate(self) -> MeshData:
        """Generate green roof mesh with vegetation texture"""
        vertices = []
        faces = []
        uvs = []
        
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        # Create substrate layer
        substrate_verts = plane_verts.copy()
        
        # Create base grid for vegetation
        grid_size = 0.2  # 20cm grid
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        length = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        n_x = int(width / grid_size) + 1
        n_y = int(length / grid_size) + 1
        
        for i in range(n_y):
            for j in range(n_x):
                x = (j / (n_x - 1)) * width
                y = (i / (n_y - 1)) * length
                
                # Random coverage gaps
                if np.random.random() > self.coverage:
                    z = self.substrate_depth
                else:
                    z = self.substrate_depth + np.random.uniform(0, self.growth_height)
                
                pt = min_pt + np.array([x, y, z])
                vertices.append(pt)
                uvs.append([x / width, y / length])
        
        # Create faces
        for i in range(n_y - 1):
            for j in range(n_x - 1):
                v1 = i * n_x + j
                v2 = v1 + 1
                v3 = (i + 1) * n_x + j
                v4 = v3 + 1
                
                faces.append([v1, v2, v4])
                faces.append([v1, v4, v3])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        
        # Compute varied normals for organic look
        normals = []
        for v in vertices:
            normal = self.roof_plane.normal + np.random.uniform(-0.1, 0.1, 3)
            normal = normal / np.linalg.norm(normal)
            normals.append(normal)
        normals = np.array(normals)
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'green_roof', 'vegetation': self.vegetation_type}
        )


class SolarPanelArray(RoofCovering):
    """Solar photovoltaic panel array on roof"""
    
    def __init__(self, roof_plane: RoofPlane,
                 panel_width: float = 1.0,  # 1m standard
                 panel_height: float = 1.65,  # 1.65m standard
                 spacing: float = 0.02,  # 20mm gap
                 tilt_angle: float = 0.0,  # Additional tilt in degrees
                 color: Tuple[float, float, float] = (0.1, 0.15, 0.25),
                 efficiency_class: str = 'monocrystalline'):
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.1,
            metalness=0.3,
            specular=0.8
        )
        super().__init__(roof_plane, material)
        
        self.panel_width = panel_width
        self.panel_height = panel_height
        self.spacing = spacing
        self.tilt_angle = tilt_angle
        self.efficiency_class = efficiency_class
    
    def generate(self) -> MeshData:
        """Generate solar panel array mesh"""
        vertices = []
        faces = []
        uvs = []
        
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        length = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        # Calculate array layout
        n_cols = int(width / (self.panel_width + self.spacing))
        n_rows = int(length / (self.panel_height + self.spacing))
        
        # Standoff height
        standoff = 0.15
        
        # Additional tilt rotation
        tilt_rad = np.radians(self.tilt_angle)
        
        for row in range(n_rows):
            for col in range(n_cols):
                x_start = col * (self.panel_width + self.spacing)
                y_start = row * (self.panel_height + self.spacing)
                
                # Panel corners at base
                panel_corners = [
                    [x_start, y_start, standoff],
                    [x_start + self.panel_width, y_start, standoff],
                    [x_start + self.panel_width, y_start + self.panel_height, 
                     standoff + self.panel_height * np.sin(tilt_rad)],
                    [x_start, y_start + self.panel_height, 
                     standoff + self.panel_height * np.sin(tilt_rad)]
                ]
                
                base = len(vertices)
                for corner in panel_corners:
                    pt = min_pt + np.array(corner)
                    vertices.append(pt)
                    uvs.append([corner[0] / self.panel_width, corner[1] / self.panel_height])
                
                # Panel face
                faces.append([base, base + 1, base + 2])
                faces.append([base, base + 2, base + 3])
                
                # Frame edges (simplified)
                frame_thickness = 0.04
                frame_depth = 0.04
                
                # Add frame vertices (just top edges for performance)
                for i in range(4):
                    j = (i + 1) % 4
                    edge_start = np.array(panel_corners[i])
                    edge_end = np.array(panel_corners[j])
                    
                    # Simplified frame extrusion
                    offset = np.array([0, 0, -frame_depth])
                    
                    frame_base = len(vertices)
                    vertices.append(min_pt + edge_start)
                    vertices.append(min_pt + edge_end)
                    vertices.append(min_pt + edge_end + offset)
                    vertices.append(min_pt + edge_start + offset)
                    
                    for k in range(4):
                        uvs.append([0, 0])
                    
                    faces.append([frame_base, frame_base + 1, frame_base + 2])
                    faces.append([frame_base, frame_base + 2, frame_base + 3])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        
        # Compute normals
        normals = []
        for i in range(len(vertices)):
            if i % 8 < 4:  # Panel surface
                normal = np.array([0, -np.sin(tilt_rad), np.cos(tilt_rad)])
            else:  # Frame
                normal = self.roof_plane.normal
            normals.append(normal)
        normals = np.array(normals)
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'solar_panels', 'efficiency': self.efficiency_class}
        )


class MembraneRoofing(RoofCovering):
    """Single-ply membrane roofing (EPDM, TPO, PVC)"""
    
    def __init__(self, roof_plane: RoofPlane,
                 membrane_type: str = 'TPO',  # EPDM, TPO, PVC
                 color: Tuple[float, float, float] = (0.9, 0.9, 0.9),
                 seam_width: float = 0.15,
                 seam_spacing: float = 1.5,
                 ballast: bool = False):
        
        # Membrane colors
        if membrane_type == 'EPDM':
            color = (0.1, 0.1, 0.1)  # Black
        elif membrane_type == 'TPO':
            color = (0.9, 0.9, 0.9)  # White
        elif membrane_type == 'PVC':
            color = (0.85, 0.85, 0.85)  # Light gray
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.6,
            metalness=0.0,
            specular=0.2
        )
        super().__init__(roof_plane, material)
        
        self.membrane_type = membrane_type
        self.seam_width = seam_width
        self.seam_spacing = seam_spacing
        self.ballast = ballast
    
    def generate(self) -> MeshData:
        """Generate membrane roofing mesh with seams"""
        vertices = []
        faces = []
        uvs = []
        
        plane_verts = self.roof_plane.vertices
        min_pt = np.min(plane_verts, axis=0)
        max_pt = np.max(plane_verts, axis=0)
        
        width = np.linalg.norm(max_pt[:2] - min_pt[:2])
        length = np.linalg.norm([max_pt[0] - min_pt[0], max_pt[1] - min_pt[1]])
        
        # Base membrane
        grid_res = 0.5
        n_x = int(width / grid_res) + 1
        n_y = int(length / grid_res) + 1
        
        for i in range(n_y):
            for j in range(n_x):
                x = (j / (n_x - 1)) * width
                y = (i / (n_y - 1)) * length
                
                # Slight elevation for seams
                z = 0
                if abs(x % self.seam_spacing) < self.seam_width / 2:
                    z = 0.002  # Raised seam
                
                pt = min_pt + np.array([x, y, z])
                vertices.append(pt)
                uvs.append([x / width, y / length])
        
        # Create faces
        for i in range(n_y - 1):
            for j in range(n_x - 1):
                v1 = i * n_x + j
                v2 = v1 + 1
                v3 = (i + 1) * n_x + j
                v4 = v3 + 1
                
                faces.append([v1, v2, v4])
                faces.append([v1, v4, v3])
        
        # Add ballast stones if specified
        if self.ballast:
            n_stones = int((width * length) / 0.25)
            for _ in range(n_stones):
                x = np.random.uniform(0, width)
                y = np.random.uniform(0, length)
                stone_size = np.random.uniform(0.03, 0.08)
                
                # Simple stone representation
                stone_center = min_pt + np.array([x, y, stone_size / 2])
                vertices.append(stone_center)
                uvs.append([x / width, y / length])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        normals = np.tile(self.roof_plane.normal, (len(vertices), 1))
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'membrane', 'membrane_type': self.membrane_type}
        )


# ============================================================================
# RAINWATER GOODS
# ============================================================================

class GutterSystem:
    """Base class for gutter systems"""
    
    def __init__(self, edge_path: np.ndarray, 
                 material: MaterialProperties,
                 flow_direction: str = 'left'):
        self.edge_path = edge_path
        self.material = material
        self.flow_direction = flow_direction
    
    def generate(self) -> MeshData:
        """Generate gutter mesh"""
        raise NotImplementedError


class KStyleGutter(GutterSystem):
    """K-style (ogee) residential gutter"""
    
    def __init__(self, edge_path: np.ndarray,
                 color: Tuple[float, float, float] = (0.9, 0.9, 0.9),
                 width: float = 0.127,  # 5 inches
                 depth: float = 0.102,  # 4 inches
                 material_type: str = 'aluminum',
                 flow_direction: str = 'left'):
        
        metalness = 0.7 if material_type == 'aluminum' else 0.0
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=metalness,
            specular=0.6
        )
        super().__init__(edge_path, material, flow_direction)
        
        self.width = width
        self.depth = depth
        self.material_type = material_type
    
    def generate(self) -> MeshData:
        """Generate K-style gutter profile"""
        # K-style profile (simplified ogee curve)
        profile = np.array([
            [0, 0],
            [self.width * 0.15, -self.depth * 0.2],
            [self.width * 0.3, -self.depth * 0.5],
            [self.width * 0.5, -self.depth * 0.85],
            [self.width * 0.7, -self.depth],
            [self.width * 0.85, -self.depth * 0.9],
            [self.width, -self.depth * 0.7],
            [self.width, 0]
        ])
        
        vertices, faces = extrude_profile(self.edge_path, profile)
        
        # Generate UVs
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.edge_path)):
            for j in range(n_profile):
                u = i / (len(self.edge_path) - 1)
                v = j / (n_profile - 1)
                uvs.append([u, v])
        uvs = np.array(uvs)
        
        # Compute normals
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        # Normalize
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'k_style_gutter', 'width': self.width}
        )


class BoxGutter(GutterSystem):
    """Built-in box gutter (parapet or valley)"""
    
    def __init__(self, edge_path: np.ndarray,
                 color: Tuple[float, float, float] = (0.6, 0.6, 0.65),
                 width: float = 0.3,
                 depth: float = 0.15,
                 material_type: str = 'steel',
                 lining: str = 'painted',
                 flow_direction: str = 'left'):
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=0.7,
            specular=0.6
        )
        super().__init__(edge_path, material, flow_direction)
        
        self.width = width
        self.depth = depth
        self.material_type = material_type
        self.lining = lining
    
    def generate(self) -> MeshData:
        """Generate box gutter profile"""
        # Rectangular box profile
        profile = np.array([
            [0, 0],
            [0, -self.depth],
            [self.width, -self.depth],
            [self.width, 0]
        ])
        
        vertices, faces = extrude_profile(self.edge_path, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.edge_path)):
            for j in range(n_profile):
                uvs.append([i / len(self.edge_path), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'box_gutter', 'width': self.width}
        )


class HalfRoundGutter(GutterSystem):
    """Half-round traditional gutter"""
    
    def __init__(self, edge_path: np.ndarray,
                 color: Tuple[float, float, float] = (0.72, 0.45, 0.2),
                 diameter: float = 0.127,  # 5 inches
                 material_type: str = 'copper',
                 flow_direction: str = 'left'):
        
        metalness = 0.9 if material_type == 'copper' else 0.7
        
        material = MaterialProperties(
            diffuse_color=color,
            roughness=0.2,
            metalness=metalness,
            specular=0.8
        )
        super().__init__(edge_path, material, flow_direction)
        
        self.diameter = diameter
        self.material_type = material_type
    
    def generate(self) -> MeshData:
        """Generate half-round gutter profile"""
        # Semi-circular profile
        n_segments = 16
        profile = []
        radius = self.diameter / 2
        
        for i in range(n_segments + 1):
            angle = np.pi * (i / n_segments)
            x = radius * np.cos(angle)
            y = -radius * np.sin(angle)
            profile.append([x + radius, y])
        
        profile = np.array(profile)
        
        vertices, faces = extrude_profile(self.edge_path, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.edge_path)):
            for j in range(n_profile):
                uvs.append([i / len(self.edge_path), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'half_round_gutter', 'diameter': self.diameter}
        )


class Downpipe:
    """Rainwater downpipe/leader"""
    
    def __init__(self, path: np.ndarray,
                 color: Tuple[float, float, float] = (0.9, 0.9, 0.9),
                 diameter: float = 0.076,  # 3 inches
                 shape: str = 'round',  # round or square
                 material_type: str = 'aluminum'):
        
        metalness = 0.7 if material_type in ['aluminum', 'steel'] else 0.9
        
        self.path = path
        self.diameter = diameter
        self.shape = shape
        self.material_type = material_type
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=metalness,
            specular=0.6
        )
    
    def generate(self) -> MeshData:
        """Generate downpipe mesh"""
        if self.shape == 'round':
            profile = self._round_profile()
        else:
            profile = self._square_profile()
        
        vertices, faces = extrude_profile(self.path, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.path)):
            for j in range(n_profile):
                uvs.append([i / len(self.path), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'downpipe', 'shape': self.shape}
        )
    
    def _round_profile(self) -> np.ndarray:
        """Generate circular profile"""
        n_segments = 12
        profile = []
        radius = self.diameter / 2
        
        for i in range(n_segments):
            angle = 2 * np.pi * (i / n_segments)
            x = radius * np.cos(angle)
            y = radius * np.sin(angle)
            profile.append([x, y])
        
        return np.array(profile)
    
    def _square_profile(self) -> np.ndarray:
        """Generate square profile"""
        half = self.diameter / 2
        return np.array([
            [-half, -half],
            [half, -half],
            [half, half],
            [-half, half]
        ])


class Scupper:
    """Roof scupper drain outlet"""
    
    def __init__(self, position: np.ndarray,
                 orientation: np.ndarray,
                 color: Tuple[float, float, float] = (0.6, 0.6, 0.65),
                 width: float = 0.15,
                 height: float = 0.10,
                 depth: float = 0.20,
                 material_type: str = 'steel'):
        
        self.position = position
        self.orientation = orientation
        self.width = width
        self.height = height
        self.depth = depth
        self.material_type = material_type
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=0.7,
            specular=0.6
        )
    
    def generate(self) -> MeshData:
        """Generate scupper mesh"""
        # Create box-shaped scupper
        half_w = self.width / 2
        
        vertices = np.array([
            # Front face
            [-half_w, 0, 0],
            [half_w, 0, 0],
            [half_w, 0, self.height],
            [-half_w, 0, self.height],
            # Back face
            [-half_w, -self.depth, 0],
            [half_w, -self.depth, 0],
            [half_w, -self.depth, self.height],
            [-half_w, -self.depth, self.height]
        ])
        
        # Translate to position
        vertices = vertices + self.position
        
        faces = np.array([
            [0, 1, 2], [0, 2, 3],  # Front
            [5, 4, 7], [5, 7, 6],  # Back
            [4, 0, 3], [4, 3, 7],  # Left
            [1, 5, 6], [1, 6, 2],  # Right
            [3, 2, 6], [3, 6, 7],  # Top
            [4, 5, 1], [4, 1, 0]   # Bottom
        ])
        
        uvs = np.array([[0, 0]] * len(vertices))
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'scupper', 'width': self.width}
        )


class GutterGuard:
    """Gutter guard/leaf screen"""
    
    def __init__(self, gutter_path: np.ndarray,
                 gutter_width: float,
                 color: Tuple[float, float, float] = (0.3, 0.3, 0.3),
                 guard_type: str = 'mesh',  # mesh, solid, louvered
                 perforation_ratio: float = 0.5):
        
        self.gutter_path = gutter_path
        self.gutter_width = gutter_width
        self.guard_type = guard_type
        self.perforation_ratio = perforation_ratio
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.4,
            metalness=0.6,
            specular=0.5
        )
    
    def generate(self) -> MeshData:
        """Generate gutter guard mesh"""
        vertices = []
        faces = []
        uvs = []
        
        # Simple flat guard over gutter opening
        for i, point in enumerate(self.gutter_path):
            # Two points per path point (left and right edge)
            left = point + np.array([0, 0, 0.01])
            right = point + np.array([self.gutter_width, 0, 0.01])
            
            vertices.extend([left, right])
            uvs.extend([[i / len(self.gutter_path), 0], 
                       [i / len(self.gutter_path), 1]])
        
        # Create faces
        for i in range(len(self.gutter_path) - 1):
            v1 = i * 2
            v2 = v1 + 1
            v3 = (i + 1) * 2
            v4 = v3 + 1
            
            faces.append([v1, v2, v4])
            faces.append([v1, v4, v3])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        normals = np.tile([0, 0, 1], (len(vertices), 1))
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'gutter_guard', 'guard_type': self.guard_type}
        )


# ============================================================================
# EAVES & ROOF EDGE DETAILS
# ============================================================================

class FasciaBoard:
    """Fascia board at roof edge"""
    
    def __init__(self, edge_path: np.ndarray,
                 color: Tuple[float, float, float] = (0.95, 0.95, 0.95),
                 height: float = 0.203,  # 8 inches
                 thickness: float = 0.019,  # 0.75 inches
                 profile_type: str = 'square',  # square, ogee, beveled
                 material_type: str = 'wood'):
        
        self.edge_path = edge_path
        self.height = height
        self.thickness = thickness
        self.profile_type = profile_type
        self.material_type = material_type
        
        metalness = 0.0 if material_type == 'wood' else 0.7
        roughness = 0.6 if material_type == 'wood' else 0.3
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=roughness,
            metalness=metalness,
            specular=0.3
        )
    
    def generate(self) -> MeshData:
        """Generate fascia board mesh"""
        if self.profile_type == 'square':
            profile = self._square_profile()
        elif self.profile_type == 'ogee':
            profile = self._ogee_profile()
        else:
            profile = self._beveled_profile()
        
        vertices, faces = extrude_profile(self.edge_path, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.edge_path)):
            for j in range(n_profile):
                uvs.append([i / len(self.edge_path), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'fascia', 'profile': self.profile_type}
        )
    
    def _square_profile(self) -> np.ndarray:
        """Simple rectangular profile"""
        return np.array([
            [0, 0],
            [0, -self.height],
            [-self.thickness, -self.height],
            [-self.thickness, 0]
        ])
    
    def _ogee_profile(self) -> np.ndarray:
        """Decorative ogee/crown profile"""
        points = []
        n_curve = 8
        
        # Top curve
        for i in range(n_curve):
            t = i / (n_curve - 1)
            x = -self.thickness * (0.3 + 0.2 * np.sin(t * np.pi))
            y = -t * self.height * 0.2
            points.append([x, y])
        
        # Straight section
        points.append([-self.thickness * 0.5, -self.height * 0.5])
        
        # Bottom curve
        for i in range(n_curve):
            t = i / (n_curve - 1)
            x = -self.thickness * (0.5 - 0.3 * np.sin(t * np.pi))
            y = -self.height * (0.5 + 0.5 * t)
            points.append([x, y])
        
        return np.array(points)
    
    def _beveled_profile(self) -> np.ndarray:
        """Beveled edge profile"""
        bevel = self.thickness * 0.3
        return np.array([
            [0, 0],
            [-bevel, -bevel],
            [-self.thickness, -self.height + bevel],
            [-self.thickness, -self.height],
            [0, -self.height],
            [0, 0]
        ])


class SoffitPanel:
    """Soffit panel under eave overhang"""
    
    def __init__(self, eave_edge: np.ndarray,
                 wall_edge: np.ndarray,
                 color: Tuple[float, float, float] = (0.95, 0.95, 0.95),
                 vented: bool = True,
                 vent_spacing: float = 0.3,
                 material_type: str = 'vinyl'):
        
        self.eave_edge = eave_edge
        self.wall_edge = wall_edge
        self.vented = vented
        self.vent_spacing = vent_spacing
        self.material_type = material_type
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.4,
            metalness=0.0,
            specular=0.3
        )
    
    def generate(self) -> MeshData:
        """Generate soffit panel mesh"""
        vertices = []
        faces = []
        uvs = []
        
        # Interpolate between eave and wall edges
        n_points = max(len(self.eave_edge), len(self.wall_edge))
        
        for i in range(n_points):
            # Get corresponding points on both edges
            t = i / (n_points - 1)
            
            eave_idx = min(int(t * (len(self.eave_edge) - 1)), len(self.eave_edge) - 1)
            wall_idx = min(int(t * (len(self.wall_edge) - 1)), len(self.wall_edge) - 1)
            
            eave_pt = self.eave_edge[eave_idx]
            wall_pt = self.wall_edge[wall_idx]
            
            vertices.extend([eave_pt, wall_pt])
            uvs.extend([[t, 0], [t, 1]])
        
        # Create faces
        for i in range(n_points - 1):
            v1 = i * 2
            v2 = v1 + 1
            v3 = (i + 1) * 2
            v4 = v3 + 1
            
            faces.append([v1, v2, v4])
            faces.append([v1, v4, v3])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        
        # Compute normals
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'soffit', 'vented': self.vented}
        )


class Bargeboard:
    """Bargeboard/vergeboard at gable end"""
    
    def __init__(self, rake_edge: np.ndarray,
                 color: Tuple[float, float, float] = (0.95, 0.95, 0.95),
                 width: float = 0.15,
                 thickness: float = 0.025,
                 decorative: bool = False,
                 material_type: str = 'wood'):
        
        self.rake_edge = rake_edge
        self.width = width
        self.thickness = thickness
        self.decorative = decorative
        self.material_type = material_type
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.6 if material_type == 'wood' else 0.3,
            metalness=0.0,
            specular=0.3
        )
    
    def generate(self) -> MeshData:
        """Generate bargeboard mesh"""
        if self.decorative:
            profile = self._decorative_profile()
        else:
            profile = self._simple_profile()
        
        vertices, faces = extrude_profile(self.rake_edge, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.rake_edge)):
            for j in range(n_profile):
                uvs.append([i / len(self.rake_edge), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'bargeboard', 'decorative': self.decorative}
        )
    
    def _simple_profile(self) -> np.ndarray:
        """Simple rectangular profile"""
        return np.array([
            [0, 0],
            [-self.thickness, 0],
            [-self.thickness, -self.width],
            [0, -self.width]
        ])
    
    def _decorative_profile(self) -> np.ndarray:
        """Decorative scalloped profile"""
        points = []
        n_scallops = 5
        
        for i in range(n_scallops + 1):
            t = i / n_scallops
            y = -t * self.width
            x = -self.thickness * (0.5 + 0.5 * np.sin(t * np.pi * n_scallops))
            points.append([x, y])
        
        return np.array(points)


class DripEdge:
    """Drip edge flashing at roof perimeter"""
    
    def __init__(self, edge_path: np.ndarray,
                 color: Tuple[float, float, float] = (0.6, 0.6, 0.65),
                 width: float = 0.076,  # 3 inches
                 drip_projection: float = 0.025,
                 material_type: str = 'aluminum'):
        
        self.edge_path = edge_path
        self.width = width
        self.drip_projection = drip_projection
        self.material_type = material_type
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=0.7,
            specular=0.6
        )
    
    def generate(self) -> MeshData:
        """Generate drip edge mesh"""
        # L-shaped profile with drip hem
        profile = np.array([
            [0, 0],
            [0, -0.002],
            [self.width, -0.002],
            [self.width, -self.width],
            [self.width + self.drip_projection, -self.width - self.drip_projection],
            [self.width + self.drip_projection, -self.width - self.drip_projection - 0.01]
        ])
        
        vertices, faces = extrude_profile(self.edge_path, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.edge_path)):
            for j in range(n_profile):
                uvs.append([i / len(self.edge_path), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'drip_edge', 'width': self.width}
        )


class CorniceProfile:
    """Decorative cornice molding"""
    
    def __init__(self, edge_path: np.ndarray,
                 color: Tuple[float, float, float] = (0.95, 0.95, 0.95),
                 height: float = 0.3,
                 projection: float = 0.2,
                 style: str = 'classical',  # classical, modern, simple
                 material_type: str = 'wood'):
        
        self.edge_path = edge_path
        self.height = height
        self.projection = projection
        self.style = style
        self.material_type = material_type
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.5,
            metalness=0.0,
            specular=0.3
        )
    
    def generate(self) -> MeshData:
        """Generate cornice profile mesh"""
        if self.style == 'classical':
            profile = self._classical_profile()
        elif self.style == 'modern':
            profile = self._modern_profile()
        else:
            profile = self._simple_profile()
        
        vertices, faces = extrude_profile(self.edge_path, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.edge_path)):
            for j in range(n_profile):
                uvs.append([i / len(self.edge_path), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'cornice', 'style': self.style}
        )
    
    def _classical_profile(self) -> np.ndarray:
        """Classical Greek/Roman cornice with cyma recta"""
        points = []
        n_curve = 12
        
        # Corona projection
        points.append([0, 0])
        points.append([-self.projection * 0.3, 0])
        
        # Cyma recta curve
        for i in range(n_curve):
            t = i / (n_curve - 1)
            x = -self.projection * (0.3 + 0.7 * (1 - np.cos(t * np.pi / 2)))
            y = -self.height * 0.3 * t
            points.append([x, y])
        
        # Fascia band
        points.append([-self.projection, -self.height * 0.5])
        
        # Cavetto curve
        for i in range(n_curve):
            t = i / (n_curve - 1)
            x = -self.projection * (1 - 0.2 * np.sin(t * np.pi / 2))
            y = -self.height * (0.5 + 0.3 * t)
            points.append([x, y])
        
        # Back to wall
        points.append([0, -self.height])
        
        return np.array(points)
    
    def _modern_profile(self) -> np.ndarray:
        """Clean modern stepped profile"""
        return np.array([
            [0, 0],
            [-self.projection * 0.5, 0],
            [-self.projection * 0.5, -self.height * 0.4],
            [-self.projection, -self.height * 0.4],
            [-self.projection, -self.height],
            [0, -self.height]
        ])
    
    def _simple_profile(self) -> np.ndarray:
        """Simple angled cornice"""
        return np.array([
            [0, 0],
            [-self.projection, -self.height * 0.5],
            [-self.projection * 0.5, -self.height],
            [0, -self.height]
        ])


class RakeTrim:
    """Rake trim at gable edge"""
    
    def __init__(self, rake_edge: np.ndarray,
                 color: Tuple[float, float, float] = (0.95, 0.95, 0.95),
                 width: float = 0.1,
                 thickness: float = 0.02,
                 overhang: float = 0.05,
                 material_type: str = 'wood'):
        
        self.rake_edge = rake_edge
        self.width = width
        self.thickness = thickness
        self.overhang = overhang
        self.material_type = material_type
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.6,
            metalness=0.0,
            specular=0.3
        )
    
    def generate(self) -> MeshData:
        """Generate rake trim mesh"""
        # L-shaped profile
        profile = np.array([
            [0, 0],
            [-self.thickness, 0],
            [-self.thickness, -self.width],
            [-self.thickness - self.overhang, -self.width],
            [-self.thickness - self.overhang, -self.width - self.thickness],
            [0, -self.width - self.thickness]
        ])
        
        vertices, faces = extrude_profile(self.rake_edge, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.rake_edge)):
            for j in range(n_profile):
                uvs.append([i / len(self.rake_edge), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'rake_trim', 'width': self.width}
        )


# ============================================================================
# FLASHING & PENETRATIONS
# ============================================================================

class ValleyFlashing:
    """Valley flashing where two roof planes meet"""
    
    def __init__(self, valley_path: np.ndarray,
                 color: Tuple[float, float, float] = (0.6, 0.6, 0.65),
                 width: float = 0.6,  # 24 inches total
                 valley_type: str = 'closed',  # open, closed, woven
                 material_type: str = 'aluminum'):
        
        self.valley_path = valley_path
        self.width = width
        self.valley_type = valley_type
        self.material_type = material_type
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=0.7,
            specular=0.6
        )
    
    def generate(self) -> MeshData:
        """Generate valley flashing mesh"""
        # V-shaped or W-shaped profile
        half_width = self.width / 2
        
        if self.valley_type == 'open':
            # V-crimp in center
            profile = np.array([
                [-half_width, 0],
                [-0.05, -0.025],
                [0, -0.03],
                [0.05, -0.025],
                [half_width, 0]
            ])
        else:  # closed valley
            # Flatter profile
            profile = np.array([
                [-half_width, 0],
                [-0.1, -0.01],
                [0.1, -0.01],
                [half_width, 0]
            ])
        
        vertices, faces = extrude_profile(self.valley_path, profile)
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.valley_path)):
            for j in range(n_profile):
                uvs.append([i / len(self.valley_path), j / n_profile])
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'valley_flashing', 'valley_type': self.valley_type}
        )


class ChimneyFlashing:
    """Step and counter flashing around chimney"""
    
    def __init__(self, chimney_position: np.ndarray,
                 chimney_dimensions: Tuple[float, float, float],
                 roof_pitch: float,
                 color: Tuple[float, float, float] = (0.6, 0.6, 0.65),
                 material_type: str = 'copper'):
        
        self.chimney_position = chimney_position
        self.chimney_dimensions = chimney_dimensions  # (width, depth, height)
        self.roof_pitch = roof_pitch
        self.material_type = material_type
        
        metalness = 0.9 if material_type == 'copper' else 0.7
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.2,
            metalness=metalness,
            specular=0.8
        )
    
    def generate(self) -> MeshData:
        """Generate chimney flashing mesh"""
        vertices = []
        faces = []
        uvs = []
        
        width, depth, height = self.chimney_dimensions
        step_height = 0.15  # 6 inches
        step_overlap = 0.1  # 4 inches
        flashing_width = 0.15
        
        # Front apron
        front_apron = [
            self.chimney_position + np.array([-0.1, -0.1, 0]),
            self.chimney_position + np.array([width + 0.1, -0.1, 0]),
            self.chimney_position + np.array([width + 0.1, 0, step_height]),
            self.chimney_position + np.array([-0.1, 0, step_height])
        ]
        
        base = len(vertices)
        for v in front_apron:
            vertices.append(v)
            uvs.append([0, 0])
        
        faces.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])
        
        # Step flashing on sides
        n_steps = int(depth / step_overlap) + 1
        
        for side in [-0.1, width + 0.1]:
            for i in range(n_steps):
                y_offset = i * step_overlap
                z_offset = i * step_height * np.tan(np.radians(self.roof_pitch))
                
                step = [
                    self.chimney_position + np.array([side, y_offset, z_offset]),
                    self.chimney_position + np.array([side - (0.05 if side < 0 else -0.05), 
                                                      y_offset, z_offset]),
                    self.chimney_position + np.array([side - (0.05 if side < 0 else -0.05), 
                                                      y_offset + step_overlap, 
                                                      z_offset + step_height]),
                    self.chimney_position + np.array([side, y_offset + step_overlap, 
                                                      z_offset + step_height])
                ]
                
                base = len(vertices)
                for v in step:
                    vertices.append(v)
                    uvs.append([0, 0])
                
                faces.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])
        
        # Back cricket/saddle (simplified)
        cricket_vertices = [
            self.chimney_position + np.array([width/2, depth, height * 0.5]),
            self.chimney_position + np.array([-0.1, depth + 0.3, 0]),
            self.chimney_position + np.array([width + 0.1, depth + 0.3, 0])
        ]
        
        base = len(vertices)
        for v in cricket_vertices:
            vertices.append(v)
            uvs.append([0, 0])
        
        faces.append([base, base + 1, base + 2])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'chimney_flashing', 'material': self.material_type}
        )


class SkylightFlashing:
    """Curb and flashing for skylight"""
    
    def __init__(self, skylight_position: np.ndarray,
                 skylight_dimensions: Tuple[float, float],
                 roof_pitch: float,
                 color: Tuple[float, float, float] = (0.6, 0.6, 0.65),
                 curb_height: float = 0.15,
                 material_type: str = 'aluminum'):
        
        self.skylight_position = skylight_position
        self.skylight_dimensions = skylight_dimensions  # (width, length)
        self.roof_pitch = roof_pitch
        self.curb_height = curb_height
        self.material_type = material_type
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=0.7,
            specular=0.6
        )
    
    def generate(self) -> MeshData:
        """Generate skylight curb and flashing mesh"""
        vertices = []
        faces = []
        uvs = []
        
        width, length = self.skylight_dimensions
        pitch_rad = np.radians(self.roof_pitch)
        
        # Curb base rectangle
        curb_base = [
            self.skylight_position,
            self.skylight_position + np.array([width, 0, 0]),
            self.skylight_position + np.array([width, length, length * np.tan(pitch_rad)]),
            self.skylight_position + np.array([0, length, length * np.tan(pitch_rad)])
        ]
        
        # Curb top (raised)
        curb_top = [pt + np.array([0, 0, self.curb_height]) for pt in curb_base]
        
        # Create curb sides
        for i in range(4):
            j = (i + 1) % 4
            
            # Outer face
            quad = [curb_base[i], curb_base[j], curb_top[j], curb_top[i]]
            base = len(vertices)
            for v in quad:
                vertices.append(v)
                uvs.append([0, 0])
            
            faces.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])
        
        # Base flashing extending beyond curb
        flashing_ext = 0.15
        
        for i in range(4):
            j = (i + 1) % 4
            
            # Calculate outward normal for this edge
            edge = curb_base[j] - curb_base[i]
            center = (curb_base[i] + curb_base[j]) / 2
            to_center = np.mean(curb_base, axis=0) - center
            outward = np.cross(edge, np.array([0, 0, 1]))
            outward = -outward / np.linalg.norm(outward) * flashing_ext
            
            flash_outer = [
                curb_base[i] + outward,
                curb_base[j] + outward
            ]
            
            base = len(vertices)
            vertices.extend([curb_base[i], curb_base[j], flash_outer[1], flash_outer[0]])
            uvs.extend([[0, 0]] * 4)
            
            faces.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'skylight_flashing', 'curb_height': self.curb_height}
        )


class RoofToWallFlashing:
    """Flashing where roof meets vertical wall"""
    
    def __init__(self, wall_edge: np.ndarray,
                 color: Tuple[float, float, float] = (0.6, 0.6, 0.65),
                 height: float = 0.2,  # 8 inches up wall
                 roof_coverage: float = 0.15,  # 6 inches on roof
                 counter_flashing: bool = True,
                 material_type: str = 'aluminum'):
        
        self.wall_edge = wall_edge
        self.height = height
        self.roof_coverage = roof_coverage
        self.counter_flashing = counter_flashing
        self.material_type = material_type
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.3,
            metalness=0.7,
            specular=0.6
        )
    
    def generate(self) -> MeshData:
        """Generate roof-to-wall flashing mesh"""
        # L-shaped profile
        profile = np.array([
            [0, 0],
            [self.roof_coverage, 0],
            [self.roof_coverage, -0.002],
            [0.02, -0.002],
            [0.02, self.height],
            [0, self.height]
        ])
        
        vertices, faces = extrude_profile(self.wall_edge, profile, up_vector=np.array([0, 0, 1]))
        
        uvs = []
        n_profile = len(profile)
        for i in range(len(self.wall_edge)):
            for j in range(n_profile):
                uvs.append([i / len(self.wall_edge), j / n_profile])
        uvs = np.array(uvs)
        
        # Add counter flashing if specified
        if self.counter_flashing:
            counter_profile = np.array([
                [0, self.height - 0.05],
                [0.05, self.height - 0.05],
                [0.05, self.height],
                [0, self.height]
            ])
            
            counter_verts, counter_faces = extrude_profile(
                self.wall_edge, counter_profile, up_vector=np.array([0, 0, 1])
            )
            
            # Offset face indices
            counter_faces += len(vertices)
            
            vertices = np.vstack([vertices, counter_verts])
            faces = np.vstack([faces, counter_faces])
            
            for i in range(len(counter_verts)):
                uvs = np.vstack([uvs, [[0, 0]]])
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'wall_flashing', 'counter_flashing': self.counter_flashing}
        )


class PipeBootFlashing:
    """Flashing boot for pipe penetration"""
    
    def __init__(self, pipe_position: np.ndarray,
                 pipe_diameter: float,
                 roof_pitch: float,
                 color: Tuple[float, float, float] = (0.1, 0.1, 0.1),
                 boot_type: str = 'rubber',  # rubber, lead, neoprene
                 flange_size: float = 0.3):
        
        self.pipe_position = pipe_position
        self.pipe_diameter = pipe_diameter
        self.roof_pitch = roof_pitch
        self.boot_type = boot_type
        self.flange_size = flange_size
        
        self.material = MaterialProperties(
            diffuse_color=color,
            roughness=0.7,
            metalness=0.0,
            specular=0.2
        )
    
    def generate(self) -> MeshData:
        """Generate pipe boot flashing mesh"""
        vertices = []
        faces = []
        uvs = []
        
        # Base flange
        n_segments = 16
        flange_radius = self.flange_size / 2
        
        for i in range(n_segments):
            angle = 2 * np.pi * (i / n_segments)
            x = flange_radius * np.cos(angle)
            y = flange_radius * np.sin(angle)
            
            vertices.append(self.pipe_position + np.array([x, y, 0]))
            uvs.append([0.5 + 0.5 * np.cos(angle), 0.5 + 0.5 * np.sin(angle)])
        
        # Create flange faces (fan triangulation)
        center_idx = len(vertices)
        vertices.append(self.pipe_position)
        uvs.append([0.5, 0.5])
        
        for i in range(n_segments):
            j = (i + 1) % n_segments
            faces.append([center_idx, i, j])
        
        # Boot collar rising up around pipe
        pipe_radius = self.pipe_diameter / 2
        boot_height = 0.15
        
        base_ring_start = len(vertices)
        for i in range(n_segments):
            angle = 2 * np.pi * (i / n_segments)
            x = pipe_radius * np.cos(angle)
            y = pipe_radius * np.sin(angle)
            
            # Bottom of collar
            vertices.append(self.pipe_position + np.array([x, y, 0.01]))
            uvs.append([i / n_segments, 0])
        
        # Top of collar
        top_ring_start = len(vertices)
        for i in range(n_segments):
            angle = 2 * np.pi * (i / n_segments)
            x = pipe_radius * 1.1 * np.cos(angle)  # Slight flare
            y = pipe_radius * 1.1 * np.sin(angle)
            
            vertices.append(self.pipe_position + np.array([x, y, boot_height]))
            uvs.append([i / n_segments, 1])
        
        # Create collar faces
        for i in range(n_segments):
            j = (i + 1) % n_segments
            
            v1 = base_ring_start + i
            v2 = base_ring_start + j
            v3 = top_ring_start + j
            v4 = top_ring_start + i
            
            faces.append([v1, v2, v3])
            faces.append([v1, v3, v4])
        
        vertices = np.array(vertices)
        faces = np.array(faces)
        uvs = np.array(uvs)
        
        normals = np.zeros_like(vertices)
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = compute_normal(v0, v1, v2)
            normals[face] += normal
        
        for i in range(len(normals)):
            norm = np.linalg.norm(normals[i])
            if norm > 0:
                normals[i] /= norm
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            uvs=uvs,
            material=self.material,
            metadata={'type': 'pipe_boot', 'boot_type': self.boot_type}
        )


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

def example_asphalt_shingles():
    """Example: Create asphalt shingle roof covering"""
    # Define simple roof plane
    roof_vertices = np.array([
        [0, 0, 0],
        [10, 0, 0],
        [10, 8, 2],
        [0, 8, 2]
    ])
    
    roof_plane = RoofPlane(
        vertices=roof_vertices,
        normal=np.array([0, -0.242, 0.970]),
        pitch_degrees=14,
        eave_edge=np.array([[0, 0, 0], [10, 0, 0]])
    )
    
    shingles = AsphaltShingles(
        roof_plane=roof_plane,
        color=(0.25, 0.25, 0.3),
        exposure=0.14
    )
    
    mesh = shingles.generate()
    return mesh.to_dict()


def example_standing_seam():
    """Example: Create metal standing seam roof"""
    roof_vertices = np.array([
        [0, 0, 0],
        [12, 0, 0],
        [12, 10, 3],
        [0, 10, 3]
    ])
    
    roof_plane = RoofPlane(
        vertices=roof_vertices,
        normal=np.array([0, -0.287, 0.958]),
        pitch_degrees=16.7,
        eave_edge=np.array([[0, 0, 0], [12, 0, 0]])
    )
    
    metal_roof = MetalStandingSeam(
        roof_plane=roof_plane,
        color=(0.7, 0.7, 0.72),
        panel_width=0.406,
        finish='galvalume'
    )
    
    mesh = metal_roof.generate()
    return mesh.to_dict()


def example_gutter_system():
    """Example: Create K-style gutter along eave"""
    eave_path = np.array([
        [0, 0, 0],
        [3, 0, 0],
        [6, 0, 0],
        [10, 0, 0]
    ])
    
    gutter = KStyleGutter(
        edge_path=eave_path,
        color=(0.95, 0.95, 0.95),
        width=0.127,
        depth=0.102,
        material_type='aluminum'
    )
    
    mesh = gutter.generate()
    return mesh.to_dict()


def example_downpipe():
    """Example: Create round downpipe"""
    pipe_path = np.array([
        [5, 0, 0],
        [5, 0, -0.5],
        [5, 0, -1.5],
        [5, 0, -2.5],
        [5, 0.3, -2.8],
        [5, 0.6, -3.0]
    ])
    
    downpipe = Downpipe(
        path=pipe_path,
        diameter=0.076,
        shape='round',
        material_type='aluminum'
    )
    
    mesh = downpipe.generate()
    return mesh.to_dict()


def example_fascia():
    """Example: Create fascia board"""
    fascia_edge = np.array([
        [0, 0, 0],
        [3, 0, 0],
        [6, 0, 0],
        [10, 0, 0]
    ])
    
    fascia = FasciaBoard(
        edge_path=fascia_edge,
        color=(0.98, 0.98, 0.98),
        height=0.203,
        profile_type='square',
        material_type='wood'
    )
    
    mesh = fascia.generate()
    return mesh.to_dict()


def example_valley_flashing():
    """Example: Create valley flashing"""
    valley_path = np.array([
        [5, 0, 2],
        [5, 2, 1.5],
        [5, 4, 1],
        [5, 6, 0.5],
        [5, 8, 0]
    ])
    
    valley = ValleyFlashing(
        valley_path=valley_path,
        width=0.6,
        valley_type='open',
        material_type='aluminum'
    )
    
    mesh = valley.generate()
    return mesh.to_dict()


def example_solar_panels():
    """Example: Create solar panel array"""
    roof_vertices = np.array([
        [0, 0, 0],
        [15, 0, 0],
        [15, 12, 3],
        [0, 12, 3]
    ])
    
    roof_plane = RoofPlane(
        vertices=roof_vertices,
        normal=np.array([0, -0.242, 0.970]),
        pitch_degrees=14,
        eave_edge=np.array([[0, 0, 0], [15, 0, 0]])
    )
    
    solar = SolarPanelArray(
        roof_plane=roof_plane,
        panel_width=1.0,
        panel_height=1.65,
        spacing=0.02,
        tilt_angle=5
    )
    
    mesh = solar.generate()
    return mesh.to_dict()


def example_chimney_flashing():
    """Example: Create chimney flashing"""
    chimney_pos = np.array([3, 4, 1])
    chimney_dims = (1.2, 0.8, 2.0)
    
    flashing = ChimneyFlashing(
        chimney_position=chimney_pos,
        chimney_dimensions=chimney_dims,
        roof_pitch=18,
        material_type='copper'
    )
    
    mesh = flashing.generate()
    return mesh.to_dict()


def example_pipe_boot():
    """Example: Create pipe boot flashing"""
    pipe_pos = np.array([4, 3, 1.5])
    
    boot = PipeBootFlashing(
        pipe_position=pipe_pos,
        pipe_diameter=0.102,
        roof_pitch=14,
        boot_type='rubber'
    )
    
    mesh = boot.generate()
    return mesh.to_dict()


# Export mesh to JSON for frontend
def export_to_json(mesh_data: MeshData, filename: str):
    """Export mesh data to JSON file"""
    with open(filename, 'w') as f:
        json.dump(mesh_data.to_dict(), f, indent=2)


if __name__ == "__main__":
    # Generate example outputs
    print("Generating roof component examples...")
    
    # Roof coverings
    shingles = example_asphalt_shingles()
    metal = example_standing_seam()
    solar = example_solar_panels()
    
    # Rainwater goods
    gutter = example_gutter_system()
    pipe = example_downpipe()
    
    # Eave details
    fascia = example_fascia()
    
    # Flashing
    valley = example_valley_flashing()
    chimney = example_chimney_flashing()
    boot = example_pipe_boot()
    
    print("Examples generated successfully")