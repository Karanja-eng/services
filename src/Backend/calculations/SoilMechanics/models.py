"""
Database Models for Soil Mechanics Module
SQLAlchemy ORM models for project data persistence
"""

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, JSON, 
    ForeignKey, Boolean, Text, Enum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()


# ==================== ENUMS ====================

class TestType(str, enum.Enum):
    MOISTURE_CONTENT = "moisture_content"
    ATTERBERG_LIMITS = "atterberg_limits"
    COMPACTION = "compaction"
    DIRECT_SHEAR = "direct_shear"
    TRIAXIAL = "triaxial"
    CONSOLIDATION = "consolidation"
    BEARING_CAPACITY = "bearing_capacity"
    SLOPE_STABILITY = "slope_stability"


class SoilClassification(str, enum.Enum):
    # Coarse-grained
    GW = "GW"  # Well-graded gravel
    GP = "GP"  # Poorly-graded gravel
    GM = "GM"  # Silty gravel
    GC = "GC"  # Clayey gravel
    SW = "SW"  # Well-graded sand
    SP = "SP"  # Poorly-graded sand
    SM = "SM"  # Silty sand
    SC = "SC"  # Clayey sand
    # Fine-grained
    ML = "ML"  # Inorganic silt
    CL = "CL"  # Inorganic clay (low plasticity)
    OL = "OL"  # Organic silt/clay
    MH = "MH"  # Inorganic silt (high plasticity)
    CH = "CH"  # Inorganic clay (high plasticity)
    OH = "OH"  # Organic clay
    PT = "PT"  # Peat


# ==================== MODELS ====================

class Project(Base):
    """Main project table"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    project_number = Column(String(50), unique=True, nullable=False, index=True)
    project_name = Column(String(200), nullable=False)
    client_name = Column(String(200))
    location = Column(String(500))
    coordinates_lat = Column(Float)
    coordinates_lon = Column(Float)
    project_type = Column(String(100))  # Building, Road, Slope, etc.
    description = Column(Text)
    
    # Dates
    start_date = Column(DateTime, default=datetime.utcnow)
    completion_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Engineer info
    engineer_name = Column(String(200))
    engineer_license = Column(String(50))
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Relationships
    soil_samples = relationship("SoilSample", back_populates="project", cascade="all, delete-orphan")
    borings = relationship("Boring", back_populates="project", cascade="all, delete-orphan")
    tests = relationship("LaboratoryTest", back_populates="project", cascade="all, delete-orphan")
    analyses = relationship("EngineeringAnalysis", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project {self.project_number}: {self.project_name}>"


class Boring(Base):
    """Boring/test pit locations"""
    __tablename__ = "borings"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    boring_number = Column(String(50), nullable=False)
    boring_type = Column(String(50))  # Auger, SPT, CPT, Test Pit
    
    # Location
    northing = Column(Float)
    easting = Column(Float)
    elevation = Column(Float)
    
    # Depth info
    total_depth = Column(Float)  # meters
    water_table_depth = Column(Float, nullable=True)  # meters
    
    # Dates
    boring_date = Column(DateTime)
    
    # Field notes
    field_notes = Column(Text)
    driller = Column(String(100))
    
    # Relationships
    project = relationship("Project", back_populates="borings")
    soil_samples = relationship("SoilSample", back_populates="boring", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Boring {self.boring_number} - Depth: {self.total_depth}m>"


class SoilSample(Base):
    """Individual soil samples from borings"""
    __tablename__ = "soil_samples"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    boring_id = Column(Integer, ForeignKey("borings.id"), nullable=False)
    
    sample_number = Column(String(50), nullable=False)
    depth_from = Column(Float, nullable=False)  # meters
    depth_to = Column(Float, nullable=False)
    
    # Visual classification
    visual_description = Column(Text)
    uscs_classification = Column(Enum(SoilClassification), nullable=True)
    
    # Basic properties
    moisture_content = Column(Float, nullable=True)  # %
    specific_gravity = Column(Float, nullable=True)
    
    # SPT data
    spt_n_value = Column(Integer, nullable=True)
    
    # Sample quality
    recovery_percent = Column(Float, nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="soil_samples")
    boring = relationship("Boring", back_populates="soil_samples")
    tests = relationship("LaboratoryTest", back_populates="sample", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Sample {self.sample_number} @ {self.depth_from}-{self.depth_to}m>"


class LaboratoryTest(Base):
    """Laboratory test results"""
    __tablename__ = "laboratory_tests"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    sample_id = Column(Integer, ForeignKey("soil_samples.id"), nullable=False)
    
    test_type = Column(Enum(TestType), nullable=False)
    test_date = Column(DateTime, default=datetime.utcnow)
    tested_by = Column(String(100))
    
    # Test standard
    test_standard = Column(String(50))  # ASTM D2216, etc.
    
    # Store all results as JSON for flexibility
    results = Column(JSON, nullable=False)
    
    # Quality indicators
    is_valid = Column(Boolean, default=True)
    qa_notes = Column(Text)
    
    # Relationships
    project = relationship("Project", back_populates="tests")
    sample = relationship("SoilSample", back_populates="tests")
    
    def __repr__(self):
        return f"<Test {self.test_type.value} - Sample {self.sample_id}>"


class EngineeringAnalysis(Base):
    """Engineering analyses and design calculations"""
    __tablename__ = "engineering_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    analysis_type = Column(String(100), nullable=False)  # Bearing, Settlement, Slope
    analysis_name = Column(String(200))
    
    # Input parameters (JSON)
    input_parameters = Column(JSON, nullable=False)
    
    # Results (JSON)
    results = Column(JSON, nullable=False)
    
    # Analysis metadata
    method_used = Column(String(100))  # Terzaghi, Bishop, etc.
    design_code = Column(String(50))
    factor_of_safety = Column(Float)
    
    # Status
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String(100))
    approval_date = Column(DateTime)
    
    # Dates
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Notes
    engineering_notes = Column(Text)
    
    # Relationships
    project = relationship("Project", back_populates="analyses")
    
    def __repr__(self):
        return f"<Analysis {self.analysis_type}: {self.analysis_name}>"


class SoilLayer(Base):
    """Soil stratification/layering for site profile"""
    __tablename__ = "soil_layers"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    layer_number = Column(Integer, nullable=False)
    depth_from = Column(Float, nullable=False)  # meters
    depth_to = Column(Float, nullable=False)
    
    # Soil properties
    uscs_classification = Column(Enum(SoilClassification))
    description = Column(Text)
    
    # Average properties for layer
    unit_weight = Column(Float)  # kN/m³
    cohesion = Column(Float)  # kPa
    friction_angle = Column(Float)  # degrees
    
    # Compressibility
    compression_index = Column(Float)
    coefficient_of_consolidation = Column(Float)  # m²/s
    
    # Color for visualization
    color_hex = Column(String(7))  # #RRGGBB
    
    def __repr__(self):
        return f"<Layer {self.layer_number}: {self.depth_from}-{self.depth_to}m>"


# ==================== DATABASE OPERATIONS ====================

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import List, Optional, Dict


class SoilDatabase:
    """Database operations wrapper"""
    
    def __init__(self, database_url: str = "sqlite:///soil_mechanics.db"):
        self.engine = create_engine(database_url, echo=False)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
    
    def get_session(self) -> Session:
        """Get database session"""
        return self.SessionLocal()
    
    # ========== PROJECT OPERATIONS ==========
    
    def create_project(self, **kwargs) -> Project:
        """Create new project"""
        session = self.get_session()
        try:
            project = Project(**kwargs)
            session.add(project)
            session.commit()
            session.refresh(project)
            return project
        finally:
            session.close()
    
    def get_project(self, project_id: int) -> Optional[Project]:
        """Get project by ID"""
        session = self.get_session()
        try:
            return session.query(Project).filter(Project.id == project_id).first()
        finally:
            session.close()
    
    def get_all_projects(self) -> List[Project]:
        """Get all active projects"""
        session = self.get_session()
        try:
            return session.query(Project).filter(Project.is_active == True).all()
        finally:
            session.close()
    
    # ========== BORING OPERATIONS ==========
    
    def create_boring(self, project_id: int, **kwargs) -> Boring:
        """Create boring record"""
        session = self.get_session()
        try:
            boring = Boring(project_id=project_id, **kwargs)
            session.add(boring)
            session.commit()
            session.refresh(boring)
            return boring
        finally:
            session.close()
    
    # ========== SAMPLE OPERATIONS ==========
    
    def create_sample(self, project_id: int, boring_id: int, **kwargs) -> SoilSample:
        """Create soil sample"""
        session = self.get_session()
        try:
            sample = SoilSample(project_id=project_id, boring_id=boring_id, **kwargs)
            session.add(sample)
            session.commit()
            session.refresh(sample)
            return sample
        finally:
            session.close()
    
    # ========== TEST OPERATIONS ==========
    
    def save_test_result(
        self, 
        project_id: int, 
        sample_id: int, 
        test_type: TestType, 
        results: Dict,
        **kwargs
    ) -> LaboratoryTest:
        """Save laboratory test result"""
        session = self.get_session()
        try:
            test = LaboratoryTest(
                project_id=project_id,
                sample_id=sample_id,
                test_type=test_type,
                results=results,
                **kwargs
            )
            session.add(test)
            session.commit()
            session.refresh(test)
            return test
        finally:
            session.close()
    
    def get_project_tests(self, project_id: int, test_type: Optional[TestType] = None) -> List[LaboratoryTest]:
        """Get all tests for a project, optionally filtered by type"""
        session = self.get_session()
        try:
            query = session.query(LaboratoryTest).filter(LaboratoryTest.project_id == project_id)
            if test_type:
                query = query.filter(LaboratoryTest.test_type == test_type)
            return query.all()
        finally:
            session.close()
    
    # ========== ANALYSIS OPERATIONS ==========
    
    def save_analysis(
        self,
        project_id: int,
        analysis_type: str,
        input_parameters: Dict,
        results: Dict,
        **kwargs
    ) -> EngineeringAnalysis:
        """Save engineering analysis"""
        session = self.get_session()
        try:
            analysis = EngineeringAnalysis(
                project_id=project_id,
                analysis_type=analysis_type,
                input_parameters=input_parameters,
                results=results,
                **kwargs
            )
            session.add(analysis)
            session.commit()
            session.refresh(analysis)
            return analysis
        finally:
            session.close()
    
    def get_project_analyses(self, project_id: int) -> List[EngineeringAnalysis]:
        """Get all analyses for a project"""
        session = self.get_session()
        try:
            return session.query(EngineeringAnalysis).filter(
                EngineeringAnalysis.project_id == project_id
            ).all()
        finally:
            session.close()


# ==================== EXAMPLE USAGE ====================

def example_usage():
    """Example of how to use the database"""
    
    # Initialize database
    db = SoilDatabase()
    
    # Create a project
    project = db.create_project(
        project_number="GEO-2024-001",
        project_name="Office Building Foundation",
        client_name="ABC Construction",
        location="Nairobi, Kenya",
        project_type="Building Foundation",
        engineer_name="John Doe, PE"
    )
    
    # Create boring
    boring = db.create_boring(
        project_id=project.id,
        boring_number="BH-1",
        boring_type="SPT",
        total_depth=15.0,
        water_table_depth=5.5,
        elevation=1650.0
    )
    
    # Create sample
    sample = db.create_sample(
        project_id=project.id,
        boring_id=boring.id,
        sample_number="BH-1-S1",
        depth_from=2.0,
        depth_to=2.5,
        visual_description="Brown silty clay, medium stiff",
        uscs_classification=SoilClassification.CL
    )
    
    # Save test result
    test = db.save_test_result(
        project_id=project.id,
        sample_id=sample.id,
        test_type=TestType.ATTERBERG_LIMITS,
        test_standard="ASTM D4318",
        results={
            "liquid_limit": 42,
            "plastic_limit": 18,
            "plasticity_index": 24,
            "classification": "CL"
        }
    )
    
    # Save analysis
    analysis = db.save_analysis(
        project_id=project.id,
        analysis_type="Bearing Capacity",
        analysis_name="Footing B-1",
        method_used="Terzaghi",
        input_parameters={
            "cohesion": 20,
            "friction_angle": 25,
            "width": 2.0,
            "depth": 1.5
        },
        results={
            "ultimate_bearing_capacity": 450,
            "allowable_bearing_capacity": 150
        }
    )
    
    print(f"Created project: {project.project_number}")
    print(f"Created boring: {boring.boring_number}")
    print(f"Created sample: {sample.sample_number}")
    print(f"Saved test: {test.test_type.value}")
    print(f"Saved analysis: {analysis.analysis_name}")