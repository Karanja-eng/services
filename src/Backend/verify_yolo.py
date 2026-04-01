import sys
import os
import traceback

try:
    # Add the backend directory to path
    sys.path.append(r'c:\Users\HP\Documents\programming\Java script\ReactApps\Services\src\Backend')
    from calculations.Atomationmodels.arch_pro.yolo_cv import router
    print("SUCCESS: yolo_cv.py imported successfully!")
except Exception:
    print("FAILURE: yole_cv.py import failed!")
    traceback.print_exc()
