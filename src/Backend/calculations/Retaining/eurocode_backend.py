"""
FastAPI Backend for RC Retaining Structure Designer - EUROCODES
EN 1992-1-1 (Eurocode 2), EN 1992-3, EN 1997-1 (Eurocode 7) Compliant

Install dependencies:
pip install fastapi uvicorn pydantic python-multipart

Run server:
uvicorn eurocode_main:app --reload --host 0.0.0.0 --port 8001
"""

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
import math

router = APIRouter()

# ===================== EUROCODE CONSTANTS =====================


class EurocodeConstants:
    """EN 1992-1-1, EN 1992-3, EN 1997-1 Constants"""

    # EN 1992-3 Table 7.1N - Crack width limits for water retaining structures
    MAX_CRACK_WIDTH = {
        "XC1": 0.4,  # mm - Dry or permanently wet
        "XC2": 0.3,  # mm - Wet, rarely dry
        "XC3": 0.3,  # mm - Moderate humidity
        "XC4": 0.3,  # mm - Cyclic wet and dry
        "XD1": 0.3,  # mm - Water tightness requirement
    }

    # EN 1992-1-1 Table 3.1 - Concrete strength classes
    CONCRETE_CLASSES = {
        "C20/25": {"fck": 20, "fck_cube": 25, "fcm": 28, "Ecm": 30000, "fctm": 2.2},
        "C25/30": {"fck": 25, "fck_cube": 30, "fcm": 33, "Ecm": 31000, "fctm": 2.6},
        "C30/37": {"fck": 30, "fck_cube": 37, "fcm": 38, "Ecm": 33000, "fctm": 2.9},
        "C35/45": {"fck": 35, "fck_cube": 45, "fcm": 43, "Ecm": 34000, "fctm": 3.2},
        "C40/50": {"fck": 40, "fck_cube": 50, "fcm": 48, "Ecm": 35000, "fctm": 3.5},
        "C45/55": {"fck": 45, "fck_cube": 55, "fcm": 53, "Ecm": 36000, "fctm": 3.8},
        "C50/60": {"fck": 50, "fck_cube": 60, "fcm": 58, "Ecm": 37000, "fctm": 4.1},
    }

    # EN 1992-1-1 Table C.1 - Steel properties
    STEEL_CLASSES = {
        "B500A": {
            "fyk": 500,
            "ftk": 525,
            "Es": 200000,
            "epsilon_uk": 25,
        },  # High ductility
        "B500B": {
            "fyk": 500,
            "ftk": 540,
            "Es": 200000,
            "epsilon_uk": 50,
        },  # Medium ductility
        "B500C": {
            "fyk": 500,
            "ftk": 575,
            "Es": 200000,
            "epsilon_uk": 75,
        },  # Low ductility
    }

    # EN 1992-1-1 Table 2.1N - Partial safety factors
    GAMMA_C = 1.5  # Concrete - Ultimate Limit State
    GAMMA_S = 1.15  # Steel - Ultimate Limit State

    # EN 1990 Table A1.2(B) - Load factors for persistent/transient design situations
    GAMMA_G_SUP = 1.35  # Permanent unfavorable
    GAMMA_G_INF = 1.0  # Permanent favorable
    GAMMA_Q = 1.5  # Variable actions

    # EN 1992-1-1 Table 4.2 - Minimum cover for durability (cmin,dur)
    MIN_COVER_DURABILITY = {
        "XC1": 15,  # mm - Dry or permanently wet
        "XC2": 25,  # mm - Wet, rarely dry
        "XC3": 25,  # mm - Moderate humidity
        "XC4": 30,  # mm - Cyclic wet and dry
        "XD1": 40,  # mm - Corrosive environment
    }

    # EN 1992-1-1 Clause 7.3.3 - Maximum bar spacing for crack control
    MAX_BAR_SPACING = {
        "w_max_0.4": 300,  # mm
        "w_max_0.3": 200,  # mm
        "w_max_0.2": 150,  # mm
    }

    # EN 1992-1-1 Clause 9.2.1.1 - Minimum reinforcement for crack control
    # As,min = 0.26 × (fctm/fyk) × bt × d but >= 0.0013 × bt × d
    MIN_STEEL_RATIO = 0.0013  # 0.13%

    # Alpha_cc coefficient - EN 1992-1-1 Clause 3.1.6
    ALPHA_CC = 1.0  # For long-term effects


# EN 1997-1 - Soil properties for earth pressure
SOIL_PROPERTIES = {
    "Dense Gravel": {
        "phi": 40,  # degrees
        "gamma": 20,  # kN/m³
        "Ka": 0.217,  # Rankine active
        "c": 0,  # kPa
    },
    "Dense Sand": {"phi": 38, "gamma": 19, "Ka": 0.238, "c": 0},
    "Medium Dense Sand": {"phi": 35, "gamma": 18, "Ka": 0.271, "c": 0},
    "Loose Sand": {"phi": 30, "gamma": 17, "Ka": 0.333, "c": 0},
    "Stiff Clay": {"phi": 28, "gamma": 20, "Ka": 0.361, "c": 50},
    "Firm Clay": {"phi": 25, "gamma": 19, "Ka": 0.406, "c": 30},
    "Soft Clay": {"phi": 20, "gamma": 18, "Ka": 0.490, "c": 15},
}

# ===================== PYDANTIC MODELS =====================


class EurocodeDesignInput(BaseModel):
    """Input parameters for Eurocode structure design"""

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
    soil_type: Optional[str] = Field("Medium Dense Sand", description="Soil type")
    concrete_class: str = Field("C30/37", description="Concrete class per EN 1992-1-1")
    steel_class: str = Field("B500B", description="Steel class per EN 1992-1-1")
    exposure_class: str = Field("XC4", description="Exposure class per EN 1992-1-1")

    @validator("water_depth")
    def validate_water_depth(cls, v, values):
        if values.get("structure_type") in ["tank", "pool"] and v is None:
            raise ValueError("Water depth required for tanks and pools")
        if v is not None and v > values.get("height", 0):
            raise ValueError("Water depth cannot exceed structure height")
        return v

    @validator("concrete_class")
    def validate_concrete(cls, v):
        if v not in EurocodeConstants.CONCRETE_CLASSES:
            raise ValueError(
                f"Invalid concrete class. Choose from: {list(EurocodeConstants.CONCRETE_CLASSES.keys())}"
            )
        return v

    @validator("soil_type")
    def validate_soil(cls, v):
        if v not in SOIL_PROPERTIES:
            raise ValueError(
                f"Invalid soil type. Choose from: {list(SOIL_PROPERTIES.keys())}"
            )
        return v

    @validator("exposure_class")
    def validate_exposure(cls, v):
        if v not in EurocodeConstants.MIN_COVER_DURABILITY:
            raise ValueError(
                f"Invalid exposure class. Choose from: {list(EurocodeConstants.MIN_COVER_DURABILITY.keys())}"
            )
        return v


class PressureResults(BaseModel):
    lateral_pressure: float
    base_pressure: float
    pressure_type: str
    design_pressure: float  # Factored


class MomentResults(BaseModel):
    design_moment: float
    design_shear: float
    bending_moment_coefficient: float


class SteelResults(BaseModel):
    required_area: float
    minimum_area: float
    provided_area: float
    bar_diameter: int
    spacing: int
    notation: str
    utilization_ratio: float
    stress_check_sigma_s: float


class CheckResult(BaseModel):
    passed: bool
    value: float
    limit: float
    description: str
    eurocode_reference: str


class DesignChecks(BaseModel):
    crack_width: CheckResult
    shear_capacity: CheckResult
    minimum_steel: CheckResult
    maximum_spacing: CheckResult
    deflection: CheckResult


class ConcreteProperties(BaseModel):
    concrete_class: str
    fck: float
    fcd: float
    fctm: float
    Ecm: float


class Dimensions(BaseModel):
    effective_depth_wall: float
    effective_depth_base: float
    cover_nominal: float
    cover_min_dur: float


class EurocodeDesignOutput(BaseModel):
    """Complete Eurocode design output"""

    pressures: PressureResults
    moments: MomentResults
    steel: SteelResults
    checks: DesignChecks
    concrete: ConcreteProperties
    dimensions: Dimensions
    design_summary: str
    eurocode_compliance: str


# ===================== DESIGN CALCULATIONS =====================


class EurocodeStructureDesigner:
    """Main design class implementing Eurocode calculations"""

    def __init__(self, inputs: EurocodeDesignInput):
        self.inputs = inputs
        self.concrete_props = EurocodeConstants.CONCRETE_CLASSES[inputs.concrete_class]
        self.steel_props = EurocodeConstants.STEEL_CLASSES[inputs.steel_class]

        # Cover calculation - EN 1992-1-1 Clause 4.4.1
        self.cmin_dur = EurocodeConstants.MIN_COVER_DURABILITY[inputs.exposure_class]
        self.cmin_b = 16  # Assume H16 bars
        self.delta_c_dev = 10  # Allowance for deviation
        self.cnom = max(self.cmin_dur, self.cmin_b) + self.delta_c_dev

    def calculate_pressures(self) -> PressureResults:
        """Calculate pressures per EN 1990, EN 1991, EN 1997-1"""

        if self.inputs.structure_type in ["tank", "pool"]:
            # Hydrostatic pressure - EN 1991-4
            hw = self.inputs.water_depth
            # Characteristic pressure
            p_char = 9.81 * hw  # kN/m²
            # Design pressure: γG × p
            p_design = EurocodeConstants.GAMMA_G_SUP * p_char
            lateral_pressure = p_design
            base_pressure = p_design
            pressure_type = "hydrostatic"

        else:  # basement
            # Earth pressure - EN 1997-1 (Eurocode 7)
            soil = SOIL_PROPERTIES[self.inputs.soil_type]
            h = self.inputs.height

            # Active earth pressure coefficient
            Ka = soil["Ka"]
            gamma_soil = soil["gamma"]

            # Characteristic pressure at base
            p_char = Ka * gamma_soil * h
            # Design pressure
            p_design = EurocodeConstants.GAMMA_G_SUP * p_char
            lateral_pressure = p_design
            base_pressure = EurocodeConstants.GAMMA_G_SUP * gamma_soil * h
            pressure_type = "earth_pressure"

        return PressureResults(
            lateral_pressure=round(lateral_pressure, 2),
            base_pressure=round(base_pressure, 2),
            pressure_type=pressure_type,
            design_pressure=round(p_design, 2),
        )

    def calculate_moments(self, pressures: PressureResults) -> MomentResults:
        """Calculate design moments - EN 1992-1-1"""

        if self.inputs.structure_type in ["tank", "pool"]:
            h = self.inputs.water_depth
        else:
            h = self.inputs.height

        p = pressures.design_pressure

        # Cantilever with triangular load distribution
        # MEd = p × h² / 6
        bending_coeff = 1 / 6
        design_moment = (p * h * h) * bending_coeff

        # VEd = p × h / 2
        design_shear = (p * h) / 2.0

        return MomentResults(
            design_moment=round(design_moment, 2),
            design_shear=round(design_shear, 2),
            bending_moment_coefficient=bending_coeff,
        )

    def calculate_steel(self, moments: MomentResults) -> SteelResults:
        """Calculate steel per EN 1992-1-1 Clause 6.1"""

        MEd = moments.design_moment * 1e6  # Nmm

        # Material properties
        fck = self.concrete_props["fck"]
        fcd = EurocodeConstants.ALPHA_CC * fck / EurocodeConstants.GAMMA_C
        fyk = self.steel_props["fyk"]
        fyd = fyk / EurocodeConstants.GAMMA_S
        Es = self.steel_props["Es"]

        # Effective depth
        bar_dia = 16  # mm
        tw = self.inputs.wall_thickness
        d = tw - self.cnom - bar_dia / 2

        # Design for flexure - EN 1992-1-1 Clause 6.1
        b = 1000  # mm (per meter width)

        # K = MEd / (b × d² × fck)
        K = MEd / (b * d * d * fck)

        # Check if compression steel needed
        # K' = 0.167 for fck ≤ 50 MPa
        K_prime = 0.167

        if K > K_prime:
            K = K_prime  # Use balanced condition

        # Lever arm factor: z = d × (1 - √(2K))
        # But check if K requires compression steel
        if K <= 0.167:
            z = d * (1 - math.sqrt(2 * K)) if K > 0 else 0.9 * d
        else:
            z = 0.82 * d

        # Limit z
        z = min(z, 0.95 * d)
        z = max(z, 0.5 * d)

        # Required steel: As = MEd / (fyd × z)
        As_req = MEd / (fyd * z) if z > 0 else 0

        # Minimum steel - EN 1992-1-1 Clause 9.2.1.1
        fctm = self.concrete_props["fctm"]
        As_min_1 = 0.26 * (fctm / fyk) * b * d
        As_min_2 = EurocodeConstants.MIN_STEEL_RATIO * b * d
        As_min = max(As_min_1, As_min_2)

        # Provided area
        As_prov = max(As_req, As_min)

        # Bar selection
        bar_area = math.pi * bar_dia * bar_dia / 4
        spacing_calc = (bar_area * 1000) / As_prov if As_prov > 0 else 300

        # Determine max spacing based on crack width
        max_spacing_limit = 200  # For w_max = 0.3mm
        spacing = min(int(spacing_calc), max_spacing_limit)
        spacing = max(100, (spacing // 25) * 25)

        # Actual provided
        As_actual = (bar_area * 1000) / spacing

        notation = f"H{bar_dia}@{spacing}c/c"

        utilization = As_req / As_actual if As_actual > 0 else 0

        # Steel stress check - EN 1992-1-1 Clause 7.3.2
        sigma_s = (MEd / (As_actual * z)) if As_actual > 0 and z > 0 else 0

        return SteelResults(
            required_area=round(As_req, 0),
            minimum_area=round(As_min, 0),
            provided_area=round(As_actual, 0),
            bar_diameter=bar_dia,
            spacing=spacing,
            notation=notation,
            utilization_ratio=round(utilization, 2),
            stress_check_sigma_s=round(sigma_s / 1000000, 2),  # MPa
        )

    def perform_checks(
        self, steel: SteelResults, moments: MomentResults
    ) -> DesignChecks:
        """Perform design checks per Eurocodes"""

        # 1. Crack width check - EN 1992-1-1 Clause 7.3.3
        fctm = self.concrete_props["fctm"]
        fyk = self.steel_props["fyk"]
        Es = self.steel_props["Es"]

        # Steel stress
        sigma_s = steel.stress_check_sigma_s * 1000  # Convert to N/mm²

        # Maximum crack spacing: sr,max = 3.4c + 0.425 k1 k2 φ/ρp,eff
        # Simplified: sr,max ≈ 3.4 × cnom
        sr_max = 3.4 * self.cnom

        # Steel strain
        epsilon_s = sigma_s / Es

        # Crack width: wk = sr,max × (εs - εcm)
        # Simplified (conservative): wk ≈ sr,max × εs
        crack_width = sr_max * epsilon_s

        crack_limit = EurocodeConstants.MAX_CRACK_WIDTH[self.inputs.exposure_class]

        crack_check = CheckResult(
            passed=crack_width <= crack_limit,
            value=round(crack_width, 3),
            limit=crack_limit,
            description=f"Crack width control for exposure class {self.inputs.exposure_class}",
            eurocode_reference="EN 1992-1-1 Clause 7.3.1",
        )

        # 2. Shear check - EN 1992-1-1 Clause 6.2.2
        fck = self.concrete_props["fck"]
        d = self.inputs.wall_thickness - self.cnom - steel.bar_diameter / 2
        b = 1000  # mm

        # VRd,c = [CRd,c × k × (100 × ρl × fck)^(1/3)] × b × d
        CRd_c = 0.18 / EurocodeConstants.GAMMA_C
        k = min(1 + math.sqrt(200 / d), 2.0)
        rho_l = min(steel.provided_area / (b * d), 0.02)

        v_min = 0.035 * (k**1.5) * (fck**0.5)

        VRd_c_1 = CRd_c * k * ((100 * rho_l * fck) ** (1 / 3)) * b * d / 1000
        VRd_c_2 = v_min * b * d / 1000

        VRd_c = max(VRd_c_1, VRd_c_2)
        VEd = moments.design_shear

        shear_check = CheckResult(
            passed=VEd <= VRd_c,
            value=round(VEd, 2),
            limit=round(VRd_c, 2),
            description="Shear resistance without shear reinforcement",
            eurocode_reference="EN 1992-1-1 Clause 6.2.2",
        )

        # 3. Minimum steel check
        min_steel_check = CheckResult(
            passed=steel.provided_area >= steel.minimum_area,
            value=round(steel.provided_area, 0),
            limit=round(steel.minimum_area, 0),
            description="Minimum reinforcement for crack control",
            eurocode_reference="EN 1992-1-1 Clause 9.2.1.1",
        )

        # 4. Maximum spacing check - EN 1992-1-1 Table 7.2N/7.3N
        max_spacing_limit = 200  # For w_max = 0.3mm
        max_spacing_check = CheckResult(
            passed=steel.spacing <= max_spacing_limit,
            value=steel.spacing,
            limit=max_spacing_limit,
            description="Maximum bar spacing for crack control",
            eurocode_reference="EN 1992-1-1 Clause 7.3.3",
        )

        # 5. Deflection check - EN 1992-1-1 Clause 7.4
        # Simplified: L/d ratio
        L = self.inputs.height * 1000  # mm
        basic_ratio = 11  # For cantilever
        modification_factor = 1.5  # Conservative
        allowable_ratio = basic_ratio * modification_factor
        actual_ratio = L / d

        deflection_check = CheckResult(
            passed=actual_ratio <= allowable_ratio,
            value=round(actual_ratio, 1),
            limit=round(allowable_ratio, 1),
            description="Span-to-depth ratio check",
            eurocode_reference="EN 1992-1-1 Clause 7.4.2",
        )

        return DesignChecks(
            crack_width=crack_check,
            shear_capacity=shear_check,
            minimum_steel=min_steel_check,
            maximum_spacing=max_spacing_check,
            deflection=deflection_check,
        )

    def design(self) -> EurocodeDesignOutput:
        """Complete Eurocode design process"""

        pressures = self.calculate_pressures()
        moments = self.calculate_moments(pressures)
        steel = self.calculate_steel(moments)
        checks = self.perform_checks(steel, moments)

        # Concrete properties
        concrete = ConcreteProperties(
            concrete_class=self.inputs.concrete_class,
            fck=self.concrete_props["fck"],
            fcd=round(
                EurocodeConstants.ALPHA_CC
                * self.concrete_props["fck"]
                / EurocodeConstants.GAMMA_C,
                2,
            ),
            fctm=self.concrete_props["fctm"],
            Ecm=self.concrete_props["Ecm"],
        )

        # Dimensions
        dimensions = Dimensions(
            effective_depth_wall=round(
                self.inputs.wall_thickness - self.cnom - steel.bar_diameter / 2, 0
            ),
            effective_depth_base=round(
                self.inputs.base_thickness - self.cnom - steel.bar_diameter / 2, 0
            ),
            cover_nominal=self.cnom,
            cover_min_dur=self.cmin_dur,
        )

        # Check if all passed
        all_checks_pass = all(
            [
                checks.crack_width.passed,
                checks.shear_capacity.passed,
                checks.minimum_steel.passed,
                checks.maximum_spacing.passed,
                checks.deflection.passed,
            ]
        )

        summary = f"Design {'COMPLIES' if all_checks_pass else 'REQUIRES REVISION'}"
        compliance = "EN 1992-1-1 | EN 1992-3 | EN 1997-1 | EN 1990"

        return EurocodeDesignOutput(
            pressures=pressures,
            moments=moments,
            steel=steel,
            checks=checks,
            concrete=concrete,
            dimensions=dimensions,
            design_summary=summary,
            eurocode_compliance=compliance,
        )


# ===================== API ENDPOINTS =====================


@router.get("/")
async def root():
    return {
        "message": "RC Retaining Structure Designer API - EUROCODES",
        "version": "1.0.0",
        "docs": "/docs",
        "eurocodes": ["EN 1992-1-1", "EN 1992-3", "EN 1997-1", "EN 1990"],
    }


@router.get("/health")
async def health_check():
    return {"status": "healthy", "standard": "EUROCODES"}


@router.get("/constants")
async def get_constants():
    return {
        "concrete_classes": list(EurocodeConstants.CONCRETE_CLASSES.keys()),
        "steel_classes": list(EurocodeConstants.STEEL_CLASSES.keys()),
        "soil_types": list(SOIL_PROPERTIES.keys()),
        "exposure_classes": list(EurocodeConstants.MIN_COVER_DURABILITY.keys()),
        "partial_safety_factors": {
            "concrete": EurocodeConstants.GAMMA_C,
            "steel": EurocodeConstants.GAMMA_S,
            "permanent_actions": EurocodeConstants.GAMMA_G_SUP,
            "variable_actions": EurocodeConstants.GAMMA_Q,
        },
    }


@router.post("/design", response_model=EurocodeDesignOutput)
async def design_structure(inputs: EurocodeDesignInput):
    """Design RC structure per Eurocodes"""
    try:
        designer = EurocodeStructureDesigner(inputs)
        results = designer.design()
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/soil-properties/{soil_type}")
async def get_soil_properties(soil_type: str):
    if soil_type not in SOIL_PROPERTIES:
        raise HTTPException(
            status_code=404, detail=f"Soil type '{soil_type}' not found"
        )
    return SOIL_PROPERTIES[soil_type]


@router.get("/concrete-properties/{concrete_class}")
async def get_concrete_properties(concrete_class: str):
    if concrete_class not in EurocodeConstants.CONCRETE_CLASSES:
        raise HTTPException(
            status_code=404, detail=f"Concrete class '{concrete_class}' not found"
        )
    return EurocodeConstants.CONCRETE_CLASSES[concrete_class]
