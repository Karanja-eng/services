import requests
import json

BASE_URL = "http://localhost:8001/beam_analysis/rc_design"

def test_bs_coefficients_integration():
    print("\n--- Testing BS Coefficients Integration (List Input) ---")
    payload = {
        "analysis_results": [
            {
                "span_index": 0,
                "max_moment": 45.0,
                "support_moment_left": -30.0,
                "support_moment_right": -40.0,
                "shear_left": 50.0,
                "shear_right": -50.0,
                "span_length": 5.0
            },
            {
                "span_index": 1,
                "max_moment": 40.0,
                "support_moment_left": -40.0,
                "support_moment_right": -30.0,
                "shear_left": 45.0,
                "shear_right": -45.0,
                "span_length": 5.0
            }
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
        res = requests.post(f"{BASE_URL}/integrate_analysis_design", json=payload)
        if res.status_code == 200:
            print("SUCCESS: 200 OK")
            data = res.json()
            print(f"Summary: {data['summary']}")
            print(f"Spans Designed: {len(data['span_designs'])}")
        else:
            print(f"FAILED: {res.status_code}")
            print(res.text)
    except Exception as e:
        print(f"ERROR: {e}")

def test_moment_distribution_integration():
    print("\n--- Testing Moment Distribution Integration ---")
    payload = {
        "md_results": {
            "moment_data": {
                "AB": [{"x": 0, "y": -20}, {"x": 3, "y": 50}, {"x": 6, "y": -30}],
                "BC": [{"x": 0, "y": -30}, {"x": 3, "y": 45}, {"x": 6, "y": -20}]
            },
            "shear_force_data": {
                "AB": [{"x": 0, "y": 40}, {"x": 6, "y": -40}],
                "BC": [{"x": 0, "y": 35}, {"x": 6, "y": -35}]
            }
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
        res = requests.post(f"{BASE_URL}/integrated/moment_distribution_design", json=payload)
        if res.status_code == 200:
            print("SUCCESS: 200 OK")
            data = res.json()
            print(f"Summary: {data['summary']}")
            print(f"Spans Designed: {len(data['span_designs'])}")
        else:
            print(f"FAILED: {res.status_code}")
            print(res.text)
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_bs_coefficients_integration()
    test_moment_distribution_integration()
