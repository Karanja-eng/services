"""
Soil Mechanics API Router
Complete endpoints for all subsystems + Advanced Features
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io
from .schemas import *
from .calculations import *
from .atterberg import *
from .proctor import *
from .strength import *
from .bearing__setlement import *
from .bishop import *
from .advanced_methods import analyze_slope_janbu, analyze_slope_spencer, compare_methods
from .pdf_generator import generate_report_pdf
from .excel_generator import export_to_excel
from .models import SoilDatabase, TestType

router = APIRouter(prefix="/soil", tags=["Soil Mechanics"])

# Initialize database (singleton pattern recommended in production)
db = SoilDatabase()


# ==================== PHASE RELATIONSHIPS ====================

@router.post("/phase/moisture", response_model=MoistureContentResponse)
async def calculate_moisture(req: MoistureContentRequest):
    """Calculate moisture content from wet and dry masses"""
    try:
        w = calculate_moisture_content(req.mass_wet, req.mass_dry)
        return MoistureContentResponse(
            moisture_content=w,
            formula="w = (M_wet - M_dry) / M_dry × 100%"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/phase/unit-weights", response_model=UnitWeightsResponse)
async def calculate_weights(req: UnitWeightsRequest):
    """Calculate all unit weights from basic measurements"""
    try:
        result = calculate_unit_weights(
            req.mass_total,
            req.volume,
            req.moisture_content,
            req.specific_gravity
        )
        return UnitWeightsResponse(
            gamma_bulk=result["gamma_bulk"],
            gamma_dry=result["gamma_dry"],
            gamma_sat=result["gamma_sat"],
            gamma_submerged=result["gamma_submerged"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/phase/void-ratio", response_model=VoidRatioResponse)
async def calculate_void_ratio_endpoint(req: VoidRatioRequest):
    """Calculate void ratio and porosity"""
    try:
        result = calculate_void_ratio(req.void_volume, req.solid_volume)
        return VoidRatioResponse(
            void_ratio=result["void_ratio"],
            porosity=result["porosity"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/phase/saturation", response_model=SaturationResponse)
async def calculate_saturation_endpoint(req: SaturationRequest):
    """Calculate degree of saturation"""
    try:
        Sr = calculate_saturation(req.water_volume, req.void_volume)
        return SaturationResponse(degree_of_saturation=Sr)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/phase/zav", response_model=ZAVResponse)
async def calculate_zav_curve(req: ZAVRequest):
    """Generate Zero Air Voids curve"""
    try:
        result = calculate_zero_air_voids_curve(
            req.specific_gravity,
            req.moisture_range[0],
            req.moisture_range[1],
            req.num_points
        )
        return ZAVResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== ATTERBERG LIMITS ====================

@router.post("/index/atterberg", response_model=AtterbergResponse)
async def analyze_atterberg(req: AtterbergRequest):
    """Classify soil using Atterberg limits (USCS)"""
    try:
        result = classify_soil_uscs(req.liquid_limit, req.plastic_limit)
        return AtterbergResponse(
            liquid_limit=result["liquid_limit"],
            plastic_limit=result["plastic_limit"],
            plasticity_index=result["plasticity_index"],
            classification=result["uscs_symbol"],
            description=result["description"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/index/plasticity-chart")
async def get_plasticity_chart():
    """Get Casagrande plasticity chart data (A-line, U-line)"""
    try:
        return generate_plasticity_chart_data()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== COMPACTION ====================

@router.post("/compaction/proctor", response_model=ProctorResponse)
async def analyze_proctor(req: ProctorRequest):
    """Analyze Proctor compaction test (Standard or Modified)"""
    try:
        data_points = [dp.model_dump() for dp in req.data_points]
        result = analyze_proctor_test(data_points, req.specific_gravity, req.test_type)
        return ProctorResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/compaction/field-density", response_model=FieldDensityResponse)
async def check_field_density(req: FieldDensityRequest):
    """Check field compaction against specification"""
    try:
        result = check_field_compaction(req.field_dry_density, req.maximum_dry_density)
        return FieldDensityResponse(
            relative_compaction=result["relative_compaction"],
            status=result["status"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== SHEAR STRENGTH ====================

@router.post("/shear/direct-shear", response_model=DirectShearResponse)
async def analyze_direct_shear_test(req: DirectShearRequest):
    """Analyze direct shear test data"""
    try:
        result = analyze_direct_shear(req.normal_stresses, req.shear_stresses)
        return DirectShearResponse(
            cohesion=result["cohesion"],
            friction_angle=result["friction_angle"],
            r_squared=result["r_squared"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/shear/triaxial", response_model=TriaxialResponse)
async def analyze_triaxial_test(req: TriaxialRequest):
    """Analyze triaxial test data (UU, CU, CD)"""
    try:
        result = analyze_triaxial_test(
            req.confining_pressures,
            req.deviator_stresses,
            req.pore_pressures,
            req.test_type
        )
        return TriaxialResponse(
            cohesion=result["cohesion"],
            friction_angle=result["friction_angle"],
            r_squared=result["r_squared"],
            test_type=result["test_type"],
            effective_stress_path=result["effective_stress"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== CONSOLIDATION ====================

@router.post("/consolidation/analysis")
async def analyze_consolidation(req: ConsolidationRequest):
    """Analyze consolidation test (Cc, Cr, σ'p)"""
    try:
        result = calculate_compression_index(req.void_ratios, req.stresses)
        return ConsolidationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/consolidation/settlement", response_model=SettlementResponse)
async def calculate_settlement_endpoint(req: SettlementRequest):
    """Calculate primary consolidation settlement"""
    try:
        result = calculate_primary_settlement(
            req.initial_thickness,
            req.initial_void_ratio,
            req.compression_index,
            req.initial_stress,
            req.final_stress
        )
        return SettlementResponse(
            primary_settlement=result["primary_settlement"],
            settlement_ratio=result["settlement_ratio"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/consolidation/time-rate")
async def calculate_time_rate(Cv: float, H_drainage: float, time_days: List[float]):
    """Calculate degree of consolidation vs time"""
    try:
        result = calculate_time_rate_of_consolidation(Cv, H_drainage, time_days)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== BEARING CAPACITY ====================

@router.post("/bearing/calculate", response_model=BearingCapacityResponse)
async def calculate_bearing(req: BearingCapacityRequest):
    """Calculate ultimate and allowable bearing capacity"""
    try:
        if req.method == "terzaghi":
            result = calculate_terzaghi_bearing_capacity(
                req.cohesion, req.friction_angle, req.unit_weight,
                req.width, req.depth, req.shape
            )
        else:
            result = calculate_meyerhof_bearing_capacity(
                req.cohesion, req.friction_angle, req.unit_weight,
                req.width, req.depth, req.shape
            )
        
        q_ult = result["ultimate_bearing_capacity"]
        allowable_result = calculate_allowable_bearing_capacity(q_ult, req.factor_of_safety)
        
        return BearingCapacityResponse(
            ultimate_bearing_capacity=q_ult,
            allowable_bearing_capacity=allowable_result["allowable_bearing_capacity"],
            bearing_capacity_factors=result["bearing_factors"],
            method=result["method"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== SLOPE STABILITY ====================

@router.post("/slope/bishop", response_model=SlopeStabilityResponse)
async def analyze_slope(req: SlopeStabilityRequest):
    """Analyze slope stability using Simplified Bishop method"""
    try:
        result = analyze_slope_stability_bishop(
            req.slope_height,
            req.slope_angle,
            req.unit_weight,
            req.cohesion,
            req.friction_angle,
            water_table_depth=req.water_table_depth
        )
        return SlopeStabilityResponse(
            factor_of_safety=result["factor_of_safety"],
            critical_circle_center=result["critical_circle_center"],
            critical_circle_radius=result["critical_circle_radius"],
            status=result["status"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/slope/janbu")
async def analyze_slope_janbu_endpoint(req: SlopeStabilityRequest):
    """Analyze slope stability using Janbu Simplified method"""
    try:
        result = analyze_slope_janbu(
            req.slope_height,
            req.slope_angle,
            req.unit_weight,
            req.cohesion,
            req.friction_angle,
            water_table_depth=req.water_table_depth
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/slope/spencer")
async def analyze_slope_spencer_endpoint(req: SlopeStabilityRequest):
    """Analyze slope stability using Spencer method (rigorous)"""
    try:
        result = analyze_slope_spencer(
            req.slope_height,
            req.slope_angle,
            req.unit_weight,
            req.cohesion,
            req.friction_angle,
            water_table_depth=req.water_table_depth
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/slope/compare-methods")
async def compare_slope_methods(req: SlopeStabilityRequest):
    """Compare Bishop, Janbu, and Spencer methods"""
    try:
        result = compare_methods(
            req.slope_height,
            req.slope_angle,
            req.unit_weight,
            req.cohesion,
            req.friction_angle,
            req.water_table_depth
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== UTILITY ENDPOINTS ====================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "module": "Soil Mechanics",
        "version": "2.0.0",
        "features": [
            "Phase Relationships",
            "Atterberg Limits",
            "Compaction Analysis",
            "Shear Strength",
            "Consolidation",
            "Bearing Capacity",
            "Slope Stability (Bishop, Janbu, Spencer)",
            "PDF Reports",
            "Excel Export",
            "Database Integration"
        ]
    }


# ==================== EXPORT & REPORTS ====================

@router.post("/export/pdf")
async def export_pdf_report(project_info: dict, test_results: dict):
    """
    Generate professional PDF geotechnical report
    
    Request body:
    {
        "project_info": {
            "project_name": "...",
            "project_no": "...",
            "client": "...",
            ...
        },
        "test_results": {
            "phase": {...},
            "atterberg": {...},
            ...
        }
    }
    """
    try:
        pdf_bytes = generate_report_pdf(project_info, test_results)
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=geotechnical_report_{project_info.get('project_no', 'report')}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@router.post("/export/excel")
async def export_excel_workbook(project_info: dict, test_results: dict):
    """
    Generate Excel workbook with calculation sheets
    
    Same request format as PDF export
    """
    try:
        excel_bytes = export_to_excel(project_info, test_results)
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=soil_mechanics_{project_info.get('project_no', 'data')}.xlsx"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")


# ==================== DATABASE OPERATIONS ====================

@router.post("/database/project")
async def create_project(
    project_number: str,
    project_name: str,
    client_name: str = None,
    location: str = None,
    engineer_name: str = None
):
    """Create new project in database"""
    try:
        project = db.create_project(
            project_number=project_number,
            project_name=project_name,
            client_name=client_name,
            location=location,
            engineer_name=engineer_name
        )
        return {
            "id": project.id,
            "project_number": project.project_number,
            "message": "Project created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/database/projects")
async def get_all_projects():
    """Get all active projects"""
    try:
        projects = db.get_all_projects()
        return [
            {
                "id": p.id,
                "project_number": p.project_number,
                "project_name": p.project_name,
                "client_name": p.client_name,
                "location": p.location,
                "created_at": p.created_at.isoformat() if p.created_at else None
            }
            for p in projects
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/database/save-test")
async def save_test_result(
    project_id: int,
    sample_id: int,
    test_type: str,
    results: dict
):
    """Save laboratory test result to database"""
    try:
        # Map test_type string to enum
        test_type_enum = TestType(test_type)
        
        test = db.save_test_result(
            project_id=project_id,
            sample_id=sample_id,
            test_type=test_type_enum,
            results=results
        )
        return {
            "id": test.id,
            "message": "Test result saved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/database/project/{project_id}/tests")
async def get_project_tests(project_id: int, test_type: str = None):
    """Get all tests for a project"""
    try:
        test_type_enum = TestType(test_type) if test_type else None
        tests = db.get_project_tests(project_id, test_type_enum)
        
        return [
            {
                "id": t.id,
                "test_type": t.test_type.value,
                "test_date": t.test_date.isoformat() if t.test_date else None,
                "results": t.results
            }
            for t in tests
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))