"""
Site levels and grading engine
Terrain modeling, cut-fill analysis, and drainage validation
"""

from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
from enum import Enum
import numpy as np
from geometry_utils import Mesh, Vector3
import json


class GradingOperation(Enum):
    CUT = "cut"
    FILL = "fill"
    NO_CHANGE = "no_change"


@dataclass
class SpotLevel:
    """Spot elevation point"""
    x: float
    y: float
    z: float  # Elevation
    description: str = ""
    
    def to_vector(self) -> Vector3:
        return Vector3(self.x, self.z, self.y)  # Note: Y is elevation


@dataclass
class ContourLine:
    """Elevation contour"""
    elevation: float
    points: List[Tuple[float, float]]


class TerrainSurface:
    """Digital terrain model"""
    
    def __init__(self, bounds_min: Vector3, bounds_max: Vector3, resolution: float = 1.0):
        self.bounds_min = bounds_min
        self.bounds_max = bounds_max
        self.resolution = resolution
        
        # Calculate grid dimensions
        self.width = bounds_max.x - bounds_min.x
        self.depth = bounds_max.z - bounds_min.z
        
        self.grid_width = int(self.width / resolution) + 1
        self.grid_depth = int(self.depth / resolution) + 1
        
        # Elevation grid
        self.elevations = np.zeros((self.grid_depth, self.grid_width))
        
    def set_elevation(self, x: float, z: float, elevation: float):
        """Set elevation at specific coordinates"""
        # Convert to grid indices
        i = int((z - self.bounds_min.z) / self.resolution)
        j = int((x - self.bounds_min.x) / self.resolution)
        
        if 0 <= i < self.grid_depth and 0 <= j < self.grid_width:
            self.elevations[i, j] = elevation
    
    def get_elevation(self, x: float, z: float) -> float:
        """Get elevation at specific coordinates (interpolated)"""
        # Convert to grid coordinates
        gx = (x - self.bounds_min.x) / self.resolution
        gz = (z - self.bounds_min.z) / self.resolution
        
        # Grid indices
        i = int(gz)
        j = int(gx)
        
        # Clamp to bounds
        i = max(0, min(i, self.grid_depth - 2))
        j = max(0, min(j, self.grid_width - 2))
        
        # Bilinear interpolation
        fx = gx - j
        fz = gz - i
        
        e00 = self.elevations[i, j]
        e10 = self.elevations[i, j+1]
        e01 = self.elevations[i+1, j]
        e11 = self.elevations[i+1, j+1]
        
        e0 = e00 * (1 - fx) + e10 * fx
        e1 = e01 * (1 - fx) + e11 * fx
        
        return e0 * (1 - fz) + e1 * fz
    
    def apply_slope(self, origin: Vector3, slope_x: float, slope_z: float):
        """Apply constant slope from origin"""
        for i in range(self.grid_depth):
            for j in range(self.grid_width):
                x = self.bounds_min.x + j * self.resolution
                z = self.bounds_min.z + i * self.resolution
                
                dx = x - origin.x
                dz = z - origin.z
                
                elevation = origin.y + dx * slope_x + dz * slope_z
                self.elevations[i, j] = elevation
    
    def generate_mesh(self) -> Mesh:
        """Generate terrain mesh"""
        mesh = Mesh()
        mesh.material_name = "terrain"
        
        # Add vertices
        for i in range(self.grid_depth):
            for j in range(self.grid_width):
                x = self.bounds_min.x + j * self.resolution
                z = self.bounds_min.z + i * self.resolution
                y = self.elevations[i, j]
                
                u = j / (self.grid_width - 1)
                v = i / (self.grid_depth - 1)
                
                mesh.add_vertex(Vector3(x, y, z), Vector3(0, 1, 0), (u, v))
        
        # Add faces
        for i in range(self.grid_depth - 1):
            for j in range(self.grid_width - 1):
                i0 = i * self.grid_width + j
                i1 = i0 + 1
                i2 = i0 + self.grid_width
                i3 = i2 + 1
                
                mesh.add_quad(i0, i1, i3, i2)
        
        # Recalculate normals for proper shading
        mesh.calculate_normals()
        
        return mesh


class SiteGradingEngine:
    """Site grading and earthworks calculator"""
    
    def __init__(self, site_bounds_min: Vector3, site_bounds_max: Vector3):
        self.existing_ground = TerrainSurface(site_bounds_min, site_bounds_max, resolution=1.0)
        self.finished_ground = TerrainSurface(site_bounds_min, site_bounds_max, resolution=1.0)
        
        self.building_plinth_level: Optional[float] = None
        self.spot_levels: List[SpotLevel] = []
    
    def set_building_plinth(self, level: float):
        """Set building plinth level (critical constraint)"""
        self.building_plinth_level = level
    
    def add_spot_level(self, spot: SpotLevel):
        """Add spot level constraint"""
        self.spot_levels.append(spot)
        
        # Apply to finished ground
        self.finished_ground.set_elevation(spot.x, spot.y, spot.z)
    
    def create_positive_drainage(self, building_center: Vector3, building_radius: float,
                                 min_fall: float = 0.015):
        """Create drainage slope away from building"""
        
        if self.building_plinth_level is None:
            raise ValueError("Building plinth level not set")
        
        # Apply radial slope away from building
        for i in range(self.finished_ground.grid_depth):
            for j in range(self.finished_ground.grid_width):
                x = self.finished_ground.bounds_min.x + j * self.finished_ground.resolution
                z = self.finished_ground.bounds_min.z + i * self.finished_ground.resolution
                
                # Distance from building center
                dx = x - building_center.x
                dz = z - building_center.z
                distance = np.sqrt(dx**2 + dz**2)
                
                if distance < building_radius:
                    # Within building footprint - use plinth level
                    elevation = self.building_plinth_level
                else:
                    # Outside building - slope away
                    distance_from_edge = distance - building_radius
                    elevation = self.building_plinth_level - distance_from_edge * min_fall
                
                self.finished_ground.elevations[i, j] = elevation
    
    def apply_uniform_slope(self, direction: Vector3, slope_percent: float):
        """Apply uniform slope across site"""
        slope_decimal = slope_percent / 100.0
        
        # Normalize direction
        direction_2d = np.array([direction.x, direction.z])
        direction_2d = direction_2d / np.linalg.norm(direction_2d)
        
        # Reference point (site minimum)
        origin = Vector3(
            self.finished_ground.bounds_min.x,
            self.building_plinth_level if self.building_plinth_level else 0,
            self.finished_ground.bounds_min.z
        )
        
        # Apply slope
        slope_x = direction_2d[0] * slope_decimal
        slope_z = direction_2d[1] * slope_decimal
        
        self.finished_ground.apply_slope(origin, slope_x, slope_z)
    
    def calculate_cut_fill(self) -> Dict[str, float]:
        """Calculate cut and fill volumes"""
        
        total_cut = 0.0
        total_fill = 0.0
        
        cell_area = self.existing_ground.resolution ** 2
        
        for i in range(self.existing_ground.grid_depth):
            for j in range(self.existing_ground.grid_width):
                existing = self.existing_ground.elevations[i, j]
                finished = self.finished_ground.elevations[i, j]
                
                difference = finished - existing
                
                if difference > 0:
                    # Fill
                    total_fill += difference * cell_area
                elif difference < 0:
                    # Cut
                    total_cut += abs(difference) * cell_area
        
        return {
            "cut_volume_m3": total_cut,
            "fill_volume_m3": total_fill,
            "net_volume_m3": total_fill - total_cut,
            "balance": "balanced" if abs(total_fill - total_cut) < 100 else "unbalanced"
        }
    
    def detect_low_points(self) -> List[Tuple[float, float, float]]:
        """Detect isolated low points (water traps)"""
        low_points = []
        
        for i in range(1, self.finished_ground.grid_depth - 1):
            for j in range(1, self.finished_ground.grid_width - 1):
                center = self.finished_ground.elevations[i, j]
                
                # Check 8 neighbors
                neighbors = [
                    self.finished_ground.elevations[i-1, j-1],
                    self.finished_ground.elevations[i-1, j],
                    self.finished_ground.elevations[i-1, j+1],
                    self.finished_ground.elevations[i, j-1],
                    self.finished_ground.elevations[i, j+1],
                    self.finished_ground.elevations[i+1, j-1],
                    self.finished_ground.elevations[i+1, j],
                    self.finished_ground.elevations[i+1, j+1],
                ]
                
                # If center is lower than all neighbors, it's a low point
                if all(center < n for n in neighbors):
                    x = self.finished_ground.bounds_min.x + j * self.finished_ground.resolution
                    z = self.finished_ground.bounds_min.z + i * self.finished_ground.resolution
                    low_points.append((x, z, center))
        
        return low_points
    
    def validate_grading(self) -> Tuple[bool, List[str]]:
        """Validate site grading for drainage and safety"""
        errors = []
        
        # Check for isolated low points
        low_points = self.detect_low_points()
        if low_points:
            errors.append(f"Found {len(low_points)} isolated low points (water traps)")
        
        # Check building plinth protection
        if self.building_plinth_level is not None:
            # Sample points around building should be lower
            # (This is simplified - real implementation would check building perimeter)
            pass
        
        # Check for excessive slopes
        max_slope = 0.0
        for i in range(self.finished_ground.grid_depth - 1):
            for j in range(self.finished_ground.grid_width - 1):
                e1 = self.finished_ground.elevations[i, j]
                e2 = self.finished_ground.elevations[i, j+1]
                e3 = self.finished_ground.elevations[i+1, j]
                
                slope_x = abs(e2 - e1) / self.finished_ground.resolution
                slope_z = abs(e3 - e1) / self.finished_ground.resolution
                
                max_slope = max(max_slope, slope_x, slope_z)
        
        if max_slope > 0.5:  # 50% grade
            errors.append(f"Excessive slope detected: {max_slope*100:.1f}%")
        
        return len(errors) == 0, errors
    
    def generate_cut_fill_map(self) -> Mesh:
        """Generate color-coded cut-fill visualization"""
        mesh = Mesh()
        mesh.material_name = "cut_fill_map"
        
        # Similar to terrain mesh, but with color coding
        for i in range(self.finished_ground.grid_depth):
            for j in range(self.finished_ground.grid_width):
                x = self.finished_ground.bounds_min.x + j * self.finished_ground.resolution
                z = self.finished_ground.bounds_min.z + i * self.finished_ground.resolution
                y = self.finished_ground.elevations[i, j]
                
                mesh.add_vertex(Vector3(x, y, z), Vector3(0, 1, 0))
        
        for i in range(self.finished_ground.grid_depth - 1):
            for j in range(self.finished_ground.grid_width - 1):
                i0 = i * self.finished_ground.grid_width + j
                i1 = i0 + 1
                i2 = i0 + self.finished_ground.grid_width
                i3 = i2 + 1
                
                mesh.add_quad(i0, i1, i3, i2)
        
        return mesh
    
    def export_metadata(self, filename: str) -> str:
        """Export grading analysis"""
        cut_fill = self.calculate_cut_fill()
        low_points = self.detect_low_points()
        valid, errors = self.validate_grading()
        
        data = {
            "system": "site_grading",
            "building_plinth_level": self.building_plinth_level,
            "cut_fill_analysis": cut_fill,
            "low_points_count": len(low_points),
            "low_points": [{"x": p[0], "z": p[1], "elevation": p[2]} for p in low_points[:10]],
            "validation": {
                "valid": valid,
                "errors": errors
            },
            "spot_levels": [
                {"x": sl.x, "y": sl.y, "z": sl.z, "description": sl.description}
                for sl in self.spot_levels
            ]
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filename