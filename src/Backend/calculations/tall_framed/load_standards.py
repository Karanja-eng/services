from typing import Dict, List, Optional
from pydantic import BaseModel

class BS6399:
    """
    BS 6399-1:1996 - Code of practice for dead and imposed loads
    BS 6399-2:1997 - Code of practice for wind loads
    """

    # Table 1 - Minimum imposed floor loads
    IMPOSED_LOADS = {
        "residential": {
            "description": "Self-contained dwelling units",
            "uniform": 1.5,  # kN/m2
            "concentrated": 1.4  # kN
        },
        "offices": {
            "description": "Offices for general use",
            "uniform": 2.5,
            "concentrated": 2.7
        },
        "classrooms": {
            "description": "Classrooms in schools/colleges",
            "uniform": 3.0,
            "concentrated": 2.7
        },
        "halls": {
            "description": "Assembly halls (fixed seating)",
            "uniform": 4.0,
            "concentrated": 4.5
        },
        "libraries_reading": {
            "description": "Libraries - Reading rooms",
            "uniform": 2.5,
            "concentrated": 4.5
        },
        "libraries_stack": {
            "description": "Libraries - Stack rooms",
            "uniform": 2.4,  # Per meter of stack height (needs calc) default min high
            "concentrated": 7.0 
        },
        "retail": {
            "description": "Shop floors for retail trade",
            "uniform": 4.0,
            "concentrated": 3.6
        },
        "stairs": {
            "description": "Stairs and landings",
            "uniform": 3.0, # Residential 1.5, others 3.0 or 4.0. Taking conservative
            "concentrated": 4.5
        }
    }

    @staticmethod
    def get_imposed_load(category: str) -> float:
        """Get standard imposed load for usage category"""
        usage = BS6399.IMPOSED_LOADS.get(category)
        if not usage:
            return 1.5 # Default to residential
        return usage["uniform"]

    @staticmethod
    def calculate_wind_load(
        basic_speed: float, # Vb (m/s)
        altitude: float,    # A (m)
        height: float,      # H (m)
        distance_to_sea: float, # km
        in_town: bool = True
    ) -> float:
        """
        Simplified Standard Method (BS 6399-2)
        Returns dynamic pressure qs (kN/m2)
        """
        
        # 1. Altitude Factor Sa
        # Sa = 1 + 0.001 * Altitude
        Sa = 1 + 0.001 * altitude
        
        # 2. Direction Factor Sd (Approximate as 1.0 for omni-directional check)
        Sd = 1.0
        
        # 3. Seasonal Factor Ss (Default 1.0)
        Ss = 1.0
        
        # 4. Probability Factor Sp (Default 1.0 for standard design life)
        Sp = 1.0
        
        # Site Wind Speed Vs
        Vs = basic_speed * Sa * Sd * Ss * Sp
        
        # 5. Effective Height He depends on surroundings. Simplified: He = height
        He = max(height, 0.4 * height) # Simply use height for top pressure
        
        # 6. Terrain and Building Factor Sb
        # Simplified lookup based on Town vs Country and Height
        # (Table 4 approximation)
        if in_town:
            # Town terrain (Category ~3/4)
            if He <= 2: Sb = 1.25 # Turbulance high near ground? No, Sb usually >1. 
            # Actually Sb for standard method:
            # Site in country: Sb ranges 1.2 to 2.1
            # Site in town: Sb ranges 1.1 to 1.9
             # Very rough curve fit for Sb based on Table 4:
            Sb = 1.6 + 0.1 * (He/50) # Very simplified
            if distance_to_sea < 10: Sb += 0.1
        else:
             # Country
            Sb = 1.8 + 0.1 * (He/50)

        # BS 6399-2 Standard Method uses Ve = Vs * Sb
        Ve = Vs * Sb
        
        # Dynamic Pressure qs = 0.613 * Ve^2 (Pa) -> /1000 for kPa
        qs = 0.613 * (Ve**2) / 1000
        
        # External Pressure Coefficient Cpe (Standard method: Overall load)
        # For rectangular building:
        # Windward wall: +0.85 (D > B) or +0.6 (D < B) -> approx 0.8
        # Leeward wall: -0.5
        # Total Cp = 1.3
        
        pressure = qs * 1.3
        
        return round(pressure, 3)
