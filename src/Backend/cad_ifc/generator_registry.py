"""
Registry of the existing Python RC detailing generators, exposed to the CAD
workspace.

Why this module exists
----------------------
The brief is explicit: the browser must not re-implement detailing rules, and the
existing ``engineering_system`` generators are the source of truth. The CAD
workspace therefore needs to *drive* those generators, not replace them.

This module is the only place that knows

* which generators exist,
* what parameters each one accepts (read from its ``*Params`` dataclass, so the
  UI can never drift from the Python signature),
* which drawing views each one produces and in which order,
* how to turn validated JSON parameters into a generator run.

Nothing here recomputes engineering values. Detailing, bar schedules and checks
all happen inside ``engineering_system``.

Instrumentation instead of modification
---------------------------------------
To record which CAD entity belongs to which engineering element (and to which
drawing view), the generator's own drawing calls are *wrapped*, never edited:
``_recording_session`` temporarily replaces the ``DXFDocument`` symbol in
``engineering_system.generate`` and wraps the ``render_*`` class methods of the
renderer it is about to call. The wrappers only push a view name and record the
entities the generator creates through ``DXFDocument.add_*``. The originals are
restored in a ``finally`` block, and the wrapping is limited to the duration of
one generator run.

That is why the mapping is trustworthy: an entity's view attribution comes from
the generator's own call boundary (``render_elevation`` → ``elevation``), not
from guessing by coordinates, layer names or geometry.

Sheet layout
------------
The view list and sheet metadata per generator mirror the corresponding
``generate_<target>_dxf`` function in ``engineering_system/generate.py``
(origins, view order, title block fields). That layout is data, not detailing
logic; ``tests/test_cad_ifc_engineering.py::test_layout_matches_generate_module``
pins it so drift between this registry and ``generate.py`` fails a test.
"""

from __future__ import annotations

import dataclasses
import enum
import importlib
import inspect
import os
import sys
import typing
from contextlib import contextmanager
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple

# ---------------------------------------------------------------------------
# Import the existing engineering system
# ---------------------------------------------------------------------------

#: Root that must be importable for ``import engineering_system`` to work.
#: ``cad_ifc/generator_registry.py`` -> ``cad_ifc`` -> ``Backend`` -> ``Cad_Generator``.
CAD_GENERATOR_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "Cad_Generator",
    )
)

_ENGINEERING_IMPORT_ERROR: Optional[str] = None
engineering_system = None  # type: ignore[assignment]
_eng_generate = None  # type: ignore[assignment]
_eng_dxf = None  # type: ignore[assignment]
_eng_annotations = None  # type: ignore[assignment]
_eng_model = None  # type: ignore[assignment]

try:  # pragma: no cover - import-time environment check
    if CAD_GENERATOR_DIR not in sys.path:
        sys.path.insert(0, CAD_GENERATOR_DIR)
    engineering_system = importlib.import_module("engineering_system")
    _eng_generate = importlib.import_module("engineering_system.generate")
    _eng_dxf = importlib.import_module("engineering_system.drawing.dxf")
    _eng_annotations = importlib.import_module("engineering_system.drawing.annotations")
    _eng_model = importlib.import_module("engineering_system.core.model")
    ENGINEERING_AVAILABLE = True
except Exception as exc:  # pragma: no cover - dependency missing
    ENGINEERING_AVAILABLE = False
    _ENGINEERING_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"
else:
    _ENGINEERING_IMPORT_ERROR = None


class GeneratorRegistryError(RuntimeError):
    """Raised when a generator cannot be resolved, built or run."""


def require_engineering() -> None:
    """Raise a precise error when the engineering system is not importable."""
    if not ENGINEERING_AVAILABLE:
        raise GeneratorRegistryError(
            "the Python engineering detailing system is not importable "
            f"({_ENGINEERING_IMPORT_ERROR}). It lives in src/Backend/Cad_Generator "
            "and needs ezdxf installed in the backend interpreter."
        )


# ---------------------------------------------------------------------------
# Specs
# ---------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class ViewSpec:
    """One drawing view produced by a generator.

    ``renderer``/``method`` identify the renderer call. ``origin`` is the sheet
    origin in millimetres used by ``engineering_system/generate.py``.
    ``argument`` selects what the renderer receives: the engineering model
    (``"model"``) or the parameter object directly (``"params"``), matching the
    generator's own signature.

    ``roles`` lists the canonical element roles that the view *depicts*. It is
    taken from the generator's own drawing composition (a retaining-wall section
    shows the stem and the base; a stair section shows the flight and landing),
    which is what lets an entity be attributed to elements without guessing from
    coordinates. An empty tuple means "every element the generator built".
    """

    name: str
    renderer_module: str
    renderer_name: str
    method: str
    origin: Tuple[float, float]
    argument: str = "model"
    roles: Tuple[str, ...] = ()


@dataclasses.dataclass(frozen=True)
class GeneratorSpec:
    """Everything needed to run one existing generator and label its output."""

    key: str
    label: str
    category: str
    description: str
    element_type: str
    params_module: str
    params_name: str
    model_module: Optional[str]
    model_name: Optional[str]
    views: Tuple[ViewSpec, ...]
    drawing_number: str
    drawing_title: str
    scale: str
    project_title: str = "Standard Method of Detailing"
    #: Parameters pinned by the generator itself (the drawing model detail
    #: mandates them, e.g. MST2 has no landing). Overrides are still allowed for
    #: parameters the generator genuinely derives from.
    fixed_params: Tuple[Tuple[str, Any], ...] = ()
    #: Values the reference sheet uses when the caller supplies nothing.
    #:
    #: Unlike ``fixed_params`` these stay editable; they only change the reported
    #: default. ``generate_wall_dxf`` draws MW1 with a 900x1000 opening at
    #: (600, 800), so that is the default the workbench shows.
    default_overrides: Tuple[Tuple[str, Any], ...] = ()

    def params_class(self) -> Any:
        require_engineering()
        module = importlib.import_module(self.params_module)
        return getattr(module, self.params_name)

    def model_class(self) -> Any:
        require_engineering()
        if not self.model_module or not self.model_name:
            raise GeneratorRegistryError(f"{self.key} has no engineering model class")
        return getattr(importlib.import_module(self.model_module), self.model_name)

    def renderer_class(self, view: ViewSpec) -> Any:
        require_engineering()
        return getattr(importlib.import_module(view.renderer_module), view.renderer_name)


_MEMBERS = "engineering_system.members"
_DETAILS = "engineering_system.details"

#: The generator catalogue. Keys are stable API/drawing identifiers.
GENERATORS: Dict[str, GeneratorSpec] = {
    "beam": GeneratorSpec(
        key="beam",
        label="Suspended beam (MB1)",
        category="Members",
        description=(
            "RC suspended beam: elevation and section with main bars, top support "
            "bars, hanger bars, links, curtailment and bar schedule."
        ),
        element_type="beam",
        params_module=f"{_MEMBERS}.beam",
        params_name="BeamParams",
        model_module=f"{_MEMBERS}.beam",
        model_name="BeamEngineeringModel",
        views=(
            ViewSpec("elevation", f"{_MEMBERS}.beam", "BeamDrawingRenderer",
                     "render_elevation", (50.0, 250.0)),
            ViewSpec("section", f"{_MEMBERS}.beam", "BeamDrawingRenderer",
                     "render_section", (1000.0, 250.0)),
        ),
        drawing_number="BEAM-01",
        drawing_title="Suspended Beam Elevation & Section (MB1)",
        scale="1:20",
    ),
    "column": GeneratorSpec(
        key="column",
        label="RC column (EC2)",
        category="Members",
        description=(
            "RC in-situ column: elevation and section with vertical bars, laps, "
            "links and confinement zones per EC2 Fig 6.24-6.27."
        ),
        element_type="column",
        params_module=f"{_MEMBERS}.column",
        params_name="ColumnParams",
        model_module=f"{_MEMBERS}.column",
        model_name="ColumnEngineeringModel",
        views=(
            ViewSpec("elevation", f"{_MEMBERS}.column", "ColumnDrawingRenderer",
                     "render_elevation", (150.0, 100.0)),
            ViewSpec("section", f"{_MEMBERS}.column", "ColumnDrawingRenderer",
                     "render_section", (700.0, 100.0)),
        ),
        drawing_number="COL-01",
        drawing_title="RC Column Detailing & Laps (EC2)",
        scale="1:20",
    ),
    "slab": GeneratorSpec(
        key="slab",
        label="Solid slab (MS1)",
        category="Members",
        description=(
            "Solid RC slab section: bottom/top bars, distribution bars, support "
            "detail and bar schedule."
        ),
        element_type="slab",
        params_module=f"{_MEMBERS}.slab",
        params_name="SlabParams",
        model_module=f"{_MEMBERS}.slab",
        model_name="SlabEngineeringModel",
        views=(
            ViewSpec("elevation", f"{_MEMBERS}.slab", "SlabDrawingRenderer",
                     "render_elevation", (50.0, 100.0)),
        ),
        drawing_number="SLAB-01",
        drawing_title="Solid Slab Detailing (Model Detail MS1)",
        scale="1:20",
    ),
    "wall": GeneratorSpec(
        key="wall",
        label="RC wall (MW1)",
        category="Members",
        description=(
            "RC wall: plan section and elevation with vertical/horizontal "
            "reinforcement and optional opening."
        ),
        element_type="wall",
        params_module=f"{_MEMBERS}.wall",
        params_name="WallParams",
        model_module=f"{_MEMBERS}.wall",
        model_name="WallEngineeringModel",
        views=(
            ViewSpec("plan", f"{_MEMBERS}.wall", "WallDrawingRenderer",
                     "render_plan_section", (50.0, 50.0)),
            ViewSpec("elevation", f"{_MEMBERS}.wall", "WallDrawingRenderer",
                     "render_elevation", (50.0, 450.0)),
        ),
        drawing_number="WALL-01",
        drawing_title="RC Wall Elevation & Section (Model Detail MW1)",
        scale="1:20",
        # generate_wall_dxf draws MW1 with a 900 x 1000 opening at (600, 800).
        default_overrides=(("opening", (900.0, 1000.0, 600.0, 800.0)),),
    ),
    "retaining_wall": GeneratorSpec(
        key="retaining_wall",
        label="Cantilever retaining wall (MRW1)",
        category="Members",
        description=(
            "Cantilever RC retaining wall: stem and base section with earth-face "
            "and external-face reinforcement plus base mesh."
        ),
        element_type="retaining-wall",
        params_module=f"{_MEMBERS}.wall",
        params_name="CantileverRetainingWallParams",
        model_module=None,
        model_name=None,
        views=(
            ViewSpec("section", f"{_MEMBERS}.wall", "RetainingWallDrawingRenderer",
                     "render_section", (100.0, 100.0), argument="params",
                     roles=("stem", "base")),
        ),
        drawing_number="RW-01",
        drawing_title="Cantilever Retaining Wall Section (Model Detail MRW1)",
        scale="1:20",
    ),
    "pad_footing": GeneratorSpec(
        key="pad_footing",
        label="Pad footing (MF1)",
        category="Foundations",
        description=(
            "RC pad footing: plan and section with bottom mesh, starter bars and "
            "column stub."
        ),
        element_type="pad-footing",
        params_module=f"{_MEMBERS}.foundation",
        params_name="PadFootingParams",
        model_module=f"{_MEMBERS}.foundation",
        model_name="PadFootingEngineeringModel",
        views=(
            ViewSpec("plan", f"{_MEMBERS}.foundation", "PadFootingDrawingRenderer",
                     "render_plan", (50.0, 50.0)),
            ViewSpec("section", f"{_MEMBERS}.foundation", "PadFootingDrawingRenderer",
                     "render_section", (50.0, 400.0)),
        ),
        drawing_number="PAD-01",
        drawing_title="Pad Footing Plan & Section (Model Detail MF1)",
        scale="1:20",
    ),
    "stair": GeneratorSpec(
        key="stair",
        label="Stair flight MST1 (end supported)",
        category="Stairs",
        description=(
            "End-supported RC stair flight: longitudinal section with waist, main "
            "bars, distribution bars and landing detail."
        ),
        element_type="stair",
        params_module=f"{_MEMBERS}.stair",
        params_name="StairParams",
        model_module=f"{_MEMBERS}.stair",
        model_name="StairEngineeringModel",
        views=(
            ViewSpec("section", f"{_MEMBERS}.stair", "StairDrawingRenderer",
                     "render_mst1_section", (50.0, 100.0),
                     roles=("stair", "flight", "landing")),
        ),
        drawing_number="STR-01",
        drawing_title="RC Stair Flight Longitudinal Section (Model Detail MST1)",
        scale="1:20",
        fixed_params=(("stair_type", "MST1"),),
    ),
    "stair_mst2": GeneratorSpec(
        key="stair_mst2",
        label="Stair flight MST2 (cantilever)",
        category="Stairs",
        description=(
            "Cantilever RC stair flight: section A-A with waist, main bars and "
            "distribution bars."
        ),
        element_type="stair",
        params_module=f"{_MEMBERS}.stair",
        params_name="StairParams",
        model_module=f"{_MEMBERS}.stair",
        model_name="StairEngineeringModel",
        views=(
            ViewSpec("section", f"{_MEMBERS}.stair", "StairDrawingRenderer",
                     "render_mst2_section", (300.0, 100.0),
                     roles=("stair", "flight")),
        ),
        drawing_number="STR-02",
        drawing_title="Cantilever Stair Section A-A (Model Detail MST2)",
        scale="1:20",
        # generate.py renders MST2 with landing_length_mm=0.0 and 10 steps because
        # the model detail has no landing and shows a 10-step flight. Pinning them
        # keeps the canonical model and the sheet from describing different stairs.
        fixed_params=(("stair_type", "MST2"), ("landing_length_mm", 0.0)),
        default_overrides=(("n_steps", 10),),
    ),
}


def get_spec(key: str) -> GeneratorSpec:
    """Return the spec for ``key`` or raise a precise error."""
    try:
        return GENERATORS[key]
    except KeyError as exc:
        raise GeneratorRegistryError(
            f"unknown generator {key!r}; available: {sorted(GENERATORS)}"
        ) from exc


# ---------------------------------------------------------------------------
# Parameter schema derived from the generator's own dataclass
# ---------------------------------------------------------------------------

#: Human labels and units for parameter names that do not encode them.
_PARAM_LABELS: Dict[str, Tuple[str, str]] = {
    "span_clear_mm": ("Clear span", "mm"),
    "support_left_width_mm": ("Left support width", "mm"),
    "support_right_width_mm": ("Right support width", "mm"),
    "column_width_mm": ("Column width", "mm"),
    "width_mm": ("Section width", "mm"),
    "depth_mm": ("Section depth", "mm"),
    "height_mm": ("Height", "mm"),
    "length_mm": ("Length", "mm"),
    "thickness_mm": ("Thickness", "mm"),
    "cover_nominal_mm": ("Nominal cover", "mm"),
    "cover_mm": ("Cover", "mm"),
    "cover_earth_mm": ("Earth-face cover", "mm"),
    "cover_ext_mm": ("External-face cover", "mm"),
    "cover_base_mm": ("Base cover", "mm"),
    "fck_MPa": ("Concrete strength fck", "MPa"),
    "fyk_MPa": ("Steel yield strength fyk", "MPa"),
    "bot_bar_count": ("Bottom bar count", "no."),
    "bot_bar_dia_mm": ("Bottom bar diameter", "mm"),
    "top_support_count": ("Top support bar count", "no."),
    "top_support_dia_mm": ("Top support bar diameter", "mm"),
    "hanger_count": ("Hanger bar count", "no."),
    "hanger_dia_mm": ("Hanger bar diameter", "mm"),
    "link_dia_mm": ("Link diameter", "mm"),
    "link_pitch_support_mm": ("Link pitch at support", "mm"),
    "link_pitch_span_mm": ("Link pitch in span", "mm"),
    "link_dense_zone_len_mm": ("Dense link zone length", "mm"),
    "link_pitch_standard_mm": ("Standard link pitch", "mm"),
    "link_pitch_lap_mm": ("Link pitch at lap", "mm"),
    "link_pitch_mm": ("Link pitch", "mm"),
    "bar_dia_mm": ("Bar diameter", "mm"),
    "bar_count": ("Bar count", "no."),
    "lap_length_mm": ("Lap length", "mm"),
    "crank_slope": ("Crank slope", "-"),
    "bottom_bar_dia_mm": ("Bottom bar diameter", "mm"),
    "bottom_bar_pitch_mm": ("Bottom bar pitch", "mm"),
    "top_bar_dia_mm": ("Top bar diameter", "mm"),
    "top_bar_pitch_mm": ("Top bar pitch", "mm"),
    "distribution_bar_dia_mm": ("Distribution bar diameter", "mm"),
    "distribution_bar_pitch_mm": ("Distribution bar pitch", "mm"),
    "slab_width_mm": ("Slab width", "mm"),
    "stem_height_mm": ("Stem height", "mm"),
    "stem_thickness_mm": ("Stem thickness", "mm"),
    "base_length_mm": ("Base length", "mm"),
    "toe_length_mm": ("Toe length", "mm"),
    "base_thickness_mm": ("Base thickness", "mm"),
    "vdia_earth_mm": ("Stem bar diameter (earth face)", "mm"),
    "vpitch_earth_mm": ("Stem bar pitch (earth face)", "mm"),
    "hdia_mm": ("Horizontal bar diameter", "mm"),
    "hpitch_mm": ("Horizontal bar pitch", "mm"),
    "base_dia_mm": ("Base mesh bar diameter", "mm"),
    "base_pitch_mm": ("Base mesh bar pitch", "mm"),
    "lx_mm": ("Footing length X", "mm"),
    "ly_mm": ("Footing width Y", "mm"),
    "cx_mm": ("Column width X", "mm"),
    "cy_mm": ("Column width Y", "mm"),
    "pitch_mm": ("Bar pitch", "mm"),
    "n_starters": ("Starter bar count", "no."),
    "starter_dia_mm": ("Starter bar diameter", "mm"),
    "starter_leg_mm": ("Starter leg length", "mm"),
    "going_mm": ("Going", "mm"),
    "rise_mm": ("Rise", "mm"),
    "n_steps": ("Number of steps", "no."),
    "waist_mm": ("Waist thickness", "mm"),
    "landing_length_mm": ("Landing length", "mm"),
    "main_dia_mm": ("Main bar diameter", "mm"),
    "main_pitch_mm": ("Main bar pitch", "mm"),
    "distribution_dia_mm": ("Distribution bar diameter", "mm"),
    "distribution_pitch_mm": ("Distribution bar pitch", "mm"),
    "vertical_dia_mm": ("Vertical bar diameter", "mm"),
    "vertical_pitch_mm": ("Vertical bar pitch", "mm"),
    "horizontal_dia_mm": ("Horizontal bar diameter", "mm"),
    "horizontal_pitch_mm": ("Horizontal bar pitch", "mm"),
    "kicker_height_mm": ("Kicker height", "mm"),
    "dcdev_mm": ("Deviation allowance", "mm"),
    "aggregate_size_dg_mm": ("Aggregate size dg", "mm"),
    "intersecting_beam_fck_MPa": ("Intersecting beam fck", "MPa"),
    "fire_rating_hours": ("Fire rating", "hours"),
    "flange_depth_mm": ("Flange depth", "mm"),
    "side_bar_count": ("Side bar count", "no."),
    "side_bar_dia_mm": ("Side bar diameter", "mm"),
    "curtailment_al_mm": ("Curtailment al", "mm"),
    "compression_steel_required_mm2": ("Compression steel required", "mm²"),
    "concrete_grade": ("Concrete grade", "-"),
    "exposure": ("Exposure class", "-"),
    "bond": ("Bond condition", "-"),
    "stair_type": ("Stair type", "-"),
    "opening": ("Opening (x, y, w, h)", "mm"),
    "is_end_bay": ("End bay", "-"),
    "is_flanged": ("Flanged section", "-"),
    "is_tension_bar": ("Tension bar", "-"),
    "is_continuous_left": ("Continuous left", "-"),
    "is_continuous_right": ("Continuous right", "-"),
    "is_end_support": ("End support", "-"),
}


def _is_optional(annotation: Any) -> bool:
    """True when the annotation admits ``None`` (``Optional[X]`` / ``X | None``)."""
    for arg in typing.get_args(annotation):
        if arg is type(None):
            return True
    return False


def _base_type(annotation: Any) -> str:
    """Map a dataclass annotation to one of ``number|integer|boolean|string|none``."""
    origin = typing.get_origin(annotation)
    if origin is typing.Union:
        args = [a for a in typing.get_args(annotation) if a is not type(None)]
        return _base_type(args[0]) if args else "string"
    if annotation is bool:
        return "boolean"
    if annotation is int:
        return "integer"
    if annotation is float:
        return "number"
    if annotation is str:
        return "string"
    return "string"


def parameter_schema(spec: GeneratorSpec) -> List[Dict[str, Any]]:
    """Describe every parameter the generator accepts, read from its dataclass.

    The schema is derived, not duplicated: adding a field to ``BeamParams`` makes
    it appear in the CAD workspace automatically.
    """
    require_engineering()
    cls = spec.params_class()
    fixed = dict(spec.fixed_params)
    overrides = dict(spec.default_overrides)
    try:
        hints = typing.get_type_hints(cls)
    except Exception:  # pragma: no cover - forward refs in odd environments
        hints = {field.name: field.type for field in dataclasses.fields(cls)}

    schema: List[Dict[str, Any]] = []
    for field in dataclasses.fields(cls):
        annotation = hints.get(field.name, field.type)
        kind = _base_type(annotation)
        is_optional = _is_optional(annotation)
        label, unit = _PARAM_LABELS.get(field.name, (field.name.replace("_", " ").title(), "-"))
        has_default = field.default is not dataclasses.MISSING
        default = field.default if has_default else None
        if field.default_factory is not dataclasses.MISSING:  # type: ignore[misc]
            default = field.default_factory()  # type: ignore[misc]
        if isinstance(default, enum.Enum):
            default = default.value
        sequence = isinstance(default, (list, tuple))
        if sequence:
            default = list(default)
        if field.name in overrides:
            # The reference sheet's value becomes the default, still editable.
            override = overrides[field.name]
            default = list(override) if sequence else override
        schema.append(
            {
                "name": field.name,
                "label": label,
                "unit": unit,
                "type": kind,
                "nullable": is_optional,
                "default": default,
                "sequence": sequence,
                "editable": field.name not in fixed,
                "fixed_value": fixed.get(field.name),
                "required": not has_default,
                "description": "",
            }
        )
    return schema


def default_parameters(spec: GeneratorSpec) -> Dict[str, Any]:
    """Default parameter values for a generator, including its fixed values."""
    values = {item["name"]: item["default"] for item in parameter_schema(spec)}
    values.update(dict(spec.fixed_params))
    return values


def _coerce(kind: str, name: str, value: Any) -> Any:
    if value is None:
        return None
    if kind == "boolean":
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        text = str(value).strip().lower()
        if text in ("true", "1", "yes", "on"):
            return True
        if text in ("false", "0", "no", "off"):
            return False
        raise GeneratorRegistryError(f"parameter {name!r} must be a boolean")
    if kind == "integer":
        try:
            number = float(value)
        except (TypeError, ValueError) as exc:
            raise GeneratorRegistryError(f"parameter {name!r} must be an integer") from exc
        if number != int(number):
            raise GeneratorRegistryError(f"parameter {name!r} must be a whole number")
        return int(number)
    if kind == "number":
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise GeneratorRegistryError(f"parameter {name!r} must be a number") from exc
    return value if isinstance(value, str) else str(value)


def build_params(spec: GeneratorSpec, overrides: Optional[Dict[str, Any]] = None) -> Any:
    """Validate ``overrides`` against the generator schema and build its Params.

    Unknown or non-scalar values are rejected before anything is generated, and
    fixed parameters cannot be overridden.
    """
    require_engineering()
    schema = {item["name"]: item for item in parameter_schema(spec)}
    supplied = dict(overrides or {})

    unknown = sorted(set(supplied) - set(schema))
    if unknown:
        raise GeneratorRegistryError(
            f"unknown parameter(s) for {spec.key!r}: {', '.join(unknown)}"
        )

    fixed = dict(spec.fixed_params)
    for name, value in fixed.items():
        if name in supplied and supplied[name] != value:
            raise GeneratorRegistryError(
                f"parameter {name!r} is fixed to {value!r} by the {spec.drawing_number} "
                f"model detail and cannot be overridden"
            )

    kwargs: Dict[str, Any] = {}
    for name, info in schema.items():
        if name in fixed:
            kwargs[name] = fixed[name]
            continue
        if name in supplied:
            value = supplied[name]
            if info.get("sequence") and isinstance(value, list):
                # JSON has no tuples; the generator's dataclass field does.
                value = tuple(value)
            kwargs[name] = _coerce(info["type"], name, value)
        elif info["default"] is not None:
            value = info["default"]
            kwargs[name] = tuple(value) if info.get("sequence") and isinstance(value, list) else value
        elif info["type"] == "number":
            kwargs[name] = 0.0
        elif info["type"] == "integer":
            kwargs[name] = 0
        elif info["type"] == "boolean":
            kwargs[name] = False
        else:
            kwargs[name] = None

    cls = spec.params_class()
    try:
        return cls(**kwargs)
    except TypeError as exc:
        raise GeneratorRegistryError(
            f"could not construct {spec.params_name} for {spec.key!r}: {exc}"
        ) from exc


def build_model(spec: GeneratorSpec, params: Any) -> Any:
    """Run the generator's own engineering model construction."""
    require_engineering()
    if not spec.model_module or not spec.model_name:
        return None
    model_cls = spec.model_class()
    create = getattr(model_cls, "create_model", None)
    if create is None:
        raise GeneratorRegistryError(
            f"{spec.model_name} has no create_model(); the registry needs updating"
        )
    return create(params)


# ---------------------------------------------------------------------------
# Instrumented generation
# ---------------------------------------------------------------------------


@dataclasses.dataclass
class RecordedEntity:
    """One CAD entity created by the generator, with its view attribution."""

    handle: str
    dxftype: str
    layer: str
    view: str
    order: int


#: Active view name pushed by the renderer wrappers.
_ACTIVE_VIEW: List[str] = ["unnamed"]


@contextmanager
def _recording_session():
    """Temporarily instrument ``engineering_system.generate``.

    Installs a recording ``DXFDocument`` in the ``generate`` module namespace and
    wraps every ``render_*`` method on the renderers the registry will call, so
    that entities are attributed to the view whose call created them. Everything
    is restored on exit, including on error.
    """
    require_engineering()

    recorded: List[RecordedEntity] = []
    order = [0]
    real_document = _eng_dxf.DXFDocument
    originals: List[Tuple[Any, str, Any]] = []

    class RecordingDocument(real_document):  # type: ignore[misc, valid-type]
        def _record(self, entity: Any, method: str) -> Any:
            if entity is not None:
                order[0] += 1
                try:
                    handle = entity.dxf.handle
                    layer = entity.dxf.layer
                    dxftype = entity.dxftype()
                except Exception:
                    handle, layer, dxftype = "", "", method
                recorded.append(
                    RecordedEntity(
                        handle=str(handle),
                        dxftype=dxftype,
                        layer=str(layer),
                        view=_ACTIVE_VIEW[-1],
                        order=order[0],
                    )
                )
            return entity

        def add_line(self, *a: Any, **k: Any) -> Any:
            return self._record(super().add_line(*a, **k), "line")

        def add_polyline(self, *a: Any, **k: Any) -> Any:
            return self._record(super().add_polyline(*a, **k), "polyline")

        def add_circle(self, *a: Any, **k: Any) -> Any:
            return self._record(super().add_circle(*a, **k), "circle")

        def add_arc(self, *a: Any, **k: Any) -> Any:
            return self._record(super().add_arc(*a, **k), "arc")

        def add_text(self, *a: Any, **k: Any) -> Any:
            return self._record(super().add_text(*a, **k), "text")

        def add_hatch(self, *a: Any, **k: Any) -> Any:
            return self._record(super().add_hatch(*a, **k), "hatch")

    _eng_generate.DXFDocument = RecordingDocument  # type: ignore[attr-defined]

    def wrap_renderer(renderer_cls: Any, method: str, view_name: str) -> None:
        original = getattr(renderer_cls, method)

        def wrapper(*args: Any, **kwargs: Any) -> Any:
            _ACTIVE_VIEW.append(view_name)
            try:
                return original(*args, **kwargs)
            finally:
                _ACTIVE_VIEW.pop()

        setattr(renderer_cls, method, staticmethod(wrapper))
        originals.append((renderer_cls, method, original))

    try:
        yield recorded, wrap_renderer
    finally:
        for renderer_cls, method, original in reversed(originals):
            setattr(renderer_cls, method, original)
        _eng_generate.DXFDocument = real_document  # type: ignore[attr-defined]
        _ACTIVE_VIEW[:] = ["unnamed"]


def generate_drawing(
    spec: GeneratorSpec,
    params: Any,
    out_path: str,
    *,
    model: Any = None,
) -> Dict[str, Any]:
    """Run one existing generator into ``out_path`` and report what it drew.

    The trailing steps (title block, save) mirror the generator's own
    ``generate_<target>_dxf`` function so the sheet the user edits is the sheet
    the detailing system defines.
    """
    require_engineering()
    if model is None:
        model = build_model(spec, params)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    views_seen: List[str] = []

    with _recording_session() as (recorded, wrap_renderer):
        for view in spec.views:
            renderer = spec.renderer_class(view)
            # Wrap before the document is created so every call is attributed.
            wrap_renderer(renderer, view.method, view.name)

        dxf = _eng_generate.DXFDocument()
        for view in spec.views:
            renderer = spec.renderer_class(view)
            method = getattr(renderer, view.method)
            argument = params if view.argument == "params" else model
            method(argument, dxf, origin=view.origin)
            views_seen.append(view.name)

        panel = _eng_model.DrawingPanel(
            project_title=spec.project_title,
            drawing_number=spec.drawing_number,
            revision="A",
            drawing_title=spec.drawing_title,
            scale=spec.scale,
        )
        # The title panel is sheet furniture, not a model view: label it so it is
        # never mistaken for engineering geometry by the mapping.
        _ACTIVE_VIEW.append("title-block")
        try:
            _eng_annotations.AnnotationRenderer.add_title_panel_a(dxf, panel, 841.0, 594.0)
        finally:
            _ACTIVE_VIEW.pop()
        dxf.save(out_path)

    by_view: Dict[str, int] = {}
    by_layer: Dict[str, int] = {}
    for entity in recorded:
        by_view[entity.view] = by_view.get(entity.view, 0) + 1
        by_layer[entity.layer] = by_layer.get(entity.layer, 0) + 1

    return {
        "path": out_path,
        "bytes": os.path.getsize(out_path),
        "entity_count": len(recorded),
        "entities": [dataclasses.asdict(entity) for entity in recorded],
        "views": views_seen,
        "by_view": by_view,
        "by_layer": by_layer,
        "layers": sorted(by_layer),
        "drawing_number": spec.drawing_number,
        "drawing_title": spec.drawing_title,
        "scale": spec.scale,
    }


def catalogue() -> List[Dict[str, Any]]:
    """JSON catalogue used by the CAD workspace generator picker."""
    require_engineering()
    items = []
    for spec in GENERATORS.values():
        items.append(
            {
                "key": spec.key,
                "label": spec.label,
                "category": spec.category,
                "description": spec.description,
                "drawing_number": spec.drawing_number,
                "drawing_title": spec.drawing_title,
                "scale": spec.scale,
                "element_type": spec.element_type,
                "views": [view.name for view in spec.views],
                "parameters": parameter_schema(spec),
                "defaults": default_parameters(spec),
            }
        )
    return items
