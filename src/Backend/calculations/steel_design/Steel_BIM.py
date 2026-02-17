"""
structural_steel_bim/core/geometry.py

Geometric primitives and transformations for structural steel systems.
All coordinates in millimeters, angles in degrees unless specified.
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
from enum import Enum
import uuid


@dataclass
class Point3D:
    """3D point in global coordinate system (mm)."""
    x: float
    y: float
    z: float
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    def to_array(self) -> np.ndarray:
        return np.array([self.x, self.y, self.z])
    
    def distance_to(self, other: 'Point3D') -> float:
        return np.linalg.norm(self.to_array() - other.to_array())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'x': self.x,
            'y': self.y,
            'z': self.z,
            'type': 'Point3D'
        }


@dataclass
class Vector3D:
    """3D vector for directions and transformations."""
    x: float
    y: float
    z: float
    
    def to_array(self) -> np.ndarray:
        return np.array([self.x, self.y, self.z])
    
    def normalize(self) -> 'Vector3D':
        arr = self.to_array()
        norm = np.linalg.norm(arr)
        if norm == 0:
            return Vector3D(0, 0, 0)
        normalized = arr / norm
        return Vector3D(normalized[0], normalized[1], normalized[2])
    
    def cross(self, other: 'Vector3D') -> 'Vector3D':
        arr = np.cross(self.to_array(), other.to_array())
        return Vector3D(arr[0], arr[1], arr[2])
    
    def dot(self, other: 'Vector3D') -> float:
        return np.dot(self.to_array(), other.to_array())


@dataclass
class Line3D:
    """3D line segment for member centerlines."""
    start: Point3D
    end: Point3D
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    def length(self) -> float:
        return self.start.distance_to(self.end)
    
    def direction_vector(self) -> Vector3D:
        delta = self.end.to_array() - self.start.to_array()
        return Vector3D(delta[0], delta[1], delta[2]).normalize()
    
    def midpoint(self) -> Point3D:
        mid = (self.start.to_array() + self.end.to_array()) / 2
        return Point3D(mid[0], mid[1], mid[2])
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'start': self.start.to_dict(),
            'end': self.end.to_dict(),
            'length': self.length(),
            'type': 'Line3D'
        }


class CoordinateSystem:
    """Local coordinate system for member orientation."""
    
    def __init__(self, origin: Point3D, x_axis: Vector3D, y_axis: Vector3D):
        self.origin = origin
        self.x_axis = x_axis.normalize()
        self.y_axis = y_axis.normalize()
        self.z_axis = x_axis.cross(y_axis).normalize()
        
    def transform_to_global(self, local_point: Point3D) -> Point3D:
        """Transform point from local to global coordinates."""
        local = np.array([local_point.x, local_point.y, local_point.z])
        rotation_matrix = np.array([
            self.x_axis.to_array(),
            self.y_axis.to_array(),
            self.z_axis.to_array()
        ]).T
        
        global_point = rotation_matrix @ local + self.origin.to_array()
        return Point3D(global_point[0], global_point[1], global_point[2])