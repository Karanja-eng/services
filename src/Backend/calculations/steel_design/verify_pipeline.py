"""
verify_pipeline.py

Manual verification script for the Steel BIM Pipeline.
Tests the transition: Generator -> Analysis -> Design -> Drawing
"""

import asyncio

async def verify():
    try:
        from Backend.calculations.steel_design.bim_orchestrator import run_steel_pipeline
        import Backend.calculations.steel_design.module_registration # Ensure registration
        
        print("--- Starting Pipeline Verification ---")
        
        # Test Pratt Truss generation
        params = {
            'truss_type': 'Pratt',
            'span': 12000,
            'depth': 1500,
            'num_panels': 6,
            'pitch_angle': 15.0,
            'grade': 'S355',
            'top_chord_section': "150x150x12EA",
            'bottom_chord_section': "150x150x12EA",
            'web_section': "90x90x12EA"
        }
        
        print(f"Executing pipeline with params: {params}")
        
        # Note: The run_steel_pipeline is sync in my current impl, 
        # but calls module_registration which manages its own loop.
        # Let's make the pipeline itself async if possible, 
        # but for now let's just run it.
        # Pipeline is now async
        model = await run_steel_pipeline(
            generator_name='truss',
            params=params,
            analysis_method='matrix_stiffness',
            design_code='BS5950'
        )
        
        print("\n[Topology Result]")
        print(f"Total Nodes: {len(model.nodes)}")
        print(f"Total Members: {len(model.members)}")
        
        print("\n[Analysis Result]")
        if model.analysis_results:
            print(f"Analyzed {len(model.analysis_results)} elements")
        else:
            print("WARNING: No analysis results found")
            
        print("\n[Design Result]")
        if model.design_results:
            beams = model.design_results.get('beams', [])
            print(f"Designed {len(beams)} beams")
        else:
            print("WARNING: No design results found")
            
        print("\n[Drawing Result]")
        if model.drawing_data:
            print(f"Generated {len(model.drawing_data.get('threejs', []))} Three.js objects")
        else:
            print("WARNING: No drawing data found")
            
        print("\n--- Verification Complete ---")

    except Exception as e:
        print(f"\nERROR during verification: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify())
