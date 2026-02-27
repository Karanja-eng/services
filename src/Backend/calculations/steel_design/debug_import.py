import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
print("Target: Importing module_registration")
try:
    from calculations.steel_design import module_registration
    print("Success: module_registration imported")
except Exception as e:
    print(f"Error: {e}")
