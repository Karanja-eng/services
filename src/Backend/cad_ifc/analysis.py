"""
Structural analysis adapter: explicit analytical model -> OpenSees -> normalised results.

Design rules this module enforces
---------------------------------
1. **Nothing is inferred.** A node coordinate, member connectivity, section property,
   material strength, support or load must be supplied explicitly in a validated input
   document. There is no "assume a UDL of 10 kN/m" and no reading of geometry out of a
   drawing. A request that is missing a required input is rejected with the reason.
2. **The analytical model is separate from CAD, IFC and the visual model.** It is built
   from an `AnalysisInput`, which is a plain data structure. Converting it into OpenSees
   commands happens in a separate process (`scripts/analysis/run_opensees.py`).
3. **Units are SI and stated.** metres, newtons, pascals, m^4, radians. Results carry the
   unit block with them so a consumer never has to guess.
4. **Every analytical element keeps its canonical id.** The results are keyed by element
   tag *and* canonical id, and the tests permute element input order to prove results
   cannot be attached to the wrong member.
5. **A failed analysis returns a failure, never partial results.** If OpenSees fails,
   `AnalysisError` is raised; no displacement or force values are returned.

Why a subprocess
----------------
OpenSeesPy 3.8.0.0 links `python312.dll` on Windows, so it cannot be imported by the
backend interpreter (3.13). The engine runs under a 3.12 interpreter and the two
processes exchange JSON. `opensees_python()` locates it; `FUNDI_OPENSEES_PYTHON`
overrides.
"""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

JOB_SCHEMA = "fundi.analysis.job/1"
RESULT_SCHEMA = "fundi.analysis.result/1"
INPUT_SCHEMA = "fundi.analysis.input/1"

#: SI unit block every input and result carries.
UNITS = {
    "length": "m",
    "force": "N",
    "moment": "N*m",
    "stress": "Pa",
    "area": "m^2",
    "inertia": "m^4",
    "angle": "rad",
}

#: Interpreters known to be able to import openseespy on this machine, most specific
#: first. The value is only a default: `FUNDI_OPENSEES_PYTHON` always wins.
_INTERPRETER_CANDIDATES: Tuple[str, ...] = (
    r"C:\Users\HP\miniconda3\envs\yolov8\python.exe",
    r"C:\Users\HP\miniconda3\python.exe",
    "python3.12",
    "python3",
)


def _rank3(matrix: List[List[float]], tolerance: float = 1e-9) -> int:
    """Rank of a 3x3 matrix by Gaussian elimination with partial pivoting."""
    work = [list(row) for row in matrix]
    scale = max((abs(value) for row in work for value in row), default=0.0) or 1.0
    rank = 0
    for column in range(3):
        pivot = max(range(rank, 3), key=lambda row: abs(work[row][column]))
        if abs(work[pivot][column]) <= tolerance * scale:
            continue
        work[rank], work[pivot] = work[pivot], work[rank]
        leading = work[rank][column]
        for row in range(rank + 1, 3):
            factor = work[row][column] / leading
            for index in range(column, 3):
                work[row][index] -= factor * work[rank][index]
        rank += 1
    return rank


class AnalysisError(RuntimeError):
    """Raised when an analysis cannot be built, run or trusted."""


# ---------------------------------------------------------------------------
# Input contract
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AnalysisNode:
    """A structural node. `canonical_id` links it to the engineering model."""

    tag: int
    x: float
    y: float
    canonical_id: str


@dataclass(frozen=True)
class AnalysisMember:
    """A 2D frame member with explicit section and material properties."""

    tag: int
    i: int
    j: int
    E: float  # Pa
    A: float  # m^2
    Iz: float  # m^4
    canonical_id: str
    section_id: Optional[str] = None


@dataclass(frozen=True)
class AnalysisSupport:
    """Restraint flags for one node. All six combinations are meaningful in 2D."""

    node: int
    ux: bool = False
    uy: bool = True
    rz: bool = False


@dataclass(frozen=True)
class AnalysisLoad:
    """Nodal load in global coordinates."""

    node: int
    fx: float = 0.0
    fy: float = 0.0
    mz: float = 0.0


@dataclass(frozen=True)
class AnalysisElementLoad:
    """Uniform load applied along one member, in the member's local axes (N/m).

    Local axes follow the engine: for a member drawn from i to j, local x runs i→j and
    local y is 90° counter-clockwise from it, so a **downward** uniform load on a
    horizontal member to the right is `wy` **negative**. The tests verify this
    convention against closed-form deflection rather than trusting it.
    """

    element: int
    wy: float = 0.0
    wx: float = 0.0


@dataclass(frozen=True)
class LoadCase:
    """One explicit load case: loads plus the analysis settings that apply to it."""

    case_id: str
    loads: Tuple[AnalysisLoad, ...] = ()
    element_loads: Tuple[AnalysisElementLoad, ...] = ()
    description: str = ""
    steps: int = 1
    increment: float = 1.0


@dataclass
class AnalysisInput:
    """The analytical model handed to the engine.

    Built by an adapter, never by guessing. `validate()` is called before use and its
    failure is fatal.
    """

    model_id: str
    nodes: List[AnalysisNode] = field(default_factory=list)
    members: List[AnalysisMember] = field(default_factory=list)
    supports: List[AnalysisSupport] = field(default_factory=list)
    cases: List[LoadCase] = field(default_factory=list)
    source: str = ""
    assumptions: List[str] = field(default_factory=list)

    def validate(self) -> None:
        problems: List[str] = []
        if not self.nodes:
            problems.append("no nodes")
        if not self.members:
            problems.append("no members")
        if not self.supports:
            problems.append(
                "no supports: an unrestrained static model is not solvable. "
                "Boundary conditions must be stated explicitly."
            )
        if not self.cases:
            problems.append("no load cases: a case must be named explicitly, none is assumed")

        tags = {node.tag for node in self.nodes}
        if len(tags) != len(self.nodes):
            problems.append("duplicate node tags")
        member_tags = {member.tag for member in self.members}
        if len(member_tags) != len(self.members):
            problems.append("duplicate member tags")

        for member in self.members:
            if member.i not in tags or member.j not in tags:
                problems.append(f"member {member.tag} references an unknown node")
            if member.i == member.j:
                problems.append(f"member {member.tag} starts and ends at the same node")
            for name in ("E", "A", "Iz"):
                value = getattr(member, name)
                if not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
                    problems.append(f"member {member.tag}: {name} must be a positive finite number")
            if self._length(member) <= 0:
                problems.append(f"member {member.tag} has zero length")

        restrained = {support.node for support in self.supports if support.ux or support.uy or support.rz}
        if not restrained:
            problems.append("supports do not restrain any degree of freedom")
        for support in self.supports:
            if support.node not in tags:
                problems.append(f"support references unknown node {support.node}")

        # Rigid-body freedom check: a 2D model has three rigid-body modes (translation in
        # x, translation in y, rotation). The restraints must suppress all three, which is
        # a rank test on the constraint directions - not "the supports must not be
        # collinear", which would wrongly reject a simply supported beam.
        if self._unrestrained_translation(self.supports):
            problems.append(
                "the support set does not restrain all three rigid-body modes of a 2D "
                "model (translation in x, translation in y, rotation), so the static "
                "model would be singular"
            )

        case_ids = {case.case_id for case in self.cases}
        if len(case_ids) != len(self.cases):
            problems.append("duplicate load case ids")
        for case in self.cases:
            if not case.loads and not case.element_loads:
                problems.append(f"case {case.case_id} has neither nodal nor element loads")
            for load in case.loads:
                if load.node not in tags:
                    problems.append(f"case {case.case_id}: load on unknown node {load.node}")
            for element_load in case.element_loads:
                if element_load.element not in member_tags:
                    problems.append(
                        f"case {case.case_id}: element load on unknown member {element_load.element}"
                    )

        if problems:
            raise AnalysisError("analytical model is incomplete or invalid: " + "; ".join(problems))

    def _length(self, member: AnalysisMember) -> float:
        by_tag = {node.tag: node for node in self.nodes}
        i_node, j_node = by_tag[member.i], by_tag[member.j]
        return math.hypot(j_node.x - i_node.x, j_node.y - i_node.y)

    def _unrestrained_translation(self, supports: Sequence["AnalysisSupport"]) -> bool:
        """True when the restraints fail to suppress a rigid-body mode.

        Each restrained degree of freedom is a constraint on the three rigid-body
        unknowns ``(tx, ty, theta)``:

            ux restrained : tx - y*theta = 0   -> [1, 0, -y]
            uy restrained : ty + x*theta = 0   -> [0, 1,  x]
            rz restrained : theta        = 0   -> [0, 0,  1]

        Three rigid-body modes exist, so the constraint matrix must have rank 3. The rank
        is obtained from the 3x3 Gram matrix ``A^T A`` with Gaussian elimination, which is
        exact arithmetic on a matrix this small and avoids adding a numerical dependency
        to this module.
        """
        by_tag = {node.tag: node for node in self.nodes}
        rows: List[List[float]] = []
        for support in supports:
            if support.node not in by_tag:
                continue
            node = by_tag[support.node]
            if support.ux:
                rows.append([1.0, 0.0, -node.y])
            if support.uy:
                rows.append([0.0, 1.0, node.x])
            if support.rz:
                rows.append([0.0, 0.0, 1.0])
        if not rows:
            return True

        gram = [[sum(row[i] * row[j] for row in rows) for j in range(3)] for i in range(3)]
        return _rank3(gram) < 3

    def to_job(self, case: LoadCase, job_id: str) -> Dict[str, Any]:
        """Serialise one load case as an engine job (SI units, 2D)."""
        return {
            "schema": JOB_SCHEMA,
            "job_id": job_id,
            "dimensions": 2,
            "model_id": self.model_id,
            "source": self.source,
            "nodes": [
                {"tag": node.tag, "x": node.x, "y": node.y, "canonicalId": node.canonical_id}
                for node in self.nodes
            ],
            "elements": [
                {
                    "tag": member.tag, "i": member.i, "j": member.j,
                    "E": member.E, "A": member.A, "Iz": member.Iz,
                    "canonicalId": member.canonical_id, "sectionId": member.section_id,
                }
                for member in self.members
            ],
            "supports": [
                {"node": support.node, "ux": support.ux, "uy": support.uy, "rz": support.rz}
                for support in self.supports
            ],
            "loads": [
                {"node": load.node, "Fx": load.fx, "Fy": load.fy, "Mz": load.mz}
                for load in case.loads
            ],
            "elementLoads": [
                {"element": element_load.element, "wx": element_load.wx, "wy": element_load.wy}
                for element_load in case.element_loads
            ],
            "analysis": {
                "type": "static",
                "caseId": case.case_id,
                "integrator": "LoadControl",
                "increment": case.increment,
                "steps": case.steps,
                "algorithm": "Linear",
            },
        }


# ---------------------------------------------------------------------------
# Engine invocation
# ---------------------------------------------------------------------------


def opensees_python() -> str:
    """Path of a Python interpreter that can import `openseespy`.

    Raises `AnalysisError` with the reason when none is found, rather than silently
    skipping the analysis.
    """
    override = os.environ.get("FUNDI_OPENSEES_PYTHON")
    if override:
        if not os.path.exists(override):
            raise AnalysisError(f"FUNDI_OPENSEES_PYTHON points at a missing file: {override}")
        return override
    for candidate in _INTERPRETER_CANDIDATES:
        if os.path.isabs(candidate):
            if os.path.exists(candidate):
                return candidate
        else:
            found = shutil.which(candidate)
            if found:
                return found
    raise AnalysisError(
        "no Python interpreter able to import openseespy was found. OpenSeesPy 3.8.0.0 is "
        "built against python312.dll on Windows, so the backend interpreter (3.13) cannot "
        "import it. Set FUNDI_OPENSEES_PYTHON to a Python 3.12 interpreter (see "
        "docs/integration/opensees_analysis.md)."
    )


def _runner_path() -> str:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
    return os.path.join(repo_root, "scripts", "analysis", "run_opensees.py")


def run_job(job: Dict[str, Any], work_dir: Optional[str] = None, timeout: int = 300) -> Dict[str, Any]:
    """Run one engine job and return its results.

    Python's stdout/stderr are redirected to files rather than pipes: restricted
    sandboxes deny opening the named pipes that `capture_output` relies on, and files keep
    the full error message for the caller.
    """
    interpreter = opensees_python()
    runner = _runner_path()
    if not os.path.exists(runner):
        raise AnalysisError(f"OpenSees runner not found: {runner}")

    directory = os.path.abspath(work_dir or os.path.join(".test-artifacts", "analysis"))
    os.makedirs(directory, exist_ok=True)
    job_path = os.path.join(directory, f"{job.get('job_id', 'job')}.job.json")
    result_path = os.path.join(directory, f"{job.get('job_id', 'job')}.result.json")
    stdout_path = os.path.join(directory, f"{job.get('job_id', 'job')}.stdout.txt")
    stderr_path = os.path.join(directory, f"{job.get('job_id', 'job')}.stderr.txt")
    for path in (result_path,):
        if os.path.exists(path):
            os.remove(path)
    with open(job_path, "w", encoding="utf-8") as handle:
        json.dump(job, handle, indent=2)

    environment = dict(os.environ)
    # Make the extracted OpenSees packages importable even though they were installed
    # without pip (the sandbox blocks pip's *.whl.metadata step on this machine).
    opensees_path = os.path.abspath(os.path.join(directory, "..", "..", ".venv-opensees"))
    if os.path.isdir(opensees_path):
        environment["PYTHONPATH"] = os.pathsep.join(
            [opensees_path, environment.get("PYTHONPATH", "")]
        ).strip(os.pathsep)

    with open(stdout_path, "wb") as stdout, open(stderr_path, "wb") as stderr:
        completed = subprocess.run(
            [interpreter, runner, job_path, result_path],
            stdout=stdout,
            stderr=stderr,
            env=environment,
            timeout=timeout,
        )
    if completed.returncode != 0 or not os.path.exists(result_path):
        detail = ""
        with open(stderr_path, encoding="utf-8", errors="replace") as handle:
            detail = handle.read().strip()[-1200:]
        raise AnalysisError(
            f"OpenSees run failed (exit {completed.returncode}) for job "
            f"{job.get('job_id')!r}: {detail or 'no stderr output'}"
        )
    with open(result_path, encoding="utf-8") as handle:
        results = json.load(handle)
    if not results.get("ok"):
        raise AnalysisError(f"OpenSees reported failure: {results.get('error')}")
    if results.get("schema") != RESULT_SCHEMA:
        raise AnalysisError(f"unexpected result schema {results.get('schema')!r}")
    return results


# ---------------------------------------------------------------------------
# Result normalisation and mapping
# ---------------------------------------------------------------------------


def analyse(analysis: AnalysisInput, work_dir: Optional[str] = None) -> Dict[str, Any]:
    """Validate, run every load case, and return normalised results keyed by canonical id.

    A failure in any case raises; no partial result set is returned.
    """
    analysis.validate()
    cases = []
    # Node geometry is case independent, so it is exposed once at the top level for
    # consumers (2D/3D view adapters) that need coordinates rather than displacements.
    model_nodes: List[Dict[str, Any]] = []
    for case in analysis.cases:
        job = analysis.to_job(case, job_id=f"{analysis.model_id}-{case.case_id}")
        raw = run_job(job, work_dir=work_dir)
        if not model_nodes:
            model_nodes = list(raw.get("nodes", []))

        displacements = {
            item["canonicalId"] or f"node{ item['node'] }": {
                "node": item["node"], "ux": item["ux"], "uy": item["uy"], "rz": item["rz"],
            }
            for item in raw["displacements"]
        }
        reactions = {
            f"node{ item['node'] }": {
                "node": item["node"], "Fx": item["Fx"], "Fy": item["Fy"], "Mz": item["Mz"],
            }
            for item in raw["reactions"]
        }
        members = {}
        for item in raw["memberForces"]:
            key = item["canonicalId"] or f"element{ item['element'] }"
            members[key] = {
                "element": item["element"],
                "section_id": item["sectionId"],
                "i": item["i"], "j": item["j"], "length": item["length"],
                "N_i": item["N_i"], "V_i": item["V_i"], "M_i": item["M_i"],
                "N_j": item["N_j"], "V_j": item["V_j"], "M_j": item["M_j"],
            }

        residual = max(
            abs(raw["equilibrium"]["residualFx"]),
            abs(raw["equilibrium"]["residualFy"]),
            abs(raw["equilibrium"]["residualMomentAboutOrigin"]),
        )
        applied = max(
            abs(raw["equilibrium"]["appliedFx"]),
            abs(raw["equilibrium"]["appliedFy"]),
            abs(raw["equilibrium"]["appliedMomentAboutOrigin"]),
            1.0,
        )
        cases.append(
            {
                "case_id": case.case_id,
                "description": case.description,
                "analysis": raw["analysis"],
                "displacements": displacements,
                "reactions": reactions,
                "members": members,
                "equilibrium": {**raw["equilibrium"], "residualAbsoluteMax": residual,
                                "residualRelative": residual / applied},
                "loads": raw["loads"],
                "element_loads": raw.get("elementLoads", []),
                "supports": raw["supports"],
            }
        )

    return {
        "schema": "fundi.analysis.results/1",
        "ok": True,
        "model_id": analysis.model_id,
        "source": analysis.source,
        "engine": {"name": "OpenSees", "version": cases[0]["analysis"].get("status") is not None and
                   "OpenSeesPy" or "OpenSeesPy"},
        "units": UNITS,
        "sign_convention": {
            "axes": "global X right, Y up, Z out of plane (right-handed), as in the engine",
            "displacements": "positive in the positive axis direction; rotation positive counter-clockwise",
            "reactions": "positive in the positive axis direction (an upward reaction at a support under downward load is positive)",
            "memberForces": (
                "local axes: N positive in tension, V and M in the element's local i->j "
                "frame; M_i and M_j are the moments at the i and j ends of the member"
            ),
        },
        "nodes": model_nodes,
        "cases": cases,
        "assumptions": list(analysis.assumptions),
        "limitations": [
            "2D frame, 3 degrees of freedom per node",
            "linear elastic, first-order (small displacement) analysis only",
            "no second-order (P-Delta), no material or geometric non-linearity",
            "static load cases only; no modal, dynamic or time-history analysis",
            "no self-weight is added implicitly",
        ],
    }


def members_by_tag(analysis: AnalysisInput) -> Dict[int, AnalysisMember]:
    return {member.tag: member for member in analysis.members}


# ---------------------------------------------------------------------------
# Canonical model -> analytical model
# ---------------------------------------------------------------------------


def canonical_to_analysis(
    model_doc: Dict[str, Any],
    *,
    supports: Sequence[Dict[str, Any]],
    loads: Sequence[Dict[str, Any]],
    youngs_modulus_pa: float,
    member_sections: Optional[Dict[str, Dict[str, float]]] = None,
    subdivisions: int = 1,
    case_id: str = "ULS-1",
    element_loads: Sequence[Dict[str, Any]] = (),
) -> AnalysisInput:
    """Convert a canonical engineering model into an analytical 2D model.

    What the canonical model gives: element ids, element types, gross geometry
    (length/width/depth in metres) and placement. What it does **not** give — and what
    this adapter therefore refuses to invent — is:

    * **section/material properties** (`youngs_modulus_pa` is required; `A` and `Iz` are
      either supplied per element in ``member_sections`` or derived from the canonical
      dimensions, which is a geometric property, not a design check),
    * **supports and restraints** (required argument; the canonical model carries none),
    * **loads and load cases** (required argument; no self-weight or default UDL).

    Only horizontal members in the XY plane are supported for now: a member whose axis is
    not the global X axis has no defined in-plane orientation in the canonical model yet,
    so it is rejected rather than silently straightened.

    ``subdivisions`` splits each member into equal-length elements (adding intermediate
    nodes) so that interior results such as midspan deflection are available; it must be
    a positive integer and is recorded as an assumption.

    Element ids map to analytical member tags through this function only, so every result
    can be traced back to a canonical element.
    """
    if youngs_modulus_pa <= 0 or not math.isfinite(youngs_modulus_pa):
        raise AnalysisError("youngs_modulus_pa must be a positive number of pascals")
    if subdivisions < 1:
        raise AnalysisError("subdivisions must be >= 1")
    if not supports:
        raise AnalysisError("supports must be supplied explicitly: the canonical model has none")
    if not loads and not element_loads:
        raise AnalysisError("loads must be supplied explicitly: no load case is assumed")

    elements = [element for element in model_doc.get("elements", [])
                if element.get("element_type") in {"beam", "column"}]
    if not elements:
        raise AnalysisError(
            "the canonical model contains no beam or column elements to analyse; "
            f"element types present: {sorted({e.get('element_type') for e in model_doc.get('elements', [])})}"
        )

    nodes: List[AnalysisNode] = []
    members: List[AnalysisMember] = []
    node_by_key: Dict[Tuple[float, float], int] = {}
    assumptions: List[str] = []
    next_node_tag = 1
    next_member_tag = 1

    def node_at(x: float, y: float, canonical_id: str) -> int:
        nonlocal next_node_tag
        key = (round(x, 9), round(y, 9))
        if key in node_by_key:
            return node_by_key[key]
        tag = next_node_tag
        next_node_tag += 1
        nodes.append(AnalysisNode(tag, x, y, canonical_id))
        node_by_key[key] = tag
        return tag

    for element in elements:
        axis = element.get("axis", "z")
        if axis != "x":
            raise AnalysisError(
                f"element {element['id']} has axis {axis!r}; only horizontal members along "
                "global X are supported by this adapter"
            )
        dims = element["dimensions"]
        length = float(dims["length_x"])
        width = float(dims["width_y"])
        depth = float(dims["height_z"])
        placement = element["placement"]

        section = (member_sections or {}).get(element["id"])
        if section:
            area = float(section["A"])
            inertia = float(section["Iz"])
        else:
            area = width * depth
            inertia = width * depth ** 3 / 12.0
            assumptions.append(
                f"{element['id']}: A and Iz derived from the canonical section "
                f"({width} m x {depth} m) as gross geometric properties"
            )
        if area <= 0 or inertia <= 0:
            raise AnalysisError(f"element {element['id']} produced a non-positive section property")

        x0 = float(placement["x"]) - length / 2.0
        x1 = float(placement["x"]) + length / 2.0
        # The canonical frame is Z-up; the 2D analytical frame is XY with Y as the
        # vertical in-plane axis, so a horizontal member lies on constant Y = placement.y.
        y = float(placement["y"])

        step = length / subdivisions
        chain = [node_at(x0 + index * step, y,
                         f"{element['id']}#n{index}") for index in range(subdivisions + 1)]
        for index in range(subdivisions):
            members.append(
                AnalysisMember(
                    tag=next_member_tag,
                    i=chain[index],
                    j=chain[index + 1],
                    E=float(youngs_modulus_pa),
                    A=area,
                    Iz=inertia,
                    canonical_id=f"{element['id']}#e{index}" if subdivisions > 1 else element["id"],
                    section_id=element.get("material"),
                )
            )
            next_member_tag += 1

    def resolve_node(reference: Any) -> int:
        """Accept a canonical element id (its start/end node) or an explicit node id."""
        if isinstance(reference, int):
            if reference not in {node.tag for node in nodes}:
                raise AnalysisError(f"support/load references unknown analytical node {reference}")
            return reference
        text = str(reference)
        if text.endswith("#start") or text.endswith("#end"):
            base, _, which = text.rpartition("#")
            for element in elements:
                if element["id"] != base:
                    continue
                dims = element["dimensions"]
                x = float(element["placement"]["x"]) + (
                    -dims["length_x"] / 2 if which == "start" else dims["length_x"] / 2
                )
                key = (round(x, 9), round(float(element["placement"]["y"]), 9))
                if key in node_by_key:
                    return node_by_key[key]
            raise AnalysisError(f"cannot resolve node reference {text!r}")
        for node in nodes:
            if node.canonical_id == text:
                return node.tag
        raise AnalysisError(f"cannot resolve node reference {text!r}")

    analysis_supports = [
        AnalysisSupport(
            node=resolve_node(entry["node"]),
            ux=bool(entry.get("ux", False)),
            uy=bool(entry.get("uy", True)),
            rz=bool(entry.get("rz", False)),
        )
        for entry in supports
    ]
    analysis_loads = [
        AnalysisLoad(
            node=resolve_node(entry["node"]),
            fx=float(entry.get("fx", 0.0)),
            fy=float(entry.get("fy", 0.0)),
            mz=float(entry.get("mz", 0.0)),
        )
        for entry in loads
    ]

    # A uniform load given per canonical element is applied to each of its child members,
    # so the engine integrates it exactly instead of it being approximated by nodal forces.
    expanded_element_loads: List[AnalysisElementLoad] = []
    for entry in element_loads:
        parent = str(entry["element"])
        matching = [member for member in members if member.canonical_id.startswith(f"{parent}#e")]
        if not matching:
            raise AnalysisError(
                f"element load references {parent!r}, which is not an analysed member"
            )
        for member in matching:
            expanded_element_loads.append(
                AnalysisElementLoad(
                    element=member.tag,
                    wy=float(entry.get("wy", 0.0)),
                    wx=float(entry.get("wx", 0.0)),
                )
            )

    if not analysis_loads and not expanded_element_loads:
        raise AnalysisError("loads must be supplied explicitly: no load case is assumed")

    assumptions.append(f"each member split into {subdivisions} element(s)")
    assumptions.append(f"E = {youngs_modulus_pa:g} Pa supplied explicitly")
    assumptions.append("no self-weight, no load factors: the case is exactly as supplied")

    return AnalysisInput(
        model_id=model_doc.get("model_id", "canonical"),
        nodes=nodes,
        members=members,
        supports=analysis_supports,
        cases=[
            LoadCase(
                case_id=case_id,
                loads=tuple(analysis_loads),
                element_loads=tuple(expanded_element_loads),
                description="explicit static case from the canonical adapter",
            )
        ],
        source=f"canonical:{model_doc.get('model_id')}",
        assumptions=assumptions,
    )


# ---------------------------------------------------------------------------
# Interface to the deterministic design checks (Task 5.5)
# ---------------------------------------------------------------------------


def design_check_payload(
    results: Dict[str, Any],
    *,
    case_id: str,
    member_id: str,
    section: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Prepare one member's validated analysis results for a design-check module.

    This is deliberately only a *bridge*: it validates and packages, it performs no code
    check and claims no compliance. The rules themselves stay in the existing
    deterministic modules. A payload is returned only when every requirement below holds;
    otherwise an :class:`AnalysisError` names what is missing, so a check can be reported
    as incomplete instead of silently running on absent data.

    Requirements: the results are complete and finite, the requested case exists, the
    member is present in that case, both member ends carry forces, and the section is
    supplied when the caller needs a resistance to compare against.
    """
    if not results.get("ok"):
        raise AnalysisError("analysis results are marked as failed; refusing to design from them")
    cases = {case["case_id"]: case for case in results.get("cases", [])}
    if case_id not in cases:
        raise AnalysisError(
            f"load case {case_id!r} is not present; available: {sorted(cases)}"
        )
    case = cases[case_id]

    members = {item_id: item for item_id, item in case["members"].items()}
    if member_id not in members:
        raise AnalysisError(
            f"member {member_id!r} is not present in case {case_id!r}; "
            f"available: {sorted(members)[:8]}"
        )
    member = members[member_id]

    required = ("N_i", "V_i", "M_i", "N_j", "V_j", "M_j")
    for key in required:
        value = member.get(key)
        if value is None or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise AnalysisError(f"member {member_id!r} has a missing or non-finite {key}")

    for key, value in case["displacements"].items():
        for component in ("ux", "uy", "rz"):
            if not math.isfinite(value[component]):
                raise AnalysisError(f"displacement {key}.{component} is not finite")

    envelope = {
        "shear_max_abs_N": max(abs(member["V_i"]), abs(member["V_j"])),
        "moment_max_abs_Nm": max(abs(member["M_i"]), abs(member["M_j"])),
        "axial_max_abs_N": max(abs(member["N_i"]), abs(member["N_j"])),
    }

    return {
        "schema": "fundi.design.input/1",
        "source": {
            "analysis_schema": results.get("schema"),
            "engine": results.get("engine"),
            "model_id": results.get("model_id"),
            "case_id": case_id,
            "member_id": member_id,
        },
        "units": results.get("units"),
        "sign_convention": results.get("sign_convention"),
        "member": {
            "element": member["element"],
            "length_m": member["length"],
            "N_i": member["N_i"], "V_i": member["V_i"], "M_i": member["M_i"],
            "N_j": member["N_j"], "V_j": member["V_j"], "M_j": member["M_j"],
        },
        "envelope": envelope,
        "section": section,
        "design_checks_performed": [],
        "note": (
            "Analysis results only. No code check has been run and no compliance is "
            "claimed; the existing deterministic design modules consume this payload."
        ),
        "incomplete": section is None,
        "incomplete_reason": (
            None if section
            else "section properties were not supplied, so no resistance can be compared"
        ),
    }





def simply_supported_udl(L: float, w: float, E: float, Iz: float) -> Dict[str, float]:
    """Closed-form simply supported beam under a full-span UDL.

    Reference values used to verify the engine numerically (not just its exit status):
        R = wL/2,  M_max = wL^2/8,  delta_max = 5wL^4/(384 E I),  theta_end = wL^3/(24 E I)
    """
    return {
        "reaction_each": w * L / 2.0,
        "moment_max": w * L ** 2 / 8.0,
        "deflection_max": 5.0 * w * L ** 4 / (384.0 * E * Iz),
        "rotation_end": w * L ** 3 / (24.0 * E * Iz),
    }


def fixed_fixed_udl(L: float, w: float, E: float, Iz: float) -> Dict[str, float]:
    """Closed-form fully fixed beam under a full-span UDL.

        R = wL/2,  M_end = wL^2/12,  M_mid = wL^2/24,  delta_max = wL^4/(384 E I)
    """
    return {
        "reaction_each": w * L / 2.0,
        "moment_end": w * L ** 2 / 12.0,
        "moment_mid": w * L ** 2 / 24.0,
        "deflection_max": w * L ** 4 / (384.0 * E * Iz),
    }


def cantilever_tip_point(L: float, P: float, E: float, Iz: float) -> Dict[str, float]:
    """Closed-form cantilever with a tip point load.

        delta_tip = PL^3/(3EI),  theta_tip = PL^2/(2EI),  M_fixed = PL
    """
    return {
        "deflection_tip": P * L ** 3 / (3.0 * E * Iz),
        "rotation_tip": P * L ** 2 / (2.0 * E * Iz),
        "moment_fixed": P * L,
        "reaction_vertical": P,
        "reaction_moment": P * L,
    }
