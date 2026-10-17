"""
End-to-end generation pipeline for the CAD + BIM + IFC proof of concept.

    parameters
        -> canonical model                 (septic_model)
        -> IFC file                        (ifc_export  -> IfcOpenShell)
        -> DXF drawing                     (dxf_export  -> ezdxf)
        -> persisted element mapping       (mapping     -> SQLite)
        -> JSON documents for the browser  (this module)

Everything is driven from the same parameters in one call, so the IFC and the
drawing cannot silently diverge: they are two projections of one object, and the
mapping records which CAD entity and which IFC GlobalId belong to which internal
element.

A changed parameter produces a new revision; because IFC GlobalIds are derived
from the internal id, the mapping stays valid across regeneration.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

from . import dxf_export, identity, ifc_export, mapping, septic_model, units

DEFAULT_OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "public",
    "ifc",
)
DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "fundi_cad_ifc.sqlite"
)


def _write_json(path: str, payload: Any) -> str:
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    return path


def run_pipeline(
    params: Optional[Dict[str, Any]] = None,
    *,
    out_dir: str = DEFAULT_OUT_DIR,
    db_path: str = DEFAULT_DB_PATH,
    model_id: str = septic_model.SEPTIC_MODEL_ID,
    drawing_id: Optional[str] = None,
    include_validation: bool = True,
) -> Dict[str, Any]:
    """Generate the model, IFC, DXF and mapping; return a full report."""
    os.makedirs(out_dir, exist_ok=True)
    drawing_id = drawing_id or f"{model_id}-sheet-1"

    model_doc = septic_model.build_model(params, model_id=model_id)
    model_hash = septic_model.model_hash(model_doc)

    ifc_path = os.path.join(out_dir, f"{model_id}.ifc")
    dxf_path = os.path.join(out_dir, f"{model_id}.dxf")
    model_path = os.path.join(out_dir, f"{model_id}.model.json")
    links_path = os.path.join(out_dir, f"{model_id}.links.json")

    conn = mapping.connect(db_path)
    # Detected *before* writing, otherwise the new mtime would look like an edit.
    ifc_external_edit = mapping.file_modified_externally(conn, model_id, "ifc")
    dxf_external_edit = mapping.file_modified_externally(conn, model_id, "dxf")

    ifc_report = ifc_export.export_ifc(model_doc, ifc_path)
    dxf_report = dxf_export.export_dxf(
        model_doc, dxf_path, existing_path=dxf_path if os.path.exists(dxf_path) else None
    )

    revision = mapping.register_model(conn, model_doc, model_hash)
    sync_report = mapping.sync_links(
        conn,
        model_doc,
        drawing_id=drawing_id,
        dxf_links=dxf_report["links"],
        ifc_guids=ifc_report["guids"],
        ifc_conflict=ifc_external_edit,
    )
    copies = mapping.handle_copies(conn, model_id, drawing_id, dxf_report["links"])

    mapping.register_drawing(conn, drawing_id, model_id, dxf_path, dxf_report["insunits"])
    mapping.register_artifact(conn, model_id, "ifc", ifc_path)
    mapping.register_artifact(conn, model_id, "dxf", dxf_path)
    mapping.export_mapping_json(conn, model_id, links_path)

    _write_json(model_path, model_doc)
    links_document = mapping.mapping_document(conn, model_id)

    report: Dict[str, Any] = {
        "model": {
            "model_id": model_id,
            "revision": revision,
            "model_hash": model_hash,
            "element_count": model_doc["statistics"]["element_count"],
            "by_ifc_class": model_doc["statistics"]["by_ifc_class"],
            "total_volume_m3": model_doc["statistics"]["total_volume_m3"],
            "units": units.describe_units(),
            "json": model_path,
        },
        "ifc": {
            "path": ifc_path,
            "bytes": ifc_report["bytes"],
            "schema": ifc_report["schema"],
            "element_count": ifc_report["element_count"],
        },
        "dxf": {
            "path": dxf_path,
            "bytes": dxf_report["bytes"],
            "insunits": dxf_report["insunits"],
            "unit": dxf_report["unit"],
            "layers": dxf_report["layers"],
            "replaced_entities": dxf_report["replaced_entities"],
            "preserved_entities": dxf_report["preserved_entities"],
            "entities_with_links": len(dxf_report["links"]),
        },
        "mapping": {
            "db": db_path,
            "json": links_path,
            "revision": links_document["revision"],
            "link_count": len(links_document["links"]),
            "by_status": links_document["by_status"],
            "sync": sync_report,
            "copies": copies,
            "external_edits": {"ifc": ifc_external_edit, "dxf": dxf_external_edit},
        },
    }

    if include_validation:
        report["validation"] = {
            "ifc_units": dxf_export.check_unit_consistency(dxf_path),
            "ifc_readback": ifc_export.read_ifc_summary(ifc_path),
            "ifc_schema_validation": ifc_export.validate_ifc_file(ifc_path),
        }
    conn.close()
    return report


def main(argv: Optional[list[str]] = None) -> int:
    """CLI: regenerate the sample artifacts committed for the viewer routes."""
    import argparse

    parser = argparse.ArgumentParser(description="Fundi CAD/IFC proof-of-concept pipeline")
    parser.add_argument("--out-dir", default=DEFAULT_OUT_DIR)
    parser.add_argument("--db", default=DEFAULT_DB_PATH)
    parser.add_argument("--no-validation", action="store_true")
    args = parser.parse_args(argv)

    report = run_pipeline(
        out_dir=args.out_dir, db_path=args.db, include_validation=not args.no_validation
    )
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
