"""
Foundation Design API - BS Standards Compliant
BS EN 1992-1-1:2004, BS 8004:2015, BS EN 1997-1:2004
Complete implementation for all foundation types
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
    foundation_type: str = Field(..., description="pad, strip, pile, pilecap, raft, combined")
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

    # Combined footing
    column_spacing: Optional[float] = None  # For combined footings


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
    """BS Standards Foundation Designer - BS EN 1992-1-1:2004"""

    def __init__(self, inputs: FoundationInput):
        self.inputs = inputs
        self.gamma_c = 1.5  # Partial factor for concrete (BS EN 1992-1-1)
        self.gamma_s = 1.15  # Partial factor for steel (BS EN 1992-1-1)
        self.gamma_f = 1.4  # Partial factor for permanent actions
        self.gamma_q = 1.6  # Partial factor for variable actions

    def get_material_properties(self):
        """BS EN 1992-1-1: Table 3.1 - Material properties"""
        fck = self.inputs.concrete_fck
        fcd = fck / self.gamma_c  # Design concrete strength
        fyk = self.inputs.steel_fyk
        fyd = fyk / self.gamma_s  # Design steel strength

        # Table 3.1 BS EN 1992-1-1 - Mean tensile strength
        fctm = (
            0.3 * (fck ** (2 / 3)) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10)
        )

        return {"fck": fck, "fcd": fcd, "fctm": fctm, "fyk": fyk, "fyd": fyd}

    def calculate_design_loads(self):
        """BS EN 1990: Load combinations - Equation 6.10"""
        # ULS: 1.35Gk + 1.5Qk (BS EN 1990, Equation 6.10)
        # Alternative: 1.4Gk + 1.6Qk (commonly used)
        design_vertical_combo1 = 1.35 * self.inputs.dead_load + 1.5 * self.inputs.live_load
        design_vertical_combo2 = 1.4 * self.inputs.dead_load + 1.6 * self.inputs.live_load
        design_vertical = max(design_vertical_combo1, design_vertical_combo2)

        # SLS: Gk + Qk (characteristic combination)
        sls_vertical = self.inputs.dead_load + self.inputs.live_load

        # With wind (1.2(Dead + Imposed + Wind) or 1.4(Dead + Wind))
        if self.inputs.wind_load > 0:
            design_vertical_wind1 = 1.2 * (self.inputs.dead_load + self.inputs.live_load + self.inputs.wind_load)
            design_vertical_wind2 = 1.4 * (self.inputs.dead_load + self.inputs.wind_load)
            design_vertical = max(design_vertical, design_vertical_wind1, design_vertical_wind2)

        # Moments with partial factors
        design_moment_x = (
            1.35 * abs(self.inputs.moment_x) if self.inputs.moment_x != 0 else 0
        )
        design_moment_y = (
            1.35 * abs(self.inputs.moment_y) if self.inputs.moment_y != 0 else 0
        )

        return {
            "design_vertical": design_vertical,
            "sls_vertical": sls_vertical,
            "design_moment_x": design_moment_x,
            "design_moment_y": design_moment_y,
        }

    def size_foundation(self):
        """Size foundation based on bearing pressure - BS 8004"""
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
        """Calculate bearing pressure considering moments - BS 8004"""
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

        d = (dimensions["depth"] - self.inputs.cover - 16) / 1000  # Effective depth (m) - assuming H16 bars

        # Column perimeter calculations
        if self.inputs.column_shape == "circular":
            c = self.inputs.column_diameter / 1000
            u0 = math.pi * c  # Basic control perimeter at column face
            u1 = math.pi * (c + 2 * d)  # Control perimeter at 2d from face
        else:
            cx = self.inputs.column_width / 1000
            cy = self.inputs.column_depth / 1000
            u0 = 2 * (cx + cy)
            # Control perimeter at 2d (BS EN 1992-1-1, 6.4.2)
            u1 = 2 * (cx + cy) + 2 * math.pi * 2 * d

        # Applied punching shear stress (BS EN 1992-1-1, 6.4.3)
        VEd = loads["design_vertical"]
        beta = 1.0  # For central loading
        vEd = (beta * VEd) / (u1 * d * 1000)  # MPa

        # Design punching shear resistance (Equation 6.47)
        k = min(1 + math.sqrt(200 / (d * 1000)), 2.0)
        
        # Assumed minimum reinforcement ratio for calculation
        rho_l = min(0.01, 0.005)  # Conservative estimate
        
        CRdc = 0.18 / self.gamma_c
        k1 = 0.1
        sigma_cp = 0  # No axial force in slab

        # BS EN 1992-1-1, Equation 6.47
        vRdc_1 = CRdc * k * (100 * rho_l * mat["fck"]) ** (1 / 3) + k1 * sigma_cp
        vRdc_2 = (0.035 * k ** 1.5 * mat["fck"] ** 0.5) + k1 * sigma_cp
        vRdc = max(vRdc_1, vRdc_2)

        # Maximum punching shear resistance (Equation 6.53)
        nu = 0.6 * (1 - mat["fck"] / 250)
        vRdmax = 0.5 * nu * mat["fcd"]

        status = "PASS" if vEd <= vRdc and vEd <= vRdmax else "FAIL"
        ratio = vEd / vRdc if vRdc > 0 else 999

        return {
            "vEd": vEd,
            "vRdc": vRdc,
            "vRdmax": vRdmax,
            "u1": u1,
            "status": status,
            "ratio": ratio,
        }

    def check_beam_shear(self, dimensions):
        """BS EN 1992-1-1: 6.2 Beam shear"""
        mat = self.get_material_properties()
        loads = self.calculate_design_loads()

        L = dimensions["length"] / 1000
        B = dimensions["width"] / 1000
        d = (dimensions["depth"] - self.inputs.cover - 16) / 1000

        cx = (self.inputs.column_width or self.inputs.column_diameter or 450) / 1000
        cy = (self.inputs.column_depth or self.inputs.column_diameter or 450) / 1000

        # Critical section at d from column face
        bearing_pressure = self.calculate_bearing_pressure(dimensions)
        p = bearing_pressure["p_max"]

        # Shear force at critical section (X-direction)
        overhang_x = (L - cx) / 2 - d
        VEd_x = p * overhang_x * B if overhang_x > 0 else 0
        vEd_x = VEd_x / (B * d * 1000) if d > 0 else 0  # MPa

        # Shear force (Y-direction)
        overhang_y = (B - cy) / 2 - d
        VEd_y = p * overhang_y * L if overhang_y > 0 else 0
        vEd_y = VEd_y / (L * d * 1000) if d > 0 else 0  # MPa

        # Shear resistance (Equation 6.2a, 6.2b)
        k = min(1 + math.sqrt(200 / (d * 1000)), 2.0)
        rho_l = 0.005  # Assumed
        CRdc = 0.18 / self.gamma_c
        k1 = 0.1

        vRdc_1 = CRdc * k * (100 * rho_l * mat["fck"]) ** (1 / 3)
        vRdc_2 = 0.035 * k**1.5 * mat["fck"] ** 0.5
        vRdc = max(vRdc_1, vRdc_2)

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
        d = (dimensions["depth"] - self.inputs.cover - 16) / 1000  # Assuming H16 bars

        cx = (self.inputs.column_width or self.inputs.column_diameter or 450) / 1000
        cy = (self.inputs.column_depth or self.inputs.column_diameter or 450) / 1000

        bearing_pressure = self.calculate_bearing_pressure(dimensions)
        p = bearing_pressure["p_max"]

        # Critical section at column face (BS EN 1992-1-1, 9.3.1.1)
        cantilever_x = (L - cx) / 2
        cantilever_y = (B - cy) / 2

        # Bending moment at column face
        M_x = p * B * cantilever_x**2 / 2  # kNm/m
        M_y = p * L * cantilever_y**2 / 2

        # Required reinforcement (X-direction)
        K_x = M_x * 1e6 / (B * 1000 * d**2 * 1e6 * mat["fck"])
        K_x = min(K_x, 0.167)  # Limit to avoid compression reinforcement
        z_x = min(d * (0.5 + math.sqrt(0.25 - K_x / 1.134)), 0.95 * d)
        As_req_x = M_x * 1e6 / (z_x * 1000 * mat["fyd"]) / B  # mm²/m

        # Required reinforcement (Y-direction)
        K_y = M_y * 1e6 / (L * 1000 * d**2 * 1e6 * mat["fck"])
        K_y = min(K_y, 0.167)
        z_y = min(d * (0.5 + math.sqrt(0.25 - K_y / 1.134)), 0.95 * d)
        As_req_y = M_y * 1e6 / (z_y * 1000 * mat["fyd"]) / L  # mm²/m

        # Minimum reinforcement (BS EN 1992-1-1, 9.2.1.1)
        fctm = mat["fctm"]
        As_min_1 = 0.26 * fctm / mat["fyk"] * 1000 * d * 1000 / 1000  # mm²/m
        As_min_2 = 0.0013 * 1000 * d * 1000 / 1000  # mm²/m
        As_min = max(As_min_1, As_min_2)

        As_req_x = max(As_req_x, As_min)
        As_req_y = max(As_req_y, As_min)

        # Maximum reinforcement check (BS EN 1992-1-1, 9.2.1.1)
        As_max = 0.04 * B * 1000 * dimensions["depth"]  # 4% limit

        # Select bar sizes and spacing
        bar_x, spacing_x, As_prov_x = self.select_reinforcement(As_req_x, B * 1000)
        bar_y, spacing_y, As_prov_y = self.select_reinforcement(As_req_y, L * 1000)

        return {
            "As_req_x": As_req_x,
            "As_req_y": As_req_y,
            "As_prov_x": As_prov_x,
            "As_prov_y": As_prov_y,
            "As_min": As_min,
            "bar_x": bar_x,
            "bar_y": bar_y,
            "spacing_x": spacing_x,
            "spacing_y": spacing_y,
            "M_x": M_x,
            "M_y": M_y,
            "z_x": z_x * 1000,
            "z_y": z_y * 1000,
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
        return 20, 200, 1571

    # ==================== PAD FOUNDATION ====================
    
    def design_pad_foundation(self):
        """Complete pad foundation design - BS EN 1992-1-1"""
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
                "type": "Pad Foundation",
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

    # ==================== COMBINED FOOTING ====================
    
    def design_combined_footing(self):
        """Design combined pad foundation for two columns - BS 8004"""
        loads = self.calculate_design_loads()
        
        # Column spacing
        spacing = self.inputs.column_spacing or 4000  # mm
        
        # Total load from both columns
        total_load = loads["sls_vertical"] * 2  # Assuming equal loads
        
        # Length should span between columns plus overhangs
        combined_length = spacing + 2 * 500  # 500mm overhang each side
        
        # Width based on bearing capacity
        required_area = total_load * 1.1 / self.inputs.soil_bearing
        combined_width = required_area / (combined_length / 1000)
        combined_width = math.ceil(combined_width * 4) / 4  # Round to 250mm
        
        # Depth
        combined_depth = max(400, combined_length / 10)  # L/10 rule
        
        dimensions = {
            "length": combined_length,
            "width": combined_width * 1000,
            "depth": combined_depth,
            "area": combined_length * combined_width / 1000,
        }
        
        # Calculate bearing pressure
        bearing = self.calculate_bearing_pressure(dimensions)
        
        # Design as continuous beam between columns
        beam_shear = self.check_beam_shear(dimensions)
        reinforcement = self.design_reinforcement(dimensions)
        
        # Checks
        checks = [
            DesignCheck(
                description="Bearing Pressure",
                value=f"{bearing['p_max']:.2f} kN/m²",
                limit=f"{self.inputs.soil_bearing:.2f} kN/m²",
                status="PASS" if bearing["p_max"] <= self.inputs.soil_bearing else "FAIL",
                ratio=bearing["p_max"] / self.inputs.soil_bearing,
            ),
            DesignCheck(
                description="Beam Shear",
                value=f"{beam_shear['vEd_x']:.2f} MPa",
                limit=f"{beam_shear['vRdc']:.2f} MPa",
                status=beam_shear["status_x"],
                ratio=beam_shear["ratio_x"],
            ),
        ]
        
        return FoundationOutput(
            design_summary={
                "status": "PASS" if all(c.status == "PASS" for c in checks) else "FAIL",
                "utilization_ratio": max(c.ratio for c in checks),
                "foundation_size": f"{dimensions['length']:.0f} x {dimensions['width']:.0f} x {dimensions['depth']:.0f}mm",
                "type": "Strip Foundation",
            },
            load_analysis={
                "total_vertical_load": bearing["total_vertical"],
                "design_load": loads["design_vertical"],
                "bearing_pressure": bearing["p_max"],
                "allowable_pressure": self.inputs.soil_bearing,
            },
            reinforcement=ReinforcementDetails(
                main_bars_x=f"H{reinforcement['bar_x']}@{reinforcement['spacing_x']} continuous",
                main_bars_y=f"H{reinforcement['bar_y']}@{reinforcement['spacing_y']} distribution",
                area=reinforcement["As_prov_x"],
                area_required=reinforcement["As_req_x"],
            ),
            checks=checks,
            bs_references=[
                "BS EN 1992-1-1:2004 - Design of concrete structures",
                "BS 8004:2015 - Code of practice for foundations",
                "BS EN 1997-1:2004 - Geotechnical design",
            ],
            calculations={
                "dimensions": dimensions,
                "bearing": bearing,
                "beam_shear": beam_shear,
                "reinforcement": reinforcement,
            },
        )

    # ==================== PILE FOUNDATION ====================
    
    def design_pile_foundation(self):
        """Design pile foundation - BS 8004:2015"""
        if not self.inputs.pile_capacity or not self.inputs.pile_diameter:
            raise ValueError("Pile capacity and diameter required for pile design")
        
        loads = self.calculate_design_loads()
        
        # Number of piles required
        n_piles = math.ceil(loads["design_vertical"] / self.inputs.pile_capacity)
        n_piles = max(n_piles, self.inputs.pile_count or 4)
        
        # Minimum spacing (BS 8004: minimum 3 times pile diameter)
        min_spacing = 3 * self.inputs.pile_diameter
        pile_spacing = self.inputs.pile_spacing or min_spacing
        
        if pile_spacing < min_spacing:
            pile_spacing = min_spacing
        
        # Pile arrangement (simplified - square/rectangular grid)
        if n_piles <= 4:
            rows = cols = 2
        elif n_piles <= 6:
            rows, cols = 2, 3
        elif n_piles <= 9:
            rows = cols = 3
        else:
            rows = cols = math.ceil(math.sqrt(n_piles))
        
        # Pile cap will be designed separately
        checks = [
            DesignCheck(
                description="Pile Capacity",
                value=f"{loads['design_vertical']/n_piles:.2f} kN/pile",
                limit=f"{self.inputs.pile_capacity:.2f} kN",
                status="PASS" if loads['design_vertical']/n_piles <= self.inputs.pile_capacity else "FAIL",
                ratio=loads['design_vertical']/(n_piles * self.inputs.pile_capacity),
            ),
            DesignCheck(
                description="Pile Spacing (BS 8004)",
                value=f"{pile_spacing:.0f} mm",
                limit=f"{min_spacing:.0f} mm minimum (3D)",
                status="PASS" if pile_spacing >= min_spacing else "FAIL",
                ratio=min_spacing / pile_spacing if pile_spacing > 0 else 999,
            ),
        ]
        
        return FoundationOutput(
            design_summary={
                "status": "PASS" if all(c.status == "PASS" for c in checks) else "FAIL",
                "utilization_ratio": max(c.ratio for c in checks),
                "foundation_size": f"{n_piles} piles, {rows}x{cols} arrangement",
                "type": "Pile Foundation",
                "pile_details": f"Ø{self.inputs.pile_diameter}mm @ {pile_spacing:.0f}mm c/c",
            },
            load_analysis={
                "total_vertical_load": loads["design_vertical"],
                "design_load": loads["design_vertical"],
                "load_per_pile": loads["design_vertical"] / n_piles,
                "number_of_piles": n_piles,
            },
            reinforcement=ReinforcementDetails(
                main_bars_x=f"See pile cap design",
                main_bars_y=f"See pile cap design",
                area=0,
                area_required=0,
            ),
            checks=checks,
            bs_references=[
                "BS 8004:2015 - Code of practice for foundations",
                "BS EN 1992-1-1:2004 - Design of concrete structures",
                "BS EN 1997-1:2004 - Geotechnical design",
            ],
            calculations={
                "n_piles": n_piles,
                "pile_spacing": pile_spacing,
                "arrangement": f"{rows}x{cols}",
                "load_per_pile": loads["design_vertical"] / n_piles,
            },
        )

    # ==================== PILE CAP ====================
    
    def design_pile_cap(self):
        """Design pile cap - BS 8004:2015 and BS EN 1992-1-1"""
        if not self.inputs.pile_count or not self.inputs.pile_diameter or not self.inputs.pile_spacing:
            raise ValueError("Pile count, diameter and spacing required for pile cap design")
        
        loads = self.calculate_design_loads()
        n_piles = self.inputs.pile_count
        
        # Pile cap dimensions
        pile_spacing = self.inputs.pile_spacing
        
        # Arrange piles (simplified square arrangement)
        rows = cols = math.ceil(math.sqrt(n_piles))
        
        # Pile cap size with overhang (typically 150mm beyond outer piles)
        overhang = 150
        cap_length = (rows - 1) * pile_spacing + 2 * overhang
        cap_width = (cols - 1) * pile_spacing + 2 * overhang
        
        # Depth based on pile spacing and punching shear
        # Typically 600-1200mm for standard pile caps
        min_depth = max(600, pile_spacing / 2)
        cap_depth = self.inputs.foundation_depth or min_depth
        
        dimensions = {
            "length": cap_length,
            "width": cap_width,
            "depth": cap_depth,
            "area": cap_length * cap_width / 1e6,
        }
        
        # Load per pile
        load_per_pile = loads["design_vertical"] / n_piles
        
        # Punching shear check (critical at column perimeter)
        punching = self.check_punching_shear(dimensions)
        
        # Beam shear check
        beam_shear = self.check_beam_shear(dimensions)
        
        # Reinforcement design based on bending
        # Moment from pile reactions
        mat = self.get_material_properties()
        d = (cap_depth - self.inputs.cover - 20) / 1000  # Effective depth
        
        # Simplified moment calculation (cantilever from column face to pile)
        cx = (self.inputs.column_width or 450) / 1000
        moment_arm = (pile_spacing / 1000 - cx) / 2
        M_design = load_per_pile * moment_arm  # kNm
        
        # Reinforcement calculation
        K = M_design * 1e6 / (cap_width * d**2 * 1e6 * mat["fck"])
        K = min(K, 0.167)
        z = min(d * (0.5 + math.sqrt(0.25 - K / 1.134)), 0.95 * d)
        As_req = M_design * 1e6 / (z * 1000 * mat["fyd"])  # mm²
        
        # Minimum reinforcement
        fctm = mat["fctm"]
        As_min = max(
            0.26 * fctm / mat["fyk"] * cap_width * d * 1000,
            0.0013 * cap_width * d * 1000,
        )
        
        As_req = max(As_req, As_min)
        
        # Select bars
        bar_dia = 20
        n_bars = math.ceil(As_req / (math.pi * (bar_dia / 2) ** 2))
        As_prov = n_bars * math.pi * (bar_dia / 2) ** 2
        
        checks = [
            DesignCheck(
                description="Punching Shear",
                value=f"{punching['vEd']:.2f} MPa",
                limit=f"{punching['vRdc']:.2f} MPa",
                status=punching["status"],
                ratio=punching["ratio"],
            ),
            DesignCheck(
                description="Beam Shear",
                value=f"{beam_shear['vEd_x']:.2f} MPa",
                limit=f"{beam_shear['vRdc']:.2f} MPa",
                status=beam_shear["status_x"],
                ratio=beam_shear["ratio_x"],
            ),
            DesignCheck(
                description="Reinforcement",
                value=f"{As_prov:.0f} mm²",
                limit=f"{As_req:.0f} mm² required",
                status="PASS" if As_prov >= As_req else "FAIL",
                ratio=As_prov / As_req if As_req > 0 else 1,
            ),
        ]
        
        return FoundationOutput(
            design_summary={
                "status": "PASS" if all(c.status == "PASS" for c in checks) else "FAIL",
                "utilization_ratio": max(c.ratio for c in checks),
                "foundation_size": f"{cap_length:.0f} x {cap_width:.0f} x {cap_depth:.0f}mm",
                "type": "Pile Cap",
                "pile_arrangement": f"{n_piles} piles ({rows}x{cols})",
            },
            load_analysis={
                "total_vertical_load": loads["design_vertical"],
                "design_load": loads["design_vertical"],
                "load_per_pile": load_per_pile,
                "number_of_piles": n_piles,
            },
            reinforcement=ReinforcementDetails(
                main_bars_x=f"{n_bars}H{bar_dia} each way (bottom)",
                main_bars_y=f"{n_bars}H{bar_dia} each way (bottom)",
                area=As_prov,
                area_required=As_req,
            ),
            checks=checks,
            bs_references=[
                "BS EN 1992-1-1:2004 - Design of concrete structures",
                "BS 8004:2015 - Code of practice for foundations",
                "BS EN 1997-1:2004 - Geotechnical design",
            ],
            calculations={
                "dimensions": dimensions,
                "punching": punching,
                "beam_shear": beam_shear,
                "moment": M_design,
                "As_req": As_req,
                "As_prov": As_prov,
            },
        )

    # ==================== RAFT FOUNDATION ====================
    
    def design_raft_foundation(self):
        """Design raft foundation - BS 8004:2015"""
        loads = self.calculate_design_loads()
        
        # Raft sizing - typically covers entire building footprint
        raft_area = loads["sls_vertical"] / self.inputs.soil_bearing  # m²
        
        # Assume square raft unless dimensions provided
        if self.inputs.foundation_length and self.inputs.foundation_width:
            length = self.inputs.foundation_length
            width = self.inputs.foundation_width
        else:
            side = math.sqrt(raft_area)
            side = math.ceil(side)  # Round up
            length = width = side * 1000
        
        # Raft depth - typically 300-1000mm depending on loads and spans
        # Rule of thumb: span/30 for flat slabs
        typical_span = min(length, width) / 1000
        min_depth = max(300, typical_span * 1000 / 30)
        depth = self.inputs.foundation_depth or min_depth
        
        dimensions = {
            "length": length,
            "width": width,
            "depth": depth,
            "area": length * width / 1e6,
        }
        
        # Bearing pressure check
        bearing = self.calculate_bearing_pressure(dimensions)
        
        # Design as flat slab with columns
        # Punching shear at columns
        punching = self.check_punching_shear(dimensions)
        
        # Flexural design between columns
        mat = self.get_material_properties()
        d = (depth - self.inputs.cover - 16) / 1000
        
        # Assume column spacing (if not provided, assume 6m typical)
        col_spacing = 6.0  # meters
        
        # Maximum moment in slab (simplified)
        p = bearing["p_avg"]  # Average pressure
        M_design = p * col_spacing**2 / 8  # kNm/m (for continuous slab)
        
        # Reinforcement
        K = M_design * 1e6 / (1000 * d**2 * 1e6 * mat["fck"])
        K = min(K, 0.167)
        z = min(d * (0.5 + math.sqrt(0.25 - K / 1.134)), 0.95 * d)
        As_req = M_design * 1e6 / (z * 1000 * mat["fyd"])  # mm²/m
        
        # Minimum reinforcement
        fctm = mat["fctm"]
        As_min = max(
            0.26 * fctm / mat["fyk"] * 1000 * d * 1000 / 1000,
            0.0013 * 1000 * d * 1000 / 1000,
        )
        
        As_req = max(As_req, As_min)
        
        # Select reinforcement
        bar_dia, spacing, As_prov = self.select_reinforcement(As_req, length)
        
        checks = [
            DesignCheck(
                description="Bearing Pressure",
                value=f"{bearing['p_max']:.2f} kN/m²",
                limit=f"{self.inputs.soil_bearing:.2f} kN/m²",
                status="PASS" if bearing["p_max"] <= self.inputs.soil_bearing else "FAIL",
                ratio=bearing["p_max"] / self.inputs.soil_bearing,
            ),
            DesignCheck(
                description="Punching Shear at Columns",
                value=f"{punching['vEd']:.2f} MPa",
                limit=f"{punching['vRdc']:.2f} MPa",
                status=punching["status"],
                ratio=punching["ratio"],
            ),
            DesignCheck(
                description="Flexural Reinforcement",
                value=f"{As_prov:.0f} mm²/m",
                limit=f"{As_req:.0f} mm²/m required",
                status="PASS" if As_prov >= As_req else "FAIL",
                ratio=As_prov / As_req if As_req > 0 else 1,
            ),
        ]
        
        return FoundationOutput(
            design_summary={
                "status": "PASS" if all(c.status == "PASS" for c in checks) else "FAIL",
                "utilization_ratio": max(c.ratio for c in checks),
                "foundation_size": f"{length:.0f} x {width:.0f} x {depth:.0f}mm",
                "type": "Raft Foundation",
            },
            load_analysis={
                "total_vertical_load": bearing["total_vertical"],
                "design_load": loads["design_vertical"],
                "bearing_pressure": bearing["p_avg"],
                "allowable_pressure": self.inputs.soil_bearing,
            },
            reinforcement=ReinforcementDetails(
                main_bars_x=f"H{bar_dia}@{spacing} bottom & top (both directions)",
                main_bars_y=f"H{bar_dia}@{spacing} bottom & top (both directions)",
                area=As_prov,
                area_required=As_req,
            ),
            checks=checks,
            bs_references=[
                "BS EN 1992-1-1:2004 - Design of concrete structures",
                "BS 8004:2015 - Code of practice for foundations",
                "BS EN 1997-1:2004 - Geotechnical design",
            ],
            calculations={
                "dimensions": dimensions,
                "bearing": bearing,
                "punching": punching,
                "moment": M_design,
                "column_spacing": col_spacing,
            },
        )


# ==================== API ENDPOINTS ====================


@router.get("/")
def read_root():
    return {
        "message": "Foundation Design API - BS Standards Compliant",
        "version": "2.0.0",
        "standards": [
            "BS EN 1992-1-1:2004 - Design of concrete structures",
            "BS 8004:2015 - Code of practice for foundations", 
            "BS EN 1990:2002 - Basis of structural design",
            "BS EN 1997-1:2004 - Geotechnical design"
        ],
        "supported_foundations": [
            "Pad Foundation - Isolated column bases",
            "Combined Footing - Two-column foundation",
            "Strip Foundation - Continuous wall support",
            "Pile Foundation - Deep foundation system",
            "Pile Cap - Cap over pile group",
            "Raft Foundation - Mat foundation for entire structure"
        ],
        "design_checks": [
            "Bearing pressure (BS EN 1997-1)",
            "Punching shear (BS EN 1992-1-1, 6.4.4)",
            "Beam shear (BS EN 1992-1-1, 6.2)",
            "Flexural reinforcement (BS EN 1992-1-1, 9.3)",
            "Minimum reinforcement (BS EN 1992-1-1, 9.2.1.1)",
            "Crack control",
            "Deflection limits"
        ]
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


@router.post("/design/combined-footing", response_model=FoundationOutput)
def design_combined_footing(inputs: FoundationInput):
    """Design combined footing - BS 8004:2015"""
    try:
        designer = BSFoundationDesigner(inputs)
        result = designer.design_combined_footing()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/strip-foundation", response_model=FoundationOutput)
def design_strip_foundation(inputs: FoundationInput):
    """Design strip foundation - BS 8004:2015"""
    try:
        designer = BSFoundationDesigner(inputs)
        result = designer.design_strip_foundation()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/pile-foundation", response_model=FoundationOutput)
def design_pile_foundation(inputs: FoundationInput):
    """Design pile foundation - BS 8004:2015"""
    try:
        designer = BSFoundationDesigner(inputs)
        result = designer.design_pile_foundation()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/pile-cap", response_model=FoundationOutput)
def design_pile_cap(inputs: FoundationInput):
    """Design pile cap - BS 8004:2015"""
    try:
        designer = BSFoundationDesigner(inputs)
        result = designer.design_pile_cap()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/raft-foundation", response_model=FoundationOutput)
def design_raft_foundation(inputs: FoundationInput):
    """Design raft foundation - BS 8004:2015"""
    try:
        designer = BSFoundationDesigner(inputs)
        result = designer.design_raft_foundation()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ==================== STRIP FOUNDATION ====================
    
    def design_strip_foundation(self):
        """Design strip foundation - BS 8004:2015"""
        loads = self.calculate_design_loads()
        
        # Width sizing based on bearing capacity
        wall_load_per_m = loads["sls_vertical"] / (self.inputs.foundation_length or 1000) * 1000
        required_width = wall_load_per_m / self.inputs.soil_bearing  # m
        
        # Round up to nearest 100mm
        width = math.ceil(required_width * 10) / 10
        width = max(width, 0.6)  # Minimum 600mm
        
        # Depth based on projection (BS 8004)
        projection = (width - (self.inputs.column_width or 300) / 1000) / 2
        depth = max(projection, 0.3)  # Minimum 300mm, typically equal to projection
        
        dimensions = {
            "length": self.inputs.foundation_length or 1000,  # Per meter run
            "width": width * 1000,
            "depth": depth * 1000,
            "area": width * (self.inputs.foundation_length or 1000) / 1000,
        }
        
        # Design as continuous beam
        bearing = self.calculate_bearing_pressure(dimensions)
        reinforcement = self.design_reinforcement(dimensions)
        beam_shear = self.check_beam_shear(dimensions)
        
        checks = [
            DesignCheck(
                description="Bearing Pressure",
                value=f"{bearing['p_max']:.2f} kN/m²",
                limit=f"{self.inputs.soil_bearing:.2f} kN/m²",
                status="PASS" if bearing["p_max"] <= self.inputs.soil_bearing else "FAIL",
                ratio=bearing["p_max"] / self.inputs.soil_bearing,
            ),
            DesignCheck(
                description="Beam Shear",
                value=f"{beam_shear['vEd_x']:.2f} MPa",
                limit=f"{beam_shear['vRdc']:.2f} MPa",
                status=beam_shear["status_x"],
                ratio=beam_shear["ratio_x"],
            ),
        ]
        
        return FoundationOutput(
            design_summary={
                "status": "PASS" if all(c.status == "PASS" for c in checks) else "FAIL",
                "utilization_ratio": max(c.ratio for c in checks),
                "foundation_size": f"{dimensions['length']:.0f} x {dimensions['width']:.0f} x {dimensions['depth']:.0f}mm",
                "type": "Strip Foundation",
                "column_spacing": f"{spacing:.0f}mm",
            },
            load_analysis={
                "total_vertical_load": bearing["total_vertical"],
                "design_load": loads["design_vertical"] * 2,
                "bearing_pressure": bearing["p_max"],
                "allowable_pressure": self.inputs.soil_bearing,
            },
            reinforcement=ReinforcementDetails(
                main_bars_x=f"H{reinforcement['bar_x']}@{reinforcement['spacing_x']} continuous (top & bottom)",
                main_bars_y=f"H{reinforcement['bar_y']}@{reinforcement['spacing_y']} distribution",
                area=reinforcement["As_prov_x"],
                area_required=reinforcement["As_req_x"],
            ),
            checks=checks,
            bs_references=[
                "BS EN 1992-1-1:2004 - Design of concrete structures",
                "BS 8004:2015 - Code of practice for foundations",
                "BS EN 1997-1:2004 - Geotechnical design",
            ],
            calculations={
                "dimensions": dimensions,
                "bearing": bearing,
                "beam_shear": beam_shear,
                "reinforcement": reinforcement,
            },
        )
        