# Phase 0 — Repository, dependency and integration audit

Branch: `feature/cad-bim-ifc-integration`
Repository (Fundi Studio): `C:\Users\HP\Documents\programming\Java script\ReactApps\Services`
Audited: this session, before any modification.

Every statement below is marked:

* **VERIFIED** — inspected or executed in this environment, evidence quoted.
* **NOT AVAILABLE** — could not be checked here; the reason is given.
* **UNVERIFIED** — implemented or believed true but not proven in a browser.

---

## 1. Git state at the start of the work

**VERIFIED**

```
branch:  feature/cad-bim-ifc-integration
HEAD:    497ea33 Add isolated CAD/BIM workbench route with MLightCAD and web-ifc viewers
```

Uncommitted work existed **before** this task and was preserved (nothing was
reset, stashed or discarded):

| Status | Path |
|---|---|
| modified | `.gitignore` |
| modified | `src/components/components/ChatPage.jsx` |
| modified | `src/components/components/RightSidebar.jsx` |
| modified | `src/components/components/Sidebar.jsx` |
| modified | `src/components/engineering_appp.jsx` |
| untracked | `build/…` (previous build output) |
| untracked | `chats/` |
| untracked | `src/Backend/Cad_Generator/` (the Python detailing system, 193 files) |

`src/Backend/Cad_Generator/` being untracked matters: the engineering generators
the brief refers to are present on disk but **not committed** at HEAD. This
integration reads them in place and does not modify them.

---

## 2. Fundi Studio architecture (as found)

**VERIFIED**

| Item | Finding |
|---|---|
| Frontend | React 19.0, Create React App `react-scripts 5.0.1` (webpack 5), JavaScript + a few `.tsx` |
| Entry chain | `src/index.js` → `src/App.js` → `src/components/engineering_appp.jsx` |
| Routing | `react-router-dom` 7.5; routes declared inline in `engineering_appp.jsx` |
| State | `useState` per screen; `zustand` is a dependency but no store is used in `src` |
| Navigation shell | `src/components/components/ChatPage.jsx` (`navData`) |
| Backend | FastAPI, `src/Backend/main.py`, uvicorn on `127.0.0.1:8001`, ~30 routers |
| Existing 2D | `/drawing` → React Konva `src/components/Drawings/cad_drawing.jsx` |
| Existing 3D | `/visualise` → React Three Fiber `src/components/Drawings/visualise_component.jsx` |
| 3D generators | `src/components/Drawings/componentRegistry.js`: 12 `QS_COMPONENTS`, 21 `RC_COMPONENTS` |
| Tests (JS) | none — no Jest test files, no `setupTests` |
| Tests (Python) | standalone scripts at repo root, run manually |

### Existing 3D is React Three Fiber, and must stay

**VERIFIED** — `src/components/Drawings/visualise_component.jsx` owns an R3F
`<Canvas>` with `PerspectiveCamera`, `OrbitControls`, `Environment` and a
`CameraController`. Nothing in this integration touches it. The workbench's "Existing
3D (R3F)" tab only links to `/visualise`.

---

## 3. The existing Python engineering generators

**VERIFIED**

Location: `src/Backend/Cad_Generator/engineering_system/` (package
`engineering_system`, imported by adding `src/Backend/Cad_Generator` to
`sys.path`).

```
generate.py                 # CLI + one generate_<target>_dxf() per drawing
core/                       # model, geometry, reinforcement, rules, relationships, validation
drawing/                    # dxf.py (DXFDocument), annotations, dimensions, schedules, standards
members/                    # beam, column, slab, wall, foundation, stair
details/                    # beam_column_intersection, corbel, half_joint, nib
tests/test_all.py           # the generators' own test file
```

### Entry points that actually exist

| Target | Function in `generate.py` | Parameters class | Views drawn |
|---|---|---|---|
| beam | `generate_beam_dxf` | `members.beam.BeamParams` | elevation, section |
| column | `generate_column_dxf` | `members.column.ColumnParams` | elevation, section |
| slab | `generate_slab_dxf` | `members.slab.SlabParams` | elevation |
| wall | `generate_wall_dxf` | `members.wall.WallParams` | plan section, elevation |
| retaining wall | `generate_retaining_wall_dxf` | `members.wall.CantileverRetainingWallParams` | section |
| pad footing | `generate_pad_footing_dxf` | `members.foundation.PadFootingParams` | plan, section |
| stair MST1 | `generate_stair_dxf` | `members.stair.StairParams` | section |
| stair MST2 | `generate_stair_mst2_dxf` | `members.stair.StairParams` | section |
| beam/column joint | `generate_intersection_dxf` | `details.beam_column_intersection.*` | elevation, plan |
| corbel | `generate_corbel_dxf` | `details.corbel.*` | detail |
| half joint | `generate_half_joint_dxf` | `details.half_joint.*` | detail |
| nib | `generate_nib_dxf` | `details.nib.*` | detail |
| bar shapes | `generate_bs8666_shapes_dxf` | — | catalogue sheet |

Findings that shaped the integration:

1. **Parameters are dataclasses with defaults** (`BeamParams`, `ColumnParams`, …).
   They are the authoritative design inputs and can be introspected with
   `dataclasses.fields`, which is how the UI exposes them without duplicating the
   signature (see `generator_registry.parameter_schema`).
2. **Each `generate_*_dxf` hardcodes its `Params()` and its sheet layout** (view
   origins, title block). There is no parameter-injection seam. The integration
   therefore *wraps* the renderer calls instead of editing the generators (§4).
3. **`DXFDocument` writes no `$INSUNITS`.** `ezdxf.new("R2010")` leaves the drawing
   unitless; coordinates are millimetres by convention only. The adapter sets
   `$INSUNITS = 4` and `$MEASUREMENT = 1` on the generated file.
4. **Entities carry no identity.** Nothing in a generated DXF says which engineering
   element an entity belongs to, so this integration adds XDATA (§4).
5. **Detailing logic is real**: `core/reinforcement.py` (33 KB) implements the
   BS 8666 catalogue and bar-bending geometry; `members/*` compute bars, zones,
   links and schedules. None of it was reimplemented in JavaScript or duplicated in
   the adapters.

**Runtime dependency**: `ezdxf`. Present in both the system interpreter and the
backend virtualenv (1.4.3 — **VERIFIED**).

---

## 4. How the generators are driven without being modified

**VERIFIED** — `src/Backend/cad_ifc/generator_registry.py`.

`generate_drawing()` opens a *recording session*: it temporarily replaces the
`DXFDocument` symbol inside `engineering_system.generate` with a subclass that
records every `add_*` call (handle, layer, type, order), and wraps the specific
`render_*` class methods it is about to call so each recorded entity is attributed
to the view whose call created it. Both patches are undone in a `finally` block.

Why this matters for engineering integrity: an entity's view is taken from the
generator's **own call boundary** (`render_elevation` → `elevation`), never from
coordinates, layer names or geometry heuristics. That is what allows a trustworthy
entity ↔ element mapping (§`coordinate_and_identity_mapping.md`).

The sheet layout per generator (view list, origins, title block fields) is data in
the registry that mirrors `generate.py`. It is pinned by a test:
`test_layout_matches_generate_module` runs the real `generate_*_dxf` function and
compares entity counts, so drift fails the suite.

---

## 5. MLightCAD in Fundi Pulse (the porting source)

**VERIFIED — located, read, and version-checked.**

| Item | Value |
|---|---|
| Fundi Pulse path | `C:\Users\HP\Documents\programming\React Native Apps\siteflow-mobile` |
| App | `migrated-web-app` |
| Commit | `c64c098` "cad-viewer intergration" (product name on screen: "YaMafundi CAD Studio") |
| Integration files | `src/cad/CadViewerSpike.jsx` (830 lines), `src/cad/viewerHost.js`, `src/cad/webAdapter.js`, `src/cad/CADCanvasView.jsx`, `src/cad/dwgConverter.js`, `src/cad/cad_acceptance_test.mjs` |

### Exact packages installed in Fundi Pulse

**VERIFIED** — read from `migrated-web-app/node_modules/@mlightcad/*/package.json`:

| Package | Version | Licence |
|---|---|---|
| `@mlightcad/cad-simple-viewer` | **1.7.5** | MIT |
| `@mlightcad/cad-simple-ui-plugin` | **1.7.5** | MIT |
| `@mlightcad/three-renderer` | **1.7.5** | MIT |
| `@mlightcad/data-model` | 1.15.5 | MIT |
| `@mlightcad/common` | 1.15.5 | MIT |
| `@mlightcad/geometry-engine` | 3.15.5 | MIT |
| `@mlightcad/graphic-interface` | 3.15.5 | MIT |
| `@mlightcad/mtext-parser` | 1.5.3 | MIT |
| `@mlightcad/mtext-renderer` | 0.13.3 | MIT |
| `@mlightcad/shx-parser` | 1.4.5 | MIT |
| `@mlightcad/emf-converter` | 1.15.5 | Apache-2.0 |
| `@mlightcad/libredwg-converter` | 3.15.5 | (DWG path — **not** ported) |
| `@mlightcad/libredwg-web` | 0.7.17 | (DWG path — **not** ported) |

The two `libredwg` packages are the DWG conversion path in Fundi Pulse. They are
**not** part of this integration: with them out of scope, **DWG is a viewer-only
question and not offered at all** here — no DWG read or write is claimed.

### How Fundi Pulse initialises the viewer

**VERIFIED** (read from `CadViewerSpike.jsx`):

```js
AcApDocManager.tryGetInstance()  → .destroy()          // StrictMode double-mount
acedApplyUiTheme('dark', host)
createViewerContainer(host)                            // imperative child
AcApDocManager.createInstance({ container, autoResize, useMainThreadDraw, disableExport })
await import('@mlightcad/cad-simple-ui-plugin/register')
acuiRegisterSimpleUiPlugin(manager.pluginManager, { host, dockPanel, toolbar, layouts })
manager.openDocument(fileName, arrayBuffer, { mode: AcEdOpenMode.Write, progressiveRendering: false })
manager.sendStringToExecute('zoom\ne\n')
doc.database.dxfOut(undefined, 6)                      // export
```

Configuration found and reused: **write mode** (`AcEdOpenMode.Write`), the full
simple-UI plugin (dock panel, toolbar, command line), `disableExport: false`.
The one non-obvious constraint, documented in `viewerHost.js`, is that the plugin
reparents every child of its host element, so React must render that host **empty**
and the canvas container must be created imperatively.

The versions installed in Fundi Studio match Fundi Pulse exactly for the viewer
packages (**VERIFIED** from `node_modules/@mlightcad/*/package.json`), so the port
is a genuine reuse, not an approximation.

---

## 6. IFC capability before this work

**VERIFIED**

* `src/Backend/requirements.txt` declares `ezdxf>=1.1.0` and `ifcopenshell>=0.7.0`
  (the file lists them twice).
* The system interpreter has `ezdxf` 1.4.3 and **no** `ifcopenshell`.
* The backend virtualenv `.venv-ifc` has `ifcopenshell 0.9.0.post1`, `ezdxf 1.4.3`,
  `fastapi 0.118.2`, `uvicorn 0.37.0`, `numpy 2.2.6`, `lark 1.3.1`. **No pytest.**
* Prior experimental IFC use exists in
  `src/Backend/calculations/Atomationmodels/arch_pro/cad_file_extractor.py`
  (imports `ifcopenshell` and `ezdxf` for file inspection). No IFC *generation*
  existed before the `cad_ifc` package.

---

## 7. Prior work on this branch (what already existed)

**VERIFIED** — commit `51587ed`/`497ea33` added:

```
src/Backend/cad_ifc/{__init__,identity,units,septic_model,ifc_export,dxf_export,mapping,pipeline,router}.py
src/components/interop/{InteropWorkbench,CadDxfViewer,IfcBimViewer}.jsx, viewerHost.js
docs/CAD_BIM_IFC_INTEGRATION.md
test_cad_ifc_poc.py   (22 tests)
```

That work covered the **septic-tank** generator only. Its 22 tests pass on the
untouched branch (**VERIFIED**, re-run before changes: `22/22 tests passed`).

---

## 8. Dependency conflict found and resolved (That Open)

**VERIFIED from the npm registry and the packages themselves.**

| Package | Installed here | Declared `three` peer |
|---|---|---|
| `@mlightcad/cad-simple-viewer` | 1.7.5 | `^0.172.0` |
| `three` (installed) | **0.172.0** | — |
| `@thatopen/components` 3.4.9 (latest) | not installed | `>=0.182.0` |
| `@thatopen/components` 3.3.3 (chosen) | 3.3.3 | `>=0.175.0` |
| `@thatopen/fragments` 3.3.3 | 3.3.3 | `>=0.175` |

Only **one** `three` instance may exist in the bundle (MLightCAD, R3F and That Open
all draw with it, and two copies break `instanceof` checks between them). The
declared ranges are mutually unsatisfiable, so the choice was made empirically
rather than by trusting the range:

```
node scripts/verify/thatopen-three-compat.mjs
  three version: 172
  @thatopen/components 3.3.3: required=30 missing=0
  @thatopen/fragments 3.3.3:   required=25 missing=0
  InstancedBufferGeometry path: ok
  UniformsLib.lights clone: ok (keys=19)
  Controls is class: true
  RESULT: symbol-compatible=true behaviour-ok=true
```

The check extracts every symbol `@thatopen/components` and `@thatopen/fragments`
import from `three` (30 and 25 symbols) and asserts each exists in the installed
three, then exercises the instanced-geometry and uniform-cloning paths the fragment
batcher depends on. All present on 0.172.0.

Consequence: `.npmrc` sets `legacy-peer-deps=true` (documented in the file), every
needed peer is declared directly in `package.json`, and the That Open packages are
**pinned exactly** (3.4.x would genuinely require three ≥ 0.182 and
`camera-controls >= 3.1.2`).

`npm ls three --all` confirms a single deduped `three@0.172.0` for MLightCAD, R3F and
That Open (**VERIFIED**; the only other copy is `three@0.170.0` nested under
`stats-gl`, a pre-existing `@react-three/drei` dependency that was already there).

### Consequence of `legacy-peer-deps` that had to be handled

Turning it on stops npm auto-installing peers. The first install silently dropped
`@velipso/polybool` (an undeclared-as-dependency peer of
`@mlightcad/three-renderer`), and the production build then failed with
`Module not found: Can't resolve '@velipso/polybool'`. `scripts/verify/find-unmet-peers.mjs`
walks the tree and reports genuinely missing peers; `@velipso/polybool@1.1.1` is now a
direct dependency.

---

## 9. Unit, coordinate and identity conventions found

**VERIFIED**

* The Python generators work in **millimetres** (all `*_mm` parameters).
* The existing Konva drawing page has **no unit system**; a drawing unit is whatever
  the user means.
* React Three Fiber is **Y-up**; IFC and AutoCAD WCS are **Z-up**.
* The prior `cad_ifc` work fixed the contract: canonical model in **metres, Z-up**;
  DXF written in **millimetres** (`$INSUNITS = 4`); IFC in **metres**
  (`IfcSIUnit(LENGTHUNIT, METRE)`); R3F → canonical is
  `(x, y, z) → (x, -z, y)`.
* Identity: internal element id owned by Fundi; IFC `GlobalId` derived
  deterministically with UUIDv5 in a fixed namespace
  (`8f14e45f-ceea-4a67-9a3e-2b1f0b1c9d77`), so regeneration reproduces the same
  GlobalIds. DXF handles are treated as representation-specific, never as identity.

---

## 10. Risks identified, and what was done about them

| Risk | Mitigation |
|---|---|
| Editing generators could break detailing output | Generators are **not modified**; instrumentation is a scoped monkey-patch restored in `finally` |
| Registry sheet layout drifting from `generate.py` | `test_layout_matches_generate_module` compares entity counts against the real functions |
| One `three`, two incompatible peer ranges | Empirical compatibility check + single deduped copy + exact pins (above) |
| A CAD rectangle silently becoming an `IfcWall` | `canonical.IFC_CLASS_BY_ELEMENT_TYPE` is the only path to a class; `ifc_export` refuses classes outside it |
| DXF handles changing under us | Identity lives in XDATA; reconciliation recognises re-handled entities by (element id, geometry hash) |
| MLightCAD stripping XDATA on re-export | Reported as unmapped, never guessed (see `mlightcad_editor.md` §Risk) |
| Assuming a stair has a width, or a wall section has a length | Recorded as an explicit assumption **and** as a validation warning on the element |
| IFC written with an invalid enum (silent corruption) | Pre-validated against the schema enumeration; degradation to `NOTDEFINED` is recorded as a warning |
| Browser behaviour unverifiable in this environment | Every interactive claim is labelled UNVERIFIED with manual steps (see the other docs) |

---

## 11. Missing dependencies / environment gaps

| Need | Status |
|---|---|
| `ifcopenshell` | present in `.venv-ifc` only (0.9.0.post1). The system interpreter does not have it. Backend must be run with `.venv-ifc`. |
| `pytest` | **absent** in `.venv-ifc`; both test suites are plain `python` scripts that also work under pytest if installed |
| `python-multipart` | not installed, so the reconcile endpoint takes base64 JSON instead of multipart upload |
| Browser automation (Playwright/Puppeteer) | **not available** in this environment, so no interactive verification was possible |
| A DWG converter | deliberately out of scope (`libredwg` not ported) |

---

## 12. Phased plan followed

1. **Audit** (this document).
2. **CAD editor** — registry, generator-driven DXF with identity, MLightCAD write
   mode, export/reopen, `docs/integration/mlightcad_editor.md`.
3. **IFC / BIM** — canonical model → semantic IFC4, That Open viewer,
   `docs/integration/ifc_that_open.md`.
4. **Canonical identity and mapping** — versioned schema, one-to-many entity links,
   reconciliation, `docs/integration/canonical_engineering_model.md` and
   `docs/integration/coordinate_and_identity_mapping.md`.
5. **End-to-end regression** — both Python suites, the production build, the
   dependency checks.

Each phase's acceptance tests are listed in `docs/integration/cad_bim_audit.md`
§13 (final report) and in the docs above. A phase was not declared complete until
its automated tests passed.
