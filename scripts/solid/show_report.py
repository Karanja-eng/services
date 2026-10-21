"""Summarise the solid/STEP report produced by scripts/solid/septic-step.mjs."""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else ".test-artifacts/solid/report.json"
report = json.load(open(path, encoding="utf-8"))

print("ok:", report["ok"])
for component in report["model"]["components"]:
    print(
        f"  {component['role']:11s} volume={component['volumeM3']:.6f} m3  "
        f"solids={component['solidCount']}  valid={component['valid']}  "
        f"bbox={ {k: round(v, 4) for k, v in component['bbox']['size'].items()} }"
    )

print("\nSTEP files")
for file in report["step"]["files"]:
    reimport = file.get("reimport")
    status = (
        "ok volume=%.6f delta=%.2e" % (reimport["volumeM3"], reimport["volumeDeltaM3"])
        if reimport
        else "FAILED: " + str(file.get("reimportError"))
    )
    print(
        f"  {file['role']:11s} bytes={file['bytes']:7d} entities={file['entities']:5d} "
        f"solid_breps={file['solidBreps']} closed_shells={file['closedShells']} "
        f"faces={file['advancedFaces']:4d} metres={file['lengthUnitMetre']} "
        f"terminated={file['terminated']}\n              reimport: {status}"
    )

print("\nwarnings:", [warning["code"] for warning in report["model"]["warnings"]])
print(
    "penetrations:",
    [
        (penetration["elementIds"][0].split(".")[-1], penetration["applied"])
        for penetration in report["model"]["penetrations"]
    ],
)
print("operations:", len(report["model"]["operations"]), "| all valid:",
      all(op["valid"] for op in report["model"]["operations"]))
