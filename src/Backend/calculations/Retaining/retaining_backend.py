"""
FastAPI Backend for RC Retaining Structure Designer
BS 8110, BS 8007, BS 4449 Compliant

Install dependencies:
pip install fastapi uvicorn pydantic python-multipart

Run server:
uvicorn main:router --reload --host 0.0.0.0 --port 8000
"""

from fastapi import HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
import math

router = APIRouter()

# ===================== BS CODE CONSTANTS =====================


class BSConstants:
    """BS 8007, BS 8110, BS 4449 Constants"""

    # BS 8007 - Crack width limits for water retaining structures
    MAX_CRACK_WIDTH = {
        "severe": 0.2,  # mm - Direct contact with water
        "moderate": 0.3,  # mm - Indirect contact
    }

    # BS 8110 - Concrete grades (fck = characteristic cylinder strength)
    CONCRETE_GRADES = {
        "C25/30": {"fck": 25, "fcu": 30, "Ecm": 31000},
        "C28/35": {"fck": 28, "fcu": 35, "Ecm": 32000},
        "C32/40": {"fck": 32, "fcu": 40, "Ecm": 33000},
        "C35/45": {"fck": 35, "fcu": 45, "Ecm": 34000},
        "C40/50": {"fck": 40, "fcu": 50, "Ecm": 35000},
    }

    # BS 4449 - Steel reinforcement properties
    STEEL_GRADES = {"Grade 500": {"fy": 500, "Es": 200000}}  # N/mm²

    # Partial safety factors - BS 8110 Table 2.2
    GAMMA_C = 1.5  # Concrete
    GAMMA_S = 1.15  # Steel

    # Load factors - BS 8110 Table 2.1
    GAMMA_DL = 1.4  # Dead load
    GAMMA_LL = 1.6  # Live load
    GAMMA_EARTH = 1.4  # Earth pressure
    GAMMA_WATER = 1.4  # Water pressure

    # Cover requirements - BS 8007 Table 6.1
    MIN_COVER = {"mild": 40, "moderate": 50, "severe": 60}  # mm

    # Maximum bar spacing - BS 8007 Clause 6.3.2
    MAX_BAR_SPACING = 300  # mm

    # Minimum reinforcement - BS 8007 Clause 6.3.1
    MIN_STEEL_RATIO = 0.0035  # 0.35%


# Soil properties for earth pressure calculations
SOIL_PROPERTIES = {
    "Dense Sand": {
        "phi": 38,  # Angle of internal friction (degrees)
        "gamma": 19,  # Unit weight (kN/m³)
        "Ka": 0.24,  # Active earth pressure coefficient
        "cohesion": 0,
    },
    "Medium Sand": {"phi": 35, "gamma": 18, "Ka": 0.27, "cohesion": 0},
    "Loose Sand": {"phi": 30, "gamma": 17, "Ka": 0.33, "cohesion": 0},
    "Stiff Clay": {"phi": 28, "gamma": 20, "Ka": 0.36, "cohesion": 50},  # kN/m²
    "Firm Clay": {"phi": 25, "gamma": 19, "Ka": 0.41, "cohesion": 30},
    "Soft Clay": {"phi": 20, "gamma": 18, "Ka": 0.49, "cohesion": 15},
}

# ===================== PYDANTIC MODELS =====================


class DesignInput(BaseModel):
    """Input parameters for structure design"""

    structure_type: Literal["tank", "pool", "basement"] = Field(
        ..., description="Type of retaining structure"
    )
    height: float = Field(..., gt=0, le=20, description="Height in meters")
    length: float = Field(..., gt=0, le=100, description="Length in meters")
    width: float = Field(..., gt=0, le=100, description="Width in meters")
    wall_thickness: float = Field(
        ..., gt=100, le=1000, description="Wall thickness in mm"
    )
    base_thickness: float = Field(
        ..., gt=150, le=1500, description="Base thickness in mm"
    )
    water_depth: Optional[float] = Field(
        None, gt=0, description="Water depth in meters"
    )
    soil_type: Optional[str] = Field(
        "Medium Sand", description="Soil type for basements"
    )
    concrete_grade: str = Field("C32/40", description="Concrete grade per BS 8110")
    steel_grade: str = Field("Grade 500", description="Steel grade per BS 4449")
    exposure: Literal["severe", "moderate"] = Field(
        "severe", description="Exposure class per BS 8007"
    )

    @validator("water_depth")
    def validate_water_depth(cls, v, values):
        if values.get("structure_type") in ["tank", "pool"] and v is None:
            raise ValueError("Water depth required for tanks and pools")
        if v is not None and v > values.get("height", 0):
            raise ValueError("Water depth cannot exceed structure height")
        return v

    @validator("concrete_grade")
    def validate_concrete(cls, v):
        if v not in BSConstants.CONCRETE_GRADES:
            raise ValueError(
                f"Invalid concrete grade. Choose from: {list(BSConstants.CONCRETE_GRADES.keys())}"
            )
        return v

    @validator("soil_type")
    def validate_soil(cls, v):
        if v not in SOIL_PROPERTIES:
            raise ValueError(
                f"Invalid soil type. Choose from: {list(SOIL_PROPERTIES.keys())}"
            )
        return v


class PressureResults(BaseModel):
    lateral_pressure: float = Field(..., description="Lateral pressure in kN/m²")
    base_pressure: float = Field(..., description="Base pressure in kN/m²")
    pressure_type: str = Field(..., description="Type of pressure (hydrostatic/earth)")


class MomentResults(BaseModel):
    design_moment: float = Field(..., description="Design moment in kNm/m")
    design_shear: float = Field(..., description="Design shear in kN/m")


class SteelResults(BaseModel):
    required_area: float = Field(..., description="Required steel area in mm²/m")
    minimum_area: float = Field(..., description="Minimum steel area in mm²/m")
    provided_area: float = Field(..., description="Provided steel area in mm²/m")
    bar_diameter: int = Field(..., description="Bar diameter in mm")
    spacing: int = Field(..., description="Bar spacing in mm")
    notation: str = Field(..., description="Bar notation (e.g., H16@200c/c)")
    utilization_ratio: float = Field(..., description="Steel utilization ratio")


class CheckResult(BaseModel):
    passed: bool
    value: float
    limit: float
    description: str


class DesignChecks(BaseModel):
    crack_width: CheckResult
    shear_capacity: CheckResult
    minimum_steel: CheckResult
    maximum_spacing: CheckResult


class ConcreteProperties(BaseModel):
    grade: str
    fck: float = Field(..., description="Characteristic strength in N/mm²")
    fcd: float = Field(..., description="Design strength in N/mm²")
    Ecm: float = Field(..., description="Elastic modulus in N/mm²")


class Dimensions(BaseModel):
    effective_depth_wall: float = Field(..., description="Wall effective depth in mm")
    effective_depth_base: float = Field(..., description="Base effective depth in mm")
    cover: int = Field(..., description="Concrete cover in mm")


class DesignOutput(BaseModel):
    """Complete design output"""

    pressures: PressureResults
    moments: MomentResults
    steel: SteelResults
    checks: DesignChecks
    concrete: ConcreteProperties
    dimensions: Dimensions
    design_summary: str


# ===================== DESIGN CALCULATIONS =====================


class StructureDesigner:
    """Main design class implementing BS code calculations"""

    def __init__(self, inputs: DesignInput):
        self.inputs = inputs
        self.concrete_props = BSConstants.CONCRETE_GRADES[inputs.concrete_grade]
        self.steel_props = BSConstants.STEEL_GRADES[inputs.steel_grade]
        self.cover = BSConstants.MIN_COVER[inputs.exposure]

    def calculate_pressures(self) -> PressureResults:
        """Calculate lateral and base pressures per BS codes"""

        if self.inputs.structure_type in ["tank", "pool"]:
            # Hydrostatic pressure - BS 8007 Clause 4.3
            hw = self.inputs.water_depth
            # Pressure at base: p = γ_w × h × γ_f
            lateral_pressure = 9.81 * hw * BSConstants.GAMMA_WATER
            base_pressure = 9.81 * hw * BSConstants.GAMMA_WATER
            pressure_type = "hydrostatic"

        else:  # basement
            # Earth pressure - Rankine theory (BS 8002)
            soil = SOIL_PROPERTIES[self.inputs.soil_type]
            h = self.inputs.height

            # Active earth pressure coefficient Ka
            Ka = soil["Ka"]
            gamma_soil = soil["gamma"]

            # Lateral pressure at base: p = Ka × γ × h × γ_f
            lateral_pressure = Ka * gamma_soil * h * BSConstants.GAMMA_EARTH
            base_pressure = gamma_soil * h * BSConstants.GAMMA_DL
            pressure_type = "earth_pressure"

        return PressureResults(
            lateral_pressure=round(lateral_pressure, 2),
            base_pressure=round(base_pressure, 2),
            pressure_type=pressure_type,
        )

    def calculate_moments(self, pressures: PressureResults) -> MomentResults:
        """Calculate design moments and shears - BS 8110"""

        if self.inputs.structure_type in ["tank", "pool"]:
            h = self.inputs.water_depth
        else:
            h = self.inputs.height

        p = pressures.lateral_pressure

        # Cantilever assumption - triangular pressure distribution
        # Maximum moment at base: M = (p × h²) / 6
        design_moment = (p * h * h) / 6.0

        # Maximum shear at base: V = (p × h) / 2
        design_shear = (p * h) / 2.0

        return MomentResults(
            design_moment=round(design_moment, 2), design_shear=round(design_shear, 2)
        )

    def calculate_steel(self, moments: MomentResults) -> SteelResults:
        """Calculate steel reinforcement - BS 8110 Part 1"""

        M = moments.design_moment * 1e6  # Convert to Nmm

        # Material properties
        fck = self.concrete_props["fck"]
        fcd = fck / BSConstants.GAMMA_C  # Design concrete strength
        fy = self.steel_props["fy"]
        fyd = fy / BSConstants.GAMMA_S  # Design steel strength

        # Effective depth (assume H16 bars)
        bar_dia = 16  # mm
        tw = self.inputs.wall_thickness
        d = tw - self.cover - bar_dia / 2

        # Design for flexure - BS 8110 Part 1 Clause 3.4.4
        # K = M / (fck × b × d²)
        K = M / (fck * 1000 * d * d)

        # Check if compression steel is needed
        K_bal = 0.156  # For fck = 25-40 N/mm²

        if K > K_bal:
            # Compression steel required - use K_bal
            K = K_bal

        # Lever arm: z = d × [0.5 + √(0.25 - K/1.134)]
        z = d * (0.5 + math.sqrt(0.25 - K / 1.134))

        # Limit z to 0.95d
        z = min(z, 0.95 * d)

        # Required steel area: As = M / (fyd × z)
        As_req = M / (fyd * z)  # mm²/m

        # Minimum steel - BS 8007 Clause 6.3.1 (0.35% of gross section)
        As_min = BSConstants.MIN_STEEL_RATIO * tw * 1000  # mm²/m

        # Provided area (take maximum)
        As_prov = max(As_req, As_min)

        # Bar selection and spacing
        bar_area = math.pi * bar_dia * bar_dia / 4
        spacing_calc = (bar_area * 1000) / As_prov

        # Limit spacing to maximum per BS 8007
        spacing = min(int(spacing_calc), BSConstants.MAX_BAR_SPACING)

        # Round to nearest 25mm
        spacing = max(100, (spacing // 25) * 25)

        # Actual provided area
        As_actual = (bar_area * 1000) / spacing

        # Steel notation
        notation = f"H{bar_dia}@{spacing}c/c"

        # Utilization ratio
        utilization = As_req / As_actual if As_actual > 0 else 0

        return SteelResults(
            required_area=round(As_req, 0),
            minimum_area=round(As_min, 0),
            provided_area=round(As_actual, 0),
            bar_diameter=bar_dia,
            spacing=spacing,
            notation=notation,
            utilization_ratio=round(utilization, 2),
        )

    def perform_checks(
        self, steel: SteelResults, moments: MomentResults
    ) -> DesignChecks:
        """Perform design checks per BS codes"""

        # 1. Crack width check - BS 8007 Clause 6.3.3
        Es = self.steel_props["Es"]
        As = steel.provided_area
        tw = self.inputs.wall_thickness

        # Strain in steel
        epsilon_s = As / (Es * tw * 1000)

        # Crack width: w = 3 × cover × ε_s (simplified)
        crack_width = 3 * self.cover * epsilon_s

        crack_limit = BSConstants.MAX_CRACK_WIDTH[self.inputs.exposure]

        crack_check = CheckResult(
            passed=crack_width <= crack_limit,
            value=round(crack_width, 3),
            limit=crack_limit,
            description="BS 8007 crack width limit",
        )

        # 2. Shear capacity check - BS 8110 Part 1 Clause 3.4.5
        fck = self.concrete_props["fck"]
        d = self.inputs.wall_thickness - self.cover - steel.bar_diameter / 2

        # Concrete shear stress: vc = 0.79 × (100×As/(b×d))^(1/3) × (fck/25)^(1/3) / γc
        rho = 100 * As / (1000 * d)
        vc = 0.79 * (rho ** (1 / 3)) * ((fck / 25) ** (1 / 3)) / BSConstants.GAMMA_C

        # Shear capacity: Vc = vc × b × d
        V_capacity = vc * 1000 * d / 1000  # kN/m
        V_demand = moments.design_shear

        shear_check = CheckResult(
            passed=V_demand <= V_capacity,
            value=round(V_demand, 2),
            limit=round(V_capacity, 2),
            description="BS 8110 shear capacity",
        )

        # 3. Minimum steel check
        min_steel_check = CheckResult(
            passed=steel.provided_area >= steel.minimum_area,
            value=round(steel.provided_area, 0),
            limit=round(steel.minimum_area, 0),
            description="BS 8007 minimum reinforcement",
        )

        # 4. Maximum spacing check
        max_spacing_check = CheckResult(
            passed=steel.spacing <= BSConstants.MAX_BAR_SPACING,
            value=steel.spacing,
            limit=BSConstants.MAX_BAR_SPACING,
            description="BS 8007 maximum spacing",
        )

        return DesignChecks(
            crack_width=crack_check,
            shear_capacity=shear_check,
            minimum_steel=min_steel_check,
            maximum_spacing=max_spacing_check,
        )

    def design(self) -> DesignOutput:
        """Complete design process"""

        # Calculate pressures
        pressures = self.calculate_pressures()

        # Calculate moments and shears
        moments = self.calculate_moments(pressures)

        # Design steel reinforcement
        steel = self.calculate_steel(moments)

        # Perform design checks
        checks = self.perform_checks(steel, moments)

        # Concrete properties
        concrete = ConcreteProperties(
            grade=self.inputs.concrete_grade,
            fck=self.concrete_props["fck"],
            fcd=round(self.concrete_props["fck"] / BSConstants.GAMMA_C, 2),
            Ecm=self.concrete_props["Ecm"],
        )

        # Dimensions
        dimensions = Dimensions(
            effective_depth_wall=round(
                self.inputs.wall_thickness - self.cover - steel.bar_diameter / 2, 0
            ),
            effective_depth_base=round(
                self.inputs.base_thickness - self.cover - steel.bar_diameter / 2, 0
            ),
            cover=self.cover,
        )

        # Design summary
        all_checks_pass = all(
            [
                checks.crack_width.passed,
                checks.shear_capacity.passed,
                checks.minimum_steel.passed,
                checks.maximum_spacing.passed,
            ]
        )

        summary = f"Design {'ACCEPTABLE' if all_checks_pass else 'REQUIRES REVISION'} per BS 8110/8007/4449"

        return DesignOutput(
            pressures=pressures,
            moments=moments,
            steel=steel,
            checks=checks,
            concrete=concrete,
            dimensions=dimensions,
            design_summary=summary,
        )


# ===================== API ENDPOINTS =====================


@router.post("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "RC Retaining Structure Designer API",
        "version": "1.0.0",
        "docs": "/docs",
        "codes": ["BS 8110", "BS 8007", "BS 4449"],
    }


@router.post("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@router.get("/constants")
async def get_constants():
    """Get BS code constants and material properties"""
    return {
        "concrete_grades": list(BSConstants.CONCRETE_GRADES.keys()),
        "steel_grades": list(BSConstants.STEEL_GRADES.keys()),
        "soil_types": list(SOIL_PROPERTIES.keys()),
        "exposure_classes": list(BSConstants.MIN_COVER.keys()),
        "partial_safety_factors": {
            "concrete": BSConstants.GAMMA_C,
            "steel": BSConstants.GAMMA_S,
        },
        "load_factors": {
            "dead_load": BSConstants.GAMMA_DL,
            "live_load": BSConstants.GAMMA_LL,
            "earth_pressure": BSConstants.GAMMA_EARTH,
            "water_pressure": BSConstants.GAMMA_WATER,
        },
    }


@router.post("/design", response_model=DesignOutput)
async def design_structure(inputs: DesignInput):
    """
    Design a reinforced concrete retaining structure per BS codes

    Returns complete design calculations including:
    - Pressure calculations
    - Moment and shear design
    - Steel reinforcement requirements
    - Design checks (crack width, shear, etc.)
    """
    try:
        designer = StructureDesigner(inputs)
        results = designer.design()
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/check-only")
async def check_existing_design(inputs: DesignInput):
    """
    Check an existing design without redesigning
    Useful for verification purposes
    """
    try:
        designer = StructureDesigner(inputs)
        pressures = designer.calculate_pressures()
        moments = designer.calculate_moments(pressures)
        steel = designer.calculate_steel(moments)
        checks = designer.perform_checks(steel, moments)

        return {
            "checks": checks,
            "all_passed": all(
                [
                    checks.crack_width.passed,
                    checks.shear_capacity.passed,
                    checks.minimum_steel.passed,
                    checks.maximum_spacing.passed,
                ]
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/soil-properties/{soil_type}")
async def get_soil_properties(soil_type: str):
    """Get properties for a specific soil type"""
    if soil_type not in SOIL_PROPERTIES:
        raise HTTPException(
            status_code=404, detail=f"Soil type '{soil_type}' not found"
        )
    return SOIL_PROPERTIES[soil_type]


@router.get("/concrete-properties/{grade}")
async def get_concrete_properties(grade: str):
    """Get properties for a specific concrete grade"""
    if grade not in BSConstants.CONCRETE_GRADES:
        raise HTTPException(
            status_code=404, detail=f"Concrete grade '{grade}' not found"
        )
    return BSConstants.CONCRETE_GRADES[grade]
