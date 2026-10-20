"""
Comprehensive Test Suite for the Modular Engineering Detailing System.
Runs all validation cases from files (2), files (4), files (5), and files (6),
verifies rule constraints, positive/negative cases, and validates DXF output integrity.
"""

import os
import sys
import math
import unittest
import ezdxf

from engineering_system.core.model import Member, MemberType, Rebar, BarGroup, LayerType
from engineering_system.core.rules import RuleEngine, FactType, ConstraintViolation, ConstraintWarning
from engineering_system.core.relationships import MemberConnectivity
from engineering_system.core.reinforcement import (
    BS8666Catalogue,
    TableB1,
    Table612,
    TABLE_6_12_ANCHORAGE_LAP,
    BarAreaCalculator,
    AnchorageCalculator,
    LapCalculator,
    CoverCalculator,
    is_wide_beam_corbel_triggered,
    ms2_u_bar_area,
    ms2_top_bar_extension,
    ms2_u_bar_top_extension,
    ms2_u_bar_bottom_leg,
    ms4_cantilever_geometry,
    lookup_mw1_wall_defaults,
    get_trimmer_bar_diameter,
    table_anchorage_length,
    table_lap_length,
    band_required,
    stair_a_dimension,
)
from engineering_system.drawing.annotations import BarNotationParser
from engineering_system.members.slab import (
    SlabParams,
    SlabEngineeringModel,
    SlabDrawingRenderer,
    MS2ModelGenerator,
    MS3ModelGenerator,
    MS4ModelGenerator,
)
from engineering_system.members.beam import BeamParams, BeamEngineeringModel, BeamDrawingRenderer
from engineering_system.members.column import ColumnParams, ColumnEngineeringModel, ColumnDrawingRenderer
from engineering_system.details.beam_column_intersection import BeamColumnIntersectionParams, BeamColumnIntersectionGenerator
from engineering_system.details.corbel import CorbelGeometry, CorbelDetailGenerator
from engineering_system.details.half_joint import HalfJointGeometry, HalfJointDetailGenerator
from engineering_system.details.nib import NibGeometry, NibDetailGenerator
from engineering_system.members.wall import WallParams, WallEngineeringModel, WallDrawingRenderer
from engineering_system.members.foundation import PadFootingParams, PadFootingEngineeringModel, PadFootingDrawingRenderer
from engineering_system.members.stair import StairParams, StairEngineeringModel, StairDrawingRenderer
from engineering_system.generate import generate_all


class TestReinforcementAppendixB(unittest.TestCase):
    """Validation cases from files (4)/11_validation_cases.json."""

    def test_table_b1_16mm(self):
        tb1 = TableB1.lookup(16)
        self.assertEqual(tb1["r"], 32.0)
        self.assertEqual(tb1["M"], 64.0)
        self.assertEqual(tb1["P"], 130.0)

    def test_shape_11_length(self):
        # A=800, B=300, d=16 -> length = A + B - 0.5r - d = 800 + 300 - 16 - 16 = 1068 mm
        l = BS8666Catalogue.compute_length("11", 16, {"A": 800, "B": 300})
        self.assertAlmostEqual(l, 1068.0, places=1)

    def test_l_bar_anchorage_length(self):
        # 16mm bar, mandrel=4d (64mm): L_eff = (pi/4 * 32) + 130 = 25.13 + 130 = 155.1 or formula
        anch_L = AnchorageCalculator.l_bar_effective_anchorage(16, mandrel_dia=64.0)
        # pi/4 * 32 + 130 = 8*pi + 130 ~ 155.1 mm (or Table lookup formula)
        self.assertTrue(anch_L > 0)

    def test_u_bar_anchorage_length(self):
        anch_U = AnchorageCalculator.u_bar_effective_anchorage(16, mandrel_dia=64.0)
        self.assertTrue(anch_U > 0)

    def test_bar_areas(self):
        self.assertAlmostEqual(BarAreaCalculator.single_bar_area(16), 201.1, delta=0.5)
        self.assertAlmostEqual(BarAreaCalculator.group_area(25, 4), 1963.5, delta=1.0)
        self.assertAlmostEqual(BarAreaCalculator.area_per_metre(16, 200), 1005.3, delta=1.0)


class TestGeneralDetailingNotation(unittest.TestCase):
    """Validation cases from files (2)/11_validation_cases.json."""

    def test_parse_bar_notation_standard(self):
        parsed = BarNotationParser.parse("20H16-63-150B1")
        self.assertEqual(parsed["count"], 20)
        self.assertEqual(parsed["grade"], "H")
        self.assertEqual(parsed["size"], 16)
        self.assertEqual(parsed["mark"], "63")
        self.assertEqual(parsed["pitch"], 150)
        self.assertEqual(parsed["layer"], "B1")

    def test_parse_bar_notation_without_pitch(self):
        parsed = BarNotationParser.parse("4H25-01-T1")
        self.assertEqual(parsed["count"], 4)
        self.assertEqual(parsed["grade"], "H")
        self.assertEqual(parsed["size"], 25)
        self.assertEqual(parsed["mark"], "01")
        self.assertEqual(parsed["layer"], "T1")

    def test_format_callout(self):
        s = BarNotationParser.format_callout(20, "H", 16, "63", pitch=150, layer="B1")
        self.assertEqual(s, "20H16-63-150 B1")


class TestSpecialStructuresConstraints(unittest.TestCase):
    """Validation cases from files (5)/11_validation_cases.json."""

    def test_corbel_positive_case(self):
        geom = CorbelGeometry(
            b_c_mm=400.0,
            h_c_mm=600.0,
            h_tip_mm=300.0,
            a_c_mm=250.0,
            l_corbel_mm=400.0,
            F_Ed_kN=400.0,
            H_Ed_kN=80.0,
            bar_dia_main_mm=16,
            n_main_bars=4,
            stirrup_dia_mm=10,
            n_stirrup_layers=4,
        )
        gen = CorbelDetailGenerator(geom)
        self.assertIsNotNone(gen)

    def test_corbel_negative_ratio(self):
        # a_c > h_c should raise ConstraintViolation
        geom = CorbelGeometry(a_c_mm=650.0, h_c_mm=500.0)
        with self.assertRaises(ConstraintViolation):
            CorbelDetailGenerator(geom)

    def test_corbel_negative_horizontal_force(self):
        # H_Ed < 0.2 * F_Ed should raise ConstraintViolation
        geom = CorbelGeometry(F_Ed_kN=400.0, H_Ed_kN=40.0)  # 40 < 80
        with self.assertRaises(ConstraintViolation):
            CorbelDetailGenerator(geom)

    def test_corbel_negative_tip_depth(self):
        # h_tip < 0.5 * h_c should raise ConstraintViolation
        geom = CorbelGeometry(h_c_mm=600.0, h_tip_mm=200.0)
        with self.assertRaises(ConstraintViolation):
            CorbelDetailGenerator(geom)

    def test_half_joint_depth(self):
        # h_nib < 0.5 * h_beam should raise ConstraintViolation
        geom = HalfJointGeometry(h_beam_mm=800.0, h_nib_mm=300.0)
        with self.assertRaises(ConstraintViolation):
            HalfJointDetailGenerator(geom)


class TestSlabBeamColumnEngineering(unittest.TestCase):
    """Validation cases from files (6)/ch6_11_validation_cases.json."""

    def test_slab_model_creation(self):
        p = SlabParams(span_clear_mm=4000.0, thickness_mm=200.0)
        m = SlabEngineeringModel.create_model(p)
        self.assertEqual(m.member_type, MemberType.SLAB)
        self.assertTrue(len(m.bar_groups) >= 2)
        self.assertTrue(m.total_steel_weight() > 0)

    def test_beam_model_creation(self):
        p = BeamParams(span_clear_mm=6000.0, width_mm=300.0, depth_mm=600.0)
        m = BeamEngineeringModel.create_model(p)
        self.assertEqual(m.member_type, MemberType.BEAM)
        self.assertTrue(m.metadata["As_provided_mm2"] >= m.metadata["As_min_mm2"])

    def test_column_model_creation(self):
        p = ColumnParams(width_mm=400.0, depth_mm=400.0, height_mm=3500.0)
        m = ColumnEngineeringModel.create_model(p)
        self.assertEqual(m.member_type, MemberType.COLUMN)
        self.assertTrue(m.metadata["As_provided_mm2"] >= m.metadata["As_min_mm2"])

    def test_alpha6_lap_multiplier(self):
        self.assertEqual(LapCalculator.alpha6(25.0), 1.0)
        self.assertEqual(LapCalculator.alpha6(50.0), math.sqrt(2.0))
        self.assertEqual(LapCalculator.alpha6(100.0), 1.5)  # capped at 1.5


class TestRecoveredGapRules(unittest.TestCase):
    """
    Validation cases from RECOVERY_gap_fill (1).json SECTION_K (VC-R01 to VC-R09)
    and newly recovered rules from 13_audit_recovered_information (1).md.
    """

    def test_vc_r01_cover_chain(self):
        # inputs: cover_to_link=35, link_dia=10, main_bar=25, delta_cdev=5
        # 35 < 10 + 25 + 5 = 40 -> FAIL
        valid, actual, req = CoverCalculator.check_main_bar_cover_via_link(35.0, 10.0, 25.0, 5.0)
        self.assertFalse(valid)
        min_link_cover = CoverCalculator.min_cover_to_link(25.0, 10.0, delta_c_dev_mm=5.0)
        self.assertGreaterEqual(min_link_cover, 40.0)
        valid_corrected, _, _ = CoverCalculator.check_main_bar_cover_via_link(min_link_cover, 10.0, 25.0, 5.0)
        self.assertTrue(valid_corrected)

    def test_vc_r02_ms2_u_bar_area(self):
        # MS2 Detail A: U-bar area = 0.5 * bottom steel at midspan
        self.assertEqual(ms2_u_bar_area(600.0), 300.0)

    def test_vc_r03_ms2_top_bar_extension(self):
        # MS2 Detail A: top bar extension from support = 0.3 * span
        self.assertEqual(ms2_top_bar_extension(6000.0), 1800.0)

    def test_vc_r04_ms2_u_bar_top_extension(self):
        # MS2 Detail A: U-bar top extension = min(0.1 * span, 600)
        self.assertEqual(ms2_u_bar_top_extension(6000.0), 600.0)
        self.assertEqual(ms2_u_bar_top_extension(4000.0), 400.0)

    def test_vc_r05_wide_beam_corbel_check_negative(self):
        # beam=800, column=300, d=500: 800 > 300 + 2*500 = 1300? No
        self.assertFalse(is_wide_beam_corbel_triggered(800.0, 300.0, 500.0))

    def test_vc_r06_wide_beam_corbel_check_positive(self):
        # beam=1500, column=300, d=500: 1500 > 1300? Yes
        self.assertTrue(is_wide_beam_corbel_triggered(1500.0, 300.0, 500.0))

    def test_vc_r07_column_fire_spalling(self):
        # nominal cover=45, link=10, main=32 -> axis distance = 45+10+16 = 71 > 70 -> mesh required
        axis_d = CoverCalculator.axis_distance(45.0, 10.0, 32.0)
        self.assertEqual(axis_d, 71.0)
        req, msg = CoverCalculator.fire_spalling_check(nominal_cover_outer=45.0, link_dia=10.0, main_bar_dia=32.0)
        self.assertTrue(req)
        self.assertIn("surface reinforcement mesh", msg)

    def test_vc_r08_nominal_lap_10mm(self):
        # max(15 * 10, 200) = 200mm
        self.assertEqual(LapCalculator.nominal_bar_min_lap(10), 200.0)

    def test_vc_r09_nominal_lap_16mm(self):
        # max(15 * 16, 200) = 240mm
        self.assertEqual(LapCalculator.nominal_bar_min_lap(16), 240.0)

    def test_table_6_12_anchorage_and_lap_lengths(self):
        # Table 6.12 full numerical values
        self.assertEqual(Table612.anchorage_length(16, "25/30", good_bond=True), 36 * 16)
        self.assertEqual(Table612.anchorage_length(16, "25/30", good_bond=False), 48 * 16)
        self.assertEqual(Table612.lap_length(16, "25/30", good_bond=True), 55 * 16)
        self.assertEqual(Table612.lap_length(16, "30/37", good_bond=True), 37 * 16)  # OCR 37 preserved
        self.assertEqual(Table612.anchorage_length(20, "32/40", good_bond=True), 31 * 20)

    def test_recovered_drawing_notations(self):
        # Zone bracket notation: 20H10-63-150T1 (12) (8)
        p = BarNotationParser.parse("20H10-63-150T1 (12) (8)")
        self.assertEqual(p["count"], 20)
        self.assertEqual(p["subcounts"], [12, 8])

        # U-bar notation
        p_ub = BarNotationParser.parse("2 H20 02 UB")
        self.assertIn("UB", p_ub["tags"])

        # Top each face notation
        p_tef = BarNotationParser.parse("2 H12 09 TEF")
        self.assertIn("TEF", p_tef["tags"])

        # Link elevation multi-zone format
        zones = BarNotationParser.parse_link_zones("19/300   5/200   13/150")
        self.assertEqual(len(zones), 3)
        self.assertEqual(zones[0], {"count": 19, "pitch": 300})
        self.assertEqual(zones[1], {"count": 5, "pitch": 200})
        self.assertEqual(zones[2], {"count": 13, "pitch": 150})

        # Spacer bar formatting
        sp = BarNotationParser.format_spacer_callout(4, 25, "10")
        self.assertEqual(sp, "4 H25 10 SPACERS")

    def test_recovered_column_rules(self):
        # Grade ratio check: 40 / 25 = 1.6 > 1.4 -> Fail grade cap
        p_col = ColumnParams(width_mm=400.0, depth_mm=400.0, fck_MPa=40.0, intersecting_beam_fck_MPa=25.0)
        m_col = ColumnEngineeringModel.create_model(p_col)
        self.assertFalse(m_col.metadata["grade_cap_compliant"])

        # Bundled bar equivalent diameter
        bn = CoverCalculator.equivalent_bundled_bar_dia(20, 3)
        self.assertAlmostEqual(bn, 20.0 * math.sqrt(3.0), places=1)
        bn_max = CoverCalculator.equivalent_bundled_bar_dia(40, 4)
        self.assertEqual(bn_max, 55.0)

    def test_recovered_beam_rules(self):
        p_beam = BeamParams(depth_mm=600.0, top_support_count=4, top_support_dia_mm=25, compression_steel_required_mm2=300.0)
        m_beam = BeamEngineeringModel.create_model(p_beam)
        # Hanger bar area >= max(0.20 * top_support, compression_steel)
        self.assertGreaterEqual(m_beam.metadata["hanger_area_provided_mm2"], m_beam.metadata["hanger_area_min_required_mm2"])
        # Curtailment al default = 1.25 * d_eff
        self.assertAlmostEqual(m_beam.metadata["curtailment_al_shift_mm"], 1.25 * m_beam.metadata["d_eff_mm"], places=1)

    def test_recovered_slab_models(self):
        # MS2
        ms2 = MS2ModelGenerator.create_model(span_mm=6000.0, bottom_As_midspan_mm2_per_m=600.0)
        self.assertEqual(ms2.metadata["u_bar_area_mm2_per_m"], 300.0)
        self.assertEqual(ms2.metadata["top_bar_extension_mm"], 1800.0)
        self.assertEqual(ms2.metadata["u_bar_top_extension_mm"], 600.0)

        # MS3
        ms3_a = MS3ModelGenerator.create_model(thickness_mm=160.0)
        self.assertEqual(ms3_a.metadata["detail_type"], "DETAIL_A")
        ms3_b = MS3ModelGenerator.create_model(thickness_mm=140.0, support_width_mm=180.0)
        self.assertEqual(ms3_b.metadata["detail_type"], "DETAIL_B")
        self.assertTrue(ms3_b.metadata["bobbed_bars_permitted"])

        # MS4
        ms4 = MS4ModelGenerator.create_model(cantilever_length_mm=1500.0, top_As_mm2=800.0)
        self.assertEqual(ms4.metadata["top_bar_min_length_mm"], 3000.0)
        self.assertEqual(ms4.metadata["support_extension_mm"], 300.0)
        self.assertEqual(ms4.metadata["bottom_bar_extension_mm"], 750.0)
        self.assertEqual(ms4.metadata["bottom_bar_min_area_mm2"], 400.0)

    def test_moment_connection_corner_bar(self):
        ok, msg = MemberConnectivity.check_moment_connection_corner_bar(25.0, 25.0)
        self.assertTrue(ok)
        fail, msg = MemberConnectivity.check_moment_connection_corner_bar(16.0, 25.0)
        self.assertFalse(fail)


class TestFiles10ValidationCases(unittest.TestCase):
    """
    Validation cases from files (10)/11_validation_cases.json:
    V1-V3: Walls (MW1)
    V4-V5: Pad Footings (MF1)
    V6: Stair (MST1)
    V7-V8: Anchorages & Laps
    """

    def test_v1_wall_defaults(self):
        # V1: Wall t=220, grade 28/35, XC1
        vd, vp, hd, hp = lookup_mw1_wall_defaults(220)
        self.assertEqual(vd, 12)
        self.assertEqual(vp, 200)
        self.assertEqual(hd, 10)
        self.assertEqual(hp, 200)

        p = WallParams(thickness_mm=220.0, concrete_grade="28/35", exposure="internal")
        m = WallEngineeringModel.create_model(p)
        self.assertEqual(m.vdia, 12)
        self.assertEqual(m.vpitch, 200)
        self.assertEqual(m.hdia, 10)
        self.assertEqual(m.hpitch, 200)
        self.assertGreaterEqual(m.As_v_mm2_per_m, 400.0)
        self.assertAlmostEqual(m.compression_lap_mm, 56.0 * 12.0)

    def test_v2_wall_thick(self):
        # V2: Wall t=350 -> vertical 16@250, horizontal 12@200
        vd, vp, hd, hp = lookup_mw1_wall_defaults(350)
        self.assertEqual(vd, 16)
        self.assertEqual(vp, 250)
        self.assertEqual(hd, 12)
        self.assertEqual(hp, 200)

    def test_v3_wall_thin_warning(self):
        # V3: Wall t=120 -> warning "thickness < 150 not recommended"
        p = WallParams(thickness_mm=120.0)
        m = WallEngineeringModel.create_model(p)
        self.assertTrue(any("thickness < 150 not recommended" in w for w in m.warnings))

    def test_v4_pad_footing_no_banding(self):
        # V4: lx=3000, ly=3000, cx=400, cy=400, d=600 -> 3000 <= 1.5*(400+3*600)=3300 -> no banding
        self.assertFalse(band_required(3000.0, 400.0, 600.0))
        band_w = 400.0 + 3.0 * 600.0
        self.assertEqual(band_w, 2200.0)

    def test_v5_pad_footing_banding(self):
        # V5: lx=4000, ly=4000, cx=400, cy=400, d=500 -> 4000 > 1.5*(400+3*500)=2850 -> banding required
        self.assertTrue(band_required(4000.0, 400.0, 500.0))
        band_w = 400.0 + 3.0 * 500.0
        self.assertEqual(band_w, 1900.0)

    def test_v6_stair_a_dimension(self):
        # V6: Stair span=3600, lbd_dia=37, dia=12 -> A=max(360, 444, 500) = 500
        lbd = 37.0 * 12.0
        a = stair_a_dimension(3600.0, lbd)
        self.assertEqual(a, 500.0)

    def test_v7_anchorage_stairs(self):
        # V7: grade 30/37, poor bond, dia 20, stairs -> 51 * 20 = 1020
        lbd = table_anchorage_length(20, grade="30/37", member_topic="stairs", bond="poor")
        self.assertEqual(lbd, 1020.0)

    def test_v8_lap_walls(self):
        # V8: dia 8, grade 28/35, walls -> max(56 * 8, 15 * 8, 200) = 448
        l0 = table_lap_length(8, grade="28/35", member_topic="walls")
        self.assertEqual(l0, 448.0)


class TestDXFIntegrity(unittest.TestCase):
    """Verifies that all representative generated DXF files open without errors."""

    def test_generated_dxfs_open(self):
        test_out = "outputs_test"
        res = generate_all(test_out)
        self.assertEqual(len(res), 13)

        for name, path in res.items():
            self.assertTrue(os.path.exists(path), f"File {path} does not exist!")
            # Open with ezdxf to verify CAD validity
            doc = ezdxf.readfile(path)
            self.assertIsNotNone(doc.modelspace())
            self.assertTrue(len(doc.modelspace()) > 0, f"Modelspace in {path} is empty!")


if __name__ == "__main__":
    unittest.main()

