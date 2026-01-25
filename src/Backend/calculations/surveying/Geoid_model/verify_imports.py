
import sys
import os

# Add the src directory to python path
sys.path.append(r"C:\Users\HP\Documents\programming\Java script\ReactApps\Services\src")

try:
    print("Attempting to import Backend.calculations.surveying.Geoid_model modules...")
    
    import Backend.calculations.surveying.Geoid_model.constants as constants
    print("Imported constants")
    
    import Backend.calculations.surveying.Geoid_model.validation as validation
    print("Imported validation")
    
    import Backend.calculations.surveying.Geoid_model.schemas as schemas
    print("Imported schemas")
    
    import Backend.calculations.surveying.Geoid_model.geoid_model as geoid_model
    print("Imported geoid_model")
    
    import Backend.calculations.surveying.Geoid_model.helmert as helmert
    print("Imported helmert")
    
    import Backend.calculations.surveying.Geoid_model.baseline_computation as baseline_computation
    print("Imported baseline_computation")
    
    import Backend.calculations.surveying.Geoid_model.baseline_adjustment as baseline_adjustment
    print("Imported baseline_adjustment")
    
    import Backend.calculations.surveying.Geoid_model.latlon_to_utm as latlon_to_utm
    print("Imported latlon_to_utm")
    
    import Backend.calculations.surveying.Geoid_model.geoid_undulation as geoid_undulation
    print("Imported geoid_undulation")
    
    import Backend.calculations.surveying.Geoid_model.rtk_accuracy as rtk_accuracy
    print("Imported rtk_accuracy")
    
    import Backend.calculations.surveying.Geoid_model.rinex_parser as rinex_parser
    print("Imported rinex_parser")
    
    import Backend.calculations.surveying.Geoid_model.ntrip_client as ntrip_client
    print("Imported ntrip_client")
    
    import Backend.calculations.surveying.Geoid_model.router as router
    print("Imported router")
    
    import Backend.calculations.surveying.Geoid_model.geoid_api as geoid_api
    print("Imported geoid_api")
    
    print("\nSUCCESS: All modules imported correctly.")
    
except ImportError as e:
    print(f"\nERROR: ImportError: {e}")
    sys.exit(1)
except Exception as e:
    print(f"\nERROR: {e}")
    sys.exit(1)
