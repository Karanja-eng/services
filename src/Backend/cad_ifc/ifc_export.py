"""
IFC generation adapter (server side, IfcOpenShell).

Responsibility split
--------------------
* **This module** turns a canonical engineering model into a *semantic* IFC4
  file: ``IfcProject / IfcSite / IfcBuilding / IfcBuildingStorey`` spatial
  structure, and typed elements (``IfcBeam``, ``IfcColumn``, ``IfcSlab``,
  ``IfcWall``, ``IfcFooting``, ``IfcStair``, ``IfcStairFlight``, ``IfcTank``,
  ``IfcPipeSegment`` …) with extruded solid geometry, materials, and property
  sets that carry the Fundi internal identity.
* **The browser** never generates IFC. It only parses and renders files.

Why IfcOpenShell and not a hand written STEP writer: IFC4 requires consistent
inverse relationships, units, ownership and placement hierarchies. The file
produced here round-trips through ``ifcopenshell.open``,
``ifcopenshell.validate`` and the geometry kernel (see ``validate_ifc_file`` and
``iter_element_geometries``).

Element classes are never guessed
---------------------------------
The set of classes this exporter will write is exactly
:data:`cad_ifc.canonical.IFC_CLASS_BY_ELEMENT_TYPE` plus an explicit allow-list
for documents that state their class directly. A request to write an element
whose ``ifc_class`` is outside that set raises, so no drawing primitive can
become a BIM element by accident.

Entity instances are built with **positional** arguments in IFC schema order.
Keyword construction depends on the exact attribute spelling of the schema
version and fails hard on a mismatch (``IfcUnitAssignment.Units`` vs
``.UnitsInContext``), so positional construction with a schema-ordered argument
list is used deliberately.
"""

from __future__ import annotations

import datetime as _dt
import math
import os
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from . import canonical, identity, units

try:  # pragma: no cover - exercised only when the dependency is missing
    import ifcopenshell
    import ifcopenshell.api  # noqa: F401  (submodule is not auto-imported)
    import ifcopenshell.guid
    import ifcopenshell.util.element

    IFC_AVAILABLE = True
    IFC_IMPORT_ERROR: Optional[str] = None
except Exception as exc:  # pragma: no cover
    ifcopenshell = None  # type: ignore[assignment]
    IFC_AVAILABLE = False
    IFC_IMPORT_ERROR = str(exc)


IFC_SCHEMA = "IFC4"
APPLICATION_NAME = "Fundi Studio"
APPLICATION_VERSION = "2.0"
#: Property set storing the Fundi identity on every exported element.
PSET_IDENTITY = "Pset_FundiIdentity"
#: Property set storing engineering parameters/derived quantities.
PSET_ENGINEERING = "Pset_FundiEngineering"

#: IFC classes this exporter is allowed to write. Taken from the canonical
#: semantic mapping so the two cannot drift, plus the generic proxy class.
SUPPORTED_IFC_CLASSES = frozenset(
    set(canonical.IFC_CLASS_BY_ELEMENT_TYPE.values())
    | {"IfcBuildingElementProxy", "IfcMember", "IfcPlate", "IfcCovering"}
)

#: Elements that carry riser/tread attributes beyond the common attribute set.
_STAIR_FLIGHT_CLASS = "IfcStairFlight"

#: Attribute order per created class, documented for the positional calls.
_ATTRIBUTE_ORDER = {
    "IfcSIUnit": ("Dimensions", "UnitType", "Prefix", "Name"),
    "IfcUnitAssignment": ("Units",),
    "IfcPerson": ("Identification", "FamilyName", "GivenName"),
    "IfcOrganization": ("Identification", "Name"),
    "IfcApplication": ("ApplicationDeveloper", "Version", "ApplicationFullName", "ApplicationIdentifier"),
    "IfcOwnerHistory": (
        "OwningUser", "OwningApplication", "State", "ChangeAction",
        "LastModifiedDate", "LastModifyingUser", "LastModifyingApplication", "CreationDate",
    ),
    "IfcLocalPlacement": ("PlacementRelTo", "RelativePlacement"),
    "IfcAxis2Placement3D": ("Location", "Axis", "RefDirection"),
    "IfcProject": (
        "GlobalId", "OwnerHistory", "Name", "Description", "ObjectType",
        "LongName", "Phase", "RepresentationContexts", "UnitsInContext",
    ),
    # Every IfcElement subclass written here shares this 9-slot attribute list;
    # IfcStairFlight additionally has risers/treads, which are set afterwards.
    "IfcElement": (
        "GlobalId", "OwnerHistory", "Name", "Description", "ObjectType",
        "ObjectPlacement", "Representation", "Tag", "PredefinedType",
    ),
}


class IfcExportError(RuntimeError):
    """Raised when IFC generation is impossible in the current environment."""


def require_ifcopenshell() -> None:
    """Raise a precise error when IfcOpenShell is unavailable."""
    if not IFC_AVAILABLE:
        raise IfcExportError(
            "IfcOpenShell is not importable in this Python environment "
            f"({IFC_IMPORT_ERROR}). Install it with `pip install ifcopenshell` "
            "in the backend interpreter (see src/Backend/requirements.txt)."
        )


def _now() -> int:
    return int(_dt.datetime.now().timestamp())


def _guid(internal_id: str) -> str:
    """GlobalId derived from the Fundi identity (stable across regenerations)."""
    return identity.ifc_guid_from_internal_id(internal_id)


def _owner_history(ifc: Any) -> Any:
    person = ifc.create_entity("IfcPerson", None, "Fundi", None)
    org = ifc.create_entity("IfcOrganization", None, "Fundi Studio")
    # IfcOwnerHistory.OwningUser is typed IfcPersonAndOrganization, not IfcPerson.
    user = ifc.create_entity("IfcPersonAndOrganization", person, org, None)
    application = ifc.create_entity(
        "IfcApplication", org, APPLICATION_VERSION, APPLICATION_NAME, "FUNDI_CAD_IFC"
    )
    return ifc.create_entity(
        "IfcOwnerHistory", user, application, None, "ADDED",
        _now(), None, None, _now(),
    )


def _property(ifc: Any, name: str, value: Any) -> Any:
    """Create an ``IfcPropertySingleValue`` with a schema-appropriate value type."""
    if isinstance(value, bool):
        nominal = ifc.create_entity("IfcLabel", str(value))
    elif isinstance(value, int):
        nominal = ifc.create_entity("IfcInteger", value)
    elif isinstance(value, float):
        nominal = ifc.create_entity("IfcReal", float(value))
    else:
        nominal = ifc.create_entity("IfcLabel", str(value))
    return ifc.create_entity("IfcPropertySingleValue", name, None, nominal, None)


def _contexts(ifc: Any) -> Tuple[Any, Any]:
    """Create the geometric representation context."""
    origin = ifc.create_entity(
        "IfcAxis2Placement3D", ifc.createIfcCartesianPoint((0.0, 0.0, 0.0)), None, None
    )
    context = ifc.create_entity(
        "IfcGeometricRepresentationContext",
        "Body", "Model", 3, 1.0e-5, origin, None,
    )
    return context, context


def _normalise(vector: Sequence[float]) -> Tuple[float, float, float]:
    """Unit vector, rejecting a zero direction."""
    length = math.sqrt(sum(float(v) ** 2 for v in vector))
    if length <= 0.0:
        raise IfcExportError(f"extrusion direction {tuple(vector)!r} has zero length")
    return tuple(float(v) / length for v in vector)  # type: ignore[return-value]


def _profile(ifc: Any, element: Dict[str, Any], x_dim: float, y_dim: float) -> Any:
    """Centred rectangular area profile in the solid's local XY plane."""
    return ifc.create_entity(
        "IfcRectangleProfileDef", "AREA", None,
        ifc.create_entity("IfcAxis2Placement2D", ifc.createIfcCartesianPoint((0.0, 0.0)), None),
        float(x_dim), float(y_dim),
    )


def _solid(ifc: Any, element: Dict[str, Any]) -> Any:
    """Extruded solid centred on the element's canonical placement.

    Three cases, each of which is explicit rather than inferred:

    ``axis == "z"``        profile in the global XY plane, extruded up; the
                          element's ``length_x``/``width_y``/``height_z`` are the
                          global X/Y/Z extents.
    ``axis == "x"``        profile in the global YZ plane, extruded along +X; the
                          element's ``length_x`` is the extrusion length and
                          ``width_y``/``height_z`` are the section extents.
    ``extrusion`` present  an inclined extrusion: ``direction`` is the global
                          extrusion vector and ``length_m`` the length, with the
                          section being ``width_y`` × ``height_z``. This is what
                          represents an inclined stair waist slab without
                          pretending it is a box.
    """
    dims = element["dimensions"]
    extrusion = element.get("extrusion")

    if extrusion:
        direction = _normalise(extrusion["direction"])
        length = float(extrusion["length_m"])
        width = float(dims["width_y"])
        height = float(dims["height_z"])
        position = ifc.create_entity(
            "IfcAxis2Placement3D",
            ifc.createIfcCartesianPoint(
                (
                    -direction[0] * length / 2.0,
                    -direction[1] * length / 2.0,
                    -direction[2] * length / 2.0,
                )
            ),
            ifc.createIfcDirection(direction),
            ifc.createIfcDirection((0.0, 1.0, 0.0)),
        )
        return ifc.create_entity(
            "IfcExtrudedAreaSolid", _profile(ifc, element, width, height), position,
            ifc.createIfcDirection((0.0, 0.0, 1.0)), length,
        )

    shape = element["shape"]
    axis = element.get("axis", "z")

    if shape == "box" and axis == "z":
        length_x = float(dims["length_x"])
        width_y = float(dims["width_y"])
        height_z = float(dims["height_z"])
        position = ifc.create_entity(
            "IfcAxis2Placement3D",
            ifc.createIfcCartesianPoint((0.0, 0.0, -height_z / 2.0)), None, None,
        )
        return ifc.create_entity(
            "IfcExtrudedAreaSolid", _profile(ifc, element, length_x, width_y), position,
            ifc.createIfcDirection((0.0, 0.0, 1.0)), height_z,
        )

    if shape == "box" and axis == "x":
        extrusion_length = float(dims["length_x"])
        width_y = float(dims["width_y"])
        height_z = float(dims["height_z"])
        # Local Z becomes global X: the profile plane sits at x = -length/2 and
        # the extrusion runs along +X, so the solid is centred on the placement.
        position = ifc.create_entity(
            "IfcAxis2Placement3D",
            ifc.createIfcCartesianPoint((-extrusion_length / 2.0, 0.0, 0.0)),
            ifc.createIfcDirection((1.0, 0.0, 0.0)),
            ifc.createIfcDirection((0.0, 1.0, 0.0)),
        )
        return ifc.create_entity(
            "IfcExtrudedAreaSolid",
            _profile(ifc, element, width_y, height_z), position,
            ifc.createIfcDirection((0.0, 0.0, 1.0)), extrusion_length,
        )

    if shape == "cylinder":
        radius = float(dims["radius"])
        height = float(dims["height"] if "height" in dims else dims["height_z"])
        if axis == "x":  # horizontal cylinder (pipe)
            position = ifc.create_entity(
                "IfcAxis2Placement3D",
                ifc.createIfcCartesianPoint((-height / 2.0, 0.0, 0.0)),
                ifc.createIfcDirection((1.0, 0.0, 0.0)),
                ifc.createIfcDirection((0.0, 1.0, 0.0)),
            )
        else:  # vertical cylinder
            position = ifc.create_entity(
                "IfcAxis2Placement3D",
                ifc.createIfcCartesianPoint((0.0, 0.0, -height / 2.0)), None, None,
            )
        profile = ifc.create_entity(
            "IfcCircleProfileDef", "AREA", None,
            ifc.create_entity("IfcAxis2Placement2D",
                              ifc.createIfcCartesianPoint((0.0, 0.0)), None),
            radius,
        )
        return ifc.create_entity(
            "IfcExtrudedAreaSolid", profile, position,
            ifc.createIfcDirection((0.0, 0.0, 1.0)), height,
        )

    raise IfcExportError(
        f"unsupported geometry shape={shape!r} axis={axis!r} for element "
        f"{element.get('id')!r}"
    )


def _shape(ifc: Any, body: Any, element: Dict[str, Any]) -> Any:
    representation = ifc.create_entity(
        "IfcShapeRepresentation", body, "Body", "SweptSolid", [_solid(ifc, element)]
    )
    return ifc.create_entity("IfcProductDefinitionShape", None, None, [representation])


def _ifc_class_for(element: Dict[str, Any]) -> str:
    """Return the element's IFC class, refusing anything outside the allow-list."""
    ifc_class = element.get("ifc_class")
    if not ifc_class:
        raise IfcExportError(f"element {element.get('id')!r} has no ifc_class")
    if ifc_class not in SUPPORTED_IFC_CLASSES:
        raise IfcExportError(
            f"element {element.get('id')!r} requests IFC class {ifc_class!r}, which is "
            "not in the permitted semantic mapping "
            f"({', '.join(sorted(SUPPORTED_IFC_CLASSES))})"
        )
    return ifc_class


#: The eight leading attributes shared by every ``IfcElement`` subtype written
#: here, in IFC schema order.
_COMMON_ELEMENT_ATTRIBUTES: Tuple[str, ...] = (
    "GlobalId", "OwnerHistory", "Name", "Description", "ObjectType",
    "ObjectPlacement", "Representation", "Tag",
)

#: Fallback index of ``PredefinedType`` when the schema introspection API is
#: unavailable. ``IfcStairFlight`` is the outlier: it inserts
#: ``NumberOfRisers``/``NumberOfTreads``/``RiserHeight``/``TreadLength`` before
#: ``PredefinedType``, so assuming index 8 for every class silently writes a
#: string into ``NumberOfRisers`` and IFC rejects the entity.
_PREDEFINED_INDEX_FALLBACK: Dict[str, int] = {"IfcStairFlight": 12}
_DEFAULT_PREDEFINED_INDEX = 8

#: Cache of ``class name -> {attribute name: index}`` from the IFC schema.
_SCHEMA_ATTRIBUTE_CACHE: Dict[str, Dict[str, int]] = {}


def _schema_attributes(ifc_class: str) -> Dict[str, int]:
    """Attribute name -> index for ``ifc_class``, read from the IFC4 schema."""
    cached = _SCHEMA_ATTRIBUTE_CACHE.get(ifc_class)
    if cached is not None:
        return cached
    mapping: Dict[str, int] = {}
    try:
        schema = ifcopenshell.ifcopenshell_wrapper.schema_by_name(IFC_SCHEMA)  # type: ignore[union-attr]
        declaration = schema.declaration_by_name(ifc_class)
        for index, attribute in enumerate(declaration.all_attributes()):
            mapping[attribute.name()] = index
    except Exception:  # pragma: no cover - wrapper/schema API differences
        mapping = {}
    _SCHEMA_ATTRIBUTE_CACHE[ifc_class] = mapping
    return mapping


#: Cache of ``(class name, attribute) -> tuple of allowed enumeration items``.
_ENUMERATION_CACHE: Dict[Tuple[str, str], Optional[Tuple[str, ...]]] = {}


def _enumeration_items(ifc_class: str, attribute: str = "PredefinedType"
                       ) -> Optional[Tuple[str, ...]]:
    """Allowed enumeration values of ``ifc_class.attribute``, or ``None``.

    Read from the IFC schema so an invalid ``PredefinedType`` is caught *before*
    a partial entity is created. Attempting the write first and catching the error
    is not good enough: ``create_entity`` leaves a half-initialised instance in the
    file, which then shows up as a second (broken) element.
    """
    key = (ifc_class, attribute)
    if key in _ENUMERATION_CACHE:
        return _ENUMERATION_CACHE[key]
    items: Optional[Tuple[str, ...]] = None
    try:
        schema = ifcopenshell.ifcopenshell_wrapper.schema_by_name(IFC_SCHEMA)  # type: ignore[union-attr]
        declaration = schema.declaration_by_name(ifc_class)
        for candidate in declaration.all_attributes():
            if candidate.name() != attribute:
                continue
            declared = candidate.type_of_attribute()
            as_enum = getattr(declared, "as_enumeration_type", None)
            enumeration = as_enum() if as_enum else declared.declared_type()
            items = tuple(enumeration.enumeration_items())
            break
    except Exception:  # pragma: no cover - wrapper API differences
        items = None
    _ENUMERATION_CACHE[key] = items
    return items


def _element_arguments(ifc_class: str, element: Dict[str, Any], owner_history: Any,
                      local_placement: Any, shape: Any, predefined: str) -> List[Any]:
    """Positional argument list for an element, with PredefinedType in the right slot.

    Attributes between ``Tag`` and ``PredefinedType`` are left as ``None`` (all of
    them are optional in IFC4) so class-specific attributes such as
    ``IfcStairFlight.NumberOfRisers`` are never overwritten with a type string.
    """
    base: List[Any] = [
        _guid(element["id"]),
        owner_history,
        element.get("name"),
        element.get("role"),
        element.get("element_type") or element.get("role"),
        local_placement,
        shape,
        element["id"],
    ]
    attributes = _schema_attributes(ifc_class)
    index = attributes.get(
        "PredefinedType", _PREDEFINED_INDEX_FALLBACK.get(ifc_class, _DEFAULT_PREDEFINED_INDEX)
    )
    if index < len(base):
        raise IfcExportError(
            f"{ifc_class}.PredefinedType reported at index {index}, which collides "
            f"with the common IfcElement attributes {_COMMON_ELEMENT_ATTRIBUTES}"
        )
    return base + [None] * (index - len(base)) + [predefined]


def _create_element(ifc: Any, element: Dict[str, Any], owner_history: Any,
                    storey_placement: Any, shape: Any) -> Any:
    ifc_class = _ifc_class_for(element)

    point = element["placement"]
    angle = math.radians(float(element.get("rotation_z_deg", 0.0) or 0.0))
    axis_placement = ifc.create_entity(
        "IfcAxis2Placement3D",
        ifc.createIfcCartesianPoint((float(point["x"]), float(point["y"]), float(point["z"]))),
        ifc.createIfcDirection((0.0, 0.0, 1.0)),
        ifc.createIfcDirection((math.cos(angle), math.sin(angle), 0.0)),
    )
    local_placement = ifc.create_entity(
        "IfcLocalPlacement", storey_placement, axis_placement
    )

    predefined = element.get("predefined_type") or "NOTDEFINED"
    allowed = _enumeration_items(ifc_class)
    if allowed is not None and predefined not in allowed:
        # Degrade visibly instead of writing an invalid entity. The canonical type
        # is still preserved verbatim in Pset_FundiIdentity.FundiElementType.
        element.setdefault("validation", {}).setdefault("warnings", []).append(
            f"PredefinedType {predefined!r} is not defined for {ifc_class} in "
            f"{IFC_SCHEMA}; written as NOTDEFINED"
        )
        predefined = "NOTDEFINED"
    element["predefined_type"] = predefined

    arguments = _element_arguments(
        ifc_class, element, owner_history, local_placement, shape, predefined
    )
    created = ifc.create_entity(ifc_class, *arguments)

    if ifc_class == _STAIR_FLIGHT_CLASS:
        # Risers/treads are optional in IFC4; set them from the parameters when the
        # canonical model recorded them so the flight is not an anonymous prism.
        props = element.get("properties") or {}
        steps = props.get("step_count")
        if isinstance(steps, (int, float)) and steps:
            created.NumberOfRisers = int(steps)
            created.NumberOfTreads = int(steps)
        rise = props.get("rise_m")
        going = props.get("going_m")
        if isinstance(rise, (int, float)) and rise:
            created.RiserHeight = float(rise)
        if isinstance(going, (int, float)) and going:
            created.TreadLength = float(going)
    return created


def _attach_property_sets(ifc: Any, model_doc: Dict[str, Any], element: Dict[str, Any],
                          ifc_element: Any, owner_history: Any) -> None:
    identity_props = [
        _property(ifc, "FundiElementId", element["id"]),
        _property(ifc, "FundiModelId", model_doc["model_id"]),
        _property(ifc, "FundiGenerator", model_doc.get("generator", "")),
        _property(ifc, "FundiSchemaVersion", model_doc.get("schema_version", "")),
        _property(ifc, "FundiGeometryFingerprint", element["fingerprint"]),
        _property(ifc, "FundiIfcClass", element["ifc_class"]),
        _property(ifc, "FundiElementType", element.get("element_type", "")),
        _property(ifc, "FundiLevelId", element["level_id"]),
    ]
    if element.get("parent_id"):
        identity_props.append(_property(ifc, "FundiParentId", element["parent_id"]))
    pset = ifc.create_entity(
        "IfcPropertySet", _guid(element["id"] + ":Pset_FundiIdentity"), owner_history,
        PSET_IDENTITY,
        "Fundi Studio internal identity (stable across regeneration)",
        identity_props,
    )
    ifc.create_entity(
        "IfcRelDefinesByProperties", _guid(element["id"] + ":rel-identity"),
        owner_history, None, None, [ifc_element], pset,
    )

    engineering = [_property(ifc, k, v) for k, v in sorted(element.get("properties", {}).items())]
    engineering.append(_property(ifc, "GrossVolumeM3", float(element["volume_m3"])))
    for dim, value in sorted((element.get("dimensions") or {}).items()):
        engineering.append(_property(ifc, f"Dimension_{dim}_m", float(value)))
    warnings = (element.get("validation") or {}).get("warnings") or []
    if warnings:
        engineering.append(_property(ifc, "FundiValidationWarnings", " | ".join(warnings)))
    pset2 = ifc.create_entity(
        "IfcPropertySet", _guid(element["id"] + ":Pset_FundiEngineering"),
        owner_history, PSET_ENGINEERING,
        "Engineering parameters and derived quantities", engineering,
    )
    ifc.create_entity(
        "IfcRelDefinesByProperties", _guid(element["id"] + ":rel-engineering"),
        owner_history, None, None, [ifc_element], pset2,
    )


def _ensure_levels(ifc: Any, model_doc: Dict[str, Any], owner_history: Any,
                   building_placement: Any) -> Dict[str, Any]:
    """Create one ``IfcBuildingStorey`` per canonical level; return by level id."""
    levels = model_doc.get("levels") or [
        {"id": "L0", "name": "Ground level", "elevation_m": 0.0}
    ]
    storeys: Dict[str, Any] = {}
    placements: Dict[str, Any] = {}
    for level in levels:
        level_id = level["id"]
        elevation = float(level.get("elevation_m") or 0.0)
        placement = ifc.create_entity(
            "IfcLocalPlacement", building_placement,
            ifc.create_entity(
                "IfcAxis2Placement3D",
                ifc.createIfcCartesianPoint((0.0, 0.0, elevation)), None, None,
            ),
        )
        storey = ifc.create_entity(
            "IfcBuildingStorey", _guid(f"{model_doc['model_id']}:storey:{level_id}"),
            owner_history, level.get("name") or level_id, level.get("description"), None,
            placement, None, None, "ELEMENT", elevation,
        )
        storeys[level_id] = storey
        placements[level_id] = placement
    return {"storeys": storeys, "placements": placements, "levels": levels}


def export_ifc(model_doc: Dict[str, Any], out_path: str) -> Dict[str, Any]:
    """Write a semantic IFC4 file for ``model_doc`` and return an export report."""
    require_ifcopenshell()
    problems = canonical.validate_model(model_doc)
    if problems:
        raise IfcExportError(
            "refusing to export an invalid canonical model:\n  - " + "\n  - ".join(problems)
        )

    ifc = ifcopenshell.api.run("project.create_file", version=IFC_SCHEMA)  # type: ignore[union-attr]
    owner_history = _owner_history(ifc)

    # --- units (SI, metres, radians) ---------------------------------------
    length_unit = ifc.create_entity("IfcSIUnit", None, "LENGTHUNIT", None, "METRE")
    area_unit = ifc.create_entity("IfcSIUnit", None, "AREAUNIT", None, "SQUARE_METRE")
    volume_unit = ifc.create_entity("IfcSIUnit", None, "VOLUMEUNIT", None, "CUBIC_METRE")
    angle_unit = ifc.create_entity("IfcSIUnit", None, "PLANEANGLEUNIT", None, "RADIAN")
    unit_assignment = ifc.create_entity(
        "IfcUnitAssignment", [length_unit, area_unit, volume_unit, angle_unit]
    )

    context, body = _contexts(ifc)

    # --- spatial structure --------------------------------------------------
    project = ifc.create_entity(
        "IfcProject", _guid(model_doc["model_id"]), owner_history, model_doc["name"],
        model_doc.get("description") or "Generated by Fundi Studio from the canonical engineering model",
        None, None, None, [context], unit_assignment,
    )

    site_placement = ifc.create_entity(
        "IfcLocalPlacement", None,
        ifc.create_entity("IfcAxis2Placement3D",
                          ifc.createIfcCartesianPoint((0.0, 0.0, 0.0)), None, None),
    )
    site = ifc.create_entity(
        "IfcSite", _guid(model_doc["model_id"] + ":site"), owner_history, "Site",
        None, None, site_placement, None, None, "ELEMENT",
    )
    building_placement = ifc.create_entity(
        "IfcLocalPlacement", site_placement,
        ifc.create_entity("IfcAxis2Placement3D",
                          ifc.createIfcCartesianPoint((0.0, 0.0, 0.0)), None, None),
    )
    building = ifc.create_entity(
        "IfcBuilding", _guid(model_doc["model_id"] + ":building"), owner_history,
        model_doc["name"], None, None, building_placement, None, None, "ELEMENT",
    )
    ifc.create_entity(
        "IfcRelAggregates", _guid(model_doc["model_id"] + ":rel-project-site"),
        owner_history, None, None, project, [site],
    )
    ifc.create_entity(
        "IfcRelAggregates", _guid(model_doc["model_id"] + ":rel-site-building"),
        owner_history, None, None, site, [building],
    )

    level_state = _ensure_levels(ifc, model_doc, owner_history, building_placement)
    storeys: Dict[str, Any] = level_state["storeys"]
    placements: Dict[str, Any] = level_state["placements"]
    for level in level_state["levels"]:
        ifc.create_entity(
            "IfcRelAggregates",
            _guid(f"{model_doc['model_id']}:rel-building-storey:{level['id']}"),
            owner_history, None, None, building, [storeys[level["id"]]],
        )

    # --- elements -----------------------------------------------------------
    materials: Dict[str, Any] = {}
    created: List[Tuple[Dict[str, Any], Any]] = []
    by_level: Dict[str, List[Any]] = {}
    normalised: List[Dict[str, Any]] = [
        canonical.normalise_element(element) for element in model_doc["elements"]
    ]
    for element in normalised:
        shape = _shape(ifc, body, element)
        placement = placements.get(element["level_id"]) or next(iter(placements.values()))
        ifc_element = _create_element(ifc, element, owner_history, placement, shape)
        _attach_property_sets(ifc, model_doc, element, ifc_element, owner_history)

        material_name = element["material"]
        if material_name not in materials:
            materials[material_name] = ifc.create_entity("IfcMaterial", material_name, None, None)
        ifc.create_entity(
            "IfcRelAssociatesMaterial", _guid(element["id"] + ":rel-material"),
            owner_history, None, None, [ifc_element], materials[material_name],
        )
        created.append((element, ifc_element))
        by_level.setdefault(element["level_id"], []).append(ifc_element)

    # Containment is per storey, as IFC requires an element to sit in exactly one
    # spatial structure element.
    for level_id, elements in by_level.items():
        ifc.create_entity(
            "IfcRelContainedInSpatialStructure",
            _guid(f"{model_doc['model_id']}:rel-contained:{level_id}"),
            owner_history, None, None, elements, storeys[level_id],
        )

    # Element decomposition (stair -> stair flights) from explicit parent_id.
    by_id = {element["id"]: ifc_element for element, ifc_element in created}
    children: Dict[str, List[Any]] = {}
    for element in normalised:
        parent_id = element.get("parent_id")
        if parent_id and parent_id in by_id:
            children.setdefault(parent_id, []).append(by_id[element["id"]])
    for parent_id, kids in children.items():
        ifc.create_entity(
            "IfcRelAggregates", _guid(f"{parent_id}:rel-aggregates"),
            owner_history, None, None, by_id[parent_id], kids,
        )

    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    ifc.write(out_path)

    return {
        "path": out_path,
        "schema": IFC_SCHEMA,
        "bytes": os.path.getsize(out_path),
        "element_count": len(created),
        "storey_count": len(storeys),
        "guids": {element["id"]: ifc_element.GlobalId for element, ifc_element in created},
        "classes": sorted({element["ifc_class"] for element, _ in created}),
    }


def read_ifc_summary(path: str) -> Dict[str, Any]:
    """Reopen a written IFC file and report what it actually contains.

    Proves the artefact is a real IFC document read back from disk: entity
    classes, property sets, Fundi identities and the spatial structure all come
    from the file, not from the in-memory model.
    """
    require_ifcopenshell()
    ifc = ifcopenshell.open(path)  # type: ignore[union-attr]
    by_class: Dict[str, int] = {}
    for element in ifc.by_type("IfcProduct"):
        if element.is_a("IfcElement"):
            by_class[element.is_a()] = by_class.get(element.is_a(), 0) + 1

    fundi_ids: List[str] = []
    pset_count = 0
    for pset in ifc.by_type("IfcPropertySet"):
        pset_count += 1
        if pset.Name != PSET_IDENTITY:
            continue
        for prop in pset.HasProperties:
            if prop.Name == "FundiElementId":
                fundi_ids.append(prop.NominalValue.wrappedValue)

    spatial = [
        (e.is_a(), e.Name)
        for e in ifc.by_type("IfcSpatialStructureElement")
    ]
    units_declared = []
    for unit in ifc.by_type("IfcSIUnit"):
        units_declared.append(f"{unit.UnitType}:{unit.Prefix or ''}{unit.Name}")

    return {
        "schema": ifc.schema,
        "element_count": sum(by_class.values()),
        "by_class": dict(sorted(by_class.items())),
        "property_sets": pset_count,
        "fundi_element_ids": sorted(fundi_ids),
        "spatial_structure": spatial,
        "units": sorted(units_declared),
        "materials": sorted(m.Name for m in ifc.by_type("IfcMaterial")),
        "storeys": sorted(
            (storey.Name, round(float(storey.Elevation or 0.0), 6))
            for storey in ifc.by_type("IfcBuildingStorey")
        ),
    }


def read_element_identities(path: str) -> List[Dict[str, Any]]:
    """Read back ``FundiElementId`` -> ``GlobalId`` for every exported element.

    This is the IFC side of the mapping: it is read from the file, so a mapping
    rebuilt from an IFC uses what the file actually contains.
    """
    require_ifcopenshell()
    ifc = ifcopenshell.open(path)  # type: ignore[union-attr]
    rows: List[Dict[str, Any]] = []
    for pset in ifc.by_type("IfcPropertySet"):
        if pset.Name != PSET_IDENTITY:
            continue
        internal_id = None
        fingerprint = None
        for prop in pset.HasProperties:
            if prop.Name == "FundiElementId":
                internal_id = prop.NominalValue.wrappedValue
            elif prop.Name == "FundiGeometryFingerprint":
                fingerprint = prop.NominalValue.wrappedValue
        if internal_id is None:
            continue
        for relation in ifc.get_inverse(pset):
            if relation.is_a("IfcRelDefinesByProperties"):
                for related in relation.RelatedObjects:
                    rows.append(
                        {
                            "internal_id": internal_id,
                            "ifc_guid": related.GlobalId,
                            "ifc_class": related.is_a(),
                            "name": related.Name,
                            "fingerprint": fingerprint,
                        }
                    )
    return sorted(rows, key=lambda row: row["internal_id"])


def _json_safe(value: Any) -> Any:
    """Convert validator output (which embeds IFC entities) to JSON-safe types."""
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def validate_ifc_file(path: str) -> Dict[str, Any]:
    """Run IfcOpenShell's schema/semantic validator over the file."""
    require_ifcopenshell()
    import ifcopenshell.validate

    ifc = ifcopenshell.open(path)  # type: ignore[union-attr]
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(ifc, logger)
    statements = [_json_safe(s) for s in getattr(logger, "statements", [])]
    return {
        "validator": "ifcopenshell.validate",
        "statement_count": len(statements),
        "statements": statements[:20],
        "ok": len(statements) == 0,
    }


def iter_element_geometries(path: str) -> Iterable[Dict[str, Any]]:
    """Iterate geometry produced by IfcOpenShell's geometry kernel.

    Confirms the exported solids are machine-interpretable: vertex counts and
    bounding boxes come from the IFC kernel, not from our own bookkeeping.
    """
    require_ifcopenshell()
    import ifcopenshell.geom

    ifc = ifcopenshell.open(path)  # type: ignore[union-attr]
    settings = ifcopenshell.geom.settings()  # type: ignore[union-attr]
    settings.set("use-world-coords", True)
    for element in ifc.by_type("IfcElement"):
        try:
            shape = ifcopenshell.geom.create_shape(settings, element)  # type: ignore[union-attr]
        except Exception as exc:  # pragma: no cover - kernel/driver specific
            yield {"guid": element.GlobalId, "error": str(exc)}
            continue
        verts = shape.geometry.verts
        xs, ys, zs = verts[0::3], verts[1::3], verts[2::3]
        yield {
            "guid": element.GlobalId,
            "ifc_class": element.is_a(),
            "name": element.Name,
            "vertex_count": len(verts) // 3,
            "bbox": {
                "x": [round(min(xs), 6), round(max(xs), 6)],
                "y": [round(min(ys), 6), round(max(ys), 6)],
                "z": [round(min(zs), 6), round(max(zs), 6)],
            },
        }


def element_extents(path: str) -> Dict[str, Dict[str, Any]]:
    """Bounding-box extents keyed by GlobalId, for dimensional verification."""
    extents: Dict[str, Dict[str, Any]] = {}
    for entry in iter_element_geometries(path):
        if "bbox" in entry:
            bbox = entry["bbox"]
            extents[entry["guid"]] = {
                "ifc_class": entry["ifc_class"],
                "name": entry["name"],
                "size": {
                    axis: round(bounds[1] - bounds[0], 6)
                    for axis, bounds in bbox.items()
                },
                "bbox": bbox,
            }
    return extents
