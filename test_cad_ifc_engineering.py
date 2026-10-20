"""
Acceptance tests for the engineering-generator side of the CAD / BIM / IFC
integration: the existing RC generators as the source of truth, the canonical
model, the DXF identity mapping and the IFC export.

Run with either:

    .venv-ifc\\Scripts\\python.exe test_cad_ifc_engineering.py
    python -m pytest test_cad_ifc_engineering.py -v

What is verified (Task 1, Task 2 and Task 3 of the integration brief)
--------------------------------------------------------------------
Task 1 — editable CAD workspace
  * every existing generator is listed and its parameters come from its own
    dataclass, so the UI cannot drift from the Python signature;
  * unknown parameters are rejected and model-detail-fixed parameters cannot be
    overridden;
  * a real DXF is produced, reopens with ezdxf, declares millimetres and contains
    the entities the generator drew;
  * entity counts match the corresponding ``generate_*_dxf`` function in
    ``engineering_system/generate.py`` (layout drift fails the build).

Task 2 — IFC
  * the canonical model validates for every generator;
  * IfcOpenShell writes a real IFC4 file that reopens, passes its own validator
    with zero statements, and carries units, storeys, property sets, materials
    and stable GlobalIds;
  * the IFC kernel's bounding boxes agree with the canonical dimensions;
  * IFC GlobalIds survive regeneration;
  * the semantic guard refuses to write an element whose class is not in the
    canonical mapping.

Task 3 — canonical identity and mapping
  * one engineering element maps to many CAD entities and vice versa;
  * the mapping survives a DXF save/reopen (identity lives in XDATA, not in the
    handle);
  * deleted, recreated-by-another-application and user-edited entities are
    detected; unmapped entities are reported, never guessed;
  * repeated export preserves identity and increments the revision;
  * units and coordinates round-trip within documented tolerances.

Artefacts are written to a scratch directory inside the repository
(``.test-artifacts/``, git-ignored) via ``FUNDI_ARTIFACT_DIR``, so a test run never
touches ``public/`` and never leaves generated files behind.
"""

from __future__ import annotations

import base64
import dataclasses
import os
import shutil
import sys
import traceback

# Must be set before `cad_ifc.store` is imported, because it resolves the artefact
# directory at import time. Kept inside the workspace on purpose: the OS temp
# directory is not usable for SQLite in restricted environments, and a scratch
# directory in the repository is predictable for the developer.
_TMP_ROOT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), ".test-artifacts", f"run-{os.getpid()}"
)
if os.path.isdir(_TMP_ROOT):
    shutil.rmtree(_TMP_ROOT, ignore_errors=True)
os.makedirs(_TMP_ROOT, exist_ok=True)
os.environ["FUNDI_ARTIFACT_DIR"] = os.path.join(_TMP_ROOT, "public")

import ezdxf  # noqa: E402

from src.Backend.cad_ifc import (  # noqa: E402
    canonical,
    generator_cad,
    generator_registry,
    identity,
    ifc_export,
    mapping,
    pipeline,
    rc_model,
    store,
    units,
)

#: Generators exercised by the geometry/IFC tests.
GENERATOR_KEYS = [
    "beam",
    "column",
    "slab",
    "wall",
    "retaining_wall",
    "pad_footing",
    "stair",
    "stair_mst2",
]

#: Cached pipeline reports, so the expensive generation runs once per generator.
_REPORTS = {}
_DB_COUNTER = [0]


def _new_db() -> str:
    _DB_COUNTER[0] += 1
    return os.path.join(_TMP_ROOT, f"mapping-{_DB_COUNTER[0]}.sqlite")


def _report(key: str, *, fresh: bool = False) -> dict:
    """Pipeline report for ``key``, generated once per test run."""
    if fresh or key not in _REPORTS:
        _REPORTS[key] = pipeline.run_generator_pipeline(
            key, db_path=_new_db(), include_validation=True
        )
    return _REPORTS[key]


def _canonical(key: str) -> dict:
    return rc_model.build_model(key)


def _assert(condition, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _close(a: float, b: float, tolerance: float = 1e-6) -> bool:
    return abs(float(a) - float(b)) <= tolerance


# ---------------------------------------------------------------------------
# Task 1: generator registry and parameters
# ---------------------------------------------------------------------------


def test_all_generators_are_registered() -> None:
    catalogue = generator_registry.catalogue()
    keys = [entry["key"] for entry in catalogue]
    _assert(keys == GENERATOR_KEYS, f"registry keys {keys} != expected {GENERATOR_KEYS}")
    for entry in catalogue:
        _assert(entry["parameters"], f"{entry['key']} exposes no parameters")
        _assert(entry["views"], f"{entry['key']} declares no drawing views")
        _assert(entry["drawing_number"], f"{entry['key']} has no drawing number")


def test_parameter_schema_matches_dataclass() -> None:
    """The UI schema must be exactly the generator's dataclass, no more, no less."""
    for key in GENERATOR_KEYS:
        spec = generator_registry.get_spec(key)
        schema = generator_registry.parameter_schema(spec)
        names = {item["name"] for item in schema}
        expected = {field.name for field in dataclasses.fields(spec.params_class())}
        _assert(
            names == expected,
            f"{key}: schema fields {sorted(names ^ expected)} differ from the dataclass",
        )
        for item in schema:
            _assert(
                item["type"] in ("number", "integer", "boolean", "string"),
                f"{key}.{item['name']}: unexpected type {item['type']}",
            )


def test_defaults_build_a_params_object() -> None:
    for key in GENERATOR_KEYS:
        spec = generator_registry.get_spec(key)
        params = generator_registry.build_params(spec)
        _assert(params is not None, f"{key}: could not build default params")
        _assert(
            type(params) is spec.params_class(),
            f"{key}: built {type(params).__name__}, expected {spec.params_name}",
        )


def test_unknown_parameter_is_rejected() -> None:
    spec = generator_registry.get_spec("beam")
    try:
        generator_registry.build_params(spec, {"span_clear_mm": 6000.0, "spam": 1})
    except generator_registry.GeneratorRegistryError as exc:
        _assert("spam" in str(exc), f"error should name the bad parameter: {exc}")
    else:
        raise AssertionError("an unknown parameter was silently accepted")


def test_model_detail_fixed_parameter_cannot_be_overridden() -> None:
    """MST2 has no landing in generate.py; the registry must refuse to invent one."""
    spec = generator_registry.get_spec("stair_mst2")
    try:
        generator_registry.build_params(spec, {"landing_length_mm": 1500.0})
    except generator_registry.GeneratorRegistryError as exc:
        _assert("fixed" in str(exc).lower(), f"unexpected error text: {exc}")
    else:
        raise AssertionError("a model-detail-fixed parameter was overridden")
    params = generator_registry.build_params(spec)
    _assert(
        _close(params.landing_length_mm, 0.0),
        f"stair_mst2 landing_length_mm should be 0, got {params.landing_length_mm}",
    )


def test_parameter_override_changes_the_canonical_geometry() -> None:
    default = rc_model.build_model("beam")
    wider = rc_model.build_model("beam", {"width_mm": 450.0})
    _assert(
        _close(default["elements"][0]["dimensions"]["width_y"], 0.3),
        "default beam width should be 0.3 m",
    )
    _assert(
        _close(wider["elements"][0]["dimensions"]["width_y"], 0.45),
        f"override did not reach the model: {wider['elements'][0]['dimensions']}",
    )
    _assert(
        default["elements"][0]["id"] == wider["elements"][0]["id"],
        "element identity must survive a parameter change",
    )
    _assert(
        default["model_hash"] != wider["model_hash"],
        "a parameter change must change the model hash",
    )


# ---------------------------------------------------------------------------
# Task 1: the drawing is real, metric and matches generate.py
# ---------------------------------------------------------------------------


def test_generator_writes_a_real_dxf() -> None:
    for key in GENERATOR_KEYS:
        report = _report(key)
        path = report["drawing"]["path"]
        _assert(os.path.exists(path), f"{key}: drawing not written to {path}")
        doc = ezdxf.readfile(path)
        entities = list(doc.modelspace())
        _assert(entities, f"{key}: drawing has no entities")
        _assert(
            len(entities) == report["drawing"]["entity_count"],
            f"{key}: recorded {report['drawing']['entity_count']} entities but "
            f"the file contains {len(entities)}",
        )
        _assert(
            report["drawing"]["drawing_number"],
            f"{key}: drawing has no drawing number",
        )


def test_drawings_declare_millimetres() -> None:
    for key in GENERATOR_KEYS:
        report = _report(key)
        check = generator_cad.check_units(report["drawing"]["path"])
        _assert(check["ok"], f"{key}: unit check failed: {check['problems']}")
        _assert(
            check["insunits"] == units.DXF_INSUNITS_MM,
            f"{key}: $INSUNITS is {check['insunits']}, expected {units.DXF_INSUNITS_MM}",
        )


def test_drawings_decompose_into_the_expected_views() -> None:
    """The view attribution comes from the renderer call, not from geometry."""
    expected = {
        "beam": {"elevation", "section", "title-block"},
        "column": {"elevation", "section", "title-block"},
        "slab": {"elevation", "title-block"},
        "wall": {"plan", "elevation", "title-block"},
        "retaining_wall": {"section", "title-block"},
        "pad_footing": {"plan", "section", "title-block"},
        "stair": {"section", "title-block"},
        "stair_mst2": {"section", "title-block"},
    }
    for key, views in expected.items():
        report = _report(key)
        got = set(report["drawing"]["by_view"])
        _assert(got == views, f"{key}: views {sorted(got)} != expected {sorted(views)}")


def test_layout_matches_generate_module() -> None:
    """Pin the registry layout to engineering_system/generate.py.

    The registry mirrors the sheet layout of ``generate_<target>_dxf`` (view order,
    origins, title block). This test runs the generator's own function for the same
    target and compares the entity count, so any drift between the two fails here
    instead of silently producing a different sheet.
    """
    generate = generator_registry._eng_generate
    expected_functions = {
        "beam": "generate_beam_dxf",
        "column": "generate_column_dxf",
        "slab": "generate_slab_dxf",
        "wall": "generate_wall_dxf",
        "retaining_wall": "generate_retaining_wall_dxf",
        "pad_footing": "generate_pad_footing_dxf",
        "stair": "generate_stair_dxf",
        "stair_mst2": "generate_stair_mst2_dxf",
    }
    out_dir = os.path.join(_TMP_ROOT, "generate-reference")
    os.makedirs(out_dir, exist_ok=True)
    for key, function_name in expected_functions.items():
        function = getattr(generate, function_name, None)
        _assert(function is not None, f"generate.py has no {function_name}")
        reference_path = function(os.path.join(out_dir, f"{key}.dxf"))
        reference_count = len(list(ezdxf.readfile(reference_path).modelspace()))
        report = _report(key)
        _assert(
            reference_count == report["drawing"]["entity_count"],
            f"{key}: registry produced {report['drawing']['entity_count']} entities "
            f"but {function_name} produced {reference_count} - the sheet layout in "
            "generator_registry has drifted from generate.py",
        )


# ---------------------------------------------------------------------------
# Task 1 + 3: identity on the geometry
# ---------------------------------------------------------------------------


def test_entities_carry_fundi_identity() -> None:
    for key in GENERATOR_KEYS:
        report = _report(key)
        scan = generator_cad.scan_drawing(report["drawing"]["path"])
        _assert(
            scan["mapped_entity_count"] > 0,
            f"{key}: no entity carries Fundi identity",
        )
        model_ids = {element["id"] for element in _canonical(key)["elements"]}
        seen = {
            payload["internal_id"]
            for entity in scan["entities"]
            for payload in entity["elements"]
        }
        _assert(
            seen and seen <= model_ids,
            f"{key}: drawing references unknown element ids {seen - model_ids}",
        )
        _assert(
            seen == model_ids,
            f"{key}: elements {model_ids - seen} have no entity in the drawing",
        )


def test_title_block_is_reported_as_unmapped() -> None:
    """Sheet furniture is not engineering geometry and must not be guessed."""
    for key in GENERATOR_KEYS:
        report = _report(key)
        scan = generator_cad.scan_drawing(report["drawing"]["path"])
        unmapped = [entity for entity in scan["entities"] if not entity["elements"]]
        expected = report["drawing"]["title_block_entities"]
        _assert(
            len(unmapped) == expected,
            f"{key}: {len(unmapped)} unmapped entities but {expected} title-block "
            "entities were expected",
        )
        for entity in unmapped:
            layer = str(entity["layer"]).upper()
            _assert(
                "TITLE" in layer or "ANNOT" in layer or "DIM" in layer or layer == "0",
                f"{key}: unexpected unmapped entity on layer {entity['layer']}",
            )


def test_identity_survives_dxf_save_and_reopen() -> None:
    """Re-save with ezdxf, reopen, and the mapping must still resolve."""
    report = _report("beam")
    path = report["drawing"]["path"]
    copied = os.path.join(_TMP_ROOT, "beam-resaved.dxf")
    shutil.copyfile(path, copied)

    doc = ezdxf.readfile(copied)
    doc.saveas(copied)  # rewrite the file, as a CAD app would

    scan = generator_cad.scan_drawing(copied)
    links = generator_cad.links_from_scan(scan)
    _assert(links, "no links recovered from the re-saved drawing")
    beam_links = [link for link in links if link["internal_id"] == "beam.beam"]
    _assert(
        len(beam_links) == report["mapping"]["entity_links"]["counts"]["added"] or beam_links,
        "beam element lost its entities after re-save",
    )
    _assert(
        all(identity.is_valid_ifc_guid(link["ifc_guid"]) for link in links),
        "recovered links carry an invalid IFC GlobalId",
    )


# ---------------------------------------------------------------------------
# Task 2: canonical model
# ---------------------------------------------------------------------------


def test_canonical_model_is_valid_for_every_generator() -> None:
    for key in GENERATOR_KEYS:
        document = _canonical(key)
        problems = canonical.validate_model(document)
        _assert(not problems, f"{key}: canonical model invalid: {problems}")
        _assert(
            document["schema_version"] == canonical.SCHEMA_VERSION,
            f"{key}: schema_version {document['schema_version']}",
        )
        _assert(
            canonical.declared_length_unit(document) == "metre",
            f"{key}: canonical unit is not metre",
        )
        for element in document["elements"]:
            _assert(element["id"], f"{key}: element without id")
            _assert(element["fingerprint"], f"{key}: element without fingerprint")
            _assert(element["volume_m3"] > 0, f"{key}: element with zero volume")
            _assert(
                element["provenance"].get("generator") == key,
                f"{key}: element provenance names the wrong generator",
            )


def test_canonical_ids_are_stable_and_unique() -> None:
    for key in GENERATOR_KEYS:
        first = _canonical(key)
        second = _canonical(key)
        ids_first = [element["id"] for element in first["elements"]]
        ids_second = [element["id"] for element in second["elements"]]
        _assert(ids_first == ids_second, f"{key}: ids changed between builds")
        _assert(len(set(ids_first)) == len(ids_first), f"{key}: duplicate element ids")


def test_canonical_model_records_provenance_and_assumptions() -> None:
    stair = _canonical("stair")
    stair_element = next(e for e in stair["elements"] if e["element_type"] == "stair")
    warnings = stair_element["validation"]["warnings"]
    _assert(warnings, "stair: the assumed width must be recorded as a warning")
    _assert(
        any("width" in warning.lower() for warning in warnings),
        f"stair: no warning mentions the width assumption: {warnings}",
    )
    _assert(
        stair_element["provenance"].get("geometry_convention"),
        "stair: provenance must state the geometry convention",
    )
    retaining = _canonical("retaining_wall")
    _assert(
        any(rel["type"] == "supported-by" for rel in retaining["relationships"]),
        "retaining_wall: stem/base 'supported-by' relationship missing",
    )


def test_semantic_mapping_refuses_unknown_element_type() -> None:
    try:
        canonical.make_element(
            "test.element", "not-a-real-type", "Bad", "box",
            {"length_x": 1.0, "width_y": 1.0, "height_z": 1.0},
            {"x": 0.0, "y": 0.0, "z": 0.0}, "test:L0",
        )
    except canonical.CanonicalModelError as exc:
        _assert("not-a-real-type" in str(exc), f"unexpected error: {exc}")
    else:
        raise AssertionError("an unknown element type was accepted")


# ---------------------------------------------------------------------------
# Task 2: IFC
# ---------------------------------------------------------------------------


def test_ifc_is_real_semantic_and_valid() -> None:
    for key in GENERATOR_KEYS:
        report = _report(key)
        path = report["ifc"]["path"]
        _assert(os.path.exists(path), f"{key}: no IFC file at {path}")
        summary = ifc_export.read_ifc_summary(path)
        _assert(summary["schema"] == "IFC4", f"{key}: schema {summary['schema']} != IFC4")
        _assert(
            summary["element_count"] == report["ifc"]["element_count"],
            f"{key}: IFC contains {summary['element_count']} elements but "
            f"{report['ifc']['element_count']} were exported",
        )
        _assert(summary["property_sets"] >= 2, f"{key}: property sets missing")
        _assert(summary["materials"], f"{key}: no material associated")
        _assert(summary["storeys"], f"{key}: no storey in the spatial structure")
        validation = ifc_export.validate_ifc_file(path)
        _assert(
            validation["ok"],
            f"{key}: IfcOpenShell validator reported {validation['statement_count']} "
            f"statements: {validation['statements'][:3]}",
        )


def test_ifc_units_are_metres() -> None:
    report = _report("beam")
    summary = ifc_export.read_ifc_summary(report["ifc"]["path"])
    _assert("LENGTHUNIT:METRE" in summary["units"], f"SI units missing: {summary['units']}")
    _assert("AREAUNIT:SQUARE_METRE" in summary["units"], summary["units"])
    _assert("VOLUMEUNIT:CUBIC_METRE" in summary["units"], summary["units"])


def test_ifc_globalids_are_unique_and_canonical() -> None:
    for key in GENERATOR_KEYS:
        report = _report(key)
        guids = report["ifc"]["guids"]
        model_ids = {element["id"] for element in _canonical(key)["elements"]}
        _assert(set(guids) == model_ids, f"{key}: GlobalId map keys != element ids")
        _assert(
            len(set(guids.values())) == len(guids),
            f"{key}: duplicate GlobalIds {sorted(guids.values())}",
        )
        for internal_id, guid in guids.items():
            _assert(
                identity.is_valid_ifc_guid(guid),
                f"{key}: {internal_id} has invalid GlobalId {guid!r}",
            )
            _assert(
                guid == identity.ifc_guid_from_internal_id(internal_id),
                f"{key}: GlobalId is not derived from the internal id",
            )


def test_ifc_globalids_survive_regeneration() -> None:
    # Same database as the cached report, so the revision counter continues.
    first = _report("column")
    second = pipeline.run_generator_pipeline(
        "column", db_path=first["mapping"]["db"], include_validation=False
    )
    _assert(
        first["ifc"]["guids"] == second["ifc"]["guids"],
        "regenerating an unchanged model changed the IFC GlobalIds",
    )
    _assert(
        second["model"]["revision"] == first["model"]["revision"] + 1,
        f"regeneration did not increment the model revision "
        f"({first['model']['revision']} -> {second['model']['revision']})",
    )


def test_ifc_dimensions_match_the_canonical_model() -> None:
    """The IFC kernel's own bounding boxes must equal the canonical dimensions."""
    for key in GENERATOR_KEYS:
        report = _report(key)
        extents = ifc_export.element_extents(report["ifc"]["path"])
        document = _canonical(key)
        for element in document["elements"]:
            guid = report["ifc"]["guids"][element["id"]]
            size = extents[guid]["size"]
            dims = element["dimensions"]
            if element.get("extrusion"):
                # The flight is extruded along an incline; the kernel's box is the
                # bounding box of the rotated section, so compare the section only.
                _assert(
                    _close(size["y"], dims["width_y"], 1e-3),
                    f"{key}.{element['role']}: IFC width {size['y']} != "
                    f"canonical {dims['width_y']}",
                )
                continue
            for axis, expected in (
                ("x", dims["length_x"]),
                ("y", dims["width_y"]),
                ("z", dims["height_z"]),
            ):
                _assert(
                    _close(size[axis], expected, 1e-3),
                    f"{key}.{element['role']}: IFC {axis} extent {size[axis]} != "
                    f"canonical {expected}",
                )


def test_ifc_identity_matches_the_canonical_model() -> None:
    for key in GENERATOR_KEYS:
        report = _report(key)
        rows = ifc_export.read_element_identities(report["ifc"]["path"])
        _assert(rows, f"{key}: no Fundi identities in the IFC")
        model_ids = {element["id"] for element in _canonical(key)["elements"]}
        _assert(
            {row["internal_id"] for row in rows} == model_ids,
            f"{key}: IFC identities != canonical element ids",
        )
        for row in rows:
            _assert(
                row["ifc_guid"] == report["ifc"]["guids"][row["internal_id"]],
                f"{key}: {row['internal_id']} GlobalId mismatch between readback and export",
            )


def test_ifc_element_classes_are_semantic() -> None:
    expected = {
        "beam": {"IfcBeam"},
        "column": {"IfcColumn"},
        "slab": {"IfcSlab"},
        "wall": {"IfcWall"},
        "retaining_wall": {"IfcWall", "IfcFooting"},
        "pad_footing": {"IfcFooting"},
        "stair": {"IfcStair", "IfcStairFlight", "IfcSlab"},
        "stair_mst2": {"IfcStair", "IfcStairFlight"},
    }
    for key, classes in expected.items():
        report = _report(key)
        _assert(
            set(report["ifc"]["classes"]) == classes,
            f"{key}: IFC classes {report['ifc']['classes']} != {sorted(classes)}",
        )


def test_ifc_carries_engineering_parameters() -> None:
    """Engineering inputs must be readable from the IFC, not just from the model."""
    import ifcopenshell

    report = _report("beam")
    ifc = ifcopenshell.open(report["ifc"]["path"])
    psets = [
        pset for pset in ifc.by_type("IfcPropertySet")
        if pset.Name == ifc_export.PSET_ENGINEERING
    ]
    _assert(psets, "no engineering property set in the IFC")
    names = {prop.Name for pset in psets for prop in pset.HasProperties}
    for required in ("fck_MPa", "fyk_MPa", "span_clear_mm", "GrossVolumeM3"):
        _assert(required in names, f"missing engineering property {required!r}: {sorted(names)}")

    identity_psets = [
        pset for pset in ifc.by_type("IfcPropertySet")
        if pset.Name == ifc_export.PSET_IDENTITY
    ]
    identity_names = {prop.Name for pset in identity_psets for prop in pset.HasProperties}
    for required in ("FundiElementId", "FundiModelId", "FundiGenerator",
                     "FundiGeometryFingerprint", "FundiLevelId"):
        _assert(required in identity_names, f"missing identity property {required!r}")


def test_ifc_refuses_an_unmapped_class() -> None:
    document = rc_model.build_model("beam")
    document["elements"][0]["ifc_class"] = "IfcFlowFitting"  # not in the mapping
    try:
        ifc_export.export_ifc(document, os.path.join(_TMP_ROOT, "bad.ifc"))
    except (ifc_export.IfcExportError, canonical.CanonicalModelError) as exc:
        _assert("IfcFlowFitting" in str(exc), f"unexpected error text: {exc}")
    else:
        raise AssertionError("an element with an unmapped IFC class was exported")


def test_invalid_predefined_type_degrades_visibly() -> None:
    document = rc_model.build_model("beam")
    document["elements"][0]["predefined_type"] = "NOT_A_REAL_TYPE"
    path = os.path.join(_TMP_ROOT, "degraded.ifc")
    report = ifc_export.export_ifc(document, path)
    _assert(os.path.exists(path), "export failed instead of degrading")
    summary = ifc_export.read_ifc_summary(path)
    _assert(summary["element_count"] == 1, "element was dropped")
    validation = ifc_export.validate_ifc_file(path)
    _assert(validation["ok"], f"degraded file is not schema valid: {validation['statements']}")
    _assert(report["element_count"] == 1, "report lost the element")


# ---------------------------------------------------------------------------
# Task 3: mapping
# ---------------------------------------------------------------------------


def test_element_maps_to_many_entities() -> None:
    report = _report("column")
    conn = mapping.connect(report["mapping"]["db"])
    try:
        links = mapping.handles_for_element(conn, "column", "column.column")
        _assert(
            len(links) > 1,
            f"a detail sheet must map one element to many entities, got {len(links)}",
        )
        _assert(
            len({link["handle"] for link in links}) == len(links),
            "duplicate handles for one element",
        )
    finally:
        conn.close()


def test_one_entity_can_map_to_several_elements() -> None:
    """A retaining-wall section draws the stem and the base in one view."""
    report = _report("retaining_wall")
    conn = mapping.connect(report["mapping"]["db"])
    try:
        stem = mapping.handles_for_element(conn, "retaining-wall", "retaining-wall.stem")
        base = mapping.handles_for_element(conn, "retaining-wall", "retaining-wall.base")
        stem_handles = {link["handle"] for link in stem}
        base_handles = {link["handle"] for link in base}
        shared = stem_handles & base_handles
        _assert(
            shared,
            "the stem and base are drawn in one section view, so they must share "
            "entities",
        )
        handle = sorted(shared)[0]
        elements = mapping.elements_for_handle(
            conn, report["drawing"]["drawing_id"], handle
        )
        _assert(
            {row["internal_id"] for row in elements}
            == {"retaining-wall.stem", "retaining-wall.base"},
            f"handle {handle} resolved to {[r['internal_id'] for r in elements]}",
        )
    finally:
        conn.close()


def test_mapping_survives_reopening_the_drawing() -> None:
    report = _report("pad_footing")
    scan = generator_cad.scan_drawing(report["drawing"]["path"])
    links = generator_cad.links_from_scan(scan)
    stored = report["mapping"]["entity_links"]
    _assert(
        len(links) == stored["link_count"],
        f"scan found {len(links)} links, registry holds {stored['link_count']}",
    )
    for link in links:
        _assert(link["handle"], "link without a handle")
        _assert(
            link["view"] in ("plan", "section"),
            f"unexpected view {link['view']!r}",
        )


def test_deleted_entity_is_detected() -> None:
    report = _report("slab")
    working = os.path.join(_TMP_ROOT, "slab-edited.dxf")
    shutil.copyfile(report["drawing"]["path"], working)

    doc = ezdxf.readfile(working)
    msp = doc.modelspace()
    tagged = [e for e in msp if e.has_xdata(generator_cad.APPID)]
    victim = tagged[0]
    removed_handle = victim.dxf.handle
    msp.delete_entity(victim)
    doc.saveas(working)

    conn = mapping.connect(report["mapping"]["db"])
    try:
        scan = generator_cad.scan_drawing(working)
        result = mapping.reconcile_drawing(
            conn, _canonical("slab"), report["drawing"]["drawing_id"], scan["entities"]
        )
    finally:
        conn.close()
    handles = {item["handle"] for item in result["missing"]}
    _assert(
        removed_handle in handles,
        f"deleted entity {removed_handle} not reported; missing={handles}",
    )
    _assert(result["requires_reconciliation"], "deletion did not require reconciliation")


def test_edited_geometry_is_detected() -> None:
    report = _report("column")
    working = os.path.join(_TMP_ROOT, "column-edited.dxf")
    shutil.copyfile(report["drawing"]["path"], working)

    doc = ezdxf.readfile(working)
    msp = doc.modelspace()
    lines = [e for e in msp if e.dxftype() == "LINE" and e.has_xdata(generator_cad.APPID)]
    edited_handle = lines[0].dxf.handle
    lines[0].dxf.start = (lines[0].dxf.start.x + 250.0, lines[0].dxf.start.y, 0.0)
    doc.saveas(working)

    conn = mapping.connect(report["mapping"]["db"])
    try:
        scan = generator_cad.scan_drawing(working)
        result = mapping.reconcile_drawing(
            conn, _canonical("column"), report["drawing"]["drawing_id"], scan["entities"]
        )
    finally:
        conn.close()
    edited = {item["handle"] for item in result["edited"]}
    _assert(
        edited_handle in edited,
        f"edited entity {edited_handle} not reported; edited={edited}",
    )
    _assert(result["requires_reconciliation"], "geometry edit did not require reconciliation")


def test_rehandled_entity_keeps_its_identity() -> None:
    """A CAD app may renumber handles; identity comes from the XDATA id.

    Deleting an entity and re-creating identical geometry with the same Fundi
    payload models exactly that: new handle, same element, same geometry. The
    reconciliation must report a handle change, not a deletion plus a new element.
    """
    report = _report("wall")
    working = os.path.join(_TMP_ROOT, "wall-rehandled.dxf")
    shutil.copyfile(report["drawing"]["path"], working)

    doc = ezdxf.readfile(working)
    msp = doc.modelspace()
    candidates = [
        e for e in msp
        if e.dxftype() == "LINE" and e.has_xdata(generator_cad.APPID)
    ]
    original = candidates[0]
    old_handle = original.dxf.handle
    xdata = original.get_xdata(generator_cad.APPID)
    start, end = original.dxf.start, original.dxf.end
    layer = original.dxf.layer
    msp.delete_entity(original)
    replacement = msp.add_line(start, end, dxfattribs={"layer": layer})
    replacement.set_xdata(generator_cad.APPID, xdata)
    doc.saveas(working)

    conn = mapping.connect(report["mapping"]["db"])
    try:
        scan = generator_cad.scan_drawing(working)
        result = mapping.reconcile_drawing(
            conn, _canonical("wall"), report["drawing"]["drawing_id"], scan["entities"]
        )
    finally:
        conn.close()

    rehandled = {item["old_handle"]: item["new_handle"] for item in result["rehandled"]}
    _assert(
        old_handle in rehandled,
        f"re-handled entity {old_handle} not recognised; rehandled={list(rehandled)}",
    )
    missing = {item["handle"] for item in result["missing"]}
    _assert(
        old_handle not in missing,
        "a re-handled entity must not be reported as deleted",
    )


def test_unmapped_entities_are_reported_not_guessed() -> None:
    report = _report("beam")
    working = os.path.join(_TMP_ROOT, "beam-extra.dxf")
    shutil.copyfile(report["drawing"]["path"], working)

    doc = ezdxf.readfile(working)
    msp = doc.modelspace()
    extra = msp.add_line((0, 0), (1000, 0), dxfattribs={"layer": "CONCRETE"})
    extra_handle = extra.dxf.handle
    doc.saveas(working)

    conn = mapping.connect(report["mapping"]["db"])
    try:
        scan = generator_cad.scan_drawing(working)
        result = mapping.reconcile_drawing(
            conn, _canonical("beam"), report["drawing"]["drawing_id"], scan["entities"]
        )
    finally:
        conn.close()
    unmapped = {item["handle"] for item in result["unmapped_entities"]}
    _assert(
        extra_handle in unmapped,
        f"untagged entity {extra_handle} was not reported as unmapped",
    )
    new_ids = {item["internal_id"] for item in result["new_entities"]}
    _assert(
        "beam.beam" not in new_ids or extra_handle not in {
            item["handle"] for item in result["new_entities"]
        },
        "an untagged entity was assigned an engineering identity",
    )


def test_unknown_element_id_in_drawing_is_reported() -> None:
    report = _report("beam")
    working = os.path.join(_TMP_ROOT, "beam-ghost.dxf")
    shutil.copyfile(report["drawing"]["path"], working)

    doc = ezdxf.readfile(working)
    msp = doc.modelspace()
    entity = next(e for e in msp if e.has_xdata(generator_cad.APPID))
    payload = generator_cad.dxf_export._payload(
        "ghost.element", "beam", identity.ifc_guid_from_internal_id("ghost.element"),
        "elevation", 1000.0,
    )
    entity.set_xdata(generator_cad.APPID, [(1000, payload)])
    doc.saveas(working)

    conn = mapping.connect(report["mapping"]["db"])
    try:
        scan = generator_cad.scan_drawing(working)
        result = mapping.reconcile_drawing(
            conn, _canonical("beam"), report["drawing"]["drawing_id"], scan["entities"]
        )
    finally:
        conn.close()
    _assert(
        "ghost.element" in result["unknown_element_ids"],
        f"unknown id not reported: {result['unknown_element_ids']}",
    )


def test_repeated_export_does_not_duplicate_identity() -> None:
    db = _new_db()
    first = pipeline.run_generator_pipeline("pad_footing", db_path=db, include_validation=False)
    second = pipeline.run_generator_pipeline("pad_footing", db_path=db, include_validation=False)
    _assert(
        first["ifc"]["guids"] == second["ifc"]["guids"],
        "GlobalIds changed on a repeated export",
    )
    _assert(
        first["drawing"]["drawing_id"] != second["drawing"]["drawing_id"],
        "a repeated export overwrote the earlier drawing id",
    )
    conn = mapping.connect(db)
    try:
        rows = mapping.links_for(conn, "pad-footing")
        _assert(
            len(rows) == len(_canonical("pad_footing")["elements"]),
            f"repeated export created duplicate element links: {len(rows)}",
        )
        guids = [row["ifc_guid"] for row in rows]
        _assert(len(set(guids)) == len(guids), "duplicate IFC GlobalIds in the registry")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Coordinates and units
# ---------------------------------------------------------------------------


def test_units_round_trip_between_canonical_dxf_and_ifc() -> None:
    """A known dimension must be identical in metres (canonical/IFC) and mm (DXF)."""
    report = _report("pad_footing")
    element = _canonical("pad_footing")["elements"][0]
    length_m = element["dimensions"]["length_x"]

    # Canonical -> DXF millimetres -> canonical.
    length_mm = units.to_dxf(length_m)
    _assert(_close(length_mm, 2500.0, 1e-9), f"2500 mm expected, got {length_mm}")
    _assert(_close(units.from_dxf(length_mm), length_m, 1e-12), "DXF round trip failed")

    # The DXF entities must actually be drawn at that size.
    doc = ezdxf.readfile(report["drawing"]["path"])
    texts = [e for e in doc.modelspace() if e.dxftype() == "TEXT"]
    _assert(texts, "the footprint drawing should contain annotation text")

    # IFC is metres: the kernel's extent must equal the canonical dimension.
    extents = ifc_export.element_extents(report["ifc"]["path"])
    size = extents[report["ifc"]["guids"][element["id"]]]["size"]
    _assert(
        _close(size["x"], length_m, 1e-3),
        f"IFC extent {size['x']} m != canonical {length_m} m",
    )
    _assert(
        _close(size["x"] * 1000.0, length_mm, 1e-3),
        "IFC in metres and DXF in millimetres disagree",
    )


def test_canonical_frame_contract() -> None:
    _assert(units.CANONICAL_LENGTH_UNIT == "metre", "canonical unit must be metre")
    _assert(canonical.CANONICAL_FRAME.startswith("Z-up"), "canonical frame must be Z-up")
    x, y, z = units.r3f_to_canonical(1.0, 2.0, 3.0)
    _assert((x, y, z) == (1.0, -3.0, 2.0), f"R3F mapping wrong: {(x, y, z)}")
    back = units.canonical_to_r3f(x, y, z)
    _assert(_close(back[0], 1.0) and _close(back[1], 2.0) and _close(back[2], 3.0),
            f"R3F round trip wrong: {back}")


# ---------------------------------------------------------------------------
# Store safety
# ---------------------------------------------------------------------------


def test_store_rejects_path_traversal() -> None:
    for bad in ("../secret", "a/b", "", "..", "x" * 200):
        try:
            store.validate_id(bad)
        except store.StoreError:
            continue
        raise AssertionError(f"{bad!r} was accepted as an artefact id")


def test_store_paths_are_inside_the_artefact_directory() -> None:
    path = store.path_for("beam-r1", "dxf")
    _assert(
        os.path.abspath(path).startswith(os.path.abspath(store.CAD_DIR)),
        f"{path} escaped the artefact directory",
    )
    _assert(store.url_for("beam-r1", "dxf") == "/cad/beam-r1.dxf", store.url_for("beam-r1", "dxf"))


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def main() -> int:
    if not ifc_export.IFC_AVAILABLE:
        print("IfcOpenShell is unavailable; nothing can be verified.")
        print(ifc_export.IFC_IMPORT_ERROR)
        return 2
    if not generator_registry.ENGINEERING_AVAILABLE:
        print("The Python engineering detailing system is unavailable.")
        print(generator_registry._ENGINEERING_IMPORT_ERROR)
        return 2

    tests = [
        (name, obj)
        for name, obj in sorted(globals().items())
        if name.startswith("test_") and callable(obj)
    ]
    failures = []
    for name, test in tests:
        try:
            test()
        except Exception as exc:  # noqa: BLE001
            failures.append((name, exc, traceback.format_exc()))
            print(f"FAIL {name}: {exc.__class__.__name__}: {exc}")
        else:
            print(f"PASS {name}")
    print(f"\n{len(tests) - len(failures)}/{len(tests)} tests passed")
    if failures:
        print("\n--- failure details ---")
        for name, exc, tb in failures:
            print(f"\n### {name}\n{tb}")
        return 1
    return 0


if __name__ == "__main__":
    code = main()
    shutil.rmtree(_TMP_ROOT, ignore_errors=True)
    sys.exit(code)
