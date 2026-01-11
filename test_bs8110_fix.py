
import json
import requests

def test_bs8110_design():
    # Corrected URL based on router prefixes
    url = "http://127.0.0.1:8001/rc_design/integrate_analysis_design"
    payload = {
        "analysis_results": {
            "moments": [0, 112.5, 0],
            "shears": [75, -75],
            "spans": [{"length": 6.0}]
        },
        "design_parameters": {
            "beam_type": "Rectangular",
            "support_condition": "Simply Supported",
            "span_length": 6.0,
            "fcu": 30,
            "fy": 460,
            "cover": 35,
            "materials": {
                "concrete_grade": "C30",
                "steel_grade": "Grade 460"
            }
        }
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success!")
            # print(json.dumps(response.json(), indent=2))
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_bs8110_design()
