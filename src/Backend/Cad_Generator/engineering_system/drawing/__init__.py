"""
Drawing subsystem providing DXF generation, IStructE drawing standards,
dimensioning, annotations, bar callouts, and BS 8666 bar schedules.
"""

from .dxf import DXFDocument
from .standards import STANDARD_LAYERS, RECOMMENDED_SCALES, STANDARD_TEXT_HEIGHTS_MM, SHEET_DIMENSIONS_MM
from .dimensions import DimensionRenderer
from .annotations import BarNotationParser, AnnotationRenderer
from .schedules import BarSchedule, BarScheduleEntry

__all__ = [
    "DXFDocument",
    "STANDARD_LAYERS",
    "RECOMMENDED_SCALES",
    "STANDARD_TEXT_HEIGHTS_MM",
    "SHEET_DIMENSIONS_MM",
    "DimensionRenderer",
    "BarNotationParser",
    "AnnotationRenderer",
    "BarSchedule",
    "BarScheduleEntry",
]
