# ============================================================================
# UTILITIES & INFRASTRUCTURE BACKEND
# Production-grade gravity sewer & stormwater drainage design system
# ============================================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal
from enum import Enum
import math

# ============================================================================
# CONSTANTS (SI UNITS)
# ============================================================================

class Constants:
    """Engineering constants and limits - all SI units"""
    GRAVITY = 9.81  # m/s²
    MIN_VELOCITY = 0.6  # m/s (self-cleansing minimum)
    MAX_VELOCITY = 3.0  # m/s (scour protection maximum)
    MIN_COVER = 0.9  # m (minimum cover depth)
    MAX_MANHOLE_SPACING = 90.0  # m
    MIN_GRADIENT = 0.0001  # m/m (0.01%)
    
    # Manning's roughness coefficients
    MANNING_N = {
        "CONCRETE": 0.013,
        "PVC": 0.010,
        "VITRIFIED_CLAY": 0.012,
        "HDPE": 0.010,
        "GRP": 0.009,
    }
    
    # Standard pipe diameters (m)
    STANDARD_DIAMETERS = [
        0.15, 0.225, 0.3, 0.375, 0.45, 0.525, 0.6, 0.675,
        0.75, 0.825, 0.9, 1.05, 1.2, 1.35, 1.5, 1.8, 2.1, 2.4
    ]


# ============================================================================
# ENUMS
# ============================================================================

class PipeMaterial(str, Enum):
    CONCRETE = "CONCRETE"
    PVC = "PVC"
    VITRIFIED_CLAY = "VITRIFIED_CLAY"
    HDPE = "HDPE"
    GRP = "GRP"


# ============================================================================
# SCHEMAS (PYDANTIC MODELS)
# ============================================================================

class SewerFlowRequest(BaseModel):
    """Request schema for sewer flow calculations"""
    population: Optional[int] = Field(None, ge=0, description="Population served")
    per_capita_flow: Optional[float] = Field(None, ge=0, description="Per capita flow (L/person/day)")
    design_flow: Optional[float] = Field(None, ge=0, description="Direct design flow input (m³/s)")
    peak_factor: float = Field(2.5, ge=1.0, le=5.0, description="Peak flow factor")
    infiltration_rate: float = Field(0.0001, ge=0, description="Infiltration rate (m³/s per m)")
    pipe_length: float = Field(gt=0, description="Pipe length (m)")
    
    @validator('design_flow', always=True)
    def validate_flow_inputs(cls, v, values):
        """Ensure either population or design_flow is provided"""
        if v is None and values.get('population') is None:
            raise ValueError("Either design_flow or population must be provided")
        return v


class SewerFlowResponse(BaseModel):
    """Response schema for sewer flow calculations"""
    dry_weather_flow: float = Field(description="Dry weather flow (m³/s)")
    peak_flow: float = Field(description="Peak flow with factor applied (m³/s)")
    infiltration_flow: float = Field(description="Infiltration allowance (m³/s)")
    design_flow: float = Field(description="Total design flow (m³/s)")
    design_flow_litres_per_second: float = Field(description="Design flow (L/s)")
    metadata: dict = Field(description="Calculation metadata")


class PipeCapacityRequest(BaseModel):
    """Request schema for pipe capacity calculations"""
    diameter: float = Field(gt=0, le=3.0, description="Pipe internal diameter (m)")
    slope: float = Field(gt=0, le=0.5, description="Pipe gradient (m/m)")
    material: PipeMaterial = Field(description="Pipe material")
    fill_ratio: float = Field(1.0, ge=0.1, le=1.0, description="Fill ratio (1.0 = full pipe)")
    design_flow: Optional[float] = Field(None, ge=0, description="Design flow for checks (m³/s)")


class PipeCapacityResponse(BaseModel):
    """Response schema for pipe capacity calculations"""
    capacity: float = Field(description="Pipe capacity (m³/s)")
    velocity: float = Field(description="Flow velocity (m/s)")
    flow_area: float = Field(description="Flow area (m²)")
    hydraulic_radius: float = Field(description="Hydraulic radius (m)")
    wetted_perimeter: float = Field(description="Wetted perimeter (m)")
    manning_n: float = Field(description="Manning's roughness coefficient")
    compliance: dict = Field(description="Compliance checks")
    utilization_ratio: Optional[float] = Field(None, description="Flow/Capacity ratio if design_flow provided")


class InvertsRequest(BaseModel):
    """Request schema for invert level calculations"""
    upstream_gl: float = Field(description="Upstream ground level (m)")
    downstream_gl: float = Field(description="Downstream ground level (m)")
    diameter: float = Field(gt=0, le=3.0, description="Pipe diameter (m)")
    slope: float = Field(description="Pipe gradient (m/m)")
    length: float = Field(gt=0, description="Pipe length (m)")
    min_cover: float = Field(Constants.MIN_COVER, ge=0.5, le=3.0, description="Minimum cover requirement (m)")
    upstream_invert_fixed: Optional[float] = Field(None, description="Fixed upstream invert (m) - if specified")


class InvertsResponse(BaseModel):
    """Response schema for invert calculations"""
    upstream_invert: float = Field(description="Upstream invert level (m)")
    downstream_invert: float = Field(description="Downstream invert level (m)")
    upstream_obvert: float = Field(description="Upstream obvert level (m)")
    downstream_obvert: float = Field(description="Downstream obvert level (m)")
    upstream_cover: float = Field(description="Upstream cover depth (m)")
    downstream_cover: float = Field(description="Downstream cover depth (m)")
    invert_drop: float = Field(description="Total invert drop (m)")
    warnings: List[str] = Field(default_factory=list, description="Engineering warnings")
    compliance: dict = Field(description="Compliance status")


class GradientCheckRequest(BaseModel):
    """Request schema for gradient validation"""
    slope: float = Field(description="Pipe gradient (m/m)")
    diameter: float = Field(gt=0, description="Pipe diameter (m)")
    material: PipeMaterial = Field(description="Pipe material")
    design_flow: float = Field(gt=0, description="Design flow (m³/s)")


class GradientCheckResponse(BaseModel):
    """Response schema for gradient checks"""
    slope: float = Field(description="Gradient (m/m)")
    slope_percent: float = Field(description="Gradient (%)")
    slope_ratio: str = Field(description="Gradient as ratio (1:n)")
    velocity: float = Field(description="Flow velocity at this gradient (m/s)")
    compliant: bool = Field(description="Overall compliance")
    checks: dict = Field(description="Individual check results")
    recommendations: List[str] = Field(default_factory=list)


class ManholeSpacingRequest(BaseModel):
    """Request schema for manhole spacing validation"""
    chainages: List[float] = Field(min_items=2, description="Manhole chainages (m)")
    diameter_changes: List[bool] = Field(default_factory=list, description="Diameter change at each node")
    direction_changes: List[float] = Field(default_factory=list, description="Direction change angles (degrees)")
    max_spacing: float = Field(Constants.MAX_MANHOLE_SPACING, description="Maximum spacing (m)")


class ManholeSpacingResponse(BaseModel):
    """Response schema for manhole spacing"""
    total_length: float = Field(description="Total pipe length (m)")
    number_of_manholes: int = Field(description="Number of manholes")
    average_spacing: float = Field(description="Average spacing (m)")
    max_spacing_actual: float = Field(description="Maximum actual spacing (m)")
    compliant: bool = Field(description="Spacing compliance")
    segments: List[dict] = Field(description="Individual segment details")
    warnings: List[str] = Field(default_factory=list)


class StormwaterRunoffRequest(BaseModel):
    """Request schema for stormwater runoff (Rational Method)"""
    catchment_area: float = Field(gt=0, le=10000, description="Catchment area (hectares)")
    runoff_coefficient: float = Field(gt=0, le=1.0, description="Runoff coefficient C")
    rainfall_intensity: float = Field(gt=0, le=500, description="Rainfall intensity (mm/hr)")
    time_of_concentration: Optional[float] = Field(None, ge=0, description="Time of concentration (minutes)")


class StormwaterRunoffResponse(BaseModel):
    """Response schema for stormwater runoff"""
    runoff_rate: float = Field(description="Peak runoff rate (m³/s)")
    runoff_rate_litres: float = Field(description="Peak runoff rate (L/s)")
    method: str = Field(default="Rational Method")
    inputs: dict = Field(description="Input parameters used")
    notes: List[str] = Field(default_factory=list)


class PipeSizingRequest(BaseModel):
    """Request schema for stormwater pipe sizing"""
    design_flow: float = Field(gt=0, description="Design flow (m³/s)")
    min_slope: float = Field(gt=0, description="Minimum available slope (m/m)")
    material: PipeMaterial = Field(description="Pipe material")
    fill_ratio: float = Field(0.85, ge=0.5, le=0.95, description="Maximum fill ratio")


class PipeSizingResponse(BaseModel):
    """Response schema for pipe sizing"""
    recommended_diameter: float = Field(description="Recommended diameter (m)")
    recommended_diameter_mm: int = Field(description="Recommended diameter (mm)")
    capacity: float = Field(description="Pipe capacity at recommended size (m³/s)")
    velocity: float = Field(description="Flow velocity (m/s)")
    utilization: float = Field(description="Capacity utilization ratio")
    compliant: bool = Field(description="Meets all criteria")


class LongSectionRequest(BaseModel):
    """Request schema for long section generation"""
    start_chainage: float = Field(ge=0, description="Start chainage (m)")
    end_chainage: float = Field(gt=0, description="End chainage (m)")
    ground_levels: List[float] = Field(min_items=2, description="Ground levels at chainages (m)")
    chainages: List[float] = Field(min_items=2, description="Chainages for ground levels (m)")
    pipe_diameter: float = Field(gt=0, description="Pipe diameter (m)")
    pipe_slope: float = Field(description="Pipe slope (m/m)")
    upstream_invert: float = Field(description="Upstream invert level (m)")
    interval: float = Field(1.0, gt=0, le=10, description="Chainage interval for output (m)")


class LongSectionResponse(BaseModel):
    """Response schema for long section data"""
    profile_data: List[dict] = Field(description="Profile points")
    total_length: float = Field(description="Total length (m)")
    total_fall: float = Field(description="Total pipe fall (m)")
    metadata: dict = Field(description="Additional information")


class HGLRequest(BaseModel):
    """Request schema for Hydraulic Grade Line calculation"""
    nodes: List[dict] = Field(min_items=2, description="Node data (chainage, invert, diameter)")
    flow: float = Field(gt=0, description="Design flow (m³/s)")
    material: PipeMaterial = Field(description="Pipe material")
    minor_loss_coefficient: float = Field(0.5, ge=0, le=2.0, description="Minor loss coefficient")


class HGLResponse(BaseModel):
    """Response schema for HGL calculation"""
    hgl_data: List[dict] = Field(description="HGL at each node")
    max_hgl: float = Field(description="Maximum HGL (m)")
    min_hgl: float = Field(description="Minimum HGL (m)")
    surcharge_detected: bool = Field(description="Surcharge condition exists")
    surcharge_locations: List[dict] = Field(default_factory=list)
    total_head_loss: float = Field(description="Total head loss (m)")


# ============================================================================
# VALIDATION UTILITIES
# ============================================================================

class Validation:
    """Engineering validation utilities"""
    
    @staticmethod
    def validate_slope(slope: float) -> List[str]:
        """Validate pipe slope"""
        warnings = []
        if slope <= 0:
            warnings.append("CRITICAL: Backfall detected - slope must be positive")
        elif slope < Constants.MIN_GRADIENT:
            warnings.append(f"Slope {slope:.6f} below minimum {Constants.MIN_GRADIENT}")
        elif slope > 0.2:
            warnings.append(f"Excessive slope {slope:.4f} may cause scour issues")
        return warnings
    
    @staticmethod
    def validate_velocity(velocity: float) -> dict:
        """Validate flow velocity"""
        return {
            "velocity": velocity,
            "min_velocity": Constants.MIN_VELOCITY,
            "max_velocity": Constants.MAX_VELOCITY,
            "self_cleansing": velocity >= Constants.MIN_VELOCITY,
            "scour_safe": velocity <= Constants.MAX_VELOCITY,
            "compliant": Constants.MIN_VELOCITY <= velocity <= Constants.MAX_VELOCITY,
        }
    
    @staticmethod
    def validate_cover(cover: float, location: str = "") -> List[str]:
        """Validate cover depth"""
        warnings = []
        if cover < Constants.MIN_COVER:
            warnings.append(f"{location} cover {cover:.3f}m < minimum {Constants.MIN_COVER}m")
        return warnings
    
    @staticmethod
    def find_standard_diameter(required_diameter: float) -> float:
        """Find next standard diameter above required"""
        for d in Constants.STANDARD_DIAMETERS:
            if d >= required_diameter:
                return d
        return Constants.STANDARD_DIAMETERS[-1]


# ============================================================================
# HYDRAULIC CALCULATIONS
# ============================================================================

class Manning:
    """Manning's equation calculations for open channel flow"""
    
    @staticmethod
    def calculate_capacity(
        diameter: float,
        slope: float,
        n: float,
        fill_ratio: float = 1.0
    ) -> dict:
        """
        Calculate pipe capacity using Manning's equation
        
        Args:
            diameter: Internal diameter (m)
            slope: Gradient (m/m)
            n: Manning's roughness coefficient
            fill_ratio: Depth/diameter ratio (1.0 = full pipe)
        
        Returns:
            Dict with capacity, velocity, area, hydraulic_radius, wetted_perimeter
        """
        if slope <= 0:
            raise ValueError(f"Slope must be positive, got {slope}")
        
        radius = diameter / 2
        
        # Full pipe condition
        if fill_ratio >= 0.99:
            area = math.pi * radius * radius
            perimeter = 2 * math.pi * radius
            hydraulic_radius = area / perimeter
            
            # Manning's equation: V = (1/n) * R^(2/3) * S^(1/2)
            velocity = (1 / n) * (hydraulic_radius ** (2/3)) * (slope ** 0.5)
            capacity = area * velocity
            
            return {
                "capacity": capacity,
                "velocity": velocity,
                "area": area,
                "hydraulic_radius": hydraulic_radius,
                "wetted_perimeter": perimeter,
            }
        
        # Partial flow (circular segment geometry)
        theta = 2 * math.acos(1 - 2 * fill_ratio)
        area = (radius ** 2 / 2) * (theta - math.sin(theta))
        perimeter = radius * theta
        hydraulic_radius = area / perimeter if perimeter > 0 else 0
        
        velocity = (1 / n) * (hydraulic_radius ** (2/3)) * (slope ** 0.5)
        capacity = area * velocity
        
        return {
            "capacity": capacity,
            "velocity": velocity,
            "area": area,
            "hydraulic_radius": hydraulic_radius,
            "wetted_perimeter": perimeter,
        }


class Hydraulics:
    """Advanced hydraulic calculations"""
    
    @staticmethod
    def calculate_friction_loss(
        length: float,
        diameter: float,
        velocity: float,
        n: float
    ) -> float:
        """
        Calculate friction head loss using Darcy-Weisbach approximation
        
        Args:
            length: Pipe length (m)
            diameter: Pipe diameter (m)
            velocity: Flow velocity (m/s)
            n: Manning's n
        
        Returns:
            Head loss (m)
        """
        # Simplified Darcy-Weisbach: hf = f * (L/D) * (V²/2g)
        # Friction factor approximation from Manning's n
        f = 0.02  # Simplified constant for turbulent flow
        
        velocity_head = (velocity ** 2) / (2 * Constants.GRAVITY)
        head_loss = f * (length / diameter) * velocity_head
        
        return head_loss
    
    @staticmethod
    def calculate_minor_loss(velocity: float, k: float = 0.5) -> float:
        """
        Calculate minor head loss at fittings
        
        Args:
            velocity: Flow velocity (m/s)
            k: Loss coefficient
        
        Returns:
            Head loss (m)
        """
        return k * (velocity ** 2) / (2 * Constants.GRAVITY)
    
    @staticmethod
    def calculate_hgl_profile(
        nodes: List[dict],
        flow: float,
        n: float,
        minor_loss_k: float = 0.5
    ) -> List[dict]:
        """
        Calculate Hydraulic Grade Line through pipe network
        
        Args:
            nodes: List of {chainage, invert, diameter}
            flow: Design flow (m³/s)
            n: Manning's roughness
            minor_loss_k: Minor loss coefficient
        
        Returns:
            List of HGL data points
        """
        if len(nodes) < 2:
            raise ValueError("Minimum 2 nodes required")
        
        hgl_profile = []
        
        # Start from downstream (assume HGL at invert + 0.5*diameter)
        current_hgl = nodes[-1]["invert"] + nodes[-1]["diameter"] * 0.5
        
        # Work upstream
        for i in range(len(nodes) - 1, -1, -1):
            node = nodes[i]
            obvert = node["invert"] + node["diameter"]
            
            # Check surcharge
            surcharge = current_hgl > obvert
            pressure_head = current_hgl - node["invert"]
            
            hgl_profile.insert(0, {
                "chainage": node["chainage"],
                "invert": node["invert"],
                "obvert": obvert,
                "hgl": current_hgl,
                "pressure_head": pressure_head,
                "surcharge": surcharge,
            })
            
            # Calculate head loss to next upstream node
            if i > 0:
                next_node = nodes[i - 1]
                length = next_node["chainage"] - node["chainage"]
                slope = abs((next_node["invert"] - node["invert"]) / length)
                
                # Get velocity
                manning_result = Manning.calculate_capacity(
                    node["diameter"], slope, n, 1.0
                )
                velocity = manning_result["velocity"]
                
                # Friction loss
                friction_loss = Hydraulics.calculate_friction_loss(
                    length, node["diameter"], velocity, n
                )
                
                # Minor loss at junction
                minor_loss = Hydraulics.calculate_minor_loss(velocity, minor_loss_k)
                
                # Update HGL
                current_hgl += friction_loss + minor_loss
        
        return hgl_profile


# ============================================================================
# API ROUTER
# ============================================================================

router = APIRouter(prefix="/utilities", tags=["Utilities & Infrastructure"])


# ============================================================================
# SEWER ENDPOINTS
# ============================================================================

@router.post("/sewer/flow", response_model=SewerFlowResponse)
def calculate_sewer_flow(request: SewerFlowRequest):
    """
    Calculate design sewer flow from population or direct input
    
    **Engineering Notes:**
    - Dry weather flow: population × per capita flow
    - Peak flow: DWF × peak factor
    - Infiltration: rate × pipe length
    - Design flow: Peak + Infiltration
    """
    # Calculate dry weather flow
    if request.design_flow is not None:
        dry_weather_flow = request.design_flow / request.peak_factor
    else:
        # From population: L/person/day → m³/s
        daily_flow_m3 = (request.population * request.per_capita_flow) / 1000
        dry_weather_flow = daily_flow_m3 / 86400  # Convert to m³/s
    
    # Apply peak factor
    peak_flow = dry_weather_flow * request.peak_factor
    
    # Infiltration allowance
    infiltration_flow = request.infiltration_rate * request.pipe_length
    
    # Total design flow
    total_design_flow = peak_flow + infiltration_flow
    
    return SewerFlowResponse(
        dry_weather_flow=dry_weather_flow,
        peak_flow=peak_flow,
        infiltration_flow=infiltration_flow,
        design_flow=total_design_flow,
        design_flow_litres_per_second=total_design_flow * 1000,
        metadata={
            "peak_factor_applied": request.peak_factor,
            "infiltration_rate_used": request.infiltration_rate,
            "calculation_method": "population" if request.design_flow is None else "direct",
        }
    )


@router.post("/sewer/capacity", response_model=PipeCapacityResponse)
def calculate_pipe_capacity(request: PipeCapacityRequest):
    """
    Calculate pipe capacity using Manning's equation
    
    **Engineering Notes:**
    - Uses Manning's equation for gravity flow
    - Validates velocity against self-cleansing and scour limits
    - Supports partial flow conditions via fill_ratio
    """
    # Get Manning's n
    manning_n = Constants.MANNING_N[request.material.value]
    
    # Calculate capacity
    result = Manning.calculate_capacity(
        request.diameter,
        request.slope,
        manning_n,
        request.fill_ratio
    )
    
    # Velocity compliance
    velocity_check = Validation.validate_velocity(result["velocity"])
    
    # Slope compliance
    slope_warnings = Validation.validate_slope(request.slope)
    
    # Utilization ratio if design flow provided
    utilization = None
    capacity_ok = True
    if request.design_flow is not None:
        utilization = request.design_flow / result["capacity"]
        capacity_ok = utilization <= 1.0
    
    return PipeCapacityResponse(
        capacity=result["capacity"],
        velocity=result["velocity"],
        flow_area=result["area"],
        hydraulic_radius=result["hydraulic_radius"],
        wetted_perimeter=result["wetted_perimeter"],
        manning_n=manning_n,
        compliance={
            "velocity": velocity_check,
            "slope": {
                "compliant": len(slope_warnings) == 0,
                "warnings": slope_warnings,
            },
            "capacity": {
                "adequate": capacity_ok,
                "utilization": utilization,
            } if request.design_flow else None,
        },
        utilization_ratio=utilization,
    )


@router.post("/sewer/inverts", response_model=InvertsResponse)
def calculate_inverts(request: InvertsRequest):
    """
    Calculate pipe invert levels with cover depth validation
    
    **Engineering Notes:**
    - Ensures minimum cover requirements
    - Detects backfall conditions
    - Can work from fixed upstream invert or minimum cover
    """
    warnings = []
    
    # Validate slope
    slope_warnings = Validation.validate_slope(request.slope)
    warnings.extend(slope_warnings)
    
    # Calculate inverts
    if request.upstream_invert_fixed is not None:
        # Use fixed upstream invert
        upstream_invert = request.upstream_invert_fixed
    else:
        # Calculate from minimum cover requirement
        upstream_invert = request.upstream_gl - request.min_cover - request.diameter
    
    # Downstream invert from slope
    downstream_invert = upstream_invert - (request.slope * request.length)
    
    # Obvert levels
    upstream_obvert = upstream_invert + request.diameter
    downstream_obvert = downstream_invert + request.diameter
    
    # Cover depths
    upstream_cover = request.upstream_gl - upstream_obvert
    downstream_cover = request.downstream_gl - downstream_obvert
    
    # Validate cover
    warnings.extend(Validation.validate_cover(upstream_cover, "Upstream"))
    warnings.extend(Validation.validate_cover(downstream_cover, "Downstream"))
    
    # Invert drop
    invert_drop = upstream_invert - downstream_invert
    
    return InvertsResponse(
        upstream_invert=upstream_invert,
        downstream_invert=downstream_invert,
        upstream_obvert=upstream_obvert,
        downstream_obvert=downstream_obvert,
        upstream_cover=upstream_cover,
        downstream_cover=downstream_cover,
        invert_drop=invert_drop,
        warnings=warnings,
        compliance={
            "upstream_cover_ok": upstream_cover >= request.min_cover,
            "downstream_cover_ok": downstream_cover >= request.min_cover,
            "slope_ok": request.slope > 0,
            "overall_compliant": len(warnings) == 0,
        }
    )


@router.post("/sewer/gradients", response_model=GradientCheckResponse)
def check_gradient(request: GradientCheckRequest):
    """
    Validate pipe gradient for hydraulic and constructability requirements
    
    **Engineering Notes:**
    - Checks minimum gradient for self-cleansing
    - Checks maximum velocity to prevent scour
    - Provides ratio and percentage formats
    """
    # Get Manning's n
    manning_n = Constants.MANNING_N[request.material.value]
    
    # Calculate velocity at this gradient
    result = Manning.calculate_capacity(
        request.diameter,
        request.slope,
        manning_n,
        1.0
    )
    
    # Validate
    slope_warnings = Validation.validate_slope(request.slope)
    velocity_check = Validation.validate_velocity(result["velocity"])
    
    # Slope formats
    slope_percent = request.slope * 100
    slope_ratio = f"1:{int(1/request.slope)}" if request.slope > 0 else "Invalid"
    
    recommendations = []
    if not velocity_check["self_cleansing"]:
        recommendations.append(f"Increase slope to achieve minimum velocity {Constants.MIN_VELOCITY} m/s")
    if not velocity_check["scour_safe"]:
        recommendations.append(f"Reduce slope or increase diameter to limit velocity to {Constants.MAX_VELOCITY} m/s")
    
    return GradientCheckResponse(
        slope=request.slope,
        slope_percent=slope_percent,
        slope_ratio=slope_ratio,
        velocity=result["velocity"],
        compliant=velocity_check["compliant"] and len(slope_warnings) == 0,
        checks={
            "slope_positive": request.slope > 0,
            "slope_above_minimum": request.slope >= Constants.MIN_GRADIENT,
            "velocity_self_cleansing": velocity_check["self_cleansing"],
            "velocity_scour_safe": velocity_check["scour_safe"],
        },
        recommendations=recommendations,
    )


@router.post("/sewer/manholes", response_model=ManholeSpacingResponse)
def validate_manhole_spacing(request: ManholeSpacingRequest):
    """
    Validate manhole spacing against maximum spacing requirements
    
    **Engineering Notes:**
    - Maximum spacing typically 90m for maintenance access
    - Manholes required at diameter changes and direction changes
    - Junction nodes require manholes
    """
    if len(request.chainages) < 2:
        raise HTTPException(400, "Minimum 2 manholes required")
    
    # Sort chainages
    chainages = sorted(request.chainages)
    
    # Calculate segments
    segments = []
    warnings = []
    max_actual = 0
    
    for i in range(1, len(chainages)):
        spacing = chainages[i] - chainages[i-1]
        max_actual = max(max_actual, spacing)
        
        compliant = spacing <= request.max_spacing
        
        segment = {
            "from_chainage": chainages[i-1],
            "to_chainage": chainages[i],
            "spacing": spacing,
            "compliant": compliant,
        }
        
        if not compliant:
            warnings.append(
                f"Spacing {spacing:.1f}m exceeds maximum {request.max_spacing}m "
                f"between CH{chainages[i-1]:.0f} and CH{chainages[i]:.0f}"
            )
        
        segments.append(segment)
    
    total_length = chainages[-1] - chainages[0]
    avg_spacing = total_length / (len(chainages) - 1)
    
    return ManholeSpacingResponse(
        total_length=total_length,
        number_of_manholes=len(chainages),
        average_spacing=avg_spacing,
        max_spacing_actual=max_actual,
        compliant=len(warnings) == 0,
        segments=segments,
        warnings=warnings,
    )


# ============================================================================
# STORMWATER ENDPOINTS
# ============================================================================

@router.post("/stormwater/runoff", response_model=StormwaterRunoffResponse)
def calculate_stormwater_runoff(request: StormwaterRunoffRequest):
    """
    Calculate stormwater runoff using Rational Method
    
    **Formula:** Q = (C × I × A) / 360
    - Q: Peak runoff (m³/s)
    - C: Runoff coefficient (dimensionless)
    - I: Rainfall intensity (mm/hr)
    - A: Catchment area (hectares)
    
    **Valid for:** Catchments up to ~80 hectares
    """
    # Rational Method: Q = C * I * A / 360
    runoff_m3s = (
        request.runoff_coefficient * 
        request.rainfall_intensity * 
        request.catchment_area
    ) / 360
    
    runoff_litres = runoff_m3s * 1000
    
    notes = [
        "Rational Method assumes uniform rainfall over catchment",
        "Valid for catchments up to approximately 80 hectares",
        "Time of concentration affects peak intensity",
    ]
    
    if request.catchment_area > 80:
        notes.append("WARNING: Catchment exceeds typical Rational Method limit (80 ha)")
    
    return StormwaterRunoffResponse(
        runoff_rate=runoff_m3s,
        runoff_rate_litres=runoff_litres,
        method="Rational Method",
        inputs={
            "catchment_area_ha": request.catchment_area,
            "runoff_coefficient": request.runoff_coefficient,
            "rainfall_intensity_mm_hr": request.rainfall_intensity,
            "time_of_concentration_min": request.time_of_concentration,
        },
        notes=notes,
    )


@router.post("/stormwater/pipe-sizing", response_model=PipeSizingResponse)
def size_stormwater_pipe(request: PipeSizingRequest):
    """
    Recommend pipe size for stormwater drainage
    
    **Engineering Notes:**
    - Iterates through standard diameters
    - Ensures velocity compliance
    - Targets specified fill ratio (typically 85% for stormwater)
    """
    # Get Manning's n
    manning_n = Constants.MANNING_N[request.material.value]
    
    # Find minimum diameter that satisfies all requirements
    selected_diameter = None
    
    for diameter in Constants.STANDARD_DIAMETERS:
        # Calculate capacity at target fill ratio
        result = Manning.calculate_capacity(
            diameter,
            request.min_slope,
            manning_n,
            request.fill_ratio
        )
        
        # Check if capacity sufficient
        if result["capacity"] >= request.design_flow:
            # Check velocity compliance
            velocity_check = Validation.validate_velocity(result["velocity"])
            
            if velocity_check["compliant"]:
                selected_diameter = diameter
                selected_result = result
                break
    
    if selected_diameter is None:
        # Use largest standard diameter
        selected_diameter = Constants.STANDARD_DIAMETERS[-1]
        selected_result = Manning.calculate_capacity(
            selected_diameter,
            request.min_slope,
            manning_n,
            request.fill_ratio
        )
    
    utilization = request.design_flow / selected_result["capacity"]
    compliant = (
        utilization <= 1.0 and
        Constants.MIN_VELOCITY <= selected_result["velocity"] <= Constants.MAX_VELOCITY
    )
    
    return PipeSizingResponse(
        recommended_diameter=selected_diameter,
        recommended_diameter_mm=int(selected_diameter * 1000),
        capacity=selected_result["capacity"],
        velocity=selected_result["velocity"],
        utilization=utilization,
        compliant=compliant,
    )


# ============================================================================
# PROFILE ENDPOINTS
# ============================================================================

@router.post("/profiles/long-section", response_model=LongSectionResponse)
def generate_long_section(request: LongSectionRequest):
    """
    Generate long section profile data
    
    **Output includes:**
    - Chainage
    - Ground level
    - Pipe invert
    - Pipe obvert
    - Cover depth
    
    **Engineering Notes:**
    - Linear interpolation for ground levels between survey points
    - Pipe follows constant gradient
    """
    if len(request.chainages) != len(request.ground_levels):
        raise HTTPException(400, "Chainages and ground_levels must have same length")
    
    profile_data = []
    
    # Generate points at specified interval
    current_ch = request.start_chainage
    
    while current_ch <= request.end_chainage:
        # Interpolate ground level
        ground_level = None
        for i in range(len(request.chainages) - 1):
            if request.chainages[i] <= current_ch <= request.chainages[i + 1]:
                # Linear interpolation
                t = (current_ch - request.chainages[i]) / (
                    request.chainages[i + 1] - request.chainages[i]
                )
                ground_level = request.ground_levels[i] + t * (
                    request.ground_levels[i + 1] - request.ground_levels[i]
                )
                break
        
        if ground_level is None:
            # Extrapolate if outside range
            if current_ch < request.chainages[0]:
                ground_level = request.ground_levels[0]
            else:
                ground_level = request.ground_levels[-1]
        
        # Calculate pipe levels
        pipe_fall = (current_ch - request.start_chainage) * request.pipe_slope
        invert = request.upstream_invert - pipe_fall
        obvert = invert + request.pipe_diameter
        cover = ground_level - obvert
        
        profile_data.append({
            "chainage": round(current_ch, 3),
            "ground_level": round(ground_level, 3),
            "pipe_invert": round(invert, 3),
            "pipe_obvert": round(obvert, 3),
            "cover_depth": round(cover, 3),
        })
        
        current_ch += request.interval
    
    # Ensure end chainage is included
    if profile_data[-1]["chainage"] != request.end_chainage:
        current_ch = request.end_chainage
        # Repeat interpolation for end point
        ground_level = request.ground_levels[-1]
        pipe_fall = (current_ch - request.start_chainage) * request.pipe_slope
        invert = request.upstream_invert - pipe_fall
        obvert = invert + request.pipe_diameter
        cover = ground_level - obvert
        
        profile_data.append({
            "chainage": round(current_ch, 3),
            "ground_level": round(ground_level, 3),
            "pipe_invert": round(invert, 3),
            "pipe_obvert": round(obvert, 3),
            "cover_depth": round(cover, 3),
        })
    
    total_length = request.end_chainage - request.start_chainage
    total_fall = total_length * request.pipe_slope
    
    return LongSectionResponse(
        profile_data=profile_data,
        total_length=total_length,
        total_fall=total_fall,
        metadata={
            "number_of_points": len(profile_data),
            "interval_used": request.interval,
            "gradient": request.pipe_slope,
            "gradient_percent": request.pipe_slope * 100,
        }
    )


# ============================================================================
# HYDRAULIC GRADE LINE ENDPOINT
# ============================================================================

@router.post("/hydraulics/hgl", response_model=HGLResponse)
def calculate_hgl(request: HGLRequest):
    """
    Calculate Hydraulic Grade Line through pipe network
    
    **Engineering Notes:**
    - Steady-state analysis only
    - Includes friction and minor losses
    - Detects surcharge conditions (HGL > pipe crown)
    - Works upstream from downstream boundary
    
    **Assumptions:**
    - Downstream HGL = invert + 0.5 × diameter
    - Uniform flow in each segment
    - No unsteady flow effects
    """
    # Validate nodes
    if len(request.nodes) < 2:
        raise HTTPException(400, "Minimum 2 nodes required")
    
    # Get Manning's n
    manning_n = Constants.MANNING_N[request.material.value]
    
    # Calculate HGL profile
    hgl_profile = Hydraulics.calculate_hgl_profile(
        request.nodes,
        request.flow,
        manning_n,
        request.minor_loss_coefficient
    )
    
    # Extract surcharge locations
    surcharge_locations = [
        {
            "chainage": point["chainage"],
            "hgl": point["hgl"],
            "pipe_crown": point["obvert"],
            "surcharge_depth": point["hgl"] - point["obvert"],
        }
        for point in hgl_profile
        if point["surcharge"]
    ]
    
    # Calculate total head loss
    total_head_loss = hgl_profile[-1]["hgl"] - hgl_profile[0]["hgl"]
    
    # Find max/min HGL
    max_hgl = max(p["hgl"] for p in hgl_profile)
    min_hgl = min(p["hgl"] for p in hgl_profile)
    
    return HGLResponse(
        hgl_data=hgl_profile,
        max_hgl=max_hgl,
        min_hgl=min_hgl,
        surcharge_detected=len(surcharge_locations) > 0,
        surcharge_locations=surcharge_locations,
        total_head_loss=total_head_loss,
    )


# ============================================================================
# ADDITIONAL UTILITY ENDPOINTS
# ============================================================================

@router.get("/constants")
def get_engineering_constants():
    """
    Return all engineering constants and standards used
    
    **For reference and documentation purposes**
    """
    return {
        "gravity": Constants.GRAVITY,
        "velocity_limits": {
            "minimum": Constants.MIN_VELOCITY,
            "maximum": Constants.MAX_VELOCITY,
            "units": "m/s",
        },
        "cover_depth": {
            "minimum": Constants.MIN_COVER,
            "units": "m",
        },
        "manhole_spacing": {
            "maximum": Constants.MAX_MANHOLE_SPACING,
            "units": "m",
        },
        "minimum_gradient": {
            "value": Constants.MIN_GRADIENT,
            "percent": Constants.MIN_GRADIENT * 100,
            "units": "m/m",
        },
        "manning_coefficients": Constants.MANNING_N,
        "standard_diameters": {
            "values": Constants.STANDARD_DIAMETERS,
            "units": "m",
        },
    }


@router.get("/health")
def health_check():
    """API health check endpoint"""
    return {
        "status": "operational",
        "module": "Utilities & Infrastructure",
        "version": "1.0.0",
        "standards": "SI Units",
    }


# ============================================================================
# EXAMPLE USAGE (for testing/documentation)
# ============================================================================

"""
EXAMPLE REQUESTS:

1. Calculate sewer flow from population:
POST /utilities/sewer/flow
{
    "population": 5000,
    "per_capita_flow": 250,
    "peak_factor": 2.5,
    "infiltration_rate": 0.0001,
    "pipe_length": 100
}

2. Check pipe capacity:
POST /utilities/sewer/capacity
{
    "diameter": 0.3,
    "slope": 0.01,
    "material": "CONCRETE",
    "fill_ratio": 1.0,
    "design_flow": 0.05
}

3. Calculate inverts:
POST /utilities/sewer/inverts
{
    "upstream_gl": 100.0,
    "downstream_gl": 99.5,
    "diameter": 0.3,
    "slope": 0.01,
    "length": 50,
    "min_cover": 0.9
}

4. Stormwater runoff:
POST /utilities/stormwater/runoff
{
    "catchment_area": 2.0,
    "runoff_coefficient": 0.65,
    "rainfall_intensity": 80
}

5. Generate long section:
POST /utilities/profiles/long-section
{
    "start_chainage": 0,
    "end_chainage": 100,
    "ground_levels": [100.0, 99.5, 99.0],
    "chainages": [0, 50, 100],
    "pipe_diameter": 0.3,
    "pipe_slope": 0.01,
    "upstream_invert": 98.2,
    "interval": 5
}

6. Calculate HGL:
POST /utilities/hydraulics/hgl
{
    "nodes": [
        {"chainage": 0, "invert": 98.2, "diameter": 0.3},
        {"chainage": 50, "invert": 97.7, "diameter": 0.3},
        {"chainage": 100, "invert": 97.2, "diameter": 0.3}
    ],
    "flow": 0.05,
    "material": "CONCRETE",
    "minor_loss_coefficient": 0.5
}
"""