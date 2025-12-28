from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn

# Database imports
from Databases import init_db, check_db_connection, get_db

app = FastAPI(
    title="Fundi API",
    description="Comprehensive engineering calculations with database persistence",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database initialization on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database on application startup"""
    print("\n" + "="*60)
    print("🚀 Starting Fundi API")
    print("="*60)
    
    # Check database connection
    success, message = check_db_connection()
    if success:
        print(f"✅ {message}")
        try:
            init_db()
            print("✅ Database initialized successfully")
        except Exception as e:
            print(f"⚠️  Database initialization warning: {str(e)}")
            print("   Application will continue without database persistence")
    else:
        print(f"⚠️  {message}")
        print("   Application will continue without database persistence")
    
    print("="*60 + "\n")


# Health check endpoints
@app.get("/", tags=["Health"])
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Fundi API",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "Surveying calculations",
            "Quantity surveying",
            "Steel design",
            "RC design (beams, columns, foundations, slabs, walls, stairs, retaining)",
            "Database persistence"
        ]
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    db_success, db_message = check_db_connection()
    return {
        "status": "healthy",
        "database": {
            "connected": db_success,
            "message": db_message
        }
    }


@app.get("/db-status", tags=["Health"])
async def database_status(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "connected",
            "message": "Database is operational",
            "connection_pool": {
                "size": db.bind.pool.size(),
                "checked_in": db.bind.pool.checkedin(),
                "checked_out": db.bind.pool.checkedout(),
                "overflow": db.bind.pool.overflow()
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
#######  Surveying #####

from calculations.surveying.surveying_backend import router as surveying_backend_router

app.include_router(
    surveying_backend_router, prefix="/surveying_router", tags=["surveying_router"]
)

####### Quantity Surveying  #############

from calculations.takeoff.Qs import router as QuantitySurvey_backend_router
from calculations.takeoff.ManholesBackend import router as ManholesRouter
from calculations.takeoff.ExternalWorksBackend import router as ExternalWorksRouter
from calculations.takeoff.RoofBackend import router as RoofWorksRouter
from calculations.takeoff.septic_tank import router as septicRouter
from calculations.takeoff.swiming_pool import router as swimming_pool_router
from calculations.takeoff.Basement import router as basement_router
from calculations.takeoff.Door_window import router as Door_window_router
from calculations.takeoff.underground_tank_router import (
    router as underground_tank_router,
)
from calculations.takeoff.stairs import router as stairs_router
from calculations.takeoff.internal_finishes import router as internal_finishes_router
from calculations.takeoff.Superstructure_takeoff import router as superstructure_router
from calculations.takeoff.superstructure import router as rc_superstructure_router
from calculations.takeoff.substructure import router as rc_substructure_router



app.include_router(
    QuantitySurvey_backend_router, prefix="/qs_router", tags=["qs_router"]
)
app.include_router(ManholesRouter, prefix="/manholes_router", tags=["manholes_router"])
app.include_router(
    ExternalWorksRouter, prefix="/external_works", tags=["manholes_router"]
)
app.include_router(RoofWorksRouter, prefix="/roof_router", tags=["roof_router"])
app.include_router(septicRouter, prefix="/septicRouter", tags=["septic_Router"])
app.include_router(
    swimming_pool_router, prefix="/swimming_pool_router", tags=["swimming_pool_router"]
)
app.include_router(basement_router, prefix="/basement_router", tags=["basement_router"])
app.include_router(
    Door_window_router, prefix="/Door_window_router", tags=["Door_windowrouter"]
)
app.include_router(
    underground_tank_router,
    prefix="/underground_tank_router",
    tags=["underground_tank_router"],
)

app.include_router(stairs_router, prefix="/stairs_router", tags=["stairs_router"])
app.include_router(
    internal_finishes_router,
    prefix="/internal_finishes_router",
    tags=["internal_finishes_router"],
)
app.include_router(superstructure_router, prefix="/superstructure_router", tags=["superstructure_router"])
app.include_router(rc_superstructure_router, prefix="/rc_superstructure_router", tags=["rc_superstructure_router"])
app.include_router(rc_substructure_router, prefix="/rc_substructure_router", tags=["rc_substructure_router"])

## ##############   Ai Models  ##############

##Ai models
# from calculations.Atomationmodels.yolomodel import router as yolo_model_router
# from calculations.Atomationmodels.opencvmodel import router as open_cv_model_router
# from calculations.Atomationmodels.phi_vision import router as phi_model_router

# app.include_router(yolo_model_router, prefix="/yolo", tags=["Yolo_model"])
# app.include_router(open_cv_model_router, prefix="/opencv", tags=["OpenCv_model"])
# app.include_router(phi_model_router, prefix="/phi_model", tags=["phi_model_router"])

################## Steel ###########################

from calculations.steel_design.connections_api import router as connections_router
from calculations.steel_design.steel_design_backend import (
    router as stell_backend_router,
)


app.include_router(
    connections_router, prefix="/connections_backend", tags=["connections_router"]
)

app.include_router(stell_backend_router, prefix="/steel_backend", tags=["steel_router"])


#########################################   R . C ###########################

##beams
# from calculations.Beams.BeamDesignApi import router as beam_design_router
from calculations.Beams.main_beam_api import router as beam_analysis_router

# from calculations.Beams.threemain import router as three_mom_analysis_router

# from calculations.Beams.BeamRecordsApi import router as beam_record_router

##columns
# from calculations.Columns.ColumnDesignAPI import router as column_design_router
from calculations.Columns.Interactio import router as column_interaction_router

##foundations
# from calculations.Foundations.FundationsApi import router as foundation_design_router
from calculations.Foundations.foundation_backend_api import (
    router as foundation_backend_router,
)

##slabs
# from calculations.Slabs.SlabApi import router as slab_design_router
from calculations.Slabs.slab_calculator_backend import router as slab_backend_router


##retaining
from calculations.Retaining.eurocode_backend import router as retaining_eurocode_router
from calculations.Retaining.retaining_backend import router as retaining_backend_router


##stairs
# from calculations.Stairs.StairsApi import router as stairs_design_router
from calculations.Stairs.rc_stair_backend import router as stairs_backend_router
from calculations.Stairs.eurocode_backend import router as stairs_euro_backend_router


##walls
from calculations.Walls.eurocode_wall import router as walls_eurodesign_router
from calculations.Walls.wall_calc_backend import router as walls_bsdesign_router


##beam
# app.include_router(beam_design_router, prefix="/beam", tags=["Beam_designs"])
# Expose beam analysis routes exactly as declared in `calculations.Beams.main_beam_api`
# This module's router defines paths like `/three_analysis/...` and
# `/moment_distribution/...`, so include it without adding an extra prefix.
app.include_router(beam_analysis_router)
# Also expose the same routes under /beam_analysis for frontend compatibility
app.include_router(beam_analysis_router, prefix="/beam_analysis")
# app.include_router(
#     three_mom_analysis_router, prefix="/three_analysis", tags=["three_analysis"]
# )
####Foundation
# app.include_router(beam_record_router, prefix="/beam_records", tags=["Beam_records"])
# app.include_router(
#     foundation_design_router, prefix="/foundation", tags=["Foundation_designs"]
# )
app.include_router(
    foundation_backend_router, prefix="/foundation_bakend", tags=["Foundation_backend"]
)

###walls
app.include_router(walls_bsdesign_router, prefix="/BS_walls", tags=["walls_designs"])
app.include_router(
    walls_eurodesign_router, prefix="/eurocode_walls", tags=["walls_designs"]
)


##retaining
app.include_router(
    retaining_eurocode_router, prefix="/retaining_eurocode", tags=["retaining_designs"]
)
app.include_router(
    retaining_backend_router, prefix="/retaining_backend", tags=["retaining_backend"]
)

##stairs
# app.include_router(stairs_design_router, prefix="/stairs", tags=["stairs_designs"])
app.include_router(
    stairs_backend_router, prefix="/stair_backend", tags=["stairs__backend"]
)
app.include_router(
    stairs_euro_backend_router,
    prefix="/stair_euro_backend",
    tags=["stairs_euro_backend"],
)


##column
# app.include_router(column_design_router, prefix="/column", tags=["Column_designs"])
app.include_router(
    column_interaction_router, prefix="/column_interaction", tags=["Column_interaction"]
)
# app.include_router(column_design_router, prefix="/column", tags=["Column_designs"])

##slabs
# app.include_router(slab_design_router, prefix="/slabs", tags=["slabs_designs"])
app.include_router(slab_backend_router, prefix="/slab_backend", tags=["slabs_backend"])

##################################


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
