# main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import uvicorn
from datetime import datetime
import math
import numpy as np

app = FastAPI(
    title="RC Structural Design API",
    description="BS Code Compliant Structural Engineering Calculations",
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
# PYDANTIC MODELS (Request/Response Schemas)
# ============================================================================

class LoadCombinationRequest(BaseModel):
    dead_load: float = Field(..., description="Dead load in kN/m²")
    imposed_load: float = Field(..., description="Imposed load in kN/m²")
    wind_load: float = Field(0, description="Wind load in kN/m²")
    combination_type: str = Field("uls", description="uls or sls")

class LoadCombinationResponse(BaseModel):
    uls: Dict[str, float]
    sls: Dict[str, float]
    design_load: float
    critical_combination: str

class TieDesignRequest(BaseModel):
    tie_type: str = Field(..., description="internal, peripheral, column, corner, vertical")
    span: float = Field(..., description="Span in meters")
    load_per_meter: float = Field(..., description="Load in kN/m")
    concrete_grade: str = Field("C30", description="Concrete grade")
    steel_grade: int = Field(500, description="Steel grade in MPa")
    floor_area: Optional[float] = Field(None, description="Floor area in m²")

class TieDesignResponse(BaseModel):
    tie_force: float
    required_area: float
    bar_size: str
    spacing: str
    number_of_bars: int
    design_checks: Dict[str, bool]

class FrameAnalysisRequest(BaseModel):
    method: str = Field("portal", description="portal, cantilever, or simple")
    floors: int = Field(..., description="Number of floors")
    bays: int = Field(..., description="Number of bays")
    story_height: float = Field(..., description="Story height in meters")
    bay_width: float = Field(..., description="Bay width in meters")
    lateral_load: float = Field(..., description="Lateral load in kN")
    vertical_load: Optional[float] = Field(None, description="Vertical load in kN")

class FrameAnalysisResponse(BaseModel):
    method_used: str
    shear_per_column: List[float]
    moments: List[float]
    axial_forces: List[float]
    inflection_points: List[float]
    max_drift: float
    base_shear: float

class StructuralSystemRequest(BaseModel):
    system_type: str = Field(..., description="Type of structural system")
    height: float = Field(..., description="Building height in meters")
    width: float = Field(..., description="Building width in meters")
    depth: float = Field(..., description="Building depth in meters")
    core_size: Optional[float] = Field(None, description="Core size in meters")
    wind_pressure: Optional[float] = Field(1.5, description="Wind pressure in kN/m²")

class StructuralSystemResponse(BaseModel):
    suitability: str
    drift_limit: float
    actual_drift: float
    aspect_ratio: float
    slenderness: str
    characteristics: List[str]
    lateral_stiffness: float
    recommendations: List[str]

class ComputerModelRequest(BaseModel):
    category: str = Field(..., description="cat1, cat2, or cat3")
    bents: int = Field(..., description="Number of bents")
    load: float = Field(..., description="Applied load in kN")
    symmetry: str = Field("symmetric", description="symmetric or asymmetric")
    bent_stiffnesses: Optional[List[float]] = Field(None, description="Stiffness of each bent")
    eccentricity: Optional[float] = Field(0, description="Load eccentricity in meters")

class ComputerModelResponse(BaseModel):
    distribution: str
    analysis_method: str
    load_per_bent: List[float]
    torsional_moments: Optional[List[float]]
    center_of_rigidity: Optional[Dict[str, float]]
    displacements: List[float]

class BeamDesignRequest(BaseModel):
    span: float = Field(..., description="Span in meters")
    width: float = Field(300, description="Beam width in mm")
    depth: float = Field(500, description="Beam depth in mm")
    concrete_grade: str = Field("C30", description="Concrete grade")
    steel_grade: int = Field(500, description="Steel grade")
    moment: float = Field(..., description="Design moment in kNm")
    shear: float = Field(..., description="Design shear in kN")
    cover: float = Field(25, description="Concrete cover in mm")

class BeamDesignResponse(BaseModel):
    flexural_reinforcement: Dict[str, float]
    shear_reinforcement: Dict[str, float]
    deflection_check: Dict[str, any]
    crack_width: float
    design_summary: str

class ColumnDesignRequest(BaseModel):
    height: float = Field(..., description="Column height in meters")
    width: float = Field(300, description="Column width in mm")
    depth: float = Field(300, description="Column depth in mm")
    concrete_grade: str = Field("C30", description="Concrete grade")
    steel_grade: int = Field(500, description="Steel grade")
    axial_load: float = Field(..., description="Axial load in kN")
    moment: float = Field(0, description="Moment in kNm")
    effective_length: Optional[float] = Field(None, description="Effective length in meters")

class ColumnDesignResponse(BaseModel):
    reinforcement_area: float
    number_of_bars: int
    bar_size: str
    links: Dict[str, any]
    slenderness_ratio: float
    additional_moment: float
    capacity_check: Dict[str, bool]

# ============================================================================
# BS CODE TABLES AND CONSTANTS
# ============================================================================

class BSCodeTables:
    """BS 8110 and Eurocode reference tables"""
    
    CONCRETE_GRADES = {
        "C25": {"fcu": 25, "fck": 20, "Ecm": 31000},
        "C30": {"fcu": 30, "fck": 25, "Ecm": 33000},
        "C35": {"fcu": 35, "fck": 28, "Ecm": 34000},
        "C40": {"fcu": 40, "fck": 32, "Ecm": 35000},
        "C45": {"fcu": 45, "fck": 35, "Ecm": 36000},
        "C50": {"fcu": 50, "fck": 40, "Ecm": 37000},
    }
    
    STEEL_GRADES = {
        250: {"fy": 250, "Es": 200000},
        460: {"fy": 460, "Es": 200000},
        500: {"fy": 500, "Es": 200000},
    }
    
    BAR_AREAS = {
        "H8": 50.3, "H10": 78.5, "H12": 113.1,
        "H16": 201.1, "H20": 314.2, "H25": 490.9,
        "H32": 804.2, "H40": 1256.6
    }
    
    LOAD_FACTORS_ULS = {
        "dead": 1.4,
        "imposed": 1.6,
        "wind": 1.4,
        "dead_with_wind": 1.2,
        "imposed_with_wind": 1.2,
        "wind_with_dead": 1.2
    }
    
    LOAD_FACTORS_SLS = {
        "characteristic": 1.0,
        "quasi_permanent_imposed": 0.3,
        "frequent_imposed": 0.5
    }

# ============================================================================
# LOAD COMBINATION CALCULATIONS
# ============================================================================

@app.post("/api/loads/combinations", response_model=LoadCombinationResponse)
async def calculate_load_combinations(request: LoadCombinationRequest):
    """Calculate load combinations according to BS 8110"""
    
    gk = request.dead_load
    qk = request.imposed_load
    wk = request.wind_load
    
    # Ultimate Limit State Combinations
    uls = {
        "combo1_dead_imposed": 1.4 * gk + 1.6 * qk,
        "combo2_dead_imposed_wind": 1.2 * gk + 1.2 * qk + 1.2 * wk,
        "combo3_dead_wind": 1.0 * gk + 1.4 * wk,
        "combo4_all_loads": 1.2 * gk + 1.2 * qk + 1.2 * wk,
    }
    
    # Serviceability Limit State
    sls = {
        "characteristic": gk + qk,
        "quasi_permanent": gk + 0.3 * qk,
        "frequent": gk + 0.5 * qk,
        "rare": gk + qk + 0.6 * wk
    }
    
    # Determine critical combination
    design_load = max(uls.values())
    critical_combo = max(uls, key=uls.get)
    
    return LoadCombinationResponse(
        uls=uls,
        sls=sls,
        design_load=design_load,
        critical_combination=critical_combo
    )

# ============================================================================
# TIE DESIGN CALCULATIONS
# ============================================================================

@app.post("/api/design/ties", response_model=TieDesignResponse)
async def design_ties(request: TieDesignRequest):
    """Design ties according to BS 8110 Section 3.12"""
    
    span = request.span
    load = request.load_per_meter
    fy = request.steel_grade
    tie_type = request.tie_type
    
    # Calculate tie force based on type (BS 8110 3.12.3)
    if tie_type == "internal":
        # Internal tie: Ft = 0.5(gk + qk)L or 1.0Ls whichever is greater
        ft_load = 0.5 * load * span
        ft_min = 1.0 * span
        tie_force = max(ft_load, ft_min, 20)  # Minimum 20 kN
        spacing = "At every floor level"
        
    elif tie_type == "peripheral":
        # Peripheral tie: Ft = 1.0Ls or 0.5(gk + qk)L whichever is greater
        ft_load = 0.5 * load * span
        ft_min = 1.0 * span
        tie_force = max(ft_load, ft_min, 20)
        spacing = "Around perimeter at each floor"
        
    elif tie_type == "column":
        # Tie to column/wall: 3% of total vertical load or minimum
        floor_area = request.floor_area or (span * span)
        total_load = load * floor_area
        tie_force = max(0.03 * total_load, 75, 1.0 * span)
        spacing = "From column to each direction"
        
    elif tie_type == "corner":
        # Corner column tie: 2 × column tie force
        floor_area = request.floor_area or (span * span)
        total_load = load * floor_area
        column_tie = max(0.03 * total_load, 75)
        tie_force = 2.0 * column_tie
        spacing = "At each corner column"
        
    elif tie_type == "vertical":
        # Vertical tie: Full column load or minimum
        tie_force = max(load, 100)
        spacing = "Continuous over full height"
    else:
        raise HTTPException(status_code=400, detail="Invalid tie type")
    
    # Calculate required steel area
    required_area = (tie_force * 1000) / (0.87 * fy)  # mm²
    
    # Select bar size
    bar_size = "H10"
    number_of_bars = 2
    
    for bar, area in BSCodeTables.BAR_AREAS.items():
        if area >= required_area / 2:
            bar_size = bar
            break
    
    provided_area = BSCodeTables.BAR_AREAS[bar_size] * number_of_bars
    
    # Design checks
    design_checks = {
        "area_adequate": provided_area >= required_area,
        "minimum_tie_force": tie_force >= 20,
        "bar_size_acceptable": bar_size in ["H10", "H12", "H16", "H20"]
    }
    
    return TieDesignResponse(
        tie_force=round(tie_force, 2),
        required_area=round(required_area, 2),
        bar_size=bar_size,
        spacing=spacing,
        number_of_bars=number_of_bars,
        design_checks=design_checks
    )

# ============================================================================
# FRAME ANALYSIS
# ============================================================================

@app.post("/api/analysis/frame", response_model=FrameAnalysisResponse)
async def analyze_frame(request: FrameAnalysisRequest):
    """Analyze frame using portal or cantilever method"""
    
    floors = request.floors
    bays = request.bays
    height = request.story_height
    width = request.bay_width
    lateral_load = request.lateral_load
    method = request.method
    
    shear_per_column = []
    moments = []
    axial_forces = []
    inflection_points = []
    
    if method == "portal":
        # Portal Frame Method (assumes inflection at mid-height and mid-span)
        # Exterior columns take V/2, interior columns take V
        total_columns = bays + 1
        
        # Load distribution to each story
        load_per_story = lateral_load / floors
        
        for floor in range(floors):
            # Shear distribution (exterior: V/2, interior: V)
            shear_exterior = load_per_story / (2 * bays + 2)
            shear_interior = 2 * shear_exterior
            
            # Moments at column bases (M = V * h/2)
            moment_exterior = shear_exterior * (height / 2)
            moment_interior = shear_interior * (height / 2)
            
            # Axial forces in columns (from moments in beams)
            axial_exterior = moment_exterior / width
            axial_interior = moment_interior / width
            
            shear_per_column.append({
                "floor": floor + 1,
                "exterior": round(shear_exterior, 2),
                "interior": round(shear_interior, 2)
            })
            
            moments.append({
                "floor": floor + 1,
                "exterior": round(moment_exterior, 2),
                "interior": round(moment_interior, 2)
            })
            
            axial_forces.append({
                "floor": floor + 1,
                "exterior": round(axial_exterior, 2),
                "interior": round(axial_interior, 2)
            })
            
            inflection_points.append(round(height / 2, 2))
    
    elif method == "cantilever":
        # Cantilever Method (assumes inflection at mid-span, axial force proportional to distance from centroid)
        load_per_story = lateral_load / floors
        
        # Distance from centroid for each column
        total_width = bays * width
        
        for floor in range(floors):
            story_shear = load_per_story * (floors - floor)
            
            # Axial force proportional to distance from centroid
            sum_distances_squared = sum([(i * width - total_width/2)**2 for i in range(bays + 1)])
            
            column_axials = []
            for i in range(bays + 1):
                distance = i * width - total_width / 2
                axial = (story_shear * height / 2) * distance / sum_distances_squared if sum_distances_squared > 0 else 0
                column_axials.append(round(axial, 2))
            
            axial_forces.append({
                "floor": floor + 1,
                "columns": column_axials
            })
            
            # Moment calculation
            moment = story_shear * (height / 2)
            moments.append({"floor": floor + 1, "max_moment": round(moment, 2)})
            
            shear_per_column.append({"floor": floor + 1, "shear": round(story_shear / (bays + 1), 2)})
            inflection_points.append(round(height / 2, 2))
    
    else:  # Simple method (BS 8110)
        # Simplified analysis for braced frames
        for floor in range(floors):
            load_above = lateral_load * (floors - floor) / floors
            shear = load_above / (bays + 1)
            moment = shear * height * 0.5
            
            shear_per_column.append(round(shear, 2))
            moments.append(round(moment, 2))
            axial_forces.append(round(moment / width, 2))
            inflection_points.append(round(height / 2, 2))
    
    # Calculate drift (simplified)
    total_height = floors * height
    # Assume lateral stiffness k = EI/h³
    max_drift = (lateral_load * total_height**3) / (3 * 200000 * 1e6 * 0.001)  # Simplified
    max_drift = round(max_drift, 3)
    
    base_shear = lateral_load
    
    return FrameAnalysisResponse(
        method_used=method,
        shear_per_column=shear_per_column,
        moments=moments,
        axial_forces=axial_forces,
        inflection_points=inflection_points,
        max_drift=max_drift,
        base_shear=base_shear
    )

# ============================================================================
# STRUCTURAL SYSTEMS ANALYSIS
# ============================================================================

@app.post("/api/analysis/structural-system", response_model=StructuralSystemResponse)
async def analyze_structural_system(request: StructuralSystemRequest):
    """Analyze tall building structural systems"""
    
    height = request.height
    width = request.width
    depth = request.depth
    system_type = request.system_type
    wind_pressure = request.wind_pressure
    
    aspect_ratio = height / width
    
    # System suitability based on height
    system_limits = {
        "rigid_frame": (25, "Suitable for low-rise", ["Flexible layout", "Economic up to 25m"]),
        "braced_frame": (50, "Suitable for medium-rise", ["High stiffness", "Economic up to 50m"]),
        "shear_wall": (70, "Suitable for high-rise", ["Very stiff", "Core placement critical"]),
        "coupled_wall": (100, "Suitable for tall buildings", ["Optimized stiffness", "Coupling beams critical"]),
        "wall_frame": (80, "Suitable for tall buildings", ["Combined system", "Good for mixed use"]),
        "framed_tube": (150, "Suitable for supertall", ["Perimeter resistance", "Facade integration"]),
        "tube_in_tube": (200, "Suitable for supertall", ["Core + perimeter", "Maximum efficiency"]),
        "outrigger": (300, "Suitable for megatall", ["Core + outriggers", "Superior performance"])
    }
    
    limit, suitability, characteristics = system_limits.get(
        system_type,
        (0, "Unknown system", [])
    )
    
    if height > limit:
        suitability = f"Height exceeds recommended limit of {limit}m"
    
    # Drift limits (BS 8110 / Eurocode)
    drift_limit_factors = {
        "rigid_frame": 500,
        "braced_frame": 600,
        "shear_wall": 700,
        "coupled_wall": 750,
        "wall_frame": 650,
        "framed_tube": 800,
        "tube_in_tube": 850,
        "outrigger": 900
    }
    
    drift_limit = height / drift_limit_factors.get(system_type, 500)
    
    # Estimate actual drift (simplified)
    wind_load = wind_pressure * height * width
    # Simplified stiffness calculation
    if system_type in ["rigid_frame"]:
        k = 1e6  # Low stiffness
    elif system_type in ["braced_frame", "shear_wall"]:
        k = 5e6  # Medium stiffness
    else:
        k = 10e6  # High stiffness
    
    actual_drift = (wind_load * height**3) / (3 * k)
    actual_drift = round(actual_drift / 1000, 3)  # Convert to meters
    
    # Slenderness classification
    if aspect_ratio > 5:
        slenderness = "Slender - Wind critical"
    elif aspect_ratio > 3:
        slenderness = "Medium - Balanced design"
    else:
        slenderness = "Stocky - Gravity dominant"
    
    # Lateral stiffness index
    lateral_stiffness = round(k / 1e6, 2)
    
    # Recommendations
    recommendations = []
    if actual_drift > drift_limit:
        recommendations.append("Drift exceeds limit - Increase stiffness")
    if aspect_ratio > 7:
        recommendations.append("High aspect ratio - Consider outriggers")
    if height > limit * 0.9:
        recommendations.append(f"Approaching system limit - Consider upgrading to more suitable system")
    
    if not recommendations:
        recommendations.append("Design within acceptable parameters")
    
    return StructuralSystemResponse(
        suitability=suitability,
        drift_limit=round(drift_limit, 3),
        actual_drift=actual_drift,
        aspect_ratio=round(aspect_ratio, 2),
        slenderness=slenderness,
        characteristics=characteristics,
        lateral_stiffness=lateral_stiffness,
        recommendations=recommendations
    )

# ============================================================================
# COMPUTER MODELING
# ============================================================================

@app.post("/api/analysis/computer-model", response_model=ComputerModelResponse)
async def analyze_computer_model(request: ComputerModelRequest):
    """Analyze structural model by category"""
    
    bents = request.bents
    load = request.load
    category = request.category
    
    if category == "cat1":
        # Category 1: Equal distribution to identical parallel bents
        load_per_bent = [load / bents] * bents
        distribution = "Equal distribution to identical parallel bents"
        analysis_method = "Direct proportional distribution"
        displacements = [load / (bents * 1000)] * bents  # Simplified
        torsional_moments = None
        center_of_rigidity = None
        
    elif category == "cat2":
        # Category 2: Distribution based on relative stiffness
        stiffnesses = request.bent_stiffnesses or [1.0] * bents
        total_stiffness = sum(stiffnesses)
        
        load_per_bent = [(load * k / total_stiffness) for k in stiffnesses]
        distribution = "Distribution based on relative stiffness of bents"
        analysis_method = "Stiffness matrix method"
        
        # Displacement = Load / Stiffness
        displacements = [load_per_bent[i] / stiffnesses[i] for i in range(bents)]
        torsional_moments = None
        center_of_rigidity = None
        
    else:  # cat3
        # Category 3: 3D analysis with torsion
        stiffnesses = request.bent_stiffnesses or [1.0] * bents
        eccentricity = request.eccentricity
        
        # Calculate center of rigidity
        total_stiffness = sum(stiffnesses)
        # Assuming bents are equally spaced
        positions = list(range(bents))
        cr_position = sum([stiffnesses[i] * positions[i] for i in range(bents)]) / total_stiffness
        
        # Direct load distribution
        direct_load = [(load * k / total_stiffness) for k in stiffnesses]
        
        # Torsional load distribution
        torsion = load * eccentricity
        polar_moment = sum([stiffnesses[i] * (positions[i] - cr_position)**2 for i in range(bents)])
        
        torsional_loads = []
        for i in range(bents):
            torsional_load = torsion * stiffnesses[i] * abs(positions[i] - cr_position) / polar_moment if polar_moment > 0 else 0
            torsional_loads.append(torsional_load)
        
        # Total load per bent
        load_per_bent = [direct_load[i] + torsional_loads[i] for i in range(bents)]
        
        distribution = "3D distribution with torsional effects"
        analysis_method = "Full 3D analysis with center of rigidity"
        displacements = [load_per_bent[i] / stiffnesses[i] for i in range(bents)]
        torsional_moments = [round(t, 2) for t in torsional_loads]
        center_of_rigidity = {"position": round(cr_position, 2), "eccentricity": eccentricity}
    
    return ComputerModelResponse(
        distribution=distribution,
        analysis_method=analysis_method,
        load_per_bent=[round(l, 2) for l in load_per_bent],
        torsional_moments=torsional_moments,
        center_of_rigidity=center_of_rigidity,
        displacements=[round(d, 3) for d in displacements]
    )

# ============================================================================
# BEAM DESIGN
# ============================================================================

@app.post("/api/design/beam", response_model=BeamDesignResponse)
async def design_beam(request: BeamDesignRequest):
    """Design reinforced concrete beam according to BS 8110"""
    
    b = request.width  # mm
    h = request.depth  # mm
    d = h - request.cover - 20  # Effective depth (assuming 20mm bar)
    fcu = BSCodeTables.CONCRETE_GRADES[request.concrete_grade]["fcu"]
    fy = request.steel_grade
    M = request.moment * 1e6  # Convert to Nmm
    V = request.shear * 1000  # Convert to N
    
    # Flexural design
    K = M / (fcu * b * d**2)
    K_prime = 0.156  # Balanced section limit for fy=500
    
    if K <= K_prime:
        # Singly reinforced
        z = d * (0.5 + math.sqrt(0.25 - K/0.9))
        z = min(z, 0.95 * d)
        As_required = M / (0.87 * fy * z)
        compression_steel = 0
        design_type = "Singly reinforced"
    else:
        # Doubly reinforced
        z = 0.775 * d
        As_required = M / (0.87 * fy * z)
        As2 = (M - 0.156 * fcu * b * d**2) / (0.87 * fy * (d - request.cover - 20))
        compression_steel = max(As2, 0)
        design_type = "Doubly reinforced"
    
    # Select bars
    tension_bars = select_bars(As_required)
    
    # Shear design
    v = V / (b * d)  # Shear stress
    vc = 0.79 * (100 * As_required / (b * d))**(1/3) * (400/d)**(1/4) / 1.25  # Design concrete shear stress
    vc = min(vc, 5.0)  # Maximum limit
    
    if v <= vc:
        shear_design = "Minimum links required"
        link_spacing = "300mm"
        link_size = "H8"
    else:
        # Design links
        Asv_s = (v - vc) * b / (0.87 * fy)
        link_size = "H8"
        link_area = BSCodeTables.BAR_AREAS[link_size] * 2  # Two legs
        spacing = link_area / Asv_s
        link_spacing = f"{min(spacing, 0.75*d, 300):.0f}mm"
        shear_design = "Links required for shear"
    
    # Deflection check (simplified)
    span = request.span * 1000  # Convert to mm
    basic_ratio = 20 if M > 0 else 7  # Simplified
    modification_factor = 0.55 + (477 - fy) / (120 * (0.9 + M / (b * d**2 * 1e-6)))
    allowable_ratio = basic_ratio * modification_factor
    actual_ratio = span / d
    
    deflection_ok = actual_ratio <= allowable_ratio
    
    # Crack width (simplified)
    crack_width = 3 * As_required / (b * 1000) if As_required > 0 else 0
    crack_width = min(crack_width, 0.3)  # Limit
    
    return BeamDesignResponse(
        flexural_reinforcement={
            "tension_steel_required": round(As_required, 2),
            "tension_bars": tension_bars,
            "compression_steel": round(compression_steel, 2),
            "design_type": design_type
        },
        shear_reinforcement={
            "shear_stress": round(v, 2),
            "concrete_capacity": round(vc, 2),
            "link_size": link_size,
            "spacing": link_spacing,
            "design": shear_design
        },
        deflection_check={
            "allowable_ratio": round(allowable_ratio, 2),
            "actual_ratio": round(actual_ratio, 2),
            "ok": deflection_ok
        },
        crack_width=round(crack_width, 3),
        design_summary=f"{design_type} beam with {tension_bars['description']}"
    )

# ============================================================================
# COLUMN DESIGN
# ============================================================================

@app.post("/api/design/column", response_model=ColumnDesignResponse)
async def design_column(request: ColumnDesignRequest):
    """Design reinforced concrete column according to BS 8110"""
    
    h = request.height * 1000  # Convert to mm
    b = request.width  # mm
    D = request.depth  # mm
    fcu = BSCodeTables.CONCRETE_GRADES[request.concrete_grade]["fcu"]
    fy = request.steel_grade
    N = request.axial_load * 1000  # Convert to N
    M = request.moment * 1e6  # Convert to Nmm
    
    # Effective length
    le = request.effective_length * 1000 if request.effective_length else h
    
    # Slenderness ratio
    i = D / math.sqrt(12)  # Radius of gyration for rectangular section
    slenderness_ratio = le / i
    
    # Check if column is short or slender
    if slenderness_ratio <= 15:
        column_type = "Short column"
        additional_moment = 0
    else:
        column_type = "Slender column"
        # Additional moment due to slenderness (simplified)
        additional_moment = N * le**2 / (2000 * D * 1e3)  # Nmm
        M += additional_moment
    
    # Design for axial load and moment
    # Calculate required steel area using interaction diagram approach (simplified)
    
    # Check if predominantly axially loaded
    e = M / N if N > 0 else 0  # Eccentricity in mm
    
    if e <= 0.05 * D:  # Small eccentricity
        # Predominantly axial compression
        Ac = b * D
        Asc = (N - 0.4 * fcu * Ac) / (0.75 * fy - 0.4 * fcu)
        Asc = max(Asc, 0.004 * Ac)  # Minimum reinforcement
        design_approach = "Axial compression dominant"
        
    else:  # Significant moment
        # Use simplified interaction approach
        # For preliminary design: Asc = 0.01 to 0.06 * Ac
        Ac = b * D
        
        # Calculate using moment capacity
        d = D - 50  # Effective depth (assuming 50mm cover)
        
        # Simplified biaxial interaction
        M_max = 0.156 * fcu * b * d**2  # Maximum moment capacity
        N_max = 0.4 * fcu * Ac + 0.75 * fy * (0.04 * Ac)  # Maximum axial capacity with 4% steel
        
        # Linear interpolation (simplified)
        steel_ratio = 0.01 + 0.05 * (M / M_max + N / N_max) / 2
        steel_ratio = min(max(steel_ratio, 0.01), 0.06)  # Between 1% and 6%
        
        Asc = steel_ratio * Ac
        design_approach = "Combined axial and bending"
    
    # Select bar arrangement
    bar_arrangement = select_column_bars(Asc, b, D)
    
    # Link design
    main_bar_size = bar_arrangement['bar_size']
    main_bar_dia = int(main_bar_size[1:])
    
    link_size = "H8" if main_bar_dia <= 20 else "H10"
    link_spacing = min(12 * main_bar_dia, min(b, D), 300)
    
    # Capacity check
    As_provided = bar_arrangement['total_area']
    
    # Axial capacity
    N_capacity = 0.4 * fcu * (b * D - As_provided) + 0.75 * fy * As_provided
    
    # Moment capacity (simplified)
    M_capacity = 0.156 * fcu * b * d**2 + 0.75 * fy * As_provided * (d - D/2)
    
    capacity_check = {
        "axial_ok": N <= N_capacity * 0.9,  # 10% safety factor
        "moment_ok": M <= M_capacity * 0.9,
        "steel_ratio_ok": 0.004 <= (As_provided / (b * D)) <= 0.06,
        "slenderness_ok": slenderness_ratio <= 60
    }
    
    return ColumnDesignResponse(
        reinforcement_area=round(Asc, 2),
        number_of_bars=bar_arrangement['number'],
        bar_size=bar_arrangement['bar_size'],
        links={
            "size": link_size,
            "spacing": f"{link_spacing:.0f}mm",
            "arrangement": "Rectangular links with cross ties for >12 bars"
        },
        slenderness_ratio=round(slenderness_ratio, 2),
        additional_moment=round(additional_moment / 1e6, 2),
        capacity_check=capacity_check
    )

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def select_bars(area_required: float) -> Dict:
    """Select appropriate bar sizes and number"""
    
    # Try different bar sizes
    bar_options = [
        ("H12", 4), ("H16", 3), ("H16", 4), ("H20", 3),
        ("H20", 4), ("H25", 3), ("H25", 4), ("H32", 2), ("H32", 3)
    ]
    
    for bar_size, num_bars in bar_options:
        area_provided = BSCodeTables.BAR_AREAS[bar_size] * num_bars
        if area_provided >= area_required:
            return {
                "bar_size": bar_size,
                "number": num_bars,
                "area_provided": round(area_provided, 2),
                "description": f"{num_bars}H{bar_size[1:]}"
            }
    
    # If no option works, use maximum
    return {
        "bar_size": "H32",
        "number": 4,
        "area_provided": round(BSCodeTables.BAR_AREAS["H32"] * 4, 2),
        "description": "4H32"
    }

def select_column_bars(area_required: float, width: float, depth: float) -> Dict:
    """Select column bar arrangement"""
    
    # Standard arrangements: 4, 6, 8, 12, 16 bars
    arrangements = [
        (4, ["H16", "H20", "H25", "H32", "H40"]),
        (6, ["H16", "H20", "H25", "H32"]),
        (8, ["H12", "H16", "H20", "H25", "H32"]),
        (12, ["H12", "H16", "H20", "H25"]),
        (16, ["H12", "H16", "H20"])
    ]
    
    for num_bars, bar_sizes in arrangements:
        for bar_size in bar_sizes:
            area_provided = BSCodeTables.BAR_AREAS[bar_size] * num_bars
            if area_provided >= area_required:
                # Check if bars fit in section
                bar_dia = int(bar_size[1:])
                spacing = (min(width, depth) - 100) / (num_bars / 2 - 1) if num_bars > 4 else 0
                
                if spacing >= 2 * bar_dia or num_bars == 4:
                    return {
                        "number": num_bars,
                        "bar_size": bar_size,
                        "total_area": round(area_provided, 2),
                        "arrangement": f"{num_bars}H{bar_size[1:]}"
                    }
    
    # Default to 8H25
    return {
        "number": 8,
        "bar_size": "H25",
        "total_area": round(BSCodeTables.BAR_AREAS["H25"] * 8, 2),
        "arrangement": "8H25"
    }

# ============================================================================
# SLAB DESIGN
# ============================================================================

class SlabDesignRequest(BaseModel):
    slab_type: str = Field(..., description="one_way, two_way, flat, waffle")
    lx: float = Field(..., description="Short span in meters")
    ly: Optional[float] = Field(None, description="Long span in meters")
    thickness: float = Field(200, description="Slab thickness in mm")
    concrete_grade: str = Field("C30", description="Concrete grade")
    steel_grade: int = Field(500, description="Steel grade")
    dead_load: float = Field(..., description="Dead load in kN/m²")
    imposed_load: float = Field(..., description="Imposed load in kN/m²")
    edge_conditions: Dict[str, str] = Field(default={"all": "continuous"}, description="Edge conditions")

class SlabDesignResponse(BaseModel):
    design_moments: Dict[str, float]
    reinforcement: Dict[str, any]
    deflection_check: Dict[str, any]
    punching_shear: Optional[Dict[str, any]]
    design_summary: str

@app.post("/api/design/slab", response_model=SlabDesignResponse)
async def design_slab(request: SlabDesignRequest):
    """Design reinforced concrete slab according to BS 8110"""
    
    lx = request.lx * 1000  # Convert to mm
    ly = request.ly * 1000 if request.ly else lx
    h = request.thickness
    d = h - 25  # Effective depth (25mm cover for slabs)
    fcu = BSCodeTables.CONCRETE_GRADES[request.concrete_grade]["fcu"]
    fy = request.steel_grade
    
    # Calculate design load
    gk = request.dead_load
    qk = request.imposed_load
    n = 1.4 * gk + 1.6 * qk  # ULS load
    
    # Determine slab type and moment coefficients
    if request.slab_type == "one_way":
        # One-way slab spanning in lx direction
        # Moment coefficients based on edge conditions
        alpha_x = 0.086  # For continuous slab (simplified)
        
        Mx = alpha_x * n * lx**2  # Nmm per mm width
        My = 0.2 * Mx  # Distribution steel
        
        design_moments = {
            "Mx_span": round(Mx / 1e6, 2),
            "Mx_support": round(Mx / 1e6, 2),
            "My": round(My / 1e6, 2)
        }
        
    elif request.slab_type == "two_way":
        # Two-way slab
        ratio = ly / lx
        
        # Moment coefficients from BS 8110 Table 3.14 (simplified)
        if ratio <= 1.5:
            alpha_sx = 0.062  # Short span positive moment
            alpha_sy = 0.045  # Long span positive moment
        else:
            alpha_sx = 0.086
            alpha_sy = 0.024
        
        Msx = alpha_sx * n * lx**2
        Msy = alpha_sy * n * lx**2
        
        design_moments = {
            "Msx_span": round(Msx / 1e6, 2),
            "Msy_span": round(Msy / 1e6, 2),
            "Msx_support": round(1.3 * Msx / 1e6, 2),
            "Msy_support": round(1.3 * Msy / 1e6, 2)
        }
        
    else:  # flat slab
        # Flat slab design (simplified)
        # Column strip and middle strip
        Mx = 0.086 * n * lx**2
        My = 0.086 * n * ly**2
        
        design_moments = {
            "column_strip_x": round(Mx * 0.75 / 1e6, 2),
            "middle_strip_x": round(Mx * 0.25 / 1e6, 2),
            "column_strip_y": round(My * 0.75 / 1e6, 2),
            "middle_strip_y": round(My * 0.25 / 1e6, 2)
        }
    
    # Reinforcement calculation
    max_moment = max([v for v in design_moments.values()]) * 1e6  # Nmm per m width
    b = 1000  # Design per meter width
    
    K = max_moment / (fcu * b * d**2)
    z = d * (0.5 + math.sqrt(0.25 - K/0.9))
    z = min(z, 0.95 * d)
    
    As_required = max_moment / (0.87 * fy * z)
    As_min = 0.13 * b * h / 100  # Minimum reinforcement
    As = max(As_required, As_min)
    
    # Select bar spacing
    bar_size = "H10"
    bar_area = BSCodeTables.BAR_AREAS[bar_size]
    spacing = bar_area * 1000 / As
    spacing = min(spacing, 300, 3 * h)  # Maximum spacing limits
    
    reinforcement = {
        "main_steel": {
            "bar_size": bar_size,
            "spacing": f"{spacing:.0f}mm",
            "area_provided": round(bar_area * 1000 / spacing, 2)
        },
        "distribution_steel": {
            "bar_size": "H8",
            "spacing": "300mm",
            "area_provided": round(BSCodeTables.BAR_AREAS["H8"] * 1000 / 300, 2)
        }
    }
    
    # Deflection check
    basic_ratio = 26  # For two-way spanning slab
    modification_factor = 0.55 + (477 - fy) / (120 * (0.9 + max_moment / (b * d**2 * 1e-6)))
    allowable_ratio = basic_ratio * modification_factor
    actual_ratio = lx / d
    
    deflection_check = {
        "allowable_ratio": round(allowable_ratio, 2),
        "actual_ratio": round(actual_ratio, 2),
        "ok": actual_ratio <= allowable_ratio
    }
    
    # Punching shear for flat slab
    punching_shear = None
    if request.slab_type == "flat":
        # Simplified punching shear check
        column_size = 400  # Assumed column size
        u = 4 * (column_size + d)  # Perimeter at d from column face
        v = (n * lx * ly / 1e6) / (u * d) * 1000  # Punching shear stress
        vc = 0.79 * (100 * As / (b * d))**(1/3) * (400/d)**(1/4) / 1.25
        
        punching_shear = {
            "shear_stress": round(v, 2),
            "concrete_capacity": round(vc, 2),
            "ok": v <= 2 * vc,
            "note": "Shear reinforcement required if stress exceeds concrete capacity"
        }
    
    return SlabDesignResponse(
        design_moments=design_moments,
        reinforcement=reinforcement,
        deflection_check=deflection_check,
        punching_shear=punching_shear,
        design_summary=f"{request.slab_type.replace('_', ' ').title()} slab with {bar_size}@{spacing:.0f}mm"
    )

# ============================================================================
# FOUNDATION DESIGN
# ============================================================================

class FootingDesignRequest(BaseModel):
    footing_type: str = Field(..., description="pad, strip, combined, raft")
    column_load: float = Field(..., description="Column load in kN")
    column_width: float = Field(300, description="Column width in mm")
    column_depth: float = Field(300, description="Column depth in mm")
    soil_bearing_capacity: float = Field(..., description="Allowable bearing capacity in kN/m²")
    concrete_grade: str = Field("C30", description="Concrete grade")
    steel_grade: int = Field(500, description="Steel grade")
    depth: float = Field(500, description="Footing depth in mm")

class FootingDesignResponse(BaseModel):
    footing_dimensions: Dict[str, float]
    base_pressure: float
    bending_reinforcement: Dict[str, any]
    shear_check: Dict[str, any]
    design_summary: str

@app.post("/api/design/footing", response_model=FootingDesignResponse)
async def design_footing(request: FootingDesignRequest):
    """Design foundation according to BS 8110"""
    
    P = request.column_load * 1000  # Convert to N
    qa = request.soil_bearing_capacity * 1000  # Convert to N/m²
    col_width = request.column_width
    col_depth = request.column_depth
    h = request.depth
    d = h - 50  # Effective depth
    fcu = BSCodeTables.CONCRETE_GRADES[request.concrete_grade]["fcu"]
    fy = request.steel_grade
    
    # Design for pad footing (most common)
    if request.footing_type == "pad":
        # Calculate required base area
        A_required = P / qa
        
        # For square footing
        B = math.sqrt(A_required) * 1000  # Convert to mm
        B = math.ceil(B / 100) * 100  # Round up to nearest 100mm
        
        # Actual base pressure
        p = P / ((B/1000)**2) / 1000  # kN/m²
        
        # Calculate bending moment at column face
        a = (B - col_width) / 2  # Cantilever length
        M = p * (a/1000)**2 * (B/1000) / 2 * 1e6  # Nmm
        
        # Calculate required reinforcement
        b = B  # Width for calculation
        K = M / (fcu * b * d**2)
        z = d * (0.5 + math.sqrt(0.25 - K/0.9))
        z = min(z, 0.95 * d)
        
        As_required = M / (0.87 * fy * z)
        As_min = 0.13 * b * h / 100
        As = max(As_required, As_min)
        
        # Select bars
        bar_size = "H16"
        bar_area = BSCodeTables.BAR_AREAS[bar_size]
        spacing = bar_area * 1000 / (As / B)
        spacing = min(spacing, 300)
        num_bars = math.ceil(B / spacing)
        
        bending_reinforcement = {
            "bar_size": bar_size,
            "number_each_way": num_bars,
            "spacing": f"{spacing:.0f}mm",
            "arrangement": f"{num_bars}H{bar_size[1:]} each way"
        }
        
        # Shear check
        # Critical section at d from column face
        V = p * ((a - d) / 1000) * (B / 1000) * 1000  # N
        v = V / (B * d)  # Shear stress
        
        vc = 0.79 * (100 * As / (B * d))**(1/3) * (400/d)**(1/4) / 1.25
        vc = min(vc, 5.0)
        
        shear_check = {
            "shear_stress": round(v, 2),
            "concrete_capacity": round(vc, 2),
            "ok": v <= vc,
            "punching_shear_ok": v <= 2 * vc
        }
        
        footing_dimensions = {
            "length": B,
            "width": B,
            "depth": h,
            "type": "Square pad"
        }
        
    else:  # Other footing types (simplified)
        B = math.sqrt(P / qa) * 1000
        footing_dimensions = {
            "length": B,
            "width": B,
            "depth": h,
            "type": request.footing_type
        }
        bending_reinforcement = {"note": "Detailed design required"}
        shear_check = {"note": "Detailed design required"}
        p = request.soil_bearing_capacity
    
    return FootingDesignResponse(
        footing_dimensions=footing_dimensions,
        base_pressure=round(p, 2),
        bending_reinforcement=bending_reinforcement,
        shear_check=shear_check,
        design_summary=f"{request.footing_type.title()} footing {footing_dimensions['length']:.0f}x{footing_dimensions['width']:.0f}x{h:.0f}mm"
    )

# ============================================================================
# RETAINING WALL DESIGN
# ============================================================================

class RetainingWallRequest(BaseModel):
    wall_height: float = Field(..., description="Wall height in meters")
    soil_density: float = Field(18, description="Soil density in kN/m³")
    angle_of_friction: float = Field(30, description="Angle of internal friction in degrees")
    surcharge: float = Field(0, description="Surcharge load in kN/m²")
    concrete_grade: str = Field("C30", description="Concrete grade")
    steel_grade: int = Field(500, description="Steel grade")

class RetainingWallResponse(BaseModel):
    wall_dimensions: Dict[str, float]
    earth_pressure: Dict[str, float]
    stability_checks: Dict[str, any]
    reinforcement: Dict[str, any]
    design_summary: str

@app.post("/api/design/retaining-wall", response_model=RetainingWallResponse)
async def design_retaining_wall(request: RetainingWallRequest):
    """Design cantilever retaining wall according to BS 8002"""
    
    H = request.wall_height
    gamma = request.soil_density
    phi = math.radians(request.angle_of_friction)
    q = request.surcharge
    fcu = BSCodeTables.CONCRETE_GRADES[request.concrete_grade]["fcu"]
    fy = request.steel_grade
    
    # Active earth pressure coefficient (Rankine)
    Ka = math.tan(math.pi/4 - phi/2)**2
    
    # Calculate earth pressures
    pa_top = Ka * q  # Pressure at top due to surcharge
    pa_bottom = Ka * (gamma * H + q)  # Pressure at bottom
    
    # Resultant force and moment
    Pa_surcharge = pa_top * H  # Force from surcharge
    Pa_soil = 0.5 * Ka * gamma * H**2  # Force from soil
    Pa_total = Pa_surcharge + Pa_soil
    
    # Moments about toe
    Ma_surcharge = Pa_surcharge * H / 2
    Ma_soil = Pa_soil * H / 3
    Ma_total = Ma_surcharge + Ma_soil
    
    # Preliminary dimensions
    base_width = 0.5 * H  # Initial estimate
    stem_thickness_top = max(200, 0.1 * H * 1000)
    stem_thickness_base = max(300, 0.15 * H * 1000)
    base_thickness = max(400, 0.1 * H * 1000)
    
    # Weight of wall (simplified - rectangular stem)
    stem_weight = 0.5 * (stem_thickness_top + stem_thickness_base) / 1000 * H * 25  # kN/m
    base_weight = base_width * base_thickness / 1000 * 25
    soil_on_heel_weight = (base_width * 0.6) * H * gamma
    
    total_weight = stem_weight + base_weight + soil_on_heel_weight
    
    # Stability checks
    # 1. Overturning
    Mr = total_weight * base_width / 2  # Resisting moment (simplified)
    FOS_overturning = Mr / Ma_total
    
    # 2. Sliding
    mu = math.tan(phi * 0.67)  # Friction coefficient
    Fr = mu * total_weight
    FOS_sliding = Fr / Pa_total
    
    # 3. Bearing capacity (simplified)
    e = base_width / 2 - (Mr - Ma_total) / total_weight  # Eccentricity
    q_max = (total_weight / base_width) * (1 + 6 * e / base_width)
    q_min = (total_weight / base_width) * (1 - 6 * e / base_width)
    
    # Design stem reinforcement
    M_stem = 0.5 * Ka * gamma * H**3 / 3 * 1e6  # Maximum moment at base in Nmm
    b = 1000  # Per meter width
    d = stem_thickness_base - 50
    
    K = M_stem / (fcu * b * d**2)
    z = d * (0.5 + math.sqrt(0.25 - K/0.9))
    z = min(z, 0.95 * d)
    As_stem = M_stem / (0.87 * fy * z)
    
    # Select bars for stem
    bar_size_stem = "H16"
    spacing_stem = BSCodeTables.BAR_AREAS[bar_size_stem] * 1000 / As_stem
    spacing_stem = min(spacing_stem, 300)
    
    stability_checks = {
        "overturning_fos": round(FOS_overturning, 2),
        "overturning_ok": FOS_overturning >= 2.0,
        "sliding_fos": round(FOS_sliding, 2),
        "sliding_ok": FOS_sliding >= 1.5,
        "bearing_pressure_max": round(q_max, 2),
        "bearing_pressure_min": round(q_min, 2),
        "bearing_ok": q_min >= 0 and q_max <= 200  # Assumed allowable bearing
    }
    
    return RetainingWallResponse(
        wall_dimensions={
            "height": H,
            "base_width": round(base_width, 2),
            "stem_thickness_top": stem_thickness_top,
            "stem_thickness_base": stem_thickness_base,
            "base_thickness": base_thickness
        },
        earth_pressure={
            "active_coefficient": round(Ka, 3),
            "pressure_top": round(pa_top, 2),
            "pressure_bottom": round(pa_bottom, 2),
            "total_force": round(Pa_total, 2)
        },
        stability_checks=stability_checks,
        reinforcement={
            "stem_main": f"{bar_size_stem}@{spacing_stem:.0f}mm",
            "stem_distribution": "H12@300mm",
            "base_main": "H16@200mm",
            "base_distribution": "H12@300mm"
        },
        design_summary=f"Cantilever retaining wall {H:.1f}m high with {base_width:.2f}m base"
    )

# ============================================================================
# PROJECT MANAGEMENT ENDPOINTS
# ============================================================================

class Project(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    created_at: Optional[datetime] = None
    calculations: List[Dict] = []

# In-memory storage (replace with database in production)
projects_db = {}

@app.post("/api/projects/create")
async def create_project(project: Project):
    """Create a new project"""
    project_id = f"PROJ_{len(projects_db) + 1:04d}"
    project.id = project_id
    project.created_at = datetime.now()
    projects_db[project_id] = project.dict()
    return {"status": "success", "project_id": project_id, "project": project}

@app.get("/api/projects/list")
async def list_projects():
    """List all projects"""
    return {"projects": list(projects_db.values())}

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Get project by ID"""
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")
    return projects_db[project_id]

@app.post("/api/projects/{project_id}/add-calculation")
async def add_calculation(project_id: str, calculation: Dict):
    """Add calculation to project"""
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")
    
    projects_db[project_id]["calculations"].append({
        **calculation,
        "timestamp": datetime.now().isoformat()
    })
    return {"status": "success", "calculation_count": len(projects_db[project_id]["calculations"])}

# ============================================================================
# REPORT GENERATION
# ============================================================================

@app.get("/api/reports/project/{project_id}")
async def generate_project_report(project_id: str):
    """Generate comprehensive project report"""
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = projects_db[project_id]
    
    report = {
        "project_info": {
            "id": project["id"],
            "name": project["name"],
            "description": project["description"],
            "location": project["location"],
            "created_at": project["created_at"]
        },
        "calculations_summary": {
            "total_calculations": len(project["calculations"]),
            "by_type": {}
        },
        "calculations": project["calculations"]
    }
    
    # Count calculations by type
    for calc in project["calculations"]:
        calc_type = calc.get("type", "unknown")
        report["calculations_summary"]["by_type"][calc_type] = \
            report["calculations_summary"]["by_type"].get(calc_type, 0) + 1
    
    return report

# ============================================================================
# HEALTH CHECK AND INFO
# ============================================================================

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "RC Structural Design API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "loads": "/api/loads/combinations",
            "ties": "/api/design/ties",
            "frame": "/api/analysis/frame",
            "systems": "/api/analysis/structural-system",
            "modeling": "/api/analysis/computer-model",
            "beam": "/api/design/beam",
            "column": "/api/design/column",
            "slab": "/api/design/slab",
            "footing": "/api/design/footing",
            "retaining_wall": "/api/design/retaining-wall",
            "projects": "/api/projects/",
            "docs": "/docs"
        }
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/codes/tables")
async def get_code_tables():
    """Get BS Code reference tables"""
    return {
        "concrete_grades": BSCodeTables.CONCRETE_GRADES,
        "steel_grades": BSCodeTables.STEEL_GRADES,
        "bar_areas": BSCodeTables.BAR_AREAS,
        "load_factors_uls": BSCodeTables.LOAD_FACTORS_ULS,
        "load_factors_sls": BSCodeTables.LOAD_FACTORS_SLS
    }

# ============================================================================
# WIND LOAD CALCULATIONS (BS 6399-2)
# ============================================================================

class WindLoadRequest(BaseModel):
    building_height: float = Field(..., description="Building height in meters")
    building_width: float = Field(..., description="Building width in meters")
    building_depth: float = Field(..., description="Building depth in meters")
    basic_wind_speed: float = Field(22, description="Basic wind speed in m/s")
    terrain_category: int = Field(2, description="Terrain category (0-4)")
    altitude: float = Field(0, description="Site altitude in meters")
    direction_factor: float = Field(1.0, description="Direction factor")
    seasonal_factor: float = Field(1.0, description="Seasonal factor")

class WindLoadResponse(BaseModel):
    design_wind_speed: float
    dynamic_pressure: float
    pressure_coefficients: Dict[str, float]
    wind_forces: Dict[str, float]
    overturning_moment: float
    design_summary: str

@app.post("/api/analysis/wind-load", response_model=WindLoadResponse)
async def calculate_wind_load(request: WindLoadRequest):
    """Calculate wind loads according to BS 6399-2"""
    
    H = request.building_height
    W = request.building_width
    D = request.building_depth
    Vb = request.basic_wind_speed
    
    # Site wind speed (simplified)
    Sa = 1 + 0.001 * request.altitude  # Altitude factor
    Sd = request.direction_factor
    Ss = request.seasonal_factor
    Sp = 1.0  # Probability factor (simplified)
    
    # Terrain and building factor (simplified for Category 2)
    terrain_factors = {
        0: 1.17,  # Sea
        1: 1.08,  # Open
        2: 1.00,  # Suburban
        3: 0.87,  # Urban
        4: 0.72   # City
    }
    Sb = terrain_factors.get(request.terrain_category, 1.0)
    
    # Design wind speed
    Vs = Vb * Sa * Sd * Ss * Sp
    Ve = Vs * Sb  # Effective wind speed
    
    # Dynamic pressure
    qe = 0.613 * Ve**2  # Pa (air density = 1.226 kg/m³)
    
    # Pressure coefficients (simplified for rectangular building)
    # Windward face
    Cpe_windward = 0.7
    # Leeward face
    Cpe_leeward = -0.3
    # Side faces
    Cpe_side = -0.6
    # Roof (flat/low pitch)
    Cpe_roof = -0.6
    
    # Net pressure coefficient
    Cp_net = Cpe_windward - Cpe_leeward
    
    # Wind forces
    # Force on windward face
    F_windward = qe * Cpe_windward * W * H / 1000  # kN
    # Force on leeward face
    F_leeward = qe * abs(Cpe_leeward) * W * H / 1000  # kN
    # Total horizontal force
    F_total = qe * Cp_net * W * H / 1000  # kN
    
    # Overturning moment at base
    # Assuming uniform pressure distribution
    M_overturning = F_total * H / 2  # kNm
    
    # Wind pressure on roof
    F_roof = qe * abs(Cpe_roof) * W * D / 1000  # kN (uplift)
    
    pressure_coefficients = {
        "windward": Cpe_windward,
        "leeward": Cpe_leeward,
        "side": Cpe_side,
        "roof": Cpe_roof,
        "net": Cp_net
    }
    
    wind_forces = {
        "windward_face": round(F_windward, 2),
        "leeward_face": round(F_leeward, 2),
        "total_horizontal": round(F_total, 2),
        "roof_uplift": round(F_roof, 2)
    }
    
    return WindLoadResponse(
        design_wind_speed=round(Ve, 2),
        dynamic_pressure=round(qe / 1000, 3),
        pressure_coefficients=pressure_coefficients,
        wind_forces=wind_forces,
        overturning_moment=round(M_overturning, 2),
        design_summary=f"Design wind speed: {Ve:.1f} m/s, Total force: {F_total:.1f} kN"
    )

# ============================================================================
# SEISMIC ANALYSIS (Simplified - BS EN 1998)
# ============================================================================

class SeismicAnalysisRequest(BaseModel):
    building_height: float = Field(..., description="Building height in meters")
    building_mass: float = Field(..., description="Total building mass in tonnes")
    seismic_zone: str = Field("low", description="low, medium, high")
    soil_type: str = Field("C", description="A, B, C, D, E")
    structural_system: str = Field("moment_frame", description="Structural system type")
    importance_factor: float = Field(1.0, description="Importance factor")

class SeismicAnalysisResponse(BaseModel):
    design_spectrum: Dict[str, any]
    base_shear: float
    story_forces: List[Dict[str, float]]
    design_checks: Dict[str, any]
    design_summary: str

@app.post("/api/analysis/seismic", response_model=SeismicAnalysisResponse)
async def analyze_seismic(request: SeismicAnalysisRequest):
    """Simplified seismic analysis according to BS EN 1998"""
    
    H = request.building_height
    M = request.building_mass * 1000  # Convert to kg
    gamma_I = request.importance_factor
    
    # Peak ground acceleration based on zone (simplified)
    pga_values = {
        "low": 0.05,    # 0.05g
        "medium": 0.15, # 0.15g
        "high": 0.30    # 0.30g
    }
    ag = pga_values.get(request.seismic_zone, 0.05) * 9.81  # m/s²
    
    # Soil factor (simplified)
    soil_factors = {
        "A": 1.0,  # Rock
        "B": 1.2,  # Stiff soil
        "C": 1.15, # Medium soil
        "D": 1.35, # Soft soil
        "E": 1.4   # Very soft soil
    }
    S = soil_factors.get(request.soil_type, 1.0)
    
    # Behavior factor (q) based on structural system
    q_values = {
        "moment_frame": 5.0,
        "braced_frame": 4.0,
        "shear_wall": 3.5,
        "dual_system": 5.5
    }
    q = q_values.get(request.structural_system, 4.0)
    
    # Fundamental period (simplified Rayleigh method)
    Ct = 0.075  # For RC moment frames
    T1 = Ct * H**0.75  # seconds
    
    # Design spectrum
    TB = 0.15  # Short period limit (soil dependent)
    TC = 0.5   # Long period limit
    TD = 2.0   # Very long period limit
    
    # Spectral acceleration
    if T1 <= TB:
        Sd_T = ag * S * (1 + T1/TB * (2.5/q - 1))
    elif T1 <= TC:
        Sd_T = ag * S * 2.5 / q
    elif T1 <= TD:
        Sd_T = ag * S * 2.5 / q * (TC / T1)
    else:
        Sd_T = ag * S * 2.5 / q * (TC * TD / T1**2)
    
    # Base shear
    lambda_factor = 0.85  # Correction factor for multi-story buildings
    V_base = Sd_T * M * lambda_factor / 1000  # kN
    
    # Distribution of forces over height (using simplified triangular distribution)
    n_stories = max(int(H / 3), 1)  # Assume 3m story height
    story_forces = []
    
    for i in range(1, n_stories + 1):
        hi = i * H / n_stories
        zi = hi / H
        # Force at story i (simplified)
        Fi = V_base * zi / sum([j / n_stories for j in range(1, n_stories + 1)])
        story_forces.append({
            "story": i,
            "height": round(hi, 2),
            "force": round(Fi, 2)
        })
    
    # Design checks
    design_checks = {
        "period": round(T1, 3),
        "period_range": "Acceptable" if 0.1 <= T1 <= 4.0 else "Check required",
        "base_shear_coefficient": round(V_base / (M / 1000), 3),
        "drift_limits": "H/500 for damage limit state",
        "redundancy": "Ensure multiple load paths"
    }
    
    return SeismicAnalysisResponse(
        design_spectrum={
            "fundamental_period": round(T1, 3),
            "spectral_acceleration": round(Sd_T, 3),
            "peak_ground_acceleration": round(ag, 3),
            "soil_factor": S,
            "behavior_factor": q
        },
        base_shear=round(V_base, 2),
        story_forces=story_forces,
        design_checks=design_checks,
        design_summary=f"Base shear: {V_base:.1f} kN, Period: {T1:.2f} sec"
    )

# ============================================================================
# DEFLECTION CALCULATIONS
# ============================================================================

class DeflectionRequest(BaseModel):
    member_type: str = Field(..., description="beam, slab, cantilever")
    span: float = Field(..., description="Span in meters")
    load: float = Field(..., description="Uniformly distributed load in kN/m or kN/m²")
    moment_of_inertia: float = Field(..., description="Moment of inertia in mm⁴")
    elastic_modulus: float = Field(30000, description="Elastic modulus in MPa")
    support_conditions: str = Field("simply_supported", description="Support conditions")

class DeflectionResponse(BaseModel):
    maximum_deflection: float
    deflection_limit: float
    deflection_ok: bool
    deflection_location: str
    design_summary: str

@app.post("/api/analysis/deflection", response_model=DeflectionResponse)
async def calculate_deflection(request: DeflectionRequest):
    """Calculate deflection of structural members"""
    
    L = request.span * 1000  # Convert to mm
    w = request.load
    I = request.moment_of_inertia
    E = request.elastic_modulus
    
    # Convert load to N/mm
    if request.member_type == "slab":
        w_nmm = w * 1000 / 1e6  # kN/m² to N/mm²
        # For slab, use equivalent strip width
        w_nmm = w_nmm * 1000  # Per mm width
    else:
        w_nmm = w * 1000 / 1000  # kN/m to N/mm
    
    # Calculate deflection based on support conditions
    if request.support_conditions == "simply_supported":
        # δ = 5wL⁴/(384EI)
        delta_max = (5 * w_nmm * L**4) / (384 * E * I)
        location = "Mid-span"
        
    elif request.support_conditions == "fixed_both_ends":
        # δ = wL⁴/(384EI)
        delta_max = (w_nmm * L**4) / (384 * E * I)
        location = "Mid-span"
        
    elif request.support_conditions == "cantilever":
        # δ = wL⁴/(8EI)
        delta_max = (w_nmm * L**4) / (8 * E * I)
        location = "Free end"
        
    elif request.support_conditions == "continuous":
        # Simplified for continuous span
        # δ ≈ wL⁴/(185EI) for equal spans
        delta_max = (w_nmm * L**4) / (185 * E * I)
        location = "Near mid-span"
    else:
        delta_max = (5 * w_nmm * L**4) / (384 * E * I)
        location = "Mid-span"
    
    # Deflection limits (BS 8110)
    if request.member_type == "cantilever":
        deflection_limit = L / 180  # L/180 for cantilevers
    else:
        deflection_limit = L / 250  # L/250 for beams and slabs
    
    deflection_ok = delta_max <= deflection_limit
    
    return DeflectionResponse(
        maximum_deflection=round(delta_max, 2),
        deflection_limit=round(deflection_limit, 2),
        deflection_ok=deflection_ok,
        deflection_location=location,
        design_summary=f"Deflection: {delta_max:.1f}mm, Limit: {deflection_limit:.1f}mm, Status: {'OK' if deflection_ok else 'FAIL'}"
    )

# ============================================================================
# CRACK WIDTH CALCULATIONS
# ============================================================================

class CrackWidthRequest(BaseModel):
    member_type: str = Field(..., description="beam, slab, wall")
    bar_diameter: float = Field(..., description="Bar diameter in mm")
    bar_spacing: float = Field(..., description="Bar spacing in mm")
    concrete_cover: float = Field(..., description="Concrete cover in mm")
    steel_stress: float = Field(..., description="Steel stress in MPa")
    exposure_class: str = Field("XC1", description="Exposure class")

class CrackWidthResponse(BaseModel):
    crack_width: float
    allowable_crack_width: float
    crack_width_ok: bool
    design_summary: str

@app.post("/api/analysis/crack-width", response_model=CrackWidthResponse)
async def calculate_crack_width(request: CrackWidthRequest):
    """Calculate crack width according to BS EN 1992"""
    
    φ = request.bar_diameter
    s = request.bar_spacing
    c = request.concrete_cover
    fs = request.steel_stress
    
    # Maximum crack spacing (simplified)
    sr_max = 3.4 * c + 0.425 * φ * s / 100
    
    # Mean strain
    εsm = max(0.6 * fs / 200000, 0.00035)  # Simplified
    
    # Crack width
    wk = sr_max * εsm
    
    # Allowable crack width based on exposure class
    allowable_widths = {
        "XC1": 0.4,  # Dry environment
        "XC2": 0.3,  # Wet, rarely dry
        "XC3": 0.3,  # Moderate humidity
        "XC4": 0.3,  # Cyclic wet/dry
        "XD1": 0.3,  # Moderate chlorides
        "XD2": 0.3,  # Chlorides from seawater
        "XS1": 0.3,  # Marine exposure
    }
    wk_allow = allowable_widths.get(request.exposure_class, 0.3)
    
    crack_width_ok = wk <= wk_allow
    
    return CrackWidthResponse(
        crack_width=round(wk, 3),
        allowable_crack_width=wk_allow,
        crack_width_ok=crack_width_ok,
        design_summary=f"Crack width: {wk:.2f}mm, Allowable: {wk_allow}mm, Status: {'OK' if crack_width_ok else 'FAIL'}"
    )

# ============================================================================
# PUNCHING SHEAR (Flat Slabs)
# ============================================================================

class PunchingShearRequest(BaseModel):
    column_width: float = Field(..., description="Column width in mm")
    column_depth: float = Field(..., description="Column depth in mm")
    slab_depth: float = Field(..., description="Slab depth in mm")
    effective_depth: float = Field(..., description="Effective depth in mm")
    column_load: float = Field(..., description="Column load in kN")
    concrete_grade: str = Field("C30", description="Concrete grade")
    steel_percentage: float = Field(1.0, description="Reinforcement percentage")

class PunchingShearResponse(BaseModel):
    basic_control_perimeter: float
    shear_stress: float
    concrete_capacity: float
    shear_reinforcement_required: bool
    design_summary: str

@app.post("/api/analysis/punching-shear", response_model=PunchingShearResponse)
async def calculate_punching_shear(request: PunchingShearRequest):
    """Calculate punching shear capacity for flat slabs"""
    
    cx = request.column_width
    cy = request.column_depth
    h = request.slab_depth
    d = request.effective_depth
    V = request.column_load * 1000  # Convert to N
    fcu = BSCodeTables.CONCRETE_GRADES[request.concrete_grade]["fcu"]
    ρ = request.steel_percentage / 100
    
    # Basic control perimeter at 1.5d from column face
    u1 = 2 * (cx + cy) + 2 * math.pi * 1.5 * d
    
    # Shear stress
    v = V / (u1 * d)
    
    # Concrete shear capacity (BS 8110)
    # vc = 0.79(100ρ)^(1/3) (400/d)^(1/4) / γm
    vc = 0.79 * (100 * ρ)**(1/3) * (400 / d)**(1/4) / 1.25
    vc = min(vc, 5.0)  # Maximum limit
    vc = max(vc, 0.4)  # Minimum limit
    
    # Enhanced capacity near column (simplified)
    vc_max = 2.0 * vc
    
    shear_reinforcement_required = v > vc
    
    if v <= vc:
        status = "No shear reinforcement required"
    elif v <= vc_max:
        status = "Shear reinforcement required (links/studs)"
    else:
        status = "Increase slab depth or use shear heads"
    
    return PunchingShearResponse(
        basic_control_perimeter=round(u1, 2),
        shear_stress=round(v, 3),
        concrete_capacity=round(vc, 3),
        shear_reinforcement_required=shear_reinforcement_required,
        design_summary=f"{status}. v={v:.2f} N/mm², vc={vc:.2f} N/mm²"
    )

# ============================================================================
# MATERIAL PROPERTIES
# ============================================================================

@app.get("/api/materials/concrete/{grade}")
async def get_concrete_properties(grade: str):
    """Get concrete material properties"""
    if grade not in BSCodeTables.CONCRETE_GRADES:
        raise HTTPException(status_code=404, detail="Concrete grade not found")
    
    props = BSCodeTables.CONCRETE_GRADES[grade]
    return {
        "grade": grade,
        "characteristic_strength": props["fcu"],
        "design_strength": props["fck"],
        "elastic_modulus": props["Ecm"],
        "density": 25,  # kN/m³
        "poissons_ratio": 0.2,
        "thermal_expansion": 10e-6  # per °C
    }

@app.get("/api/materials/steel/{grade}")
async def get_steel_properties(grade: int):
    """Get steel material properties"""
    if grade not in BSCodeTables.STEEL_GRADES:
        raise HTTPException(status_code=404, detail="Steel grade not found")
    
    props = BSCodeTables.STEEL_GRADES[grade]
    return {
        "grade": grade,
        "yield_strength": props["fy"],
        "elastic_modulus": props["Es"],
        "design_strength": 0.87 * props["fy"],
        "density": 78.5,  # kN/m³
        "thermal_expansion": 12e-6  # per °C
    }

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )