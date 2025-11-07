# backend/geometry.py - COMPLETE GEOMETRY UTILITIES
"""
Advanced geometry utilities for AutoCAD Clone
All mathematical operations for 2D/3D CAD
"""

import math
import numpy as np
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float
    z: float = 0.0

@dataclass
class Line:
    start: Point
    end: Point

@dataclass
class Circle:
    center: Point
    radius: float

@dataclass
class Rectangle:
    p1: Point
    p2: Point

@dataclass
class Arc:
    center: Point
    radius: float
    start_angle: float
    end_angle: float

@dataclass
class Ellipse:
    center: Point
    radius_x: float
    radius_y: float
    rotation: float = 0.0

# ============ DISTANCE & MEASUREMENT ============

def distance(p1: Point, p2: Point) -> float:
    """Calculate Euclidean distance between two points"""
    return math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2 + (p2.z - p1.z)**2)

def distance_2d(p1: Point, p2: Point) -> float:
    """Calculate 2D distance (ignoring Z)"""
    return math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2)

def line_length(line: Line) -> float:
    """Calculate length of a line"""
    return distance(line.start, line.end)

def polyline_length(points: List[Point]) -> float:
    """Calculate total length of polyline"""
    if len(points) < 2:
        return 0.0
    total = 0.0
    for i in range(len(points) - 1):
        total += distance(points[i], points[i + 1])
    return total

def circle_area(circle: Circle) -> float:
    """Calculate area of a circle"""
    return math.pi * circle.radius ** 2

def circle_circumference(circle: Circle) -> float:
    """Calculate circumference of a circle"""
    return 2 * math.pi * circle.radius

def ellipse_area(ellipse: Ellipse) -> float:
    """Calculate area of an ellipse"""
    return math.pi * ellipse.radius_x * ellipse.radius_y

def ellipse_perimeter(ellipse: Ellipse) -> float:
    """Approximate perimeter of ellipse (Ramanujan's formula)"""
    a = ellipse.radius_x
    b = ellipse.radius_y
    h = ((a - b) ** 2) / ((a + b) ** 2)
    return math.pi * (a + b) * (1 + (3 * h) / (10 + math.sqrt(4 - 3 * h)))

def rectangle_area(rect: Rectangle) -> float:
    """Calculate area of rectangle"""
    width = abs(rect.p2.x - rect.p1.x)
    height = abs(rect.p2.y - rect.p1.y)
    return width * height

def rectangle_perimeter(rect: Rectangle) -> float:
    """Calculate perimeter of rectangle"""
    width = abs(rect.p2.x - rect.p1.x)
    height = abs(rect.p2.y - rect.p1.y)
    return 2 * (width + height)

def polygon_area(points: List[Point]) -> float:
    """Calculate polygon area using Shoelace formula"""
    if len(points) < 3:
        return 0.0
    
    area = 0.0
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        area += points[i].x * points[j].y
        area -= points[j].x * points[i].y
    
    return abs(area) / 2.0

def polygon_perimeter(points: List[Point]) -> float:
    """Calculate polygon perimeter"""
    if len(points) < 2:
        return 0.0
    
    perimeter = 0.0
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        perimeter += distance(points[i], points[j])
    
    return perimeter

def arc_length(arc: Arc) -> float:
    """Calculate arc length"""
    angle_diff = abs(arc.end_angle - arc.start_angle)
    return arc.radius * angle_diff

def box_volume(width: float, height: float, depth: float) -> float:
    """Calculate box volume"""
    return width * height * depth

def box_surface_area(width: float, height: float, depth: float) -> float:
    """Calculate box surface area"""
    return 2 * (width * height + width * depth + height * depth)

def cylinder_volume(radius: float, height: float) -> float:
    """Calculate cylinder volume"""
    return math.pi * radius ** 2 * height

def cylinder_surface_area(radius: float, height: float) -> float:
    """Calculate cylinder surface area"""
    return 2 * math.pi * radius * (radius + height)

def sphere_volume(radius: float) -> float:
    """Calculate sphere volume"""
    return (4/3) * math.pi * radius ** 3

def sphere_surface_area(radius: float) -> float:
    """Calculate sphere surface area"""
    return 4 * math.pi * radius ** 2

# ============ INTERSECTIONS ============

def line_line_intersection(line1: Line, line2: Line) -> Optional[Point]:
    """Find intersection point of two lines"""
    x1, y1 = line1.start.x, line1.start.y
    x2, y2 = line1.end.x, line1.end.y
    x3, y3 = line2.start.x, line2.start.y
    x4, y4 = line2.end.x, line2.end.y
    
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    
    if abs(denom) < 1e-10:
        return None  # Lines are parallel
    
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
    
    if 0 <= t <= 1 and 0 <= u <= 1:
        x = x1 + t * (x2 - x1)
        y = y1 + t * (y2 - y1)
        return Point(x, y)
    
    return None

def line_circle_intersection(line: Line, circle: Circle) -> List[Point]:
    """Find intersection points of line and circle"""
    dx = line.end.x - line.start.x
    dy = line.end.y - line.start.y
    
    fx = line.start.x - circle.center.x
    fy = line.start.y - circle.center.y
    
    a = dx*dx + dy*dy
    b = 2*(fx*dx + fy*dy)
    c = fx*fx + fy*fy - circle.radius*circle.radius
    
    discriminant = b*b - 4*a*c
    
    if discriminant < 0:
        return []
    
    intersections = []
    sqrt_disc = math.sqrt(discriminant)
    
    for t in [(-b - sqrt_disc) / (2*a), (-b + sqrt_disc) / (2*a)]:
        if 0 <= t <= 1:
            x = line.start.x + t * dx
            y = line.start.y + t * dy
            intersections.append(Point(x, y))
    
    return intersections

def circle_circle_intersection(c1: Circle, c2: Circle) -> List[Point]:
    """Find intersection points of two circles"""
    d = distance(c1.center, c2.center)
    
    if d > c1.radius + c2.radius or d < abs(c1.radius - c2.radius) or d == 0:
        return []
    
    if abs(d - (c1.radius + c2.radius)) < 1e-10:
        # Circles touch at one point
        ratio = c1.radius / d
        x = c1.center.x + ratio * (c2.center.x - c1.center.x)
        y = c1.center.y + ratio * (c2.center.y - c1.center.y)
        return [Point(x, y)]
    
    a = (c1.radius**2 - c2.radius**2 + d**2) / (2*d)
    h = math.sqrt(c1.radius**2 - a**2)
    
    px = c1.center.x + a * (c2.center.x - c1.center.x) / d
    py = c1.center.y + a * (c2.center.y - c1.center.y) / d
    
    offset_x = -h * (c2.center.y - c1.center.y) / d
    offset_y = h * (c2.center.x - c1.center.x) / d
    
    p1 = Point(px + offset_x, py + offset_y)
    p2 = Point(px - offset_x, py - offset_y)
    
    return [p1, p2] if abs(offset_x) > 1e-10 or abs(offset_y) > 1e-10 else [p1]

def line_rectangle_intersection(line: Line, rect: Rectangle) -> List[Point]:
    """Find intersection points of line and rectangle"""
    corners = [
        rect.p1,
        Point(rect.p2.x, rect.p1.y),
        rect.p2,
        Point(rect.p1.x, rect.p2.y)
    ]
    
    intersections = []
    for i in range(4):
        edge = Line(corners[i], corners[(i + 1) % 4])
        intersection = line_line_intersection(line, edge)
        if intersection:
            intersections.append(intersection)
    
    return intersections

# ============ TRANSFORMATIONS ============

def translate_point(point: Point, dx: float, dy: float, dz: float = 0.0) -> Point:
    """Translate point by delta values"""
    return Point(point.x + dx, point.y + dy, point.z + dz)

def translate_points(points: List[Point], dx: float, dy: float, dz: float = 0.0) -> List[Point]:
    """Translate multiple points"""
    return [translate_point(p, dx, dy, dz) for p in points]

def rotate_point(point: Point, center: Point, angle_degrees: float) -> Point:
    """Rotate point around center by angle (in degrees)"""
    angle_rad = math.radians(angle_degrees)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    
    x = point.x - center.x
    y = point.y - center.y
    
    rotated_x = x * cos_a - y * sin_a
    rotated_y = x * sin_a + y * cos_a
    
    return Point(rotated_x + center.x, rotated_y + center.y, point.z)

def rotate_points(points: List[Point], center: Point, angle_degrees: float) -> List[Point]:
    """Rotate multiple points"""
    return [rotate_point(p, center, angle_degrees) for p in points]

def scale_point(point: Point, center: Point, scale: float) -> Point:
    """Scale point relative to center"""
    return Point(
        center.x + (point.x - center.x) * scale,
        center.y + (point.y - center.y) * scale,
        center.z + (point.z - center.z) * scale
    )

def scale_points(points: List[Point], center: Point, scale: float) -> List[Point]:
    """Scale multiple points"""
    return [scale_point(p, center, scale) for p in points]

def mirror_point(point: Point, axis_start: Point, axis_end: Point) -> Point:
    """Mirror point across a line"""
    lx = axis_end.x - axis_start.x
    ly = axis_end.y - axis_start.y
    
    len_l = math.sqrt(lx*lx + ly*ly)
    if len_l == 0:
        return Point(point.x, point.y, point.z)
    
    lx /= len_l
    ly /= len_l
    
    px = point.x - axis_start.x
    py = point.y - axis_start.y
    
    dot = px * lx + py * ly
    proj_x = axis_start.x + dot * lx
    proj_y = axis_start.y + dot * ly
    
    mirror_x = 2 * proj_x - point.x
    mirror_y = 2 * proj_y - point.y
    
    return Point(mirror_x, mirror_y, point.z)

def mirror_points(points: List[Point], axis_start: Point, axis_end: Point) -> List[Point]:
    """Mirror multiple points"""
    return [mirror_point(p, axis_start, axis_end) for p in points]

def offset_line(line: Line, distance: float) -> Tuple[Line, Line]:
    """Create parallel lines at distance from original"""
    dx = line.end.x - line.start.x
    dy = line.end.y - line.start.y
    length = math.sqrt(dx*dx + dy*dy)
    
    if length == 0:
        return line, line
    
    perp_x = -dy / length * distance
    perp_y = dx / length * distance
    
    line1 = Line(
        Point(line.start.x + perp_x, line.start.y + perp_y),
        Point(line.end.x + perp_x, line.end.y + perp_y)
    )
    
    line2 = Line(
        Point(line.start.x - perp_x, line.start.y - perp_y),
        Point(line.end.x - perp_x, line.end.y - perp_y)
    )
    
    return line1, line2

def offset_polyline(points: List[Point], distance: float, closed: bool = False) -> List[Point]:
    """Offset polyline by distance"""
    if len(points) < 2:
        return points
    
    offset_points = []
    n = len(points)
    
    for i in range(n - (0 if closed else 1)):
        p1 = points[i]
        p2 = points[(i + 1) % n]
        
        dx = p2.x - p1.x
        dy = p2.y - p1.y
        length = math.sqrt(dx*dx + dy*dy)
        
        if length > 0:
            perp_x = -dy / length * distance
            perp_y = dx / length * distance
            offset_points.append(Point(p1.x + perp_x, p1.y + perp_y))
    
    if not closed and len(offset_points) > 0:
        last = points[-1]
        dx = last.x - points[-2].x
        dy = last.y - points[-2].y
        length = math.sqrt(dx*dx + dy*dy)
        if length > 0:
            perp_x = -dy / length * distance
            perp_y = dx / length * distance
            offset_points.append(Point(last.x + perp_x, last.y + perp_y))
    
    return offset_points

def stretch_points(points: List[Point], start: Point, end: Point, stretch_x: float, stretch_y: float) -> List[Point]:
    """Stretch points within a boundary"""
    stretched = []
    for p in points:
        new_p = Point(p.x, p.y, p.z)
        if start.x <= p.x <= end.x and start.y <= p.y <= end.y:
            new_p.x += stretch_x
            new_p.y += stretch_y
        stretched.append(new_p)
    return stretched

# ============ SNAP POINTS ============

def find_snap_points(geometry: dict, snap_types: List[str]) -> List[Tuple[Point, str]]:
    """Find all snap-able points on geometry"""
    snap_points = []
    geom_type = geometry.get('type')
    
    # Endpoint snap
    if 'endpoint' in snap_types:
        if geom_type == 'line':
            snap_points.append((Point(**geometry['start']), 'endpoint'))
            snap_points.append((Point(**geometry['end']), 'endpoint'))
        elif geom_type == 'polyline' and geometry.get('points'):
            for p in [geometry['points'][0], geometry['points'][-1]]:
                snap_points.append((Point(**p), 'endpoint'))
        elif geom_type == 'rectangle':
            corners = [
                geometry['start'],
                {'x': geometry['end']['x'], 'y': geometry['start']['y'], 'z': 0},
                geometry['end'],
                {'x': geometry['start']['x'], 'y': geometry['end']['y'], 'z': 0}
            ]
            for corner in corners:
                snap_points.append((Point(**corner), 'endpoint'))
    
    # Midpoint snap
    if 'midpoint' in snap_types:
        if geom_type == 'line':
            start = Point(**geometry['start'])
            end = Point(**geometry['end'])
            mid = Point((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2)
            snap_points.append((mid, 'midpoint'))
        elif geom_type == 'rectangle':
            start = Point(**geometry['start'])
            end = Point(**geometry['end'])
            center = Point((start.x + end.x) / 2, (start.y + end.y) / 2, 0)
            snap_points.append((center, 'midpoint'))
    
    # Center snap
    if 'center' in snap_types:
        if geom_type in ['circle', 'arc', 'ellipse']:
            snap_points.append((Point(**geometry['center']), 'center'))
        elif geom_type == 'rectangle':
            start = Point(**geometry['start'])
            end = Point(**geometry['end'])
            center = Point((start.x + end.x) / 2, (start.y + end.y) / 2, 0)
            snap_points.append((center, 'center'))
    
    return snap_points

def find_nearest_snap(point: Point, geometries: List[dict], snap_types: List[str], threshold: float = 1.0) -> Optional[Tuple[Point, str]]:
    """Find nearest snap point to given point"""
    closest = None
    closest_dist = threshold
    
    for geom in geometries:
        snaps = find_snap_points(geom, snap_types)
        for snap_point, snap_type in snaps:
            dist = distance_2d(point, snap_point)
            if dist < closest_dist:
                closest = (snap_point, snap_type)
                closest_dist = dist
    
    return closest

# ============ POINT TESTING ============

def point_in_circle(point: Point, circle: Circle) -> bool:
    """Check if point is inside circle"""
    return distance_2d(point, circle.center) <= circle.radius

def point_in_rectangle(point: Point, rect: Rectangle) -> bool:
    """Check if point is inside rectangle"""
    min_x = min(rect.p1.x, rect.p2.x)
    max_x = max(rect.p1.x, rect.p2.x)
    min_y = min(rect.p1.y, rect.p2.y)
    max_y = max(rect.p1.y, rect.p2.y)
    
    return min_x <= point.x <= max_x and min_y <= point.y <= max_y

def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """Check if point is inside polygon using ray casting"""
    x, y = point.x, point.y
    n = len(polygon)
    inside = False
    
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i].x, polygon[i].y
        xj, yj = polygon[j].x, polygon[j].y
        
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        
        j = i
    
    return inside

def point_on_line(point: Point, line: Line, tolerance: float = 0.1) -> bool:
    """Check if point is on line segment"""
    dist = point_to_line_distance(point, line)
    if dist > tolerance:
        return False
    
    # Check if point is between line endpoints
    min_x = min(line.start.x, line.end.x) - tolerance
    max_x = max(line.start.x, line.end.x) + tolerance
    min_y = min(line.start.y, line.end.y) - tolerance
    max_y = max(line.start.y, line.end.y) + tolerance
    
    return min_x <= point.x <= max_x and min_y <= point.y <= max_y

# ============ BOUNDING BOX ============

def get_bounding_box(geometries: List[dict]) -> Dict:
    """Get bounding box for multiple geometries"""
    if not geometries:
        return {'min_x': 0, 'min_y': 0, 'max_x': 0, 'max_y': 0, 'width': 0, 'height': 0}
    
    all_points = []
    
    for geom in geometries:
        geom_type = geom.get('type')
        
        if geom_type == 'line':
            all_points.append(Point(**geom['start']))
            all_points.append(Point(**geom['end']))
        
        elif geom_type == 'circle':
            c = Point(**geom['center'])
            r = geom['radius']
            all_points.extend([
                Point(c.x - r, c.y),
                Point(c.x + r, c.y),
                Point(c.x, c.y - r),
                Point(c.x, c.y + r)
            ])
        
        elif geom_type == 'ellipse':
            c = Point(**geom['center'])
            rx = geom['radiusX']
            ry = geom['radiusY']
            all_points.extend([
                Point(c.x - rx, c.y),
                Point(c.x + rx, c.y),
                Point(c.x, c.y - ry),
                Point(c.x, c.y + ry)
            ])
        
        elif geom_type == 'rectangle':
            all_points.append(Point(**geom['start']))
            all_points.append(Point(**geom['end']))
        
        elif geom_type == 'polyline' and geom.get('points'):
            all_points.extend([Point(**p) for p in geom['points']])
    
    if not all_points:
        return {'min_x': 0, 'min_y': 0, 'max_x': 0, 'max_y': 0, 'width': 0, 'height': 0}
    
    xs = [p.x for p in all_points]
    ys = [p.y for p in all_points]
    
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    return {
        'min_x': min_x,
        'max_x': max_x,
        'min_y': min_y,
        'max_y': max_y,
        'width': max_x - min_x,
        'height': max_y - min_y,
        'center_x': (min_x + max_x) / 2,
        'center_y': (min_y + max_y) / 2
    }

# ============ ANGLE CALCULATIONS ============

def angle_between_points(p1: Point, p2: Point) -> float:
    """Calculate angle between two points (in degrees)"""
    dx = p2.x - p1.x
    dy = p2.y - p1.y
    return math.degrees(math.atan2(dy, dx))

def angle_at_vertex(p1: Point, vertex: Point, p3: Point) -> float:
    """Calculate angle at vertex formed by three points"""
    angle1 = angle_between_points(vertex, p1)
    angle2 = angle_between_points(vertex, p3)
    angle = abs(angle2 - angle1)
    return min(angle, 360 - angle)

def normalize_angle(angle: float) -> float:
    """Normalize angle to 0-360 range"""
    while angle < 0:
        angle += 360
    while angle >= 360:
        angle -= 360
    return angle

# ============ DISTANCE CALCULATIONS ============

def point_to_line_distance(point: Point, line: Line) -> float:
    """Calculate perpendicular distance from point to line"""
    x1, y1 = line.start.x, line.start.y
    x2, y2 = line.end.x, line.end.y
    x0, y0 = point.x, point.y
    
    numerator = abs((y2 - y1)*x0 - (x2 - x1)*y0 + x2*y1 - y2*x1)
    denominator = math.sqrt((y2 - y1)**2 + (x2 - x1)**2)
    
    if denominator == 0:
        return distance_2d(point, line.start)
    
    return numerator / denominator

def point_to_circle_distance(point: Point, circle: Circle) -> float:
    """Calculate distance from point to circle edge"""
    dist_to_center = distance_2d(point, circle.center)
    return abs(dist_to_center - circle.radius)

# ============ SIMPLIFICATION ============

def simplify_polyline(points: List[Point], tolerance: float = 0.5) -> List[Point]:
    """Simplify polyline using Douglas-Peucker algorithm"""
    if len(points) <= 2:
        return points
    
    start = points[0]
    end = points[-1]
    line = Line(start, end)
    
    max_dist = 0.0
    max_idx = 0
    
    for i in range(1, len(points) - 1):
        dist = point_to_line_distance(points[i], line)
        if dist > max_dist:
            max_dist = dist
            max_idx = i
    
    if max_dist > tolerance:
        left = simplify_polyline(points[:max_idx+1], tolerance)
        right = simplify_polyline(points[max_idx:], tolerance)
        return left[:-1] + right
    else:
        return [start, end]

def remove_duplicate_points(points: List[Point], tolerance: float = 1e-6) -> List[Point]:
    """Remove duplicate consecutive points"""
    if len(points) <= 1:
        return points
    
    result = [points[0]]
    for i in range(1, len(points)):
        if distance(points[i], result[-1]) > tolerance:
            result.append(points[i])
    
    return result

# ============ SPLINE UTILITIES ============

def catmull_rom_spline(points: List[Point], segments: int = 50) -> List[Point]:
    """Generate smooth spline through points using Catmull-Rom"""
    if len(points) < 2:
        return points
    
    result = []
    
    for i in range(len(points) - 1):
        p0 = points[max(0, i - 1)]
        p1 = points[i]
        p2 = points[i + 1]
        p3 = points[min(len(points) - 1, i + 2)]
        
        for t in range(segments):
            t_norm = t / segments
            t2 = t_norm * t_norm
            t3 = t2 * t_norm
            
            x = 0.5 * (
                (2 * p1.x) +
                (-p0.x + p2.x) * t_norm +
                (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 +
                (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3
            )
            
            y = 0.5 * (
                (2 * p1.y) +
                (-p0.y + p2.y) * t_norm +
                (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 +
                (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3
            )
            
            result.append(Point(x, y))
    
    result.append(points[-1])
    return result

# ============ BOOLEAN OPERATIONS (2D) ============

def union_rectangles(rect1: Rectangle, rect2: Rectangle) -> Optional[Rectangle]:
    """Union of two rectangles (bounding box)"""
    min_x = min(rect1.p1.x, rect1.p2.x, rect2.p1.x, rect2.p2.x)
    max_x = max(rect1.p1.x, rect1.p2.x, rect2.p1.x, rect2.p2.x)
    min_y = min(rect1.p1.y, rect1.p2.y, rect2.p1.y, rect2.p2.y)
    max_y = max(rect1.p1.y, rect1.p2.y, rect2.p1.y, rect2.p2.y)
    
    return Rectangle(Point(min_x, min_y), Point(max_x, max_y))

def rectangles_intersect(rect1: Rectangle, rect2: Rectangle) -> bool:
    """Check if two rectangles intersect"""
    r1_min_x = min(rect1.p1.x, rect1.p2.x)
    r1_max_x = max(rect1.p1.x, rect1.p2.x)
    r1_min_y = min(rect1.p1.y, rect1.p2.y)
    r1_max_y = max(rect1.p1.y, rect1.p2.y)
    
    r2_min_x = min(rect2.p1.x, rect2.p2.x)
    r2_max_x = max(rect2.p1.x, rect2.p2.x)
    r2_min_y = min(rect2.p1.y, rect2.p2.y)
    r2_max_y = max(rect2.p1.y, rect2.p2.y)
    
    return not (r1_max_x < r2_min_x or r2_max_x < r1_min_x or
                r1_max_y < r2_min_y or r2_max_y < r1_min_y)

def circle_in_polygon(circle: Circle, polygon: List[Point]) -> bool:
    """Check if circle is entirely inside polygon"""
    if not point_in_polygon(circle.center, polygon):
        return False
    
    # Check if circle touches any edge
    n = len(polygon)
    for i in range(n):
        edge = Line(polygon[i], polygon[(i + 1) % n])
        if point_to_line_distance(circle.center, edge) < circle.radius:
            # Check if this edge is within the circle's reach
            intersections = line_circle_intersection(edge, circle)
            if intersections:
                return False
    
    return True

# ============ UTILITY FUNCTIONS ============

def interpolate_points(p1: Point, p2: Point, num_points: int) -> List[Point]:
    """Interpolate points between two points"""
    if num_points <= 0:
        return []
    
    result = []
    for i in range(num_points + 1):
        t = i / num_points
        x = p1.x + t * (p2.x - p1.x)
        y = p1.y + t * (p2.y - p1.y)
        z = p1.z + t * (p2.z - p1.z)
        result.append(Point(x, y, z))
    
    return result

def points_to_dict_list(points: List[Point]) -> List[Dict]:
    """Convert list of Points to list of dicts"""
    return [{'x': p.x, 'y': p.y, 'z': p.z} for p in points]

def dict_list_to_points(dicts: List[Dict]) -> List[Point]:
    """Convert list of dicts to list of Points"""
    return [Point(d['x'], d['y'], d.get('z', 0.0)) for d in dicts]

def calculate_centroid(points: List[Point]) -> Point:
    """Calculate centroid of points"""
    if not points:
        return Point(0, 0, 0)
    
    x_sum = sum(p.x for p in points)
    y_sum = sum(p.y for p in points)
    z_sum = sum(p.z for p in points)
    n = len(points)
    
    return Point(x_sum / n, y_sum / n, z_sum / n)

def is_clockwise(points: List[Point]) -> bool:
    """Check if polygon points are in clockwise order"""
    if len(points) < 3:
        return False
    
    area = 0.0
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        area += (points[j].x - points[i].x) * (points[j].y + points[i].y)
    
    return area > 0

def reverse_points(points: List[Point]) -> List[Point]:
    """Reverse order of points"""
    return list(reversed(points))

def close_polyline(points: List[Point]) -> List[Point]:
    """Close polyline by adding first point at end if not already closed"""
    if len(points) < 2:
        return points
    
    if distance(points[0], points[-1]) > 1e-6:
        return points + [Point(points[0].x, points[0].y, points[0].z)]
    
    return points

# ============ CONVERSION UTILITIES ============

def degrees_to_radians(degrees: float) -> float:
    """Convert degrees to radians"""
    return degrees * math.pi / 180.0

def radians_to_degrees(radians: float) -> float:
    """Convert radians to degrees"""
    return radians * 180.0 / math.pi

def cartesian_to_polar(x: float, y: float) -> Tuple[float, float]:
    """Convert cartesian to polar coordinates (radius, angle)"""
    radius = math.sqrt(x*x + y*y)
    angle = math.atan2(y, x)
    return radius, angle

def polar_to_cartesian(radius: float, angle: float) -> Tuple[float, float]:
    """Convert polar to cartesian coordinates"""
    x = radius * math.cos(angle)
    y = radius * math.sin(angle)
    return x, y

# ============ 3D GEOMETRY ============

def cross_product(v1: Tuple[float, float, float], v2: Tuple[float, float, float]) -> Tuple[float, float, float]:
    """Calculate cross product of two 3D vectors"""
    return (
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
    )

def dot_product(v1: Tuple[float, float, float], v2: Tuple[float, float, float]) -> float:
    """Calculate dot product of two 3D vectors"""
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]

def vector_magnitude(v: Tuple[float, float, float]) -> float:
    """Calculate magnitude of 3D vector"""
    return math.sqrt(v[0]**2 + v[1]**2 + v[2]**2)

def normalize_vector(v: Tuple[float, float, float]) -> Tuple[float, float, float]:
    """Normalize 3D vector to unit length"""
    mag = vector_magnitude(v)
    if mag == 0:
        return (0, 0, 0)
    return (v[0]/mag, v[1]/mag, v[2]/mag)

def point_to_vector(p1: Point, p2: Point) -> Tuple[float, float, float]:
    """Create vector from two points"""
    return (p2.x - p1.x, p2.y - p1.y, p2.z - p1.z)

def plane_from_three_points(p1: Point, p2: Point, p3: Point) -> Tuple[float, float, float, float]:
    """Calculate plane equation (a, b, c, d) from three points where ax + by + cz + d = 0"""
    v1 = point_to_vector(p1, p2)
    v2 = point_to_vector(p1, p3)
    
    normal = cross_product(v1, v2)
    normal = normalize_vector(normal)
    
    d = -(normal[0] * p1.x + normal[1] * p1.y + normal[2] * p1.z)
    
    return (normal[0], normal[1], normal[2], d)

def point_to_plane_distance(point: Point, plane: Tuple[float, float, float, float]) -> float:
    """Calculate distance from point to plane"""
    a, b, c, d = plane
    numerator = abs(a * point.x + b * point.y + c * point.z + d)
    denominator = math.sqrt(a**2 + b**2 + c**2)
    return numerator / denominator if denominator > 0 else 0

# ============ ADVANCED OPERATIONS ============

def fit_circle_to_points(points: List[Point]) -> Optional[Circle]:
    """Fit circle to points using least squares"""
    if len(points) < 3:
        return None
    
    n = len(points)
    sum_x = sum(p.x for p in points)
    sum_y = sum(p.y for p in points)
    sum_x2 = sum(p.x**2 for p in points)
    sum_y2 = sum(p.y**2 for p in points)
    sum_xy = sum(p.x * p.y for p in points)
    sum_x3 = sum(p.x**3 for p in points)
    sum_y3 = sum(p.y**3 for p in points)
    sum_x2y = sum(p.x**2 * p.y for p in points)
    sum_xy2 = sum(p.x * p.y**2 for p in points)
    
    A = n * sum_x2 - sum_x**2
    B = n * sum_xy - sum_x * sum_y
    C = n * sum_y2 - sum_y**2
    D = 0.5 * (n * sum_x3 + n * sum_xy2 - sum_x * (sum_x2 + sum_y2))
    E = 0.5 * (n * sum_x2y + n * sum_y3 - sum_y * (sum_x2 + sum_y2))
    
    denominator = A * C - B**2
    if abs(denominator) < 1e-10:
        return None
    
    cx = (D * C - B * E) / denominator
    cy = (A * E - B * D) / denominator
    
    radius = math.sqrt(sum((p.x - cx)**2 + (p.y - cy)**2 for p in points) / n)
    
    return Circle(Point(cx, cy), radius)

def fit_line_to_points(points: List[Point]) -> Optional[Line]:
    """Fit line to points using least squares"""
    if len(points) < 2:
        return None
    
    n = len(points)
    sum_x = sum(p.x for p in points)
    sum_y = sum(p.y for p in points)
    sum_x2 = sum(p.x**2 for p in points)
    sum_xy = sum(p.x * p.y for p in points)
    
    denominator = n * sum_x2 - sum_x**2
    if abs(denominator) < 1e-10:
        # Vertical line
        avg_x = sum_x / n
        min_y = min(p.y for p in points)
        max_y = max(p.y for p in points)
        return Line(Point(avg_x, min_y), Point(avg_x, max_y))
    
    slope = (n * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / n
    
    min_x = min(p.x for p in points)
    max_x = max(p.x for p in points)
    
    return Line(
        Point(min_x, slope * min_x + intercept),
        Point(max_x, slope * max_x + intercept)
    )

def triangulate_polygon(points: List[Point]) -> List[Tuple[int, int, int]]:
    """Triangulate polygon using ear clipping algorithm"""
    if len(points) < 3:
        return []
    
    triangles = []
    vertices = list(range(len(points)))
    
    def is_ear(v_prev: int, v: int, v_next: int) -> bool:
        p_prev = points[vertices[v_prev]]
        p = points[vertices[v]]
        p_next = points[vertices[v_next]]
        
        # Check if triangle is counter-clockwise
        area = (p.x - p_prev.x) * (p_next.y - p_prev.y) - (p_next.x - p_prev.x) * (p.y - p_prev.y)
        if area <= 0:
            return False
        
        # Check if any other vertex is inside this triangle
        for i in range(len(vertices)):
            if i in [v_prev, v, v_next]:
                continue
            
            test_point = points[vertices[i]]
            if point_in_triangle(test_point, p_prev, p, p_next):
                return False
        
        return True
    
    def point_in_triangle(p: Point, a: Point, b: Point, c: Point) -> bool:
        def sign(p1: Point, p2: Point, p3: Point) -> float:
            return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
        
        d1 = sign(p, a, b)
        d2 = sign(p, b, c)
        d3 = sign(p, c, a)
        
        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
        
        return not (has_neg and has_pos)
    
    while len(vertices) > 3:
        ear_found = False
        
        for i in range(len(vertices)):
            v_prev = (i - 1) % len(vertices)
            v_next = (i + 1) % len(vertices)
            
            if is_ear(v_prev, i, v_next):
                triangles.append((vertices[v_prev], vertices[i], vertices[v_next]))
                vertices.pop(i)
                ear_found = True
                break
        
        if not ear_found:
            break
    
    if len(vertices) == 3:
        triangles.append(tuple(vertices))
    
    return triangles

# ============ EXPORT HELPERS ============

def geometry_to_dict(geom_type: str, **kwargs) -> Dict:
    """Convert geometry to dictionary for JSON serialization"""
    result = {'type': geom_type}
    result.update(kwargs)
    return result

def validate_geometry(geom: Dict) -> bool:
    """Validate geometry dictionary has required fields"""
    geom_type = geom.get('type')
    
    if geom_type == 'line':
        return 'start' in geom and 'end' in geom
    elif geom_type == 'circle':
        return 'center' in geom and 'radius' in geom
    elif geom_type == 'rectangle':
        return 'start' in geom and 'end' in geom
    elif geom_type == 'polyline':
        return 'points' in geom and len(geom['points']) >= 2
    elif geom_type == 'ellipse':
        return 'center' in geom and 'radiusX' in geom and 'radiusY' in geom
    
    return True

# ============ MEASUREMENT SUMMARY ============

def calculate_total_measurements(geometries: List[Dict]) -> Dict:
    """Calculate total length, area, perimeter for all geometries"""
    total_length = 0.0
    total_area = 0.0
    total_perimeter = 0.0
    
    for geom in geometries:
        geom_type = geom.get('type')
        
        if geom_type == 'line':
            line = Line(Point(**geom['start']), Point(**geom['end']))
            total_length += line_length(line)
        
        elif geom_type == 'polyline' and geom.get('points'):
            points = [Point(**p) for p in geom['points']]
            total_length += polyline_length(points)
        
        elif geom_type == 'circle':
            circle = Circle(Point(**geom['center']), geom['radius'])
            total_area += circle_area(circle)
            total_perimeter += circle_circumference(circle)
        
        elif geom_type == 'rectangle':
            rect = Rectangle(Point(**geom['start']), Point(**geom['end']))
            total_area += rectangle_area(rect)
            total_perimeter += rectangle_perimeter(rect)
        
        elif geom_type == 'ellipse':
            ellipse = Ellipse(
                Point(**geom['center']),
                geom['radiusX'],
                geom['radiusY']
            )
            total_area += ellipse_area(ellipse)
            total_perimeter += ellipse_perimeter(ellipse)
        
        elif geom_type == 'polygon' and geom.get('points'):
            points = [Point(**p) for p in geom['points']]
            total_area += polygon_area(points)
            total_perimeter += polygon_perimeter(points)
    
    return {
        'total_length': round(total_length, 4),
        'total_area': round(total_area, 4),
        'total_perimeter': round(total_perimeter, 4)
    }

# ============ QUALITY CHECKS ============

def check_self_intersection(points: List[Point]) -> bool:
    """Check if polyline self-intersects"""
    if len(points) < 4:
        return False
    
    n = len(points)
    for i in range(n - 1):
        line1 = Line(points[i], points[i + 1])
        
        for j in range(i + 2, n - 1):
            if i == 0 and j == n - 2:
                continue
            
            line2 = Line(points[j], points[j + 1])
            intersection = line_line_intersection(line1, line2)
            
            if intersection:
                return True
    
    return False

def is_convex_polygon(points: List[Point]) -> bool:
    """Check if polygon is convex"""
    if len(points) < 3:
        return False
    
    n = len(points)
    sign = None
    
    for i in range(n):
        p1 = points[i]
        p2 = points[(i + 1) % n]
        p3 = points[(i + 2) % n]
        
        cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x)
        
        if abs(cross) > 1e-10:
            if sign is None:
                sign = cross > 0
            elif (cross > 0) != sign:
                return False
    
    return True

def calculate_polygon_orientation(points: List[Point]) -> str:
    """Calculate if polygon is clockwise or counter-clockwise"""
    if len(points) < 3:
        return "invalid"
    
    return "clockwise" if is_clockwise(points) else "counter-clockwise"

# ============ CONSTANTS ============

PI = math.pi
TWO_PI = 2 * math.pi
HALF_PI = math.pi / 2
EPSILON = 1e-10
DEFAULT_TOLERANCE = 0.001

# ============ EXPORT ALL ============

__all__ = [
    'Point', 'Line', 'Circle', 'Rectangle', 'Arc', 'Ellipse',
    'distance', 'distance_2d', 'line_length', 'polyline_length',
    'circle_area', 'circle_circumference', 'ellipse_area', 'ellipse_perimeter',
    'rectangle_area', 'rectangle_perimeter', 'polygon_area', 'polygon_perimeter',
    'arc_length', 'box_volume', 'box_surface_area', 'cylinder_volume',
    'cylinder_surface_area', 'sphere_volume', 'sphere_surface_area',
    'line_line_intersection', 'line_circle_intersection', 'circle_circle_intersection',
    'line_rectangle_intersection', 'translate_point', 'translate_points',
    'rotate_point', 'rotate_points', 'scale_point', 'scale_points',
    'mirror_point', 'mirror_points', 'offset_line', 'offset_polyline',
    'stretch_points', 'find_snap_points', 'find_nearest_snap',
    'point_in_circle', 'point_in_rectangle', 'point_in_polygon', 'point_on_line',
    'get_bounding_box', 'angle_between_points', 'angle_at_vertex', 'normalize_angle',
    'point_to_line_distance', 'point_to_circle_distance', 'simplify_polyline',
    'remove_duplicate_points', 'catmull_rom_spline', 'union_rectangles',
    'rectangles_intersect', 'circle_in_polygon', 'interpolate_points',
    'points_to_dict_list', 'dict_list_to_points', 'calculate_centroid',
    'is_clockwise', 'reverse_points', 'close_polyline', 'degrees_to_radians',
    'radians_to_degrees', 'cartesian_to_polar', 'polar_to_cartesian',
    'cross_product', 'dot_product', 'vector_magnitude', 'normalize_vector',
    'point_to_vector', 'plane_from_three_points', 'point_to_plane_distance',
    'fit_circle_to_points', 'fit_line_to_points', 'triangulate_polygon',
    'geometry_to_dict', 'validate_geometry', 'calculate_total_measurements',
    'check_self_intersection', 'is_convex_polygon', 'calculate_polygon_orientation'
]