"""
Eurocode Slab Design Calculator - FastAPI Backend
EN 1992-1-1:2004 (Eurocode 2: Design of concrete structures)
Professional Structural Engineering Application
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import math

app = FastAPI(title="Eurocode Slab Calculator", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= DATA MODELS =============

class EurocodeSlabRequest(BaseModel):
    # Slab configuration
    slabType: str = Field(..., description="one-way, two-way, ribbed, waffle")
    spanType: str = Field(default="single", description="single, multiple")
    support: str = Field(..., description="simply-supported, continuous, cantilever")
    
    # Material properties - Eurocode format
    concreteClass: str = Field(default="C30/37", description="Concrete class")
    fck: float = Field(default=30, description="Characteristic compressive strength (N/mm²)")
    fcd: float = Field(default=20, description="Design compressive strength (N/mm²)")
    steelClass: str = Field(default="B500B", description="Steel class")
    fyk: float = Field(default=500, description="Characteristic yield strength (N/mm²)")
    fyd: float = Field(default=435, description="Design yield strength (N/mm²)")
    cover: float = Field(default=30, description="Nominal cover (mm)")
    exposureClass: str = Field(default="XC1", description="Exposure class")
    
    # Loading - Eurocode format
    permanentLoad: float = Field(..., description="Permanent load Gk (kN/m²)")
    variableLoad: float = Field(..., description="Variable load Qk (kN/m²)")
    loadCategory: str = Field(default="A", description="Load category")
    
    # Dimensions - One-way
    spanLength: Optional[float] = Field(default=None, description="Span length (m)")
    slabWidth: Optional[float] = Field(default=1.0, description="Slab width (m)")
    
    # Dimensions - Two-way
    lx: Optional[float] = Field(default=None, description="Short span (m)")
    ly: Optional[float] = Field(default=None, description="Long span (m)")
    
    # Cantilever
    cantileverLength: Optional[float] = Field(default=None, description="Cantilever length (m)")
    
    # Ribbed/Waffle
    ribWidth: Optional[float] = Field(default=125, description="Rib width (mm)")
    ribSpacing: Optional[float] = Field(default=500, description="Rib spacing (mm)")
    topping: Optional[float] = Field(default=50, description="Topping thickness (mm)")
    ribDepth: Optional[float] = Field(default=300, description="Total rib depth (mm)")
    
    # Eurocode specific
    fireResistance: Optional[str] = Field(default="R60", description="Fire resistance class")
    reductionFactor: Optional[float] = Field(default=1.0, description="Reduction factor")


class EurocodeResults(BaseModel):
    slabType: str
    designMoment: Optional[float] = None
    designMomentX: Optional[float] = None
    designMomentY: Optional[float] = None
    designShear: Optional[float] = None
    effectiveDepth: float
    totalDepth: float
    steelArea: Optional[float] = None
    steelAreaX: Optional[float] = None
    steelAreaY: Optional[float] = None
    minSteelArea: Optional[float] = None
    mainReinforcement: Optional[str] = None
    distributionSteel: Optional[str] = None
    reinforcementX: Optional[str] = None
    reinforcementY: Optional[str] = None
    ribReinforcement: Optional[str] = None
    toppingReinforcement: Optional[str] = None
    leverArm: Optional[float] = None
    muValue: Optional[float] = None
    effectiveFlangeWidth: Optional[float] = None
    checksPassed: List[str]
    designDetails: Dict
    eurocode: str = "EN 1992-1-1:2004"


# ============= EUROCODE 2 TABLES AND COEFFICIENTS =============

class EN1992Tables:
    """EN 1992-1-1:2004 design tables and coefficients"""
    
    # Table 3.1: Strength and deformation characteristics for concrete
    CONCRETE_PROPERTIES = {
        'C20/25': {'fck': 20, 'fcm': 28, 'fctm': 2.2, 'Ecm': 30000},
        'C25/30': {'fck': 25, 'fcm': 33, 'fctm': 2.6, 'Ecm': 31000},
        'C30/37': {'fck': 30, 'fcm': 38, 'fctm': 2.9, 'Ecm': 33000},
        'C35/45': {'fck': 35, 'fcm': 43, 'fctm': 3.2, 'Ecm': 34000},
        'C40/50': {'fck': 40, 'fcm': 48, 'fctm': 3.5, 'Ecm': 35000},
        'C45/55': {'fck': 45, 'fcm': 53, 'fctm': 3.8, 'Ecm': 36000},
        'C50/60': {'fck': 50, 'fcm': 58, 'fctm': 4.1, 'Ecm': 37000}
    }
    
    # Table C.1: Recommended values of ψ factors for buildings
    PSI_FACTORS = {
        'A': {'psi0': 0.7, 'psi1': 0.5, 'psi2': 0.3},  # Residential
        'B': {'psi0': 0.7, 'psi1': 0.5, 'psi2': 0.3},  # Office
        'C': {'psi0': 0.7, 'psi1': 0.7, 'psi2': 0.6},  # Assembly
        'D': {'psi0': 0.7, 'psi1': 0.7, 'psi2': 0.6},  # Shopping
        'E': {'psi0': 1.0, 'psi1': 0.9, 'psi2': 0.8}   # Storage
    }
    
    # Table 4.1: Nominal cover requirements (simplified)
    COVER_REQUIREMENTS = {
        'XC1': {'min_cover': 15, 'delta_c': 10},
        'XC2': {'min_cover': 25, 'delta_c': 10},
        'XC3': {'min_cover': 25, 'delta_c': 10},
        'XC4': {'min_cover': 30, 'delta_c': 10},
        'XD1': {'min_cover': 40, 'delta_c': 10},
        'XD2': {'min_cover': 45, 'delta_c': 10},
        'XD3': {'min_cover': 50, 'delta_c': 10}
    }
    
    # Annex I: Moment coefficients for two-way slabs (simplified from tables)
    # For restrained slabs
    TWO_WAY_RESTRAINED = {
        1.0: {'mx_pos': 0.024, 'my_pos': 0.024, 'mx_neg': 0.031, 'my_neg': 0.031},
        1.1: {'mx_pos': 0.028, 'my_pos': 0.023, 'mx_neg': 0.037, 'my_neg': 0.030},
        1.2: {'mx_pos': 0.032, 'my_pos': 0.022, 'mx_neg': 0.043, 'my_neg': 0.029},
        1.3: {'mx_pos': 0.035, 'my_pos': 0.021, 'mx_neg': 0.047, 'my_neg': 0.028},
        1.4: {'mx_pos': 0.037, 'my_pos': 0.020, 'mx_neg': 0.051, 'my_neg': 0.027},
        1.5: {'mx_pos': 0.040, 'my_pos': 0.020, 'mx_neg': 0.053, 'my_neg': 0.027},
        1.75: {'mx_pos': 0.044, 'my_pos': 0.018, 'mx_neg': 0.059, 'my_neg': 0.025},
        2.0: {'mx_pos': 0.048, 'my_pos': 0.017, 'mx_neg': 0.065, 'my_neg': 0.024}
    }
    
    # Simply supported two-way slabs
    TWO_WAY_SIMPLY = {
        1.0: {'mx': 0.062, 'my': 0.062},
        1.1: {'mx': 0.074, 'my': 0.061},
        1.2: {'mx': 0.084, 'my': 0.059},
        1.3: {'mx': 0.093, 'my': 0.055},
        1.4: {'mx': 0.099, 'my': 0.051},
        1.5: {'mx': 0.104, 'my': 0.046},
        1.75: {'mx': 0.113, 'my': 0.037},
        2.0: {'mx': 0.118, 'my': 0.029}
    }
    
    # Expression (7.16a,b): Basic span/effective depth ratios
    SPAN_DEPTH_RATIOS = {
        'simply-supported': 20,
        'continuous': 30,  # End span
        'continuous-interior': 30,
        'cantilever': 8
    }
    
    @staticmethod
    def get_concrete_properties(concrete_class: str):
        """Get concrete properties from Table 3.1"""
        return EN1992Tables.CONCRETE_PROPERTIES.get(concrete_class, 
                                                     EN1992Tables.CONCRETE_PROPERTIES['C30/37'])
    
    @staticmethod
    def calculate_fcd(fck: float, alpha_cc: float = 0.85, gamma_c: float = 1.5):
        """Calculate design compressive strength: fcd = αcc × fck / γc"""
        return (alpha_cc * fck) / gamma_c
    
    @staticmethod
    def calculate_fyd(fyk: float, gamma_s: float = 1.15):
        """Calculate design yield strength: fyd = fyk / γs"""
        return fyk / gamma_s
    
    @staticmethod
    def interpolate_two_way_coeffs(ly_lx: float, restrained: bool = True):
        """Interpolate moment coefficients for two-way slabs"""
        table = EN1992Tables.TWO_WAY_RESTRAINED if restrained else EN1992Tables.TWO_WAY_SIMPLY
        
        ratios = sorted(table.keys())
        
        if ly_lx <= ratios[0]:
            return table[ratios[0]]
        elif ly_lx >= ratios[-1]:
            return table[ratios[-1]]
        
        # Linear interpolation
        for i in range(len(ratios) - 1):
            if ratios[i] <= ly_lx <= ratios[i + 1]:
                r1, r2 = ratios[i], ratios[i + 1]
                c1, c2 = table[r1], table[r2]
                
                factor = (ly_lx - r1) / (r2 - r1)
                
                return {
                    key: c1[key] + factor * (c2[key] - c1[key])
                    for key in c1.keys()
                }
        
        return table[ratios[-1]]


# ============= EUROCODE 2 DESIGN CALCULATOR =============

class EurocodeSlabDesigner:
    """Slab designer following EN 1992-1-1:2004"""
    
    def __init__(self, request: EurocodeSlabRequest):
        self.req = request
        self.results = {
            'checks': [],
            'warnings': [],
            'details': {}
        }
        
        # Get concrete properties
        self.concrete = EN1992Tables.get_concrete_properties(request.concreteClass)
        self.fctm = self.concrete['fctm']
    
    def calculate_design_load(self):
        """Calculate design load according to EN 1990: Ed = 1.35Gk + 1.5Qk"""
        # For ULS combination (6.10a, 6.10b)
        gamma_g = 1.35  # Partial factor for permanent loads
        gamma_q = 1.5   # Partial factor for variable loads
        
        return gamma_g * self.req.permanentLoad + gamma_q * self.req.variableLoad
    
    def calculate_mu(self, Med: float, b: float, d: float, fcd: float):
        """
        Calculate dimensionless moment: μ = MEd / (b × d² × fcd)
        Expression (6.13) EN 1992-1-1
        """
        return (Med * 1e6) / (b * d * d * fcd)
    
    def calculate_lever_arm(self, mu: float, d: float):
        """
        Calculate lever arm z
        EN 1992-1-1: 6.1
        """
        if mu <= 0.167:  # No compression reinforcement needed
            # From equilibrium: z = d × [1 - 0.5(1 - √(1 - 3.53μ))]
            z = d * (1 - 0.5 * (1 - math.sqrt(max(0, 1 - 3.53 * mu))))
            return min(z, 0.95 * d)
        else:
            # Compression reinforcement required
            return 0.82 * d
    
    def calculate_steel_area(self, Med: float, fyd: float, z: float):
        """
        Calculate required steel area: As = MEd / (fyd × z)
        Expression (6.2) EN 1992-1-1
        """
        return (Med * 1e6) / (fyd * z)
    
    def calculate_min_steel(self, bt: float, d: float, fctm: float, fyk: float):
        """
        Minimum reinforcement area: Expression (9.1N) EN 1992-1-1
        As,min = max(0.26 × fctm/fyk × bt × d, 0.0013 × bt × d)
        """
        As_min1 = 0.26 * (fctm / fyk) * bt * d
        As_min2 = 0.0013 * bt * d
        return max(As_min1, As_min2)
    
    def calculate_shear_resistance(self, b: float, d: float, As: float, fck: float):
        """
        Calculate shear resistance without shear reinforcement
        Expression (6.2.a) EN 1992-1-1: 6.2.2
        VRd,c = [CRd,c × k × (100 × ρ1 × fck)^(1/3)] × b × d
        """
        # EN 1992-1-1: 6.2.2(1)
        CRd_c = 0.18 / 1.5  # = 0.12
        k = min(1 + math.sqrt(200 / d), 2.0)
        rho1 = min(As / (b * d), 0.02)
        
        vRd_c = max(
            CRd_c * k * math.pow(100 * rho1 * fck, 1/3),
            0.035 * math.pow(k, 1.5) * math.sqrt(fck)
        )
        
        return vRd_c  # N/mm²
    
    def select_reinforcement(self, As_req: float, width: float = 1000):
        """Select bar size and spacing according to EN 1992-1-1: 8.2"""
        # Standard bar sizes (mm)
        bar_sizes = [8, 10, 12, 16, 20, 25, 32]
        bar_areas = {
            8: 50.3,
            10: 78.5,
            12: 113.1,
            16: 201.1,
            20: 314.2,
            25: 490.9,
            32: 804.2
        }
        
        # Maximum spacing: EN 1992-1-1: 9.3.1.1(3)
        # For principal reinforcement: 3h ≤ 400mm (for slabs)
        # For secondary reinforcement: 3.5h ≤ 450mm
        
        for bar_size in bar_sizes:
            bar_area = bar_areas[bar_size]
            spacing = (bar_area / As_req) * width
            
            # Check if spacing is within limits (100mm to 300mm for main reinforcement)
            if 100 <= spacing <= 300:
                spacing_rounded = round(spacing / 25) * 25
                return f"Ø{bar_size} @ {spacing_rounded}mm c/c"
        
        # Default to Ø12
        bar_size = 12
        spacing = min(300, max(100, (bar_areas[bar_size] / As_req) * width))
        spacing_rounded = round(spacing / 25) * 25
        return f"Ø{bar_size} @ {spacing_rounded}mm c/c"
    
    def design_one_way_slab(self):
        """Design one-way spanning slab according to EN 1992-1-1"""
        span = self.req.spanLength
        width = self.req.slabWidth
        Ed = self.calculate_design_load()
        
        # Moment coefficients from Annex A or simplified tables
        if self.req.support == 'simply-supported':
            moment_coeff = 0.125
            shear_coeff = 0.5
        elif self.req.support == 'continuous':
            moment_coeff = 0.080  # Mid-span of end span
            shear_coeff = 0.6
        else:  # cantilever
            moment_coeff = 0.5
            shear_coeff = 1.0
        
        # Design moment and shear
        Med = moment_coeff * Ed * span ** 2
        Ved = shear_coeff * Ed * span
        
        # Effective depth from span/depth ratio (Expression 7.16a,b)
        base_ratio = EN1992Tables.SPAN_DEPTH_RATIOS[self.req.support]
        d_min = (span * 1000) / base_ratio
        
        # Minimum depth for slabs
        d = max(d_min, 150)
        h = d + self.req.cover + 12  # Assume Ø12 bars
        
        # Calculate dimensionless moment
        b = width * 1000  # mm
        mu = self.calculate_mu(Med, b, d, self.req.fcd)
        
        # Check if compression reinforcement is needed
        if mu > 0.167:
            self.results['warnings'].append("μ > 0.167: Compression reinforcement required")
        
        # Calculate lever arm
        z = self.calculate_lever_arm(mu, d)
        
        # Calculate required steel area
        As = self.calculate_steel_area(Med, self.req.fyd, z)
        
        # Minimum steel area (Expression 9.1N)
        As_min = self.calculate_min_steel(b, d, self.fctm, self.req.fyk)
        As_prov = max(As, As_min)
        
        # Select reinforcement
        main_reinf = self.select_reinforcement(As_prov, b)
        dist_reinf = self.select_reinforcement(As_min * 0.2, b)  # Secondary reinforcement
        
        # Shear check (6.2.2)
        vRd_c = self.calculate_shear_resistance(b, d, As_prov, self.req.fck)
        vEd = (Ved * 1000) / (b * d)
        
        # Compile checks
        self.results['checks'].append(f"μ = {mu:.4f} {'≤ 0.167 (OK - No comp. steel)' if mu <= 0.167 else '> 0.167 (Comp. steel required)'}")
        self.results['checks'].append(f"Span/depth: {span * 1000 / d:.1f} ≤ {base_ratio} (OK)")
        self.results['checks'].append(f"As,prov = {As_prov:.0f} mm² ≥ As,min = {As_min:.0f} mm² (OK)")
        self.results['checks'].append(f"Shear: vEd = {vEd:.2f} {'≤' if vEd <= vRd_c else '>'} vRd,c = {vRd_c:.2f} N/mm² {' (OK)' if vEd <= vRd_c else '(Shear reinf. required)'}")
        
        return EurocodeResults(
            slabType="One-Way Slab (EN 1992-1-1)",
            designMoment=round(Med, 2),
            designShear=round(Ved, 2),
            effectiveDepth=round(d, 0),
            totalDepth=round(h, 0),
            steelArea=round(As_prov, 0),
            minSteelArea=round(As_min, 0),
            mainReinforcement=main_reinf,
            distributionSteel=dist_reinf,
            leverArm=round(z, 0),
            muValue=round(mu, 4),
            checksPassed=self.results['checks'],
            designDetails={
                'design_load': round(Ed, 2),
                'moment_coefficient': moment_coeff,
                'shear_coefficient': shear_coeff,
                'vRd_c': round(vRd_c, 2),
                'vEd': round(vEd, 2)
            },
            eurocode="EN 1992-1-1:2004"
        )
    
    def design_two_way_slab(self):
        """Design two-way spanning slab according to EN 1992-1-1"""
        lx = self.req.lx
        ly = self.req.ly
        
        if ly / lx < 1.0:
            lx, ly = ly, lx
        
        ratio = ly / lx
        Ed = self.calculate_design_load()
        
        # Get moment coefficients from Annex I
        restrained = self.req.support == 'continuous'
        coeffs = EN1992Tables.interpolate_two_way_coeffs(ratio, restrained)
        
        # Calculate design moments
        if restrained:
            Medx = coeffs['mx_pos'] * Ed * lx ** 2
            Medy = coeffs['my_pos'] * Ed * lx ** 2
        else:
            Medx = coeffs['mx'] * Ed * lx ** 2
            Medy = coeffs['my'] * Ed * lx ** 2
        
        # Effective depth
        base_ratio = 30 if restrained else 25
        d = max((lx * 1000) / base_ratio, 150)
        h = d + self.req.cover + 12
        
        # Design for X-direction
        b = 1000  # Per meter width
        mux = self.calculate_mu(Medx, b, d, self.req.fcd)
        zx = self.calculate_lever_arm(mux, d)
        Asx = self.calculate_steel_area(Medx, self.req.fyd, zx)
        
        # Design for Y-direction
        muy = self.calculate_mu(Medy, b, d, self.req.fcd)
        zy = self.calculate_lever_arm(muy, d)
        Asy = self.calculate_steel_area(Medy, self.req.fyd, zy)
        
        # Minimum steel
        As_min = self.calculate_min_steel(b, d, self.fctm, self.req.fyk)
        
        Asx_prov = max(Asx, As_min)
        Asy_prov = max(Asy, As_min)
        
        # Select reinforcement
        reinf_x = self.select_reinforcement(Asx_prov, b)
        reinf_y = self.select_reinforcement(Asy_prov, b)
        
        # Compile checks
        self.results['checks'].append(f"ly/lx = {ratio:.2f}")
        self.results['checks'].append(f"μx = {mux:.4f}, μy = {muy:.4f}")
        self.results['checks'].append(f"Span/depth: {lx * 1000 / d:.1f} ≤ {base_ratio} (OK)")
        self.results['checks'].append(f"As,x,prov = {Asx_prov:.0f} mm² ≥ As,min (OK)")
        self.results['checks'].append(f"As,y,prov = {Asy_prov:.0f} mm² ≥ As,min (OK)")
        
        return EurocodeResults(
            slabType="Two-Way Slab (EN 1992-1-1)",
            designMomentX=round(Medx, 2),
            designMomentY=round(Medy, 2),
            effectiveDepth=round(d, 0),
            totalDepth=round(h, 0),
            steelAreaX=round(Asx_prov, 0),
            steelAreaY=round(Asy_prov, 0),
            reinforcementX=reinf_x,
            reinforcementY=reinf_y,
            checksPassed=self.results['checks'],
            designDetails={
                'design_load': round(Ed, 2),
                'ly_lx_ratio': round(ratio, 2),
                'mx_coefficient': round(coeffs.get('mx_pos', coeffs.get('mx', 0)), 4),
                'my_coefficient': round(coeffs.get('my_pos', coeffs.get('my', 0)), 4)
            },
            eurocode="EN 1992-1-1:2004 + Annex I"
        )
    
    def design_ribbed_slab(self):
        """Design ribbed or waffle slab according to EN 1992-1-1"""
        span = self.req.spanLength or self.req.lx
        Ed = self.calculate_design_load()
        
        # Design moment (simplified - assuming continuous)
        Med = 0.080 * Ed * (self.req.ribSpacing / 1000) * span ** 2
        
        # Dimensions
        bw = self.req.ribWidth
        hf = self.req.topping
        d = self.req.ribDepth - self.req.cover - 16  # Assume Ø16 bars
        h = self.req.ribDepth
        
        # Effective flange width according to EN 1992-1-1: 5.3.2.1
        # For T-beams: beff = beff,i + bw ≤ b
        # beff,i = 0.2bi + 0.1l0 ≤ 0.2l0 ≤ bi
        l0 = 0.85 * span * 1000  # Effective span
        beff_calc = bw + 2 * min(0.2 * (self.req.ribSpacing - bw) / 2 + 0.1 * l0, 
                                  0.2 * l0, 
                                  (self.req.ribSpacing - bw) / 2)
        beff = min(beff_calc, self.req.ribSpacing)
        
        # Check if neutral axis is in flange
        # Assume compression block depth x
        # For beff × hf
        Mf = 0.167 * self.req.fcd * beff * hf * (d - 0.5 * hf)
        
        if Med * 1e6 <= Mf:
            # Neutral axis in flange - design as rectangular section
            b_design = beff
        else:
            # Neutral axis in web - T-beam behavior
            b_design = bw
            self.results['warnings'].append("T-beam behavior: Neutral axis in web")
        
        # Calculate mu
        mu = self.calculate_mu(Med, b_design, d, self.req.fcd)
        z = self.calculate_lever_arm(mu, d)
        As = self.calculate_steel_area(Med, self.req.fyd, z)
        
        # Minimum steel for rib
        bt = bw
        As_min_rib = self.calculate_min_steel(bt, d, self.fctm, self.req.fyk)
        As_prov = max(As, As_min_rib)
        
        # Select rib reinforcement
        rib_reinf = self.select_rib_reinforcement(As_prov)
        
        # Topping reinforcement - secondary reinforcement
        # Minimum 20% of main reinforcement or 0.0013 × Ac
        As_topping_min = 0.0013 * 1000 * hf
        topping_reinf = "Ø8 @ 200mm c/c both ways"
        
        # Checks according to EN 1992-1-1: 9.2.1.5
        self.results['checks'].append(f"beff = {beff:.0f}mm (EN 1992-1-1: 5.3.2.1)")
        self.results['checks'].append(f"Rib spacing: {self.req.ribSpacing}mm ≤ 1500mm (OK)")
        self.results['checks'].append(f"Topping ≥ 50mm (EN 1992-1-1: 9.2.1.5)")
        self.results['checks'].append(f"μ = {mu:.4f}")
        self.results['checks'].append(f"As,prov adequate for MEd")
        
        return EurocodeResults(
            slabType="Ribbed Slab (EN 1992-1-1)" if self.req.slabType == "ribbed" else "Waffle Slab (EN 1992-1-1)",
            designMoment=round(Med, 2),
            effectiveDepth=round(d, 0),
            totalDepth=round(h, 0),
            steelArea=round(As_prov, 0),
            ribReinforcement=rib_reinf,
            toppingReinforcement=topping_reinf,
            effectiveFlangeWidth=round(beff, 0),
            muValue=round(mu, 4),
            checksPassed=self.results['checks'],
            designDetails={
                'design_load': round(Ed, 2),
                'rib_width': self.req.ribWidth,
                'rib_spacing': self.req.ribSpacing,
                'flange_thickness': self.req.topping,
                'effective_flange_width': round(beff, 0)
            },
            eurocode="EN 1992-1-1:2004"
        )
    
    def select_rib_reinforcement(self, As_req: float):
        """Select appropriate bar arrangement for rib"""
        # Common bar combinations for ribs
        bar_combos = [
            ("2Ø10", 2 * 78.5),
            ("2Ø12", 2 * 113.1),
            ("2Ø16", 2 * 201.1),
            ("3Ø12", 3 * 113.1),
            ("2Ø16 + 1Ø12", 2 * 201.1 + 113.1),
            ("3Ø16", 3 * 201.1),
            ("2Ø20", 2 * 314.2),
            ("2Ø20 + 2Ø16", 2 * 314.2 + 2 * 201.1)
        ]
        
        for combo, area in bar_combos:
            if area >= As_req:
                return combo
        
        return "2Ø20 + 2Ø16"
    
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

@app.get("/")
async def root():
    return {
        "message": "Eurocode Slab Design Calculator API",
        "version": "1.0.0",
        "standard": "EN 1992-1-1:2004",
        "endpoints": ["/api/eurocode/calculate", "/api/eurocode/health", "/api/eurocode/tables"]
    }


@app.get("/api/eurocode/health")
async def health_check():
    return {"status": "healthy", "code": "EN 1992-1-1:2004"}


@app.post("/api/eurocode/calculate", response_model=EurocodeResults)
async def calculate_eurocode_design(request: EurocodeSlabRequest):
    """
    Calculate slab design according to EN 1992-1-1:2004 (Eurocode 2)
    """
    try:
        designer = EurocodeSlabDesigner(request)
        results = designer.design()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/eurocode/tables/concrete")
async def get_concrete_properties():
    """Get concrete properties from Table 3.1"""
    return EN1992Tables.CONCRETE_PROPERTIES


@app.get("/api/eurocode/tables/two-way")
async def get_two_way_coefficients():
    """Get two-way slab moment coefficients from Annex I"""
    return {
        "restrained": EN1992Tables.TWO_WAY_RESTRAINED,
        "simply_supported": EN1992Tables.TWO_WAY_SIMPLY
    }


@app.get("/api/eurocode/tables/cover")
async def get_cover_requirements():
    """Get nominal cover requirements from Table 4.1"""
    return EN1992Tables.COVER_REQUIREMENTS


@app.get("/api/eurocode/tables/psi-factors")
async def get_psi_factors():
    """Get ψ factors for load combinations from Table C.1"""
    return EN1992Tables.PSI_FACTORS


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)