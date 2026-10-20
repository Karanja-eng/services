"""
DXF Document Generation and Layer Management using ezdxf.
Ensures standardized CAD layer creation, line styles, and safe file saving.
"""

import os
from typing import Tuple, List, Optional, Dict, Any
import ezdxf
from ezdxf.document import Drawing
from .standards import STANDARD_LAYERS


class DXFDocument:
    """Wrapper managing an ezdxf drawing with standard IStructE detailing layers."""

    def __init__(self, dxfversion: str = "R2010"):
        self.doc: Drawing = ezdxf.new(dxfversion=dxfversion)
        self.msp = self.doc.modelspace()
        self._setup_layers()

    def _setup_layers(self) -> None:
        """Register all standard detailing layers."""
        for name, spec in STANDARD_LAYERS.items():
            if name not in self.doc.layers:
                layer = self.doc.layers.add(
                    name=name,
                    color=spec["color"],
                    linetype=spec["linetype"]
                )
                # Set lineweight if supported
                if "lineweight" in spec:
                    layer.dxf.lineweight = int(spec["lineweight"] * 100)

    def add_line(
        self,
        start: Tuple[float, float],
        end: Tuple[float, float],
        layer: str = "CONCRETE",
        linetype: Optional[str] = None,
        color: Optional[int] = None,
    ):
        attribs = {"layer": layer}
        if linetype:
            attribs["linetype"] = linetype
        if color is not None:
            attribs["color"] = color
        return self.msp.add_line(start, end, dxfattribs=attribs)

    def add_polyline(
        self,
        points: List[Tuple[float, float]],
        layer: str = "CONCRETE",
        is_closed: bool = False,
        linetype: Optional[str] = None,
        color: Optional[int] = None,
    ):
        attribs = {"layer": layer}
        if linetype:
            attribs["linetype"] = linetype
        if color is not None:
            attribs["color"] = color
        return self.msp.add_lwpolyline(points, close=is_closed, dxfattribs=attribs)

    def add_circle(
        self,
        center: Tuple[float, float],
        radius: float,
        layer: str = "REBAR_MAIN",
        color: Optional[int] = None,
    ):
        attribs = {"layer": layer}
        if color is not None:
            attribs["color"] = color
        return self.msp.add_circle(center, radius, dxfattribs=attribs)

    def add_arc(
        self,
        center: Tuple[float, float],
        radius: float,
        start_angle: float,
        end_angle: float,
        layer: str = "REBAR_MAIN",
    ):
        return self.msp.add_arc(
            center,
            radius,
            start_angle,
            end_angle,
            dxfattribs={"layer": layer}
        )

    def add_text(
        self,
        text: str,
        insert: Tuple[float, float],
        height: float = 3.5,
        layer: str = "ANNOTATIONS",
        rotation: float = 0.0,
        align: str = "LEFT",
    ):
        attribs = {
            "layer": layer,
            "height": height,
            "rotation": rotation,
        }
        t = self.msp.add_text(text, dxfattribs=attribs)
        t.set_placement(insert)
        return t

    def add_hatch(
        self,
        boundary_points: List[Tuple[float, float]],
        pattern: str = "ANSI31",
        scale: float = 0.5,
        layer: str = "HATCH",
        color: int = 8,
    ):
        hatch = self.msp.add_hatch(dxfattribs={"layer": layer, "color": color})
        hatch.paths.add_polyline_path(boundary_points, is_closed=True)
        hatch.set_pattern_fill(pattern, scale=scale)
        return hatch

    def save(self, filepath: str) -> None:
        """Safely save drawing to disk, creating parent folders if needed."""
        dir_name = os.path.dirname(filepath)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)
        self.doc.saveas(filepath)
