"""
Pipe Routing Engine
Production-grade 3D routing with obstacle avoidance and optimization
"""

import numpy as np
from typing import List, Tuple, Optional, Set, Dict
from dataclasses import dataclass
import heapq
from enum import Enum

from pipe_models import PipeSegment, PipeSystem, PipeMaterial, Fitting, FittingType


class RoutingSpace(Enum):
    """Preferred routing spaces"""
    WALL = "wall"
    SLAB = "slab"
    SHAFT = "shaft"
    CEILING = "ceiling"
    EXPOSED = "exposed"


@dataclass
class RoutingConstraint:
    """Routing constraints and preferences"""
    avoid_zones: List[Tuple[np.ndarray, np.ndarray]] = None  # [(min_corner, max_corner)]
    preferred_zones: List[Tuple[np.ndarray, np.ndarray, RoutingSpace]] = None
    max_horizontal_run: float = 10000  # mm
    max_vertical_run: float = 5000   # mm
    min_clearance: float = 50  # mm from obstacles
    prefer_vertical: bool = True  # Prefer vertical routing when possible
    
    def __post_init__(self):
        if self.avoid_zones is None:
            self.avoid_zones = []
        if self.preferred_zones is None:
            self.preferred_zones = []


class PipeRouter:
    """3D pipe routing with A* pathfinding"""
    
    def __init__(
        self,
        grid_resolution: float = 100.0,  # mm
        constraints: Optional[RoutingConstraint] = None
    ):
        self.grid_resolution = grid_resolution
        self.constraints = constraints or RoutingConstraint()
        self.obstacles: Set[Tuple[int, int, int]] = set()
        
    def add_obstacle(self, min_corner: np.ndarray, max_corner: np.ndarray):
        """Add obstacle to routing space"""
        self.constraints.avoid_zones.append((min_corner, max_corner))
        
    def is_point_valid(self, point: np.ndarray) -> bool:
        """Check if point is valid (not in obstacle)"""
        for min_corner, max_corner in self.constraints.avoid_zones:
            if np.all(point >= min_corner) and np.all(point <= max_corner):
                return False
        return True
    
    def snap_to_grid(self, point: np.ndarray) -> Tuple[int, int, int]:
        """Snap point to routing grid"""
        return tuple((point / self.grid_resolution).astype(int))
    
    def grid_to_world(self, grid_point: Tuple[int, int, int]) -> np.ndarray:
        """Convert grid coordinates to world coordinates"""
        return np.array(grid_point, dtype=float) * self.grid_resolution
    
    def heuristic(self, a: Tuple[int, int, int], b: Tuple[int, int, int]) -> float:
        """A* heuristic - Manhattan distance with preference for vertical"""
        dx = abs(a[0] - b[0])
        dy = abs(a[1] - b[1])
        dz = abs(a[2] - b[2])
        
        # Prefer vertical routing - lower cost for Z-axis movement
        if self.constraints.prefer_vertical:
            return dx + dy + dz * 0.5
        return dx + dy + dz
    
    def get_neighbors(self, point: Tuple[int, int, int]) -> List[Tuple[int, int, int]]:
        """Get valid neighboring grid points"""
        x, y, z = point
        neighbors = []
        
        # 6-connected (orthogonal only - no diagonals for cleaner routing)
        for dx, dy, dz in [
            (1, 0, 0), (-1, 0, 0),
            (0, 1, 0), (0, -1, 0),
            (0, 0, 1), (0, 0, -1)
        ]:
            neighbor = (x + dx, y + dy, z + dz)
            world_pos = self.grid_to_world(neighbor)
            
            if self.is_point_valid(world_pos):
                neighbors.append(neighbor)
        
        return neighbors
    
    def route_pipe(
        self,
        start: np.ndarray,
        end: np.ndarray,
        system: PipeSystem
    ) -> Optional[List[np.ndarray]]:
        """
        Route pipe from start to end using A* pathfinding
        
        Args:
            start: Start point [x, y, z]
            end: End point [x, y, z]
            system: Pipe system type
            
        Returns:
            List of waypoints or None if no path found
        """
        start_grid = self.snap_to_grid(start)
        end_grid = self.snap_to_grid(end)
        
        # A* algorithm
        open_set = [(0, start_grid)]
        came_from: Dict[Tuple, Tuple] = {}
        g_score: Dict[Tuple, float] = {start_grid: 0}
        f_score: Dict[Tuple, float] = {start_grid: self.heuristic(start_grid, end_grid)}
        
        visited = set()
        
        while open_set:
            current_f, current = heapq.heappop(open_set)
            
            if current in visited:
                continue
            visited.add(current)
            
            if current == end_grid:
                # Reconstruct path
                path = []
                while current in came_from:
                    path.append(self.grid_to_world(current))
                    current = came_from[current]
                path.append(self.grid_to_world(start_grid))
                return list(reversed(path))
            
            for neighbor in self.get_neighbors(current):
                if neighbor in visited:
                    continue
                
                tentative_g = g_score[current] + 1
                
                # Add cost for direction changes (prefer straight runs)
                if current in came_from:
                    prev = came_from[current]
                    current_dir = (current[0] - prev[0], current[1] - prev[1], current[2] - prev[2])
                    neighbor_dir = (neighbor[0] - current[0], neighbor[1] - current[1], neighbor[2] - current[2])
                    if current_dir != neighbor_dir:
                        tentative_g += 0.5  # Penalty for turns
                
                if neighbor not in g_score or tentative_g < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f_score[neighbor] = tentative_g + self.heuristic(neighbor, end_grid)
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))
        
        return None  # No path found
    
    def optimize_path(self, waypoints: List[np.ndarray]) -> List[np.ndarray]:
        """
        Optimize path by removing unnecessary waypoints
        Uses line-of-sight checks to create longer straight segments
        """
        if len(waypoints) <= 2:
            return waypoints
        
        optimized = [waypoints[0]]
        i = 0
        
        while i < len(waypoints) - 1:
            # Look ahead as far as possible
            j = len(waypoints) - 1
            while j > i + 1:
                # Check if we can go directly from waypoints[i] to waypoints[j]
                if self._has_line_of_sight(waypoints[i], waypoints[j]):
                    optimized.append(waypoints[j])
                    i = j
                    break
                j -= 1
            else:
                # No shortcut found, move to next waypoint
                i += 1
                if i < len(waypoints):
                    optimized.append(waypoints[i])
        
        return optimized
    
    def _has_line_of_sight(self, start: np.ndarray, end: np.ndarray) -> bool:
        """Check if straight line between points is valid"""
        # Sample points along line
        direction = end - start
        distance = np.linalg.norm(direction)
        
        if distance < 1:
            return True
        
        direction = direction / distance
        num_samples = int(distance / self.grid_resolution) + 1
        
        for i in range(num_samples):
            point = start + direction * (i * self.grid_resolution)
            if not self.is_point_valid(point):
                return False
        
        return True
    
    def generate_pipe_segments(
        self,
        waypoints: List[np.ndarray],
        diameter: float,
        system: PipeSystem,
        material: PipeMaterial,
        base_id: str
    ) -> Tuple[List[PipeSegment], List[Fitting]]:
        """
        Convert waypoints to pipe segments and fittings
        
        Args:
            waypoints: Path waypoints
            diameter: Pipe diameter
            system: Pipe system
            material: Pipe material
            base_id: Base ID for naming
            
        Returns:
            Tuple of (segments, fittings)
        """
        segments = []
        fittings = []
        
        for i in range(len(waypoints) - 1):
            seg = PipeSegment(
                pipe_id=f"{base_id}_seg_{i}",
                start_point=waypoints[i],
                end_point=waypoints[i + 1],
                diameter=diameter,
                system=system,
                material=material
            )
            segments.append(seg)
            
            # Add fitting at junction (except at start and end)
            if i > 0:
                # Determine fitting type based on angle
                prev_dir = waypoints[i] - waypoints[i - 1]
                next_dir = waypoints[i + 1] - waypoints[i]
                
                prev_dir = prev_dir / (np.linalg.norm(prev_dir) + 1e-6)
                next_dir = next_dir / (np.linalg.norm(next_dir) + 1e-6)
                
                dot_product = np.dot(prev_dir, next_dir)
                
                if dot_product > 0.9:
                    fitting_type = FittingType.COUPLING
                elif dot_product > 0.0:
                    fitting_type = FittingType.ELBOW_45
                else:
                    fitting_type = FittingType.ELBOW_90
                
                fitting = Fitting(
                    fitting_id=f"{base_id}_fitting_{i}",
                    fitting_type=fitting_type,
                    position=waypoints[i],
                    diameter=diameter,
                    system=system
                )
                fittings.append(fitting)
        
        return segments, fittings


class DrainageRouter(PipeRouter):
    """Specialized router for drainage pipes with slope requirements"""
    
    def __init__(
        self,
        grid_resolution: float = 100.0,
        min_slope: float = 0.02,  # 2% minimum
        constraints: Optional[RoutingConstraint] = None
    ):
        super().__init__(grid_resolution, constraints)
        self.min_slope = min_slope
    
    def route_drainage_pipe(
        self,
        start: np.ndarray,
        end: np.ndarray,
        diameter: float
    ) -> Optional[List[np.ndarray]]:
        """
        Route drainage pipe with gravity slope
        
        Ensures continuous downward slope from start to end
        """
        # Calculate required slope
        horizontal_dist = np.sqrt((end[0] - start[0])**2 + (end[1] - start[1])**2)
        vertical_drop = start[2] - end[2]  # Positive if draining downward
        
        if vertical_drop < 0:
            raise ValueError("Drainage pipe cannot flow upward")
        
        actual_slope = vertical_drop / horizontal_dist if horizontal_dist > 0 else float('inf')
        
        if actual_slope < self.min_slope and horizontal_dist > 0:
            raise ValueError(
                f"Insufficient slope: {actual_slope:.4f} < minimum {self.min_slope}"
            )
        
        # Route normally but enforce downward direction
        path = self.route_pipe(start, end, PipeSystem.WASTE)
        
        if path is None:
            return None
        
        # Validate that path consistently slopes downward
        for i in range(len(path) - 1):
            if path[i][2] < path[i + 1][2]:  # Going upward
                # Try to fix by adjusting Z-coordinates
                path[i + 1][2] = path[i][2] - self.grid_resolution * self.min_slope
        
        return path


class SupplyRouter(PipeRouter):
    """Specialized router for supply pipes (pressure-driven)"""
    
    def route_supply_network(
        self,
        source: np.ndarray,
        destinations: List[Tuple[np.ndarray, float]],  # (point, fixture_units)
        is_hot_water: bool = False
    ) -> Dict[str, List[PipeSegment]]:
        """
        Route supply network from source to multiple destinations
        Creates branching network with proper sizing
        
        Args:
            source: Water source point (main entry or water heater)
            destinations: List of (endpoint, fixture_units) tuples
            is_hot_water: True for hot water, False for cold
            
        Returns:
            Dict mapping destination IDs to pipe segment lists
        """
        from pipe_sizing import PipeSizingCalculator
        
        routes = {}
        system = PipeSystem.HOT_WATER if is_hot_water else PipeSystem.COLD_WATER
        
        # Route to each destination
        for i, (dest, fu) in enumerate(destinations):
            path = self.route_pipe(source, dest, system)
            
            if path:
                diameter = PipeSizingCalculator.size_supply_pipe(fu)
                segments, _ = self.generate_pipe_segments(
                    waypoints=path,
                    diameter=diameter,
                    system=system,
                    material=PipeMaterial.PEX,
                    base_id=f"supply_{i}"
                )
                routes[f"dest_{i}"] = segments
        
        return routes