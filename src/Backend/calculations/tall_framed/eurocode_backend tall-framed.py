from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import math
import numpy as np
from datetime import datetime

app = FastAPI(
    title="Eurocode Structural Design API",
    description="EN 1990, EN 1991, EN 1992, EN 1998 Compliant Calculations",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# EN 1992: SHEAR DESIGN
# ============================================================================

@app.post("/api/eurocode/design/shear", response_model=ShearDesignResponse)
async def design_shear_reinforcement(request: ShearDesignRequest):
    """
    Design shear reinforcement according to EN 1992-1-1 Section 6.2
    """
    
    concrete = EurocodeTables.CONCRETE_CLASSES[request.concrete_class]
    steel = EurocodeTables.STEEL_CLASSES[request.steel_class]
    
    fck = concrete['fck']
    fcd = EurocodeTables.MATERIAL_FACTORS['concrete']['alpha_cc'] * fck / EurocodeTables.MATERIAL_FACTORS['concrete']['gamma_c']
    fyk = steel['fyk']
    fywd = fyk / EurocodeTables.MATERIAL_FACTORS['steel']['gamma_s']
    
    bw = request.width
    d = request.effective_depth
    Ved = request.ved * 1000  # Convert kN to N
    Asl = request.asl if request.asl > 0 else 0.02 * bw * d  # Assumed 2% if not provided
    cot_theta = request.cot_theta
    
    # EN 1992-1-1 6.2.2: Members not requiring design shear reinforcement
    # VRd,c calculation
    rho1 = min(Asl / (bw * d), 0.02)
    k = min(1 + math.sqrt(200 / d), 2.0)
    
    # CRd,c = 0.18/γc (EN 1992-1-1 6.2.2(1))
    CRd_c = 0.18 / 1.5
    
    # vmin = 0.035 · k^(3/2) · fck^(1/2)
    vmin = 0.035 * pow(k, 1.5) * math.sqrt(fck)
    
    # VRd,c = [CRd,c·k·(100·ρ1·fck)^(1/3)]·bw·d ≥ vmin·bw·d
    VRd_c = max(
        CRd_c * k * pow(100 * rho1 * fck, 1/3) * bw * d,
        vmin * bw * d
    )
    
    # EN 1992-1-1 6.2.3: Members requiring design shear reinforcement
    # VRd,max - crushing of compression struts
    # αcw = 1.0 for non-prestressed structures
    alpha_cw = 1.0
    
    # ν1 = 0.6(1 - fck/250) for fck in MPa
    nu1 = 0.6 * (1 - fck / 250)
    
    theta_rad = math.atan(1 / cot_theta)
    
    # VRd,max = αcw·bw·z·ν1·fcd/(cotθ + tanθ)
    z = 0.9 * d
    VRd_max = alpha_cw * bw * z * nu1 * fcd / (cot_theta + math.tan(theta_rad))
    
    # Design shear reinforcement
    shear_reinforcement = {}
    
    if Ved <= VRd_c:
        # Minimum shear reinforcement (EN 1992-1-1 9.2.2)
        rho_w_min = 0.08 * math.sqrt(fck) / fyk
        Asw_s_min = rho_w_min * bw
        
        # Using Ø8 links (2 legs)
        Asw = 2 * 50.3  # mm²
        s_max = min(Asw / Asw_s_min, 0.75 * d, 300)
        
        shear_reinforcement = {
            'required': False,
            'minimum_links': f"Ø8 @ {int(s_max)}mm (minimum)",
            'asw_s': round(Asw_s_min, 3)
        }
        
    elif Ved <= VRd_max:
        # Shear reinforcement required
        # Asw/s = VEd/(z·fywd·cotθ)
        Asw_s = Ved / (z * fywd * cot_theta)
        
        # Select link size and spacing
        link_options = {8: 50.3, 10: 78.5, 12: 113}
        
        selected_link = None
        for dia, area_single in link_options.items():
            Asw = 2 * area_single  # 2 legs
            spacing = Asw / Asw_s
            
            # Check maximum spacing (EN 1992-1-1 9.2.2(6))
            s_max = min(0.75 * d, 300)
            
            if spacing <= s_max:
                selected_link = {
                    'diameter': dia,
                    'legs': 2,
                    'area': Asw,
                    'spacing': int(min(spacing, s_max))
                }
                break
        
        if not selected_link:
            selected_link = {
                'diameter': 12,
                'legs': 2,
                'area': 2 * 113,
                'spacing': 150
            }
        
        # Minimum shear reinforcement check
        rho_w_min = 0.08 * math.sqrt(fck) / fyk
        Asw_s_min = rho_w_min * bw
        
        shear_reinforcement = {
            'required': True,
            'link_arrangement': f"Ø{selected_link['diameter']} @ {selected_link['spacing']}mm",
            'asw_s_provided': round(selected_link['area'] / selected_link['spacing'], 3),
            'asw_s_required': round(Asw_s, 3),
            'asw_s_minimum': round(Asw_s_min, 3),
            'cot_theta_used': cot_theta
        }
    else:
        shear_reinforcement = {
            'required': True,
            'status': 'FAIL - Section inadequate',
            'recommendation': 'Increase section depth or width'
        }
    
    utilization = Ved / VRd_c if VRd_c > 0 else 999
    design_status = 'PASS' if Ved <= VRd_max else 'FAIL - Increase section'
    
    return ShearDesignResponse(
        applied_shear=round(Ved / 1000, 2),
        concrete_capacity_vrd_c=round(VRd_c / 1000, 2),
        max_capacity_vrd_max=round(VRd_max / 1000, 2),
        shear_reinforcement=shear_reinforcement,
        utilization_ratio=round(utilization, 3),
        design_status=design_status
    )

# ============================================================================
# EN 1991-1-4: WIND ACTIONS
# ============================================================================

@app.post("/api/eurocode/actions/wind", response_model=WindActionResponse)
async def calculate_wind_actions(request: WindActionRequest):
    """
    Calculate wind actions according to EN 1991-1-4
    """
    
    vb_0 = request.basic_wind_velocity
    cdir = request.direction_factor
    cseason = request.season_factor
    co = request.orography_factor
    z = request.building_height
    b = request.building_width
    d = request.building_depth
    
    terrain = EurocodeTables.TERRAIN_CATEGORIES[request.terrain_category]
    z0 = terrain['z0']
    zmin = terrain['zmin']
    
    # EN 1991-1-4 4.3.1: Roughness coefficient
    kr = 0.19 * pow(z0 / 0.05, 0.07)
    
    # Basic wind velocity (EN 1991-1-4 4.2)
    vb = cdir * cseason * vb_0
    
    # Mean wind velocity (EN 1991-1-4 4.3.1)
    z_effective = max(z, zmin)
    cr_z = kr * math.log(z_effective / z0)
    vm_z = cr_z * co * vb
    
    # Turbulence intensity (EN 1991-1-4 4.4)
    kI = 1.0  # Recommended value
    Iv_z = kI / (co * math.log(z_effective / z0))
    
    # Peak velocity pressure (EN 1991-1-4 4.5)
    rho = 1.25  # kg/m³ air density
    ce_z = (1 + 7 * Iv_z) * cr_z * cr_z  # Exposure factor
    qp_z = ce_z * 0.5 * rho * vb * vb / 1000  # kN/m²
    
    # Pressure coefficients (EN 1991-1-4 7.2 - simplified for rectangular building)
    h_to_d = z / d
    
    # External pressure coefficients (simplified)
    if h_to_d <= 1:
        cpe_windward = 0.8
        cpe_leeward = -0.5
    elif h_to_d <= 5:
        cpe_windward = 0.8
        cpe_leeward = -0.5 - 0.1 * (h_to_d - 1)
    else:
        cpe_windward = 0.8
        cpe_leeward = -0.7
    
    cpe_side = -0.7
    cpe_roof = -0.6  # Flat roof
    
    # Internal pressure coefficient (EN 1991-1-4 7.2.9)
    cpi = 0.2  # Assuming some openings
    
    # Net pressure coefficient
    cp_net = cpe_windward - cpe_leeward
    
    # Structural factor cscd (EN 1991-1-4 6.2 - simplified)
    # For simple buildings, cscd can be taken as 1.0
    cscd = 1.0
    
    # Wind force (EN 1991-1-4 5.3)
    # Fw = cscd · cf · qp(ze) · Aref
    cf = cp_net  # Force coefficient
    Aref = b * z  # Reference area
    Fw = cscd * cf * qp_z * Aref
    
    # Base moment
    # Assuming uniform pressure distribution
    Mb = Fw * z / 2
    
    return WindActionResponse(
        basic_wind_velocity=round(vb, 2),
        mean_wind_velocity=round(vm_z, 2),
        peak_velocity_pressure=round(qp_z, 3),
        turbulence_intensity=round(Iv_z * 100, 1),
        pressure_coefficients={
            'windward': cpe_windward,
            'leeward': cpe_leeward,
            'side': cpe_side,
            'roof': cpe_roof,
            'internal': cpi,
            'net': round(cp_net, 2)
        },
        wind_force=round(Fw, 2),
        base_moment=round(Mb, 2),
        structural_factor=cscd
    )

# ============================================================================
# EN 1998: SEISMIC DESIGN
# ============================================================================

@app.post("/api/eurocode/design/seismic", response_model=SeismicDesignResponse)
async def calculate_seismic_design(request: SeismicDesignRequest):
    """
    Seismic design according to EN 1998-1
    """
    
    agR = request.design_ground_acceleration / 100  # Convert % to decimal
    g = 9.81  # m/s²
    ag = agR * g
    
    # Importance factor (EN 1998-1 Table 4.3)
    importance_factors = {
        'I': 0.8,   # Low importance
        'II': 1.0,  # Normal importance
        'III': 1.2, # High importance
        'IV': 1.4   # Critical importance
    }
    gamma_I = importance_factors[request.importance_class]
    
    # Design ground acceleration
    ag_design = gamma_I * ag
    
    # Soil parameters (EN 1998-1 Table 3.2)
    soil = EurocodeTables.SOIL_TYPES[request.soil_type]
    S = soil['S']
    TB = soil['TB']
    TC = soil['TC']
    TD = soil['TD']
    
    # Behavior factor q (EN 1998-1 5.2.2.2)
    q_factors = {
        'DCL': {'moment_frame': 1.5, 'wall': 1.5, 'dual': 1.5},
        'DCM': {'moment_frame': 3.0, 'wall': 3.0, 'dual': 3.0},
        'DCH': {'moment_frame': 4.5, 'wall': 4.0, 'dual': 4.5}
    }
    
    system_type = request.structural_system
    if system_type == 'moment_frame':
        q_base = q_factors[request.ductility_class]['moment_frame']
    elif system_type == 'shear_wall':
        q_base = q_factors[request.ductility_class]['wall']
    else:
        q_base = q_factors[request.ductility_class]['dual']
    
    # Regularity factor (assumed regular in plan and elevation)
    kw = 1.0
    q = q_base * kw
    
    # Fundamental period (EN 1998-1 4.3.3.2.2)
    H = request.building_height
    
    # Method 1: Simplified formula
    # T1 = Ct · H^(3/4)
    if system_type == 'moment_frame':
        Ct = 0.075  # RC moment frames
    elif system_type == 'shear_wall':
        Ct = 0.050  # RC shear walls
    else:
        Ct = 0.075
    
    T1 = Ct * pow(H, 0.75)
    
    # Design spectrum (EN 1998-1 3.2.2.5)
    eta = math.sqrt(10 / (5 + 5))  # Damping correction factor (5% damping, η = 1.0)
    
    # Calculate spectral acceleration Sd(T)
    def calculate_sd(T):
        if T <= TB:
            Sd = ag_design * S * (1 + T/TB * (eta * 2.5 - 1))
        elif T <= TC:
            Sd = ag_design * S * eta * 2.5
        elif T <= TD:
            Sd = ag_design * S * eta * 2.5 * (TC / T)
        else:
            Sd = ag_design * S * eta * 2.5 * (TC * TD / (T * T))
        
        # Design spectrum ordinate
        return Sd / q
    
    Sd_T1 = calculate_sd(T1)
    
    # Base shear force (EN 1998-1 4.3.3.2.2)
    M = request.total_mass * 1000  # Convert tonnes to kg
    lambda_correction = 0.85  # Correction factor for multi-story buildings with ≥ 2 stories
    
    Fb = Sd_T1 * M * lambda_correction / 1000  # Convert to kN
    
    # Distribute forces over height (EN 1998-1 4.3.3.2.3)
    # Simplified linear distribution
    n_stories = max(int(H / 3), 1)  # Assuming 3m story height
    story_forces = []
    
    zi_sum = sum([(i * H / n_stories) for i in range(1, n_stories + 1)])
    
    for i in range(1, n_stories + 1):
        zi = i * H / n_stories
        Fi = Fb * zi / zi_sum
        story_forces.append({
            'story': i,
            'height': round(zi, 2),
            'force': round(Fi, 2)
        })
    
    return SeismicDesignResponse(
        design_ground_acceleration=round(ag_design, 3),
        importance_factor=gamma_I,
        soil_factor=S,
        behavior_factor=q,
        fundamental_period=round(T1, 3),
        design_spectrum={
            'TB': TB,
            'TC': TC,
            'TD': TD,
            'Sd_T1': round(Sd_T1, 3),
            'max_spectral_acceleration': round(ag_design * S * 2.5 / q, 3)
        },
        base_shear_force=round(Fb, 2),
        story_forces=story_forces
    )

# ============================================================================
# EN 1992: SLAB DESIGN
# ============================================================================

@app.post("/api/eurocode/design/slab", response_model=SlabDesignResponse)
async def design_slab(request: SlabDesignRequest):
    """
    Design reinforced concrete slab according to EN 1992-1-1
    """
    
    concrete = EurocodeTables.CONCRETE_CLASSES[request.concrete_class]
    steel = EurocodeTables.STEEL_CLASSES[request.steel_class]
    
    fck = concrete['fck']
    fctm = concrete['fctm']
    fcd = fck / 1.5
    fyk = steel['fyk']
    fyd = fyk / 1.15
    
    lx = request.lx * 1000  # Convert to mm
    ly = request.ly * 1000 if request.ly else lx
    h = request.thickness
    d = h - 25  # Assuming 25mm cover for slabs
    n = request.design_load  # kN/m²
    
    # Design moments based on slab type
    design_moments = {}
    
    if request.slab_type == 'one_way':
        # One-way spanning slab
        # Moment coefficients for continuous slab
        alpha_span = 0.086  # Mid-span
        alpha_support = 0.086  # Support
        
        Msx = alpha_span * n * lx * lx / 1e6  # Convert to kNm/m
        Msy = 0.2 * Msx  # Distribution steel
        
        design_moments = {
            'Mx_span': round(Msx, 2),
            'Mx_support': round(alpha_support * n * lx * lx / 1e6, 2),
            'My_distribution': round(Msy, 2)
        }
        
    elif request.slab_type == 'two_way':
        # Two-way spanning slab
        ratio = ly / lx
        
        # Moment coefficients (simplified from tables)
        if ratio <= 1.0:
            alpha_sx = 0.024
            alpha_sy = 0.024
        elif ratio <= 1.5:
            alpha_sx = 0.045
            alpha_sy = 0.034
        else:
            alpha_sx = 0.062
            alpha_sy = 0.032
        
        Msx = alpha_sx * n * lx * lx / 1e6
        Msy = alpha_sy * n * lx * lx / 1e6
        
        design_moments = {
            'Msx_span': round(Msx, 2),
            'Msy_span': round(Msy, 2),
            'Msx_support': round(1.25 * Msx, 2),
            'Msy_support': round(1.25 * Msy, 2)
        }
        
    else:  # flat slab
        # Flat slab design
        Mx = 0.086 * n * lx * lx / 1e6
        My = 0.086 * n * ly * ly / 1e6
        
        design_moments = {
            'column_strip_x': round(0.75 * Mx, 2),
            'middle_strip_x': round(0.25 * Mx, 2),
            'column_strip_y': round(0.75 * My, 2),
            'middle_strip_y': round(0.25 * My, 2)
        }
    
    # Design reinforcement for maximum moment
    max_moment = max(design_moments.values()) * 1e6  # Convert to Nmm per m width
    b = 1000  # Per meter width
    
    K = max_moment / (fcd * b * d * d)
    z = d * (0.5 + math.sqrt(max(0.25 - K / 1.0, 0)))
    z = min(z, 0.95 * d)
    
    As_req = max_moment / (fyd * z)
    As_min = max(0.26 * (fctm / fyk) * b * d, 0.0013 * b * d)
    As = max(As_req, As_min)
    
    # Select bar spacing (main direction)
    bar_dia = 10  # Start with Ø10
    bar_area = 78.5  # mm²
    spacing_x = bar_area * 1000 / As
    spacing_x = min(spacing_x, min(3 * h, 400))  # EN 1992-1-1 9.3.1.1
    
    # Distribution reinforcement (minimum 20% of main)
    As_dist = max(0.2 * As, As_min)
    spacing_y = bar_area * 1000 / As_dist
    spacing_y = min(spacing_y, min(3.5 * h, 450))
    
    reinforcement_x = {
        'bar_size': f'Ø{bar_dia}',
        'spacing': f'{int(spacing_x)}mm',
        'area_provided': round(bar_area * 1000 / spacing_x, 2),
        'area_required': round(As, 2)
    }
    
    reinforcement_y = {
        'bar_size': f'Ø{bar_dia}',
        'spacing': f'{int(spacing_y)}mm',
        'area_provided': round(bar_area * 1000 / spacing_y, 2),
        'area_required': round(As_dist, 2)
    }
    
    # Deflection check (EN 1992-1-1 7.4)
    # Simplified span/depth ratio
    K_basic = 1.0  # For simply supported
    rho = As / (b * d)
    rho_0 = math.sqrt(fck) / 1000
    
    K_factor = min(1.5, 1.0 + 0.5 * math.sqrt(rho_0 / rho) if rho > 0 else 1.5)
    
    allowable_ratio = 20 * K_basic * K_factor  # Basic l/d = 20 for slabs
    actual_ratio = lx / d
    
    deflection_check = {
        'allowable_ratio': round(allowable_ratio, 2),
        'actual_ratio': round(actual_ratio, 2),
        'status': 'PASS' if actual_ratio <= allowable_ratio else 'FAIL - Increase depth'
    }
    
    # Punching shear for flat slabs
    punching_shear = None
    if request.slab_type == 'flat':
        # Simplified punching shear check
        column_size = 400  # Assumed
        u1 = 4 * (column_size + d)  # Basic control perimeter
        
        # VEd - punching shear force (simplified)
        VEd = n * lx * ly / 1e6  # Total load in kN
        vEd = VEd * 1000 / (u1 * d)  # Shear stress in N/mm²
        
        # vRd,c
        k = min(1 + math.sqrt(200 / d), 2.0)
        rho_l = As / (b * d)
        vRd_c = 0.18 / 1.5 * k * pow(100 * rho_l * fck, 1/3)
        vRd_c = max(vRd_c, 0.035 * pow(k, 1.5) * math.sqrt(fck))
        
        punching_shear = {
            'applied_stress': round(vEd, 3),
            'capacity': round(vRd_c, 3),
            'status': 'PASS' if vEd <= vRd_c else 'FAIL - Shear reinforcement required'
        }
    
    return SlabDesignResponse(
        design_moments=design_moments,
        reinforcement_x=reinforcement_x,
        reinforcement_y=reinforcement_y,
        deflection_check=deflection_check,
        punching_shear=punching_shear
    )

# ============================================================================
# EN 1992: COLUMN DESIGN
# ============================================================================

@app.post("/api/eurocode/design/column", response_model=ColumnDesignResponse)
async def design_column(request: ColumnDesignRequest):
    """
    Design reinforced concrete column according to EN 1992-1-1 Section 5.8
    """
    
    concrete = EurocodeTables.CONCRETE_CLASSES[request.concrete_class]
    steel = EurocodeTables.STEEL_CLASSES[request.steel_class]
    
    fck = concrete['fck']
    fcd = fck / 1.5
    fyk = steel['fyk']
    fyd = fyk / 1.15
    
    b = request.width
    h = request.depth
    L = request.height * 1000  # Convert to mm
    NEd = request.ned * 1000  # Convert to N
    MEd = request.med * 1e6  # Convert to Nmm
    beta = request.effective_length_factor
    
    # Effective length (EN 1992-1-1 5.8.3.2)
    l0 = beta * L
    
    # Radius of gyration
    i = h / math.sqrt(12)
    
    # Slenderness ratio (EN 1992-1-1 5.8.3.2)
    lambda_ratio = l0 / i
    
    # Slenderness limit (EN 1992-1-1 5.8.3.1)
    A = 1 / (1 + 0.2 * 0.7)  # Assuming φef = 0.7
    B = math.sqrt(1 + 2 * 0.7)
    
    n = NEd / (b * h * fcd)
    lambda_lim = 20 * A * B * (1 / math.sqrt(n)) if n > 0 else 25
    
    # Column classification
    if lambda_ratio <= lambda_lim:
        classification = "Short column"
        second_order_required = False
    else:
        classification = "Slender column"
        second_order_required = True
    
    # Second order effects
    if second_order_required:
        # Moment magnification (simplified method)
        NB = 0.4 * b * h * fcd  # Buckling load (simplified)
        beta_moment = 1 / (1 - NEd / NB) if NEd < NB else 2.0
        M_total = beta_moment * MEd
        e2 = (l0 * l0) / (10 * h)  # Additional eccentricity
        M_add = NEd * e2
    else:
        M_total = MEd
        M_add = 0
        beta_moment = 1.0
    
    second_order_effects = {
        'required': second_order_required,
        'moment_magnification_factor': round(beta_moment, 3),
        'additional_moment': round(M_add / 1e6, 2),
        'total_moment': round(M_total / 1e6, 2)
    }
    
    # Simplified interaction check (EN 1992-1-1 6.1)
    # Using simplified rectangular stress block
    Ac = b * h
    
    # Minimum eccentricity
    e_min = max(h / 30, 20)
    e_total = max(M_total / NEd if NEd > 0 else 0, e_min)
    
    # Required reinforcement (simplified approach)
    # As = (NEd · e - 0.4 · fcd · b · d²) / (fyd · (d - d'))
    d = h - 50  # Assumed cover + bar radius
    d_prime = 50
    
    As_calc = (NEd * e_total - 0.4 * fcd * b * d * d) / (fyd * (d - d_prime))
    
    # Minimum reinforcement (EN 1992-1-1 9.5.2)
    As_min = max(0.10 * NEd / fyd, 0.002 * Ac)
    
    # Maximum reinforcement
    As_max = 0.04 * Ac
    
    As_req = max(As_calc, As_min)
    As_req = min(As_req, As_max)
    
    # Select bars
    bar_areas = {12: 113, 16: 201, 20: 314, 25: 491, 32: 804}
    bar_arrangements = {4: 'corners', 6: 'perimeter', 8: 'perimeter'}
    
    selected = None
    for n_bars in [4, 6, 8]:
        for dia in# eurocode_main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import math
import numpy as np
from datetime import datetime

app = FastAPI(
    title="Eurocode Structural Design API",
    description="EN 1990, EN 1991, EN 1992, EN 1998 Compliant Calculations",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# EUROCODE TABLES AND CONSTANTS (EN Standards)
# ============================================================================

class EurocodeTables:
    """Eurocode reference tables and constants"""
    
    # EN 1992-1-1 Table 3.1: Concrete strength classes
    CONCRETE_CLASSES = {
        'C12/15': {'fck': 12, 'fcm': 20, 'fctm': 1.6, 'Ecm': 27000, 'εcu3': 0.0035},
        'C16/20': {'fck': 16, 'fcm': 24, 'fctm': 1.9, 'Ecm': 29000, 'εcu3': 0.0035},
        'C20/25': {'fck': 20, 'fcm': 28, 'fctm': 2.2, 'Ecm': 30000, 'εcu3': 0.0035},
        'C25/30': {'fck': 25, 'fcm': 33, 'fctm': 2.6, 'Ecm': 31000, 'εcu3': 0.0035},
        'C30/37': {'fck': 30, 'fcm': 38, 'fctm': 2.9, 'Ecm': 33000, 'εcu3': 0.0035},
        'C35/45': {'fck': 35, 'fcm': 43, 'fctm': 3.2, 'Ecm': 34000, 'εcu3': 0.0035},
        'C40/50': {'fck': 40, 'fcm': 48, 'fctm': 3.5, 'Ecm': 35000, 'εcu3': 0.0035},
        'C45/55': {'fck': 45, 'fcm': 53, 'fctm': 3.8, 'Ecm': 36000, 'εcu3': 0.0035},
        'C50/60': {'fck': 50, 'fcm': 58, 'fctm': 4.1, 'Ecm': 37000, 'εcu3': 0.0031},
        'C55/67': {'fck': 55, 'fcm': 63, 'fctm': 4.2, 'Ecm': 38000, 'εcu3': 0.0029},
        'C60/75': {'fck': 60, 'fcm': 68, 'fctm': 4.4, 'Ecm': 39000, 'εcu3': 0.0027},
    }
    
    # EN 1992-1-1 Table C.1: Reinforcing steel properties
    STEEL_CLASSES = {
        'B500A': {'fyk': 500, 'ftk': 525, 'εuk': 0.025, 'Es': 200000, 'class': 'A'},
        'B500B': {'fyk': 500, 'ftk': 540, 'εuk': 0.050, 'Es': 200000, 'class': 'B'},
        'B500C': {'fyk': 500, 'ftk': 575, 'εuk': 0.075, 'Es': 200000, 'class': 'C'},
    }
    
    # EN 1990 Table A1.2(B): Partial factors for actions (STR/GEO Set B)
    PARTIAL_FACTORS = {
        'uls_persistent': {
            'gamma_G_unfav': 1.35,
            'gamma_G_fav': 1.0,
            'gamma_Q': 1.5,
            'gamma_Q_1': 1.5,
            'xi': 0.85  # Reduction factor for unfavourable permanent actions
        },
        'uls_accidental': {
            'gamma_G': 1.0,
            'gamma_Q': 1.0,
            'gamma_A': 1.0
        },
        'sls': {
            'gamma_G': 1.0,
            'gamma_Q': 1.0
        }
    }
    
    # EN 1990 Table A1.1: Recommended values of ψ factors
    PSI_FACTORS = {
        'Category A': {'psi0': 0.7, 'psi1': 0.5, 'psi2': 0.3},  # Residential
        'Category B': {'psi0': 0.7, 'psi1': 0.5, 'psi2': 0.3},  # Offices
        'Category C': {'psi0': 0.7, 'psi1': 0.7, 'psi2': 0.6},  # Congregation
        'Category D': {'psi0': 0.7, 'psi1': 0.7, 'psi2': 0.6},  # Shopping
        'Category E': {'psi0': 1.0, 'psi1': 0.9, 'psi2': 0.8},  # Storage
        'Wind': {'psi0': 0.6, 'psi1': 0.2, 'psi2': 0.0},
        'Snow (H ≤ 1000m)': {'psi0': 0.5, 'psi1': 0.2, 'psi2': 0.0},
        'Snow (H > 1000m)': {'psi0': 0.7, 'psi1': 0.5, 'psi2': 0.2},
        'Temperature': {'psi0': 0.6, 'psi1': 0.5, 'psi2': 0.0},
    }
    
    # EN 1992-1-1 Table 2.1N: Partial factors for materials
    MATERIAL_FACTORS = {
        'concrete': {'gamma_c': 1.5, 'alpha_cc': 1.0},  # alpha_cc for persistent/transient
        'steel': {'gamma_s': 1.15},
        'accidental': {'gamma_c': 1.2, 'gamma_s': 1.0}
    }
    
    # EN 1991-1-4 Table 4.1: Terrain categories
    TERRAIN_CATEGORIES = {
        '0': {'z0': 0.003, 'zmin': 1, 'description': 'Sea/Coastal areas'},
        'I': {'z0': 0.01, 'zmin': 1, 'description': 'Lakes/Flat country'},
        'II': {'z0': 0.05, 'zmin': 2, 'description': 'Low vegetation/Isolated obstacles'},
        'III': {'z0': 0.3, 'zmin': 5, 'description': 'Suburban/Industrial areas'},
        'IV': {'z0': 1.0, 'zmin': 10, 'description': 'Urban centers'},
    }
    
    # EN 1998-1 Table 3.2: Ground types
    SOIL_TYPES = {
        'A': {'S': 1.0, 'TB': 0.15, 'TC': 0.4, 'TD': 2.0, 'description': 'Rock'},
        'B': {'S': 1.2, 'TB': 0.15, 'TC': 0.5, 'TD': 2.0, 'description': 'Very dense sand/gravel'},
        'C': {'S': 1.15, 'TB': 0.20, 'TC': 0.6, 'TD': 2.0, 'description': 'Dense sand/gravel'},
        'D': {'S': 1.35, 'TB': 0.20, 'TC': 0.8, 'TD': 2.0, 'description': 'Loose-to-medium sand'},
        'E': {'S': 1.4, 'TB': 0.15, 'TC': 0.5, 'TD': 2.0, 'description': 'Soft soil'},
    }
    
    # EN 1992-1-1 Table 4.2: Maximum bar diameter for crack control
    MAX_BAR_DIAMETER = {
        'wk_0.4': {'stress_200': 40, 'stress_240': 32, 'stress_280': 20, 'stress_320': 16, 'stress_360': 12},
        'wk_0.3': {'stress_200': 32, 'stress_240': 25, 'stress_280': 16, 'stress_320': 12, 'stress_360': 10},
        'wk_0.2': {'stress_200': 25, 'stress_240': 16, 'stress_280': 12, 'stress_320': 8, 'stress_360': 6},
    }

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ActionsCombinationRequest(BaseModel):
    permanent_action_gk: float = Field(..., description="Permanent action Gk in kN or kN/m²")
    variable_action_qk: float = Field(..., description="Variable action Qk in kN or kN/m²")
    wind_action_wk: float = Field(0, description="Wind action Wk in kN or kN/m²")
    snow_action_sk: float = Field(0, description="Snow action Sk in kN or kN/m²")
    action_category: str = Field("Category B", description="Action category for ψ factors")
    combination_type: str = Field("eq_6.10", description="eq_6.10, eq_6.10a, or eq_6.10b")

class ActionsCombinationResponse(BaseModel):
    uls_combinations: Dict[str, float]
    sls_combinations: Dict[str, float]
    design_value: float
    governing_combination: str
    psi_factors_used: Dict[str, float]

class FlexuralDesignRequest(BaseModel):
    concrete_class: str = Field("C30/37", description="Concrete class")
    steel_class: str = Field("B500B", description="Steel class")
    width: float = Field(..., description="Section width b in mm")
    height: float = Field(..., description="Section height h in mm")
    cover: float = Field(30, description="Concrete cover in mm")
    med: float = Field(..., description="Design moment MEd in kNm")
    exposure_class: str = Field("XC3", description="Exposure class")

class FlexuralDesignResponse(BaseModel):
    section_properties: Dict[str, float]
    material_properties: Dict[str, float]
    neutral_axis_depth: float
    lever_arm: float
    tension_reinforcement: Dict[str, any]
    compression_reinforcement: Dict[str, any]
    design_type: str
    capacity_checks: Dict[str, bool]

class ShearDesignRequest(BaseModel):
    concrete_class: str = Field("C30/37", description="Concrete class")
    steel_class: str = Field("B500B", description="Steel class")
    width: float = Field(..., description="Width bw in mm")
    effective_depth: float = Field(..., description="Effective depth d in mm")
    ved: float = Field(..., description="Design shear VEd in kN")
    asl: float = Field(0, description="Area of tension reinforcement in mm²")
    cot_theta: float = Field(2.5, description="cot(θ) between 1.0 and 2.5")

class ShearDesignResponse(BaseModel):
    applied_shear: float
    concrete_capacity_vrd_c: float
    max_capacity_vrd_max: float
    shear_reinforcement: Dict[str, any]
    utilization_ratio: float
    design_status: str

class WindActionRequest(BaseModel):
    basic_wind_velocity: float = Field(..., description="vb,0 in m/s")
    terrain_category: str = Field("II", description="Terrain category")
    building_height: float = Field(..., description="Reference height z in m")
    building_width: float = Field(..., description="Building width b in m")
    building_depth: float = Field(..., description="Building depth d in m")
    direction_factor: float = Field(1.0, description="cdir")
    season_factor: float = Field(1.0, description="cseason")
    orography_factor: float = Field(1.0, description="co(z)")
    altitude: float = Field(0, description="Site altitude in m")

class WindActionResponse(BaseModel):
    basic_wind_velocity: float
    mean_wind_velocity: float
    peak_velocity_pressure: float
    turbulence_intensity: float
    pressure_coefficients: Dict[str, float]
    wind_force: float
    base_moment: float
    structural_factor: float

class SeismicDesignRequest(BaseModel):
    design_ground_acceleration: float = Field(..., description="agR as % of g")
    importance_class: str = Field("II", description="I, II, III, or IV")
    soil_type: str = Field("B", description="A, B, C, D, or E")
    ductility_class: str = Field("DCM", description="DCL, DCM, or DCH")
    building_height: float = Field(..., description="Height in m")
    total_mass: float = Field(..., description="Total seismic mass in tonnes")
    structural_system: str = Field("moment_frame", description="Structural system type")

class SeismicDesignResponse(BaseModel):
    design_ground_acceleration: float
    importance_factor: float
    soil_factor: float
    behavior_factor: float
    fundamental_period: float
    design_spectrum: Dict[str, float]
    base_shear_force: float
    story_forces: List[Dict[str, float]]

class SlabDesignRequest(BaseModel):
    slab_type: str = Field("one_way", description="one_way, two_way, or flat")
    concrete_class: str = Field("C30/37", description="Concrete class")
    steel_class: str = Field("B500B", description="Steel class")
    lx: float = Field(..., description="Short span in m")
    ly: Optional[float] = Field(None, description="Long span in m")
    thickness: float = Field(200, description="Slab thickness in mm")
    design_load: float = Field(..., description="Design load in kN/m²")
    edge_conditions: str = Field("continuous", description="Edge support conditions")

class SlabDesignResponse(BaseModel):
    design_moments: Dict[str, float]
    reinforcement_x: Dict[str, any]
    reinforcement_y: Dict[str, any]
    deflection_check: Dict[str, any]
    punching_shear: Optional[Dict[str, any]]

class ColumnDesignRequest(BaseModel):
    concrete_class: str = Field("C30/37", description="Concrete class")
    steel_class: str = Field("B500B", description="Steel class")
    width: float = Field(..., description="Column width b in mm")
    depth: float = Field(..., description="Column depth h in mm")
    height: float = Field(..., description="Column height L in m")
    ned: float = Field(..., description="Design axial force NEd in kN")
    med: float = Field(0, description="Design moment MEd in kNm")
    effective_length_factor: float = Field(1.0, description="Effective length factor β")

class ColumnDesignResponse(BaseModel):
    slenderness_ratio: float
    column_classification: str
    second_order_effects: Dict[str, any]
    interaction_check: Dict[str, any]
    reinforcement: Dict[str, any]
    links: Dict[str, any]

# ============================================================================
# EN 1990: BASIS OF STRUCTURAL DESIGN - ACTIONS COMBINATIONS
# ============================================================================

@app.post("/api/eurocode/actions/combinations", response_model=ActionsCombinationResponse)
async def calculate_actions_combinations(request: ActionsCombinationRequest):
    """
    Calculate action combinations according to EN 1990
    Equations 6.10, 6.10a, 6.10b
    """
    
    Gk = request.permanent_action_gk
    Qk_1 = request.variable_action_qk  # Leading variable action
    Wk = request.wind_action_wk
    Sk = request.snow_action_sk
    
    # Get ψ factors from table
    psi_factors = EurocodeTables.PSI_FACTORS.get(request.action_category, 
                                                  EurocodeTables.PSI_FACTORS['Category B'])
    psi0_imposed = psi_factors['psi0']
    psi1_imposed = psi_factors['psi1']
    psi2_imposed = psi_factors['psi2']
    
    psi_wind = EurocodeTables.PSI_FACTORS['Wind']
    psi0_wind = psi_wind['psi0']
    psi1_wind = psi_wind['psi1']
    psi2_wind = psi_wind['psi2']
    
    # Partial factors
    factors = EurocodeTables.PARTIAL_FACTORS['uls_persistent']
    gamma_G = factors['gamma_G_unfav']
    gamma_Q = factors['gamma_Q']
    xi = factors['xi']
    
    # ULS Combinations (EN 1990 Eq 6.10)
    # Format: γG,j·Gk,j + γQ,1·Qk,1 + Σγ Q,i·ψ0,i·Qk,i
    
    # Equation 6.10 - Standard approach
    eq_6_10_a = gamma_G * Gk + gamma_Q * Qk_1 + gamma_Q * psi0_wind * Wk
    eq_6_10_b = gamma_G * Gk + gamma_Q * psi0_imposed * Qk_1 + gamma_Q * Wk
    
    # Equation 6.10a - Alternative (less favourable of two)
    eq_6_10a_1 = xi * gamma_G * Gk + gamma_Q * Qk_1 + gamma_Q * psi0_wind * Wk
    eq_6_10a_2 = xi * gamma_G * Gk + gamma_Q * psi0_imposed * Qk_1 + gamma_Q * Wk
    
    # Equation 6.10b - Alternative (frequent value of leading action)
    eq_6_10b = gamma_G * Gk + gamma_Q * psi1_imposed * Qk_1 + gamma_Q * psi2_wind * Wk
    
    uls_combinations = {
        'eq_6.10a_imposed_leading': round(eq_6_10_a, 3),
        'eq_6.10b_wind_leading': round(eq_6_10_b, 3),
        'eq_6.10a_alt1': round(eq_6_10a_1, 3),
        'eq_6.10a_alt2': round(eq_6_10a_2, 3),
        'eq_6.10b_frequent': round(eq_6_10b, 3)
    }
    
    # SLS Combinations (EN 1990 Eq 6.14, 6.15, 6.16)
    # Characteristic combination
    char = Gk + Qk_1 + psi0_wind * Wk
    
    # Frequent combination
    freq = Gk + psi1_imposed * Qk_1 + psi2_wind * Wk
    
    # Quasi-permanent combination
    qp = Gk + psi2_imposed * Qk_1 + psi2_wind * Wk
    
    sls_combinations = {
        'characteristic': round(char, 3),
        'frequent': round(freq, 3),
        'quasi_permanent': round(qp, 3)
    }
    
    # Determine governing combination
    design_value = max(uls_combinations.values())
    governing = max(uls_combinations, key=uls_combinations.get)
    
    return ActionsCombinationResponse(
        uls_combinations=uls_combinations,
        sls_combinations=sls_combinations,
        design_value=design_value,
        governing_combination=governing,
        psi_factors_used={
            'psi0_imposed': psi0_imposed,
            'psi1_imposed': psi1_imposed,
            'psi2_imposed': psi2_imposed,
            'psi0_wind': psi0_wind
        }
    )

# ============================================================================
# EN 1992: FLEXURAL DESIGN
# ============================================================================

@app.post("/api/eurocode/design/flexural", response_model=FlexuralDesignResponse)
async def design_flexural_member(request: FlexuralDesignRequest):
    """
    Design flexural reinforcement according to EN 1992-1-1 Section 6.1
    """
    
    # Material properties
    concrete = EurocodeTables.CONCRETE_CLASSES[request.concrete_class]
    steel = EurocodeTables.STEEL_CLASSES[request.steel_class]
    
    fck = concrete['fck']
    fctm = concrete['fctm']
    fcd = EurocodeTables.MATERIAL_FACTORS['concrete']['alpha_cc'] * fck / EurocodeTables.MATERIAL_FACTORS['concrete']['gamma_c']
    
    fyk = steel['fyk']
    fyd = fyk / EurocodeTables.MATERIAL_FACTORS['steel']['gamma_s']
    Es = steel['Es']
    
    # Section properties
    b = request.width
    h = request.height
    cover = request.cover
    d = h - cover - 10  # Assuming 10mm bar radius
    
    Med = request.med * 1e6  # Convert kNm to Nmm
    
    # EN 1992-1-1 3.1.7: Stress-strain for concrete
    # For fck ≤ 50 MPa
    if fck <= 50:
        lambda_val = 0.8
        eta = 1.0
        εcu3 = 0.0035
    else:
        lambda_val = 0.8 - (fck - 50) / 400
        eta = 1.0 - (fck - 50) / 200
        εcu3 = concrete['εcu3']
    
    # Calculate moment capacity for balanced section
    # K_bal = 0.167 for fck ≤ 50 MPa (rectangular stress block)
    K_bal = 0.167
    Mu_bal = K_bal * fcd * b * d * d
    
    # Check if section is singly or doubly reinforced
    K = Med / (fcd * b * d * d)
    
    if K <= K_bal:
        # Singly reinforced section
        # z = d[0.5 + √(0.25 - K/η)]
        z = d * (0.5 + math.sqrt(max(0.25 - K / eta, 0)))
        z = min(z, 0.95 * d)
        
        # Neutral axis depth: x = (d - z) / λ
        xu = (d - z) / lambda_val
        
        # Required tension steel
        As_req = Med / (fyd * z)
        As2_req = 0
        design_type = "Singly reinforced"
        
    else:
        # Doubly reinforced section required
        xu = lambda_val * d
        z = d - lambda_val * xu / 2
        
        # Moment resisted by concrete
        Mu_conc = K_bal * fcd * b * d * d
        
        # Additional moment
        delta_M = Med - Mu_conc
        
        # Tension steel
        As_req = Mu_conc / (fyd * z) + delta_M / (fyd * (d - cover - 10))
        
        # Compression steel
        As2_req = delta_M / (fyd * (d - cover - 10))
        design_type = "Doubly reinforced"
    
    # Minimum reinforcement (EN 1992-1-1 9.2.1.1)
    As_min = max(0.26 * (fctm / fyk) * b * d, 0.0013 * b * d)
    
    As_req = max(As_req, As_min)
    
    # Maximum reinforcement (EN 1992-1-1 9.2.1.1)
    As_max = 0.04 * b * h
    
    # Select bars
    bar_areas = {8: 50.3, 10: 78.5, 12: 113, 16: 201, 20: 314, 25: 491, 32: 804, 40: 1257}
    
    selected_bars = None
    for dia in [12, 16, 20, 25, 32]:
        for num in range(2, 9):
            area = bar_areas[dia] * num
            if area >= As_req and area <= As_max:
                # Check spacing (EN 1992-1-1 8.2)
                min_spacing = max(dia, 20, 1.25 * 20)  # Assuming 20mm aggregate
                available_width = b - 2 * cover - num * dia
                actual_spacing = available_width / (num - 1) if num > 1 else available_width
                
                if actual_spacing >= min_spacing or num == 2:
                    selected_bars = {'diameter': dia, 'number': num, 'area': area}
                    break
        if selected_bars:
            break
    
    if not selected_bars:
        selected_bars = {'diameter': 25, 'number': 4, 'area': bar_areas[25] * 4}
    
    # Capacity checks
    capacity_checks = {
        'strength_adequate': Med <= Mu_bal * 1.1 if K <= K_bal else True,
        'minimum_steel_ok': As_req >= As_min,
        'maximum_steel_ok': As_req <= As_max,
        'neutral_axis_ok': xu / d <= 0.45  # Ductility check
    }
    
    return FlexuralDesignResponse(
        section_properties={
            'width': b,
            'height': h,
            'effective_depth': round(d, 2),
            'cover': cover
        },
        material_properties={
            'fcd': round(fcd, 2),
            '            'fcd': round(fcd, 2),
            'fyd': round(fyd, 2),
            'fck': fck,
            'fyk': fyk
        },
        neutral_axis_depth=round(xu, 2),
        lever_arm=round(z, 2),
        tension_reinforcement={
            'required_area': round(As_req, 2),
            'minimum_area': round(As_min, 2),
            'provided_area': round(selected_bars['area'], 2),
            'bar_arrangement': f"{selected_bars['number']}Ø{selected_bars['diameter']}",
            'diameter': selected_bars['diameter'],
            'number': selected_bars['number']
        },
        compression_reinforcement={
            'required': As2_req > 0,
            'required_area': round(As2_req, 2) if As2_req > 0 else 0,
            'arrangement': f"2Ø{selected_bars['diameter']}" if As2_req > 0 else "None"
        },
        design_type=design_type,
        capacity_checks=capacity_checks
    )