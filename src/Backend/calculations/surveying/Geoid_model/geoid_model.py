# ============================================================================
# FILE: backend/gnss/geoid/geoid_model.py
# ============================================================================
import numpy as np
from pathlib import Path
from typing import Optional

class EGM2008GeoidModel:
    """
    EGM2008 geoid model reader and interpolator.
    
    Grid specifications:
    - Resolution: 2.5' × 2.5' (approximately 5km × 5km)
    - Coverage: Global (-90° to 90°, -180° to 180°)
    - Format: Binary grid file with float32 values
    - Size: ~40MB for global coverage
    """
    
    def __init__(self, grid_file: Optional[Path] = None):
        self.grid_file = grid_file
        self.grid_data = None
        self.resolution = 2.5 / 60.0  # 2.5 arc-minutes in degrees
        self.lat_min, self.lat_max = -90.0, 90.0
        self.lon_min, self.lon_max = -180.0, 180.0
        self.n_lat = int((self.lat_max - self.lat_min) / self.resolution) + 1
        self.n_lon = int((self.lon_max - self.lon_min) / self.resolution) + 1
        
        if grid_file and grid_file.exists():
            self._load_grid()
    
    def _load_grid(self) -> None:
        """Load binary geoid grid file into memory."""
        try:
            with open(self.grid_file, 'rb') as f:
                # Read binary grid (format: lat × lon array of float32)
                data = np.fromfile(f, dtype=np.float32)
                self.grid_data = data.reshape((self.n_lat, self.n_lon))
        except Exception as e:
            raise IOError(f"Failed to load EGM2008 grid file: {e}")
    
    def get_undulation(self, lat: float, lon: float) -> float:
        """
        Get geoid undulation at specified coordinates using bilinear interpolation.
        
        Args:
            lat: Latitude in decimal degrees
            lon: Longitude in decimal degrees
            
        Returns:
            Geoid undulation in meters
        """
        # If no grid loaded, use simplified model
        if self.grid_data is None:
            return self._simplified_model(lat, lon)
        
        # Normalize longitude to [-180, 180]
        lon = ((lon + 180) % 360) - 180
        
        # Find grid indices
        lat_idx = (lat - self.lat_min) / self.resolution
        lon_idx = (lon - self.lon_min) / self.resolution
        
        # Get surrounding grid points
        i0, i1 = int(np.floor(lat_idx)), int(np.ceil(lat_idx))
        j0, j1 = int(np.floor(lon_idx)), int(np.ceil(lon_idx))
        
        # Clamp to grid bounds
        i0 = max(0, min(i0, self.n_lat - 1))
        i1 = max(0, min(i1, self.n_lat - 1))
        j0 = max(0, min(j0, self.n_lon - 1))
        j1 = max(0, min(j1, self.n_lon - 1))
        
        # Bilinear interpolation weights
        lat_frac = lat_idx - i0
        lon_frac = lon_idx - j0
        
        # Interpolate
        v00 = self.grid_data[i0, j0]
        v01 = self.grid_data[i0, j1]
        v10 = self.grid_data[i1, j0]
        v11 = self.grid_data[i1, j1]
        
        v0 = v00 * (1 - lon_frac) + v01 * lon_frac
        v1 = v10 * (1 - lon_frac) + v11 * lon_frac
        
        undulation = v0 * (1 - lat_frac) + v1 * lat_frac
        
        return float(undulation)
    
    def _simplified_model(self, lat: float, lon: float) -> float:
        """Fallback simplified model when grid file not available."""
        phi = np.radians(lat)
        lambda_ = np.radians(lon)
        
        N = (30 * np.sin(2 * phi) * np.cos(lambda_)
             + 15 * np.sin(phi) * np.cos(2 * lambda_)
             - 10 * np.cos(3 * phi))
        
        return float(N)

# Global instance (lazy loaded)
_geoid_model = None

def get_geoid_model(grid_file: Optional[Path] = None) -> EGM2008GeoidModel:
    """Get singleton geoid model instance."""
    global _geoid_model
    if _geoid_model is None:
        _geoid_model = EGM2008GeoidModel(grid_file)
    return _geoid_model
