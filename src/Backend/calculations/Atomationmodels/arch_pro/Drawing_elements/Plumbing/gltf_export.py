"""
GLTF Export Module
Export plumbing geometry to GLTF format
"""

import json
import base64
import struct
import numpy as np
from typing import List, Dict, Any, Tuple


class GLTFExporter:
    """Export plumbing system to GLTF 2.0 format"""
    
    def __init__(self):
        self.buffers = []
        self.buffer_views = []
        self.accessors = []
        self.meshes = []
        self.nodes = []
        self.materials = []
        self.current_buffer_offset = 0
        
        # Create default materials
        self._create_default_materials()
    
    def _create_default_materials(self):
        """Create material library for plumbing elements"""
        # Copper pipes - reddish metallic
        self.materials.append({
            "name": "Copper",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.72, 0.45, 0.20, 1.0],
                "metallicFactor": 0.8,
                "roughnessFactor": 0.3
            }
        })
        
        # PVC pipes - white plastic
        self.materials.append({
            "name": "PVC",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.95, 0.95, 0.95, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.5
            }
        })
        
        # Cast iron - dark grey
        self.materials.append({
            "name": "CastIron",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.2, 0.2, 0.2, 1.0],
                "metallicFactor": 0.9,
                "roughnessFactor": 0.6
            }
        })
        
        # Fixtures - white ceramic
        self.materials.append({
            "name": "Ceramic",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.98, 0.98, 0.98, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.2
            }
        })
        
        # Fittings - brass
        self.materials.append({
            "name": "Brass",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.88, 0.78, 0.50, 1.0],
                "metallicFactor": 0.9,
                "roughnessFactor": 0.2
            }
        })
    
    def get_material_index(self, material_name: str) -> int:
        """Get material index by name"""
        material_map = {
            "copper": 0,
            "pvc": 1,
            "abs": 1,
            "cast_iron": 2,
            "ceramic": 3,
            "brass": 4,
            "pex": 0,  # Similar to copper visually
        }
        return material_map.get(material_name.lower(), 1)
    
    def add_mesh_data(
        self,
        vertices: np.ndarray,
        indices: np.ndarray = None,
        name: str = "mesh",
        material_index: int = 0
    ) -> int:
        """
        Add mesh data and return mesh index
        
        Args:
            vertices: Nx3 numpy array of vertex positions
            indices: Optional index array for triangle faces
            name: Mesh name
            material_index: Material to apply
            
        Returns:
            Index of created mesh
        """
        if vertices.size == 0:
            return -1
        
        # Ensure vertices are float32
        vertices = vertices.astype(np.float32)
        
        # Create index buffer if not provided
        if indices is None:
            # Generate triangle indices from vertices (assuming triangles)
            num_vertices = len(vertices)
            indices = np.arange(num_vertices, dtype=np.uint16)
        else:
            indices = indices.astype(np.uint16)
        
        # Add vertex buffer
        vertex_buffer = vertices.tobytes()
        vertex_buffer_view = self._add_buffer_view(vertex_buffer, 34962)  # ARRAY_BUFFER
        vertex_accessor = self._add_accessor(
            buffer_view=vertex_buffer_view,
            component_type=5126,  # FLOAT
            count=len(vertices),
            type="VEC3",
            min_vals=vertices.min(axis=0).tolist(),
            max_vals=vertices.max(axis=0).tolist()
        )
        
        # Add index buffer
        index_buffer = indices.tobytes()
        index_buffer_view = self._add_buffer_view(index_buffer, 34963)  # ELEMENT_ARRAY_BUFFER
        index_accessor = self._add_accessor(
            buffer_view=index_buffer_view,
            component_type=5123,  # UNSIGNED_SHORT
            count=len(indices),
            type="SCALAR"
        )
        
        # Create mesh primitive
        primitive = {
            "attributes": {
                "POSITION": vertex_accessor
            },
            "indices": index_accessor,
            "material": material_index,
            "mode": 4  # TRIANGLES
        }
        
        # Add mesh
        mesh_index = len(self.meshes)
        self.meshes.append({
            "name": name,
            "primitives": [primitive]
        })
        
        return mesh_index
    
    def _add_buffer_view(self, data: bytes, target: int) -> int:
        """Add buffer view and return its index"""
        buffer_view_index = len(self.buffer_views)
        
        self.buffer_views.append({
            "buffer": 0,  # Single buffer
            "byteOffset": self.current_buffer_offset,
            "byteLength": len(data),
            "target": target
        })
        
        self.buffers.append(data)
        self.current_buffer_offset += len(data)
        
        # Align to 4 bytes
        remainder = self.current_buffer_offset % 4
        if remainder != 0:
            padding = 4 - remainder
            self.buffers.append(b'\x00' * padding)
            self.current_buffer_offset += padding
        
        return buffer_view_index
    
    def _add_accessor(
        self,
        buffer_view: int,
        component_type: int,
        count: int,
        type: str,
        min_vals: List[float] = None,
        max_vals: List[float] = None
    ) -> int:
        """Add accessor and return its index"""
        accessor_index = len(self.accessors)
        
        accessor = {
            "bufferView": buffer_view,
            "componentType": component_type,
            "count": count,
            "type": type
        }
        
        if min_vals is not None:
            accessor["min"] = min_vals
        if max_vals is not None:
            accessor["max"] = max_vals
        
        self.accessors.append(accessor)
        return accessor_index
    
    def add_node(
        self,
        mesh_index: int,
        name: str = "node",
        translation: Tuple[float, float, float] = None,
        rotation: Tuple[float, float, float, float] = None,
        scale: Tuple[float, float, float] = None
    ) -> int:
        """Add scene node and return its index"""
        node = {
            "name": name,
            "mesh": mesh_index
        }
        
        if translation:
            node["translation"] = list(translation)
        if rotation:
            node["rotation"] = list(rotation)
        if scale:
            node["scale"] = list(scale)
        
        node_index = len(self.nodes)
        self.nodes.append(node)
        return node_index
    
    def export_to_gltf(self, filename: str, embed_buffers: bool = True):
        """
        Export to GLTF file
        
        Args:
            filename: Output filename (.gltf or .glb)
            embed_buffers: If True, embed buffers as base64 in JSON
        """
        # Combine all buffers
        combined_buffer = b''.join(self.buffers)
        
        # Create GLTF structure
        gltf = {
            "asset": {
                "version": "2.0",
                "generator": "PlumbingSystemGenerator"
            },
            "scene": 0,
            "scenes": [
                {
                    "name": "PlumbingScene",
                    "nodes": list(range(len(self.nodes)))
                }
            ],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [
                {
                    "byteLength": len(combined_buffer)
                }
            ]
        }
        
        if embed_buffers:
            # Embed buffer as base64 data URI
            encoded = base64.b64encode(combined_buffer).decode('ascii')
            gltf["buffers"][0]["uri"] = f"data:application/octet-stream;base64,{encoded}"
            
            # Write JSON
            with open(filename, 'w') as f:
                json.dump(gltf, f, indent=2)
        else:
            # Binary GLB format
            self._export_glb(filename, gltf, combined_buffer)
    
    def _export_glb(self, filename: str, gltf_json: Dict, buffer_data: bytes):
        """Export as binary GLB file"""
        # JSON chunk
        json_str = json.dumps(gltf_json, separators=(',', ':'))
        json_bytes = json_str.encode('utf-8')
        
        # Pad JSON to 4-byte alignment
        json_padding = (4 - len(json_bytes) % 4) % 4
        json_bytes += b' ' * json_padding
        
        # Pad buffer to 4-byte alignment
        buffer_padding = (4 - len(buffer_data) % 4) % 4
        buffer_data += b'\x00' * buffer_padding
        
        # GLB header
        magic = 0x46546C67  # "glTF"
        version = 2
        total_length = 12 + 8 + len(json_bytes) + 8 + len(buffer_data)
        
        with open(filename, 'wb') as f:
            # Header
            f.write(struct.pack('<III', magic, version, total_length))
            
            # JSON chunk
            f.write(struct.pack('<I', len(json_bytes)))
            f.write(struct.pack('<I', 0x4E4F534A))  # "JSON"
            f.write(json_bytes)
            
            # Binary chunk
            f.write(struct.pack('<I', len(buffer_data)))
            f.write(struct.pack('<I', 0x004E4942))  # "BIN\0"
            f.write(buffer_data)
    
    def export_to_json_metadata(self) -> Dict:
        """Export metadata without geometry"""
        return {
            "mesh_count": len(self.meshes),
            "node_count": len(self.nodes),
            "material_count": len(self.materials),
            "meshes": [m["name"] for m in self.meshes],
            "nodes": [n["name"] for n in self.nodes]
        }


def create_pipe_mesh(
    start: np.ndarray,
    end: np.ndarray,
    diameter: float,
    segments: int = 8
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create cylindrical mesh for pipe
    
    Returns:
        Tuple of (vertices, indices)
    """
    direction = end - start
    length = np.linalg.norm(direction)
    
    if length < 0.1:
        return np.array([]), np.array([])
    
    direction = direction / length
    radius = diameter / 2.0
    
    # Find perpendicular vectors
    if abs(direction[2]) < 0.9:
        perp1 = np.cross(direction, np.array([0, 0, 1]))
    else:
        perp1 = np.cross(direction, np.array([1, 0, 0]))
    perp1 = perp1 / np.linalg.norm(perp1)
    perp2 = np.cross(direction, perp1)
    
    # Generate vertices
    vertices = []
    for i in range(segments + 1):
        angle = 2 * np.pi * i / segments
        offset = radius * (np.cos(angle) * perp1 + np.sin(angle) * perp2)
        
        # Start cap
        vertices.append(start + offset)
        # End cap
        vertices.append(end + offset)
    
    vertices = np.array(vertices, dtype=np.float32)
    
    # Generate triangle indices
    indices = []
    for i in range(segments):
        # Two triangles per segment
        v0 = i * 2
        v1 = v0 + 1
        v2 = v0 + 2
        v3 = v0 + 3
        
        indices.extend([v0, v1, v2])
        indices.extend([v1, v3, v2])
    
    indices = np.array(indices, dtype=np.uint16)
    
    return vertices, indices