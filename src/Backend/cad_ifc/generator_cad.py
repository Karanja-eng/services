"""
DXF adapter for drawings produced by the existing RC generators.

Relationship to :mod:`cad_ifc.dxf_export`
-----------------------------------------
``dxf_export`` *draws* a canonical model with painstakingly laid-out plan and
section views (used for the septic-tank pipeline). This module does not draw
anything: the geometry comes from the generator's own renderers, because for a
detailing sheet the drawing *is* the engineering output (bar marks, curtailment,
schedules). What this module adds is the part the generators do not have:

1. **Identity on the geometry.** Every entity the generator drew receives XDATA
   in the ``FUNDI`` application identifying the engineering element(s) it
   represents and the view it was drawn in.
2. **Units.** ``$INSUNITS = 4`` (millimetres) and ``$MEASUREMENT = 1``, which
   ``ezdxf.new()`` leaves unset. Without this, AutoCAD/Revit cannot know the
   drawing is metric and a re-insert silently rescales the model.
3. **A read-back scan.** The file is reopened from disk and every entity's
   identity, layer, handle and geometry hash is recorded, so the mapping
   describes the file rather than our intentions.
4. **Reconciliation.** Comparing a reopened drawing with the stored mapping
   detects deleted, recreated and user-edited entities, and reports entities with
   no identity instead of guessing what they are.

Payload format
--------------
The versioned single-string payload introduced by ``dxf_export`` is reused
unchanged (``FUNDI1|model|element|guid|view|scale``) so both pipelines produce
files that any Fundi tool can read. A drawing whose view depicts several elements
(a retaining-wall section, a stair section) carries **one 1000-tag per element**
on each entity; :func:`scan_drawing` collects all of them, while the historical
:func:`cad_ifc.dxf_export.scan_dxf_links` still returns the first, which keeps
existing consumers working.
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import ezdxf

from . import canonical, dxf_export, generator_registry, identity, mapping, rc_model, store, units

APPID = dxf_export.APPID
PAYLOAD_VERSION = dxf_export.PAYLOAD_VERSION
PAYLOAD_SEP = dxf_export.PAYLOAD_SEP
TAG_STRING = 1000


class GeneratorCadError(RuntimeError):
    """Raised when a generator drawing cannot be written, tagged or read back."""


# ---------------------------------------------------------------------------
# Geometry hashing
# ---------------------------------------------------------------------------


def _round(value: Any, digits: int = 6) -> Any:
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return value


def entity_geometry_hash(entity: Any) -> str:
    """Stable hash of an entity's *geometry*, excluding colour and identity.

    Used to answer "was this entity edited after we generated it?" without
    storing the whole drawing. Layer is included because moving an entity to
    another layer is a real drawing change that must be reported.
    """
    kind = entity.dxftype()
    payload: Dict[str, Any] = {"type": kind, "layer": entity.dxf.get("layer", "")}
    try:
        if kind == "LINE":
            payload["start"] = [_round(v) for v in entity.dxf.start]
            payload["end"] = [_round(v) for v in entity.dxf.end]
        elif kind == "LWPOLYLINE":
            payload["points"] = [
                [_round(p[0]), _round(p[1])] for p in entity.get_points("xy")
            ]
            payload["closed"] = bool(entity.closed)
        elif kind in ("CIRCLE", "ARC"):
            payload["center"] = [_round(v) for v in entity.dxf.center]
            payload["radius"] = _round(entity.dxf.radius)
            if kind == "ARC":
                payload["start_angle"] = _round(entity.dxf.start_angle)
                payload["end_angle"] = _round(entity.dxf.end_angle)
        elif kind in ("TEXT", "MTEXT"):
            payload["text"] = (entity.dxf.text if kind == "TEXT" else entity.text)
            payload["insert"] = [_round(v) for v in entity.dxf.insert]
            if kind == "TEXT":
                payload["height"] = _round(entity.dxf.height)
        elif kind == "HATCH":
            try:
                payload["pattern"] = entity.dxf.pattern_name
            except Exception:
                payload["pattern"] = ""
            payload["paths"] = len(entity.paths)
        elif kind == "INSERT":
            payload["name"] = entity.dxf.name
            payload["insert"] = [_round(v) for v in entity.dxf.insert]
        else:
            payload["info"] = str(entity.dxfattribs().get("handle", ""))
    except Exception as exc:  # pragma: no cover - unusual entity types
        payload["error"] = f"{type(exc).__name__}: {exc}"
    canonical_payload = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Identity tagging
# ---------------------------------------------------------------------------


def _roles_for_view(spec: generator_registry.GeneratorSpec, view_name: str,
                    model_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Which canonical elements a named view depicts.

    Taken from the view spec's declared roles; an empty declaration means the
    view depicts every element the generator built (the usual single-member
    sheet). The ``title-block`` view never depicts an engineering element.
    """
    if view_name in ("title-block", "unnamed"):
        return []
    for view in spec.views:
        if view.name == view_name:
            if not view.roles:
                return list(model_doc["elements"])
            wanted = set(view.roles)
            return [element for element in model_doc["elements"]
                    if element.get("role") in wanted]
    return list(model_doc["elements"])


def _payload(element: Dict[str, Any], model_id: str, view: str, scale: float) -> str:
    return dxf_export._payload(
        element["id"], model_id, identity.ifc_guid_from_internal_id(element["id"]),
        view, scale,
    )


def tag_drawing(path: str, model_doc: Dict[str, Any],
                recorded_entities: Sequence[Dict[str, Any]],
                spec: generator_registry.GeneratorSpec) -> Dict[str, Any]:
    """Write FUNDI identity XDATA onto the entities the generator created.

    The entities are matched by **handle**, which ``ezdxf`` assigned when the
    generator added them and which survives the intermediate save. An entity is
    tagged with every element its view depicts.
    """
    doc = ezdxf.readfile(path)
    dxf_export._ensure_appid(doc)
    doc.header["$INSUNITS"] = units.DXF_INSUNITS_MM
    doc.header["$MEASUREMENT"] = 1

    msp = doc.modelspace()
    by_handle = {str(entity.dxf.handle): entity for entity in msp}
    scale = units.conversion_factor(units.CANONICAL_LENGTH_UNIT, units.DXF_LENGTH_UNIT)
    model_id = model_doc["model_id"]

    tagged = 0
    untagged: List[Dict[str, Any]] = []
    tags_per_entity: Dict[str, int] = {}
    for record in recorded_entities:
        handle = str(record["handle"])
        entity = by_handle.get(handle)
        if entity is None:
            untagged.append({"handle": handle, "reason": "handle not found in saved DXF"})
            continue
        elements = _roles_for_view(spec, record["view"], model_doc)
        if not elements:
            continue
        entity.set_xdata(
            APPID,
            [(TAG_STRING, _payload(element, model_id, record["view"], scale))
             for element in elements],
        )
        tagged += 1
        tags_per_entity[handle] = len(elements)

    doc.saveas(path)
    return {
        "tagged_entities": tagged,
        "untagged": untagged,
        "multi_element_entities": sum(1 for count in tags_per_entity.values() if count > 1),
        "insunits": units.DXF_INSUNITS_MM,
    }


# ---------------------------------------------------------------------------
# Read-back scan
# ---------------------------------------------------------------------------


def scan_drawing(path: str) -> Dict[str, Any]:
    """Read a drawing from disk and report every entity's identity and geometry.

    Returns one entry per modelspace entity, with ``elements`` holding *all*
    identities its XDATA declares (empty for entities with no Fundi identity,
    which are reported rather than assigned an element).
    """
    try:
        doc = ezdxf.readfile(path)
    except Exception as exc:
        raise GeneratorCadError(f"cannot read DXF {path!r}: {exc}") from exc

    insunits = int(doc.header.get("$INSUNITS", 0) or 0)
    entities: List[Dict[str, Any]] = []
    for entity in doc.modelspace():
        payloads: List[Dict[str, Any]] = []
        try:
            tags = entity.get_xdata(APPID)
        except Exception:
            tags = []
        for code, value in tags:
            if code != TAG_STRING:
                continue
            parsed = dxf_export._parse_payload(value)
            if parsed:
                payloads.append(parsed)
        entities.append(
            {
                "handle": str(entity.dxf.handle),
                "entity_type": entity.dxftype(),
                "layer": entity.dxf.get("layer", ""),
                "geometry_hash": entity_geometry_hash(entity),
                "elements": payloads,
            }
        )

    mapped = [entity for entity in entities if entity["elements"]]
    return {
        "path": path,
        "insunits": insunits,
        "unit": units.DXF_LENGTH_UNIT if insunits == units.DXF_INSUNITS_MM
        else f"insunits:{insunits}",
        "entity_count": len(entities),
        "mapped_entity_count": len(mapped),
        "unmapped_entity_count": len(entities) - len(mapped),
        "entities": entities,
    }


def links_from_scan(scan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Flatten a scan into ``(element, handle)`` link rows for the registry."""
    links: List[Dict[str, Any]] = []
    for entity in scan["entities"]:
        for payload in entity["elements"]:
            links.append(
                {
                    "internal_id": payload["internal_id"],
                    "handle": entity["handle"],
                    "layer": entity["layer"],
                    "entity_type": entity["entity_type"],
                    "view": payload["view"],
                    "geometry_hash": entity["geometry_hash"],
                    "ifc_guid": payload["ifc_guid"],
                    "unit_scale": payload["unit_scale"],
                }
            )
    return links


# ---------------------------------------------------------------------------
# End-to-end export
# ---------------------------------------------------------------------------


def export_drawing(
    generator_key: str,
    overrides: Optional[Dict[str, Any]] = None,
    *,
    model_id: Optional[str] = None,
    level_elevation_m: float = 0.0,
    revision: int = 1,
    out_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Run a generator, tag its drawing with identity, and read it back.

    Returns the canonical model plus the drawing report, so one call is enough to
    feed the CAD workspace, the IFC exporter and the mapping registry.
    """
    spec = generator_registry.get_spec(generator_key)
    model_doc = rc_model.build_model(
        generator_key, overrides, model_id=model_id, level_elevation_m=level_elevation_m
    )
    # The drawing id follows the *model* id so drawing, model JSON and IFC for one
    # design share a name; the revision keeps regenerations apart.
    drawing_id = store.drawing_id(model_doc["model_id"], revision)
    out_path = out_path or store.path_for(drawing_id, "dxf")

    params = generator_registry.build_params(spec, overrides)
    engineering_model = generator_registry.build_model(spec, params)
    draw_report = generator_registry.generate_drawing(
        spec, params, out_path, model=engineering_model
    )

    tagging = tag_drawing(out_path, model_doc, draw_report["entities"], spec)
    scan = scan_drawing(out_path)
    links = links_from_scan(scan)

    by_view: Dict[str, int] = {}
    elements_seen = set()
    for link in links:
        by_view[link["view"]] = by_view.get(link["view"], 0) + 1
        elements_seen.add(link["internal_id"])

    return {
        "generator": generator_key,
        "model": model_doc,
        "drawing": {
            "drawing_id": drawing_id,
            "path": out_path,
            "url": store.url_for(drawing_id, "dxf"),
            "bytes": os.path.getsize(out_path),
            "drawing_number": spec.drawing_number,
            "drawing_title": spec.drawing_title,
            "scale": spec.scale,
            "entity_count": draw_report["entity_count"],
            "by_view": draw_report["by_view"],
            "layers": draw_report["layers"],
            "title_block_entities": draw_report["by_view"].get("title-block", 0),
        },
        "tagging": tagging,
        "scan": {
            "entity_count": scan["entity_count"],
            "mapped_entity_count": scan["mapped_entity_count"],
            "unmapped_entity_count": scan["unmapped_entity_count"],
            "insunits": scan["insunits"],
            "unit": scan["unit"],
            "links_by_view": dict(sorted(by_view.items())),
            "elements_with_entities": sorted(elements_seen),
        },
        "links": links,
        "spec": {
            "key": spec.key,
            "label": spec.label,
            "element_type": spec.element_type,
            "views": [view.name for view in spec.views],
        },
    }


def check_units(path: str) -> Dict[str, Any]:
    """Verify the drawing declares millimetres and every payload agrees."""
    scan = scan_drawing(path)
    problems: List[str] = []
    if scan["insunits"] != units.DXF_INSUNITS_MM:
        problems.append(
            f"$INSUNITS is {scan['insunits']}, expected {units.DXF_INSUNITS_MM} (millimetres)"
        )
    expected_scale = units.conversion_factor(units.CANONICAL_LENGTH_UNIT, units.DXF_LENGTH_UNIT)
    for link in links_from_scan(scan):
        if abs(float(link["unit_scale"]) - expected_scale) > units.TOLERANCE_MM:
            problems.append(
                f"entity {link['handle']} (id {link['internal_id']}) written with scale "
                f"{link['unit_scale']}, expected {expected_scale}"
            )
    return {
        "ok": not problems,
        "problems": problems[:20],
        "insunits": scan["insunits"],
        "entities_checked": scan["entity_count"],
    }
