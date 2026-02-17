"""
Strip Foundation Module
Continuous footings for loadbearing walls (masonry and RC)
"""

import numpy as np
import trimesh
from typing import Tuple, List, Dict, Any, Optional
from foundation_base import FoundationBase, EngineeringException


class StripFoundation(FoundationBase):
    """
    Strip foundation for continuous walls
    Per BS 8004:2015 Section 4 - Strip foundations
    """
    
    def __init__(
        self,
        wall_start: Tuple[float, float],
        wall_end: Tuple[float, float],
        wall_thickness: float,
        wall_load: float,  # kN/m (load per meter)
        soil_capacity: float,  # kN/m²
        width: Optional[float] = None,  # Auto-calculate if None
        depth: float = 0.6,  # minimum per BS 8004
        wall_type: str = "masonry",  # "masonry" or "rc"
        base_level: float = 0.0,
        material: str = "C30/37",
        color: Optional[str] = None,
        reinforcement_zones: Optional[List[str]] = None
    ):
        """
        Initialize strip foundation
        
        Args:
            wall_start: (x, y) coordinates of wall start
            wall_end: (x, y) coordinates of wall end
            wall_thickness: Thickness of wall (m)
            wall_load: Line load from wall (kN/m)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            width: Foundation width (m) - calculated if None
            depth: Foundation depth below ground (m)
            wall_type: "masonry" or "rc"
            base_level: Z-coordinate of top of foundation
            material: Concrete grade
            color: Hex color override
            reinforcement_zones: List of reinforcement zone identifiers
        """
        subtype = f"strip_{wall_type}"
        super().__init__("strip_foundation", subtype, material, color)
        
        self.wall_start = np.array(wall_start)
        self.wall_end = np.array(wall_end)
        self.wall_thickness = wall_thickness
        self.wall_load = wall_load
        self.soil_capacity = soil_capacity
        self.depth = depth
        self.wall_type = wall_type
        self.base_level = base_level
        self.reinforcement_zones = reinforcement_zones or []
        
        # Calculate wall length and direction
        self.wall_vector = self.wall_end - self.wall_start
        self.wall_length = np.linalg.norm(self.wall_vector)
        self.wall_direction = self.wall_vector / self.wall_length
        self.wall_normal = np.array([-self.wall_direction[1], self.wall_direction[0]])
        
        # Calculate required width if not provided
        if width is None:
            self.width = self._calculate_minimum_width()
        else:
            self.width = width
            
        # Validate design
        issues = self.validate_design()
        critical_issues = [i for i in issues if "ERROR" in i]
        if critical_issues:
            raise EngineeringException("; ".join(critical_issues))
    
    def _calculate_minimum_width(self) -> float:
        """Calculate minimum foundation width based on soil capacity"""
        # Total load on foundation
        total_load = self.wall_load  # kN/m
        
        # Required bearing area per meter
        required_width = self.calculate_minimum_width(
            total_load=total_load,
            soil_capacity=self.soil_capacity,
            length=1.0,  # per meter run
            safety_factor=3.0
        )
        
        # BS 8004: Minimum projection beyond wall face
        min_projection = max(0.15, self.wall_thickness * 0.25)  # 150mm or 25% of wall thickness
        min_width = self.wall_thickness + 2 * min_projection
        
        # Take larger of calculated and minimum
        return max(required_width, min_width, 0.45)  # Absolute minimum 450mm
    
    def validate_design(self) -> List[str]:
        """Validate foundation design parameters"""
        issues = []
        
        # Check minimum depth per BS 8004
        if self.depth < 0.45:
            issues.append("ERROR: Depth less than absolute minimum 450mm (BS 8004)")
        elif self.depth < 0.6:
            issues.append("WARNING: Depth less than recommended minimum 600mm")
        
        # Check minimum width
        if self.width < 0.3:
            issues.append("ERROR: Width less than absolute minimum 300mm")
        
        # Check projection beyond wall
        projection = (self.width - self.wall_thickness) / 2
        if projection < 0.075:
            issues.append("ERROR: Projection beyond wall face less than 75mm minimum")
        
        # Check bearing capacity
        applied_pressure = self.wall_load / self.width
        is_safe, utilization = self.check_bearing_capacity(
            applied_pressure, self.soil_capacity
        )
        
        if not is_safe:
            issues.append(f"ERROR: Bearing capacity exceeded (utilization: {utilization:.1%})")
        elif utilization > 0.25:  # 75% of allowable with SF=3
            issues.append(f"WARNING: High bearing pressure (utilization: {utilization:.1%})")
        
        # Check width to depth ratio
        if self.width / self.depth > 3.0:
            issues.append("WARNING: Width/depth ratio exceeds 3.0 - consider deeper foundation")
        
        return issues
    
    def calculate_geometry(self) -> trimesh.Trimesh:
        """Generate 3D geometry for strip foundation"""
        # Calculate corner points of foundation
        offset_vector = self.wall_normal * (self.width / 2)
        
        # Bottom rectangle
        p1_bottom = np.append(self.wall_start - offset_vector, self.base_level - self.depth)
        p2_bottom = np.append(self.wall_end - offset_vector, self.base_level - self.depth)
        p3_bottom = np.append(self.wall_end + offset_vector, self.base_level - self.depth)
        p4_bottom = np.append(self.wall_start + offset_vector, self.base_level - self.depth)
        
        # Top rectangle
        p1_top = np.append(self.wall_start - offset_vector, self.base_level)
        p2_top = np.append(self.wall_end - offset_vector, self.base_level)
        p3_top = np.append(self.wall_end + offset_vector, self.base_level)
        p4_top = np.append(self.wall_start + offset_vector, self.base_level)
        
        # Create vertices
        vertices = np.array([
            p1_bottom, p2_bottom, p3_bottom, p4_bottom,  # 0-3: bottom
            p1_top, p2_top, p3_top, p4_top  # 4-7: top
        ])
        
        # Create faces (triangles)
        faces = np.array([
            # Bottom (facing down)
            [0, 2, 1], [0, 3, 2],
            # Top (facing up)
            [4, 5, 6], [4, 6, 7],
            # Side 1 (along wall_start side)
            [0, 1, 5], [0, 5, 4],
            # Side 2 (along wall_end side)
            [2, 3, 7], [2, 7, 6],
            # Side 3 (perpendicular -normal direction)
            [0, 4, 7], [0, 7, 3],
            # Side 4 (perpendicular +normal direction)
            [1, 2, 6], [1, 6, 5]
        ])
        
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
        
        # Apply color
        color_rgba = self.hex_to_rgba(self.material.color)
        mesh.visual.face_colors = color_rgba
        
        # Add attachment points at top surface (for wall connection)
        wall_center_start = np.append(self.wall_start, self.base_level)
        wall_center_end = np.append(self.wall_end, self.base_level)
        self.add_attachment_points([
            tuple(wall_center_start),
            tuple(wall_center_end)
        ])
        
        return mesh
    
    def get_design_parameters(self) -> Dict[str, Any]:
        """Return foundation design parameters"""
        applied_pressure = self.wall_load / self.width
        _, utilization = self.check_bearing_capacity(applied_pressure, self.soil_capacity)
        
        return {
            "wall_type": self.wall_type,
            "wall_start": self.wall_start.tolist(),
            "wall_end": self.wall_end.tolist(),
            "wall_length": float(self.wall_length),
            "wall_thickness": float(self.wall_thickness),
            "wall_load": float(self.wall_load),
            "foundation_width": float(self.width),
            "foundation_depth": float(self.depth),
            "base_level": float(self.base_level),
            "soil_capacity": float(self.soil_capacity),
            "applied_pressure": float(applied_pressure),
            "bearing_utilization": float(utilization),
            "projection_beyond_wall": float((self.width - self.wall_thickness) / 2),
            "reinforcement_zones": self.reinforcement_zones,
            "standard": "BS 8004:2015"
        }


class RCShearWallStripFoundation(StripFoundation):
    """
    Strip foundation specifically for RC shear walls
    Includes provisions for higher loads and moment transfer
    """
    
    def __init__(
        self,
        wall_start: Tuple[float, float],
        wall_end: Tuple[float, float],
        wall_thickness: float,
        wall_load: float,
        moment_load: float,  # kNm/m - moment about foundation base
        soil_capacity: float,
        width: Optional[float] = None,
        depth: float = 0.8,  # Deeper for RC walls
        base_level: float = 0.0,
        material: str = "C35/45",  # Higher grade for RC walls
        color: Optional[str] = None,
        reinforcement_zones: Optional[List[str]] = None
    ):
        """
        Initialize RC shear wall strip foundation
        
        Args:
            moment_load: Applied moment per meter (kNm/m)
            Other args same as StripFoundation
        """
        self.moment_load = moment_load
        
        # Calculate eccentricity from moment
        self.eccentricity = moment_load / wall_load if wall_load > 0 else 0
        
        # Adjust width for moment if needed
        if width is None:
            # Effective width considering eccentricity
            # Per Eurocode 7: effective width = width - 2*eccentricity
            required_width = self.calculate_minimum_width(
                total_load=wall_load,
                soil_capacity=soil_capacity,
                length=1.0,
                safety_factor=3.0
            )
            # Account for eccentricity
            width = required_width + 2 * abs(self.eccentricity)
        
        super().__init__(
            wall_start=wall_start,
            wall_end=wall_end,
            wall_thickness=wall_thickness,
            wall_load=wall_load,
            soil_capacity=soil_capacity,
            width=width,
            depth=depth,
            wall_type="rc_shear_wall",
            base_level=base_level,
            material=material,
            color=color,
            reinforcement_zones=reinforcement_zones or ["top", "bottom", "shear"]
        )
    
    def validate_design(self) -> List[str]:
        """Additional validation for RC shear wall foundations"""
        issues = super().validate_design()
        
        # Check eccentricity limits
        if abs(self.eccentricity) > self.width / 6:
            issues.append(
                f"ERROR: Eccentricity {abs(self.eccentricity):.3f}m exceeds kern limit "
                f"(width/6 = {self.width/6:.3f}m)"
            )
        elif abs(self.eccentricity) > self.width / 12:
            issues.append(
                f"WARNING: High eccentricity {abs(self.eccentricity):.3f}m "
                f"(>width/12)"
            )
        
        return issues
    
    def get_design_parameters(self) -> Dict[str, Any]:
        """Extended parameters for RC wall foundation"""
        params = super().get_design_parameters()
        params.update({
            "moment_load": float(self.moment_load),
            "eccentricity": float(self.eccentricity),
            "kern_limit": float(self.width / 6),
            "reinforcement_provision": "Full top and bottom with shear links"
        })
        return params