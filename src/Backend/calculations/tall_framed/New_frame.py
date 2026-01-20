"""
Detailed Member Analysis Module
Calculates internal forces, moments, shear, torsion, deflection at multiple sections
Generates data for 3D visualization and 2D cross-section views
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Tuple
from scipy.interpolate import interp1d


@dataclass
class SectionForces:
    """Forces and moments at a section"""
    x: float  # Position along member (m)
    x_ratio: float  # Position ratio (0 to 1)
    
    # Forces (kN)
    N: float  # Axial force (tension positive)
    Vy: float  # Shear force in local y
    Vz: float  # Shear force in local z
    
    # Moments (kNm)
    T: float  # Torsion
    My: float  # Bending moment about local y
    Mz: float  # Bending moment about local z
    
    # Deflections (mm)
    delta_x: float = 0.0  # Axial deformation
    delta_y: float = 0.0  # Deflection in local y
    delta_z: float = 0.0  # Deflection in local z
    
    # Rotations (radians)
    theta_x: float = 0.0  # Twist
    theta_y: float = 0.0  # Rotation about y
    theta_z: float = 0.0  # Rotation about z


class DetailedMemberAnalysis:
    """
    Detailed analysis of member internal forces
    Calculates values at multiple sections for visualization
    """
    
    def __init__(self, member, nodes: Dict, n_sections: int = 21):
        """
        member: Member object
        nodes: Dict of Node objects
        n_sections: Number of sections to analyze
        """
        self.member = member
        self.nodes = nodes
        self.n_sections = n_sections
        self.L = member.length(nodes)
        
        # Section positions
        self.x_positions = np.linspace(0, self.L, n_sections)
        self.x_ratios = self.x_positions / self.L
        
    def calculate_internal_forces(
        self, 
        end_forces: np.ndarray, 
        loads: List, 
        load_factors: Dict
    ) -> List[SectionForces]:
        """
        Calculate internal forces at multiple sections
        
        end_forces: 12-element array of member end forces in local coords
                   [Fx1, Fy1, Fz1, Mx1, My1, Mz1, Fx2, Fy2, Fz2, Mx2, My2, Mz2]
        loads: List of loads on this member
        load_factors: Dict of load category -> factor
        
        Returns: List of SectionForces
        """
        sections = []
        
        # Extract end forces
        N1 = -end_forces[0]  # Axial at start (reversed for internal force)
        Vy1 = -end_forces[1]  # Shear y at start
        Vz1 = -end_forces[2]  # Shear z at start
        T1 = -end_forces[3]  # Torsion at start
        My1 = -end_forces[4]  # Moment y at start
        Mz1 = -end_forces[5]  # Moment z at start
        
        # Calculate at each section
        for i, x in enumerate(self.x_positions):
            x_ratio = self.x_ratios[i]
            
            # Initialize with end forces
            N = N1
            Vy = Vy1
            Vz = Vz1
            T = T1
            My = My1
            Mz = Mz1
            
            # Add effects of loads between start and current section
            for load in loads:
                if load.member_id != self.member.id:
                    continue
                
                factor = load_factors.get(load.category, 0.0)
                if abs(factor) < 1e-10:
                    continue
                
                if load.load_type == LoadType.UDL:
                    # Uniformly distributed load
                    w = factor * load.Fy  # Assuming vertical load
                    
                    # Load from start to current section
                    if x > 0:
                        # Shear reduces linearly
                        Vy -= w * x
                        # Moment increases parabolically
                        Mz -= Vy1 * x - w * x**2 / 2
                
                elif load.load_type == LoadType.POINT:
                    # Point load
                    a = load.start_position * self.L
                    if x > a:  # Load is before current section
                        P = factor * load.Fy
                        Vy -= P
                        Mz -= P * (x - a)
                
                elif load.load_type == LoadType.VARYING:
                    # Linearly varying load
                    w1 = factor * load.start_value
                    w2 = factor * load.end_value
                    
                    if x > 0:
                        # Load intensity at x: w(x) = w1 + (w2-w1)*x/L
                        # Integral from 0 to x: W = w1*x + (w2-w1)*x²/(2L)
                        W = w1 * x + (w2 - w1) * x**2 / (2 * self.L)
                        Vy -= W
                        
                        # Moment integral
                        # ∫w(ξ)*(x-ξ)dξ from 0 to x
                        M_load = (w1 * x**2 / 2 + 
                                 (w2 - w1) * x**3 / (6 * self.L))
                        Mz -= M_load
            
            # Create section forces object
            section = SectionForces(
                x=x,
                x_ratio=x_ratio,
                N=N,
                Vy=Vy,
                Vz=Vz,
                T=T,
                My=My,
                Mz=Mz
            )
            sections.append(section)
        
        return sections
    
    def calculate_deflections(
        self, 
        sections: List[SectionForces],
        end_displacements: np.ndarray
    ):
        """
        Calculate deflections at each section using conjugate beam method
        
        end_displacements: 12-element array in local coords
        """
        # Extract end deflections and rotations
        dy1 = end_displacements[1]
        dz1 = end_displacements[2]
        theta_y1 = end_displacements[4]
        theta_z1 = end_displacements[5]
        
        dy2 = end_displacements[7]
        dz2 = end_displacements[8]
        theta_y2 = end_displacements[10]
        theta_z2 = end_displacements[11]
        
        E = self.member.material.E
        Iy = self.member.section.Iy
        Iz = self.member.section.Iz
        EIy = E * Iy / 1e6  # Convert to kNm²
        EIz = E * Iz / 1e6
        
        # Interpolate deflections using cubic hermite splines
        # For local y direction (Mz causes deflection in y)
        for i, section in enumerate(sections):
            x = section.x
            x_ratio = section.x_ratio
            
            # Cubic hermite interpolation
            h00 = 2*x_ratio**3 - 3*x_ratio**2 + 1
            h10 = x_ratio**3 - 2*x_ratio**2 + x_ratio
            h01 = -2*x_ratio**3 + 3*x_ratio**2
            h11 = x_ratio**3 - x_ratio**2
            
            # Deflection in y (from Mz)
            section.delta_y = (h00 * dy1 + 
                              h10 * theta_z1 * self.L +
                              h01 * dy2 + 
                              h11 * theta_z2 * self.L)
            
            # Deflection in z (from My)
            section.delta_z = (h00 * dz1 + 
                              h10 * theta_y1 * self.L +
                              h01 * dz2 + 
                              h11 * theta_y2 * self.L)
            
            # Convert to mm
            section.delta_y *= 1000
            section.delta_z *= 1000
    
    def get_envelope_forces(
        self, 
        all_combo_sections: Dict[str, List[SectionForces]]
    ) -> Tuple[List[float], List[float], List[float], List[float]]:
        """
        Calculate envelope (max/min) forces from all load combinations
        
        Returns: (max_Mz, min_Mz, max_Vy, min_Vy) at each section
        """
        n_sections = len(next(iter(all_combo_sections.values())))
        
        max_Mz = [-1e10] * n_sections
        min_Mz = [1e10] * n_sections
        max_Vy = [-1e10] * n_sections
        min_Vy = [1e10] * n_sections
        
        for combo_name, sections in all_combo_sections.items():
            for i, section in enumerate(sections):
                max_Mz[i] = max(max_Mz[i], section.Mz)
                min_Mz[i] = min(min_Mz[i], section.Mz)
                max_Vy[i] = max(max_Vy[i], section.Vy)
                min_Vy[i] = min(min_Vy[i], section.Vy)
        
        return max_Mz, min_Mz, max_Vy, min_Vy


# ============================================================================
# MOMENT REDISTRIBUTION OPTIMIZER
# ============================================================================

class MomentRedistributionOptimizer:
    """
    Automatically suggests optimal moment redistribution per BS 8110
    Balances support and span moments while respecting limits
    """
    
    def __init__(self, max_redistribution: float = 0.30):
        """
        max_redistribution: Maximum allowed redistribution (0.30 = 30%)
        """
        self.max_redistribution = max_redistribution
    
    def suggest_redistribution(
        self, 
        elastic_moments: Dict[str, float],
        member_type: str = 'beam'
    ) -> Dict[str, Tuple[float, float]]:
        """
        Suggest optimal redistribution for a member
        
        elastic_moments: Dict like {'support_A': -150, 'span': 100, 'support_B': -150}
        member_type: 'beam' or 'column'
        
        Returns: Dict like {'support_A': (redistributed_moment, beta_b), ...}
        """
        suggestions = {}
        
        # Find maximum support moment
        support_moments = {k: v for k, v in elastic_moments.items() 
                          if 'support' in k.lower()}
        
        if not support_moments:
            return suggestions
        
        max_support_key = max(support_moments, key=lambda k: abs(support_moments[k]))
        max_support_moment = abs(support_moments[max_support_key])
        
        # Strategy: Reduce maximum support moment to balance with span moments
        span_moments = {k: v for k, v in elastic_moments.items() 
                       if 'span' in k.lower() or 'mid' in k.lower()}
        
        if span_moments:
            max_span_moment = max(abs(v) for v in span_moments.values())
            
            # Target: Make support moment ≈ span moment * 1.2
            target_support = max_span_moment * 1.2
            
            # Calculate required redistribution
            if max_support_moment > target_support:
                beta_b = target_support / max_support_moment
                
                # Check limits
                if beta_b < (1 - self.max_redistribution):
                    beta_b = 1 - self.max_redistribution
                
                # Apply to all major support moments
                for key, moment in support_moments.items():
                    if abs(moment) > 0.8 * max_support_moment:
                        redistributed = moment * beta_b if moment < 0 else moment
                        suggestions[key] = (redistributed, beta_b)
                    else:
                        suggestions[key] = (moment, 1.0)
            else:
                # No redistribution needed
                for key, moment in support_moments.items():
                    suggestions[key] = (moment, 1.0)
        
        return suggestions
    
    def calculate_neutral_axis_limit(self, beta_b: float) -> float:
        """
        Calculate maximum neutral axis depth ratio per BS 8110
        x/d ≤ (βb - 0.4)
        """
        return max(beta_b - 0.4, 0)
    
    def calculate_k_limit(self, beta_b: float) -> float:
        """
        Calculate maximum k value for singly reinforced section
        k = 0.402(βb - 0.4) - 0.18(βb - 0.4)²
        """
        x_d = beta_b - 0.4
        return 0.402 * x_d - 0.18 * x_d**2


# ============================================================================
# BS 6399 LOAD CALCULATOR
# ============================================================================

class BS6399LoadCalculator:
    """
    Calculate imposed loads per BS 6399-1:1996
    Different occupancy categories
    """
    
    # Table 1: Imposed floor loads (kN/m²)
    IMPOSED_LOADS = {
        'residential': {
            'domestic': 1.5,
            'hotel_bedroom': 2.0,
            'hotel_dining': 2.0,
        },
        'office': {
            'general': 2.5,
            'filing_storage': 5.0,
            'computer_room': 3.5,
        },
        'assembly': {
            'fixed_seating': 4.0,
            'moveable_seating': 5.0,
            'dance_hall': 5.0,
            'gymnasium': 5.0,
        },
        'retail': {
            'general': 4.0,
            'storage': 7.5,
        },
        'industrial': {
            'light': 5.0,
            'general': 7.5,
            'heavy': 10.0,
        },
        'education': {
            'classroom': 3.0,
            'laboratory': 3.0,
            'library_reading': 2.5,
            'library_stacks': 4.0,
        },
        'healthcare': {
            'ward': 2.0,
            'operating_theatre': 3.0,
            'corridor': 3.0,
        }
    }
    
    # Table 2: Partition load allowances
    PARTITION_LOADS = {
        'moveable_lightweight': 1.0,  # kN/m²
        'moveable_standard': 1.5,
        'fixed': 'calculated_separately'
    }
    
    @classmethod
    def get_imposed_load(cls, category: str, subcategory: str) -> float:
        """Get imposed load for given occupancy"""
        try:
            return cls.IMPOSED_LOADS[category][subcategory]
        except KeyError:
            raise ValueError(f"Unknown occupancy: {category}/{subcategory}")
    
    @classmethod
    def get_reduced_imposed_load(
        cls, 
        category: str, 
        subcategory: str, 
        n_floors: int
    ) -> float:
        """
        Calculate reduced imposed load for columns/walls carrying multiple floors
        Per BS 6399-1 Table 2
        """
        qk = cls.get_imposed_load(category, subcategory)
        
        # Reduction factors
        if n_floors <= 1:
            factor = 1.0
        elif n_floors == 2:
            factor = 0.9
        elif n_floors == 3:
            factor = 0.8
        elif n_floors == 4:
            factor = 0.7
        elif n_floors <= 10:
            factor = 0.6
        else:
            factor = 0.5
        
        return qk * factor
    
    @classmethod
    def calculate_total_floor_load(
        cls,
        area: float,
        dead_load: float,
        category: str,
        subcategory: str,
        partitions: str = 'moveable_standard'
    ) -> Dict[str, float]:
        """
        Calculate total floor loading
        
        Returns dict with:
        - dead_load_total
        - imposed_load_total
        - partition_load
        - total_characteristic
        """
        qk = cls.get_imposed_load(category, subcategory)
        partition_load = cls.PARTITION_LOADS.get(partitions, 1.0)
        
        if isinstance(partition_load, str):
            partition_load = 0  # User must calculate separately
        
        return {
            'dead_load_per_m2': dead_load,
            'imposed_load_per_m2': qk,
            'partition_load_per_m2': partition_load,
            'dead_load_total': dead_load * area,
            'imposed_load_total': qk * area,
            'partition_load_total': partition_load * area,
            'total_characteristic': (dead_load + qk + partition_load) * area
        }


from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .frame_analysis_core import (
    Frame3DAnalyzer, Node as CoreNode, Member as CoreMember, 
    Material as CoreMaterial, Section as CoreSection,
    Load as CoreLoad, LoadType as CoreLoadType, 
    LoadCategory as CoreLoadCategory, LoadCombination as CoreLoadCombination
)

router = APIRouter(
    tags=["New Frame Analysis"]
)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class FrameAnalysisRequest(BaseModel):
    floors: int = Field(..., description="Number of floors")
    bays: int = Field(..., description="Number of bays")
    story_height: float = Field(..., description="Story height in meters")
    bay_width: float = Field(..., description="Bay width in meters")
    lateral_load: float = Field(0, description="Lateral load in kN")
    vertical_load: float = Field(0, description="Vertical load in kN/m")
    concrete_grade: str = Field("C30", description="Concrete grade")
    steel_grade: int = Field(500, description="Steel grade")

class VisualizationRequest(BaseModel):
    analyzer_data: Dict = Field(..., description="Serialized analyzer data or params")
    combination: str = Field("1.4D + 1.6L", description="Combination name")
    scale: float = Field(100.0, description="Deformation scale")

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/api/analyze", response_model=Dict)
async def analyze_frame_v2(request: FrameAnalysisRequest):
    """
    Perform 3D Frame analysis and return visualization data
    """
    analyzer = Frame3DAnalyzer()
    
    # Create material
    concrete = CoreMaterial.concrete_C30()
    concrete.fcu = float(request.concrete_grade.replace('C', ''))
    concrete.fy = float(request.steel_grade)
    
    # Create section
    section = CoreSection.rectangular("Beam/Column", 400, 600)
    
    # Create nodes and members (same as tall_framed_backend but with Core classes)
    node_id = 1
    node_map = {}
    for row in range(request.floors + 1):
        for col in range(request.bays + 1):
            n = CoreNode(
                id=node_id,
                x=col * request.bay_width,
                y=row * request.story_height,
                z=0,
                support={'dy': True, 'dx': True, 'rz': True} if row == 0 else {}
            )
            analyzer.add_node(n)
            node_map[(row, col)] = node_id
            node_id += 1
            
    # Members
    member_id = 1
    for row in range(request.floors):
        for col in range(request.bays + 1):
            m = CoreMember(member_id, node_map[(row, col)], node_map[(row+1, col)], section, concrete)
            analyzer.add_member(m)
            member_id += 1
        for col in range(request.bays):
            m = CoreMember(member_id, node_map[(row+1, col)], node_map[(row+1, col+1)], section, concrete)
            analyzer.add_member(m)
            # Add UDL to beam
            if request.vertical_load > 0:
                analyzer.add_load(CoreLoad(CoreLoadCategory.DEAD, member_id=member_id, Fy=-request.vertical_load))
            member_id += 1
            
    # Lateral Load
    if request.lateral_load > 0:
        for row in range(1, request.floors + 1):
            analyzer.add_load(CoreLoad(CoreLoadCategory.WIND, node_id=node_map[(row, 0)], Fx=request.lateral_load / request.floors))

    # Add combination
    combo = CoreLoadCombination.ULS_dead_imposed()
    analyzer.add_load_combination(combo)
    
    # Analyze
    analyzer.analyze_all_combinations()
    
    # Generate Visualization Data
    vis_gen = VisualizationDataGenerator()
    viz_data = vis_gen.generate_3d_frame_data(analyzer, combo.name)
    
    return viz_data

@router.get("/api/example")
async def get_example_frame():
    """Return example visualization data"""
    # This would call the example_continuous_beam logic and return results
    # For now, return a placeholder or implement the call
    pass

# ============================================================================
# VISUALIZATION DATA GENERATOR
# ============================================================================

class VisualizationDataGenerator:
    """
    Generate JSON data for 3D and 2D visualization
    """
    
    @staticmethod
    def generate_3d_frame_data(
        analyzer,
        combination_name: str,
        deformation_scale: float = 100.0
    ) -> Dict:
        """
        Generate data for 3D frame visualization
        
        Returns dict with:
        - nodes: [{id, x, y, z, displaced_x, displaced_y, displaced_z}, ...]
        - members: [{id, start, end, forces, moments}, ...]
        - loads: [...]
        """
        U = analyzer.displacements[combination_name]
        
        # Generate node data with displacements
        nodes_data = []
        for node in analyzer.nodes.values():
            dof = node.global_dof_indices()
            dx, dy, dz = U[dof[0]], U[dof[1]], U[dof[2]]
            
            nodes_data.append({
                'id': node.id,
                'x': node.x,
                'y': node.y,
                'z': node.z,
                'displaced_x': node.x + dx * deformation_scale,
                'displaced_y': node.y + dy * deformation_scale,
                'displaced_z': node.z + dz * deformation_scale,
                'displacement': {
                    'dx': dx * 1000,  # mm
                    'dy': dy * 1000,
                    'dz': dz * 1000,
                    'rx': U[dof[3]],
                    'ry': U[dof[4]],
                    'rz': U[dof[5]]
                },
                'support': node.support
            })
        
        # Generate member data with internal forces
        members_data = []
        member_forces = analyzer.member_forces[combination_name]
        
        for member in analyzer.members.values():
            forces = member_forces[member.id]
            
            # Calculate detailed section forces
            detail_analyzer = DetailedMemberAnalysis(member, analyzer.nodes)
            sections = detail_analyzer.calculate_internal_forces(
                forces,
                analyzer.loads,
                analyzer.load_combinations[0].factors  # Use appropriate combo
            )
            
            members_data.append({
                'id': member.id,
                'startNode': member.start_node_id,
                'endNode': member.end_node_id,
                'section': {
                    'width': member.section.width,
                    'depth': member.section.depth,
                    'type': member.section.name
                },
                'material': {
                    'fcu': member.material.fcu,
                    'fy': member.material.fy
                },
                'length': member.length(analyzer.nodes),
                'endForces': {
                    'start': {
                        'N': forces[0],
                        'Vy': forces[1],
                        'Vz': forces[2],
                        'T': forces[3],
                        'My': forces[4],
                        'Mz': forces[5]
                    },
                    'end': {
                        'N': forces[6],
                        'Vy': forces[7],
                        'Vz': forces[8],
                        'T': forces[9],
                        'My': forces[10],
                        'Mz': forces[11]
                    }
                },
                'sections': [
                    {
                        'position': s.x,
                        'ratio': s.x_ratio,
                        'N': s.N,
                        'Vy': s.Vy,
                        'Vz': s.Vz,
                        'T': s.T,
                        'My': s.My,
                        'Mz': s.Mz,
                        'delta_y': s.delta_y,
                        'delta_z': s.delta_z
                    }
                    for s in sections
                ]
            })
        
        return {
            'nodes': nodes_data,
            'members': members_data,
            'combination': combination_name,
            'deformationScale': deformation_scale
        }
    
    @staticmethod
    def generate_bm_sf_diagram_data(
        sections: List[SectionForces],
        member_length: float
    ) -> Dict:
        """
        Generate data for 2D BM and SF diagrams (for Recharts)
        """
        return {
            'bendingMoment': [
                {'x': s.x, 'Mz': s.Mz, 'My': s.My}
                for s in sections
            ],
            'shearForce': [
                {'x': s.x, 'Vy': s.Vy, 'Vz': s.Vz}
                for s in sections
            ],
            'axialForce': [
                {'x': s.x, 'N': s.N}
                for s in sections
            ],
            'torsion': [
                {'x': s.x, 'T': s.T}
                for s in sections
            ],
            'deflection': [
                {'x': s.x, 'delta_y': s.delta_y, 'delta_z': s.delta_z}
                for s in sections
            ],
            'length': member_length
        }
    
    @staticmethod
    def generate_cross_section_data(
        member,
        section_position: float,
        forces: SectionForces,
        reinforcement: Dict = None
    ) -> Dict:
        """
        Generate data for 2D cross-section view
        (Placeholder for reinforcement - will be populated by design module)
        """
        return {
            'position': section_position,
            'geometry': {
                'width': member.section.width,
                'depth': member.section.depth,
                'type': member.section.name
            },
            'forces': {
                'N': forces.N,
                'Vy': forces.Vy,
                'Vz': forces.Vz,
                'T': forces.T,
                'My': forces.My,
                'Mz': forces.Mz
            },
            'reinforcement': reinforcement or {
                'top': {'bars': [], 'area': 0},
                'bottom': {'bars': [], 'area': 0},
                'side': {'bars': [], 'area': 0},
                'links': {'size': 0, 'spacing': 0}
            },
            'stresses': {
                'concrete_top': 0,  # Placeholder
                'concrete_bottom': 0,
                'steel_tension': 0,
                'steel_compression': 0
            }
        }


# ============================================================================
# EXAMPLE: BS 8110 Chapter 13 Continuous Beam
# ============================================================================

def example_continuous_beam():
    """
    Recreate example from BS 8110 Chapter 13, Section 13.7
    3-span continuous beam with UDL
    """
    from .frame_analysis_core import (
        Frame3DAnalyzer, Node, Member, Material, Section,
        Load, LoadType, LoadCategory, LoadCombination
    )
    
    print("="*70)
    print("BS 8110 Chapter 13.7 Example: 3-Span Continuous Beam")
    print("="*70)
    
    analyzer = Frame3DAnalyzer()
    
    # Create material
    concrete = Material.concrete_C30()
    
    # Create section (400mm x 600mm beam)
    section = Section.rectangular("Beam", 400, 600)
    
    # Create nodes (4 nodes for 3 spans)
    supports = [
        {'id': 1, 'support': {'dy': True}},  # Pinned
        {'id': 2, 'support': {'dy': True}},  # Roller
        {'id': 3, 'support': {'dy': True}},  # Roller
        {'id': 4, 'support': {'dy': True}}   # Roller
    ]
    
    for i, sup in enumerate(supports):
        node = Node(
            id=sup['id'],
            x=i * 8.0,  # 8m spans
            y=0,
            z=0,
            support=sup['support']
        )
        analyzer.add_node(node)
    
    # Create members
    for i in range(3):
        member = Member(
            id=i+1,
            start_node_id=i+1,
            end_node_id=i+2,
            section=section,
            material=concrete
        )
        analyzer.add_member(member)
    
    # Add UDL (42.12 kN/m from example)
    for i in range(3):
        load = Load(
            category=LoadCategory.DEAD,
            member_id=i+1,
            load_type=LoadType.UDL,
            Fy=-42.12,  # Negative = downward
            coordinate_system='global'
        )
        analyzer.add_load(load)
    
    # Add load combination
    combo = LoadCombination.ULS_dead_imposed()
    analyzer.add_load_combination(combo)
    
    # Analyze
    print("\nAnalyzing...")
    analyzer.analyze_all_combinations()
    
    # Print results
    print("\nResults for", combo.name)
    print("-" * 70)
    
    for member_id, forces in analyzer.member_forces[combo.name].items():
        print(f"\nMember {member_id}:")
        print(f"  Start: Vy={forces[1]:.2f} kN, Mz={forces[5]:.2f} kNm")
        print(f"  End:   Vy={forces[7]:.2f} kN, Mz={forces[11]:.2f} kNm")
        
        # Compare with book values
        if member_id == 1:
            print(f"  Book values: Support B Mz = -269.57 kNm")
            print(f"  Calculated:  Support B Mz = {forces[11]:.2f} kNm")
    
    # Export results
    analyzer.export_to_json("continuous_beam_results.json")
    print("\nResults exported to continuous_beam_results.json")
    
    # Generate visualization data
    vis_gen = VisualizationDataGenerator()
    viz_data = vis_gen.generate_3d_frame_data(analyzer, combo.name)
    
    with open("continuous_beam_viz.json", 'w') as f:
        import json
        json.dump(viz_data, f, indent=2)
    print("Visualization data exported to continuous_beam_viz.json")


if __name__ == "__main__":
    example_continuous_beam()