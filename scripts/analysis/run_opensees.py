#!/usr/bin/env python
"""
OpenSees execution process for Fundi Studio.

Why a separate process
----------------------
OpenSeesPy 3.8.0.0 is built against `python312.dll` on Windows (its wheel is tagged
`py3-none-win_amd64` but the extension links the 3.12 ABI), so it cannot be imported by
the backend interpreter, which is 3.13. The analysis therefore runs in a short-lived
process started with a Python 3.12 interpreter, exchanging JSON files:

    backend (3.13) --job.json--> this process (3.12 + OpenSees) --results.json--> backend

That is the "explicitly designed backend service" the integration brief allows, and it
keeps the engineering calculations out of the frontend.

What it does
------------
Builds a **2D frame** in OpenSees from an explicit, already-validated job description,
runs a static load case, and returns normalised results. It performs no engineering
assumptions of its own: nodes, elements, section/material properties, supports, loads and
the analysis type all arrive in the job. If anything needed is missing it exits non-zero
with a reason rather than inventing a value.

Job schema (all values SI: metres, newtons, pascals, m^4, radians)
------------------------------------------------------------------
{
  "schema": "fundi.analysis.job/1",
  "job_id": "frame-benchmark",
  "dimensions": 2,
  "nodes":     [{"tag": 1, "x": 0.0, "y": 0.0, "canonicalId": "frame.node.1"}],
  "elements":  [{"tag": 1, "i": 1, "j": 2, "E": 2.1e11, "A": 0.01, "Iz": 8.3e-6,
                 "canonicalId": "frame.member.beam", "sectionId": "UB457x191x67"}],
  "supports":  [{"node": 1, "ux": true, "uy": true, "rz": true}],
  "loads":     [{"node": 2, "Fx": 0.0, "Fy": -50000.0, "Mz": 0.0}],
  "analysis":  {"type": "static", "integrator": "LoadControl", "increment": 1.0,
                "steps": 1, "algorithm": "Linear", "test": null}
}

Results schema: see the `results` dict written at the end of `main()`.
"""
from __future__ import annotations

import json
import sys
import traceback

import openseespy.opensees as ops

JOB_SCHEMA = "fundi.analysis.job/1"
RESULT_SCHEMA = "fundi.analysis.result/1"


def fail(message: str, **extra) -> None:
    print(json.dumps({"ok": False, "error": message, **extra}), file=sys.stderr)
    raise SystemExit(1)


def require(job: dict, key: str, kind: type):
    if key not in job:
        fail(f"job is missing '{key}'")
    value = job[key]
    if not isinstance(value, kind):
        fail(f"'{key}' must be {kind.__name__}, got {type(value).__name__}")
    if isinstance(value, list) and not value:
        fail(f"'{key}' must not be empty")
    return value


def build_and_run(job: dict) -> dict:
    if job.get("schema") != JOB_SCHEMA:
        fail(f"unexpected job schema {job.get('schema')!r}, expected {JOB_SCHEMA!r}")

    dimensions = job.get("dimensions", 2)
    if dimensions != 2:
        fail(
            f"this runner supports 2D frames only (job asks for {dimensions}D). "
            "A 3D model must not be presented as if it were analysed."
        )
    ndf = 3

    nodes = require(job, "nodes", list)
    elements = require(job, "elements", list)
    supports = job.get("supports", [])
    loads = job.get("loads", [])
    analysis = job.get("analysis") or {}
    if not supports:
        fail("job has no supports: an unrestrained static model is not solvable")

    ops.wipe()
    ops.model("basic", "-ndm", 2, "-ndf", ndf)

    coordinates = {}
    for node in nodes:
        tag = int(node["tag"])
        coordinates[tag] = (float(node["x"]), float(node["y"]))
        ops.node(tag, float(node["x"]), float(node["y"]))

    applied = []
    for support in supports:
        tag = int(support["node"])
        if tag not in coordinates:
            fail(f"support references unknown node {tag}")
        ux = 1 if support.get("ux") else 0
        uy = 1 if support.get("uy") else 0
        rz = 1 if support.get("rz") else 0
        ops.fix(tag, ux, uy, rz)
        applied.append({"node": tag, "ux": bool(ux), "uy": bool(uy), "rz": bool(rz)})

    ops.geomTransf("Linear", 1)

    element_map = {}
    for element in elements:
        tag = int(element["tag"])
        i_tag = int(element["i"])
        j_tag = int(element["j"])
        for node_tag in (i_tag, j_tag):
            if node_tag not in coordinates:
                fail(f"element {tag} references unknown node {node_tag}")
            if not ops.getNodeTags() or node_tag not in ops.getNodeTags():
                fail(f"element {tag} references node {node_tag} that is not in the model")
        for key in ("E", "A", "Iz"):
            if key not in element:
                fail(f"element {tag} is missing '{key}': section/material data must be explicit")
            if not isinstance(element[key], (int, float)) or element[key] <= 0:
                fail(f"element {tag} '{key}' must be a positive number, got {element[key]!r}")
        ops.element(
            "elasticBeamColumn", tag, i_tag, j_tag,
            float(element["A"]), float(element["E"]), float(element["Iz"]), 1,
        )
        element_map[tag] = {
            "i": i_tag, "j": j_tag,
            "length": (
                (coordinates[j_tag][0] - coordinates[i_tag][0]) ** 2
                + (coordinates[j_tag][1] - coordinates[i_tag][1]) ** 2
            ) ** 0.5,
            "canonicalId": element.get("canonicalId"),
            "sectionId": element.get("sectionId"),
        }

    # Loads: a single explicit static case (no implicit self-weight, no invented factors).
    loaded = []
    element_loads = []
    if loads or job.get("elementLoads"):
        ops.timeSeries("Constant", 1)
        ops.pattern("Plain", 1, 1)
        for load in loads:
            tag = int(load["node"])
            if tag not in coordinates:
                fail(f"load references unknown node {tag}")
            fx = float(load.get("Fx", 0.0))
            fy = float(load.get("Fy", 0.0))
            mz = float(load.get("Mz", 0.0))
            ops.load(tag, fx, fy, mz)
            loaded.append({"node": tag, "Fx": fx, "Fy": fy, "Mz": mz})

        for element_load in job.get("elementLoads", []):
            tag = int(element_load["element"])
            if tag not in element_map:
                fail(f"element load references unknown element {tag}")
            wx = float(element_load.get("wx", 0.0))
            wy = float(element_load.get("wy", 0.0))
            # elasticBeamColumn uniform load: local axes, wy negative is downward for a
            # member whose local y points up. The convention is verified against
            # closed-form deflection by the benchmark tests, not assumed.
            ops.eleLoad("-ele", tag, "-type", "-beamUniform", wy, wx)
            element_loads.append({"element": tag, "wx": wx, "wy": wy})

    ops.system("BandGeneral")
    ops.numberer("RCM")
    ops.constraints("Plain")
    integrator = analysis.get("integrator", "LoadControl")
    if integrator != "LoadControl":
        fail(f"unsupported integrator {integrator!r}; only LoadControl is implemented")
    ops.integrator("LoadControl", float(analysis.get("increment", 1.0)))
    algorithm = analysis.get("algorithm", "Linear")
    if algorithm != "Linear":
        fail(f"unsupported algorithm {algorithm!r}; only Linear (first-order elastic) is implemented")
    ops.algorithm("Linear")
    ops.analysis("Static")

    steps = int(analysis.get("steps", 1))
    status = ops.analyze(steps)
    if status != 0:
        fail(f"OpenSees returned a non-zero analysis status ({status})", status=status)
    # The constraint handler computes support reactions into the node records only when
    # asked; without this call nodeReaction() reports 0.0 for every support, which would
    # look like a valid zero-reaction result instead of a missing one.
    ops.reactions()

    # --- results -----------------------------------------------------------
    displacements = []
    for tag in ops.getNodeTags():
        displacements.append(
            {
                "node": tag,
                "canonicalId": next(
                    (node.get("canonicalId") for node in nodes if int(node["tag"]) == tag), None
                ),
                "ux": ops.nodeDisp(tag, 1),
                "uy": ops.nodeDisp(tag, 2),
                "rz": ops.nodeDisp(tag, 3),
            }
        )

    reactions = []
    for support in applied:
        tag = support["node"]
        reactions.append(
            {
                "node": tag,
                "Fx": ops.nodeReaction(tag, 1),
                "Fy": ops.nodeReaction(tag, 2),
                "Mz": ops.nodeReaction(tag, 3),
                "restrained": support,
            }
        )

    member_forces = []
    for tag, meta in element_map.items():
        local = ops.eleResponse(tag, "localForces")
        if not local:
            fail(f"element {tag} returned no local forces")
        forces = [float(value) for value in local]
        member_forces.append(
            {
                "element": tag,
                "canonicalId": meta["canonicalId"],
                "sectionId": meta["sectionId"],
                "i": meta["i"],
                "j": meta["j"],
                "length": meta["length"],
                # 2D elasticBeamColumn local forces: N1,V1,M1,N2,V2,M2
                "N_i": forces[0], "V_i": forces[1], "M_i": forces[2],
                "N_j": forces[3], "V_j": forces[4], "M_j": forces[5],
                "localForces": forces,
            }
        )

    # Equilibrium of the applied load against the support reactions.
    #
    # Element loads act distributed along a member, so their resultant is integrated:
    # for a uniform load the resultant is (length x global intensity) acting at
    # mid-length, where the global intensity follows from the member's local axes.
    element_resultants = []
    for element_load in element_loads:
        meta = element_map[element_load["element"]]
        x_i, y_i = coordinates[meta["i"]]
        x_j, y_j = coordinates[meta["j"]]
        dx, dy = x_j - x_i, y_j - y_i
        length = ((dx * dx) + (dy * dy)) ** 0.5
        cos_t, sin_t = dx / length, dy / length
        qx, qy = element_load["wx"], element_load["wy"]
        global_x = qx * cos_t + qy * (-sin_t)
        global_y = qx * sin_t + qy * cos_t
        force_x, force_y = global_x * length, global_y * length
        mid_x, mid_y = (x_i + x_j) / 2.0, (y_i + y_j) / 2.0
        element_resultants.append(
            {
                "element": element_load["element"],
                "resultantFx": force_x,
                "resultantFy": force_y,
                "momentAboutOrigin": mid_x * force_y - mid_y * force_x,
            }
        )

    sum_applied_fx = sum(load["Fx"] for load in loaded) + sum(r["resultantFx"] for r in element_resultants)
    sum_applied_fy = sum(load["Fy"] for load in loaded) + sum(r["resultantFy"] for r in element_resultants)
    sum_applied_mz = sum(load["Mz"] for load in loaded)
    sum_reaction_fx = sum(reaction["Fx"] for reaction in reactions)
    sum_reaction_fy = sum(reaction["Fy"] for reaction in reactions)
    sum_reaction_mz = sum(reaction["Mz"] for reaction in reactions)
    # Moment equilibrium about the origin, including the moment each force produces.
    applied_moment_about_origin = sum(
        load["Mz"] + coordinates[load["node"]][0] * load["Fy"] - coordinates[load["node"]][1] * load["Fx"]
        for load in loaded
    ) + sum(r["momentAboutOrigin"] for r in element_resultants)
    reaction_moment_about_origin = sum(
        reaction["Mz"]
        + coordinates[reaction["node"]][0] * reaction["Fy"]
        - coordinates[reaction["node"]][1] * reaction["Fx"]
        for reaction in reactions
    )

    return {
        "schema": RESULT_SCHEMA,
        "ok": True,
        "opensees_version": ops.version(),
        "job_id": job.get("job_id"),
        "dimensions": 2,
        "degreesOfFreedom": ndf,
        "units": {"length": "m", "force": "N", "moment": "N*m", "stress": "Pa", "area": "m^2", "inertia": "m^4"},
        "analysis": {
            "type": "static",
            "formulation": "linear elastic, first-order (small displacement)",
            "integrator": integrator,
            "algorithm": algorithm,
            "steps": steps,
            "status": status,
        },
        "nodes": [{"tag": int(node["tag"]), "x": node["x"], "y": node["y"],
                   "canonicalId": node.get("canonicalId")} for node in nodes],
        "supports": applied,
        "loads": loaded,
        "elementLoads": element_loads,
        "elementLoadResultants": element_resultants,
        "displacements": displacements,
        "reactions": reactions,
        "memberForces": member_forces,
        "equilibrium": {
            "appliedFx": sum_applied_fx, "appliedFy": sum_applied_fy, "appliedMz": sum_applied_mz,
            "reactionFx": sum_reaction_fx, "reactionFy": sum_reaction_fy, "reactionMz": sum_reaction_mz,
            "residualFx": sum_applied_fx + sum_reaction_fx,
            "residualFy": sum_applied_fy + sum_reaction_fy,
            "appliedMomentAboutOrigin": applied_moment_about_origin,
            "reactionMomentAboutOrigin": reaction_moment_about_origin,
            "residualMomentAboutOrigin": applied_moment_about_origin + reaction_moment_about_origin,
        },
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        fail("usage: run_opensees.py <job.json> <results.json>")
    job_path, result_path = argv[1], argv[2]
    with open(job_path, encoding="utf-8") as handle:
        job = json.load(handle)
    try:
        results = build_and_run(job)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - every failure must reach the caller
        fail(f"{type(exc).__name__}: {exc}", traceback=traceback.format_exc()[-2000:])
        return 1
    with open(result_path, "w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
