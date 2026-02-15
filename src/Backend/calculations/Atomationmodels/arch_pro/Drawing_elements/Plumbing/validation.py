"""
Plumbing System Validation Engine
Validates code compliance and engineering feasibility
"""

from typing import List, Dict, Tuple
import numpy as np
from dataclasses import dataclass

from plumbing_fixtures import PlumbingFixture, TrapType
from pipe_models import PipeSegment, PipeSystem, PlumbingStack, PipeNetwork
from pipe_sizing import PipeSizingCalculator


@dataclass
class ValidationError:
    """Validation error with severity"""
    severity: str  # "error", "warning", "info"
    code: str
    message: str
    affected_elements: List[str]
    location: np.ndarray = None
    
    def __str__(self):
        loc_str = f" at {self.location}" if self.location is not None else ""
        return f"[{self.severity.upper()}] {self.code}: {self.message}{loc_str}"


class PlumbingValidator:
    """Validate plumbing system for code compliance"""
    
    def __init__(self):
        self.errors: List[ValidationError] = []
        self.warnings: List[ValidationError] = []
        self.info: List[ValidationError] = []
    
    def add_error(self, code: str, message: str, elements: List[str], location=None):
        """Add validation error"""
        error = ValidationError("error", code, message, elements, location)
        self.errors.append(error)
    
    def add_warning(self, code: str, message: str, elements: List[str], location=None):
        """Add validation warning"""
        warning = ValidationError("warning", code, message, elements, location)
        self.warnings.append(warning)
    
    def add_info(self, code: str, message: str, elements: List[str], location=None):
        """Add informational message"""
        info = ValidationError("info", code, message, elements, location)
        self.info.append(info)
    
    def validate_fixture_connections(self, fixtures: List[PlumbingFixture]) -> bool:
        """Validate that all fixtures have required connections"""
        valid = True
        
        for fixture in fixtures:
            nodes = fixture.get_world_connection_nodes()
            
            # Check for required connections
            has_supply = any(n.connection_type in ["supply_hot", "supply_cold"] 
                           for n in nodes)
            has_waste = any(n.connection_type == "waste" for n in nodes)
            has_vent = any(n.connection_type == "vent" for n in nodes)
            
            # Water closets and urinals need waste
            if fixture.fixture_type.value in ["wc", "urinal"]:
                if not has_waste:
                    self.add_error(
                        "MISSING_WASTE",
                        f"Fixture {fixture.fixture_id} missing waste connection",
                        [fixture.fixture_id],
                        fixture.position
                    )
                    valid = False
            
            # Check vent requirements
            if fixture.vent_required and not has_vent:
                self.add_warning(
                    "MISSING_VENT",
                    f"Fixture {fixture.fixture_id} requires venting",
                    [fixture.fixture_id],
                    fixture.position
                )
        
        return valid
    
    def validate_drainage_slopes(self, drainage_pipes: List[PipeSegment]) -> bool:
        """Validate drainage pipe slopes meet code requirements"""
        valid = True
        
        for pipe in drainage_pipes:
            if pipe.system not in [PipeSystem.WASTE, PipeSystem.SOIL]:
                continue
            
            min_slope = PipeSizingCalculator.minimum_slope_required(pipe.diameter)
            actual_slope = pipe.get_slope()
            
            # Check if pipe slopes downward
            if actual_slope > 0:
                self.add_error(
                    "REVERSE_SLOPE",
                    f"Drainage pipe {pipe.pipe_id} slopes upward",
                    [pipe.pipe_id],
                    pipe.start_point
                )
                valid = False
            
            # Check minimum slope
            elif abs(actual_slope) < min_slope:
                self.add_error(
                    "INSUFFICIENT_SLOPE",
                    f"Pipe {pipe.pipe_id} slope {abs(actual_slope):.4f} "
                    f"< minimum {min_slope:.4f}",
                    [pipe.pipe_id],
                    pipe.start_point
                )
                valid = False
            
            # Check maximum slope (prevent scour)
            max_slope = 0.25  # 25% maximum
            if abs(actual_slope) > max_slope:
                self.add_warning(
                    "EXCESSIVE_SLOPE",
                    f"Pipe {pipe.pipe_id} slope {abs(actual_slope):.4f} "
                    f"may cause scour (>25%)",
                    [pipe.pipe_id],
                    pipe.start_point
                )
        
        return valid
    
    def validate_trap_arms(
        self,
        fixtures: List[PlumbingFixture],
        waste_pipes: List[PipeSegment]
    ) -> bool:
        """Validate trap arm lengths meet code requirements"""
        valid = True
        
        for fixture in fixtures:
            if not fixture.trap_type:
                continue
            
            # Find waste connection
            waste_node = None
            for node in fixture.get_world_connection_nodes():
                if node.connection_type == "waste":
                    waste_node = node
                    break
            
            if not waste_node:
                continue
            
            # Find connected pipe
            connected_pipe = None
            for pipe in waste_pipes:
                dist_to_start = np.linalg.norm(pipe.start_point - waste_node.position)
                if dist_to_start < 100:  # Within 100mm
                    connected_pipe = pipe
                    break
            
            if connected_pipe:
                # Calculate horizontal developed length
                length = connected_pipe.length()
                
                # Check against code limits
                if not PipeSizingCalculator.validate_trap_arm_length(
                    waste_node.diameter, length
                ):
                    self.add_error(
                        "TRAP_ARM_TOO_LONG",
                        f"Fixture {fixture.fixture_id} trap arm exceeds maximum length",
                        [fixture.fixture_id, connected_pipe.pipe_id],
                        fixture.position
                    )
                    valid = False
        
        return valid
    
    def validate_stack_continuity(
        self,
        stacks: List[PlumbingStack],
        floors: List[float]
    ) -> bool:
        """Validate plumbing stacks are continuous across floors"""
        valid = True
        
        for stack in stacks:
            # Check stack extends to all floors
            if len(stack.floors) < len(floors):
                self.add_warning(
                    "INCOMPLETE_STACK",
                    f"Stack {stack.stack_id} does not extend to all floors",
                    [stack.stack_id]
                )
            
            # Check for gaps in stack
            for i in range(len(stack.floors) - 1):
                gap = stack.floors[i + 1] - stack.floors[i]
                if gap > 5000:  # More than 5m
                    self.add_warning(
                        "EXCESSIVE_STACK_GAP",
                        f"Stack {stack.stack_id} has large gap between floors "
                        f"({gap/1000:.1f}m)",
                        [stack.stack_id]
                    )
        
        return valid
    
    def validate_clearances(
        self,
        fixtures: List[PlumbingFixture],
        walls: List[Tuple[np.ndarray, np.ndarray]] = None
    ) -> bool:
        """Validate fixture clearances"""
        valid = True
        
        # Check fixture-to-fixture clearances
        for i, fix1 in enumerate(fixtures):
            for fix2 in fixtures[i + 1:]:
                dist = np.linalg.norm(fix1.position - fix2.position)
                min_clearance = 300  # 300mm minimum between fixtures
                
                if dist < min_clearance:
                    self.add_warning(
                        "INSUFFICIENT_CLEARANCE",
                        f"Fixtures {fix1.fixture_id} and {fix2.fixture_id} "
                        f"too close ({dist:.0f}mm < {min_clearance}mm)",
                        [fix1.fixture_id, fix2.fixture_id]
                    )
        
        return valid
    
    def validate_venting(
        self,
        fixtures: List[PlumbingFixture],
        vent_pipes: List[PipeSegment],
        stacks: List[PlumbingStack]
    ) -> bool:
        """Validate venting requirements"""
        valid = True
        
        for fixture in fixtures:
            if not fixture.vent_required:
                continue
            
            # Check if fixture has vent connection
            has_vent = any(
                node.connection_type == "vent"
                for node in fixture.get_world_connection_nodes()
            )
            
            if not has_vent:
                # Check if within range of vent stack
                min_dist_to_stack = float('inf')
                for stack in stacks:
                    if stack.stack_type == "vent":
                        dist = np.linalg.norm(
                            fixture.position[:2] - stack.base_position
                        )
                        min_dist_to_stack = min(min_dist_to_stack, dist)
                
                if min_dist_to_stack > 3000:  # More than 3m
                    self.add_error(
                        "NO_VENT",
                        f"Fixture {fixture.fixture_id} requires venting "
                        f"(nearest stack: {min_dist_to_stack/1000:.1f}m)",
                        [fixture.fixture_id],
                        fixture.position
                    )
                    valid = False
        
        return valid
    
    def validate_water_supply_pressure(
        self,
        supply_pipes: List[PipeSegment],
        source_pressure_kpa: float = 400  # Typical municipal supply
    ) -> bool:
        """Validate supply pressure is adequate"""
        valid = True
        
        # Calculate total pressure loss
        total_loss = 0.0
        
        for pipe in supply_pipes:
            if pipe.system in [PipeSystem.COLD_WATER, PipeSystem.HOT_WATER]:
                # Rough estimate
                flow_rate = 15  # lpm per fixture unit
                loss = PipeSizingCalculator.pressure_loss_estimate(
                    flow_rate_lpm=flow_rate,
                    diameter_mm=pipe.diameter,
                    length_m=pipe.length() / 1000.0,
                    fittings_count=2
                )
                total_loss += loss
        
        final_pressure = source_pressure_kpa - total_loss
        min_required = 140  # 20 psi minimum
        
        if final_pressure < min_required:
            self.add_error(
                "INSUFFICIENT_PRESSURE",
                f"Final supply pressure {final_pressure:.0f} kPa "
                f"< minimum {min_required} kPa",
                ["supply_system"]
            )
            valid = False
        elif final_pressure < 200:
            self.add_warning(
                "LOW_PRESSURE",
                f"Final supply pressure {final_pressure:.0f} kPa is adequate "
                f"but low",
                ["supply_system"]
            )
        
        return valid
    
    def validate_system(
        self,
        fixtures: List[PlumbingFixture],
        supply_pipes: List[PipeSegment],
        drainage_pipes: List[PipeSegment],
        vent_pipes: List[PipeSegment],
        stacks: List[PlumbingStack],
        floors: List[float] = None
    ) -> Tuple[bool, Dict]:
        """
        Comprehensive system validation
        
        Returns:
            Tuple of (is_valid, validation_report)
        """
        self.errors = []
        self.warnings = []
        self.info = []
        
        # Run all validations
        self.validate_fixture_connections(fixtures)
        self.validate_drainage_slopes(drainage_pipes)
        self.validate_trap_arms(fixtures, drainage_pipes)
        self.validate_clearances(fixtures)
        self.validate_venting(fixtures, vent_pipes, stacks)
        self.validate_water_supply_pressure(supply_pipes)
        
        if floors and stacks:
            self.validate_stack_continuity(stacks, floors)
        
        # Generate report
        report = {
            "is_valid": len(self.errors) == 0,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "info_count": len(self.info),
            "errors": [str(e) for e in self.errors],
            "warnings": [str(w) for w in self.warnings],
            "info": [str(i) for i in self.info]
        }
        
        return len(self.errors) == 0, report


class PlumbingSystemAnalyzer:
    """Analyze plumbing system performance"""
    
    @staticmethod
    def calculate_system_capacity(
        fixtures: List[PlumbingFixture]
    ) -> Dict[str, float]:
        """Calculate total system capacity requirements"""
        total_cold_fu = 0.0
        total_hot_fu = 0.0
        total_drainage_fu = 0.0
        
        for fixture in fixtures:
            total_drainage_fu += fixture.fixture_units
            
            # Check connections for hot/cold
            for node in fixture.get_world_connection_nodes():
                if node.connection_type == "supply_cold":
                    total_cold_fu += fixture.fixture_units
                if node.connection_type == "supply_hot":
                    total_hot_fu += fixture.fixture_units
        
        return {
            "cold_water_fu": total_cold_fu,
            "hot_water_fu": total_hot_fu,
            "drainage_fu": total_drainage_fu,
            "peak_demand_lpm": total_cold_fu * 15,  # Rough estimate
        }
    
    @staticmethod
    def estimate_material_quantities(
        pipes: List[PipeSegment]
    ) -> Dict[str, Dict[float, float]]:
        """Calculate pipe material quantities by diameter"""
        quantities = {}
        
        for pipe in pipes:
            system = pipe.system.value
            diameter = pipe.diameter
            length = pipe.length() / 1000.0  # Convert to meters
            
            if system not in quantities:
                quantities[system] = {}
            
            if diameter not in quantities[system]:
                quantities[system][diameter] = 0.0
            
            quantities[system][diameter] += length
        
        return quantities