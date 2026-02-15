import bpy
import json
import argparse
import sys
import os

def create_cube(name, location, scale, rotation=(0, 0, 0), metadata=None):
    bpy.ops.mesh.primitive_cube_add(location=location, scale=scale, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    
    if metadata:
        # Attach BIM metadata as glTF extras
        obj["bimMetadata"] = metadata
    return obj

def run_generation(data_path, output_path):
    # Clear existing objects
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    with open(data_path, 'r') as f:
        data = json.load(f)
        
    # Process floors
    for f_idx, floor in enumerate(data.get('floors', [])):
        z_offset = floor.get('elevation', 0)
        wall_height = floor.get('height', 3.0)
        
        # Walls
        for w_idx, wall in enumerate(floor.get('walls', [])):
            start = wall['start']
            end = wall['end']
            thickness = wall.get('thickness', 0.15)
            
            # Simple box calculation for wall
            x = (start[0] + end[0]) / 2
            y = (start[1] + end[1]) / 2
            z = z_offset + (wall_height / 2)
            
            length = ((start[0] - end[0])**2 + (start[1] - end[1])**2)**0.5
            angle = 0 # Simplified
            
            w_meta = wall.get('metadata', {})
            bim_meta = w_meta.get('bimMetadata', {"System": "architecture", "Subsystem": "walls", "Layer": "walls"})
            
            create_cube(f"wall_{f_idx}_{w_idx}", (x, y, z), (length/2, thickness/2, wall_height/2), metadata=bim_meta)
            
        # Doors & Windows
        for d_idx, door in enumerate(floor.get('doors', [])):
            pos = door['position']
            bim_meta = door.get('metadata', {}).get('bimMetadata', {"System": "architecture", "Subsystem": "doors", "Layer": "doors"})
            create_cube(f"door_{f_idx}_{d_idx}", (pos[0], pos[1], z_offset + door['height']/2), (door['width']/2, 0.1, door['height']/2), metadata=bim_meta)

        for win_idx, window in enumerate(floor.get('windows', [])):
            pos = window['position']
            bim_meta = window.get('metadata', {}).get('bimMetadata', {"System": "architecture", "Subsystem": "windows", "Layer": "windows"})
            create_cube(f"window_{f_idx}_{win_idx}", (pos[0], pos[1], z_offset + window['sillHeight'] + window['height']/2), (window['width']/2, 0.1, window['height']/2), metadata=bim_meta)

    # Export to GLB
    bpy.ops.export_scene.gltf(filepath=output_path, export_extras=True, export_format='GLB')

if __name__ == "__main__":
    # Get args after "--"
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
        
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    
    run_generation(args.input, args.output)
