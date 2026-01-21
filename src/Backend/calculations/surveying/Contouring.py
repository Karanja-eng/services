"""
FastAPI Backend for Automated Terrain Modeler
Handles terrain generation, contour calculation, and slope analysis
"""

from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Tuple, Optional
import numpy as np
import scipy.interpolate as interpolate
try:
    from scipy.interpolate import griddata, RBFInterpolator
except ImportError:
    # Fallback or alternative if needed
    from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter
import math

router = APIRouter()

# Pydantic Models
class RLPoint(BaseModel):
    x: float
    y: float
    rl: float

class TerrainRequest(BaseModel):
    rl_data: List[RLPoint]
    grid_dimensions: dict  # {"width": float, "height": float}
    contour_interval: float
    grid_resolution: Optional[int] = 50

class ContourLine(BaseModel):
    rl: float
    points: List[List[float]]

class TerrainResponse(BaseModel):
    contour_lines: List[ContourLine]
    terrain_vertices: List[List[float]]
    min_rl: float
    max_rl: float
    grid_resolution: int

class SlopeRequest(BaseModel):
    point1: RLPoint
    point2: RLPoint

class SlopeResponse(BaseModel):
    slope_percent: float
    slope_degrees: float
    slope_ratio: str
    horizontal_distance: float
    vertical_distance: float
    elevation_change: float


# Terrain Generation Functions
def create_dem_grid(rl_data: List[RLPoint], width: float, height: float, resolution: int):
    """
    Create Digital Elevation Model using interpolation
    Uses Inverse Distance Weighting (IDW) via scipy's griddata
    """
    # Extract coordinates and elevations
    points = np.array([[p.x, p.y] for p in rl_data])
    values = np.array([p.rl for p in rl_data])
    
    # Create regular grid
    grid_x = np.linspace(0, width, resolution)
    grid_y = np.linspace(0, height, resolution)
    grid_xx, grid_yy = np.meshgrid(grid_x, grid_y)
    
    # Interpolate using different methods for robustness
    try:
        # Try RBF interpolation first (smoother results)
        rbf = RBFInterpolator(points, values, kernel='thin_plate_spline', smoothing=0.1)
        grid_points = np.column_stack([grid_xx.ravel(), grid_yy.ravel()])
        grid_zz = rbf(grid_points).reshape(grid_xx.shape)
    except:
        # Fallback to linear interpolation
        grid_zz = griddata(points, values, (grid_xx, grid_yy), method='cubic', fill_value=np.mean(values))
        # Fill any remaining NaN values
        if np.isnan(grid_zz).any():
            grid_zz = griddata(points, values, (grid_xx, grid_yy), method='linear', fill_value=np.mean(values))
    
    # Apply slight smoothing to reduce artifacts
    grid_zz = gaussian_filter(grid_zz, sigma=0.5)
    
    return grid_xx, grid_yy, grid_zz


def marching_squares(grid_zz: np.ndarray, grid_xx: np.ndarray, grid_yy: np.ndarray, level: float):
    """
    Implement Marching Squares algorithm for contour extraction
    Returns list of line segments for the given elevation level
    """
    contour_points = []
    rows, cols = grid_zz.shape
    
    # Process each cell in the grid
    for i in range(rows - 1):
        for j in range(cols - 1):
            # Get the four corners of the cell
            v00 = grid_zz[i, j]
            v10 = grid_zz[i, j + 1]
            v01 = grid_zz[i + 1, j]
            v11 = grid_zz[i + 1, j + 1]
            
            # Calculate cell index (0-15) based on which corners are above the level
            cell_idx = 0
            if v00 >= level: cell_idx |= 1
            if v10 >= level: cell_idx |= 2
            if v11 >= level: cell_idx |= 4
            if v01 >= level: cell_idx |= 8
            
            # Skip if all corners are above or below
            if cell_idx == 0 or cell_idx == 15:
                continue
            
            # Get corner coordinates
            x0, y0 = grid_xx[i, j], grid_yy[i, j]
            x1, y1 = grid_xx[i, j + 1], grid_yy[i, j + 1]
            x2, y2 = grid_xx[i + 1, j + 1], grid_yy[i + 1, j + 1]
            x3, y3 = grid_xx[i + 1, j], grid_yy[i + 1, j]
            
            # Linear interpolation helper
            def lerp(val1, val2, coord1, coord2):
                if abs(val2 - val1) < 1e-10:
                    return (coord1 + coord2) / 2
                t = (level - val1) / (val2 - val1)
                return coord1 + t * (coord2 - coord1)
            
            # Calculate edge intersections
            edges = []
            
            # Bottom edge (v00 to v10)
            if (v00 < level and v10 >= level) or (v00 >= level and v10 < level):
                x = lerp(v00, v10, x0, x1)
                edges.append([x, y0])
            
            # Right edge (v10 to v11)
            if (v10 < level and v11 >= level) or (v10 >= level and v11 < level):
                y = lerp(v10, v11, y1, y2)
                edges.append([x1, y])
            
            # Top edge (v11 to v01)
            if (v11 < level and v01 >= level) or (v11 >= level and v01 < level):
                x = lerp(v11, v01, x2, x3)
                edges.append([x, y2])
            
            # Left edge (v01 to v00)
            if (v01 < level and v00 >= level) or (v01 >= level and v00 < level):
                y = lerp(v01, v00, y3, y0)
                edges.append([x0, y])
            
            # Add edges to contour
            if len(edges) >= 2:
                contour_points.extend(edges)
    
    return contour_points


def extract_contours(grid_xx: np.ndarray, grid_yy: np.ndarray, grid_zz: np.ndarray, 
                     contour_interval: float, min_rl: float, max_rl: float):
    """
    Extract all contour lines at specified intervals
    """
    contours = []
    
    # Generate contour levels
    start_level = math.ceil(min_rl / contour_interval) * contour_interval
    levels = np.arange(start_level, max_rl, contour_interval)
    
    for level in levels:
        points = marching_squares(grid_zz, grid_xx, grid_yy, level)
        if points:
            # Group points into continuous lines
            contours.append(ContourLine(rl=float(level), points=points))
    
    return contours


def generate_terrain_vertices(grid_xx: np.ndarray, grid_yy: np.ndarray, grid_zz: np.ndarray):
    """
    Generate 3D vertex data for terrain mesh
    Returns flattened list of [x, y, z] coordinates
    """
    vertices = []
    rows, cols = grid_zz.shape
    
    for i in range(rows):
        for j in range(cols):
            vertices.append([
                float(grid_xx[i, j]),
                float(grid_yy[i, j]),
                float(grid_zz[i, j])
            ])
    
    return vertices


# API Endpoints
@router.get("/")
def read_root():
    return {
        "name": "Terrain Modeler API",
        "version": "1.0.0",
        "endpoints": [
            "/generate-terrain",
            "/calculate-slope",
            "/health"
        ]
    }


@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "terrain-modeler-api"}


@router.post("/generate-terrain", response_model=TerrainResponse)
def generate_terrain(request: TerrainRequest):
    """
    Generate contour lines and 3D terrain mesh from survey data
    
    Input: Survey RL data points, map dimensions, contour interval
    Output: Contour lines, 3D terrain vertices, elevation statistics
    """
    try:
        if len(request.rl_data) < 3:
            raise HTTPException(status_code=400, detail="At least 3 data points required")
        
        width = request.grid_dimensions.get("width", 100)
        height = request.grid_dimensions.get("height", 100)
        resolution = request.grid_resolution or 50
        
        # Extract min/max elevations
        elevations = [p.rl for p in request.rl_data]
        min_rl = float(min(elevations))
        max_rl = float(max(elevations))
        
        # Create DEM grid
        grid_xx, grid_yy, grid_zz = create_dem_grid(
            request.rl_data, 
            width, 
            height, 
            resolution
        )
        
        # Extract contour lines
        contours = extract_contours(
            grid_xx, 
            grid_yy, 
            grid_zz, 
            request.contour_interval,
            min_rl,
            max_rl
        )
        
        # Generate 3D vertices
        vertices = generate_terrain_vertices(grid_xx, grid_yy, grid_zz)
        
        return TerrainResponse(
            contour_lines=contours,
            terrain_vertices=vertices,
            min_rl=min_rl,
            max_rl=max_rl,
            grid_resolution=resolution
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Terrain generation failed: {str(e)}")


@router.post("/calculate-slope", response_model=SlopeResponse)
def calculate_slope(request: SlopeRequest):
    """
    Calculate slope between two points
    
    Input: Two points with x, y, rl coordinates
    Output: Slope in percentage, degrees, ratio, and distance metrics
    """
    try:
        # Calculate horizontal distance
        dx = request.point2.x - request.point1.x
        dy = request.point2.y - request.point1.y
        horizontal_distance = math.sqrt(dx**2 + dy**2)
        
        if horizontal_distance < 0.001:
            raise HTTPException(status_code=400, detail="Points are too close together")
        
        # Calculate vertical distance
        vertical_distance = abs(request.point2.rl - request.point1.rl)
        elevation_change = request.point2.rl - request.point1.rl
        
        # Calculate slope
        slope_percent = (vertical_distance / horizontal_distance) * 100
        slope_degrees = math.degrees(math.atan(vertical_distance / horizontal_distance))
        
        # Calculate slope ratio (rise:run)
        if vertical_distance > 0:
            ratio_run = horizontal_distance / vertical_distance
            slope_ratio = f"1:{ratio_run:.2f}"
        else:
            slope_ratio = "0:1 (flat)"
        
        return SlopeResponse(
            slope_percent=round(slope_percent, 2),
            slope_degrees=round(slope_degrees, 2),
            slope_ratio=slope_ratio,
            horizontal_distance=round(horizontal_distance, 2),
            vertical_distance=round(vertical_distance, 2),
            elevation_change=round(elevation_change, 2)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Slope calculation failed: {str(e)}")


@router.post("/validate-print-scale")
def validate_print_scale(paper_size: str, scale: int, map_dimensions: dict):
    """
    Validate if map fits on selected paper at given scale
    
    Input: Paper size (A4/A3/A2), scale (e.g., 1000 for 1:1000), map dimensions
    Output: Validation result with dimensions
    """
    paper_sizes = {
        "A4": {"width": 210, "height": 297},
        "A3": {"width": 297, "height": 420},
        "A2": {"width": 420, "height": 594}
    }
    
    if paper_size not in paper_sizes:
        raise HTTPException(status_code=400, detail="Invalid paper size")
    
    paper = paper_sizes[paper_size]
    width = map_dimensions.get("width", 0)
    height = map_dimensions.get("height", 0)
    
    # Convert map dimensions to mm on paper (meters to mm / scale)
    map_width_mm = (width * 1000) / scale
    map_height_mm = (height * 1000) / scale
    
    fits = map_width_mm <= paper["width"] and map_height_mm <= paper["height"]
    
    return {
        "fits": fits,
        "map_width_mm": round(map_width_mm, 2),
        "map_height_mm": round(map_height_mm, 2),
        "paper_width_mm": paper["width"],
        "paper_height_mm": paper["height"],
        "scale": f"1:{scale}",
        "recommended_scale": int((max(width, height) * 1000) / min(paper["width"], paper["height"])) if not fits else scale
    }


