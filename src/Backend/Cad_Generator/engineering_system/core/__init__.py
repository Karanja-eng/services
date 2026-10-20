"""
Core module providing engineering models, rule engines, geometry primitives,
reinforcement BS8666 calculations, relationships, and validation.
"""

from .model import (
    Member,
    Rebar,
    BarGroup,
    Support,
    Opening,
    Connection,
    Dimension,
    Annotation,
    View,
    Zone,
    DrawingSheet,
    DrawingPanel,
)
from .rules import RuleEngine, Rule, Constraint, FactType
from .geometry import Point2D, Vector2D, Polyline, BoundingBox
from .reinforcement import (
    BS8666Catalogue,
    TableB1,
    BarAreaCalculator,
    AnchorageCalculator,
    LapCalculator,
    CoverCalculator,
)
from .relationships import LayerHierarchy, MemberConnectivity
from .validation import ValidationEngine

__all__ = [
    "Member",
    "Rebar",
    "BarGroup",
    "Support",
    "Opening",
    "Connection",
    "Dimension",
    "Annotation",
    "View",
    "Zone",
    "DrawingSheet",
    "DrawingPanel",
    "RuleEngine",
    "Rule",
    "Constraint",
    "FactType",
    "Point2D",
    "Vector2D",
    "Polyline",
    "BoundingBox",
    "BS8666Catalogue",
    "TableB1",
    "BarAreaCalculator",
    "AnchorageCalculator",
    "LapCalculator",
    "CoverCalculator",
    "LayerHierarchy",
    "MemberConnectivity",
    "ValidationEngine",
]
