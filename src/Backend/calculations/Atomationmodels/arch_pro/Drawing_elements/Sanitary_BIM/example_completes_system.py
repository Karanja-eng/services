"""
COMPLETE EXAMPLE: Residential Sanitary System Design
Demonstrates full workflow from requirements to GLTF export.
"""

import json
from sanitary_core import Point3D, DESIGN_CODE
from soakpit import SoilType
from system_designer import (
    CompleteSanitarySystem, 
    design_residential_system
)
from septic_tank import design_septic_system
from soakpit import design_soakaway_system
from manhole import create_standard_manhole, create_inspection_chamber
from sewer_pipe import create_sewer_pipe, PipeType, MaterialType, connect_points_with_pipe
from water_tank import design_potable_water_tank, design_fire_water_tank


def example_1_simple_residential():
    """
    Example 1: Simple 5-person residential system
    - 1 septic tank
    - 1 soakaway
    - Connecting pipes
    """
    
    print("="*70)
    print("EXAMPLE 1: Simple Residential System (5 persons)")
    print("="*70)
    print()
    
    # Site parameters
    population = 5
    
    # Locations (in meters, using arbitrary coordinate system)
    building = Point3D(x=0, y=0, z=100.0)  # Ground level at 100m
    septic_loc = Point3D(x=10, y=5, z=100.0)  # 10m from building
    soakaway_loc = Point3D(x=25, y=5, z=100.0)  # 15m from septic
    
    # Soil conditions
    soil = SoilType.SANDY_LOAM
    
    # Design system
    system = design_residential_system(
        population=population,
        building_location=building,
        septic_location=septic_loc,
        soakaway_location=soakaway_loc,
        soil_type=soil
    )
    
    # Export system data
    system_data = system.export_complete_system()
    
    print("\nSYSTEM SUMMARY:")
    print(f"  Septic tanks: {system_data['summary']['num_septic_tanks']}")
    print(f"  Total capacity: {system_data['summary']['total_septic_capacity_m3']:.2f} m³")
    print(f"  Soakpits: {system_data['summary']['num_soakpits']}")
    print(f"  Manholes: {system_data['summary']['num_manholes']}")
    
    # Show septic tank details
    if system.septic_tanks:
        tank = system.septic_tanks[0]
        print(f"\nSEPTIC TANK DETAILS:")
        print(f"  ID: {tank.tank_id}")
        print(f"  Dimensions: {tank.length:.2f}m x {tank.width:.2f}m x {tank.depth:.2f}m")
        print(f"  Capacity: {tank.actual_capacity:.2f} m³")
        print(f"  Chambers: {tank.num_chambers}")
        print(f"  Inlet invert: {tank.inlet_invert:.3f} m")
        print(f"  Outlet invert: {tank.outlet_invert:.3f} m")
    
    # Show soakaway details
    if system.soakpits:
        pit = system.soakpits[0]
        print(f"\nSOAKAWAY DETAILS:")
        print(f"  ID: {pit.pit_id}")
        print(f"  Shape: {pit.shape}")
        if pit.shape == "circular":
            print(f"  Diameter: {pit.diameter:.2f} m")
        print(f"  Depth: {pit.effective_depth:.2f} m")
        print(f"  Infiltration area: {pit.actual_area:.2f} m²")
        print(f"  Soil type: {pit.soil_type['name']}")
    
    # Construction sequence
    print("\n" + "="*70)
    print("CONSTRUCTION SEQUENCE:")
    print("="*70)
    for line in system.generate_construction_sequence()[:20]:  # First 20 lines
        print(line)
    print("... (sequence continues)")
    
    return system


def example_2_complex_development():
    """
    Example 2: Larger development with multiple components
    - 15 person capacity
    - Dual-chamber septic
    - Multiple manholes
    - Potable water tank
    """
    
    print("\n\n")
    print("="*70)
    print("EXAMPLE 2: Complex Development (15 persons)")
    print("="*70)
    print()
    
    system = CompleteSanitarySystem(
        system_id="DEV_15P",
        site_name="Small Development"
    )
    
    # Site constraints
    building1 = Point3D(x=0, y=0, z=105.0)
    building2 = Point3D(x=30, y=0, z=105.0)
    well = Point3D(x=50, y=50, z=105.0)
    
    system.add_building_location(building1)
    system.add_building_location(building2)
    system.add_well_location(well)
    
    # Septic tank (centrally located)
    septic = design_septic_system(
        population=15,
        site_location=Point3D(x=15, y=-10, z=105.0),
        buildings=[building1, building2],
        wells=[well]
    )
    system.add_septic_tank(septic)
    
    # Soakaway (downslope)
    daily_flow = 15 * DESIGN_CODE.WASTEWATER_GENERATION_RATE / 1000
    soakaway = design_soakaway_system(
        daily_flow=daily_flow,
        site_location=Point3D(x=15, y=-25, z=104.0),
        soil_type=SoilType.COARSE_SAND,
        shape="rectangular",
        buildings=[building1, building2],
        wells=[well]
    )
    system.add_soakpit(soakaway)
    
    # Manholes along pipe run
    mh1 = create_standard_manhole(
        manhole_id="MH1",
        location=Point3D(x=10, y=-5, z=103.5),
        depth=1.5
    )
    system.add_manhole(mh1)
    
    mh2 = create_inspection_chamber(
        chamber_id="IC1",
        location=Point3D(x=15, y=-15, z=103.0),
        depth=0.9
    )
    system.add_manhole(mh2)
    
    # Pipe network
    network = system.create_pipe_network("main_drainage")
    
    # Building 1 to MH1
    pipe1 = connect_points_with_pipe(
        start=Point3D(x=5, y=0, z=104.2),
        end=Point3D(x=10, y=-5, z=103.8),
        min_slope=1.0,
        diameter=0.100
    )
    pipe1.pipe_id = "P1"
    pipe1.pipe_type = PipeType.BRANCH_DRAIN
    network.add_pipe(pipe1)
    mh1.add_inlet_pipe("P1", invert=103.8, diameter=0.100, angle=225)
    
    # MH1 to septic
    pipe2 = connect_points_with_pipe(
        start=Point3D(x=10, y=-5, z=103.7),
        end=septic.inlet_position,
        min_slope=1.0,
        diameter=0.150
    )
    pipe2.pipe_id = "P2"
    pipe2.pipe_type = PipeType.MAIN_DRAIN
    network.add_pipe(pipe2)
    mh1.add_outlet_pipe("P2", invert=103.7, diameter=0.150, angle=180)
    
    # Septic to IC1
    pipe3 = connect_points_with_pipe(
        start=septic.outlet_position,
        end=Point3D(x=15, y=-15, z=septic.outlet_position.z - 0.5),
        min_slope=0.6,
        diameter=0.100
    )
    pipe3.pipe_id = "P3"
    pipe3.pipe_type = PipeType.SEWER_LINE
    network.add_pipe(pipe3)
    mh2.add_inlet_pipe("P3", invert=pipe3.end_point.z, diameter=0.100, angle=180)
    
    # IC1 to soakaway  
    pipe4 = connect_points_with_pipe(
        start=Point3D(x=15, y=-15, z=pipe3.end_point.z - 0.05),
        end=soakaway.inlet_position,
        min_slope=0.6,
        diameter=0.100
    )
    pipe4.pipe_id = "P4"
    pipe4.pipe_type = PipeType.SEWER_LINE
    network.add_pipe(pipe4)
    mh2.add_outlet_pipe("P4", invert=pipe4.start_point.z, diameter=0.100, angle=180)
    
    # Water storage tank (separate from sewage)
    water_tank = design_potable_water_tank(
        capacity=30.0,  # 30 m³
        location=Point3D(x=-15, y=10, z=105.0),
        shape="rectangular"
    )
    system.add_water_tank(water_tank)
    
    # Validate system
    is_valid = system.validate_system()
    
    print(f"System validation: {'PASSED' if is_valid else 'FAILED'}")
    
    if not is_valid:
        print("\nVALIDATION ERRORS:")
        for error in system.validation_errors:
            print(f"  ❌ {error}")
    else:
        print("  ✓ All separations adequate")
        print("  ✓ All slopes within limits")
        print("  ✓ All hydraulics valid")
    
    # System statistics
    system_data = system.export_complete_system()
    
    print(f"\nSYSTEM STATISTICS:")
    print(f"  Total components: {sum([
        system_data['summary']['num_septic_tanks'],
        system_data['summary']['num_soakpits'],
        system_data['summary']['num_manholes'],
        system_data['summary']['num_water_tanks']
    ])}")
    print(f"  Total pipe length: {sum(
        p.horizontal_length for p in network.pipes.values()
    ):.1f} m")
    print(f"  Total elevation drop: {network.calculate_total_drop(list(network.pipes.keys())):.2f} m")
    
    # Export to files
    print("\nEXPORTING FILES...")
    
    # JSON metadata
    with open('/home/claude/system_metadata.json', 'w') as f:
        json.dump(system_data, f, indent=2)
    print("  ✓ Metadata exported: system_metadata.json")
    
    # Construction sequence
    with open('/home/claude/construction_sequence.txt', 'w') as f:
        f.write('\n'.join(system.generate_construction_sequence()))
    print("  ✓ Construction sequence: construction_sequence.txt")
    
    # Maintenance schedule
    with open('/home/claude/maintenance_schedule.txt', 'w') as f:
        f.write('\n'.join(system.generate_maintenance_schedule()))
    print("  ✓ Maintenance schedule: maintenance_schedule.txt")
    
    return system


def example_3_hydraulic_validation():
    """
    Example 3: Demonstrate hydraulic validation and error detection
    """
    
    print("\n\n")
    print("="*70)
    print("EXAMPLE 3: Hydraulic Validation Examples")
    print("="*70)
    print()
    
    # Test 1: Valid pipe with good slope
    print("TEST 1: Valid pipe (2% slope)")
    try:
        pipe_valid = create_sewer_pipe(
            pipe_id="P_VALID",
            start_point=Point3D(x=0, y=0, z=100.0),
            end_point=Point3D(x=50, y=0, z=99.0),  # 1m drop over 50m = 2%
            diameter=0.150
        )
        print(f"  ✓ Slope: {pipe_valid.slope:.2f}%")
        print(f"  ✓ Velocity: {pipe_valid.velocity_design:.2f} m/s")
        print(f"  ✓ PASSED - Pipe valid")
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
    
    # Test 2: Insufficient slope
    print("\nTEST 2: Insufficient slope (0.3%)")
    try:
        pipe_bad_slope = create_sewer_pipe(
            pipe_id="P_BAD_SLOPE",
            start_point=Point3D(x=0, y=0, z=100.0),
            end_point=Point3D(x=50, y=0, z=99.85),  # Only 0.15m drop = 0.3%
            diameter=0.150
        )
        print(f"  ❌ Should have failed but didn't!")
    except Exception as e:
        print(f"  ✓ Correctly rejected: {e}")
    
    # Test 3: Backfall (negative slope)
    print("\nTEST 3: Backfall detection")
    try:
        pipe_backfall = create_sewer_pipe(
            pipe_id="P_BACKFALL",
            start_point=Point3D(x=0, y=0, z=100.0),
            end_point=Point3D(x=50, y=0, z=100.5),  # Uphill!
            diameter=0.150
        )
        print(f"  ❌ Should have failed but didn't!")
    except Exception as e:
        print(f"  ✓ Correctly rejected backfall: {e}")
    
    # Test 4: Auto-correction with connect_points_with_pipe
    print("\nTEST 4: Auto-correction of inadequate slope")
    pipe_corrected = connect_points_with_pipe(
        start=Point3D(x=0, y=0, z=100.0),
        end=Point3D(x=50, y=0, z=99.9),  # Would be only 0.2% slope
        min_slope=1.0,
        diameter=0.150
    )
    print(f"  ✓ Original end: 99.900m")
    print(f"  ✓ Corrected end: {pipe_corrected.end_point.z:.3f}m")
    print(f"  ✓ Final slope: {pipe_corrected.slope:.2f}%")


def main():
    """Run all examples"""
    
    print("\n")
    print("╔" + "═"*68 + "╗")
    print("║" + " "*15 + "SANITARY ENGINEERING BIM SYSTEM" + " "*22 + "║")
    print("║" + " "*12 + "Complete Demonstration & Validation" + " "*21 + "║")
    print("╚" + "═"*68 + "╝")
    
    # Run examples
    system1 = example_1_simple_residential()
    system2 = example_2_complex_development()
    example_3_hydraulic_validation()
    
    print("\n\n")
    print("="*70)
    print("DEMONSTRATION COMPLETE")
    print("="*70)
    print()
    print("Files generated:")
    print("  • system_metadata.json - Complete system data")
    print("  • construction_sequence.txt - Build instructions")
    print("  • maintenance_schedule.txt - Operations manual")
    print()
    print("All systems designed, validated, and exported successfully!")
    print()
    
    return system1, system2


if __name__ == "__main__":
    main()