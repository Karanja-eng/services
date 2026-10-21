# Task E — Visualising validated analysis results

Status: **the results contract and the 2D/3D view-model adapters are implemented and
tested; the React wiring is not done.** That split is deliberate and is the main thing to
review here — §6 lists exactly what remains before either view can display a real run.

---

## 1. Audit of the existing visualisation workflow (E1)

What exists today, and what it actually shows.

| Layer | Found | Shows analysis results? |
|---|---|---|
| Route shell | `src/components/engineering_appp.jsx` — `/structural/manual/{beam,column,stairs,retaining,foundation,wall,slabs,steel}`, `/structural/manual/eurocode_structural_app`, `/drawing`, `/visualise` | no |
| 2D authoring | `src/components/Drawings/cad_drawing.jsx` (React Konva, 90 KB) | no — original geometry only |
| 3D | `src/components/Drawings/visualise_component.jsx` (React Three Fiber) with 12 QS + 21 RC generators | no — original geometry only |
| Analysis (2D) | `src/Backend/calculations/Beams/moment_distribution_backend.py` — Hardy Cross solver; returns `final_moments`, `support_reactions`, `shear_force_data`, `moment_data`, `deflection_data`, `convergence_achieved` | it *computes* diagrams (sampled points per member) but the frontend components found do not render them |
| Analysis persistence | `src/Backend/Databases/models.py::BeamAnalysis` — `analysis_method`, `support_moments`, `shear_forces`, `reactions` (JSONB) | stores them |
| Analysis → design | `src/components/SteelDesign/SteelAnalysisAdapter.js` — `extractMemberForces(analysisResults, memberId)`, `prepareBeamDesignRequest`, `prepareColumnDesignRequest`, `designAllSteelMembers` | **consumes** results numerically |

### Two defects found in the existing adapter

1. **Unknown becomes zero.** `extractMemberForces` returns
   `{maxMoment: 0, maxShear: 0}` when `analysisResults.diagrams` is missing or the member
   is not found. A downstream design check cannot distinguish "no diagram was supplied"
   from "the member carries no moment", which is exactly the failure mode Task E2 warns
   about. The new view model raises instead (§3) and a test asserts the difference.
2. **Implicit units.** `prepareBeamDesignRequest` comments "Convert moment from kNm to
   equivalent UDL" and applies `w = 8M/L²` without converting, so it assumes the incoming
   moment is in **kN·m**. The OpenSees results in this repository are in **N·m**. Nothing
   in the existing contract states which; the new contract carries an explicit
   `units` block and never converts silently.

### Features that are missing (not assumed to exist)

No component was found that renders a shear-force, bending-moment or axial-force diagram,
a deformed shape, a reaction arrow, a result contour or a member-level result table. The
2D and 3D layers currently show **undeformed geometry only**. That is the gap Task E is
about, and it is larger than "connect the numbers to an existing chart".

---

## 2. The shared analysis-results contract (E2)

One normalised document type is produced by the analysis adapter and consumed by the view
adapters:

```jsonc
{
  "schema": "fundi.analysis.results/1",
  "ok": true,
  "model_id": "beam-benchmark",
  "engine": {"name": "OpenSees", "version": "OpenSeesPy"},
  "units": {"length":"m","force":"N","moment":"N*m","stress":"Pa",
            "area":"m^2","inertia":"m^4","angle":"rad"},
  "sign_convention": {"axes":"…","displacements":"…","reactions":"…","memberForces":"…"},
  "nodes": [{"tag":1,"x":0.0,"y":0.0,"canonicalId":"beam.node.start"}],
  "cases": [{
    "case_id": "udl",
    "analysis": {"type":"static","formulation":"linear elastic, first-order","status":0},
    "displacements": {"<canonical node id>": {"node":1,"ux":…,"uy":…,"rz":…}},
    "reactions":     {"node1": {"node":1,"Fx":…,"Fy":…,"Mz":…}},
    "members":       {"<canonical member id>": {"element":1,"i":1,"j":2,"length":3.0,
                                                "N_i":…,"V_i":…,"M_i":…,
                                                "N_j":…,"V_j":…,"M_j":…}},
    "equilibrium":   {"appliedFy":…,"reactionFy":…,"residualRelative":…},
    "diagrams":      [/* optional sampled points, when the engine supplies them */]
  }],
  "assumptions": ["…"],
  "limitations": ["2D frame …", "linear elastic, first-order …"]
}
```

Design decisions:

* **Units and sign conventions travel with the data**, so no consumer guesses. The
  existing kN·m assumption cannot cross this boundary unnoticed.
* **Stable ids everywhere**: nodes and members are keyed by canonical id, with the engine
  tag kept alongside for traceability.
* **`diagrams` is optional.** Presence means the engine sampled interior values; absence
  means only end forces are known. The view model records which case it is in and warns —
  it never interpolates a moment diagram, because a linear interpolation between end
  moments would understate (or invent) a sagging maximum.
* **Unavailable ≠ zero.** A missing case, member or force raises
  `ViewModelError`/`AnalysisError`. Zero is only ever a real computed zero.
* `nodes` was added to the contract during this task because the view adapters need
  coordinates while `displacements` are keyed by node id; a test caught the omission
  against a **real** engine result rather than the fixture.

The existing Hardy Cross engine already returns sampled `moment_data`/`shear_force_data`
per member; mapping those into `cases[].diagrams` is a straightforward adapter and is
listed in §7, not claimed.

---

## 3. The 2D and 3D view-model adapters (E3, E4)

`src/analysis/viewModel.mjs` — deliberately **React-free**, so its geometry can be tested
numerically without a browser. `buildViewModel(results, {caseId, deformationScale,
colourBy})` returns:

| Field | For the 2D view | For the 3D view |
|---|---|---|
| `nodes[].position` / `.display` | undeformed and display-deformed coordinates | same, placed on the XY plane |
| `nodes[].displacement` | the **stored** `ux/uy/rz`, untouched by the scale | same |
| `members[].undeformed` / `.deformed` | two-point polylines for overlay | same, extruded by the scene |
| `diagrams.{shear,moment,axial}` | per member `points[{x,value}]`, `maxAbs`, `min/maxValue`, `source`, `interpolation` | same data drives contours |
| `reactions[]` | position, `forces{Fx,Fy,Mz}`, `magnitude`, unit `direction` | reaction arrows |
| `colouring` | `key`, `unit`, `max`, per-member `{value, normalised, colour}`, legend stops | member colour + legend |
| `deformation` | `scale`, `exaggerated`, note that display only is affected | same |

Guarantees, each covered by a test:

* **Scale affects display only.** `nodes[].display` moves with the scale;
  `nodes[].displacement` does not. `deformation.exaggerated` and the note let a view label
  an exaggerated shape honestly.
* **No fabricated diagrams.** End-force-only members carry
  `source: 'end-forces-only'`, `interpolation: 'none'` and a warning naming the member;
  shear/axial use `interpolation: 'linear'` (exact for a prismatic member under uniform or
  no load) and say so.
* **Reactions keep their magnitude**; `direction` is a unit vector, never a scaled force.
* **2D results are labelled 2D** — `dimensionality: 2` and the engine's formulation are
  part of the view model, so a 2D result cannot be presented as a 3D analysis.
* Colour mapping is bounded (values clamped to `[0,1]`, never extrapolated) with a legend.
* Unknown case, empty case, non-finite force or invalid scale **raise**.

---

## 4. Separation of analysis, design and visualisation (E5)

```
structural inputs ──► analysis adapter ──► engine ──► normalised results
                                                          │
                                          ┌───────────────┴───────────────┐
                                          ▼                               ▼
                                   view model (2D/3D)            design-check payload
                                   read-only, no checks          (validated, no capacity)
```

* The view model performs **no** engineering calculation: it re-arranges forces already
  computed, and it refuses to interpolate where that would invent a value.
* The design bridge (`analysis.design_check_payload`) returns member forces plus an
  envelope and `design_checks_performed: []` — it never produces a capacity, utilisation or
  compliance statement. Bending moment stays an analysis result; required reinforcement
  remains the output of the existing deterministic design modules only.
* Nothing in the frontend recomputes an engineering value.

---

## 5. Synchronisation design (E6) — specified, not implemented

The shared keys are already in place to make this work: **one results document per run**
(`model_id` + `schema`), **one selected case id**, and **canonical member/node ids** used by
both views. A `memberId` selected in either view resolves through the same id. Because the
views would hold no copy of the results (only the view model derived from them), changing
the case or the scale cannot modify the engineering model.

Not implemented: there is no shared state container, no selection event bus and no route.
The existing application uses `useState` per screen (no store is wired despite `zustand`
being a dependency), so the integration should pass the results document and the selected
`caseId` down as props rather than introducing a new state system.

---

## 6. What is NOT done (read this before assuming a working view)

**Added since the adapters, and verified:**

* `POST /api/cad-ifc/analysis` — runs the analysis for a canonical model and returns the
  normalised results document. `GET /api/cad-ifc/analysis/engine` reports whether the
  engine interpreter is available. Covered by 4 new tests in `test_cad_ifc_api.py`
  (**24/24** total), including a real engine run through HTTP whose reactions match
  `wL/2` and whose equilibrium residual is below 1e-9.
* `src/components/interop/AnalysisDiagram2D.jsx` — an SVG renderer driven **only** by the
  view model: undeformed + deformed geometry, per-member colouring, shear/moment/axial
  diagram polylines (dashed when the interior is unknown), reaction arrows with magnitude,
  case selector, deformation-scale slider, legend and diagram warnings. It performs no
  calculation and stores no results.
* `src/analysis/viewModel.mjs` now also carries `supports` (restraints exactly as supplied)
  so pin/roller/fixed markers are not inferred from reactions.

**Still not done:**

1. **The 2D view is mounted but never rendered in a browser.** It is the
   **Analysis (2D)** tab of the interoperability workbench, with a form that requires
   `E` (GPa), a UDL (kN/m), a support scheme and a subdivision count before Run is enabled —
   nothing is prefilled with an engineering value. It **compiles** (verified: the component
   is present in the production bundle as `151.91fc6f65.chunk.js`, 12 KB, from a build that
   reported *The build folder is ready*), but **no rendering has been executed or
   inspected**, because no browser automation exists in this environment.
2. **Build warnings are pre-existing.** `npm run build` reports *Compiled with warnings*
   from three MLightCAD export-map probes (`./dist/cad-simple-viewer.js`,
   `./dist/cad-simple-viewer.umd.cjs`, `./dist/mtext-renderer-worker.js` are not in that
   package's `exports`). These are not from this task and the build succeeds.
3. **No contour rendering in 3D.** Per-member colours and a legend are computed; no
   material assignment or 3D legend exists, and the R3F scene is untouched.
4. **No sampled moment diagrams from OpenSees.** The engine reports end forces only, so
   the moment diagram warns about a possible unrepresented interior maximum unless members
   are subdivided (the tab defaults to 4 elements, which does capture a midspan maximum).
5. **Hardy Cross results are not yet mapped** into `cases[].diagrams`, so the two engines do
   not share a displayed pipeline.
6. **No 2D↔3D selection sync** (E6) — the keys exist, the wiring does not.
7. **No section/material input beyond `E`.** The tab derives `A`/`Iz` from the canonical
   gross section (recorded as an assumption by the adapter); the API accepts an explicit
   `member_sections` override, but the tab does not expose it.

Because of 1 and 6, **no claim is made that analysis results have been seen in a view.**
What is verified: the results contract is served over HTTP (24/24 API tests), the view model
is numerically correct (13/13 tests, one against a real engine run), and the component
compiles into the bundle.

---

## 7. Tests actually executed (E7)

```
node test/analysis-viewmodel.test.mjs        →  13/13 pass
```

| Test | Covers |
|---|---|
| maps members and diagrams by canonical id | 2, 3 (identity) |
| puts the correct ordinates at member ends | 3 (values: 0 at simple supports, ±90 000 N·m at midspan/list) |
| never fabricates an interior moment maximum | 3, 8 (unavailable reported, not interpolated) |
| uses sampled diagrams when provided | 2, 3 |
| applies the deformation scale to display only | 5 (deformed display vs stored results) |
| builds reaction directions without scaling the force | 8 (units/conventions) |
| selects the requested load case and rejects unknown ones | 6 (case change) |
| refuses to turn missing results into zeros | 9 (vs the existing adapter's behaviour) |
| rejects an invalid deformation scale rather than defaulting | 5 |
| colours members by the selected result with a legend | 4 (contours/legend data) |
| colour ramp is bounded and monotonic | 4 |
| exposes deformed and undeformed geometry for both views | 3, 4 |
| reports the engine results file when one is available | end-to-end: consumes a **real** OpenSees normalised document (`verified against engine result: beam-benchmark-udl.analysis.json (2 members, case udl)`) |

Verification levels, stated plainly:

* **Numerical correctness**: separate, in `test_cad_ifc_analysis.py` (11/11) — three
  benchmarks match closed form exactly.
* **View-data correctness**: the 13 tests above.
* **Rendering correctness**: **not tested**, because no rendering was implemented. The
  existing 2D/3D workflows were confirmed untouched, not re-verified visually.

Regression: `test_cad_ifc_poc.py` 22/22, `test_cad_ifc_engineering.py` 40/40,
`test_cad_ifc_api.py` 20/20, `test_cad_ifc_analysis.py` 11/11, `node test/solid-septic.test.mjs`
13/13, `node test/analysis-viewmodel.test.mjs` 13/13.

---

## 8. Next steps, in order

1. Map Hardy Cross `moment_data`/`shear_force_data` into `cases[].diagrams` so both engines
   feed one contract (and cross-validate them).
2. Add a 2D diagram component (SVG or Konva) driven **only** by `diagrams` — start with
   shear and moment, then axial, using `interpolation` and `warnings` from the view model.
3. Add the deformed overlay and reaction arrows to the same component; wire the scale and
   the undeformed/deformed toggle to `buildViewModel(..., {deformationScale})`.
4. Add a `POST /api/cad-ifc/analysis` endpoint that returns the normalised document.
5. Add member colouring + legend to the R3F scene from `colouring`, labelled 2D.
6. Wire member selection 2D ↔ 3D through the shared canonical member id.
