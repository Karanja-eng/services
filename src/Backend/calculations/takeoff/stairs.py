# main.py - FastAPI Backend for Staircase Quantity Takeoff
from fastapi import FastAPI, HTTPException,APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import math

router = APIRouter()

class StaircaseInput(BaseModel):
    """Input model for staircase calculations"""
    clear_width: float = Field(..., gt=0, description="Clear stair width in meters")
    wall_thick: float = Field(..., gt=0, description="Wall thickness in meters")
    waist_thick: float = Field(..., gt=0, description="Waist/slab thickness in meters")
    landing_L: float = Field(..., gt=0, description="Landing length in meters")
    landing_W: float = Field(..., gt=0, description="Landing width in meters")
    tread: float = Field(..., gt=0, description="Tread/going in meters")
    rise: float = Field(..., gt=0, description="Riser height in meters")
    num_risers_f1: int = Field(..., gt=0, description="Number of risers in flight 1")
    num_treads_f1: int = Field(..., gt=0, description="Number of treads in flight 1")
    num_risers_f2: int = Field(..., gt=0, description="Number of risers in flight 2")
    num_treads_f2: int = Field(..., gt=0, description="Number of treads in flight 2")
    rebar_spacing: float = Field(..., gt=0, description="Main rebar spacing in meters")
    rebar_bend: float = Field(..., gt=0, description="Rebar bend/anchor length in meters")
    bal_spacing: float = Field(..., gt=0, description="Baluster spacing in meters")
    bal_height: float = Field(..., gt=0, description="Balustrade height in meters")
    finish_type: str = Field(default="terrazzo", description="Type of finish")

    @validator('rise')
    def validate_rise(cls, v, values):
        """Validate rise is within building code limits (typically 150-200mm)"""
        if v < 0.12 or v > 0.22:
            raise ValueError('Rise should be between 120mm and 220mm for safety')
        return v

    @validator('tread')
    def validate_tread(cls, v):
        """Validate tread is within building code limits (typically 250-300mm)"""
        if v < 0.22 or v > 0.35:
            raise ValueError('Tread should be between 220mm and 350mm for safety')
        return v


class BOQItem(BaseModel):
    """Bill of Quantities item"""
    item: str
    description: str
    unit: str
    quantity: float


class CalculationResult(BaseModel):
    """Complete calculation result with all BOQ items"""
    items: List[BOQItem]
    summary: dict


class StaircaseCalculator:
    """Core calculation engine for staircase quantities"""
    
    def __init__(self, inputs: StaircaseInput):
        self.inputs = inputs
        self._calculate_geometry()
    
    def _calculate_geometry(self):
        """Calculate basic geometric properties"""
        # Flight 1 geometry
        self.horiz_f1 = self.inputs.num_treads_f1 * self.inputs.tread
        self.vert_f1 = self.inputs.num_risers_f1 * self.inputs.rise
        self.hypo_f1 = math.sqrt(self.horiz_f1**2 + self.vert_f1**2)
        
        # Flight 2 geometry
        self.horiz_f2 = self.inputs.num_treads_f2 * self.inputs.tread
        self.vert_f2 = self.inputs.num_risers_f2 * self.inputs.rise
        self.hypo_f2 = math.sqrt(self.horiz_f2**2 + self.vert_f2**2)
        
        # Total counts
        self.total_risers = self.inputs.num_risers_f1 + self.inputs.num_risers_f2
        self.total_treads = self.inputs.num_treads_f1 + self.inputs.num_treads_f2
        
        # Widths for calculations
        self.conc_width = self.inputs.clear_width + self.inputs.wall_thick / 2
        self.form_width = self.inputs.clear_width
        
        # Adjusted landing width for formwork
        self.form_landing_w = (self.inputs.landing_W - self.inputs.tread 
                               if self.inputs.tread < self.inputs.landing_W 
                               else self.inputs.landing_W)
    
    def calculate_excavation(self) -> float:
        """Calculate excavation volume (15% bulking factor)"""
        base_volume = self.calculate_concrete_total()
        return base_volume * 1.15
    
    def calculate_blinding(self) -> float:
        """Calculate blinding concrete (75mm thick)"""
        total_soffit_area = self.calculate_formwork_soffit()
        return total_soffit_area * 0.075
    
    def calculate_formwork_soffit(self) -> float:
        """Calculate formwork to soffit"""
        form_soffit_landing = self.inputs.landing_L * self.form_landing_w
        form_soffit_f1 = self.hypo_f1 * self.form_width
        form_soffit_f2 = self.hypo_f2 * self.form_width
        return form_soffit_landing + form_soffit_f1 + form_soffit_f2
    
    def calculate_formwork_risers(self) -> float:
        """Calculate formwork to riser edges (linear meters)"""
        return self.total_risers * self.inputs.clear_width
    
    def calculate_formwork_strings(self) -> float:
        """Calculate formwork to string/outer edges (linear meters)"""
        return self.hypo_f1 + self.hypo_f2
    
    def calculate_concrete_landing(self) -> float:
        """Calculate concrete volume for landing"""
        return (self.inputs.landing_L * self.inputs.landing_W * 
                self.inputs.waist_thick)
    
    def calculate_concrete_waist(self) -> float:
        """Calculate concrete volume for waist slabs"""
        waist_f1 = self.hypo_f1 * self.conc_width * self.inputs.waist_thick
        waist_f2 = self.hypo_f2 * self.conc_width * self.inputs.waist_thick
        return waist_f1 + waist_f2
    
    def calculate_concrete_steps(self) -> float:
        """Calculate concrete volume for steps"""
        volume_per_step = 0.5 * self.inputs.tread * self.inputs.rise
        return self.total_risers * volume_per_step * self.conc_width
    
    def calculate_concrete_total(self) -> float:
        """Calculate total concrete volume"""
        return (self.calculate_concrete_landing() + 
                self.calculate_concrete_waist() + 
                self.calculate_concrete_steps())
    
    def calculate_main_rebar(self) -> float:
        """Calculate main reinforcement bars"""
        num_bars = int(self.conc_width / self.inputs.rebar_spacing) + 1
        
        length_landing = self.inputs.landing_L + 2 * self.inputs.rebar_bend
        length_f1 = self.hypo_f1 + 2 * self.inputs.rebar_bend
        length_f2 = self.hypo_f2 + 2 * self.inputs.rebar_bend
        
        total_length = num_bars * (length_landing + length_f1 + length_f2)
        return total_length
    
    def calculate_distribution_rebar(self) -> float:
        """Calculate distribution bars"""
        bars_per_step = 2  # Standard: 2 bars per step
        bar_length = self.conc_width + 2 * 0.15  # Add 150mm each end for anchorage
        return self.total_risers * bars_per_step * bar_length
    
    def calculate_fabric_mesh(self) -> float:
        """Calculate fabric mesh area (A252 or similar)"""
        soffit_area = self.calculate_formwork_soffit()
        return soffit_area * 1.10  # 10% lap allowance
    
    def calculate_rail_length(self) -> float:
        """Calculate handrail length"""
        return self.hypo_f1 + self.hypo_f2 + self.inputs.landing_W
    
    def calculate_balusters(self) -> tuple:
        """Calculate number and total length of balusters"""
        rail_length = self.calculate_rail_length()
        num_balusters = int(rail_length / self.inputs.bal_spacing)
        total_length = num_balusters * self.inputs.bal_height
        return num_balusters, total_length
    
    def calculate_standards(self) -> int:
        """Calculate number of standards/posts"""
        num_balusters, _ = self.calculate_balusters()
        return num_balusters // 2 + 2  # Approximate: every other baluster + ends
    
    def calculate_finish_areas(self) -> dict:
        """Calculate finish areas for treads, risers, and landing"""
        landing_area = self.inputs.landing_L * self.inputs.landing_W
        tread_area = self.total_risers * self.inputs.tread * self.inputs.clear_width
        riser_area = self.total_risers * self.inputs.rise * self.inputs.clear_width
        total_area = landing_area + tread_area + riser_area
        
        return {
            'landing': landing_area,
            'treads': tread_area,
            'risers': riser_area,
            'total': total_area
        }
    
    def calculate_plaster_soffit(self) -> float:
        """Calculate plaster to soffit"""
        return self.calculate_formwork_soffit()
    
    def calculate_plaster_strings(self) -> float:
        """Calculate plaster to strings (assuming 250mm width)"""
        string_length = self.calculate_formwork_strings()
        return string_length * 0.25  # 250mm wide string
    
    def calculate_paint_area(self) -> float:
        """Calculate total paint area"""
        return self.calculate_plaster_soffit() + self.calculate_plaster_strings()
    
    def calculate_nonslip_inserts(self) -> float:
        """Calculate non-slip nosing inserts (linear meters)"""
        return self.total_risers * self.inputs.clear_width
    
    def calculate_skirting(self) -> float:
        """Calculate skirting length"""
        return self.calculate_formwork_strings() * 2  # Both sides
    
    def calculate_waterproofing(self) -> float:
        """Calculate waterproofing membrane area"""
        finish_areas = self.calculate_finish_areas()
        return finish_areas['total'] * 1.05  # 5% waste allowance
    
    def generate_boq(self) -> List[BOQItem]:
        """Generate complete Bill of Quantities"""
        finish_areas = self.calculate_finish_areas()
        num_balusters, bal_total_length = self.calculate_balusters()
        
        finish_name = self.inputs.finish_type.title()
        
        boq_items = [
            BOQItem(
                item="A",
                description="Excavation and earthwork for staircase foundation",
                unit="m³",
                quantity=round(self.calculate_excavation(), 3)
            ),
            BOQItem(
                item="B",
                description="Plain concrete blinding Grade 15 (75mm thick)",
                unit="m³",
                quantity=round(self.calculate_blinding(), 3)
            ),
            BOQItem(
                item="C",
                description="Formwork to soffit of staircase and landing",
                unit="m²",
                quantity=round(self.calculate_formwork_soffit(), 2)
            ),
            BOQItem(
                item="D",
                description="Formwork to riser edges",
                unit="m",
                quantity=round(self.calculate_formwork_risers(), 2)
            ),
            BOQItem(
                item="E",
                description="Formwork to string/outer edges of flights",
                unit="m",
                quantity=round(self.calculate_formwork_strings(), 2)
            ),
            BOQItem(
                item="F",
                description="Reinforced concrete Grade 30 in staircase structure",
                unit="m³",
                quantity=round(self.calculate_concrete_total(), 3)
            ),
            BOQItem(
                item="G",
                description="High yield steel reinforcement 12mm dia. main bars",
                unit="m",
                quantity=round(self.calculate_main_rebar(), 2)
            ),
            BOQItem(
                item="H",
                description="High yield steel reinforcement 10mm dia. distribution bars",
                unit="m",
                quantity=round(self.calculate_distribution_rebar(), 2)
            ),
            BOQItem(
                item="I",
                description="Fabric reinforcement A252 mesh with 150mm laps",
                unit="m²",
                quantity=round(self.calculate_fabric_mesh(), 2)
            ),
            BOQItem(
                item="J",
                description=f"{finish_name} finish 25mm thick to treads",
                unit="m²",
                quantity=round(finish_areas['treads'], 2)
            ),
            BOQItem(
                item="K",
                description=f"{finish_name} finish 20mm thick to risers",
                unit="m²",
                quantity=round(finish_areas['risers'], 2)
            ),
            BOQItem(
                item="L",
                description=f"{finish_name} finish 25mm thick to landing",
                unit="m²",
                quantity=round(finish_areas['landing'], 2)
            ),
            BOQItem(
                item="M",
                description="Cement/sand plaster (1:4) 12mm thick to soffit",
                unit="m²",
                quantity=round(self.calculate_plaster_soffit(), 2)
            ),
            BOQItem(
                item="N",
                description="Cement/sand plaster (1:4) 12mm thick to strings",
                unit="m²",
                quantity=round(self.calculate_plaster_strings(), 2)
            ),
            BOQItem(
                item="O",
                description="Emulsion paint two coats to plastered surfaces",
                unit="m²",
                quantity=round(self.calculate_paint_area(), 2)
            ),
            BOQItem(
                item="P",
                description="Metal balustrade standards 40x40mm MS at centres",
                unit="nr",
                quantity=self.calculate_standards()
            ),
            BOQItem(
                item="Q",
                description="Metal handrail 50mm dia. fixed to standards",
                unit="m",
                quantity=round(self.calculate_rail_length(), 2)
            ),
            BOQItem(
                item="R",
                description="Mild steel balusters 25mm dia. at specified centres",
                unit="m",
                quantity=round(bal_total_length, 2)
            ),
            BOQItem(
                item="S",
                description="Non-slip nosing inserts to treads",
                unit="m",
                quantity=round(self.calculate_nonslip_inserts(), 2)
            ),
            BOQItem(
                item="T",
                description="PVC skirting 100mm high fixed to strings",
                unit="m",
                quantity=round(self.calculate_skirting(), 2)
            ),
            BOQItem(
                item="U",
                description="Waterproofing membrane to exposed surfaces",
                unit="m²",
                quantity=round(self.calculate_waterproofing(), 2)
            ),
            BOQItem(
                item="V",
                description="Make good and prepare surfaces for finishes",
                unit="m²",
                quantity=round(finish_areas['total'], 2)
            ),
            BOQItem(
                item="W",
                description="Curing of concrete for 7 days",
                unit="m²",
                quantity=round(self.calculate_formwork_soffit() + 
                             finish_areas['total'], 2)
            ),
            BOQItem(
                item="X",
                description="Temporary works and falsework to staircase",
                unit="item",
                quantity=1
            )
        ]
        
        return boq_items


@router.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Staircase Quantity Takeoff API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@router.post("/calculate", response_model=CalculationResult)
async def calculate_quantities(inputs: StaircaseInput):
    """
    Calculate staircase quantities based on input parameters
    
    Returns complete Bill of Quantities following SMM7/CESMM4 standards
    """
    try:
        calculator = StaircaseCalculator(inputs)
        boq_items = calculator.generate_boq()
        
        # Generate summary statistics
        summary = {
            "total_concrete_m3": round(calculator.calculate_concrete_total(), 3),
            "total_formwork_m2": round(calculator.calculate_formwork_soffit(), 2),
            "total_rebar_m": round(calculator.calculate_main_rebar() + 
                                  calculator.calculate_distribution_rebar(), 2),
            "total_finishes_m2": round(calculator.calculate_finish_areas()['total'], 2),
            "total_height_m": round(calculator.vert_f1 + calculator.vert_f2, 2),
            "total_going_m": round(calculator.horiz_f1 + calculator.horiz_f2 + 
                                  inputs.landing_L, 2),
            "total_risers": calculator.total_risers,
            "total_treads": calculator.total_treads
        }
        
        return CalculationResult(items=boq_items, summary=summary)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


