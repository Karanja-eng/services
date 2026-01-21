# ============================================================================
# BACKEND STRUCTURE
# ============================================================================
# backend/
#  ├── earthworks/
#  │    ├── router.py              (this file - main router)
#  │    ├── schemas.py             (Pydantic models)
#  │    ├── constants.py           (Engineering constants)
#  │    ├── validation.py          (Input validation)
#  │    ├── areas/
#  │    │    ├── coordinate.py
#  │    │    ├── triangulation.py
#  │    │    ├── simpson.py
#  │    │    └── trapezoidal.py
#  │    ├── volumes/
#  │    │    ├── cut_fill.py
#  │    │    ├── end_area.py
#  │    │    └── borrow_spoil.py
#  │    └── mass_haul/
#  │         ├── accumulation.py
#  │         └── diagram.py
# ============================================================================

# ============================================================================
# FILE: backend/earthworks/constants.py
# ============================================================================
"""
Engineering constants and default values for earthworks calculations.
Based on AASHTO standards and common civil engineering practice.
"""

# Closure tolerances
CLOSURE_TOLERANCE_METERS = 0.001  # 1mm closure error acceptable

# Volume calculation factors
DEFAULT_SHRINKAGE_FACTOR = 0.90  # Compacted/in-situ ratio
DEFAULT_SWELL_FACTOR = 1.25      # Loose/in-situ ratio

# Mass haul parameters
DEFAULT_FREE_HAUL_DISTANCE = 100.0  # meters
DEFAULT_OVERHAUL_UNIT_COST = 0.50   # cost per m³ per meter

# Precision standards
AREA_DECIMAL_PLACES = 3
VOLUME_DECIMAL_PLACES = 2
CHAINAGE_DECIMAL_PLACES = 2

# Validation limits
MIN_POLYGON_VERTICES = 3
MIN_CROSS_SECTIONS = 2
MAX_CHAINAGE_GAP = 1000.0  # meters

# Material density factors (typical values)
MATERIAL_FACTORS = {
    "common_excavation": {"swell": 1.25, "shrinkage": 0.90},
    "rock_excavation": {"swell": 1.60, "shrinkage": 0.85},
    "select_fill": {"swell": 1.15, "shrinkage": 0.95},
    "topsoil": {"swell": 1.20, "shrinkage": 0.92}
}


# ============================================================================
# FILE: backend/earthworks/schemas.py
# ============================================================================
"""
Pydantic schemas for request/response validation.
All schemas enforce engineering data integrity.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal
from enum import Enum


class CoordinatePoint(BaseModel):
    """Single surveyed coordinate point"""
    x: float = Field(..., description="Easting or X coordinate in meters")
    y: float = Field(..., description="Northing or Y coordinate in meters")
    
    class Config:
        json_schema_extra = {
            "example": {"x": 1000.0, "y": 2000.0}
        }


class AreaMethod(str, Enum):
    """Supported area calculation methods"""
    COORDINATE = "coordinate"
    TRIANGULATION = "triangulation"
    TRAPEZOIDAL = "trapezoidal"
    SIMPSON = "simpson"


class CoordinateAreaRequest(BaseModel):
    """Request schema for coordinate-based area calculation"""
    coordinates: List[CoordinatePoint] = Field(..., min_items=3)
    
    @validator('coordinates')
    def validate_minimum_vertices(cls, v):
        if len(v) < 3:
            raise ValueError("Minimum 3 vertices required for area calculation")
        return v


class CoordinateAreaResponse(BaseModel):
    """Response schema for coordinate area calculation"""
    area: float = Field(..., description="Calculated area in m²")
    orientation: Literal["clockwise", "counterclockwise"]
    closure_error: float = Field(..., description="Closure error in meters")
    vertex_count: int
    method: str = "coordinate"
    units: str = "m²"


class TriangulationAreaResponse(BaseModel):
    """Response schema for triangulation area calculation"""
    area: float = Field(..., description="Total area in m²")
    triangle_count: int
    method: str = "triangulation"
    units: str = "m²"


class CrossSectionData(BaseModel):
    """Cross-section offset and height data"""
    offsets: List[float] = Field(..., description="Offset distances from centerline (m)")
    heights: List[float] = Field(..., description="Heights or depths at each offset (m)")
    spacing: Optional[List[float]] = Field(None, description="Custom spacing between offsets")
    
    @validator('heights')
    def validate_equal_length(cls, v, values):
        if 'offsets' in values and len(v) != len(values['offsets']):
            raise ValueError("Offsets and heights must have equal length")
        return v


class TrapezoidalAreaResponse(BaseModel):
    """Response for trapezoidal rule area calculation"""
    area: float
    intervals: int
    method: str = "trapezoidal"
    units: str = "m²"


class SimpsonAreaResponse(BaseModel):
    """Response for Simpson's rule area calculation"""
    area: float
    intervals: int
    spacing: float
    method: str = "simpson"
    units: str = "m²"


class EndAreaVolumeRequest(BaseModel):
    """Request for end-area volume calculation"""
    areas: List[float] = Field(..., min_items=2, description="Cross-section areas in m²")
    chainages: List[float] = Field(..., min_items=2, description="Chainage stations in meters")
    use_prismoidal_correction: bool = Field(False, description="Apply prismoidal correction")
    
    @validator('chainages')
    def validate_equal_length(cls, v, values):
        if 'areas' in values and len(v) != len(values['areas']):
            raise ValueError("Areas and chainages must have equal length")
        return v
    
    @validator('chainages')
    def validate_monotonic(cls, v):
        if not all(v[i] < v[i+1] for i in range(len(v)-1)):
            raise ValueError("Chainages must be in ascending order")
        return v


class VolumeSegment(BaseModel):
    """Individual volume segment between two cross-sections"""
    start_chainage: float
    end_chainage: float
    length: float
    start_area: float
    end_area: float
    volume: float


class EndAreaVolumeResponse(BaseModel):
    """Response for end-area volume calculation"""
    total_volume: float = Field(..., description="Total volume in m³")
    segment_count: int
    segments: List[VolumeSegment]
    prismoidal_correction: bool
    method: str = "end_area"
    units: str = "m³"


class CutFillRequest(BaseModel):
    """Request for cut/fill volume calculation"""
    existing_levels: List[float] = Field(..., description="Existing ground levels (m)")
    formation_levels: List[float] = Field(..., description="Design formation levels (m)")
    areas: List[float] = Field(..., description="Cross-section areas (m²)")
    chainages: List[float] = Field(..., description="Chainage stations (m)")
    
    @validator('formation_levels', 'areas', 'chainages')
    def validate_equal_length(cls, v, values):
        if 'existing_levels' in values and len(v) != len(values['existing_levels']):
            raise ValueError("All input arrays must have equal length")
        return v


class CutFillSection(BaseModel):
    """Individual cut/fill section"""
    chainage: float
    existing_level: float
    formation_level: float
    depth: float
    area: float
    volume: float
    type: Literal["cut", "fill"]


class CutFillResponse(BaseModel):
    """Response for cut/fill calculation"""
    total_cut: float = Field(..., description="Total cut volume (m³)")
    total_fill: float = Field(..., description="Total fill volume (m³)")
    net_volume: float = Field(..., description="Net volume balance (m³)")
    sections: List[CutFillSection]
    method: str = "cut_fill"
    units: str = "m³"


class BorrowSpoilRequest(BaseModel):
    """Request for borrow/spoil calculation"""
    cut_volume: float = Field(..., ge=0, description="Cut volume in m³")
    fill_volume: float = Field(..., ge=0, description="Fill volume in m³")
    shrinkage_factor: float = Field(DEFAULT_SHRINKAGE_FACTOR, gt=0, le=1)
    swell_factor: float = Field(DEFAULT_SWELL_FACTOR, ge=1)


class BorrowSpoilResponse(BaseModel):
    """Response for borrow/spoil calculation"""
    cut_volume: float
    fill_volume: float
    net_balance: float
    borrow_required: float = Field(..., description="In-situ borrow required (m³)")
    spoil_generated: float = Field(..., description="Loose spoil to dispose (m³)")
    shrinkage_factor: float
    swell_factor: float
    cut_loose_volume: float
    fill_insitu_volume: float
    method: str = "borrow_spoil"
    units: str = "m³"


class MassHaulRequest(BaseModel):
    """Request for mass haul diagram generation"""
    chainages: List[float] = Field(..., min_items=2)
    cut_volumes: List[float] = Field(..., min_items=2)
    fill_volumes: List[float] = Field(..., min_items=2)
    free_haul_distance: float = Field(DEFAULT_FREE_HAUL_DISTANCE, gt=0)
    
    @validator('cut_volumes', 'fill_volumes')
    def validate_equal_length(cls, v, values):
        if 'chainages' in values and len(v) != len(values['chainages']):
            raise ValueError("All arrays must have equal length")
        return v


class MassHaulPoint(BaseModel):
    """Single point on mass haul diagram"""
    chainage: float
    cut_volume: float
    fill_volume: float
    net_volume: float
    cumulative_volume: float


class HaulZone(BaseModel):
    """Haul zone analysis"""
    start_chainage: float
    end_chainage: float
    distance: float
    volume: float
    is_free_haul: bool
    is_overhaul: bool


class MassHaulResponse(BaseModel):
    """Response for mass haul calculation"""
    diagram: List[MassHaulPoint]
    balance_points: List[float] = Field(..., description="Chainages where cumulative = 0")
    haul_zones: List[HaulZone]
    final_balance: float
    free_haul_distance: float
    method: str = "mass_haul"


# ============================================================================
# FILE: backend/earthworks/validation.py
# ============================================================================
"""
Input validation utilities for earthworks calculations.
Enforces engineering constraints and data integrity.
"""

import math
from typing import List, Tuple
# Constants are defined at the top of this file


def validate_closure(coordinates: List[Tuple[float, float]]) -> float:
    """
    Calculate closure error for a polygon.
    Returns closure distance in meters.
    """
    if len(coordinates) < 3:
        raise ValueError("Minimum 3 vertices required")
    
    first = coordinates[0]
    last = coordinates[-1]
    
    closure_error = math.sqrt(
        (last[0] - first[0])**2 + (last[1] - first[1])**2
    )
    
    return closure_error


def validate_monotonic_chainages(chainages: List[float]) -> None:
    """Ensure chainages are strictly increasing"""
    for i in range(len(chainages) - 1):
        if chainages[i] >= chainages[i + 1]:
            raise ValueError(
                f"Chainages must be strictly increasing. "
                f"Found {chainages[i]} >= {chainages[i+1]} at index {i}"
            )


def validate_equal_spacing(offsets: List[float], tolerance: float = 0.001) -> Tuple[bool, float]:
    """
    Check if offsets are equally spaced.
    Returns (is_equal, spacing)
    """
    if len(offsets) < 2:
        return True, 0.0
    
    spacing = offsets[1] - offsets[0]
    
    for i in range(1, len(offsets) - 1):
        current_spacing = offsets[i + 1] - offsets[i]
        if abs(current_spacing - spacing) > tolerance:
            return False, spacing
    
    return True, spacing


def validate_even_intervals(count: int) -> None:
    """Validate even number of intervals for Simpson's rule"""
    if (count - 1) % 2 != 0:
        raise ValueError(
            f"Simpson's rule requires even number of intervals (odd number of points). "
            f"Got {count} points = {count-1} intervals"
        )


# ============================================================================
# FILE: backend/earthworks/areas/coordinate.py
# ============================================================================
"""
Coordinate Method (Surveyor's Formula / Shoelace Formula)
For irregular polygons using surveyed coordinates.
"""

import math
from typing import List, Tuple, Dict, Any
# validate_closure and CLOSURE_TOLERANCE_METERS are defined in this file


def calculate_coordinate_area(coordinates: List[Tuple[float, float]]) -> Dict[str, Any]:
    """
    Calculate area using coordinate method (shoelace formula).
    
    Args:
        coordinates: List of (x, y) tuples representing polygon vertices
    
    Returns:
        Dictionary containing area, orientation, closure error, etc.
    
    Engineering Notes:
        - Uses signed area calculation
        - Automatically handles clockwise/counterclockwise orientation
        - Detects and reports closure errors
        - Auto-closes polygon if closure error > tolerance
    """
    if len(coordinates) < 3:
        raise ValueError("Minimum 3 vertices required for area calculation")
    
    # Check closure
    closure_error = validate_closure(coordinates)
    
    # Auto-close if needed
    coords = list(coordinates)
    if closure_error > CLOSURE_TOLERANCE_METERS:
        coords.append(coordinates[0])
    
    # Shoelace formula for signed area
    # A = 0.5 * |Sum(x_i * y_{i+1} - x_{i+1} * y_i)|
    signed_area = 0.0
    
    for i in range(len(coords) - 1):
        x1, y1 = coords[i]
        x2, y2 = coords[i + 1]
        signed_area += (x1 * y2 - x2 * y1)
    
    signed_area /= 2.0
    
    # Determine orientation
    orientation = "counterclockwise" if signed_area > 0 else "clockwise"
    area = abs(signed_area)
    
    return {
        "area": area,
        "orientation": orientation,
        "closure_error": closure_error,
        "vertex_count": len(coordinates),
        "method": "coordinate",
        "units": "m2"
    }


# ============================================================================
# FILE: backend/earthworks/areas/triangulation.py
# ============================================================================
"""
Triangulation Method
Subdivides polygon into triangles and uses Heron's formula.
"""

import math
from typing import List, Tuple, Dict, Any


def calculate_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Calculate Euclidean distance between two points"""
    return math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)


def calculate_triangle_area_heron(a: float, b: float, c: float) -> float:
    """
    Calculate triangle area using Heron's formula.
    
    A = sqrt(s(s-a)(s-b)(s-c))
    where s = (a+b+c)/2 (semi-perimeter)
    """
    s = (a + b + c) / 2.0
    area_squared = s * (s - a) * (s - b) * (s - c)
    
    if area_squared < 0:
        raise ValueError("Invalid triangle: sides do not form a valid triangle")
    
    return math.sqrt(area_squared)


def calculate_triangulation_area(coordinates: List[Tuple[float, float]]) -> Dict[str, Any]:
    """
    Calculate area using triangulation method (fan triangulation from first vertex).
    
    Args:
        coordinates: List of (x, y) tuples
    
    Returns:
        Dictionary with total area and triangle details
    
    Engineering Notes:
        - Uses fan triangulation from first vertex
        - Each triangle calculated with Heron's formula
        - Provides breakdown of individual triangles for verification
    """
    if len(coordinates) < 3:
        raise ValueError("Minimum 3 vertices required")
    
    total_area = 0.0
    triangles = []
    
    # Fan triangulation: connect all vertices to first vertex
    p0 = coordinates[0]
    
    for i in range(1, len(coordinates) - 1):
        p1 = coordinates[i]
        p2 = coordinates[i + 1]
        
        # Calculate triangle sides
        a = calculate_distance(p0, p1)
        b = calculate_distance(p1, p2)
        c = calculate_distance(p2, p0)
        
        # Calculate area using Heron's formula
        try:
            area = calculate_triangle_area_heron(a, b, c)
            total_area += area
            
            triangles.append({
                "vertices": [p0, p1, p2],
                "sides": [a, b, c],
                "area": area
            })
        except ValueError:
            # Degenerate triangle (collinear points)
            continue
    
    return {
        "area": total_area,
        "triangle_count": len(triangles),
        "triangles": triangles,
        "method": "triangulation",
        "units": "m2"
    }


# ============================================================================
# FILE: backend/earthworks/areas/trapezoidal.py
# ============================================================================
"""
Trapezoidal Rule for cross-sectional area calculation.
Supports both equal and unequal spacing.
"""

from typing import List, Optional, Dict, Any


def calculate_trapezoidal_area(
    offsets: List[float],
    heights: List[float],
    spacing: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Calculate area using trapezoidal rule.
    
    Args:
        offsets: Offset distances from centerline (m)
        heights: Heights/depths at each offset (m)
        spacing: Custom spacing between offsets (optional)
    
    Returns:
        Dictionary with calculated area
    
    Engineering Notes:
        - Formula: A = Sum[width_i * (h_i + h_{i+1}) / 2]
        - Handles both equal and variable spacing
        - Suitable for cross-sections with straight segments
    """
    if len(offsets) != len(heights):
        raise ValueError("Offsets and heights must have equal length")
    
    if len(offsets) < 2:
        raise ValueError("Minimum 2 points required")
    
    area = 0.0
    
    for i in range(len(offsets) - 1):
        h1 = heights[i]
        h2 = heights[i + 1]
        
        # Determine width
        if spacing is not None:
            if i >= len(spacing):
                raise ValueError("Spacing array too short")
            width = spacing[i]
        else:
            width = offsets[i + 1] - offsets[i]
        
        # Trapezoidal formula
        segment_area = width * (h1 + h2) / 2.0
        area += segment_area
    
    return {
        "area": abs(area),
        "intervals": len(offsets) - 1,
        "method": "trapezoidal",
        "units": "m2"
    }


# ============================================================================
# FILE: backend/earthworks/areas/simpson.py
# ============================================================================
"""
Simpson's Rule for cross-sectional area calculation.
More accurate than trapezoidal for curved sections.
Requires even number of intervals.
"""

from typing import List, Dict, Any
# validate_equal_spacing and validate_even_intervals are defined in this file


def calculate_simpson_area(offsets: List[float], heights: List[float]) -> Dict[str, Any]:
    """
    Calculate area using Simpson's 1/3 rule.
    
    Args:
        offsets: Equally-spaced offset distances
        heights: Heights at each offset
    
    Returns:
        Dictionary with calculated area
    
    Engineering Notes:
        - Formula: A = (h/3) * [y0 + 4*y1 + 2*y2 + 4*y3 + ... + yn]
        - Requires EVEN number of intervals (ODD number of points)
        - Requires EQUAL spacing
        - More accurate than trapezoidal for parabolic profiles
    """
    if len(offsets) != len(heights):
        raise ValueError("Offsets and heights must have equal length")
    
    n = len(offsets) - 1  # number of intervals
    
    # Validate even intervals
    validate_even_intervals(len(offsets))
    
    # Validate equal spacing
    is_equal, spacing = validate_equal_spacing(offsets)
    if not is_equal:
        raise ValueError("Simpson's rule requires equal spacing")
    
    # Simpson's 1/3 rule
    # Sum: first + last + 4*(odd indices) + 2*(even indices, excluding first and last)
    total = heights[0] + heights[n]
    
    for i in range(1, n):
        coefficient = 4 if i % 2 == 1 else 2
        total += coefficient * heights[i]
    
    area = (spacing / 3.0) * total
    
    return {
        "area": abs(area),
        "intervals": n,
        "spacing": spacing,
        "method": "simpson",
        "units": "m2"
    }


# ============================================================================
# FILE: backend/earthworks/volumes/end_area.py
# ============================================================================
"""
End-Area Method for volume calculation.
Standard method for earthworks between successive cross-sections.
"""

from typing import List, Dict, Any
# validate_monotonic_chainages is defined in this file


def calculate_end_area_volume(
    areas: List[float],
    chainages: List[float],
    use_prismoidal_correction: bool = False
) -> Dict[str, Any]:
    """
    Calculate volume using end-area method.
    
    Args:
        areas: Cross-section areas (m²)
        chainages: Chainage stations (m)
        use_prismoidal_correction: Apply prismoidal correction
    
    Returns:
        Dictionary with total volume and segment details
    
    Engineering Notes:
        - Basic formula: V = (A1 + A2) / 2 * L
        - Prismoidal correction: V = L/6 * (A1 + 4*Am + A2)
        - Standard method in highway/railway earthworks
    """
    if len(areas) != len(chainages):
        raise ValueError("Areas and chainages must have equal length")
    
    if len(areas) < 2:
        raise ValueError("Minimum 2 cross-sections required")
    
    validate_monotonic_chainages(chainages)
    
    total_volume = 0.0
    segments = []
    
    for i in range(len(areas) - 1):
        a1 = areas[i]
        a2 = areas[i + 1]
        length = chainages[i + 1] - chainages[i]
        
        # Basic end-area formula
        volume = ((a1 + a2) / 2.0) * length
        
        # Prismoidal correction (more accurate)
        if use_prismoidal_correction:
            # Approximate mid-area as average
            am = (a1 + a2) / 2.0
            volume = (length / 6.0) * (a1 + 4.0 * am + a2)
        
        total_volume += volume
        
        segments.append({
            "start_chainage": chainages[i],
            "end_chainage": chainages[i + 1],
            "length": length,
            "start_area": a1,
            "end_area": a2,
            "volume": volume
        })
    
    return {
        "total_volume": total_volume,
        "segment_count": len(segments),
        "segments": segments,
        "prismoidal_correction": use_prismoidal_correction,
        "method": "end_area",
        "units": "m3"
    }


# ============================================================================
# FILE: backend/earthworks/volumes/cut_fill.py
# ============================================================================
"""
Cut and Fill volume calculation.
Compares formation level vs existing ground level.
"""

from typing import List, Dict, Any


def calculate_cut_fill_volumes(
    existing_levels: List[float],
    formation_levels: List[float],
    areas: List[float],
    chainages: List[float]
) -> Dict[str, Any]:
    """
    Calculate cut and fill volumes.
    
    Args:
        existing_levels: Existing ground levels (m)
        formation_levels: Design formation levels (m)
        areas: Cross-section areas (m²)
        chainages: Chainage stations (m)
    
    Returns:
        Dictionary with cut/fill breakdown
    
    Engineering Notes:
        - Depth = Formation - Existing
        - Positive depth = Fill required
        - Negative depth = Cut required
        - Volume = Depth * Area
    """
    if not (len(existing_levels) == len(formation_levels) == len(areas) == len(chainages)):
        raise ValueError("All input arrays must have equal length")
    
    total_cut = 0.0
    total_fill = 0.0
    sections = []
    
    for i in range(len(existing_levels)):
        depth = formation_levels[i] - existing_levels[i]
        volume = depth * areas[i]
        
        if volume > 0:
            total_fill += volume
            section_type = "fill"
        else:
            total_cut += abs(volume)
            section_type = "cut"
        
        sections.append({
            "chainage": chainages[i],
            "existing_level": existing_levels[i],
            "formation_level": formation_levels[i],
            "depth": depth,
            "area": areas[i],
            "volume": volume,
            "type": section_type
        })
    
    net_volume = total_fill - total_cut
    
    return {
        "total_cut": total_cut,
        "total_fill": total_fill,
        "net_volume": net_volume,
        "sections": sections,
        "method": "cut_fill",
        "units": "m3"
    }


# ============================================================================
# FILE: backend/earthworks/volumes/borrow_spoil.py
# ============================================================================
"""
Borrow and Spoil calculation with shrinkage/swell factors.
Converts between in-situ, loose, and compacted volumes.
"""

from typing import Dict, Any
# DEFAULT_SHRINKAGE_FACTOR and DEFAULT_SWELL_FACTOR are defined at the top of this file


def calculate_borrow_spoil(
    cut_volume: float,
    fill_volume: float,
    shrinkage_factor: float = DEFAULT_SHRINKAGE_FACTOR,
    swell_factor: float = DEFAULT_SWELL_FACTOR
) -> Dict[str, Any]:
    """
    Calculate borrow/spoil requirements with volume conversion factors.
    
    Args:
        cut_volume: Cut volume in m³ (in-situ)
        fill_volume: Fill volume in m³ (compacted)
        shrinkage_factor: Compacted/in-situ ratio (typically 0.85-0.95)
        swell_factor: Loose/in-situ ratio (typically 1.15-1.60)
    
    Returns:
        Dictionary with borrow/spoil calculations
    
    Engineering Notes:
        - Cut volumes are in-situ (natural state)
        - Fill volumes are compacted (placed and compacted)
        - Borrow = Fill (compacted) / Shrinkage = In-situ required
        - Spoil = Excess Cut (in-situ) * Swell = Loose volume to haul away
    """
    net_balance = fill_volume - cut_volume
    
    borrow_required = 0.0
    spoil_generated = 0.0
    
    if net_balance > 0:
        # Need more material - calculate borrow in in-situ volume
        borrow_required = net_balance / shrinkage_factor
    else:
        # Excess material - calculate spoil in loose volume
        spoil_generated = abs(net_balance) * swell_factor
    
    # Additional volume conversions for reference
    cut_loose_volume = cut_volume * swell_factor
    fill_insitu_volume = fill_volume / shrinkage_factor
    
    return {
        "cut_volume": cut_volume,
        "fill_volume": fill_volume,
        "net_balance": net_balance,
        "borrow_required": borrow_required,
        "spoil_generated": spoil_generated,
        "shrinkage_factor": shrinkage_factor,
        "swell_factor": swell_factor,
        "cut_loose_volume": cut_loose_volume,
        "fill_insitu_volume": fill_insitu_volume,
        "method": "borrow_spoil",
        "units": "m3"
    }


# ============================================================================
# FILE: backend/earthworks/mass_haul/diagram.py
# ============================================================================
"""
Mass Haul Diagram generation.
Critical for optimizing haul distances and identifying borrow/spoil zones.
"""

from typing import List, Dict, Any
# DEFAULT_FREE_HAUL_DISTANCE is defined at the top of this file


def calculate_mass_haul_diagram(
    chainages: List[float],
    cut_volumes: List[float],
    fill_volumes: List[float],
    free_haul_distance: float = DEFAULT_FREE_HAUL_DISTANCE
) -> Dict[str, Any]:
    """
    Generate mass haul diagram data.
    
    Args:
        chainages: Chainage stations (m)
        cut_volumes: Cut volumes at each station (m3)
        fill_volumes: Fill volumes at each station (m3)
        free_haul_distance: Free haul limit (m)
    
    Returns:
        Dictionary with diagram points, balance points, haul zones
    
    Engineering Notes:
        - Cumulative volume = sum(Fill - Cut)
        - Balance points occur where cumulative = 0
    """
    # Cumulative volume = sum(Fill - Cut)
    cumulative = 0.0
    diagram = []
    balance_points = []
    
    for i in range(len(chainages)):
        net_volume = fill_volumes[i] - cut_volumes[i]
        cumulative += net_volume
        
        diagram.append({
            "chainage": chainages[i],
            "cut_volume": cut_volumes[i],
            "fill_volume": fill_volumes[i],
            "net_volume": net_volume,
            "cumulative_volume": cumulative
        })
        
        # Detect balance points (linear interpolation)
        if i > 0:
            v1 = diagram[i-1]["cumulative_volume"]
            v2 = cumulative
            if (v1 > 0 and v2 < 0) or (v1 < 0 and v2 > 0):
                ch1 = chainages[i-1]
                ch2 = chainages[i]
                balance_ch = ch1 + abs(v1) * (ch2 - ch1) / (abs(v1) + abs(v2))
                balance_points.append(balance_ch)
                
    # Basic haul zone analysis
    haul_zones = []
    for i in range(len(diagram) - 1):
        dist = diagram[i+1]["chainage"] - diagram[i]["chainage"]
        avg_v = (diagram[i]["cumulative_volume"] + diagram[i+1]["cumulative_volume"]) / 2.0
        
        haul_zones.append({
            "start_chainage": diagram[i]["chainage"],
            "end_chainage": diagram[i+1]["chainage"],
            "distance": dist,
            "volume": abs(avg_v),
            "is_free_haul": dist <= free_haul_distance,
            "is_overhaul": dist > free_haul_distance
        })
        
    return {
        "diagram": diagram,
        "balance_points": balance_points,
        "haul_zones": haul_zones,
        "final_balance": cumulative,
        "free_haul_distance": free_haul_distance,
        "method": "mass_haul"
    }


# ============================================================================
# FASTAPI ROUTER & ENDPOINTS
# ============================================================================

router = APIRouter()

@router.post("/calculate/area/coordinate", response_model=CoordinateAreaResponse)
async def api_coordinate_area(request: CoordinateAreaRequest):
    try:
        coords = [(p.x, p.y) for p in request.coordinates]
        return calculate_coordinate_area(coords)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate/area/triangulation", response_model=TriangulationAreaResponse)
async def api_triangulation_area(request: CoordinateAreaRequest):
    try:
        coords = [(p.x, p.y) for p in request.coordinates]
        return calculate_triangulation_area(coords)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate/area/trapezoidal", response_model=TrapezoidalAreaResponse)
async def api_trapezoidal_area(request: CrossSectionData):
    try:
        return calculate_trapezoidal_area(request.offsets, request.heights, request.spacing)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate/area/simpson", response_model=SimpsonAreaResponse)
async def api_simpson_area(request: CrossSectionData):
    try:
        return calculate_simpson_area(request.offsets, request.heights)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate/volume/end_area", response_model=EndAreaVolumeResponse)
async def api_end_area_volume(request: EndAreaVolumeRequest):
    try:
        return calculate_end_area_volume(request.areas, request.chainages, request.use_prismoidal_correction)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate/volume/cut_fill", response_model=CutFillResponse)
async def api_cut_fill_volume(request: CutFillRequest):
    try:
        return calculate_cut_fill_volumes(request.existing_levels, request.formation_levels, request.areas, request.chainages)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate/volume/borrow_spoil", response_model=BorrowSpoilResponse)
async def api_borrow_spoil(request: BorrowSpoilRequest):
    try:
        return calculate_borrow_spoil(request.cut_volume, request.fill_volume, request.shrinkage_factor, request.swell_factor)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate/mass_haul", response_model=MassHaulResponse)
async def api_mass_haul(request: MassHaulRequest):
    try:
        return calculate_mass_haul_diagram(request.chainages, request.cut_volumes, request.fill_volumes, request.free_haul_distance)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))