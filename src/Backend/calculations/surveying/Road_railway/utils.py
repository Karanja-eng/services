# ============================================================================
# backend/route_surveying/utils.py
# ============================================================================

"""Utility functions for route surveying calculations"""

import math
from typing import List, Tuple


def kmh_to_ms(speed_kmh: float) -> float:
    """Convert km/h to m/s"""
    return speed_kmh / 3.6


def ms_to_kmh(speed_ms: float) -> float:
    """Convert m/s to km/h"""
    return speed_ms * 3.6


def percent_to_decimal(percent: float) -> float:
    """Convert percentage to decimal"""
    return percent / 100.0


def trapezoidal_area(x1: float, y1: float, x2: float, y2: float) -> float:
    """
    Calculate area of trapezoid using coordinate method.
    Positive area if points are counterclockwise.
    """
    return 0.5 * abs(x1 * y2 - x2 * y1)


def linear_interpolate(x1: float, y1: float, x2: float, y2: float, x: float) -> float:
    """Linear interpolation between two points"""
    if x2 == x1:
        return y1
    
    ratio = (x - x1) / (x2 - x1)
    return y1 + ratio * (y2 - y1)


def distance_2d(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate 2D distance between points"""
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)


def round_to_precision(value: float, decimals: int = 3) -> float:
    """Round to specified decimal places"""
    return round(value, decimals)