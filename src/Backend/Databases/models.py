"""
Unified Database Models
All database models for the Services application in one file
"""

from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from Databases.config import Base


# ============================================================================
# BASE MIXIN
# ============================================================================

class TimestampMixin:
    """Mixin to add timestamp fields to models"""
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ============================================================================
# SURVEYING MODELS
# ============================================================================

class LevellingCalculation(Base, TimestampMixin):
    """Store levelling calculations (Rise & Fall / HoC method)"""
    __tablename__ = "levelling_calculations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    # Input data
    method = Column(String(20), nullable=False)  # 'rise_fall' or 'hoc'
    benchmark_rl = Column(Float, nullable=False)
    rows_data = Column(JSONB, nullable=False)  # Array of levelling rows
    
    # Results
    calculated_rows = Column(JSONB, nullable=False)
    arithmetic_checks = Column(JSONB, nullable=False)
    is_valid = Column(Boolean, nullable=False)


class TraverseCalculation(Base, TimestampMixin):
    """Store traverse calculations (Bowditch method)"""
    __tablename__ = "traverse_calculations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    # Input data
    start_easting = Column(Float, nullable=False)
    start_northing = Column(Float, nullable=False)
    stations_data = Column(JSONB, nullable=False)  # Array of stations
    
    # Results
    calculated_stations = Column(JSONB, nullable=False)
    closure_error = Column(Float, nullable=False)
    relative_accuracy = Column(String(50))


class TacheometryCalculation(Base, TimestampMixin):
    """Store tacheometry calculations"""
    __tablename__ = "tacheometry_calculations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    # Input data
    upper_stadia = Column(Float, nullable=False)
    lower_stadia = Column(Float, nullable=False)
    central_hair = Column(Float, nullable=False)
    vertical_angle = Column(Float, nullable=False)
    k_constant = Column(Float, default=100.0)
    c_constant = Column(Float, default=0.0)
    instrument_height = Column(Float)
    
    # Results
    staff_intercept = Column(Float)
    horizontal_distance = Column(Float)
    vertical_distance = Column(Float)
    slope_distance = Column(Float)
    reduced_level_diff = Column(Float)


class SewerDesign(Base, TimestampMixin):
    """Store sewer design calculations"""
    __tablename__ = "sewer_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    # Input data
    manholes_data = Column(JSONB, nullable=False)
    pipe_diameter = Column(Float)
    roughness_coeff = Column(Float)
    
    # Results
    calculated_manholes = Column(JSONB, nullable=False)
    design_checks = Column(JSONB)
    flow_capacity = Column(Float)


class ContouringData(Base, TimestampMixin):
    """Store contouring calculations"""
    __tablename__ = "contouring_data"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    # Input data
    grid_data = Column(JSONB, nullable=False)
    contour_interval = Column(Float, nullable=False)
    grid_size = Column(Integer, nullable=False)
    
    # Results
    contours = Column(JSONB, nullable=False)
    min_elevation = Column(Float)
    max_elevation = Column(Float)


# ============================================================================
# QUANTITY SURVEYING MODELS
# ============================================================================

class QuantitySurveyCalculation(Base, TimestampMixin):
    """Store general QS calculations (stairs, foundations, etc.)"""
    __tablename__ = "qs_calculations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    calculation_type = Column(String(50), nullable=False)  # 'stairs', 'foundation', etc.
    input_data = Column(JSONB, nullable=False)
    
    # Results
    items = Column(JSONB, nullable=False)
    summary = Column(JSONB, nullable=False)
    total_cost = Column(Float)


class ManholeTakeoff(Base, TimestampMixin):
    """Store manhole and drainage takeoff calculations"""
    __tablename__ = "manhole_takeoffs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    project_name = Column(String(200), nullable=False)
    
    # Input data
    veg_depth = Column(Float)
    has_rock = Column(Boolean, default=False)
    rock_start_depth = Column(Float)
    has_planking = Column(Boolean, default=False)
    ground_is_level = Column(Boolean, default=True)
    site_clearance_area = Column(Float)
    boundary_area = Column(Float)
    road_reinstatement_area = Column(Float)
    pavement_reinstatement_area = Column(Float)
    
    manholes_data = Column(JSONB, nullable=False)
    pipes_data = Column(JSONB, nullable=False)
    
    # Results
    manhole_quantities = Column(JSONB, nullable=False)
    pipe_quantities = Column(JSONB, nullable=False)
    total_quantities = Column(JSONB, nullable=False)
    boq_items = Column(JSONB, nullable=False)


class ExternalWorksTakeoff(Base, TimestampMixin):
    """Store external works calculations"""
    __tablename__ = "external_works_takeoffs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


class RoofTakeoff(Base, TimestampMixin):
    """Store roof calculations"""
    __tablename__ = "roof_takeoffs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


class SepticTankDesign(Base, TimestampMixin):
    """Store septic tank calculations"""
    __tablename__ = "septic_tank_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


class SwimmingPoolDesign(Base, TimestampMixin):
    """Store swimming pool calculations"""
    __tablename__ = "swimming_pool_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


class BasementDesign(Base, TimestampMixin):
    """Store basement calculations"""
    __tablename__ = "basement_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


class DoorWindowSchedule(Base, TimestampMixin):
    """Store door and window calculations"""
    __tablename__ = "door_window_schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


class UndergroundTankDesign(Base, TimestampMixin):
    """Store underground tank calculations"""
    __tablename__ = "underground_tank_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


# ============================================================================
# STEEL DESIGN MODELS
# ============================================================================

class WeldedJointDesign(Base, TimestampMixin):
    """Store welded joint calculations"""
    __tablename__ = "welded_joint_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    joint_type = Column(String(50), nullable=False)  # 'fillet', 'butt', 'lap', 'tee'
    
    # Input data
    input_data = Column(JSONB, nullable=False)
    
    # Results
    design_strength = Column(Float)
    capacity = Column(Float)
    utilization_ratio = Column(Float)
    status = Column(String(20))
    results = Column(JSONB, nullable=False)


class BoltedConnectionDesign(Base, TimestampMixin):
    """Store bolted connection calculations"""
    __tablename__ = "bolted_connection_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    connection_type = Column(String(50), nullable=False)  # 'ordinary', 'hsfg', 'bolt_group'
    
    # Input data
    input_data = Column(JSONB, nullable=False)
    
    # Results
    shear_capacity = Column(Float)
    tension_capacity = Column(Float)
    bearing_capacity = Column(Float)
    utilization_ratio = Column(Float)
    status = Column(String(20))
    results = Column(JSONB, nullable=False)


class SteelMemberDesign(Base, TimestampMixin):
    """Store general steel member design"""
    __tablename__ = "steel_member_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    member_type = Column(String(50), nullable=False)
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


# ============================================================================
# RC DESIGN - BEAMS
# ============================================================================

class BeamAnalysis(Base, TimestampMixin):
    """Store beam analysis calculations"""
    __tablename__ = "beam_analyses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    analysis_method = Column(String(50), nullable=False)  # 'three_moment', 'moment_distribution'
    
    # Input data
    input_data = Column(JSONB, nullable=False)
    
    # Results
    support_moments = Column(JSONB)
    shear_forces = Column(JSONB)
    reactions = Column(JSONB)
    results = Column(JSONB, nullable=False)


class BeamDesign(Base, TimestampMixin):
    """Store beam design calculations (BS 8110)"""
    __tablename__ = "beam_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    # Input data
    input_data = Column(JSONB, nullable=False)
    
    # Results
    main_reinforcement = Column(String(200))
    shear_reinforcement = Column(String(200))
    design_checks = Column(JSONB)
    utilization_ratio = Column(Float)
    status = Column(String(20))
    results = Column(JSONB, nullable=False)


# ============================================================================
# RC DESIGN - COLUMNS
# ============================================================================

class ColumnDesign(Base, TimestampMixin):
    """Store column interaction diagram and design"""
    __tablename__ = "column_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    design_mode = Column(String(20), nullable=False)  # 'uniaxial' or 'biaxial'
    
    # Dimensions
    width = Column(Float, nullable=False)  # b
    height = Column(Float, nullable=False)  # h
    cover = Column(Float)
    
    # Loads
    axial_load = Column(Float, nullable=False)  # N
    moment_x = Column(Float)  # M or Mx
    moment_y = Column(Float)  # My
    
    # Results
    steel_percentage = Column(Float)
    steel_area = Column(Float)
    bar_diameter = Column(Integer)
    num_bars = Column(Integer)
    bar_distribution = Column(JSONB)
    utilization_ratio = Column(Float)
    status = Column(String(20))
    
    # Full results
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


# ============================================================================
# RC DESIGN - FOUNDATIONS
# ============================================================================

class FoundationDesign(Base, TimestampMixin):
    """Store foundation design calculations"""
    __tablename__ = "foundation_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    foundation_type = Column(String(50), nullable=False)  # 'pad', 'strip', 'pile', 'pilecap'
    
    # Input data
    dead_load = Column(Float, nullable=False)
    live_load = Column(Float, nullable=False)
    wind_load = Column(Float)
    moment_x = Column(Float)
    moment_y = Column(Float)
    soil_bearing = Column(Float, nullable=False)
    
    # Dimensions
    foundation_length = Column(Float)
    foundation_width = Column(Float)
    foundation_depth = Column(Float)
    
    # Results
    bearing_pressure = Column(Float)
    punching_shear_ratio = Column(Float)
    beam_shear_ratio = Column(Float)
    main_reinforcement_x = Column(String(200))
    main_reinforcement_y = Column(String(200))
    utilization_ratio = Column(Float)
    status = Column(String(20))
    
    # Full data
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


# ============================================================================
# RC DESIGN - SLABS
# ============================================================================

class SlabDesign(Base, TimestampMixin):
    """Store slab design calculations"""
    __tablename__ = "slab_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    design_code = Column(String(20))  # 'BS8110', 'Eurocode'
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


# ============================================================================
# RC DESIGN - RETAINING WALLS
# ============================================================================

class RetainingWallDesign(Base, TimestampMixin):
    """Store retaining wall design calculations"""
    __tablename__ = "retaining_wall_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    design_code = Column(String(20))  # 'BS8110', 'Eurocode'
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


# ============================================================================
# RC DESIGN - STAIRS
# ============================================================================

class StairDesign(Base, TimestampMixin):
    """Store stair design calculations"""
    __tablename__ = "stair_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    design_code = Column(String(20))  # 'BS8110', 'Eurocode'
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)


# ============================================================================
# RC DESIGN - WALLS
# ============================================================================

class WallDesign(Base, TimestampMixin):
    """Store wall design calculations"""
    __tablename__ = "wall_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), index=True)
    project_id = Column(String(100), index=True)
    
    design_code = Column(String(20))  # 'BS8110', 'Eurocode'
    
    input_data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)
