
#Foundation Base Module
#Provides base class and utilities for all foundation types


import numpy as np
import trimesh
from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Optional, Any
import json
from dataclasses import dataclass, asdict


@dataclass
class MaterialProperties:
    """Material properties for foundation elements"""
    name: str
    density: float  # kg/m³
    compressive_strength: float  # N/mm²
    color: str  # hex color
    texture: Optional[str] = None


# Standard concrete grades per BS 8500
CONCRETE_GRADES = {
    "C20/25": MaterialProperties("C20/25", 2400, 20, "#9e9e9e"),
    "C25/30": MaterialProperties("C25/30", 2400, 25, "#8c8c8c"),
    "C30/37": MaterialProperties("C30/37", 2400, 30, "#7a7a7a"),
    "C35/45": MaterialProperties("C35/45", 2400, 35, "#6e6e6e"),
    "C40/50": MaterialProperties("C40/50", 2400, 40, "#626262"),
}


class EngineeringException(Exception):
    """Exception for engineering validation failures"""
    pass


class FoundationBase(ABC):
    """
    Abstract base class for all foundation types
    Provides common functionality and interface
    """
    
    def __init__(
        self,
        foundation_type: str,
        foundation_subtype: str,
        material: str = "C30/37",
        color: Optional[str] = None,
        texture: Optional[str] = None
    ):
        self.foundation_type = foundation_type
        self.foundation_subtype = foundation_subtype
        
        # Material properties
        if material in CONCRETE_GRADES:
            self.material = CONCRETE_GRADES[material]
        else:
            self.material = MaterialProperties(material, 2400, 30, color or "#8c8c8c", texture)
        
        if color:
            self.material.color = color
        if texture:
            self.material.texture = texture
            
        # Geometry storage
        self._mesh: Optional[trimesh.Trimesh] = None
        self._metadata: Dict[str, Any] = {}
        
    @abstractmethod
    def calculate_geometry(self) -> trimesh.Trimesh:
        """Calculate and return foundation geometry"""
        pass
    
    @abstractmethod
    def validate_design(self) -> List[str]:
        """Validate foundation design parameters. Returns list of warnings/errors."""
        pass
    
    @abstractmethod
    def get_design_parameters(self) -> Dict[str, Any]:
        """Return dictionary of design parameters"""
        pass
    
    def to_trimesh(self) -> trimesh.Trimesh:
        """Return trimesh object of foundation geometry"""
        if self._mesh is None:
            self._mesh = self.calculate_geometry()
        return self._mesh
    
    def to_gltf_nodes(self, filepath: str) -> str:
        """Export geometry to GLTF format"""
        mesh = self.to_trimesh()
        mesh.export(filepath, file_type='gltf')
        return filepath
    
    def to_json_metadata(self) -> str:
        """Return JSON string of metadata"""
        metadata = self.get_metadata()
        return json.dumps(metadata, indent=2)
    
    def get_metadata(self) -> Dict[str, Any]:
        """Build complete metadata dictionary"""
        mesh = self.to_trimesh()
        
        metadata = {
            "category": "foundation",
            "type": self.foundation_type,
            "subtype": self.foundation_subtype,
            "bimMetadata": {
                "System": "structural",
                "Subsystem": "foundations",
                "Layer": self.foundation_type
            },
            "material": {
                "name": self.material.name,
                "density": self.material.density,
                "strength": self.material.compressive_strength,
                "color": self.material.color,
                "texture": self.material.texture
            },
            "design_parameters": self.get_design_parameters(),
            "geometry": {
                "volume": float(mesh.volume),
                "area": float(mesh.area),
                "bounding_box": {
                    "min": mesh.bounds[0].tolist(),
                    "max": mesh.bounds[1].tolist()
                },
                "centroid": mesh.centroid.tolist()
            },
            "validation": {
                "issues": self.validate_design()
            }
        }
        
        return metadata
    
    @staticmethod
    def check_bearing_capacity(
        applied_pressure: float,
        soil_capacity: float,
        safety_factor: float = 3.0
    ) -> Tuple[bool, float]:
        """
        Check bearing capacity per Eurocode 7
        
        Args:
            applied_pressure: Applied bearing pressure (kN/m²)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            safety_factor: Factor of safety (default 3.0)
            
        Returns:
            (is_safe, utilization_ratio)
        """
        utilization = applied_pressure / soil_capacity
        is_safe = utilization <= (1.0 / safety_factor)
        return is_safe, utilization
    
    @staticmethod
    def calculate_minimum_width(
        total_load: float,
        soil_capacity: float,
        length: float = 1.0,
        safety_factor: float = 3.0
    ) -> float:
        """
        Calculate minimum footing width for given load
        
        Args:
            total_load: Total load (kN)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            length: Foundation length (m)
            safety_factor: Factor of safety
            
        Returns:
            Minimum width (m)
        """
        return (total_load * safety_factor) / (soil_capacity * length)
    
    @staticmethod
    def create_box_mesh(
        center: Tuple[float, float, float],
        dimensions: Tuple[float, float, float],
        color: str = "#8c8c8c"
    ) -> trimesh.Trimesh:
        """Create a rectangular box mesh"""
        box = trimesh.creation.box(extents=dimensions)
        box.apply_translation(center)
        
        # Apply color
        color_rgba = FoundationBase.hex_to_rgba(color)
        box.visual.face_colors = color_rgba
        
        return box
    
    @staticmethod
    def create_cylinder_mesh(
        center: Tuple[float, float, float],
        radius: float,
        height: float,
        color: str = "#8c8c8c",
        sections: int = 32
    ) -> trimesh.Trimesh:
        """Create a cylindrical mesh"""
        cylinder = trimesh.creation.cylinder(
            radius=radius,
            height=height,
            sections=sections
        )
        cylinder.apply_translation(center)
        
        # Apply color
        color_rgba = FoundationBase.hex_to_rgba(color)
        cylinder.visual.face_colors = color_rgba
        
        return cylinder
    
    @staticmethod
    def hex_to_rgba(hex_color: str, alpha: int = 255) -> List[int]:
        """Convert hex color to RGBA"""
        hex_color = hex_color.lstrip('#')
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return [r, g, b, alpha]
    
    @staticmethod
    def create_extruded_polygon(
        polygon_points: List[Tuple[float, float]],
        height: float,
        base_z: float = 0.0,
        color: str = "#8c8c8c"
    ) -> trimesh.Trimesh:
        """Create extruded polygon mesh"""
        n = len(polygon_points)
        
        # Convert to 3D points
        vertices = []
        
        # Bottom face vertices
        for x, y in polygon_points:
            vertices.append([x, y, base_z])
        
        # Top face vertices
        for x, y in polygon_points:
            vertices.append([x, y, base_z + height])
        
        vertices = np.array(vertices)
        
        # Create faces (all triangulated)
        faces = []
        
        # Bottom face - triangulate by fan from first vertex
        for i in range(1, n - 1):
            faces.append([0, i+1, i])  # Reversed for correct normal
        
        # Top face - triangulate by fan from first vertex
        for i in range(1, n - 1):
            faces.append([n, n+i, n+i+1])
        
        # Side faces - two triangles per edge
        for i in range(n):
            next_i = (i + 1) % n
            # Two triangles per side
            faces.append([i, next_i, n + next_i])
            faces.append([i, n + next_i, n + i])
        
        faces = np.array(faces, dtype=np.int32)
        
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
        
        # Apply color
        color_rgba = FoundationBase.hex_to_rgba(color)
        mesh.visual.face_colors = color_rgba
        
        return mesh
    
    def add_attachment_points(self, points: List[Tuple[float, float, float]]) -> None:
        """Add attachment points for connecting elements"""
        if "attachment_points" not in self._metadata:
            self._metadata["attachment_points"] = []
        self._metadata["attachment_points"].extend([list(p) for p in points])