from src.Backend.calculations.Beams.rc_beam_design import BS8110Designer, BeamDesignRequest, BeamType, SupportCondition, MaterialProperties, RectangularBeamGeometry, ExposureCondition, FireResistancePeriod

def test_bs8110_design():
    print("Testing BS 8110 Design Logic...")
    
    # Create a typical design request
    req = BeamDesignRequest(
        beam_type=BeamType.RECTANGULAR,
        support_condition=SupportCondition.CONTINUOUS,
        span_length=6.0,
        design_moments=[150.0, -120.0, 50.0, -80.0], # Mixed sagging/hogging
        design_shears=[100.0, -100.0],
        moment_positions=[0, 1, 3, 6],
        shear_positions=[0, 6],
        materials=MaterialProperties(concrete_grade="C30", steel_grade="Grade 460"),
        rectangular_geometry=RectangularBeamGeometry(width=300, depth=500, cover=30),
        imposed_load=10.0,
        permanent_load=15.0,
        exposure_condition=ExposureCondition.SEVERE,
        fire_resistance_period=FireResistancePeriod.ONE_HOUR
    )
    
    designer = BS8110Designer()
    result = designer.design_beam(req)
    
    print("\nDesign Result Summary:")
    print(f"Status: {result.summary}")
    
    for span in result.span_designs:
        print(f"\nSpan {span.span_id} ({span.span_length}m):")
        print(f"Sagging Moment: {span.sagging_moment} kNm -> {span.sagging_bars_count}T{span.sagging_bars_diameter} (Prov: {span.sagging_As_provided:.0f})")
        print(f"Hogging Moment: {span.hogging_moment_left} kNm -> {span.hogging_bars_count}T{span.hogging_bars_diameter} (Prov: {span.hogging_As_provided:.0f})")
        print(f"Shear: {span.shear_max} kN -> Links T{span.shear_links_diameter}@{span.shear_links_spacing}")
        print(f"Checks: Moment={span.design_checks.moment_capacity_ok}, Shear={span.design_checks.shear_capacity_ok}, Deflection={span.design_checks.deflection_ok}, Cover={span.design_checks.cover_ok}")
        
        if span.design_checks.warnings:
            print("Warnings:", span.design_checks.warnings)

if __name__ == "__main__":
    try:
        test_bs8110_design()
        print("\nTest Completed Successfully.")
    except Exception as e:
        print(f"\nTest Failed: {e}")
        import traceback
        traceback.print_exc()
