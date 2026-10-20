# Final report — CAD, IFC/BIM and shared engineering model integration

Branch: `feature/cad-bim-ifc-integration`
Repository: `C:\Users\HP\Documents\programming\Java script\ReactApps\Services`
Date of this report: end of the implementation session.

Everything claimed below is marked **VERIFIED** (executed or inspected here) or
**UNVERIFIED** (implemented but not browser-tested in this environment). No claim of
DWG support, IFC interoperability certification or structural compliance is made
anywhere.

---

## 1. Exact MLightCAD package and version found in Fundi Pulse

Fundi Pulse: `C:\Users\HP\Documents\programming\React Native Apps\siteflow-mobile`,
app `migrated-web-app`, commit `c64c098` "cad-viewer intergration".

**VERIFIED** from `migrated-web-app/node_modules/@mlightcad/*/package.json`:

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
| `@mlightcad/libredwg-converter` | 3.15.5 | **not ported** (DWG) |
| `@mlightcad/libredwg-web` | 0.7.17 | **not ported** (DWG) |

Fundi Studio now installs exactly the same versions of the ported packages
(**VERIFIED** from `node_modules`).

---

## 2. IFC schema and IfcOpenShell version

* IfcOpenShell **0.9.0.post1**, in `.venv-ifc` (**VERIFIED**:
  `python -c "import ifcopenshell; print(ifcopenshell.version)"`).
* Schema written: **IFC4**.
* IfcOpenShell's own validator reports **0 statements** for all eight generated
  models (**VERIFIED**).
* IFC is generated server-side only; the browser parses and renders.

---

## 3. That Open and web-ifc versions

| Package | Version | Notes |
|---|---|---|
| `@thatopen/components` | **3.3.3** | pinned exactly |
| `@thatopen/components-front` | **3.3.3** | pinned exactly |
| `@thatopen/fragments` | **3.3.3** | pinned exactly |
| `web-ifc` | **0.0.78** | WASM copied to `public/thatopen/` |
| `camera-controls` | **3.1.2** | required peer, declared directly |
| `three` | **0.172.0** | **unchanged**, single deduped instance |

Why not the latest (`3.4.9`): it requires `three >= 0.182`, which MLightCAD 1.7.5
(`three ^0.172.0`) and R3F 9.4 are not verified against, and the bundle may contain
only one `three`. That the chosen 3.3.3 works on 0.172 was **verified empirically**,
not assumed: `npm run verify:thatopen-three` checks all 55 `three` symbols the two
packages import plus the instanced-geometry and uniform-cloning paths
(`RESULT: symbol-compatible=true behaviour-ok=true`).

---

## 4. Files changed

### Added — backend (`src/Backend/cad_ifc/`)

| File | Purpose |
|---|---|
| `canonical.py` | versioned canonical engineering model (`fundi.canonical` v1.0.0), semantic element-type → IFC-class table, fingerprints, validation |
| `generator_registry.py` | catalogue of the 8 existing RC generators, parameter schema **derived from the generators' dataclasses**, instrumented drawing run with per-view entity attribution |
| `rc_model.py` | canonical model built from each generator's own engineering model (geometry, reinforcement, provenance, assumptions) |
| `generator_cad.py` | DXF identity tagging (`FUNDI` XDATA), `$INSUNITS=4`, read-back scan, geometry hashing, unit check |
| `store.py` | controlled artefact storage (`public/cad`, `public/ifc`), identifier validation, path-traversal guard |
| `standalone.py` | lean ASGI launcher for this router only (fastapi + uvicorn + ezdxf + ifcopenshell), so the workbench runs without the heavy backend |

### Modified — backend

| File | Change |
|---|---|
| `ifc_export.py` | generalised to all element classes, schema-driven `PredefinedType` slot, both extrusion axes + inclined extrusion, per-storey containment, element aggregation, material properties, `read_element_identities`, `element_extents`; refuses classes outside the semantic mapping |
| `mapping.py` | new `fundi_entity_links` table and one-to-many APIs (`sync_entity_links`, `entity_links_for`, `elements_for_handle`, `handles_for_element`, `reconcile_drawing`, `entity_mapping_document`); `sync_links` gained `required_view` (default `"plan"`, generator sheets pass `None`) |
| `pipeline.py` | `run_generator_pipeline()` — generator → canonical model → DXF + IFC + mapping + JSON artefacts, with revision handling and external-edit detection |
| `router.py` | `/generators`, `/generate`, `/models`, `/model/{id}`, `/links/{id}`, `/entities/{id}`, `/reconcile/{id}`, artefact download with drawing-id resolution; precise 4xx/503 errors |
| `septic_model.py` | writes `schema_version` (2-line change) |
| `__init__.py` | unchanged |

### Added — frontend

| File | Purpose |
|---|---|
| `src/components/interop/ThatOpenBimViewer.jsx` | That Open BIM viewer: load, navigate, pick/highlight, property panel, clipping, measurement, capability detection |
| `src/components/interop/cadIfcApi.js` | typed-ish API client with real error messages |

### Modified — frontend

| File | Change |
|---|---|
| `src/components/interop/InteropWorkbench.jsx` | rewritten as the generator-driven workspace (generator picker, parameter form, 4 tabs, canonical-element panel, reconciliation panel, validation summary); viewers are `React.lazy`-loaded |

### Added — scripts, tests, docs, config

| File | Purpose |
|---|---|
| `scripts/copy-cad-bim-assets.js` | copies the fragments worker + web-ifc WASM into `public/thatopen/`; wired into `postinstall` |
| `scripts/verify/thatopen-three-compat.mjs` | the empirical That Open ↔ three check (`npm run verify:thatopen-three`) |
| `scripts/verify/find-unmet-peers.mjs` | finds peers that `legacy-peer-deps` no longer auto-installs (`npm run verify:peers`) |
| `scripts/regenerate_sample_artifacts.py` | regenerates the committed sample drawings/models/IFC |
| `scripts/fix_double_encoded_md.py` | repairs a markdown file that was re-encoded as cp1252 (used once on `mlightcad_editor.md`) |
| `test_cad_ifc_engineering.py` | **40** acceptance tests (generators, canonical model, IFC, mapping, units) |
| `test_cad_ifc_api.py` | **20** HTTP acceptance tests (router, status codes, one-to-many, reconcile, traversal, launcher parity) |
| `.npmrc` | `legacy-peer-deps=true` with the reason and the verification command |
| `.gitignore` | allowlists for `docs/integration/`, `public/cad/`, `public/thatopen/`, `.npmrc`, `scripts/verify/`; ignores `.test-artifacts/` |
| `package.json` | That Open + `camera-controls` + `@velipso/polybool`; exact pins; two new verify scripts; postinstall chain |
| `docs/integration/cad_bim_audit.md` | Phase 0 audit |
| `docs/integration/mlightcad_editor.md` | Task 1 |
| `docs/integration/ifc_that_open.md` | Task 2 |
| `docs/integration/canonical_engineering_model.md` | Task 3.1 |
| `docs/integration/coordinate_and_identity_mapping.md` | Tasks 3.2–3.7 |
| `docs/integration/final_report.md` | this report |

Pre-existing uncommitted work in `src/components/components/{ChatPage,RightSidebar,Sidebar}.jsx`
and `src/components/engineering_appp.jsx` was **left untouched** (it was already
modified before this task and is not part of this change).

### Generated sample artefacts (committed so the route works offline)

`public/cad/{beam,column,slab,wall,retaining-wall,pad-footing,stair,stair-mst2}-r1.dxf`
plus `<model-id>.json`, `.links.json`, `.entities.json`, `samples.json`, and
`public/ifc/<model-id>.ifc` for the same eight models, plus `public/thatopen/`
(worker + WASM, copied from `node_modules`).

---

## 5. Implemented features

**CAD workspace (Task 1)**

* The proven Fundi Pulse MLightCAD integration (same packages/versions), in write
  mode with the full simple-UI plugin: toolbar, dock panel, command line, layer
  manager, properties panel.
* All 8 existing RC generators selectable, with their real parameters derived from
  the Python dataclasses (27 for a beam), defaults matching the reference sheets, and
  model-detail-fixed parameters non-overridable.
* Generate → real DXF from the real detailing engine, tagged with identity, opened in
  the editor; **Open DXF**, **Reload**, **Export DXF** (download), so a file can be
  edited, exported and reopened.
* Reference outputs untouched; generated files get `<model-id>-r<revision>` ids in a
  controlled, validated store.

**IFC / BIM (Task 2)**

* Semantic IFC4 from the canonical model, with spatial structure, storeys, units,
  typed elements, swept-solid geometry (including an inclined stair waist),
  materials, engineering + identity property sets, decomposition, and stable GlobalIds.
* Server-side validation (schema, reopen, geometry-kernel bounding boxes, GlobalId
  uniqueness/stability) on every export.
* That Open Components 3.3.3 viewer in its own tab: IFC loading, camera navigation and
  fit, click-to-select with highlight, element↔canonical-model property inspection,
  clipping planes, length measurement, and a capability panel that reports anything
  the installed build lacks.
* React Three Fiber preserved and untouched; the workbench links to `/visualise` and
  the BIM viewer never shares a canvas with R3F. Viewers are lazy-loaded, so the main
  bundle got *smaller* in MLightCAD terms (MLightCAD is no longer in `main.js`).

**Canonical model and mapping (Task 3)**

* Versioned, renderer-independent canonical model with a controlled element-type
  vocabulary, explicit IFC mapping, provenance, reinforcement data, validation state
  and assumptions; validated before any artefact is written.
* Deterministic GlobalIds (UUIDv5), element ↔ many CAD entities, entity ↔ several
  elements, persisted in SQLite with statuses.
* Recovery of identity from the DXF XDATA or the IFC property set alone.
* Reconciliation that detects missing, re-handled, edited, new, duplicated, unmapped
  and unknown-id entities, plus elements with no entities — and never mutates the
  engineering model from CAD input.
* Documented unit/coordinate contract with tests (metres canonical/IFC, millimetres
  DXF, Y-up R3F), explicit tolerance policy, and no silent unit conversion.

---

## 6. Tests actually executed, and results

Run from the repository root with `.venv-ifc\Scripts\python.exe`.

| Suite | Command | Result |
|---|---|---|
| Legacy CAD/IFC proof of concept | `python test_cad_ifc_poc.py` | **22/22 PASS** |
| Engineering / canonical / IFC / mapping | `python test_cad_ifc_engineering.py` | **40/40 PASS** |
| HTTP API acceptance | `python test_cad_ifc_api.py` | **20/20 PASS** |
| That Open ↔ three compatibility | `node scripts/verify/thatopen-three-compat.mjs` | **PASS** (`missing=0`, behaviour ok) |
| Unmet peer dependencies | `node scripts/verify/find-unmet-peers.mjs` | **PASS** (only `typescript`, unused because there is no `tsconfig.json`) |
| Production build | `npm run build` (`CI=false`, 4 GB heap) | **PASS**, exit 0 |
| Sample artefact regeneration | `python scripts/regenerate_sample_artifacts.py` | **8/8 generators**, validator statements 0 |
| Standalone backend boot + live HTTP | `python -m src.Backend.cad_ifc.standalone --port 8123`, then `GET /api/cad-ifc/health`, `GET /generators`, `POST /generate {"generator":"beam","params":{"depth_mm":650}}` | **PASS** — health reported IfcOpenShell 0.9.0.post1 (IFC4), ezdxf 1.4.3, 8 generators; generate returned `beam-r2` with 89 entities (82 mapped / 7 unmapped), `IfcBeam`, GlobalId `1ShFAenkrKnv1$o4$YWXpg`, validator **0 statements**, DXF units OK, revision 2 |

**Total automated tests: 82, all passing.**

Sample of what the suites assert (all VERIFIED):

* 8/8 generators produce a real DXF that reopens with ezdxf, declares `$INSUNITS = 4`,
  and whose entity count matches the corresponding `generate_*_dxf` function in
  `engineering_system/generate.py` (layout-drift guard).
* 8/8 produce a canonical model that passes `validate_model`, and an IFC4 file that
  reopens, passes `ifcopenshell.validate` with 0 statements, and whose kernel bounding
  boxes equal the canonical dimensions within 1 mm.
* GlobalIds are unique, 22-character, derived from the internal id, and unchanged
  across regeneration; the model revision increments and the drawing id changes.
* One element → 62 entities (column) / 82 (beam); one entity → stem + base
  (retaining wall).
* Identity survives an ezdxf save/reopen; a deleted entity, an edited entity and a
  handle-renumbered entity are each detected correctly; an untagged entity is reported
  as unmapped and is *not* given an engineering identity.
* An element with an unmapped IFC class is refused; an invalid `PredefinedType`
  degrades to `NOTDEFINED` with a recorded warning and still yields a schema-valid file.
* API: unknown generator → 404, bad parameter → 422 naming the parameter, fixed
  parameter → 422, unknown drawing → 404, path traversal → 422, bad extension → 400,
  reconcile of an untouched drawing → no drift, uploaded drawing → accepted.

---

## 7. CAD/IFC interoperability limitations

1. **DWG is not supported** — read, write or convert. No DWG claim is made. LibreDWG
   was not ported (GPL-3.0 + WASM build + a licensing decision).
2. **IFC validity is not interoperability certification.** IfcOpenShell's schema and
   semantic validator plus its geometry kernel are the evidence; no commercial
   importer/exporter (Revit, Navisworks, ArchiCAD, BIMcollab) was available to test
   round-tripping.
3. **XDATA surviving MLightCAD's own `dxfOut` is unverified.** If MLightCAD drops
   unknown XDATA on export, an exported DXF loses entity→element identity and is
   reported as fully unmapped. The ezdxf round-trip is verified; the MLightCAD one is
   not.
4. **Reinforcement is data, not geometry.** No `IfcReinforcingBar` entities; bar
   schedules, laps and curtailment live in the drawing and in the canonical model.
5. **Wall openings are not cut** from the IFC solid; the element carries a warning.
6. **Modelling assumptions are explicit but present**: 1 m stair width, 1 m
   retaining-wall length, one-metre slab design strip.
7. **Mapping granularity is per view**, not per line: an element owns all entities of
   the view(s) that depict it.
8. **No two-way synchronisation.** Reconciliation produces a report; accepting a CAD
   change into the design is deliberately not implemented.
9. **No locking** on concurrent generation for the same model id.

---

## 8. Features not implemented

* `IfcReinforcingBar` / rebar geometry in IFC; rebar groups in the BIM model.
* Opening/void geometry (`IfcOpeningElement`) for walls and slabs.
* IFC import → canonical elements (identity/properties are reconciled, geometry is not).
* `TRIM`, `EXTEND`, `MIRROR`, `EXPLODE`, `HATCH` editing commands (not in this
  MLightCAD build).
* DWG read/write; LibreDWG integration.
* Section/drawing generation *from* IFC.
* A property editor that writes back to engineering parameters.
* Multi-user locking, audit trail, or revision branching.
* Visibility isolation in the BIM viewer (selection highlight, clipping and
  measurement are implemented; a full visibility/isolation panel is not).
* Browser-executed automated tests (no automation available here).

---

## 9. Remaining engineering risks

| Risk | Severity | Note |
|---|---|---|
| Interactive MLightCAD/That Open behaviour unverified | high | commands and APIs exist and compile; behaviour needs the manual checklist in `mlightcad_editor.md` §7 / `ifc_that_open.md` §7 |
| XDATA loss on MLightCAD export | medium | detected as unmapped, not silent; server copy remains authoritative |
| `legacy-peer-deps` hides future peer conflicts | medium | mitigated by `npm run verify:peers` + the three-compat check; the pins are exact |
| Assumed stair width / wall length could be read as design data | medium | recorded as a validation warning on the element and surfaced in the UI and report |
| IFC geometry is a gross-concrete abstraction | medium | no structural adequacy is claimed from it |
| GlobalId namespace is load-bearing | low | documented "never change"; changing it invalidates stored mappings |
| Registry sheet layout could drift from `generate.py` | low | pinned by `test_layout_matches_generate_module` |
| Generator instrumentation is monkey-patching | low | scoped, restored in `finally`, and covered by 8 generator tests |
| No concurrency control on revisions | low | single-user local tool |

---

## 10. Remaining work to close the browser claims

1. Run the manual checklists in `docs/integration/mlightcad_editor.md` §7 (criteria
   2–6 and the interactive part of 7/8) and `docs/integration/ifc_that_open.md` §7
   (criteria 5–8), on a workstation with a browser.
2. In particular, establish whether `doc.database.dxfOut(undefined, 6)` preserves the
   `FUNDI` XDATA. If it does not, either re-tag on download or document that exported
   files are unmapped.
3. If a commercial IFC viewer is available, round-trip one generated IFC and record the
   result next to §7 limitation 2.
4. Confirm the **full** backend boots. `src/Backend/main.py` requires
   `src/Backend` as the working directory (top-level `from Databases import …`) and
   imports ~30 routers including ML dependencies; importing it in `.venv-ifc` hung in
   this environment. The CAD/BIM/IFC endpoints themselves are verified through the
   standalone launcher (`src/Backend/cad_ifc/standalone.py`), which mounts the same
   router at the same `/api/cad-ifc` prefix, so this is an environment/startup
   question rather than an integration one.

---

## 11. Exact commands

```powershell
# --- one-time environment -------------------------------------------------
# backend virtualenv (already present in this checkout as .venv-ifc)
python -m venv .venv-ifc
.venv-ifc\Scripts\python.exe -m pip install ifcopenshell ezdxf fastapi uvicorn lark httpx

# frontend dependencies (postinstall copies the That Open worker + web-ifc WASM)
npm install
npm run verify:thatopen-three      # proves That Open works on three 0.172
npm run verify:peers               # proves no needed peer is missing

# --- run the backend (port 8001) ------------------------------------------
# RECOMMENDED: only the CAD/BIM/IFC layer — fast, no ML dependencies.
# VERIFIED in this environment: boots in ~15 s, /health reports
# ifcopenshell 0.9.0.post1 (IFC4), ezdxf 1.4.3 and 8 generators.
.venv-ifc\Scripts\python.exe -m src.Backend.cad_ifc.standalone --port 8001

# Alternative: from src/Backend
cd src\Backend
..\..\.venv-ifc\Scripts\python.exe -m cad_ifc.standalone --port 8001

# The FULL backend also mounts this router at the same prefix, but it imports ~30
# routers (several pulling in torch/transformers). It cannot be imported as
# `src.Backend.main:app` from the repository root, because main.py uses top-level
# imports (`from Databases import …`, `from cad_ifc.router import …`) and therefore
# needs src/Backend on sys.path:
cd src\Backend
..\..\.venv-ifc\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
# NOTE: this full-app command is NOT verified here — importing main.py in .venv-ifc
# hung on heavy ML dependencies in this environment. Use the standalone launcher
# above for the CAD/BIM/IFC features; the endpoints are identical.

# --- run the frontend -----------------------------------------------------
npm start                          # http://localhost:3000/interop/cad-bim

# --- production build -----------------------------------------------------
$env:CI="false"; $env:GENERATE_SOURCEMAP="false"; $env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# --- regenerating sample artefacts (optional) -----------------------------
.venv-ifc\Scripts\python.exe scripts\regenerate_sample_artifacts.py

# --- tests ----------------------------------------------------------------
.venv-ifc\Scripts\python.exe test_cad_ifc_poc.py
.venv-ifc\Scripts\python.exe test_cad_ifc_engineering.py
.venv-ifc\Scripts\python.exe test_cad_ifc_api.py

# --- generating one model from the command line, without the UI -----------
.venv-ifc\Scripts\python.exe -c "from src.Backend.cad_ifc import pipeline, json; r = pipeline.run_generator_pipeline('beam', {'depth_mm': 650}); print(json.dumps({'drawing': r['drawing']['url'], 'ifc': r['ifc']['url'], 'elements': r['ifc']['guids']}, indent=2))"
```

API surface: `http://127.0.0.1:8001/api/cad-ifc` — see `ifc_that_open.md` §6.

---

## 12. Definition of done — status

| Task | Definition of done | Status |
|---|---|---|
| 1 | Fundi Studio opens, edits, saves/exports and reopens real generated DXF files using the verified MLightCAD editor integration | **Partially verified** — opening/identity/export/reopen verified at file level and the editor is the verified integration in write mode; interactive drawing/editing/snapping remains UNVERIFIED pending the manual checklist |
| 2 | Existing engineering generators produce a valid IFC model, and That Open can load, navigate, select and inspect its elements while R3F remains operational | **IFC side VERIFIED** (8/8 valid IFC4, 0 validator statements, dimensions match); **That Open side implemented and compiled, interactive behaviour UNVERIFIED**; R3F untouched |
| 3 | Canonical element IDs and parameters map explicitly to CAD entities and IFC GlobalIds, with tested persistence, coordinate/unit conversion and conflict detection | **VERIFIED** — 40 engineering + 19 API tests including persistence, re-handling, deletion, edit detection, unit round-trip and conflict flagging |
