"""
Septic tank design and generation.
Produces hydraulically correct, constructible septic systems.
"""

import json
from typing import Optional, List, Dict, Tuple
from sanitary_core import (
    Point3D, Level, Dimension, WallThickness, MaterialType,
    WaterSystemType, MaintenanceAccess, DESIGN_CODE,
    calculate_septic_capacity, validate_separation_distance,
    SanitaryEngineeringError, ConstructionError
)
from geometry_builder import MeshBuilder, generate_box_mesh, mesh_to_gltf


class SepticTank:
    """
    Reinforced concrete septic tank with chambers, baffles, and access.
    
    Attributes:
        tank_id: Unique identifier
        location: Bottom corner point
        population: Number of people served
        retention_hours: Wastewater retention time
        num_chambers: 1 or 2 chamber configuration
        material: Tank material (typically reinforced concrete)
    """
    
    def __init__(self, 
                 tank_id: str,
                 location: Point3D,
                 population: int,
                 retention_hours: float = 48.0,
                 num_chambers: int = 2,
                 material: MaterialType = MaterialType.REINFORCED_CONCRETE):
        
        self.tank_id = tank_id
        self.location = location
        self.population = population
        self.retention_hours = retention_hours
        self.num_chambers = num_chambers
        self.material = material
        
        # Design tank
        self._design_tank()
        
        # Validate
        self._validate_design()
    
    def _design_tank(self):
        """Calculate tank dimensions and components"""
        
        # Calculate required capacity
        self.capacity = calculate_septic_capacity(self.population, self.retention_hours)
        
        # Design dimensions (rectangular tank)
        # Length:Width ratio typically 2:1 to 3:1
        # Depth typically 1.5m to 2.0m
        
        # Standard depth
        self.depth = 2.0  # meters (internal)
        
        # Calculate base area needed
        base_area = self.capacity / self.depth
        
        # Use 2.5:1 length to width ratio
        width = (base_area / 2.5) ** 0.5
        length = width * 2.5
        
        # Round to practical dimensions
        self.width = self._round_dimension(width)
        self.length = self._round_dimension(length)
        
        # Recalculate actual capacity
        self.actual_capacity = self.length * self.width * self.depth
        
        # Wall thicknesses based on depth
        if self.depth <= 1.5:
            wall_thick = 0.15
            base_thick = 0.15
            top_thick = 0.15
        elif self.depth <= 2.5:
            wall_thick = 0.20
            base_thick = 0.20
            top_thick = 0.15
        else:
            wall_thick = 0.25
            base_thick = 0.25
            top_thick = 0.15
        
        self.wall_thickness = WallThickness(
            base_slab=base_thick,
            wall=wall_thick,
            top_slab=top_thick
        )
        
        # External dimensions
        self.external_dim = Dimension(
            length=self.length + 2 * self.wall_thickness.wall,
            width=self.width + 2 * self.wall_thickness.wall,
            height=self.depth + self.wall_thickness.base_slab + self.wall_thickness.top_slab
        )
        
        # Internal dimensions
        self.internal_dim = Dimension(
            length=self.length,
            width=self.width,
            height=self.depth
        )
        
        # Calculate levels
        ground_level = self.location.z  # Assuming location is at finished grade
        cover_level = ground_level - 0.3  # 300mm below grade
        invert_level = cover_level - self.external_dim.height
        
        self.levels = Level(
            invert=invert_level,
            cover=cover_level,
            ground=ground_level
        )
        
        # Inlet/outlet levels
        self.inlet_invert = invert_level + self.wall_thickness.base_slab + self.depth * 0.75
        self.outlet_invert = self.inlet_invert - 0.05  # 50mm drop
        
        # Chamber division
        if self.num_chambers == 2:
            # First chamber is 2/3, second is 1/3
            self.chamber1_length = self.length * 0.67
            self.chamber2_length = self.length * 0.33
            self.baffle_thickness = 0.15
        else:
            self.chamber1_length = self.length
            self.chamber2_length = 0
            self.baffle_thickness = 0
        
        # Access manholes
        self.access_covers = []
        
        # Cover over first chamber
        cover1_x = self.location.x + self.wall_thickness.wall + self.chamber1_length / 2
        cover1_y = self.location.y + self.external_dim.width / 2
        self.access_covers.append(
            MaintenanceAccess(
                access_type="manhole",
                location=Point3D(cover1_x, cover1_y, cover_level),
                clear_opening_diameter=0.6,
                load_rating="B125"  # Medium duty
            )
        )
        
        if self.num_chambers == 2:
            # Cover over second chamber
            cover2_x = self.location.x + self.wall_thickness.wall + self.chamber1_length + \
                      self.baffle_thickness + self.chamber2_length / 2
            cover2_y = cover1_y
            self.access_covers.append(
                MaintenanceAccess(
                    access_type="manhole",
                    location=Point3D(cover2_x, cover2_y, cover_level),
                    clear_opening_diameter=0.6,
                    load_rating="B125"
                )
            )
        
        # Vent pipe location
        self.vent_location = Point3D(
            self.location.x + self.external_dim.length - 0.3,
            self.location.y + self.external_dim.width - 0.3,
            cover_level + 2.0  # Extend 2m above cover
        )
        
        # Inlet and outlet positions
        # Inlet on end wall of chamber 1
        self.inlet_position = Point3D(
            self.location.x,  # Front wall
            self.location.y + self.external_dim.width / 2,
            self.inlet_invert
        )
        
        # Outlet on end wall (opposite end)
        self.outlet_position = Point3D(
            self.location.x + self.external_dim.length,  # Back wall
            self.location.y + self.external_dim.width / 2,
            self.outlet_invert
        )
        
        # Scum and sludge space calculations
        self.scum_space = 0.3  # 300mm at top
        self.sludge_space = 0.4  # 400mm at bottom
        self.liquid_depth = self.depth - self.scum_space - self.sludge_space
    
    def _round_dimension(self, value: float) -> float:
        """Round dimension to practical 0.1m increment"""
        return round(value * 10) / 10
    
    def _validate_design(self):
        """Validate tank design parameters"""
        
        # Check minimum capacity met
        if self.actual_capacity < self.capacity * 0.95:
            raise ConstructionError(
                f"Tank capacity {self.actual_capacity:.2f}m³ below required "
                f"{self.capacity:.2f}m³"
            )
        
        # Check depth is practical
        if self.depth < 1.2:
            raise ConstructionError(f"Tank depth {self.depth}m too shallow (min 1.2m)")
        if self.depth > 3.0:
            raise ConstructionError(f"Tank depth {self.depth}m too deep (max 3.0m)")
        
        # Check length to width ratio
        ratio = self.length / self.width
        if ratio < 1.5 or ratio > 4.0:
            raise ConstructionError(
                f"Tank L:W ratio {ratio:.1f} outside acceptable range (1.5-4.0)"
            )
        
        # Check inlet above outlet
        if self.inlet_invert <= self.outlet_invert:
            raise ConstructionError(
                f"Inlet invert {self.inlet_invert:.3f}m not above outlet "
                f"{self.outlet_invert:.3f}m"
            )
    
    def validate_site_constraints(self, 
                                  buildings: Optional[List[Point3D]] = None,
                                  wells: Optional[List[Point3D]] = None,
                                  property_lines: Optional[List[Point3D]] = None):
        """
        Validate separation distances from site features.
        
        Args:
            buildings: List of building corner points
            wells: List of well locations
            property_lines: List of property boundary points
        
        Raises:
            SeparationError: If separation distances violated
        """
        
        # Tank center point for distance checks
        tank_center = Point3D(
            self.location.x + self.external_dim.length / 2,
            self.location.y + self.external_dim.width / 2,
            self.location.z
        )
        
        if buildings:
            for building in buildings:
                validate_separation_distance(
                    tank_center, building,
                    DESIGN_CODE.SEPTIC_TO_BUILDING,
                    "Septic tank to building"
                )
        
        if wells:
            for well in wells:
                validate_separation_distance(
                    tank_center, well,
                    DESIGN_CODE.SEPTIC_TO_WELL,
                    "Septic tank to well"
                )
        
        if property_lines:
            for boundary_point in property_lines:
                validate_separation_distance(
                    tank_center, boundary_point,
                    DESIGN_CODE.SEPTIC_TO_PROPERTY_LINE,
                    "Septic tank to property line"
                )
    
    def generate_geometry(self) -> MeshBuilder:
        """Generate 3D mesh geometry for tank"""
        
        # Main tank body
        main_mesh = generate_box_mesh(
            origin=self.location,
            dim=self.external_dim,
            wall_thickness=(
                self.wall_thickness.base_slab,
                self.wall_thickness.wall,
                self.wall_thickness.top_slab
            )
        )
        
        # Add internal baffle if dual chamber
        if self.num_chambers == 2:
            baffle_origin = Point3D(
                self.location.x + self.wall_thickness.wall + self.chamber1_length,
                self.location.y + self.wall_thickness.wall,
                self.location.z + self.wall_thickness.base_slab
            )
            
            baffle_dim = Dimension(
                length=self.baffle_thickness,
                width=self.width,
                height=self.depth - 0.2  # Leave gap at top for flow
            )
            
            baffle_mesh = generate_box_mesh(
                origin=baffle_origin,
                dim=baffle_dim,
                wall_thickness=None  # Solid baffle
            )
            
            # Merge baffle into main mesh
            main_mesh.vertices.extend(baffle_mesh.vertices)
            main_mesh.normals.extend(baffle_mesh.normals)
            
            offset = len(main_mesh.vertices) - len(baffle_mesh.vertices)
            main_mesh.indices.extend([idx + offset for idx in baffle_mesh.indices])
        
        return main_mesh
    
    def to_gltf(self) -> Dict:
        """Export tank as GLTF"""
        mesh = self.generate_geometry()
        return mesh_to_gltf(mesh, name=f"septic_tank_{self.tank_id}")
    
    def to_json(self) -> Dict:
        """Export tank metadata as JSON"""
        return {
            "id": self.tank_id,
            "system": "sanitation",
            "subsystem": "septic_tank",
            "type": "black_water_treatment",
            "location": self.location.to_dict(),
            "dimensions": {
                "external": {
                    "length": self.external_dim.length,
                    "width": self.external_dim.width,
                    "height": self.external_dim.height
                },
                "internal": {
                    "length": self.internal_dim.length,
                    "width": self.internal_dim.width,
                    "height": self.internal_dim.height
                }
            },
            "capacity": {
                "design": self.capacity,
                "actual": self.actual_capacity,
                "unit": "cubic_meters"
            },
            "population_served": self.population,
            "retention_time_hours": self.retention_hours,
            "chambers": self.num_chambers,
            "levels": {
                "invert": self.levels.invert,
                "cover": self.levels.cover,
                "ground": self.levels.ground,
                "inlet_invert": self.inlet_invert,
                "outlet_invert": self.outlet_invert
            },
            "connections": {
                "inlet": self.inlet_position.to_dict(),
                "outlet": self.outlet_position.to_dict(),
                "vent": self.vent_location.to_dict()
            },
            "access_covers": [
                {
                    "type": cover.access_type,
                    "location": cover.location.to_dict(),
                    "diameter": cover.clear_opening_diameter,
                    "load_rating": cover.load_rating
                }
                for cover in self.access_covers
            ],
            "material": self.material.value,
            "wall_thickness": {
                "base_slab": self.wall_thickness.base_slab,
                "wall": self.wall_thickness.wall,
                "top_slab": self.wall_thickness.top_slab,
                "unit": "meters"
            },
            "operational": {
                "scum_space_m": self.scum_space,
                "sludge_space_m": self.sludge_space,
                "liquid_depth_m": self.liquid_depth,
                "desludging_frequency_months": 12 if self.population < 10 else 6
            }
        }
    
    def generate_construction_notes(self) -> List[str]:
        """Generate construction and maintenance notes"""
        notes = [
            f"Septic Tank {self.tank_id} - Construction Notes",
            f"Population served: {self.population} persons",
            f"Tank capacity: {self.actual_capacity:.2f} m³",
            f"Retention time: {self.retention_hours} hours",
            "",
            "Construction sequence:",
            "1. Excavate to design levels with 0.5m working space around tank",
            f"2. Pour base slab: {self.wall_thickness.base_slab*1000:.0f}mm thick reinforced concrete",
            "3. Construct walls with watertight joints",
            f"4. Install inlet tee at invert {self.inlet_invert:.3f}m",
            f"5. Install outlet tee at invert {self.outlet_invert:.3f}m",
        ]
        
        if self.num_chambers == 2:
            notes.append("6. Construct internal baffle with 200mm gap at top for flow")
            notes.append("7. Ensure baffle extends below liquid level")
            notes.append("8. Pour top slab with access manholes")
        else:
            notes.append("6. Pour top slab with access manhole")
        
        notes.extend([
            "9. Install vent pipe extending 2m above ground",
            "10. Backfill in layers with compaction",
            "11. Water test before commissioning",
            "",
            "Maintenance requirements:",
            f"- Inspect every 6 months",
            f"- Desludge when sludge depth exceeds {self.sludge_space*1000:.0f}mm",
            "- Check baffles and tees for integrity",
            "- Ensure vent is clear and unobstructed",
            "",
            "Safety:",
            "- Never enter tank without proper ventilation and safety equipment",
            "- Toxic gases present - use gas detector before entry",
            "- Provide adequate ventilation during desludging"
        ])
        
        return notes


def design_septic_system(population: int,
                        site_location: Point3D,
                        buildings: Optional[List[Point3D]] = None,
                        wells: Optional[List[Point3D]] = None) -> SepticTank:
    """
    High-level function to design complete septic tank system.
    
    Args:
        population: Number of people served
        site_location: Proposed tank location (at finished grade)
        buildings: Building locations for separation checks
        wells: Well locations for separation checks
    
    Returns:
        Configured SepticTank instance
    
    Raises:
        SanitaryEngineeringError: If design constraints violated
    """
    
    # Create tank with dual chambers for better treatment
    num_chambers = 2 if population > 5 else 1
    
    tank = SepticTank(
        tank_id=f"ST_{population}P",
        location=site_location,
        population=population,
        retention_hours=48.0,  # Standard retention
        num_chambers=num_chambers
    )
    
    # Validate site constraints
    tank.validate_site_constraints(buildings=buildings, wells=wells)
    
    return tank