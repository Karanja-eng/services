"""
Pad Foundation Module
Isolated pad footings for columns
"""

import numpy as np
import trimesh
from typing import Tuple, List, Dict, Any, Optional
from foundation_base import FoundationBase, EngineeringException


class PadFoundation(FoundationBase):
    """
    Isolated pad foundation for columns
    Per BS 8004:2015 Section 5 - Pad foundations
    """
    
    def __init__(
        self,
        position: Tuple[float, float],
        column_size: Tuple[float, float],  # (width, depth) of column
        column_load: float,  # kN
        soil_capacity: float,  # kN/m²
        pad_width: Optional[float] = None,
        pad_length: Optional[float] = None,
        pad_depth: float = 0.6,
        base_level: float = 0.0,
        material: str = "C30/37",
        color: Optional[str] = None,
        reinforcement_zones: Optional[List[str]] = None,
        column_type: str = "square"  # "square", "rectangular", "circular"
    ):
        """
        Initialize pad foundation
        
        Args:
            position: (x, y) center position of pad
            column_size: (width, depth) dimensions of column
            column_load: Total load from column (kN)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            pad_width: Pad width (x-direction) - calculated if None
            pad_length: Pad length (y-direction) - calculated if None
            pad_depth: Pad thickness (m)
            base_level: Z-coordinate of top of pad
            material: Concrete grade
            color: Hex color override
            reinforcement_zones: Reinforcement zone identifiers
            column_type: Type of column section
        """
        super().__init__("pad_foundation", "isolated_pad", material, color)
        
        self.position = np.array(position)
        self.column_size = np.array(column_size)
        self.column_load = column_load
        self.soil_capacity = soil_capacity
        self.pad_depth = pad_depth
        self.base_level = base_level
        self.column_type = column_type
        self.reinforcement_zones = reinforcement_zones or ["bottom_x", "bottom_y"]
        
        # Calculate pad dimensions if not provided
        if pad_width is None or pad_length is None:
            self.pad_width, self.pad_length = self._calculate_minimum_dimensions()
        else:
            self.pad_width = pad_width
            self.pad_length = pad_length
        
        # Validate design
        issues = self.validate_design()
        critical_issues = [i for i in issues if "ERROR" in i]
        if critical_issues:
            raise EngineeringException("; ".join(critical_issues))
    
    def _calculate_minimum_dimensions(self) -> Tuple[float, float]:
        """Calculate minimum pad dimensions"""
        # Required area for bearing capacity
        required_area = self.calculate_minimum_width(
            total_load=self.column_load,
            soil_capacity=self.soil_capacity,
            length=1.0,
            safety_factor=3.0
        )
        
        # For square pad, use square root of area
        side = np.sqrt(required_area)
        
        # Minimum projection beyond column face per BS 8004
        min_projection = max(0.15, max(self.column_size) * 0.4)
        
        # Calculate dimensions
        width = max(self.column_size[0] + 2 * min_projection, side)
        length = max(self.column_size[1] + 2 * min_projection, side)
        
        # Adjust to maintain required area
        actual_area = width * length
        if actual_area < required_area:
            scale = np.sqrt(required_area / actual_area)
            width *= scale
            length *= scale
        
        # Minimum absolute dimensions
        width = max(width, 0.6)
        length = max(length, 0.6)
        
        return width, length
    
    def validate_design(self) -> List[str]:
        """Validate pad foundation design"""
        issues = []
        
        # Check minimum depth
        if self.pad_depth < 0.3:
            issues.append("ERROR: Pad depth less than absolute minimum 300mm")
        elif self.pad_depth < 0.45:
            issues.append("WARNING: Pad depth less than recommended minimum 450mm")
        
        # Check minimum dimensions
        if self.pad_width < 0.5 or self.pad_length < 0.5:
            issues.append("ERROR: Pad dimensions less than minimum 500mm")
        
        # Check projection beyond column
        projection_x = (self.pad_width - self.column_size[0]) / 2
        projection_y = (self.pad_length - self.column_size[1]) / 2
        
        if projection_x < 0.1 or projection_y < 0.1:
            issues.append("ERROR: Projection beyond column less than minimum 100mm")
        
        # Check bearing capacity
        pad_area = self.pad_width * self.pad_length
        applied_pressure = self.column_load / pad_area
        is_safe, utilization = self.check_bearing_capacity(
            applied_pressure, self.soil_capacity
        )
        
        if not is_safe:
            issues.append(f"ERROR: Bearing capacity exceeded (utilization: {utilization:.1%})")
        elif utilization > 0.25:
            issues.append(f"WARNING: High bearing pressure (utilization: {utilization:.1%})")
        
        # Check punching shear perimeter
        critical_perimeter = 2 * (self.column_size[0] + self.column_size[1] + 2 * self.pad_depth)
        punching_stress = self.column_load * 1000 / (critical_perimeter * self.pad_depth * 1000)  # N/mm²
        
        # Simplified check - should be detailed per Eurocode 2
        if punching_stress > 0.5:  # Very simplified limit
            issues.append("WARNING: High punching shear stress - detailed check required")
        
        return issues
    
    def calculate_geometry(self) -> trimesh.Trimesh:
        """Generate 3D geometry for pad foundation"""
        # Create rectangular pad
        center = np.append(self.position, self.base_level - self.pad_depth / 2)
        dimensions = (self.pad_width, self.pad_length, self.pad_depth)
        
        mesh = self.create_box_mesh(center, dimensions, self.material.color)
        
        # Add attachment point at top center for column
        column_attachment = np.append(self.position, self.base_level)
        self.add_attachment_points([tuple(column_attachment)])
        
        return mesh
    
    def get_design_parameters(self) -> Dict[str, Any]:
        """Return pad foundation design parameters"""
        pad_area = self.pad_width * self.pad_length
        applied_pressure = self.column_load / pad_area
        _, utilization = self.check_bearing_capacity(applied_pressure, self.soil_capacity)
        
        return {
            "position": self.position.tolist(),
            "column_type": self.column_type,
            "column_size": self.column_size.tolist(),
            "column_load": float(self.column_load),
            "pad_width": float(self.pad_width),
            "pad_length": float(self.pad_length),
            "pad_depth": float(self.pad_depth),
            "pad_area": float(pad_area),
            "base_level": float(self.base_level),
            "soil_capacity": float(self.soil_capacity),
            "applied_pressure": float(applied_pressure),
            "bearing_utilization": float(utilization),
            "projection_x": float((self.pad_width - self.column_size[0]) / 2),
            "projection_y": float((self.pad_length - self.column_size[1]) / 2),
            "reinforcement_zones": self.reinforcement_zones,
            "standard": "BS 8004:2015"
        }


class CombinedPadFoundation(FoundationBase):
    """
    Combined pad foundation connecting multiple columns with tie beams
    """
    
    def __init__(
        self,
        pads: List[PadFoundation],
        tie_beam_width: float = 0.3,
        tie_beam_depth: float = 0.4,
        material: str = "C30/37",
        color: Optional[str] = None
    ):
        """
        Initialize combined pad foundation system
        
        Args:
            pads: List of individual pad foundations
            tie_beam_width: Width of connecting tie beams (m)
            tie_beam_depth: Depth of tie beams (m)
            material: Concrete grade for tie beams
            color: Hex color override
        """
        super().__init__("pad_foundation", "combined_pad", material, color)
        
        self.pads = pads
        self.tie_beam_width = tie_beam_width
        self.tie_beam_depth = tie_beam_depth
        
        # Validate that pads have similar base levels
        base_levels = [pad.base_level for pad in pads]
        if max(base_levels) - min(base_levels) > 0.1:
            raise EngineeringException(
                "Combined pads must have similar base levels (within 100mm)"
            )
        
        self.base_level = np.mean(base_levels)
    
    def validate_design(self) -> List[str]:
        """Validate combined pad system"""
        issues = []
        
        # Check individual pads
        for i, pad in enumerate(self.pads):
            pad_issues = pad.validate_design()
            for issue in pad_issues:
                issues.append(f"Pad {i+1}: {issue}")
        
        # Check tie beam dimensions
        if self.tie_beam_width < 0.2:
            issues.append("ERROR: Tie beam width less than minimum 200mm")
        if self.tie_beam_depth < 0.3:
            issues.append("ERROR: Tie beam depth less than minimum 300mm")
        
        # Check spacing between pads
        positions = [pad.position for pad in self.pads]
        for i in range(len(positions)):
            for j in range(i + 1, len(positions)):
                distance = np.linalg.norm(positions[i] - positions[j])
                if distance > 8.0:
                    issues.append(
                        f"WARNING: Spacing between pads {i+1} and {j+1} "
                        f"({distance:.2f}m) exceeds typical maximum 8m"
                    )
        
        return issues
    
    def calculate_geometry(self) -> trimesh.Trimesh:
        """Generate geometry for combined pad system with tie beams"""
        meshes = []
        
        # Add all pad meshes
        for pad in self.pads:
            meshes.append(pad.to_trimesh())
        
        # Create tie beams between consecutive pads
        for i in range(len(self.pads) - 1):
            pad1 = self.pads[i]
            pad2 = self.pads[i + 1]
            
            # Beam runs from pad1 to pad2 at base level
            start = np.append(pad1.position, self.base_level - self.tie_beam_depth)
            end = np.append(pad2.position, self.base_level - self.tie_beam_depth)
            
            # Create beam mesh
            beam_mesh = self._create_tie_beam(start, end)
            meshes.append(beam_mesh)
        
        # Combine all meshes
        combined_mesh = trimesh.util.concatenate(meshes)
        
        # Apply color
        color_rgba = self.hex_to_rgba(self.material.color)
        combined_mesh.visual.face_colors = color_rgba
        
        return combined_mesh
    
    def _create_tie_beam(
        self,
        start: np.ndarray,
        end: np.ndarray
    ) -> trimesh.Trimesh:
        """Create tie beam geometry between two points"""
        # Calculate beam direction and length
        beam_vector = end - start
        beam_length = np.linalg.norm(beam_vector[:2])  # Horizontal length
        beam_direction = beam_vector / np.linalg.norm(beam_vector)
        
        # Calculate perpendicular direction
        perp = np.array([-beam_direction[1], beam_direction[0], 0])
        perp = perp / np.linalg.norm(perp)
        
        # Calculate up direction
        up = np.array([0, 0, 1])
        
        # Create beam vertices
        half_width = self.tie_beam_width / 2
        
        # Bottom corners
        p1 = start - perp * half_width
        p2 = start + perp * half_width
        p3 = end + perp * half_width
        p4 = end - perp * half_width
        
        # Top corners
        p5 = p1 + up * self.tie_beam_depth
        p6 = p2 + up * self.tie_beam_depth
        p7 = p3 + up * self.tie_beam_depth
        p8 = p4 + up * self.tie_beam_depth
        
        vertices = np.array([p1, p2, p3, p4, p5, p6, p7, p8])
        
        # Create faces
        faces = np.array([
            # Bottom
            [0, 2, 1], [0, 3, 2],
            # Top
            [4, 5, 6], [4, 6, 7],
            # Sides
            [0, 1, 5], [0, 5, 4],
            [2, 3, 7], [2, 7, 6],
            [0, 4, 7], [0, 7, 3],
            [1, 2, 6], [1, 6, 5]
        ])
        
        return trimesh.Trimesh(vertices=vertices, faces=faces)
    
    def get_design_parameters(self) -> Dict[str, Any]:
        """Return combined pad system parameters"""
        total_load = sum(pad.column_load for pad in self.pads)
        
        return {
            "number_of_pads": len(self.pads),
            "total_load": float(total_load),
            "tie_beam_width": float(self.tie_beam_width),
            "tie_beam_depth": float(self.tie_beam_depth),
            "base_level": float(self.base_level),
            "pad_positions": [pad.position.tolist() for pad in self.pads],
            "individual_pads": [pad.get_design_parameters() for pad in self.pads],
            "standard": "BS 8004:2015"
        }