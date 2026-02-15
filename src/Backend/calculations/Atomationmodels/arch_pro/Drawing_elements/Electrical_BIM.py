
#Electrical BIM System - Code-Compliant Design Engine
#Generates electrical layouts with proper circuit design, load calculations, and conduit routing


import json
import math
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from enum import Enum
import struct
import base64

# ============================================================================
# ENUMERATIONS
# ============================================================================

class FixtureType(Enum):
    RECESSED_LIGHT = "recessed_light"
    SURFACE_LIGHT = "surface_light"
    PENDANT_LIGHT = "pendant_light"
    WALL_LIGHT = "wall_light"
    SINGLE_SWITCH = "single_switch"
    TWO_WAY_SWITCH = "two_way_switch"
    INTERMEDIATE_SWITCH = "intermediate_switch"
    STANDARD_SOCKET = "standard_socket"
    KITCHEN_SOCKET = "kitchen_socket"
    OUTDOOR_SOCKET = "outdoor_socket"
    COOKER = "cooker"
    OVEN = "oven"
    WATER_HEATER = "water_heater"
    AC_UNIT = "ac_unit"
    MAIN_DB = "main_db"
    SUB_DB = "sub_db"

class RoomType(Enum):
    LIVING = "living"
    BEDROOM = "bedroom"
    KITCHEN = "kitchen"
    BATHROOM = "bathroom"
    CORRIDOR = "corridor"
    EXTERIOR = "exterior"
    UTILITY = "utility"

class CircuitType(Enum):
    LIGHTING = "lighting"
    SOCKET = "socket"
    DEDICATED = "dedicated"

class ProtectionType(Enum):
    MCB = "mcb"
    RCD = "rcd"
    RCBO = "rcbo"

# ============================================================================
# ELECTRICAL STANDARDS & SPECIFICATIONS
# ============================================================================

@dataclass
class ElectricalSpec:
    """IEC/BS 7671 compliant specifications"""
    
    # Voltage standards
    NOMINAL_VOLTAGE: float = 230.0  # Volts
    VOLTAGE_TOLERANCE: float = 0.1  # ±10%
    
    # Socket ratings
    STANDARD_SOCKET_RATING: float = 13.0  # Amps
    KITCHEN_SOCKET_RATING: float = 16.0  # Amps
    
    # Circuit limits
    MAX_LIGHTING_LOAD_PER_CIRCUIT: float = 1380.0  # Watts (6A at 230V)
    MAX_SOCKET_LOAD_PER_CIRCUIT: float = 3680.0  # Watts (16A at 230V)
    MAX_SOCKETS_PER_CIRCUIT: int = 8
    
    # Cable sizing (mm²)
    CABLE_SIZES: Dict[float, float] = field(default_factory=lambda: {
        6: 1.0,
        10: 1.5,
        16: 2.5,
        20: 4.0,
        25: 6.0,
        32: 10.0,
        40: 16.0,
        63: 25.0
    })
    
    # Breaker ratings
    STANDARD_BREAKER_RATINGS: List[int] = field(default_factory=lambda: 
        [6, 10, 16, 20, 25, 32, 40, 50, 63])
    
    # Protection requirements
    RCD_RATING: float = 30.0  # mA for shock protection
    
    # Bathroom zones (IEC 60364-7-701)
    BATHROOM_ZONE_0_HEIGHT: float = 2.25  # Above bath/shower tray
    BATHROOM_ZONE_1_RADIUS: float = 0.60  # Around bath/shower
    BATHROOM_ZONE_2_RADIUS: float = 0.60  # Beyond zone 1
    
    # Mounting heights (meters)
    SWITCH_HEIGHT: float = 1.20
    SOCKET_HEIGHT: float = 0.45
    KITCHEN_SOCKET_HEIGHT: float = 1.10
    LIGHT_SWITCH_OFFSET: float = 0.15  # From door frame
    
    # Clearances
    SOCKET_SPACING_MAX: float = 4.0  # Max distance between sockets
    KITCHEN_SOCKET_SPACING: float = 1.2  # Kitchen worktop spacing
    APPLIANCE_CLEARANCE: float = 0.5  # Clearance around appliances

SPEC = ElectricalSpec()

# ============================================================================
# COMPONENT DEFINITIONS
# ============================================================================

@dataclass
class ComponentTemplate:
    """Physical and electrical properties of components"""
    fixture_type: FixtureType
    dimensions: Tuple[float, float, float]  # W, D, H in meters
    mounting_height: float
    load_rating: float  # Watts
    current_rating: float  # Amps
    clearance: float
    ip_rating: str
    can_wet_zone: bool
    color: Tuple[float, float, float]

COMPONENT_LIBRARY: Dict[FixtureType, ComponentTemplate] = {
    FixtureType.RECESSED_LIGHT: ComponentTemplate(
        FixtureType.RECESSED_LIGHT, (0.15, 0.15, 0.10), 2.4, 50, 0.22, 0.20, "IP20", False, (0.95, 0.95, 0.85)
    ),
    FixtureType.SURFACE_LIGHT: ComponentTemplate(
        FixtureType.SURFACE_LIGHT, (0.30, 0.30, 0.10), 2.4, 60, 0.26, 0.15, "IP20", False, (0.9, 0.9, 0.9)
    ),
    FixtureType.PENDANT_LIGHT: ComponentTemplate(
        FixtureType.PENDANT_LIGHT, (0.25, 0.25, 0.40), 2.2, 75, 0.33, 0.30, "IP20", False, (0.85, 0.85, 0.75)
    ),
    FixtureType.WALL_LIGHT: ComponentTemplate(
        FixtureType.WALL_LIGHT, (0.15, 0.10, 0.20), 1.8, 40, 0.17, 0.10, "IP44", True, (0.9, 0.9, 0.85)
    ),
    FixtureType.SINGLE_SWITCH: ComponentTemplate(
        FixtureType.SINGLE_SWITCH, (0.086, 0.086, 0.04), SPEC.SWITCH_HEIGHT, 10, 10, 0.10, "IP20", False, (1.0, 1.0, 1.0)
    ),
    FixtureType.TWO_WAY_SWITCH: ComponentTemplate(
        FixtureType.TWO_WAY_SWITCH, (0.086, 0.086, 0.04), SPEC.SWITCH_HEIGHT, 10, 10, 0.10, "IP20", False, (1.0, 1.0, 0.95)
    ),
    FixtureType.STANDARD_SOCKET: ComponentTemplate(
        FixtureType.STANDARD_SOCKET, (0.086, 0.086, 0.04), SPEC.SOCKET_HEIGHT, 3000, 13, 0.10, "IP20", False, (0.95, 0.95, 0.95)
    ),
    FixtureType.KITCHEN_SOCKET: ComponentTemplate(
        FixtureType.KITCHEN_SOCKET, (0.086, 0.086, 0.04), SPEC.KITCHEN_SOCKET_HEIGHT, 3680, 16, 0.10, "IP20", False, (0.9, 0.9, 0.9)
    ),
    FixtureType.OUTDOOR_SOCKET: ComponentTemplate(
        FixtureType.OUTDOOR_SOCKET, (0.10, 0.10, 0.08), 1.0, 3000, 13, 0.15, "IP66", True, (0.3, 0.3, 0.3)
    ),
    FixtureType.COOKER: ComponentTemplate(
        FixtureType.COOKER, (0.60, 0.60, 0.90), 0.0, 7200, 32, 0.50, "IP20", False, (0.2, 0.2, 0.2)
    ),
    FixtureType.OVEN: ComponentTemplate(
        FixtureType.OVEN, (0.60, 0.60, 0.60), 0.90, 3000, 13, 0.30, "IP20", False, (0.25, 0.25, 0.25)
    ),
    FixtureType.WATER_HEATER: ComponentTemplate(
        FixtureType.WATER_HEATER, (0.45, 0.45, 0.60), 1.8, 3000, 13, 0.30, "IPX4", True, (0.8, 0.8, 0.85)
    ),
    FixtureType.AC_UNIT: ComponentTemplate(
        FixtureType.AC_UNIT, (0.80, 0.30, 0.25), 2.5, 2000, 9, 0.50, "IP24", False, (0.9, 0.9, 0.9)
    ),
    FixtureType.MAIN_DB: ComponentTemplate(
        FixtureType.MAIN_DB, (0.40, 0.20, 0.60), 1.5, 0, 100, 0.60, "IP40", False, (0.3, 0.3, 0.35)
    ),
    FixtureType.SUB_DB: ComponentTemplate(
        FixtureType.SUB_DB, (0.30, 0.15, 0.45), 1.5, 0, 63, 0.50, "IP40", False, (0.35, 0.35, 0.4)
    ),
}

# ============================================================================
# CORE CLASSES
# ============================================================================

@dataclass
class Vector3:
    """3D vector utilities"""
    x: float
    y: float
    z: float
    
    def __add__(self, other):
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)
    
    def __sub__(self, other):
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)
    
    def __mul__(self, scalar):
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)
    
    def length(self) -> float:
        return math.sqrt(self.x**2 + self.y**2 + self.z**2)
    
    def normalize(self):
        l = self.length()
        if l > 0:
            return Vector3(self.x/l, self.y/l, self.z/l)
        return Vector3(0, 0, 0)
    
    def to_list(self) -> List[float]:
        return [self.x, self.y, self.z]

@dataclass
class Room:
    """Room definition with electrical zones"""
    name: str
    room_type: RoomType
    corners: List[Vector3]  # Floor polygon
    height: float
    wet_zones: List[Tuple[Vector3, float]] = field(default_factory=list)  # Center + radius
    
    def contains_point(self, point: Vector3) -> bool:
        """Check if point is inside room (2D)"""
        x, z = point.x, point.z
        n = len(self.corners)
        inside = False
        
        p1x, p1z = self.corners[0].x, self.corners[0].z
        for i in range(1, n + 1):
            p2x, p2z = self.corners[i % n].x, self.corners[i % n].z
            if z > min(p1z, p2z):
                if z <= max(p1z, p2z):
                    if x <= max(p1x, p2x):
                        if p1z != p2z:
                            xinters = (z - p1z) * (p2x - p1x) / (p2z - p1z) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1z = p2x, p2z
        
        return inside
    
    def is_in_wet_zone(self, point: Vector3) -> bool:
        """Check if point is in bathroom wet zone"""
        if self.room_type != RoomType.BATHROOM:
            return False
        
        for center, radius in self.wet_zones:
            dist_2d = math.sqrt((point.x - center.x)**2 + (point.z - center.z)**2)
            if dist_2d <= radius:
                return True
        return False

@dataclass
class ElectricalFixture:
    """Individual electrical component"""
    id: str
    fixture_type: FixtureType
    position: Vector3
    rotation: float  # Y-axis rotation in radians
    template: ComponentTemplate
    room: Optional[Room] = None
    circuit_id: Optional[str] = None
    connected_to: List[str] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)
    
    def get_load(self) -> float:
        """Get power consumption in watts"""
        return self.template.load_rating
    
    def get_current(self) -> float:
        """Get current draw in amps"""
        return self.template.current_rating
    
    def validate_placement(self) -> List[str]:
        """Validate placement against electrical codes"""
        errors = []
        
        if not self.room:
            errors.append(f"{self.id}: No room assigned")
            return errors
        
        # Check wet zone restrictions
        if self.room.is_in_wet_zone(self.position):
            if not self.template.can_wet_zone:
                errors.append(
                    f"{self.id}: {self.fixture_type.value} not rated for wet zone "
                    f"(requires IP rating, has {self.template.ip_rating})"
                )
        
        # Check mounting height
        if self.position.y > self.room.height:
            errors.append(f"{self.id}: Mounted above room height")
        
        # Bathroom specific checks
        if self.room.room_type == RoomType.BATHROOM:
            if self.fixture_type in [FixtureType.STANDARD_SOCKET]:
                if self.position.y < 2.25:  # Must be outside zones or >2.25m
                    if self.room.is_in_wet_zone(self.position):
                        errors.append(
                            f"{self.id}: Socket in bathroom must be >2.25m or outside zones"
                        )
        
        return errors
    
    def get_mesh_data(self) -> Dict:
        """Generate GLTF-compatible mesh"""
        w, d, h = self.template.dimensions
        
        # Simple box geometry
        vertices = [
            # Front face
            -w/2, 0, d/2,    w/2, 0, d/2,    w/2, h, d/2,    -w/2, h, d/2,
            # Back face
            -w/2, 0, -d/2,   w/2, 0, -d/2,   w/2, h, -d/2,   -w/2, h, -d/2,
        ]
        
        indices = [
            0,1,2, 0,2,3,  # Front
            5,4,7, 5,7,6,  # Back
            4,0,3, 4,3,7,  # Left
            1,5,6, 1,6,2,  # Right
            3,2,6, 3,6,7,  # Top
            4,5,1, 4,1,0,  # Bottom
        ]
        
        # Apply rotation and position
        cos_r = math.cos(self.rotation)
        sin_r = math.sin(self.rotation)
        
        transformed = []
        for i in range(0, len(vertices), 3):
            x, y, z = vertices[i], vertices[i+1], vertices[i+2]
            # Rotate around Y
            x_rot = x * cos_r - z * sin_r
            z_rot = x * sin_r + z * cos_r
            # Translate
            transformed.extend([
                x_rot + self.position.x,
                y + self.position.y,
                z_rot + self.position.z
            ])
        
        return {
            "vertices": transformed,
            "indices": indices,
            "color": self.template.color
        }

@dataclass
class Circuit:
    """Electrical circuit with load calculation"""
    id: str
    circuit_type: CircuitType
    name: str
    fixtures: List[ElectricalFixture] = field(default_factory=list)
    breaker_rating: int = 0
    cable_size: float = 0.0
    protection_type: ProtectionType = ProtectionType.MCB
    phase: int = 1  # For three-phase balancing
    
    def calculate_load(self) -> Tuple[float, float]:
        """Calculate total load (watts, amps)"""
        total_watts = sum(f.get_load() for f in self.fixtures)
        total_amps = sum(f.get_current() for f in self.fixtures)
        return total_watts, total_amps
    
    def size_breaker(self) -> int:
        """Determine appropriate breaker rating"""
        _, amps = self.calculate_load()
        
        # Add diversity factor for socket circuits
        if self.circuit_type == CircuitType.SOCKET:
            amps *= 0.7  # 70% diversity factor
        
        # Select next standard breaker size
        for rating in SPEC.STANDARD_BREAKER_RATINGS:
            if rating >= amps:
                return rating
        
        return SPEC.STANDARD_BREAKER_RATINGS[-1]
    
    def size_cable(self, breaker: int) -> float:
        """Select cable size based on breaker rating"""
        for rating, cable_size in SPEC.CABLE_SIZES.items():
            if rating >= breaker:
                return cable_size
        return SPEC.CABLE_SIZES[max(SPEC.CABLE_SIZES.keys())]
    
    def validate(self) -> List[str]:
        """Validate circuit against electrical codes"""
        errors = []
        
        watts, amps = self.calculate_load()
        
        # Check circuit limits
        if self.circuit_type == CircuitType.LIGHTING:
            if watts > SPEC.MAX_LIGHTING_LOAD_PER_CIRCUIT:
                errors.append(
                    f"Circuit {self.id}: Lighting load {watts}W exceeds "
                    f"limit {SPEC.MAX_LIGHTING_LOAD_PER_CIRCUIT}W"
                )
        
        elif self.circuit_type == CircuitType.SOCKET:
            if watts > SPEC.MAX_SOCKET_LOAD_PER_CIRCUIT:
                errors.append(
                    f"Circuit {self.id}: Socket load {watts}W exceeds "
                    f"limit {SPEC.MAX_SOCKET_LOAD_PER_CIRCUIT}W"
                )
            
            socket_count = sum(1 for f in self.fixtures 
                             if f.fixture_type in [FixtureType.STANDARD_SOCKET, 
                                                  FixtureType.KITCHEN_SOCKET])
            if socket_count > SPEC.MAX_SOCKETS_PER_CIRCUIT:
                errors.append(
                    f"Circuit {self.id}: {socket_count} sockets exceeds "
                    f"limit {SPEC.MAX_SOCKETS_PER_CIRCUIT}"
                )
        
        # Verify breaker and cable sizing
        if self.breaker_rating == 0:
            errors.append(f"Circuit {self.id}: No breaker sized")
        elif amps > self.breaker_rating:
            errors.append(
                f"Circuit {self.id}: Load {amps:.1f}A exceeds breaker {self.breaker_rating}A"
            )
        
        # Check all fixtures have circuit assignment
        for fixture in self.fixtures:
            if fixture.circuit_id != self.id:
                errors.append(f"Fixture {fixture.id} circuit_id mismatch")
        
        return errors
    
    def design(self):
        """Auto-size breaker and cable"""
        self.breaker_rating = self.size_breaker()
        self.cable_size = self.size_cable(self.breaker_rating)
        
        # Bathroom circuits need RCD protection
        needs_rcd = any(f.room and f.room.room_type == RoomType.BATHROOM 
                       for f in self.fixtures)
        if needs_rcd:
            self.protection_type = ProtectionType.RCBO

@dataclass
class ConduitRun:
    """Cable conduit path"""
    id: str
    waypoints: List[Vector3]
    diameter: float  # mm
    cables: List[str]  # Circuit IDs
    
    def get_length(self) -> float:
        """Calculate total conduit length"""
        length = 0.0
        for i in range(len(self.waypoints) - 1):
            length += (self.waypoints[i+1] - self.waypoints[i]).length()
        return length
    
    def get_mesh_data(self) -> Dict:
        """Generate conduit geometry as line segments"""
        vertices = []
        indices = []
        
        for i, wp in enumerate(self.waypoints):
            vertices.extend(wp.to_list())
            if i > 0:
                indices.extend([i-1, i])
        
        return {
            "vertices": vertices,
            "indices": indices,
            "diameter": self.diameter / 1000.0  # Convert to meters
        }

@dataclass
class Panel:
    """Distribution board"""
    id: str
    fixture_type: FixtureType
    position: Vector3
    circuits: List[Circuit] = field(default_factory=list)
    supply_rating: int = 100  # Amps
    
    def calculate_total_load(self) -> Tuple[float, float]:
        """Calculate total panel load"""
        total_watts = 0.0
        total_amps = 0.0
        
        for circuit in self.circuits:
            watts, amps = circuit.calculate_load()
            total_watts += watts
            total_amps += amps
        
        # Apply diversity
        total_amps *= 0.6
        
        return total_watts, total_amps
    
    def balance_phases(self):
        """Distribute circuits across three phases"""
        if len(self.circuits) == 0:
            return
        
        # Sort by load
        sorted_circuits = sorted(self.circuits, 
                                key=lambda c: c.calculate_load()[1], 
                                reverse=True)
        
        phase_loads = [0.0, 0.0, 0.0]
        
        for circuit in sorted_circuits:
            _, amps = circuit.calculate_load()
            # Assign to least loaded phase
            min_phase = phase_loads.index(min(phase_loads))
            circuit.phase = min_phase + 1
            phase_loads[min_phase] += amps
    
    def validate(self) -> List[str]:
        """Validate panel capacity"""
        errors = []
        
        _, total_amps = self.calculate_total_load()
        
        if total_amps > self.supply_rating:
            errors.append(
                f"Panel {self.id}: Total load {total_amps:.1f}A exceeds "
                f"supply rating {self.supply_rating}A"
            )
        
        return errors

# ============================================================================
# PLACEMENT ENGINE
# ============================================================================

class PlacementEngine:
    """Intelligent component placement following electrical codes"""
    
    @staticmethod
    def place_ceiling_lights(room: Room, spacing: float = 2.5) -> List[ElectricalFixture]:
        """Grid-based ceiling light placement"""
        fixtures = []
        
        # Calculate room bounds
        min_x = min(c.x for c in room.corners)
        max_x = max(c.x for c in room.corners)
        min_z = min(c.z for c in room.corners)
        max_z = max(c.z for c in room.corners)
        
        # Determine light type
        if room.room_type == RoomType.BATHROOM:
            light_type = FixtureType.WALL_LIGHT  # IP44 rated
        elif room.room_type == RoomType.KITCHEN:
            light_type = FixtureType.RECESSED_LIGHT
        else:
            light_type = FixtureType.SURFACE_LIGHT
        
        # Grid placement
        x = min_x + spacing / 2
        idx = 0
        while x < max_x:
            z = min_z + spacing / 2
            while z < max_z:
                pos = Vector3(x, room.height - 0.1, z)
                if room.contains_point(pos):
                    fixture = ElectricalFixture(
                        id=f"{room.name}_light_{idx}",
                        fixture_type=light_type,
                        position=pos,
                        rotation=0.0,
                        template=COMPONENT_LIBRARY[light_type],
                        room=room
                    )
                    fixtures.append(fixture)
                    idx += 1
                z += spacing
            x += spacing
        
        return fixtures
    
    @staticmethod
    def place_switches(room: Room, lights: List[ElectricalFixture], 
                       door_position: Vector3, door_normal: Vector3) -> List[ElectricalFixture]:
        """Place light switches near door"""
        fixtures = []
        
        # Switch position: offset from door on latch side
        offset_dir = Vector3(-door_normal.z, 0, door_normal.x).normalize()
        switch_pos = door_position + offset_dir * SPEC.LIGHT_SWITCH_OFFSET
        switch_pos.y = SPEC.SWITCH_HEIGHT
        
        # Determine switch type based on number of lights
        if len(lights) == 1:
            switch_type = FixtureType.SINGLE_SWITCH
        else:
            switch_type = FixtureType.TWO_WAY_SWITCH
        
        switch = ElectricalFixture(
            id=f"{room.name}_switch_0",
            fixture_type=switch_type,
            position=switch_pos,
            rotation=math.atan2(door_normal.x, door_normal.z),
            template=COMPONENT_LIBRARY[switch_type],
            room=room,
            connected_to=[light.id for light in lights]
        )
        fixtures.append(switch)
        
        return fixtures
    
    @staticmethod
    def place_wall_sockets(room: Room, spacing: float = None) -> List[ElectricalFixture]:
        """Place sockets along walls"""
        fixtures = []
        
        if spacing is None:
            if room.room_type == RoomType.KITCHEN:
                spacing = SPEC.KITCHEN_SOCKET_SPACING
            else:
                spacing = SPEC.SOCKET_SPACING_MAX
        
        # Determine socket type
        if room.room_type == RoomType.KITCHEN:
            socket_type = FixtureType.KITCHEN_SOCKET
            height = SPEC.KITCHEN_SOCKET_HEIGHT
        elif room.room_type == RoomType.EXTERIOR:
            socket_type = FixtureType.OUTDOOR_SOCKET
            height = 1.0
        else:
            socket_type = FixtureType.STANDARD_SOCKET
            height = SPEC.SOCKET_HEIGHT
        
        # Place along walls
        idx = 0
        for i in range(len(room.corners)):
            p1 = room.corners[i]
            p2 = room.corners[(i + 1) % len(room.corners)]
            
            wall_vec = p2 - p1
            wall_length = wall_vec.length()
            wall_dir = wall_vec.normalize()
            
            num_sockets = max(1, int(wall_length / spacing))
            
            for j in range(num_sockets):
                offset = (j + 0.5) * wall_length / num_sockets
                pos = p1 + wall_dir * offset
                pos.y = height
                
                # Check not in wet zone
                if room.is_in_wet_zone(pos):
                    continue
                
                # Wall normal for rotation
                wall_normal = Vector3(-wall_dir.z, 0, wall_dir.x)
                rotation = math.atan2(wall_normal.x, wall_normal.z)
                
                fixture = ElectricalFixture(
                    id=f"{room.name}_socket_{idx}",
                    fixture_type=socket_type,
                    position=pos,
                    rotation=rotation,
                    template=COMPONENT_LIBRARY[socket_type],
                    room=room
                )
                fixtures.append(fixture)
                idx += 1
        
        return fixtures
    
    @staticmethod
    def place_appliance(room: Room, appliance_type: FixtureType, 
                       position: Vector3) -> ElectricalFixture:
        """Place dedicated appliance"""
        return ElectricalFixture(
            id=f"{room.name}_{appliance_type.value}",
            fixture_type=appliance_type,
            position=position,
            rotation=0.0,
            template=COMPONENT_LIBRARY[appliance_type],
            room=room
        )

# ============================================================================
# CIRCUIT GENERATION ENGINE
# ============================================================================

class CircuitDesigner:
    """Automatic circuit generation and load distribution"""
    
    def __init__(self):
        self.circuits: List[Circuit] = []
        self.circuit_counter = 0
    
    def create_lighting_circuits(self, lights: List[ElectricalFixture], 
                                switches: List[ElectricalFixture]) -> List[Circuit]:
        """Group lights into circuits by room/zone"""
        circuits = []
        
        # Group by room
        rooms = {}
        for light in lights:
            if light.room:
                room_name = light.room.name
                if room_name not in rooms:
                    rooms[room_name] = []
                rooms[room_name].append(light)
        
        # Create circuits per room or group rooms
        for room_name, room_lights in rooms.items():
            circuit = Circuit(
                id=f"L{self.circuit_counter:02d}",
                circuit_type=CircuitType.LIGHTING,
                name=f"Lighting - {room_name}",
                fixtures=room_lights
            )
            
            # Add associated switches
            for switch in switches:
                if any(light.id in switch.connected_to for light in room_lights):
                    circuit.fixtures.append(switch)
            
            # Assign circuit ID to fixtures
            for fixture in circuit.fixtures:
                fixture.circuit_id = circuit.id
            
            circuit.design()
            circuits.append(circuit)
            self.circuit_counter += 1
        
        self.circuits.extend(circuits)
        return circuits
    
    def create_socket_circuits(self, sockets: List[ElectricalFixture]) -> List[Circuit]:
        """Distribute sockets across circuits"""
        circuits = []
        
        # Group by room type for better distribution
        kitchen_sockets = [s for s in sockets if s.room and s.room.room_type == RoomType.KITCHEN]
        other_sockets = [s for s in sockets if s.room and s.room.room_type != RoomType.KITCHEN]
        
        # Kitchen sockets: max 2 per circuit (high load)
        for i in range(0, len(kitchen_sockets), 2):
            batch = kitchen_sockets[i:i+2]
            circuit = Circuit(
                id=f"S{self.circuit_counter:02d}",
                circuit_type=CircuitType.SOCKET,
                name=f"Sockets - Kitchen {i//2 + 1}",
                fixtures=batch,
                protection_type=ProtectionType.RCBO
            )
            
            for fixture in batch:
                fixture.circuit_id = circuit.id
            
            circuit.design()
            circuits.append(circuit)
            self.circuit_counter += 1
        
        # Other sockets: standard distribution
        for i in range(0, len(other_sockets), SPEC.MAX_SOCKETS_PER_CIRCUIT):
            batch = other_sockets[i:i+SPEC.MAX_SOCKETS_PER_CIRCUIT]
            room_name = batch[0].room.name if batch[0].room else "Mixed"
            
            circuit = Circuit(
                id=f"S{self.circuit_counter:02d}",
                circuit_type=CircuitType.SOCKET,
                name=f"Sockets - {room_name}",
                fixtures=batch
            )
            
            for fixture in batch:
                fixture.circuit_id = circuit.id
            
            circuit.design()
            circuits.append(circuit)
            self.circuit_counter += 1
        
        self.circuits.extend(circuits)
        return circuits
    
    def create_dedicated_circuits(self, appliances: List[ElectricalFixture]) -> List[Circuit]:
        """One circuit per high-load appliance"""
        circuits = []
        
        for appliance in appliances:
            circuit = Circuit(
                id=f"D{self.circuit_counter:02d}",
                circuit_type=CircuitType.DEDICATED,
                name=f"{appliance.fixture_type.value.replace('_', ' ').title()}",
                fixtures=[appliance],
                protection_type=ProtectionType.RCBO
            )
            
            appliance.circuit_id = circuit.id
            circuit.design()
            circuits.append(circuit)
            self.circuit_counter += 1
        
        self.circuits.extend(circuits)
        return circuits

# ============================================================================
# CONDUIT ROUTING ENGINE
# ============================================================================

class ConduitRouter:
    """Automatic conduit path generation"""
    
    def __init__(self):
        self.conduits: List[ConduitRun] = []
        self.conduit_counter = 0
    
    def route_circuit(self, circuit: Circuit, panel_position: Vector3, 
                     room: Room) -> ConduitRun:
        """Generate conduit path from panel to fixtures"""
        waypoints = [panel_position]
        
        if len(circuit.fixtures) == 0:
            return None
        
        # Route to room center at ceiling
        room_center_x = sum(c.x for c in room.corners) / len(room.corners)
        room_center_z = sum(c.z for c in room.corners) / len(room.corners)
        
        # Vertical rise to ceiling
        ceiling_entry = Vector3(panel_position.x, room.height - 0.2, panel_position.z)
        waypoints.append(ceiling_entry)
        
        # Horizontal run to room
        room_entry = Vector3(room_center_x, room.height - 0.2, room_center_z)
        waypoints.append(room_entry)
        
        # Drops to each fixture
        for fixture in circuit.fixtures:
            # Drop point
            drop = Vector3(fixture.position.x, room.height - 0.2, fixture.position.z)
            waypoints.append(drop)
            waypoints.append(fixture.position)
            # Return to ceiling
            waypoints.append(drop)
        
        # Return to room entry
        waypoints.append(room_entry)
        
        # Calculate conduit diameter based on cable count
        cable_count = 1  # Simplified: one cable per circuit
        diameter = 20 if cable_count <= 2 else 25  # mm
        
        conduit = ConduitRun(
            id=f"C{self.conduit_counter:03d}",
            waypoints=waypoints,
            diameter=diameter,
            cables=[circuit.id]
        )
        
        self.conduits.append(conduit)
        self.conduit_counter += 1
        
        return conduit

# ============================================================================
# GLTF EXPORT ENGINE
# ============================================================================

class GLTFExporter:
    """Export electrical system to GLTF format"""
    
    @staticmethod
    def export_system(fixtures: List[ElectricalFixture], 
                     conduits: List[ConduitRun],
                     panels: List[Panel]) -> Dict:
        """Generate complete GLTF with embedded binary data"""
        
        all_vertices = []
        all_indices = []
        all_colors = []
        
        vertex_offset = 0
        meshes = []
        nodes = []
        
        # Export fixtures
        for fixture in fixtures:
            mesh_data = fixture.get_mesh_data()
            
            start_vertex = len(all_vertices) // 3
            all_vertices.extend(mesh_data["vertices"])
            
            # Offset indices
            offset_indices = [i + vertex_offset for i in mesh_data["indices"]]
            all_indices.extend(offset_indices)
            
            # Colors per vertex
            color = mesh_data["color"]
            vertex_count = len(mesh_data["vertices"]) // 3
            all_colors.extend(color * vertex_count)
            
            vertex_offset += vertex_count
            
            meshes.append({
                "name": fixture.id,
                "primitives": [{
                    "mode": 4,  # TRIANGLES
                    "attributes": {
                        "POSITION": start_vertex
                    },
                    "material": len(meshes)
                }]
            })
            
            nodes.append({
                "name": fixture.id,
                "mesh": len(meshes) - 1,
                "extras": {
                    "system": "electrical",
                    "fixture_type": fixture.fixture_type.value,
                    "circuit_id": fixture.circuit_id,
                    "load_watts": fixture.get_load(),
                    "current_amps": fixture.get_current(),
                    "room": fixture.room.name if fixture.room else None
                }
            })
        
        # Export conduits as lines
        for conduit in conduits:
            mesh_data = conduit.get_mesh_data()
            
            start_vertex = len(all_vertices) // 3
            all_vertices.extend(mesh_data["vertices"])
            
            offset_indices = [i + vertex_offset for i in mesh_data["indices"]]
            all_indices.extend(offset_indices)
            
            vertex_count = len(mesh_data["vertices"]) // 3
            all_colors.extend([0.5, 0.5, 0.5] * vertex_count)
            
            vertex_offset += vertex_count
            
            nodes.append({
                "name": conduit.id,
                "extras": {
                    "system": "conduit",
                    "diameter_mm": conduit.diameter,
                    "length_m": conduit.get_length(),
                    "circuits": conduit.cables
                }
            })
        
        # Convert to binary
        vertices_bytes = struct.pack(f'{len(all_vertices)}f', *all_vertices)
        indices_bytes = struct.pack(f'{len(all_indices)}H', *all_indices)
        colors_bytes = struct.pack(f'{len(all_colors)}f', *all_colors)
        
        buffer_data = vertices_bytes + indices_bytes + colors_bytes
        buffer_base64 = base64.b64encode(buffer_data).decode('utf-8')
        
        # Build GLTF structure
        gltf = {
            "asset": {
                "version": "2.0",
                "generator": "Electrical BIM System v1.0"
            },
            "scene": 0,
            "scenes": [{
                "name": "Electrical System",
                "nodes": list(range(len(nodes)))
            }],
            "nodes": nodes,
            "meshes": meshes,
            "buffers": [{
                "byteLength": len(buffer_data),
                "uri": f"data:application/octet-stream;base64,{buffer_base64}"
            }],
            "bufferViews": [
                {
                    "buffer": 0,
                    "byteOffset": 0,
                    "byteLength": len(vertices_bytes),
                    "target": 34962
                },
                {
                    "buffer": 0,
                    "byteOffset": len(vertices_bytes),
                    "byteLength": len(indices_bytes),
                    "target": 34963
                }
            ],
            "accessors": [
                {
                    "bufferView": 0,
                    "componentType": 5126,
                    "count": len(all_vertices) // 3,
                    "type": "VEC3",
                    "max": [max(all_vertices[i::3]) for i in range(3)],
                    "min": [min(all_vertices[i::3]) for i in range(3)]
                },
                {
                    "bufferView": 1,
                    "componentType": 5123,
                    "count": len(all_indices),
                    "type": "SCALAR"
                }
            ]
        }
        
        return gltf

# ============================================================================
# SYSTEM VALIDATOR
# ============================================================================

class SystemValidator:
    """Comprehensive electrical system validation"""
    
    @staticmethod
    def validate_all(fixtures: List[ElectricalFixture], 
                    circuits: List[Circuit],
                    panels: List[Panel]) -> List[str]:
        """Run all validation checks"""
        errors = []
        
        # Fixture placement validation
        for fixture in fixtures:
            errors.extend(fixture.validate_placement())
        
        # Circuit validation
        for circuit in circuits:
            errors.extend(circuit.validate())
        
        # Panel validation
        for panel in panels:
            errors.extend(panel.validate())
        
        # Earthing check
        earthed_types = [FixtureType.COOKER, FixtureType.WATER_HEATER, 
                        FixtureType.AC_UNIT, FixtureType.KITCHEN_SOCKET]
        for fixture in fixtures:
            if fixture.fixture_type in earthed_types:
                if not fixture.circuit_id:
                    errors.append(f"{fixture.id}: No earthing connection (no circuit)")
        
        # Disconnected devices
        for fixture in fixtures:
            if not fixture.circuit_id and fixture.get_load() > 0:
                errors.append(f"{fixture.id}: Not connected to any circuit")
        
        return errors

# ============================================================================
# COMPLETE ELECTRICAL SYSTEM
# ============================================================================

class ElectricalSystem:
    """Complete electrical design system"""
    
    def __init__(self):
        self.rooms: List[Room] = []
        self.fixtures: List[ElectricalFixture] = []
        self.circuits: List[Circuit] = []
        self.conduits: List[ConduitRun] = []
        self.panels: List[Panel] = []
        
        self.placement_engine = PlacementEngine()
        self.circuit_designer = CircuitDesigner()
        self.conduit_router = ConduitRouter()
    
    def add_room(self, room: Room):
        """Add room to system"""
        self.rooms.append(room)
    
    def design_room(self, room: Room, door_pos: Vector3, door_normal: Vector3):
        """Complete electrical design for a room"""
        
        # Place ceiling lights
        lights = self.placement_engine.place_ceiling_lights(room)
        self.fixtures.extend(lights)
        
        # Place switches
        switches = self.placement_engine.place_switches(room, lights, door_pos, door_normal)
        self.fixtures.extend(switches)
        
        # Place wall sockets
        sockets = self.placement_engine.place_wall_sockets(room)
        self.fixtures.extend(sockets)
        
        return lights, switches, sockets
    
    def add_appliance(self, room: Room, appliance_type: FixtureType, position: Vector3):
        """Add appliance to system"""
        appliance = self.placement_engine.place_appliance(room, appliance_type, position)
        self.fixtures.append(appliance)
        return appliance
    
    def generate_circuits(self):
        """Generate all circuits"""
        
        # Categorize fixtures
        lights = [f for f in self.fixtures if 'light' in f.fixture_type.value.lower()]
        switches = [f for f in self.fixtures if 'switch' in f.fixture_type.value.lower()]
        sockets = [f for f in self.fixtures if 'socket' in f.fixture_type.value.lower()]
        appliances = [f for f in self.fixtures if f.fixture_type in [
            FixtureType.COOKER, FixtureType.OVEN, 
            FixtureType.WATER_HEATER, FixtureType.AC_UNIT
        ]]
        
        # Create circuits
        self.circuits.extend(self.circuit_designer.create_lighting_circuits(lights, switches))
        self.circuits.extend(self.circuit_designer.create_socket_circuits(sockets))
        self.circuits.extend(self.circuit_designer.create_dedicated_circuits(appliances))
    
    def create_panel(self, position: Vector3, panel_type: FixtureType = FixtureType.MAIN_DB):
        """Create distribution panel"""
        panel = Panel(
            id=f"DB{len(self.panels):02d}",
            fixture_type=panel_type,
            position=position,
            circuits=self.circuits
        )
        panel.balance_phases()
        self.panels.append(panel)
        
        # Create panel fixture
        panel_fixture = ElectricalFixture(
            id=panel.id,
            fixture_type=panel_type,
            position=position,
            rotation=0.0,
            template=COMPONENT_LIBRARY[panel_type]
        )
        self.fixtures.append(panel_fixture)
        
        return panel
    
    def route_conduits(self):
        """Generate conduit routes for all circuits"""
        if not self.panels:
            return
        
        panel = self.panels[0]
        
        for circuit in self.circuits:
            if circuit.fixtures:
                # Get primary room
                room = circuit.fixtures[0].room
                if room:
                    conduit = self.conduit_router.route_circuit(
                        circuit, panel.position, room
                    )
                    if conduit:
                        self.conduits.append(conduit)
    
    def validate(self) -> List[str]:
        """Validate entire system"""
        return SystemValidator.validate_all(self.fixtures, self.circuits, self.panels)
    
    def export_gltf(self) -> Dict:
        """Export to GLTF format"""
        return GLTFExporter.export_system(self.fixtures, self.conduits, self.panels)
    
    def export_metadata(self) -> Dict:
        """Export system metadata as JSON"""
        return {
            "system": "electrical",
            "standard": "IEC 60364 / BS 7671",
            "rooms": [
                {
                    "name": room.name,
                    "type": room.room_type.value,
                    "height": room.height,
                    "fixtures": [f.id for f in self.fixtures if f.room == room]
                }
                for room in self.rooms
            ],
            "circuits": [
                {
                    "id": circuit.id,
                    "type": circuit.circuit_type.value,
                    "name": circuit.name,
                    "fixtures": [f.id for f in circuit.fixtures],
                    "breaker_rating": circuit.breaker_rating,
                    "cable_size": circuit.cable_size,
                    "protection": circuit.protection_type.value,
                    "phase": circuit.phase,
                    "load_watts": circuit.calculate_load()[0],
                    "load_amps": circuit.calculate_load()[1]
                }
                for circuit in self.circuits
            ],
            "panels": [
                {
                    "id": panel.id,
                    "position": panel.position.to_list(),
                    "supply_rating": panel.supply_rating,
                    "total_load_watts": panel.calculate_total_load()[0],
                    "total_load_amps": panel.calculate_total_load()[1],
                    "circuits": [c.id for c in panel.circuits]
                }
                for panel in self.panels
            ],
            "conduits": [
                {
                    "id": conduit.id,
                    "diameter_mm": conduit.diameter,
                    "length_m": conduit.get_length(),
                    "circuits": conduit.cables
                }
                for conduit in self.conduits
            ]
        }

# ============================================================================
# DEMONSTRATION - RESIDENTIAL APARTMENT
# ============================================================================

def create_sample_apartment():
    """Create a sample 2-bedroom apartment with complete electrical system"""
    
    system = ElectricalSystem()
    
    # Define rooms
    living_room = Room(
        name="Living Room",
        room_type=RoomType.LIVING,
        corners=[
            Vector3(0, 0, 0),
            Vector3(5, 0, 0),
            Vector3(5, 0, 6),
            Vector3(0, 0, 6)
        ],
        height=2.7
    )
    
    kitchen = Room(
        name="Kitchen",
        room_type=RoomType.KITCHEN,
        corners=[
            Vector3(5, 0, 0),
            Vector3(8, 0, 0),
            Vector3(8, 0, 4),
            Vector3(5, 0, 4)
        ],
        height=2.7
    )
    
    bedroom1 = Room(
        name="Bedroom 1",
        room_type=RoomType.BEDROOM,
        corners=[
            Vector3(0, 0, 6),
            Vector3(4, 0, 6),
            Vector3(4, 0, 10),
            Vector3(0, 0, 10)
        ],
        height=2.7
    )
    
    bathroom = Room(
        name="Bathroom",
        room_type=RoomType.BATHROOM,
        corners=[
            Vector3(4, 0, 6),
            Vector3(6, 0, 6),
            Vector3(6, 0, 8),
            Vector3(4, 0, 8)
        ],
        height=2.7,
        wet_zones=[(Vector3(5, 0, 7), SPEC.BATHROOM_ZONE_1_RADIUS)]
    )
    
    # Add rooms
    for room in [living_room, kitchen, bedroom1, bathroom]:
        system.add_room(room)
    
    # Design each room
    system.design_room(living_room, Vector3(2.5, 0, 0), Vector3(0, 0, 1))
    system.design_room(kitchen, Vector3(6.5, 0, 0), Vector3(0, 0, 1))
    system.design_room(bedroom1, Vector3(2, 0, 6), Vector3(0, 0, 1))
    system.design_room(bathroom, Vector3(5, 0, 6), Vector3(0, 0, 1))
    
    # Add kitchen appliances
    system.add_appliance(kitchen, FixtureType.OVEN, Vector3(6, 0.9, 1))
    system.add_appliance(kitchen, FixtureType.COOKER, Vector3(7, 0, 1))
    
    # Add water heater in bathroom
    system.add_appliance(bathroom, FixtureType.WATER_HEATER, Vector3(5.5, 1.8, 7.5))
    
    # Generate circuits
    system.generate_circuits()
    
    # Create main panel
    system.create_panel(Vector3(0.5, 1.5, 0.5))
    
    # Route conduits
    system.route_conduits()
    
    return system

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print("ELECTRICAL BIM SYSTEM - Code-Compliant Design Engine")
    print("=" * 80)
    
    # Create sample system
    print("\n[1/5] Creating apartment layout...")
    system = create_sample_apartment()
    
    print(f"✓ Created {len(system.rooms)} rooms")
    print(f"✓ Placed {len(system.fixtures)} fixtures")
    
    # Validate system
    print("\n[2/5] Validating electrical system...")
    errors = system.validate()
    
    if errors:
        print(f"⚠ Found {len(errors)} validation errors:")
        for error in errors[:10]:  # Show first 10
            print(f"  - {error}")
    else:
        print("✓ All validation checks passed")
    
    # Export metadata
    print("\n[3/5] Generating system metadata...")
    metadata = system.export_metadata()
    
    print(f"✓ {len(metadata['circuits'])} circuits generated")
    print(f"✓ {len(metadata['panels'])} distribution panels")
    print(f"✓ {len(metadata['conduits'])} conduit runs")
    
    # Show circuit summary
    print("\n[4/5] Circuit Summary:")
    print("-" * 80)
    for circuit_data in metadata['circuits']:
        print(f"{circuit_data['id']}: {circuit_data['name']}")
        print(f"  Breaker: {circuit_data['breaker_rating']}A | "
              f"Cable: {circuit_data['cable_size']}mm² | "
              f"Load: {circuit_data['load_watts']:.0f}W ({circuit_data['load_amps']:.1f}A)")
        print(f"  Protection: {circuit_data['protection']} | Phase: {circuit_data['phase']}")
    
    # Export GLTF
    print("\n[5/5] Exporting GLTF geometry...")
    gltf_data = system.export_gltf()
    
    print(f"✓ Exported {len(gltf_data['nodes'])} nodes")
    print(f"✓ Exported {len(gltf_data['meshes'])} meshes")
    
    # Save outputs
    output_dir = "/home/claude"
    
    with open(f"{output_dir}/electrical_system.gltf", 'w') as f:
        json.dump(gltf_data, f, indent=2)
    
    with open(f"{output_dir}/electrical_metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\n✓ Files saved to {output_dir}/")
    print("\n" + "=" * 80)
    print("ELECTRICAL SYSTEM DESIGN COMPLETE")
    print("=" * 80)
    
    # Summary statistics
    total_load = sum(c['load_watts'] for c in metadata['circuits'])
    total_amps = sum(c['load_amps'] for c in metadata['circuits'])
    
    print(f"\nTotal System Load: {total_load:.0f}W ({total_amps:.1f}A)")
    print(f"Circuits: {len(metadata['circuits'])}")
    print(f"Fixtures: {len(system.fixtures)}")
    print(f"Conduit Length: {sum(c.get_length() for c in system.conduits):.1f}m")