from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal, Dict, List, Optional
import math

router = APIRouter()


# BS Code Constants and Tables
class BSCodeTables:
    """BS EN 1992-1-1:2004 and BS 8110-1:1997 Tables"""

    # Concrete strength classes (BS EN 1992-1-1 Table 3.1)
    CONCRETE_PROPERTIES = {
        20: {"fck": 20, "fcm": 28, "fctm": 2.2, "Ecm": 30000},
        25: {"fck": 25, "fcm": 33, "fctm": 2.6, "Ecm": 31000},
        30: {"fck": 30, "fcm": 38, "fctm": 2.9, "Ecm": 32000},
        35: {"fck": 35, "fcm": 43, "fctm": 3.2, "Ecm": 33500},
        40: {"fck": 40, "fcm": 48, "fctm": 3.5, "Ecm": 35000},
        45: {"fck": 45, "fcm": 53, "fctm": 3.8, "Ecm": 36000},
        50: {"fck": 50, "fcm": 58, "fctm": 4.1, "Ecm": 37000},
    }

    # Partial safety factors (BS EN 1992-1-1 Clause 2.4.2.4)
    GAMMA_C = 1.5  # Concrete
    GAMMA_S = 1.15  # Steel

    # Bar areas (mm²) - Standard UK reinforcement
    BAR_AREAS = {
        8: 50.3,
        10: 78.5,
        12: 113,
        16: 201,
        20: 314,
        25: 491,
        32: 804,
        40: 1257,
    }

    # Minimum cover for durability (BS EN 1992-1-1 Table 4.4N)
    MIN_COVER = {
        "XC1": 15,
        "XC2": 25,
        "XC3": 25,
        "XC4": 30,
        "XD1": 40,
        "XD2": 45,
        "XD3": 50,
        "XS1": 45,
        "XS2": 50,
        "XS3": 55,
    }

    # Maximum bar spacing (BS 8110 Clause 3.12.11.2.7)
    MAX_SPACING = {"vertical": 300, "horizontal": 400}  # mm  # mm

    # Minimum bar spacing
    MIN_SPACING = {"vertical": 100, "horizontal": 150}

    @staticmethod
    def get_shear_stress_limit(fck: float) -> float:
        """BS EN 1992-1-1 Clause 6.2.2"""
        return 0.18 * (fck**0.5) / BSCodeTables.GAMMA_C


class WallInput(BaseModel):
    wallType: Literal["shear", "core", "bearing"]
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
    supportCondition: Literal["fixed-fixed", "pinned-pinned", "fixed-free"] = Field(
        default="fixed-fixed"
    )


class ReinforcementDetail(BaseModel):
    diameter: int
    spacing: float
    area: float
    ratio: float
    location: str


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
    reference: str


class CalculationStep(BaseModel):
    step: str
    formula: str
    values: Dict
    result: float | Dict
    reference: str


class DesignResult(BaseModel):
    wallType: str
    designStatus: Literal["PASS", "FAIL"]
    reinforcement: Dict[str, ReinforcementDetail]
    capacities: CapacityCheck
    checks: List[CodeCheck]
    bsCodeReferences: List[str]
    calculations: List[CalculationStep]
    warnings: List[str]


class RCWallDesigner:
    """Enhanced Reinforced Concrete Wall Designer per BS Codes"""

    def __init__(self, inputs: WallInput):
        self.inputs = inputs
        self.tables = BSCodeTables()
        
        if inputs.concreteGrade not in self.tables.CONCRETE_PROPERTIES:
            raise ValueError(f"Concrete grade C{inputs.concreteGrade} not supported")
        
        self.concrete_props = self.tables.CONCRETE_PROPERTIES[inputs.concreteGrade]
        self.calculations = []
        self.warnings = []

    def add_calculation(
        self, step: str, formula: str, values: dict, result, reference: str
    ):
        """Add a calculation step for transparency"""
        self.calculations.append(
            {
                "step": step,
                "formula": formula,
                "values": values,
                "result": result,
                "reference": reference,
            }
        )

    def calculate_slenderness(self) -> dict:
        """BS EN 1992-1-1 Clause 5.8.3.2 - Slenderness Ratio"""
        h = self.inputs.height * 1000  # Convert to mm
        t = self.inputs.thickness

        # Effective height factor based on support conditions
        beta_factors = {"fixed-fixed": 0.75, "pinned-pinned": 1.0, "fixed-free": 2.0}
        beta = beta_factors[self.inputs.supportCondition]

        le = beta * h
        slenderness = le / t

        self.add_calculation(
            step="Slenderness Calculation",
            formula="λ = (β × H) / t",
            values={"beta": beta, "H": h, "t": t, "le": le},
            result=slenderness,
            reference="BS EN 1992-1-1 Clause 5.8.3.2",
        )

        # Slenderness limits
        if self.inputs.wallType in ["shear", "core"]:
            limit = 30
        else:
            limit = 15

        is_stocky = slenderness <= limit

        if not is_stocky:
            self.warnings.append(
                f"Wall is slender (λ={slenderness:.1f} > {limit}). Additional slenderness effects must be considered."
            )

        return {"slenderness": slenderness, "isStocky": is_stocky, "limit": limit}

    def calculate_effective_depth(self, vertical: bool = True) -> float:
        """BS EN 1992-1-1 Clause 6.2.1 - Effective Depth"""
        cover = self.inputs.coverDepth
        main_bar = 16 if vertical else 12
        link = 8

        d = self.inputs.thickness - cover - link - main_bar / 2

        self.add_calculation(
            step=f"Effective Depth ({'Vertical' if vertical else 'Horizontal'})",
            formula="d = h - cover - φ_link - φ_bar/2",
            values={"h": self.inputs.thickness, "cover": cover, "link": link, "bar": main_bar},
            result=d,
            reference="BS EN 1992-1-1 Clause 6.2.1",
        )

        return d

    def calculate_min_reinforcement(self) -> float:
        """BS EN 1992-1-1 Clause 9.6.2 & BS 8110 Clause 3.12.5"""
        Ac = self.inputs.thickness * 1000  # per meter width
        As_min = 0.002 * Ac  # 0.2% minimum

        self.add_calculation(
            step="Minimum Reinforcement",
            formula="As,min = 0.002 × Ac",
            values={"Ac": Ac},
            result=As_min,
            reference="BS EN 1992-1-1 Clause 9.6.2",
        )

        return As_min

    def calculate_max_reinforcement(self) -> float:
        """BS EN 1992-1-1 Clause 9.6.3"""
        Ac = self.inputs.thickness * 1000
        As_max = 0.04 * Ac  # 4% maximum

        self.add_calculation(
            step="Maximum Reinforcement",
            formula="As,max = 0.04 × Ac",
            values={"Ac": Ac},
            result=As_max,
            reference="BS EN 1992-1-1 Clause 9.6.3",
        )

        return As_max

    def design_vertical_reinforcement(self) -> ReinforcementDetail:
        """Design vertical reinforcement per BS EN 1992-1-1 Clause 6.1"""
        N_Ed = self.inputs.axialLoad * 1000  # Convert to N
        M_Ed = self.inputs.moment * 1e6  # Convert to Nmm
        d = self.calculate_effective_depth(vertical=True)
        b = 1000  # per meter width

        fck = self.concrete_props["fck"]
        fyd = self.inputs.steelGrade / self.tables.GAMMA_S
        fcd = fck / self.tables.GAMMA_C

        # Calculate K = M/(bd²fck) - BS EN 1992-1-1
        K = M_Ed / (b * d * d * fcd)

        # Calculate lever arm z
        if K < 0.167:
            la = 0.5 + math.sqrt(0.25 - K / 1.134)
        else:
            la = 0.95
            self.warnings.append("Compression reinforcement may be required (K > 0.167)")

        z = min(la * d, 0.95 * d)

        # Required steel area for moment
        As_req_moment = M_Ed / (0.87 * fyd * z) if M_Ed > 0 else 0

        # Required steel area for axial load
        As_req_axial = max(0, (N_Ed - 0.567 * fcd * b * d) / (0.87 * fyd))

        As_required = max(As_req_moment, As_req_axial)

        # Apply minimum reinforcement
        As_min = self.calculate_min_reinforcement()
        As_required = max(As_required, As_min)

        self.add_calculation(
            step="Vertical Reinforcement - Moment & Axial",
            formula="As = max(M/(0.87×fyd×z), (N - 0.567×fcd×b×d)/(0.87×fyd), As,min)",
            values={
                "M_Ed": M_Ed,
                "N_Ed": N_Ed,
                "K": K,
                "z": z,
                "As_moment": As_req_moment,
                "As_axial": As_req_axial,
                "As_min": As_min,
            },
            result=As_required,
            reference="BS EN 1992-1-1 Clause 6.1",
        )

        # Select bar size and spacing
        bar_dia = 16
        bar_area = self.tables.BAR_AREAS[bar_dia]

        # Calculate spacing
        spacing = bar_area * 1000 / As_required
        spacing = min(spacing, self.tables.MAX_SPACING["vertical"])
        spacing = round(spacing / 25) * 25  # Round to nearest 25mm
        spacing = max(spacing, self.tables.MIN_SPACING["vertical"])

        actual_area = bar_area * 1000 / spacing
        ratio = actual_area / (self.inputs.thickness * 1000)

        self.add_calculation(
            step="Bar Selection - Vertical",
            formula="s = (Ab × 1000) / As_req, rounded to 25mm",
            values={"bar_dia": bar_dia, "bar_area": bar_area, "As_req": As_required},
            result={"spacing": spacing, "actual_area": actual_area},
            reference="BS 8110 Clause 3.12.11",
        )

        return ReinforcementDetail(
            diameter=bar_dia,
            spacing=round(spacing),
            area=round(actual_area, 1),
            ratio=round(ratio, 4),
            location="Each Face (2 layers)",
        )

    def design_horizontal_reinforcement(
        self, vertical_steel: ReinforcementDetail
    ) -> ReinforcementDetail:
        """Design horizontal reinforcement per BS EN 1992-1-1 Clause 9.6 & 6.2"""
        # Minimum = 25% of vertical or 0.001Ac (BS EN 1992-1-1 Clause 9.6.3)
        As_min_horiz = max(
            0.25 * vertical_steel.area, 0.001 * self.inputs.thickness * 1000
        )

        # For shear walls, check shear requirements (BS EN 1992-1-1 Clause 6.2)
        if self.inputs.wallType in ["shear", "core"]:
            V_Ed = self.inputs.shearForce * 1000  # N
            d = self.calculate_effective_depth(vertical=False)
            b = 1000

            # Shear stress
            v_Ed = V_Ed / (b * d)

            # Concrete shear capacity
            fck = self.concrete_props["fck"]
            v_Rd_c = self.tables.get_shear_stress_limit(fck)

            if v_Ed > v_Rd_c * 1e6:
                fyd = self.inputs.steelGrade / self.tables.GAMMA_S
                As_shear = (v_Ed - v_Rd_c * 1e6) * b / (0.87 * fyd)
                As_min_horiz = max(As_min_horiz, As_shear)

                self.warnings.append(
                    f"Additional horizontal reinforcement required for shear (v_Ed={v_Ed/1e6:.2f} MPa > v_Rd,c={v_Rd_c:.2f} MPa)"
                )

                self.add_calculation(
                    step="Shear Reinforcement Check",
                    formula="Asw/s = (v_Ed - v_Rd,c) × b / (0.87 × fyd)",
                    values={
                        "V_Ed": V_Ed,
                        "v_Ed": v_Ed / 1e6,
                        "v_Rd_c": v_Rd_c,
                        "As_shear": As_shear,
                    },
                    result=As_min_horiz,
                    reference="BS EN 1992-1-1 Clause 6.2.3",
                )

        # Select bar size and spacing
        bar_dia = 12
        bar_area = self.tables.BAR_AREAS[bar_dia]

        spacing = bar_area * 1000 / As_min_horiz
        spacing = min(spacing, self.tables.MAX_SPACING["horizontal"])
        spacing = round(spacing / 25) * 25
        spacing = max(spacing, self.tables.MIN_SPACING["horizontal"])

        actual_area = bar_area * 1000 / spacing
        ratio = actual_area / (self.inputs.thickness * 1000)

        self.add_calculation(
            step="Bar Selection - Horizontal",
            formula="s = (Ab × 1000) / As_req, max(0.25×As_v, 0.001×Ac)",
            values={"bar_dia": bar_dia, "As_min": As_min_horiz},
            result={"spacing": spacing, "actual_area": actual_area},
            reference="BS EN 1992-1-1 Clause 9.6",
        )

        return ReinforcementDetail(
            diameter=bar_dia,
            spacing=round(spacing),
            area=round(actual_area, 1),
            ratio=round(ratio, 4),
            location="Each Face (2 layers)",
        )

    def calculate_axial_capacity(self, As_vertical: float) -> float:
        """BS EN 1992-1-1 Clause 6.1 & BS 8110 Clause 3.9.3"""
        fck = self.concrete_props["fck"]
        fcd = fck / self.tables.GAMMA_C
        fyd = self.inputs.steelGrade / self.tables.GAMMA_S

        Ac = self.inputs.thickness * self.inputs.length * 1e6  # mm²
        As = As_vertical * self.inputs.length  # Total area

        # Simplified axial capacity (BS EN 1992-1-1 Eq. 6.10)
        # N_Rd = 0.567 × fcd × Ac + 0.87 × fyd × As
        N_Rd = (0.567 * fcd * Ac + 0.87 * fyd * As) / 1000  # kN

        self.add_calculation(
            step="Axial Load Capacity",
            formula="N_Rd = 0.567 × fcd × Ac + 0.87 × fyd × As",
            values={"fcd": fcd, "fyd": fyd, "Ac": Ac, "As": As},
            result=N_Rd,
            reference="BS EN 1992-1-1 Eq. 6.10",
        )

        return N_Rd

    def calculate_shear_capacity(self, horiz_steel: ReinforcementDetail) -> float:
        """BS EN 1992-1-1 Clause 6.2 - Shear Resistance"""
        d = self.calculate_effective_depth(vertical=True)
        bw = self.inputs.length * 1000  # mm
        fck = self.concrete_props["fck"]

        # Concrete contribution (BS EN 1992-1-1 Eq. 6.2.a)
        v_Rd_c = self.tables.get_shear_stress_limit(fck)
        V_Rd_c = v_Rd_c * bw * d

        # Steel contribution
        Asw_s = horiz_steel.area  # mm²/m
        fyd = self.inputs.steelGrade / self.tables.GAMMA_S
        
        # V_Rd,s = (Asw/s) × fywd × z
        V_Rd_s = (Asw_s * fyd * 0.9 * d / 1000) * self.inputs.length

        V_Rd = (V_Rd_c + V_Rd_s) / 1000  # kN

        self.add_calculation(
            step="Shear Capacity",
            formula="V_Rd = V_Rd,c + V_Rd,s",
            values={
                "v_Rd_c": v_Rd_c,
                "V_Rd_c": V_Rd_c / 1000,
                "V_Rd_s": V_Rd_s / 1000,
                "d": d,
                "bw": bw,
            },
            result=V_Rd,
            reference="BS EN 1992-1-1 Clause 6.2",
        )

        return V_Rd

    def calculate_moment_capacity(self, As_vertical: float) -> float:
        """BS EN 1992-1-1 Clause 6.1 - Moment Resistance"""
        d = self.calculate_effective_depth(vertical=True)
        b = self.inputs.length * 1000
        As = As_vertical * self.inputs.length

        fyd = self.inputs.steelGrade / self.tables.GAMMA_S
        fck = self.concrete_props["fck"]
        fcd = fck / self.tables.GAMMA_C

        # Calculate neutral axis depth
        x = (As * fyd) / (0.567 * fcd * b)

        # Lever arm
        z = d - 0.4 * x
        z = min(z, 0.95 * d)

        # Moment capacity
        M_Rd = (As * fyd * z) / 1e6  # kNm

        self.add_calculation(
            step="Moment Capacity",
            formula="M_Rd = As × fyd × z",
            values={"As": As, "fyd": fyd, "z": z, "x": x, "d": d},
            result=M_Rd,
            reference="BS EN 1992-1-1 Clause 6.1",
        )

        return M_Rd

    def check_crack_control(
        self, As_vertical: float, spacing: float
    ) -> tuple[float, float, bool]:
        """BS EN 1992-1-1 Clause 7.3 - Crack Control"""
        exposure_limits = {
            "XC1": 0.4,
            "XC2": 0.3,
            "XC3": 0.3,
            "XC4": 0.3,
            "XD1": 0.3,
            "XD2": 0.3,
            "XD3": 0.3,
            "XS1": 0.3,
            "XS2": 0.3,
            "XS3": 0.3,
        }

        w_max = exposure_limits.get(self.inputs.exposureClass, 0.3)

        # Simplified crack width estimation (BS EN 1992-1-1 Section 7.3.4)
        steel_stress = 200  # MPa (assumed service stress)
        cover = self.inputs.coverDepth

        # Simplified formula
        w_k = (steel_stress * spacing * cover) / (200000 * As_vertical) * 1000
        w_k = min(w_k, w_max * 1.5)  # Cap at 1.5 × limit

        status = w_k <= w_max

        self.add_calculation(
            step="Crack Width Check",
            formula="wk = (σs × s × c) / (Es × As) (simplified)",
            values={
                "steel_stress": steel_stress,
                "spacing": spacing,
                "cover": cover,
                "As": As_vertical,
            },
            result={"wk": w_k, "w_max": w_max, "status": "PASS" if status else "FAIL"},
            reference="BS EN 1992-1-1 Clause 7.3",
        )

        return w_k, w_max, status

    def perform_checks(
        self,
        vert_reinf: ReinforcementDetail,
        horiz_reinf: ReinforcementDetail,
        capacities: CapacityCheck,
    ) -> List[CodeCheck]:
        """Perform all BS code compliance checks"""
        checks = []

        # 1. Minimum reinforcement (BS EN 1992-1-1 Clause 9.6.2)
        total_area = vert_reinf.area + horiz_reinf.area
        total_ratio = total_area / (self.inputs.thickness * 1000)
        checks.append(
            CodeCheck(
                name="Minimum Reinforcement",
                status="PASS" if total_ratio >= 0.004 else "FAIL",
                value=f"{total_ratio * 100:.2f}%",
                limit="0.40%",
                reference="BS EN 1992-1-1 Cl. 9.6.2",
            )
        )

        # 2. Maximum reinforcement (BS EN 1992-1-1 Clause 9.6.3)
        checks.append(
            CodeCheck(
                name="Maximum Reinforcement",
                status="PASS" if total_ratio <= 0.04 else "FAIL",
                value=f"{total_ratio * 100:.2f}%",
                limit="4.00%",
                reference="BS EN 1992-1-1 Cl. 9.6.3",
            )
        )

        # 3. Slenderness (BS EN 1992-1-1 Clause 5.8.3.2)
        slenderness_result = self.calculate_slenderness()
        checks.append(
            CodeCheck(
                name="Slenderness Ratio",
                status=(
                    "PASS"
                    if slenderness_result["slenderness"] <= slenderness_result["limit"]
                    else "FAIL"
                ),
                value=f"{slenderness_result['slenderness']:.1f}",
                limit=f"{slenderness_result['limit']:.1f}",
                reference="BS EN 1992-1-1 Cl. 5.8.3.2",
            )
        )

        # 4. Vertical bar spacing (BS 8110 Clause 3.12.11.2.7)
        checks.append(
            CodeCheck(
                name="Vertical Bar Spacing",
                status=(
                    "PASS"
                    if self.tables.MIN_SPACING["vertical"]
                    <= vert_reinf.spacing
                    <= self.tables.MAX_SPACING["vertical"]
                    else "FAIL"
                ),
                value=f"{vert_reinf.spacing}mm",
                limit=f"{self.tables.MIN_SPACING['vertical']}-{self.tables.MAX_SPACING['vertical']}mm",
                reference="BS 8110 Cl. 3.12.11.2.7",
            )
        )

        # 5. Horizontal bar spacing (BS 8110 Clause 3.12.11.2.7)
        checks.append(
            CodeCheck(
                name="Horizontal Bar Spacing",
                status=(
                    "PASS"
                    if self.tables.MIN_SPACING["horizontal"]
                    <= horiz_reinf.spacing
                    <= self.tables.MAX_SPACING["horizontal"]
                    else "FAIL"
                ),
                value=f"{horiz_reinf.spacing}mm",
                limit=f"{self.tables.MIN_SPACING['horizontal']}-{self.tables.MAX_SPACING['horizontal']}mm",
                reference="BS 8110 Cl. 3.12.11.2.7",
            )
        )

        # 6. Axial load capacity
        axial_util = self.inputs.axialLoad / capacities.axialCapacity
        checks.append(
            CodeCheck(
                name="Axial Load Check",
                status="PASS" if axial_util <= 1.0 else "FAIL",
                value=f"{axial_util * 100:.1f}%",
                limit="100%",
                reference="BS EN 1992-1-1 Cl. 6.1",
            )
        )

        # 7. Shear force capacity
        shear_util = self.inputs.shearForce / capacities.shearCapacity
        checks.append(
            CodeCheck(
                name="Shear Force Check",
                status="PASS" if shear_util <= 1.0 else "FAIL",
                value=f"{shear_util * 100:.1f}%",
                limit="100%",
                reference="BS EN 1992-1-1 Cl. 6.2",
            )
        )

        # 8. Bending moment capacity
        moment_util = self.inputs.moment / capacities.momentCapacity
        checks.append(
            CodeCheck(
                name="Bending Moment Check",
                status="PASS" if moment_util <= 1.0 else "FAIL",
                value=f"{moment_util * 100:.1f}%",
                limit="100%",
                reference="BS EN 1992-1-1 Cl. 6.1",
            )
        )

        # 9. Crack control (BS EN 1992-1-1 Clause 7.3)
        wk, w_max, crack_status = self.check_crack_control(
            vert_reinf.area, vert_reinf.spacing
        )
        checks.append(
            CodeCheck(
                name="Crack Control",
                status="PASS" if crack_status else "FAIL",
                value=f"{wk:.2f}mm",
                limit=f"{w_max:.2f}mm",
                reference="BS EN 1992-1-1 Cl. 7.3",
            )
        )

        # 10. Concrete cover (BS EN 1992-1-1 Table 4.4N)
        min_cover = self.tables.MIN_COVER.get(self.inputs.exposureClass, 25)
        checks.append(
            CodeCheck(
                name="Concrete Cover",
                status="PASS" if self.inputs.coverDepth >= min_cover else "FAIL",
                value=f"{self.inputs.coverDepth}mm",
                limit=f"{min_cover}mm min",
                reference="BS EN 1992-1-1 Table 4.4N",
            )
        )

        return checks

    def design(self) -> DesignResult:
        """Complete wall design process"""
        try:
            # Design reinforcement
            vert_reinf = self.design_vertical_reinforcement()
            horiz_reinf = self.design_horizontal_reinforcement(vert_reinf)

            # Calculate capacities
            axial_cap = self.calculate_axial_capacity(vert_reinf.area)
            shear_cap = self.calculate_shear_capacity(horiz_reinf)
            moment_cap = self.calculate_moment_capacity(vert_reinf.area)

            capacities = CapacityCheck(
                axialCapacity=round(axial_cap, 1),
                shearCapacity=round(shear_cap, 1),
                momentCapacity=round(moment_cap, 1),
                utilization={
                    "axial": round(self.inputs.axialLoad / axial_cap, 3),
                    "shear": round(self.inputs.shearForce / shear_cap, 3),
                    "moment": round(self.inputs.moment / moment_cap, 3),
                },
            )

            # Perform checks
            checks = self.perform_checks(vert_reinf, horiz_reinf, capacities)

            # Overall design status
            design_status = "PASS" if all(c.status == "PASS" for c in checks) else "FAIL"

            # BS code references
            bs_references = [
                "BS EN 1992-1-1:2004 (Eurocode 2: Design of concrete structures - Part 1-1: General rules)",
                "BS 8110-1:1997 (Structural use of concrete - Part 1: Code of practice for design and construction)",
                "BS 8110-2:1985 (Structural use of concrete - Part 2: Code of practice for special circumstances)",
                "BS 8500-1:2015 (Concrete - Complementary British Standard to BS EN 206)",
                "BS EN 206:2013 (Concrete - Specification, performance, production and conformity)",
            ]

            return DesignResult(
                wallType=self.inputs.wallType,
                designStatus=design_status,
                reinforcement={"vertical": vert_reinf, "horizontal": horiz_reinf},
                capacities=capacities,
                checks=checks,
                bsCodeReferences=bs_references,
                calculations=self.calculations,
                warnings=self.warnings,
            )

        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Design error: {str(e)}")


# API Routes
@router.get("/")
def read_root():
    return {
        "message": "BS 8110 / EC2 RC Wall Design Calculator API",
        "version": "2.0",
        "standards": [
            "BS EN 1992-1-1:2004",
            "BS 8110-1:1997",
            "BS 8110-2:1985",
            "BS 8500-1:2015",
        ],
        "capabilities": [
            "Shear walls",
            "Core walls",
            "Load-bearing walls",
            "Slenderness checks",
            "Crack control",
            "Full code compliance",
        ],
    }


@router.post("/api/calculate", response_model=DesignResult)
def calculate_wall_design(inputs: WallInput):
    """Calculate RC wall design according to BS codes"""
    try:
        designer = RCWallDesigner(inputs)
        result = designer.design()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/api/concrete-grades")
def get_concrete_grades():
    """Get available concrete grades and properties"""
    return {
        "grades": list(BSCodeTables.CONCRETE_PROPERTIES.keys()),
        "properties": BSCodeTables.CONCRETE_PROPERTIES,
        "reference": "BS EN 1992-1-1 Table 3.1",
    }


@router.get("/api/bar-sizes")
def get_bar_sizes():
    """Get available reinforcement bar sizes"""
    return {
        "sizes": list(BSCodeTables.BAR_AREAS.keys()),
        "areas": BSCodeTables.BAR_AREAS,
        "reference": "Standard UK reinforcement bars",
    }


@router.get("/api/exposure-classes")
def get_exposure_classes():
    """Get exposure classes and minimum cover requirements"""
    return {
        "classes": list(BSCodeTables.MIN_COVER.keys()),
        "minCover": BSCodeTables.MIN_COVER,
        "reference": "BS EN 1992-1-1 Table 4.4N",
        "descriptions": {
            "XC1": "Dry or permanently wet",
            "XC2": "Wet, rarely dry",
            "XC3": "Moderate humidity",
            "XC4": "Cyclic wet and dry",
            "XD1": "Moderate humidity with deicing salts",
            "XD2": "Wet, rarely dry with deicing salts",
            "XD3": "Cyclic wet and dry with deicing salts",
            "XS1": "Exposed to airborne salt",
            "XS2": "Permanently submerged in seawater",
            "XS3": "Tidal, splash and spray zones",
        },
    }


@router.get("/api/design-limits")
def get_design_limits():
    """Get design limits and constraints"""
    return {
        "reinforcement": {
            "minimum_ratio": 0.004,  # 0.4%
            "maximum_ratio": 0.04,  # 4%
            "vertical_spacing": BSCodeTables.MAX_SPACING["vertical"],
            "horizontal_spacing": BSCodeTables.MAX_SPACING["horizontal"],
        },
        "slenderness": {
            "shear_wall": 30,
            "bearing_wall": 15,
        },
        "partial_factors": {
            "concrete": BSCodeTables.GAMMA_C,
            "steel": BSCodeTables.GAMMA_S,
        },
        "references": [
            "BS EN 1992-1-1 Clause 9.6",
            "BS EN 1992-1-1 Clause 5.8.3.2",
            "BS 8110 Clause 3.12.11",
        ],
    }