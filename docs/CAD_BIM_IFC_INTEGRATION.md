# Fundi Studio — CAD + BIM + IFC Integration

Branch: `feature/cad-bim-ifc-integration`
Repository: `C:\Users\HP\Documents\programming\Java script\ReactApps\Services`
Status of this document: report for the first integration increment (audit + smallest
verifiable proof of concept). Claims are marked **VERIFIED** (executed/inspected in this
environment) or **NOT IMPLEMENTED** / **UNVERIFIED**.

---

## 1. Summary

Fundi Studio is a React 19 / Create React App single page application (`react-scripts 5.0.1`)
holding ~30 engineering tools, plus a Python FastAPI backend (`src/Backend/main.py`) that is a
separate process on `127.0.0.1:8001`.

Three different technologies were investigated and each was given a different job, because they
are not interchangeable:

| Concern | Technology | Decision |
|---|---|---|
| 2D CAD authoring and DXF viewing | MLightCAD `@mlightcad/*` 1.7.5 (proven in Fundi Pulse) | **Integrated** (isolated route) |
| BIM viewing/interaction | That Open Components | **Blocked by a `three` version constraint** — analysed, not installed (§5.3) |
| Browser-side IFC parsing | `web-ifc` 0.0.78 (WASM) | **Integrated** (replaces That Open for now) |
| Server-side IFC generation/validation | IfcOpenShell 0.9.0.post1 | **Integrated** (new backend module) |
| Existing 2D drawing authoring | React Konva `CadEngine`/`cad_drawing.jsx` | **Preserved, untouched** |
| Existing 3D rendering | React Three Fiber `visualise_component.jsx` + generators | **Preserved, untouched** |

The incremental result is one new isolated route `/interop/cad-bim` that demonstrates the full
chain for a **real, existing generator (the septic system)**: parameters → canonical engineering
model → IFC4 file + DXF file → persistent element mapping → MLightCAD renders the DXF → web-ifc
renders the IFC → one element selected in one view is identified in the other.

Backend interoperability prototype: `src/Backend/cad_ifc/` (7 modules + router) with a **22-test
suite** (`test_cad_ifc_poc.py`) that all passes, producing an IFC file that
**IfcOpenShell's own validator accepts with zero statements**.

---

## 2. Phase 1 — Repository audit (actual findings)

### 2.1 Project structure

**VERIFIED**

| Item | Finding |
|---|---|
| Framework | React 19.0, Create React App `react-scripts 5.0.1` (webpack 5), JavaScript + some TSX |
| Entry chain | `src/index.js` → `src/App.js` → `src/components/engineering_appp.jsx` (905 lines) |
| Routing | `react-router-dom` 7.5; routes declared inline in `engineering_appp.jsx` (~60 routes) |
| State management | Almost entirely `useState` per screen. `zustand` 5 is a dependency but **no zustand store is used anywhere in `src`** (`src/ui-state/` contains plain controller classes, unused by routes) |
| Shell/launcher | `src/components/components/ChatPage.jsx` is the real navigation model (`navData`) |
| Backend | FastAPI in `src/Backend/main.py` (~500 lines) mounting ~30 routers, run with uvicorn on port 8001; frontend calls it with hard-coded `http://localhost:8001/...` in many components |
| Other Python | 262 backend `.py` files; a second, unregistered family of CAD FastAPI apps under `src/components/Cad_Dwg/*/main.py` |
| Python deps | `src/Backend/requirements.txt` — FastAPI, uvicorn, SQLAlchemy, pandas, numpy, opencv, torch, transformers, **`ezdxf>=1.1.0`, `ifcopenshell>=0.7.0`** (declared twice in the file) |
| Build | `npm run build` (CRA). With `CI=true` it **fails on pre-existing lint warnings**; without `CI` it succeeds (§8) |
| Tests | **No Jest tests exist** (`no *.test.js`, no `setupTests`). Python tests are standalone scripts at repo root (`test_bs8110.py`, `test_drainage.py`, `test_external_works.py`, …), run manually |

### 2.2 Existing 2D system (React Konva)

**VERIFIED**

Route `/drawing` → `CadDrawer` in `src/components/Drawings/cad_drawing.jsx` (2 381 lines).

* **Konva init / rendering** — `cad_drawing.jsx:45` imports `Stage, Layer, Line, Circle, Rect,
  Text, Group, Transformer` from `react-konva`; `konva` 10.0.12 is the runtime.
* **Entity model** — two representations coexist:
  1. `CadEngine` (`src/components/Drawings/engine/CadEngine.js`, 199 lines) holds
     `objects: []`, `layers`, `activeLayerId`, `zoomLevel`, `panOffset`, an observer `Set`,
     a `SnapEngine` and a `CommandController`. Entity kinds are `line|rectangle|circle|arc|polyline`
     with plain `{start,end}` / `{center,radius}` / `{points}` shapes and a `z` field on points.
     Transforms (`moveObjects`, `copyObjects`, `rotateObjects`, `scaleObjects`, `mirrorObjects`)
     rebuild the array. Undo (`applyAction`) only implements `ADD_OBJECT`.
  2. React state in `cad_drawing.jsx` (`objects`, `layers`, `selectedIds`, `history`,
     `historyIndex`, `snapSettings`, `zoomLevel`, `panOffset`, …) which mirrors the engine.
* **Coordinates / units / scale** — model-space coordinates with a screen transform from
  `zoomLevel`/`panOffset`; `gridSpacing` defaults to `1`. There is **no unit system**: a drawing
  unit is implicitly whatever the user means, and nothing records mm/m. Grid and snap work in
  model units.
* **Persistence** — `src/components/Drawings/cadStorageService.js` is a `localStorage` wrapper
  (key `cad_projects`); `cad_drawing.jsx:1497` shows `alert("Project saved locally.")`. The
  File-tab **Save / Open / Export buttons are `alert()` placeholders** (`cad_drawing.jsx:1612`,
  `:1615`, `:1618`). `CadEngine` has **no persistence hook at all** — no engine command calls a
  save or an API.
* **DXF** — the only JS DXF writer in the whole `src` tree is
  `src/components/Drawing_Components/Roads/exportUtils.js:106 exportDXF()`, which emits an
  `ENTITIES`-only fragment (no HEADER, no TABLES, no `$INSUNITS`). DXF *import* exists only on the
  Python side (`ezdxf`, plus `ifcopenshell` for IFC in
  `src/Backend/calculations/Atomationmodels/arch_pro/cad_file_extractor.py:16-21`).
* **Coupling to 3D** — the drawing page is coupled *upwards*: `cad_drawing.jsx:2` imports
  `three`, `:47` imports the R3F visualiser component, and `:48-50` import Konva groups from the
  RC drawers. 2D and 3D share React state inside that one file, not a shared model.

### 2.3 Existing 3D system (React Three Fiber) and generators

**VERIFIED**

* **Canvas setup** — `src/components/Drawings/visualise_component.jsx` (61 KB): R3F `Canvas`,
  `PerspectiveCamera`, `OrbitControls`, an `Environment`, and a `CameraController`
  (`useThree`) implementing front/back/left/right/top/bottom/isometric view modes and a reset.
* **Generator registry** — `src/components/Drawings/componentRegistry.js`:
  * `QS_COMPONENTS` (12 entries: pool, drainage, roof, doorWindow, internalFinishes,
    substructure, electricalPlumbing, staircase, **septic**, externalWorks, superstructure,
    rccSuperstructure) — each `{Scene, Settings, defaultSettings}`.
  * `RC_COMPONENTS` (21 entries: stairs, beams, columns, foundations, walls, slabs, retaining
    wall, tall-frame analysis, wireframe) — each `{Component}`.
* **What a generator actually returns** — React elements only. `SepticScene` is representative:
  `src/components/takeoff2/septik/SepticScene.jsx` returns `<group>` + `<mesh>` + `<boxGeometry>`
  JSX and creates `THREE.MeshStandardMaterial` in a `useMemo`. There is **no model object, no
  JSON, no mesh registry** — the geometry exists only while React renders it.
* **Generator inputs** — the UI form defaults in `src/components/takeoff2/septik/septik_tank.jsx:30`
  (`tankIntL 3.0, tankIntW 2.5, tankDepthInt 2.0, wallThick 0.2, bedThickTank 0.15,
  slabThick 0.2, numBaffles 2, baffleThick 0.2, baffleHeights [1.5, 1.3], manholeIntL 0.7,
  manholeIntW 0.6, manholeDepthInt 0.7, coverL 0.6, coverW 0.45, soakpitDiameter 2.0,
  soakpitDepth 3.0, soakpitWallThick 0.23, pipeDiameter 0.15 …`), mapped to a `visualConfig`
  object at `:93-119` and passed as `buildingData` into the scene. A separate POST to
  `/septicRouter/api/calculate` returns takeoff quantities/BOQ (`:66`).
* **Other septic implementations** (duplicated logic, all real):
  * `src/components/takeoff2/septik/ThreeD.jsx` — imperative three.js builder
    (`buildSepticTank()` returns `THREE.Group`).
  * `src/components/arch_pro/SanitationEngineeringBIM.jsx` — its own `SepticTank` class +
    `SepticTankMesh` R3F component.
  * `src/Backend/.../Sanitary_BIM/septik_tank.py` — a Python `SepticTank` class with
    `to_json()` / `to_gltf()` and hydraulics (`calculate_septic_capacity`,
    `validate_separation_distance`).
* **Persistence / export of 3D** — none. No GLB/OBJ/IFC export exists anywhere in the frontend;
  the Python side produces glTF **as a Python dict**, never a file.
* **Dead generators** — `src/components/Drawings/detailing_3d.jsx` (244 KB) exports 21 detail
  generators (`DrawBeam`, `DrawColumn`, `DrawFlatSlab`, `DrawWaffleSlab`, …). **A repository-wide
  search found zero importers** for that file: it is unreachable.

### 2.4 The working CAD integration in Fundi Pulse (reuse decision)

**VERIFIED** — located, read, and reused.

* **Where**: `C:\Users\HP\Documents\programming\React Native Apps\siteflow-mobile`,
  app `migrated-web-app`, commit **`c64c098` "cad-viewer intergration"**; the on-screen product
  name is "YaMafundi CAD Studio".
* **Packages actually installed there** (`migrated-web-app/node_modules/@mlightcad`):

  | Package | Version | License |
  |---|---|---|
  | `@mlightcad/cad-simple-viewer` | 1.7.5 | MIT |
  | `@mlightcad/cad-simple-ui-plugin` | 1.7.5 | MIT |
  | `@mlightcad/three-renderer` | 1.7.5 | MIT |
  | `@mlightcad/data-model` | 1.15.5 | MIT |
  | `@mlightcad/common` | 1.15.5 | MIT |
  | `@mlightcad/geometry-engine` | 3.15.5 | MIT |
  | `@mlightcad/graphic-interface` | 3.15.5 | MIT |
  | `@mlightcad/mtext-parser` | 1.5.3 | MIT |
  | `@mlightcad/mtext-renderer` | 0.13.3 | MIT |
  | `@mlightcad/shx-parser` | 1.4.5 | MIT |
  | `@mlightcad/emf-converter` | 1.15.5 | Apache-2.0 |

* **How it is initialised** (`src/cad/CadViewerSpike.jsx`, 830 lines):
  `AcApDocManager.tryGetInstance()` → `destroy()` (StrictMode), `acedApplyUiTheme('dark', host)`,
  an **imperatively created container** (`createViewerContainer`), then
  `AcApDocManager.createInstance({container, autoResize, useMainThreadDraw, disableExport})`,
  then a lazy `import('@mlightcad/cad-simple-ui-plugin/register')` →
  `acuiRegisterSimpleUiPlugin(manager.pluginManager, {host, dockPanel, toolbar, layouts})`.
  Opening: `manager.openDocument(fileName, arrayBuffer, {mode: AcEdOpenMode.Write,
  progressiveRendering: false})`, then `manager.sendStringToExecute('zoom\ne\n')`.
  Export: `doc.database.dxfOut(undefined, 6)`.
* **The one non-obvious constraint** that must be honoured (documented in
  `src/cad/viewerHost.js`): the simple-UI plugin reparents every child of its `host`, so React must
  render the host **empty** or React later calls `removeChild` on a reparented node and the app's
  error boundary fires. This was reproduced/understood in Fundi Pulse and is preserved verbatim in
  this integration.
* **Peer constraints of the reused packages** (`cad-simple-viewer@1.7.5`):
  `three ^0.172.0`, `lodash-es 4.17.21`, `@mlightcad/data-model ^1.15.3`,
  `@mlightcad/mtext-parser ^1.5.3`, `@mlightcad/mtext-renderer ^0.13.3`,
  `@mlightcad/three-renderer 1.7.5`. **This repo already has `three 0.172.0`**, so the reuse is
  version-consistent; `lodash-es` (absent here, `lodash` 4.17.21 is present) had to be added.
* **Constraints noted**: the packages are ESM-only (`"type": "module"`, `exports` map with
  `import`/`require`), the UI plugin's assets are CSS/worker-free but it does expect a sized host
  (flex parent), and Fundi Pulse mounts it lazily to keep three + MLightCAD out of the main chunk.
  No licence payment or seat is required (MIT/Apache-2.0); the DXF/DWG *converter* question is
  separate (§6.1).

---

## 3. Phase 2 — Architecture

### 3.1 Concern separation (what was actually built)

```
                 ┌──────────────────────────────────────────────┐
 engineering     │ src/components/takeoff2/septik/…              │  (unchanged)
 parameters      │ Septik form defaults / visualConfig            │
                 └───────────────────────┬──────────────────────┘
                                         │ parameters (metres)
                                         ▼
                 ┌──────────────────────────────────────────────┐
 canonical       │ src/Backend/cad_ifc/septic_model.py           │  renderer-independent
 model           │ build_model(params) -> JSON (elements)        │  + identity + units
                 │ src/Backend/cad_ifc/identity.py, units.py     │
                 └───────┬───────────────────────────┬──────────┘
                         │                           │
             IFC4 (semantic)                DXF (plan + section)
                         ▼                           ▼
        ┌────────────────────────────┐   ┌───────────────────────────────┐
        │ ifc_export.py              │   │ dxf_export.py                 │
        │ IfcOpenShell 0.9 (server)  │   │ ezdxf 1.4.3 (server)          │
        │ IfcWall/IfcSlab/           │   │ FUNDI_MODEL / FUNDI_DIM /     │
        │ IfcPipeSegment + Psets     │   │ FUNDI_ANNO / FUNDI_TITLE /    │
        │ + spatial structure        │   │ FUNDI_MANUAL + XDATA links    │
        └──────────────┬─────────────┘   └──────────────┬────────────────┘
                       │                                │
                       └──────────┬─────────────────────┘
                                  ▼
                 ┌──────────────────────────────────────────────┐
 persistent      │ src/Backend/cad_ifc/mapping.py (SQLite)      │
 mapping         │ internal_id ↔ ifc_guid ↔ dxf_handle ↔ drawing │
                 └───────────────────────┬──────────────────────┘
                                         ▼
                 ┌──────────────────────────────────────────────┐
 browser         │ /interop/cad-bim  (InteropWorkbench.jsx)     │
                 │  • CadDxfViewer    → MLightCAD 1.7.5         │
                 │  • IfcBimViewer    → web-ifc 0.0.78 + three  │
                 │  • link browser    → mapping JSON            │
                 └──────────────────────────────────────────────┘
```

### 3.2 The four things that are often conflated

1. **Rendering geometry in a browser** — MLightCAD (DXF) and three.js/web-ifc (IFC). Both are
   implemented. Neither implies the others.
2. **Editing engineering parameters and regenerating geometry** — **implemented** server-side and
   exposed (`POST /api/cad-ifc/export`, and the workbench's parameter panel). This is the only
   "editing" the PoC performs, deliberately.
3. **Editing arbitrary 3D geometry interactively** — **NOT IMPLEMENTED and not claimed**. Neither
   MLightCAD (2D DXF entities only) nor the web-ifc viewer edits BIM geometry. Fundi Studio's
   existing 2D Konva editor remains the only 3D-free authoring surface.
4. **Exporting interoperable CAD/BIM documents** — **implemented** as real DXF (ezdxf) and real
   IFC4 (IfcOpenShell), both independently re-read and validated (§8).

### 3.3 Why React Three Fiber stays

`@react-three/fiber 9.4` / `@react-three/drei 10.7.6` remain the renderer for every existing 3D
screen (`/visualise` and the RC/QS modules). The integration adds an *adapter* boundary
(canonical model) instead of a renderer swap:

* generators keep their current JSX output — nothing was rewritten;
* the canonical model is produced from the same parameters the generator already uses, so the IFC
  cannot drift from the preview;
* a future "render from canonical model" refactor is now possible but is **not** part of this
  increment (that would be a rewrite of 30+ scenes).

---

## 4. Phase 3 — Dependencies pulled and prepared

### 4.1 Frontend (npm, existing `package-lock.json` preserved/updated)

**VERIFIED installed** (`npm install`, 19 packages, no peer conflicts):

| Package | Version | Why |
|---|---|---|
| `@mlightcad/cad-simple-viewer` | `^1.7.5` | proven Fundi Pulse CAD engine/viewer |
| `@mlightcad/cad-simple-ui-plugin` | `^1.7.5` | proven toolbar/dock UI, `pluginManager` registration |
| `@mlightcad/three-renderer` | `^1.7.5` | three.js render backend for the CAD engine |
| `@mlightcad/data-model` | `^1.15.5` | DXF database/entity model |
| `@mlightcad/mtext-parser` | `^1.5.3` | peer requirement |
| `@mlightcad/mtext-renderer` | `^0.13.3` | peer requirement |
| `lodash-es` | `^4.17.21` | peer requirement of the viewer (exact `4.17.21`) |
| `web-ifc` | `^0.0.78` | browser-side IFC parsing (WASM), MPL-2.0 |

Not added: `three` (already `0.172.0`, satisfies every MLightCAD peer), `lodash` untouched,
no React/React Router/Konva/R3F upgrade.

### 4.2 Backend (Python)

`src/Backend/requirements.txt` **already declared** `ezdxf>=1.1.0` and `ifcopenshell>=0.7.0`;
nothing had to be added to the file. In this environment:

* `ezdxf 1.4.3` — already importable in the system Python.
* `ifcopenshell` — **not installed**; installed into a local venv as
  `ifcopenshell 0.9.0.post1` (wheel `ifcopenshell-0.9.0.post1-py313-none-win_amd64`, CPython 3.13)
  plus `lark 1.3.1` (required for `ifcopenshell.express` / `util.selector`; without it
  IfcOpenShell prints "No stream support").

Reproducible install (why it is not a plain `pip install`): in this sandbox pip's wheel-metadata
download is denied (`PermissionError` on `…whl.metadata`, both in `%TEMP%` and in the workspace),
so the wheel was fetched directly and installed from file:

```powershell
python -m venv --without-pip --system-site-packages .venv-ifc
# wheel downloaded from pypi.org/pypi/ifcopenshell/0.9.0.post1/json
.\.venv-ifc\Scripts\python.exe -m pip install --no-deps .pip-dl\ifcopenshell-0.9.0.post1-py313-none-win_amd64.whl
.\.venv-ifc\Scripts\python.exe -m pip install --no-deps .pip-dl\lark-1.3.1-py3-none-any.whl
```

On a normal machine `pip install "ifcopenshell>=0.8" lark` inside the backend environment is the
whole requirement. **No path or credential is hard-coded**; `DEFAULT_OUT_DIR` / `DEFAULT_DB_PATH`
in `pipeline.py` are derived from the repository location.

### 4.3 No vendoring, no submodules

Nothing was cloned or vendored. All three integrations are consumed as packages. The one static
asset added is `public/web-ifc/web-ifc.wasm`, copied from `node_modules/web-ifc` because the WASM
must be served over HTTP (`IfcAPI.SetWasmPath('/web-ifc/')`).

---

## 5. Phase 4 — What was implemented

### 5.1 Step 1 — CAD (MLightCAD), reused from Fundi Pulse

**VERIFIED by build**; browser behaviour verified by construction (see §9 limitations).

* `src/components/interop/viewerHost.js` — the proven imperative-container helper, with the
  React-reparenting rationale documented.
* `src/components/interop/CadDxfViewer.jsx` — same initialisation sequence as Fundi Pulse
  (`tryGetInstance → destroy`, `acedApplyUiTheme`, `createViewerContainer`,
  `AcApDocManager.createInstance`, lazy `…/register` + `acuiRegisterSimpleUiPlugin`,
  `openDocument`, `zoom e`, `dxfOut` export), plus: loads the DXF **generated by the Python
  adapter**, reports the parsed entity count and layer list, and exposes an `Open DXF` file input.
* Existing `/drawing` (Konva) is untouched and unmodified.

#### 5.1.1 One real build incompatibility found and fixed (CRA vs Vite)

The first build after installing MLightCAD failed with:

```
Module not found: Error: Can't resolve 'three/examples/jsm/libs/stats.module'
in '…/node_modules/@mlightcad/cad-simple-viewer/dist'
```

Cause: `@mlightcad/cad-simple-viewer` 1.7.5 **and** 1.7.6 import three addons without the file
extension (`three/examples/jsm/libs/stats.module`, `…/controls/OrbitControls`), while three 0.172
declares `"./examples/jsm/*": "./examples/jsm/*"`, which maps those specifiers to non-existent
extensionless files. MLightCAD is ESM (`"type": "module"`), so webpack 5 (CRA) resolves in strict
ESM mode and will not append `.js`. Fundi Pulse never hits this because it uses **Vite**, whose
dependency pre-bundling does add extensions.

Fix: `scripts/fix-three-exports.js`, run from npm's `postinstall`, applies three additive,
idempotent, filesystem-verified repairs **inside `node_modules` only**:

1. exact `exports` entries for the extensionless three addons
   (`…/libs/stats.module`, `…/controls/OrbitControls`);
2. explicit `/index.js` (or `.js`) targets for relative directory imports in the
   `@mlightcad/*` ESM sources — without this, webpack silently drops whole re-export groups and the
   build fails with *"export 'acdbHostApplicationServices' was not found in
   '@mlightcad/data-model'"* (that message is a symptom, not a missing export: the symbol **is**
   exported, from `./base/`);
3. `exports` subpaths that point at TypeScript sources (`…/icons` → `./src/ui/icons.ts`, which CRA
   cannot parse) repointed at the shipped compiled file.

The script is a resolver workaround for third-party packaging defects, isolated in one file. On a
clean install it reported 2 exports entries (three) + 2 491 relative specifiers across 582 files +
2 TypeScript export targets. It becomes a no-op once the packages fix their imports or CRA is
replaced by a bundler with relaxed resolution.

### 5.2 Step 3 — IFC generation (IfcOpenShell), server side

`src/Backend/cad_ifc/ifc_export.py` writes a **semantic IFC4** file, not meshes:

* spatial structure: `IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey` with
  `IfcRelAggregates`, elements via `IfcRelContainedInSpatialStructure`;
* units: `IfcUnitAssignment` of SI `METRE / SQUARE_METRE / CUBIC_METRE / RADIAN`;
* 18 elements for the default parameters — `IfcWall ×10` (4 tank + 4 chamber + 2 baffles),
  `IfcSlab ×5` (base, cover, chamber base/cover slab/cover), `IfcPipeSegment ×3`
  (inlet, outlet, tank→chamber);
* geometry: `IfcExtrudedAreaSolid` over `IfcRectangleProfileDef` / `IfcCircleProfileDef`,
  inside `IfcShapeRepresentation(SweptSolid)`; horizontal pipes are placed with an
  `IfcAxis2Placement3D` whose axis is +X;
* semantics: `IfcMaterial` (`Concrete C25/30`, `uPVC`, `Cast iron`) via `IfcRelAssociatesMaterial`;
* identity: `Pset_FundiIdentity` (`FundiElementId`, `FundiModelId`, `FundiGenerator`,
  `FundiGeometryFingerprint`, `FundiIfcClass`, `FundiLevelId`) and
  `Pset_FundiEngineering` (engineering parameters + `GrossVolume`) on every element;
* `GlobalId` **derived deterministically** from the internal element id (UUIDv5 in a fixed
  namespace, encoded to the IFC 22-char base64 alphabet) so re-export reproduces the same ids.

Verification hooks in the same module: `read_ifc_summary()` (reopens the file),
`validate_ifc_file()` (`ifcopenshell.validate` with a JSON logger), and
`iter_element_geometries()` (IfcOpenShell geometry kernel, world coordinates).

### 5.3 Step 2 — BIM viewer: That Open evaluated, blocked, and replaced

**That Open analysis (VERIFIED against the npm registry):**

| `@thatopen/components` | peer `three` | peer `web-ifc` |
|---|---|---|
| 3.4.0 – 3.4.9 (latest 3.4.9, MIT) | `>=0.182.0` | `>=0.0.77` |
| 3.2.0 – 3.3.3 | `>=0.175.0` | `>=0.0.72 … 0.0.74` |
| 3.1.0 – 3.1.5 | `>=0.175.0` | `0.0.69 … >=0.0.71` |
| 2.4.8 | `^0.160.1` | `0.0.66` |

**The blocker is precise:** every published version requires a `three` newer than this
repository's `0.172.0`. `three` cannot simply be bumped, because
`@mlightcad/three-renderer@1.7.5` declares `peerDependencies.three "^0.172.0"` and the existing
3D system (`@react-three/fiber 9.4`, `@react-three/drei 10.7.6`, `@react-three/postprocessing 3`,
`postprocessing 6.39`) is only validated at this version. Upgrading `three` is a
**cross-cutting change to every 3D screen**, which this increment must not make silently.

**Consequence and mitigation:** the BIM viewer was implemented on `web-ifc` + `three 0.172`:
`src/components/interop/IfcBimViewer.jsx` provides model loading, orbit/pan/zoom
(`OrbitControls`), click selection (raycasting), property inspection (Ifc class, `GlobalId`,
`Name`, `PredefinedType`, `Tag`, `expressID` read via `IfcAPI.GetLine`), and Y-axis clipping
(`renderer.localClippingEnabled` + a movable `THREE.Plane`). The component is deliberately
isolated (`ifcUrl`, `selectedGuid`, `onSelect` props) so a That Open adapter can replace its
internals without touching the workbench.

**That Open upgrade path (recommended, not done):** upgrade `three` to ≥0.182 together with
`@mlightcad/three-renderer` (check whether a ≥1.8 release accepts it), re-run every R3F screen,
then swap `IfcBimViewer`'s internals to `@thatopen/components` + `@thatopen/fragments` and gain
`IfcLoader`, `Clipper`, `Highlighter`, `ItemsFinder`, `Measurement` and the drawing/projection
features described in §6.2.

### 5.4 Step 3 (continued) — DXF generation and the CAD↔IFC link

`src/Backend/cad_ifc/dxf_export.py` writes a real drawing with `ezdxf` (R2010,
`$INSUNITS = 4` millimetres, `$MEASUREMENT = 1`):

* **plan** of every element on `FUNDI_MODEL`, **section A-A** below it, restricted to elements
  whose Y extent actually straddles the section plane (so the north/south walls are *not* cut);
* generated drafting on separate layers: `FUNDI_DIM` (linear dimensions), `FUNDI_ANNO`
  (view titles, "UNITS: MILLIMETRES" note), `FUNDI_TITLE` (title block box + sheet text);
* `FUNDI_MANUAL` reserved for user drafting — **never** touched by the exporter, together with
  any layer the exporter does not own;
* every model entity carries **XDATA** in the `FUNDI` application: a versioned payload
  `FUNDI1|<model>|<internal_id>|<ifc_guid>|<view>|<unit_scale>`. All string XDATA shares DXF group
  code 1000, so a single delimited payload is used instead of several indistinguishable tags.

`src/Backend/cad_ifc/mapping.py` persists the link in SQLite (`fundi_models`, `fundi_drawings`,
`fundi_artifacts`, `fundi_element_links`) with per-link status
`ok | regenerated | deleted | stale | conflict | unit_mismatch`, plus artifact size/mtime so an
external edit can be detected. Two recovery paths exist: rebuild from DXF XDATA
(`rebuild_from_dxf`) and copy re-identification (`handle_copies`, `…#copy2`).

`src/Backend/cad_ifc/router.py` exposes `/api/cad-ifc/{units,health,model,links,export,file}` and
is mounted in `src/Backend/main.py` inside a `try/except` so a missing optional dependency cannot
stop the existing backend from starting.

### 5.5 The isolated route

`src/components/interop/InteropWorkbench.jsx`, mounted at **`/interop/cad-bim`** in
`engineering_appp.jsx` (one import + one `<Route>`). It shows the link browser (internal id,
Ifc class, DXF handle, GlobalId, status), a parameter panel that calls
`POST /api/cad-ifc/export`, and the two viewers in tabs. Selecting a link highlights/zooms the IFC
mesh; clicking an IFC mesh resolves back to the internal id through the mapping.

---

## 6. The five new investigations

### 6.1 MLightCAD: entity model, handles, layers, units, DWG

**VERIFIED by reading the shipped type declarations** of `@mlightcad/cad-simple-viewer@1.7.5`,
`@mlightcad/data-model@1.15.5`:

* **Entity model** — AcDb-style in-memory database: `manager.curDocument.database` →
  `tables.blockTable.modelSpace` (a container with `newIterator()`), entities expose
  `handle`, `layer`/`layerName`, and a DXF type via the renderer. This is the same iteration this
  integration uses to count entities and layers after loading a DXF.
* **Handles** — per-file hexadecimal handles, assigned by the engine/database. They are **not**
  stable identities: a re-export assigns new ones, and copying an entity creates a new handle
  (while our XDATA internal id is copied with it — hence `handle_copies`).
* **Layers** — full layer table (`doc.layers.add`/lookup on the ezdxf side; layer table + layer
  panel UI exposed by the viewer plugin).
* **Blocks/layouts** — the viewer is built around `blockTable` (model space + paper-space layouts)
  and supports layout switching, i.e. it can hold title blocks/sheets; the `dxfOut` writer
  preserves them.
* **Units** — the engine works in **drawing units**; units come from the DXF header
  (`$INSUNITS`). This is why the exporter writes mm + `$INSUNITS = 4` explicitly and why
  `check_unit_consistency()` exists.
* **Read/edit/save APIs used here**: open `AcApDocManager.openDocument(name, ArrayBuffer,
  {mode: AcEdOpenMode.Write})`; command execution `sendStringToExecute` (e.g. `zoom e`, `pan`,
  `select`); save/export `doc.database.dxfOut(_, 6)`. Interactive editing of entities is provided
  by the viewer's own commands/toolbar (`AcApSelectCmd`, draw/modify commands), not by a public
  "set geometry" API.
* **Selection by handle** — **not exposed** in 1.7.5: highlighting requires an object id plus a
  view implementing `highlight(ids: AcDbObjectId[])` (`AcTrView2d.highlight`, found in the
  declarations), and no documented handle→objectId lookup was found. `CadDxfViewer.tryFocusEntity`
  therefore probes at runtime and reports honestly instead of pretending to highlight.
* **DWG** — MLightCAD is a **DXF** engine. DWG requires a converter. The repo already has the
  related Python path: `src/Backend/.../cad_file_extractor.py` imports `ezdxf.addons.odafc` and
  contains a commented `odafc.win_exec_path` hook, i.e. DWG support historically depended on the
  **ODA File Converter** (`ODAFileConverter.exe`). Implications: an extra native install per
  machine, ODA's own licence terms for the converter (not the same as MLightCAD's MIT), and a
  server/desktop component rather than a browser capability. **Not implemented in this
  increment**; the frontend accepts `.dxf` only.

### 6.2 IFC ↔ drawing integration, and That Open's drawing editor

**Evaluation, not implementation.** That Open Components ships a *drawing/projection* stack: model
edges are projected to planes to produce plans/sections/elevations, with annotations, dimensions,
sheet layouts and DXF export. It is designed to generate drawings **from the BIM model**.

Consequences for this architecture:

* It is **complementary** to MLightCAD, not a replacement: That Open would *generate* view
  geometry from IFC; MLightCAD would *edit* the resulting DXF. Fundi already needs both (existing
  hand-drafted sheets, plus model-derived plans).
* It was **not usable in this increment** because of the `three` peer constraint (§5.3), so no
  projection pipeline is claimed.
* **Keep the responsibilities separate**: MLightCAD owns 2D CAD/DXF editing; That Open (later)
  owns BIM viewing and model-derived drawings; IFC owns exchange. The workbench already routes
  through both without either owning the other's data.

**IFC entities for annotations/drawings (design only).** An IFC file does **not** automatically
contain an editable CAD drawing. What IFC4 offers:

* `IfcAnnotation` (+ `IfcAnnotationTypeEnum` via `ObjectType`) for annotation objects, related to
  geometry by `IfcRelContainedInSpatialStructure` or to elements by `IfcRelAssignsToProduct`;
* `IfcRelAssociatesDocument` → `IfcDocumentReference` / `IfcDocumentInformation` to reference an
  external drawing (e.g. the DXF) with a `Location`, `Identification` and `Description`;
* `IfcGroup` / `IfcSystem` / `IfcZone` for logical groupings (e.g. "septic system");
* `IfcRelAssignsToGroup`, `IfcRelConnectsElements`, `IfcRelVoidsElement`
  (+`IfcOpeningElement`) for relationships we do not yet emit (the access opening is currently
  recorded as properties, not as a void);
* presentation and sheet structure are **not** part of IFC — `IfcDraughtingPreDefinedColour`/
  `IfcStyledItem` exist, but layers, dimensions, hatches, title blocks and sheets are a CAD-format
  concern. A complete editable drawing therefore cannot be round-tripped through IFC alone.

Practical plan: emit `IfcAnnotation` + `IfcRelAssociatesDocument` pointing at the generated DXF in
a later step, and keep dimensions/hatches/title blocks in DXF (as the exporter already does).

### 6.3 Shared engineering identity

Implemented (`identity.py`, `mapping.py`):

* **Internal id** = `"{model}.{role}[~index]"`, e.g. `septic-system.tank.wall.north`,
  `septic-system.tank.baffle~2`. Stable for the element's lifetime, format-independent,
  XDATA-safe and URL-safe.
* **IFC GlobalId** = `uuid5(FUNDI_IDENTITY_NAMESPACE, internal_id)` → 22-char IFC base64. Stable
  across regeneration **by construction** (verified by test:
  `test_ifc_guids_survive_regeneration`).
* **CAD handle** = whatever the DXF writer/editor assigned, read back from the written file
  (`scan_dxf_links`), never assumed.
* **Survival rules** (each has a test):
  * *CAD editing* — the entity keeps its handle and its XDATA, so the link survives;
  * *IFC regeneration* — GlobalIds are unchanged; geometry hash changes are recorded as
    `regenerated`;
  * *copying* — duplicate internal ids inside one view are re-identified `…#copy2`
    (`test_copied_entity_is_reidentified`);
  * *deletion* — the element is marked `deleted` rather than having its row silently dropped
    (`test_deleted_element_is_marked_not_silently_dropped`); a CAD entity removed from the drawing
    marks the link `stale` (`test_entity_missing_from_plan_view_is_stale_even_if_section_survives`);
  * *re-export* — one row per element, plan handle authoritative, revision incremented;
  * *data loss* — `rebuild_from_dxf` reconstructs the mapping from the drawing itself
    (`test_mapping_survives_db_loss_and_rebuilds_from_dxf`).
* **Persistence** — SQLite (`fundi_element_links`), *not* viewer state, *not* `localStorage`.

### 6.4 Coordinates, units, datums

Implemented in `units.py` and enforced by tests:

| Aspect | Contract |
|---|---|
| Canonical unit | **metre** (matches existing generator inputs, e.g. `intL = 3.0`) |
| IFC unit | metre, declared `IfcSIUnit LENGTHUNIT METRE` |
| DXF unit | **millimetre**, `$INSUNITS = 4`, `$MEASUREMENT = 1`, scale ×1000 |
| Canonical frame | right-handed, **Z-up** … `IFC_X = R3F_X`, `IFC_Y = -R3F_Z`, `IFC_Z = R3F_Y` |
| Origin | centre of the tank base slab at its underside; `z = 0` = finished ground level |
| Datum | levels list (`L0` ground, `IfcBuildingStorey Elevation = 0.0`); buried elements are at negative Z and are **not** re-offset |
| Precision | `TOLERANCE_M = 1e-6`, `TOLERANCE_MM = 1e-3`; IFC context precision `1e-5` |
| Offset detection | `geometry_bounds_mm()` vs the model; a translated DXF no longer matches the model origin (`test_coordinate_offset_is_detected_by_geometry`) |
| Unit mismatch | unknown or different unit raises `UnitMismatchError`; `check_unit_consistency()` flags a DXF whose `$INSUNITS` or per-entity scale was altered (`test_unit_mismatch_is_detected`) |

Engineering dimensions are preserved end to end: the same 3.4 m base slab is 3.4 m in the
canonical model, a 3400 mm `LWPOLYLINE` in the DXF (asserted vertex-to-vertex) and a 3.4 m
`IfcExtrudedAreaSolid` in the IFC (asserted from the IfcOpenShell geometry kernel's bounding box).

### 6.5 Controlled synchronisation

**Implemented (one direction + guards):**

1. *Parameters → geometry → both artefacts*: `POST /api/cad-ifc/export` rebuilds the canonical
   model, regenerates IFC and DXF, re-syncs the mapping, and only then bumps the revision.
2. *Drafting preservation*: the exporter replaces only its own layers; `FUNDI_MANUAL` and user
   layers survive (`test_manual_drafting_survives_regeneration` adds a `FUNDI_MANUAL` note and a
   user layer entity, changes `tank_int_l` to 3.6, and asserts both entities still exist while the
   model geometry grew to a 4.0 m external length).
3. *Conflict instead of silent overwrite*: artifact size/mtime is recorded at export; if the IFC
   was modified outside Fundi **and** the geometry changed, every affected link becomes `conflict`
   and the API refuses to pretend the files agree
   (`test_external_ifc_edit_is_flagged_as_conflict`).
4. *Staleness is explicit*: `stale` (entity missing), `deleted` (element gone),
   `unit_mismatch` (re-scaled file) are all surfaced in the link browser.

**NOT implemented (must not be claimed):**

* **Reverse direction**: regenerating plan/section drawings *from* the IFC/BIM model
  (That Open's projection) — blocked with That Open (§5.3).
* **Editing BIM geometry in the browser** and writing it back — no.
* **True bidirectional sync** of CAD edits into the engineering model — the DXF is a *projection*;
  editing it does not update `septic_model`. What exists is detection (stale/conflict), not
  merge.
* **IFC import into the mapping** (`rebuild_from_ifc`) — the property set is emitted, the importer
  is not written.
* `IfcOpeningElement`/`IfcRelVoidsElement` for the access opening, and `IfcAnnotation` /
  `IfcRelAssociatesDocument` — designed (§6.2), not emitted.

---

## 7. Files changed / added

**Added — backend interoperability layer** (`src/Backend/cad_ifc/`)

| File | Purpose |
|---|---|
| `__init__.py` | package surface |
| `identity.py` | internal ids, deterministic IFC GlobalIds, fingerprints, copy identity |
| `units.py` | metre/mm contract, conversions, R3F↔canonical transforms, unit mismatch errors |
| `septic_model.py` | canonical model for the real septic generator (geometry transcribed from `SepticScene`) |
| `ifc_export.py` | semantic IFC4 writer + read-back, validator, geometry-kernel probe |
| `dxf_export.py` | DXF plan/section writer, XDATA links, unit checks, drafting preservation |
| `mapping.py` | SQLite persistent mapping, status state machine, conflict detection, recovery |
| `pipeline.py` | end-to-end run + CLI |
| `router.py` | FastAPI endpoints `/api/cad-ifc/*` |

**Added — frontend**

| File | Purpose |
|---|---|
| `src/components/interop/viewerHost.js` | proven MLightCAD host/container helper (React reparenting invariant) |
| `src/components/interop/CadDxfViewer.jsx` | MLightCAD 1.7.5 viewer loading the generated DXF (+DXF export) |
| `src/components/interop/IfcBimViewer.jsx` | web-ifc + three viewer: load, orbit/pan/zoom, select, properties, clipping |
| `src/components/interop/InteropWorkbench.jsx` | `/interop/cad-bim` page: link browser, both viewers, regeneration |

**Added — tests / artifacts**

| File | Purpose |
|---|---|
| `test_cad_ifc_poc.py` | 22 proof-of-concept tests (runs with or without pytest) |
| `public/ifc/septic-system.{ifc,dxf,model.json,links.json}` | real generated artefacts so the route works without the backend |
| `public/web-ifc/web-ifc.wasm` | web-ifc runtime asset (MPL-2.0, copied from the package) |

**Modified**

| File | Change |
|---|---|
| `package.json` / `package-lock.json` | 7 CAD + 1 IFC packages added (versions above) |
| `src/Backend/main.py` | guarded mount of the `cad_ifc` router at `/api/cad-ifc` |
| `src/components/engineering_appp.jsx` | one import + one additive route `/interop/cad-bim` |
| `.gitignore` | allowlist entries so the new source/artifact/report files can be tracked |

**Not modified at all**: `src/components/Drawings/*` (Konva engine, `cad_drawing.jsx`,
`visualise_component.jsx`), `componentRegistry.js`, every generator (`SepticScene.jsx`,
`ThreeD.jsx`, RC/steel/timber/masonry modules), `cadStorageService.js`, the DXF/road exporters,
Fundi Pulse.

---

## 8. Verification evidence

### 8.1 Build

| Run | Command | Result |
|---|---|---|
| Baseline (before any change) | `npm run build` | **success** — "The build folder is ready to be deployed." |
| Baseline with `CI=true` | `CI=true npm run build` | **fails** — pre-existing lint warnings treated as errors (`no-unused-vars` across many files, `react-hooks/exhaustive-deps`, `import/no-anonymous-default-export`). Pre-existing, unrelated to this work. |
| After CAD + BIM viewers (first attempt) | `npm run build` | **failed**: (1) `Module not found: three/examples/jsm/libs/stats.module` → fixed by `scripts/fix-three-exports.js` (§5.1.1); (2) after that fix, `Can't resolve './base/'` in `@mlightcad/data-model/lib` + a `.ts` exports target → same script; (3) finally **`FATAL ERROR: Reached heap limit … JavaScript heap out of memory`** at the default heap. |
| After CAD + BIM viewers (final) | `NODE_OPTIONS=--max-old-space-size=6144 npm run build` | **success** — "Compiled with warnings." / "The build folder is ready to be deployed." Exit 0. |

**Build memory requirement (new, must be documented for CI).** Bundling the MLightCAD ESM build
plus the existing app exceeded Node's default heap (OOM at ~2 GB of a 2 034 MB mark-compact).
`--max-old-space-size=6144` is required; the build took ~40 min on this machine. On a machine with
less RAM, or in CI, set the same environment variable (or add a thin wrapper script) — otherwise
`npm run build` will abort with heap exhaustion even though the code is correct.

**Warnings emitted by the successful build (non-fatal, all third-party):**

* `Module not found: Error: Package path ./dist/cad-simple-viewer.js / .umd.cjs /
  mtext-renderer-worker.js is not exported from package @mlightcad/cad-simple-viewer` — these come
  from MLightCAD's own optional worker/fallback loading. Consequence to keep in mind: MTEXT text
  inside DXF may render on the main thread instead of via its worker. Not exercised by the current
  sample drawing (it contains no MTEXT).
* `Failed to parse source map …@mlightcad/…/*.ts` and `…@mediapipe/tasks-vision/…` — shipped
  `.map` files referencing sources that are not published. Cosmetic.

**Bundle size impact (measured):** `main.<hash>.js` is now **12 875 KB** (plus a 37 MB map), because
`InteropWorkbench` (and therefore MLightCAD + three) is imported statically from the router. The
proven Fundi Pulse app avoids this by `React.lazy`-loading the CAD page. This is recorded as the
first optimisation step in §10 rather than silently accepted.

### 8.2 Python proof-of-concept tests

```
python .venv-ifc\Scripts\python.exe test_cad_ifc_poc.py
22/22 tests passed      (exit code 0)
```

Cover: identity determinism, unit conversion/mismatch, R3F↔canonical transforms, generator
geometry equality, IFC real-file checks (STEP header, IFC4, spatial structure, SI units, Psets,
materials, geometry kernel vertices, **validator with 0 statements**), IFC bbox vs canonical
dimension, DXF real-file checks (`$INSUNITS`, mm vertex width, layers, section cut filtering,
unit consistency), persistent one-to-one mapping, handle/GlobalId lookup both ways, GUID stability,
parameter-change regeneration, deleted element, deleted CAD entity, plan-view staleness, unit
mismatch, coordinate offset, copy re-identification, drafting preservation, external-edit
conflict, mapping rebuild after DB loss.

### 8.3 Generated IFC (default parameters) — re-read from disk

```
schema: IFC4            elements: 18    property sets: 36
by class:  IfcPipeSegment 3 · IfcSlab 5 · IfcWall 10
spatial:   IfcSite "Site" · IfcBuilding "Septic system" · IfcBuildingStorey "Ground level"
units:     LENGTHUNIT:METRE · AREAUNIT:SQUARE_METRE · VOLUMEUNIT:CUBIC_METRE · PLANEANGLEUNIT:RADIAN
materials: Cast iron · Concrete C25/30 · uPVC
identity:  18 × Pset_FundiIdentity (FundiElementId present on every element)
validator: ifcopenshell.validate → 0 statements (ok)
geometry:  geometry kernel returned a mesh for all 18 elements
```

### 8.4 Independent interoperability checks

Not satisfied by "it displays in our own viewer". Performed instead:

1. `ifcopenshell.validate` (the reference implementation's schema/semantic validator) → **0 errors**.
2. Re-open from disk with `ifcopenshell.open` and re-read classes, Psets, units, materials.
3. `ifcopenshell.geom` kernel meshing of every element (vertex counts + world-coordinate bboxes).
4. DXF re-read with `ezdxf.readfile` + `doc.audit`-level checks (`$INSUNITS`, entity geometry in
   mm, layer presence) and re-parse of its XDATA.
5. Cross-check that the IFC bbox equals the canonical dimension and the DXF vertex span equals the
   same dimension ×1000.

**Still open for full external validation:** opening the IFC in a third-party BIM application
(BlenderBIM/Bonsai, Revit, Solibri) and the DXF in AutoCAD/Revit. This cannot be done inside this
environment; the artefacts are committed at `public/ifc/septic-system.{ifc,dxf}` for exactly that
check.

---

## 9. Working vs not implemented

**Working (verified by execution)**

* audit findings above;
* canonical model + identity + units + persistent mapping;
* real IFC4 generation, validation, geometry kernel read-back;
* real DXF generation (mm, layers, dimensions, title block, section cut, XDATA), drafting
  preservation, unit/offset/copy/deletion/conflict detection;
* FastAPI surface `/api/cad-ifc/*` and its guarded mounting;
* 22/22 tests;
* frontend compiles with MLightCAD 1.7.5 + web-ifc 0.0.78 alongside the untouched R3F stack.

**Implemented but verified only up to build/compile (browser runtime NOT verified in this
environment)**

* `/interop/cad-bim` route and both viewers: MLightCAD DXF load, web-ifc IFC parse/render,
  selection, property panel, clipping, and the link browser's selection sync. A browser check is
  the first thing to do next (§10).
* MLightCAD entity focus-by-handle: attempted with feature detection; expect a graceful
  "no object-id highlight API" message rather than a highlight.

**Not implemented**

* That Open Components installation (blocked by `three` peer range, §5.3);
* model-derived drawings (That Open projection / drawing editor);
* `IfcAnnotation`, `IfcRelAssociatesDocument`, `IfcOpeningElement` voids;
* IFC import back into the mapping (`rebuild_from_ifc`);
* reverse sync DXF→model; interactive 3D/BIM geometry editing;
* DWG (needs ODA File Converter + its licensing);
* replacing the existing Konva editor or the R3F default viewer (deliberately not done).

---

## 10. Next smallest implementation step

**1. Lazy-load the workbench so the main bundle returns to its previous size (small, high value).**
`InteropWorkbench` is currently imported statically by the router, which pushed
`main.js` to 12 875 KB for every route. Wrap the element the way Fundi Pulse does:

```jsx
const InteropWorkbench = React.lazy(() => import('./interop/InteropWorkbench'));
// <Route path="/interop/cad-bim" element={
//   <React.Suspense fallback={null}><InteropWorkbench isDark={isDark} /></React.Suspense>} />
```

Then re-run `NODE_OPTIONS=--max-old-space-size=6144 npm run build` and confirm the MLightCAD/three
code moved into its own chunk and that the other routes' initial payload is unchanged.

**2. Browser verification of `/interop/cad-bim` (30 min).** `npm start`, open the route, confirm:
IFC loads with 18 meshes and a mesh count matching the link list; clicking a mesh selects the
linked row; the DXF renders with 32 linked entities and 4 layers; "Export DXF" produces a file the
regenerate path can re-open. Record the exact console output for the MLightCAD focus probe.

**3. If step 2 passes — add `IfcRelAssociatesDocument` + `IfcAnnotation` (small, testable).**
Emit a document reference to the generated DXF (`Identification`, `Location`, MIME type) and one
`IfcAnnotation` per drawing view, with a test asserting they survive `ifcopenshell.validate`.

**4. Then the `three` decision.** Either stay on web-ifc, or schedule the
`three 0.172 → ≥0.182` upgrade as its own branch (R3F/drei/MLightCAD/That Open all re-validated)
and only then swap `IfcBimViewer` internals to `@thatopen/components`.

---

## 11. Command reference

```powershell
# Backend: create the environment (once)
python -m venv --without-pip --system-site-packages .venv-ifc
# then install ifcopenshell (+lark) from wheels, see §4.2

# Generate/refresh the canonical model, IFC, DXF, mapping and JSON documents
.\.venv-ifc\Scripts\python.exe -m src.Backend.cad_ifc.pipeline

# Proof-of-concept tests (with or without pytest)
.\.venv-ifc\Scripts\python.exe test_cad_ifc_poc.py
.\.venv-ifc\Scripts\python.exe -m pytest test_cad_ifc_poc.py -v

# Frontend
npm start                 # dev server, then open /interop/cad-bim

# Production build: the MLightCAD bundle needs a larger heap than Node's default
$env:NODE_OPTIONS = "--max-old-space-size=6144"
npm run build             # do not set CI=true: pre-existing warnings become errors

# Backend API (needs the backend's own dependencies)
uvicorn src.Backend.main:app --port 8001 --reload
#   GET  /api/cad-ifc/health
#   POST /api/cad-ifc/export      {"params": {"tank_int_l": 4.0}}
#   GET  /api/cad-ifc/links/septic-system
```
