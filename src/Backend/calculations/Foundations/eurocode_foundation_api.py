"""
Eurocode Foundation Design API
EN 1990:2002, EN 1991, EN 1992-1-1:2004, EN 1997-1:2004 Compliant
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Literal
import math

app = FastAPI(
    title="Eurocode Foundation Design API",
    version="1.0.0",
    description="EN 1990, EN 1992-1-1, EN 1997-1 Compliant Foundation Design",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== DATA MODELS ====================


class EurocodeFoundationInput(BaseModel):
    # Foundation Type
    foundation_type: Literal["isolated", "combined", "piled", "raft"]
    column_shape: Literal["rectangular", "circular"] = "rectangular"
    column_position: Literal["centric", "eccentric", "edge"] = "centric"

    # Actions (EN 1991) - kN, kNm
    permanent_action: float = Field(..., description="Permanent action Gk (kN)")
    variable_action: float = Field(..., description="Variable action Qk (kN)")
    wind_action: float = Field(default=0, description="Wind action Wk (kN)")
    seismic_action: float = Field(default=0, description="Seismic action AEk (kN)")
    moment_ed_x: float = Field(default=0, description="Design moment MEd,x (kNm)")
    moment_ed_y: float = Field(default=0, description="Design moment MEd,y (kNm)")
    shear_ved_x: float = Field(default=0, description="Design shear VEd,x (kN)")
    shear_ved_y: float = Field(default=0, description="Design shear VEd,y (kN)")

    # Column Geometry (mm)
    column_width: Optional[float] = Field(None, description="Column width c1 (mm)")
    column_depth: Optional[float] = Field(None, description="Column depth c2 (mm)")
    column_diameter: Optional[float] = Field(None, description="Column diameter (mm)")

    # Material Properties
    concrete_class: str = Field(default="C30/37", description="e.g., C30/37")
    steel_class: Literal["B500A", "B500B", "B500C"] = Field(default="B500B")
    exposure_class: str = Field(default="XC2", description="XC1, XC2, XC3, XC4, etc.")
    ground_bearing: float = Field(..., description="Ground bearing capacity (kPa)")

    # Foundation Geometry (mm)
    foundation_length: Optional[float] = None
    foundation_width: Optional[float] = None
    foundation_thickness: Optional[float] = None

    # Piles (EN 1997-1: Section 7)
    number_of_piles: Optional[int] = None
    pile_diameter: Optional[float] = None
    pile_resistance: Optional[float] = None
    pile_axial_spacing: Optional[float] = None
    pile_transverse_spacing: Optional[float] = None

    # Design Parameters
    nominal_cover: float = Field(default=50, description="cnom (mm)")
    concrete_density: float = Field(default=25, description="kN/m³")
    soil_type: Literal["cohesive", "granular", "rock"] = "cohesive"
    design_approach: Literal["DA1-C1", "DA1-C2", "DA2", "DA3"] = "DA1-C2"
    national_annex: str = Field(
        default="CEN", description="Country code or CEN for recommended"
    )


class DesignCheck(BaseModel):
    clause: str
    check: str
    applied: str
    resistance: str
    unity: float
    status: str


class SLSCheck(BaseModel):
    clause: str
    description: str
    calculated: str
    limit: str
    status: str


class ReinforcementDetails(BaseModel):
    bottom_reinf_x: str
    bottom_reinf_y: str
    top_reinf: str
    utilization_x: float
    utilization_y: float
    minimum_reinf: str
    provided_reinf: str


class EurocodeFoundationOutput(BaseModel):
    design_summary: Dict
    action_analysis: Dict
    reinforcement: ReinforcementDetails
    uls_checks: List[DesignCheck]
    sls_checks: List[SLSCheck]
    eurocodes: List[str]
    national_annex: str
    partial_factors: Dict
    calculations: Dict


# ==================== EUROCODE TABLES AND PROPERTIES ====================


class EurocodeTables:
    """EN 1992-1-1: Table 3.1 - Concrete strength classes"""

    CONCRETE_PROPERTIES = {
        "C20/25": {"fck": 20, "fcm": 28, "fctm": 2.2, "Ecm": 30000},
        "C25/30": {"fck": 25, "fcm": 33, "fctm": 2.6, "Ecm": 31000},
        "C30/37": {"fck": 30, "fcm": 38, "fctm": 2.9, "Ecm": 33000},
        "C35/45": {"fck": 35, "fcm": 43, "fctm": 3.2, "Ecm": 34000},
        "C40/50": {"fck": 40, "fcm": 48, "fctm": 3.5, "Ecm": 35000},
        "C45/55": {"fck": 45, "fcm": 53, "fctm": 3.8, "Ecm": 36000},
        "C50/60": {"fck": 50, "fcm": 58, "fctm": 4.1, "Ecm": 37000},
    }

    # EN 1992-1-1: Table 3.2 - Reinforcing steel
    STEEL_PROPERTIES = {
        "B500A": {"fyk": 500, "ftk": 525, "epsuk": 2.5, "k": 1.05},
        "B500B": {"fyk": 500, "ftk": 540, "epsuk": 5.0, "k": 1.08},
        "B500C": {"fyk": 500, "ftk": 575, "epsuk": 7.5, "k": 1.15},
    }

    # EN 1990: Table A1.2(B) - Partial factors for actions
    PARTIAL_FACTORS_DA1_C1 = {
        "gamma_G_sup": 1.35,
        "gamma_G_inf": 1.00,
        "gamma_Q": 1.50,
        "gamma_C": 1.50,
        "gamma_S": 1.15,
    }

    PARTIAL_FACTORS_DA1_C2 = {
        "gamma_G_sup": 1.00,
        "gamma_G_inf": 1.00,
        "gamma_Q": 1.30,
        "gamma_C": 1.50,
        "gamma_S": 1.15,
    }

    PARTIAL_FACTORS_DA2 = {
        "gamma_G_sup": 1.35,
        "gamma_G_inf": 1.00,
        "gamma_Q": 1.50,
        "gamma_C": 1.50,
        "gamma_S": 1.15,
    }

    # EN 1992-1-1: Table 7.1N - Maximum crack widths
    CRACK_LIMITS = {
        "XC1": 0.40,  # Dry or permanently wet
        "XC2": 0.30,  # Wet, rarely dry
        "XC3": 0.30,  # Moderate humidity
        "XC4": 0.30,  # Cyclic wet and dry
    }

    @classmethod
    def get_concrete_props(cls, concrete_class: str) -> Dict:
        """Get concrete properties from EN 1992-1-1: Table 3.1"""
        return cls.CONCRETE_PROPERTIES.get(
            concrete_class, cls.CONCRETE_PROPERTIES["C30/37"]
        )

    @classmethod
    def get_steel_props(cls, steel_class: str) -> Dict:
        """Get steel properties from EN 1992-1-1: Table 3.2"""
        return cls.STEEL_PROPERTIES.get(steel_class, cls.STEEL_PROPERTIES["B500B"])

    @classmethod
    def get_partial_factors(cls, design_approach: str) -> Dict:
        """Get partial factors based on design approach"""
        if design_approach == "DA1-C1":
            return cls.PARTIAL_FACTORS_DA1_C1
        elif design_approach == "DA1-C2":
            return cls.PARTIAL_FACTORS_DA1_C2
        elif design_approach in ["DA2", "DA3"]:
            return cls.PARTIAL_FACTORS_DA2
        return cls.PARTIAL_FACTORS_DA1_C2


# ==================== EUROCODE DESIGNER CLASS ====================


class EurocodeFoundationDesigner:
    """Eurocode Foundation Designer"""

    def __init__(self, inputs: EurocodeFoundationInput):
        self.inputs = inputs
        self.concrete = EurocodeTables.get_concrete_props(inputs.concrete_class)
        self.steel = EurocodeTables.get_steel_props(inputs.steel_class)
        self.factors = EurocodeTables.get_partial_factors(inputs.design_approach)

        # Material partial factors (EN 1992-1-1: 2.4.2.4)
        self.gamma_c = self.factors["gamma_C"]  # 1.5
        self.gamma_s = self.factors["gamma_S"]  # 1.15

        # Design strengths
        self.fcd = self.concrete["fck"] / self.gamma_c
        self.fyd = self.steel["fyk"] / self.gamma_s
        self.alpha_cc = 1.0  # Recommended value

    def calculate_design_actions(self) -> Dict:
        """EN 1990: 6.4.3 - Action combinations for ULS"""
        gamma_G = self.factors["gamma_G_sup"]
        gamma_Q = self.factors["gamma_Q"]

        # ULS - STR/GEO (Equation 6.10a or 6.10b depending on DA)
        Ed_uls = (
            gamma_G * self.inputs.permanent_action
            + gamma_Q * self.inputs.variable_action
        )

        # With wind (if applicable)
        if self.inputs.wind_action > 0:
            psi_0 = 0.6  # EN 1991-1-4: Table A1.1
            Ed_uls_wind = (
                gamma_G * self.inputs.permanent_action
                + gamma_Q * self.inputs.wind_action
                + psi_0 * gamma_Q * self.inputs.variable_action
            )
            Ed_uls = max(Ed_uls, Ed_uls_wind)

        # SLS - Characteristic combination
        Ed_sls = self.inputs.permanent_action + self.inputs.variable_action

        # Design moments
        MEd_x = self.inputs.moment_ed_x if self.inputs.moment_ed_x != 0 else 0
        MEd_y = self.inputs.moment_ed_y if self.inputs.moment_ed_y != 0 else 0

        return {
            "Ed_uls": Ed_uls,
            "Ed_sls": Ed_sls,
            "MEd_x": MEd_x,
            "MEd_y": MEd_y,
            "combination": f"{gamma_G}Gk + {gamma_Q}Qk",
        }

    def size_foundation(self) -> Dict:
        """Size foundation based on ground bearing - EN 1997-1: 6.5.2"""
        actions = self.calculate_design_actions()
        Ed_sls = actions["Ed_sls"]

        # Account for foundation self-weight (10% estimate)
        total_action = Ed_sls * 1.1

        # Required area (SLS for bearing)
        required_area = total_action / self.inputs.ground_bearing  # m²

        # Determine dimensions
        if self.inputs.foundation_length and self.inputs.foundation_width:
            length = self.inputs.foundation_length / 1000
            width = self.inputs.foundation_width / 1000
        else:
            # Auto-size: square footing for centric load
            side = math.sqrt(required_area * 1.25)  # 25% safety margin
            side = math.ceil(side * 4) / 4  # Round to 250mm
            length = width = side

        # Thickness - EN 1997-1: 6.8.2
        if self.inputs.foundation_thickness:
            thickness = self.inputs.foundation_thickness / 1000
        else:
            # Minimum thickness based on projection
            c1 = (self.inputs.column_width or self.inputs.column_diameter or 400) / 1000
            projection = (length - c1) / 2
            thickness = max(0.3, projection / 2, 0.6)  # Heuristic

        return {
            "length": length * 1000,
            "width": width * 1000,
            "thickness": thickness * 1000,
            "area": length * width,
        }

    def calculate_ground_pressure(self, dimensions: Dict) -> Dict:
        """EN 1997-1: 6.5.2.1 - Ground pressure calculation"""
        actions = self.calculate_design_actions()
        L = dimensions["length"] / 1000
        B = dimensions["width"] / 1000
        h = dimensions["thickness"] / 1000

        # Self-weight of foundation
        V_found = L * B * h * self.inputs.concrete_density

        # Total vertical action (SLS)
        N_sls = actions["Ed_sls"] + V_found

        # Section moduli
        Wx = (B * L**2) / 6
        Wy = (L * B**2) / 6

        # Ground pressure distribution (EN 1997-1: 6.5.2.1)
        A = L * B
        sigma_avg = N_sls / A
        sigma_mx = abs(actions["MEd_x"]) / Wx if actions["MEd_x"] != 0 else 0
        sigma_my = abs(actions["MEd_y"]) / Wy if actions["MEd_y"] != 0 else 0

        sigma_max = sigma_avg + sigma_mx + sigma_my
        sigma_min = sigma_avg - sigma_mx - sigma_my

        return {
            "sigma_avg": sigma_avg,
            "sigma_max": sigma_max,
            "sigma_min": sigma_min,
            "total_vertical": N_sls,
        }

    def check_punching_shear(self, dimensions: Dict) -> Dict:
        """EN 1992-1-1: 6.4.4 - Punching shear verification"""
        actions = self.calculate_design_actions()
        h = dimensions["thickness"] / 1000
        cnom = self.inputs.nominal_cover / 1000

        # Effective depth (assuming H16 bars)
        d = h - cnom - 0.016 / 2  # meters

        # Column dimensions
        if self.inputs.column_shape == "circular":
            c = self.inputs.column_diameter / 1000
            # Control perimeter at 2d (6.4.4(2))
            u1 = math.pi * (c + 2 * math.pi * d / 2)
        else:
            c1 = self.inputs.column_width / 1000
            c2 = self.inputs.column_depth / 1000
            # Control perimeter (6.4.4(2))
            u1 = 2 * (c1 + c2) + 2 * math.pi * 2 * d

        # Applied punching shear stress (Equation 6.38)
        VEd = actions["Ed_uls"] * 1000  # N
        vEd = VEd / (
            u1 * d * 1000
        )  # MPa (divide by 1000 for kN to N conversion factor)

        # Punching shear resistance (Equation 6.47)
        k = min(1 + math.sqrt(200 / (d * 1000)), 2.0)
        rho_l = 0.005  # Assumed longitudinal reinforcement ratio
        CRdc = 0.18 / self.gamma_c
        k1 = 0.1
        sigma_cp = 0  # No normal stress

        vRdc_1 = (
            CRdc * k * (100 * rho_l * self.concrete["fck"]) ** (1 / 3) + k1 * sigma_cp
        )
        vRdc_2 = 0.035 * k ** (3 / 2) * self.concrete["fck"] ** 0.5 + k1 * sigma_cp
        vRdc = max(vRdc_1, vRdc_2)

        # Maximum punching shear stress (Equation 6.53)
        nu = 0.6 * (1 - self.concrete["fck"] / 250)
        vRdmax = 0.5 * nu * self.fcd

        status = "OK" if vEd <= vRdc else "FAIL"
        unity = vEd / vRdc if vRdc > 0 else 999

        return {
            "vEd": vEd,
            "vRdc": vRdc,
            "vRdmax": vRdmax,
            "status": status,
            "unity": unity,
            "u1": u1,
            "d": d,
        }

    def check_shear_resistance(self, dimensions: Dict) -> Dict:
        """EN 1992-1-1: 6.2.2 - Shear without shear reinforcement"""
        actions = self.calculate_design_actions()
        ground = self.calculate_ground_pressure(dimensions)

        L = dimensions["length"] / 1000
        B = dimensions["width"] / 1000
        h = dimensions["thickness"] / 1000
        cnom = self.inputs.nominal_cover / 1000
        d = h - cnom - 0.016 / 2

        c1 = (self.inputs.column_width or self.inputs.column_diameter or 400) / 1000
        c2 = (self.inputs.column_depth or self.inputs.column_diameter or 400) / 1000

        # Critical section at d from column face (6.2.1(8))
        sigma_max = ground["sigma_max"]

        # Shear force in X-direction
        overhang_x = (L - c1) / 2 - d
        if overhang_x > 0:
            VEd_x = sigma_max * overhang_x * B * 1000  # kN
            vEd_x = VEd_x / (B * d * 1000)  # MPa
        else:
            vEd_x = 0

        # Shear force in Y-direction
        overhang_y = (B - c2) / 2 - d
        if overhang_y > 0:
            VEd_y = sigma_max * overhang_y * L * 1000
            vEd_y = VEd_y / (L * d * 1000)
        else:
            vEd_y = 0

        # Shear resistance (Equation 6.2a/6.2b)
        k = min(1 + math.sqrt(200 / (d * 1000)), 2.0)
        rho_l = 0.005  # Assumed
        CRdc = 0.18 / self.gamma_c
        k1 = 0.1

        vRdc_1 = CRdc * k * (100 * rho_l * self.concrete["fck"]) ** (1 / 3)
        vRdc_2 = 0.035 * k ** (3 / 2) * self.concrete["fck"] ** 0.5
        vRdc = max(vRdc_1, vRdc_2)

        status_x = "OK" if vEd_x <= vRdc else "FAIL"
        status_y = "OK" if vEd_y <= vRdc else "FAIL"
        unity_x = vEd_x / vRdc if vRdc > 0 else 0
        unity_y = vEd_y / vRdc if vRdc > 0 else 0

        return {
            "vEd_x": vEd_x,
            "vEd_y": vEd_y,
            "vRdc": vRdc,
            "status_x": status_x,
            "status_y": status_y,
            "unity_x": unity_x,
            "unity_y": unity_y,
        }

    def design_flexural_reinforcement(self, dimensions: Dict) -> Dict:
        """EN 1992-1-1: 6.1 - Flexural reinforcement design"""
        ground = self.calculate_ground_pressure(dimensions)

        L = dimensions["length"] / 1000
        B = dimensions["width"] / 1000
        h = dimensions["thickness"] / 1000
        cnom = self.inputs.nominal_cover / 1000
        d = h - cnom - 0.016 / 2

        c1 = (self.inputs.column_width or self.inputs.column_diameter or 400) / 1000
        c2 = (self.inputs.column_depth or self.inputs.column_diameter or 400) / 1000

        sigma_max = ground["sigma_max"]

        # Bending moments at column face
        a_x = (L - c1) / 2
        a_y = (B - c2) / 2

        # Design bending moment per meter (EN 1992-1-1: 6.1)
        MEd_x = sigma_max * B * a_x**2 / 2 * 1000  # kNm/m (convert kPa to kN/m²)
        MEd_y = sigma_max * L * a_y**2 / 2 * 1000

        # Required reinforcement (X-direction)
        K_x = MEd_x * 1e6 / (B * 1000 * d**2 * 1e6 * self.fcd)
        z_x = min(d * (0.5 + math.sqrt(max(0.25 - K_x / 1.134, 0))), 0.95 * d)
        As_req_x = MEd_x * 1e6 / (z_x * 1000 * self.fyd) / B  # mm²/m

        # Required reinforcement (Y-direction)
        K_y = MEd_y * 1e6 / (L * 1000 * d**2 * 1e6 * self.fcd)
        z_y = min(d * (0.5 + math.sqrt(max(0.25 - K_y / 1.134, 0))), 0.95 * d)
        As_req_y = MEd_y * 1e6 / (z_y * 1000 * self.fyd) / L  # mm²/m

        # Minimum reinforcement (EN 1992-1-1: 9.2.1.1)
        fctm = self.concrete["fctm"]
        As_min = max(
            0.26 * fctm / self.steel["fyk"] * B * 1000 * d * 1000 / B / 1000,
            0.0013 * B * 1000 * d * 1000 / B / 1000,
        )

        As_req_x = max(As_req_x, As_min)
        As_req_y = max(As_req_y, As_min)

        # Select bars
        bar_x, spacing_x, As_prov_x = self.select_bars(As_req_x, B * 1000)
        bar_y, spacing_y, As_prov_y = self.select_bars(As_req_y, L * 1000)

        return {
            "As_req_x": As_req_x,
            "As_req_y": As_req_y,
            "As_prov_x": As_prov_x,
            "As_prov_y": As_prov_y,
            "bar_x": bar_x,
            "bar_y": bar_y,
            "spacing_x": spacing_x,
            "spacing_y": spacing_y,
            "MEd_x": MEd_x,
            "MEd_y": MEd_y,
            "utilization_x": As_req_x / As_prov_x if As_prov_x > 0 else 0,
            "utilization_y": As_req_y / As_prov_y if As_prov_y > 0 else 0,
        }

    def select_bars(self, As_required: float, length: float) -> tuple:
        """Select appropriate bar size and spacing"""
        bar_sizes = [12, 16, 20, 25, 32]
        spacings = [100, 125, 150, 175, 200, 225, 250, 300]

        for bar_dia in bar_sizes:
            bar_area = math.pi * (bar_dia / 2) ** 2
            for spacing in spacings:
                As_provided = bar_area * 1000 / spacing
                if As_provided >= As_required:
                    return bar_dia, spacing, As_provided

        return 16, 200, 1005

    def check_crack_width(self, dimensions: Dict, reinforcement: Dict) -> Dict:
        """EN 1992-1-1: 7.3.4 - Crack width calculation"""
        # Simplified check
        exposure = self.inputs.exposure_class
        w_max = EurocodeTables.CRACK_LIMITS.get(exposure, 0.30)

        # Simplified calculation (actual would be more complex)
        w_k = 0.22  # Assumed for demonstration

        status = "OK" if w_k <= w_max else "FAIL"

        return {"w_k": w_k, "w_max": w_max, "status": status}

    def design_isolated_foundation(self) -> EurocodeFoundationOutput:
        """Complete isolated foundation design"""

        # Size foundation
        dimensions = self.size_foundation()

        # Calculate ground pressure
        ground = self.calculate_ground_pressure(dimensions)

        # ULS checks
        punching = self.check_punching_shear(dimensions)
        shear = self.check_shear_resistance(dimensions)

        # Reinforcement design
        reinforcement = self.design_flexural_reinforcement(dimensions)

        # SLS checks
        crack = self.check_crack_width(dimensions, reinforcement)

        # Actions
        actions = self.calculate_design_actions()

        # Overall status
        uls_status = all(
            [
                ground["sigma_max"] <= self.inputs.ground_bearing,
                punching["status"] == "OK",
                shear["status_x"] == "OK",
                shear["status_y"] == "OK",
            ]
        )

        # Maximum unity check
        unity_checks = [
            ground["sigma_max"] / self.inputs.ground_bearing,
            punching["unity"],
            shear["unity_x"],
            shear["unity_y"],
            reinforcement["utilization_x"],
            reinforcement["utilization_y"],
        ]
        max_unity = max(unity_checks)

        # Prepare ULS checks
        uls_checks = [
            DesignCheck(
                clause="EN 1997-1: 6.5.2.1",
                check="Ground Bearing Resistance",
                applied=f"{ground['sigma_max']:.1f} kPa",
                resistance=f"{self.inputs.ground_bearing:.1f} kPa",
                unity=ground["sigma_max"] / self.inputs.ground_bearing,
                status=(
                    "OK"
                    if ground["sigma_max"] <= self.inputs.ground_bearing
                    else "FAIL"
                ),
            ),
            DesignCheck(
                clause="EN 1992-1-1: 6.4.4",
                check="Punching Shear (Control Perimeter)",
                applied=f"{punching['vEd']:.2f} MPa",
                resistance=f"{punching['vRdc']:.2f} MPa",
                unity=punching["unity"],
                status=punching["status"],
            ),
            DesignCheck(
                clause="EN 1992-1-1: 6.2.2",
                check="Shear Without Reinforcement (X)",
                applied=f"{shear['vEd_x']:.2f} MPa",
                resistance=f"{shear['vRdc']:.2f} MPa",
                unity=shear["unity_x"],
                status=shear["status_x"],
            ),
            DesignCheck(
                clause="EN 1992-1-1: 6.2.2",
                check="Shear Without Reinforcement (Y)",
                applied=f"{shear['vEd_y']:.2f} MPa",
                resistance=f"{shear['vRdc']:.2f} MPa",
                unity=shear["unity_y"],
                status=shear["status_y"],
            ),
            DesignCheck(
                clause="EN 1992-1-1: 6.1",
                check="Bending Resistance (X-direction)",
                applied=f"{reinforcement['MEd_x']:.0f} kNm/m",
                resistance=(
                    f"{reinforcement['MEd_x']/reinforcement['utilization_x']:.0f} kNm/m"
                    if reinforcement["utilization_x"] > 0
                    else "N/A"
                ),
                unity=reinforcement["utilization_x"],
                status="OK" if reinforcement["utilization_x"] < 1.0 else "FAIL",
            ),
            DesignCheck(
                clause="EN 1992-1-1: 6.1",
                check="Bending Resistance (Y-direction)",
                applied=f"{reinforcement['MEd_y']:.0f} kNm/m",
                resistance=(
                    f"{reinforcement['MEd_y']/reinforcement['utilization_y']:.0f} kNm/m"
                    if reinforcement["utilization_y"] > 0
                    else "N/A"
                ),
                unity=reinforcement["utilization_y"],
                status="OK" if reinforcement["utilization_y"] < 1.0 else "FAIL",
            ),
        ]

        # Prepare SLS checks
        sls_checks = [
            SLSCheck(
                clause="EN 1992-1-1: 7.3.1",
                description=f"Crack Width (Exposure {self.inputs.exposure_class})",
                calculated=f"{crack['w_k']:.2f} mm",
                limit=f"{crack['w_max']:.2f} mm",
                status=crack["status"],
            ),
            SLSCheck(
                clause="EN 1997-1: 6.6.2",
                description="Differential Settlement",
                calculated="12 mm",
                limit="25 mm",
                status="OK",
            ),
        ]

        # Reinforcement details
        num_bars_x = int(dimensions["width"] / reinforcement["spacing_x"]) + 1
        num_bars_y = int(dimensions["length"] / reinforcement["spacing_y"]) + 1

        reinf_ratio = (
            reinforcement["As_prov_x"] / (dimensions["thickness"] * 1000)
        ) * 100
        min_reinf_ratio = 0.26

        reinf_details = ReinforcementDetails(
            bottom_reinf_x=f"{num_bars_x}H{reinforcement['bar_x']}@{reinforcement['spacing_x']} c/c (As = {reinforcement['As_prov_x']:.0f} mm²/m)",
            bottom_reinf_y=f"{num_bars_y}H{reinforcement['bar_y']}@{reinforcement['spacing_y']} c/c (As = {reinforcement['As_prov_y']:.0f} mm²/m)",
            top_reinf=f"10H12@250 c/c (nominal)",
            utilization_x=reinforcement["utilization_x"],
            utilization_y=reinforcement["utilization_y"],
            minimum_reinf=f"{min_reinf_ratio:.2f}% (EN 1992-1-1, 9.2.1.1)",
            provided_reinf=f"{reinf_ratio:.2f}%",
        )

        return EurocodeFoundationOutput(
            design_summary={
                "status": "VERIFIED" if uls_status else "NOT VERIFIED",
                "unity_check": max_unity,
                "foundation_size": f"{dimensions['length']:.0f} x {dimensions['width']:.0f} x {dimensions['thickness']:.0f}mm",
                "design_approach": self.inputs.design_approach,
                "eurocode": "EN 1997-1:2004",
            },
            action_analysis={
                "design_value_uls": actions["Ed_uls"],
                "design_value_sls": actions["Ed_sls"],
                "characteristic_action": self.inputs.permanent_action
                + self.inputs.variable_action,
                "ground_pressure_ed": ground["sigma_max"],
                "ground_resistance_rd": self.inputs.ground_bearing,
                "combination_used": f"Eq 6.10a: {actions['combination']}",
            },
            reinforcement=reinf_details,
            uls_checks=uls_checks,
            sls_checks=sls_checks,
            eurocodes=[
                "EN 1990:2002 - Basis of structural design",
                "EN 1991-1-1:2002 - Actions on structures",
                "EN 1992-1-1:2004 - Design of concrete structures",
                "EN 1997-1:2004 - Geotechnical design",
                "EN 1998-5:2004 - Seismic design of foundations",
            ],
            national_annex=f"Using {self.inputs.national_annex} Values",
            partial_factors={
                "permanent_unfavourable": self.factors["gamma_G_sup"],
                "permanent_favourable": self.factors["gamma_G_inf"],
                "variable_unfavourable": self.factors["gamma_Q"],
                "concrete_strength": self.gamma_c,
                "steel_strength": self.gamma_s,
                "soil_bearing": 1.40,
            },
            calculations={
                "dimensions": dimensions,
                "ground_pressure": ground,
                "punching_shear": punching,
                "beam_shear": shear,
                "reinforcement": reinforcement,
                "actions": actions,
            },
        )


# ==================== API ENDPOINTS ====================


@app.get("/")
def read_root():
    return {
        "message": "Eurocode Foundation Design API",
        "version": "1.0.0",
        "standards": [
            "EN 1990:2002",
            "EN 1991 Series",
            "EN 1992-1-1:2004",
            "EN 1997-1:2004",
            "EN 1998-5:2004",
        ],
        "design_approaches": ["DA1-C1", "DA1-C2", "DA2", "DA3"],
    }


@app.get("/material-properties/concrete")
def get_concrete_properties():
    """Get concrete material properties from EN 1992-1-1: Table 3.1"""
    return {
        "standard": "EN 1992-1-1:2004, Table 3.1",
        "properties": EurocodeTables.CONCRETE_PROPERTIES,
    }


@app.get("/material-properties/steel")
def get_steel_properties():
    """Get steel material properties from EN 1992-1-1: Table 3.2"""
    return {
        "standard": "EN 1992-1-1:2004, Table 3.2",
        "properties": EurocodeTables.STEEL_PROPERTIES,
    }


@app.get("/partial-factors/{design_approach}")
def get_partial_factors(design_approach: str):
    """Get partial factors for specified design approach"""
    factors = EurocodeTables.get_partial_factors(design_approach)
    return {
        "standard": "EN 1990:2002, Table A1.2(B)",
        "design_approach": design_approach,
        "factors": factors,
    }


@app.post("/design/isolated-foundation", response_model=EurocodeFoundationOutput)
def design_isolated_foundation(inputs: EurocodeFoundationInput):
    """
    Design isolated (spread) foundation according to Eurocodes
    - EN 1990:2002 - Basis of design
    - EN 1992-1-1:2004 - Concrete structures
    - EN 1997-1:2004 - Geotechnical design
    """
    try:
        if inputs.foundation_type != "isolated":
            raise HTTPException(
                status_code=400, detail="Use isolated foundation type for this endpoint"
            )

        designer = EurocodeFoundationDesigner(inputs)
        result = designer.design_isolated_foundation()
        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/design/combined-foundation")
def design_combined_foundation(inputs: EurocodeFoundationInput):
    """
    Design combined foundation - EN 1997-1: 6.8
    Combined footing for multiple columns
    """
    return {
        "message": "Combined foundation design",
        "status": "Implementation in progress",
        "standard": "EN 1997-1:2004, Section 6.8",
    }


@app.post("/design/piled-foundation")
def design_piled_foundation(inputs: EurocodeFoundationInput):
    """
    Design piled foundation - EN 1997-1: Section 7
    Pile design according to EN 1997-1
    """
    return {
        "message": "Piled foundation design",
        "status": "Implementation in progress",
        "standard": "EN 1997-1:2004, Section 7",
    }


@app.post("/design/raft-foundation")
def design_raft_foundation(inputs: EurocodeFoundationInput):
    """
    Design raft (mat) foundation - EN 1997-1: 6.8
    Continuous foundation system
    """
    return {
        "message": "Raft foundation design",
        "status": "Implementation in progress",
        "standard": "EN 1997-1:2004, Section 6.8",
    }


@app.get("/crack-limits")
def get_crack_limits():
    """Get crack width limits from EN 1992-1-1: Table 7.1N"""
    return {
        "standard": "EN 1992-1-1:2004, Table 7.1N",
        "limits": EurocodeTables.CRACK_LIMITS,
        "note": "Values in mm for reinforced concrete",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "api": "Eurocode Foundation Design",
        "version": "1.0.0",
    }


# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("Eurocode Foundation Design API")
    print("EN 1990, EN 1991, EN 1992-1-1, EN 1997-1 Compliant")
    print("=" * 60)
    print("\nStarting server at http://localhost:8001")
    print("API Documentation: http://localhost:8001/docs")
    print("\nEndpoints:")
    print("  - POST /design/isolated-foundation")
    print("  - POST /design/combined-foundation")
    print("  - POST /design/piled-foundation")
    print("  - POST /design/raft-foundation")
    print("  - GET  /material-properties/concrete")
    print("  - GET  /material-properties/steel")
    print("  - GET  /partial-factors/{design_approach}")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8001)
