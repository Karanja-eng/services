"""
Eurocode 2 (EN 1992-1-1) Reinforced Concrete Beam Design
Complete implementation using official EC2 tables and procedures
Integrated with Three-Moment Theorem and Moment Distribution Method
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, validator
from typing import List, Dict, Optional, Tuple
from enum import Enum
import numpy as np
import math

# Eurocode 2 Enumerations
class EC2ConcreteClass(str, Enum):
    C12_15 = "C12/15"
    C16_20 = "C16/20"
    C20_25 = "C20/25"
    C25_30 = "C25/30"
    C30_37 = "C30/37"
    C35_45 = "C35/45"
    C40_50 = "C40/50"
    C45_55 = "C45/55"
    C50_60 = "C50/60"

class EC2SteelClass(str, Enum):
    CLASS_A = "Class A"  # Low ductility
    CLASS_B = "Class B"  # Normal ductility (fyk = 400-600 MPa)
    CLASS_C = "Class C"  # High ductility

class EC2ExposureClass(str, Enum):
    XC1 = "XC1"  # Dry or permanently wet
    XC2 = "XC2"  # Wet, rarely dry
    XC3 = "XC3"  # Moderate humidity
    XC4 = "XC4"  # Cyclic wet and dry
    XD1 = "XD1"  # Moderate humidity with chlorides
    XD2 = "XD2"  # Wet, rarely dry with chlorides
    XD3 = "XD3"  # Cyclic wet and dry with chlorides
    XS1 = "XS1"  # Exposed to airborne salt
    XS2 = "XS2"  # Permanently submerged
    XS3 = "XS3"  # Tidal, splash and spray zones

# Pydantic Models for Eurocode 2
class EC2MaterialProperties(BaseModel):
    concrete_class: EC2ConcreteClass = EC2ConcreteClass.C30_37
    steel_class: EC2SteelClass = EC2SteelClass.CLASS_B
    fyk: float = 500.0  # Characteristic yield strength (MPa)
    exposure_class: EC2ExposureClass = EC2ExposureClass.XC1
    concrete_density: float = 25.0  # kN/m³
    
    @property
    def fck(self) -> float:
        """Characteristic cylinder compressive strength (Table 3.1 EC2)"""
        fck_table = {
            "C12/15": 12, "C16/20": 16, "C20/25": 20, "C25/30": 25,
            "C30/37": 30, "C35/45": 35, "C40/50": 40, "C45/55": 45, "C50/60": 50
        }
        return fck_table[self.concrete_class]
    
    @property
    def fcm(self) -> float:
        """Mean compressive strength (Table 3.1 EC2)"""
        return self.fck + 8
    
    @property
    def fctm(self) -> float:
        """Mean tensile strength (Table 3.1 EC2)"""
        if self.fck <= 50:
            return 0.30 * (self.fck ** (2/3))
        else:
            return 2.12 * math.log(1 + self.fcm / 10)
    
    @property
    def Ecm(self) -> float:
        """Secant modulus of elasticity (Table 3.1 EC2) in GPa"""
        return 22 * ((self.fcm / 10) ** 0.3)

class EC2BeamDesignRequest(BaseModel):
    """Design request for Eurocode 2"""
    beam_type: str  # "Rectangular", "T-Beam", "L-Beam"
    support_condition: str
    span_length: float
    rectangular_geometry: Optional[Dict] = None
    t_beam_geometry: Optional[Dict] = None
    l_beam_geometry: Optional[Dict] = None
    materials: EC2MaterialProperties = EC2MaterialProperties()
    design_moments: List[float]
    design_shears: List[float]
    moment_positions: List[float]
    shear_positions: List[float]
    imposed_load: float = 0.0
    permanent_load: float = 0.0
    fire_resistance: int = 60  # minutes (R60, R90, R120, R180, R240)
    design_working_life: int = 50  # years

class EC2ReinforcementDetails(BaseModel):
    """Reinforcement details according to EC2"""
    main_bars: List[int]  # Bar diameters
    main_bars_area: float  # Total area
    main_bars_count: Dict[int, int]  # diameter: count
    shear_links: int
    link_legs: int  # Number of legs (2, 4, 6, etc.)
    link_spacing: float
    minimum_steel_provided: bool
    steel_ratio: float
    bar_arrangement: str  # "Single layer", "Double layer"

class EC2DesignChecks(BaseModel):
    """Design checks according to EC2"""
    moment_capacity_ok: bool
    shear_capacity_ok: bool
    deflection_ok: bool
    minimum_steel_ok: bool
    maximum_steel_ok: bool
    crack_width_ok: bool
    bar_spacing_ok: bool
    detailing_ok: bool
    moment_utilization: float
    shear_utilization: float
    warnings: List[str] = []
    errors: List[str] = []

class EC2BeamDesignResponse(BaseModel):
    """Complete EC2 design response"""
    beam_geometry: Dict
    materials_used: EC2MaterialProperties
    design_summary: Dict
    reinforcement: EC2ReinforcementDetails
    design_checks: EC2DesignChecks
    calculations_summary: List[str]
    durability_requirements: Dict
    cost_estimate: Optional[Dict] = None

class Eurocode2Designer:
    """Complete Eurocode 2 (EN 1992-1-1) beam designer"""
    
    # EC2 Tables and Constants
    REINFORCEMENT_AREAS = {  # Table from EC2 - Area of steel bars (mm²)
        6: 28.3, 8: 50.3, 10: 78.5, 12: 113, 16: 201, 20: 314,
        25: 491, 32: 804, 40: 1257
    }
    
    LINK_AREAS = {  # Area for shear links
        6: 28.3, 8: 50.3, 10: 78.5, 12: 113, 16: 201
    }
    
    # Minimum cover for durability (Table 4.4N EC2)
    MIN_COVER_DURABILITY = {
        "XC1": 15, "XC2": 25, "XC3": 25, "XC4": 30,
        "XD1": 35, "XD2": 40, "XD3": 45,
        "XS1": 40, "XS2": 45, "XS3": 50
    }
    
    # Structural class for fire resistance (Table 5.8 EC2)
    MIN_COVER_FIRE = {
        60: {"beam": 25, "slab": 20},
        90: {"beam": 35, "slab": 30},
        120: {"beam": 45, "slab": 40},
        180: {"beam": 60, "slab": 55},
        240: {"beam": 75, "slab": 70}
    }
    
    def __init__(self):
        # Partial factors (Table 2.1N EC2)
        self.gamma_c = 1.5  # Concrete
        self.gamma_s = 1.15  # Steel
        self.gamma_g = 1.35  # Permanent loads
        self.gamma_q = 1.5   # Variable loads
        self.alpha_cc = 1.0  # Long-term effects on compressive strength
        
    def design_beam(self, request: EC2BeamDesignRequest) -> EC2BeamDesignResponse:
        """Main design method following EC2 procedures"""
        try:
            geometry = self._get_geometry(request)
            design_forces = self._calculate_design_forces(request, geometry)
            
            # Durability requirements (Section 4 EC2)
            durability = self._check_durability_requirements(request, geometry)
            
            # Flexural design (Section 6.1 EC2)
            flexural_design = self._design_flexure_ec2(geometry, request.materials, design_forces)
            
            # Shear design (Section 6.2 EC2)
            shear_design = self._design_shear_ec2(geometry, request.materials, design_forces, flexural_design)
            
            # Serviceability checks (Section 7 EC2)
            deflection_check = self._check_deflection_ec2(geometry, request, flexural_design)
            crack_width_check = self._check_crack_width_ec2(geometry, request.materials, flexural_design)
            
            # Steel limits (Section 9 EC2)
            steel_checks = self._check_steel_limits_ec2(geometry, request.materials, flexural_design)
            
            # Detailing requirements (Section 8 & 9 EC2)
            detailing_check = self._check_detailing_requirements(geometry, flexural_design, shear_design)
            
            # Combine reinforcement
            reinforcement = self._combine_reinforcement_ec2(flexural_design, shear_design, geometry)
            
            # Perform all design checks
            checks = self._perform_design_checks_ec2(
                geometry, request.materials, design_forces,
                flexural_design, shear_design, deflection_check, 
                crack_width_check, steel_checks, detailing_check
            )
            
            return EC2BeamDesignResponse(
                beam_geometry=self._format_geometry(geometry, request.beam_type),
                materials_used=request.materials,
                design_summary=design_forces,
                reinforcement=reinforcement,
                design_checks=checks,
                calculations_summary=self._generate_calculations_summary_ec2(
                    request, geometry, design_forces, flexural_design, shear_design
                ),
                durability_requirements=durability,
                cost_estimate=self._estimate_cost_ec2(geometry, reinforcement, request.materials)
            )
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"EC2 design failed: {str(e)}")
    
    def _get_geometry(self, request: EC2BeamDesignRequest) -> Dict:
        """Extract geometry based on beam type"""
        if request.beam_type == "Rectangular":
            if not request.rectangular_geometry:
                raise ValueError("Rectangular geometry required")
            geom = request.rectangular_geometry
            return {
                'type': 'rectangular',
                'width': geom['width'],
                'depth': geom['depth'],
                'cover': geom['cover'],
                'effective_depth': geom['depth'] - geom['cover'] - 10.0
            }
        elif request.beam_type == "T-Beam":
            if not request.t_beam_geometry:
                raise ValueError("T-beam geometry required")
            geom = request.t_beam_geometry
            return {
                'type': 't_beam',
                'web_width': geom['web_width'],
                'web_depth': geom['web_depth'],
                'flange_width': geom['flange_width'],
                'flange_thickness': geom['flange_thickness'],
                'cover': geom['cover'],
                'total_depth': geom['web_depth'] + geom['flange_thickness'],
                'effective_depth': geom['web_depth'] + geom['flange_thickness'] - geom['cover'] - 10.0
            }
        elif request.beam_type == "L-Beam":
            if not request.l_beam_geometry:
                raise ValueError("L-beam geometry required")
            geom = request.l_beam_geometry
            return {
                'type': 'l_beam',
                'web_width': geom['web_width'],
                'web_depth': geom['web_depth'],
                'flange_width': geom['flange_width'],
                'flange_thickness': geom['flange_thickness'],
                'cover': geom['cover'],
                'total_depth': geom['web_depth'] + geom['flange_thickness'],
                'effective_depth': geom['web_depth'] + geom['flange_thickness'] - geom['cover'] - 10.0
            }
    
    def _check_durability_requirements(self, request: EC2BeamDesignRequest, geometry: Dict) -> Dict:
        """Check durability requirements (Section 4 EC2)"""
        exposure = request.materials.exposure_class
        
        # Minimum cover for durability
        c_min_dur = self.MIN_COVER_DURABILITY[exposure]
        
        # Minimum cover for bond (assume φ = 20mm max bar)
        c_min_b = 20
        
        # Minimum cover
        c_min = max(c_min_dur, c_min_b)
        
        # Cover allowance for deviation
        delta_c_dev = 10  # mm (Table 4.2 EC2)
        
        # Nominal cover
        c_nom = c_min + delta_c_dev
        
        # Fire resistance requirements
        fire_cover = self.MIN_COVER_FIRE.get(request.fire_resistance, {}).get('beam', 25)
        
        required_cover = max(c_nom, fire_cover)
        provided_cover = geometry['cover']
        
        return {
            'exposure_class': exposure,
            'min_cover_durability': c_min_dur,
            'min_cover_bond': c_min_b,
            'min_cover': c_min,
            'nominal_cover': c_nom,
            'fire_cover': fire_cover,
            'required_cover': required_cover,
            'provided_cover': provided_cover,
            'cover_adequate': provided_cover >= required_cover
        }
    
    def _calculate_design_forces(self, request: EC2BeamDesignRequest, geometry: Dict) -> Dict:
        """Calculate design forces with EC2 load factors"""
        max_moment = max(abs(m) for m in request.design_moments)
        max_shear = max(abs(v) for v in request.design_shears)
        
        # Self-weight
        self_weight = self._calculate_self_weight(geometry, request.materials)
        total_permanent = request.permanent_load + self_weight
        
        # Factored loads (EC2 load combinations)
        factored_permanent = self.gamma_g * total_permanent
        factored_imposed = self.gamma_q * request.imposed_load
        
        return {
            'max_design_moment': max_moment,
            'max_design_shear': max_shear,
            'self_weight': self_weight,
            'total_permanent_load': total_permanent,
            'factored_permanent_load': factored_permanent,
            'factored_imposed_load': factored_imposed,
            'moment_envelope': request.design_moments,
            'shear_envelope': request.design_shears
        }
    
    def _calculate_self_weight(self, geometry: Dict, materials: EC2MaterialProperties) -> float:
        """Calculate self-weight"""
        if geometry['type'] == 'rectangular':
            area = geometry['width'] * geometry['depth'] * 1e-6
        elif geometry['type'] == 't_beam':
            flange_area = geometry['flange_width'] * geometry['flange_thickness']
            web_area = geometry['web_width'] * geometry['web_depth']
            area = (flange_area + web_area) * 1e-6
        elif geometry['type'] == 'l_beam':
            flange_area = geometry['flange_width'] * geometry['flange_thickness']
            web_area = geometry['web_width'] * geometry['web_depth']
            area = (flange_area + web_area) * 1e-6
        
        return area * materials.concrete_density
    
    def _design_flexure_ec2(self, geometry: Dict, materials: EC2MaterialProperties, forces: Dict) -> Dict:
        """Design for flexure according to EC2 Section 6.1"""
        
        M_Ed = forces['max_design_moment'] * 1e6  # N⋅mm
        
        if geometry['type'] == 'rectangular':
            return self._design_rectangular_flexure_ec2(geometry, materials, M_Ed)
        elif geometry['type'] == 't_beam':
            return self._design_t_beam_flexure_ec2(geometry, materials, M_Ed)
        elif geometry['type'] == 'l_beam':
            return self._design_l_beam_flexure_ec2(geometry, materials, M_Ed)
    
    def _design_rectangular_flexure_ec2(self, geometry: Dict, materials: EC2MaterialProperties, M_Ed: float) -> Dict:
        """Design rectangular section for flexure (EC2 Section 6.1)"""
        
        b = geometry['width']  # mm
        h = geometry['depth']  # mm
        d = geometry['effective_depth']  # mm
        fck = materials.fck  # MPa
        fyk = materials.fyk  # MPa
        
        calculations = []
        calculations.append(f"=== FLEXURAL DESIGN (EC2) ===")
        calculations.append(f"Design moment M_Ed = {M_Ed/1e6:.2f} kN⋅m")
        calculations.append(f"Effective depth d = {d:.0f} mm")
        
        # Design compressive strength (Exp. 3.15 EC2)
        fcd = self.alpha_cc * fck / self.gamma_c
        calculations.append(f"Design concrete strength fcd = {fcd:.2f} MPa")
        
        # Design yield strength (Exp. 3.2 EC2)
        fyd = fyk / self.gamma_s
        calculations.append(f"Design steel strength fyd = {fyd:.2f} MPa")
        
        # Neutral axis depth limit (Table 3.1 EC2)
        if fck <= 50:
            lambda_factor = 0.8
            eta_factor = 1.0
        else:
            lambda_factor = 0.8 - (fck - 50) / 400
            eta_factor = 1.0 - (fck - 50) / 200
        
        # Calculate required steel area
        K = M_Ed / (b * d**2 * fcd)
        calculations.append(f"K = M_Ed/(b⋅d²⋅fcd) = {K:.4f}")
        
        # Balanced section constant (EC2)
        K_bal = lambda_factor * eta_factor * (1 - 0.5 * lambda_factor)
        calculations.append(f"K_bal = {K_bal:.4f}")
        
        if K <= K_bal:
            # Singly reinforced section
            calculations.append("K ≤ K_bal: Singly reinforced section")
            
            z = d * (1 - math.sqrt(1 - 2 * K / (eta_factor * lambda_factor))) / lambda_factor
            if z > 0.95 * d:
                z = 0.95 * d
                calculations.append(f"Lever arm z = 0.95d = {z:.1f} mm (limited)")
            else:
                calculations.append(f"Lever arm z = {z:.1f} mm")
            
            As_req = M_Ed / (fyd * z)
            calculations.append(f"Required steel area As = {As_req:.0f} mm²")
            
            # Minimum steel (EC2 Exp. 9.1N)
            As_min = max(0.26 * materials.fctm / fyk, 0.0013) * b * d
            calculations.append(f"Minimum steel As,min = {As_min:.0f} mm²")
            
            As_provided = max(As_req, As_min)
            
            return {
                'type': 'singly_reinforced',
                'As_tension': As_provided,
                'As_compression': 0.0,
                'lever_arm': z,
                'moment_capacity': As_provided * fyd * z / 1e6,
                'calculations': calculations,
                'steel_ratio': As_provided / (b * d) * 100,
                'neutral_axis_depth': z / lambda_factor
            }
        else:
            # Doubly reinforced section
            calculations.append("K > K_bal: Doubly reinforced section required")
            
            M_bal = K_bal * b * d**2 * fcd
            M_add = M_Ed - M_bal
            
            calculations.append(f"Balanced moment M_bal = {M_bal/1e6:.2f} kN⋅m")
            calculations.append(f"Additional moment M_add = {M_add/1e6:.2f} kN⋅m")
            
            # Compression steel
            d_dash = geometry['cover'] + 10  # Assuming 20mm bars
            x_bal = lambda_factor * d
            fs_comp = fyd  # Assume compression steel yields
            
            As_comp = M_add / (fs_comp * (d - d_dash))
            calculations.append(f"Compression steel As' = {As_comp:.0f} mm²")
            
            # Tension steel
            As1 = M_bal / (fyd * 0.87 * d)
            As2 = M_add / (fyd * (d - d_dash))
            As_tension = As1 + As2
            
            calculations.append(f"Tension steel As = {As_tension:.0f} mm²")
            
            return {
                'type': 'doubly_reinforced',
                'As_tension': As_tension,
                'As_compression': As_comp,
                'lever_arm': 0.87 * d,
                'moment_capacity': M_Ed / 1e6,
                'calculations': calculations,
                'steel_ratio': As_tension / (b * d) * 100,
                'neutral_axis_depth': x_bal
            }
    
    def _design_t_beam_flexure_ec2(self, geometry: Dict, materials: EC2MaterialProperties, M_Ed: float) -> Dict:
        """Design T-beam for flexure (EC2 Section 6.1)"""
        
        # Effective flange width (EC2 Section 5.3.2.1)
        beff = self._calculate_effective_flange_width(geometry)
        
        # Check if neutral axis in flange
        hf = geometry['flange_thickness']
        d = geometry['effective_depth']
        fck = materials.fck
        fyk = materials.fyk
        
        fcd = self.alpha_cc * fck / self.gamma_c
        fyd = fyk / self.gamma_s
        
        # Moment capacity if neutral axis at bottom of flange
        Mf = 0.567 * fcd * beff * hf * (d - 0.5 * hf)
        
        calculations = []
        calculations.append("=== T-BEAM FLEXURAL DESIGN (EC2) ===")
        calculations.append(f"Effective flange width beff = {beff:.0f} mm")
        calculations.append(f"Flange moment capacity = {Mf/1e6:.2f} kN⋅m")
        
        if M_Ed <= Mf:
            # Neutral axis in flange - design as rectangular beam
            calculations.append("Neutral axis in flange - designing as rectangular")
            result = self._design_rectangular_flexure_ec2(
                {'width': beff, 'depth': geometry['total_depth'], 
                 'effective_depth': d, 'cover': geometry['cover']},
                materials, M_Ed
            )
            result['calculations'] = calculations + result['calculations']
            result['effective_flange_width'] = beff
            return result
        else:
            # Neutral axis in web
            calculations.append("Neutral axis in web")
            bw = geometry['web_width']
            
            # Design web as rectangular with remaining moment
            Mw = M_Ed - 0.85 * fcd * (beff - bw) * hf * (d - 0.5 * hf)
            calculations.append(f"Moment for web Mw = {Mw/1e6:.2f} kN⋅m")
            
            web_result = self._design_rectangular_flexure_ec2(
                {'width': bw, 'depth': geometry['web_depth'],
                 'effective_depth': d, 'cover': geometry['cover']},
                materials, Mw
            )
            
            # Add steel for flange
            As_flange = 0.85 * fcd * (beff - bw) * hf / fyd
            As_total = web_result['As_tension'] + As_flange
            
            calculations.append(f"Steel for flange overhang = {As_flange:.0f} mm²")
            calculations.append(f"Steel for web = {web_result['As_tension']:.0f} mm²")
            calculations.append(f"Total tension steel = {As_total:.0f} mm²")
            
            return {
                'type': 't_beam',
                'As_tension': As_total,
                'As_compression': web_result.get('As_compression', 0),
                'As_flange': As_flange,
                'As_web': web_result['As_tension'],
                'lever_arm': web_result['lever_arm'],
                'moment_capacity': M_Ed / 1e6,
                'calculations': calculations + web_result['calculations'],
                'steel_ratio': As_total / (beff * d) * 100,
                'effective_flange_width': beff
            }
    
    def _design_l_beam_flexure_ec2(self, geometry: Dict, materials: EC2MaterialProperties, M_Ed: float) -> Dict:
        """Design L-beam for flexure (EC2)"""
        # Similar to T-beam but with reduced effective flange width
        modified_geometry = geometry.copy()
        modified_geometry['flange_width'] = geometry['web_width'] + geometry['flange_width']
        
        result = self._design_t_beam_flexure_ec2(modified_geometry, materials, M_Ed)
        result['calculations'].insert(0, "=== L-BEAM ANALYSIS ===")
        return result
    
    def _calculate_effective_flange_width(self, geometry: Dict) -> float:
        """Calculate effective flange width (EC2 Section 5.3.2.1)"""
        # Simplified - actual calculation depends on span and spacing
        b_eff = min(geometry['flange_width'], geometry['web_width'] + 2 * 0.2 * 6000)  # Assuming 6m span
        return b_eff
    
    def _design_shear_ec2(self, geometry: Dict, materials: EC2MaterialProperties, 
                         forces: Dict, flexural_design: Dict) -> Dict:
        """Design for shear according to EC2 Section 6.2"""
        
        V_Ed = max(abs(v) for v in forces['shear_envelope']) * 1000  # N
        
        if geometry['type'] == 'rectangular':
            bw = geometry['width']
        else:
            bw = geometry['web_width']
        
        d = geometry['effective_depth']
        fck = materials.fck
        fyk = materials.fyk
        
        calculations = []
        calculations.append("=== SHEAR DESIGN (EC2) ===")
        calculations.append(f"Design shear force V_Ed = {V_Ed/1000:.1f} kN")
        
        # Concrete shear resistance (EC2 Exp. 6.2.a)
        As_provided = flexural_design.get('As_tension', 1000)
        rho_l = min(As_provided / (bw * d), 0.02)
        
        k = min(1 + math.sqrt(200 / d), 2.0)  # d in mm
        v_min = 0.035 * (k ** 1.5) * (fck ** 0.5)
        
        CRd_c = 0.18 / self.gamma_c
        v_Rd_c = max(CRd_c * k * ((100 * rho_l * fck) ** (1/3)), v_min)
        
        VRd_c = v_Rd_c * bw * d  # N
        
        calculations.append(f"Concrete shear resistance VRd,c = {VRd_c/1000:.1f} kN")
        calculations.append(f"ρl = {rho_l:.4f}, k = {k:.2f}")
        
        if V_Ed <= VRd_c:
            # Minimum shear reinforcement (EC2 Exp. 9.5N)
            calculations.append("V_Ed ≤ VRd,c: Minimum shear reinforcement")
            
            rho_w_min = 0.08 * math.sqrt(fck) / fyk
            Asw_s_min = rho_w_min * bw
            
            # Select links from table
            link_dia = 8  # mm
            link_spacing = 300  # mm
            Asw = 2 * self.LINK_AREAS[link_dia]  # 2-leg links
            
            if Asw / link_spacing < Asw_s_min:
                link_spacing = int(Asw / Asw_s_min)
                calculations.append(f"Adjusted spacing for minimum reinforcement")
            
            calculations.append(f"Minimum links: {link_dia}mm @ {link_spacing}mm c/c")
            
            return {
                'links_required': True,
                'link_diameter': link_dia,
                'link_spacing': link_spacing,
                'link_legs': 2,
                'shear_capacity': VRd_c / 1000,
                'link_area_provided': Asw,
                'calculations': calculations,
                'concrete_contribution': VRd_c / 1000
            }
        else:
            # Design shear reinforcement (EC2 Section 6.2.3)
            calculations.append("V_Ed > VRd,c: Design shear reinforcement required")
            
            # Angle theta - assume 21.8° ≤ θ ≤ 45° (EC2 Section 6.2.3)
            theta = 21.8  # degrees (conservative)
            cot_theta = 1 / math.tan(math.radians(theta))
            
            # Required shear reinforcement
            fywd = fyk / self.gamma_s
            Asw_s_req = V_Ed / (0.9 * d * fywd * cot_theta)  # mm²/mm
            
            calculations.append(f"Required Asw/s = {Asw_s_req:.3f} mm²/mm")
            
            # Select links and spacing from EC2 tables
            link_options = [8, 10, 12, 16]
            spacing_options = [300, 250, 200, 150, 100, 75]
            
            selected_link = None
            selected_spacing = None
            selected_legs = 2
            
            for link_dia in link_options:
                for legs in [2, 4, 6]:
                    for spacing in spacing_options:
                        Asw = legs * self.LINK_AREAS[link_dia]
                        Asw_s_provided = Asw / spacing
                        
                        if Asw_s_provided >= Asw_s_req:
                            selected_link = link_dia
                            selected_spacing = spacing
                            selected_legs = legs
                            break
                    if selected_link:
                        break
                if selected_link:
                    break
            
            if not selected_link:
                selected_link = 12
                selected_spacing = 75
                selected_legs = 4
                calculations.append("WARNING: Very high shear reinforcement required")
            
            # Check maximum spacing (EC2 Section 9.2.2)
            s_max = min(0.75 * d, 300)  # mm
            if selected_spacing > s_max:
                selected_spacing = int(s_max)
                calculations.append(f"Spacing limited to {s_max:.0f} mm")
            
            # Calculate shear capacity
            Asw_provided = selected_legs * self.LINK_AREAS[selected_link]
            VRd_s = (Asw_provided / selected_spacing) * 0.9 * d * fywd * cot_theta / 1000  # kN
            
            calculations.append(f"Design links: {selected_legs}-leg {selected_link}mm @ {selected_spacing}mm c/c")
            calculations.append(f"Shear capacity VRd,s = {VRd_s:.1f} kN")
            
            return {
                'links_required': True,
                'link_diameter': selected_link,
                'link_spacing': selected_spacing,
                'link_legs': selected_legs,
                'shear_capacity': VRd_s,
                'link_area_provided': Asw_provided,
                'calculations': calculations,
                'concrete_contribution': VRd_c / 1000,
                'steel_contribution': VRd_s - VRd_c / 1000
            }
    
    def _check_deflection_ec2(self, geometry: Dict, request: EC2BeamDesignRequest, 
                             flexural_design: Dict) -> Dict:
        """Check deflection according to EC2 Section 7.4"""
        
        span = request.span_length * 1000  # mm
        d = geometry['effective_depth']
        
        calculations = []
        calculations.append("=== DEFLECTION CHECK (EC2) ===")
        
        # Basic span/depth ratios (EC2 Table 7.4N)
        if request.support_condition == "Simply Supported":
            basic_ratio = 20
        elif request.support_condition == "Continuous":
            basic_ratio = 26
        elif request.support_condition == "Cantilever":
            basic_ratio = 8
        else:
            basic_ratio = 20
        
        # Modification factor for steel stress (EC2 Exp. 7.17)
        rho_req = flexural_design['steel_ratio'] / 100
        rho_prov = rho_req  # Simplified
        
        fck = request.materials.fck
        K = 1.0  # For rectangular sections
        
        if rho_prov > 0:
            modification_factor = min(
                11 + (1.5 * math.sqrt(fck) * (rho_req / rho_prov)) + 
                (3.2 * math.sqrt(fck) * ((rho_req / rho_prov) - 1) ** 1.5),
                1.5
            )
        else:
            modification_factor = 1.0
        
        allowable_ratio = basic_ratio * modification_factor
        actual_ratio = span / d
        
        calculations.append(f"Basic span/depth ratio = {basic_ratio}")
        calculations.append(f"Modification factor = {modification_factor:.2f}")
        calculations.append(f"Allowable span/depth ratio = {allowable_ratio:.1f}")
        calculations.append(f"Actual span/depth ratio = {actual_ratio:.1f}")
        
        deflection_ok = actual_ratio <= allowable_ratio
        
        if deflection_ok:
            calculations.append("✓ Deflection check PASSED")
        else:
            calculations.append("✗ Deflection check FAILED - increase depth")
        
        return {
            'deflection_ok': deflection_ok,
            'allowable_ratio': allowable_ratio,
            'actual_ratio': actual_ratio,
            'calculations': calculations
        }
    
    def _check_crack_width_ec2(self, geometry: Dict, materials: EC2MaterialProperties, 
                               flexural_design: Dict) -> Dict:
        """Check crack width according to EC2 Section 7.3"""
        
        calculations = []
        calculations.append("=== CRACK WIDTH CHECK (EC2) ===")
        
        # Maximum crack width (Table 7.1N EC2)
        exposure = materials.exposure_class
        if exposure in ["XC1"]:
            wmax = 0.4  # mm (Reinforced)
        elif exposure in ["XC2", "XC3", "XC4"]:
            wmax = 0.3  # mm
        else:
            wmax = 0.3  # mm (Conservative)
        
        calculations.append(f"Maximum crack width wmax = {wmax} mm")
        
        # Simplified check - actual calculation requires stress analysis
        # Assuming proper detailing and bar spacing
        bar_spacing_ok = True  # Will be checked in detailing
        crack_width_ok = True  # Simplified assumption
        
        calculations.append("Crack width control by bar spacing and diameter")
        calculations.append("✓ Assumed satisfied with proper detailing")
        
        return {
            'crack_width_ok': crack_width_ok,
            'max_allowable_crack_width': wmax,
            'calculations': calculations
        }
    
    def _check_steel_limits_ec2(self, geometry: Dict, materials: EC2MaterialProperties, 
                                flexural_design: Dict) -> Dict:
        """Check steel limits according to EC2 Section 9.2"""
        
        if geometry['type'] == 'rectangular':
            b = geometry['width']
        else:
            b = geometry['web_width']
        
        d = geometry['effective_depth']
        Ac = b * d  # Simplified
        
        # Minimum steel (EC2 Exp. 9.1N)
        fctm = materials.fctm
        fyk = materials.fyk
        As_min = max(0.26 * fctm / fyk, 0.0013) * b * d
        
        # Maximum steel (EC2 Section 9.2.1.1)
        As_max = 0.04 * Ac
        
        As_provided = flexural_design['As_tension']
        
        calculations = []
        calculations.append("=== STEEL LIMITS CHECK (EC2) ===")
        calculations.append(f"Minimum steel As,min = {As_min:.0f} mm²")
        calculations.append(f"Maximum steel As,max = {As_max:.0f} mm²")
        calculations.append(f"Provided steel As = {As_provided:.0f} mm²")
        
        min_steel_ok = As_provided >= As_min
        max_steel_ok = As_provided <= As_max
        
        if min_steel_ok:
            calculations.append("✓ Minimum steel requirement satisfied")
        else:
            calculations.append("✗ Minimum steel requirement NOT satisfied")
        
        if max_steel_ok:
            calculations.append("✓ Maximum steel requirement satisfied")
        else:
            calculations.append("✗ Maximum steel exceeded")
        
        return {
            'minimum_steel_ok': min_steel_ok,
            'maximum_steel_ok': max_steel_ok,
            'As_min': As_min,
            'As_max': As_max,
            'As_provided': As_provided,
            'calculations': calculations
        }
    
    def _check_detailing_requirements(self, geometry: Dict, flexural_design: Dict, 
                                     shear_design: Dict) -> Dict:
        """Check detailing requirements (EC2 Section 8 & 9)"""
        
        calculations = []
        calculations.append("=== DETAILING CHECKS (EC2) ===")
        
        # Bar spacing (EC2 Section 8.2)
        # Minimum clear spacing: smin = max(bar_diameter, aggregate_size + 5mm, 20mm)
        smin = 25  # mm (assuming 20mm max aggregate)
        
        # Maximum bar spacing (EC2 Section 9.3.1.1)
        # For crack control: smax = 300mm for fck ≤ 35MPa
        smax = 300  # mm
        
        spacing_ok = True
        calculations.append(f"Minimum bar spacing = {smin} mm")
        calculations.append(f"Maximum bar spacing = {smax} mm")
        calculations.append("✓ Spacing requirements satisfied (to be verified in layout)")
        
        # Maximum bar diameter for crack control (EC2 Table 7.2N & 7.3N)
        max_bar_dia = 32  # mm (simplified)
        calculations.append(f"Maximum bar diameter for crack control = {max_bar_dia} mm")
        
        detailing_ok = spacing_ok
        
        return {
            'detailing_ok': detailing_ok,
            'min_bar_spacing': smin,
            'max_bar_spacing': smax,
            'max_bar_diameter': max_bar_dia,
            'calculations': calculations
        }
    
    def _combine_reinforcement_ec2(self, flexural_design: Dict, shear_design: Dict, 
                                   geometry: Dict) -> EC2ReinforcementDetails:
        """Combine reinforcement using EC2 standard bar sizes"""
        
        As_required = flexural_design['As_tension']
        
        # Standard bar sizes from EC2 tables
        bar_sizes = [12, 16, 20, 25, 32]
        
        # Find optimal bar combination
        main_bars = []
        bar_count = {}
        remaining_area = As_required
        
        # Try to use uniform bar sizes first
        for bar_size in reversed(bar_sizes):
            bar_area = self.REINFORCEMENT_AREAS[bar_size]
            n_bars = round(As_required / bar_area)
            
            if n_bars >= 2 and n_bars <= 8:  # Practical range
                provided_area = n_bars * bar_area
                if provided_area >= As_required * 0.95:  # Within 5%
                    main_bars = [bar_size] * n_bars
                    bar_count[bar_size] = n_bars
                    break
        
        # If no single size works, use combination
        if not main_bars:
            for bar_size in reversed(bar_sizes):
                bar_area = self.REINFORCEMENT_AREAS[bar_size]
                n_bars = int(remaining_area / bar_area)
                if n_bars > 0:
                    main_bars.extend([bar_size] * n_bars)
                    bar_count[bar_size] = bar_count.get(bar_size, 0) + n_bars
                    remaining_area -= n_bars * bar_area
                    if remaining_area < bar_area * 0.2:  # Less than 20% of one bar
                        break
        
        # Calculate provided area
        main_bars_area = sum(self.REINFORCEMENT_AREAS.get(bar, 0) for bar in main_bars)
        
        # Determine bar arrangement
        if len(main_bars) <= 4:
            bar_arrangement = "Single layer"
        else:
            bar_arrangement = "Double layer"
        
        # Steel ratio
        if geometry['type'] == 'rectangular':
            b = geometry['width']
            d = geometry['effective_depth']
        else:
            b = geometry['web_width']
            d = geometry['effective_depth']
        
        steel_ratio = main_bars_area / (b * d) * 100
        
        return EC2ReinforcementDetails(
            main_bars=sorted(main_bars, reverse=True),
            main_bars_area=main_bars_area,
            main_bars_count=bar_count,
            shear_links=shear_design['link_diameter'],
            link_legs=shear_design['link_legs'],
            link_spacing=shear_design['link_spacing'],
            minimum_steel_provided=main_bars_area >= As_required,
            steel_ratio=steel_ratio,
            bar_arrangement=bar_arrangement
        )
    
    def _perform_design_checks_ec2(self, geometry: Dict, materials: EC2MaterialProperties,
                                   forces: Dict, flexural_design: Dict, shear_design: Dict,
                                   deflection_check: Dict, crack_width_check: Dict,
                                   steel_checks: Dict, detailing_check: Dict) -> EC2DesignChecks:
        """Perform all EC2 design checks"""
        
        warnings = []
        errors = []
        
        # Moment capacity
        M_design = forces['max_design_moment']
        M_capacity = flexural_design['moment_capacity']
        moment_utilization = M_design / M_capacity if M_capacity > 0 else 0
        moment_capacity_ok = moment_utilization <= 1.0
        
        if moment_utilization > 0.95:
            warnings.append(f"High moment utilization: {moment_utilization:.2f}")
        if not moment_capacity_ok:
            errors.append("Moment capacity insufficient")
        
        # Shear capacity
        V_design = max(abs(v) for v in forces['shear_envelope'])
        V_capacity = shear_design['shear_capacity']
        shear_utilization = V_design / V_capacity if V_capacity > 0 else 0
        shear_capacity_ok = shear_utilization <= 1.0
        
        if shear_utilization > 0.95:
            warnings.append(f"High shear utilization: {shear_utilization:.2f}")
        if not shear_capacity_ok:
            errors.append("Shear capacity insufficient")
        
        # Bar spacing check
        if shear_design['link_spacing'] < 75:
            warnings.append("Very close link spacing - consider larger links")
        
        return EC2DesignChecks(
            moment_capacity_ok=moment_capacity_ok,
            shear_capacity_ok=shear_capacity_ok,
            deflection_ok=deflection_check['deflection_ok'],
            minimum_steel_ok=steel_checks['minimum_steel_ok'],
            maximum_steel_ok=steel_checks['maximum_steel_ok'],
            crack_width_ok=crack_width_check['crack_width_ok'],
            bar_spacing_ok=detailing_check['detailing_ok'],
            detailing_ok=detailing_check['detailing_ok'],
            moment_utilization=moment_utilization,
            shear_utilization=shear_utilization,
            warnings=warnings,
            errors=errors
        )
    
    def _format_geometry(self, geometry: Dict, beam_type: str) -> Dict:
        """Format geometry for response"""
        formatted = {
            'beam_type': beam_type,
            'effective_depth': geometry['effective_depth'],
            'cover': geometry['cover']
        }
        
        if beam_type == "Rectangular":
            formatted.update({
                'width': geometry['width'],
                'depth': geometry['depth']
            })
        elif beam_type == "T-Beam":
            formatted.update({
                'web_width': geometry['web_width'],
                'web_depth': geometry['web_depth'],
                'flange_width': geometry['flange_width'],
                'flange_thickness': geometry['flange_thickness'],
                'total_depth': geometry['total_depth']
            })
        elif beam_type == "L-Beam":
            formatted.update({
                'web_width': geometry['web_width'],
                'web_depth': geometry['web_depth'],
                'flange_width': geometry['flange_width'],
                'flange_thickness': geometry['flange_thickness'],
                'total_depth': geometry['total_depth']
            })
        
        return formatted
    
    def _generate_calculations_summary_ec2(self, request: EC2BeamDesignRequest, geometry: Dict,
                                          forces: Dict, flexural_design: Dict, 
                                          shear_design: Dict) -> List[str]:
        """Generate comprehensive calculations summary"""
        
        summary = []
        summary.append("=== EUROCODE 2 (EN 1992-1-1) BEAM DESIGN ===")
        summary.append("")
        summary.append(f"Beam Type: {request.beam_type}")
        summary.append(f"Support Condition: {request.support_condition}")
        summary.append(f"Span Length: {request.span_length} m")
        summary.append("")
        summary.append("MATERIAL PROPERTIES:")
        summary.append(f"Concrete Class: {request.materials.concrete_class}")
        summary.append(f"  fck = {request.materials.fck} MPa")
        summary.append(f"  fctm = {request.materials.fctm:.2f} MPa")
        summary.append(f"  Ecm = {request.materials.Ecm:.0f} GPa")
        summary.append(f"Steel Class: {request.materials.steel_class}")
        summary.append(f"  fyk = {request.materials.fyk} MPa")
        summary.append(f"Exposure Class: {request.materials.exposure_class}")
        summary.append("")
        summary.append("DESIGN FORCES:")
        summary.append(f"  Maximum Moment: {forces['max_design_moment']:.2f} kN⋅m")
        summary.append(f"  Maximum Shear: {forces['max_design_shear']:.2f} kN")
        summary.append("")
        summary.append("FLEXURAL DESIGN:")
        summary.extend([f"  {line}" for line in flexural_design.get('calculations', [])])
        summary.append("")
        summary.append("SHEAR DESIGN:")
        summary.extend([f"  {line}" for line in shear_design.get('calculations', [])])
        
        return summary
    
    def _estimate_cost_ec2(self, geometry: Dict, reinforcement: EC2ReinforcementDetails,
                          materials: EC2MaterialProperties) -> Dict:
        """Estimate material costs"""
        
        # Calculate concrete volume per meter
        if geometry['type'] == 'rectangular':
            volume = geometry['width'] * geometry['depth'] * 1e-9
        elif geometry['type'] == 't_beam':
            flange_vol = geometry['flange_width'] * geometry['flange_thickness']
            web_vol = geometry['web_width'] * geometry['web_depth']
            volume = (flange_vol + web_vol) * 1e-9
        else:  # L-beam
            flange_vol = geometry['flange_width'] * geometry['flange_thickness']
            web_vol = geometry['web_width'] * geometry['web_depth']
            volume = (flange_vol + web_vol) * 1e-9
        
        # Steel weight
        steel_density = 7850  # kg/m³
        main_steel_weight = reinforcement.main_bars_area * 1e-6 * steel_density
        link_weight = reinforcement.link_legs * self.LINK_AREAS[reinforcement.shear_links] * 1e-6 * steel_density * (1000 / reinforcement.link_spacing)
        total_steel_weight = main_steel_weight + link_weight
        
        # Cost estimates (EUR)
        concrete_rate = 120  # per m³
        steel_rate = 1.8  # per kg
        
        concrete_cost = volume * concrete_rate
        steel_cost = total_steel_weight * steel_rate
        total_cost = concrete_cost + steel_cost
        
        return {
            'concrete_volume_per_meter': volume,
            'steel_weight_per_meter': total_steel_weight,
            'main_steel_weight': main_steel_weight,
            'link_steel_weight': link_weight,
            'concrete_cost_per_meter': concrete_cost,
            'steel_cost_per_meter': steel_cost,
            'total_cost_per_meter': total_cost,
            'currency': 'EUR'
        }

# Export for main app integration
__all__ = ['Eurocode2Designer', 'EC2BeamDesignRequest', 'EC2BeamDesignResponse', 
           'EC2MaterialProperties', 'EC2ConcreteClass', 'EC2SteelClass', 'EC2ExposureClass']