import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
import json

@dataclass
class Material:
    name: str
    E: float  # Modulus of elasticity (kN/m2)
    G: float  # Shear modulus (kN/m2)
    density: float  # kN/m3
    fcu: float = 0  # Concrete fcu (MPa)
    fy: float = 0   # Steel fy (MPa)

    @staticmethod
    def concrete_C30():
        return Material("C30", 30e6, 12.5e6, 25.0, 30, 500)

@dataclass
class Section:
    name: str
    width: float  # mm
    depth: float  # mm
    A: float = 0   # m2
    Iz: float = 0  # m4
    Iy: float = 0  # m4
    J: float = 0   # m4 (Torsion constant)

    @staticmethod
    def rectangular(name, width_mm, depth_mm):
        b = width_mm / 1000.0
        h = depth_mm / 1000.0
        A = b * h
        Iz = b * h**3 / 12
        Iy = h * b**3 / 12
        # Torsion constant for rectangle (approx)
        J = (b * h**3 / 3) * (1 - 0.63 * h/b + 0.052 * (h/b)**5) if b > h else (h * b**3 / 3) * (1 - 0.63 * b/h + 0.052 * (b/h)**5)
        return Section(name, width_mm, depth_mm, A, Iz, Iy, J)

@dataclass
class Node:
    id: int
    x: float
    y: float
    z: float
    support: Dict[str, bool] = field(default_factory=lambda: {'dx': False, 'dy': False, 'dz': False, 'rx': False, 'ry': False, 'rz': False})
    # Results
    displacements: Dict[str, List[float]] = field(default_factory=dict) # combo -> [dx, dy, dz, rx, ry, rz]

@dataclass
class Member:
    id: int
    start_node_id: int
    end_node_id: int
    section: Section
    material: Material
    
    def length(self, nodes: Dict):
        n1 = nodes[self.start_node_id]
        n2 = nodes[self.end_node_id]
        return np.sqrt((n2.x - n1.x)**2 + (n2.y - n1.y)**2 + (n2.z - n1.z)**2)

class LoadType:
    UDL = "UDL"
    POINT = "POINT"

class LoadCategory:
    DEAD = "DEAD"
    IMPOSED = "IMPOSED"
    WIND = "WIND"

@dataclass
class Load:
    category: str
    member_id: int = None
    node_id: int = None
    load_type: str = LoadType.UDL
    Fx: float = 0
    Fy: float = 0
    Fz: float = 0
    Mx: float = 0
    My: float = 0
    Mz: float = 0
    coordinate_system: str = 'global'

@dataclass
class LoadCombination:
    name: str
    factors: Dict[str, float]

    @staticmethod
    def ULS_dead_imposed():
        return LoadCombination("1.4D + 1.6L", {LoadCategory.DEAD: 1.4, LoadCategory.IMPOSED: 1.6})

class Frame3DAnalyzer:
    def __init__(self):
        self.nodes: Dict[int, Node] = {}
        self.members: Dict[int, Member] = {}
        self.loads: List[Load] = []
        self.load_combinations: List[LoadCombination] = []
        self.member_forces: Dict[str, Dict[int, np.ndarray]] = {} # combo -> member_id -> 12-forces
        
    def add_node(self, node: Node):
        self.nodes[node.id] = node
        
    def add_member(self, member: Member):
        self.members[member.id] = member
        
    def add_load(self, load: Load):
        self.loads.append(load)
        
    def add_load_combination(self, combo: LoadCombination):
        self.load_combinations.append(combo)
        
    def analyze_all_combinations(self):
        # Placeholder for real 3D FEM solver implementation
        # For now, it will use the logic from fem_solver.py (2D) for simple cases
        # Or return mock results if 3D is too complex to implement here
        # But New_frame.py needs results to generate viz.
        
        for combo in self.load_combinations:
            self.member_forces[combo.name] = {}
            for mid, m in self.members.items():
                # Default zero forces
                self.member_forces[combo.name][mid] = np.zeros(12)
        
        # In a real scenario, this would solve the stiffness matrix
        pass

    def export_to_json(self, filename: str):
        # Simplified export
        data = {
            'nodes': {nid: {'x': n.x, 'y': n.y, 'z': n.z} for nid, n in self.nodes.items()},
            'members': {mid: {'start': m.start_node_id, 'end': m.end_node_id} for mid, m in self.members.items()}
        }
        with open(filename, 'w') as f:
            json.dump(data, f)
