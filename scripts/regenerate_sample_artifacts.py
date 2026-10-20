"""Regenerate the committed sample artefacts for the CAD/BIM workbench route.

Produces, for every existing RC generator:
  public/cad/<model-id>-rN.dxf          the tagged drawing the editor opens
  public/cad/<model-id>.json            the canonical engineering model
  public/cad/<model-id>.links.json      element <-> CAD/IFC links
  public/cad/<model-id>.entities.json   element <-> CAD entity links
  public/ifc/<model-id>.ifc             the semantic IFC4 model the BIM viewer loads

Run from the repository root with the backend interpreter:

    .venv-ifc\\Scripts\\python.exe scripts/regenerate_sample_artifacts.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath("src/Backend"))

from cad_ifc import generator_registry, pipeline  # noqa: E402

KEYS = ["beam", "column", "slab", "wall", "retaining_wall", "pad_footing",
        "stair", "stair_mst2"]

summary = []
for key in KEYS:
    report = pipeline.run_generator_pipeline(key, include_validation=True)
    summary.append(
        {
            "generator": key,
            "model_id": report["model"]["model_id"],
            "revision": report["model"]["revision"],
            "drawing_id": report["drawing"]["drawing_id"],
            "dxf": report["drawing"]["url"],
            "ifc": report["ifc"]["url"],
            "entities": report["drawing"]["entity_count"],
            "mapped": report["drawing"]["mapped_entity_count"],
            "unmapped": report["drawing"]["unmapped_entity_count"],
            "ifc_elements": report["ifc"]["element_count"],
            "ifc_classes": report["ifc"]["classes"],
            "validator_statements": report["validation"]["ifc_schema"]["statement_count"],
            "dxf_units_ok": report["validation"]["dxf_units"]["ok"],
            "canonical_valid": report["validation"]["canonical"]["ok"],
        }
    )
    print(
        f"{key:15s} {report['drawing']['drawing_id']:18s} "
        f"entities={report['drawing']['entity_count']:4d} "
        f"mapped={report['drawing']['mapped_entity_count']:4d} "
        f"ifc_elements={report['ifc']['element_count']} "
        f"validator={report['validation']['ifc_schema']['statement_count']}"
    )

manifest_path = os.path.join("public", "cad", "samples.json")
os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
with open(manifest_path, "w", encoding="utf-8") as handle:
    json.dump(
        {
            "generatedBy": "scripts/regenerate_sample_artifacts.py",
            "note": (
                "Sample artefacts so the /interop/cad-bim route shows real drawings and "
                "models before the backend has been run. Regenerate with the backend "
                "running; the API produces the same files on demand."
            ),
            "generators": summary,
        },
        handle,
        indent=2,
    )
print(f"\nwrote {manifest_path} ({len(summary)} generators)")
