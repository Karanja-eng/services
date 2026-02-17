"""
Raft Foundation Module
Full area shallow foundations with integrated beams
"""

import numpy as np
import trimesh
from typing import Tuple, List, Dict, Any, Optional
from foundation_base import FoundationBase, EngineeringException


class RaftFoundation(FoundationBase):
    """
    Raft foundation - full area slab foundation
    Per BS 8004:2015 Section 6 - Raft foundations
    """
    
    def __init__(
        self,
        footprint: List[Tuple[float, float]],
        slab_thickness: float,
        total_load: float,  # kN
        soil_capacity: float,  # kN/m²
        edge_beam_width: float = 0.3,
        edge_beam_depth: float = 0.0,  # 0 = no edge beam (downstand if >0)
        edge_beam_type: str = "downstand",  # "downstand" or "upstand"
        internal_ribs: Optional[List[Dict[str, Any]]] = None,
        base_level: float = 0.0,
        material: str = "C30/37",
        color: Optional[str] = None,
        reinforcement_zones: Optional[List[str]] = None
    ):
        """
        Initialize raft foundation
        
        Args:
            footprint: List of (x, y) polygon vertices defining raft boundary
            slab_thickness: Thickness of main slab (m)
            total_load: Total building load on raft (kN)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            edge_beam_width: Width of edge beam (m)
            edge_beam_depth: Depth of edge beam (m) - 0 for no beam
            edge_beam_type: "downstand" or "upstand"
            internal_ribs: List of internal beam definitions
            base_level: Z-coordinate of top of slab
            material: Concrete grade
            color: Hex color override
            reinforcement_zones: Reinforcement zone identifiers
        """
        super().__init__("raft_foundation", "full_area_raft", material, color)
        
        self.footprint = [np.array(p) for p in footprint]
        self.slab_thickness = slab_thickness
        self.total_load = total_load
        self.soil_capacity = soil_capacity
        self.edge_beam_width = edge_beam_width
        self.edge_beam_depth = edge_beam_depth
        self.edge_beam_type = edge_beam_type
        self.internal_ribs = internal_ribs or []
        self.base_level = base_level
        self.reinforcement_zones = reinforcement_zones or ["top", "bottom", "edge"]
        
        # Calculate raft area
        self.raft_area = self._calculate_polygon_area()
        
        # Validate
        issues = self.validate_design()
        critical_issues = [i for i in issues if "ERROR" in i]
        if critical_issues:
            raise EngineeringException("; ".join(critical_issues))
    
    def _calculate_polygon_area(self) -> float:
        """Calculate area of footprint polygon using shoelace formula"""
        n = len(self.footprint)
        area = 0.0
        
        for i in range(n):
            j = (i + 1) % n
            area += self.footprint[i][0] * self.footprint[j][1]
            area -= self.footprint[j][0] * self.footprint[i][1]
        
        return abs(area) / 2.0
    
    def validate_design(self) -> List[str]:
        """Validate raft foundation design"""
        issues = []
        
        # Check minimum slab thickness
        if self.slab_thickness < 0.2:
            issues.append("ERROR: Slab thickness less than minimum 200mm")
        elif self.slab_thickness < 0.3:
            issues.append("WARNING: Slab thickness less than recommended minimum 300mm")
        
        # Check bearing capacity
        applied_pressure = self.total_load / self.raft_area
        is_safe, utilization = self.check_bearing_capacity(
            applied_pressure, self.soil_capacity
        )
        
        if not is_safe:
            issues.append(f"ERROR: Bearing capacity exceeded (utilization: {utilization:.1%})")
        elif utilization > 0.25:
            issues.append(f"WARNING: High bearing pressure (utilization: {utilization:.1%})")
        
        # Check edge beam dimensions
        if self.edge_beam_depth > 0:
            if self.edge_beam_width < 0.2:
                issues.append("ERROR: Edge beam width less than minimum 200mm")
            if self.edge_beam_depth < 0.3:
                issues.append("WARNING: Edge beam depth less than typical minimum 300mm")
        
        # Check footprint validity
        if len(self.footprint) < 3:
            issues.append("ERROR: Footprint must have at least 3 vertices")
        
        if self.raft_area < 1.0:
            issues.append("WARNING: Very small raft area (<1m²)")
        
        return issues
    
    def calculate_geometry(self) -> trimesh.Trimesh:
        """Generate raft foundation geometry with beams"""
        meshes = []
        
        # Create main slab
        if self.edge_beam_type == "downstand":
            slab_base_z = self.base_level - self.slab_thickness
        else:  # upstand
            slab_base_z = self.base_level - self.slab_thickness - self.edge_beam_depth
        
        slab_mesh = self.create_extruded_polygon(
            polygon_points=[(p[0], p[1]) for p in self.footprint],
            height=self.slab_thickness,
            base_z=slab_base_z,
            color=self.material.color
        )
        meshes.append(slab_mesh)
        
        # Create edge beams if specified
        if self.edge_beam_depth > 0:
            for i in range(len(self.footprint)):
                next_i = (i + 1) % len(self.footprint)
                edge_beam = self._create_edge_beam(
                    self.footprint[i],
                    self.footprint[next_i]
                )
                meshes.append(edge_beam)
        
        # Create internal ribs if specified
        for rib in self.internal_ribs:
            rib_mesh = self._create_internal_rib(rib)
            if rib_mesh is not None:
                meshes.append(rib_mesh)
        
        # Combine all meshes
        combined_mesh = trimesh.util.concatenate(meshes)
        
        # Add attachment points along perimeter
        for point in self.footprint:
            attachment = np.append(point, self.base_level)
            self.add_attachment_points([tuple(attachment)])
        
        return combined_mesh
    
    def _create_edge_beam(
        self,
        start: np.ndarray,
        end: np.ndarray
    ) -> trimesh.Trimesh:
        """Create edge beam along one edge"""
        # Calculate beam direction
        beam_vector = end - start
        beam_length = np.linalg.norm(beam_vector)
        beam_direction = beam_vector / beam_length
        
        # Calculate perpendicular inward direction
        perp = np.array([-beam_direction[1], beam_direction[0]])
        
        # Determine beam base level
        if self.edge_beam_type == "downstand":
            beam_base_z = self.base_level - self.slab_thickness - self.edge_beam_depth
            beam_top_z = self.base_level - self.slab_thickness
        else:  # upstand
            beam_base_z = self.base_level - self.slab_thickness
            beam_top_z = self.base_level
        
        # Create beam vertices (offset inward from edge)
        half_width = self.edge_beam_width / 2
        
        # Bottom corners
        p1 = np.append(start - perp * half_width, beam_base_z)
        p2 = np.append(start + perp * half_width, beam_base_z)
        p3 = np.append(end + perp * half_width, beam_base_z)
        p4 = np.append(end - perp * half_width, beam_base_z)
        
        # Top corners
        p5 = np.append(start - perp * half_width, beam_top_z)
        p6 = np.append(start + perp * half_width, beam_top_z)
        p7 = np.append(end + perp * half_width, beam_top_z)
        p8 = np.append(end - perp * half_width, beam_top_z)
        
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
    
    def _create_internal_rib(self, rib_def: Dict[str, Any]) -> Optional[trimesh.Trimesh]:
        """Create internal rib/beam"""
        # Rib definition should include: start, end, width, depth, type
        if "start" not in rib_def or "end" not in rib_def:
            return None
        
        start = np.array(rib_def["start"])
        end = np.array(rib_def["end"])
        width = rib_def.get("width", 0.3)
        depth = rib_def.get("depth", 0.4)
        rib_type = rib_def.get("type", "downstand")
        
        # Similar to edge beam creation
        beam_vector = end - start
        beam_length = np.linalg.norm(beam_vector)
        beam_direction = beam_vector / beam_length
        
        perp = np.array([-beam_direction[1], beam_direction[0]])
        
        # Determine rib base level
        if rib_type == "downstand":
            rib_base_z = self.base_level - self.slab_thickness - depth
            rib_top_z = self.base_level - self.slab_thickness
        else:  # upstand
            rib_base_z = self.base_level - self.slab_thickness
            rib_top_z = self.base_level
        
        half_width = width / 2
        
        # Bottom corners
        p1 = np.append(start - perp * half_width, rib_base_z)
        p2 = np.append(start + perp * half_width, rib_base_z)
        p3 = np.append(end + perp * half_width, rib_base_z)
        p4 = np.append(end - perp * half_width, rib_base_z)
        
        # Top corners
        p5 = np.append(start - perp * half_width, rib_top_z)
        p6 = np.append(start + perp * half_width, rib_top_z)
        p7 = np.append(end + perp * half_width, rib_top_z)
        p8 = np.append(end - perp * half_width, rib_top_z)
        
        vertices = np.array([p1, p2, p3, p4, p5, p6, p7, p8])
        
        faces = np.array([
            [0, 2, 1], [0, 3, 2],
            [4, 5, 6], [4, 6, 7],
            [0, 1, 5], [0, 5, 4],
            [2, 3, 7], [2, 7, 6],
            [0, 4, 7], [0, 7, 3],
            [1, 2, 6], [1, 6, 5]
        ])
        
        return trimesh.Trimesh(vertices=vertices, faces=faces)
    
    def get_design_parameters(self) -> Dict[str, Any]:
        """Return raft foundation parameters"""
        applied_pressure = self.total_load / self.raft_area
        _, utilization = self.check_bearing_capacity(applied_pressure, self.soil_capacity)
        
        return {
            "footprint_vertices": [p.tolist() for p in self.footprint],
            "raft_area": float(self.raft_area),
            "slab_thickness": float(self.slab_thickness),
            "total_load": float(self.total_load),
            "soil_capacity": float(self.soil_capacity),
            "applied_pressure": float(applied_pressure),
            "bearing_utilization": float(utilization),
            "edge_beam_width": float(self.edge_beam_width),
            "edge_beam_depth": float(self.edge_beam_depth),
            "edge_beam_type": self.edge_beam_type,
            "num_internal_ribs": len(self.internal_ribs),
            "internal_ribs": self.internal_ribs,
            "base_level": float(self.base_level),
            "reinforcement_zones": self.reinforcement_zones,
            "standard": "BS 8004:2015"
        }


class LiftShaftRaftFoundation(RaftFoundation):
    """
    Specialized raft foundation for elevator/lift shaft
    """
    
    def __init__(
        self,
        shaft_footprint: List[Tuple[float, float]],
        shaft_load: float,  # Total load from lift shaft (kN)
        soil_capacity: float,
        slab_thickness: float = 0.4,  # Thicker for lift loads
        upstand_beam_height: float = 0.5,  # Height of upstand around perimeter
        upstand_beam_width: float = 0.3,
        base_level: float = 0.0,
        material: str = "C35/45",  # Higher grade for lift shaft
        color: Optional[str] = None,
        pit_depth: float = 0.0  # Additional pit depth if required
    ):
        """
        Initialize lift shaft raft foundation
        
        Args:
            shaft_footprint: Polygon defining lift shaft boundary
            shaft_load: Total load including lift equipment and loads
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            slab_thickness: Thickness of base slab (m)
            upstand_beam_height: Height of perimeter upstand beam (m)
            upstand_beam_width: Width of upstand beam (m)
            base_level: Z-coordinate of top of slab
            material: Concrete grade
            color: Hex color override
            pit_depth: Additional depth for lift pit if required
        """
        self.pit_depth = pit_depth
        self.upstand_beam_height = upstand_beam_height
        
        super().__init__(
            footprint=shaft_footprint,
            slab_thickness=slab_thickness,
            total_load=shaft_load,
            soil_capacity=soil_capacity,
            edge_beam_width=upstand_beam_width,
            edge_beam_depth=upstand_beam_height,
            edge_beam_type="upstand",
            internal_ribs=[],  # No internal ribs for lift shaft
            base_level=base_level,
            material=material,
            color=color,
            reinforcement_zones=["top", "bottom", "upstand", "shear"]
        )
        
        # Update subtype
        self.foundation_subtype = "lift_shaft_raft"
    
    def validate_design(self) -> List[str]:
        """Additional validation for lift shaft raft"""
        issues = super().validate_design()
        
        # Check minimum slab thickness for lift loads
        if self.slab_thickness < 0.35:
            issues.append("WARNING: Slab thickness less than typical lift shaft minimum 350mm")
        
        # Check upstand height
        if self.upstand_beam_height < 0.3:
            issues.append("WARNING: Upstand beam height less than typical minimum 300mm")
        
        # Check for pit depth if specified
        if self.pit_depth > 0:
            if self.slab_thickness < 0.4:
                issues.append(
                    "WARNING: Thin slab for lift pit - consider thicker slab for deeper pit"
                )
        
        return issues
    
    def get_design_parameters(self) -> Dict[str, Any]:
        """Extended parameters for lift shaft raft"""
        params = super().get_design_parameters()
        params.update({
            "foundation_type": "lift_shaft_raft",
            "pit_depth": float(self.pit_depth),
            "upstand_beam_height": float(self.upstand_beam_height),
            "special_requirements": [
                "Anti-vibration consideration",
                "Drainage provision",
                "Equipment anchorage points"
            ]
        })
        return params