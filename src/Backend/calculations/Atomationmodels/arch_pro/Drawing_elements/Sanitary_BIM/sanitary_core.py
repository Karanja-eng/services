"""
Core data structures and enumerations for sanitary engineering BIM system.
Production-ready implementation with full validation.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict
import math


class WaterSystemType(Enum):
    """Water system classification"""
    BLACK_WATER = "black_water"
    GREY_WATER = "grey_water"
    STORM_WATER = "storm_water"
    POTABLE_WATER = "potable_water"
    FIRE_WATER = "fire_water"
    RECYCLED_WATER = "recycled_water"


class MaterialType(Enum):
    """Construction materials"""
    REINFORCED_CONCRETE = "reinforced_concrete"
    PVC = "pvc"
    HDPE = "hdpe"
    VITRIFIED_CLAY = "vitrified_clay"
    DUCTILE_IRON = "ductile_iron"
    CONCRETE_BRICK = "concrete_brick"
    PERFORATED_CONCRETE = "perforated_concrete"


class PipeType(Enum):
    """Pipe classifications"""
    SOIL_STACK = "soil_stack"
    BRANCH_DRAIN = "branch_drain"
    MAIN_DRAIN = "main_drain"
    SEWER_LINE = "sewer_line"
    VENT_PIPE = "vent_pipe"
    OVERFLOW = "overflow"
    SUPPLY = "supply"


class FixtureType(Enum):
    """Sanitary fixtures"""
    WC = "wc"
    URINAL = "urinal"
    SINK = "sink"
    SHOWER = "shower"
    BATH = "bath"
    WASHING_MACHINE = "washing_machine"
    DISHWASHER = "dishwasher"
    FLOOR_DRAIN = "floor_drain"


@dataclass
class Point3D:
    """3D point with coordinate validation"""
    x: float
    y: float
    z: float  # z is elevation (vertical)
    
    def __post_init__(self):
        if not all(isinstance(v, (int, float)) for v in [self.x, self.y, self.z]):
            raise ValueError("Coordinates must be numeric")
    
    def distance_to(self, other: 'Point3D') -> float:
        """Euclidean distance"""
        return math.sqrt(
            (self.x - other.x)**2 + 
            (self.y - other.y)**2 + 
            (self.z - other.z)**2
        )
    
    def horizontal_distance_to(self, other: 'Point3D') -> float:
        """Horizontal distance (ignoring elevation)"""
        return math.sqrt(
            (self.x - other.x)**2 + 
            (self.y - other.y)**2
        )
    
    def to_tuple(self) -> Tuple[float, float, float]:
        return (self.x, self.y, self.z)
    
    def to_dict(self) -> Dict[str, float]:
        return {"x": self.x, "y": self.y, "z": self.z}


@dataclass
class Level:
    """Elevation reference with validation"""
    invert: float  # Bottom of pipe/tank interior
    cover: Optional[float] = None  # Top of structure
    ground: Optional[float] = None  # Finished ground level
    
    def __post_init__(self):
        """Validate level relationships"""
        if self.cover is not None and self.cover <= self.invert:
            raise ValueError(f"Cover level ({self.cover}) must be above invert ({self.invert})")
        
        if self.ground is not None:
            if self.cover is not None and self.ground < self.cover:
                raise ValueError(f"Ground level ({self.ground}) below cover ({self.cover})")
    
    def depth_below_ground(self) -> Optional[float]:
        """Calculate burial depth"""
        if self.ground is not None:
            return self.ground - self.invert
        return None
    
    def freeboard(self) -> Optional[float]:
        """Calculate freeboard (cover to ground)"""
        if self.ground is not None and self.cover is not None:
            return self.ground - self.cover
        return None


@dataclass
class HydraulicProperties:
    """Hydraulic design parameters"""
    flow_rate: float  # L/s or m³/day
    velocity: Optional[float] = None  # m/s
    slope: Optional[float] = None  # %
    retention_time: Optional[float] = None  # hours
    
    def __post_init__(self):
        if self.flow_rate < 0:
            raise ValueError("Flow rate must be positive")
        if self.velocity is not None and self.velocity < 0:
            raise ValueError("Velocity must be positive")
        if self.slope is not None and self.slope < 0:
            raise ValueError("Slope must be positive")


@dataclass
class Dimension:
    """Physical dimensions with validation"""
    length: float
    width: float
    height: float
    
    def __post_init__(self):
        if any(d <= 0 for d in [self.length, self.width, self.height]):
            raise ValueError("All dimensions must be positive")
    
    def volume(self) -> float:
        """Calculate volume in cubic meters"""
        return self.length * self.width * self.height
    
    def base_area(self) -> float:
        """Calculate base area"""
        return self.length * self.width


@dataclass
class WallThickness:
    """Structural wall parameters"""
    base_slab: float
    wall: float
    top_slab: float
    
    def __post_init__(self):
        if any(t <= 0 for t in [self.base_slab, self.wall, self.top_slab]):
            raise ValueError("All thicknesses must be positive")
        
        # Minimum structural thicknesses (meters)
        if self.base_slab < 0.15:
            raise ValueError(f"Base slab too thin: {self.base_slab}m (min 0.15m)")
        if self.wall < 0.10:
            raise ValueError(f"Wall too thin: {self.wall}m (min 0.10m)")


class SanitaryEngineeringError(Exception):
    """Base exception for sanitary engineering violations"""
    pass


class HydraulicError(SanitaryEngineeringError):
    """Hydraulic design violations"""
    pass


class SeparationError(SanitaryEngineeringError):
    """Separation distance violations"""
    pass


class ConstructionError(SanitaryEngineeringError):
    """Constructibility violations"""
    pass


@dataclass
class DesignCode:
    """Design code parameters and limits"""
    
    # Minimum pipe slopes (%)
    MIN_SLOPE_100MM: float = 1.0
    MIN_SLOPE_150MM: float = 0.6
    MIN_SLOPE_200MM: float = 0.4
    MIN_SLOPE_300MM: float = 0.3
    
    # Minimum pipe velocities (m/s)
    MIN_VELOCITY_SELF_CLEANSING: float = 0.6
    MAX_VELOCITY_EROSION: float = 3.0
    
    # Separation distances (meters)
    SEPTIC_TO_BUILDING: float = 5.0
    SEPTIC_TO_WELL: float = 15.0
    SEPTIC_TO_PROPERTY_LINE: float = 1.5
    SOAKPIT_TO_BUILDING: float = 5.0
    SOAKPIT_TO_WELL: float = 15.0
    
    # Manhole spacing (meters)
    MAX_MANHOLE_SPACING: float = 90.0
    MAX_INSPECTION_CHAMBER_SPACING: float = 45.0
    
    # Minimum cover depths (meters)
    MIN_COVER_PEDESTRIAN: float = 0.6
    MIN_COVER_VEHICULAR: float = 0.9
    
    # Septic tank retention times (hours)
    MIN_RETENTION_TIME: float = 24.0
    RECOMMENDED_RETENTION_TIME: float = 48.0
    
    # Septic tank capacities (liters per person per day)
    WASTEWATER_GENERATION_RATE: float = 150.0
    
    # Groundwater clearance (meters)
    MIN_CLEARANCE_TO_GROUNDWATER: float = 1.5
    
    def get_min_slope(self, diameter_mm: float) -> float:
        """Get minimum slope for pipe diameter"""
        if diameter_mm <= 100:
            return self.MIN_SLOPE_100MM
        elif diameter_mm <= 150:
            return self.MIN_SLOPE_150MM
        elif diameter_mm <= 200:
            return self.MIN_SLOPE_200MM
        else:
            return self.MIN_SLOPE_300MM
    
    def get_min_cover(self, traffic_loading: str) -> float:
        """Get minimum cover depth for traffic loading"""
        if traffic_loading.lower() in ["pedestrian", "light"]:
            return self.MIN_COVER_PEDESTRIAN
        else:
            return self.MIN_COVER_VEHICULAR


# Global design code instance
DESIGN_CODE = DesignCode()


@dataclass
class FlowPath:
    """Represents a flow path through the system"""
    nodes: List[str] = field(default_factory=list)
    system_type: Optional[WaterSystemType] = None
    total_drop: float = 0.0
    
    def add_node(self, node_id: str, elevation_drop: float = 0.0):
        """Add node to flow path"""
        self.nodes.append(node_id)
        self.total_drop += elevation_drop
    
    def validate_flow_direction(self) -> bool:
        """Ensure positive flow direction (gravity)"""
        return self.total_drop >= 0


@dataclass
class MaintenanceAccess:
    """Maintenance access requirements"""
    access_type: str  # "manhole", "inspection_cover", "cleanout"
    location: Point3D
    clear_opening_diameter: float  # meters
    load_rating: str  # "A15", "B125", "D400" etc.
    
    def __post_init__(self):
        if self.clear_opening_diameter < 0.6:
            raise ValueError(f"Access opening too small: {self.clear_opening_diameter}m (min 0.6m)")


def calculate_pipe_slope(start_invert: float, end_invert: float, 
                        horizontal_length: float) -> float:
    """
    Calculate pipe slope as percentage.
    
    Args:
        start_invert: Starting invert elevation (m)
        end_invert: Ending invert elevation (m)
        horizontal_length: Horizontal distance (m)
    
    Returns:
        Slope as percentage
    
    Raises:
        HydraulicError: If slope is negative (backfall)
    """
    if horizontal_length <= 0:
        raise ValueError("Horizontal length must be positive")
    
    drop = start_invert - end_invert
    
    if drop < 0:
        raise HydraulicError(
            f"Negative slope detected (backfall): "
            f"start={start_invert:.3f}m, end={end_invert:.3f}m, "
            f"rise={-drop:.3f}m over {horizontal_length:.2f}m"
        )
    
    slope_percent = (drop / horizontal_length) * 100
    return slope_percent


def calculate_septic_capacity(population: int, retention_hours: float = 48.0) -> float:
    """
    Calculate septic tank capacity based on population.
    
    Args:
        population: Number of people served
        retention_hours: Retention time in hours
    
    Returns:
        Required capacity in cubic meters
    """
    if population <= 0:
        raise ValueError("Population must be positive")
    
    if retention_hours < DESIGN_CODE.MIN_RETENTION_TIME:
        raise ValueError(
            f"Retention time {retention_hours}h below minimum "
            f"{DESIGN_CODE.MIN_RETENTION_TIME}h"
        )
    
    # Daily wastewater generation
    daily_flow = population * DESIGN_CODE.WASTEWATER_GENERATION_RATE / 1000  # m³/day
    
    # Required volume
    volume = daily_flow * (retention_hours / 24.0)
    
    # Add sludge and scum space (30% additional)
    total_capacity = volume * 1.3
    
    return total_capacity


def validate_separation_distance(point1: Point3D, point2: Point3D, 
                                 min_distance: float, 
                                 description: str) -> None:
    """
    Validate horizontal separation distance.
    
    Raises:
        SeparationError: If separation is insufficient
    """
    actual_distance = point1.horizontal_distance_to(point2)
    
    if actual_distance < min_distance:
        raise SeparationError(
            f"{description} separation insufficient: "
            f"{actual_distance:.2f}m < {min_distance:.2f}m required"
        )