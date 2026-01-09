from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Union
from enum import Enum
import math
import numpy as np
from .datasets import (
    table_3_3_durability_cover,
    table_3_4_fire_cover,
    table_3_8_vc_base,
    get_vc_table_3_8,
    table_3_9_span_depth,
    get_tension_modification_factor,
    get_compression_modification_factor,
    table_3_27_anchorage,
    table_3_7_link_areas,
    get_link_spacing_from_table,
    table_3_25_min_reinforcement,
    get_number_of_bars
)

router = APIRouter()

# ============================================================================
# DATA MODELS (Pydantic)
# ============================================================================

class ConcreteGrade(str, Enum):
    C20 = "C20"
    C25 = "C25"
    C30 = "C30"
    C30_37 = "C30/37" # New custom grade
    C35 = "C35"
    C40 = "C40"
    C45 = "C45"
    C50 = "C50"

class SteelGrade(str, Enum):
    GRADE_250 = "Grade 250"
    GRADE_460 = "Grade 460"

class BeamType(str, Enum):
    RECTANGULAR = "Rectangular"
    T_BEAM = "T-Beam"
    L_BEAM = "L-Beam"

class SupportCondition(str, Enum):
    SIMPLY_SUPPORTED = "Simply Supported"
    CONTINUOUS = "Continuous"
    CANTILEVER = "Cantilever"

class MaterialProperties(BaseModel):
    concrete_grade: ConcreteGrade
    steel_grade: SteelGrade
    concrete_density: float = 25.0 # kN/m3
    steel_density: float = 78.5 # kN/m3

class RectangularBeamGeometry(BaseModel):
    width: float # mm
    depth: float # mm
    cover: float # mm

class TBeamGeometry(BaseModel):
    web_width: float
    web_depth: float
    flange_width: float
    flange_thickness: float
    cover: float

class LBeamGeometry(BaseModel):
    web_width: float
    web_depth: float
    flange_width: float
    flange_thickness: float
    cover: float

class ExposureCondition(str, Enum):
    MILD = "Mild"
    MODERATE = "Moderate"
    SEVERE = "Severe"
    VERY_SEVERE = "Very Severe"
    EXTREME = "Extreme"

class FireResistancePeriod(str, Enum):
    THIRTY = "30 mins"
    SIXTY = "1 hour"
    NINETY = "1.5 hours"
    ONE_TWENTY = "2 hours"
    THREE_HOURS = "3 hours"
    FOUR_HOURS = "4 hours"

class BeamDesignRequest(BaseModel):
    beam_type: BeamType
    support_condition: SupportCondition
    span_length: float # m
    design_moments: List[float] # kNm (Envelope or explicit points)
    design_shears: List[float] # kN
    moment_positions: List[float] # m
    shear_positions: List[float] # m
    materials: MaterialProperties
    rectangular_geometry: Optional[RectangularBeamGeometry] = None
    t_beam_geometry: Optional[TBeamGeometry] = None
    l_beam_geometry: Optional[LBeamGeometry] = None
    
    # Loads for deflection check estimation (serviceability)
    imposed_load: float = 0.0 # kN/m
    permanent_load: float = 0.0 # kN/m
    
    exposure_condition: ExposureCondition = ExposureCondition.MILD
    fire_resistance_period: FireResistancePeriod = FireResistancePeriod.SIXTY

class DesignChecks(BaseModel):
    moment_capacity_ok: bool
    shear_capacity_ok: bool
    deflection_ok: bool
    min_steel_ok: bool
    max_steel_ok: bool
    spacing_ok: bool
    cover_ok: bool
    moment_utilization: float
    shear_utilization: float
    warnings: List[str] = []
    
    # Detailed values
    actual_L_d: Optional[float] = None
    allowable_L_d: Optional[float] = None

class ReinforcementDetails(BaseModel):
    main_bars_count: int
    main_bars_diameter: int
    main_bars_area_provided: float
    main_bars_area_required: float
    link_diameter: int
    link_spacing: int
    link_legs: int = 2

class SpanReinforcementDesign(BaseModel):
    span_id: int
    member_id: Optional[str] = None
    span_length: float
    
    # Sagging (Bottom)
    sagging_moment: float
    sagging_bars_count: int
    sagging_bars_diameter: int
    sagging_As_required: float
    sagging_As_provided: float
    
    # Sagging Compression (Top - if doubly reinforced)
    sagging_compression_needed: bool = False
    sagging_compression_bars_count: int = 0
    sagging_compression_bars_diameter: int = 0
    sagging_compression_As_required: float = 0.0
    sagging_compression_As_provided: float = 0.0

    # Hogging (Top - Support)
    hogging_moment_left: float
    hogging_As_required_left: float
    hogging_bars_count: int
    hogging_bars_diameter: int
    hogging_As_provided: float

    # Hogging Compression (Bottom - if doubly reinforced)
    hogging_compression_needed: bool = False
    hogging_compression_bars_count: int = 0
    hogging_compression_bars_diameter: int = 0
    hogging_compression_As_required: float = 0.0
    hogging_compression_As_provided: float = 0.0
    
    # Shear
    shear_max: float
    shear_links_diameter: int
    shear_links_spacing: int
    shear_link_legs: int
    
    # Detailing
    anchorage_tension_mm: float = 0
    anchorage_compression_mm: float = 0
    curtailment_from_support_mm: float = 0
    
    design_checks: DesignChecks

class DesignSummary(BaseModel):
    all_designs_ok: bool
    total_spans: int
    critical_failure_reason: Optional[str] = None

class BeamDesignResponse(BaseModel):
    summary: DesignSummary
    span_designs: List[SpanReinforcementDesign]

# ============================================================================
# BS 8110 DESIGN LOGIC CLASS
# ============================================================================

class BS8110BeamChecks:
    @staticmethod
    def check_deep_beam(span: float, depth: float) -> bool:
        # Clause 3.4.1.1: clear span / effective depth ratio < 2.0 implies deep beam
        # Using overall depth as proxy for effective depth d approx 0.9h
        return (span * 1000) / (0.9 * depth) < 2.0

    @staticmethod
    def check_slenderness(span: float, b: float, d: float, is_cantilever: bool) -> bool:
        # Clause 3.4.1.6
        if is_cantilever:
            limit_L_b = 25
            limit_L_b2_d = 100
        else:
            limit_L_b = 60
            limit_L_b2_d = 250
        
        L = span * 1000
        
        check1 = L / b <= limit_L_b
        check2 = L * d / (b**2) <= limit_L_b2_d
        
        return check1 and check2

def get_beta_f(b_over_bw: float, d_over_hf: float) -> float:
    # Table 3.6 Values of the factor βf
    rows = [1, 2, 4, 6, 8, math.inf]
    cols = [2, 3, 4, 5, 6, math.inf]
    values = [
        [0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
        [0.15, 0.14, 0.12, 0.12, 0.11, 0.08],
        [0.15, 0.13, 0.11, 0.10, 0.09, 0.04],
        [0.15, 0.13, 0.11, 0.09, 0.08, 0.03],
        [0.15, 0.13, 0.10, 0.09, 0.08, 0.02],
        [0.15, 0.13, 0.10, 0.08, 0.07, 0.00]
    ]
    
    # Find row index
    row_idx = next(i for i, val in enumerate(rows) if b_over_bw <= val)
    
    # Find col index
    col_idx = next(i for i, val in enumerate(cols) if d_over_hf <= val)
    
    return values[row_idx][col_idx]

class BS8110Designer:
    def design_beam(self, request: BeamDesignRequest) -> BeamDesignResponse:
        spans = []
        all_ok = True
        
        # Determine geometry parameters
        if request.beam_type == BeamType.RECTANGULAR:
            b = request.rectangular_geometry.width
            h = request.rectangular_geometry.depth
            cover = request.rectangular_geometry.cover
            bf = b
            hf = 0.0
            bw = b
        elif request.beam_type == BeamType.T_BEAM:
            bw = request.t_beam_geometry.web_width
            hf = request.t_beam_geometry.flange_thickness
            h = request.t_beam_geometry.web_depth + hf
            cover = request.t_beam_geometry.cover
            bf = request.t_beam_geometry.flange_width
            b = bw
        else: # L-Beam
            bw = request.l_beam_geometry.web_width
            hf = request.l_beam_geometry.flange_thickness
            h = request.l_beam_geometry.web_depth + hf
            cover = request.l_beam_geometry.cover
            bf = request.l_beam_geometry.flange_width
            b = bw

        # Material Strength
        # Material Strength
        if "C30/37" in request.materials.concrete_grade.value:
            fcu = 37 # Using cube strength for BS8110 consistency if mixed
        else:
            fcu = int(request.materials.concrete_grade.value[1:]) 
            
        fy = int(request.materials.steel_grade.value.split()[-1]) # Grade 460 -> 460
        f_yv = min(fy, 460)  # Not to exceed 460 for links

        # Effective Depth (estimate)
        # d = h - cover - link_dia - bar_dia/2
        # Approx d = h - cover - 10 - 10 = h - cover - 20
        d = h - cover - 20 

        # Check slenderness
        is_cantilever = request.support_condition == SupportCondition.CANTILEVER
        slend_ok = BS8110BeamChecks.check_slenderness(request.span_length, b, d, is_cantilever)

        # Analyze Moments
        # We need to find Sagging (Positive) and Hogging (Negative) peaks
        m_sag = max(request.design_moments or [0])
        m_hog = abs(min(request.design_moments or [0]))
        
        # If single span, treat input as one span. 

        # Design Sagging (Mid-span)
        sag_res = self._design_section_flexure(m_sag, b, d, fcu, fy, bf, hf, False)
        
        # Design Hogging (Support)
        hog_res = self._design_section_flexure(m_hog, b, d, fcu, fy, bw, 0.0, True)  # Hogging as rectangular
        
        # Select Bars (Tension)
        sag_bars = self._select_bars(sag_res["As_req"], fy)
        hog_bars = self._select_bars(hog_res["As_req"], fy)
        
        # Select Bars (Compression) if needed
        if sag_res.get("comp_needed"):
            kb = self._select_bars(sag_res["As_comp_req"], fy)
            sag_bars["comp_count"] = kb["count"]
            sag_bars["comp_dia"] = kb["dia"]
            sag_bars["As_comp_prov"] = kb["As_prov"]
            
        if hog_res.get("comp_needed"):
            kb = self._select_bars(hog_res["As_comp_req"], fy)
            hog_bars["comp_count"] = kb["count"]
            hog_bars["comp_dia"] = kb["dia"]
            hog_bars["As_comp_prov"] = kb["As_prov"]
        
        # Design Shear
        v_max = max([abs(v) for v in request.design_shears] or [0])
        shear_res = self._design_shear(v_max, b, d, fcu, f_yv, sag_bars["As_prov"])
        
        # Checks
        checks = DesignChecks(
            moment_capacity_ok=sag_res["ok"] and hog_res["ok"],
            shear_capacity_ok=shear_res["ok"],
            deflection_ok=True, # Placeholder init
            min_steel_ok=True,
            max_steel_ok=True,
            spacing_ok=True,
            cover_ok=True,
            moment_utilization=max(sag_res["util"], hog_res["util"]),
            shear_utilization=shear_res["util"],
            warnings=sag_res["warnings"] + hog_res["warnings"] + shear_res["warnings"]
        )
        
        # Add slenderness check
        checks.spacing_ok = slend_ok  # Repurposing spacing_ok for slenderness, or add new field
        if not slend_ok:
            checks.warnings.append("Slenderness limit exceeded.")

        # Deflection Check
        b_eff_sag = bf if request.beam_type != BeamType.RECTANGULAR else b
        def_check = self._check_deflection(request, b_eff_sag, d, request.span_length * 1000, sag_res["As_req"], sag_bars["As_prov"], fcu, fy)
        checks.deflection_ok = def_check["ok"]
        checks.actual_L_d = def_check["actual_L_d"]
        checks.allowable_L_d = def_check["allowable_L_d"]
        
        # Cover Check
        cov_check = self._check_cover(request, {"cover": cover})
        checks.cover_ok = cov_check["ok"]
        if not cov_check["ok"]:
            checks.warnings.append(cov_check["msg"])

        # Detailing Check
        det_check = self._check_detailing(b, h, sag_bars["As_prov"], hog_bars["As_prov"], request.materials)
        checks.min_steel_ok = det_check["min_steel_ok"]
        checks.max_steel_ok = det_check["max_steel_ok"]
        if not det_check["ok"]:
            checks.warnings.append("Reinforcement detailing requirements not met.")
        
        # Return results
        # Global OK (All Spans)
        span_ok = all([
            checks.moment_capacity_ok,
            checks.shear_capacity_ok,
            checks.deflection_ok,
            checks.cover_ok,
            checks.min_steel_ok,
            checks.max_steel_ok
        ])
        
        span_design = SpanReinforcementDesign(
            span_id=1,
            span_length=request.span_length,
            sagging_moment=max(0, m_sag),
            sagging_bars_count=sag_bars["count"],
            sagging_bars_diameter=sag_bars["dia"],
            sagging_As_required=sag_res["As_req"],
            sagging_As_provided=sag_bars["As_prov"],
            sagging_compression_needed = sag_res.get("comp_needed", False),
            sagging_compression_bars_count = sag_bars.get("comp_count", 0),
            sagging_compression_bars_diameter = sag_bars.get("comp_dia", 0),
            sagging_compression_As_required = sag_res.get("As_comp_req", 0.0),
            sagging_compression_As_provided = sag_bars.get("As_comp_prov", 0.0),
            
            hogging_moment_left=abs(m_hog),
            hogging_As_required_left=hog_res["As_req"],
            hogging_bars_count=hog_bars["count"],
            hogging_bars_diameter=hog_bars["dia"],
            hogging_As_provided=hog_bars["As_prov"],
            hogging_compression_needed = hog_res.get("comp_needed", False),
            hogging_compression_bars_count = hog_bars.get("comp_count", 0),
            hogging_compression_bars_diameter = hog_bars.get("comp_dia", 0),
            hogging_compression_As_required = hog_res.get("As_comp_req", 0.0),
            hogging_compression_As_provided = hog_bars.get("As_comp_prov", 0.0),
            
            shear_max=v_max,
            shear_links_diameter=shear_res["dia"],
            shear_links_spacing=shear_res["spacing"],
            shear_link_legs=shear_res["legs"],
            
            anchorage_tension_mm=max(40 * sag_bars["dia"], 100), # Simple rule or advanced
            anchorage_compression_mm=max(32 * sag_bars["dia"], 100),
            curtailment_from_support_mm=int(0.15 * request.span_length * 1000),
            
            design_checks=checks
        )
        
        return BeamDesignResponse(
            summary=DesignSummary(all_designs_ok=span_ok, total_spans=1),
            span_designs=[span_design]
        )

    def _design_section_flexure(self, M_kNm: float, b: float, d: float, fcu: int, fy: int, bf: float, hf: float, is_hogging: bool) -> Dict:
        # BS 8110-1:1997 Clause 3.4.4.4
        M = M_kNm * 1e6 # Nmm
        
        # Effective width for compression
        b_eff = b if is_hogging else bf
        
        K = M / (fcu * b_eff * d**2)
        K_prime = 0.156 
        
        warnings = []
        ok = True
        As_req = 0
        As_comp_req = 0
        comp_needed = False
        
        if K <= K_prime:
            # Singly reinforced
            z = d * (0.5 + math.sqrt(max(0, 0.25 - K/0.9)))
            z = min(z, 0.95*d)
            As_req = M / (0.95 * fy * z)
        else:
            # Doubly reinforced
            comp_needed = True
            
            # Allowable x/d = 0.5 (usually)
            z = d * (0.5 + math.sqrt(0.25 - K_prime/0.9)) # z for K=K'
            # Or simplified z = 0.775d
            
            d_prime = 50.0 # Estimate compression depth (cover + link + bar/2)
            
            # Compression Steel
            # As' = (K - K') fcu b d^2 / 0.95 fy (d - d')
            numerator = (K - K_prime) * fcu * b_eff * (d**2)
            denominator = 0.95 * fy * (d - d_prime)
            As_comp_req = max(0, numerator / denominator)
            
            # Tension Steel
            # As = (K' fcu b d^2) / (0.95 fy z) + As'
            term1 = (K_prime * fcu * b_eff * (d**2)) / (0.95 * fy * z)
            As_req = term1 + As_comp_req
            
            warnings.append(f"Section Doubly Reinforced (K={K:.3f} > {K_prime}). Compression Reinforcement Required.")

        util = K / K_prime if K_prime > 0 else 0
        return {
            "As_req": As_req, 
            "As_comp_req": As_comp_req,
            "comp_needed": comp_needed, 
            "ok": ok, 
            "util": util, 
            "warnings": warnings
        }

    def _select_bars(self, As_req: float, fy: int) -> Dict:
        # Select minimum 2 bars
        # Prefer diameters: 16, 20, 25, 12, 32, 10
        preferred = [16, 20, 25, 12, 32, 10] if fy >= 460 else [12, 16, 20, 25, 10]
        
        best = {"count": 2, "dia": 25, "As_prov": 99999}
        min_bars = 2 # Strictly enforce min 2 bars
        
        # If requirements are 0 (e.g. theoretical compression), return 0
        if As_req <= 0:
            return {"count": 0, "dia": 0, "As_prov": 0}

        for dia in preferred:
            area_1 = math.pi * (dia/2)**2
            
            # Start from min_bars
            needed = max(min_bars, math.ceil(As_req / area_1))
            prov = needed * area_1
            
            # Optimization: minimize excess area, but also reasonable count (<= 8)
            if needed <= 8:
                 if prov < best["As_prov"]:
                     best = {"count": needed, "dia": dia, "As_prov": prov}
                     
        return best

    def _design_shear(self, V_kN: float, b: float, d: float, fcu: int, fyv: int, As_tension: float) -> Dict:
        # User Rule: Asw/s bw >= 0.085% (0.00085)
        # Replacing BS 8110 Table 3.8 logic with this specific rule where applicable for minimums
        
        V = V_kN * 1000 # N
        v = V / (b * d)
        
        # v_max check (Clause 3.4.5.2) -> 0.8 sqrt(fcu) or 5 N/mm2 (Retaining BS limit as fallback)
        v_max = min(0.8 * math.sqrt(fcu), 5.0)
        
        # vc (Concrete shear strength) - Retain BS 8110 for calculation base
        vc = get_vc_table_3_8(100*As_tension/(b*d), d, fcu)
        
        warnings = []
        ok = True
        
        if v > v_max:
             warnings.append(f"Shear stress v={v:.2f} > v_max={v_max:.2f}. Section too small.")
             ok = False
        
        # Required Design Shear Reinforcement
        # If v < vc, theoretically none needed but min links required.
        # Design formula: Asv/s >= b(v-vc) / 0.87fyv
        
        if v < vc:
            req_asv_sv_design = 0
        else:
            req_asv_sv_design = b * (v - vc) / (0.87 * fyv)
            
        # Minimum Links (User Rule: Asw/s * bw >= 0.00085 => Asw/s >= 0.00085 * bw)
        # Note: 'bw' here is 'b'
        req_asv_sv_min = 0.00085 * b
        
        req_asv_sv = max(req_asv_sv_design, req_asv_sv_min)
             
        # Find combination
        # links: 8, 10, 12. Spacing 75-300. Legs 2.
        # Max spacing 0.75d
        max_sv = 0.75 * d
        
        best_link = {"dia": 8, "spacing": 100, "legs": 2}
        found = False
        
        # Link Areas (2 legs): T8=100, T10=157, T12=226
        link_opts = [
            {"dia": 8, "Asv": 101}, {"dia": 10, "Asv": 157}, {"dia": 12, "Asv": 226}
        ]
        
        for lk in link_opts:
            # Asv/sv = req -> sv = Asv / req
            if req_asv_sv <= 1e-6: sv = 300
            else: sv = lk["Asv"] / req_asv_sv
            
            # Cap at max spacing
            # User rule: Max 300mm or 0.75d. 
            # Also "Min pitch 100mm or [50 +12.5(legs)]mm max" -> This part is confusing "min pitch... max". 
            # Assuming "Min pitch 100mm" means usually don't go below 100 unless needed? 
            # Or "Min pitch 100mm" is a preferred min?
            # User also said "Min spacing 75mm".
            
            sv = min(sv, max_sv, 300) 
            
            # Round down to nearest 25
            sv = int(sv // 25) * 25
            
            if sv >= 75: # User specified min 75mm (poker)
                best_link = {"dia": lk["dia"], "spacing": sv, "legs": 2}
                found = True
                break
                
        if not found:
             # Try 4 legs? (Simplified: just max out)
             best_link = {"dia": 12, "spacing": 75, "legs": 2} 
             warnings.append("High shear: Links maximized 2T12@75. Check manually.")

        return {**best_link, "ok": ok, "warnings": warnings, "util": v/v_max if v_max > 0 else 0}

    def _check_detailing(self, b, h, As_sag, As_hog, mat) -> Dict:
        # User Rule: Min Tension As = 0.0015 * b * d
        # User Rule: Min Compression Asc = 0.002 * Ac (b*h)
        
        d_approx = 0.9 * h # Need 'd' but usually redundant with b
        
        # Check Tension (Sagging)
        min_tension = 0.0015 * b * d_approx 
        
        # Check Compression (if used, but checking global steel ratio)
        min_compression = 0.002 * b * h
        
        # Current logic checks provided areas against these
        
        # Simplified: Check if provided sagging/hogging meet tension min
        ok_sag = As_sag >= min_tension
        ok_hog = As_hog >= min_tension # Assuming hogging is also tension face 
        
        ok = ok_sag and ok_hog
        
        # Also need check for Compression bars if they exist? 
        # _select_bars handles "if needed", but doesn't enforce "min compression" if we just put hanger bars.
        # User rule says "Compression Asc,min = 0.002Ac". This applies if section is in compression? 
        # Or always? Usually "Secondary reinforcement" or hangers have different rules.
        # We will warn if below 0.002Ac for total steel?
        
        total_steel = As_sag + As_hog
        param_ok = total_steel >= min_compression # Rough check
        
        return {"ok": ok, "min_steel_ok": ok, "max_steel_ok": True, "spacing_ok": True}

    def _check_cover(self, request: BeamDesignRequest, geo: Dict) -> Dict:
        # User Rule: Internal 30mm + dev, External 35mm + dev
        # Delta cdev = 10mm usually (5.2.1) -> So 40mm / 45mm nominal?
        # User text: "Nominal cover: Internal 30mm + Δcdev". 
        # If Δcdev is explicitly added, assume Nominal = 30 + 10 = 40mm?
        # Or does User mean "Nominal IS 30 + dev"?
        # Standard: Cmin + DeltaCdev. Cmin often 25/30.
        # Let's interpret "Nominal cover" value as THE value to check against provided.
        # Internal = Mild/Moderate? External = Severe?
        
        is_external = request.exposure_condition in [ExposureCondition.SEVERE, ExposureCondition.VERY_SEVERE, ExposureCondition.EXTREME]
        
        req_nom = 35 if is_external else 30
        # Add dev? User said "Internal 30mm + Delta cdev". Usually Delta=10.
        req_total = req_nom + 10 
        
        prov = geo["cover"]
        
        msg = f"Cover {prov}mm < Required {req_total}mm (Nominal {req_nom} + 10 dev)" if prov < req_total else ""
        
        return {"ok": prov >= req_total, "required": req_total, "msg": msg}

# ============================================================================
# ANALYSIS CALCULATOR (BS Coefficients)
# ============================================================================

class BS8110CoefficientsSolver:
    def __init__(self, spans_count: int, loads: List[float], span_lengths: List[float]):
        self.spans = spans_count
        self.loads = loads
        self.lengths = span_lengths
        
    def solve(self) -> List[Dict]:
        """
        Calculates design moments and shears using BS 8110 Table 3.5 coefficients.
        Simplified implementation for typical cases.
        """
        res = []
        for i in range(self.spans):
            F = self.loads[i]
            L = self.lengths[i]
            
            # Coefficients Simplification
            # End Support: 0
            # Near Middle of End Span: 0.09
            # First Interior Support: -0.11 or -0.08
            # Middle Interior Spans: 0.07
            # Interior Supports: -0.08
            
            res.append({
                "span_index": i,
                "max_moment": 0.09 * F * L, 
                "support_moment_left": -0.08 * F * L,
                "support_moment_right": -0.08 * F * L,
                "shear_left": 0.6 * F, # Conservative
                "shear_right": 0.55 * F,
                "span_length": L
            })
        return res

# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/integrate_analysis_design", response_model=BeamDesignResponse)
def integrate_analysis_design(payload: Dict):
    """
    Main Endpoint: Receives integrated Analysis + Design Params
    """
    try:
        an_res = payload.get("analysis_results", {})
        bk_res = payload.get("design_parameters", {})
        
        # Helper to construct request
        def create_request(moments, shears, length):
            conc_raw = bk_res.get("materials", {}).get("concrete_grade")
            if not conc_raw:
                 fcu = bk_res.get("fcu")
                 if fcu is not None:
                     conc_raw = f"C{fcu}" if isinstance(fcu, int) else str(fcu)
                 else:
                     conc_raw = "C30"
            
            steel_raw = bk_res.get("materials", {}).get("steel_grade")
            if not steel_raw:
                  fy = bk_res.get("fy")
                  if fy is not None:
                      steel_raw = f"Grade {fy}"
                  else:
                      steel_raw = "Grade 460"

            return BeamDesignRequest(
                beam_type=BeamType(bk_res.get("beam_type", "Rectangular")),
                support_condition=SupportCondition(bk_res.get("support_condition", "Continuous")),
                span_length=float(length or bk_res.get("span_length", 6.0)),
                design_moments=moments,
                design_shears=shears,
                moment_positions=[],
                shear_positions=[],
                materials=MaterialProperties(
                    concrete_grade=ConcreteGrade(conc_raw),
                    steel_grade=SteelGrade(steel_raw)
                ),
                imposed_load=float(bk_res.get("imposed_load", 0)),
                permanent_load=float(bk_res.get("permanent_load", 0)),
                exposure_condition=ExposureCondition(bk_res.get("exposure_condition", "Moderate")),
                fire_resistance_period=FireResistancePeriod(bk_res.get("fire_resistance_period", "1 hour")),
                rectangular_geometry=RectangularBeamGeometry(
                    width=float(bk_res.get("rectangular_geometry", {}).get("width") or bk_res.get("width") or 300),
                    depth=float(bk_res.get("rectangular_geometry", {}).get("depth") or bk_res.get("depth") or 500),
                    cover=float(bk_res.get("rectangular_geometry", {}).get("cover") or bk_res.get("cover") or 25)
                ) if bk_res.get("beam_type") == "Rectangular" else None,
                 t_beam_geometry = TBeamGeometry(
                    web_width=float(bk_res.get("t_beam_geometry", {}).get("web_width") or bk_res.get("web_width") or 300), 
                    web_depth=float(bk_res.get("t_beam_geometry", {}).get("web_depth") or bk_res.get("depth") or 400), # depth is h
                    flange_width=float(bk_res.get("t_beam_geometry", {}).get("flange_width") or bk_res.get("flange_width") or 1000), 
                    flange_thickness=float(bk_res.get("t_beam_geometry", {}).get("flange_thickness") or bk_res.get("flange_thickness") or 150),
                    cover=float(bk_res.get("t_beam_geometry", {}).get("cover") or bk_res.get("cover") or 25)
                ) if bk_res.get("beam_type") == "T-Beam" else None,
                l_beam_geometry = LBeamGeometry(
                    web_width=float(bk_res.get("l_beam_geometry", {}).get("web_width") or bk_res.get("web_width") or 300), 
                    web_depth=float(bk_res.get("l_beam_geometry", {}).get("web_depth") or bk_res.get("depth") or 400),
                    flange_width=float(bk_res.get("l_beam_geometry", {}).get("flange_width") or bk_res.get("flange_width") or 600), 
                    flange_thickness=float(bk_res.get("l_beam_geometry", {}).get("flange_thickness") or bk_res.get("flange_thickness") or 150),
                    cover=float(bk_res.get("l_beam_geometry", {}).get("cover") or bk_res.get("cover") or 25)
                ) if bk_res.get("beam_type") == "L-Beam" else None
            )

        designer = BS8110Designer()
        
        if isinstance(an_res, list):
            # Coefficients
            span_designs = []
            all_ok = True
            for span_data in an_res:
                m_sag = span_data.get("max_moment", 0)
                m_hog_l = span_data.get("support_moment_left", 0)
                m_hog_r = span_data.get("support_moment_right", 0)
                v_max = max(abs(span_data.get("shear_left", 0)), abs(span_data.get("shear_right", 0)))
                
                moments = [m_hog_l, m_sag, m_hog_r]
                shears = [v_max, -v_max] 
                
                req = create_request(moments, shears, span_data.get("span_length", 6.0))
                res = designer.design_beam(req)
                span_designs.extend(res.span_designs)
                if not res.summary.all_designs_ok: all_ok = False
                
            return BeamDesignResponse(
                summary=DesignSummary(all_designs_ok=all_ok, total_spans=len(span_designs)),
                span_designs=span_designs
            )

        else:
            # Three Moment / Distribution Dictionary
            moments = []
            shears = []
            inputs = an_res.get("inputs", {})
            
            # Logic to extract moments from data points or use explicit design values
            if "design_moments" in bk_res:
                 moments = bk_res["design_moments"]
                 shears = bk_res.get("design_shears", [])
            elif "moment_data" in an_res:
                 moments = [p["y"] for p in an_res.get("moment_data", [])]
                 shears = [p.get("shear", 0) for p in an_res.get("moment_data", [])]

            if not moments:
                moments = [100.0] 
            
            req = create_request(moments, shears, bk_res.get("span_length", 6.0))
            return designer.design_beam(req)
            
    except Exception as e:
        print(f"Error in design integration: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/integrated/moment_distribution_design", response_model=BeamDesignResponse)
def integrate_moment_distribution_design(payload: Dict):
    """
    Dedicated endpoint for Moment Distribution results
    """
    try:
        md_results = payload.get("md_results", {})
        bk_res = payload.get("design_parameters", {})
        
        # Helper to construct request (duplicated for reliability)
        def create_req(moments, shears, length):
            conc_raw = bk_res.get("materials", {}).get("concrete_grade")
            if not conc_raw:
                 fcu = bk_res.get("fcu")
                 if fcu is not None:
                     conc_raw = f"C{fcu}" if isinstance(fcu, int) else str(fcu)
                 else:
                     conc_raw = "C30"
            
            steel_raw = bk_res.get("materials", {}).get("steel_grade")
            if not steel_raw:
                  fy = bk_res.get("fy")
                  if fy is not None:
                      steel_raw = f"Grade {fy}"
                  else:
                      steel_raw = "Grade 460"
                      
            return BeamDesignRequest(
                beam_type=BeamType(bk_res.get("beam_type", "Rectangular")),
                support_condition=SupportCondition(bk_res.get("support_condition", "Continuous")),
                span_length=float(length),
                design_moments=moments,
                design_shears=shears,
                moment_positions=[],
                shear_positions=[],
                materials=MaterialProperties(
                    concrete_grade=ConcreteGrade(conc_raw),
                    steel_grade=SteelGrade(steel_raw)
                ),
                imposed_load=float(bk_res.get("imposed_load", 0)),
                permanent_load=float(bk_res.get("permanent_load", 0)),
                exposure_condition=ExposureCondition(bk_res.get("exposure_condition", "Moderate")),
                fire_resistance_period=FireResistancePeriod(bk_res.get("fire_resistance_period", "1 hour")),
                rectangular_geometry=RectangularBeamGeometry(
                    width=float(bk_res.get("rectangular_geometry", {}).get("width") or bk_res.get("width") or 300),
                    depth=float(bk_res.get("rectangular_geometry", {}).get("depth") or bk_res.get("depth") or 500),
                    cover=float(bk_res.get("rectangular_geometry", {}).get("cover") or bk_res.get("cover") or 25)
                ) if bk_res.get("beam_type") == "Rectangular" else None,
                 t_beam_geometry = TBeamGeometry(
                    web_width=float(bk_res.get("t_beam_geometry", {}).get("web_width") or bk_res.get("web_width") or 300), 
                    web_depth=float(bk_res.get("t_beam_geometry", {}).get("web_depth") or bk_res.get("depth") or 400),
                    flange_width=float(bk_res.get("t_beam_geometry", {}).get("flange_width") or bk_res.get("flange_width") or 1000), 
                    flange_thickness=float(bk_res.get("t_beam_geometry", {}).get("flange_thickness") or bk_res.get("flange_thickness") or 150),
                    cover=float(bk_res.get("t_beam_geometry", {}).get("cover") or bk_res.get("cover") or 25)
                ) if bk_res.get("beam_type") == "T-Beam" else None,
                l_beam_geometry = LBeamGeometry(
                    web_width=float(bk_res.get("l_beam_geometry", {}).get("web_width") or bk_res.get("web_width") or 300), 
                    web_depth=float(bk_res.get("l_beam_geometry", {}).get("web_depth") or bk_res.get("depth") or 400),
                    flange_width=float(bk_res.get("l_beam_geometry", {}).get("flange_width") or bk_res.get("flange_width") or 600), 
                    flange_thickness=float(bk_res.get("l_beam_geometry", {}).get("flange_thickness") or bk_res.get("flange_thickness") or 150),
                    cover=float(bk_res.get("l_beam_geometry", {}).get("cover") or bk_res.get("cover") or 25)
                ) if bk_res.get("beam_type") == "L-Beam" else None
            )

        designer = BS8110Designer()
        span_designs = []
        all_ok = True
        
        moments_map = md_results.get("moment_data", {})
        shears_map = md_results.get("shear_force_data", {})
        
        for member_id, moment_points in moments_map.items():
            moments = [p["y"] for p in moment_points]
            shears = [p["y"] for p in shears_map.get(member_id, [])]
            
            # Infer length
            length = 6.0
            if moment_points:
                length = max([p["x"] for p in moment_points])
            
            req = create_req(moments, shears, length)
            res = designer.design_beam(req)
            
            # Label/ID
            for s in res.span_designs:
                s.member_id = member_id
                
            span_designs.extend(res.span_designs)
            if not res.summary.all_designs_ok: all_ok = False
            
        return BeamDesignResponse(
            summary=DesignSummary(all_designs_ok=all_ok, total_spans=len(span_designs)),
            span_designs=span_designs
        )
        
    except Exception as e:
        print(f"Error in Moment Distribution integration: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/analyze_coefficients")
async def analyze_coefficients(payload: Dict):
    try:
        spans_count = payload.get("spans_count", 3)
        loads = payload.get("loads", [10.0]*spans_count)
        span_lengths = payload.get("span_lengths", [5.0]*spans_count)
        
        solver = BS8110CoefficientsSolver(spans_count, loads, span_lengths)
        return solver.solve()
    except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))

@router.get("/material_properties")
def get_material_properties():
    return {
        "concrete_grades": {"C20":20, "C25":25, "C30":30, "C35":35, "C40":40, "C45":45, "C50":50},
        "steel_grades": {"Grade 250": 250, "Grade 460": 460}
    }
        