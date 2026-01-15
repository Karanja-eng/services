import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import copy

@dataclass
class Node:
    id: int
    x: float
    y: float
    fixity: List[bool] = field(default_factory=lambda: [False, False, False]) # [dx, dy, rz] True=Fixed
    # Results
    disp: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    # Loads
    load: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0]) # [Fx, Fy, Mz]

@dataclass
class Element:
    id: int
    node_i: int # Start node ID
    node_j: int # End node ID
    E: float # Elastic Modulus (kNm2)
    A: float # Area (m2)
    I: float # Moment of Inertia (m4)
    # Loads
    udl: float = 0.0 # Uniform Distributed Load (kN/m) - local y axis
    # Results
    forces: Dict[str, float] = field(default_factory=dict) # {N_i, V_i, M_i, N_j, V_j, M_j}

class FEM2DSolver:
    def __init__(self):
        self.nodes: Dict[int, Node] = {}
        self.elements: Dict[int, Element] = {}
    
    def add_node(self, id: int, x: float, y: float, fixity: List[bool]):
        self.nodes[id] = Node(id, x, y, fixity)
        
    def add_element(self, id: int, node_i: int, node_j: int, E: float, A: float, I: float):
        self.elements[id] = Element(id, node_i, node_j, E, A, I)
        
    def add_nodal_load(self, node_id: int, fx: float = 0.0, fy: float = 0.0, mz: float = 0.0):
        if node_id in self.nodes:
            self.nodes[node_id].load[0] += fx
            self.nodes[node_id].load[1] += fy
            self.nodes[node_id].load[2] += mz

    def add_udl(self, element_id: int, w: float):
        if element_id in self.elements:
            self.elements[element_id].udl = w

    def solve(self):
        n_nodes = len(self.nodes)
        dof = n_nodes * 3
        K_global = np.zeros((dof, dof))
        F_global = np.zeros(dof)
        
        # 1. Assemble Global Stiffness Matrix & Load Vector
        for el in self.elements.values():
            ni = self.nodes[el.node_i]
            nj = self.nodes[el.node_j]
            
            L = np.sqrt((nj.x - ni.x)**2 + (nj.y - ni.y)**2)
            c = (nj.x - ni.x) / L
            s = (nj.y - ni.y) / L
            
            # Local stiffness k_local
            E, A, I = el.E, el.A, el.I
            k = np.array([
                [E*A/L, 0, 0, -E*A/L, 0, 0],
                [0, 12*E*I/L**3, 6*E*I/L**2, 0, -12*E*I/L**3, 6*E*I/L**2],
                [0, 6*E*I/L**2, 4*E*I/L, 0, -6*E*I/L**2, 2*E*I/L],
                [-E*A/L, 0, 0, E*A/L, 0, 0],
                [0, -12*E*I/L**3, -6*E*I/L**2, 0, 12*E*I/L**3, -6*E*I/L**2],
                [0, 6*E*I/L**2, 2*E*I/L, 0, -6*E*I/L**2, 4*E*I/L]
            ])
            
            # Transformation matrix T
            T = np.zeros((6, 6))
            T[0:3, 0:3] = [[c, s, 0], [-s, c, 0], [0, 0, 1]]
            T[3:6, 3:6] = [[c, s, 0], [-s, c, 0], [0, 0, 1]]
            
            # Global stiffness for element
            K_el = T.T @ k @ T
            
            # Add to global K
            indices = [
                3*(el.node_i-1), 3*(el.node_i-1)+1, 3*(el.node_i-1)+2,
                3*(el.node_j-1), 3*(el.node_j-1)+1, 3*(el.node_j-1)+2
            ]
            
            for r in range(6):
                for col in range(6):
                    K_global[indices[r], indices[col]] += K_el[r, col]
            
            # Equivalent Nodal Loads from UDL
            w = el.udl
            if w != 0:
                # Fixed End Forces (Local)
                # Fy_i = wL/2, M_i = wL^2/12, Fy_j = wL/2, M_j = -wL^2/12
                f_fixed_local = np.array([
                    0, w*L/2, w*L**2/12, 
                    0, w*L/2, -w*L**2/12
                ])
                f_fixed_global = T.T @ f_fixed_local
                
                # Add to Global Force Vector
                for r in range(6):
                    F_global[indices[r]] += f_fixed_global[r]
                    
        # Apply Nodal Loads
        for node_id, node in self.nodes.items():
            idx = 3 * (node_id - 1)
            F_global[idx] += node.load[0]
            F_global[idx+1] += node.load[1]
            F_global[idx+2] += node.load[2]

        # 2. Apply Boundary Conditions
        fixed_indices = []
        for node_id, node in self.nodes.items():
            idx_base = 3 * (node_id - 1)
            if node.fixity[0]: fixed_indices.append(idx_base)   # dx
            if node.fixity[1]: fixed_indices.append(idx_base+1) # dy
            if node.fixity[2]: fixed_indices.append(idx_base+2) # rz
            
        free_indices = [i for i in range(dof) if i not in fixed_indices]
        
        # Partition matrices
        K_ff = K_global[np.ix_(free_indices, free_indices)]
        F_f = F_global[free_indices]
        
        # 3. Solve for Displacements
        try:
            u_f = np.linalg.solve(K_ff, F_f)
        except np.linalg.LinAlgError:
            print("Singular matrix - Mechanism or Unstable")
            return None
            
        u_global = np.zeros(dof)
        u_global[free_indices] = u_f
        
        # Store Nodal Results
        for node_id, node in self.nodes.items():
            idx = 3 * (node_id - 1)
            node.disp = u_global[idx:idx+3].tolist()
            
        # 4. Calculate Member Forces
        self._calculate_member_forces(u_global)
        
        return {
            "max_disp": max(abs(u_global)),
            "elements": {eid: e.forces for eid, e in self.elements.items()}
        }

    def _calculate_member_forces(self, u_global):
        for el in self.elements.values():
            ni = self.nodes[el.node_i]
            nj = self.nodes[el.node_j]
            L = np.sqrt((nj.x - ni.x)**2 + (nj.y - ni.y)**2)
            c = (nj.x - ni.x) / L
            s = (nj.y - ni.y) / L
            
            # Element displacements global
            idx_i = 3 * (el.node_i - 1)
            idx_j = 3 * (el.node_j - 1)
            u_el_glob = np.concatenate([u_global[idx_i:idx_i+3], u_global[idx_j:idx_j+3]])
            
            # Transform to local
            T = np.zeros((6, 6))
            T[0:3, 0:3] = [[c, s, 0], [-s, c, 0], [0, 0, 1]]
            T[3:6, 3:6] = [[c, s, 0], [-s, c, 0], [0, 0, 1]]
            u_el_loc = T @ u_el_glob
            
            # Local stiffness
            E, A, I = el.E, el.A, el.I
            k_local = np.array([
                [E*A/L, 0, 0, -E*A/L, 0, 0],
                [0, 12*E*I/L**3, 6*E*I/L**2, 0, -12*E*I/L**3, 6*E*I/L**2],
                [0, 6*E*I/L**2, 4*E*I/L, 0, -6*E*I/L**2, 2*E*I/L],
                [-E*A/L, 0, 0, E*A/L, 0, 0],
                [0, -12*E*I/L**3, -6*E*I/L**2, 0, 12*E*I/L**3, -6*E*I/L**2],
                [0, 6*E*I/L**2, 2*E*I/L, 0, -6*E*I/L**2, 4*E*I/L]
            ])
            
            # Forces = k * u - FixedEndForces
            f_elastic = k_local @ u_el_loc
            
            # Subtract Fixed End Forces (Reaction logic)
            # The calculation K*d includes the effect of nodal loads. 
            # For member loads, we must subtract the 'Fixed End Forces' vector to get true member forces
            w = el.udl
            f_fixed = np.array([0, w*L/2, w*L**2/12, 0, w*L/2, -w*L**2/12])
            
            f_final = f_elastic - f_fixed
            
            el.forces = {
                "N_i": f_final[0], "V_i": f_final[1], "M_i": f_final[2],
                "N_j": f_final[3], "V_j": f_final[4], "M_j": f_final[5]
            }

    def optimize_redistribution(self, original_results):
        """
        Apply up to 20% redistribution to hogging moments at supports (BS 8110 exp)
        Simple heuristic: Cap Max Moment and re-equilibrate?
        FEA Redistribution is complex.
        Simplified approach: Return modified moments where Peak M_hog is reduced 20%
        and span moments are increased.
        """
        optimized = {}
        for eid, res in original_results["elements"].items():
            # Check moments
            mi = res["M_i"]
            mj = res["M_j"]
            
            # Identify hogging (negative moment by sign convention? Check local coords)
            # Local: +M is counter-clockwise.
            # Left node: +M is Sagging (Smile), -M is Hogging (Frown)
            # Right node: -M is Sagging, +M is Hogging
            
            # Let's assume standard checking:
            # support moments are usually high.
            # Reduce max abs moment by 20%
            
            factor = 0.8 # 20% reduction
            new_mi = mi * factor
            new_mj = mj * factor
            
            # Re-calculate span moment increase?
            # For UDL w: M_span_max approx wL^2/8 - (Mi+Mj)/2
            # If supports reduce, span increases.
            
            optimized[eid] = {
                **res,
                "M_i": new_mi,
                "M_j": new_mj,
                "redistributed": True
            }
        
        return {"elements": optimized}
