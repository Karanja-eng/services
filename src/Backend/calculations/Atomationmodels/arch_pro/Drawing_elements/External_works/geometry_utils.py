"""
Geometry utilities for civil engineering BIM system
Handles 3D transformations, mesh generation, and GLTF export
"""

import numpy as np
import json
from dataclasses import dataclass, asdict
from typing import List, Tuple, Dict, Any
import base64
import struct


@dataclass
class Vector3:
    x: float
    y: float
    z: float
    
    def to_array(self) -> np.ndarray:
        return np.array([self.x, self.y, self.z])
    
    def __add__(self, other):
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)
    
    def __sub__(self, other):
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)
    
    def __mul__(self, scalar: float):
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)
    
    def length(self) -> float:
        return np.sqrt(self.x**2 + self.y**2 + self.z**2)
    
    def normalize(self):
        l = self.length()
        if l > 0:
            return Vector3(self.x/l, self.y/l, self.z/l)
        return Vector3(0, 0, 0)


@dataclass
class Transform:
    position: Vector3
    rotation: Vector3  # Euler angles in radians
    scale: Vector3
    
    def to_matrix(self) -> np.ndarray:
        """Convert to 4x4 transformation matrix"""
        # Translation
        T = np.eye(4)
        T[0:3, 3] = self.position.to_array()
        
        # Rotation (Z-Y-X Euler)
        cx, cy, cz = np.cos([self.rotation.x, self.rotation.y, self.rotation.z])
        sx, sy, sz = np.sin([self.rotation.x, self.rotation.y, self.rotation.z])
        
        Rx = np.array([[1, 0, 0, 0],
                       [0, cx, -sx, 0],
                       [0, sx, cx, 0],
                       [0, 0, 0, 1]])
        
        Ry = np.array([[cy, 0, sy, 0],
                       [0, 1, 0, 0],
                       [-sy, 0, cy, 0],
                       [0, 0, 0, 1]])
        
        Rz = np.array([[cz, -sz, 0, 0],
                       [sz, cz, 0, 0],
                       [0, 0, 1, 0],
                       [0, 0, 0, 1]])
        
        R = Rz @ Ry @ Rx
        
        # Scale
        S = np.eye(4)
        S[0, 0] = self.scale.x
        S[1, 1] = self.scale.y
        S[2, 2] = self.scale.z
        
        return T @ R @ S


class Mesh:
    """Parametric mesh representation"""
    
    def __init__(self):
        self.vertices: List[Vector3] = []
        self.normals: List[Vector3] = []
        self.uvs: List[Tuple[float, float]] = []
        self.indices: List[int] = []
        self.material_name: str = "default"
        
    def add_vertex(self, position: Vector3, normal: Vector3 = None, uv: Tuple[float, float] = None):
        self.vertices.append(position)
        if normal:
            self.normals.append(normal)
        else:
            self.normals.append(Vector3(0, 1, 0))
        if uv:
            self.uvs.append(uv)
        else:
            self.uvs.append((0, 0))
        return len(self.vertices) - 1
    
    def add_triangle(self, i0: int, i1: int, i2: int):
        self.indices.extend([i0, i1, i2])
    
    def add_quad(self, i0: int, i1: int, i2: int, i3: int):
        """Add quad as two triangles"""
        self.indices.extend([i0, i1, i2, i0, i2, i3])
    
    def calculate_normals(self):
        """Recalculate vertex normals from face data"""
        vertex_normals = [Vector3(0, 0, 0) for _ in self.vertices]
        
        # Accumulate face normals
        for i in range(0, len(self.indices), 3):
            i0, i1, i2 = self.indices[i], self.indices[i+1], self.indices[i+2]
            v0 = self.vertices[i0].to_array()
            v1 = self.vertices[i1].to_array()
            v2 = self.vertices[i2].to_array()
            
            edge1 = v1 - v0
            edge2 = v2 - v0
            normal = np.cross(edge1, edge2)
            normal_len = np.linalg.norm(normal)
            if normal_len > 0:
                normal = normal / normal_len
            
            n = Vector3(normal[0], normal[1], normal[2])
            vertex_normals[i0] = vertex_normals[i0] + n
            vertex_normals[i1] = vertex_normals[i1] + n
            vertex_normals[i2] = vertex_normals[i2] + n
        
        # Normalize
        self.normals = [n.normalize() for n in vertex_normals]
    
    def transform(self, transform: Transform):
        """Apply transformation to all vertices"""
        matrix = transform.to_matrix()
        for i, vertex in enumerate(self.vertices):
            v = np.array([vertex.x, vertex.y, vertex.z, 1.0])
            transformed = matrix @ v
            self.vertices[i] = Vector3(transformed[0], transformed[1], transformed[2])
        
        # Transform normals (use inverse transpose for proper normal transformation)
        rotation_part = matrix[0:3, 0:3]
        for i, normal in enumerate(self.normals):
            n = normal.to_array()
            transformed_n = rotation_part @ n
            transformed_n = transformed_n / np.linalg.norm(transformed_n) if np.linalg.norm(transformed_n) > 0 else transformed_n
            self.normals[i] = Vector3(transformed_n[0], transformed_n[1], transformed_n[2])
    
    def merge(self, other: 'Mesh'):
        """Merge another mesh into this one"""
        vertex_offset = len(self.vertices)
        self.vertices.extend(other.vertices)
        self.normals.extend(other.normals)
        self.uvs.extend(other.uvs)
        self.indices.extend([idx + vertex_offset for idx in other.indices])


class MeshBuilder:
    """Helper class for creating common geometric shapes"""
    
    @staticmethod
    def create_box(width: float, height: float, depth: float) -> Mesh:
        """Create a box mesh centered at origin"""
        mesh = Mesh()
        w, h, d = width/2, height/2, depth/2
        
        # 8 vertices
        vertices = [
            Vector3(-w, -h, -d), Vector3(w, -h, -d), Vector3(w, h, -d), Vector3(-w, h, -d),
            Vector3(-w, -h, d), Vector3(w, -h, d), Vector3(w, h, d), Vector3(-w, h, d)
        ]
        
        # 6 faces with normals
        faces = [
            # Front
            ([0, 1, 2, 3], Vector3(0, 0, -1)),
            # Back
            ([5, 4, 7, 6], Vector3(0, 0, 1)),
            # Left
            ([4, 0, 3, 7], Vector3(-1, 0, 0)),
            # Right
            ([1, 5, 6, 2], Vector3(1, 0, 0)),
            # Bottom
            ([4, 5, 1, 0], Vector3(0, -1, 0)),
            # Top
            ([3, 2, 6, 7], Vector3(0, 1, 0))
        ]
        
        for face_indices, normal in faces:
            base_idx = len(mesh.vertices)
            for idx in face_indices:
                mesh.add_vertex(vertices[idx], normal)
            mesh.add_quad(base_idx, base_idx+1, base_idx+2, base_idx+3)
        
        return mesh
    
    @staticmethod
    def create_plane(width: float, depth: float, segments_w: int = 1, segments_d: int = 1) -> Mesh:
        """Create a horizontal plane (Y-up)"""
        mesh = Mesh()
        
        for i in range(segments_d + 1):
            for j in range(segments_w + 1):
                x = (j / segments_w - 0.5) * width
                z = (i / segments_d - 0.5) * depth
                u = j / segments_w
                v = i / segments_d
                mesh.add_vertex(Vector3(x, 0, z), Vector3(0, 1, 0), (u, v))
        
        for i in range(segments_d):
            for j in range(segments_w):
                i0 = i * (segments_w + 1) + j
                i1 = i0 + 1
                i2 = i0 + segments_w + 1
                i3 = i2 + 1
                mesh.add_quad(i0, i1, i3, i2)
        
        return mesh
    
    @staticmethod
    def create_sloped_plane(width: float, depth: float, slope_x: float, slope_z: float, 
                           segments_w: int = 1, segments_d: int = 1) -> Mesh:
        """Create a sloped plane for drainage"""
        mesh = Mesh()
        
        for i in range(segments_d + 1):
            for j in range(segments_w + 1):
                x = (j / segments_w - 0.5) * width
                z = (i / segments_d - 0.5) * depth
                # Apply slopes (percentage grade)
                y = x * slope_x + z * slope_z
                u = j / segments_w
                v = i / segments_d
                mesh.add_vertex(Vector3(x, y, z), None, (u, v))
        
        for i in range(segments_d):
            for j in range(segments_w):
                i0 = i * (segments_w + 1) + j
                i1 = i0 + 1
                i2 = i0 + segments_w + 1
                i3 = i2 + 1
                mesh.add_quad(i0, i1, i3, i2)
        
        mesh.calculate_normals()
        return mesh
    
    @staticmethod
    def create_cylinder(radius: float, height: float, segments: int = 16) -> Mesh:
        """Create a cylinder along Y axis"""
        mesh = Mesh()
        
        # Bottom cap
        bottom_center = mesh.add_vertex(Vector3(0, 0, 0), Vector3(0, -1, 0))
        for i in range(segments):
            angle = 2 * np.pi * i / segments
            x = radius * np.cos(angle)
            z = radius * np.sin(angle)
            mesh.add_vertex(Vector3(x, 0, z), Vector3(0, -1, 0))
        
        for i in range(segments):
            next_i = (i + 1) % segments
            mesh.add_triangle(bottom_center, i + 1, next_i + 1)
        
        # Side
        side_start = len(mesh.vertices)
        for i in range(segments):
            angle = 2 * np.pi * i / segments
            x = radius * np.cos(angle)
            z = radius * np.sin(angle)
            normal = Vector3(np.cos(angle), 0, np.sin(angle))
            mesh.add_vertex(Vector3(x, 0, z), normal, (i/segments, 0))
            mesh.add_vertex(Vector3(x, height, z), normal, (i/segments, 1))
        
        for i in range(segments):
            next_i = (i + 1) % segments
            i0 = side_start + i * 2
            i1 = side_start + i * 2 + 1
            i2 = side_start + next_i * 2
            i3 = side_start + next_i * 2 + 1
            mesh.add_quad(i0, i2, i3, i1)
        
        # Top cap
        top_center = mesh.add_vertex(Vector3(0, height, 0), Vector3(0, 1, 0))
        top_start = len(mesh.vertices)
        for i in range(segments):
            angle = 2 * np.pi * i / segments
            x = radius * np.cos(angle)
            z = radius * np.sin(angle)
            mesh.add_vertex(Vector3(x, height, z), Vector3(0, 1, 0))
        
        for i in range(segments):
            next_i = (i + 1) % segments
            mesh.add_triangle(top_center, top_start + next_i, top_start + i)
        
        return mesh
    
    @staticmethod
    def create_path(points: List[Vector3], width: float, height: float = 0.1) -> Mesh:
        """Create a path with thickness from a list of points"""
        mesh = Mesh()
        
        if len(points) < 2:
            return mesh
        
        # Create cross-section at each point
        for i, point in enumerate(points):
            if i == 0:
                direction = (points[1].to_array() - points[0].to_array())
            elif i == len(points) - 1:
                direction = (points[-1].to_array() - points[-2].to_array())
            else:
                direction = (points[i+1].to_array() - points[i-1].to_array())
            
            direction = direction / np.linalg.norm(direction) if np.linalg.norm(direction) > 0 else np.array([0, 0, 1])
            
            # Perpendicular vector
            up = np.array([0, 1, 0])
            right = np.cross(direction, up)
            right = right / np.linalg.norm(right) if np.linalg.norm(right) > 0 else np.array([1, 0, 0])
            
            # Four corners of cross-section
            base_idx = len(mesh.vertices)
            p = point.to_array()
            
            mesh.add_vertex(Vector3(*(p + right * width/2)), Vector3(0, 1, 0))
            mesh.add_vertex(Vector3(*(p - right * width/2)), Vector3(0, 1, 0))
            mesh.add_vertex(Vector3(*(p + right * width/2 - up * height)), Vector3(0, -1, 0))
            mesh.add_vertex(Vector3(*(p - right * width/2 - up * height)), Vector3(0, -1, 0))
            
            # Connect to previous section
            if i > 0:
                prev_base = base_idx - 4
                # Top face
                mesh.add_quad(prev_base, prev_base+1, base_idx+1, base_idx)
                # Bottom face
                mesh.add_quad(prev_base+2, base_idx+2, base_idx+3, prev_base+3)
                # Sides
                mesh.add_quad(prev_base, base_idx, base_idx+2, prev_base+2)
                mesh.add_quad(prev_base+1, prev_base+3, base_idx+3, base_idx+1)
        
        return mesh


class GLTFExporter:
    """Export meshes to GLTF format"""
    
    @staticmethod
    def export(meshes: List[Mesh], materials: Dict[str, Dict], filename: str):
        """Export meshes to GLTF 2.0 format"""
        
        buffers_data = []
        buffer_views = []
        accessors = []
        primitives_list = []
        
        current_offset = 0
        
        for mesh in meshes:
            # Vertices
            vertices_data = np.array([[v.x, v.y, v.z] for v in mesh.vertices], dtype=np.float32)
            vertices_bytes = vertices_data.tobytes()
            
            buffer_views.append({
                "buffer": 0,
                "byteOffset": current_offset,
                "byteLength": len(vertices_bytes),
                "target": 34962
            })
            
            accessors.append({
                "bufferView": len(buffer_views) - 1,
                "componentType": 5126,
                "count": len(mesh.vertices),
                "type": "VEC3",
                "min": vertices_data.min(axis=0).tolist(),
                "max": vertices_data.max(axis=0).tolist()
            })
            
            position_accessor = len(accessors) - 1
            buffers_data.append(vertices_bytes)
            current_offset += len(vertices_bytes)
            
            # Normals
            normals_data = np.array([[n.x, n.y, n.z] for n in mesh.normals], dtype=np.float32)
            normals_bytes = normals_data.tobytes()
            
            buffer_views.append({
                "buffer": 0,
                "byteOffset": current_offset,
                "byteLength": len(normals_bytes),
                "target": 34962
            })
            
            accessors.append({
                "bufferView": len(buffer_views) - 1,
                "componentType": 5126,
                "count": len(mesh.normals),
                "type": "VEC3"
            })
            
            normal_accessor = len(accessors) - 1
            buffers_data.append(normals_bytes)
            current_offset += len(normals_bytes)
            
            # UVs
            uvs_data = np.array(mesh.uvs, dtype=np.float32)
            uvs_bytes = uvs_data.tobytes()
            
            buffer_views.append({
                "buffer": 0,
                "byteOffset": current_offset,
                "byteLength": len(uvs_bytes),
                "target": 34962
            })
            
            accessors.append({
                "bufferView": len(buffer_views) - 1,
                "componentType": 5126,
                "count": len(mesh.uvs),
                "type": "VEC2"
            })
            
            uv_accessor = len(accessors) - 1
            buffers_data.append(uvs_bytes)
            current_offset += len(uvs_bytes)
            
            # Indices
            indices_data = np.array(mesh.indices, dtype=np.uint32)
            indices_bytes = indices_data.tobytes()
            
            buffer_views.append({
                "buffer": 0,
                "byteOffset": current_offset,
                "byteLength": len(indices_bytes),
                "target": 34963
            })
            
            accessors.append({
                "bufferView": len(buffer_views) - 1,
                "componentType": 5125,
                "count": len(mesh.indices),
                "type": "SCALAR"
            })
            
            indices_accessor = len(accessors) - 1
            buffers_data.append(indices_bytes)
            current_offset += len(indices_bytes)
            
            # Create primitive
            primitives_list.append({
                "attributes": {
                    "POSITION": position_accessor,
                    "NORMAL": normal_accessor,
                    "TEXCOORD_0": uv_accessor
                },
                "indices": indices_accessor,
                "material": 0
            })
        
        # Combine all buffer data
        combined_buffer = b''.join(buffers_data)
        buffer_uri = "data:application/octet-stream;base64," + base64.b64encode(combined_buffer).decode()
        
        gltf = {
            "asset": {"version": "2.0", "generator": "Civil Engineering BIM"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [{"mesh": 0}],
            "meshes": [{"primitives": primitives_list}],
            "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [0.8, 0.8, 0.8, 1.0]}}],
            "accessors": accessors,
            "bufferViews": buffer_views,
            "buffers": [{"byteLength": len(combined_buffer), "uri": buffer_uri}]
        }
        
        with open(filename, 'w') as f:
            json.dump(gltf, f, indent=2)
        
        return filename