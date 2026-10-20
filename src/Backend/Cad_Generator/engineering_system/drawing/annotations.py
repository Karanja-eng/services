"""
Drawing Annotations, Bar Callouts, Leaders, Title Panel A, and Section Markers.
"""

import re
import math
from typing import Tuple, Optional, Dict, Any, List
from .dxf import DXFDocument
from ..core.model import DrawingPanel


class BarNotationParser:
    """Parses and generates standard IStructE bar notation strings."""

    TAGS = ["AP", "AS", "EF", "TEF", "UB", "P.A.S", "SPACERS", "CLOSERS"]

    @staticmethod
    def parse(notation: str) -> Dict[str, Any]:
        """
        Parses notations like:
        - '20H16-63-150B1'
        - '20H10-63-150T1 (12) (8)' (subcounts)
        - '4H25-01-T1'
        - '2H20 02 UB' (U-bar)
        - '2H12 09 TEF' (Top Each Face)
        - '4 H25 10 SPACERS' (Spacer bars)
        - '37 H12 07 LINKS P.A.S'
        """
        raw = notation.strip()

        # Extract zone subcounts in brackets e.g. (12) (8)
        bracket_pattern = r"\(([\d\s]+)\)"
        subcounts = [int(x.strip()) for x in re.findall(bracket_pattern, raw) if x.strip().isdigit()]
        text_without_brackets = re.sub(bracket_pattern, "", raw).strip()

        # Extract tags (AP, AS, EF, TEF, UB, etc.)
        detected_tags = []
        clean_text = text_without_brackets
        for tag in BarNotationParser.TAGS:
            if re.search(r"\b" + re.escape(tag) + r"\b", clean_text, re.IGNORECASE):
                detected_tags.append(tag)
                clean_text = re.sub(r"\b" + re.escape(tag) + r"\b", "", clean_text, flags=re.IGNORECASE).strip()

        # Normalize remaining string for standard pattern: e.g. 20H16-63-150B1 or 4 H25 01
        # Convert spaced form '4 H25 01' to '4H25-01'
        norm = re.sub(r"(\d+)\s+([A-Z])(\d+)\s+(\w+)", r"\1\2\3-\4", clean_text)
        norm = norm.replace(" ", "")

        # Pattern: count, grade, size, mark, pitch (opt), layer (opt)
        pattern = r"^(\d+)([A-Z])(\d+)-(\w+)(?:-(\d+))?(.*)$"
        m = re.match(pattern, norm)
        if not m:
            # Fallback simple pattern
            m2 = re.match(r"^(\d+)([A-Z])(\d+)", norm)
            if m2:
                res = {
                    "count": int(m2.group(1)),
                    "grade": m2.group(2),
                    "size": int(m2.group(3)),
                    "mark": "1",
                    "pitch": None,
                    "layer": "",
                    "tags": detected_tags,
                    "subcounts": subcounts,
                }
                return res
            return {"raw": notation, "tags": detected_tags, "subcounts": subcounts}

        count = int(m.group(1))
        grade = m.group(2)
        size = int(m.group(3))
        mark = m.group(4)
        pitch = int(m.group(5)) if m.group(5) else None
        layer = m.group(6).lstrip("-").strip() if m.group(6) else ""

        return {
            "count": count,
            "grade": grade,
            "size": size,
            "mark": mark,
            "pitch": pitch,
            "layer": layer,
            "tags": detected_tags,
            "subcounts": subcounts,
        }

    @staticmethod
    def format_callout(
        count: int,
        grade: str,
        size: int,
        mark: str,
        pitch: Optional[int] = None,
        layer: Optional[str] = None,
        subcounts: Optional[List[int]] = None,
        tag: Optional[str] = None,
    ) -> str:
        s = f"{count}{grade}{size}-{mark}"
        if pitch is not None and pitch > 0:
            s += f"-{pitch}"
        if layer:
            s += f" {layer}"
        if tag:
            s += f" {tag}"
        if subcounts:
            s += " " + " ".join(f"({sc})" for sc in subcounts)
        return s

    @staticmethod
    def parse_link_zones(link_elevation_str: str) -> List[Dict[str, int]]:
        """
        Parses multi-zone link notation (Section 6.3.4, page 79; Rule I3):
        e.g. '19/300   5/200   13/150' -> [{'count': 19, 'pitch': 300}, ...]
        """
        zones = []
        matches = re.findall(r"(\d+)/(\d+)", link_elevation_str)
        for count_str, pitch_str in matches:
            zones.append({"count": int(count_str), "pitch": int(pitch_str)})
        return zones

    @staticmethod
    def format_link_elevation_notation(zones: List[Tuple[int, int]]) -> str:
        """Formats list of (count, pitch) tuples into '19/300   5/200   13/150'."""
        return "   ".join(f"{cnt}/{pitch}" for cnt, pitch in zones)

    @staticmethod
    def format_spacer_callout(count: int, size: int, mark: str) -> str:
        """Formats beam spacer bar callout (Section 6.3.4, page 79; Rule I5): '4 H25 10 SPACERS'."""
        return f"{count} H{size} {mark} SPACERS"



class AnnotationRenderer:
    """Renders textual annotations, leaders, and markers."""

    @staticmethod
    def add_rebar_callout(
        dxf: DXFDocument,
        callout_text: str,
        bar_point: Tuple[float, float],
        text_pos: Tuple[float, float],
        has_dot: bool = True,
        layer: str = "ANNOTATIONS",
        height: float = 3.5,
    ) -> None:
        """Draws a leader line from bar_point to text_pos with dot and text."""
        bx, by = bar_point
        tx, ty = text_pos

        # Leader line
        dxf.add_line(bar_point, text_pos, layer=layer)

        # Dot at bar contact point
        if has_dot:
            dxf.add_circle(bar_point, radius=2.0, layer="REBAR_MAIN")

        # Horizontal landing line
        landing_length = max(20.0, len(callout_text) * height * 0.7)
        landing_end = (tx + landing_length, ty)
        dxf.add_line(text_pos, landing_end, layer=layer)

        # Text placed slightly above horizontal landing line
        dxf.add_text(callout_text, (tx + 2.0, ty + 1.5), height=height, layer=layer)

    @staticmethod
    def add_title_panel_a(
        dxf: DXFDocument,
        panel: DrawingPanel,
        sheet_width: float,
        sheet_height: float,
        margin: float = 20.0,
    ) -> None:
        """
        Draws standard IStructE Title Panel A in bottom-right corner of sheet.
        Panel width = 180mm, height = 75mm.
        """
        panel_w = 180.0
        panel_h = 75.0

        ox = sheet_width - margin - panel_w
        oy = margin

        # Outer border
        dxf.add_polyline([
            (ox, oy), (ox + panel_w, oy),
            (ox + panel_w, oy + panel_h), (ox, oy + panel_h), (ox, oy)
        ], layer="BORDER_TITLE")

        # Horizontal dividers
        dxf.add_line((ox, oy + 45.0), (ox + panel_w, oy + 45.0), layer="BORDER_TITLE")
        dxf.add_line((ox, oy + 25.0), (ox + panel_w, oy + 25.0), layer="BORDER_TITLE")

        # Text fields
        dxf.add_text(f"PROJECT: {panel.project_title}", (ox + 5.0, oy + 65.0), height=3.5, layer="BORDER_TITLE")
        dxf.add_text(f"TITLE:   {panel.drawing_title}", (ox + 5.0, oy + 52.0), height=3.5, layer="BORDER_TITLE")
        dxf.add_text(f"DWG NO:  {panel.drawing_number}  REV: {panel.revision}", (ox + 5.0, oy + 32.0), height=4.0, layer="BORDER_TITLE")
        dxf.add_text(f"SCALE: {panel.scale}   DATE: {panel.date}   BY: {panel.drawn_by}", (ox + 5.0, oy + 10.0), height=2.5, layer="BORDER_TITLE")

    @staticmethod
    def add_section_cut(
        dxf: DXFDocument,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        section_label: str = "A",
        layer: str = "SECTION",
        arrow_size: float = 10.0,
    ) -> None:
        """Draws section cut line with directional arrows and label bubbles."""
        dxf.add_line(p1, p2, layer=layer, linetype="DASHDOT")

        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.hypot(dx, dy)
        if length == 0:
            return

        # Direction perp to cut
        nx = -dy / length
        ny = dx / length

        for pt in [p1, p2]:
            tip = (pt[0] + nx * arrow_size, pt[1] + ny * arrow_size)
            dxf.add_line(pt, tip, layer=layer)
            bubble_center = (tip[0] + nx * 5.0, tip[1] + ny * 5.0)
            dxf.add_circle(bubble_center, radius=5.0, layer=layer)
            dxf.add_text(section_label, (bubble_center[0] - 2.0, bubble_center[1] - 2.0), height=4.0, layer=layer)
