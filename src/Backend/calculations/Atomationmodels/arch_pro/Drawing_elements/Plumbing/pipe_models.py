"""
Pipe and Fitting Models
Production-grade pipe routing and fittings
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict
from enum import Enum


class PipeSystem(Enum):
    """Pipe system classification"""
    COLD_WATER = "cold_water"
    HOT_WATER = "hot_water"
    RECIRCULATION = "recirculation"
    WASTE = "waste"
    VENT = "vent"
    SOIL = "soil"


class PipeMaterial(Enum):
    """Pipe materials"""
    COPPER = "copper"
    PEX = "pex"
    CPVC = "cpvc"
    PVC = "pvc"
    ABS = "abs"
    CAST_IRON = "cast_iron"
    GALVANIZED_STEEL = "galvanized_steel"


class FittingType(Enum):
    """Fitting types"""
    ELBOW_90 = "elbow_90"
    ELBOW_45 = "elbow_45"
    TEE = "tee"
    WYE = "wye"
    COUPLING = "coupling"
    REDUCER = "reducer"
    CAP = "cap"
    CLEANOUT = "cleanout"
    TRAP = "trap"
    VALVE = "valve"


@dataclass
class PipeSegment:
    """Individual pipe segment"""
    pipe_id: str
    start_point: np.ndarray  # [x, y, z]
    end_point: np.ndarray    # [x, y, z]
    diameter: float          # mm
    system: PipeSystem
    material: PipeMaterial
    flow_direction: Optional[np.ndarray] = None  # Unit vector
    
    def __post_init__(self):
        self.start_point = np.array(self.start_point, dtype=float)
        self.end_point = np.array(self.end_point, dtype=float)
        if self.flow_direction is None:
            vec = self.end_point - self.start_point
            length = np.linalg.norm(vec)
            self.flow_direction = vec / length if length > 0 else np.array([0, 0, 0])
    
    def length(self) -> float:
        """Calculate pipe segment length"""
        return np.linalg.norm(self.end_point - self.start_point)
    
    def get_slope(self) -> float:
        """Calculate slope (rise/run) - critical for drainage"""
        vec = self.end_point - self.start_point
        horizontal_dist = np.sqrt(vec[0]**2 + vec[1]**2)
        if horizontal_dist < 1.0:  # Vertical pipe
            return float('inf')
        return vec[2] / horizontal_dist
    
    def is_downward_sloping(self, min_slope: float = -0.02) -> bool:
        """Check if pipe slopes downward (for drainage validation)"""
        slope = self.get_slope()
        if slope == float('inf'):
            return True  # Vertical pipes are acceptable
        return slope <= min_slope
    
    def to_dict(self) -> Dict:
        """Export segment metadata"""
        return {
            "pipe_id": self.pipe_id,
            "start_point": self.start_point.tolist(),
            "end_point": self.end_point.tolist(),
            "diameter": self.diameter,
            "system": self.system.value,
            "material": self.material.value,
            "length": self.length(),
            "slope": self.get_slope(),
            "flow_direction": self.flow_direction.tolist()
        }
    
    def generate_mesh(self, segments: int = 8) -> np.ndarray:
        """Generate cylindrical mesh for pipe"""
        start = self.start_point
        end = self.end_point
        radius = self.diameter / 2.0
        
        # Create cylinder
        direction = end - start
        length = np.linalg.norm(direction)
        if length < 0.1:
            return np.array([])
        
        direction = direction / length
        
        # Find perpendicular vectors
        if abs(direction[2]) < 0.9:
            perp1 = np.cross(direction, np.array([0, 0, 1]))
        else:
            perp1 = np.cross(direction, np.array([1, 0, 0]))
        perp1 = perp1 / np.linalg.norm(perp1)
        perp2 = np.cross(direction, perp1)
        
        vertices = []
        for i in range(segments):
            angle = 2 * np.pi * i / segments
            offset = radius * (np.cos(angle) * perp1 + np.sin(angle) * perp2)
            vertices.append(start + offset)
            vertices.append(end + offset)
        
        return np.array(vertices, dtype=np.float32)


@dataclass
class Fitting:
    """Pipe fitting"""
    fitting_id: str
    fitting_type: FittingType
    position: np.ndarray
    diameter: float  # Primary diameter
    diameter_2: Optional[float] = None  # For reducers
    rotation: float = 0.0
    system: Optional[PipeSystem] = None
    
    def __post_init__(self):
        self.position = np.array(self.position, dtype=float)
    
    def to_dict(self) -> Dict:
        """Export fitting metadata"""
        return {
            "fitting_id": self.fitting_id,
            "fitting_type": self.fitting_type.value,
            "position": self.position.tolist(),
            "diameter": self.diameter,
            "diameter_2": self.diameter_2,
            "rotation": self.rotation,
            "system": self.system.value if self.system else None
        }
    
    def generate_mesh(self) -> np.ndarray:
        """Generate fitting geometry"""
        # Simplified as a sphere at connection point
        radius = self.diameter / 2.0 * 1.5  # Slightly larger than pipe
        segments = 8
        
        vertices = []
        for i in range(segments):
            theta = np.pi * i / segments
            for j in range(segments * 2):
                phi = 2 * np.pi * j / (segments * 2)
                x = radius * np.sin(theta) * np.cos(phi) + self.position[0]
                y = radius * np.sin(theta) * np.sin(phi) + self.position[1]
                z = radius * np.cos(theta) + self.position[2]
                vertices.append([x, y, z])
        
        return np.array(vertices, dtype=np.float32)


class Trap:
    """Plumbing trap (P-trap, S-trap, etc.)"""
    
    def __init__(
        self,
        trap_id: str,
        trap_type: str,  # "p_trap", "s_trap", etc.
        position: np.ndarray,
        inlet_diameter: float,
        outlet_diameter: float = None
    ):
        self.trap_id = trap_id
        self.trap_type = trap_type
        self.position = np.array(position, dtype=float)
        self.inlet_diameter = inlet_diameter
        self.outlet_diameter = outlet_diameter or inlet_diameter
        self.seal_depth = 50  # mm - water seal depth
    
    def to_dict(self) -> Dict:
        """Export trap metadata"""
        return {
            "trap_id": self.trap_id,
            "trap_type": self.trap_type,
            "position": self.position.tolist(),
            "inlet_diameter": self.inlet_diameter,
            "outlet_diameter": self.outlet_diameter,
            "seal_depth": self.seal_depth
        }
    
    def generate_mesh(self) -> np.ndarray:
        """Generate trap geometry (simplified U-shape)"""
        vertices = []
        radius = self.inlet_diameter / 2.0
        
        # Create U-shaped path
        if self.trap_type == "p_trap":
            # P-trap: down, across, up
            points = [
                self.position + np.array([0, 0, 0]),
                self.position + np.array([0, 0, -100]),
                self.position + np.array([100, 0, -100]),
                self.position + np.array([100, 0, -50])
            ]
        else:  # S-trap
            points = [
                self.position + np.array([0, 0, 0]),
                self.position + np.array([0, 0, -100]),
                self.position + np.array([0, 0, -150])
            ]
        
        # Generate vertices along path
        for i in range(len(points) - 1):
            start = points[i]
            end = points[i + 1]
            for t in [0, 1]:
                pos = start * (1 - t) + end * t
                vertices.append(pos)
        
        return np.array(vertices, dtype=np.float32)


class Valve:
    """Isolation or control valve"""
    
    def __init__(
        self,
        valve_id: str,
        valve_type: str,  # "isolation", "check", "pressure_reducing"
        position: np.ndarray,
        diameter: float,
        system: PipeSystem
    ):
        self.valve_id = valve_id
        self.valve_type = valve_type
        self.position = np.array(position, dtype=float)
        self.diameter = diameter
        self.system = system
    
    def to_dict(self) -> Dict:
        """Export valve metadata"""
        return {
            "valve_id": self.valve_id,
            "valve_type": self.valve_type,
            "position": self.position.tolist(),
            "diameter": self.diameter,
            "system": self.system.value
        }
    
    def generate_mesh(self) -> np.ndarray:
        """Generate valve geometry"""
        # Simplified as a box
        size = self.diameter * 2
        vertices = [
            self.position + np.array([-size/2, -size/2, -size/2]),
            self.position + np.array([size/2, -size/2, -size/2]),
            self.position + np.array([size/2, size/2, -size/2]),
            self.position + np.array([-size/2, size/2, -size/2]),
            self.position + np.array([-size/2, -size/2, size/2]),
            self.position + np.array([size/2, -size/2, size/2]),
            self.position + np.array([size/2, size/2, size/2]),
            self.position + np.array([-size/2, size/2, size/2])
        ]
        return np.array(vertices, dtype=np.float32)


class PlumbingStack:
    """Vertical plumbing stack (soil, waste, or vent)"""
    
    def __init__(
        self,
        stack_id: str,
        stack_type: str,  # "soil", "waste", "vent"
        base_position: np.ndarray,
        floors: List[float],  # Z-coordinates of floor levels
        diameter: float
    ):
        self.stack_id = stack_id
        self.stack_type = stack_type
        self.base_position = np.array(base_position[:2], dtype=float)  # X, Y only
        self.floors = sorted(floors)
        self.diameter = diameter
        self.branches: List[Tuple[float, np.ndarray]] = []  # (floor_z, branch_direction)
        
    def add_branch(self, floor_z: float, direction: np.ndarray):
        """Add horizontal branch at specific floor"""
        self.branches.append((floor_z, np.array(direction, dtype=float)))
    
    def get_segments(self) -> List[PipeSegment]:
        """Generate pipe segments for the stack"""
        segments = []
        
        # Main vertical stack
        for i in range(len(self.floors) - 1):
            seg = PipeSegment(
                pipe_id=f"{self.stack_id}_seg_{i}",
                start_point=np.array([
                    self.base_position[0],
                    self.base_position[1],
                    self.floors[i]
                ]),
                end_point=np.array([
                    self.base_position[0],
                    self.base_position[1],
                    self.floors[i + 1]
                ]),
                diameter=self.diameter,
                system=PipeSystem.SOIL if self.stack_type == "soil" else PipeSystem.VENT,
                material=PipeMaterial.PVC
            )
            segments.append(seg)
        
        return segments
    
    def to_dict(self) -> Dict:
        """Export stack metadata"""
        return {
            "stack_id": self.stack_id,
            "stack_type": self.stack_type,
            "base_position": self.base_position.tolist(),
            "floors": self.floors,
            "diameter": self.diameter,
            "branches": [
                {"floor_z": z, "direction": dir.tolist()}
                for z, dir in self.branches
            ]
        }


class PipeNetwork:
    """Collection of pipes forming a network"""
    
    def __init__(self, network_id: str, system: PipeSystem):
        self.network_id = network_id
        self.system = system
        self.segments: List[PipeSegment] = []
        self.fittings: List[Fitting] = []
        self.valves: List[Valve] = []
        
    def add_segment(self, segment: PipeSegment):
        """Add pipe segment to network"""
        self.segments.append(segment)
    
    def add_fitting(self, fitting: Fitting):
        """Add fitting to network"""
        self.fittings.append(fitting)
    
    def add_valve(self, valve: Valve):
        """Add valve to network"""
        self.valves.append(valve)
    
    def validate_slopes(self, min_slope: float = -0.02) -> List[str]:
        """Validate drainage slopes (waste/soil systems only)"""
        errors = []
        
        if self.system not in [PipeSystem.WASTE, PipeSystem.SOIL]:
            return errors
        
        for seg in self.segments:
            if not seg.is_downward_sloping(min_slope):
                errors.append(
                    f"Segment {seg.pipe_id} has incorrect slope: {seg.get_slope():.4f} "
                    f"(minimum required: {min_slope})"
                )
        
        return errors
    
    def calculate_total_length(self) -> float:
        """Calculate total pipe length in network"""
        return sum(seg.length() for seg in self.segments)
    
    def to_dict(self) -> Dict:
        """Export network metadata"""
        return {
            "network_id": self.network_id,
            "system": self.system.value,
            "total_length": self.calculate_total_length(),
            "segment_count": len(self.segments),
            "fitting_count": len(self.fittings),
            "valve_count": len(self.valves),
            "segments": [seg.to_dict() for seg in self.segments],
            "fittings": [fit.to_dict() for fit in self.fittings],
            "valves": [valve.to_dict() for valve in self.valves]
        }