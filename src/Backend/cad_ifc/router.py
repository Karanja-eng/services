"""
FastAPI router exposing the CAD + BIM + IFC interoperability layer.

Mounted by ``src/Backend/main.py`` under ``/api/cad-ifc``. Kept import-guarded
there so that a missing optional dependency (IfcOpenShell) cannot break the rest
of the backend: the endpoints report the precise missing dependency instead.

Endpoint responsibilities
-------------------------
``GET  /units``                  unit/coordinate contract (verification)
``GET  /model/{model_id}``       canonical engineering model (JSON)
``GET  /links/{model_id}``       persisted element <-> CAD <-> IFC mapping
``POST /export``                 regenerate IFC + DXF + mapping from parameters
``GET  /file/{model_id}.{ext}``  download the generated artefact
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import FileResponse

from . import dxf_export, ifc_export, mapping, pipeline, septic_model, units

router = APIRouter(tags=["cad_ifc"])


@router.get("/units")
def get_units() -> Dict[str, Any]:
    """The unit and coordinate contract shared by CAD, model and IFC."""
    return {
        "units": units.describe_units(),
        "canonical": units.CANONICAL_LENGTH_UNIT,
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
        },
        "ezdxf": {"available": True, "version": getattr(dxf_export.ezdxf, "__version__", "")},
        "defaults": {"out_dir": pipeline.DEFAULT_OUT_DIR, "db": pipeline.DEFAULT_DB_PATH},
    }


@router.get("/model/{model_id}")
def get_model(model_id: str) -> Dict[str, Any]:
    if model_id != septic_model.SEPTIC_MODEL_ID:
        raise HTTPException(status_code=404, detail=f"unknown model {model_id!r}")
    return septic_model.build_model(model_id=model_id)


@router.get("/links/{model_id}")
def get_links(model_id: str) -> Dict[str, Any]:
    conn = mapping.connect(pipeline.DEFAULT_DB_PATH)
    try:
        document = mapping.mapping_document(conn, model_id)
    finally:
        conn.close()
    if not document["links"]:
        raise HTTPException(
            status_code=404,
            detail="no mapping recorded yet; POST /api/cad-ifc/export first",
        )
    return document


@router.post("/export")
def export(
    payload: Optional[Dict[str, Any]] = Body(default=None),
    include_validation: bool = True,
) -> Dict[str, Any]:
    """Regenerate IFC, DXF and the persistent mapping from parameters."""
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


@router.get("/file/{model_id}.{extension}")
def get_file(model_id: str, extension: str) -> FileResponse:
    if extension not in {"ifc", "dxf", "json"}:
        raise HTTPException(status_code=400, detail="extension must be ifc, dxf or json")
    if extension == "json":
        path = f"{pipeline.DEFAULT_OUT_DIR}/{model_id}.model.json"
    else:
        path = f"{pipeline.DEFAULT_OUT_DIR}/{model_id}.{extension}"
    import os

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"{path} not generated yet")
    return FileResponse(path, filename=os.path.basename(path))
