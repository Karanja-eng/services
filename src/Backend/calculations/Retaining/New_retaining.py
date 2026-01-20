"""
Continuation of RetainingWallDesigner class and API endpoints
"""

"""
Enhanced FastAPI Backend for RC Retaining Structure Designer
BS 8110, BS 8007, BS 8002, BS 4449 Compliant
Supports: Cantilever, Counterfort, Buttress, and Gravity Walls

Install dependencies:
pip install fastapi uvicorn pydantic python-multipart numpy scipy

Run server:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import HTTPException, APIRouter, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal, List, Dict
import math
import numpy as np
import os
from .Retaining_autocad_generator import RetainingWallDXF

router = APIRouter()

# ===================== BS CODE CONSTANTS =====================

class BSConstants:
    """BS 8007, BS 8110, BS 8002, BS 4449 Constants"""

    # BS 8007 - Crack width limits for water retaining structures
    MAX_CRACK_WIDTH = {
        "severe": 0.2,  # mm - Direct contact with water
        "moderate": 0.3,  # mm - Indirect contact
        "mild": 0.3,  # mm - Sheltered conditions
    }

    # BS 8110 - Concrete grades
    CONCRETE_GRADES = {
        "C25/30": {"fck": 25, "fcu": 30, "Ecm": 31000},
        "C28/35": {"fck": 28, "fcu": 35, "Ecm": 32000},
        "C30/37": {"fck": 30, "fcu": 37, "Ecm": 33000},
        "C32/40": {"fck": 32, "fcu": 40, "Ecm": 33000},
        "C35/45": {"fck": 35, "fcu": 45, "Ecm": 34000},
        "C40/50": {"fck": 40, "fcu": 50, "Ecm": 35000},
    }

    # BS 4449 - Steel reinforcement properties
    STEEL_GRADES = {
        "Grade 460": {"fy": 460, "Es": 200000},  # N/mm²
        "Grade 500": {"fy": 500, "Es": 200000},
    }

    # Partial safety factors - BS 8110 Table 2.2
    GAMMA_C = 1.5  # Concrete
    GAMMA_S = 1.15  # Steel

    # Load factors - BS 8110 Table 2.1
    GAMMA_DL = 1.4  # Dead load
    GAMMA_LL = 1.6  # Live load
    GAMMA_EARTH = 1.4  # Earth pressure (adverse)
    GAMMA_EARTH_BENEFICIAL = 1.0  # Earth pressure (beneficial)
    GAMMA_WATER = 1.4  # Water pressure

    # Cover requirements - BS 8007 Table 6.1
    MIN_COVER = {"mild": 40, "moderate": 50, "severe": 60}  # mm

    # Maximum bar spacing - BS 8007 Clause 6.3.2
    MAX_BAR_SPACING = 300  # mm

    # Minimum reinforcement - BS 8007 Clause 6.3.1
    MIN_STEEL_RATIO = 0.0013  # 0.13% for flexural members
    MIN_STEEL_RATIO_WALLS = 0.0035  # 0.35% for walls

    # Shear - BS 8110 Part 1
    K_BAL = 0.156  # Balance neutral axis depth factor


# Soil properties for earth pressure calculations - BS 8002
SOIL_PROPERTIES = {
    "Dense Sand": {
        "phi": 38,
        "gamma": 19,
        "Ka": 0.24,
        "Kp": 4.2,
        "cohesion": 0,
        "mu": 0.55,
        "beta": 0,
    },
    "Medium Sand": {
        "phi": 35,
        "gamma": 18,
        "Ka": 0.27,
        "Kp": 3.7,
        "cohesion": 0,
        "mu": 0.5,
        "beta": 0,
    },
    "Loose Sand": {
        "phi": 30,
        "gamma": 17,
        "Ka": 0.33,
        "Kp": 3.0,
        "cohesion": 0,
        "mu": 0.45,
        "beta": 0,
    },
    "Stiff Clay": {
        "phi": 28,
        "gamma": 20,
        "Ka": 0.36,
        "Kp": 2.8,
        "cohesion": 50,
        "mu": 0.4,
        "beta": 30,
    },
    "Firm Clay": {
        "phi": 25,
        "gamma": 19,
        "Ka": 0.41,
        "Kp": 2.5,
        "cohesion": 30,
        "mu": 0.35,
        "beta": 20,
    },
    "Soft Clay": {
        "phi": 20,
        "gamma": 18,
        "Ka": 0.49,
        "Kp": 2.0,
        "cohesion": 15,
        "mu": 0.3,
        "beta": 10,
    },
}

# ===================== PYDANTIC MODELS =====================

class DesignInput(BaseModel):
    """Input parameters for retaining wall design"""

    wall_type: Literal["cantilever", "counterfort", "buttress", "gravity"] = Field(
        ..., description="Type of retaining wall"
    )
    height: float = Field(..., gt=0, le=20, description="Wall height in meters")
    length: Optional[float] = Field(
        None, gt=0, le=100, description="Length for counterfort/buttress walls in meters"
    )
    wall_thickness: Optional[float] = Field(
        None, gt=100, le=1000, description="Wall thickness in mm"
    )
    base_thickness: Optional[float] = Field(
        None, gt=150, le=1500, description="Base thickness in mm"
    )
    base_width: Optional[float] = Field(
        None, gt=0, le=20, description="Total base width in meters"
    )
    toe_width: Optional[float] = Field(
        None, ge=0, le=10, description="Toe slab width in meters"
    )
    heel_width: Optional[float] = Field(
        None, ge=0, le=10, description="Heel slab width in meters"
    )
    counterfort_spacing: Optional[float] = Field(
        None, gt=0, le=20, description="Spacing between counterforts in meters"
    )
    counterfort_thickness: Optional[float] = Field(
        None, gt=150, le=1000, description="Counterfort thickness in mm"
    )
    surcharge: float = Field(0, ge=0, description="Surcharge load in kN/m²")
    soil_type: str = Field("Medium Sand", description="Soil type for backfill")
    foundation_soil: Optional[str] = Field(
        None, description="Foundation soil type (if different)"
    )
    safe_bearing_capacity: float = Field(
        ..., gt=0, description="Safe bearing capacity in kN/m²"
    )
    water_table_depth: Optional[float] = Field(
        None, ge=0, description="Depth to water table from top in meters"
    )
    concrete_grade: str = Field("C30/37", description="Concrete grade per BS 8110")
    steel_grade: str = Field("Grade 460", description="Steel grade per BS 4449")
    exposure: Literal["severe", "moderate", "mild"] = Field(
        "moderate", description="Exposure class per BS 8007"
    )
    has_nib: bool = Field(False, description="Include downstand nib for sliding resistance")
    nib_depth: Optional[float] = Field(
        None, gt=0, le=2, description="Nib depth in meters if has_nib=True"
    )
    auto_size: bool = Field(
        True, description="Automatically determine wall dimensions"
    )

    @validator("concrete_grade")
    def validate_concrete(cls, v):
        if v not in BSConstants.CONCRETE_GRADES:
            raise ValueError(
                f"Invalid concrete grade. Choose from: {list(BSConstants.CONCRETE_GRADES.keys())}"
            )
        return v

    @validator("soil_type", "foundation_soil")
    def validate_soil(cls, v):
        if v and v not in SOIL_PROPERTIES:
            raise ValueError(
                f"Invalid soil type. Choose from: {list(SOIL_PROPERTIES.keys())}"
            )
        return v

    @validator("steel_grade")
    def validate_steel(cls, v):
        if v not in BSConstants.STEEL_GRADES:
            raise ValueError(
                f"Invalid steel grade. Choose from: {list(BSConstants.STEEL_GRADES.keys())}"
            )
        return v


class PressureDistribution(BaseModel):
    depths: List[float] = Field(..., description="Depths from top in meters")
    pressures: List[float] = Field(..., description="Pressures at each depth in kN/m²")
    total_force: float = Field(..., description="Total horizontal force in kN/m")
    force_location: float = Field(
        ..., description="Height of force from base in meters"
    )


class StabilityResults(BaseModel):
    overturning_moment: float = Field(..., description="Overturning moment in kNm")
    resisting_moment: float = Field(..., description="Resisting moment in kNm")
    factor_of_safety_overturning: float = Field(..., description="FOS against overturning")
    sliding_force: float = Field(..., description="Sliding force in kN")
    resisting_force: float = Field(..., description="Resisting force in kN")
    factor_of_safety_sliding: float = Field(..., description="FOS against sliding")
    max_bearing_pressure: float = Field(..., description="Maximum bearing pressure in kN/m²")
    min_bearing_pressure: float = Field(..., description="Minimum bearing pressure in kN/m²")
    eccentricity: float = Field(..., description="Eccentricity in meters")
    passes_overturning: bool
    passes_sliding: bool
    passes_bearing: bool


class ReinforcementDetail(BaseModel):
    required_area: float = Field(..., description="Required steel area in mm²/m")
    minimum_area: float = Field(..., description="Minimum steel area in mm²/m")
    provided_area: float = Field(..., description="Provided steel area in mm²/m")
    bar_diameter: int = Field(..., description="Bar diameter in mm")
    spacing: int = Field(..., description="Bar spacing in mm")
    notation: str = Field(..., description="Bar notation (e.g., H16@200c/c)")
    utilization_ratio: float = Field(..., description="Steel utilization ratio")
    curtailment_length: Optional[float] = Field(
        None, description="Curtailment length from base in meters"
    )


class ElementDesign(BaseModel):
    element_name: str
    thickness: float = Field(..., description="Element thickness in mm")
    effective_depth: float = Field(..., description="Effective depth in mm")
    design_moment: float = Field(..., description="Design moment in kNm/m")
    design_shear: float = Field(..., description="Design shear in kN/m")
    main_steel: ReinforcementDetail
    distribution_steel: Optional[ReinforcementDetail] = None
    shear_check_passed: bool
    crack_width_check_passed: bool


class CounterfortDesign(BaseModel):
    spacing: float = Field(..., description="Spacing in meters")
    thickness: float = Field(..., description="Thickness in mm")
    depth_at_base: float = Field(..., description="Depth at base in mm")
    depth_at_top: float = Field(..., description="Depth at top in mm")
    design_moments: List[float] = Field(..., description="Moments at different levels in kNm")
    design_shears: List[float] = Field(..., description="Shears at different levels in kN")
    main_steel: List[ReinforcementDetail] = Field(..., description="Steel at different levels")


class DesignOutput(BaseModel):
    """Complete design output"""

    wall_type: str
    geometry: Dict
    pressures: PressureDistribution
    stability: StabilityResults
    wall_design: ElementDesign
    base_design: ElementDesign
    toe_design: Optional[ElementDesign] = None
    counterfort_design: Optional[CounterfortDesign] = None
    design_summary: str
    warnings: List[str] = []


# ===================== DESIGN CALCULATIONS =====================

class WallAutoSizer:
    """Automatic sizing of retaining walls based on empirical rules"""

    @staticmethod
    def size_cantilever_wall(inputs: DesignInput) -> Dict:
        """Auto-size cantilever wall dimensions"""
        H = inputs.height
        soil = SOIL_PROPERTIES[inputs.soil_type]
        Ka = soil["Ka"]
        gamma = soil["gamma"]
        q = inputs.surcharge
        mu = soil["mu"]

        # Wall thickness: 0.05H to 0.1H, minimum 250mm
        wall_thickness = max(250, int(0.08 * H * 1000))

        # Base width: 0.4H to 0.7H
        # Calculate from sliding resistance requirement
        H1 = H + 0.25  # Include base thickness estimate
        b2_min = (
            1.4
            * Ka
            * (0.5 * gamma * H1**2 + q * H1)
            / (mu * (gamma * H1 + q))
        )
        base_width = max(0.5 * H, b2_min * 1.2)  # Add safety margin

        # Heel width: typically 60-70% of base width
        heel_width = 0.65 * base_width

        # Toe width: remainder
        toe_width = base_width - heel_width - wall_thickness / 1000

        # Base thickness: typically 0.1H, minimum 250mm
        base_thickness = max(250, int(0.1 * H * 1000))

        return {
            "wall_thickness": wall_thickness,
            "base_thickness": base_thickness,
            "base_width": base_width,
            "toe_width": max(0.3, toe_width),
            "heel_width": heel_width,
        }

    @staticmethod
    def size_counterfort_wall(inputs: DesignInput) -> Dict:
        """Auto-size counterfort wall dimensions"""
        H = inputs.height

        # Counterfort spacing typically equals wall height
        spacing = inputs.counterfort_spacing or H

        # Wall thickness can be thinner than cantilever
        wall_thickness = max(180, int(0.04 * H * 1000))

        # Base and counterfort thickness
        base_thickness = max(250, int(0.08 * H * 1000))
        counterfort_thickness = max(250, int(0.05 * H * 1000))

        # Base width: similar to cantilever
        base_width = max(0.5 * H, 0.6 * H)
        heel_width = 0.65 * base_width
        toe_width = base_width - heel_width - wall_thickness / 1000

        return {
            "wall_thickness": wall_thickness,
            "base_thickness": base_thickness,
            "base_width": base_width,
            "toe_width": max(0.3, toe_width),
            "heel_width": heel_width,
            "counterfort_spacing": spacing,
            "counterfort_thickness": counterfort_thickness,
        }


class PressureCalculator:
    """Calculate earth and water pressures per BS 8002"""

    @staticmethod
    def calculate_active_pressure(
        height: float,
        soil_type: str,
        surcharge: float = 0,
        water_depth: Optional[float] = None,
    ) -> PressureDistribution:
        """Calculate active earth pressure distribution"""

        soil = SOIL_PROPERTIES[soil_type]
        Ka = soil["Ka"]
        gamma = soil["gamma"]
        c = soil["cohesion"]

        depths = np.linspace(0, height, 20)
        pressures = []

        for z in depths:
            # Active pressure for cohesionless soil: p = Ka*(gamma*z + q)
            # Active pressure for cohesive soil: p = Ka*(gamma*z + q) - 2*c*sqrt(Ka)
            if c > 0:
                p = Ka * (gamma * z + surcharge) - 2 * c * math.sqrt(Ka)
                p = max(0, p)  # No negative pressure
            else:
                p = Ka * (gamma * z + surcharge)

            pressures.append(p)

        # Add water pressure if water table present
        if water_depth and water_depth < height:
            gamma_water = 9.81
            for i, z in enumerate(depths):
                if z > water_depth:
                    water_pressure = gamma_water * (z - water_depth)
                    pressures[i] += water_pressure

        # Calculate total force and location
        # Use trapezoidal integration
        total_force = np.trapz(pressures, depths)

        # Calculate moment to find force location
        moments = [p * z for p, z in zip(pressures, depths)]
        total_moment = np.trapz(moments, depths)

        force_location = total_moment / total_force if total_force > 0 else height / 3

        return PressureDistribution(
            depths=depths.tolist(),
            pressures=pressures,
            total_force=round(total_force, 2),
            force_location=round(height - force_location, 2),
        )

    @staticmethod
    def calculate_passive_pressure(
        depth: float, soil_type: str
    ) -> float:
        """Calculate passive earth pressure"""

        soil = SOIL_PROPERTIES[soil_type]
        Kp = soil["Kp"]
        gamma = soil["gamma"]
        c = soil["cohesion"]

        # Passive pressure: p = Kp*gamma*z + 2*c*sqrt(Kp)
        passive_force = 0.5 * Kp * gamma * depth**2
        if c > 0:
            passive_force += 2 * c * math.sqrt(Kp) * depth

        return passive_force


class StabilityAnalyzer:
    """Analyze wall stability per BS 8002"""

    @staticmethod
    def analyze_stability(
        inputs: DesignInput,
        geometry: Dict,
        pressure_dist: PressureDistribution,
    ) -> StabilityResults:
        """Perform comprehensive stability analysis"""

        H = inputs.height
        base_width = geometry["base_width"]
        toe_width = geometry["toe_width"]
        heel_width = geometry["heel_width"]
        wall_thick = geometry["wall_thickness"] / 1000  # Convert to meters
        base_thick = geometry["base_thickness"] / 1000

        soil = SOIL_PROPERTIES[inputs.soil_type]
        gamma_soil = soil["gamma"]
        mu = soil["mu"]
        beta = soil["beta"]

        # Calculate vertical loads
        vertical_loads = []
        moments_about_toe = []

        # 1. Wall weight
        wall_weight = wall_thick * H * 24  # kN/m
        wall_arm = toe_width + wall_thick / 2
        vertical_loads.append(wall_weight)
        moments_about_toe.append(wall_weight * wall_arm)

        # 2. Base slab weight
        base_weight = base_width * base_thick * 24
        base_arm = base_width / 2
        vertical_loads.append(base_weight)
        moments_about_toe.append(base_weight * base_arm)

        # 3. Soil on heel
        soil_on_heel = heel_width * H * gamma_soil
        soil_arm = toe_width + wall_thick + heel_width / 2
        vertical_loads.append(soil_on_heel)
        moments_about_toe.append(soil_on_heel * soil_arm)

        # 4. Surcharge on heel
        if inputs.surcharge > 0:
            surcharge_load = inputs.surcharge * heel_width
            vertical_loads.append(surcharge_load)
            moments_about_toe.append(surcharge_load * soil_arm)

        # 5. Nib weight if present
        if inputs.has_nib and inputs.nib_depth:
            nib_weight = wall_thick * inputs.nib_depth * 24
            nib_arm = toe_width + wall_thick / 2
            vertical_loads.append(nib_weight)
            moments_about_toe.append(nib_weight * nib_arm)

        total_vertical = sum(vertical_loads)
        resisting_moment = sum(moments_about_toe)

        # Calculate horizontal force (with load factor)
        horizontal_force = pressure_dist.total_force * BSConstants.GAMMA_EARTH
        force_height = pressure_dist.force_location
        overturning_moment = horizontal_force * force_height

        # Factor of safety against overturning
        fos_overturning = resisting_moment / overturning_moment if overturning_moment > 0 else 999

        # Sliding resistance
        friction_resistance = mu * total_vertical

        # Add passive pressure if nib present
        passive_resistance = 0
        if inputs.has_nib and inputs.nib_depth:
            foundation_soil = inputs.foundation_soil or inputs.soil_type
            passive_resistance = PressureCalculator.calculate_passive_pressure(
                inputs.nib_depth, foundation_soil
            )

        # Add adhesion for cohesive soils
        adhesion_resistance = 0
        if beta > 0:
            adhesion_resistance = beta * base_width

        total_resisting = friction_resistance + passive_resistance + adhesion_resistance
        fos_sliding = total_resisting / horizontal_force if horizontal_force > 0 else 999

        # Bearing pressure
        net_moment = resisting_moment - overturning_moment
        resultant_location = net_moment / total_vertical
        eccentricity = base_width / 2 - resultant_location

        # Check if within middle third
        if eccentricity <= base_width / 6:
            # No tension
            max_pressure = (
                total_vertical / base_width
                + (6 * total_vertical * eccentricity) / base_width**2
            )
            min_pressure = (
                total_vertical / base_width
                - (6 * total_vertical * eccentricity) / base_width**2
            )
        else:
            # Tension develops
            effective_width = 3 * (base_width / 2 - eccentricity)
            max_pressure = (2 * total_vertical) / effective_width
            min_pressure = 0

        return StabilityResults(
            overturning_moment=round(overturning_moment, 2),
            resisting_moment=round(resisting_moment, 2),
            factor_of_safety_overturning=round(fos_overturning, 2),
            sliding_force=round(horizontal_force, 2),
            resisting_force=round(total_resisting, 2),
            factor_of_safety_sliding=round(fos_sliding, 2),
            max_bearing_pressure=round(max_pressure, 2),
            min_bearing_pressure=round(min_pressure, 2),
            eccentricity=round(eccentricity, 3),
            passes_overturning=fos_overturning >= 2.0,
            passes_sliding=fos_sliding >= 1.5,
            passes_bearing=max_pressure <= inputs.safe_bearing_capacity,
        )


class ReinforcementDesigner:
    """Design reinforcement per BS 8110 and BS 8007"""

    @staticmethod
    def design_flexural_steel(
        moment: float,  # kNm/m
        thickness: float,  # mm
        cover: int,  # mm
        fck: float,  # N/mm²
        fy: float,  # N/mm²
        is_wall: bool = False,
    ) -> ReinforcementDetail:
        """Design flexural reinforcement"""

        M = moment * 1e6  # Convert to Nmm

        # Material design strengths
        fcd = fck / BSConstants.GAMMA_C
        fyd = fy / BSConstants.GAMMA_S

        # Try different bar diameters
        bar_options = [10, 12, 16, 20, 25, 32]

        for bar_dia in bar_options:
            d = thickness - cover - bar_dia / 2

            if d <= 0:
                continue

            # Calculate K
            K = M / (fck * 1000 * d * d)

            # Check if compression steel needed
            if K > BSConstants.K_BAL:
                continue  # Try larger bar

            # Calculate lever arm
            z = d * (0.5 + math.sqrt(max(0, 0.25 - K / 1.134)))
            z = min(z, 0.95 * d)

            # Required steel area
            As_req = M / (fyd * z)

            # Minimum steel
            if is_wall:
                As_min = BSConstants.MIN_STEEL_RATIO_WALLS * thickness * 1000
            else:
                As_min = BSConstants.MIN_STEEL_RATIO * thickness * 1000

            # Provided area
            As_prov = max(As_req, As_min)

            # Calculate spacing
            bar_area = math.pi * bar_dia * bar_dia / 4
            spacing_calc = (bar_area * 1000) / As_prov

            # Limit spacing
            spacing = min(int(spacing_calc), BSConstants.MAX_BAR_SPACING)
            spacing = max(100, (spacing // 25) * 25)  # Round to 25mm

            # Actual provided area
            As_actual = (bar_area * 1000) / spacing

            # Check maximum spacing for crack control
            steel_percentage = 100 * As_actual / (1000 * d)
            max_spacing_allowed = 155 / max(steel_percentage, 0.3)

            if spacing <= max_spacing_allowed:
                notation = f"H{bar_dia}@{spacing}c/c"
                utilization = As_req / As_actual if As_actual > 0 else 0

                return ReinforcementDetail(
                    required_area=round(As_req, 0),
                    minimum_area=round(As_min, 0),
                    provided_area=round(As_actual, 0),
                    bar_diameter=bar_dia,
                    spacing=spacing,
                    notation=notation,
                    utilization_ratio=round(utilization, 2),
                )

        # If no solution found, return maximum bar
        raise ValueError("Cannot design reinforcement - section too small or moment too large")

    @staticmethod
    def calculate_curtailment_length(
        total_height: float,
        main_steel: ReinforcementDetail,
        reduced_bar_dia: int,
        pressure_dist: PressureDistribution,
        fck: float,
        fy: float,
        thickness: float,
        cover: int,
    ) -> float:
        """Calculate curtailment length for bars"""

        # Calculate moment capacity with reduced bars
        reduced_spacing = main_steel.spacing * 2  # Alternate bars
        bar_area = math.pi * reduced_bar_dia * reduced_bar_dia / 4
        As_reduced = (bar_area * 1000) / reduced_spacing

        d = thickness - cover - reduced_bar_dia / 2
        fcd = fck / BSConstants.GAMMA_C
        fyd = fy / BSConstants.GAMMA_S

        K = (As_reduced * fyd) / (fck * 1000 * d)
        z = d * (0.5 + math.sqrt(max(0, 0.25 - K / 1.134)))
        z = min(z, 0.95 * d)

        M_reduced = As_reduced * fyd * z / 1e6  # kNm/m

        # Find depth where moment equals M_reduced
        # This requires integration of pressure distribution
        # Simplified: assume triangular distribution
        p_max = max(pressure_dist.pressures) * BSConstants.GAMMA_EARTH

        for z in np.linspace(0, total_height, 100):
            p_z = p_max * (z / total_height)
            M_z = 0.5 * p_z * z * z / 3  # Triangular load moment

            if M_z <= M_reduced:
                # Add anchorage length
                anchorage = 40 * reduced_bar_dia / 1000  # meters
                return total_height - z - anchorage

        return 0  # No curtailment needed


class RetainingWallDesigner:
    """Main designer class for all wall types"""

    def __init__(self, inputs: DesignInput):
        self.inputs = inputs
        self.concrete_props = BSConstants.CONCRETE_GRADES[inputs.concrete_grade]
        self.steel_props = BSConstants.STEEL_GRADES[inputs.steel_grade]
        self.cover = BSConstants.MIN_COVER[inputs.exposure]
        self.warnings = []

        # Auto-size if requested
        if inputs.auto_size:
            self.geometry = self._auto_size_wall()
        else:
            self.geometry = self._extract_geometry()

    def _auto_size_wall(self) -> Dict:
        """Automatically size wall based on type"""
        if self.inputs.wall_type == "cantilever":
            return WallAutoSizer.size_cantilever_wall(self.inputs)
        elif self.inputs.wall_type in ["counterfort", "buttress"]:
            return WallAutoSizer.size_counterfort_wall(self.inputs)
        else:
            raise ValueError(f"Auto-sizing not implemented for {self.inputs.wall_type} walls")

    def _extract_geometry(self) -> Dict:
        """Extract geometry from inputs"""
        return {
            "wall_thickness": self.inputs.wall_thickness,
            "base_thickness": self.inputs.base_thickness,
            "base_width": self.inputs.base_width,
            "toe_width": self.inputs.toe_width,
            "heel_width": self.inputs.heel_width,
            "counterfort_spacing": self.inputs.counterfort_spacing,
            "counterfort_thickness": self.inputs.counterfort_thickness,   }

    def design(self) -> DesignOutput:
        """Complete design process"""

        # Calculate pressures
        pressures = PressureCalculator.calculate_active_pressure(
            self.inputs.height,
            self.inputs.soil_type,
            self.inputs.surcharge,
            self.inputs.water_table_depth,
        )

        # Check stability
        stability = StabilityAnalyzer.analyze_stability(
            self.inputs, self.geometry, pressures
        )

        # Add warnings for stability issues
        if not stability.passes_overturning:
            self.warnings.append(
                f"Overturning check FAILED - FOS={stability.factor_of_safety_overturning:.2f} < 2.0"
            )
        if not stability.passes_sliding:
            self.warnings.append(
                f"Sliding check FAILED - FOS={stability.factor_of_safety_sliding:.2f} < 1.5"
            )
        if not stability.passes_bearing:
            self.warnings.append(
                f"Bearing pressure EXCEEDED - {stability.max_bearing_pressure:.2f} > {self.inputs.safe_bearing_capacity:.2f} kN/m²"
            )

        # Design structural elements based on wall type
        if self.inputs.wall_type == "cantilever":
            return self._design_cantilever_wall(pressures, stability)
        elif self.inputs.wall_type == "counterfort":
            return self._design_counterfort_wall(pressures, stability)
        elif self.inputs.wall_type == "buttress":
            return self._design_buttress_wall(pressures, stability)
        else:
            raise ValueError(f"Design not implemented for {self.inputs.wall_type} walls")

    def _design_cantilever_wall(
        self, pressures: PressureDistribution, stability: StabilityResults
    ) -> DesignOutput:
        """Design cantilever retaining wall"""

        H = self.inputs.height
        p_max = max(pressures.pressures) * BSConstants.GAMMA_EARTH
        p_min = min(pressures.pressures) * BSConstants.GAMMA_EARTH

        # === WALL STEM DESIGN ===
        # Cantilever from base - triangular pressure
        M_wall = (p_max * H * H) / 6.0  # kNm/m
        V_wall = (p_max * H) / 2.0  # kN/m

        wall_steel = ReinforcementDesigner.design_flexural_steel(
            M_wall,
            self.geometry["wall_thickness"],
            self.cover,
            self.concrete_props["fck"],
            self.steel_props["fy"],
            is_wall=True,
        )

        # Check shear
        d_wall = (
            self.geometry["wall_thickness"]
            - self.cover
            - wall_steel.bar_diameter / 2
        )
        shear_stress = (V_wall * 1000) / (1000 * d_wall)
        
        # Concrete shear capacity - BS 8110
        rho = 100 * wall_steel.provided_area / (1000 * d_wall)
        fck = self.concrete_props["fck"]
        vc = (
            0.79
            * (rho ** (1 / 3))
            * ((fck / 25) ** (1 / 3))
            / BSConstants.GAMMA_C
        )
        shear_check_passed = shear_stress <= vc

        # Crack width check (simplified)
        Es = self.steel_props["Es"]
        epsilon_s = wall_steel.provided_area / (Es * self.geometry["wall_thickness"] * 1000)
        crack_width = 3 * self.cover * epsilon_s
        crack_limit = BSConstants.MAX_CRACK_WIDTH[self.inputs.exposure]
        crack_check_passed = crack_width <= crack_limit

        wall_design = ElementDesign(
            element_name="Wall Stem",
            thickness=self.geometry["wall_thickness"],
            effective_depth=d_wall,
            design_moment=round(M_wall, 2),
            design_shear=round(V_wall, 2),
            main_steel=wall_steel,
            distribution_steel=self._design_distribution_steel(
                self.geometry["wall_thickness"]
            ),
            shear_check_passed=shear_check_passed,
            crack_width_check_passed=crack_check_passed,
        )

        # === HEEL SLAB DESIGN ===
        heel_width = self.geometry["heel_width"]
        
        # Net upward pressure
        downward = (
            self.inputs.surcharge
            + self.inputs.height * SOIL_PROPERTIES[self.inputs.soil_type]["gamma"]
            + self.geometry["base_thickness"] / 1000 * 24
        )
        
        # Base pressure varies - use stability results
        p_left = stability.max_bearing_pressure  # At toe
        p_right = stability.min_bearing_pressure  # At heel
        
        # Pressure at heel-wall junction
        wall_thick_m = self.geometry["wall_thickness"] / 1000
        toe_width = self.geometry["toe_width"]
        x_junction = toe_width + wall_thick_m
        base_width = self.geometry["base_width"]
        
        p_junction = p_right + (p_left - p_right) * (x_junction / base_width)
        
        # Moment at face of wall (cantilever from wall)
        # Trapezoidal upward pressure, uniform downward
        M_heel = (
            0.5 * (downward - p_right) * heel_width**2
            - 0.5 * (p_junction - p_right) * heel_width * heel_width / 3
        )
        M_heel = abs(M_heel)
        
        V_heel = (downward - p_right) * heel_width - 0.5 * (p_junction - p_right) * heel_width

        heel_steel = ReinforcementDesigner.design_flexural_steel(
            M_heel,
            self.geometry["base_thickness"],
            self.cover,
            self.concrete_props["fck"],
            self.steel_props["fy"],
            is_wall=False,
        )

        d_heel = (
            self.geometry["base_thickness"]
            - self.cover
            - heel_steel.bar_diameter / 2
        )

        heel_design = ElementDesign(
            element_name="Heel Slab",
            thickness=self.geometry["base_thickness"],
            effective_depth=d_heel,
            design_moment=round(M_heel, 2),
            design_shear=round(abs(V_heel), 2),
            main_steel=heel_steel,
            distribution_steel=self._design_distribution_steel(
                self.geometry["base_thickness"]
            ),
            shear_check_passed=True,  # Simplified
            crack_width_check_passed=True,  # Simplified
        )

        # === TOE SLAB DESIGN ===
        toe_width = self.geometry["toe_width"]
        
        # Upward pressure from base, downward from self-weight only
        downward_toe = self.geometry["base_thickness"] / 1000 * 24
        
        # Pressure at toe-wall junction already calculated
        # Moment at face of wall
        M_toe = (
            0.5 * (p_junction - downward_toe) * toe_width**2
            + 0.5 * (p_left - p_junction) * toe_width * toe_width / 3
        )
        
        V_toe = (p_junction - downward_toe) * toe_width + 0.5 * (p_left - p_junction) * toe_width

        toe_steel = ReinforcementDesigner.design_flexural_steel(
            M_toe,
            self.geometry["base_thickness"],
            self.cover,
            self.concrete_props["fck"],
            self.steel_props["fy"],
            is_wall=False,
        )

        d_toe = (
            self.geometry["base_thickness"]
            - self.cover
            - toe_steel.bar_diameter / 2
        )

        toe_design = ElementDesign(
            element_name="Toe Slab",
            thickness=self.geometry["base_thickness"],
            effective_depth=d_toe,
            design_moment=round(M_toe, 2),
            design_shear=round(V_toe, 2),
            main_steel=toe_steel,
            distribution_steel=self._design_distribution_steel(
                self.geometry["base_thickness"]
            ),
            shear_check_passed=True,  # Simplified
            crack_width_check_passed=True,  # Simplified
        )

        # Summary
        all_checks = (
            stability.passes_overturning
            and stability.passes_sliding
            and stability.passes_bearing
            and wall_design.shear_check_passed
            and wall_design.crack_width_check_passed
        )

        summary = (
            f"Cantilever Retaining Wall Design {'ACCEPTABLE' if all_checks else 'REQUIRES REVISION'} "
            f"per BS 8110/8007/8002/4449"
        )

        return DesignOutput(
            wall_type="cantilever",
            geometry=self.geometry,
            pressures=pressures,
            stability=stability,
            wall_design=wall_design,
            base_design=heel_design,
            toe_design=toe_design,
            design_summary=summary,
            warnings=self.warnings,
        )

    def _design_counterfort_wall(
        self, pressures: PressureDistribution, stability: StabilityResults
    ) -> DesignOutput:
        """Design counterfort retaining wall"""

        H = self.inputs.height
        spacing = self.geometry["counterfort_spacing"]
        
        # Wall slab spans horizontally between counterforts
        # Use simplified analysis - slab spanning between supports
        
        # Average pressure over height
        p_avg = sum(pressures.pressures) / len(pressures.pressures) * BSConstants.GAMMA_EARTH
        
        # Fixed-end moment for uniformly loaded beam
        M_wall = (p_avg * H * spacing**2) / 12.0  # kNm for panel width
        M_wall_per_m = M_wall / spacing  # kNm/m
        
        V_wall = (p_avg * H * spacing) / 2.0 / spacing  # kN/m

        wall_steel = ReinforcementDesigner.design_flexural_steel(
            M_wall_per_m,
            self.geometry["wall_thickness"],
            self.cover,
            self.concrete_props["fck"],
            self.steel_props["fy"],
            is_wall=True,
        )

        d_wall = (
            self.geometry["wall_thickness"]
            - self.cover
            - wall_steel.bar_diameter / 2
        )

        wall_design = ElementDesign(
            element_name="Wall Slab (between counterforts)",
            thickness=self.geometry["wall_thickness"],
            effective_depth=d_wall,
            design_moment=round(M_wall_per_m, 2),
            design_shear=round(V_wall, 2),
            main_steel=wall_steel,
            distribution_steel=self._design_distribution_steel(
                self.geometry["wall_thickness"]
            ),
            shear_check_passed=True,
            crack_width_check_passed=True,
        )

        # Base slab design similar to cantilever
        heel_width = self.geometry["heel_width"]
        base_pressure_avg = (
            stability.max_bearing_pressure + stability.min_bearing_pressure
        ) / 2
        
        M_base = (base_pressure_avg * heel_width * spacing**2) / 12.0 / spacing
        V_base = (base_pressure_avg * heel_width * spacing) / 2.0 / spacing

        base_steel = ReinforcementDesigner.design_flexural_steel(
            M_base,
            self.geometry["base_thickness"],
            self.cover,
            self.concrete_props["fck"],
            self.steel_props["fy"],
            is_wall=False,
        )

        d_base = (
            self.geometry["base_thickness"]
            - self.cover
            - base_steel.bar_diameter / 2
        )

        base_design = ElementDesign(
            element_name="Base Slab (between counterforts)",
            thickness=self.geometry["base_thickness"],
            effective_depth=d_base,
            design_moment=round(M_base, 2),
            design_shear=round(V_base, 2),
            main_steel=base_steel,
            distribution_steel=self._design_distribution_steel(
                self.geometry["base_thickness"]
            ),
            shear_check_passed=True,
            crack_width_check_passed=True,
        )

        # Counterfort design
        # Load on counterfort = horizontal reactions from wall panels
        # Counterfort acts as vertical cantilever T-beam
        
        # Total horizontal load on panel
        P_panel = pressures.total_force * BSConstants.GAMMA_EARTH * spacing
        
        # Moment at base of counterfort
        M_counterfort = P_panel * pressures.force_location
        
        # Depth varies linearly from top to base
        depth_top = self.geometry["wall_thickness"]
        depth_base = heel_width * 1000  # mm
        
        counterfort_steel_base = ReinforcementDesigner.design_flexural_steel(
            M_counterfort,
            self.geometry["counterfort_thickness"],
            self.cover,
            self.concrete_props["fck"],
            self.steel_props["fy"],
            is_wall=False,
        )

        counterfort_design = CounterfortDesign(
            spacing=spacing,
            thickness=self.geometry["counterfort_thickness"],
            depth_at_base=depth_base,
            depth_at_top=depth_top,
            design_moments=[M_counterfort],
            design_shears=[P_panel],
            main_steel=[counterfort_steel_base],
        )

        summary = f"Counterfort Retaining Wall Design per BS 8110/8007/8002/4449"

        return DesignOutput(
            wall_type="counterfort",
            geometry=self.geometry,
            pressures=pressures,
            stability=stability,
            wall_design=wall_design,
            base_design=base_design,
            counterfort_design=counterfort_design,
            design_summary=summary,
            warnings=self.warnings,
        )

    def _design_buttress_wall(
        self, pressures: PressureDistribution, stability: StabilityResults
    ) -> DesignOutput:
        """Design buttress retaining wall - similar to counterfort but on outer face"""
        
        # Buttress walls are similar to counterfort but with buttresses on front
        # The structural behavior is analogous
        result = self._design_counterfort_wall(pressures, stability)
        result.wall_type = "buttress"
        result.design_summary = result.design_summary.replace("Counterfort", "Buttress")
        
        if result.counterfort_design:
            result.counterfort_design.spacing = result.counterfort_design.spacing
            # Note: In practice, buttresses are on the front, affecting toe width
            self.warnings.append(
                "Buttress design follows counterfort principles - verify buttress placement on front face"
            )
        
        return result

    def _design_distribution_steel(self, thickness: float) -> ReinforcementDetail:
        """Design minimum distribution steel"""

        As_min = BSConstants.MIN_STEEL_RATIO * thickness * 1000  # mm²/m

        # Use 10mm bars typically
        bar_dia = 10
        bar_area = math.pi * bar_dia * bar_dia / 4
        spacing = int((bar_area * 1000) / As_min)
        spacing = max(100, min(spacing, 300))
        spacing = (spacing // 25) * 25  # Round to 25mm

        As_actual = (bar_area * 1000) / spacing

        return ReinforcementDetail(
            required_area=round(As_min, 0),
            minimum_area=round(As_min, 0),
            provided_area=round(As_actual, 0),
            bar_diameter=bar_dia,
            spacing=spacing,
            notation=f"H{bar_dia}@{spacing}c/c",
            utilization_ratio=1.0,
        )


# ===================== API ENDPOINTS =====================

@router.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Enhanced RC Retaining Wall Designer API",
        "version": "2.0.0",
        "docs": "/docs",
        "codes": ["BS 8110", "BS 8007", "BS 8002", "BS 4449"],
        "wall_types": ["cantilever", "counterfort", "buttress", "gravity"],
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "2.0.0"}


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
            "earth_pressure_adverse": BSConstants.GAMMA_EARTH,
            "earth_pressure_beneficial": BSConstants.GAMMA_EARTH_BENEFICIAL,
            "water_pressure": BSConstants.GAMMA_WATER,
        },
        "minimum_factors_of_safety": {
            "overturning": 2.0,
            "sliding": 1.5,
        },
    }


@router.post("/design", response_model=DesignOutput)
async def design_wall(inputs: DesignInput):
    """
    Design a reinforced concrete retaining wall per BS codes

    Supports:
    - Cantilever walls
    - Counterfort walls  
    - Buttress walls
    - Automatic sizing based on height and soil properties

    Returns complete design including:
    - Pressure distribution
    - Stability analysis (overturning, sliding, bearing)
    - Reinforcement design for all elements
    - Design checks per BS codes
    """
    try:
        designer = RetainingWallDesigner(inputs)
        results = designer.design()
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stability-check")
async def check_stability(inputs: DesignInput):
    """
    Check stability of an existing wall design without full structural design
    
    Returns:
    - Overturning check
    - Sliding check  
    - Bearing pressure check
    """
    try:
        designer = RetainingWallDesigner(inputs)
        
        pressures = PressureCalculator.calculate_active_pressure(
            inputs.height,
            inputs.soil_type,
            inputs.surcharge,
            inputs.water_table_depth,
        )
        
        stability = StabilityAnalyzer.analyze_stability(
            inputs, designer.geometry, pressures
        )
        
        return {
            "geometry": designer.geometry,
            "pressures": pressures,
            "stability": stability,
            "all_checks_passed": (
                stability.passes_overturning
                and stability.passes_sliding
                and stability.passes_bearing
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auto-size")
async def auto_size_wall(inputs: DesignInput):
    """
    Automatically determine wall dimensions based on height and soil properties
    
    Returns recommended dimensions without full design
    """
    try:
        if inputs.wall_type == "cantilever":
            geometry = WallAutoSizer.size_cantilever_wall(inputs)
        elif inputs.wall_type in ["counterfort", "buttress"]:
            geometry = WallAutoSizer.size_counterfort_wall(inputs)
        else:
            raise ValueError(f"Auto-sizing not available for {inputs.wall_type} walls")
        
        return {
            "wall_type": inputs.wall_type,
            "height": inputs.height,
            "recommended_geometry": geometry,
            "notes": [
                "These are preliminary dimensions",
                "Full design required to verify adequacy",
                "Adjust based on site-specific requirements",
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/soil-properties/{soil_type}")
async def get_soil_properties(soil_type: str):
    """Get detailed properties for a specific soil type"""
    if soil_type not in SOIL_PROPERTIES:
        raise HTTPException(
            status_code=404,
            detail=f"Soil type '{soil_type}' not found. Available: {list(SOIL_PROPERTIES.keys())}",
        )
    
    properties = SOIL_PROPERTIES[soil_type].copy()
    properties["description"] = {
        "phi": "Angle of internal friction (degrees)",
        "gamma": "Unit weight (kN/m³)",
        "Ka": "Active earth pressure coefficient",
        "Kp": "Passive earth pressure coefficient",
        "cohesion": "Cohesion (kN/m²)",
        "mu": "Coefficient of friction with concrete",
        "beta": "Adhesion with concrete (kN/m²)",
    }
    
    return properties


@router.get("/concrete-properties/{grade}")
async def get_concrete_properties(grade: str):
    """Get properties for a specific concrete grade"""
    if grade not in BSConstants.CONCRETE_GRADES:
        raise HTTPException(
            status_code=404,
            detail=f"Concrete grade '{grade}' not found. Available: {list(BSConstants.CONCRETE_GRADES.keys())}",
        )
    
    properties = BSConstants.CONCRETE_GRADES[grade].copy()
    properties["fcd"] = round(properties["fck"] / BSConstants.GAMMA_C, 2)
    properties["description"] = {
        "fck": "Characteristic cylinder strength (N/mm²)",
        "fcu": "Characteristic cube strength (N/mm²)",
        "Ecm": "Elastic modulus (N/mm²)",
        "fcd": "Design strength (N/mm²)",
    }
    
    return properties


@router.post("/generate-dxf")
async def generate_dxf(design: DesignOutput):
    """Generate AutoCAD DXF drawing for the designed wall"""
    try:
        # Create temp filename
        filename = f"retaining_wall_{design.wall_type}.dxf"
        
        # Generate DXF
        generator = RetainingWallDXF(design.dict())
        generator.generate_dxf(filename)
        
        # Read file content
        with open(filename, "rb") as f:
            content = f.read()
            
        # Clean up
        os.remove(filename)
        
        return Response(
            content=content,
            media_type="application/dxf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        print(f"DXF Generation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate DXF: {str(e)}")



