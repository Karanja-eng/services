"""
Standard Structural Detailing Dimensioning.
Draws dimension lines, extension (witness) lines, 45-degree ticks, and text values.
"""

import math
from typing import Tuple, Optional
from .dxf import DXFDocument


class DimensionRenderer:
    """Draws standard IStructE structural dimensions."""

    @staticmethod
    def add_dimension(
        dxf: DXFDocument,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        offset: float,
        text: Optional[str] = None,
        layer: str = "DIMENSIONS",
        tick_size: float = 5.0,
        text_height: float = 2.5,
    ) -> None:
        """
        Draw an aligned/orthogonal dimension between p1 and p2,
        offset perpendicularly by `offset` units.
        """
        x1, y1 = p1
        x2, y2 = p2

        dx = x2 - x1
        dy = y2 - y1
        length = math.hypot(dx, dy)
        if length < 1e-4:
            return

        # Unit vector along points
        ux = dx / length
        uy = dy / length

        # Perpendicular normal vector
        nx = -uy
        ny = ux

        # Dimension line points
        dp1 = (x1 + nx * offset, y1 + ny * offset)
        dp2 = (x2 + nx * offset, y2 + ny * offset)

        # Extension/witness lines (from source with 2mm gap to 2mm beyond dim line)
        gap = 2.0 * (1.0 if offset >= 0 else -1.0)
        ext = 3.0 * (1.0 if offset >= 0 else -1.0)
        wp1_start = (x1 + nx * gap, y1 + ny * gap)
        wp1_end = (dp1[0] + nx * ext, dp1[1] + ny * ext)
        wp2_start = (x2 + nx * gap, y2 + ny * gap)
        wp2_end = (dp2[0] + nx * ext, dp2[1] + ny * ext)

        dxf.add_line(wp1_start, wp1_end, layer=layer)
        dxf.add_line(wp2_start, wp2_end, layer=layer)

        # Main dimension line
        dxf.add_line(dp1, dp2, layer=layer)

        # 45-degree ticks at dim line ends
        tick_offset = tick_size * 0.7071
        for px, py in [dp1, dp2]:
            t_start = (px - tick_offset, py - tick_offset)
            t_end = (px + tick_offset, py + tick_offset)
            dxf.add_line(t_start, t_end, layer=layer)

        # Dimension text
        dim_value = f"{int(round(length))}" if text is None else text
        mid_x = (dp1[0] + dp2[0]) / 2.0 + nx * (text_height * 0.8)
        mid_y = (dp1[1] + dp2[1]) / 2.0 + ny * (text_height * 0.8)

        # Rotation in degrees
        angle = math.degrees(math.atan2(dy, dx))
        if angle > 90.0:
            angle -= 180.0
        elif angle < -90.0:
            angle += 180.0

        dxf.add_text(dim_value, (mid_x, mid_y), height=text_height, layer=layer, rotation=angle)

    # ------------------------------------------------------------------
    # Convenience aliases used by wall.py, foundation.py, stair.py
    # ------------------------------------------------------------------

    @staticmethod
    def render_aligned_dimension(
        dxf: DXFDocument,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        offset: float,
        text: Optional[str] = None,
        layer: str = "DIMENSIONS",
    ) -> None:
        """Alias: aligned (or vertical) dimension.  Delegates to add_dimension."""
        DimensionRenderer.add_dimension(dxf, p1, p2, offset, text=text, layer=layer)

    @staticmethod
    def render_linear_dimension_h(
        dxf: DXFDocument,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        offset: float,
        text: Optional[str] = None,
        layer: str = "DIMENSIONS",
    ) -> None:
        """Alias: horizontal linear dimension.  Delegates to add_dimension."""
        DimensionRenderer.add_dimension(dxf, p1, p2, offset, text=text, layer=layer)
