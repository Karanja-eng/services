import requests
import json

url_health = "http://127.0.0.1:8001/health"
print(f"Checking health at: {url_health}")
try:
    auth_response = requests.get(url_health, timeout=5)
    print(f"Health Status Code: {auth_response.status_code}")
    print(f"Health Response: {auth_response.text}")
except Exception as e:
    print(f"Health check failed: {e}")

url = "http://127.0.0.1:8001/external_works/calculate"
print(f"Calling URL: {url}")
payload = {
    "project_info": {
        "project_name": "Test Project",
        "location": "Nairobi",
        "drawing_number": "DRG-01",
        "date": "2026-01-11",
        "taken_by": "Antigravity",
        "checked_by": "User",
        "scale": "1:100"
    },
    "site_data": {
        "site_length": 50,
        "site_width": 40
    },
    "demolition": {
        "house_length": 12,
        "house_width": 10,
        "building_demolition_volume": 0,
        "trees_small": 3,
        "trees_large": 2,
        "stumps": 1,
        "pipeline_removal_length": 0,
        "pipeline_diameter": 225,
        "vegetable_soil_depth": 0.15
    },
    "road_config": {
        "road_length": 32,
        "road_width": 9,
        "road_type": "bitumen",
        "driveway_length": 20,
        "driveway_width": 9,
        "driveway_type": "bitumen",
        "parking_length": 25,
        "parking_width": 9,
        "parking_type": "cabro",
        "bellmouth_radius_1": 3.5,
        "bellmouth_radius_2": 2.5
    },
    "pavement_layers": {
        "bitumen_thickness": 0.05,
        "bitumen_macadam_base": 0.15,
        "murram_depth": 0.20,
        "hardcore_thickness": 0.20,
        "sand_bed_thickness": 0.15,
        "excavation_depth_after_veg": 0.50,
        "backing_allowance": 0.10,
        "concrete_backing_thickness": 0.10
    },
    "kerbs_channels": {
        "kerb_type": "pcc",
        "kerb_straight_length": 10,
        "kerb_curved_length": 5,
        "channel_straight_length": 10,
        "channel_curved_length": 5
    },
    "drainage": {
        "invert_block_count": 10,
        "invert_block_size": 0.35,
        "pcc_slab_length": 10,
        "pcc_slab_width": 0.50,
        "pcc_slab_thickness": 0.05,
        "drainage_channel_length": 20
    },
    "landscaping": {
        "grass_seeding_area": 100,
        "imported_topsoil_thickness": 0.15,
        "mahogany_trees": 5,
        "ornamental_trees": 10,
        "euphorbia_hedge_length": 50
    },
    "fencing": {
        "timber_post_wire_fence": 200,
        "fence_type_1_length": 0,
        "fence_type_2_length": 0,
        "metal_gates": 1,
        "normal_gates": 0
    }
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Success!")
        data = response.json()
        print(f"Items returned: {len(data.get('items', []))}")
        if data.get('items'):
             print(f"First item: {data['items'][0]['description']}")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Connection error: {e}")
