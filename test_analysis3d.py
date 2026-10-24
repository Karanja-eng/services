"""
3D frame analysis acceptance tests.

Run with the backend interpreter (3.13); the OpenSees engine is started as a Python
3.12 subprocess by the shared `analysis.run_job` helper:

    .venv-ifc\\Scripts\\python.exe test_analysis3d.py

Coverage
--------
Validation (no engine needed):

* a missing section constant (`J`) is refused and the message names it;
* an unrestrained torsional rigid-body mode is refused by the rank test;
* distributed element loads are refused in 3D instead of being approximated;
* unknown node references and duplicate node ids are refused.

Engine benchmarks (closed-form references, so the numbers are verified rather than
the exit status):

* cantilever, tip point load     δ = P L³ / (3 E I)
* simply supported beam, central point load   δ = P L³ / (48 E I)
* cantilever, tip torque          θ = T L / (G J)

Plus: local axes are orthonormal and right-handed, all twelve member end forces are
present, and global equilibrium holds in six components.
"""

from __future__ import annotations

import math
import os
import sys
import traceback

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from src.Backend.cad_ifc import analysis, analysis3d  # noqa: E402

E = 210.0e9
G = 80.0e9
A = 0.04
I = 0.2 ** 4 / 12
J = 2.25e-4
VECXZ = [0.0, 0.0, 1.0]


def node(node_id, x, y, z):
    return {"id": node_id, "x": x, "y": y, "z": z}


def member(member_id, i, j, **overrides):
    data = {
        "id": member_id, "i": i, "j": j,
        "E": E, "A": A, "Iy": I, "Iz": I, "J": J, "G": G, "vecxz": VECXZ,
    }
    data.update(overrides)
    return data


def fixed_support(node_id):
    return {
        "node": node_id,
        "ux": True, "uy": True, "uz": True,
        "rx": True, "ry": True, "rz": True,
    }


def cantilever_payload(load):
    return {
        "model_id": "cantilever-3d",
        "nodes": [node("n1", 0, 0, 0), node("n2", 3, 0, 0)],
        "members": [member("m1", "n1", "n2")],
        "supports": [fixed_support("n1")],
        "loads": [{**load, "node": "n2"}],
        "case_id": "TIP-1",
    }


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------


def test_missing_section_constant_is_refused():
    payload = cantilever_payload({"fz": -1000})
    del payload["members"][0]["J"]
    try:
        analysis3d.from_payload(payload)
    except analysis3d.AnalysisError as error:
        message = str(error)
        assert "J" in message, message
        assert "explicit" in message, message
        return "refused, message names J"
    raise AssertionError("a member without J was accepted")


def test_unrestrained_torsion_is_refused():
    payload = cantilever_payload({"fz": -1000})
    payload["supports"] = [{"node": "n1", "ux": True, "uy": True, "uz": True}]
    try:
        analysis3d.from_payload(payload)
        analysis3d.analyse(analysis3d.from_payload(payload), work_dir=os.path.join(ROOT, ".test-artifacts", "analysis3d"))
    except analysis3d.AnalysisError as error:
        message = str(error)
        assert "rigid-body modes" in message, message
        assert "3 of the 6" in message, message
        return "refused, rank reported as 3 of 6"
    raise AssertionError("a model with free torsional rotation was analysed")


def test_element_loads_are_refused_in_3d():
    payload = cantilever_payload({"fz": -1000})
    payload["element_loads"] = [{"element": "m1", "wy": -5000}]
    try:
        analysis3d.from_payload(payload)
        analysis3d.analyse(analysis3d.from_payload(payload))
    except analysis3d.AnalysisError as error:
        assert "distributed element loads are not supported" in str(error)
        return "refused with a reason"
    raise AssertionError("element loads were silently accepted in the 3D path")


def test_unknown_node_reference_is_refused():
    payload = cantilever_payload({"fz": -1000})
    payload["members"][0]["j"] = "does-not-exist"
    try:
        analysis3d.from_payload(payload)
    except analysis3d.AnalysisError as error:
        assert "unknown node" in str(error)
        return "refused"
    raise AssertionError("a member referencing a missing node was accepted")


def test_duplicate_node_ids_are_refused():
    payload = cantilever_payload({"fz": -1000})
    payload["nodes"] = [node("n1", 0, 0, 0), node("n1", 3, 0, 0)]
    try:
        analysis3d.from_payload(payload)
    except analysis3d.AnalysisError as error:
        assert "duplicate node id" in str(error)
        return "refused"
    raise AssertionError("duplicate node ids were accepted")


def test_no_supports_is_refused():
    payload = cantilever_payload({"fz": -1000})
    payload["supports"] = []
    try:
        analysis3d.from_payload(payload)
    except analysis3d.AnalysisError as error:
        assert "supports" in str(error)
        return "refused"
    raise AssertionError("an unsupported model was accepted")


# ---------------------------------------------------------------------------
# Engine benchmarks
# ---------------------------------------------------------------------------


def test_cantilever_tip_deflection_and_reactions():
    payload = cantilever_payload({"fz": -1000.0})
    results = analysis3d.analyse(analysis3d.from_payload(payload))
    assert results["dimensionality"] == 3
    assert results["degreesOfFreedom"] == 6
    case = results["cases"][0]
    expected = (-1000.0 * 3.0 ** 3) / (3 * E * I)
    uz = case["displacements"]["n2"]["uz"]
    assert abs(uz - expected) / abs(expected) < 1e-6, (uz, expected)

    reaction = case["reactions"]["node1"]
    assert abs(reaction["Fz"] - 1000.0) < 1e-6, reaction
    # Applied moment about Y is +3000 N*m (r x F with F = -Z at x = 3); the support
    # reaction opposes it.
    assert abs(reaction["My"] + 3000.0) < 1e-3, reaction
    assert case["equilibrium"]["residualRelative"] < 1e-9, case["equilibrium"]

    member_result = case["members"]["m1"]
    for key in ("N_i", "Vy_i", "Vz_i", "T_i", "My_i", "Mz_i",
                "N_j", "Vy_j", "Vz_j", "T_j", "My_j", "Mz_j"):
        assert key in member_result, key
    return f"uz={uz:.6e} m (closed form {expected:.6e}), residual {case['equilibrium']['residualRelative']:.1e}"


def test_simply_supported_beam_central_load():
    length = 6.0
    payload = {
        "model_id": "simply-supported-3d",
        "nodes": [node("n1", 0, 0, 0), node("n2", length / 2, 0, 0), node("n3", length, 0, 0)],
        "members": [member("m1", "n1", "n2"), member("m2", "n2", "n3")],
        "supports": [
            {"node": "n1", "ux": True, "uy": True, "uz": True, "rx": True, "rz": True},
            {"node": "n3", "uy": True, "uz": True},
        ],
        "loads": [{"node": "n2", "fz": -1000.0}],
        "case_id": "CENTRE-1",
    }
    results = analysis3d.analyse(analysis3d.from_payload(payload))
    case = results["cases"][0]
    expected = (-1000.0 * length ** 3) / (48 * E * I)
    uz = case["displacements"]["n2"]["uz"]
    assert abs(uz - expected) / abs(expected) < 1e-6, (uz, expected)

    # Symmetric reactions of P/2 each.
    assert abs(case["reactions"]["node1"]["Fz"] - 500.0) < 1e-6, case["reactions"]
    assert abs(case["reactions"]["node3"]["Fz"] - 500.0) < 1e-6, case["reactions"]
    # Bending moment at midspan of a simply supported beam under a central load is
    # P L / 4 = 1500 N*m. Because the member runs along global X and the load is in
    # global Z, the bending is about the member's LOCAL Y axis, so `My` carries it
    # and `Mz` must stay ~0. Checking both directions is what proves the mapping.
    my = [abs(case["members"][key]["My_j"]) for key in case["members"]]
    mz = [
        max(abs(case["members"][key]["Mz_i"]), abs(case["members"][key]["Mz_j"]))
        for key in case["members"]
    ]
    assert max(my) > 1400.0, my
    assert max(mz) < 1e-6, mz
    assert case["equilibrium"]["residualRelative"] < 1e-9
    return f"uz={uz:.6e} m (closed form {expected:.6e}), reactions 500 N each, My={max(my):.0f} N*m"


def test_cantilever_tip_torque_uses_j_and_g():
    torque = 1000.0
    payload = cantilever_payload({"mx": torque})
    results = analysis3d.analyse(analysis3d.from_payload(payload))
    case = results["cases"][0]
    expected = (torque * 3.0) / (G * J)
    rx = case["displacements"]["n2"]["rx"]
    assert abs(rx - expected) / abs(expected) < 1e-6, (rx, expected)
    reaction = case["reactions"]["node1"]
    assert abs(reaction["Mx"] + torque) < 1e-6, reaction
    return f"rx={rx:.6e} rad (closed form {expected:.6e})"


def test_local_axes_are_orthonormal_and_right_handed():
    payload = {
        "model_id": "inclined-3d",
        "nodes": [node("n1", 0, 0, 0), node("n2", 2, 2, 3)],
        "members": [member("m1", "n1", "n2", vecxz=[0.0, 0.0, 1.0])],
        "supports": [fixed_support("n1")],
        "loads": [{"node": "n2", "fz": -1000.0}],
        "case_id": "INCLINED-1",
    }
    results = analysis3d.analyse(analysis3d.from_payload(payload))
    axes = results["cases"][0]["members"]["m1"]["localAxes"]
    ex = [axes["x"]["x"], axes["x"]["y"], axes["x"]["z"]]
    ey = [axes["y"]["x"], axes["y"]["y"], axes["y"]["z"]]
    ez = [axes["z"]["x"], axes["z"]["y"], axes["z"]["z"]]

    def dot(a, b):
        return sum(x * y for x, y in zip(a, b))

    def cross(a, b):
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

    for vector in (ex, ey, ez):
        assert abs(math.sqrt(dot(vector, vector)) - 1.0) < 1e-9, vector
    assert abs(dot(ex, ey)) < 1e-9 and abs(dot(ex, ez)) < 1e-9 and abs(dot(ey, ez)) < 1e-9
    handed = cross(ex, ey)
    assert max(abs(a - b) for a, b in zip(handed, ez)) < 1e-9, (handed, ez)
    # Local x must follow i -> j.
    length = math.sqrt(4 + 4 + 9)
    assert abs(ex[0] - 2 / length) < 1e-9 and abs(ex[2] - 3 / length) < 1e-9
    return "orthonormal, right-handed, x along i->j"


# ---------------------------------------------------------------------------
# Canonical model -> 3D analytical frame
# ---------------------------------------------------------------------------


def canonical_doc(axis="x", length=3.0, width=0.2, depth=0.2):
    """A one-element canonical document (the shape `GET /model/{id}` returns)."""
    placement = {"x": 0.0, "y": 0.0, "z": 0.0}
    if axis == "x":
        dimensions = {"length_x": length, "width_y": width, "height_z": depth}
        placement["x"] = length / 2
    elif axis == "y":
        dimensions = {"width_x": width, "length_y": length, "height_z": depth}
        placement["y"] = length / 2
    else:
        dimensions = {"width_x": width, "depth_y": depth, "height_z": length}
        placement["z"] = length / 2
    return {
        "schema": "fundi.canonical/1",
        "model_id": "canonical-cantilever",
        "elements": [
            {
                "id": "beam.b1",
                "element_type": "beam",
                "axis": axis,
                "dimensions": dimensions,
                "placement": placement,
                "material": "C30/37",
                "material_properties": {"fck_MPa": 30.0},
            }
        ],
    }


def explicit_section(**overrides):
    section = {"A": A, "Iy": I, "Iz": I, "J": J, "G": G, "E": E, "vecxz": [0.0, 0.0, 1.0]}
    section.update(overrides)
    return section


def test_canonical_adapter_requires_explicit_sections():
    try:
        analysis3d.canonical_to_analysis_3d(
            canonical_doc(),
            member_sections={},
            supports=[fixed_support("beam.b1#start")],
            loads=[{"node": "beam.b1#end", "fz": -1000.0}],
        )
    except analysis3d.AnalysisError as error:
        assert "member_sections is required" in str(error)
        return "refused, sections must be explicit"
    raise AssertionError("a canonical 3D model without sections was accepted")


def test_canonical_adapter_requires_explicit_youngs_modulus():
    try:
        analysis3d.canonical_to_analysis_3d(
            canonical_doc(),
            member_sections={"beam.b1": explicit_section(E=None)},
            supports=[fixed_support("beam.b1#start")],
            loads=[{"node": "beam.b1#end", "fz": -1000.0}],
        )
    except analysis3d.AnalysisError as error:
        assert "Young's modulus" in str(error)
        return "refused, E not inferred from the grade"
    raise AssertionError("E was inferred from the concrete grade")


def test_canonical_adapter_maps_geometry_and_analyses():
    model = analysis3d.canonical_to_analysis_3d(
        canonical_doc(),
        member_sections={"beam.b1": explicit_section()},
        supports=[fixed_support("beam.b1#start")],
        loads=[{"node": "beam.b1#end", "fz": -1000.0}],
        case_id="CANON-3D",
    )
    results = analysis3d.analyse(model)
    case = results["cases"][0]
    assert results["dimensionality"] == 3
    expected = (-1000.0 * 3.0 ** 3) / (3 * E * I)
    uz = case["displacements"]["beam.b1#end"]["uz"]
    assert abs(uz - expected) / abs(expected) < 1e-6, (uz, expected)
    assert abs(case["reactions"]["node1"]["Fz"] - 1000.0) < 1e-6
    # The canonical element id is preserved in the result.
    assert "beam.b1" in case["members"]
    return f"canonical beam mapped, uz={uz:.6e} m (closed form {expected:.6e})"


def test_canonical_adapter_handles_a_vertical_column():
    model = analysis3d.canonical_to_analysis_3d(
        canonical_doc(axis="z", length=3.0),
        member_sections={"beam.b1": explicit_section(vecxz=[1.0, 0.0, 0.0])},
        supports=[fixed_support("beam.b1#start")],
        loads=[{"node": "beam.b1#end", "fx": 1000.0}],
        case_id="COLUMN-3D",
    )
    results = analysis3d.analyse(model)
    case = results["cases"][0]
    # A vertical cantilever with a lateral tip load deflects by P L^3 / (3 E I).
    expected = (1000.0 * 3.0 ** 3) / (3 * E * I)
    ux = case["displacements"]["beam.b1#end"]["ux"]
    assert abs(ux - expected) / abs(expected) < 1e-6, (ux, expected)
    assert case["equilibrium"]["residualRelative"] < 1e-9
    return f"column mapped, ux={ux:.6e} m (closed form {expected:.6e})"


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def main() -> int:
    engine_available = True
    try:
        analysis.opensees_python()
    except analysis.AnalysisError as error:
        engine_available = False
        print(f"[skip] engine benchmarks: {error}")

    tests = [
        test_missing_section_constant_is_refused,
        test_unrestrained_torsion_is_refused,
        test_element_loads_are_refused_in_3d,
        test_unknown_node_reference_is_refused,
        test_duplicate_node_ids_are_refused,
        test_no_supports_is_refused,
        test_canonical_adapter_requires_explicit_sections,
        test_canonical_adapter_requires_explicit_youngs_modulus,
    ]
    if engine_available:
        tests += [
            test_cantilever_tip_deflection_and_reactions,
            test_simply_supported_beam_central_load,
            test_cantilever_tip_torque_uses_j_and_g,
            test_local_axes_are_orthonormal_and_right_handed,
            test_canonical_adapter_maps_geometry_and_analyses,
            test_canonical_adapter_handles_a_vertical_column,
        ]

    failures = []
    passed = 0
    for test in tests:
        try:
            detail = test()
            passed += 1
            print(f"PASS {test.__name__}: {detail}")
        except Exception as exc:  # noqa: BLE001 - every failure must be reported
            failures.append((test.__name__, exc, traceback.format_exc()))
            print(f"FAIL {test.__name__}: {exc}")

    print(f"\n{passed}/{len(tests)} passed")
    if failures:
        print("\n--- failure details ---")
        for name, exc, tb in failures:
            print(f"\n### {name}\n{tb}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
