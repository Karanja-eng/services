# Task 3.2–3.7 — Coordinates, identity and the mapping adapters

Modules: `identity.py`, `units.py`, `mapping.py`, `dxf_export.py`,
`generator_cad.py`, `ifc_export.py`, `store.py`.

---

## 1. Four identifier spaces, one authority

| Space | Example | Durable? | Role |
|---|---|---|---|
| **Internal element id** | `beam.beam`, `stair.flight` | **yes** — owned by Fundi | the only join key |
| DXF entity handle | `2C`, `45` | **no** — per file, changes when an entity is recreated or the file is re-exported | a reference, never identity |
| IFC `GlobalId` | `1ShFAenkrKnv1$o4$YWXpg` | semver-stable *because derived*, otherwise random per exporter | a representation reference |
| Frontend selection id | the GlobalId or the internal id, depending on the viewer | n/a | a view-layer key only |

```
                     ┌──────────────────────────┐
                     │ internal element id       │  ← authoritative
                     │ e.g. "retaining-wall.stem"│
                     └───────┬──────────┬────────┘
            1 : many  ┌──────┘          └──────┐ 1 : many
                      ▼                        ▼
        DXF entities (handles, layers)    IFC GlobalId(s) in a model file
        same entity may represent        derived deterministically:
        several elements                  UUIDv5(namespace, internal_id)
```

### Deriving the GlobalId

```python
FUNDI_IDENTITY_NAMESPACE = uuid.UUID("8f14e45f-ceea-4a67-9a3e-2b1f0b1c9d77")

def ifc_guid_from_internal_id(internal_id):
    value = uuid.uuid5(FUNDI_IDENTITY_NAMESPACE, internal_id).int
    # base-64 with the IFC alphabet, 22 characters, most significant digit first
```

Consequences, all tested:

* the same internal id always yields the same GlobalId, in any process and on any
  machine, so re-exporting an unchanged model reproduces every GlobalId;
* the namespace must never change (it would invalidate every stored mapping) —
  stated in the code;
* the result matches the IFC pattern `^[0-9A-Za-z_$]{22}$`
  (`test_ifc_globalids_are_unique_and_canonical`).

### Copying elements

Copying a CAD entity copies its XDATA, so two entities can claim one internal id.
`identity.copy_suffix(id, occurrence)` keeps the first occurrence as the original and
re-identifies later ones as `...#copy2`, `#copy3`. The reconciliation reports
duplicates per (view, element) rather than letting two entities overwrite each
other's row.

---

## 2. One-to-many, in both directions

The registry table is `fundi_element_links` (element level) plus
`fundi_entity_links` (entity level, primary key
`model_id, internal_id, drawing_id, handle`).

**One element → many entities.** A detailing sheet is dozens of lines, texts,
hatches and dimensions. Verified: the column sheet maps `column.column` to **62**
entities; the beam sheet maps `beam.beam` to **82**.

**One entity → several elements.** A section view legitimately depicts more than one
element: the retaining-wall section shows the stem *and* the base; the stair section
shows the stair, its flight and (MST1) the landing. The XDATA on such an entity
carries **one payload per element**, and `mapping.elements_for_handle()` returns all
of them. Verified by `test_one_entity_can_map_to_several_elements`, which asserts a
shared handle resolves to exactly
`{"retaining-wall.stem", "retaining-wall.base"}`.

This is not a guess: the view→element association comes from
`ViewSpec.roles` in the generator registry — the same declaration that describes what
each drawing view depicts.

---

## 3. Where identity is stored

### DXF: `FUNDI` XDATA

Reuses the versioned payload format already introduced by `dxf_export`:

```
FUNDI1|<model_id>|<internal_id>|<ifc_guid>|<view>|<unit_scale>
```

written as group code `1000` under the registered application id `FUNDI`. One entity
may carry several `1000` tags (one per element it represents). `scan_drawing()`
collects all of them; the older `dxf_export.scan_dxf_links()` still returns the first,
so existing consumers keep working.

Why XDATA: it survives `ezdxf` save/reopen (verified), it is visible in any CAD XDATA
inspector, and it needs no external registry to recover identity. It is **not**
dependent on the entity handle, which is what makes a re-exported file recoverable.

Also written into the DXF header: `$INSUNITS = 4` (millimetres) and
`$MEASUREMENT = 1` (metric). The generators' own `ezdxf.new()` leaves both unset.

### IFC: `Pset_FundiIdentity`

`FundiElementId`, `FundiModelId`, `FundiGenerator`, `FundiSchemaVersion`,
`FundiGeometryFingerprint`, `FundiIfcClass`, `FundiElementType`, `FundiLevelId`,
`FundiParentId`. `ifc_export.read_element_identities()` reads them back **from the
file**, so a mapping can be rebuilt from an IFC without trusting in-memory state.

### SQLite: the registry

| Table | Purpose |
|---|---|
| `fundi_models` | model id, generator, revision, model hash, timestamp |
| `fundi_drawings` | drawing id, model id, path, `$INSUNITS`, size, mtime |
| `fundi_artifacts` | generated files, for external-modification detection |
| `fundi_element_links` | element ↔ (IFC GlobalId, IFC class, primary DXF handle, layer, fingerprint, unit scale, status) |
| `fundi_entity_links` | element ↔ **every** CAD entity (handle, layer, type, view, geometry hash, status) |

Statuses: element level `ok | regenerated | deleted | stale | conflict |
unit_mismatch`; entity level `ok | edited | deleted`.

---

## 4. CAD round-trip adapters

### Export (canonical/generator → DXF)

`generator_cad.export_drawing()`:

1. build the canonical model (`rc_model`);
2. run the generator's renderers with the registry's instrumentation, which records
   every entity (handle, layer, type, view) — **view attribution from the generator's
   own call boundary**;
3. `tag_drawing()`: reopen the saved DXF, register the `FUNDI` appid, set
   `$INSUNITS`/`$MEASUREMENT`, and attach the payload(s) to each recorded handle;
4. `scan_drawing()`: reopen from disk and record handle, layer, type, **geometry
   hash** and every parsed payload;
5. `mapping.sync_entity_links()` persists one row per (element, handle).

The title block is deliberately left untagged: it is sheet furniture, not engineering
geometry, and it is reported as **unmapped** (verified: exactly 7 unmapped entities per
sheet, all on `TITLE`/`ANNOT`/`DIM` layers).

### Geometry hash

`entity_geometry_hash()` is a SHA-256 over the entity's *geometry* (LINE start/end,
LWPOLYLINE points + closed, CIRCLE/ARC centre+radius+angles, TEXT text+insert+height,
HATCH pattern+paths, INSERT name+insert) plus its layer, rounded to 1e-6. It is what
answers "was this entity edited after we generated it?" without storing the drawing.

### Import (DXF → change detection → reconciliation *proposal*)

`POST /api/cad-ifc/reconcile/{model_id}` reads a drawing (from the store, or uploaded
as base64) and returns a report. It **never** writes CAD geometry into the canonical
model.

Detection rules — each one explicit:

| Finding | Rule |
|---|---|
| `missing` | a stored handle is absent from the file **and** no other entity in the same view carries the same element id with the same geometry hash |
| `rehandled` | the handle changed but (element id, view, geometry hash) match — identity came from the XDATA, not the handle |
| `edited` | the handle is present, the element matches, and the geometry hash differs |
| `new_entities` | a tagged entity whose (element, handle) pair is not in the registry |
| `duplicates` | an element appears more than once in one view (a copied entity duplicated its XDATA) |
| `unmapped_entities` | entities with no `FUNDI` payload — **reported, never assigned** |
| `unknown_element_ids` | the file references an element id the model does not contain |
| `elements_without_entities` | a model element with no entity in this drawing |
| `requires_reconciliation` | true when any of missing / edited / unknown ids / elements-without-entities is non-empty |

Reconciliation **persists** what it learned (statuses and, for re-handled entities,
the new handle), so the registry does not go stale.

Verified by tests: `test_deleted_entity_is_detected`,
`test_edited_geometry_is_detected`, `test_rehandled_entity_keeps_its_identity`,
`test_unmapped_entities_are_reported_not_guessed`,
`test_unknown_element_id_in_drawing_is_reported`.

### Recovery

If the SQLite registry is lost, identity is recoverable from either artefact:

* DXF: `scan_drawing()` → payloads → `(internal_id, handle, view)`
  (legacy: `mapping.rebuild_from_dxf()`);
* IFC: `read_element_identities()` → `(internal_id, GlobalId, class)`.

---

## 5. No identity guessing

Three places refuse to guess, on purpose:

1. **Unmapped CAD entities** are reported with handle/layer/type and left unusable for
   engineering purposes. `test_unmapped_entities_are_reported_not_guessed` adds a
   plain line and asserts it appears in `unmapped_entities` and is *not* given
   `beam.beam`.
2. **Unmatched IFC GlobalIds** in the BIM viewer show "no matching element in the
   canonical model" instead of attaching to the nearest one.
3. **Coordinate proximity is never used as identity.** Two elements at the same place
   are different elements; matching is by id (and, for drift, by id + view + geometry
   hash).

---

## 6. Conflict handling and synchronisation

Explicit operations only — there is no two-way sync:

```
canonical model ──► DXF export ──► (user edits in MLightCAD) ──► reconcile report
canonical model ──► IFC export ──► (external edits)          ──► conflict flag
```

* `mapping.file_modified_externally()` compares the recorded size/mtime of the IFC and
  the DXF with what is on disk. If an artefact changed outside Fundi **and** the model
  has also changed, the affected links are marked `conflict` and the regenerate path
  refuses to overwrite silently (`test_external_ifc_edit_is_flagged_as_conflict`).
* A CAD geometry change is **never** applied to engineering parameters. The report
  says what changed; the decision to change a design remains an engineering act.
  `docs/integration/coordinate_and_identity_mapping.md` §7 states what a future
  "accept change" operation would have to validate first.
* Regeneration is additive: a new revision and a new drawing id
  (`beam-r1` → `beam-r2`), never an in-place overwrite of a drawing a user may be
  editing. Verified by `test_repeated_export_does_not_duplicate_identity`.

---

## 7. Coordinates and units

### The contract

| Layer | Length unit | Frame | Declared where |
|---|---|---|---|
| Canonical model | **metre** | Z-up, right-handed; X east, Y north, Z up | `units.length`, `units.frame` |
| IFC | **metre** | IFC WCS, Z-up | `IfcSIUnit(LENGTHUNIT, METRE)` |
| DXF | **millimetre** | AutoCAD WCS, Z-up; plan uses canonical X/Y | `$INSUNITS = 4`, `$MEASUREMENT = 1`, and the `unit_scale` field of every XDATA payload |
| React Three Fiber | whatever the scene uses | **Y-up** | conversion at the adapter boundary only |

```python
r3f_to_canonical(x, y, z)  -> (x, -z,  y)
canonical_to_r3f(x, y, z)  -> (x,  z, -y)
to_dxf(metres)             -> metres * 1000
from_dxf(mm)               -> mm / 1000
```

Origin: `z = 0` is finished ground level of level `L0`; horizontal members have their
**soffit** at the level elevation and their **placement** at the centre of the solid,
vertical members sit on the level elevation. Stated in every element's
`provenance.geometry_convention` and in `units.describe_units()`.

### Tolerances

| Constant | Value | Use |
|---|---|---|
| `TOLERANCE_M` | 1e-6 m | geometries closer than this are identical |
| `TOLERANCE_MM` | 1e-3 mm | DXF geometry comparison |
| fingerprint rounding | 1e-9 | dimension/placement hashing |
| dimension assertion | 1e-3 m | IFC kernel bbox vs canonical dimensions |

### No implicit conversions

`units.assert_unit()` raises `UnitMismatchError` when a file's declared unit is
missing, unknown or not the expected one — a DXF re-saved with `$INSUNITS = 1`
(inches) is reported as a unit mismatch rather than silently mis-scaled
(`test_unit_mismatch_is_detected` in the legacy suite; `check_units()` in the
generator adapter does the same for generated drawings).

### Verification

* `test_units_round_trip_between_canonical_dxf_and_ifc` — 2.5 m → 2500 mm → 2.5 m, and
  the IFC kernel's X extent equals 2.5 m equals 2500 mm.
* `test_canonical_frame_contract` — the R3F transform and its inverse.
* `test_ifc_dimensions_match_the_canonical_model` — every element of all eight
  generators within 1 mm.
* `test_drawings_declare_millimetres` — 8/8 drawings declare `$INSUNITS = 4` and every
  XDATA payload carries scale 1000.
* `test_ifc_units_are_metres` — SI metre/area/volume units present in the file.

---

## 8. Acceptance tests (Task 3.7)

| # | Criterion | Result | Test |
|---|---|---|---|
| 1 | A canonical element generates one or more DXF entities | **PASS** | `test_entity_maps_to_many_entities` / `test_entities_carry_fundi_identity` |
| 2 | Mapping metadata survives DXF save and reopen | **PASS** | `test_identity_survives_dxf_save_and_reopen`, `test_mapping_survives_reopening_the_drawing` |
| 3 | A known entity maps back to its correct internal id | **PASS** | `test_one_entity_can_map_to_several_elements` |
| 4 | Deleted or recreated entities are detected | **PASS** | `test_deleted_entity_is_detected`, `test_rehandled_entity_keeps_its_identity` |
| 5 | IFC export preserves the canonical → GlobalId mapping | **PASS** | `test_ifc_identity_matches_the_canonical_model` |
| 6 | IFC reload restores mappings correctly | **PASS** | `read_element_identities` asserted in the same test |
| 7 | Repeated export creates no duplicate elements or identities | **PASS** | `test_repeated_export_does_not_duplicate_identity` |
| 8 | Coordinates/units round-trip within documented tolerances | **PASS** | `test_units_round_trip_between_canonical_dxf_and_ifc`, `test_canonical_frame_contract` |
| 9 | Unmapped and conflicting entities are reported | **PASS** | `test_unmapped_entities_are_reported_not_guessed`, `test_unknown_element_id_in_drawing_is_reported`, `test_external_ifc_edit_is_flagged_as_conflict` |
| 10 | Existing generators, editor functions and BIM viewer remain functional | **PASS (automated part)** | legacy suite 22/22; generators unmodified (registry instrumentation is restored in `finally`) |

Executed: `test_cad_ifc_engineering.py` **40/40**, `test_cad_ifc_poc.py` **22/22**.

---

## 9. Limitations and remaining risk

1. **XDATA through MLightCAD's own export is unverified.** `dxfOut(undefined, 6)`
   re-serialises from MLightCAD's internal model; whether the `FUNDI` XDATA survives
   is untested (needs a browser). If it does not, an exported DXF is reported as
   fully unmapped — the failure is visible, not silent, and the server copy remains
   authoritative.
2. **Mapping granularity is the view.** An element maps to *all* entities drawn for
   the view(s) that depict it, not to "this line is the bottom bar". Per-entity
   semantic attribution would need the generators to declare it; the current rule is
   truthful rather than fine-grained.
3. **Handles are per file.** Two drawings of the same element have different handles;
   the registry is keyed by `(model_id, drawing_id, handle)`.
4. **No automatic acceptance of CAD changes.** That is deliberate. A future
   "accept geometry change into the design" operation would have to: re-run the
   detailing rules, re-check the affected member, re-export both representations, and
   record the new revision — none of which exists.
5. **No locking.** Two concurrent `/generate` calls for one model id race on the
   revision counter. Acceptable for a single-user local tool; a multi-user deployment
   needs a transaction around the revision allocation.
6. **IFC import is read-only.** Element identity and properties are reconciled from a
   file, but geometry from an imported IFC is not converted back into canonical
   elements.
