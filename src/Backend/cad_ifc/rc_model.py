"""
Canonical engineering model for the existing RC detailing generators.

What this module does and does not do
-------------------------------------
It **does** turn one run of an existing generator into a
:mod:`cad_ifc.canonical` document: stable element ids, gross concrete geometry in
metres, the authoritative design parameters, the reinforcement the generator
computed, provenance back to the generator module, and validation state.

It **does not** re-derive any engineering value. Every dimension it records is
read from the generator's own engineering model (``Member.dimensions``,
``StairEngineeringModel.slope_length_mm``, ``PadFootingParams.lx_mm`` …) or from
the design parameters the user supplied. Where a quantity genuinely does not
exist in the generator (a stair's width, a retaining-wall section's length along
the wall), the model records an explicit **assumption** and marks the element's
validation state as ``warning`` instead of inventing a silent default.

Geometry conventions (canonical frame)
--------------------------------------
* Units: **metres**. Z is up. ``x`` is east, ``y`` is north.
* A member's plan centre is the model origin; horizontal members astride the
  origin along ``x``.
* Vertical members (column, wall, stem) sit on the level elevation: base at
  ``z = elevation``, so the placement stored is the *centre* of the solid at
  ``elevation + height/2``.
* Horizontal members (beam, slab) have their **soffit** at the level elevation.
* Every one of these conventions is also written into the element's
  ``provenance.geometry_convention`` so a reader never has to infer it.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

from . import canonical, generator_registry, identity, units

#: Level id suffix used for the single storey these member models live on.
DEFAULT_LEVEL_NAME = "Level 1"

MM = 0.001  #: millimetres -> metres


class RcModelError(ValueError):
    """Raised when a generator run cannot be expressed in the canonical model."""


def _m(value_mm: Any) -> float:
    """Millimetres to canonical metres, rounded to nanometre-level precision."""
    return round(float(value_mm) * MM, 9)


def _enum_value(value: Any) -> Any:
    """Unwrap ``str``-valued enums used by the engineering core."""
    return getattr(value, "value", value)


def _bar_groups(model: Any) -> List[Dict[str, Any]]:
    """Serialise the reinforcement the generator computed, without changing it.

    ``Member.bar_groups`` is the detailing system's own bar list (shape code,
    size, count, cut length, weight as calculated by ``BS8666Catalogue``). Copying
    it verbatim is what lets the canonical model carry "reinforcement and
    detailing information" that agrees with the drawing and the schedule.
    """
    groups = getattr(model, "bar_groups", None)
    if not groups:
        return []
    serialised: List[Dict[str, Any]] = []
    for group in groups:
        rebar = getattr(group, "rebar", None)
        serialised.append(
            {
                "group_id": getattr(group, "group_id", ""),
                "shape_code": getattr(rebar, "shape_code", ""),
                "bar_mark": getattr(rebar, "bar_mark", ""),
                "bar_size_mm": getattr(rebar, "bar_size", None),
                "count": getattr(group, "count", None),
                "pitch_mm": getattr(group, "pitch_mm", None),
                "cut_length_mm": round(float(getattr(rebar, "length_mm", 0.0) or 0.0), 3),
                "weight_kg": round(float(getattr(rebar, "weight_kg", 0.0) or 0.0), 3),
                "layer": _enum_value(getattr(group, "layer", None)),
                "bend_dimensions_mm": {
                    k: round(float(v), 3)
                    for k, v in (getattr(rebar, "dimensions", {}) or {}).items()
                },
                "grade": getattr(rebar, "grade", None),
            }
        )
    return serialised


def _model_warnings(model: Any) -> List[str]:
    """Collect any warnings the generator itself raised."""
    raw = getattr(model, "warnings", None) or []
    messages: List[str] = []
    for item in raw:
        if isinstance(item, str):
            messages.append(item)
        else:
            text = getattr(item, "message", None) or str(item)
            messages.append(str(text))
    return messages


def _parameter_properties(params: Any, *, prefix: str = "") -> Dict[str, Any]:
    """Flatten the generator's parameter object into scalar properties."""
    import dataclasses

    properties: Dict[str, Any] = {}
    if not dataclasses.is_dataclass(params):
        return properties
    for field in dataclasses.fields(params):
        value = getattr(params, field.name)
        value = _enum_value(value)
        if isinstance(value, (str, int, float, bool)) or value is None:
            if value is None or isinstance(value, str):
                properties[f"{prefix}{field.name}"] = "" if value is None else value
            else:
                properties[f"{prefix}{field.name}"] = value
        elif isinstance(value, tuple):
            properties[f"{prefix}{field.name}"] = ", ".join(str(v) for v in value)
    return properties


def _draft(
    role: str,
    element_type: str,
    name: str,
    shape: str,
    axis: str,
    dimensions_m: Dict[str, float],
    placement_m: Dict[str, float],
    *,
    material: str,
    properties: Dict[str, Any],
    reinforcement: Optional[Dict[str, Any]] = None,
    warnings: Optional[List[str]] = None,
    assumptions: Optional[List[str]] = None,
    rotation_z_deg: float = 0.0,
    extrusion: Optional[Dict[str, Any]] = None,
    parent_role: Optional[str] = None,
) -> Dict[str, Any]:
    """One element draft, before it is given an id and a level."""
    return {
        "role": role,
        "element_type": element_type,
        "name": name,
        "shape": shape,
        "axis": axis,
        "dimensions": dimensions_m,
        "placement": placement_m,
        "rotation_z_deg": rotation_z_deg,
        "material": material,
        "properties": properties,
        "reinforcement": reinforcement or {},
        "warnings": list(warnings or []),
        "assumptions": list(assumptions or []),
        "extrusion": extrusion,
        "parent_role": parent_role,
    }


def _concrete_grade(params: Any, model: Any = None) -> str:
    """Return the concrete grade exactly as the generator states it.

    The engineering model is preferred over the parameter object because the
    ``Member`` family stores the grade string it actually designed to
    (``C30/37``), while the params only carry ``fck_MPa`` (``30``). Reporting
    ``C30`` when the generator says ``C30/37`` would be a quiet loss of
    information, so the order is model -> params string -> fck.
    """
    grade = getattr(model, "concrete_grade", None)
    if grade:
        return str(grade)
    grade = getattr(params, "concrete_grade", None)
    if grade:
        return str(grade)
    fck = getattr(params, "fck_MPa", None)
    if fck:
        return f"C{float(fck):g}"
    return "concrete (grade not stated by generator)"


def _member_properties(params: Any, model: Any) -> Dict[str, Any]:
    """Design inputs plus the derived values the generator reported."""
    properties = _parameter_properties(params)
    metadata = getattr(model, "metadata", None) or {}
    for key, value in metadata.items():
        value = _enum_value(value)
        if isinstance(value, bool):
            properties[f"derived_{key}"] = value
        elif isinstance(value, (int, float)):
            properties[f"derived_{key}"] = round(float(value), 4)
        elif isinstance(value, str):
            properties[f"derived_{key}"] = value
    return properties


# ---------------------------------------------------------------------------
# Per-generator geometry builders
# ---------------------------------------------------------------------------


def _beam_drafts(spec: Any, params: Any, model: Any, level_m: float) -> List[Dict[str, Any]]:
    dims = model.dimensions
    length_m = _m(dims["span_clear"] + dims["support_left"] + dims["support_right"])
    width_m = _m(dims["width"])
    depth_m = _m(dims["depth"])
    return [
        _draft(
            role="beam",
            element_type=canonical.ET_BEAM,
            name="Suspended beam",
            shape="box",
            axis="x",
            dimensions_m={"length_x": length_m, "width_y": width_m, "height_z": depth_m},
            placement_m={"x": 0.0, "y": 0.0, "z": round(level_m + depth_m / 2.0, 9)},
            material=_concrete_grade(params, model),
            properties={
                **_member_properties(params, model),
                "span_clear_m": _m(dims["span_clear"]),
                "support_left_m": _m(dims["support_left"]),
                "support_right_m": _m(dims["support_right"]),
                "overall_length_m": length_m,
                "section_width_m": width_m,
                "section_depth_m": depth_m,
                "soffit_elevation_m": round(level_m, 9),
            },
            reinforcement={"bar_groups": _bar_groups(model)},
            warnings=_model_warnings(model),
        )
    ]


def _column_drafts(spec: Any, params: Any, model: Any, level_m: float) -> List[Dict[str, Any]]:
    dims = model.dimensions
    width_m = _m(dims["width"])
    depth_m = _m(dims["depth"])
    height_m = _m(dims["height"])
    return [
        _draft(
            role="column",
            element_type=canonical.ET_COLUMN,
            name="RC column",
            shape="box",
            axis="z",
            dimensions_m={"length_x": width_m, "width_y": depth_m, "height_z": height_m},
            placement_m={"x": 0.0, "y": 0.0, "z": round(level_m + height_m / 2.0, 9)},
            material=_concrete_grade(params, model),
            properties={
                **_member_properties(params, model),
                "section_width_m": width_m,
                "section_depth_m": depth_m,
                "height_m": height_m,
                "base_elevation_m": round(level_m, 9),
                "lap_length_m": _m(dims.get("lap_length", 0.0)),
            },
            reinforcement={"bar_groups": _bar_groups(model)},
            warnings=_model_warnings(model),
        )
    ]


def _slab_drafts(spec: Any, params: Any, model: Any, level_m: float) -> List[Dict[str, Any]]:
    dims = model.dimensions
    length_m = _m(dims["span_clear"] + dims["support_left"] + dims["support_right"])
    width_m = _m(dims["width"])
    thickness_m = _m(dims["thickness"])
    return [
        _draft(
            role="slab",
            element_type=canonical.ET_SLAB,
            name="Solid slab strip",
            shape="box",
            axis="z",
            dimensions_m={
                "length_x": length_m,
                "width_y": width_m,
                "height_z": thickness_m,
            },
            placement_m={"x": 0.0, "y": 0.0, "z": round(level_m + thickness_m / 2.0, 9)},
            material=_concrete_grade(params, model),
            properties={
                **_member_properties(params, model),
                "span_clear_m": _m(dims["span_clear"]),
                "strip_width_m": width_m,
                "thickness_m": thickness_m,
                "soffit_elevation_m": round(level_m, 9),
            },
            reinforcement={"bar_groups": _bar_groups(model)},
            warnings=_model_warnings(model)
            + [
                "the generator designs a one-metre design strip; the model is that "
                "strip, not the full slab field"
            ],
            assumptions=[
                "slab_width_mm is the design strip width (default 1000 mm), not the "
                "full slab width"
            ],
        )
    ]


def _wall_drafts(spec: Any, params: Any, model: Any, level_m: float) -> List[Dict[str, Any]]:
    length_m = _m(params.length_mm)
    thickness_m = _m(params.thickness_mm)
    height_m = _m(params.height_mm)
    warnings = _model_warnings(model)
    if getattr(params, "opening", None):
        warnings.append(
            "the wall opening is detailed in the drawing but is not cut out of the "
            "IFC solid representation"
        )
    return [
        _draft(
            role="wall",
            element_type=canonical.ET_WALL,
            name="RC wall",
            shape="box",
            axis="z",
            dimensions_m={
                "length_x": length_m,
                "width_y": thickness_m,
                "height_z": height_m,
            },
            placement_m={"x": 0.0, "y": 0.0, "z": round(level_m + height_m / 2.0, 9)},
            material=_concrete_grade(params, model),
            properties={
                **_parameter_properties(params),
                "length_m": length_m,
                "thickness_m": thickness_m,
                "height_m": height_m,
                "As_vertical_mm2_per_m": round(
                    float(getattr(model, "As_v_mm2_per_m", 0.0) or 0.0), 3
                ),
                "As_horizontal_mm2_per_m": round(
                    float(getattr(model, "As_h_mm2_per_m", 0.0) or 0.0), 3
                ),
            },
            reinforcement={
                "vertical_bar_mm": getattr(model, "vdia", None),
                "vertical_pitch_mm": getattr(model, "vpitch", None),
                "horizontal_bar_mm": getattr(model, "hdia", None),
                "horizontal_pitch_mm": getattr(model, "hpitch", None),
                "cover_mm": getattr(model, "cover_mm", None),
            },
            warnings=warnings,
        )
    ]


def _retaining_wall_drafts(spec: Any, params: Any, model: Any,
                           level_m: float) -> List[Dict[str, Any]]:
    """Stem and base as two elements: the section detail has no wall length."""
    base_thickness_m = _m(params.base_thickness_mm)
    stem_height_m = _m(params.stem_height_mm)
    stem_thickness_m = _m(params.stem_thickness_mm)
    base_length_m = _m(params.base_length_mm)
    assumed_length_m = 1.0
    assumption = (
        "MRW1 is a section-only detail; it defines no length along the wall, so the "
        "model is one metre of wall and the quantity of concrete is per metre run"
    )
    common_properties = {
        **_parameter_properties(params),
        "wall_length_modelled_m": assumed_length_m,
        "base_elevation_m": round(level_m, 9),
    }
    return [
        _draft(
            role="stem",
            element_type=canonical.ET_RETAINING_WALL,
            name="Retaining wall stem",
            shape="box",
            axis="z",
            dimensions_m={
                "length_x": stem_thickness_m,
                "width_y": assumed_length_m,
                "height_z": stem_height_m,
            },
            placement_m={
                "x": 0.0,
                "y": 0.0,
                "z": round(level_m + base_thickness_m + stem_height_m / 2.0, 9),
            },
            material=_concrete_grade(params, model),
            properties={
                **common_properties,
                "stem_height_m": stem_height_m,
                "stem_thickness_m": stem_thickness_m,
            },
            reinforcement={
                "earth_face_bar_mm": params.vdia_earth_mm,
                "earth_face_pitch_mm": params.vpitch_earth_mm,
                "horizontal_bar_mm": params.hdia_mm,
                "horizontal_pitch_mm": params.hpitch_mm,
                "cover_earth_mm": params.cover_earth_mm,
            },
            assumptions=[assumption],
            warnings=_model_warnings(model),
        ),
        _draft(
            role="base",
            element_type=canonical.ET_PAD_FOOTING,
            name="Retaining wall base",
            shape="box",
            axis="z",
            dimensions_m={
                "length_x": base_length_m,
                "width_y": assumed_length_m,
                "height_z": base_thickness_m,
            },
            placement_m={"x": 0.0, "y": 0.0, "z": round(level_m + base_thickness_m / 2.0, 9)},
            material=_concrete_grade(params, model),
            properties={
                **common_properties,
                "base_length_m": base_length_m,
                "toe_length_m": _m(params.toe_length_mm),
                "base_thickness_m": base_thickness_m,
            },
            reinforcement={
                "base_bar_mm": params.base_dia_mm,
                "base_pitch_mm": params.base_pitch_mm,
                "cover_base_mm": params.cover_base_mm,
            },
            assumptions=[assumption],
        ),
    ]


def _pad_footing_drafts(spec: Any, params: Any, model: Any,
                        level_m: float) -> List[Dict[str, Any]]:
    lx_m = _m(params.lx_mm)
    ly_m = _m(params.ly_mm)
    depth_m = _m(params.depth_mm)
    return [
        _draft(
            role="footing",
            element_type=canonical.ET_PAD_FOOTING,
            name="Pad footing",
            shape="box",
            axis="z",
            dimensions_m={"length_x": lx_m, "width_y": ly_m, "height_z": depth_m},
            placement_m={"x": 0.0, "y": 0.0, "z": round(level_m + depth_m / 2.0, 9)},
            material=_concrete_grade(params, model),
            properties={
                **_parameter_properties(params),
                "length_x_m": lx_m,
                "width_y_m": ly_m,
                "depth_m": depth_m,
                "column_stub_x_m": _m(params.cx_mm),
                "column_stub_y_m": _m(params.cy_mm),
                "effective_depth_m": _m(getattr(model, "d_eff_mm", 0.0)),
                "anchorage_provided_m": _m(getattr(model, "available_anchorage_x_mm", 0.0)),
                "anchorage_required_m": _m(getattr(model, "anchorage_length_mm", 0.0)),
            },
            reinforcement={
                "bottom_bar_mm": params.bar_dia_mm,
                "bottom_pitch_mm": params.pitch_mm,
                "cover_mm": params.cover_mm,
                "starter_bar_mm": params.starter_dia_mm,
                "starter_count": params.n_starters,
                "starter_lap_mm": round(float(getattr(model, "starter_lap_mm", 0.0) or 0.0), 3),
            },
            warnings=_model_warnings(model),
        )
    ]


def _stair_drafts(spec: Any, params: Any, model: Any, level_m: float) -> List[Dict[str, Any]]:
    """Stair as ``IfcStair`` containing an inclined flight and optional landing."""
    going_m = _m(params.going_mm)
    rise_m = _m(params.rise_mm)
    waist_m = _m(params.waist_mm)
    run_m = _m(getattr(model, "run_mm", params.going_mm * params.n_steps))
    rise_total_m = _m(getattr(model, "rise_total_mm", params.rise_mm * params.n_steps))
    slope_length_m = _m(
        getattr(model, "slope_length_mm", math.hypot(run_m, rise_total_m))
    )
    landing_m = _m(params.landing_length_mm)

    # The generator models a 2D section and never states a stair width.
    assumed_width_m = 1.0
    assumption = (
        "the MST section detail defines no stair width, so a one metre width is "
        "modelled and the IFC quantity is per metre width"
    )

    theta = math.atan2(rise_total_m, run_m) if run_m else 0.0
    direction = [round(math.cos(theta), 9), 0.0, round(math.sin(theta), 9)]

    flight_length_m = slope_length_m
    # Place the flight so its lower end is at the origin.
    flight_start = [0.0, 0.0, round(level_m, 9)]
    flight_centre = [
        round(flight_start[0] + direction[0] * flight_length_m / 2.0, 9),
        0.0,
        round(flight_start[2] + direction[2] * flight_length_m / 2.0 - (waist_m / 2.0) * direction[2], 9),
    ]

    drafts = [
        _draft(
            role="stair",
            element_type=canonical.ET_STAIR,
            name="Stair flight (aggregate)",
            shape="box",
            axis="z",
            dimensions_m={
                "length_x": round(run_m + landing_m, 9) or run_m,
                "width_y": assumed_width_m,
                "height_z": rise_total_m,
            },
            placement_m={
                "x": round((run_m + landing_m) / 2.0, 9),
                "y": 0.0,
                "z": round(level_m + rise_total_m / 2.0, 9),
            },
            material=_concrete_grade(params, model),
            properties={
                **_parameter_properties(params),
                "run_m": run_m,
                "rise_total_m": rise_total_m,
                "slope_length_m": slope_length_m,
                "waist_m": waist_m,
                "landing_length_m": landing_m,
                "step_count": params.n_steps,
                "going_m": going_m,
                "rise_m": rise_m,
                "slope_angle_deg": round(math.degrees(theta), 6),
            },
            warnings=_model_warnings(model)
            + [
                "the aggregate stair solid is a bounding volume; the flight carries "
                "the inclined waist-slab representation"
            ],
            assumptions=[assumption],
        ),
        _draft(
            role="flight",
            element_type=canonical.ET_STAIR_FLIGHT,
            name="Stair flight waist",
            shape="box",
            axis="z",
            dimensions_m={
                "length_x": flight_length_m,
                "width_y": assumed_width_m,
                "height_z": waist_m,
            },
            placement_m={
                "x": 0.0,
                "y": 0.0,
                "z": round(level_m + rise_total_m / 2.0, 9),
            },
            material=_concrete_grade(params, model),
            properties={
                "slope_length_m": slope_length_m,
                "waist_m": waist_m,
                "slope_angle_deg": round(math.degrees(theta), 6),
                "flight_width_m": assumed_width_m,
            },
            reinforcement={
                "main_bar_mm": params.main_dia_mm,
                "main_pitch_mm": params.main_pitch_mm,
                "distribution_bar_mm": params.distribution_dia_mm,
                "distribution_pitch_mm": params.distribution_pitch_mm,
            },
            assumptions=[assumption],
            extrusion={
                "direction": direction,
                "length_m": flight_length_m,
                "profile": "width_x_waist",
            },
            parent_role="stair",
        ),
    ]

    if landing_m > 0:
        drafts.append(
            _draft(
                role="landing",
                element_type=canonical.ET_SLAB,
                name="Stair landing",
                shape="box",
                axis="z",
                dimensions_m={
                    "length_x": landing_m,
                    "width_y": assumed_width_m,
                    "height_z": waist_m,
                },
                placement_m={
                    "x": round(run_m + landing_m / 2.0, 9),
                    "y": 0.0,
                    "z": round(level_m + rise_total_m - waist_m / 2.0, 9),
                },
                material=_concrete_grade(params, model),
                properties={
                    "landing_length_m": landing_m,
                    "landing_thickness_m": waist_m,
                    "landing_elevation_m": round(level_m + rise_total_m, 9),
                },
                assumptions=[assumption],
                parent_role="stair",
            )
        )
    return drafts


_DRAFT_BUILDERS = {
    "beam": _beam_drafts,
    "column": _column_drafts,
    "slab": _slab_drafts,
    "wall": _wall_drafts,
    "retaining_wall": _retaining_wall_drafts,
    "pad_footing": _pad_footing_drafts,
    "stair": _stair_drafts,
    "stair_mst2": _stair_drafts,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def default_model_id(generator_key: str) -> str:
    """Stable default model id for a generator (identity survives regeneration)."""
    return generator_key.replace("_", "-")


def build_model(
    generator_key: str,
    overrides: Optional[Dict[str, Any]] = None,
    *,
    model_id: Optional[str] = None,
    level_elevation_m: float = 0.0,
    level_name: str = DEFAULT_LEVEL_NAME,
) -> Dict[str, Any]:
    """Build the canonical model for one RC generator run.

    ``overrides`` are validated against the generator's own parameter schema by
    :mod:`cad_ifc.generator_registry` before anything is generated, so an unknown
    or mistyped parameter cannot reach the detailing rules.
    """
    spec = generator_registry.get_spec(generator_key)
    params = generator_registry.build_params(spec, overrides)
    engineering_model = generator_registry.build_model(spec, params)

    model_id = model_id or default_model_id(generator_key)
    resolved_level_id = f"{model_id}:L0"
    document = canonical.make_model(
        model_id,
        name=spec.label,
        generator=spec.key,
        source_params=_parameter_properties(params),
        levels=[
            {
                "id": resolved_level_id,
                "name": level_name,
                "elevation_m": float(level_elevation_m),
                "description": "Single storey used by the member model detail",
            }
        ],
        description=spec.description,
        generator_module=spec.params_module,
    )

    builder = _DRAFT_BUILDERS.get(generator_key)
    if builder is None:
        raise RcModelError(
            f"generator {generator_key!r} has no canonical geometry builder; "
            f"available: {sorted(_DRAFT_BUILDERS)}"
        )

    drafts = builder(spec, params, engineering_model, float(level_elevation_m))
    role_to_id: Dict[str, str] = {}
    for draft in drafts:
        internal_id = identity.make_element_id(model_id, draft["role"])
        role_to_id[draft["role"]] = internal_id

    for draft in drafts:
        internal_id = role_to_id[draft["role"]]
        parent_id = role_to_id.get(draft["parent_role"]) if draft["parent_role"] else None
        if draft["parent_role"] and parent_id is None:
            raise RcModelError(
                f"{internal_id}: parent role {draft['parent_role']!r} was not built"
            )
        warnings = list(draft["warnings"]) + list(draft["assumptions"])
        element = canonical.make_element(
            internal_id,
            draft["element_type"],
            draft["name"],
            draft["shape"],
            draft["dimensions"],
            draft["placement"],
            resolved_level_id,
            material=draft["material"],
            material_properties=_material_properties(params),
            rotation_z_deg=draft["rotation_z_deg"],
            axis=draft["axis"],
            role=draft["role"],
            properties=draft["properties"],
            reinforcement=draft["reinforcement"],
            provenance={
                "generator": spec.key,
                "generator_label": spec.label,
                "params_module": spec.params_module,
                "params_class": spec.params_name,
                "model_class": spec.model_name,
                "drawing_number": spec.drawing_number,
                "drawing_title": spec.drawing_title,
                "drawing_scale": spec.scale,
                "source_parameters": _parameter_properties(params),
                "source_model_fields": sorted(
                    (engineering_model.dimensions.keys()
                     if hasattr(engineering_model, "dimensions") else [])
                ),
                "geometry_convention": (
                    "metres, Z-up; vertical members sit on the level elevation, "
                    "horizontal members have their soffit at the level elevation"
                ),
                "assumptions": list(draft["assumptions"]),
            },
            validation={
                "state": canonical.VALIDATION_WARNING if warnings
                else canonical.VALIDATION_OK,
                "warnings": warnings,
            },
            parent_id=parent_id,
        )
        if draft.get("extrusion"):
            element["extrusion"] = draft["extrusion"]
            # The extrusion changes the geometry the fingerprint must cover.
            element["fingerprint"] = canonical.geometry_fingerprint(element)
        canonical.add_element(document, element)

    for draft in drafts:
        if draft["parent_role"]:
            child_id = role_to_id[draft["role"]]
            parent_id = role_to_id[draft["parent_role"]]
            canonical.add_relationship(
                document, "part-of", child_id, parent_id,
                f"{draft['role']} is part of {draft['parent_role']}",
            )

    # Retaining wall: the stem is carried by the base. That is an engineering
    # relationship, not an IFC aggregation (an IfcWall is not *part of* an
    # IfcFooting), so it is recorded as 'supported-by' and deliberately does not
    # become a parent-child decomposition in the IFC export.
    if "stem" in role_to_id and "base" in role_to_id:
        canonical.add_relationship(
            document, "supported-by", role_to_id["stem"], role_to_id["base"],
            "retaining wall stem is carried by the base slab",
        )

    canonical.finalise(document)
    canonical.require_valid(document)
    return document


def _material_properties(params: Any) -> Dict[str, Any]:
    """Material data the generator states, for the IFC material association."""
    properties: Dict[str, Any] = {}
    grade = getattr(params, "concrete_grade", None)
    if grade:
        properties["designation"] = str(grade)
    fck = getattr(params, "fck_MPa", None)
    if fck:
        properties["fck_MPa"] = float(fck)
    fyk = getattr(params, "fyk_MPa", None)
    if fyk:
        properties["fyk_MPa"] = float(fyk)
    if properties:
        properties.setdefault("material_type", "concrete")
        properties.setdefault("density_kg_m3", 2500.0)
    return properties


def catalogue_entry(generator_key: str) -> Dict[str, Any]:
    """Catalogue row for the CAD workspace, including a canonical preview."""
    spec = generator_registry.get_spec(generator_key)
    return {
        "key": spec.key,
        "label": spec.label,
        "category": spec.category,
        "description": spec.description,
        "drawing_number": spec.drawing_number,
        "drawing_title": spec.drawing_title,
        "scale": spec.scale,
        "element_type": spec.element_type,
        "views": [view.name for view in spec.views],
        "parameters": generator_registry.parameter_schema(spec),
        "defaults": generator_registry.default_parameters(spec),
        "supports_ifc": generator_key in _DRAFT_BUILDERS,
    }
