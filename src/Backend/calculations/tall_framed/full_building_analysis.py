from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal, Tuple
import math
from collections import defaultdict
import numpy as np

# Import Moment Distribution Solver from Beams module
# Adjust import based on actual file structure
try:
    from ..Beams.moment_distribution_backend import (
        MomentDistributionSolver, FrameMD, JointMD, MemberMD, 
        LoadMD, MemberType, EndCondition, JointType
    )
    from .fem_solver import FEM2DSolver
except ImportError:
    # Fallback for relative import issues during dev/testing
    from calculations.Beams.moment_distribution_backend import (
        MomentDistributionSolver, FrameMD, JointMD, MemberMD, 
        LoadMD, MemberType, EndCondition, JointType
    )
    from calculations.tall_framed.fem_solver import FEM2DSolver

router = APIRouter()

# ============================================================================
# DATA MODELS
# ============================================================================

class Point3D(BaseModel):
    x: float
    y: float
    z: float

class ElementProperties(BaseModel):
    width: float = 0.3
    depth: float = 0.3
    material_grade: str = "C30"
    load_combined: float = 0.0 # kN/m2 for slabs typically

class BuildingElement(BaseModel):
    id: str
    type: Literal["column", "beam", "slab", "wall", "foundation", "void"]
    start: Optional[Point3D] = None
    end: Optional[Point3D] = None # Beams/Calculated for columns
    position: Optional[Point3D] = None # For insertions
    properties: ElementProperties
    layer: Optional[str] = "0"

class BuildingAnalysisRequest(BaseModel):
    elements: List[BuildingElement]
    method: Literal["stiffness", "moment_distribution"] = "moment_distribution"
    dead_load_factor: float = 1.4
    live_load_factor: float = 1.6
    slab_load: float = 5.0 # kN/m2 default if not on element

class AnalysisResult(BaseModel):
    element_id: str
    M_max: float
    V_max: float
    N_max: float
    sections: List[Dict[str, float]] # [{ratio, M, V, N}, ...]
    status: str

# ============================================================================
# LOGIC
# ============================================================================

class FullBuildingAnalyzer:
    def __init__(self, request: BuildingAnalysisRequest):
        self.elements = request.elements
        self.method = request.method
        self.default_slab_load = request.slab_load
        
        self.beams = [e for e in self.elements if e.type == 'beam']
        self.columns = [e for e in self.elements if e.type == 'column']
        self.slabs = [e for e in self.elements if e.type == 'slab']
        
        # Determine tolerance for connectivity
        self.tol = 0.1 

        self.beam_loads = defaultdict(list) # map beam_id -> List[LoadMD]
        self.results = {}

    def analyze(self):
        # 1. Distribute Slab Loads to Beams
        self._distribute_slab_loads()
        
        # 2. Identify Frames (Grid Lines)
        # We group elements into X-Frames (constant Z) and Z-Frames (constant X)
        x_frames, z_frames = self._identify_frames()
        
        # 3. Solve Frames
        for frame_id, frame_elements in x_frames.items():
            self._solve_2d_frame(frame_elements, plane="XZ")
            
        for frame_id, frame_elements in z_frames.items():
            self._solve_2d_frame(frame_elements, plane="YZ")
            
        return self._format_results()

    def _distribute_slab_loads(self):
        """BS 8110 Yield Line / Tributary Area Load Distribution"""
        for slab in self.slabs:
            # Assume slab is rectangular defined by start (min) and end (max) (placeholder logic)
            # In real 3D input, start/end might be center/undefined. 
            # We need to find bounding box of slab or matching beams.
            
            # Find beams surrounding this slab
            # Simplified: Find beams whose centers are close to slab center? 
            # Better: Find beams that form the perimeter.
            
            slab_z = slab.position.y if slab.position else 0 # Y is up in ThreeJS usually? 
            # Note: User input usually Y up.
            
            # Let's assume slab.start and slab.end define the rectangle corners (common in standard builders)
            if not slab.start or not slab.end: 
                continue 
                
            sx_min = min(slab.start.x, slab.end.x)
            sx_max = max(slab.start.x, slab.end.x)
            sz_min = min(slab.start.z, slab.end.z)
            sz_max = max(slab.start.z, slab.end.z)
            
            lx = sx_max - sx_min
            lz = sz_max - sz_min
            
            # Identify Aspect Ratio
            ratio = max(lx, lz) / min(lx, lz)
            short_span = min(lx, lz)
            is_two_way = ratio <= 2.0
            
            # Load intensity (kN/m2)
            w = slab.properties.load_combined or self.default_slab_load
            
            # Find supporting beams
            # We look for beams that align with edges
            for beam in self.beams:
                if not beam.start or not beam.end: continue
                
                # Check alignment with edges (within tolerance)
                bx_min, bx_max = min(beam.start.x, beam.end.x), max(beam.start.x, beam.end.x)
                bz_min, bz_max = min(beam.start.z, beam.end.z), max(beam.start.z, beam.end.z)
                
                # Check beam length overlap (simplified)
                
                # CASE 1: Beam on long edge (XZ aligned)
                # ... implementing strict geometric checks is hard without a geometry engine.
                # Heuristic: Assign loads to ALL beams fully contained within slab bounds?
                # No, beams are AT edges.
                
                # Let's accept beams 'on' the perimeter
                on_x_edge = (abs(bz_min - sz_min) < self.tol or abs(bz_min - sz_max) < self.tol) and (bx_max > sx_min and bx_min < sx_max)
                on_z_edge = (abs(bx_min - sx_min) < self.tol or abs(bx_min - sx_max) < self.tol) and (bz_max > sz_min and bz_min < sz_max)
                
                if on_x_edge or on_z_edge:
                    # Determine load shape
                    # BS 8110 Cl 3.5.3.4
                    # Short span beams get Triangular load
                    # Long span beams get Trapezoidal load
                    
                    # Peak load n = w * lx / 2
                    n_peak = w * short_span / 2
                    
                    load_obj = None
                    if is_two_way:
                        # Determine if this beam supports the short or long span
                        beam_len = math.hypot(beam.end.x - beam.start.x, beam.end.z - beam.start.z)
                        is_long_edge_beam = beam_len >= max(lx, lz) - self.tol
                        
                        if is_long_edge_beam:
                            # Trapezoidal Load
                            # Length of flat top part = L - lx
                            # We construct a LoadMD
                            load_obj = LoadMD(
                                load_type="Trapezoidal",
                                magnitude=n_peak, # Start of trap (actually it starts at 0, ramps to peak)
                                magnitude2=n_peak, # End of trap
                                position=0, # Simplified: applied over full length
                                length=beam_len 
                                # Note: LoadMD Trapezoidal assumes w1->w2. This is a flat trapezoid?
                                # Ideally we need a detailed trapezoid: 0 -> peak -> peak -> 0.
                                # Current LoadMD doesn't support 4 points. 
                                # We can approximate as UDL of equivalent magnitude?
                                # Or split into 3 loads (Triangle + Rect + Triangle). 
                                # For Moment Distribution, we'll implement 'Trapezoidal' as distributed.
                                # Let's use UDL Approximation for robustness in v1: 
                                # Equivalent UDL w_eq = w * lx / 3 * (3 - (1/beta)^2 ) / 2 ... complex formula
                                # Simple approx: 2/3 peak? 
                            )
                            # Better: use equivalent UDL for analysis speed if exact shape not supported
                            # UDL_eq = n_peak * (1 - 1/(3*(ratio**2))) # For trapezoid
                            udl_val = n_peak * (1 - 1/(3 * (ratio**2)))
                            load_obj = LoadMD(load_type="UDL", magnitude=udl_val)
                            
                        else:
                            # Triangular Load
                            # Equivalent UDL for triangle = 2/3 * peak
                            udl_val = n_peak * (2/3)
                            load_obj = LoadMD(load_type="UDL", magnitude=udl_val)
                    else:
                        # One Way slab
                        # Long edge beams take half load. Short edge beams take nothing.
                         if on_x_edge and lx > lz: # X is long? No... ratio check.
                             # If lx > lz, spans are Z. Beams runs along X (long edge)? No. 
                             # Span is SHORT dimension. Load goes to beams perpendicular to span.
                             # If lx is Long, lz is Short. Span is lz. Beams running along X (at z_min/max) take load.
                             # Load = w * lz / 2 (UDL)
                             udl_val = w * lz / 2
                             load_obj = LoadMD(load_type="UDL", magnitude=udl_val)
                         elif on_z_edge and lz > lx:
                             udl_val = w * lx / 2
                             load_obj = LoadMD(load_type="UDL", magnitude=udl_val)
                    
                    if load_obj:
                         self.beam_loads[beam.id].append(load_obj)

    def _identify_frames(self):
        """Group elements into coplanar frames"""
        # Group by 'Z' coordinate (X-Y planes) and 'X' coordinate (Z-Y planes)
        # We bucket relevant coordinates
        
        frames_x = defaultdict(list) # Key: Z-coord
        frames_z = defaultdict(list) # Key: X-coord
        
        # Iterate Columns
        for col in self.columns:
            # Columns belong to BOTH X and Z frames at their location
            # Bucket by integer coordinate to handle float drift
            z_key = round(col.start.z)
            x_key = round(col.start.x) # Assuming vertical column
            frames_x[z_key].append(col)
            frames_z[x_key].append(col)
            
        # Iterate Beams
        for beam in self.beams:
            start, end = beam.start, beam.end
            if not start or not end: continue
            
            # If dZ is small, it's an X-beam (in an X-Frame)
            if abs(start.z - end.z) < self.tol:
                z_key = round(start.z)
                frames_x[z_key].append(beam)
            # If dX is small, it's a Z-beam (in a Z-Frame)
            elif abs(start.x - end.x) < self.tol:
                x_key = round(start.x)
                frames_z[x_key].append(beam)
                
        return frames_x, frames_z

    def _solve_2d_frame(self, elements: List[BuildingElement], plane: str):
        """Construct FrameMD and solve"""
        if not elements: return

        # 1. Build Joints
        joints = {} # id -> JointMD
        joints_map = {} # (x,y) -> id
        
        members = []
        
        for el in elements:
            # Determine 2D coords (u, v)
            if plane == "XZ":
                # Frame is in X-Y plane (at constant Z)
                u1, v1 = el.start.x, el.start.y
                u2, v2 = (el.end.x, el.end.y) if el.end else (u1, v1 + (el.properties.depth or 3)) # Col up
            else: # YZ
                # Frame is in Z-Y plane (at constant X)
                u1, v1 = el.start.z, el.start.y
                u2, v2 = (el.end.z, el.end.y) if el.end else (u1, v1 + 3)

            # Create/Find Joints
            # Function to get/create joint id
            def get_joint(u, v, is_base=False):
                k = (round(u,2), round(v,2))
                if k not in joints_map:
                    jid = f"J{len(joints)+1}_{plane}"
                    j_type = JointType.FIXED_JOINT if is_base else JointType.FIXED_JOINT 
                    # Base conditions: if v approx 0, fixed
                    is_supp = (v < 0.1)
                    joints_map[k] = jid
                    joints[jid] = JointMD(
                        joint_id=jid, 
                        joint_type=j_type, 
                        x_coordinate=u, 
                        y_coordinate=v, 
                        is_support=is_supp
                    )
                return joints_map[k]

            j1 = get_joint(u1, v1, is_base=(v1 < 0.1))
            j2 = get_joint(u2, v2)
            
            # Create Member
            m_type = MemberType.COLUMN if el.type == "column" else MemberType.BEAM
            
            # Get Loads
            loads = self.beam_loads.get(el.id, [])
            
            # Properties
            # I = bh^3/12
            b = el.properties.width
            h = el.properties.depth
            I_val = (b * h**3) / 12
            
            length = math.hypot(u2-u1, v2-v1)
            if length < 0.01: continue
            
            members.append(MemberMD(
                member_id=el.id,
                member_type=m_type,
                start_joint_id=j1,
                end_joint_id=j2,
                length=length,
                E=30e9, # Concrete 30GPa
                I=I_val,
                loads=loads
            ))

        # 2. Setup FrameMD
        frame_md = FrameMD(
            joints=list(joints.values()),
            members=members
        )
        
        # 3. Solve (using Moment Distribution or Stiffness)
        if self.method == "moment_distribution":
            solver = MomentDistributionSolver(frame_md)
            response = solver.solve()
            
            # Extract Results
            member_lengths = {m.member_id: m.length for m in members}
            for mid, forces in response.final_moments.items():
                  s_data = response.shear_force_data.get(mid, [])
                  m_data = response.moment_data.get(mid, [])
                  d_data = response.deflection_data.get(mid, [])
                  
                  if mid not in self.results:
                      self.results[mid] = {
                          "M_max": max(abs(forces['start']), abs(forces['end'])),
                          "V_max": 0, "N_max": 0, "sections": []
                      }
                  
                  length = member_lengths.get(mid, 1.0)
                  # Zip them together if they have same length/spacing
                  self.results[mid]["sections"] = []
                  for i in range(len(m_data)):
                      p_m = m_data[i]
                      p_s = s_data[i] if i < len(s_data) else {'y': 0}
                      p_d = d_data[i] if i < len(d_data) else {'y': 0}
                      
                      self.results[mid]["sections"].append({
                          "ratio": p_m['x']/length, 
                          "Mz": p_m['y'], 
                          "Vy": p_s['y'], 
                          "delta": p_d['y'],
                          "N": 0 
                      })
        else:
            # Stiffness Matrix (FEM)
            fem = FEM2DSolver()
            # Map joints and members to FEM solver
            # FEM solver uses 1-based internal indexing for nodes if we use its helpers
            jid_to_idx = {jid: i+1 for i, jid in enumerate(joints.keys())}
            for jid, j in joints.items():
                fem.add_node(jid_to_idx[jid], j.x_coordinate, j.y_coordinate, [j.is_support, j.is_support, j.is_support])
            
            for m in members:
                # Calculate properties A, I
                # Properties are passed in member.I, but we need area too.
                # Heuristic: 0.3x0.3 area = 0.09
                fem.add_element(m.member_id, jid_to_idx[m.start_joint_id], jid_to_idx[m.end_joint_id], m.E, 0.09, m.I)
                for load in m.loads:
                    if load.load_type == "UDL":
                        fem.add_udl(m.member_id, load.magnitude)
            
            fem_res = fem.solve()
            if fem_res:
                for mid, forces in fem_res["elements"].items():
                    # forces: {N_i, V_i, M_i, N_j, V_j, M_j}
                    M_i, M_j = forces["M_i"], forces["M_j"]
                    V_i, V_j = forces["V_i"], forces["V_j"]
                    N_i, N_j = forces["N_i"], forces["N_j"]
                    
                    if mid not in self.results:
                        self.results[mid] = {"M_max": 0, "V_max": 0, "N_max": 0, "sections": []}
                    
                    self.results[mid]["M_max"] = max(abs(M_i), abs(M_j))
                    self.results[mid]["V_max"] = max(abs(V_i), abs(V_j))
                    self.results[mid]["N_max"] = max(abs(N_i), abs(N_j))
                    
                    # Generate parabolic/linear sections
                    num_sec = 21 # Increased resolution for smooth curves
                    self.results[mid]["sections"] = []
                    
                    # Get UDL magnitude for this member if any
                    udl = 0
                    for load in m.loads:
                        if load.load_type == "UDL":
                            udl = load.magnitude
                    
                    L = m.length
                    for k in range(num_sec):
                        x_ratio = k / (num_sec - 1)
                        x = x_ratio * L
                        
                        # Basic beam formulas:
                        # M(x) = M_i * (1 - x/L) + M_j * (x/L) + (w*x/2)*(L - x)
                        # V(x) = V_i + (V_j - V_i) * (x/L)  -- if w is constant, V is linear
                        
                        # Note: FEM gives nodal forces. M_i and M_j might need sign convention alignment.
                        # Standard convention: M_i is clockwise, M_j is counter-clockwise.
                        # Structural BMD usually plots "tension side".
                        
                        m_val = M_i * (1 - x_ratio) + M_j * x_ratio
                        if udl != 0:
                            m_val += (udl * x / 2) * (L - x)
                        
                        # Shear for UDL: V(x) = V_i + (V_j - V_i) * (x/L)
                        # Correct: V(x) = V_i - udl * x (assuming V_i is reaction at start)
                        # The solver's V_i and V_j are nodal forces (equilibrium).
                        # Let's use simple linear for now as nodal values already account for loads.
                        v_val = V_i * (1 - x_ratio) + V_j * x_ratio
                        
                        self.results[mid]["sections"].append({
                            "ratio": x_ratio, 
                            "Mz": m_val, 
                            "Vy": v_val, 
                            "N": N_i
                        })

    def _format_results(self):
        # Convert internal results dict to list of AnalysisResult
        output = []
        for eid, res in self.results.items():
            output.append(AnalysisResult(
                element_id=eid,
                M_max=res.get("M_max", 0),
                V_max=res.get("V_max", 0),
                N_max=res.get("N_max", 0),
                sections=res.get("sections", []),
                status="OK"
            ))
        return output


@router.post("/analyze-full", response_model=List[AnalysisResult])
async def analyze_full_building(request: BuildingAnalysisRequest):
    """Analyze full 3D building using 2D Frame decomposition"""
    analyzer = FullBuildingAnalyzer(request)
    return analyzer.analyze()
