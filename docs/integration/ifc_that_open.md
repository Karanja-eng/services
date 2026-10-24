# Task 2 — IFC generation and the That Open BIM viewer

Status: **IFC generation and validation are verified** (executed, evidence quoted).
The That Open viewer is **implemented and compiles**; its interactive behaviour is
**UNVERIFIED** in this environment because no browser automation is available.

> **Correction (2026-10-23) — read this before trusting §3 below.**
>
> The viewer described in §3 was later replaced by hardcoded compatibility stubs
> (`src/components/interop/compat/thatOpen*.js`, `webIfc.js`, `cadSimpleViewer.js`)
> during a build unblock. Those stubs reported the engines as "not installed" on
> every platform and, in addition, the viewer never loaded the IFC at all — so none
> of the interactive behaviour claimed here could have worked in that state.
>
> The stubs have now been replaced with real adapters, the IFC loading path is
> implemented, and the build-time memory limit that surfaced when the real engines
> were bundled is handled by `scripts/build.js`. Full root-cause analysis, the new
> canonical model, the responsive workspace and the current verification status are
> recorded in **`chats/2026-10-23-unified-bim-workbench.md`**. Where this document
> and that journal disagree, the journal is authoritative (it was produced with the
> installed packages and the running backend in front of it).

---

## 1. IFC generation path

### Chosen stack and versions (**VERIFIED**)

| Component | Version | Where |
|---|---|---|
| IfcOpenShell | **0.9.0.post1** | `.venv-ifc\Scripts\python.exe` (`python -c "import ifcopenshell; print(ifcopenshell.version)"`) |
| IFC schema written | **IFC4** | `ifc_export.IFC_SCHEMA = "IFC4"` |
| ezdxf | 1.4.3 | same virtualenv |
| Python | 3.13.5 | same virtualenv |

IfcOpenShell is used **server-side only**. The browser never generates IFC; it only
parses and renders files. The interface between frontend and backend is documented
in §6.

### Access pattern

`src/Backend/cad_ifc/ifc_export.py` is imported directly by the FastAPI backend
(`src/Backend/cad_ifc/router.py`), mounted at `/api/cad-ifc`. There is no separate
IFC microservice: the generator run, the IFC export and the mapping live in one
process so they cannot silently diverge.

### What is written into the file

For one generator run (`POST /api/cad-ifc/generate`):

* **Spatial structure**: `IfcProject` → `IfcSite` → `IfcBuilding` →
  one `IfcBuildingStorey` per canonical level (with its `Elevation`). Elements are
  contained per storey via `IfcRelContainedInSpatialStructure` (IFC requires exactly
  one spatial container per element).
* **Units**, declared explicitly:
  `IfcSIUnit(LENGTHUNIT, METRE)`, `AREAUNIT SQUARE_METRE`,
  `VOLUMEUNIT CUBIC_METRE`, `PLANEANGLEUNIT RADIAN`, in an `IfcUnitAssignment`.
* **Typed elements** — the class comes only from the explicit semantic table
  (`canonical.IFC_CLASS_BY_ELEMENT_TYPE`):

  | Generator | IFC classes written |
  |---|---|
  | beam | `IfcBeam` (`BEAM`) |
  | column | `IfcColumn` (`COLUMN`) |
  | slab | `IfcSlab` (`FLOOR`) |
  | wall | `IfcWall` (`SOLIDWALL`) |
  | retaining wall | `IfcWall` + `IfcFooting` (stem + base) |
  | pad footing | `IfcFooting` (`PAD_FOOTING`) |
  | stair MST1 | `IfcStair` + `IfcStairFlight` (`STRAIGHT`) + `IfcSlab` (landing) |
  | stair MST2 | `IfcStair` + `IfcStairFlight` |

* **Geometry**: `IfcExtrudedAreaSolid` with an
  `IfcRectangleProfileDef`/`IfcCircleProfileDef` — a swept solid, never an
  arbitrary mesh. Three cases, each explicit:
  * vertical members (`axis = z`): profile in the XY plane, extruded up;
  * horizontal members (`axis = x`): profile in the YZ plane, extruded along +X;
  * inclined members (`extrusion` present): the stair waist is extruded along
    `(cos θ, 0, sin θ)` with the profile being width × waist. This is a real
    inclined prism, not a bounding box, because the section detail states the
    geometry and a box would be a false representation.
  * Placements use `IfcLocalPlacement` relative to the storey plus
    `IfcAxis2Placement3D` with a Z-rotation for the element's
    `rotation_z_deg`.
* **Identity**: every element's `GlobalId` is derived deterministically from the
  canonical internal id (UUIDv5 in a fixed namespace), so re-exporting an unchanged
  model reproduces the same GlobalIds. Also written to
  `Pset_FundiIdentity` (`FundiElementId`, `FundiModelId`, `FundiGenerator`,
  `FundiSchemaVersion`, `FundiGeometryFingerprint`, `FundiIfcClass`,
  `FundiElementType`, `FundiLevelId`, and `FundiParentId` when decomposed).
* **Engineering data**: `Pset_FundiEngineering` carries the design parameters
  (`fck_MPa`, `fyk_MPa`, `span_clear_mm`, …), `GrossVolumeM3`, one
  `Dimension_<key>_m` per canonical dimension, and any
  `FundiValidationWarnings` (which is how the modelling assumptions — an assumed
  stair width, a per-metre retaining wall — travel with the model instead of being
  lost).
* **Materials**: an `IfcMaterial` per concrete grade exactly as the generator states
  it (`C30/37`, `28/35`, …, read from the engineering model first, then the params),
  associated with `IfcRelAssociatesMaterial`.
* **Decomposition**: elements with a `parent_id` are aggregated
  (`IfcRelAggregates`) — a stair owns its flights and landing.
* **Stair flights** get `NumberOfRisers`, `NumberOfTreads`, `RiserHeight`,
  `TreadLength` from the parameters when the generator recorded them.

### Semantic safety rails (the "a rectangle must not become a wall" rule)

1. `ifc_class` can only be set through `canonical.IFC_CLASS_BY_ELEMENT_TYPE` or by a
   generator stating it explicitly; an unknown element type raises.
2. `ifc_export._ifc_class_for()` refuses any class outside
   `SUPPORTED_IFC_CLASSES` — the export fails rather than inventing a type.
3. The `PredefinedType` is validated against the schema's enumeration **before** the
   entity is created. An invalid value is degraded to `NOTDEFINED` **and recorded
   as a warning on the element**; the canonical type is still preserved in
   `FundiElementType`.
   This replaced an earlier attempt-then-catch approach, which left a
   half-initialised entity in the file (producing two elements for one input and a
   corrupt model).
4. `PredefinedType` is placed at the slot the **schema** reports, not at a fixed
   index 8: `IfcStairFlight` inserts `NumberOfRisers`/`NumberOfTreads`/`RiserHeight`/
   `TreadLength` before `PredefinedType` (index 12), and assuming index 8 wrote a
   string into `NumberOfRisers` and made IFC reject the entity.

### Provenance preserved

`model.source_params`, `element.provenance` (generator key, label, params module and
class, model class, drawing number/title/scale, the source parameter values, the
geometry convention, and every recorded assumption) and
`element.reinforcement.bar_groups` (the detailing system's own bar list: shape code,
size, count, cut length, weight, layer, bend dimensions). Reinforcement is carried
as **data**, not as individual IFC bars — see §5.

---

## 2. IFC validation (executed)

`ifc_export.validate_ifc_file()` runs `ifcopenshell.validate` with its JSON logger.

Result for all eight generators (**VERIFIED**,
`test_cad_ifc_engineering.py::test_ifc_is_real_semantic_and_valid`):

| Generator | schema | elements | classes | storeys | Psets | validator statements |
|---|---|---|---|---|---|---|
| beam | IFC4 | 1 | IfcBeam | Level 1 | 2 | **0** |
| column | IFC4 | 1 | IfcColumn | Level 1 | 2 | **0** |
| slab | IFC4 | 1 | IfcSlab | Level 1 | 2 | **0** |
| wall | IFC4 | 1 | IfcWall | Level 1 | 2 | **0** |
| retaining_wall | IFC4 | 2 | IfcWall, IfcFooting | Level 1 | 4 | **0** |
| pad_footing | IFC4 | 1 | IfcFooting | Level 1 | 2 | **0** |
| stair | IFC4 | 3 | IfcStair, IfcStairFlight, IfcSlab | Level 1 | 6 | **0** |
| stair_mst2 | IFC4 | 2 | IfcStair, IfcStairFlight | Level 1 | 4 | **0** |

Additional checks, all executed:

* **Reopen**: `ifcopenshell.open()` then read classes, Psets, identities, spatial
  structure, units and materials back from the file
  (`read_ifc_summary`, `read_element_identities`).
* **GlobalIds present, unique, canonical**: each equals
  `identity.ifc_guid_from_internal_id(internal_id)`, all 22 characters from the IFC
  alphabet, no duplicates.
* **GlobalIds stable across regeneration** (`test_ifc_globalids_survive_regeneration`).
* **Dimensions**: the IFC **kernel's** bounding boxes (`ifcopenshell.geom`) equal the
  canonical dimensions to 1 mm for every element
  (`test_ifc_dimensions_match_the_canonical_model`). Example: pad footing
  `{x: 2.5, y: 2.5, z: 0.6}` m for `lx = ly = 2500 mm`, `depth = 600 mm`.
* **Units**: `LENGTHUNIT:METRE`, `AREAUNIT:SQUARE_METRE`, `VOLUMEUNIT:CUBIC_METRE`
  present in the file (`test_ifc_units_are_metres`).
* **Relationships**: containment per storey, material association, and stair
  decomposition are asserted by reopening the file.
* **Semantic guard**: exporting an element with `ifc_class = "IfcFlowFitting"`
  raises (`test_ifc_refuses_an_unmapped_class`).
* **Degradation is visible**: an invalid `PredefinedType` still yields a
  schema-valid file with one element and a recorded warning
  (`test_invalid_predefined_type_degrades_visibly`).

### What this validation does and does not mean

It is **syntax + schema + semantic-rules validation by IfcOpenShell**, plus geometry
parsing by the same kernel, plus dimensional comparison against the engineering
parameters. It is **not** a full BIM interoperability certification: it does not
prove that Revit/Navisworks/ArchiCAD will round-trip the file, nor that the model is
structurally correct. No independent commercial validator was available here.

---

## 3. That Open integration

### Versions (**VERIFIED** from `node_modules`)

| Package | Version | `three` peer declared |
|---|---|---|
| `@thatopen/components` | **3.3.3** | `>=0.175.0` |
| `@thatopen/components-front` | **3.3.3** | `>=0.175.0` |
| `@thatopen/fragments` | **3.3.3** | `>=0.175` |
| `web-ifc` | **0.0.78** | — |
| `camera-controls` | **3.1.2** | `three >=0.126.1` |
| `three` | **0.172.0** (unchanged) | — |

### Why 3.3.3 and why three 0.172 is acceptable

3.4.x requires `three >= 0.182`, which would force a three upgrade that MLightCAD
1.7.5 and R3F 9.4 are not verified against — and the bundle may only contain one
three. 3.3.3 needs `>= 0.175` on paper, but the actual requirement is smaller.
Rather than trust either range, `scripts/verify/thatopen-three-compat.mjs`
(`npm run verify:thatopen-three`) extracts every `three` symbol the two packages
import and checks it against the installed build:

```
three version: 172
@thatopen/components 3.3.3: required=30 missing=0
@thatopen/fragments 3.3.3:   required=25 missing=0
InstancedBufferGeometry path: ok (box3 empty=true)
UniformsLib.lights clone: ok (keys=19)
Controls is class: true
RESULT: symbol-compatible=true behaviour-ok=true
```

Neither package imports `three/webgpu` or `three/tsl`. `.npmrc` therefore sets
`legacy-peer-deps=true` (with the reasoning recorded in the file), every needed peer
is a direct dependency, and the three That Open packages are pinned exactly.

### Runtime assets

`scripts/copy-cad-bim-assets.js` (run from `postinstall`) copies:

| From | To | Size |
|---|---|---|
| `@thatopen/fragments/dist/Worker/worker.mjs` | `public/thatopen/thatopen-fragments-worker.mjs` | 1.33 MB |
| `web-ifc/web-ifc.wasm` | `public/thatopen/web-ifc.wasm` | 1.60 MB |
| `web-ifc/web-ifc-mt.wasm` | `public/thatopen/web-ifc-mt.wasm` | 1.56 MB |

plus a `manifest.json`. The viewer passes
`fragments.init('/thatopen/thatopen-fragments-worker.mjs')` and
`ifcLoader.settings = { autoSetWasm: false, wasm: { path: '/thatopen/', absolute: true } }`,
so nothing depends on a bundler-specific worker import and no CDN is contacted.

### Viewer implementation — `src/components/interop/ThatOpenBimViewer.jsx`

Every API used was read out of the installed `.d.ts` files, because 3.x differs
substantially from 2.x:

| Purpose | Call |
|---|---|
| Container/world | `new OBC.Components()`, `components.get(OBC.Worlds).create()`, `OBC.SimpleScene / SimpleRenderer / SimpleCamera`, `components.init()` |
| Load | `OBC.IfcLoader.load(Uint8Array, coordinate, name)` → `FragmentsModel`; `world.scene.three.add(model.object)`; `world.camera.fitToItems()` |
| Selection | canvas click → `FragmentsManager.raycast({camera, mouse, dom})` → `hit.fragments.getGuidsByLocalIds([hit.localId])` → `Highlighter.highlightByID('fundi-select', {modelId: [localIds]})` |
| Element → BIM | `model.getLocalIdsByGuids([guid])` then highlight |
| Properties | the canonical element joined by GlobalId (id, class, name, dimensions, validation warnings) — read from the backend model, not guessed from the mesh |
| Clipping | `components.get(OBC.Clipper)` → `clipper.create(world)` / `deleteAll()` |
| Measurement | `components.get(OBF.LengthMeasurement)` → `measure.create()` |
| Mode switch | four tabs: 2D CAD, BIM (That Open), IFC check (web-ifc), Existing 3D (R3F link) |

Each optional capability is wrapped in its own `try`/`catch` and reported in a
"Capabilities" panel (✓/✕), so a missing feature shows as unavailable instead of
breaking the viewer. Viewers are `React.lazy`-loaded, so this route does not enlarge
the application's initial bundle.

### Element identity bridge

The viewer receives the canonical element list and joins on `ifc_guid`. Selection
therefore resolves to a **stable Fundi element id**, not to a mesh name or a
coordinate: `GlobalId → canonical element → CAD entity handles`. Clicking the model
travels the other way (`localId → GlobalId → element`). An unknown GlobalId is shown
as "no matching element in the canonical model" rather than being silently attached
to the nearest element.

---

## 4. Acceptance tests for Task 2

| # | Criterion | Result |
|---|---|---|
| 1 | The engineering generator produces real model parameters | **PASS** — 8/8 generators, parameters read from their dataclasses |
| 2 | IfcOpenShell generates an IFC from those parameters | **PASS** — 8/8 files, IFC4 |
| 3 | The IFC reopens successfully | **PASS** — `ifcopenshell.open` + full readback |
| 4 | Identities, types, dimensions, properties correct | **PASS** — GlobalIds derived/uniqueness/dimensions/Psets asserted |
| 5 | That Open loads the IFC | **UNVERIFIED** — implemented; requires a browser (§7) |
| 6 | Selection and property inspection work | **UNVERIFIED** — implemented, feature-detected (§7) |
| 7 | Clipping and measurement work where implemented | **UNVERIFIED** — implemented, feature-detected (§7) |
| 8 | The original React Three Fiber workflow still functions | **PASS (structural)** — `visualise_component.jsx` and its routes untouched; the renderer is a separate route/tab. Browser check listed in §7 |
| 9 | Existing CAD and engineering tests remain green | **PASS** — `test_cad_ifc_poc.py` 22/22 and `test_cad_ifc_engineering.py` 40/40 |

---

## 5. What is modelled, and what is not

**Modelled**

* Gross concrete geometry of the member the generator designs, as a swept solid with
  the correct dimensions, placement and orientation.
* Semantic class, `PredefinedType`, material, storey, containment, decomposition
  (stairs), engineering parameters, validation warnings, provenance.
* Stable identity for every element, and a persistent registry from canonical id to
  IFC GlobalId (§`coordinate_and_identity_mapping.md`).

**Not modelled (deliberate, documented on the element itself)**

* **Individual reinforcement bars are not IFC elements.** The bar list (shape code,
  diameter, count, cut length, weight, layer) is carried as engineering data in the
  canonical model and summarised in `Pset_FundiEngineering`; it is not converted to
  `IfcReinforcingBar` geometry. The brief allows this for the first increment.
* **Bar bending details, laps and curtailment** exist in the drawing and in the
  reinforcement data, not as BIM geometry.
* **Assumptions are explicit**: the stair has no width parameter, so a 1 m width is
  modelled and reported as a warning; the retaining-wall section detail has no length
  along the wall, so 1 m is modelled and reported. Neither is silent.
* **Wall openings**: the MW1 opening is detailed in the drawing but is **not** cut
  out of the IFC solid; the element carries a warning saying so.
* **Slab**: the generator designs a one-metre design strip, so the IFC slab is that
  strip, with the limitation recorded as a warning.

No structural adequacy is claimed from successful generation.

---

## 6. Frontend ↔ backend interface

Base: `http://127.0.0.1:8001/api/cad-ifc` (overridable with `REACT_APP_API_BASE`).

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | IfcOpenShell availability + schema, ezdxf version, generator count, store dirs |
| GET | `/units` | — | unit/coordinate contract, canonical schema id and version |
| GET | `/generators` | — | catalogue: key, label, category, drawing number/scale, **parameter schema derived from the dataclass**, defaults, `canonical_preview` |
| POST | `/generate` | `{generator, params, model_id?, level_elevation_m?, include_validation?}` | full report: model stats/hash/levels, drawing (id, url, entity/link counts, views), IFC (url, classes, guids, identities), mapping counts, validation block |
| GET | `/model/{model_id}` | — | canonical model JSON |
| GET | `/models` | — | artefacts currently on disk |
| GET | `/links/{model_id}` | — | element ↔ CAD/IFC links + entity links |
| GET | `/entities/{model_id}?drawing_id=` | — | element → CAD entity handles (one-to-many) |
| POST | `/reconcile/{model_id}` | `{drawing_id, dxf_base64?}` | drift report (missing / re-handled / edited / new / duplicates / unmapped / unknown ids / elements without entities) |
| POST | `/export` | `{params}` | the original septic pipeline (kept) |
| GET | `/file/{model_id}.{ext}` | — | artefact download |

Error handling: unknown parameters or an invalid generator → **422** with the precise
message; IfcOpenShell missing → **503**; unknown artefact id → **422**; missing file →
**404**. The frontend surfaces these strings verbatim (see `cadIfcApi.js`), so a
failure explains itself instead of showing `undefined`.

---

## 7. Manual verification for the browser claims

1. Backend: `.venv-ifc\Scripts\python.exe -m src.Backend.cad_ifc.standalone --port 8001`
   (verified to boot; see `final_report.md` §11 for the full-backend alternative).
2. Frontend: `npm start`, open `http://localhost:3000/interop/cad-bim`.
3. Choose **pad footing**, Generate. Confirm `GET /health` shows
   `ifcopenshell.available = true`, `schema = IFC4`.
4. Switch to **BIM (That Open)**. It must show "Loaded IFC in … ms (N geometry items)"
   and a fit view. The Capabilities panel must show ✓ for selection highlight,
   clipping planes and length measurement — if any shows ✕, that capability is
   missing in this build and must be recorded as such.
5. Click an element: the right-hand panel must show its GlobalId, `localIds`, name,
   `ifc_class` and dimensions.
6. Click the element in the **Canonical elements** list: the BIM view must highlight
   and zoom to it, and the CAD tab must focus its first entity handle.
7. Add a clipping plane; drag it; confirm geometry is cut. Then `deleteAll`.
8. Measure a length between two snaps; confirm the label shows a value in metres.
9. Open `/visualise` in another tab and confirm the R3F scenes still render and
   behave as before.
10. Compare the browser's displayed dimensions with
    `.venv-ifc\Scripts\python.exe -c "from src.Backend.cad_ifc import ifc_export; import json; print(json.dumps(ifc_export.element_extents('public/ifc/pad-footing.ifc'), indent=2))"`.

Record the outcomes; only then move criteria 5–8 above from UNVERIFIED to PASS.
