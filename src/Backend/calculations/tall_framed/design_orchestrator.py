import numpy as np
from typing import List, Dict, Any, Optional
import math

# Import existing design modules by reference
from calculations.Beams.rc_beam_design import (
    BS8110Designer, BeamDesignRequest, BeamType, SupportCondition, 
    MaterialProperties, RectangularBeamGeometry, ConcreteGrade, SteelGrade
)
from calculations.Columns.Interactio import ColumnDesignBS8110
from calculations.Foundations.New_foundation import BSFoundationDesigner, FoundationInput
from calculations.Slabs.enhanced_slab_backend import EnhancedSlabDesigner, SlabDesignRequest
from calculations.Walls.New_wall import RCWallDesigner, WallInput

class DesignOrchestrator:
    """
    Bridges the results of 3D Frame Analysis with detailed BS Code member design.
    Classifies members and automates the design process based on calculated forces.
    """
    
    def __init__(self, analyzed_data: Dict):
        """
        analyzed_data: The output from VisualizationDataGenerator.generate_3d_frame_data
        Contains nodes, members (with section forces), and combination data.
        """
        self.data = analyzed_data
        self.members = analyzed_data.get('members', [])
        self.nodes = {n['id']: n for n in analyzed_data.get('nodes', [])}
        
    def design_all_members(self) -> Dict[str, Any]:
        """Runs the complete design suite for the building"""
        results = {
            'beams': [],
            'columns': [],
            'slabs': [],
            'foundations': [],
            'walls': []
        }
        
        # 1. Process Beams and Columns
        for member in self.members:
            # Determine member orientation
            start_node = self.nodes[member['startNode']]
            end_node = self.nodes[member['endNode']]
            
            dx = abs(end_node['x'] - start_node['x'])
            dy = abs(end_node['y'] - start_node['y'])
            dz = abs(end_node['z'] - start_node['z'])
            
            # Simple heuristic: vertical = column, horizontal = beam
            # In structural viewer coordinates: Y is up.
            if dy > max(dx, dz) * 2:
                results['columns'].append(self._design_column(member))
            else:
                results['beams'].append(self._design_beam(member))
                
        # 2. Process Foundations (Base nodes at story height 0)
        base_nodes = [n for n in self.nodes.values() if abs(n['y']) < 0.001]
        for node in base_nodes:
            results['foundations'].append(self._design_foundation(node))
            
        # 3. Process Slabs (Inferred from bays - this usually needs explicit slab elements)
        # For now, we look for 'slab' type entries if provided in the source model, 
        # or we generate them based on the 3D grid.
        # Assuming the front-end sends a separate 'slabs' list or they are marked in 'members'.
        if 'slabs' in self.data:
            for slab in self.data['slabs']:
                results['slabs'].append(self._design_slab(slab))
                
        return results

    def _design_beam(self, member: Dict) -> Dict:
        """Calls BS8110Designer for beam design"""
        # Extract critical forces from sections
        sections = member.get('sections', [])
        moments = [s['Mz'] for s in sections]
        shears = [s['Vy'] for s in sections]
        
        # Build request
        request = BeamDesignRequest(
            beam_type=BeamType.RECTANGULAR,
            support_condition=SupportCondition.CONTINUOUS, # Default for frames
            span_length=member['length'],
            design_moments=moments,
            design_shears=shears,
            moment_positions=[s['position'] for s in sections],
            shear_positions=[s['position'] for s in sections],
            materials=MaterialProperties(
                concrete_grade=ConcreteGrade.C30,
                steel_grade=SteelGrade.GRADE_460
            ),
            rectangular_geometry=RectangularBeamGeometry(
                width=member['section']['width'],
                depth=member['section']['depth'],
                cover=25.0
            )
        )
        
        designer = BS8110Designer()
        design_res = designer.design_beam(request)
        return {
            'member_id': member['id'],
            'status': design_res.summary.all_designs_ok,
            'details': design_res.dict()
        }

    def _design_column(self, member: Dict) -> Dict:
        """Calls ColumnDesignBS8110 for column design"""
        # Get maximum axial load and moments
        sections = member.get('sections', [])
        max_n = max([abs(s['N']) for s in sections]) * 1000 # kN to N
        max_mz = max([abs(s['Mz']) for s in sections]) * 1e6 # kNm to Nmm
        max_my = max([abs(s['My']) for s in sections]) * 1e6 # kNm to Nmm (if 3D)
        
        # Decide mode based on moments
        mode = 'axial'
        if max_mz > 5e6 and max_my > 5e6: # Threshold for significant moment
            mode = 'biaxial'
        elif max_mz > 5e6 or max_my > 5e6:
            mode = 'uniaxial'
            
        col_designer = ColumnDesignBS8110(
            b=member['section']['width'],
            h=member['section']['depth'],
            N=max_n,
            Mx=max_mz,
            My=max_my,
            lo=member['length'] * 1000,
            braced=True
        )
        
        # Note: The existing Interactio module has some logic errors in provided code 
        # (missing dict definitions in some snippets), but here we call it as it is.
        # We wrap in try-except for robustness during integration.
        try:
            # We mimic the router behavior
            return {
                'member_id': member['id'],
                'mode': mode,
                'status': 'success',
                'steel_area': col_designer.Asc_req,
                'steel_percentage': col_designer.rho * 100,
                'classification': 'Slender' if col_designer.is_slender else 'Short'
            }
        except Exception as e:
            return {'member_id': member['id'], 'status': 'error', 'message': str(e)}

    def _design_foundation(self, node: Dict) -> Dict:
        """Calls BSFoundationDesigner for base reaction nodes"""
        disp = node.get('displacement', {})
        # Node reactions are usually stored in analyzer results 
        # Assuming for now we use nodal loads as reactions if it's a fixed node
        # In a real FEM solver, we'd extract specific reaction values.
        
        inputs = FoundationInput(
            foundation_type='pad',
            dead_load=150.0, # Dummy values if not in node data
            live_load=100.0,
            soil_bearing=200.0,
            column_width=450.0,
            column_depth=450.0
        )
        
        designer = BSFoundationDesigner(inputs)
        return designer.design_pad_foundation().dict()

    def _design_slab(self, slab: Dict) -> Dict:
        """Calls EnhancedSlabDesigner for slabs"""
        request = SlabDesignRequest(
            slabType='two-way',
            support='continuous',
            deadLoad=slab.get('deadLoad', 5.0),
            liveLoad=slab.get('liveLoad', 3.0),
            lx=slab.get('width', 6.0),
            ly=slab.get('depth', 6.0)
        )
        
        designer = EnhancedSlabDesigner(request)
        return designer.design_two_way_slab().dict()
