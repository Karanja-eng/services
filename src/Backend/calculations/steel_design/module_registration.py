"""
module_registration.py

Registers all structural steel modules with the Orchestration Registry.
Bridges data formats between new BIM modules and legacy analysis/design engines.
"""

from calculations.steel_design.bim_orchestrator import registry, BIMModel
from calculations.steel_design.Steel_BIM import Point3D, Line3D
from calculations.Atomationmodels.arch_pro.Drawing_elements.Steel_BIM.truss_generator import TrussGenerator, TrussParameters, TrussType
from calculations.Atomationmodels.arch_pro.Drawing_elements.Steel_BIM.drawing_primitives import MemberVisualization
import asyncio

# --- GENERATORS ---

def truss_system_generator(**params) -> dict:
    """Wrapper for TrussGenerator."""
    try:
        # Map string truss type to Enum
        t_type_str = params.get('truss_type', 'Pratt')
        t_type = next((t for t in TrussType if t.value == t_type_str), TrussType.PRATT)
        
        truss_params = TrussParameters(
            truss_type=t_type,
            span=float(params.get('span', 6000)),
            depth=float(params.get('depth', 1000)),
            num_panels=int(params.get('num_panels', 6)),
            pitch_angle=float(params.get('pitch_angle', 0.0)),
            grade=params.get('grade', 'S355'),
            top_chord_section=params.get('top_chord_section', "150x150x12EA"),
            bottom_chord_section=params.get('bottom_chord_section', "150x150x12EA"),
            web_section=params.get('web_section', "90x90x12EA")
        )
        
        generator = TrussGenerator(truss_params)
        return generator.generate()
    except Exception as e:
        print(f"Truss generation failed: {e}")
        return {'nodes': [], 'members': [], 'metadata': {'error': str(e)}}

registry.register_generator('truss', truss_system_generator)

# --- ANALYSIS (Legacy) ---

async def legacy_frame_analysis(model: BIMModel) -> dict:
    """Wrapper for legacy full_building_analysis."""
    from ..tall_framed.full_building_analysis import analyze_full_building, BuildingAnalysisRequest
    
    transformed_elements = []
    for member in model.members:
        # Determine start/end from centerline
        centerline = member.get('centerline', {})
        start = centerline.get('start', {'x': 0, 'y': 0, 'z': 0})
        end = centerline.get('end', {'x': 5000, 'y': 0, 'z': 0})
        
        element_dict = {
            "id": member.get('id', member.get('mark', 'M1')),
            "type": member.get('member_type', 'beam').lower() if isinstance(member.get('member_type'), str) else 'beam',
            "properties": {
                "width": member.get('section', {}).get('width', 300),
                "depth": member.get('section', {}).get('depth', 300),
                "material_grade": member.get('grade', 'S355'),
                "section": member.get('section', {}).get('designation'),
                "sectionType": member.get('section', {}).get('type', 'UB'),
                "load_combined": member.get('load', 0.0)
            },
            "start": {"x": start['x']/1000, "y": start['y']/1000, "z": start['z']/1000},
            "end": {"x": end['x']/1000, "y": end['y']/1000, "z": end['z']/1000},
            "layer": "Main"
        }
        transformed_elements.append(element_dict)
    
    analysis_payload = {
        "elements": transformed_elements,
        "method": "matrix_stiffness",
        "slab_load": 0.0
    }
    
    try:
        analysis_obj = BuildingAnalysisRequest(**analysis_payload)
        # Natively await the async analysis function
        print(f"Calling analyze_full_building with {len(analysis_obj.elements)} elements...")
        results = await analyze_full_building(analysis_obj)
        print(f"analyze_full_building returned {len(results)} results.")
        return results
    except Exception as e:
        print(f"Legacy analysis failed: {e}")
        return {}

registry.register_analysis_engine('matrix_stiffness', legacy_frame_analysis)

# --- DESIGN ---

def bs5950_design_checks(model: BIMModel) -> dict:
    """Wrapper for BS 5950 member design checks."""
    from .steel_design_backend import run_beam_checks, run_column_checks, BeamDesignRequest, ColumnDesignRequest
    
    results = {'beams': [], 'columns': []}
    analysis_map = {r['element_id']: r for r in (model.analysis_results or [])}
    
    for member in model.members:
        mid = member.get('id', member.get('mark'))
        forces = analysis_map.get(mid, {'M_max': 0, 'V_max': 0, 'N_max': 0})
        
        # Determine if beam or column (simplified)
        m_type = member.get('member_type', 'beam').lower()
        
        if m_type in ['beam', 'chord', 'diagonal', 'web']:
            # Design as beam/strut
            req = BeamDesignRequest(
                span=member['centerline']['length'] / 1000.0,
                udl=abs(forces['V_max'] * 2 / (member['centerline']['length'] / 1000.0)) if forces['V_max'] > 0 else 0,
                grade=member['grade'],
                section=member['section']['designation'],
                section_type=member['section'].get('type', 'UB')
            )
            try:
                check_result = run_beam_checks(req)
                results['beams'].append({'id': mid, 'results': check_result.dict()})
            except:
                pass
        elif m_type == 'column':
            req = ColumnDesignRequest(
                height=member['centerline']['length'] / 1000.0,
                axial_load=forces['N_max'],
                moment_major=forces['M_max'],
                grade=member['grade'],
                section=member['section']['designation'],
                section_type=member['section'].get('type', 'UC')
            )
            try:
                check_result = run_column_checks(req)
                results['columns'].append({'id': mid, 'results': check_result.dict()})
            except:
                pass
                
    return results

registry.register_design_engine('BS5950', bs5950_design_checks)

# --- DRAWING / VISUALIZATION ---

def generate_drawing_data(model: BIMModel) -> dict:
    """Generates 2D and 3D visualization primitives."""
    viz_data = {'konva': [], 'threejs': []}
    
    # We need a dummy Member class or equivalent to use MemberVisualization
    # For now, we'll manually use MemberVisualization if possible or map results
    
    for member in model.members:
        # Extract geometry
        start = member['centerline']['start']
        end = member['centerline']['end']
        
        # 3D: Box or Tube based on section type
        # (Simplified mapping for existing CadObjects3D support)
        viz_data['threejs'].append({
            'id': member.get('id', str(uuid.uuid4())),
            'type': 'line', # Fallback to line if box not fully ready
            'start': start,
            'end': end,
            'color': '#778899',
            'metadata': {'member_type': member.get('member_type'), 'mark': member.get('mark')}
        })
        
        # 2D: Line
        viz_data['konva'].append({
            'type': 'line',
            'points': [start['x'], start['z'], end['x'], end['z']], # X-Z elevation
            'stroke': '#333333',
            'strokeWidth': 2
        })
        
    return viz_data

registry.register_drawing_engine('standard_viz', generate_drawing_data)
