from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal, Dict, List
import math

router = APIRouter()


# BS Code Constants and Tables
class BSCodeTables:
    """BS EN 1992-1-1:2004 and BS 8110 Tables"""

    # Concrete strength classes (BS EN 1992-1-1 Table 3.1)
    CONCRETE_PROPERTIES = {
        25: {"fck": 25, "fcm": 33, "fctm": 2.6, "Ecm": 31000},
        30: {"fck": 30, "fcm": 38, "fctm": 2.9, "Ecm": 32000},
        35: {"fck": 35, "fcm": 43, "fctm": 3.2, "Ecm": 33500},
        40: {"fck": 40, "fcm": 48, "fctm": 3.5, "Ecm": 35000},
    }

    # Partial safety factors (BS EN 1992-1-1 Clause 2.4.2.4)
    GAMMA_C = 1.5  # Concrete
    GAMMA_S = 1.15  # Steel

    # Bar areas (mm²)
    BAR_AREAS = {8: 50.3, 10: 78.5, 12: 113, 16: 201, 20: 314, 25: 491, 32: 804}

    # Minimum cover for durability (BS EN 1992-1-1 Table 4.4N)
    MIN_COVER = {"XC1": 15, "XC3": 25, "XC4": 30, "XD1": 40}

    @staticmethod
    def get_shear_stress_limit(fck: float) -> float:
        """BS EN 1992-1-1 Clause 6.2.2"""
        return 0.18 * (fck**0.5) / 1.5


class WallInput(BaseModel):
    wallType: Literal["shear", "core", "retaining", "bearing"]
    height: float = Field(..., gt=0, description="Wall height in meters")
    length: float = Field(..., gt=0, description="Wall length in meters")
    thickness: float = Field(..., gt=0, description="Wall thickness in mm")
    axialLoad: float = Field(..., ge=0, description="Axial load in kN")
    shearForce: float = Field(..., ge=0, description="Shear force in kN")
    moment: float = Field(..., ge=0, description="Moment in kNm")
    concreteGrade: int = Field(..., description="Concrete grade in MPa")
    steelGrade: int = Field(..., description="Steel grade in MPa")
    coverDepth: float = Field(..., gt=0, description="Cover depth in mm")
    exposureClass: str = Field(..., description="Exposure class")


class ReinforcementDetail(BaseModel):
    diameter: int
    spacing: float
    area: float
    ratio: float


class CapacityCheck(BaseModel):
    axialCapacity: float
    shearCapacity: float
    momentCapacity: float
    utilization: Dict[str, float]


class CodeCheck(BaseModel):
    name: str
    status: Literal["PASS", "FAIL"]
    value: str
    limit: str


class DesignResult(BaseModel):
    wallType: str
    designStatus: Literal["PASS", "FAIL"]
    reinforcement: Dict[str, ReinforcementDetail]
    capacities: CapacityCheck
    checks: List[CodeCheck]
    bsCodeReferences: List[str]


class RCWallDesigner:
    """Reinforced Concrete Wall Designer per BS Codes"""

    def __init__(self, inputs: WallInput):
        self.inputs = inputs
        self.tables = BSCodeTables()
        self.concrete_props = self.tables.CONCRETE_PROPERTIES[inputs.concreteGrade]

    def calculate_effective_depth(self, vertical: bool = True) -> float:
        """Calculate effective depth"""
        cover = self.inputs.coverDepth
        bar_dia = 16 if vertical else 12
        stirrup = 8
        d = self.inputs.thickness - cover - stirrup - bar_dia / 2
        return d

    def calculate_slenderness(self) -> float:
        """BS EN 1992-1-1 Clause 5.8.3.2"""
        h = self.inputs.height * 1000  # mm
        b = self.inputs.thickness
        effective_height = h  # Assuming fixed both ends
        slenderness = effective_height / b
        return slenderness

    def calculate_min_reinforcement(self) -> float:
        """BS EN 1992-1-1 Clause 9.6.2"""
        # As,min = 0.002 * Ac (minimum for walls)
        Ac = self.inputs.thickness * 1000  # per meter width
        As_min = 0.002 * Ac
        return As_min

    def calculate_max_reinforcement(self) -> float:
        """BS EN 1992-1-1 Clause 9.6.3"""
        # As,max = 0.04 * Ac
        Ac = self.inputs.thickness * 1000
        As_max = 0.04 * Ac
        return As_max

    def design_vertical_reinforcement(self) -> ReinforcementDetail:
        """Design vertical reinforcement per BS codes"""
        # Calculate required area based on axial load and moment
        N_Ed = self.inputs.axialLoad * 1000  # Convert to N
        M_Ed = self.inputs.moment * 1e6  # Convert to Nmm

        d = self.calculate_effective_depth(vertical=True)
        b = 1000  # per meter width

        fck = self.concrete_props["fck"]
        fyd = self.inputs.steelGrade / self.tables.GAMMA_S
        fcd = fck / self.tables.GAMMA_C

        # Simplified calculation for combined axial and bending
        # Using K = M/(bd²fck)
        K = M_Ed / (b * d * d * fcd)

        # Calculate lever arm z
        la = 0.5 + math.sqrt(0.25 - K / 1.134) if K < 0.167 else 0.95
        z = la * d

        # Required steel area
        As_req_moment = M_Ed / (0.87 * fyd * z)
        As_req_axial = max(0, (N_Ed - 0.567 * fck * b * d) / (0.87 * fyd))
        As_required = max(As_req_moment, As_req_axial)

        # Apply minimum reinforcement
        As_min = self.calculate_min_reinforcement()
        As_required = max(As_required, As_min)

        # Select bar size and spacing
        bar_dia = 16
        bar_area = self.tables.BAR_AREAS[bar_dia]
        spacing = min(bar_area * 1000 / As_required, 300)  # Max 300mm spacing
        spacing = round(spacing / 25) * 25  # Round to 25mm
        spacing = max(spacing, 100)  # Min 100mm spacing

        actual_area = bar_area * 1000 / spacing
        ratio = actual_area / (self.inputs.thickness * 1000)

        return ReinforcementDetail(
            diameter=bar_dia,
            spacing=spacing,
            area=round(actual_area, 0),
            ratio=round(ratio, 4),
        )

    def design_horizontal_reinforcement(self) -> ReinforcementDetail:
        """Design horizontal reinforcement per BS EN 1992-1-1 Clause 9.6"""
        # Minimum horizontal reinforcement = 25% of vertical or 0.001Ac
        vertical_steel = self.design_vertical_reinforcement()
        As_min_horiz = max(
            0.25 * vertical_steel.area, 0.001 * self.inputs.thickness * 1000
        )

        # For shear walls, consider shear requirements
        if self.inputs.wallType in ["shear", "core"]:
            V_Ed = self.inputs.shearForce * 1000  # N
            d = self.calculate_effective_depth(vertical=False)
            b = 1000

            # Check if shear reinforcement needed
            v_Ed = V_Ed / (b * d)
            fck = self.concrete_props["fck"]
            v_Rd_c = self.tables.get_shear_stress_limit(fck)

            if v_Ed > v_Rd_c * 1e6:
                # Additional reinforcement for shear
                fyd = self.inputs.steelGrade / self.tables.GAMMA_S
                As_shear = (v_Ed - v_Rd_c * 1e6) * b * d / (0.87 * fyd * d)
                As_min_horiz = max(As_min_horiz, As_shear)

        # Select bar size and spacing
        bar_dia = 12
        bar_area = self.tables.BAR_AREAS[bar_dia]
        spacing = min(bar_area * 1000 / As_min_horiz, 400)  # Max 400mm
        spacing = round(spacing / 25) * 25
        spacing = max(spacing, 150)

        actual_area = bar_area * 1000 / spacing
        ratio = actual_area / (self.inputs.thickness * 1000)

        return ReinforcementDetail(
            diameter=bar_dia,
            spacing=spacing,
            area=round(actual_area, 0),
            ratio=round(ratio, 4),
        )

    def calculate_axial_capacity(self, As_vertical: float) -> float:
        """BS EN 1992-1-1 Clause 6.1"""
        fck = self.concrete_props["fck"]
        fcd = fck / self.tables.GAMMA_C
        fyd = self.inputs.steelGrade / self.tables.GAMMA_S

        Ac = self.inputs.thickness * self.inputs.length * 1e6  # mm²
        As = As_vertical * self.inputs.length  # Total area

        # Simplified axial capacity
        N_Rd = 0.567 * fcd * Ac + 0.87 * fyd * As
        return N_Rd / 1000  # Convert to kN

    def calculate_shear_capacity(self) -> float:
        """BS EN 1992-1-1 Clause 6.2"""
        d = self.calculate_effective_depth(vertical=True)
        b = self.inputs.length * 1000  # mm
        fck = self.concrete_props["fck"]

        # Concrete contribution
        v_Rd_c = self.tables.get_shear_stress_limit(fck)
        V_Rd_c = v_Rd_c * b * d

        # Add shear reinforcement contribution
        horiz_steel = self.design_horizontal_reinforcement()
        Asw_s = horiz_steel.area  # mm²/m
        fyd = self.inputs.steelGrade / self.tables.GAMMA_S

        V_Rd_s = Asw_s * fyd * 0.9 * d / 1000  # per meter
        V_Rd = (V_Rd_c + V_Rd_s * self.inputs.length) / 1000  # kN

        return V_Rd

    def calculate_moment_capacity(self, As_vertical: float) -> float:
        """BS EN 1992-1-1 Clause 6.1"""
        d = self.calculate_effective_depth(vertical=True)
        b = self.inputs.length * 1000
        As = As_vertical * self.inputs.length

        fyd = self.inputs.steelGrade / self.tables.GAMMA_S
        fck = self.concrete_props["fck"]
        fcd = fck / self.tables.GAMMA_C

        # Calculate neutral axis depth
        x = As * fyd / (0.567 * fcd * b)

        # Lever arm
        z = d - 0.4 * x
        z = min(z, 0.95 * d)

        # Moment capacity
        M_Rd = As * fyd * z / 1e6  # kNm
        return M_Rd

    def check_crack_control(self, As_vertical: float) -> tuple:
        """BS EN 1992-1-1 Clause 7.3"""
        # Simplified crack width calculation
        fck = self.concrete_props["fck"]
        fctm = self.concrete_props["fctm"]

        # Maximum crack width for exposure class
        crack_limits = {"XC1": 0.4, "XC3": 0.3, "XC4": 0.3, "XD1": 0.3}
        w_max = crack_limits.get(self.inputs.exposureClass, 0.3)

        # Simplified estimation
        steel_stress = 200  # MPa (assumed service stress)
        spacing = self.design_vertical_reinforcement().spacing
        cover = self.inputs.coverDepth

        # Crack width estimation
        w_k = steel_stress * spacing * cover / (200000 * As_vertical) * 1000
        w_k = min(w_k, w_max * 1.2)  # Simplified

        return w_k, w_max

    def perform_checks(
        self,
        vert_reinf: ReinforcementDetail,
        horiz_reinf: ReinforcementDetail,
        capacities: CapacityCheck,
    ) -> List[CodeCheck]:
        """Perform all BS code checks"""
        checks = []

        # 1. Minimum reinforcement check
        As_min = self.calculate_min_reinforcement()
        total_ratio = (vert_reinf.area + horiz_reinf.area) / (
            self.inputs.thickness * 1000
        )
        checks.append(
            CodeCheck(
                name="Minimum Reinforcement",
                status="PASS" if total_ratio >= 0.004 else "FAIL",
                value=f"{total_ratio * 100:.2f}%",
                limit="0.40%",
            )
        )

        # 2. Maximum reinforcement check
        As_max = self.calculate_max_reinforcement()
        checks.append(
            CodeCheck(
                name="Maximum Reinforcement",
                status="PASS" if total_ratio <= 0.04 else "FAIL",
                value=f"{total_ratio * 100:.2f}%",
                limit="4.00%",
            )
        )

        # 3. Slenderness check
        slenderness = self.calculate_slenderness()
        checks.append(
            CodeCheck(
                name="Slenderness Ratio",
                status="PASS" if slenderness <= 30 else "FAIL",
                value=f"{slenderness:.1f}",
                limit="30.0",
            )
        )

        # 4. Shear stress check
        d = self.calculate_effective_depth(vertical=True)
        v_Ed = self.inputs.shearForce * 1000 / (self.inputs.length * 1000 * d)
        v_max = 0.5 * self.concrete_props["fck"] / self.tables.GAMMA_C
        checks.append(
            CodeCheck(
                name="Shear Stress",
                status="PASS" if v_Ed <= v_max else "FAIL",
                value=f"{v_Ed:.2f} MPa",
                limit=f"{v_max:.2f} MPa",
            )
        )

        # 5. Crack control check
        w_k, w_max = self.check_crack_control(vert_reinf.area)
        checks.append(
            CodeCheck(
                name="Crack Control",
                status="PASS" if w_k <= w_max else "FAIL",
                value=f"{w_k:.2f} mm",
                limit=f"{w_max:.2f} mm",
            )
        )

        return checks

    def design(self) -> DesignResult:
        """Complete wall design"""
        # Design reinforcement
        vert_reinf = self.design_vertical_reinforcement()
        horiz_reinf = self.design_horizontal_reinforcement()

        # Calculate capacities
        axial_cap = self.calculate_axial_capacity(vert_reinf.area)
        shear_cap = self.calculate_shear_capacity()
        moment_cap = self.calculate_moment_capacity(vert_reinf.area)

        capacities = CapacityCheck(
            axialCapacity=round(axial_cap, 1),
            shearCapacity=round(shear_cap, 1),
            momentCapacity=round(moment_cap, 1),
            utilization={
                "axial": round(self.inputs.axialLoad / axial_cap, 2),
                "shear": round(self.inputs.shearForce / shear_cap, 2),
                "moment": round(self.inputs.moment / moment_cap, 2),
            },
        )

        # Perform checks
        checks = self.perform_checks(vert_reinf, horiz_reinf, capacities)

        # Overall status
        design_status = "PASS" if all(c.status == "PASS" for c in checks) else "FAIL"

        # BS code references
        bs_references = [
            "BS EN 1992-1-1:2004 (Eurocode 2)",
            "BS 8110-1:1997 (Structural Use of Concrete)",
            "BS 8500-1:2015 (Concrete Specification)",
        ]

        return DesignResult(
            wallType=self.inputs.wallType,
            designStatus=design_status,
            reinforcement={"vertical": vert_reinf, "horizontal": horiz_reinf},
            capacities=capacities,
            checks=checks,
            bsCodeReferences=bs_references,
        )


@router.get("/")
def read_root():
    return {
        "message": "RC Wall Design Calculator API",
        "version": "1.0",
        "standards": ["BS EN 1992-1-1:2004", "BS 8110-1:1997"],
    }


@router.post("/api/calculate", response_model=DesignResult)
def calculate_wall_design(inputs: WallInput):
    """Calculate RC wall design according to BS codes"""
    try:
        designer = RCWallDesigner(inputs)
        result = designer.design()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/concrete-grades")
def get_concrete_grades():
    """Get available concrete grades"""
    return {
        "grades": list(BSCodeTables.CONCRETE_PROPERTIES.keys()),
        "properties": BSCodeTables.CONCRETE_PROPERTIES,
    }


@router.get("/api/bar-sizes")
def get_bar_sizes():
    """Get available reinforcement bar sizes"""
    return {
        "sizes": list(BSCodeTables.BAR_AREAS.keys()),
        "areas": BSCodeTables.BAR_AREAS,
    }
