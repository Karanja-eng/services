# Task 1 — The editable 2D CAD workspace (MLightCAD)

Status: **integrated**; Python and build-level evidence is verified in this
repository. Interactive browser behaviour is **UNVERIFIED** in this environment
(no browser automation available) — the manual verification steps are listed in
§7 so the claim can be closed out in a normal workstation session.

---

## 1. What was ported, and from where

| Item | Value |
|---|---|
| Source | Fundi Pulse — `C:\Users\HP\Documents\programming\React Native Apps\siteflow-mobile\migrated-web-app`, commit `c64c098` "cad-viewer intergration" |
| Source files read | `src/cad/CadViewerSpike.jsx` (830 lines), `src/cad/viewerHost.js`, `src/cad/webAdapter.js`, `src/cad/CADCanvasView.jsx`, `src/cad/dwgConverter.js`, `src/cad/cad_acceptance_test.mjs` |
| Ported into | `src/components/interop/CadDxfViewer.jsx`, `src/components/interop/viewerHost.js` |

### Exact packages (verified from `node_modules`, identical to Fundi Pulse)

| Package | Version |
|---|---|
| `@mlightcad/cad-simple-viewer` | **1.7.5** |
| `@mlightcad/cad-simple-ui-plugin` | **1.7.5** |
| `@mlightcad/three-renderer` | **1.7.5** |
| `@mlightcad/data-model` | 1.15.5 |
| `@mlightcad/common` | 1.15.5 |
| `@mlightcad/geometry-engine` | 3.15.5 |
| `@mlightcad/graphic-interface` | 3.15.5 |
| `@mlightcad/mtext-parser` | 1.5.3 |
| `@mlightcad/mtext-renderer` | 0.13.3 |
| `@mlightcad/shx-parser` | 1.4.5 |
| `@mlightcad/emf-converter` | 1.15.5 (Apache-2.0) |

`@mlightcad/libredwg-converter` and `@mlightcad/libredwg-web` exist in Fundi Pulse
but were **deliberately not ported**: they are the DWG path, and this integration
makes no DWG claim at all (see §6).

### Minimum required pieces (what the port actually needs)

1. `@mlightcad/cad-simple-viewer` — the editor kernel: document manager, database,
   command engine, open/save/export, snapping, selection.
2. `@mlightcad/cad-simple-ui-plugin` (lazy-loaded via
   `@mlightcad/cad-simple-ui-plugin/register`) — toolbar, dock panel, command line,
   layer manager, properties panel, status bar toggles.
3. Peer packages: `three ^0.172.0` (already present at exactly 0.172.0),
   `lodash-es 4.17.21` (already a direct dependency), `@velipso/polybool ^1.1.1`
   (**added** — see the audit: with `legacy-peer-deps=true` npm no longer
   auto-installs it and the build fails without it).

Nothing else from Fundi Pulse was copied — in particular not its routing, state
management, theme system, `webAdapter.js` business logic, or DWG converter.

---

## 2. Initialisation, and the one non-obvious constraint

`src/components/interop/CadDxfViewer.jsx`, reproducing the proven Fundi Pulse
sequence:

```js
const existing = AcApDocManager.tryGetInstance();
if (existing) await existing.destroy();          // React StrictMode double-mount
if (dark) acedApplyUiTheme('dark', hostRef.current);
containerRef.current = createViewerContainer(hostRef.current);
const manager = AcApDocManager.createInstance({
  container: containerRef.current,
  autoResize: true,
  useMainThreadDraw: true,
  disableExport: false,                          // export must stay enabled
});
const { acuiRegisterSimpleUiPlugin } = await import('@mlightcad/cad-simple-ui-plugin/register');
await acuiRegisterSimpleUiPlugin(manager.pluginManager, {
  host: hostRef.current,
  dockPanel: { defaultOpen: false, defaultSide: 'left', defaultWidth: 280 },
  toolbar: { placement: 'right', items: 'default', collapsible: true },
});
await manager.openDocument(fileName, arrayBuffer, {
  mode: AcEdOpenMode.Write,                      // <-- editing, not viewer-only
  progressiveRendering: false,
});
manager.sendStringToExecute('zoom\ne\n');        // zoom extents after load
```

### The constraint that breaks apps (kept from Fundi Pulse)

The simple-UI plugin **reparents every existing child of its `host` element** into
its own `.ml-ex-ui-dock-main` wrapper. If the host element contained React-rendered
children, React later calls `removeChild` on a node the plugin already moved and the
app throws:

```
NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed
is not a child of this node.
```

Invariant enforced by `viewerHost.js`: **React renders the plugin host empty**, and
the canvas container the viewer drives is created imperatively
(`createViewerContainer`) so React never owns the host's child list.

### Write mode vs viewer-only

Fundi Pulse uses the full editor, so nothing had to change to enable editing:
`AcEdOpenMode.Write` is passed at open time and `disableExport: false` at
construction. There is **no** viewer-only fallback in this integration.

---

## 3. Editing capability of this build

Two sources of evidence, both from the installed 1.7.5 bundles:

* the **module exports and identifiers** in
  `node_modules/@mlightcad/cad-simple-viewer/dist/cad-simple-viewer.js` (2.07 MB)
  and `.../cad-simple-ui-plugin/dist/cad-simple-ui-plugin.js` (171 KB);
* the **plugin registration options** used above.

Command-name literals found in the editor kernel's build
(case-insensitive, exact-token match):

| Capability | Command token(s) found | Count |
|---|---|---|
| Line drawing | `LINE` | 37 |
| Polyline drawing | `PLINE` | 1 |
| Move | `MOVE` | 3 |
| Copy | `COPY` | 10 |
| Rotate | `ROTATE` | 2 |
| Delete | `ERASE` | 5 |
| Undo / Redo | `UNDO` / `REDO` | 68 / 9 |
| Offset | `OFFSET` | 21 |
| Scale | `SCALE` | 27 |
| Stretch | `STRETCH` | 7 |
| Linear dimension | `DIMLINEAR` | 1 |
| Zoom / Pan | `ZOOM` / `PAN` | 4 / 4 |
| Selection | `SELECT` | 5 |
| Open | `OPEN` | 7 |
| Layer manager | `LAYER` (UI plugin) | 12 |

Object snap: the kernel exposes an `osnapModes` setting (`osnap` appears 113 times)
with snap tokens for `endpoint` (116 occurrences), `midpoint` (11), `nearest` (10),
`perpendicular` (1), plus `GRID`, `ORTHO` and `POLAR` toggles.

**Not present** as registered command tokens in this build: `TRIM`, `EXTEND`,
`MIRROR`, `EXPLODE`, `HATCH`. They are therefore **not** claimed.

> Caveat, stated plainly: a command token in a bundle proves the command exists in
> the build; it does not prove its interactive behaviour. Interactive verification
> is the manual checklist in §7.

### What the workbench exposes

| Requirement | How it is met |
|---|---|
| Line / polyline drawing | kernel `LINE` / `PLINE` via the command line and toolbar |
| Entity selection / deselection | kernel selection; `Esc` deselects |
| Object / endpoint / midpoint snap | kernel `osnapModes`; status-bar OSNAP toggle |
| Coordinate input + status | command line accepts absolute and relative coordinates; pointer coordinates are shown in the status bar |
| Layer manager, create/rename/select, layer visibility | UI plugin dock panel (`LAYER`) |
| Move / copy / rotate / delete, offset, scale, stretch | kernel commands; all modify the real document |
| Undo / redo | kernel `UNDO` / `REDO` |
| Open a DXF | `openDocument(...)` — the generated drawing, or a local file via **Open DXF** |
| Save / export / download | `doc.database.dxfOut(undefined, 6)` → Blob → download (`Export DXF`) |
| Reopen preserved edits | verified at the file level by ezdxf round-trip tests (§5); interactive reopen is manual (§7) |

---

## 4. Connecting the existing RC generators (Task 1.3)

The workbench does **not** re-implement detailing. The chain is:

```
parameter form (generated from the generator's own dataclass)
    -> POST /api/cad-ifc/generate
        -> generator_registry.build_params()      validates against *Params
        -> engineering_system render_* methods     the real detailing rules
        -> XDATA identity tagging + $INSUNITS=4   generator_cad.tag_drawing
        -> canonical model + IFC + mapping         rc_model / ifc_export / mapping
    -> GET /cad/<model-id>-r<rev>.dxf           opened by MLightCAD
```

* **Parameter exposure is derived, never duplicated.** `parameter_schema()` reads
  `dataclasses.fields(<Params>)`, so adding a field to `BeamParams` makes it appear
  in the UI automatically. A test asserts schema fields == dataclass fields.
* **Unknown parameters are rejected** before anything is generated.
* **Model-detail-fixed parameters cannot be overridden** (e.g. MST2's
  `landing_length_mm = 0`, because `generate_stair_mst2_dxf` draws no landing).
* **Reference outputs are never touched.** Generated drawings go to
  `public/cad/<model-id>-r<revision>.dxf` with a unique drawing id; the committed
  reference DXFs stay in `src/Backend/Cad_Generator/outputs/`.
* **Storage is controlled.** `store.py` validates every identifier against
  `^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$`, rejects `..`, and only allows the `dxf`,
  `ifc` and `json` extensions. A request cannot traverse out of the store.

Supported generators in the picker: **beam, column, slab, wall, retaining wall, pad
footing, stair MST1, stair MST2** — all eight driven through the real Python
generators (verified: 8/8 produce a valid DXF, canonical model and IFC).

---

## 5. What is verified, and how

Run from the repository root with the backend virtualenv:

```
.venv-ifc\Scripts\python.exe test_cad_ifc_engineering.py
```

| Acceptance criterion | Result | Evidence |
|---|---|---|
| 1. A real DXF from an existing RC generator opens | **PASS** | `test_generator_writes_a_real_dxf` (8/8 generators, ezdxf reopens, entity counts match) |
| 2. Draw a line and polyline | **UNVERIFIED (browser)** | kernel commands `LINE`/`PLINE` present; manual steps §7 |
| 3. Select existing entities | **UNVERIFIED (browser)** | kernel `SELECT` present; manual steps §7 |
| 4. Snapping (endpoint, midpoint) | **UNVERIFIED (browser)** | `osnapModes` present with endpoint/midpoint tokens; manual steps §7 |
| 5. Layer changes persist | **UNVERIFIED (browser)** | `LAYER` panel present; layer names are asserted present in the file (`test_drawings_decompose_into_the_expected_views`, `by_layer` report) |
| 6. Undo / redo of a modification | **UNVERIFIED (browser)** | `UNDO`/`REDO` present; manual steps §7 |
| 7. Export / save the drawing | **PASS (file level)** | `dxfOut(undefined, 6)` wired to the Export button; the identity/tagging round-trip is covered by `test_identity_survives_dxf_save_and_reopen` |
| 8. Saved file reopens with edits intact | **PASS (file level)** | `test_identity_survives_dxf_save_and_reopen`: re-save with ezdxf, rescan, all links recover |
| 9. ezdxf can parse the result | **PASS** | every generator test reopens with `ezdxf.readfile` |
| 10. Existing Python generator tests still pass | **PASS** | `test_cad_ifc_poc.py` 22/22; the generators' own `engineering_system/tests/test_all.py` was not modified |

Automated evidence is separated from manual evidence on purpose: criteria 2–6 and
the interactive half of 7/8 are browser behaviours and are **not** claimed.

### Files

* `src/Backend/cad_ifc/generator_registry.py` — generator catalogue, parameter
  schema from dataclasses, instrumented drawing run, view attribution
* `src/Backend/cad_ifc/generator_cad.py` — XDATA identity tagging, `$INSUNITS`,
  read-back scan, unit check, geometry hashing
* `src/Backend/cad_ifc/store.py` — controlled artefact storage
* `src/components/interop/CadDxfViewer.jsx`, `viewerHost.js` — the ported editor
* `src/components/interop/InteropWorkbench.jsx` — picker, parameter form, tabs
* `src/components/interop/cadIfcApi.js` — API client

---

## 6. Limitations of this build

1. **DWG is not supported at all.** No DWG read, write or export is implemented or
   claimed. Fundi Pulse's `libredwg` path was not ported; LibreDWG is GPL-3.0 and
   would need a deliberate licensing decision plus a WASM build. DXF works.
2. **Interactive behaviour unverified here** (no browser automation). See §7.
3. **XDATA survivability through MLightCAD's own `dxfOut` is unknown.**
   `dxfOut(undefined, 6)` re-serialises the document from MLightCAD's internal
   model. Whether it preserves the `FUNDI` XDATA written by ezdxf has not been
   tested (that requires the browser). If it does not, the exported DXF loses the
   entity→element identity and the mapping can only be reconstructed from the
   server-stored copy — which is why the workbench keeps the served file and the
   registry as the reference, and why `reconcile` reports **unmapped** entities
   rather than guessing. The save/reopen round-trip *through ezdxf* is verified.
4. **`TRIM`, `EXTEND`, `MIRROR`, `EXPLODE`, `HATCH` are not available** in this
   build.
5. **The editor is a DXF editor, not a Fundi engineering editor.** Editing geometry
   does not change engineering parameters; that requires the explicit reconciliation
   flow in `coordinate_and_identity_mapping.md` §6.
6. The Konva drawing page (`/drawing`) remains Fundi's own 2D authoring surface and
   is untouched — two 2D systems coexist by design for now.

---

## 7. Manual verification checklist (to close the browser claims)

Start the backend and the frontend (`§8`), open `/interop/cad-bim`, choose **beam**,
press **Generate DXF + IFC**, then on the **2D CAD** tab:

1. `LINE` → two picks → confirm the line appears; `PLINE` → three picks → Enter.
2. Click an existing entity → selection grips/highlight appear; `Esc` deselects.
3. Enable OSNAP, start `LINE`, hover near a bar end and near a mid-point → the snap
   marker shows *endpoint* / *midpoint* and the pick lands exactly there.
4. Record the cursor coordinates in the status bar; type `0,0` and confirm the pick
   lands on the origin.
5. Open the layers dock, rename `CONCRETE` → `CONCRETE-A`, toggle its visibility,
   assign the new line to another layer.
6. `MOVE` an entity, then `UNDO` (it returns) and `REDO` (it moves again).
7. **Export DXF**; confirm the downloaded file opens again in the workbench
   (**Open DXF**) with the new line, the renamed layer and the moved entity intact.
8. Save that exported file and run
   `.venv-ifc\Scripts\python.exe -c "import ezdxf,sys; d=ezdxf.readfile(sys.argv[1]); print(d.dxfversion, len(list(d.modelspace())))" <file>`.
9. In the **Reconcile** panel, upload the exported DXF and confirm the report shows
   the edited/moved entities and any unmapped entities — and that the canonical
   element list is unchanged.

Record the outcome next to criteria 2–6 in §5.

---

## 8. Commands

```powershell
# backend — only the CAD/BIM/IFC layer.
# VERIFIED here: boots, GET /api/cad-ifc/health reports IfcOpenShell 0.9.0.post1
# (IFC4), ezdxf 1.4.3 and 8 generators; POST /api/cad-ifc/generate returns a
# drawing, an IFC and a mapping.
.venv-ifc\Scripts\python.exe -m src.Backend.cad_ifc.standalone --port 8001

# equivalent, from src/Backend
cd src\Backend
..\..\.venv-ifc\Scripts\python.exe -m cad_ifc.standalone --port 8001

# frontend (from the repository root, second terminal)
npm start            # http://localhost:3000/interop/cad-bim

# regenerate one drawing + IFC from the command line, without the UI
.venv-ifc\Scripts\python.exe -c "from src.Backend.cad_ifc import pipeline, json; print(json.dumps(pipeline.run_generator_pipeline('beam')['drawing'], indent=2))"
```

The full backend (`src/Backend/main.py`) mounts the same router at the same
`/api/cad-ifc` prefix, but it must be started **from `src/Backend`** (it uses
top-level imports such as `from Databases import …`) and it pulls in ~30 routers
including heavy ML dependencies. That startup path is **not** verified here; use the
standalone launcher for the CAD/BIM/IFC features — the endpoints are identical. See
`final_report.md` §10–11.
