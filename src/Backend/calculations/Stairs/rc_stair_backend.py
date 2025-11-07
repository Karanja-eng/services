"""
RC Stair Designer - FastAPI Backend
BS 8110-1:1997 Compliant Structural Design API
"""

from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from enum import Enum
import math
from datetime import datetime

router = APIRouter()


# ==================== ENUMS ====================
class StairType(str, Enum):
    SUPPORTED = "supported"
    CANTILEVER = "cantilever"


class ConcreteGrade(str, Enum):
    C25_30 = "C25/30"
    C30_37 = "C30/37"
    C35_45 = "C35/45"
    C40_50 = "C40/50"


class SteelGrade(str, Enum):
    GRADE_460 = "Grade 460"
    GRADE_500 = "Grade 500"


class ExposureClass(str, Enum):
    MILD = "Mild"
    MODERATE = "Moderate"
    SEVERE = "Severe"
    VERY_SEVERE = "Very Severe"


# ==================== BS 8110 DESIGN TABLES ====================
class BS8110Tables:
    """BS 8110-1:1997 Design Tables and Constants"""

    CONCRETE_PROPERTIES = {
        "C25/30": {"fcu": 25, "gamma_m": 1.5, "Ec": 25000},
        "C30/37": {"fcu": 30, "gamma_m": 1.5, "Ec": 26000},
        "C35/45": {"fcu": 35, "gamma_m": 1.5, "Ec": 27500},
        "C40/50": {"fcu": 40, "gamma_m": 1.5, "Ec": 28500},
    }

    STEEL_PROPERTIES = {
        "Grade 460": {"fy": 460, "gamma_m": 1.15, "Es": 200000},
        "Grade 500": {"fy": 500, "gamma_m": 1.15, "Es": 200000},
    }

    COVER_REQUIREMENTS = {"Mild": 25, "Moderate": 35, "Severe": 40, "Very Severe": 50}

    BAR_AREAS = {  # Cross-sectional areas in mm²
        8: 50.3,
        10: 78.5,
        12: 113.1,
        16: 201.1,
        20: 314.2,
        25: 490.9,
        32: 804.2,
    }

    UNIT_WEIGHT_CONCRETE = 25.0  # kN/m³

    # BS 8110 Table 3.9 - Span/effective depth ratios
    SPAN_DEPTH_RATIOS = {"cantilever": 7, "simply_supported": 20, "continuous": 26}

    # Maximum bar spacing (Clause 3.12.11.2.7)
    MAX_BAR_SPACING = 300  # mm

    # Minimum steel percentage (Clause 3.12.5.3)
    MIN_STEEL_PERCENT = 0.13  # 0.13% for slabs


# ==================== PYDANTIC MODELS ====================
class StairInput(BaseModel):
    """Input parameters for stair design"""

    # Stair Configuration
    stair_type: StairType = Field(..., description="Type of stair support")

    # Geometry
    span: float = Field(..., gt=0, le=10, description="Effective span in meters")
    width: float = Field(..., gt=0, le=5, description="Stair width in meters")
    waist_thickness: int = Field(
        ..., ge=100, le=500, description="Waist thickness in mm"
    )
    riser_height: int = Field(..., ge=100, le=220, description="Riser height in mm")
    tread_length: int = Field(..., ge=200, le=400, description="Tread length in mm")
    num_risers: int = Field(..., ge=3, le=30, description="Number of risers")

    # Materials
    concrete_grade: ConcreteGrade = Field(..., description="Concrete grade")
    steel_grade: SteelGrade = Field(..., description="Steel reinforcement grade")
    exposure: ExposureClass = Field(..., description="Exposure classification")
    cover: int = Field(..., ge=20, le=75, description="Nominal cover in mm")

    # Loading
    live_load: float = Field(..., ge=0, le=20, description="Live load in kN/m²")
    finishes_load: float = Field(..., ge=0, le=5, description="Finishes load in kN/m²")

    @validator("cover")
    def validate_cover(cls, v, values):
        """Ensure cover meets minimum requirements for exposure class"""
        if "exposure" in values:
            min_cover = BS8110Tables.COVER_REQUIREMENTS[values["exposure"].value]
            if v < min_cover:
                raise ValueError(
                    f"Cover must be at least {min_cover}mm for {values['exposure'].value} exposure"
                )
        return v


class LoadingResults(BaseModel):
    """Loading calculations"""

    self_weight: float
    dead_load: float
    live_load: float
    ultimate_load: float
    load_factor_dead: float = 1.4
    load_factor_live: float = 1.6


class DesignForces(BaseModel):
    """Design forces"""

    moment: float
    shear: float
    moment_per_meter: float
    shear_per_meter: float


class SteelDesign(BaseModel):
    """Flexural reinforcement design"""

    effective_depth: int
    K_factor: float
    lever_arm: float
    As_required: float
    As_minimum: float
    As_provided: float
    main_bar_diameter: int
    number_of_bars: int
    bar_spacing: int
    main_reinforcement: str
    distribution_bar_diameter: int
    distribution_spacing: int
    distribution_reinforcement: str
    steel_percentage: float


class ShearDesign(BaseModel):
    """Shear design"""

    applied_shear_stress: float
    concrete_shear_capacity: float
    shear_adequate: bool
    shear_reinforcement_required: bool
    max_shear_capacity: float


class DesignChecks(BaseModel):
    """Design verification checks"""

    deflection_check: bool
    deflection_ratio: float
    deflection_limit: float
    spacing_check: bool
    minimum_steel_check: bool
    shear_check: bool
    cover_check: bool
    all_checks_passed: bool


class DesignOutput(BaseModel):
    """Complete design output"""

    input_summary: dict
    loading: LoadingResults
    forces: DesignForces
    steel_design: SteelDesign
    shear_design: ShearDesign
    checks: DesignChecks
    design_status: str
    warnings: list[str]
    calculation_timestamp: str


# ==================== DESIGN CALCULATOR ====================
class StairDesignCalculator:
    """Main design calculation engine"""

    def __init__(self, input_data: StairInput):
        self.input = input_data
        self.concrete_props = BS8110Tables.CONCRETE_PROPERTIES[
            input_data.concrete_grade.value
        ]
        self.steel_props = BS8110Tables.STEEL_PROPERTIES[input_data.steel_grade.value]
        self.warnings = []

    def calculate_loading(self) -> LoadingResults:
        """Calculate loads per BS 8110 Clause 3.1"""

        # Calculate inclined length multiplier
        pitch_angle = math.atan(self.input.riser_height / self.input.tread_length)
        inclined_multiplier = math.sqrt(
            1 + (self.input.riser_height / self.input.tread_length) ** 2
        )

        # Self-weight calculation (per meter width)
        waist_m = self.input.waist_thickness / 1000
        self_weight_per_m2 = (
            waist_m * BS8110Tables.UNIT_WEIGHT_CONCRETE * inclined_multiplier
        )

        # Total dead load
        dead_load_per_m2 = self_weight_per_m2 + self.input.finishes_load

        # Ultimate load (BS 8110 Clause 2.4.3)
        ultimate_load_per_m2 = (1.4 * dead_load_per_m2) + (1.6 * self.input.live_load)

        return LoadingResults(
            self_weight=round(self_weight_per_m2, 3),
            dead_load=round(dead_load_per_m2, 3),
            live_load=round(self.input.live_load, 3),
            ultimate_load=round(ultimate_load_per_m2, 3),
        )

    def calculate_forces(self, loading: LoadingResults) -> DesignForces:
        """Calculate design forces"""

        span = self.input.span
        width = self.input.width
        wu = loading.ultimate_load * width  # Total load per meter run

        if self.input.stair_type == StairType.CANTILEVER:
            # Cantilever moment and shear
            moment = (wu * span**2) / 2
            shear = wu * span
        else:
            # Simply supported moment and shear
            moment = (wu * span**2) / 8
            shear = (wu * span) / 2

        return DesignForces(
            moment=round(moment, 3),
            shear=round(shear, 3),
            moment_per_meter=round(moment / width, 3),
            shear_per_meter=round(shear / width, 3),
        )

    def design_flexural_reinforcement(self, forces: DesignForces) -> SteelDesign:
        """Design flexural reinforcement per BS 8110 Section 3.4"""

        # Material properties
        fcu = self.concrete_props["fcu"]
        fy = self.steel_props["fy"] / self.steel_props["gamma_m"]

        # Assume main bar diameter
        assumed_bar_dia = 12
        effective_depth = (
            self.input.waist_thickness - self.input.cover - (assumed_bar_dia / 2)
        )

        width_mm = self.input.width * 1000
        M = forces.moment * 1e6  # Convert to Nmm

        # Calculate K factor (BS 8110 Clause 3.4.4.4)
        K = M / (width_mm * effective_depth**2 * fcu)

        # Check if compression reinforcement is needed
        K_bal = 0.156  # For fcu = 25-40 N/mm²
        if K > K_bal:
            self.warnings.append(
                "Section requires compression reinforcement. Consider increasing depth."
            )
            K = K_bal

        # Calculate lever arm (BS 8110 Clause 3.4.4.4)
        z = min(
            effective_depth * (0.5 + math.sqrt(0.25 - K / 0.9)), 0.95 * effective_depth
        )

        # Required steel area
        As_req = M / (fy * z)

        # Minimum steel (BS 8110 Clause 3.12.5.3)
        As_min = (
            (BS8110Tables.MIN_STEEL_PERCENT / 100)
            * width_mm
            * self.input.waist_thickness
        )

        # Provided steel area
        As_prov = max(As_req, As_min)

        # Select bar size and spacing
        main_bar_dia = 10 if K <= 0.05 else 12
        bar_area = BS8110Tables.BAR_AREAS[main_bar_dia]
        num_bars = math.ceil(As_prov / bar_area)

        # Calculate spacing
        bar_spacing = (
            int((width_mm - 2 * self.input.cover) / (num_bars - 1))
            if num_bars > 1
            else int(width_mm / 2)
        )
        bar_spacing = min(bar_spacing, BS8110Tables.MAX_BAR_SPACING)

        # Recalculate actual steel provided
        actual_num_bars = int((width_mm - 2 * self.input.cover) / bar_spacing) + 1
        As_actual = actual_num_bars * bar_area

        # Distribution steel (BS 8110 Clause 3.12.5.4)
        As_dist = 0.12 * self.input.waist_thickness * 1000 / 100  # Per meter width
        dist_bar_dia = 8
        dist_bar_area = BS8110Tables.BAR_AREAS[dist_bar_dia]
        num_dist_bars = math.ceil(As_dist / dist_bar_area)
        dist_spacing = int(1000 / num_dist_bars)

        # Steel percentage
        steel_percent = (As_actual * 100) / (width_mm * effective_depth)

        return SteelDesign(
            effective_depth=int(effective_depth),
            K_factor=round(K, 4),
            lever_arm=round(z, 1),
            As_required=round(As_req, 1),
            As_minimum=round(As_min, 1),
            As_provided=round(As_actual, 1),
            main_bar_diameter=main_bar_dia,
            number_of_bars=actual_num_bars,
            bar_spacing=bar_spacing,
            main_reinforcement=f"{actual_num_bars}H{main_bar_dia} @ {bar_spacing}mm c/c",
            distribution_bar_diameter=dist_bar_dia,
            distribution_spacing=dist_spacing,
            distribution_reinforcement=f"H{dist_bar_dia} @ {dist_spacing}mm c/c",
            steel_percentage=round(steel_percent, 3),
        )

    def design_shear(self, forces: DesignForces, steel: SteelDesign) -> ShearDesign:
        """Design for shear per BS 8110 Section 3.5"""

        width_mm = self.input.width * 1000
        d = steel.effective_depth
        V = forces.shear * 1000  # Convert to N

        # Applied shear stress
        v = V / (width_mm * d)

        # Steel ratio
        As = steel.As_provided
        rho = (As * 100) / (width_mm * d)
        rho = min(rho, 3.0)  # Maximum for table

        # Concrete shear stress (BS 8110 Table 3.9)
        fcu = self.concrete_props["fcu"]
        vc = 0.79 * (rho ** (1 / 3)) * ((fcu / 25) ** (1 / 3)) / 1.25
        vc = max(vc, 0.4)  # Minimum value

        # Maximum shear capacity
        vc_max = min(0.8 * math.sqrt(fcu), 5.0)

        # Checks
        shear_adequate = v <= vc_max
        shear_reinf_required = v > vc

        if v > vc_max:
            self.warnings.append(
                "Shear stress exceeds maximum capacity. Increase section depth."
            )
        elif shear_reinf_required:
            self.warnings.append("Shear reinforcement (links) required.")

        return ShearDesign(
            applied_shear_stress=round(v, 3),
            concrete_shear_capacity=round(vc, 3),
            shear_adequate=shear_adequate,
            shear_reinforcement_required=shear_reinf_required,
            max_shear_capacity=round(vc_max, 3),
        )

    def perform_design_checks(
        self, steel: SteelDesign, shear: ShearDesign
    ) -> DesignChecks:
        """Perform all design checks"""

        # Deflection check (BS 8110 Table 3.10)
        span_mm = self.input.span * 1000
        actual_ratio = span_mm / steel.effective_depth

        if self.input.stair_type == StairType.CANTILEVER:
            limit_ratio = BS8110Tables.SPAN_DEPTH_RATIOS["cantilever"]
        else:
            limit_ratio = BS8110Tables.SPAN_DEPTH_RATIOS["simply_supported"]

        # Modification for steel stress
        if steel.K_factor <= 0.156:
            modification = 0.55 + (
                477 - (steel.fy if hasattr(steel, "fy") else 400)
            ) / (120 * (0.9 + steel.K_factor))
            limit_ratio = limit_ratio * min(modification, 2.0)

        deflection_ok = actual_ratio <= limit_ratio

        # Bar spacing check
        spacing_ok = steel.bar_spacing <= BS8110Tables.MAX_BAR_SPACING

        # Minimum steel check
        min_steel_ok = steel.As_provided >= steel.As_minimum

        # Shear check
        shear_ok = shear.shear_adequate

        # Cover check
        min_cover = BS8110Tables.COVER_REQUIREMENTS[self.input.exposure.value]
        cover_ok = self.input.cover >= min_cover

        all_passed = all([deflection_ok, spacing_ok, min_steel_ok, shear_ok, cover_ok])

        return DesignChecks(
            deflection_check=deflection_ok,
            deflection_ratio=round(actual_ratio, 2),
            deflection_limit=round(limit_ratio, 2),
            spacing_check=spacing_ok,
            minimum_steel_check=min_steel_ok,
            shear_check=shear_ok,
            cover_check=cover_ok,
            all_checks_passed=all_passed,
        )

    def perform_complete_design(self) -> DesignOutput:
        """Execute complete design procedure"""

        # Step 1: Calculate loading
        loading = self.calculate_loading()

        # Step 2: Calculate design forces
        forces = self.calculate_forces(loading)

        # Step 3: Design flexural reinforcement
        steel = self.design_flexural_reinforcement(forces)

        # Step 4: Design for shear
        shear = self.design_shear(forces, steel)

        # Step 5: Perform design checks
        checks = self.perform_design_checks(steel, shear)

        # Determine design status
        if checks.all_checks_passed:
            status = "DESIGN SATISFACTORY - All checks passed"
        else:
            status = "DESIGN REQUIRES REVISION - Some checks failed"

        # Input summary
        input_summary = {
            "stair_type": self.input.stair_type.value,
            "span_m": self.input.span,
            "width_m": self.input.width,
            "waist_mm": self.input.waist_thickness,
            "concrete_grade": self.input.concrete_grade.value,
            "steel_grade": self.input.steel_grade.value,
            "exposure_class": self.input.exposure.value,
        }

        return DesignOutput(
            input_summary=input_summary,
            loading=loading,
            forces=forces,
            steel_design=steel,
            shear_design=shear,
            checks=checks,
            design_status=status,
            warnings=self.warnings,
            calculation_timestamp=datetime.now().isoformat(),
        )


# ==================== API ENDPOINTS ====================


@router.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "RC Stair Designer API",
        "version": "1.0.0",
        "description": "BS 8110-1:1997 compliant structural design API",
        "endpoints": {"design": "/api/v1/design", "health": "/health", "docs": "/docs"},
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "api_version": "1.0.0",
    }


@router.post("/api/v1/design", response_model=DesignOutput)
async def design_stair(input_data: StairInput):
    """
    Main design endpoint for RC stair calculation

    Performs complete structural design according to BS 8110-1:1997
    """
    try:
        calculator = StairDesignCalculator(input_data)
        result = calculator.perform_complete_design()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Design calculation error: {str(e)}"
        )


@router.get("/api/v1/design-tables")
async def get_design_tables():
    """Return BS 8110 design tables and constants"""
    return {
        "concrete_grades": BS8110Tables.CONCRETE_PROPERTIES,
        "steel_grades": BS8110Tables.STEEL_PROPERTIES,
        "cover_requirements": BS8110Tables.COVER_REQUIREMENTS,
        "bar_areas": BS8110Tables.BAR_AREAS,
        "span_depth_ratios": BS8110Tables.SPAN_DEPTH_RATIOS,
    }


@router.post("/api/v1/validate-input")
async def validate_input(input_data: StairInput):
    """Validate input parameters without performing design"""
    return {
        "valid": True,
        "message": "Input parameters are valid",
        "input_summary": input_data.dict(),
    }
