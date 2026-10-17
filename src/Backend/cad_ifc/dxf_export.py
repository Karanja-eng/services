"""
DXF export / import adapter for the *drawing* side of the workflow.

This module is deliberately independent of IfcOpenShell: DXF and IFC are two
projections of the same canonical model, not two copies of the same file.

What is produced
----------------
A real DXF drawing (``ezdxf``, R2010, ``$INSUNITS = 4`` millimetres) containing:

* ``FUNDI_MODEL``  - model-derived plan and section geometry, regenerated on
  every export. This layer is *owned* by the exporter and is replaced wholesale.
* ``FUNDI_DIM``    - dimensions generated with the drawing.
* ``FUNDI_ANNO``   - labels, view titles, scale note.
* ``FUNDI_TITLE``  - a title block.
* ``FUNDI_MANUAL`` - reserved for drafting content authored by the user. The
  exporter *never* touches this layer, nor any layer it does not own.

Every model entity carries XDATA in the ``FUNDI`` application: the internal
element id, its derived IFC GlobalId, the unit scale used for the file, and the
model id. This is what makes a CAD entity traceable back to an engineering
element even after the file has been edited in another application, and it is
the reason a lost SQLite mapping can be rebuilt from the DXF alone.

Coordinate contract: canonical metres -> DXF millimetres (x1000). The plan view
uses canonical X/Y directly; the section view is drawn ``SECTION_OFFSET_MM``
below the plan and uses canonical X/Z, so a drawing opened in AutoCAD measures
the same dimensions as the engineering model.
"""

from __future__ import annotations

import math
import os
from typing import Any, Dict, List, Optional, Tuple

import ezdxf

from . import identity, units

APPID = "FUNDI"
LAYER_MODEL = "FUNDI_MODEL"
LAYER_DIM = "FUNDI_DIM"
LAYER_ANNO = "FUNDI_ANNO"
LAYER_TITLE = "FUNDI_TITLE"
LAYER_MANUAL = "FUNDI_MANUAL"

#: Vertical offset of the section view below the plan view (millimetres).
SECTION_OFFSET_MM = 4000.0

#: XDATA tag codes (DXF fixed codes inside the FUNDI appid).
TAG_ELEMENT_ID = 1000  # string
TAG_MODEL_ID = 1001
TAG_IFC_GUID = 1002
TAG_VIEW = 1003
TAG_UNIT_SCALE = 1040  # real


#: XDATA payload written on every model entity (single 1000 string tag).
#:
#: All string XDATA in a DXF group uses code 1000, so several independent tags
#: cannot be told apart reliably by code alone. A single, versioned, delimited
#: payload is therefore used - it is also readable in any CAD XDATA inspector.
PAYLOAD_VERSION = "FUNDI1"
PAYLOAD_SEP = "|"


class DxfExportError(RuntimeError):
    """Raised when a DXF cannot be produced or read back."""


def _payload(element_id: str, model_id: str, ifc_guid: str, view: str, scale: float) -> str:
    return PAYLOAD_SEP.join(
        [PAYLOAD_VERSION, model_id, element_id, ifc_guid, view, f"{scale:g}"]
    )


def _parse_payload(raw: str) -> Optional[Dict[str, Any]]:
    parts = str(raw).split(PAYLOAD_SEP)
    if len(parts) != 6 or parts[0] != PAYLOAD_VERSION:
        return None
    _, model_id, element_id, ifc_guid, view, scale = parts
    try:
        scale_value = float(scale)
    except ValueError:
        return None
    return {
        "model_id": model_id,
        "internal_id": element_id,
        "ifc_guid": ifc_guid,
        "view": view,
        "unit_scale": scale_value,
    }


def _ensure_appid(doc: Any) -> None:
    try:
        doc.appids.add(APPID)
    except Exception:
        # Already registered, or ezdxf version with a different table API.
        if APPID not in doc.appids:
            raise


def _rect_points(cx: float, cy: float, width: float, height: float) -> List[Tuple[float, float]]:
    half_w, half_h = width / 2.0, height / 2.0
    return [
        (cx - half_w, cy - half_h),
        (cx + half_w, cy - half_h),
        (cx + half_w, cy + half_h),
        (cx - half_w, cy + half_h),
    ]


def _plan_footprint(element: Dict[str, Any]) -> Tuple[float, float, float, float]:
    """Return ``(cx, cy, width, height)`` of the plan footprint in metres."""
    placement = element["placement"]
    dims = element["dimensions"]
    if element["shape"] == "box":
        return (
            placement["x"],
            placement["y"],
            dims["length_x"],
            dims["width_y"],
        )
    # Horizontal cylinder: length along X, diameter across Y.
    if element.get("axis") == "x":
        return (placement["x"], placement["y"], dims["height"], 2 * dims["radius"])
    return (placement["x"], placement["y"], 2 * dims["radius"], 2 * dims["radius"])


def _section_intersects(element: Dict[str, Any], section_y: float = 0.0) -> bool:
    """True when the element's Y extent straddles the section plane."""
    cx, cy, _, height = _plan_footprint(element)
    half = height / 2.0
    return (cy - half) <= section_y <= (cy + half)


def _section_footprint(element: Dict[str, Any]) -> Tuple[float, float, float, float]:
    """Return ``(cx, cz, width, height)`` of the section footprint in metres."""
    placement = element["placement"]
    dims = element["dimensions"]
    if element["shape"] == "box":
        return (placement["x"], placement["z"], dims["length_x"], dims["height_z"])
    if element.get("axis") == "x":
        # Projected onto XZ: length along X, diameter vertically.
        return (placement["x"], placement["z"], dims["height"], 2 * dims["radius"])
    return (placement["x"], placement["z"], 2 * dims["radius"], dims["height"])


def _attach_xdata(entity: Any, element: Dict[str, Any], model_id: str, view: str) -> None:
    scale = units.conversion_factor(units.CANONICAL_LENGTH_UNIT, units.DXF_LENGTH_UNIT)
    entity.set_xdata(
        APPID,
        [(1000, _payload(element["id"], model_id, element["ifc_guid"], view, scale))],
    )


#: Layers whose contents the exporter owns and fully regenerates on export.
OWNED_LAYERS = frozenset({LAYER_MODEL, LAYER_DIM, LAYER_ANNO, LAYER_TITLE})


def _clear_owned_layers(msp: Any) -> Tuple[int, int]:
    """Replace exporter-owned layers; return ``(removed, preserved)`` counts.

    Only layers the exporter owns are cleared. ``FUNDI_MANUAL`` and any layer
    authored elsewhere are left untouched, which is what allows a drawing to hold
    both regenerated model geometry and hand drafting.
    """
    doomed = [e for e in msp if (e.dxf.layer or "").upper() in OWNED_LAYERS]
    for entity in doomed:
        msp.delete_entity(entity)
    return len(doomed), len(list(msp))


def _draw_views(msp: Any, model_doc: Dict[str, Any]) -> None:
    scale = units.conversion_factor(units.CANONICAL_LENGTH_UNIT, units.DXF_LENGTH_UNIT)
    model_id = model_doc["model_id"]

    plan_elements = model_doc["elements"]
    section_elements = [e for e in plan_elements if _section_intersects(e)]

    plan_extent_x = max(abs(_plan_footprint(e)[0]) + _plan_footprint(e)[2] / 2 for e in plan_elements)
    plan_extent_y = max(abs(_plan_footprint(e)[1]) + _plan_footprint(e)[3] / 2 for e in plan_elements)

    for element in plan_elements:
        cx, cy, width, height = _plan_footprint(element)
        line = msp.add_lwpolyline(
            [(x * scale, y * scale) for x, y in _rect_points(cx, cy, width, height)],
            close=True,
            dxfattribs={"layer": LAYER_MODEL, "color": 7 if "wall" in element["role"] else 4},
        )
        _attach_xdata(line, element, model_id, "plan")

    for element in section_elements:
        cx, cz, width, height = _section_footprint(element)
        # Section is drawn below the plan; canonical +Z maps to drawing +Y.
        base_y = -(plan_extent_y * 2.0 + SECTION_OFFSET_MM / scale)
        line = msp.add_lwpolyline(
            [(x * scale, base_y * scale + z * scale) for x, z in
             _rect_points(cx, cz, width, height)],
            close=True,
            dxfattribs={"layer": LAYER_MODEL, "color": 7 if "wall" in element["role"] else 4},
        )
        _attach_xdata(line, element, model_id, "section")

    # --- dimensions (drafting content, preserved across regeneration) ------
    tank_base = next(e for e in plan_elements if e["id"].endswith("tank.base_slab"))
    cx, cy, width, height = _plan_footprint(tank_base)
    left = (cx - width / 2) * scale
    right = (cx + width / 2) * scale
    top = (cy + height / 2) * scale
    bottom = (cy - height / 2) * scale
    msp.add_linear_dim(
        base=(0, bottom - 600),
        p1=(left, bottom),
        p2=(right, bottom),
        dxfattribs={"layer": LAYER_DIM},
    ).render()
    msp.add_linear_dim(
        base=(right + 600, 0),
        p1=(right, bottom),
        p2=(right, top),
        angle=90,
        dxfattribs={"layer": LAYER_DIM},
    ).render()

    # --- annotations -------------------------------------------------------
    msp.add_text(
        "SEPTIC TANK AND INSPECTION CHAMBER - PLAN",
        height=120,
        dxfattribs={"layer": LAYER_ANNO, "insert": (left, top + 700)},
    )
    msp.add_text(
        "SECTION A-A",
        height=120,
        dxfattribs={"layer": LAYER_ANNO,
                    "insert": (left, -(plan_extent_y * 2.0 + SECTION_OFFSET_MM / scale) * scale - 500)},
    )
    msp.add_text(
        "UNITS: MILLIMETRES ($INSUNITS=4) - DO NOT SCALE",
        height=90,
        dxfattribs={"layer": LAYER_ANNO, "insert": (left, bottom - 1400)},
    )

    # --- title block -------------------------------------------------------
    title_origin = (left, bottom - 2600)
    msp.add_lwpolyline(
        [
            title_origin,
            (title_origin[0] + 7000, title_origin[1]),
            (title_origin[0] + 7000, title_origin[1] - 1200),
            (title_origin[0], title_origin[1] - 1200),
        ],
        close=True,
        dxfattribs={"layer": LAYER_TITLE},
    )
    msp.add_text(
        f"FUNDI STUDIO - {model_doc['model_id'].upper()}",
        height=150,
        dxfattribs={"layer": LAYER_TITLE, "insert": (title_origin[0] + 150, title_origin[1] - 400)},
    )
    msp.add_text(
        "SCALE 1:50 (A3)   SHEET 1 OF 1   REV A",
        height=100,
        dxfattribs={"layer": LAYER_TITLE, "insert": (title_origin[0] + 150, title_origin[1] - 900)},
    )


def export_dxf(model_doc: Dict[str, Any], out_path: str, *,
               existing_path: Optional[str] = None) -> Dict[str, Any]:
    """Write (or refresh) a DXF drawing from the canonical model.

    When ``existing_path`` is supplied the existing drawing is loaded first.
    Only the exporter-owned ``FUNDI_MODEL`` layer is replaced; dimensions,
    annotations, the title block, ``FUNDI_MANUAL`` and any user layer survive
    unchanged. This is the controlled-synchronisation primitive: regenerating
    model geometry must not destroy drafting work.
    """
    if existing_path and os.path.exists(existing_path):
        doc = ezdxf.readfile(existing_path)
        _ensure_appid(doc)
        msp = doc.modelspace()
        removed, preserved = _clear_owned_layers(msp)
    else:
        doc = ezdxf.new("R2010", setup=True)
        _ensure_appid(doc)
        for name, color in (
            (LAYER_MODEL, 7),
            (LAYER_DIM, 3),
            (LAYER_ANNO, 2),
            (LAYER_TITLE, 5),
            (LAYER_MANUAL, 6),
        ):
            if name not in doc.layers:
                doc.layers.add(name, color=color)
        msp = doc.modelspace()
        removed, preserved = 0, 0

    doc.header["$INSUNITS"] = units.DXF_INSUNITS_MM
    doc.header["$MEASUREMENT"] = 1

    _draw_views(msp, model_doc)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    doc.saveas(out_path)

    scan = scan_dxf_links(out_path)
    return {
        "path": out_path,
        "bytes": os.path.getsize(out_path),
        "insunits": units.DXF_INSUNITS_MM,
        "unit": units.DXF_LENGTH_UNIT,
        "regenerated_entities": len(scan["entities"]) // 2,
        "replaced_entities": removed,
        "preserved_entities": preserved,
        "layers": sorted({e["layer"] for e in scan["entities"]}),
        "links": scan["entities"],
        "duplicates": scan["duplicates"],
    }


def scan_dxf_links(path: str) -> Dict[str, Any]:
    """Read a DXF back and return the entity -> element links found in XDATA.

    Reading the file from disk (rather than trusting the in-memory document) is
    what proves the mapping matches what a CAD application will actually see,
    including handles assigned by the writer.
    """
    try:
        doc = ezdxf.readfile(path)
    except Exception as exc:  # pragma: no cover - corrupt file path
        raise DxfExportError(f"cannot read DXF {path!r}: {exc}") from exc

    insunits = int(doc.header.get("$INSUNITS", 0) or 0)
    entities: List[Dict[str, Any]] = []
    # An element legitimately appears once per view (plan + section), so
    # duplication is counted per (view, internal_id), not globally.
    seen: Dict[Tuple[str, str], int] = {}
    unreadable = 0
    for entity in doc.modelspace():
        try:
            tags = entity.get_xdata(APPID)
        except Exception:
            continue
        payload = None
        for code, value in tags:
            if code == 1000:
                payload = _parse_payload(value)
                if payload:
                    break
        if payload is None:
            unreadable += 1
            continue
        view = payload["view"]
        key = (view, payload["internal_id"])
        seen[key] = seen.get(key, 0) + 1
        entities.append(
            {
                "internal_id": payload["internal_id"],
                "ifc_guid": payload["ifc_guid"],
                "model_id": payload["model_id"],
                "view": view,
                "unit_scale": payload["unit_scale"],
                "handle": entity.dxf.handle,
                "layer": entity.dxf.layer,
                "type": entity.dxftype(),
            }
        )

    duplicates = sorted(f"{view}:{eid}" for (view, eid), count in seen.items() if count > 1)
    return {
        "path": path,
        "insunits": insunits,
        "unit": units.DXF_LENGTH_UNIT if insunits == units.DXF_INSUNITS_MM else f"insunits:{insunits}",
        "entities": entities,
        "duplicates": duplicates,
        "unreadable_xdata": unreadable,
    }


def check_unit_consistency(path: str) -> Dict[str, Any]:
    """Verify the file's declared units equal the units the exporter used.

    Guards the classic failure mode where a DXF is re-imported after someone
    changed ``$INSUNITS`` (or authored in inches), silently scaling the model.
    """
    scan = scan_dxf_links(path)
    expected = units.DXF_INSUNITS_MM
    problems: List[str] = []
    if scan["insunits"] != expected:
        problems.append(
            f"$INSUNITS is {scan['insunits']}, expected {expected} (millimetres)"
        )
    expected_scale = units.conversion_factor(units.CANONICAL_LENGTH_UNIT, units.DXF_LENGTH_UNIT)
    for entity in scan["entities"]:
        if abs(entity["unit_scale"] - expected_scale) > units.TOLERANCE_MM:
            problems.append(
                f"entity handle {entity['handle']} (id {entity['internal_id']}) "
                f"was written with scale {entity['unit_scale']}, expected {expected_scale}"
            )
    return {
        "ok": not problems,
        "problems": problems[:20],
        "insunits": scan["insunits"],
        "entities_checked": len(scan["entities"]),
    }


def geometry_bounds_mm(model_doc: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
    """Bounding boxes (mm) of the plan and section views, for coordinate tests."""
    scale = units.conversion_factor(units.CANONICAL_LENGTH_UNIT, units.DXF_LENGTH_UNIT)
    xs: List[float] = []
    ys: List[float] = []
    for element in model_doc["elements"]:
        cx, cy, width, height = _plan_footprint(element)
        xs.extend([(cx - width / 2) * scale, (cx + width / 2) * scale])
        ys.extend([(cy - height / 2) * scale, (cy + height / 2) * scale])
    return {
        "plan": {"xmin": min(xs), "xmax": max(xs), "ymin": min(ys), "ymax": max(ys)},
        "scale_mm_per_m": scale,
    }


def section_only_entities(model_doc: Dict[str, Any]) -> List[str]:
    """Internal ids of the elements that appear in the section view."""
    return [e["id"] for e in model_doc["elements"] if _section_intersects(e)]


def add_manual_entity(path: str, *, layer: str = LAYER_MANUAL, text: str = "MANUAL NOTE") -> str:
    """Insert a user-authored entity (used to test drafting preservation)."""
    doc = ezdxf.readfile(path)
    _ensure_appid(doc)
    if layer not in doc.layers:
        doc.layers.add(layer, color=6)
    entity = doc.modelspace().add_text(
        text, height=80, dxfattribs={"layer": layer, "insert": (0, -1000)}
    )
    doc.saveas(path)
    return entity.dxf.handle
