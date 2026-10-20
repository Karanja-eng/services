"""
The Fundi canonical engineering model — versioned, renderer independent.

Purpose
-------
CAD, IFC and Three.js are three *representations* of the same engineering design.
None of them may own the design. This module defines the single authoritative
document that the representations are derived from:

    engineering parameters (Python generators — authoritative)
                │
                ▼
    canonical model  (this module: identity, geometry, units, parameters,
                │     provenance, relationships, validation state)
        ┌───────┼────────────┬──────────────────┐
        ▼       ▼            ▼                  ▼
      DXF     IFC        Three.js          mapping registry
    (ezdxf) (IfcOpenShell) (visual only)   (identity <-> handles/GlobalIds)

Invariants
----------
1. **Metres, Z-up, right handed.** Every length in this document is metres; the
   unit is declared in ``units`` and validated on construction. DXF (millimetres)
   and Three.js (Y-up) conversion happens in the adapters only — never here.
2. **Engineering parameters are authoritative.** Geometry in the model is
   *derived* from them by the generator that produced the model; it is not
   independently editable.
3. **Semantic type is explicit.** ``ifc_class`` is only ever assigned through the
   explicit :data:`IFC_CLASS_BY_ELEMENT_TYPE` mapping, or passed explicitly by a
   generator that knows what it built. A rectangle on a drawing never becomes an
   ``IfcWall`` by inference.
4. **Identity is stable.** ``id`` is owned by Fundi Studio, survives regeneration,
   and is the only key used to join CAD entities and IFC entities back to the
   element. DXF handles and IFC ``GlobalId`` are representation-specific and are
   recorded as *references*, never as identity.
5. **Versioned.** ``schema`` + ``schema_version`` are written into every document
   and checked by :func:`validate_model`, so an old model can be detected instead
   of being silently mis-read.

Backward compatibility
----------------------
The element shape is a superset of the shape already used by
``septic_model.build_model`` and consumed by ``dxf_export``/``ifc_export``:
``id, ifc_class, shape, axis, dimensions, placement, rotation_z_deg, volume_m3,
fingerprint, level_id, material, properties, role, predefined_type``. Documents
written before this module existed remain valid; the additional keys
(``element_type``, ``reinforcement``, ``provenance``, ``validation``,
``representations``) are optional and defaulted by :func:`normalise_element`.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# ---------------------------------------------------------------------------
# Schema identity
# ---------------------------------------------------------------------------

SCHEMA_ID = "fundi.canonical"
SCHEMA_VERSION = "1.0.0"
#: Schema identifiers that are the *same* schema under an older name.
#:
#: ``septic_model`` wrote ``fundi.canonical.model/1`` before this module existed.
#: That document is version 1 of the canonical model (same element fields, same
#: metre/Z-up conventions), so it is accepted instead of being rejected and
#: rewritten. It remains readable but is not what new generators emit.
LEGACY_SCHEMA_IDS: Tuple[str, ...] = ("fundi.canonical.model/1",)
#: Declared canonical length unit. Never converted inside this module.
CANONICAL_LENGTH_UNIT = "metre"
#: Declared canonical frame. Z is up; X east, Y north; right handed.
CANONICAL_FRAME = "Z-up right-handed"
#: Coordinate origin description, recorded in every document.
CANONICAL_ORIGIN = "project origin at finished ground level of level L0"

#: Fields every element must carry after normalisation.
REQUIRED_ELEMENT_FIELDS: Tuple[str, ...] = (
    "id",
    "element_type",
    "ifc_class",
    "name",
    "shape",
    "dimensions",
    "placement",
    "level_id",
    "material",
)

# ---------------------------------------------------------------------------
# Element type vocabulary and the explicit CAD/BIM semantic mapping
# ---------------------------------------------------------------------------

ET_BEAM = "beam"
ET_COLUMN = "column"
ET_SLAB = "slab"
ET_WALL = "wall"
ET_RETAINING_WALL = "retaining-wall"
ET_PAD_FOOTING = "pad-footing"
ET_STAIR = "stair"
ET_STAIR_FLIGHT = "stair-flight"
ET_CORBEL = "corbel"
ET_NIB = "nib"
ET_HALF_JOINT = "half-joint"
ET_BEAM_COLUMN_JOINT = "beam-column-joint"
ET_TANK = "tank"
ET_BAFFLE = "baffle"
ET_PIPE = "pipe"
ET_SOAKPIT = "soakpit"
ET_COVER = "cover"
ET_MANHOLE = "manhole"
ET_BEDDING = "bedding"
ET_BASE_SLAB = "base-slab"
ET_TOP_SLAB = "top-slab"

ELEMENT_TYPES: Tuple[str, ...] = (
    ET_BEAM, ET_COLUMN, ET_SLAB, ET_WALL, ET_RETAINING_WALL, ET_PAD_FOOTING,
    ET_STAIR, ET_STAIR_FLIGHT, ET_CORBEL, ET_NIB, ET_HALF_JOINT,
    ET_BEAM_COLUMN_JOINT, ET_TANK, ET_BAFFLE, ET_PIPE, ET_SOAKPIT, ET_COVER,
    ET_MANHOLE, ET_BEDDING, ET_BASE_SLAB, ET_TOP_SLAB,
)

#: The only place where a Fundi element type becomes an IFC entity class.
#:
#: This table *is* the semantic mapping required by the integration brief: an
#: element can only acquire an ``ifc_class`` through an explicit row here (or by
#: a generator stating it directly). Nothing infers BIM semantics from geometry.
IFC_CLASS_BY_ELEMENT_TYPE: Dict[str, str] = {
    ET_BEAM: "IfcBeam",
    ET_COLUMN: "IfcColumn",
    ET_SLAB: "IfcSlab",
    ET_WALL: "IfcWall",
    ET_RETAINING_WALL: "IfcWall",
    ET_PAD_FOOTING: "IfcFooting",
    ET_STAIR: "IfcStair",
    ET_STAIR_FLIGHT: "IfcStairFlight",
    ET_CORBEL: "IfcBeam",
    ET_NIB: "IfcBeam",
    ET_HALF_JOINT: "IfcBeam",
    ET_BEAM_COLUMN_JOINT: "IfcBeam",
    ET_TANK: "IfcTank",
    ET_BAFFLE: "IfcWall",
    ET_PIPE: "IfcPipeSegment",
    ET_SOAKPIT: "IfcTank",
    ET_COVER: "IfcCovering",
    ET_MANHOLE: "IfcBuildingElementProxy",
    ET_BEDDING: "IfcSlab",
    ET_BASE_SLAB: "IfcSlab",
    ET_TOP_SLAB: "IfcSlab",
}

#: IFC ``PredefinedType`` per element type where the schema defines one.
#:
#: These values are restricted to the enumerations IFC4 actually defines:
#: ``IfcWallTypeEnum`` has no ``RETAININGWALL`` (a retaining wall is a
#: ``SOLIDWALL`` whose retaining role is carried by ``FundiElementType``), and an
#: unknown keyword makes IfcOpenShell raise rather than write a bad file.
PREDEFINED_TYPE_BY_ELEMENT_TYPE: Dict[str, str] = {
    ET_BEAM: "BEAM",
    ET_COLUMN: "COLUMN",
    ET_SLAB: "FLOOR",
    ET_WALL: "SOLIDWALL",
    ET_RETAINING_WALL: "SOLIDWALL",
    ET_PAD_FOOTING: "PAD_FOOTING",
    ET_STAIR: "STRAIGHT_RUN_STAIR",
    ET_STAIR_FLIGHT: "STRAIGHT",
    ET_COVER: "USERDEFINED",
}

#: Relationship kinds permitted between elements.
RELATION_TYPES: Tuple[str, ...] = (
    "connects-to",       # beam sits on column, wall meets slab ...
    "supported-by",      # footing supports column
    "part-of",           # flight is part of a stair
    "adjacent-to",       # baffle adjacent to tank wall
)

#: Validation states an element (or the whole model) can be in.
VALIDATION_OK = "ok"
VALIDATION_WARNING = "warning"
VALIDATION_ERROR = "error"


class CanonicalModelError(ValueError):
    """Raised when a document cannot be a valid canonical engineering model."""


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def element_volume_m3(element: Dict[str, Any]) -> float:
    """Volume of the element's *gross* solid, in cubic metres.

    Only the two shapes the generators actually produce are supported; an
    unknown shape raises instead of silently returning zero, because a zero
    volume would corrupt every downstream quantity.
    """
    dims = element["dimensions"]
    shape = element["shape"]
    if shape == "box":
        if "height" in dims:
            return float(dims["length_x"]) * float(dims["width_y"]) * float(dims["height"])
        return (
            float(dims["length_x"]) * float(dims["width_y"]) * float(dims["height_z"])
        )
    if shape == "cylinder":
        import math

        radius = float(dims["radius"])
        return math.pi * radius * radius * float(dims["height"])
    raise CanonicalModelError(f"cannot compute volume for shape {shape!r}")


def geometry_fingerprint(element: Dict[str, Any]) -> str:
    """SHA-256 over the parts of an element that affect derived geometry.

    Deliberately excludes names, colours, notes and validation state so that a
    cosmetic edit does not mark the DXF/IFC representations stale, while a
    dimension, placement, rotation or semantic-type change always does.
    """
    payload = {
        "ifc_class": element.get("ifc_class"),
        "element_type": element.get("element_type"),
        "shape": element.get("shape"),
        "axis": element.get("axis", "z"),
        "dimensions": {
            k: round(float(v), 9) for k, v in sorted(element.get("dimensions", {}).items())
        },
        "placement": {
            k: round(float(v), 9) for k, v in sorted(element.get("placement", {}).items())
        },
        "rotation_z_deg": round(float(element.get("rotation_z_deg", 0.0) or 0.0), 9),
        "level_id": element.get("level_id"),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def model_hash(model: Dict[str, Any]) -> str:
    """SHA-256 over the whole document except volatile bookkeeping fields."""
    volatile = {"statistics", "model_hash", "generated_at"}
    payload = {k: v for k, v in model.items() if k not in volatile}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------


def make_model(
    model_id: str,
    name: str,
    generator: str,
    source_params: Optional[Dict[str, Any]] = None,
    *,
    levels: Optional[Sequence[Dict[str, Any]]] = None,
    description: str = "",
    generator_module: Optional[str] = None,
) -> Dict[str, Any]:
    """Create an empty canonical model document with declared units and levels."""
    if not model_id:
        raise CanonicalModelError("model_id is required")
    document: Dict[str, Any] = {
        "schema": SCHEMA_ID,
        "schema_version": SCHEMA_VERSION,
        "model_id": model_id,
        "name": name,
        "description": description,
        "generator": generator,
        "generator_module": generator_module,
        "source_params": dict(source_params or {}),
        "units": {
            "length": CANONICAL_LENGTH_UNIT,
            "area": "square_metre",
            "volume": "cubic_metre",
            "angle": "degree",
            "frame": CANONICAL_FRAME,
            "origin": CANONICAL_ORIGIN,
        },
        "levels": [],
        "elements": [],
        "relationships": [],
        "warnings": [],
    }
    if levels is None:
        levels = [{"id": f"{model_id}:L0", "name": "Ground level", "elevation_m": 0.0}]
    for level in levels:
        add_level(document, **level)
    return document


def add_level(document: Dict[str, Any], id: str, name: str, elevation_m: float = 0.0,
              description: str = "") -> Dict[str, Any]:
    """Register a storey/level. Elevation is metres above the canonical origin."""
    if any(level["id"] == id for level in document["levels"]):
        raise CanonicalModelError(f"duplicate level id {id!r}")
    level = {
        "id": id,
        "name": name,
        "elevation_m": float(elevation_m),
        "description": description,
    }
    document["levels"].append(level)
    return level


def resolve_ifc_class(element_type: str, explicit: Optional[str] = None) -> str:
    """Return the IFC class for an element type, refusing to guess.

    ``explicit`` is honoured because a generator may legitimately know more than
    the type table (a corbel exported as ``IfcBeam`` with a custom
    ``PredefinedType``, for instance), but an unknown element type with no
    explicit class is an error, not a proxy fallback.
    """
    if explicit:
        return explicit
    try:
        return IFC_CLASS_BY_ELEMENT_TYPE[element_type]
    except KeyError as exc:
        raise CanonicalModelError(
            f"element type {element_type!r} has no IFC mapping; pass ifc_class explicitly"
        ) from exc


def make_element(
    id: str,
    element_type: str,
    name: str,
    shape: str,
    dimensions: Dict[str, float],
    placement: Dict[str, float],
    level_id: str,
    *,
    material: str = "C28/35",
    material_properties: Optional[Dict[str, Any]] = None,
    rotation_z_deg: float = 0.0,
    axis: str = "z",
    role: Optional[str] = None,
    ifc_class: Optional[str] = None,
    predefined_type: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None,
    reinforcement: Optional[Dict[str, Any]] = None,
    provenance: Optional[Dict[str, Any]] = None,
    validation: Optional[Dict[str, Any]] = None,
    parent_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build one canonical element with all required fields and a fingerprint."""
    if not id:
        raise CanonicalModelError("element id is required")
    if element_type not in ELEMENT_TYPES:
        raise CanonicalModelError(
            f"unknown element type {element_type!r}; expected one of {ELEMENT_TYPES}"
        )
    resolved_class = resolve_ifc_class(element_type, ifc_class)
    element: Dict[str, Any] = {
        "id": id,
        "element_type": element_type,
        "ifc_class": resolved_class,
        "predefined_type": predefined_type
        if predefined_type is not None
        else PREDEFINED_TYPE_BY_ELEMENT_TYPE.get(element_type, "NOTDEFINED"),
        "name": name,
        "role": role,
        "level_id": level_id,
        "parent_id": parent_id,
        "shape": shape,
        "axis": axis,
        "dimensions": {k: float(v) for k, v in dimensions.items()},
        "placement": {k: float(v) for k, v in placement.items()},
        "rotation_z_deg": float(rotation_z_deg),
        "material": material,
        "material_properties": dict(material_properties or {}),
        "properties": dict(properties or {}),
        "reinforcement": dict(reinforcement or {}),
        "provenance": dict(provenance or {}),
        "validation": dict(validation or {"state": VALIDATION_OK, "warnings": []}),
        "representations": {},
    }
    element["volume_m3"] = round(element_volume_m3(element), 9)
    element["fingerprint"] = geometry_fingerprint(element)
    return element


def add_element(document: Dict[str, Any], element: Dict[str, Any]) -> Dict[str, Any]:
    """Append an element, enforcing unique ids and a declared level."""
    if any(existing["id"] == element["id"] for existing in document["elements"]):
        raise CanonicalModelError(f"duplicate element id {element['id']!r}")
    if not any(level["id"] == element["level_id"] for level in document["levels"]):
        raise CanonicalModelError(
            f"element {element['id']!r} references unknown level {element['level_id']!r}"
        )
    document["elements"].append(element)
    return element


def add_relationship(document: Dict[str, Any], kind: str, source_id: str, target_id: str,
                     note: str = "") -> Dict[str, Any]:
    """Record a directed relationship between two elements."""
    if kind not in RELATION_TYPES:
        raise CanonicalModelError(
            f"unknown relationship {kind!r}; expected one of {RELATION_TYPES}"
        )
    known = {element["id"] for element in document["elements"]}
    for internal_id in (source_id, target_id):
        if internal_id not in known:
            raise CanonicalModelError(f"relationship references unknown element {internal_id!r}")
    relationship = {"type": kind, "from": source_id, "to": target_id, "note": note}
    document["relationships"].append(relationship)
    return relationship


def finalise(document: Dict[str, Any]) -> Dict[str, Any]:
    """Compute statistics and the document hash; return the same document."""
    by_class: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    total_volume = 0.0
    warning_count = 0
    for element in document["elements"]:
        by_class[element["ifc_class"]] = by_class.get(element["ifc_class"], 0) + 1
        by_type[element["element_type"]] = by_type.get(element["element_type"], 0) + 1
        total_volume += float(element.get("volume_m3") or 0.0)
        if element.get("validation", {}).get("state") in (VALIDATION_WARNING, VALIDATION_ERROR):
            warning_count += 1
    document["statistics"] = {
        "element_count": len(document["elements"]),
        "by_ifc_class": dict(sorted(by_class.items())),
        "by_element_type": dict(sorted(by_type.items())),
        "total_volume_m3": round(total_volume, 6),
        "levels": len(document["levels"]),
        "relationships": len(document["relationships"]),
        "elements_with_warnings": warning_count,
    }
    document["model_hash"] = model_hash(document)
    return document


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def normalise_element(element: Dict[str, Any]) -> Dict[str, Any]:
    """Fill optional keys on an element written by an older/other generator.

    Existing documents (``septic_model``) omit ``element_type`` and
    ``reinforcement``; they are derived here rather than duplicated in every
    generator, so both documents validate against one schema.
    """
    normalised = dict(element)
    if "element_type" not in normalised:
        normalised["element_type"] = _element_type_from_ifc_class(normalised.get("ifc_class"))
    normalised.setdefault("axis", "z")
    normalised.setdefault("rotation_z_deg", 0.0)
    normalised.setdefault("role", None)
    normalised.setdefault("parent_id", None)
    normalised.setdefault("properties", {})
    normalised.setdefault("material_properties", {})
    normalised.setdefault("reinforcement", {})
    normalised.setdefault("provenance", {})
    normalised.setdefault("representations", {})
    normalised.setdefault("validation", {"state": VALIDATION_OK, "warnings": []})
    if "volume_m3" not in normalised:
        normalised["volume_m3"] = round(element_volume_m3(normalised), 9)
    if "fingerprint" not in normalised:
        normalised["fingerprint"] = geometry_fingerprint(normalised)
    return normalised


def _element_type_from_ifc_class(ifc_class: Optional[str]) -> str:
    """Reverse of :data:`IFC_CLASS_BY_ELEMENT_TYPE`, for legacy documents only."""
    for element_type, mapped in IFC_CLASS_BY_ELEMENT_TYPE.items():
        if mapped == ifc_class:
            return element_type
    return "unknown"


def declared_length_unit(document: Dict[str, Any]) -> Optional[str]:
    """Length unit a document declares, under either units layout.

    New documents use ``units["length"]``; the older septic document uses
    ``units["canonical"]``. Both declare metres, so both are read here instead of
    one of them being silently treated as unitless.
    """
    units_block = document.get("units") or {}
    for key in ("length", "canonical"):
        value = units_block.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def schema_version_of(document: Dict[str, Any]) -> Optional[str]:
    """Declared schema version, inferred from a legacy schema id when absent."""
    version = document.get("schema_version")
    if isinstance(version, str) and version:
        return version
    schema = document.get("schema")
    if schema in LEGACY_SCHEMA_IDS:
        # "<id>/<major>" - the legacy id carries the major version only.
        return schema.rsplit("/", 1)[-1] + ".0.0"
    return None


def validate_model(document: Dict[str, Any]) -> List[str]:
    """Return a list of schema violations (empty when the document is valid).

    Validation is total: a document is checked against the declared schema
    version, and every element is checked for required fields, type vocabulary,
    explicit IFC mapping, unit-consistent dimensions and a resolvable level.
    """
    problems: List[str] = []

    schema = document.get("schema")
    if schema != SCHEMA_ID and schema not in LEGACY_SCHEMA_IDS:
        problems.append(
            f"schema is {schema!r}, expected {SCHEMA_ID!r} or one of {LEGACY_SCHEMA_IDS}"
        )
    version = schema_version_of(document)
    if version is None:
        problems.append("schema_version is missing and cannot be inferred")
    elif not str(version).startswith(SCHEMA_VERSION.split(".")[0] + "."):
        problems.append(
            f"schema_version {version!r} is not compatible with {SCHEMA_VERSION!r}"
        )
    for key in ("model_id", "name", "generator", "units", "levels", "elements"):
        if key not in document:
            problems.append(f"missing top-level field {key!r}")

    length_unit = declared_length_unit(document)
    if length_unit != CANONICAL_LENGTH_UNIT:
        problems.append(
            f"declared length unit is {length_unit!r}, expected {CANONICAL_LENGTH_UNIT!r}"
        )

    level_ids = {level.get("id") for level in document.get("levels", [])}
    if not level_ids:
        problems.append("model declares no levels")

    seen: set = set()
    for index, raw in enumerate(document.get("elements", [])):
        element = normalise_element(raw)
        label = element.get("id") or f"#{index}"
        for field in REQUIRED_ELEMENT_FIELDS:
            if field not in element:
                problems.append(f"{label}: missing field {field!r}")
        if element["id"] in seen:
            problems.append(f"{label}: duplicate element id")
        seen.add(element["id"])
        if element["level_id"] not in level_ids:
            problems.append(f"{label}: unknown level {element['level_id']!r}")
        if element["element_type"] not in ELEMENT_TYPES:
            problems.append(f"{label}: unknown element type {element['element_type']!r}")
        if element["ifc_class"] not in IFC_CLASS_BY_ELEMENT_TYPE.values():
            problems.append(f"{label}: unmapped IFC class {element['ifc_class']!r}")
        if element["shape"] not in ("box", "cylinder"):
            problems.append(f"{label}: unsupported shape {element['shape']!r}")
        for dim, value in element["dimensions"].items():
            if not isinstance(value, (int, float)):
                problems.append(f"{label}: dimension {dim!r} is not numeric")
            elif value <= 0:
                problems.append(f"{label}: dimension {dim!r} must be positive, got {value}")
        if abs(float(element.get("volume_m3") or 0.0)) <= 0.0:
            problems.append(f"{label}: volume is zero")
    return problems


def require_valid(document: Dict[str, Any]) -> Dict[str, Any]:
    """Raise :class:`CanonicalModelError` unless the document validates."""
    problems = validate_model(document)
    if problems:
        raise CanonicalModelError(
            "canonical model is invalid:\n  - " + "\n  - ".join(problems)
        )
    return document


def validate_external_params(params: Any, allowed: Iterable[str]) -> Dict[str, Any]:
    """Accept only known, scalar, non-negative-free parameters from outside.

    The API accepts a parameter dictionary from the browser; it is validated
    here *before* it reaches a generator, so a typo or an injected key cannot
    silently change an engineering result.
    """
    if params is None:
        return {}
    if not isinstance(params, dict):
        raise CanonicalModelError("parameters must be a JSON object")
    allowed_set = set(allowed)
    unknown = sorted(set(params) - allowed_set)
    if unknown:
        raise CanonicalModelError(f"unknown parameter(s): {', '.join(unknown)}")
    cleaned: Dict[str, Any] = {}
    for key, value in params.items():
        if isinstance(value, (str, int, float, bool)) or value is None:
            cleaned[key] = value
        else:
            raise CanonicalModelError(f"parameter {key!r} must be a scalar value")
    return cleaned
