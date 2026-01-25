"""
Soil Mechanics Module - Input Validation
Engineering-grade validation with detailed error messages
"""

from typing import Optional
from .constants import *


class SoilValidationError(ValueError):
    """Custom exception for soil mechanics validation errors"""
    pass


def validate_positive(value: float, name: str) -> None:
    """Validate that value is positive"""
    if value <= 0:
        raise SoilValidationError(f"{name} must be positive, got {value}")


def validate_range(value: float, name: str, min_val: float, max_val: float) -> None:
    """Validate that value is within range"""
    if not (min_val <= value <= max_val):
        raise SoilValidationError(
            f"{name} must be between {min_val} and {max_val}, got {value}"
        )


def validate_specific_gravity(Gs: float) -> None:
    """Validate specific gravity of soil solids"""
    min_gs, max_gs = SPECIFIC_GRAVITY_RANGE
    if not (min_gs <= Gs <= max_gs):
        raise SoilValidationError(
            f"Specific gravity (Gs) should be between {min_gs} and {max_gs}. "
            f"Got {Gs}. Typical soils: Sand=2.65, Clay=2.70, Organic=2.50"
        )


def validate_moisture_content(w: float) -> None:
    """Validate moisture content (%)"""
    if w < 0:
        raise SoilValidationError(f"Moisture content cannot be negative, got {w}%")
    if w > MOISTURE_CONTENT_MAX:
        raise SoilValidationError(
            f"Moisture content {w}% exceeds typical maximum {MOISTURE_CONTENT_MAX}%. "
            f"Check if units are correct (should be %)."
        )


def validate_void_ratio(e: float) -> None:
    """Validate void ratio"""
    if e < 0:
        raise SoilValidationError(f"Void ratio cannot be negative, got {e}")
    if e > VOID_RATIO_MAX:
        raise SoilValidationError(
            f"Void ratio {e} exceeds typical maximum {VOID_RATIO_MAX}. "
            f"Verify calculations or check for organic/peat soils."
        )


def validate_porosity(n: float) -> None:
    """Validate porosity"""
    if not (0 <= n <= POROSITY_MAX):
        raise SoilValidationError(
            f"Porosity must be between 0 and {POROSITY_MAX}, got {n}"
        )


def validate_saturation(Sr: float) -> None:
    """Validate degree of saturation (%)"""
    if not (0 <= Sr <= 100):
        raise SoilValidationError(
            f"Degree of saturation must be between 0% and 100%, got {Sr}%"
        )


def validate_atterberg_limits(LL: float, PL: float) -> None:
    """Validate Atterberg limits consistency"""
    if LL < PL:
        raise SoilValidationError(
            f"Liquid Limit ({LL}%) must be greater than Plastic Limit ({PL}%). "
            f"Check test results."
        )
    if LL < 0 or PL < 0:
        raise SoilValidationError("Atterberg limits cannot be negative")
    if LL > 200:
        raise SoilValidationError(
            f"Liquid Limit {LL}% is unusually high. Typical range: 20-120%. "
            f"Verify test procedure."
        )


def validate_friction_angle(phi: float) -> None:
    """Validate friction angle (degrees)"""
    if not (0 <= phi <= 50):
        raise SoilValidationError(
            f"Friction angle must be between 0° and 50°, got {phi}°. "
            f"Typical: Sand=30-40°, Clay=0-25°"
        )


def validate_cohesion(c: float) -> None:
    """Validate cohesion (kPa)"""
    if c < 0:
        raise SoilValidationError(f"Cohesion cannot be negative, got {c} kPa")
    if c > 500:
        raise SoilValidationError(
            f"Cohesion {c} kPa is unusually high. Typical: 0-200 kPa. "
            f"Verify units (should be kPa)."
        )


def validate_phase_closure(Vv: float, Vw: float, Va: float, Vs: float) -> None:
    """
    Validate phase relationships closure
    V_total = Vs + Vw + Va = Vs + Vv
    """
    V_total = Vs + Vw + Va
    Vv_calc = Vw + Va
    
    if not abs(Vv - Vv_calc) < 1e-6:
        raise SoilValidationError(
            f"Phase volumes inconsistent: Vv={Vv}, but Vw+Va={Vv_calc}"
        )
    
    # Check all volumes are positive
    if any(v < 0 for v in [Vs, Vw, Va, Vv]):
        raise SoilValidationError("All phase volumes must be non-negative")


def check_saturation_consistency(w: float, e: float, Sr: float, Gs: float) -> None:
    """
    Check if w, e, Sr, Gs are mutually consistent
    e = (Gs × w × Sr) / 100
    """
    tolerance = 0.05  # 5% tolerance
    e_calculated = (Gs * w * Sr) / 100.0
    
    if abs(e - e_calculated) / e > tolerance:
        raise SoilValidationError(
            f"Phase parameters inconsistent:\n"
            f"Given: w={w}%, e={e}, Sr={Sr}%, Gs={Gs}\n"
            f"Expected e = {e_calculated:.3f} from (Gs×w×Sr)/100\n"
            f"Difference exceeds {tolerance*100}% tolerance"
        )