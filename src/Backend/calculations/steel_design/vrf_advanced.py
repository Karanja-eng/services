print("TRACE: vrf_advanced.py starting")
import asyncio
import json
import sys
import os
print("TRACE: vrf_advanced sys.path starting")

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from calculations.steel_design.bim_orchestrator import run_steel_pipeline
from calculations.steel_design import module_registration # Populates registry

async def verify_pipeline():
    print("--- STARTING DIRECT BIM PIPELINE VERIFICATION ---")
    
    test_request = {
        "generator": "truss",
        "params": {
            "truss_type": "Pratt",
            "span": 12000,
            "depth": 1500,
            "num_panels": 8,
            "grade": "S355"
        },
        "analysis_method": "perfect_frames", # Testing new analytical engine
        "design_code": "BS5950_v2"
    }

    print(f"Executing pipeline with generator: {test_request['generator']} and analysis: {test_request['analysis_method']}")
    
    try:
        # Run the pipeline directly
        model = await run_steel_pipeline(
            generator_name=test_request["generator"],
            params=test_request["params"],
            analysis_method=test_request["analysis_method"],
            design_code=test_request["design_code"]
        )

        print("\nPipeline Result Summary:")
        print(f"Nodes: {len(model.nodes)}")
        print(f"Members: {len(model.members)}")
        print(f"Design Success: {model.design_results.get('summary', {}).get('passedMembers', 0)} members passed")
        
        # Check for specialized results
        struts = model.design_results.get('struts', [])
        ties = model.design_results.get('ties', [])
        print(f"Specialized Strut Checks: {len(struts)}")
        print(f"Specialized Tie Checks: {len(ties)}")
        
        if struts:
            print(f"Sample Strut {struts[0]['id']} Utilization: {struts[0]['utilization']:.2f}%")
        
        # Verify connections
        connections = model.connection_results.get('connections', [])
        print(f"Connections Designed: {len(connections)}")
        
        if connections:
            conn = connections[0]
            print(f"Sample Connection Node {conn['node_id']} Bolts: {conn['bolts']['count']}")
            print(f"Sample Connection Weld Capacity: {conn.get('welds', {}).get('capacity_kN', 0):.1f} kN")

        # Verify Composite
        composite = model.design_results.get('composite', [])
        print(f"Composite Members Designed: {len(composite)}")
        if composite:
            print(f"Sample Composite {composite[0]['id']} Capacity: {composite[0]['Mc_kNm']:.1f} kNm")

        # Verify Visualization Data (Drawing elements)
        draw_3d = model.drawing_data.get('3d', [])
        draw_2d = model.drawing_data.get('2d', [])
        print(f"BIM Primitives Generated: {len(draw_3d)} (3D), {len(draw_2d)} (2D)")
        if len(draw_3d) > 0:
            print(f"Sample 3D Primitive Type: {draw_3d[0].get('type')}")

        print("\n--- VERIFICATION COMPLETE: SUCCESS ---")
        
    except Exception as e:
        print(f"\n--- VERIFICATION FAILED ---")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_pipeline())
