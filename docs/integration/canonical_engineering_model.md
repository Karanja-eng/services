# Task 3.1 — The canonical engineering model

Module: `src/Backend/cad_ifc/canonical.py`
Document schema: **`fundi.canonical`, version `1.0.0`**

---

## 1. Why a separate model exists

Four different things are routinely conflated in CAD/BIM integrations:

| Thing | Owner in Fundi Studio | Must not be confused with |
|---|---|---|
| Engineering design inputs and derived checks | the Python generators (`engineering_system`) | drawing geometry, render meshes |
| The canonical engineering element | `canonical.py` (this module) | a DXF entity, an IFC product, a Three.js mesh |
| CAD representation | `dxf_export.py` / the generators + `generator_cad.py` | the element |
| BIM representation | `ifc_export.py` → IfcOpenShell | the element |
| Visual representation | MLightCAD, That Open, React Three Fiber | either of the above |

The canonical model is the intersection: it carries the **engineering parameters as
authoritative data**, the **gross geometry derived from them**, the **identity**, the
**units**, the **provenance** and the **validation state** — and nothing about how
any of it is drawn. It imports no CAD, IFC or rendering library
(`canonical.py` imports only `hashlib`, `json`, `math`).

```
engineering parameters ──► canonical model ──┬──► DXF         (ezdxf / generators)
   (authoritative)          (this schema)     ├──► IFC         (IfcOpenShell)
                                              ├──► Three.js    (visual only)
                                              └──► mapping registry
```

---

## 2. Document schema (v1)

```jsonc
{
  "schema": "fundi.canonical",
  "schema_version": "1.0.0",
  "model_id": "beam",                       // stable; survives regeneration
  "name": "Suspended beam (MB1)",
  "description": "…",
  "generator": "beam",                      // generator key
  "generator_module": "engineering_system.members.beam",
  "source_params": { "span_clear_mm": 6000.0, … },   // authoritative inputs
  "units": {
    "length": "metre", "area": "square_metre", "volume": "cubic_metre",
    "angle": "degree",
    "frame": "Z-up right-handed",
    "origin": "project origin at finished ground level of level L0"
  },
  "levels": [
    { "id": "beam:L0", "name": "Level 1", "elevation_m": 0.0, "description": "…" }
  ],
  "elements": [ /* see §3 */ ],
  "relationships": [
    { "type": "part-of", "from": "stair.flight", "to": "stair.stair", "note": "…" }
  ],
  "warnings": [],
  "statistics": {
    "element_count": 1, "by_ifc_class": { "IfcBeam": 1 },
    "by_element_type": { "beam": 1 }, "total_volume_m3": 1.206,
    "levels": 1, "relationships": 0, "elements_with_warnings": 0
  },
  "model_hash": "…"                          // SHA-256 over the document
}
```

### Element schema

```jsonc
{
  "id": "beam.beam",                    // canonical identity (authoritative)
  "element_type": "beam",               // controlled vocabulary
  "ifc_class": "IfcBeam",               // explicit semantic mapping only
  "predefined_type": "BEAM",
  "name": "Suspended beam",
  "role": "beam",
  "level_id": "beam:L0",
  "parent_id": null,                    // decomposition (stair -> flight)
  "shape": "box",                       // "box" | "cylinder"
  "axis": "x",                          // extrusion axis: "x" | "z"
  "dimensions": { "length_x": 6.7, "width_y": 0.3, "height_z": 0.6 },  // metres
  "placement": { "x": 0.0, "y": 0.0, "z": 0.3 },                       // metres
  "rotation_z_deg": 0.0,
  "extrusion": { "direction": [0.866,0,0.5], "length_m": 3.662 },      // inclined members only
  "material": "C30/37",
  "material_properties": { "fck_MPa": 30.0, "density_kg_m3": 2500.0 },
  "properties": { "span_clear_m": 6.0, "As_provided_mm2": 1963.6, … },
  "reinforcement": { "bar_groups": [ { "shape_code": "11", "bar_size_mm": 25, … } ] },
  "provenance": {
    "generator": "beam", "generator_label": "Suspended beam (MB1)",
    "params_module": "engineering_system.members.beam", "params_class": "BeamParams",
    "model_class": "BeamEngineeringModel", "drawing_number": "BEAM-01",
    "drawing_scale": "1:20", "source_parameters": { … },
    "geometry_convention": "metres, Z-up; …", "assumptions": []
  },
  "validation": { "state": "ok", "warnings": [] },
  "representations": {},                // filled by adapters (handles, GlobalId)
  "volume_m3": 1.206,
  "fingerprint": "…"                    // SHA-256 over geometry-affecting fields
}
```

### Controlled vocabularies

* **`element_type`** (`canonical.ELEMENT_TYPES`): `beam, column, slab, wall,
  retaining-wall, pad-footing, stair, stair-flight, corbel, nib, half-joint,
  beam-column-joint, tank, baffle, pipe, soakpit, cover, manhole, bedding,
  base-slab, top-slab`. An unknown type raises.
* **`relationships[].type`** (`canonical.RELATION_TYPES`): `connects-to`,
  `supported-by`, `part-of`, `adjacent-to`. An unknown kind raises.
* **`validation.state`**: `ok` | `warning` | `error`.

---

## 3. The semantic mapping is the only door to BIM

```python
IFC_CLASS_BY_ELEMENT_TYPE = {
    "beam": "IfcBeam", "column": "IfcColumn", "slab": "IfcSlab",
    "wall": "IfcWall", "retaining-wall": "IfcWall", "pad-footing": "IfcFooting",
    "stair": "IfcStair", "stair-flight": "IfcStairFlight",
    "corbel": "IfcBeam", "nib": "IfcBeam", "half-joint": "IfcBeam",
    "beam-column-joint": "IfcBeam", "tank": "IfcTank", "baffle": "IfcWall",
    "pipe": "IfcPipeSegment", "soakpit": "IfcTank", "cover": "IfcCovering",
    "manhole": "IfcBuildingElementProxy", "bedding": "IfcSlab",
    "base-slab": "IfcSlab", "top-slab": "IfcSlab",
}
```

`resolve_ifc_class()` is the only function that assigns a class, and
`PREDEFINED_TYPE_BY_ELEMENT_TYPE` is restricted to enumerations IFC4 actually
defines (e.g. a retaining wall is `SOLIDWALL`, not the non-existent
`RETAININGWALL`; its retaining role survives in `FundiElementType`).

Consequence: **no geometry ever becomes a BIM element by inference.** A rectangle is
a rectangle until an explicit mapping row — or a generator that knows what it built —
says it is a wall.

---

## 4. Fingerprints and hashing

* `geometry_fingerprint(element)` — SHA-256 over
  `ifc_class, element_type, shape, axis, dimensions, placement, rotation_z_deg,
  level_id` (dimensions and placements rounded to 1e-9). Names, colours and notes are
  excluded, so a cosmetic edit does not invalidate representations; any dimensional,
  positional, rotational or semantic change does.
* `model_hash(document)` — SHA-256 over the whole document except `statistics`,
  `model_hash` and `generated_at`. Used as the revision hash in the mapping registry.
* `element_volume_m3(element)` — gross volume of the box/cylinder. An unknown shape
  **raises** instead of returning zero, because a zero volume would corrupt every
  downstream quantity.

---

## 5. Validation

`validate_model(document)` returns a list of violations (empty = valid):

* `schema` is `fundi.canonical` **or** a recognised legacy id (see §7);
* `schema_version` is present (or inferable) and major-compatible with `1.0.0`;
* required top-level fields present;
* declared length unit is `metre`;
* the model declares at least one level;
* per element: required fields, unique `id`, resolvable `level_id`, known
  `element_type`, `ifc_class` inside the semantic mapping, supported `shape`,
  strictly positive numeric dimensions, non-zero volume.

`require_valid(document)` raises `CanonicalModelError` with the full problem list.
`validate_external_params(params, allowed)` rejects unknown keys and non-scalar values
**before** anything reaches a generator.

`ifc_export.export_ifc()` calls `validate_model` first and refuses to write an invalid
document, so no downstream artefact can be produced from a broken model.

---

## 6. How generators populate it

`src/Backend/cad_ifc/rc_model.py` builds one document per generator run.

* Geometry comes from the generator's own engineering model, not from new rules:
  `Member.dimensions` (beam/column/slab), `StairEngineeringModel.slope_length_mm` /
  `run_mm` / `rise_total_mm`, and the `*Params` fields for wall, retaining wall and
  footing. Where a quantity genuinely does not exist, an **assumption** is recorded
  (stair width = 1 m, retaining-wall length = 1 m) and the element's validation state
  becomes `warning` — it is never a silent default.
* Reinforcement is copied verbatim from `Member.bar_groups` (the BS 8666 bar list the
  detailing system computed): shape code, size, count, cut length, weight, layer,
  bend dimensions.
* Notes are recorded as entities: a retaining wall is **two** elements (`stem`,
  `base`) with a `supported-by` relationship, because that is how the section detail
  and the reinforcement are actually organised; a stair is `stair` + `flight` +
  `landing`, with `part-of` relationships that become IFC aggregation.
* Element ids are `identity.make_element_id(model_id, role)` →
  `"beam.beam"`, `"retaining-wall.stem"`, `"stair.flight"`. They depend only on the
  model id and the semantic role, so a parameter change keeps identity.

The `septic_model.py` generator predates `canonical.py` and keeps its own schema id
and `units` layout; `canonical.normalise_element()` fills the newer optional fields so
both documents validate against one schema and both export to IFC through the same
code path.

---

## 7. Versioning and backward compatibility

* Every document carries `schema` + `schema_version`; a mismatch in the major version
  is a validation error, not a silent read.
* `LEGACY_SCHEMA_IDS = ("fundi.canonical.model/1",)` maps the pre-existing septic
  schema id onto v1 semantics (it *is* v1: same element fields, same metre/Z-up
  conventions). `schema_version_of()` infers `1.0.0` from that id when the field is
  absent. `septic_model` now also writes `schema_version` explicitly.
* `normalise_element()` defaults the optional keys (`element_type`, `axis`,
  `rotation_z_deg`, `reinforcement`, `provenance`, `validation`, `representations`,
  `volume_m3`, `fingerprint`) so older documents remain readable without being
  rewritten.
* Adding a field is backward compatible; changing the meaning of an existing field
  requires a major version bump, because IFC GlobalIds and the mapping registry are
  derived from these documents.

---

## 8. Tests

`test_cad_ifc_engineering.py`:

| Test | What it proves |
|---|---|
| `test_canonical_model_is_valid_for_every_generator` | 8/8 generators produce a schema-valid document with metre units, fingerprints and positive volumes |
| `test_canonical_ids_are_stable_and_unique` | ids identical across two builds, no duplicates |
| `test_parameter_override_changes_the_canonical_geometry` | the override reaches the model, identity is unchanged, `model_hash` changes |
| `test_canonical_model_records_provenance_and_assumptions` | stair width assumption recorded as a warning; retaining-wall `supported-by` relationship present |
| `test_semantic_mapping_refuses_unknown_element_type` | unknown element type raises |
| `test_model_units_declared_metres` (legacy suite) | septic document still declares metres/Z-up |

Executed result: **40/40** in the engineering suite, **22/22** in the legacy suite.

---

## 9. Known limitations

1. Blocking elements (openings) are not represented; a wall with an opening carries a
   warning instead.
2. Only two geometry shapes (`box`, `cylinder`) plus the inclined extrusion are
   supported. A corbel's tapered profile or a stair's stepped soffit cannot yet be
   expressed, so those generators are registered for CAD but only mapped to IFC where
   the geometry is representable (corbel/nib/half-joint/beam-column joint are
   registered as generators but **not** in `_DRAFT_BUILDERS`, so `supports_ifc` is
   `false` for them and the UI says so).
3. One model per generator key by default (`model_id = generator key`). Designing two
   different beams needs an explicit `model_id`.
4. `properties` is a flat scalar map; nested engineering structures are flattened.
