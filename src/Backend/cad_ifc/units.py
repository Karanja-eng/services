"""
Units and coordinate conventions shared by the CAD, BIM and IFC adapters.

Canonical unit
--------------
The canonical engineering model stores every length in **metres** (SI). This is
the unit used by the existing Fundi Studio generators (``septicTank.intL = 3.0``
means 3.0 m) and by IFC, which mandates SI units unless a conversion based unit
is declared.

Adapter units
-------------
* IFC : metre, declared explicitly as ``IfcSIUnit(LENGTHUNIT, METRE)``.
* DXF : millimetre, ``$INSUNITS = 4`` and ``$MEASUREMENT = 1`` (metric). Civil
  CAD files in Kenya are almost always authored in millimetres, and AutoCAD
  inserts blocks assuming the drawing unit. Converting on export (x1000) keeps
  the file usable in AutoCAD/Revit without a manual scale step.

Coordinate system
-----------------
React Three Fiber (the existing 3D renderer) is **Y-up**; IFC and AutoCAD WCS
are **Z-up**. The canonical model is expressed in a right-handed Z-up frame:

    IFC_X = R3F_X          (east)
    IFC_Y = -R3F_Z         (north)
    IFC_Z = R3F_Y          (up)

R3F mesh positions therefore must be transformed by ``r3f_to_canonical`` before
they can enter the canonical model. The existing generators are left untouched
and keep rendering in Y-up; only the adapter performs the conversion.

Elevation datum
---------------
``z = 0`` is finished ground level at the tank position. Tank internal depth is
measured down from the underside of the top slab; the base slab soffit sits at
``z = 0`` in the generator's own convention (``SepticScene`` places the bed at
``bedThick / 2``). Negative IFC elevations are therefore expected for buried
elements and must not be "fixed" by an offset.
"""

from __future__ import annotations

from typing import Final

#: Multiplier converting a value in the named unit to metres.
UNIT_TO_METRE: Final[dict[str, float]] = {
    "metre": 1.0,
    "meter": 1.0,
    "m": 1.0,
    "millimetre": 0.001,
    "millimeter": 0.001,
    "mm": 0.001,
    "centimetre": 0.01,
    "centimeter": 0.01,
    "cm": 0.01,
    "inch": 0.0254,
    "inches": 0.0254,
    "in": 0.0254,
    "foot": 0.3048,
    "feet": 0.3048,
    "ft": 0.3048,
}

#: The canonical unit used inside the engineering model.
CANONICAL_LENGTH_UNIT: Final[str] = "metre"

#: Length unit declared in exported IFC.
IFC_LENGTH_UNIT: Final[str] = "metre"

#: Length unit used by exported DXF ($INSUNITS = 4 -> millimetres).
DXF_LENGTH_UNIT: Final[str] = "millimetre"
DXF_INSUNITS_MM: Final[int] = 4

#: Absolute tolerance in metres. Geometries closer than this are identical.
TOLERANCE_M: Final[float] = 1e-6

#: Tolerance in millimetres used when comparing DXF geometry to the model.
TOLERANCE_MM: Final[float] = 1e-3


class UnitError(ValueError):
    """Raised on unknown units or on a detected unit mismatch."""


class UnitMismatchError(UnitError):
    """Raised when two representations disagree about their unit scale."""


def conversion_factor(from_unit: str, to_unit: str) -> float:
    """Return the factor multiplying a length in ``from_unit`` to ``to_unit``."""
    try:
        src = UNIT_TO_METRE[from_unit.lower()]
        dst = UNIT_TO_METRE[to_unit.lower()]
    except KeyError as exc:  # pragma: no cover - defensive
        raise UnitError(f"unknown length unit: {exc.args[0]!r}") from exc
    return src / dst


def convert(value: float, from_unit: str, to_unit: str) -> float:
    """Convert ``value`` between two supported length units."""
    return value * conversion_factor(from_unit, to_unit)


def to_canonical(value: float, from_unit: str = CANONICAL_LENGTH_UNIT) -> float:
    """Convert a length to the canonical unit (metres)."""
    return convert(value, from_unit, CANONICAL_LENGTH_UNIT)


def to_dxf(value_m: float) -> float:
    """Convert a canonical length in metres to DXF millimetres."""
    return convert(value_m, CANONICAL_LENGTH_UNIT, DXF_LENGTH_UNIT)


def from_dxf(value_mm: float) -> float:
    """Convert a DXF length in millimetres to canonical metres."""
    return convert(value_mm, DXF_LENGTH_UNIT, CANONICAL_LENGTH_UNIT)


def assert_unit(expected: str, declared: str | None, *, context: str = "") -> None:
    """Raise :class:`UnitMismatchError` unless ``declared`` matches ``expected``.

    Used when reading a DXF back (``$INSUNITS``) or when re-applying a stored
    mapping, so that a file authored in a different unit is rejected loudly
    instead of being silently mis-scaled. An unknown unit is treated as a
    mismatch, never as "close enough".
    """
    if declared is None:
        raise UnitMismatchError(f"{context}: no unit declared, expected {expected!r}")
    try:
        factor = conversion_factor(str(declared).lower(), expected.lower())
    except UnitError as exc:
        raise UnitMismatchError(
            f"{context}: declared unit {declared!r} is not a known length unit "
            f"(expected {expected!r})"
        ) from exc
    if factor != 1.0:
        raise UnitMismatchError(
            f"{context}: declared unit {declared!r} does not match expected {expected!r}"
        )


def r3f_to_canonical(x: float, y: float, z: float) -> tuple[float, float, float]:
    """Map a React Three Fiber (Y-up) position to the canonical (Z-up) frame."""
    return (x, -z, y)


def canonical_to_r3f(x: float, y: float, z: float) -> tuple[float, float, float]:
    """Inverse of :func:`r3f_to_canonical`."""
    return (x, z, -y)


def r3f_to_cad_plan(x: float, z: float) -> tuple[float, float]:
    """Map an R3F ground-plane position to DXF plan coordinates (Y = -Z).

    In plan, DXF ``Y`` points "north" (up the sheet). R3F ``+Z`` points towards
    the viewer, i.e. south, hence the negation.
    """
    return (x, -z)


def describe_units() -> dict[str, str]:
    """Human readable unit manifest, surfaced by the API for verification."""
    return {
        "canonical": CANONICAL_LENGTH_UNIT,
        "ifc": IFC_LENGTH_UNIT,
        "dxf": DXF_LENGTH_UNIT,
        "dxf_insunits": str(DXF_INSUNITS_MM),
        "elevation_datum": "0.000 m = finished ground level at the generator origin",
    }
