"""
2D Geometry utilities for structural detailing.
Provides points, vectors, polylines, bounding boxes, and geometric transforms.
"""

import math
from dataclasses import dataclass
from typing import List, Tuple, Optional, Union


@dataclass
class Point2D:
    x: float
    y: float

    def to_tuple(self) -> Tuple[float, float]:
        return (self.x, self.y)

    def distance_to(self, other: "Point2D") -> float:
        return math.hypot(self.x - other.x, self.y - other.y)

    def offset(self, dx: float, dy: float) -> "Point2D":
        return Point2D(self.x + dx, self.y + dy)

    def __add__(self, other: Union["Point2D", "Vector2D"]) -> "Point2D":
        return Point2D(self.x + other.x, self.y + other.y)

    def __sub__(self, other: "Point2D") -> "Vector2D":
        return Vector2D(self.x - other.x, self.y - other.y)


@dataclass
class Vector2D:
    x: float
    y: float

    @property
    def length(self) -> float:
        return math.hypot(self.x, self.y)

    def normalized(self) -> "Vector2D":
        l = self.length
        if l == 0:
            return Vector2D(0.0, 0.0)
        return Vector2D(self.x / l, self.y / l)

    def perpendicular(self) -> "Vector2D":
        """Rotate 90 degrees counterclockwise."""
        return Vector2D(-self.y, self.x)

    def scale(self, factor: float) -> "Vector2D":
        return Vector2D(self.x * factor, self.y * factor)

    def to_tuple(self) -> Tuple[float, float]:
        return (self.x, self.y)


@dataclass
class BoundingBox:
    min_x: float
    min_y: float
    max_x: float
    max_y: float

    @property
    def width(self) -> float:
        return max(0.0, self.max_x - self.min_x)

    @property
    def height(self) -> float:
        return max(0.0, self.max_y - self.min_y)

    @property
    def center(self) -> Point2D:
        return Point2D((self.min_x + self.max_x) / 2.0, (self.min_y + self.max_y) / 2.0)

    def expand(self, margin: float) -> "BoundingBox":
        return BoundingBox(
            self.min_x - margin,
            self.min_y - margin,
            self.max_x + margin,
            self.max_y + margin
        )


@dataclass
class Polyline:
    points: List[Point2D]
    is_closed: bool = False

    def to_tuples(self) -> List[Tuple[float, float]]:
        return [p.to_tuple() for p in self.points]

    @property
    def bounding_box(self) -> BoundingBox:
        if not self.points:
            return BoundingBox(0, 0, 0, 0)
        xs = [p.x for p in self.points]
        ys = [p.y for p in self.points]
        return BoundingBox(min(xs), min(ys), max(xs), max(ys))

    def translate(self, dx: float, dy: float) -> "Polyline":
        return Polyline([p.offset(dx, dy) for p in self.points], self.is_closed)


def offset_segment(p1: Point2D, p2: Point2D, distance: float) -> Tuple[Point2D, Point2D]:
    """Offset a 2D line segment perpendicularly by `distance` to the left."""
    vec = p2 - p1
    perp = vec.perpendicular().normalized().scale(distance)
    return (p1 + perp, p2 + perp)


def fillet_polyline(points: List[Tuple[float, float]], radius: float, num_segments: int = 8) -> List[Tuple[float, float]]:
    """Fillet corners of a 2D polyline path with a bend radius."""
    if len(points) < 3 or radius <= 0:
        return list(points)

    result: List[Tuple[float, float]] = [points[0]]
    for i in range(1, len(points) - 1):
        p_prev = Point2D(*points[i - 1])
        p_curr = Point2D(*points[i])
        p_next = Point2D(*points[i + 1])

        v_in = (p_curr - p_prev).normalized()
        v_out = (p_next - p_curr).normalized()

        dot = v_in.x * v_out.x + v_in.y * v_out.y
        dot = max(-1.0, min(1.0, dot))
        theta = math.acos(dot)

        # If nearly straight or reversed, don't fillet
        if theta < 1e-4 or theta > math.pi - 1e-4:
            result.append(p_curr.to_tuple())
            continue

        half_angle = theta / 2.0
        tan_half = math.tan(half_angle)
        if tan_half < 1e-4:
            result.append(p_curr.to_tuple())
            continue

        tangent_dist = radius * math.tan((math.pi - theta) / 2.0)
        dist_in = p_prev.distance_to(p_curr)
        dist_out = p_curr.distance_to(p_next)

        actual_t = min(tangent_dist, dist_in * 0.45, dist_out * 0.45)
        pt_start = p_curr - v_in.scale(actual_t)
        pt_end = p_curr + v_out.scale(actual_t)

        result.append(pt_start.to_tuple())
        result.append(pt_end.to_tuple())

    result.append(points[-1])
    return result
