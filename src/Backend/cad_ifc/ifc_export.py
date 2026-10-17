"""
IFC generation adapter (server side, IfcOpenShell).

Responsibility split
--------------------
* **This module** turns the canonical engineering model into a *semantic* IFC4
  file: ``IfcProject / IfcSite / IfcBuilding / IfcBuildingStorey`` spatial
  structure, and ``IfcWall`` / ``IfcSlab`` / ``IfcPipeSegment`` elements with
  extruded solid geometry, materials, and property sets that carry the Fundi
  internal identity.
* **The browser** never generates IFC. It only parses/renders files.

Why IfcOpenShell and not a hand written STEP writer: IFC4 requires consistent
inverse relationships, units, ownership and placement hierarchies. The file
produced here round-trips through ``ifcopenshell.open``,
``ifcopenshell.validate`` and the geometry kernel (see ``validate_ifc_file`` and
``iter_element_geometries``).

Entity instances are built with **positional** arguments in IFC schema order
(see the per-class tuple layout below). Keyword construction depends on the exact
attribute spelling of the schema version and fails hard on a mismatch
(``IfcUnitAssignment.Units`` vs ``.UnitsInContext``, ``IfcPerson.Identification``
vs ``.Id``), so positional construction with a schema-ordered argument list is
used deliberately.
"""

from __future__ import annotations

import datetime as _dt
import math
import os
from typing import Any, Dict, Iterable, List, Optional, Tuple

from . import identity, septic_model, units

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

#: Attribute order per created class, for documentation of the positional calls.
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
    "IfcSite": (
        "GlobalId", "OwnerHistory", "Name", "Description", "ObjectType",
        "ObjectPlacement", "Representation", "LongName", "CompositionType",
    ),
    "IfcBuilding": (
        "GlobalId", "OwnerHistory", "Name", "Description", "ObjectType",
        "ObjectPlacement", "Representation", "LongName", "CompositionType",
    ),
    "IfcBuildingStorey": (
        "GlobalId", "OwnerHistory", "Name", "Description", "ObjectType",
        "ObjectPlacement", "Representation", "LongName", "CompositionType", "Elevation",
    ),
    "IfcWall": (
        "GlobalId", "OwnerHistory", "Name", "Description", "ObjectType",
        "ObjectPlacement", "Representation", "Tag", "PredefinedType",
    ),
    "IfcSlab": (
        "GlobalId", "OwnerHistory", "Name", "Description", "ObjectType",
        "ObjectPlacement", "Representation", "Tag", "PredefinedType",
    ),
    "IfcPipeSegment": (
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
    """Create the geometric representation context.

    A single ``IfcGeometricRepresentationContext`` is used rather than adding an
    ``IfcGeometricRepresentationSubContext`` for the body: both are schema valid,
    and the sub context cannot be created positionally through
    ``create_entity`` in IfcOpenShell 0.9 (inherited attributes are rejected).
    """
    origin = ifc.create_entity(
        "IfcAxis2Placement3D", ifc.createIfcCartesianPoint((0.0, 0.0, 0.0)), None, None
    )
    context = ifc.create_entity(
        "IfcGeometricRepresentationContext",
        "Body", "Model", 3, 1.0e-5, origin, None,
    )
    return context, context


def _solid(ifc: Any, element: Dict[str, Any]) -> Any:
    """Extruded solid centred on the element's canonical placement."""
    dims = element["dimensions"]
    # Boxes carry length_x/width_y/height_z; cylinders carry radius/height.
    height = float(dims["height"] if "height" in dims else dims["height_z"])
    if element["shape"] == "box":
        profile = ifc.create_entity(
            "IfcRectangleProfileDef", "AREA", None,
            ifc.create_entity("IfcAxis2Placement2D", ifc.createIfcCartesianPoint((0.0, 0.0)), None),
            float(dims["length_x"]), float(dims["width_y"]),
        )
    elif element["shape"] == "cylinder":
        profile = ifc.create_entity(
            "IfcCircleProfileDef", "AREA", None,
            ifc.create_entity("IfcAxis2Placement2D", ifc.createIfcCartesianPoint((0.0, 0.0)), None),
            float(dims["radius"]),
        )
    else:  # pragma: no cover - guarded by the model builder
        raise IfcExportError(f"unsupported shape {element['shape']!r}")

    axis = element.get("axis", "z")
    if axis == "z":
        position = ifc.create_entity(
            "IfcAxis2Placement3D",
            ifc.createIfcCartesianPoint((0.0, 0.0, -height / 2.0)), None, None,
        )
    elif axis == "x":
        # Local Z becomes global X: the profile plane sits at x = -height/2 and
        # the extrusion runs along +X, so the solid is centred on the placement.
        position = ifc.create_entity(
            "IfcAxis2Placement3D",
            ifc.createIfcCartesianPoint((-height / 2.0, 0.0, 0.0)),
            ifc.createIfcDirection((1.0, 0.0, 0.0)),
            ifc.createIfcDirection((0.0, 1.0, 0.0)),
        )
    else:  # pragma: no cover - not produced by the current builder
        raise IfcExportError(f"unsupported extrusion axis {axis!r}")

    return ifc.create_entity(
        "IfcExtrudedAreaSolid", profile, position,
        ifc.createIfcDirection((0.0, 0.0, 1.0)), height,
    )


def _shape(ifc: Any, body: Any, element: Dict[str, Any]) -> Any:
    representation = ifc.create_entity(
        "IfcShapeRepresentation", body, "Body", "SweptSolid", [_solid(ifc, element)]
    )
    return ifc.create_entity("IfcProductDefinitionShape", None, None, [representation])


_IFC_ELEMENT_CLASS = {
    "IfcWall": "IfcWall",
    "IfcSlab": "IfcSlab",
    "IfcPipeSegment": "IfcPipeSegment",
}


def _create_element(ifc: Any, element: Dict[str, Any], owner_history: Any,
                    storey_placement: Any, shape: Any) -> Any:
    ifc_class = _IFC_ELEMENT_CLASS.get(element["ifc_class"])
    if ifc_class is None:
        raise IfcExportError(f"no IFC class mapped for {element['ifc_class']!r}")

    point = element["placement"]
    angle = math.radians(float(element.get("rotation_z_deg", 0.0)))
    axis_placement = ifc.create_entity(
        "IfcAxis2Placement3D",
        ifc.createIfcCartesianPoint((float(point["x"]), float(point["y"]), float(point["z"]))),
        ifc.createIfcDirection((0.0, 0.0, 1.0)),
        ifc.createIfcDirection((math.cos(angle), math.sin(angle), 0.0)),
    )
    local_placement = ifc.create_entity(
        "IfcLocalPlacement", storey_placement, axis_placement
    )
    return ifc.create_entity(
        ifc_class,
        _guid(element["id"]),
        owner_history,
        element["name"],
        element.get("role"),
        element.get("role"),
        local_placement,
        shape,
        element["id"],
        element.get("predefined_type") or "NOTDEFINED",
    )


def _attach_property_sets(ifc: Any, element: Dict[str, Any], ifc_element: Any,
                          owner_history: Any) -> None:
    identity_props = [
        _property(ifc, "FundiElementId", element["id"]),
        _property(ifc, "FundiModelId", element["id"].rsplit(".", 1)[0].split(".")[0]),
        _property(ifc, "FundiGenerator", septic_model.SEPTIC_MODEL_ID),
        _property(ifc, "FundiGeometryFingerprint", element["fingerprint"]),
        _property(ifc, "FundiIfcClass", element["ifc_class"]),
        _property(ifc, "FundiLevelId", element["level_id"]),
    ]
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
    engineering.append(_property(ifc, "GrossVolume", float(element["volume_m3"])))
    pset2 = ifc.create_entity(
        "IfcPropertySet", _guid(element["id"] + ":Pset_FundiEngineering"),
        owner_history, PSET_ENGINEERING,
        "Engineering parameters and derived quantities", engineering,
    )
    ifc.create_entity(
        "IfcRelDefinesByProperties", _guid(element["id"] + ":rel-engineering"),
        owner_history, None, None, [ifc_element], pset2,
    )


def export_ifc(model_doc: Dict[str, Any], out_path: str) -> Dict[str, Any]:
    """Write a semantic IFC4 file for ``model_doc`` and return an export report."""
    require_ifcopenshell()
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
        "Generated by Fundi Studio from the canonical engineering model",
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
        "Septic system", None, None, building_placement, None, None, "ELEMENT",
    )
    storey_placement = ifc.create_entity(
        "IfcLocalPlacement", building_placement,
        ifc.create_entity("IfcAxis2Placement3D",
                          ifc.createIfcCartesianPoint((0.0, 0.0, 0.0)), None, None),
    )
    storey = ifc.create_entity(
        "IfcBuildingStorey", _guid(model_doc["model_id"] + ":storey:L0"), owner_history,
        "Ground level", None, None, storey_placement, None, None, "ELEMENT", 0.0,
    )

    for suffix, parent, children in (
        ("rel-project-site", project, [site]),
        ("rel-site-building", site, [building]),
        ("rel-building-storey", building, [storey]),
    ):
        ifc.create_entity(
            "IfcRelAggregates", _guid(model_doc["model_id"] + ":" + suffix),
            owner_history, None, None, parent, children,
        )

    # --- elements -----------------------------------------------------------
    materials: Dict[str, Any] = {}
    created: List[Tuple[Dict[str, Any], Any]] = []
    for element in model_doc["elements"]:
        shape = _shape(ifc, body, element)
        ifc_element = _create_element(ifc, element, owner_history, storey_placement, shape)
        _attach_property_sets(ifc, element, ifc_element, owner_history)

        material_name = element["material"]
        if material_name not in materials:
            materials[material_name] = ifc.create_entity("IfcMaterial", material_name, None, None)
        ifc.create_entity(
            "IfcRelAssociatesMaterial", _guid(element["id"] + ":rel-material"),
            owner_history, None, None, [ifc_element], materials[material_name],
        )
        created.append((element, ifc_element))

    ifc.create_entity(
        "IfcRelContainedInSpatialStructure", _guid(model_doc["model_id"] + ":rel-contained"),
        owner_history, None, None, [e for _, e in created], storey,
    )

    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    ifc.write(out_path)

    return {
        "path": out_path,
        "schema": IFC_SCHEMA,
        "bytes": os.path.getsize(out_path),
        "element_count": len(created),
        "guids": {element["id"]: ifc_element.GlobalId for element, ifc_element in created},
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
    }


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
