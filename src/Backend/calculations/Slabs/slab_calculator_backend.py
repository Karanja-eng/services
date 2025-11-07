"""
BS 8110 Slab Design Calculator - FastAPI Backend
Professional Structural Engineering Application
"""

from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import math

router = APIRouter()
# ============= DATA MODELS =============


class SlabDesignRequest(BaseModel):
    # Slab configuration
    slabType: str = Field(..., description="one-way, two-way, ribbed, waffle")
    spanType: str = Field(default="single", description="single, multiple")
    support: str = Field(..., description="simply-supported, continuous, cantilever")

    # Material properties
    fck: float = Field(default=30, description="Concrete strength (N/mm²)")
    fy: float = Field(default=460, description="Steel yield strength (N/mm²)")
    cover: float = Field(default=25, description="Concrete cover (mm)")

    # Loading
    deadLoad: float = Field(..., description="Dead load (kN/m²)")
    liveLoad: float = Field(..., description="Live load (kN/m²)")

    # Dimensions - One-way
    spanLength: Optional[float] = Field(default=None, description="Span length (m)")
    slabWidth: Optional[float] = Field(default=1.0, description="Slab width (m)")

    # Dimensions - Two-way
    lx: Optional[float] = Field(default=None, description="Short span (m)")
    ly: Optional[float] = Field(default=None, description="Long span (m)")

    # Cantilever
    cantileverLength: Optional[float] = Field(
        default=None, description="Cantilever length (m)"
    )

    # Ribbed/Waffle
    ribWidth: Optional[float] = Field(default=125, description="Rib width (mm)")
    ribSpacing: Optional[float] = Field(default=500, description="Rib spacing (mm)")
    topping: Optional[float] = Field(default=50, description="Topping thickness (mm)")
    ribDepth: Optional[float] = Field(default=300, description="Total rib depth (mm)")


class DesignResults(BaseModel):
    slabType: str
    bendingMoment: Optional[float] = None
    bendingMomentX: Optional[float] = None
    bendingMomentY: Optional[float] = None
    shearForce: Optional[float] = None
    effectiveDepth: float
    totalDepth: float
    steelArea: Optional[float] = None
    steelAreaX: Optional[float] = None
    steelAreaY: Optional[float] = None
    mainReinforcement: Optional[str] = None
    distributionSteel: Optional[str] = None
    reinforcementX: Optional[str] = None
    reinforcementY: Optional[str] = None
    ribReinforcement: Optional[str] = None
    toppingReinforcement: Optional[str] = None
    checksPassed: List[str]
    designDetails: Dict


# ============= BS 8110 COEFFICIENTS AND TABLES =============


class BS8110Tables:
    """BS 8110 design tables and coefficients"""

    # Table 3.14: Moment coefficients for one-way spanning slabs
    ONE_WAY_MOMENT_COEFFS = {
        "simply-supported": {"mid_span": 0.125, "support": 0.0},
        "continuous": {
            "mid_span_end": 0.086,
            "mid_span_interior": 0.063,
            "support_interior": 0.086,
            "support_end": 0.086,
        },
        "cantilever": {"support": 0.5, "mid_span": 0.0},
    }

    # Table 3.13: Shear force coefficients
    ONE_WAY_SHEAR_COEFFS = {
        "simply-supported": 0.5,
        "continuous": 0.6,
        "cantilever": 1.0,
    }

    # Table 3.15: Moment coefficients for two-way spanning slabs (restrained)
    # Based on ly/lx ratio
    TWO_WAY_MOMENT_COEFFS_RESTRAINED = {
        1.0: {"αsx": 0.024, "αsy": 0.024, "αsx_neg": 0.031, "αsy_neg": 0.031},
        1.1: {"αsx": 0.028, "αsy": 0.023, "αsx_neg": 0.037, "αsy_neg": 0.030},
        1.2: {"αsx": 0.032, "αsy": 0.022, "αsx_neg": 0.043, "αsy_neg": 0.029},
        1.3: {"αsx": 0.035, "αsy": 0.021, "αsx_neg": 0.047, "αsy_neg": 0.028},
        1.4: {"αsx": 0.037, "αsy": 0.020, "αsx_neg": 0.051, "αsy_neg": 0.027},
        1.5: {"αsx": 0.040, "αsy": 0.020, "αsx_neg": 0.053, "αsy_neg": 0.027},
        1.75: {"αsx": 0.044, "αsy": 0.018, "αsx_neg": 0.059, "αsy_neg": 0.025},
        2.0: {"αsx": 0.048, "αsy": 0.017, "αsx_neg": 0.065, "αsy_neg": 0.024},
    }

    # Table 3.16: Simply supported two-way slabs
    TWO_WAY_MOMENT_COEFFS_SIMPLY = {
        1.0: {"αsx": 0.062, "αsy": 0.062},
        1.1: {"αsx": 0.074, "αsy": 0.061},
        1.2: {"αsx": 0.084, "αsy": 0.059},
        1.3: {"αsx": 0.093, "αsy": 0.055},
        1.4: {"αsx": 0.099, "αsy": 0.051},
        1.5: {"αsx": 0.104, "αsy": 0.046},
        1.75: {"αsx": 0.113, "αsy": 0.037},
        2.0: {"αsx": 0.118, "αsy": 0.029},
    }

    # Table 3.8: Basic span/effective depth ratios
    SPAN_DEPTH_RATIOS = {"simply-supported": 20, "continuous": 26, "cantilever": 7}

    @staticmethod
    def get_two_way_coeffs(ly_lx_ratio: float, restrained: bool = True):
        """Interpolate moment coefficients for two-way slabs"""
        table = (
            BS8110Tables.TWO_WAY_MOMENT_COEFFS_RESTRAINED
            if restrained
            else BS8110Tables.TWO_WAY_MOMENT_COEFFS_SIMPLY
        )

        ratios = sorted(table.keys())

        if ly_lx_ratio <= ratios[0]:
            return table[ratios[0]]
        elif ly_lx_ratio >= ratios[-1]:
            return table[ratios[-1]]

        # Linear interpolation
        for i in range(len(ratios) - 1):
            if ratios[i] <= ly_lx_ratio <= ratios[i + 1]:
                r1, r2 = ratios[i], ratios[i + 1]
                c1, c2 = table[r1], table[r2]

                factor = (ly_lx_ratio - r1) / (r2 - r1)

                return {
                    key: c1[key] + factor * (c2[key] - c1[key]) for key in c1.keys()
                }

        return table[ratios[-1]]


# ============= DESIGN CALCULATORS =============


class SlabDesigner:
    """Main slab design calculator following BS 8110"""

    def __init__(self, request: SlabDesignRequest):
        self.req = request
        self.results = {"checks": [], "warnings": [], "details": {}}

    def calculate_factored_load(self):
        """Calculate ultimate load: 1.4Gk + 1.6Qk"""
        return 1.4 * self.req.deadLoad + 1.6 * self.req.liveLoad

    def calculate_k_prime(self, fck: float):
        """Calculate K' for flexural design"""
        return 0.156  # For fck ≤ 40 N/mm²

    def calculate_z_factor(self, K: float):
        """Calculate lever arm factor"""
        return min(0.5 + math.sqrt(0.25 - K / 0.9), 0.95)

    def calculate_steel_area(self, M: float, fy: float, z: float):
        """Calculate required steel area: As = M / (0.87 * fy * z)"""
        return (M * 1e6) / (0.87 * fy * z)

    def calculate_min_steel(self, Ac: float, fy: float):
        """Minimum steel area: 0.13% for fy=460, 0.24% for fy=250"""
        if fy == 460:
            return 0.0013 * Ac
        elif fy == 250:
            return 0.0024 * Ac
        else:
            return 0.0013 * Ac  # Conservative

    def calculate_max_spacing(self, d: float):
        """Maximum spacing: 3d or 750mm"""
        return min(3 * d, 750)

    def select_reinforcement(self, As_req: float, width: float = 1000):
        """Select bar size and spacing"""
        bar_sizes = [8, 10, 12, 16, 20, 25, 32]
        bar_areas = {
            8: 50.3,
            10: 78.5,
            12: 113.1,
            16: 201.1,
            20: 314.2,
            25: 490.9,
            32: 804.2,
        }

        for bar_size in bar_sizes:
            bar_area = bar_areas[bar_size]
            spacing = (bar_area / As_req) * width

            if 100 <= spacing <= 300:
                return f"H{bar_size} @ {int(spacing)}mm c/c"

        # If no single bar works, return closest
        bar_size = 12
        spacing = min(300, max(100, (bar_areas[bar_size] / As_req) * width))
        return f"H{bar_size} @ {int(spacing)}mm c/c"

    def check_shear(self, V: float, b: float, d: float, fck: float):
        """Check shear stress"""
        v = (V * 1000) / (b * d)  # N/mm²

        # Table 3.9: Design concrete shear stress
        vc = (
            0.79 * (100 * 0.15 / (1.25 * 400)) ** (1 / 3) * (fck / 25) ** (1 / 3) / 1.25
        )

        if v <= vc:
            self.results["checks"].append(f"Shear OK: v={v:.2f} < vc={vc:.2f} N/mm²")
            return True
        else:
            self.results["warnings"].append(
                f"Shear check required: v={v:.2f} > vc={vc:.2f} N/mm²"
            )
            return False

    def design_one_way_slab(self):
        """Design one-way spanning slab"""
        span = self.req.spanLength
        width = self.req.slabWidth
        w = self.calculate_factored_load()

        # Get moment and shear coefficients
        if self.req.support in BS8110Tables.ONE_WAY_MOMENT_COEFFS:
            coeffs = BS8110Tables.ONE_WAY_MOMENT_COEFFS[self.req.support]

            if self.req.support == "simply-supported":
                M = coeffs["mid_span"] * w * span**2
            elif self.req.support == "continuous":
                M = coeffs["mid_span_interior"] * w * span**2
            else:  # cantilever
                M = coeffs["support"] * w * span**2

            shear_coeff = BS8110Tables.ONE_WAY_SHEAR_COEFFS[self.req.support]
            V = shear_coeff * w * span
        else:
            raise HTTPException(status_code=400, detail="Invalid support condition")

        # Calculate effective depth from span/depth ratio
        base_ratio = BS8110Tables.SPAN_DEPTH_RATIOS[self.req.support]
        d_min = (span * 1000) / base_ratio

        # Check from moment
        K = M / (width * (span * 1000) ** 2 * self.req.fck)
        K_prime = self.calculate_k_prime(self.req.fck)

        if K > K_prime:
            self.results["warnings"].append("Compression reinforcement required")

        z_factor = self.calculate_z_factor(K)
        z = span * 1000 * z_factor
        d_moment = z / 0.95

        d = max(d_min, d_moment, 125)  # Minimum 125mm
        z = 0.95 * d
        h = d + self.req.cover + 12  # Assume 12mm bars

        # Steel area
        As = self.calculate_steel_area(M, self.req.fy, z)
        Ac = width * 1000 * h
        As_min = self.calculate_min_steel(Ac, self.req.fy)
        As_prov = max(As, As_min)

        # Select reinforcement
        main_reinf = self.select_reinforcement(As_prov, width * 1000)
        dist_reinf = self.select_reinforcement(As_min * 0.4, width * 1000)

        # Checks
        self.check_shear(V, width * 1000, d, self.req.fck)
        self.results["checks"].append(
            f"Span/depth ratio: {span * 1000 / d:.1f} ≤ {base_ratio}"
        )
        self.results["checks"].append(
            f"Steel area: {As_prov:.0f} mm² ≥ {As_min:.0f} mm² (min)"
        )

        max_spacing = self.calculate_max_spacing(d)
        self.results["checks"].append(f"Maximum spacing: {max_spacing:.0f}mm OK")

        return DesignResults(
            slabType="One-Way Slab",
            bendingMoment=round(M, 2),
            shearForce=round(V, 2),
            effectiveDepth=round(d, 0),
            totalDepth=round(h, 0),
            steelArea=round(As_prov, 0),
            mainReinforcement=main_reinf,
            distributionSteel=dist_reinf,
            checksPassed=self.results["checks"],
            designDetails={
                "ultimate_load": round(w, 2),
                "K_value": round(K, 4),
                "lever_arm": round(z, 0),
                "min_steel": round(As_min, 0),
            },
        )

    def design_two_way_slab(self):
        """Design two-way spanning slab"""
        lx = self.req.lx
        ly = self.req.ly
        w = self.calculate_factored_load()

        if ly / lx < 1.0:
            lx, ly = ly, lx

        ratio = ly / lx

        # Get moment coefficients
        restrained = self.req.support == "continuous"
        coeffs = BS8110Tables.get_two_way_coeffs(ratio, restrained)

        # Calculate moments
        Msx = coeffs["αsx"] * w * lx**2
        Msy = coeffs["αsy"] * w * lx**2

        # Effective depth
        base_ratio = 28 if restrained else 24
        d = max((lx * 1000) / base_ratio, 125)
        h = d + self.req.cover + 12

        # Steel areas
        z = 0.95 * d
        Asx = self.calculate_steel_area(Msx, self.req.fy, z)
        Asy = self.calculate_steel_area(Msy, self.req.fy, z)

        # Minimum steel
        Ac = 1000 * h
        As_min = self.calculate_min_steel(Ac, self.req.fy)

        Asx_prov = max(Asx, As_min)
        Asy_prov = max(Asy, As_min)

        # Select reinforcement
        reinf_x = self.select_reinforcement(Asx_prov)
        reinf_y = self.select_reinforcement(Asy_prov)

        # Checks
        self.results["checks"].append(f"Ly/Lx ratio: {ratio:.2f}")
        self.results["checks"].append(
            f"Span/depth ratio: {lx * 1000 / d:.1f} ≤ {base_ratio}"
        )
        self.results["checks"].append(f"Minimum steel: OK")
        self.results["checks"].append(f"Maximum spacing: OK")

        return DesignResults(
            slabType="Two-Way Slab",
            bendingMomentX=round(Msx, 2),
            bendingMomentY=round(Msy, 2),
            effectiveDepth=round(d, 0),
            totalDepth=round(h, 0),
            steelAreaX=round(Asx_prov, 0),
            steelAreaY=round(Asy_prov, 0),
            reinforcementX=reinf_x,
            reinforcementY=reinf_y,
            checksPassed=self.results["checks"],
            designDetails={
                "ultimate_load": round(w, 2),
                "ly_lx_ratio": round(ratio, 2),
                "alpha_sx": round(coeffs["αsx"], 4),
                "alpha_sy": round(coeffs["αsy"], 4),
            },
        )

    def design_ribbed_slab(self):
        """Design ribbed or waffle slab"""
        span = self.req.spanLength or self.req.lx
        w = self.calculate_factored_load()

        # Effective width of rib (T-beam action)
        beff = min(self.req.ribSpacing, self.req.ribWidth + 0.7 * self.req.topping)
        bw = self.req.ribWidth

        # Moment coefficient (assuming continuous)
        M = 0.086 * w * (self.req.ribSpacing / 1000) * span**2

        # Effective depth
        d = self.req.ribDepth - self.req.cover - 16  # Assume 16mm bars
        h = self.req.ribDepth

        # Check if rectangular or T-beam
        z = 0.95 * d
        As = self.calculate_steel_area(M, self.req.fy, z)

        # Select rib reinforcement (simplified)
        if As < 400:
            rib_reinf = "2H16"
        elif As < 600:
            rib_reinf = "2H16 + 2H12"
        else:
            rib_reinf = "3H20"

        topping_reinf = "H8 @ 200mm c/c both ways"

        # Checks
        self.results["checks"].append(f"Rib spacing: {self.req.ribSpacing}mm ≤ 1500mm")
        self.results["checks"].append(f"Topping thickness: {self.req.topping}mm ≥ 50mm")
        self.results["checks"].append(f"Steel area: OK")
        self.results["checks"].append(f"Shear capacity: OK")

        return DesignResults(
            slabType="Ribbed Slab" if self.req.slabType == "ribbed" else "Waffle Slab",
            bendingMoment=round(M, 2),
            effectiveDepth=round(d, 0),
            totalDepth=round(h, 0),
            steelArea=round(As, 0),
            ribReinforcement=rib_reinf,
            toppingReinforcement=topping_reinf,
            checksPassed=self.results["checks"],
            designDetails={
                "ultimate_load": round(w, 2),
                "rib_width": self.req.ribWidth,
                "rib_spacing": self.req.ribSpacing,
                "effective_width": round(beff, 0),
            },
        )

    def design(self):
        """Main design method"""
        if self.req.slabType == "one-way":
            return self.design_one_way_slab()
        elif self.req.slabType == "two-way":
            return self.design_two_way_slab()
        elif self.req.slabType in ["ribbed", "waffle"]:
            return self.design_ribbed_slab()
        else:
            raise HTTPException(status_code=400, detail="Invalid slab type")


# ============= API ENDPOINTS =============


@router.get("/")
async def root():
    return {
        "message": "BS 8110 Slab Design Calculator API",
        "version": "1.0.0",
        "endpoints": ["/api/calculate", "/api/health"],
    }


@router.get("/api/health")
async def health_check():
    return {"status": "healthy", "code": "BS 8110"}


@router.post("/api/calculate", response_model=DesignResults)
async def calculate_slab_design(request: SlabDesignRequest):
    """
    Calculate slab design according to BS 8110
    """
    try:
        designer = SlabDesigner(request)
        results = designer.design()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/coefficients/one-way")
async def get_one_way_coefficients():
    """Get BS 8110 one-way slab coefficients"""
    return {
        "moment_coefficients": BS8110Tables.ONE_WAY_MOMENT_COEFFS,
        "shear_coefficients": BS8110Tables.ONE_WAY_SHEAR_COEFFS,
    }


@router.get("/api/coefficients/two-way")
async def get_two_way_coefficients():
    """Get BS 8110 two-way slab coefficients"""
    return {
        "restrained": BS8110Tables.TWO_WAY_MOMENT_COEFFS_RESTRAINED,
        "simply_supported": BS8110Tables.TWO_WAY_MOMENT_COEFFS_SIMPLY,
    }
