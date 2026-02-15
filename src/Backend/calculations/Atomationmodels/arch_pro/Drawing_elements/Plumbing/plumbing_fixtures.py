"""
Plumbing Fixture Library
Production-grade parametric plumbing fixtures with connection nodes and metadata
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict
from enum import Enum


class TrapType(Enum):
    """Standard trap types"""
    P_TRAP = "p_trap"
    S_TRAP = "s_trap"
    BOTTLE_TRAP = "bottle_trap"
    RUNNING_TRAP = "running_trap"
    DRUM_TRAP = "drum_trap"


class FixureType(Enum):
    """Fixture categories"""
    WC = "wc"
    WASH_BASIN = "wash_basin"
    KITCHEN_SINK = "kitchen_sink"
    SHOWER = "shower"
    BATHTUB = "bathtub"
    URINAL = "urinal"
    BIDET = "bidet"
    WASHING_MACHINE = "washing_machine"
    DISHWASHER = "dishwasher"
    FLOOR_DRAIN = "floor_drain"
    EXTERNAL_TAP = "external_tap"


@dataclass
class ConnectionNode:
    """Physical connection point on a fixture"""
    name: str
    position: np.ndarray  # [x, y, z] relative to fixture origin
    diameter: float  # mm
    connection_type: str  # "supply_hot", "supply_cold", "waste", "vent"
    direction: np.ndarray  # [x, y, z] unit vector


@dataclass
class ClearanceEnvelope:
    """Required clearance space around fixture"""
    front: float  # mm
    back: float  # mm
    left: float  # mm
    right: float  # mm
    top: float  # mm
    bottom: float  # mm


class PlumbingFixture:
    """Base class for all plumbing fixtures"""
    
    def __init__(
        self,
        fixture_type: FixureType,
        position: np.ndarray,
        rotation: float = 0.0,  # degrees around Z-axis
        fixture_id: Optional[str] = None
    ):
        self.fixture_type = fixture_type
        self.position = np.array(position, dtype=float)
        self.rotation = rotation
        self.fixture_id = fixture_id or f"{fixture_type.value}_{id(self)}"
        
        # To be set by subclasses
        self.dimensions: Tuple[float, float, float] = (0, 0, 0)  # width, depth, height
        self.mounting_height: float = 0.0  # mm from floor
        self.connection_nodes: List[ConnectionNode] = []
        self.trap_type: Optional[TrapType] = None
        self.vent_required: bool = False
        self.clearance: ClearanceEnvelope = ClearanceEnvelope(0, 0, 0, 0, 0, 0)
        self.fixture_units: float = 0.0  # For pipe sizing
        
    def get_world_connection_nodes(self) -> List[ConnectionNode]:
        """Transform connection nodes to world coordinates"""
        nodes = []
        rot_rad = np.radians(self.rotation)
        cos_r = np.cos(rot_rad)
        sin_r = np.sin(rot_rad)
        
        for node in self.connection_nodes:
            # Rotate position
            x, y, z = node.position
            world_x = cos_r * x - sin_r * y + self.position[0]
            world_y = sin_r * x + cos_r * y + self.position[1]
            world_z = z + self.position[2]
            
            # Rotate direction
            dx, dy, dz = node.direction
            world_dx = cos_r * dx - sin_r * dy
            world_dy = sin_r * dx + cos_r * dy
            
            world_node = ConnectionNode(
                name=node.name,
                position=np.array([world_x, world_y, world_z]),
                diameter=node.diameter,
                connection_type=node.connection_type,
                direction=np.array([world_dx, world_dy, dz])
            )
            nodes.append(world_node)
        
        return nodes
    
    def to_dict(self) -> Dict:
        """Export fixture metadata"""
        return {
            "fixture_id": self.fixture_id,
            "fixture_type": self.fixture_type.value,
            "position": self.position.tolist(),
            "rotation": self.rotation,
            "dimensions": self.dimensions,
            "mounting_height": self.mounting_height,
            "trap_type": self.trap_type.value if self.trap_type else None,
            "vent_required": self.vent_required,
            "fixture_units": self.fixture_units,
            "connection_nodes": [
                {
                    "name": node.name,
                    "position": node.position.tolist(),
                    "diameter": node.diameter,
                    "connection_type": node.connection_type,
                    "direction": node.direction.tolist()
                }
                for node in self.get_world_connection_nodes()
            ]
        }
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate 3D mesh vertices (to be implemented by subclasses)"""
        raise NotImplementedError("Subclasses must implement generate_geometry")


class WC(PlumbingFixture):
    """Water closet (toilet)"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.WC, position, rotation, fixture_id)
        
        self.dimensions = (500, 700, 800)  # W, D, H in mm
        self.mounting_height = 0.0  # Floor mounted
        self.trap_type = TrapType.S_TRAP
        self.vent_required = True
        self.fixture_units = 4.0
        self.clearance = ClearanceEnvelope(
            front=600, back=50, left=300, right=300, top=1000, bottom=0
        )
        
        # Connection nodes
        self.connection_nodes = [
            ConnectionNode(
                name="cold_supply",
                position=np.array([-150, -250, 200]),
                diameter=15,  # 1/2" supply
                connection_type="supply_cold",
                direction=np.array([0, -1, 0])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, -100, 0]),
                diameter=100,  # 4" waste
                connection_type="waste",
                direction=np.array([0, 0, -1])
            ),
            ConnectionNode(
                name="vent",
                position=np.array([0, -100, 100]),
                diameter=50,  # 2" vent
                connection_type="vent",
                direction=np.array([0, 0, 1])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate simplified WC geometry"""
        # Bowl (cylinder approximation)
        bowl_vertices = []
        radius = 200
        height = 400
        segments = 16
        
        for i in range(segments):
            angle = 2 * np.pi * i / segments
            x = radius * np.cos(angle)
            y = radius * np.sin(angle)
            bowl_vertices.extend([
                [x, y, 0],
                [x, y, height]
            ])
        
        return [np.array(bowl_vertices, dtype=np.float32)]


class WashBasin(PlumbingFixture):
    """Lavatory / wash basin"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.WASH_BASIN, position, rotation, fixture_id)
        
        self.dimensions = (600, 450, 150)  # W, D, H
        self.mounting_height = 850  # Counter height
        self.trap_type = TrapType.P_TRAP
        self.vent_required = False  # Usually not required for small fixtures
        self.fixture_units = 1.0
        self.clearance = ClearanceEnvelope(
            front=600, back=100, left=200, right=200, top=500, bottom=0
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="hot_supply",
                position=np.array([-150, 0, -100]),
                diameter=12,  # 1/2" supply
                connection_type="supply_hot",
                direction=np.array([0, 0, -1])
            ),
            ConnectionNode(
                name="cold_supply",
                position=np.array([150, 0, -100]),
                diameter=12,
                connection_type="supply_cold",
                direction=np.array([0, 0, -1])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, -150, -50]),
                diameter=40,  # 1.5" waste
                connection_type="waste",
                direction=np.array([0, -1, 0])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate basin geometry"""
        w, d, h = self.dimensions
        vertices = [
            # Simple box representation
            [-w/2, -d/2, 0], [w/2, -d/2, 0], [w/2, d/2, 0], [-w/2, d/2, 0],
            [-w/2, -d/2, h], [w/2, -d/2, h], [w/2, d/2, h], [-w/2, d/2, h]
        ]
        return [np.array(vertices, dtype=np.float32)]


class KitchenSink(PlumbingFixture):
    """Kitchen sink"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, 
                 double_bowl: bool = False, fixture_id: Optional[str] = None):
        super().__init__(FixureType.KITCHEN_SINK, position, rotation, fixture_id)
        
        self.double_bowl = double_bowl
        self.dimensions = (1000 if double_bowl else 600, 500, 200)
        self.mounting_height = 900  # Counter height
        self.trap_type = TrapType.P_TRAP
        self.vent_required = False
        self.fixture_units = 2.0 if double_bowl else 1.5
        self.clearance = ClearanceEnvelope(
            front=800, back=100, left=300, right=300, top=600, bottom=0
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="hot_supply",
                position=np.array([-200, 0, -150]),
                diameter=15,
                connection_type="supply_hot",
                direction=np.array([0, 0, -1])
            ),
            ConnectionNode(
                name="cold_supply",
                position=np.array([200, 0, -150]),
                diameter=15,
                connection_type="supply_cold",
                direction=np.array([0, 0, -1])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, -200, -50]),
                diameter=50,  # 2" waste
                connection_type="waste",
                direction=np.array([0, -1, 0])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate sink geometry"""
        w, d, h = self.dimensions
        vertices = [
            [-w/2, -d/2, 0], [w/2, -d/2, 0], [w/2, d/2, 0], [-w/2, d/2, 0],
            [-w/2, -d/2, h], [w/2, -d/2, h], [w/2, d/2, h], [-w/2, d/2, h]
        ]
        return [np.array(vertices, dtype=np.float32)]


class Shower(PlumbingFixture):
    """Shower enclosure"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.SHOWER, position, rotation, fixture_id)
        
        self.dimensions = (900, 900, 2100)  # W, D, H
        self.mounting_height = 0.0
        self.trap_type = TrapType.P_TRAP
        self.vent_required = False
        self.fixture_units = 2.0
        self.clearance = ClearanceEnvelope(
            front=300, back=0, left=0, right=0, top=0, bottom=0
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="hot_supply",
                position=np.array([-200, 400, 1200]),
                diameter=15,
                connection_type="supply_hot",
                direction=np.array([0, 1, 0])
            ),
            ConnectionNode(
                name="cold_supply",
                position=np.array([200, 400, 1200]),
                diameter=15,
                connection_type="supply_cold",
                direction=np.array([0, 1, 0])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, 0, 0]),
                diameter=50,  # 2" waste
                connection_type="waste",
                direction=np.array([0, 0, -1])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate shower enclosure geometry"""
        w, d, h = self.dimensions
        vertices = [
            # Floor
            [-w/2, -d/2, 0], [w/2, -d/2, 0], [w/2, d/2, 0], [-w/2, d/2, 0],
            # Top
            [-w/2, -d/2, h], [w/2, -d/2, h], [w/2, d/2, h], [-w/2, d/2, h]
        ]
        return [np.array(vertices, dtype=np.float32)]


class Bathtub(PlumbingFixture):
    """Bathtub"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.BATHTUB, position, rotation, fixture_id)
        
        self.dimensions = (1700, 700, 600)  # Standard tub
        self.mounting_height = 0.0
        self.trap_type = TrapType.P_TRAP
        self.vent_required = False
        self.fixture_units = 2.0
        self.clearance = ClearanceEnvelope(
            front=600, back=100, left=300, right=300, top=500, bottom=0
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="hot_supply",
                position=np.array([600, 300, 150]),
                diameter=15,
                connection_type="supply_hot",
                direction=np.array([0, 1, 0])
            ),
            ConnectionNode(
                name="cold_supply",
                position=np.array([800, 300, 150]),
                diameter=15,
                connection_type="supply_cold",
                direction=np.array([0, 1, 0])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([700, 0, 50]),
                diameter=50,  # 2" waste
                connection_type="waste",
                direction=np.array([0, 0, -1])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate bathtub geometry"""
        w, d, h = self.dimensions
        vertices = [
            [-w/2, -d/2, 0], [w/2, -d/2, 0], [w/2, d/2, 0], [-w/2, d/2, 0],
            [-w/2, -d/2, h], [w/2, -d/2, h], [w/2, d/2, h], [-w/2, d/2, h]
        ]
        return [np.array(vertices, dtype=np.float32)]


class Urinal(PlumbingFixture):
    """Wall-mounted urinal"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.URINAL, position, rotation, fixture_id)
        
        self.dimensions = (400, 350, 600)
        self.mounting_height = 600  # Bottom of urinal
        self.trap_type = TrapType.P_TRAP
        self.vent_required = False
        self.fixture_units = 2.0
        self.clearance = ClearanceEnvelope(
            front=600, back=0, left=200, right=200, top=400, bottom=0
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="cold_supply",
                position=np.array([0, 300, 400]),
                diameter=12,
                connection_type="supply_cold",
                direction=np.array([0, 1, 0])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, 150, -50]),
                diameter=50,
                connection_type="waste",
                direction=np.array([0, 0, -1])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate urinal geometry"""
        w, d, h = self.dimensions
        vertices = [
            [-w/2, 0, 0], [w/2, 0, 0], [w/2, d, 0], [-w/2, d, 0],
            [-w/2, 0, h], [w/2, 0, h], [w/2, d, h], [-w/2, d, h]
        ]
        return [np.array(vertices, dtype=np.float32)]


class FloorDrain(PlumbingFixture):
    """Floor drain"""
    
    def __init__(self, position: np.ndarray, fixture_id: Optional[str] = None):
        super().__init__(FixureType.FLOOR_DRAIN, position, 0.0, fixture_id)
        
        self.dimensions = (150, 150, 100)  # Drain grate size
        self.mounting_height = 0.0
        self.trap_type = TrapType.P_TRAP
        self.vent_required = False
        self.fixture_units = 1.0
        self.clearance = ClearanceEnvelope(
            front=300, back=300, left=300, right=300, top=0, bottom=150
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, 0, -100]),
                diameter=50,  # 2" waste
                connection_type="waste",
                direction=np.array([0, 0, -1])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate floor drain geometry"""
        size = 150
        vertices = [
            [-size/2, -size/2, 0], [size/2, -size/2, 0],
            [size/2, size/2, 0], [-size/2, size/2, 0]
        ]
        return [np.array(vertices, dtype=np.float32)]


class WashingMachine(PlumbingFixture):
    """Washing machine connection point"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.WASHING_MACHINE, position, rotation, fixture_id)
        
        self.dimensions = (600, 600, 850)
        self.mounting_height = 0.0
        self.trap_type = TrapType.P_TRAP
        self.vent_required = False
        self.fixture_units = 3.0
        self.clearance = ClearanceEnvelope(
            front=800, back=100, left=50, right=50, top=200, bottom=0
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="hot_supply",
                position=np.array([-150, -250, 1000]),
                diameter=15,
                connection_type="supply_hot",
                direction=np.array([0, -1, 0])
            ),
            ConnectionNode(
                name="cold_supply",
                position=np.array([150, -250, 1000]),
                diameter=15,
                connection_type="supply_cold",
                direction=np.array([0, -1, 0])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, -250, 800]),
                diameter=50,  # 2" standpipe
                connection_type="waste",
                direction=np.array([0, 0, 1])  # Standpipe goes up
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate washing machine space geometry"""
        w, d, h = self.dimensions
        vertices = [
            [-w/2, -d/2, 0], [w/2, -d/2, 0], [w/2, d/2, 0], [-w/2, d/2, 0],
            [-w/2, -d/2, h], [w/2, -d/2, h], [w/2, d/2, h], [-w/2, d/2, h]
        ]
        return [np.array(vertices, dtype=np.float32)]


class Dishwasher(PlumbingFixture):
    """Dishwasher connection point"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.DISHWASHER, position, rotation, fixture_id)
        
        self.dimensions = (600, 600, 820)
        self.mounting_height = 0.0
        self.trap_type = None  # Connects to sink trap or disposal
        self.vent_required = False
        self.fixture_units = 1.5
        self.clearance = ClearanceEnvelope(
            front=600, back=50, left=50, right=50, top=100, bottom=0
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="hot_supply",
                position=np.array([0, -250, 200]),
                diameter=12,
                connection_type="supply_hot",
                direction=np.array([0, -1, 0])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, -250, 300]),
                diameter=19,  # 3/4" drain hose
                connection_type="waste",
                direction=np.array([0, -1, 0])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate dishwasher space geometry"""
        w, d, h = self.dimensions
        vertices = [
            [-w/2, -d/2, 0], [w/2, -d/2, 0], [w/2, d/2, 0], [-w/2, d/2, 0],
            [-w/2, -d/2, h], [w/2, -d/2, h], [w/2, d/2, h], [-w/2, d/2, h]
        ]
        return [np.array(vertices, dtype=np.float32)]


class ExternalTap(PlumbingFixture):
    """External hose bib / tap"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.EXTERNAL_TAP, position, rotation, fixture_id)
        
        self.dimensions = (150, 150, 200)
        self.mounting_height = 600  # Wall mounting height
        self.trap_type = None
        self.vent_required = False
        self.fixture_units = 2.0
        self.clearance = ClearanceEnvelope(
            front=300, back=0, left=150, right=150, top=200, bottom=200
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="cold_supply",
                position=np.array([0, 100, 0]),
                diameter=15,
                connection_type="supply_cold",
                direction=np.array([0, 1, 0])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate tap geometry"""
        vertices = [
            [-50, 0, -50], [50, 0, -50], [50, 0, 50], [-50, 0, 50],
            [-50, 150, -50], [50, 150, -50], [50, 150, 50], [-50, 150, 50]
        ]
        return [np.array(vertices, dtype=np.float32)]


class Bidet(PlumbingFixture):
    """Bidet fixture"""
    
    def __init__(self, position: np.ndarray, rotation: float = 0.0, fixture_id: Optional[str] = None):
        super().__init__(FixureType.BIDET, position, rotation, fixture_id)
        
        self.dimensions = (400, 550, 400)
        self.mounting_height = 0.0
        self.trap_type = TrapType.P_TRAP
        self.vent_required = False
        self.fixture_units = 1.0
        self.clearance = ClearanceEnvelope(
            front=600, back=50, left=300, right=300, top=800, bottom=0
        )
        
        self.connection_nodes = [
            ConnectionNode(
                name="hot_supply",
                position=np.array([-100, -200, 150]),
                diameter=12,
                connection_type="supply_hot",
                direction=np.array([0, -1, 0])
            ),
            ConnectionNode(
                name="cold_supply",
                position=np.array([100, -200, 150]),
                diameter=12,
                connection_type="supply_cold",
                direction=np.array([0, -1, 0])
            ),
            ConnectionNode(
                name="waste_outlet",
                position=np.array([0, -100, 0]),
                diameter=40,
                connection_type="waste",
                direction=np.array([0, 0, -1])
            )
        ]
    
    def generate_geometry(self) -> List[np.ndarray]:
        """Generate bidet geometry"""
        w, d, h = self.dimensions
        vertices = [
            [-w/2, -d/2, 0], [w/2, -d/2, 0], [w/2, d/2, 0], [-w/2, d/2, 0],
            [-w/2, -d/2, h], [w/2, -d/2, h], [w/2, d/2, h], [-w/2, d/2, h]
        ]
        return [np.array(vertices, dtype=np.float32)]