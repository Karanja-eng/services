"""
Pipe Sizing Calculator
Uses fixture unit method for supply and drainage pipe sizing
"""

from typing import Dict, List
import math


class PipeSizingCalculator:
    """
    Calculate pipe sizes using fixture unit method
    Based on IPC (International Plumbing Code) tables
    """
    
    # Water supply pipe sizing (fixture units to pipe diameter in mm)
    SUPPLY_SIZING_TABLE = {
        # For copper/PEX tubing
        # (max_fixture_units, flow_rate_gpm): diameter_mm
        1.0: 12,   # 1/2"
        2.5: 15,   # 3/4" 
        6.0: 20,   # 1"
        10.0: 25,  # 1-1/4"
        16.0: 32,  # 1-1/2"
        27.0: 40,  # 2"
        44.0: 50,  # 2-1/2"
        72.0: 65,  # 3"
        100.0: 80, # 4"
    }
    
    # Drainage pipe sizing (DFU to pipe diameter)
    DRAINAGE_SIZING_TABLE = {
        # Horizontal branches (1/4" per foot slope)
        # max_dfu: diameter_mm
        1: 32,     # 1-1/4"
        3: 40,     # 1-1/2"
        6: 50,     # 2"
        12: 65,    # 2-1/2"
        20: 75,    # 3"
        160: 100,  # 4"
        360: 125,  # 5"
        620: 150,  # 6"
    }
    
    # Vertical stacks
    STACK_SIZING_TABLE = {
        2: 32,     # 1-1/4"
        4: 40,     # 1-1/2"
        10: 50,    # 2"
        20: 65,    # 2-1/2"
        30: 75,    # 3"
        240: 100,  # 4"
        540: 125,  # 5"
        1100: 150, # 6"
    }
    
    # Vent pipe sizing
    VENT_SIZING_TABLE = {
        1: 32,     # 1-1/4"
        8: 40,     # 1-1/2"
        24: 50,    # 2"
        50: 65,    # 2-1/2"
        75: 75,    # 3"
        200: 100,  # 4"
    }
    
    @staticmethod
    def size_supply_pipe(fixture_units: float, is_main: bool = False) -> int:
        """
        Size water supply pipe based on fixture units
        
        Args:
            fixture_units: Total fixture units served
            is_main: True if this is a main supply line
            
        Returns:
            Pipe diameter in mm
        """
        # Apply demand factor for larger systems
        if fixture_units > 10:
            # Demand doesn't scale linearly - use Hunter's curve approximation
            effective_fu = fixture_units * 0.7
        else:
            effective_fu = fixture_units
        
        # Find appropriate size from table
        for max_fu, diameter in sorted(PipeSizingCalculator.SUPPLY_SIZING_TABLE.items()):
            if effective_fu <= max_fu:
                return diameter
        
        # If exceeds table, use largest size
        return 80
    
    @staticmethod
    def size_drainage_pipe(
        fixture_units: float,
        is_vertical: bool = False,
        slope: float = 0.02  # 2% or 1/4" per foot
    ) -> int:
        """
        Size drainage pipe based on fixture units
        
        Args:
            fixture_units: Total drainage fixture units
            is_vertical: True for vertical stacks, False for horizontal branches
            slope: Pipe slope (default 0.02 = 2% = 1/4" per foot)
            
        Returns:
            Pipe diameter in mm
        """
        table = (PipeSizingCalculator.STACK_SIZING_TABLE if is_vertical 
                else PipeSizingCalculator.DRAINAGE_SIZING_TABLE)
        
        # Adjust capacity for slope if horizontal
        if not is_vertical:
            if slope < 0.01:  # Less than 1% slope
                # Reduce capacity - need larger pipe
                fixture_units = fixture_units * 1.5
            elif slope > 0.04:  # More than 4% slope
                # Can be aggressive, but avoid scour
                fixture_units = fixture_units * 0.9
        
        # Find appropriate size
        for max_dfu, diameter in sorted(table.items()):
            if fixture_units <= max_dfu:
                return diameter
        
        # If exceeds table, use largest size
        return 150
    
    @staticmethod
    def size_vent_pipe(fixture_units: float, developed_length: float = 0) -> int:
        """
        Size vent pipe based on fixture units
        
        Args:
            fixture_units: Total fixture units vented
            developed_length: Total vent pipe length in meters
            
        Returns:
            Pipe diameter in mm
        """
        # Longer vents need larger diameter
        if developed_length > 15:
            fixture_units = fixture_units * 1.3
        elif developed_length > 30:
            fixture_units = fixture_units * 1.5
        
        for max_fu, diameter in sorted(PipeSizingCalculator.VENT_SIZING_TABLE.items()):
            if fixture_units <= max_fu:
                return diameter
        
        return 100
    
    @staticmethod
    def calculate_fixture_units(fixtures: List) -> Dict[str, float]:
        """
        Calculate total fixture units from fixture list
        
        Args:
            fixtures: List of PlumbingFixture objects
            
        Returns:
            Dict with supply and drainage fixture units
        """
        total_supply_fu = 0.0
        total_drainage_fu = 0.0
        
        for fixture in fixtures:
            # Supply FU (same for hot and cold)
            total_supply_fu += fixture.fixture_units
            
            # Drainage FU (same value typically)
            total_drainage_fu += fixture.fixture_units
        
        return {
            "supply": total_supply_fu,
            "drainage": total_drainage_fu
        }
    
    @staticmethod
    def validate_trap_arm_length(diameter_mm: int, length_mm: float) -> bool:
        """
        Validate trap arm length per code
        Maximum horizontal developed length from trap to vent
        
        Args:
            diameter_mm: Trap arm diameter
            length_mm: Horizontal developed length
            
        Returns:
            True if within code limits
        """
        # IPC Table 1002.1 - Maximum trap arm length
        max_lengths = {
            32: 1500,   # 1-1/4": 60"
            40: 1800,   # 1-1/2": 72"
            50: 2400,   # 2": 96"
            65: 3000,   # 2-1/2": 120"
            75: 3600,   # 3": 144"
            100: 3000,  # 4": 120" (reduced due to scour risk)
        }
        
        max_length = max_lengths.get(diameter_mm, 1500)
        return length_mm <= max_length
    
    @staticmethod
    def minimum_slope_required(diameter_mm: int) -> float:
        """
        Get minimum required slope for drainage pipes
        
        Args:
            diameter_mm: Pipe diameter
            
        Returns:
            Minimum slope as decimal (e.g., 0.02 = 2%)
        """
        # IPC Table 704.1
        if diameter_mm <= 65:  # Up to 2.5"
            return 0.0208  # 1/4" per foot
        elif diameter_mm <= 100:  # 3" to 4"
            return 0.0104  # 1/8" per foot
        else:  # 5" and larger
            return 0.0052  # 1/16" per foot
    
    @staticmethod
    def water_heater_size(
        fixture_units: float,
        num_bedrooms: int = 3,
        num_bathrooms: int = 2
    ) -> Dict[str, float]:
        """
        Estimate water heater size requirements
        
        Args:
            fixture_units: Total hot water fixture units
            num_bedrooms: Number of bedrooms
            num_bathrooms: Number of bathrooms
            
        Returns:
            Dict with tank capacity (liters) and recovery rate (liters/hour)
        """
        # Base on bathroom count (common sizing method)
        base_capacity = {
            1: 115,   # 30 gallons
            1.5: 150, # 40 gallons
            2: 150,   # 40 gallons
            2.5: 190, # 50 gallons
            3: 190,   # 50 gallons
        }
        
        capacity_liters = base_capacity.get(num_bathrooms, 190)
        
        # Adjust for high fixture count
        if fixture_units > 15:
            capacity_liters = 230  # 60 gallons
        if fixture_units > 25:
            capacity_liters = 300  # 80 gallons
        
        # Recovery rate (gallons per hour at 100°F rise)
        # Typically 70-80% of rated input for gas, 100% for electric
        recovery_rate = capacity_liters * 1.5  # Conservative estimate
        
        return {
            "tank_capacity_liters": capacity_liters,
            "recovery_rate_lph": recovery_rate,
            "first_hour_rating": capacity_liters + (recovery_rate * 0.7)
        }
    
    @staticmethod
    def pressure_loss_estimate(
        flow_rate_lpm: float,
        diameter_mm: int,
        length_m: float,
        fittings_count: int = 0
    ) -> float:
        """
        Estimate pressure loss in supply pipes (simplified Darcy-Weisbach)
        
        Args:
            flow_rate_lpm: Flow rate in liters per minute
            diameter_mm: Pipe diameter
            length_m: Pipe length
            fittings_count: Number of fittings (adds equivalent length)
            
        Returns:
            Pressure loss in kPa
        """
        # Convert to metric
        diameter_m = diameter_mm / 1000.0
        flow_rate_m3s = flow_rate_lpm / 60000.0
        
        # Add equivalent length for fittings
        equiv_length_per_fitting = diameter_m * 30  # Rough estimate
        total_length = length_m + (fittings_count * equiv_length_per_fitting)
        
        # Velocity
        area = math.pi * (diameter_m / 2) ** 2
        velocity = flow_rate_m3s / area if area > 0 else 0
        
        # Darcy-Weisbach equation (simplified)
        friction_factor = 0.02  # Typical for smooth pipe
        density = 1000  # kg/m³ for water
        
        if diameter_m > 0:
            pressure_loss_pa = (friction_factor * total_length / diameter_m * 
                              density * velocity ** 2 / 2)
            return pressure_loss_pa / 1000  # Convert to kPa
        
        return 0.0