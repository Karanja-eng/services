"""
structural_steel_bim/primitives/drawing_primitives.py

2D and 3D geometric primitives for rendering in Konva (2D) and Three.js (3D).
No rendering logic - pure data structures for serialization to frontend.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import numpy as np

from .geometry import Point3D, Line3D


class PrimitiveType(Enum):
    """Rendering primitive types."""
    # 2D Primitives (Konva)
    LINE_2D = "Line2D"
    RECTANGLE_2D = "Rectangle2D"
    CIRCLE_2D = "Circle2D"
    POLYGON_2D = "Polygon2D"
    TEXT_2D = "Text2D"
    DIMENSION_2D = "Dimension2D"
    
    # 3D Primitives (Three.js)
    LINE_3D = "Line3D"
    MESH_3D = "Mesh3D"
    CYLINDER_3D = "Cylinder3D"
    BOX_3D = "Box3D"
    TUBE_3D = "Tube3D"


@dataclass
class DrawingStyle:
    """Styling properties for drawing primitives."""
    stroke_color: str = "#000000"
    stroke_width: float = 1.0
    fill_color: Optional[str] = None
    opacity: float = 1.0
    line_dash: Optional[List[float]] = None  # [dash_length, gap_length]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'stroke': self.stroke_color,
            'strokeWidth': self.stroke_width,
            'fill': self.fill_color,
            'opacity': self.opacity,
            'dash': self.line_dash
        }


# =============================================================================
# 2D PRIMITIVES (for React Konva)
# =============================================================================

@dataclass
class Line2D:
    """2D line segment for Konva rendering."""
    start_x: float
    start_y: float
    end_x: float
    end_y: float
    style: DrawingStyle = field(default_factory=DrawingStyle)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.LINE_2D.value,
            'points': [self.start_x, self.start_y, self.end_x, self.end_y],
            'style': self.style.to_dict()
        }


@dataclass
class Rectangle2D:
    """2D rectangle for Konva rendering."""
    x: float  # Top-left corner
    y: float
    width: float
    height: float
    rotation: float = 0.0  # degrees
    style: DrawingStyle = field(default_factory=DrawingStyle)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.RECTANGLE_2D.value,
            'x': self.x,
            'y': self.y,
            'width': self.width,
            'height': self.height,
            'rotation': self.rotation,
            'style': self.style.to_dict()
        }


@dataclass
class Circle2D:
    """2D circle for Konva rendering."""
    x: float  # Center
    y: float
    radius: float
    style: DrawingStyle = field(default_factory=DrawingStyle)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.CIRCLE_2D.value,
            'x': self.x,
            'y': self.y,
            'radius': self.radius,
            'style': self.style.to_dict()
        }


@dataclass
class Polygon2D:
    """2D polygon for Konva rendering."""
    points: List[Tuple[float, float]]  # List of (x, y) coordinates
    closed: bool = True
    style: DrawingStyle = field(default_factory=DrawingStyle)
    
    def to_dict(self) -> Dict[str, Any]:
        # Flatten points list for Konva format
        flat_points = [coord for point in self.points for coord in point]
        return {
            'type': PrimitiveType.POLYGON_2D.value,
            'points': flat_points,
            'closed': self.closed,
            'style': self.style.to_dict()
        }


@dataclass
class Text2D:
    """2D text annotation for Konva rendering."""
    x: float
    y: float
    text: str
    font_size: float = 12.0
    font_family: str = "Arial"
    color: str = "#000000"
    rotation: float = 0.0
    align: str = "left"  # left, center, right
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.TEXT_2D.value,
            'x': self.x,
            'y': self.y,
            'text': self.text,
            'fontSize': self.font_size,
            'fontFamily': self.font_family,
            'fill': self.color,
            'rotation': self.rotation,
            'align': self.align
        }


@dataclass
class Dimension2D:
    """2D dimension line with text."""
    start_x: float
    start_y: float
    end_x: float
    end_y: float
    dimension_text: str
    offset: float = 20.0  # Offset from dimensioned line
    arrow_size: float = 8.0
    style: DrawingStyle = field(default_factory=DrawingStyle)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.DIMENSION_2D.value,
            'start': [self.start_x, self.start_y],
            'end': [self.end_x, self.end_y],
            'text': self.dimension_text,
            'offset': self.offset,
            'arrowSize': self.arrow_size,
            'style': self.style.to_dict()
        }


# =============================================================================
# 3D PRIMITIVES (for React Three Fiber / Three.js)
# =============================================================================

@dataclass
class Line3D:
    """3D line for Three.js rendering."""
    points: List[Point3D]
    color: str = "#000000"
    line_width: float = 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.LINE_3D.value,
            'points': [{'x': p.x, 'y': p.y, 'z': p.z} for p in self.points],
            'color': self.color,
            'lineWidth': self.line_width
        }


@dataclass
class Box3D:
    """3D box for Three.js rendering (for rectangular sections)."""
    center: Point3D
    width: float  # X dimension
    height: float  # Y dimension
    depth: float  # Z dimension
    rotation: Tuple[float, float, float] = (0.0, 0.0, 0.0)  # Euler angles (radians)
    color: str = "#808080"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.BOX_3D.value,
            'position': {'x': self.center.x, 'y': self.center.y, 'z': self.center.z},
            'dimensions': {'width': self.width, 'height': self.height, 'depth': self.depth},
            'rotation': {'x': self.rotation[0], 'y': self.rotation[1], 'z': self.rotation[2]},
            'color': self.color
        }


@dataclass
class Cylinder3D:
    """3D cylinder for Three.js rendering (for circular sections, bolts)."""
    start: Point3D
    end: Point3D
    radius: float
    color: str = "#808080"
    radial_segments: int = 16
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.CYLINDER_3D.value,
            'start': {'x': self.start.x, 'y': self.start.y, 'z': self.start.z},
            'end': {'x': self.end.x, 'y': self.end.y, 'z': self.end.z},
            'radius': self.radius,
            'color': self.color,
            'radialSegments': self.radial_segments
        }


@dataclass
class Tube3D:
    """3D tube/pipe for Three.js rendering (for hollow sections)."""
    start: Point3D
    end: Point3D
    outer_radius: float
    inner_radius: float
    color: str = "#808080"
    radial_segments: int = 16
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.TUBE_3D.value,
            'start': {'x': self.start.x, 'y': self.start.y, 'z': self.start.z},
            'end': {'x': self.end.x, 'y': self.end.y, 'z': self.end.z},
            'outerRadius': self.outer_radius,
            'innerRadius': self.inner_radius,
            'color': self.color,
            'radialSegments': self.radial_segments
        }


@dataclass
class Mesh3D:
    """Custom 3D mesh defined by vertices and faces for Three.js."""
    vertices: List[Point3D]  # Vertex positions
    faces: List[Tuple[int, int, int]]  # Triangle faces (vertex indices)
    color: str = "#808080"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': PrimitiveType.MESH_3D.value,
            'vertices': [{'x': v.x, 'y': v.y, 'z': v.z} for v in self.vertices],
            'faces': [[f[0], f[1], f[2]] for f in self.faces],
            'color': self.color
        }


# =============================================================================
# MEMBER VISUALIZATION CONVERTERS
# =============================================================================

class MemberVisualization:
    """Convert structural members to rendering primitives."""
    
    @staticmethod
    def member_to_3d_primitives(member) -> List[Dict[str, Any]]:
        """
        Convert a Member object to 3D rendering primitives.
        Returns list of primitive dictionaries for Three.js rendering.
        """
        from ..sections.section_properties import SectionType
        
        primitives = []
        section = member.section
        centerline = member.centerline
        
        # Color coding by member type
        color_map = {
            'Truss Chord': '#4A90E2',
            'Truss Web Member': '#50E3C2',
            'Column': '#E24A4A',
            'Beam': '#F5A623',
            'Bracing': '#7ED321',
            'Lattice Tower Leg': '#BD10E0',
            'Lattice Tower Bracing': '#9013FE'
        }
        color = color_map.get(member.member_type.value, '#808080')
        
        # Generate appropriate primitive based on section type
        if section.section_type in [SectionType.CHS]:
            # Circular hollow section - use tube
            radius_outer = section.diameter / 2
            radius_inner = radius_outer - section.web_thickness
            
            primitive = Tube3D(
                start=centerline.start,
                end=centerline.end,
                outer_radius=radius_outer,
                inner_radius=radius_inner,
                color=color
            )
            primitives.append(primitive.to_dict())
            
        elif section.section_type in [SectionType.RHS, SectionType.SHS]:
            # Rectangular/square hollow section - use box
            # Simplified: solid box (actual rendering should show hollow)
            center = centerline.midpoint()
            
            primitive = Box3D(
                center=center,
                width=section.width,
                height=section.depth,
                depth=centerline.length(),
                color=color
            )
            primitives.append(primitive.to_dict())
            
        else:
            # I-sections, angles, channels - use simplified line or box
            # For basic visualization, use thick line
            primitive_line = Line3D(
                points=[centerline.start, centerline.end],
                color=color,
                line_width=3.0
            )
            primitives.append(primitive_line.to_dict())
            
            # Or use box representation at centerline
            center = centerline.midpoint()
            primitive_box = Box3D(
                center=center,
                width=max(section.width, 20),
                height=max(section.depth, 20),
                depth=centerline.length(),
                color=color
            )
            primitives.append(primitive_box.to_dict())
        
        return primitives
    
    @staticmethod
    def member_to_2d_elevation(member, view_direction: str = 'front') -> List[Dict[str, Any]]:
        """
        Convert member to 2D elevation view primitives for Konva.
        view_direction: 'front', 'side', 'plan'
        """
        primitives = []
        section = member.section
        centerline = member.centerline
        
        # Project 3D centerline to 2D based on view
        if view_direction == 'front':
            # Looking along Y axis (X-Z plane)
            start_2d = (centerline.start.x, centerline.start.z)
            end_2d = (centerline.end.x, centerline.end.z)
            section_width = section.width
            section_depth = section.depth
        elif view_direction == 'side':
            # Looking along X axis (Y-Z plane)
            start_2d = (centerline.start.y, centerline.start.z)
            end_2d = (centerline.end.y, centerline.end.z)
            section_width = section.depth
            section_depth = section.width
        else:  # plan
            # Looking down (X-Y plane)
            start_2d = (centerline.start.x, centerline.start.y)
            end_2d = (centerline.end.x, centerline.end.y)
            section_width = section.width
            section_depth = section.depth
        
        # Draw member centerline
        style = DrawingStyle(stroke_color="#000000", stroke_width=2.0)
        line = Line2D(
            start_x=start_2d[0],
            start_y=start_2d[1],
            end_x=end_2d[0],
            end_y=end_2d[1],
            style=style
        )
        primitives.append(line.to_dict())
        
        # Add section outline at ends (simplified)
        # Could be expanded to show actual section shape
        
        return primitives