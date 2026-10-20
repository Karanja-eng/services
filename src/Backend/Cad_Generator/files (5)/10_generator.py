"""
Reference parametric generator for §6.9 Corbels, Half Joints and Nibs
(IStructE/Concrete Society Standard Method of Detailing Structural Concrete).

Implements Model Details MCB1, MCB2 (corbels), MHJ (half joint), MN1, MN2 (nibs)
as reusable parametric functions, per the engineering rules extracted in
03_detailing_rules.json and the parameters in 04_parameters.json.

Requires: ezdxf  (pip install ezdxf --break-system-packages)

This is a REFERENCE / TEACHING generator: geometry is schematic and
proportionally correct, but bend radii and weld symbols are PROPOSED
placeholders (not numerically specified in the source) — see
09_generator_design.md "Known simplifications".
"""

from dataclasses import dataclass, field
from typing import Optional
import ezdxf
from ezdxf.enums import TextEntityAlignment

# --------------------------------------------------------------------------
# Rule engine — pure functions derived from 03_detailing_rules.json
# --------------------------------------------------------------------------

class RuleEngine:
    MIN_POKER_PITCH_MM = 75
    MIN_VERTICAL_BAR_SPACING_MM = 25

    @staticmethod
    def min_anchorage_length(bar_diameter_mm: float) -> float:
        """CBL-014: greater of 10*diameter or 100mm."""
        return max(10 * bar_diameter_mm, 100.0)

    @staticmethod
    def min_edge_distance(bar_diameter_mm: float, cover_mm: float) -> float:
        """CBL-023: max(bar_diameter, 0.75*cover)."""
        return max(bar_diameter_mm, 0.75 * cover_mm)

    @staticmethod
    def as_min_corbel_tension(bt_mm: float, d_mm: float) -> float:
        """CBL-006: As,min >= 0.0014 * bt * d (mm^2)."""
        return 0.0014 * bt_mm * d_mm

    @staticmethod
    def asc_min_corbel_compression(ac_mm2: float) -> float:
        """CBL-007: Asc,min >= 0.002 * Ac (mm^2)."""
        return 0.002 * ac_mm2

    @staticmethod
    def as_min_halfjoint_nib(bt_mm: float, d_mm: float) -> float:
        """CBL-008 simplified case (C28/35, fyk=500): As,min = 0.0014*bt*d."""
        return 0.0014 * bt_mm * d_mm

    @staticmethod
    def min_secondary_reinf_area(main_tensile_area_mm2: float) -> float:
        """CBL-024: >= 0.5 * main tensile area."""
        return 0.5 * main_tensile_area_mm2

    @staticmethod
    def min_compression_bar_area_per_metre(width_mm: float) -> float:
        """CBL-024: >= 1000 mm^2 / metre width of corbel."""
        return 1000.0 * (width_mm / 1000.0)

    @staticmethod
    def nib_main_bar_max_pitch(h_mm: float, concentrated_load: bool) -> float:
        """CBL-012."""
        return min(2 * h_mm, 250.0) if concentrated_load else min(3 * h_mm, 400.0)

    @staticmethod
    def nib_secondary_bar_max_pitch(h_mm: float, concentrated_load: bool) -> float:
        """CBL-013."""
        return min(3 * h_mm, 400.0) if concentrated_load else min(3.5 * h_mm, 450.0)

    @staticmethod
    def validate_corbel(main_bar_diameter_mm: float, welded: bool) -> None:
        """CBL-025."""
        limit = 20.0 if welded else 16.0
        if main_bar_diameter_mm > limit:
            raise ValueError(
                f"main_bar_diameter {main_bar_diameter_mm}mm exceeds {limit}mm "
                f"limit for {'MCB2 (welded)' if welded else 'MCB1 (unwelded)'}"
            )

    @staticmethod
    def validate_nib(nib_depth_mm: float, shallow: bool,
                      link_or_ubar_diameter_mm: float, ubar_pitch_mm: Optional[float]) -> None:
        """CBL-027, CBL-028."""
        if shallow:
            if nib_depth_mm < 140.0:
                raise ValueError("MN2 shallow nib depth must be >= 140mm (CBL-028)")
            if link_or_ubar_diameter_mm > 16.0:
                raise ValueError("MN2 U-bar diameter must be <= 16mm (CBL-028)")
            if ubar_pitch_mm is not None and ubar_pitch_mm > 250.0:
                raise ValueError("MN2 U-bar pitch must be <= 250mm (CBL-028)")
        else:
            if link_or_ubar_diameter_mm > 12.0:
                raise ValueError("MN1 link diameter must be <= 12mm (CBL-027)")


# --------------------------------------------------------------------------
# Geometry parameter containers (04_parameters.json)
# --------------------------------------------------------------------------

@dataclass
class CorbelGeometry:
    width_mm: float = 400.0
    projection_mm: float = 300.0
    depth_at_column_mm: float = 500.0
    bearing_width_mm: float = 150.0
    cover_mm: float = 35.0            # external (XC3) default per CBL-002
    main_bar_diameter_mm: float = 16.0
    main_bar_count: int = 4
    compression_bar_diameter_mm: float = 12.0
    column_width_mm: float = 400.0
    column_link_diameter_mm: float = 10.0
    welded: bool = False


@dataclass
class HalfJointGeometry:
    beam_depth_mm: float = 600.0
    step_depth_reduction_mm: float = 250.0
    bearing_length_mm: float = 200.0
    cover_mm: float = 40.0
    main_bottom_bar_diameter_mm: float = 20.0
    hanger_link_diameter_mm: float = 10.0
    hanger_link_spacing_mm: float = 450.0
    general_link_spacing_mm: float = 150.0
    uses_cranked_bar: bool = False


@dataclass
class NibGeometry:
    depth_mm: float = 200.0
    projection_mm: float = 150.0
    cover_mm: float = 40.0
    shallow: bool = False
    link_or_ubar_diameter_mm: float = 12.0
    ubar_pitch_mm: Optional[float] = None
    lacer_bar_diameter_mm: Optional[float] = None
    min_reinforcement_overlap_mm: float = 60.0
    concentrated_load_zone: bool = False


# --------------------------------------------------------------------------
# Low-level drawing helpers
# --------------------------------------------------------------------------

def draw_bar(msp, start, end, layer="REBAR-MAIN"):
    msp.add_line(start, end, dxfattribs={"layer": layer})


def draw_link(msp, x, y0, y1, width, layer="REBAR-LINKS"):
    """Simple rectangular closed link (schematic)."""
    pts = [(x, y0), (x + width, y0), (x + width, y1), (x, y1), (x, y0)]
    msp.add_lwpolyline(pts, dxfattribs={"layer": layer})


def add_rebar_callout(msp, position, text, layer="ANNOTATION"):
    msp.add_text(text, dxfattribs={"layer": layer, "height": 12}).set_placement(
        position, align=TextEntityAlignment.LEFT
    )


def add_dimension(msp, p1, p2, offset, layer="DIMENSIONS"):
    dim = msp.add_linear_dim(
        base=(p1[0], p1[1] + offset), p1=p1, p2=p2,
        dxfattribs={"layer": layer},
    )
    dim.render()


def add_weld_symbol(msp, position, layer="WELD"):
    """PROPOSED placeholder — no weld symbol convention given in source."""
    x, y = position
    msp.add_lwpolyline(
        [(x - 10, y), (x + 10, y), (x, y + 15), (x - 10, y)],
        dxfattribs={"layer": layer},
    )


def add_bend(msp, position, radius_mm, layer="REBAR-MAIN"):
    """PROPOSED placeholder bend radius (source only says 'large radius')."""
    msp.add_arc(center=position, radius=radius_mm, start_angle=180, end_angle=270,
                dxfattribs={"layer": layer})


def add_section_marker(msp, position, label="A-A", layer="ANNOTATION"):
    x, y = position
    msp.add_line((x - 20, y), (x + 20, y), dxfattribs={"layer": layer})
    add_rebar_callout(msp, (x + 25, y), label, layer=layer)


# --------------------------------------------------------------------------
# Model Detail generators
# --------------------------------------------------------------------------

def create_corbel(dwg, geom: CorbelGeometry, insert=(0, 0)):
    """Model Detail MCB1 (unwelded) or MCB2 (welded), per geom.welded."""
    RuleEngine.validate_corbel(geom.main_bar_diameter_mm, geom.welded)
    msp = dwg.modelspace()
    ox, oy = insert

    # Concrete outline: column + corbel cantilever (schematic profile)
    col_top = oy + geom.depth_at_column_mm
    outline = [
        (ox, oy), (ox + geom.column_width_mm, oy),
        (ox + geom.column_width_mm, col_top),
        (ox + geom.column_width_mm + geom.projection_mm, col_top - geom.depth_at_column_mm * 0.4),
        (ox + geom.column_width_mm, oy + geom.depth_at_column_mm * 0.15),
        (ox, oy),
    ]
    msp.add_lwpolyline(outline, dxfattribs={"layer": "CONCRETE"})

    # Main tensile reinforcement: from outer face, laps into column
    edge_dist = RuleEngine.min_edge_distance(geom.main_bar_diameter_mm, geom.cover_mm)
    bar_y = col_top - edge_dist
    tip_x = ox + geom.column_width_mm + geom.projection_mm - edge_dist
    draw_bar(msp, (tip_x, bar_y), (ox + 20, bar_y))
    lap_len = RuleEngine.min_anchorage_length(geom.main_bar_diameter_mm) * 1.35  # tension lap > anchorage
    draw_bar(msp, (ox + 20, bar_y), (ox - lap_len, bar_y))
    add_rebar_callout(msp, (ox - lap_len, bar_y + 15),
                       f"{geom.main_bar_count}H{int(geom.main_bar_diameter_mm)} main tensile - tension lap {lap_len:.0f}")

    if geom.welded:
        add_weld_symbol(msp, (ox + 20, bar_y))
        add_rebar_callout(msp, (ox + 30, bar_y - 30), "Welded to cross bar/plate + compression bars (MCB2)")
    else:
        add_bend(msp, (ox + 20, bar_y - geom.main_bar_diameter_mm * 4), geom.main_bar_diameter_mm * 4)
        add_rebar_callout(msp, (ox + 30, bar_y - 60), "Large radius bend (MCB1)")

    # Compression bars + secondary horizontal reinforcement
    main_tensile_area = geom.main_bar_count * 3.14159 * (geom.main_bar_diameter_mm / 2) ** 2
    comp_area = RuleEngine.min_compression_bar_area_per_metre(geom.width_mm)
    sec_area = RuleEngine.min_secondary_reinf_area(main_tensile_area)
    add_rebar_callout(msp, (ox, oy - 30),
                       f"Compression bars >= {comp_area:.0f} mm2/m ; "
                       f"Secondary/horizontal reinf >= {sec_area:.0f} mm2")

    # Two column links near corbel top
    for i, dy in enumerate((15, 45)):
        draw_link(msp, ox + 10, col_top - dy - 10, col_top - dy + 10, geom.column_width_mm - 20)
    add_rebar_callout(msp, (ox + 10, col_top + 20), "2 no. column links near corbel top")

    add_rebar_callout(msp, (ox, oy - 60),
                       f"Nominal cover = {geom.cover_mm:.0f}mm (specified by designer)")
    add_section_marker(msp, (ox + geom.column_width_mm + geom.projection_mm / 2, oy - 100))
    return msp


def create_half_joint(dwg, geom: HalfJointGeometry, insert=(0, 0)):
    """Model Detail MHJ."""
    msp = dwg.modelspace()
    ox, oy = insert
    full_depth = geom.beam_depth_mm
    step_depth = full_depth - geom.step_depth_reduction_mm

    outline = [
        (ox, oy), (ox, oy + full_depth),
        (ox + 200, oy + full_depth),
        (ox + 200, oy + step_depth),
        (ox + 200 + geom.bearing_length_mm, oy + step_depth),
        (ox + 200 + geom.bearing_length_mm, oy),
        (ox, oy),
    ]
    msp.add_lwpolyline(outline, dxfattribs={"layer": "CONCRETE"})

    edge_dist = RuleEngine.min_edge_distance(geom.main_bottom_bar_diameter_mm, geom.cover_mm)
    ubar_y = oy + edge_dist
    draw_bar(msp, (ox + 200 + geom.bearing_length_mm - edge_dist, ubar_y),
              (ox + 20, ubar_y))
    add_rebar_callout(msp, (ox + 20, ubar_y - 20),
                       f"Horizontal U-bar H{int(geom.main_bottom_bar_diameter_mm)} "
                       f"(= main bottom bar dia), tension anchorage")

    if geom.uses_cranked_bar:
        add_rebar_callout(msp, (ox + 20, ubar_y - 50), "Cranked bar for crack control - separate tension lap")

    # Full-length links, hanger links at 450, general links at 150
    n_hangers = max(1, int(full_depth // geom.hanger_link_spacing_mm))
    for i in range(n_hangers):
        x = ox + 40 + i * geom.hanger_link_spacing_mm * 0.3
        draw_link(msp, x, oy + 10, oy + step_depth - 10, geom.hanger_link_diameter_mm * 4, layer="REBAR-HANGER")
    add_rebar_callout(msp, (ox, oy + full_depth + 20),
                       f"Nominal hanger links at {geom.hanger_link_spacing_mm:.0f}; "
                       f"nominal links at {geom.general_link_spacing_mm:.0f} elsewhere")

    add_rebar_callout(msp, (ox, oy - 40),
                       f"Nominal cover = {geom.cover_mm:.0f}mm (normally 40mm to main steel)")
    add_section_marker(msp, (ox + 100, oy - 80))
    return msp


def create_nib(dwg, geom: NibGeometry, insert=(0, 0)):
    """Model Detail MN1 (shallow=False) or MN2 (shallow=True)."""
    RuleEngine.validate_nib(geom.depth_mm, geom.shallow,
                             geom.link_or_ubar_diameter_mm, geom.ubar_pitch_mm)
    msp = dwg.modelspace()
    ox, oy = insert

    outline = [
        (ox, oy), (ox + geom.projection_mm, oy),
        (ox + geom.projection_mm, oy + geom.depth_mm),
        (ox, oy + geom.depth_mm), (ox, oy),
    ]
    msp.add_lwpolyline(outline, dxfattribs={"layer": "CONCRETE"})

    edge_dist = RuleEngine.min_edge_distance(geom.link_or_ubar_diameter_mm, geom.cover_mm)

    if geom.shallow:
        # MN2: horizontal U-bars + lacer bar
        y = oy + geom.depth_mm - edge_dist
        draw_bar(msp, (ox + geom.projection_mm - edge_dist, y), (ox + 20, y))
        lacer_dia = geom.lacer_bar_diameter_mm or geom.link_or_ubar_diameter_mm
        draw_bar(msp, (ox + 10, oy + 20), (ox + geom.projection_mm - 10, oy + 20), layer="REBAR-LACER")
        add_rebar_callout(msp, (ox, oy - 30),
                           f"Horizontal U-bars H{int(geom.link_or_ubar_diameter_mm)} at "
                           f"{geom.ubar_pitch_mm or 250:.0f}mm pitch; lacer bar H{int(lacer_dia)}, "
                           f"wired to >=2 main longitudinal bars")
        add_rebar_callout(msp, (ox, oy - 60),
                           f"Nib depth {geom.depth_mm:.0f}mm (>=140mm required, MN2)")
    else:
        # MN1: closed links or U-bars
        draw_link(msp, ox + 20, oy + 10, oy + geom.depth_mm - 10, geom.projection_mm - 40)
        add_rebar_callout(msp, (ox, oy - 30),
                           f"Closed link/U-bar H{int(geom.link_or_ubar_diameter_mm)} "
                           f"(<=12mm, MN1); tension anchorage if U-bars used")

    add_rebar_callout(msp, (ox, oy - 90),
                       f"Min nominal overlap into supported member = {geom.min_reinforcement_overlap_mm:.0f}mm")
    add_section_marker(msp, (ox + geom.projection_mm / 2, oy - 130))
    return msp


# --------------------------------------------------------------------------
# Stand-alone helpers for the two parametric prestressed-concrete diagrams
# --------------------------------------------------------------------------

def create_end_block_bursting_zone(dwg, t_mm: float, b_mm: float, a_mm: float, insert=(0, 0)):
    """Figure 7.13 pattern: horizontal/vertical bursting reinforcement zones."""
    msp = dwg.modelspace()
    ox, oy = insert
    msp.add_lwpolyline(
        [(ox, oy), (ox + b_mm, oy), (ox + b_mm, oy + t_mm), (ox, oy + t_mm), (ox, oy)],
        dxfattribs={"layer": "CONCRETE"},
    )
    zone_start = 0.2  # * yo, per source: distributed 0.2yo to 2yo from loaded face
    zone_end = 2.0
    yo = b_mm / 2
    x0 = ox + zone_start * yo
    x1 = ox + min(zone_end * yo, b_mm)
    msp.add_lwpolyline(
        [(x0, oy), (x1, oy), (x1, oy + t_mm), (x0, oy + t_mm), (x0, oy)],
        dxfattribs={"layer": "BURSTING-ZONE"},
    )
    add_rebar_callout(msp, (ox, oy - 30),
                       f"Bursting reinf zone: 0.2yo-2yo from loaded face; "
                       f"min 50mm+{a_mm:.0f}mm outside anchor plate edge")
    return msp


def create_duct_profile_table(profile_rows: dict) -> str:
    """
    Fig 7.9 pattern: returns a formatted text block (for annotation, not geometry)
    of tendon ordinates at fractional-span intervals.
    profile_rows example:
        {"fractions": [0, 0.05, 0.10, 0.15, 0.20],
         "tendon_1_y": [1340, 1203, 1061, 938, 833],
         "tendon_1_z": [560, 300, 150, 105, 105]}
    """
    lines = ["Distance along member (fraction of span): " +
             " ".join(f"{f:.2f}" for f in profile_rows["fractions"])]
    for key, values in profile_rows.items():
        if key == "fractions":
            continue
        lines.append(f"{key}: " + " ".join(f"{v:.0f}" for v in values))
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Example usage / smoke test
# --------------------------------------------------------------------------

if __name__ == "__main__":
    doc = ezdxf.new("R2010")
    for layer in ("CONCRETE", "REBAR-MAIN", "REBAR-LINKS", "REBAR-HANGER",
                  "REBAR-LACER", "ANNOTATION", "DIMENSIONS", "WELD", "BURSTING-ZONE"):
        doc.layers.add(layer)

    create_corbel(doc, CorbelGeometry(welded=False), insert=(0, 0))
    create_corbel(doc, CorbelGeometry(welded=True, main_bar_diameter_mm=20), insert=(1200, 0))
    create_half_joint(doc, HalfJointGeometry(uses_cranked_bar=True), insert=(0, -800))
    create_nib(doc, NibGeometry(shallow=False), insert=(0, -1600))
    create_nib(doc, NibGeometry(shallow=True, depth_mm=180, ubar_pitch_mm=200,
                                 link_or_ubar_diameter_mm=12, lacer_bar_diameter_mm=12),
               insert=(500, -1600))
    create_end_block_bursting_zone(doc, t_mm=600, b_mm=800, a_mm=50, insert=(0, -2200))

    doc.saveas("corbels_half_joints_nibs_reference.dxf")
    print("Saved corbels_half_joints_nibs_reference.dxf")
    print(create_duct_profile_table({
        "fractions": [0, 0.05, 0.10, 0.15, 0.20],
        "tendon_1_y": [1340, 1203, 1061, 938, 833],
        "tendon_1_z": [560, 300, 150, 105, 105],
    }))
