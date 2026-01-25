# ============================================================================
# FILE: backend/gnss/baselines/baseline_adjustment.py
# ============================================================================
"""
Network baseline adjustment using least squares.
Processes multiple GNSS baselines to compute adjusted station coordinates.
"""

import numpy as np
from typing import List, Dict, Tuple
from .schemas import StationCoordinate

class BaselineObservation:
    """Single baseline observation between two stations."""
    
    def __init__(self, from_station: str, to_station: str,
                 dx: float, dy: float, dz: float,
                 sigma_x: float, sigma_y: float, sigma_z: float):
        self.from_station = from_station
        self.to_station = to_station
        self.dx = dx  # Observed ECEF baseline components
        self.dy = dy
        self.dz = dz
        self.sigma_x = sigma_x  # Standard deviations
        self.sigma_y = sigma_y
        self.sigma_z = sigma_z

class NetworkAdjustment:
    """
    Least squares network adjustment for GNSS baselines.
    """
    
    def __init__(self):
        self.stations: Dict[str, np.ndarray] = {}  # Station ID -> ECEF coords
        self.baselines: List[BaselineObservation] = []
        self.fixed_stations: List[str] = []
    
    def add_station(self, station_id: str, x: float, y: float, z: float, fixed: bool = False):
        """Add station with approximate ECEF coordinates."""
        self.stations[station_id] = np.array([x, y, z])
        if fixed:
            self.fixed_stations.append(station_id)
    
    def add_baseline(self, obs: BaselineObservation):
        """Add baseline observation to network."""
        self.baselines.append(obs)
    
    def adjust(self, max_iterations: int = 10, convergence: float = 0.001) -> Dict:
        """
        Perform least squares adjustment.
        """
        # Build parameter vector (only unknown stations)
        unknown_stations = [s for s in self.stations.keys() if s not in self.fixed_stations]
        if not unknown_stations:
             # If no unknown stations, nothing to adjust. Just return current state with zero residuals/stats
             return {
                "adjusted_coordinates": {s: self.stations[s] for s in self.stations},
                "coordinate_std": {s: np.zeros(3) for s in self.stations},
                "residuals": np.zeros(len(self.baselines) * 3),
                "sigma_0": 0.0,
                "iterations": 0,
                "degrees_of_freedom": 0
             }

        n_params = len(unknown_stations) * 3  # 3 coords per station
        n_obs = len(self.baselines) * 3  # 3 components per baseline
        
        if n_obs < n_params:
            raise ValueError(f"Underdetermined system: {n_obs} observations, {n_params} parameters")
        
        # Iterative adjustment
        iteration = 0
        delta_X = np.zeros(n_params)

        for iteration in range(max_iterations):
            # Build design matrix A and observation vector L
            A = np.zeros((n_obs, n_params))
            L = np.zeros(n_obs)
            W = np.zeros((n_obs, n_obs))  # Weight matrix
            
            obs_idx = 0
            for baseline in self.baselines:
                # Get station indices
                from_idx = unknown_stations.index(baseline.from_station) if baseline.from_station in unknown_stations else None
                to_idx = unknown_stations.index(baseline.to_station) if baseline.to_station in unknown_stations else None
                
                # Compute expected baseline from approximate coordinates
                from_coords = self.stations[baseline.from_station]
                to_coords = self.stations[baseline.to_station]
                expected = to_coords - from_coords
                
                # Observation minus computation
                L[obs_idx:obs_idx+3] = np.array([
                    baseline.dx - expected[0],
                    baseline.dy - expected[1],
                    baseline.dz - expected[2]
                ])
                
                # Design matrix (partial derivatives)
                if from_idx is not None:
                    A[obs_idx:obs_idx+3, from_idx*3:(from_idx+1)*3] = -np.eye(3)
                if to_idx is not None:
                    A[obs_idx:obs_idx+3, to_idx*3:(to_idx+1)*3] = np.eye(3)
                
                # Weights (inverse of variance)
                W[obs_idx, obs_idx] = 1 / baseline.sigma_x**2
                W[obs_idx+1, obs_idx+1] = 1 / baseline.sigma_y**2
                W[obs_idx+2, obs_idx+2] = 1 / baseline.sigma_z**2
                
                obs_idx += 3
            
            # Normal equations: N*X = U
            N = A.T @ W @ A
            U = A.T @ W @ L
            
            # Solve for parameter corrections
            try:
                delta_X = np.linalg.solve(N, U)
            except np.linalg.LinAlgError:
                raise ValueError("Singular normal matrix - check network geometry")
            
            # Update station coordinates
            for i, station_id in enumerate(unknown_stations):
                self.stations[station_id] += delta_X[i*3:(i+1)*3]
            
            # Check convergence
            if np.max(np.abs(delta_X)) < convergence:
                break
        
        # Compute residuals and statistics
        V = A @ delta_X - L
        
        if (n_obs - n_params) > 0:
            sigma_0_squared = (V.T @ W @ V) / (n_obs - n_params)  # Variance of unit weight
        else:
            sigma_0_squared = 0.0

        try:
            Q_xx = np.linalg.inv(N)  # Cofactor matrix
        except:
             Q_xx = np.zeros((n_params, n_params))

        # Compute adjusted coordinate standard deviations
        adjusted_coords = {}
        coord_std = {}
        
        # fixed stations have 0 std
        for s in self.fixed_stations:
             adjusted_coords[s] = self.stations[s].copy()
             coord_std[s] = np.zeros(3)

        for i, station_id in enumerate(unknown_stations):
            adjusted_coords[station_id] = self.stations[station_id].copy()
            std = np.sqrt(np.diag(Q_xx[i*3:(i+1)*3, i*3:(i+1)*3]) * sigma_0_squared)
            coord_std[station_id] = std
        
        return {
            "adjusted_coordinates": adjusted_coords,
            "coordinate_std": coord_std,
            "residuals": V,
            "sigma_0": np.sqrt(sigma_0_squared),
            "iterations": iteration + 1,
            "degrees_of_freedom": n_obs - n_params
        }
