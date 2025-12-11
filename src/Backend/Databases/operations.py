"""
Database Operations
Helper functions for common database operations across all modules
"""

from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

from Databases.models import (
    # Surveying
    LevellingCalculation, TraverseCalculation, TacheometryCalculation,
    SewerDesign, ContouringData,
    # Quantity Surveying
    QuantitySurveyCalculation, ManholeTakeoff, ExternalWorksTakeoff,
    RoofTakeoff, SepticTankDesign, SwimmingPoolDesign, BasementDesign,
    DoorWindowSchedule, UndergroundTankDesign,
    # Steel Design
    WeldedJointDesign, BoltedConnectionDesign, SteelMemberDesign,
    # RC Design
    BeamAnalysis, BeamDesign, ColumnDesign, FoundationDesign,
    SlabDesign, RetainingWallDesign, StairDesign, WallDesign
)


# ============================================================================
# SURVEYING OPERATIONS
# ============================================================================

def save_levelling_calculation(
    db: Session,
    method: str,
    benchmark_rl: float,
    rows_data: List[Dict],
    calculated_rows: List[Dict],
    arithmetic_checks: Dict,
    is_valid: bool,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> LevellingCalculation:
    """Save levelling calculation to database"""
    record = LevellingCalculation(
        user_id=user_id,
        project_id=project_id,
        method=method,
        benchmark_rl=benchmark_rl,
        rows_data=rows_data,
        calculated_rows=calculated_rows,
        arithmetic_checks=arithmetic_checks,
        is_valid=is_valid
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_traverse_calculation(
    db: Session,
    start_easting: float,
    start_northing: float,
    stations_data: List[Dict],
    calculated_stations: List[Dict],
    closure_error: float,
    relative_accuracy: str,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> TraverseCalculation:
    """Save traverse calculation to database"""
    record = TraverseCalculation(
        user_id=user_id,
        project_id=project_id,
        start_easting=start_easting,
        start_northing=start_northing,
        stations_data=stations_data,
        calculated_stations=calculated_stations,
        closure_error=closure_error,
        relative_accuracy=relative_accuracy
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_tacheometry_calculation(
    db: Session,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> TacheometryCalculation:
    """Save tacheometry calculation to database"""
    record = TacheometryCalculation(
        user_id=user_id,
        project_id=project_id,
        upper_stadia=input_data.get('upper_stadia'),
        lower_stadia=input_data.get('lower_stadia'),
        central_hair=input_data.get('central_hair'),
        vertical_angle=input_data.get('vertical_angle'),
        k_constant=input_data.get('k', 100.0),
        c_constant=input_data.get('c', 0.0),
        instrument_height=input_data.get('instrument_height'),
        staff_intercept=results.get('staff_intercept'),
        horizontal_distance=results.get('horizontal_distance'),
        vertical_distance=results.get('vertical_distance'),
        slope_distance=results.get('slope_distance'),
        reduced_level_diff=results.get('reduced_level_diff')
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_sewer_design(
    db: Session,
    manholes_data: List[Dict],
    calculated_manholes: List[Dict],
    design_checks: List[str],
    flow_capacity: Optional[float] = None,
    pipe_diameter: Optional[float] = None,
    roughness_coeff: Optional[float] = None,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> SewerDesign:
    """Save sewer design to database"""
    record = SewerDesign(
        user_id=user_id,
        project_id=project_id,
        manholes_data=manholes_data,
        pipe_diameter=pipe_diameter,
        roughness_coeff=roughness_coeff,
        calculated_manholes=calculated_manholes,
        design_checks=design_checks,
        flow_capacity=flow_capacity
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_contouring_data(
    db: Session,
    grid_data: List[Dict],
    contour_interval: float,
    grid_size: int,
    contours: List[Dict],
    min_elevation: float,
    max_elevation: float,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> ContouringData:
    """Save contouring data to database"""
    record = ContouringData(
        user_id=user_id,
        project_id=project_id,
        grid_data=grid_data,
        contour_interval=contour_interval,
        grid_size=grid_size,
        contours=contours,
        min_elevation=min_elevation,
        max_elevation=max_elevation
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ============================================================================
# QUANTITY SURVEYING OPERATIONS
# ============================================================================

def save_qs_calculation(
    db: Session,
    calculation_type: str,
    input_data: Dict,
    items: List[Dict],
    summary: Dict,
    total_cost: Optional[float] = None,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> QuantitySurveyCalculation:
    """Save general QS calculation to database"""
    record = QuantitySurveyCalculation(
        user_id=user_id,
        project_id=project_id,
        calculation_type=calculation_type,
        input_data=input_data,
        items=items,
        summary=summary,
        total_cost=total_cost
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_manhole_takeoff(
    db: Session,
    project_name: str,
    project_data: Dict,
    manhole_quantities: Dict,
    pipe_quantities: Dict,
    total_quantities: Dict,
    boq_items: List[Dict],
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> ManholeTakeoff:
    """Save manhole takeoff to database"""
    record = ManholeTakeoff(
        user_id=user_id,
        project_id=project_id,
        project_name=project_name,
        veg_depth=project_data.get('veg_depth'),
        has_rock=project_data.get('has_rock', False),
        rock_start_depth=project_data.get('rock_start_depth'),
        has_planking=project_data.get('has_planking', False),
        ground_is_level=project_data.get('ground_is_level', True),
        site_clearance_area=project_data.get('site_clearance_area'),
        boundary_area=project_data.get('boundary_area'),
        road_reinstatement_area=project_data.get('road_reinstatement_area'),
        pavement_reinstatement_area=project_data.get('pavement_reinstatement_area'),
        manholes_data=project_data.get('manholes', []),
        pipes_data=project_data.get('pipes', []),
        manhole_quantities=manhole_quantities,
        pipe_quantities=pipe_quantities,
        total_quantities=total_quantities,
        boq_items=boq_items
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_generic_takeoff(
    db: Session,
    model_class,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
):
    """Save generic takeoff calculation (external works, roof, etc.)"""
    record = model_class(
        user_id=user_id,
        project_id=project_id,
        input_data=input_data,
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ============================================================================
# STEEL DESIGN OPERATIONS
# ============================================================================

def save_welded_joint_design(
    db: Session,
    joint_type: str,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> WeldedJointDesign:
    """Save welded joint design to database"""
    record = WeldedJointDesign(
        user_id=user_id,
        project_id=project_id,
        joint_type=joint_type,
        input_data=input_data,
        design_strength=results.get('design_strength'),
        capacity=results.get('capacity'),
        utilization_ratio=results.get('utilization_ratio'),
        status=results.get('status'),
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_bolted_connection_design(
    db: Session,
    connection_type: str,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> BoltedConnectionDesign:
    """Save bolted connection design to database"""
    record = BoltedConnectionDesign(
        user_id=user_id,
        project_id=project_id,
        connection_type=connection_type,
        input_data=input_data,
        shear_capacity=results.get('shear_capacity'),
        tension_capacity=results.get('tension_capacity'),
        bearing_capacity=results.get('bearing_capacity'),
        utilization_ratio=results.get('utilization_ratio'),
        status=results.get('status'),
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_steel_member_design(
    db: Session,
    member_type: str,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> SteelMemberDesign:
    """Save steel member design to database"""
    record = SteelMemberDesign(
        user_id=user_id,
        project_id=project_id,
        member_type=member_type,
        input_data=input_data,
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ============================================================================
# RC DESIGN OPERATIONS
# ============================================================================

def save_beam_analysis(
    db: Session,
    analysis_method: str,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> BeamAnalysis:
    """Save beam analysis to database"""
    record = BeamAnalysis(
        user_id=user_id,
        project_id=project_id,
        analysis_method=analysis_method,
        input_data=input_data,
        support_moments=results.get('support_moments'),
        shear_forces=results.get('shear_forces'),
        reactions=results.get('reactions'),
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_beam_design(
    db: Session,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> BeamDesign:
    """Save beam design to database"""
    record = BeamDesign(
        user_id=user_id,
        project_id=project_id,
        input_data=input_data,
        main_reinforcement=results.get('main_reinforcement'),
        shear_reinforcement=results.get('shear_reinforcement'),
        design_checks=results.get('design_checks'),
        utilization_ratio=results.get('utilization_ratio'),
        status=results.get('status'),
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_column_design(
    db: Session,
    design_mode: str,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> ColumnDesign:
    """Save column design to database"""
    record = ColumnDesign(
        user_id=user_id,
        project_id=project_id,
        design_mode=design_mode,
        width=input_data.get('b'),
        height=input_data.get('h'),
        cover=input_data.get('cover'),
        axial_load=input_data.get('N'),
        moment_x=input_data.get('M') or input_data.get('Mx'),
        moment_y=input_data.get('My'),
        steel_percentage=results.get('steel_percentage'),
        steel_area=results.get('steel_area'),
        bar_diameter=results.get('bar_selection', {}).get('bar_dia'),
        num_bars=results.get('bar_selection', {}).get('num_bars'),
        bar_distribution=results.get('bar_selection', {}).get('distribution'),
        utilization_ratio=results.get('utilization'),
        status=results.get('status'),
        input_data=input_data,
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_foundation_design(
    db: Session,
    foundation_type: str,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> FoundationDesign:
    """Save foundation design to database"""
    load_analysis = results.get('load_analysis', {})
    design_summary = results.get('design_summary', {})
    reinforcement = results.get('reinforcement', {})
    
    record = FoundationDesign(
        user_id=user_id,
        project_id=project_id,
        foundation_type=foundation_type,
        dead_load=input_data.get('dead_load'),
        live_load=input_data.get('live_load'),
        wind_load=input_data.get('wind_load'),
        moment_x=input_data.get('moment_x'),
        moment_y=input_data.get('moment_y'),
        soil_bearing=input_data.get('soil_bearing'),
        foundation_length=input_data.get('foundation_length'),
        foundation_width=input_data.get('foundation_width'),
        foundation_depth=input_data.get('foundation_depth'),
        bearing_pressure=load_analysis.get('bearing_pressure'),
        punching_shear_ratio=results.get('calculations', {}).get('punching', {}).get('ratio'),
        beam_shear_ratio=results.get('calculations', {}).get('beam_shear', {}).get('ratio_x'),
        main_reinforcement_x=reinforcement.get('main_bars_x'),
        main_reinforcement_y=reinforcement.get('main_bars_y'),
        utilization_ratio=design_summary.get('utilization_ratio'),
        status=design_summary.get('status'),
        input_data=input_data,
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def save_generic_rc_design(
    db: Session,
    model_class,
    design_code: str,
    input_data: Dict,
    results: Dict,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None
):
    """Save generic RC design (slab, retaining wall, stair, wall)"""
    record = model_class(
        user_id=user_id,
        project_id=project_id,
        design_code=design_code,
        input_data=input_data,
        results=results
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ============================================================================
# QUERY OPERATIONS
# ============================================================================

def get_user_calculations(
    db: Session,
    model_class,
    user_id: str,
    limit: int = 50
):
    """Get recent calculations for a user"""
    return db.query(model_class).filter(
        model_class.user_id == user_id
    ).order_by(
        model_class.created_at.desc()
    ).limit(limit).all()


def get_project_calculations(
    db: Session,
    model_class,
    project_id: str
):
    """Get all calculations for a project"""
    return db.query(model_class).filter(
        model_class.project_id == project_id
    ).order_by(
        model_class.created_at.desc()
    ).all()


def get_calculation_by_id(
    db: Session,
    model_class,
    calculation_id: str
):
    """Get a specific calculation by ID"""
    return db.query(model_class).filter(
        model_class.id == calculation_id
    ).first()


def delete_calculation(
    db: Session,
    model_class,
    calculation_id: str
) -> bool:
    """Delete a calculation"""
    record = db.query(model_class).filter(
        model_class.id == calculation_id
    ).first()
    if record:
        db.delete(record)
        db.commit()
        return True
    return False
