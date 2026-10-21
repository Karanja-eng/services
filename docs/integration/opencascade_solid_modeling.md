# Task 4 — Solid modelling with OpenCascade.js

Status: **implemented and verified** for the septic tank generator, with two
limitations stated plainly in §7 (kernel STEP re-import, and one source-data
anomaly). Everything numeric below was measured in this checkout.

---

## 1. Kernel build selected

| Item | Value |
|---|---|
| Package | **`opencascade.js@1.1.1`** (pinned exact in `package.json`) |
| Licence | **LGPL-2.1-only** (recorded from the package metadata) |
| Build | prebuilt **full** OCCT build: `dist/opencascade.wasm.js` (0.32 MB) + `dist/opencascade.wasm.wasm` (**62.81 MB**) |
| Bindings | **19,910** symbols at runtime |
| Capability list | `dist/Supported APIs.md` (0.33 MB) ships with the package |

### Why this build

* The alternative tag line `2.0.0-beta.*` unpacks to **244 MB** for the same
  dependency; 1.1.1 is 66.7 MB and already contains the full OCCT API.
* The package's `Supported APIs.md` was checked **before** writing any code. The
  classes this task needs are all present: `BRepPrimAPI_MakeBox`,
  `BRepPrimAPI_MakeCylinder`, `BRepAlgoAPI_Cut`, `BRepAlgoAPI_Fuse`,
  `BRepAlgoAPI_Common`, `BRepCheck_Analyzer`, `BRepGProp`/`GProp_GProps`,
  `BRepBndLib`, `BRepBuilderAPI_Transform`, **`STEPControl_Writer`**,
  **`STEPControl_Reader`**. So STEP export *is* supported by the selected build —
  no fallback exporter was needed.
* LGPL-2.1: the WASM is used as a library at build/run time, not modified. This is
  acceptable for internal use; redistributing the OCCT binary carries the usual
  LGPL obligations (noted for the release decision, not a blocker here).

### Three bundler assumptions that had to be handled

The package's glue is written for a bundler, not for Node:

1. `dist/opencascade.wasm.js` ends with `export default opencascade;` **but uses
   `__dirname`**, so neither module system alone can load it. `src/solid/ocKernel.mjs`
   copies it once, rewrites the default export to `module.exports`, and loads it
   through `createRequire`.
2. Its loader calls `fetch()` for the `.wasm`, which cannot work for a local file in
   Node. The binary is handed over as `wasmBinary`.
3. Overloaded C++ constructors get numeric suffixes in declaration order, and **the
   numbering is not consistent between classes** (`gp_Pnt_3` is `(x,y,z)`, but
   `gp_Dir_2` and `gp_Vec_3` are copy constructors). Rather than guess, `Kernel._pick`
   tries the candidates, caches the winner and records it.

### Overloads actually resolved (measured, printed by the test)

```
gp_Pnt        gp_Pnt_3                     makeBox      MakeBox_2(pnt,dx,dy,dz)
gp_Dir        gp_Dir_4                     cut          BRepAlgoAPI_Cut_3(a,b)
gp_Ax2        gp_Ax2_3(pnt,dir)            fuse         BRepAlgoAPI_Fuse_3(a,b)
gp_Ax1        gp_Ax1_2(pnt,dir)            isValid      Analyzer(shape,true).IsValid_1(shape)
gp_Vec        gp_Vec_4                     makeTranslation gp_Vec(x,y,z)+SetTranslation_1
bndBoxGet     CornerMin/CornerMax          makeCylinder[x] MakeCylinder_1(r,h)+rotate+translate
```

Other measured facts worth knowing: `STEPControl_StepModelType` is **not** bound as a
JavaScript enum, so the transfer mode is passed as `0` (`STEPControl_AsIs`);
`BRepCheck_Analyzer.IsValid` requires the shape as an argument; `Bnd_Box` carries a
default 1e-7 gap that must be zeroed before measuring.

---

## 2. Architecture

```
septic_model.py  (canonical model: parameters + element ids)   ← source of truth
        │  JSON (metres, Z-up)
        ▼
src/solid/septicSolid.mjs   buildSepticSolids(kernel, model)
        │   · member solids from canonical element extents
        │   · fuse assemblies, cut void/penetrations/access opening
        │   · validity + volume + bbox per operation and per component
        ▼
src/solid/ocKernel.mjs      OCCT kernel wrapper (primitives, Booleans, STEP I/O)
        ▼
scripts/solid/septic-step.mjs  CLI: model JSON → solids → STEP files + JSON report
```

* **Engineering parameters stay in Python.** The adapter receives the canonical
  document and reads `parameters`, `elements` (extents) and `derived`; it defines no
  dimension of its own.
* **Units pass straight through.** Canonical is metres, OCCT is unit-agnostic, STEP is
  written in metres. There is no conversion anywhere, so no conversion can drift.
* **DXF, IFC and STEP remain one projection each** of the same parameters and the same
  element ids; none replaces another and none becomes the engineering source.

### Geometry rules (explicit, not inferred)

| Component | Rule |
|---|---|
| Tank shell | base slab + 4 walls + top slab **fused** member by member, 6 solids |
| Internal void | cut with the generator's internal box (`tank_int_l × tank_int_w × tank_depth_int`). **It removes nothing**, because the member solids already form a closed hollow shell — the zero delta is the verified proof that the shell is hollow rather than a solid block |
| Baffles | fused **after** the void, because they stand inside it |
| Pipe penetrations | cut from each **pipe element's** axis, radius and level, extended to 3 × wall thickness. The outlet pipe and the tank→manhole connection are at the same level on the same axis, so they share one hole: requests are de-duplicated by (wall, y, z, radius) and the shared hole records both element ids |
| Manhole | base + 4 walls + cover slab + cover fused; internal void cut; **access opening** cut from the top of the void up through the cover slab and cover, using `manhole_int_l × manhole_int_w` |
| Connection pipe | kept as its own solid (it passes through two walls) |

Every component keeps the canonical `elementIds` that produced it.

---

## 3. Measured results (default canonical parameters)

```
component     volume (m³)   solids   valid   bbox size (m)
tank            9.563931       1     yes     3.4 × 2.9 × 2.35
manhole         0.743000       1     yes     1.1 × 1.0 × 1.0
connection      0.049480       1     yes     2.8 × 0.15 × 0.15
operations: 18, all valid
```

### Independent arithmetic check (criterion 8)

```
outer envelope      3.4 × 2.9 × 2.35            = 23.171000
internal void       3.0 × 2.5 × 2.0             = -15.000000
baffles             0.2×2.5×1.5 + 0.2×2.5×1.3   =  +1.400000
penetrations        2 × π × 0.075² × 0.2        =  -0.007069
                                            expected =  9.563931   ✔ matches the kernel
```

The test asserts this identity to 1e-6 m³, so wall thickness **0.2 m**, base **0.15 m**
and top slab **0.2 m** are all implied by the solid and confirmed by arithmetic.

### Opening verification (criterion 4)

| Opening | Removed | Analytic | Ratio |
|---|---|---|---|
| inlet pipe through west wall | 0.003534 m³ | π·0.075²·0.2 = 0.003534 | 1.000 |
| outlet pipe through east wall | 0.003534 m³ | 0.003534 | 1.000 |
| manhole access opening | 0.076500 m³ | 0.7·0.6·0.15 + 0.6·0.45·0.05 = 0.076500 | 1.000 |

A cut that removes no material is not accepted as an opening: the tank→manhole
connection is reported instead (§7.2).

---

## 4. STEP export and verification

The writer is `STEPControl_Writer` from the selected build.

### Measured output

| File | Bytes | STEP entities | `MANIFOLD_SOLID_BREP` | `CLOSED_SHELL` | `ADVANCED_FACE` | Metric `LENGTH_UNIT` | `END-ISO-10303-21` |
|---|---|---|---|---|---|---|---|
| `fundi-septic-tank.step` | 113,478 | 2,518 | 1 | 1 | 38 | yes | yes |
| `fundi-septic-manhole.step` | 87,093 | 1,928 | 1 | 1 | 31 | yes | yes |
| `fundi-septic-connection.step` | 5,883 | 118 | 1 | 1 | 3 | yes | yes |

`MANIFOLD_SOLID_BREP` + `CLOSED_SHELL` + `ADVANCED_FACE` is what distinguishes a
**solid** export from a shell of faces, which the test asserts per file. The files are
written to `public/step/` by the CLI and to `.test-artifacts/solid/step/` by the test.

### One file per component, and why

Transferring a **fused compound of three solids** to the writer throws a raw OCCT
exception in this build. Rather than emit a combined file that is not what it claims,
each component is written as its own verified file and the limitation is stated in the
result (`note` field) and in §7.1.

### Kernel re-import: attempted, failed, recorded

The reader is used on every file and the outcome is recorded per file instead of being
assumed:

```
tank        reimport FAILED: 28852256
manhole     reimport FAILED: 29338520
connection  reimport FAILED: 29522008
```

Those are raw C++ exception values surfaced through emscripten. A simple box STEP
written and reimported successfully in isolation during development, so the writer and
reader both work in principle; this build's reader rejects these particular shapes
(they contain cylindrical openings and many faces). Because of that:

* the STEP claim rests on **structural verification of the file's own entities**
  (solid topology, units, termination, byte counts), which is an independent check that
  does not depend on the kernel that wrote it;
* a full round-trip in a third-party CAD application is **manual verification** and is
  **not** claimed here (see §8).

---

## 5. Tests actually executed

```
node test/solid-septic.test.mjs        →  13/13 pass
```

(The file runs directly with `node`; `node --test` spawns workers with piped stdio,
which restricted sandboxes block with `EPERM`.)

| # | Criterion (from the brief) | Result |
|---|---|---|
| 1 | Base slab and wall solids | PASS — tank solid, 1 solid, valid, 9.563931 m³ |
| 2 | Internal partitions | PASS — baffle volume inside the solid equals 0.2·2.5·(1.5+1.3) to 1e-6, checked by rebuilding with `num_baffles: 0` |
| 3 | Parameterised openings | PASS — ≥2 applied penetrations + access opening, each referencing its element ids |
| 4 | Boolean subtraction removes material from the correct solid | PASS — every applied hole matches π r² t; access opening matches its cover build-up |
| 5 | Boolean fusion where appropriate | PASS — 11 fuses, 3 opening cuts; the redundant void cut is flagged and must remove nothing |
| 6 | Shape validity after each major operation | PASS — all 18 operations valid, all components valid |
| 7 | Overall external dimensions vs source parameters | PASS — 3.4 × 2.9 × 2.35 m to 1e-6 |
| 8 | Internal dimensions and wall thickness | PASS — analytic volume identity of §3 to 1e-6 |
| 9 | Consistency with the generator's coordinates/units | PASS — base at z=0, centred on x=y=0, manhole offset at x=4.5 |
| 10 | Invalid geometry / impossible thicknesses / failed Booleans | PASS — negative `wall_thick` rejected; zero-baffle case builds |
| 11 | Genuine STEP + verification | PASS — 3 files, solid topology, metric units, terminated; reimport failures recorded (not hidden) |
| 12 | Repeatability | PASS — volumes identical to 1e-12 across builds |
| 13 | Overload reporting | PASS — pinned signatures recorded (§1) |

Regression: the existing suites were **not** touched by this work
(`test_cad_ifc_poc.py` 22/22, `test_cad_ifc_engineering.py` 40/40,
`test_cad_ifc_api.py` 20/20 — all green before this task and unchanged by it).

---

## 6. How to run

```powershell
# 1. canonical model from the real Python generator
.venv-ifc\Scripts\python.exe -c "import json,sys; sys.path.insert(0,'src/Backend'); from cad_ifc import septic_model; open('.test-artifacts/solid/cli-model.json','w').write(json.dumps(septic_model.build_model()))"

# 2. solids + STEP (fresh process, writes public/step/*.step and a JSON report)
node scripts\solid\septic-step.mjs --model .test-artifacts\solid\cli-model.json --out public\step --report .test-artifacts\solid\report.json

# 3. human-readable summary of the report
.venv-ifc\Scripts\python.exe scripts\solid\show_report.py

# 4. the test suite
node test\solid-septic.test.mjs
```

Measured runtime: the full build + 3 STEP exports ≈ 15 s; the whole test file ≈ 70 s.

---

## 7. Known limitations

**7.1 No combined STEP assembly.** A fused compound of the three solids cannot be
transferred by this build (raw OCCT exception). Three verified per-component files are
produced instead of one combined file. Fixing this needs either a newer OCCT build or a
different assembly route (e.g. XCAF document structure), both out of scope here.

**7.2 The source model has a connection that reaches no wall.** The canonical
`septic-system.connection.tank_to_manhole` sits at **z = 1.35 m**, while the manhole
walls span **z = 0.15 – 0.85 m** and its cover tops out at **1.05 m**. The connection
therefore does not physically meet the manhole. The adapter does **not** "fix" this by
moving the pipe or skipping it silently: it records a
`PENETRATION_REACHES_NO_WALL` warning with both element ids and the z ranges, and leaves
the shape unchanged. This is a genuine inconsistency in the existing septic generator
data that the solid model exposed — it should be resolved in the generator, not in the
adapter.

**7.3 Kernel STEP re-import fails on these shapes** (§4). Structural verification is used
instead. A third-party CAD round-trip remains manual.

**7.4 STEP is metres, IFC is metres, DXF is millimetres.** That is deliberate; the STEP
file declares a metric `LENGTH_UNIT` and carries no scale factor.

**7.5 Reinforcement is not solid-modelled.** Bars are not represented as individual
solids; the detailing data lives in the canonical model and in the DXF, as before.

**7.6 Only the septic tank has an adapter.** The kernel wrapper is generic, but no other
member (beam/column/slab) is wired to solids yet.

**7.7 The web build does not yet ship the 62.81 MB WASM.** The kernel is exercised
through Node (tests and CLI). Wiring it into the browser bundle is Task 4.5 work and is
**not done** — see the note below.

### Task 4.5 status (Fundi Studio connection)

* **Done:** a clean, documented interface (`scripts/solid/septic-step.mjs`) that takes a
  canonical model and returns solids + STEP + a full report, ready for the Python API to
  invoke exactly as it invokes the IFC exporter.
* **Not done:** the Python `/api/cad-ifc/solid/...` endpoints, the browser-side kernel
  load, and the viewer adapter that displays the solid without making the display mesh
  authoritative. The existing Three.js renderer, DXF and IFC paths are untouched and
  remain operational.

### Task 4.6 (JSCAD) — not added

JSCAD was **not** installed. No benchmark comparison was run, so no quantitative claim is
made. The qualitative reason is recorded for the decision: the selected OpenCascade build
already provides precise B-rep solids, Booleans **and** STEP export, which is the
requirement here; JSCAD's CSG-on-mesh model would duplicate that with lower precision and
no STEP writer, so it would add a dependency without adding capability. If it is later
wanted for quick procedural preview geometry, it should be justified against a concrete
task with the four comparison axes in the brief (precision, Boolean reliability, exports,
integration cost).

---

## 8. Manual verification still required

1. Open `public/step/fundi-septic-tank.step` in a CAD application (FreeCAD, SolidWorks,
   Fusion, Rhino) and confirm it imports as **one solid**, with a volume of
   **9.563931 m³** and a bounding box of **3.4 × 2.9 × 2.35 m**. This closes the
   round-trip gap that the kernel reader cannot (§7.3).
2. Confirm the two pipe openings appear as holes in the tank walls, and the manhole
   access opening is open from the top.
3. Confirm the `PENETRATION_REACHES_NO_WALL` warning matches what an engineer sees in
   the source DXF (the connection stub above the manhole), then decide whether the
   generator or the model is wrong.

No engineering suitability or code compliance is claimed from geometric validity.
