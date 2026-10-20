"""
IStructE SMDS General Detailing Layer — Python + ezdxf Generator
=================================================================
Implements the GENERAL DETAILING rules from Chapters 1–5.
This module is the shared foundation for all member-specific generators.

Engineering Source: IStructE/Concrete Society Standard Method of Detailing
Structural Concrete (Chapters 1–5)
Standard: BS 8666, EC2 (BS EN 1992-1-1)

USAGE:
    from general_detailing import (
        parse_bar_notation, generate_bar_notation,
        DrawingSheet, BarSchedule,
        BeamColumnIntersectionGenerator
    )
"""

import ezdxf
from ezdxf import colors
from ezdxf.enums import TextEntityAlignment
import math
from dataclasses import dataclass, field
from typing import Optional, List, Tuple, Dict


# ─────────────────────────────────────────────────────────────────────────────
# 1. REINFORCEMENT NOTATION (Section 4.2.1, page 25)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class BarDescription:
    """
    Decoded bar description per SMDS Section 4.2.1.
    Format: N H D - M - S L
    Example: 20H16-63-150B1
    """
    count: int           # Number of bars
    grade: str           # H = high yield
    diameter_mm: int     # Nominal diameter
    mark: str            # Bar mark
    spacing_mm: Optional[int] = None   # Centre spacing (for slabs)
    location: Optional[str] = None     # Layer code e.g. B1, T1, F1, N1


LAYER_CODES = {
    # bottom face
    "B1": ("bottom", 1), "B2": ("bottom", 2),
    # top face
    "T1": ("top", 1), "T2": ("top", 2),
    # far face
    "F1": ("far", 1), "F2": ("far", 2),
    # near face
    "N1": ("near", 1), "N2": ("near", 2),
}


def parse_bar_notation(notation: str) -> BarDescription:
    """
    Parse a bar notation string like '20H16-63-150B1' into components.
    DIRECTLY STATED format from Section 4.2.1, page 25.
    """
    import re
    # Pattern: NHD-M-SL or NHD-M or just NHD
    pattern = r"(\d+)(H|T)(\d+)-(\w+)(?:-(\d+)(B1|B2|T1|T2|F1|F2|N1|N2))?"
    m = re.match(pattern, notation.strip())
    if not m:
        raise ValueError(f"Cannot parse bar notation: {notation}")
    count = int(m.group(1))
    grade = m.group(2)
    dia = int(m.group(3))
    mark = m.group(4)
    spacing = int(m.group(5)) if m.group(5) else None
    location = m.group(6) if m.group(6) else None
    return BarDescription(count, grade, dia, mark, spacing, location)


def generate_bar_notation(bar: BarDescription) -> str:
    """
    Generate bar notation string per SMDS Section 4.2.1.
    """
    s = f"{bar.count}{bar.grade}{bar.diameter_mm}-{bar.mark}"
    if bar.spacing_mm:
        s += f"-{bar.spacing_mm}"
    if bar.location:
        s += bar.location
    return s


def check_bar_max_length(diameter_mm: int) -> float:
    """
    Return maximum scheduled bar length per SMDS Section 4.2.4, page 30.
    DIRECTLY STATED rule.
    """
    if diameter_mm >= 12:
        return 12000.0  # mm
    else:  # <= 10mm
        return 6000.0   # mm


# ─────────────────────────────────────────────────────────────────────────────
# 2. DRAWING SHEET STANDARDS (Chapter 3)
# ─────────────────────────────────────────────────────────────────────────────

SHEET_SIZES_MM = {
    "A0": (841, 1189),
    "A1": (594, 841),
    "A2": (420, 594),
    "A3": (297, 420),
    "A4": (210, 297),
}

BORDER_LEFT_MM = 20  # Filing border — all sheets (Section 3.6)
BORDER_OTHER_A0_A1_MM = 20  # Other sides A0/A1 minimum
BORDER_OTHER_A2_A4_MM = 10  # Other sides A2–A4 minimum

RECOMMENDED_SCALES = {
    "general_arrangements": 100,       # 1:100
    "wall_and_slab_detail": 50,        # 1:50
    "beam_and_column_elevations": 50,  # 1:50
    "beam_and_column_sections": 20,    # 1:20
}

LINE_WEIGHTS = {
    "concrete_outline": 0.35,
    "rebar_main": 0.7,
    "rebar_links": 0.5,
    "dimension": 0.25,
    "centre_line": 0.25,
}


@dataclass
class DrawingPanelA:
    """Title block information (bottom right corner) — Section 3.7, page 14."""
    project_number: str = ""
    project_title: str = ""
    drawing_number: str = ""
    revision: str = ""
    drawing_title: str = ""
    office: str = ""
    scale: str = ""
    drawn_by: str = ""
    checked_by: str = ""
    date: str = ""
    schedule_refs: str = ""
    concrete_grade: str = ""
    specified_covers: str = ""


class DrawingSheet:
    """
    Creates a DXF drawing with correct sheet layout per SMDS Chapter 3.
    Sheet size, borders, title block per Sections 3.5–3.7.
    """

    def __init__(self, size: str = "A1", scale: int = 50,
                 panel_data: Optional[DrawingPanelA] = None):
        self.size = size.upper()
        self.scale = scale
        self.panel_data = panel_data or DrawingPanelA()
        width, height = SHEET_SIZES_MM[self.size]
        self.width = width
        self.height = height

        if self.size in ("A0", "A1"):
            self.border_other = BORDER_OTHER_A0_A1_MM
        else:
            self.border_other = BORDER_OTHER_A2_A4_MM

        self.doc = ezdxf.new("R2010")
        self._setup_layers()
        self.msp = self.doc.modelspace()
        self._draw_border()
        if panel_data:
            self._draw_title_block()

    def _setup_layers(self):
        layers = self.doc.layers
        layer_defs = [
            ("CONCRETE", colors.WHITE, 0.35),
            ("REBAR_MAIN", colors.YELLOW, 0.70),
            ("REBAR_LINKS", colors.GREEN, 0.50),
            ("REBAR_SECONDARY", colors.CYAN, 0.35),
            ("DIMENSIONS", colors.RED, 0.25),
            ("CENTRE_LINES", colors.BLUE, 0.25),
            ("ANNOTATIONS", colors.WHITE, 0.25),
            ("BAR_MARKS", colors.MAGENTA, 0.25),
            ("GRID", colors.GRAY, 0.18),
            ("HATCHING", colors.GRAY, 0.18),
        ]
        for name, color, lw in layer_defs:
            if name not in layers:
                lay = layers.add(name)
                lay.color = color
                lay.lineweight = int(lw * 100)

    def _draw_border(self):
        """Draw sheet border per Section 3.6."""
        msp = self.msp
        W, H = self.width, self.height
        bl = BORDER_LEFT_MM
        bo = self.border_other
        # Border rectangle
        msp.add_lwpolyline(
            [(bl, bo), (W - bo, bo), (W - bo, H - bo), (bl, H - bo), (bl, bo)],
            dxfattribs={"layer": "CONCRETE", "lineweight": 50}
        )

    def _draw_title_block(self):
        """Draw title block in bottom right — Section 3.7."""
        W, H = self.width, self.height
        bo = self.border_other
        panel_w = 180
        panel_h = 60
        px = W - bo - panel_w
        py = bo
        msp = self.msp
        # Panel A box
        msp.add_lwpolyline(
            [(px, py), (W - bo, py), (W - bo, py + panel_h), (px, py + panel_h), (px, py)],
            dxfattribs={"layer": "ANNOTATIONS"}
        )
        # Title text
        p = self.panel_data
        entries = [
            p.project_title, p.drawing_title, p.drawing_number + " Rev " + p.revision,
            p.scale, p.drawn_by, p.checked_by, p.date
        ]
        y = py + panel_h - 5
        for text in entries:
            if text.strip():
                msp.add_text(
                    text, dxfattribs={"layer": "ANNOTATIONS", "height": 2.5,
                                      "insert": (px + 2, y)}
                )
                y -= 7

    def model_to_sheet(self, real_mm: float) -> float:
        """Convert real dimension (mm) to sheet coordinate at current scale."""
        return real_mm / self.scale

    def save(self, path: str):
        self.doc.saveas(path)


# ─────────────────────────────────────────────────────────────────────────────
# 3. BAR SCHEDULE (BS 8666) — Section 4.5
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class BarScheduleEntry:
    """One row in a BS 8666 bar schedule — Table 4.2, page 31."""
    member: str
    bar_mark: str
    type_size: str           # e.g. "H25"
    length_each_mm: int      # specified in multiples of 25mm
    no_of_members: int
    no_bars_in_each: int
    shape_code: int
    A_mm: Optional[int] = None  # specified in multiples of 5mm
    B_mm: Optional[int] = None
    C_mm: Optional[int] = None
    D_mm: Optional[int] = None
    EIR_mm: Optional[int] = None
    revision: str = ""

    @property
    def total_no(self):
        return self.no_of_members * self.no_bars_in_each

    def validate(self):
        """SMDS Section 4.5.1 validation rules."""
        # Length multiples of 25mm
        assert self.length_each_mm % 25 == 0, \
            f"Bar length {self.length_each_mm} must be multiple of 25mm (BS8666)"
        # Bending dimensions multiples of 5mm
        for dim_name, val in [("A", self.A_mm), ("B", self.B_mm),
                               ("C", self.C_mm), ("D", self.D_mm), ("EIR", self.EIR_mm)]:
            if val is not None:
                assert val % 5 == 0, \
                    f"Dimension {dim_name}={val} must be multiple of 5mm (BS8666)"


class BarSchedule:
    """
    BS 8666 compliant bar schedule generator.
    Source: Section 4.5, Tables 4.2–4.3, pages 31–32.
    """

    def __init__(self, schedule_ref: str, drawing_ref: str, status: str = "C"):
        self.schedule_ref = schedule_ref  # Max 6 chars per Section 4.5.1
        self.drawing_ref = drawing_ref
        self.status = status  # P=Preliminary, T=Tender, C=Construction
        self.entries: List[BarScheduleEntry] = []
        self._bar_marks_per_member: Dict[str, set] = {}

    def add_bar(self, entry: BarScheduleEntry):
        """Add bar to schedule with validation."""
        entry.validate()
        # Rule: same bar mark must not repeat within same member name (Section 4.5.1 EDI rules)
        member = entry.member
        if member not in self._bar_marks_per_member:
            self._bar_marks_per_member[member] = set()
        if entry.bar_mark in self._bar_marks_per_member[member]:
            raise ValueError(
                f"Bar mark '{entry.bar_mark}' already used in member '{member}'. "
                "Same bar mark must not repeat within same member name."
            )
        self._bar_marks_per_member[member].add(entry.bar_mark)
        self.entries.append(entry)

    def total_weight_kg(self) -> float:
        """
        Approximate weight (kg) — informational only.
        DERIVED from bar areas and lengths, not directly stated in manual.
        """
        DENSITY = 7850  # kg/m³ for steel
        total = 0.0
        for e in self.entries:
            dia = int(e.type_size.replace("H", "").replace("T", ""))
            area_mm2 = math.pi * (dia / 2) ** 2
            length_m = e.length_each_mm / 1000
            vol_m3 = (area_mm2 / 1e6) * length_m * e.total_no
            total += vol_m3 * DENSITY
        return total

    def to_rows(self) -> List[dict]:
        rows = []
        for e in self.entries:
            rows.append({
                "member": e.member,
                "bar_mark": e.bar_mark,
                "type_size": e.type_size,
                "length_each_mm": e.length_each_mm,
                "no_of_members": e.no_of_members,
                "no_bars_in_each": e.no_bars_in_each,
                "total_no": e.total_no,
                "shape_code": e.shape_code,
                "A_mm": e.A_mm,
                "B_mm": e.B_mm,
                "C_mm": e.C_mm,
                "D_mm": e.D_mm,
                "EIR_mm": e.EIR_mm,
                "revision": e.revision,
            })
        return rows


# ─────────────────────────────────────────────────────────────────────────────
# 4. BEAM/COLUMN INTERSECTION GENERATOR
# Source: Sections 4.2.2–4.2.3, Figures 4.1–4.6
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class BeamColumnParams:
    """
    Input parameters for beam/column intersection drawing.
    All dimensions in mm.
    """
    # Geometry
    col_width: float = 400
    col_depth: float = 400
    beam_width: float = 300
    beam_depth: float = 500
    secondary_beam_width: float = 250
    secondary_beam_depth: float = 450
    span_left_mm: float = 4000   # beam span to left of column
    span_right_mm: float = 4000  # beam span to right of column
    col_height_mm: float = 3000  # column height above beam

    # Reinforcement
    cover_mm: float = 30         # DEPENDENCY: from General Detailing chapter
    main_bar_dia: int = 25       # primary beam main bar diameter
    link_dia: int = 10
    col_bar_dia: int = 32
    col_bar_count: int = 4       # bars per face
    lacing_bar_dia: int = 10

    # Derived rules
    crank_ratio: Tuple[int, int] = (1, 10)   # 1:10 horizontal:vertical
    crank_offset_mm: float = 50              # Figure 4.2
    cross_tie_spacing_mm: float = 1000       # Figure 4.2
    max_link_free_height_mm: float = 400     # Figure 4.2
    spacer_bar_spacing_mm: float = 1000      # Figure 4.3


class BeamColumnIntersectionGenerator:
    """
    Generates elevation and plan views of a beam/column intersection.
    Rules from SMDS Sections 4.2.2–4.2.3, Figures 4.1–4.6.

    Philosophy: engineering model → drawing model → DXF
    """

    def __init__(self, params: BeamColumnParams, sheet: DrawingSheet):
        self.p = params
        self.sheet = sheet
        self.msp = sheet.msp
        self.origin_elev = (50, 100)   # Elevation origin in sheet coords
        self.origin_plan = (50, 50)    # Plan origin in sheet coords

        # Run engineering validations first
        self._validate()

    def _validate(self):
        """Engineering checks per SMDS rules."""
        p = self.p

        # Vibrator access check (Figure 4.2, page 27)
        required_space = (p.beam_width / 300) * 75
        available = p.beam_width - 2 * p.cover_mm - 2 * p.link_dia
        if available < required_space:
            print(f"WARNING: Vibrator space check — required {required_space:.0f}mm, "
                  f"available {available:.0f}mm. Review beam width.")

        # Link free height check (Figure 4.2)
        link_height = p.beam_depth - 2 * p.cover_mm
        self.needs_cross_ties = link_height > p.max_link_free_height_mm
        if self.needs_cross_ties:
            print(f"INFO: Link free height {link_height:.0f}mm > {p.max_link_free_height_mm}mm. "
                  "Cross ties at 1000mm centres required.")

        # Column bar link retention (Section 4.2.2, note 1)
        # (Simplified: assess column bar spacing for this check)
        self.col_bar_to_bar_spacing = (
            p.col_width - 2 * p.cover_mm - p.col_bar_dia
        ) / max(p.col_bar_count - 1, 1)
        if self.col_bar_to_bar_spacing <= 150:
            self.link_every_other_bar = True
            print(f"INFO: Column bar spacing {self.col_bar_to_bar_spacing:.0f}mm <= 150mm. "
                  "Every other bar to be retained by link.")
        else:
            self.link_every_other_bar = False

    def _s(self, mm: float) -> float:
        """Scale real mm to sheet coordinate."""
        return self.sheet.model_to_sheet(mm)

    def generate_elevation(self, origin: Tuple[float, float] = None):
        """
        Draw elevation view of beam/column intersection.
        Looking towards the left (Section 3.18).
        """
        if origin is None:
            origin = self.origin_elev
        ox, oy = origin
        p = self.p
        s = self._s

        # ── Concrete outline ──────────────────────────────────────────────
        # Column above
        col_x = ox + s(p.span_left_mm)
        col_top = oy + s(p.beam_depth) + s(p.col_height_mm)
        col_bot = oy
        beam_top = oy + s(p.beam_depth)

        # Column rectangle
        self.msp.add_lwpolyline([
            (col_x, oy),
            (col_x + s(p.col_width), oy),
            (col_x + s(p.col_width), col_top),
            (col_x, col_top),
            (col_x, oy)
        ], dxfattribs={"layer": "CONCRETE"})

        # Beam left span
        self.msp.add_lwpolyline([
            (ox, oy),
            (col_x, oy),
            (col_x, beam_top),
            (ox, beam_top),
            (ox, oy)
        ], dxfattribs={"layer": "CONCRETE"})

        # Beam right span
        beam_right_end = col_x + s(p.col_width) + s(p.span_right_mm)
        self.msp.add_lwpolyline([
            (col_x + s(p.col_width), oy),
            (beam_right_end, oy),
            (beam_right_end, beam_top),
            (col_x + s(p.col_width), beam_top),
            (col_x + s(p.col_width), oy)
        ], dxfattribs={"layer": "CONCRETE"})

        # ── Column bars (vertical, through junction) ──────────────────────
        cover = p.cover_mm
        col_bar_positions_x = [
            col_x + s(cover + p.link_dia + p.col_bar_dia / 2),
            col_x + s(p.col_width - cover - p.link_dia - p.col_bar_dia / 2)
        ]
        for cbx in col_bar_positions_x:
            # Straight through
            self.msp.add_line(
                (cbx, oy), (cbx, col_top),
                dxfattribs={"layer": "REBAR_MAIN"}
            )

        # ── Column crank above beam (Figure 4.2) ─────────────────────────
        # Crank 1:10 with 50mm offset — shown above kicker
        kicker_y = beam_top + s(75)  # Assume 75mm kicker
        for cbx in col_bar_positions_x:
            offset_x = s(p.crank_offset_mm)
            # If outer bar, crank inward
            is_left = cbx < col_x + s(p.col_width / 2)
            crank_dir = 1 if is_left else -1
            crank_end_x = cbx + crank_dir * offset_x
            crank_height = offset_x * p.crank_ratio[1]  # 1:10 ratio → height = 10 * horiz
            self.msp.add_lwpolyline([
                (cbx, kicker_y),
                (crank_end_x, kicker_y + s(crank_height * p.crank_ratio[1]))
            ], dxfattribs={"layer": "REBAR_MAIN"})

        # ── Beam links ────────────────────────────────────────────────────
        link_spacing = s(200)  # Nominal; actual from design
        link_w = s(p.beam_width - 2 * cover)
        link_h = s(p.beam_depth - 2 * cover)
        link_ox = ox + s(cover + p.link_dia / 2)
        link_oy = oy + s(cover + p.link_dia / 2)

        num_links_left = max(1, int(s(p.span_left_mm) / link_spacing))
        for i in range(1, num_links_left):
            lx = link_ox + i * link_spacing
            if lx < col_x - s(p.link_dia):  # Stop short of column face
                self._draw_link(lx, link_oy, link_w, link_h)

        link_ox_right = col_x + s(p.col_width) + s(cover + p.link_dia / 2)
        num_links_right = max(1, int(s(p.span_right_mm) / link_spacing))
        for i in range(1, num_links_right):
            lx = link_ox_right + i * link_spacing
            if lx < beam_right_end - s(p.link_dia):
                self._draw_link(lx, link_oy, link_w, link_h)

        # ── Cross ties (if needed) ────────────────────────────────────────
        if self.needs_cross_ties:
            self._add_cross_ties_elevation(ox, oy, col_x, beam_top, p)

        # ── Bottom span bars (stop short of column face) ─────────────────
        bot_bar_y = oy + s(cover + p.link_dia + p.main_bar_dia / 2)
        # Left span
        self.msp.add_line(
            (ox + s(cover), bot_bar_y),
            (col_x - s(p.cover_mm), bot_bar_y),
            dxfattribs={"layer": "REBAR_MAIN"}
        )
        # Right span
        self.msp.add_line(
            (col_x + s(p.col_width) + s(p.cover_mm), bot_bar_y),
            (beam_right_end - s(cover), bot_bar_y),
            dxfattribs={"layer": "REBAR_MAIN"}
        )

        # ── Bottom support bars (through column zone) ─────────────────────
        bot_sup_y = bot_bar_y - s(p.main_bar_dia + 5)
        self.msp.add_line(
            (col_x + s(cover), bot_sup_y),
            (col_x + s(p.col_width - cover), bot_sup_y),
            dxfattribs={"layer": "REBAR_SECONDARY"}
        )

        # ── Top support bars ──────────────────────────────────────────────
        top_bar_y = beam_top - s(cover + p.link_dia + p.main_bar_dia / 2)
        self.msp.add_line(
            (ox + s(cover), top_bar_y),
            (beam_right_end - s(cover), top_bar_y),
            dxfattribs={"layer": "REBAR_MAIN"}
        )

        # ── Annotations ───────────────────────────────────────────────────
        note_x = beam_right_end + s(100)
        notes = [
            "Column bars straight through junction",
            f"Crank 1:{p.crank_ratio[1]}, offset {p.crank_offset_mm}mm at kicker",
            "Bottom span bars stop short of column face",
            "Link hanger bars stop short of column face",
            f"Allow 75mm vibrator space per 300mm beam width",
        ]
        if self.needs_cross_ties:
            notes.append(f"Cross ties at {p.cross_tie_spacing_mm}mm crs (free height > {p.max_link_free_height_mm}mm)")

        for i, note in enumerate(notes):
            y_pos = beam_top - i * s(60)
            self.msp.add_text(
                note,
                dxfattribs={"layer": "ANNOTATIONS", "height": s(20),
                            "insert": (note_x, y_pos)}
            )

    def _draw_link(self, x: float, y: float, w: float, h: float):
        """Draw a closed rectangular link/stirrup."""
        self.msp.add_lwpolyline([
            (x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)
        ], dxfattribs={"layer": "REBAR_LINKS", "closed": True})

    def _add_cross_ties_elevation(self, ox, oy, col_x, beam_top, p):
        """Add cross ties at 1000mm centres (Figure 4.2)."""
        cover = p.cover_mm
        num_ties = int((p.beam_depth - 2 * cover) / p.cross_tie_spacing_mm)
        s = self._s
        for i in range(1, num_ties + 1):
            ty = oy + s(cover) + i * s(p.cross_tie_spacing_mm)
            if ty < beam_top - s(cover):
                self.msp.add_line(
                    (ox, ty), (col_x, ty),
                    dxfattribs={"layer": "REBAR_SECONDARY"}
                )
                self.msp.add_line(
                    (col_x + self._s(p.col_width), ty),
                    (col_x + self._s(p.col_width) + self._s(p.span_right_mm), ty),
                    dxfattribs={"layer": "REBAR_SECONDARY"}
                )

    def generate_plan(self, origin: Tuple[float, float] = None):
        """
        Draw plan view of beam/column intersection.
        Section at beam level, looking down (Section 3.18, 3.16).
        """
        if origin is None:
            origin = self.origin_plan
        ox, oy = origin
        p = self.p
        s = self._s
        cover = p.cover_mm

        # Column section (shaded/hatched)
        col_x = ox + s(p.span_left_mm)
        col_rect = [
            (col_x, oy),
            (col_x + s(p.col_width), oy),
            (col_x + s(p.col_width), oy + s(p.col_depth)),
            (col_x, oy + s(p.col_depth)),
            (col_x, oy)
        ]
        self.msp.add_lwpolyline(col_rect, dxfattribs={"layer": "CONCRETE"})

        # Hatch column section
        hatch = self.msp.add_hatch(color=7, dxfattribs={"layer": "HATCHING"})
        hatch.paths.add_polyline_path(col_rect[:-1], is_closed=True)
        hatch.set_pattern_fill("ANSI31", scale=0.5)

        # Primary beam outline (plan)
        beam_left = ox
        beam_right = col_x + s(p.col_width) + s(p.span_right_mm)
        beam_bottom = oy + s(p.col_depth / 2 - p.beam_width / 2)
        beam_top_y = beam_bottom + s(p.beam_width)
        self.msp.add_lwpolyline([
            (beam_left, beam_bottom), (col_x, beam_bottom),
        ], dxfattribs={"layer": "CONCRETE"})
        self.msp.add_lwpolyline([
            (beam_left, beam_top_y), (col_x, beam_top_y),
        ], dxfattribs={"layer": "CONCRETE"})
        self.msp.add_lwpolyline([
            (col_x + s(p.col_width), beam_bottom),
            (beam_right, beam_bottom),
        ], dxfattribs={"layer": "CONCRETE"})
        self.msp.add_lwpolyline([
            (col_x + s(p.col_width), beam_top_y),
            (beam_right, beam_top_y),
        ], dxfattribs={"layer": "CONCRETE"})

        # Column bars (shown as filled circles — from below symbol per Figure 4.4)
        col_bar_positions = [
            (col_x + s(cover + p.link_dia + p.col_bar_dia / 2),
             oy + s(cover + p.link_dia + p.col_bar_dia / 2)),
            (col_x + s(p.col_width - cover - p.link_dia - p.col_bar_dia / 2),
             oy + s(cover + p.link_dia + p.col_bar_dia / 2)),
            (col_x + s(cover + p.link_dia + p.col_bar_dia / 2),
             oy + s(p.col_depth - cover - p.link_dia - p.col_bar_dia / 2)),
            (col_x + s(p.col_width - cover - p.link_dia - p.col_bar_dia / 2),
             oy + s(p.col_depth - cover - p.link_dia - p.col_bar_dia / 2)),
        ]
        r = s(p.col_bar_dia / 2)
        for cbx, cby in col_bar_positions:
            # Filled circle = column bar from below (Figure 4.4 convention)
            circle = self.msp.add_circle(
                (cbx, cby), r,
                dxfattribs={"layer": "REBAR_MAIN"}
            )
            # Filled dot: add small solid circle for "from below" symbol
            self.msp.add_circle(
                (cbx, cby), r * 0.4,
                dxfattribs={"layer": "REBAR_MAIN"}
            )

        # Links (returned leg visible in plan — Figure 4.4)
        link_rect_left = [
            (beam_left + s(cover), beam_bottom + s(cover)),
            (col_x - s(cover), beam_bottom + s(cover)),
            (col_x - s(cover), beam_top_y - s(cover)),
            (beam_left + s(cover), beam_top_y - s(cover)),
        ]
        self.msp.add_lwpolyline(
            link_rect_left + [link_rect_left[0]],
            dxfattribs={"layer": "REBAR_LINKS"}
        )

        # Note: "Returned leg of link" annotation (Figure 4.4)
        self.msp.add_text(
            "Returned leg of link",
            dxfattribs={"layer": "ANNOTATIONS", "height": s(15),
                        "insert": (beam_right + s(50), beam_top_y)}
        )
        self.msp.add_text(
            "Denotes column bars from below",
            dxfattribs={"layer": "ANNOTATIONS", "height": s(15),
                        "insert": (beam_right + s(50), beam_bottom - s(30))}
        )


# ─────────────────────────────────────────────────────────────────────────────
# 5. MAIN — Example generation
# ─────────────────────────────────────────────────────────────────────────────

def main():
    """
    Generate a beam/column intersection drawing using general detailing rules.
    Change parameters to produce different valid drawings.
    """
    # DEPENDENCY: cover_mm should come from General Detailing chapter (not yet extracted fully)
    # Using 30mm as a typical interior beam cover pending full cover rules extraction

    params = BeamColumnParams(
        col_width=400,
        col_depth=400,
        beam_width=300,
        beam_depth=600,
        secondary_beam_width=250,
        secondary_beam_depth=500,
        span_left_mm=4000,
        span_right_mm=4000,
        col_height_mm=3000,
        cover_mm=30,       # DEPENDENCY: General Detailing chapter
        main_bar_dia=25,
        link_dia=10,
        col_bar_dia=32,
        col_bar_count=4,
    )

    panel = DrawingPanelA(
        project_title="Beam/Column Intersection — General Detailing",
        drawing_number="001",
        revision="A",
        drawing_title="Internal B/C Intersection Elevation & Plan",
        scale="1:20",
        drawn_by="Generator",
        date="2026"
    )

    sheet = DrawingSheet(size="A1", scale=20, panel_data=panel)
    gen = BeamColumnIntersectionGenerator(params, sheet)

    # Generate elevation view
    gen.generate_elevation(origin=(30, 150))

    # Generate plan view below
    gen.generate_plan(origin=(30, 50))

    # Add view labels
    sheet.msp.add_text(
        "ELEVATION",
        dxfattribs={"layer": "ANNOTATIONS", "height": 5, "insert": (30, 145)}
    )
    sheet.msp.add_text(
        "PLAN AT BEAM LEVEL",
        dxfattribs={"layer": "ANNOTATIONS", "height": 5, "insert": (30, 45)}
    )

    output_path = "/mnt/user-data/outputs/beam_column_intersection.dxf"
    sheet.save(output_path)
    print(f"DXF saved to {output_path}")

    # Bar schedule example (BS 8666)
    schedule = BarSchedule(schedule_ref="001 01A", drawing_ref="001")
    schedule.add_bar(BarScheduleEntry(
        member="BEAM 1",
        bar_mark="1",
        type_size="H25",
        length_each_mm=5225,
        no_of_members=1,
        no_bars_in_each=4,
        shape_code=11,
        A_mm=400,
        revision="A"
    ))
    print("\nBar Schedule:")
    for row in schedule.to_rows():
        print(row)
    print(f"Total approximate weight: {schedule.total_weight_kg():.1f} kg")

    # Bar notation examples
    bar = parse_bar_notation("20H16-63-150B1")
    print(f"\nParsed: {bar}")
    print(f"Regenerated: {generate_bar_notation(bar)}")
    print(f"Max length for H16: {check_bar_max_length(16) / 1000}m")
    print(f"Max length for H10: {check_bar_max_length(10) / 1000}m")


if __name__ == "__main__":
    main()
