"""
Canonical, renderer independent engineering model for the septic system
generator.

Why this module exists
----------------------
The reachable generator for the septic system is
``src/components/takeoff2/septik/SepticScene.jsx``. It is a React Three Fiber
scene: its output is JSX ``<mesh>`` elements, i.e. *render instructions*, not a
model. Nothing downstream can export it, inspect it, or link a drawing entity
to it.

This module restates exactly the same geometry derivation (the arithmetic is
transcribed from ``SepticScene`` so the two cannot drift) but produces plain
data:

    parameters  ->  canonical model (dict/JSON)
                        |-> IFC  (ifc_export.py, semantic entities)
                        |-> DXF  (dxf_export.py, plan + section)
                        |-> 3D preview (the existing R3F renderer, unchanged)

The canonical model is the single source of truth for geometry in the
interoperability adapters. The existing generators are *not* modified and keep
rendering from their own parameters; ``SepticScene`` remains the fallback
renderer.

Coordinate frame: Z-up metres (see ``units.py``). R3F is Y-up, therefore every
``z`` below is the R3F ``y`` and every ``y`` is the negated R3F ``z``.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List

from . import identity, units

#: Schema tag of the canonical model document.
CANONICAL_SCHEMA = "fundi.canonical.model/1"

#: Model identifier of the septic system instance used by the proof of concept.
SEPTIC_MODEL_ID = "septic-system"

#: Concrete specification used by the takeoff backend (C25/30 walls, C20/25 base).
CONCRETE_MATERIAL = "Concrete C25/30"
PIPE_MATERIAL = "uPVC"


class ModelError(ValueError):
    """Raised when generator parameters cannot produce a valid model."""


def default_parameters() -> Dict[str, Any]:
    """Default parameters, matching ``septik_tank.jsx`` form defaults.

    Keeping these identical to the UI defaults means the proof of concept is
    driven by the real generator's inputs rather than invented numbers.
    """
    return {
        "tank_int_l": 3.0,
        "tank_int_w": 2.5,
        "tank_depth_int": 2.0,
        "wall_thick": 0.2,
        "bed_thick_tank": 0.15,
        "slab_thick": 0.2,
        "num_baffles": 2,
        "baffle_thick": 0.2,
        "baffle_heights": [1.5, 1.3],
        "manhole_int_l": 0.7,
        "manhole_int_w": 0.6,
        "manhole_depth_int": 0.7,
        "bed_thick_manhole": 0.15,
        "cover_l": 0.6,
        "cover_w": 0.45,
        "soakpit_diameter": 2.0,
        "soakpit_depth": 3.0,
        "soakpit_wall_thick": 0.23,
        "pipe_diameter": 0.15,
        "inlet_pipe_l": 1.0,
        "outlet_pipe_l": 1.0,
        "manhole_offset_x": 4.5,
        "connect_septic_to_manhole": True,
    }


def _require_positive(params: Dict[str, Any], key: str) -> float:
    try:
        value = float(params[key])
    except (KeyError, TypeError, ValueError) as exc:
        raise ModelError(f"parameter {key!r} must be a number") from exc
    if not math.isfinite(value) or value <= 0:
        raise ModelError(f"parameter {key!r} must be a positive finite number, got {value!r}")
    return value


def _element(
    *,
    model_id: str,
    role: str,
    index: int | None,
    ifc_class: str,
    predefined_type: str | None,
    name: str,
    material: str,
    shape: str,
    placement: tuple[float, float, float],
    dimensions: Dict[str, float],
    axis: str = "z",
    properties: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    internal_id = identity.make_element_id(model_id, role, index)
    element: Dict[str, Any] = {
        "id": internal_id,
        "ifc_guid": identity.ifc_guid_from_internal_id(internal_id),
        "ifc_class": ifc_class,
        "predefined_type": predefined_type,
        "name": name,
        "role": role,
        "level_id": "L0",
        "material": material,
        "shape": shape,
        "axis": axis,
        "placement": {"x": placement[0], "y": placement[1], "z": placement[2]},
        "rotation_z_deg": 0.0,
        "dimensions": dimensions,
        "properties": dict(properties or {}),
        "volume_m3": round(_volume(shape, dimensions), 6),
    }
    element["fingerprint"] = identity.element_fingerprint(element)
    return element


def _volume(shape: str, dims: Dict[str, float]) -> float:
    if shape == "box":
        return dims["length_x"] * dims["width_y"] * dims["height_z"]
    if shape == "cylinder":
        return math.pi * dims["radius"] ** 2 * dims["height"]
    raise ModelError(f"unsupported shape {shape!r}")


def _box_dims(length_x: float, width_y: float, height_z: float) -> Dict[str, float]:
    return {"length_x": length_x, "width_y": width_y, "height_z": height_z}


def _tank_elements(model_id: str, p: Dict[str, Any]) -> List[Dict[str, Any]]:
    int_l = _require_positive(p, "tank_int_l")
    int_w = _require_positive(p, "tank_int_w")
    depth = _require_positive(p, "tank_depth_int")
    wall = _require_positive(p, "wall_thick")
    bed = _require_positive(p, "bed_thick_tank")
    slab = _require_positive(p, "slab_thick")
    baffle_thick = _require_positive(p, "baffle_thick")
    pipe_d = _require_positive(p, "pipe_diameter")
    inlet_l = _require_positive(p, "inlet_pipe_l")
    outlet_l = _require_positive(p, "outlet_pipe_l")

    ext_l = int_l + 2 * wall
    ext_w = int_w + 2 * wall

    elements: List[Dict[str, Any]] = []

    # Base slab (SepticScene: position [0, bedThick/2, 0], args [extL, bedThick, extW])
    elements.append(
        _element(
            model_id=model_id,
            role="tank.base_slab",
            index=None,
            ifc_class="IfcSlab",
            predefined_type="BASESLAB",
            name="Septic tank base slab",
            material=CONCRETE_MATERIAL,
            shape="box",
            placement=(0.0, 0.0, bed / 2),
            dimensions=_box_dims(ext_l, ext_w, bed),
            properties={"Thickness": bed, "Grade": "C20/25"},
        )
    )

    # Walls: generator places front/back along X, left/right along Y.
    walls = (
        ("tank.wall.north", "Septic tank wall (north)", (0.0, ext_w / 2 - wall / 2, bed + depth / 2), _box_dims(ext_l, wall, depth)),
        ("tank.wall.south", "Septic tank wall (south)", (0.0, -(ext_w / 2 - wall / 2), bed + depth / 2), _box_dims(ext_l, wall, depth)),
        ("tank.wall.east", "Septic tank wall (east)", (ext_l / 2 - wall / 2, 0.0, bed + depth / 2), _box_dims(wall, ext_w, depth)),
        ("tank.wall.west", "Septic tank wall (west)", (-(ext_l / 2 - wall / 2), 0.0, bed + depth / 2), _box_dims(wall, ext_w, depth)),
    )
    for role, name, placement, dims in walls:
        elements.append(
            _element(
                model_id=model_id,
                role=role,
                index=None,
                ifc_class="IfcWall",
                predefined_type="SOLIDWALL",
                name=name,
                material=CONCRETE_MATERIAL,
                shape="box",
                placement=placement,
                dimensions=dims,
                properties={"Thickness": wall, "Grade": "C25/30"},
            )
        )

    # Baffles: SepticScene distributes them evenly inside the internal length.
    num_baffles = int(p.get("num_baffles") or 0)
    heights = p.get("baffle_heights") or []
    for i in range(num_baffles):
        spacing = int_l / (num_baffles + 1)
        baffle_x = -int_l / 2 + spacing * (i + 1)
        height = float(heights[i]) if i < len(heights) else 1.5
        if height <= 0:
            raise ModelError(f"baffle height {i + 1} must be positive")
        elements.append(
            _element(
                model_id=model_id,
                role="tank.baffle",
                index=i + 1,
                ifc_class="IfcWall",
                predefined_type="PARTITIONING",
                name=f"Septic tank baffle {i + 1}",
                material=CONCRETE_MATERIAL,
                shape="box",
                placement=(baffle_x, 0.0, bed + height / 2),
                dimensions=_box_dims(baffle_thick, int_w, height),
                properties={"Height": height, "Thickness": baffle_thick},
            )
        )

    # Top slab. The 600 x 450 access opening is recorded as a property because
    # creating a real IfcOpeningElement void is not implemented in this PoC.
    elements.append(
        _element(
            model_id=model_id,
            role="tank.top_slab",
            index=None,
            ifc_class="IfcSlab",
            predefined_type="ROOF",
            name="Septic tank cover slab",
            material=CONCRETE_MATERIAL,
            shape="box",
            placement=(0.0, 0.0, bed + depth + slab / 2),
            dimensions=_box_dims(ext_l, ext_w, slab),
            properties={
                "Thickness": slab,
                "Grade": "C25/30",
                "AccessOpeningLength": 0.6,
                "AccessOpeningWidth": 0.45,
                "VoidModelling": "not_modelled",
            },
        )
    )

    # Pipes. Generator: inlet at depth*0.7, outlet at depth*0.6, both horizontal
    # along X (rotation z=-90 deg applied to a Y-axis cylinder in R3F).
    elements.append(
        _element(
            model_id=model_id,
            role="tank.inlet_pipe",
            index=None,
            ifc_class="IfcPipeSegment",
            predefined_type="RIGIDSEGMENT",
            name="Septic tank inlet pipe",
            material=PIPE_MATERIAL,
            shape="cylinder",
            axis="x",
            placement=(-ext_l / 2 - inlet_l / 2, 0.0, bed + depth * 0.7),
            dimensions={"radius": pipe_d / 2, "height": inlet_l},
            properties={"Diameter": pipe_d, "FlowDirection": "inlet"},
        )
    )
    elements.append(
        _element(
            model_id=model_id,
            role="tank.outlet_pipe",
            index=None,
            ifc_class="IfcPipeSegment",
            predefined_type="RIGIDSEGMENT",
            name="Septic tank outlet pipe",
            material=PIPE_MATERIAL,
            shape="cylinder",
            axis="x",
            placement=(ext_l / 2 + outlet_l / 2, 0.0, bed + depth * 0.6),
            dimensions={"radius": pipe_d / 2, "height": outlet_l},
            properties={"Diameter": pipe_d, "FlowDirection": "outlet"},
        )
    )

    return elements


def _manhole_elements(model_id: str, p: Dict[str, Any], *, ext_l_tank: float) -> List[Dict[str, Any]]:
    int_l = _require_positive(p, "manhole_int_l")
    int_w = _require_positive(p, "manhole_int_w")
    depth = _require_positive(p, "manhole_depth_int")
    wall = _require_positive(p, "wall_thick")
    bed = _require_positive(p, "bed_thick_manhole")
    cover_l = _require_positive(p, "cover_l")
    cover_w = _require_positive(p, "cover_w")
    offset_x = float(p.get("manhole_offset_x", 4.5))

    ext_l = int_l + 2 * wall
    ext_w = int_w + 2 * wall
    cx = offset_x
    cy = 0.0

    elements: List[Dict[str, Any]] = []
    elements.append(
        _element(
            model_id=model_id,
            role="manhole.base_slab",
            index=None,
            ifc_class="IfcSlab",
            predefined_type="BASESLAB",
            name="Inspection chamber base slab",
            material=CONCRETE_MATERIAL,
            shape="box",
            placement=(cx, cy, bed / 2),
            dimensions=_box_dims(ext_l, ext_w, bed),
            properties={"Thickness": bed, "Grade": "C20/25"},
        )
    )

    walls = (
        ("manhole.wall.north", (cx, cy + ext_w / 2 - wall / 2, bed + depth / 2), _box_dims(ext_l, wall, depth)),
        ("manhole.wall.south", (cx, cy - (ext_w / 2 - wall / 2), bed + depth / 2), _box_dims(ext_l, wall, depth)),
        ("manhole.wall.east", (cx + ext_l / 2 - wall / 2, cy, bed + depth / 2), _box_dims(wall, ext_w, depth)),
        ("manhole.wall.west", (cx - (ext_l / 2 - wall / 2), cy, bed + depth / 2), _box_dims(wall, ext_w, depth)),
    )
    for role, placement, dims in walls:
        elements.append(
            _element(
                model_id=model_id,
                role=role,
                index=None,
                ifc_class="IfcWall",
                predefined_type="SOLIDWALL",
                name=f"Inspection chamber wall ({role.rsplit('.', 1)[-1]})",
                material=CONCRETE_MATERIAL,
                shape="box",
                placement=placement,
                dimensions=dims,
                properties={"Thickness": wall, "Grade": "C25/30"},
            )
        )

    cover_thick = 0.15
    elements.append(
        _element(
            model_id=model_id,
            role="manhole.cover_slab",
            index=None,
            ifc_class="IfcSlab",
            predefined_type="ROOF",
            name="Inspection chamber cover slab",
            material=CONCRETE_MATERIAL,
            shape="box",
            placement=(cx, cy, bed + depth + cover_thick / 2),
            dimensions=_box_dims(ext_l, ext_w, cover_thick),
            properties={"Thickness": cover_thick, "Grade": "C25/30"},
        )
    )
    elements.append(
        _element(
            model_id=model_id,
            role="manhole.cover",
            index=None,
            ifc_class="IfcSlab",
            predefined_type="NOTDEFINED",
            name="Inspection chamber cover",
            material="Cast iron",
            shape="box",
            placement=(cx, cy, bed + depth + cover_thick + 0.025),
            dimensions=_box_dims(cover_l, cover_w, 0.05),
            properties={"Thickness": 0.05, "Grade": "heavy duty"},
        )
    )

    # Connection pipe tank -> chamber, mirroring SepticScene's Connections block.
    if p.get("connect_septic_to_manhole"):
        pipe_d = _require_positive(p, "pipe_diameter")
        tank_half = ext_l_tank / 2
        distance = cx - tank_half
        if distance <= units.TOLERANCE_M:
            raise ModelError(
                "manhole_offset_x places the chamber inside the tank; connection pipe has no length"
            )
        elements.append(
            _element(
                model_id=model_id,
                role="connection.tank_to_manhole",
                index=None,
                ifc_class="IfcPipeSegment",
                predefined_type="RIGIDSEGMENT",
                name="Septic tank to inspection chamber pipe",
                material=PIPE_MATERIAL,
                shape="cylinder",
                axis="x",
                placement=(tank_half + distance / 2, 0.0, null_safe_depth(p)),
                dimensions={"radius": pipe_d / 2, "height": distance},
                properties={"Diameter": pipe_d, "Length": distance},
            )
        )

    return elements


def null_safe_depth(p: Dict[str, Any]) -> float:
    """Elevation of the connecting pipe invert used by ``SepticScene``."""
    bed = float(p.get("bed_thick_tank", 0.15))
    depth = float(p.get("tank_depth_int", 2.0))
    return bed + depth * 0.6


def build_model(params: Dict[str, Any] | None = None, *, model_id: str = SEPTIC_MODEL_ID) -> Dict[str, Any]:
    """Build the canonical model document from septic system parameters.

    The returned mapping is JSON serialisable and is the contract between the
    engineering domain layer and every downstream adapter.
    """
    merged = default_parameters()
    if params:
        merged.update({k: v for k, v in params.items() if v is not None})

    wall = _require_positive(merged, "wall_thick")
    ext_l_tank = _require_positive(merged, "tank_int_l") + 2 * wall

    elements = _tank_elements(model_id, merged)
    elements += _manhole_elements(model_id, merged, ext_l_tank=ext_l_tank)

    model = {
        "schema": CANONICAL_SCHEMA,
        "model_id": model_id,
        "generator": "takeoff2/septik/SepticScene",
        "name": "Septic tank, inspection chamber and connection",
        "units": units.describe_units(),
        "coordinate_system": {
            "handedness": "right",
            "up_axis": "Z",
            "origin": "centre of the septic tank base slab at underside level",
            "true_north_deg": 0.0,
            "r3f_transform": "IFC_X = R3F_X, IFC_Y = -R3F_Z, IFC_Z = R3F_Y",
        },
        "levels": [
            {"id": "L0", "name": "Ground level", "elevation_m": 0.0},
        ],
        "parameters": {k: merged[k] for k in sorted(merged)},
        "derived": {
            "tank_external_length_m": round(ext_l_tank, 6),
            "tank_external_width_m": round(
                _require_positive(merged, "tank_int_w") + 2 * wall, 6
            ),
            "tank_external_height_m": round(
                _require_positive(merged, "bed_thick_tank")
                + _require_positive(merged, "tank_depth_int")
                + _require_positive(merged, "slab_thick"),
                6,
            ),
        },
        "elements": elements,
    }
    model["statistics"] = {
        "element_count": len(elements),
        "by_ifc_class": _count_by(elements, "ifc_class"),
        "by_material": _count_by(elements, "material"),
        "total_volume_m3": round(sum(e["volume_m3"] for e in elements), 6),
    }
    return model


def _count_by(elements: List[Dict[str, Any]], key: str) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for element in elements:
        counts[element[key]] = counts.get(element[key], 0) + 1
    return dict(sorted(counts.items()))


def element_by_id(model: Dict[str, Any], internal_id: str) -> Dict[str, Any] | None:
    """Look up a single canonical element by internal id."""
    for element in model["elements"]:
        if element["id"] == internal_id:
            return element
    return None


def model_hash(model: Dict[str, Any]) -> str:
    """Content hash of the model used for revision tracking."""
    payload = {
        "parameters": model["parameters"],
        "elements": [
            {"id": e["id"], "fingerprint": e["fingerprint"]} for e in model["elements"]
        ],
    }
    return identity.geometry_hash(payload)
