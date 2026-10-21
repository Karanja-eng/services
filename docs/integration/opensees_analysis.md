# Task 5 — Structural analysis with OpenSees

Status: **implemented and verified** for 2D linear-elastic frames, with three benchmarks
checked against closed-form solutions. Task 5.5 (design-check bridge) delivers a validated
*payload*, deliberately not a code check. Limitations in §8.

---

## 1. Audit of the existing engineering model (5.1)

### What the canonical model already provides

| Needed for analysis | Present? | Where |
|---|---|---|
| Stable element ids | **yes** | `canonical.py` (`beam.beam`, `stair.flight`, …) |
| Member geometry (length, section dims) | **yes** | `element.dimensions` in metres |
| Placement / coordinates | **yes** | `element.placement` (Z-up, metres) |
| Material grade / `fck` | **partly** | `element.material`, `properties.fck_MPa` |
| Section properties `A`, `Iz` | **no** | must be derived from geometry (allowed, geometric) or supplied |
| Elastic modulus `E` | **no** | must be supplied explicitly |
| Supports / restraints | **no** | must be supplied explicitly |
| Loads / load cases / combinations | **no** | must be supplied explicitly |
| Member connectivity (node graph) | **no** | derived from member endpoints only for a single-member model |

**Consequence, applied in code:** `canonical_to_analysis()` *requires* `E`, supports and
loads as arguments and raises `AnalysisError` naming what is missing. It never assumes a
UDL, a restraint or a section. This is the "reject incomplete analysis requests rather
than silently assigning unsafe defaults" rule from the brief.

### Existing analysis code found in the repository (do not duplicate it)

| Module | What it is |
|---|---|
| `src/Backend/calculations/Beams/moment_distribution_backend.py` (35 KB, 939 lines) | a working **Hardy Cross moment-distribution** solver: `FrameMD`/`MemberMD`/`JointMD`/`LoadMD` inputs, `MomentDistributionSolver` with FEM, stiffness and distribution factors, iteration, support reactions, and per-member shear/moment/deflection diagram generation |
| `src/Backend/Databases/models.py::BeamAnalysis` | persistence for analysis output: `analysis_method` (`'three_moment'`, `'moment_distribution'`), `support_moments`, `shear_forces`, `reactions` (JSONB) |
| `src/Backend/calculations/tall_framed/*` | frame analysis and building-level modules |
| `src/Backend/calculations/steel_design/*` | steel analysis/design modules (several) |

So the repository **already had a 2D analysis engine with a result contract**. The
OpenSees adapter in this task therefore had to fit that shape rather than invent one:
`MomentDistributionResponse` returns `final_moments`, `support_reactions`,
`shear_force_data`, `moment_data`, `deflection_data`, `convergence_achieved` — the
OpenSees result contract below returns the equivalent quantities (displacements,
reactions, member end forces) keyed by canonical id, which is what the existing design
and visualisation layers need.

**Not done:** that moment-distribution engine has *not* yet been cross-validated against
OpenSees. That is the natural next step for Task 5.4/5.5 confidence, and it is listed in
§9 rather than claimed here.

### OpenSees availability (measured)

| Item | Finding |
|---|---|
| Package | `openseespy` **3.8.0.0** (the PyPI project also ships `openseespywin` with the Windows binary) |
| Version reported by the engine | `ops.version()` → **3.8.0** |
| Wheel tags | `openseespy-3.8.0.0-py3-none-any.whl` (2.8 KB stub) + `openseespywin-3.8.0.0-py3-none-win_amd64.whl` (6.5 MB) |
| **Hard constraint** | the extension links **`python312.dll`**. The backend interpreter is 3.13, so `import openseespy` fails there with `DLL load failed`. It runs under **Python 3.12** |
| Installed how | `pip` **cannot** be used in this sandbox: it fails with `PermissionError: [Errno 13] ... *.whl.metadata`, a pip-internal step, not a package problem. `scripts/install_openseespy.py` downloads the wheels from the PyPI JSON API and extracts them into `.venv-opensees`; the interpreter is `.venv-ifc`'s sibling 3.12 (`C:\Users\HP\miniconda3\envs\yolov8\python.exe` here) |

Because of that, the engine runs as a **separate process** exchanging JSON, which is also
the "explicitly designed backend service" pattern the brief allows:

```
backend (Python 3.13, FastAPI)
    │  job JSON  (nodes, elements + E/A/Iz, supports, loads, analysis settings)
    ▼
scripts/analysis/run_opensees.py   (Python 3.12 + OpenSeesPy 3.8.0)
    │  results JSON (displacements, reactions, member end forces, equilibrium)
    ▼
src/Backend/cad_ifc/analysis.py    (validation, mapping, closed-form references)
```

Override the interpreter with `FUNDI_OPENSEES_PYTHON`. When none is found,
`opensees_python()` raises with the reason — the analysis is never silently skipped.

---

## 2. Unit, coordinate and sign conventions

Every input and result carries this block, so no consumer has to guess:

```json
{"length":"m","force":"N","moment":"N*m","stress":"Pa","area":"m^2","inertia":"m^4","angle":"rad"}
```

* **Coordinates**: metres. The canonical frame is Z-up; the 2D analytical frame is **XY**
  (X horizontal, Y vertical in-plane), which is this engine's 2D convention.
* **Supports**: `ux`, `uy`, `rz` booleans — explicit, never defaulted.
* **Loads**: nodal (`Fx`, `Fy`, `Mz`) and element (`wx`, `wy` in **local** axes, N/m).
  For a member drawn i→j, local x runs i→j and local y is 90° counter-clockwise, so a
  **downward** UDL on a horizontal member to the right is **`wy` negative**. That
  convention is *verified* against closed-form deflection, not assumed.
* **Displacements**: positive along the positive axis; rotation positive counter-clockwise.
* **Reactions**: positive along the positive axis (an upward reaction under downward load
  is positive).
* **Member forces** (`N_i, V_i, M_i, N_j, V_j, M_j`): the engine's local end forces, N in
  tension positive. The result carries this text so a design check reads it too.
* **Analysis type**: static, **linear elastic, first-order** only. `analyser` rejects any
  other integrator or algorithm instead of pretending.

---

## 3. The adapter (5.2)

`analysis.py` defines the analytical model independently of CAD, IFC and rendering:

```
AnalysisInput(model_id, nodes, members, supports, cases, source, assumptions)
   ├── AnalysisNode(tag, x, y, canonical_id)
   ├── AnalysisMember(tag, i, j, E, A, Iz, canonical_id, section_id)
   ├── AnalysisSupport(node, ux, uy, rz)
   └── LoadCase(case_id, loads, element_loads, description, steps, increment)
```

`AnalysisInput.validate()` rejects: no nodes/members/supports/load cases, duplicate tags,
unknown node references, zero-length members, non-positive `E`/`A`/`Iz`, loads on unknown
nodes/elements, and **insufficient restraint**. The restraint check is a rank test on the
three rigid-body modes `(tx, ty, θ)` — the constraint rows are `[1,0,-y]`, `[0,1,x]`,
`[0,0,1]` and their rank must be 3. (An earlier "supports must not be collinear" test
wrongly rejected a simply supported beam; the rank test is correct and is covered by a
test.)

`canonical_to_analysis(model_doc, *, youngs_modulus_pa, supports, loads, element_loads,
member_sections, subdivisions)` is the canonical → analytical adapter:

* takes every `beam`/`column` element from the canonical model;
* nodes from member endpoints, de-duplicated by rounded coordinates;
* `A = b·h`, `Iz = b·h³/12` derived from the canonical section when `member_sections`
  omits the element (recorded in `assumptions` as a **gross geometric property**, not a
  design check); `E` is always explicit;
* `subdivisions` splits each member into equal elements (adding interior nodes) so
  interior results such as midspan deflection exist; recorded as an assumption;
* element ids become analytical ids: `beam.beam` → members `beam.beam#e0…#e3` and nodes
  `beam.beam#n0…#n4`, so **every result maps back to the canonical element**;
* rejects a member whose axis is not horizontal (`axis != "x"`) rather than silently
  straightening it — the canonical model has no in-plane orientation for inclined members
  yet.

`to_job()` serialises one load case to the job schema; `run_job()` executes the 3.12
process and validates the result schema; `analyse()` loops the cases, normalises results
into dictionaries keyed by **canonical id**, and computes the equilibrium residuals.

---

## 4. Benchmarks against closed-form solutions (5.3)

Properties: `E = 210 GPa`, `A = 0.01 m²`, `Iz = 1.0e-4 m⁴`, `L = 6 m`, `w = 20 kN/m`,
`P = 50 kN`. These are round numbers so every reference value can be audited by hand.

| Case | Reference (closed form) | Engine | Match |
|---|---|---|---|
| Simply supported, UDL | `R = wL/2 = 60 000 N` | 60 000.000000 N (both) | exact |
| | `M_mid = wL²/8 = 90 000 Nm` | 90 000.000 Nm (from reactions; member `M_j`/`M_i`) | exact |
| | `δ_mid = 5wL⁴/384EI = 16.071429 mm` | 16.071429 mm downward | exact |
| Fixed–fixed, UDL (deg. 3) | `R = wL/2 = 60 000 N` | 60 000.000000 N | exact |
| | `M_end = wL²/12 = 60 000 Nm` | ±60 000.000000 Nm at both fixings | exact |
| | `δ_mid = wL⁴/384EI = 3.214286 mm` | 3.214286 mm | exact |
| Cantilever, tip load | `δ_tip = PL³/3EI = 171.428571 mm` | 171.428571 mm | exact |
| | `θ_tip = PL²/2EI = 0.042857143 rad` | 0.042857143 rad | exact |
| | `M_fixed = PL = 300 000 Nm` | 300 000.000000 Nm | exact |

Global equilibrium residual (relative to the applied load): **3.2e-16** (simply
supported) and **0.0** (fixed–fixed) — i.e. floating-point exact.

Two engine defects were found and fixed while establishing this, both recorded because
they would each have produced plausible-looking wrong results:

1. **`nodeReaction()` returns 0.0 unless `ops.reactions()` is called after `analyze()`.**
   Without that call every support reaction reads zero, which looks like a valid
   zero-reaction analysis.
2. **Element loads must be integrated for equilibrium.** `appliedFy` initially only summed
   nodal loads, so a UDL case reported "0 applied, 60000 reacted". The runner now computes
   each element-load resultant (length × global intensity, acting at mid-length) and
   includes its moment about the origin.

---

## 5. Result mapping (5.4)

Results are returned per case as:

```jsonc
{
  "displacements": { "<canonical node id>": {"node":1,"ux":..,"uy":..,"rz":..} },
  "reactions":     { "node1": {"Fx":..,"Fy":..,"Mz":..} },
  "members":       { "<canonical member id>": {"i":..,"j":..,"length":..,
                                              "N_i":..,"V_i":..,"M_i":..,
                                              "N_j":..,"V_j":..,"M_j":..} },
  "equilibrium":   {"appliedFy":..,"reactionFy":..,"residualRelative":..}
}
```

`test_results_are_mapped_by_canonical_id_not_by_order` supplies the same structure with
the members in the opposite order and different element tags, and asserts that the values
keyed by canonical id are unchanged and that connectivity did not move. That is the
"results cannot be attached to the wrong member when element ordering changes"
requirement, tested rather than argued.

A failed run raises `AnalysisError` and returns **no** results: `analyse()` never yields a
partial set, and the engine process exits non-zero with the reason
(`test_failed_engine_run_raises_and_returns_no_results`).

---

## 6. Design-check bridge (5.5) — payload only, no code check claimed

`design_check_payload(results, case_id=…, member_id=…, section=…)` validates and packages
one member for an existing deterministic design module. It requires: results marked
successful, the case present, the member present, all six end forces finite, and all
displacement components finite. It returns the member forces, an envelope
(`shear_max_abs_N`, `moment_max_abs_Nm`, `axial_max_abs_N`), the units and sign
convention, and — importantly — `design_checks_performed: []` plus the note *"Analysis
results only. No code check has been run and no compliance is claimed."*

If `section` is omitted the payload is returned with `incomplete: true` and a reason
("section properties were not supplied, so no resistance can be compared") rather than
failing silently or inventing a capacity. **No EC2 or UK NA check is implemented or
claimed in this task** — the existing design modules remain the only place code checks
live, and no LLM or heuristic produced any load, force or capacity value.

---

## 7. Tests executed

```
.venv-ifc\Scripts\python.exe test_cad_ifc_analysis.py     →  11/11 pass
```

| Test | Verifies |
|---|---|
| `test_opensees_interpreter_is_available` | the 3.12 interpreter is found; a missing one raises with the reason |
| `test_engine_reports_its_version_and_dimensions` | status 0, SI units block, limitations stated |
| `test_simply_supported_udl_matches_closed_form` | connections, BCs, equilibrium, reactions, midspan δ, midspan M, zero end moments at simple supports |
| `test_cantilever_tip_load_matches_closed_form` | δ, θ, reaction, fixing moment, member end moment and shear |
| `test_fixed_fixed_udl_matches_closed_form` | indeterminate case: reactions, fixing moments, δ, member end moments |
| `test_results_are_mapped_by_canonical_id_not_by_order` | permuted element order cannot move results |
| `test_canonical_model_becomes_a_verifiable_frame` | real RC beam → adapter → engine matches closed form; canonical ids preserved |
| `test_design_bridge_requires_a_complete_result` | bridge validates, reports incomplete, refuses unknown case/member |
| `test_incomplete_input_is_rejected_not_defaulted` | no supports / no cases / non-positive `Iz` / insufficient restraint each rejected by name |
| `test_failed_engine_run_raises_and_returns_no_results` | unsupported integrator fails loudly |
| `test_analysis_is_repeatable` | identical values on a second run |

Existing suites are untouched by this work and remain green
(`test_cad_ifc_poc.py` 22/22, `test_cad_ifc_engineering.py` 40/40, `test_cad_ifc_api.py` 20/20,
`node test/solid-septic.test.mjs` 13/13).

---

## 8. Limitations (explicit, not hidden)

1. **2D only** (3 dof/node). A 3D request is rejected; no 2D result is presented as 3D.
2. **Linear elastic, first-order only.** No P-Delta, no material or geometric
   non-linearity, no buckling analysis. The result states this in `limitations`.
3. **Static load cases only.** No modal, dynamic, time-history or pushover analysis.
4. **No load combinations.** One case per run; a combination must be supplied as its own
   explicit case (no implicit factors).
5. **No self-weight.** Nothing is added unless supplied.
6. **Canonical adapter supports horizontal members only** (`axis == "x"`); inclined and
   vertical members have no defined in-plane orientation in the canonical model yet.
7. **`A` and `Iz` may be derived from gross geometry**; if a cracked/effective stiffness or
   a real section property is wanted, pass `member_sections`. `E` is always explicit.
8. **The existing moment-distribution engine is not yet cross-validated against OpenSees.**
9. **No API endpoints yet.** The adapter is a Python module with a test suite; it is not
   wired into `cad_ifc/router.py`, and nothing is exposed to the frontend.
10. **OpenSeesPy requires Python 3.12 on Windows** and is installed outside pip in this
    environment; deployment must provide that interpreter (or a Linux build, where the
    wheels are per-CPython but a 3.12 wheel is normally published).

---

## 9. Remaining work

1. Cross-validate OpenSees against the existing moment-distribution engine on a shared
   frame (two independent engines, same structure) and record the differences.
2. Add `POST /api/cad-ifc/analysis` + result persistence (the `BeamAnalysis` table already
   has `analysis_method`, `support_moments`, `shear_forces`, `reactions`).
3. Implement load combinations explicitly (named cases with factors, no defaults).
4. Extend `canonical_to_analysis` to frames: vertical columns, connectivity between
   members, and storey-level supports — this needs orientation data the canonical model
   does not carry yet.
5. Wire validated results into the existing design modules and mark incomplete checks.

---

## 10. Commands

```powershell
# one-time: fetch OpenSeesPy wheels without pip (pip's metadata step is blocked here)
.venv-ifc\Scripts\python.exe scripts\install_openseespy.py

# run the analysis test suite (engine is started as a 3.12 subprocess)
.venv-ifc\Scripts\python.exe test_cad_ifc_analysis.py

# point the adapter at a different 3.12 interpreter
$env:FUNDI_OPENSEES_PYTHON = "C:\path\to\python3.12.exe"

# analyse the canonical beam through the adapter (from Python)
.venv-ifc\Scripts\python.exe -c "import sys,json; sys.path.insert(0,'src/Backend'); from cad_ifc import analysis, rc_model; m=rc_model.build_model('beam'); e=m['elements'][0]; a=analysis.canonical_to_analysis(m, youngs_modulus_pa=210e9, supports=[{'node':e['id']+'#start','ux':True,'uy':True},{'node':e['id']+'#end','uy':True}], element_loads=[{'element':e['id'],'wy':-20000}], subdivisions=4); print(json.dumps(analysis.analyse(a)['cases'][0]['equilibrium'], indent=2))"
```
