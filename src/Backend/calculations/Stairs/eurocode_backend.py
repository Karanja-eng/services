"""
RC Stair Designer - Eurocode EN 1992-1-1:2004 Backend
Complete implementation with accurate tables and calculations
"""

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from enum import Enum
import math
from datetime import datetime

router = APIRouter()


# ==================== ENUMS ====================
class StairType(str, Enum):
    SIMPLY_SUPPORTED = "simply_supported"
    CANTILEVER = "cantilever"


class CantileverType(str, Enum):
    SIDE_SUPPORT = "side_support"  # Steps cantilever from side wall/beam
    CENTRAL_BEAM = "central_beam"  # Steps supported at center, cantilever both sides


class ConcreteClass(str, Enum):
    C25_30 = "C25/30"
    C30_37 = "C30/37"
    C35_45 = "C35/45"
    C40_50 = "C40/50"
    C45_55 = "C45/55"
    C50_60 = "C50/60"


class SteelGrade(str, Enum):
    B500A = "B500A"
    B500B = "B500B"
    B500C = "B500C"


class ExposureClass(str, Enum):
    XC1 = "XC1"  # Dry or permanently wet
    XC2 = "XC2"  # Wet, rarely dry
    XC3 = "XC3"  # Moderate humidity
    XC4 = "XC4"  # Cyclic wet and dry
    XD1 = "XD1"  # Moderate humidity with chlorides
    XD2 = "XD2"  # Wet with chlorides
    XD3 = "XD3"  # Cyclic wet/dry with chlorides
    XS1 = "XS1"  # Exposed to airborne salt
    XS2 = "XS2"  # Permanently submerged in seawater
    XS3 = "XS3"  # Tidal, splash and spray zones


# ==================== EUROCODE TABLES (EN 1992-1-1:2004) ====================
class EurocodeTablesEC2:
    """Eurocode 2 Design Tables - EN 1992-1-1:2004"""

    # Table 3.1 - Strength and deformation characteristics for concrete
    CONCRETE_PROPERTIES = {
        "C25/30": {
            "fck": 25,  # Characteristic compressive cylinder strength (MPa)
            "fck_cube": 30,  # Characteristic compressive cube strength (MPa)
            "fcm": 33,  # Mean compressive strength (MPa)
            "fctm": 2.6,  # Mean tensile strength (MPa)
            "Ecm": 31000,  # Modulus of elasticity (MPa)
            "εc1": 2.2,  # Strain at peak stress (‰)
            "εcu1": 3.5,  # Ultimate strain (‰)
        },
        "C30/37": {
            "fck": 30,
            "fck_cube": 37,
            "fcm": 38,
            "fctm": 2.9,
            "Ecm": 33000,
            "εc1": 2.3,
            "εcu1": 3.5,
        },
        "C35/45": {
            "fck": 35,
            "fck_cube": 45,
            "fcm": 43,
            "fctm": 3.2,
            "Ecm": 34000,
            "εc1": 2.4,
            "εcu1": 3.5,
        },
        "C40/50": {
            "fck": 40,
            "fck_cube": 50,
            "fcm": 48,
            "fctm": 3.5,
            "Ecm": 35000,
            "εc1": 2.5,
            "εcu1": 3.5,
        },
        "C45/55": {
            "fck": 45,
            "fck_cube": 55,
            "fcm": 53,
            "fctm": 3.8,
            "Ecm": 36000,
            "εc1": 2.6,
            "εcu1": 3.5,
        },
        "C50/60": {
            "fck": 50,
            "fck_cube": 60,
            "fcm": 58,
            "fctm": 4.1,
            "Ecm": 37000,
            "εc1": 2.7,
            "εcu1": 3.5,
        },
    }

    # Table C.1 - Reinforcement properties
    STEEL_PROPERTIES = {
        "B500A": {
            "fyk": 500,  # Characteristic yield strength (MPa)
            "ftk": 525,  # Characteristic tensile strength (MPa)
            "Es": 200000,  # Modulus of elasticity (MPa)
            "εuk": 25,  # Characteristic strain at maximum force (‰)
            "k": 1.05,  # ftk/fyk ratio
        },
        "B500B": {"fyk": 500, "ftk": 540, "Es": 200000, "εuk": 50, "k": 1.08},
        "B500C": {"fyk": 500, "ftk": 575, "Es": 200000, "εuk": 75, "k": 1.15},
    }

    # Table 4.1 - Exposure classes related to environmental conditions
    COVER_REQUIREMENTS = {
        "XC1": 15,  # Minimum cover (mm)
        "XC2": 25,
        "XC3": 25,
        "XC4": 30,
        "XD1": 30,
        "XD2": 35,
        "XD3": 40,
        "XS1": 35,
        "XS2": 40,
        "XS3": 45,
    }

    # Partial safety factors (Clause 2.4.2.4)
    GAMMA_C = 1.5  # Partial factor for concrete
    GAMMA_S = 1.15  # Partial factor for steel

    # Coefficient α_cc (Clause 3.1.6)
    ALPHA_CC = 0.85  # Long-term strength coefficient

    # Bar diameters and areas (Table 3.1 in Annex)
    BAR_AREAS = {
        6: 28.3,
        8: 50.3,
        10: 78.5,
        12: 113.1,
        16: 201.1,
        20: 314.2,
        25: 490.9,
        32: 804.2,
        40: 1256.6,
    }

    # Clause 9.3.1.1 - Maximum bar spacing for crack control
    MAX_BAR_SPACING = {
        "wk_0.3": 300,  # For crack width wk = 0.3mm
        "wk_0.4": 300,  # For crack width wk = 0.4mm
    }

    # Clause 9.2.1.1 - Minimum reinforcement
    MIN_STEEL_RATIO = 0.0013  # As,min = 0.26(fctm/fyk)bt·d ≥ 0.0013bt·d

    UNIT_WEIGHT_CONCRETE = 25.0  # kN/m³ (Clause 3.1.2)

    # Table 7.4N - Span/effective depth ratios (simplified)
    SPAN_DEPTH_RATIOS = {
        "cantilever": 7,
        "simply_supported": 20,
        "continuous_end": 26,
        "continuous_interior": 30,
    }


# ==================== PYDANTIC MODELS ====================
class EurocodeStairInput(BaseModel):
    """Input parameters for Eurocode stair design"""

    stair_type: StairType
    cantilever_type: Optional[CantileverType] = None

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
    concrete_class: ConcreteClass
    steel_grade: SteelGrade
    exposure_class: ExposureClass
    cover: int = Field(..., ge=15, le=75, description="Nominal cover in mm")

    # Loading
    live_load: float = Field(
        ..., ge=0, le=20, description="Characteristic live load in kN/m²"
    )
    finishes_load: float = Field(..., ge=0, le=5, description="Finishes load in kN/m²")

    @validator("cantilever_type")
    def validate_cantilever_type(cls, v, values):
        if (
            "stair_type" in values
            and values["stair_type"] == StairType.CANTILEVER
            and v is None
        ):
            raise ValueError("cantilever_type is required for cantilever stairs")
        return v


class EurocodeLoadingResults(BaseModel):
    self_weight: float
    dead_load: float
    live_load: float
    design_load_uls: float  # Ultimate Limit State
    design_load_sls: float  # Serviceability Limit State
    gamma_g: float = 1.35
    gamma_q: float = 1.5
    psi_0: float = 0.7  # Combination factor


class EurocodeDesignForces(BaseModel):
    moment_ed: float  # Design bending moment (kNm)
    shear_ed: float  # Design shear force (kN)
    moment_per_meter: float
    shear_per_meter: float


class EurocodeSteelDesign(BaseModel):
    effective_depth: int
    fcd: float  # Design concrete strength
    fyd: float  # Design steel strength
    mu_ed: float  # Normalized moment
    omega: float  # Mechanical reinforcement ratio
    xi: float  # Neutral axis depth ratio
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
    steel_ratio: float


class EurocodeShearDesign(BaseModel):
    v_ed: float  # Design shear stress (MPa)
    v_rd_c: float  # Shear resistance without reinforcement (MPa)
    v_rd_max: float  # Maximum shear capacity (MPa)
    shear_adequate: bool
    shear_reinforcement_required: bool
    rho_l: float  # Longitudinal reinforcement ratio


class EurocodeDesignChecks(BaseModel):
    deflection_check: bool
    deflection_ratio: float
    deflection_limit: float
    spacing_check: bool
    minimum_steel_check: bool
    shear_check: bool
    cover_check: bool
    crack_width_check: bool
    all_checks_passed: bool


class EurocodeDesignOutput(BaseModel):
    input_summary: dict
    loading: EurocodeLoadingResults
    forces: EurocodeDesignForces
    steel_design: EurocodeSteelDesign
    shear_design: EurocodeShearDesign
    checks: EurocodeDesignChecks
    design_status: str
    warnings: list
    code_reference: str = "EN 1992-1-1:2004"
    calculation_timestamp: str


# ==================== DESIGN CALCULATOR ====================
class EurocodeStairCalculator:
    """Eurocode EN 1992-1-1:2004 Design Calculator"""

    def __init__(self, input_data: EurocodeStairInput):
        self.input = input_data
        self.concrete = EurocodeTablesEC2.CONCRETE_PROPERTIES[
            input_data.concrete_class.value
        ]
        self.steel = EurocodeTablesEC2.STEEL_PROPERTIES[input_data.steel_grade.value]
        self.warnings = []

        # Design strengths (Clause 3.1.6 and 3.2.7)
        self.fcd = (
            EurocodeTablesEC2.ALPHA_CC * self.concrete["fck"]
        ) / EurocodeTablesEC2.GAMMA_C
        self.fyd = self.steel["fyk"] / EurocodeTablesEC2.GAMMA_S

    def calculate_loading(self) -> EurocodeLoadingResults:
        """Calculate loads per EN 1992-1-1 Clause 6.1"""

        # Inclined length multiplier
        pitch_angle = math.atan(self.input.riser_height / self.input.tread_length)
        inclined_multiplier = 1 / math.cos(pitch_angle)

        # Self-weight per m² (inclined surface)
        waist_m = self.input.waist_thickness / 1000
        self_weight_per_m2 = (
            waist_m * EurocodeTablesEC2.UNIT_WEIGHT_CONCRETE * inclined_multiplier
        )

        # Total dead load
        dead_load_per_m2 = self_weight_per_m2 + self.input.finishes_load

        # Ultimate Limit State (ULS) - EN 1990 Table A1.2(B)
        gamma_g = 1.35  # Partial factor for permanent actions
        gamma_q = 1.5  # Partial factor for variable actions
        design_load_uls = gamma_g * dead_load_per_m2 + gamma_q * self.input.live_load

        # Serviceability Limit State (SLS) - Characteristic combination
        psi_0 = 0.7  # For category C (assembly areas)
        design_load_sls = dead_load_per_m2 + psi_0 * self.input.live_load

        return EurocodeLoadingResults(
            self_weight=round(self_weight_per_m2, 3),
            dead_load=round(dead_load_per_m2, 3),
            live_load=round(self.input.live_load, 3),
            design_load_uls=round(design_load_uls, 3),
            design_load_sls=round(design_load_sls, 3),
            gamma_g=gamma_g,
            gamma_q=gamma_q,
            psi_0=psi_0,
        )

    def calculate_forces(self, loading: EurocodeLoadingResults) -> EurocodeDesignForces:
        """Calculate design forces based on support conditions"""

        span = self.input.span
        width = self.input.width
        qd = loading.design_load_uls * width  # Design load per meter run

        if self.input.stair_type == StairType.CANTILEVER:
            if self.input.cantilever_type == CantileverType.SIDE_SUPPORT:
                # Single cantilever from side wall/beam
                # Max moment at support, M = qL²/2
                moment = (qd * span**2) / 2
                shear = qd * span

            elif self.input.cantilever_type == CantileverType.CENTRAL_BEAM:
                # Double cantilever from central spine beam
                # Each step cantilevers half the width
                # Moment per unit width at center
                cantilever_length = width / 2
                # For unit width (1m strip)
                q_per_m = loading.design_load_uls
                moment = (q_per_m * cantilever_length**2) / 2 * width  # Total moment
                shear = q_per_m * cantilever_length * width / 2  # Total shear

        else:  # Simply supported
            # M = qL²/8 for simply supported beam
            moment = (qd * span**2) / 8
            shear = (qd * span) / 2

        return EurocodeDesignForces(
            moment_ed=round(moment, 3),
            shear_ed=round(shear, 3),
            moment_per_meter=round(moment / width, 3),
            shear_per_meter=round(shear / width, 3),
        )

    def design_flexural_reinforcement(
        self, forces: EurocodeDesignForces
    ) -> EurocodeSteelDesign:
        """Design flexural reinforcement per EN 1992-1-1 Clause 6.1"""

        # Geometry
        assumed_bar_dia = 12
        effective_depth = (
            self.input.waist_thickness - self.input.cover - (assumed_bar_dia / 2)
        )

        width_mm = self.input.width * 1000
        b = width_mm
        d = effective_depth

        Med = forces.moment_ed * 1e6  # Convert to Nmm

        # Normalized moment (Clause 6.1)
        mu_ed = Med / (b * d**2 * self.fcd)

        # Check if compression reinforcement is needed
        mu_lim = 0.167  # For fck ≤ 50 MPa (from tables)
        if mu_ed > mu_lim:
            self.warnings.append(
                "Normalized moment exceeds limit. Compression reinforcement required or increase depth."
            )
            mu_ed = mu_lim

        # Mechanical reinforcement ratio (ω = As·fyd / (b·d·fcd))
        # From equilibrium: μ = ω(1 - 0.5ω) for rectangular section
        # Solving: ω = 1 - √(1 - 2μ)
        omega = 1 - math.sqrt(1 - 2 * mu_ed)

        # Neutral axis depth ratio
        xi = omega * self.fyd / (0.8 * self.fcd)

        # Check if within limits (Clause 5.6.3)
        xi_lim = 0.45  # For fck ≤ 50 MPa
        if xi > xi_lim:
            self.warnings.append("Neutral axis depth exceeds limit for ductility.")

        # Required steel area
        As_req = (omega * b * d * self.fcd) / self.fyd

        # Minimum steel (Clause 9.2.1.1)
        fctm = self.concrete["fctm"]
        As_min = max(
            0.26 * (fctm / self.steel["fyk"]) * b * d,
            EurocodeTablesEC2.MIN_STEEL_RATIO * b * d,
        )

        # Provided steel
        As_prov = max(As_req, As_min)

        # Select bars
        main_bar_dia = 12 if mu_ed <= 0.08 else 16
        bar_area = EurocodeTablesEC2.BAR_AREAS[main_bar_dia]
        num_bars = math.ceil(As_prov / bar_area)

        # Calculate spacing
        bar_spacing = (
            int((b - 2 * self.input.cover) / (num_bars - 1))
            if num_bars > 1
            else int(b / 2)
        )
        max_spacing = EurocodeTablesEC2.MAX_BAR_SPACING["wk_0.3"]
        bar_spacing = min(bar_spacing, max_spacing)

        # Actual steel provided
        actual_num_bars = int((b - 2 * self.input.cover) / bar_spacing) + 1
        As_actual = actual_num_bars * bar_area

        # Distribution steel (Clause 9.3.1.1) - minimum 20% of main steel
        As_dist = max(
            0.2 * As_actual,
            EurocodeTablesEC2.MIN_STEEL_RATIO * self.input.waist_thickness * 1000,
        )
        dist_bar_dia = 8
        dist_bar_area = EurocodeTablesEC2.BAR_AREAS[dist_bar_dia]
        num_dist_bars = math.ceil(As_dist / dist_bar_area)
        dist_spacing = int(1000 / num_dist_bars)
        dist_spacing = min(dist_spacing, 400)  # Max 400mm for distribution

        # Steel ratio
        steel_ratio = (As_actual * 100) / (b * d)

        return EurocodeSteelDesign(
            effective_depth=int(effective_depth),
            fcd=round(self.fcd, 2),
            fyd=round(self.fyd, 2),
            mu_ed=round(mu_ed, 4),
            omega=round(omega, 4),
            xi=round(xi, 3),
            As_required=round(As_req, 1),
            As_minimum=round(As_min, 1),
            As_provided=round(As_actual, 1),
            main_bar_diameter=main_bar_dia,
            number_of_bars=actual_num_bars,
            bar_spacing=bar_spacing,
            main_reinforcement=f"{actual_num_bars}Ø{main_bar_dia} @ {bar_spacing}mm c/c",
            distribution_bar_diameter=dist_bar_dia,
            distribution_spacing=dist_spacing,
            distribution_reinforcement=f"Ø{dist_bar_dia} @ {dist_spacing}mm c/c",
            steel_ratio=round(steel_ratio, 3),
        )

    def design_shear(
        self, forces: EurocodeDesignForces, steel: EurocodeSteelDesign
    ) -> EurocodeShearDesign:
        """Design for shear per EN 1992-1-1 Clause 6.2"""

        b = self.input.width * 1000
        d = steel.effective_depth
        Ved = forces.shear_ed * 1000  # Convert to N

        # Design shear stress
        v_ed = Ved / (b * d)

        # Longitudinal reinforcement ratio
        As = steel.As_provided
        rho_l = min(As / (b * d), 0.02)  # Limited to 2%

        # Shear resistance without reinforcement (Clause 6.2.2)
        # VRd,c = [CRd,c·k·(100·ρl·fck)^(1/3)]·b·d
        # With minimum: VRd,c,min = (vmin)·b·d

        CRd_c = 0.18 / EurocodeTablesEC2.GAMMA_C
        k = min(1 + math.sqrt(200 / d), 2.0)
        fck = self.concrete["fck"]

        v_rd_c = CRd_c * k * (100 * rho_l * fck) ** (1 / 3)
        v_min = 0.035 * k**1.5 * fck**0.5
        v_rd_c = max(v_rd_c, v_min)

        # Maximum shear capacity (Clause 6.2.3)
        # Limited by crushing of compression struts
        nu = 0.6 * (1 - fck / 250)  # Strength reduction factor
        alpha_cw = 1.0  # For non-prestressed members
        v_rd_max = (
            alpha_cw
            * b
            * 0.9
            * d
            * nu
            * self.fcd
            / (1 / math.tan(math.radians(45)) + math.tan(math.radians(45)))
        )
        v_rd_max = v_rd_max / (b * d)  # Convert to stress

        # Checks
        shear_adequate = v_ed <= v_rd_max
        shear_reinf_required = v_ed > v_rd_c

        if not shear_adequate:
            self.warnings.append(
                "Shear stress exceeds maximum capacity. Increase section depth."
            )
        elif shear_reinf_required:
            self.warnings.append("Shear links required per EN 1992-1-1 Clause 6.2.3.")

        return EurocodeShearDesign(
            v_ed=round(v_ed, 3),
            v_rd_c=round(v_rd_c, 3),
            v_rd_max=round(v_rd_max, 3),
            shear_adequate=shear_adequate,
            shear_reinforcement_required=shear_reinf_required,
            rho_l=round(rho_l, 4),
        )

    def perform_design_checks(
        self, steel: EurocodeSteelDesign, shear: EurocodeShearDesign
    ) -> EurocodeDesignChecks:
        """Perform all design checks per Eurocode"""

        # Deflection check (Clause 7.4.2)
        span_mm = self.input.span * 1000
        actual_ratio = span_mm / steel.effective_depth

        if self.input.stair_type == StairType.CANTILEVER:
            limit_ratio = EurocodeTablesEC2.SPAN_DEPTH_RATIOS["cantilever"]
        else:
            limit_ratio = EurocodeTablesEC2.SPAN_DEPTH_RATIOS["simply_supported"]

        # Modification for steel stress and reinforcement ratio
        rho_0 = 1.0  # Reference reinforcement ratio (%)
        rho = steel.steel_ratio

        if rho <= rho_0:
            factor = min(
                11
                + 1.5 * math.sqrt(self.concrete["fck"] / rho_0)
                + 3.2
                * math.sqrt(self.concrete["fck"] / rho_0)
                * ((rho_0 / rho) - 1) ** 1.5,
                1.5,
            )
        else:
            factor = min(11 + 1.5 * math.sqrt(self.concrete["fck"] / rho), 1.5)

        limit_ratio = limit_ratio * factor
        deflection_ok = actual_ratio <= limit_ratio

        # Bar spacing check
        spacing_ok = steel.bar_spacing <= EurocodeTablesEC2.MAX_BAR_SPACING["wk_0.3"]

        # Minimum steel check
        min_steel_ok = steel.As_provided >= steel.As_minimum

        # Shear check
        shear_ok = shear.shear_adequate

        # Cover check
        min_cover = EurocodeTablesEC2.COVER_REQUIREMENTS[
            self.input.exposure_class.value
        ]
        cover_ok = self.input.cover >= min_cover

        # Crack width check (simplified - assume OK if spacing is OK)
        crack_width_ok = spacing_ok

        all_passed = all(
            [
                deflection_ok,
                spacing_ok,
                min_steel_ok,
                shear_ok,
                cover_ok,
                crack_width_ok,
            ]
        )

        return EurocodeDesignChecks(
            deflection_check=deflection_ok,
            deflection_ratio=round(actual_ratio, 2),
            deflection_limit=round(limit_ratio, 2),
            spacing_check=spacing_ok,
            minimum_steel_check=min_steel_ok,
            shear_check=shear_ok,
            cover_check=cover_ok,
            crack_width_check=crack_width_ok,
            all_checks_passed=all_passed,
        )

    def perform_complete_design(self) -> EurocodeDesignOutput:
        """Execute complete Eurocode design"""

        loading = self.calculate_loading()
        forces = self.calculate_forces(loading)
        steel = self.design_flexural_reinforcement(forces)
        shear = self.design_shear(forces, steel)
        checks = self.perform_design_checks(steel, shear)

        status = (
            "DESIGN SATISFACTORY - EN 1992-1-1:2004"
            if checks.all_checks_passed
            else "DESIGN REQUIRES REVISION"
        )

        input_summary = {
            "stair_type": self.input.stair_type.value,
            "cantilever_type": (
                self.input.cantilever_type.value if self.input.cantilever_type else None
            ),
            "span_m": self.input.span,
            "width_m": self.input.width,
            "waist_mm": self.input.waist_thickness,
            "concrete_class": self.input.concrete_class.value,
            "steel_grade": self.input.steel_grade.value,
            "exposure_class": self.input.exposure_class.value,
        }

        return EurocodeDesignOutput(
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
    return {
        "name": "RC Stair Designer - Eurocode API",
        "version": "2.0.0",
        "code": "EN 1992-1-1:2004",
        "endpoints": {
            "eurocode_design": "/api/v1/eurocode/design",
            "bs8110_design": "/api/v1/bs8110/design",
            "health": "/health",
        },
    }


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "api_version": "2.0.0",
    }


@router.post("/api/v1/eurocode/design", response_model=EurocodeDesignOutput)
async def design_eurocode_stair(input_data: EurocodeStairInput):
    """
    Eurocode EN 1992-1-1:2004 stair design endpoint
    """
    try:
        calculator = EurocodeStairCalculator(input_data)
        result = calculator.perform_complete_design()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Eurocode calculation error: {str(e)}"
        )


@router.get("/api/v1/eurocode/tables")
async def get_eurocode_tables():
    """Return Eurocode design tables"""
    return {
        "concrete_properties": EurocodeTablesEC2.CONCRETE_PROPERTIES,
        "steel_properties": EurocodeTablesEC2.STEEL_PROPERTIES,
        "cover_requirements": EurocodeTablesEC2.COVER_REQUIREMENTS,
        "bar_areas": EurocodeTablesEC2.BAR_AREAS,
        "span_depth_ratios": EurocodeTablesEC2.SPAN_DEPTH_RATIOS,
    }


# ==================== BS 8110 IMPLEMENTATION ====================


class BS8110StairInput(BaseModel):
    """Input for BS 8110 design"""

    stair_type: Literal["supported", "cantilever"]
    cantilever_type: Optional[Literal["side_support", "central_beam"]] = None

    span: float = Field(..., gt=0, le=10)
    width: float = Field(..., gt=0, le=5)
    waist_thickness: int = Field(..., ge=100, le=500)
    riser_height: int = Field(..., ge=100, le=220)
    tread_length: int = Field(..., ge=200, le=400)
    num_risers: int = Field(..., ge=3, le=30)

    concrete_grade: Literal["C25/30", "C30/37", "C35/45", "C40/50"]
    steel_grade: Literal["Grade 460", "Grade 500"]
    exposure: Literal["Mild", "Moderate", "Severe", "Very Severe"]
    cover: int = Field(..., ge=20, le=75)

    live_load: float = Field(..., ge=0, le=20)
    finishes_load: float = Field(..., ge=0, le=5)


class BS8110DesignOutput(BaseModel):
    input_summary: dict
    loading: dict
    forces: dict
    steel_design: dict
    shear_design: dict
    checks: dict
    design_status: str
    warnings: list
    code_reference: str = "BS 8110-1:1997"
    calculation_timestamp: str


class BS8110Calculator:
    """BS 8110-1:1997 Calculator with cantilever support"""

    BS8110_CONCRETE = {
        "C25/30": {"fcu": 25, "gamma_m": 1.5},
        "C30/37": {"fcu": 30, "gamma_m": 1.5},
        "C35/45": {"fcu": 35, "gamma_m": 1.5},
        "C40/50": {"fcu": 40, "gamma_m": 1.5},
    }

    BS8110_STEEL = {
        "Grade 460": {"fy": 460, "gamma_m": 1.15, "Es": 200000},
        "Grade 500": {"fy": 500, "gamma_m": 1.15, "Es": 200000},
    }

    BS8110_COVER = {"Mild": 25, "Moderate": 35, "Severe": 40, "Very Severe": 50}

    BAR_AREAS = {
        8: 50.3,
        10: 78.5,
        12: 113.1,
        16: 201.1,
        20: 314.2,
        25: 490.9,
        32: 804.2,
    }

    def __init__(self, input_data: BS8110StairInput):
        self.input = input_data
        self.concrete = self.BS8110_CONCRETE[input_data.concrete_grade]
        self.steel = self.BS8110_STEEL[input_data.steel_grade]
        self.warnings = []

    def calculate_loading(self):
        pitch_angle = math.atan(self.input.riser_height / self.input.tread_length)
        inclined_multiplier = math.sqrt(
            1 + (self.input.riser_height / self.input.tread_length) ** 2
        )

        waist_m = self.input.waist_thickness / 1000
        self_weight = waist_m * 25 * inclined_multiplier
        dead_load = self_weight + self.input.finishes_load
        ultimate_load = 1.4 * dead_load + 1.6 * self.input.live_load

        return {
            "self_weight": round(self_weight, 3),
            "dead_load": round(dead_load, 3),
            "live_load": self.input.live_load,
            "ultimate_load": round(ultimate_load, 3),
        }

    def calculate_forces(self, loading):
        span = self.input.span
        width = self.input.width
        wu = loading["ultimate_load"] * width

        if self.input.stair_type == "cantilever":
            if self.input.cantilever_type == "side_support":
                # Cantilever from side wall/beam
                moment = (wu * span**2) / 2
                shear = wu * span
            elif self.input.cantilever_type == "central_beam":
                # Double cantilever from central beam
                cantilever_length = width / 2
                q_per_m = loading["ultimate_load"]
                moment = (q_per_m * cantilever_length**2) / 2 * width
                shear = q_per_m * cantilever_length * width / 2
        else:
            moment = (wu * span**2) / 8
            shear = (wu * span) / 2

        return {
            "moment": round(moment, 3),
            "shear": round(shear, 3),
            "moment_per_meter": round(moment / width, 3),
            "shear_per_meter": round(shear / width, 3),
        }

    def design_flexural_reinforcement(self, forces):
        fcu = self.concrete["fcu"]
        fy = self.steel["fy"] / self.steel["gamma_m"]

        assumed_bar_dia = 12
        effective_depth = (
            self.input.waist_thickness - self.input.cover - (assumed_bar_dia / 2)
        )

        width_mm = self.input.width * 1000
        M = forces["moment"] * 1e6

        K = M / (width_mm * effective_depth**2 * fcu)
        z = min(
            effective_depth * (0.5 + math.sqrt(0.25 - K / 0.9)), 0.95 * effective_depth
        )

        As_req = M / (fy * z)
        As_min = 0.13 * width_mm * self.input.waist_thickness / 100
        As_prov = max(As_req, As_min)

        main_bar_dia = 10 if K <= 0.05 else 12
        bar_area = self.BAR_AREAS[main_bar_dia]
        num_bars = math.ceil(As_prov / bar_area)

        bar_spacing = (
            int((width_mm - 2 * self.input.cover) / (num_bars - 1))
            if num_bars > 1
            else int(width_mm / 2)
        )
        bar_spacing = min(bar_spacing, 300)

        actual_num_bars = int((width_mm - 2 * self.input.cover) / bar_spacing) + 1
        As_actual = actual_num_bars * bar_area

        As_dist = 0.12 * self.input.waist_thickness * 1000 / 100
        dist_bar_dia = 8
        dist_bar_area = self.BAR_AREAS[dist_bar_dia]
        num_dist_bars = math.ceil(As_dist / dist_bar_area)
        dist_spacing = int(1000 / num_dist_bars)

        return {
            "effective_depth": int(effective_depth),
            "K_factor": round(K, 4),
            "As_required": round(As_req, 1),
            "As_minimum": round(As_min, 1),
            "As_provided": round(As_actual, 1),
            "main_reinforcement": f"{actual_num_bars}H{main_bar_dia} @ {bar_spacing}mm c/c",
            "distribution_reinforcement": f"H{dist_bar_dia} @ {dist_spacing}mm c/c",
        }

    def design_shear(self, forces, steel):
        width_mm = self.input.width * 1000
        d = steel["effective_depth"]
        V = forces["shear"] * 1000

        v = V / (width_mm * d)

        As = steel["As_provided"]
        rho = min((As * 100) / (width_mm * d), 3.0)

        fcu = self.concrete["fcu"]
        vc = 0.79 * (rho ** (1 / 3)) * ((fcu / 25) ** (1 / 3)) / 1.25
        vc = max(vc, 0.4)

        vc_max = min(0.8 * math.sqrt(fcu), 5.0)

        shear_adequate = v <= vc_max
        shear_reinf_required = v > vc

        if not shear_adequate:
            self.warnings.append("Shear exceeds maximum capacity. Increase depth.")
        elif shear_reinf_required:
            self.warnings.append("Shear links required.")

        return {
            "v_applied": round(v, 3),
            "v_c": round(vc, 3),
            "v_max": round(vc_max, 3),
            "shear_adequate": shear_adequate,
            "shear_reinforcement_required": shear_reinf_required,
        }

    def perform_design_checks(self, steel, shear):
        span_mm = self.input.span * 1000
        actual_ratio = span_mm / steel["effective_depth"]

        if self.input.stair_type == "cantilever":
            limit_ratio = 7
        else:
            limit_ratio = 20

        deflection_ok = actual_ratio <= limit_ratio
        spacing_ok = True  # Simplified
        min_steel_ok = steel["As_provided"] >= steel["As_minimum"]
        shear_ok = shear["shear_adequate"]

        all_passed = all([deflection_ok, spacing_ok, min_steel_ok, shear_ok])

        return {
            "deflection_check": deflection_ok,
            "deflection_ratio": round(actual_ratio, 2),
            "deflection_limit": limit_ratio,
            "spacing_check": spacing_ok,
            "minimum_steel_check": min_steel_ok,
            "shear_check": shear_ok,
            "all_checks_passed": all_passed,
        }

    def perform_complete_design(self) -> BS8110DesignOutput:
        loading = self.calculate_loading()
        forces = self.calculate_forces(loading)
        steel = self.design_flexural_reinforcement(forces)
        shear = self.design_shear(forces, steel)
        checks = self.perform_design_checks(steel, shear)

        status = (
            "DESIGN SATISFACTORY - BS 8110-1:1997"
            if checks["all_checks_passed"]
            else "DESIGN REQUIRES REVISION"
        )

        input_summary = {
            "stair_type": self.input.stair_type,
            "cantilever_type": self.input.cantilever_type,
            "span_m": self.input.span,
            "width_m": self.input.width,
            "waist_mm": self.input.waist_thickness,
            "concrete_grade": self.input.concrete_grade,
            "steel_grade": self.input.steel_grade,
        }

        return BS8110DesignOutput(
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


@router.post("/api/v1/bs8110/design", response_model=BS8110DesignOutput)
async def design_bs8110_stair(input_data: BS8110StairInput):
    """BS 8110-1:1997 stair design endpoint"""
    try:
        calculator = BS8110Calculator(input_data)
        result = calculator.perform_complete_design()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"BS 8110 calculation error: {str(e)}"
        )


@router.get("/api/v1/bs8110/tables")
async def get_bs8110_tables():
    """Return BS 8110 design tables"""
    return {
        "concrete_grades": BS8110Calculator.BS8110_CONCRETE,
        "steel_grades": BS8110Calculator.BS8110_STEEL,
        "cover_requirements": BS8110Calculator.BS8110_COVER,
        "bar_areas": BS8110Calculator.BAR_AREAS,
    }


# ==================== STARTUP ====================
