import requests
import json

url = "http://localhost:8001/manholes_router/calculate"
payload = {
    "project_name": "Test Project",
    "veg_depth": 0.15,
    "has_rock": True,
    "rock_start_depth": 1.0,
    "has_planking": True,
    "ground_is_level": True,
    "site_clearance_area": 100,
    "manholes": [
        {
            "id": "MH1",
            "type": "rect",
            "internal_length": 1.5,
            "internal_width": 1.0,
            "invert_level": -2.0,
            "ground_level": 0.0,
            "bed_thickness": 0.15,
            "wall_thickness": 0.2,
            "wall_material": "concrete",
            "projection_thickness": 0.1,
            "slab_thickness": 0.15,
            "benching_avg_height": 0.2,
            "has_benching": True,
            "plaster_thickness": 0.012,
            "has_plaster": True,
            "cover_length": 0.6,
            "cover_width": 0.6,
            "cover_type": "heavy_duty",
            "has_channel": True,
            "channel_length": 1.5,
            "has_step_irons": True,
            "quantity": 1,
            "position_x": 0,
            "position_y": 0
        }
    ],
    "pipes": [
        {
            "id": "P1",
            "from_point": "MH1",
            "to_point": "Outfall",
            "length": 20.0,
            "diameter_mm": 150,
            "pipe_material": "upvc",
            "trench_depth_start": 1.0,
            "trench_depth_end": 1.2,
            "trench_width": 0.6,
            "bedding_type": "granular",
            "surround_thickness": 0.15,
            "gradient": 1.0,
            "quantity": 1
        }
    ]
}

try:
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        data = response.json()
        print("Success!")
        print(f"Total BOQ items: {len(data['boq_items'])}")
        for item in data['boq_items']:
            print(f"- {item['code']}: {item['description']} ({item['quantity']} {item['unit']})")
            if 'dimensions' in item and item['dimensions']:
                print(f"  Dimensions found: {len(item['dimensions'])} entries")
            else:
                print("  WARNING: No dimensions found!")
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Exception: {e}")
