"""
Underground water storage tanks.
Reinforced concrete tanks for potable water, fire water, or recycled water.
"""

import json
import math
from typing import Optional, Dict, List
from sanitary_core import (
    Point3D, Level, Dimension, WallThickness, MaterialType,
    WaterSystemType, MaintenanceAccess, DESIGN_CODE,
    SeparationError, ConstructionError, validate_separation_distance
)
from geometry_builder import MeshBuilder, generate_box_mesh, generate_cylinder_mesh, mesh_to_gltf


class UndergroundWaterTank:
    """
    Reinforced concrete underground water storage tank.
    
    Attributes:
        tank_id: Unique identifier
        location: Bottom corner point
        capacity: Required capacity in cubic meters
        tank_type: Potable, fire, or recycled water
        shape: "rectangular" or "circular"
    """
    
    def __init__(self,
                 tank_id: str,
                 location: Point3D,
                 capacity: float,
                 tank_type: WaterSystemType = WaterSystemType.POTABLE_WATER,
                 shape: str = "rectangular",
                 material: MaterialType = MaterialType.REINFORCED_CONCRETE):
        
        self.tank_id = tank_id
        self.location = location
        self.capacity = capacity
        self.tank_type = tank_type
        self.shape = shape.lower()
        self.material = material
        
        if self.shape not in ["rectangular", "circular"]:
            raise ValueError(f"Shape must be 'rectangular' or 'circular'")
        
        if capacity <= 0:
            raise ValueError("Capacity must be positive")
        
        # Design tank
        self._design_tank()
        
        # Validate
        self._validate_design()
    
    def _design_tank(self):
        """Design tank dimensions and components"""
        
        # Standard depth for underground tanks: 2.5m to 4.0m
        # Optimize for excavation and structural efficiency
        
        if self.capacity <= 50:
            self.depth = 2.5
        elif self.capacity <= 200:
            self.depth = 3.0
        else:
            self.depth = 3.5
        
        # Calculate base area
        base_area = self.capacity / self.depth
        
        if self.shape == "rectangular":
            # Use aspect ratio 2:1 for efficiency
            self.width = (base_area / 2) ** 0.5
            self.length = self.width * 2
            
            # Round to practical dimensions
            self.width = round(self.width * 4) / 4
            self.length = round(self.length * 4) / 4
            
            # Recalculate actual capacity
            self.actual_capacity = self.length * self.width * self.depth
            
            self.radius = None
            self.diameter = None
            
        else:  # circular
            # Calculate radius
            self.radius = (base_area / math.pi) ** 0.5
            
            # Round to practical dimension
            self.radius = round(self.radius * 4) / 4
            
            # Actual capacity
            self.actual_capacity = math.pi * self.radius**2 * self.depth
            
            self.diameter = self.radius * 2
            self.length = None
            self.width = None
        
        # Wall thicknesses based on depth and hydrostatic pressure
        if self.depth <= 2.5:
            wall_thick = 0.20
            base_thick = 0.25
            top_thick = 0.20
        elif self.depth <= 3.5:
            wall_thick = 0.25
            base_thick = 0.30
            top_thick = 0.20
        else:
            wall_thick = 0.30
            base_thick = 0.35
            top_thick = 0.25
        
        self.wall_thickness = WallThickness(
            base_slab=base_thick,
            wall=wall_thick,
            top_slab=top_thick
        )
        
        # Calculate dimensions
        if self.shape == "rectangular":
            self.external_dim = Dimension(
                length=self.length + 2 * self.wall_thickness.wall,
                width=self.width + 2 * self.wall_thickness.wall,
                height=self.depth + self.wall_thickness.base_slab + self.wall_thickness.top_slab
            )
            
            self.internal_dim = Dimension(
                length=self.length,
                width=self.width,
                height=self.depth
            )
        
        # Freeboard (space between max water level and overflow)
        self.freeboard = 0.30  # 300mm
        self.max_water_level = self.depth - self.freeboard
        
        # Calculate levels
        ground_level = self.location.z
        cover_level = ground_level - 0.5  # 500mm below grade for access
        invert_level = cover_level - self.wall_thickness.base_slab - self.depth
        
        self.levels = Level(
            invert=invert_level,
            cover=cover_level,
            ground=ground_level
        )
        
        # Connection levels
        base_level = invert_level + self.wall_thickness.base_slab
        
        # Inlet at top
        self.inlet_level = base_level + self.max_water_level - 0.2
        
        # Outlet at bottom (with sump)
        self.outlet_level = base_level + 0.1  # 100mm above base
        
        # Overflow near top
        self.overflow_level = base_level + self.max_water_level
        
        # Washout at lowest point
        self.washout_level = base_level
        
        # Vent at top
        self.vent_level = cover_level + 2.0  # 2m above cover
        
        # Connection positions
        if self.shape == "rectangular":
            # Inlet on one end
            self.inlet_position = Point3D(
                self.location.x,
                self.location.y + self.external_dim.width / 2,
                self.inlet_level
            )
            
            # Outlet on opposite end
            self.outlet_position = Point3D(
                self.location.x + self.external_dim.length,
                self.location.y + self.external_dim.width / 2,
                self.outlet_level
            )
            
            # Overflow on side
            self.overflow_position = Point3D(
                self.location.x + self.external_dim.length / 2,
                self.location.y,
                self.overflow_level
            )
            
            # Washout at corner
            self.washout_position = Point3D(
                self.location.x,
                self.location.y,
                self.washout_level
            )
            
            # Vent on top
            self.vent_position = Point3D(
                self.location.x + self.external_dim.length / 2,
                self.location.y + self.external_dim.width / 2,
                self.vent_level
            )
            
        else:  # circular
            self.inlet_position = Point3D(
                self.location.x,
                self.location.y + self.radius,
                self.inlet_level
            )
            
            self.outlet_position = Point3D(
                self.location.x,
                self.location.y - self.radius,
                self.outlet_level
            )
            
            self.overflow_position = Point3D(
                self.location.x + self.radius,
                self.location.y,
                self.overflow_level
            )
            
            self.washout_position = Point3D(
                self.location.x,
                self.location.y,
                self.washout_level
            )
            
            self.vent_position = Point3D(
                self.location.x,
                self.location.y,
                self.vent_level
            )
        
        # Access manhole
        if self.shape == "rectangular":
            access_x = self.location.x + self.external_dim.length / 2
            access_y = self.location.y + self.external_dim.width / 4
        else:
            access_x = self.location.x
            access_y = self.location.y
        
        self.access_manhole = MaintenanceAccess(
            access_type="manhole",
            location=Point3D(access_x, access_y, cover_level),
            clear_opening_diameter=0.6,
            load_rating="B125"
        )
        
        # Treatment/chlorination space (for potable water)
        self.has_chlorination = (self.tank_type == WaterSystemType.POTABLE_WATER)
        
        # Anti-floatation design
        # Tank must be weighted or anchored if groundwater table is high
        self.requires_anti_floatation = True  # Conservative assumption
        
        # Pump chamber (if required)
        self.has_pump_chamber = True
        self.pump_chamber_volume = self.actual_capacity * 0.05  # 5% of capacity
    
    def _validate_design(self):
        """Validate tank design"""
        
        # Check capacity
        if self.actual_capacity < self.capacity * 0.95:
            raise ConstructionError(
                f"Tank capacity {self.actual_capacity:.2f}m³ below required "
                f"{self.capacity:.2f}m³"
            )
        
        # Check depth
        if self.depth < 1.5:
            raise ConstructionError(f"Tank depth {self.depth}m too shallow (min 1.5m)")
        
        if self.depth > 6.0:
            raise ConstructionError(f"Tank depth {self.depth}m too deep (max 6.0m)")
        
        # Check freeboard
        if self.freeboard < 0.15:
            raise ConstructionError(f"Freeboard {self.freeboard}m insufficient (min 0.15m)")
        
        # Validate outlet is below inlet
        if self.outlet_level >= self.inlet_level:
            raise ConstructionError("Outlet must be below inlet")
    
    def validate_site_constraints(self, 
                                  sewage_systems: Optional[List[Point3D]] = None):
        """
        Validate separation from sewage systems.
        
        Args:
            sewage_systems: List of septic tank or sewer locations
        """
        
        # Tank center
        if self.shape == "rectangular":
            tank_center = Point3D(
                self.location.x + self.external_dim.length / 2,
                self.location.y + self.external_dim.width / 2,
                self.location.z
            )
        else:
            tank_center = self.location
        
        # Water tanks must be separated from sewage
        if sewage_systems:
            for sewage_point in sewage_systems:
                validate_separation_distance(
                    tank_center, sewage_point,
                    15.0,  # Minimum 15m separation
                    "Water tank to sewage system"
                )
    
    def calculate_structural_load(self) -> Dict[str, float]:
        """Calculate structural loads for design"""
        
        # Hydrostatic pressure at base (kPa)
        water_density = 1000  # kg/m³
        gravity = 9.81  # m/s²
        hydrostatic_pressure = water_density * gravity * self.depth / 1000  # kPa
        
        # Soil pressure (assume saturated soil)
        soil_pressure = 18 * self.depth  # kPa (approximate)
        
        # Dead load of water
        water_weight = self.actual_capacity * 1000 * gravity / 1000  # kN
        
        # Buoyancy force (if groundwater present)
        if self.shape == "rectangular":
            volume_displaced = self.external_dim.volume()
        else:
            volume_displaced = math.pi * (self.radius + self.wall_thickness.wall)**2 * \
                             (self.depth + self.wall_thickness.base_slab + self.wall_thickness.top_slab)
        
        buoyancy_force = volume_displaced * 1000 * gravity / 1000  # kN
        
        return {
            "hydrostatic_pressure_kpa": hydrostatic_pressure,
            "soil_pressure_kpa": soil_pressure,
            "water_weight_kn": water_weight,
            "buoyancy_force_kn": buoyancy_force,
            "net_uplift_kn": max(0, buoyancy_force - water_weight)
        }
    
    def generate_geometry(self) -> MeshBuilder:
        """Generate 3D tank geometry"""
        
        if self.shape == "rectangular":
            mesh = generate_box_mesh(
                origin=self.location,
                dim=self.external_dim,
                wall_thickness=(
                    self.wall_thickness.base_slab,
                    self.wall_thickness.wall,
                    self.wall_thickness.top_slab
                )
            )
        else:  # circular
            mesh = generate_cylinder_mesh(
                center=self.location,
                radius=self.radius + self.wall_thickness.wall,
                height=self.depth + self.wall_thickness.base_slab + self.wall_thickness.top_slab,
                segments=24,
                wall_thickness=self.wall_thickness.wall
            )
        
        return mesh
    
    def to_gltf(self) -> Dict:
        """Export as GLTF"""
        mesh = self.generate_geometry()
        return mesh_to_gltf(mesh, name=f"water_tank_{self.tank_id}")
    
    def to_json(self) -> Dict:
        """Export metadata"""
        data = {
            "id": self.tank_id,
            "system": "water_supply",
            "subsystem": self.tank_type.value,
            "component_type": "underground_storage_tank",
            "shape": self.shape,
            "location": self.location.to_dict(),
            "capacity": {
                "design": self.capacity,
                "actual": self.actual_capacity,
                "unit": "cubic_meters",
                "max_water_level_m": self.max_water_level,
                "freeboard_m": self.freeboard
            },
            "dimensions": {
                "depth": self.depth,
                "wall_thickness": self.wall_thickness.wall,
                "base_thickness": self.wall_thickness.base_slab,
                "top_thickness": self.wall_thickness.top_slab
            },
            "levels": {
                "invert": self.levels.invert,
                "cover": self.levels.cover,
                "ground": self.levels.ground,
                "inlet": self.inlet_level,
                "outlet": self.outlet_level,
                "overflow": self.overflow_level,
                "washout": self.washout_level
            },
            "connections": {
                "inlet": self.inlet_position.to_dict(),
                "outlet": self.outlet_position.to_dict(),
                "overflow": self.overflow_position.to_dict(),
                "washout": self.washout_position.to_dict(),
                "vent": self.vent_position.to_dict()
            },
            "access": {
                "type": self.access_manhole.access_type,
                "location": self.access_manhole.location.to_dict(),
                "diameter": self.access_manhole.clear_opening_diameter
            },
            "material": self.material.value,
            "structural": self.calculate_structural_load(),
            "features": {
                "has_chlorination": self.has_chlorination,
                "has_pump_chamber": self.has_pump_chamber,
                "requires_anti_floatation": self.requires_anti_floatation
            }
        }
        
        if self.shape == "rectangular":
            data["dimensions"]["length"] = self.length
            data["dimensions"]["width"] = self.width
        else:
            data["dimensions"]["radius"] = self.radius
            data["dimensions"]["diameter"] = self.diameter
        
        return data


def design_potable_water_tank(capacity: float,
                              location: Point3D,
                              shape: str = "rectangular") -> UndergroundWaterTank:
    """Design potable water storage tank"""
    
    return UndergroundWaterTank(
        tank_id=f"PWT_{int(capacity)}m3",
        location=location,
        capacity=capacity,
        tank_type=WaterSystemType.POTABLE_WATER,
        shape=shape
    )


def design_fire_water_tank(capacity: float,
                           location: Point3D,
                           shape: str = "rectangular") -> UndergroundWaterTank:
    """Design fire water storage tank"""
    
    # Fire water tanks typically larger
    if capacity < 50:
        print("WARNING: Fire water tank capacity may be insufficient. "
              "Consult fire code requirements.")
    
    return UndergroundWaterTank(
        tank_id=f"FWT_{int(capacity)}m3",
        location=location,
        capacity=capacity,
        tank_type=WaterSystemType.FIRE_WATER,
        shape=shape
    )