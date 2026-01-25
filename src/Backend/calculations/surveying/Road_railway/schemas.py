
# ============================================================================
# backend/route_surveying/schemas.py
# ============================================================================

from pydantic import BaseModel, Field, validator
from typing import List, Literal, Optional
from enum import Enum


class RoadCondition(str, Enum):
    DRY = "dry"
    WET = "wet"
    ICY = "icy"


class CamberType(str, Enum):
    TWO_WAY = "two-way"
    ONE_WAY = "one-way"


class FormationType(str, Enum):
    CUT = "cut"
    FILL = "fill"


class SideSlopes(BaseModel):
    cut: float = Field(..., gt=0, description="Cut slope ratio H:V (e.g., 1.5 for 1.5:1)")
    fill: float = Field(..., gt=0, description="Fill slope ratio H:V (e.g., 2.0 for 2:1)")


class CamberConfig(BaseModel):
    type: CamberType
    percentage: float = Field(..., ge=0, le=10, description="Camber/crossfall in percent")


class Point2D(BaseModel):
    offset: float = Field(..., description="Offset from centerline in meters")
    elevation: float = Field(..., description="Elevation relative to design level in meters")


class CrossSectionRequest(BaseModel):
    chainage: float = Field(..., ge=0, description="Chainage in meters")
    road_width: float = Field(..., gt=0, description="Road width in meters")
    shoulder_width: float = Field(..., ge=0, description="Shoulder width in meters")
    side_slopes: SideSlopes
    camber_config: CamberConfig
    formation_type: FormationType


class CrossSectionResponse(BaseModel):
    chainage: float
    points: List[Point2D]
    total_width: float
    units: str = "meters"


class SightDistanceRequest(BaseModel):
    design_speed_kmh: float = Field(..., gt=0, le=150, description="Design speed in km/h")
    road_condition: RoadCondition
    grade_percent: float = Field(0, ge=-15, le=15, description="Grade in percent")
    reaction_time_s: float = Field(2.5, gt=0, le=5, description="Reaction time in seconds")
    
    @validator('design_speed_kmh')
    def validate_speed(cls, v):
        if v not in [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130]:
            # Allow other speeds but warn
            pass
        return v


class SightDistanceResponse(BaseModel):
    stopping_sight_distance_m: float
    overtaking_sight_distance_m: float
    design_speed_kmh: float
    road_condition: RoadCondition
    friction_coefficient: float
    assumptions: dict
    standard_reference: str = "AASHTO Green Book"
    compliance_status: Optional[str] = None


class Station(BaseModel):
    chainage: float = Field(..., description="Chainage in meters")
    elevation: float = Field(..., description="Ground elevation in meters")
    offset: float = Field(0, description="Offset from centerline in meters")


class ChainageInterpolationRequest(BaseModel):
    stations: List[Station] = Field(..., min_items=2)
    target_chainage: float = Field(..., ge=0)


class ChainageInterpolationResponse(BaseModel):
    chainage: float
    elevation: float
    offset: float
    interpolated: bool
    method: str
    extrapolated: bool = False


class CrossSectionArea(BaseModel):
    chainage: float
    cut_area_m2: float
    fill_area_m2: float


class EarthworksRequest(BaseModel):
    cross_sections: List[CrossSectionArea] = Field(..., min_items=2)


class VolumeSegment(BaseModel):
    from_chainage: float
    to_chainage: float
    cut_volume_m3: float
    fill_volume_m3: float
    net_volume_m3: float
    cumulative_cut_m3: float
    cumulative_fill_m3: float
    mass_haul_balance_m3: float


class EarthworksResponse(BaseModel):
    segments: List[VolumeSegment]
    total_cut_m3: float
    total_fill_m3: float
    total_net_m3: float
    calculation_method: str = "average_end_area"


class PavementLayer(BaseModel):
    name: str
    thickness_mm: float = Field(..., gt=0)
    density_t_m3: Optional[float] = Field(None, gt=0, description="Density in tonnes per cubic meter")


class PavementQuantitiesRequest(BaseModel):
    alignment_length_m: float = Field(..., gt=0)
    lane_width_m: float = Field(..., gt=0)
    number_of_lanes: int = Field(..., gt=0)
    layers: List[PavementLayer] = Field(..., min_items=1)
    compaction_factor: float = Field(1.0, gt=0, le=2)
    wastage_factor: float = Field(0.0, ge=0, le=0.5, description="Wastage as decimal (e.g., 0.05 = 5%)")


class LayerQuantity(BaseModel):
    layer_name: str
    thickness_mm: float
    width_m: float
    volume_m3: float
    tonnage: Optional[float] = None
    compacted_volume_m3: float
    with_wastage_volume_m3: float


class PavementQuantitiesResponse(BaseModel):
    layers: List[LayerQuantity]
    total_volume_m3: float
    total_tonnage: Optional[float] = None
    assumptions: dict


