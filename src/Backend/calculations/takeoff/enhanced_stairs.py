# main.py - Complete Staircase Quantity Takeoff Backend
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict
import math
from enum import Enum

router = APIRouter()

class StaircaseType(str, Enum):
    STRAIGHT = "straight"
    L_SHAPED = "l_shaped"
    U_SHAPED = "u_shaped"
    WINDER = "winder"
    SPIRAL = "spiral"
    HELICAL = "helical"
    CURVED = "curved"
    BIFURCATED = "bifurcated"
    CANTILEVER = "cantilever"
    OPEN_NEWEL = "open_newel"

class MaterialType(str, Enum):
    CONCRETE = "concrete"
    TIMBER = "timber"
    STEEL = "steel"
    GLASS = "glass"
    COMBINATION = "combination"

class FinishType(str, Enum):
    TERRAZZO = "terrazzo"
    CERAMIC_TILES = "ceramic_tiles"
    PORCELAIN_TILES = "porcelain_tiles"
    GRANITE = "granite"
    MARBLE = "marble"
    TIMBER = "timber"
    POLISHED_CONCRETE = "polished_concrete"
    NATURAL_STONE = "natural_stone"
    GLASS = "glass"
    RUBBER = "rubber"
    CARPET = "carpet"
    VINYL = "vinyl"
    EPOXY = "epoxy"

class BalustradeType(str, Enum):
    METAL = "metal"
    TIMBER = "timber"
    GLASS = "glass"
    CABLE = "cable"
    COMBINATION = "combination"
    NONE = "none"

class StaircaseInput(BaseModel):
    staircase_type: StaircaseType = Field(default=StaircaseType.STRAIGHT)
    material_type: MaterialType = Field(default=MaterialType.CONCRETE)
    finish_type: FinishType = Field(default=FinishType.TERRAZZO)
    balustrade_type: BalustradeType = Field(default=BalustradeType.METAL)
    
    clear_width: float = Field(1.2, gt=0)
    total_height: Optional[float] = Field(None, gt=0)
    tread: float = Field(0.275, gt=0)
    rise: float = Field(0.175, gt=0)
    
    wall_thick: float = Field(0.225, gt=0)
    waist_thick: float = Field(0.150, gt=0)
    stringer_width: float = Field(0.300, gt=0)
    stringer_depth: float = Field(0.250, gt=0)
    
    num_landings: int = Field(0, ge=0)
    landing_lengths: List[float] = Field(default_factory=lambda: [1.5])
    landing_widths: List[float] = Field(default_factory=lambda: [1.2])
    
    num_flights: int = Field(2, ge=1, le=4)
    risers_per_flight: List[int] = Field(default_factory=lambda: [8, 8])
    treads_per_flight: List[int] = Field(default_factory=lambda: [7, 8])
    
    turn_angle: float = Field(90, ge=0, le=360)
    num_winders: int = Field(0, ge=0)
    winder_inner_radius: float = Field(0.3, gt=0)
    
    spiral_radius: Optional[float] = Field(1.0, gt=0)
    spiral_center_column_dia: float = Field(0.2, gt=0)
    total_rotation: float = Field(360, gt=0)
    
    curve_radius: Optional[float] = Field(3.0, gt=0)
    curve_arc_angle: float = Field(30, gt=0, le=180)
    
    bifurcation_width: Optional[float] = Field(None, gt=0)
    lower_flight_risers: Optional[int] = Field(None, gt=0)
    upper_flight_width: Optional[float] = Field(None, gt=0)
    
    cantilever_projection: Optional[float] = Field(None, gt=0)
    support_rod_spacing: float = Field(0.6, gt=0)
    
    rebar_main_dia: int = Field(12, ge=8, le=32)
    rebar_dist_dia: int = Field(10, ge=6, le=16)
    rebar_spacing: float = Field(0.150, gt=0)
    rebar_bend: float = Field(0.500, gt=0)
    
    bal_height: float = Field(0.900, gt=0)
    bal_spacing: float = Field(0.150, gt=0)
    handrail_dia: float = Field(0.050, gt=0)
    newel_post_spacing: float = Field(1.500, gt=0)
    
    glass_thickness: float = Field(0.012, gt=0)
    glass_type: str = Field("laminated")
    
    timber_tread_thick: float = Field(0.040, gt=0)
    timber_riser_thick: float = Field(0.025, gt=0)
    timber_species: str = Field("hardwood")
    
    nosing_type: str = Field("metal")
    skirting_height: float = Field(0.100, gt=0)
    
    include_lighting: bool = Field(False)
    include_understairs_storage: bool = Field(False)
    waterproofing_required: bool = Field(False)

    @validator('rise')
    def validate_rise(cls, v):
        if v < 0.12 or v > 0.22:
            raise ValueError('Rise: 120-220mm required')
        return v

    @validator('tread')
    def validate_tread(cls, v, values):
        if v < 0.22 or v > 0.35:
            raise ValueError('Tread: 220-350mm required')
        rise = values.get('rise', 0.175)
        going_rule = (2 * rise) + v
        if going_rule < 0.55 or going_rule > 0.70:
            raise ValueError(f'Going rule (2R+T={going_rule:.3f}): 550-700mm required')
        return v

class BOQItem(BaseModel):
    billNo: str
    itemNo: str
    description: str
    unit: str
    quantity: float
    dimensions: List[Dict] = Field(default_factory=list)
    notes: Optional[str] = None

class CalculationResult(BaseModel):
    items: List[BOQItem]
    summary: Dict
    geometry: Dict
    visualization_data: Dict

class StaircaseCalculator:
    def __init__(self, inputs: StaircaseInput):
        self.inputs = inputs
        self._calculate_geometry()
        self._calculate_dimensions()
    
    def _calculate_geometry(self):
        self.total_risers = sum(self.inputs.risers_per_flight)
        self.total_treads = sum(self.inputs.treads_per_flight)
        
        self.flights = []
        for i in range(self.inputs.num_flights):
            flight = {
                'index': i,
                'risers': self.inputs.risers_per_flight[i],
                'treads': self.inputs.treads_per_flight[i],
                'horiz': self.inputs.treads_per_flight[i] * self.inputs.tread,
                'vert': self.inputs.risers_per_flight[i] * self.inputs.rise,
            }
            flight['hypo'] = math.sqrt(flight['horiz']**2 + flight['vert']**2)
            flight['angle'] = math.degrees(math.atan2(flight['vert'], flight['horiz']))
            self.flights.append(flight)
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            self._calculate_spiral_geometry()
        elif self.inputs.staircase_type == StaircaseType.HELICAL:
            self._calculate_helical_geometry()
        elif self.inputs.staircase_type == StaircaseType.WINDER:
            self._calculate_winder_geometry()
        elif self.inputs.staircase_type == StaircaseType.CURVED:
            self._calculate_curved_geometry()
        elif self.inputs.staircase_type == StaircaseType.BIFURCATED:
            self._calculate_bifurcated_geometry()
        elif self.inputs.staircase_type == StaircaseType.CANTILEVER:
            self._calculate_cantilever_geometry()
    
    def _calculate_spiral_geometry(self):
        radius = self.inputs.spiral_radius or 1.0
        angle_per_step = self.inputs.total_rotation / self.total_risers
        self.spiral_data = {
            'radius': radius,
            'center_column_dia': self.inputs.spiral_center_column_dia,
            'angle_per_step': angle_per_step,
            'total_rotation': self.inputs.total_rotation,
            'tread_width_outer': 2 * math.pi * radius * (angle_per_step / 360),
            'tread_width_inner': 2 * math.pi * (self.inputs.spiral_center_column_dia/2) * (angle_per_step / 360),
            'walking_line_radius': radius * 0.6,
            'tread_area_per_step': math.pi * (radius**2 - (self.inputs.spiral_center_column_dia/2)**2) * (angle_per_step / 360)
        }
    
    def _calculate_helical_geometry(self):
        radius = self.inputs.spiral_radius or 1.5
        self.helical_data = {
            'radius': radius,
            'circumference': 2 * math.pi * radius,
            'angle_per_step': self.inputs.total_rotation / self.total_risers,
            'vertical_pitch': self.inputs.rise * self.total_risers,
            'helix_length': math.sqrt((2 * math.pi * radius * self.inputs.total_rotation / 360)**2 + 
                                     (self.inputs.rise * self.total_risers)**2)
        }
    
    def _calculate_winder_geometry(self):
        if self.inputs.num_winders > 0:
            angle_per_winder = self.inputs.turn_angle / self.inputs.num_winders
            outer_radius = self.inputs.winder_inner_radius + self.inputs.clear_width
            self.winder_data = {
                'num_winders': self.inputs.num_winders,
                'angle_per_winder': angle_per_winder,
                'inner_radius': self.inputs.winder_inner_radius,
                'outer_radius': outer_radius,
                'area_per_winder': 0.5 * (outer_radius**2 - self.inputs.winder_inner_radius**2) * 
                                  (angle_per_winder * math.pi / 180)
            }
    
    def _calculate_curved_geometry(self):
        radius = self.inputs.curve_radius or 3.0
        arc_length = 2 * math.pi * radius * (self.inputs.curve_arc_angle / 360)
        self.curved_data = {
            'radius': radius,
            'arc_angle': self.inputs.curve_arc_angle,
            'arc_length': arc_length,
            'chord_length': 2 * radius * math.sin(math.radians(self.inputs.curve_arc_angle / 2))
        }
    
    def _calculate_bifurcated_geometry(self):
        lower_width = self.inputs.bifurcation_width or self.inputs.clear_width * 1.5
        upper_width = self.inputs.upper_flight_width or self.inputs.clear_width
        lower_risers = self.inputs.lower_flight_risers or (self.total_risers // 3)
        self.bifurcated_data = {
            'lower_width': lower_width,
            'upper_width': upper_width,
            'lower_risers': lower_risers,
            'upper_risers': (self.total_risers - lower_risers) // 2,
            'split_landing_area': lower_width * self.inputs.clear_width
        }
    
    def _calculate_cantilever_geometry(self):
        total_length = sum(f['horiz'] for f in self.flights)
        self.cantilever_data = {
            'projection': self.inputs.cantilever_projection or self.inputs.tread,
            'support_spacing': self.inputs.support_rod_spacing,
            'num_supports': int(total_length / self.inputs.support_rod_spacing) + 1,
            'wall_connection_points': self.total_risers
        }
    
    def _calculate_dimensions(self):
        if self.inputs.material_type == MaterialType.CONCRETE:
            self.conc_width = self.inputs.clear_width + self.inputs.wall_thick / 2
            self.form_width = self.inputs.clear_width
        else:
            self.conc_width = self.inputs.clear_width
            self.form_width = self.inputs.clear_width
    
    # EARTHWORKS & FOUNDATION
    def calculate_excavation(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        base_volume = self.calculate_concrete_total()
        return base_volume * 1.15  # 15% bulking factor
    
    def calculate_blinding(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        total_area = self.calculate_formwork_soffit()
        return total_area * 0.075  # 75mm blinding
    
    # FORMWORK
    def calculate_formwork_soffit(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        
        total_area = 0.0
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            total_area = spiral_data.get('tread_area_per_step', 0) * self.total_risers
        elif self.inputs.staircase_type == StaircaseType.HELICAL:
            helical_data = getattr(self, 'helical_data', {})
            total_area = helical_data.get('helix_length', 0) * self.inputs.clear_width
        elif self.inputs.staircase_type == StaircaseType.WINDER:
            winder_data = getattr(self, 'winder_data', {})
            winder_area = winder_data.get('area_per_winder', 0) * winder_data.get('num_winders', 0)
            regular_area = sum(f['hypo'] * self.form_width for f in self.flights)
            total_area = winder_area + regular_area
        elif self.inputs.staircase_type == StaircaseType.BIFURCATED:
            bifurcated_data = getattr(self, 'bifurcated_data', {})
            lower_area = bifurcated_data.get('lower_risers', 0) * self.inputs.tread * bifurcated_data.get('lower_width', 0)
            upper_area = bifurcated_data.get('upper_risers', 0) * self.inputs.tread * bifurcated_data.get('upper_width', 0) * 2
            total_area = lower_area + upper_area + bifurcated_data.get('split_landing_area', 0)
        else:
            # Standard flights
            total_area = sum(f['hypo'] * self.form_width for f in self.flights)
        
        # Add landings
        for l, w in zip(self.inputs.landing_lengths, self.inputs.landing_widths):
            total_area += l * w
        
        return total_area
    
    def calculate_formwork_risers(self) -> float:
        if self.inputs.staircase_type == StaircaseType.CANTILEVER:
            return 0.0
        
        if self.inputs.staircase_type == StaircaseType.BIFURCATED:
            bifurcated_data = getattr(self, 'bifurcated_data', {})
            lower_length = bifurcated_data.get('lower_risers', 0) * bifurcated_data.get('lower_width', 0)
            upper_length = bifurcated_data.get('upper_risers', 0) * bifurcated_data.get('upper_width', 0) * 2
            return lower_length + upper_length
        
        return self.total_risers * self.inputs.clear_width
    
    def calculate_formwork_edges(self) -> float:
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            radius = spiral_data.get('radius', 1.0)
            angle_rad = math.radians(spiral_data.get('total_rotation', 360))
            return 2 * math.pi * radius * (spiral_data.get('total_rotation', 360) / 360) * 2
        elif self.inputs.staircase_type == StaircaseType.HELICAL:
            helical_data = getattr(self, 'helical_data', {})
            return helical_data.get('helix_length', 0) * 2
        elif self.inputs.staircase_type == StaircaseType.CURVED:
            curved_data = getattr(self, 'curved_data', {})
            return curved_data.get('arc_length', 0) * 2
        else:
            return sum(f['hypo'] for f in self.flights) * 2
    
    # CONCRETE WORK
    def calculate_concrete_landings(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        
        volume = sum(l * w * self.inputs.waist_thick 
                    for l, w in zip(self.inputs.landing_lengths, self.inputs.landing_widths))
        
        if self.inputs.staircase_type == StaircaseType.BIFURCATED:
            bifurcated_data = getattr(self, 'bifurcated_data', {})
            volume += bifurcated_data.get('split_landing_area', 0) * self.inputs.waist_thick
        
        return volume
    
    def calculate_concrete_waist(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            return spiral_data.get('tread_area_per_step', 0) * self.total_risers * self.inputs.waist_thick
        elif self.inputs.staircase_type == StaircaseType.HELICAL:
            helical_data = getattr(self, 'helical_data', {})
            return helical_data.get('helix_length', 0) * self.inputs.clear_width * self.inputs.waist_thick
        elif self.inputs.staircase_type == StaircaseType.BIFURCATED:
            bifurcated_data = getattr(self, 'bifurcated_data', {})
            lower_vol = bifurcated_data.get('lower_risers', 0) * self.inputs.tread * \
                       bifurcated_data.get('lower_width', 0) * self.inputs.waist_thick
            upper_vol = bifurcated_data.get('upper_risers', 0) * self.inputs.tread * \
                       bifurcated_data.get('upper_width', 0) * self.inputs.waist_thick * 2
            return lower_vol + upper_vol
        else:
            return sum(f['hypo'] * self.conc_width * self.inputs.waist_thick for f in self.flights)
    
    def calculate_concrete_steps(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        
        volume_per_step = 0.5 * self.inputs.tread * self.inputs.rise
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            avg_width = (spiral_data.get('tread_width_outer', 0) + spiral_data.get('tread_width_inner', 0)) / 2
            return self.total_risers * volume_per_step * avg_width
        elif self.inputs.staircase_type == StaircaseType.BIFURCATED:
            bifurcated_data = getattr(self, 'bifurcated_data', {})
            lower_vol = bifurcated_data.get('lower_risers', 0) * volume_per_step * \
                       bifurcated_data.get('lower_width', 0)
            upper_vol = bifurcated_data.get('upper_risers', 0) * volume_per_step * \
                       bifurcated_data.get('upper_width', 0) * 2
            return lower_vol + upper_vol
        elif self.inputs.staircase_type == StaircaseType.WINDER:
            winder_data = getattr(self, 'winder_data', {})
            regular_steps = self.total_risers - winder_data.get('num_winders', 0)
            regular_vol = regular_steps * volume_per_step * self.conc_width
            winder_vol = winder_data.get('area_per_winder', 0) * winder_data.get('num_winders', 0) * \
                        self.inputs.rise * 0.5
            return regular_vol + winder_vol
        else:
            return self.total_risers * volume_per_step * self.conc_width
    
    def calculate_concrete_total(self) -> float:
        return (self.calculate_concrete_landings() + 
                self.calculate_concrete_waist() + 
                self.calculate_concrete_steps())
    
    def calculate_concrete_column(self) -> float:
        if self.inputs.staircase_type != StaircaseType.SPIRAL:
            return 0.0
        spiral_data = getattr(self, 'spiral_data', {})
        radius = spiral_data.get('center_column_dia', 0.2) / 2
        height = self.total_risers * self.inputs.rise
        return math.pi * radius**2 * height
    
    # REINFORCEMENT
    def calculate_main_rebar(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        
        num_bars = int(self.conc_width / self.inputs.rebar_spacing) + 1
        total_length = 0.0
        
        for flight in self.flights:
            bar_length = flight['hypo'] + 2 * self.inputs.rebar_bend
            total_length += num_bars * bar_length
        
        for length in self.inputs.landing_lengths:
            bar_length = length + 2 * self.inputs.rebar_bend
            total_length += num_bars * bar_length
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            spiral_length = 2 * math.pi * spiral_data.get('radius', 1.0) * \
                          (spiral_data.get('total_rotation', 360) / 360)
            total_length += num_bars * (spiral_length + 2 * self.inputs.rebar_bend)
        
        return total_length
    
    def calculate_distribution_rebar(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        
        bars_per_step = 2
        bar_length = self.conc_width + 0.30
        return self.total_risers * bars_per_step * bar_length
    
    def calculate_fabric_mesh(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        return self.calculate_formwork_soffit() * 1.10  # 10% lap allowance
    
    def calculate_spiral_rebar(self) -> float:
        if self.inputs.staircase_type != StaircaseType.SPIRAL:
            return 0.0
        spiral_data = getattr(self, 'spiral_data', {})
        num_radial_bars = self.total_risers * 2
        avg_radius = (spiral_data.get('radius', 1.0) + 
                     spiral_data.get('center_column_dia', 0.2) / 2) / 2
        return num_radial_bars * avg_radius
    
    # STRUCTURAL STEEL
    def calculate_steel_stringers(self) -> float:
        if self.inputs.material_type not in [MaterialType.STEEL, MaterialType.COMBINATION]:
            return 0.0
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            return 2 * math.pi * spiral_data.get('radius', 1.0) * \
                  (spiral_data.get('total_rotation', 360) / 360) * 2
        else:
            return sum(f['hypo'] for f in self.flights) * 2
    
    def calculate_steel_treads(self) -> float:
        if self.inputs.material_type != MaterialType.STEEL:
            return 0.0
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            return spiral_data.get('tread_area_per_step', 0) * self.total_risers
        else:
            return self.total_risers * self.inputs.tread * self.inputs.clear_width
    
    def calculate_steel_risers(self) -> float:
        if self.inputs.material_type != MaterialType.STEEL:
            return 0.0
        if self.inputs.staircase_type == StaircaseType.CANTILEVER:
            return 0.0
        return self.total_risers * self.inputs.rise * self.inputs.clear_width
    
    def calculate_cantilever_supports(self) -> float:
        if self.inputs.staircase_type != StaircaseType.CANTILEVER:
            return 0.0
        cantilever_data = getattr(self, 'cantilever_data', {})
        return cantilever_data.get('num_supports', 0) * self.inputs.bal_height
    
    def calculate_steel_brackets(self) -> float:
        if self.inputs.staircase_type != StaircaseType.CANTILEVER:
            return 0.0
        return self.total_risers * 2  # 2 brackets per tread
    
    # TIMBER WORK
    def calculate_timber_treads(self) -> float:
        if self.inputs.material_type not in [MaterialType.TIMBER, MaterialType.COMBINATION]:
            return 0.0
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            return spiral_data.get('tread_area_per_step', 0) * self.total_risers * \
                  self.inputs.timber_tread_thick
        else:
            return self.total_risers * self.inputs.tread * self.inputs.clear_width * \
                  self.inputs.timber_tread_thick
    
    def calculate_timber_risers(self) -> float:
        if self.inputs.material_type != MaterialType.TIMBER:
            return 0.0
        if self.inputs.staircase_type == StaircaseType.CANTILEVER:
            return 0.0
        return self.total_risers * self.inputs.rise * self.inputs.clear_width * \
              self.inputs.timber_riser_thick
    
    def calculate_timber_stringers(self) -> float:
        if self.inputs.material_type not in [MaterialType.TIMBER, MaterialType.COMBINATION]:
            return 0.0
        
        total_length = sum(f['hypo'] for f in self.flights) * 2
        return total_length * self.inputs.stringer_width * self.inputs.stringer_depth
    
    def calculate_timber_nosing(self) -> float:
        if self.inputs.material_type not in [MaterialType.TIMBER, MaterialType.COMBINATION]:
            return 0.0
        return self.total_risers * self.inputs.clear_width
    
    # GLASS WORK
    def calculate_glass_treads(self) -> float:
        if self.inputs.material_type != MaterialType.GLASS and \
           self.inputs.staircase_type != StaircaseType.CANTILEVER:
            return 0.0
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            return spiral_data.get('tread_area_per_step', 0) * self.total_risers
        else:
            return self.total_risers * self.inputs.tread * self.inputs.clear_width
    
    def calculate_glass_balustrade(self) -> float:
        if self.inputs.balustrade_type != BalustradeType.GLASS:
            return 0.0
        rail_length = self.calculate_rail_length()
        return rail_length * self.inputs.bal_height
    
    def calculate_glass_clamps(self) -> int:
        if self.inputs.balustrade_type != BalustradeType.GLASS:
            return 0
        return int(self.calculate_rail_length() / 0.6) + 1  # Clamps every 600mm
    
    # FINISHES
    def calculate_finish_areas(self) -> Dict:
        landing_area = sum(l * w for l, w in 
                          zip(self.inputs.landing_lengths, self.inputs.landing_widths))
        
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            tread_area = spiral_data.get('tread_area_per_step', 0) * self.total_risers
            riser_area = 0.0  # Spiral stairs typically don't have vertical risers
        elif self.inputs.staircase_type == StaircaseType.BIFURCATED:
            bifurcated_data = getattr(self, 'bifurcated_data', {})
            lower_tread = bifurcated_data.get('lower_risers', 0) * self.inputs.tread * \
                         bifurcated_data.get('lower_width', 0)
            upper_tread = bifurcated_data.get('upper_risers', 0) * self.inputs.tread * \
                         bifurcated_data.get('upper_width', 0) * 2
            tread_area = lower_tread + upper_tread
            lower_riser = bifurcated_data.get('lower_risers', 0) * self.inputs.rise * \
                         bifurcated_data.get('lower_width', 0)
            upper_riser = bifurcated_data.get('upper_risers', 0) * self.inputs.rise * \
                         bifurcated_data.get('upper_width', 0) * 2
            riser_area = lower_riser + upper_riser
        else:
            tread_area = self.total_risers * self.inputs.tread * self.inputs.clear_width
            riser_area = 0.0 if self.inputs.staircase_type == StaircaseType.CANTILEVER else \
                        self.total_risers * self.inputs.rise * self.inputs.clear_width
        
        if self.inputs.staircase_type == StaircaseType.BIFURCATED:
            bifurcated_data = getattr(self, 'bifurcated_data', {})
            landing_area += bifurcated_data.get('split_landing_area', 0)
        
        return {
            'landing': landing_area,
            'treads': tread_area,
            'risers': riser_area,
            'total': landing_area + tread_area + riser_area
        }
    
    def calculate_plaster_soffit(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        return self.calculate_formwork_soffit()
    
    def calculate_plaster_edges(self) -> float:
        if self.inputs.material_type != MaterialType.CONCRETE:
            return 0.0
        edge_length = self.calculate_formwork_edges()
        return edge_length * 0.25  # 250mm wide edge
    
    def calculate_paint_area(self) -> float:
        return self.calculate_plaster_soffit() + self.calculate_plaster_edges()
    
    # BALUSTRADE & RAILINGS
    def calculate_rail_length(self) -> float:
        if self.inputs.staircase_type == StaircaseType.SPIRAL:
            spiral_data = getattr(self, 'spiral_data', {})
            radius = spiral_data.get('radius', 1.0)
            return 2 * math.pi * radius * (spiral_data.get('total_rotation', 360) / 360)
        elif self.inputs.staircase_type == StaircaseType.HELICAL:
            helical_data = getattr(self, 'helical_data', {})
            return helical_data.get('helix_length', 0)
        elif self.inputs.staircase_type == StaircaseType.CURVED:
            curved_data = getattr(self, 'curved_data', {})
            return curved_data.get('arc_length', 0)
        else:
            total_length = sum(f['hypo'] for f in self.flights)
            total_length += sum(self.inputs.landing_widths)
            return total_length
    
    def calculate_balusters(self) -> Dict:
        rail_length = self.calculate_rail_length()
        num_balusters = int(rail_length / self.inputs.bal_spacing)
        
        result = {
            'num': num_balusters,
            'total_length': num_balusters * self.inputs.bal_height
        }
        
        if self.inputs.balustrade_type == BalustradeType.CABLE:
            num_cables = int(self.inputs.bal_height / 0.100)  # 100mm cable spacing
            result['num_cables'] = num_cables
            result['cable_length'] = num_cables * rail_length
        
        return result
    
    def calculate_newel_posts(self) -> int:
        rail_length = self.calculate_rail_length()
        return int(rail_length / self.inputs.newel_post_spacing) + 2
    
    def calculate_handrail_brackets(self) -> int:
        rail_length = self.calculate_rail_length()
        return int(rail_length / 0.9) + 1  # Bracket every 900mm
    
    # ADDITIONAL FEATURES
    def calculate_nosing(self) -> float:
        return self.total_risers * self.inputs.clear_width
    
    def calculate_skirting(self) -> float:
        return self.calculate_formwork_edges()
    
    def calculate_led_lighting(self) -> float:
        if not self.inputs.include_lighting:
            return 0.0
        return self.total_risers * self.inputs.clear_width
    
    def calculate_waterproofing(self) -> float:
        if not self.inputs.waterproofing_required:
            return 0.0
        finish_areas = self.calculate_finish_areas()
        return finish_areas['total'] * 1.05  # 5% waste
    
    def calculate_understairs_storage_volume(self) -> float:
        if not self.inputs.include_understairs_storage:
            return 0.0
        avg_height = (sum(f['vert'] for f in self.flights) / len(self.flights)) / 2
        length = sum(f['horiz'] for f in self.flights)
        return avg_height * length * self.inputs.clear_width * 0.7  # 70% usable
    
    # BOQ GENERATION
    def generate_boq(self) -> List[BOQItem]:
        items = []
        idx = 1
        
        # SECTION A: EARTHWORKS
        if self.inputs.material_type == MaterialType.CONCRETE:
            exc_vol = self.calculate_excavation()
            if exc_vol > 0:
                items.append(BOQItem(
                    billNo="A1", itemNo=str(idx),
                    description="Excavation for staircase foundation including disposal",
                    unit="m³", quantity=round(exc_vol, 3)
                ))
                idx += 1
            
            blind_vol = self.calculate_blinding()
            if blind_vol > 0:
                items.append(BOQItem(
                    billNo="A2", itemNo=str(idx),
                    description="Plain concrete blinding Grade 15 (75mm thick)",
                    unit="m³", quantity=round(blind_vol, 3)
                ))
                idx += 1
        
        # SECTION B: FORMWORK
        if self.inputs.material_type == MaterialType.CONCRETE:
            soffit_area = self.calculate_formwork_soffit()
            if soffit_area > 0:
                items.append(BOQItem(
                    billNo="B1", itemNo=str(idx),
                    description="Formwork to soffit of staircase and landings",
                    unit="m²", quantity=round(soffit_area, 2)
                ))
                idx += 1
            
            if self.inputs.staircase_type != StaircaseType.CANTILEVER:
                riser_form = self.calculate_formwork_risers()
                if riser_form > 0:
                    items.append(BOQItem(
                        billNo="B2", itemNo=str(idx),
                        description="Formwork to riser faces",
                        unit="m", quantity=round(riser_form, 2)
                    ))
                    idx += 1
            
            edge_form = self.calculate_formwork_edges()
            if edge_form > 0:
                items.append(BOQItem(
                    billNo="B3", itemNo=str(idx),
                    description="Formwork to string/outer edges",
                    unit="m", quantity=round(edge_form, 2)
                ))
                idx += 1
        
        # SECTION C: CONCRETE WORK
        if self.inputs.material_type == MaterialType.CONCRETE:
            conc_total = self.calculate_concrete_total()
            if conc_total > 0:
                items.append(BOQItem(
                    billNo="C1", itemNo=str(idx),
                    description="Reinforced concrete Grade 30 in staircase structure",
                    unit="m³", quantity=round(conc_total, 3)
                ))
                idx += 1
            
            if self.inputs.staircase_type == StaircaseType.SPIRAL:
                column_vol = self.calculate_concrete_column()
                if column_vol > 0:
                    items.append(BOQItem(
                        billNo="C2", itemNo=str(idx),
                        description="Reinforced concrete Grade 30 in central column",
                        unit="m³", quantity=round(column_vol, 3)
                    ))
                    idx += 1
        
        # SECTION D: REINFORCEMENT
        if self.inputs.material_type == MaterialType.CONCRETE:
            main_rebar = self.calculate_main_rebar()
            if main_rebar > 0:
                items.append(BOQItem(
                    billNo="D1", itemNo=str(idx),
                    description=f"High yield steel reinforcement {self.inputs.rebar_main_dia}mm dia. main bars",
                    unit="m", quantity=round(main_rebar, 2)
                ))
                idx += 1
            
            dist_rebar = self.calculate_distribution_rebar()
            if dist_rebar > 0:
                items.append(BOQItem(
                    billNo="D2", itemNo=str(idx),
                    description=f"High yield steel reinforcement {self.inputs.rebar_dist_dia}mm dia. distribution bars",
                    unit="m", quantity=round(dist_rebar, 2)
                ))
                idx += 1
            
            mesh = self.calculate_fabric_mesh()
            if mesh > 0:
                items.append(BOQItem(
                    billNo="D3", itemNo=str(idx),
                    description="Fabric reinforcement A252 mesh with 150mm laps",
                    unit="m²", quantity=round(mesh, 2)
                ))
                idx += 1
            
            if self.inputs.staircase_type == StaircaseType.SPIRAL:
                spiral_rebar = self.calculate_spiral_rebar()
                if spiral_rebar > 0:
                    items.append(BOQItem(
                        billNo="D4", itemNo=str(idx),
                        description="Radial reinforcement bars in spiral staircase",
                        unit="m", quantity=round(spiral_rebar, 2)
                    ))
                    idx += 1
        
        # SECTION E: STRUCTURAL STEEL
        if self.inputs.material_type in [MaterialType.STEEL, MaterialType.COMBINATION]:
            stringer_len = self.calculate_steel_stringers()
            if stringer_len > 0:
                items.append(BOQItem(
                    billNo="E1", itemNo=str(idx),
                    description=f"Steel channel stringers {int(self.inputs.stringer_width*1000)}x{int(self.inputs.stringer_depth*1000)}mm",
                    unit="m", quantity=round(stringer_len, 2)
                ))
                idx += 1
            
            if self.inputs.material_type == MaterialType.STEEL:
                tread_area = self.calculate_steel_treads()
                if tread_area > 0:
                    items.append(BOQItem(
                        billNo="E2", itemNo=str(idx),
                        description="Steel checker plate treads 6mm thick",
                        unit="m²", quantity=round(tread_area, 2)
                    ))
                    idx += 1
                
                riser_area = self.calculate_steel_risers()
                if riser_area > 0:
                    items.append(BOQItem(
                        billNo="E3", itemNo=str(idx),
                        description="Steel plate risers 3mm thick",
                        unit="m²", quantity=round(riser_area, 2)
                    ))
                    idx += 1
        
        # CANTILEVER SUPPORTS
        if self.inputs.staircase_type == StaircaseType.CANTILEVER:
            support_len = self.calculate_cantilever_supports()
            if support_len > 0:
                items.append(BOQItem(
                    billNo="E4", itemNo=str(idx),
                    description="Stainless steel support rods 20mm dia. for cantilever treads",
                    unit="m", quantity=round(support_len, 2)
                ))
                idx += 1
            
            brackets = self.calculate_steel_brackets()
            if brackets > 0:
                items.append(BOQItem(
                    billNo="E5", itemNo=str(idx),
                    description="Steel wall brackets for cantilever treads",
                    unit="nr", quantity=brackets
                ))
                idx += 1
        
        # SECTION F: TIMBER WORK
        if self.inputs.material_type in [MaterialType.TIMBER, MaterialType.COMBINATION]:
            tread_vol = self.calculate_timber_treads()
            if tread_vol > 0:
                items.append(BOQItem(
                    billNo="F1", itemNo=str(idx),
                    description=f"{self.inputs.timber_species.title()} timber treads {int(self.inputs.timber_tread_thick*1000)}mm thick",
                    unit="m³", quantity=round(tread_vol, 3)
                ))
                idx += 1
            
            if self.inputs.material_type == MaterialType.TIMBER:
                riser_vol = self.calculate_timber_risers()
                if riser_vol > 0:
                    items.append(BOQItem(
                        billNo="F2", itemNo=str(idx),
                        description=f"{self.inputs.timber_species.title()} timber risers {int(self.inputs.timber_riser_thick*1000)}mm thick",
                        unit="m³", quantity=round(riser_vol, 3)
                    ))
                    idx += 1
            
            stringer_vol = self.calculate_timber_stringers()
            if stringer_vol > 0:
                items.append(BOQItem(
                    billNo="F3", itemNo=str(idx),
                    description=f"{self.inputs.timber_species.title()} timber stringers {int(self.inputs.stringer_width*1000)}x{int(self.inputs.stringer_depth*1000)}mm",
                    unit="m³", quantity=round(stringer_vol, 3)
                ))
                idx += 1
            
            nosing_len = self.calculate_timber_nosing()
            if nosing_len > 0:
                items.append(BOQItem(
                    billNo="F4", itemNo=str(idx),
                    description="Timber nosing profiles to tread edges",
                    unit="m", quantity=round(nosing_len, 2)
                ))
                idx += 1
        
        # SECTION G: GLASS WORK
        glass_treads = self.calculate_glass_treads()
        if glass_treads > 0:
            items.append(BOQItem(
                billNo="G1", itemNo=str(idx),
                description=f"{self.inputs.glass_type.title()} glass treads {int(self.inputs.glass_thickness*1000)}mm thick",
                unit="m²", quantity=round(glass_treads, 2)
            ))
            idx += 1
        
        glass_balustrade = self.calculate_glass_balustrade()
        if glass_balustrade > 0:
            items.append(BOQItem(
                billNo="G2", itemNo=str(idx),
                description=f"Tempered glass balustrade panels {int(self.inputs.glass_thickness*1000)}mm thick",
                unit="m²", quantity=round(glass_balustrade, 2)
            ))
            idx += 1
            
            clamps = self.calculate_glass_clamps()
            if clamps > 0:
                items.append(BOQItem(
                    billNo="G3", itemNo=str(idx),
                    description="Stainless steel glass clamps and fixings",
                    unit="nr", quantity=clamps
                ))
                idx += 1
        
        # SECTION H: FINISHES
        finish_areas = self.calculate_finish_areas()
        finish_name = self.inputs.finish_type.value.replace('_', ' ').title()
        
        if finish_areas['treads'] > 0:
            items.append(BOQItem(
                billNo="H1", itemNo=str(idx),
                description=f"{finish_name} finish 25mm thick to treads",
                unit="m²", quantity=round(finish_areas['treads'], 2)
            ))
            idx += 1
        
        if finish_areas['risers'] > 0:
            items.append(BOQItem(
                billNo="H2", itemNo=str(idx),
                description=f"{finish_name} finish 20mm thick to risers",
                unit="m²", quantity=round(finish_areas['risers'], 2)
            ))
            idx += 1
        
        if finish_areas['landing'] > 0:
            items.append(BOQItem(
                billNo="H3", itemNo=str(idx),
                description=f"{finish_name} finish 25mm thick to landings",
                unit="m²", quantity=round(finish_areas['landing'], 2)
            ))
            idx += 1
        
        # SECTION I: PLASTER & PAINT
        plaster_soffit = self.calculate_plaster_soffit()
        if plaster_soffit > 0:
            items.append(BOQItem(
                billNo="I1", itemNo=str(idx),
                description="Cement/sand plaster (1:4) 12mm thick to soffit",
                unit="m²", quantity=round(plaster_soffit, 2)
            ))
            idx += 1
        
        plaster_edges = self.calculate_plaster_edges()
        if plaster_edges > 0:
            items.append(BOQItem(
                billNo="I2", itemNo=str(idx),
                description="Cement/sand plaster (1:4) 12mm thick to string edges",
                unit="m²", quantity=round(plaster_edges, 2)
            ))
            idx += 1
        
        paint_area = self.calculate_paint_area()
        if paint_area > 0:
            items.append(BOQItem(
                billNo="I3", itemNo=str(idx),
                description="Emulsion paint two coats to plastered surfaces",
                unit="m²", quantity=round(paint_area, 2)
            ))
            idx += 1
        
        # SECTION J: BALUSTRADE & HANDRAILS
        if self.inputs.balustrade_type != BalustradeType.NONE:
            newel_posts = self.calculate_newel_posts()
            items.append(BOQItem(
                billNo="J1", itemNo=str(idx),
                description=f"{self.inputs.balustrade_type.value.title()} balustrade standards/newel posts",
                unit="nr", quantity=newel_posts
            ))
            idx += 1
            
            rail_len = self.calculate_rail_length()
            items.append(BOQItem(
                billNo="J2", itemNo=str(idx),
                description=f"{self.inputs.balustrade_type.value.title()} handrail {int(self.inputs.handrail_dia*1000)}mm dia.",
                unit="m", quantity=round(rail_len, 2)
            ))
            idx += 1
            
            balusters = self.calculate_balusters()
            if self.inputs.balustrade_type == BalustradeType.CABLE:
                items.append(BOQItem(
                    billNo="J3", itemNo=str(idx),
                    description="Stainless steel cable infill with tensioners",
                    unit="m", quantity=round(balusters.get('cable_length', 0), 2)
                ))
                idx += 1
            elif self.inputs.balustrade_type != BalustradeType.GLASS:
                items.append(BOQItem(
                    billNo="J3", itemNo=str(idx),
                    description=f"{self.inputs.balustrade_type.value.title()} balusters at {int(self.inputs.bal_spacing*1000)}mm centres",
                    unit="m", quantity=round(balusters.get('total_length', 0), 2)
                ))
                idx += 1
            
            brackets = self.calculate_handrail_brackets()
            items.append(BOQItem(
                billNo="J4", itemNo=str(idx),
                description="Handrail brackets and fixings",
                unit="nr", quantity=brackets
            ))
            idx += 1
        
        # SECTION K: ACCESSORIES
        nosing_len = self.calculate_nosing()
        if nosing_len > 0:
            items.append(BOQItem(
                billNo="K1", itemNo=str(idx),
                description=f"{self.inputs.nosing_type.title()} non-slip nosing inserts to treads",
                unit="m", quantity=round(nosing_len, 2)
            ))
            idx += 1
        
        skirting_len = self.calculate_skirting()
        if skirting_len > 0:
            items.append(BOQItem(
                billNo="K2", itemNo=str(idx),
                description=f"Skirting {int(self.inputs.skirting_height*1000)}mm high to string edges",
                unit="m", quantity=round(skirting_len, 2)
            ))
            idx += 1
        
        # SECTION L: SPECIAL FEATURES
        led_len = self.calculate_led_lighting()
        if led_len > 0:
            items.append(BOQItem(
                billNo="L1", itemNo=str(idx),
                description="LED strip lighting to tread nosings including transformer",
                unit="m", quantity=round(led_len, 2)
            ))
            idx += 1
        
        waterproof_area = self.calculate_waterproofing()
        if waterproof_area > 0:
            items.append(BOQItem(
                billNo="L2", itemNo=str(idx),
                description="Waterproofing membrane to exposed surfaces",
                unit="m²", quantity=round(waterproof_area, 2)
            ))
            idx += 1
        
        storage_vol = self.calculate_understairs_storage_volume()
        if storage_vol > 0:
            items.append(BOQItem(
                billNo="L3", itemNo=str(idx),
                description="Under-stairs storage cupboard including doors and shelving",
                unit="item", quantity=1,
                notes=f"Approximate volume: {round(storage_vol, 2)}m³"
            ))
            idx += 1
        
        # SECTION M: GENERAL ITEMS
        items.extend([
            BOQItem(
                billNo="M1", itemNo=str(idx),
                description="Make good and prepare all surfaces for finishes",
                unit="m²", quantity=round(finish_areas['total'], 2)
            ),
            BOQItem(
                billNo="M2", itemNo=str(idx + 1),
                description="Curing of concrete for 7 days minimum",
                unit="m²", quantity=round(self.calculate_formwork_soffit() + finish_areas['total'], 2)
            ),
            BOQItem(
                billNo="M3", itemNo=str(idx + 2),
                description="Temporary works, falsework and formwork supports",
                unit="item", quantity=1
            ),
            BOQItem(
                billNo="M4", itemNo=str(idx + 3),
                description="Testing and certification as required by building regulations",
                unit="item", quantity=1
            )
        ])
        
        return items
    
    def get_geometry_data(self) -> Dict:
        """Return geometry data for visualization"""
        return {
            'staircase_type': self.inputs.staircase_type.value,
            'total_risers': self.total_risers,
            'total_treads': self.total_treads,
            'flights': self.flights,
            'total_height': sum(f['vert'] for f in self.flights),
            'total_going': sum(f['horiz'] for f in self.flights),
            'spiral_data': getattr(self, 'spiral_data', None),
            'helical_data': getattr(self, 'helical_data', None),
            'winder_data': getattr(self, 'winder_data', None),
            'curved_data': getattr(self, 'curved_data', None),
            'bifurcated_data': getattr(self, 'bifurcated_data', None),
            'cantilever_data': getattr(self, 'cantilever_data', None)
        }


@router.get("/")
async def root():
    return {
        "message": "Comprehensive Staircase Quantity Takeoff API",
        "version": "2.0.0",
        "supported_types": [t.value for t in StaircaseType],
        "supported_materials": [m.value for m in MaterialType],
        "supported_finishes": [f.value for f in FinishType],
        "docs": "/docs"
    }


@router.post("/calculate")
async def calculate_quantities(inputs: StaircaseInput):
    try:
        calculator = StaircaseCalculator(inputs)
        boq_items = calculator.generate_boq()
        
        finish_areas = calculator.calculate_finish_areas()
        
        summary = {
            "total_concrete_m3": round(calculator.calculate_concrete_total(), 3),
            "total_formwork_m2": round(calculator.calculate_formwork_soffit(), 2),
            "total_rebar_m": round(calculator.calculate_main_rebar() + 
                                  calculator.calculate_distribution_rebar(), 2),
            "total_finishes_m2": round(finish_areas['total'], 2),
            "total_height_m": round(sum(f['vert'] for f in calculator.flights), 2),
            "total_going_m": round(sum(f['horiz'] for f in calculator.flights), 2),
            "total_risers": calculator.total_risers,
            "total_treads": calculator.total_treads,
            "material_type": inputs.material_type.value,
            "staircase_type": inputs.staircase_type.value
        }
        
        geometry = calculator.get_geometry_data()
        
        visualization_data = {
            "inputs": inputs.dict(),
            "geometry": geometry
        }
        
        return {
            "items": [item.dict() for item in boq_items],
            "summary": summary,
            "geometry": geometry,
            "visualization_data": visualization_data
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "staircase-calculator"}


@router.get("/types")
async def get_staircase_types():
    return {
        "types": [
            {"value": t.value, "label": t.value.replace('_', ' ').title()} 
            for t in StaircaseType
        ]
    }


@router.get("/materials")
async def get_materials():
    return {
        "materials": [
            {"value": m.value, "label": m.value.replace('_', ' ').title()} 
            for m in MaterialType
        ]
    }


@router.get("/finishes")
async def get_finishes():
    return {
        "finishes": [
            {"value": f.value, "label": f.value.replace('_', ' ').title()} 
            for f in FinishType
        ]
    }