import requests
import json

BASE_URL = "http://127.0.0.1:8000"  # Adjust if necessary

def test_batch_add_missing_color():
    url = f"{BASE_URL}/drawings/projects/default/objects/batch"
    payload = {
        "objects": [
            {
                "id": "TEST_OBJ_1",
                "type": "circle",
                "center": {"x": 10, "y": 10, "z": 0},
                "radius": 5,
                "layerId": "1"
            },
            {
                "id": "TEST_OBJ_2",
                "type": "line",
                "start": {"x": 0, "y": 0, "z": 0},
                "end": {"x": 10, "y": 10, "z": 0}
                # missing color and layerId
            }
        ]
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success: Batch objects added.")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_batch_add_missing_color()
