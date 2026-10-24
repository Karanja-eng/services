"""
FastAPI router for deterministic architectural CAD structural extraction.
Mounted under /arch_pro by src/Backend/calculations/Atomationmodels/arch_pro/yolo_cv.py
"""

from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel

router = APIRouter(tags=["cad_structural_extraction"])

BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"


class CADExtractionRequest(BaseModel):
    file_id: str
    storey_level: int = 1
    storey_height: float = 3.5
    wall_layers: Optional[List[str]] = None
    column_layers: Optional[List[str]] = None
    snap_tolerance: float = 0.05
    min_wall_thickness: float = 0.08
    max_wall_thickness: float = 0.45


def _resolve_cad_file(file_id: str) -> Path:
    if not UPLOADS_DIR.exists():
        raise HTTPException(status_code=404, detail="Uploads directory not found")
    for file_path in UPLOADS_DIR.iterdir():
        if file_path.name.startswith(file_id) and file_path.suffix.lower() in (
            ".dxf",
            ".dwg",
            ".ifc",
        ):
            return file_path
    raise HTTPException(status_code=404, detail=f"No CAD file found for ID '{file_id}'")


@router.get("/api/cad-layers/{file_id}")
async def get_cad_layers(file_id: str) -> Dict[str, Any]:
    """Inspect DXF file and list available layers with entity counts."""
    file_path = _resolve_cad_file(file_id)
    if file_path.suffix.lower() != ".dxf":
        return {"layers": [], "error": "Direct layer inspection requires DXF format"}

    try:
        import ezdxf

        doc = ezdxf.readfile(str(file_path))
        msp = doc.modelspace()
        layer_counts: Dict[str, int] = {}
        for entity in msp:
            layer = entity.dxf.layer
            layer_counts[layer] = layer_counts.get(layer, 0) + 1
        return {
            "file_id": file_id,
            "filename": file_path.name,
            "layers": [
                {"name": name, "entity_count": count}
                for name, count in sorted(layer_counts.items())
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error inspecting DXF: {exc}")


@router.post("/api/extract-structural-cad")
async def extract_structural_cad(
    request: CADExtractionRequest,
) -> Dict[str, Any]:
    """Deterministically extracts candidate structural elements from an uploaded architectural CAD file."""
    file_path = _resolve_cad_file(request.file_id)

    try:
        from .deterministic_cad_extractor import DeterministicCADExtractor
    except ImportError as err:
        raise HTTPException(
            status_code=503,
            detail=(
                "DeterministicCADExtractor is being installed or not yet generated. "
                f"Underlying import error: {err}"
            ),
        )

    try:
        extractor = DeterministicCADExtractor(
            snap_tolerance=request.snap_tolerance,
            min_wall_thickness=request.min_wall_thickness,
            max_wall_thickness=request.max_wall_thickness,
        )
        extraction_result = extractor.process_file(
            file_path=str(file_path),
            storey_level=request.storey_level,
            storey_height=request.storey_height,
            wall_layers=request.wall_layers,
            column_layers=request.column_layers,
        )
        return extraction_result
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Structural extraction failed: {str(exc)}"
        )
