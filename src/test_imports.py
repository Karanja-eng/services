import asyncio
import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

print("Starting import test...")
try:
    from Backend.calculations.steel_design.bim_orchestrator import SteelBIMPipeline
    from Backend.calculations.steel_design.module_registration import registry
    print("Imports successful!")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()

async def test():
    print("Testing pipeline initialization...")
    pipeline = SteelBIMPipeline(registry)
    print("Pipeline initialized!")

if __name__ == "__main__":
    asyncio.run(test())
