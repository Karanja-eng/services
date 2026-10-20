"""
Common Engineering Object Model for Concrete Detailing.
Defines foundational dataclasses for structural members, reinforcement,
geometry, supports, openings, connections, views, zones, and drawing elements.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from enum import Enum


class MemberType(str, Enum):
    SLAB = "SLAB"
    BEAM = "BEAM"
    COLUMN = "COLUMN"
    WALL = "WALL"
    FOUNDATION = "FOUNDATION"
    CORBEL = "CORBEL"
    HALF_JOINT = "HALF_JOINT"
    NIB = "NIB"
    STAIR = "STAIR"
    SPECIAL = "SPECIAL"


class LayerType(str, Enum):
    # IStructE Standard Detailing Layer Notation
    B1 = "B1"  # Bottom outer layer
    B2 = "B2"  # Bottom second layer
    T1 = "T1"  # Top outer layer
    T2 = "T2"  # Top second layer
    F1 = "F1"  # Far face outer
    F2 = "F2"  # Far face second
    N1 = "N1"  # Near face outer
    N2 = "N2"  # Near face second
    SIDE = "SIDE"  # Beam side face
    LINK = "LINK"  # Transverse link/stirrup
    INTERNAL = "INTERNAL"


class SupportType(str, Enum):
    COLUMN = "COLUMN"
    WALL = "WALL"
    BEAM = "BEAM"
    CORBEL = "CORBEL"
    FOUNDATION = "FOUNDATION"
    BEARING_PAD = "BEARING_PAD"
    FREE = "FREE"


@dataclass
class Rebar:
    """Represents an individual reinforcing bar or bar specification."""
    bar_mark: str
    shape_code: str  # BS 8666 shape code (e.g., '00', '11', '21', '51', etc.)
    bar_size: int  # Diameter in mm (e.g. 10, 12, 16, 20, 25, 32, 40)
    dimensions: Dict[str, float] = field(default_factory=dict)  # A, B, C, D, E, r
    grade: str = "H"  # H (500 MPa), B (stainless), etc.
    length_mm: float = 0.0
    layer: Optional[LayerType] = None
    weight_kg: float = 0.0
    comment: str = ""

    def formatted_callout(self, count: int = 1, pitch: Optional[float] = None) -> str:
        """Generate standard IStructE bar callout string."""
        s = f"{count}{self.grade}{self.bar_size}-{self.bar_mark}"
        if pitch is not None and pitch > 0:
            s += f"-{int(round(pitch))}"
        if self.layer:
            s += f" {self.layer.value}"
        return s


@dataclass
class BarGroup:
    """A group of identical rebars placed at a pitch or uniform spacing."""
    group_id: str
    rebar: Rebar
    count: int
    pitch_mm: Optional[float] = None
    start_pos: Tuple[float, float] = (0.0, 0.0)
    end_pos: Tuple[float, float] = (0.0, 0.0)
    direction: Tuple[float, float] = (1.0, 0.0)  # Unit vector of run
    layer: Optional[LayerType] = None
    zone_ref: Optional[str] = None
    bar_positions: List[Tuple[float, float]] = field(default_factory=list)

    @property
    def total_weight_kg(self) -> float:
        return self.count * self.rebar.weight_kg


@dataclass
class Zone:
    """A designated structural or reinforcement zone."""
    zone_id: str
    zone_type: str  # e.g., 'SPAN', 'SUPPORT', 'LINK_DENSE', 'COLUMN_STRIP', 'MIDDLE_STRIP'
    start_x: float
    end_x: float
    start_y: float = 0.0
    end_y: float = 0.0
    description: str = ""
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Support:
    """Represents a support condition for a member."""
    support_id: str
    support_type: SupportType
    x_pos: float
    y_pos: float
    width_mm: float
    depth_mm: float = 0.0
    is_direct: bool = True  # Direct support (e.g. column/wall) vs indirect (beam-on-beam)
    bearing_pad_thickness: float = 0.0


@dataclass
class Opening:
    """An opening or penetration through a structural element."""
    opening_id: str
    x_pos: float
    y_pos: float
    width_mm: float
    height_mm: float
    shape: str = "RECTANGULAR"  # 'RECTANGULAR', 'CIRCULAR'
    requires_trimming: bool = True
    trimmer_bars: List[Rebar] = field(default_factory=list)


@dataclass
class Connection:
    """Represents a joint or connection between structural members."""
    connection_id: str
    connection_type: str  # 'BEAM_COLUMN', 'SLAB_BEAM', 'CORBEL_COLUMN', 'HALF_JOINT'
    primary_member_id: str
    secondary_member_id: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Dimension:
    """A 2D dimension entity for drawing generation."""
    dim_id: str
    start_point: Tuple[float, float]
    end_point: Tuple[float, float]
    dimension_line_offset: float  # Perpendicular offset from points
    text: Optional[str] = None  # If None, computed as distance
    layer: str = "DIMENSIONS"
    orientation: str = "ALIGNED"  # 'HORIZONTAL', 'VERTICAL', 'ALIGNED'


@dataclass
class Annotation:
    """A textual or symbolic annotation in a drawing."""
    annotation_id: str
    text: str
    position: Tuple[float, float]
    leader_start: Optional[Tuple[float, float]] = None
    annotation_type: str = "TEXT"  # 'TEXT', 'BAR_CALLOUT', 'SECTION_MARK', 'WELD', 'TITLE'
    layer: str = "ANNOTATIONS"
    height_mm: float = 3.5


@dataclass
class View:
    """Represents a projection view (Plan, Elevation, Section, Detail)."""
    view_id: str
    title: str
    view_type: str  # 'ELEVATION', 'PLAN', 'SECTION', 'DETAIL'
    scale: float  # e.g., 20 for 1:20
    origin: Tuple[float, float] = (0.0, 0.0)
    dimensions: List[Dimension] = field(default_factory=list)
    annotations: List[Annotation] = field(default_factory=list)
    geometry_entities: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class Member:
    """Top-level structural member engineering representation."""
    member_id: str
    member_type: MemberType
    name: str
    concrete_grade: str = "C30/37"
    cover_nominal_mm: float = 30.0
    dimensions: Dict[str, float] = field(default_factory=dict)  # length, width, depth, etc.
    bar_groups: List[BarGroup] = field(default_factory=list)
    supports: List[Support] = field(default_factory=list)
    openings: List[Opening] = field(default_factory=list)
    connections: List[Connection] = field(default_factory=list)
    zones: List[Zone] = field(default_factory=list)
    views: List[View] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def total_steel_weight(self) -> float:
        """Compute total mass of all reinforcing steel in kilograms."""
        return sum(bg.total_weight_kg for bg in self.bar_groups)


@dataclass
class DrawingPanel:
    """IStructE Standard Title Panel A metadata."""
    project_title: str
    drawing_number: str
    revision: str
    drawing_title: str
    scale: str
    drawn_by: str = "CAD Generator"
    checked_by: str = ""
    date: str = "2026"
    status: str = "FOR INFORMATION"


@dataclass
class DrawingSheet:
    """Represents a complete drawing layout (A0, A1, A2, A3, A4)."""
    size: str = "A1"
    width_mm: float = 841.0
    height_mm: float = 594.0
    scale: float = 20.0
    panel: Optional[DrawingPanel] = None
    views: List[View] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        sizes = {
            "A0": (1189.0, 841.0),
            "A1": (841.0, 594.0),
            "A2": (594.0, 420.0),
            "A3": (420.0, 297.0),
            "A4": (297.0, 210.0),
        }
        if self.size in sizes:
            self.width_mm, self.height_mm = sizes[self.size]
