from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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


app.include_router(
    QuantitySurvey_backend_router, prefix="/qs_router", tags=["qs_router"]
)
app.include_router(ManholesRouter, prefix="/manholes_router", tags=["manholes_router"])
app.include_router(
    ExternalWorksRouter, prefix="/exteral_works", tags=["manholes_router"]
)
app.include_router(RoofWorksRouter, prefix="/roof_router", tags=["roof_router"])
app.include_router(septicRouter, prefix="/septicRouter", tags=["septic_Router"])
app.include_router(swimming_pool_router, prefix="/swimming_pool_router", tags=["swimming_pool_router"])
app.include_router(basement_router, prefix="/basement_router", tags=["basement_router"])
app.include_router(Door_window_router, prefix="/Door_window_router", tags=["Door_windowrouter"])

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
app.include_router(
    beam_analysis_router, prefix="/beam_analysis", tags=["Beam_analysis"]
)
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
