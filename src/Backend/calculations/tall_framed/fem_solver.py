import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List

# -------------------------------------------------
# DATA STRUCTURES
# -------------------------------------------------

@dataclass
class Node:
    id: int
    x: float
    y: float
    fixity: List[bool]          # [ux, uy, rz]  True = fixed
    load: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    disp: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])

@dataclass
class Element:
    id: int
    node_i: int
    node_j: int
    E: float
    A: float
    I: float
    udl: float = 0.0            # kN/m (NEGATIVE = downward)
    forces: Dict[str, float] = field(default_factory=dict)


# -------------------------------------------------
# FEM SOLVER
# -------------------------------------------------

class FEM2DSolver:

    def __init__(self):
        self.nodes: Dict[int, Node] = {}
        self.elements: Dict[int, Element] = {}
        self.node_index: Dict[int, int] = {}

    # -----------------------------
    # MODEL BUILDING
    # -----------------------------

    def add_node(self, id: int, x: float, y: float, fixity: List[bool]):
        self.nodes[id] = Node(id, x, y, fixity)

    def add_element(self, id: int, node_i: int, node_j: int, E: float, A: float, I: float):
        self.elements[id] = Element(id, node_i, node_j, E, A, I)

    def add_nodal_load(self, node_id: int, fx=0.0, fy=0.0, mz=0.0):
        self.nodes[node_id].load[0] += fx
        self.nodes[node_id].load[1] += fy
        self.nodes[node_id].load[2] += mz

    def add_udl(self, element_id: int, w: float):
        # Downward load must be NEGATIVE
        self.elements[element_id].udl = w

    # -----------------------------
    # SOLUTION
    # -----------------------------

    def solve(self):

        # --- DOF mapping (FIXED BUG) ---
        self.node_index = {nid: i for i, nid in enumerate(sorted(self.nodes))}
        n_nodes = len(self.nodes)
        dof = 3 * n_nodes

        K = np.zeros((dof, dof))
        F = np.zeros(dof)

        # --- ASSEMBLY ---
        for el in self.elements.values():

            ni = self.nodes[el.node_i]
            nj = self.nodes[el.node_j]

            xi, yi = ni.x, ni.y
            xj, yj = nj.x, nj.y

            L = np.hypot(xj - xi, yj - yi)
            c = (xj - xi) / L
            s = (yj - yi) / L

            E, A, I = el.E, el.A, el.I

            # --- LOCAL STIFFNESS ---
            k_local = np.array([
                [ E*A/L,        0,              0,      -E*A/L,        0,              0 ],
                [ 0,      12*E*I/L**3,   6*E*I/L**2,       0, -12*E*I/L**3,   6*E*I/L**2 ],
                [ 0,       6*E*I/L**2,     4*E*I/L,       0,  -6*E*I/L**2,     2*E*I/L ],
                [ -E*A/L,       0,              0,       E*A/L,        0,              0 ],
                [ 0,     -12*E*I/L**3,  -6*E*I/L**2,       0,  12*E*I/L**3,  -6*E*I/L**2 ],
                [ 0,       6*E*I/L**2,     2*E*I/L,       0,  -6*E*I/L**2,     4*E*I/L ]
            ])

            # --- TRANSFORMATION ---
            T = np.array([
                [ c,  s, 0,  0,  0, 0],
                [-s,  c, 0,  0,  0, 0],
                [ 0,  0, 1,  0,  0, 0],
                [ 0,  0, 0,  c,  s, 0],
                [ 0,  0, 0, -s,  c, 0],
                [ 0,  0, 0,  0,  0, 1]
            ])

            k_global = T.T @ k_local @ T

            # --- DOF INDICES ---
            ii = self.node_index[el.node_i]
            jj = self.node_index[el.node_j]

            dofs = [
                3*ii, 3*ii+1, 3*ii+2,
                3*jj, 3*jj+1, 3*jj+2
            ]

            for r in range(6):
                for c2 in range(6):
                    K[dofs[r], dofs[c2]] += k_global[r, c2]

            # --- EQUIVALENT NODAL LOADS (UDL) ---
            if el.udl != 0.0:
                w = el.udl   # negative = downward

                f_local = np.array([
                    0,
                    w*L/2,
                    w*L**2/12,
                    0,
                    w*L/2,
                    -w*L**2/12
                ])

                f_global = T.T @ f_local

                for r in range(6):
                    F[dofs[r]] += f_global[r]

        # --- NODAL LOADS ---
        for nid, node in self.nodes.items():
            i = self.node_index[nid]
            F[3*i:3*i+3] += node.load

        # --- BOUNDARY CONDITIONS ---
        fixed = []
        for nid, node in self.nodes.items():
            i = self.node_index[nid]
            for d in range(3):
                if node.fixity[d]:
                    fixed.append(3*i + d)

        free = [i for i in range(dof) if i not in fixed]

        K_ff = K[np.ix_(free, free)]
        F_f = F[free]

        # --- SOLVE ---
        try:
            u_f = np.linalg.solve(K_ff, F_f)
        except np.linalg.LinAlgError:
            raise RuntimeError("Structure is unstable (mechanism detected)")

        U = np.zeros(dof)
        U[free] = u_f

        # --- STORE DISPLACEMENTS ---
        for nid, node in self.nodes.items():
            i = self.node_index[nid]
            node.disp = U[3*i:3*i+3].tolist()

        # --- MEMBER FORCES ---
        self._recover_member_forces(U)

        return {
            "displacements": {nid: n.disp for nid, n in self.nodes.items()},
            "member_forces": {eid: e.forces for eid, e in self.elements.items()}
        }

    # -----------------------------
    # MEMBER FORCE RECOVERY
    # -----------------------------

    def _recover_member_forces(self, U):

        for el in self.elements.values():

            ni = self.nodes[el.node_i]
            nj = self.nodes[el.node_j]

            xi, yi = ni.x, ni.y
            xj, yj = nj.x, nj.y

            L = np.hypot(xj - xi, yj - yi)
            c = (xj - xi) / L
            s = (yj - yi) / L

            ii = self.node_index[el.node_i]
            jj = self.node_index[el.node_j]

            u_global = np.concatenate([
                U[3*ii:3*ii+3],
                U[3*jj:3*jj+3]
            ])

            T = np.array([
                [ c,  s, 0,  0,  0, 0],
                [-s,  c, 0,  0,  0, 0],
                [ 0,  0, 1,  0,  0, 0],
                [ 0,  0, 0,  c,  s, 0],
                [ 0,  0, 0, -s,  c, 0],
                [ 0,  0, 0,  0,  0, 1]
            ])

            u_local = T @ u_global

            E, A, I = el.E, el.A, el.I

            k_local = np.array([
                [ E*A/L,        0,              0,      -E*A/L,        0,              0 ],
                [ 0,      12*E*I/L**3,   6*E*I/L**2,       0, -12*E*I/L**3,   6*E*I/L**2 ],
                [ 0,       6*E*I/L**2,     4*E*I/L,       0,  -6*E*I/L**2,     2*E*I/L ],
                [ -E*A/L,       0,              0,       E*A/L,        0,              0 ],
                [ 0,     -12*E*I/L**3,  -6*E*I/L**2,       0,  12*E*I/L**3,  -6*E*I/L**2 ],
                [ 0,       6*E*I/L**2,     2*E*I/L,       0,  -6*E*I/L**2,     4*E*I/L ]
            ])

            f_elastic = k_local @ u_local

            # Fixed-end forces (UDL)
            w = el.udl
            f_fixed = np.array([
                0,
                w*L/2,
                w*L**2/12,
                0,
                w*L/2,
                -w*L**2/12
            ])

            f = f_elastic - f_fixed

            el.forces = {
                "N_i": f[0], "V_i": f[1], "M_i": f[2],
                "N_j": f[3], "V_j": f[4], "M_j": f[5]
            }
