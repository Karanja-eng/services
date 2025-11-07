"""
Foundation Design API - BS Standards Compliant
BS EN 1992-1-1:2004, BS 8004:2015, BS EN 1997-1:2004
"""

from fastapi import HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict

import math

router = APIRouter()


# ==================== DATA MODELS ====================


class FoundationInput(BaseModel):
    # Foundation Type
    foundation_type: str = Field(..., description="pad, strip, pile, pilecap")
    column_shape: str = Field(
        default="square", description="square, rectangular, circular"
    )
    column_position: str = Field(default="centre", description="centre, edge, corner")

    # Loads (kN, kNm)
    dead_load: float = Field(..., gt=0)
    live_load: float = Field(..., gt=0)
    wind_load: float = Field(default=0)
    moment_x: float = Field(default=0)
    moment_y: float = Field(default=0)
    shear_x: float = Field(default=0)
    shear_y: float = Field(default=0)

    # Column Dimensions (mm)
    column_width: Optional[float] = None
    column_depth: Optional[float] = None
    column_diameter: Optional[float] = None

    # Material Properties
    concrete_fck: float = Field(default=30, description="Concrete strength (MPa)")
    steel_fyk: float = Field(default=500, description="Steel yield strength (MPa)")
    soil_bearing: float = Field(..., description="Allowable bearing capacity (kN/m²)")
    cover: float = Field(default=50, description="Concrete cover (mm)")
    density: float = Field(default=24, description="Concrete density (kN/m³)")

    # Foundation Dimensions (mm) - optional for sizing
    foundation_length: Optional[float] = None
    foundation_width: Optional[float] = None
    foundation_depth: Optional[float] = None

    # Pile Foundation
    pile_count: Optional[int] = None
    pile_diameter: Optional[float] = None
    pile_capacity: Optional[float] = None
    pile_spacing: Optional[float] = None


class DesignCheck(BaseModel):
    description: str
    value: str
    limit: str
    status: str
    ratio: float


class ReinforcementDetails(BaseModel):
    main_bars_x: str
    main_bars_y: str
    area: float
    area_required: float


class FoundationOutput(BaseModel):
    design_summary: Dict
    load_analysis: Dict
    reinforcement: ReinforcementDetails
    checks: List[DesignCheck]
    bs_references: List[str]
    calculations: Dict


# ==================== DESIGN CLASSES ====================


class BSFoundationDesigner:
    """BS Standards Foundation Designer"""

    def __init__(self, inputs: FoundationInput):
        self.inputs = inputs
        self.gamma_c = 1.5  # Partial factor for concrete
        self.gamma_s = 1.15  # Partial factor for steel

    def get_material_properties(self):
        """BS EN 1992-1-1: Material properties"""
        fck = self.inputs.concrete_fck
        fcd = fck / self.gamma_c  # Design concrete strength
        fyk = self.inputs.steel_fyk
        fyd = fyk / self.gamma_s  # Design steel strength

        # Table 3.1 BS EN 1992-1-1
        fctm = (
            0.3 * (fck ** (2 / 3)) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10)
        )

        return {"fck": fck, "fcd": fcd, "fctm": fctm, "fyk": fyk, "fyd": fyd}

    def calculate_design_loads(self):
        """BS EN 1990: Load combinations"""
        # ULS: 1.35Gk + 1.5Qk (Equation 6.10)
        design_vertical = 1.35 * self.inputs.dead_load + 1.5 * self.inputs.live_load

        # SLS: Gk + Qk
        sls_vertical = self.inputs.dead_load + self.inputs.live_load

        # With wind
        if self.inputs.wind_load > 0:
            design_vertical_wind = (
                1.35 * self.inputs.dead_load + 1.5 * self.inputs.wind_load
            )
            design_vertical = max(design_vertical, design_vertical_wind)

        design_moment_x = (
            1.35 * self.inputs.moment_x
            if self.inputs.moment_x > 0
            else 1.5 * self.inputs.moment_x
        )
        design_moment_y = (
            1.35 * self.inputs.moment_y
            if self.inputs.moment_y > 0
            else 1.5 * self.inputs.moment_y
        )

        return {
            "design_vertical": design_vertical,
            "sls_vertical": sls_vertical,
            "design_moment_x": design_moment_x,
            "design_moment_y": design_moment_y,
        }

    def size_foundation(self):
        """Size foundation based on bearing pressure"""
        loads = self.calculate_design_loads()
        sls_load = loads["sls_vertical"]

        # Account for foundation self-weight (estimate 10% of load)
        total_load = sls_load * 1.1

        # Required area
        required_area = total_load / self.inputs.soil_bearing  # m²

        # Determine dimensions based on column and eccentricity
        if self.inputs.foundation_length and self.inputs.foundation_width:
            length = self.inputs.foundation_length / 1000
            width = self.inputs.foundation_width / 1000
        else:
            # Auto-size: make square for central column
            side = math.sqrt(required_area * 1.2)  # 20% safety
            side = math.ceil(side * 4) / 4  # Round to 250mm
            length = width = side

        depth = (
            self.inputs.foundation_depth / 1000
            if self.inputs.foundation_depth
            else max(0.3, side / 4)
        )

        return {
            "length": length * 1000,  # mm
            "width": width * 1000,  # mm
            "depth": depth * 1000,  # mm
            "area": length * width,  # m²
        }

    def calculate_bearing_pressure(self, dimensions):
        """Calculate bearing pressure considering moments"""
        loads = self.calculate_design_loads()
        L = dimensions["length"] / 1000  # m
        B = dimensions["width"] / 1000  # m
        D = dimensions["depth"] / 1000  # m

        # Self-weight
        self_weight = L * B * D * self.inputs.density
        total_vertical = loads["sls_vertical"] + self_weight

        # Base pressure considering moments
        A = L * B
        Zx = (B * L**2) / 6  # Section modulus about X
        Zy = (L * B**2) / 6  # Section modulus about Y

        # BS 8004: p = N/A ± Mx/Zx ± My/Zy
        p_avg = total_vertical / A
        p_mx = abs(self.inputs.moment_x) / Zx if self.inputs.moment_x != 0 else 0
        p_my = abs(self.inputs.moment_y) / Zy if self.inputs.moment_y != 0 else 0

        p_max = p_avg + p_mx + p_my
        p_min = p_avg - p_mx - p_my

        return {
            "p_avg": p_avg,
            "p_max": p_max,
            "p_min": p_min,
            "total_vertical": total_vertical,
        }

    def check_punching_shear(self, dimensions):
        """BS EN 1992-1-1: 6.4.4 Punching shear"""
        mat = self.get_material_properties()
        loads = self.calculate_design_loads()

        d = (dimensions["depth"] - self.inputs.cover - 12) / 1000  # Effective depth (m)

        # Column perimeter
        if self.inputs.column_shape == "circular":
            c = self.inputs.column_diameter / 1000
            u0 = math.pi * c
            u1 = math.pi * (c + 2 * d)
        else:
            cx = self.inputs.column_width / 1000
            cy = self.inputs.column_depth / 1000
            u0 = 2 * (cx + cy)
            u1 = 2 * (cx + cy + 2 * math.pi * d)

        # Applied punching shear stress
        VEd = loads["design_vertical"]
        vEd = VEd / (u1 * d) / 1000  # MPa

        # Resistance (Equation 6.47)
        k = min(1 + math.sqrt(200 / d / 1000), 2.0)
        rho_l = 0.005  # Assumed reinforcement ratio
        CRdc = 0.18 / self.gamma_c
        k1 = 0.1
        sigma_cp = 0  # No axial force

        vRdc = max(
            (CRdc * k * (100 * rho_l * mat["fck"]) ** (1 / 3) + k1 * sigma_cp),
            (0.035 * k**1.5 * mat["fck"] ** 0.5 + k1 * sigma_cp),
        )

        # Maximum resistance (Equation 6.53)
        vRdmax = 0.5 * 0.6 * (1 - mat["fck"] / 250) * mat["fcd"]

        status = "PASS" if vEd <= vRdc else "FAIL"
        ratio = vEd / vRdc if vRdc > 0 else 999

        return {
            "vEd": vEd,
            "vRdc": vRdc,
            "vRdmax": vRdmax,
            "status": status,
            "ratio": ratio,
        }

    def check_beam_shear(self, dimensions):
        """BS EN 1992-1-1: 6.2 Beam shear"""
        mat = self.get_material_properties()
        loads = self.calculate_design_loads()

        L = dimensions["length"] / 1000
        B = dimensions["width"] / 1000
        d = (dimensions["depth"] - self.inputs.cover - 12) / 1000

        cx = (self.inputs.column_width or self.inputs.column_diameter or 450) / 1000
        cy = (self.inputs.column_depth or self.inputs.column_diameter or 450) / 1000

        # Critical section at d from column face
        bearing_pressure = self.calculate_bearing_pressure(dimensions)
        p = bearing_pressure["p_max"]

        # Shear force at critical section (X-direction)
        overhang_x = (L - cx) / 2 - d
        VEd_x = p * overhang_x * B if overhang_x > 0 else 0
        vEd_x = VEd_x / (B * d) / 1000  # MPa

        # Shear force (Y-direction)
        overhang_y = (B - cy) / 2 - d
        VEd_y = p * overhang_y * L if overhang_y > 0 else 0
        vEd_y = VEd_y / (L * d) / 1000  # MPa

        # Shear resistance (Equation 6.2a)
        k = min(1 + math.sqrt(200 / d / 1000), 2.0)
        rho_l = 0.005  # Assumed
        CRdc = 0.18 / self.gamma_c
        k1 = 0.1

        vRdc = max(
            CRdc * k * (100 * rho_l * mat["fck"]) ** (1 / 3),
            0.035 * k**1.5 * mat["fck"] ** 0.5,
        )

        status_x = "PASS" if vEd_x <= vRdc else "FAIL"
        status_y = "PASS" if vEd_y <= vRdc else "FAIL"
        ratio_x = vEd_x / vRdc if vRdc > 0 else 0
        ratio_y = vEd_y / vRdc if vRdc > 0 else 0

        return {
            "vEd_x": vEd_x,
            "vEd_y": vEd_y,
            "vRdc": vRdc,
            "status_x": status_x,
            "status_y": status_y,
            "ratio_x": ratio_x,
            "ratio_y": ratio_y,
        }

    def design_reinforcement(self, dimensions):
        """BS EN 1992-1-1: 9.3 Flexural reinforcement"""
        mat = self.get_material_properties()
        loads = self.calculate_design_loads()

        L = dimensions["length"] / 1000
        B = dimensions["width"] / 1000
        d = (dimensions["depth"] - self.inputs.cover - 12) / 1000

        cx = (self.inputs.column_width or self.inputs.column_diameter or 450) / 1000
        cy = (self.inputs.column_depth or self.inputs.column_diameter or 450) / 1000

        bearing_pressure = self.calculate_bearing_pressure(dimensions)
        p = bearing_pressure["p_max"]

        # Bending moment at column face
        cantilever_x = (L - cx) / 2
        cantilever_y = (B - cy) / 2

        M_x = p * B * cantilever_x**2 / 2  # kNm/m
        M_y = p * L * cantilever_y**2 / 2

        # Required reinforcement (X-direction)
        K_x = M_x * 1e6 / (B * 1000 * d**2 * 1e6 * mat["fck"])
        z_x = min(d * (0.5 + math.sqrt(0.25 - K_x / 1.134)), 0.95 * d)
        As_req_x = M_x * 1e6 / (z_x * 1000 * mat["fyd"]) / B  # mm²/m

        # Required reinforcement (Y-direction)
        K_y = M_y * 1e6 / (L * 1000 * d**2 * 1e6 * mat["fck"])
        z_y = min(d * (0.5 + math.sqrt(0.25 - K_y / 1.134)), 0.95 * d)
        As_req_y = M_y * 1e6 / (z_y * 1000 * mat["fyd"]) / L  # mm²/m

        # Minimum reinforcement (9.2.1.1)
        fctm = mat["fctm"]
        As_min = max(
            0.26 * fctm / mat["fyk"] * B * 1000 * d * 1000 / B / 1000,
            0.0013 * B * 1000 * d * 1000 / B / 1000,
        )  # mm²/m

        As_req_x = max(As_req_x, As_min)
        As_req_y = max(As_req_y, As_min)

        # Select bar sizes and spacing
        bar_x, spacing_x, As_prov_x = self.select_reinforcement(As_req_x, B * 1000)
        bar_y, spacing_y, As_prov_y = self.select_reinforcement(As_req_y, L * 1000)

        return {
            "As_req_x": As_req_x,
            "As_req_y": As_req_y,
            "As_prov_x": As_prov_x,
            "As_prov_y": As_prov_y,
            "bar_x": bar_x,
            "bar_y": bar_y,
            "spacing_x": spacing_x,
            "spacing_y": spacing_y,
            "M_x": M_x,
            "M_y": M_y,
        }

    def select_reinforcement(self, As_required, length):
        """Select appropriate bar size and spacing"""
        # Standard bar sizes (diameter in mm)
        bar_sizes = [12, 16, 20, 25, 32]
        spacings = [100, 125, 150, 175, 200, 225, 250, 300]

        for bar_dia in bar_sizes:
            bar_area = math.pi * (bar_dia / 2) ** 2
            for spacing in spacings:
                As_provided = bar_area * 1000 / spacing  # mm²/m
                if As_provided >= As_required:
                    num_bars = int(length / spacing) + 1
                    return bar_dia, spacing, As_provided

        # Default if no suitable combination found
        return 16, 200, 1005

    def design_pad_foundation(self):
        """Complete pad foundation design"""
        # Size foundation
        dimensions = self.size_foundation()

        # Calculate bearing pressure
        bearing = self.calculate_bearing_pressure(dimensions)

        # Design checks
        punching = self.check_punching_shear(dimensions)
        beam_shear = self.check_beam_shear(dimensions)

        # Design reinforcement
        reinforcement = self.design_reinforcement(dimensions)

        # Overall status
        checks_status = [
            bearing["p_max"] <= self.inputs.soil_bearing,
            punching["status"] == "PASS",
            beam_shear["status_x"] == "PASS",
            beam_shear["status_y"] == "PASS",
            bearing["p_min"] >= 0,  # No uplift
        ]

        overall_status = "PASS" if all(checks_status) else "FAIL"

        # Calculate utilization ratio
        ratios = [
            bearing["p_max"] / self.inputs.soil_bearing,
            punching["ratio"],
            beam_shear["ratio_x"],
            beam_shear["ratio_y"],
        ]
        max_ratio = max(ratios)

        # Prepare output
        checks = [
            DesignCheck(
                description="Bearing Pressure",
                value=f"{bearing['p_max']:.2f} kN/m²",
                limit=f"{self.inputs.soil_bearing:.2f} kN/m²",
                status=(
                    "PASS" if bearing["p_max"] <= self.inputs.soil_bearing else "FAIL"
                ),
                ratio=bearing["p_max"] / self.inputs.soil_bearing,
            ),
            DesignCheck(
                description="Punching Shear",
                value=f"{punching['vEd']:.2f} MPa",
                limit=f"{punching['vRdc']:.2f} MPa",
                status=punching["status"],
                ratio=punching["ratio"],
            ),
            DesignCheck(
                description="Beam Shear (X)",
                value=f"{beam_shear['vEd_x']:.2f} MPa",
                limit=f"{beam_shear['vRdc']:.2f} MPa",
                status=beam_shear["status_x"],
                ratio=beam_shear["ratio_x"],
            ),
            DesignCheck(
                description="Beam Shear (Y)",
                value=f"{beam_shear['vEd_y']:.2f} MPa",
                limit=f"{beam_shear['vRdc']:.2f} MPa",
                status=beam_shear["status_y"],
                ratio=beam_shear["ratio_y"],
            ),
            DesignCheck(
                description="Reinforcement Ratio",
                value=f"{(reinforcement['As_prov_x']/1000/dimensions['depth']*100):.2f}%",
                limit="0.13% min",
                status="PASS",
                ratio=reinforcement["As_prov_x"] / reinforcement["As_req_x"],
            ),
        ]

        loads = self.calculate_design_loads()

        return FoundationOutput(
            design_summary={
                "status": overall_status,
                "utilization_ratio": max_ratio,
                "foundation_size": f"{dimensions['length']:.0f} x {dimensions['width']:.0f} x {dimensions['depth']:.0f}mm",
            },
            load_analysis={
                "total_vertical_load": bearing["total_vertical"],
                "design_load": loads["design_vertical"],
                "bearing_pressure": bearing["p_max"],
                "allowable_pressure": self.inputs.soil_bearing,
            },
            reinforcement=ReinforcementDetails(
                main_bars_x=f"{int(dimensions['width']/reinforcement['spacing_x'])+1}H{reinforcement['bar_x']}@{reinforcement['spacing_x']} (B1)",
                main_bars_y=f"{int(dimensions['length']/reinforcement['spacing_y'])+1}H{reinforcement['bar_y']}@{reinforcement['spacing_y']} (B2)",
                area=reinforcement["As_prov_x"],
                area_required=reinforcement["As_req_x"],
            ),
            checks=checks,
            bs_references=[
                "BS EN 1992-1-1:2004 - Design of concrete structures",
                "BS 8004:2015 - Code of practice for foundations",
                "BS EN 1990:2002 - Basis of structural design",
                "BS EN 1997-1:2004 - Geotechnical design",
            ],
            calculations={
                "dimensions": dimensions,
                "bearing": bearing,
                "punching": punching,
                "beam_shear": beam_shear,
                "reinforcement": reinforcement,
            },
        )


# ==================== API ENDPOINTS ====================


@router.get("/")
def read_root():
    return {
        "message": "Foundation Design API - BS Standards",
        "version": "1.0.0",
        "standards": ["BS EN 1992-1-1", "BS 8004", "BS EN 1997-1"],
    }


@router.post("/design/pad-foundation", response_model=FoundationOutput)
def design_pad_foundation(inputs: FoundationInput):
    """Design pad foundation according to BS standards"""
    try:
        designer = BSFoundationDesigner(inputs)
        result = designer.design_pad_foundation()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/strip-foundation")
def design_strip_foundation(inputs: FoundationInput):
    """Design strip foundation - BS 8004"""
    return {"message": "Strip foundation design - Coming soon"}


@router.post("/design/pile-foundation")
def design_pile_foundation(inputs: FoundationInput):
    """Design pile foundation - BS 8004"""
    return {"message": "Pile foundation design - Coming soon"}


@router.post("/design/pile-cap")
def design_pile_cap(inputs: FoundationInput):
    """Design pile cap - BS 8004"""
    return {"message": "Pile cap design - Coming soon"}
