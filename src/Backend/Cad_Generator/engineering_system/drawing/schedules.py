"""
BS 8666 Bar Bending Schedule generation, tabular representation, and mass takeoff.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Any
from .dxf import DXFDocument
from ..core.reinforcement import BarAreaCalculator, BS8666Catalogue


@dataclass
class BarScheduleEntry:
    """A single row in a BS 8666 bar bending schedule."""
    member: str
    bar_mark: str
    type_size: str  # e.g., 'H16'
    length_each_mm: float
    no_of_members: int = 1
    no_bars_in_each: int = 1
    shape_code: str = "00"
    A_mm: float = 0.0
    B_mm: float = 0.0
    C_mm: float = 0.0
    D_mm: float = 0.0
    E_mm: float = 0.0
    r_mm: float = 0.0
    revision: str = "-"

    @property
    def total_no_bars(self) -> int:
        return self.no_of_members * self.no_bars_in_each

    @property
    def bar_diameter(self) -> int:
        # Extract integer digits from type_size (e.g. 'H25' -> 25)
        digits = "".join(c for c in self.type_size if c.isdigit())
        return int(digits) if digits else 16

    @property
    def total_weight_kg(self) -> float:
        dia = self.bar_diameter
        return BarAreaCalculator.total_weight_kg(dia, self.length_each_mm, self.total_no_bars)


class BarSchedule:
    """Manages a complete BS 8666 bar schedule for a drawing set."""

    def __init__(self, schedule_ref: str, drawing_ref: str):
        self.schedule_ref = schedule_ref
        self.drawing_ref = drawing_ref
        self.entries: List[BarScheduleEntry] = []

    def add_entry(self, entry: BarScheduleEntry) -> None:
        self.entries.append(entry)

    def total_weight_kg(self) -> float:
        return sum(e.total_weight_kg for e in self.entries)

    def weight_by_size(self) -> Dict[int, float]:
        weights: Dict[int, float] = {}
        for e in self.entries:
            dia = e.bar_diameter
            weights[dia] = weights.get(dia, 0.0) + e.total_weight_kg
        return weights

    def render_table(
        self,
        dxf: DXFDocument,
        top_left: Tuple[float, float],
        row_height: float = 8.0,
        text_height: float = 2.5,
        layer: str = "ANNOTATIONS",
    ) -> float:
        """
        Renders the schedule table onto the DXF document.
        Returns bottom Y coordinate of the table.
        """
        headers = [
            ("Member", 25.0),
            ("Mark", 15.0),
            ("Type/Size", 20.0),
            ("No. Mbr", 18.0),
            ("No. Each", 18.0),
            ("Total No", 18.0),
            ("Length", 20.0),
            ("Shape", 15.0),
            ("A", 15.0),
            ("B", 15.0),
            ("C", 15.0),
            ("D/E", 15.0),
            ("Rev", 12.0),
        ]
        total_w = sum(w for _, w in headers)
        ox, oy = top_left

        # Draw Title
        dxf.add_text(
            f"BAR BENDING SCHEDULE — REF: {self.schedule_ref} (DWG: {self.drawing_ref})",
            (ox, oy + 4.0),
            height=3.5,
            layer="BORDER_TITLE"
        )

        # Header box
        curr_x = ox
        y_top = oy
        y_bot = oy - row_height

        dxf.add_polyline([(ox, y_top), (ox + total_w, y_top), (ox + total_w, y_bot), (ox, y_bot), (ox, y_top)], layer="BORDER_TITLE")

        for title, width in headers:
            dxf.add_line((curr_x, y_top), (curr_x, y_bot), layer="BORDER_TITLE")
            dxf.add_text(title, (curr_x + 2.0, y_top - 5.5), height=text_height, layer="BORDER_TITLE")
            curr_x += width

        # Data rows
        curr_y = y_bot
        for e in self.entries:
            next_y = curr_y - row_height
            dxf.add_line((ox, next_y), (ox + total_w, next_y), layer="BORDER_TITLE")

            col_x = ox
            vals = [
                e.member,
                e.bar_mark,
                e.type_size,
                str(e.no_of_members),
                str(e.no_bars_in_each),
                str(e.total_no_bars),
                f"{int(round(e.length_each_mm))}",
                str(e.shape_code),
                f"{int(e.A_mm)}" if e.A_mm else "-",
                f"{int(e.B_mm)}" if e.B_mm else "-",
                f"{int(e.C_mm)}" if e.C_mm else "-",
                f"{int(e.D_mm)}" if e.D_mm else "-",
                e.revision,
            ]

            for val, (_, width) in zip(vals, headers):
                dxf.add_line((col_x, curr_y), (col_x, next_y), layer="BORDER_TITLE")
                dxf.add_text(val, (col_x + 2.0, curr_y - 5.5), height=text_height, layer=layer)
                col_x += width
            dxf.add_line((col_x, curr_y), (col_x, next_y), layer="BORDER_TITLE")
            curr_y = next_y

        # Summary row
        summary_y = curr_y - row_height
        dxf.add_polyline([(ox, curr_y), (ox + total_w, curr_y), (ox + total_w, summary_y), (ox, summary_y), (ox, curr_y)], layer="BORDER_TITLE")
        dxf.add_text(f"TOTAL ESTIMATED MASS: {self.total_weight_kg():.1f} kg", (ox + 5.0, curr_y - 5.5), height=3.0, layer="BORDER_TITLE")

        return summary_y
