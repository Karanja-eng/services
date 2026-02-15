"""
Soak pit and soakaway design for effluent disposal.
Sized based on soil percolation rates and daily flow.
"""

import json
import math
from typing import Optional, Dict, List
from sanitary_core import (
    Point3D, Level, Dimension, MaterialType,
    DESIGN_CODE, validate_separation_distance,
    SanitaryEngineeringError, ConstructionError
)
from geometry_builder import MeshBuilder, generate_cylinder_mesh, generate_box_mesh, mesh_to_gltf


class SoilType:
    """Soil percolation characteristics"""
    GRAVEL = {"name": "gravel", "percolation_rate": 100, "coefficient": 0.5}
    COARSE_SAND = {"name": "coarse_sand", "percolation_rate": 60, "coefficient": 0.4}
    FINE_SAND = {"name": "fine_sand", "percolation_rate": 30, "coefficient": 0.3}
    SANDY_LOAM = {"name": "sandy_loam", "percolation_rate": 15, "coefficient": 0.2}
    LOAM = {"name": "loam", "percolation_rate": 8, "coefficient": 0.15}
    CLAY_LOAM = {"name": "clay_loam", "percolation_rate": 4, "coefficient": 0.1}
    CLAY = {"name": "clay", "percolation_rate": 1, "coefficient": 0.05}


class SoakPit:
    """
    Cylindrical or rectangular soak pit with perforated walls.
    
    Attributes:
        pit_id: Unique identifier
        location: Bottom center point (for circular) or corner (for rectangular)
        daily_flow: Expected daily flow in cubic meters
        soil_type: Soil percolation characteristics
        shape: "circular" or "rectangular"
    """
    
    def __init__(self,
                 pit_id: str,
                 location: Point3D,
                 daily_flow: float,
                 soil_type: Dict = SoilType.SANDY_LOAM,
                 shape: str = "circular",
                 groundwater_level: Optional[float] = None):
        
        self.pit_id = pit_id
        self.location = location
        self.daily_flow = daily_flow
        self.soil_type = soil_type
        self.shape = shape.lower()
        self.groundwater_level = groundwater_level
        
        if self.shape not in ["circular", "rectangular"]:
            raise ValueError(f"Shape must be 'circular' or 'rectangular', got '{shape}'")
        
        # Design pit
        self._design_pit()
        
        # Validate design
        self._validate_design()
    
    def _design_pit(self):
        """Calculate pit dimensions based on percolation"""
        
        # Percolation rate in mm/hour
        perc_rate = self.soil_type["percolation_rate"]
        
        # Convert to m/day
        perc_rate_m_day = (perc_rate / 1000) * 24
        
        # Required infiltration area (m²)
        # Using factor of safety of 2.0
        safety_factor = 2.0
        self.required_area = (self.daily_flow * safety_factor) / perc_rate_m_day
        
        # Standard pit depth (effective)
        self.effective_depth = 2.0  # meters
        
        if self.shape == "circular":
            # Calculate radius from required wall area
            # Wall area = 2 * pi * r * h
            # Solving for r: r = A / (2 * pi * h)
            self.radius = self.required_area / (2 * math.pi * self.effective_depth)
            
            # Minimum radius
            if self.radius < 0.75:
                self.radius = 0.75
            
            # Round to practical dimension
            self.radius = round(self.radius * 4) / 4  # Round to 0.25m
            
            # Actual infiltration area
            self.actual_area = 2 * math.pi * self.radius * self.effective_depth
            
            # Add base area (also perforated)
            base_area = math.pi * self.radius ** 2
            self.actual_area += base_area
            
            # Dimensions
            self.diameter = self.radius * 2
            self.length = None
            self.width = None
            
        else:  # rectangular
            # Use aspect ratio of 1.5:1
            # Area = perimeter * depth = 2(L+W) * h
            # With L = 1.5W: Area = 2(1.5W + W) * h = 5W * h
            # W = Area / (5h)
            
            self.width = self.required_area / (5 * self.effective_depth)
            
            if self.width < 1.0:
                self.width = 1.0
            
            self.length = self.width * 1.5
            
            # Round to practical dimensions
            self.width = round(self.width * 4) / 4
            self.length = round(self.length * 4) / 4
            
            # Actual area
            perimeter = 2 * (self.length + self.width)
            wall_area = perimeter * self.effective_depth
            base_area = self.length * self.width
            self.actual_area = wall_area + base_area
            
            self.radius = None
            self.diameter = None
        
        # Wall construction
        self.wall_type = "perforated_concrete_blocks"
        self.wall_thickness = 0.20  # 200mm perforated blocks
        
        # Gravel fill
        self.gravel_surround = 0.30  # 300mm gravel surround
        
        # Total depth including base and top
        self.base_gravel = 0.30  # 300mm base gravel
        self.top_cover = 0.30  # 300mm top cover
        self.total_depth = self.base_gravel + self.effective_depth + self.top_cover
        
        # Calculate levels
        ground_level = self.location.z
        cover_level = ground_level - 0.15  # 150mm below grade
        invert_level = cover_level - self.total_depth
        
        self.levels = Level(
            invert=invert_level,
            cover=cover_level,
            ground=ground_level
        )
        
        # Check groundwater clearance
        if self.groundwater_level is not None:
            clearance = invert_level - self.groundwater_level
            if clearance < DESIGN_CODE.MIN_CLEARANCE_TO_GROUNDWATER:
                raise ConstructionError(
                    f"Insufficient groundwater clearance: {clearance:.2f}m "
                    f"(minimum {DESIGN_CODE.MIN_CLEARANCE_TO_GROUNDWATER}m)"
                )
        
        # Inlet position (top of effective depth)
        inlet_level = invert_level + self.base_gravel + self.effective_depth - 0.2
        
        if self.shape == "circular":
            self.inlet_position = Point3D(
                self.location.x,  # Assume inlet from one side
                self.location.y,
                inlet_level
            )
        else:
            self.inlet_position = Point3D(
                self.location.x,
                self.location.y + self.width / 2,
                inlet_level
            )
        
        # Access cover
        if self.shape == "circular":
            cover_x = self.location.x
            cover_y = self.location.y
        else:
            cover_x = self.location.x + self.length / 2
            cover_y = self.location.y + self.width / 2
        
        from sanitary_core import MaintenanceAccess
        self.access_cover = MaintenanceAccess(
            access_type="inspection_cover",
            location=Point3D(cover_x, cover_y, cover_level),
            clear_opening_diameter=0.6,
            load_rating="B125"
        )
        
        # Overflow provision (if pit saturates)
        self.overflow_level = inlet_level + 0.1
        self.has_overflow = True
        
        # Storage volume
        if self.shape == "circular":
            self.storage_volume = math.pi * self.radius**2 * self.effective_depth
        else:
            self.storage_volume = self.length * self.width * self.effective_depth
        
        # Effective porosity (gravel fill)
        self.porosity = 0.4  # 40% voids in gravel
        self.effective_storage = self.storage_volume * self.porosity
    
    def _validate_design(self):
        """Validate pit design"""
        
        # Check area is adequate
        if self.actual_area < self.required_area * 0.95:
            raise ConstructionError(
                f"Infiltration area {self.actual_area:.2f}m² below required "
                f"{self.required_area:.2f}m²"
            )
        
        # Check depth is practical
        if self.total_depth > 3.5:
            raise ConstructionError(
                f"Total pit depth {self.total_depth:.2f}m exceeds practical limit (3.5m)"
            )
        
        # Check minimum effective depth
        if self.effective_depth < 1.0:
            raise ConstructionError(
                f"Effective depth {self.effective_depth:.2f}m too shallow (min 1.0m)"
            )
        
        # Warn if soil has poor percolation
        if self.soil_type["percolation_rate"] < 5:
            print(f"WARNING: Poor soil percolation ({self.soil_type['name']}). "
                  f"Consider alternative disposal method.")
    
    def validate_site_constraints(self,
                                  buildings: Optional[List[Point3D]] = None,
                                  wells: Optional[List[Point3D]] = None):
        """Validate separation distances"""
        
        if buildings:
            for building in buildings:
                validate_separation_distance(
                    self.location, building,
                    DESIGN_CODE.SOAKPIT_TO_BUILDING,
                    "Soak pit to building"
                )
        
        if wells:
            for well in wells:
                validate_separation_distance(
                    self.location, well,
                    DESIGN_CODE.SOAKPIT_TO_WELL,
                    "Soak pit to well"
                )
    
    def generate_geometry(self) -> MeshBuilder:
        """Generate 3D geometry"""
        
        if self.shape == "circular":
            # Outer cylinder (gravel surround)
            outer_radius = self.radius + self.gravel_surround
            
            mesh = generate_cylinder_mesh(
                center=Point3D(self.location.x, self.location.y, self.levels.invert),
                radius=outer_radius,
                height=self.total_depth,
                segments=20,
                wall_thickness=None  # Solid for visualization
            )
            
            # Inner honeycomb wall (perforated - shown as thin wall)
            inner_mesh = generate_cylinder_mesh(
                center=Point3D(
                    self.location.x,
                    self.location.y,
                    self.levels.invert + self.base_gravel
                ),
                radius=self.radius,
                height=self.effective_depth,
                segments=20,
                wall_thickness=self.wall_thickness
            )
            
            # Merge meshes
            mesh.vertices.extend(inner_mesh.vertices)
            mesh.normals.extend(inner_mesh.normals)
            offset = len(mesh.vertices) - len(inner_mesh.vertices)
            mesh.indices.extend([idx + offset for idx in inner_mesh.indices])
            
        else:  # rectangular
            # Outer box with gravel
            outer_dim = Dimension(
                length=self.length + 2 * self.gravel_surround,
                width=self.width + 2 * self.gravel_surround,
                height=self.total_depth
            )
            
            mesh = generate_box_mesh(
                origin=Point3D(
                    self.location.x - self.gravel_surround,
                    self.location.y - self.gravel_surround,
                    self.levels.invert
                ),
                dim=outer_dim,
                wall_thickness=None
            )
            
            # Inner chamber with perforated walls
            inner_dim = Dimension(
                length=self.length,
                width=self.width,
                height=self.effective_depth
            )
            
            inner_mesh = generate_box_mesh(
                origin=Point3D(
                    self.location.x,
                    self.location.y,
                    self.levels.invert + self.base_gravel
                ),
                dim=inner_dim,
                wall_thickness=(0.1, self.wall_thickness, 0.1)  # Thin top/bottom
            )
            
            # Merge
            mesh.vertices.extend(inner_mesh.vertices)
            mesh.normals.extend(inner_mesh.normals)
            offset = len(mesh.vertices) - len(inner_mesh.vertices)
            mesh.indices.extend([idx + offset for idx in inner_mesh.indices])
        
        return mesh
    
    def to_gltf(self) -> Dict:
        """Export as GLTF"""
        mesh = self.generate_geometry()
        return mesh_to_gltf(mesh, name=f"soakpit_{self.pit_id}")
    
    def to_json(self) -> Dict:
        """Export metadata"""
        data = {
            "id": self.pit_id,
            "system": "sanitation",
            "subsystem": "soakaway",
            "type": "effluent_disposal",
            "shape": self.shape,
            "location": self.location.to_dict(),
            "daily_flow_m3": self.daily_flow,
            "soil_type": self.soil_type["name"],
            "percolation_rate_mm_hr": self.soil_type["percolation_rate"],
            "dimensions": {
                "effective_depth": self.effective_depth,
                "total_depth": self.total_depth,
                "base_gravel": self.base_gravel,
                "top_cover": self.top_cover,
                "gravel_surround": self.gravel_surround
            },
            "infiltration": {
                "required_area_m2": self.required_area,
                "actual_area_m2": self.actual_area,
                "storage_volume_m3": self.storage_volume,
                "effective_storage_m3": self.effective_storage
            },
            "levels": {
                "invert": self.levels.invert,
                "cover": self.levels.cover,
                "ground": self.levels.ground,
                "inlet_invert": self.inlet_position.z,
                "overflow_level": self.overflow_level
            },
            "connections": {
                "inlet": self.inlet_position.to_dict(),
                "has_overflow": self.has_overflow
            },
            "access": {
                "type": self.access_cover.access_type,
                "location": self.access_cover.location.to_dict(),
                "diameter": self.access_cover.clear_opening_diameter
            },
            "construction": {
                "wall_type": self.wall_type,
                "wall_thickness": self.wall_thickness,
                "porosity": self.porosity
            }
        }
        
        if self.shape == "circular":
            data["dimensions"]["radius"] = self.radius
            data["dimensions"]["diameter"] = self.diameter
        else:
            data["dimensions"]["length"] = self.length
            data["dimensions"]["width"] = self.width
        
        return data


def design_soakaway_system(daily_flow: float,
                          site_location: Point3D,
                          soil_type: Dict = SoilType.SANDY_LOAM,
                          shape: str = "circular",
                          buildings: Optional[List[Point3D]] = None,
                          wells: Optional[List[Point3D]] = None) -> SoakPit:
    """
    Design soakaway system.
    
    Args:
        daily_flow: Expected daily effluent flow (m³/day)
        site_location: Proposed location
        soil_type: Soil percolation characteristics
        shape: "circular" or "rectangular"
        buildings: Building locations for separation
        wells: Well locations for separation
    
    Returns:
        Configured SoakPit instance
    """
    
    pit = SoakPit(
        pit_id=f"SP_{int(daily_flow*1000)}L",
        location=site_location,
        daily_flow=daily_flow,
        soil_type=soil_type,
        shape=shape
    )
    
    pit.validate_site_constraints(buildings=buildings, wells=wells)
    
    return pit