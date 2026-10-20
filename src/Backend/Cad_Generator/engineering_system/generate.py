"""
Master Generator Entry Point and CLI for the Unified Engineering Detailing System.
Generates representative CAD drawings and models for:
- Slabs (MS1)
- Beams (MB1)
- Columns (EC2 Figs 6.24–6.27)
- Beam-Column Intersections (Fig 4.4)
- Corbels (MCB1)
- Half-Joints (MHJ)
- Nibs (MN1)
- BS 8666 Bar Shape Catalogue & Bending Schedules
- Walls (MW1) and Cantilever Retaining Walls (MRW1)  [files(10)]
- Pad Footings (MF1)                                  [files(10)]
- Stairs MST1 (end-supported) & MST2 (cantilever)    [files(10)]
"""

import os
import sys
import argparse
from typing import Optional, Dict

from .drawing.dxf import DXFDocument
from .drawing.standards import SHEET_DIMENSIONS_MM
from .drawing.annotations import AnnotationRenderer
from .drawing.schedules import BarSchedule, BarScheduleEntry
from .core.model import DrawingPanel, DrawingSheet
from .core.reinforcement import BS8666Catalogue, TableB1, BarAreaCalculator

from .members.slab import SlabParams, SlabEngineeringModel, SlabDrawingRenderer
from .members.beam import BeamParams, BeamEngineeringModel, BeamDrawingRenderer
from .members.column import ColumnParams, ColumnEngineeringModel, ColumnDrawingRenderer
from .details.beam_column_intersection import BeamColumnIntersectionParams, BeamColumnIntersectionGenerator
from .details.corbel import CorbelGeometry, CorbelDetailGenerator
from .details.half_joint import HalfJointGeometry, HalfJointDetailGenerator
from .details.nib import NibGeometry, NibDetailGenerator

# files(10): Walls, Foundations, Stairs
from .members.wall import WallParams, WallEngineeringModel, WallDrawingRenderer, CantileverRetainingWallParams, RetainingWallDrawingRenderer
from .members.foundation import PadFootingParams, PadFootingEngineeringModel, PadFootingDrawingRenderer
from .members.stair import StairParams, StairEngineeringModel, StairDrawingRenderer


def generate_slab_dxf(output_path: str = "outputs/slab_detail.dxf") -> str:
    """Generate representative DXF for solid slab (MS1)."""
    dxf = DXFDocument()
    params = SlabParams()
    model = SlabEngineeringModel.create_model(params)
    SlabDrawingRenderer.render_elevation(model, dxf, origin=(50.0, 100.0))

    # Add Title Panel
    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="SLAB-01",
        revision="A",
        drawing_title="Solid Slab Detailing (Model Detail MS1)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)

    dxf.save(output_path)
    return output_path


def generate_beam_dxf(output_path: str = "outputs/beam_detail.dxf") -> str:
    """Generate representative DXF for suspended beam (MB1)."""
    dxf = DXFDocument()
    params = BeamParams()
    model = BeamEngineeringModel.create_model(params)
    BeamDrawingRenderer.render_elevation(model, dxf, origin=(50.0, 250.0))
    BeamDrawingRenderer.render_section(model, dxf, origin=(1000.0, 250.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="BEAM-01",
        revision="A",
        drawing_title="Suspended Beam Elevation & Section (MB1)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)

    dxf.save(output_path)
    return output_path


def generate_column_dxf(output_path: str = "outputs/column_detail.dxf") -> str:
    """Generate representative DXF for in-situ column."""
    dxf = DXFDocument()
    params = ColumnParams()
    model = ColumnEngineeringModel.create_model(params)
    ColumnDrawingRenderer.render_elevation(model, dxf, origin=(150.0, 100.0))
    ColumnDrawingRenderer.render_section(model, dxf, origin=(700.0, 100.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="COL-01",
        revision="A",
        drawing_title="RC Column Detailing & Laps (EC2)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)

    dxf.save(output_path)
    return output_path


def generate_intersection_dxf(output_path: str = "outputs/beam_column_intersection.dxf") -> str:
    """Generate representative DXF for beam/column intersection."""
    dxf = DXFDocument()
    params = BeamColumnIntersectionParams()
    gen = BeamColumnIntersectionGenerator(params)
    gen.render_elevation(dxf, origin=(50.0, 350.0))
    gen.render_plan(dxf, origin=(50.0, 50.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="INT-01",
        revision="A",
        drawing_title="Internal Beam/Column Intersection (Fig 4.4)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)

    dxf.save(output_path)
    return output_path


def generate_corbel_dxf(output_path: str = "outputs/corbel_detail.dxf") -> str:
    """Generate representative DXF for RC corbel (MCB1)."""
    dxf = DXFDocument()
    geom = CorbelGeometry()
    gen = CorbelDetailGenerator(geom)
    gen.render_dxf(dxf, origin=(200.0, 150.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="CRB-01",
        revision="A",
        drawing_title="Reinforced Concrete Corbel (Model Detail MCB1)",
        scale="1:10"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)

    dxf.save(output_path)
    return output_path


def generate_bs8666_shapes_dxf(output_path: str = "outputs/bs8666_bar_shapes.dxf") -> str:
    """Generate representative DXF displaying BS 8666 bar shapes and a schedule table."""
    dxf = DXFDocument()

    # Draw Shape 00 (Straight bar)
    dxf.add_text("Shape 00 (Straight bar: L = A)", (50.0, 520.0), height=3.5, layer="ANNOTATIONS")
    dxf.add_line((50.0, 500.0), (250.0, 500.0), layer="REBAR_MAIN")
    dxf.add_text("A = 2000", (130.0, 505.0), height=2.5, layer="DIMENSIONS")

    # Draw Shape 11 (L-bar: 90 deg bend)
    dxf.add_text("Shape 11 (L-bar: L = A + B - 0.5r - d)", (50.0, 440.0), height=3.5, layer="ANNOTATIONS")
    dxf.add_polyline([(50.0, 370.0), (50.0, 410.0), (250.0, 410.0)], layer="REBAR_MAIN")
    dxf.add_text("B = 400", (25.0, 390.0), height=2.5, layer="DIMENSIONS")
    dxf.add_text("A = 2000", (130.0, 415.0), height=2.5, layer="DIMENSIONS")

    # Draw Shape 21 (U-bar)
    dxf.add_text("Shape 21 (U-bar: L = A + B + C - r - 2d)", (350.0, 520.0), height=3.5, layer="ANNOTATIONS")
    dxf.add_polyline([(350.0, 460.0), (350.0, 500.0), (550.0, 500.0), (550.0, 460.0)], layer="REBAR_MAIN")
    dxf.add_text("B = 400", (325.0, 480.0), height=2.5, layer="DIMENSIONS")
    dxf.add_text("A = 2000", (430.0, 505.0), height=2.5, layer="DIMENSIONS")
    dxf.add_text("C = 400", (555.0, 480.0), height=2.5, layer="DIMENSIONS")

    # Draw Shape 51 (Closed Link)
    dxf.add_text("Shape 51 (Closed Link: L = 2A + 2B + 1.25C - 2.5d)", (350.0, 440.0), height=3.5, layer="ANNOTATIONS")
    dxf.add_polyline([(350.0, 370.0), (350.0, 410.0), (500.0, 410.0), (500.0, 370.0), (350.0, 370.0)], layer="REBAR_LINKS")
    dxf.add_text("A = 400", (325.0, 390.0), height=2.5, layer="DIMENSIONS")
    dxf.add_text("B = 1500", (410.0, 415.0), height=2.5, layer="DIMENSIONS")

    # Add Bar Bending Schedule
    schedule = BarSchedule(schedule_ref="SCH-01", drawing_ref="BS8666-01")
    l_11 = BS8666Catalogue.compute_length("11", 16, {"A": 2000, "B": 400})
    l_21 = BS8666Catalogue.compute_length("21", 16, {"A": 2000, "B": 400, "C": 400})
    l_51 = BS8666Catalogue.compute_length("51", 10, {"A": 400, "B": 1500, "C": 100})

    schedule.add_entry(BarScheduleEntry(
        member="BEAM 1", bar_mark="01", type_size="H25", length_each_mm=6000,
        no_of_members=1, no_bars_in_each=4, shape_code="00", A_mm=6000
    ))
    schedule.add_entry(BarScheduleEntry(
        member="BEAM 1", bar_mark="02", type_size="H16", length_each_mm=l_11,
        no_of_members=1, no_bars_in_each=8, shape_code="11", A_mm=2000, B_mm=400
    ))
    schedule.add_entry(BarScheduleEntry(
        member="SLAB 1", bar_mark="03", type_size="H16", length_each_mm=l_21,
        no_of_members=1, no_bars_in_each=20, shape_code="21", A_mm=2000, B_mm=400, C_mm=400
    ))
    schedule.add_entry(BarScheduleEntry(
        member="BEAM 1", bar_mark="04", type_size="H10", length_each_mm=l_51,
        no_of_members=1, no_bars_in_each=30, shape_code="51", A_mm=400, B_mm=1500, C_mm=100
    ))

    schedule.render_table(dxf, top_left=(50.0, 320.0), row_height=7.0, text_height=2.2)

    # Title panel
    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="BS8666-01",
        revision="A",
        drawing_title="BS 8666 Bar Shapes & Schedule Example",
        scale="N.T.S."
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)

    dxf.save(output_path)
    return output_path


def generate_half_joint_dxf(output_path: str = "outputs/half_joint_detail.dxf") -> str:
    """Generate representative DXF for RC half-joint (MHJ)."""
    dxf = DXFDocument()
    geom = HalfJointGeometry()
    gen = HalfJointDetailGenerator(geom)
    gen.render_dxf(dxf, origin=(100.0, 300.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="MHJ-01",
        revision="A",
        drawing_title="Reinforced Concrete Half-Joint (Model Detail MHJ)",
        scale="1:10"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)

    dxf.save(output_path)
    return output_path


def generate_nib_dxf(output_path: str = "outputs/nib_detail.dxf") -> str:
    """Generate representative DXF for RC continuous nib (MN1)."""
    dxf = DXFDocument()
    geom = NibGeometry()
    gen = NibDetailGenerator(geom)
    gen.render_dxf(dxf, origin=(150.0, 200.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="MN-01",
        revision="A",
        drawing_title="Reinforced Concrete Nib (Model Detail MN1)",
        scale="1:10"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)

    dxf.save(output_path)
    return output_path


def generate_wall_dxf(output_path: str = "outputs/wall_detail.dxf") -> str:
    """Generate representative DXF for RC wall elevation + plan section (MW1/files(10))."""
    dxf = DXFDocument()
    params = WallParams(thickness_mm=250.0, length_mm=2400.0, height_mm=3000.0,
                        opening=(900.0, 1000.0, 600.0, 800.0))
    model = WallEngineeringModel.create_model(params)
    WallDrawingRenderer.render_plan_section(model, dxf, origin=(50.0, 50.0))
    WallDrawingRenderer.render_elevation(model, dxf, origin=(50.0, 450.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="WALL-01",
        revision="A",
        drawing_title="RC Wall Elevation & Section (Model Detail MW1)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)
    dxf.save(output_path)
    return output_path


def generate_retaining_wall_dxf(output_path: str = "outputs/retaining_wall_detail.dxf") -> str:
    """Generate representative DXF for cantilever retaining wall section (MRW1/files(10))."""
    dxf = DXFDocument()
    params = CantileverRetainingWallParams()
    RetainingWallDrawingRenderer.render_section(params, dxf, origin=(100.0, 100.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="RW-01",
        revision="A",
        drawing_title="Cantilever Retaining Wall Section (Model Detail MRW1)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)
    dxf.save(output_path)
    return output_path


def generate_pad_footing_dxf(output_path: str = "outputs/pad_footing_detail.dxf") -> str:
    """Generate representative DXF for RC pad footing plan + section (MF1/files(10))."""
    dxf = DXFDocument()
    params = PadFootingParams(lx_mm=2500.0, ly_mm=2500.0, depth_mm=600.0,
                              cx_mm=400.0, cy_mm=400.0)
    model = PadFootingEngineeringModel.create_model(params)
    PadFootingDrawingRenderer.render_plan(model, dxf, origin=(50.0, 50.0))
    PadFootingDrawingRenderer.render_section(model, dxf, origin=(50.0, 400.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="PAD-01",
        revision="A",
        drawing_title="Pad Footing Plan & Section (Model Detail MF1)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)
    dxf.save(output_path)
    return output_path


def generate_stair_dxf(output_path: str = "outputs/stair_detail.dxf") -> str:
    """Generate representative DXF for end-supported stair flight (MST1/files(10))."""
    dxf = DXFDocument()
    params = StairParams(stair_type="MST1", going_mm=250.0, rise_mm=175.0, n_steps=12,
                         waist_mm=200.0, landing_length_mm=1000.0, concrete_grade="30/37")
    model = StairEngineeringModel.create_model(params)
    StairDrawingRenderer.render_mst1_section(model, dxf, origin=(50.0, 100.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="STR-01",
        revision="A",
        drawing_title="RC Stair Flight Longitudinal Section (Model Detail MST1)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)
    dxf.save(output_path)
    return output_path


def generate_stair_mst2_dxf(output_path: str = "outputs/stair_mst2_detail.dxf") -> str:
    """Generate representative DXF for cantilever stair section (MST2/files(10))."""
    dxf = DXFDocument()
    params = StairParams(stair_type="MST2", going_mm=250.0, rise_mm=175.0, n_steps=10,
                         waist_mm=200.0, landing_length_mm=0.0, concrete_grade="30/37")
    model = StairEngineeringModel.create_model(params)
    StairDrawingRenderer.render_mst2_section(model, dxf, origin=(300.0, 100.0))

    panel = DrawingPanel(
        project_title="Standard Method of Detailing",
        drawing_number="STR-02",
        revision="A",
        drawing_title="Cantilever Stair Section A-A (Model Detail MST2)",
        scale="1:20"
    )
    AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)
    dxf.save(output_path)
    return output_path


def generate_all(out_dir: str = "outputs") -> Dict[str, str]:
    """Generate all representative DXF drawings."""
    os.makedirs(out_dir, exist_ok=True)
    results = {}
    results["slab"] = generate_slab_dxf(os.path.join(out_dir, "slab_detail.dxf"))
    results["beam"] = generate_beam_dxf(os.path.join(out_dir, "beam_detail.dxf"))
    results["column"] = generate_column_dxf(os.path.join(out_dir, "column_detail.dxf"))
    results["intersection"] = generate_intersection_dxf(os.path.join(out_dir, "beam_column_intersection.dxf"))
    results["corbel"] = generate_corbel_dxf(os.path.join(out_dir, "corbel_detail.dxf"))
    results["half_joint"] = generate_half_joint_dxf(os.path.join(out_dir, "half_joint_detail.dxf"))
    results["nib"] = generate_nib_dxf(os.path.join(out_dir, "nib_detail.dxf"))
    results["bs8666"] = generate_bs8666_shapes_dxf(os.path.join(out_dir, "bs8666_bar_shapes.dxf"))
    # files(10): Walls, Foundations, Stairs
    results["wall"] = generate_wall_dxf(os.path.join(out_dir, "wall_detail.dxf"))
    results["retaining_wall"] = generate_retaining_wall_dxf(os.path.join(out_dir, "retaining_wall_detail.dxf"))
    results["pad_footing"] = generate_pad_footing_dxf(os.path.join(out_dir, "pad_footing_detail.dxf"))
    results["stair"] = generate_stair_dxf(os.path.join(out_dir, "stair_detail.dxf"))
    results["stair_mst2"] = generate_stair_mst2_dxf(os.path.join(out_dir, "stair_mst2_detail.dxf"))
    return results


def main():
    parser = argparse.ArgumentParser(description="Modular Engineering Detailing System Generator")
    parser.add_argument(
        "--target",
        choices=["all", "slab", "beam", "column", "intersection", "corbel", "half_joint", "nib", "bs8666",
                 "wall", "retaining_wall", "pad_footing", "stair", "stair_mst2"],
        default="all",
        help="Target detail or drawing to generate"
    )
    parser.add_argument("--outdir", default="outputs", help="Output directory for generated DXFs")
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    if args.target == "all":
        res = generate_all(args.outdir)
        print("Generated all drawings:")
        for k, v in res.items():
            print(f"  {k}: {v}")
    elif args.target == "slab":
        p = generate_slab_dxf(os.path.join(args.outdir, "slab_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "beam":
        p = generate_beam_dxf(os.path.join(args.outdir, "beam_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "column":
        p = generate_column_dxf(os.path.join(args.outdir, "column_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "intersection":
        p = generate_intersection_dxf(os.path.join(args.outdir, "beam_column_intersection.dxf"))
        print(f"Generated: {p}")
    elif args.target == "corbel":
        p = generate_corbel_dxf(os.path.join(args.outdir, "corbel_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "half_joint":
        p = generate_half_joint_dxf(os.path.join(args.outdir, "half_joint_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "nib":
        p = generate_nib_dxf(os.path.join(args.outdir, "nib_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "bs8666":
        p = generate_bs8666_shapes_dxf(os.path.join(args.outdir, "bs8666_bar_shapes.dxf"))
        print(f"Generated: {p}")
    elif args.target == "wall":
        p = generate_wall_dxf(os.path.join(args.outdir, "wall_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "retaining_wall":
        p = generate_retaining_wall_dxf(os.path.join(args.outdir, "retaining_wall_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "pad_footing":
        p = generate_pad_footing_dxf(os.path.join(args.outdir, "pad_footing_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "stair":
        p = generate_stair_dxf(os.path.join(args.outdir, "stair_detail.dxf"))
        print(f"Generated: {p}")
    elif args.target == "stair_mst2":
        p = generate_stair_mst2_dxf(os.path.join(args.outdir, "stair_mst2_detail.dxf"))
        print(f"Generated: {p}")


if __name__ == "__main__":
    main()
