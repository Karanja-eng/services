"""
FastAPI router exposing the CAD + BIM + IFC interoperability layer.

Mounted by ``src/Backend/main.py`` under ``/api/cad-ifc``. Kept import-guarded
there so that a missing optional dependency (IfcOpenShell, ezdxf) cannot break the
rest of the backend: the endpoints report the precise missing dependency instead.

Endpoint map
------------
``GET  /health``                       dependency and directory status
``GET  /units``                        unit/coordinate contract
``GET  /generators``                   the existing RC generators and their parameters
``POST /generate``                     run a generator -> DXF + IFC + mapping
``GET  /model/{model_id}``             canonical model (rebuilt, live)
``GET  /models``                       artefacts currently on disk
``GET  /links/{model_id}``             element <-> CAD/IFC links (persisted)
``GET  /entities/{model_id}``          element <-> CAD entity links (one-to-many)
``POST /reconcile/{model_id}``         diff a (possibly edited) drawing against the mapping
``POST /export``                       septic-tank pipeline (kept, unchanged)
``GET  /file/{model_id}.{ext}``        download a generated artefact

Nothing here mutates the canonical model from CAD input. ``/reconcile`` only
*reports* differences and marks links; accepting a CAD change into the engineering
model is a separate, explicit decision (see ``docs/integration/coordinate_and_identity_mapping.md``).
"""

from __future__ import annotations

import base64
import binascii
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import FileResponse

from . import (
    canonical,
    dxf_export,
    generator_cad,
    generator_registry,
    ifc_export,
    mapping,
    pipeline,
    rc_model,
    septic_model,
    store,
    units,
)

router = APIRouter(tags=["cad_ifc"])

#: Guard for an uploaded drawing body (8 MiB of base64 ~ 6 MiB DXF).
MAX_UPLOAD_BYTES = 12 * 1024 * 1024


@router.get("/units")
def get_units() -> Dict[str, Any]:
    """The unit and coordinate contract shared by CAD, model and IFC."""
    return {
        "units": units.describe_units(),
        "canonical": units.CANONICAL_LENGTH_UNIT,
        "canonical_schema": {
            "schema": canonical.SCHEMA_ID,
            "version": canonical.SCHEMA_VERSION,
            "frame": canonical.CANONICAL_FRAME,
            "origin": canonical.CANONICAL_ORIGIN,
        },
        "dxf_insunits": units.DXF_INSUNITS_MM,
        "tolerances": {"metres": units.TOLERANCE_M, "millimetres": units.TOLERANCE_MM},
        "r3f_transform": "IFC_X = R3F_X, IFC_Y = -R3F_Z, IFC_Z = R3F_Y",
    }


@router.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ifcopenshell": {
            "available": ifc_export.IFC_AVAILABLE,
            "error": ifc_export.IFC_IMPORT_ERROR,
            "schema": ifc_export.IFC_SCHEMA,
        },
        "ezdxf": {"available": True, "version": getattr(dxf_export.ezdxf, "__version__", "")},
        "engineering_generators": {
            "available": generator_registry.ENGINEERING_AVAILABLE,
            "error": generator_registry._ENGINEERING_IMPORT_ERROR,
            "count": len(generator_registry.GENERATORS),
        },
        "defaults": {"out_dir": pipeline.DEFAULT_OUT_DIR, "db": pipeline.DEFAULT_DB_PATH},
        "store": store.describe(),
    }


@router.get("/generators")
def get_generators() -> Dict[str, Any]:
    """Catalogue of the existing RC generators with their parameter schemas.

    The schemas are read from each generator's own ``*Params`` dataclass, so the
    UI cannot drift from the Python signature.
    """
    if not generator_registry.ENGINEERING_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "the Python engineering detailing system is not importable: "
                f"{generator_registry._ENGINEERING_IMPORT_ERROR}"
            ),
        )
    catalogue: List[Dict[str, Any]] = []
    for key in generator_registry.GENERATORS:
        entry = rc_model.catalogue_entry(key)
        document = rc_model.build_model(key)
        entry["canonical_preview"] = {
            "schema_version": document.get("schema_version"),
            "elements": [
                {
                    "id": element["id"],
                    "element_type": element["element_type"],
                    "ifc_class": element["ifc_class"],
                    "dimensions": element["dimensions"],
                    "volume_m3": element["volume_m3"],
                    "warnings": element["validation"]["warnings"],
                }
                for element in document["elements"]
            ],
        }
        catalogue.append(entry)
    return {"generators": catalogue, "count": len(catalogue)}


@router.post("/generate")
def generate(payload: Optional[Dict[str, Any]] = Body(default=None)) -> Dict[str, Any]:
    """Run one existing generator and produce the DXF, the IFC and the mapping."""
    payload = payload or {}
    generator_key = payload.get("generator")
    if not generator_key:
        raise HTTPException(status_code=422, detail="'generator' is required")
    if generator_key not in generator_registry.GENERATORS:
        raise HTTPException(
            status_code=404,
            detail=f"unknown generator {generator_key!r}; available: "
                   f"{sorted(generator_registry.GENERATORS)}",
        )
    if not ifc_export.IFC_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"IfcOpenShell is not available in this backend environment: "
                   f"{ifc_export.IFC_IMPORT_ERROR}",
        )
    params = payload.get("params") or {}
    model_id = payload.get("model_id")
    try:
        return pipeline.run_generator_pipeline(
            generator_key,
            params,
            model_id=model_id,
            level_elevation_m=float(payload.get("level_elevation_m") or 0.0),
            include_validation=bool(payload.get("include_validation", True)),
        )
    except generator_registry.GeneratorRegistryError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except canonical.CanonicalModelError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (ifc_export.IfcExportError, generator_cad.GeneratorCadError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/models")
def list_models() -> Dict[str, Any]:
    """Every artefact currently on disk, so the UI never links to a missing file."""
    drawings = store.list_artefacts("dxf")
    models = store.list_artefacts("ifc")
    return {
        "drawings": [
            {"drawing_id": name, "url": store.url_for(name, "dxf")} for name in drawings
        ],
        "models": [{"model_id": name, "url": store.url_for(name, "ifc")} for name in models],
        "store": store.describe(),
    }


@router.get("/model/{model_id}")
def get_model(model_id: str) -> Dict[str, Any]:
    """Canonical model for a septic or RC model id."""
    if model_id == septic_model.SEPTIC_MODEL_ID:
        return septic_model.build_model(model_id=model_id)
    for key in generator_registry.GENERATORS:
        if rc_model.default_model_id(key) == model_id:
            return rc_model.build_model(key)
    # Fall back to the stored document so a previously generated model is still
    # readable even if the generator registry changed.
    path = os.path.join(store.DATA_DIR, f"{model_id}.json")
    if os.path.exists(path):
        import json

        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    raise HTTPException(status_code=404, detail=f"unknown model {model_id!r}")


@router.get("/links/{model_id}")
def get_links(model_id: str) -> Dict[str, Any]:
    conn = mapping.connect(pipeline.DEFAULT_DB_PATH)
    try:
        document = mapping.mapping_document(conn, model_id)
        entities = mapping.entity_mapping_document(
            conn, model_id, None
        )
    finally:
        conn.close()
    if not document["links"] and not entities["elements"]:
        raise HTTPException(
            status_code=404,
            detail="no mapping recorded yet; POST /api/cad-ifc/generate first",
        )
    document["entity_links"] = entities
    return document


@router.get("/entities/{model_id}")
def get_entity_links(model_id: str, drawing_id: Optional[str] = None) -> Dict[str, Any]:
    """Element -> CAD entity links (one engineering element, many entities)."""
    conn = mapping.connect(pipeline.DEFAULT_DB_PATH)
    try:
        document = mapping.entity_mapping_document(conn, model_id, drawing_id)
    finally:
        conn.close()
    if not document["elements"]:
        raise HTTPException(
            status_code=404,
            detail="no entity links recorded; POST /api/cad-ifc/generate first",
        )
    return document


@router.post("/reconcile/{model_id}")
def reconcile(model_id: str, payload: Optional[Dict[str, Any]] = Body(default=None)) -> Dict[str, Any]:
    """Diff a drawing against the stored mapping and propose a reconciliation.

    Two inputs are supported:

    * ``{"drawing_id": "beam-r1"}`` - re-read the drawing already in the store
      (the normal case: the user saved the file back over the generated one).
    * ``{"drawing_id": "beam-r1", "dxf_base64": "..."}`` - reconcile an edited
      drawing uploaded by the browser (what the CAD workspace exports).

    The endpoint never applies CAD geometry to the canonical model. It reports
    drift and marks the affected links, so the engineering consequence is an
    explicit decision rather than a silent overwrite.
    """
    payload = payload or {}
    drawing_id = payload.get("drawing_id")
    if not drawing_id:
        raise HTTPException(status_code=422, detail="'drawing_id' is required")
    try:
        store.validate_id(drawing_id, "drawing id")
    except store.StoreError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    model_doc = get_model(model_id)
    uploaded = payload.get("dxf_base64")
    temp_path = None
    try:
        if uploaded:
            if len(uploaded) > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"uploaded drawing exceeds {MAX_UPLOAD_BYTES} bytes",
                )
            try:
                raw = base64.b64decode(uploaded, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise HTTPException(
                    status_code=422, detail=f"'dxf_base64' is not valid base64: {exc}"
                ) from exc
            temp_path = os.path.join(store.CAD_DIR, f"{drawing_id}.upload.dxf")
            os.makedirs(store.CAD_DIR, exist_ok=True)
            with open(temp_path, "wb") as handle:
                handle.write(raw)
            scan_path = temp_path
        else:
            stored = store.path_for(drawing_id, "dxf")
            if not os.path.exists(stored):
                raise HTTPException(
                    status_code=404,
                    detail=f"drawing {drawing_id!r} is not in the store; generate it first "
                           "or upload it as dxf_base64",
                )
            scan_path = stored

        scan = generator_cad.scan_drawing(scan_path)
        conn = mapping.connect(pipeline.DEFAULT_DB_PATH)
        try:
            report = mapping.reconcile_drawing(conn, model_doc, drawing_id, scan["entities"])
        finally:
            conn.close()
        report["drawing"] = {
            "drawing_id": drawing_id,
            "scanned_path": scan_path,
            "uploaded": bool(uploaded),
            "insunits": scan["insunits"],
            "unit": scan["unit"],
            "entity_count": scan["entity_count"],
        }
        report["units"] = units.describe_units()
        return report
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/export")
def export(
    payload: Optional[Dict[str, Any]] = Body(default=None),
    include_validation: bool = True,
) -> Dict[str, Any]:
    """Regenerate the septic IFC, DXF and the persistent mapping from parameters."""
    if not ifc_export.IFC_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "IfcOpenShell is not available in this backend environment: "
                f"{ifc_export.IFC_IMPORT_ERROR}"
            ),
        )
    params = (payload or {}).get("params") if isinstance(payload, dict) else None
    try:
        return pipeline.run_pipeline(params, include_validation=include_validation)
    except septic_model.ModelError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/analysis")
def run_analysis(payload: Optional[Dict[str, Any]] = Body(default=None)) -> Dict[str, Any]:
    """Run a 2D structural analysis for one canonical model and return normalised results.

    The analytical inputs are **not** inferred: `youngs_modulus_pa`, `supports` and loads
    (`loads` and/or `element_loads`) must be supplied, and an incomplete request is
    rejected with the reason. Optional `member_sections` overrides the gross geometric
    `A`/`Iz`; `member_id` additionally returns a validated design-check payload.

    On success the response contains the `fundi.analysis.results/1` document, which is the
    input to the 2D/3D view adapters (`src/analysis/viewModel.mjs`).
    """
    from . import analysis

    payload = payload or {}
    model_id = payload.get("model_id") or payload.get("generator")
    if not model_id:
        raise HTTPException(status_code=422, detail="'model_id' or 'generator' is required")

    if payload.get("generator"):
        key = payload["generator"]
        if key not in generator_registry.GENERATORS:
            raise HTTPException(
                status_code=404,
                detail=f"unknown generator {key!r}; "
                       f"available: {sorted(generator_registry.GENERATORS)}",
            )
        model_doc = rc_model.build_model(key)
    else:
        model_doc = get_model(model_id)

    if "youngs_modulus_pa" not in payload:
        raise HTTPException(
            status_code=422,
            detail="'youngs_modulus_pa' is required: the analysis does not assume a material",
        )

    try:
        analytical = analysis.canonical_to_analysis(
            model_doc,
            youngs_modulus_pa=float(payload["youngs_modulus_pa"]),
            supports=payload.get("supports") or [],
            loads=payload.get("loads") or [],
            element_loads=payload.get("element_loads") or [],
            member_sections=payload.get("member_sections"),
            subdivisions=int(payload.get("subdivisions") or 1),
            case_id=str(payload.get("case_id") or "ULS-1"),
        )
        results = analysis.analyse(analytical)
    except analysis.AnalysisError as exc:
        message = str(exc)
        # A missing engine interpreter is an environment problem, not a bad request.
        status = 503 if "interpreter" in message else 422
        raise HTTPException(status_code=status, detail=message) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    response: Dict[str, Any] = {
        "ok": True,
        "model_id": results["model_id"],
        "case_id": results["cases"][0]["case_id"],
        "results": results,
        "analytical_model": {
            "nodes": len(analytical.nodes),
            "members": len(analytical.members),
            "supports": len(analytical.supports),
            "assumptions": analytical.assumptions,
        },
    }

    member_id = payload.get("member_id")
    if member_id:
        try:
            response["design_payload"] = analysis.design_check_payload(
                results,
                case_id=results["cases"][0]["case_id"],
                member_id=member_id,
                section=payload.get("section"),
            )
        except analysis.AnalysisError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    return response


@router.get("/analysis/engine")
def analysis_engine() -> Dict[str, Any]:
    """Report whether the OpenSees engine is usable, and with which interpreter.

    The engine runs as a separate Python 3.12 process (OpenSeesPy links python312.dll), so
    a UI should call this before offering an analysis button.
    """
    from . import analysis

    try:
        interpreter = analysis.opensees_python()
    except analysis.AnalysisError as exc:
        return {"available": False, "reason": str(exc)}
    return {
        "available": True,
        "interpreter": interpreter,
        "runner": analysis._runner_path(),
        "note": "OpenSeesPy runs as a subprocess; results are returned as "
                "fundi.analysis.results/1",
    }


@router.get("/file/{model_id}.{extension}")
def get_file(model_id: str, extension: str) -> FileResponse:
    """Download a generated artefact from the controlled store.

    IFC and model JSON are keyed by the model id, but a **drawing** is keyed by its
    drawing id (``pad_footing-r1``), because a regeneration must never overwrite a
    sheet a user may be editing. ``/file/{model_id}.dxf`` therefore resolves the
    model's newest drawing instead of assuming the two ids are the same.
    """
    if extension not in {"ifc", "dxf", "json"}:
        raise HTTPException(status_code=400, detail="extension must be ifc, dxf or json")
    try:
        path = store.path_for(model_id, extension)
    except store.StoreError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if extension == "dxf" and not os.path.exists(path):
        resolved = _newest_drawing_path(model_id)
        if resolved is None:
            raise HTTPException(
                status_code=404,
                detail=f"no drawing recorded for model {model_id!r}; "
                       "POST /api/cad-ifc/generate first",
            )
        path = resolved

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"{path} not generated yet")
    return FileResponse(path, filename=os.path.basename(path))


def _newest_drawing_path(model_id: str) -> Optional[str]:
    """Path of the most recent drawing for ``model_id``, or ``None``.

    Consults the mapping registry first (authoritative, records the exact path the
    export wrote) and falls back to the largest revision on disk so a download still
    works after the database has been recreated.
    """
    try:
        conn = mapping.connect(pipeline.DEFAULT_DB_PATH)
    except Exception:  # pragma: no cover - unreadable database
        conn = None
    if conn is not None:
        try:
            row = conn.execute(
                "SELECT drawing_id, dxf_path FROM fundi_drawings WHERE model_id = ? "
                "ORDER BY exported_at DESC, rowid DESC LIMIT 1",
                (model_id,),
            ).fetchone()
        except Exception:  # pragma: no cover - schema drift
            row = None
        finally:
            conn.close()
        if row is not None:
            candidate = os.path.join(store.CAD_DIR, f"{row['drawing_id']}.dxf")
            if os.path.exists(candidate):
                return candidate
            if row["dxf_path"] and os.path.exists(row["dxf_path"]):
                return row["dxf_path"]

    # Fallback: highest revision on disk whose id matches the model id under either
    # separator convention (generator keys use '_', model ids use '-').
    prefixes = {f"{model_id}-r", f"{model_id.replace('-', '_')}-r"}
    best: Optional[tuple] = None
    for name in store.list_artefacts("dxf"):
        for prefix in prefixes:
            if not name.startswith(prefix):
                continue
            suffix = name[len(prefix):]
            if not suffix.isdigit():
                continue
            revision = int(suffix)
            if best is None or revision > best[0]:
                best = (revision, name)
            break
    if best is None:
        return None
    candidate = os.path.join(store.CAD_DIR, f"{best[1]}.dxf")
    return candidate if os.path.exists(candidate) else None
