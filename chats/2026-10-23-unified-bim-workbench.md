# Unified BIM workbench & structural analysis integration — execution journal

**Date:** 2026-10-23
**Branch:** `feature/cad-bim-ifc-integration`
**Repository root:** `C:\Users\HP\Documents\programming\Java script\ReactApps\Services`
**Environment:** Windows, Node v23.5.0, npm (CRA 5.0.1 / webpack 5.97.1), Python 3.13.5 in `.venv-ifc`

This journal records what was inspected, what was decided, what was changed, what was
executed, and what is still unverified. Nothing in the "verified" sections is inferred.

---

## 1. Audit (Stage A)

### 1.1 Frontend entry points

| Concern | Where |
|---|---|
| HTML entry | `public/index.html` (CRA). Viewport meta is **correct**: `width=device-width, initial-scale=1` |
| Root mount | `src/index.js` → `src/App.js` → `src/components/engineering_appp.jsx` |
| Shell | `engineering_appp.jsx`: header (menu/home/back/tool title/chat/settings), chat overlay, `<main>` scroll region, footer, left `Sidebar`, right `RightSidebar` |
| Routing | `react-router-dom` v7, all routes declared in `engineering_appp.jsx`; `/interop/cad-bim` → `src/components/interop/InteropWorkbench.jsx` |
| Route metadata | `src/navigation/toolRegistry.js` (title/group/parent/standard per path; `/interop/cad-bim` registered) |
| Theme | `isDark` state in `EngineeringApp`, `.dark` class on the shell, `darkMode: "class"` in `tailwind.config.js` |
| Shared UI | `src/components/shared/ui/*` — `tokens.js` (Tailwind class tokens), `Fields.jsx`, `PageLayout.jsx`, `Status.jsx`, `Feedback.jsx`, `TableRegion.jsx`, `ViewerModal.jsx` |
| Global CSS | `src/index.css` (Tailwind layers + `--bg-*`/`--text-*` variables), `floatingPalette.css` |
| State | local component state + `src/state/*` (`TakeoffBridgeContext`, `recentTools`) + `zustand` in a few visualiser/lighting modules |

### 1.2 The CAD/BIM/IFC workbench and its backend endpoints

* Page: `src/components/interop/InteropWorkbench.jsx`.
* Viewers: `CadDxfViewer.jsx` (MLightCAD), `ThatOpenBimViewer.jsx` (That Open),
  `IfcBimViewer.jsx` (web-ifc + three.js), `AnalysisDiagram2D.jsx` (2D results).
* API client: `src/components/interop/cadIfcApi.js`.
* Backend router: `src/Backend/cad_ifc/router.py`, mounted at `/api/cad-ifc` by
  `src/Backend/main.py` **and** by the lean launcher `src/Backend/cad_ifc/standalone.py`.
* Endpoints (unchanged): `/units`, `/health`, `/generators`, `/generate`, `/models`,
  `/model/{id}`, `/links/{id}`, `/entities/{id}`, `/reconcile/{id}`, `/export`,
  `/analysis`, `/analysis/engine`, `/file/{id}.{ext}`.

### 1.3 Every existing R3F canvas / 3D viewer (traced by imports, not filenames)

| View | Component | Scene source | Interaction | Represents |
|---|---|---|---|---|
| `/visualise` | `src/components/Drawings/visualise_component.jsx` (1457 lines) | `componentRegistry` + `SteelBIM_Generators` + Konva→3D adapters | OrbitControls, camera presets, measurement, layer toggles | design geometry |
| Framed & Tall builder | `ReinforcedConcrete/FramedandTall/InteractiveStructureBuilder.jsx` (views `2d`/`3d`/`cad`) | `StructuralCanvas` (2D), `Multi_storey_structure` (3D), `CadDrawingApp` (CAD) | element click → `StructuralElement`, toolbar tools, layer visibility | design geometry + analysis (wireframe overlay via `wireframe.jsx`) |
| Builder analysis view | `FramedandTall/wireframe.jsx`, `Frame3D.jsx`, `StructuralResultViewers.jsx`, `BM_SF_Chart.jsx` | element `sections[]` with `Mz/Vy` + `nodes[].displaced_*` | member select, diagram toggles, deformation scale | analysis results |
| RC beam 3D | `ReinforcedConcrete/Beams/RCBeamDesigner.jsx`, `Three.jsx`, `Beam_THree.jsx` | section + reinforcement bars | orbit, detail toggles | design/detailing geometry |
| Steel BIM | `SteelDesign/SteelBIM*.jsx` | `STRUCTURE_REGISTRY` generators | orbit + registry params | design geometry |
| QS/RC generators | `Drawing_Components/*` (roof, slabs, columns/beams) | own generators | orbit/zoom | design geometry |
| Workbench 3D | **new** `interop/Structure3DView.jsx` | canonical model + `src/analysis/viewModel3D.mjs` | orbit, member select, diagram/deformation controls | design geometry **and** verified solver results |

### 1.4 Framed & Tall Buildings Structure Builder — traced workflow

`/structural/manual/eurocode_structural_app` → `ReinforcedConcrete/FramedandTall/eurocode_structural_app.jsx`
→ `rc_structural_design.jsx` → `InteractiveStructureBuilder.jsx`.

State and data flow in the builder (unchanged by this work):

* `elements[]` (`StructuralElement`), `grid` (`StructuralGrid`), `layers` (Floor 1–3),
  `connections[]`, `selectedElement`, `tool`, `view` (`2d|3d|cad`),
  `analysisResults`, `designResults`, `showDiagrams {moment,shear,deflection}`,
  `showForces`, `layerVisibility`, `analysisMethod` (`moment_distribution|stiffness`).
* `preparePayload()` converts elements to `{id,type,start,end,position,properties}`.
* Analysis/design are POSTed to the backend (`axios`); results feed
  `WireframeAnalysisView` (3D), `BM_SF_Chart` (diagrams) and
  `AnalysisResultsViewer`/`DesignResultsViewer`.
* Tabs: `StructureBuilderToolbar.jsx` — **View** (2D / 3D / Wireframe / CAD Drawer),
  **Design** (Run Analysis / View Analysis / method / Run Design / View Design),
  **Members** (Add Bay, Column, Beam, Slab, Wall, Void), **Edit** (Select, Copy,
  Delete, Library, Save, Open), optional **Steel BIM**.
* CAD Drawer tab opens `Drawings/cad_drawing` (Konva) and `builderCADExporter.js`
  exports the same structure.

**Broken/weak links found in the builder (repaired only where this task required):**

1. The tab row was a fixed 50 px row with 20 px per-tab padding → 4 tabs overflow a
   360 px phone screen and the sub-toolbar (fixed 50 px, `nowrap`) clipped. Fixed by
   migrating `StructureBuilderToolbar.jsx` to shared tokens with wrapping (see §4).
2. The builder's own state is **not** the canonical model: analysis results live in
   component state and are not revision-stamped. Recorded as a known limitation
   (§7); the unified workbench path (below) does stamp them.

### 1.5 Structural analysis engines

* **Existing solver integration (pre-existing, reused, not duplicated):**
  `src/Backend/cad_ifc/analysis.py` (874 lines) + `scripts/analysis/run_opensees.py`
  run **OpenSeesPy in a separate Python process**, returning
  `fundi.analysis.results/1`. `canonical_to_analysis()` is the deterministic adapter
  (nodes/members/sections/supports/loads/subdivisions), with documented assumptions.
* Engine discovery endpoint `/analysis/engine` (verified live: `available: true`).
* Frontend adapter already present: `src/analysis/viewModel.mjs` (2D view model).
  This work adds `src/analysis/viewModel3D.mjs` for the 3D viewport (same result
  document, explicit solver-plane → canonical-frame mapping).
* No second solver was introduced.

### 1.6 Tests and known working behaviour (before changes)

* `src/components/shared/**/__tests__` (3 suites) and `src/state/__tests__` (2 suites):
  47 tests, all passing (documented in `docs/UI_REFACTOR_PROGRESS.md`).
* Python: `test_cad_ifc_poc.py` 22/22, `test_cad_ifc_engineering.py` 40/40 per
  `docs/integration/ifc_that_open.md`.
* Live backend verification in this session (before changes): `GET /api/cad-ifc/health`
  → 200 (`ifcopenshell 0.9.0.post1`, `IFC4`, `ezdxf 1.4.3`, 8 generators);
  `POST /generate` (beam) → `beam-r3` drawing with 89 entities, `IfcBeam` IFC with 1
  element, 82 mapping links; `POST /analysis` → real OpenSees results.

---

## 2. Root cause of every "unavailable" warning (evidence-based)

### 2.1 "MLightCAD engine is not installed in this environment (Android / Termux)"

**Cause: a hardcoded stub module, not a platform limitation.**

* `src/components/interop/compat/cadSimpleViewer.js` was a fake implementation:
  `isAvailable = false` (constant), `AcApDocManager.createInstance()` returned an
  object whose `openDocument()` returned `false`.
* `CadDxfViewer.jsx` read that constant, so the message was shown on **every**
  device, including desktop Chrome.
* `package.json` declares `@mlightcad/cad-simple-viewer` 1.7.5 and
  `@mlightcad/cad-simple-ui-plugin` 1.7.5; `node_modules` has both installed.
* **Evidence that the engine bundles:** a webpack 5.97.1 probe
  (`.probe/bundle-probe.js`, using the same `three`/ESM resolution CRA uses) imported
  `@mlightcad/cad-simple-viewer`, `@mlightcad/cad-simple-ui-plugin/register`,
  `@thatopen/components`, `@thatopen/components-front` and `three`, and reported
  `RESULT: ok=true errors=0`.
* Additional real requirement found (not previously deployed): MLightCAD fetches its
  MTEXT layout worker by URL (`MTEXT_RENDERER_WORKER_FILE = "mtext-renderer-worker.js"`,
  default `./assets/mtext-renderer-worker.js`). It was not copied to `public/`, so even
  a correctly imported viewer would have failed on text-heavy sheets.
  `scripts/copy-cad-bim-assets.js` now copies it to `public/cad-workers/`.

### 2.2 "That Open Components engine is optional and not installed"

**Cause: the same pattern — a stub — plus the viewer never loaded the IFC.**

* `compat/thatOpenComponents.js`: `Components` was a class whose only method was a
  no-op `init`; `isAvailable = false`. `compat/thatOpenComponentsFront.js`:
  `Highlighter.highlightByID()` was an empty function.
* `ThatOpenBimViewer.jsx` had **no `ifcUrl` loading effect at all**. It built a world
  and then sat empty. Selection/highlight therefore could never have worked even with
  a real engine.
* `@thatopen/components`, `@thatopen/components-front`, `@thatopen/fragments` are
  pinned 3.3.3 and installed; the runtime worker (`thatopen-fragments-worker.mjs`) and
  the web-ifc WASM binaries are deployed in `public/thatopen/`.

### 2.3 "web-ifc parser is omitted on mobile"

Same stub pattern: `compat/webIfc.js` exported `isAvailable = false` and an `IfcAPI`
whose `Init()` returned `false`. web-ifc 0.0.78 is installed and `public/web-ifc/`
contains `web-ifc.wasm`.

### 2.4 "Cannot reach the CAD/IFC backend at http://127.0.0.1:8001"

Three independent causes:

1. **The address was hardcoded.** `127.0.0.1` is resolved by the *browser*; a phone
   opening `http://192.168.1.20:3000` was asking its own loopback interface.
2. **The documented command could not work from the repository root.**
   `src/Backend/main.py` uses top-level imports (`from Databases import …`,
   `from cad_ifc.router import …`), so `python -m uvicorn src.Backend.main:app` from
   the root raises `ModuleNotFoundError`. It must be started from `src/Backend`, or
   the lean launcher `python -m src.Backend.cad_ifc.standalone` used instead.
3. **Host binding.** `uvicorn.run("main:app", host="127.0.0.1", …)` and the
   standalone default bind loopback, so even a correct LAN URL was refused.

Additionally the CORS configuration paired `allow_origins=["*"]` with
`allow_credentials=True`, which the CORS specification forbids for credentialed
requests (the frontend sends none, so it worked by accident).

---

## 3. Shared canonical engineering model (Stage B)

New module: `src/state/engineeringModel/`

* `core.js` — pure, testable model:
  * schema `fundi.engineering.model/1`; imports/exports the backend's
    `fundi.canonical/1` document (`fromCanonicalDocument` / `toCanonicalDocument`);
  * explicit units (`m`, `N`, `N*m`, `Pa`, `rad`) and frame (right-handed, **Z-up**);
  * explicit DXF (`mm`, ×1000, `$INSUNITS=4`) and IFC (`m`) conversions;
  * stable ids; nodes/members/sections/materials/supports/loads/combinations/cases;
  * identity index `byGlobalId` / `byHandle` / `byElementId` + `resolveElementId()`
    (accepts a GlobalId, a DXF handle, a canonical id or a solver `element#n1` key);
  * `validateEngineeringModel()` — errors block acceptance, warnings are recorded;
  * `analysisReadiness()` — separates "valid model" from "analysable model";
  * `applyEdit()` — transactional: clone → mutate → re-validate → bump revision →
    recompute fingerprint; an invalid edit returns the **unchanged** model;
  * `editElementGeometry()` — the member-property edit path: changes an element's
    dimensions/placement/rotation, moves its derived member nodes, preserves its
    GlobalId and CAD handles, and rejects impossible values before acceptance;
  * `hasUnsavedChanges()` / `markSaved()`;
  * `attachAnalysisResults()` stamps `{results, caseId, modelRevision, fingerprint}`;
  * `analysisStatus()` → `current` | `stale` | `none` (stale results are kept, never
    presented as current);
  * `fingerprintModel()` covers generator geometry (dimensions/placement/rotation),
    because the 2D adapter derives `A` and `Iz` from it, but deliberately excludes
    selection, visibility, names and identity metadata.
* `EngineeringModelContext.jsx` — one provider for the whole workbench: model,
  shared selection, visibility, unsaved-changes flag, conflict reporting
  (a different model is never loaded over unsaved work silently), `registerIdentity()`
  for backend-reported GlobalIds/handles, and `sessionStorage` persistence so an
  unsaved edit survives a route change.
* `index.js` — barrel export.

The builder's own `StructuralElement`/`StructuralGrid` classes were **not** replaced;
the adapter imports the backend canonical document and leaves the builder's workflow
untouched.

---

## 4. Workspace UX, viewers and analysis (Stages C–F)

### 4.1 Responsive workbench (`src/components/interop/InteropWorkbench.jsx`)

* Compact header: title, revision/unsaved badge, analysis current/stale badge, panel
  toggles. Below it, a **view selector**: `<select>` on phones (<768 px), segmented
  tabs on ≥md.
* Desktop: collapsible generator panel (240–460 px, drag + keyboard splitter),
  resizable elements/properties panel (260–480 px), resizable diagnostics panel
  (120–420 px), all via `role="separator"` handles.
* Phone: panels are drawers (`w-[86vw] max-w-sm`) or a bottom sheet (diagnostics,
  `max-h-[80dvh]`); the viewport is the primary workspace; 44 px targets.
* Views: `2D CAD` (MLightCAD), `BIM / IFC` (That Open), `Structure 3D` (R3F, model +
  results), `Analysis` (OpenSees run + 2D diagrams), `IFC check` (web-ifc),
  `Tall builder` (the existing Framed & Tall builder, unchanged).
* CAD and BIM stay mounted once visited (`hidden` rather than unmount) so switching
  views does not destroy the CAD document or reload the IFC; the R3F/analysis views
  mount on demand to avoid stacking WebGL contexts.
* Shared state through the provider: selection by canonical id, so choosing an
  element in the list highlights it in CAD (by handle) and BIM (by GlobalId), and a
  CAD pick resolves handles → canonical id → BIM/3D.

### 4.2 MLightCAD (`CadDxfViewer.jsx`, `compat/cadSimpleViewer.js`)

* Real engine re-export; availability computed from the engine's exports
  (`cadEngineStatus()`), never hardcoded.
* Worker URLs registered (`CAD_WORKER_URLS`) + `checkWorkersOnInit: true`; worker
  readiness shown in the status bar.
* Write mode opens the served DXF for editing; toolbar: extents, zoom in/out, open
  local DXF, reload, export DXF; touch gestures are the engine's own (pinch/pan/tap).
* CAD → model selection bridge via `view.selectionSet.events.selectionAdded`
  (objectId → DXF handle → canonical element), feature-detected.
* Failure state names the engine, the worker URL and the drawing, offers retry and
  the generated DXF download, and explicitly states that a downloaded DXF is not an
  editor.

### 4.3 That Open (`ThatOpenBimViewer.jsx`, `compat/thatOpen*`)

* Real engine re-exports; `bimEngineStatus()` reports missing symbols.
* **Loads the IFC**: fetch → `Uint8Array` → `IfcLoader.load(data, true, name)` →
  `world.scene.three.add(model.object)` → `fragments.list.set(...)` → `fitToItems()`.
* Identity: element → `fragments.guidsToModelIdMap([globalId])` → highlight;
  pick → `fragments.raycast(...)` → `model.getGuidsByLocalIds([localId])` → canonical
  element. Unknown GlobalIds are reported, not attached to a neighbour.
* Visibility: real `FragmentsModel.setVisible(localIds, visible)` / `resetVisible()`,
  capability-detected and shown in the Capabilities list.
* Clipping (`OBC.Clipper`) and measurement (`OBF.LengthMeasurement`) remain optional
  and feature-detected; each failure is reported individually.
* Loading/error/retry states list engine version, worker URL, WASM path and model URL.

### 4.4 3D structural results (`Structure3DView.jsx`, `modelGeometry.js`, `viewModel3D.mjs`)

* Geometry: boxes derived from the backend's own `dimensions` + `placement` (axis-
  suffixed keys), with a documented fallback to the member axis and a visible warning.
* Results: undeformed reference (dashed), deformed shape (scale configurable and
  labelled "exaggerated" when ≠1), moment/shear/axial diagram (offset scale exported
  as display-only), support symbols from declared restraints, reaction vectors with
  kN labels, legend with case id, units and warnings.
* **Coordinate correctness:** the solver plane is X-right/Y-up; the canonical model is
  Z-up. `viewModel3D` applies and documents `(x, y) → (x, 0, y)`; without it a beam
  elevation would be drawn flat on plan.
* Stale results are drawn dimmed with a `STALE` badge and never labelled current.

### 4.5 Analysis run (`AnalysisPanel`) — corrected assumption

The support node references **were not broken**. `analysis.canonical_to_analysis()`
→ `resolve_node()` accepts both the `#start`/`#end` aliases and explicit subdivision
ids (`<element>#n0 … #nN`); both were executed against the running backend and give
byte-identical results (mid-span `uy = -0.0032393134323559732 m`, reactions
67 kN + 67 kN for 6.7 m × 20 kN/m).

What the panel now does differently:

* it uses the explicit `#n0 … #nN` ids, because those are the `canonicalId`s that
  appear in the returned result document, so the UI → solver node mapping is visible;
* it passes the canonical `model_id` and generator instead of relying on defaults;
* it attaches the result to the shared model revision (`recordAnalysis`) so staleness
  is detectable, then switches to the 3D results view;
* engine availability (`/analysis/engine`) is displayed instead of assumed.

### 4.6 Backend & network (`src/config/runtime.js`, `cadIfcApi.js`, backend hosts)

* `resolveApiOrigin()` order: `REACT_APP_API_BASE` → same origin (page on :8001) →
  the page's own hostname on :8001 → loopback fallback. The chosen origin and its
  provenance are shown in the workbench and in the diagnostics panel.
* `BackendError` carries `code` (`unreachable` / `timeout` / `http-error`), and the
  unreachable message includes the exact start commands (same-device, LAN, full
  backend) and the health URL.
* `probeBackend()` never throws; the banner shows the actionable message with a retry.
* `src/Backend/main.py`: `FUNDI_HOST` / `FUNDI_PORT` support, loopback default,
  explicit warning when binding a non-loopback interface.
* CORS: `allow_credentials=False` in both entry points (no cookies are used), which
  makes the wildcard origin specification-valid.
* `engineering_appp.jsx` assistant URL now resolves through the same configuration.
* The workbench no longer claims mock data anywhere: generator/IFC/analysis values
  are the backend's.

### 4.7 Member property editing and artefact staleness

The properties panel of the workbench now edits the selected element's declared
geometry (each `dimensions` key, the centre `placement`, and the Z rotation) through
`editElementGeometry`:

* validation runs **before** acceptance — e.g. `height_z = -1` is rejected with
  "element beam.beam dimension height_z must be a positive number (m)" and the model
  is returned unchanged;
* an accepted edit bumps the revision, moves the derived member end nodes (so the 3D
  view, the analysis readiness check and the identity index agree), and preserves the
  element's GlobalId/DXF handles;
* attached solver results become `stale` (the fingerprint includes generator
  geometry, because the 2D adapter derives `A` and `Iz` from width/depth);
* the DXF/IFC artefacts are **not** regenerated, and the header shows
  "DXF/IFC older than model" with the revision they came from — a synchronisation
  conflict surfaced rather than hidden.

### 4.8 Design system (Stage 13 work done here)

* `src/index.css` now carries centralised `--fundi-*` tokens (font, sizes,
  control/button heights, radii, spacing, colours, shadow) with light/dark values,
  measured from the Beam Designer Suite (`tokens.js` + its actual class usage:
  `min-h-[44px]`, `sm:min-h-[40px]`, `px-3 py-2`, `text-sm sm:text-base`,
  `rounded-lg`, `rounded-2xl`, `action.primary = bg-blue-600`), plus shared
  `.fundi-input/.fundi-select/.fundi-button/.fundi-card/.fundi-toolbar` classes for
  non-Tailwind chrome.
* `StructureBuilderToolbar.jsx` migrated: tab row and sub-toolbars use token sizes,
  wrap at 360 px, 44 px touch targets, dark-mode colours (per-tool identity colours
  preserved as text/icon colour; labels always present).
* The workbench chrome uses `shared/ui/tokens` classes.
* **Why Chrome's "Desktop site" looked better:** not a viewport bug (`public/index.html`
  already declares `width=device-width`). Desktop mode switches Chrome to a ~980 px
  layout viewport, which made the fixed-width workbench panels (290 px + 320 px) and
  the 4×~100 px builder tab row fit. The fix is responsive layout at 360–430 px, not
  scaling the page down; measured breakpoints used: 640/768/1024 px (Tailwind).
* `html, body { max-width: 100% }` + `body { overflow-x: hidden }` prevent a stray
  wide child from creating page-level horizontal scroll without shrinking type.

---

## 5. Files changed / added

### Added

| File | Purpose |
|---|---|
| `src/config/runtime.js` | Environment-aware API origin resolution, health URL, start commands |
| `src/config/__tests__/runtime.test.js` | 8 tests for the resolution rules |
| `src/state/engineeringModel/core.js` | Canonical model, validation, revisions, identity, geometry editing, analysis association |
| `src/state/engineeringModel/EngineeringModelContext.jsx` | Shared provider (model/selection/visibility/conflicts/persistence/identity/editing) |
| `src/state/engineeringModel/index.js` | Barrel export |
| `src/state/engineeringModel/__tests__/core.test.js` | 28 tests (validation, revisions, identity, staleness, geometry editing, canonical import/export) |
| `src/hooks/useMediaQuery.js` | Phone/desktop detection for layouts that must unmount a viewer |
| `src/analysis/viewModel3D.mjs` | Solver results → 3D display geometry (2D plan + **3D frame** branches) |
| `src/analysis/__tests__/viewModel3D.test.js` | 14 tests (2D mapping, deformation, diagrams, reactions, payload guard) |
| `src/analysis/__tests__/viewModel3D-3d.test.js` | 16 tests against a **live 3D response fixture** |
| `src/analysis/__tests__/fixtures/cantilever3d.results.json` | Real `{dimensions: 3}` API response used as the fixture |
| `src/components/interop/modelGeometry.js` | Canonical element → box geometry, with explicit fallbacks |
| `src/components/interop/__tests__/modelGeometry.test.js` | 10 tests |
| `src/components/interop/Structure3DView.jsx` | R3F structure + results viewport (2D and 3D result sets) |
| `src/components/ReinforcedConcrete/FramedandTall/builderModelAdapter.js` | Builder elements → canonical model + revision fingerprint |
| `src/components/ReinforcedConcrete/FramedandTall/__tests__/builderModelAdapter.test.js` | 17 tests (fingerprint, mapping, no invented E, stamping, staleness) |
| `src/Backend/cad_ifc/analysis3d.py` | 3D frame analysis: explicit input contract, 6-DOF rank validation, canonical adapter, normalisation |
| `test_analysis3d.py` | 14 acceptance tests, including closed-form 3D benchmarks |

### Modified

| File | Change |
|---|---|
| `src/components/interop/compat/cadSimpleViewer.js` | Stub → real MLightCAD adapter + worker URLs + `cadEngineStatus()` |
| `src/components/interop/compat/thatOpenComponents.js` | Stub → real That Open re-export + `bimEngineStatus()` |
| `src/components/interop/compat/thatOpenComponentsFront.js` | Stub → real components-front re-export + capabilities |
| `src/components/interop/compat/webIfc.js` | Stub → real web-ifc re-export + WASM path + status |
| `src/components/interop/CadDxfViewer.jsx` | Real engine, workers, touch toolbar, CAD→model selection, honest failure states |
| `src/components/interop/ThatOpenBimViewer.jsx` | Real engine, **IFC loading**, picking/highlight/visibility, retry states |
| `src/components/interop/IfcBimViewer.jsx` | Real web-ifc WASM path/status (fallback viewer) |
| `src/components/interop/cadIfcApi.js` | Runtime origin, `BackendError` codes, `probeBackend()`, actionable messages |
| `src/components/interop/InteropWorkbench.jsx` | Responsive workspace, unified state, view switcher, diagnostics, element geometry editor, builder publishing, result-set selection |
| `src/components/interop/Structure3DView.jsx` | Diagram selector derived from the result's declared units; supports 2D **and** 3D result sets |
| `src/components/ReinforcedConcrete/FramedandTall/StructureBuilderToolbar.jsx` | Design-system migration + responsive tab/sub-toolbars (no behaviour change) |
| `src/components/ReinforcedConcrete/FramedandTall/InteractiveStructureBuilder.jsx` | API base from runtime config, result fingerprint stamps, STALE banner, workspace publication (additive; the concurrent DXF-import work was preserved) |
| `src/state/engineeringModel/core.js` | Per-kind result sets (`analyses`), `attachAnalysisDocument`, `getAnalysis`, `analysisStatus(model, kind)` |
| `src/state/engineeringModel/EngineeringModelContext.jsx` | `editElement`, `registerIdentity`, `recordAnalysisDocument` actions |
| `src/Backend/cad_ifc/router.py` | `dimensions: 3` dispatch to the 3D analysis, 2D contract unchanged |
| `scripts/analysis/run_opensees.py` | 3D branch (`ndm=3, ndf=6`, explicit section constants, local axes, 6-component equilibrium); 2D branch untouched |
| `src/components/shared/ui/tokens.js` | Added `control.onDark` for intentionally dark panels |
| `src/components/ReinforcedConcrete/Slabs/{eurocode_slab_calculator,slab_calculator,slab_calculator_frontend}.jsx` | 42 control class strings → shared tokens |
| `src/components/ReinforcedConcrete/Columns/Columnmain.jsx` | 7 controls → shared tokens |
| `src/components/ReinforcedConcrete/Foundations/{BsCodes,eurocode_foundation_app,Foundation_viewer}.jsx` | 11 control strings + demo UI/headings → shared tokens |
| `src/components/takeoff2/swimming/PoolSettings.jsx` | Checkboxes → `CheckboxField`, ranges labelled/touch-sized, typography tokens |
| `src/components/engineering_appp.jsx` | Assistant URL from runtime configuration; error message names the resolved origin |
| `src/Backend/main.py` | `FUNDI_HOST`/`FUNDI_PORT`, loopback default + warning, CORS credentials fix |
| `src/Backend/cad_ifc/standalone.py` | CORS credentials fix |
| `scripts/copy-cad-bim-assets.js` | Copies the MLightCAD MTEXT worker to `public/cad-workers/` |
| `scripts/build.js` | Build wrapper: 4 GB heap + no source maps (the real engines exceed CRA's default build memory) |
| `package.json` | `build` → wrapper, `build:cra` escape hatch |
| `README.md` | Documented frontend/backend startup for same-device, LAN and Termux |
| `docs/integration/ifc_that_open.md` | Correction notice pointing at this journal (the doc described the pre-stub viewer) |
| `src/index.css` | Centralised `--fundi-*` design tokens + shared classes + mobile overflow base |

Untouched on purpose: all engineering calculation modules, the Konva `/drawing` page,
`/visualise`, the Framed & Tall builder's scene/analysis logic, Python generator and
solver code.

---

## 6. Verification executed

### 6.1 Backend (live, same machine)

| Check | Command | Result |
|---|---|---|
| Health | `GET /api/cad-ifc/health` | **200**. `ifcopenshell 0.9.0.post1` (`IFC4`), `ezdxf 1.4.3`, 8 engineering generators |
| Generator catalogue | `GET /api/cad-ifc/generators` | beam, column, slab, wall, retaining_wall, pad_footing, stair, stair_mst2 |
| Generate | `POST /api/cad-ifc/generate {generator:'beam'}` | model `beam`, drawing `beam-r3` (89 CAD entities), `IfcBeam` IFC (1 element), 82 mapping links, GlobalId `beam.beam` |
| Canonical model | `GET /api/cad-ifc/model/beam` | schema `fundi.canonical/1`, element has `axis: x`, `dimensions {length_x 6.7, width_y 0.3, height_z 0.6}`, `placement {0,0,0.3}` — matches the geometry adapter's assumptions |
| Entity links | `GET /api/cad-ifc/entities/beam?drawing_id=beam-r3` | `elements['beam.beam']` → 82 entries, first `{handle:'45', layer:'CONCRETE', entity_type:'LWPOLYLINE', status:'ok'}` — matches `registerIdentity()` |
| Analysis engine | `GET /api/cad-ifc/analysis/engine` | `available: true`, OpenSeesPy via `scripts/analysis/run_opensees.py` |
| Analysis run | `POST /api/cad-ifc/analysis` (E = 30 GPa, UDL = 20 kN/m, 4 elements) | `ok: true`; 4 members; mid-span `uy = -0.0032393134323559732 m`; reactions 67 kN + 67 kN (= 6.7 m × 20 kN/m) |
| Node reference forms | `#start/#end` vs `#n0/#n4` | **identical** results (`-0.0032393134323559732`, 67000, 67000) — see §4.5 correction |
| CORS (LAN origin) | `GET /health` with `Origin: http://192.168.1.20:3000` | 200, `Access-Control-Allow-Origin: *`, no `Allow-Credentials` (now specification-valid) |
| CORS preflight | `OPTIONS /generate` from the same origin | 200, methods echoed |

Start command used: `.venv-ifc\Scripts\python.exe -m src.Backend.cad_ifc.standalone --host 127.0.0.1 --port 8001`.

Side effect of verification: running `POST /generate` rewrote the tracked beam sample
artefacts (`public/cad/beam.json`, `beam.entities.json`, `beam.links.json`,
`public/ifc/beam.ifc`) and produced `public/cad/beam-r3.dxf`. They are real generator
output for the same input, not hand-edited files.

### 6.2 Engine bundling probe

`.probe/bundle-probe.js` (webpack 5.97.1, the version CRA 5 uses) imported the real
`@mlightcad/cad-simple-viewer`, `@mlightcad/cad-simple-ui-plugin/register`,
`@thatopen/components`, `@thatopen/components-front` and `three`:

```
RESULT: ok=true errors=0
```

This is what proves the "engines are not installed" messages were false.

The repository's own engine-compatibility check was re-run against the installed
packages:

```
three version: 172
@thatopen/components 3.3.3: required=30 missing=0
@thatopen/fragments 3.3.3:   required=25 missing=0
InstancedBufferGeometry path: ok (box3 empty=true)
UniformsLib.lights clone: ok (keys=19)
Controls is class: true
RESULT: symbol-compatible=true behaviour-ok=true
```

### 6.3 JavaScript tests

`CI=true npx react-scripts test --watchAll=false --runInBand`

```
Test Suites: 11 passed, 11 total
Tests:       142 passed, 142 total
```

Includes the six new suites (96 tests) and the five pre-existing suites (47 tests,
unchanged). New coverage: API-origin resolution, canonical model/validation/revision/
identity/staleness, element geometry editing (accepted + rejected + identity survival +
result invalidation), 3D results adapter for the planar solver, **3D frame results
adapter against a live API fixture**, model geometry, and the builder → canonical model
adapter with fingerprint stamping.

### 6.4 Lint and syntax

* `node scripts/verify/jsx-parse.mjs` on every created/modified file: **0 failures**
  (including all four migrated design-system modules in the follow-up round).
* `eslint --quiet` (react-app config) over `src/components/interop`, `src/config`,
  `src/state/engineeringModel`, `src/analysis`, `src/hooks`,
  `src/components/ReinforcedConcrete/{Slabs,Columns,Foundations}`,
  `src/components/takeoff2/swimming`: **0 errors**.

### 6.5 Production build

`npm run build` (with `BUILD_PATH=.tmp-build`) — **compiled successfully, exit code 0**.

```
The .tmp-build folder is ready to be deployed.
1.18 MB    static/js/main.4e79481e.js      (was ~1.16 MB before this work)
984.55 kB  static/js/437.*.chunk.js        (lazy viewer chunk)
414.43 kB  static/js/36.*.chunk.js
373.52 kB  static/js/124.*.chunk.js
343.37 kB  static/js/566.*.chunk.js
24.52 kB   static/css/main.688ef48b.css
```

Run repeatedly across the work: after the viewer integration (`main.628caeb4.js`), after
the property-editing work (`main.c854d308.js`), and after the builder/3D round
(`main.4e79481e.js`) — all exit 0. The main bundle stayed at 1.18 MB because every
viewer remains code-split; the CAD/BIM/IFC engines live in the lazy chunks, so opening
another route does not download them.

Warnings only (pre-existing `no-unused-vars` in unrelated modules). No warnings or
errors in any file created or modified by this task.

### 6.5a Python 3D acceptance tests

`.venv-ifc\Scripts\python.exe test_analysis3d.py` — **14/14 passed** (details and the
closed-form comparisons are in §8.3).

### 6.5b 2D regression after the 3D route was added

`POST /api/cad-ifc/analysis` with the original 2D beam body still returns the same
results as before (`uy = -0.0012957253729423885 m` at mid-span), and
`GET /api/cad-ifc/health` still reports IFC4 + 8 generators.

Two build findings worth recording:

1. **CRA's terser step ran out of memory** with the real engines bundled:
   `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
   (log: `.build-unified-workbench.log`). The engines bundle fine and are lazily
   loaded, so the failure was build-time memory only. `scripts/build.js` now runs the
   CRA build with `--max-old-space-size=4096` and `GENERATE_SOURCEMAP=false`
   (configurable via `FUNDI_BUILD_HEAP_MB` / `GENERATE_SOURCEMAP`); `npm run build:cra`
   still invokes the unmodified CRA build.
2. **First compile failure was a real API error**, not memory:
   `'checkWebworkerReadiness' is not exported from '@mlightcad/cad-simple-viewer'`.
   That symbol is a *static method* on `AcApDocManager`; the adapter now calls
   `AcApDocManager.checkWebworkerReadiness(CAD_WORKER_URLS)`.

Production assets verified present in the output: `.tmp-build/cad-workers/
mtext-renderer-worker.js` (1.20 MB), `.tmp-build/thatopen/thatopen-fragments-worker.mjs`
(1.33 MB), `web-ifc.wasm`, `web-ifc-mt.wasm`, `.tmp-build/web-ifc/web-ifc.wasm`.
Because `homepage` is `/services`, `PUBLIC_URL` is `/services` in production, so the
viewers fetch `/services/cad-workers/...` and `/services/thatopen/...`; in development
(`PUBLIC_URL=''`) they fetch `/cad-workers/...`, which CRA serves from `public/`.

### 6.6 Development server and runtime-asset check (executed)
`npm start` (BROWSER=none, PORT=3000) compiled the whole application, including every
lazy viewer chunk and the real MLightCAD / That Open / web-ifc packages:

```
Compiled with warnings.
webpack compiled with 266 warnings     (0 errors; warnings are pre-existing unused-vars)
```

Then every runtime asset the viewers fetch was requested from the dev server:

```
/cad-workers/mtext-renderer-worker.js      -> 200 (1,198,047 bytes)
/thatopen/thatopen-fragments-worker.mjs    -> 200 (1,332,262 bytes)
/thatopen/web-ifc.wasm                     -> 200 (1,595,268 bytes)
/web-ifc/web-ifc.wasm                      -> 200 (1,595,268 bytes)
```

This confirms the worker/WASM URLs resolve in development — the specific failure mode
that would have made a correctly imported CAD/BIM engine silently dead.

### 6.7 What could not be verified here (and why)

There is no browser automation in this environment (no Playwright/Puppeteer, no
accessible WebGL surface), so the following are **implemented, type/API-checked and
bundled, but not exercised in a browser**:

* MLightCAD opening a DXF, drawing/editing commands, export, pinch/pan on touch;
* That Open loading an IFC, picking a mesh, highlighting, clipping, measurement;
* web-ifc parsing a real IFC in the fallback viewport;
* the 360/390/430 px layouts, drawers, bottom sheets and splitter drag;
* the R3F structure/results viewport (the adapter that feeds it is unit-tested).

Everything that *can* be verified without a browser was verified: API contracts against
the live backend, engine imports against the installed packages (`node_modules`) and
the bundled output, solver connectivity, unit/coordinate mapping, validation, staleness,
lint and the production build.

### 6.7 Commands

```powershell
# backend (this session, verified)
.\.venv-ifc\Scripts\python.exe -m src.Backend.cad_ifc.standalone --host 127.0.0.1 --port 8001

# tests
$env:CI='true'; npx react-scripts test --watchAll=false --runInBand

# production build (heap + source-map wrapper)
$env:BUILD_PATH='.tmp-build'; npm run build

# syntax gate over changed files
node scripts/verify/jsx-parse.mjs <files...>

# lint gate
node_modules\.bin\eslint.cmd --no-eslintrc --config node_modules\eslint-config-react-app\index.js `
  src\components\interop src\config src\state\engineeringModel --ext .js,.jsx --quiet

# dev server + asset smoke test
$env:BROWSER='none'; npm start
```

---

## 7. Design-system audit (mandatory §13, measured)

### 7.1 The reference: Beam Designer Suite

The suite is `src/components/ReinforcedConcrete/Beams/` (`StructuralEngineeeringSuite.jsx`,
`RCBeamDesigner.jsx`, `BeamDrawer.jsx`, `Three.jsx`) and it does **not** carry its own
stylesheet — it expresses its specs through `src/components/shared/ui/tokens.js` plus
Tailwind utilities. Measured from the code (not guessed):

| Property | Reference value | Evidence |
|---|---|---|
| Font family | `Inter, sans-serif` | `src/index.css` `body` |
| Body / label / helper | 14 px (`text-sm`) / 12 px (`text-xs`) / 11 px (`text-[11px]`) | `tokens.text`, `Fields.jsx` |
| Page heading | 16 px phone → 20 px `sm+` | `DocumentShell` `text-base sm:text-xl` |
| Card / section heading | 18 px bold (`text-lg`) / 14 px bold | `StructuralEngineeeringSuite` cards |
| Control height | 44 px (`min-h-[44px]`) phone, 40 px `sm+` | `control.base` |
| Button height | 44 px, `px-4 py-2.5`, 14 px semibold | `action.base` |
| Radius | control 8 px (`rounded-lg`), card 16 px (`rounded-2xl`) | `tokens.radius` |
| Primary colour | blue-600 `#2563eb` (hover blue-700) | `action.primary` |
| Border | gray-200 `#e5e7eb` / dark slate-800 `#1e293b` | `tokens.surface.card` |
| Focus | 2 px blue-600 ring | `index.css` global focus rule |
| Field spacing | label→control 6 px, fields 12–16 px, sections 16–24 px | `Fields.jsx`, `layout.formGrid` |
| Status | badge + label (never colour alone) | `tokens.status` |

These values are now also published as CSS custom properties (`--fundi-*`) in
`src/index.css` with light/dark sets and `.fundi-*` classes, for surfaces that cannot
use Tailwind (third-party viewer chrome, canvas overlays, injected DOM).

### 7.2 Deviations found, and what this session did

| Module | Finding (static scan) | Status |
|---|---|---|
| Framed & Tall builder toolbar | Fixed 50 px tab row, 20 px per-tab padding, 13/14 px hardcoded, no wrapping → overflow at 360 px; inline hex colours ignored dark mode | **Migrated** to tokens (behaviour unchanged) |
| CAD/BIM workbench | Own dark palette, fixed 290/320 px panels, 10–11 px labels, 36 px controls, tabs in one row | **Rebuilt** responsive with shared tokens; viewer canvases intentionally stay dark for drawing contrast |
| Slab design (`ReinforcedConcrete/Slabs`) | 42 duplicated control class strings across three calculators (`px-4 py-2 … rounded-lg`, one dark-only glass variant) | **Migrated**: every control now uses `control.base` (light/dark) or `control.onDark` (the dark glass calculator); zero `px-4 py-2` residues |
| Columns (`Columnmain.jsx`) | 6 `<select>` + 1 local `InputField` with ad-hoc classes, no shared-ui import | **Migrated** to `control.base` (+ `control.select`, `pr-12` for the unit suffix) |
| Foundations — `BsCodes.jsx`, `eurocode_foundation_app.jsx` | 11 ad-hoc control class strings | **Migrated** to `control.base` / `control.select` |
| Foundations — `Foundation_viewer.jsx` | Developer demo page with Arial, green/grey hex buttons, hex warning box; 3 sheet headings forced Arial | **Migrated** (demo UI → tokens/`action`/`status`; headings inherit the shared font). The *drawing sheets* keep their technical `#f5f5f5` background on purpose |
| Swimming-pool takeoff | `swimming_pool.jsx` already used `SelectField`; `PoolSettings.jsx` had 3 bare checkboxes and 2 unstyled range inputs | **Migrated**: 3 × `CheckboxField` (44 px tap row, associated label) and labelled, touch-sized ranges. The 6 remaining `fontSize` hits are three.js `<Text>`/3D annotation props inside the pool scene — scene-engineering, not UI, and deliberately not replaced |
| QS documents (taking-off sheet, dimension paper, BOQ) | Deliberately unchanged — standard documents | Out of scope by the brief |
| Shared dialogs/tables | `TableRegion` / `ViewerModal` already centralised | Already compliant |
| `takeoff2/swimming/Pool3_D.jsx` | Pre-existing ESLint parse error at 185:22; the file is **not imported anywhere** (dead code) | Left untouched; recorded rather than silently deleted |

**Verification of the migration:** every migrated file parses (`jsx-parse.mjs`) and
lints with 0 errors under the `react-app` config; the production build passes. Field
names, state shapes, `onChange` contracts, calculations and payloads were not
touched — only the class strings that define control dimensions, typography, borders,
radius and focus rings.

### 7.3 Why Chrome's "Desktop site" looked better (investigated)

* `public/index.html` already declares `width=device-width, initial-scale=1`, so the
  viewport was **not** misconfigured.
* Desktop-site mode makes Chrome use a ~980 px layout viewport. At 980 px the old
  fixed-width workbench (290 px + 320 px side panels + tabs) and the builder's
  4 × ~100 px tab row fit; at 390 px they did not. The improvement came from *layout
  width*, not from scaling.
* Fix: real responsive layout at 360/390/430 px (drawers, bottom sheet, wrapping tabs,
  fluid viewport, `max-width: 100%` guards), not a forced desktop breakpoint and not
  shrinking the whole page.

---

## 8. Follow-up round: the three previously outstanding engineering actions

### 8.1 Design-system migration of the remaining forms (done)

See §7.2. 42 slab control class strings, 7 column controls, 11 foundation control
strings, the foundation demo UI and the pool settings toggles now use the shared
tokens. Nothing about the engineering inputs changed.

### 8.2 Builder results are revision-stamped (done)

New module `src/components/ReinforcedConcrete/FramedandTall/builderModelAdapter.js`:

* `buildBuilderFingerprint({elements, method, slabLoad})` — stable, order-independent
  hash of every analysis input (ids, types, storey, geometry, section/material/load
  properties, method). Selecting an element or switching view does not change it.
* `builderToCanonicalModel({elements, layers})` — publishes the builder's structure as
  a canonical engineering model: nodes/members for beams, columns and walls, slabs as
  solids, stable ids, geometric sections (A, Iz from width × depth, recorded as a
  warning), materials that keep the builder's grade but **no invented E**, no
  synthesised supports or loads, and storey elevations explicitly `null`/unknown.
* The builder now records `analysisStamp` / `designStamp`; when either fingerprint
  differs from the current structure a visible banner states that the results are
  **STALE** and offers "Re-run analysis". Results are never presented as current once
  the structure changed.
* When embedded in the workbench (`publishToWorkspace`), a completed analysis
  publishes the structure and calls `recordAnalysisDocument(results, {kind:
  'tall-frame', schema: 'fundi.framed_full/1', ...})`, so the results are stored in
  the shared model **stamped with the revision and fingerprint that produced them**.
* `src/state/engineeringModel/core.js` gained per-kind result sets
  (`model.analyses[kind]`), `attachAnalysisDocument`, `getAnalysis` and
  `analysisStatus(model, kind)`; the OpenSees 2D set remains the default slot, so no
  existing consumer changed behaviour.
* The builder's three hardcoded `http://127.0.0.1:8001` calls now use the runtime
  API configuration, so it works from a phone too.

Tests: `builderModelAdapter.test.js` — 17 tests (fingerprint stability/order/
invalidation, geometry mapping, drawable boxes via the 3D adapter, geometric sections,
no invented E, no synthesised supports/loads, slab handling, skipped-element reporting,
unknown elevations, stamping + staleness + refusal without kind/case).

### 8.3 True 3D frame analysis (done, with an explicit input contract)

New backend module `src/Backend/cad_ifc/analysis3d.py` plus a 3D branch in
`scripts/analysis/run_opensees.py`:

* 6 DOF per node (`ndm=3, ndf=6`), `elasticBeamColumn` with **explicit** `E, A, Iy,
  Iz, J, G` and an explicit `vecxz` per member;
* six-component nodal loads, six-DOF restraints, static LoadControl/Linear;
* validation before running: positive properties, references, duplicates, zero
  length, and a **rank test against all six 3D rigid-body modes** (a partly restrained
  frame is refused with the rank, not analysed);
* distributed element loads are **refused in 3D** rather than approximated;
* results carry `dimensionality: 3`, displacements/reactions in 6 components, twelve
  member end forces in local axes, **per-member local axes** (so no viewer guesses
  them) and a six-component equilibrium residual;
* `canonical_to_analysis_3d()` maps a canonical document onto the 3D frame using only
  declared geometry (axis, length/height, centre placement → `<id>#start` / `<id>#end`)
  and requires section constants + E explicitly — it refuses to infer E from a concrete
  grade or an orientation from nothing;
* `POST /api/cad-ifc/analysis` dispatches on `dimensions: 3`; the 2D contract is
  untouched;
* frontend: `runAnalysis3D()` client, and `src/analysis/viewModel3D.mjs` now has a
  **3D branch** that uses the results' own coordinates and local axes, exposes only the
  components the 3D engine returns (axial, shear local y/z, moment local y/z,
  torsion), draws each diagram offset along the axis it acts about, and states that 3D
  diagrams are drawn between member end forces (no interior sampling);
* `Structure3DView` builds its diagram selector from the result's declared units and
  shows whichever verified result set is available (`opensees-3d` preferred over
  `opensees-2d`), with the state belonging to the set being displayed.

Verification (all executed):

```
14/14 test_analysis3d.py
  cantilever tip deflection  uz = -3.214286e-04 m  (closed form -3.214286e-04), residual 7.6e-17
  simply supported central load  uz = -1.607143e-04 m (closed form -1.607143e-04), reactions 500 N, My = 1500 N*m
  cantilever torsion  rx = 1.666667e-04 rad (closed form TL/GJ)
  canonical beam mapped  uz = -3.214286e-04 m ; vertical column mapped  ux = 3.214286e-04 m
  local axes orthonormal + right-handed for an inclined member
  refusals: missing J, missing E, element loads in 3D, unknown node, duplicate ids, no
  supports, unrestrained torsion (rank 3 of 6)

POST /api/cad-ifc/analysis {dimensions: 3}  -> 200
  dimensionality 3, dof 6, uz -3.214285714285714e-4, reaction Fz 1000, My -3000,
  residual 1.5e-16
POST the same body without J -> 422 ; with only ux/uy/uz restrained -> 422

JS: src/analysis/__tests__/viewModel3D-3d.test.js (16 tests) runs against a fixture
captured from that live 3D response, so the adapter is tested on the engine's real
fields, local axes and force ordering.
```

**Still not built (specific):** a *modelling UI* for authoring 3D analytical frames
(nodes, members, section constants, vecxz, supports, loads). The 3D solver, canonical
adapter, API, view model and viewport support all exist and are verified; the
workbench does not yet offer a form to define a 3D model, and the Framed & Tall builder
still uses its own server-side analysis. The next concrete step is a 3D model editor
(or a `builderToAnalysis3D` that requires explicit E, G and section orientation from
the user) — not a change to the solver.

## 9. Unresolved / unverified / next actions

| Item | Cause | Exact next action |
|---|---|---|
| Browser interaction for MLightCAD / That Open / web-ifc / R3F results | No browser automation or WebGL surface in this environment | Run `npm start` + backend, open `/interop/cad-bim`, follow the checklist in §6.7; fix anything the console reports — the code paths and asset URLs are in place |
| Mobile visual layout at 360/390/430 px and landscape | Same | DevTools device emulation (Moto G4 360×640, Pixel 390×844, iPhone 430×932) + a real Android device on the LAN |
| Dev-server asset smoke test | CRA dev compile of this app did not finish within the session's time budget (it compiles thousands of files plus the viewer ESM bundles) | **Done** — see §6.6: dev compile succeeded and all four worker/WASM URLs returned 200 |
| Slab / swimming-pool / foundations / columns form migration | Mechanical, per-module | **Done** — §7.2 |
| Builder results are not revision-stamped | The builder keeps analysis/design results in component state (pre-existing design) | **Done** — §8.2 (fingerprint stamps + `recordAnalysisDocument` + stale banner) |
| 3D solver support | The 2D path is X/Y only by design | **Done** — §8.3 (verified 3D path with an explicit contract) |
| 3D model authoring UI | Genuinely new surface: explicit section constants and orientation must be entered, and inventing them would violate the brief | Build a 3D model editor (or a builder adapter that demands E, G and vecxz explicitly) |
| `takeoff2/swimming/Pool3_D.jsx` | Pre-existing ESLint parse issue in unimported dead code | Delete it (or fix its encoding) in a separate cleanup commit |
| `npm run build` memory | Machine-dependent; wrapper uses 4 GB | Raise `FUNDI_BUILD_HEAP_MB` if the build still hits the limit |
| `model.server` artefacts (DXF/IFC) are served from `public/` | Existing architecture (backend writes into `public/`) | Unchanged; a production deployment needs the backend to write to a served directory |




---


