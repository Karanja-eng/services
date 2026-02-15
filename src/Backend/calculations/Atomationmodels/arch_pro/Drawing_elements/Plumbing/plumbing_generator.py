"""
Plumbing System Generator
Main orchestrator for complete plumbing system generation
"""

import numpy as np
import json
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from plumbing_fixtures import (
    PlumbingFixture, WC, WashBasin, KitchenSink, Shower, 
    Bathtub, Urinal, FloorDrain, WashingMachine, Dishwasher,
    ExternalTap, Bidet
)
from pipe_models import (
    PipeSegment, PipeSystem, PipeMaterial, PlumbingStack,
    PipeNetwork, Valve, Trap
)
from pipe_sizing import PipeSizingCalculator
from pipe_routing import PipeRouter, DrainageRouter, SupplyRouter, RoutingConstraint
from validation import PlumbingValidator, PlumbingSystemAnalyzer
from gltf_export import GLTFExporter, create_pipe_mesh


@dataclass
class FloorPlan:
    """Floor plan definition"""
    floor_number: int
    floor_elevation: float  # mm from datum
    fixtures: List[PlumbingFixture]
    wet_zones: List[Tuple[np.ndarray, np.ndarray]]  # (min_corner, max_corner)
    structural_elements: List[Tuple[np.ndarray, np.ndarray]] = None
    
    def __post_init__(self):
        if self.structural_elements is None:
            self.structural_elements = []


@dataclass
class BuildingPlumbing:
    """Complete building plumbing definition"""
    floors: List[FloorPlan]
    main_entry_point: np.ndarray  # Water supply entry
    main_sewer_connection: np.ndarray  # Drainage exit
    water_heater_location: np.ndarray
    
    
class PlumbingSystemGenerator:
    """
    Complete plumbing system generator
    Produces code-compliant, constructible plumbing systems
    """
    
    def __init__(self, building: BuildingPlumbing):
        self.building = building
        self.validator = PlumbingValidator()
        self.analyzer = PlumbingSystemAnalyzer()
        
        # System components
        self.supply_networks: Dict[str, PipeNetwork] = {}
        self.drainage_networks: Dict[str, PipeNetwork] = {}
        self.vent_networks: Dict[str, PipeNetwork] = {}
        self.stacks: List[PlumbingStack] = []
        self.water_heater = None
        
        # Routing engines
        self.supply_router = SupplyRouter(grid_resolution=200)
        self.drainage_router = DrainageRouter(grid_resolution=200, min_slope=0.02)
        
    def generate_complete_system(self) -> Dict:
        """
        Generate complete plumbing system
        
        Returns:
            System data dictionary
        """
        print("Generating plumbing system...")
        
        # Step 1: Analyze requirements
        print("  - Analyzing fixture requirements...")
        self._analyze_fixture_requirements()
        
        # Step 2: Plan vertical stacks
        print("  - Planning vertical stacks...")
        self._plan_vertical_stacks()
        
        # Step 3: Route drainage system
        print("  - Routing drainage system...")
        self._route_drainage_system()
        
        # Step 4: Route vent system
        print("  - Routing vent system...")
        self._route_vent_system()
        
        # Step 5: Size and route water supply
        print("  - Sizing and routing water supply...")
        self._route_water_supply()
        
        # Step 6: Place water heater and hot water system
        print("  - Configuring water heater...")
        self._configure_water_heater()
        
        # Step 7: Validate system
        print("  - Validating system...")
        validation_result = self._validate_system()
        
        # Step 8: Generate outputs
        print("  - Generating outputs...")
        system_data = self._compile_system_data()
        system_data['validation'] = validation_result
        
        print("System generation complete!")
        return system_data
    
    def _analyze_fixture_requirements(self):
        """Analyze all fixtures and calculate requirements"""
        all_fixtures = []
        for floor in self.building.floors:
            all_fixtures.extend(floor.fixtures)
        
        capacity = self.analyzer.calculate_system_capacity(all_fixtures)
        print(f"    Total fixture units: {capacity['drainage_fu']:.1f} DFU")
        print(f"    Peak demand: {capacity['peak_demand_lpm']:.1f} LPM")
    
    def _plan_vertical_stacks(self):
        """Plan locations for vertical plumbing stacks"""
        # Identify wet zones on each floor
        wet_zones_by_floor = {}
        floor_elevations = []
        
        for floor in self.building.floors:
            floor_elevations.append(floor.floor_elevation)
            wet_zones_by_floor[floor.floor_number] = floor.wet_zones
        
        # Find optimal stack locations (clustering wet zones)
        stack_locations = self._cluster_wet_zones(wet_zones_by_floor)
        
        # Create stacks
        for i, location in enumerate(stack_locations):
            # Soil stack (combined waste + vent)
            soil_stack = PlumbingStack(
                stack_id=f"soil_stack_{i}",
                stack_type="soil",
                base_position=location,
                floors=floor_elevations,
                diameter=100  # 4" stack
            )
            self.stacks.append(soil_stack)
            
            # Separate vent stack if needed
            vent_stack = PlumbingStack(
                stack_id=f"vent_stack_{i}",
                stack_type="vent",
                base_position=location + np.array([300, 0]),  # Offset slightly
                floors=floor_elevations,
                diameter=50  # 2" vent
            )
            self.stacks.append(vent_stack)
        
        print(f"    Planned {len(self.stacks)} vertical stacks")
    
    def _cluster_wet_zones(
        self,
        wet_zones_by_floor: Dict[int, List[Tuple[np.ndarray, np.ndarray]]]
    ) -> List[np.ndarray]:
        """Find optimal locations for vertical stacks"""
        # Simple clustering: find centroids of wet zones
        all_centroids = []
        
        for zones in wet_zones_by_floor.values():
            for min_corner, max_corner in zones:
                centroid = (min_corner + max_corner) / 2.0
                all_centroids.append(centroid[:2])  # X, Y only
        
        if not all_centroids:
            # Default: use building center
            return [np.array([5000, 5000])]
        
        # Find unique clusters (simplified - use first unique location)
        clusters = []
        for centroid in all_centroids:
            if not clusters:
                clusters.append(centroid)
            else:
                # Check if far enough from existing clusters
                min_dist = min(np.linalg.norm(centroid - c) for c in clusters)
                if min_dist > 3000:  # 3m minimum spacing
                    clusters.append(centroid)
        
        return clusters if clusters else [np.array([5000, 5000])]
    
    def _route_drainage_system(self):
        """Route complete drainage system"""
        drainage_network = PipeNetwork("drainage_main", PipeSystem.WASTE)
        
        # Connect each fixture to nearest stack
        for floor in self.building.floors:
            for fixture in floor.fixtures:
                # Find waste connection
                waste_node = None
                for node in fixture.get_world_connection_nodes():
                    if node.connection_type == "waste":
                        waste_node = node
                        break
                
                if not waste_node:
                    continue
                
                # Find nearest soil stack
                nearest_stack = None
                min_distance = float('inf')
                
                for stack in self.stacks:
                    if stack.stack_type != "soil":
                        continue
                    
                    # Stack position at this floor
                    stack_pos = np.array([
                        stack.base_position[0],
                        stack.base_position[1],
                        floor.floor_elevation
                    ])
                    
                    dist = np.linalg.norm(waste_node.position - stack_pos)
                    if dist < min_distance:
                        min_distance = dist
                        nearest_stack = (stack, stack_pos)
                
                if nearest_stack:
                    stack, stack_pos = nearest_stack
                    
                    # Route drainage pipe with gravity slope
                    try:
                        # Adjust target to be below fixture
                        target = stack_pos.copy()
                        target[2] = waste_node.position[2] - 200  # Drop 200mm
                        
                        path = self.drainage_router.route_drainage_pipe(
                            start=waste_node.position,
                            end=target,
                            diameter=waste_node.diameter
                        )
                        
                        if path:
                            # Size pipe
                            diameter = PipeSizingCalculator.size_drainage_pipe(
                                fixture.fixture_units,
                                is_vertical=False
                            )
                            
                            segments, fittings = self.drainage_router.generate_pipe_segments(
                                waypoints=path,
                                diameter=diameter,
                                system=PipeSystem.WASTE,
                                material=PipeMaterial.PVC,
                                base_id=f"drain_{fixture.fixture_id}"
                            )
                            
                            for seg in segments:
                                drainage_network.add_segment(seg)
                            for fit in fittings:
                                drainage_network.add_fitting(fit)
                            
                    except ValueError as e:
                        print(f"    Warning: Could not route drainage for {fixture.fixture_id}: {e}")
        
        # Add stack segments
        for stack in self.stacks:
            if stack.stack_type == "soil":
                for seg in stack.get_segments():
                    drainage_network.add_segment(seg)
        
        self.drainage_networks["main"] = drainage_network
        print(f"    Routed {len(drainage_network.segments)} drainage segments")
    
    def _route_vent_system(self):
        """Route vent system"""
        vent_network = PipeNetwork("vent_main", PipeSystem.VENT)
        
        # Connect fixtures requiring vents
        for floor in self.building.floors:
            for fixture in floor.fixtures:
                if not fixture.vent_required:
                    continue
                
                # Find vent connection
                vent_node = None
                for node in fixture.get_world_connection_nodes():
                    if node.connection_type == "vent":
                        vent_node = node
                        break
                
                if not vent_node:
                    continue
                
                # Find nearest vent stack
                nearest_stack = None
                min_distance = float('inf')
                
                for stack in self.stacks:
                    if stack.stack_type != "vent":
                        continue
                    
                    stack_pos = np.array([
                        stack.base_position[0],
                        stack.base_position[1],
                        floor.floor_elevation + 2000  # Above fixture
                    ])
                    
                    dist = np.linalg.norm(vent_node.position - stack_pos)
                    if dist < min_distance:
                        min_distance = dist
                        nearest_stack = (stack, stack_pos)
                
                if nearest_stack:
                    stack, stack_pos = nearest_stack
                    
                    # Route vent pipe (can go up)
                    path = self.supply_router.route_pipe(
                        start=vent_node.position,
                        end=stack_pos,
                        system=PipeSystem.VENT
                    )
                    
                    if path:
                        diameter = PipeSizingCalculator.size_vent_pipe(
                            fixture.fixture_units
                        )
                        
                        segments, fittings = self.supply_router.generate_pipe_segments(
                            waypoints=path,
                            diameter=diameter,
                            system=PipeSystem.VENT,
                            material=PipeMaterial.PVC,
                            base_id=f"vent_{fixture.fixture_id}"
                        )
                        
                        for seg in segments:
                            vent_network.add_segment(seg)
                        for fit in fittings:
                            vent_network.add_fitting(fit)
        
        # Add vent stack segments
        for stack in self.stacks:
            if stack.stack_type == "vent":
                for seg in stack.get_segments():
                    vent_network.add_segment(seg)
        
        self.vent_networks["main"] = vent_network
        print(f"    Routed {len(vent_network.segments)} vent segments")
    
    def _route_water_supply(self):
        """Route cold and hot water supply"""
        # Cold water supply
        cold_network = PipeNetwork("cold_water", PipeSystem.COLD_WATER)
        hot_network = PipeNetwork("hot_water", PipeSystem.HOT_WATER)
        
        # Collect all supply destinations
        cold_destinations = []
        hot_destinations = []
        
        for floor in self.building.floors:
            for fixture in floor.fixtures:
                for node in fixture.get_world_connection_nodes():
                    if node.connection_type == "supply_cold":
                        cold_destinations.append((node.position, fixture.fixture_units))
                    elif node.connection_type == "supply_hot":
                        hot_destinations.append((node.position, fixture.fixture_units))
        
        # Route cold water from main entry
        for dest, fu in cold_destinations:
            path = self.supply_router.route_pipe(
                start=self.building.main_entry_point,
                end=dest,
                system=PipeSystem.COLD_WATER
            )
            
            if path:
                diameter = PipeSizingCalculator.size_supply_pipe(fu)
                segments, fittings = self.supply_router.generate_pipe_segments(
                    waypoints=path,
                    diameter=diameter,
                    system=PipeSystem.COLD_WATER,
                    material=PipeMaterial.PEX,
                    base_id=f"cold_supply"
                )
                
                for seg in segments:
                    cold_network.add_segment(seg)
                for fit in fittings:
                    cold_network.add_fitting(fit)
        
        # Route hot water from water heater
        for dest, fu in hot_destinations:
            path = self.supply_router.route_pipe(
                start=self.building.water_heater_location,
                end=dest,
                system=PipeSystem.HOT_WATER
            )
            
            if path:
                diameter = PipeSizingCalculator.size_supply_pipe(fu)
                segments, fittings = self.supply_router.generate_pipe_segments(
                    waypoints=path,
                    diameter=diameter,
                    system=PipeSystem.HOT_WATER,
                    material=PipeMaterial.PEX,
                    base_id=f"hot_supply"
                )
                
                for seg in segments:
                    hot_network.add_segment(seg)
                for fit in fittings:
                    hot_network.add_fitting(fit)
        
        self.supply_networks["cold"] = cold_network
        self.supply_networks["hot"] = hot_network
        
        print(f"    Routed {len(cold_network.segments)} cold supply segments")
        print(f"    Routed {len(hot_network.segments)} hot supply segments")
    
    def _configure_water_heater(self):
        """Configure water heater based on demand"""
        all_fixtures = []
        for floor in self.building.floors:
            all_fixtures.extend(floor.fixtures)
        
        # Calculate hot water fixture units
        hot_water_fu = sum(
            f.fixture_units for f in all_fixtures
            if any(n.connection_type == "supply_hot" 
                  for n in f.get_world_connection_nodes())
        )
        
        # Size water heater
        num_bathrooms = sum(
            1 for f in all_fixtures 
            if f.fixture_type.value in ["wash_basin", "shower", "bathtub"]
        ) / 2  # Rough estimate
        
        sizing = PipeSizingCalculator.water_heater_size(
            fixture_units=hot_water_fu,
            num_bathrooms=int(num_bathrooms)
        )
        
        self.water_heater = {
            "location": self.building.water_heater_location.tolist(),
            "capacity_liters": sizing["tank_capacity_liters"],
            "recovery_rate_lph": sizing["recovery_rate_lph"],
            "first_hour_rating": sizing["first_hour_rating"]
        }
        
        print(f"    Water heater: {sizing['tank_capacity_liters']:.0f}L tank")
    
    def _validate_system(self) -> Dict:
        """Validate complete system"""
        all_fixtures = []
        for floor in self.building.floors:
            all_fixtures.extend(floor.fixtures)
        
        all_supply_pipes = []
        all_drainage_pipes = []
        all_vent_pipes = []
        
        for network in self.supply_networks.values():
            all_supply_pipes.extend(network.segments)
        
        for network in self.drainage_networks.values():
            all_drainage_pipes.extend(network.segments)
        
        for network in self.vent_networks.values():
            all_vent_pipes.extend(network.segments)
        
        floor_elevations = [f.floor_elevation for f in self.building.floors]
        
        is_valid, report = self.validator.validate_system(
            fixtures=all_fixtures,
            supply_pipes=all_supply_pipes,
            drainage_pipes=all_drainage_pipes,
            vent_pipes=all_vent_pipes,
            stacks=self.stacks,
            floors=floor_elevations
        )
        
        if is_valid:
            print("    ✓ System validation passed")
        else:
            print(f"    ✗ System validation failed ({report['error_count']} errors)")
            for error in report['errors'][:5]:  # Show first 5
                print(f"      - {error}")
        
        return report
    
    def _compile_system_data(self) -> Dict:
        """Compile all system data"""
        all_fixtures = []
        for floor in self.building.floors:
            all_fixtures.extend(floor.fixtures)
        
        data = {
            "system_type": "plumbing",
            "fixtures": [f.to_dict() for f in all_fixtures],
            "stacks": [s.to_dict() for s in self.stacks],
            "networks": {
                "cold_water": self.supply_networks.get("cold").to_dict() if "cold" in self.supply_networks else None,
                "hot_water": self.supply_networks.get("hot").to_dict() if "hot" in self.supply_networks else None,
                "drainage": self.drainage_networks.get("main").to_dict() if "main" in self.drainage_networks else None,
                "vent": self.vent_networks.get("main").to_dict() if "main" in self.vent_networks else None,
            },
            "water_heater": self.water_heater,
            "material_quantities": self._calculate_material_quantities()
        }
        
        return data
    
    def _calculate_material_quantities(self) -> Dict:
        """Calculate total material quantities"""
        all_pipes = []
        for network in list(self.supply_networks.values()) + \
                      list(self.drainage_networks.values()) + \
                      list(self.vent_networks.values()):
            if network:
                all_pipes.extend(network.segments)
        
        return self.analyzer.estimate_material_quantities(all_pipes)
    
    def export_to_gltf(self, filename: str):
        """Export system geometry to GLTF"""
        print(f"Exporting to {filename}...")
        
        exporter = GLTFExporter()
        
        # Export fixtures
        all_fixtures = []
        for floor in self.building.floors:
            all_fixtures.extend(floor.fixtures)
        
        for fixture in all_fixtures:
            try:
                geometry = fixture.generate_geometry()
                if geometry and len(geometry) > 0:
                    vertices = geometry[0]
                    if len(vertices) > 0:
                        mesh_idx = exporter.add_mesh_data(
                            vertices=vertices,
                            name=fixture.fixture_id,
                            material_index=3  # Ceramic
                        )
                        if mesh_idx >= 0:
                            exporter.add_node(
                                mesh_index=mesh_idx,
                                name=fixture.fixture_id,
                                translation=tuple(fixture.position)
                            )
            except Exception as e:
                print(f"    Warning: Could not export {fixture.fixture_id}: {e}")
        
        # Export pipes
        all_pipes = []
        for network in list(self.supply_networks.values()) + \
                      list(self.drainage_networks.values()) + \
                      list(self.vent_networks.values()):
            if network:
                all_pipes.extend(network.segments)
        
        for pipe in all_pipes:
            try:
                vertices, indices = create_pipe_mesh(
                    start=pipe.start_point,
                    end=pipe.end_point,
                    diameter=pipe.diameter
                )
                
                if len(vertices) > 0:
                    # Material based on system
                    mat_idx = 1 if pipe.system == PipeSystem.WASTE else 0
                    
                    mesh_idx = exporter.add_mesh_data(
                        vertices=vertices,
                        indices=indices,
                        name=pipe.pipe_id,
                        material_index=mat_idx
                    )
                    if mesh_idx >= 0:
                        exporter.add_node(
                            mesh_index=mesh_idx,
                            name=pipe.pipe_id
                        )
            except Exception as e:
                print(f"    Warning: Could not export pipe {pipe.pipe_id}: {e}")
        
        exporter.export_to_gltf(filename, embed_buffers=False)
        print(f"  Exported {len(all_fixtures)} fixtures and {len(all_pipes)} pipes")
    
    def export_to_json(self, filename: str):
        """Export system metadata to JSON"""
        system_data = self._compile_system_data()
        
        with open(filename, 'w') as f:
            json.dump(system_data, f, indent=2)
        
        print(f"  Exported metadata to {filename}")