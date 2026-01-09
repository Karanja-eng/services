from src.Backend.calculations.Beams.rc_beam_design import integrate_analysis_design, integrate_moment_distribution_design, BeamDesignResponse
import sys

def test_internal_logic():
    print("\n--- Testing Internal Logic (Bypassing HTTP) ---", flush=True)
    
    # 1. BS Coefficients Payload
    bs_payload = {
        "analysis_results": [
            {"span_index": 0, "max_moment": 50.0, "support_moment_left": -40.0, "support_moment_right": -40.0, "shear_left": 60.0, "shear_right": -60.0, "span_length": 6.0}
        ],
        "design_parameters": {
            "beam_type": "Rectangular",
            "support_condition": "Continuous",
            "materials": {"concrete_grade": "C30", "steel_grade": "Grade 460"},
            "rectangular_geometry": {"width": 300, "depth": 500, "cover": 25},
            "imposed_load": 10,
            "permanent_load": 15
        }
    }
    
    try:
        res = integrate_analysis_design(bs_payload)
        print(f"BS Coeffs Result: OK={res.summary.all_designs_ok}, Spans={len(res.span_designs)}", flush=True)
    except Exception as e:
        print(f"BS Coeffs FAILED: {e}", flush=True)
        import traceback
        traceback.print_exc()

    # 2. Moment Distribution Payload
    md_payload = {
        "md_results": {
            "moment_data": {"AB": [{"x": 0, "y": -20}, {"x": 3, "y": 50}, {"x": 6, "y": -30}]},
            "shear_force_data": {"AB": [{"x": 0, "y": 40}, {"x": 6, "y": -40}]}
        },
        "design_parameters": {
            "beam_type": "Rectangular",
            "support_condition": "Continuous",
            "materials": {"concrete_grade": "C30", "steel_grade": "Grade 460"},
            "rectangular_geometry": {"width": 300, "depth": 500, "cover": 25},
            "imposed_load": 10,
            "permanent_load": 15
        }
    }
    
    try:
        res = integrate_moment_distribution_design(md_payload)
        print(f"MD Result: OK={res.summary.all_designs_ok}, Spans={len(res.span_designs)}", flush=True)
    except Exception as e:
        print(f"MD FAILED: {e}", flush=True)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        test_internal_logic()
    except Exception as e:
        print(f"Global Error: {e}", flush=True)
