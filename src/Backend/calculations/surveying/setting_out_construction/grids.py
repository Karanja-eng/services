# backend/surveying/setting_out/grids.py
"""
Grid generation for building and structure setting-out
"""
import math
from typing import List
from ..schemas import Point2D, GridPoint, GridResponse
from ..utils import deg_to_rad

def generate_rectangular_grid(origin: Point2D,
                              spacing_x: float,
                              spacing_y: float,
                              extent_x: float,
                              extent_y: float,
                              rotation_deg: float = 0.0) -> GridResponse:
    """
    Generate rectangular grid for setting-out
    
    Engineering use:
    - Building column grids
    - Piling layouts
    - Foundation grids
    
    Args:
        origin: Grid origin point
        spacing_x: Grid spacing in X direction (meters)
        spacing_y: Grid spacing in Y direction (meters)
        extent_x: Total extent in X (meters)
        extent_y: Total extent in Y (meters)
        rotation_deg: Grid rotation from north (degrees)
        
    Returns:
        Complete grid with labeled points
    """
    grid_points = []
    
    # Calculate number of grid lines
    num_x = int(extent_x / spacing_x) + 1
    num_y = int(extent_y / spacing_y) + 1
    
    # Rotation matrix
    rotation_rad = deg_to_rad(rotation_deg)
    cos_r = math.cos(rotation_rad)
    sin_r = math.sin(rotation_rad)
    
    # Generate grid labels (A, B, C... for rows; 1, 2, 3... for columns)
    row_labels = [chr(65 + i) for i in range(num_y)]  # A, B, C...
    
    for j in range(num_y):
        for i in range(num_x):
            # Local grid coordinates
            local_x = i * spacing_x
            local_y = j * spacing_y
            
            # Apply rotation
            rotated_x = local_x * cos_r - local_y * sin_r
            rotated_y = local_x * sin_r + local_y * cos_r
            
            # Translate to world coordinates
            world_x = origin.x + rotated_x
            world_y = origin.y + rotated_y
            
            # Grid ID: e.g., "A1", "B3"
            grid_id = f"{row_labels[j]}{i+1}"
            
            grid_points.append(GridPoint(
                grid_id=grid_id,
                point=Point2D(x=world_x, y=world_y)
            ))
    
    return GridResponse(
        origin=origin,
        grid_points=grid_points,
        total_points=len(grid_points)
    )

def generate_radial_grid(center: Point2D,
                        num_radials: int,
                        radial_spacing: float,
                        max_radius: float) -> List[GridPoint]:
    """
    Generate radial grid (circular layout)
    
    Engineering use:
    - Tank foundations
    - Circular structures
    - Roundabout layouts
    
    Args:
        center: Center point of radial grid
        num_radials: Number of radial lines (e.g., 12 for 30° spacing)
        radial_spacing: Spacing between radial circles (meters)
        max_radius: Maximum radius (meters)
        
    Returns:
        List of grid points with polar references
    """
    from ..utils import polar_to_cartesian
    
    grid_points = []
    angle_increment = 360.0 / num_radials
    num_circles = int(max_radius / radial_spacing) + 1
    
    for circle in range(1, num_circles):
        radius = circle * radial_spacing
        
        for radial in range(num_radials):
            bearing = radial * angle_increment
            
            x, y = polar_to_cartesian(radius, bearing, center.x, center.y)
            
            # Grid ID: "R3-A0" = Radius 3, Angle 0°
            grid_id = f"R{circle}-A{int(bearing)}"
            
            grid_points.append(GridPoint(
                grid_id=grid_id,
                point=Point2D(x=x, y=y)
            ))
    
    # Add center point
    grid_points.insert(0, GridPoint(
        grid_id="C",
        point=center
    ))
    
    return grid_points


# backend/surveying/setting_out/profiles.py
"""
Profile board and batter board calculations for excavation setting-out
"""
from typing import Tuple
from ..schemas import Point3D

def calculate_profile_board(design_rl: float,
                           existing_rl: float,
                           board_height: float = 1.0,
                           offset_distance: float = 2.0) -> dict:
    """
    Calculate profile board setting for excavation or filling
    
    Profile boards show the design level using a horizontal sight rail
    
    Engineering method:
    - Board placed at offset from work face
    - Sight rail set at known height above/below design level
    - Traveler (profile board staff) used to transfer level
    
    Args:
        design_rl: Design reduced level (meters)
        existing_rl: Existing ground level (meters)
        board_height: Height of sight rail above ground (meters)
        offset_distance: Horizontal offset from work face (meters)
        
    Returns:
        Profile board parameters
    """
    # Cut or fill depth
    depth = existing_rl - design_rl
    
    if depth > 0:
        work_type = "CUT"
        cut_depth = depth
        fill_depth = 0.0
    else:
        work_type = "FILL"
        cut_depth = 0.0
        fill_depth = abs(depth)
    
    # Sight rail RL
    sight_rail_rl = existing_rl + board_height
    
    # Traveler length (from sight rail to design level)
    traveler_length = sight_rail_rl - design_rl
    
    return {
        "design_rl": design_rl,
        "existing_rl": existing_rl,
        "work_type": work_type,
        "cut_depth": cut_depth,
        "fill_depth": fill_depth,
        "board_height": board_height,
        "sight_rail_rl": sight_rail_rl,
        "traveler_length": traveler_length,
        "offset_distance": offset_distance
    }

def calculate_batter_board(footing_level: float,
                          ground_level: float,
                          footing_width: float,
                          batter_slope: float = 0.25) -> dict:
    """
    Calculate batter board for sloped excavation sides
    
    Batter boards define the excavation slope (typically 1:4 or 1:2)
    
    Args:
        footing_level: Base level of footing (meters)
        ground_level: Existing ground level (meters)
        footing_width: Width of footing (meters)
        batter_slope: Slope ratio (e.g., 0.25 = 1:4 slope)
        
    Returns:
        Batter board parameters
    """
    excavation_depth = ground_level - footing_level
    
    # Batter distance (horizontal run for slope)
    batter_distance = excavation_depth / batter_slope
    
    # Total excavation width (footing + 2 × batter)
    total_width = footing_width + 2.0 * batter_distance
    
    # Edge of excavation at ground level
    edge_offset = (total_width - footing_width) / 2.0
    
    return {
        "footing_level": footing_level,
        "ground_level": ground_level,
        "excavation_depth": excavation_depth,
        "footing_width": footing_width,
        "batter_slope": batter_slope,
        "batter_distance": batter_distance,
        "total_excavation_width": total_width,
        "edge_offset": edge_offset
    }