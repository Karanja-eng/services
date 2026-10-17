"""
Proof-of-concept tests for the Fundi Studio CAD + BIM + IFC integration.

Run with either:

    python test_cad_ifc_poc.py          (no pytest required)
    python -m pytest test_cad_ifc_poc.py -v

Coverage (as required by the task):
  * real CAD drawing and real IFC file from one real generator (septic tank)
  * shared coordinates and correct dimensions between DXF, IFC and the model
  * a persistent mapping between a CAD entity and an IFC element
  * controlled parameter change followed by geometry regeneration
  * stale mappings, deleted entities, unit mismatches, coordinate offsets
  * manual drafting content preserved across regeneration
  * external modification (conflict) detection instead of silent overwrite
"""

from __future__ import annotations

import json
import os
import shutil
import sqlite3
import sys
import tempfile
import traceback
import uuid

import ezdxf

from src.Backend.cad_ifc import (
    dxf_export,
    identity,
    ifc_export,
    mapping,
    pipeline,
    septic_model,
    units,
)

MODEL_ID = septic_model.SEPTIC_MODEL_ID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class Workspace:
    """Isolated output directory + mapping DB for one test."""

    #: Scratch root inside the repository (the sandbox forbids OS temp writes).
    SCRATCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".poc-test-tmp")

    def __init__(self) -> None:
        os.makedirs(self.SCRATCH, exist_ok=True)
        # ``tempfile.mkdtemp`` applies mode 0o700, which on Windows creates a
        # directory whose ACL drops inheritance and is then refused by the file
        # sandbox. A plain directory keeps the inherited ACL.
        self.root = os.path.join(self.SCRATCH, "run-" + uuid.uuid4().hex[:10])
        os.makedirs(self.root, exist_ok=False)
        self.out_dir = os.path.join(self.root, "out")
        self.db_path = os.path.join(self.root, "mapping.sqlite")

    def run(self, params=None, **kwargs):
        return pipeline.run_pipeline(
            params,
            out_dir=self.out_dir,
            db_path=self.db_path,
            model_id=MODEL_ID,
            include_validation=kwargs.pop("include_validation", True),
            **kwargs,
        )

    def path(self, name: str) -> str:
        return os.path.join(self.out_dir, name)

    def cleanup(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


def _assert(condition, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _close(a: float, b: float, tol: float) -> bool:
    return abs(a - b) <= tol


# ---------------------------------------------------------------------------
# Tests: identity and units
# ---------------------------------------------------------------------------


def test_ifc_guid_is_valid_and_deterministic() -> None:
    guid = identity.ifc_guid_from_internal_id("septic-system.tank.wall.north")
    _assert(len(guid) == 22, f"GlobalId must be 22 chars, got {len(guid)}")
    _assert(identity.is_valid_ifc_guid(guid), f"invalid GlobalId alphabet: {guid}")
    _assert(
        guid == identity.ifc_guid_from_internal_id("septic-system.tank.wall.north"),
        "GlobalId must be deterministic for the same internal id",
    )
    _assert(
        guid != identity.ifc_guid_from_internal_id("septic-system.tank.wall.south"),
        "different internal ids must give different GlobalIds",
    )


def test_copy_suffix_keeps_first_identity() -> None:
    original = "septic-system.tank.wall.north"
    _assert(identity.copy_suffix(original, 1) == original, "first occurrence keeps identity")
    _assert(identity.copy_suffix(original, 2).endswith("#copy2"), "second occurrence re-identified")
    _assert(identity.base_internal_id(identity.copy_suffix(original, 3)) == original,
            "copy suffix must be reversible")


def test_unit_conversions() -> None:
    _assert(_close(units.to_dxf(3.4), 3400.0, 1e-9), "3.4 m must be 3400 mm")
    _assert(_close(units.from_dxf(3400.0), 3.4, 1e-9), "3400 mm must be 3.4 m")
    try:
        units.assert_unit(units.DXF_LENGTH_UNIT, "inches", context="test")
    except units.UnitMismatchError:
        pass
    else:
        raise AssertionError("unit mismatch must raise")


def test_r3f_to_canonical_mapping() -> None:
    # R3F front wall sits at z = -extW/2 + wall/2, y = bed + depth/2.
    x, y, z = units.r3f_to_canonical(0.0, 1.15, -1.35)
    _assert(_close(x, 0.0, 1e-12) and _close(y, 1.35, 1e-12) and _close(z, 1.15, 1e-12),
            f"R3F->canonical mapping wrong: {(x, y, z)}")


# ---------------------------------------------------------------------------
# Tests: canonical model
# ---------------------------------------------------------------------------


def test_canonical_model_matches_generator_geometry() -> None:
    model = septic_model.build_model()
    params = model["parameters"]
    ext_l = params["tank_int_l"] + 2 * params["wall_thick"]
    ext_w = params["tank_int_w"] + 2 * params["wall_thick"]

    base = septic_model.element_by_id(model, "septic-system.tank.base_slab")
    _assert(base is not None, "base slab element must exist")
    _assert(_close(base["dimensions"]["length_x"], ext_l, 1e-9),
            f"base slab length {base['dimensions']['length_x']} != extL {ext_l}")
    _assert(_close(base["dimensions"]["width_y"], ext_w, 1e-9),
            f"base slab width {base['dimensions']['width_y']} != extW {ext_w}")

    north = septic_model.element_by_id(model, "septic-system.tank.wall.north")
    south = septic_model.element_by_id(model, "septic-system.tank.wall.south")
    _assert(north["placement"]["y"] > 0 and south["placement"]["y"] < 0,
            "north/south walls must be on opposite sides")
    _assert(_close(north["placement"]["y"], ext_w / 2 - params["wall_thick"] / 2, 1e-9),
            "north wall must sit against the external face")

    top = septic_model.element_by_id(model, "septic-system.tank.top_slab")
    expected_top = params["bed_thick_tank"] + params["tank_depth_int"] + params["slab_thick"] / 2
    _assert(_close(top["placement"]["z"], expected_top, 1e-9),
            f"top slab elevation {top['placement']['z']} != {expected_top}")

    # Semantic classes, not anonymous meshes.
    classes = model["statistics"]["by_ifc_class"]
    _assert(classes.get("IfcWall", 0) >= 10, f"walls expected, got {classes}")
    _assert(classes.get("IfcSlab", 0) >= 5, f"slabs expected, got {classes}")
    _assert(classes.get("IfcPipeSegment", 0) == 3, f"pipes expected, got {classes}")
    _assert(model["statistics"]["total_volume_m3"] > 0, "volumes must be computed")


def test_model_units_declared_metres() -> None:
    model = septic_model.build_model()
    _assert(model["units"]["canonical"] == "metre", "canonical unit must be metre")
    _assert(model["units"]["dxf"] == "millimetre", "dxf unit must be millimetre")
    _assert(model["coordinate_system"]["up_axis"] == "Z", "canonical frame must be Z-up")


# ---------------------------------------------------------------------------
# Tests: real IFC artefact
# ---------------------------------------------------------------------------


def test_ifc_file_is_real_and_semantic() -> None:
    ws = Workspace()
    try:
        report = ws.run()
        ifc_path = report["ifc"]["path"]
        _assert(os.path.getsize(ifc_path) > 5000, "IFC file looks empty")

        with open(ifc_path, "r", encoding="utf-8", errors="replace") as handle:
            head = handle.read(400)
        _assert(head.lstrip().startswith("ISO-10303-21"), "not a STEP/IFC file")
        _assert("IFC4" in head, "IFC schema not declared in header")

        summary = ifc_export.read_ifc_summary(ifc_path)
        _assert(summary["element_count"] == report["model"]["element_count"],
                "element count differs between model and exported IFC")
        _assert(summary["by_class"].get("IfcWall", 0) > 0, "no IfcWall in file")
        _assert(summary["by_class"].get("IfcSlab", 0) > 0, "no IfcSlab in file")
        _assert("LENGTHUNIT:METRE" in summary["units"], f"SI units missing: {summary['units']}")
        _assert(len(summary["spatial_structure"]) == 3, "site/building/storey required")
        _assert(len(summary["fundi_element_ids"]) == summary["element_count"],
                "every element must carry a Fundi identity property")
        _assert("Concrete C25/30" in summary["materials"], "materials must be exported")

        validation = ifc_export.validate_ifc_file(ifc_path)
        _assert(validation["ok"], f"IfcOpenShell validation errors: {validation['statements']}")

        geometries = list(ifc_export.iter_element_geometries(ifc_path))
        _assert(len(geometries) == summary["element_count"],
                f"geometry kernel returned {len(geometries)} of {summary['element_count']}")
        _assert(all(g.get("vertex_count", 0) > 0 for g in geometries),
                "every IFC element must produce a mesh")
    finally:
        ws.cleanup()


def test_ifc_geometry_bounding_box_matches_model() -> None:
    ws = Workspace()
    try:
        report = ws.run()
        model_doc = json.load(open(report["model"]["json"], encoding="utf-8"))
        base = septic_model.element_by_id(model_doc, "septic-system.tank.base_slab")
        expected = base["dimensions"]["length_x"]

        geometry = next(
            g for g in ifc_export.iter_element_geometries(report["ifc"]["path"])
            if g["guid"] == base["ifc_guid"]
        )
        width = geometry["bbox"]["x"][1] - geometry["bbox"]["x"][0]
        _assert(_close(width, expected, 1e-4),
                f"IFC base slab X extent {width} != canonical {expected}")
    finally:
        ws.cleanup()


# ---------------------------------------------------------------------------
# Tests: real DXF artefact
# ---------------------------------------------------------------------------


def test_dxf_file_is_real_and_millimetres() -> None:
    ws = Workspace()
    try:
        report = ws.run()
        dxf_path = report["dxf"]["path"]
        doc = ezdxf.readfile(dxf_path)
        _assert(int(doc.header["$INSUNITS"]) == 4, "$INSUNITS must be 4 (millimetres)")
        _assert(int(doc.header["$MEASUREMENT"]) == 1, "$MEASUREMENT must be 1 (metric)")

        model_doc = json.load(open(report["model"]["json"], encoding="utf-8"))
        base = septic_model.element_by_id(model_doc, "septic-system.tank.base_slab")
        expected_mm = base["dimensions"]["length_x"] * 1000.0

        scan = dxf_export.scan_dxf_links(dxf_path)
        plan = [e for e in scan["entities"]
                if e["internal_id"] == base["id"] and e["view"] == "plan"]
        _assert(len(plan) == 1, "base slab must appear exactly once in the plan view")
        entity = doc.entitydb[plan[0]["handle"]]
        points = list(entity.get_points("xy"))
        xs = [p[0] for p in points]
        _assert(_close(max(xs) - min(xs), expected_mm, 1e-6),
                f"DXF plan width {max(xs) - min(xs)} mm != {expected_mm} mm")
        _assert(_close(min(xs), -expected_mm / 2, 1e-6),
                "plan must be centred on the canonical origin (no coordinate offset)")

        layers = {e.dxf.layer for e in doc.modelspace()}
        _assert("FUNDI_MODEL" in layers, "model layer missing")
        _assert("FUNDI_DIM" in layers, "dimension layer missing (no real dimensions)")
        _assert("FUNDI_TITLE" in layers, "title block missing (not a drawing sheet)")

        units_check = dxf_export.check_unit_consistency(dxf_path)
        _assert(units_check["ok"], f"unit consistency failed: {units_check['problems']}")
    finally:
        ws.cleanup()


def test_dxf_section_contains_only_cut_elements() -> None:
    model_doc = septic_model.build_model()
    section_ids = set(dxf_export.section_only_entities(model_doc))
    _assert("septic-system.tank.base_slab" in section_ids, "base slab crosses the section plane")
    _assert("septic-system.tank.wall.north" not in section_ids,
            "north wall is outside the section plane and must not be cut")
    _assert("septic-system.tank.baffle~1" in section_ids, "baffles cross the section plane")


# ---------------------------------------------------------------------------
# Tests: persistent mapping
# ---------------------------------------------------------------------------


def test_mapping_is_persistent_and_one_to_one() -> None:
    ws = Workspace()
    try:
        report = ws.run()
        conn = mapping.connect(ws.db_path)
        links = mapping.links_for(conn, MODEL_ID)
        _assert(len(links) == report["model"]["element_count"], "one link per element expected")

        handles = [l["dxf_handle"] for l in links]
        _assert(all(handles), "every link must reference a real DXF handle")
        _assert(len(set(handles)) == len(handles), "DXF handles must be unique per element")
        _assert(len({l["ifc_guid"] for l in links}) == len(links), "IFC GlobalIds must be unique")
        _assert(all(l["status"] == "ok" for l in links),
                f"unexpected statuses: {[l['status'] for l in links]}")

        # A CAD entity is resolvable from its handle, and an IFC element from its
        # GlobalId - the two directions the viewers need.
        sample = links[0]
        by_handle = mapping.find_by_handle(conn, report["mapping"]["sync"]["drawing_id"],
                                           sample["dxf_handle"])
        _assert(by_handle and by_handle["internal_id"] == sample["internal_id"],
                "handle -> element lookup failed")
        by_guid = mapping.find_by_ifc_guid(conn, MODEL_ID, sample["ifc_guid"])
        _assert(by_guid and by_guid["internal_id"] == sample["internal_id"],
                "GlobalId -> element lookup failed")

        # The mapping document written for the browser must contain the link.
        document = json.load(open(ws.path(f"{MODEL_ID}.links.json"), encoding="utf-8"))
        _assert(any(l["internal_id"] == sample["internal_id"] for l in document["links"]),
                "mapping JSON does not contain the element")
        conn.close()
    finally:
        ws.cleanup()


def test_ifc_guids_survive_regeneration() -> None:
    ws = Workspace()
    try:
        first = ws.run()
        guids_before = _guids_from_db(ws.db_path)
        second = ws.run()  # same parameters, regenerated
        guids_after = _guids_from_db(ws.db_path)
        _assert(guids_before == guids_after,
                "IFC GlobalIds must be stable when the same element is regenerated")
        _assert(second["model"]["revision"] == first["model"]["revision"] + 1,
                "revision must increment on re-export")

        statuses = _statuses(ws.db_path)
        _assert(set(statuses.values()) == {"ok"},
                f"re-export must not create stale links: {statuses}")
    finally:
        ws.cleanup()


def test_parameter_change_regenerates_geometry_and_keeps_identity() -> None:
    ws = Workspace()
    try:
        first = ws.run()
        guids_before = _guids_from_db(ws.db_path)
        model_before = json.load(open(first["model"]["json"], encoding="utf-8"))

        changed = ws.run({"tank_int_l": 4.0, "tank_int_w": 3.0})
        model_after = json.load(open(changed["model"]["json"], encoding="utf-8"))

        base_before = septic_model.element_by_id(model_before, "septic-system.tank.base_slab")
        base_after = septic_model.element_by_id(model_after, "septic-system.tank.base_slab")
        _assert(base_after["dimensions"]["length_x"] > base_before["dimensions"]["length_x"],
                "changing tank_int_l must grow the base slab")
        _assert(base_after["ifc_guid"] == base_before["ifc_guid"],
                "identity must survive a parameter change")
        _assert(_guids_from_db(ws.db_path) == guids_before,
                "mapping must keep the same GlobalIds after regeneration")

        # The IFC on disk must actually reflect the new size.
        geometry = next(
            g for g in ifc_export.iter_element_geometries(changed["ifc"]["path"])
            if g["guid"] == base_after["ifc_guid"]
        )
        width = geometry["bbox"]["x"][1] - geometry["bbox"]["x"][0]
        _assert(_close(width, base_after["dimensions"]["length_x"], 1e-4),
                f"regenerated IFC geometry {width} != new canonical {base_after['dimensions']['length_x']}")

        statuses = _statuses(ws.db_path)
        _assert("regenerated" in statuses.values(), f"links should report regeneration: {statuses}")
    finally:
        ws.cleanup()


def test_deleted_element_is_marked_not_silently_dropped() -> None:
    ws = Workspace()
    try:
        ws.run()  # two baffles
        _assert(_status(ws.db_path, "septic-system.tank.baffle~2") == "ok",
                "baffle 2 should start as ok")

        ws.run({"num_baffles": 1, "baffle_heights": [1.5]})  # remove one baffle
        _assert(_status(ws.db_path, "septic-system.tank.baffle~2") == "deleted",
                "removed element must be marked deleted, not lost")
        # The surviving baffle is re-centred (baffle spacing depends on the
        # count), so its link must report regeneration rather than "ok".
        _assert(_status(ws.db_path, "septic-system.tank.baffle~1") == "regenerated",
                "remaining element must be reported as regenerated, not silently unchanged")
    finally:
        ws.cleanup()


def test_deleted_cad_entity_reports_stale_link() -> None:
    """Removing the entity from the DXF must surface as a stale link."""
    ws = Workspace()
    try:
        report = ws.run()
        dxf_path = report["dxf"]["path"]

        doc = ezdxf.readfile(dxf_path)
        scan = dxf_export.scan_dxf_links(dxf_path)
        target = next(e for e in scan["entities"]
                      if e["internal_id"] == "septic-system.tank.inlet_pipe" and e["view"] == "plan")
        doc.modelspace().delete_entity(doc.entitydb[target["handle"]])
        doc.saveas(dxf_path)

        conn = mapping.connect(ws.db_path)
        model_doc = json.load(open(report["model"]["json"], encoding="utf-8"))
        rescan = dxf_export.scan_dxf_links(dxf_path)
        sync = mapping.sync_links(
            conn,
            model_doc,
            drawing_id=report["mapping"]["sync"]["drawing_id"],
            dxf_links=rescan["entities"],
            ifc_guids={e["id"]: e["ifc_guid"] for e in model_doc["elements"]},
        )
        _assert(sync["counts"]["stale"] == 1, f"expected 1 stale link, got {sync['counts']}")
        _assert(_status(ws.db_path, "septic-system.tank.inlet_pipe") == "stale",
                "inlet pipe link must be stale after its plan entity was deleted")
        conn.close()
    finally:
        ws.cleanup()


def test_entity_missing_from_plan_view_is_stale_even_if_section_survives() -> None:
    """The plan view is the authoritative CAD handle for an element."""
    ws = Workspace()
    try:
        report = ws.run()
        dxf_path = report["dxf"]["path"]
        doc = ezdxf.readfile(dxf_path)
        scan = dxf_export.scan_dxf_links(dxf_path)
        target = next(e for e in scan["entities"]
                      if e["internal_id"] == "septic-system.tank.inlet_pipe"
                      and e["view"] == "plan")
        doc.modelspace().delete_entity(doc.entitydb[target["handle"]])
        doc.saveas(dxf_path)

        rescan = dxf_export.scan_dxf_links(dxf_path)
        views = [e["view"] for e in rescan["entities"]
                 if e["internal_id"] == "septic-system.tank.inlet_pipe"]
        _assert(views == ["section"], f"expect the section entity to remain, got {views}")

        conn = mapping.connect(ws.db_path)
        model_doc = json.load(open(report["model"]["json"], encoding="utf-8"))
        sync = mapping.sync_links(
            conn, model_doc,
            drawing_id=report["mapping"]["sync"]["drawing_id"],
            dxf_links=rescan["entities"],
            ifc_guids={e["id"]: e["ifc_guid"] for e in model_doc["elements"]},
        )
        _assert(sync["counts"]["stale"] == 1, f"expected 1 stale link: {sync['counts']}")
        row = mapping.link_for(conn, MODEL_ID, "septic-system.tank.inlet_pipe")
        _assert(row["status"] == "stale", f"status should be stale: {row['status']}")
        _assert("plan view entity missing" in (row["note"] or ""), row["note"])
        conn.close()
    finally:
        ws.cleanup()


def test_unit_mismatch_is_detected() -> None:
    ws = Workspace()
    try:
        report = ws.run()
        dxf_path = report["dxf"]["path"]

        doc = ezdxf.readfile(dxf_path)
        doc.header["$INSUNITS"] = 1  # inches: a classic re-import mistake
        doc.saveas(dxf_path)

        check = dxf_export.check_unit_consistency(dxf_path)
        _assert(not check["ok"], "re-scaled DXF must fail the unit check")
        _assert(any("INSUNITS" in p for p in check["problems"]), check["problems"])
    finally:
        ws.cleanup()


def test_coordinate_offset_is_detected_by_geometry() -> None:
    """A shifted drawing must not be accepted as matching the model."""
    ws = Workspace()
    try:
        report = ws.run()
        model_doc = json.load(open(report["model"]["json"], encoding="utf-8"))
        bounds = dxf_export.geometry_bounds_mm(model_doc)
        # Tank half length 1700 mm + 1000 mm inlet pipe = 2700 mm to the west.
        _assert(_close(bounds["plan"]["xmin"], -2700.0, 1e-6),
                f"model xmin should be -2700 mm, got {bounds['plan']['xmin']}")

        before = _dxf_model_bounds(report["dxf"]["path"])
        _assert(_close(before["xmin"], bounds["plan"]["xmin"], 1e-6),
                f"DXF must agree with the model origin: {before} vs {bounds['plan']}")

        # Offset every model entity by 500 mm, as a bad importer would.
        doc = ezdxf.readfile(report["dxf"]["path"])
        for entity in doc.modelspace():
            if entity.dxf.layer == dxf_export.LAYER_MODEL:
                entity.translate(500, 0, 0)
        doc.saveas(report["dxf"]["path"])

        after = _dxf_model_bounds(report["dxf"]["path"])
        _assert(_close(after["xmin"], before["xmin"] + 500, 1e-6),
                f"offset not applied as expected: {after}")
        _assert(not _close(after["xmin"], bounds["plan"]["xmin"], 1.0),
                "offset drawing must disagree with the canonical model")
        # The model itself is unchanged: the offset is a *drawing* defect.
        _assert(_close(dxf_export.geometry_bounds_mm(model_doc)["plan"]["xmin"],
                       bounds["plan"]["xmin"], 1e-9),
                "model bounds must be independent of the DXF")
    finally:
        ws.cleanup()


def test_copied_entity_is_reidentified() -> None:
    """Copying a CAD entity copies its XDATA; the copy must get its own identity."""
    ws = Workspace()
    try:
        report = ws.run()
        dxf_path = report["dxf"]["path"]

        doc = ezdxf.readfile(dxf_path)
        scan = dxf_export.scan_dxf_links(dxf_path)
        target = next(e for e in scan["entities"]
                      if e["internal_id"] == "septic-system.tank.wall.north"
                      and e["view"] == "plan")
        original = doc.entitydb[target["handle"]]
        copy = original.copy()
        copy.translate(5000, 5000, 0)
        doc.modelspace().add_entity(copy)
        doc.saveas(dxf_path)

        rescan = dxf_export.scan_dxf_links(dxf_path)
        _assert("plan:septic-system.tank.wall.north" in rescan["duplicates"],
                f"duplicate must be reported: {rescan['duplicates']}")

        conn = mapping.connect(ws.db_path)
        result = mapping.handle_copies(
            conn, MODEL_ID, report["mapping"]["sync"]["drawing_id"], rescan["entities"]
        )
        _assert(result["count"] == 1, f"exactly one copy expected, got {result}")
        new_id = result["reidentified"][0]["new_internal_id"]
        _assert(new_id.endswith("#copy2"), f"copy identity wrong: {new_id}")
        row = mapping.link_for(conn, MODEL_ID, new_id)
        _assert(row is not None and row["status"] == "ok", "copy must be registered as a link")
        conn.close()
    finally:
        ws.cleanup()


def test_manual_drafting_survives_regeneration() -> None:
    """Model geometry is regenerated; hand drafting must be left alone."""
    ws = Workspace()
    try:
        report = ws.run()
        dxf_path = report["dxf"]["path"]

        manual_handle = dxf_export.add_manual_entity(dxf_path, text="CLIENT NOTE - KEEP")
        doc = ezdxf.readfile(dxf_path)
        user_layer = "A-CLIENT-DRAFTING"
        doc.layers.add(user_layer, color=2)
        user_entity = doc.modelspace().add_text(
            "USER DRAFTED LINE TEXT", height=75, dxfattribs={"layer": user_layer}
        )
        doc.saveas(dxf_path)
        user_handle = user_entity.dxf.handle

        second = ws.run({"tank_int_l": 3.6})  # regenerate geometry
        doc2 = ezdxf.readfile(second["dxf"]["path"])
        handles = {e.dxf.handle for e in doc2.modelspace()}
        _assert(manual_handle in handles, "manual FUNDI_MANUAL entity was destroyed")
        _assert(user_handle in handles, "user layer entity was destroyed")
        _assert(second["dxf"]["preserved_entities"] >= 2,
                f"preserved count too low: {second['dxf']}")

        # And the model geometry did change.
        model_doc = json.load(open(second["model"]["json"], encoding="utf-8"))
        bounds = dxf_export.geometry_bounds_mm(model_doc)
        # extL = 3.6 + 2*0.2 = 4.0 m, half = 2.0 m, plus 1.0 m inlet pipe.
        _assert(_close(bounds["plan"]["xmin"], -3000.0, 1e-6),
                f"regenerated tank should span 4.0 m externally: {bounds['plan']}")
    finally:
        ws.cleanup()


def test_external_ifc_edit_is_flagged_as_conflict() -> None:
    ws = Workspace()
    try:
        ws.run()
        ifc_path = ws.path(f"{MODEL_ID}.ifc")
        # Simulate another application modifying the IFC after export.
        with open(ifc_path, "a", encoding="utf-8") as handle:
            handle.write("\n/* externally edited */\n")

        report = ws.run({"tank_int_l": 3.2})
        _assert(report["mapping"]["external_edits"]["ifc"] is True,
                "external IFC modification must be detected")
        _assert(report["mapping"]["sync"]["counts"]["conflict"] > 0,
                "changed geometry plus an externally edited IFC must be a conflict")
        conflicts = report["mapping"]["sync"]["conflicts"]
        _assert(conflicts and "modified outside Fundi" in conflicts[0]["reason"],
                f"conflict reason missing: {conflicts}")
        _assert(report["mapping"]["by_status"].get("conflict", 0) > 0,
                "conflict status must be persisted")
    finally:
        ws.cleanup()


def test_mapping_survives_db_loss_and_rebuilds_from_dxf() -> None:
    """The DXF itself carries the identity, so the mapping is recoverable."""
    ws = Workspace()
    try:
        report = ws.run()
        original = {
            l["internal_id"]: l["dxf_handle"]
            for l in _links(ws.db_path)
        }
        os.remove(ws.db_path)
        conn = mapping.connect(ws.db_path)
        model_doc = json.load(open(report["model"]["json"], encoding="utf-8"))
        scan = dxf_export.scan_dxf_links(report["dxf"]["path"])
        result = mapping.rebuild_from_dxf(conn, model_doc, "sheet-1", scan["entities"])
        _assert(result["rebuilt"] == len(original), f"rebuilt {result['rebuilt']} links")
        rebuilt = {l["internal_id"]: l["dxf_handle"] for l in mapping.links_for(conn, MODEL_ID)}
        _assert(rebuilt == original, "rebuilt handles must match the original mapping")
        conn.close()
    finally:
        ws.cleanup()


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def _links(db_path: str):
    conn = mapping.connect(db_path)
    try:
        return mapping.links_for(conn, MODEL_ID)
    finally:
        conn.close()


def _status(db_path: str, internal_id: str) -> str:
    conn = mapping.connect(db_path)
    try:
        row = mapping.link_for(conn, MODEL_ID, internal_id)
        return row["status"] if row else "missing"
    finally:
        conn.close()


def _statuses(db_path: str):
    return {l["internal_id"]: l["status"] for l in _links(db_path)}


def _guids_from_db(db_path: str):
    return {l["internal_id"]: l["ifc_guid"] for l in _links(db_path)}


def _dxf_model_bounds(path: str):
    """Bounding box (mm) of every entity on the exporter-owned model layer."""
    doc = ezdxf.readfile(path)
    xs, ys = [], []
    for entity in doc.modelspace():
        if entity.dxf.layer != dxf_export.LAYER_MODEL:
            continue
        if entity.dxftype() == "LWPOLYLINE":
            for x, y in entity.get_points("xy"):
                xs.append(x)
                ys.append(y)
        elif entity.dxftype() == "LINE":
            xs.extend([entity.dxf.start.x, entity.dxf.end.x])
            ys.extend([entity.dxf.start.y, entity.dxf.end.y])
    return {"xmin": min(xs), "xmax": max(xs), "ymin": min(ys), "ymax": max(ys)}


# ---------------------------------------------------------------------------
# Runner (works without pytest)
# ---------------------------------------------------------------------------


def main() -> int:
    if not (ifc_export.IFC_AVAILABLE):
        print("IfcOpenShell is unavailable; nothing can be verified.")
        print(ifc_export.IFC_IMPORT_ERROR)
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
    sys.exit(main())
