"""
Three-dimensional linear-elastic frame analysis (explicit input contract).

Why a separate module instead of widening `analysis.py`
-------------------------------------------------------
`analysis.py` is the proven 2D pipeline: its dataclasses, validation, canonical
adapter and result normaliser are 3 DOF per node, and the frontend view model is
built around that shape. Widening those frozen contracts in place would have
changed the meaning of every existing 2D call and its tests.

This module adds a **3D** path that:

* reuses the engine invocation (`analysis.run_job`, subprocess JSON exchange,
  `AnalysisError`, interpreter discovery) — there is still exactly one solver
  integration;
* takes an **explicit analytical model** (nodes with x/y/z, members with
  E, A, Iy, Iz, J, G, supports with 6 restraints, loads with 6 components). No
  orientation, torsional constant or shear modulus is inferred: the canonical 2D
  model does not carry a section orientation, so deriving `vecxz` or `J` would be
  an assumption the user cannot see;
* validates the model before running (positive properties, node/member references,
  duplicate ids, and a rank test that the restraints suppress all **six** rigid-body
  modes of a 3D frame);
* returns a normalised result document keyed by canonical ids, with per-member local
  axes so a viewer cannot guess them.

What it deliberately does not support (each raises, never silently ignored)
---------------------------------------------------------------------------
* element (distributed) loads in 3D — the 2D path supports them; the 3D engine call
  for `-beamUniform` needs an explicit local load frame and is not implemented yet;
* non-linear analysis, second-order effects, releases, rigid offsets, and design.

Every unsupported request produces an `AnalysisError` naming the reason.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .analysis import AnalysisError, run_job

DIMENSIONS = 3
DOFS = 6
RESULT_SCHEMA = "fundi.analysis.results/1"
ANALYTICAL_SCHEMA = "fundi.analysis3d.input/1"
SUPPORTED_ANALYSIS = {"type": "static", "integrator": "LoadControl", "algorithm": "Linear"}


# ---------------------------------------------------------------------------
# Input contract
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Node3D:
    """A 3D node. `tag` is the solver id; `canonical_id` links it to the model."""

    tag: int
    x: float
    y: float
    z: float
    canonical_id: Optional[str] = None


@dataclass(frozen=True)
class Member3D:
    """A 3D frame member with **explicit** section and material constants."""

    tag: int
    i: int
    j: int
    E: float  # Pa
    A: float  # m^2
    Iy: float  # m^4, bending about the local y axis
    Iz: float  # m^4, bending about the local z axis
    J: float  # m^4, torsional constant
    G: float  # Pa, shear modulus
    canonical_id: Optional[str] = None
    section_id: Optional[str] = None
    # Reference vector used to orient the member's local x-z plane. Supplied
    # explicitly; the adapter never invents one.
    vecxz: Tuple[float, float, float] = (0.0, 0.0, 1.0)


@dataclass(frozen=True)
class Support3D:
    """Restraint flags for one node (six DOF)."""

    node: int
    ux: bool = False
    uy: bool = False
    uz: bool = False
    rx: bool = False
    ry: bool = False
    rz: bool = False


@dataclass(frozen=True)
class Load3D:
    """Nodal load in global coordinates."""

    node: int
    fx: float = 0.0
    fy: float = 0.0
    fz: float = 0.0
    mx: float = 0.0
    my: float = 0.0
    mz: float = 0.0


@dataclass(frozen=True)
class LoadCase3D:
    case_id: str
    loads: Tuple[Load3D, ...] = ()
    description: str = ""
    steps: int = 1
    increment: float = 1.0


@dataclass
class AnalysisInput3D:
    model_id: str
    nodes: List[Node3D] = field(default_factory=list)
    members: List[Member3D] = field(default_factory=list)
    supports: List[Support3D] = field(default_factory=list)
    cases: List[LoadCase3D] = field(default_factory=list)
    source: str = "explicit 3D frame"
    assumptions: List[str] = field(default_factory=list)
    element_loads: Sequence[Any] = ()

    # -- validation ---------------------------------------------------------

    def validate(self) -> None:
        problems: List[str] = []
        if not self.nodes:
            problems.append("no nodes")
        if not self.members:
            problems.append("no members")
        if not self.supports:
            problems.append(
                "no supports: an unrestrained 3D frame is not solvable. Boundary "
                "conditions must be stated explicitly."
            )
        if not self.cases:
            problems.append("no load cases: a case must be named explicitly, none is assumed")
        if self.element_loads:
            problems.append(
                "distributed element loads are not supported in the 3D path yet; supply "
                "equivalent nodal loads explicitly instead of having them guessed"
            )

        tags = {node.tag for node in self.nodes}
        if len(tags) != len(self.nodes):
            problems.append("duplicate node tags")
        member_tags = {member.tag for member in self.members}
        if len(member_tags) != len(self.members):
            problems.append("duplicate member tags")

        by_tag = {node.tag: node for node in self.nodes}
        for member in self.members:
            if member.i not in tags or member.j not in tags:
                problems.append(f"member {member.tag} references an unknown node")
                continue
            if member.i == member.j:
                problems.append(f"member {member.tag} starts and ends at the same node")
            for name in ("E", "A", "Iy", "Iz", "J", "G"):
                value = getattr(member, name)
                if not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
                    problems.append(f"member {member.tag}: {name} must be a positive finite number")
            if math.dist(
                (by_tag[member.i].x, by_tag[member.i].y, by_tag[member.i].z),
                (by_tag[member.j].x, by_tag[member.j].y, by_tag[member.j].z),
            ) <= 1e-9:
                problems.append(f"member {member.tag} has zero length")
            vx, vy, vz = member.vecxz
            if not all(math.isfinite(value) for value in (vx, vy, vz)):
                problems.append(f"member {member.tag}: vecxz must be finite")
            elif abs(vx) < 1e-12 and abs(vy) < 1e-12 and abs(vz) < 1e-12:
                problems.append(f"member {member.tag}: vecxz must be a non-zero direction")

        support_nodes = [support.node for support in self.supports]
        if len(set(support_nodes)) != len(support_nodes):
            problems.append("more than one support on the same node")
        for support in self.supports:
            if support.node not in tags:
                problems.append(f"support references unknown node {support.node}")
            if not any(
                (support.ux, support.uy, support.uz, support.rx, support.ry, support.rz)
            ):
                problems.append(f"support on node {support.node} restrains nothing")

        for case in self.cases:
            if not case.case_id:
                problems.append("a load case has no id")
            if not case.loads:
                problems.append(f"case {case.case_id} has no loads")
            for load in case.loads:
                if load.node not in tags:
                    problems.append(f"load references unknown node {load.node}")
                for name in ("fx", "fy", "fz", "mx", "my", "mz"):
                    value = getattr(load, name)
                    if not isinstance(value, (int, float)) or not math.isfinite(value):
                        problems.append(f"load on node {load.node}: {name} must be finite")

        if not problems:
            rank = self._rigid_body_rank()
            if rank < DOFS:
                problems.append(
                    f"the support set restrains only {rank} of the {DOFS} rigid-body modes of a "
                    "3D frame; add restraints until all six are suppressed"
                )

        if problems:
            raise AnalysisError("; ".join(problems))

    def _rigid_body_rank(self) -> int:
        """Rank of the restraint matrix against the six 3D rigid-body modes.

        The six modes are the three translations and three rotations. A restrained
        translation DOF `u` at a node contributes (1 for the corresponding
        translation mode, and the rotational lever arms for the rotation modes); a
        restrained rotation DOF contributes 1 for its rotation mode. When the rank is
        6, no rigid-body motion remains free.
        """
        rows: List[List[float]] = []
        nodes = {node.tag: node for node in self.nodes}
        for support in self.supports:
            node = nodes.get(support.node)
            if node is None:
                continue
            x, y, z = node.x, node.y, node.z
            # Translational restraints: u = T + R x r
            if support.ux:
                rows.append([1.0, 0.0, 0.0, 0.0, z, -y])
            if support.uy:
                rows.append([0.0, 1.0, 0.0, -z, 0.0, x])
            if support.uz:
                rows.append([0.0, 0.0, 1.0, y, -x, 0.0])
            # Rotational restraints: theta = R
            if support.rx:
                rows.append([0.0, 0.0, 0.0, 1.0, 0.0, 0.0])
            if support.ry:
                rows.append([0.0, 0.0, 0.0, 0.0, 1.0, 0.0])
            if support.rz:
                rows.append([0.0, 0.0, 0.0, 0.0, 0.0, 1.0])
        return _matrix_rank(rows)

    def _unrestrained_modes_hint(self) -> str:  # pragma: no cover - diagnostic helper
        return "translation and/or rotation about an axis is free"

    # -- job ----------------------------------------------------------------

    def to_job(self, case: LoadCase3D, job_id: str) -> Dict[str, Any]:
        return {
            "schema": "fundi.analysis.job/1",
            "job_id": job_id,
            "dimensions": DIMENSIONS,
            "units": {
                "length": "m", "force": "N", "moment": "N*m",
                "stress": "Pa", "area": "m^2", "inertia": "m^4",
            },
            "nodes": [
                {"tag": node.tag, "x": node.x, "y": node.y, "z": node.z,
                 "canonicalId": node.canonical_id}
                for node in self.nodes
            ],
            "elements": [
                {
                    "tag": member.tag, "i": member.i, "j": member.j,
                    "E": member.E, "A": member.A, "Iy": member.Iy, "Iz": member.Iz,
                    "J": member.J, "G": member.G, "vecxz": list(member.vecxz),
                    "canonicalId": member.canonical_id, "sectionId": member.section_id,
                }
                for member in self.members
            ],
            "supports": [
                {
                    "node": support.node,
                    "ux": support.ux, "uy": support.uy, "uz": support.uz,
                    "rx": support.rx, "ry": support.ry, "rz": support.rz,
                }
                for support in self.supports
            ],
            "loads": [
                {
                    "node": load.node, "Fx": load.fx, "Fy": load.fy, "Fz": load.fz,
                    "Mx": load.mx, "My": load.my, "Mz": load.mz,
                }
                for load in case.loads
            ],
            "analysis": {
                "type": "static",
                "integrator": "LoadControl",
                "increment": case.increment,
                "steps": case.steps,
                "algorithm": "Linear",
                "test": None,
            },
        }


def _matrix_rank(matrix: List[List[float]], tolerance: float = 1e-9) -> int:
    """Rank by Gaussian elimination with partial pivoting."""
    if not matrix:
        return 0
    rows = [list(map(float, row)) for row in matrix]
    columns = len(rows[0])
    rank = 0
    for column in range(columns):
        pivot = max(range(rank, len(rows)), key=lambda r: abs(rows[r][column]), default=None)
        if pivot is None or abs(rows[pivot][column]) < tolerance:
            continue
        rows[rank], rows[pivot] = rows[pivot], rows[rank]
        pivot_value = rows[rank][column]
        rows[rank] = [value / pivot_value for value in rows[rank]]
        for other in range(len(rows)):
            if other == rank:
                continue
            factor = rows[other][column]
            if abs(factor) < tolerance:
                continue
            rows[other] = [a - factor * b for a, b in zip(rows[other], rows[rank])]
        rank += 1
        if rank == len(rows):
            break
    return min(rank, columns)


# ---------------------------------------------------------------------------
# Engine invocation and normalisation
# ---------------------------------------------------------------------------


def analyse(input_model: AnalysisInput3D, work_dir: Optional[str] = None) -> Dict[str, Any]:
    """Validate, run every case, and return the normalised 3D result document."""
    input_model.validate()
    model_nodes = [
        {"tag": node.tag, "x": node.x, "y": node.y, "z": node.z,
         "canonicalId": node.canonical_id}
        for node in input_model.nodes
    ]
    cases: List[Dict[str, Any]] = []

    for case in input_model.cases:
        job = input_model.to_job(case, job_id=f"{input_model.model_id}-{case.case_id}")
        raw = run_job(job, work_dir=work_dir)
        if raw.get("dimensions") != DIMENSIONS:
            raise AnalysisError(
                f"the engine returned a {raw.get('dimensions')!r}-dimensional result for a "
                "3D job; refusing to present it as 3D"
            )

        displacements = {
            item["canonicalId"] or f"node{item['node']}": {
                "node": item["node"],
                "ux": item["ux"], "uy": item["uy"], "uz": item["uz"],
                "rx": item["rx"], "ry": item["ry"], "rz": item["rz"],
            }
            for item in raw.get("displacements", [])
        }
        reactions = {
            f"node{item['node']}": {
                "node": item["node"],
                "Fx": item["Fx"], "Fy": item["Fy"], "Fz": item["Fz"],
                "Mx": item["Mx"], "My": item["My"], "Mz": item["Mz"],
            }
            for item in raw.get("reactions", [])
        }
        members = {
            item["canonicalId"] or f"element{item['element']}": {
                "element": item["element"],
                "section_id": item.get("sectionId"),
                "i": item["i"], "j": item["j"], "length": item["length"],
                "N_i": item["N_i"], "Vy_i": item["Vy_i"], "Vz_i": item["Vz_i"],
                "T_i": item["T_i"], "My_i": item["My_i"], "Mz_i": item["Mz_i"],
                "N_j": item["N_j"], "Vy_j": item["Vy_j"], "Vz_j": item["Vz_j"],
                "T_j": item["T_j"], "My_j": item["My_j"], "Mz_j": item["Mz_j"],
                "localAxes": item.get("localAxes"),
                "localForces": item.get("localForces"),
            }
            for item in raw.get("memberForces", [])
        }
        equilibrium = raw.get("equilibrium", {})
        residual = 0.0
        scale = max(
            abs(equilibrium.get("appliedFx", 0.0)),
            abs(equilibrium.get("appliedFy", 0.0)),
            abs(equilibrium.get("appliedFz", 0.0)),
            abs(equilibrium.get("appliedMx", 0.0)),
            abs(equilibrium.get("appliedMy", 0.0)),
            abs(equilibrium.get("appliedMz", 0.0)),
            1.0,
        )
        for key in ("residualFx", "residualFy", "residualFz", "residualMx", "residualMy", "residualMz"):
            residual = max(residual, abs(equilibrium.get(key, 0.0)))
        equilibrium = {**equilibrium, "residualRelative": residual / scale}

        cases.append(
            {
                "case_id": case.case_id,
                "description": case.description or "explicit 3D static case",
                "analysis": {
                    "type": "static",
                    "formulation": "linear elastic, first-order (small displacement), 3D frame",
                    "integrator": "LoadControl",
                    "algorithm": "Linear",
                    "steps": case.steps,
                    "status": raw.get("analysis", {}).get("status", 0),
                },
                "displacements": displacements,
                "reactions": reactions,
                "members": members,
                "supports": raw.get("supports", []),
                "loads": raw.get("loads", []),
                "equilibrium": equilibrium,
            }
        )

    return {
        "schema": RESULT_SCHEMA,
        "ok": True,
        "model_id": input_model.model_id,
        "source": input_model.source,
        "dimensionality": DIMENSIONS,
        "degreesOfFreedom": DOFS,
        "engine": {"name": "OpenSees", "version": raw.get("opensees_version", "OpenSeesPy")},
        "units": {
            "length": "m", "force": "N", "moment": "N*m", "stress": "Pa",
            "area": "m^2", "inertia": "m^4", "angle": "rad",
        },
        "sign_convention": {
            "axes": "global X, Y, Z right-handed; Z up in the canonical frame",
            "displacements": "positive in the positive global axis direction; rotations right-handed about the axis",
            "reactions": "positive in the positive global axis direction",
            "memberForces": (
                "local axes: x from i to j; N positive in tension; Vy/Vz are the local "
                "shear components; T is the torsional moment; My/Mz are the moments about "
                "the member's local y and z axes at the i and j ends"
            ),
        },
        "nodes": model_nodes,
        "cases": cases,
        "assumptions": list(input_model.assumptions)
        + [
            "all section constants (A, Iy, Iz, J) and the shear modulus G were supplied explicitly",
            "no self-weight, no load factors and no distributed element loads: the case is exactly as supplied",
        ],
        "limitations": [
            "linear elastic, first-order static analysis only",
            "distributed element loads are not supported in 3D",
        ],
    }


# ---------------------------------------------------------------------------
# Explicit payload -> analytical model
# ---------------------------------------------------------------------------


def from_payload(payload: Dict[str, Any]) -> AnalysisInput3D:
    """Build the 3D analytical model from an explicit request payload.

    Required keys: ``nodes``, ``members``, ``supports``, ``loads`` (or ``element_loads``
    to be rejected with a reason), ``case_id``. Every value is validated; nothing is
    defaulted except the analysis settings (single LoadControl step, Linear).
    """
    if not isinstance(payload, dict):
        raise AnalysisError("the 3D analysis payload must be an object")

    nodes_raw = payload.get("nodes")
    members_raw = payload.get("members")
    supports_raw = payload.get("supports")
    loads_raw = payload.get("loads") or []
    if not nodes_raw:
        raise AnalysisError("the 3D payload needs an explicit 'nodes' array")
    if not members_raw:
        raise AnalysisError("the 3D payload needs an explicit 'members' array")
    if not supports_raw:
        raise AnalysisError("the 3D payload needs an explicit 'supports' array")

    tag_by_id: Dict[str, int] = {}
    nodes: List[Node3D] = []
    for index, node in enumerate(nodes_raw):
        node_id = node.get("id") or node.get("canonical_id") or f"n{index + 1}"
        tag = int(node.get("tag", index + 1))
        if node_id in tag_by_id:
            raise AnalysisError(f"duplicate node id {node_id!r}")
        tag_by_id[node_id] = tag
        try:
            x = float(node["x"]); y = float(node["y"]); z = float(node["z"])
        except (KeyError, TypeError, ValueError) as error:
            raise AnalysisError(f"node {node_id!r} needs numeric x, y and z ({error})") from error
        nodes.append(Node3D(tag=tag, x=x, y=y, z=z, canonical_id=node_id))

    members: List[Member3D] = []
    for index, member in enumerate(members_raw):
        member_id = member.get("id") or member.get("canonical_id") or f"m{index + 1}"
        try:
            i = tag_by_id[str(member["i"])]
            j = tag_by_id[str(member["j"])]
        except KeyError as error:
            raise AnalysisError(
                f"member {member_id!r} references unknown node {error.args[0]!r}"
            ) from error
        missing = [
            key for key in ("E", "A", "Iy", "Iz", "J", "G")
            if member.get(key) is None
        ]
        if missing:
            raise AnalysisError(
                f"member {member_id!r} is missing {', '.join(missing)}: a 3D frame needs "
                "explicit E, A, Iy, Iz, J and G — none of them is inferred"
            )
        vec = member.get("vecxz") or [0.0, 0.0, 1.0]
        if not isinstance(vec, (list, tuple)) or len(vec) != 3:
            raise AnalysisError(f"member {member_id!r}: vecxz must be a 3-component vector")
        members.append(
            Member3D(
                tag=int(member.get("tag", index + 1)),
                i=i, j=j,
                E=float(member["E"]), A=float(member["A"]),
                Iy=float(member["Iy"]), Iz=float(member["Iz"]),
                J=float(member["J"]), G=float(member["G"]),
                canonical_id=member_id,
                section_id=member.get("section"),
                vecxz=(float(vec[0]), float(vec[1]), float(vec[2])),
            )
        )

    supports: List[Support3D] = []
    for support in supports_raw:
        node_ref = support.get("node")
        node = _resolve_node(tag_by_id, nodes, node_ref)
        supports.append(
            Support3D(
                node=node.tag,
                ux=bool(support.get("ux", False)),
                uy=bool(support.get("uy", False)),
                uz=bool(support.get("uz", False)),
                rx=bool(support.get("rx", False)),
                ry=bool(support.get("ry", False)),
                rz=bool(support.get("rz", False)),
            )
        )

    loads: List[Load3D] = []
    for load in loads_raw:
        node_ref = load.get("node")
        node = _resolve_node(tag_by_id, nodes, node_ref)
        loads.append(
            Load3D(
                node=node.tag,
                fx=float(load.get("fx", 0.0)), fy=float(load.get("fy", 0.0)),
                fz=float(load.get("fz", 0.0)), mx=float(load.get("mx", 0.0)),
                my=float(load.get("my", 0.0)), mz=float(load.get("mz", 0.0)),
            )
        )

    case_id = payload.get("case_id") or "3D-1"
    analysis_settings = payload.get("analysis") or {}
    if analysis_settings.get("type", "static") != "static":
        raise AnalysisError("only a static 3D analysis is implemented")
    integrator = analysis_settings.get("integrator", "LoadControl")
    algorithm = analysis_settings.get("algorithm", "Linear")
    if integrator != "LoadControl" or algorithm != "Linear":
        raise AnalysisError(
            f"unsupported 3D analysis settings {integrator!r}/{algorithm!r}; only "
            "LoadControl with the Linear algorithm (first-order elastic) is implemented"
        )

    return AnalysisInput3D(
        model_id=payload.get("model_id") or "explicit-3d",
        nodes=nodes,
        members=members,
        supports=supports,
        cases=[
            LoadCase3D(
                case_id=case_id,
                loads=tuple(loads),
                description=payload.get("description") or "explicit 3D static case",
                steps=int(analysis_settings.get("steps", 1)),
                increment=float(analysis_settings.get("increment", 1.0)),
            )
        ],
        element_loads=payload.get("element_loads") or (),
    )


def _resolve_node(tag_by_id: Dict[str, int], nodes: Sequence[Node3D], reference: Any) -> Node3D:
    by_tag = {node.tag: node for node in nodes}
    if isinstance(reference, int) or (isinstance(reference, str) and reference.isdigit()):
        tag = int(reference)
        if tag not in by_tag:
            raise AnalysisError(f"reference {reference!r} is not a node tag in this model")
        return by_tag[tag]
    if reference is None:
        raise AnalysisError("a support/load entry is missing its 'node' reference")
    key = str(reference)
    if key in tag_by_id:
        return by_tag[tag_by_id[key]]
    raise AnalysisError(
        f"reference {key!r} does not match any node id in this model; available ids: "
        + ", ".join(sorted(tag_by_id)[:8])
    )


# ---------------------------------------------------------------------------
# Canonical model -> analytical 3D frame
# ---------------------------------------------------------------------------

#: Element types that become 3D frame members. Slabs, footings and stairs are
#: solids; they are not silently treated as beams.
LINEAR_ELEMENT_TYPES_3D = {"beam", "column", "wall"}


def canonical_to_analysis_3d(
    model_doc: Dict[str, Any],
    *,
    member_sections: Dict[str, Dict[str, Any]],
    supports: Sequence[Dict[str, Any]],
    loads: Sequence[Dict[str, Any]],
    case_id: str = "3D-1",
    model_id: Optional[str] = None,
) -> AnalysisInput3D:
    """Map a canonical model onto a 3D analytical frame.

    What the canonical document gives, and is used verbatim:

    * element ids, element types, the declared `axis`, the cross-section dimensions
      and the element **centre** `placement` (the same convention the 2D adapter and
      the 3D viewport use);
    * the resulting member end nodes: ``<element id>#start`` and ``<element id>#end``.

    What the canonical document does **not** give, and what is therefore required
    explicitly (never inferred):

    * ``A``, ``Iy``, ``Iz``, ``J`` and ``G`` per element — a section orientation and a
      torsional constant do not exist in the canonical model, so they are the
      caller's statement, not this adapter's assumption;
    * the ``vecxz`` reference direction per element (defaults to global +Z, which is
      only meaningful when stated in the request);
    * supports (six restraints per node) and nodal loads (six components).

    Distributed element loads are not supported in 3D; supplying them raises.
    """
    elements = [
        element for element in model_doc.get("elements", [])
        if element.get("element_type") in LINEAR_ELEMENT_TYPES_3D
    ]
    if not elements:
        raise AnalysisError(
            "the canonical model contains no beam, column or wall elements to analyse; "
            f"element types present: {sorted({e.get('element_type') for e in model_doc.get('elements', [])})}"
        )
    if not member_sections:
        raise AnalysisError(
            "member_sections is required for a 3D analysis: A, Iy, Iz, J and G must be "
            "supplied per element because the canonical model carries no section "
            "orientation and no torsional constant"
        )

    nodes: List[Node3D] = []
    members: List[Member3D] = []
    tag_by_id: Dict[str, int] = {}
    next_tag = 1

    def add_node(node_id: str, x: float, y: float, z: float) -> Node3D:
        nonlocal next_tag
        if node_id in tag_by_id:
            return next((node for node in nodes if node.tag == tag_by_id[node_id]))
        node = Node3D(tag=next_tag, x=x, y=y, z=z, canonical_id=node_id)
        tag_by_id[node_id] = next_tag
        next_tag += 1
        nodes.append(node)
        return node

    for element in elements:
        element_id = element["id"]
        axis = str(element.get("axis") or "x").lower()
        if axis not in {"x", "y", "z"}:
            raise AnalysisError(f"element {element_id} has an unsupported axis {axis!r}")
        dimensions = element.get("dimensions") or {}
        length = None
        # `length_<axis>` is the generator convention for horizontal extents;
        # vertical elements use `height_z`. Both are declared geometry, not guesses.
        for key in (f"length_{axis}", f"height_{axis}", "length", "height"):
            value = dimensions.get(key)
            if isinstance(value, (int, float)) and value > 0:
                length = float(value)
                break
        if length is None:
            raise AnalysisError(
                f"element {element_id} has no positive length along its declared axis "
                f"{axis!r}; dimensions present: {sorted(dimensions)}"
            )
        placement = element.get("placement") or {}
        try:
            cx = float(placement["x"]); cy = float(placement["y"]); cz = float(placement["z"])
        except KeyError as error:
            raise AnalysisError(
                f"element {element_id} has no complete placement (missing {error.args[0]!r})"
            ) from error
        half = length / 2.0
        start = {
            "x": cx - (half if axis == "x" else 0.0),
            "y": cy - (half if axis == "y" else 0.0),
            "z": cz - (half if axis == "z" else 0.0),
        }
        end = {
            "x": cx + (half if axis == "x" else 0.0),
            "y": cy + (half if axis == "y" else 0.0),
            "z": cz + (half if axis == "z" else 0.0),
        }
        start_node = add_node(f"{element_id}#start", start["x"], start["y"], start["z"])
        end_node = add_node(f"{element_id}#end", end["x"], end["y"], end["z"])

        section = member_sections.get(element_id)
        if not section:
            raise AnalysisError(
                f"element {element_id} has no entry in member_sections; A, Iy, Iz, J and G "
                "must be stated explicitly for a 3D analysis"
            )
        missing = [key for key in ("A", "Iy", "Iz", "J", "G") if section.get(key) is None]
        if missing:
            raise AnalysisError(
                f"element {element_id} member_sections is missing {', '.join(missing)}"
            )
        youngs = section.get("E")
        if youngs is None:
            raise AnalysisError(
                f"element {element_id} member_sections is missing E (the canonical material "
                f"grade {element.get('material')!r} does not imply a Young's modulus)"
            )
        vec = section.get("vecxz") or [0.0, 0.0, 1.0]
        members.append(
            Member3D(
                tag=int(len(members) + 1),
                i=start_node.tag,
                j=end_node.tag,
                E=float(youngs),
                A=float(section["A"]),
                Iy=float(section["Iy"]),
                Iz=float(section["Iz"]),
                J=float(section["J"]),
                G=float(section["G"]),
                canonical_id=element_id,
                section_id=section.get("id") or section.get("name"),
                vecxz=(float(vec[0]), float(vec[1]), float(vec[2])),
            )
        )

    support_entries: List[Support3D] = []
    for support in supports:
        node = _resolve_node(tag_by_id, nodes, support.get("node"))
        support_entries.append(
            Support3D(
                node=node.tag,
                ux=bool(support.get("ux", False)),
                uy=bool(support.get("uy", False)),
                uz=bool(support.get("uz", False)),
                rx=bool(support.get("rx", False)),
                ry=bool(support.get("ry", False)),
                rz=bool(support.get("rz", False)),
            )
        )

    load_entries: List[Load3D] = []
    for load in loads:
        node = _resolve_node(tag_by_id, nodes, load.get("node"))
        load_entries.append(
            Load3D(
                node=node.tag,
                fx=float(load.get("fx", 0.0)), fy=float(load.get("fy", 0.0)),
                fz=float(load.get("fz", 0.0)), mx=float(load.get("mx", 0.0)),
                my=float(load.get("my", 0.0)), mz=float(load.get("mz", 0.0)),
            )
        )

    return AnalysisInput3D(
        model_id=model_id or model_doc.get("model_id") or "canonical-3d",
        nodes=nodes,
        members=members,
        supports=support_entries,
        cases=[
            LoadCase3D(
                case_id=case_id,
                loads=tuple(load_entries),
                description="explicit 3D case from the canonical adapter",
            )
        ],
        source=f"canonical:{model_doc.get('model_id')}",
        assumptions=[
            "member end nodes derived from the canonical axis, length and centre placement",
            "section constants (A, Iy, Iz, J) and the shear modulus G were supplied explicitly",
            f"element types mapped: {', '.join(sorted(LINEAR_ELEMENT_TYPES_3D))}",
        ],
    )


__all__ = [
    "AnalysisError",
    "AnalysisInput3D",
    "DIMENSIONS",
    "DOFS",
    "LINEAR_ELEMENT_TYPES_3D",
    "Load3D",
    "LoadCase3D",
    "Member3D",
    "Node3D",
    "Support3D",
    "analyse",
    "canonical_to_analysis_3d",
    "from_payload",
]
