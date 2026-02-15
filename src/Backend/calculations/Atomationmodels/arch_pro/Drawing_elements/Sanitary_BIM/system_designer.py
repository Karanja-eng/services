"""
Complete sanitary system designer.
Integrates all components into constructible, code-compliant systems.
"""

import json
from typing import List, Dict, Optional
from sanitary_core import Point3D, WaterSystemType, DESIGN_CODE, SanitaryEngineeringError
from septic_tank import SepticTank, design_septic_system
from soakpit import SoakPit, design_soakaway_system, SoilType
from manhole import Manhole, create_standard_manhole, create_inspection_chamber
from sewer_pipe import SewerPipe, PipeNetwork, create_sewer_pipe, PipeType, MaterialType
from water_tank import UndergroundWaterTank, design_potable_water_tank, design_fire_water_tank


class CompleteSanitarySystem:
    """
    Complete on-site sanitation system with all components.
    
    Integrates:
    - Black water collection
    - Septic treatment
    - Effluent disposal (soakaway)
    - Manholes and pipes
    - Water storage (if required)
    """
    
    def __init__(self, system_id: str, site_name: str):
        self.system_id = system_id
        self.site_name = site_name
        
        # Component collections
        self.septic_tanks: List[SepticTank] = []
        self.soakpits: List[SoakPit] = []
        self.manholes: List[Manhole] = []
        self.pipe_networks: Dict[str, PipeNetwork] = {}
        self.water_tanks: List[UndergroundWaterTank] = []
        
        # Site constraints
        self.buildings: List[Point3D] = []
        self.wells: List[Point3D] = []
        self.property_boundaries: List[Point3D] = []
        
        # Validation results
        self.is_validated = False
        self.validation_errors: List[str] = []
    
    def add_building_location(self, location: Point3D):
        """Register building location for separation checks"""
        self.buildings.append(location)
    
    def add_well_location(self, location: Point3D):
        """Register well location for separation checks"""
        self.wells.append(location)
    
    def add_property_boundary(self, location: Point3D):
        """Register property boundary point"""
        self.property_boundaries.append(location)
    
    def add_septic_tank(self, tank: SepticTank):
        """Add septic tank to system"""
        self.septic_tanks.append(tank)
    
    def add_soakpit(self, pit: SoakPit):
        """Add soak pit to system"""
        self.soakpits.append(pit)
    
    def add_manhole(self, manhole: Manhole):
        """Add manhole to system"""
        self.manholes.append(manhole)
    
    def add_water_tank(self, tank: UndergroundWaterTank):
        """Add water tank to system"""
        self.water_tanks.append(tank)
    
    def create_pipe_network(self, network_id: str) -> PipeNetwork:
        """Create new pipe network"""
        network = PipeNetwork(network_id)
        self.pipe_networks[network_id] = network
        return network
    
    def validate_system(self) -> bool:
        """
        Validate entire system for code compliance.
        
        Returns:
            True if valid, False otherwise (check validation_errors)
        """
        
        self.validation_errors.clear()
        
        # Validate septic tanks
        for tank in self.septic_tanks:
            try:
                tank.validate_site_constraints(
                    buildings=self.buildings,
                    wells=self.wells,
                    property_lines=self.property_boundaries
                )
            except SanitaryEngineeringError as e:
                self.validation_errors.append(f"Septic tank {tank.tank_id}: {str(e)}")
        
        # Validate soak pits
        for pit in self.soakpits:
            try:
                pit.validate_site_constraints(
                    buildings=self.buildings,
                    wells=self.wells
                )
            except SanitaryEngineeringError as e:
                self.validation_errors.append(f"Soak pit {pit.pit_id}: {str(e)}")
        
        # Validate manholes
        for mh in self.manholes:
            try:
                mh.validate_hydraulics()
            except SanitaryEngineeringError as e:
                self.validation_errors.append(f"Manhole {mh.manhole_id}: {str(e)}")
        
        # Validate pipe networks
        for network_id, network in self.pipe_networks.items():
            try:
                network.validate_network()
            except SanitaryEngineeringError as e:
                self.validation_errors.append(f"Network {network_id}: {str(e)}")
        
        # Validate water tank separations
        sewage_points = []
        for tank in self.septic_tanks:
            sewage_points.append(Point3D(
                tank.location.x + tank.external_dim.length / 2,
                tank.location.y + tank.external_dim.width / 2,
                tank.location.z
            ))
        
        for water_tank in self.water_tanks:
            try:
                water_tank.validate_site_constraints(sewage_systems=sewage_points)
            except SanitaryEngineeringError as e:
                self.validation_errors.append(f"Water tank {water_tank.tank_id}: {str(e)}")
        
        self.is_validated = (len(self.validation_errors) == 0)
        return self.is_validated
    
    def export_complete_system(self) -> Dict:
        """Export entire system as structured JSON"""
        
        return {
            "system_id": self.system_id,
            "site_name": self.site_name,
            "is_validated": self.is_validated,
            "validation_errors": self.validation_errors,
            "summary": {
                "num_septic_tanks": len(self.septic_tanks),
                "num_soakpits": len(self.soakpits),
                "num_manholes": len(self.manholes),
                "num_pipe_networks": len(self.pipe_networks),
                "num_water_tanks": len(self.water_tanks),
                "total_septic_capacity_m3": sum(t.actual_capacity for t in self.septic_tanks),
                "total_water_storage_m3": sum(t.actual_capacity for t in self.water_tanks)
            },
            "components": {
                "septic_tanks": [tank.to_json() for tank in self.septic_tanks],
                "soakpits": [pit.to_json() for pit in self.soakpits],
                "manholes": [mh.to_json() for mh in self.manholes],
                "pipe_networks": {
                    net_id: network.to_json() 
                    for net_id, network in self.pipe_networks.items()
                },
                "water_tanks": [tank.to_json() for tank in self.water_tanks]
            },
            "site_constraints": {
                "buildings": [b.to_dict() for b in self.buildings],
                "wells": [w.to_dict() for w in self.wells],
                "property_boundaries": [p.to_dict() for p in self.property_boundaries]
            }
        }
    
    def export_gltf_combined(self) -> Dict:
        """
        Export all components as combined GLTF scene.
        
        Note: In production, this would merge all meshes into single GLTF.
        For now, returns dict of individual GLTF exports.
        """
        
        gltf_exports = {
            "septic_tanks": [tank.to_gltf() for tank in self.septic_tanks],
            "soakpits": [pit.to_gltf() for pit in self.soakpits],
            "manholes": [mh.to_gltf() for mh in self.manholes],
            "water_tanks": [tank.to_gltf() for tank in self.water_tanks],
            "pipes": []
        }
        
        # Add pipes from all networks
        for network in self.pipe_networks.values():
            for pipe in network.pipes.values():
                gltf_exports["pipes"].append(pipe.to_gltf())
        
        return gltf_exports
    
    def generate_construction_sequence(self) -> List[str]:
        """Generate construction sequencing notes"""
        
        sequence = [
            f"Construction Sequence for {self.site_name}",
            "=" * 60,
            "",
            "PHASE 1: SITE PREPARATION",
            "1. Survey and mark all underground utility locations",
            "2. Establish site benchmarks and datum levels",
            "3. Clear vegetation and strip topsoil",
            "4. Set out tank and pipe locations",
            "",
            "PHASE 2: EXCAVATION",
            "5. Excavate for deepest components first (septic tanks, manholes)",
            "6. Maintain stable slopes (1:1 for temporary, 1:1.5 for permanent)",
            "7. Provide dewatering if groundwater encountered",
            "8. Prepare formation levels",
            "",
            "PHASE 3: SEPTIC TANK CONSTRUCTION"
        ]
        
        for i, tank in enumerate(self.septic_tanks, 1):
            sequence.extend([
                f"9.{i} Pour base slab for tank {tank.tank_id}",
                f"    - Level: {tank.levels.invert:.3f}m",
                f"    - Dimensions: {tank.length:.2f}m x {tank.width:.2f}m",
                f"10.{i} Construct walls with watertight joints",
                f"11.{i} Install inlet and outlet connections",
                f"12.{i} Pour top slab with access covers"
            ])
        
        sequence.extend([
            "",
            "PHASE 4: PIPE INSTALLATION",
        ])
        
        pipe_count = sum(len(net.pipes) for net in self.pipe_networks.values())
        sequence.append(f"13. Install {pipe_count} pipe sections with bedding")
        sequence.append("14. Connect pipes to manholes and tanks")
        sequence.append("15. Test pipes for alignment and slope")
        
        sequence.extend([
            "",
            "PHASE 5: SOAKAWAY CONSTRUCTION"
        ])
        
        for i, pit in enumerate(self.soakpits, 1):
            sequence.extend([
                f"16.{i} Construct soak pit {pit.pit_id}",
                f"    - Excavate to {pit.levels.invert:.3f}m",
                f"    - Place {pit.base_gravel:.2f}m gravel base",
                f"    - Build perforated walls",
                f"    - Backfill with gravel surround"
            ])
        
        if self.water_tanks:
            sequence.extend([
                "",
                "PHASE 6: WATER TANK CONSTRUCTION"
            ])
            
            for i, tank in enumerate(self.water_tanks, 1):
                sequence.extend([
                    f"17.{i} Construct water tank {tank.tank_id}",
                    f"    - Pour {tank.wall_thickness.base_slab*1000:.0f}mm base slab",
                    f"    - Build waterproof walls",
                    f"    - Install connections (inlet, outlet, overflow)",
                    f"    - Pour top slab with access manhole"
                ])
        
        sequence.extend([
            "",
            "PHASE 7: TESTING AND COMMISSIONING",
            "- Water test all tanks for 24 hours",
            "- Camera inspect all pipe runs",
            "- Check all slopes with level",
            "- Test all access covers",
            "- Backfill in layers with compaction",
            "- Restore surface levels and landscaping",
            "",
            "PHASE 8: FINAL INSPECTION",
            "- Verify all components match approved drawings",
            "- Document as-built conditions",
            "- Provide operation and maintenance manuals",
            "- Train operators on system maintenance"
        ])
        
        return sequence
    
    def generate_maintenance_schedule(self) -> List[str]:
        """Generate maintenance schedule"""
        
        schedule = [
            f"Maintenance Schedule for {self.site_name}",
            "=" * 60,
            "",
            "MONTHLY INSPECTIONS:",
            "- Check all access covers are secure and intact",
            "- Inspect vent pipes for blockages",
            "- Check for surface ponding or odors",
            ""
        ]
        
        if self.septic_tanks:
            schedule.extend([
                "SEPTIC TANK MAINTENANCE:",
                "Every 6 months:",
                "- Measure sludge and scum depths",
                "- Inspect baffles and tees",
                "- Check for cracks or leaks",
                "",
                "Annually or when sludge > 400mm:",
                "- Desludge tank professionally",
                "- Dispose of septage at approved facility",
                "- Water test after desludging",
                ""
            ])
        
        if self.soakpits:
            schedule.extend([
                "SOAKAWAY MAINTENANCE:",
                "Every 6 months:",
                "- Check infiltration performance",
                "- Inspect for ponding or backup",
                "",
                "Every 2 years:",
                "- Clean inspection chamber",
                "- Check gravel not clogged with solids",
                ""
            ])
        
        if self.manholes:
            schedule.extend([
                "MANHOLE MAINTENANCE:",
                "Annually:",
                "- Inspect benching and channel",
                "- Check for cracks or infiltration",
                "- Clean out sediment",
                "- Verify step irons are secure",
                ""
            ])
        
        schedule.extend([
            "PIPE SYSTEM MAINTENANCE:",
            "Every 2 years:",
            "- Camera inspect all accessible pipes",
            "- Jet clean if sediment accumulation",
            "- Check slopes maintained",
            "",
            "RECORDS:",
            "- Maintain log of all inspections",
            "- Record all desludging dates and volumes",
            "- Document any repairs or modifications",
            "- Update as-built drawings for any changes"
        ])
        
        return schedule


def design_residential_system(population: int,
                              building_location: Point3D,
                              septic_location: Point3D,
                              soakaway_location: Point3D,
                              soil_type: Dict = SoilType.SANDY_LOAM) -> CompleteSanitarySystem:
    """
    Design complete residential sanitation system.
    
    Args:
        population: Number of occupants
        building_location: Building position
        septic_location: Proposed septic tank location
        soakaway_location: Proposed soakaway location
        soil_type: Soil percolation characteristics
    
    Returns:
        Complete validated system
    """
    
    system = CompleteSanitarySystem(
        system_id=f"RES_{population}P",
        site_name=f"Residential - {population} persons"
    )
    
    # Add site constraints
    system.add_building_location(building_location)
    
    # Design septic tank
    septic = design_septic_system(
        population=population,
        site_location=septic_location,
        buildings=[building_location]
    )
    system.add_septic_tank(septic)
    
    # Calculate daily flow for soakaway
    daily_flow = population * DESIGN_CODE.WASTEWATER_GENERATION_RATE / 1000  # m³/day
    
    # Design soakaway
    soakaway = design_soakaway_system(
        daily_flow=daily_flow,
        site_location=soakaway_location,
        soil_type=soil_type,
        buildings=[building_location]
    )
    system.add_soakpit(soakaway)
    
    # Create pipe network
    network = system.create_pipe_network("main_sewer")
    
    # Pipe from septic to soakaway
    # Use connect_points_with_pipe to ensure adequate slope
    from sewer_pipe import connect_points_with_pipe
    
    pipe = connect_points_with_pipe(
        start=septic.outlet_position,
        end=soakaway.inlet_position,
        min_slope=1.0,
        diameter=0.100
    )
    pipe.pipe_id = "septic_to_soakaway"
    pipe.pipe_type = PipeType.SEWER_LINE
    network.add_pipe(pipe)
    
    # Add manhole if distance is long
    if pipe.horizontal_length > 30:
        midpoint_x = (septic.outlet_position.x + soakaway.inlet_position.x) / 2
        midpoint_y = (septic.outlet_position.y + soakaway.inlet_position.y) / 2
        midpoint_z = pipe.get_invert_at_distance(pipe.horizontal_length / 2) - 1.2
        
        mh = create_standard_manhole(
            manhole_id="MH1",
            location=Point3D(midpoint_x, midpoint_y, midpoint_z),
            depth=1.2
        )
        system.add_manhole(mh)
    
    # Validate system
    is_valid = system.validate_system()
    
    if not is_valid:
        print("VALIDATION ERRORS:")
        for error in system.validation_errors:
            print(f"  - {error}")
    else:
        print("System validated successfully!")
    
    return system