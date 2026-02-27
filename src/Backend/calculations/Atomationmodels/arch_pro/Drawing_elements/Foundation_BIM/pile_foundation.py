"""
Pile Foundation Module
Deep foundations using piles and caps
"""

import numpy as np
import trimesh
from typing import Tuple, List, Dict, Any, Optional
from foundation_base import FoundationBase, EngineeringException


class Pile(FoundationBase):
    """
    Individual pile element
    """
    
    def __init__(
        self,
        position: Tuple[float, float],
        diameter: float,
        length: float,
        base_level: float = 0.0,
        material: str = "C35/45",
        color: Optional[str] = None
    ):
        super().__init__("pile", "individual_pile", material, color)
        self.position = np.array(position)
        self.diameter = diameter
        self.length = length
        self.base_level = base_level
        
    def calculate_geometry(self) -> trimesh.Trimesh:
        """Generate cylinder for pile"""
        # Center of cylinder is at midpoint of height
        center_z = self.base_level - (self.length / 2)
        center = (self.position[0], self.position[1], center_z)
        
        return self.create_cylinder_mesh(
            center=center,
            radius=self.diameter / 2,
            height=self.length,
            color=self.material.color
        )
        
    def validate_design(self) -> List[str]:
        issues = []
        if self.diameter < 0.3:
            issues.append("WARNING: Pile diameter less than typical minimum 300mm")
        if self.length < 3.0:
            issues.append("WARNING: Very short pile (<3m)")
        return issues
        
    def get_design_parameters(self) -> Dict[str, Any]:
        return {
            "pile_diameter": float(self.diameter),
            "pile_length": float(self.length),
            "position": self.position.tolist(),
            "base_level": float(self.base_level)
        }


class PileGroup:
    """
    Collection of piles in a specific arrangement
    """
    
    def __init__(
        self,
        center_position: Tuple[float, float],
        pile_diameter: float,
        pile_length: float,
        pile_capacity: float,
        total_load: float,
        spacing: Optional[float] = None,
        pattern: str = "square",
        material: str = "C35/45"
    ):
        self.center = np.array(center_position)
        self.pile_diameter = pile_diameter
        self.pile_length = pile_length
        self.pile_capacity = pile_capacity
        self.total_load = total_load
        self.material = material
        
        # Calculate number of piles
        self.n_piles = int(np.ceil(total_load / pile_capacity))
        self.n_piles = max(self.n_piles, 2)  # Minimum 2 piles for a group
        
        # Spacing (default 3D)
        self.spacing = spacing if spacing else 3.0 * pile_diameter
        
        # Arrangement
        self.pile_positions = self._generate_arrangement(pattern)
        
    def _generate_arrangement(self, pattern: str) -> List[np.ndarray]:
        """Generate pile positions relative to group center"""
        positions = []
        
        if self.n_piles <= 2:
            # 2 piles
            positions.append(np.array([-self.spacing/2, 0]))
            positions.append(np.array([self.spacing/2, 0]))
        elif self.n_piles <= 4:
            # 4 piles (square)
            s = self.spacing / 2
            positions = [
                np.array([-s, -s]), np.array([s, -s]),
                np.array([s, s]), np.array([-s, s])
            ]
        elif self.n_piles <= 6:
            # 6 piles (2x3)
            sx, sy = self.spacing, self.spacing/2
            positions = [
                np.array([-sx, -sy]), np.array([0, -sy]), np.array([sx, -sy]),
                np.array([-sx, sy]), np.array([0, sy]), np.array([sx, sy])
            ]
        else:
            # Grid
            cols = int(np.ceil(np.sqrt(self.n_piles)))
            rows = int(np.ceil(self.n_piles / cols))
            
            offset_x = (cols - 1) * self.spacing / 2
            offset_y = (rows - 1) * self.spacing / 2
            
            for r in range(rows):
                for c in range(cols):
                    if len(positions) < self.n_piles:
                        positions.append(np.array([
                            c * self.spacing - offset_x,
                            r * self.spacing - offset_y
                        ]))
                        
        return [p + self.center for p in positions]


class PileCap(FoundationBase):
    """
    Reinforced concrete cap on top of a pile group
    """
    
    def __init__(
        self,
        pile_group: PileGroup,
        column_size: Tuple[float, float],
        depth: Optional[float] = None,
        overhang: float = 0.15,
        base_level: float = 0.0,
        material: str = "C35/45",
        color: Optional[str] = None
    ):
        super().__init__("pile_cap", "standard_pile_cap", material, color)
        self.pile_group = pile_group
        self.column_size = column_size
        self.overhang = overhang
        self.base_level = base_level
        
        # Bounding box of piles
        pts = np.array(pile_group.pile_positions)
        min_p = pts.min(axis=0)
        max_p = pts.max(axis=0)
        
        # Cap dimensions
        self.width = (max_p[0] - min_p[0]) + pile_group.pile_diameter + 2 * overhang
        self.depth_dim = (max_p[1] - min_p[1]) + pile_group.pile_diameter + 2 * overhang
        
        # Slab depth (rule of thumb: spacing/2 or min 600mm)
        self.depth = depth if depth else max(0.6, pile_group.spacing / 2)
        
    def calculate_geometry(self) -> trimesh.Trimesh:
        """Generate cap box and piles"""
        # Create cap box
        # Top of cap is at base_level
        cap_center_z = self.base_level - (self.depth / 2)
        cap_center = (self.pile_group.center[0], self.pile_group.center[1], cap_center_z)
        
        cap_mesh = self.create_box_mesh(
            center=cap_center,
            dimensions=(self.width, self.depth_dim, self.depth),
            color=self.material.color
        )
        
        # Create pile meshes
        pile_meshes = []
        for pos in self.pile_group.pile_positions:
            # Piles embedded 100mm into cap
            pile_top_z = self.base_level - self.depth + 0.1
            pile = Pile(
                position=pos,
                diameter=self.pile_group.pile_diameter,
                length=self.pile_group.pile_length,
                base_level=pile_top_z,
                material=self.pile_group.material,
                color="#5a5a5a"  # Slightly darker for piles
            )
            pile_meshes.append(pile.to_trimesh())
            
        # Combine
        return trimesh.util.concatenate([cap_mesh] + pile_meshes)
        
    def validate_design(self) -> List[str]:
        issues = []
        if self.depth < 0.6:
            issues.append("ERROR: Pile cap depth less than minimum 600mm (BS 8004)")
        
        # Check if piles are within cap
        # (Already handled by construction logic)
        
        return issues
        
    def get_design_parameters(self) -> Dict[str, Any]:
        return {
            "cap_width": float(self.width),
            "cap_depth_dim": float(self.depth_dim),
            "cap_thickness": float(self.depth),
            "num_piles": self.pile_group.n_piles,
            "pile_diameter": float(self.pile_group.pile_diameter),
            "pile_spacing": float(self.pile_group.spacing),
            "column_size": list(self.column_size),
            "total_load": float(self.pile_group.total_load)
        }
