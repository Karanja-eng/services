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
    height: float = 3.5
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
        self.walls = [e for e in self.elements if e.type == 'wall']
        self.foundations = [e for e in self.elements if e.type == 'foundation']
        
        # Determine tolerance for connectivity
        self.tol = 0.1 

        self.beam_loads = defaultdict(list) # map beam_id -> List[LoadMD]
        self.results = {}

    def analyze(self):
        print("Starting analysis...")
        # 1. Distribute Slab Loads to Beams
        self._distribute_slab_loads()
        print("Slab loads distributed.")
        
        # 2. Identify Frames (Grid Lines)
        # We group elements into X-Frames (constant Y) and Y-Frames (constant X)
        x_frames, y_frames = self._identify_frames()
        print(f"Identified {len(x_frames)} X-frames and {len(y_frames)} Y-frames.")
        
        # 3. Solve Frames
        for frame_id, frame_elements in x_frames.items():
            print(f"Solving X-frame {frame_id} with {len(frame_elements)} elements...")
            self._solve_2d_frame(frame_elements, plane="XZ")
            print(f"Solved X-frame {frame_id}.")
            
        for frame_id, frame_elements in y_frames.items():
            print(f"Solving Y-frame {frame_id} with {len(frame_elements)} elements...")
            self._solve_2d_frame(frame_elements, plane="YZ")
            print(f"Solved Y-frame {frame_id}.")
            
        # 4. Post-Process (Axial Accumulation & Classification)
        self._post_process_all_elements()
        print("Post-processing complete.")

        return self._format_results()

    def _post_process_all_elements(self):
        """Accumulate axial loads down the structure (Load Takedown)"""
        # 1. Sort columns by Z descending (Top to Bottom)
        sorted_cols = sorted(self.columns, key=lambda c: c.start.z, reverse=True)
        
        # Buffer to store accumulated N leaving the bottom of a column at (x,y)
        # Key: (x, y) -> Value: Load passed to element below
        load_transfer_map = defaultdict(float)
        
        # Helper: Get reaction from beams connected to a specific point (x,y,z)
        def get_beam_reactions_at(x, y, z):
            reaction = 0.0
            for vid, res in self.results.items():
                # Only check beams
                if not any(b.id == vid for b in self.beams): continue
                
                beam_el = next((b for b in self.beams if b.id == vid), None)
                if not beam_el: continue
                
                # Check if this beam connects to (x,y,z)
                # Beams are in X-Z or Y-Z planes, so Z must match
                if abs(beam_el.start.z - z) > self.tol: continue
                
                # Check start connection
                if math.hypot(beam_el.start.x - x, beam_el.start.y - y) < self.tol:
                     # Reaction is V at start
                     # In Frame analysis, V_i is shear at start.
                     # We take max V usually, but strictly it's the specific end shear.
                     # Simplified: Use V_max / 2 or exact if available. 
                     # For MD, we stored V_max but let's try to get more specific if possible.
                     # fallback: Use V_max from results
                     reaction += res.get("V_max", 0) 
                     
                # Check end connection
                elif math.hypot(beam_el.end.x - x, beam_el.end.y - y) < self.tol:
                     # Reaction is V at end
                     reaction += res.get("V_max", 0)
            return reaction

        for col in sorted_cols:
            if col.id not in self.results: 
                 self.results[col.id] = {"M_max": 0, "V_max": 0, "N_max": 0, "sections": []}
            
            res = self.results[col.id]
            
            # Column Position (Plan)
            cx, cy = round(col.start.x, 2), round(col.start.y, 2)
            
            # Column Top/Bottom Z
            z_top = col.end.z if col.end else col.start.z + col.properties.height
            z_bot = col.start.z
            
            # 1. Load from Column Above
            # The column above would have registered its output at (cx, cy)
            # However, we must ensure we pick up the load from the column whose BOTTOM is near this column's TOP
            # Since we iterate sorted by Z descending, the upper column is already processed.
            # But we need to use z_top as the key to find what's coming down?
            # Actually simplest is: map[(x,y)] stores the load travelling down this continuous column line.
            
            axial_from_above = load_transfer_map[(cx, cy)]
            
            # 2. Load from Beams at Top of this Column
            beam_reaction = get_beam_reactions_at(col.start.x, col.start.y, z_top)
            
            # 3. Self Weight of this Column
            # 24 kN/m3 * b * d * h
            w, d, h = col.properties.width, col.properties.depth, col.properties.height
            self_weight = 24.0 * w * d * h
            
            # Total Axial Load for this column
            total_N = axial_from_above + beam_reaction + self_weight
            
            # Update Result
            res["N_max"] = total_N
            
            # Update Sections
            for s in res["sections"]:
                s["N"] = total_N
                
            # Pass load to next level
            load_transfer_map[(cx, cy)] = total_N

    def _distribute_slab_loads(self):
        """BS 8110 Yield Line / Tributary Area Load Distribution"""
        for slab in self.slabs:
            # Handle geometry: Templates often use position + width/depth
            if slab.start and slab.end:
                sx_min, sx_max = min(slab.start.x, slab.end.x), max(slab.start.x, slab.end.x)
                sy_min, sy_max = min(slab.start.y, slab.end.y), max(slab.start.y, slab.end.y)
                slab_z = slab.start.z
            elif slab.position:
                # Use width/depth if start/end missing (common in templates)
                w, d = slab.properties.width, slab.properties.depth
                sx_min, sx_max = slab.position.x, slab.position.x + w
                sy_min, sy_max = slab.position.y, slab.position.y + d
                slab_z = slab.position.z
            else:
                continue

            lx = sx_max - sx_min
            ly = sy_max - sy_min 
            if lx < 0.1 or ly < 0.1: continue
            
            # Identify Aspect Ratio
            L_long = max(lx, ly)
            L_short = min(lx, ly)
            ratio = L_long / L_short
            is_two_way = ratio <= 2.0
            
            # Load intensity (kN/m2)
            w_total = slab.properties.load_combined or self.default_slab_load
            
            # Find supporting beams
            for beam in self.beams:
                if not beam.start or not beam.end: continue
                
                # Must be at SAME floor (Z level)
                if abs(beam.start.z - slab_z) > self.tol:
                    continue
                
                # Check beam alignment with edges in PLAN (X-Y)
                bx_min, bx_max = min(beam.start.x, beam.end.x), max(beam.start.x, beam.end.x)
                by_min, by_max = min(beam.start.y, beam.end.y), max(beam.start.y, beam.end.y)
                
                # Check if beam is on perimeter
                on_x_edge = (abs(by_min - sy_min) < self.tol or abs(by_min - sy_max) < self.tol) and (bx_max > sx_min - self.tol and bx_min < sx_max + self.tol)
                on_y_edge = (abs(bx_min - sx_min) < self.tol or abs(bx_min - sx_max) < self.tol) and (by_max > sy_min - self.tol and by_min < sy_max + self.tol)
                
                if on_x_edge or on_y_edge:
                    # BS 8110 Cl 3.5.3.4 Load Distribution
                    # n_peak = w * L_short / 2
                    n_peak = w_total * L_short / 2
                    beam_len = math.hypot(beam.end.x - beam.start.x, beam.end.y - beam.start.y)
                    
                    if is_two_way:
                        # Long Edge gets Trapezoidal, Short Edge gets Triangular
                        is_long_edge = beam_len >= L_long - self.tol
                        if is_long_edge:
                            # Trapezoidal equiv UDL: n * (1 - 1/(3*k^2)) where k = L_long/L_short
                            udl = n_peak * (1 - 1/(3 * (ratio**2)))
                        else:
                            # Triangular equiv UDL: n * 2/3
                            udl = n_peak * (2/3)
                    else:
                        # One-way: Load shared by the two beams spanning the long direction
                        # Only beams perpendicular to the short span get load
                        is_supporting = (on_x_edge and lx >= ly) or (on_y_edge and ly >= lx)
                        udl = (w_total * L_short / 2) if is_supporting else 0
                    
                    if udl > 0:
                        self.beam_loads[beam.id].append(LoadMD(load_type="UDL", magnitude=udl))

        # Add Beam Self-Weight
        for beam in self.beams:
            b = beam.properties.width or 0.3
            h = beam.properties.depth or 0.3
            # Self-weight density 24 kN/m3 for RC
            sw = b * h * 24.0
            self.beam_loads[beam.id].append(LoadMD(load_type="UDL", magnitude=sw))

    def _identify_frames(self):
        """Group elements into vertical coplanar frames"""
        # Group by 'Y' coordinate (X-Z planes) and 'X' coordinate (Y-Z planes)
        
        frames_x = defaultdict(list) # Constant Y (X-Z planes)
        frames_y = defaultdict(list) # Constant X (Y-Z planes)
        
        # Iterate Columns
        for col in self.columns:
            # Columns belong to BOTH X and Y frames at their location
            y_key = round(col.start.y, 2)
            x_key = round(col.start.x, 2)
            frames_x[y_key].append(col)
            frames_y[x_key].append(col)
            
        # Iterate Beams
        for beam in self.beams:
            start, end = beam.start, beam.end
            if not start or not end: continue
            
            # If dY is small, it's an X-beam (in an X-Frame)
            if abs(start.y - end.y) < self.tol:
                y_key = round(start.y, 2)
                frames_x[y_key].append(beam)
            # If dX is small, it's a Y-beam (in a Y-Frame)
            elif abs(start.x - end.x) < self.tol:
                x_key = round(start.x, 2)
                frames_y[x_key].append(beam)
                
        return frames_x, frames_y

    def _solve_2d_frame(self, elements: List[BuildingElement], plane: str):
        """Construct FrameMD and solve"""
        if not elements: return

        # 1. Build Joints
        joints = {} # id -> JointMD
        joints_map = {} # (u,v) -> id
        
        members = []
        
        for el in elements:
            # Determine 2D coords (u, v)
            # v is ALWAYS elevation (Z in builder)
            if plane == "XZ":
                # Frame is in X-Z plane (at constant Y)
                u1, v1 = el.start.x, el.start.z
                u2, v2 = (el.end.x, el.end.z) if el.end else (u1, v1 + 3.5)
            else: # YZ
                # Frame is in Y-Z plane (at constant X)
                u1, v1 = el.start.y, el.start.z
                u2, v2 = (el.end.y, el.end.z) if el.end else (u1, v1 + 3.5)

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
                  local_max_m = self.results[mid]["M_max"]
                  
                  for i in range(len(m_data)):
                      p_m = m_data[i]
                      p_s = s_data[i] if i < len(s_data) else {'y': 0}
                      p_d = d_data[i] if i < len(d_data) else {'y': 0}
                      
                      if abs(p_m['y']) > local_max_m: local_max_m = abs(p_m['y'])
                      
                      self.results[mid]["sections"].append({
                          "ratio": p_m['x']/length, 
                          "Mz": p_m['y'], 
                          "Vy": p_s['y'], 
                          "delta": p_d['y'],
                          "N": 0 
                      })
                  self.results[mid]["M_max"] = local_max_m
        else:
            # Stiffness Matrix (FEM)
            fem = FEM2DSolver()
            jid_to_idx = {jid: i+1 for i, jid in enumerate(joints.keys())}
            for jid, j in joints.items():
                fem.add_node(jid_to_idx[jid], j.x_coordinate, j.y_coordinate, [j.is_support, j.is_support, j.is_support])
            
            for m in members:
                fem.add_element(m.member_id, jid_to_idx[m.start_joint_id], jid_to_idx[m.end_joint_id], m.E, 0.09, m.I)
                for load in m.loads:
                    if load.load_type == "UDL":
                        fem.add_udl(m.member_id, load.magnitude)
            
            print(f"Calling FEM solve for {len(members)} members...")
            fem_res = fem.solve()
            print("FEM solve returned.")
            member_dict = {m.member_id: m for m in members}
            for mid, forces in fem_res["elements"].items():
                if mid not in member_dict: continue
                m = member_dict[mid]
                
                M_i, M_j = forces["M_i"], forces["M_j"]
                V_i, V_j = forces["V_i"], forces["V_j"]
                N_i, N_j = forces["N_i"], forces["N_j"]
                
                if mid not in self.results:
                    self.results[mid] = {"M_max": 0, "V_max": 0, "N_max": 0, "sections": []}
                    
                    # Merge results for columns (Axial N accumulates, Moments M might be in different planes)
                    # For M_max, we keep the largest one or ideally would use vector sum for biaxial (simplified here)
                    self.results[mid]["M_max"] = max(self.results[mid]["M_max"], abs(M_i), abs(M_j))
                    self.results[mid]["V_max"] = max(self.results[mid]["V_max"], abs(V_i), abs(V_j))
                    self.results[mid]["N_max"] += abs(N_i) # Accumulate axial
                    
                    # Sections logic - only if first time or larger moments
                    if not self.results[mid]["sections"] or abs(M_i) > 0.1:
                        num_sec = 21 
                        self.results[mid]["sections"] = []
                        udl = sum([l.magnitude for l in m.loads if l.load_type == "UDL"])
                        L = m.length
                        for k in range(num_sec):
                            x_ratio = k / (num_sec - 1)
                            x = x_ratio * L
                            m_val = M_i * (1 - x_ratio) + M_j * x_ratio
                            if udl != 0: m_val += (udl * x / 2) * (L - x)
                            v_val = V_i + (V_j - V_i) * x_ratio
                            
                            self.results[mid]["sections"].append({
                                "ratio": x_ratio, 
                                "Mz": m_val, 
                                "Vy": v_val, 
                                "N": N_i
                            })
        
        # Post-process: Classify Columns and Accumulate Base Loads
        # (This would be another pass, handled after solve loop)

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
    print(f"Received analysis request with {len(request.elements)} elements")
    analyzer = FullBuildingAnalyzer(request)
    results = analyzer.analyze()
    print(f"Analysis completed. Returning {len(results)} results")
    return results
