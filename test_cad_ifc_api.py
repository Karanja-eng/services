"""
HTTP-level acceptance tests for the CAD / BIM / IFC API.

Run with either:

    .venv-ifc\\Scripts\\python.exe test_cad_ifc_api.py
    python -m pytest test_cad_ifc_api.py -v

These tests exercise the FastAPI router the way the workbench does — through
request validation, status codes and response shapes — rather than calling the
pipeline functions directly. They therefore cover the things a component test
cannot: a 404 for an unknown generator, a 422 for a bad parameter or a path
traversal attempt, a 400 for an unsupported artefact extension, and the exact
fields the frontend reads.

Artefacts and the mapping database go to `.test-artifacts/` inside the repository
(git-ignored) via `FUNDI_ARTIFACT_DIR`, so a run never touches `public/`.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import traceback

_TMP_ROOT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), ".test-artifacts", f"api-{os.getpid()}"
)
if os.path.isdir(_TMP_ROOT):
    shutil.rmtree(_TMP_ROOT, ignore_errors=True)
os.makedirs(_TMP_ROOT, exist_ok=True)
os.environ["FUNDI_ARTIFACT_DIR"] = os.path.join(_TMP_ROOT, "public")

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "Backend"))

from cad_ifc import pipeline, router  # noqa: E402

# The router and the pipeline must agree on where the mapping lives; point both at
# the scratch database before anything is generated.
_DB = os.path.join(_TMP_ROOT, "mapping.sqlite")
pipeline.DEFAULT_DB_PATH = _DB

_state: dict = {}


def _assert(condition, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _client():
    """FastAPI TestClient, or a clear skip if the test dependency is absent."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient  # requires httpx

    app = FastAPI()
    app.include_router(router.router, prefix="/api/cad-ifc")
    return TestClient(app)


def _generated() -> dict:
    """Generate one pad footing once and cache the response."""
    if "report" not in _state:
        client = _client()
        response = client.post(
            "/api/cad-ifc/generate",
            json={"generator": "pad_footing", "params": {"lx_mm": 2800.0}},
        )
        _assert(response.status_code == 200, f"generate failed: {response.text[:400]}")
        _state["report"] = response.json()
        _state["client"] = client
    return _state["report"]


def test_health_reports_dependencies() -> None:
    health = _client().get("/api/cad-ifc/health").json()
    _assert(health["ifcopenshell"]["available"], f"IfcOpenShell missing: {health['ifcopenshell']}")
    _assert(health["ifcopenshell"]["schema"] == "IFC4", health["ifcopenshell"])
    _assert(health["engineering_generators"]["available"], health["engineering_generators"])
    _assert(health["engineering_generators"]["count"] == 8, health["engineering_generators"])
    _assert(health["ezdxf"]["version"], health["ezdxf"])


def test_units_endpoint_publishes_the_contract() -> None:
    payload = _client().get("/api/cad-ifc/units").json()
    _assert(payload["canonical"] == "metre", payload["canonical"])
    _assert(payload["canonical_schema"]["version"] == "1.0.0", payload["canonical_schema"])
    _assert(payload["dxf_insunits"] == 4, payload["dxf_insunits"])
    _assert("R3F_X" in payload["r3f_transform"], payload["r3f_transform"])


def test_generators_endpoint_exposes_derived_schemas() -> None:
    payload = _client().get("/api/cad-ifc/generators").json()
    keys = [entry["key"] for entry in payload["generators"]]
    _assert(len(keys) == 8, keys)
    beam = next(entry for entry in payload["generators"] if entry["key"] == "beam")
    _assert(len(beam["parameters"]) > 20, f"beam has {len(beam['parameters'])} parameters")
    names = {item["name"] for item in beam["parameters"]}
    for required in ("span_clear_mm", "width_mm", "depth_mm", "fck_MPa"):
        _assert(required in names, f"{required} missing from the beam schema")
    _assert(beam["canonical_preview"]["elements"], "canonical preview is empty")
    _assert(
        beam["canonical_preview"]["elements"][0]["ifc_class"] == "IfcBeam",
        beam["canonical_preview"],
    )


def test_unknown_generator_is_404() -> None:
    response = _client().post("/api/cad-ifc/generate", json={"generator": "not-a-generator"})
    _assert(response.status_code == 404, f"{response.status_code}: {response.text[:200]}")


def test_missing_generator_is_422() -> None:
    response = _client().post("/api/cad-ifc/generate", json={})
    _assert(response.status_code == 422, f"{response.status_code}: {response.text[:200]}")


def test_bad_parameter_is_422_and_names_the_parameter() -> None:
    response = _client().post(
        "/api/cad-ifc/generate",
        json={"generator": "beam", "params": {"not_a_parameter": 1}},
    )
    _assert(response.status_code == 422, f"{response.status_code}: {response.text[:200]}")
    _assert("not_a_parameter" in response.text, response.text[:300])


def test_fixed_parameter_override_is_422() -> None:
    response = _client().post(
        "/api/cad-ifc/generate",
        json={"generator": "stair_mst2", "params": {"landing_length_mm": 1500.0}},
    )
    _assert(response.status_code == 422, f"{response.status_code}: {response.text[:200]}")


def test_generate_returns_a_complete_report() -> None:
    report = _generated()
    _assert(report["drawing"]["url"].startswith("/cad/"), report["drawing"]["url"])
    _assert(report["drawing"]["drawing_id"].startswith("pad-footing-r"), report["drawing"])
    _assert(report["drawing"]["entity_count"] > 10, report["drawing"])
    _assert(report["drawing"]["mapped_entity_count"] > 10, report["drawing"])
    _assert(report["ifc"]["url"].startswith("/ifc/"), report["ifc"]["url"])
    _assert(report["ifc"]["schema"] == "IFC4", report["ifc"])
    _assert(report["ifc"]["classes"] == ["IfcFooting"], report["ifc"]["classes"])
    _assert(report["model"]["schema"] == "fundi.canonical", report["model"])
    _assert(report["validation"]["ifc_schema"]["ok"], report["validation"]["ifc_schema"])
    _assert(report["validation"]["dxf_units"]["ok"], report["validation"]["dxf_units"])
    _assert(report["validation"]["canonical"]["ok"], report["validation"]["canonical"])


def test_generate_applies_the_parameter_override() -> None:
    report = _generated()
    # lx 2800 mm x ly 2500 mm x depth 600 mm = 4.2 m3
    _assert(
        abs(report["model"]["total_volume_m3"] - 4.2) < 1e-6,
        report["model"]["total_volume_m3"],
    )
    _assert(report["ifc"]["guids"], "no GlobalIds in the report")
    guid = next(iter(report["ifc"]["guids"].values()))
    _assert(len(guid) == 22, f"GlobalId {guid!r} is not 22 characters")


def test_model_endpoint_returns_canonical_v1() -> None:
    response = _client().get("/api/cad-ifc/model/pad-footing")
    _assert(response.status_code == 200, response.text[:200])
    document = response.json()
    _assert(document["schema"] == "fundi.canonical", document["schema"])
    _assert(document["schema_version"] == "1.0.0", document["schema_version"])
    _assert(document["units"]["length"] == "metre", document["units"])
    _assert(document["elements"], "model has no elements")


def test_links_and_entities_endpoints_are_one_to_many() -> None:
    report = _generated()
    client = _state["client"]
    drawing_id = report["drawing"]["drawing_id"]

    links = client.get("/api/cad-ifc/links/pad-footing")
    _assert(links.status_code == 200, links.text[:200])
    payload = links.json()
    _assert(payload["links"], "no element links")
    _assert(payload["entity_links"]["elements"], "no entity links")

    entities = client.get(f"/api/cad-ifc/entities/pad-footing?drawing_id={drawing_id}")
    _assert(entities.status_code == 200, entities.text[:200])
    element_links = entities.json()["elements"]["pad-footing.footing"]
    _assert(len(element_links) > 10, f"only {len(element_links)} entities for one element")
    for link in element_links:
        _assert(link["handle"], "entity link without a handle")
        _assert(link["status"] in ("ok", "edited", "deleted"), link["status"])


def test_links_for_unknown_model_is_404() -> None:
    response = _client().get("/api/cad-ifc/links/does-not-exist")
    _assert(response.status_code == 404, f"{response.status_code}: {response.text[:200]}")


def test_reconcile_reports_no_drift_for_an_untouched_drawing() -> None:
    report = _generated()
    response = _state["client"].post(
        "/api/cad-ifc/reconcile/pad-footing",
        json={"drawing_id": report["drawing"]["drawing_id"]},
    )
    _assert(response.status_code == 200, response.text[:300])
    payload = response.json()
    _assert(payload["requires_reconciliation"] is False, payload["summary"])
    _assert(payload["drawing"]["uploaded"] is False, payload["drawing"])
    _assert(payload["summary"]["missing"] == 0, payload["summary"])
    _assert(payload["summary"]["edited"] == 0, payload["summary"])


def test_reconcile_accepts_an_uploaded_drawing() -> None:
    """The workbench uploads the edited DXF as base64; the API must accept it."""
    import base64

    report = _generated()
    path = os.path.join(
        os.environ["FUNDI_ARTIFACT_DIR"],
        report["drawing"]["url"].lstrip("/").replace("/", os.sep),
    )
    _assert(os.path.exists(path), f"drawing not found at {path}")
    with open(path, "rb") as handle:
        encoded = base64.b64encode(handle.read()).decode("ascii")
    response = _state["client"].post(
        "/api/cad-ifc/reconcile/pad-footing",
        json={"drawing_id": report["drawing"]["drawing_id"], "dxf_base64": encoded},
    )
    _assert(response.status_code == 200, response.text[:300])
    payload = response.json()
    _assert(payload["drawing"]["uploaded"] is True, payload["drawing"])
    _assert(payload["requires_reconciliation"] is False, payload["summary"])


def test_reconcile_unknown_drawing_is_404() -> None:
    response = _client().post(
        "/api/cad-ifc/reconcile/pad-footing", json={"drawing_id": "no-such-drawing"}
    )
    _assert(response.status_code == 404, f"{response.status_code}: {response.text[:200]}")


def test_reconcile_rejects_path_traversal() -> None:
    for bad in ("../../etc/passwd", "a/b", "..", ""):
        response = _client().post(
            "/api/cad-ifc/reconcile/pad-footing", json={"drawing_id": bad}
        )
        _assert(
            response.status_code in (422, 404),
            f"{bad!r} -> {response.status_code}",
        )


def test_reconcile_rejects_invalid_base64() -> None:
    report = _generated()
    response = _state["client"].post(
        "/api/cad-ifc/reconcile/pad-footing",
        json={"drawing_id": report["drawing"]["drawing_id"], "dxf_base64": "not base64!!"},
    )
    _assert(response.status_code == 422, f"{response.status_code}: {response.text[:200]}")


def test_file_download_and_extension_guard() -> None:
    report = _generated()
    client = _state["client"]
    model_id = report["model"]["model_id"]
    ifc = client.get(f"/api/cad-ifc/file/{model_id}.ifc")
    _assert(ifc.status_code == 200, ifc.status_code)
    _assert(len(ifc.content) > 1000, f"IFC download is only {len(ifc.content)} bytes")
    _assert(b"ISO-10303-21" in ifc.content[:200], "downloaded file is not a STEP file")

    dxf = client.get(f"/api/cad-ifc/file/{model_id}.dxf")
    _assert(dxf.status_code == 200, dxf.status_code)

    bad = client.get(f"/api/cad-ifc/file/{model_id}.exe")
    _assert(bad.status_code == 400, f"{bad.status_code}: {bad.text[:150]}")

    traversal = client.get("/api/cad-ifc/file/..%2f..%2fetc%2fpasswd.ifc")
    _assert(traversal.status_code in (422, 404, 400), traversal.status_code)


def test_models_endpoint_lists_disk_contents() -> None:
    report = _generated()
    payload = _client().get("/api/cad-ifc/models").json()
    ids = [entry["drawing_id"] for entry in payload["drawings"]]
    _assert(
        any(name.startswith(report["drawing"]["drawing_id"]) for name in ids),
        f"{report['drawing']['drawing_id']} not listed in {ids}",
    )
    _assert("store" in payload and payload["store"]["cad_dir"], payload.get("store"))


def test_standalone_launcher_mounts_the_same_router() -> None:
    """The lean launcher must expose exactly the same API as the full backend.

    `src/Backend/main.py` cannot be imported in a lean environment (top-level
    `from Databases import …` plus ~30 routers that pull in ML dependencies), so
    `cad_ifc.standalone` is the supported way to serve this feature set. If the two
    ever diverged, the frontend would break depending on which one was running.
    """
    from fastapi.testclient import TestClient

    from cad_ifc import standalone

    client = TestClient(standalone.app)
    health = client.get("/api/cad-ifc/health")
    _assert(health.status_code == 200, health.text[:200])
    _assert(health.json()["ifcopenshell"]["available"], health.json()["ifcopenshell"])

    generators = client.get("/api/cad-ifc/generators")
    _assert(generators.status_code == 200, generators.text[:200])
    _assert(len(generators.json()["generators"]) == 8, "generator count differs")

    # The documented prefix must match the full backend's mount point.
    _assert(standalone.API_PREFIX == "/api/cad-ifc", standalone.API_PREFIX)
    paths = {route.path for route in standalone.app.routes}
    for required in (
        "/api/cad-ifc/health",
        "/api/cad-ifc/units",
        "/api/cad-ifc/generators",
        "/api/cad-ifc/generate",
        "/api/cad-ifc/models",
        "/api/cad-ifc/entities/{model_id}",
        "/api/cad-ifc/reconcile/{model_id}",
    ):
        _assert(required in paths, f"{required} is not mounted by the launcher")


def test_analysis_engine_reports_availability() -> None:
    payload = _client().get("/api/cad-ifc/analysis/engine").json()
    _assert(payload["available"] is True, f"OpenSees engine unavailable: {payload.get('reason')}")
    _assert(os.path.exists(payload["interpreter"]),
            f"reported interpreter does not exist: {payload['interpreter']}")


def test_analysis_runs_through_the_api() -> None:
    """The analysis endpoint must run the real engine and return verified numbers."""
    response = _client().post(
        "/api/cad-ifc/analysis",
        json={
            "generator": "beam",
            "youngs_modulus_pa": 210e9,
            "supports": [
                {"node": "beam.beam#start", "ux": True, "uy": True, "rz": False},
                {"node": "beam.beam#end", "ux": False, "uy": True, "rz": False},
            ],
            "element_loads": [{"element": "beam.beam", "wy": -20000.0}],
            "subdivisions": 4,
            "case_id": "api-udl",
        },
    )
    _assert(response.status_code == 200, f"{response.status_code}: {response.text[:400]}")
    payload = response.json()
    _assert(payload["ok"] is True, payload)
    _assert(payload["model_id"] == "beam", payload["model_id"])

    results = payload["results"]
    _assert(results["schema"] == "fundi.analysis.results/1", results["schema"])
    _assert(results["units"]["force"] == "N", results["units"])
    case = results["cases"][0]
    _assert(case["case_id"] == "api-udl", case["case_id"])
    _assert(len(case["members"]) == 4, f"expected 4 members, got {len(case['members'])}")

    # Simply supported equivalent: reactions are wL/2 each, from the canonical span (6.7 m).
    expected = 20000.0 * 6.7 / 2.0
    for key in ("node1", "node5"):
        reaction = case["reactions"][key]
        _assert(abs(reaction["Fy"] - expected) <= 1e-6 * expected,
                f"{key} reaction {reaction['Fy']} vs {expected}")
    _assert(case["equilibrium"]["residualRelative"] < 1e-9,
            f"equilibrium residual {case['equilibrium']['residualRelative']}")
    _assert(payload["analytical_model"]["members"] == 4, payload["analytical_model"])
    _assert(payload["analytical_model"]["assumptions"], "assumptions must be reported")


def test_analysis_rejects_incomplete_requests() -> None:
    client = _client()
    base = {
        "generator": "beam",
        "supports": [{"node": "beam.beam#start", "ux": True, "uy": True}],
        "element_loads": [{"element": "beam.beam", "wy": -20000.0}],
    }

    no_e = client.post("/api/cad-ifc/analysis", json=base)
    _assert(no_e.status_code == 422, f"{no_e.status_code}: {no_e.text[:200]}")
    _assert("youngs_modulus_pa" in no_e.text, no_e.text[:300])

    no_supports = client.post(
        "/api/cad-ifc/analysis", json={**base, "youngs_modulus_pa": 210e9, "supports": []}
    )
    _assert(no_supports.status_code == 422, f"{no_supports.status_code}: {no_supports.text[:200]}")
    _assert("supports" in no_supports.text, no_supports.text[:300])

    no_loads = client.post(
        "/api/cad-ifc/analysis",
        json={**base, "youngs_modulus_pa": 210e9, "element_loads": []},
    )
    _assert(no_loads.status_code == 422, f"{no_loads.status_code}: {no_loads.text[:200]}")

    unknown = client.post(
        "/api/cad-ifc/analysis", json={**base, "youngs_modulus_pa": 210e9, "generator": "nope"}
    )
    _assert(unknown.status_code == 404, f"{unknown.status_code}: {unknown.text[:200]}")


def test_analysis_returns_a_design_payload_only_when_requested() -> None:
    client = _client()
    request = {
        "generator": "beam",
        "youngs_modulus_pa": 210e9,
        "supports": [
            {"node": "beam.beam#start", "ux": True, "uy": True},
            {"node": "beam.beam#end", "uy": True},
        ],
        "element_loads": [{"element": "beam.beam", "wy": -20000.0}],
        "subdivisions": 2,
    }
    without = client.post("/api/cad-ifc/analysis", json=request)
    _assert(without.status_code == 200, without.text[:300])
    _assert("design_payload" not in without.json(), "design payload returned unrequested")

    with_payload = client.post(
        "/api/cad-ifc/analysis",
        json={**request, "member_id": "beam.beam#e0",
              "section": {"A": 0.18, "Iz": 0.0054, "E": 210e9}},
    )
    _assert(with_payload.status_code == 200, with_payload.text[:300])
    design = with_payload.json()["design_payload"]
    _assert(design["incomplete"] is False, design.get("incomplete_reason"))
    _assert(design["design_checks_performed"] == [],
            "the bridge must not claim a design check")
    _assert(design["member"]["length_m"] > 0, design["member"])


def main() -> int:
    tests = [
        (name, obj)
        for name, obj in sorted(globals().items())
        if name.startswith("test_") and callable(obj)
    ]
    try:
        _client()
    except Exception as exc:  # noqa: BLE001
        print(f"SKIP: FastAPI TestClient unavailable ({type(exc).__name__}: {exc})")
        print("Install httpx (`pip install httpx`) to run the HTTP acceptance tests.")
        return 2

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
