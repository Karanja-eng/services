"""
Comprehensive Example: Complete Site External Works Generation
Demonstrates all subsystems working together
"""

import numpy as np
from geometry_utils import Vector3
from external_works_bim import ExternalWorksBIM
from drainage_system import OpenChannel, CatchPit, InspectionChamber, StormwaterPipe, InvertLevel, HydraulicProperties
from road_system import Road, Driveway, VehicleTurningCircle, SurfaceType
from parking_system import ParkingArea, ParkingLayout
from pavement_system import Pavement, AccessibleRamp, PavementSurface, PedestrianCrossing
from landscape_system import Tree, GrassArea, PlantBed, TreeSpecies, PlantType
from site_grading import SpotLevel


def create_complete_site_example():
    """
    Create a complete site with:
    - Building with apron
    - Access road with drainage
    - Parking area
    - Pedestrian walkways
    - Landscaping
    - Proper grading
    """
    
    # Site dimensions: 60m x 80m
    site_bounds_min = Vector3(-30, 0, -40)
    site_bounds_max = Vector3(30, 0, 40)
    
    # Initialize BIM system
    bim = ExternalWorksBIM("Commercial Building Site", site_bounds_min, site_bounds_max)
    
    print("=" * 80)
    print("GENERATING COMPLETE EXTERNAL WORKS")
    print("=" * 80)
    print()
    
    # ========================================================================
    # 1. DEFINE BUILDING
    # ========================================================================
    print("1. Setting building parameters...")
    
    building_footprint = [
        Vector3(-10, 0, -8),
        Vector3(10, 0, -8),
        Vector3(10, 0, 8),
        Vector3(-10, 0, 8)
    ]
    building_plinth_level = 100.50  # 50cm above reference (100.00)
    
    bim.set_building(building_footprint, building_plinth_level)
    
    # ========================================================================
    # 2. SITE GRADING
    # ========================================================================
    print("2. Creating site grading with positive drainage...")
    
    # Set existing ground (slightly sloped)
    for i in range(bim.grading.existing_ground.grid_depth):
        for j in range(bim.grading.existing_ground.grid_width):
            # Gentle slope from NW to SE
            x = bim.grading.existing_ground.bounds_min.x + j * bim.grading.existing_ground.resolution
            z = bim.grading.existing_ground.bounds_min.z + i * bim.grading.existing_ground.resolution
            elevation = 100.0 - (x + z) * 0.005
            bim.grading.existing_ground.elevations[i, j] = elevation
    
    # Create positive drainage away from building
    building_center = Vector3(0, building_plinth_level, 0)
    building_radius = 15.0
    bim.grading.create_positive_drainage(building_center, building_radius, min_fall=0.015)
    
    # Add spot levels
    bim.grading.add_spot_level(SpotLevel(-25, -30, 99.50, "NW Corner"))
    bim.grading.add_spot_level(SpotLevel(25, 30, 98.00, "SE Corner (Outfall)"))
    
    # ========================================================================
    # 3. DRAINAGE SYSTEM
    # ========================================================================
    print("3. Creating drainage network...")
    
    # Side drain along building apron (north side)
    north_drain = OpenChannel(
        "DRAIN_NORTH",
        start=Vector3(-10, 100.30, -10),
        end=Vector3(10, 100.25, -10),
        width=0.3,
        depth=0.3,
        start_invert=100.20,
        end_invert=100.05  # 0.75% slope (15cm drop over 20m)
    )
    bim.drainage.add_element(north_drain)
    
    # Catch pit at low point
    catch_pit_1 = CatchPit(
        "CP_01",
        position=Vector3(10, 100.25, -10),
        invert_level=99.80,
        size=0.6,
        depth=0.9,
        has_grating=True
    )
    bim.drainage.add_element(catch_pit_1)
    
    # Underground stormwater pipe to outfall
    storm_pipe = StormwaterPipe(
        "PIPE_01",
        start=Vector3(10, 100.25, -10),
        end=Vector3(25, 98.00, 30),
        diameter=0.3,
        start_invert=99.70,
        end_invert=97.50
    )
    bim.drainage.add_element(storm_pipe)
    
    # Inspection chamber at outfall
    manhole = InspectionChamber(
        "MH_01",
        position=Vector3(25, 98.00, 30),
        invert_level=97.40,
        diameter=1.2,
        depth=2.0
    )
    bim.drainage.add_element(manhole)
    
    # Register drainage positions for landscape clearance
    bim.landscape.register_drainage(Vector3(10, 100.25, -10))
    bim.landscape.register_drainage(Vector3(25, 98.00, 30))
    
    # ========================================================================
    # 4. ACCESS ROAD
    # ========================================================================
    print("4. Creating access road with camber...")
    
    # Main access road (asphalt)
    road_centerline = [
        Vector3(-30, 99.50, 0),
        Vector3(-20, 99.60, 0),
        Vector3(-10, 99.70, 0),
        Vector3(0, 99.75, 0),
        Vector3(10, 99.70, 0),
        Vector3(20, 99.60, 0),
        Vector3(30, 99.50, 0)
    ]
    
    main_road = Road(
        "ROAD_MAIN",
        centerline=road_centerline,
        width=7.0,
        surface_type=SurfaceType.ASPHALT,
        camber=2.5,
        traffic_load="light"
    )
    bim.roads.add_road(main_road)
    
    # Driveway to building entrance
    driveway_centerline = [
        Vector3(0, 99.75, 0),
        Vector3(0, 100.00, -5),
        Vector3(0, 100.30, -8)
    ]
    
    driveway = Driveway(
        "DRIVEWAY_01",
        centerline=driveway_centerline,
        width=4.0,
        surface_type=SurfaceType.CONCRETE
    )
    bim.roads.add_driveway(driveway)
    
    # Turning circle
    turning_circle = VehicleTurningCircle(
        "TURN_01",
        center=Vector3(-20, 99.60, 15),
        radius=8.0,
        surface_type=SurfaceType.ASPHALT
    )
    bim.roads.add_turning_circle(turning_circle)
    
    # ========================================================================
    # 5. PARKING AREA
    # ========================================================================
    print("5. Creating parking area with drainage...")
    
    parking = ParkingArea(
        "PARKING_MAIN",
        origin=Vector3(5, 99.50, 5),
        rows=2,
        bays_per_row=8,
        layout=ParkingLayout.PERPENDICULAR,
        surface_type=SurfaceType.CABROS,
        two_way_aisle=False
    )
    bim.parking.add_parking_area(parking)
    
    # ========================================================================
    # 6. PEDESTRIAN INFRASTRUCTURE
    # ========================================================================
    print("6. Creating pedestrian walkways and ramps...")
    
    # Walkway along building (south side)
    walkway_centerline = [
        Vector3(-10, 100.30, 10),
        Vector3(10, 100.30, 10)
    ]
    
    walkway = Pavement(
        "WALK_SOUTH",
        centerline=walkway_centerline,
        width=1.8,
        surface_type=PavementSurface.CONCRETE,
        slope_percent=1.0
    )
    bim.pavements.add_pavement(walkway)
    
    # Accessible ramp from parking to building entrance (longer run for gentler slope)
    ramp = AccessibleRamp(
        "RAMP_01",
        start=Vector3(4, 99.75, 2),
        end=Vector3(4, 100.30, -5),  # Longer horizontal distance for gentler slope
        width=1.5,
        surface_type=PavementSurface.CONCRETE
    )
    bim.pavements.add_ramp(ramp)
    
    # Pedestrian crossing at road
    crossing = PedestrianCrossing(
        "CROSS_01",
        position=Vector3(0, 99.75, 0),
        width=3.0,
        road_width=7.0,
        has_tactile=True
    )
    bim.pavements.add_crossing(crossing)
    
    # ========================================================================
    # 7. LANDSCAPING
    # ========================================================================
    print("7. Adding landscape elements...")
    
    # Trees along road (with proper clearances)
    tree_positions = [
        Vector3(-25, 99.50, -8),
        Vector3(-15, 99.65, -8),
        Vector3(15, 99.65, -8),
        Vector3(25, 99.50, -8)
    ]
    
    for i, pos in enumerate(tree_positions):
        tree = Tree(
            f"TREE_{i+1:02d}",
            position=pos,
            species=TreeSpecies.GENERIC_MEDIUM
        )
        try:
            bim.landscape.add_tree(tree)
        except ValueError as e:
            print(f"   Warning: Could not place tree {i+1}: {e}")
    
    # Grass areas
    grass_north = GrassArea(
        "GRASS_NORTH",
        boundary=[
            Vector3(-28, 99.45, -15),
            Vector3(-12, 99.65, -15),
            Vector3(-12, 99.70, -12),
            Vector3(-28, 99.50, -12)
        ],
        elevation=99.50
    )
    bim.landscape.add_grass_area(grass_north)
    
    grass_south = GrassArea(
        "GRASS_SOUTH",
        boundary=[
            Vector3(-28, 99.45, 12),
            Vector3(-28, 99.50, 15),
            Vector3(-12, 99.70, 15),
            Vector3(-12, 99.65, 12)
        ],
        elevation=99.50
    )
    bim.landscape.add_grass_area(grass_south)
    
    # Flower beds at entrance
    planter_1 = PlantBed(
        "PLANTER_01",
        position=Vector3(-3, 100.30, -8),
        width=2.0,
        length=1.5,
        plant_type=PlantType.FLOWER_BED
    )
    bim.landscape.add_plant_bed(planter_1)
    
    planter_2 = PlantBed(
        "PLANTER_02",
        position=Vector3(3, 100.30, -8),
        width=2.0,
        length=1.5,
        plant_type=PlantType.FLOWER_BED
    )
    bim.landscape.add_plant_bed(planter_2)
    
    # ========================================================================
    # 8. VALIDATION
    # ========================================================================
    print()
    print("=" * 80)
    print("VALIDATION")
    print("=" * 80)
    
    valid, errors = bim.validate_complete_system()
    
    if valid:
        print("✓ ALL SYSTEMS VALID")
    else:
        print("✗ VALIDATION ERRORS DETECTED:")
        for error in errors:
            print(f"  - {error}")
    
    # Check for flat surfaces
    print()
    print("Checking for flat surfaces...")
    flat_violations = bim.detect_flat_surfaces()
    if flat_violations:
        print("✗ FLAT SURFACE VIOLATIONS:")
        for violation in flat_violations:
            print(f"  - {violation}")
    else:
        print("✓ No flat surfaces detected")
    
    # Check for water traps
    print()
    print("Checking for water traps...")
    water_traps = bim.check_water_traps()
    if water_traps:
        print(f"⚠ {len(water_traps)} potential water traps detected")
    else:
        print("✓ No water traps detected")
    
    # ========================================================================
    # 9. EXPORT
    # ========================================================================
    print()
    print("=" * 80)
    print("EXPORT")
    print("=" * 80)
    
    # Export to GLTF
    print("Exporting to GLTF...")
    gltf_file = bim.export_to_gltf("/mnt/user-data/outputs/complete_site.gltf")
    print(f"✓ GLTF exported: {gltf_file}")
    
    # Export metadata
    print()
    print("Exporting metadata...")
    metadata_files = bim.export_complete_metadata("/mnt/user-data/outputs/site")
    print("✓ Metadata files created:")
    for key, filepath in metadata_files.items():
        print(f"  - {key}: {filepath}")
    
    # Generate engineering report
    print()
    print("Generating engineering report...")
    report = bim.generate_engineering_report()
    
    report_file = "/mnt/user-data/outputs/engineering_report.txt"
    with open(report_file, 'w') as f:
        f.write(report)
    print(f"✓ Engineering report: {report_file}")
    
    # Print report to console
    print()
    print(report)
    
    # ========================================================================
    # 10. SUMMARY
    # ========================================================================
    print()
    print("=" * 80)
    print("GENERATION COMPLETE")
    print("=" * 80)
    print()
    print("Generated infrastructure:")
    print(f"  - Drainage elements: {len(bim.drainage.elements)}")
    print(f"  - Roads: {len(bim.roads.roads)}")
    print(f"  - Driveways: {len(bim.roads.driveways)}")
    print(f"  - Parking capacity: {bim.parking.total_capacity()} bays")
    print(f"  - Disabled bays: {bim.parking.total_disabled_capacity()}")
    print(f"  - Pavements: {len(bim.pavements.pavements)}")
    print(f"  - Ramps: {len(bim.pavements.ramps)}")
    print(f"  - Trees: {len(bim.landscape.trees)}")
    print(f"  - Grass areas: {len(bim.landscape.grass_areas)}")
    print(f"  - Planter beds: {len(bim.landscape.plant_beds)}")
    print()
    print(f"Total meshes generated: {len(bim.generate_complete_site())}")
    print()
    
    # Cut-fill analysis
    cut_fill = bim.grading.calculate_cut_fill()
    print("Earthworks:")
    print(f"  - Cut: {cut_fill['cut_volume_m3']:.2f} m³")
    print(f"  - Fill: {cut_fill['fill_volume_m3']:.2f} m³")
    print(f"  - Net: {cut_fill['net_volume_m3']:.2f} m³")
    print(f"  - Status: {cut_fill['balance']}")
    print()
    
    return bim


if __name__ == "__main__":
    # Run the complete example
    site = create_complete_site_example()
    
    print("✓ External works generation complete!")
    print()
    print("Output files are in /mnt/user-data/outputs/")
    print("  - complete_site.gltf (3D geometry)")
    print("  - site_*.json (metadata for each subsystem)")
    print("  - engineering_report.txt (validation and compliance)")