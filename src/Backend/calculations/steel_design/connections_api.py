"""
FastAPI Endpoints for Welded Joints and Bolted Connections
Add these endpoints to your main FastAPI application
"""

from fastapi import APIRouter, HTTPException
from .welded_joints_backend import (
    FilletWeldRequest,
    ButtWeldRequest,
    LapJointRequest,
    TeeJointRequest,
    design_fillet_weld,
    design_butt_weld,
    design_lap_joint,
    design_tee_joint,
    minimum_fillet_weld_size,
    maximum_fillet_weld_size,
)
from .bolted_connections_backend import (
    BoltedConnectionRequest,
    HsfgBoltRequest,
    BoltGroupRequest,
    design_bolted_connection,
    design_hsfg_bolt,
    analyze_bolt_group,
    minimum_bolt_spacing,
    minimum_edge_distance,
    maximum_bolt_spacing,
    maximum_edge_distance,
    STANDARD_BOLT_DIAMETERS,
)

router = APIRouter()
# Create routers
# welded_router = APIRouter(prefix="/api/welded-joints", tags=["Welded Joints"])
# bolted_router = APIRouter(prefix="/api/bolted-connections", tags=["Bolted Connections"])

# ============================================================================
# WELDED JOINTS ENDPOINTS
# ============================================================================


@router.post("/fillet-weld")
async def calculate_fillet_weld(request: FilletWeldRequest):
    """
    Design fillet weld according to BS 5950-1:2000 Cl 6.9

    **Parameters:**
    - throat_size: Effective throat thickness (mm)
    - weld_length: Effective weld length (mm)
    - longitudinal_force: Force parallel to weld (kN)
    - transverse_force: Force perpendicular to weld (kN)
    - electrode_grade: E35, E42, or E51
    - parent_steel_grade: S275, S355, or S450
    - position: longitudinal or transverse

    **Returns:**
    - Design strength, capacities, and utilization ratios
    """
    try:
        result = design_fillet_weld(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/butt-weld")
async def calculate_butt_weld(request: ButtWeldRequest):
    """
    Design butt weld according to BS 5950-1:2000 Cl 6.9.4

    **Full penetration butt welds:** Designed as parent material
    **Partial penetration butt welds:** Use throat thickness
    """
    try:
        result = design_butt_weld(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/lap-joint")
async def calculate_lap_joint(request: LapJointRequest):
    """
    Design lap joint with double fillet welds

    Considers:
    - Direct shear stress
    - Moment induced stress from eccentricity
    """
    try:
        result = design_lap_joint(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tee-joint")
async def calculate_tee_joint(request: TeeJointRequest):
    """
    Design T-joint or cruciform joint with fillet welds

    Handles:
    - Vertical and horizontal loads
    - Applied moments
    """
    try:
        result = design_tee_joint(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/weld-size-limits/{plate_thickness}")
async def get_weld_size_limits(plate_thickness: float):
    """
    Get minimum and maximum fillet weld sizes for given plate thickness
    Based on BS 5950 Table 37
    """
    min_size = minimum_fillet_weld_size(plate_thickness)
    max_size = maximum_fillet_weld_size(plate_thickness)

    return {
        "plate_thickness": plate_thickness,
        "minimum_weld_size": min_size,
        "maximum_weld_size": max_size,
        "recommended_size": round((min_size + max_size) / 2, 1),
    }


@router.get("/electrode-grades")
async def get_electrode_grades():
    """Get available electrode grades and their properties"""
    return {
        "E35": {"ultimate_strength": 350, "description": "Low strength electrode"},
        "E42": {"ultimate_strength": 420, "description": "Medium strength electrode"},
        "E51": {"ultimate_strength": 510, "description": "High strength electrode"},
    }


# ============================================================================
# BOLTED CONNECTIONS ENDPOINTS
# ============================================================================


@router.post("/ordinary-bolts")
async def calculate_ordinary_bolts(request: BoltedConnectionRequest):
    """
    Design ordinary bolted connection according to BS 5950 Cl 6.3

    **Calculates:**
    - Shear capacity (single or double shear)
    - Tension capacity
    - Bearing capacity
    - Combined tension and shear interaction

    **Bolt Grades:**
    - 4.6: General purpose
    - 8.8: High strength
    - 10.9: Very high strength
    """
    try:
        result = design_bolted_connection(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/hsfg-bolts")
async def calculate_hsfg_bolts(request: HsfgBoltRequest):
    """
    Design High Strength Friction Grip (HSFG) bolt connection
    According to BS 5950 Cl 6.4

    **Features:**
    - Slip-critical design
    - Adjustable for surface conditions
    - Clamping force calculations
    """
    try:
        result = design_hsfg_bolt(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bolt-group")
async def calculate_bolt_group(request: BoltGroupRequest):
    """
    Analyze bolt group subjected to eccentric loading

    Uses elastic analysis to determine:
    - Bolt group centroid
    - Maximum bolt force
    - Critical bolt location
    """
    try:
        result = analyze_bolt_group(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/standard-diameters")
async def get_standard_bolt_diameters():
    """Get standard bolt diameters"""
    return {
        "standard_diameters_mm": STANDARD_BOLT_DIAMETERS,
        "recommended": [16, 20, 24],
    }


@router.get("/spacing-requirements/{diameter}")
async def get_spacing_requirements(diameter: int, plate_thickness: float = 10):
    """
    Get bolt spacing and edge distance requirements
    Based on BS 5950 Cl 6.2
    """
    if diameter not in STANDARD_BOLT_DIAMETERS:
        raise HTTPException(status_code=400, detail="Non-standard bolt diameter")

    return {
        "bolt_diameter": diameter,
        "minimum_spacing": minimum_bolt_spacing(diameter),
        "minimum_edge_distance": minimum_edge_distance(diameter),
        "maximum_spacing": maximum_bolt_spacing(plate_thickness),
        "maximum_edge_distance": maximum_edge_distance(plate_thickness),
    }


@router.get("/bolt-grades")
async def get_bolt_grades():
    """Get available bolt grades and their properties"""
    return {
        "ordinary_bolts": {
            "4.6": {"fy": 240, "fu": 400, "description": "General purpose"},
            "8.8": {"fy": 640, "fu": 800, "description": "High strength"},
            "10.9": {"fy": 900, "fu": 1000, "description": "Very high strength"},
        },
        "hsfg_bolts": {
            "HSFG_8.8": {
                "fy": 640,
                "fu": 800,
                "description": "High strength friction grip",
            },
            "HSFG_10.9": {
                "fy": 900,
                "fu": 1000,
                "description": "Very high strength friction grip",
            },
        },
    }


# ============================================================================
# HELPER ENDPOINTS
# ============================================================================


@router.get("/")
async def welded_joints_info():
    """Get information about welded joints module"""
    return {
        "module": "Welded Joints Design",
        "standard": "BS 5950-1:2000 Section 6.9",
        "weld_types": [
            "Fillet Weld",
            "Butt Weld (Full/Partial)",
            "Lap Joint",
            "T-Joint",
        ],
        "features": [
            "Design strength calculation (pw)",
            "Longitudinal and transverse capacity",
            "Eccentric loading analysis",
            "Minimum/maximum weld size recommendations",
        ],
    }


@router.get("/")
async def bolted_connections_info():
    """Get information about bolted connections module"""
    return {
        "module": "Bolted Connections Design",
        "standard": "BS 5950-1:2000 Sections 6.2-6.4",
        "connection_types": [
            "Ordinary bolts (bearing type)",
            "HSFG bolts (friction type)",
            "Eccentric bolt groups",
        ],
        "features": [
            "Shear, tension, and bearing capacity",
            "Combined loading interaction",
            "Slip resistance for HSFG bolts",
            "Spacing and edge distance checks",
        ],
    }


# ============================================================================
# Add these routers to your main FastAPI app
# ============================================================================
# In your main.py:
# from connections_api import welded_router, bolted_router
# app.include_router(welded_router)
# app.include_router(bolted_router)
