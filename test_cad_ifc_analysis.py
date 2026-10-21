"""
OpenSees analysis acceptance tests (Task 5).

Run with the backend interpreter (3.13); the OpenSees engine itself is started as a
Python 3.12 subprocess by the adapter, because OpenSeesPy 3.8.0.0 links python312.dll.

    .venv-ifc\\Scripts\\python.exe test_cad_ifc_analysis.py

Coverage
--------
The three benchmarks are small, deterministic 2D cases with **closed-form** reference
solutions, so the engine is verified numerically rather than by its exit status:

* simply supported beam, full-span UDL   (statically determinate)
* cantilever, tip point load             (statically determinate)
* fully fixed beam, full-span UDL        (statically indeterminate, degree 3)

Plus: connectivity, boundary conditions, global equilibrium, sign conventions, unit
handling, result-to-canonical-id mapping under a permuted element order, repeatability,
and rejection of incomplete input.
"""

from __future__ import annotations

import math
import os
import shutil
import sys
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "Backend"))

from cad_ifc import analysis  # noqa: E402

WORK = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".test-artifacts", "analysis"))

# Benchmark properties: SI, and deliberately round numbers so the closed-form values are
# easy to audit by hand.
E = 210.0e9        # Pa (steel)
A = 0.010          # m^2
IZ = 1.0e-4        # m^4
L = 6.0            # m
W = 20.0e3         # N/m downward
P = 50.0e3         # N downward

#: Closed-form references (see analysis.simply_supported_udl etc.).
REF_SS = analysis.simply_supported_udl(L, W, E, IZ)
REF_FF = analysis.fixed_fixed_udl(L, W, E, IZ)
REF_CANT = analysis.cantilever_tip_point(L, P, E, IZ)


def _beam_input(with_mid_node: bool, fixed_ends: bool) -> analysis.AnalysisInput:
    """Two-element beam spanning L, optionally with a midspan node."""
    nodes = [analysis.AnalysisNode(1, 0.0, 0.0, "beam.node.start")]
    if with_mid_node:
        nodes.append(analysis.AnalysisNode(2, L / 2, 0.0, "beam.node.mid"))
        nodes.append(analysis.AnalysisNode(3, L, 0.0, "beam.node.end"))
        members = [
            analysis.AnalysisMember(1, 1, 2, E, A, IZ, "beam.member.left"),
            analysis.AnalysisMember(2, 2, 3, E, A, IZ, "beam.member.right"),
        ]
        element_loads = (
            analysis.AnalysisElementLoad(1, wy=-W),
            analysis.AnalysisElementLoad(2, wy=-W),
        )
    else:
        nodes.append(analysis.AnalysisNode(2, L, 0.0, "beam.node.end"))
        members = [analysis.AnalysisMember(1, 1, 2, E, A, IZ, "beam.member.full")]
        element_loads = (analysis.AnalysisElementLoad(1, wy=-W),)

    if fixed_ends:
        supports = [
            analysis.AnalysisSupport(1, ux=True, uy=True, rz=True),
            analysis.AnalysisSupport(nodes[-1].tag, ux=True, uy=True, rz=True),
        ]
    else:
        supports = [
            analysis.AnalysisSupport(1, ux=True, uy=True, rz=False),
            analysis.AnalysisSupport(nodes[-1].tag, ux=False, uy=True, rz=False),
        ]

    return analysis.AnalysisInput(
        model_id="beam-benchmark",
        nodes=nodes,
        members=members,
        supports=supports,
        cases=[
            analysis.LoadCase(
                case_id="udl",
                element_loads=element_loads,
                description="full-span UDL, downward",
            )
        ],
        source="test_cad_ifc_analysis.py",
        assumptions=["linear elastic, first-order analysis", "no self-weight"],
    )


def _assert(condition, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _close(actual: float, expected: float, rel: float = 1e-6, absolute: float = 0.0) -> bool:
    if absolute:
        return abs(actual - expected) <= absolute
    scale = max(abs(expected), 1e-9)
    return abs(actual - expected) <= rel * scale


def test_opensees_interpreter_is_available() -> None:
    """The engine must be locatable, and the reason reported when it is not."""
    interpreter = analysis.opensees_python()
    _assert(os.path.exists(interpreter), f"interpreter does not exist: {interpreter}")


def test_engine_reports_its_version_and_dimensions() -> None:
    results = analysis.analyse(_beam_input(with_mid_node=False, fixed_ends=False), work_dir=WORK)
    case = results["cases"][0]
    _assert(case["analysis"]["status"] == 0, f"analysis status {case['analysis']['status']}")
    _assert(results["units"]["length"] == "m", results["units"])
    _assert(results["units"]["force"] == "N", results["units"])
    _assert(results["limitations"], "result must state its limitations")


def test_simply_supported_udl_matches_closed_form() -> None:
    results = analysis.analyse(_beam_input(with_mid_node=True, fixed_ends=False), work_dir=WORK)
    case = results["cases"][0]

    # 1. connectivity and boundary conditions as supplied
    _assert(case["members"]["beam.member.left"]["i"] == 1, "member connectivity changed")
    _assert(_close(case["members"]["beam.member.left"]["length"], L / 2), "member length wrong")
    _assert(len(case["supports"]) == 2, f"expected 2 supports, got {len(case['supports'])}")
    _assert(case["supports"][1]["uy"] and not case["supports"][1]["ux"],
            "the second support should be a roller (uy only)")

    # 2. global equilibrium: applied load vs support reactions
    equilibrium = case["equilibrium"]
    _assert(_close(equilibrium["appliedFy"], -W * L), f"applied Fy {equilibrium['appliedFy']}")
    _assert(_close(equilibrium["reactionFy"], W * L), f"reaction Fy {equilibrium['reactionFy']}")
    _assert(equilibrium["residualRelative"] < 1e-9,
            f"equilibrium residual {equilibrium['residualRelative']}")

    # 3. reactions against the closed form (wL/2 each)
    for key in ("node1", "node3"):
        reaction = case["reactions"][key]
        _assert(_close(reaction["Fy"], REF_SS["reaction_each"]),
                f"{key} reaction {reaction['Fy']} vs {REF_SS['reaction_each']}")

    # 4. midspan displacement against 5wL^4/(384EI), downward
    uy_mid = case["displacements"]["beam.node.mid"]["uy"]
    _assert(uy_mid < 0, f"midspan deflection should be downward, got {uy_mid}")
    _assert(_close(uy_mid, -REF_SS["deflection_max"]),
            f"midspan deflection {uy_mid} vs closed form {-REF_SS['deflection_max']}")

    # 5. end moment against wL^2/8, computed from the reactions and equilibrium
    moment_mid = case["reactions"]["node1"]["Fy"] * (L / 2) - W * (L / 2) ** 2 / 2
    _assert(_close(moment_mid, REF_SS["moment_max"]),
            f"midspan moment {moment_mid} vs closed form {REF_SS['moment_max']}")

    # 6. member end moments: zero at the two simple supports, wL^2/8 at midspan
    left = case["members"]["beam.member.left"]
    right = case["members"]["beam.member.right"]
    _assert(abs(left["M_i"]) < 1e-6,
            f"left member M_i should be ~0 at the simple support, got {left['M_i']}")
    _assert(abs(right["M_j"]) < 1e-6,
            f"right member M_j should be ~0 at the simple support, got {right['M_j']}")
    _assert(_close(abs(left["M_j"]), REF_SS["moment_max"]),
            f"left member midspan moment {left['M_j']} vs {REF_SS['moment_max']}")
    _assert(_close(abs(right["M_i"]), REF_SS["moment_max"]),
            f"right member midspan moment {right['M_i']} vs {REF_SS['moment_max']}")


def test_cantilever_tip_load_matches_closed_form() -> None:
    model = analysis.AnalysisInput(
        model_id="cantilever-benchmark",
        nodes=[
            analysis.AnalysisNode(1, 0.0, 0.0, "cant.node.fixed"),
            analysis.AnalysisNode(2, L, 0.0, "cant.node.tip"),
        ],
        members=[analysis.AnalysisMember(1, 1, 2, E, A, IZ, "cant.member")],
        supports=[analysis.AnalysisSupport(1, ux=True, uy=True, rz=True)],
        cases=[analysis.LoadCase(case_id="tip", loads=(analysis.AnalysisLoad(2, fy=-P),),
                                 description="tip point load, downward")],
        source="test_cad_ifc_analysis.py",
    )
    case = analysis.analyse(model, work_dir=WORK)["cases"][0]

    tip = case["displacements"]["cant.node.tip"]
    _assert(_close(tip["uy"], -REF_CANT["deflection_tip"]),
            f"tip deflection {tip['uy']} vs {-REF_CANT['deflection_tip']}")
    _assert(_close(tip["rz"], -REF_CANT["rotation_tip"]),
            f"tip rotation {tip['rz']} vs {-REF_CANT['rotation_tip']}")

    fixed = case["reactions"]["node1"]
    _assert(_close(fixed["Fy"], REF_CANT["reaction_vertical"]), f"reaction {fixed['Fy']}")
    _assert(_close(abs(fixed["Mz"]), REF_CANT["reaction_moment"]), f"fixed moment {fixed['Mz']}")

    member = case["members"]["cant.member"]
    _assert(_close(abs(member["M_i"]), REF_CANT["moment_fixed"]),
            f"member fixed-end moment {member['M_i']} vs {REF_CANT['moment_fixed']}")
    _assert(_close(abs(member["V_i"]), P), f"member shear {member['V_i']} vs {P}")


def test_fixed_fixed_udl_matches_closed_form() -> None:
    case = analysis.analyse(_beam_input(with_mid_node=True, fixed_ends=True), work_dir=WORK)["cases"][0]

    # indeterminate: end moments are wL^2/12 and the midspan deflection is wL^4/384EI
    for key in ("node1", "node3"):
        reaction = case["reactions"][key]
        _assert(_close(reaction["Fy"], REF_FF["reaction_each"]),
                f"{key} reaction {reaction['Fy']} vs {REF_FF['reaction_each']}")
        _assert(_close(abs(reaction["Mz"]), REF_FF["moment_end"]),
                f"{key} fixing moment {reaction['Mz']} vs {REF_FF['moment_end']}")

    uy_mid = case["displacements"]["beam.node.mid"]["uy"]
    _assert(_close(uy_mid, -REF_FF["deflection_max"]),
            f"midspan deflection {uy_mid} vs {-REF_FF['deflection_max']}")

    # both member ends at a fixed support carry wL^2/12
    left = case["members"]["beam.member.left"]
    right = case["members"]["beam.member.right"]
    _assert(_close(abs(left["M_i"]), REF_FF["moment_end"]), f"left M_i {left['M_i']}")
    _assert(_close(abs(right["M_j"]), REF_FF["moment_end"]), f"right M_j {right['M_j']}")

    _assert(case["equilibrium"]["residualRelative"] < 1e-9,
            f"equilibrium residual {case['equilibrium']['residualRelative']}")


def test_results_are_mapped_by_canonical_id_not_by_order() -> None:
    """Reversing element input order must not move results between members."""
    straight = _beam_input(with_mid_node=True, fixed_ends=False)
    results_a = analysis.analyse(straight, work_dir=WORK)["cases"][0]

    # Same structure, but the two members are supplied in the opposite order with fresh
    # element tags, so nothing depends on tags or list position. The load case must refer
    # to the new tags.
    permuted = analysis.AnalysisInput(
        model_id=straight.model_id,
        nodes=list(straight.nodes),
        members=[
            analysis.AnalysisMember(7, 2, 3, E, A, IZ, "beam.member.right"),
            analysis.AnalysisMember(3, 1, 2, E, A, IZ, "beam.member.left"),
        ],
        supports=list(straight.supports),
        cases=[
            analysis.LoadCase(
                case_id="udl",
                element_loads=(
                    analysis.AnalysisElementLoad(7, wy=-W),
                    analysis.AnalysisElementLoad(3, wy=-W),
                ),
                description="full-span UDL, downward",
            )
        ],
        source=straight.source,
    )
    results_b = analysis.analyse(permuted, work_dir=WORK)["cases"][0]

    for canonical_id in ("beam.member.left", "beam.member.right"):
        a = results_a["members"][canonical_id]
        b = results_b["members"][canonical_id]
        _assert(b["i"] == a["i"] and b["j"] == a["j"],
                f"{canonical_id}: connectivity moved with the element order")
        _assert(_close(b["M_i"], a["M_i"], rel=0.0, absolute=1e-6),
                f"{canonical_id}: M_i changed when the element order changed")
        _assert(_close(b["V_i"], a["V_i"], rel=0.0, absolute=1e-6),
                f"{canonical_id}: V_i changed when the element order changed")


def test_analysis_is_repeatable() -> None:
    first = analysis.analyse(_beam_input(with_mid_node=True, fixed_ends=False), work_dir=WORK)
    second = analysis.analyse(_beam_input(with_mid_node=True, fixed_ends=False), work_dir=WORK)
    a, b = first["cases"][0], second["cases"][0]
    for key in ("node1", "node3"):
        _assert(a["reactions"][key]["Fy"] == b["reactions"][key]["Fy"],
                f"reaction at {key} is not repeatable")
    _assert(a["displacements"]["beam.node.mid"]["uy"] == b["displacements"]["beam.node.mid"]["uy"],
            "midspan displacement is not repeatable")


def test_incomplete_input_is_rejected_not_defaulted() -> None:
    """Every missing input must be named, never silently assumed."""
    def expect_error(model, expected_fragment):
        try:
            analysis.analyse(model, work_dir=WORK)
        except analysis.AnalysisError as error:
            text = str(error)
            _assert(expected_fragment in text,
                    f"error should mention {expected_fragment!r}: {text[:300]}")
            return
        raise AssertionError(f"expected AnalysisError mentioning {expected_fragment!r}")

    base = _beam_input(with_mid_node=False, fixed_ends=False)

    no_supports = analysis.AnalysisInput(
        model_id="x", nodes=list(base.nodes), members=list(base.members),
        supports=[], cases=list(base.cases),
    )
    expect_error(no_supports, "no supports")

    no_cases = analysis.AnalysisInput(
        model_id="x", nodes=list(base.nodes), members=list(base.members),
        supports=list(base.supports), cases=[],
    )
    expect_error(no_cases, "no load cases")

    no_section = analysis.AnalysisInput(
        model_id="x", nodes=list(base.nodes),
        members=[analysis.AnalysisMember(1, 1, 2, E, A, 0.0, "m")],
        supports=list(base.supports), cases=list(base.cases),
    )
    expect_error(no_section, "Iz must be a positive")

    floating_support = analysis.AnalysisInput(
        model_id="x", nodes=list(base.nodes), members=list(base.members),
        supports=[analysis.AnalysisSupport(1, ux=True, uy=False, rz=False)],
        cases=list(base.cases),
    )
    expect_error(floating_support, "rigid-body")


def test_failed_engine_run_raises_and_returns_no_results() -> None:
    """A broken job must fail loudly: no partial displacements, no invented status."""
    model = _beam_input(with_mid_node=False, fixed_ends=False)
    model.validate()
    job = model.to_job(model.cases[0], job_id="intentional-failure")
    job["analysis"]["integrator"] = "Newmark"  # deliberately unsupported
    try:
        analysis.run_job(job, work_dir=WORK)
    except analysis.AnalysisError as error:
        _assert("integrator" in str(error), f"unexpected error: {error}")
        return
    raise AssertionError("an unsupported integrator was accepted")


def test_canonical_model_becomes_a_verifiable_frame() -> None:
    """End-to-end: a real canonical RC beam -> analytical frame -> closed-form check.

    The canonical model supplies geometry and identity; the caller must supply E,
    supports and loads. This is the Task 5 chain, and the numbers are checked against the
    simply-supported closed form rather than the engine's status code.
    """
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "Backend"))
    from cad_ifc import rc_model

    document = rc_model.build_model("beam")  # real generator output, 6.7 m x 0.3 m x 0.6 m
    element = document["elements"][0]
    span = element["dimensions"]["length_x"]
    width = element["dimensions"]["width_y"]
    depth = element["dimensions"]["height_z"]
    inertia = width * depth ** 3 / 12.0

    model = analysis.canonical_to_analysis(
        document,
        youngs_modulus_pa=E,
        supports=[
            {"node": f"{element['id']}#start", "ux": True, "uy": True, "rz": False},
            {"node": f"{element['id']}#end", "ux": False, "uy": True, "rz": False},
        ],
        element_loads=[{"element": element["id"], "wy": -W}],
        loads=[],
        subdivisions=4,
    )
    _assert(len(model.nodes) == 5, f"expected 5 nodes, got {len(model.nodes)}")
    _assert(len(model.members) == 4, f"expected 4 members, got {len(model.members)}")
    _assert(model.members[0].A == width * depth, f"gross area wrong: {model.members[0].A}")
    _assert(abs(model.members[0].Iz - inertia) < 1e-15, "gross inertia wrong")

    case = analysis.analyse(model, work_dir=WORK)["cases"][0]

    # Equivalent nodal loads reproduce the UDL: reactions wL/2, midspan deflection 5wL^4/384EI.
    reference = analysis.simply_supported_udl(span, W, E, inertia)
    for node in ("node1", "node5"):
        _assert(_close(case["reactions"][node]["Fy"], reference["reaction_each"]),
                f"{node} reaction {case['reactions'][node]['Fy']} vs {reference['reaction_each']}")

    # Displacements are keyed by canonical ids derived from the element id.
    # With a real UDL and 4 elements the nodal results are exact, so the midspan value must
    # match 5wL^4/384EI, not merely be downward.
    mid_key = f"{element['id']}#n2"
    _assert(mid_key in case["displacements"], f"{mid_key} missing: {sorted(case['displacements'])[:6]}")
    uy_mid = case["displacements"][mid_key]["uy"]
    _assert(_close(uy_mid, -reference["deflection_max"]),
            f"canonical midspan deflection {uy_mid} vs closed form {-reference['deflection_max']}")

    # Member results carry the canonical member ids, so a design check can be attached.
    for member in case["members"]:
        _assert(member.startswith(f"{element['id']}#e"), f"member id {member} lost its canonical root")


def test_design_bridge_requires_a_complete_result() -> None:
    """The design bridge must refuse incomplete data and never claim a code check."""
    case_id = "udl"
    model = _beam_input(with_mid_node=True, fixed_ends=False)
    results = analysis.analyse(model, work_dir=WORK)

    payload = analysis.design_check_payload(
        results, case_id=case_id, member_id="beam.member.left",
        section={"A": A, "Iz": IZ, "E": E, "fy": 355e6},
    )
    _assert(payload["incomplete"] is False, payload["incomplete_reason"])
    _assert(payload["design_checks_performed"] == [],
            "the bridge must not perform design checks")
    _assert("No code check has been run" in payload["note"], payload["note"])
    _assert(_close(payload["member"]["M_i"], 0.0, rel=0.0, absolute=1e-6),
            "member end moment mapping is wrong")
    _assert(payload["envelope"]["moment_max_abs_Nm"] > 0, payload["envelope"])

    # Without section data the payload is explicitly incomplete rather than silently usable.
    without = analysis.design_check_payload(results, case_id=case_id, member_id="beam.member.left")
    _assert(without["incomplete"] is True, "missing section must be reported")
    _assert(without["incomplete_reason"], "an incomplete payload must state why")

    # Unknown case or member must fail loudly.
    for kwargs in ({"case_id": "nope", "member_id": "beam.member.left"},
                   {"case_id": case_id, "member_id": "no.such.member"}):
        try:
            analysis.design_check_payload(results, **kwargs)
        except analysis.AnalysisError:
            continue
        raise AssertionError(f"expected AnalysisError for {kwargs}")


def main() -> int:
    try:
        analysis.opensees_python()
    except analysis.AnalysisError as error:
        print(f"SKIP: {error}")
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
    shutil.rmtree(WORK, ignore_errors=True)
    sys.exit(code)
