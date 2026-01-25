"""
Soil Mechanics Module - Pydantic Schemas
All request/response models with validation
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal


# ==================== PHASE RELATIONSHIPS ====================

class MoistureContentRequest(BaseModel):
    mass_wet: float = Field(..., gt=0, description="Mass of wet soil (g or kg)")
    mass_dry: float = Field(..., gt=0, description="Mass of dry soil (g or kg)")


class MoistureContentResponse(BaseModel):
    moisture_content: float = Field(..., description="Moisture content (%)")
    formula: str = "w = (M_wet - M_dry) / M_dry × 100%"


class UnitWeightsRequest(BaseModel):
    mass_total: float = Field(..., gt=0, description="Total mass (kg)")
    volume: float = Field(..., gt=0, description="Total volume (m³)")
    moisture_content: float = Field(..., ge=0, description="Moisture content (%)")
    specific_gravity: float = Field(2.65, gt=0, description="Specific gravity of solids")


class UnitWeightsResponse(BaseModel):
    gamma_bulk: float = Field(..., description="Bulk unit weight (kN/m³)")
    gamma_dry: float = Field(..., description="Dry unit weight (kN/m³)")
    gamma_sat: float = Field(..., description="Saturated unit weight (kN/m³)")
    gamma_submerged: float = Field(..., description="Submerged unit weight (kN/m³)")


class VoidRatioRequest(BaseModel):
    void_volume: float = Field(..., ge=0, description="Volume of voids (m³)")
    solid_volume: float = Field(..., gt=0, description="Volume of solids (m³)")


class VoidRatioResponse(BaseModel):
    void_ratio: float = Field(..., description="Void ratio (e)")
    porosity: float = Field(..., description="Porosity (n)")


class SaturationRequest(BaseModel):
    water_volume: float = Field(..., ge=0, description="Volume of water (m³)")
    void_volume: float = Field(..., gt=0, description="Volume of voids (m³)")


class SaturationResponse(BaseModel):
    degree_of_saturation: float = Field(..., description="Degree of saturation (%)")


class ZAVRequest(BaseModel):
    specific_gravity: float = Field(2.65, gt=0, description="Gs")
    moisture_range: List[float] = Field([5, 30], description="[w_min, w_max] in %")
    num_points: int = Field(50, gt=0, description="Number of curve points")


class ZAVResponse(BaseModel):
    moisture_content: List[float] = Field(..., description="w values (%)")
    dry_density: List[float] = Field(..., description="γ_d values (kN/m³)")
    void_ratio: List[float] = Field(..., description="e values")


# ==================== ATTERBERG LIMITS ====================

class AtterbergRequest(BaseModel):
    liquid_limit: float = Field(..., gt=0, description="Liquid Limit (%)")
    plastic_limit: float = Field(..., gt=0, description="Plastic Limit (%)")


class AtterbergResponse(BaseModel):
    liquid_limit: float
    plastic_limit: float
    plasticity_index: float
    classification: str = Field(..., description="USCS soil type")
    description: str


# ==================== COMPACTION ====================

class ProctorDataPoint(BaseModel):
    moisture_content: float = Field(..., description="w (%)")
    dry_density: float = Field(..., description="γ_d (kN/m³)")


class ProctorRequest(BaseModel):
    data_points: List[ProctorDataPoint] = Field(..., min_length=4)
    specific_gravity: float = Field(2.65, gt=0)
    test_type: Literal["standard", "modified"] = "standard"


class ProctorResponse(BaseModel):
    optimum_moisture_content: float = Field(..., description="OMC (%)")
    maximum_dry_density: float = Field(..., description="MDD (kN/m³)")
    fitted_curve: List[ProctorDataPoint]
    zav_curve: List[ProctorDataPoint]
    r_squared: float = Field(..., description="Curve fit quality")


class FieldDensityRequest(BaseModel):
    field_dry_density: float = Field(..., gt=0, description="γ_d field (kN/m³)")
    maximum_dry_density: float = Field(..., gt=0, description="γ_d max (kN/m³)")


class FieldDensityResponse(BaseModel):
    relative_compaction: float = Field(..., description="RC (%)")
    status: str = Field(..., description="Pass/Fail status")


# ==================== SHEAR STRENGTH ====================

class DirectShearRequest(BaseModel):
    normal_stresses: List[float] = Field(..., min_length=3, description="σ_n (kPa)")
    shear_stresses: List[float] = Field(..., min_length=3, description="τ (kPa)")


class DirectShearResponse(BaseModel):
    cohesion: float = Field(..., description="c (kPa)")
    friction_angle: float = Field(..., description="φ (degrees)")
    r_squared: float


class TriaxialRequest(BaseModel):
    test_type: Literal["UU", "CU", "CD"] = "CD"
    confining_pressures: List[float] = Field(..., min_length=3, description="σ₃ (kPa)")
    deviator_stresses: List[float] = Field(..., min_length=3, description="Δσ (kPa)")
    pore_pressures: Optional[List[float]] = Field(None, description="u (kPa)")


class TriaxialResponse(BaseModel):
    cohesion: float = Field(..., description="c or c' (kPa)")
    friction_angle: float = Field(..., description="φ or φ' (degrees)")
    test_type: str
    effective_stress_path: bool


# ==================== CONSOLIDATION ====================

class ConsolidationRequest(BaseModel):
    void_ratios: List[float] = Field(..., min_length=5, description="e values")
    stresses: List[float] = Field(..., min_length=5, description="σ' (kPa)")


class ConsolidationResponse(BaseModel):
    compression_index: float = Field(..., description="Cc")
    recompression_index: float = Field(..., description="Cr")
    preconsolidation_pressure: float = Field(..., description="σ'_p (kPa)")


class SettlementRequest(BaseModel):
    initial_thickness: float = Field(..., gt=0, description="H₀ (m)")
    initial_void_ratio: float = Field(..., gt=0, description="e₀")
    compression_index: float = Field(..., gt=0, description="Cc")
    initial_stress: float = Field(..., gt=0, description="σ'₀ (kPa)")
    final_stress: float = Field(..., gt=0, description="σ'_f (kPa)")


class SettlementResponse(BaseModel):
    primary_settlement: float = Field(..., description="ΔH (mm)")
    settlement_ratio: float = Field(..., description="ΔH/H₀ (%)")


# ==================== BEARING CAPACITY ====================

class BearingCapacityRequest(BaseModel):
    cohesion: float = Field(..., ge=0, description="c (kPa)")
    friction_angle: float = Field(..., ge=0, le=50, description="φ (degrees)")
    unit_weight: float = Field(..., gt=0, description="γ (kN/m³)")
    depth: float = Field(..., ge=0, description="D_f (m)")
    width: float = Field(..., gt=0, description="B (m)")
    shape: Literal["strip", "square", "circular"] = "strip"
    method: Literal["terzaghi", "meyerhof"] = "terzaghi"
    factor_of_safety: float = Field(3.0, gt=1, description="FS")


class BearingCapacityResponse(BaseModel):
    ultimate_bearing_capacity: float = Field(..., description="q_u (kPa)")
    allowable_bearing_capacity: float = Field(..., description="q_allow (kPa)")
    bearing_capacity_factors: dict = Field(..., description="{Nc, Nq, Nγ}")
    method: str


# ==================== SLOPE STABILITY ====================

class SlopeStabilityRequest(BaseModel):
    slope_height: float = Field(..., gt=0, description="H (m)")
    slope_angle: float = Field(..., gt=0, lt=90, description="β (degrees)")
    unit_weight: float = Field(..., gt=0, description="γ (kN/m³)")
    cohesion: float = Field(..., ge=0, description="c (kPa)")
    friction_angle: float = Field(..., ge=0, description="φ (degrees)")
    water_table_depth: Optional[float] = Field(None, description="d_w (m)")


class SlopeStabilityResponse(BaseModel):
    factor_of_safety: float = Field(..., description="FoS")
    critical_circle_center: List[float] = Field(..., description="[x, y] (m)")
    critical_circle_radius: float = Field(..., description="R (m)")
    status: str = Field(..., description="Stable/Unstable")