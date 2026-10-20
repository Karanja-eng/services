"""
Generate all representative DXF drawings for the engineering system into outputs/
"""
import os
import sys
from engineering_system.generate import generate_all

if __name__ == "__main__":
    out_dir = "outputs"
    os.makedirs(out_dir, exist_ok=True)
    print(f"Generating all CAD detailing drawings into {out_dir}/ ...", flush=True)
    results = generate_all(out_dir)
    print(f"Successfully generated {len(results)} drawings:", flush=True)
    for name, path in results.items():
        print(f"  [{name}]: {path} ({os.path.getsize(path)} bytes)", flush=True)
    print("ALL DRAWINGS GENERATED OK.", flush=True)
